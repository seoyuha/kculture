/* 11단원 Do You Know About Songpyeon? — 기본 문제 은행
   각 문제는 자원 종류(cat)와 연결됩니다. 학생이 '음식 자원'을 고르면 음식 문제가 나옵니다.
   형식: { id, cat, kind, q, ko, img, choices[4], answer(0~3), exp } */
const { CARDS, CATS, QUIZ } = require('./public/shared.js');

const out = [];
let n = 0;
const add = (cat, kind, q, choices, answer, exp, extra = {}) => {
  out.push({ id: 'q' + String(++n).padStart(3, '0'), cat, kind, q, choices, answer, exp, on: true, ...extra });
};
// 1) 그림 퀴즈 카드(QUIZ) 30장 그대로 / 2) 설명 읽고 이름 고르기 30문제
const yo = (w) => { const ch = w.charCodeAt(w.length - 1) - 0xac00; return ch >= 0 && ch < 11172 && ch % 28 ? '이에요' : '예요'; };
const shortName = (c) => c.name.replace(/\s*\(.*\)/, '');
QUIZ.forEach(([id, choices, ans]) => {
  const c = CARDS[id];
  add(c.cat, '그림', 'What is this?', choices.slice(), ans, `이것은 ${c.ko}${yo(c.ko)}. (${c.name})`, { img: id, ko: '이것은 무엇일까요?' });
});
CATS.forEach((cat) => {
  const list = Object.values(CARDS).filter((c) => c.cat === cat);
  list.forEach((c, i) => {
    const others = list.filter((o) => o.id !== c.id);
    const pick2 = [others[(i + 1) % 5], others[(i + 3) % 5], others[i % 5]].map(shortName);
    add(cat, '설명', c.desc + '\nWhat is it?', [shortName(c), ...pick2], 0, `${c.desc} → ${c.ko}(${c.name})`, { ko: '설명을 읽고 알맞은 것을 고르세요.' });
  });
});

// 3) 표현·대화 문제 (분류별 10문제)
const E = (cat, q, choices, exp, ko = '', img = '') => add(cat, '표현', q, choices, 0, exp, { ko, img: img || undefined });

// 음식
E('food', "A: Do you know about songpyeon?\nB: Yes, I do. It's a traditional Korean ______.", ['rice cake', 'hat', 'game', 'house'], '송편은 전통 떡(rice cake)이에요.', '', 'songpyeon');
E('food', '송편을 만들어 보는 게 어때?', ['How about making songpyeon?', 'How about wearing songpyeon?', 'Do you know about songpyeon?', 'I like songpyeon.'], '~해 보는 게 어때? = How about ~ing?', '알맞은 영어 문장을 고르세요.');
E('food', 'How about ______ bibimbap? (먹어 보는 게 어때?)', ['eating', 'eat', 'eats', 'to eat'], 'How about 뒤에는 -ing 형태를 써요.', '', 'bibimbap');
E('food', 'People eat songpyeon on ______.', ['Chuseok', 'Christmas', 'Halloween', "Children's Day"], '송편은 추석(Chuseok)에 먹어요.');
E('food', 'A: How about making songpyeon?\nB: ______ (좋아.)', ['Sounds good.', "No, I don't.", 'Yes, I do.', "It's a hat."], '권유에 찬성할 때 Sounds good.');
E('food', 'A: Do you know about bulgogi?\nB: No, I don’t. ______', ['What is it?', 'Sounds good.', 'Yes, I do.', 'Here you are.'], '모를 때는 "What is it?(그게 뭐니?)"라고 물어요.', '', 'bulgogi');
E('food', 'Tteokbokki is ______. (매운)', ['spicy', 'sweet', 'cold', 'sour'], 'spicy = 매운', '', 'tteokbokki');
E('food', "'traditional'의 뜻은?", ['전통의', '유명한', '맛있는', '특별한'], 'traditional = 전통의');
E('food', 'What do people eat on Chuseok?', ['They eat songpyeon.', 'They eat pizza.', 'They play soccer.', 'They wear masks.'], '추석에는 송편을 먹어요.');
E('food', 'Bibimbap is a famous Korean dish with rice, vegetables, and ______.', ['meat', 'milk', 'candy', 'bread'], '비빔밥 = 밥 + 채소 + 고기(meat)', '', 'bibimbap');

