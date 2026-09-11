// Public Google OAuth 2.0 Client ID (safe to expose client-side — it identifies
// the app, it does not authenticate anything by itself).
//
// Get one at https://console.cloud.google.com/apis/credentials
// -> Create Credentials -> OAuth client ID -> Web application
// -> add this site's URL under "Authorized JavaScript origins".
//
// Until this is set, the "Continue with Google" button shows a setup notice
// instead of silently pretending to sign the user in.
const GOOGLE_CLIENT_ID = "487469737581-k1idcre171eknatam925igofmc6jtk00.apps.googleusercontent.com";
