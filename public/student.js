/* K-Culture 마스터 — 학생 화면 (2026-10-31 통합 그래픽) */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const { CATS, CAT_INFO, CARDS, NOBLES, QUIZ, CHARS, CHAR_KO, TIERS } = KC;
  const TK = [...CATS, 'wild'];
  const AV = (c) => `img/v2/ch_${CHARS.includes(c) ? c : 'jiho'}.webp`;
  const AVN = (c) => `img/v2/chn_${CHARS.includes(c) ? c : 'jiho'}.webp`;
  const PH = (id) => `img/n/ph/${id}.webp`;
  const CARDIMG = (id) => `img/n/card/${id}.webp`;
  const BTN = (k, s) => `img/n/btn/${k}_${s}.webp`;
  const tk = (k, cls = '') => `<i class="tk ${k} ${cls}">${CAT_INFO[k].s}</i>`;
  const dots = (cost, have) => `<div class="cost">${Object.keys(cost).filter((k) => cost[k]).map((k) => `<span class="${have && (have[k] || 0) < cost[k] ? 'short' : ''}"><i class="dot ${k}"></i>${cost[k]}</span>`).join('')}</div>`;
  const shortName = (c) => c.name.replace(/\s*\(.*\)/, '');
  const stage = $('stage');

  /* ---------- 화면 맞추기 ---------- */
  function fit() {
    const w = window.innerWidth, h = window.innerHeight;
    const port = h > w * 1.05;
    stage.className = port ? 'port' : 'land';
    const W = port ? 900 : 1600, H = port ? 1600 : 900;
    const s = Math.min(w / W, h / H);
    stage.style.transformOrigin = 'center center';
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  window.addEventListener('resize', fit); fit();

  /* ---------- 세션 ---------- */
  const SESS_KEY = 'kc_session3';
  let sess = (() => { try { return JSON.parse(localStorage.getItem(SESS_KEY) || 'null'); } catch { return null; } })();
  const saveSess = () => { try { localStorage.setItem(SESS_KEY, JSON.stringify(sess)); } catch {} };
  const urlCode = new URLSearchParams(location.search).get('code');
  if (urlCode) $('inCode').value = urlCode.slice(0, 4);
  else if (sess && sess.code) $('inCode').value = sess.code;
  if (sess && sess.name) $('inName').value = sess.name;

  let S = null, joined = false, local = 'title', offset = 0, selChar = 'jiho', choosing = false;
  let prevRoomId = null, prevPaused = false, pauseHidden = false;
  const socket = io({ transports: ['websocket', 'polling'] });

  $('titleCards').innerHTML = ['songpyeon', 'hanbok', 'yutnori', 'celadon', 'gyeongbokgung'].map((id) => `<img src="${CARDIMG(id)}" alt="${CARDS[id].name}">`).join('');

  function show(id) { document.querySelectorAll('.scr').forEach((e) => e.classList.toggle('on', e.id === id)); }
  function toast(msg, kind = '', ms = 2200) { const t = $('toast'); t.textContent = msg; t.className = 'bubble on ' + kind; clearTimeout(t._h); t._h = setTimeout(() => (t.className = 'bubble'), ms); }
  const openL = (id) => $(id).classList.add('on');
  const closeL = (id) => $(id).classList.remove('on');
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]'); if (go) { SND.play('click'); nav(go.dataset.go); }
    const op = e.target.closest('[data-open]');
    if (op) { SND.play('click'); const k = op.dataset.open; if (k === 'rules') openL('mRules'); else if (k === 'gear') { gearUI(); openL('mGear'); } else { closeL('mGear'); renderBook(); openL('mBook'); } }
    const cl = e.target.closest('[data-close]'); if (cl) { SND.play('click'); const l = cl.closest('.layer'); l.classList.remove('on'); if (l.id === 'mCard') cardOpen = null; if (l.id === 'mPlayer') plOpen = null; }
  });
  // 그림 버튼: 누르는 동안 '눌림', 올리면 '선택' 그림
  document.addEventListener('pointerdown', (e) => { const b = e.target.closest('.ib'); if (!b || b.disabled) return; const img = b.querySelector('img'); const m = img && img.getAttribute('src').match(/^(img\/n\/btn\/\w+)_n\.webp$/); if (m) { img.dataset.n = img.getAttribute('src'); img.src = m[1] + '_p.webp'; } });
  document.addEventListener('pointerup', () => document.querySelectorAll('img[data-n]').forEach((i) => { i.src = i.dataset.n; delete i.dataset.n; }));
  function nav(where) {
    if (where === 'join' && joined && S) { local = 'app'; render(); return; }
    local = where; show({ title: 'sTitle', join: 'sJoin', select: 'sSelect' }[where] || 'sTitle');
    if (where === 'join') setTimeout(() => (!$('inName').value ? $('inName') : $('inCode')).focus(), 50);
  }

  /* ---------- 입장 ---------- */
  function doJoin(code, name, silent) {
    return new Promise((res) => {
      const token = (sess && sess.token) || Math.random().toString(36).slice(2) + Date.now().toString(36);
      socket.emit('s:join', { code, name, token }, (r) => {
        if (!r || r.err) { if (!silent) { $('joinMsg').textContent = (r && r.err) || '접속할 수 없어요.'; SND.play('error'); } return res(false); }
        joined = true; sess = { code, name, token: r.token, char: r.char }; saveSess();
        if (r.char && CHARS.includes(r.char)) selChar = r.char;
        if (!silent) SND.play('join');
        res(r);
      });
    });
  }
  $('btnJoin').onclick = async () => {
    SND.play('press');
    const name = $('inName').value.trim(), code = $('inCode').value.trim();
    if (!name) { $('joinMsg').textContent = '이름을 입력해 주세요.'; return $('inName').focus(); }
    if (!/^\d{4}$/.test(code)) { $('joinMsg').textContent = '방 코드 4자리를 입력해 주세요.'; return $('inCode').focus(); }
    $('joinMsg').textContent = '';
    const r = await doJoin(code, name);
    if (!r) return;
    if (!r.char || !CHARS.includes(r.char)) { choosing = true; openSelect(); return; }
    local = 'app'; render();
  };
  ['inName', 'inCode'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (id === 'inName') $('inCode').focus(); else $('btnJoin').click(); } }));
  $('inCode').addEventListener('input', () => { $('inCode').value = $('inCode').value.replace(/\D/g, '').slice(0, 4); });

  $('selRow').innerHTML = CHARS.map((c) => `<button data-c="${c}"><img src="${AVN(c)}" alt="${CHAR_KO[c]}"></button>`).join('');
  function markChar() { $('selRow').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.c === selChar)); }
  function openSelect() { local = 'select'; show('sSelect'); markChar(); $('selBack').style.display = S && S.me && CHARS.includes(S.me.char) ? '' : 'none'; }
  $('selRow').addEventListener('click', (e) => { const b = e.target.closest('button[data-c]'); if (b) { selChar = b.dataset.c; SND.play('pick'); markChar(); } });
  $('btnSelect').onclick = () => {
    SND.play('press'); if (!joined) return nav('join');
    socket.emit('s:char', { char: selChar }, () => { sess.char = selChar; saveSess(); if (S) S.me.char = selChar; choosing = false; local = 'app'; render(); });
  };
  $('selBack').onclick = () => { SND.play('click'); choosing = false; local = 'app'; render(); };
  $('btnChar').onclick = () => { SND.play('click'); choosing = true; selChar = (S && S.me.char) || selChar; openSelect(); };

  socket.on('connect', async () => {
    $('offline').classList.remove('on');
    if (sess && sess.code && sess.name && (joined || local === 'app')) {
      const r = await doJoin(sess.code, sess.name, true);
      if (!r) { joined = false; local = 'join'; nav('join'); }
    }
  });
  socket.on('disconnect', () => { if (joined) { $('offline').classList.add('on'); SND.play('offline'); } });
  socket.on('kicked', (m) => { joined = false; toast(m, '', 4000); local = 'title'; nav('title'); });
  socket.on('state', (st) => {
    S = st; offset = st.now - Date.now();
    const rid = st.room ? st.room.id : null;
    if (rid && rid !== prevRoomId && st.room.by === 'teacher' && st.room.status === 'lobby') SND.play('assigned');
    prevRoomId = rid;
    if (st.paused !== prevPaused) { pauseHidden = false; if (st.game && st.room && st.room.status === 'playing') SND.play(st.paused ? 'pause' : 'resume'); prevPaused = st.paused; }
    render();
  });
  socket.on('fx', onFx);
  socket.on('tmsg', (m) => { $('tmsgText').textContent = m.text; const t = $('tmsg'); t.classList.add('on'); SND.play('notice'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 6000); });
  $('tmsg').onclick = () => $('tmsg').classList.remove('on');

  const sNow = () => Date.now() + offset;
  const mmss = (ms) => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const totTok = (p) => Object.values(p.tokens).reduce((a, b) => a + b, 0);

  function render() {
    $('pause').classList.toggle('on', !!(S && S.paused && joined && local === 'app' && !pauseHidden));
    if (!joined || !S || local !== 'app') return;
    if (choosing || !CHARS.includes(S.me.char)) { choosing = true; openSelect(); return; }
    const room = S.room, g = S.game;
    if (room && g && room.status === 'playing') { show('sGame'); renderGame(); }
    else if (room && g && room.status === 'ended') { show('sEnd'); renderEnd(); closeAll(); }
    else { show('sLobby'); renderLobby(); closeAll(); }
  }
  function closeAll() { ['mTake', 'mCard', 'mQ', 'mPlayer', 'mDone'].forEach(closeL); plOpen = null; cardOpen = null; setMode(null); }
  $('pauseOk').onclick = () => { pauseHidden = true; render(); };

  /* ---------- 대기실 ---------- */
  let createOpen = false, createMax = 5;
  function renderLobby() {
    const me = S.me, room = S.room, set = S.settings;
    $('lbAv').src = AV(me.char); $('lbName').textContent = me.name; $('lbCode').textContent = S.code;
    let h = '';
    if (room) {
      $('lbTitle').textContent = `${room.name} · ${room.title}`;
      $('lbSub').textContent = `${room.players.length} / ${room.max || 5}명 · ${room.by === 'student' ? '친구가 만든 방' : '선생님이 배정한 방'}`;
      $('lbHead').textContent = room.by === 'student' ? '친구가 만든 방이에요' : '선생님이 배정한 방이에요';
      const max = Math.min(room.max || 5, Math.max(set.teamSize, room.players.length));
      h += `<div class="team">${room.players.map((p) => `<div class="mem ${p.online ? '' : 'off'} ${p.id === me.id ? 'me' : ''}">${room.hostId === p.id ? '<span class="host">방장</span>' : ''}<img src="${AV(p.char)}"><b>${esc(p.name)}</b></div>`).join('')}
        ${Array.from({ length: Math.max(0, (room.by === 'student' ? room.max : max) - room.players.length) }, () => '<div class="mem empty">빈 자리</div>').join('')}</div>`;
      const canStart = set.hostStart && room.hostId === me.id;
      h += `<p style="text-align:center;font-size:23px;margin:14px 0 4px">${canStart ? (room.players.length >= 2 ? '친구들이 다 모이면 게임 시작을 눌러요!' : '친구가 더 들어오면 시작할 수 있어요.') : '선생님이나 방장이 시작하면 게임이 열려요!'}</p>`;
      h += `<div class="rowc">${set.allowRooms ? '<button class="nbtn gray" id="lbLeave">방 나가기</button>' : ''}${canStart ? `<button class="ib" id="lbStart" ${room.players.length < 2 ? 'disabled' : ''}><img src="${BTN('start', room.players.length < 2 ? 'd' : 'n')}" alt="게임 시작"></button>` : ''}</div>`;
    } else {
      $('lbTitle').textContent = '대기 중입니다';
      $('lbSub').textContent = '선생님의 팀 배정을 기다려요';
      $('lbHead').textContent = '팀 배정을 기다려요';
      h += `<div class="waitBox"><img src="img/n/ui/reconnect.webp" alt=""><p>선생님이 팀을 배정하고 있어요.<small>또는 친구들과 직접 방을 만들어 들어갈 수 있어요.</small></p>
        ${set.allowRooms ? `<button class="ib" id="lbCreate"><img src="${BTN('create', 'n')}" alt="방 만들기"></button>` : ''}</div>`;
      if (set.allowRooms && createOpen) {
        h += `<div class="createBox">
          <label class="fld">방 이름을 입력하세요.<input id="crName" maxlength="12" placeholder="예) 6-1 문화탐험대"></label>
          <div class="gRow"><span>최대 인원</span><button class="nbtn sm ${createMax === 4 ? 'blue' : 'gray'}" data-max="4">4명</button><button class="nbtn sm ${createMax === 5 ? 'blue' : 'gray'}" data-max="5">5명</button></div>
          <div class="rowc"><button class="ib" id="crCancel"><img src="${BTN('cancel', 'n')}" alt="취소"></button><button class="ib" id="crOk"><img src="${BTN('create', 'n')}" alt="방 만들기"></button></div></div>`;
      }
      if (set.allowRooms && S.rooms.length) {
        h += `<div class="rooms">${S.rooms.map((r) => { const full = r.players.length >= (r.max || 5); return `<div class="rcard"><h4>${esc(r.name)} · ${esc(r.title)}</h4><div class="avs">${r.players.map((p) => `<img src="${AV(p.char)}" title="${esc(p.name)}">`).join('')}</div><div class="n">${r.players.length} / ${r.max || 5}명</div><button class="ib" data-joinroom="${r.id}" ${full ? 'disabled' : ''}><img src="${BTN('join', full ? 'd' : 'n')}" alt="방 참가하기"></button></div>`; }).join('')}</div>`;
      }
    }
    const keep = $('crName') ? $('crName').value : '';
    $('lbMain').innerHTML = h;
    if ($('crName')) $('crName').value = keep;
    const b = (id, f) => { const e = $(id); if (e) e.onclick = f; };
    b('lbCreate', () => { SND.play('click'); createOpen = true; renderLobby(); setTimeout(() => $('crName') && $('crName').focus(), 30); });
    b('crCancel', () => { createOpen = false; renderLobby(); });
    b('crOk', () => { createOpen = false; roomOp({ op: 'create', title: $('crName').value, max: createMax }); });
    $('lbMain').querySelectorAll('[data-max]').forEach((e) => (e.onclick = () => { createMax = +e.dataset.max; renderLobby(); }));
    b('lbLeave', () => roomOp({ op: 'leave' }));
    b('lbStart', () => roomOp({ op: 'start' }));
    $('lbMain').querySelectorAll('[data-joinroom]').forEach((e) => (e.onclick = () => roomOp({ op: 'join', id: e.dataset.joinroom })));
    if (!pracQ) nextPrac();
  }
  function roomOp(m) { SND.play('click'); socket.emit('s:room', m, (r) => { if (r && r.err) { toast(r.err); SND.play('error'); } }); }

  /* 대기실 연습 문제 */
  let pracQ = null, pracOk = 0, pracN = 0, pracDone = false, pracBag = [];
  function nextPrac() {
    if (!pracBag.length) pracBag = QUIZ.map((_, i) => i).sort(() => Math.random() - 0.5);
    pracQ = QUIZ[pracBag.pop()]; pracDone = false;
    $('pracImg').src = PH(pracQ[0]);
    $('pracCh').innerHTML = pracQ[1].map((c, i) => `<button data-i="${i}">${'ABCD'[i]}. ${esc(c)}</button>`).join('');
    $('pracMsg').textContent = '사진을 보고 알맞은 이름을 골라요.'; $('pracMsg').style.color = '#6b5236';
  }
  $('pracCh').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]'); if (!b || pracDone) return;
    pracDone = true; pracN++;
    const i = +b.dataset.i, ok = i === pracQ[2]; if (ok) pracOk++;
    $('pracCh').querySelectorAll('button').forEach((x, j) => { x.classList.toggle('right', j === pracQ[2]); x.classList.toggle('wrong', j === i && !ok); });
    const c = CARDS[pracQ[0]];
    $('pracMsg').textContent = ok ? `정답! ${c.name} = ${c.ko}` : `아쉬워요! 정답은 ${c.name}`; $('pracMsg').style.color = ok ? '#1a8d52' : '#c8322e';
    $('pracScore').textContent = `${pracOk} / ${pracN}`;
    SND.play(ok ? 'correct' : 'wrong'); SND.speak(shortName(c));
  });
  $('pracNext').onclick = () => { SND.play('click'); nextPrac(); };

  /* ---------- 게임 ---------- */
  let lastGameStart = 0, lastTurnSeq = -1, qKey = null, resultUntil = 0, cardOpen = null, cardMode = null, plOpen = null, mode = null, qSel = -1, doneShownSeq = -1;
  const SLOT_ORDER = ['opp0', 'opp2', 'opp1', 'opp3'];
  const nameOf = (g, pid) => (g.ps[pid] ? g.ps[pid].name : '?');
  // 빠른 진행: 자원·예약 뒤에도 같은 차례에 카드 1장을 살 수 있어요
  const buyOpen = (t) => !!(t && !t.q && !t.bought && (!t.done || (S.settings && S.settings.fast)) && !S.paused);
  const canAfford = (g, my) => [...(g.market || []), ...my.reserved].some((id) => KC.payPlan(id, my.cards, my.tokens));
  function phase(g) {
    const t = g.turn; if (!t) return '';
    if (t.q) return '영어 문제 풀이 중';
    if (t.done) return t.act === 'buy' ? '카드 구매 완료' : t.act === 'reserve' ? '카드 예약 완료' : '정답·보상 확인';
    return '행동 고르는 중';
  }

  function renderGame() {
    const g = S.game, me = S.me.id, my = g.ps[me];
    if (!my) return;
    const t = g.turn, myTurn = !!(t && t.pid === me);
    if (g.startAt !== lastGameStart) { lastGameStart = g.startAt; lastTurnSeq = -1; openL('mRules'); clearTimeout(window._rt); window._rt = setTimeout(() => closeL('mRules'), 9000); }
    if (t && g.seq !== lastTurnSeq) {
      const first = lastTurnSeq === -1; lastTurnSeq = g.seq;
      const who = g.ps[t.pid];
      if (!first) fxShow(`<div class="turnBan"><img src="${AV(who.char)}">${myTurn ? '<em>내</em> 차례입니다!' : `<em>${esc(who.name)}</em> 학생의 차례입니다!`}</div>`, 1500);
      if (myTurn) SND.play('turn');
      closeL('mTake'); closeL('mDone'); setMode(null);
      if (cardOpen) { closeL('mCard'); cardOpen = null; }
    }
    $('gMarketSub').textContent = `1·2·3단계 각 4장 | ${g.target}점 달성 시 마지막 라운드`;
    $('gTurnWho').textContent = t ? `현재 차례 ${myTurn ? '나' : nameOf(g, t.pid)}` : '-';
    $('gTurnSub').textContent = `목표 ${g.target}점 · ${g.round}라운드${g.finalRound ? ' · 마지막!' : ''}`;
    const mt = $('gMyTurn');
    if (t) {
      const who = g.ps[t.pid];
      mt.classList.toggle('myturn', myTurn && (!t.done || (buyOpen(t) && canAfford(g, my))));
      mt.innerHTML = `<img src="${AV(who.char)}" alt=""><div>${myTurn ? (t.q ? '<em>영어 문제를 풀어요!</em>' : t.done ? (buyOpen(t) && canAfford(g, my) ? '<em>카드 1장 더 살 수 있어요!</em><br>사거나 턴 종료하기' : '<em>행동 완료!</em><br>턴 종료하기를 눌러요') : '<em>내 차례예요!</em><br>행동 1가지를 골라요') : `<b>${esc(who.name)}</b> 학생 차례<br><small>${phase(g)}</small>`}</div>`;
    }
    // 보너스 카드
    $('gNobles').innerHTML = Object.keys(NOBLES).map((nid) => {
      const nb = NOBLES[nid], own = g.nobles[nid], ok = !own && KC.nobleOk(nid, my.cards);
      return `<div class="nob ${own ? 'got' : ''} ${ok ? 'ok' : ''}" data-nob="${nid}"><img class="p" src="img/n/bph/${nid}.webp" alt="${nb.name}"><div class="nr"><span class="n">${nb.name}</span><span class="pt">+${nb.pts}점</span><span class="r">${Object.keys(nb.need).map((k) => `<span><i class="dot ${k}"></i>${nb.need[k]}</span>`).join('')}</span></div>${own ? `<img class="own" src="${AV(g.ps[own] && g.ps[own].char)}" title="${esc(nameOf(g, own))}">` : ''}</div>`;
    }).join('');
    // 공동 자원
    const canAct = myTurn && !t.done && !t.q && !S.paused;
    const canBuyT = myTurn && buyOpen(t);
    $('gBank').innerHTML = `<span class="lb">공동 자원</span>` + CATS.map((k) => `<div class="coin ${canAct && g.bank[k] > 0 ? 'can' : ''} ${g.bank[k] <= 0 ? 'empty' : ''}" data-k="${k}">${tk(k)}<span>${CAT_INFO[k].ko} <b>${g.bank[k]}</b>개</span></div>`).join('') + `<div class="coin gold">황금 <b>${g.bank.wild}</b>개</div>`;
    // 카드 시장
    $('gTiers').innerHTML = [1, 2, 3].map((tn) => `<div class="tier t${tn}"><div class="tierHead"><b>${TIERS[tn].ko}</b><span>${TIERS[tn].sub}</span><small>남은 ${g.deckCounts ? g.deckCounts[tn] : 0}장</small></div><div class="tierGrid">${(g.tiers ? g.tiers[tn] : []).map((id) => (id ? marketCard(id, canBuyT && KC.payPlan(id, my.cards, my.tokens)) : '<div class="slotE">카드 없음</div>')).join('')}</div></div>`).join('');
    $('gTiers').classList.toggle('mode-buy', mode === 'buy'); $('gTiers').classList.toggle('mode-reserve', mode === 'reserve');
    // 친구 공개 정보
    const others = []; const mi = g.order.indexOf(me);
    for (let k = 1; k < g.order.length; k++) others.push(g.order[(mi + k) % g.order.length]);
    SLOT_ORDER.forEach((sid, i) => { const el = $(sid); const pid = others[i]; if (!pid) { el.className = 'opp'; el.innerHTML = ''; delete el.dataset.pid; return; } renderOpp(el, pid, g); });
    renderMine(g, my, me, canBuyT);
    $('gLog').innerHTML = '<h5>📢 최근 소식</h5>' + (g.log || []).slice(-4).reverse().map((l) => `<p class="${l.type}">${esc(l.msg)}</p>`).join('');
    setAct('btnTake', canAct && CATS.some((k) => g.bank[k] > 0));
    setAct('btnBuyMode', canBuyT);
    setAct('btnResMode', canAct && my.reserved.length < 3);
    setAct('btnEnd', myTurn && !t.q);
    $('actTip').textContent = myTurn ? (t.done ? (canBuyT ? '카드 1장을 더 살 수 있어요. 다 했으면 턴 종료하기!' : '행동을 마쳤어요. 턴 종료하기를 누르면 다음 학생 차례!') : S.settings.fast ? '자원 가져오기 또는 카드 예약 + 카드 1장 구매' : '한 차례에 한 가지 행동: 자원 가져오기 · 카드 구매 · 카드 예약') : '내 차례가 오면 버튼이 밝아져요.';
    renderQuestion();
    if (cardOpen) renderCardDetail(cardOpen);
    if (plOpen) renderPlayer(plOpen);
    if (!myTurn || !t.done) closeL('mDone');
    tick();
  }
  function marketCard(id, can) {
    const c = CARDS[id];
    return `<div class="mc ${c.cat} ${can ? 'can' : ''}" data-card="${id}"><div class="nm">${esc(c.name)}</div><img class="ph" src="${PH(id)}" alt="" draggable="false"><div class="info"><div class="pt"><b>${c.pts}점</b><span>할인 +1<br>${CAT_INFO[c.cat].ko}</span></div><span class="lbl2">구매 비용</span>${dots(c.cost)}</div><div class="ft"><span>${c.no}</span><em>${can ? '구매 가능' : '카드 정보'}</em></div></div>`;
  }
  const ABK = { btnTake: 'take', btnBuyMode: 'buy', btnResMode: 'reserve', btnEnd: 'end' };
  function setAct(id, on) {
    const b = $(id); const k = ABK[id];
    const st = !on ? 'd' : mode === k ? 'h' : 'n';
    const img = b.querySelector('img'); if (img.dataset.n) return;
    const src = BTN(k, st);
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    b.disabled = !on; b.classList.toggle('on', on && mode === k);
  }
  function thumbs(cards, max) {
    const list = cards.slice(-max);
    return list.map((id) => `<img src="${PH(id)}" title="${esc(CARDS[id].name)}" style="border-color:var(--${CARDS[id].cat})">`).join('') + (cards.length > max ? `<span class="more">+${cards.length - max}</span>` : '');
  }
  function renderOpp(el, pid, g) {
    const p = g.ps[pid], seat = g.order.indexOf(pid), t = g.turn; const disc = KC.catCounts(p.cards);
    el.className = `opp on c${seat % 5} ${t && t.pid === pid ? 'turn' : ''} ${p.online ? '' : 'off'}`;
    el.dataset.pid = pid;
    const port = stage.classList.contains('port');
    el.innerHTML = `<div class="oHead"><img src="${AV(p.char)}" alt=""><span>${esc(p.name)} · 공개 정보</span><span class="sc">${p.score}점</span></div>
      <div class="oBody"><div class="lb"><span>보유 토큰 (${totTok(p)}/10)</span><span>${p.online ? '' : '접속 끊김'}</span></div>
      <div class="oToks">${TK.map((k) => `<div class="t">${tk(k, 'sm')}${p.tokens[k]}</div>`).join('')}</div>
      <div class="lb"><span>영구 할인</span></div><div class="oDisc">${CATS.map((k) => `<i style="background:${disc[k] ? `var(--${k})` : '#c9b99a'}">${disc[k]}</i>`).join('')}<i style="background:transparent"></i></div>
      <div class="lb"><span>구매 카드 ${p.cards.length}장</span><span>예약 ${p.reserved.length}장</span></div>
      <div class="oCards">${thumbs(p.cards, port ? 6 : 4)}${p.reserved.map((id) => `<img class="rs" src="${PH(id)}" title="예약: ${esc(CARDS[id].name)}">`).join('')}</div></div>`;
  }
  function renderMine(g, my, me, canAct) {
    const t = g.turn, disc = KC.catCounts(my.cards); const myTurn = t && t.pid === me;
    $('mMe').innerHTML = `<div class="who"><img src="${AV(my.char)}" alt="">${esc(my.name)} (나)${myTurn ? ' | 내 차례' : ''}</div><div class="sc">현재 <b>${my.score}</b>점</div>
      <div class="lb">내 보유 토큰 (${totTok(my)}/10)</div><div class="toks">${TK.map((k) => `<div class="t">${tk(k, 'sm')}${my.tokens[k]}</div>`).join('')}</div>
      <div class="ft">황금 ${my.tokens.wild}개 · 예약 ${my.reserved.length}/3장 · 힌트 ${my.hints}</div>`;
    const by = {}; my.cards.forEach((id) => (by[CARDS[id].cat] = by[CARDS[id].cat] || []).push(id));
    $('mCards').innerHTML = CATS.filter((k) => by[k]).map((k) => `<div class="stk ${k}" data-card="${by[k][by[k].length - 1]}"><img src="${PH(by[k][by[k].length - 1])}" alt=""><span>${CAT_INFO[k].ko} +${by[k].length}</span>${by[k].length > 1 ? `<b>×${by[k].length}</b>` : ''}</div>`).join('') || '<span class="none">자원을 모아 카드를 사 보세요!</span>';
    $('mDisc').textContent = '영구 할인: ' + CATS.map((k) => `${CAT_INFO[k].ko} ${disc[k]}`).join(' · ');
    $('mRsv').innerHTML = my.reserved.map((id) => `<div class="rsvC ${canAct && KC.payPlan(id, my.cards, my.tokens) ? 'can' : ''}" data-card="${id}"><img src="${PH(id)}" alt=""><span>${esc(shortName(CARDS[id]))}</span></div>`).join('') + Array.from({ length: 3 - my.reserved.length }, () => '<div class="rsvE">예약 가능</div>').join('');
  }

  function setMode(m) {
    mode = m; const tip = $('modeTip');
    if (m === 'buy') { tip.textContent = '🛒 살 카드를 눌러요! (초록 테두리 = 지금 살 수 있어요)'; tip.classList.add('on'); }
    else if (m === 'reserve') { tip.textContent = '📌 예약할 카드를 눌러요! (예약하면 황금 1개)'; tip.classList.add('on'); }
    else tip.classList.remove('on');
    if (S && S.game && $('sGame').classList.contains('on')) { $('gTiers').classList.toggle('mode-buy', m === 'buy'); $('gTiers').classList.toggle('mode-reserve', m === 'reserve'); ['btnTake', 'btnBuyMode', 'btnResMode', 'btnEnd'].forEach((id) => setAct(id, !$(id).disabled)); }
  }

  /* 자원 가져오기 */
  let takeMode = 'diff', takeSel = {}, takeRet = {};
  $('gBank').addEventListener('click', (e) => { const b = e.target.closest('.coin.can'); if (b) openTake(b.dataset.k); });
  function openTake(pre) {
    takeSel = {}; takeRet = {}; takeMode = 'diff'; setMode(null);
    if (pre) takeSel[pre] = 1;
    renderTake(); openL('mTake'); SND.play('pick');
  }
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  function renderTake() {
    const g = S.game; const my = g.ps[S.me.id]; const held = totTok(my);
    $('tkModeA').classList.toggle('on', takeMode === 'diff'); $('tkModeB').classList.toggle('on', takeMode === 'same');
    $('takeList').innerHTML = CATS.map((k) => {
      const dis = takeMode === 'same' ? g.bank[k] < 4 : g.bank[k] <= 0;
      return `<button data-k="${k}" class="${takeSel[k] ? 'on' : ''}" ${dis ? 'disabled' : ''}>${tk(k, 'lg')}<b>${g.bank[k]}</b>${CAT_INFO[k].ko}${takeMode === 'same' ? `<small>${g.bank[k] >= 4 ? '2개 가능' : '4개 이상 필요'}</small>` : ''}<i class="n2">${takeSel[k] || ''}</i></button>`;
    }).join('');
    Object.keys(takeRet).forEach((k) => { if (takeSel[k]) delete takeRet[k]; });
    const n = sum(takeSel), back = sum(takeRet);
    const max = takeMode === 'same' ? 2 : Math.min(3, CATS.filter((k) => g.bank[k] > 0).length);
    const over = held - back + n - 10;
    $('takeSel').innerHTML = `선택한 자원 <b>${n} / ${max}</b> · ${Object.keys(takeSel).map((k) => `${CAT_INFO[k].ko} ${takeSel[k]}`).join(' + ') || '없음'} <small>(내 자원 ${held}/10)</small>`;
    const needRet = held + n > 10;
    $('retBox').style.display = needRet ? '' : 'none';
    if (needRet) $('retBox').innerHTML = `<span class="rt">자원은 10개까지! 돌려줄 자원 <b>${Math.max(0, held + n - 10)}개</b>를 골라요 ${over > 0 ? `<em>(${over}개 더)</em>` : '<em class="ok">✔</em>'}</span>${TK.filter((k) => my.tokens[k] > 0 && !takeSel[k]).map((k) => `<button data-r="${k}" class="${takeRet[k] ? 'on' : ''}">${tk(k, 'sm')}<span>${my.tokens[k] - (takeRet[k] || 0)}</span>${takeRet[k] ? `<i>-${takeRet[k]}</i>` : ''}</button>`).join('')}<button data-r="" class="rs">↺</button>`;
    $('takeOk').disabled = !(n > 0 && n <= max && over <= 0);
    $('takeNote').textContent = `맞히면 고른 자원을 ${S.settings.fast && S.settings.mult > 1 ? S.settings.mult + '배로 ' : ''}받아요! 황금은 카드를 예약할 때 받을 수 있어요.`;
  }
  $('tkModeA').onclick = () => { SND.play('click'); takeMode = 'diff'; takeSel = {}; renderTake(); };
  $('tkModeB').onclick = () => { SND.play('click'); takeMode = 'same'; takeSel = {}; renderTake(); };
  $('takeList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]'); if (!b || b.disabled) return; const k = b.dataset.k;
    if (takeMode === 'same') takeSel = takeSel[k] ? {} : { [k]: 2 };
    else if (takeSel[k]) delete takeSel[k];
    else { if (Object.keys(takeSel).length >= 3) { toast('서로 다른 자원은 3개까지 골라요.'); SND.play('error'); return; } takeSel[k] = 1; }
    SND.play('pick'); renderTake();
  });
  $('retBox').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-r]'); if (!b) return; const k = b.dataset.r; const my = S.game.ps[S.me.id];
    if (!k) takeRet = {}; else if ((takeRet[k] || 0) < my.tokens[k]) takeRet[k] = (takeRet[k] || 0) + 1; else delete takeRet[k];
    SND.play('pay'); renderTake();
  });
  $('takeOk').onclick = () => { closeL('mTake'); SND.play('press'); socket.emit('s:act', { type: 'take', pick: takeSel, ret: takeRet }, (r) => { if (r && r.err) { toast(r.err); SND.play('error'); } }); };
  $('btnTake').onclick = () => { SND.play('click'); openTake(null); };
  $('btnBuyMode').onclick = () => {
    SND.play('click'); const g = S.game, my = g.ps[S.me.id];
    const any = [...(g.market || []), ...my.reserved].some((id) => KC.payPlan(id, my.cards, my.tokens));
    if (!any) toast('지금 살 수 있는 카드가 없어요. 카드를 눌러 부족한 자원을 확인해요!');
    setMode(mode === 'buy' ? null : 'buy');
  };
  $('btnResMode').onclick = () => { SND.play('click'); setMode(mode === 'reserve' ? null : 'reserve'); };
  const endTurn = () => { SND.play('turnEnd'); setMode(null); closeL('mDone'); socket.emit('s:act', { type: 'end' }, (r) => { if (r && r.err) toast(r.err); }); };
  $('btnEnd').onclick = endTurn; $('doneNext').onclick = endTurn;
  $('gTiers').addEventListener('click', (e) => { const c = e.target.closest('.mc'); if (c) openCard(c.dataset.card, mode || 'buy'); });
  $('gMine').addEventListener('click', (e) => { const c = e.target.closest('[data-card]'); if (c) openCard(c.dataset.card, c.classList.contains('rsvC') ? 'buy' : 'view'); });
  $('gNobles').addEventListener('click', (e) => { const n = e.target.closest('[data-nob]'); if (n) { const nb = NOBLES[n.dataset.nob]; SND.play('card'); fxShow(`<img class="cardBig" src="img/n/bonus/${nb.id}.webp"><div class="cap">${nb.name} (${nb.ko}) +${nb.pts}점 · ${nb.rule} 카드 모으기</div>`, 2600); } });
  document.querySelectorAll('.opp').forEach((el) => el.addEventListener('click', () => { if (!el.dataset.pid) return; SND.play('card'); plOpen = el.dataset.pid; renderPlayer(plOpen); openL('mPlayer'); }));

  /* 카드 팝업: 구매(카드 구매 확인) · 예약(카드 예약 확인) · 보기(카드 상세 보기) */
  function openCard(id, m) { SND.play('card'); cardOpen = id; cardMode = m; renderCardDetail(id); openL('mCard'); }
  function renderCardDetail(id) {
    const g = S.game, me = S.me.id, my = g.ps[me], t = g.turn, c = CARDS[id];
    if (!c) return;
    const owned = my.cards.includes(id), reserved = my.reserved.includes(id), inMarket = (g.market || []).includes(id);
    if (cardMode !== 'view' && !reserved && !inMarket) { closeL('mCard'); cardOpen = null; return; }
    let m = cardMode; if (m === 'reserve' && !inMarket) m = 'buy';
    const fr = m === 'reserve' ? 'reserve' : m === 'view' ? 'detail' : 'buy';
    $('cdFrame').src = `img/n/frame/${fr}.webp`;
    $('cdTitle').textContent = { reserve: '카드 예약하기', detail: '카드 상세 보기', buy: '카드 구매하기' }[fr]; $('cdTitle').style.setProperty('--fc', { reserve: '#a85fe0', detail: '#f8c04d', buy: '#1a83ef' }[fr]);
    $('cdImg').src = CARDIMG(id); $('cdImg').alt = c.name;
    $('cdName').textContent = `${c.name} · ${c.ko}`;
    $('cdMeta').textContent = `${TIERS[c.tier].ko} · ${c.pts}점 · ${CAT_INFO[c.cat].ko} 영구 할인 +1`;
    const myTurn = t && t.pid === me; const plan = KC.payPlan(id, my.cards, my.tokens);
    const busy = !myTurn ? '내 차례에만 할 수 있어요.' : t.q ? '문제를 먼저 풀어요.' : t.done ? '이번 차례에는 이미 행동했어요.' : S.paused ? '잠시 멈춤 중이에요.' : '';
    const busyBuy = !myTurn ? '내 차례에만 살 수 있어요.' : t.q ? '문제를 먼저 풀어요.' : t.bought ? '카드는 한 차례에 한 장만 살 수 있어요.' : !buyOpen(t) ? (S.paused ? '잠시 멈춤 중이에요.' : '이번 차례에는 이미 행동했어요.') : '';
    const msg = $('cdMsg'); msg.className = 'cdMsg';
    let canBuy = false, canRes = false;
    if (m === 'reserve') {
      $('cdMain').innerHTML = `<div class="rsvInfo"><b>이 카드를 예약할까요?</b><br>예약한 카드는 나중에 구매할 수 있어요.<br>예약한 카드 <b>${my.reserved.length} / 3장</b></div><div class="cdDesc">${esc(c.desc)}</div>`;
      canRes = !busy && my.reserved.length < 3;
      msg.textContent = busy || (my.reserved.length >= 3 ? '예약 카드는 3장까지만 가질 수 있어요.' : g.bank.wild > 0 && totTok(my) < 10 ? '예약하면 황금 토큰 1개를 받아요!' : '황금 토큰이 없어서 카드만 예약돼요.');
      if (!canRes) msg.classList.add('bad');
    } else if (m === 'view') {
      $('cdMain').innerHTML = `<div class="cdDesc">${esc(c.desc)}</div><div class="shortBox" style="margin-top:10px">구매 비용 ${dots(c.cost)}</div><div class="cdDesc">구매하면 <b>${CAT_INFO[c.cat].ko}</b> 비용이 영원히 1개 줄어요.</div>`;
      msg.className = 'cdMsg info'; msg.textContent = owned ? '내가 구매한 카드예요.' : '카드 정보';
    } else {
      const disc = KC.catCounts(my.cards); const need = KC.effCost(id, my.cards);
      const cols = CATS.filter((k) => c.cost[k]);
      const row = (lbl, f, cls = '') => `<tr class="${cls}"><th>${lbl}</th>${cols.map((k) => `<td>${f(k)}</td>`).join('')}<td>${cls === 'have' ? my.tokens.wild : cls === 'pay' && plan ? plan.wild || 0 : ''}</td></tr>`;
      $('cdMain').innerHTML = `<table class="payT"><tr class="hd"><th></th>${cols.map((k) => `<td>${tk(k, 'sm')}</td>`).join('')}<td>${tk('wild', 'sm')}</td></tr>
        ${row('필요 비용', (k) => c.cost[k])}${row('영구 할인', (k) => (Math.min(disc[k], c.cost[k]) ? '-' + Math.min(disc[k], c.cost[k]) : 0))}
        ${row('실제 지불', (k) => (plan ? plan[k] || 0 : `<span class="${(my.tokens[k] || 0) < (need[k] || 0) ? 'short' : ''}">${need[k] || 0}</span>`), 'pay')}${row('현재 보유', (k) => my.tokens[k], 'have')}</table>`;
      canBuy = !busyBuy && !!plan;
      if (!plan) { const sh = KC.shortOf(id, my.cards, my.tokens); msg.classList.add('bad'); msg.innerHTML = `보유한 자원이 부족합니다. 부족한 자원: ${Object.keys(sh).map((k) => `<i class="dot ${k}"></i> ${CAT_INFO[k].ko} ${sh[k]}개`).join('  ')}`; }
      else if (busyBuy) { msg.classList.add('bad'); msg.textContent = busyBuy; }
      else { const pays = Object.keys(plan).map((k) => `${CAT_INFO[k].ko} ${plan[k]}개`); msg.textContent = `구매 가능! ${pays.length ? pays.join(' · ') + ' 지불' : '할인으로 공짜!'}`; }
    }
    const showBuy = m === 'buy' && (inMarket || reserved), showRes = m === 'reserve';
    $('btnBuy').style.display = showBuy ? '' : 'none'; $('btnBuy').disabled = !canBuy; $('btnBuy').querySelector('img').src = BTN('buy', canBuy ? 'n' : 'd');
    $('btnReserve').style.display = showRes ? '' : 'none'; $('btnReserve').disabled = !canRes; $('btnReserve').querySelector('img').src = BTN('reserve', canRes ? 'n' : 'd');
  }
  $('btnBuy').onclick = () => { const id = cardOpen; socket.emit('s:act', { type: 'buy', card: id }, (r) => { if (r && r.err) { toast(r.err); SND.play('error'); } else { closeL('mCard'); cardOpen = null; setMode(null); } }); };
  $('btnReserve').onclick = () => { const id = cardOpen; socket.emit('s:act', { type: 'reserve', card: id }, (r) => { if (r && r.err) { toast(r.err); SND.play('error'); } else { closeL('mCard'); cardOpen = null; setMode(null); } }); };

  /* 다른 학생 상세 정보 */
  function renderPlayer(pid) {
    const g = S.game, p = g.ps[pid]; if (!p) return;
    $('ppHead').textContent = pid === S.me.id ? '내 상세 정보' : '다른 학생 상세 정보';
    $('ppAv').src = AV(p.char); $('ppName').textContent = `${p.name} · ${g.order.indexOf(pid) + 1}번 학생`;
    $('ppSub').textContent = `현재 점수 ${p.score}점 | 예약 카드 ${p.reserved.length}장 | 정답 ${p.correct}/${p.attempts}${p.online ? '' : ' | 접속 끊김'}`;
    $('ppScore').textContent = p.score;
    $('ppTok').innerHTML = TK.map((k) => `<div class="t">${tk(k)}<span>${CAT_INFO[k].ko} ${p.tokens[k]}</span></div>`).join('');
    const d = KC.catCounts(p.cards);
    $('ppDisc').innerHTML = CATS.map((k) => `<span class="${k}">${CAT_INFO[k].ko}<br>영구 할인 +${d[k]}</span>`).join('');
    $('ppCards').innerHTML = p.cards.length ? p.cards.map((id) => `<div class="pc ${CARDS[id].cat}"><img src="${PH(id)}">${esc(shortName(CARDS[id]))}</div>`).join('') : '<span class="none">아직 구매한 카드가 없어요</span>';
    $('ppRsv').innerHTML = (p.reserved.map((id) => `<div class="pc ${CARDS[id].cat}"><img src="${PH(id)}">예약: ${esc(shortName(CARDS[id]))}</div>`).join('') + p.nobles.map((n) => `<div class="pc bn"><img src="img/n/bph/${n}.webp">${NOBLES[n].name} +3</div>`).join('')) || '<span class="none">예약 카드·보너스 카드가 없어요</span>';
  }

  /* 영어 문제 */
  function renderQuestion() {
    const g = S.game, t = g.turn, me = S.me.id;
    if (resultUntil > Date.now()) return;
    if (!t || !t.q) { if ($('mQ').classList.contains('on')) closeL('mQ'); qKey = null; return; }
    const q = t.q; const key = t.pid + ':' + q.startedAt; const mine = t.pid === me;
    if (key !== qKey) {
      qKey = key; qSel = -1; $('qRes').classList.remove('on');
      $('qWho').innerHTML = mine ? '' : `· <b>${esc(g.ps[t.pid].name)}</b> 학생이 푸는 중`;
      $('qImg').innerHTML = q.img ? `<img src="${PH(q.img)}" alt="">` : '';
      document.querySelector('.qBox').classList.toggle('noimg', !q.img);
      const isKo = /[가-힣]/.test(q.text.replace(/\(.*?\)/g, ''));
      $('qText').textContent = 'Q. ' + q.text; $('qText').classList.toggle('ko', isKo);
      $('qKo').textContent = q.ko || '';
      $('qChoices').innerHTML = q.choices.map((c, i) => `<button data-i="${i}"><i>${'ABCD'[i]}</i><span>${esc(c)}</span></button>`).join('');
      $('qChoices').classList.toggle('lock', !mine);
      $('qPick').innerHTML = (mine ? '맞히면 ' : '걸린 자원 ') + (S.settings.fast && S.settings.mult > 1 ? `<b>×${S.settings.mult}</b> ` : '') + Object.keys(q.pick || {}).map((k) => Array.from({ length: q.pick[k] }, () => tk(k, 'sm')).join('')).join('') + (Object.keys(q.ret || {}).length ? ' · 돌려줄 ' + Object.keys(q.ret).map((k) => Array.from({ length: q.ret[k] }, () => tk(k, 'sm')).join('')).join('') : '');
      $('btnSpeak').style.display = isKo ? 'none' : '';
      $('qOk').style.display = mine ? '' : 'none'; $('qOk').disabled = true;
      openL('mQ'); closeL('mCard'); closeL('mTake'); closeL('mPlayer'); cardOpen = null; plOpen = null; setMode(null);
      SND.play('question');
    }
    const p = g.ps[t.pid];
    $('btnHint').style.display = mine ? '' : 'none';
    $('hintN').textContent = p.hints ?? 0;
    $('btnHint').disabled = !mine || !(p.hints > 0) || !!q.removed;
    if (q.removed) $('qChoices').querySelectorAll('button').forEach((b, i) => { b.classList.toggle('gone', q.removed.includes(i)); if (q.removed.includes(qSel)) { qSel = -1; $('qOk').disabled = true; b.classList.remove('sel'); } });
  }
  $('qChoices').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]'); if (!b || $('qChoices').classList.contains('lock')) return;
    qSel = +b.dataset.i; SND.play('pick');
    $('qChoices').querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
    $('qOk').disabled = false;
  });
  $('qOk').onclick = () => {
    if (qSel < 0) return; $('qChoices').classList.add('lock'); $('qOk').disabled = true; SND.play('press');
    socket.emit('s:act', { type: 'answer', choice: qSel }, (r) => { if (r && r.err) { toast(r.err); $('qChoices').classList.remove('lock'); } });
  };
  $('btnHint').onclick = () => { SND.play('pick'); socket.emit('s:act', { type: 'hint' }, (r) => { if (r && r.err) { toast(r.err); SND.play('error'); } }); };
  $('btnSpeak').onclick = () => SND.speak($('qText').textContent.replace(/^Q\.\s*/, ''));

  /* 효과 */
  function fxShow(html, ms = 2200) {
    const d = document.createElement('div'); d.className = 'fxItem'; d.innerHTML = html; d.style.animationDuration = ms + 'ms';
    $('fx').appendChild(d); setTimeout(() => d.remove(), ms + 50);
  }
  function showDone(msg, sub) { $('doneMsg').textContent = msg; $('doneSub').textContent = sub; const g = S.game, my = g && g.ps[S.me.id]; const more = g && buyOpen(g.turn) && canAfford(g, my); $('doneBuy').style.display = more ? '' : 'none'; if (more) $('doneSub').textContent = '살 수 있는 카드가 있어요! 1장 더 사거나 차례를 넘겨요.'; openL('mDone'); }
  $('doneBuy').onclick = () => { SND.play('click'); closeL('mDone'); setMode('buy'); };
  function onFx(e) {
    if (e.type === 'start') { SND.play('start'); return; }
    if (!S || !S.game) return;
    const g = S.game, me = S.me.id, nm = (pid) => nameOf(g, pid);
    if (e.type === 'answer') {
      const mine = e.pid === me;
      $('qChoices').querySelectorAll('button').forEach((b, i) => { b.classList.toggle('right', i === e.answer); b.classList.toggle('wrong', i === e.picked && !e.ok); });
      $('qChoices').classList.add('lock');
      const r = $('qRes');
      const who = mine ? '' : `<small>${esc(nm(e.pid))} 학생</small>`;
      if (e.ok) {
        const got = e.got || {};
        r.innerHTML = `<div class="resPop ok"><img src="img/v2/popfull_ok.webp" alt="정답이에요! You got it!"><div class="resBody">${who}<div class="rTok">${Object.keys(got).map((k) => `<span>${tk(k, 'lg')}+${got[k]}</span>`).join('') || '<span style="font-size:20px">자원이 가득해서 받지 못했어요</span>'}</div>${Object.keys(e.ret || {}).length ? `<small>돌려준 자원: ${Object.keys(e.ret).map((k) => `${CAT_INFO[k].ko} ${e.ret[k]}`).join(' · ')}</small>` : ''}<p>${esc(e.exp)}</p></div><button class="resBtn" aria-label="확인"></button></div>`;
        SND.play('correct'); if (mine) setTimeout(() => SND.play('coin'), 450);
      } else {
        r.innerHTML = `<div class="resPop no"><img src="img/v2/popfull_no.webp" alt="오답이에요! Try again!"><div class="resBody">${who}<div class="rAns">${e.picked < 0 ? '⏰ 시간이 끝났어요! ' : ''}정답: <b>${esc(e.ansText)}</b></div><p>이번 문제의 보상은 지급되지 않아요. ${esc(e.exp)}</p></div><button class="resBtn" aria-label="닫기"></button></div>`;
        SND.play('wrong');
      }
      setTimeout(() => r.classList.add('on'), 600);
      resultUntil = Date.now() + 4200;
      const closeRes = () => { if (!resultUntil && !r.classList.contains('on')) return; clearTimeout(r._t); resultUntil = 0; r.classList.remove('on'); closeL('mQ'); qKey = null; if (mine && S.game && S.game.turn && S.game.turn.pid === me && S.game.turn.done) { if (buyOpen(S.game.turn) && canAfford(S.game, S.game.ps[me])) { render(); showDone(e.ok ? '자원을 받았어요!' : '이번엔 자원을 못 받았어요.', ''); } else endTurn(); } else render(); };
      r._t = setTimeout(closeRes, 4200);
      setTimeout(() => { const btn = r.querySelector('.resBtn'); if (btn) btn.onclick = () => { SND.play('click'); closeRes(); }; }, 0);
    } else if (e.type === 'buy') {
      const c = CARDS[e.card];
      if (e.pid === me) { fxShow(`<img class="cardBig" src="${CARDIMG(e.card)}"><div class="cap">카드 구매 완료! ${c.pts ? `+${c.pts}점 · ` : ''}${CAT_INFO[c.cat].ko} 영구 할인 +1</div>`, 2300); SND.play('buy'); if (c.pts) setTimeout(() => SND.play('score'), 700); setTimeout(() => showDone(`${shortName(c)} 카드를 구매했어요!`, '다음 학생에게 차례를 넘겨요.'), 1400); }
      else { toast(`${nm(e.pid)} 학생이 ${c.name} 카드를 샀어요! (+${c.pts}점)`, 'info'); SND.play('notice'); }
    } else if (e.type === 'noble') {
      e.nobles.forEach((nid, i) => setTimeout(() => {
        fxShow(`<img class="cardBig" src="img/n/bonus/${nid}.webp"><div class="cap">${e.pid === me ? '내가' : esc(nm(e.pid)) + ' 학생이'} 보너스 카드 획득! +${NOBLES[nid].pts}점</div>`, 2800);
        SND.play('noble');
      }, i * 2900));
    } else if (e.type === 'reserve') {
      if (e.pid === me) { SND.play('reserve'); setTimeout(() => showDone(`${shortName(CARDS[e.card])} 카드를 예약했어요!${e.wild ? ' 황금 +1' : ''}`, '예약한 카드는 다음 차례에 구매할 수 있어요.'), 300); }
      else { toast(`${nm(e.pid)} 학생이 ${CARDS[e.card].name} 카드를 예약했어요.`, 'info'); SND.play('notice'); }
    } else if (e.type === 'target') {
      SND.play('noble');
      fxShow(e.target === 15 ? `<img class="uiBig" src="img/n/ui/target.webp"><div class="cap">${e.pid === me ? '내가' : esc(nm(e.pid)) + ' 학생이'} 15점 달성! 이번 바퀴가 마지막이에요</div>` : `<img class="uiBig" src="img/n/ui/pt10.webp" style="width:160px"><div class="cap">${esc(nm(e.pid))} 학생 ${e.target}점 달성! 이번 바퀴가 마지막이에요</div>`, 3200);
    } else if (e.type === 'end') {
      setTimeout(() => { const rk = (S.game && S.game.ranking) || []; const m = rk.find((x) => x.pid === me); SND.play(m && m.rank === 1 ? 'win' : 'end'); }, 300);
    }
  }

  /* 타이머 */
  let lastWarn = 0;
  function tick() {
    if (!S || !S.game || !$('sGame').classList.contains('on')) return;
    const g = S.game; const now = S.paused ? S.now : sNow();
    const left = g.endAt - now;
    $('gTime').textContent = mmss(left);
    $('gClock').classList.toggle('warn', left < 60000);
    const t = g.turn; if (!t) return;
    $('gTurnBar').style.width = Math.max(0, Math.min(100, ((t.deadline - now) / ((S.settings.turnTime || 60) * 1000)) * 100)) + '%';
    if (t.q) {
      const qt = (S.settings.qTime || 25) * 1000; const ql = t.q.deadline - now;
      $('qBar').style.width = Math.max(0, Math.min(100, (ql / qt) * 100)) + '%';
      $('qSec').textContent = Math.max(0, Math.ceil(ql / 1000));
      if (t.pid === S.me.id && ql < 5000 && ql > 0 && Date.now() - lastWarn > 2400 && resultUntil < Date.now()) { lastWarn = Date.now(); SND.play('tick'); }
    }
  }
  setInterval(tick, 250);

  /* 결과 */
  const RK_TOP = [35.1, 44.8, 56.1, 66.4, 77.3];
  function renderEnd() {
    const g = S.game; const rk = (g.ranking || []).slice(0, 5);
    $('tieBox').classList.toggle('on', !!g.tie);
    $('rkRows').innerHTML = rk.map((r, i) => `<div class="rk r${r.rank} ${r.pid === S.me.id ? 'me' : ''}" style="top:${RK_TOP[i]}%"><span class="n">${r.rank === 1 ? '👑' : r.rank}</span><img src="${AV(r.char)}" alt=""><b>${esc(r.name)}</b><span>${r.score}점</span></div>`).join('');
    $('endList').innerHTML = rk.map((r) => { const ps = g.ps[r.pid]; const cards = ps ? ps.cards.map((id) => `<img src="${CARDIMG(id)}" title="${esc(CARDS[id].name)}">`).join('') + r.nobles.map((n) => `<img src="img/n/bonus/${n}.webp" title="${NOBLES[n].name}">`).join('') : '';
      return `<div class="er ${r.pid === S.me.id ? 'me' : ''}"><div class="top"><b>${r.rank}등</b><img class="ava" style="width:36px;height:36px" src="${AV(r.char)}">${esc(r.name)} · ${r.score}점<small>카드 ${r.cards}장 · 정답 ${r.correct}/${r.attempts}</small></div><div class="erCards">${cards || '<span style="color:#a08a68">모은 카드가 없어요</span>'}</div></div>`; }).join('');
  }
  $('btnHome').onclick = () => { SND.play('click'); socket.emit('s:room', { op: 'lobby' }, () => { local = 'title'; nav('title'); }); };
  $('btnAgain').onclick = () => { SND.play('click'); socket.emit('s:room', { op: 'lobby' }, () => { local = 'app'; render(); }); };

  /* 도움말 탭 */
  $('helpTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; SND.play('click'); $('helpTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); document.querySelectorAll('.helpPane').forEach((p) => p.classList.toggle('on', p.id === b.dataset.t)); });

  /* 도감 */
  let bookCat = 'food';
  function renderBook() {
    $('bookTabs').innerHTML = CATS.map((k) => `<button class="${k === bookCat ? 'on' : ''}" data-bc="${k}" style="min-width:170px">${CAT_INFO[k].ko} ${CAT_INFO[k].en}</button>`).join('');
    $('bookList').innerHTML = Object.values(CARDS).filter((c) => c.cat === bookCat).map((c) => `<div class="bk" data-say="${esc(shortName(c))}. ${esc(c.desc)}"><img src="${CARDIMG(c.id)}" alt="${esc(c.name)}"><small>🔊 ${esc(c.desc)}</small></div>`).join('');
  }
  $('bookTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-bc]'); if (b) { bookCat = b.dataset.bc; SND.play('pick'); renderBook(); } });
  $('bookList').addEventListener('click', (e) => { const b = e.target.closest('[data-say]'); if (b) SND.speak(b.dataset.say); });

  /* 소리·설정 */
  function gearUI() {
    $('vSfx').value = Math.round(SND.sv * 100); $('vBgm').value = Math.round(SND.bv * 100);
    $('tSfx').checked = SND.sfx; $('tBgm').checked = SND.bgm;
    $('btnSfx').classList.toggle('off', !SND.sfx); $('btnSfx').textContent = SND.sfx ? '🔊' : '🔇';
  }
  $('vSfx').oninput = () => SND.setVol('sv', $('vSfx').value / 100);
  $('vSfx').onchange = () => SND.play('click');
  $('vBgm').oninput = () => SND.setVol('bv', $('vBgm').value / 100);
  $('tSfx').onchange = () => { if ($('tSfx').checked !== SND.sfx) SND.toggleSfx(); gearUI(); SND.play('click'); };
  $('tBgm').onchange = () => { if ($('tBgm').checked !== SND.bgm) SND.toggleBgm(); gearUI(); };
  $('btnSfx').onclick = () => { SND.toggleSfx(); gearUI(); SND.play('click'); toast(SND.sfx ? '효과음 켜짐' : '효과음 꺼짐', 'info', 1200); };
  $('fsOn').onclick = () => { try { document.documentElement.requestFullscreen(); } catch {} };
  $('fsOff').onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); } catch {} };
  gearUI();

  // 새로고침 대비: 이전 접속 정보로 이어하기
  if (sess && sess.code && sess.name && sess.char) {
    local = 'title'; show('sTitle');
    socket.once('connect', async () => { const r = await doJoin(sess.code, sess.name, true); if (r && r.inGame) { local = 'app'; render(); } });
  } else show('sTitle');
})();
