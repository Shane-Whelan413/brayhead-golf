// ── Supabase config ──────────────────────────────────────────────────────
const SUPABASE_URL = 'https://vlpfqavpwwhpflamujcp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rWKTQbAjJNir43JJ_HDjRw_u2DclJtd';

const api = async (path, opts={}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation',
      ...opts.headers
    },
    ...opts
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
};
const get  = p     => api(p, { method:'GET', prefer:'', cache:'no-store' });
const post = (p,b) => api(p, { method:'POST', body:JSON.stringify(b) });
const patch= (p,b) => api(p, { method:'PATCH', body:JSON.stringify(b), prefer:'return=representation' });
const del  = p     => api(p, { method:'DELETE', prefer:'return=minimal' });

// ── Shared state ─────────────────────────────────────────────────────────
let db = { players:[], events:[], rounds:[], noticeboard:[], knockout_matches:[] };
let isAdmin = false;
let currentUser = null;
const ADMIN_PW = 'BHGS2026!';

// ── Season / outing constants ─────────────────────────────────────────────
const LEAGUE_PTS = pos => pos <= 1 ? 20 : Math.max(6, 21 - pos);

const OUTINGS = {
  '2026-04-18': 'Silloge Park',
  '2026-05-16': 'Coolattin',
  '2026-06-13': 'Courtown',
  '2026-07-11': 'Grange Castle',
  '2026-08-09': 'Knightsbrook (Captains Day)',
  '2026-09-06': 'Moyvalley',
  '2026-10-24': 'Arklow',
};

const OUTING_COURSES = {
  'Silloge Park': { cr:35.2, slope:117, par:70, wcr:36.0, wslope:120, wpar:70, pars:[4,3,4,4,4,5,3,4,4,4,3,4,4,4,5,3,4,4], wpars:[4,3,4,4,4,5,3,4,4,4,3,4,4,4,5,3,4,4], si:[3,17,7,11,1,9,15,5,13,4,18,8,12,2,10,16,6,14], wsi:[3,17,7,11,1,9,15,5,13,4,18,8,12,2,10,16,6,14] },
  'Coolattin':   { cr:71.4, slope:130, par:72, wcr:73.0, wslope:133, wpar:72, pars:[4,4,3,4,5,4,3,4,4,4,4,3,5,4,4,3,5,4], wpars:[4,4,3,4,5,4,3,4,4,4,4,3,5,4,4,3,5,4], si:[5,13,17,1,11,3,15,9,7,6,14,18,2,12,4,16,10,8], wsi:[5,13,17,1,11,3,15,9,7,6,14,18,2,12,4,16,10,8] },
  'Courtown':    { cr:70.8, slope:125, par:72, wcr:72.0, wslope:128, wpar:72, pars:[5,4,3,4,4,4,3,4,5,4,4,3,4,5,4,3,4,4], wpars:[5,4,3,4,4,4,3,4,5,4,4,3,4,5,4,3,4,4], si:[9,3,17,5,11,1,15,7,13,8,4,18,6,12,2,16,10,14], wsi:[9,3,17,5,11,1,15,7,13,8,4,18,6,12,2,16,10,14] },
  'Grange Castle': { cr:70.0, slope:122, par:72, wcr:71.5, wslope:125, wpar:72, pars:[4,4,4,3,5,4,3,4,5,4,3,5,4,4,5,3,4,4], wpars:[4,4,4,3,5,4,3,4,5,4,3,5,4,4,5,3,4,4], si:[7,3,11,17,1,13,15,5,9,8,18,2,12,6,4,16,10,14], wsi:[7,3,11,17,1,13,15,5,9,8,18,2,12,6,4,16,10,14] },
  'Knightsbrook (Captains Day)': { cr:71.2, slope:130, par:72, wcr:72.5, wslope:133, wpar:72, pars:[4,4,3,5,4,4,3,4,5,4,3,4,4,5,4,3,5,4], wpars:[4,4,3,5,4,4,3,4,5,4,3,4,4,5,4,3,5,4], si:[7,3,17,1,13,5,15,9,11,8,18,4,12,2,6,16,10,14], wsi:[7,3,17,1,13,5,15,9,11,8,18,4,12,2,6,16,10,14] },
  'Moyvalley':   { cr:71.0, slope:128, par:72, wcr:72.5, wslope:131, wpar:72, pars:[4,5,3,4,4,4,3,5,4,4,4,3,4,5,4,3,5,4], wpars:[4,5,3,4,4,4,3,5,4,4,4,3,4,5,4,3,5,4], si:[11,1,17,5,9,3,15,7,13,10,2,18,6,8,4,16,12,14], wsi:[11,1,17,5,9,3,15,7,13,10,2,18,6,8,4,16,12,14] },
  'Arklow':      { cr:70.5, slope:124, par:72, wcr:72.0, wslope:127, wpar:72, pars:[4,3,4,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5], wpars:[4,3,4,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5], si:[9,17,5,1,13,3,15,7,11,10,6,18,2,14,4,16,8,12], wsi:[9,17,5,1,13,3,15,7,11,10,6,18,2,14,4,16,8,12] },
};

