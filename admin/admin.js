/* AdsVentures Lab admin panel. Builds every screen with DOM methods only (no innerHTML), so typed text can never run as code. */
(function () {
'use strict';
var BASE = location.pathname.replace(/\/+$/, '');
var API = BASE + '/api/';
var csrf = null, me = null;
var app = document.getElementById('app');

/* ---------------------------------------------------------------- tiny DOM helper */
function h(tag, a, kids) {
  var e = document.createElement(tag);
  if (a) Object.keys(a).forEach(function (k) {
    var v = a[k]; if (v == null || v === false) return;
    if (k === 'text') e.textContent = v;
    else if (k === 'class') e.className = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (k === 'checked') e.checked = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  });
  (kids || []).forEach(function (c) { if (c != null && c !== false) e.append(c.nodeType ? c : String(c)); });
  return e;
}
var SVGNS = 'http://www.w3.org/2000/svg';
var IC = {
  up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M5 12l7 7 7-7', copy: 'M8 8h11v11H8zM5 16V5h11', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  chev: 'M9 6l6 6-6 6', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  menu: 'M4 7h16M4 12h16M4 17h16', page: 'M6 3h9l4 4v14H6zM14 3v5h5', inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5', image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  clock: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z', lock: 'M6 11h12v10H6zM8 11V8a4 4 0 018 0v3', out: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10', upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', download: 'M12 4v12M7 11l5 5 5-5M4 20h16'
};
function icon(n) { var s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', IC[n] || ''); s.appendChild(p); return s; }
function toast(msg, bad) { var t = h('div', { class: 'toast' + (bad ? ' bad' : ''), text: msg }); document.getElementById('toasts').append(t); setTimeout(function () { t.remove(); }, 3800); }
function fmtDate(s) { try { return new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return s; } }
function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

/* ---------------------------------------------------------------- API */
function api(path, opt) {
  opt = opt || {};
  var headers = { 'Accept': 'application/json' };
  if (opt.body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrf) headers['X-CSRF-Token'] = csrf;
  return fetch(API + path, { method: opt.method || 'GET', headers: headers, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined, credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && path !== 'login') { csrf = null; showLogin('You were logged out. Please log in again.'); throw new Error('logged_out'); }
        if (!r.ok) { var e = new Error(j.error || 'Something went wrong.'); e.details = j.details; throw e; }
        return j;
      });
    });
}
function errBox(e) { return h('div', { class: 'err', role: 'alert' }, [e.message, e.details ? h('ul', null, e.details.map(function (d) { return h('li', { text: d }); })) : null]); }

/* ---------------------------------------------------------------- start */
api('state').then(function (s) {
  if (s.needsSetup) return showSetup();
  if (s.loggedIn) { csrf = s.csrf; me = s.email; return startApp(); }
  showLogin();
}).catch(function () { app.replaceChildren(h('div', { class: 'boot', text: 'Could not reach the server.' })); });

function authCard(kids) { app.replaceChildren(h('main', { class: 'auth' }, [h('div', { class: 'auth-card' }, [h('img', { class: 'logo', src: '/assets/logo.png', alt: 'AdsVentures Lab' })].concat(kids))])); }
function field(label, input, help) { var id = input.id || ('i' + Math.random().toString(36).slice(2)); input.id = id; return h('div', { class: 'f' }, [h('label', { for: id, text: label }), input, help ? h('div', { class: 'help', text: help }) : null]); }

