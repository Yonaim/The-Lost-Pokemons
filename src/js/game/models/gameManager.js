/**
 * GameManager class
 * - 게임 실행/상태 관리를 수행하는 클래스
 * - 벽돌깨기(brickGame.js)와 보스전(bossGame.js)의 공통 기능을 제공
 */
class GameManager {
  constructor(canvas) {
    if (window.DEBUG_MODE) console.log("[GameManager] constructor 호출");
    // 캔버스 설정
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.animationFrame = null;

    // MARK: 게임 설정 상수들
    this.FPS = 60;
    this.FRAME_DELAY = 1000 / this.FPS;

    // MARK: 난이도별 최소 점수 설정
    this.requiredScores = MIN_REQUIRED_SCORE;

    // 생명 설정 (모드 및 난이도별) // 주석 추가: 생명 설정 구조화
    this.livesConfig = LIVES_CONFIG;

    // 입력 상태
    this.keys = {
      rightPressed: false,
      leftPressed: false,
      spacePressed: false,
    };

    // 공통 게임 오브젝트들
    this.ball = null;
    this.paddle = null;
    this.paddleOffset = 120;
    this.BALL_SPEED = BALL_SPEED; // 공의 기본 속도

    // 다음 스테이지로 넘어가기
    this.onGameEnd = null;

    // MARK: 포켓몬 슬롯 시스템 추가
    this.selectedSlotIndex = 0;

    // MARK: 배경 이미지 시스템 추가
    this.backgroundImage = null;
    this.backgroundImageLoaded = false;
    // MARK: 목숨 아이콘 이미지 추가
    this.ballIcon = new Image();
    this.ballIcon.src = "assets/images/game/object/ball1.png"; // 볼 아이콘 경로 설정
    this.ballIconLoaded = false;
    this.ballIcon.onload = () => {
      this.ballIconLoaded = true; // 볼 아이콘 로드 완료 플래그
    };

    // MARK: 포켓몬 능력 시스템 추가
    this.pokemonAbilitySystem = JSON.parse(
      JSON.stringify(POKEMON_ABLILITY_SYSTEM),
    );
    this.pokemonHealthSystem = JSON.parse(
      JSON.stringify(POKEMON_HEALTH_SYSTEM),
    );

    // 게임 상태 변수들
    this.lastTime = 0;
    this.isGameRunning = false;
    this.isPaused = false;
    this.gameStartTime = 0; // 게임 시작 시간 저장
    this.pauseStartTime = 0; // 일시정지했을때 시간 멈추기 용
    this.totalPauseDuration = 0; // 일시정지한 시간
    this.ballInitialX = this.canvas.width / 2;
    this.ballInitialY = this.canvas.height - this.paddleOffset - 20;

    // 게임 정보
    this.mode = null; // score | story
    this.difficulty = null;
    this.stage = null; // 1~3 : 벽돌깨기, 4 : 보스전
    this.score = 0;
    this.lives = 300; // 현재 유저가 가진 생명령, startGame에서 livesConfig으로 difficulty마다 초기화
    this.totalLives = 300;
    this.isGameClear = false;
    this.saved_pokemon = [];
  }

  _bindInputs() {
    // this를 고정해 둔 핸들러를 만들고 나중에 해제할 때 쓰기 위해 저장
    this._onKeyDown = (e) => this.keyDownHandler(e);
    this._onKeyUp = (e) => this.keyUpHandler(e);
    this._onMouseMove = (e) => this.mouseMoveHandler(e);

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("mousemove", this._onMouseMove);
  }

