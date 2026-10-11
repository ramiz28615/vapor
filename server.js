/**
 * Vapor — bağımlılıksız, tek dosyalık API + statik sunucu.
 * Node 18+ (yerleşik fetch, node:sqlite gerekmez — JSON depo kullanır)
 *
 * Çalıştır:  node server.js      → http://localhost:4000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 4000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'vapor.json');
const PUBLIC = path.join(ROOT, 'public');

/* =========================================================
   0) KÜÇÜK YARDIMCILAR
   ========================================================= */
const uid = (p = '') => p + crypto.randomBytes(9).toString('hex');
const now = () => new Date().toISOString();
const read = (f) => fs.readFileSync(f, 'utf8');
const write = (f, s) => fs.writeFileSync(f, s, 'utf8');

function json(res, code, body, extra = {}) {
  const s = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    ...extra,
  });
  res.end(s);
}

/* =========================================================
   1) DEPO (JSON tabanlı kalıcı veri)
   ========================================================= */
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const EMPTY = { users: [], sessions: [], projects: [], deploys: [], envs: [], domains: [], logs: [], apikeys: [], members: [], events: [] };

function db() {
  try { return Object.assign({}, EMPTY, JSON.parse(read(DB_FILE))); }
  catch (e) { return JSON.parse(JSON.stringify(EMPTY)); }
}
function save(d) { write(DB_FILE, JSON.stringify(d, null, 2)); }
function mutate(fn) { const d = db(); const r = fn(d); save(d); return r; }
if (!fs.existsSync(DB_FILE)) save(JSON.parse(JSON.stringify(EMPTY)));

/* =========================================================
   2) KİMLİK DOĞRULAMA (token tabanlı)
   ========================================================= */
const hash = (pw, salt) => crypto.pbkdf2Sync(pw, salt, 120000, 32, 'sha256').toString('hex');

function makeToken(userId) {
  const t = uid('vt_');
  mutate(d => { d.sessions.push({ token: t, userId, created: now() }); });
  return t;
}
function userFromReq(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return null;
  const d = db();
  const s = d.sessions.find(x => x.token === t);
  if (!s) return null;
  return d.users.find(u => u.id === s.userId) || null;
}
const publicUser = u => u && ({ id: u.id, email: u.email, name: u.name, plan: u.plan, createdAt: u.createdAt });

/* =========================================================
   3) PLANLAR VE LİMİTLER
   ========================================================= */
const PLANS = {
  free:   { name: 'Free',   price: 0,  projects: 5,  deploysPerDay: 50,  bandwidthGb: 100,  seats: 1,  sleepAfterMin: 30,  customDomain: true,  metricsDays: 7 },
  pro:    { name: 'Pro',    price: 0,  projects: 50, deploysPerDay: 500, bandwidthGb: 1000, seats: 10, sleepAfterMin: 0,   customDomain: true,  metricsDays: 30 },
  team:   { name: 'Team',   price: 0,  projects: 999,deploysPerDay: 5000,bandwidthGb: 5000, seats: 50, sleepAfterMin: 0,   customDomain: true,  metricsDays: 90 },
};
// Not: tüm planlar bu projede ücretsizdir (ürün kararı).

/* =========================================================
   4) DEPLOY MOTORU (simülasyon + gerçekçi log akışı)
   ========================================================= */
const DEPLOY_STAGES = [
  { key: 'queued',     label: 'Kuyruğa alındı',        ms: 900  },
  { key: 'cloning',    label: 'Depo klonlanıyor',      ms: 1600 },
  { key: 'detecting',  label: 'Framework algılanıyor', ms: 1200 },
  { key: 'installing', label: 'Bağımlılıklar kuruluyor', ms: 3200 },
  { key: 'building',   label: 'Derleniyor',            ms: 3800 },
  { key: 'uploading',  label: 'Artefakt yükleniyor',   ms: 1500 },
  { key: 'starting',   label: 'Servis başlatılıyor',   ms: 1400 },
  { key: 'live',       label: 'Yayında',               ms: 0    },
];

function pushLog(deployId, line, kind = 'out') {
  mutate(d => { d.logs.push({ id: uid('l_'), deployId, line, kind, at: now() }); });
}
function setDeploy(deployId, patch) {
  mutate(d => { const x = d.deploys.find(y => y.id === deployId); if (x) Object.assign(x, patch); });
}

