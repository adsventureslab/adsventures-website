/*
 * Images and videos on Cloudinary (free plan).
 * The admin's browser uploads straight to Cloudinary with a short-lived signature from our server,
 * so the API secret never leaves the server. Cloudinary checks the real file format against allowed_formats.
 */
import crypto from 'node:crypto';

const FOLDER = 'adsventures/media';
const FORMATS = 'png,jpg,jpeg,webp,gif,mp4,mov,webm';

export function cloudinaryMedia({ cloudName, apiKey, apiSecret }) {
  const enabled = !!(cloudName && apiKey && apiSecret);
  const signParams = p => crypto.createHash('sha1').update(Object.keys(p).sort().map(k => k + '=' + p[k]).join('&') + apiSecret).digest('hex');
  const basic = 'Basic ' + Buffer.from(apiKey + ':' + apiSecret).toString('base64');
  return {
    enabled,
    isOurs: pid => /^adsventures\/media\/[a-z0-9-]{1,80}$/.test(pid),
    signUpload(name) {
      const slug = String(name || 'file').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file';
      const params = { allowed_formats: FORMATS, folder: FOLDER, public_id: slug + '-' + crypto.randomBytes(5).toString('hex'), timestamp: Math.floor(Date.now() / 1000) };
      return { url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`, fields: { ...params, api_key: apiKey, signature: signParams(params) } };
    },
    async list() {
      const out = [];
      for (const type of ['image', 'video']) {
        const r = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/${type}/upload?prefix=${encodeURIComponent(FOLDER + '/')}&max_results=500`, { headers: { Authorization: basic } });
        if (!r.ok) continue;
        const j = await r.json();
        for (const x of j.resources || []) out.push({ url: x.secure_url, publicId: x.public_id, size: x.bytes, at: x.created_at, kind: type });
      }
      return out.sort((a, b) => (a.at < b.at ? 1 : -1));
    },
    async destroy(publicId, type) {
      const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
      const body = new URLSearchParams({ ...params, api_key: apiKey, signature: signParams(params) });
      await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${type}/destroy`, { method: 'POST', body });
    },
  };
}

/* For running on your own computer without Cloudinary: uploads are turned off. */
export const noMedia = { enabled: false, isOurs: () => false, signUpload() { return {}; }, async list() { return []; }, async destroy() {} };