// ── Season date helpers ───────────────────────────────────────────────────
function getSeasonDates() {
  const satOutings = {}, sunOutings = {};
  for (const [d, name] of Object.entries(OUTINGS)) {
    const dt = new Date(...d.split('-').map((v,i)=>i===1?v-1:+v));
    if (dt.getDay() === 6) satOutings[d] = name;
    else sunOutings[d] = name;
  }
  const skipSundays = new Set(
    Object.keys(satOutings).map(d => {
      const dt = new Date(...d.split('-').map((v,i)=>i===1?v-1:+v));
      dt.setDate(dt.getDate()+1);
      return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    })
  );
  const dates = [];
  let y=2026, m=3, day=22;
  const end = new Date(2026,10,29);
  while (true) {
    const dt = new Date(y, m-1, day);
    if (dt > end) break;
    const iso = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if (skipSundays.has(iso)) {
      const sat = new Date(y,m-1,day-1);
      const satIso = `${sat.getFullYear()}-${String(sat.getMonth()+1).padStart(2,'0')}-${String(sat.getDate()).padStart(2,'0')}`;
      dates.push({ date: satIso, isOuting: true, course: satOutings[satIso] });
    } else if (sunOutings[iso]) {
      dates.push({ date: iso, isOuting: true, course: sunOutings[iso] });
    } else {
      dates.push({ date: iso, isOuting: false, course: null });
    }
    day += 7;
    const next = new Date(y, m-1, day);
    y = next.getFullYear(); m = next.getMonth()+1; day = next.getDate();
  }
  return dates;
}

function getSundays() { return getSeasonDates().map(e => e.date); }

// ── Handicap / scoring helpers ────────────────────────────────────────────
function calcStableford(score, par, allowance) { return Math.max(0, par - (score - allowance) + 2); }
function calcCourseHcp(idx) { return Math.round(idx); }

function calcNewHcp(hcpIdx, totalPts, position) {
  if (totalPts >= 18) return Math.max(0, parseFloat((hcpIdx - 1).toFixed(1)));
  else if (position && position <= 3) return hcpIdx;
  else return Math.min(54, parseFloat((hcpIdx + 0.2).toFixed(1)));
}

function calcNewHcpOuting(hcpIdx, totalPts, position) {
  if (position === 1) return Math.max(0, parseFloat((hcpIdx - 1).toFixed(1)));
  if (position === 2) return Math.max(0, parseFloat((hcpIdx - 0.5).toFixed(1)));
  if (position === 3) return Math.max(0, parseFloat((hcpIdx - 0.3).toFixed(1)));
  if (totalPts >= 37) return Math.max(0, parseFloat((hcpIdx - 1).toFixed(1)));
  return Math.min(54, parseFloat((hcpIdx + 0.2).toFixed(1)));
}

function getPreviousOutingWinnerId() {
  const outings = db.events.filter(e => e.event_type === 'outing_18' && e.published).sort((a,b) => b.event_date.localeCompare(a.event_date));
  if (!outings.length) return null;
  const outingRounds = db.rounds.filter(r => r.event_id === outings[0].id && r.verified);
  if (!outingRounds.length) return null;
  return assignLeaguePts(outingRounds.map(r=>({...r})))[0]?.player_id || null;
}

function calcOutingCourseHcp(hcpIdx, slope, cr, par, playerId) {
  const base = calcCourseHcp(hcpIdx) * 2;
  const prevWinner = getPreviousOutingWinnerId();
  return (prevWinner && prevWinner === playerId) ? base : base + 2;
}

