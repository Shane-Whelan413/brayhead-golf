// ── Knockout Competition ──────────────────────────────────────────────────

const ROUND_NAMES = ['Round of 32','Round of 16','Quarter-finals','Semi-finals','Final'];

function renderKnockout() {
  const el = document.getElementById('knockout-content');
  if (!el) return;
  const matches = db.knockout_matches;
  const rounds = [...new Set(matches.map(m=>m.round))].sort((a,b)=>a-b);
  const roundNames = {1:'Round of 32',2:'Round of 16',3:'Quarter-finals',4:'Semi-finals',5:'Final'};

  const adminBtns = isAdmin ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.25rem">
      ${matches.length===0 ? `<button class="btn primary" onclick="showKnockoutSetup()">Set up draw</button>` : ''}
      ${matches.length>0 ? `<button class="btn" onclick="showKnockoutSetup()">Edit draw</button>` : ''}
      ${matches.length>0 ? `<button class="btn" style="background:#fef8e6;color:#8a6a1a;border-color:#C9A84C" onclick="showFixturePost()">📋 Post fixtures</button>` : ''}
      ${matches.length>0 ? `<button class="btn" style="background:#fef8e6;color:#8a6a1a;border-color:#C9A84C" onclick="postKnockoutResults()">📊 Post Round 1 results</button>` : ''}
    </div>` : '';

  if (!matches.length) {
    el.innerHTML = adminBtns + `<div class="card"><div class="empty">The knockout draw has not been set up yet</div></div>`;
    return;
  }

  const finalMatch = matches.find(m=>m.round===Math.max(...rounds));
  const champion = finalMatch?.winner_id ? db.players.find(p=>p.id===finalMatch.winner_id) : null;

  const championHtml = champion ? `
    <div class="ko-champion">
      <div class="ko-champion-trophy">🏆</div>
      <div class="ko-champion-name">${champion.name}</div>
      <div class="ko-champion-label">2026 Knockout Champion</div>
    </div>` : '';

  const roundsHtml = rounds.map(round => {
    const roundMatches = matches.filter(m=>m.round===round).sort((a,b)=>a.match_number-b.match_number);
    const doneCount = roundMatches.filter(m=>m.status==='complete').length;
    const playoffCount = roundMatches.filter(m=>m.status==='playoff').length;

    const matchesHtml = roundMatches.map(m => {
      const p1 = m.player1_id ? db.players.find(p=>p.id===m.player1_id) : null;
      const p2 = m.player2_id ? db.players.find(p=>p.id===m.player2_id) : null;
      const w  = m.winner_id ? m.winner_id : null;
      const p1Won = w && w===m.player1_id;
      const p2Won = w && w===m.player2_id;
      const winner = p1Won ? p1 : p2Won ? p2 : null;
      const isPlayoff = m.status === 'playoff';
      const isComplete = m.status === 'complete';

      if (m.is_bye) {
        return `<div class="ko-match">
          <div class="ko-bye">
            <div class="avatar">${p1?initials(p1.name):'?'}</div>
            <div class="ko-player-info">
              <div class="ko-player-name">${p1?p1.name:'TBD'}</div>
              <div class="ko-player-hcp">Hcp ${p1?parseFloat(p1.handicap_index).toFixed(1):'—'}</div>
            </div>
            <span class="badge green">Bye</span>
          </div>
        </div>`;
      }

      const playoffStrip = isPlayoff ? `
        <div class="ko-playoff-strip">
          <span style="font-size:15px">⚡</span>
          <span class="ko-playoff-strip-label">PLAYOFF — to be decided</span>
        </div>` : '';

      const resultCard = isComplete && winner ? (() => {
        const ev = m.event_card_id ? db.events.find(e=>e.id===m.event_card_id) : null;
        return `<div class="ko-result-card">
          <div class="ko-result-trophy">🏆</div>
          <div class="ko-result-winner">${winner.name}</div>
          <div class="ko-result-score">${m.result||''}</div>
          ${ev ? `<div class="ko-result-meta">via ${ev.course_name} · ${fmtDate(ev.event_date)}</div>` : ''}
        </div>`;
      })() : '';

      const adminBtn = isAdmin
        ? isComplete
          ? `<button class="btn sm" onclick="showMatchEntry('${m.id}')" style="margin-left:auto">Edit</button>`
          : p1 && p2
          ? `<button class="btn sm" onclick="${isPlayoff?`resolvePlayoff('${m.id}')`:`showMatchEntry('${m.id}')`}" style="margin-left:auto;${isPlayoff?'background:#C9A84C;color:#3a2000;border-color:#C9A84C':''}">${isPlayoff?'⚡ Resolve':'Settle match'}</button>`
          : ''
        : '';

      const viewBtn = isComplete && m.event_card_id
        ? `<button class="btn sm" onclick="viewMatchBreakdown('${m.id}')" style="font-size:11px">View holes</button>`
        : '';

      return `<div class="ko-match${isComplete?' complete':isPlayoff?' playoff':''}">
        ${playoffStrip}
        <div class="ko-player">
          <div class="avatar${p1Won?' gold':''}">` + (p1?initials(p1.name):'?') + `</div>
          <div class="ko-player-info">
            <div class="ko-player-name${p1Won?' winner':p2Won?' loser':''}">${p1?p1.name:'TBD'}</div>
            <div class="ko-player-hcp">Hcp ${p1?parseFloat(p1.handicap_index).toFixed(1):'—'}</div>
          </div>
          ${p1Won ? '<span class="ko-winner-tick">✓</span>' : ''}
        </div>
        ${isComplete ? resultCard : `<div class="ko-player">
          <div class="avatar${p2Won?' gold':''}">` + (p2?initials(p2.name):'?') + `</div>
          <div class="ko-player-info">
            <div class="ko-player-name${p2Won?' winner':p1Won?' loser':''}">${p2?p2.name:'TBD'}</div>
            <div class="ko-player-hcp">Hcp ${p2?parseFloat(p2.handicap_index).toFixed(1):'—'}</div>
          </div>
          ${p2Won ? '<span class="ko-winner-tick">✓</span>' : ''}
        </div>`}
        <div class="ko-match-footer">
          ${isComplete
            ? `<span class="badge green">Done</span>${viewBtn}${adminBtn}`
            : isPlayoff
            ? adminBtn
            : `<span class="badge gray">Pending</span>${adminBtn}`
          }
        </div>
      </div>`;
    }).join('');

    return `<div class="ko-round">
      <div class="ko-round-header">
        <span class="ko-round-title">${roundNames[round]||'Round '+round}</span>
        <span class="ko-round-count">${doneCount}/${roundMatches.length} complete${playoffCount>0?' · '+playoffCount+' playoff':''}</span>
      </div>
      ${matchesHtml}
    </div>`;
  }).join('');

  el.innerHTML = adminBtns + championHtml + roundsHtml;
}

function showSetupDraw() {
  const matches = db.knockout_matches;
  const hasMatches = matches.length > 0;
  const playerOpts = db.players.map(p=>`<option value="${p.id}">${p.name} (Hcp ${parseFloat(p.handicap_index).toFixed(1)})</option>`).join('');

  const el = document.getElementById('knockout-content');
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem">
      <button class="btn sm" onclick="renderKnockout()">← Back</button>
      <span style="font-family:'DM Serif Display',serif;font-size:18px">Manage draw</span>
    </div>
    <div class="card" style="margin-bottom:1rem">
      <div class="card-title">Add a match</div>
      ${hasMatches ? `<div style="background:#FAEEDA;border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:#633806">${matches.length} match${matches.length!==1?'es':''} in draw so far</div>` : ''}
      <div class="form-group" style="margin-bottom:10px">
        <label>Player 1</label>
        <select id="kp1" style="width:100%"><option value="">Select…</option>${playerOpts}</select>
      </div>
      <div class="form-group" style="margin-bottom:10px">
        <label>Is this a bye?</label>
        <select id="kbye" style="width:100%" onchange="document.getElementById('kp2-wrap').style.display=this.value==='true'?'none':''">
          <option value="false">No — normal match</option>
          <option value="true">Yes — bye for Player 1</option>
        </select>
      </div>
      <div class="form-group" id="kp2-wrap" style="margin-bottom:10px">
        <label>Player 2</label>
        <select id="kp2" style="width:100%"><option value="">Select…</option>${playerOpts}</select>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label>Holes</label>
        <select id="kh" style="width:100%">
          <option value="9">9 holes</option>
          <option value="18">18 holes</option>
        </select>
      </div>
      <button class="btn primary" onclick="addKnockoutMatch()" style="width:100%">Add match to draw</button>
    </div>
    ${hasMatches ? `
    <div class="card">
      <div class="card-title">Current draw (${matches.length} matches)</div>
      ${matches.sort((a,b)=>a.round-b.round||a.match_number-b.match_number).map(m=>{
        const p1=db.players.find(p=>p.id===m.player1_id);
        const p2=db.players.find(p=>p.id===m.player2_id);
        const rn=ROUND_NAMES[m.round-1]||`Round ${m.round}`;
        return `<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:0.5px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;color:var(--text)">${p1?p1.name:'?'} ${m.is_bye?'<span class="badge green" style="font-size:10px">Bye</span>':'vs '+(p2?p2.name:'TBD')}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px">${rn} · Match ${m.match_number} · ${m.holes||18} holes · <span class="badge ${m.status==='complete'?'green':'gray'}" style="font-size:10px">${m.status}</span></div>
          </div>
          <button class="btn sm danger" onclick="deleteKnockoutMatch('${m.id}')">Remove</button>
        </div>`;
      }).join('')}
    </div>` : ''}
  `;
}

