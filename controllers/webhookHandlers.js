import pool from "../config/db.js";
import { getAbdmToken } from "../services/abdmAuthService.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import ABDM_CONFIG from "../config/abdm.js";
import encryptionUtils from "../encryptionDencyption/index.js";
const { encryptData, getEcdhKeyMaterial } = encryptionUtils;

//call on handleGenertetoken webhook
export async function handleGenerateToken(body) {
  const { abhaAddress, linkToken, response } = body;

  if (!abhaAddress || !linkToken) {
    throw new Error("Missing abhaAddress or linkToken");
  }

  //seving to webhook_logs table
  const notificationType = "on-generate-token";
  const payload = body;
  await pool.query(
    `INSERT INTO webhook_logs (notification_type, payload, patient_AbhaAddress)
     VALUES (?, ?, ?)`,
    [notificationType, JSON.stringify(payload), abhaAddress]
  );

  //saving to links_tokkens table
  const requestId = response?.requestId || null;
  const now = new Date();
  const validUntil = new Date(now.setMonth(now.getMonth() + 6));

  await pool.query(
    `INSERT INTO link_tokens (abha_address, link_token, request_id, valid_until)
     VALUES (?, ?, ?, ?)`,
    [abhaAddress, linkToken, requestId, validUntil]
  );

  return "linkToken saved";
}

// call on-add-contexts webhook
export async function handleAddContexts(body) {
  const { resp } = body;
  const requestId = resp?.requestId;

  const [rows] = await pool.query(
    `SELECT abha_address FROM carecontext_requests
   WHERE request_id = ?`,
    [requestId]
  );

  if (rows.length > 0) {
    const { abha_address } = rows[0];
    const notificationType = "on-add-contexts";
    await pool.query(
      `INSERT INTO webhook_logs (notification_type, payload, patient_AbhaAddress)
     VALUES (?, ?, ?)`,
      [notificationType, JSON.stringify(body), abha_address]
    );
  }

  return "linkToken saved";
}

