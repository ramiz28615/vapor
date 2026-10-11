/* =========================================================
   VAPOR — İSTEMCİ UYGULAMASI
   ========================================================= */
const V = (() => {
  const S = {
    token: localStorage.getItem('vapor_token') || null,
    user: null, plan: null,
    projects: [], deploys: [], events: [], members: [], keys: [], usage: null,
    route: 'dashboard', current: null, currentDeploy: null,
    deployPoll: null,
  };
  const $$ = s => Array.from(document.querySelectorAll(s));
  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- API ---------- */
  async function api(path, opts) {
    opts = opts || {};
    const h = { 'Content-Type': 'application/json' };
    if (S.token) h.Authorization = 'Bearer ' + S.token;
    const r = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: h,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const txt = await r.text();
    let j = null;
    try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
    if (!r.ok) throw new Error((j && j.error) || ('Hata ' + r.status));
    return j;
  }

  /* ---------- yardımcılar ---------- */
  function ago(iso) {
    if (!iso) return '—';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return Math.round(s) + ' sn önce';
    if (s < 3600) return Math.round(s / 60) + ' dk önce';
    if (s < 86400) return Math.round(s / 3600) + ' sa önce';
    return Math.round(s / 86400) + ' gün önce';
  }
  const initials = n => (n || '?').trim().slice(0, 1).toUpperCase();
  function toast(msg, kind) {
    kind = kind || 'ok';
    const box = el('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = '<span class="ic">' + (kind === 'ok' ? '✓' : '!') + '</span><span>' + esc(msg) + '</span>';
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
  }
  const ICON = {
    rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.9.7-2.2 0-3-.8-.7-2.1-.7-3 0z"/><path d="M12 15l-3-3a22 22 0 012-3.9A12.6 12.6 0 0121 3a12.6 12.6 0 01-5.1 10 22 22 0 01-3.9 2z"/><path d="M9 12H4s.5-2.8 2-4c1.6-1.2 5 0 5 0"/><path d="M12 15v5s2.8-.5 4-2c1.2-1.6 0-5 0-5"/>',
    box: '<path d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.3 7l8.7 5 8.7-5M12 22V12"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9"/>',
    key: '<path d="M21 2l-2 2m-7.6 7.6a5 5 0 11-7 7 5 5 0 017-7zm0 0L15 8m0 0l3 3 3-3-3-3-3 3z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    bell: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18 15 15 0 010-18z"/>',
    layers: '<path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 17l9 5 9-5"/>',
  };
  const svg = (n, w) => '<svg viewBox="0 0 24 24" width="' + (w || 16) + '" height="' + (w || 16) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (ICON[n] || '') + '</svg>';

  /* =========================================================
     LANDING
     ========================================================= */
  const FEATURES = [
    ['rocket', 'Tek tıkla deploy', 'Deponu bağla, panelden deploy et. Aşama aşama ilerlemeyi ve canlı log akışını anlık izle.'],
    ['globe', 'Özel alan adı + SSL', 'Kendi alan adını bağla; DNS kayıtlarını tanımla, doğrulama sonrası SSL otomatik açılır.'],
    ['key', 'Ortam değişkenleri', 'Gizli anahtarlar maskelenir, loglarda görünmez. production/preview ayrı setler.'],
    ['clock', 'Geçmiş & rollback', 'Her sürüm saklanır. Sorun çıkarsa önceki çalışan sürüme tek tıkla geri dön.'],
    ['chart', 'Gerçek zamanlı metrikler', 'İstek sayısı, bant genişliği, hata oranı ve gecikme (p50/p95) — günlük grafiklerle.'],
    ['users', 'Ekip yönetimi', 'E-posta ile davet gönder, rol ver. Koltuk limiti planına göre otomatik uygulanır.'],
    ['layers', 'Proje ayarları', 'Framework algılama, build/start komutları, kök dizin, port ve bölge ayarları.'],
    ['box', 'API erişimi', 'Kendi anahtarlarını üret, CI/CD hattına bağla.'],
  ];
  const PLANS_UI = [
    { name: 'Free', best: false, feats: ['5 proje', 'Günde 50 deploy', '100 GB bant genişliği', '7 gün metrik geçmişi', 'Özel alan adı + SSL', '1 koltuk'] },
    { name: 'Pro', best: true, feats: ['50 proje', 'Günde 500 deploy', '1 TB bant genişliği', '30 gün metrik geçmişi', 'Özel alan adı + SSL', '10 koltuk', 'Uyku modu kapalı'] },
    { name: 'Team', best: false, feats: ['Sınırsız proje', 'Günde 5.000 deploy', '5 TB bant genişliği', '90 gün metrik geçmişi', 'Özel alan adı + SSL', '50 koltuk', 'Uyku modu kapalı'] },
  ];
  function paintLanding() {
    el('featGrid').innerHTML = FEATURES.map(f => '<div class="feat"><div class="ic">' + svg(f[0], 18) + '</div><h3>' + f[1] + '</h3><p>' + f[2] + '</p></div>').join('');
    el('planGrid').innerHTML = PLANS_UI.map(p =>
      '<div class="plan ' + (p.best ? 'best' : '') + '">' + (p.best ? '<span class="best-tag">En popüler</span>' : '') +
      '<h3>' + p.name + '</h3><div class="pr">₺0<small>/ay</small></div><div class="pr-note">Sonsuza kadar ücretsiz</div>' +
      '<ul>' + p.feats.map(f => '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 12l5 5L20 6"/></svg>' + f + '</li>').join('') + '</ul>' +
      '<button class="btn ' + (p.best ? 'pri' : '') + '" onclick="V.openAuth(\'register\')">Ücretsiz başla</button></div>').join('');
    el('yr').textContent = new Date().getFullYear();
    [['trustP', 12480], ['trustD', 42860]].forEach(t => {
      const n = el(t[0]), t0 = performance.now();
      (function step(now) {
        const p = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - p, 3);
        n.textContent = Math.round(t[1] * e).toLocaleString('tr-TR');
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }
  const DEMO_LINES = [
    ['$ vapor deploy --prod', 'cmd'],
    ['Cloning github.com/sen/uygulamam (main)', ''],
    ['Commit a3f91c2 · feat: ödeme akışı', ''],
    ['Detected: Next.js — build preset uygulanıyor', 'ok'],
    ['npm ci → 412 paket 6.4s', ''],
    ['npm run build → ✓ 38 modül derlendi', ''],
    ['Bundle: 186 KB (gzip 61 KB)', ''],
    ['Health check passed ✓', 'ok'],
    ['Yayında → https://uygulamam.vapor.app', 'ok'],
  ];
  function demoTerminal() {
    const box = el('demoTerm'); if (!box) return;
    let i = 0;
    (function loop() {
      if (i >= DEMO_LINES.length) { setTimeout(() => { box.innerHTML = ''; i = 0; loop(); }, 3400); return; }
      const l = DEMO_LINES[i++];
      const d = document.createElement('div');
      d.className = 'l ' + l[1];
      d.innerHTML = '<span class="tm">' + new Date().toLocaleTimeString('tr-TR', { hour12: false }) + '</span><span>' + esc(l[0]) + '</span>';
      box.appendChild(d);
      box.scrollTop = box.scrollHeight;
      setTimeout(loop, l[1] === 'cmd' ? 700 : 420 + Math.random() * 420);
    })();
  }

  /* =========================================================
     AUTH
     ========================================================= */
  let authMode = 'register';
  function openAuth(mode) {
    authMode = mode || 'register';
    el('landing').hidden = true; el('app').hidden = true; el('auth').hidden = false;
    el('authErr').hidden = true;
    el('authTitle').textContent = authMode === 'register' ? 'Hesap oluştur' : 'Tekrar hoş geldin';
    el('authHint').textContent = authMode === 'register' ? 'Ücretsiz, kart gerekmez.' : 'Hesabına giriş yap.';
    el('authSubmit').textContent = authMode === 'register' ? 'Hesap oluştur' : 'Giriş yap';
    el('nameField').hidden = authMode !== 'register';
    el('authSwitchText').textContent = authMode === 'register' ? 'Zaten hesabın var mı?' : 'Hesabın yok mu?';
    el('authSwitch').textContent = authMode === 'register' ? 'Giriş yap' : 'Kayıt ol';
  }
  function backToLanding() { el('auth').hidden = true; el('landing').hidden = false; }
  el('authSwitch').onclick = () => openAuth(authMode === 'register' ? 'login' : 'register');
  el('authForm').onsubmit = async e => {
    e.preventDefault();
    const btn = el('authSubmit'), old = btn.textContent;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> İşleniyor';
    try {
      const body = { email: el('auEmail').value.trim(), password: el('auPass').value };
      if (authMode === 'register') body.name = el('auName').value.trim() || undefined;
      const r = await api('/auth/' + (authMode === 'register' ? 'register' : 'login'), { method: 'POST', body });
      S.token = r.token; localStorage.setItem('vapor_token', r.token);
      el('auth').hidden = true;
      await boot();
    } catch (err) {
      el('authErr').textContent = err.message; el('authErr').hidden = false;
    } finally { btn.disabled = false; btn.textContent = old; }
  };

  /* =========================================================
     KABUK
     ========================================================= */
  const NAV = [
    { g: 'Genel' },
    { k: 'dashboard', t: 'Genel bakış', i: 'box' },
    { k: 'projects', t: 'Projeler', i: 'rocket' },
    { k: 'deploys', t: 'Deploy geçmişi', i: 'clock' },
    { g: 'Kaynaklar' },
    { k: 'domains', t: 'Alan adları', i: 'globe' },
    { k: 'usage', t: 'Kullanım & limitler', i: 'chart' },
    { g: 'Hesap' },
    { k: 'members', t: 'Ekip', i: 'users' },
    { k: 'keys', t: 'API anahtarları', i: 'key' },
    { k: 'events', t: 'Aktiviteler', i: 'bell' },
    { k: 'settings', t: 'Ayarlar', i: 'gear' },
  ];
  function paintNav() {
    el('sideNav').innerHTML = NAV.map(n => {
      if (n.g) return '<div class="grp">' + n.g + '</div>';
      const badge = (n.k === 'deploys' && S.deploys.length) ? '<span class="badge">' + S.deploys.length + '</span>' : '';
      return '<button class="snav ' + (S.route === n.k ? 'on' : '') + '" onclick="V.go(\'' + n.k + '\')">' + svg(n.i) + '<span>' + n.t + '</span>' + badge + '</button>';
    }).join('');
  }
  function paintUser() {
    if (!S.user) return;
    el('userName').textContent = S.user.name || S.user.email;
    el('userAv').textContent = initials(S.user.name || S.user.email);
    el('userPlan').textContent = (S.plan ? S.plan.name : 'Free') + ' plan · ücretsiz';
  }
  function toggleSide() {
    el('side').classList.toggle('open');
    el('sbBack').classList.toggle('on', el('side').classList.contains('open'));
  }
  el('sbBack').onclick = toggleSide;
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'light' ? 'dark' : 'light';
    if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('vapor_theme', next);
  }
  function logout() {
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('vapor_token');
    S.token = null; S.user = null;
    el('app').hidden = true; el('landing').hidden = false;
    toast('Çıkış yapıldı');
  }

  /* =========================================================
     ROTA
     ========================================================= */
  async function go(route) {
    S.route = route;
    if (window.innerWidth <= 960 && el('side').classList.contains('open')) toggleSide();
    paintNav(); paintCrumb();
    await paintView();
    window.scrollTo({ top: 0 });
  }
  const CRUMB = { dashboard: 'Genel bakış', projects: 'Projeler', deploys: 'Deploy geçmişi', domains: 'Alan adları', usage: 'Kullanım', members: 'Ekip', keys: 'API anahtarları', events: 'Aktiviteler', settings: 'Ayarlar' };
  function paintCrumb() {
    if (S.route === 'project' && S.current) {
      el('crumb').innerHTML = '<a onclick="V.go(\'projects\')">Projeler</a><span class="sep">/</span><b>' + esc(S.current.project.name) + '</b>';
    } else if (S.route === 'deploy' && S.currentDeploy) {
      el('crumb').innerHTML = '<a onclick="V.go(\'deploys\')">Deploy geçmişi</a><span class="sep">/</span><b class="mono">' + esc(S.currentDeploy.id.slice(-8)) + '</b>';
    } else {
      el('crumb').innerHTML = '<b>' + (CRUMB[S.route] || 'Vapor') + '</b>';
    }
  }

  /* =========================================================
     GÖRÜNÜMLER
     ========================================================= */
  async function paintView() {
    const v = el('view');
    v.innerHTML = '<div class="skel" style="height:26px;width:220px;margin-bottom:14px"></div><div class="skel" style="height:110px"></div>';
    try {
      if (S.route === 'dashboard') return viewDashboard(v);
      if (S.route === 'projects') return viewProjects(v);
      if (S.route === 'project') return viewProject(v);
      if (S.route === 'deploys') return viewDeploys(v);
      if (S.route === 'domains') return viewDomains(v);
      if (S.route === 'usage') return viewUsage(v);
      if (S.route === 'members') return viewMembers(v);
      if (S.route === 'keys') return viewKeys(v);
      if (S.route === 'events') return viewEvents(v);
      if (S.route === 'settings') return viewSettings(v);
      return viewDashboard(v);
    } catch (e) {
      v.innerHTML = '<div class="empty"><div class="ic">⚠️</div><h3>Bir şeyler ters gitti</h3><p>' + esc(e.message) + '</p></div>';
    }
  }

  /* ---------- dashboard ---------- */
  async function viewDashboard(v) {
    const p = await api('/projects'), d = await api('/deploys'), u = await api('/usage');
    S.projects = p.projects; S.deploys = d.deploys; S.usage = u; paintNav();
    const live = S.projects.filter(x => x.status === 'live').length;
    v.innerHTML =
      '<div class="view-head"><div><h1>Genel bakış</h1><p>Hoş geldin ' + esc(S.user.name || S.user.email) + ' — her şey yolunda görünüyor.</p></div>' +
      '<span class="sp"></span><button class="btn" onclick="V.go(\'usage\')">Kullanımı gör</button>' +
      '<button class="btn pri" onclick="V.newProjectModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Yeni proje</button></div>' +
      '<div class="kpis">' +
        kpi('box', 'Toplam proje', S.projects.length, live + ' tanesi yayında · limit ' + u.projects.limit, S.projects.length / u.projects.limit * 100, '') +
        kpi('rocket', 'Toplam deploy', S.deploys.length, 'bugün ' + u.deploys.today + ' · limit ' + u.deploys.limit + '/gün', u.deploys.today / u.deploys.limit * 100, '') +
        kpi('chart', 'Başarı oranı', u.successRate + '%', 'başarılı dağıtımların oranı', u.successRate, u.successRate < 70 ? 'warn' : '') +
        kpi('globe', 'Bant genişliği', u.bandwidth.usedGb + ' GB', 'limit ' + u.bandwidth.limitGb + ' GB', u.bandwidth.usedGb / u.bandwidth.limitGb * 100, '') +
      '</div>' +
      '<div class="card" style="padding:20px;margin-bottom:18px"><b style="font-size:15px">Son 14 gün — istek trafiği</b>' +
      '<div style="font-size:12.5px;color:var(--faint);margin:4px 0 14px">Tüm projeler toplamı</div>' +
      '<svg class="chart" id="dashChart" viewBox="0 0 800 200" preserveAspectRatio="none"></svg></div>' +
      '<div style="display:flex;align-items:center;gap:12px;margin:22px 0 14px"><b style="font-size:15px">Projeler</b><span style="flex:1"></span>' +
      '<button class="btn sm" onclick="V.go(\'projects\')">Tümünü gör →</button></div>' +
      (S.projects.length ? '<div class="pgrid">' + S.projects.slice(0, 6).map(projectCard).join('') + '</div>' : emptyProjects());
    drawChart('dashChart', Array.from({ length: 14 }, (_, i) => 620 + Math.round(Math.sin(i / 2.1) * 260) + Math.floor(Math.random() * 220)), 'var(--acc)');
    bindCards();
  }
  function kpi(icon, label, val, sub, pct, cls) {
    return '<div class="kpi"><div class="lb">' + svg(icon, 13) + label + '</div><div class="vl">' + val + '</div><div class="sb">' + sub + '</div>' +
      '<div class="bar"><i class="' + (cls || '') + '" style="width:' + Math.min(100, Math.max(0, pct || 0)) + '%"></i></div></div>';
  }
  function drawChart(id, vals, color) {
    const svgEl = el(id); if (!svgEl) return;
    const W = 800, H = 200, pad = { t: 12, r: 10, b: 22, l: 44 }, n = vals.length;
    const max = Math.max.apply(null, vals) * 1.18 || 1;
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const X = i => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const Y = v => pad.t + ih - (v / max) * ih;
    const line = vals.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
    const area = line + ' L ' + X(n - 1) + ' ' + (pad.t + ih) + ' L ' + X(0) + ' ' + (pad.t + ih) + ' Z';
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4, y = Y(v);
      g += '<line class="gl" x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '"/>';
      g += '<text class="al" x="' + (pad.l - 7) + '" y="' + (y + 3) + '" text-anchor="end">' + Math.round(v / 1000) + 'k</text>';
    }
    svgEl.innerHTML = '<defs><linearGradient id="' + id + 'G" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity=".35"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      g + '<path class="ar" d="' + area + '" fill="url(#' + id + 'G)"/><path class="ln" d="' + line + '" stroke="' + color + '"/>';
  }
  const FW_ICON = { 'Next.js': '▲', 'Node.js': '⬢', 'Python': '🐍', 'Astro': '🚀', 'React': '⚛️', 'Vue': '💚', 'Go': '🐹', 'Rust': '🦀', 'Docker': '🐳' };
  function projectCard(p) {
    const st = p.status === 'live' ? '<span class="pill ok"><span class="dot"></span>Yayında</span>'
      : p.status === 'building' ? '<span class="pill warn"><span class="dot pulse"></span>Derleniyor</span>'
      : '<span class="pill mute"><span class="dot"></span>Hazır</span>';
    return '<div class="pcard" data-id="' + p.id + '"><div class="acts">' +
      '<button class="btn icon sm" title="Deploy et" onclick="event.stopPropagation();V.deploy(\'' + p.id + '\')">' + svg('rocket', 13) + '</button></div>' +
      '<div class="hd"><span class="ic">' + (FW_ICON[p.framework] || '📦') + '</span>' +
      '<span class="tt"><b>' + esc(p.name) + '</b><span>' + esc(p.framework) + ' · ' + esc(p.branch) + '</span></span></div>' +
      '<span class="url">' + (p.url ? esc(p.url.replace('https://', '')) : 'henüz yayınlanmadı') + '</span>' +
      '<div class="meta">' + st + '<span class="sep">·</span><span>' + (p.deployCount || 0) + ' deploy</span><span class="sep">·</span><span>' + ago(p.updatedAt) + '</span></div></div>';
  }
  function bindCards() { $$('.pcard').forEach(c => c.onclick = () => openProject(c.dataset.id)); }
  function emptyProjects() {
    return '<div class="empty"><div class="ic">🚀</div><h3>Henüz projen yok</h3>' +
      '<p>İlk projeni oluştur: bir isim ver, deponu bağla ve saniyeler içinde yayına al. İstersen örnek projelerle başla.</p>' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
      '<button class="btn pri" onclick="V.newProjectModal()">Yeni proje oluştur</button>' +
      '<button class="btn" onclick="V.seedDemo()">Örnek verilerle dene</button></div></div>';
  }

  /* ---------- projeler ---------- */
  async function viewProjects(v) {
    const r = await api('/projects'); S.projects = r.projects;
    v.innerHTML = '<div class="view-head"><div><h1>Projeler</h1><p>' + S.projects.length + ' / ' + r.limit + ' proje kullanılıyor</p></div>' +
      '<span class="sp"></span><button class="btn" onclick="V.seedDemo()">Örnek veri ekle</button>' +
      '<button class="btn pri" onclick="V.newProjectModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Yeni proje</button></div>' +
      (S.projects.length ? '<div class="pgrid">' + S.projects.map(projectCard).join('') + '</div>' : emptyProjects());
    bindCards();
  }
  async function openProject(id) {
    S.current = await api('/projects/' + id);
    S.route = 'project'; paintNav(); paintCrumb(); paintView();
  }
  async function viewProject(v) {
    const c = S.current; if (!c) return go('projects');
    const p = c.project;
    v.innerHTML = '<div class="view-head">' +
      '<span style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:19px;background:var(--panel2);border:1px solid var(--hair)">' + (FW_ICON[p.framework] || '📦') + '</span>' +
      '<div><h1>' + esc(p.name) + '</h1><p>' + esc(p.framework) + ' · ' + esc(p.repo) + ' · ' + esc(p.branch) + '</p></div>' +
      '<span class="sp"></span><button class="btn" onclick="V.go(\'projects\')">← Projeler</button>' +
      (p.url ? '<button class="btn" onclick="window.open(\'' + p.url + '\',\'_blank\')">' + svg('globe', 14) + 'Siteyi aç</button>' : '') +
      '<button class="btn pri" onclick="V.deploy(\'' + p.id + '\')">' + svg('rocket', 14) + 'Deploy et</button></div>' +
      '<div class="tabs" id="ptabs">' +
      '<button class="tab on" data-t="overview">Genel</button><button class="tab" data-t="deploys">Deploy\'lar</button>' +
      '<button class="tab" data-t="env">Ortam değişkenleri</button><button class="tab" data-t="domains">Alan adları</button>' +
      '<button class="tab" data-t="metrics">Metrikler</button><button class="tab" data-t="settings">Ayarlar</button></div>' +
      '<div id="ptabBody"></div>';
    $$('#ptabs .tab').forEach(t => t.onclick = () => {
      $$('#ptabs .tab').forEach(x => x.classList.remove('on'));
      t.classList.add('on'); paintTab(t.dataset.t);
    });
    paintTab('overview');
  }
  async function paintTab(tab) {
    const box = el('ptabBody'); if (!box) return;
    const c = S.current, p = c.project;
    box.innerHTML = '<div class="skel" style="height:160px"></div>';
    if (tab === 'overview') {
      const last = c.deploys[0];
      box.innerHTML = '<div class="kpis">' +
        kpi('box', 'Durum', p.status === 'live' ? 'Yayında' : p.status === 'building' ? 'Derleniyor' : 'Hazır', p.url ? esc(p.url.replace('https://', '')) : '—', 0, '') +
        kpi('rocket', 'Deploy sayısı', c.deploys.length, 'son: ' + ago(p.updatedAt), 0, '') +
        kpi('key', 'Ortam değişkeni', c.envs.length, 'production + preview', 0, '') +
        kpi('globe', 'Alan adı', c.domains.length, c.domains.filter(d => d.verified).length + ' doğrulanmış', 0, '') + '</div>' +
        '<div class="card" style="padding:20px"><b style="font-size:14.5px">Son deploy</b>' +
        (last ? '<div style="margin-top:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
          '<span class="mono" style="font-size:12.5px;color:var(--dim)">' + esc(last.commit) + '</span><span>' + esc(last.message) + '</span>' +
          '<span class="pill ' + (last.status === 'live' ? 'ok' : 'warn') + '"><span class="dot"></span>' + esc(last.stageLabel || last.status) + '</span>' +
          '<span style="color:var(--faint);font-size:12.5px">' + ago(last.createdAt) + '</span><span style="flex:1"></span>' +
          '<button class="btn sm" onclick="V.openDeploy(\'' + last.id + '\')">Logları gör</button></div>'
          : '<p style="color:var(--faint);font-size:13.5px;margin-top:10px">Henüz deploy yapılmadı.</p>') + '</div>';
    } else if (tab === 'deploys') {
      box.innerHTML = c.deploys.length ? deployTable(c.deploys)
        : '<div class="empty"><div class="ic">📦</div><h3>Deploy yok</h3><p>İlk deployunu başlat ve canlı logları izle.</p><button class="btn pri" onclick="V.deploy(\'' + p.id + '\')">Deploy et</button></div>';
      bindRows();
    } else if (tab === 'env') {
      box.innerHTML = '<div class="card" style="padding:20px;margin-bottom:14px"><b style="font-size:14.5px">Ortam değişkenleri</b>' +
        '<p style="font-size:13px;color:var(--faint);margin:5px 0 16px">Gizli değerler maskelenir ve loglarda görünmez.</p>' +
        '<div style="display:grid;grid-template-columns:1.2fr 1.6fr .8fr auto;gap:10px;align-items:end">' +
        '<div class="field" style="margin:0"><label>Anahtar</label><input id="envK" placeholder="DATABASE_URL" class="mono" /></div>' +
        '<div class="field" style="margin:0"><label>Değer</label><input id="envV" placeholder="postgres://..." class="mono" /></div>' +
        '<div class="field" style="margin:0"><label>Ortam</label><select id="envE"><option value="production">production</option><option value="preview">preview</option></select></div>' +
        '<button class="btn pri" onclick="V.addEnv(\'' + p.id + '\')">Ekle</button></div>' +
        '<label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:var(--dim);cursor:pointer">' +
        '<input type="checkbox" id="envS" checked style="width:auto" /> Gizli değer olarak sakla</label></div>' +
        '<div class="tbl-wrap">' + (c.envs.length ? c.envs.map(e =>
          '<div class="rowitem"><span class="k">' + esc(e.key) + '</span><span class="v">' + esc(e.value) + '</span>' +
          '<span class="pill ' + (e.env === 'production' ? 'acc' : 'mute') + '">' + esc(e.env) + '</span>' +
          (e.secret ? '<span class="pill mute">gizli</span>' : '') +
          '<button class="btn icon sm danger" onclick="V.delEnv(\'' + e.id + '\',\'' + p.id + '\')">✕</button></div>').join('')
          : '<div class="empty" style="border:0;padding:34px"><p>Henüz değişken eklenmedi.</p></div>') + '</div>';
    } else if (tab === 'domains') {
      box.innerHTML = '<div class="card" style="padding:20px;margin-bottom:14px"><b style="font-size:14.5px">Özel alan adı bağla</b>' +
        '<p style="font-size:13px;color:var(--faint);margin:5px 0 16px">Alan adını gir, verilen DNS kayıtlarını sağlayıcında tanımla, sonra doğrula. SSL otomatik açılır.</p>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><input id="domIn" placeholder="uygulamam.com" class="mono" style="flex:1;min-width:200px;padding:11px 13px;border-radius:10px;border:1px solid var(--hair2);background:var(--bg2)" />' +
        '<button class="btn pri" onclick="V.addDomain(\'' + p.id + '\')">Alan adı ekle</button></div></div>' +
        (c.domains.length ? c.domains.map(d =>
          '<div class="card" style="padding:18px;margin-bottom:12px"><div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap">' +
          '<b class="mono" style="font-size:14px">' + esc(d.domain) + '</b>' +
          (d.verified ? '<span class="pill ok"><span class="dot"></span>Doğrulandı</span>' : '<span class="pill warn"><span class="dot pulse"></span>Bekliyor</span>') +
          '<span class="pill mute">SSL: ' + esc(d.ssl) + '</span><span style="flex:1"></span>' +
          (d.verified ? '' : '<button class="btn sm" onclick="V.verifyDomain(\'' + d.id + '\',\'' + p.id + '\')">Doğrula</button>') +
          '<button class="btn sm danger" onclick="V.delDomain(\'' + d.id + '\',\'' + p.id + '\')">Kaldır</button></div>' +
          '<div style="margin-top:14px;font-size:12.5px;color:var(--faint)">DNS kayıtları</div>' +
          '<div class="mono" style="margin-top:8px;font-size:12px;color:var(--dim);display:flex;flex-direction:column;gap:6px">' +
          d.records.map(r => '<div>' + r.type + ' &nbsp; ' + r.name + ' &nbsp; → &nbsp; ' + esc(r.value) + '</div>').join('') +
          '</div></div>').join('')
          : '<div class="empty"><div class="ic">🌐</div><h3>Alan adı yok</h3><p>Varsayılan adres: ' + esc(p.slug) + '.vapor.app — kendi alan adını da bağlayabilirsin.</p></div>');
    } else if (tab === 'metrics') {
      const m = await api('/projects/' + p.id + '/metrics');
      const avg = k => Math.round(m.series.reduce((a, s) => a + s[k], 0) / m.series.length);
      box.innerHTML = '<div class="kpis">' +
        kpi('chart', 'İstekler', m.totals.requests.toLocaleString('tr-TR'), 'son ' + m.windowDays + ' gün', 0, '') +
        kpi('globe', 'Bant genişliği', (m.totals.bandwidthMb / 1024).toFixed(1) + ' GB', 'limit ' + m.bandwidthLimitGb + ' GB', 0, '') +
        kpi('box', 'Hatalar', m.totals.errors, (m.totals.errors / Math.max(1, m.totals.requests) * 100).toFixed(2) + '% oran', 0, '') +
        kpi('clock', 'p95 gecikme', avg('p95') + ' ms', 'p50 ' + avg('p50') + ' ms', 0, '') + '</div>' +
        '<div class="card" style="padding:20px"><b style="font-size:14.5px">Günlük istekler</b>' +
        '<svg class="chart" id="mChart" viewBox="0 0 800 200" preserveAspectRatio="none" style="margin-top:14px"></svg></div>';
      drawChart('mChart', m.series.map(s => s.requests), 'var(--acc2)');
    } else if (tab === 'settings') {
      box.innerHTML = '<div class="card" style="padding:22px;max-width:620px"><b style="font-size:14.5px">Proje ayarları</b>' +
        '<div style="margin-top:16px">' +
        '<div class="field"><label>Proje adı</label><input id="sName" value="' + esc(p.name) + '" /></div>' +
        '<div class="field"><label>Depo</label><input id="sRepo" value="' + esc(p.repo) + '" class="mono" /></div>' +
        '<div class="two"><div class="field"><label>Framework</label><select id="sFw">' +
        Object.keys(FW_ICON).map(f => '<option ' + (f === p.framework ? 'selected' : '') + '>' + f + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Dal</label><input id="sBr" value="' + esc(p.branch) + '" class="mono" /></div></div>' +
        '<div class="two"><div class="field"><label>Build komutu</label><input id="sBuild" value="' + esc(p.buildCmd) + '" class="mono" /></div>' +
        '<div class="field"><label>Start komutu</label><input id="sStart" value="' + esc(p.startCmd) + '" class="mono" /></div></div>' +
        '<div class="two"><div class="field"><label>Port</label><input id="sPort" type="number" value="' + p.port + '" /></div>' +
        '<div class="field"><label>Bölge</label><select id="sRegion">' +
        ['fra1', 'iad1', 'sfo1', 'sin1', 'gru1'].map(r => '<option ' + (r === p.region ? 'selected' : '') + '>' + r + '</option>').join('') + '</select></div></div>' +
        '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn pri" onclick="V.saveProject(\'' + p.id + '\')">Değişiklikleri kaydet</button>' +
        '<span style="flex:1"></span><button class="btn danger" onclick="V.deleteProject(\'' + p.id + '\')">Projeyi sil</button></div></div></div>';
    }
  }

  /* ---------- deploy ---------- */
  function deployTable(list) {
    return '<div class="tbl-wrap"><table><thead><tr><th>Proje</th><th>Commit</th><th>Mesaj</th><th>Durum</th><th>Tetikleyici</th><th>Süre</th><th>Zaman</th><th></th></tr></thead><tbody>' +
      list.map(d => '<tr class="drow" data-id="' + d.id + '" style="cursor:pointer">' +
        '<td><b>' + esc(d.projectName) + '</b></td><td class="mono" style="color:var(--dim)">' + esc(d.commit) + '</td>' +
        '<td style="color:var(--dim)">' + esc(d.message) + '</td>' +
        '<td>' + (d.status === 'live' ? '<span class="pill ok"><span class="dot"></span>Yayında</span>'
          : d.status === 'failed' ? '<span class="pill err"><span class="dot"></span>Başarısız</span>'
          : '<span class="pill warn"><span class="dot pulse"></span>' + esc(d.stageLabel || 'Sürüyor') + '</span>') + '</td>' +
        '<td><span class="pill mute">' + esc(d.trigger) + '</span></td>' +
        '<td class="mono" style="color:var(--dim)">' + (d.durationSec ? d.durationSec + ' sn' : '—') + '</td>' +
        '<td style="color:var(--faint);font-size:12.5px">' + ago(d.createdAt) + '</td>' +
        '<td class="r"><button class="btn sm" onclick="event.stopPropagation();V.openDeploy(\'' + d.id + '\')">Log</button></td></tr>').join('') +
      '</tbody></table></div>';
  }
  function bindRows() { $$('.drow').forEach(r => r.onclick = () => openDeploy(r.dataset.id)); }
  async function viewDeploys(v) {
    const r = await api('/deploys'); S.deploys = r.deploys; paintNav();
    v.innerHTML = '<div class="view-head"><div><h1>Deploy geçmişi</h1><p>' + S.deploys.length + ' kayıt</p></div><span class="sp"></span>' +
      '<button class="btn" onclick="V.go(\'projects\')">Projelere git</button></div>' +
      (S.deploys.length ? deployTable(S.deploys) : '<div class="empty"><div class="ic">📦</div><h3>Henüz deploy yok</h3><p>Bir proje oluşturup deploy ettiğinde kayıtlar burada listelenir.</p><button class="btn pri" onclick="V.go(\'projects\')">Projelere git</button></div>');
    bindRows();
  }
  const STAGES = ['queued', 'cloning', 'detecting', 'installing', 'building', 'uploading', 'starting', 'live'];
  const STAGE_LBL = { queued: 'Kuyruğa alındı', cloning: 'Depo klonlanıyor', detecting: 'Framework algılanıyor', installing: 'Bağımlılıklar kuruluyor', building: 'Derleniyor', uploading: 'Artefakt yükleniyor', starting: 'Servis başlatılıyor', live: 'Yayında' };
  async function openDeploy(id) {
    const r = await api('/deploys/' + id);
    S.currentDeploy = r.deploy; S.route = 'deploy'; paintNav(); paintCrumb();
    renderDeploy(r.deploy, r.logs);
    if (['queued', 'building'].indexOf(r.deploy.status) >= 0) pollDeploy(id);
  }
  function renderDeploy(d, logs) {
    const idx = STAGES.indexOf(d.stage);
    el('view').innerHTML = '<div class="view-head"><div><h1>Deploy <span class="mono" style="font-size:16px;color:var(--dim)">' + esc(d.id.slice(-8)) + '</span></h1>' +
      '<p>' + esc(d.projectName) + ' · ' + esc(d.branch) + ' · ' + esc(d.commit) + ' · ' + esc(d.message) + '</p></div>' +
      '<span class="sp"></span><button class="btn" onclick="V.go(\'deploys\')">← Geçmiş</button>' +
      (d.status === 'live' ? '<button class="btn" onclick="window.open(\'' + d.url + '\',\'_blank\')">Siteyi aç</button>' : '') +
      (d.status === 'live' ? '<button class="btn" onclick="V.rollback(\'' + d.id + '\')">Bu sürüme dön</button>' : '') + '</div>' +
      '<div class="kpis">' +
      kpi('rocket', 'Durum', esc(d.stageLabel || d.status), (d.progress || 0) + '% tamamlandı', d.progress || 0, '') +
      kpi('box', 'Ortam', esc(d.env || 'production'), 'tetikleyici: ' + esc(d.trigger), 0, '') +
      kpi('clock', 'Süre', d.durationSec ? d.durationSec + ' sn' : '—', ago(d.createdAt), 0, '') +
      kpi('globe', 'Adres', d.url ? esc(d.url.replace('https://', '')) : '—', d.url ? 'SSL aktif' : 'henüz yayınlanmadı', 0, '') + '</div>' +
      '<div style="display:grid;grid-template-columns:280px 1fr;gap:14px;align-items:start">' +
      '<div class="card" style="padding:14px"><b style="font-size:13px;color:var(--dim);letter-spacing:.06em;text-transform:uppercase">Aşamalar</b>' +
      '<div class="stages">' + STAGES.map((s, i) =>
        '<div class="stg ' + (i < idx ? 'done' : i === idx ? 'act' : '') + '"><span class="n">' +
        (i < idx ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M4 12l5 5L20 6"/></svg>' : '') +
        '</span><span>' + STAGE_LBL[s] + '</span></div>').join('') + '</div></div>' +
      '<div class="term2"><div class="bh">' +
      '<span style="width:9px;height:9px;border-radius:50%;background:#ff5f57;display:block"></span>' +
      '<span style="width:9px;height:9px;border-radius:50%;background:#febc2e;display:block"></span>' +
      '<span style="width:9px;height:9px;border-radius:50%;background:#28c840;display:block"></span>' +
      '<span style="margin-left:8px">build logs — ' + esc(d.projectName) + '</span><span class="sp"></span>' +
      '<span>' + (['queued', 'building'].indexOf(d.status) >= 0 ? 'canlı' : 'tamamlandı') + '</span></div>' +
      '<div class="bd" id="logBox">' + (logs.map(l =>
        '<div class="l ' + (l.kind || '') + '"><span class="tm">' + new Date(l.at).toLocaleTimeString('tr-TR', { hour12: false }) + '</span><span>' + esc(l.line) + '</span></div>').join('')
        || '<div class="l"><span>Log bekleniyor...</span></div>') + '</div></div></div>';
    const lb = el('logBox'); if (lb) lb.scrollTop = lb.scrollHeight;
  }
  function pollDeploy(id) {
    clearInterval(S.deployPoll);
    S.deployPoll = setInterval(async () => {
      try {
        const r = await api('/deploys/' + id);
        S.currentDeploy = r.deploy; renderDeploy(r.deploy, r.logs);
        if (['queued', 'building'].indexOf(r.deploy.status) < 0) {
          clearInterval(S.deployPoll);
          toast(r.deploy.status === 'live' ? 'Deploy tamamlandı ✓' : 'Deploy başarısız', r.deploy.status === 'live' ? 'ok' : 'err');
          const d = await api('/deploys'); S.deploys = d.deploys; paintNav();
        }
      } catch (e) { clearInterval(S.deployPoll); }
    }, 900);
  }

  /* ---------- domains / usage / members / keys / events / settings ---------- */
  async function viewDomains(v) {
    const r = await api('/projects');
    const all = [];
    for (const p of r.projects) {
      const d = await api('/projects/' + p.id);
      d.domains.forEach(x => all.push(Object.assign({}, x, { projectName: p.name })));
    }
    v.innerHTML = '<div class="view-head"><div><h1>Alan adları</h1><p>' + all.length + ' alan adı bağlı</p></div></div>' +
      (all.length ? '<div class="tbl-wrap"><table><thead><tr><th>Alan adı</th><th>Proje</th><th>Durum</th><th>SSL</th><th>Eklendi</th><th></th></tr></thead><tbody>' +
        all.map(d => '<tr><td class="mono"><b>' + esc(d.domain) + '</b></td><td style="color:var(--dim)">' + esc(d.projectName) + '</td>' +
          '<td>' + (d.verified ? '<span class="pill ok"><span class="dot"></span>Doğrulandı</span>' : '<span class="pill warn"><span class="dot pulse"></span>Bekliyor</span>') + '</td>' +
          '<td><span class="pill mute">' + esc(d.ssl) + '</span></td><td style="color:var(--faint);font-size:12.5px">' + ago(d.createdAt) + '</td>' +
          '<td class="r">' + (d.verified ? '' : '<button class="btn sm" onclick="V.verifyDomain(\'' + d.id + '\',\'' + d.projectId + '\')">Doğrula</button>') + '</td></tr>').join('') +
        '</tbody></table></div>'
        : '<div class="empty"><div class="ic">🌐</div><h3>Alan adı yok</h3><p>Bir projenin "Alan adları" sekmesinden kendi alan adını bağlayabilirsin.</p></div>');
  }
  async function viewUsage(v) {
    const u = await api('/usage'); S.usage = u;
    const rows = [
      ['Projeler', u.projects.used, u.projects.limit],
      ['Günlük deploy', u.deploys.today, u.deploys.limit],
      ['Toplam deploy', u.deploys.used, '—'],
      ['Bant genişliği (GB)', u.bandwidth.usedGb, u.bandwidth.limitGb],
      ['Ekip koltukları', u.members.used, u.members.limit],
    ];
    v.innerHTML = '<div class="view-head"><div><h1>Kullanım & limitler</h1><p>' + esc(u.plan.name) + ' plan · <span style="color:var(--ok);font-weight:700">tüm özellikler ücretsiz</span></p></div></div>' +
      '<div class="kpis">' +
      kpi('chart', 'Başarı oranı', u.successRate + '%', 'başarılı dağıtım', u.successRate, '') +
      kpi('box', 'Fatura tutarı', '₺0', 'kart bilgisi istenmez', 0, '') +
      kpi('clock', 'Metrik geçmişi', u.plan.metricsDays + ' gün', esc(u.plan.name) + ' plan', 0, '') +
      kpi('rocket', 'Uyku modu', u.plan.sleepAfterMin ? u.plan.sleepAfterMin + ' dk' : 'Kapalı', 'kullanılmayınca uyur', 0, '') + '</div>' +
      '<div class="tbl-wrap"><table><thead><tr><th>Kaynak</th><th>Kullanım</th><th>Limit</th><th style="width:32%">Doluluk</th></tr></thead><tbody>' +
      rows.map(r => {
        const pct = typeof r[2] === 'number' ? Math.min(100, r[1] / r[2] * 100) : 0;
        const cls = pct > 90 ? 'err' : pct > 70 ? 'warn' : '';
        return '<tr><td><b>' + r[0] + '</b></td><td class="mono">' + r[1] + '</td><td class="mono" style="color:var(--faint)">' + r[2] + '</td>' +
          '<td><div class="bar" style="margin:0"><i class="' + cls + '" style="width:' + pct + '%"></i></div></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="card" style="padding:20px;margin-top:16px"><b style="font-size:14.5px">Planlar</b>' +
      '<p style="font-size:13px;color:var(--faint);margin-top:5px">Üç planın da ücreti 0 ₺. Yükseltme tamamen limitlerle ilgilidir, ödeme adımı yoktur.</p>' +
      '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">' +
      ['free', 'pro', 'team'].map(k => '<button class="btn ' + (u.plan.name.toLowerCase() === k ? 'pri' : '') + '" onclick="V.setPlan(\'' + k + '\')">' + k[0].toUpperCase() + k.slice(1) + ' — ₺0</button>').join('') +
      '</div></div>';
  }
  async function viewMembers(v) {
    const r = await api('/members'); S.members = r.members;
    v.innerHTML = '<div class="view-head"><div><h1>Ekip</h1><p>' + r.members.length + ' / ' + r.seats + ' koltuk kullanılıyor</p></div>' +
      '<span class="sp"></span><button class="btn pri" onclick="V.inviteModal()">+ Üye davet et</button></div>' +
      '<div class="tbl-wrap"><table><thead><tr><th>Üye</th><th>E-posta</th><th>Rol</th><th>Durum</th><th>Katıldı</th><th></th></tr></thead><tbody>' +
      r.members.map(m => '<tr><td><div style="display:flex;align-items:center;gap:10px"><span class="av" style="width:28px;height:28px;font-size:11.5px">' + initials(m.name) + '</span><b>' + esc(m.name) + '</b></div></td>' +
        '<td class="mono" style="color:var(--dim)">' + esc(m.email) + '</td>' +
        '<td><span class="pill ' + (m.role === 'owner' ? 'acc' : m.role === 'admin' ? 'ok' : 'mute') + '">' + esc(m.role) + '</span></td>' +
        '<td>' + (m.status === 'invited' ? '<span class="pill warn">Davet edildi</span>' : '<span class="pill ok"><span class="dot"></span>Aktif</span>') + '</td>' +
        '<td style="color:var(--faint);font-size:12.5px">' + ago(m.joinedAt || m.invitedAt) + '</td>' +
        '<td class="r">' + (m.role === 'owner' ? '' : '<button class="btn sm danger" onclick="V.delMember(\'' + m.id + '\')">Kaldır</button>') + '</td></tr>').join('') +
      '</tbody></table></div>';
  }
  async function viewKeys(v) {
    const r = await api('/apikeys'); S.keys = r.keys;
    v.innerHTML = '<div class="view-head"><div><h1>API anahtarları</h1><p>CI/CD ve otomasyon için kişisel erişim anahtarları</p></div>' +
      '<span class="sp"></span><button class="btn pri" onclick="V.newKeyModal()">+ Anahtar oluştur</button></div>' +
      (S.keys.length ? '<div class="tbl-wrap"><table><thead><tr><th>Ad</th><th>Anahtar</th><th>Kapsam</th><th>Oluşturuldu</th><th></th></tr></thead><tbody>' +
        S.keys.map(k => '<tr><td><b>' + esc(k.name) + '</b></td><td class="mono" style="color:var(--dim)">' + esc(k.token) + '</td>' +
          '<td><span class="pill mute">' + esc(k.scope) + '</span></td><td style="color:var(--faint);font-size:12.5px">' + ago(k.createdAt) + '</td>' +
          '<td class="r"><button class="btn sm danger" onclick="V.delKey(\'' + k.id + '\')">Sil</button></td></tr>').join('') + '</tbody></table></div>'
        : '<div class="empty"><div class="ic">🔑</div><h3>Anahtar yok</h3><p>Bir API anahtarı oluştur ve dağıtımlarını kendi hattından tetikle.</p><button class="btn pri" onclick="V.newKeyModal()">Anahtar oluştur</button></div>') +
      '<div class="card" style="padding:20px;margin-top:16px"><b style="font-size:14.5px">Hızlı örnek</b>' +
      '<pre class="mono" style="margin-top:12px;padding:14px;border-radius:10px;background:var(--bg2);border:1px solid var(--hair);font-size:12.5px;overflow:auto;color:var(--dim)">curl -X POST https://vapor.app/api/projects/PROJE_ID/deploy \\\n  -H "Authorization: Bearer vap_..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"branch":"main"}\'</pre></div>';
  }
  const EV_LBL = {
    'deploy.started': ['🚀', 'Deploy başlatıldı'], 'deploy.live': ['✅', 'Yayına alındı'],
    'project.created': ['📦', 'Proje oluşturuldu'], 'project.deleted': ['🗑️', 'Proje silindi'],
    'member.invited': ['👤', 'Üye davet edildi'], 'domain.verified': ['🌐', 'Alan adı doğrulandı'],
    'user.created': ['🎉', 'Hesap oluşturuldu'],
  };
  async function viewEvents(v) {
    const r = await api('/events'); S.events = r.events;
    v.innerHTML = '<div class="view-head"><div><h1>Aktiviteler</h1><p>Hesabındaki son olaylar</p></div></div>' +
      '<div class="tbl-wrap">' + (S.events.length ? S.events.map(e => {
        const l = EV_LBL[e.type] || ['•', e.type];
        const pl = Object.keys(e.payload || {}).map(k => k + ': ' + e.payload[k]).join(' · ');
        return '<div class="evrow"><span class="ic">' + l[0] + '</span><div style="flex:1"><b>' + l[1] + '</b>' +
          (pl ? '<div style="color:var(--dim);font-size:12.5px;margin-top:2px">' + esc(pl) + '</div>' : '') +
          '<div class="tm">' + ago(e.at) + '</div></div></div>';
      }).join('') : '<div class="empty" style="border:0;padding:40px"><p>Henüz aktivite yok.</p></div>') + '</div>';
  }
  async function viewSettings(v) {
    v.innerHTML = '<div class="view-head"><div><h1>Ayarlar</h1><p>Hesap bilgileri ve tercihler</p></div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;align-items:start">' +
      '<div class="card" style="padding:22px"><b style="font-size:14.5px">Profil</b><div style="margin-top:16px">' +
      '<div class="field"><label>Ad Soyad</label><input id="setName" value="' + esc(S.user.name || '') + '" /></div>' +
      '<div class="field"><label>E-posta</label><input value="' + esc(S.user.email) + '" disabled style="opacity:.6" /></div>' +
      '<button class="btn pri" onclick="V.saveProfile()">Kaydet</button></div></div>' +
      '<div class="card" style="padding:22px"><b style="font-size:14.5px">Plan</b>' +
      '<p style="font-size:13px;color:var(--faint);margin-top:6px">Şu an: <b style="color:var(--ok)">' + esc(S.plan.name) + ' — ₺0/ay</b></p>' +
      '<div style="display:flex;gap:9px;margin-top:14px;flex-wrap:wrap">' +
      ['free', 'pro', 'team'].map(k => '<button class="btn ' + (S.plan.name.toLowerCase() === k ? 'pri' : '') + '" onclick="V.setPlan(\'' + k + '\')">' + k[0].toUpperCase() + k.slice(1) + ' — ₺0</button>').join('') + '</div></div>' +
      '<div class="card" style="padding:22px"><b style="font-size:14.5px">Görünüm</b>' +
      '<p style="font-size:13px;color:var(--faint);margin-top:6px">Karanlık ve aydınlık tema arasında geçiş yap.</p>' +
      '<button class="btn" style="margin-top:14px" onclick="V.toggleTheme()">Temayı değiştir</button></div>' +
      '<div class="card" style="padding:22px"><b style="font-size:14.5px">Oturum</b>' +
      '<p style="font-size:13px;color:var(--faint);margin-top:6px">Bu cihazdaki oturumu kapat.</p>' +
      '<button class="btn danger" style="margin-top:14px" onclick="V.logout()">Çıkış yap</button></div></div>';
  }

  /* =========================================================
     MODAL + EYLEMLER
     ========================================================= */
  function modal(title, body, footer) {
    el('modal').innerHTML = '<div class="mh"><h3>' + title + '</h3><button class="btn icon" onclick="V.closeModal()">✕</button></div>' +
      '<div class="mb">' + body + '</div><div class="mf">' + footer + '</div>';
    el('overlay').classList.add('on');
  }
  function closeModal() { el('overlay').classList.remove('on'); }
  el('overlay').onclick = e => { if (e.target === el('overlay')) closeModal(); };

  function newProjectModal() {
    modal('Yeni proje',
      '<div class="field"><label>Proje adı</label><input id="npName" placeholder="uygulamam" /></div>' +
      '<div class="field"><label>Depo</label><input id="npRepo" class="mono" placeholder="github.com/kullanici/depo" /><small>Boş bırakırsan örnek adres oluşturulur.</small></div>' +
      '<div class="two"><div class="field"><label>Framework</label><select id="npFw">' +
      Object.keys(FW_ICON).map(f => '<option>' + f + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Dal</label><input id="npBr" value="main" class="mono" /></div></div>' +
      '<div class="two"><div class="field"><label>Build komutu</label><input id="npBuild" value="npm run build" class="mono" /></div>' +
      '<div class="field"><label>Port</label><input id="npPort" type="number" value="3000" /></div></div>',
      '<button class="btn" onclick="V.closeModal()">Vazgeç</button><button class="btn pri" onclick="V.createProject()">Proje oluştur</button>');
    setTimeout(() => { const n = el('npName'); if (n) n.focus(); }, 60);
  }
  async function createProject() {
    try {
      const r = await api('/projects', {
        method: 'POST', body: {
          name: el('npName').value.trim() || 'yeni-proje',
          repo: el('npRepo').value.trim() || undefined,
          framework: el('npFw').value, branch: el('npBr').value.trim() || 'main',
          buildCmd: el('npBuild').value.trim(), port: parseInt(el('npPort').value, 10) || 3000,
        },
      });
      closeModal(); toast('Proje oluşturuldu ✓');
      S.current = await api('/projects/' + r.project.id);
      S.route = 'project'; paintNav(); paintCrumb(); paintView();
      setTimeout(() => deploy(r.project.id), 400);
    } catch (e) { toast(e.message, 'err'); }
  }
  async function deploy(projectId) {
    try {
      const r = await api('/projects/' + projectId + '/deploy', { method: 'POST', body: { trigger: 'manual' } });
      toast('Deploy başlatıldı 🚀');
      openDeploy(r.deploy.id);
    } catch (e) { toast(e.message, 'err'); }
  }
  async function rollback(deployId) {
    try { const r = await api('/deploys/' + deployId + '/rollback', { method: 'POST' }); toast('Rollback başlatıldı'); openDeploy(r.deploy.id); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function saveProject(id) {
    try {
      await api('/projects/' + id, {
        method: 'PATCH', body: {
          name: el('sName').value.trim(), repo: el('sRepo').value.trim(), framework: el('sFw').value,
          branch: el('sBr').value.trim(), buildCmd: el('sBuild').value.trim(), startCmd: el('sStart').value.trim(),
          port: parseInt(el('sPort').value, 10) || 3000, region: el('sRegion').value,
        },
      });
      S.current = await api('/projects/' + id);
      toast('Kaydedildi ✓'); paintView();
    } catch (e) { toast(e.message, 'err'); }
  }
  function deleteProject(id) {
    modal('Projeyi sil', '<p style="font-size:14px;color:var(--dim);line-height:1.7">Bu proje ve tüm deploy kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>',
      '<button class="btn" onclick="V.closeModal()">Vazgeç</button><button class="btn danger" onclick="V.confirmDeleteProject(\'' + id + '\')">Evet, sil</button>');
  }
  async function confirmDeleteProject(id) {
    try { await api('/projects/' + id, { method: 'DELETE' }); closeModal(); toast('Proje silindi'); go('projects'); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function addEnv(projectId) {
    const key = el('envK').value.trim();
    if (!key) return toast('Anahtar gerekli', 'err');
    try {
      await api('/projects/' + projectId + '/env', { method: 'POST', body: { key, value: el('envV').value, secret: el('envS').checked, env: el('envE').value } });
      S.current = await api('/projects/' + projectId); toast('Değişken eklendi ✓'); paintTab('env');
    } catch (e) { toast(e.message, 'err'); }
  }
  async function delEnv(id, projectId) {
    try { await api('/env/' + id, { method: 'DELETE' }); S.current = await api('/projects/' + projectId); toast('Silindi'); paintTab('env'); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function addDomain(projectId) {
    const d = el('domIn').value.trim();
    if (!d) return toast('Alan adı gerekli', 'err');
    try { await api('/projects/' + projectId + '/domains', { method: 'POST', body: { domain: d } }); S.current = await api('/projects/' + projectId); toast('Alan adı eklendi'); paintTab('domains'); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function verifyDomain(id, projectId) {
    try { await api('/domains/' + id + '/verify', { method: 'POST' }); S.current = await api('/projects/' + projectId); toast('Alan adı doğrulandı ✓'); paintTab('domains'); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function delDomain(id, projectId) {
    try { await api('/domains/' + id, { method: 'DELETE' }); S.current = await api('/projects/' + projectId); toast('Kaldırıldı'); paintTab('domains'); }
    catch (e) { toast(e.message, 'err'); }
  }
  function inviteModal() {
    modal('Üye davet et',
      '<div class="field"><label>E-posta</label><input id="invEmail" placeholder="arkadas@ornek.com" /></div>' +
      '<div class="field"><label>Rol</label><select id="invRole"><option value="developer">developer</option><option value="admin">admin</option><option value="viewer">viewer</option></select></div>',
      '<button class="btn" onclick="V.closeModal()">Vazgeç</button><button class="btn pri" onclick="V.sendInvite()">Davet gönder</button>');
  }
  async function sendInvite() {
    try {
      await api('/members', { method: 'POST', body: { email: el('invEmail').value.trim(), role: el('invRole').value } });
      closeModal(); toast('Davet gönderildi ✓'); paintView();
    } catch (e) { toast(e.message, 'err'); }
  }
  async function delMember(id) {
    try { await api('/members/' + id, { method: 'DELETE' }); toast('Üye kaldırıldı'); paintView(); }
    catch (e) { toast(e.message, 'err'); }
  }
  function newKeyModal() {
    modal('API anahtarı oluştur',
      '<div class="field"><label>Anahtar adı</label><input id="keyName" placeholder="CI deploy" /></div>' +
      '<div class="field"><label>Kapsam</label><select id="keyScope"><option value="full">full</option><option value="deploy">deploy</option><option value="read">read</option></select></div>' +
      '<p style="font-size:12.5px;color:var(--faint);line-height:1.6">Anahtar yalnızca oluşturulduğunda tam olarak gösterilir. Güvenli bir yere kaydet.</p>',
      '<button class="btn" onclick="V.closeModal()">Vazgeç</button><button class="btn pri" onclick="V.createKey()">Oluştur</button>');
  }
  async function createKey() {
    try {
      const r = await api('/apikeys', { method: 'POST', body: { name: el('keyName').value.trim() || 'Varsayılan', scope: el('keyScope').value } });
      modal('Anahtarın hazır 🔑',
        '<p style="font-size:13.5px;color:var(--dim);line-height:1.7;margin-bottom:14px">Bu anahtarı şimdi kopyala — bir daha tam olarak gösterilmeyecek.</p>' +
        '<div class="mono" style="padding:14px;border-radius:10px;background:var(--bg2);border:1px solid var(--hair2);font-size:12.5px;word-break:break-all">' + esc(r.key.token) + '</div>',
        '<button class="btn pri" onclick="V.closeModal();V.go(\'keys\')">Anladım</button>');
    } catch (e) { toast(e.message, 'err'); }
  }
  async function delKey(id) {
    try { await api('/apikeys/' + id, { method: 'DELETE' }); toast('Anahtar silindi'); paintView(); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function setPlan(k) {
    try { const r = await api('/auth/me', { method: 'PATCH', body: { plan: k } }); S.plan = r.user && null; S.plan = (await api('/auth/me')).plan; paintUser(); toast(k.toUpperCase() + ' planı aktif — ₺0'); paintView(); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function saveProfile() {
    try { const r = await api('/auth/me', { method: 'PATCH', body: { name: el('setName').value.trim() } }); S.user = r.user; paintUser(); toast('Profil güncellendi ✓'); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function seedDemo() {
    try { const r = await api('/demo/seed', { method: 'POST' }); toast(r.projects + ' proje eklendi ✓'); go('projects'); }
    catch (e) { toast(e.message, 'err'); }
  }

  /* =========================================================
     KOMUT PALETİ
     ========================================================= */
  const COMMANDS = [
    { t: 'Genel bakış', i: 'box', k: 'dashboard' },
    { t: 'Projeler', i: 'rocket', k: 'projects' },
    { t: 'Deploy geçmişi', i: 'clock', k: 'deploys' },
    { t: 'Alan adları', i: 'globe', k: 'domains' },
    { t: 'Kullanım & limitler', i: 'chart', k: 'usage' },
    { t: 'Ekip', i: 'users', k: 'members' },
    { t: 'API anahtarları', i: 'key', k: 'keys' },
    { t: 'Aktiviteler', i: 'bell', k: 'events' },
    { t: 'Ayarlar', i: 'gear', k: 'settings' },
    { t: 'Yeni proje oluştur', i: 'rocket', a: 'V.newProjectModal()' },
    { t: 'Örnek veri ekle', i: 'box', a: 'V.seedDemo()' },
    { t: 'Temayı değiştir', i: 'gear', a: 'V.toggleTheme()' },
    { t: 'Çıkış yap', i: 'gear', a: 'V.logout()' },
  ];
  function cmdk(open) {
    el('cmdk').classList.toggle('on', open);
    if (open) { el('cmdkInput').value = ''; cmdkFilter(''); setTimeout(() => el('cmdkInput').focus(), 60); }
  }
  function cmdkFilter(q) {
    q = (q || '').toLowerCase();
    const hits = COMMANDS.filter(c => c.t.toLowerCase().indexOf(q) >= 0);
    const list = el('cmdkList');
    list.innerHTML = hits.length ? hits.map((c, i) =>
      '<div class="cmdk-it ' + (i === 0 ? 'sel' : '') + '" onclick="V.runCmd(' + COMMANDS.indexOf(c) + ')">' + svg(c.i) +
      '<span class="sp">' + c.t + '</span>' + (c.k ? '<kbd>git</kbd>' : '') + '</div>').join('')
      : '<div class="cmdk-empty">Sonuç bulunamadı</div>';
  }
  function runCmd(idx) {
    const c = COMMANDS[idx]; if (!c) return;
    cmdk(false);
    if (c.a) { (new Function(c.a))(); } else { go(c.k); }
  }
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk(!el('cmdk').classList.contains('on')); }
    if (e.key === 'Escape') { cmdk(false); closeModal(); }
    if (e.key === 'Enter' && el('cmdk').classList.contains('on')) { const sel = document.querySelector('.cmdk-it.sel'); if (sel) sel.click(); }
  });

  /* =========================================================
     BAŞLAT
     ========================================================= */
  async function boot() {
    if (localStorage.getItem('vapor_theme') === 'light') document.documentElement.setAttribute('data-theme', 'light');
    if (!S.token) { el('landing').hidden = false; return; }
    try {
      const me = await api('/auth/me');
      S.user = me.user; S.plan = me.plan;
      el('landing').hidden = true; el('auth').hidden = true; el('app').hidden = false;
      paintUser(); paintNav(); paintCrumb();
      await paintView();
      toast('Hoş geldin ' + (S.user.name || S.user.email) + ' 👋');
    } catch (e) {
      localStorage.removeItem('vapor_token'); S.token = null;
      el('landing').hidden = false; el('app').hidden = true;
    }
  }

  paintLanding();
  demoTerminal();
  boot();

  return {
    openAuth, backToLanding, go, logout, toggleSide, toggleTheme, closeModal,
    newProjectModal, createProject, deploy, rollback, saveProject, deleteProject, confirmDeleteProject,
    addEnv, delEnv, addDomain, verifyDomain, delDomain, inviteModal, sendInvite, delMember,
    newKeyModal, createKey, delKey, setPlan, saveProfile, seedDemo, openDeploy,
    cmdk, cmdkFilter, runCmd,
  };
})();
