// ── Leaderboard ───────────────────────────────────────────────────────────

function renderLeaderboard() {
  const filter = document.getElementById('lb-filter').value;
  const evs = filter === 'all' ? db.events : db.events.filter(e=>e.event_type===filter);
  const publishedEids = new Set(evs.filter(e=>e.published).map(e=>e.id));

  // FIX: pass filtered publishedEids so the filter actually works
  const lbPositions = getLeaderboardPositions(publishedEids);

  const rows = db.players.map(p => {
    const pos = lbPositions[p.id]?.pos || 0;
    const lp  = lbPositions[p.id]?.lp  || 0;
    const playerRounds = db.rounds.filter(r=>r.player_id===p.id && r.verified && publishedEids.has(r.event_id));
    const stab = playerRounds.reduce((s,r)=>s+r.stableford_points, 0);
    const best = playerRounds.length ? Math.max(...playerRounds.map(r=>r.stableford_points)) : 0;
    const avg  = playerRounds.length ? (stab/playerRounds.length).toFixed(1) : '—';
    return { ...p, lp, pos, rounds: playerRounds.length, best, avg };
  }).sort((a,b) => a.pos - b.pos || b.lp - a.lp);

  const sundays = getSundays();
  const eventsPlayed   = db.events.filter(e=>e.published).length;
  const verifiedRounds = db.rounds.filter(r=>r.verified).length;
  document.getElementById('s-members').textContent   = db.players.length;
  document.getElementById('s-events').textContent    = eventsPlayed;
  document.getElementById('s-rounds').textContent    = verifiedRounds;
  document.getElementById('s-remaining').textContent = Math.max(0, sundays.length - eventsPlayed);

  document.getElementById('pts-bar').innerHTML =
    [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6].map((p,i)=>
      `<span class="pts-pip ${i<3?'hi':''}">${i+1}${i===0?'st':i===1?'nd':i===2?'rd':'th'}=${p}</span>`
    ).join('') + `<span class="pts-pip">rest = 6</span>`;

  if (!rows.length) {
    document.getElementById('lb-table').innerHTML='<div class="empty">No players yet</div>';
    return;
  }

  document.getElementById('lb-table').innerHTML = rows.map(p => {
    const rankClass = p.pos===1?'r1':p.pos===2?'r2':p.pos===3?'r3':'rn';
    const posStr    = p.pos===1?'1st':p.pos===2?'2nd':p.pos===3?'3rd':p.pos+'th';
    return `<div class="lb-card">
      <div class="rank ${rankClass}">${posStr}</div>
      <button onclick="showPlayerProfile('${p.id}')" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;background:none;border:none;cursor:pointer;padding:0;text-align:left">
        ${avatarHtml(p, 34, 12)}
        <div class="lb-card-info">
          <div class="lb-card-name" style="color:var(--text)">${p.name}</div>
          <div class="lb-card-sub">Hcp ${parseFloat(p.handicap_index).toFixed(1)} · ${p.rounds} round${p.rounds!==1?'s':''} · Best ${p.best||'—'} · Avg ${p.avg}</div>
        </div>
      </button>
      <div class="lb-card-pts">${p.lp}</div>
    </div>`;
  }).join('');
}

function viewEventResults(eid) {
  const ev = db.events.find(e=>e.id===eid);
  if (!ev) return;
  const ranked = assignLeaguePts(db.rounds.filter(r=>r.event_id===eid).map(r=>({...r})));
  document.getElementById('modal-title').textContent = `${ev.course_name} · ${fmtDate(ev.event_date)}`;
  document.getElementById('modal-body').innerHTML = !ranked.length
    ? '<div class="empty">No rounds recorded yet</div>'
    : ranked.map((r,i)=>{
        const p = db.players.find(x=>x.id===r.player_id);
        const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
        const rankBg  = i===0?'#FAEEDA':i===1?'#F1EFE8':i===2?'#FAECE7':'var(--bg)';
        const rankCol = i===0?'#633806':i===1?'#444441':i===2?'#712B13':'var(--text-3)';
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:0.5px solid var(--border)">
          <div style="width:28px;height:28px;border-radius:50%;background:${rankBg};color:${rankCol};font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0">${medal||i+1}</div>
          <div class="avatar" style="flex-shrink:0">${p?initials(p.name):'?'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:500;color:var(--text)">${p?p.name:'Unknown'}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px">${r.stableford_points} pts · Gross ${r.gross_score} · Hcp ${r.course_handicap}</div>
          </div>
          <span class="badge ${r._lp>=18?'gold':r._lp>=12?'green':'gray'}" style="font-size:10px;flex-shrink:0">${r._lp} lp</span>
        </div>`;
      }).join('');
  document.getElementById('modal-overlay').classList.add('open');
}
