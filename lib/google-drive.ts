import { google } from "googleapis";
import { Readable } from "stream";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

export function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export async function getGoogleAuth(jsonKey?: string, refreshToken?: string) {
  if (refreshToken) {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  if (jsonKey) {
    const credentials = JSON.parse(jsonKey);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
  }

  throw new Error("No Google Drive credentials provided");
}

export async function findBackupFolder(auth: any) {
  const drive = google.drive({ version: "v3", auth });
  const response = await drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = 'GenBox Backups'",
    fields: "files(id, name)",
    pageSize: 1,
  });
  return response.data.files?.[0]?.id || null;
}

/**
 * Uploads a buffer to Google Drive using Service Account credentials.
 */
export async function uploadToDrive(
  jsonKey: string | undefined,
  buffer: Buffer,
  fileName: string,
  mimeType: string = "audio/wav",
  folderId?: string | null,
  refreshToken?: string
) {
  try {
    const auth = await getGoogleAuth(jsonKey, refreshToken);
    const drive = google.drive({ version: "v3", auth });

    // Auto-detect folder if not provided
    let targetFolderId = folderId;
    if (!targetFolderId) {
      targetFolderId = await findBackupFolder(auth);
    }

    const fileMetadata: any = {
      name: fileName,
    };

    if (targetFolderId) {
      fileMetadata.parents = [targetFolderId];
    }

    const media = {
      mimeType,
      body: Readable.from(buffer),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });

    return {
        ...response.data,
        detectedFolderId: !folderId ? targetFolderId : null
    };
  } catch (error) {
    console.error("[Google Drive Upload Error]", error);
    throw error;
  }
}

export async function createBackupFolder(auth: any) {
  const drive = google.drive({ version: "v3", auth });
  const fileMetadata = {
    name: "GenBox Backups",
    mimeType: "application/vnd.google-apps.folder",
  };
  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: "id",
  });
  return folder.data.id;
}

/**
 * Lists files from Google Drive (those accessible to the Service Account/OAuth).
 */
export async function listDriveFiles(
  jsonKey: string | undefined, 
  folderId?: string | null,
  refreshToken?: string
) {
  try {
    const auth = await getGoogleAuth(jsonKey, refreshToken);
    const drive = google.drive({ version: "v3", auth });
    
    // Auto-detect folder if not provided
    let targetFolderId = folderId;
    if (!targetFolderId) {
      targetFolderId = await findBackupFolder(auth);
    }

    // Safety: ONLY fetch files that start with "GenBox" OR are inside the GenBox folder
    // This prevents showing the user's private unrelated files.
    const qParts = ["trashed = false", "name contains 'GenBox'"];
    
    if (targetFolderId) {
      // If we have a folder, we can be more specific or just include everything in it
      // but since the user wants "GenBox related", we keep the name filter too.
      qParts.push(`'${targetFolderId}' in parents`);
    }

    const response = await drive.files.list({
      pageSize: 100,
      fields: "files(id, name, webViewLink, mimeType, createdTime)",
      orderBy: "createdTime desc",
      q: qParts.join(" and "),
    });

    return {
        files: response.data.files || [],
        folderExists: !!targetFolderId,
        detectedFolderId: !folderId ? targetFolderId : null
    };
  } catch (error) {
    console.error("[Google Drive List Error]", error);
    throw error;
  }
}