function showLogin(note) {
  var msg = h('div');
  var email = h('input', { class: 'in', type: 'email', autocomplete: 'username', required: true, maxlength: '200' });
  var pw = h('input', { class: 'in', type: 'password', autocomplete: 'current-password', required: true, maxlength: '200' });
  var code = h('input', { class: 'in code', inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]{6}', maxlength: '6', required: true, placeholder: '000000' });
  var btn = h('button', { class: 'btn primary', type: 'submit', text: 'Log in' });
  if (note) msg.append(h('div', { class: 'ok', text: note }));
  var form = h('form', { novalidate: true, onsubmit: function (ev) {
    ev.preventDefault(); msg.replaceChildren();
    if (!email.value || !pw.value || !/^\d{6}$/.test(code.value)) { msg.append(errBox(new Error('Fill in your email, password and the 6-digit code from your app.'))); return; }
    btn.disabled = true; btn.textContent = 'Checking…';
    api('login', { method: 'POST', body: { email: email.value.trim(), password: pw.value, code: code.value } })
      .then(function (r) { csrf = r.csrf; me = email.value.trim(); startApp(); })
      .catch(function (e) { msg.replaceChildren(errBox(e)); btn.disabled = false; btn.textContent = 'Log in'; code.value = ''; code.focus(); });
  } }, [msg, field('Email', email), field('Password', pw), field('6-digit code', code, 'Open your authenticator app and type the code shown for AdsVentures Lab.'), btn]);
  authCard([h('h1', { text: 'Admin login' }), h('p', { class: 'lead', text: 'Only the AdsVentures Lab team can use this page.' }), form]);
  email.focus();
}

function showSetup() {
  var token = (location.hash.match(/setup=([A-Za-z0-9_-]+)/) || [])[1];
  if (!token) { authCard([h('h1', { text: 'Setup needed' }), h('p', { class: 'lead', text: 'Open the setup link: this page\u2019s address followed by #setup= and the SETUP_TOKEN you saved in Netlify.' })]); return; }
  var msg = h('div');
  var email = h('input', { class: 'in', type: 'email', autocomplete: 'username', maxlength: '200' });
  var pw = h('input', { class: 'in', type: 'password', autocomplete: 'new-password', maxlength: '200' });
  var pw2 = h('input', { class: 'in', type: 'password', autocomplete: 'new-password', maxlength: '200' });
  var b1 = h('button', { class: 'btn primary', type: 'submit', text: 'Next' });
  authCard([h('div', { class: 'steps' }, [h('i', { class: 'on' }), h('i')]), h('h1', { text: 'Create your admin login' }), h('p', { class: 'lead', text: 'You only do this once. Use a strong password you don’t use anywhere else.' }),
    h('form', { novalidate: true, onsubmit: function (ev) {
      ev.preventDefault(); msg.replaceChildren();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) return msg.append(errBox(new Error('Enter a valid email.')));
      if (pw.value.length < 12) return msg.append(errBox(new Error('Use at least 12 characters for the password.')));
      if (pw.value !== pw2.value) return msg.append(errBox(new Error('The two passwords don’t match.')));
      b1.disabled = true;
      api('setup/start', { method: 'POST', body: { token: token } }).then(function (r) { step2(r); }).catch(function (e) { b1.disabled = false; msg.append(errBox(e)); });
    } }, [msg, field('Email', email), field('Password', pw, 'At least 12 characters. A short sentence works well.'), field('Type the password again', pw2), b1])]);
  function step2(r) {
    var q = qrcode(0, 'M'); q.addData(r.uri); q.make();
    var code = h('input', { class: 'in code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '000000' });
    var m2 = h('div'), b2 = h('button', { class: 'btn primary', type: 'submit', text: 'Finish setup' });
    authCard([h('div', { class: 'steps' }, [h('i', { class: 'on' }), h('i', { class: 'on' })]), h('h1', { text: 'Turn on 2-step login' }),
      h('p', { class: 'lead', text: 'Scan this with Google Authenticator, Microsoft Authenticator or any authenticator app. You’ll need a code from it every time you log in.' }),
      h('div', { class: 'qr' }, [h('img', { src: q.createDataURL(5, 2), alt: 'QR code for your authenticator app' }), h('div', null, [h('small', { text: 'Can’t scan? Type this key in the app:' }), h('code', { text: r.secret })])]),
      h('form', { novalidate: true, onsubmit: function (ev) {
        ev.preventDefault(); m2.replaceChildren(); b2.disabled = true;
        api('setup/finish', { method: 'POST', body: { token: token, email: email.value.trim(), password: pw.value, code: code.value } })
          .then(function (x) { csrf = x.csrf; me = email.value.trim(); history.replaceState(null, '', BASE); startApp(); })
          .catch(function (e) { b2.disabled = false; m2.append(errBox(e)); });
      } }, [m2, field('6-digit code from the app', code), b2])]);
    code.focus();
  }
}

/* ---------------------------------------------------------------- labels */
var SECTIONS = [
  ['seo', 'Search & sharing', 'The page title and description Google and WhatsApp show.'],
  ['brand', 'Logo & name', 'Your logo and agency name.'],
  ['nav', 'Top bar & menu links', 'The button in the top bar and the links in the menu.'],
  ['menu', 'Menu screen', 'Text on the full-screen menu.'],
  ['hero', 'Opening climb', 'The first screen with the climbing animation.'],
  ['welcome', 'Welcome screen', 'The orange welcome screen after the climb.'],
  ['about', 'About us', 'Your story path and founders.'],
  ['trusted', 'Brand strip', 'The moving strip of brand logos. Logos come from “Brands we’ve worked with”.'],
  ['services', 'Services', 'What you do, with an image for each service.'],
  ['achievements', 'Achievements', 'Your numbers and the moving words.'],
  ['portfolio', 'Portfolio', 'Graphics, video ads and Meta ads results.'],
  ['process', 'Process', 'The steps of how you work.'],
  ['testimonials', 'Testimonials', 'Video and written reviews.'],
  ['clients', 'Brands we’ve worked with', 'Every client brand, with its industry and logo.'],
  ['packages', 'Packages', 'Starter, Pro and Brand Builder.'],
  ['careers', 'Careers & jobs', 'Open positions and the careers page. Jobs show before the FAQ when at least one is open.'],
  ['faq', 'FAQ', 'Questions and answers.'],
  ['gallery', 'Gallery', 'Photos from the office and events.'],
  ['contact', 'Contact', 'Contact details and the inquiry form.'],
  ['forms', 'Form messages', 'Messages people see after sending a form.'],
  ['footer', 'Footer', 'The bottom of the page.']
];
var LABELS = {
  kicker: 'Small heading', title: 'Heading', text: 'Text', subtitle: 'Subheading', tagline: 'Tagline', button: 'Button text', cta: 'Button text', name: 'Name', full: 'Full name', year: 'Year',
  image: 'Image', logo: 'Logo', photo: 'Photo', poster: 'Cover image', video: 'Video', label: 'Label', href: 'Link', value: 'Value', suffix: 'After the number', q: 'Question', a: 'Answer',
  items: 'Items', links: 'Links', chapters: 'Story steps', chapter: 'Step label', adopted: 'What we adopted', improved: 'What we improved', founders: 'Founders', role: 'Role', list: 'Brands',
  industry: 'Industry', featured: 'Show in the moving strip', includes: 'Includes', art: 'Picture style (used when no image)', icon: 'Icon', ticker: 'Moving words', note: 'Small note',
  seeAll: '“See all” button text', showOnHome: 'How many to show on the homepage', client: 'Brand', message: 'The message', how: 'How we made it', orientation: 'Video shape', size: 'Card shape',
  objective: 'Goal', kpis: 'Results', steps: 'Steps', spec: 'Detail', videos: 'Video reviews', reviews: 'Written reviews', company: 'Company', rating: 'Stars (1 to 5)', quote: 'Short quote',
  videoTab: 'Video tab name', textTab: 'Written tab name', tag: 'Tag', level: 'Level', altitude: 'Small label', for: 'Who it’s for', badge: 'Badge (leave empty for none)', features: 'Features',
  id: 'ID (don’t change)', filters: 'Filter buttons', caption: 'Caption', category: 'Category', ratio: 'Shape', details: 'Contact details', privacy: 'Privacy line', perks: 'Perks',
  openTitle: 'Jobs heading', applyTitle: 'Form heading', jobs: 'Jobs', type: 'Job type', location: 'Location', experience: 'Experience', about: 'About the role', duties: 'What they will do',
  open: 'Show this job on the website', homeText: 'Text on the homepage', homeButton: 'Homepage button text', copyright: 'Copyright line', milestones: 'Milestone words', scrollHint: 'Scroll hint',
  endTitle: 'End heading', endText: 'End text', small: 'Small line', line1: 'Big line 1', line2: 'Big line 2', notifications: 'Pop-up notifications', sub: 'Small text', sent: 'Message after sending',
  allTitle: '“All our work” page heading', graphics: 'Graphics', ads: 'Creative video ads', results: 'Meta ads results', description: 'Description'
};
var HELP = {
  title: 'Wrap a word in *stars* to highlight it.', featured: 'Turn on to show this brand in the moving strip near the top.', showOnHome: 'The rest show when people press “See all”.',
  orientation: 'Vertical for reels, horizontal for wide video ads.', open: 'Turn off to hide the job without deleting it.', image: 'If empty, a designed picture is shown.',
  id: 'Used by the page. Leave it as it is.', video: 'MP4 works best. Keep it under 100 MB.', ratio: 'Width/height, like 4/5 for a tall photo.'
};
var ENUMS = {
  orientation: [['vertical', 'Vertical (reel)'], ['horizontal', 'Horizontal (wide)']],
  size: [['tall', 'Tall'], ['square', 'Square'], ['wide', 'Wide']],
  art: [['calendar', 'Calendar'], ['shoot', 'Camera'], ['edit', 'Editing'], ['ads', 'Ad post'], ['brand', 'Branding'], ['report', 'Report']],
  icon: 'users,user,heart,bag,chart,calendar,camera,scissors,target,compass,check,plus,star,play,comment,send,flag'.split(',').map(function (x) { return [x, x[0].toUpperCase() + x.slice(1)]; }),
  ratio: [['4/5', 'Tall 4:5'], ['3/4', 'Tall 3:4'], ['1/1', 'Square'], ['4/3', 'Wide 4:3'], ['16/10', 'Wide 16:10']],
  type: [['Full-time', 'Full-time'], ['Part-time', 'Part-time'], ['Internship', 'Internship'], ['Freelance', 'Freelance'], ['Contract', 'Contract']]
};
var MEDIA = /^(image|logo|photo|poster|video)$/;
var LONG = /^(text|a|about|message|how|quote|for|description|endText|subtitle|privacy)$/;
function label(k) { return LABELS[k] || String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, function (c) { return c.toUpperCase(); }); }
function itemTitle(o, i) {
  if (typeof o !== 'object' || !o) return String(o);
  var k = ['title', 'name', 'q', 'label', 'client', 'caption', 'chapter'].filter(function (x) { return o[x]; })[0];
  return k ? String(o[k]) : '';
}

/* ---------------------------------------------------------------- app state */
var content = null, defaults = null, savedJson = '', view = 'edit:seo', unread = 0;
function dirty() { return content && JSON.stringify(content) !== savedJson; }
window.addEventListener('beforeunload', function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 's' && content) { e.preventDefault(); save(); } });

