/* K-Culture Masters — 서버와 화면이 함께 쓰는 카드·자원 데이터
   카드 비용·점수·단계는 그래픽 패키지의 확정 규칙표(card_rules_30_types_60_copies.csv)와 같아요. */
(function (root) {
  const CATS = ['food', 'clothing', 'play', 'craft', 'heritage'];
  const CAT_INFO = {
    food: { ko: '음식', en: 'Food', s: '음', color: '#e2434b' },
    clothing: { ko: '의복', en: 'Clothing', s: '의', color: '#2f80e4' },
    play: { ko: '놀이', en: 'Play', s: '놀', color: '#f0a51f' },
    craft: { ko: '공예', en: 'Craft', s: '공', color: '#1fa067' },
    heritage: { ko: '문화유산', en: 'Heritage', s: '문', color: '#8c52dc' },
    wild: { ko: '황금', en: 'Gold', s: '황', color: '#d9a01c' },
  };
  // [id, 영어 이름, 분류, 단계, 점수, [음식, 의복, 놀이, 공예, 문화유산 비용], 한국어, 설명]
  const RAW = [
    ['bibimbap', 'Bibimbap', 'food', 1, 0, [0, 2, 1, 0, 0], '비빔밥', 'A famous Korean dish with rice, vegetables, and meat.'],
    ['kimchi', 'Kimchi', 'food', 1, 1, [0, 3, 2, 0, 0], '김치', 'A traditional Korean side dish made from fermented vegetables.'],
    ['songpyeon', 'Songpyeon', 'food', 2, 1, [0, 3, 2, 1, 0], '송편', 'A traditional rice cake eaten on Chuseok.'],
    ['tteokbokki', 'Tteokbokki', 'food', 2, 2, [0, 4, 3, 1, 0], '떡볶이', 'A popular Korean snack made with spicy rice cakes.'],
    ['bulgogi', 'Bulgogi', 'food', 3, 3, [0, 4, 3, 2, 0], '불고기', 'A Korean dish made from marinated beef.'],
    ['samgyeopsal', 'Samgyeopsal', 'food', 3, 4, [0, 5, 4, 2, 0], '삼겹살', 'Grilled pork is a popular Korean dish.'],
    ['hanbok', 'Hanbok', 'clothing', 1, 0, [0, 0, 2, 1, 0], '한복', 'A traditional Korean clothing worn on special days.'],
    ['gat', 'Gat', 'clothing', 1, 1, [0, 0, 3, 2, 0], '갓', 'A traditional Korean hat worn by men in the past.'],
    ['norigae', 'Norigae', 'clothing', 2, 1, [0, 0, 3, 2, 1], '노리개', 'A traditional ornament worn with hanbok.'],
    ['beoseon', 'Beoseon', 'clothing', 2, 2, [0, 0, 4, 3, 1], '버선', 'Traditional Korean socks worn with hanbok.'],
    ['durumagi', 'Durumagi', 'clothing', 3, 3, [0, 0, 4, 3, 2], '두루마기', 'A traditional Korean overcoat worn by men.'],
    ['jeogori', 'Jeogori', 'clothing', 3, 4, [0, 0, 5, 4, 2], '저고리', 'A short jacket worn with hanbok.'],
    ['yutnori', 'Yutnori', 'play', 1, 0, [0, 0, 0, 2, 1], '윷놀이', 'A traditional Korean game played with sticks.'],
    ['tuho', 'Tuho', 'play', 1, 1, [0, 0, 0, 3, 2], '투호', 'A traditional game of throwing arrows into a pot.'],
    ['jegichagi', 'Jegichagi', 'play', 2, 1, [1, 0, 0, 3, 2], '제기차기', 'A traditional game of kicking a shuttlecock with your foot.'],
    ['gonggi', 'Gongginori', 'play', 2, 2, [1, 0, 0, 4, 3], '공기놀이', 'A traditional game played with small stones.'],
    ['neolttwigi', 'Neolttwigi', 'play', 3, 3, [2, 0, 0, 4, 3], '널뛰기', 'A traditional seesaw game played together.'],
    ['kite', 'Kite (Yeon)', 'play', 3, 4, [2, 0, 0, 5, 4], '연', 'A traditional Korean kite flown in the sky.'],
    ['hanji', 'Hanji', 'craft', 1, 0, [1, 0, 0, 0, 2], '한지', 'Traditional Korean paper made from mulberry trees.'],
    ['celadon', 'Celadon', 'craft', 1, 1, [2, 0, 0, 0, 3], '청자', 'A traditional Korean ceramic with a beautiful blue-green color.'],
    ['lacquerware', 'Lacquerware', 'craft', 2, 1, [2, 1, 0, 0, 3], '나전칠기', 'Traditional Korean crafts with beautiful designs.'],
    ['fan', 'Fan (Buchae)', 'craft', 2, 2, [3, 1, 0, 0, 4], '부채', 'A traditional Korean fan used in summer.'],
    ['mask', 'Mask (Tal)', 'craft', 3, 3, [3, 2, 0, 0, 4], '탈', 'A traditional Korean mask used in performances.'],
    ['lantern', 'Lantern (Deung)', 'craft', 3, 4, [4, 2, 0, 0, 5], '등', 'A traditional Korean lantern used in festivals.'],
    ['gyeongbokgung', 'Gyeongbokgung Palace', 'heritage', 1, 0, [2, 1, 0, 0, 0], '경복궁', 'A famous royal palace in Seoul.'],
    ['namsantower', 'N Seoul Tower', 'heritage', 1, 1, [3, 2, 0, 0, 0], 'N서울타워', 'A famous tower in Seoul.'],
    ['sungnyemun', 'Sungnyemun Gate', 'heritage', 2, 1, [3, 2, 1, 0, 0], '숭례문', 'A historic gate in Seoul.'],
    ['seokguram', 'Seokguram Grotto', 'heritage', 2, 2, [4, 3, 1, 0, 0], '석굴암', 'A famous Buddhist temple in Gyeongju.'],
    ['hahoe', 'Hahoe Village', 'heritage', 3, 3, [4, 3, 2, 0, 0], '하회마을', 'A traditional Korean village in Andong.'],
    ['dolmen', 'Dolmen (Goindol)', 'heritage', 3, 4, [5, 4, 2, 0, 0], '고인돌', 'A prehistoric stone tomb in Korea.'],
  ];
  const CARDS = {};
  RAW.forEach(([id, name, cat, tier, pts, cv, ko, desc]) => {
    const cost = {}; CATS.forEach((k, i) => { if (cv[i]) cost[k] = cv[i]; });
    CARDS[id] = { id, name, cat, tier, pts, cost, ko, desc, no: 'KC-' + String(Object.keys(CARDS).length + 1).padStart(2, '0') };
  });
  const COPIES = 2; // 카드 1종류에 2장씩 → 60장
  // 그림 퀴즈 카드 — [카드id, 보기 4개, 정답 번호]
  const QUIZ = [
    ['bibimbap', ['Bibimbap', 'Kimchi', 'Tteokbokki', 'Samgyeopsal'], 0],
    ['kimchi', ['Bibimbap', 'Tteokbokki', 'Samgyeopsal', 'Kimchi'], 3],
    ['tteokbokki', ['Bibimbap', 'Kimchi', 'Tteokbokki', 'Samgyeopsal'], 2],
    ['samgyeopsal', ['Bibimbap', 'Samgyeopsal', 'Kimchi', 'Tteokbokki'], 1],
    ['bulgogi', ['Bulgogi', 'Bibimbap', 'Kimchi', 'Tteokbokki'], 0],
    ['songpyeon', ['Bibimbap', 'Kimchi', 'Tteokbokki', 'Songpyeon'], 3],
    ['hanbok', ['Gat', 'Jeogori', 'Hanbok', 'Norigae'], 2],
    ['gat', ['Hanbok', 'Gat', 'Jeogori', 'Norigae'], 1],
    ['jeogori', ['Jeogori', 'Hanbok', 'Gat', 'Norigae'], 0],
    ['norigae', ['Hanbok', 'Gat', 'Jeogori', 'Norigae'], 3],
    ['beoseon', ['Hanbok', 'Gat', 'Beoseon', 'Jeogori'], 2],
    ['durumagi', ['Hanbok', 'Durumagi', 'Gat', 'Jeogori'], 1],
    ['yutnori', ['Yutnori', 'Tuho', 'Jegichagi', 'Gonggi'], 0],
    ['tuho', ['Yutnori', 'Jegichagi', 'Gonggi', 'Tuho'], 3],
    ['jegichagi', ['Yutnori', 'Tuho', 'Jegichagi', 'Gonggi'], 2],
    ['gonggi', ['Yutnori', 'Gonggi', 'Tuho', 'Jegichagi'], 1],
    ['neolttwigi', ['Neolttwigi', 'Yutnori', 'Tuho', 'Jegichagi'], 0],
    ['kite', ['Yutnori', 'Tuho', 'Jegichagi', 'Kite (Yeon)'], 3],
    ['hanji', ['Celadon', 'Lacquerware', 'Hanji', 'Fan (Buchae)'], 2],
    ['celadon', ['Hanji', 'Celadon', 'Lacquerware', 'Fan (Buchae)'], 1],
    ['lacquerware', ['Lacquerware', 'Hanji', 'Celadon', 'Fan (Buchae)'], 0],
    ['fan', ['Hanji', 'Celadon', 'Lacquerware', 'Fan (Buchae)'], 3],
    ['mask', ['Hanji', 'Celadon', 'Mask (Tal)', 'Lacquerware'], 2],
    ['lantern', ['Hanji', 'Lantern (Deung)', 'Celadon', 'Lacquerware'], 1],
    ['gyeongbokgung', ['Gyeongbokgung Palace', 'N Seoul Tower', 'Sungnyemun Gate', 'Seokguram Grotto'], 0],
    ['namsantower', ['Gyeongbokgung Palace', 'Sungnyemun Gate', 'Seokguram Grotto', 'N Seoul Tower'], 3],
    ['sungnyemun', ['Gyeongbokgung Palace', 'N Seoul Tower', 'Sungnyemun Gate', 'Seokguram Grotto'], 2],
    ['seokguram', ['Gyeongbokgung Palace', 'Seokguram Grotto', 'N Seoul Tower', 'Sungnyemun Gate'], 1],
    ['hahoe', ['Hahoe Village', 'Gyeongbokgung Palace', 'N Seoul Tower', 'Sungnyemun Gate'], 0],
    ['dolmen', ['Gyeongbokgung Palace', 'N Seoul Tower', 'Sungnyemun Gate', 'Dolmen (Goindol)'], 3],
  ];
  // 보너스 카드 5종 — 구매한 카드(영구 할인) 종류별 3장씩 모으면 +3점
  const NOBLES = {
    king: { id: 'king', name: 'King', ko: '왕', pts: 3, need: { food: 3, clothing: 3, play: 3 } },
    queen: { id: 'queen', name: 'Queen', ko: '왕비', pts: 3, need: { clothing: 3, play: 3, craft: 3 } },
    scholar: { id: 'scholar', name: 'Scholar', ko: '학자', pts: 3, need: { play: 3, craft: 3, heritage: 3 } },
    artist: { id: 'artist', name: 'Artist', ko: '예술가', pts: 3, need: { food: 3, craft: 3, heritage: 3 } },
    traveler: { id: 'traveler', name: 'Traveler', ko: '여행가', pts: 3, need: { food: 3, clothing: 3, heritage: 3 } },
  };
  Object.values(NOBLES).forEach((n) => { n.rule = Object.keys(n.need).map((k) => `${CAT_INFO[k].ko} ${n.need[k]}`).join(' · '); });
  function catCounts(cardIds) {
    const n = { food: 0, clothing: 0, play: 0, craft: 0, heritage: 0 };
    (cardIds || []).forEach((id) => { if (CARDS[id]) n[CARDS[id].cat]++; });
    return n;
  }
  function nobleOk(nid, cardIds) {
    const n = catCounts(cardIds); const need = NOBLES[nid] && NOBLES[nid].need; if (!need) return false;
    return Object.keys(need).every((k) => n[k] >= need[k]);
  }
  // 영구 할인 적용 후 실제로 내야 하는 자원
  function effCost(cardId, ownedCards) {
    const c = CARDS[cardId]; const n = catCounts(ownedCards); const out = {};
    Object.keys(c.cost).forEach((k) => { const v = Math.max(0, c.cost[k] - n[k]); if (v) out[k] = v; });
    return out;
  }
  function payPlan(cardId, ownedCards, tokens) {
    const need = effCost(cardId, ownedCards); const pay = {}; let wildNeed = 0;
    Object.keys(need).forEach((k) => {
      const have = tokens[k] || 0; const use = Math.min(have, need[k]);
      if (use) pay[k] = use; wildNeed += need[k] - use;
    });
    if (wildNeed > (tokens.wild || 0)) return null;
    if (wildNeed) pay.wild = wildNeed;
    return pay;
  }
  // 모자란 자원 (황금으로도 못 채우는 만큼)
  function shortOf(cardId, ownedCards, tokens) {
    const need = effCost(cardId, ownedCards); const out = {}; let lack = 0;
    Object.keys(need).forEach((k) => { const d = need[k] - (tokens[k] || 0); if (d > 0) { out[k] = d; lack += d; } });
    let w = tokens.wild || 0;
    Object.keys(out).forEach((k) => { const u = Math.min(w, out[k]); out[k] -= u; w -= u; if (!out[k]) delete out[k]; });
    return out;
  }
  // 자원 가져오기 선택이 맞는지: 서로 다른 자원 1~3개(각 1개) 또는 같은 자원 2개(창고에 4개 이상일 때)
  // ret: 10개를 넘을 때 창고로 돌려줄 자원 (정답이면 바꿔요)
  function takeCheck(pick, bank, tokens, ret) {
    const keys = Object.keys(pick || {}).filter((k) => pick[k] > 0);
    if (!keys.length) return '자원을 골라 주세요.';
    if (keys.some((k) => !CATS.includes(k))) return '황금은 카드를 예약할 때만 받을 수 있어요.';
    const total = keys.reduce((a, k) => a + pick[k], 0);
    if (keys.length === 1 && pick[keys[0]] === 2) { if ((bank[keys[0]] || 0) < 4) return '같은 자원 2개는 창고에 4개 이상 있을 때만 가져올 수 있어요.'; }
    else if (keys.some((k) => pick[k] !== 1) || keys.length > 3) return '서로 다른 자원 3개 또는 같은 자원 2개를 골라요.';
    if (keys.some((k) => (bank[k] || 0) < pick[k])) return '창고에 남은 자원이 부족해요.';
    const held = Object.values(tokens || {}).reduce((a, b) => a + b, 0);
    let back = 0;
    for (const k of Object.keys(ret || {})) { const v = ret[k] || 0; if (!v) continue; if (!(k in (tokens || {})) || v < 0 || v > tokens[k]) return '돌려줄 자원이 맞지 않아요.'; if (pick[k]) return '가져올 자원과 같은 자원은 돌려줄 수 없어요.'; back += v; }
    if (held - back + total > 10) return `자원은 10개까지만 가질 수 있어요. ${held - back + total - 10}개를 돌려줄 자원으로 골라 주세요.`;
    return null;
  }
  const TEAM_NAMES = ['문화탐험대', '역사마스터', '수원여행', '전통문화왕', 'K-Explorer', '자유탐험대', '한글팀', '송편팀', '한옥팀', '윷놀이팀'];
  const CHARS = ['jiho', 'minseo', 'dohyeon', 'seoyeon', 'junho'];
  const CHAR_KO = { jiho: '지호', minseo: '민서', dohyeon: '도현', seoyeon: '서연', junho: '준호' };
  const TIERS = { 1: { ko: '1단계', sub: '기초', pts: '0~1점' }, 2: { ko: '2단계', sub: '중급', pts: '1~2점' }, 3: { ko: '3단계', sub: '고급', pts: '3~4점' } };
  const tierOf = (id) => (CARDS[id] ? CARDS[id].tier : 1);
  const api = { CATS, CAT_INFO, CARDS, COPIES, NOBLES, QUIZ, catCounts, nobleOk, effCost, payPlan, shortOf, takeCheck, TEAM_NAMES, CHARS, CHAR_KO, TIERS, tierOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KC = api;
})(typeof window !== 'undefined' ? window : globalThis);
