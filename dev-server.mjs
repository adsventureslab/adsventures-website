// Run the site on your own computer: `npm run dev`, then open http://localhost:8888
// Uses files in ./local-data instead of Firestore, and a stand-in for Cloudinary so uploads work offline.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createApp } from './lib/core.mjs';
import { fileStore } from './lib/store.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const env = {
  ADMIN_PATH: process.env.ADMIN_PATH || 'local-admin-0123456789',
  SESSION_SECRET: process.env.SESSION_SECRET || 'local-only-secret-' + 'x'.repeat(32),
  SETUP_TOKEN: process.env.SETUP_TOKEN || 'local-setup-token-123',
  NODE_ENV: 'development',
};
const PORT = +process.env.PORT || 8888;
const upDir = path.join(root, 'local-data', 'uploads');
fs.mkdirSync(upDir, { recursive: true });
const localMedia = {
  enabled: true,
  isOurs: pid => /^adsventures\/media\/[a-z0-9-]{1,80}$/.test(pid),
  signUpload: name => ({ url: '/__upload', fields: { public_id: 'adsventures/media/' + (String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) || 'file') + '-' + crypto.randomBytes(4).toString('hex') } }),
  async list() { return fs.readdirSync(upDir).map(f => ({ url: '/__uploads/' + f, publicId: 'adsventures/media/' + f.replace(/\.[a-z0-9]+$/, ''), size: fs.statSync(path.join(upDir, f)).size, at: fs.statSync(path.join(upDir, f)).mtime.toISOString(), kind: /\.(mp4|webm|mov)$/.test(f) ? 'video' : 'image' })); },
  async destroy(pid) { for (const f of fs.readdirSync(upDir)) if ('adsventures/media/' + f.replace(/\.[a-z0-9]+$/, '') === pid) fs.unlinkSync(path.join(upDir, f)); },
};
const handle = createApp({ env, store: fileStore(path.join(root, 'local-data', 'db')), media: localMedia });
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  // static files first, like Netlify's preferStatic
  for (const [prefix, dir] of [['/assets/', path.join(root, 'public', 'assets')], ['/vendor/', path.join(root, 'public', 'vendor')], ['/__uploads/', upDir]]) {
    if (url.pathname.startsWith(prefix)) {
      const f = path.join(dir, path.basename(url.pathname));
      if (fs.existsSync(f)) { res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); return fs.createReadStream(f).pipe(res); }
      res.writeHead(404); return res.end();
    }
  }
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(url, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body });
  if (url.pathname === '/__upload' && req.method === 'POST') { // stand-in for Cloudinary
    const fd = await request.formData(), file = fd.get('file'), ext = (file.name.match(/\.([a-z0-9]+)$/i) || [, 'bin'])[1].toLowerCase();
    if (!/^(png|jpe?g|webp|gif|mp4|mov|webm)$/.test(ext)) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'Invalid image file format' } })); }
    const name = fd.get('public_id').split('/').pop() + '.' + ext;
    fs.writeFileSync(path.join(upDir, name), Buffer.from(await file.arrayBuffer()));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ secure_url: '/__uploads/' + name, resource_type: /mp4|mov|webm/.test(ext) ? 'video' : 'image', format: ext }));
  }
  const r = await handle(request, { ip: req.socket.remoteAddress });
  const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
  res.writeHead(r.status, h);
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => console.log(`Running at http://localhost:${PORT}  |  admin: http://localhost:${PORT}/${env.ADMIN_PATH}/#setup=${env.SETUP_TOKEN}`));