function runDeploy(deployId) {
  const d0 = db();
  const dep = d0.deploys.find(x => x.id === deployId);
  if (!dep) return;
  const proj = d0.projects.find(p => p.id === dep.projectId);
  const name = proj ? proj.name : 'app';
  const branch = dep.branch || 'main';
  const commit = dep.commit || uid('').slice(0, 7);

  const lines = [
    ['$ vapor deploy --project ' + name + ' --branch ' + branch, 'cmd'],
    ['Cloning ' + (proj?.repo || 'github.com/user/' + name) + ' (branch: ' + branch + ')', 'out'],
    ['Commit: ' + commit + '  Author: ' + (proj?.ownerName || 'dev') + ' <dev@vapor.dev>', 'out'],
    ['Detected: ' + (proj?.framework || 'Node.js') + ' — using build preset "' + (proj?.framework || 'node') + '"', 'ok'],
    ['Running install command: ' + (proj?.installCmd || 'npm ci'), 'out'],
    ['added 412 packages in 6.4s', 'out'],
    ['Running build command: ' + (proj?.buildCmd || 'npm run build'), 'out'],
    ['▲ build completed — 38 modules transformed', 'out'],
    ['Compressed bundle: ' + (120 + Math.floor(Math.random() * 300)) + ' KB (gzip)', 'out'],
    ['Uploading build artifacts to edge storage...', 'out'],
    ['Starting service on port ' + (proj?.port || 3000), 'out'],
    ['Health check passed ✓', 'ok'],
    ['Deployment live at https://' + (proj?.slug || name) + '.vapor.app', 'ok'],
  ];

  let i = 0;
  let stageIdx = 0;

  const step = () => {
    // aşama ilerlet
    if (stageIdx < DEPLOY_STAGES.length - 1) {
      const st = DEPLOY_STAGES[stageIdx];
      setDeploy(deployId, { stage: st.key, stageLabel: st.label, progress: Math.round((stageIdx / (DEPLOY_STAGES.length - 1)) * 100) });
      if (stageIdx > 0 && stageIdx - 1 < lines.length) {
        const [line, kind] = lines[stageIdx - 1];
        pushLog(deployId, line, kind);
      }
      stageIdx++;
      setTimeout(step, Math.min(st.ms, 1500));
      return;
    }
    // kalan loglar
    if (i + stageIdx - 1 < lines.length) {
      const [line, kind] = lines[i + stageIdx - 1];
      pushLog(deployId, line, kind);
      i++;
      setTimeout(step, 320);
      return;
    }
    // bitir
    const url = 'https://' + (proj?.slug || name) + '.vapor.app';
    setDeploy(deployId, { status: 'live', stage: 'live', stageLabel: 'Yayında', progress: 100, finishedAt: now(), url, durationSec: 18 + Math.floor(Math.random() * 26) });
    if (proj) mutate(d => {
      const p = d.projects.find(x => x.id === proj.id);
      if (p) { p.status = 'live'; p.url = url; p.updatedAt = now(); p.lastDeployId = deployId; }
    });
    pushEvent(proj?.ownerId, 'deploy.live', { project: proj?.name, url });
  };

  setDeploy(deployId, { status: 'building', startedAt: now() });
  setTimeout(step, 400);
}

function pushEvent(userId, type, payload) {
  mutate(d => { d.events.unshift({ id: uid('e_'), userId, type, payload, at: now() }); d.events = d.events.slice(0, 300); });
}

/* =========================================================
   5) API ROTALARI
   ========================================================= */
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern, handler });

/* ---------- sağlık ---------- */
route('GET', '/api/health', (req, res) => json(res, 200, {
  ok: true, service: 'vapor', version: '1.0.0', time: now(),
  uptime: Math.round(process.uptime()), node: process.version,
}));

/* ---------- planlar ---------- */
route('GET', '/api/plans', (req, res) => json(res, 200, { plans: PLANS, allFree: true }));

