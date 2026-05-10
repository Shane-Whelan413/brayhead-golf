// ── Auth / Login ──────────────────────────────────────────────────────────

let selectedPlayerId = null;
let pinBuffer = '';

function showLoginScreen() {
  const ls = document.getElementById('login-screen');
  ls.style.display = 'flex';
  const img = document.getElementById('login-logo');
  if (img) img.src = 'icon-192.png';
  renderLoginNames();
}
function hideLoginScreen() { document.getElementById('login-screen').style.display = 'none'; }

function renderLoginNames() {
  document.getElementById('login-pin-section').style.display = 'none';
  document.getElementById('login-name-section').style.display = 'block';
  const searchEl = document.getElementById('login-search');
  if (searchEl) searchEl.value = '';
  pinBuffer = '';
  updatePinDots();
  buildLoginNameList(db.players);
}

function buildLoginNameList(players) {
  const grid   = document.getElementById('login-name-grid');
  const sorted = [...players].sort((a,b)=>a.name.localeCompare(b.name));
  if (!sorted.length) {
    grid.innerHTML = `<div style="font-size:13px;color:#9a9080;text-align:center;padding:16px">No players found</div>`;
    return;
  }
  grid.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${
    sorted.map(p => {
      const parts = p.name.split(' ');
      return `<div onclick="selectPlayer('${p.id}')" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;background:white;border-radius:10px;border:1px solid #e0d8c8;cursor:pointer;text-align:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation">
        ${avatarHtml(p, 38, 12)}
        <div>
          <div style="font-size:13px;font-weight:700;color:#1a1510;line-height:1.2">${parts[0]}</div>
          <div style="font-size:11px;color:#9a9080;line-height:1.2">${parts.slice(1).join(' ')}</div>
        </div>
      </div>`;
    }).join('')
  }</div>`;
}

function filterLoginNames(val) {
  const query = val.trim().toLowerCase();
  buildLoginNameList(query ? db.players.filter(p=>p.name.toLowerCase().includes(query)) : db.players);
}

function loginAsViewer() {
  currentUser = { role: 'viewer' };
  storeSession(currentUser);
  hideLoginScreen();
  updateUIForRole();
}

function selectPlayer(pid) {
  selectedPlayerId = pid;
  const p = db.players.find(x=>x.id===pid);
  if (!p) return;
  pinBuffer = '';
  updatePinDots();
  document.getElementById('login-name-section').style.display = 'none';
  document.getElementById('login-pin-section').style.display  = 'block';
  const avEl = document.getElementById('login-pin-avatar');
  if (p.avatar_url) {
    avEl.innerHTML = `<img src="${p.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.textContent='${initials(p.name)}'" />`;
  } else {
    avEl.textContent = initials(p.name);
  }
  document.getElementById('login-pin-greeting').textContent  = `Welcome, ${p.name.split(' ')[0]}`;
  document.getElementById('login-pin-error').style.display   = 'none';
}

function numKey(val) {
  if (val === 'del') { pinBuffer = pinBuffer.slice(0,-1); }
  else { if (pinBuffer.length >= 4) return; pinBuffer += val; }
  updatePinDots();
}

function updatePinDots() {
  [1,2,3,4].forEach(i => {
    const d = document.getElementById('pd'+i);
    if (d) d.classList.toggle('filled', i <= pinBuffer.length);
  });
}

function backToNames() {
  document.getElementById('login-pin-section').style.display  = 'none';
  document.getElementById('login-name-section').style.display = 'block';
  pinBuffer = '';
  updatePinDots();
}

function submitPin() {
  const p = db.players.find(x=>x.id===selectedPlayerId);
  if (!p) return;
  const storedPin = (p.pin || '1234').toString();
  if (pinBuffer === storedPin) {
    const role = p.is_admin ? 'admin' : 'member';
    currentUser = { role, playerId: p.id, name: p.name };
    isAdmin = role === 'admin';
    storeSession(currentUser);
    hideLoginScreen();
    updateUIForRole();
    toast(`Welcome ${p.name.split(' ')[0]}${role==='admin'?' (Admin)':''}!`, 'success');
  } else {
    document.getElementById('login-pin-error').style.display = 'block';
    pinBuffer = '';
    updatePinDots();
  }
}

function showAdminLoginFromScreen() {
  document.getElementById('admin-pw-input').value = '';
  document.getElementById('admin-pw-error').style.display = 'none';
  document.getElementById('admin-modal').classList.add('open');
  setTimeout(()=>document.getElementById('admin-pw-input').focus(), 100);
}

function checkAdminPw() {
  const pw = document.getElementById('admin-pw-input').value;
  if (pw === ADMIN_PW) {
    isAdmin = true;
    currentUser = { role: 'admin' };
    storeSession(currentUser);
    document.getElementById('admin-modal').classList.remove('open');
    hideLoginScreen();
    toast('Logged in as admin', 'success');
    updateUIForRole();
    renderAll();
  } else {
    document.getElementById('admin-pw-error').style.display = 'block';
  }
}

function closeAdminModal() { document.getElementById('admin-modal').classList.remove('open'); }
function maybeCloseAdminModal(e) { if(e.target===document.getElementById('admin-modal')) closeAdminModal(); }

function updateUIForRole() {
  const role = currentUser ? currentUser.role : 'viewer';
  isAdmin = role === 'admin';
  const userLabel = document.getElementById('topbar-user');
  if (userLabel) {
    userLabel.textContent = role==='admin' ? 'Admin' : role==='member' ? currentUser.name.split(' ')[0] : 'Viewing';
  }
  const adminLinks    = document.getElementById('admin-quick-links');
  if (adminLinks)     adminLinks.style.display = isAdmin ? '' : 'none';
  const addPlayerCard = document.getElementById('add-player-card');
  if (addPlayerCard)  addPlayerCard.style.display = isAdmin ? '' : 'none';
  const createEventCard = document.getElementById('create-event-card');
  if (createEventCard)  createEventCard.style.display = isAdmin ? '' : 'none';

  const fab = document.getElementById('fab-add-btn');
  if (fab) fab.classList.toggle('disabled', role==='viewer' || !currentUser);

  const tabs = ['home','leaderboard','add-round','profile','schedule'];
  document.querySelectorAll('.nav-btn').forEach((btn, i) => {
    btn.style.display = tabs[i] ? '' : 'none';
  });
  const addRoundSection = document.getElementById('add-round');
  if (addRoundSection) addRoundSection.style.display = (role==='viewer'||!currentUser) ? 'none' : '';
  showTab('home');
  renderAll();
}

async function logout() {
  clearSession();
  currentUser = null;
  isAdmin = false;
  showLoginScreen();
  try { await loadAll(); renderLoginNames(); } catch(e) { renderLoginNames(); }
}

// ── Change PIN modal ──────────────────────────────────────────────────────
function showChangePin() {
  document.getElementById('cp-current').value = '';
  document.getElementById('cp-new').value     = '';
  document.getElementById('cp-confirm').value = '';
  document.getElementById('cp-error').style.display = 'none';
  document.getElementById('change-pin-modal').classList.add('open');
  setTimeout(()=>document.getElementById('cp-current').focus(), 100);
}
function closeChangePinModal() { document.getElementById('change-pin-modal').classList.remove('open'); }
function maybeCloseChangePinModal(e) { if(e.target===document.getElementById('change-pin-modal')) closeChangePinModal(); }

async function saveNewPin() {
  const current = document.getElementById('cp-current').value.trim();
  const newPin  = document.getElementById('cp-new').value.trim();
  const confirm = document.getElementById('cp-confirm').value.trim();
  const errEl   = document.getElementById('cp-error');
  errEl.style.display = 'none';
  if (!currentUser || !currentUser.playerId) return;
  const p = db.players.find(x=>x.id===currentUser.playerId);
  if (!p) return;
  const storedPin = p.pin || p.name.split(' ')[0];
  if (current.toLowerCase() !== storedPin.toLowerCase()) { errEl.textContent='Current PIN is incorrect'; errEl.style.display='block'; return; }
  if (!newPin) { errEl.textContent='Please enter a new PIN'; errEl.style.display='block'; return; }
  if (newPin !== confirm) { errEl.textContent='New PINs do not match'; errEl.style.display='block'; return; }
  if (newPin.length < 4)  { errEl.textContent='PIN must be at least 4 characters'; errEl.style.display='block'; return; }
  try {
    await patch(`players?id=eq.${p.id}`, { pin: newPin });
    toast('PIN updated successfully!', 'success');
    closeChangePinModal();
    await loadAll(); renderAll();
  } catch(e) { errEl.textContent='Error: '+e.message; errEl.style.display='block'; }
}

// ── App init ──────────────────────────────────────────────────────────────
async function init() {
  try { await loadAll(); } catch(e) { console.error('loadAll failed:', e); }
  try {
    const session = getStoredSession();
    if (session) {
      if (session.role === 'admin') {
        currentUser = session; isAdmin = true;
        hideLoginScreen(); updateUIForRole();
      } else if (session.role === 'member') {
        const p = db.players.find(x=>x.id===session.playerId);
        if (p) {
          currentUser = { role: p.is_admin?'admin':'member', playerId: p.id, name: p.name };
          isAdmin = currentUser.role === 'admin';
          hideLoginScreen(); updateUIForRole();
        } else { showLoginScreen(); renderAll(); }
      } else {
        currentUser = session; hideLoginScreen(); updateUIForRole();
      }
    } else { showLoginScreen(); renderAll(); }
  } catch(e) { console.error('init session failed:', e); showLoginScreen(); renderAll(); }

  buildEventSIInputs(9);

  if (getSavedCourses().length === 0) {
    setSavedCourses([{
      name: 'Stepaside', cr:35, slope:113, par:35, wcr:35, wslope:113, wpar:36,
      pars: [4,5,4,4,4,4,3,3,4], wpars:[4,5,4,4,5,4,3,3,4],
      si:  [5,2,9,8,1,3,6,7,4], wsi: [4,1,8,7,5,2,6,9,3]
    }]);
  }
  renderSavedCourseDropdown();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/brayhead-golf/sw.js', { scope: '/brayhead-golf/' }).catch(()=>{});
  }
  showInstallBanner();
}
