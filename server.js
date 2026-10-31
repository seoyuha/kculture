/* K-Culture Masters — 6학년 영어 11단원 스플렌더 게임 서버
   실행: npm install → npm start (기본 포트 3000)
   학생: http://주소/      교사: http://주소/teacher.html */
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const KC = require('./public/shared.js');
const DEFAULT_Q = require('./defaultQuestions.js');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '10m' }));
app.get('/health', (_, res) => res.send('ok'));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingInterval: 10000, pingTimeout: 20000 });

/* ---------------- 문제 은행 (파일에 저장) ---------------- */
const DATA_DIR = path.join(__dirname, 'data');
const Q_FILE = path.join(DATA_DIR, 'questions.json');
let QUESTIONS = [];
function loadQuestions() {
  try { const d = JSON.parse(fs.readFileSync(Q_FILE, 'utf8')); if (!d || d.v !== 2 || !Array.isArray(d.list) || !d.list.length) throw 0; QUESTIONS = d.list; }
  catch { QUESTIONS = JSON.parse(JSON.stringify(DEFAULT_Q)); }
}
function saveQuestions() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(Q_FILE, JSON.stringify({ v: 2, list: QUESTIONS }, null, 1)); } catch (e) { console.warn('문제 저장 실패', e.message); }
}
loadQuestions();
function cleanQuestion(q) {
  const cat = KC.CATS.includes(q.cat) ? q.cat : 'food';
  const choices = (q.choices || []).map((s) => String(s || '').trim().slice(0, 120)).filter(Boolean).slice(0, 4);
  if (choices.length < 2 || !String(q.q || '').trim()) return null;
  let answer = Math.max(0, Math.min(choices.length - 1, parseInt(q.answer, 10) || 0));
  return {
    id: q.id || 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    cat, kind: String(q.kind || '표현').slice(0, 10), q: String(q.q).slice(0, 300), ko: String(q.ko || '').slice(0, 100),
    img: KC.CARDS[q.img] ? q.img : undefined, choices, answer, exp: String(q.exp || '').slice(0, 200), on: q.on !== false,
  };
}

/* ---------------- 상태 ---------------- */
const classes = new Map(); // code -> cls
// fast: 수업용 빠른 진행 — 정답이면 고른 자원 ×mult, 자원·예약 뒤에 같은 차례에 카드 1장 더 살 수 있음
const DEFAULT_SETTINGS = { teamSize: 5, timeLimit: 10, target: 5, turnTime: 60, qTime: 25, allowRooms: true, hostStart: true, hints: 2, fast: true, mult: 2 };
const rid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clampName = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 12);
function newCode() { let c; do { c = String(1000 + Math.floor(Math.random() * 9000)); } while (classes.has(c)); return c; }