/* ---------- auth ---------- */
route('POST', '/api/auth/register', (req, res, body) => {
  const { email, password, name } = body || {};
  if (!email || !password) return json(res, 400, { error: 'E-posta ve şifre gerekli' });
  if (String(password).length < 6) return json(res, 400, { error: 'Şifre en az 6 karakter olmalı' });
  const d = db();
  if (d.users.some(u => u.email.toLowerCase() === String(email).toLowerCase()))
    return json(res, 409, { error: 'Bu e-posta zaten kayıtlı' });

  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    id: uid('u_'), email: String(email).toLowerCase(), name: name || String(email).split('@')[0],
    salt, pw: hash(String(password), salt), plan: 'free', createdAt: now(),
  };
  mutate(db => { db.users.push(user); });
  const token = makeToken(user.id);
  pushEvent(user.id, 'user.created', { email: user.email });
  json(res, 201, { token, user: publicUser(user) });
});

route('POST', '/api/auth/login', (req, res, body) => {
  const { email, password } = body || {};
  const d = db();
  const u = d.users.find(x => x.email.toLowerCase() === String(email || '').toLowerCase());
  if (!u || u.pw !== hash(String(password || ''), u.salt)) return json(res, 401, { error: 'E-posta veya şifre hatalı' });
  const token = makeToken(u.id);
  json(res, 200, { token, user: publicUser(u) });
});

route('POST', '/api/auth/logout', (req, res) => {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (t) mutate(d => { d.sessions = d.sessions.filter(s => s.token !== t); });
  json(res, 200, { ok: true });
});

route('GET', '/api/auth/me', (req, res) => {
  const u = userFromReq(req);
  if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  json(res, 200, { user: publicUser(u), plan: PLANS[u.plan] || PLANS.free, limits: PLANS[u.plan] || PLANS.free,
    usage: { projects: d.projects.filter(p => p.ownerId === u.id).length } });
});

route('PATCH', '/api/auth/me', (req, res, body) => {
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  mutate(d => { const x = d.users.find(y => y.id === u.id); if (x) { if (body.name) x.name = body.name; if (body.plan && PLANS[body.plan]) x.plan = body.plan; } });
  json(res, 200, { user: publicUser(db().users.find(y => y.id === u.id)) });
});

/* ---------- projeler ---------- */
route('GET', '/api/projects', (req, res) => {
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const list = d.projects.filter(p => p.ownerId === u.id).map(p => ({
    ...p,
    lastDeploy: d.deploys.filter(x => x.projectId === p.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0] || null,
    deployCount: d.deploys.filter(x => x.projectId === p.id).length,
  }));
  json(res, 200, { projects: list, limit: PLANS[u.plan].projects });
});

route('POST', '/api/projects', (req, res, body) => {
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const mine = d.projects.filter(p => p.ownerId === u.id);
  if (mine.length >= PLANS[u.plan].projects) return json(res, 403, { error: 'Proje limitine ulaştın (' + PLANS[u.plan].projects + ')' });

  const name = (body.name || '').trim() || 'yeni-proje';
  let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proje';
  while (d.projects.some(p => p.slug === slug)) slug = slug.replace(/-[0-9]+$/, '') + '-' + Math.floor(Math.random() * 90 + 10);

  const proj = {
    id: uid('p_'), ownerId: u.id, ownerName: u.name, name, slug,
    repo: body.repo || ('github.com/' + u.name + '/' + slug),
    framework: body.framework || 'Next.js',
    branch: body.branch || 'main',
    buildCmd: body.buildCmd || 'npm run build',
    installCmd: body.installCmd || 'npm ci',
    startCmd: body.startCmd || 'npm start',
    rootDir: body.rootDir || '/',
    port: body.port || 3000,
    region: body.region || 'fra1',
    status: 'idle', url: null, createdAt: now(), updatedAt: now(),
    visibility: body.visibility || 'public',
  };
  mutate(db => { db.projects.push(proj); });
  pushEvent(u.id, 'project.created', { project: proj.name });
  json(res, 201, { project: proj });
});

route('GET', '/api/projects/:id', (req, res, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const proj = d.projects.find(x => x.id === p.id && x.ownerId === u.id);
  if (!proj) return json(res, 404, { error: 'Proje bulunamadı' });
  json(res, 200, {
    project: proj,
    deploys: d.deploys.filter(x => x.projectId === proj.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 30),
    envs: d.envs.filter(x => x.projectId === proj.id).map(e => ({ ...e, value: e.secret ? '••••••••' : e.value })),
    domains: d.domains.filter(x => x.projectId === proj.id),
  });
});

