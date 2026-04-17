import crypto from 'crypto';

// Use a 32-byte key from environment variables, or fallback (only for dev, warn if production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_replacement_32_bytes!';
const ALGORITHM = 'aes-256-gcm';

// Helper to ensure key is 32 bytes
const getKey = () => {
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substring(0, 32);
    return Buffer.from(key);
};

export function encrypt(text: string): string {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Format: iv:authTag:encryptedText
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
        console.error("Encryption failed:", error);
        throw new Error("Failed to encrypt data");
    }
}

export function decrypt(encryptedData: string): string {
    if (!encryptedData) return encryptedData;
    if (!encryptedData.includes(':')) {
        // legacy or unencrypted fallback
        return encryptedData;
    }

    try {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) return encryptedData; // Not our expected format

        const [ivHex, authTagHex, encryptedTextHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedTextHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error("Failed to decrypt data");
    }
}
