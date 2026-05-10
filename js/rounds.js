// ── Add Round / Scorecard ─────────────────────────────────────────────────

let activeScorecardHole = 1;
let _scanImageBase64 = null;
let _scanResults = [];
let _scanMediaType = 'image/jpeg';

function renderAddRound() {
  const rp = document.getElementById('r-player');
  const re = document.getElementById('r-event');
  const role = currentUser ? currentUser.role : 'viewer';
  const isMember   = role === 'member';
  const isAdminUser = role === 'admin';
  const nextEvent = [...db.events].filter(e=>!e.published).sort((a,b)=>a.event_date.localeCompare(b.event_date))[0] || null;
  const noEventEl  = document.getElementById('ar-no-event');
  const saveBtn    = document.getElementById('btn-save-round');
  const holeWrap   = document.getElementById('hole-inputs');
  const playerBar  = document.getElementById('ar-player-bar');

  if (!nextEvent) {
    if (noEventEl) { noEventEl.style.display='block'; noEventEl.textContent='No upcoming event yet — check back soon!'; }
    if (holeWrap)  holeWrap.innerHTML = '';
    if (saveBtn)   saveBtn.style.display = 'none';
    if (playerBar) playerBar.style.display = 'none';
    const evName = document.getElementById('ar-event-name');
    const evDate = document.getElementById('ar-event-date');
    if (evName) evName.textContent = 'No upcoming event';
    if (evDate) evDate.textContent = '';
    return;
  }

  if (noEventEl) noEventEl.style.display = 'none';
  if (saveBtn)   saveBtn.style.display = '';
  const n = nextEvent.event_type === 'outing_18' ? 18 : 9;
  re.value = nextEvent.id;

  const evName  = document.getElementById('ar-event-name');
  const evDate  = document.getElementById('ar-event-date');
  const sbHoles = document.getElementById('sb-holes');
  if (evName)  evName.textContent  = nextEvent.course_name;
  if (evDate)  evDate.textContent  = `${fmtDate(nextEvent.event_date)} · ${nextEvent.event_type==='outing_18'?'18-hole outing':'Sunday 9'}`;
  if (sbHoles) sbHoles.textContent = `0/${n}`;

  if (isMember && currentUser.playerId) {
    if (playerBar) playerBar.style.display = 'none';
    rp.innerHTML = db.players.filter(p=>p.id===currentUser.playerId).map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    rp.disabled = true;
  } else if (isAdminUser) {
    if (playerBar) playerBar.style.display = 'flex';
    rp.disabled  = false;
    rp.innerHTML = '<option value="">Select player…</option>' + db.players.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  } else {
    if (playerBar) playerBar.style.display = 'none';
    rp.disabled  = true;
    rp.innerHTML = '<option value="">Not available</option>';
  }

  buildHoleInputs(n);
  updateRoundSummary();
}

function buildHoleInputs(n) {
  const wrap = document.getElementById('hole-inputs');
  const makeHeader = () => `<div class="sc-col-header"><span>#</span><span>Par</span><span>SI</span><span>Score</span><span>Pts</span></div>`;
  const makeRow = i => `<div class="sc-hole-row" id="sc-row${i}" onclick="selectScorecardHole(${i})">
    <div style="font-size:13px;font-weight:700;color:var(--text-3);text-align:center">${i}</div>
    <div style="font-size:13px;font-weight:600;color:var(--text-2);text-align:center" id="sc-par${i}">—</div>
    <div style="font-size:13px;font-weight:500;color:var(--text-3);text-align:center" id="sc-si${i}">—</div>
    <div class="sc-hole-score-area">
      <button class="sc-adj" ontouchstart="event.preventDefault();event.stopPropagation();adjustScore(${i},-1)" onclick="event.stopPropagation();adjustScore(${i},-1)">−</button>
      <div class="sc-score-val sc-empty" id="sc-score${i}">—</div>
      <button class="sc-adj" ontouchstart="event.preventDefault();event.stopPropagation();adjustScore(${i},1)" onclick="event.stopPropagation();adjustScore(${i},1)">+</button>
    </div>
    <div class="sc-pts-chip" id="hpts${i}"></div>
  </div><input type="hidden" id="h${i}">`;

  if (n === 9) {
    wrap.innerHTML = `<div class="nine-panel active" id="panel-front">${makeHeader()}${Array.from({length:9},(_,i)=>makeRow(i+1)).join('')}</div>`;
  } else {
    wrap.innerHTML = `
      <div class="nine-tabs">
        <button class="nine-tab active" id="tab-front" onclick="switchNine('front')">Front 9</button>
        <button class="nine-tab" id="tab-back"  onclick="switchNine('back')">Back 9</button>
      </div>
      <div class="nine-panel active" id="panel-front">${makeHeader()}${Array.from({length:9},(_,i)=>makeRow(i+1)).join('')}</div>
      <div class="nine-panel" id="panel-back">${makeHeader()}${Array.from({length:9},(_,i)=>makeRow(i+10)).join('')}</div>`;
  }

  // Restore cached scores
  const pid = document.getElementById('r-player')?.value;
  const eid = document.getElementById('r-event')?.value;
  const cacheKey = 'bhgs_scores_' + (eid||'') + '_' + (pid||'');
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached) {
      for (let i=1; i<=n; i++) {
        if (cached[i]) {
          const inp  = document.getElementById('h'+i);
          const disp = document.getElementById('sc-score'+i);
          if (inp)  inp.value = cached[i];
          if (disp) { disp.textContent = cached[i]; disp.classList.remove('sc-empty'); }
        }
      }
      updateRoundSummary();
    }
  } catch(e) {}
}