function getStrokeAllowance(courseHcp, siValue, n) {
  const fullStrokes = Math.floor(Math.abs(courseHcp) / n);
  const extraHoles  = Math.abs(courseHcp) % n;
  const base  = courseHcp >= 0 ? fullStrokes : -fullStrokes;
  const extra = courseHcp >= 0 ? (siValue <= extraHoles ? 1 : 0) : (siValue <= extraHoles ? -1 : 0);
  return base + extra;
}

function getSIValues(n, ev, player) {
  const isWomens = player && player.plays_womens_index;
  if (isWomens && ev?.womens_stroke_index?.length >= n) return ev.womens_stroke_index;
  if (ev?.stroke_index?.length >= n) return ev.stroke_index;
  return Array.from({length:n}, (_,i) => i+1);
}

function getParValues(n, ev, player) {
  const isWomens = player && player.plays_womens_index;
  if (isWomens && ev?.womens_par_values?.length >= n) return ev.womens_par_values;
  if (ev?.par_values?.length >= n) return ev.par_values;
  return Array.from({length:n}, () => 4);
}

function getCourseIndexForPlayer(player, ev) {
  const isWomens = player && player.plays_womens_index;
  if (isWomens && ev.womens_course_rating && ev.womens_slope_rating && ev.womens_par) {
    return { cr: parseFloat(ev.womens_course_rating), slope: parseInt(ev.womens_slope_rating), par: parseInt(ev.womens_par) };
  }
  const n = ev.event_type==='outing_18' ? 18 : 9;
  return { cr: parseFloat(ev.course_rating)||35, slope: parseInt(ev.slope_rating)||113, par: parseInt(ev.par)||(n===9?36:72) };
}

function calcHolePts(r, holeIndex) {
  try {
    if (!r.hole_scores || r.hole_scores[holeIndex] == null) return 0;
    const ev = db.events.find(e=>e.id===r.event_id);
    const pl = db.players.find(x=>x.id===r.player_id);
    if (!ev) return 0;
    const n = ev.event_type==='outing_18' ? 18 : 9;
    const siVals  = getSIValues(n, ev, pl);
    const parVals = getParValues(n, ev, pl);
    const courseHcp = parseFloat(r.course_handicap) || 0;
    return calcStableford(r.hole_scores[holeIndex], parVals[holeIndex], getStrokeAllowance(courseHcp, siVals[holeIndex], n));
  } catch(e) { return 0; }
}

function tiebreakerCompare(a, b) {
  const ev = db.events.find(e=>e.id===a.event_id);
  if (!ev) return 0;
  const n = ev.event_type==='outing_18' ? 18 : 9;
  let aLast=0, bLast=0;
  for (let i=n-3; i<n; i++) { aLast += calcHolePts(a,i); bLast += calcHolePts(b,i); }
  if (aLast !== bLast) return bLast - aLast;
  for (let i=n-4; i>=0; i--) {
    const aH = calcHolePts(a,i), bH = calcHolePts(b,i);
    if (aH !== bH) return bH - aH;
  }
  return 0;
}

function assignLeaguePts(rounds) {
  const sorted = [...rounds].sort((a,b) => {
    if (b.stableford_points !== a.stableford_points) return b.stableford_points - a.stableford_points;
    return tiebreakerCompare(a, b);
  });
  sorted.forEach((r,i) => { r._lp = LEAGUE_PTS(i+1); });
  return sorted;
}

function calcBestHalf(rounds, half, excludePlayerIds) {
  const start = half === 'front' ? 0 : 9;
  const end   = half === 'front' ? 9 : 18;
  const eligible = excludePlayerIds ? rounds.filter(r => !excludePlayerIds.has(r.player_id)) : rounds;
  const totals = eligible.map(r => {
    let pts = 0;
    for (let i = start; i < end; i++) pts += calcHolePts(r, i);
    return { r, pts };
  });
  totals.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    let aLast=0, bLast=0;
    for (let i=end-3; i<end; i++) { aLast+=calcHolePts(a.r,i); bLast+=calcHolePts(b.r,i); }
    if (aLast !== bLast) return bLast - aLast;
    for (let i=end-4; i>=start; i--) {
      const aH=calcHolePts(a.r,i), bH=calcHolePts(b.r,i);
      if (aH!==bH) return bH-aH;
    }
    return 0;
  });
  if (!totals.length) return null;
  const player = db.players.find(p => p.id === totals[0].r.player_id);
  return { name: player ? player.name : '?', pts: totals[0].pts };
}

