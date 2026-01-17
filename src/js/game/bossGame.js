/**
 * BossGame class
 * - GameManager를 상속받아 보스전 탄막 게임을 구현
 * - 플레이어는 2D 평면에서 회전/가속으로 이동하며 공을 발사
 * - 보스는 탄막을 발사하고 플레이어 공에 맞으면 체력 감소
 */
class BossGame extends GameManager {
  constructor(canvas) {
    if (window.DEBUG_MODE) console.log("[BossGame] constructor 호출", canvas); // 디버깅용 로그 추가
    super(canvas);

    // MARK: 보스전 전용 설정
    this.bossMaxHealth = 1000;
    this.bossHealth = this.bossMaxHealth;

    // MARK: 플레이어 설정
    this.player = {
      x: this.canvas.width / 2,
      y: this.canvas.height - 50,
      power: PLAYER_POWER, // 플레이어 공격력
      rotation: 0, // 라디안 단위 -> initializeGame에서 다시 설정
      velocityX: 0,
      velocityY: 0,
      maxSpeed: 8,
      acceleration: 0.3,
      rotationSpeed: 0.08,
      friction: 0.95,
      radius: 15,
      color: "#00ff00",
    };

    // MARK: 보스 설정
    this.boss = {
      x: this.canvas.width / 2,
      y: 100,
      width: 120, // 초기 너비, 이미지 로드 후 변경될 수 있음
      height: 80, // 초기 높이, 이미지 로드 후 변경될 수 있음
      health: this.bossMaxHealth,
      maxHealth: this.bossMaxHealth,
      color: "#ff0000", // 이미지 로드 실패 시 폴백 색상
      lastAttackTime: 0,
      attackCooldown: 1000, // 1초마다 공격
      bulletSpeed: 3,
      name: "뮤츠",
      description: "전설의 포켓몬, 강력한 정신 공격을 사용합니다.",
      // 페이즈 시스템 추가
      currentPhase: 1, // 현재 페이즈 (1 또는 2)
      phase2Triggered: false, // 2페이즈 전환 여부
      lastMoveTime: 0, // 마지막 이동 시간
      moveCooldown: 3000, // 3초마다 이동
      isMoving: false, // 이동 중인지 여부
      moveStartTime: 0, // 이동 시작 시간
      moveDuration: 500, // 이동 지속 시간 (0.5초)
      startX: 0, // 이동 시작 X 좌표
      startY: 0, // 이동 시작 Y 좌표
      targetX: 0, // 이동 목표 X 좌표
      targetY: 0, // 이동 목표 Y 좌표
      image: new Image(), // 보스 이미지 객체 추가
      imageLoaded: false, // 이미지 로드 완료 플래그 추가
      imagePath: "assets/images/game/boss/mewtwo_normal_1.png", // 보스 이미지 상대 경로 추가
      imageHurt: new Image(), // 피격 시 이미지 객체 추가
      imageHurtLoaded: false, // 피격 이미지 로드 완료 플래그 추가
      imagePathHurt: "assets/images/game/boss/mewtwo_hurt_1.png", // 피격 이미지 경로 추가
      imageAttack: new Image(), // 공격 시 이미지 객체 추가
      imageAttackLoaded: false, // 공격 이미지 로드 완료 플래그 추가
      imagePathAttack: "assets/images/game/boss/mewtwo_attack_1.png", // 공격 이미지 경로 추가
      isHurt: false, // 현재 피격 애니메이션 중인지 여부
      hurtEndTime: 0, // 피격 애니메이션 종료 시간
      hurtAnimationDuration: 200, // 피격 애니메이션 지속 시간 (ms) // 주석 추가: 피격 애니메이션 지속 시간 명시
      isAttacking: false, // 현재 공격 애니메이션 중인지 여부
      attackAnimEndTime: 0, // 공격 애니메이션 종료 시간
      attackAnimationDuration: 300, // 공격 애니메이션 지속 시간 (ms)
    };
    this.boss.image.src = this.boss.imagePath;
    this.boss.image.onload = () => {
      this.boss.imageLoaded = true;
      this.adjustBossImageSize(this.boss.image); // 이미지 크기 조정 함수 호출 // 주석 수정: 이전에 이 위치에 직접 로직이 있었음
      console.log(
        `보스 일반 이미지 로드 완료. 크기: ${this.boss.width}x${this.boss.height}`,
      );
    };
    this.boss.image.onerror = () => {
      console.error(`보스 일반 이미지 로드 실패: ${this.boss.imagePath}`);
      this.boss.imageLoaded = false;
    };

    this.boss.imageHurt.src = this.boss.imagePathHurt; // 피격 이미지 로드
    this.boss.imageHurt.onload = () => {
      this.boss.imageHurtLoaded = true;
      console.log("보스 피격 이미지 로드 완료.");
    };
    this.boss.imageHurt.onerror = () => {
      console.error(`보스 피격 이미지 로드 실패: ${this.boss.imagePathHurt}`);
    };

    this.boss.imageAttack.src = this.boss.imagePathAttack; // 공격 이미지 로드
    this.boss.imageAttack.onload = () => {
      this.boss.imageAttackLoaded = true;
      console.log("보스 공격 이미지 로드 완료.");
    };
    this.boss.imageAttack.onerror = () => {
      console.error(`보스 공격 이미지 로드 실패: ${this.boss.imagePathAttack}`);
    };

    // MARK: 총알 시스템
    this.playerBullets = []; // 플레이어가 발사한 총알
    this.bossBullets = []; // 보스가 발사한 탄막
    this.laserBullets = []; // 레이저 공격용 총알 배열 추가
    this.laserBeams = []; // 주석 추가: 레이저 빔 배열 추가 (선 형태)
    this.playerLastShotTime = 0;
    this.playerShotCooldown = 500; // 0.5초마다 자동 발사

    // MARK: 추가 키 설정
    this.keys.upPressed = false;
    this.keys.downPressed = false;

    // // MARK: 포켓몬 능력 효과 상태 변수 추가
    // this.electricBoostActive = false; // 전기타입 능력 (점수 2배) 활성 상태
    // this.waterBoostActive = false; // 물타입 능력 (플레이어 속도 증가) 활성 상태
    // this.iceBoostActive = false; // 얼음타입 능력 (보스 이동 속도 감소) 활성 상태

    // 사운드 설정
    this.lastHitSoundTime = 0; // 마지막 사운드 재생 시간 (throttling용)
    this.HIT_SOUND_THROTTLE_MS = 1200; // 사운드 재생 최소 간격 (밀리초)
    this.lastHurtAnimationTime = 0; // 마지막 피격 애니메이션 시작 시간 (throttling용)
    this.HURT_ANIMATION_THROTTLE_MS = 200; // 피격 애니메이션 최소 간격 (밀리초)
  }