function switchNine(which) {
  document.getElementById('tab-front').classList.toggle('active', which==='front');
  document.getElementById('tab-back').classList.toggle('active',  which==='back');
  document.getElementById('panel-front').classList.toggle('active', which==='front');
  document.getElementById('panel-back').classList.toggle('active',  which==='back');
}

function selectScorecardHole(hole) {
  activeScorecardHole = hole;
  for (let i=1; i<=18; i++) {
    const r = document.getElementById('sc-row'+i);
    if (!r) continue;
    r.classList.toggle('sc-active', i===hole);
  }
}

function adjustScore(hole, delta) {
  const inp     = document.getElementById('h'+hole);
  const display = document.getElementById('sc-score'+hole);
  const current = parseInt(inp.value)||0;
  if (current===0 && delta<0) return;
  if (current===0 && delta>0) {
    const par = parseInt(document.getElementById('sc-par'+hole)?.textContent)||4;
    inp.value = par;
  } else {
    inp.value = Math.max(1, Math.min(15, current+delta));
  }
  display.textContent = inp.value;
  display.classList.remove('sc-empty', 'sc-pulse');
  void display.offsetWidth;
  display.classList.add('sc-pulse');
  selectScorecardHole(hole);
  updateRoundSummary();
  try {
    const pid = document.getElementById('r-player')?.value;
    const eid = document.getElementById('r-event')?.value;
    if (pid && eid) {
      const cache = {};
      for (let i=1;i<=18;i++) { const v=document.getElementById('h'+i)?.value; if(v) cache[i]=v; }
      localStorage.setItem('bhgs_scores_'+eid+'_'+pid, JSON.stringify(cache));
    }
  } catch(e) {}
}

function resetHoleInputs(n) {
  for (let i=1; i<=n; i++) {
    const inp  = document.getElementById('h'+i);
    const disp = document.getElementById('sc-score'+i);
    const pts  = document.getElementById('hpts'+i);
    const row  = document.getElementById('sc-row'+i);
    if (inp)  inp.value = '';
    if (disp) { disp.textContent = '—'; disp.classList.add('sc-empty'); }
    if (pts)  { pts.textContent=''; pts.style.background=''; pts.style.color=''; }
    if (row)  { row.classList.remove('sc-active'); if(i===1) row.classList.add('sc-active'); }
  }
  activeScorecardHole = 1;
}