// 의복
E('clothing', 'This is a hanbok. How about ______ it on?', ['trying', 'eating', 'playing', 'making'], '입어 보다 = try on → How about trying it on?', '', 'hanbok');
E('clothing', 'People wear hanbok on ______ days.', ['special', 'rainy', 'busy', 'sad'], '한복은 특별한 날(special days)에 입어요.');
E('clothing', "A: Do you know about gat?\nB: Yes, I do. It's a traditional Korean ______.", ['hat', 'food', 'game', 'paper'], '갓은 전통 모자(hat)예요.', '', 'gat');
E('clothing', '한복을 입어 보는 게 어때?', ['How about trying on hanbok?', 'How about eating hanbok?', 'Do you know about hanbok?', 'I like hanbok.'], '입어 보다 = try on', '알맞은 영어 문장을 고르세요.');
E('clothing', 'Beoseon are traditional Korean ______.', ['socks', 'hats', 'kites', 'houses'], '버선은 전통 양말(socks)이에요.');
E('clothing', 'Durumagi is a traditional Korean ______ worn by men.', ['overcoat', 'hat', 'game', 'drum'], '두루마기 = 전통 겉옷(overcoat)', '', 'durumagi');
E('clothing', "'wear'의 뜻은?", ['입다', '먹다', '놀다', '만들다'], 'wear = 입다, 쓰다');
E('clothing', 'A: How about wearing a gat?\nB: ______ (좋아!)', ['Sounds good!', "No, I don't.", 'What is it?', "It's delicious."], '권유에 찬성: Sounds good!');
E('clothing', 'Jeogori is a short ______ worn with hanbok.', ['jacket', 'hat', 'dish', 'kite'], '저고리 = 짧은 윗옷(jacket)', '', 'jeogori');
E('clothing', 'Norigae is a traditional ______ worn with hanbok.', ['ornament', 'game', 'food', 'house'], '노리개 = 장신구(ornament)', '', 'norigae');

// 놀이
E('play', "A: Do you know about yutnori?\nB: Yes, I do. It's a traditional Korean ______.", ['game', 'food', 'hat', 'house'], '윷놀이는 전통 놀이(game)예요.', '', 'yutnori');
E('play', 'How about ______ yutnori? (해 보는 게 어때?)', ['playing', 'play', 'plays', 'to play'], 'How about 뒤에는 -ing 형태!');
E('play', 'People play yutnori on ______.', ['Seollal', 'Christmas', 'Halloween', 'Easter'], '설날(Seollal)에 윷놀이를 해요.');
E('play', '투호를 해 보는 게 어때?', ['How about playing tuho?', 'How about eating tuho?', 'How about wearing tuho?', 'Do you know about tuho?'], '놀이를 하다 = play', '알맞은 영어 문장을 고르세요.');
E('play', 'In tuho, you throw ______ into a pot.', ['arrows', 'balls', 'stones', 'kites'], '투호: 화살(arrows)을 항아리에 던져요.', '', 'tuho');
E('play', 'In jegichagi, you kick a shuttlecock with your ______.', ['foot', 'hand', 'head', 'nose'], '제기차기는 발(foot)로 차요.', '', 'jegichagi');
E('play', 'Gonggi is a game played with small ______.', ['stones', 'sticks', 'arrows', 'kites'], '공기놀이는 작은 돌(stones)로 해요.', '', 'gonggi');
E('play', 'Neolttwigi is a traditional ______ game.', ['seesaw', 'card', 'computer', 'ball'], '널뛰기 = 시소(seesaw) 놀이', '', 'neolttwigi');
E('play', 'A kite flies in the ______.', ['sky', 'sea', 'bowl', 'house'], '연은 하늘(sky)을 날아요.', '', 'kite');
E('play', "'throw'의 뜻은?", ['던지다', '차다', '입다', '만들다'], 'throw = 던지다');