  /**
   * 키보드 키 눌림 이벤트 처리 (WASD 키 지원 추가)
   */
  keyDownHandler(e) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] keyDownHandler(WASD) 호출", e.key); // 디버깅용 로그 추가
    // 부모 클래스의 기본 키 처리 호출
    super.keyDownHandler(e);

    // WASD 키 지원 추가
    if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
      this.keys.upPressed = true; // W키로 앞으로 가속
    }
    if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
      this.keys.downPressed = true; // S키로 뒤로 가속
    }
    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
      this.keys.leftPressed = true; // A키로 좌회전
    }
    if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
      this.keys.rightPressed = true; // D키로 우회전
    }
  }

  /**
   * 키보드 키 해제 이벤트 처리 (WASD 키 지원 추가)
   * @param {KeyboardEvent} e - 키보드 이벤트
   */
  keyUpHandler(e) {
    if (window.DEBUG_MODE) console.log("[BossGame] keyUpHandler 호출", e.key); // 디버깅용 로그 추가
    // 부모 클래스의 기본 키 처리 호출
    super.keyUpHandler(e);

    // WASD 키 지원 추가
    if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
      this.keys.upPressed = false; // W키 해제
    }
    if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
      this.keys.downPressed = false; // S키 해제
    }
    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
      this.keys.leftPressed = false; // A키 해제
    }
    if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
      this.keys.rightPressed = false; // D키 해제
    }
  }

  /**
   * MARK: 게임별 초기화
   */
  initializeGame() {
    if (window.DEBUG_MODE) console.log("[BossGame] initializeGame 호출");

    // 주석 추가: 플레이어 초기 위치 및 상태 완전 리셋
    this.player.x = this.canvas.width / 2;
    this.player.y = this.canvas.height - 90;
    this.player.rotation = -Math.PI / 2; // 초기 회전 방향 (위쪽)
    this.player.velocityX = 0;
    this.player.velocityY = 0;

    // 주석 추가: 보스 상태 완전 초기화
    this.boss.health = this.boss.maxHealth;
    this.boss.lastAttackTime = 0;
    this.boss.currentPhase = 1;
    this.boss.phase2Triggered = false;
    this.boss.lastMoveTime = 0;
    this.boss.isMoving = false;
    this.boss.isHurt = false;
    this.boss.isAttacking = false;

    // 주석 추가: 총알 배열 완전 초기화
    this.playerBullets = [];
    this.bossBullets = [];
    this.laserBullets = [];
    this.laserBeams = []; // 주석 추가: 레이저 빔 배열 초기화

    // 주석 추가: 사운드 throttling 변수 초기화
    this.lastHitSoundTime = 0;
    this.lastHurtAnimationTime = 0;

    // 보스전에서 포켓몬 슬롯 숨기기
    document.body.classList.add("boss-mode");
    const slotContainer = document.getElementById("pokemon-slot-container");
    const slotFrameContainer = document.getElementById(
      "pokemon-slot-frame-container",
    );
    if (slotContainer) slotContainer.style.display = "none";
    if (slotFrameContainer) slotFrameContainer.style.display = "none";
  }

  /**
   * 게임별 업데이트 로직
   */
  updateGame(timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updateGame 호출", timeMultiplier); // 디버깅용 로그 추가
    this.updatePlayer(timeMultiplier);
    this.updatePlayerBullets(timeMultiplier);
    this.updateBoss(timeMultiplier);
    this.updateBossBullets(timeMultiplier);
    this.updateLaserBullets(timeMultiplier); // 레이저 총알 업데이트 추가
    this.updateLaserBeams(timeMultiplier); // 주석 추가: 레이저 빔 업데이트 추가
    this.checkCollisions();
    this.checkGameEnd();

    // 모든 객체 그리기
    this.drawPlayer();
    this.drawBoss();
    this.drawPlayerBullets();
    this.drawBossBullets();
    this.drawLaserBullets(); // 레이저 총알 그리기 추가
    this.drawLaserBeams(); // 주석 추가: 레이저 빔 그리기 추가
    this.drawHealthBars();
  }

  /**
   * MARK: 플레이어 업데이트
   */
  updatePlayer(timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updatePlayer 호출", timeMultiplier); // 디버깅용 로그 추가

    // 자동 발사 처리
    this.shootPlayerBullet();

    // 회전 처리
    if (this.keys.leftPressed) {
      this.player.rotation -= this.player.rotationSpeed * timeMultiplier;
    }
    if (this.keys.rightPressed) {
      this.player.rotation += this.player.rotationSpeed * timeMultiplier;
    }

    // 가속도 처리 (앞/뒤 이동)
    if (this.keys.upPressed) {
      // 현재 회전 방향으로 가속
      this.player.velocityX +=
        Math.cos(this.player.rotation) *
        this.player.acceleration *
        timeMultiplier;
      this.player.velocityY +=
        Math.sin(this.player.rotation) *
        this.player.acceleration *
        timeMultiplier;
    }
    if (this.keys.downPressed) {
      // 현재 회전 반대 방향으로 가속 (후진)
      this.player.velocityX -=
        Math.cos(this.player.rotation) *
        this.player.acceleration *
        timeMultiplier;
      this.player.velocityY -=
        Math.sin(this.player.rotation) *
        this.player.acceleration *
        timeMultiplier;
    }

    // 최대 속도 제한
    const speed = Math.sqrt(
      this.player.velocityX ** 2 + this.player.velocityY ** 2,
    );
    if (speed > this.player.maxSpeed) {
      this.player.velocityX =
        (this.player.velocityX / speed) * this.player.maxSpeed;
      this.player.velocityY =
        (this.player.velocityY / speed) * this.player.maxSpeed;
    }

    // 마찰력 적용
    this.player.velocityX *= Math.pow(this.player.friction, timeMultiplier);
    this.player.velocityY *= Math.pow(this.player.friction, timeMultiplier);

    // 위치 업데이트
    this.player.x += this.player.velocityX * timeMultiplier;
    this.player.y += this.player.velocityY * timeMultiplier;

    // 화면 경계 처리
    this.player.x = Math.max(
      this.player.radius,
      Math.min(this.canvas.width - this.player.radius, this.player.x),
    );
    this.player.y = Math.max(
      this.player.radius,
      Math.min(this.canvas.height - this.player.radius, this.player.y),
    );
  }

  /**
   * MARK: 플레이어 총알 발사
   */
  shootPlayerBullet() {
    if (window.DEBUG_MODE) console.log("[BossGame] shootPlayerBullet 호출"); // 디버깅용 로그 추가
    const currentTime = performance.now();
    if (currentTime - this.playerLastShotTime >= this.playerShotCooldown) {
      // 플레이어 앞 방향으로 총알 발사
      const bulletSpeed = 10;
      this.playerBullets.push({
        x: this.player.x + Math.cos(this.player.rotation) * this.player.radius,
        y: this.player.y + Math.sin(this.player.rotation) * this.player.radius,
        velocityX: Math.cos(this.player.rotation) * bulletSpeed,
        velocityY: Math.sin(this.player.rotation) * bulletSpeed,
        radius: 4,
        color: "#ffff00",
      });
      this.playerLastShotTime = currentTime;

      playSfx(SFX.PLAYER_ATTACK, sfxVolume * 0.3); // 플레이어 총알 발사 사운드
    }
  }

  /**
   * 플레이어 총알 업데이트
   */
  updatePlayerBullets(timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updatePlayerBullets 호출", timeMultiplier); // 디버깅용 로그 추가
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const bullet = this.playerBullets[i];

      // 총알 이동
      bullet.x += bullet.velocityX * timeMultiplier;
      bullet.y += bullet.velocityY * timeMultiplier;

      // 화면 밖으로 나간 총알 제거
      if (
        bullet.x < 0 ||
        bullet.x > this.canvas.width ||
        bullet.y < 0 ||
        bullet.y > this.canvas.height
      ) {
        this.playerBullets.splice(i, 1);
      }
    }
  }

  /**
   * MARK: 보스 업데이트
   */
  updateBoss(timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updateBoss 호출", timeMultiplier); // 디버깅용 로그 추가

    const currentTime = performance.now();

    // 페이즈 2 전환 체크
    if (
      !this.boss.phase2Triggered &&
      this.boss.health <= this.boss.maxHealth * 0.3
    ) {
      this.triggerPhase2(); // 페이즈 2로 전환
    }

    // 페이즈별 업데이트
    if (this.boss.currentPhase === 1) {
      this.updatePhase1(currentTime, timeMultiplier);
    } else if (this.boss.currentPhase === 2) {
      this.updatePhase2(currentTime, timeMultiplier);
    }
  }
  /**
   * MARK: 페이즈 1 업데이트 (일반 이동 + 전방향 공격)
   */
  updatePhase1(currentTime, timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updatePhase1 호출", currentTime, timeMultiplier); // 디버깅용 로그 추가

    // MARK: 얼음타입 능력 적용 - 보스 이동 쿨다운 증가
    const effectiveMoveCooldown = this.iceBoostActive
      ? this.boss.moveCooldown * 2 // 얼음타입 능력 시 이동 쿨다운 2배 증가
      : this.boss.moveCooldown;

    // 이동 처리
    if (
      !this.boss.isMoving &&
      currentTime - this.boss.lastMoveTime >= effectiveMoveCooldown
    ) {
      this.startBossMove(); // 보스 이동 시작
    }

    if (this.boss.isMoving) {
      this.updateBossMovement(currentTime, timeMultiplier); // 보스 이동 업데이트
    }

    // 공격 처리 (이동 중이 아닐 때만)
    if (
      !this.boss.isMoving &&
      currentTime - this.boss.lastAttackTime >= this.boss.attackCooldown
    ) {
      this.shootBossBullets(); // 전방향 공격
      this.boss.lastAttackTime = currentTime;
    }
  }
  /**
   * MARK: 페이즈 2 업데이트 (순간이동 + 플레이어 조준 공격) - 주석 추가: 전환 연출 추가
   */
  updatePhase2(currentTime, timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updatePhase2 호출", currentTime, timeMultiplier); // 디버깅용 로그 추가

    // 주석 추가: 페이즈 전환 연출 처리
    if (this.boss.isPhaseTransitioning) {
      const elapsedTime = currentTime - this.boss.phaseTransitionStartTime;

      // 레이저 발사 시점 체크
      if (elapsedTime >= this.boss.laserFireTime && !this.boss.laserFired) {
        this.shootLaserAttack(); // 레이저 공격 발사
        this.boss.laserFired = true; // 레이저 발사 완료 플래그
      }

      // 전환 연출 완료 체크
      if (elapsedTime >= this.boss.phaseTransitionDuration) {
        this.boss.isPhaseTransitioning = false; // 전환 연출 종료
        this.boss.laserFired = false; // 플래그 리셋
        this.boss.lastMoveTime = currentTime; // 이동 타이머 리셋
      }

      return; // 전환 중에는 다른 동작 차단
    }

    // MARK: 얼음타입 능력 적용 - 페이즈 2 이동 쿨다운도 증가
    const phase2MoveCooldown = this.iceBoostActive
      ? 4000 // 얼음타입 능력 시 4초마다 이동 (기존 2초에서 2배 증가)
      : 2000; // 기본 2초마다 이동

    // 순간이동 처리 (페이즈 2에서는 더 자주 이동)
    if (
      !this.boss.isMoving &&
      currentTime - this.boss.lastMoveTime >= phase2MoveCooldown
    ) {
      this.startBossTeleport(); // 보스 순간이동 시작
    }

    if (this.boss.isMoving) {
      this.updateBossTeleport(currentTime); // 순간이동 업데이트
    }

    // 공격 처리 (이동 중이 아닐 때만, 더 빠른 공격)
    const phase2AttackCooldown = 800; // 0.8초마다 공격
    if (
      !this.boss.isMoving &&
      currentTime - this.boss.lastAttackTime >= phase2AttackCooldown
    ) {
      // 페이즈 2에서 레이저 공격을 주기적으로 사용
      if (Math.random() < 0.2) {
        // 20% 확률로 레이저 공격
        this.shootLaserAttack();
        this.boss.lastAttackTime = currentTime;
      } else {
        this.shootTargetedBullets(); // 플레이어 조준 공격
        this.boss.lastAttackTime = currentTime;
      }
    }
  }

  /**
   * MARK: 페이즈 2 전환 처리 (주석 추가: 연출 개선)
   */
  triggerPhase2() {
    if (window.DEBUG_MODE) console.log("[BossGame] triggerPhase2 호출"); // 디버깅용 로그 추가

    // 주석 추가: 페이즈 전환 준비 상태 설정
    this.boss.isPhaseTransitioning = true; // 페이즈 전환 중 플래그
    this.boss.phaseTransitionStartTime = performance.now(); // 전환 시작 시간
    this.boss.phaseTransitionDuration = 3000; // 총 전환 지속 시간 (3초)
    this.boss.laserPreparationTime = 1000; // 레이저 발사 전 대기 시간 (1초)
    this.boss.laserFireTime = 1500; // 레이저 발사 시점 (1.5초)
    this.boss.laserEndTime = 2500; // 레이저 종료 시점 (2.5초)

    this.boss.phase2Triggered = true;
    this.boss.currentPhase = 2;
    this.boss.color = "#8b0000"; // 보스 색깔 변경 (더 어두운 빨간색)

    // 주석 추가: 페이즈 2 전환 시 이미지 경로를 _2로 변경
    this.updateBossImagesToPhase2();

    // 페이즈 전환 메시지 표시
    this.showInGameMessage("보스 페이즈 2! 뮤츠가 더욱 강해집니다!", true);
  }

  /**
   * MARK: 페이즈 2 이미지 업데이트 메서드 추가
   */
  updateBossImagesToPhase2() {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updateBossImagesToPhase2 호출"); // 디버깅용 로그 추가

    // 주석 추가: 페이즈 2 이미지 경로 설정 (_1을 _2로 변경)
    const phase2NormalPath = "assets/images/game/boss/mewtwo_normal_2.png";
    const phase2HurtPath = "assets/images/game/boss/mewtwo_hurt_2.png";
    const phase2AttackPath = "assets/images/game/boss/mewtwo_attack_2.png";

    // 주석 추가: 기본 이미지 교체
    this.boss.imagePath = phase2NormalPath;
    this.boss.image = new Image();
    this.boss.imageLoaded = false;
    this.boss.image.onload = () => {
      this.boss.imageLoaded = true;
      this.adjustBossImageSize(this.boss.image); // 이미지 크기 조정
      console.log(`보스 페이즈 2 일반 이미지 로드 완료: ${phase2NormalPath}`);
    };
    this.boss.image.onerror = () => {
      console.error(`보스 페이즈 2 일반 이미지 로드 실패: ${phase2NormalPath}`);
      this.boss.imageLoaded = false;
    };
    this.boss.image.src = phase2NormalPath;

    // 주석 추가: 피격 이미지 교체
    this.boss.imagePathHurt = phase2HurtPath;
    this.boss.imageHurt = new Image();
    this.boss.imageHurtLoaded = false;
    this.boss.imageHurt.onload = () => {
      this.boss.imageHurtLoaded = true;
      console.log(`보스 페이즈 2 피격 이미지 로드 완료: ${phase2HurtPath}`);
    };
    this.boss.imageHurt.onerror = () => {
      console.error(`보스 페이즈 2 피격 이미지 로드 실패: ${phase2HurtPath}`);
      this.boss.imageHurtLoaded = false;
    };
    this.boss.imageHurt.src = phase2HurtPath;

    // 주석 추가: 공격 이미지 교체
    this.boss.imagePathAttack = phase2AttackPath;
    this.boss.imageAttack = new Image();
    this.boss.imageAttackLoaded = false;
    this.boss.imageAttack.onload = () => {
      this.boss.imageAttackLoaded = true;
      console.log(`보스 페이즈 2 공격 이미지 로드 완료: ${phase2AttackPath}`);
    };
    this.boss.imageAttack.onerror = () => {
      console.error(`보스 페이즈 2 공격 이미지 로드 실패: ${phase2AttackPath}`);
      this.boss.imageAttackLoaded = false;
    };
    this.boss.imageAttack.src = phase2AttackPath;
  }

  /**
   * MARK: 보스 이동 시작 (페이즈 1)
   */
  startBossMove() {
    if (window.DEBUG_MODE) console.log("[BossGame] startBossMove 호출"); // 디버깅용 로그 추가
    // 랜덤한 목표 위치 설정 (화면 상단 1/3 영역 내)
    const margin = 60; // 화면 가장자리 여백
    this.boss.startX = this.boss.x;
    this.boss.startY = this.boss.y;
    this.boss.targetX =
      margin + Math.random() * (this.canvas.width - 2 * margin);
    this.boss.targetY =
      margin + Math.random() * (this.canvas.height / 3 - margin);

    this.boss.isMoving = true;
    this.boss.moveStartTime = performance.now();
  }
  /**
   * MARK: 보스 이동 업데이트 (페이즈 1)
   */
  updateBossMovement(currentTime, timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log(
        "[BossGame] updateBossMovement 호출",
        currentTime,
        timeMultiplier,
      ); // 디버깅용 로그 추가
    const elapsed = currentTime - this.boss.moveStartTime;

    // MARK: 얼음타입 능력 적용 - 보스 이동 지속시간 증가 (속도 감소 효과)
    const effectiveMoveDuration = this.iceBoostActive
      ? this.boss.moveDuration * 2 // 얼음타입 능력 시 이동시간 2배 증가 (속도 50% 감소)
      : this.boss.moveDuration;

    const progress = Math.min(elapsed / effectiveMoveDuration, 1);

    // 부드러운 이동을 위한 easing 함수 적용
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    // 현재 위치 계산
    this.boss.x =
      this.boss.startX + (this.boss.targetX - this.boss.startX) * easeProgress;
    this.boss.y =
      this.boss.startY + (this.boss.targetY - this.boss.startY) * easeProgress;

    // 이동 완료 처리
    if (progress >= 1) {
      this.boss.isMoving = false;
      this.boss.lastMoveTime = currentTime;
    }
  }

  /**
   * MARK: 보스 순간이동 시작 (페이즈 2)
   */
  startBossTeleport() {
    if (window.DEBUG_MODE) console.log("[BossGame] startBossTeleport 호출"); // 디버깅용 로그 추가
    // 랜덤한 위치로 순간이동
    const margin = 60;
    this.boss.targetX =
      margin + Math.random() * (this.canvas.width - 2 * margin);
    this.boss.targetY =
      margin + Math.random() * (this.canvas.height / 3 - margin);

    this.boss.isMoving = true;
    this.boss.moveStartTime = performance.now();
    this.boss.moveDuration = 100; // 순간이동은 매우 빠르게 (0.1초)
  }

  /**
   * MARK: 보스 순간이동 업데이트 (페이즈 2)
   */
  updateBossTeleport(currentTime) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updateBossTeleport 호출", currentTime); // 디버깅용 로그 추가
    const elapsed = currentTime - this.boss.moveStartTime;
    const progress = elapsed / this.boss.moveDuration;

    if (progress >= 1) {
      // 순간이동 완료
      this.boss.x = this.boss.targetX;
      this.boss.y = this.boss.targetY;
      this.boss.isMoving = false;
      this.boss.lastMoveTime = currentTime;
      this.boss.moveDuration = 500; // 다음 이동을 위해 지속시간 복구
    }
  }

  /**
   * MARK: 레이저 공격 (페이즈 전환 시) - 주석 추가: 선 형태 레이저로 변경
   */
  shootLaserAttack() {
    if (window.DEBUG_MODE) console.log("[BossGame] shootLaserAttack 호출"); // 디버깅용 로그 추가
    const rayCount = 8; // 8방향으로 레이저 발사 (성능 고려하여 줄임)
    const angleStep = (Math.PI * 2) / rayCount;
    const laserLength = 800; // 레이저 길이
    const laserDuration = 1000; // 레이저 지속 시간 (1초)

    for (let i = 0; i < rayCount; i++) {
      const angle = i * angleStep;
      const endX = this.boss.x + Math.cos(angle) * laserLength;
      const endY =
        this.boss.y + this.boss.height / 2 + Math.sin(angle) * laserLength;

      // 주석 추가: 선 형태 레이저 빔 생성
      this.laserBeams.push({
        startX: this.boss.x,
        startY: this.boss.y + this.boss.height / 2,
        endX: endX,
        endY: endY,
        width: 8, // 레이저 두께
        color: "#ff00ff", // 보라색 레이저
        damage: 20, // 레이저 데미지
        createdTime: performance.now(), // 생성 시간
        duration: laserDuration, // 지속 시간
        opacity: 1.0, // 투명도
      });
    }

    this.boss.isAttacking = true; // 공격 상태 설정
    this.boss.attackAnimEndTime =
      performance.now() + this.boss.attackAnimationDuration; // 공격 애니메이션 종료 시간 설정

    playSfx(SFX.BOSS_LASER); // 레이저 공격 사운드 재생 // 사운드 추가
  }

  /**
   * MARK: 보스 탄막 발사 (플레이어 조준)
   */
  shootTargetedBullets() {
    if (window.DEBUG_MODE) console.log("[BossGame] shootTargetedBullets 호출"); // 디버깅용 로그 추가
    const bulletCount = 5; // 탄막 개수 (성능 고려)
    for (let i = 0; i < bulletCount; i++) {
      // 플레이어 방향으로 각도 계산
      const angle = Math.atan2(
        this.player.y - (this.boss.y + this.boss.height / 2),
        this.player.x - this.boss.x,
      );

      const speed = this.boss.bulletSpeed;
      this.bossBullets.push({
        x: this.boss.x,
        y: this.boss.y + this.boss.height / 2,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        radius: 5,
        color: "#ff00ff", // 보라색으로 변경
      });
    }
    this.boss.isAttacking = true; // 공격 상태 설정
    this.boss.attackAnimEndTime =
      performance.now() + this.boss.attackAnimationDuration; // 공격 애니메이션 종료 시간 설정
    playSfx(SFX.BOSS_ATTACK_2); // 일반 공격 사운드 재생 // 사운드 추가
  }

  /**
   * MARK: 보스 탄막 발사
   */
  shootBossBullets() {
    if (window.DEBUG_MODE) console.log("[BossGame] shootBossBullets 호출"); // 디버깅용 로그 추가
    const bulletCount = 20; // 탄막 개수
    for (let i = 0; i < bulletCount; i++) {
      const angle = Math.random() * Math.PI * 2; // 랜덤한 각도
      const speed = this.boss.bulletSpeed;
      this.bossBullets.push({
        x: this.boss.x,
        y: this.boss.y + this.boss.height / 2,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        radius: 5,
        color: "#ff00ff", // 보라색으로 변경
      });
    }
    this.boss.isAttacking = true; // 공격 상태 설정
    this.boss.attackAnimEndTime =
      performance.now() + this.boss.attackAnimationDuration; // 공격 애니메이션 종료 시간 설정
    playSfx(SFX.BOSS_ATTACK_1); // 페이즈 1 공격 사운드 재생 // 사운드 추가
  }

  /**
   * MARK: 레이저 빔 업데이트 (주석 추가: 선 형태 레이저 관리)
   */
  updateLaserBeams(timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updateLaserBeams 호출", timeMultiplier); // 디버깅용 로그 추가

    const currentTime = performance.now();

    for (let i = this.laserBeams.length - 1; i >= 0; i--) {
      const beam = this.laserBeams[i];
      const elapsedTime = currentTime - beam.createdTime;

      // 지속시간이 지나면 제거
      if (elapsedTime >= beam.duration) {
        this.laserBeams.splice(i, 1);
        continue;
      }

      // 페이드 아웃 효과 (마지막 300ms 동안)
      const fadeStartTime = beam.duration - 300;
      if (elapsedTime >= fadeStartTime) {
        const fadeProgress = (elapsedTime - fadeStartTime) / 300;
        beam.opacity = 1.0 - fadeProgress;
      }
    }
  }

  /**
   * MARK: 레이저 총알 업데이트
   */
  updateLaserBullets(timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updateLaserBullets 호출", timeMultiplier); // 디버깅용 로그 추가
    for (let i = this.laserBullets.length - 1; i >= 0; i--) {
      const laser = this.laserBullets[i];

      // 레이저 총알 이동 로직
      laser.x += laser.velocityX * timeMultiplier;
      laser.y += laser.velocityY * timeMultiplier;

      // 화면 밖으로 나간 레이저 총알 제거
      if (
        laser.x < 0 ||
        laser.x > this.canvas.width ||
        laser.y < 0 ||
        laser.y > this.canvas.height
      ) {
        this.laserBullets.splice(i, 1);
      }
    }
  }

  /**
   * MARK: 보스 탄막 업데이트
   */
  updateBossBullets(timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updateBossBullets 호출", timeMultiplier); // 디버깅용 로그 추가
    for (let i = this.bossBullets.length - 1; i >= 0; i--) {
      const bullet = this.bossBullets[i];

      // 탄막 이동
      bullet.x += bullet.velocityX * timeMultiplier;
      bullet.y += bullet.velocityY * timeMultiplier;

      // 화면 밖으로 나간 탄막 제거
      if (
        bullet.x < 0 ||
        bullet.x > this.canvas.width ||
        bullet.y < 0 ||
        bullet.y > this.canvas.height
      ) {
        this.bossBullets.splice(i, 1);
      }
    }
  }

  /**
   * MARK: 충돌 체크
   */
  checkCollisions() {
    if (window.DEBUG_MODE) console.log("[BossGame] checkCollisions 호출"); // 디버깅용 로그 추가
    this.checkPlayerBulletHitBoss();
    this.checkLaserBeamHitPlayer();
    this.checkBossBulletHitPlayer();
  }

  /**
   * MARK: 플레이어 총알 - 보스 충돌 체크
   */
  checkPlayerBulletHitBoss() {
    if (window.DEBUG_MODE)
      console.log("[BossGame] checkPlayerBulletHitBoss 호출"); // 디버깅용 로그 추가
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const bullet = this.playerBullets[i];
      const dx = bullet.x - this.boss.x;
      const dy = bullet.y - this.boss.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.boss.width / 2 + bullet.radius && !this.boss.isHurt) {
        // 충돌 발생!
        this.playerBullets.splice(i, 1); // 총알 제거

        // 데미지 계산 (플레이어 공격력 기반)
        const damage = this.player.power;
        this.boss.health -= damage; // 보스 체력 감소

        // 피격 애니메이션 및 상태 업데이트
        this.boss.isHurt = true; // 피격 상태로 설정
        this.boss.hurtEndTime =
          performance.now() + this.boss.hurtAnimationDuration; // 피격 애니메이션 종료 시간 설정

        // 사운드 재생 (throttling 적용)
        const currentTime = performance.now();
        if (currentTime - this.lastHitSoundTime > this.HIT_SOUND_THROTTLE_MS) {
          playSfx(SFX.MEWTWO_HURT); // 효과음 재생
          this.lastHitSoundTime = currentTime; // 마지막 재생 시간 업데이트
        }

        // 보스 체력이 0 이하로 떨어지면 게임 종료
        if (this.boss.health <= 0) {
          this.boss.health = 0;
          this.isGameClear = true;
          this.showInGameMessage("보스 처치 성공! 게임 클리어!", true);
          this.endGame();
          return;
        }
      }
    }
  }

  /**
   * MARK: 레이저 빔 - 플레이어 충돌 체크 (선분과 원의 충돌)
   */
  checkLaserBeamHitPlayer() {
    if (window.DEBUG_MODE)
      console.log("[BossGame] checkLaserBeamHitPlayer 호출"); // 디버깅용 로그 추가

    for (const beam of this.laserBeams) {
      // 1. 플레이어의 중심에서 빔의 시작점까지의 벡터 계산
      const px = this.player.x - beam.startX;
      const py = this.player.y - beam.startY;

      // 2. 빔의 방향 벡터 계산
      const dx = beam.endX - beam.startX;
      const dy = beam.endY - beam.startY;

      // 3. 빔의 방향 벡터에 정규화된 플레이어-시작점 벡터를 투영하여 투영 길이(t) 계산
      const beamLengthSquared = dx * dx + dy * dy;
      let t = (px * dx + py * dy) / beamLengthSquared;

      // 4. t 값을 0과 1 사이로 제한 (선분 내부)
      t = Math.max(0, Math.min(1, t));

      // 5. 빔에서 가장 가까운 점 찾기
      const closestX = beam.startX + t * dx;
      const closestY = beam.startY + t * dy;

      // 6. 가장 가까운 점과 플레이어 중심 사이의 거리 계산
      const distanceX = this.player.x - closestX;
      const distanceY = this.player.y - closestY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      // 7. 충돌 여부 확인 (플레이어 반지름보다 가까운 경우)
      if (distance <= this.player.radius) {
        // 8. 충돌 처리: 플레이어 체력 감소 또는 게임 오버 처리
        this.lives -= 1; // 레이저 빔에 맞을 때마다 생명력 1 감소

        // 생명 <= 0이면 게임 끝내기
        if (this.lives <= 0) {
          if (window.DEBUG_MODE) console.log("[BossGame] 생명 0으로 게임 오버"); // 디버깅용 로그 추가
          this.isGameClear = false;
          this.showInGameMessage(
            "게임 오버.. 뮤츠를 쓰러트리지 못했습니다.",
            true,
          );
          this.endGame();
          return;
        }
      }
    }
  }

  /**
   * MARK: 보스 탄막 - 플레이어 충돌 체크
   */
  checkBossBulletHitPlayer() {
    if (window.DEBUG_MODE)
      console.log("[BossGame] checkBossBulletHitPlayer 호출"); // 디버깅용 로그 추가
    for (let i = this.bossBullets.length - 1; i >= 0; i--) {
      const bullet = this.bossBullets[i];
      const dx = bullet.x - this.player.x;
      const dy = bullet.y - this.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.player.radius + bullet.radius) {
        // 충돌 발생!
        this.bossBullets.splice(i, 1); // 탄막 제거
        this.lives -= 1; // 플레이어 생명력 감소

        // 생명 <= 0이면 게임 끝내기
        if (this.lives <= 0) {
          if (window.DEBUG_MODE) console.log("[BossGame] 생명 0으로 게임 오버"); // 디버깅용 로그 추가
          this.isGameClear = false;
          this.showInGameMessage(
            "게임 오버.. 뮤츠를 쓰러트리지 못했습니다.",
            true,
          );
          this.endGame();
          return;
        }
      }
    }
  }

  /**
   * MARK: 게임 종료 조건 확인
   */
  checkGameEnd() {
    if (window.DEBUG_MODE) console.log("[BossGame] checkGameEnd 호출"); // 디버깅용 로그 추가
    if (this.isGameClear) {
      // 보스 처치 성공 시
      this.showInGameMessage("보스 처치 성공! 게임 클리어!", true);
      this.endGame();
    } else if (this.lives <= 0) {
      // 플레이어 생명력 0 이하 시
      this.showInGameMessage("게임 오버.. 뮤츠를 쓰러트리지 못했습니다.", true);
      this.endGame();
    }
  }

  /**
   * MARK: 게임별 업데이트 로직
   */
  updateGame(timeMultiplier) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] updateGame 호출", timeMultiplier); // 디버깅용 로그 추가
    this.updatePlayer(timeMultiplier);
    this.updatePlayerBullets(timeMultiplier);
    this.updateBoss(timeMultiplier);
    this.updateBossBullets(timeMultiplier);
    this.updateLaserBullets(timeMultiplier); // 레이저 총알 업데이트 추가
    this.updateLaserBeams(timeMultiplier); // 주석 추가: 레이저 빔 업데이트 추가
    this.checkCollisions();
    this.checkGameEnd();

    // 모든 객체 그리기
    this.drawPlayer();
    this.drawBoss();
    this.drawPlayerBullets();
    this.drawBossBullets();
    this.drawLaserBullets(); // 레이저 총알 그리기 추가
    this.drawLaserBeams(); // 주석 추가: 레이저 빔 그리기 추가
    this.drawHealthBars();
  }

  /**
   * MARK: 플레이어 그리기
   */
  drawPlayer() {
    if (window.DEBUG_MODE) console.log("[BossGame] drawPlayer 호출"); // 디버깅용 로그 추가
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    this.ctx.rotate(this.player.rotation);

    // 플레이어 이미지 로드
    if (!this.playerImage) {
      this.playerImage = new Image();
      this.playerImage.src =
        userOption.playerType === 1
          ? "assets/images/game/object/pikachu-airplain.png"
          : "assets/images/game/object/pengdori-airplain.png";
    }

    // 이미지가 로드되었는지 확인 후 그리기
    if (this.playerImage.complete) {
      // 이미지 크기 및 위치 조정
      const imageWidth = this.player.radius * 2.5; // 이미지 너비 (기존 삼각형 크기 기반)
      const imageHeight = this.player.radius * 2.5; // 이미지 높이 (기존 삼각형 크기 기반)
      const imageX = -imageWidth / 2; // 이미지 X 위치 (중앙 정렬)
      const imageY = -imageHeight / 2; // 이미지 Y 위치 (중앙 정렬)

      this.ctx.drawImage(
        this.playerImage,
        imageX,
        imageY,
        imageWidth,
        imageHeight,
      );
    } else {
      // 이미지가 로드되지 않았을 경우 폴백(fallback)으로 삼각형 그리기
      this.ctx.beginPath();
      this.ctx.moveTo(this.player.radius, 0);
      this.ctx.lineTo(-this.player.radius / 2, -this.player.radius / 2);
      this.ctx.lineTo(-this.player.radius / 2, this.player.radius / 2);
      this.ctx.closePath();

      this.ctx.fillStyle = this.player.color;
      this.ctx.fill();
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * MARK: 보스 그리기
   */
  drawBoss() {
    if (window.DEBUG_MODE) console.log("[BossGame] drawBoss 호출"); // 디버깅용 로그 추가
    const currentTime = performance.now(); // 현재 시간
    let currentImage = this.boss.image; // 기본 이미지
    let imageToDrawLoaded = this.boss.imageLoaded;

    // 이동 중일 때 반투명 효과 (페이즈 2 순간이동)
    if (this.boss.isMoving && this.boss.currentPhase === 2) {
      this.ctx.globalAlpha = 0.7;
    }

    // 피격 애니메이션 상태 업데이트
    if (this.boss.isHurt && currentTime >= this.boss.hurtEndTime) {
      this.boss.isHurt = false; // 피격 시간 지나면 상태 해제
    }

    // 공격 애니메이션 상태 업데이트
    if (this.boss.isAttacking && currentTime >= this.boss.attackAnimEndTime) {
      this.boss.isAttacking = false; // 공격 애니메이션 시간 지나면 상태 해제
    }

    // 이미지 선택 로직 (피격 > 공격 > 일반 순)
    if (this.boss.isHurt && this.boss.imageHurtLoaded) {
      // 피격 상태이고 피격 이미지가 로드되었으면
      currentImage = this.boss.imageHurt;
      imageToDrawLoaded = this.boss.imageHurtLoaded;
    } else if (this.boss.isAttacking && this.boss.imageAttackLoaded) {
      // 공격 상태이고 공격 이미지가 로드되었으면
      currentImage = this.boss.imageAttack;
      imageToDrawLoaded = this.boss.imageAttackLoaded;
    }
    // 그 외의 경우는 기본 이미지가 이미 설정되어 있음

    if (imageToDrawLoaded) {
      // 선택된 이미지가 로드되었으면 이미지 그리기
      this.ctx.drawImage(
        currentImage, // 현재 상태에 맞는 이미지
        this.boss.x - this.boss.width / 2,
        this.boss.y - this.boss.height / 2,
        this.boss.width,
        this.boss.height,
      );
    } else {
      // 이미지가 로드되지 않았으면 기존 사각형 그리기 (폴백)
      this.ctx.fillStyle = this.boss.color;
      this.ctx.fillRect(
        this.boss.x - this.boss.width / 2,
        this.boss.y - this.boss.height / 2,
        this.boss.width,
        this.boss.height,
      );
    }

    this.ctx.globalAlpha = 1.0; // 투명도 복구
  }

  /**
   * MARK: 플레이어 총알 그리기
   */
  drawPlayerBullets() {
    if (window.DEBUG_MODE) console.log("[BossGame] drawPlayerBullets 호출"); // 디버깅용 로그 추가
    this.playerBullets.forEach((bullet) => {
      this.ctx.beginPath();
      this.ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = bullet.color;
      this.ctx.fill();
    });
  }

  /**
   * MARK: 보스 탄막 그리기
   */
  drawBossBullets() {
    if (window.DEBUG_MODE) console.log("[BossGame] drawBossBullets 호출"); // 디버깅용 로그 추가
    this.bossBullets.forEach((bullet) => {
      this.ctx.beginPath();
      this.ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = bullet.color;
      this.ctx.fill();
    });
  }

  /**
   * MARK: 레이저 총알 그리기
   */
  drawLaserBullets() {
    if (window.DEBUG_MODE) console.log("[BossGame] drawLaserBullets 호출"); // 디버깅용 로그 추가
    this.laserBullets.forEach((laser) => {
      // 레이저 글로우 효과
      this.ctx.save();
      this.ctx.shadowColor = laser.color;
      this.ctx.shadowBlur = 10;

      this.ctx.beginPath();
      this.ctx.arc(laser.x, laser.y, laser.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = laser.color;
      this.ctx.fill();

      this.ctx.restore();
    });
  }
  /**
   * MARK: 레이저 빔 그리기 (주석 추가: 선 형태 레이저 렌더링)
   */
  drawLaserBeams() {
    if (window.DEBUG_MODE) console.log("[BossGame] drawLaserBeams 호출"); // 디버깅용 로그 추가

    this.laserBeams.forEach((beam) => {
      this.ctx.save();
      this.ctx.globalAlpha = beam.opacity;

      // 레이저 글로우 효과
      this.ctx.shadowColor = beam.color;
      this.ctx.shadowBlur = 15;

      // 레이저 빔 그리기 (선)
      this.ctx.beginPath();
      this.ctx.moveTo(beam.startX, beam.startY);
      this.ctx.lineTo(beam.endX, beam.endY);
      this.ctx.strokeStyle = beam.color;
      this.ctx.lineWidth = beam.width;
      this.ctx.lineCap = "round"; // 둥근 끝
      this.ctx.stroke();

      // 중앙 밝은 부분 (더 얇은 선)
      this.ctx.shadowBlur = 5;
      this.ctx.beginPath();
      this.ctx.moveTo(beam.startX, beam.startY);
      this.ctx.lineTo(beam.endX, beam.endY);
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = beam.width / 3;
      this.ctx.stroke();

      this.ctx.restore();
    });
  }

  /**
   * MARK: 체력바 그리기
   */
  drawHealthBars() {
    if (window.DEBUG_MODE) console.log("[BossGame] drawHealthBars 호출"); // 디버깅용 로그 추가
    this.drawBossHealthBar();
    this.drawPlayerHealthBar();
  }

  /**
   * MARK: 보스 체력바 그리기 (상단)
   */
  drawBossHealthBar() {
    if (window.DEBUG_MODE) console.log("[BossGame] drawBossHealthBar 호출"); // 디버깅용 로그 추가
    const bossHealthBarWidth = 300;
    const bossHealthBarHeight = 20;
    const bossHealthBarX = (this.canvas.width - bossHealthBarWidth) / 2;
    const bossHealthBarY = 20;

    // 보스 체력바 배경
    this.ctx.fillStyle = "#333333";
    this.ctx.fillRect(
      bossHealthBarX,
      bossHealthBarY,
      bossHealthBarWidth,
      bossHealthBarHeight,
    );

    // 보스 체력바
    const bossHealthPercent = this.boss.health / this.boss.maxHealth;
    this.ctx.fillStyle = bossHealthPercent > 0.3 ? "#ff4444" : "#ff0000";
    this.ctx.fillRect(
      bossHealthBarX,
      bossHealthBarY,
      bossHealthBarWidth * bossHealthPercent,
      bossHealthBarHeight,
    );

    // 보스 체력바 외곽선
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      bossHealthBarX,
      bossHealthBarY,
      bossHealthBarWidth,
      bossHealthBarHeight,
    );

    // 보스 체력 텍스트
    this.ctx.font = "23px DOSGothic";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    const bossText = `뮤츠 : ${Math.max(0, this.boss.health)} / ${this.boss.maxHealth}`;
    const textX = this.canvas.width / 2;
    const textY = bossHealthBarY + bossHealthBarHeight + 23;

    // 네 방향 검정 테두리
    const shadowOffsets = [
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
    ];
    this.ctx.fillStyle = "black";
    shadowOffsets.forEach(([dx, dy]) => {
      this.ctx.fillText(bossText, textX + dx, textY + dy);
    });

    // 본문(흰색)
    this.ctx.fillStyle = "white";
    this.ctx.fillText(bossText, textX, textY);
  }

  /**
   * MARK: 플레이어 체력바 그리기 (하단)
   */
  drawPlayerHealthBar() {
    if (window.DEBUG_MODE) console.log("[BossGame] drawPlayerHealthBar 호출");
    const playerHealthBarWidth = 200;
    const playerHealthBarHeight = 15;
    const playerHealthBarX = (this.canvas.width - playerHealthBarWidth) / 2;
    const playerHealthBarY = this.canvas.height - 30;

    // 플레이어 체력바 배경
    this.ctx.fillStyle = "#333333";
    this.ctx.fillRect(
      playerHealthBarX,
      playerHealthBarY,
      playerHealthBarWidth,
      playerHealthBarHeight,
    );

    // 플레이어 체력바
    const playerHealthPercent = this.lives / this.totalLives;
    this.ctx.fillStyle = playerHealthPercent > 0.3 ? "#44ff44" : "#ffff44";
    this.ctx.fillRect(
      playerHealthBarX,
      playerHealthBarY,
      playerHealthBarWidth * playerHealthPercent,
      playerHealthBarHeight,
    );

    // 플레이어 체력바 외곽선
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      playerHealthBarX,
      playerHealthBarY,
      playerHealthBarWidth,
      playerHealthBarHeight,
    );

    // ======= 플레이어 체력 텍스트 (네 방향 테두리 + 바 위에) =======
    const text = `HP: ${this.lives} / ${this.totalLives}`;
    this.ctx.font = "23px DOSGothic";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "bottom"; // 바 위에 붙도록

    const textX = this.canvas.width / 2;
    const textY = playerHealthBarY - 10; // 바 바로 위, 여백 조절

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

    this.ctx.fillStyle = "white";
    this.ctx.fillText(text, textX, textY);
  }

  /**
   * 보스 이미지 크기 조정 공통 함수
   */
  adjustBossImageSize(imageInstance) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] adjustBossImageSize 호출", imageInstance); // 디버깅용 로그 추가
    // 주석 추가
    const minWidth = 67.5; // 주석 추가
    const minHeight = 67.5; // 주석 추가
    const maxWidth = 200; // 보스 이미지 최대 너비 // 주석 추가
    const maxHeight = 200; // 보스 이미지 최대 높이 // 주석 추가
    let newWidth = imageInstance.naturalWidth; // 주석 추가
    let newHeight = imageInstance.naturalHeight; // 주석 추가

    if (newWidth > maxWidth) {
      // 주석 추가
      const ratio = maxWidth / newWidth; // 주석 추가
      newWidth = maxWidth; // 주석 추가
      newHeight *= ratio; // 주석 추가
    }
    if (newHeight > maxHeight) {
      // 주석 추가
      const ratio = maxHeight / newHeight; // 주석 추가
      newHeight = maxHeight; // 주석 추가
      newWidth *= ratio; // 주석 추가
    }
    if (newWidth < minWidth) {
      // 주석 추가
      const ratio = minWidth / newWidth; // 주석 추가
      newWidth = minWidth; // 최소 너비 제한 // 주석 추가
      newHeight *= ratio; // 주석 추가
    }
    if (newHeight < minHeight) {
      // 주석 추가
      const ratio = minHeight / newHeight; // 주석 추가
      newHeight = minHeight; // 최소 높이 제한 // 주석 추가
      newWidth *= ratio; // 주석 추가
    }

    // 이 함수는 보스의 기본 렌더링 크기를 설정하는 데 사용됩니다. // 주석 추가
    // imageInstance가 this.boss.image일 때만 this.boss.width와 this.boss.height를 업데이트합니다. // 주석 추가
    if (imageInstance === this.boss.image) {
      // 주석 추가
      this.boss.width = newWidth; // 주석 추가
      this.boss.height = newHeight; // 주석 추가
    } // 주석 추가
  } // 주석 추가

  /**
   * MARK: BossGame 정적 시작 메서드 (주석 추가: gameplay.js에서 이동)
   */
  static startBossGame(gameInfo) {
    if (window.DEBUG_MODE)
      console.log("[BossGame] startBossGame 호출", gameInfo);
    const canvas = qs("#game-canvas");

    currentGame = new BossGame(canvas);
    currentGame.setGameInfo(gameInfo);
    currentGame.setOnGameEnd(onGameEnd);
    currentGame.startGame();

    return currentGame; // 주석 추가: 생성된 게임 인스턴스 반환
  }

  //   // MARK: 포켓몬 능력 실행 오버라이드 (GameManager에서 상속)
  //   executePokemonAbility(slotIndex, pokemonIndex, pokemonType) {
  //     // 타입별 능력 실행
  //     switch (pokemonType) {
  //       case 0: // 풀타입
  //         this.executeGrassAbility();
  //         break;
  //       case 1: // 불타입
  //         this.executeFireAbility();
  //         break;
  //       case 2: // 전기타입
  //         this.executeElectricAbility();
  //         break;
  //       case 3: // 물타입
  //         this.executeWaterAbility();
  //         break;
  //       case 4: // 얼음타입
  //         this.executeIceAbility();
  //         break;
  //       default:
  //         console.log("알 수 없는 타입의 포켓몬 능력입니다.");
  //     }
  //   }

  //   // MARK: 풀타입 능력 - 생명력 회복
  //   executeGrassAbility() {
  //     this.lives += 100; // 생명력 100 회복
  //     if (this.lives > this.totalLives) {
  //       this.lives = this.totalLives; // 최대 생명력 제한
  //     }
  //     console.log("풀타입 능력 사용! 생명력 100 회복");
  //   }

  //   // MARK: 불타입 능력 - 플레이어 이동 속도 증가
  //   executeFireAbility() {
  //     const originalMaxSpeed = this.player.maxSpeed;
  //     this.player.maxSpeed = originalMaxSpeed * 1.5; // 1.5배 속도 증가

  //     console.log("불타입 능력 사용! 플레이어 속도 5초간 증가");

  //     // 5초 후 원래 속도로 복귀
  //     setTimeout(() => {
  //       this.player.maxSpeed = originalMaxSpeed;
  //     }, 5000);
  //   }

  //   // MARK: 전기타입 능력 - 점수 2배 획득
  //   executeElectricAbility() {
  //     this.electricBoostActive = true;
  //     console.log("전기타입 능력 사용! 8초간 점수 2배 획득");

  //     // 8초 후 효과 해제
  //     setTimeout(() => {
  //       this.electricBoostActive = false;
  //     }, 8000);
  //   }

  //   // MARK: 물타입 능력 - 플레이어 가속력 증가
  //   executeWaterAbility() {
  //     this.waterBoostActive = true;
  //     const originalAcceleration = this.player.acceleration;
  //     this.player.acceleration = originalAcceleration * 1.8; // 1.8배 가속력 증가

  //     console.log("물타입 능력 사용! 7초간 플레이어 가속력 증가");

  //     // 7초 후 효과 해제
  //     setTimeout(() => {
  //       this.waterBoostActive = false;
  //       this.player.acceleration = originalAcceleration;
  //     }, 7000);
  //   }
  //   // MARK: 얼음타입 능력 - 보스 이동 속도 감소
  //   executeIceAbility() {
  //     this.iceBoostActive = true;
  //     this.showMessage("얼음타입 능력: 보스 이동 속도 감소!", "success"); // 시각적 피드백 추가
  //     console.log("얼음타입 능력 사용! 6초간 보스 이동 속도 감소");

  //     // 6초 후 효과 해제
  //     setTimeout(() => {
  //       this.iceBoostActive = false;
  //       console.log("얼음타입 능력 효과 종료: 보스 이동 속도 원상복구"); // 종료 로그 추가
  //     }, 6000);
  //   }
}