route('PATCH', '/api/projects/:id', (req, res, body, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const ok = mutate(d => {
    const x = d.projects.find(y => y.id === p.id && y.ownerId === u.id);
    if (!x) return false;
    ['name', 'repo', 'framework', 'branch', 'buildCmd', 'installCmd', 'startCmd', 'rootDir', 'port', 'region', 'visibility'].forEach(k => { if (body[k] !== undefined) x[k] = body[k]; });
    x.updatedAt = now(); return true;
  });
  if (!ok) return json(res, 404, { error: 'Proje bulunamadı' });
  json(res, 200, { project: db().projects.find(y => y.id === p.id) });
});

route('DELETE', '/api/projects/:id', (req, res, _, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const ok = mutate(d => {
    const i = d.projects.findIndex(y => y.id === p.id && y.ownerId === u.id);
    if (i < 0) return false;
    d.projects.splice(i, 1);
    d.deploys = d.deploys.filter(x => x.projectId !== p.id);
    d.envs = d.envs.filter(x => x.projectId !== p.id);
    d.domains = d.domains.filter(x => x.projectId !== p.id);
    return true;
  });
  if (!ok) return json(res, 404, { error: 'Proje bulunamadı' });
  pushEvent(u.id, 'project.deleted', { id: p.id });
  json(res, 200, { ok: true });
});

/* ---------- deploy ---------- */
route('POST', '/api/projects/:id/deploy', (req, res, body, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const proj = d.projects.find(x => x.id === p.id && x.ownerId === u.id);
  if (!proj) return json(res, 404, { error: 'Proje bulunamadı' });

  const today = now().slice(0, 10);
  const todayCount = d.deploys.filter(x => x.ownerId === u.id && (x.createdAt || '').slice(0, 10) === today).length;
  if (todayCount >= PLANS[u.plan].deploysPerDay) return json(res, 429, { error: 'Günlük deploy limitine ulaştın' });

  const dep = {
    id: uid('d_'), projectId: proj.id, ownerId: u.id, projectName: proj.name,
    branch: body.branch || proj.branch, commit: body.commit || uid('').slice(0, 7),
    message: body.message || 'Manuel deploy', status: 'queued', stage: 'queued', stageLabel: 'Kuyruğa alındı',
    progress: 0, createdAt: now(), trigger: body.trigger || 'manual', env: body.env || 'production',
  };
  mutate(db => { db.deploys.unshift(dep); });
  pushEvent(u.id, 'deploy.started', { project: proj.name, id: dep.id });
  runDeploy(dep.id);
  json(res, 202, { deploy: dep });
});

route('GET', '/api/deploys', (req, res) => {
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  json(res, 200, { deploys: d.deploys.filter(x => x.ownerId === u.id).slice(0, 60) });
});

route('GET', '/api/deploys/:id', (req, res, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const dep = d.deploys.find(x => x.id === p.id && x.ownerId === u.id);
  if (!dep) return json(res, 404, { error: 'Deploy bulunamadı' });
  json(res, 200, { deploy: dep, logs: d.logs.filter(l => l.deployId === dep.id) });
});

route('POST', '/api/deploys/:id/rollback', (req, res, _, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const dep = d.deploys.find(x => x.id === p.id && x.ownerId === u.id);
  if (!dep) return json(res, 404, { error: 'Deploy bulunamadı' });
  const proj = d.projects.find(x => x.id === dep.projectId);
  const nd = {
    id: uid('d_'), projectId: dep.projectId, ownerId: u.id, projectName: dep.projectName,
    branch: dep.branch, commit: dep.commit, message: 'Rollback → ' + dep.id.slice(-6),
    status: 'queued', stage: 'queued', stageLabel: 'Kuyruğa alındı', progress: 0,
    createdAt: now(), trigger: 'rollback', env: dep.env,
  };
  mutate(db => { db.deploys.unshift(nd); });
  runDeploy(nd.id);
  json(res, 202, { deploy: nd });
});

