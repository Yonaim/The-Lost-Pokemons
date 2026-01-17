let lastImageSrc = null;

// ============================================================================
//                               Skip Modal
// ============================================================================

const skipModal = qs("#confirm-skip-modal");
const btnYes = qs("#skip-confirm-yes");
const btnNo = qs("#skip-confirm-no");

let currentOnSkip = null; // CRT 씬에서 스킵 콜백 저장

function setupStorySkipHandler(onSkip) {
  currentOnSkip = onSkip;
  const btnSkipStory = qs("#btn-skip-story");
  if (btnSkipStory) {
    btnSkipStory.onclick = () => {
      showStorySkipConfirm(() => {
        hideWithFade(qs("#story-screen")); // 스토리 화면 숨김
        const crt = qs("#crt-console-screen"); // CRT 화면도 숨김
        if (crt) crt.classList.add("hidden");
        if (typeof currentOnSkip === "function") currentOnSkip();
      });
    };
  }
}

// ============================================================================
//                              공통 초기화 유틸
// ============================================================================

function resetStoryScreenState() {
  // 1. story-screen 전체 배경 초기화
  const screen = qs("#story-screen");
  screen.style.background = "";
  screen.style.backgroundColor = "";

  // 2. 일러스트 초기화
  const illu = qs("#story-illustration");
  illu.style.backgroundImage = "none";
  illu.style.width = "0";

  // 3. 텍스트 초기화
  qs("#story-line").textContent = "";
  qs("#story-textbox").classList.add("hidden");

  // 4. 엔딩 · 보조 UI 초기화
  const fin = qs("#story-fin-text");
  if (fin) fin.classList.add("hidden");

  lastImageSrc = null; // 마지막 이미지 초기화
}

// ============================================================================
//                           스토리 입장 / 퇴장 제어
// ============================================================================

function showStoryScreen() {
  hideAllFade(qsa(".screen")); // 다른 화면 모두 숨김
  resetStoryScreenState(); // 매번 깨끗하게
  show(qs("#story-screen"));
}

function playStory(stageIndex, finalCallback) {
  console.log(`Playing story for stage ${stageIndex}`);
  showStoryScreen();

  const isEnding = stageIndex > N_STAGES;
  const afterScenes = () => {
    if (isEnding) {
      console.log("Showing ending illustration");
      showEndingIllustration(finalCallback);
    } else {
      finalCallback();
    }
  };

  const scenes = STORY_SCRIPTS[stageIndex] || [];
  setupStorySkipHandler(afterScenes);

  playSceneByIndex(scenes, 0, afterScenes);
}

function playSceneByIndex(scenes, idx, onStoryEnd) {
  if (idx >= scenes.length) {
    onStoryEnd();
    return;
  }
  const scene = scenes[idx];
  playScene(scene, () => playSceneByIndex(scenes, idx + 1, onStoryEnd));
}

// ============================================================================
//                         개별 씬 실행 (텍스트 / 콘솔)
// ============================================================================

function playScene(scene, onDone) {
  playSceneAudio(scene);

  // --- 씬 시작 시 무조건 초기화 ---
  qs("#story-line").textContent = "";
  showStoryIlustration(scene);

  const runScene = () => {
    if (scene.CRT_style) {
      showStorySceneConsole(scene, onDone);
    } else {
      showStorySceneNormal(scene, onDone);
    }
  };

  if (scene.delay) {
    setTimeout(runScene, scene.delay * 1000);
  } else {
    runScene();
  }
}

// ─────────────────────────────────────────────────────────────
// 엔딩 : 일러스트 한 장 -> 「—— Fin ——」 -> 두 번째 클릭으로 종료
// ─────────────────────────────────────────────────────────────
function showEndingIllustration(done) {
  const screen = qs("#story-screen");
  const illust = qs("#story-illustration");
  const textbox = qs("#story-textbox");
  const skipBtn = qs("#btn-skip-story");

  hideWithFade(textbox);
  hideWithFade(skipBtn);
  hideWithFade(illust);

  screen.style.backgroundColor = "black";
  screen.style.background =
    "url('assets/images/story/ending-memory.png') no-repeat center/contain";
  showWithFade(screen);

  let clickCnt = 0;
  screen.onclick = () => {
    clickCnt++;
    if (clickCnt === 1) {
      showWithFade(qs("#story-fin-text"));
    } else if (clickCnt === 2) {
      hideWithFade(qs("#story-fin-text"));
      hideWithFade(screen);
      screen.onclick = null;
      setTimeout(done, 800);
      setTimeout(() => {
        show(skipBtn);
        show(textbox);
        show(illust);
      }, 1000);
    }
  };
}

// ============================================================================
//                       Scene Handlers ― Normal / CRT
// ============================================================================

