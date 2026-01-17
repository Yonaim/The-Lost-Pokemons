/**
 * BrickGame class
 * - GameManager를 상속받아 벽돌깨기 게임을 구현
 * - 동적 조합 시스템으로 공이 패들과 벽돌에 부딪히며 벽돌을 깨는 게임
 */

class BrickGame extends GameManager {
  constructor(canvas) {
    if (window.DEBUG_MODE) console.log("[BrickGame] constructor 호출", canvas);
    super(canvas);

    // MARK: 벽돌깨기 전용 설정
    this.leftBrick = 0;

    // MARK: 벽돌 관련 설정
    this.BRICK_WIDTH = BRICK_WIDTH;
    this.BRICK_HEIGHT = BRICK_HEIGHT;
    this.BRICK_PADDING = BRICK_PADDING;
    this.BRICK_OFFSET_TOP = BRICK_OFFSET_TOP;
    this.BRICK_OFFSET_LEFT = BRICK_OFFSET_LEFT;
    this.bricks = []; // 사용 여부 확인 필요
    this.combinations = [];
    this.combinationSpeed = 2;
    this.combinationSpawnInterval = 6000;
    this.combinationSpawnDelayWhenActive = 3000;
    this.requiredCombinations = 10; // 사용 여부 확인 필요

    this.paddleImage = null;
    this.ballImage = null;

    this.lastBallBounceSoundTime = 0; // 마지막 사운드 재생 시간 (throttling용, 0.3초)
    // 아이템 사용 사운드 throttling 변수 추가
    this.lastItemSoundTime = 0; // 마지막 아이템 사운드 재생 시간 (throttling용, 1초)
    this.lastBallFallSoundTime = 0; // 마지막 공이 바닥에 떨어졌을 때 사운드 재생 시간 (throttling용, 1초)
    // 포켓몬 타입별 능력 사운드 throttling 변수 추가
    this.lastGrassSoundTime = 0;
    this.lastFireSoundTime = 0;
    this.lastElectricSoundTime = 0;
    this.lastWaterSoundTime = 0;
    this.lastIceSoundTime = 0;

    // 타입별 색상 매핑
    this.typeColorMap = {
      0: "#66BB6A", // 풀
      1: "#FF7043", // 불
      2: "#FFD54F", // 전기
      3: "#4FC3F7", // 물
      4: "#81D4FA", // 얼음
    };
    this.totalPokemonCount = TOTAL_POKEMON_COUNT;
    this.specialPokemon = SPECIAL_POKEMON;

    // MARK: 포켓몬 능력 상태 관리 변수 추가 (공 속도 버그 해결을 위한 상태 관리)
    this.fireBoostActive = false; // 불타입 능력 활성 상태
    this.originalBallSpeed = null; // 원본 공 속도 저장
    this.fireBoostStartTime = null; // 불 능력 사용 시작 시각
    this.fireBoostDuration = 5000; // 불타입 능력 지속시간 (5초)
    // 기존 timeout 관련 변수들 제거
    // this.fireBoostTimeout = null; // 제거됨
    // this.fireBoostRemainingTime = 0; // 제거됨

    // MARK: 포켓몬 능력 효과 상태 변수 추가
    this.electricBoostActive = false;
    this.waterBoostActive = false;
    this.iceBoostActive = false;

    // MARK: 새로운 목표 포켓몬 관련 변수 추가
    this.appearedTargetPokemonTypes = new Set(); // 이번 게임/스테이지에서 등장한 목표 포켓몬 타입을 기록
    this.TARGET_POKEMON_SPAWN_CHANCE = TARGET_POKEMON_SPAWN_CHANCE;

    // MARK: 포켓몬 슬롯 관리 배열 추가  배경 이미지 파싱 방식 대신 배열로 관리)
    this.slotPokemon = [null, null, null, null]; // 각 슬롯에 저장된 포켓몬 정보 (null = 빈 슬롯)
  }

  /**
   * MARK: 현재 플레이어 슬롯에 있는 포켓몬들의 타입을 가져오는 헬퍼 메서드
   */
  getCurrentSlotTypes() {
    if (window.DEBUG_MODE) console.log("[BrickGame] getCurrentSlotTypes 호출");
    const slotTypes = new Set();

    // 배열 기반으로 타입 확인 (기존 DOM 파싱 방식 대신)
    for (let i = 0; i < 4; i++) {
      const pokemonInfo = this.slotPokemon[i];
      if (pokemonInfo && window.pokemon && window.pokemon[pokemonInfo.index]) {
        slotTypes.add(window.pokemon[pokemonInfo.index].type);
      }
    }

    return slotTypes;
  }