/* ---------- ortam değişkenleri ---------- */
route('POST', '/api/projects/:id/env', (req, res, body, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  if (!d.projects.some(x => x.id === p.id && x.ownerId === u.id)) return json(res, 404, { error: 'Proje bulunamadı' });
  const key = String(body.key || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (!key) return json(res, 400, { error: 'Anahtar gerekli' });
  const existing = d.envs.find(e => e.projectId === p.id && e.key === key);
  if (existing) mutate(db => { const e = db.envs.find(x => x.id === existing.id); e.value = body.value ?? ''; e.secret = !!body.secret; e.env = body.env || 'production'; });
  else mutate(db => { db.envs.push({ id: uid('ev_'), projectId: p.id, key, value: body.value ?? '', secret: !!body.secret, env: body.env || 'production', createdAt: now() }); });
  json(res, 201, { ok: true, envs: db().envs.filter(e => e.projectId === p.id).map(e => ({ ...e, value: e.secret ? '••••••••' : e.value })) });
});

route('DELETE', '/api/env/:id', (req, res, _, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const e = d.envs.find(x => x.id === p.id);
  if (!e) return json(res, 404, { error: 'Bulunamadı' });
  if (!d.projects.some(x => x.id === e.projectId && x.ownerId === u.id)) return json(res, 403, { error: 'Yetki yok' });
  mutate(db => { db.envs = db.envs.filter(x => x.id !== p.id); });
  json(res, 200, { ok: true });
});

/* ---------- domain ---------- */
route('POST', '/api/projects/:id/domains', (req, res, body, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const proj = d.projects.find(x => x.id === p.id && x.ownerId === u.id);
  if (!proj) return json(res, 404, { error: 'Proje bulunamadı' });
  const host = String(body.domain || '').trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return json(res, 400, { error: 'Geçersiz alan adı' });
  if (d.domains.some(x => x.domain === host)) return json(res, 409, { error: 'Bu alan adı zaten kullanılıyor' });
  const dom = { id: uid('dm_'), projectId: proj.id, domain: host, verified: false, ssl: 'pending',
    records: [
      { type: 'A', name: '@', value: '76.76.21.21' },
      { type: 'CNAME', name: 'www', value: 'cname.vapor.app' },
      { type: 'TXT', name: '_vapor', value: 'vapor-verify=' + uid('').slice(0, 16) },
    ], createdAt: now() };
  mutate(db => { db.domains.push(dom); });
  json(res, 201, { domain: dom });
});

route('POST', '/api/domains/:id/verify', (req, res, _, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const dom = d.domains.find(x => x.id === p.id);
  if (!dom) return json(res, 404, { error: 'Alan adı bulunamadı' });
  const proj = d.projects.find(x => x.id === dom.projectId);
  if (!proj || proj.ownerId !== u.id) return json(res, 403, { error: 'Yetki yok' });
  mutate(db => { const x = db.domains.find(y => y.id === p.id); x.verified = true; x.ssl = 'active'; x.verifiedAt = now(); });
  pushEvent(u.id, 'domain.verified', { domain: dom.domain });
  json(res, 200, { domain: db().domains.find(y => y.id === p.id) });
});

route('DELETE', '/api/domains/:id', (req, res, _, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const dom = d.domains.find(x => x.id === p.id);
  if (!dom) return json(res, 404, { error: 'Bulunamadı' });
  const proj = d.projects.find(x => x.id === dom.projectId);
  if (!proj || proj.ownerId !== u.id) return json(res, 403, { error: 'Yetki yok' });
  mutate(db => { db.domains = db.domains.filter(x => x.id !== p.id); });
  json(res, 200, { ok: true });
});

/* ---------- metrikler ---------- */
route('GET', '/api/projects/:id/metrics', (req, res, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const proj = d.projects.find(x => x.id === p.id && x.ownerId === u.id);
  if (!proj) return json(res, 404, { error: 'Proje bulunamadı' });
  const days = PLANS[u.plan].metricsDays;
  const series = Array.from({ length: days }, (_, i) => {
    const t = new Date(Date.now() - (days - 1 - i) * 864e5);
    const base = 900 + Math.round(Math.sin(i / 2.4) * 420);
    return { date: t.toISOString().slice(0, 10), requests: base + Math.floor(Math.random() * 380),
      bandwidthMb: 120 + Math.floor(Math.random() * 260), errors: Math.floor(Math.random() * 9),
      p50: 24 + Math.floor(Math.random() * 30), p95: 90 + Math.floor(Math.random() * 130) };
  });
  const totals = series.reduce((a, s) => ({ requests: a.requests + s.requests, bandwidthMb: a.bandwidthMb + s.bandwidthMb, errors: a.errors + s.errors }), { requests: 0, bandwidthMb: 0, errors: 0 });
  json(res, 200, { series, totals, windowDays: days, bandwidthLimitGb: PLANS[u.plan].bandwidthGb });
});

/* ---------- ekip ---------- */
route('GET', '/api/members', (req, res) => {
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  json(res, 200, { members: [{ id: u.id, email: u.email, name: u.name, role: 'owner', joinedAt: u.createdAt },
    ...d.members.filter(m => m.ownerId === u.id)], seats: PLANS[u.plan].seats });
});

route('POST', '/api/members', (req, res, body) => {
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const mine = d.members.filter(m => m.ownerId === u.id);
  if (mine.length + 1 >= PLANS[u.plan].seats) return json(res, 403, { error: 'Koltuk limitine ulaştın (' + PLANS[u.plan].seats + ')' });
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: 'Geçersiz e-posta' });
  if (mine.some(m => m.email === email)) return json(res, 409, { error: 'Bu kişi zaten ekipte' });
  const m = { id: uid('m_'), ownerId: u.id, email, name: body.name || email.split('@')[0], role: body.role || 'developer', status: 'invited', invitedAt: now() };
  mutate(db => { db.members.push(m); });
  pushEvent(u.id, 'member.invited', { email });
  json(res, 201, { member: m });
});

