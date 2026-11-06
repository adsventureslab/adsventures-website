/*
 * Data storage.
 * firestoreStore: Firebase Firestore through its REST API, signed in with a service account (no packages needed).
 * fileStore: plain JSON files on disk, for running the site on your own computer.
 * Every record is kept as one JSON text field, so the database rules can stay "nobody from outside".
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const safeId = id => { if (!/^[A-Za-z0-9_.-]{1,120}$/.test(id)) throw new Error('bad id'); return id; };
const safeCol = c => { if (!/^[a-z]{2,20}$/.test(c)) throw new Error('bad collection'); return c; };

export function firestoreStore({ projectId, clientEmail, privateKey }) {
  const key = String(privateKey || '').replace(/\\n/g, '\n');
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  let token = null, tokenExp = 0;
  async function auth() {
    if (token && Date.now() < tokenExp - 60000) return token;
    const now = Math.floor(Date.now() / 1000);
    const head = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claims = Buffer.from(JSON.stringify({ iss: clientEmail, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })).toString('base64url');
    const sig = crypto.createSign('RSA-SHA256').update(head + '.' + claims).sign(key).toString('base64url');
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claims + '.' + sig }) });
    if (!r.ok) throw new Error('Firestore sign-in failed: ' + r.status);
    const j = await r.json(); token = j.access_token; tokenExp = Date.now() + j.expires_in * 1000;
    return token;
  }
  async function call(method, url, body) {
    const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + await auth(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Firestore ' + method + ' failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return r.status === 204 ? {} : r.json();
  }
  const parse = doc => { try { return JSON.parse(doc.fields.data.stringValue); } catch (e) { return null; } };
  return {
    async get(col, id) { const d = await call('GET', `${base}/${safeCol(col)}/${safeId(id)}`); return d ? parse(d) : null; },
    async set(col, id, value) { await call('PATCH', `${base}/${safeCol(col)}/${safeId(id)}`, { fields: { data: { stringValue: JSON.stringify(value) } } }); },
    async del(col, id) { await call('DELETE', `${base}/${safeCol(col)}/${safeId(id)}`); },
    async list(col) {
      const out = []; let pageToken = '';
      for (let i = 0; i < 20; i++) {
        const d = await call('GET', `${base}/${safeCol(col)}?pageSize=300${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`);
        if (!d) break;
        for (const doc of d.documents || []) out.push({ id: doc.name.split('/').pop(), value: parse(doc) });
        if (!d.nextPageToken) break; pageToken = d.nextPageToken;
      }
      return out;
    },
  };
}

export function fileStore(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const f = (col, id) => path.join(dir, safeCol(col), safeId(id) + '.json');
  return {
    async get(col, id) { try { return JSON.parse(fs.readFileSync(f(col, id), 'utf8')); } catch (e) { return null; } },
    async set(col, id, v) { fs.mkdirSync(path.join(dir, safeCol(col)), { recursive: true, mode: 0o700 }); fs.writeFileSync(f(col, id), JSON.stringify(v), { mode: 0o600 }); },
    async del(col, id) { try { fs.unlinkSync(f(col, id)); } catch (e) { /* already gone */ } },
    async list(col) {
      const d = path.join(dir, safeCol(col)); if (!fs.existsSync(d)) return [];
      return fs.readdirSync(d).filter(x => x.endsWith('.json')).map(x => ({ id: x.slice(0, -5), value: JSON.parse(fs.readFileSync(path.join(d, x), 'utf8')) }));
    },
  };
}
