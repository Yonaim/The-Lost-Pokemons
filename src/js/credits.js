// ========================
// DEMO: 샘플 데이터
// ========================
const TEST_CREDITS_DATA = {
  mode: "score",
  difficulty: "hard",
  stage: 4,
  score: 5400,
  date: "2025-05-23T15:10:44",
  saved_pokemon: [2, 4, 50, 100],
};
const modeKor = { story: "스토리 모드", score: "스코어 모드" };
const difficultyKor = { easy: "쉬움", normal: "보통", hard: "어려움" };

// ========================
// STAFF 정보
// ========================
const STAFFS = [
  { name: "한성준", role: "보스전 및 벽돌깨기 게임 메인 개발", pokemon: 25 },
  {
    name: "김연하",
    role: "메인 로직 / 시나리오 / UI / 그래픽",
    pokemon: 106,
  },
  { name: "오찬영", role: "포켓몬 능력 및 슬롯 구현", pokemon: 5 },
  { name: "한지훈", role: "벽돌깨기 게임 개발/테스트 및 디버그", pokemon: 4 },
];

// ========================
// 크레딧 데이터 구조
// ========================
const CREDITS_TEXT = [
  //   { type: "title", content: "Staff Roll" },
  { type: "info", label: "모드", valueKey: "mode", translate: modeKor },
  {
    type: "info",
    label: "난이도",
    valueKey: "difficulty",
    translate: difficultyKor,
  },
  { type: "info", label: "스테이지", valueKey: "stage" },
  { type: "info", label: "점수", valueKey: "score" },
  {
    type: "info",
    label: "플레이 날짜",
    valueKey: "date",
    formatter: (d) => d.replace("T", " "),
  },
  {
    type: "section",
    content: "<strong>구출한 포켓몬</strong>",
    id: "pokemon-list",
  },
  { type: "staff-list", staff: STAFFS },
  {
    type: "thanks",
    content: `
      <strong>Special Thanks</strong><br>
      Professor Soyoung Park<br>
      All our playtesters and friends<br>
      PokeAPI<br>
      The Pokémon fan community
    `,
  },
  {
    type: "copyright",
    content: `
      <div style="margin-bottom:6px;">
        본 게임은 포켓몬스터의 2차 창작물(팬게임)입니다.<br>
        포켓몬 및 관련 이미지, 사운드는 Nintendo / Creatures Inc. / GAME FREAK inc.의 저작물입니다.<br>
        Pokémon © 1995–2025 Nintendo/Creatures Inc./GAME FREAK inc.
      </div>
      <div style="font-size:0.97em;">
        This fan game is based on the Pokémon series.<br>
        Pokémon and all related images and sounds are the property of Nintendo, Creatures Inc., and GAME FREAK inc.
      </div>
    `,
  },
  {
    type: "demo-info",
    content: `
      <div class="credit-section credit-demo-info">
        <strong>[ 데모 버전 안내 ]</strong><br><br>
        시연된 것은 데모 버전입니다.<br>
        종강 후인 6월 말 즈음,<br><strong>정식 버전</strong>을 배포할 예정입니다.<br>
        관심 있으신 분은 "<i>팀장 한성준</i>"에게 <br>문의해주세요!
      </div>
    `,
  },
];

// ========================
// 크레딧 표시 진입 함수
// ========================

function showCredits(gameResult, onCreditsEnd) {
  gameResult = gameResult || TEST_CREDITS_DATA;
  hideAllFade(qsa(".screen"));
  showWithFade(elById("credits-screen"));
  createCreditsContent(gameResult);

  // 스크롤 애니메이션 시작을 1.4초 뒤로 지연!
  setTimeout(() => {
    startCreditsScroll(onCreditsEnd);
  }, 1400);

  setupCreditsBtn(onCreditsEnd);
  playBgm(BGM.CREDITS);
}

// ========================
// 크레딧 화면 내용 생성
// ========================
function createCreditsContent(data) {
  const scroll = elById("credits-scroll");
  let html = "";

  // [1] 로고
  html += `
      <div class="credit-logo-area">
        <img class="credit-logo-img"
             src="assets/images/logo.png"
             alt="게임 로고">
      </div>
    `;

  // [2] 각 섹션 처리
  CREDITS_TEXT.forEach((entry) => {
    if (entry.type === "title") {
      html += `<div class="credit-title">${entry.content}</div>`;
    } else if (entry.type === "info") {
      let value = data[entry.valueKey];
      if (entry.translate) value = entry.translate[value] || value;
      if (entry.formatter) value = entry.formatter(value);
      html += `<div class="credit-info"><span class="credit-type-name">${entry.label}</span> ${value}</div>`;
    } else if (entry.type === "section" && entry.id === "pokemon-list") {
      html += `<div class="credit-section-title">${entry.content}</div>`;
      html += `<div id="credits-pokemon-list"></div>`;
    } else if (entry.type === "staff-list") {
      html += `<div class="credit-section credit-staff-list"><div class="credit-section-title">STAFF</div>`;
      entry.staff.forEach((member) => {
        html += `
            <div class="staff-member">
              <img class="staff-pokemon" src="assets/images/game/pokemon/${member.pokemon}.png" alt="${member.pokemon}">
              <div>
                <span class="credit-type-name staff-name">${member.name}</span>
                <span class="staff-role">(${member.role})</span>
              </div>
            </div>
          `;
      });
      html += `</div>`;
    } else if (entry.type === "thanks") {
      html += `<div class="credit-section credit-thanks">${entry.content}</div>`;
    } else if (entry.type === "copyright") {
      html += `<div class="credit-section credit-copyright">${entry.content}</div>`;
    } else if (entry.type === "demo-info") {
      html += entry.content;
    }
  });

  html += `<div class="credit-bottom-space"></div>`;
  scroll.innerHTML = html;
  scroll.style.transform = `translateY(${window.innerHeight + 700}px)`;

  // [3] 구출한 포켓몬 이미지 리스트
  const list = elById("credits-pokemon-list");
  if (list && Array.isArray(data.saved_pokemon)) {
    data.saved_pokemon.forEach((id) => {
      const img = document.createElement("img");
      img.className = "credits-pokemon-img";
      img.src = `assets/images/game/pokemon/${id}.png`;
      img.alt = `포켓몬 ${id}`;
      list.appendChild(img);
    });
  }
}

// ========================
// 크레딧 스크롤 애니메이션
// ========================
let creditsSpeed = 1.1,
  creditsFast = 3.8,
  creditsIntv = null,
  creditsFastOn = false;

function startCreditsScroll(onCreditsEnd) {
  const scroll = elById("credits-scroll");
  let pos = window.innerHeight + 700;
  scroll.style.transform = `translateY(${pos}px)`;

  if (creditsIntv) clearInterval(creditsIntv);
  creditsIntv = setInterval(() => {
    pos -= creditsFastOn ? creditsFast : creditsSpeed;
    scroll.style.transform = `translateY(${pos}px)`;
    if (pos + scroll.offsetHeight < 80) {
      clearInterval(creditsIntv);
      setTimeout(() => {
        // handleReturnToTitleScreen();
        if (typeof onCreditsEnd === "function") onCreditsEnd();
      }, 900);
    }
  }, 16);
}

function setupCreditsBtn() {
  const btn = elById("btn-fast-credits");

  if (btn) {
    btn.onmousedown = () => {
      creditsSpeed = 5
    };
    btn.onmouseup = () => {
      creditsSpeed = 1.1;
    };
    btn.onmouseleave = () => {
      creditsFastOn = false;
    };
  }
}
