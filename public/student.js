/* K-Culture 마스터 — 학생 화면 */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const { CATS, CAT_INFO, CARDS, NOBLES, QUIZ, CHARS, CHAR_KO, TIERS } = KC;
  const TK = [...CATS, 'wild'];
  const TOK = (k) => `img/v2/tok_${k}.webp`;
  const AV = (c) => `img/v2/ch_${CHARS.includes(c) ? c : 'jiho'}.webp`;
  const AVN = (c) => `img/v2/chn_${CHARS.includes(c) ? c : 'jiho'}.webp`;
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
  const SESS_KEY = 'kc_session2';
  let sess = (() => { try { return JSON.parse(localStorage.getItem(SESS_KEY) || 'null'); } catch { return null; } })();
  const saveSess = () => { try { localStorage.setItem(SESS_KEY, JSON.stringify(sess)); } catch {} };
  const urlCode = new URLSearchParams(location.search).get('code');
  if (urlCode) $('inCode').value = urlCode.slice(0, 4);
  else if (sess && sess.code) $('inCode').value = sess.code;
  if (sess && sess.name) $('inName').value = sess.name;

  let S = null, joined = false, local = 'title', offset = 0, selChar = 'jiho', choosing = false;
  let prevRoomId = null, prevPaused = false, pauseHidden = false;
  const socket = io({ transports: ['websocket', 'polling'] });

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

  /* 캐릭터 */
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

  /* ---------- 공통 ---------- */
  const tokHTML = (k, n, cls = '') => `<span class="${cls}"><img src="${TOK(k)}" alt="${CAT_INFO[k].ko}">${n}</span>`;
  function cardHTML(id, cls = '', extra = '') {
    const c = CARDS[id]; if (!c) return '<div class="slot">빈 자리</div>';
    const cost = Object.keys(c.cost).map((k) => tokHTML(k, c.cost[k])).join('');
    return `<div class="kc ${cls}" data-card="${id}"><img src="img/card2/${id}.webp" alt="${esc(c.name)}" draggable="false"><div class="cost">${cost}</div>${extra}</div>`;
  }
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
  function closeAll() { ['mTake', 'mCard', 'mQ', 'mPlayer'].forEach(closeL); plOpen = null; cardOpen = null; setMode(null); }
  $('pauseOk').onclick = () => { pauseHidden = true; render(); };

  /* ---------- 대기실 ---------- */
  let createOpen = false, createMax = 5;
  function renderLobby() {
    const me = S.me, room = S.room, set = S.settings;
    $('lbAv').src = AV(me.char); $('lbName').textContent = me.name; $('lbCode').textContent = S.code;
    let h = '';
    if (room) {
      $('lbTitle').textContent = `${room.name} · ${room.title}`;
      $('lbHead').textContent = room.by === 'student' ? '친구가 만든 방이에요' : '선생님이 배정한 방이에요';
      const max = Math.min(room.max || 5, Math.max(set.teamSize, room.players.length));
      h += `<div class="team">${room.players.map((p) => `<div class="mem ${p.online ? '' : 'off'} ${p.id === me.id ? 'me' : ''}">${room.hostId === p.id ? '<span class="host">방장</span>' : ''}<img class="c" src="${AV(p.char)}"><b>${esc(p.name)}</b></div>`).join('')}
        ${Array.from({ length: Math.max(0, (room.by === 'student' ? room.max : max) - room.players.length) }, () => '<div class="mem empty">빈 자리</div>').join('')}</div>`;
      const canStart = set.hostStart && room.hostId === me.id;
      h += `<p style="text-align:center;font-size:24px;margin:14px 0 4px">${canStart ? (room.players.length >= 2 ? '친구들이 다 모이면 게임 시작하기를 눌러요!' : '친구가 더 들어오면 시작할 수 있어요.') : '선생님이나 방장이 시작하면 게임이 열려요!'}</p>`;
      h += `<div class="rowc">${canStart ? `<button class="ib" id="lbStart" ${room.players.length < 2 ? 'disabled' : ''}><img src="img/v2/b_start.webp" alt="게임 시작하기"></button>` : ''}${set.allowRooms ? '<button class="btn3 gray" id="lbLeave">방 나가기</button>' : ''}</div>`;
    } else {
      $('lbTitle').textContent = '대기 중입니다';
      $('lbHead').textContent = '팀 배정을 기다려요';
      h += `<div class="waitBox"><img src="img/v2/pop_wait.webp" alt=""><p>선생님이 팀을 배정하고 있어요.<small>또는 친구들과 직접 방을 만들어 들어갈 수 있어요.</small></p>
        ${set.allowRooms ? '<button class="ib" id="lbCreate"><img src="img/v2/b_create.webp" alt="방 만들기"></button>' : ''}</div>`;
      if (set.allowRooms && createOpen) {
        h += `<div class="pop createPop" style="margin:12px auto"><div class="popHead">방 만들기</div><div class="popBody">
          <label class="fld">방 이름을 입력하세요.<input id="crName" maxlength="12" placeholder="예) 6-1 문화탐험대"></label>
          <div class="gRow"><span>최대 인원</span><button class="btn3 sm ${createMax === 4 ? 'blue' : 'gray'}" data-max="4">4명</button><button class="btn3 sm ${createMax === 5 ? 'blue' : 'gray'}" data-max="5">5명</button></div>
          <div class="rowc"><button class="btn3 gray" id="crCancel">취소</button><button class="btn3 red" id="crOk">방 만들기</button></div></div></div>`;
      }
      if (set.allowRooms && S.rooms.length) {
        h += `<div class="rooms">${S.rooms.map((r) => `<div class="rcard"><h4>${esc(r.name)} · ${esc(r.title)}</h4><div class="avs">${r.players.map((p) => `<img src="${AV(p.char)}" title="${esc(p.name)}">`).join('')}</div><div class="n">${r.players.length} / ${r.max || 5}명</div><button class="ib" data-joinroom="${r.id}" ${r.players.length >= (r.max || 5) ? 'disabled' : ''}><img src="img/v2/b_join.webp" alt="방 참가하기"></button></div>`).join('')}</div>`;
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
    $('pracImg').src = `img/photo/${pracQ[0]}.webp`;
    $('pracCh').innerHTML = pracQ[1].map((c, i) => `<button data-i="${i}">${'ABCD'[i]}. ${esc(c)}</button>`).join('');
    $('pracMsg').textContent = '그림을 보고 알맞은 이름을 골라요.'; $('pracMsg').style.color = '#6b5236';
  }
  $('pracCh').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]'); if (!b || pracDone) return;
    pracDone = true; pracN++;
    const i = +b.dataset.i, ok = i === pracQ[2]; if (ok) pracOk++;
    $('pracCh').querySelectorAll('button').forEach((x, j) => { x.classList.toggle('right', j === pracQ[2]); x.classList.toggle('wrong', j === i && !ok); });
    const c = CARDS[pracQ[0]];
    $('pracMsg').textContent = ok ? `정답! ${c.name} = ${c.ko}` : `아쉬워요! 정답은 ${c.name}`; $('pracMsg').style.color = ok ? '#1f9a35' : '#d4211d';
    $('pracScore').textContent = `${pracOk} / ${pracN}`;
    SND.play(ok ? 'correct' : 'wrong'); SND.speak(c.name.replace(/\(.*\)/, ''));
  });
  $('pracNext').onclick = () => { SND.play('click'); nextPrac(); };

  /* ---------- 게임 ---------- */
  let lastGameStart = 0, lastTurnSeq = -1, qKey = null, resultUntil = 0, cardOpen = null, cardMode = null, plOpen = null, mode = null;
  const SLOT_ORDER = ['opp0', 'opp2', 'opp1', 'opp3'];
  function seatName(g, pid) { return g.ps[pid] ? g.ps[pid].name : '?'; }

  function renderGame() {
    const g = S.game, me = S.me.id, my = g.ps[me];
    if (!my) return;
    const t = g.turn, myTurn = !!(t && t.pid === me);
    if (g.startAt !== lastGameStart) { lastGameStart = g.startAt; lastTurnSeq = -1; openL('mRules'); clearTimeout(window._rt); window._rt = setTimeout(() => closeL('mRules'), 10000); }
    if (t && g.seq !== lastTurnSeq) {
      const first = lastTurnSeq === -1; lastTurnSeq = g.seq;
      const who = g.ps[t.pid];
      if (!first) fxShow(`<div class="turnBan"><img src="${AV(who.char)}">${myTurn ? '<em>내</em> 차례입니다!' : `<em>${esc(who.name)}</em> 학생의 차례입니다!`}</div>`, 1500);
      if (myTurn) SND.play('turn');
      closeL('mTake'); setMode(null);
      if (cardOpen) { closeL('mCard'); cardOpen = null; }
    }
    $('gTarget').textContent = g.target;
    // 보너스 카드
    $('gNobles').innerHTML = Object.keys(NOBLES).map((nid) => {
      const nb = NOBLES[nid], own = g.nobles[nid], ok = !own && KC.nobleOk(nid, my.cards);
      return `<div class="nob ${own ? 'got' : ''} ${ok ? 'ok' : ''}" data-nob="${nid}"><img class="p" src="img/v2/bph_${nid}.webp" alt="${nb.name}"><div class="t">${nb.ko} <b>+${nb.pts}</b></div><div class="r">${nb.rule}</div>${own ? `<img class="own" src="${AV(g.ps[own] && g.ps[own].char)}" title="${esc(seatName(g, own))}">` : ''}</div>`;
    }).join('');
    // 자원 창고
    const canTake = myTurn && !t.action && !t.q && !S.paused;
    $('gBank').innerHTML = TK.map((k) => `<div class="coin ${canTake && k !== 'wild' && g.bank[k] > 0 ? 'can' : ''} ${g.bank[k] <= 0 ? 'empty' : ''}" data-k="${k}" title="${CAT_INFO[k].ko}"><img src="${TOK(k)}" alt="${CAT_INFO[k].ko}"><b>${g.bank[k]}</b></div>`).join('');
    // 카드 시장 (3단계)
    const canBuyNow = myTurn && !t.bought && !t.q;
    $('gTiers').innerHTML = [1, 2, 3].map((tn) => `<div class="tier t${tn}"><div class="tierHead">${TIERS[tn].ko} <small>(${TIERS[tn].pts} · 남은 ${g.deckCounts ? g.deckCounts[tn] : 0}장)</small></div><div class="tierGrid">${(g.tiers ? g.tiers[tn] : []).map((id) => (id ? cardHTML(id, canBuyNow && KC.payPlan(id, my.cards, my.tokens) ? 'can' : '') : '<div class="slot">빈 자리</div>')).join('')}</div></div>`).join('');
    $('gTiers').classList.toggle('mode-reserve', mode === 'reserve');
    // 친구 칸
    const others = []; const mi = g.order.indexOf(me);
    for (let k = 1; k < g.order.length; k++) others.push(g.order[(mi + k) % g.order.length]);
    SLOT_ORDER.forEach((sid, i) => { const el = $(sid); const pid = others[i]; if (!pid) { el.className = 'opp'; el.innerHTML = ''; return; } renderOpp(el, pid, g); });
    // 내 칸
    renderMine(g, my, me, canBuyNow);
    // 차례
    if (t) {
      const who = g.ps[t.pid];
      $('gTurnWho').innerHTML = (myTurn ? `<em>내 차례예요!</em> ${t.action ? '✔자원' : '①자원/예약'} · ${t.bought ? '✔카드' : '②카드 사기'}` : `<em>${esc(who.name)}</em> 학생의 차례`) + (g.finalRound ? ' · 마지막 라운드!' : '');
    }
    setAct('btnTake', canTake);
    setAct('btnBuyMode', canBuyNow);
    setAct('btnResMode', myTurn && !t.action && !t.q && my.reserved.length < 3);
    setAct('btnEnd', myTurn && !t.q);
    renderQuestion();
    if (cardOpen) renderCardDetail(cardOpen);
    if (plOpen) renderPlayer(plOpen);
    tick();
  }
  const ABK = { btnTake: 'take', btnBuyMode: 'buy', btnResMode: 'reserve', btnEnd: 'end' };
  function setAct(id, on) {
    const b = $(id); const k = ABK[id];
    const st = !on ? 'd' : (mode === k ? 'p' : 'n');
    const src = `img/v2/ab_${k}_${st}.webp`; const img = b.querySelector('img');
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    b.disabled = !on; b.classList.toggle('on', on && mode === k);
  }
  function stacks(cards, w, maxW) {
    const by = {}; cards.forEach((id) => (by[CARDS[id].cat] = by[CARDS[id].cat] || []).push(id));
    const keys = CATS.filter((k) => by[k]);
    const n = keys.length; const gap = n > 1 ? Math.min(4, (maxW - n * w) / (n - 1)) : 0;
    return keys.map((k, i) => { const list = by[k]; return `<div class="stk" style="border-color:var(--${k});${i ? `margin-left:${gap}px` : ''}"><img src="img/v2/th_${list[list.length - 1]}.webp" alt=""><b>×${list.length}</b></div>`; }).join('');
  }
  function renderOpp(el, pid, g) {
    const p = g.ps[pid], seat = g.order.indexOf(pid), t = g.turn; const disc = KC.catCounts(p.cards);
    el.className = `opp on c${seat % 5} ${t && t.pid === pid ? 'turn' : ''} ${p.online ? '' : 'off'}`;
    el.dataset.pid = pid;
    const rg = Math.min(6, (170 - 3 * 56) / 2);
    const rsv = p.reserved.map((id, i) => `<div class="stk rs" style="border-color:var(--${CARDS[id].cat});${i ? `margin-left:${rg}px` : ''}" title="${esc(CARDS[id].name)}"><img src="img/v2/th_${id}.webp" alt=""><b>${CARDS[id].pts}점</b></div>`).join('') + Array.from({ length: 3 - p.reserved.length }, (_, i) => `<div class="slotS" style="${i + p.reserved.length ? `margin-left:${rg}px` : ''}"></div>`).join('');
    el.innerHTML = `<div class="oHead"><span class="num">${seat + 1}</span><span class="nm">${esc(p.name)}</span><span class="sc">점수 <b>${p.score}</b></span></div>
      <div class="oMid"><img class="ava" src="${AV(p.char)}"><div class="toks">${TK.map((k) => `<div class="t"><img src="${TOK(k)}" alt="${CAT_INFO[k].ko}"><b>${p.tokens[k]}</b>${k !== 'wild' ? `<i style="background:${disc[k] ? `var(--${k})` : '#c9b99a'}">할인${disc[k]}</i>` : `<i style="background:#c9b99a">${totTok(p)}/10</i>`}</div>`).join('')}</div></div>
      <div class="oCards"><div class="oSec buy"><div class="h">구매한 카드 ${p.cards.length}장</div><div class="row">${p.cards.length ? stacks(p.cards, 56, 170) : '<span class="noneS">아직 없어요</span>'}</div></div>
      <div class="oSec rsv"><div class="h">예약 카드 ${p.reserved.length}/3</div><div class="row rsvRow">${rsv}</div></div></div>`;
  }
  function renderMine(g, my, me, canBuyNow) {
    const seat = g.order.indexOf(me), t = g.turn, disc = KC.catCounts(my.cards);
    const el = $('gMine'); el.classList.toggle('turn', !!(t && t.pid === me));
    el.innerHTML = `<div class="mSec me"><div><div class="nmBox"><span class="num">${seat + 1}</span>${esc(my.name)} (나)</div><img class="ava" src="${AV(my.char)}" style="margin-top:6px"></div><div class="scBox">점수<b>${my.score}</b></div></div>
      <div class="mSec tk"><div class="h">내 자원 토큰 (${totTok(my)}/10)</div><div class="toks">${TK.map((k) => `<div class="t"><img src="${TOK(k)}" alt="${CAT_INFO[k].ko}"><b>${my.tokens[k]}</b>${k !== 'wild' ? `<i style="background:${disc[k] ? `var(--${k})` : '#c9b99a'}">할인${disc[k]}</i>` : '<i style="background:#e0a800">만능</i>'}</div>`).join('')}</div></div>
      <div class="mSec cards"><div class="h">내가 구매한 카드 (${my.cards.length}장)</div><div class="row">${my.cards.length ? my.cards.map((id) => cardHTML(id)).join('') : '<span class="none">자원을 모아 카드를 사 보세요!</span>'}</div></div>
      <div class="mSec rv"><div class="h">예약 카드 (${my.reserved.length}/3)</div><div class="row">${my.reserved.map((id) => cardHTML(id, canBuyNow && KC.payPlan(id, my.cards, my.tokens) ? 'can' : '')).join('')}${Array.from({ length: 3 - my.reserved.length }, () => '<div class="slotS"></div>').join('')}</div></div>`;
  }

  function setMode(m) {
    mode = m; const tip = $('modeTip');
    if (m === 'buy') { tip.textContent = '🛒 살 카드를 눌러요! (초록색 카드는 바로 살 수 있어요)'; tip.classList.add('on'); }
    else if (m === 'reserve') { tip.textContent = '📜 예약할 카드를 눌러요! (예약하면 왕관 1개)'; tip.classList.add('on'); }
    else tip.classList.remove('on');
    if (S && S.game && $('sGame').classList.contains('on')) { $('gTiers').classList.toggle('mode-reserve', m === 'reserve'); ['btnTake', 'btnBuyMode', 'btnResMode', 'btnEnd'].forEach((id) => { const b = $(id); setAct(id, !b.disabled); }); }
  }
  $('gBank').addEventListener('click', (e) => { const b = e.target.closest('.coin.can'); if (b) openTake(b.dataset.k); });
  let takeSel = null;
  function openTake(pre) {
    const g = S.game; takeSel = pre || null; setMode(null);
    $('takeList').innerHTML = CATS.map((k) => `<button data-k="${k}" ${g.bank[k] <= 0 ? 'disabled' : ''} class="${takeSel === k ? 'on' : ''}"><img class="c" src="${TOK(k)}"><img class="ck" src="img/v2/ic_ok.webp">${CAT_INFO[k].ko}<b>${g.bank[k]}</b></button>`).join('');
    takeUI(); openL('mTake'); SND.play('pick');
  }
  function takeUI() { $('takeSel').textContent = takeSel ? `${CAT_INFO[takeSel].ko} (문제 1개)` : '없음'; $('takeOk').disabled = !takeSel; $('takeList').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === takeSel)); }
  $('takeList').addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b && !b.disabled) { takeSel = b.dataset.k; SND.play('pick'); takeUI(); } });
  $('takeOk').onclick = () => { if (!takeSel) return; closeL('mTake'); SND.play('press'); socket.emit('s:act', { type: 'take', cat: takeSel }, (r) => { if (r && r.err) { toast(r.err); SND.play('error'); } }); };
  $('btnTake').onclick = () => { SND.play('click'); openTake(null); };
  $('btnBuyMode').onclick = () => {
    SND.play('click'); const g = S.game, my = g.ps[S.me.id];
    const any = [...(g.market || []), ...my.reserved].some((id) => KC.payPlan(id, my.cards, my.tokens));
    if (!any) { toast('자원이 부족해요! 지금 살 수 있는 카드가 없어요.'); SND.play('error'); }
    setMode(mode === 'buy' ? null : 'buy');
  };
  $('btnResMode').onclick = () => { SND.play('click'); setMode(mode === 'reserve' ? null : 'reserve'); };
  $('btnEnd').onclick = () => { SND.play('turnEnd'); setMode(null); socket.emit('s:act', { type: 'end' }, (r) => { if (r && r.err) toast(r.err); }); };
  $('gTiers').addEventListener('click', (e) => { const c = e.target.closest('.kc'); if (c) openCard(c.dataset.card, mode); });
  $('gMine').addEventListener('click', (e) => { const c = e.target.closest('.kc'); if (c) openCard(c.dataset.card, null); });
  $('gNobles').addEventListener('click', (e) => { const n = e.target.closest('[data-nob]'); if (n) { const nb = NOBLES[n.dataset.nob]; fxShow(`<img class="nb" src="img/v2/bonus_${nb.id}.webp"><div class="cap">${nb.ko} +${nb.pts}점 · ${nb.rule}</div>`, 2200); } });
  document.querySelectorAll('.opp').forEach((el) => el.addEventListener('click', () => { if (!el.dataset.pid) return; SND.play('card'); plOpen = el.dataset.pid; renderPlayer(plOpen); openL('mPlayer'); }));

  /* 카드 팝업 */
  function openCard(id, m) { SND.play('card'); cardOpen = id; cardMode = m; renderCardDetail(id); openL('mCard'); }
  function renderCardDetail(id) {
    const g = S.game, me = S.me.id, my = g.ps[me], t = g.turn, c = CARDS[id];
    if (!c) return;
    const owned = my.cards.includes(id), reserved = my.reserved.includes(id), inMarket = (g.market || []).includes(id);
    if (!owned && !reserved && !inMarket) { closeL('mCard'); cardOpen = null; return; }
    $('cdHead').textContent = cardMode === 'buy' ? '이 카드를 구매할까요?' : cardMode === 'reserve' ? '이 카드를 예약할까요?' : '카드 자세히 보기';
    $('cdCard').innerHTML = cardHTML(id);
    $('cdName').textContent = `${c.name.replace(/\s*\(.*\)/, '')} ${c.ko}`;
    $('cdCat').textContent = CAT_INFO[c.cat].ko; $('cdCat').style.background = `var(--${c.cat})`;
    $('cdPts').textContent = c.pts; $('cdDesc').textContent = c.desc;
    $('cdCost').innerHTML = Object.keys(c.cost).map((k) => tokHTML(k, c.cost[k])).join('');
    const need = KC.effCost(id, my.cards);
    $('cdNeed').innerHTML = Object.keys(need).length ? Object.keys(need).map((k) => tokHTML(k, need[k], (my.tokens[k] || 0) < need[k] ? 'short' : '')).join('') : '<span class="free">할인으로 공짜!</span>';
    $('cdHave').innerHTML = TK.map((k) => tokHTML(k, my.tokens[k])).join('');
    $('cdBonus').innerHTML = `구매하면 얻는 영구 보너스: <img src="${TOK(c.cat)}"> ${CAT_INFO[c.cat].ko} 비용 -1`;
    const myTurn = t && t.pid === me; const plan = KC.payPlan(id, my.cards, my.tokens);
    let msg = '';
    if (owned) msg = '이미 내가 모은 카드예요.';
    else if (!myTurn) msg = '내 차례에 살 수 있어요.';
    else if (t.q) msg = '문제를 먼저 풀어요.';
    else if (t.bought) msg = '카드는 한 차례에 한 장만 살 수 있어요.';
    else if (!plan) msg = '자원이 부족해요! 빨간 숫자만큼 더 모아요.';
    else if (plan.wild) msg = `왕관(만능 자원) ${plan.wild}개를 대신 써요.`;
    else msg = '살 수 있어요!';
    $('cdMsg').textContent = msg; $('cdMsg').style.color = plan && myTurn && !t.bought && !owned ? '#1f9a35' : '#d4211d';
    const canBuy = !owned && myTurn && !t.q && !t.bought && !!plan;
    const canRes = inMarket && myTurn && !t.q && !t.action && my.reserved.length < 3;
    $('btnBuy').style.display = owned || cardMode === 'reserve' ? 'none' : ''; $('btnBuy').disabled = !canBuy;
    $('btnReserve').style.display = inMarket && cardMode !== 'buy' ? '' : 'none'; $('btnReserve').disabled = !canRes;
    $('cdGold').classList.toggle('on', inMarket && cardMode !== 'buy');
    if (cardMode === 'reserve' && my.reserved.length >= 3) { $('cdMsg').textContent = '예약 카드는 최대 3장까지 가질 수 있어요.'; $('cdMsg').style.color = '#d4211d'; }
  }
  $('btnBuy').onclick = () => { const id = cardOpen; socket.emit('s:act', { type: 'buy', card: id }, (r) => { if (r && r.err) { toast(r.err); SND.play('error'); } else { closeL('mCard'); cardOpen = null; setMode(null); } }); };
  $('btnReserve').onclick = () => { const id = cardOpen; socket.emit('s:act', { type: 'reserve', card: id }, (r) => { if (r && r.err) { toast(r.err); SND.play('error'); } else { closeL('mCard'); cardOpen = null; setMode(null); } }); };

  /* 친구 정보 */
  function renderPlayer(pid) {
    const g = S.game, p = g.ps[pid]; if (!p) return;
    $('ppHead').textContent = pid === S.me.id ? '내 정보' : `${p.name} 학생의 정보`;
    $('ppAv').src = AV(p.char); $('ppName').textContent = p.name;
    $('ppSub').textContent = `${g.order.indexOf(pid) + 1}번째 순서 · 카드 ${p.cards.length}장 · 정답 ${p.correct}/${p.attempts}${p.online ? '' : ' · 접속 끊김'}`;
    $('ppScore').textContent = p.score;
    $('ppTok').innerHTML = TK.map((k) => tokHTML(k, p.tokens[k])).join('');
    const d = KC.catCounts(p.cards);
    $('ppDisc').innerHTML = CATS.map((k) => `<span style="background:var(--${k})">-${d[k]}</span>`).join('');
    $('ppNob').innerHTML = p.nobles.length ? p.nobles.map((n) => `<img src="img/v2/bph_${n}.webp">${NOBLES[n].ko} +${NOBLES[n].pts}`).join(' ') : '아직 없어요';
    $('ppCards').innerHTML = p.cards.length ? p.cards.map((id) => cardHTML(id)).join('') : '<span class="none">아직 모은 카드가 없어요</span>';
    $('ppRsv').innerHTML = p.reserved.length ? p.reserved.map((id) => cardHTML(id)).join('') : '<span class="none">예약한 카드가 없어요</span>';
  }

  /* 문제 */
  function renderQuestion() {
    const g = S.game, t = g.turn, me = S.me.id;
    if (resultUntil > Date.now()) return;
    if (!t || !t.q) { if ($('mQ').classList.contains('on')) closeL('mQ'); qKey = null; return; }
    const q = t.q; const key = t.pid + ':' + q.startedAt; const mine = t.pid === me;
    if (key !== qKey) {
      qKey = key; $('qRes').classList.remove('on');
      $('qCat').innerHTML = `${CAT_INFO[q.cat].ko} 문제`; $('qCat').style.background = `var(--${q.cat})`;
      $('qWho').innerHTML = mine ? '맞히면 자원 2개!' : `<b>${esc(g.ps[t.pid].name)}</b> 학생이 푸는 중`;
      $('qImg').innerHTML = q.img ? `<img src="img/photo/${q.img}.webp" alt="">` : '';
      document.querySelector('.qMid').classList.toggle('noimg', !q.img);
      const isKo = /[가-힣]/.test(q.text.replace(/\(.*?\)/g, ''));
      $('qText').textContent = q.text; $('qText').classList.toggle('ko', isKo);
      $('qKo').textContent = q.ko || '';
      $('qChoices').innerHTML = q.choices.map((c, i) => `<button data-i="${i}"><i>${'ABCD'[i]}.</i><span>${esc(c)}</span></button>`).join('');
      $('qChoices').classList.toggle('lock', !mine);
      $('btnSpeak').style.display = isKo ? 'none' : '';
      openL('mQ'); closeL('mCard'); closeL('mTake'); closeL('mPlayer'); cardOpen = null; plOpen = null; setMode(null);
      SND.play('question');
    }
    const p = g.ps[t.pid];
    $('btnHint').style.display = mine ? '' : 'none';
    $('hintN').textContent = p.hints ?? 0;
    $('btnHint').disabled = !mine || !(p.hints > 0) || !!q.removed;
    if (q.removed) $('qChoices').querySelectorAll('button').forEach((b, i) => b.classList.toggle('gone', q.removed.includes(i)));
  }
  $('qChoices').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]'); if (!b || $('qChoices').classList.contains('lock')) return;
    $('qChoices').classList.add('lock'); b.classList.add('pick'); SND.play('press');
    socket.emit('s:act', { type: 'answer', choice: +b.dataset.i }, (r) => { if (r && r.err) { toast(r.err); $('qChoices').classList.remove('lock'); } });
  });
  $('btnHint').onclick = () => { SND.play('pick'); socket.emit('s:act', { type: 'hint' }, (r) => { if (r && r.err) { toast(r.err); SND.play('error'); } }); };
  $('btnSpeak').onclick = () => SND.speak($('qText').textContent);

  /* 효과 */
  function fxShow(html, ms = 2200) {
    const d = document.createElement('div'); d.className = 'fxItem'; d.innerHTML = html; d.style.animationDuration = ms + 'ms';
    $('fx').appendChild(d); setTimeout(() => d.remove(), ms + 50);
  }
  function onFx(e) {
    if (e.type === 'start') { SND.play('start'); return; }
    if (!S || !S.game) return;
    const g = S.game, me = S.me.id, nm = (pid) => seatName(g, pid);
    if (e.type === 'answer') {
      const mine = e.pid === me;
      $('qChoices').querySelectorAll('button').forEach((b, i) => { b.classList.toggle('right', i === e.answer); b.classList.toggle('wrong', i === e.picked && !e.ok); });
      $('qChoices').classList.add('lock');
      const r = $('qRes'); const ans = $('qChoices').querySelectorAll('button')[e.answer];
      const ansText = e.ansText || (ans ? ans.querySelector('span').textContent : '');
      const who = mine ? '' : `<small>${esc(nm(e.pid))} 학생</small>`;
      if (e.ok) {
        r.innerHTML = `<div class="resPop ok"><img src="img/v2/popfull_ok.webp" alt="정답이에요! You got it!"><div class="resBody">${who}<div class="rTok">${Array.from({ length: e.got }, () => `<img src="${TOK(e.cat)}">`).join('')}${e.bonus ? `<img src="${TOK('wild')}">` : ''}<b>${CAT_INFO[e.cat].ko} +${e.got}${e.bonus ? ' · 왕관 +1' : ''}</b></div><p>${esc(e.exp)}</p></div><button class="resBtn" aria-label="확인"></button></div>`;
        SND.play('correct'); if (mine) setTimeout(() => SND.play(e.bonus ? 'noble' : 'coin'), 450);
      } else {
        r.innerHTML = `<div class="resPop no"><img src="img/v2/popfull_no.webp" alt="오답이에요! Try again!"><div class="resBody">${who}<div class="rAns">${e.picked < 0 ? '⏰ 시간이 끝났어요! ' : ''}정답: <b>${esc(ansText)}</b></div><p>${esc(e.exp)}</p></div><button class="resBtn" aria-label="닫기"></button></div>`;
        SND.play('wrong');
      }
      setTimeout(() => r.classList.add('on'), 650);
      resultUntil = Date.now() + 3600;
      const closeRes = () => { if (!r.classList.contains('on') && !resultUntil) return; clearTimeout(r._t); resultUntil = 0; r.classList.remove('on'); closeL('mQ'); qKey = null; render(); };
      r._t = setTimeout(closeRes, 3600);
      setTimeout(() => { const btn = r.querySelector('.resBtn'); if (btn) btn.onclick = () => { SND.play('click'); closeRes(); }; }, 0);
    } else if (e.type === 'buy') {
      const c = CARDS[e.card];
      if (e.pid === me) { fxShow(`${cardHTML(e.card)}<div class="cap">카드 구매 완료! +${c.pts}점 · ${esc(c.name)}</div>`, 2300); SND.play('buy'); setTimeout(() => SND.play('score'), 700); }
      else { toast(`${nm(e.pid)} 학생이 ${c.name} 카드를 샀어요! (+${c.pts}점)`, 'info'); SND.play('notice'); }
    } else if (e.type === 'noble') {
      e.nobles.forEach((nid, i) => setTimeout(() => {
        fxShow(`<img class="nb" src="img/v2/bonus_${nid}.webp"><div class="cap">${e.pid === me ? '내가' : esc(nm(e.pid)) + ' 학생이'} 보너스 카드 획득! +${NOBLES[nid].pts}점</div>`, 2600);
        SND.play('noble');
      }, i * 2700));
    } else if (e.type === 'reserve') {
      if (e.pid === me) { toast(`${CARDS[e.card].name} 카드를 예약했어요!${e.wild ? ' 왕관 +1' : ''}`, 'good'); SND.play('reserve'); }
      else { toast(`${nm(e.pid)} 학생이 ${CARDS[e.card].name} 카드를 예약했어요.`, 'info'); SND.play('notice'); }
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
    document.querySelector('.gInfo').classList.toggle('warn', left < 60000);
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
  function renderEnd() {
    const g = S.game; const rk = g.ranking || [];
    $('podium').innerHTML = rk.map((r) => `<div class="pd r${r.rank}"><span class="rk">${r.rank}</span><img src="${AV(r.char)}"><b>${esc(r.name)}</b><span>${r.score}점</span></div>`).join('');
    $('endList').innerHTML = rk.map((r) => { const ps = g.ps[r.pid]; const cards = ps ? ps.cards.map((id) => `<img src="img/card2/${id}.webp" title="${esc(CARDS[id].name)}">`).join('') + r.nobles.map((n) => `<img src="img/v2/bonus_${n}.webp" title="${NOBLES[n].name}">`).join('') : '';
      return `<div class="er r${r.rank} ${r.pid === S.me.id ? 'me' : ''}"><span class="n">${r.rank}</span><img class="ava" src="${AV(r.char)}"><b>${esc(r.name)}</b><span class="pts">${r.score}점</span><small>카드 ${r.cards}장 · 정답 ${r.correct}/${r.attempts}</small><div class="erCards">${cards}</div></div>`; }).join('');
  }
  $('btnHome').onclick = () => { SND.play('click'); socket.emit('s:room', { op: 'lobby' }, () => { local = 'title'; nav('title'); }); };
  $('btnAgain').onclick = () => { SND.play('click'); socket.emit('s:room', { op: 'lobby' }, () => { local = 'app'; render(); }); };

  /* 도움말 탭 */
  $('helpTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; SND.play('click'); $('helpTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); document.querySelectorAll('.helpPane').forEach((p) => p.classList.toggle('on', p.id === b.dataset.t)); });

  /* 도감 */
  let bookCat = 'food';
  function renderBook() {
    $('bookTabs').innerHTML = CATS.map((k) => `<button class="${k === bookCat ? 'on' : ''}" data-bc="${k}">${CAT_INFO[k].ko} ${CAT_INFO[k].en}</button>`).join('');
    $('bookList').innerHTML = Object.values(CARDS).filter((c) => c.cat === bookCat).map((c) => `<div class="bk" data-say="${esc(c.name.replace(/\(.*\)/, ''))}. ${esc(c.desc)}">${cardHTML(c.id)}<small>🔊 ${esc(c.desc)}</small></div>`).join('');
  }
  $('bookTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-bc]'); if (b) { bookCat = b.dataset.bc; SND.play('pick'); renderBook(); } });
  $('bookList').addEventListener('click', (e) => { const b = e.target.closest('[data-say]'); if (b) SND.speak(b.dataset.say); });

  /* 소리·설정 */
  function gearUI() {
    $('vSfx').value = Math.round(SND.sv * 100); $('vBgm').value = Math.round(SND.bv * 100);
    $('tSfx').checked = SND.sfx; $('tBgm').checked = SND.bgm;
    $('btnSfx').classList.toggle('off', !SND.sfx); $('btnBgm').classList.toggle('off', !SND.bgm);
  }
  $('vSfx').oninput = () => SND.setVol('sv', $('vSfx').value / 100);
  $('vSfx').onchange = () => SND.play('click');
  $('vBgm').oninput = () => SND.setVol('bv', $('vBgm').value / 100);
  $('tSfx').onchange = () => { if ($('tSfx').checked !== SND.sfx) SND.toggleSfx(); gearUI(); SND.play('click'); };
  $('tBgm').onchange = () => { if ($('tBgm').checked !== SND.bgm) SND.toggleBgm(); gearUI(); };
  $('btnSfx').onclick = () => { SND.toggleSfx(); gearUI(); SND.play('click'); toast(SND.sfx ? '효과음 켜짐' : '효과음 꺼짐', 'info', 1200); };
  $('btnBgm').onclick = () => { SND.toggleBgm(); gearUI(); toast(SND.bgm ? '배경음악 켜짐' : '배경음악 꺼짐', 'info', 1200); };
  $('fsOn').onclick = () => { try { document.documentElement.requestFullscreen(); } catch {} };
  $('fsOff').onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); } catch {} };
  gearUI();

  // 새로고침 대비: 이전 접속 정보로 이어하기
  if (sess && sess.code && sess.name && sess.char) {
    local = 'title'; show('sTitle');
    socket.once('connect', async () => { const r = await doJoin(sess.code, sess.name, true); if (r && r.inGame) { local = 'app'; render(); } });
  } else show('sTitle');
})();