route('DELETE', '/api/members/:id', (req, res, _, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const ok = mutate(d => { const i = d.members.findIndex(m => m.id === p.id && m.ownerId === u.id); if (i < 0) return false; d.members.splice(i, 1); return true; });
  if (!ok) return json(res, 404, { error: 'Bulunamadı' });
  json(res, 200, { ok: true });
});

/* ---------- API anahtarları ---------- */
route('GET', '/api/apikeys', (req, res) => {
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  json(res, 200, { keys: d.apikeys.filter(k => k.userId === u.id).map(k => ({ ...k, token: k.token.slice(0, 12) + '…' })) });
});

route('POST', '/api/apikeys', (req, res, body) => {
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const k = { id: uid('ak_'), userId: u.id, name: body.name || 'Varsayılan', token: uid('vap_') + uid(''), scope: body.scope || 'full', createdAt: now(), lastUsed: null };
  mutate(d => { d.apikeys.push(k); });
  json(res, 201, { key: k }); // token yalnızca oluşturulurken tam gösterilir
});

route('DELETE', '/api/apikeys/:id', (req, res, _, p) => {
  p = p || (req.params || {});
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const ok = mutate(d => { const i = d.apikeys.findIndex(k => k.id === p.id && k.userId === u.id); if (i < 0) return false; d.apikeys.splice(i, 1); return true; });
  if (!ok) return json(res, 404, { error: 'Bulunamadı' });
  json(res, 200, { ok: true });
});

/* ---------- aktivite ---------- */
route('GET', '/api/events', (req, res) => {
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  json(res, 200, { events: d.events.filter(e => e.userId === u.id).slice(0, 40) });
});

/* ---------- kullanım özeti ---------- */
route('GET', '/api/usage', (req, res) => {
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const d = db();
  const projs = d.projects.filter(p => p.ownerId === u.id);
  const deps = d.deploys.filter(x => x.ownerId === u.id);
  const ok = deps.filter(x => x.status === 'live').length;
  const plan = PLANS[u.plan];
  json(res, 200, {
    plan, allFree: true,
    projects: { used: projs.length, limit: plan.projects },
    deploys: { used: deps.length, limit: plan.deploysPerDay, today: deps.filter(x => (x.createdAt || '').slice(0, 10) === now().slice(0, 10)).length },
    successRate: deps.length ? Math.round((ok / deps.length) * 100) : 100,
    bandwidth: { usedGb: Math.round((deps.length * 0.37 + projs.length * 1.2) * 10) / 10, limitGb: plan.bandwidthGb },
    members: { used: d.members.filter(m => m.ownerId === u.id).length + 1, limit: plan.seats },
  });
});