function startApp() {
  Promise.all([api('content'), api('inbox')]).then(function (r) {
    content = r[0].content; defaults = r[0].defaults; savedJson = JSON.stringify(content);
    unread = r[1].items.filter(function (i) { return !i.read; }).length;
    var v = location.hash.slice(1); if (v && /^(edit:[a-z]+|inbox|media|history|security)$/.test(v)) view = v;
    renderShell();
  }).catch(function (e) { if (e.message !== 'logged_out') app.replaceChildren(h('div', { class: 'boot', text: e.message })); });
}
var shellEl, mainEl, statusEl, saveBtn;
function renderShell() {
  var navItems = SECTIONS.map(function (s) { return h('li', null, [h('a', { href: '#edit:' + s[0], 'data-v': 'edit:' + s[0], text: s[1] })]); });
  var side = h('nav', { class: 'side', 'aria-label': 'Admin' }, [
    h('img', { class: 'logo', src: '/assets/logo.png', alt: 'AdsVentures Lab' }), h('div', { class: 'tag', text: 'Website admin' }),
    h('h4', { text: 'Manage' }),
    h('ul', { class: 'nav' }, [
      h('li', null, [h('a', { href: '#inbox', 'data-v': 'inbox' }, [icon('inbox'), 'Inbox', unread ? h('span', { class: 'n', text: unread }) : null])]),
      h('li', null, [h('a', { href: '#media', 'data-v': 'media' }, [icon('image'), 'Media library'])]),
      h('li', null, [h('a', { href: '#history', 'data-v': 'history' }, [icon('clock'), 'Saved versions'])]),
      h('li', null, [h('a', { href: '#security', 'data-v': 'security' }, [icon('lock'), 'Security'])])
    ]),
    h('h4', { text: 'Website sections' }),
    h('ul', { class: 'nav' }, navItems),
    h('div', { class: 'foot' }, ['Logged in as', h('b', { text: me || '' }), h('button', { class: 'btn sm', type: 'button', style: 'margin-top:10px', onclick: logout }, [icon('out'), 'Log out'])])
  ]);
  statusEl = h('div', { class: 'status', text: 'All changes saved' });
  saveBtn = h('button', { class: 'btn orange', type: 'button', onclick: function () { save(); } }, ['Save & publish']);
  var top = h('header', { class: 'top' }, [
    h('button', { class: 'btn icon menu-btn', type: 'button', 'aria-label': 'Open menu', onclick: function () { shellEl.classList.toggle('nav-open'); } }, [icon('menu')]),
    statusEl,
    h('a', { class: 'btn hide-sm', href: '/', target: '_blank', rel: 'noopener' }, [icon('globe'), 'Open website']),
    h('button', { class: 'btn', type: 'button', onclick: preview }, [icon('eye'), h('span', { class: 'hide-sm', text: 'Preview' })]),
    saveBtn
  ]);
  mainEl = h('main', { class: 'content', id: 'main', tabindex: '-1' });
  shellEl = h('div', { class: 'shell' }, [side, h('div', { class: 'main' }, [top, mainEl])]);
  app.replaceChildren(shellEl);
  side.addEventListener('click', function (e) { var a = e.target.closest('a[data-v]'); if (!a) return; e.preventDefault(); go(a.getAttribute('data-v')); shellEl.classList.remove('nav-open'); });
  go(view);
}
function go(v) {
  view = v; history.replaceState(null, '', '#' + v);
  shellEl.querySelectorAll('a[data-v]').forEach(function (a) { if (a.getAttribute('data-v') === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (v.indexOf('edit:') === 0) renderSection(v.slice(5));
  else if (v === 'inbox') renderInbox();
  else if (v === 'media') renderMedia();
  else if (v === 'history') renderHistory();
  else if (v === 'security') renderSecurity();
  window.scrollTo(0, 0);
}
function markDirty() {
  var d = dirty();
  statusEl.className = 'status' + (d ? ' dirty' : '');
  statusEl.textContent = d ? 'Unsaved changes' : 'All changes saved';
}
function save() {
  if (!dirty()) { toast('Nothing new to save.'); return Promise.resolve(); }
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
  return api('content', { method: 'PUT', body: { content: content } }).then(function () {
    savedJson = JSON.stringify(content); markDirty(); toast('Saved. Your website is updated.');
  }).catch(function (e) { if (e.message === 'logged_out') return; toast(e.message, true); if (e.details) mainEl.prepend(errBox(e)); })
    .then(function () { saveBtn.disabled = false; saveBtn.textContent = 'Save & publish'; });
}
function logout() {
  if (dirty() && !confirm('You have unsaved changes. Log out anyway?')) return;
  api('logout', { method: 'POST', body: {} }).catch(function () {}).then(function () { csrf = null; savedJson = JSON.stringify(content); content = null; showLogin('You are logged out.'); });
}

/* ---------------------------------------------------------------- preview */
function preview() {
  api('preview', { method: 'POST', body: { content: content } }).then(function () {
    var frame = h('iframe', { src: BASE + '/preview', title: 'Website preview' });
    var wrap = h('div', { class: 'pv', role: 'dialog', 'aria-label': 'Preview' });
    var d = h('button', { type: 'button', 'aria-pressed': 'true', text: 'Desktop' }), m = h('button', { type: 'button', 'aria-pressed': 'false', text: 'Mobile' });
    d.onclick = function () { wrap.classList.remove('mobile'); d.setAttribute('aria-pressed', 'true'); m.setAttribute('aria-pressed', 'false'); };
    m.onclick = function () { wrap.classList.add('mobile'); m.setAttribute('aria-pressed', 'true'); d.setAttribute('aria-pressed', 'false'); };
    function close() { wrap.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc);
    wrap.append(h('div', { class: 'pv-bar' }, [h('b', { text: dirty() ? 'Preview (not published yet)' : 'Preview' }), h('div', { class: 'seg' }, [d, m]), h('button', { class: 'btn sm', type: 'button', onclick: close }, [icon('x'), 'Close'])]), h('div', { class: 'pv-stage' }, [frame]));
    document.body.append(wrap);
  }).catch(function (e) { if (e.message !== 'logged_out') toast(e.message, true); });
}

/* ---------------------------------------------------------------- the editor */
function renderSection(key) {
  var meta = SECTIONS.filter(function (s) { return s[0] === key; })[0] || [key, label(key), ''];
  if (!(key in content)) content[key] = clone(defaults[key] || {});
  var body = h('div');
  buildObject(content[key], key, body, [key]);
  mainEl.replaceChildren(h('div', { class: 'page-h' }, [h('h1', { text: meta[1] }), meta[2] ? h('p', { text: meta[2] }) : null]), h('div', { class: 'card' }, [body]));
  markDirty();
}
function defaultsAt(pathArr) { var d = defaults; for (var i = 0; i < pathArr.length; i++) { if (d == null) return undefined; d = Array.isArray(d) ? d[0] : d[pathArr[i]]; } return d; }
function blankLike(v) {
  if (Array.isArray(v)) return [];
  if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = k === 'open' ? true : blankLike(v[k]); }); return o; }
  if (typeof v === 'number') return 0;
  if (typeof v === 'boolean') return false;
  return '';
}
function buildObject(obj, key, into, pathArr) {
  var simple = [], complex = [];
  Object.keys(obj).forEach(function (k) { (typeof obj[k] === 'object' && obj[k] !== null ? complex : simple).push(k); });
  var grid = h('div', { class: 'grid2' });
  simple.forEach(function (k) {
    var f = buildField(obj, k, pathArr.concat(k));
    if (MEDIA.test(k) || LONG.test(k) || typeof obj[k] === 'string' && obj[k].length > 70) { if (grid.childNodes.length) { into.append(grid); grid = h('div', { class: 'grid2' }); } into.append(f); }
    else grid.append(f);
  });
  if (grid.childNodes.length) into.append(grid);
  complex.forEach(function (k) {
    if (Array.isArray(obj[k])) into.append(buildArray(obj, k, pathArr.concat(k)));
    else { var g = h('div', { class: 'group' }, [h('h4', { text: label(k) })]); buildObject(obj[k], k, g, pathArr.concat(k)); into.append(g); }
  });
}
function buildField(obj, k, pathArr) {
  var v = obj[k], id = 'f_' + pathArr.join('_');
  var help = HELP[k] && !(k === 'title' && String(v).indexOf('*') < 0 && pathArr.length > 2) ? HELP[k] : null;
  if (MEDIA.test(k) && typeof v === 'string') return mediaField(obj, k, id);
  if (typeof v === 'boolean') {
    return h('div', { class: 'f' }, [h('label', { class: 'switch' }, [h('input', { type: 'checkbox', id: id, checked: v, onchange: function (e) { obj[k] = e.target.checked; markDirty(); } }), label(k)]), help ? h('div', { class: 'help', text: help }) : null]);
  }
  var input;
  if (typeof v === 'number') input = h('input', { class: 'in', type: 'number', id: id, value: String(v), step: 'any', oninput: function (e) { var n = parseFloat(e.target.value); obj[k] = isFinite(n) ? n : 0; markDirty(); } });
  else if (ENUMS[k] && (k !== 'type' || pathArr.indexOf('jobs') >= 0)) {
    var opts = ENUMS[k].slice(); if (v && !opts.some(function (o) { return o[0] === v; })) opts.unshift([v, v]);
    input = h('select', { class: 'in', id: id, onchange: function (e) { obj[k] = e.target.value; markDirty(); } }, opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    input.value = v;
  }
  else if (LONG.test(k) || String(v).length > 70) input = h('textarea', { class: 'in', id: id, rows: String(Math.min(8, Math.max(3, Math.ceil(String(v).length / 80)))), maxlength: '20000', oninput: function (e) { obj[k] = e.target.value; markDirty(); } }, []), input.value = v;
  else input = h('input', { class: 'in', id: id, value: String(v == null ? '' : v), maxlength: '2000', readonly: k === 'id' ? true : null, oninput: function (e) { obj[k] = e.target.value; markDirty(); } });
  return h('div', { class: 'f' }, [h('label', { for: id, text: label(k) }), input, help ? h('div', { class: 'help', text: help }) : null]);
}
function buildArray(parent, k, pathArr) {
  var arr = parent[k];
  var wrap = h('div', { class: 'group' }, [h('h4', { text: label(k) + ' (' + arr.length + ')' })]);
  var list = h('div', { class: 'list' });
  var tmpl = arr.length ? arr[0] : defaultsAt(pathArr.concat(0));
  var isStr = tmpl === undefined ? true : typeof tmpl !== 'object';
  function rerender(openIndex) { var n = buildArray(parent, k, pathArr); wrap.replaceWith(n); markDirty(); if (openIndex != null) { var it = n.querySelectorAll(':scope > .list > .item')[openIndex]; if (it) { it.classList.add('open'); var f = it.querySelector('input,textarea,select'); if (f) f.focus(); } } }
  arr.forEach(function (item, i) {
    if (isStr) {
      var inp = h('input', { class: 'in', value: String(item), 'aria-label': label(k) + ' ' + (i + 1), maxlength: '2000', oninput: function (e) { arr[i] = typeof tmpl === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value; markDirty(); } });
      list.append(h('div', { class: 'str-row' }, [inp, moveBtns(arr, i, rerender), h('button', { class: 'btn icon danger', type: 'button', title: 'Remove', 'aria-label': 'Remove', onclick: function () { arr.splice(i, 1); rerender(); } }, [icon('trash')])]));
      return;
    }
    var t = itemTitle(item, i);
    var b = h('div', { class: 'item-b' });
    var it = h('div', { class: 'item' });
    var head = h('div', { class: 'item-h', role: 'button', tabindex: '0', 'aria-expanded': 'false' }, [icon('chev'), h('span', { class: 'num', text: i + 1 }), h('span', { class: 't' + (t ? '' : ' empty'), text: t || 'New item' }),
      h('span', { class: 'acts' }, [moveBtns(arr, i, rerender),
        h('button', { class: 'btn icon', type: 'button', title: 'Duplicate', 'aria-label': 'Duplicate', onclick: function (e) { e.stopPropagation(); arr.splice(i + 1, 0, clone(item)); rerender(i + 1); } }, [icon('copy')]),
        h('button', { class: 'btn icon danger', type: 'button', title: 'Delete', 'aria-label': 'Delete', onclick: function (e) { e.stopPropagation(); if (confirm('Delete “' + (t || 'this item') + '”?')) { arr.splice(i, 1); rerender(); } } }, [icon('trash')])])]);
    var built = false;
    function toggle() { if (!built) { buildObject(item, k, b, pathArr.concat(i)); built = true; b.addEventListener('input', function () { var nt = itemTitle(item); var te = head.querySelector('.t'); te.textContent = nt || 'New item'; te.classList.toggle('empty', !nt); }); } it.classList.toggle('open'); head.setAttribute('aria-expanded', it.classList.contains('open')); }
    head.addEventListener('click', function (e) { if (e.target.closest('.acts')) return; toggle(); });
    head.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === head) { e.preventDefault(); toggle(); } });
    it.append(head, b); list.append(it);
  });
  wrap.append(list, h('button', { class: 'add', type: 'button', onclick: function () {
    var n = tmpl === undefined ? '' : blankLike(tmpl);
    arr.push(n); rerender(isStr ? null : arr.length - 1);
    if (isStr) { var ins = wrap.parentNode && document.querySelectorAll('.str-row input'); }
  } }, ['+ Add ' + (isStr ? 'one more' : 'new')]));
  return wrap;
}
function moveBtns(arr, i, rerender) {
  return h('span', { class: 'acts' }, [
    h('button', { class: 'btn icon', type: 'button', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: function (e) { e.stopPropagation(); var x = arr.splice(i, 1)[0]; arr.splice(i - 1, 0, x); rerender(); } }, [icon('up')]),
    h('button', { class: 'btn icon', type: 'button', title: 'Move down', 'aria-label': 'Move down', disabled: i === arr.length - 1, onclick: function (e) { e.stopPropagation(); var x = arr.splice(i, 1)[0]; arr.splice(i + 1, 0, x); rerender(); } }, [icon('down')])
  ]);
}

