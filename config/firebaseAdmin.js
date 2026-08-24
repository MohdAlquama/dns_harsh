import admin from "firebase-admin";

let firebaseApp;

const getFirebaseAdminApp = () => {
    if (firebaseApp) return firebaseApp;

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
    }

    try {
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccountJson))
        });
        return firebaseApp;
    } catch (error) {
        throw new Error(`Firebase Admin initialization failed: ${error.message}`);
    }
};

export { admin, getFirebaseAdminApp };