  /**
   * MARK: 모든 조합 패턴 정의 메서드 (스테이지 구분 없이 랜덤 선택)
   */
  getCombinationPatterns() {
    if (window.DEBUG_MODE)
      console.log("[BrickGame] getCombinationPatterns 호출", this.stage);

    let patterns = [];

    switch (this.stage) {
      case 1:
        patterns = [
          // 간단한 패턴들
          [
            [1, 1],
            [1, 1],
          ], // 2x2 사각형
          [[1], [1], [1]], // 세로 3칸
          [[1, 1, 1]], // 가로 3칸
          [
            [1, 0],
            [1, 1],
          ], // L자 모양
        ];
        break;
      case 2:
        patterns = [
          // 중간 복잡도 패턴들
          [
            [1, 1, 1],
            [1, 0, 1],
          ], // T자 모양
          [
            [1, 1],
            [1, 1],
            [1, 1],
          ], // 2x3 직사각형
          [
            [1, 0, 1],
            [1, 1, 1],
          ], // 역T자 모양
          [[1, 1, 1, 1]], // 가로 4칸
        ];
        break;
      case 3:
        patterns = [
          // 복잡한 패턴들
          [
            [1, 1, 1],
            [0, 1, 0],
            [0, 1, 0],
          ], // 십자 모양
          [
            [1, 0, 1],
            [1, 1, 1],
            [1, 0, 1],
          ], // 플러스 모양
          [
            [1, 1, 1],
            [1, 1, 1],
          ], // 2x3 직사각형
          [
            [1, 1, 0],
            [0, 1, 1],
          ], // 지그재그
        ];
        break;
      default:
        patterns = [
          // 간단한 패턴들
          [
            [1, 1],
            [1, 1],
          ], // 2x2 사각형
          [[1], [1], [1]], // 세로 3칸
          [[1, 1, 1]], // 가로 3칸
          [
            [1, 0],
            [1, 1],
          ], // L자 모양
        ];
        break;
    }

    return patterns;
  }
  /**
   * MARK: 조합에 들어갈 포켓몬과 아이템 배치 생성 메서드 수정
   */
  generatePokemonForCombination(pattern) {
    if (window.DEBUG_MODE)
      console.log("[BrickGame] generatePokemonForCombination 호출", pattern);
    const totalPatternSlots = pattern
      .flat()
      .filter((cell) => cell === 1).length;
    let combinationList = [];
    let addedIndicesThisCombination = new Set(); // 현재 조합에 추가된 포켓몬 인덱스 (중복 방지용)

    // 1. 목표 포켓몬 추가 시도
    const currentSlotTypes = this.getCurrentSlotTypes();
    if (
      combinationList.length < totalPatternSlots &&
      currentSlotTypes.size < 4 &&
      Math.random() < this.TARGET_POKEMON_SPAWN_CHANCE
    ) {
      let availableTargetTypes = [];
      for (let type = 0; type <= 4; type++) {
        // 일반 타입 0~4 (전설 타입 5 제외)
        if (
          !this.appearedTargetPokemonTypes.has(type) &&
          !currentSlotTypes.has(type)
        ) {
          availableTargetTypes.push(type);
        }
      }

      if (availableTargetTypes.length > 0) {
        const selectedType =
          availableTargetTypes[
            Math.floor(Math.random() * availableTargetTypes.length)
          ];
        let candidatePokemons = [];
        const allSpecialPokemonIndices = Object.values(this.specialPokemon); // 모든 스테이지의 특별 포켓몬 인덱스 목록 가져오기

        for (let i = 0; i < this.totalPokemonCount; i++) {
          const pkmn = window.pokemon[i];
          if (
            pkmn &&
            pkmn.type === selectedType && // 타입 일치
            !this.saved_pokemon.includes(i) && // 이미 구출된 포켓몬 제외
            !allSpecialPokemonIndices.includes(i) // 현재 포켓몬이 '모든' 스테이지의 특별 포켓몬 중 하나가 아닌 경우
          ) {
            // 스테이지 특별 포켓몬과 다른 경우
            candidatePokemons.push(i);
          }
        }
        if (candidatePokemons.length > 0) {
          const selectedPokemonIndex =
            candidatePokemons[
              Math.floor(Math.random() * candidatePokemons.length)
            ];
          combinationList.push({
            type: "pokemon",
            index: selectedPokemonIndex,
            isTarget: true,
          });
          addedIndicesThisCombination.add(selectedPokemonIndex);
          this.appearedTargetPokemonTypes.add(selectedType); // 이 타입의 목표 포켓몬 등장 기록
        }
      }
    }

    // 2. 현재 스테이지의 특별 포켓몬 (예: 보스급 또는 주요 구출 대상)
    const currentStageSpecialPokemon = this.specialPokemon[this.stage]; // this.specialPokemon은 constants.js의 SPECIAL_POKEMON 값으로 초기화됩니다.
    if (
      combinationList.length < totalPatternSlots &&
      currentStageSpecialPokemon !== undefined &&
      !this.saved_pokemon.includes(currentStageSpecialPokemon) &&
      !addedIndicesThisCombination.has(currentStageSpecialPokemon)
    ) {
      combinationList.push({
        type: "pokemon",
        index: currentStageSpecialPokemon, // 현재 스테이지의 특별 포켓몬 인덱스
      });
      addedIndicesThisCombination.add(currentStageSpecialPokemon);
    }

    // 3. 아이템 추가 (기존 5% 확률 유지)
    // Math.random() < 0.05 부분은 이전 질문에서 50%로 되어있던 것을 5%로 수정합니다.
    if (combinationList.length < totalPatternSlots && Math.random() < 0.05) {
      let availableItems = [
        "normal-potion",
        "super-potion",
        "hyper-potion",
        "full-potion",
      ];
      let randomItem =
        availableItems[Math.floor(Math.random() * availableItems.length)];
      combinationList.push({ type: "item", name: randomItem });
    }

    // 4. 나머지 슬롯을 일반 포켓몬으로 채움
    let generalPokemonSlotsToFill = totalPatternSlots - combinationList.length;
    if (generalPokemonSlotsToFill > 0) {
      let availableGeneralPokemon = [];
      for (let i = 0; i < this.totalPokemonCount; i++) {
        const pkmn = window.pokemon[i];
        // 슬롯에 있는 포켓몬은 블록 조합에 등장하지 않도록 필터링
        const isPokemonInSlot = this.slotPokemon.some(
          (slotPokemon) => slotPokemon && slotPokemon.index === i,
        );
        if (
          pkmn &&
          // pkmn.type !== 5 && // 전설(타입 5) 제외
          !this.saved_pokemon.includes(i) && // 이미 구출된 포켓몬 제외
          !addedIndicesThisCombination.has(i) && // 현재 조합에 이미 추가된 포켓몬 제외
          !isPokemonInSlot // 슬롯에 있는 포켓몬 제외
        ) {
          availableGeneralPokemon.push(i);
        }
      }

      availableGeneralPokemon.sort(() => Math.random() - 0.5); // 섞기
      for (
        let i = 0;
        i < generalPokemonSlotsToFill && i < availableGeneralPokemon.length;
        i++
      ) {
        combinationList.push({
          type: "pokemon",
          index: availableGeneralPokemon[i],
        });
        addedIndicesThisCombination.add(availableGeneralPokemon[i]);
      }
    }

    // 최종적으로 조합 리스트 내 아이템/포켓몬 순서 셔플 (패턴 내 위치는 createNewCombination에서 결정됨)
    return combinationList.sort(() => Math.random() - 0.5);
  }

  /**
   * MARK: frame 조합 생성
   */
  createNewCombination() {
    if (window.DEBUG_MODE) console.log("[BrickGame] createNewCombination 호출");
    let patterns = this.getCombinationPatterns();
    let randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
    let combinationList = this.generatePokemonForCombination(randomPattern); // 해당 조합에서 사용할 포켓몬, 아이템 등
    let itemIndex = 0; // 블록에서 나오는 아이템이 아닌, combination에서 꺼내는 brick임

    // 조합 크기 계산 - 수정됨: 패턴 크기 고려
    let patternHeight =
      randomPattern.length * (this.BRICK_HEIGHT + this.BRICK_PADDING);

    // paddle y 위치보다 위쪽에서만 조합 생성하도록 제한
    let maxY = this.paddle.y - this.paddleOffset - patternHeight - 10; // 패들보다 충분히 위에서 생성 + 패턴 높이 고려
    let minY = this.BRICK_OFFSET_TOP;

    // 기존 조합과 겹치지 않는 Y 위치 찾기 - 추가됨: 겹침 방지 로직
    let randomY = this.findNonOverlappingY(minY, maxY, patternHeight);

    let combination = {
      pattern: randomPattern,
      bricks: [],
      x: -200, // 화면 왼쪽 밖에서 시작
      y: randomY, // 패들 위쪽 영역에서 랜덤 높이
      speed: this.combinationSpeed,
    };

    // 패턴에 따라 벽돌 생성 (포켓몬과 아이템 모두 처리)
    for (let row = 0; row < randomPattern.length; row++) {
      for (let col = 0; col < randomPattern[row].length; col++) {
        if (randomPattern[row][col] === 1) {
          let brickX =
            combination.x + col * (this.BRICK_WIDTH + this.BRICK_PADDING);
          let brickY =
            combination.y + row * (this.BRICK_HEIGHT + this.BRICK_PADDING);
          let currentItem = combinationList[itemIndex++];

          let brick;

          if (currentItem.type === "pokemon") {
            // 포켓몬 블록 생성
            let pokeIndex = currentItem.index;
            let imagePath =
              "assets/images/game/pokemon/" + pokeIndex + ".png";
            let pokeType =
              window.pokemon && window.pokemon[pokeIndex]
                ? window.pokemon[pokeIndex].type
                : 0;
            let slotColor = this.typeColorMap[pokeType] || "#eee";
            let isTarget = currentItem.isTarget || false; // 목표 포켓몬 여부

            brick = new Brick(
              brickX,
              brickY,
              this.BRICK_WIDTH,
              this.BRICK_HEIGHT,
              pokeIndex,
              pokeType,
              isTarget,
              imagePath,
            );
            brick.type = pokeType;
            brick.color = slotColor;
            brick.blockType = "pokemon"; // 블록 타입 추가
          } else if (currentItem.type === "item") {
            // 아이템 블록 생성
            let itemName = currentItem.name;
            let imagePath = `assets/images/game/item/outline/${itemName}-outline.png`;

            brick = new Brick(
              brickX,
              brickY,
              this.BRICK_WIDTH,
              this.BRICK_HEIGHT,
              null, // 포켓몬 인덱스 없음
              null, // 포켓몬 타입 없음
              false, // 타겟 아님
              imagePath,
            );
            brick.itemName = itemName; // 아이템 이름 저장
            brick.blockType = "item"; // 블록 타입 추가
            brick.color = "#FFD700"; // 아이템 블록 색상 (골드)
          }
          brick.status = 1;
          brick.combination = combination; // 조합 참조 추가

          combination.bricks.push(brick); // 벽돌을 조합에 추가
        }
      }
    }

    this.combinations.push(combination);
    if (window.DEBUG_MODE)
      console.log("새로운 조합 생성: " + combination.bricks.length + "개 블록");
    // console.log(`조합 내 brick들 좌표 : `);
    // combination.bricks.forEach((brick, index)=>{
    //   console.log(`brick ${index} : ${brick.x}, ${brick.y}`);
    // });
  }
  /**
   * MARK: 게임별 초기화
   * (GameManager 오버라이드)
   */
  initializeGame() {
    if (window.DEBUG_MODE) console.log("[BrickGame] initializeGame 호출");

    // 포켓몬 능력 효과 완전 초기화 (스테이지 시작 시)
    this.electricBoostActive = false;
    this.waterBoostActive = false;
    this.iceBoostActive = false;
    this.fireBoostActive = false;
    this.originalBallSpeed = null;
    this.fireBoostStartTime = null; // 시작 시간 초기화

    // 타이머 정리 코드 제거 (더 이상 timeout 사용하지 않음)

    // 조합 및 벽돌 시스템 완전 초기화
    this.combinations = [];
    this.leftBrick = 0;

    // 동적 조합 시스템 초기화
    this.initDynamicBrickSystem();
    this.totalLives = this.lives;

    // story 모드일 때만 기본 포켓몬 슬롯에 추가
    if (this.mode === "story") {
      // <-- story 모드일 때만 실행되도록 조건 추가
      this.addDefaultPokemonByStage();
    }
  }