// handle context-care discovery
export async function handleDiscover(body) {
  const { transactionId, patient, requestId } = body;
  const abhaAddress = patient.id;
  const mr = patient.unverifiedIdentifiers?.find((i) => i.type === "MR")?.value;
  let payload;
  let responsePatient;

  if (!mr && !abhaAddress) {
    console.warn("Missing patient identifiers");
    return;
  }

  const [rows] = await pool.query(
    `SELECT reference_number, hi_type, patient_id, abha_address 
     FROM documents 
     WHERE patient_id = ? OR abha_address = ?`,
    [mr, abhaAddress]
  );

  if (rows.length === 0) {
    payload = {
      transactionId,
      error: {
        code: "ABDM-1010",
        message: "Patient not found",
      },
      response: {
        requestId,
      },
    };
  } else {
    responsePatient = rows.reduce((acc, doc) => {
      let block = acc.find((p) => p.referenceNumber === doc.patient_id);
      if (!block) {
        block = {
          referenceNumber: doc.patient_id,
          display: `Visit details for ${doc.patient_id}`,
          hiType: doc.hi_type,
          count: 0,
          careContexts: [],
        };
        acc.push(block);
      }

      block.careContexts.push({
        referenceNumber: doc.reference_number,
        display: `Document for ${doc.hi_type}`,
      });

      block.count++;
      return acc;
    }, []);

    payload = {
      transactionId,
      patient: responsePatient,
      matchedBy: ["MR"],
      response: {
        requestId,
      },
    };
  }

  const { accessToken } = await getAbdmToken();

  const response = await axios.post(
    `${ABDM_CONFIG.baseUrl}${ABDM_CONFIG.onDiscovery}`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-CM-ID": process.env.XCMID,
        "REQUEST-ID": uuidv4(),
        TIMESTAMP: new Date().toISOString(),
        "Content-Type": "application/json",
      },
    }
  );
  if ([200, 201, 202].includes(response.status)) {
    try {
      for (const p of responsePatient) {
        for (const cc of p.careContexts) {
          await pool.query(
            `INSERT INTO linking_requests 
            (request_id, transaction_id, abha_address, patient_id, carecontext_reference, hi_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
            [
              requestId,
              transactionId,
              abhaAddress,
              p.referenceNumber,
              cc.referenceNumber,
              p.hiType,
            ]
          );
        }
      }
    } catch (error) {
      console.error(" Error saving care context data to db:", error.message);
    }
  }
}

// to hadle on init webhook call
export async function handleInit(body) {
  try {
    const { transactionId, patient, error, requestId } = body;

    //handle error if i get error message
    if (error?.code === "ABDM-1056") {
      console.warn("Care context already linked:", error.message);
      return;
    }

    //Extract careContext reference and requestId
    const careContextRef = patient?.careContexts?.[0]?.referenceNumber;

    if (!transactionId || !careContextRef) {
      console.error("Missing transactionId or careContext reference.");
      return;
    }

    //Find the original request (to ensure it's valid)
    const [rows] = await pool.query(
      `SELECT request_id FROM linking_requests WHERE carecontext_reference = ?`,
      [careContextRef]
    );

    if (rows.length === 0) {
      console.warn("No matching care context found in linking_requests.");
      return;
    }

    const linkReferenceNumber = uuidv4();
    const communicationExpiry = new Date(
      Date.now() + 5 * 60 * 1000
    ).toISOString(); // 5 min expiry

    const payload = {
      transactionId,
      link: {
        referenceNumber: linkReferenceNumber,
        authenticationType: "MEDIATE",
        meta: {
          communicationMedium: "MOBILE",
          communicationHint: "OTP",
          communicationExpiry: communicationExpiry,
        },
      },
      response: {
        requestId: requestId,
      },
    };

    console.log("payload ", payload);

    const { accessToken } = await getAbdmToken();

    const response = await axios.post(
      `${ABDM_CONFIG.baseUrl}${ABDM_CONFIG.onInit}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-CM-ID": process.env.XCMID,
          "REQUEST-ID": uuidv4(),
          TIMESTAMP: new Date().toISOString(),
          "Content-Type": "application/json",
        },
      }
    );

    //response
    // console.log("response of init api calling "+JSON.stringify(response));
    // console.log("response of init api calling "+response.body);
    //Optionally update linking_requests table
    await pool.query(
      `UPDATE linking_requests
       SET status = ?, linked_at = NOW() , request_id = ?, reference_number = ?
       WHERE carecontext_reference = ?`,
      ["on-init-sent", requestId, linkReferenceNumber, careContextRef]
    );

    console.log("on-init sent for linking. Ref:", linkReferenceNumber);
  } catch (err) {
    console.error("Error in handleLinkInit:", err.message);
  }
}

