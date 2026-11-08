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
  // After a save, clear the homepage from Netlify's edge cache so visitors see the change straight away.
  // Netlify gives every function NETLIFY_PURGE_API_TOKEN and SITE_ID; nothing to set up.
  async purge(ctx) {
    const token = env.NETLIFY_PURGE_API_TOKEN, siteId = (ctx && ctx.site && ctx.site.id) || env.SITE_ID;
    if (!token || !siteId) return;
    await fetch('https://api.netlify.com/api/v1/purge', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ site_id: siteId, cache_tags: ['home'] }) });
  },
});

export default (req, context) => handle(req, context);
export const config = { path: '/*', preferStatic: true };