// 공예
E('craft', 'Hanji is traditional Korean ______.', ['paper', 'food', 'game', 'hat'], '한지는 전통 종이(paper)예요.', '', 'hanji');
E('craft', 'Hanji is made from ______ trees.', ['mulberry', 'banana', 'coconut', 'Christmas'], '한지는 닥나무(mulberry tree)로 만들어요.');
E('craft', "A: Do you know about tal?\nB: Yes, I do. It's a traditional Korean ______.", ['mask', 'kite', 'sock', 'rice cake'], '탈 = 전통 가면(mask)', '', 'mask');
E('craft', 'How about ______ a fan? (만들어 보는 게 어때?)', ['making', 'make', 'makes', 'to make'], 'How about + 동사-ing', '', 'fan');
E('craft', 'Celadon has a beautiful ______ color.', ['blue-green', 'black', 'orange', 'pink'], '청자는 푸른빛(blue-green)이에요.', '', 'celadon');
E('craft', 'People use a buchae (fan) in ______.', ['summer', 'winter', 'the sea', 'school only'], '부채는 여름(summer)에 써요.');
E('craft', 'Lanterns are used in ______.', ['festivals', 'oceans', 'kitchens', 'forests'], '등은 축제(festivals)에서 써요.', '', 'lantern');
E('craft', "'beautiful'의 뜻은?", ['아름다운', '유명한', '전통의', '오래된'], 'beautiful = 아름다운');
E('craft', '탈을 만들어 보는 게 어때?', ['How about making a mask?', 'How about eating a mask?', 'Do you know about a mask?', 'I can wear a mask.'], '만들다 = make → How about making ~?', '알맞은 영어 문장을 고르세요.');
E('craft', 'A: This is hanji.\nB: Wow! ______', ['How about making it?', 'How about eating it?', 'No, I don’t.', 'It’s spicy.'], '한지는 만들어 볼 수 있어요: How about making it?', '', 'hanji');

// 문화유산
E('heritage', 'Gyeongbokgung is a famous royal ______ in Seoul.', ['palace', 'kite', 'sock', 'dish'], '경복궁 = 왕궁(royal palace)', '', 'gyeongbokgung');
E('heritage', 'N Seoul Tower is a famous ______ in Seoul.', ['tower', 'food', 'game', 'mask'], 'N서울타워 = tower', '', 'namsantower');
E('heritage', 'Seokguram Grotto is in ______.', ['Gyeongju', 'Seoul', 'Busan', 'Jeju'], '석굴암은 경주(Gyeongju)에 있어요.', '', 'seokguram');
E('heritage', 'Hahoe Village is in ______.', ['Andong', 'Gyeongju', 'Seoul', 'Incheon'], '하회마을은 안동(Andong)에 있어요.', '', 'hahoe');
E('heritage', 'How about ______ Gyeongbokgung? (가 보는 게 어때?)', ['visiting', 'visit', 'visits', 'to visit'], 'How about + 동사-ing → visiting');
E('heritage', "'famous'의 뜻은?", ['유명한', '전통의', '맛있는', '아름다운'], 'famous = 유명한');
E('heritage', 'A dolmen is a prehistoric stone ______.', ['tomb', 'kite', 'drum', 'dish'], '고인돌 = 돌무덤(stone tomb)', '', 'dolmen');
E('heritage', "A: Do you know about Gyeongbokgung?\nB: No, I don't. What is it?\nA: It's a famous ______ in Seoul.", ['palace', 'food', 'game', 'hat'], '경복궁은 서울에 있는 유명한 궁궐(palace)이에요.');
E('heritage', '경복궁에 가 보는 게 어때?', ['How about visiting Gyeongbokgung?', 'How about eating Gyeongbokgung?', 'Do you know about Gyeongbokgung?', 'I visited Gyeongbokgung.'], '방문하다 = visit → How about visiting ~?', '알맞은 영어 문장을 고르세요.');
E('heritage', 'Sungnyemun is a historic ______ in Seoul.', ['gate', 'game', 'hat', 'food'], '숭례문 = 역사적인 문(gate)', '', 'sungnyemun');

module.exports = out;
