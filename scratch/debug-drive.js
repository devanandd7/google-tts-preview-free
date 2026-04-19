const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

async function debugDrive() {
    try {
        const jsonPath = path.join(process.cwd(), "genbox-1-97eb1c75e9f9.json");
        if (!fs.existsSync(jsonPath)) {
            console.error("JSON file not found at:", jsonPath);
            return;
        }

        const credentials = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/drive"],
        });

        const drive = google.drive({ version: "v3", auth });

        console.log("--- Testing Connection ---");
        console.log("Service Account:", credentials.client_email);

        console.log("\n--- Listing ALL Accessible Files ---");
        const res = await drive.files.list({
            pageSize: 20,
            fields: "files(id, name, mimeType, owners)",
            q: "trashed = false"
        });

        const files = res.data.files;
        if (files.length === 0) {
            console.log("No files found. This means the Service Account cannot see ANYTHING.");
            console.log("REASON: You haven't shared the folder correctly with the email.");
        } else {
            files.forEach(file => {
                console.log(`- [${file.mimeType}] ${file.name} (ID: ${file.id})`);
            });
        }

        console.log("\n--- Searching specifically for 'GenBox Backups' folder ---");
        const folderRes = await drive.files.list({
            q: "mimeType = 'application/vnd.google-apps.folder' and name = 'GenBox Backups' and trashed = false",
            fields: "files(id, name)"
        });

        console.log("\n--- Testing File Upload ---");
        const testContent = "This is a test backup file.";
        const testBuffer = Buffer.from(testContent);
        
        const uploadRes = await drive.files.create({
            requestBody: {
                name: "GenBox_Test_Connection.txt",
                parents: folderRes.data.files.length > 0 ? [folderRes.data.files[0].id] : undefined
            },
            media: {
                mimeType: "text/plain",
                body: Readable.from(testBuffer)
            },
            fields: "id, name"
        });

        console.log("✅ SUCCESS: Uploaded test file!", uploadRes.data.id);

    } catch (error) {
        console.error("DEBUG ERROR:", error.response?.data || error.message);
    }
}

debugDrive();
