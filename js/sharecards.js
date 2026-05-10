// ── Share Cards ───────────────────────────────────────────────────────────

function generateResultsCard(eid) {
  const ev = db.events.find(e=>e.id===eid);
  const notice = db.noticeboard.find(n=>n.event_id===eid);
  if (!ev) { toast('Event not found', 'error'); return; }

  const isOuting = ev.event_type === 'outing_18';
  const eventRounds = db.rounds.filter(r=>r.event_id===eid && r.verified);
  const ranked = assignLeaguePts(eventRounds.map(r=>({...r}))).slice(0,3);
  const podium = ranked.map(r => {
    const p = db.players.find(x=>x.id===r.player_id);
    return { name: p?p.name:'Unknown', pts: r.stableford_points, lp: r._lp, initials: p?initials(p.name):'?' };
  });

  const extItems = [];
  if (notice && notice.closest_to_pin) extItems.push({ label:'Closest to pin', value: notice.closest_to_pin });
  if (notice && notice.birdies && notice.birdies.length) extItems.push({ label:'Birdies', value: notice.birdies.join(', ') });
  if (isOuting && notice && notice.best_front_9) extItems.push({ label:'Best front 9', value: notice.best_front_9 });
  if (isOuting && notice && notice.best_back_9)  extItems.push({ label:'Best back 9',  value: notice.best_back_9 });

  const S = 3;
  const W = 580, PAD = 32;
  const HEADER_H = 170, ROW_H = 110, EXT_ROW_H = 88;
  const H = HEADER_H + 50 + podium.length * ROW_H
          + (extItems.length ? 36 + extItems.length * EXT_ROW_H + 16 : 0)
          + 96;

  const NAVY = '#0c1c2e', GOLD = '#C9A84C', WHITE = '#ffffff';
  const LIGHT = 'rgba(255,255,255,0.09)', LIGHTER = 'rgba(255,255,255,0.14)';
  const medalColors = ['#FAC775','#D3D1C7','#F0997B'];
  const medalText   = ['#633806','#444441','#4A1B0C'];
  const posLabels   = ['1st','2nd','3rd'];

  const canvas = document.createElement('canvas');
  canvas.width  = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, W, 8);
  ctx.fillRect(0, H-8, W, 8);

  // Header
  ctx.fillStyle = LIGHTER;
  ctx.beginPath();
  ctx.roundRect(PAD, 20, W-PAD*2, HEADER_H, 14);
  ctx.fill();
  const cx = PAD+52, cy = 20+HEADER_H/2;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = NAVY;
  ctx.font = 'bold 22px DM Sans,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BH', cx, cy+8);
  const tx = PAD+108;
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 26px DM Sans,sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Bray Head Golf Society', tx, cy-38);
  ctx.fillStyle = GOLD;
  ctx.font = '500 21px DM Sans,sans-serif';
  ctx.fillText(ev.course_name, tx, cy-10);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '18px DM Sans,sans-serif';
  ctx.fillText(fmtDate(ev.event_date), tx, cy+18);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '16px DM Sans,sans-serif';
  ctx.fillText(isOuting ? '18-hole outing' : 'Sunday 9', tx, cy+42);

  // Results label
  let cursor = HEADER_H + 28;
  ctx.fillStyle = GOLD;
  ctx.font = '600 15px DM Sans,sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RESULTS', PAD, cursor);
  ctx.fillStyle = 'rgba(201,168,76,0.25)';
  ctx.fillRect(PAD, cursor+8, W-PAD*2, 1.5);
  cursor += 22;

  // Podium rows
  podium.forEach((p, i) => {
    const y = cursor + i * ROW_H;
    const rowH = ROW_H - 8;
    const mid = y + rowH/2;
    ctx.fillStyle = i===0 ? 'rgba(201,168,76,0.13)' : LIGHT;
    ctx.beginPath();
    ctx.roundRect(PAD, y, W-PAD*2, rowH, 12);
    ctx.fill();
    if (i===0) {
      ctx.strokeStyle = 'rgba(201,168,76,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(PAD, y, W-PAD*2, rowH, 12);
      ctx.stroke();
    }
    ctx.fillStyle = medalColors[i];
    ctx.beginPath();
    ctx.arc(PAD+30, mid, 22, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = medalText[i];
    ctx.font = 'bold 13px DM Sans,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(posLabels[i], PAD+30, mid+5);
    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.arc(PAD+82, mid, 28, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(PAD+82, mid, 28, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 15px DM Sans,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.initials, PAD+82, mid+5);
    ctx.fillStyle = WHITE;
    ctx.font = i===0 ? 'bold 26px DM Sans,sans-serif' : '500 24px DM Sans,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(p.name, PAD+122, mid-4);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '17px DM Sans,sans-serif';
    ctx.fillText(p.lp+' league pts', PAD+122, mid+20);
    const pillW=82, pillH=48, pillX=W-PAD-pillW;
    ctx.fillStyle = i===0 ? GOLD : LIGHTER;
    ctx.beginPath();
    ctx.roundRect(pillX, mid-pillH/2, pillW, pillH, 10);
    ctx.fill();
    ctx.fillStyle = i===0 ? NAVY : WHITE;
    ctx.font = 'bold 30px DM Sans,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.pts, pillX+pillW/2, mid+7);
    ctx.fillStyle = i===0 ? 'rgba(12,28,46,0.5)' : 'rgba(255,255,255,0.4)';
    ctx.font = '12px DM Sans,sans-serif';
    ctx.fillText('pts', pillX+pillW/2, mid+22);
  });

  // Extras
  if (extItems.length) {
    const extY = cursor + podium.length * ROW_H + 14;
    const extH = extItems.length * EXT_ROW_H + 20;
    ctx.fillStyle = LIGHTER;
    ctx.beginPath();
    ctx.roundRect(PAD, extY, W-PAD*2, extH, 12);
    ctx.fill();
    extItems.forEach((item, i) => {
      const iy = extY + 16 + i * EXT_ROW_H;
      if (i > 0) { ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fillRect(PAD+20, iy-6, W-PAD*2-40, 1); }
      ctx.fillStyle = GOLD;
      ctx.font = '600 14px DM Sans,sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label.toUpperCase(), PAD+20, iy+18);
      ctx.fillStyle = WHITE;
      ctx.font = '500 22px DM Sans,sans-serif';
      ctx.fillText(item.value, PAD+20, iy+46);
    });
  }

  // Footer
  const footY = H - 80;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(PAD, footY, W-PAD*2, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '16px DM Sans,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Bray Head Golf Society · 2026 Season', W/2, footY+26);
  ctx.fillStyle = GOLD;
  ctx.font = '500 15px DM Sans,sans-serif';
  ctx.fillText('www.golfsoc.ie', W/2, footY+50);

  const link = document.createElement('a');
  link.download = 'bhgs-'+ev.course_name.replace(/\s+/g,'-').toLowerCase()+'-results.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('Results card downloaded — share to WhatsApp!', 'success');
}

function generateKnockoutResultsCard(matches) {
  const logoImg = document.getElementById('topbar-logo');
  const doRender = (logo) => _renderKnockoutResultsCard(matches, logo);
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) doRender(logoImg);
  else {
    const img = new Image(); img.crossOrigin='anonymous';
    img.onload=()=>doRender(img); img.onerror=()=>doRender(null);
    img.src='icon-192.png';
  }
}