async function addKnockoutMatch() {
  const p1id  = document.getElementById('kp1').value;
  const p2id  = document.getElementById('kp2').value;
  const holes = parseInt(document.getElementById('kh').value);
  const isBye = document.getElementById('kbye').value === 'true';
  if (!p1id) { toast('Select Player 1', 'error'); return; }
  if (!isBye && !p2id) { toast('Select Player 2', 'error'); return; }
  if (!isBye && p1id === p2id) { toast('Players must be different', 'error'); return; }
  const existing = db.knockout_matches.filter(m=>m.round===1);
  const matchNum = existing.length + 1;
  try {
    await post('knockout_matches', { round:1, match_number:matchNum, player1_id:p1id, player2_id:isBye?null:p2id, is_bye:isBye, holes, status:isBye?'complete':'pending', winner_id:isBye?p1id:null });
    toast('Match added!', 'success');
    await loadAll(); renderAll();
    showSetupDraw();
  } catch(e) { toast('Error: '+e.message, 'error'); }
}

async function deleteKnockoutMatch(mid) {
  if (!confirm('Remove this match from the draw?')) return;
  try {
    await del(`knockout_matches?id=eq.${mid}`);
    toast('Match removed', 'success');
    await loadAll(); renderAll();
    showSetupDraw();
  } catch(e) { toast('Error: '+e.message, 'error'); }
}