function updateRoundSummary() {
  const eid = document.getElementById('r-event').value;
  const pid = document.getElementById('r-player').value;
  const ev  = db.events.find(e=>e.id===eid);
  const sb  = document.getElementById('round-summary');
  if (!eid || !pid || !ev) { sb.classList.remove('show'); return; }
  const n = ev.event_type==='outing_18' ? 18 : 9;
  const p = db.players.find(x=>x.id===pid);
  const hcp = p ? parseFloat(p.handicap_index) : 18;
  const { cr, slope, par } = getCourseIndexForPlayer(p, ev);
  const isOuting = ev.event_type === 'outing_18';
  const courseHcp = isOuting ? calcOutingCourseHcp(hcp, slope, cr, par, p?p.id:null) : calcCourseHcp(hcp);
  const indexLabel = p && p.plays_womens_index ? 'W' : 'M';
  const siVals  = getSIValues(n, ev, p||null);
  const parVals = getParValues(n, ev, p||null);

  for (let i=1; i<=n; i++) {
    const parEl = document.getElementById('sc-par'+i); if (parEl) parEl.textContent = parVals[i-1]||'—';
    const siEl  = document.getElementById('sc-si'+i);  if (siEl)  siEl.textContent  = siVals[i-1]||'—';
  }

  let pts=0, holes=0;
  for (let i=1; i<=n; i++) {
    const v = parseInt(document.getElementById('h'+i)?.value);
    const ptsEl = document.getElementById('hpts'+i);
    if (!isNaN(v) && v > 0) {
      const holePts = calcStableford(v, parVals[i-1], getStrokeAllowance(courseHcp, siVals[i-1], n));
      pts += holePts; holes++;
      if (ptsEl) {
        const bg = holePts>=3?'#C9A84C':holePts===2?'#2a6b1a':holePts===1?'#9a9080':'#A32D2D';
        ptsEl.textContent=holePts; ptsEl.style.background=bg; ptsEl.style.color='#ffffff';
      }
    } else { if(ptsEl){ptsEl.textContent='';ptsEl.style.background='';ptsEl.style.color='';} }
  }

  const hcpEl   = document.getElementById('sb-hcp');
  const chcpEl  = document.getElementById('sb-chcp');
  const holesEl = document.getElementById('sb-holes');
  const ptsEl2  = document.getElementById('sb-pts');
  if (hcpEl)   hcpEl.value         = hcp.toFixed(1);
  if (chcpEl)  chcpEl.textContent  = courseHcp + (indexLabel==='W'?' W':'');
  const hcpSubEl = document.getElementById('sb-hcp-sub');
  if (hcpSubEl) hcpSubEl.textContent = 'Hcp '+hcp.toFixed(1)+(indexLabel==='W'?' (W)':'');
  if (holesEl) holesEl.textContent = `${holes}/${n}`;
  if (ptsEl2)  { ptsEl2.textContent=pts; ptsEl2.style.color=pts>0?'#C9A84C':'rgba(255,255,255,0.5)'; }

  if (holes > 0) {
    const allPts = [...db.rounds.filter(r=>r.event_id===eid).map(r=>r.stableford_points), pts].sort((a,b)=>b-a);
    const pos = allPts.indexOf(pts)+1;
    const newH = calcNewHcp(hcp, pts, pos);
    const hcpNote = isOuting
      ? (pts>=37?`Hcp ${hcp} → ${parseFloat((hcp-1).toFixed(1))} (broke par)`:`Hcp ${hcp} → ${parseFloat((hcp+0.2).toFixed(1))} (+0.2)`)
      : pts>=18 ? `Hcp ${hcp} → ${newH} (−1)` : pos<=3 ? `Hcp ${hcp} (top 3 — no change)` : `Hcp ${hcp} → ${newH} (+0.2)`;
    sb.innerHTML = `<span>${pts} pts · ${hcpNote}</span>`;
    sb.classList.add('show');
  } else { sb.classList.remove('show'); }
}

async function saveRound() {
  const eid = document.getElementById('r-event').value;
  const pid = document.getElementById('r-player').value;
  if (!eid) { toast('No event selected','error'); return; }
  if (!pid) { toast('No player selected','error'); return; }
  const ev = db.events.find(e=>e.id===eid);
  const pl = db.players.find(x=>x.id===pid);
  if (!ev||!pl) { toast('Event or player not found','error'); return; }
  const n = ev.event_type==='outing_18' ? 18 : 9;
  const scores = [];
  for (let i=1;i<=n;i++) {
    const el=document.getElementById('h'+i);
    if(!el){toast(`Hole input h${i} missing`,'error');return;}
    const v=parseInt(el.value); scores.push(isNaN(v)?null:v);
  }
  const filled=scores.filter(s=>s!==null).length;
  if (filled<n){toast(`Only ${filled} of ${n} hole scores entered`,'error');return;}
  if (db.rounds.find(r=>r.event_id===eid&&r.player_id===pid)){toast('Round already recorded for this player','error');return;}

  const parVals=getParValues(n,ev,pl);
  const hcpIdx=parseFloat(pl.handicap_index)||18;
  const {cr,slope,par}=getCourseIndexForPlayer(pl,ev);
  const isOuting=ev.event_type==='outing_18';
  const courseHcp=isOuting?calcOutingCourseHcp(hcpIdx,slope,cr,par,pl.id):calcCourseHcp(hcpIdx);
  const siVals=getSIValues(n,ev,pl);
  let totalPts=0;
  for (let i=0;i<n;i++){if(scores[i]!==null)totalPts+=calcStableford(scores[i],parVals[i],getStrokeAllowance(courseHcp,siVals[i],n));}
  const gross=scores.reduce((a,b)=>a+(b||0),0);
  let newHcp;
  if(isOuting){
    newHcp=calcNewHcpOuting(hcpIdx,totalPts);
  }else{
    const allPts=[...db.rounds.filter(r=>r.event_id===eid).map(r=>r.stableford_points),totalPts].sort((a,b)=>b-a);
    newHcp=calcNewHcp(hcpIdx,totalPts,allPts.indexOf(totalPts)+1);
  }

  const btn=document.getElementById('btn-save-round');
  btn.disabled=true; btn.textContent='Saving…';
  try {
    await post('rounds',{event_id:eid,player_id:pid,hole_scores:scores,par_values:parVals,stableford_points:totalPts,gross_score:gross,course_handicap:courseHcp,handicap_before:hcpIdx,handicap_after:newHcp,league_points:0});
    toast(`Saved! ${totalPts} stableford pts · Pending verification`,'success');
    resetHoleInputs(n);
    try { localStorage.removeItem('bhgs_scores_'+eid+'_'+pid); } catch(e){}
    document.getElementById('round-summary').classList.remove('show');
    await loadAll(); renderAll();
  } catch(e){toast('Error saving: '+e.message,'error');}
  btn.disabled=false; btn.textContent='Save round';
}

