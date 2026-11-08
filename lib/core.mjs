/*
 * AdsVentures Lab: the website, hidden admin panel and form handling, as one request handler.
 * It runs as a Netlify Function. Data lives in Firestore and files in Cloudinary (see store.mjs and media.mjs).
 * No third-party packages.
 */
import crypto from 'node:crypto';
import { TEMPLATE, DEFAULTS_JSON, ADMIN_FILES } from './assets.mjs';

const DEFAULTS = JSON.parse(DEFAULTS_JSON);
const IDLE_MS = 30 * 60 * 1000;
const ABS_MS = 8 * 60 * 60 * 1000;
const RESUME_MAX = 3 * 1024 * 1024;

export function createApp({ store, media, env, purge }) {
  const ADMIN_PATH = String(env.ADMIN_PATH || '').replace(/^\/+|\/+$/g, '');
  const A = '/' + ADMIN_PATH;
  const DEV = env.NODE_ENV !== 'production';
  const COOKIE = DEV ? 'av_sid' : '__Host-av_sid';
  const SECRET = String(env.SESSION_SECRET || '');
  const configured = /^[A-Za-z0-9_-]{16,64}$/.test(ADMIN_PATH) && !/^change-me/.test(ADMIN_PATH) && SECRET.length >= 32;

  /* ---------------------------------------------------------------- helpers */
  const enc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
  const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
  const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[^\s@<>]{2,24}$/;
  const PHONE = /^\+?[0-9\s\-()]{7,20}$/;
  const newId = () => new Date().toISOString().replace(/[:.]/g, '-') + '_' + crypto.randomBytes(4).toString('hex');

  const MEDIA_HOSTS = "https://res.cloudinary.com";
  const SITE_CSP = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' ${MEDIA_HOSTS} https:; connect-src 'self'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'self'; base-uri 'none'; form-action 'self'; object-src 'none'`;
  const ADMIN_CSP = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https:; connect-src 'self' https://api.cloudinary.com; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'`;
  function headers(csp, extra) {
    const h = new Headers({
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()', 'Cross-Origin-Opener-Policy': 'same-origin',
    });
    if (!DEV) h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    if (csp) h.set('Content-Security-Policy', csp);
    for (const [k, v] of Object.entries(extra || {})) h.set(k, v);
    return h;
  }
  const json = (code, obj, extra) => new Response(JSON.stringify(obj), { status: code, headers: headers(null, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(extra || {}) }) });
  const notFound = () => new Response('<!doctype html><meta charset=utf-8><title>Not found</title><body style="font:16px system-ui;padding:48px;color:#141416"><h1>Page not found</h1><p><a href="/">Go to the homepage</a></p>', { status: 404, headers: headers("default-src 'none'; style-src 'unsafe-inline'", { 'Content-Type': 'text/html; charset=utf-8' }) });
  const fail = (code, msg) => Object.assign(new Error(msg), { code });

  async function readJson(req, limit) {
    if (!/^application\/json/i.test(req.headers.get('content-type') || '')) throw fail(415, 'bad_type');
    const len = +req.headers.get('content-length');
    if (len && len > limit) throw fail(413, 'too_large');
    const buf = await req.arrayBuffer();
    if (buf.byteLength > limit) throw fail(413, 'too_large');
    try { return JSON.parse(Buffer.from(buf).toString('utf8')); } catch (e) { throw fail(400, 'bad_json'); }
  }
  function ipOf(req, ctx) { return (ctx && ctx.ip) || req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'; }
  function sameOrigin(req) {
    const o = req.headers.get('origin'); if (!o) return true;
    try { return new URL(o).host === new URL(req.url).host; } catch (e) { return false; }
  }
  async function limited(key, max, windowMs) {
    const id = 'rl_' + sha256(key).slice(0, 40), now = Date.now();
    let b = await store.get('rl', id);
    if (!b || b.reset < now) b = { n: 0, reset: now + windowMs };
    b.n++; await store.set('rl', id, b);
    return b.n > max;
  }

  /* ---------------------------------------------------------------- content */
  async function getContent() { return (await store.get('kv', 'content')) || DEFAULTS; }
  function render(c) {
    const data = JSON.stringify(c).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const seo = c.seo || {};
    return TEMPLATE.split('__SEO_TITLE__').join(enc(seo.title || 'AdsVentures Lab')).split('__SEO_DESC__').join(enc(seo.description || '')).split('__CONTENT__').join(data);
  }
  const MEDIA_KEYS = /^(image|logo|photo|poster|video|src|cover|avatar|thumb)$/i, LINK_KEYS = /^(href|link|url)$/i;
  const validMedia = v => v === '' || (DEV && /^\/__uploads\/[a-z0-9.-]{1,120}$/.test(v)) || (/^\/assets\/[A-Za-z0-9._\/-]{1,200}$/.test(v) && !v.includes('..')) || /^https:\/\/[^\s<>"']{4,500}$/.test(v) || (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(v) && v.length < 600000);
  const validLink = v => v === '' || /^#[A-Za-z0-9_-]{0,60}$/.test(v) || /^https:\/\/[^\s<>"']{4,500}$/.test(v) || /^(mailto|tel):[^\s<>"']{3,200}$/.test(v) || /^\/[A-Za-z0-9._\/#-]{0,200}$/.test(v);
  function checkContent(c) {
    const errs = [];
    if (!c || typeof c !== 'object' || Array.isArray(c)) return ['The content must be an object.'];
    for (const k of Object.keys(c)) if (!(k in DEFAULTS)) errs.push('Unknown section: ' + k);
    for (const k of Object.keys(DEFAULTS)) if (!(k in c)) errs.push('Missing section: ' + k);
    if (JSON.stringify(c).length > 900000) errs.push('The content is too large.');
    (function walk(v, at, depth, key) {
      if (errs.length > 20) return;
      if (depth > 10) { errs.push(at + ' is nested too deeply.'); return; }
      if (v === null || typeof v === 'boolean') return;
      if (typeof v === 'number') { if (!isFinite(v)) errs.push(at + ' is not a valid number.'); return; }
      if (typeof v === 'string') {
        if (v.length > 20000) errs.push(at + ' is too long.');
        if (MEDIA_KEYS.test(key) && !validMedia(v)) errs.push(at + ' must be an uploaded file or an https:// link.');
        if (LINK_KEYS.test(key) && !validLink(v)) errs.push(at + ' must start with #, /, https://, mailto: or tel:.');
        return;
      }
      if (Array.isArray(v)) { if (v.length > 500) errs.push(at + ' has too many items.'); v.forEach((x, i) => walk(x, at + '[' + i + ']', depth + 1, key)); return; }
      if (typeof v === 'object') {
        for (const k of Object.keys(v)) {
          if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k) || k === 'constructor' || k === 'prototype') { errs.push('Bad field name at ' + at); continue; }
          walk(v[k], at + '.' + k, depth + 1, k);
        }
        return;
      }
      errs.push(at + ' has an unsupported value.');
    })(c, 'content', 0, '');
    return errs;
  }
  async function saveContent(next, note, req, ctx) {
    const prev = await getContent();
    const id = newId();
    await store.set('history', id, { note: note || 'Saved', at: new Date().toISOString(), content: prev });
    await store.set('kv', 'content', next);
    if (purge) { try { await purge(ctx); } catch (e) { /* page refreshes itself within the hour */ } }
    const idx = (await store.get('kv', 'historyIndex')) || [];
    idx.unshift({ id, at: new Date().toISOString(), note: note || 'Saved' });
    for (const old of idx.splice(60)) await store.del('history', old.id);
    await store.set('kv', 'historyIndex', idx);
    await audit(req, ctx, note || 'Saved changes');
  }
  async function audit(req, ctx, what, extra) {
    try { await store.set('audit', newId(), { t: new Date().toISOString(), ip: ipOf(req, ctx), what, ...(extra || {}) }); } catch (e) { /* never block on logging */ }
  }

  /* ---------------------------------------------------------------- passwords and 2-step codes */
  const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  function hashPassword(pw) {
    const salt = crypto.randomBytes(16), key = crypto.scryptSync(pw, salt, 64, SCRYPT);
    return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
  }
  function checkPassword(pw, stored) {
    try {
      const [, N, r, p, salt, key] = String(stored).split('$');
      const k = crypto.scryptSync(pw, Buffer.from(salt, 'base64'), 64, { N: +N, r: +r, p: +p, maxmem: 64 * 1024 * 1024 });
      return crypto.timingSafeEqual(k, Buffer.from(key, 'base64'));
    } catch (e) { return false; }
  }
  const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function base32(buf) { let bits = 0, val = 0, out = ''; for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(val << (5 - bits)) & 31]; return out; }
  function unbase32(s) { let bits = 0, val = 0; const out = []; for (const c of s) { val = (val << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
  function totp(secret, step) {
    const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
    const h = crypto.createHmac('sha1', unbase32(secret)).update(msg).digest(), o = h[h.length - 1] & 15;
    return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
  }
  function checkTotp(secret, code, lastStep) {
    if (!/^\d{6}$/.test(String(code || ''))) return -1;
    const now = Math.floor(Date.now() / 30000);
    for (const s of [now - 1, now, now + 1]) if (s > (lastStep || 0) && safeEqual(totp(secret, s), code)) return s;
    return -1;
  }
  function passwordProblem(pw, email) {
    if (pw.length < 12) return 'Use at least 12 characters.';
    if (pw.length > 200) return 'That password is too long.';
    if (email && pw.toLowerCase().includes(email.split('@')[0])) return "Don't use your email name in the password.";
    if (/^(.)\1+$/.test(pw) || /^(password|adsventures|123456|qwerty)/i.test(pw)) return 'That password is too easy to guess.';
    return '';
  }

  /* ---------------------------------------------------------------- sessions: signed cookie, revocable */
  const b64u = b => Buffer.from(b).toString('base64url');
  const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
  function cookieFor(sess) {
    const body = b64u(JSON.stringify(sess)), v = body + '.' + sign(body);
    return `${COOKIE}=${v}; Path=/; HttpOnly; SameSite=Strict${DEV ? '' : '; Secure'}; Max-Age=${ABS_MS / 1000}`;
  }
  const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict${DEV ? '' : '; Secure'}; Max-Age=0`;
  function readCookie(req) {
    const raw = (req.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
    if (!raw) return null;
    const v = raw.slice(COOKIE.length + 1), i = v.lastIndexOf('.');
    if (i < 1 || !safeEqual(sign(v.slice(0, i)), v.slice(i + 1))) return null;
    try { return JSON.parse(Buffer.from(v.slice(0, i), 'base64url').toString('utf8')); } catch (e) { return null; }
  }
  function newSession(admin, ip) {
    return { sid: crypto.randomBytes(18).toString('base64url'), csrf: crypto.randomBytes(24).toString('base64url'), created: Date.now(), seen: Date.now(), ver: admin.sessionVersion || 0, ip: sha256(ip).slice(0, 12) };
  }
  async function getSession(req) {
    const s = readCookie(req); if (!s) return null;
    const now = Date.now();
    if (now - s.seen > IDLE_MS || now - s.created > ABS_MS) return null;
    const admin = await store.get('kv', 'admin');
    if (!admin || (admin.sessionVersion || 0) !== s.ver) return null;
    s.seen = now; s.admin = admin;
    return s;
  }

  /* ---------------------------------------------------------------- file type by real bytes */
  function sniff(buf) {
    const hex = buf.subarray(0, 16).toString('hex');
    if (hex.startsWith('25504446')) return { ext: 'pdf', mime: 'application/pdf' };
    if (hex.startsWith('504b0304')) return { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    if (hex.startsWith('d0cf11e0a1b11ae1')) return { ext: 'doc', mime: 'application/msword' };
    return null;
  }

  /* ---------------------------------------------------------------- public forms */
  async function publicForm(req, ctx, kind) {
    if (!sameOrigin(req)) return json(403, { error: 'Please send the form from our website.' });
    const ip = ipOf(req, ctx);
    if (await limited('form:' + ip, 6, 15 * 60 * 1000)) return json(429, { error: 'Too many tries. Please wait a few minutes and try again.' });
    let b;
    try { b = await readJson(req, kind === 'apply' ? 5.5 * 1024 * 1024 : 32 * 1024); }
    catch (e) { return json(e.code === 413 ? 413 : 400, { error: e.code === 413 ? 'The file is too large. Upload a file up to 3 MB.' : 'Something was wrong with the form. Please try again.' }); }
    if (b._hp || !(+b._t > 0) || Date.now() - +b._t < 3000) return json(200, { ok: true }); // bots
    const item = { id: newId(), type: kind, at: new Date().toISOString(), read: false };
    if (kind === 'inquiry') {
      Object.assign(item, { name: clean(b['f-name'], 80), business: clean(b['f-biz'], 120), email: clean(b['f-email'], 200), phone: clean(b['f-phone'], 30), package: clean(b['f-pkg'], 80), message: clean(b['f-msg'], 3000) });
      if (item.name.length < 2 || item.business.length < 2 || !EMAIL.test(item.email) || (item.phone && !PHONE.test(item.phone))) return json(400, { error: 'Please check your details and try again.' });
    } else {
      Object.assign(item, { name: clean(b['j-name'], 80), email: clean(b['j-email'], 200), phone: clean(b['j-phone'], 30), role: clean(b['j-role'], 120), experience: clean(b['j-exp'], 60), link: clean(b['j-link'], 300), message: clean(b['j-why'], 3000) });
      if (item.name.length < 2 || !EMAIL.test(item.email) || !PHONE.test(item.phone) || !item.role || (item.link && !/^https?:\/\/[^\s<>"']+$/i.test(item.link))) return json(400, { error: 'Please check your details and try again.' });
      const cv = b['j-cv'];
      if (!cv || typeof cv.data !== 'string') return json(400, { error: 'Please attach your resume.' });
      const buf = Buffer.from(cv.data, 'base64'), t = sniff(buf);
      if (!t) return json(400, { error: 'Upload your resume as a PDF or Word file.' });
      if (buf.length > RESUME_MAX) return json(400, { error: 'The file is larger than 3 MB.' });
      // stored privately in the locked database, split into parts under Firestore's 1 MB limit
      const data = buf.toString('base64'), parts = Math.ceil(data.length / 900000);
      for (let i = 0; i < parts; i++) await store.set('files', item.id + '_' + i, { d: data.slice(i * 900000, (i + 1) * 900000) });
      item.file = { parts, name: clean(cv.name, 120).replace(/[^\w .()-]/g, '_') || 'resume.' + t.ext, mime: t.mime, size: buf.length };
    }
    await store.set('inbox', item.id, item);
    return json(200, { ok: true });
  }

  /* ---------------------------------------------------------------- admin API */
  async function adminApi(req, ctx, sub) {
    const m = req.method, ip = ipOf(req, ctx);
    if (m !== 'GET' && !sameOrigin(req)) return json(403, { error: 'Blocked.' });
    let admin = await store.get('kv', 'admin');

    if (sub === 'state' && m === 'GET') {
      const s = await getSession(req);
      return json(200, { needsSetup: !admin, loggedIn: !!s, csrf: s ? s.csrf : null, email: s ? admin.email : null }, s ? { 'Set-Cookie': cookieFor(strip(s)) } : {});
    }
    if (sub === 'setup/start' && m === 'POST') {
      if (admin) return json(404, { error: 'Setup is already done.' });
      if (await limited('setup:' + ip, 10, 15 * 60 * 1000)) return json(429, { error: 'Too many tries. Wait 15 minutes.' });
      const b = await readJson(req, 4096);
      if (!env.SETUP_TOKEN || String(env.SETUP_TOKEN).length < 16 || !safeEqual(b.token || '', env.SETUP_TOKEN)) return json(403, { error: 'This setup link is not valid. Use the link with your SETUP_TOKEN.' });
      const secret = base32(crypto.randomBytes(20));
      await store.set('kv', 'pendingSetup', { secret, exp: Date.now() + 15 * 60 * 1000 });
      return json(200, { secret, uri: `otpauth://totp/AdsVentures%20Lab%20Admin?secret=${secret}&issuer=AdsVentures%20Lab&digits=6&period=30` });
    }
    if (sub === 'setup/finish' && m === 'POST') {
      if (admin) return json(404, { error: 'Setup is already done.' });
      if (await limited('setup:' + ip, 10, 15 * 60 * 1000)) return json(429, { error: 'Too many tries. Wait 15 minutes.' });
      const b = await readJson(req, 4096);
      if (!env.SETUP_TOKEN || !safeEqual(b.token || '', env.SETUP_TOKEN)) return json(403, { error: 'This setup link is not valid.' });
      const pending = await store.get('kv', 'pendingSetup');
      if (!pending || pending.exp < Date.now()) return json(400, { error: 'Setup timed out. Reload the page and start again.' });
      const email = clean(b.email, 200).toLowerCase(), pw = String(b.password || '');
      if (!EMAIL.test(email)) return json(400, { error: 'Enter a valid email.' });
      const pe = passwordProblem(pw, email); if (pe) return json(400, { error: pe });
      const step = checkTotp(pending.secret, b.code, 0);
      if (step < 0) return json(400, { error: 'That code did not match. Check the time on your phone and try the newest code.' });
      admin = { email, pass: hashPassword(pw), totp: pending.secret, lastStep: step, failed: 0, lockedUntil: 0, sessionVersion: 1 };
      await store.set('kv', 'admin', admin); await store.del('kv', 'pendingSetup');
      await audit(req, ctx, 'admin.created');
      const s = newSession(admin, ip);
      return json(200, { ok: true, csrf: s.csrf }, { 'Set-Cookie': cookieFor(s) });
    }
    if (sub === 'login' && m === 'POST') {
      if (!admin) return json(400, { error: 'Finish setup first.' });
      if (await limited('login:' + ip, 8, 15 * 60 * 1000)) { await audit(req, ctx, 'login.ratelimited'); return json(429, { error: 'Too many tries from this device. Wait 15 minutes.' }); }
      if ((admin.lockedUntil || 0) > Date.now()) return json(429, { error: 'Login is paused for safety after many wrong tries. Try again later.' });
      const b = await readJson(req, 4096);
      const okEmail = safeEqual(clean(b.email, 200).toLowerCase(), admin.email);
      const okPass = checkPassword(String(b.password || '').slice(0, 200), okEmail ? admin.pass : DUMMY_HASH) && okEmail;
      const step = okPass ? checkTotp(admin.totp, b.code, admin.lastStep) : -1;
      if (step < 0) {
        admin.failed = (admin.failed || 0) + 1;
        if (admin.failed >= 10) { admin.lockedUntil = Date.now() + 30 * 60 * 1000; admin.failed = 0; await audit(req, ctx, 'login.locked'); }
        await store.set('kv', 'admin', admin); await audit(req, ctx, 'login.failed');
        return json(401, { error: 'Email, password or code is wrong.' });
      }
      admin.failed = 0; admin.lastStep = step; await store.set('kv', 'admin', admin);
      const s = newSession(admin, ip); await audit(req, ctx, 'login.ok');
      return json(200, { ok: true, csrf: s.csrf }, { 'Set-Cookie': cookieFor(s) });
    }

    /* everything below needs a session; changes also need the CSRF token */
    const s = await getSession(req);
    if (!s) return json(401, { error: 'Please log in again.' }, { 'Set-Cookie': clearCookie() });
    if (m !== 'GET' && !safeEqual(req.headers.get('x-csrf-token') || '', s.csrf)) return json(403, { error: 'Please reload the page and try again.' });
    admin = s.admin;
    const ok = (obj, extra) => json(200, obj || { ok: true }, { 'Set-Cookie': cookieFor(strip(s)), ...(extra || {}) });

    if (sub === 'logout' && m === 'POST') { await audit(req, ctx, 'logout'); return json(200, { ok: true }, { 'Set-Cookie': clearCookie() }); }
    if (sub === 'content' && m === 'GET') return ok({ content: await getContent(), defaults: DEFAULTS, media: media.enabled });
    if (sub === 'content' && m === 'PUT') {
      const b = await readJson(req, 1.5 * 1024 * 1024);
      const errs = checkContent(b.content);
      if (errs.length) return json(400, { error: 'Some fields need fixing.', details: errs.slice(0, 10) });
      await saveContent(b.content, 'Saved changes', req, ctx);
      return ok();
    }
    if (sub === 'preview' && m === 'POST') {
      const b = await readJson(req, 1.5 * 1024 * 1024);
      const errs = checkContent(b.content);
      if (errs.length) return json(400, { error: 'Some fields need fixing.', details: errs.slice(0, 10) });
      await store.set('drafts', s.sid, { content: b.content, exp: Date.now() + 2 * 60 * 60 * 1000 });
      return ok();
    }
    if (sub === 'upload/sign' && m === 'POST') {
      if (!media.enabled) return json(400, { error: 'File uploads are not set up yet. Add the Cloudinary keys in Netlify.' });
      if (await limited('upload:' + s.sid, 300, 60 * 60 * 1000)) return json(429, { error: 'Too many uploads. Wait a while.' });
      const b = await readJson(req, 2048);
      return ok(media.signUpload(clean(b.name, 60)));
    }
    if (sub === 'media' && m === 'GET') {
      if (!media.enabled) return ok({ items: [] });
      const used = JSON.stringify(await getContent());
      const items = (await media.list()).map(x => ({ ...x, used: used.includes(x.publicId) }));
      return ok({ items });
    }
    if (sub === 'media/delete' && m === 'POST') {
      const b = await readJson(req, 2048), pid = String(b.publicId || '');
      if (!media.isOurs(pid)) return json(400, { error: 'Bad file.' });
      if (JSON.stringify(await getContent()).includes(pid)) return json(400, { error: 'This file is used on the website. Remove it from the page first.' });
      await media.destroy(pid, b.kind === 'video' ? 'video' : 'image');
      await audit(req, ctx, 'media.delete', { pid });
      return ok();
    }
    if (sub === 'history' && m === 'GET') return ok({ items: (await store.get('kv', 'historyIndex')) || [] });
    if (sub === 'history/restore' && m === 'POST') {
      const b = await readJson(req, 1024);
      if (!/^[0-9TZ_a-f-]{20,60}$/.test(String(b.id || ''))) return json(400, { error: 'Bad version.' });
      const v = await store.get('history', b.id);
      if (!v || checkContent(v.content).length) return json(404, { error: 'That version was not found.' });
      await saveContent(v.content, 'Restored version from ' + v.at, req, ctx);
      return ok();
    }
    if (sub === 'inbox' && m === 'GET') {
      const items = (await store.list('inbox')).map(x => x.value).sort((a, b) => (a.at < b.at ? 1 : -1));
      return ok({ items });
    }
    let mm;
    if ((mm = /^inbox\/([0-9TZ_a-f-]{20,60})(\/read|\/file)?$/.exec(sub))) {
      const it = await store.get('inbox', mm[1]);
      if (!it) return json(404, { error: 'Not found.' });
      if (mm[2] === '/read' && m === 'POST') { it.read = true; await store.set('inbox', it.id, it); return ok(); }
      if (mm[2] === '/file' && m === 'GET' && it.file) {
        let data = '';
        for (let i = 0; i < it.file.parts; i++) data += ((await store.get('files', it.id + '_' + i)) || {}).d || '';
        return new Response(Buffer.from(data, 'base64'), { status: 200, headers: headers("default-src 'none'; sandbox", { 'Content-Type': it.file.mime, 'Content-Disposition': 'attachment; filename="' + it.file.name.replace(/"/g, '') + '"', 'Cache-Control': 'no-store' }) });
      }
      if (!mm[2] && m === 'DELETE') {
        if (it.file) for (let i = 0; i < it.file.parts; i++) await store.del('files', it.id + '_' + i);
        await store.del('inbox', it.id); await audit(req, ctx, 'inbox.delete');
        return ok();
      }
    }
    if (sub === 'password' && m === 'POST') {
      if (await limited('pw:' + s.sid, 5, 15 * 60 * 1000)) return json(429, { error: 'Too many tries. Wait 15 minutes.' });
      const b = await readJson(req, 4096);
      if (!checkPassword(String(b.current || ''), admin.pass)) return json(400, { error: 'Your current password is wrong.' });
      const step = checkTotp(admin.totp, b.code, admin.lastStep);
      if (step < 0) return json(400, { error: 'The 6-digit code is wrong or already used. Wait for the next code.' });
      const pe = passwordProblem(String(b.next || ''), admin.email); if (pe) return json(400, { error: pe });
      admin.pass = hashPassword(String(b.next)); admin.lastStep = step; admin.sessionVersion = (admin.sessionVersion || 0) + 1; // signs out every device
      await store.set('kv', 'admin', admin); await audit(req, ctx, 'password.changed');
      const ns = newSession(admin, ip);
      return json(200, { ok: true, csrf: ns.csrf }, { 'Set-Cookie': cookieFor(ns) });
    }
    if (sub === 'sessions/revoke' && m === 'POST') {
      admin.sessionVersion = (admin.sessionVersion || 0) + 1; await store.set('kv', 'admin', admin);
      await audit(req, ctx, 'sessions.revoked');
      return json(200, { ok: true }, { 'Set-Cookie': clearCookie() });
    }
    if (sub === 'activity' && m === 'GET') {
      const items = (await store.list('audit')).map(x => x.value).sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 150);
      return ok({ items });
    }
    return json(404, { error: 'Not found.' });
  }
  function strip(s) { const { admin, ...rest } = s; return rest; }

  /* ---------------------------------------------------------------- router */
  return async function handle(req, ctx) {
    try {
      const url = new URL(req.url), p = url.pathname;
      if (!configured) return new Response('The site is not configured yet: set ADMIN_PATH and SESSION_SECRET in Netlify.', { status: 503, headers: headers(null, { 'Content-Type': 'text/plain; charset=utf-8' }) });
      if (p.length > 600) return notFound();

      if (p === A) return new Response(null, { status: 302, headers: { Location: A + '/', 'Cache-Control': 'no-store' } });
      if (p.startsWith(A + '/')) {
        const sub = p.slice(A.length + 1);
        const extra = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
        if (sub.startsWith('api/')) { const r = await adminApi(req, ctx, sub.slice(4)); for (const [k, v] of Object.entries(extra)) r.headers.set(k, v); return r; }
        if (sub === 'preview') {
          const s = await getSession(req); if (!s) return notFound();
          const d = await store.get('drafts', s.sid);
          const html = render(d && d.exp > Date.now() ? d.content : await getContent());
          return new Response(html, { status: 200, headers: headers(SITE_CSP, { ...extra, 'Content-Type': 'text/html; charset=utf-8' }) });
        }
        if (req.method !== 'GET') return notFound();
        const f = sub === '' ? 'index.html' : sub.startsWith('static/') ? sub.slice(7) : null;
        if (!f || !ADMIN_FILES[f]) return notFound();
        return new Response(ADMIN_FILES[f].body, { status: 200, headers: headers(ADMIN_CSP, { ...extra, 'Content-Type': ADMIN_FILES[f].type }) });
      }

      if (p === '/api/inquiry' && req.method === 'POST') return await publicForm(req, ctx, 'inquiry');
      if (p === '/api/apply' && req.method === 'POST') return await publicForm(req, ctx, 'apply');
      if ((p === '/' || p === '/index.html') && (req.method === 'GET' || req.method === 'HEAD')) {
        // Kept at Netlify's edge so visitors get the page instantly without waking the server or the database.
        // Saving in the admin clears it straight away (purge); if that ever fails, it refreshes itself within the hour.
        return new Response(req.method === 'HEAD' ? null : render(await getContent()), { status: 200, headers: headers(SITE_CSP, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=3600, stale-while-revalidate=604800', 'Netlify-Cache-Tag': 'home' }) });
      }
      if (p === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { headers: headers(null, { 'Content-Type': 'text/plain' }) });
      return notFound();
    } catch (e) {
      if (e && (e.code === 413)) return json(413, { error: 'That is too large.' });
      if (e && (e.code === 400 || e.code === 415)) return json(e.code, { error: 'The request was not valid.' });
      console.error(e);
      return json(500, { error: 'Something went wrong on our side.' });
    }
  };
}