function _renderKnockoutResultsCard(matches, logoImg) {
  const S=3, W=580, PAD=28;
  const NAVY='#0a1628', GOLD='#C9A84C', WHITE='#ffffff', DIVIDER='rgba(255,255,255,0.08)';
  const nonBye=matches.filter(m=>!m.isBye);
  const HEADER_H=140, ROW_H=76, FOOTER_H=72;
  const H=HEADER_H+12+nonBye.length*(ROW_H+1)+FOOTER_H;
  const canvas=document.createElement('canvas');
  canvas.width=W*S; canvas.height=H*S;
  const ctx=canvas.getContext('2d'); ctx.scale(S,S);
  ctx.fillStyle=NAVY; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=GOLD; ctx.fillRect(0,0,W,5); ctx.fillRect(0,H-5,W,5);

  const hdrMid=HEADER_H/2;
  ctx.save(); ctx.beginPath(); ctx.arc(PAD+34,hdrMid,30,0,Math.PI*2); ctx.clip();
  if(logoImg) ctx.drawImage(logoImg,PAD+4,hdrMid-30,60,60);
  else { ctx.fillStyle=GOLD; ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle=GOLD; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(PAD+34,hdrMid,30,0,Math.PI*2); ctx.stroke();

  const htx=PAD+76;
  ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='600 11px DM Sans,sans-serif'; ctx.textAlign='left';
  ctx.fillText('BRAY HEAD GOLF SOCIETY',htx,hdrMid-26);
  ctx.fillStyle=WHITE; ctx.font='bold 26px DM Sans,sans-serif'; ctx.fillText('Round 1',htx,hdrMid+4);
  const r1w=ctx.measureText('Round 1 ').width;
  ctx.fillStyle=GOLD; ctx.fillText('Results',htx+r1w,hdrMid+4);
  const completed=nonBye.filter(m=>m.status==='complete').length;
  ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='14px DM Sans,sans-serif';
  ctx.fillText(`${completed} of ${nonBye.length} complete · 2026`,htx,hdrMid+26);
  ctx.fillStyle='rgba(201,168,76,0.3)'; ctx.fillRect(PAD,HEADER_H-1,W-PAD*2,1.5);

  let curY=HEADER_H+12;
  nonBye.forEach((m,idx)=>{
    const rowMid=curY+ROW_H/2;
    const isComplete=m.status==='complete', isPlayoff=m.status==='playoff';
    const p1Won=isComplete&&m.winnerName===m.p1Name, p2Won=isComplete&&m.winnerName===m.p2Name;
    if(isComplete){ctx.fillStyle='rgba(201,168,76,0.05)';ctx.fillRect(PAD,curY,W-PAD*2,ROW_H);}
    else if(idx%2===0){ctx.fillStyle='rgba(255,255,255,0.02)';ctx.fillRect(PAD,curY,W-PAD*2,ROW_H);}
    const av1x=PAD+22;
    ctx.fillStyle=p1Won?GOLD:'rgba(201,168,76,0.15)'; ctx.beginPath(); ctx.arc(av1x,rowMid,20,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=p1Won?NAVY:GOLD; ctx.font='bold 11px DM Sans,sans-serif'; ctx.textAlign='center';
    ctx.fillText(m.p1Name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),av1x,rowMid+4);
    ctx.fillStyle=p1Won?GOLD:p2Won?'rgba(255,255,255,0.35)':WHITE;
    ctx.font=p1Won?'bold 16px DM Sans,sans-serif':'500 16px DM Sans,sans-serif'; ctx.textAlign='left';
    let p1d=m.p1Name; while(ctx.measureText(p1d).width>165&&p1d.length>3)p1d=p1d.slice(0,-1);
    if(p1d!==m.p1Name)p1d=p1d.trim()+'…';
    ctx.fillText(p1d+(p1Won?' 🏆':''),av1x+28,rowMid+(isComplete&&m.result?2:6));
    if(isComplete&&m.result&&p1Won){ctx.fillStyle='rgba(201,168,76,0.5)';ctx.font='11px DM Sans,sans-serif';ctx.fillText(m.result,av1x+28,rowMid+18);}
    const vsX=W/2;
    if(isPlayoff){ctx.fillStyle=GOLD;ctx.font='700 11px DM Sans,sans-serif';ctx.textAlign='center';ctx.fillText('⚡',vsX,rowMid+4);}
    else if(isComplete){ctx.fillStyle='rgba(255,255,255,0.15)';ctx.font='600 10px DM Sans,sans-serif';ctx.textAlign='center';ctx.fillText('DONE',vsX,rowMid+4);}
    else{ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='700 11px DM Sans,sans-serif';ctx.textAlign='center';ctx.fillText('VS',vsX,rowMid+4);}
    const av2x=W-PAD-22;
    ctx.fillStyle=p2Won?GOLD:'rgba(201,168,76,0.15)'; ctx.beginPath(); ctx.arc(av2x,rowMid,20,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=p2Won?NAVY:GOLD; ctx.font='bold 11px DM Sans,sans-serif'; ctx.textAlign='center';
    ctx.fillText(m.p2Name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),av2x,rowMid+4);
    ctx.fillStyle=p2Won?GOLD:p1Won?'rgba(255,255,255,0.35)':WHITE;
    ctx.font=p2Won?'bold 16px DM Sans,sans-serif':'500 16px DM Sans,sans-serif'; ctx.textAlign='right';
    let p2d=m.p2Name; while(ctx.measureText(p2d).width>165&&p2d.length>3)p2d=p2d.slice(0,-1);
    if(p2d!==m.p2Name)p2d=p2d.trim()+'…';
    ctx.fillText((p2Won?'🏆 ':'')+p2d,av2x-28,rowMid+(isComplete&&m.result?2:6));
    if(isComplete&&m.result&&p2Won){ctx.fillStyle='rgba(201,168,76,0.5)';ctx.font='11px DM Sans,sans-serif';ctx.textAlign='right';ctx.fillText(m.result,av2x-28,rowMid+18);}
    curY+=ROW_H; ctx.fillStyle=DIVIDER; ctx.fillRect(PAD,curY,W-PAD*2,1); curY+=1;
  });

  const footY=H-FOOTER_H+10;
  ctx.fillStyle=DIVIDER; ctx.fillRect(PAD,footY,W-PAD*2,1);
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='14px DM Sans,sans-serif'; ctx.textAlign='center';
  ctx.fillText('Bray Head Golf Society · 2026 Season',W/2,footY+26);
  ctx.fillStyle=GOLD; ctx.font='500 13px DM Sans,sans-serif';
  ctx.fillText('www.golfsoc.ie',W/2,footY+48);
  const link=document.createElement('a');
  link.download='bhgs-round1-results.png'; link.href=canvas.toDataURL('image/png'); link.click();
  toast('Results card downloaded — share to WhatsApp!','success');
}

function generateFixtureCard(matches, note) {
  const logoImg=document.getElementById('topbar-logo');
  const doRender=(logo)=>_renderFixtureCard(matches,note,logo);
  if(logoImg&&logoImg.complete&&logoImg.naturalWidth>0) doRender(logoImg);
  else {
    const img=new Image(); img.crossOrigin='anonymous';
    img.onload=()=>doRender(img); img.onerror=()=>doRender(null);
    img.src='icon-192.png';
  }
}

function _renderFixtureCard(matches, note, logoImg) {
  const S=3, W=580, PAD=28;
  const NAVY='#0a1628', GOLD='#C9A84C', WHITE='#ffffff';
  const DIVIDER='rgba(255,255,255,0.08)';
  const HEADER_H=140, MATCH_H=80, SEP_H=1, PLAYOFF_H=30;
  const NOTE_H=note?52:0, FOOTER_H=72;
  let totalMatchH=0;
  matches.forEach(m=>{totalMatchH+=MATCH_H+SEP_H+(m.isPlayoff?PLAYOFF_H:0);});
  const H=HEADER_H+12+totalMatchH+NOTE_H+FOOTER_H;
  const canvas=document.createElement('canvas');
  canvas.width=W*S; canvas.height=H*S;
  const ctx=canvas.getContext('2d'); ctx.scale(S,S);
  ctx.fillStyle=NAVY; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=GOLD; ctx.fillRect(0,0,W,5); ctx.fillRect(0,H-5,W,5);

  const hdrMid=HEADER_H/2;
  ctx.save(); ctx.beginPath(); ctx.arc(PAD+34,hdrMid,30,0,Math.PI*2); ctx.clip();
  if(logoImg) ctx.drawImage(logoImg,PAD+4,hdrMid-30,60,60);
  else{ctx.fillStyle=GOLD;ctx.fill();ctx.fillStyle=NAVY;ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText('BH',PAD+34,hdrMid+8);}
  ctx.restore();
  ctx.strokeStyle=GOLD; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(PAD+34,hdrMid,30,0,Math.PI*2); ctx.stroke();

  const htx=PAD+76;
  ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='600 11px DM Sans,sans-serif'; ctx.textAlign='left';
  ctx.fillText('BRAY HEAD GOLF SOCIETY',htx,hdrMid-26);
  ctx.fillStyle=WHITE; ctx.font='bold 28px DM Sans,sans-serif'; ctx.fillText('Knockout',htx,hdrMid+4);
  const kw=ctx.measureText('Knockout ').width;
  ctx.fillStyle=GOLD; ctx.fillText('Fixtures',htx+kw,hdrMid+4);
  ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='14px DM Sans,sans-serif';
  ctx.fillText('This week\u2019s matches \u00b7 2026',htx,hdrMid+26);
  ctx.fillStyle='rgba(201,168,76,0.3)'; ctx.fillRect(PAD,HEADER_H-1,W-PAD*2,1.5);

  let curY=HEADER_H+12;
  matches.forEach((m,idx)=>{
    const rowTop=curY, rowMid=rowTop+MATCH_H/2;
    if(idx%2===0){ctx.fillStyle='rgba(255,255,255,0.03)';ctx.fillRect(PAD,rowTop,W-PAD*2,MATCH_H);}
    const av1x=PAD+22;
    ctx.fillStyle='rgba(201,168,76,0.18)'; ctx.beginPath(); ctx.arc(av1x,rowMid,20,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=GOLD; ctx.font='bold 12px DM Sans,sans-serif'; ctx.textAlign='center';
    ctx.fillText(m.p1Name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),av1x,rowMid+4);
    ctx.fillStyle=WHITE; ctx.font='600 17px DM Sans,sans-serif'; ctx.textAlign='left';
    let p1d=m.p1Name; while(ctx.measureText(p1d).width>170&&p1d.length>4)p1d=p1d.slice(0,-1);
    if(p1d!==m.p1Name)p1d=p1d.trim()+'…';
    ctx.fillText(p1d,av1x+28,rowMid+6);
    ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.font='700 12px DM Sans,sans-serif'; ctx.textAlign='center';
    ctx.fillText('VS',W/2,rowMid+4);
    const av2x=W-PAD-22;
    ctx.fillStyle='rgba(201,168,76,0.18)'; ctx.beginPath(); ctx.arc(av2x,rowMid,20,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=GOLD; ctx.font='bold 12px DM Sans,sans-serif'; ctx.textAlign='center';
    ctx.fillText(m.p2Name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),av2x,rowMid+4);
    ctx.fillStyle=WHITE; ctx.font='600 17px DM Sans,sans-serif'; ctx.textAlign='right';
    let p2d=m.p2Name; while(ctx.measureText(p2d).width>170&&p2d.length>4)p2d=p2d.slice(0,-1);
    if(p2d!==m.p2Name)p2d=p2d.trim()+'…';
    ctx.fillText(p2d,av2x-28,rowMid+6);
    curY+=MATCH_H;
    ctx.fillStyle=DIVIDER; ctx.fillRect(PAD,curY,W-PAD*2,SEP_H); curY+=SEP_H;
    if(m.isPlayoff){
      ctx.fillStyle='rgba(201,168,76,0.12)'; ctx.fillRect(PAD,curY,W-PAD*2,PLAYOFF_H);
      ctx.fillStyle=GOLD; ctx.font='600 12px DM Sans,sans-serif'; ctx.textAlign='left';
      ctx.fillText('⚡  Playoff match',PAD+14,curY+PLAYOFF_H/2+4);
      ctx.fillStyle=DIVIDER; ctx.fillRect(PAD,curY+PLAYOFF_H,W-PAD*2,SEP_H);
      curY+=PLAYOFF_H+SEP_H;
    }
  });

  if(note){
    curY+=8;
    ctx.fillStyle='rgba(201,168,76,0.1)'; ctx.beginPath(); ctx.roundRect(PAD,curY,W-PAD*2,NOTE_H-12,8); ctx.fill();
    ctx.fillStyle=GOLD; ctx.font='500 14px DM Sans,sans-serif'; ctx.textAlign='center';
    ctx.fillText(note,W/2,curY+(NOTE_H-12)/2+5);
    curY+=NOTE_H;
  }

  const footY=H-FOOTER_H+10;
  ctx.fillStyle=DIVIDER; ctx.fillRect(PAD,footY,W-PAD*2,1);
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='14px DM Sans,sans-serif'; ctx.textAlign='center';
  ctx.fillText('Bray Head Golf Society · 2026 Season',W/2,footY+26);
  ctx.fillStyle=GOLD; ctx.font='500 13px DM Sans,sans-serif';
  ctx.fillText('www.golfsoc.ie',W/2,footY+48);
  const link=document.createElement('a');
  link.download='bhgs-knockout-fixtures.png'; link.href=canvas.toDataURL('image/png'); link.click();
  toast('Fixture card downloaded — share to WhatsApp!','success');
}