/* media picker field */
function thumbFor(url) {
  if (!url) return h('div', { class: 'thumb', text: 'No file' });
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return h('div', { class: 'thumb' }, [h('video', { src: url, muted: true, preload: 'metadata' })]);
  return h('div', { class: 'thumb' }, [h('img', { src: url, alt: '' })]);
}
function mediaField(obj, k, id) {
  var isVideo = k === 'video';
  var wrap = h('div', { class: 'f' });
  function draw(msg) {
    var file = h('input', { type: 'file', class: 'sr', id: id, accept: isVideo ? 'video/mp4,video/webm,video/quicktime' : 'image/png,image/jpeg,image/webp,image/gif' });
    var prog = h('div', { class: 'progress', hidden: true }, [h('i')]);
    file.addEventListener('change', function () {
      var f = file.files[0]; if (!f) return;
      prog.hidden = false;
      upload(f, function (p) { prog.firstChild.style.width = Math.round(p * 100) + '%'; }).then(function (r) { obj[k] = r.url; markDirty(); draw(); toast('Uploaded. Press Save & publish to put it live.'); })
        .catch(function (e) { draw(e.message); });
    });
    var url = obj[k];
    wrap.replaceChildren(
      h('span', { class: 'lbl', text: label(k) }),
      h('div', { class: 'media' }, [thumbFor(url), h('div', { class: 'ctrl' }, [
        h('div', { class: 'row' }, [
          h('label', { class: 'btn sm', for: id }, [icon('upload'), url ? 'Replace' : 'Upload']), file,
          h('button', { class: 'btn sm', type: 'button', onclick: function () { pickMedia(isVideo ? 'video' : 'image', function (u) { obj[k] = u; markDirty(); draw(); }); } }, ['Choose from library']),
          url ? h('button', { class: 'btn sm danger', type: 'button', onclick: function () { obj[k] = ''; markDirty(); draw(); } }, ['Remove']) : null
        ]),
        prog,
        url ? h('div', { class: 'url', text: url.indexOf('data:') === 0 ? 'Built-in image' : url }) : null,
        h('div', { class: 'help', text: HELP[k] || (isVideo ? 'MP4, MOV or WEBM, up to 100 MB.' : 'PNG, JPG, WEBP or GIF, up to 10 MB.') }),
        msg ? h('div', { class: 'err', text: msg }) : null
      ])])
    );
  }
  draw();
  return wrap;
}
function upload(file, onProgress) {
  var isVid = /^video\//.test(file.type) || /\.(mp4|mov|webm)$/i.test(file.name);
  if (isVid && file.size > 100 * 1024 * 1024) return Promise.reject(new Error('This video is ' + fmtSize(file.size) + '. The free plan allows up to 100 MB. Export it smaller (1080p is plenty) and try again.'));
  if (!isVid && file.size > 10 * 1024 * 1024) return Promise.reject(new Error('This image is ' + fmtSize(file.size) + '. The free plan allows up to 10 MB. Save it as a JPG or WEBP and try again.'));
  // 1) our server signs the upload, 2) the browser sends the file straight to Cloudinary
  return api('upload/sign', { method: 'POST', body: { name: file.name.slice(0, 80) } }).then(function (sig) {
    return new Promise(function (resolve, reject) {
      var fd = new FormData();
      Object.keys(sig.fields).forEach(function (k) { fd.append(k, sig.fields[k]); });
      fd.append('file', file);
      var x = new XMLHttpRequest();
      x.open('POST', sig.url);
      x.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = function () {
        var j = {}; try { j = JSON.parse(x.responseText); } catch (e) {}
        if (x.status === 200 && j.secure_url) {
          var url = j.secure_url;
          if (j.resource_type === 'image' && j.format !== 'gif') url = url.replace('/image/upload/', '/image/upload/f_auto,q_auto/'); // smaller, faster images
          resolve({ url: url, kind: j.resource_type });
        } else reject(new Error((j.error && j.error.message && /format/i.test(j.error.message)) ? 'Upload a PNG, JPG, WEBP or GIF image, or an MP4, MOV or WEBM video.' : 'Upload failed. Check the file and try again.'));
      };
      x.onerror = function () { reject(new Error('Upload failed. Check your internet.')); };
      x.send(fd);
    });
  });
}
function pickMedia(kind, done) {
  var dlg = h('dialog', { 'aria-label': 'Media library' });
  var body = h('div', { class: 'dlg-b', text: 'Loading…' });
  dlg.append(h('div', { class: 'dlg-h' }, [h('h3', { text: 'Choose a file' }), h('button', { class: 'btn sm', type: 'button', onclick: function () { dlg.close(); } }, [icon('x'), 'Close'])]), body);
  dlg.addEventListener('close', function () { dlg.remove(); });
  document.body.append(dlg); dlg.showModal();
  api('media').then(function (r) {
    var items = r.items.filter(function (m) { return m.kind === kind; });
    if (!items.length) { body.replaceChildren(h('p', { class: 'empty', text: 'No ' + kind + 's uploaded yet. Use Upload instead.' })); return; }
    body.replaceChildren(h('div', { class: 'lib' }, items.map(function (m) { return h('button', { class: 'tile', type: 'button', onclick: function () { done(m.url); dlg.close(); } }, [thumbFor(m.url), h('span', { class: 'meta' }, [(m.publicId || m.url).split('/').pop().slice(0, 22), h('span', { text: fmtSize(m.size) })])]); })));
  }).catch(function (e) { body.replaceChildren(errBox(e)); });
}

