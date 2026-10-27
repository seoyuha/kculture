/* 효과음(K-Culture Masters SFX 26종) · 배경음악 — 게임을 방해하지 않게 작은 소리로 */
(function () {
  // 이름: [파일 번호, 소리 크기]  (README 권장: 버튼 20~35%, 정답/자원 40~55%, 승리 60%)
  const MAP = {
    click: ['01', 0.28], pick: ['02', 0.3], press: ['03', 0.28],
    coin: ['04', 0.45], pay: ['05', 0.38], card: ['06', 0.32], buy: ['07', 0.5], reserve: ['08', 0.45], error: ['09', 0.35],
    correct: ['10', 0.5], wrong: ['11', 0.42], question: ['12', 0.42], tick: ['13', 0.38],
    turn: ['14', 0.45], turnEnd: ['15', 0.38], noble: ['16', 0.55], score: ['17', 0.45],
    start: ['18', 0.5], win: ['19', 0.6], end: ['20', 0.5], notice: ['21', 0.38],
    pause: ['22', 0.4], resume: ['23', 0.4], join: ['24', 0.42], offline: ['25', 0.4], assigned: ['26', 0.48],
  };
  let ctx = null, master = null, bgmGain = null, bgmTimer = null;
  const buf = {};
  const pref = (() => { try { return JSON.parse(localStorage.getItem('kc_snd') || '{}'); } catch { return {}; } })();
  const S = { sfx: pref.sfx !== false, bgm: !!pref.bgm, sv: pref.sv ?? 0.8, bv: pref.bv ?? 0.5 };
  const save = () => { try { localStorage.setItem('kc_snd', JSON.stringify(S)); } catch {} };
  function load(name) {
    const m = MAP[name]; if (!m || buf[m[0]] || !ctx) return;
    buf[m[0]] = 'loading';
    fetch(`sfx/s${m[0]}.mp3`).then((r) => r.arrayBuffer()).then((a) => new Promise((ok, no) => ctx.decodeAudioData(a, ok, no))).then((b) => (buf[m[0]] = b)).catch(() => delete buf[m[0]]);
  }
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain(); master.gain.value = S.sv * 1.1; master.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.gain.value = 0.24 * S.bv / Math.max(0.05, S.sv); bgmGain.connect(master);
    Object.keys(MAP).forEach(load);
    if (S.bgm) startBgm();
  }
  ['pointerdown', 'keydown'].forEach((e) => window.addEventListener(e, init, { passive: true }));
  function play(name) {
    if (!S.sfx) return; init(); if (!ctx) return;
    const m = MAP[name]; if (!m) return; const b = buf[m[0]];
    if (!b || b === 'loading') { load(name); return; }
    const src = ctx.createBufferSource(); const g = ctx.createGain(); g.gain.value = m[1];
    src.buffer = b; src.connect(g); g.connect(master); src.start();
  }
  // 잔잔한 국악풍(오음계) 배경음악 — 기본은 꺼짐
  function tone(f, t0, dur, type, vol, dest) {
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const scale = [62, 64, 67, 69, 71, 74, 76, 79];
  function startBgm() {
    if (!ctx || bgmTimer) return; let step = 0;
    bgmTimer = setInterval(() => {
      if (!S.bgm || !ctx) return; const t = ctx.currentTime + 0.05;
      if (step % 2 === 0 || Math.random() < 0.35) tone(N(scale[(Math.random() * scale.length) | 0]), t, 1.2, 'triangle', 0.22, bgmGain);
      if (step % 8 === 0) tone(N(50 + [0, 5, 7, 2][(step / 8) % 4 | 0]), t, 2.6, 'sine', 0.25, bgmGain);
      step++;
    }, 420);
  }
  function stopBgm() { clearInterval(bgmTimer); bgmTimer = null; }
  window.SND = {
    play: (k) => { try { play(k); } catch {} },
    get sfx() { return S.sfx; }, get bgm() { return S.bgm; }, get sv() { return S.sv; }, get bv() { return S.bv; },
    setVol(k, v) { S[k] = Math.max(0, Math.min(1, +v)); save(); if (master) { master.gain.value = S.sv * 1.1; bgmGain.gain.value = 0.24 * S.bv / Math.max(0.05, S.sv); } },
    toggleSfx() { S.sfx = !S.sfx; save(); return S.sfx; },
    toggleBgm() { init(); S.bgm = !S.bgm; save(); S.bgm ? startBgm() : stopBgm(); return S.bgm; },
    speak(text) {
      try {
        if (!('speechSynthesis' in window)) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(text).replace(/_{2,}/g, ' blank ').replace(/[A-Z]:\s/g, ''));
        u.lang = 'en-US'; u.rate = 0.88;
        const v = speechSynthesis.getVoices().find((x) => /en[-_]US/i.test(x.lang)); if (v) u.voice = v;
        speechSynthesis.speak(u);
      } catch {}
    },
  };
})();