  _unbindInputs() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("mousemove", this._onMouseMove);
  }

  destroy() {
    this._unbindInputs();
    cancelAnimationFrame(this.animationFrame);
    /* 필요하면 다른 clean-up */
  }

  /**
   * MARK: 게임 정보를 설정하는 메서드
   */
  setGameInfo(data) {
    if (window.DEBUG_MODE) console.log("[GameManager] setGameInfo 호출", data);
    if (!data.mode) {
      throw new Error(`게임 mode 설정 안됨: ${JSON.stringify(data)}`);
    }
    if (!data.difficulty) {
      throw new Error(`게임 difficulty 설정 안됨: ${JSON.stringify(data)}`);
    }

    try {
      if (typeof data === "string") {
        data = JSON.parse(data);
      }
    } catch (e) {
      throw new Error("받은 data가 JSON 형식이 아닙니다");
    }
    if (typeof data.mode !== "string" || typeof data.difficulty !== "string") {
      throw new Error("게임 정보의 형식이 유효하지 않습니다");
    }
    this.mode = data.mode;
    this.difficulty = data.difficulty;
    this.stage = data.stage;
    // if (this.mode === 'score' && !this.stage) {
    //   // score모드 - stage null임 -> random으로 하나 설정
    //   console.log(`스코어 모드 - stage random하게 설정`);
    //   this.stage = Math.floor(Math.random() * 3 + 1);
    // }

    // 스테이지별 배경 이미지 로드 (추가된 기능)
    this.loadStageBackground(data.stage);

    // 레벨에 따른 난이도 설정
    this.setDifficultyBydifficulty(data.difficulty);
  }
  /**
   * 다음 스테이지로 넘어가는 함수를 설정함
   */
  setOnGameEnd(onGameEnd) {
    if (window.DEBUG_MODE) console.log("[GameManager] setOnGameEnd 호출");
    this.onGameEnd = onGameEnd;
  }
  /**
   * 스테이지별 배경 이미지 로드 메서드 (CSS 기반으로 변경)
   * @param {number} stage - 스테이지 번호 (1~4)
   */
  loadStageBackground(stage) {
    if (window.DEBUG_MODE)
      console.log("[GameManager] loadStageBackground 호출", stage);

    // 스테이지 번호 유효성 검사
    if (stage < 1 || stage > 4) {
      // if (this.mode === "story") {
      console.warn(
        `유효하지 않은 스테이지 번호: ${stage}. 기본 배경을 사용합니다.`,
      );
      return;
      // } else {
      //   // 스코어 모드인데 배경 없을 때 - 배경 랜덤으로 하나 지정해서 사용
      //   this.stage = Math.floor(Math.random() * 3) + 1;
      // }
    }

    // CSS background-image로 배경 설정
    const imagePath = `assets/images/game/ui/background-stage-${stage}.png`;
    this.canvas.style.backgroundImage = `url(${imagePath})`;
    this.canvas.style.backgroundSize = "cover"; // 캔버스 크기에 맞게 조정
    this.canvas.style.backgroundPosition = "center"; // 중앙 정렬
    this.canvas.style.backgroundRepeat = "no-repeat"; // 반복 방지

    if (window.DEBUG_MODE)
      console.log(`배경 이미지 CSS 설정 완료: ${imagePath}`);

    // 기존 배경 이미지 관련 변수들 정리 (더 이상 사용하지 않음)
    this.backgroundImage = null;
    this.backgroundImageLoaded = false;
  }

  /**
   * MARK: 레벨에 따른 난이도 설정
   */
  setDifficultyBydifficulty(difficulty) {
    if (window.DEBUG_MODE)
      console.log("[GameManager] setDifficultyBydifficulty 호출", difficulty);
    const gameStage = this.stage === 4 ? "boss" : "brick";
    const currentModeConfig = this.livesConfig[gameStage];

    switch (difficulty) {
      case "easy":
        this.totalLives = currentModeConfig.easy; // 주석 수정: 모드별 난이도에 따른 생명 설정
        break;
      case "normal":
        this.totalLives = currentModeConfig.normal; // 주석 수정: 모드별 난이도에 따른 생명 설정
        break;
      case "hard":
        this.totalLives = currentModeConfig.hard; // 주석 수정: 모드별 난이도에 따른 생명 설정
        break;
      default:
        this.totalLives = currentModeConfig.normal; // 주석 수정: 기본값으로 normal 난이도 생명 설정
    }
    this.lives = this.totalLives;
  }
  /**
   * 공통 게임 오브젝트 초기화
   */
  initializeGameObjects() {
    if (window.DEBUG_MODE)
      console.log("[GameManager] initializeGameObjects 호출");
    // 공 초기화
    this.ball = {
      x: this.ballInitialX,
      y: this.ballInitialY,
      speedX: 0,
      speedY: -this.BALL_SPEED,
      radius: 10,
      color: "#ffeb3b",
    };

    // 패들 초기화
    this.paddle = {
      height: 10,
      width: 110,
      x: (this.canvas.width - 110) / 2,
      y: this.canvas.height - this.paddleOffset,
      color: "#4CAF50",
    };
  }
  /**
   * 키보드 입력 처리
   */
  keyDownHandler(e) {
    // 1. 슬롯 전환/능력 사용 (1~4키)
    if (e.key >= "1" && e.key <= "4") {
      this.handlePokemonAbilityKey(parseInt(e.key) - 1);
      return;
    }

    // 2. 스페이스(일시정지)
    if (e.code === "Space") {
      this.keys.spacePressed = true;
      this.togglePause();
      return;
    }

    // 3. 오른쪽(→, d/D)
    if (
      e.key === "Right" ||
      e.key === "ArrowRight" ||
      e.key === "d" ||
      e.key === "D"
    ) {
      this.keys.rightPressed = true;
      return;
    }

    // 4. 왼쪽(←, a/A)
    if (
      e.key === "Left" ||
      e.key === "ArrowLeft" ||
      e.key === "a" ||
      e.key === "A"
    ) {
      this.keys.leftPressed = true;
      return;
    }
  }

  /**
   * 키보드 입력 해제 처리
   */
  keyUpHandler(e) {
    if (
      e.key === "Right" ||
      e.key === "ArrowRight" ||
      e.key === "d" ||
      e.key === "D"
    ) {
      this.keys.rightPressed = false;
      return;
    }

    if (
      e.key === "Left" ||
      e.key === "ArrowLeft" ||
      e.key === "a" ||
      e.key === "A"
    ) {
      this.keys.leftPressed = false;
      return;
    }

    if (e.code === "Space") {
      this.keys.spacePressed = false;
      return;
    }
  }

  // MARK: 포켓몬 능력 키 입력 처리 메서드 수정
  handlePokemonAbilityKey(slotIndex) {
    if (!this.isGameRunning || this.isPaused) return;
    if (window.DEBUG_MODE)
      console.log("[GameManager] handlePokemonAbilityKey 호출", slotIndex);

    let currentSelectedIndex = -1;
    const selectedFrame = document.querySelector(
      ".pokemon-slot-frame.selected",
    );

    if (selectedFrame) {
      const frameId = selectedFrame.id;
      const indexMatch = frameId.match(/slot-frame-(\d+)/);
      if (indexMatch) {
        currentSelectedIndex = parseInt(indexMatch[1]);
      }
    }

    if (currentSelectedIndex !== slotIndex) {
      this.switchToSlot(slotIndex);
      return;
    }

    const currentTime = performance.now();

    if (
      currentTime - this.pokemonAbilitySystem.lastInputTime[slotIndex] <
      this.pokemonAbilitySystem.throttleInterval
    ) {
      return;
    }
    this.pokemonAbilitySystem.lastInputTime[slotIndex] = currentTime;

    // 주석 추가: 슬롯 포켓몬 배열에서 포켓몬 존재 확인 (BrickGame에서만 사용 가능)
    if (this.slotPokemon && !this.slotPokemon[slotIndex]) {
      console.log(`슬롯 ${slotIndex + 1}에 포켓몬이 없습니다.`);
      return;
    }

    // 기절 상태 체크
    if (this.pokemonHealthSystem.isDizzy[slotIndex]) {
      console.log(
        `슬롯 ${slotIndex + 1} 포켓몬이 기절 상태입니다. 회복할 때까지 능력을 사용할 수 없습니다.`,
      );
      return;
    }

    // 쿨타임 체크
    if (
      currentTime - this.pokemonAbilitySystem.lastUsed[slotIndex] <
      this.pokemonAbilitySystem.defaultCooldown
    ) {
      const remainingCooldown = Math.ceil(
        (this.pokemonAbilitySystem.defaultCooldown -
          (currentTime - this.pokemonAbilitySystem.lastUsed[slotIndex])) /
          1000,
      );
      console.log(
        `슬롯 ${slotIndex + 1} 포켓몬 능력 쿨타임 중입니다. (${remainingCooldown}초 남음)`,
      );
      return;
    }

    // 주석 추가: 포켓몬 인덱스를 배열에서 가져오기 (DOM 파싱 대신)
    let pokemonIndex;
    if (this.slotPokemon && this.slotPokemon[slotIndex]) {
      pokemonIndex = this.slotPokemon[slotIndex].index;
    } else {
      // 폴백: DOM에서 추출 (하위 호환성)
      const slot = document.getElementById(`slot-${slotIndex}`);
      if (
        !slot ||
        !slot.style.backgroundImage ||
        slot.style.backgroundImage === "none"
      ) {
        console.log(`슬롯 ${slotIndex + 1}에 포켓몬이 없습니다.`);
        return;
      }
      const bgImage = slot.style.backgroundImage;
      const indexMatch = bgImage.match(/(\d+)\.png/);
      if (!indexMatch) return;
      pokemonIndex = parseInt(indexMatch[1]);
    }

    this.usePokemonAbility(slotIndex, pokemonIndex);
  }

  // MARK: 슬롯 전환 메서드 수정
  switchToSlot(targetSlotIndex) {
    if (!this.isGameRunning || this.isPaused) return;

    const cur = document.querySelector(".pokemon-slot-frame.selected");
    if (cur) cur.classList.remove("selected");

    // 새 선택 표시
    const frame = document.getElementById(`slot-frame-${targetSlotIndex}`);
    if (frame) {
      frame.classList.add("selected");
      this.selectedSlotIndex = targetSlotIndex;
      this.updateSlotArrow(); // 슬롯 화살표 업데이트
    }
  }

  // GameManager 클래스 내부
  updateSlotArrow() {
    const selected = document.querySelector(".pokemon-slot-frame.selected");
    const arrow = document.getElementById("slot-arrow");
    if (!selected || !arrow) return;
    // 부모 기준 위치 계산 (frame-container 기준으로)
    const parent = selected.parentElement;
    const selRect = selected.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const arrowWidth = arrow.offsetWidth;
    const left =
      selRect.left - parentRect.left + (selRect.width - arrowWidth) / 2;
    arrow.style.left = `${left}px`;
    arrow.style.display = "block";
  }
  // MARK: 포켓몬 능력 사용 메서드
  usePokemonAbility(slotIndex, pokemonIndex) {
    if (window.DEBUG_MODE)
      console.log(
        "[GameManager] usePokemonAbility 호출",
        slotIndex,
        pokemonIndex,
      );
    const currentTime = performance.now();

    // 포켓몬 타입 확인
    let pokemonType = 0; // 기본값: 풀타입
    if (window.pokemon && window.pokemon[pokemonIndex]) {
      pokemonType = window.pokemon[pokemonIndex].type;
    }

    // 타입별 능력명 매핑
    const typeNames = {
      0: "풀타입",
      1: "불타입",
      2: "전기타입",
      3: "물타입",
      4: "얼음타입",
    };

    const typeName = typeNames[pokemonType] || "미지타입";
    console.log(`${typeName} 능력 사용!`);

    // 체력 소모 처리 (추가됨)
    this.consumePokemonHealth(slotIndex);

    // 쿨타임 설정
    this.pokemonAbilitySystem.lastUsed[slotIndex] = currentTime;

    // 하위 클래스에서 오버라이드할 수 있는 메서드 호출
    this.executePokemonAbility(slotIndex, pokemonIndex, pokemonType);
  }
  // MARK: 포켓몬 능력 실행 메서드 (하위 클래스에서 오버라이드)
  executePokemonAbility(slotIndex, pokemonIndex, pokemonType) {
    if (window.DEBUG_MODE)
      console.log(
        "[GameManager] executePokemonAbility 호출",
        slotIndex,
        pokemonIndex,
        pokemonType,
      );
    // 기본 구현: 하위 클래스에서 오버라이드하여 실제 능력 효과 구현
    console.log(
      `슬롯 ${slotIndex + 1}의 포켓몬(인덱스: ${pokemonIndex}, 타입: ${pokemonType}) 능력이 사용되었습니다.`,
    );
  }
  /**
   * 마우스 이동 처리
   */
  mouseMoveHandler(e) {
    // if (window.DEBUG_MODE) console.log('[GameManager] mouseMoveHandler 호출', e.clientX, e.clientY);
    if (this.isGameRunning && !this.isPaused && this.paddle) {
      const rect = this.canvas.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;

      if (relativeX > 0 && relativeX < this.canvas.width) {
        if (relativeX - this.paddle.width / 2 < 0) {
          this.paddle.x = 0;
        } else if (relativeX + this.paddle.width / 2 > this.canvas.width) {
          this.paddle.x = this.canvas.width - this.paddle.width;
        } else {
          this.paddle.x = relativeX - this.paddle.width / 2;
        }
      }
    }
  }
  /**
   * MARK: 포켓몬 구출 메시지 표시 메서드 추가
   */
  // TODO: 리팩토링 필요
  showInGameMessage(message, isNotice = false) {
    if (window.DEBUG_MODE)
      console.log("[GameManager] showInGameMessage 호출", message, isNotice);
    const messageContainer = document.getElementById(
      "rescue-message-container",
    );

    // 기존 메시지 모두 제거
    while (messageContainer.firstChild) {
      messageContainer.removeChild(messageContainer.firstChild);
    }

    // 메시지 엘리먼트 생성
    const messageElement = document.createElement("div");
    messageElement.className = "rescue-message";
    if (isNotice) {
      messageElement.textContent = message;
    } else {
      messageElement.textContent = `${message}을(를) 구출했습니다!`;
    }
    messageContainer.appendChild(messageElement);

    // 크기 단계 값 지정 (레트로 느낌)
    const scaleSteps = [1, 0.85, 0.7, 0.55, 0.4];
    const duration = 500; // 총 애니메이션 시간(ms)
    const delay = 3000; // 3초 후 시작

    setTimeout(() => {
      let step = 0;
      const stepTime = duration / (scaleSteps.length - 1);

      // 크기 줄이기 (뚝뚝 끊기는 효과)
      const scaleInterval = setInterval(() => {
        step++;
        messageElement.style.transform = `scale(${scaleSteps[step]})`;
        messageElement.style.opacity = 1 - step / (scaleSteps.length - 1);
        if (step >= scaleSteps.length - 1) {
          clearInterval(scaleInterval);
          if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
          }
        }
      }, stepTime);
    }, delay);
  }

  /**
   * UI 업데이트 - 모두 brick에서만 수행
   * - 생명 그리기
   * - 스코어 그리기
   * - 포켓몬 체력바 그리기
   */
  updateUI() {
    if (window.DEBUG_MODE) console.log("[GameManager] updateUI 호출");
    // 벽돌깨기 모드일때만 생명, 스코어, 포켓몬 체력바 그리기
    if (this.stage <= 3) {
      // 생명 그리기
      this.drawLives();
      // 스코어 그리기
      this.drawScore();
      // 포켓몬 체력바 모두 갱신
      for (let i = 0; i < 4; i++) {
        this.updatePokemonHealthBar(
          i,
          this.pokemonHealthSystem.currentHealth[i],
          this.pokemonHealthSystem.maxHealth[i],
        );
      }
      this.drawSlotArrowCanvas();
    }
  }
  /**
   * MARK: 목숨 표시
   */
  drawLives() {
    if (window.DEBUG_MODE) console.log("[GameManager] drawLives 호출");
    const iconWidth = 30;
    const iconHeight = 30;
    const iconX = this.canvas.width - 200;
    const iconY = 30;
    const textX = iconX + iconWidth + 5;
    const textY = iconY + iconHeight / 2 + 5;

    if (this.ballIconLoaded) {
      this.ctx.drawImage(
        this.ballIcon,
        iconX - 10,
        iconY + 3,
        iconWidth,
        iconHeight,
      ); // 볼 아이콘 그리기

      const text = `x ${this.lives}`;
      this.ctx.font = "30px DOSGothic";
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "middle";

      const shadowOffsets = [
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ];
      this.ctx.fillStyle = "black";
      shadowOffsets.forEach(([dx, dy]) => {
        this.ctx.fillText(text, textX + dx, textY + dy);
      });

      // 본문(흰색)
      this.ctx.fillStyle = "white";
      this.ctx.fillText(text, textX, textY);
    }
  }

  /**
   * MARK: 점수 그리기
   */
  drawScore() {
    if (window.DEBUG_MODE) console.log("[GameManager] drawScore 호출");
    const scoreElement = qs("#score");
    if (scoreElement) scoreElement.textContent = this.score;
  }

  /**
   * MARK: 일시정지 토글
   */
  togglePause() {
    if (window.DEBUG_MODE) console.log("[GameManager] togglePause 호출");
    if (this.isGameRunning) {
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        playSfx(SFX.PAUSE);
        if (window.DEBUG_MODE)
          console.log("[GameManager] togglePause() - 게임 paused");
        this.pauseStartTime = performance.now();
        cancelAnimationFrame(this.animationFrame);
        // 기존 메시지 대신 모달 표시
        // --- 일시정지 모달 표시 추가 ---
        showUniModal("게임이 일시정지되었습니다.", {
          buttons: [
            {
              label: "계속하기",
              callback: () => {
                // "계속하기"를 누르면 일시정지 해제
                this.togglePause(); // 주석: 다시 togglePause 호출로 재개
              },
            },
            {
              label: "메뉴로 가기",
              callback: () => {
                // "메뉴로 가기"를 누르면 타이틀/메뉴로 이동
                if (typeof handleReturnToTitleScreen === "function") {
                  handleReturnToTitleScreen();
                } else {
                  // fallback: location.reload();
                  window.location.reload();
                }
              },
            },
          ],
        });
        // --- 끝 ---
      } else {
        // 일시정지 해제 시 - 일시정지 지속 시간 계산하여 누적
        if (window.DEBUG_MODE)
          console.log("[GameManager] togglePause() - 게임 resumed");
        const pauseEndTime = performance.now();
        this.totalPauseDuration += pauseEndTime - this.pauseStartTime;
        this.lastTime = performance.now();
        this.animationFrame = requestAnimationFrame((time) =>
          this.update(time),
        );

        this.showInGameMessage("게임 재개", true);
      }
    }
  }
  /**
   * MARK: 게임 시작
   */
  startGame() {
    if (window.DEBUG_MODE) console.log("[GameManager] startGame 호출");
    if (!this.isGameRunning) {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
      }

      // 주석 추가: 게임 시작 전 모든 상태 완전 초기화
      this.resetAllGameStates();

      this.isGameRunning = false;
      this.isPaused = false;
      this.score = 0;
      this.lives = this.totalLives;

      this.pauseStartTime = 0;
      this.totalPauseDuration = 0;

      this.initializeGameObjects();
      // MARK: 벽돌 위치 초기화 추가
      this.resetBricksPosition();

      if (this.initializeGame) {
        this.initializeGame();
      }

      this.updateUI();
      this.drawBackground(); // 게임 화면 표시만 처리

      // NOTE: 조작법 안내
      const howToPlayMessage =
        "조작법: <br>" +
        (this.stage === 4
          ? "W A S D <br> ↑ ← ↓ →<br>주의: 마우스 사용 불가!" // 보스전 조작법
          : "W A S D <br> ↑ ← ↓ → <br>마우스"); // 벽돌 게임 조작법
      // 구분선
      const hr = "<br>---------------------</br>";
      // NOTE: 클리어 조건 메시지
      const clearInfoMessage =
        `클리어 조건: ` +
        (this.stage === 4
          ? `${this.boss.name}을(를) 쓰러뜨려라!` // 보스전 클리어 조건
          : `${this.requiredScores[this.difficulty]}점을 넘겨라!`); // 벽돌 게임 클리어 조건

      this._bindInputs();

      showInfoModal(howToPlayMessage + hr + clearInfoMessage, () => {
        if (window.DEBUG_MODE) console.log("[GameManager] startAnimation 호출");
        hideAllFade(qsa(".screen"));
        showWithFade(qs("#gameplay-screen"));

        this.lastTime = performance.now();
        this.gameStartTime = performance.now();
        this.isGameRunning = true;

        console.log(`${this.mode} 게임을 시작합니다.`);
        this.animationFrame = requestAnimationFrame((time) =>
          this.update(time),
        );
      });
    }
  }

  /**
   * MARK: 게임 재시작
   */
  restartGame() {
    if (window.DEBUG_MODE) console.log("[GameManager] restartGame 호출");
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    this.isGameRunning = false;
    this.lastTime = 0;

    setTimeout(() => this.startGame(), 100);
  }
  /**
   * MARK: 배경 이미지 그리기 메서드 제거 (CSS로 대체됨)
   */
  drawBackground() {
    if (window.DEBUG_MODE)
      console.log(
        "[GameManager] drawBackground 호출 (CSS 배경 사용으로 변경됨)",
      );

    // CSS 배경 이미지를 사용하므로 더 이상 canvas에 직접 그리지 않음
    // 게임 화면 표시만 처리
    if (qs("#gameplay-screen").classList.contains("hidden")) {
      showWithFade(qs("#gameplay-screen"));
    }
    ``;
  }

  /**
   * MARK: 포켓몬 체력 소모 메서드 추가
   */
  consumePokemonHealth(slotIndex) {
    if (window.DEBUG_MODE)
      console.log("[GameManager] consumePokemonHealth 호출", slotIndex);
    // 체력 소모
    this.pokemonHealthSystem.currentHealth[slotIndex] -=
      this.pokemonHealthSystem.healthConsumption;

    // 체력이 0 이하로 떨어진 경우 기절 상태 처리
    if (this.pokemonHealthSystem.currentHealth[slotIndex] <= 0) {
      this.pokemonHealthSystem.currentHealth[slotIndex] = 0;
      this.setPokemonDizzy(slotIndex);
    }
  } // MARK: 포켓몬 기절 상태 설정 메서드 추가 (dizzyImages 배열 활용)
  setPokemonDizzy(slotIndex) {
    if (window.DEBUG_MODE)
      console.log("[GameManager] setPokemonDizzy 호출", slotIndex);
    this.pokemonHealthSystem.isDizzy[slotIndex] = true;

    const slot = document.getElementById(`slot-${slotIndex}`);
    if (!slot) return;

    // 원본 이미지 저장 (아직 저장되지 않은 경우)
    if (!this.pokemonHealthSystem.originalImages[slotIndex]) {
      this.pokemonHealthSystem.originalImages[slotIndex] =
        slot.style.backgroundImage;
    }

    // 포켓몬 인덱스 추출
    const bgImage = slot.style.backgroundImage;
    const indexMatch = bgImage.match(/(\d+)\.png/);
    if (!indexMatch) return;

    const pokemonIndex = parseInt(indexMatch[1]);
    const dizzyImagePath = `assets/images/game/pokemon/potrait/dizzy/${pokemonIndex}.png`;

    // dizzyImages 배열에 이미 저장된 이미지가 있는지 확인
    if (this.pokemonHealthSystem.dizzyImages[slotIndex]) {
      // 이미 로드된 기절 이미지 사용
      slot.style.backgroundImage = `url(${dizzyImagePath})`;
      slot.style.filter = "grayscale(1)"; // 흑백 효과 적용
      console.log(
        `슬롯 ${slotIndex + 1} 포켓몬이 기절했습니다. 저장된 기절 이미지 사용.`,
      );
      return;
    }

    // 기절 이미지 존재 여부 확인 및 dizzyImages 배열에 저장
    const testImage = new Image();
    testImage.onload = () => {
      // 성공적으로 로드된 경우 dizzyImages 배열에 저장
      this.pokemonHealthSystem.dizzyImages[slotIndex] = testImage;

      // 기절 이미지가 존재하는 경우 교체
      slot.style.backgroundImage = `url(${dizzyImagePath})`;
      slot.style.filter = "grayscale(1)"; // 흑백 효과 적용
      console.log(
        `슬롯 ${slotIndex + 1} 포켓몬이 기절했습니다. 기절 이미지로 교체됩니다.`,
      );
    };
    testImage.onerror = () => {
      // 로드 실패한 경우 null로 표시하여 흑백 효과만 사용
      this.pokemonHealthSystem.dizzyImages[slotIndex] = null;

      // 기절 이미지가 없는 경우 흑백 효과만 적용
      slot.style.filter = "grayscale(1)"; // 흑백 효과 적용
      console.log(
        `슬롯 ${slotIndex + 1} 포켓몬이 기절했습니다. 흑백 효과만 적용됩니다.`,
      );
    };
    testImage.src = dizzyImagePath;
  }

  // MARK: 포켓몬 체력 회복 메서드 추가
  healPokemonHealth(slotIndex, healAmount = 50) {
    if (window.DEBUG_MODE)
      console.log(
        "[GameManager] healPokemonHealth 호출",
        slotIndex,
        healAmount,
      );
    // 체력 회복
    this.pokemonHealthSystem.currentHealth[slotIndex] = Math.min(
      this.pokemonHealthSystem.maxHealth[slotIndex],
      this.pokemonHealthSystem.currentHealth[slotIndex] + healAmount,
    );

    // 기절 상태에서 회복된 경우 원본 이미지 복원
    if (
      this.pokemonHealthSystem.isDizzy[slotIndex] &&
      this.pokemonHealthSystem.currentHealth[slotIndex] > 0
    ) {
      this.pokemonHealthSystem.isDizzy[slotIndex] = false;

      const slot = document.getElementById(`slot-${slotIndex}`);
      if (slot && this.pokemonHealthSystem.originalImages[slotIndex]) {
        slot.style.backgroundImage =
          this.pokemonHealthSystem.originalImages[slotIndex];
        slot.style.filter = "none"; // 흑백 효과 제거
        console.log(`슬롯 ${slotIndex + 1} 포켓몬이 회복되었습니다.`);
      }
    }
  }
  // MARK: 포켓몬 체력바 그리기 메서드 추가
  drawPokemonHealthBars() {
    if (window.DEBUG_MODE)
      console.log("[GameManager] drawPokemonHealthBars 호출");

    const barWidth = 60; // 체력바 너비
    const barHeight = 20; // 체력바 높이
    const barY = this.canvas.height - 15; // 체력바 Y 위치 (슬롯 바로 아래)

    for (let i = 0; i < 4; i++) {
      const barX = i * 64 + 2; // 각 슬롯 위치에 맞춰 체력바 위치 계산

      // 주석 추가: 슬롯에 포켓몬이 있는지 확인
      const slot = document.getElementById(`slot-${i}`);
      const hasPokemon =
        slot &&
        slot.style.backgroundImage &&
        slot.style.backgroundImage !== "none";

      if (hasPokemon) {
        // 주석 추가: 포켓몬이 있는 슬롯의 체력바 (기존 로직)
        const healthPercentage =
          this.pokemonHealthSystem.currentHealth[i] /
          this.pokemonHealthSystem.maxHealth[i];

        // 배경 (회색 바)
        this.ctx.fillStyle = "#333333";
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // 체력바 색상 결정 (체력에 따라 색상 변화)
        let healthColor;
        if (healthPercentage > 0.6) {
          healthColor = "#4CAF50"; // 초록색 (양호)
        } else if (healthPercentage > 0.3) {
          healthColor = "#FF9800"; // 주황색 (주의)
        } else {
          healthColor = "#F44336"; // 빨간색 (위험)
        }

        // 현재 체력바
        if (healthPercentage > 0) {
          this.ctx.fillStyle = healthColor;
          this.ctx.fillRect(barX, barY, barWidth * healthPercentage, barHeight);
        }

        // 체력바 테두리
        this.ctx.strokeStyle = "#FFFFFF";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
      } else {
        // 주석 추가: 포켓몬이 없는 슬롯의 기본 회색 체력바
        this.ctx.fillStyle = "#666666"; // 어두운 회색 배경
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // 빈 슬롯 테두리 (더 어두운 색상)
        this.ctx.strokeStyle = "#444444";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
      }
    }
  }

  updatePokemonHealthBar(slotIndex, current, max) {
    const bar = document.getElementById(`health-bar-${slotIndex}`);
    if (!bar) return;

    // 내부 게이지 요소가 없다면 생성
    let inner = bar.querySelector(".pokemon-health-bar-inner");
    if (!inner) {
      inner = document.createElement("div");
      inner.className = "pokemon-health-bar-inner";
      bar.appendChild(inner);
    }

    // 슬롯에 포켓몬이 없으면 0%로!
    const slot = document.getElementById(`slot-${slotIndex}`);
    const hasPokemon =
      slot &&
      slot.style.backgroundImage &&
      slot.style.backgroundImage !== "none";
    if (!hasPokemon) {
      inner.style.width = "0%";
      inner.style.background = "#444";
      return;
    }

    // 정상 포켓몬이 있는 경우만 퍼센트 계산
    const percent = Math.max(0, Math.min(1, current / max));
    inner.style.width = percent * 100 + "%";

    // 색상 변경(체력에 따라)
    if (percent > 0.6) {
      inner.style.background = "#4CAF50";
    } else if (percent > 0.3) {
      inner.style.background = "#FF9800";
    } else {
      inner.style.background = "#F44336";
    }
  }

  /**
   * MARK: 게임 상태 완전 초기화 메서드 추가 (주석 추가: 스테이지 시작 전 모든 상태 리셋)
   */
  resetAllGameStates() {
    if (window.DEBUG_MODE) console.log("[GameManager] resetAllGameStates 호출");

    // 포켓몬 슬롯 완전 초기화 (주석 추가: DOM과 스타일 모두 초기화)
    for (let i = 0; i < 4; i++) {
      const slot = document.getElementById(`slot-${i}`);
      const frame = document.getElementById(`slot-frame-${i}`);

      if (slot) {
        slot.style.backgroundImage = "none";
        slot.style.backgroundColor = "transparent";
        slot.style.filter = "none"; // 기절 상태 흑백 효과 제거
      }

      if (frame) {
        frame.classList.remove("selected"); // 선택 상태 제거
      }
    }

    // 포켓몬 체력 시스템 완전 초기화 (주석 추가: 기절 상태 및 이미지 모두 리셋)
    this.pokemonHealthSystem = {
      maxHealth: [100, 100, 100, 100],
      currentHealth: [100, 100, 100, 100],
      healthConsumption: 20,
      isDizzy: [false, false, false, false],
      dizzyImages: [null, null, null, null],
      originalImages: [null, null, null, null],
    };

    // 체력바 DOM 초기화 (주석 추가: 체력바 시각적 상태 리셋)
    for (let i = 0; i < 4; i++) {
      const healthBar = document.getElementById(`health-bar-${i}`);
      if (healthBar) {
        const inner = healthBar.querySelector(".pokemon-health-bar-inner");
        if (inner) {
          inner.style.width = "0%";
          inner.style.background = "#444";
        }
      }
    }

    // 선택된 슬롯 화살표 숨기기 (주석 추가: 슬롯 선택 UI 초기화)
    const arrow = document.getElementById("slot-arrow");
    if (arrow) {
      arrow.style.display = "none";
    }
    this.selectedSlotIndex = 0; // 선택된 슬롯 인덱스 초기화

    // 게임 메시지 컨테이너 초기화 (주석 추가: 이전 메시지 제거)
    const messageContainer = document.getElementById(
      "rescue-message-container",
    );
    if (messageContainer) {
      while (messageContainer.firstChild) {
        messageContainer.removeChild(messageContainer.firstChild);
      }
    }

    // 보스 모드 CSS 클래스 제거 (주석 추가: 이전 보스전 상태 정리)
    document.body.classList.remove("boss-mode");

    // 포켓몬 슬롯 컨테이너 표시 복구 (주석 추가: 보스전에서 숨겨진 슬롯 다시 표시)
    const slotContainer = document.getElementById("pokemon-slot-container");
    const slotFrameContainer = document.getElementById(
      "pokemon-slot-frame-container",
    );
    if (slotContainer) slotContainer.style.display = "";
    if (slotFrameContainer) slotFrameContainer.style.display = "";

    // 주석 추가: BrickGame에서 사용하는 슬롯 포켓몬 배열 초기화 (있는 경우에만)
    if (this.slotPokemon) {
      this.slotPokemon = [null, null, null, null];
    }

    if (window.DEBUG_MODE)
      console.log("[GameManager] 모든 게임 상태가 초기화되었습니다.");
  }

  /**
   * MARK: 벽돌 위치 초기화 메서드 추가
   */
  resetBricksPosition() {
    if (window.DEBUG_MODE)
      console.log("[GameManager] resetBricksPosition 호출");
    // 벽돌 위치 초기화 로직 구현 (필요한 경우)
    // 예: 모든 벽돌을 초기 위치로 되돌리는 코드
    if (this.bricks && Array.isArray(this.bricks)) {
      while (this.bricks.length > 0) {
        this.bricks.pop();
      }
    } else {
      // console.log(`no blocks found`);
    }
  }

  /**
   * 메인 게임 루프 - 하위 클래스에서 오버라이드
   */
  update(currentTime = 0) {
    if (window.DEBUG_MODE)
      console.log("[GameManager] update 호출", currentTime);
    const deltaTime = currentTime - this.lastTime;

    // 프레임 딜레이를 고려한 업데이트
    // 현재 시간과 마지막 업데이트 시간의 차이를 계산하여 프레임 딜레이보다 작으면 다음 프레임으로 넘어감
    if (deltaTime < this.FRAME_DELAY) {
      this.animationFrame = requestAnimationFrame((time) => this.update(time));
      return;
    }

    this.lastTime = currentTime - (deltaTime % this.FRAME_DELAY);
    const timeMultiplier = deltaTime / this.FRAME_DELAY; // FPS 기반 시간 보정치

    // 게임이 실행 중이고 일시정지가 아닌 경우에만 업데이트
    if (this.isGameRunning && !this.isPaused) {
      // 남은 시간 (ms) - 주석 추가: 보스전은 BOSS_TIME, 그 외는 GAME_TIME 사용
      const elapsedTime =
        currentTime - this.gameStartTime - this.totalPauseDuration;
      const gameTimeLimit = this.stage === 4 ? BOSS_TIME : GAME_TIME; // 주석 추가: 스테이지 4(보스전)일 때 BOSS_TIME 사용
      const timeLeft = Math.max(0, gameTimeLimit - elapsedTime);

      // 분과 초 계산
      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);

      document.getElementById("timer").textContent =
        `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      if (timeLeft <= 0) {
        this.isGameRunning = false;
        cancelAnimationFrame(this.animationFrame);

        // 보스전은 시간 초과 시 무조건 실패
        if (this.stage === 4) {
          if (window.DEBUG_MODE)
            console.log("[GameManager] 보스전 시간 초과 처리");
          this.isGameClear = false;
          this.showInGameMessage(
            "시간 초과! 보스를 시간 내에 처치하지 못했습니다!",
            true,
          );
          this.endGame();
        }
        // 벽돌깨기 게임에서 최소 점수 달성 여부 확인
        else if (this.mode === "story" && this.requiredScores) {
          const requiredScore =
            this.requiredScores[this.difficulty] || this.requiredScores.easy;
          if (this.score >= requiredScore) {
            // 최소 점수 달성 시 게임 클리어
            this.isGameClear = true;
            this.showInGameMessage(
              `게임 클리어!! 잠시 후 다음 화면으로 넘어갑니다.`,
              true,
            );
            setTimeout(() => {
              this.endGame();
            }, 3000);
          } else {
            // 최소 점수 미달성 시 게임 오버
            if (window.DEBUG_MODE)
              console.log("[GameManager] 벽돌깨기 게임 시간 초과 처리");
            this.isGameClear = false;
            this.showInGameMessage(
              "시간 초과! 목표 점수 미달로 게임 오버",
              true,
            );
            this.endGame();
          }
        } else {
          // 기타 게임 모드는 기존 로직 유지
          if (window.DEBUG_MODE)
            console.log("[GameManager] 기타 게임 시간 초과 처리");
          this.endGame();
        }
        return;
      }

      // 캔버스 초기화 (배경 그리기 제거)
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // 하위 클래스의 업데이트 메서드 호출
      if (this.updateGame) {
        this.updateGame(timeMultiplier);
      }

      this.updateUI();
    }

    if (this.isGameRunning) {
      this.animationFrame = requestAnimationFrame((time) => this.update(time));
    }
  }

  /**
   * 게임 종료
   */
  endGame() {
    if (window.DEBUG_MODE) console.log("[GameManager] endGame 호출");
    this.isGameRunning = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this._unbindInputs();

    const result = {
      mode: this.mode,
      difficulty: this.difficulty,
      stage: this.stage,
      score: this.score,
      date: new Date().toISOString(),
      game_over: !this.isGameClear, // 디버그 모드에서는 계속 진행
      saved_pokemon: this.saved_pokemon || [],
    };
    if (!window.DEBUG_GAME && this.onGameEnd) {
      this.onGameEnd(result); // 게임 종료 콜백 호출
    }
  }

  // MARK: 하위 클래스에서 구현해야 할 추상 메서드들
  /**
   * 게임별 초기화 - 하위 클래스에서 구현
   */
  initializeGame() {
    if (window.DEBUG_MODE) console.log("[GameManager] initializeGame 호출");
    // 하위 클래스에서 구현
  }

  /**
   * 게임별 업데이트 로직 - 하위 클래스에서 구현
   */
  updateGame(timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[GameManager] updateGame 호출", timeMultiplier);
    // 하위 클래스에서 구현
  }
}
