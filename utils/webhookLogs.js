import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();

const logDir = path.join(__dirname, 'logs');
const logFilePath = path.join(logDir, 'webhook-log.txt');

//Ensure the logs folder exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

//Utility function to log path and body
function logWebhook(path, body) {
    const logEntry = `\n[${new Date().toISOString()}] Webhook Path: ${path}\nBody: ${JSON.stringify(body, null, 2)}\n-----------------------\n\n`;

    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
}

export default logWebhook;