export async function handleConfirm(body) {
  try {
    const { confirmation, requestId } = body;
    const linkRefNumber = confirmation?.linkRefNumber;

    if (!linkRefNumber) {
      console.error("Missing linkRefNumber in confirm webhook.");
      return;
    }

    //Fetch patient and careContext data using linkRefNumber
    const [rows] = await pool.query(
      `SELECT * FROM linking_requests 
       WHERE reference_number = ? AND status = 'on-init-sent'`,
      [linkRefNumber]
    );

    // if (rows.length === 0) {
    //   console.warn("No pending linking request found for this linkRefNumber.");
    //   return;
    // }
    // console.log("record ",rows[0]);
    const record = rows[0];
    // const requestId = record.request_id;
    // You might want to join with `documents` if you want display name
    const [docRows] = await pool.query(
      `SELECT * FROM documents 
       WHERE reference_number = ? LIMIT 1`,
      [record.carecontext_reference]
    );

    const doc = docRows[0] || {};

    //Prepare payload for on-confirm
    const payload = {
      patient: [
        {
          referenceNumber: linkRefNumber,
          display: doc.display_name || `Visit for ${record.patient_id}`,
          hiType: record.hi_type,
          count: 1,
          careContexts: [
            {
              referenceNumber: record.carecontext_reference,
              display: doc.display_name || record.carecontext_reference,
            },
          ],
        },
      ],
      response: {
        requestId,
      },
    };

    const { accessToken } = await getAbdmToken();

    await axios.post(
      `${ABDM_CONFIG.baseUrl}${ABDM_CONFIG.onConfirm}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-CM-ID": process.env.XCMID,
          "REQUEST-ID": uuidv4(),
          TIMESTAMP: new Date().toISOString(),
          "Content-Type": "application/json",
        },
      }
    );

    //Update DB status
    await pool.query(
      `UPDATE linking_requests SET status = ?, linked_at = NOW()
       WHERE id = ?`,
      ["linked", record.id]
    );

    console.log(
      "on-confirm sent successfully for linkRefNumber:",
      linkRefNumber
    );
  } catch (err) {
    console.error("Error in handleConfirmLink:", err.message);
  }
}

export async function handleNotify(body) {
  const { requestId, notification } = body;
  const consentId = notification?.consentId;
  const status = notification?.status;
  const patientAddress = notification?.consentDetail?.patient?.id;
  const purpose = notification?.consentDetail?.purpose?.text;
  console.log("purpose ", purpose);
  console.log("consentId ", consentId);
  console.log("status ", status);

  const payload = {
    acknowledgement: {
      status: "ok",
      consentId: consentId,
    },
    response: {
      requestId: requestId,
    },
  };
  const { accessToken } = await getAbdmToken();
  const response = await axios.post(
    `${ABDM_CONFIG.baseUrl}${ABDM_CONFIG.hipNotify}`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-CM-ID": process.env.XCMID,
        "REQUEST-ID": uuidv4(),
        TIMESTAMP: new Date().toISOString(),
        "Content-Type": "application/json",
      },
    }
  );

  if ([200, 201, 202].includes(response.status)) {
    try {
      const [consent] = await pool.query(
        `SELECT * FROM consents 
       WHERE abha_address = ? LIMIT 1`,
        [patientAddress]
      );
      console.log("consent table ", consent);
      console.log("consent length", consent.length);
      //if conset for a patinet is not present then we insert a row
      if (consent.length === 0) {
        console.log("inside insert query ");
        await pool.query(
          `INSERT INTO consents 
            (consent_id, purpose, status, abha_address)
           VALUES (?, ?, ?, ?)`,
          [consentId, purpose, status, patientAddress]
        );
      }
      // console.log("consent length", consent.length);
      if (consent.length != 0) {
        console.log("inside update query ");
        await pool.query(
          `update consents set consent_id = ?, purpose = ?, status = ? where abha_address = ?`,
          [consentId, purpose, status, patientAddress]
        );
      }
    } catch (error) {
      console.error("unable to update consents table ", error);
    }
  }
}

export async function handleRequest(body) {
  const { requestId, transactionId, hiRequest } = body;
  const consentId = hiRequest?.consent?.id;
  const keyMaterial = hiRequest?.keyMaterial;
  const dataPushUrl = hiRequest?.dataPushUrl;
  const requestPayload = {
    hiRequest: {
      transactionId: transactionId,
      sessionStatus: "ACKNOWLEDGED",
    },
    response: {
      requestId: requestId,
    },
  };
  const { accessToken } = await getAbdmToken();
  const response = await axios.post(
    `${ABDM_CONFIG.baseUrl}${ABDM_CONFIG.onRequest}`,
    requestPayload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-CM-ID": process.env.XCMID,
        "REQUEST-ID": uuidv4(),
        TIMESTAMP: new Date().toISOString(),
        "Content-Type": "application/json",
      },
    }
  );

  if ([200, 201, 202].includes(response.status)) {
    try {
      let carecontext_reference;
      const [consent] = await pool.query(
        `SELECT abha_address FROM consents 
       WHERE consent_id = ? LIMIT 1`,
        [consentId]
      );
      if (consent.length != 0) {
        const abhaAddress = consent[0].abha_address;
        [carecontext_reference] = await pool.query(
          `SELECT carecontext_reference FROM documents 
       WHERE abha_address = ? and carecontextSend = 1 and abdmdataSend = 0 LIMIT 1`,
          [abhaAddress]
        );
      }
      const carecontextVisit =
        carecontext_reference?.[0]?.carecontext_reference;
      const fhirMsg = {
        resourceType: "Bundle",
        type: "document",
        entry: [
          {
            resource: {
              resourceType: "Composition",
              id: "composition-1",
              status: "final",
              type: {
                coding: [
                  {
                    system: "http://loinc.org",
                    code: "57833-6",
                    display: "Prescription",
                  },
                ],
              },
              subject: {
                reference: "Patient/patient-1",
              },
              author: [
                {
                  reference: "Practitioner/practitioner-1",
                },
              ],
              title: "Prescription Record",
            },
          },
          {
            resource: {
              resourceType: "Patient",
              id: "patient-1",
              identifier: [
                {
                  system: "https://ndhm.in/healthid",
                  value: "prashantkumar2000@sbx",
                },
                {
                  system: "https://Parashospitalsgurugram.org/uhid",
                  value: "phuid-9089",
                },
              ],
              name: [
                {
                  text: "Prashant Kumar",
                },
              ],
              gender: "male",
              birthDate: "1990-01-01",
            },
          },
          {
            resource: {
              resourceType: "Practitioner",
              id: "practitioner-1",
              name: [
                {
                  text: "Dr. John Doe",
                },
              ],
            },
          },
          {
            resource: {
              resourceType: "Encounter",
              id: "encounter-1",
              identifier: [
                {
                  system: "https://Parashospitalsgurugram.org/carecontext",
                  value: carecontextVisit,
                },
              ],
              status: "finished",
              class: {
                system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                code: "AMB",
                display: "ambulatory",
              },
              subject: {
                reference: "Patient/patient-1",
              },
              period: {
                start: "2025-05-24T10:00:00Z",
                end: "2025-05-24T10:30:00Z",
              },
            },
          },
          {
            resource: {
              resourceType: "MedicationRequest",
              id: "medicationrequest-1",
              status: "active",
              intent: "order",
              medicationCodeableConcept: {
                coding: [
                  {
                    system: "http://www.nlm.nih.gov/research/umls/rxnorm",
                    code: "313782",
                    display: "Amoxicillin 500mg Capsule",
                  },
                ],
              },
              subject: {
                reference: "Patient/patient-1",
              },
              encounter: {
                reference: "Encounter/encounter-1",
              },
              authoredOn: "2025-05-24T10:00:00Z",
              requester: {
                reference: "Practitioner/practitioner-1",
              },
            },
          },
        ],
      };
      const senderKeyMaterial = getEcdhKeyMaterial();
      console.log(senderKeyMaterial);
      const encryptionResult = encryptData({
        stringToEncrypt: JSON.stringify(fhirMsg),
        senderNonce: senderKeyMaterial.nonce,
        requesterNonce: keyMaterial.nonce,
        senderPrivateKey: senderKeyMaterial.privateKey,
        requesterPublicKey: keyMaterial.dhPublicKey.keyValue,
      });
      // console.log("encrypted data ", encryptionResult);
      const payload = {
        pageNumber: 0, // Current page number.
        pageCount: 1, //Total number of pages.
        transactionId: transactionId,
        entries: [
          {
            content: encryptionResult.encryptedData,
            media: "application/fhir+json",
            checksum: "string",
            careContextReference: carecontextVisit,
          },
        ],
        keyMaterial: {
          cryptoAlg: keyMaterial.cryptoAlg,
          curve: keyMaterial.curve,
          dhPublicKey: {
            expiry: keyMaterial.dhPublicKey.expiry,
            parameters: keyMaterial.dhPublicKey.parameters,
            keyValue: senderKeyMaterial.x509PublicKey,
          },
          nonce: senderKeyMaterial.nonce,
        },
      };

      console.log("data push body ", payload);
      const { accessToken } = await getAbdmToken();
      const response = await axios.post(dataPushUrl, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if ([200, 201, 202].includes(response.status)) {
        const payload = {
          notification: {
            consentId: consentId,
            transactionId: transactionId,
            doneAt: new Date().toISOString(),
            notifier: {
              type: "HIP",
              id: process.env.XHIPID,
            },
            statusNotification: {
              sessionStatus: "TRANSFERRED",
              hipId: process.env.XHIPID,
              statusResponses: [
                {
                  careContextReference: carecontextVisit,
                  hiStatus: "OK",
                  description: "test care context",
                },
              ],
            },
          },
        };
        console.log("hipNotify ", payload);
        const { accessToken } = await getAbdmToken();
        const response = await axios.post(
          `${ABDM_CONFIG.baseUrl}${ABDM_CONFIG.dataflowNotify}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "X-CM-ID": process.env.XCMID,
              "REQUEST-ID": uuidv4(),
              TIMESTAMP: new Date().toISOString(),
              "Content-Type": "application/json",
            },
          }
        );
      }
    } catch (error) {
      console.log("unable get reference data in sending data ", error);
    }
  }
}
