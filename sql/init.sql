CREATE DATABASE abdm_m2;
USE abdm_m2;

CREATE TABLE patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  abha_address VARCHAR(50) UNIQUE,
  name VARCHAR(100),
  mobile VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE care_contexts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT,
  abha_address VARCHAR(50),
  reference_number VARCHAR(50) UNIQUE,
  display_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE webhook_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notification_type VARCHAR(50),
  payload JSON,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fhir_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  care_context_id INT,
  fhir_bundle JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (care_context_id) REFERENCES care_contexts(id)
);

CREATE TABLE link_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  abha_address VARCHAR(100) NOT NULL,
  link_token TEXT NOT NULL,
  request_id VARCHAR(100),
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP DEFAULT NULL
);

-- alter table

ALTER TABLE webhook_logs
  ADD COLUMN transaction_id VARCHAR(100),
  ADD COLUMN patient_id VARCHAR(100),
  ADD COLUMN event_type VARCHAR(100);

ALTER TABLE webhook_logs
DROP COLUMN event_type;