function showEnterMatchResult(mid) {
  const m  = db.knockout_matches.find(x=>x.id===mid);
  if (!m) return;
  const p1 = db.players.find(p=>p.id===m.player1_id);
  const p2 = db.players.find(p=>p.id===m.player2_id);
  const n  = m.holes || 18;
  const hcp1 = p1 ? Math.round(parseFloat(p1.handicap_index)) : 0;
  const hcp2 = p2 ? Math.round(parseFloat(p2.handicap_index)) : 0;
  const strokes = Math.abs(hcp1 - hcp2);
  const higherHcp = hcp1 >= hcp2 ? p1 : p2;

  const holeGrid = (prefix) => Array.from({length:n},(_,i)=>
    `<div style="width:44px">
      <div class="hole-lbl">H${i+1}</div>
      <input type="number" id="${prefix}${i+1}" min="1" max="15" placeholder="—" style="width:44px;height:44px;text-align:center;font-size:16px;font-weight:600;border-radius:8px;border:1.5px solid var(--border-strong);background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif">
    </div>`
  ).join('');

  const el = document.getElementById('knockout-content');
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem">
      <button class="btn sm" onclick="renderKnockout()">← Back</button>
      <span style="font-family:'DM Serif Display',serif;font-size:18px">${p1?p1.name:'?'} vs ${p2?p2.name:'?'}</span>
    </div>
    <div class="card" style="margin-bottom:1rem">
      <div style="background:var(--green-light);border-radius:8px;padding:10px;margin-bottom:14px;font-size:13px;color:var(--green-dark)">
        ${strokes>0?`${higherHcp?higherHcp.name:''} receives <strong>${strokes} stroke${strokes!==1?'s':''}</strong> on the hardest ${strokes} hole${strokes!==1?'s':''}`:'Match play off scratch — no strokes given'}
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:8px">${p1?p1.name:'Player 1'} scores</div>
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">${holeGrid('mp1h')}</div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:8px">${p2?p2.name:'Player 2'} scores</div>
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">${holeGrid('mp2h')}</div>
      </div>
      <div id="match-result-preview" style="margin-bottom:12px"></div>
      <button class="btn" style="width:100%;margin-bottom:8px" onclick="previewMatchResult('${mid}')">Calculate result</button>
      <button class="btn primary" id="btn-save-match" onclick="saveMatchResult('${mid}')" style="width:100%;display:none">Save result</button>
    </div>
  `;
}

function previewMatchResult(mid) {
  const m  = db.knockout_matches.find(x=>x.id===mid);
  const p1 = db.players.find(p=>p.id===m.player1_id);
  const p2 = db.players.find(p=>p.id===m.player2_id);
  const n  = m.holes || 18;
  const hcp1 = p1 ? Math.round(parseFloat(p1.handicap_index)) : 0;
  const hcp2 = p2 ? Math.round(parseFloat(p2.handicap_index)) : 0;
  const diff = Math.abs(hcp1-hcp2);
  const si = Array.from({length:n},(_,i)=>i+1);

  const scores1=[], scores2=[];
  for(let i=1;i<=n;i++){
    const v1=parseInt(document.getElementById('mp1h'+i)?.value);
    const v2=parseInt(document.getElementById('mp2h'+i)?.value);
    scores1.push(isNaN(v1)?null:v1);
    scores2.push(isNaN(v2)?null:v2);
  }
  if(scores1.some(s=>s===null)||scores2.some(s=>s===null)){ toast('Enter all scores first','error'); return; }

  let p1up=0;
  for(let i=0;i<n;i++){
    const stroke = si[i] <= diff ? 1 : 0;
    const adj1 = hcp1>=hcp2 ? scores1[i]-stroke : scores1[i];
    const adj2 = hcp2>=hcp1 ? scores2[i]-stroke : scores2[i];
    if(adj1<adj2) p1up++;
    else if(adj2<adj1) p1up--;
  }

  let resultStr, winnerId;
  if(p1up>0){ resultStr=`${p1?p1.name.split(' ')[0]:'P1'} wins ${p1up} up`; winnerId=m.player1_id; }
  else if(p1up<0){ resultStr=`${p2?p2.name.split(' ')[0]:'P2'} wins ${Math.abs(p1up)} up`; winnerId=m.player2_id; }
  else { resultStr='All square — sudden death needed'; winnerId=null; }

  const prev = document.getElementById('match-result-preview');
  prev.innerHTML = `<div style="background:${winnerId?'var(--green-light)':'#FAEEDA'};border-radius:8px;padding:10px;font-size:13px;font-weight:600;color:${winnerId?'var(--green-dark)':'#633806'};text-align:center">${resultStr}</div>`;
  prev.dataset.winner = winnerId||'';
  prev.dataset.result = resultStr;
  prev.dataset.scores1 = JSON.stringify(scores1);
  prev.dataset.scores2 = JSON.stringify(scores2);
  if(winnerId) document.getElementById('btn-save-match').style.display='';
}

async function saveMatchResult(mid) {
  const prev = document.getElementById('match-result-preview');
  const winnerId = prev.dataset.winner;
  const resultStr = prev.dataset.result;
  if(!winnerId){ toast('Result is all square — resolve before saving','error'); return; }
  const m = db.knockout_matches.find(x=>x.id===mid);
  try {
    await patch(`knockout_matches?id=eq.${mid}`, { winner_id:winnerId, result:resultStr, status:'complete' });
    await advanceWinner(m, winnerId);
    toast('Result saved! Winner advances.', 'success');
    await loadAll(); renderKnockout();
  } catch(e) { toast('Error: '+e.message, 'error'); }
}

function viewMatchBreakdown(mid) {
  const m = db.knockout_matches.find(x=>x.id===mid);
  if (!m||!m.event_card_id) return;
  const p1 = db.players.find(p=>p.id===m.player1_id);
  const p2 = db.players.find(p=>p.id===m.player2_id);
  const ev = db.events.find(e=>e.id===m.event_card_id);
  if (!p1||!p2||!ev) return;
  const r1 = db.rounds.find(r=>r.event_id===m.event_card_id&&r.player_id===m.player1_id&&r.verified);
  const r2 = db.rounds.find(r=>r.event_id===m.event_card_id&&r.player_id===m.player2_id&&r.verified);
  if (!r1||!r2) { toast('Round data not found','error'); return; }
  const n = ev.event_type==='outing_18'?18:9;
  const pts1=[],pts2=[];
  for(let i=0;i<n;i++){ pts1.push(calcHolePts(r1,i)); pts2.push(calcHolePts(r2,i)); }
  let p1h=0,p2h=0,halved=0;
  const holeResults=pts1.map((p,i)=>{ if(pts1[i]>pts2[i]){p1h++;return'p1';} if(pts2[i]>pts1[i]){p2h++;return'p2';} halved++;return'half'; });
  const winner=m.winner_id===m.player1_id?p1:p2;
  const holeRows=holeResults.map((res,i)=>{
    const bg=res==='p1'?'#fef8e6':res==='p2'?'#EEEDFE':'var(--bg)';
    const icon=res==='p1'?'◀':res==='p2'?'▶':'·';
    return `<tr style="border-bottom:0.5px solid var(--border);background:${bg}">
      <td style="padding:5px 8px;font-size:12px;font-weight:600;color:var(--text-3);text-align:center">${i+1}</td>
      <td style="padding:5px 8px;font-size:13px;font-weight:${res==='p1'?'700':'400'};color:${res==='p1'?'#8a6a1a':'var(--text)'};text-align:center">${pts1[i]}</td>
      <td style="padding:5px 4px;font-size:11px;color:var(--text-3);text-align:center">${icon}</td>
      <td style="padding:5px 8px;font-size:13px;font-weight:${res==='p2'?'700':'400'};color:${res==='p2'?'#3C3489':'var(--text)'};text-align:center">${pts2[i]}</td>
    </tr>`;
  }).join('');
  document.getElementById('modal-title').textContent = `${p1.name} vs ${p2.name}`;
  document.getElementById('modal-body').innerHTML = `
    <div style="background:#0a1628;border-radius:var(--radius);padding:16px;text-align:center;margin-bottom:1rem">
      <div style="font-size:28px;margin-bottom:4px">🏆</div>
      <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#C9A84C;margin-bottom:4px">${winner.name}</div>
      <div style="font-size:14px;font-weight:600;color:white;margin-bottom:4px">${m.result||''}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.4)">${ev.course_name} · ${fmtDate(ev.event_date)}</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:1rem">
      <div style="flex:1;background:#fef8e6;border-radius:var(--radius);padding:10px;text-align:center"><div style="font-size:11px;color:#8a6a1a;font-weight:600;margin-bottom:2px">${p1.name.split(' ')[0]}</div><div style="font-size:24px;font-weight:700;color:#8a6a1a">${p1h}</div><div style="font-size:10px;color:#8a6a1a">holes won</div></div>
      <div style="flex:1;background:#f0ece4;border-radius:var(--radius);padding:10px;text-align:center"><div style="font-size:11px;color:var(--text-3);font-weight:600;margin-bottom:2px">Halved</div><div style="font-size:24px;font-weight:700;color:var(--text-2)">${halved}</div><div style="font-size:10px;color:var(--text-3)">holes</div></div>
      <div style="flex:1;background:#EEEDFE;border-radius:var(--radius);padding:10px;text-align:center"><div style="font-size:11px;color:#3C3489;font-weight:600;margin-bottom:2px">${p2.name.split(' ')[0]}</div><div style="font-size:24px;font-weight:700;color:#3C3489">${p2h}</div><div style="font-size:10px;color:#3C3489">holes won</div></div>
    </div>
    <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#0a1628">
          <th style="padding:7px 8px;font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;text-align:center">Hole</th>
          <th style="padding:7px 8px;font-size:11px;color:#C9A84C;text-align:center">${p1.name.split(' ')[0]}</th>
          <th style="padding:7px;text-align:center"></th>
          <th style="padding:7px 8px;font-size:11px;color:#EEEDFE;text-align:center">${p2.name.split(' ')[0]}</th>
        </tr></thead>
        <tbody>${holeRows}</tbody>
      </table>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}

