const admin = require("firebase-admin");

let _initialized = false;

function getAdminAuth() {
  if (_initialized) return admin.auth();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin SDK not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env"
    );
  }

  // Avoid re-initializing if another module already called initializeApp
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  _initialized = true;
  return admin.auth();
}

/**
 * Verify a Firebase ID token issued by the client-side Firebase SDK.
 * Returns the decoded token containing `phone_number`, `uid`, etc.
 */
async function verifyIdToken(idToken) {
  const auth = getAdminAuth();
  return auth.verifyIdToken(idToken);
}

module.exports = { verifyIdToken };