  /**
   * MARK: 스테이지별 기본 포켓몬 슬롯 추가 메서드 수정
   */
  addDefaultPokemonByStage() {
    if (window.DEBUG_MODE)
      console.log("[BrickGame] addDefaultPokemonByStage 호출", this.stage);

    // 슬롯 초기화 먼저 수행
    this.clearPokemonSlots();

    // 스테이지별 기본 포켓몬 설정 (stage 2: 피카츄만, stage 3: 피카츄+펭도리)
    let defaultPokemonIndices = [];

    if (this.stage === 2) {
      // stage 2: 피카츄(105)만 추가
      defaultPokemonIndices = [105];
    } else if (this.stage === 3) {
      // stage 3: 피카츄(105), 펭도리(106) 모두 추가
      defaultPokemonIndices = [105, 106];
    }

    // 설정된 포켓몬들을 순서대로 슬롯에 추가
    for (let i = 0; i < defaultPokemonIndices.length && i < 4; i++) {
      const pokemonIndex = defaultPokemonIndices[i];
      const pokemonData =
        window.pokemon && window.pokemon[pokemonIndex]
          ? window.pokemon[pokemonIndex]
          : null;

      if (pokemonData) {
        // 이미지 경로 생성
        const imagePath = `assets/images/game/pokemon/potrait/normal/${pokemonIndex}.png`;
        // const imagePath = `assets/images/game/pokemon/${pokemonIndex}.png`;

        // i번째 슬롯에 포켓몬 추가  배열과 DOM 모두 업데이트)
        const slot = document.getElementById(`slot-${i}`);
        if (slot) {
          // DOM 업데이트
          slot.style.backgroundImage = `url(${imagePath})`;
          slot.style.backgroundSize = "cover";
          slot.style.backgroundPosition = "center";
          const color = this.typeColorMap[pokemonData.type] || "#eee";
          slot.style.backgroundColor = color;

          // 배열 업데이트  기본 포켓몬 정보 저장)
          this.slotPokemon[i] = {
            index: pokemonIndex,
            type: pokemonData.type,
            name: pokemonData.name,
            imageSrc: imagePath,
          };

          if (window.DEBUG_MODE)
            console.log(
              `스테이지 ${this.stage} 기본 포켓몬 추가: ${pokemonData.name} (인덱스: ${pokemonIndex}, 타입: ${pokemonData.type}) - 슬롯 ${i}`,
            );
        }
      } else {
        console.warn(
          `스테이지 ${this.stage} 기본 포켓몬 데이터를 찾을 수 없습니다. 인덱스: ${pokemonIndex}`,
        );
      }
    }

    // 첫 번째 슬롯을 선택된 상태로 설정 (포켓몬이 추가된 경우에만)
    if (defaultPokemonIndices.length > 0) {
      const firstFrame = document.getElementById("slot-frame-0");
      if (firstFrame) {
        firstFrame.classList.add("selected");
        this.selectedSlotIndex = 0;
      }
    }

    if (defaultPokemonIndices.length === 0) {
      if (window.DEBUG_MODE)
        console.log(
          `스테이지 ${this.stage}에는 기본 포켓몬이 설정되지 않았습니다.`,
        );
    }
  }

  /**
   * MARK: 동적 벽돌 시스템 초기화
   */
  initDynamicBrickSystem() {
    if (window.DEBUG_MODE)
      console.log("[BrickGame] initDynamicBrickSystem 호출");
    // 타겟 포켓몬 설정 로직은 generatePokemonForCombination으로 이동됨
    // 조합 시스템 관련 변수 초기화
    this.combinations = [];
    this.lastCombinationSpawn = 0;
    this.leftBrick = 0; // 사용 여부 확인 필요

    // 게임/스테이지 시작 시 등장한 목표 포켓몬 타입 기록 초기화
    this.appearedTargetPokemonTypes.clear();

    if (this.specialPokemon[this.stage] !== undefined) {
      if (window.DEBUG_MODE)
        console.log(
          "특별 포켓몬 (Stage " +
            this.stage +
            "): " +
            this.specialPokemon[this.stage],
        );
    } else {
      if (window.DEBUG_MODE)
        console.log("특별 포켓몬 (Stage " + this.stage + "): 없음");
    }
  }

