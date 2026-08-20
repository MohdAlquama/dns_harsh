import crypto from "crypto";

const encryptionPassword = process.env.PAYMENT_CONFIG_ENCRYPTION_KEY || process.env.ACCESS_TOKEN_SECRET || "DNS_DEVELOPMENT_PAYMENT_KEY";
const encryptionKey = crypto.createHash("sha256").update(encryptionPassword).digest();

const encryptSecret = (plainText) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
};

const decryptSecret = (value) => {
    const [iv, tag, encrypted] = String(value || "").split(".");
    if (!iv || !tag || !encrypted) throw new Error("Stored Cashfree secret is invalid");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
};

export { decryptSecret, encryptSecret };
