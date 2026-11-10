/* WiNDS Notes - public browser configuration.
 * Keep OAuth client secrets and tokens out of this file. */
window.WINDS_GOOGLE_CLIENT_ID = '329919084457-rvh6k3brgmlampg1nm4c66p8joa07ffk.apps.googleusercontent.com';

// Optional public browser key from the SAME Google Cloud project. Enable Google Picker API.
// Restrict this key to the app's web origins and Google Picker API; never put a client secret here.
window.WINDS_GOOGLE_PICKER_API_KEY = 'AIzaSyDJ4rNn9cMW4hlLDgFKDIeJN9TkIxTr2gY';

// Automatic Google Drive reconnection (no more "Reconnect" every hour).
// 1. Google Cloud Console → Google Auth Platform → Clients → this Web client →
//    "Authorized redirect URIs" → add exactly:
//      https://winds-notes.github.io/oauth-callback.html
// 2. Save, then remove the // from the next line and redeploy.
// Enable it only after step 1: Google shows an error page for unregistered URLs.
// window.WINDS_GOOGLE_REDIRECT_URI = 'https://winds-notes.github.io/oauth-callback.html';