// ── Scorecard view / compare ──────────────────────────────────────────────
function showRoundScorecard(rid) {
  const r  = db.rounds.find(x=>x.id===rid);
  if (!r) return;
  const ev = db.events.find(e=>e.id===r.event_id);
  const pl = db.players.find(x=>x.id===r.player_id);
  if (!ev||!r.hole_scores){toast('No hole scores recorded for this round','error');return;}
  const n=ev.event_type==='outing_18'?18:9;
  const others=db.rounds.filter(x=>x.event_id===r.event_id&&x.player_id!==r.player_id&&x.hole_scores);
  const compareOptions=others.map(x=>{const p2=db.players.find(p=>p.id===x.player_id);return`<option value="${x.id}">${p2?p2.name:'?'} — ${x.stableford_points} pts</option>`;}).join('');
  const {header,rows,footer}=buildScorecardRows(r,ev,n,null);
  const totalGross=r.hole_scores.slice(0,n).reduce((a,b)=>a+(b||0),0);
  document.getElementById('modal-title').textContent=`${ev.course_name} · ${fmtDate(ev.event_date)}`;
  document.getElementById('modal-body').innerHTML=`
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <span class="badge green">${r.stableford_points} pts</span>
      <span class="badge gray">Hcp ${r.course_handicap}</span>
      <span class="badge gray">Gross ${totalGross}</span>
      ${r.verified?'<span class="badge green">✓ Verified</span>':'<span class="badge gray">Pending</span>'}
    </div>
    ${others.length?`<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><select id="compare-select" onchange="loadComparison('${rid}',this.value)" style="flex:1;height:36px;font-size:12px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text);padding:0 10px;font-family:'DM Sans',sans-serif"><option value="">Compare with...</option>${compareOptions}</select></div>`:''}
    <div id="scorecard-table" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead>${header}</thead><tbody>${rows}</tbody><tfoot>${footer}</tfoot></table></div>`;
  document.getElementById('modal-overlay').classList.add('open');
}