/* ---------------------------------------------------------------- inbox */
function renderInbox() {
  mainEl.replaceChildren(h('div', { class: 'page-h' }, [h('h1', { text: 'Inbox' }), h('p', { text: 'Consultation requests and job applications sent from your website.' })]), h('p', { text: 'Loading…' }));
  api('inbox').then(function (r) {
    var items = r.items, tab = 'inquiry', sel = null;
    var tabs = h('div', { class: 'tabs' }), list = h('div', { class: 'msgs' }), det = h('div', { class: 'card detail' });
    function draw() {
      var shown = items.filter(function (i) { return i.type === tab; });
      tabs.replaceChildren(
        tb('inquiry', 'Consultation requests'), tb('apply', 'Job applications'),
        h('button', { type: 'button', style: 'margin-left:auto', onclick: function () { exportCsv(shown, tab); } }, ['Download as Excel (CSV)'])
      );
      function tb(t, l) { var n = items.filter(function (i) { return i.type === t; }); var u = n.filter(function (i) { return !i.read; }).length; return h('button', { type: 'button', 'aria-pressed': String(tab === t), onclick: function () { tab = t; sel = null; draw(); } }, [l + ' (' + n.length + ')' + (u ? ' · ' + u + ' new' : '')]); }
      list.replaceChildren.apply(list, shown.length ? shown.map(function (i) {
        return h('button', { type: 'button', class: 'msg' + (i.read ? '' : ' unread'), 'aria-current': String(sel === i), onclick: function () { sel = i; openMsg(i); draw(); } }, [h('b', null, [i.name || 'No name', h('small', { text: fmtDate(i.at) })]), h('span', { text: i.type === 'apply' ? i.role : (i.business || i.email) })]);
      }) : [h('div', { class: 'empty', text: 'Nothing here yet.' })]);
      if (!sel) det.replaceChildren(h('p', { class: 'empty', text: 'Choose a message to read it.' }));
    }
    function openMsg(i) {
      if (!i.read) { i.read = true; api('inbox/' + i.id + '/read', { method: 'POST', body: {} }).catch(function () {}); unread = Math.max(0, unread - 1); var n = shellEl.querySelector('a[data-v="inbox"] .n'); if (n) { if (unread) n.textContent = unread; else n.remove(); } }
      var rows = i.type === 'apply'
        ? [['Name', i.name], ['Email', i.email], ['Phone', i.phone], ['Position', i.role], ['Experience', i.experience], ['Portfolio', i.link], ['Why us', i.message]]
        : [['Name', i.name], ['Business', i.business], ['Email', i.email], ['Phone', i.phone], ['Package', i.package], ['Message', i.message]];
      det.replaceChildren(
        h('h3', { text: i.name || 'No name' }), h('p', { class: 'help', style: 'color:var(--ink-3);margin:4px 0 16px', text: 'Sent ' + fmtDate(i.at) }),
        h('dl', null, [].concat.apply([], rows.filter(function (r) { return r[1]; }).map(function (r) { return [h('dt', { text: r[0] }), h('dd', { text: r[1] })]; }))),
        h('div', { class: 'row', style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
          /^[^\s@<>]+@[^\s@<>]+$/.test(i.email || '') ? h('a', { class: 'btn primary', href: 'mailto:' + encodeURIComponent(i.email).replace(/%40/, '@') }, ['Reply by email']) : null,
          i.file ? h('a', { class: 'btn', href: API + 'inbox/' + i.id + '/file' }, [icon('download'), 'Download resume (' + fmtSize(i.file.size) + ')']) : null,
          h('button', { class: 'btn danger', type: 'button', onclick: function () { if (!confirm('Delete this message for good?')) return; api('inbox/' + i.id, { method: 'DELETE' }).then(function () { items = items.filter(function (x) { return x !== i; }); sel = null; draw(); toast('Deleted.'); }).catch(function (e) { toast(e.message, true); }); } }, [icon('trash'), 'Delete'])
        ]));
    }
    draw();
    mainEl.replaceChildren(mainEl.firstChild, tabs, h('div', { class: 'inbox' }, [list, det]));
  }).catch(function (e) { if (e.message !== 'logged_out') mainEl.append(errBox(e)); });
}
function exportCsv(items, tab) {
  var cols = tab === 'apply' ? ['at', 'name', 'email', 'phone', 'role', 'experience', 'link', 'message'] : ['at', 'name', 'business', 'email', 'phone', 'package', 'message'];
  var safe = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }; // stops spreadsheet formula tricks
  var csv = [cols.join(',')].concat(items.map(function (i) { return cols.map(function (c) { return safe(i[c]); }).join(','); })).join('\r\n');
  var a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: (tab === 'apply' ? 'job-applications' : 'consultation-requests') + '.csv' });
  document.body.append(a); a.click(); a.remove();
}

