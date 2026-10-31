/* K-Culture 마스터 — 교사용 관리 화면 */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const { CATS, CAT_INFO, CARDS, NOBLES, CHARS } = KC;
  const TK = [...CATS, 'wild'];
  const AV = (c) => `img/v2/ch_${CHARS.includes(c) ? c : 'jiho'}.webp`;
  const tkI = (k) => `<i class="tk ${k}">${CAT_INFO[k].s}</i>`;
  const RC = ['#e0575f', '#3a87d8', '#3aa36f', '#e3a03a', '#8b62d6', '#38a2ad', '#c2185b', '#5d6d7e', '#8d6e00', '#00897b'];
  const rColor = (r) => RC[(r.num - 1) % RC.length];
  const badge = (r) => `<span class="badge" style="background:${rColor(r)}">${r.num}번 방</span>`;
  const socket = io({ transports: ['websocket', 'polling'] });
  let T = null, offset = 0, view = 'live', selRoom = null, selStud = null, monTab = 'buy', rankSort = 'score';
  const KEY = 'kc_teacher2';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } })();
  if (saved) $('bResume').style.display = '';
  function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }
  const cmd = (op, extra = {}, cb) => socket.emit('t:cmd', { op, ...extra }, (r) => { if (r && r.err) toast(r.err); else if (cb) cb(r); });
  function confirmBox(msg, yes) { $('cfMsg').innerHTML = msg; $('pConfirm').classList.add('on'); $('cfYes').onclick = () => { $('pConfirm').classList.remove('on'); yes(); }; }
  $('cfNo').onclick = () => $('pConfirm').classList.remove('on');
  document.addEventListener('click', (e) => { const c = e.target.closest('[data-close]'); if (c) c.closest('.layer').classList.remove('on'); });

  function enter(r) {
    localStorage.setItem(KEY, JSON.stringify({ code: r.code, key: r.key }));
    $('vStart').style.display = 'none'; $('vApp').style.display = 'block';
    $('qrCode').textContent = r.code; $('qrUrl').textContent = location.origin + '/';
    $('qr').innerHTML = ''; try { new QRCode($('qr'), { text: `${location.origin}/?code=${r.code}`, width: 200, height: 200 }); } catch { $('qr').textContent = `${location.origin}/?code=${r.code}`; }
  }
  $('bCreate').onclick = () => socket.emit('t:create', { pass: $('tPass').value }, (r) => { if (r.ok) { $('tPass').value = ''; enter(r); $('pQR').classList.add('on'); } else { $('startErr').textContent = r.err; $('tPass').focus(); } });
  $('tPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('bCreate').click(); });
  $('bResume').onclick = () => socket.emit('t:resume', saved, (r) => { if (r.ok) enter(r); else { $('startErr').textContent = r.err + ' 새 수업을 만들어 주세요.'; $('bResume').style.display = 'none'; } });
  $('bQR').onclick = () => $('pQR').classList.add('on');
  socket.on('connect', () => { if (T) socket.emit('t:resume', JSON.parse(localStorage.getItem(KEY) || 'null'), (r) => { if (!r.ok) toast('수업 정보를 찾을 수 없어요.'); }); });
  socket.on('tstate', (s) => { T = s; offset = s.now - Date.now(); render(); });

  /* 화면 전환 */
  const TITLES = { live: '교사용 실시간 모니터링 | 6학년 영어 11단원', dash: '교사용 관리 화면', auto: '학생 자동 배정', manual: '수동 배정 (학생 이동)', monitor: '방별 상세 모니터링', questions: '영어 문제 관리', results: '게임 결과 보기' };
  function go(v) {
    view = v; $('plaque').textContent = TITLES[v];
    $('tabsTop').querySelectorAll('button[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    document.querySelectorAll('.view').forEach((e) => e.classList.toggle('on', e.id === 'v-' + v));
    if (v === 'questions') loadQ();
    render();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (b && !$('vApp').contains(b) && $('vApp').style.display === 'none') return;
    if (b) go(b.dataset.v);
    const o = e.target.closest('[data-open]'); if (o && o.dataset.open === 'settings') { renderSettings(); $('pSettings').classList.add('on'); }
    const c = e.target.closest('[data-c]'); if (c) quick(c.dataset.c);
  });
  function quick(c) {
    if (!T) return;
    if (c === 'startAll') confirmBox('대기 중인 모든 방의 게임을<br>시작하시겠습니까?', () => cmd('startAll', {}, (r) => toast(`${r.started}개 방이 게임을 시작했어요!`)));
    if (c === 'pause') cmd('pause', { on: !T.paused }, () => toast(T.paused ? '게임을 다시 진행해요.' : '모든 방을 일시 정지했어요.'));
    if (c === 'extend') cmd('extend', { min: 5 }, () => toast('진행 중인 모든 방의 시간을 5분 늘렸어요.'));
    if (c === 'extendPop') openExtend(null);
    if (c === 'endAll') confirmBox('진행 중인 모든 게임을<br>지금 종료할까요?', () => cmd('endAll'));
    if (c === 'newKeep') confirmBox('같은 팀으로 새 게임을 준비할까요?<br>(진행 중인 게임은 끝나요)', () => cmd('newRound', { keep: true, force: true }, () => toast('준비 완료! 전체 게임 시작을 누르세요.')));
    if (c === 'newMix') confirmBox('팀을 모두 풀고<br>대기실로 보낼까요?', () => cmd('newRound', { keep: false, force: true }, () => toast('학생들이 대기실로 돌아갔어요.')));
  }

  const sNow = () => Date.now() + offset;
  const mmss = (ms) => { ms = Math.max(0, ms); const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`; };
  const studs = () => (T ? T.students : []);
  const roomById = (id) => T && T.rooms.find((r) => r.id === id);
  const teamScore = (r) => (r.game ? Object.values(r.game.ps).reduce((a, p) => a + p.score, 0) : 0);
  const teamTok = (r) => { const o = { food: 0, clothing: 0, play: 0, craft: 0, heritage: 0, wild: 0 }; if (r.game) Object.values(r.game.ps).forEach((p) => TK.forEach((k) => (o[k] += p.tokens[k]))); return o; };
  const status = (r) => (r.status === 'lobby' ? ['wait', '대기 중'] : r.status === 'ended' ? ['end', '게임 끝'] : r.paused || T.paused ? ['pause', '일시 정지'] : ['play', '진행 중']);
  const stOf = (s) => (!s.online ? '<span class="off-dot">오프라인</span>' : s.roomId ? '<span class="on-dot">접속</span>' : '<span class="wait-dot">대기</span>');
  const pScore = (r, pid) => (r.game && r.game.ps[pid] ? r.game.ps[pid].score : 0);

  function render() {
    if (!T) return;
    $('sCode').textContent = T.code;
    $('tbPause').querySelector('img').src = `img/n/btn/pause_${T.paused ? 'p' : 'n'}.webp`; $('tbPause').title = T.paused ? '다시 진행하기' : '전체 일시 정지';
    { const on = studs().filter((x) => x.online).length; $('hStat').innerHTML = `참여 ${on} / ${studs().length}명 &nbsp; 진행 ${T.rooms.filter((r) => r.status === 'playing').length} / ${T.rooms.length}방${T.paused ? ' &nbsp;<span style="color:#ffb35a">⏸ 정지 중</span>' : ''}`; }
    renderStats();
    if (view === 'live') renderLive();
    if (view === 'dash') renderDash();
    if (view === 'auto') renderAuto();
    if (view === 'manual') renderManual();
    if (view === 'monitor') renderMonitor();
    if (view === 'results') renderResults();
  }
  function renderStats() {
    const on = studs().filter((s) => s.online).length, all = studs().length;
    const playing = T.rooms.filter((r) => r.status === 'playing');
    const scored = T.rooms.filter((r) => r.game);
    const avgRound = playing.length ? Math.round(playing.reduce((a, r) => a + r.game.round, 0) / playing.length) : 0;
    const avg = scored.length ? Math.round(scored.reduce((a, r) => a + teamScore(r), 0) / scored.length) : 0;
    const top = scored.slice().sort((a, b) => teamScore(b) - teamScore(a))[0];
    const left = playing.length ? Math.max(...playing.map((r) => r.game.endAt - sNow())) : 0;
    $('stats').innerHTML = [['👥', '접속 학생 수', `${on} / ${all}명`], ['🚪', '생성된 방', `${T.rooms.length}개`], ['🎮', '게임 진행 중', `${playing.length}개`],
      ['🕐', '평균 라운드 · 남은 시간', playing.length ? `${avgRound}라운드 · ${mmss(left)}` : '-'], ['📊', '방 평균 점수', `${avg}점`], ['🏆', '1위 방', top ? `${top.name} (${teamScore(top)}점)` : '-']]
      .map(([i, s, b]) => `<div class="stat"><i>${i}</i><div><small>${s}</small><b>${b}</b></div></div>`).join('');
  }

  /* 방 카드 */
  function roomCard(r, opt = {}) {
    const [k, st] = status(r); const g = r.game; const tk = teamTok(r);
    const max = Math.max(r.max || 5, r.players.length);
    const mem = r.players.map((p) => { const ps = g && g.ps[p.id]; return `<div class="mem ${g && g.turn && g.turn.pid === p.id ? 'turn' : ''} ${p.online ? '' : 'off'} ${opt.pick === p.id ? 'picked' : ''}" data-sid="${p.id}"><img class="a" src="${AV(p.char)}"><b>${esc(p.name)}</b><em>${ps ? ps.score + '점' : '&nbsp;'}</em><div class="mc">${ps ? ps.cards.slice(-3).map((id) => `<img src="img/n/ph/${id}.webp">`).join('') : ''}</div></div>`; }).join('')
      + Array.from({ length: Math.max(0, Math.min(5, max) - r.players.length) }, () => '<div class="mem empty">빈 자리</div>').join('');
    return `<div class="rc ${selRoom === r.id && opt.sel ? 'selR' : ''}" data-room="${r.id}" style="border-color:${rColor(r)}">
      <div class="rcH">${badge(r)}<span class="tt">${esc(r.title)}</span><span class="pill ${k}">${st}</span></div>
      <div class="rcSub"><span>👥 ${r.players.length} / ${r.max || 5}명</span>${opt.rename ? `<button class="tb red sm" data-rename="${r.id}">방 이름 변경</button>` : `<span class="sc">${teamScore(r)}점</span>`}</div>
      <div class="rcM">${mem}</div>
      <div class="rcF">${opt.noTok ? `<span>${r.by === 'student' ? '학생이 만든 방' : '선생님 배정'}</span>` : `<span>자원</span>${TK.map((x) => `${tkI(x)}<b>${tk[x]}</b>`).join('')}`}${opt.foot || ''}</div></div>`;
  }

  /* ===== 전체 관리 ===== */
  let dSel = new Set();
  function roomOptions(cur, blank = '미배정') { return `<option value="">${blank}</option>${T.rooms.filter((r) => r.status === 'lobby').map((r) => `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${r.name}</option>`).join('')}<option value="new">새 방</option>`; }
  function renderDash() {
    const focus = document.activeElement;
    if (!(focus && focus.tagName === 'SELECT' && $('v-dash').contains(focus))) {
      const q = $('dSearch').value.trim();
      const list = studs().filter((s) => !q || s.name.includes(q));
      $('dCount').textContent = `(${studs().length}명)`;
      $('dStud').innerHTML = list.map((s, i) => { const r = roomById(s.roomId); const locked = r && r.status !== 'lobby';
        return `<tr class="${dSel.has(s.id) ? 'sel' : ''}"><td><input type="checkbox" data-ds="${s.id}" ${dSel.has(s.id) ? 'checked' : ''}></td><td>${i + 1}</td><td>${esc(s.name)}</td><td>${stOf(s)}</td><td>${locked ? `<span class="sq" style="background:${rColor(r)}">${r.name}</span>` : `<select class="rsel" data-mv="${s.id}" style="background:${r ? rColor(r) : '#999'}">${roomOptions(s.roomId)}</select>`}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">아직 들어온 학생이 없어요.</td></tr>';
      $('dMoveTo').innerHTML = roomOptions('', '이동할 방');
    }
    if (!selRoom || !roomById(selRoom)) selRoom = T.rooms[0] && T.rooms[0].id;
    $('dRooms').innerHTML = T.rooms.length ? T.rooms.map((r) => roomCard(r, { sel: true })).join('') : '<div class="pnl"><div class="pb muted">아직 방이 없어요. <b>학생 자동 배정</b>을 누르거나 학생들이 방을 만들 때까지 기다려요.</div></div>';
    // 진행 상황
    const playing = T.rooms.filter((r) => r.status === 'playing');
    const left = playing.length ? Math.max(...playing.map((r) => r.game.endAt - sNow())) : 0;
    const el = playing.length ? Math.max(...playing.map((r) => sNow() - r.game.startAt)) : 0;
    const rd = playing.length ? Math.max(...playing.map((r) => r.game.round)) : 0;
    $('dProg').innerHTML = `<div class="prog"><img src="img/n/t/teacher.webp" style="border-radius:50%"><div><p>🕑 진행 라운드 : <b>${rd || '-'}</b></p><p>⏱ 진행 시간 : ${playing.length ? mmss(el) : '-'}</p><p>⌛ 남은 시간 : ${playing.length ? mmss(left) : '-'}</p><p>🎯 목표 점수 : ${T.settings.target}점</p></div></div>
      <div class="track">${[0, 1, 2, 3, 4].map((i) => `<i class="${playing.length && i <= Math.min(4, Math.floor((el / (el + left || 1)) * 5)) ? 'on' : ''}"></i>${i < 4 ? `<s class="${playing.length && i < Math.floor((el / (el + left || 1)) * 5) ? 'on' : ''}"></s>` : ''}`).join('')}</div>`;
    // 점수 현황
    const key = { score: teamScore, tok: (r) => Object.values(teamTok(r)).reduce((a, b) => a + b, 0), cards: (r) => (r.game ? Object.values(r.game.ps).reduce((a, p) => a + p.cards.length, 0) : 0) }[rankSort];
    const rk = T.rooms.slice().sort((a, b) => key(b) - key(a));
    $('dRank').innerHTML = `<table class="tbl small rk"><thead><tr><th>순위</th><th>방</th><th>방 이름</th><th>총점</th><th>자원 수</th><th>카드</th></tr></thead><tbody>${rk.map((r, i) => `<tr><td>${i < 3 ? ['🏆', '🥈', '🥉'][i] : i + 1}</td><td><span class="sq" style="background:${rColor(r)}">${r.num}</span></td><td class="l">${esc(r.title)}</td><td style="color:#c81e1a">${teamScore(r)}</td><td>${Object.values(teamTok(r)).reduce((a, b) => a + b, 0)}</td><td>${r.game ? Object.values(r.game.ps).reduce((a, p) => a + p.cards.length, 0) : 0}</td></tr>`).join('')}</tbody></table>`;
    // 선택 방
    const r = roomById(selRoom);
    $('dSel').innerHTML = r ? `<div class="selHead">${badge(r)}<b style="font-weight:400">${esc(r.title)}</b><span class="pill ${status(r)[0]}">${status(r)[1]}</span><button class="tb sky sm" style="margin-left:auto" id="dGoMon">상세 모니터링</button></div>
      <table class="tbl small"><thead><tr><th>이름</th><th>점수</th><th>자원</th><th>카드</th><th>예약</th></tr></thead><tbody>${r.players.map((p) => { const ps = r.game && r.game.ps[p.id]; return `<tr><td>${esc(p.name)}</td><td style="color:#c81e1a">${ps ? ps.score : 0}</td><td>${ps ? TK.filter((k) => ps.tokens[k]).map((k) => `<span class="tokS">${tkI(k)}${ps.tokens[k]}</span>`).join('') || '-' : '-'}</td><td>${ps ? ps.cards.length : 0}</td><td>${ps ? ps.reserved.length : 0}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">방을 누르면 여기에 자세히 보여요.</p>';
    const gm = $('dGoMon'); if (gm) gm.onclick = () => go('monitor');
  }
  $('dSearch').oninput = renderDash;
  $('dRankTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; rankSort = b.dataset.s; $('dRankTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); renderDash(); });
  $('dRooms').addEventListener('click', (e) => { const c = e.target.closest('.rc'); if (c) { selRoom = c.dataset.room; renderDash(); } });
  $('v-dash').addEventListener('change', (e) => {
    const s = e.target.closest('[data-mv]'); if (s) { cmd('move', { sid: s.dataset.mv, to: s.value }); s.blur(); }
    const c = e.target.closest('[data-ds]'); if (c) { c.checked ? dSel.add(c.dataset.ds) : dSel.delete(c.dataset.ds); }
  });
  $('dAll').onchange = () => { studs().forEach((s) => ($('dAll').checked ? dSel.add(s.id) : dSel.delete(s.id))); renderDash(); };
  $('dClear').onclick = () => { dSel.clear(); $('dAll').checked = false; renderDash(); };
  $('dMove').onclick = () => { const to = $('dMoveTo').value; if (!dSel.size) return toast('이동할 학생을 먼저 선택해 주세요.'); if (!to) return toast('이동할 방을 골라 주세요.'); moveMany([...dSel], to); dSel.clear(); };
  function moveMany(ids, to) {
    let target = to;
    const step = (i) => { if (i >= ids.length) { toast('학생 이동이 완료되었습니다.'); return; }
      socket.emit('t:cmd', { op: 'move', sid: ids[i], to: target }, (r) => {
        if (r && r.err) toast(r.err);
        else if (target === 'new') { const s = T.students.find((x) => x.id === ids[i]); setTimeout(() => { const st = T.students.find((x) => x.id === ids[i]); target = st && st.roomId ? st.roomId : 'new'; step(i + 1); }, 250); return; }
        step(i + 1); }); };
    step(0);
  }

  /* ===== 자동 배정 ===== */
  let aPick = null, aPreview = null, aTouched = false;
  function lastTeams() {
    if (!T.history.length) return {};
    const no = Math.max(...T.history.map((h) => h.gameNo)); const m = {};
    T.history.filter((h) => h.gameNo === no).forEach((h, gi) => h.ranking.forEach((r) => (m[r.pid] = gi)));
    return m;
  }
  function renderAuto() {
    const focus = document.activeElement; if (focus && focus.tagName === 'SELECT' && $('v-auto').contains(focus)) return;
    if (!aPick) aPick = new Set(studs().map((s) => s.id));
    if (!aTouched) studs().forEach((s) => aPick.add(s.id));
    const q = $('aSearch').value.trim(); const onlyOn = $('aOnline').checked;
    const list = studs().filter((s) => !q || s.name.includes(q));
    $('aCount').textContent = `(${studs().length}명)`; $('aOnN').textContent = `(현재 ${studs().filter((s) => s.online).length}명)`;
    $('aStud').innerHTML = list.map((s, i) => `<tr><td><input type="checkbox" data-as="${s.id}" ${aPick.has(s.id) ? 'checked' : ''}></td><td>${i + 1}</td><td>${esc(s.name)}</td><td>${stOf(s)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">아직 들어온 학생이 없어요.</td></tr>';
    const steps = $('aSteps').querySelectorAll('span'); steps.forEach((s, i) => s.classList.toggle('on', i === (aPreview ? 2 : 0) || (i === 1 && !aPreview && aPick.size)));
    const n = studs().filter((s) => aPick.has(s.id) && (!onlyOn || s.online)).length;
    if (aPreview) {
      $('aRooms').innerHTML = aPreview.map((gr, i) => roomCard({ id: 'p' + i, num: i + 1, name: `${i + 1}번 방`, title: gr.title, max: +$('aSize').value, status: 'lobby', by: 'teacher', players: gr.ids.map((id) => { const s = T.students.find((x) => x.id === id) || {}; return { id, name: s.name, char: s.char, online: s.online }; }) }, { noTok: true })).join('');
      $('aSay').textContent = `${n}명의 학생을 ${aPreview.length}개 방으로 나눴어요! 배정 결과 적용을 눌러 주세요.`;
    } else {
      const size = +$('aSize').value; const k = n ? Math.ceil(n / size) : 0;
      $('aRooms').innerHTML = T.rooms.length ? T.rooms.map((r) => roomCard(r)).join('') : '<div class="pnl"><div class="pb muted">자동 배정하기를 누르면 여기에 배정 결과를 먼저 보여 줘요.</div></div>';
      $('aSay').textContent = n ? `${n}명의 학생을 ${k}개 방으로 자동 배정합니다!` : '배정할 학생을 선택해 주세요.';
    }
    $('aApply').disabled = !aPreview; $('aAgain').disabled = !aPreview;
  }
  function buildPreview() {
    const onlyOn = $('aOnline').checked, size = +$('aSize').value;
    let ids = studs().filter((s) => aPick.has(s.id) && (!onlyOn || s.online)).map((s) => s.id);
    if (!$('aReset').checked) ids = ids.filter((id) => { const s = T.students.find((x) => x.id === id); return !s.roomId; });
    const sh = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    if (!ids.length) return null;
    const k = Math.max(1, Math.ceil(ids.length / size));
    const sizes = Array.from({ length: k }, (_, i) => Math.floor(ids.length / k) + (i < ids.length % k ? 1 : 0));
    const prev = $('aMix').checked ? lastTeams() : {};
    let best = null, bestCost = 1e9;
    for (let tr = 0; tr < 200; tr++) {
      const s = sh(ids); const groups = []; let p = 0; sizes.forEach((z) => { groups.push(s.slice(p, p + z)); p += z; });
      let cost = 0; groups.forEach((g) => { for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) if (prev[g[a]] !== undefined && prev[g[a]] === prev[g[b]]) cost++; });
      if (cost < bestCost) { best = groups; bestCost = cost; if (!cost) break; }
    }
    const used = $('aReset').checked ? 0 : T.rooms.reduce((a, r) => Math.max(a, r.num), 0);
    return best.map((g, i) => ({ title: KC.TEAM_NAMES[(used + i) % KC.TEAM_NAMES.length], ids: g }));
  }
  $('aRun').onclick = () => { aPreview = buildPreview(); if (!aPreview) return toast('배정할 학생이 없어요.'); renderAuto(); };
  $('aAgain').onclick = () => { aPreview = buildPreview(); renderAuto(); };
  $('aApply').onclick = () => { if (!aPreview) return; cmd('setAssign', { groups: aPreview, reset: $('aReset').checked }, (r) => { toast(`${r.teams}개 방으로 배정을 적용했어요!`); aPreview = null; renderAuto(); }); };
  $('aSearch').oninput = renderAuto;
  ['aOnline', 'aReset', 'aMix'].forEach((id) => ($(id).onchange = () => { aPreview = null; renderAuto(); }));
  $('aSize').onchange = () => { aPreview = null; cmd('settings', { settings: { teamSize: +$('aSize').value } }); renderAuto(); };
  $('aStud').addEventListener('change', (e) => { const c = e.target.closest('[data-as]'); if (!c) return; aTouched = true; c.checked ? aPick.add(c.dataset.as) : aPick.delete(c.dataset.as); aPreview = null; renderAuto(); });
  $('aAll').onchange = () => { aTouched = true; studs().forEach((s) => ($('aAll').checked ? aPick.add(s.id) : aPick.delete(s.id))); aPreview = null; renderAuto(); };
  $('aSelAll').onclick = () => { $('aAll').checked = true; $('aAll').onchange(); };
  $('aSelNone').onclick = () => { $('aAll').checked = false; $('aAll').onchange(); };

  /* ===== 수동 배정 ===== */
  let mPick = null; const mLog = [];
  function renderManual() {
    const focus = document.activeElement; if (focus && focus.tagName === 'SELECT' && $('v-manual').contains(focus)) return;
    const q = $('mSearch').value.trim();
    $('mCount').textContent = `(${studs().length}명)`;
    $('mStud').innerHTML = studs().filter((s) => !q || s.name.includes(q)).map((s, i) => { const r = roomById(s.roomId); return `<tr class="${selStud === s.id ? 'sel' : ''}" data-pick="${s.id}" style="cursor:pointer"><td><input type="radio" name="mp" ${selStud === s.id ? 'checked' : ''}></td><td>${i + 1}</td><td style="text-align:left"><img src="${AV(s.char)}" style="height:24px;vertical-align:middle"> ${esc(s.name)}</td><td>${stOf(s)}</td><td>${r ? `<span class="sq" style="background:${rColor(r)}">${r.name}</span>` : '<span class="sq" style="background:#999">미배정</span>'}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">아직 들어온 학생이 없어요.</td></tr>';
    const s = T.students.find((x) => x.id === selStud); const cur = s && roomById(s.roomId);
    $('mSel').innerHTML = s ? `<img src="${AV(s.char)}"><div><b>${esc(s.name)}</b><span class="cur">현재: ${cur ? cur.name : '미배정'}</span><div>${cur ? pScore(cur, s.id) + '점' : ''}</div></div>` : '<p class="muted">왼쪽 목록이나 방 카드에서 학생을 눌러 주세요.</p>';
    const lobby = T.rooms.filter((r) => r.status === 'lobby');
    $('mPick').innerHTML = lobby.map((r) => `<button data-to="${r.id}" class="${mPick === r.id ? 'on' : ''}" style="background:${rColor(r)}" ${r.players.length >= (r.max || 5) && (!s || s.roomId !== r.id) ? 'disabled' : ''}>${r.name}</button>`).join('') + `<button data-to="new" class="${mPick === 'new' ? 'on' : ''}" style="background:#5d6d7e">＋ 새 방</button><button data-to="" class="${mPick === '' ? 'on' : ''}" style="background:#999">미배정</button>`;
    $('mRooms').innerHTML = T.rooms.map((r) => roomCard(r, { rename: true, pick: selStud })).join('') || '<div class="pnl"><div class="pb muted">아직 방이 없어요.</div></div>';
    $('mLog').innerHTML = mLog.slice(0, 6).map((l) => `<tr><td>${l.t}</td><td>${esc(l.n)}</td><td>${esc(l.m)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">아직 이동 기록이 없어요.</td></tr>';
    $('mCap').innerHTML = T.rooms.map((r) => `<div><span class="sq" style="background:${rColor(r)}">${r.name}</span><span class="bar"><i style="width:${(r.players.length / (r.max || 5)) * 100}%;background:${rColor(r)}"></i></span>${r.players.length} / ${r.max || 5}</div>`).join('') || '<p class="muted">방이 없어요.</p>';
  }
  $('mSearch').oninput = renderManual;
  $('mStud').addEventListener('click', (e) => { const tr = e.target.closest('[data-pick]'); if (tr) { selStud = tr.dataset.pick; mPick = null; renderManual(); } });
  $('mRooms').addEventListener('click', (e) => {
    const rn = e.target.closest('[data-rename]'); if (rn) { const r = roomById(rn.dataset.rename); $('rnIn').value = r.title; $('pRename').classList.add('on'); $('rnOk').onclick = () => cmd('rename', { id: r.id, title: $('rnIn').value }, () => { $('pRename').classList.remove('on'); toast('방 이름을 바꿨어요.'); }); return; }
    const m = e.target.closest('[data-sid]'); if (m) { selStud = m.dataset.sid; mPick = null; renderManual(); }
  });
  $('mPick').addEventListener('click', (e) => { const b = e.target.closest('[data-to]'); if (b && !b.disabled) { mPick = b.dataset.to; renderManual(); } });
  $('mGo').onclick = () => {
    const s = T.students.find((x) => x.id === selStud); if (!s) return toast('이동할 학생을 먼저 골라 주세요.');
    if (mPick === null) return toast('이동할 방을 골라 주세요.');
    if ((mPick || null) === (s.roomId || null)) return toast('이미 그 방에 있어요. 다른 방을 골라 주세요.');
    const from = roomById(s.roomId); const to = roomById(mPick);
    cmd('move', { sid: s.id, to: mPick }, () => { const d = new Date(); mLog.unshift({ t: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`, n: s.name, m: `${from ? from.name : '미배정'} → ${to ? to.name : mPick === 'new' ? '새 방' : '미배정'}` }); mPick = null; toast('학생 이동이 완료되었습니다.'); renderManual(); });
  };

  /* ===== 방별 모니터링 ===== */
  let monStud = null;
  function renderMonitor() {
    if (!selRoom || !roomById(selRoom)) selRoom = T.rooms[0] && T.rooms[0].id;
    $('rlCount').textContent = `(${T.rooms.length}개 방)`;
    $('monList').innerHTML = T.rooms.map((r) => `<div class="rli ${r.id === selRoom ? 'on' : ''}" data-room="${r.id}"><span class="sq" style="background:${rColor(r)};height:46px;line-height:46px;width:84px;text-align:center">${r.name}</span><div class="nm"><b>${esc(r.title)}</b><small>👥 ${r.players.length}/${r.max || 5}명 · <span class="pill ${status(r)[0]}">${status(r)[1]}</span></small></div><span class="pt">${teamScore(r)}점</span></div>`).join('') || '<p class="muted">방이 없어요.</p>';
    const r = roomById(selRoom);
    if (!r) { $('monMain').innerHTML = '<div class="pnl"><div class="pb muted">방이 생기면 여기에 자세히 보여요.</div></div>'; $('monTurn').innerHTML = ''; $('monOps').innerHTML = ''; }
    else {
      const g = r.game, t = g && g.turn;
      if (!monStud || !r.players.find((p) => p.id === monStud)) monStud = r.players[0] && r.players[0].id;
      const tabs = [['buy', '구매한 카드'], ['rsv', '예약 카드'], ['tok', '보유 자원'], ['disc', '영구 할인'], ['log', '게임 로그']];
      const ps = g && g.ps[monStud];
      let body = '';
      if (!g) body = '<p class="muted">아직 게임을 시작하지 않았어요.</p>';
      else if (monTab === 'buy') body = Object.entries(g.ps).flatMap(([pid, p]) => p.cards.map((id) => `<div class="cc"><img src="img/n/card/${id}.webp">${esc(p.name)}</div>`)).join('') || '<p class="muted">아직 구매한 카드가 없어요.</p>';
      else if (monTab === 'rsv') body = Object.entries(g.ps).flatMap(([pid, p]) => p.reserved.map((id) => `<div class="cc"><img src="img/n/card/${id}.webp">${esc(p.name)}</div>`)).join('') || '<p class="muted">예약한 카드가 없어요.</p>';
      else if (monTab === 'tok') body = `<table class="tbl"><thead><tr><th>이름</th>${TK.map((k) => `<th>${tkI(k)}</th>`).join('')}<th>합계</th></tr></thead><tbody>${r.players.map((p) => { const x = g.ps[p.id]; return x ? `<tr><td>${esc(p.name)}</td>${TK.map((k) => `<td>${x.tokens[k]}</td>`).join('')}<td>${TK.reduce((a, k) => a + x.tokens[k], 0)}/10</td></tr>` : ''; }).join('')}<tr style="background:#f4e7c9"><td>창고</td>${TK.map((k) => `<td>${g.bank[k]}</td>`).join('')}<td></td></tr></tbody></table>`;
      else if (monTab === 'disc') body = `<table class="tbl"><thead><tr><th>이름</th>${CATS.map((k) => `<th>${CAT_INFO[k].ko}</th>`).join('')}<th>보너스 카드</th></tr></thead><tbody>${r.players.map((p) => { const x = g.ps[p.id]; if (!x) return ''; const d = KC.catCounts(x.cards); return `<tr><td>${esc(p.name)}</td>${CATS.map((k) => `<td>${d[k] ? '-' + d[k] : 0}</td>`).join('')}<td>${x.nobles.map((n) => NOBLES[n].ko).join(', ') || '-'}</td></tr>`; }).join('')}</tbody></table>`;
      else body = g.log.slice().reverse().map((l) => `<div class="logl">${new Date(l.t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${esc(l.msg)}</div>`).join('');
      const q = r.curQ;
      $('monMain').innerHTML = `<div class="mHero">${badge(r)}<span class="tt">${esc(r.title)}</span><span class="box">👥 ${r.players.length} / ${r.max || 5}명 <span class="pill ${status(r)[0]}">${status(r)[1]}</span></span><span class="box">👑 총 점수 <b>${teamScore(r)}점</b></span></div>
        <div class="bigMems">${r.players.map((p) => { const x = g && g.ps[p.id]; return `<div class="bm ${monStud === p.id ? 'on' : ''} ${t && t.pid === p.id ? 'turn' : ''}" data-ms="${p.id}"><img class="a" src="${AV(p.char)}"><b>${esc(p.name)}${p.online ? '' : ' (끊김)'}</b><em>${x ? x.score : 0}점</em><div class="mc">${x ? x.cards.map((id) => `<img src="img/n/ph/${id}.webp">`).join('') : ''}</div>${x ? `<div class="tkr">${TK.map((k) => `<span class="tokS">${tkI(k)}${x.tokens[k]}</span>`).join('')}</div>` : ''}</div>`; }).join('')}</div>
        ${q ? `<div class="pnl"><div class="ph">지금 푸는 문제 (${CAT_INFO[q.cat].ko})</div><div class="pb" style="display:flex;gap:12px;align-items:center">${q.img ? `<img src="img/n/ph/${q.img}.webp" style="height:90px;border-radius:8px">` : ''}<div style="font-family:Fredoka,Jua;font-weight:600;font-size:18px;white-space:pre-line;flex:1">${esc(q.text)}</div><div>${q.choices.map((c, i) => `<div style="color:${i === q.answer ? '#17883a' : '#555'}">${'ABCD'[i]}. ${esc(c)}${i === q.answer ? ' ✔' : ''}</div>`).join('')}</div></div></div>` : ''}
        <div><div class="ctabs">${tabs.map(([k, n]) => `<button data-mt="${k}" class="${monTab === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="cbody">${body}</div></div>`;
      // 현재 차례
      if (t) {
        const who = g.ps[t.pid]; const idx = g.order.indexOf(t.pid); const tot = (T.settings.turnTime || 60) * 1000; const left = Math.max(0, t.deadline - sNow());
        $('monTurn').innerHTML = `<div class="turnBox"><img src="${AV(who.char)}"><b>${esc(who.name)}</b><span class="ord">${idx + 1}번째</span><div>⏱ 남은 시간 <b style="display:inline;font-size:22px">${Math.ceil(left / 1000)}초</b></div><div class="bar"><i style="width:${Math.min(100, (left / tot) * 100)}%"></i></div></div>
          <div class="nextL"><div style="background:#f4e7c9">다음 순서</div>${[1, 2, 3, 4].filter((k) => k < g.order.length).map((k) => { const pid = g.order[(idx + k) % g.order.length]; const p = g.ps[pid]; return `<div>${((idx + k) % g.order.length) + 1} <img src="${AV(p.char)}"> ${esc(p.name)}</div>`; }).join('')}</div>`;
      } else $('monTurn').innerHTML = `<p class="muted">${r.status === 'ended' ? '게임이 끝났어요.' : '게임 시작 전이에요.'}</p>`;
      $('monOps').innerHTML = r.status === 'lobby' ? `<button class="tb green" data-op="start">▶ 이 방 게임 시작</button><button class="tb sky" data-op="rename">방 이름 변경</button><button class="tb red" data-op="del">방 삭제하기</button>`
        : r.status === 'playing' ? `<button class="tb pink" data-op="msg">💬 메시지 보내기</button><button class="tb sky" data-op="ext">⏱ 시간 연장</button><button class="tb green" data-op="resume" ${r.paused ? '' : 'disabled'}>게임 계속하기</button><button class="tb orange" data-op="pause" ${r.paused ? 'disabled' : ''}>⏸ 일시 정지</button><button class="tb sky" data-op="skip">차례 넘기기</button><button class="tb red" data-op="end">방 종료하기</button><button class="tb blue" data-op="reset">방 초기화 (카드/자원)</button>`
        : `<button class="tb purple" data-op="result">📊 결과 분석</button><button class="tb blue" data-op="reset">같은 팀으로 다시 하기</button><button class="tb sky" data-op="rename">방 이름 변경</button>`;
    }
    // 실시간 로그
    const logs = T.rooms.flatMap((x) => (x.game ? x.game.log.map((l) => ({ ...l, r: x })) : [])).sort((a, b) => b.t - a.t).slice(0, 30);
    $('monLog').innerHTML = logs.map((l) => `<tr><td>${new Date(l.t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</td><td><span class="sq" style="background:${rColor(l.r)}">${l.r.name}</span></td><td class="l">${esc(l.msg)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">아직 기록이 없어요.</td></tr>';
    const mx = Math.max(1, ...T.rooms.map(teamScore));
    $('monBars').innerHTML = T.rooms.slice().sort((a, b) => teamScore(b) - teamScore(a)).map((x, i) => `<div class="hbar"><span>${i === 0 ? '👑 ' : ''}${x.name}</span><span class="b"><i style="width:${(teamScore(x) / mx) * 100}%;background:${rColor(x)}"></i></span><b style="font-weight:400">${teamScore(x)}점</b></div>`).join('');
    const rr = roomById(selRoom); const ps = rr && rr.game && rr.game.ps[monStud]; const sp = rr && rr.players.find((p) => p.id === monStud);
    $('monStudHead').textContent = sp ? `학생별 상세 정보 (${sp.name})` : '학생별 상세 정보';
    $('monStud').innerHTML = sp ? `<div class="sd"><img class="a" src="${AV(sp.char)}"><div style="flex:1"><b style="font-size:22px;font-weight:400">${esc(sp.name)}</b> · 총 점수 <b style="color:#c81e1a">${ps ? ps.score : 0}점</b> · 정답 ${ps ? `${ps.correct}/${ps.attempts}` : '-'} · 힌트 ${ps ? ps.hints : '-'}개 남음
      <div>${ps ? TK.map((k) => `<span class="tokS">${tkI(k)}${ps.tokens[k]}</span>`).join('') : ''}</div>
      <div style="display:flex;gap:10px;margin-top:4px"><div><small>구매한 카드</small><div class="cards">${ps ? ps.cards.map((id) => `<img src="img/n/ph/${id}.webp">`).join('') || '-' : '-'}</div></div><div><small>예약 카드</small><div class="cards">${ps ? ps.reserved.map((id) => `<img src="img/n/ph/${id}.webp">`).join('') || '-' : '-'}</div></div></div></div></div>` : '<p class="muted">학생을 누르면 자세히 보여요.</p>';
  }
  $('monList').addEventListener('click', (e) => { const r = e.target.closest('[data-room]'); if (r) { selRoom = r.dataset.room; monStud = null; renderMonitor(); } });
  $('monMain').addEventListener('click', (e) => { const t = e.target.closest('[data-mt]'); if (t) { monTab = t.dataset.mt; renderMonitor(); } const m = e.target.closest('[data-ms]'); if (m) { monStud = m.dataset.ms; renderMonitor(); } });
  $('monOps').addEventListener('click', (e) => {
    const b = e.target.closest('[data-op]'); if (!b) return; const r = roomById(selRoom); if (!r) return; const op = b.dataset.op;
    if (op === 'start') cmd('startAll', { id: r.id }, () => toast(`${r.name} 게임을 시작했어요!`));
    if (op === 'pause') cmd('pauseRoom', { id: r.id, on: true }, () => toast(`${r.name}을(를) 일시 정지했어요.`));
    if (op === 'resume') cmd('pauseRoom', { id: r.id, on: false }, () => toast(`${r.name} 게임을 계속해요.`));
    if (op === 'skip') cmd('skipTurn', { id: r.id });
    if (op === 'result') openResult(r.num);
    if (op === 'end') openEndRoom(r);
    if (op === 'msg') openMsg(r);
    if (op === 'ext') openExtend(r);
    if (op === 'reset') confirmBox(`${r.name}의 카드와 자원을 처음으로 되돌리고<br>같은 팀으로 다시 준비할까요?`, () => cmd('resetRoom', { id: r.id }, () => toast('방을 초기화했어요. 게임 시작을 눌러 주세요.')));
    if (op === 'del') confirmBox(`${r.name}을(를) 삭제할까요?<br>(학생들은 미배정이 돼요)`, () => cmd('deleteRoom', { id: r.id }));
    if (op === 'rename') { $('rnIn').value = r.title; $('pRename').classList.add('on'); $('rnOk').onclick = () => cmd('rename', { id: r.id, title: $('rnIn').value }, () => $('pRename').classList.remove('on')); }
  });
  setInterval(() => { if (T && (view === 'monitor' || view === 'dash')) { renderStats(); } }, 1000);

  /* ===== 설정 ===== */
  const setIds = { stTime: 'timeLimit', stTarget: 'target', stTurn: 'turnTime', stQ: 'qTime', stSize: 'teamSize', stHints: 'hints' };
  function renderSettings() { if (!T) return; Object.entries(setIds).forEach(([id, k]) => ($(id).value = T.settings[k])); $('stRooms').checked = T.settings.allowRooms; $('stFast').checked = T.settings.fast !== false; $('stHost').checked = T.settings.hostStart; }
  Object.entries(setIds).forEach(([id, k]) => ($(id).onchange = () => cmd('settings', { settings: { [k]: +$(id).value } }, () => toast('설정을 바꿨어요.'))));
  $('stFast').onchange = () => cmd('settings', { settings: { fast: $('stFast').checked } }, () => toast('설정을 바꿨어요.'));
  $('stRooms').onchange = () => cmd('settings', { settings: { allowRooms: $('stRooms').checked } });
  $('stHost').onchange = () => cmd('settings', { settings: { hostStart: $('stHost').checked } });

  /* ===== 결과 ===== */
  function aggregate() {
    const m = new Map();
    T.history.forEach((h) => h.ranking.forEach((r) => { const a = m.get(r.name) || { name: r.name, char: r.char, games: 0, score: 0, wins: 0, correct: 0, attempts: 0, cards: 0 }; a.games++; a.score += r.score; a.correct += r.correct; a.attempts += r.attempts; a.cards += r.cards; if (r.rank === 1) a.wins++; a.char = r.char; m.set(r.name, a); }));
    return [...m.values()].sort((a, b) => b.score - a.score || b.wins - a.wins);
  }
  function renderResults() {
    const agg = aggregate();
    $('rTotal').innerHTML = agg.length ? `<div class="tblWrap" style="max-height:none"><table class="tbl"><thead><tr><th>순위</th><th>이름</th><th>게임 수</th><th>1등</th><th>누적 점수</th><th>모은 카드</th><th>정답 / 문제</th><th>정답률</th></tr></thead><tbody>${agg.map((a, i) => `<tr><td><span class="medal m${i + 1}">${i + 1}</span></td><td style="text-align:left"><img src="${AV(a.char)}" style="height:30px;vertical-align:middle"> ${esc(a.name)}</td><td>${a.games}</td><td>${a.wins}</td><td style="color:#c81e1a">${a.score}</td><td>${a.cards}</td><td>${a.correct} / ${a.attempts}</td><td>${a.attempts ? Math.round((a.correct / a.attempts) * 100) : 0}%</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">아직 끝난 게임이 없어요. 게임이 끝나면 여기에 결과가 쌓여요.</p>';
    const byGame = {}; T.history.forEach((h) => (byGame[h.gameNo] = byGame[h.gameNo] || []).push(h));
    $('rGames').innerHTML = Object.keys(byGame).sort((a, b) => b - a).map((no) => `<div class="pnl gameRes"><div class="ph">${no}번째 게임</div><div class="pb resRooms">${byGame[no].sort((a, b) => a.roomNum - b.roomNum).map((h) => `<div class="rr"><h4>${esc(h.room)} <small>${h.reason === 'target' ? '목표 점수 달성' : h.reason === 'time' ? '시간 종료' : '선생님 종료'} · ${Math.floor(h.durationSec / 60)}분 ${h.durationSec % 60}초</small></h4>${h.ranking.map((r) => `<div><span class="medal m${r.rank}">${r.rank}</span><img src="${AV(r.char)}"><b>${esc(r.name)}</b><small>카드 ${r.cards} · 정답 ${r.correct}/${r.attempts}</small><span class="p">${r.score}점</span></div>`).join('')}</div>`).join('')}</div></div>`).join('');
  }
  function saveXlsx(name, sheets) {
    if (window.XLSX) { const wb = XLSX.utils.book_new(); sheets.forEach(([n, rows, w]) => { const ws = XLSX.utils.aoa_to_sheet(rows); if (w) ws['!cols'] = w.map((x) => ({ wch: x })); XLSX.utils.book_append_sheet(wb, ws, n); }); XLSX.writeFile(wb, name + '.xlsx'); return; }
    const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const blob = new Blob(['﻿' + sheets[0][1].map((r) => r.map(csv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.csv'; a.click();
  }
  $('rXlsx').onclick = () => {
    if (!T.history.length) return toast('아직 저장할 결과가 없어요.');
    const rows = [['게임', '방', '순위', '이름', '점수', '모은 카드', '정답', '문제 수', '정답률(%)', '보너스 카드', '끝난 이유', '끝난 시각']];
    T.history.forEach((h) => h.ranking.forEach((r) => rows.push([h.gameNo, h.room, r.rank, r.name, r.score, r.cards, r.correct, r.attempts, r.attempts ? Math.round((r.correct / r.attempts) * 100) : 0, r.nobles.map((n) => NOBLES[n].ko).join(' '), h.reason === 'target' ? '목표 점수' : h.reason === 'time' ? '시간 종료' : '교사 종료', new Date(h.endedAt).toLocaleString('ko-KR')])));
    const agg = [['순위', '이름', '게임 수', '1등 횟수', '누적 점수', '모은 카드', '정답', '문제 수', '정답률(%)'], ...aggregate().map((a, i) => [i + 1, a.name, a.games, a.wins, a.score, a.cards, a.correct, a.attempts, a.attempts ? Math.round((a.correct / a.attempts) * 100) : 0])];
    saveXlsx(`K-Culture마스터_결과_${T.code}_${new Date().toISOString().slice(0, 10)}`, [['누적 순위', agg, [6, 10, 8, 8, 10, 10, 6, 8, 10]], ['게임별 결과', rows, [6, 18, 6, 10, 6, 8, 6, 8, 10, 16, 10, 22]]]);
  };
  $('rClear').onclick = () => confirmBox('지금까지의 결과 기록을<br>모두 지울까요?', () => cmd('clearHistory'));

  /* ===== 영어 문제 관리 ===== */
  let QL = [], qCat = 'all', qKinds = new Set(), qSel = new Set(), qCur = null, qPage = 1; const PER = 12;
  const KINDS = ['그림', '설명', '표현', '단어', '대화'];
  const KCOL = { 그림: '#ee7d14', 설명: '#1f63d8', 표현: '#1f8f43', 단어: '#7a3fd6', 대화: '#d83a78' };
  function loadQ() { socket.emit('t:questions', { op: 'list' }, (r) => { if (r.ok) { QL = r.list; if (!qCur || !QL.find((q) => q.id === qCur)) qCur = QL[0] && QL[0].id; renderQ(); } }); }
  function filtered() { const s = $('qSearch').value.trim().toLowerCase(); return QL.filter((q) => (qCat === 'all' || q.cat === qCat) && (!qKinds.size || qKinds.has(q.kind)) && (!s || (q.q + ' ' + q.choices.join(' ')).toLowerCase().includes(s))); }
  function renderQ() {
    $('qCatSel').innerHTML = `<option value="all">전체 (${QL.length}문제)</option>` + CATS.map((k) => `<option value="${k}" ${qCat === k ? 'selected' : ''}>${CAT_INFO[k].ko} (${QL.filter((q) => q.cat === k).length})</option>`).join('');
    $('qKinds').innerHTML = `<label><input type="checkbox" data-k="" ${!qKinds.size ? 'checked' : ''}> 전체</label>` + KINDS.map((k) => `<label><input type="checkbox" data-k="${k}" ${qKinds.has(k) ? 'checked' : ''}> ${k}</label>`).join('');
    const on = QL.filter((q) => q.on !== false);
    $('qStat').innerHTML = `<div style="background:#1f63d8">전체 문제<b>${QL.length}개</b></div><div style="background:#1f8f43">사용 중<b>${on.length}개</b></div><div style="background:#ee7d14">그림 문제<b>${QL.filter((q) => q.img).length}개</b></div><div style="background:#c81e1a">꺼 둔 문제<b>${QL.length - on.length}개</b></div>`;
    const list = filtered(); const pages = Math.max(1, Math.ceil(list.length / PER)); qPage = Math.min(qPage, pages);
    $('qCount').textContent = `(${list.length}개)`;
    $('qBody').innerHTML = list.slice((qPage - 1) * PER, qPage * PER).map((q, i) => `<tr class="${qCur === q.id ? 'sel' : ''}" data-q="${q.id}" style="cursor:pointer;${q.on === false ? 'opacity:.45' : ''}"><td><input type="checkbox" data-qs="${q.id}" ${qSel.has(q.id) ? 'checked' : ''}></td><td>${(qPage - 1) * PER + i + 1}</td><td><span class="kindTag" style="background:${KCOL[q.kind] || '#888'}">${esc(q.kind)}</span></td><td><span class="kindTag" style="background:var(--${q.cat})">${CAT_INFO[q.cat].ko}</span></td><td class="l">${esc(q.q.replace(/\n/g, ' '))}</td></tr>`).join('');
    $('qPager').innerHTML = `<button data-p="${Math.max(1, qPage - 1)}">‹</button>` + Array.from({ length: pages }, (_, i) => `<button data-p="${i + 1}" class="${qPage === i + 1 ? 'on' : ''}">${i + 1}</button>`).join('') + `<button data-p="${Math.min(pages, qPage + 1)}">›</button>`;
    $('qAll').checked = list.length && list.every((q) => qSel.has(q.id));
    renderEdit();
    const pics = QL.filter((q) => q.img && (qCat === 'all' || q.cat === qCat));
    $('qStrip').innerHTML = pics.map((q) => `<div data-q="${q.id}"><img src="img/n/ph/${q.img}.webp">${esc(q.choices[q.answer])}</div>`).join('') || '<p class="muted">그림 문제가 없어요.</p>';
    const mx = Math.max(1, ...KINDS.map((k) => QL.filter((q) => q.kind === k).length));
    $('qTypeStat').innerHTML = KINDS.map((k) => { const n = QL.filter((q) => q.kind === k).length; return `<div class="hbar"><span>${k}</span><span class="b"><i style="width:${(n / mx) * 100}%;background:${KCOL[k]}"></i></span>${n}개 (${QL.length ? Math.round((n / QL.length) * 100) : 0}%)</div>`; }).join('');
    const mc = Math.max(1, ...CATS.map((k) => QL.filter((q) => q.cat === k).length));
    $('qCatStat').innerHTML = CATS.map((k) => { const n = QL.filter((q) => q.cat === k).length; return `<div class="hbar"><span>${CAT_INFO[k].ko}</span><span class="b"><i style="width:${(n / mc) * 100}%;background:var(--${k})"></i></span>${n}개</div>`; }).join('');
  }
  function renderEdit() {
    const q = QL.find((x) => x.id === qCur) || { id: null, cat: qCat === 'all' ? 'food' : qCat, kind: '표현', q: '', ko: '', img: '', choices: ['', '', '', ''], answer: 0, exp: '', on: true };
    const idx = QL.indexOf(q);
    const ch = [0, 1, 2, 3].map((i) => q.choices[i] || '');
    $('qEdit').innerHTML = `<div style="display:flex;gap:6px;margin-bottom:8px"><span class="kindTag" style="background:#1f63d8;font-size:17px">${q.id ? `문제 ${idx + 1}` : '새 문제'}</span><span class="kindTag" style="background:${KCOL[q.kind] || '#888'};font-size:17px">${esc(q.kind)}</span><span class="kindTag" style="background:var(--${q.cat});font-size:17px">${CAT_INFO[q.cat].ko}</span></div>
      <div class="qd"><div class="qbox"><textarea id="eQ" placeholder="영어 문제를 입력하세요.">${esc(q.q)}</textarea><input class="search" id="eKo" placeholder="도움말 (한국어, 선택)" value="${esc(q.ko || '')}">
        <div class="img">${q.img ? `<img src="img/n/ph/${q.img}.webp" id="ePrev">` : '<p class="muted" id="ePrev">그림 없이 글로만 나와요.</p>'}</div></div>
        <div class="info"><h4>✅ 정답: ${q.answer + 1}번</h4>
          <label>자원 종류 <select id="eCat">${CATS.map((k) => `<option value="${k}" ${q.cat === k ? 'selected' : ''}>${CAT_INFO[k].ko}</option>`).join('')}</select></label>
          <label>유형 <select id="eKind">${KINDS.map((k) => `<option ${q.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          <label>그림 <select id="eImg"><option value="">없음</option>${Object.values(CARDS).map((c) => `<option value="${c.id}" ${q.img === c.id ? 'selected' : ''}>${c.ko}</option>`).join('')}</select></label>
          <label>사용 <input type="checkbox" id="eOn" ${q.on !== false ? 'checked' : ''} style="width:20px;height:20px"></label></div></div>
      <div class="chs" id="eChs">${ch.map((c, i) => `<label class="${q.answer === i ? 'ans' : ''}"><input type="radio" name="eAns" value="${i}" ${q.answer === i ? 'checked' : ''}><b>${i + 1}</b><input type="text" id="eC${i}" value="${esc(c)}" placeholder="보기 ${i + 1}"></label>`).join('')}</div>
      <input class="search" id="eExp" style="margin-top:8px" placeholder="해설 (한국어, 선택)" value="${esc(q.exp || '')}">
      <div class="rowb"><button class="tb blue sm" id="eSave">✏ 문제 저장</button><button class="tb purple sm" id="eImgBtn">🖼 이미지 변경</button><button class="tb red sm" id="eDel" ${q.id ? '' : 'disabled'}>🗑 문제 삭제</button></div>`;
    $('eChs').querySelectorAll('input[type=radio]').forEach((r) => (r.onchange = () => $('eChs').querySelectorAll('label').forEach((l, i) => l.classList.toggle('ans', i === +r.value))));
    $('eChs').querySelectorAll('label').forEach((l, i) => l.querySelector('b').onclick = () => { l.querySelector('input[type=radio]').checked = true; $('eChs').querySelectorAll('label').forEach((x, j) => x.classList.toggle('ans', j === i)); });
    $('eImg').onchange = () => { const v = $('eImg').value; $('ePrev').outerHTML = v ? `<img src="img/n/ph/${v}.webp" id="ePrev">` : '<p class="muted" id="ePrev">그림 없이 글로만 나와요.</p>'; };
    $('eImgBtn').onclick = () => $('eImg').focus();
    $('eSave').onclick = () => {
      const raw = [0, 1, 2, 3].map((i) => $('eC' + i).value.trim()); const ans = +document.querySelector('input[name=eAns]:checked').value;
      if (!raw[ans]) return toast('정답 보기를 입력해 주세요.');
      const choices = raw.filter(Boolean);
      qop({ op: 'save', q: { id: q.id || undefined, cat: $('eCat').value, kind: $('eKind').value, q: $('eQ').value, ko: $('eKo').value, img: $('eImg').value, exp: $('eExp').value, on: $('eOn').checked, choices, answer: choices.indexOf(raw[ans]) } }, (r) => { qCur = r.q.id; toast('문제를 저장했어요!'); });
    };
    $('eDel').onclick = () => confirmBox('이 문제를 삭제할까요?', () => qop({ op: 'delete', ids: [q.id] }, () => { qCur = null; toast('삭제했어요.'); }));
  }
  const qop = (m, cb) => socket.emit('t:questions', m, (r) => { if (r.err) toast(r.err); else { cb && cb(r); loadQ(); } });
  $('qCatSel').onchange = () => { qCat = $('qCatSel').value; qPage = 1; renderQ(); };
  $('qKinds').addEventListener('change', (e) => { const c = e.target.closest('[data-k]'); if (!c) return; if (!c.dataset.k) qKinds.clear(); else c.checked ? qKinds.add(c.dataset.k) : qKinds.delete(c.dataset.k); qPage = 1; renderQ(); });
  $('qSearch').oninput = () => { qPage = 1; renderQ(); };
  $('qPager').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) { qPage = +b.dataset.p; renderQ(); } });
  $('qBody').addEventListener('click', (e) => { const c = e.target.closest('[data-qs]'); if (c) { c.checked ? qSel.add(c.dataset.qs) : qSel.delete(c.dataset.qs); return; } const tr = e.target.closest('[data-q]'); if (tr) { qCur = tr.dataset.q; renderQ(); } });
  $('qStrip').addEventListener('click', (e) => { const d = e.target.closest('[data-q]'); if (d) { qCur = d.dataset.q; renderQ(); } });
  $('qAll').onchange = () => { filtered().forEach((q) => ($('qAll').checked ? qSel.add(q.id) : qSel.delete(q.id))); renderQ(); };
  $('qNew').onclick = () => { qCur = null; renderEdit(); $('eQ').focus(); };
  const step = (d) => { const l = filtered(); const i = l.findIndex((q) => q.id === qCur); const n = l[Math.max(0, Math.min(l.length - 1, i + d))]; if (n) { qCur = n.id; qPage = Math.floor(l.indexOf(n) / PER) + 1; renderQ(); } };
  $('qPrev').onclick = () => step(-1); $('qNext').onclick = () => step(1);
  $('qOn').onclick = () => qSel.size ? qop({ op: 'toggle', ids: [...qSel], on: true }, () => toast('선택한 문제를 켰어요.')) : toast('문제를 먼저 선택해 주세요.');
  $('qOff').onclick = () => qSel.size ? qop({ op: 'toggle', ids: [...qSel], on: false }, () => toast('선택한 문제를 껐어요.')) : toast('문제를 먼저 선택해 주세요.');
  $('qDel').onclick = () => qSel.size ? confirmBox(`선택한 ${qSel.size}문제를 삭제할까요?`, () => qop({ op: 'delete', ids: [...qSel] }, () => { qSel.clear(); toast('삭제했어요.'); })) : toast('문제를 먼저 선택해 주세요.');
  // 엑셀
  const HEAD = ['자원종류(음식/의복/놀이/공예/문화유산)', '유형(그림/설명/표현/단어/대화)', '문제', '도움말', '그림(카드id)', '보기1', '보기2', '보기3', '보기4', '정답번호(1-4)', '해설', '사용(O/X)'];
  const rowOf = (q) => [CAT_INFO[q.cat].ko, q.kind, q.q, q.ko || '', q.img || '', q.choices[0] || '', q.choices[1] || '', q.choices[2] || '', q.choices[3] || '', q.answer + 1, q.exp || '', q.on === false ? 'X' : 'O'];
  const W = [10, 8, 46, 20, 14, 18, 18, 18, 18, 8, 30, 6];
  $('qTpl').onclick = () => saveXlsx('K-Culture마스터_문제양식', [['문제', [HEAD, rowOf({ cat: 'food', kind: '그림', q: 'What is this?', ko: '이것은 무엇일까요?', img: 'bibimbap', choices: ['Bibimbap', 'Kimchi', 'Bulgogi', 'Songpyeon'], answer: 0, exp: '비빔밥이에요.' }), rowOf({ cat: 'play', kind: '표현', q: 'How about ______ yutnori?', ko: '', img: '', choices: ['playing', 'play', 'plays', 'to play'], answer: 0, exp: 'How about 뒤에는 -ing' })], W], ['카드id 목록', [['카드id', '이름', '종류'], ...Object.values(CARDS).map((c) => [c.id, c.ko + ' ' + c.name, CAT_INFO[c.cat].ko])], [16, 30, 10]]]);
  $('qExport').onclick = () => saveXlsx('K-Culture마스터_문제', [['문제', [HEAD, ...QL.map(rowOf)], W]]);
  const catMap = { 음식: 'food', 의복: 'clothing', 놀이: 'play', 공예: 'craft', 문화유산: 'heritage' };
  function setStep(n) { $('uSteps').querySelectorAll('span').forEach((s, i) => s.classList.toggle('on', i < n)); }
  async function readFile(f) {
    setStep(2);
    let rows;
    if (/\.csv$/i.test(f.name) || !window.XLSX) {
      const text = (await f.text()).replace(/^﻿/, ''); rows = []; let row = [], cell = '', q = false;
      for (let i = 0; i < text.length; i++) { const ch = text[i]; if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch; }
      if (cell || row.length) { row.push(cell); rows.push(row); }
    } else { const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); }
    rows = rows.filter((r) => r.some((c) => String(c).trim()));
    if (rows.length && /자원|cat/i.test(String(rows[0][0]))) rows.shift();
    const ok = [], bad = []; let dup = 0; const seen = new Set(QL.map((q) => q.q + '|' + q.choices.join('|')));
    rows.forEach((r, i) => {
      const s = (x) => String(x ?? '').trim();
      const cat = catMap[s(r[0])] || s(r[0]); const choices = [r[5], r[6], r[7], r[8]].map(s).filter(Boolean);
      const q = { cat, kind: s(r[1]) || '표현', q: s(r[2]), ko: s(r[3]), img: s(r[4]), choices, answer: (parseInt(r[9], 10) || 1) - 1, exp: s(r[10]), on: s(r[11]).toUpperCase() !== 'X' };
      if (!CATS.includes(cat) || !q.q || choices.length < 2 || q.answer >= choices.length) { bad.push(i + 2); return; }
      const key = q.q + '|' + choices.join('|'); if (seen.has(key)) { dup++; return; } seen.add(key); ok.push(q);
    });
    setStep(3);
    const show = (msg) => { setStep(4); $('uRes').innerHTML = `<div class="resRow"><div class="rbox ok">✅ 성공<b>${ok.length}개</b></div><div class="rbox bad">❌ 실패<b>${bad.length}개</b></div><div class="rbox dup">🔁 중복<b>${dup}개</b></div></div><p class="muted">${msg}${bad.length ? `<br>실패한 줄: ${bad.slice(0, 10).join(', ')}${bad.length > 10 ? ' …' : ''}` : ''}</p>`; };
    if (!ok.length) return show('불러올 새 문제가 없어요.');
    confirmBox(`${ok.length}개 문제를 읽었어요.<br>지금 문제에 더할까요?<br><small>(바꾸려면 취소 후 '기본 문제' 대신 전체 삭제를 써 주세요)</small>`, () => qop({ op: 'import', list: ok, replace: false }, (r) => show(`✅ 문제 업로드가 완료되었습니다. (총 ${r.count}문항)`)));
  }
  $('qFile').onchange = (e) => { const f = e.target.files[0]; if (f) readFile(f); e.target.value = ''; };
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) readFile(f); });

  /* ===== 실시간 모니터 (6방 한눈에) ===== */
  const PC = ['#d94148', '#2f7fd8', '#e09a1c', '#1f9f6a', '#8a55d8'];
  function phaseOf(r) {
    if (r.status === 'lobby') return '게임 시작 전';
    if (r.status === 'ended') return '게임 끝 · 결과 확인';
    if (r.paused || T.paused) return '교사 일시 정지';
    const g = r.game, t = g && g.turn; if (!t) return '-';
    if (t.q) return '영어 문제 풀이 중';
    if (t.done) return t.act === 'buy' ? '카드 구매 완료' : t.act === 'reserve' ? '카드 예약 완료' : '정답·보상 확인';
    if (t.lastQ && sNow() - t.lastQ.at < 6000) return '정답·보상 확인';
    return '자원 선택 · 행동 고르는 중';
  }
  function miniBoard(r, big) {
    const g = r.game;
    if (!g) return `<div class="mb ${big ? 'big' : ''}" style="display:flex;align-items:center;justify-content:center;color:#e9dcc0;font-size:${big ? 22 : 18}px">${r.players.length ? `👥 ${r.players.map((p) => esc(p.name)).join(' · ')}<br>게임 시작을 기다려요` : '빈 방'}</div>`;
    const t = g.turn; const ps = g.order.map((pid, i) => ({ pid, i, p: g.ps[pid] }));
    const side = (list) => list.map(({ pid, i, p }) => `<div class="mbP ${t && t.pid === pid ? 'turn' : ''}" style="--pc:${PC[i % 5]}">${esc(p.name)}<b>${p.score}</b><br>${TK.map((k) => (p.tokens[k] ? `<span style="color:${k === 'wild' ? '#b07d10' : `var(--${k})`}">●${p.tokens[k]}</span>` : '')).join(' ')}</div>`).join('');
    const mid = `<div class="mbM"><div class="mbBank">${TK.map((k) => tkI(k)).join('')}</div>${[1, 2, 3].map((tn) => `<div class="mbT">${(g.tiers[tn] || []).map((id) => (id ? `<img src="img/n/ph/${id}.webp" style="--cc:var(--${CARDS[id].cat})">` : '<span></span>')).join('')}</div>`).join('')}</div>`;
    let ov = '';
    if (r.status === 'ended') ov = `<div class="mbOv ok"><div class="t">게임 종료</div><div class="c">🏆 ${esc((g.ranking || [])[0] ? g.ranking[0].name : '')} 1등!</div></div>`;
    else if (t && t.q) ov = `<div class="mbOv"><div class="t">영어 문제 풀기 · ${esc(g.ps[t.pid].name)}</div><div class="c">${t.q.img ? `<img src="img/n/ph/${t.q.img}.webp">` : ''}<div class="q">${esc(t.q.text.split('\n')[0].slice(0, big ? 70 : 40))}${r.curQ ? `<i>정답: ${esc(r.curQ.choices[r.curQ.answer])}</i>` : ''}</div></div></div>`;
    else if (t && t.lastQ && sNow() - t.lastQ.at < 6000) ov = `<div class="mbOv ${t.lastQ.ok ? 'ok' : 'no'}"><div class="t">${t.lastQ.ok ? '정답이에요! Correct!' : '오답이에요!'}</div><div class="c">${t.lastQ.ok ? `획득 자원: ${Object.keys(t.lastQ.got || {}).map((k) => `${CAT_INFO[k].ko} ${t.lastQ.got[k]}`).join(' · ') || '없음'}` : `정답: ${esc(t.lastQ.choices[t.lastQ.answer])}`}</div></div>`;
    else if (t && t.done) ov = `<div class="mbOv"><div class="t">이번 차례의 행동 완료</div><div class="c">${t.act === 'buy' ? '카드를 샀어요' : t.act === 'reserve' ? '카드를 예약했어요' : '자원을 받았어요'} → 다음 학생 차례</div></div>`;
    else if (r.paused || T.paused) ov = '<div class="mbOv"><div class="t">게임 일시 정지</div><div class="c">⏸ 선생님이 멈췄어요</div></div>';
    return `<div class="mb ${big ? 'big' : ''}"><div class="mbS">${side(ps.filter((x) => x.i % 2 === 0))}</div>${mid}<div class="mbS">${side(ps.filter((x) => x.i % 2 === 1))}</div>${ov}</div>`;
  }
  function renderLive() {
    if (!selRoom || !roomById(selRoom)) selRoom = T.rooms[0] && T.rooms[0].id;
    $('lGrid').innerHTML = T.rooms.length ? T.rooms.map((r) => { const on = r.players.filter((p) => p.online).length;
      return `<div class="lr ${r.id === selRoom ? 'on' : ''}" data-room="${r.id}" style="--rc:${rColor(r)}"><div class="lrH">${r.name} &nbsp;${esc(r.title)}<span class="sc">${teamScore(r)}점</span></div>${miniBoard(r)}<div class="lrF"><span>${phaseOf(r)}</span><span class="cn ${on < r.players.length ? 'bad' : ''}">접속 ${on}/${r.players.length}</span></div></div>`; }).join('')
      : '<div class="pnl" style="grid-column:1/4"><div class="pb muted" style="font-size:20px;padding:30px;text-align:center">아직 방이 없어요. 위의 <b>학생 자동 배정</b>을 누르거나 학생들이 방을 만들 때까지 기다려요.<br>학생 입장 주소와 방 코드는 <b>QR 보기</b>에서 확인할 수 있어요.</div></div>';
    const r = roomById(selRoom);
    $('lSelHead').textContent = r ? `선택한 방 | ${r.name}` : '선택한 방';
    if (!r) $('lSel').innerHTML = '<p class="muted">방을 누르면 여기에 자세히 보여요.</p>';
    else {
      const g = r.game, t = g && g.turn; const cur = t && g.ps[t.pid];
      const sp = t ? g.ps[t.pid] : null; const disc = sp ? KC.catCounts(sp.cards) : null;
      const qLeft = t && t.q ? Math.max(0, Math.ceil((t.q.deadline - sNow()) / 1000)) : null;
      $('lSel').innerHTML = `<h3>${esc(r.title)}</h3><div class="now">현재 상황: ${phaseOf(r)}</div>${miniBoard(r, true)}
        <div class="kv">현재 차례 : ${cur ? esc(cur.name) : '-'} ${g ? `| ${g.round}라운드` : ''}</div>
        <div class="kv">${qLeft !== null ? `문제 제한 시간 : 00:${String(qLeft).padStart(2, '0')}` : g ? `남은 게임 시간 : ${mmss(g.endAt - sNow())}` : '게임 전'}</div>
        ${sp ? `<div class="kv">공개 정보 (${esc(sp.name)})<small>보유 자원 : ${CATS.map((k) => `${CAT_INFO[k].ko} ${sp.tokens[k]}`).join(' · ')} · 황금 ${sp.tokens.wild}</small><small>구매 카드 : ${sp.cards.length}장 / 예약 카드 : ${sp.reserved.length}장</small><small>영구 할인 : ${CATS.map((k) => `${CAT_INFO[k].ko} ${disc[k]}`).join(' · ')}</small></div>` : ''}
        <div class="ops"><button class="tb pink" data-lop="msg">💬 메시지</button><button class="tb sky" data-lop="ext" ${r.status === 'playing' ? '' : 'disabled'}>⏱ 시간 연장</button>
        ${r.status === 'lobby' ? '<button class="tb green" data-lop="start">▶ 이 방 시작</button>' : r.status === 'playing' ? `<button class="tb ${r.paused ? 'green' : 'orange'}" data-lop="pause">${r.paused ? '▶ 계속하기' : '⏸ 이 방 정지'}</button>` : '<button class="tb purple" data-lop="result">📊 결과 분석</button>'}
        <button class="tb red" data-lop="end" ${r.status === 'playing' ? '' : 'disabled'}>■ 방 종료</button></div>
        <button class="tb gray" data-lop="detail" style="background:linear-gradient(#f1dfb6,#d9bf86);color:#3a2a1a;margin-top:6px">방 상세 정보 보기</button>`;
    }
    const logs = T.rooms.flatMap((x) => (x.game ? x.game.log.map((l) => ({ ...l, r: x })) : [])).sort((a, b) => b.t - a.t).slice(0, 3);
    $('lFeed').innerHTML = logs.map((l) => `<div class="fd"><small>${new Date(l.t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} · ${l.r.name}</small>${esc(l.msg)}</div>`).join('') || '<p class="muted">게임이 시작되면 방마다 무슨 일이 일어나는지 여기에 보여요.</p>';
    const playing = T.rooms.filter((x) => x.status === 'playing');
    const offline = studs().filter((x) => !x.online && x.roomId).length;
    $('lCheck').innerHTML = `· 방 코드 <b>${T.code}</b> · 목표 ${T.settings.target}점 · 제한 ${T.settings.timeLimit}분<br>· 진행 중 ${playing.length}방 / 끝난 방 ${T.rooms.filter((x) => x.status === 'ended').length}방<br>· 접속 끊긴 학생 <b style="color:${offline ? '#c8322e' : '#1a8d52'}">${offline}명</b><br>· 학생별 구매 카드·자원·할인은 <b>방별 모니터링</b>에서 확인`;
  }
  $('lGrid').addEventListener('click', (e) => { const c = e.target.closest('[data-room]'); if (c) { selRoom = c.dataset.room; renderLive(); } });
  $('lSel').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lop]'); if (!b) return; const r = roomById(selRoom); if (!r) return; const op = b.dataset.lop;
    if (op === 'msg') openMsg(r);
    if (op === 'ext') openExtend(r);
    if (op === 'end') openEndRoom(r);
    if (op === 'start') cmd('startAll', { id: r.id }, () => toast(`${r.name} 게임을 시작했어요!`));
    if (op === 'pause') cmd('pauseRoom', { id: r.id, on: !r.paused });
    if (op === 'result') openResult(r.num);
    if (op === 'detail') go('monitor');
  });
  setInterval(() => { if (T && view === 'live') renderLive(); }, 1000);

  /* ===== 교사 메시지 ===== */
  const CHIPS = ['집중해요!', '시간이 거의 끝났어요.', '잘하고 있어요!', '다음 문제도 화이팅!', '자원을 잘 사용해요.', '친구 차례를 기다려 줘요.', '영어로 크게 읽어 봐요!'];
  let msgRoom = null;
  function openMsg(r) {
    msgRoom = r; $('msgWho').innerHTML = `<option value="">${r ? r.name + ' 전체' : '모든 학생'}</option>` + (r ? r.players : studs()).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    const upd = () => { const o = $('msgWho').selectedOptions[0]; $('msgTo').textContent = `${r ? r.name : '전체'} > ${o && o.value ? o.textContent : '모두'}`; };
    $('msgWho').onchange = upd; upd();
    $('msgChips').innerHTML = CHIPS.map((c) => `<button>${c}</button>`).join(''); $('msgText').value = '';
    $('pMsg').classList.add('on');
  }
  $('msgChips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const o = $('msgWho').selectedOptions[0]; $('msgText').value = (o && o.value ? o.textContent + ', ' : '') + b.textContent; $('msgChips').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); });
  $('msgSend').onclick = () => { const sid = $('msgWho').value; cmd('msg', { text: $('msgText').value, sid: sid || undefined, id: !sid && msgRoom ? msgRoom.id : undefined }, (r) => { toast(`메시지를 보냈어요. (${r.sent}명)`); $('pMsg').classList.remove('on'); }); };
  $('msgText').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('msgSend').click(); });

  /* ===== 시간 연장 ===== */
  let extRoom = null, extSec = 60;
  function openExtend(r) {
    extRoom = r; extSec = 60; $('extOpts').querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.s === 60));
    $('extMsg').textContent = r ? `${r.name}의 게임 시간을 연장합니다.` : '진행 중인 모든 방의 게임 시간을 연장합니다.';
    $('pExtend').classList.add('on');
  }
  $('extOpts').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; extSec = +b.dataset.s; $('extOpts').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); });
  $('extOk').onclick = () => cmd('extend', { sec: extSec, id: extRoom ? extRoom.id : undefined }, () => { toast(`게임 시간을 ${extSec >= 60 ? extSec / 60 + '분' : extSec + '초'} 늘렸어요.`); $('pExtend').classList.remove('on'); });

  /* ===== 방 종료 확인 ===== */
  function openEndRoom(r) { $('erMsg').textContent = `${r.name}의 게임을 종료하시겠습니까?`; $('erYes').onclick = () => cmd('endAll', { id: r.id }, () => { $('pEndRoom').classList.remove('on'); toast(`${r.name} 게임을 종료했어요.`); setTimeout(() => openResult(r.num), 400); }); $('pEndRoom').classList.add('on'); }

  /* ===== 게임 종료 결과 ===== */
  let resTab = 'score';
  function openResult(roomNum) {
    if (!T.history.length) return toast('아직 끝난 게임이 없어요.');
    $('rWhich').innerHTML = T.history.map((h, i) => `<option value="${i}">${h.gameNo}번째 게임 · ${esc(h.room)}</option>`).reverse().join('');
    let idx = T.history.length - 1; if (roomNum) { for (let i = T.history.length - 1; i >= 0; i--) if (T.history[i].roomNum === roomNum) { idx = i; break; } }
    $('rWhich').value = idx; renderResult(); $('pResult').classList.add('on');
  }
  function renderResult() {
    const h = T.history[+$('rWhich').value]; if (!h) return;
    $('rTabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.rt === resTab));
    const pct = (r) => (r.attempts ? Math.round((r.correct / r.attempts) * 100) : 0);
    if (resTab === 'score') $('rBody').innerHTML = `<table><tr><th>순위</th><th>이름</th><th>점수</th><th>영어 문제 정답률</th><th>구매한 카드</th><th>남은 자원</th><th>보너스</th></tr>${h.ranking.map((r) => `<tr><td><span class="medal m${r.rank}">${r.rank}</span></td><td>${esc(r.name)}</td><td><b>${r.score}</b></td><td>${pct(r)}% <small>(${r.correct}/${r.attempts})</small></td><td>${r.cards}장</td><td>${r.tokens ? TK.map((k) => `${tkI(k)}${r.tokens[k]}`).join(' ') : '-'}</td><td>${r.nobles.map((n) => NOBLES[n].name).join(', ') || '-'}</td></tr>`).join('')}</table><p class="muted">${h.reason === 'target' ? '목표 점수 달성으로 끝났어요.' : h.reason === 'time' ? '제한 시간이 끝나서 끝났어요.' : '선생님이 게임을 마쳤어요.'} · 게임 시간 ${Math.floor(h.durationSec / 60)}분 ${h.durationSec % 60}초 · 동점이면 카드가 적은 사람 → 정답이 많은 사람이 앞서요.</p>`;
    else if (resTab === 'quiz') { const qs = Object.values(h.qstats || {}).sort((a, b) => a.ok / a.n - b.ok / b.n);
      $('rBody').innerHTML = qs.length ? `<table><tr><th>문제</th><th>자원</th><th>푼 횟수</th><th>정답률</th></tr>${qs.map((q) => `<tr><td style="text-align:left">${q.img ? `<img class="cd" src="img/n/ph/${q.img}.webp" style="height:40px;vertical-align:middle"> ` : ''}${esc(q.text.split('\n')[0])}</td><td>${CAT_INFO[q.cat] ? CAT_INFO[q.cat].ko : ''}</td><td>${q.n}</td><td><span class="bar" style="width:${Math.max(4, (q.ok / q.n) * 120)}px;background:${q.ok / q.n < 0.5 ? '#e2434b' : '#1fa067'}"></span> ${Math.round((q.ok / q.n) * 100)}%</td></tr>`).join('')}</table><p class="muted">정답률이 낮은 문제가 위에 있어요. 수업 마무리 때 함께 다시 풀어 보세요.</p>` : '<p class="muted">이 게임에서 푼 문제가 없어요.</p>'; }
    else $('rBody').innerHTML = `<table><tr><th>이름</th><th>구매한 카드</th></tr>${h.ranking.map((r) => `<tr><td>${esc(r.name)}<br><small>${r.cards}장</small></td><td style="text-align:left">${(r.cardList || []).map((id) => `<img class="cd" src="img/n/card/${id}.webp" title="${esc(CARDS[id].name)}">`).join('') || '-'}${r.nobles.map((n) => `<img class="cd" src="img/n/bonus/${n}.webp">`).join('')}</td></tr>`).join('')}</table>`;
  }
  $('rTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-rt]'); if (b) { resTab = b.dataset.rt; renderResult(); } });
  $('rWhich').onchange = renderResult;
  $('rOpen').onclick = () => openResult(null);
})();
