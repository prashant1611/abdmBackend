import path from 'path';
const __dirname = path.resolve();
import fs from 'fs';
// import { readFileSync, existsSync, mkdirSync } from "fs";
// console.log("__dirname ",__dirname);

export function getFideliusVersion() {
	const gradleBuildContent = fs.readFileSync(
		path.join(__dirname, "./encryptionDencyption/build.gradle"),
		{ encoding: "utf-8" }
	);
	const [version] = gradleBuildContent.match(/\d+\.\d+\.\d+/);
	return version;
}
export function generateRandomUUID() {
	// Timestamp
	let d = new Date().getTime();

	// Time in microseconds since page-load or 0 if unsupported
	let d2 = (typeof performance !== "undefined" &&
		performance.now &&
		performance.now() * 1000) ||
		0;

	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
		/[xy]/g,
		function (c) {
			let r = Math.random() * 16; // Random number between 0 and 16
			if (d > 0) {
				// Use timestamp until depleted
				r = (d + r) % 16 | 0;
				d = Math.floor(d / 16);
			} else {
				// Use microseconds since page-load if supported
				r = (d2 + r) % 16 | 0;
				d2 = Math.floor(d2 / 16);
			}
			return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
		}
	);
}
export function ensureDirExists(filepath) {
	const dirname = path.dirname(filepath);
	if (fs.existsSync(dirname)) {
		return true;
	}
	ensureDirExists(dirname);
	fs.mkdirSync(dirname);
}