function resolvePlayoff(mid) {
  const m = db.knockout_matches.find(x=>x.id===mid);
  if (!m) return;
  const p1 = db.players.find(p=>p.id===m.player1_id);
  const p2 = db.players.find(p=>p.id===m.player2_id);
  document.getElementById('modal-title').textContent = 'Resolve playoff';
  document.getElementById('modal-body').innerHTML = `
    <div style="background:#fef8e6;border-radius:var(--radius);padding:12px;margin-bottom:1.25rem;font-size:13px;color:#8a6a1a;font-weight:500;text-align:center">
      ⚡ ${p1?p1.name:'?'} vs ${p2?p2.name:'?'}<br>
      <span style="font-weight:400;font-size:12px">Select the winner of the playoff hole</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn primary" onclick="confirmPlayoffWinner('${mid}','${m.player1_id}')" style="padding:16px;font-size:15px;font-weight:600">🏆 ${p1?p1.name:'Player 1'} wins</button>
      <button class="btn primary" onclick="confirmPlayoffWinner('${mid}','${m.player2_id}')" style="padding:16px;font-size:15px;font-weight:600">🏆 ${p2?p2.name:'Player 2'} wins</button>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}

async function confirmPlayoffWinner(mid, winnerId) {
  const m = db.knockout_matches.find(x=>x.id===mid);
  const winner = db.players.find(p=>p.id===winnerId);
  if (!m||!winner) return;
  try {
    await patch(`knockout_matches?id=eq.${mid}`, { status:'complete', winner_id:winnerId, result:`${winner.name.split(' ')[0]} wins playoff hole` });
    await advanceWinner(m, winnerId);
    toast(`${winner.name} advances!`, 'success');
    closeModal();
    await loadAll(); renderAll();
  } catch(e) { toast('Error: '+e.message, 'error'); }
}

function showFixturePost() {
  const pending = db.knockout_matches.filter(m=>!m.is_bye&&(m.status==='pending'||m.status==='playoff')&&m.player1_id&&m.player2_id);
  if (!pending.length) { toast('No pending matches to post','error'); return; }
  const roundNames = {1:'R32',2:'R16',3:'QF',4:'SF',5:'Final'};
  const matchChecks = pending.map(m=>{
    const p1=db.players.find(p=>p.id===m.player1_id);
    const p2=db.players.find(p=>p.id===m.player2_id);
    const round=roundNames[m.round]||`R${m.round}`;
    return `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);cursor:pointer;margin-bottom:6px">
      <input type="checkbox" id="fix-m-${m.id}" value="${m.id}" style="width:18px;height:18px;accent-color:#C9A84C;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:500;color:var(--text)">${p1?p1.name:'?'} <span style="color:var(--text-3);font-weight:400">vs</span> ${p2?p2.name:'?'}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:1px">${round}${m.status==='playoff'?' · ⚡ Playoff':''}</div>
      </div>
    </label>`;
  }).join('');
  window._fixturePostIds = pending.map(m=>m.id);
  document.getElementById('modal-title').textContent = "Post this week's fixtures";
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group" style="margin-bottom:1rem">
      <label>Note <span style="font-weight:400;color:var(--text-3)">(optional — e.g. "Play by Sunday 3rd May")</span></label>
      <input id="fix-note" placeholder="e.g. Play by Sunday 3rd May" />
    </div>
    <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Select matches playing this week</div>
    ${matchChecks}
    <div style="display:flex;gap:8px;margin-top:1rem">
      <button class="btn sm" onclick="document.querySelectorAll('[id^=fix-m-]').forEach(cb=>cb.checked=true)" style="flex:1">Select all</button>
      <button class="btn primary" onclick="saveFixturePost()" style="flex:2">Post to home</button>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}

async function saveFixturePost() {
  const allIds = window._fixturePostIds || [];
  const selected = allIds.filter(id=>document.getElementById('fix-m-'+id)?.checked);
  if (!selected.length) { toast('Select at least one match','error'); return; }
  const note = document.getElementById('fix-note').value.trim()||null;
  const matchData = selected.map(id=>{
    const m=db.knockout_matches.find(x=>x.id===id);
    const p1=db.players.find(p=>p.id===m?.player1_id);
    const p2=db.players.find(p=>p.id===m?.player2_id);
    return { matchId:id, p1Name:p1?.name||'?', p2Name:p2?.name||'?', round:m?.round||1, isPlayoff:m?.status==='playoff' };
  });
  try {
    await post('noticeboard',{ post_type:'fixtures', custom_text:note, fixture_matches:matchData });
    toast('Fixtures posted!','success');
    closeModal();
    await loadAll(); renderAll();
  } catch(e) { toast('Error: '+e.message,'error'); }
}

async function postKnockoutResults() {
  const round1 = db.knockout_matches.filter(m=>m.round===1).sort((a,b)=>a.match_number-b.match_number);
  if (!round1.length) { toast('No Round 1 matches found','error'); return; }
  const matchData = round1.map(m=>{
    const p1=db.players.find(p=>p.id===m.player1_id);
    const p2=db.players.find(p=>p.id===m.player2_id);
    const winner=m.winner_id?db.players.find(p=>p.id===m.winner_id):null;
    return { matchId:m.id, p1Name:p1?.name||'?', p2Name:p2?.name||'?', winnerName:winner?.name||null, result:m.result||null, status:m.status, isBye:m.is_bye||false };
  });
  const completed = round1.filter(m=>m.status==='complete'&&!m.is_bye).length;
  const total = round1.filter(m=>!m.is_bye).length;
  try {
    const existing = db.noticeboard.find(n=>n.post_type==='knockout_results');
    if (existing) {
      await patch(`noticeboard?id=eq.${existing.id}`, { fixture_matches:matchData });
      toast(`Round 1 results updated — ${completed}/${total} complete`,'success');
    } else {
      await post('noticeboard', { post_type:'knockout_results', fixture_matches:matchData });
      toast(`Round 1 results posted — ${completed}/${total} complete`,'success');
    }
    await loadAll(); renderAll();
  } catch(e) { toast('Error: '+e.message,'error'); }
}

function showKnockoutSetup() {
  const existing = db.knockout_matches.filter(m=>m.round===1);
  const playerOpts = db.players.map(p=>`<option value="${p.id}">${p.name} (${parseFloat(p.handicap_index).toFixed(1)})</option>`).join('');
  let matchSlots = '';
  for (let i=1; i<=16; i++) {
    const m = existing.find(x=>x.match_number===i);
    const isBye = m?.is_bye || false;
    matchSlots += `<div style="background:var(--bg);border-radius:var(--radius);padding:10px;margin-bottom:8px">
      <div style="font-size:11px;color:var(--text-3);font-weight:500;margin-bottom:6px">Match ${i}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <select id="ko-p1-${i}" style="flex:1;height:34px;font-size:12px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);padding:0 8px;font-family:'DM Sans',sans-serif">
          <option value="">— Player 1 —</option>${playerOpts}
        </select>
        <span style="font-size:12px;color:var(--text-3)">vs</span>
        <select id="ko-p2-${i}" style="flex:1;height:34px;font-size:12px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);padding:0 8px;font-family:'DM Sans',sans-serif">
          <option value="">— Bye —</option>${playerOpts}
        </select>
      </div>
      <label style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:6px">
        <input type="checkbox" id="ko-bye-${i}" ${isBye?'checked':''} onchange="document.getElementById('ko-p2-${i}').disabled=this.checked"> This is a bye match
      </label>
    </div>`;
  }
  document.getElementById('modal-title').textContent = 'Set up knockout draw';
  document.getElementById('modal-body').innerHTML = `
    <p style="font-size:13px;color:var(--text-2);margin-bottom:1rem">Set up the Round of 32 draw. Winners automatically advance.</p>
    ${matchSlots}
    <button class="btn primary" onclick="saveKnockoutDraw()" style="width:100%;margin-top:8px">Save draw</button>`;
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(()=>{
    existing.forEach(m=>{
      const p1el=document.getElementById('ko-p1-'+m.match_number);
      const p2el=document.getElementById('ko-p2-'+m.match_number);
      const byeEl=document.getElementById('ko-bye-'+m.match_number);
      if(p1el&&m.player1_id) p1el.value=m.player1_id;
      if(p2el&&m.player2_id) p2el.value=m.player2_id;
      if(byeEl&&m.is_bye){byeEl.checked=true;if(p2el)p2el.disabled=true;}
    });
  }, 50);
}

async function saveKnockoutDraw() {
  const existing = db.knockout_matches.filter(m=>m.round===1);
  try {
    for (let i=1; i<=16; i++) {
      const p1=document.getElementById('ko-p1-'+i)?.value||null;
      const p2=document.getElementById('ko-p2-'+i)?.value||null;
      const isBye=document.getElementById('ko-bye-'+i)?.checked||false;
      if (!p1) continue;
      const data={round:1,match_number:i,player1_id:p1,player2_id:isBye?null:p2,is_bye:isBye,status:isBye?'complete':'pending',winner_id:isBye?p1:null};
      const existing_m=existing.find(m=>m.match_number===i);
      if(existing_m) await patch(`knockout_matches?id=eq.${existing_m.id}`,data);
      else await post('knockout_matches',data);
    }
    toast('Draw saved!','success');
    closeModal();
    await loadAll(); renderAll();
  } catch(e) { toast('Error: '+e.message,'error'); }
}

function showMatchEntry(mid) {
  const m=db.knockout_matches.find(x=>x.id===mid); if(!m)return;
  const p1=db.players.find(p=>p.id===m.player1_id);
  const p2=db.players.find(p=>p.id===m.player2_id);
  if(!p1||!p2)return;
  const publishedEvents=db.events.filter(e=>e.published);
  const eventOptions=publishedEvents.map(e=>{
    const r1=db.rounds.find(r=>r.event_id===e.id&&r.player_id===m.player1_id&&r.verified);
    const r2=db.rounds.find(r=>r.event_id===e.id&&r.player_id===m.player2_id&&r.verified);
    const both=r1&&r2;
    return `<option value="${e.id}" ${!both?'disabled':''} ${m.event_card_id===e.id?'selected':''}>${e.course_name} — ${fmtDate(e.event_date)}${both?'':' (missing card)'}</option>`;
  }).join('');
  const isPlayoff=m.status==='playoff';
  document.getElementById('modal-title').textContent=`${p1.name} vs ${p2.name}`;
  document.getElementById('modal-body').innerHTML=`
    ${isPlayoff?`<div style="background:#EEEDFE;border-radius:var(--radius);padding:10px 12px;margin-bottom:1rem;font-size:13px;color:#3C3489;font-weight:500">🔄 This match went to a playoff — pick the event card to resolve it.</div>`:''}
    <div class="form-group" style="margin-bottom:1rem">
      <label>Select event card to use</label>
      <select id="match-event-sel" onchange="previewMatchCards('${mid}')" style="width:100%">
        <option value="">— pick an event —</option>${eventOptions}
      </select>
    </div>
    <div id="match-card-preview"></div>`;
  document.getElementById('modal-overlay').classList.add('open');
  if(m.event_card_id) setTimeout(()=>previewMatchCards(mid),50);
}

function previewMatchCards(mid) {
  const m=db.knockout_matches.find(x=>x.id===mid);
  const p1=db.players.find(p=>p.id===m.player1_id);
  const p2=db.players.find(p=>p.id===m.player2_id);
  const eid=document.getElementById('match-event-sel').value; if(!eid)return;
  const ev=db.events.find(e=>e.id===eid);
  const r1=db.rounds.find(r=>r.event_id===eid&&r.player_id===m.player1_id&&r.verified);
  const r2=db.rounds.find(r=>r.event_id===eid&&r.player_id===m.player2_id&&r.verified);
  const preview=document.getElementById('match-card-preview');
  if(!r1||!r2){preview.innerHTML=`<div style="background:#FCEBEB;border-radius:var(--radius);padding:10px;font-size:13px;color:#A32D2D">${!r1?p1.name:p2.name} has no verified round for this event.</div>`;return;}
  const n=ev.event_type==='outing_18'?18:9;
  const pts1=[],pts2=[];
  for(let i=0;i<n;i++){pts1.push(calcHolePts(r1,i));pts2.push(calcHolePts(r2,i));}
  let p1holes=0,p2holes=0,halved=0;
  const holeResults=pts1.map((p,i)=>{if(pts1[i]>pts2[i]){p1holes++;return'p1';}if(pts2[i]>pts1[i]){p2holes++;return'p2';}halved++;return'half';});
  const diff=p1holes-p2holes;
  let resultStr,winnerId,isPlayoffResult=false;
  if(diff>0){resultStr=`${p1.name.split(' ')[0]} wins ${p1holes} holes to ${p2holes}`;winnerId=m.player1_id;}
  else if(diff<0){resultStr=`${p2.name.split(' ')[0]} wins ${p2holes} holes to ${p1holes}`;winnerId=m.player2_id;}
  else{resultStr=`All square — ${p1holes} holes each · Playoff required`;winnerId=null;isPlayoffResult=true;}
  const holeRows=holeResults.map((res,i)=>{const bg=res==='p1'?'#fef8e6':res==='p2'?'#EEEDFE':'var(--bg)';const icon=res==='p1'?'◀':res==='p2'?'▶':'·';return`<tr style="border-bottom:0.5px solid var(--border);background:${bg}"><td style="padding:5px 8px;font-size:12px;font-weight:600;color:var(--text-3);text-align:center">${i+1}</td><td style="padding:5px 8px;font-size:13px;font-weight:${res==='p1'?'700':'400'};color:${res==='p1'?'#8a6a1a':'var(--text)'};text-align:center">${pts1[i]}</td><td style="padding:5px 4px;font-size:11px;color:var(--text-3);text-align:center">${icon}</td><td style="padding:5px 8px;font-size:13px;font-weight:${res==='p2'?'700':'400'};color:${res==='p2'?'#3C3489':'var(--text)'};text-align:center">${pts2[i]}</td></tr>`;}).join('');
  preview.innerHTML=`
    <div style="background:${isPlayoffResult?'#FAEEDA':winnerId?'var(--green-light)':'var(--bg)'};border-radius:var(--radius);padding:12px;margin-bottom:1rem;text-align:center">
      <div style="font-size:15px;font-weight:700;color:${isPlayoffResult?'#633806':winnerId?'var(--green-dark)':'var(--text)'}">${resultStr}</div>
      <div style="font-size:12px;color:var(--text-3);margin-top:4px">${halved} halved · ${p1.name.split(' ')[0]}: ${r1.stableford_points} pts · ${p2.name.split(' ')[0]}: ${r2.stableford_points} pts</div>
    </div>
    <details style="margin-bottom:1rem"><summary style="font-size:12px;font-weight:600;color:var(--text-2);cursor:pointer;padding:8px 0;list-style:none">▸ Hole-by-hole breakdown</summary>
      <div style="margin-top:8px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden"><table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#0a1628"><th style="padding:6px 8px;font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;text-align:center">Hole</th><th style="padding:6px 8px;font-size:11px;color:#C9A84C;text-align:center">${p1.name.split(' ')[0]}</th><th style="padding:6px;text-align:center"></th><th style="padding:6px 8px;font-size:11px;color:#EEEDFE;text-align:center">${p2.name.split(' ')[0]}</th></tr></thead>
        <tbody>${holeRows}</tbody>
        <tfoot><tr style="border-top:1.5px solid var(--border);background:var(--bg)"><td style="padding:7px 8px;font-size:11px;font-weight:600;color:var(--text-3);text-align:center">Total</td><td style="padding:7px 8px;font-size:13px;font-weight:700;color:#8a6a1a;text-align:center">${p1holes}</td><td style="padding:7px;font-size:11px;color:var(--text-3);text-align:center">holes</td><td style="padding:7px 8px;font-size:13px;font-weight:700;color:#3C3489;text-align:center">${p2holes}</td></tr></tfoot>
      </table></div>
    </details>
    ${isPlayoffResult
      ?`<button class="btn primary" onclick="saveMatchPlayoff('${mid}','${eid}')" style="width:100%">Mark as Playoff</button>`
      :`<button class="btn primary" onclick="saveMatchFromCards('${mid}','${eid}','${winnerId}',\`${resultStr}\`)" style="width:100%">Save result & advance winner</button>`}`;
}

async function saveMatchFromCards(mid, eid, winnerId, resultStr) {
  const m=db.knockout_matches.find(x=>x.id===mid); if(!m)return;
  try{
    await patch(`knockout_matches?id=eq.${mid}`,{status:'complete',winner_id:winnerId,result:resultStr,event_card_id:eid});
    await advanceWinner(m,winnerId);
    toast('Result saved — winner advances!','success');
    closeModal(); await loadAll(); renderAll();
  }catch(e){toast('Error: '+e.message,'error');}
}

async function saveMatchPlayoff(mid, eid) {
  try{
    await patch(`knockout_matches?id=eq.${mid}`,{status:'playoff',event_card_id:eid,result:'Playoff'});
    toast('Match marked as playoff.','success');
    closeModal(); await loadAll(); renderAll();
  }catch(e){toast('Error: '+e.message,'error');}
}

async function advanceWinner(m, winnerId) {
  const nextRound=m.round+1;
  const nextMatchNumber=Math.ceil(m.match_number/2);
  const isPlayer1Slot=m.match_number%2!==0;
  const existing=db.knockout_matches.find(x=>x.round===nextRound&&x.match_number===nextMatchNumber);
  const data=isPlayer1Slot?{player1_id:winnerId}:{player2_id:winnerId};
  if(existing) await patch(`knockout_matches?id=eq.${existing.id}`,data);
  else await post('knockout_matches',{round:nextRound,match_number:nextMatchNumber,...data,status:'pending'});
}