function buildScorecardRows(r, ev, n, compareR) {
  const pl=db.players.find(x=>x.id===r.player_id);
  const pl2=compareR?db.players.find(x=>x.id===compareR.player_id):null;
  const parVals=getParValues(n,ev,pl); const siVals=getSIValues(n,ev,pl);
  const parVals2=compareR?getParValues(n,ev,pl2):null; const siVals2=compareR?getSIValues(n,ev,pl2):null;
  const chcp=r.course_handicap||0; const chcp2=compareR?(compareR.course_handicap||0):0;
  const chip=(pts,winner)=>{
    let bg,col;
    if(pts===null){bg='#F1EFE8';col='#888780';}
    else if(!compareR){bg=pts>=3?'#FAEEDA':pts>=2?'#fef8e6':pts===1?'#F1EFE8':'#FCEBEB';col=pts>=3?'#633806':pts>=2?'#8a6a1a':pts===1?'#5F5E5A':'#A32D2D';}
    else if(winner==='you'){bg='#fef8e6';col='#8a6a1a';}
    else if(winner==='them'){bg='#EEEDFE';col='#3C3489';}
    else if(pts===0){bg='#FCEBEB';col='#A32D2D';}
    else{bg='#F1EFE8';col='#5F5E5A';}
    return`<span style="display:inline-block;padding:1px 6px;border-radius:5px;font-size:11px;font-weight:500;background:${bg};color:${col}">${pts!==null?pts:'—'}</span>`;
  };
  const totalPar=parVals.slice(0,n).reduce((a,b)=>a+b,0);
  const totalGross=r.hole_scores.slice(0,n).reduce((a,b)=>a+(b||0),0);
  const header=compareR
    ?`<tr style="border-bottom:1px solid var(--border)"><th style="font-size:10px;color:var(--text-3);padding:4px;text-align:left">H</th><th style="font-size:10px;color:var(--text-3);padding:4px;text-align:left">Par</th><th style="font-size:10px;color:#8a6a1a;padding:4px;text-align:left">${pl?pl.name.split(' ')[0]:'You'}</th><th style="font-size:10px;color:#3C3489;padding:4px;text-align:left">${pl2?pl2.name.split(' ')[0]:'Them'}</th></tr>`
    :`<tr style="border-bottom:1px solid var(--border)"><th style="font-size:10px;color:var(--text-3);padding:4px;text-align:left">Hole</th><th style="font-size:10px;color:var(--text-3);padding:4px;text-align:left">Par</th><th style="font-size:10px;color:var(--text-3);padding:4px;text-align:left">Score</th><th style="font-size:10px;color:var(--text-3);padding:4px;text-align:left">Allow</th><th style="font-size:10px;color:var(--text-3);padding:4px;text-align:left">Pts</th></tr>`;
  const rows=Array.from({length:n},(_,i)=>{
    const score=r.hole_scores[i]; const par=parVals[i]||4; const allow=getStrokeAllowance(chcp,siVals[i]||(i+1),n); const pts=score!=null?calcStableford(score,par,allow):null;
    if(!compareR){const bg=pts===null?'#F1EFE8':pts>=3?'#FAEEDA':pts>=2?'#fef8e6':pts===1?'#F1EFE8':'#FCEBEB';const col=pts===null?'#888780':pts>=3?'#633806':pts>=2?'#8a6a1a':pts===1?'#5F5E5A':'#A32D2D';return`<tr style="border-bottom:0.5px solid var(--border)"><td style="color:var(--text-3);font-size:12px;padding:5px 4px">${i+1}</td><td style="padding:5px 4px;font-size:12px">${par}</td><td style="padding:5px 4px;font-size:12px">${score!=null?score:'—'}</td><td style="padding:5px 4px;font-size:11px">+${allow}</td><td style="padding:5px 4px"><span style="display:inline-block;padding:1px 7px;border-radius:6px;font-size:11px;font-weight:500;background:${bg};color:${col}">${pts!==null?pts:'—'}</span></td></tr>`;}
    const score2=compareR.hole_scores[i]; const par2=parVals2[i]||4; const allow2=getStrokeAllowance(chcp2,siVals2[i]||(i+1),n); const pts2=score2!=null?calcStableford(score2,par2,allow2):null;
    const w1=pts!==null&&pts2!==null?(pts>pts2?'you':pts<pts2?'them':'draw'):'draw'; const w2=w1==='you'?'them':w1==='them'?'you':'draw';
    return`<tr style="border-bottom:0.5px solid var(--border)"><td style="color:var(--text-3);font-size:12px;padding:5px 4px">${i+1}</td><td style="padding:5px 4px;font-size:12px">${par}</td><td style="padding:5px 4px">${chip(pts,w1)}</td><td style="padding:5px 4px">${chip(pts2,w2)}</td></tr>`;
  }).join('');
  const footer=compareR
    ?`<tr style="border-top:1px solid var(--border);font-weight:600"><td style="padding:5px 4px;font-size:12px">Total</td><td style="padding:5px 4px;font-size:12px">${totalPar}</td><td style="padding:5px 4px">${chip(r.stableford_points,r.stableford_points>=compareR.stableford_points?'you':'them')}</td><td style="padding:5px 4px">${chip(compareR.stableford_points,compareR.stableford_points>=r.stableford_points?'you':'them')}</td></tr>`
    :`<tr style="border-top:1px solid var(--border);font-weight:600"><td style="padding:5px 4px;font-size:12px">Total</td><td style="padding:5px 4px;font-size:12px">${totalPar}</td><td style="padding:5px 4px;font-size:12px">${totalGross}</td><td></td><td style="padding:5px 4px"><span style="display:inline-block;padding:1px 7px;border-radius:6px;font-size:11px;font-weight:500;background:#fef8e6;color:#8a6a1a">${r.stableford_points}</span></td></tr>`;
  return {header,rows,footer};
}

