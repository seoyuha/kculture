/* K-Culture Masters — 서버와 화면이 함께 쓰는 카드·자원 데이터 */
(function (root) {
  const CATS = ['food', 'clothing', 'play', 'craft', 'heritage'];
  const CAT_INFO = {
    food: { ko: '음식', en: 'Food', color: '#e23a3a' },
    clothing: { ko: '의복', en: 'Clothing', color: '#e8559b' },
    play: { ko: '놀이', en: 'Play', color: '#eba417' },
    craft: { ko: '공예', en: 'Craft', color: '#18a383' },
    heritage: { ko: '문화유산', en: 'Heritage', color: '#7c4ad6' },
    wild: { ko: '특별', en: 'Special', color: '#e9a800' },
  };
  // [id, 영어 이름, 분류, 점수(카드 그림에 적힌 숫자), 한국어 이름, 설명]
  const RAW = [
    ['bibimbap', 'Bibimbap', 'food', 3, '비빔밥', 'A famous Korean dish with rice, vegetables, and meat.'],
    ['kimchi', 'Kimchi', 'food', 2, '김치', 'A traditional Korean side dish made from fermented vegetables.'],
    ['tteokbokki', 'Tteokbokki', 'food', 2, '떡볶이', 'A popular Korean snack made with spicy rice cakes.'],
    ['samgyeopsal', 'Samgyeopsal', 'food', 1, '삼겹살', 'Grilled pork is a popular Korean dish.'],
    ['bulgogi', 'Bulgogi', 'food', 2, '불고기', 'A Korean dish made from marinated beef.'],
    ['songpyeon', 'Songpyeon', 'food', 2, '송편', 'A traditional rice cake eaten on Chuseok.'],
    ['hanbok', 'Hanbok', 'clothing', 3, '한복', 'A traditional Korean clothing worn on special days.'],
    ['gat', 'Gat', 'clothing', 2, '갓', 'A traditional Korean hat worn by men in the past.'],
    ['jeogori', 'Jeogori', 'clothing', 1, '저고리', 'A short jacket worn with hanbok.'],
    ['norigae', 'Norigae', 'clothing', 2, '노리개', 'A traditional ornament worn with hanbok.'],
    ['beoseon', 'Beoseon', 'clothing', 2, '버선', 'Traditional Korean socks worn with hanbok.'],
    ['durumagi', 'Durumagi', 'clothing', 3, '두루마기', 'A traditional Korean overcoat worn by men.'],
    ['yutnori', 'Yutnori', 'play', 2, '윷놀이', 'A traditional Korean game played with sticks.'],
    ['tuho', 'Tuho', 'play', 2, '투호', 'A traditional game of throwing arrows into a pot.'],
    ['jegichagi', 'Jegichagi', 'play', 1, '제기', 'A traditional game of kicking a shuttlecock with your foot.'],
    ['gonggi', 'Gonggi', 'play', 1, '공기', 'A traditional game played with small stones.'],
    ['neolttwigi', 'Neolttwigi', 'play', 2, '널뛰기', 'A traditional seesaw game played together.'],
    ['kite', 'Kite (Yeon)', 'play', 2, '연', 'A traditional Korean kite flown in the sky.'],
    ['hanji', 'Hanji', 'craft', 2, '한지', 'Traditional Korean paper made from mulberry trees.'],
    ['celadon', 'Celadon', 'craft', 2, '청자', 'A traditional Korean ceramic with a beautiful blue-green color.'],
    ['lacquerware', 'Lacquerware', 'craft', 3, '나전칠기', 'Traditional Korean crafts with beautiful designs.'],
    ['fan', 'Fan (Buchae)', 'craft', 2, '부채', 'A traditional Korean fan used in summer.'],
    ['mask', 'Mask (Tal)', 'craft', 2, '탈', 'A traditional Korean mask used in performances.'],
    ['lantern', 'Lantern (Deung)', 'craft', 2, '등', 'A traditional Korean lantern used in festivals.'],
    ['gyeongbokgung', 'Gyeongbokgung Palace', 'heritage', 3, '경복궁', 'A famous royal palace in Seoul.'],
    ['namsantower', 'N Seoul Tower', 'heritage', 3, '엔타워', 'A famous tower in Seoul.'],
    ['sungnyemun', 'Sungnyemun Gate', 'heritage', 2, '숭례문', 'A historic gate in Seoul.'],
    ['seokguram', 'Seokguram Grotto', 'heritage', 1, '석굴암', 'A famous Buddhist temple in Gyeongju.'],
    ['hahoe', 'Hahoe Village', 'heritage', 3, '하회마을', 'A traditional Korean village in Andong.'],
    ['dolmen', 'Dolmen (Goindol)', 'heritage', 3, '고인돌', 'A prehistoric stone tomb in Korea.'],
  ];
  // 그림 퀴즈 카드(선생님이 만든 QUIZ 카드) — [카드id, 보기 4개, 정답 번호(0~3)]
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
  // 필요한 자원: 점수에 따라 1점=2개, 2점=4개, 3점=5개 (자기 분류 제외, 골고루 돌아가며)
  const CARDS = {};
  const idxInCat = {};
  RAW.forEach(([id, name, cat, pts, ko, desc]) => {
    const j = (idxInCat[cat] = (idxInCat[cat] ?? -1) + 1);
    const others = CATS.filter((c) => c !== cat);
    const o = (k) => others[(j + k) % 4];
    const cost = {};
    if (pts === 1) { cost[o(0)] = 1; cost[o(1)] = 1; }
    else if (pts === 2) {
      if (j % 2 === 0) { cost[o(0)] = 2; cost[o(1)] = 2; }
      else { cost[o(0)] = 2; cost[o(1)] = 1; cost[o(2)] = 1; }
    } else { cost[o(0)] = 2; cost[o(1)] = 2; cost[o(2)] = 1; }
    CARDS[id] = { id, name, cat, pts, ko, desc, cost };
  });
  const NOBLES = {
    king: { id: 'king', name: 'King', ko: '왕', pts: 4, rule: '3종류 카드', en: 'Collect 3 different types of culture cards.' },
    queen: { id: 'queen', name: 'Queen', ko: '왕비', pts: 4, rule: '같은 종류 3장', en: 'Collect 3 cards of the same type.' },
    scholar: { id: 'scholar', name: 'Scholar', ko: '학자', pts: 3, rule: '문화유산 2장', en: 'Collect 2 heritage cards.' },
    artist: { id: 'artist', name: 'Artist', ko: '예술가', pts: 3, rule: '공예 2장', en: 'Collect 2 craft cards.' },
    traveler: { id: 'traveler', name: 'Traveler', ko: '여행가', pts: 3, rule: '카드 5장', en: 'Collect 5 cards in total.' },
  };
  function catCounts(cardIds) {
    const n = { food: 0, clothing: 0, play: 0, craft: 0, heritage: 0 };
    (cardIds || []).forEach((id) => { if (CARDS[id]) n[CARDS[id].cat]++; });
    return n;
  }
  function nobleOk(nid, cardIds) {
    const n = catCounts(cardIds);
    const kinds = CATS.filter((c) => n[c] > 0).length;
    switch (nid) {
      case 'king': return kinds >= 3;
      case 'queen': return CATS.some((c) => n[c] >= 3);
      case 'scholar': return n.heritage >= 2;
      case 'artist': return n.craft >= 2;
      case 'traveler': return (cardIds || []).length >= 5;
    }
    return false;
  }
  // 할인(가진 카드) 적용 후 실제로 내야 하는 자원
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
  const TEAM_NAMES = ['음식팀', '의복팀', '놀이팀', '공예팀', '문화유산팀', '한글팀', '송편팀', '한옥팀', '윷놀이팀', '탈춤팀'];
  const CHARS = ['jiho', 'minseo', 'dohyeon', 'seoyeon', 'junho'];
  const CHAR_KO = { jiho: '지호', minseo: '민서', dohyeon: '도현', seoyeon: '서연', junho: '준호' };
  const TIERS = { 1: { ko: '1단계 카드', pts: '1~2점' }, 2: { ko: '2단계 카드', pts: '2점' }, 3: { ko: '3단계 카드', pts: '3점' } };
  // 단계: 3점 → 3단계 / 1점·자원 2종류인 2점 → 1단계 / 자원 3종류인 2점 → 2단계
  const tierOf = (id) => { const c = CARDS[id]; if (!c) return 1; if (c.pts >= 3) return 3; return c.pts === 1 || Object.keys(c.cost).length <= 2 ? 1 : 2; };
  const api = { CATS, CAT_INFO, CARDS, NOBLES, QUIZ, catCounts, nobleOk, effCost, payPlan, TEAM_NAMES, CHARS, CHAR_KO, TIERS, tierOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KC = api;
})(typeof window !== 'undefined' ? window : globalThis);
