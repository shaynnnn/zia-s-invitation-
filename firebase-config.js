// Firebase web configuration for Zia Vie Marie’s RSVP website.
// Organizer access is restricted in app.js and Firestore security rules.
export const firebaseConfig = {
  apiKey: "AIzaSyAjzdnHEd2SMPCGo8Avgct7mhW-iJ38vF8",
  authDomain: "zia-vie-marie-rsvp.firebaseapp.com",
  projectId: "zia-vie-marie-rsvp",
  storageBucket: "zia-vie-marie-rsvp.firebasestorage.app",
  messagingSenderId: "757183550053",
  appId: "1:757183550053:web:0e28b609b86f37a4292c8c",
  measurementId: "G-3VDCJNPSEY"
};

export const ADMIN_EMAILS = [
  "rosmarksurco@gmail.com",
  "aguilarshayn@gmail.com"
];
// Kept for compatibility with older references, but admin.js uses ADMIN_EMAILS.
export const ADMIN_EMAIL = ADMIN_EMAILS[1];