function showStorySceneNormal(scene, onDone) {
  showStoryIlustration(scene);
  showStoryPotrait(scene);

  const indicator = qs(".story-next-indicator");
  let idx = 0;

  if (!scene.lines || scene.lines.length === 0) {
    qs("#story-textbox").classList.add("hidden");
    if (onDone) onDone();
    return;
  }

  qs("#story-textbox").classList.remove("hidden");
  qs("#story-line").textContent = "";

  const advanceLine = () => {
    if (idx < scene.lines.length) {
      qs("#story-line").textContent = scene.lines[idx];
      playSfx(SFX.STORY);
      if (indicator) {
        indicator.classList.add("hidden");
        setTimeout(() => indicator.classList.remove("hidden"), 50);
      }

      qs("#story-screen").onclick = (e) => {
        if (e.target.id === "btn-skip-story") return;
        idx++;
        advanceLine();
      };
    } else {
      qs("#story-screen").onclick = null;
      if (onDone) onDone();
    }
  };
  advanceLine();
}

// ─────────────────────────────────────────────────────────────
// BUG FIX: 타이핑 타이머 관리 (추후 리팩토링 예정)
// ─────────────────────────────────────────────────────────────
const typingTimers = new Set();

function setTypingTimeout(fn, delay) {
  const id = setTimeout(() => {
    typingTimers.delete(id); // 끝난 타이머는 정리
    fn();
  }, delay);
  typingTimers.add(id);
  return id;
}

function clearAllTypingTimers() {
  typingTimers.forEach(clearTimeout);
  typingTimers.clear();
}

function showStorySceneConsole(scene, onDone) {
  const crtScreen = qs("#crt-console-screen");
  const crtText = qs("#crt-console-text");
  const storyScr = qs("#story-screen");

  if (!scene.lines || scene.lines.length === 0) {
    crtScreen.classList.add("hidden");
    if (onDone) onDone();
    return;
  }

  let idx = 0;
  let skipped = false;

  const crtSkipBtn = crtScreen.querySelector("#btn-skip-story");
  if (crtSkipBtn) {
    if (!crtSkipBtn.hasAttribute("data-crt")) {
      crtSkipBtn.onclick = () => {
        showStorySkipConfirm(() => {
          skipped = true;
          crtScreen.classList.add("hidden");
          clearAllTypingTimers();
          stopSfx();
          if (typeof currentOnSkip === "function") currentOnSkip();
        });
      };
      crtSkipBtn.setAttribute("data-crt", "true");
    }
  }

  stopBgm();
  playSfx(SFX.CRT_ON);

  setTimeout(() => {
    storyScr.classList.add("hidden");
    crtText.textContent = "";
    crtScreen.classList.remove("hidden");
    crtScreen.classList.add("slow-fadein-crt");

    setTimeout(() => typeNextLine(), 1800);
  }, 920);

  function typeNextLine() {
    if (skipped) return;
    if (idx < scene.lines.length) {
      const text = scene.lines[idx];
      let i = 0;
      crtText.textContent = "";

      (function typeChar() {
        if (skipped) return;
        if (i <= text.length) {
          crtText.textContent = text.slice(0, i);
          if (i && text[i - 1] !== " ") playSfx(SFX.CRT_TYPE);
          i++;
          setTypingTimeout(typeChar, 46);
        } else {
          idx++;
          setTimeout(typeNextLine, 500);
        }
      })();
    } else {
      finishCRTScene();
    }
  }

  function finishCRTScene() {
    crtScreen.classList.add("hidden");
    storyScr.classList.remove("hidden");
    crtScreen.classList.remove("slow-fadein-crt");
    crtText.textContent = "";
    if (onDone) onDone();
  }
}

// ============================================================================
//                           Play Scene Utilities
// ============================================================================

function playSceneAudio(scene) {
  if (scene.bgm) playBgm(scene.bgm);
  if (scene.sfx) playSfx(scene.sfx);
}

function showStoryPotrait(scene) {
  const pEl = qs("#story-potrait");
  const line = qs("#story-line");
  if (scene.potrait) {
    pEl.classList.remove("hidden");
    const folder = scene.potrait;
    const type = scene.potrait_type || "Normal";
    pEl.style.background = `url('assets/images/story/potrait/${folder}/${type}.png') center/contain no-repeat`;
    line.classList.add("with-potrait");
  } else {
    pEl.classList.add("hidden");
    line.classList.remove("with-potrait");
    pEl.style.background = "";
  }
}

function showStoryIlustration(scene) {
  const illu = qs("#story-illustration");

  if (!scene.image) {
    illu.style.backgroundImage = "none";
    illu.style.width = "0";
    lastImageSrc = null;
    return;
  }

  if (scene.image === lastImageSrc) {
    // 필요하다면 폭만 업데이트
    if (scene.image_width) {
      illu.style.width = `${scene.image_width}px`;
    } else {
      illu.style.width = "100%";
    }
    return;
  }

  illu.classList.remove("fade-in");
  void illu.offsetWidth; // Reflow → 애니메이션 재시작
  illu.classList.add("fade-in");

  illu.style.backgroundImage = `url('assets/images/story/${scene.image}.png')`;
  illu.style.width = scene.image_width ? `${scene.image_width}px` : "100%";

  /* 4) 현재 이미지를 기록 */
  lastImageSrc = scene.image;
}
