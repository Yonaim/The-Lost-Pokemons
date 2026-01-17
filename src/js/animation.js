let cloudAnimTimer = null;

function preloadCloudFrames(frameCount, basePath) {
  const frames = [];
  let loadedCount = 0;
  return new Promise((resolve) => {
    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      img.src = `${basePath}${i}.png`;
      img.onload = () => {
        frames[i] = img;
        loadedCount++;
        if (loadedCount === frameCount) resolve(frames);
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === frameCount) resolve(frames);
      };
    }
  });
}

function startCloudAnimation() {
  const root = document.documentElement;
  const frameCount = 3;
  const basePath = "assets/images/background/main-menu-";
  let frameIdx = 0;
  let frames = [];

  preloadCloudFrames(frameCount, basePath).then((loadedFrames) => {
    frames = loadedFrames;
    if (frames[0] && frames[0].src) {
      root.style.setProperty("--img-main-menu-bg", `url('${frames[0].src}')`);
    }
    cloudAnimTimer = setInterval(() => {
      const img = frames[frameIdx];
      if (img && img.src) {
        root.style.setProperty("--img-main-menu-bg", `url('${img.src}')`);
      }
      frameIdx = (frameIdx + 1) % frameCount;
    }, 600);
  });
}

function stopCloudAnimation() {
  if (cloudAnimTimer !== null) {
    clearInterval(cloudAnimTimer);
    cloudAnimTimer = null;
  }
}