/* ---------- demo verisi ---------- */
route('POST', '/api/demo/seed', (req, res) => {
  const u = userFromReq(req); if (!u) return json(res, 401, { error: 'Oturum bulunamadı' });
  const samples = [
    { name: 'web-frontend', framework: 'Next.js', repo: 'github.com/' + u.name + '/web-frontend', port: 3000 },
    { name: 'api-gateway', framework: 'Node.js', repo: 'github.com/' + u.name + '/api-gateway', port: 8080 },
    { name: 'worker-jobs', framework: 'Python', repo: 'github.com/' + u.name + '/worker-jobs', port: 9000 },
    { name: 'docs-site', framework: 'Astro', repo: 'github.com/' + u.name + '/docs-site', port: 4321 },
  ];
  mutate(d => {
    samples.forEach((s, i) => {
      if (d.projects.some(p => p.ownerId === u.id && p.slug === s.name)) return;
      const proj = {
        id: uid('p_'), ownerId: u.id, ownerName: u.name, name: s.name, slug: s.name, repo: s.repo,
        framework: s.framework, branch: 'main', buildCmd: 'npm run build', installCmd: 'npm ci', startCmd: 'npm start',
        rootDir: '/', port: s.port, region: 'fra1',
        status: i === 0 ? 'live' : (i === 1 ? 'live' : 'idle'),
        url: i < 2 ? 'https://' + s.name + '.vapor.app' : null,
        createdAt: now(), updatedAt: now(), visibility: 'public',
      };
      d.projects.push(proj);
      if (i < 3) {
        for (let k = 0; k < 2 + i; k++) {
          const okd = Math.random() > 0.18;
          d.deploys.push({
            id: uid('d_'), projectId: proj.id, ownerId: u.id, projectName: proj.name, branch: 'main',
            commit: uid('').slice(0, 7), message: ['feat: yeni özellik', 'fix: hata düzeltmesi', 'chore: bağımlılık güncellemesi', 'perf: sorgu optimizasyonu'][k % 4],
            status: okd ? 'live' : 'failed', stage: okd ? 'live' : 'building', stageLabel: okd ? 'Yayında' : 'Derleniyor',
            progress: okd ? 100 : 62, createdAt: new Date(Date.now() - (k * 6 + i) * 36e5).toISOString(),
            finishedAt: okd ? now() : null, url: okd ? 'https://' + proj.slug + '.vapor.app' : null,
            durationSec: 18 + Math.floor(Math.random() * 40), trigger: k === 0 ? 'git' : 'manual', env: 'production',
          });
        }
      }
    });
  });
  json(res, 201, { ok: true, projects: db().projects.filter(p => p.ownerId === u.id).length });
});

/* =========================================================
   6) ROUTER
   ========================================================= */
function match(pattern, url) {
  const a = pattern.split('/').filter(Boolean), b = url.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

/* =========================================================
   7) STATİK DOSYA SUNUCUSU
   ========================================================= */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };

function serveStatic(req, res, urlPath) {
  let p = urlPath === '/' ? '/index.html' : urlPath;
  // SPA fallback: uzantısız yollar index.html'e düşer
  let file = path.join(PUBLIC, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (!path.extname(p)) file = path.join(PUBLIC, 'index.html');
    else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<h1>404 — Bulunamadı</h1>'); }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
}

/* =========================================================
   8) SUNUCU
   ========================================================= */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') return json(res, 204, {});

  if (pathname.startsWith('/api/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const params = match(r.pattern, pathname);
      if (!params) continue;
      let raw = '';
      req.on('data', c => { raw += c; if (raw.length > 2e6) req.destroy(); });
      req.on('end', () => {
        let body = null;
        if (raw) { try { body = JSON.parse(raw); } catch (e) { body = null; } }
        req.params = params;
        try { r.handler(req, res, body, params, url); }
        catch (e) { json(res, 500, { error: 'Sunucu hatası', detail: String(e.message) }); }
      });
      return;
    }
    return json(res, 404, { error: 'Uç nokta bulunamadı', path: pathname });
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ⚡ Vapor çalışıyor');
  console.log('  → http://localhost:' + PORT);
  console.log('  → API: http://localhost:' + PORT + '/api/health');
  console.log('');
});

module.exports = server;
