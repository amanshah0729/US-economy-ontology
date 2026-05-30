import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

// Server-only Firebase Admin singleton. Used to verify caller ID tokens on
// privileged routes (e.g. /api/ai-sort) so they aren't open proxies.
// Lazily initialized so credentials are only required at request time.
let app: App | null = null;

function adminApp(): App {
  if (app) return app;
  const existing = getApps();
  app = existing.length
    ? existing[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECTID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Private key in .env has escaped newlines — unescape or cert() fails.
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
  return app;
}

export function getAdminAuth(): Auth {
  return getAuth(adminApp());
}
