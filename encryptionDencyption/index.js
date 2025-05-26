import path from "path";
import { join } from "path";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { getFideliusVersion, generateRandomUUID, ensureDirExists } from "./utils.js";
const __dirname = path.resolve();

const fideliusVersion = getFideliusVersion();
const binPath = path.join(
  __dirname,
  `./encryptionDencyption/fidelius-cli-${fideliusVersion}/bin/fidelius-cli`
);

// console.log("binPath ", binPath);

const execFideliusCli = (args) => {
  const execOptions = { encoding: "utf-8" };
  const fideliusCommand = `${binPath} ${args.join(" ")}`;
  const result = execSync(fideliusCommand, execOptions);
  try {
    return JSON.parse(result.replace(/(\r\n|\n|\r)/gm, ""));
  } catch (error) {
    console.error(
      `ERROR - execFideliusCli Command: ${args.join(" ")}\n${result}`
    );
  }
};

const getEcdhKeyMaterial = () => {
  const result = execFideliusCli(["gkm"]);
  return result;
};

const writeParamsToFile = (...params) => {
  const fileContents = params.join("\n");
  const filePath = join(__dirname, "temp", `${generateRandomUUID()}.txt`);
  ensureDirExists(filePath);
  writeFileSync(filePath, fileContents);
  return filePath;
};

const removeFileAtPath = (filePath) => unlinkSync(filePath);

const encryptData = ({
  stringToEncrypt,
  senderNonce,
  requesterNonce,
  senderPrivateKey,
  requesterPublicKey,
}) => {
  const apijsonData = {
    stringToEncrypt,
    senderNonce,
    requesterNonce,
    senderPrivateKey,
    requesterPublicKey,
  };
  console.log("api json data ", apijsonData);
  const paramsFilePath = writeParamsToFile(
    "e",
    stringToEncrypt,
    senderNonce,
    requesterNonce,
    senderPrivateKey,
    requesterPublicKey
  );
  console.log("paramsFilePath " + paramsFilePath);
  const result = execFideliusCli(["-f", paramsFilePath]);
  console.log("result ", result);
  removeFileAtPath(paramsFilePath);
  return result;
};

const saneEncryptData = ({
  stringToEncrypt,
  senderNonce,
  requesterNonce,
  senderPrivateKey,
  requesterPublicKey,
}) => {
  const base64EncodedStringToEncrypt =
    Buffer.from(stringToEncrypt).toString("base64");
  const paramsFilePath = writeParamsToFile(
    "se",
    base64EncodedStringToEncrypt,
    senderNonce,
    requesterNonce,
    senderPrivateKey,
    requesterPublicKey
  );
  const result = execFideliusCli(["-f", paramsFilePath]);
  removeFileAtPath(paramsFilePath);
  return result;
};

const decryptData = ({
  encryptedData,
  requesterNonce,
  senderNonce,
  requesterPrivateKey,
  senderPublicKey,
}) => {
  const paramsFilePath = writeParamsToFile(
    "d",
    encryptedData,
    requesterNonce,
    senderNonce,
    requesterPrivateKey,
    senderPublicKey
  );
  const result = execFideliusCli(["-f", paramsFilePath]);
  removeFileAtPath(paramsFilePath);
 console.log("Raw CLI result:", result);
  console.log("Type of result:", Object.prototype.toString.call(result));

  let parsed;
  if (typeof result === "string") {
    try {
      parsed = JSON.parse(result.replace(/(\r\n|\n|\r)/gm, ""));
    } catch (e) {
      console.error("Failed to parse result:", e);
      throw e;
    }
  } else {
    parsed = result;
  }

  console.log("Parsed CLI result:", parsed);

  return parsed;
  // return result;
};

// runExample({ stringToEncrypt: '{"data": "There is no war in Ba Sing Se!"}' });
  export default {
    encryptData,
    saneEncryptData,
    decryptData,
    getEcdhKeyMaterial,
  };