/* ---------------------------------------------------------------- media library */
function renderMedia() {
  var file = h('input', { type: 'file', class: 'sr', id: 'lib-up', multiple: true, accept: 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime' });
  var grid = h('div', { class: 'lib' }, [h('p', { text: 'Loading…' })]);
  var note = h('div');
  file.addEventListener('change', function () {
    var fs = [].slice.call(file.files); var done = 0;
    note.replaceChildren(h('div', { class: 'ok', text: 'Uploading ' + fs.length + ' file(s)…' }));
    fs.reduce(function (p, f) { return p.then(function () { return upload(f, function () {}).then(function () { done++; }).catch(function (e) { toast(f.name + ': ' + e.message, true); }); }); }, Promise.resolve())
      .then(function () { note.replaceChildren(); toast(done + ' file(s) uploaded.'); load(); });
  });
  mainEl.replaceChildren(h('div', { class: 'page-h' }, [h('h1', { text: 'Media library' }), h('p', { text: 'Every image and video you’ve uploaded. Files used on the website can’t be deleted. Tip: the free plan covers about 25 GB a month for storage and visitor views combined, so delete files you no longer use and keep videos short.' })]),
    h('div', { style: 'margin-bottom:16px' }, [h('label', { class: 'btn primary', for: 'lib-up' }, [icon('upload'), 'Upload files']), file]), note, grid);
  function load() {
    api('media').then(function (r) {
      if (!r.items.length) { grid.replaceChildren(h('p', { class: 'empty', text: 'No files yet.' })); return; }
      grid.replaceChildren.apply(grid, r.items.map(function (m) {
        return h('div', { class: 'tile' }, [thumbFor(m.url), h('div', { class: 'meta' }, [m.used ? h('span', { class: 'u', text: 'In use' }) : h('span', { text: fmtSize(m.size) }),
          h('button', { class: 'btn sm', type: 'button', onclick: function () { navigator.clipboard && navigator.clipboard.writeText(m.url).then(function () { toast('Link copied.'); }); } }, ['Copy link']),
          m.used ? null : h('button', { class: 'btn icon danger', type: 'button', 'aria-label': 'Delete file', onclick: function () { if (!confirm('Delete this file?')) return; api('media/delete', { method: 'POST', body: { publicId: m.publicId, kind: m.kind } }).then(function () { toast('Deleted.'); load(); }).catch(function (e) { toast(e.message, true); }); } }, [icon('trash')])])]);
      }));
    }).catch(function (e) { if (e.message !== 'logged_out') grid.replaceChildren(errBox(e)); });
  }
  load();
}

/* ---------------------------------------------------------------- history */
function renderHistory() {
  var rows = h('div', { class: 'rows' }, [h('div', { class: 'r', text: 'Loading…' })]);
  mainEl.replaceChildren(h('div', { class: 'page-h' }, [h('h1', { text: 'Saved versions' }), h('p', { text: 'Every time you save, the version before it is kept here (the latest 60). Restore one if something goes wrong.' })]), rows);
  api('history').then(function (r) {
    if (!r.items.length) { rows.replaceChildren(h('div', { class: 'empty', text: 'No older versions yet. They appear after your first save.' })); return; }
    rows.replaceChildren.apply(rows, r.items.map(function (v) {
      return h('div', { class: 'r' }, [h('div', { class: 'w' }, [h('b', { text: fmtDate(v.at) }), h('small', { text: 'Version before: ' + (v.note || 'Saved') })]),
        h('button', { class: 'btn sm', type: 'button', onclick: function () {
          if (!confirm('Restore this version? The website will change right away. Your current version is kept in this list too.')) return;
          api('history/restore', { method: 'POST', body: { id: v.id } }).then(function () { return api('content'); }).then(function (c) { content = c.content; savedJson = JSON.stringify(content); markDirty(); toast('Restored.'); renderHistory(); }).catch(function (e) { toast(e.message, true); });
        } }, ['Restore'])]);
    }));
  }).catch(function (e) { if (e.message !== 'logged_out') rows.replaceChildren(errBox(e)); });
}

/* ---------------------------------------------------------------- security */
function renderSecurity() {
  var msg = h('div');
  var cur = h('input', { class: 'in', type: 'password', autocomplete: 'current-password' }), nw = h('input', { class: 'in', type: 'password', autocomplete: 'new-password' }), nw2 = h('input', { class: 'in', type: 'password', autocomplete: 'new-password' }), code = h('input', { class: 'in code', inputmode: 'numeric', maxlength: '6', placeholder: '000000', autocomplete: 'one-time-code' });
  var act = h('div', { class: 'rows' }, [h('div', { class: 'r', text: 'Loading…' })]);
  mainEl.replaceChildren(h('div', { class: 'page-h' }, [h('h1', { text: 'Security' }), h('p', { text: 'Your login is protected by a password and a 6-digit code from your phone.' })]),
    h('div', { class: 'card' }, [h('h3', { text: 'Change password' }),
      h('form', { novalidate: true, onsubmit: function (e) {
        e.preventDefault(); msg.replaceChildren();
        if (nw.value !== nw2.value) return msg.append(errBox(new Error('The new passwords don’t match.')));
        api('password', { method: 'POST', body: { current: cur.value, next: nw.value, code: code.value } }).then(function () { msg.append(h('div', { class: 'ok', text: 'Password changed. Other devices were logged out.' })); cur.value = nw.value = nw2.value = code.value = ''; }).catch(function (er) { msg.append(errBox(er)); });
      } }, [msg, h('div', { class: 'grid2' }, [field('Current password', cur), field('6-digit code', code), field('New password', nw, 'At least 12 characters.'), field('New password again', nw2)]), h('button', { class: 'btn primary', type: 'submit', text: 'Change password' })])]),
    h('div', { class: 'card' }, [h('h3', { text: 'Log out everywhere' }), h('p', { style: 'color:var(--ink-2);margin:0 0 14px', text: 'Use this if you logged in on a shared computer or lost a device.' }),
      h('button', { class: 'btn danger', type: 'button', onclick: function () { if (!confirm('Log out of every device, including this one?')) return; api('sessions/revoke', { method: 'POST', body: {} }).then(function () { csrf = null; showLogin('Logged out everywhere.'); }); } }, ['Log out of all devices'])]),
    h('h3', { style: 'margin:24px 0 12px', text: 'Recent activity' }), act);
  var NAMES = { 'login.ok': 'Logged in', 'login.failed': 'Wrong login attempt', 'login.locked': 'Login paused after many wrong tries', 'login.ratelimited': 'Too many login tries', 'logout': 'Logged out', 'upload': 'Uploaded a file', 'media.delete': 'Deleted a file', 'password.changed': 'Changed password', 'sessions.revoked': 'Logged out everywhere', 'admin.created': 'Admin account created', 'inbox.delete': 'Deleted a message', 'Saved changes': 'Saved website changes' };
  api('activity').then(function (r) {
    if (!r.items.length) { act.replaceChildren(h('div', { class: 'empty', text: 'No activity yet.' })); return; }
    act.replaceChildren.apply(act, r.items.slice(0, 60).map(function (a) { return h('div', { class: 'r' }, [h('div', { class: 'w' }, [h('b', { text: NAMES[a.what] || a.what }), h('small', { text: fmtDate(a.t) + ' · ' + (a.ip || '') })])]); }));
  }).catch(function () {});
}
})();