  // BrickGame 내부 (어디든 메서드로)
  drawSlotArrowCanvas() {
    // 선택된 슬롯 DOM 좌표 → 캔버스 좌표로 변환
    const frame = document.getElementById(
      `slot-frame-${this.selectedSlotIndex}`,
    );
    if (!frame) return;
    const slotRect = frame.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();

    // 슬롯 중앙 x 좌표
    const cx = slotRect.left - canvasRect.left + slotRect.width / 2;
    const y = this.canvas.height - 102;
    const w = 22,
      h = 14;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(cx - w / 2, y);
    this.ctx.lineTo(cx + w / 2, y);
    this.ctx.lineTo(cx, y + h);
    this.ctx.closePath();
    this.ctx.fillStyle = "#fff";
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = "#000";
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * MARK: 게임별 업데이트 로직
   * (GameManager 오버라이드)
   */
  updateGame(timeMultiplier) {
    if (window.DEBUG_MODE) {
      console.log("[BrickGame] updateGame 호출", timeMultiplier);
      console.log(`공 속도: x - ${this.ball.speedX}, y - ${this.ball.speedY}, 총 속도 - ${Math.sqrt(this.ball.speedX * this.ball.speedX + this.ball.speedY * this.ball.speedY)}`)
    }

    // 불타입 능력 지속시간 체크 (일시정지 시간 제외한 게임 경과 시간 기반)
    this.checkFireAbilityDuration();

    // 공 이동
    this.ball.x += this.ball.speedX * timeMultiplier;
    this.ball.y += this.ball.speedY * timeMultiplier;

    // 조합 생성 및 이동 시스템 추가
    this.updateCombinations(timeMultiplier);

    // MARK: 공 화면 밖 감지
    let ballIsOutOfScreenLeft = this.ball.x < -this.ball.radius;
    let ballIsOutOfScreenTop = this.ball.y < -this.ball.radius;
    let ballIsOutOfScreenRight =
      this.ball.x - this.ball.radius > this.canvas.width;
    let ballIsOutOfScreenBottom =
      this.ball.y + this.ball.radius > this.canvas.height;
    let isBallMissing = isNaN(this.ball.x) || isNaN(this.ball.y);

    if (
      ballIsOutOfScreenLeft ||
      ballIsOutOfScreenRight ||
      ballIsOutOfScreenTop ||
      ballIsOutOfScreenBottom ||
      isBallMissing
    ) {
      // 공이 화면 밖으로 나간 경우: 생명 감소 및 위치/속도 초기화
      if (window.DEBUG_MODE) {
        console.log("[BrickGame] 공이 화면 밖으로 나감");
        console.log(`ballIsOutOfScreenLeft: ${ballIsOutOfScreenLeft}`);
        console.log(`ballIsOutOfScreenRight: ${ballIsOutOfScreenRight}`);
        console.log(`ballIsOutOfScreenTop: ${ballIsOutOfScreenTop}`);
        console.log(`ballIsOutOfScreenBottom: ${ballIsOutOfScreenBottom}`);
        console.log(`isBallMissing: ${isBallMissing}, ${this.ball.x}, ${this.ball.y}`);
      }
      this.lives -= 1;

      // 생명 <= 0이면 게임 끝내기
      if (this.lives <= 0) {
        if (window.DEBUG_MODE) console.log("[BrickGame] 생명 0으로 게임 오버");
        this.isGameClear = false;
        this.showInGameMessage("게임 오버.. 포켓몬 구출에 실패했습니다.", true);
        this.endGame();
        return;
      }

      // 공이 바닥에 떨어졌을 때 사운드 재생
      this.playBallFallSound();

      // 공 위치 및 속도 초기화
      this.ball.x = this.ballInitialX;
      this.ball.y = this.ballInitialY;
      this.ball.speedX = 0;
      this.ball.speedY = -this.BALL_SPEED;
      // if (window.DEBUG_MODE) console.log(`[BrickGame] 공 위치 초기화: (${this.ball.x.toFixed(2)}, ${this.ball.y.toFixed(2)})`);
    } else {
      // 공이 화면 안에 있는 경우: 일반 벽 충돌(바운스) 처리
      // 좌우 벽 충돌
      if (this.ball.x - this.ball.radius <= 0) {
        this.ball.speedX = -this.ball.speedX;
        this.ball.x = this.ball.radius;
        this.playBallBounceSound(); // 벽 충돌 사운드 재생 추가
      } else if (this.ball.x + this.ball.radius >= this.canvas.width) {
        this.ball.speedX = -this.ball.speedX;
        this.ball.x = this.canvas.width - this.ball.radius;
        this.playBallBounceSound(); // 벽 충돌 사운드 재생 추가
      }

      // 상단 벽 충돌
      if (this.ball.y - this.ball.radius <= 0) {
        this.ball.speedY = -this.ball.speedY;
        this.ball.y = this.ball.radius;
        this.playBallBounceSound(); // 상단 벽 충돌 사운드 재생 추가
      }
    }

    // 패들 이동 처리
    if (
      this.keys.rightPressed &&
      this.paddle.x < this.canvas.width - this.paddle.width
    ) {
      this.paddle.x += 7 * timeMultiplier;
    } else if (this.keys.leftPressed && this.paddle.x > 0) {
      this.paddle.x -= 7 * timeMultiplier;
    }

    // 패들과 공 충돌
    if (isHit(this.ball, this.paddle)) {
      let paddleCenter = this.paddle.x + this.paddle.width / 2;
      let ballDistFromCenter = this.ball.x - paddleCenter;
      ballDistFromCenter = Math.max(
        (-this.paddle.width / 2) * 0.9,
        Math.min((this.paddle.width / 2) * 0.9, ballDistFromCenter),
      );
      this.ball.speedX =
        (ballDistFromCenter / (this.paddle.width / 2)) * this.BALL_SPEED;
      this.ball.speedY = -Math.sqrt(
        this.BALL_SPEED * this.BALL_SPEED - this.ball.speedX * this.ball.speedX,
      ); // speedY는 항상 음수로, 공의 속도는 항상 BALL_SPEED가 되게 한다
      if (window.DEBUG_MODE) {
        console.log(
          `paddleCenter - ${paddleCenter} / ballDistFromCenter - ${ballDistFromCenter} / ball.speedX - ${this.ball.speedX} / ball.speedY - ${this.ball.speedY}`,
        );
      }
      if (this.fireBoostActive) {
        // 불 능력 활성화됐을 땐 FIRE_SPEED_BOOST 곱해 x, y속도 구함
        this.ball.speedX *= FIRE_SPEED_BOOST;
        this.ball.speedY = -Math.sqrt((this.BALL_SPEED * FIRE_SPEED_BOOST) * (this.BALL_SPEED * FIRE_SPEED_BOOST) - this.ball.speedX * this.ball.speedX);
      }
      this.playBallBounceSound(); // 패들 충돌 사운드 재생 추가
    }

    // 벽돌과 공 충돌 (동적 조합 시스템으로 변경)
    this.dynamicCollisionDetection();

    // 승리 조건 확인
    if (!this.isGameClear) {
      this.checkWin();
    }

    // 모든 객체 그리기
    this.drawBall();
    this.drawPaddle();
    this.drawDynamicBricks(); // 동적 벽돌 그리기로 변경
    this.drawSlotArrowCanvas();

    // if (window.DEBUG_MODE) console.log(`[BrickGame] 공의 좌표: (${this.ball.x.toFixed(2)}, ${this.ball.y.toFixed(2)})`);
  }

  /**
   * MARK: 공 충돌 사운드 재생 (throttling 적용)
   */
  playBallBounceSound() {
    // const currentTime = performance.now(); // 현재 시간 측정 // 주석 처리: throttling 제거
    // if (currentTime - this.lastBallBounceSoundTime > 300) { // 주석 처리: throttling 제거
    //   this.lastBallBounceSoundTime = 0; // 사운드를 처음부터 재생 // 주석 처리: throttling 제거
    //   // this.ballBounceSound.play().catch(error =>
    //   //   console.error("Error playing ball bounce sound:", error)
    //   // );
    //   playSfx(SFX.BALL_BOUNCE); // SFX로 변경
    //   this.lastBallBounceSoundTime = currentTime; // 마지막 사운드 재생 시간 업데이트 // 주석 처리: throttling 제거
    // }
    playSfx(SFX.BALL_BOUNCE); // throttling 제거하고 항상 사운드 재생
  }

  /**
   * MARK: 아이템 사용 사운드 재생 (throttling 적용)
   */
  playItemSound() {
    const currentTime = performance.now(); // 현재 시간 측정
    if (currentTime - this.lastItemSoundTime > 1000) {
      // 1초 간격으로 제한
      this.lastItemSoundTime = 0; // 사운드를 처음부터 재생
      playSfx(SFX.ITEM); // 아이템 사운드 재생
      this.lastItemSoundTime = currentTime; // 마지막 사운드 재생 시간 업데이트
    }
  }

  /**
   * MARK: 공이 바닥에 떨어졌을 때 사운드 재생 (throttling 적용)
   */
  playBallFallSound() {
    // const currentTime = performance.now(); // 현재 시간 측정
    // if (currentTime - this.lastBallFallSoundTime > 1000) {
    //   // 1초 간격으로 제한
    //   this.lastBallFallSoundTime = 0; // 사운드를 처음부터 재생
    //   playSfx(SFX.FALL); // 공이 떨어지는 사운드 재생
    //   this.lastBallFallSoundTime = currentTime; // 마지막 사운드 재생 시간 업데이트
    // }
    playSfx(SFX.FALL); // 공이 떨어지는 사운드 재생
  }

  /**
   * MARK: 조합 시스템
   */
  updateCombinations(timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[BrickGame] updateCombinations 호출", timeMultiplier);
    let currentTime = performance.now(); // Date.now()에서 performance.now()로 변경

    // 화면에 조합이 있는지 확인 (화면 경계 내에 조합이 있는지 체크) - 추가됨: 화면 내 조합 존재 여부 확인
    let hasActiveCombinationOnScreen = false;
    for (let i = 0; i < this.combinations.length; i++) {
      let combination = this.combinations[i];
      // 조합이 화면 안에 있는지 확인 (조합의 시작점이 화면 오른쪽 경계를 넘지 않았으면 화면에 있다고 판단)
      if (combination.x < this.canvas.width) {
        hasActiveCombinationOnScreen = true;
        break;
      }
    }

    // 새 조합 생성 조건 개선 - 수정됨: 화면에 조합이 없을 때만 생성하거나, 있을 때는 추가 대기시간 적용
    let requiredInterval = hasActiveCombinationOnScreen
      ? this.combinationSpawnInterval + this.combinationSpawnDelayWhenActive // 화면에 조합이 있으면 기본 간격 + 추가 대기시간
      : this.combinationSpawnInterval; // 화면에 조합이 없으면 기본 간격만 적용

    if (currentTime - this.lastCombinationSpawn > requiredInterval) {
      this.createNewCombination(); // 새 조합 생성
      this.lastCombinationSpawn = currentTime;
      // console.log("새 조합 생성됨 - 화면에 기존 조합 존재: " + hasActiveCombinationOnScreen); // 추가됨: 조합 생성 로그
    }

    // 기존 조합들 이동 및 정리
    for (let i = this.combinations.length - 1; i >= 0; i--) {
      let combination = this.combinations[i];
      combination.x += combination.speed * timeMultiplier;

      // 조합의 모든 벽돌 위치 업데이트 - 수정됨: 벽돌 위치 매핑 로직 개선
      let self = this;
      combination.bricks.forEach(function (brick, brickIndex) {
        let pattern = combination.pattern;
        let row = 0,
          col = 0;
        let count = 0;
        let found = false; // 위치를 찾았는지 확인하는 플래그 추가

        // 패턴에서 현재 벽돌의 위치 찾기 - 수정됨: 이중 루프 탈출 문제 해결
        outerLoop: for (let r = 0; r < pattern.length; r++) {
          for (let c = 0; c < pattern[r].length; c++) {
            if (pattern[r][c] === 1) {
              if (count === brickIndex) {
                row = r;
                col = c;
                found = true;
                break outerLoop; // 라벨을 사용한 이중 루프 완전 탈출
              }
              count++;
            }
          }
        }

        // 위치를 찾은 경우에만 좌표 업데이트 - 추가됨: 안전성 검증
        if (found) {
          brick.x =
            combination.x + col * (self.BRICK_WIDTH + self.BRICK_PADDING);
          brick.y =
            combination.y + row * (self.BRICK_HEIGHT + self.BRICK_PADDING);
        } else {
          // 위치를 찾지 못한 경우 오류 로그 출력 - 추가됨: 디버깅용 로그
          // console.error("벽돌 위치 매핑 실패: brickIndex=" + brickIndex + ", 패턴 크기=" + pattern.length);
        }
      });

      // // 화면을 벗어난 조합 제거
      // if (combination.x > this.canvas.width + 200) {
      //   this.combinations.splice(i, 1);
      //   continue;
      // }
      // 화면을 벗어난 조합에서 목표 포켓몬 타입 제거 로직 추가
      if (combination.x > this.canvas.width + 200) {
        combination.bricks.forEach(brick => {
          // 파괴되지 않은 목표 포켓몬 블록이 있는지 확인
          if (brick.status === 1 && brick.blockType === "pokemon" && brick.isTarget) {
            const pokemonData = window.pokemon && window.pokemon[brick.pokeIndex];
            if (pokemonData) {
              this.appearedTargetPokemonTypes.delete(pokemonData.type);
              if (window.DEBUG_MODE) {
                console.log(`화면을 벗어난 조합에서 목표 포켓몬 타입 ${pokemonData.type} 제거됨 (포켓몬: ${pokemonData.name})`);
              }
            }
          }
        });

        this.combinations.splice(i, 1);
        continue;
      }
      // for (let j = 0; j < combination.bricks.length; j++) {
      //   let brick = combination.bricks[j];
      //   if (brick.status === 0) {
      //     combination.bricks.splice(j, 1);
      //     j--;
      //   }
      // }

      // 조합의 벽돌이 모두 파괴된 경우 조합 제거
      if (combination.bricks.length === 0) {
        this.combinations.splice(i, 1);
      }
    }
  }

  /**
   * MARK: 동적 벽돌 충돌 감지
   */
  dynamicCollisionDetection() {
    if (window.DEBUG_MODE)
      console.log("[BrickGame] dynamicCollisionDetection 호출");
    for (let i = 0; i < this.combinations.length; i++) {
      let combination = this.combinations[i];
      for (let j = 0; j < combination.bricks.length; j++) {
        let brick = combination.bricks[j];
        if (brick.status === 1 && brick.isBrickHit(this.ball)) {
          this.handleBrickCollision(brick);
        }
      }
    }
  }

  /**
   * MARK: 벽돌 충돌 처리
   */
  handleBrickCollision(brick) {
    // 겹침 영역 계산
    let overlapLeft = this.ball.x + this.ball.radius - brick.x;
    let overlapRight =
      brick.x + this.BRICK_WIDTH - (this.ball.x - this.ball.radius);
    let overlapTop = this.ball.y + this.ball.radius - brick.y;
    let overlapBottom =
      brick.y + this.BRICK_HEIGHT - (this.ball.y - this.ball.radius);

    // 최소 겹침 영역 찾기
    let minOverlap = Math.min(
      overlapLeft,
      overlapRight,
      overlapTop,
      overlapBottom,
    );

    // 충돌한 면에 따라 속도 방향 변경
    if (minOverlap === overlapLeft) {
      this.ball.speedX = -Math.abs(this.ball.speedX); // 왼쪽 충돌
    } else if (minOverlap === overlapRight) {
      this.ball.speedX = Math.abs(this.ball.speedX); // 오른쪽 충돌
    } else if (minOverlap === overlapTop) {
      this.ball.speedY = -Math.abs(this.ball.speedY); // 위쪽 충돌
    } else if (minOverlap === overlapBottom) {
      this.ball.speedY = Math.abs(this.ball.speedY); // 아래쪽 충돌
    }

    brick.status = 0;
    this.playBallBounceSound();

    // 포켓몬 블록과 아이템 블록 처리 분리
    if (brick.blockType === "pokemon") {
      let pokemon = window.pokemon[brick.pokeIndex];
      let baseScore =
        pokemon && pokemon.type === 5 ? LEGENDARY_POKEMON_SCORE : BRICK_SCORE;
      this.score += this.electricBoostActive ? baseScore * 2 : baseScore;

      if (!this.saved_pokemon.includes(brick.pokeIndex)) {
        this.saved_pokemon.push(brick.pokeIndex);
        let pokemonName = pokemon ? pokemon.name : "포켓몬";
        this.showInGameMessage(pokemonName);
      }

      if (brick.isTarget && window.pokemon[brick.pokeIndex]) {
        let imagePath =
          "assets/images/game/pokemon/potrait/normal/" +
          brick.pokeIndex +
          ".png";
        this.addPokemonToSlot(imagePath);
      }
    } else if (brick.blockType === "item") {
      this.playItemSound();
      this.useItemOnSlot(brick.itemName);
    }

    if (!this.isGameClear) {
      this.checkWin();
    }

    // MARK: 조합 내 모든 블록이 파괴되었는지 확인하고 추가 점수 부여
    if (brick.combination) {
      const allBricksBroken = brick.combination.bricks.every(
        (b) => b.status !== 1,
      );
      if (allBricksBroken) {
        this.score += COMBINATION_SCORE;
        this.showInGameMessage(
          `조합 완성 보너스: ${COMBINATION_SCORE}점 획득!`,
          true,
        );
        console.log(`조합 완성 보너스 ${COMBINATION_SCORE}점 획득!`);
      }
    }
  }

  /**
   * MARK: 포켓몬 슬롯에 추가
   */
  addPokemonToSlot(imageSrc) {
    if (window.DEBUG_MODE)
      console.log("[BrickGame] addPokemonToSlot 호출", imageSrc);

    // 포켓몬 인덱스 추출  한 번만 파싱하여 배열에 저장)
    let indexMatch = imageSrc.match(/(\d+)\.png/);
    if (!indexMatch || !indexMatch[1]) {
      console.error(
        "addPokemonToSlot: 이미지 경로에서 포켓몬 인덱스를 추출할 수 없습니다.",
        imageSrc,
      );
      return;
    }

    let index = parseInt(indexMatch[1]);
    let pokemonData =
      window.pokemon && window.pokemon[index] ? window.pokemon[index] : null;
    if (!pokemonData) {
      console.error(
        "addPokemonToSlot: 유효하지 않은 포켓몬 인덱스입니다.",
        index,
      );
      return;
    }

    // 전설의 포켓몬(타입 5) 차단 로직
    if (pokemonData.type === 5) {
      console.log(
        `전설의 포켓몬 ${pokemonData.name}은(는) 슬롯에 추가할 수 없습니다.`,
      );
      return;
    }

    // 중복 방지: 이미 슬롯에 들어가 있는 경우 무시  배열에서 중복 확인)
    for (let i = 0; i < 4; i++) {
      const existingPokemon = this.slotPokemon[i];
      if (existingPokemon && existingPokemon.index === index) {
        return; // 이미 들어있는 포켓몬은 중복 추가 안 함
      }
    }

    // 타입 중복 방지: 같은 타입의 포켓몬이 이미 슬롯에 있는지 확인  배열에서 타입 중복 확인)
    for (let i = 0; i < 4; i++) {
      const existingPokemon = this.slotPokemon[i];
      if (
        existingPokemon &&
        window.pokemon[existingPokemon.index] &&
        window.pokemon[existingPokemon.index].type === pokemonData.type
      ) {
        console.log(
          `같은 타입의 포켓몬이 이미 슬롯에 있습니다: ${window.pokemon[existingPokemon.index].name} (타입 ${pokemonData.type})`,
        );
        return; // 같은 타입 포켓몬은 중복 추가 안 함
      }
    }

    // 빈 슬롯 찾아서 추가  배열과 DOM 모두 업데이트)
    for (let i = 0; i < 4; i++) {
      if (!this.slotPokemon[i]) {
        // 배열에서 빈 슬롯 확인
        const slot = document.getElementById("slot-" + i);
        if (slot) {
          // DOM 업데이트
          slot.style.backgroundImage = "url(" + imageSrc + ")";
          slot.style.backgroundSize = "cover";
          slot.style.backgroundPosition = "center";
          let color = this.typeColorMap[pokemonData.type] || "#eee";
          slot.style.backgroundColor = color;

          // 배열 업데이트  포켓몬 정보 객체로 저장)
          this.slotPokemon[i] = {
            index: index,
            type: pokemonData.type,
            name: pokemonData.name,
            imageSrc: imageSrc,
          };

          if (window.DEBUG_MODE)
            console.log(
              `포켓몬 슬롯에 추가됨: ${pokemonData.name} (타입 ${pokemonData.type}) - 슬롯 ${i}`,
            );
          return;
        }
      }
    }
  }

  /**
   * MARK: 포켓몬 슬롯 초기화
   */
  clearPokemonSlots() {
    if (window.DEBUG_MODE) console.log("[BrickGame] clearPokemonSlots 호출");

    // 배열 초기화  배열과 DOM 모두 초기화)
    this.slotPokemon = [null, null, null, null];

    // DOM 초기화
    for (let i = 0; i < 4; i++) {
      let slot = document.getElementById("slot-" + i);
      if (slot) {
        slot.style.backgroundImage = "none";
        slot.style.backgroundColor = "transparent";
      }
    }
  }

  /**
   * MARK: 승리 조건 확인
   */
  checkWin() {
    if (window.DEBUG_MODE) console.log("[BrickGame] checkWin 호출");
    // score 모드는 시간 종료 시까지 계속 진행하므로 클리어 조건 없음
    if (this.mode === "score") {
      return false;
    }

    // story 모드에서만 최소 점수 기준으로 클리어 조건 적용
    const requiredScore =
      this.requiredScores[this.difficulty] || this.requiredScores.easy;

    if (this.score >= requiredScore) {
      if (!this.isGameClear) {
        this.showInGameMessage(
          `목표 점수 ${requiredScore}점을(를) 달성했습니다!`,
          true,
        );
      }
      this.isGameClear = true;
      return true;
    }
    return false;
  }

  /**
   * MARK: 공 그리기
   */
  drawBall() {
    if (window.DEBUG_MODE) console.log("[BrickGame] drawBall 호출");
    // 이미지 객체 생성 및 캐싱
    if (!this.ballImage) {
      this.ballImage = new Image();
      if (
        userOption.ballType !== 1 &&
        userOption.ballType !== 2 &&
        userOption.ballType !== 3
      ) {
        console.error(
          `balltype - ${userOption.ballType}, type - ${typeof userOption.ballType}`,
        );
        throw Error("userOption이 1~3 범위 내의 값이 아닙니다.");
      }
      this.ballImage.src = `assets/images/game/object/ball${userOption.ballType}.png`;
    }

    // 이미지가 로드되었는지 확인
    if (this.ballImage.complete) {
      // 이미지를 공 크기(radius * 2)로 그리기, 중심점 기준으로 배치
      let ballSize = this.ball.radius * 2;
      this.ctx.drawImage(
        this.ballImage,
        this.ball.x - this.ball.radius,
        this.ball.y - this.ball.radius,
        ballSize,
        ballSize,
      );
    } else {
      // 이미지 로딩 중일 때는 기존 원형으로 대체
      this.ctx.beginPath();
      this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = this.ball.color;
      this.ctx.fill();
      this.ctx.closePath();
    }
  }
  /**
   * MARK: 패들 그리기
   */
  drawPaddle() {
    if (window.DEBUG_MODE) console.log("[BrickGame] drawPaddle 호출");
    // 이미지 객체 생성 및 캐싱을 위한 정적 변수 사용
    if (!this.paddleImage) {
      this.paddleImage = new Image();
      if (userOption.playerType !== 1 && userOption.playerType !== 2)
        throw Error("userOption.playerType not in range 1~2");
      this.paddleImage.src = `assets/images/game/object/bar${userOption.playerType}.png`;
    }

    // 이미지가 로드되었는지 확인
    if (this.paddleImage.complete) {
      // 이미지를 패들과 같은 크기로 그리기
      this.ctx.drawImage(
        this.paddleImage,
        this.paddle.x,
        this.paddle.y,
        this.paddle.width,
        this.paddle.height,
      );
    } else {
      // 이미지 로딩 중일 때는 기존 사각형으로 대체
      this.ctx.beginPath();
      this.ctx.rect(
        this.paddle.x,
        this.paddle.y,
        this.paddle.width,
        this.paddle.height,
      );
      this.ctx.fillStyle = this.paddle.color;
      this.ctx.fill();
      this.ctx.closePath();
    }
  }
  /**
   * MARK: 동적 벽돌 그리기 메서드 추가
   */
  drawDynamicBricks() {
    if (window.DEBUG_MODE) console.log("[BrickGame] drawDynamicBricks 호출");
    for (let i = 0; i < this.combinations.length; i++) {
      let combination = this.combinations[i];
      for (let j = 0; j < combination.bricks.length; j++) {
        let brick = combination.bricks[j];
        if (brick.status === 1) {
          brick.draw(this.ctx);
          // console.log(`그리기: 벽돌 ${j} (${brick.x}, ${brick.y}) - 상태: ${brick.status}`);
        }
      }
    }
  } /**
   * MARK: 게임 재시작
   */
  restartGame() {
    if (window.DEBUG_MODE) console.log("[BrickGame] restartGame 호출");
    this.clearPokemonSlots(); // 슬롯 초기화

    // MARK: 포켓몬 능력 효과 초기화
    this.electricBoostActive = false;
    this.waterBoostActive = false;
    this.iceBoostActive = false;
    // 불타입 능력 상태 초기화 (수정됨)
    this.fireBoostActive = false;
    this.originalBallSpeed = null;
    this.fireBoostStartTime = null; // 시작 시간 초기화

    // 타이머 정리 코드 제거 (더 이상 timeout 사용하지 않음)

    super.restartGame(); // 부모 클래스의 재시작 메서드 호출
  }

  /**
   * MARK: 현재 시간과 게임 시작 시간, 총 일시정지 시간 차이를 계산하여
   * 불타입 능력의 지속시간이 지났는지 체크하는 메서드
   */
  findNonOverlappingY(minY, maxY, patternHeight) {
    if (window.DEBUG_MODE)
      console.log(
        "[BrickGame] findNonOverlappingY 호출",
        minY,
        maxY,
        patternHeight,
      );
    let attempts = 0;
    let maxAttempts = 10; // 최대 시도 횟수
    let safeMargin = 20; // 조합 간 안전 여백

    while (attempts < maxAttempts) {
      let candidateY = minY + Math.random() * (maxY - minY);
      let isOverlapping = false;

      // 현재 화면에 있는 조합들과 겹치는지 확인
      for (let i = 0; i < this.combinations.length; i++) {
        let existingCombination = this.combinations[i];
        // 화면 내에 있는 조합만 체크 (화면을 벗어난 조합은 무시)
        if (existingCombination.x < this.canvas.width) {
          let existingPatternHeight =
            existingCombination.pattern.length *
            (this.BRICK_HEIGHT + this.BRICK_PADDING);
          let existingTop = existingCombination.y;
          let existingBottom = existingCombination.y + existingPatternHeight;
          let candidateTop = candidateY;
          let candidateBottom = candidateY + patternHeight;

          // Y축 겹침 확인 (안전 여백 포함)
          if (
            !(
              candidateBottom + safeMargin < existingTop ||
              candidateTop - safeMargin > existingBottom
            )
          ) {
            isOverlapping = true;
            break;
          }
        }
      }

      if (!isOverlapping) {
        return candidateY; // 겹치지 않는 위치 발견
      }

      attempts++;
    }

    // 적절한 위치를 찾지 못한 경우 기본 위치 반환
    console.log("조합 배치: 겹치지 않는 위치를 찾지 못해 기본 위치 사용");
    return minY + Math.random() * (maxY - minY);
  }

  /**
   * MARK: 포켓몬 능력 실행 오버라이드 (GameManager에서 상속)
   */
  executePokemonAbility(slotIndex, pokemonIndex, pokemonType) {
    if (window.DEBUG_MODE)
      console.log(
        "[BrickGame] executePokemonAbility 호출",
        slotIndex,
        pokemonIndex,
        pokemonType,
      );
    // 타입별 능력 실행
    switch (pokemonType) {
      case 0: // 풀타입
        this.executeGrassAbility();
        break;
      case 1: // 불타입
        this.executeFireAbility();
        break;
      case 2: // 전기타입
        this.executeElectricAbility();
        break;
      case 3: // 물타입
        this.executeWaterAbility();
        break;
      case 4: // 얼음타입
        this.executeIceAbility();
        break;
      default:
        console.log("알 수 없는 타입의 포켓몬 능력입니다.");
    }
  }

  /**
   * MARK: 풀타입 능력 - 생명력 회복
   */
  executeGrassAbility() {
    if (window.DEBUG_MODE) console.log("[BrickGame] executeGrassAbility 호출");
    const healAmount = GRASS_HEALTH_RESTORE; // 회복량
    this.lives = Math.min(this.totalLives, this.lives + healAmount);
    this.showInGameMessage(`풀타입 능력: 생명력 ${healAmount} 회복!`, true);
    console.log(`풀타입 능력 사용: 생명력 ${healAmount} 회복`);

    // 풀타입 능력 사용 시 사운드 재생
    this.playGrassSound();
  }

  checkFireAbilityDuration() {
    if (this.fireBoostActive && this.fireBoostStartTime !== null) {
      // 현재 게임 경과 시간 계산 (일시정지 시간 제외)
      const currentTime = performance.now();
      const gameElapsedTime = currentTime - this.gameStartTime - this.totalPauseDuration;
      const fireAbilityElapsedTime = gameElapsedTime - this.fireBoostStartTime;

      // 지속시간이 지났는지 확인
      if (fireAbilityElapsedTime >= this.fireBoostDuration) {
        this.endFireAbility();
      }
    }
  }
  /**
   * MARK: 불타입 능력 - 공 속도 증가
   */
  executeFireAbility() {
    if (window.DEBUG_MODE) console.log("[BrickGame] executeFireAbility 호출");

    // 중복 사용 방지: 이미 불타입 능력이 활성화되어 있으면 리턴
    if (this.fireBoostActive) {
      console.log("불타입 능력이 이미 활성화되어 있습니다.");
      return;
    }

    this.fireBoostActive = true; // 불타입 능력 활성 상태 플래그 설정

    // 현재 게임 경과 시간을 기준으로 시작 시간 저장 (일시정지 시간 제외)
    const currentTime = performance.now();
    this.fireBoostStartTime = currentTime - this.gameStartTime - this.totalPauseDuration;

    this.ball.speedX = this.ball.speedX * FIRE_SPEED_BOOST;
    this.ball.speedY = this.ball.speedY * FIRE_SPEED_BOOST;

    this.showInGameMessage("불타입 능력: 공 속도 증가!", true);
    console.log(`불타입 능력 사용: 공 속도 증가 (${this.fireBoostDuration / 1000}초간 지속)`);

    // 불타입 능력 사용 시 사운드 재생
    this.playFireSound();

  }

  endFireAbility() {
    if (window.DEBUG_MODE) console.log(`불타입 능력 효과 종료: 공 속도 원상복구`);
    this.ball.speedX /= FIRE_SPEED_BOOST;
    this.ball.speedY /= FIRE_SPEED_BOOST;
  this.fireBoostActive = false; // 능력 비활성화 - 상태 초기화
  this.fireBoostStartTime = null; // 시작 시간 초기화
  }

  /**
   * MARK: 전기타입 능력 - 점수 2배 증가 (일정 시간)
   */
  executeElectricAbility() {
    if (window.DEBUG_MODE)
      console.log("[BrickGame] executeElectricAbility 호출");
    const duration = 8000; // 지속시간 8초

    if (!this.electricBoostActive) {
      this.electricBoostActive = true;
      this.showInGameMessage("전기타입 능력: 점수 2배 획득!", true);
      console.log("전기타입 능력 사용: 점수 2배 획득");

      // 일정 시간 후 효과 해제
      setTimeout(() => {
        this.electricBoostActive = false;
        console.log("전기타입 능력 효과 종료: 점수 2배 해제");
      }, duration);
    }

    // 전기타입 능력 사용 시 사운드 재생
    this.playElectricSound();
  }

  /**
   * MARK: 물타입 능력 - 패들 크기 증가
   */
  executeWaterAbility() {
    if (window.DEBUG_MODE) console.log("[BrickGame] executeWaterAbility 호출");
    const sizeIncrease = WATER_PADDLE_EXTEND; // 패들 크기 증가량
    const duration = 7000; // 지속시간 7초

    if (!this.waterBoostActive) {
      this.waterBoostActive = true;
      this.paddle.width += sizeIncrease;

      this.showInGameMessage("물타입 능력: 패들 크기 증가!", true);
      console.log("물타입 능력 사용: 패들 크기 증가");

      // 일정 시간 후 크기 원상복구
      setTimeout(() => {
        this.paddle.width -= sizeIncrease;
        this.waterBoostActive = false;
        console.log("물타입 능력 효과 종료: 패들 크기 원상복구");
      }, duration);
    }

    // 물타입 능력 사용 시 사운드 재생
    this.playWaterSound();
  }

  /**
   * MARK: 얼음타입 능력 - 조합 이동 속도 감소
   */
  executeIceAbility() {
    if (window.DEBUG_MODE) console.log("[BrickGame] executeIceAbility 호출");
    const slowFactor = ICE_SPEED_DELAY; // 속도 감소 비율 (70% 감소)
    const duration = 6000; // 지속시간 6초

    if (!this.iceBoostActive) {
      this.iceBoostActive = true;
      this.combinationSpeed *= slowFactor;

      this.showInGameMessage("얼음타입 능력: 조합 이동 속도 감소!", true);
      console.log("얼음타입 능력 사용: 조합 이동 속도 감소");

      // 일정 시간 후 속도 원상복구
      setTimeout(() => {
        this.combinationSpeed /= slowFactor;
        this.iceBoostActive = false;
        console.log("얼음타입 능력 효과 종료: 조합 이동 속도 원상복구");
      }, duration);
    }
    // 얼음타입 능력 사용 시 사운드 재생
    this.playIceSound();
  }

  /**
   * MARK: 풀타입 능력 사운드 재생 (throttling 적용)
   */
  playGrassSound() {
    const currentTime = performance.now(); // 현재 시간 측정
    if (currentTime - this.lastGrassSoundTime > 1000) {
      // 1초 간격으로 제한
      this.lastGrassSoundTime = 0; // 사운드를 처음부터 재생
      playSfx(SFX.GRASS_SFX); // 풀타입 능력 사운드 재생
      this.lastGrassSoundTime = currentTime; // 마지막 사운드 재생 시간 업데이트
    }
  }

  /**
   * MARK: 불타입 능력 사운드 재생 (throttling 적용)
   */
  playFireSound() {
    const currentTime = performance.now(); // 현재 시간 측정
    if (currentTime - this.lastFireSoundTime > 1000) {
      // 1초 간격으로 제한
      this.lastFireSoundTime = 0; // 사운드를 처음부터 재생
      playSfx(SFX.FIRE_SFX); // 불타입 능력 사운드 재생
      this.lastFireSoundTime = currentTime; // 마지막 사운드 재생 시간 업데이트
    }
  }

  /**
   * MARK: 전기타입 능력 사운드 재생 (throttling 적용)
   */
  playElectricSound() {
    const currentTime = performance.now(); // 현재 시간 측정
    if (currentTime - this.lastElectricSoundTime > 1000) {
      // 1초 간격으로 제한
      this.lastElectricSoundTime = 0; // 사운드를 처음부터 재생
      playSfx(SFX.ELECTRIC_SFX); // 전기타입 능력 사운드 재생
      this.lastElectricSoundTime = currentTime; // 마지막 사운드 재생 시간 업데이트
    }
  }

  /**
   * MARK: 물타입 능력 사운드 재생 (throttling 적용)
   */
  playWaterSound() {
    const currentTime = performance.now(); // 현재 시간 측정
    if (currentTime - this.lastWaterSoundTime > 1000) {
      // 1초 간격으로 제한
      this.lastWaterSoundTime = 0; // 사운드를 처음부터 재생
      playSfx(SFX.WATER_SFX); // 물타입 능력 사운드 재생
      this.lastWaterSoundTime = currentTime; // 마지막 사운드 재생 시간 업데이트
    }
  }

  /**
   * MARK: 얼음타입 능력 사운드 재생 (throttling 적용)
   */
  playIceSound() {
    const currentTime = performance.now(); // 현재 시간 측정
    if (currentTime - this.lastIceSoundTime > 1000) {
      // 1초 간격으로 제한
      this.lastIceSoundTime = 0; // 사운드를 처음부터 재생
      playSfx(SFX.ICE_SFX, sfxVolume * 1.5); // 얼음타입 능력 사운드 재생
      this.lastIceSoundTime = currentTime; // 마지막 사운드 재생 시간 업데이트
    }
  }

  /**
   * MARK: 아이템 사용 메서드 - 현재 선택된 슬롯에 적용
   */
  useItemOnSlot(itemName) {
    if (window.DEBUG_MODE)
      console.log("[BrickGame] useItemOnSlot 호출", itemName);

    // 현재 선택된 슬롯 찾기
    let targetSlotIndex = -1;
    const selectedFrame = document.querySelector(
      ".pokemon-slot-frame.selected",
    );

    if (selectedFrame) {
      const frameId = selectedFrame.id;
      const indexMatch = frameId.match(/slot-frame-(\d+)/);
      if (indexMatch) {
        const selectedIndex = parseInt(indexMatch[1]);

        // 배열에서 포켓몬 존재 여부 확인 (DOM 파싱 대신)
        if (this.slotPokemon[selectedIndex]) {
          targetSlotIndex = selectedIndex;
        }
      }
    }

    // 선택된 슬롯에 포켓몬이 없는 경우, 첫 번째 포켓몬이 있는 슬롯으로 폴백  배열에서 검색)
    if (targetSlotIndex === -1) {
      for (let i = 0; i < 4; i++) {
        if (this.slotPokemon[i]) {
          targetSlotIndex = i;
          break;
        }
      }
    }

    if (targetSlotIndex === -1) {
      console.log("아이템을 사용할 포켓몬이 슬롯에 없습니다.");
      return;
    }

    // 아이템 효과량 계산
    let healPercentage = 0;
    switch (itemName) {
      case "normal-potion":
        healPercentage = 0.2; // 20%
        break;
      case "super-potion":
        healPercentage = 0.4; // 40%
        break;
      case "hyper-potion":
        healPercentage = 0.6; // 60%
        break;
      case "full-potion":
        healPercentage = 1.0; // 100%
        break;
      default:
        healPercentage = 0.2;
    }

    const maxHealth = this.pokemonHealthSystem.maxHealth[targetSlotIndex];
    const currentHealth =
      this.pokemonHealthSystem.currentHealth[targetSlotIndex];
    const healAmount = Math.floor(maxHealth * healPercentage);
    const newHealth = Math.min(maxHealth, currentHealth + healAmount);

    this.pokemonHealthSystem.currentHealth[targetSlotIndex] = newHealth;

    if (newHealth > 0 && this.pokemonHealthSystem.isDizzy[targetSlotIndex]) {
      this.pokemonHealthSystem.isDizzy[targetSlotIndex] = false;
      const slot = document.getElementById(`slot-${targetSlotIndex}`);
      if (slot && this.pokemonHealthSystem.originalImages[targetSlotIndex]) {
        slot.style.backgroundImage =
          this.pokemonHealthSystem.originalImages[targetSlotIndex];
        slot.style.filter = "none";
      }
    }

    const itemDisplayName = itemName.replace("-", " ").toUpperCase();
    this.showInGameMessage(
      `${itemDisplayName} 사용! (+${healAmount} HP)}`,
      true,
    );

    // 배열에서 포켓몬 이름 가져오기 (DOM 파싱 대신)
    const pokemonName = this.slotPokemon[targetSlotIndex]
      ? this.slotPokemon[targetSlotIndex].name
      : "포켓몬";
    console.log(
      `아이템 ${itemName} 사용: 슬롯 ${targetSlotIndex + 1} ${pokemonName} 체력 ${healAmount} 회복 (${currentHealth} → ${newHealth})`,
    );
  }

  /**
   * MARK: 일시정지 토글 오버라이드 (수정됨: timeout 관련 로직 제거)
   */
  togglePause() {
    if (window.DEBUG_MODE) console.log("[BrickGame] togglePause 호출");

    // timeout 관련 로직 제거됨 - 이제 시간 기반 추적으로 자동 처리됨
    // 일시정지/해제 시 totalPauseDuration이 자동으로 계산되므로 별도 처리 불필요

    // 부모 클래스의 일시정지 로직 실행
    super.togglePause();
  }

  /**
   * MARK: BrickGame 정적 시작 메서드  gameplay.js에서 이동)
   */
  static startBrickGame(gameInfo) {
    if (window.DEBUG_MODE)
      console.log("[BrickGame] startBrickGame 호출", gameInfo);
    const canvas = qs("#game-canvas");

    currentGame = new BrickGame(canvas);
    currentGame.setGameInfo(gameInfo);
    currentGame.setOnGameEnd(onGameEnd);
    currentGame.startGame();

    return currentGame; // 생성된 게임 인스턴스 반환
  }
}
