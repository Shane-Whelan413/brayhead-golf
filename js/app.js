// ── Players ───────────────────────────────────────────────────────────────

function renderPlayers() {
  const el = document.getElementById('players-table');
  if (!db.players.length) { el.innerHTML='<div class="empty">No players yet</div>'; return; }
  const publishedEids = new Set(db.events.filter(e=>e.published).map(e=>e.id));
  const byEvent = {};
  for (const r of db.rounds.filter(x=>x.verified && publishedEids.has(x.event_id))) {
    if (!byEvent[r.event_id]) byEvent[r.event_id]=[];
    byEvent[r.event_id].push({...r});
  }
  for (const eid in byEvent) assignLeaguePts(byEvent[eid]);
  el.innerHTML = db.players.map(p=>{
    const rounds=db.rounds.filter(r=>r.player_id===p.id&&r.verified&&publishedEids.has(r.event_id));
    let lp=0;
    for(const eid in byEvent){const r=byEvent[eid].find(x=>x.player_id===p.id);if(r)lp+=r._lp;}
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:${isAdmin?'10px':'0'}">
        <div class="avatar" style="flex-shrink:0;overflow:hidden;padding:0">${avatarHtml(p,40,13)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:15px;color:var(--text)">${p.name}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px">Hcp <strong>${parseFloat(p.handicap_index).toFixed(1)}</strong> · ${rounds.length} round${rounds.length!==1?'s':''} · ${lp} pts${p.plays_womens_index?` · <span style="color:#3C3489;font-weight:500">W</span>`:''}</div>
        </div>
        <button class="btn sm" onclick="viewPlayerRounds('${p.id}','${p.name.replace(/'/g,"\\'")}')">Rounds</button>
      </div>
      ${isAdmin?`<div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn sm" onclick="editHandicap('${p.id}','${p.name.replace(/'/g,"\\'")}',${p.handicap_index})">Edit hcp</button>
        <button class="btn sm" style="background:#EEEDFE;color:#3C3489;border-color:#AFA9EC" onclick="toggleWomensIndex('${p.id}',${!!p.plays_womens_index})">${p.plays_womens_index?"Set men's":"Set women's"}</button>
        <button class="btn sm" onclick="adminResetPin('${p.id}','${p.name.replace(/'/g,"\\'")}')">Reset PIN</button>
        <button class="btn sm danger" onclick="deletePlayer('${p.id}','${p.name.replace(/'/g,"\\'")}')">Remove</button>
      </div>`:''}
    </div>`;
  }).join('');
}

async function addPlayer() {
  const name=document.getElementById('p-name').value.trim();
  const hcp=parseFloat(document.getElementById('p-hcp').value)||18;
  if(!name){toast('Enter a name','error');return;}
  if(db.players.find(p=>p.name.toLowerCase()===name.toLowerCase())){toast('Player already exists','error');return;}
  const btn=document.getElementById('btn-add-player');btn.disabled=true;
  try{await post('players',{name,handicap_index:hcp});document.getElementById('p-name').value='';toast(`${name} added!`,'success');await loadAll();renderAll();}
  catch(e){toast('Error: '+e.message,'error');}
  btn.disabled=false;
}

async function deletePlayer(id, name) {
  if(!confirm(`Remove ${name} and all their rounds?`))return;
  try{await del(`rounds?player_id=eq.${id}`);await del(`players?id=eq.${id}`);toast(`${name} removed`,'success');await loadAll();renderAll();}
  catch(e){toast('Error: '+e.message,'error');}
}

async function editHandicap(pid, name, currentHcp) {
  document.getElementById('modal-title').textContent=`Edit handicap — ${name}`;
  document.getElementById('modal-body').innerHTML=`<div class="form-group" style="margin-bottom:1rem"><label>New handicap index</label><input type="number" id="edit-hcp-val" min="0" max="54" step="0.1" value="${parseFloat(currentHcp).toFixed(1)}" style="font-size:18px;text-align:center"/></div><button class="btn primary" onclick="saveHandicap('${pid}')" style="width:100%">Save handicap</button>`;
  document.getElementById('modal-overlay').classList.add('open');
}

async function saveHandicap(pid) {
  const val=parseFloat(document.getElementById('edit-hcp-val').value);
  if(isNaN(val)||val<0||val>54){toast('Enter a valid handicap (0–54)','error');return;}
  try{await patch(`players?id=eq.${pid}`,{handicap_index:parseFloat(val.toFixed(1))});toast('Handicap updated!','success');closeModal();await loadAll();renderAll();}
  catch(e){toast('Error: '+e.message,'error');}
}

async function adminResetPin(pid, name) {
  if(!confirm(`Reset ${name}'s PIN back to their first name?`))return;
  try{await patch(`players?id=eq.${pid}`,{pin:null});toast(`${name.split(' ')[0]}'s PIN reset`,'success');await loadAll();renderAll();}
  catch(e){toast('Error: '+e.message,'error');}
}

async function toggleWomensIndex(pid, currentVal) {
  try{await patch(`players?id=eq.${pid}`,{plays_womens_index:!currentVal});const p=db.players.find(x=>x.id===pid);toast(`${p?p.name:'Player'} set to ${!currentVal?"women's":"men's"} index`,'success');await loadAll();renderAll();}
  catch(e){toast('Error: '+e.message,'error');}
}

function viewPlayerRounds(pid, name) {
  const rounds=db.rounds.filter(r=>r.player_id===pid).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
  const canEdit=isAdmin||(currentUser&&currentUser.playerId===pid);
  document.getElementById('modal-title').textContent=`Rounds — ${name}`;
  document.getElementById('modal-body').innerHTML=!rounds.length?'<div class="empty">No rounds yet</div>':rounds.map(r=>{
    const ev=db.events.find(e=>e.id===r.event_id);
    return`<div style="padding:10px 0;border-bottom:0.5px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="min-width:0"><div style="font-size:14px;font-weight:500;color:var(--text)">${ev?ev.course_name:'Unknown'}</div><div style="font-size:11px;color:var(--text-3);margin-top:1px">${ev?fmtDate(ev.event_date):''}</div></div>
        ${r.verified?'<span class="badge green" style="font-size:10px;flex-shrink:0">✓ Verified</span>':'<span class="badge gray" style="font-size:10px;flex-shrink:0">Pending</span>'}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><span class="badge green" style="font-size:10px">${r.stableford_points} pts</span><span class="badge gray" style="font-size:10px">Gross ${r.gross_score}</span><span class="badge gray" style="font-size:10px">Hcp ${parseFloat(r.handicap_before).toFixed(1)} → ${parseFloat(r.handicap_after).toFixed(1)}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${canEdit?`<button class="btn sm" onclick="editRound('${r.id}')">Edit</button>`:''}
        ${isAdmin&&!r.verified?`<button class="btn sm" style="background:#fef8e6;color:#8a6a1a;border-color:#C9A84C" onclick="verifyRound('${r.id}')">Verify</button>`:''}
        ${isAdmin?`<button class="btn sm danger" onclick="deleteRound('${r.id}')">Delete</button>`:''}
      </div>
    </div>`;
  }).join('');
  document.getElementById('modal-overlay').classList.add('open');
}

async function deleteRound(rid) {
  if(!confirm("Delete this round? If verified, the player's handicap will revert."))return;
  const r=db.rounds.find(x=>x.id===rid);if(!r)return;
  try{
    if(r.verified)await patch(`players?id=eq.${r.player_id}`,{handicap_index:parseFloat(r.handicap_before)});
    await del(`rounds?id=eq.${rid}`);
    toast('Round deleted'+(r.verified?' — handicap reverted':''),'success');
    await loadAll();renderAll();closeModal();
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── Events ────────────────────────────────────────────────────────────────

function toggleCreateEvent() {
  const form=document.getElementById('create-event-form');
  const chev=document.getElementById('create-event-chevron');
  const open=form.style.display==='none';
  form.style.display=open?'block':'none';
  chev.style.transform=open?'rotate(90deg)':'rotate(0deg)';
}

function renderEvents() {
  const el=document.getElementById('events-table');
  if(!db.events.length){el.innerHTML='<div class="empty">No events created yet</div>';return;}
  el.innerHTML=[...db.events].reverse().map(e=>{
    const count=db.rounds.filter(r=>r.event_id===e.id).length;
    const verified=db.rounds.filter(r=>r.event_id===e.id&&r.verified).length;
    const isOuting=e.event_type==='outing_18';
    const pubBadge=e.published?`<span class="badge green" style="font-size:10px">✓ Published</span>`:`<span class="badge gray" style="font-size:10px">Unpublished</span>`;
    return`<div style="background:var(--surface);border:1px solid ${e.published?'var(--green)':'var(--border)'};border-radius:var(--radius);padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;gap:8px">
        <div><div style="font-weight:600;font-size:15px;color:var(--text)">${e.course_name}</div><div style="font-size:12px;color:var(--text-3);margin-top:2px">${fmtDate(e.event_date)} · Par ${e.par} · ${verified}/${count} verified</div><div style="margin-top:4px">${pubBadge}</div></div>
        <span class="badge ${isOuting?'purple':'blue'}" style="flex-shrink:0">${isOuting?'18-hole outing':'Sunday 9'}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn sm" onclick="viewEventResults('${e.id}')">Results</button>
        ${isAdmin?`<button class="btn sm" onclick="editEvent('${e.id}')">Edit</button>`:''}
        ${isAdmin&&verified<count?`<button class="btn sm" style="background:#fef8e6;color:#8a6a1a;border-color:#C9A84C" onclick="verifyAllRounds('${e.id}')">Verify all (${count-verified})</button>`:''}
        ${isAdmin&&e.published?`<button class="btn sm" style="background:#fef8e6;color:#8a6a1a;border-color:#C9A84C" onclick="recalcHandicaps('${e.id}')">Recalc handicaps</button>`:''}
        ${isAdmin?`<button class="btn sm" style="background:#fef8e6;color:#8a6a1a;border-color:#C9A84C" onclick="showPostUpdate('${e.id}')">Post update</button>`:''}
        ${isAdmin?`<button class="btn sm" style="background:${e.published?'#FCEBEB':'#fef8e6'};color:${e.published?'#A32D2D':'#8a6a1a'};border-color:${e.published?'#F7C1C1':'#C9A84C'}" onclick="togglePublishEvent('${e.id}',${!!e.published})">${e.published?'Unpublish':'Publish results'}</button>`:''}
        ${isAdmin?`<button class="btn sm danger" onclick="deleteEvent('${e.id}')">Delete</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function buildEventSIInputs(n) {
  ['si','wsi','par-h','wpar-h'].forEach(prefix=>{
    const lbl=document.getElementById(`e-${prefix}-labels`);
    const inp=document.getElementById(`e-${prefix}-inputs`);
    if(lbl)lbl.innerHTML=''; if(inp)inp.innerHTML='';
  });
  const siTitle=document.getElementById('e-si-title');
  const wsiTitle=document.getElementById('e-wsi-title');
  if(siTitle)siTitle.querySelector('span').textContent=`— enter 1 to ${n} from scorecard (1 = hardest)`;
  if(wsiTitle)wsiTitle.querySelector('span').textContent=`— leave blank if same as men's`;
  for(let i=1;i<=n;i++){
    [['e-si-labels','e-si-inputs','e-si','number',1,n,'e-si'+i,i],
     ['e-wsi-labels','e-wsi-inputs','e-wsi','number',1,n,'e-wsi'+i,i],
     ['e-par-labels','e-par-inputs','e-par-h','number',3,5,'e-par-h'+i,'4'],
     ['e-wpar-h-labels','e-wpar-h-inputs','e-wpar-h','number',3,5,'e-wpar-h'+i,'4']
    ].forEach(([lblId,inpId,,type,min,max,id,placeholder])=>{
      const lbl=document.getElementById(lblId); if(lbl){const d=document.createElement('div');d.className='hole-lbl';d.textContent=i;lbl.appendChild(d);}
      const inp=document.getElementById(inpId); if(inp){const f=document.createElement('input');f.type=type;f.min=min;f.max=max;f.id=id;f.placeholder=placeholder;inp.appendChild(f);}
    });
  }
}

function renderSavedCourseDropdown() {
  const sel=document.getElementById('e-saved-course');if(!sel)return;
  const courses=getSavedCourses();
  const playedNames=new Set(db.events.filter(e=>e.event_type==='outing_18').map(e=>e.course_name));
  const upcoming=Object.entries(OUTING_COURSES).filter(([name])=>!playedNames.has(name)).map(([name])=>name);
  sel.innerHTML='<option value="">— select a saved course —</option>';
  if(upcoming.length)sel.innerHTML+=`<optgroup label="Upcoming outings">${upcoming.map(name=>`<option value="outing:${name}">${name}</option>`).join('')}</optgroup>`;
  if(courses.length)sel.innerHTML+=`<optgroup label="Saved courses">${courses.map((c,i)=>`<option value="${i}">${c.name}</option>`).join('')}</optgroup>`;
}

function loadSavedCourse() {
  const sel=document.getElementById('e-saved-course');if(!sel||sel.value==='')return;
  let c;
  if(sel.value.startsWith('outing:')){const name=sel.value.replace('outing:','');c={...OUTING_COURSES[name],name};}
  else{const courses=getSavedCourses();c=courses[parseInt(sel.value)];}
  if(!c)return;
  const n=c.si?c.si.length:9;
  document.getElementById('e-type').value=n===18?'outing_18':'sunday_9';
  buildEventSIInputs(n);
  document.getElementById('e-course').value=c.name;
  document.getElementById('e-cr').value=c.cr||'';
  document.getElementById('e-slope').value=c.slope||'';
  document.getElementById('e-par').value=c.par||'';
  document.getElementById('e-wcr').value=c.wcr||'';
  document.getElementById('e-wslope').value=c.wslope||'';
  document.getElementById('e-wpar').value=c.wpar||'';
  for(let i=1;i<=n;i++){
    const ph=document.getElementById('e-par-h'+i);if(ph&&c.pars)ph.value=c.pars[i-1]||'';
    const wp=document.getElementById('e-wpar-h'+i);if(wp&&c.wpars)wp.value=c.wpars[i-1]||'';
    const si=document.getElementById('e-si'+i);if(si&&c.si)si.value=c.si[i-1]||'';
    const ws=document.getElementById('e-wsi'+i);if(ws&&c.wsi)ws.value=c.wsi[i-1]||'';
  }
  const outingDate=Object.entries(OUTINGS).find(([,name])=>name===c.name)?.[0];
  if(outingDate){const dateEl=document.getElementById('e-date');if(dateEl&&!dateEl.value)dateEl.value=outingDate;}
  toast(`Loaded ${c.name}`,'success');
}

function editSavedCourse() {
  const sel=document.getElementById('e-saved-course');if(!sel||sel.value===''){toast('Select a saved course to edit','error');return;}
  loadSavedCourse();
  const saveBtn=document.querySelector('button[onclick="saveCourse()"]');
  if(saveBtn){saveBtn.textContent='Update course';saveBtn.setAttribute('data-editing-index',sel.value);}
  toast('Edit the details below then tap Update course','success');
}

function deleteSavedCourse() {
  const sel=document.getElementById('e-saved-course');if(!sel||sel.value===''){toast('Select a saved course to delete','error');return;}
  const courses=getSavedCourses();const idx=parseInt(sel.value);const name=courses[idx]?.name||'this course';
  if(!confirm(`Delete "${name}" from saved courses?`))return;
  courses.splice(idx,1);setSavedCourses(courses);renderSavedCourseDropdown();toast(`"${name}" deleted`,'success');
}

function saveCourse() {
  const n=document.getElementById('e-type').value==='outing_18'?18:9;
  const name=document.getElementById('e-course').value.trim();if(!name){toast('Enter a course name first','error');return;}
  const pars=[],wpars=[],si=[],wsi=[];
  for(let i=1;i<=n;i++){pars.push(parseInt(document.getElementById('e-par-h'+i)?.value)||4);wpars.push(parseInt(document.getElementById('e-wpar-h'+i)?.value)||pars[i-1]);si.push(parseInt(document.getElementById('e-si'+i)?.value)||i);wsi.push(parseInt(document.getElementById('e-wsi'+i)?.value)||si[i-1]);}
  const course={name,cr:parseFloat(document.getElementById('e-cr').value)||null,slope:parseInt(document.getElementById('e-slope').value)||null,par:parseInt(document.getElementById('e-par').value)||null,wcr:parseFloat(document.getElementById('e-wcr').value)||null,wslope:parseInt(document.getElementById('e-wslope').value)||null,wpar:parseInt(document.getElementById('e-wpar').value)||null,pars,wpars,si,wsi};
  const courses=getSavedCourses();
  const saveBtn=document.querySelector('button[onclick="saveCourse()"]');
  const editingIndex=saveBtn?saveBtn.getAttribute('data-editing-index'):null;
  if(editingIndex!==null&&editingIndex!==''){courses[parseInt(editingIndex)]=course;if(saveBtn){saveBtn.textContent='Save this course';saveBtn.removeAttribute('data-editing-index');}toast(`"${name}" updated!`,'success');}
  else{const existing=courses.findIndex(c=>c.name.toLowerCase()===name.toLowerCase());if(existing>=0){if(!confirm(`Update saved course "${name}"?`))return;courses[existing]=course;}else courses.push(course);toast(`"${name}" saved!`,'success');}
  setSavedCourses(courses);renderSavedCourseDropdown();
}

function onEventTypeChange() {
  const t=document.getElementById('e-type').value;const n=t==='outing_18'?18:9;
  document.getElementById('e-cr').value=t==='outing_18'?'70.0':'35.0';
  document.getElementById('e-par').value=t==='outing_18'?'72':'36';
  buildEventSIInputs(n);
}
function onEventDateChange() { buildEventSIInputs(document.getElementById('e-type').value==='outing_18'?18:9); }

async function addEvent() {
  const date=document.getElementById('e-date').value;const type=document.getElementById('e-type').value;const course=document.getElementById('e-course').value.trim();
  const cr=parseFloat(document.getElementById('e-cr').value)||35;const slope=parseInt(document.getElementById('e-slope').value)||113;const par=parseInt(document.getElementById('e-par').value)||(type==='outing_18'?72:36);
  const wcr=parseFloat(document.getElementById('e-wcr').value)||null;const wslope=parseInt(document.getElementById('e-wslope').value)||null;const wpar=parseInt(document.getElementById('e-wpar').value)||null;
  const n=type==='outing_18'?18:9;
  if(!date||!course){toast('Enter date and course name','error');return;}
  if(db.events.find(e=>e.event_date===date)){toast('An event already exists on this date','error');return;}
  const siVals=[],wsiVals=[],parVals=[],wparVals=[];
  for(let i=1;i<=n;i++){const sv=parseInt(document.getElementById('e-si'+i)?.value);siVals.push(isNaN(sv)?i:sv);const wsv=parseInt(document.getElementById('e-wsi'+i)?.value);wsiVals.push(isNaN(wsv)?(isNaN(sv)?i:sv):wsv);const pv=parseInt(document.getElementById('e-par-h'+i)?.value);parVals.push(isNaN(pv)?4:pv);const wpv=parseInt(document.getElementById('e-wpar-h'+i)?.value);wparVals.push(isNaN(wpv)?(isNaN(pv)?4:pv):wpv);}
  const btn=document.getElementById('btn-add-event');btn.disabled=true;
  try{await post('events',{event_date:date,event_type:type,course_name:course,course_rating:cr,slope_rating:slope,par,womens_course_rating:wcr,womens_slope_rating:wslope,womens_par:wpar,stroke_index:siVals,womens_stroke_index:wsiVals,par_values:parVals,womens_par_values:wparVals});document.getElementById('e-course').value='';toast('Event created!','success');await loadAll();renderAll();}
  catch(e){toast('Error: '+e.message,'error');}
  btn.disabled=false;
}

function editEvent(eid) {
  const ev=db.events.find(e=>e.id===eid);if(!ev)return;
  const n=ev.event_type==='outing_18'?18:9;
  const si=ev.stroke_index||Array.from({length:n},(_,i)=>i+1);const wsi=ev.womens_stroke_index||si;
  const pars=ev.par_values||Array.from({length:n},()=>4);const wpars=ev.womens_par_values||pars;
  const holeRow=(idPrefix,vals,placeholder)=>Array.from({length:n},(_,i)=>`<input type="number" id="${idPrefix}${i+1}" value="${vals[i]||''}" placeholder="${placeholder}" min="1" max="${n>9?18:9}" style="height:32px;width:100%;text-align:center;font-size:12px;border-radius:6px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text);font-family:var(--font-sans)">`).join('');
  const holeLabels=Array.from({length:n},(_,i)=>`<div style="font-size:10px;text-align:center;color:var(--text-3)">${i+1}</div>`).join('');
  const grid=`display:grid;grid-template-columns:repeat(${n},minmax(0,1fr));gap:3px;margin-bottom:6px`;
  document.getElementById('modal-title').textContent=`Edit event — ${ev.course_name}`;
  document.getElementById('modal-body').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="form-group"><label>Course name</label><input id="ee-name" value="${ev.course_name}"/></div>
      <div class="form-group"><label>Date</label><input type="date" id="ee-date" value="${ev.event_date}"/></div>
      <div class="form-group"><label>Par total</label><input type="number" id="ee-par" value="${ev.par}"/></div>
    </div>
    <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Men's index</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="form-group"><label>Course rating</label><input type="number" step="0.1" id="ee-cr" value="${ev.course_rating}"/></div>
      <div class="form-group"><label>Slope</label><input type="number" id="ee-slope" value="${ev.slope_rating}"/></div>
      <div class="form-group"><label>Par</label><input type="number" id="ee-mpar" value="${ev.par}"/></div>
    </div>
    <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Women's index</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="form-group"><label>Course rating</label><input type="number" step="0.1" id="ee-wcr" value="${ev.womens_course_rating||''}" placeholder="optional"/></div>
      <div class="form-group"><label>Slope</label><input type="number" id="ee-wslope" value="${ev.womens_slope_rating||''}" placeholder="optional"/></div>
      <div class="form-group"><label>Par</label><input type="number" id="ee-wpar" value="${ev.womens_par||''}" placeholder="optional"/></div>
    </div>
    <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Men's par per hole</div>
    <div style="${grid}">${holeLabels}</div><div style="${grid};margin-bottom:10px">${holeRow('ee-ph',pars,'4')}</div>
    <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Women's par per hole</div>
    <div style="${grid}">${holeLabels}</div><div style="${grid};margin-bottom:10px">${holeRow('ee-wph',wpars,'4')}</div>
    <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Men's stroke index</div>
    <div style="${grid}">${holeLabels}</div><div style="${grid};margin-bottom:10px">${holeRow('ee-si',si,String(n))}</div>
    <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Women's stroke index</div>
    <div style="${grid}">${holeLabels}</div><div style="${grid};margin-bottom:14px">${holeRow('ee-wsi',wsi,String(n))}</div>
    <button class="btn primary" onclick="saveEditedEvent('${eid}')" style="width:100%">Save changes</button>`;
  document.getElementById('modal-overlay').classList.add('open');
}

async function saveEditedEvent(eid) {
  const ev=db.events.find(e=>e.id===eid);if(!ev)return;
  const n=ev.event_type==='outing_18'?18:9;
  const name=document.getElementById('ee-name').value.trim();const date=document.getElementById('ee-date').value;
  const par=parseInt(document.getElementById('ee-par').value)||ev.par;const cr=parseFloat(document.getElementById('ee-cr').value)||ev.course_rating;const slope=parseInt(document.getElementById('ee-slope').value)||ev.slope_rating;
  const wcr=parseFloat(document.getElementById('ee-wcr').value)||null;const wslope=parseInt(document.getElementById('ee-wslope').value)||null;const wpar=parseInt(document.getElementById('ee-wpar').value)||null;
  if(!name||!date){toast('Course name and date are required','error');return;}
  const siVals=[],wsiVals=[],parVals=[],wparVals=[];
  for(let i=1;i<=n;i++){const sv=parseInt(document.getElementById('ee-si'+i)?.value);siVals.push(isNaN(sv)?i:sv);const wsv=parseInt(document.getElementById('ee-wsi'+i)?.value);wsiVals.push(isNaN(wsv)?siVals[i-1]:wsv);const pv=parseInt(document.getElementById('ee-ph'+i)?.value);parVals.push(isNaN(pv)?4:pv);const wpv=parseInt(document.getElementById('ee-wph'+i)?.value);wparVals.push(isNaN(wpv)?parVals[i-1]:wpv);}
  try{await patch(`events?id=eq.${eid}`,{course_name:name,event_date:date,par,course_rating:cr,slope_rating:slope,womens_course_rating:wcr,womens_slope_rating:wslope,womens_par:wpar,stroke_index:siVals,womens_stroke_index:wsiVals,par_values:parVals,womens_par_values:wparVals});toast('Event updated!','success');closeModal();await loadAll();renderAll();}
  catch(e){toast('Error: '+e.message,'error');}
}

async function verifyAllRounds(eid) {
  const unverified=db.rounds.filter(r=>r.event_id===eid&&!r.verified);
  if(!unverified.length){toast('All rounds already verified','success');return;}
  if(!confirm(`Verify all ${unverified.length} unverified round${unverified.length!==1?'s':''} for this event?`))return;
  const btn=event.target;btn.disabled=true;btn.textContent='Verifying…';
  const ev=db.events.find(e=>e.id===eid);const isOuting=ev&&ev.event_type==='outing_18';
  try{
    const ranked=assignLeaguePts(db.rounds.filter(r=>r.event_id===eid).map(r=>({...r})));
    const posMap={};ranked.forEach((r,i)=>{posMap[r.id]=i+1;});
    for(const r of unverified){
      const pos=posMap[r.id]||99;
      const newHcp=isOuting?calcNewHcpOuting(parseFloat(r.handicap_before),r.stableford_points,pos):calcNewHcp(parseFloat(r.handicap_before),r.stableford_points,pos);
      await patch(`rounds?id=eq.${r.id}`,{verified:true,handicap_after:newHcp});
      await patch(`players?id=eq.${r.player_id}`,{handicap_index:newHcp});
    }
    toast(`${unverified.length} round${unverified.length!==1?'s':''} verified!`,'success');
    await loadAll();renderAll();
  }catch(e){toast('Error: '+e.message,'error');btn.disabled=false;}
}

async function recalcHandicaps(eid) {
  if(!confirm('Recalculate and update all player handicaps for this event?'))return;
  const ev=db.events.find(e=>e.id===eid);const isOuting=ev&&ev.event_type==='outing_18';
  const rounds=db.rounds.filter(r=>r.event_id===eid&&r.verified);if(!rounds.length){toast('No verified rounds found','error');return;}
  const ranked=assignLeaguePts(rounds.map(r=>({...r})));const posMap={};ranked.forEach((r,i)=>{posMap[r.id]=i+1;});
  try{
    for(const r of rounds){
      const pos=posMap[r.id]||99;
      const newHcp=isOuting?calcNewHcpOuting(parseFloat(r.handicap_before),r.stableford_points,pos):calcNewHcp(parseFloat(r.handicap_before),r.stableford_points,pos);
      await patch(`rounds?id=eq.${r.id}`,{handicap_after:newHcp});await patch(`players?id=eq.${r.player_id}`,{handicap_index:newHcp});
    }
    toast('Handicaps recalculated!','success');await loadAll();renderAll();
  }catch(e){toast('Error: '+e.message,'error');}
}

async function togglePublishEvent(eid, currentlyPublished) {
  const ev=db.events.find(e=>e.id===eid);if(!ev)return;
  if(!currentlyPublished){
    const verified=db.rounds.filter(r=>r.event_id===eid&&r.verified).length;
    const total=db.rounds.filter(r=>r.event_id===eid).length;
    if(total===0){toast('No rounds submitted yet','error');return;}
    if(verified<total&&!confirm(`${verified} of ${total} rounds are verified. Publish anyway?`))return;
  }
  try{await patch(`events?id=eq.${eid}`,{published:!currentlyPublished});toast(currentlyPublished?'Results unpublished':'Results published!','success');await loadAll();renderAll();}
  catch(e){toast('Publish error: '+e.message,'error');}
}

async function deleteEvent(id) {
  if(!confirm('Delete this event and all its rounds?'))return;
  try{
    const eventRounds=db.rounds.filter(r=>r.event_id===id&&r.verified);
    for(const r of eventRounds)await patch(`players?id=eq.${r.player_id}`,{handicap_index:parseFloat(r.handicap_before)});
    await del(`rounds?event_id=eq.${id}`);await del(`events?id=eq.${id}`);
    toast('Event deleted — handicaps reverted','success');await loadAll();renderAll();
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── Schedule ──────────────────────────────────────────────────────────────

function renderSchedule() {
  const seasonDates=getSeasonDates();const byDate={};
  db.events.forEach(e=>{byDate[e.event_date]=e;});
  const t=new Date();
  const today=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  const outingsLogged=db.events.filter(e=>e.event_type==='outing_18').length;
  const sundaysLogged=db.events.filter(e=>e.event_type==='sunday_9').length;
  const nextOuting=Object.entries(OUTINGS).filter(([d])=>d>=today).sort(([a],[b])=>a.localeCompare(b))[0];
  let countdownHtml='';
  if(nextOuting){
    const[outDate,outName]=nextOuting;const[oy,om,od]=outDate.split('-').map(Number);
    const diff=Math.round((new Date(oy,om-1,od)-new Date(t.getFullYear(),t.getMonth(),t.getDate()))/86400000);
    const daysLabel=diff===0?'Today!':diff===1?'1 day to go':`${diff} days to go`;
    countdownHtml=`<div style="background:#0a1628;border-radius:var(--radius);padding:16px;margin-bottom:1rem;text-align:center">
      <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Next outing</div>
      <div style="font-size:18px;font-weight:700;color:white;margin-bottom:4px">${outName}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:10px">${fmtDate(outDate)}</div>
      <div style="display:inline-block;background:#C9A84C;color:#0a1628;font-size:22px;font-weight:800;padding:8px 24px;border-radius:99px">${daysLabel}</div>
    </div>`;
  }
  document.getElementById('schedule-table').innerHTML=`
    ${countdownHtml}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.25rem">
      <span class="badge gray">${seasonDates.length} events in season</span>
      <span class="badge green">${sundaysLogged} Sundays logged</span>
      <span class="badge purple">${outingsLogged} / 7 outings logged</span>
    </div>
    ${seasonDates.map((entry,i)=>{
      const{date:d,isOuting,course:outingCourse}=entry;const ev=byDate[d];
      const isPublished=ev&&ev.published;
      const isNextRound=ev&&!ev.published&&[...db.events].filter(e=>!e.published).sort((a,b)=>a.event_date.localeCompare(b.event_date))[0]?.id===ev.id;
      const courseName=ev?ev.course_name:isOuting?outingCourse:null;
      const typeLabel=(ev?ev.event_type:isOuting?'outing_18':'sunday_9')==='outing_18'
        ?`<span style="font-size:10px;font-weight:600;color:#3C3489;background:#EEEDFE;padding:2px 8px;border-radius:99px">18-hole outing</span>`
        :`<span style="font-size:10px;font-weight:600;color:#1a3c6e;background:#edf2fa;padding:2px 8px;border-radius:99px">Sunday 9</span>`;
      if(isPublished)return`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border);opacity:0.5"><div style="width:24px;height:24px;border-radius:50%;background:#fef8e6;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:#8a6a1a;font-weight:700">✓</div><div style="flex:1;min-width:0"><div style="font-size:13px;color:var(--text-2)">${fmtDate(d)}</div>${courseName?`<div style="font-size:14px;font-weight:600;color:var(--text);margin-top:2px">${courseName}</div>`:''}</div><button class="btn sm" onclick="viewEventResults('${ev.id}')" style="flex-shrink:0;font-size:11px">Results</button></div>`;
      if(isNextRound)return`<div style="display:flex;align-items:center;gap:10px;padding:12px;background:#f0f7ee;border-radius:10px;border:1.5px solid #a8c89a;margin-bottom:4px"><div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#2a6b1a;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white">${i+1}</div><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">${typeLabel}<span style="font-size:10px;font-weight:700;color:#2a6b1a;background:#d4edcc;padding:2px 8px;border-radius:99px">Next round</span></div><div style="font-size:13px;color:#2a6b1a;font-weight:500">${fmtDate(d)}</div>${courseName?`<div style="font-size:15px;font-weight:700;color:#1a4a0a;margin-top:2px">${courseName}</div>`:''}</div></div>`;
      return`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:0.5px solid var(--border)"><div style="width:24px;font-size:12px;font-weight:600;color:var(--text-3);text-align:center;flex-shrink:0">${i+1}</div><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">${typeLabel}</div><div style="font-size:13px;color:var(--text-2)">${fmtDate(d)}</div>${courseName?`<div style="font-size:15px;font-weight:600;color:var(--text);margin-top:2px">${courseName}</div>`:''}</div>${ev?`<button class="btn sm" onclick="viewEventResults('${ev.id}')" style="flex-shrink:0">Results</button>`:''}</div>`;
    }).join('')}`;
}

// ── Profile ───────────────────────────────────────────────────────────────

function renderProfile() {
  const el=document.getElementById('profile-content');if(!el)return;
  if(!currentUser||currentUser.role==='viewer'){el.innerHTML='<div class="empty" style="padding:3rem">Log in as a member to view your profile</div>';return;}
  let pid=currentUser.playerId;
  if(!pid&&currentUser.role==='admin'){const ap=db.players.find(p=>p.is_admin);if(ap)pid=ap.id;}
  if(!pid){el.innerHTML='<div class="empty" style="padding:3rem">Profile not available — log in as a member</div>';return;}
  const player=db.players.find(p=>p.id===pid);
  if(!player){el.innerHTML='<div class="empty">Player not found — try logging out and back in</div>';return;}
  const publishedEids=new Set(db.events.filter(e=>e.published).map(e=>e.id));
  const myRounds=db.rounds.filter(r=>r.player_id===pid&&r.verified&&publishedEids.has(r.event_id));
  const totalEvents=publishedEids.size;
  const bestScore=myRounds.length?Math.max(...myRounds.map(r=>r.stableford_points)):0;
  const avgScore=myRounds.length?(myRounds.reduce((a,r)=>a+r.stableford_points,0)/myRounds.length).toFixed(1):'—';
  const attendance=totalEvents>0?Math.round((myRounds.length/totalEvents)*100):0;
  const lbPositions=getLeaderboardPositions();
  const lbPos=lbPositions[pid]?.pos||0;const myLeaguePts=lbPositions[pid]?.lp||0;
  const byEvent={};
  for(const r of db.rounds.filter(x=>x.verified&&publishedEids.has(x.event_id))){if(!byEvent[r.event_id])byEvent[r.event_id]=[];byEvent[r.event_id].push({...r});}
  for(const eid in byEvent)assignLeaguePts(byEvent[eid]);
  let first=0,second=0,third=0;
  for(const eid in byEvent){const ranked=assignLeaguePts(byEvent[eid].map(r=>({...r})));const myRound=ranked.find(r=>r.player_id===pid);if(!myRound)continue;const pos=ranked.indexOf(myRound)+1;if(pos===1)first++;else if(pos===2)second++;else if(pos===3)third++;}
  const posLabel=lbPos===0?'—':lbPos===1?'1st':lbPos===2?'2nd':lbPos===3?'3rd':lbPos+'th';
  const posColor=lbPos===1?'#FAC775':lbPos===2?'#D3D1C7':lbPos===3?'#F0997B':'var(--green-light)';
  const posText=lbPos===1?'#633806':lbPos===2?'#444441':lbPos===3?'#4A1B0C':'var(--green-dark)';

  el.innerHTML=`
    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:1rem">
        <div style="position:relative;flex-shrink:0" onclick="triggerAvatarUpload('${pid}')">
          ${avatarHtml(player,52,18)}
          <div style="position:absolute;bottom:0;right:0;width:18px;height:18px;border-radius:50%;background:#C9A84C;display:flex;align-items:center;justify-content:center;border:2px solid white"><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#0a1628" stroke-width="1.8"><line x1="5" y1="2" x2="5" y2="8"/><line x1="2" y1="5" x2="8" y2="5"/></svg></div>
        </div>
        <input type="file" id="avatar-upload-input" accept="image/*" style="display:none" onchange="uploadAvatar(this,'${pid}')"/>
        <div>
          <div style="font-family:'DM Serif Display',serif;font-size:20px">${player.name}</div>
          <div style="font-size:13px;color:var(--text-2)">${player.plays_womens_index?'<span class="badge purple" style="font-size:10px;margin-right:4px">Women\'s index</span>':''}Handicap index: <strong>${parseFloat(player.handicap_index).toFixed(1)}</strong></div>
          <div style="font-size:11px;color:#9a9080;margin-top:3px">Tap photo to update</div>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:1rem">
      <div class="stat" style="background:${posColor};border-radius:var(--radius)"><div class="stat-label" style="color:${posText}">Leaderboard</div><div class="stat-value" style="color:${posText}">${posLabel}</div><div style="font-size:11px;color:${posText};margin-top:2px">${myLeaguePts} league pts</div></div>
      <div class="stat"><div class="stat-label">Handicap</div><div class="stat-value">${parseFloat(player.handicap_index).toFixed(1)}</div></div>
      <div class="stat"><div class="stat-label">Rounds played</div><div class="stat-value">${myRounds.length}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">${attendance}% attendance</div></div>
      <div class="stat"><div class="stat-label">Best score</div><div class="stat-value">${bestScore||'—'}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">Avg: ${avgScore}</div></div>
    </div>
    <div class="card" style="margin-bottom:1rem">
      <div class="card-title">Podium finishes</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center">
        <div style="background:#FAEEDA;border-radius:var(--radius);padding:1rem"><div style="font-size:28px;font-weight:600;color:#633806">${first}</div><div style="font-size:12px;color:#BA7517;margin-top:2px">1st place</div></div>
        <div style="background:#F1EFE8;border-radius:var(--radius);padding:1rem"><div style="font-size:28px;font-weight:600;color:#444441">${second}</div><div style="font-size:12px;color:#5F5E5A;margin-top:2px">2nd place</div></div>
        <div style="background:#FAECE7;border-radius:var(--radius);padding:1rem"><div style="font-size:28px;font-weight:600;color:#4A1B0C">${third}</div><div style="font-size:12px;color:#993C1D;margin-top:2px">3rd place</div></div>
      </div>
    </div>
    ${myRounds.length>1?`<div class="card" style="margin-bottom:1rem"><div class="card-title">Handicap progression</div><canvas id="hcp-chart" style="width:100%;height:180px"></canvas></div>`:''}
    ${myRounds.length?`<div class="card"><div class="card-title">Round history</div>${[...myRounds].sort((a,b)=>b.created_at?.localeCompare(a.created_at||'')||0).map(r=>{const ev=db.events.find(e=>e.id===r.event_id);return`<button onclick="showRoundScorecard('${r.id}')" style="width:100%;background:none;border:none;border-bottom:0.5px solid var(--border);padding:10px 0;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="min-width:0"><div style="font-size:14px;font-weight:500;color:var(--text)">${ev?ev.course_name:'Unknown'}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">${ev?fmtDate(ev.event_date):''} · ${r.stableford_points} pts · Hcp ${r.course_handicap}</div></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0">${r.verified?'<span class="badge green" style="font-size:10px">✓ Verified</span>':'<span class="badge gray" style="font-size:10px">Pending</span>'}<span style="color:var(--text-3);font-size:16px">›</span></div></button>`;}).join('')}</div>`:'<div class="card"><div class="empty">No rounds played yet this season</div></div>'}`;

  if(myRounds.length>1){
    setTimeout(()=>{
      const canvas=document.getElementById('hcp-chart');if(!canvas)return;
      const sorted=[...myRounds].sort((a,b)=>{const ea=db.events.find(e=>e.id===a.event_id);const eb=db.events.find(e=>e.id===b.event_id);return(ea?.event_date||'').localeCompare(eb?.event_date||'');});
      const labels=sorted.map(r=>{const ev=db.events.find(e=>e.id===r.event_id);return ev?ev.course_name.split(' ')[0]:'R';});
      const lastRound=sorted[sorted.length-1];
      const allData=[...sorted.map(r=>parseFloat(r.handicap_before)),parseFloat(lastRound.handicap_after)];
      const allLabels=[...labels,'Now'];
      drawHcpChart(canvas,allData,allLabels);
    },50);
  }
}

function showPlayerProfile(pid) {
  const player=db.players.find(p=>p.id===pid);if(!player)return;
  const publishedEids=new Set(db.events.filter(e=>e.published).map(e=>e.id));
  const myRounds=db.rounds.filter(r=>r.player_id===pid&&r.verified);
  const countedRounds=myRounds.filter(r=>publishedEids.has(r.event_id));
  const bestScore=countedRounds.length?Math.max(...countedRounds.map(r=>r.stableford_points)):0;
  const avgScore=countedRounds.length?(countedRounds.reduce((a,r)=>a+r.stableford_points,0)/countedRounds.length).toFixed(1):'—';
  const attendance=publishedEids.size>0?Math.round((countedRounds.length/publishedEids.size)*100):0;
  const lbPositions=getLeaderboardPositions();
  const lbPos=lbPositions[pid]?.pos||0;const myLeaguePts=lbPositions[pid]?.lp||0;
  const byEvent={};
  for(const r of db.rounds.filter(x=>x.verified&&publishedEids.has(x.event_id))){if(!byEvent[r.event_id])byEvent[r.event_id]=[];byEvent[r.event_id].push({...r});}
  for(const eid in byEvent)assignLeaguePts(byEvent[eid]);
  let first=0,second=0,third=0;
  for(const eid in byEvent){const ranked=assignLeaguePts(byEvent[eid].map(r=>({...r})));const myRound=ranked.find(r=>r.player_id===pid);if(!myRound)continue;const pos=ranked.indexOf(myRound)+1;if(pos===1)first++;else if(pos===2)second++;else if(pos===3)third++;}
  const posLabel=lbPos===0?'—':lbPos===1?'1st':lbPos===2?'2nd':lbPos===3?'3rd':lbPos+'th';
  const posColor=lbPos===1?'#FAEEDA':lbPos===2?'#F1EFE8':lbPos===3?'#FAECE7':'var(--bg)';
  const posText=lbPos===1?'#633806':lbPos===2?'#444441':lbPos===3?'#712B13':'var(--text-3)';
  document.getElementById('modal-title').textContent=player.name;
  document.getElementById('modal-body').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:1rem">
      <div class="stat" style="background:${posColor};border-radius:var(--radius)"><div class="stat-label" style="color:${posText}">Leaderboard</div><div class="stat-value" style="color:${posText}">${posLabel}</div><div style="font-size:11px;color:${posText};margin-top:2px">${myLeaguePts} pts</div></div>
      <div class="stat"><div class="stat-label">Handicap</div><div class="stat-value">${parseFloat(player.handicap_index).toFixed(1)}</div></div>
      <div class="stat"><div class="stat-label">Rounds played</div><div class="stat-value">${myRounds.length}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">${attendance}% attendance</div></div>
      <div class="stat"><div class="stat-label">Best score</div><div class="stat-value">${bestScore||'—'}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">Avg: ${avgScore}</div></div>
    </div>
    <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Podium finishes</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center;margin-bottom:1rem">
      <div style="background:#FAEEDA;border-radius:var(--radius);padding:1rem"><div style="font-size:28px;font-weight:600;color:#633806">${first}</div><div style="font-size:12px;color:#BA7517;margin-top:2px">1st place</div></div>
      <div style="background:#F1EFE8;border-radius:var(--radius);padding:1rem"><div style="font-size:28px;font-weight:600;color:#444441">${second}</div><div style="font-size:12px;color:#5F5E5A;margin-top:2px">2nd place</div></div>
      <div style="background:#FAECE7;border-radius:var(--radius);padding:1rem"><div style="font-size:28px;font-weight:600;color:#4A1B0C">${third}</div><div style="font-size:12px;color:#993C1D;margin-top:2px">3rd place</div></div>
    </div>
    ${countedRounds.length>1?`<div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;margin-top:1rem">Handicap progression</div><div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:1rem"><canvas id="modal-hcp-chart" style="width:100%;height:160px"></canvas></div>`:''}
    ${countedRounds.length?`<div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Round history</div>${[...countedRounds].sort((a,b)=>b.created_at?.localeCompare(a.created_at||'')||0).map(r=>{const ev=db.events.find(e=>e.id===r.event_id);return`<button onclick="showRoundScorecard('${r.id}')" style="width:100%;background:none;border:none;border-bottom:0.5px solid var(--border);padding:10px 0;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="min-width:0"><div style="font-size:14px;font-weight:500;color:var(--text)">${ev?ev.course_name:'Unknown'}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">${ev?fmtDate(ev.event_date):''} · ${r.stableford_points} pts · Hcp ${r.course_handicap}</div></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0">${r.verified?'<span class="badge green" style="font-size:10px">✓</span>':'<span class="badge gray" style="font-size:10px">Pending</span>'}<span style="color:var(--text-3);font-size:16px">›</span></div></button>`;}).join('')}`:'<div style="font-size:13px;color:var(--text-3);text-align:center;padding:1rem 0">No rounds played yet</div>'}`;
  document.getElementById('modal-overlay').classList.add('open');
  if(countedRounds.length>1){
    setTimeout(()=>{
      const canvas=document.getElementById('modal-hcp-chart');if(!canvas)return;
      const sorted=[...countedRounds].sort((a,b)=>{const ea=db.events.find(e=>e.id===a.event_id);const eb=db.events.find(e=>e.id===b.event_id);return(ea?.event_date||'').localeCompare(eb?.event_date||'');});
      const labels=sorted.map(r=>{const ev=db.events.find(e=>e.id===r.event_id);return ev?ev.course_name.split(' ')[0]:'R';});
      const lastRound=sorted[sorted.length-1];
      const allData=[...sorted.map(r=>parseFloat(r.handicap_before)),parseFloat(lastRound.handicap_after)];
      drawHcpChart(canvas,allData,[...labels,'Now']);
    },80);
  }
}

function drawHcpChart(canvas, allData, allLabels) {
  const dpr=window.devicePixelRatio||1;const w=canvas.offsetWidth;const h=parseInt(canvas.style.height)||180;
  canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const pad={top:16,right:16,bottom:36,left:36};
  const cw=w-pad.left-pad.right;const ch=h-pad.top-pad.bottom;
  const minV=Math.max(0,Math.min(...allData)-1);const maxV=Math.max(...allData)+1;const range=maxV-minV||1;
  const xStep=cw/(allData.length-1);
  const yPos=v=>pad.top+ch-((v-minV)/range)*ch;const xPos=i=>pad.left+i*xStep;
  ctx.strokeStyle='rgba(0,0,0,0.06)';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=pad.top+(ch/4)*i;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(pad.left+cw,y);ctx.stroke();ctx.fillStyle='rgba(0,0,0,0.35)';ctx.font='10px sans-serif';ctx.textAlign='right';ctx.fillText((maxV-(range/4)*i).toFixed(1),pad.left-4,y+3);}
  ctx.beginPath();ctx.moveTo(xPos(0),yPos(allData[0]));allData.forEach((v,i)=>ctx.lineTo(xPos(i),yPos(v)));ctx.lineTo(xPos(allData.length-1),pad.top+ch);ctx.lineTo(xPos(0),pad.top+ch);ctx.closePath();ctx.fillStyle='rgba(201,168,76,0.12)';ctx.fill();
  ctx.beginPath();ctx.strokeStyle='#C9A84C';ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';allData.forEach((v,i)=>i===0?ctx.moveTo(xPos(i),yPos(v)):ctx.lineTo(xPos(i),yPos(v)));ctx.stroke();
  allData.forEach((v,i)=>{ctx.beginPath();ctx.arc(xPos(i),yPos(v),4,0,Math.PI*2);ctx.fillStyle='#C9A84C';ctx.fill();ctx.fillStyle='rgba(0,0,0,0.45)';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(allLabels[i],xPos(i),pad.top+ch+14);ctx.fillStyle='#8a6a1a';ctx.font='bold 10px sans-serif';ctx.fillText(v.toFixed(1),xPos(i),yPos(v)-8);});
}

// ── Home / noticeboard ────────────────────────────────────────────────────

function renderHome() {
  const dash=document.getElementById('admin-dashboard');
  if(dash&&isAdmin){
    const nextEvent=[...db.events].filter(e=>!e.published).sort((a,b)=>a.event_date.localeCompare(b.event_date))[0];
    if(nextEvent){
      const unverified=db.rounds.filter(r=>r.event_id===nextEvent.id&&!r.verified).length;
      const total=db.rounds.filter(r=>r.event_id===nextEvent.id).length;
      const allVerified=total>0&&unverified===0;
      dash.innerHTML=`<div class="card" style="margin-bottom:1rem;border-color:var(--amber)"><div class="card-title" style="color:var(--gold)">Current event</div><div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">${nextEvent.course_name}</div><div style="font-size:12px;color:var(--text-3);margin-bottom:10px">${fmtDate(nextEvent.event_date)} · ${total} round${total!==1?'s':''} submitted</div><div style="display:flex;gap:8px;flex-wrap:wrap">${!allVerified&&total>0?`<button class="btn sm" style="background:#fef8e6;color:#8a6a1a;border-color:#C9A84C" onclick="verifyAllRounds('${nextEvent.id}')">Verify all (${unverified})</button>`:''}${allVerified?`<button class="btn sm" style="background:#fef8e6;color:#8a6a1a;border-color:#C9A84C" onclick="togglePublishEvent('${nextEvent.id}',false)">Publish results</button>`:''}${total===0?`<span style="font-size:12px;color:var(--text-3)">Waiting for rounds</span>`:''}</div></div>`;
    }else{dash.innerHTML='';}
  }
  const feed=document.getElementById('noticeboard-feed');
  if(!db.noticeboard.length){feed.innerHTML=`<div class="empty" style="padding:3rem;color:var(--text-2)">No updates yet — check back after the next round!</div>`;return;}
  feed.innerHTML=db.noticeboard.map(n=>{
    if(n.post_type==='knockout_results'||n.post_type==='fixtures'){
      const matches=n.fixture_matches||[];
      const isResults=n.post_type==='knockout_results';
      const completed=isResults?matches.filter(m=>m.status==='complete'&&!m.isBye).length:0;
      const total=isResults?matches.filter(m=>!m.isBye).length:matches.length;
      const matchRows=matches.filter(m=>isResults?!m.isBye:true).map(m=>{
        const isComplete=m.status==='complete';const isPlayoff=m.status==='playoff';
        return`<div class="fixture-row" style="${isComplete?'background:rgba(201,168,76,0.06)':''}">
          <div class="fixture-player"><div class="fixture-avatar" style="${isComplete&&m.winnerName===m.p1Name?'background:#C9A84C;color:#3a2000':''}">${m.p1Name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div><div><div class="fixture-player-name${isComplete&&m.winnerName===m.p1Name?'" style="color:#C9A84C;font-weight:700':''}">${m.p1Name}${isComplete&&m.winnerName===m.p1Name?' 🏆':''}</div></div></div>
          <div class="fixture-vs">${isPlayoff?'⚡':'VS'}</div>
          <div class="fixture-player" style="justify-content:flex-end"><div style="text-align:right"><div class="fixture-player-name${isComplete&&m.winnerName===m.p2Name?'" style="color:#C9A84C;font-weight:700':''}">${isComplete&&m.winnerName===m.p2Name?'🏆 ':''}${m.p2Name}</div>${isComplete&&m.result?`<div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:1px">${m.result}</div>`:''}</div><div class="fixture-avatar" style="${isComplete&&m.winnerName===m.p2Name?'background:#C9A84C;color:#3a2000':''}">${m.p2Name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div></div>
        </div>`;
      }).join('');
      const title=isResults?'Round 1 Results':"This week's knockout fixtures";
      const icon=isResults?'🏆':'⛳';
      const subtitle=isResults?`${completed}/${total} matches complete`:`${total} match${total!==1?'es':''} this week${n.custom_text?' · '+n.custom_text:''}`;
      const shareBtn=isResults
        ?`<button onclick="generateKnockoutResultsCard(${JSON.stringify(matches).replace(/"/g,'&quot;')})" style="background:#C9A84C;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#0a1628;font-family:'DM Sans',sans-serif;cursor:pointer">Share card</button>`
        :`<button onclick="generateFixtureCard(${JSON.stringify(matches).replace(/"/g,'&quot;')},${JSON.stringify(n.custom_text||'').replace(/"/g,'&quot;')})" style="background:#C9A84C;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#0a1628;font-family:'DM Sans',sans-serif;cursor:pointer">Share card</button>`;
      return`<div class="fixture-post"><div class="fixture-post-hdr"><div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;border-radius:8px;background:rgba(201,168,76,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">${icon}</div><div><div class="fixture-post-title">${title}</div><div class="fixture-post-note">${subtitle}</div></div></div></div>${matchRows}<div class="fixture-post-footer"><span style="font-size:11px;color:rgba(255,255,255,0.3)">${isResults?`${total-completed} match${total-completed!==1?'es':''} still to play`:''}</span><div style="display:flex;gap:8px;align-items:center">${shareBtn}<button onclick="showTab('knockout')" style="background:none;border:none;font-size:12px;color:#C9A84C;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:600">View draw →</button></div></div></div>`;
    }
    const ev=db.events.find(e=>e.id===n.event_id);
    const ranked=assignLeaguePts(db.rounds.filter(r=>r.event_id===n.event_id).map(r=>({...r}))).slice(0,3);
    const podium=ranked.map((r,i)=>{const p=db.players.find(x=>x.id===r.player_id);const medals=['🥇','🥈','🥉'];return`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:0.5px solid var(--border)"><span style="font-size:20px">${medals[i]}</span><div><div style="font-weight:500;font-size:14px">${p?p.name:'Unknown'}</div><div style="font-size:12px;color:var(--text-2)">${r.stableford_points} stableford pts · ${r._lp} league pts</div></div></div>`;}).join('');
    const birdies=n.birdies&&n.birdies.length?`<div style="margin-top:10px"><div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Birdies</div><div style="font-size:13px">🐦 ${n.birdies.join(', ')}</div></div>`:'';
    const ctp=n.closest_to_pin?`<div style="margin-top:10px"><div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Closest to pin</div><div style="font-size:13px">📍 ${n.closest_to_pin}</div></div>`:'';
    const custom=n.custom_text?`<div style="margin-top:10px;font-size:13px;color:var(--text-2);font-style:italic;border-left:3px solid var(--green);padding-left:10px">${n.custom_text}</div>`:'';
    const isOutingPost=ev&&ev.event_type==='outing_18';
    const frontBack=isOutingPost&&(n.best_front_9||n.best_back_9)?`<div style="margin-top:10px"><div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Best front &amp; back 9</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><div style="background:var(--bg);border-radius:8px;padding:8px 10px;border:1px solid var(--border)"><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Front 9</div><div style="font-size:13px;font-weight:600;color:var(--text)">⛳ ${n.best_front_9||'—'}</div></div><div style="background:var(--bg);border-radius:8px;padding:8px 10px;border:1px solid var(--border)"><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Back 9</div><div style="font-size:13px;font-weight:600;color:var(--text)">⛳ ${n.best_back_9||'—'}</div></div></div></div>`:'';
    return`<div class="card" style="margin-bottom:1rem"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px"><div><div style="font-family:'DM Serif Display',serif;font-size:17px">${ev?ev.course_name:'Event'}</div><div style="font-size:12px;color:var(--text-3)">${ev?fmtDate(ev.event_date):''}</div></div><span class="badge ${ev&&ev.event_type==='outing_18'?'purple':'green'}">${ev&&ev.event_type==='outing_18'?'Outing':'Sunday 9'}</span></div>${ranked.length?`<div style="margin-bottom:4px">${podium}</div>`:''} ${frontBack}${ctp}${birdies}${custom}<div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">${ev?`<button class="btn sm" onclick="viewEventResults('${ev.id}')" style="background:#fef8e6;color:#8a6a1a;border-color:#C9A84C;font-weight:600">View full results →</button>`:'<span></span>'}<div style="display:flex;gap:6px;align-items:center"><button class="btn sm" onclick="generateResultsCard('${n.event_id}')" style="background:#0c1c2e;color:#C9A84C;border-color:#0c1c2e">Share card</button>${isAdmin?`<button class="btn sm danger" onclick="deleteNotice('${n.id}')">Remove</button>`:''}</div></div></div>`;
  }).join('');
}

// ── Noticeboard / post update ─────────────────────────────────────────────
const selectedBirdies = new Set();

function closePostModal() { document.getElementById('post-update-modal').classList.remove('open'); }
function maybeClosePostModal(e) { if(e.target===document.getElementById('post-update-modal')) closePostModal(); }

function showPostUpdate(eid) {
  if(!isAdmin){return;}
  const ev=db.events.find(e=>e.id===eid);if(!ev)return;
  const existing=db.noticeboard.find(n=>n.event_id===eid);
  selectedBirdies.clear();if(existing&&existing.birdies)existing.birdies.forEach(b=>selectedBirdies.add(b));
  const ranked=assignLeaguePts(db.rounds.filter(r=>r.event_id===eid).map(r=>({...r}))).slice(0,3);
  const podiumHtml=ranked.length?ranked.map((r,i)=>{const p=db.players.find(x=>x.id===r.player_id);const medals=['🥇','🥈','🥉'];return`<div style="font-size:13px;padding:4px 0">${medals[i]} ${p?p.name:'?'} — ${r.stableford_points} pts</div>`;}).join(''):'<div style="font-size:13px;color:var(--text-3)">No rounds recorded yet</div>';
  const playerOptions=db.players.map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
  const existingBirdies=existing&&existing.birdies?existing.birdies:[];
  const birdieButtons=db.players.map(p=>{const selected=existingBirdies.includes(p.name);return`<button type="button" id="birdie-${p.id}" onclick="toggleBirdie('${p.id}','${p.name.replace(/'/g,"\\'")}')" style="padding:6px 10px;border-radius:99px;border:1px solid ${selected?'var(--green)':'var(--border-strong)'};background:${selected?'var(--green-light)':'var(--bg)'};color:${selected?'var(--green-dark)':'var(--text)'};font-size:12px;cursor:pointer">${p.name.split(' ')[0]}</button>`;}).join('');
  const isOuting=ev.event_type==='outing_18';
  const outingRounds=db.rounds.filter(r=>r.event_id===eid&&r.verified);
  let frontBest=null,backBest=null;
  if(isOuting&&outingRounds.length){const top3Ids=new Set(assignLeaguePts(outingRounds.map(r=>({...r}))).slice(0,3).map(r=>r.player_id));frontBest=calcBestHalf(outingRounds,'front',top3Ids);backBest=calcBestHalf(outingRounds,'back',top3Ids);}
  const frontBackHtml=isOuting?`<div style="background:var(--bg);border-radius:var(--radius);padding:12px;margin-bottom:1rem"><div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Best front &amp; back 9 (auto)</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="background:white;border-radius:8px;padding:10px;border:1px solid var(--border)"><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Front 9</div><div style="font-size:14px;font-weight:600;color:var(--text)">${frontBest?frontBest.name:'—'}</div><div style="font-size:12px;color:#8a6a1a;font-weight:500">${frontBest?frontBest.pts+' pts':''}</div></div><div style="background:white;border-radius:8px;padding:10px;border:1px solid var(--border)"><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Back 9</div><div style="font-size:14px;font-weight:600;color:var(--text)">${backBest?backBest.name:'—'}</div><div style="font-size:12px;color:#8a6a1a;font-weight:500">${backBest?backBest.pts+' pts':''}</div></div></div></div>`:'';
  document.getElementById('post-update-title').textContent=`Post update — ${ev.course_name} (${fmtDate(ev.event_date)})`;
  document.getElementById('post-update-body').innerHTML=`<div style="margin-bottom:1rem"><div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Results (auto from scores)</div>${podiumHtml}</div>${frontBackHtml}<div class="form-group" style="margin-bottom:12px"><label>Closest to pin</label><select id="pu-ctp" style="width:100%"><option value="">— none —</option>${playerOptions}</select></div><div class="form-group" style="margin-bottom:1rem"><label>Birdies <span style="font-weight:400;color:var(--text-3)">— tap to select</span></label><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px" id="birdie-selector">${birdieButtons}</div></div><div class="form-group" style="margin-bottom:1rem"><label>Custom announcement</label><input id="pu-custom" placeholder="e.g. Great turnout today!" value="${existing&&existing.custom_text?existing.custom_text:''}"/></div><button class="btn primary" onclick="saveNotice('${eid}','${existing?existing.id:''}')" style="width:100%">${existing?'Update post':'Post to home page'}</button>`;
  if(existing&&existing.closest_to_pin){const sel=document.getElementById('pu-ctp');if(sel)sel.value=existing.closest_to_pin;}
  document.getElementById('post-update-modal').classList.add('open');
}

function toggleBirdie(pid, name) {
  const btn=document.getElementById('birdie-'+pid);if(!btn)return;
  if(selectedBirdies.has(name)){selectedBirdies.delete(name);btn.style.border='1px solid var(--border-strong)';btn.style.background='var(--bg)';btn.style.color='var(--text)';}
  else{selectedBirdies.add(name);btn.style.border='1px solid var(--green)';btn.style.background='var(--green-light)';btn.style.color='var(--green-dark)';}
}

async function saveNotice(eid, existingId) {
  const ev=db.events.find(e=>e.id===eid);const isOuting=ev&&ev.event_type==='outing_18';
  const ctp=document.getElementById('pu-ctp').value||null;const birdies=[...selectedBirdies];const custom=document.getElementById('pu-custom').value.trim()||null;
  let best_front_9=null,best_back_9=null;
  if(isOuting){const outingRounds=db.rounds.filter(r=>r.event_id===eid&&r.verified);const top3Ids=new Set(assignLeaguePts(outingRounds.map(r=>({...r}))).slice(0,3).map(r=>r.player_id));const front=calcBestHalf(outingRounds,'front',top3Ids);const back=calcBestHalf(outingRounds,'back',top3Ids);if(front)best_front_9=`${front.name} (${front.pts} pts)`;if(back)best_back_9=`${back.name} (${back.pts} pts)`;}
  try{
    if(existingId)await patch(`noticeboard?id=eq.${existingId}`,{closest_to_pin:ctp,birdies,custom_text:custom,best_front_9,best_back_9});
    else await post('noticeboard',{event_id:eid,closest_to_pin:ctp,birdies,custom_text:custom,best_front_9,best_back_9});
    toast('Update posted!','success');selectedBirdies.clear();closePostModal();await loadAll();renderAll();
  }catch(e){toast('Error: '+e.message,'error');}
}

async function deleteNotice(id) {
  if(!confirm('Remove this update from the noticeboard?'))return;
  try{await del(`noticeboard?id=eq.${id}`);toast('Update removed','success');await loadAll();renderAll();}
  catch(e){toast('Error: '+e.message,'error');}
}

// ── Stats modal ───────────────────────────────────────────────────────────
function closeStatsModal() { document.getElementById('stats-modal').classList.remove('open'); }
function maybeCloseStatsModal(e) { if(e.target===document.getElementById('stats-modal'))closeStatsModal(); }
function showStatsModal() { renderStatsModal('birdies'); document.getElementById('stats-modal').classList.add('open'); }

function calcPlayerStats() {
  const publishedEids=new Set(db.events.filter(e=>e.published).map(e=>e.id));const stats={};
  for(const player of db.players)stats[player.id]={name:player.name,rounds:0,birdies:0,pars:0,scratches:0};
  const MARK_EXCLUDED=new Set(['ed978d39-b16b-465b-8582-7d2110c2e130','551856f8-752e-4d88-8418-4f86f447ae65','35619e4d-f918-4497-bfc3-0cb7648f2c26']);
  for(const r of db.rounds.filter(x=>x.verified&&publishedEids.has(x.event_id))){
    if(!r.hole_scores)continue;const ev=db.events.find(e=>e.id===r.event_id);const pl=db.players.find(p=>p.id===r.player_id);if(!ev||!pl||!stats[pl.id])continue;
    const n=ev.event_type==='outing_18'?18:9;const parVals=getParValues(n,ev,pl);stats[pl.id].rounds++;
    for(let i=0;i<n;i++){const score=r.hole_scores[i];const par=parVals[i]||4;if(score==null)continue;const diff=score-par;if(diff===-1)stats[pl.id].birdies++;else if(diff===0)stats[pl.id].pars++;if(calcHolePts(r,i)===0&&!MARK_EXCLUDED.has(r.id))stats[pl.id].scratches++;}
  }
  return Object.values(stats).filter(s=>s.rounds>0);
}

function renderStatsModal(tab) {
  const allStats=calcPlayerStats();
  const totals={birdies:allStats.reduce((s,p)=>s+p.birdies,0),pars:allStats.reduce((s,p)=>s+p.pars,0),scratches:allStats.reduce((s,p)=>s+p.scratches,0)};
  const tabData={birdies:{key:'birdies',label:'Most birdies',sub:p=>`${p.rounds} round${p.rounds!==1?'s':''} · avg ${p.rounds?(p.birdies/p.rounds).toFixed(1):0}/round`},pars:{key:'pars',label:'Most pars',sub:p=>`${p.rounds} round${p.rounds!==1?'s':''} · avg ${p.rounds?(p.pars/p.rounds).toFixed(1):0}/round`},scratches:{key:'scratches',label:'Most scratches',sub:p=>`${p.rounds} round${p.rounds!==1?'s':''} · avg ${p.rounds?(p.scratches/p.rounds).toFixed(1):0}/round`}};
  const{key,label,sub}=tabData[tab];
  const sorted=[...allStats].sort((a,b)=>b[key]-a[key]).filter(p=>p[key]>0);const max=sorted.length?sorted[0][key]:1;
  const posClass=i=>i===0?'r1':i===1?'r2':i===2?'r3':'rn';const posLabel=i=>i===0?'1st':i===1?'2nd':i===2?'3rd':`${i+1}th`;
  const rows=sorted.length?sorted.map((p,i)=>{const pct=Math.round((p[key]/max)*100);return`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:0.5px solid var(--border)"><div class="rank ${posClass(i)}" style="flex-shrink:0">${posLabel(i)}</div><div class="avatar" style="flex-shrink:0">${initials(p.name)}</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:500;color:var(--text)">${p.name}</div><div style="font-size:11px;color:var(--text-3);margin-top:1px">${sub(p)}</div></div><div style="width:80px;height:6px;background:var(--border);border-radius:3px;overflow:hidden;flex-shrink:0"><div style="width:${pct}%;height:100%;background:#C9A84C;border-radius:3px"></div></div><div style="font-size:16px;font-weight:600;color:var(--text);min-width:28px;text-align:right">${p[key]}</div></div>`;}).join(''):'<div class="empty">No data yet</div>';
  const tabBtn=t=>`<button onclick="renderStatsModal('${t}')" style="flex:1;padding:8px;border-radius:var(--radius);border:1px solid ${tab===t?'var(--green-dark)':'var(--border-strong)'};background:${tab===t?'var(--green-dark)':'transparent'};color:${tab===t?'#C9A84C':'var(--text-2)'};font-size:13px;font-weight:${tab===t?'600':'400'};font-family:'DM Sans',sans-serif;cursor:pointer">${t.charAt(0).toUpperCase()+t.slice(1)}</button>`;
  document.getElementById('stats-modal-body').innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:1rem"><div style="background:var(--bg);border-radius:var(--radius);padding:10px;text-align:center"><div style="font-size:22px;font-weight:600;color:var(--text)">${totals.birdies}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">Total birdies</div></div><div style="background:var(--bg);border-radius:var(--radius);padding:10px;text-align:center"><div style="font-size:22px;font-weight:600;color:var(--text)">${totals.pars}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">Total pars</div></div><div style="background:var(--bg);border-radius:var(--radius);padding:10px;text-align:center"><div style="font-size:22px;font-weight:600;color:var(--text)">${totals.scratches}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">Total scratches</div></div></div><div style="display:flex;gap:6px;margin-bottom:1rem">${tabBtn('birdies')}${tabBtn('pars')}${tabBtn('scratches')}</div><div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${label} — all games</div>${rows}`;
}