function loadComparison(rid, compareRid) {
  const r=db.rounds.find(x=>x.id===rid); const r2=compareRid?db.rounds.find(x=>x.id===compareRid):null;
  if (!r) return;
  const ev=db.events.find(e=>e.id===r.event_id); if(!ev) return;
  const n=ev.event_type==='outing_18'?18:9;
  const {header,rows,footer}=buildScorecardRows(r,ev,n,r2||null);
  const pl=db.players.find(x=>x.id===r.player_id); const pl2=r2?db.players.find(x=>x.id===r2.player_id):null;
  document.getElementById('scorecard-table').innerHTML=`
    ${r2?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><span class="badge green">${pl?pl.name.split(' ')[0]:'You'}: ${r.stableford_points} pts</span><span class="badge" style="background:#EEEDFE;color:#3C3489">${pl2?pl2.name.split(' ')[0]:'Them'}: ${r2.stableford_points} pts</span><span class="badge gray">${r.stableford_points===r2.stableford_points?'Tied':r.stableford_points>r2.stableford_points?(pl?pl.name.split(' ')[0]:'You')+' wins':(pl2?pl2.name.split(' ')[0]:'Them')+' wins'}</span></div>`:''}
    <table style="width:100%;border-collapse:collapse"><thead>${header}</thead><tbody>${rows}</tbody><tfoot>${footer}</tfoot></table>`;
}

function editRound(rid) {
  const r=db.rounds.find(x=>x.id===rid); const ev=db.events.find(e=>e.id===r.event_id); const p=db.players.find(x=>x.id===r.player_id);
  if(!r||!ev) return;
  const n=ev.event_type==='outing_18'?18:9; const parVals=getParValues(n,ev,p||null);
  document.getElementById('modal-title').textContent=`Edit round — ${p?p.name:'?'} · ${ev.course_name}`;
  let rows='';
  for(let i=1;i<=n;i++){
    rows+=`<div style="display:grid;grid-template-columns:36px 36px 1fr;align-items:center;gap:4px;padding:6px 12px;border-bottom:0.5px solid var(--border)">
      <div style="font-size:13px;font-weight:700;color:var(--text-3);text-align:center">${i}</div>
      <div style="font-size:13px;color:var(--text-2);text-align:center;font-weight:500">${parVals[i-1]||4}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px">
        <button onclick="erAdj(${i},-1)" style="width:34px;height:34px;border-radius:50%;border:1.5px solid var(--border-strong);background:var(--bg);color:var(--text);font-size:20px;font-weight:300;display:flex;align-items:center;justify-content:center;cursor:pointer;font-family:'DM Sans',sans-serif">−</button>
        <div id="er-display${i}" style="font-size:22px;font-weight:700;color:var(--text);min-width:32px;text-align:center">${r.hole_scores&&r.hole_scores[i-1]?r.hole_scores[i-1]:'—'}</div>
        <button onclick="erAdj(${i},1)" style="width:34px;height:34px;border-radius:50%;border:1.5px solid var(--border-strong);background:var(--bg);color:var(--text);font-size:20px;font-weight:300;display:flex;align-items:center;justify-content:center;cursor:pointer;font-family:'DM Sans',sans-serif">+</button>
        <input type="hidden" id="er-h${i}" value="${r.hole_scores&&r.hole_scores[i-1]?r.hole_scores[i-1]:''}" />
      </div>
    </div>`;
  }
  document.getElementById('modal-body').innerHTML=`
    <div style="background:#0a1628;border-radius:8px 8px 0 0;padding:8px 12px;display:grid;grid-template-columns:36px 36px 1fr;gap:4px">
      <span style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;text-align:center;font-weight:600">#</span>
      <span style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;text-align:center;font-weight:600">Par</span>
      <span style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;text-align:center;font-weight:600">Score</span>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;margin-bottom:12px">${rows}</div>
    <button class="btn primary" onclick="saveEditedRound('${rid}')" style="width:100%">Save changes</button>`;
  document.getElementById('modal-overlay').classList.add('open');
}

function erAdj(hole, delta) {
  const inp=document.getElementById('er-h'+hole); const disp=document.getElementById('er-display'+hole);
  const cur=parseInt(inp.value)||0;
  if(cur===0&&delta<0) return;
  const newVal=cur===0&&delta>0?4:Math.max(1,Math.min(15,cur+delta));
  inp.value=newVal; disp.textContent=newVal; disp.style.color='var(--text)';
}

async function saveEditedRound(rid) {
  const r=db.rounds.find(x=>x.id===rid); const ev=db.events.find(e=>e.id===r.event_id); const pl=db.players.find(x=>x.id===r.player_id);
  if(!r||!ev||!pl) return;
  const n=ev.event_type==='outing_18'?18:9;
  const scores=[];
  for(let i=1;i<=n;i++){const v=parseInt(document.getElementById('er-h'+i)?.value);scores.push(isNaN(v)?null:v);}
  if(scores.filter(s=>s!==null).length<n){toast(`Enter all ${n} scores`,'error');return;}
  const parVals=getParValues(n,ev,pl); const siVals=getSIValues(n,ev,pl);
  const hcpIdx=parseFloat(r.handicap_before);
  const{cr,slope,par}=getCourseIndexForPlayer(pl,ev);
  const isOuting=ev.event_type==='outing_18';
  const courseHcp=isOuting?calcOutingCourseHcp(hcpIdx,slope,cr,par,pl.id):calcCourseHcp(hcpIdx);
  let totalPts=0;
  for(let i=0;i<n;i++){if(scores[i]!==null)totalPts+=calcStableford(scores[i],parVals[i],getStrokeAllowance(courseHcp,siVals[i],n));}
  const gross=scores.reduce((a,b)=>a+(b||0),0);
  let newHcp;
  if(isOuting){newHcp=calcNewHcpOuting(hcpIdx,totalPts);}
  else{const allPts=[...db.rounds.filter(x=>x.event_id===r.event_id&&x.id!==rid).map(x=>x.stableford_points),totalPts].sort((a,b)=>b-a);newHcp=calcNewHcp(hcpIdx,totalPts,allPts.indexOf(totalPts)+1);}
  try{
    await patch(`rounds?id=eq.${rid}`,{hole_scores:scores,stableford_points:totalPts,gross_score:gross,course_handicap:courseHcp,handicap_after:newHcp,verified:false});
    toast(`Round updated! ${totalPts} pts · Needs re-verification`,'success');
    closeModal(); await loadAll(); renderAll();
  }catch(e){toast('Error: '+e.message,'error');}
}

async function verifyRound(rid) {
  const r=db.rounds.find(x=>x.id===rid); if(!r) return;
  try{
    await patch(`rounds?id=eq.${rid}`,{verified:true});
    await patch(`players?id=eq.${r.player_id}`,{handicap_index:parseFloat(r.handicap_after)});
    toast(`Round verified! Hcp updated to ${parseFloat(r.handicap_after).toFixed(1)}`,'success');
    await loadAll(); renderAll(); closeModal();
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── Scorecard scanner ─────────────────────────────────────────────────────
function openScanner()  { document.getElementById('scanner-modal').classList.add('open'); resetScanner(); }
function closeScanner() { document.getElementById('scanner-modal').classList.remove('open'); }
function maybeCloseScanner(e) { if(e.target===document.getElementById('scanner-modal')) closeScanner(); }

function resetScanner() {
  _scanImageBase64=null; _scanResults=[];
  document.getElementById('scan-step-upload').style.display='flex';
  document.getElementById('scan-step-preview').style.display='none';
  document.getElementById('scan-step-results').style.display='none';
  document.getElementById('scan-file-input').value='';
}

function handleScanImage(e) {
  const file=e.target.files[0]; if(!file) return;
  const img=new Image(); const objectUrl=URL.createObjectURL(file);
  img.onload=function(){
    const canvas=document.createElement('canvas');
    const maxW=1600; const scale=img.width>maxW?maxW/img.width:1;
    canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale);
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    const dataUrl=canvas.toDataURL('image/jpeg',0.92);
    _scanImageBase64=dataUrl.split(',')[1]; _scanMediaType='image/jpeg';
    URL.revokeObjectURL(objectUrl);
    document.getElementById('scan-preview-img').src=dataUrl;
    document.getElementById('scan-step-upload').style.display='none';
    document.getElementById('scan-step-preview').style.display='flex';
  };
  img.onerror=()=>{URL.revokeObjectURL(objectUrl);toast('Could not load image','error');};
  img.src=objectUrl;
}

async function runScan() {
  const apiKey=getAnthropicKey();
  if(!apiKey){openApiKeyModal();return;}
  const btn=document.getElementById('scan-btn');
  btn.innerHTML='<span class="scan-spinner"></span>Reading card…'; btn.disabled=true;
  const eid=document.getElementById('r-event').value;
  const ev=db.events.find(e=>e.id===eid);
  const n=ev?(ev.event_type==='outing_18'?18:9):9;
  const parVals=ev?getParValues(n,ev,null):Array.from({length:n},()=>4);
  const siVals=ev?getSIValues(n,ev,null):Array.from({length:n},(_,i)=>i+1);
  const maxScores=parVals.map(p=>p+2);
  const parInfo=parVals.map((p,i)=>`Hole ${i+1}: Par ${p}, SI ${siVals[i]}, max=${maxScores[i]}`).join(' | ');
  window._scanParVals=parVals; window._scanSiVals=siVals; window._scanN=n; window._scanEid=eid;
  try{
    const response=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':getAnthropicKey(),'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({
        model:'claude-sonnet-4-6',max_tokens:1000,
        messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:_scanMediaType,data:_scanImageBase64}},
          {type:'text',text:`Extract golf scores from this scorecard. ${n} holes.\nOUTPUT ONLY A JSON ARRAY. NO OTHER TEXT.\nOnly extract the FIRST player (top row / "A"). Extract GROSS STROKES only.\nIf scratched/unfinished use max: ${maxScores.map((m,i)=>`hole ${i+1}=${m}`).join(', ')}. If illegible = null.\n${parInfo}\n[{"player":"name","scores":[${Array.from({length:n},(_,i)=>`h${i+1}`).join(',')}]}]`}
        ]}]
      })
    });
    const data=await response.json();
    if(!response.ok||data.error) throw new Error(data.error?.message||`HTTP ${response.status}`);
    const text=data.content.map(c=>c.text||'').join('');
    const parsed=JSON.parse(text.replace(/```json|```/g,'').trim());
    _scanResults=parsed;
    renderScanResults(parsed,n,parVals);
    document.getElementById('scan-step-preview').style.display='none';
    document.getElementById('scan-step-results').style.display='flex';
  }catch(err){
    toast('Scan failed: '+(err.message||String(err)),'error');
    btn.innerHTML='Scan scorecard'; btn.disabled=false;
  }
}

function calcScanMaxScores(pid) {
  const parVals=window._scanParVals||[]; const siVals=window._scanSiVals||[]; const n=window._scanN||9;
  const ev=db.events.find(e=>e.id===(window._scanEid||''));
  const pl=db.players.find(p=>p.id===pid);
  if(!pl||!ev) return parVals.map(p=>p+2);
  const hcp=parseFloat(pl.handicap_index);
  const{cr,slope,par:coursePar}=getCourseIndexForPlayer(pl,ev);
  const isOuting=ev.event_type==='outing_18';
  const courseHcp=isOuting?calcOutingCourseHcp(hcp,slope,cr,coursePar,pid):calcCourseHcp(hcp);
  return parVals.map((p,i)=>p+2+getStrokeAllowance(courseHcp,siVals[i],n));
}

function onScanPlayerChange(pi) {
  const pid=document.getElementById('scan-player-'+pi)?.value; if(!pid) return;
  const maxScores=calcScanMaxScores(pid); const parVals=window._scanParVals||[];
  (_scanResults[pi]?.scores||[]).forEach((score,hi)=>{
    const inp=document.getElementById('scan-score-'+pi+'-'+hi); if(!inp) return;
    const oldMax=(parVals[hi]||4)+2;
    if(parseInt(inp.value)===oldMax||inp.value===''||inp.classList.contains('scan-warn')){inp.value=maxScores[hi];inp.classList.remove('scan-warn');}
  });
}

function renderScanResults(results,n,parVals) {
  document.getElementById('scan-results-body').innerHTML=results.map((player,pi)=>`
    <div style="margin-bottom:20px">
      <div style="background:#f8f5ee;border-radius:10px;padding:10px 12px;margin-bottom:10px">
        <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Name on card: ${player.player}</div>
        <select id="scan-player-${pi}" onchange="onScanPlayerChange(${pi})" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;background:white;color:var(--text)">
          <option value="">— match to player —</option>
          ${db.players.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
      </div>
      <table class="scan-table">
        <thead><tr><th>Hole</th><th>Par</th><th>Score</th></tr></thead>
        <tbody>${player.scores.map((score,hi)=>{const par=parVals[hi]||4;const warn=score===null||score<1||score>12;return`<tr><td style="font-weight:700;color:var(--text-3);text-align:center">${hi+1}</td><td style="text-align:center;color:var(--text-2)">${par}</td><td><input type="number" min="1" max="15" value="${score||''}" id="scan-score-${pi}-${hi}" class="${warn?'scan-warn':''}" oninput="validateScanScore(this,${par})" placeholder="?"></td></tr>`;}).join('')}</tbody>
      </table>
    </div>`).join('');
  results.forEach((player,pi)=>{
    const sel=document.getElementById('scan-player-'+pi); if(!sel) return;
    const nameLower=player.player.toLowerCase();
    const match=db.players.find(p=>p.name.toLowerCase().includes(nameLower.split(' ')[0])||nameLower.includes(p.name.toLowerCase().split(' ')[0]));
    if(match){sel.value=match.id;onScanPlayerChange(pi);}
  });
}

function validateScanScore(input,par){const v=parseInt(input.value);input.classList.toggle('scan-warn',isNaN(v)||v<1||v>12);}

function loadScanResults() {
  for(let pi=0;pi<_scanResults.length;pi++){
    const pid=document.getElementById('scan-player-'+pi)?.value; if(!pid) continue;
    const scores=_scanResults[pi].scores.map((_,hi)=>{const inp=document.getElementById('scan-score-'+pi+'-'+hi);return inp?parseInt(inp.value)||0:0;});
    const rPlayerSel=document.getElementById('r-player'); if(rPlayerSel) rPlayerSel.value=pid;
    const eid=document.getElementById('r-event').value;
    const ev=db.events.find(e=>e.id===eid);
    const n=ev?(ev.event_type==='outing_18'?18:9):9;
    buildHoleInputs(n);
    setTimeout(()=>{
      scores.forEach((score,hi)=>{if(score>0&&hi<n){const inp=document.getElementById('h'+(hi+1));const disp=document.getElementById('sc-score'+(hi+1));if(inp)inp.value=score;if(disp){disp.textContent=score;disp.classList.remove('sc-empty');}}});
      updateRoundSummary(); closeScanner(); toast('Scores loaded — review and save','success');
    },100);
    break;
  }
  if(!_scanResults.some((_,pi)=>document.getElementById('scan-player-'+pi)?.value)){
    toast('Please match at least one player','error');
  }
}