// ── UI helpers ────────────────────────────────────────────────────────────
function initials(n) { return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }

function avatarHtml(player, size=44, fontSize=14) {
  if (player && player.avatar_url) {
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#0a1628">
      <img src="${player.avatar_url}" style="width:100%;height:100%;object-fit:cover" loading="lazy"
        onerror="this.parentElement.innerHTML='<span style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:${Math.round(fontSize)}px;font-weight:700;color:#C9A84C\\'>${initials(player.name)}</span>'" />
    </div>`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#0a1628;color:#C9A84C;font-size:${fontSize}px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials(player.name)}</div>`;
}

function fmtDate(d) {
  const [y,m,day] = d.split('-').map(Number);
  return new Date(y, m-1, day).toLocaleDateString('en-IE',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}

function toast(msg, type='') {
  const wrap = document.getElementById('toasts');
  const el   = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  requestAnimationFrame(()=>{ el.classList.add('show'); });
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(), 400); }, 3200);
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
function maybeCloseModal(e) { if (e.target===document.getElementById('modal-overlay')) closeModal(); }

// ── Leaderboard positions (shared — used by leaderboard + profile) ────────
function getLeaderboardPositions(publishedEids) {
  if (!publishedEids) publishedEids = new Set(db.events.filter(e=>e.published).map(e=>e.id));
  const byEvent = {};
  for (const r of db.rounds.filter(x=>x.verified && publishedEids.has(x.event_id))) {
    if (!byEvent[r.event_id]) byEvent[r.event_id]=[];
    byEvent[r.event_id].push({...r});
  }
  for (const eid in byEvent) assignLeaguePts(byEvent[eid]);
  const allPlayerRounds = {};
  for (const eid in byEvent) {
    for (const r of byEvent[eid]) {
      if (!allPlayerRounds[r.player_id]) allPlayerRounds[r.player_id]=[];
      allPlayerRounds[r.player_id].push(r);
    }
  }
  const totals = {};
  for (const pid in allPlayerRounds) {
    totals[pid] = allPlayerRounds[pid].sort((a,b)=>b._lp-a._lp).slice(0,33).reduce((s,r)=>s+r._lp, 0);
  }
  const sorted = db.players.map(p=>({ id:p.id, lp:totals[p.id]||0 })).sort((a,b)=>b.lp-a.lp);
  const positions = {};
  let pos = 1;
  for (let i=0; i<sorted.length; i++) {
    if (i > 0 && sorted[i].lp < sorted[i-1].lp) pos = i + 1;
    positions[sorted[i].id] = { pos, lp: sorted[i].lp };
  }
  return positions;
}

// ── Data loader ───────────────────────────────────────────────────────────
async function loadAll() {
  const safeGet = async (path) => {
    try { return await get(path); } catch(e) { console.error('safeGet error:', path, e.message); return []; }
  };
  try {
    const [players, events, rounds, noticeboard, knockout_matches] = await Promise.all([
      safeGet('players?order=name'),
      safeGet('events?order=event_date'),
      safeGet('rounds?order=created_at'),
      safeGet('noticeboard?order=created_at.desc'),
      safeGet('knockout_matches?order=round,match_number')
    ]);
    db.players          = players          || [];
    db.events           = events           || [];
    db.rounds           = rounds           || [];
    db.noticeboard      = noticeboard      || [];
    db.knockout_matches = knockout_matches || [];
    const pill = document.getElementById('conn-pill');
    pill.textContent = 'Connected'; pill.className = 'conn-pill ok';
  } catch(e) {
    console.error('loadAll error:', e.message);
    const pill = document.getElementById('conn-pill');
    pill.textContent = 'Offline'; pill.className = 'conn-pill err';
  }
}

// ── Saved courses (localStorage) ──────────────────────────────────────────
function getSavedCourses() {
  try { return JSON.parse(localStorage.getItem('bhgs_saved_courses') || '[]'); } catch(e) { return []; }
}
function setSavedCourses(courses) {
  try { localStorage.setItem('bhgs_saved_courses', JSON.stringify(courses)); } catch(e) {}
}

