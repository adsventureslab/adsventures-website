// Netlify Function that serves the homepage, the hidden admin panel and the forms.
// Static files in /public (scripts, styles, logo) are served directly by Netlify first.
import { createApp } from '../../lib/core.mjs';
import { firestoreStore } from '../../lib/store.mjs';
import { cloudinaryMedia } from '../../lib/media.mjs';

const env = process.env;
const handle = createApp({
  env,
  store: firestoreStore({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY }),
  media: cloudinaryMedia({ cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, apiSecret: env.CLOUDINARY_API_SECRET }),
});

export default (req, context) => handle(req, context);
export const config = { path: '/*', preferStatic: true };
