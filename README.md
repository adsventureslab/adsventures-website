# AdsVentures Lab website

This is the AdsVentures Lab website and its hidden admin panel, all on free plans:

- **Netlify (free):** hosts the website and runs the server code (`netlify/functions/site.mjs`).
- **Firebase Firestore (free Spark plan):** stores the content, saved versions, inbox and the admin account.
- **Cloudinary (free):** stores the images and videos you upload.

The project uses no third-party packages.

## One-time setup

### 1. Firebase (database)
1. Go to console.firebase.google.com and click **Create a project**. Keep the free Spark plan and skip Google Analytics.
2. Go to **Build > Firestore Database > Create database**. Choose **Production mode** and a location near you (for example `asia-south1`, Mumbai).
3. Open the **Rules** tab. Replace the rules with the contents of `firestore.rules`, then click **Publish**. This blocks all access from browsers.
4. Go to **Project settings** (gear icon) **> Service accounts > Generate new private key**. A JSON file downloads. Keep it private.

### 2. Cloudinary (images and videos)
1. Sign up for free at cloudinary.com.
2. On the dashboard, note your **Cloud name**, **API Key** and **API Secret**.

### 3. Netlify (website)
1. Sign up at netlify.com with **Sign up with GitHub**.
2. Click **Add new project > Import an existing project > GitHub**, then choose the `adsventures-website` repository. Leave the build settings as they are and click **Deploy**.
3. Go to **Project configuration > Environment variables** and add the variables below. Paste values only there, never in chat or email.

| Name | Value |
|---|---|
| `ADMIN_PATH` | A long random secret. It becomes your admin address. Make one at random.org/strings (20 characters, letters and digits). |
| `SESSION_SECRET` | Another random string, at least 40 characters. |
| `SETUP_TOKEN` | Another random string, at least 20 characters. It's used once, to create your login. |
| `NODE_ENV` | `production` |
| `FIREBASE_PROJECT_ID` | `project_id` from the JSON key file |
| `FIREBASE_CLIENT_EMAIL` | `client_email` from the JSON key file |
| `FIREBASE_PRIVATE_KEY` | `private_key` from the JSON key file. Copy everything from `-----BEGIN` to `END PRIVATE KEY-----\n`. |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary |
| `CLOUDINARY_API_KEY` | From Cloudinary |
| `CLOUDINARY_API_SECRET` | From Cloudinary |

4. Go to **Deploys > Trigger deploy > Deploy project** so the variables take effect.

### 4. Create your admin login
1. Open `https://<your-site>.netlify.app/<ADMIN_PATH>/#setup=<SETUP_TOKEN>`.
2. Enter your email and a strong password. Then scan the QR code with Google Authenticator or Microsoft Authenticator, and type the 6-digit code.
3. Bookmark `https://<your-site>/<ADMIN_PATH>/`. That's your admin panel. Setup closes for good once the account exists.

### 5. Your domain
In Netlify, go to **Domain management > Add a domain** and follow the DNS steps. HTTPS turns on by itself.

## Good to know

- After you click **Save & publish**, it can take up to a minute for every visitor to see the change, because Netlify caches the homepage.
- The free Netlify plan gives 300 credits a month. If they run out, the site pauses until the next month. You won't be charged. Netlify emails you at 50%, 75% and 100% use.
- **Lost your phone?** In Firebase, open Firestore and delete the document `kv/admin`. Then open the setup link again. Your content stays.
- **Run it on your computer:** `npm run dev`, then open http://localhost:8888. It uses local files instead of Firebase and Cloudinary.

## Security

Visitors and the admin get these protections:

- The admin panel lives at a secret address and asks for a password plus a 6-digit code.
- Repeated wrong tries trigger a lockout.
- Sessions are signed and expire.
- Every change needs a CSRF token.
- Strict security headers are sent on every page.
- Uploads are checked by their real format.
- Resumes are kept in the locked database.
- The forms are protected against spam.

All database access goes through the server, so the database rules block browsers completely.

## Editing the code

The page template and starting content are in `site-src/`, and the admin panel is in `admin/`. `lib/assets.mjs` is generated from them by the build script used during development, so don't edit it by hand.