// ── Session management ────────────────────────────────────────────────────
function getStoredSession() {
  try { return JSON.parse(localStorage.getItem('bhgs_session')||'null'); } catch(e){ return null; }
}
function storeSession(s) { try { localStorage.setItem('bhgs_session', JSON.stringify(s)); } catch(e){} }
function clearSession()  { try { localStorage.removeItem('bhgs_session'); } catch(e){} }

// ── Anthropic API key (for scanner) ──────────────────────────────────────
function getAnthropicKey() { return localStorage.getItem('bhgs_anthropic_key') || ''; }
function saveAnthropicKey(key) { localStorage.setItem('bhgs_anthropic_key', key.trim()); }
function openApiKeyModal() {
  const current = getAnthropicKey();
  const msg = current ? `Current key: ...${current.slice(-8)}\n\nPaste a new key to replace it:` : 'Paste your Anthropic API key (starts with sk-ant-):';
  const key = prompt(msg, '');
  if (key === null || key === '') return;
  if (key.startsWith('sk-ant-')) { saveAnthropicKey(key); toast('API key saved', 'success'); }
  else toast('Invalid — key should start with sk-ant-', 'error');
}

// ── renderAll + tab switching ─────────────────────────────────────────────
function safeRender(fn) { try { fn(); } catch(e) { console.error('Render error in', fn.name, ':', e.message); } }

function renderAll() {
  safeRender(renderHome);
  safeRender(renderLeaderboard);
  safeRender(renderProfile);
  safeRender(renderPlayers);
  safeRender(renderEvents);
  safeRender(renderAddRound);
  safeRender(renderSchedule);
  safeRender(renderKnockout);
}

function showTab(name) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  const tabs = ['home','leaderboard','add-round','profile','schedule'];
  const i = tabs.indexOf(name);
  if (i>=0) document.querySelectorAll('.nav-btn')[i].classList.add('active');
  const arEl = document.getElementById('add-round');
  if (arEl) arEl.style.display = name === 'add-round' ? 'flex' : 'none';
  const arSaveBar = document.getElementById('ar-save-bar');
  if (arSaveBar) arSaveBar.style.display = name === 'add-round' ? 'block' : 'none';
  if (name === 'profile')  safeRender(renderProfile);
  if (name === 'add-round') safeRender(renderAddRound);
  if (name === 'knockout') safeRender(renderKnockout);
  if (name === 'events')   renderSavedCourseDropdown();
}

function onFabClick() {
  const role = currentUser ? currentUser.role : 'viewer';
  if (role === 'viewer' || !currentUser) { toast('Log in as a member to add a round', 'error'); return; }
  showTab('add-round');
}

// ── Avatar upload ─────────────────────────────────────────────────────────
function triggerAvatarUpload(pid) {
  const input = document.getElementById('avatar-upload-input');
  if (input) input.click();
}

async function uploadAvatar(input, pid) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Please choose an image file', 'error'); input.value=''; return; }
  toast('Processing photo…', 'success');
  try {
    const compressed = await compressImage(file, 200, 0.7);
    const path = `${pid}.jpg`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
      body: compressed
    });
    if (!res.ok) { const t = await res.text(); throw new Error(t); }
    const avatarUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`;
    await patch(`players?id=eq.${pid}`, { avatar_url: avatarUrl });
    toast('Photo updated!', 'success');
    await loadAll(); renderAll();
  } catch(e) { toast('Upload failed — please try again', 'error'); }
  input.value = '';
}

function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      canvas.width = maxSize; canvas.height = maxSize;
      canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
      canvas.toBlob(blob => { if (!blob) { reject(new Error('Compression failed')); return; } resolve(blob); }, 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = url;
  });
}

// ── Install banner ────────────────────────────────────────────────────────
function showInstallBanner() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  const dismissed = localStorage.getItem('install-banner-dismissed');
  if (isIOS && !isStandalone && !dismissed) {
    setTimeout(() => { const b=document.getElementById('install-banner'); if(b) b.style.display='block'; }, 3000);
  }
}
function dismissInstallBanner() {
  const b=document.getElementById('install-banner'); if(b) b.style.display='none';
  localStorage.setItem('install-banner-dismissed','1');
}