function makeClass() {
  const code = newCode();
  const cls = { code, teacherKey: rid() + rid(), createdAt: now(), settings: { ...DEFAULT_SETTINGS }, students: new Map(), rooms: new Map(), teamSeq: 0, history: [], paused: false, pausedAt: 0, gameNo: 1, lastActive: now() };
  classes.set(code, cls);
  return cls;
}
function roomOf(cls, st) { return st && st.roomId ? cls.rooms.get(st.roomId) : null; }
function newRoom(cls, by, hostId) {
  const num = ++cls.teamSeq;
  const room = { id: rid(), num, theme: (num - 1) % KC.TEAM_NAMES.length, name: `${num}번 방`, title: KC.TEAM_NAMES[(num - 1) % KC.TEAM_NAMES.length], max: 5, by, hostId: hostId || null, players: [], status: 'lobby', game: null, createdAt: now() };
  cls.rooms.set(room.id, room);
  return room;
}
function leaveRoom(cls, st) {
  const room = roomOf(cls, st); if (!room) { st.roomId = null; return; }
  if (room.status === 'playing') return; // 게임 중에는 빠질 수 없음 (재접속으로 이어하기)
  room.players = room.players.filter((p) => p !== st.id);
  st.roomId = null;
  if (room.hostId === st.id) room.hostId = room.players[0] || null;
  if (!room.players.length && room.by === 'student') cls.rooms.delete(room.id);
}
function joinRoom(cls, st, room) {
  if (st.roomId === room.id) return true;
  if (room.status !== 'lobby' || room.players.length >= (room.max || 5)) return false;
  leaveRoom(cls, st);
  if (st.roomId) return false;
  room.players.push(st.id); st.roomId = room.id;
  if (!room.hostId && room.by === 'student') room.hostId = st.id;
  return true;
}
// 팀 나누기: n명을 teamSize 기준으로 고르게 (차이 최대 1명)
function splitSizes(n, size) {
  if (n <= 0) return [];
  const k = Math.max(1, Math.ceil(n / size));
  const base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

/* ---------------- 게임 ---------------- */
// 규칙표: 일반 자원 5종 × 7개, 황금 5개 (2명 4개 · 3명 5개로 줄임)
function bankFor(n) { return n <= 2 ? 4 : n === 3 ? 5 : 7; }
function startGame(cls, room) {
  if (room.status !== 'lobby' || !room.players.length) return false;
  const order = shuffle(room.players);
  const decks = { 1: [], 2: [], 3: [] };
  shuffle(Object.keys(KC.CARDS).flatMap((id) => Array(KC.COPIES).fill(id))).forEach((id) => decks[KC.tierOf(id)].push(id));
  const tiers = {};
  [1, 2, 3].forEach((t) => { tiers[t] = []; for (let i = 0; i < 4; i++) tiers[t].push(drawCard(decks[t], tiers[t])); });
  const per = bankFor(order.length);
  const bank = { food: per, clothing: per, play: per, craft: per, heritage: per, wild: 5 };
  const ps = {};
  order.forEach((pid) => { ps[pid] = { tokens: { food: 0, clothing: 0, play: 0, craft: 0, heritage: 0, wild: 0 }, cards: [], reserved: [], nobles: [], score: 0, correct: 0, attempts: 0, streak: 0, turns: 0, hints: cls.settings.hints }; });
  const t = now();
  room.game = {
    order, turnIdx: 0, bank, tiers, decks, nobles: { king: null, queen: null, scholar: null, artist: null, traveler: null },
    ps, startAt: t, endAt: t + cls.settings.timeLimit * 60000, target: cls.settings.target, finalRound: false, finalBy: null,
    usedQ: {}, lastAnsPos: -1, log: [], ended: false, ranking: null, turn: null, round: 1, seq: 0, qstats: {},
  };
  room.status = 'playing';
  addLog(room, `게임 시작! 목표 ${cls.settings.target}점`);
  beginTurn(cls, room);
  emitRoom(cls, room, 'fx', { type: 'start' });
  return true;
}
function addLog(room, msg, type = 'info') {
  const g = room.game; if (!g) return;
  g.log.push({ t: now(), msg, type }); if (g.log.length > 80) g.log.shift();
}
const nameOf = (cls, id) => (cls.students.get(id) || {}).name || '?';
function beginTurn(cls, room) {
  const g = room.game; const pid = g.order[g.turnIdx];
  g.turn = { pid, done: false, bought: false, act: null, q: null, deadline: now() + cls.settings.turnTime * 1000, startedAt: now() };
  g.seq++;
  g.ps[pid].turns++;
}
function nextTurn(cls, room) {
  const g = room.game; if (!g || g.ended) return;
  const pid = g.turn && g.turn.pid;
  if (pid) checkNobles(cls, room, pid);
  if (g.ps[pid] && g.ps[pid].score >= g.target && !g.finalRound) {
    g.finalRound = true; g.finalBy = pid;
    addLog(room, `${nameOf(cls, pid)} 학생이 ${g.target}점 달성! 이번 바퀴가 마지막이에요.`, 'gold');
    emitRoom(cls, room, 'fx', { type: 'target', pid, target: g.target });
  }
  g.turnIdx = (g.turnIdx + 1) % g.order.length;
  if (g.turnIdx === 0) {
    g.round++;
    if (g.finalRound) return endGame(cls, room, 'target');
  }
  beginTurn(cls, room);
}
function checkNobles(cls, room, pid) {
  const g = room.game; const p = g.ps[pid]; const got = [];
  Object.keys(g.nobles).forEach((nid) => {
    if (!got.length && !g.nobles[nid] && KC.nobleOk(nid, p.cards)) {
      g.nobles[nid] = pid; p.nobles.push(nid); p.score += KC.NOBLES[nid].pts; got.push(nid);
      addLog(room, `${nameOf(cls, pid)} 학생이 ${KC.NOBLES[nid].name} 카드(+${KC.NOBLES[nid].pts}점)를 받았어요!`, 'gold');
    }
  });
  if (got.length) emitRoom(cls, room, 'fx', { type: 'noble', pid, nobles: got });
}
function endGame(cls, room, reason) {
  const g = room.game; if (!g || g.ended) return;
  g.ended = true; g.turn = null; room.status = 'ended';
  const rank = g.order.map((pid) => ({ pid, name: nameOf(cls, pid), char: (cls.students.get(pid) || {}).char, score: g.ps[pid].score, cards: g.ps[pid].cards.length, cardList: g.ps[pid].cards.slice(), tokens: { ...g.ps[pid].tokens }, correct: g.ps[pid].correct, attempts: g.ps[pid].attempts, nobles: g.ps[pid].nobles.slice() }))
    .sort((a, b) => b.score - a.score || a.cards - b.cards || b.correct - a.correct);
  rank.forEach((r, i) => { r.rank = i > 0 && rank[i - 1].score === r.score && rank[i - 1].cards === r.cards && rank[i - 1].correct === r.correct ? rank[i - 1].rank : i + 1; });
  g.tie = rank.length > 1 && rank[0].score === rank[1].score; // 점수가 같아 카드 수·정답 수로 정했는지
  g.ranking = rank; g.reason = reason; g.endedAt = now();
  addLog(room, reason === 'target' ? '게임 끝! 목표 점수에 도달했어요.' : reason === 'time' ? '게임 끝! 시간이 다 되었어요.' : '선생님이 게임을 마쳤어요.', 'gold');
  cls.history.push({ gameNo: cls.gameNo, room: `${room.name} ${room.title}`, roomNum: room.num, endedAt: g.endedAt, reason, ranking: rank, qstats: g.qstats, durationSec: Math.round((g.endedAt - g.startAt) / 1000) });
  emitRoom(cls, room, 'fx', { type: 'end' });
}
function pickQuestion(cls, room, cat) {
  const g = room.game; const pool = QUESTIONS.filter((q) => q.on !== false && q.cat === cat);
  const list = pool.length ? pool : QUESTIONS.filter((q) => q.on !== false);
  if (!list.length) return null;
  g.usedQ[cat] = g.usedQ[cat] || [];
  let fresh = list.filter((q) => !g.usedQ[cat].includes(q.id));
  if (!fresh.length) { g.usedQ[cat] = []; fresh = list; }
  const q = fresh[(Math.random() * fresh.length) | 0];
  g.usedQ[cat].push(q.id);
  // 보기 섞기 — 정답 위치가 바로 전과 같지 않게
  let order, pos, tries = 0;
  do { order = shuffle(q.choices.map((_, i) => i)); pos = order.indexOf(q.answer); tries++; } while (pos === g.lastAnsPos && tries < 12);
  g.lastAnsPos = pos;
  return { id: q.id, cat, kind: q.kind, text: q.q, ko: q.ko || '', img: q.img || null, choices: order.map((i) => q.choices[i]), answer: pos, exp: q.exp || '' };
}
function giveTokens(g, p, kind, want) {
  const room10 = Math.max(0, 10 - Object.values(p.tokens).reduce((a, b) => a + b, 0));
  const n = Math.min(want, g.bank[kind], room10);
  g.bank[kind] -= n; p.tokens[kind] += n;
  return { n, capped: room10 < want && room10 < g.bank[kind] + n };
}

const marketFlat = (g) => [1, 2, 3].flatMap((t) => g.tiers[t]).filter(Boolean);
const inMarket = (g, id) => marketFlat(g).includes(id);
// 더미에서 1장 — 같은 카드가 시장에 두 장 나란히 보이지 않게 (같은 종류는 2장씩 있어요)
function drawCard(deck, shown) {
  if (!deck.length) return null;
  let i = deck.findIndex((id) => !shown.includes(id)); if (i < 0) i = 0;
  return deck.splice(i, 1)[0];
}
function takeFromMarket(g, id) {
  const t = KC.tierOf(id); const i = g.tiers[t].indexOf(id);
  if (i >= 0) { g.tiers[t][i] = null; g.tiers[t][i] = drawCard(g.decks[t], g.tiers[t]); }
}
function handleAction(cls, st, a) {
  const room = roomOf(cls, st); if (!room || !room.game || room.status !== 'playing') return { err: '게임 중이 아니에요.' };
  if (cls.paused || room.paused) return { err: '선생님이 잠시 멈췄어요.' };
  const g = room.game; const t = g.turn; if (!t) return { err: '차례가 아니에요.' };
  if (t.pid !== st.id) return { err: '내 차례가 아니에요.' };
  const p = g.ps[st.id];
  const held = () => Object.values(p.tokens).reduce((x, y) => x + y, 0);
  const oneAction = () => (t.done ? '이번 차례에는 이미 행동했어요. 차례를 넘겨 주세요.' : t.q ? '문제를 푸는 중이에요.' : null);
  switch (a.type) {
    case 'take': { // 자원 고르기(서로 다른 3개 / 같은 2개) → 영어 문제
      const busy = oneAction(); if (busy) return { err: busy };
      const pick = {}; KC.CATS.forEach((k) => { const v = Math.floor(+((a.pick || {})[k]) || 0); if (v > 0) pick[k] = v; });
      const ret = {}; [...KC.CATS, 'wild'].forEach((k) => { const v = Math.floor(+((a.ret || {})[k]) || 0); if (v > 0) ret[k] = v; });
      const bad = KC.takeCheck(pick, g.bank, p.tokens, ret); if (bad) return { err: bad };
      const cats = Object.keys(pick);
      const q = pickQuestion(cls, room, cats[(Math.random() * cats.length) | 0]); if (!q) return { err: '문제가 없어요. 선생님께 알려 주세요.' };
      t.q = { ...q, pick, ret, deadline: now() + cls.settings.qTime * 1000, startedAt: now(), picked: null };
      t.act = 'take';
      t.deadline = Math.max(t.deadline, t.q.deadline + 15000);
      addLog(room, `${st.name} 학생이 ${cats.map((k) => KC.CAT_INFO[k].ko + (pick[k] > 1 ? ' ' + pick[k] + '개' : '')).join('·')} 자원에 도전! 영어 문제 풀이 시작`);
      return { ok: true };
    }
    case 'hint': {
      if (!t.q || t.q.picked !== null) return { err: '문제가 없어요.' };
      if (t.q.removed) return { err: '이 문제에는 이미 힌트를 썼어요.' };
      if (p.hints <= 0) return { err: '힌트를 다 썼어요.' };
      p.hints--;
      t.q.removed = shuffle(t.q.choices.map((_, i) => i).filter((i) => i !== t.q.answer)).slice(0, Math.max(0, t.q.choices.length - 2));
      addLog(room, `${st.name} 학생이 힌트를 썼어요.`);
      return { ok: true };
    }
    case 'answer': {
      if (!t.q || t.q.picked !== null) return { err: '문제가 없어요.' };
      resolveAnswer(cls, room, st.id, typeof a.choice === 'number' ? a.choice : -1);
      return { ok: true };
    }
    case 'reserve': {
      const busy = oneAction(); if (busy) return { err: busy };
      if (p.reserved.length >= 3) return { err: '예약은 3장까지만 할 수 있어요.' };
      if (!inMarket(g, a.card)) return { err: '시장에 없는 카드예요.' };
      p.reserved.push(a.card);
      takeFromMarket(g, a.card);
      let wild = 0;
      if (g.bank.wild > 0 && held() < 10) { g.bank.wild--; p.tokens.wild++; wild = 1; }
      t.done = true; t.act = 'reserve';
      addLog(room, `${st.name} 학생이 ${KC.CARDS[a.card].name} 카드를 예약했어요.${wild ? ' (황금 +1)' : ''}`, 'rsv');
      emitRoom(cls, room, 'fx', { type: 'reserve', pid: st.id, card: a.card, wild });
      if (!canBuyMore(cls, g, st.id)) autoEnd(cls, room, 4500);
      return { ok: true };
    }
    case 'buy': {
      if (t.q) return { err: '문제를 먼저 풀어 주세요.' };
      if (t.bought) return { err: '카드는 한 차례에 한 장만 살 수 있어요.' };
      if (t.done && !cls.settings.fast) return { err: '이번 차례에는 이미 행동했어요. 차례를 넘겨 주세요.' };
      const ri = p.reserved.indexOf(a.card); const fromRes = ri >= 0;
      if (!fromRes && !inMarket(g, a.card)) return { err: '살 수 없는 카드예요.' };
      const pay = KC.payPlan(a.card, p.cards, p.tokens); if (!pay) return { err: '보유한 자원이 부족합니다.', short: KC.shortOf(a.card, p.cards, p.tokens) };
      Object.keys(pay).forEach((k) => { p.tokens[k] -= pay[k]; g.bank[k] += pay[k]; });
      if (fromRes) p.reserved.splice(ri, 1);
      else takeFromMarket(g, a.card);
      p.cards.push(a.card); p.score += KC.CARDS[a.card].pts; t.bought = true; if (!t.done) t.act = 'buy'; t.done = true;
      addLog(room, `${st.name} 학생이 ${KC.CARDS[a.card].name} 카드 구매 완료! (+${KC.CARDS[a.card].pts}점)`, 'buy');
      emitRoom(cls, room, 'fx', { type: 'buy', pid: st.id, card: a.card, pay });
      autoEnd(cls, room, 4500);
      return { ok: true };
    }
    case 'end': {
      if (t.q) return { err: '문제를 먼저 풀어 주세요.' };
      if (!t.done) addLog(room, `${st.name} 학생이 차례를 넘겼어요.`);
      nextTurn(cls, room); return { ok: true };
    }
  }
  return { err: '알 수 없는 행동' };
}
// 빠른 진행: 행동 뒤에 살 수 있는 카드가 남아 있는지
function canBuyMore(cls, g, pid) {
  if (!cls.settings.fast || g.turn.bought) return false; const p = g.ps[pid];
  return [...marketFlat(g), ...p.reserved].some((id) => KC.payPlan(id, p.cards, p.tokens));
}
function autoEnd(cls, room, ms) {
  const g = room.game; const t = g && g.turn;
  if (t && t.done && !t.q) { t.autoEndAt = now() + ms; }
}
function resolveAnswer(cls, room, pid, choice) {
  const g = room.game; const t = g.turn; const q = t.q; const p = g.ps[pid];
  q.picked = choice; p.attempts++;
  const ok = choice === q.answer;
  const qs = (g.qstats[q.id] = g.qstats[q.id] || { text: q.text, img: q.img || null, cat: q.cat, n: 0, ok: 0 }); qs.n++; if (ok) qs.ok++;
  const got = {}; let gotN = 0;
  if (ok) {
    p.correct++; p.streak++;
    Object.keys(q.ret || {}).forEach((k) => { const n = Math.min(q.ret[k], p.tokens[k]); p.tokens[k] -= n; g.bank[k] += n; });
    Object.keys(q.pick).forEach((k) => {
      const room10 = Math.max(0, 10 - Object.values(p.tokens).reduce((a, b) => a + b, 0));
      const n = Math.min(q.pick[k] * (cls.settings.fast ? Math.max(1, cls.settings.mult || 1) : 1), g.bank[k], room10);
      if (n > 0) { g.bank[k] -= n; p.tokens[k] += n; got[k] = n; gotN += n; }
    });
    addLog(room, `${nameOf(cls, pid)} 정답! ${Object.keys(got).map((k) => KC.CAT_INFO[k].ko + ' ' + got[k]).join(' · ')} 획득`, 'ok');
  } else {
    p.streak = 0;
    addLog(room, `${nameOf(cls, pid)} ${choice < 0 ? '시간 초과' : '오답'} — 정답은 "${q.choices[q.answer]}"`, 'bad');
  }
  const result = { type: 'answer', pid, ok, picked: choice, answer: q.answer, ansText: q.choices[q.answer], cat: q.cat, got, gotN, pick: q.pick, ret: ok ? q.ret || {} : {}, exp: q.exp, qid: q.id };
  t.lastQ = { ...q, ok, got, at: now() };
  t.q = null; t.done = true;
  t.deadline = Math.max(t.deadline, now() + 20000);
  emitRoom(cls, room, 'fx', result);
  if (!canBuyMore(cls, g, pid)) autoEnd(cls, room, 7000); else t.deadline = Math.max(t.deadline, now() + 30000);
}

/* ---------------- 상태 보내기 ---------------- */
function publicGame(cls, room, forPid, forTeacher) {
  const g = room.game; if (!g) return null;
  const t = g.turn;
  let q = null;
  if (t && t.q) q = { cat: t.q.cat, kind: t.q.kind, text: t.q.text, ko: t.q.ko, img: t.q.img, choices: t.q.choices, pick: t.q.pick, ret: t.q.ret, deadline: t.q.deadline, startedAt: t.q.startedAt, removed: t.q.removed || null };
  return {
    order: g.order, bank: g.bank, tiers: g.tiers, market: marketFlat(g), deckCounts: { 1: g.decks[1].length, 2: g.decks[2].length, 3: g.decks[3].length }, deckCount: g.decks[1].length + g.decks[2].length + g.decks[3].length, nobles: g.nobles, target: g.target,
    startAt: g.startAt, endAt: g.endAt, finalRound: g.finalRound, round: g.round, ended: g.ended, ranking: g.ranking, seq: g.seq,
    turn: t ? { pid: t.pid, done: t.done, bought: t.bought, act: t.act, deadline: t.deadline, startedAt: t.startedAt, q, lastQ: t.lastQ ? { text: t.lastQ.text, img: t.lastQ.img, choices: t.lastQ.choices, answer: t.lastQ.answer, picked: t.lastQ.picked, ok: t.lastQ.ok, exp: t.lastQ.exp, cat: t.lastQ.cat, got: t.lastQ.got, at: t.lastQ.at } : null } : null,
    tie: !!g.tie, finalBy: g.finalBy, reason: g.reason || null,
    ps: Object.fromEntries(g.order.map((pid) => { const p = g.ps[pid]; const s = cls.students.get(pid) || {}; return [pid, { name: s.name, char: s.char, online: !!s.online, tokens: p.tokens, cards: p.cards, reserved: p.reserved, nobles: p.nobles, score: p.score, correct: p.correct, attempts: p.attempts, streak: p.streak, hints: p.hints }]; })),
    log: forTeacher ? g.log.slice(-40) : g.log.slice(-12),
  };
}
function roomBrief(cls, room) {
  return { id: room.id, num: room.num, name: room.name, title: room.title, max: room.max || 5, paused: !!room.paused, theme: room.theme, by: room.by, hostId: room.hostId, status: room.status, players: room.players.map((id) => { const s = cls.students.get(id) || {}; return { id, name: s.name, char: s.char, online: !!s.online }; }) };
}
function studentState(cls, st) {
  const room = roomOf(cls, st);
  return {
    code: cls.code, me: { id: st.id, name: st.name, char: st.char, roomId: st.roomId }, settings: cls.settings, paused: cls.paused || !!(roomOf(cls, st) && roomOf(cls, st).paused), now: now(),
    rooms: cls.settings.allowRooms ? [...cls.rooms.values()].filter((r) => r.status === 'lobby').map((r) => roomBrief(cls, r)) : [],
    room: room ? roomBrief(cls, room) : null,
    game: room && room.game ? publicGame(cls, room, st.id) : null,
  };
}
function teacherState(cls) {
  const studs = [...cls.students.values()].map((s) => ({ id: s.id, name: s.name, char: s.char, online: !!s.online, roomId: s.roomId, joinedAt: s.joinedAt }));
  return {
    code: cls.code, settings: cls.settings, paused: cls.paused, now: now(), gameNo: cls.gameNo,
    students: studs,
    rooms: [...cls.rooms.values()].sort((a, b) => a.num - b.num).map((r) => ({ ...roomBrief(cls, r), game: r.game ? publicGame(cls, r, null, true) : null, curQ: r.game && r.game.turn && r.game.turn.q ? { text: r.game.turn.q.text, choices: r.game.turn.q.choices, answer: r.game.turn.q.answer, img: r.game.turn.q.img, cat: r.game.turn.q.cat } : null })),
    history: cls.history,
  };
}
const dirty = new Set();
function touch(cls) { dirty.add(cls.code); cls.lastActive = now(); }
function emitRoom(cls, room, ev, data) { room.players.forEach((pid) => { const s = cls.students.get(pid); if (s && s.socketId) io.to(s.socketId).emit(ev, data); }); io.to('T:' + cls.code).emit('tfx', { room: room.id, ...data }); touch(cls); }
function flush() {
  dirty.forEach((code) => {
    const cls = classes.get(code); if (!cls) return;
    cls.students.forEach((st) => { if (st.socketId) io.to(st.socketId).emit('state', studentState(cls, st)); });
    io.to('T:' + code).emit('tstate', teacherState(cls));
  });
  dirty.clear();
}
setInterval(flush, 120);

/* ---------------- 시간 관리 ---------------- */
setInterval(() => {
  const t = now();
  classes.forEach((cls) => {
    if (cls.paused) return;
    cls.rooms.forEach((room) => {
      const g = room.game; if (!g || room.status !== 'playing' || room.paused) return;
      if (t >= g.endAt) { endGame(cls, room, 'time'); touch(cls); return; }
      const tr = g.turn; if (!tr) return;
      const st = cls.students.get(tr.pid);
      if (tr.q && t >= tr.q.deadline) { resolveAnswer(cls, room, tr.pid, -1); touch(cls); return; }
      if (tr.autoEndAt && t >= tr.autoEndAt && !tr.q) { nextTurn(cls, room); touch(cls); return; }
      const offline = !st || !st.online;
      if ((offline && t - tr.startedAt > 8000 && !tr.q) || t >= tr.deadline) {
        if (tr.q) resolveAnswer(cls, room, tr.pid, -1);
        addLog(room, `${nameOf(cls, tr.pid)} 학생의 차례 시간이 끝났어요.`);
        nextTurn(cls, room); touch(cls);
      }
    });
  });
  // 오래된 수업 정리 (8시간)
  classes.forEach((cls, code) => { if (t - cls.lastActive > 8 * 3600e3) classes.delete(code); });
}, 400);

/* ---------------- 소켓 ---------------- */
io.on('connection', (sock) => {
  let cls = null, st = null, isTeacher = false;
  const ack = (cb, v) => { if (typeof cb === 'function') cb(v); };

  // ===== 교사 =====
  sock.on('t:create', (_, cb) => {
    cls = makeClass(); isTeacher = true; sock.join('T:' + cls.code);
    ack(cb, { ok: true, code: cls.code, key: cls.teacherKey }); touch(cls);
  });
  sock.on('t:resume', ({ code, key } = {}, cb) => {
    const c = classes.get(String(code)); if (!c || c.teacherKey !== key) return ack(cb, { err: '이전 수업을 찾을 수 없어요.' });
    cls = c; isTeacher = true; sock.join('T:' + c.code); ack(cb, { ok: true, code: c.code, key: c.teacherKey }); touch(c);
  });
  sock.on('t:cmd', (m = {}, cb) => {
    if (!isTeacher || !cls) return ack(cb, { err: '교사 권한이 없어요.' });
    const r = teacherCmd(cls, m); touch(cls); ack(cb, r || { ok: true });
  });
  sock.on('t:questions', (m = {}, cb) => {
    if (!isTeacher) return ack(cb, { err: '교사 권한이 없어요.' });
    if (m.op === 'list') return ack(cb, { ok: true, list: QUESTIONS });
    if (m.op === 'save') { const q = cleanQuestion(m.q || {}); if (!q) return ack(cb, { err: '문제와 보기(2개 이상)를 입력해 주세요.' }); const i = QUESTIONS.findIndex((x) => x.id === q.id); if (i >= 0) QUESTIONS[i] = q; else QUESTIONS.push(q); saveQuestions(); return ack(cb, { ok: true, q }); }
    if (m.op === 'delete') { QUESTIONS = QUESTIONS.filter((x) => !(m.ids || []).includes(x.id)); saveQuestions(); return ack(cb, { ok: true }); }
    if (m.op === 'toggle') { QUESTIONS.forEach((x) => { if ((m.ids || []).includes(x.id)) x.on = !!m.on; }); saveQuestions(); return ack(cb, { ok: true }); }
    if (m.op === 'reset') { QUESTIONS = JSON.parse(JSON.stringify(DEFAULT_Q)); saveQuestions(); return ack(cb, { ok: true }); }
    if (m.op === 'import') { const list = (m.list || []).map(cleanQuestion).filter(Boolean); if (!list.length) return ack(cb, { err: '불러올 문제가 없어요.' }); if (m.replace) QUESTIONS = list; else list.forEach((q) => { q.id = 'u' + rid(); QUESTIONS.push(q); }); saveQuestions(); return ack(cb, { ok: true, count: list.length }); }
    ack(cb, { err: '?' });
  });

  // ===== 학생 =====
  sock.on('s:join', ({ code, name, token } = {}, cb) => {
    const c = classes.get(String(code || '').trim());
    if (!c) return ack(cb, { err: '방 코드를 다시 확인해 주세요.' });
    name = clampName(name); if (!name) return ack(cb, { err: '이름을 입력해 주세요.' });
    let s = [...c.students.values()].find((x) => x.name === name);
    if (s) {
      if (s.token !== token && s.online) return ack(cb, { err: '같은 이름의 친구가 이미 들어와 있어요. 다른 이름을 써 주세요.' });
      s.token = token || s.token;
    } else {
      s = { id: rid(), name, char: null, token: token || rid(), roomId: null, online: false, socketId: null, joinedAt: now() };
      c.students.set(s.id, s);
    }
    if (s.socketId && s.socketId !== sock.id) { const old = io.sockets.sockets.get(s.socketId); if (old) old.emit('kicked', '다른 기기에서 접속했어요.'); }
    s.socketId = sock.id; s.online = true; s.lastSeen = now();
    cls = c; st = s;
    ack(cb, { ok: true, token: s.token, id: s.id, char: s.char, inGame: !!(roomOf(c, s) && roomOf(c, s).status !== 'lobby') });
    touch(c);
  });
  sock.on('s:char', ({ char } = {}, cb) => { if (!st) return ack(cb, { err: '먼저 입장해 주세요.' }); st.char = KC.CHARS.includes(char) ? char : 'jiho'; touch(cls); ack(cb, { ok: true }); });
  sock.on('s:room', (m = {}, cb) => {
    if (!st) return ack(cb, { err: '먼저 입장해 주세요.' });
    const cur = roomOf(cls, st);
    if (m.op === 'create') {
      if (!cls.settings.allowRooms) return ack(cb, { err: '선생님이 방 만들기를 꺼 두었어요.' });
      if (cur && cur.status !== 'lobby') return ack(cb, { err: '게임 중에는 바꿀 수 없어요.' });
      leaveRoom(cls, st); const r = newRoom(cls, 'student', st.id);
      const t = clampName(m.title); if (t) r.title = t; r.max = +m.max === 4 ? 4 : 5;
      joinRoom(cls, st, r); touch(cls); return ack(cb, { ok: true });
    }
    if (m.op === 'join') {
      if (!cls.settings.allowRooms) return ack(cb, { err: '선생님이 방 이동을 꺼 두었어요.' });
      const r = cls.rooms.get(m.id); if (!r) return ack(cb, { err: '방이 없어졌어요.' });
      if (r.players.length >= (r.max || 5)) return ack(cb, { err: `방이 가득 찼어요. (최대 ${r.max || 5}명)` });
      if (!joinRoom(cls, st, r)) return ack(cb, { err: '들어갈 수 없는 방이에요.' });
      touch(cls); return ack(cb, { ok: true });
    }
    if (m.op === 'leave') {
      if (cur && cur.status === 'playing') return ack(cb, { err: '게임 중에는 나갈 수 없어요.' });
      if (cur && cur.by === 'teacher' && !cls.settings.allowRooms) return ack(cb, { err: '선생님이 배정한 팀이에요.' });
      leaveRoom(cls, st); touch(cls); return ack(cb, { ok: true });
    }
    if (m.op === 'start') {
      if (!cur || cur.status !== 'lobby') return ack(cb, { err: '시작할 방이 없어요.' });
      if (!cls.settings.hostStart) return ack(cb, { err: '선생님이 시작해 주실 거예요.' });
      if (cur.hostId !== st.id) return ack(cb, { err: '방장만 시작할 수 있어요.' });
      if (cur.players.length < 2) return ack(cb, { err: '2명 이상 모이면 시작할 수 있어요.' });
      startGame(cls, cur); touch(cls); return ack(cb, { ok: true });
    }
    if (m.op === 'lobby') { // 게임이 끝난 뒤 대기실로
      if (cur && cur.status === 'ended') { cur.players = cur.players.filter((p) => p !== st.id); st.roomId = null; if (!cur.players.length) cls.rooms.delete(cur.id); }
      touch(cls); return ack(cb, { ok: true });
    }
    ack(cb, { err: '?' });
  });
  sock.on('s:act', (a = {}, cb) => { if (!st) return ack(cb, { err: '먼저 입장해 주세요.' }); const r = handleAction(cls, st, a); touch(cls); ack(cb, r); });
  sock.on('s:emote', (m = {}) => { if (!st) return; const room = roomOf(cls, st); if (room) emitRoom(cls, room, 'emote', { pid: st.id, e: String(m.e || '').slice(0, 4) }); });
  sock.on('disconnect', () => {
    if (st && st.socketId === sock.id) { st.online = false; st.socketId = null; st.lastSeen = now(); touch(cls); }
  });
});

function shiftRoom(r, d) {
  const g = r.game; if (!g) return; g.endAt += d;
  if (g.turn) { g.turn.deadline += d; g.turn.startedAt += d; if (g.turn.q) g.turn.q.deadline += d; if (g.turn.autoEndAt) g.turn.autoEndAt += d; }
}
function teacherCmd(cls, m) {
  const S = cls.settings;
  switch (m.op) {
    case 'settings': {
      const v = m.settings || {};
      if (v.teamSize) S.teamSize = Math.max(2, Math.min(5, +v.teamSize));
      if (v.timeLimit) S.timeLimit = Math.max(3, Math.min(60, +v.timeLimit));
      if (v.target) S.target = Math.max(3, Math.min(40, +v.target));
      if (v.turnTime) S.turnTime = Math.max(20, Math.min(180, +v.turnTime));
      if (v.qTime) S.qTime = Math.max(10, Math.min(90, +v.qTime));
      if ('allowRooms' in v) S.allowRooms = !!v.allowRooms;
      if ('hostStart' in v) S.hostStart = !!v.hostStart;
      if ('hints' in v) S.hints = Math.max(0, Math.min(5, +v.hints || 0));
      if ('fast' in v) S.fast = !!v.fast;
      if ('mult' in v) S.mult = Math.max(1, Math.min(3, +v.mult || 1));
      return { ok: true };
    }
    case 'autoAssign': { // 아직 팀이 없는 학생(또는 전체 대기 학생)을 팀으로 나누기
      const all = !!m.all;
      if (all) { [...cls.rooms.values()].filter((r) => r.status === 'lobby').forEach((r) => { r.players.forEach((pid) => { const s = cls.students.get(pid); if (s) s.roomId = null; }); cls.rooms.delete(r.id); }); }
      const free = shuffle([...cls.students.values()].filter((s) => !s.roomId && (s.online || m.includeOffline)));
      if (!free.length) return { err: '배정할 학생이 없어요.' };
      const sizes = splitSizes(free.length, S.teamSize);
      let i = 0;
      cls.teamSeq = [...cls.rooms.values()].reduce((a, r) => Math.max(a, r.num), 0);
      sizes.forEach((sz) => { const room = newRoom(cls, 'teacher'); for (let k = 0; k < sz; k++) { const s = free[i++]; room.players.push(s.id); s.roomId = room.id; } });
      return { ok: true, teams: sizes.length };
    }
    case 'resetAssign': {
      [...cls.rooms.values()].filter((r) => r.status === 'lobby').forEach((r) => { r.players.forEach((pid) => { const s = cls.students.get(pid); if (s) s.roomId = null; }); cls.rooms.delete(r.id); });
      cls.teamSeq = [...cls.rooms.values()].reduce((a, r) => Math.max(a, r.num), 0);
      return { ok: true };
    }
    case 'move': { // 학생을 다른 팀으로
      const s = cls.students.get(m.sid); if (!s) return { err: '학생을 찾을 수 없어요.' };
      const cur = roomOf(cls, s); if (cur && cur.status === 'playing') return { err: '게임 중인 학생은 옮길 수 없어요.' };
      if (m.to === 'new') { leaveRoom(cls, s); const r = newRoom(cls, 'teacher'); r.players.push(s.id); s.roomId = r.id; return { ok: true }; }
      if (!m.to) { leaveRoom(cls, s); return { ok: true }; }
      const r = cls.rooms.get(m.to); if (!r) return { err: '팀이 없어요.' };
      if (r.status !== 'lobby') return { err: '이미 시작한 팀이에요.' };
      if (r.players.length >= 5) return { err: '한 팀은 5명까지예요.' };
      leaveRoom(cls, s); r.players.push(s.id); s.roomId = r.id; return { ok: true };
    }
    case 'addTeam': { newRoom(cls, 'teacher'); return { ok: true }; }
    case 'rename': { const r = cls.rooms.get(m.id); if (!r) return { err: '방이 없어요.' }; const t = String(m.title || '').replace(/[<>]/g, '').trim().slice(0, 14); if (!t) return { err: '방 이름을 입력해 주세요.' }; r.title = t; return { ok: true }; }
    case 'resetRoom': { const r = cls.rooms.get(m.id); if (!r) return { err: '방이 없어요.' }; if (r.status === 'playing') endGame(cls, r, 'teacher'); r.status = 'lobby'; r.game = null; r.players = r.players.filter((pid) => cls.students.has(pid)); return { ok: true }; }
    case 'deleteRoom': {
      const r = cls.rooms.get(m.id); if (!r) return { err: '팀이 없어요.' };
      r.players.forEach((pid) => { const s = cls.students.get(pid); if (s) s.roomId = null; }); cls.rooms.delete(r.id); return { ok: true };
    }
    case 'kick': { const s = cls.students.get(m.sid); if (!s) return { err: '?' }; const cur = roomOf(cls, s); if (cur && cur.status === 'playing') return { err: '게임 중인 학생은 내보낼 수 없어요.' }; leaveRoom(cls, s); if (s.socketId) { const so = io.sockets.sockets.get(s.socketId); if (so) so.emit('kicked', '선생님이 대기실에서 내보냈어요.'); } cls.students.delete(s.id); return { ok: true }; }
    case 'startAll': {
      let n = 0; const want = m.id ? [cls.rooms.get(m.id)].filter(Boolean) : [...cls.rooms.values()];
      want.forEach((r) => { if (r.status === 'lobby' && r.players.length >= 1) { if (startGame(cls, r)) n++; } });
      return n ? { ok: true, started: n } : { err: '시작할 팀이 없어요. 먼저 학생을 팀에 배정해 주세요.' };
    }
    case 'pauseRoom': {
      const r = cls.rooms.get(m.id); if (!r || r.status !== 'playing') return { err: '진행 중인 방이 아니에요.' };
      if (m.on && !r.paused) { r.paused = true; r.pausedAt = now(); }
      else if (!m.on && r.paused) { shiftRoom(r, now() - r.pausedAt); r.paused = false; }
      return { ok: true };
    }
    case 'setAssign': { // 교사가 미리 본 배정 결과 적용 {groups:[{title, ids:[]}], reset}
      if (m.reset) { [...cls.rooms.values()].filter((r) => r.status === 'lobby').forEach((r) => { r.players.forEach((pid) => { const s = cls.students.get(pid); if (s) s.roomId = null; }); cls.rooms.delete(r.id); }); }
      cls.teamSeq = [...cls.rooms.values()].reduce((a, r) => Math.max(a, r.num), 0);
      let n = 0;
      (m.groups || []).forEach((gr) => {
        const ids = (gr.ids || []).filter((id) => { const s = cls.students.get(id); const cur = s && roomOf(cls, s); return s && !(cur && cur.status === 'playing'); });
        if (!ids.length) return;
        const room = newRoom(cls, 'teacher'); if (gr.title) room.title = String(gr.title).slice(0, 14);
        ids.slice(0, 5).forEach((id) => { const s = cls.students.get(id); leaveRoom(cls, s); room.players.push(id); s.roomId = room.id; });
        n++;
      });
      [...cls.rooms.values()].forEach((r) => { if (r.status === 'lobby' && !r.players.length && r.by === 'student') cls.rooms.delete(r.id); });
      return { ok: true, teams: n };
    }
    case 'pause': {
      if (m.on && !cls.paused) { cls.paused = true; cls.pausedAt = now(); }
      else if (!m.on && cls.paused) {
        const d = now() - cls.pausedAt; cls.paused = false;
        cls.rooms.forEach((r) => { if (r.status === 'playing' && !r.paused) shiftRoom(r, d); });
      }
      return { ok: true };
    }
    case 'extend': { // 게임 시간 늘리기: sec(초) 또는 min(분), id가 있으면 그 방만
      const add = m.sec ? Math.max(10, Math.min(1800, +m.sec)) * 1000 : (+m.min || 5) * 60000; let n = 0;
      const lbl = add >= 60000 ? add / 60000 + '분' : add / 1000 + '초';
      cls.rooms.forEach((r) => { if (r.game && r.status === 'playing' && (!m.id || r.id === m.id)) { r.game.endAt += add; if (r.game.turn) r.game.turn.deadline += Math.min(add, 60000); n++; addLog(r, `선생님이 게임 시간을 ${lbl} 늘렸어요.`, 'gold'); emitRoom(cls, r, 'tmsg', { text: `⏰ 게임 시간이 ${lbl} 늘어났어요!` }); } });
      return n ? { ok: true } : { err: '진행 중인 게임이 없어요.' };
    }
    case 'msg': { // 교사 메시지: sid(학생 1명) · id(방 전체) · 없으면 전체
      const text = String(m.text || '').replace(/[<>]/g, '').trim().slice(0, 60); if (!text) return { err: '메시지를 입력해 주세요.' };
      const targets = m.sid ? [m.sid] : m.id ? ((cls.rooms.get(m.id) || {}).players || []) : [...cls.students.keys()];
      let n = 0; targets.forEach((pid) => { const s = cls.students.get(pid); if (s && s.socketId) { io.to(s.socketId).emit('tmsg', { text, from: 'teacher' }); n++; } });
      return n ? { ok: true, sent: n } : { err: '받을 수 있는 학생이 없어요. (접속 확인)' };
    }

    case 'endAll': { const want = m.id ? [cls.rooms.get(m.id)].filter(Boolean) : [...cls.rooms.values()]; want.forEach((r) => { if (r.status === 'playing') endGame(cls, r, 'teacher'); }); return { ok: true }; }
    case 'skipTurn': { const r = cls.rooms.get(m.id); if (r && r.game && r.status === 'playing' && r.game.turn) { if (r.game.turn.q) resolveAnswer(cls, r, r.game.turn.pid, -1); nextTurn(cls, r); } return { ok: true }; }
    case 'newRound': { // 끝난 게임 정리 → 모두 대기실로 (같은 팀 유지 옵션)
      const keep = !!m.keep;
      [...cls.rooms.values()].forEach((r) => {
        if (r.status === 'ended' || (r.status === 'playing' && m.force)) {
          if (r.status === 'playing') endGame(cls, r, 'teacher');
          if (keep) { r.status = 'lobby'; r.game = null; r.players = r.players.filter((pid) => cls.students.has(pid)); }
          else { r.players.forEach((pid) => { const s = cls.students.get(pid); if (s) s.roomId = null; }); cls.rooms.delete(r.id); }
        }
      });
      if (!cls.rooms.size) cls.teamSeq = 0;
      cls.gameNo++;
      return { ok: true };
    }
    case 'clearHistory': cls.history = []; return { ok: true };
  }
  return { err: '알 수 없는 명령' };
}

server.listen(PORT, () => console.log(`K-Culture Masters 서버 실행 중: http://localhost:${PORT}  (교사: /teacher.html)`));
