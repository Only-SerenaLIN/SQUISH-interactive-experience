(() => {
  "use strict";

  const canvas = document.querySelector("#world");
  const ctx = canvas.getContext("2d");
  const invitation = document.querySelector("#invitation");
  const enterButton = document.querySelector("#enterButton");
  const soundButton = document.querySelector("#soundButton");
  const cameraButton = document.querySelector("#cameraButton");
  const backgroundButton = document.querySelector("#backgroundButton");
  const backgroundCopy = backgroundButton.querySelector(".background-copy");
  const cameraPreviewShell = document.querySelector("#cameraPreviewShell");
  const cameraPreview = document.querySelector("#cameraPreview");
  const cameraBackdrop = document.querySelector("#cameraBackdrop");
  const aboutButton = document.querySelector("#aboutButton");
  const tutorialButton = document.querySelector("#tutorialButton");
  const tutorialPanel = document.querySelector("#tutorialPanel");
  const tutorialFocus = document.querySelector("#tutorialFocus");
  const skipTutorial = document.querySelector("#skipTutorial");
  const startTutorial = document.querySelector("#startTutorial");
  const tutorialKicker = document.querySelector("#tutorialKicker");
  const tutorialCounter = document.querySelector("#tutorialCounter");
  const tutorialTitle = document.querySelector("#tutorialTitle");
  const tutorialInstruction = document.querySelector("#tutorialInstruction");
  const tutorialQuickGuide = document.querySelector("#tutorialQuickGuide");
  const tutorialModePicker = document.querySelector("#tutorialModePicker");
  const tutorialProgressBar = document.querySelector("#tutorialProgressBar");
  const tutorialStatus = document.querySelector("#tutorialStatus");
  const tutorialHelp = document.querySelector("#tutorialHelp");
  const tutorialBack = document.querySelector("#tutorialBack");
  const tutorialRetry = document.querySelector("#tutorialRetry");
  const switchToMouse = document.querySelector("#switchToMouse");
  const chooseMouseMode = document.querySelector("#chooseMouseMode");
  const chooseGestureMode = document.querySelector("#chooseGestureMode");
  const tutorialResume = document.querySelector("#tutorialResume");
  const resumeTutorial = document.querySelector("#resumeTutorial");
  const restartTutorial = document.querySelector("#restartTutorial");
  const aboutPanel = document.querySelector("#aboutPanel");
  const closeAbout = document.querySelector("#closeAbout");
  const resetButton = document.querySelector("#resetButton");
  const veil = document.querySelector("#veil");
  const hint = document.querySelector("#hint");
  const babyCount = document.querySelector("#babyCount");

  const TAU = Math.PI * 2;
  const NODES = 72;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const shortestAngle = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    center: { x: 0, y: 0, vx: 0, vy: 0 },
    pointer: { x: 0, y: 0, down: false, id: null, startedAt: 0 },
    pressure: 0,
    pressureVelocity: 0,
    touchAngle: -Math.PI / 2,
    dragDistance: 0,
    contourPressure: 0,
    contourDrag: 0,
    contourAngle: -Math.PI / 2,
    contourRelease: 0,
    interactionMode: "squish",
    birthPull: 0,
    birthAngle: -Math.PI / 2,
    motherMood: "happy",
    motherMoodUntil: 0,
    lastActivityAt: performance.now(),
    activeBaby: null,
    tentaclePlay: { amount: 0, x: 0, y: 0, direction: 0 },
    entered: false,
    soundOn: true,
    lastTime: performance.now(),
    elapsed: 0,
    count: 0,
    nodes: Array.from({ length: NODES }, (_, i) => ({
      angle: (i / NODES) * TAU,
      value: 0,
      velocity: 0,
      phase: Math.sin(i * 4.17) * 0.7,
    })),
    memories: [],
    ripples: [],
    babies: [],
    bubbles: [],
    dust: [],
    audio: null,
    tutorial: {
      active: false,
      step: "WELCOME",
      mode: localStorage.getItem("preferredInputMode") || "mouse",
      progress: 0,
      startedAt: 0,
      actionStartedAt: 0,
      stableFrames: 0,
      success: false,
      helpLevel: 0,
      spawnedBaby: null,
      initialBabyCount: 0,
      cameraCheckFrames: 0,
    },
    camera: {
      enabled: false,
      ready: false,
      starting: false,
      active: false,
      handsfree: null,
      hands: null,
      startupTimer: null,
      previewTimer: null,
      backgroundMode: false,
      backgroundRequested: false,
      lastFrameAt: 0,
      x: 0,
      y: 0,
      presence: 0,
      presenceFrames: 0,
      absentFrames: 0,
      cursorAlpha: 0,
      suspendedUntil: 0,
      requestToken: 0,
      rearm: true,
      fingerAX: 0,
      fingerAY: 0,
      fingerBX: 0,
      fingerBY: 0,
      pinchRatio: 2,
      pinchFrames: 0,
      openFrames: 0,
      fistFrames: 0,
      openPalmFrames: 0,
      bubbleArmedAt: 0,
      bubbleCooldownUntil: 0,
      palmX: 0,
      palmY: 0,
      gestureOriginX: 0,
      gestureOriginY: 0,
      pointerOriginX: 0,
      pointerOriginY: 0,
      indexPrevX: null,
      indexPrevY: null,
      touchBaby: null,
    },
  };

  const memorySeed = 0;
  for (let i = 0; i < Math.min(memorySeed, 24); i += 1) {
    const angle = ((i * 2.3999 + memorySeed * 0.37) % TAU) - Math.PI;
    state.memories.push({
      angle,
      radius: 0.22 + ((i * 37) % 55) / 100,
      size: 2.5 + (i % 4) * 0.75,
      hue: i % 3,
      phase: i * 0.83,
      landX: 0.08 + ((i * 0.618033 + memorySeed * 0.071) % 0.84),
      landPeak: 0.08 + ((i * 29 + memorySeed * 7) % 10) / 100,
    });
  }

  for (let i = 0; i < 30; i += 1) {
    state.dust.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.4 + Math.random() * 1.6,
      speed: 0.015 + Math.random() * 0.025,
      phase: Math.random() * TAU,
      alpha: 0.08 + Math.random() * 0.18,
    });
  }

  const palette = [
    [103, 207, 255],
    [174, 147, 255],
    [255, 148, 204],
    [111, 232, 216],
    [255, 210, 164],
  ];

  const vortexPalette = [
    [104, 221, 214],
    [112, 173, 230],
    [202, 126, 218],
  ];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * state.dpr);
    canvas.height = Math.round(rect.height * state.dpr);
    state.width = rect.width;
    state.height = rect.height;
    if (!state.center.x) {
      state.center.x = rect.width * 0.5;
      state.center.y = rect.height * 0.51;
      state.pointer.x = state.center.x;
      state.pointer.y = state.center.y;
    }
  }

  function baseRadius() {
    return clamp(Math.min(state.width, state.height) * 0.205, 118, 230);
  }

  function initAudio() {
    if (state.audio) return state.audio;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      state.soundOn = false;
      updateSoundButton();
      return null;
    }
    state.audio = new AudioContext();
    return state.audio;
  }

  function tone(strength, angle) {
    if (!state.soundOn) return;
    const audio = initAudio();
    if (!audio) return;
    if (audio.state === "suspended") audio.resume();
    const now = audio.currentTime;
    const master = audio.createGain();
    const filter = audio.createBiquadFilter();
    const fundamental = 176 + strength * 66 + (Math.sin(angle) + 1) * 12;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(980, now);
    filter.frequency.exponentialRampToValueAtTime(360, now + 1.15);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.045, now + 0.045);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
    master.connect(filter).connect(audio.destination);

    [1, 2.01, 3.02].forEach((ratio, index) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = index === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(fundamental * ratio, now);
      osc.frequency.exponentialRampToValueAtTime(fundamental * ratio * 0.985, now + 1.1);
      gain.gain.value = index === 0 ? 1 : 0.13 / index;
      osc.connect(gain).connect(master);
      osc.start(now + index * 0.018);
      osc.stop(now + 1.3);
    });
  }

  function popTone(strength, angle) {
    if (!state.soundOn) return;
    const audio = initAudio();
    if (!audio) return;
    if (audio.state === "suspended") audio.resume();
    const now = audio.currentTime;
    const gain = audio.createGain();
    const osc = audio.createOscillator();
    const overtone = audio.createOscillator();
    const overtoneGain = audio.createGain();
    const pitch = 340 + strength * 95 + (Math.cos(angle) + 1) * 18;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.036, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch * 1.18, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.72, now + 0.28);
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(pitch * 1.9, now);
    overtone.frequency.exponentialRampToValueAtTime(pitch * 1.12, now + 0.18);
    overtoneGain.gain.value = 0.11;
    osc.connect(gain).connect(audio.destination);
    overtone.connect(overtoneGain).connect(gain);
    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.32);
    overtone.stop(now + 0.22);
  }

  function updateSoundButton() {
    soundButton.setAttribute("aria-pressed", String(state.soundOn));
    soundButton.setAttribute("aria-label", state.soundOn ? "关闭声音" : "开启声音");
  }

  function updateCameraButton(label = "模式·鼠标") {
    const engaged = state.camera.enabled || state.camera.starting;
    cameraButton.setAttribute("aria-pressed", String(engaged));
    cameraButton.setAttribute("aria-label", engaged ? "关闭摄像头手势" : "开启摄像头手势");
    cameraButton.querySelector(".camera-copy").textContent = engaged && label === "模式·鼠标" ? "模式·手势" : label;
    cameraButton.classList.toggle("is-calibrating", state.camera.starting || (state.camera.enabled && !state.camera.ready));
  }

  function updateBackgroundButton() {
    const active = state.camera.backgroundMode || state.camera.backgroundRequested;
    backgroundButton.setAttribute("aria-pressed", String(active));
    backgroundButton.setAttribute("aria-label", active ? "切换为深海背景" : "切换为摄像头背景");
    backgroundCopy.textContent = active ? "背景·镜头" : "背景·深海";
  }

  function applyBackgroundMode(active) {
    state.camera.backgroundMode = Boolean(active && state.camera.enabled);
    state.camera.backgroundRequested = false;
    document.body.classList.toggle("camera-background", state.camera.backgroundMode);
    cameraPreviewShell.classList.toggle("is-visible", state.camera.enabled && !state.camera.backgroundMode && cameraPreview.readyState >= 2);
    cameraPreviewShell.setAttribute("aria-hidden", String(!state.camera.enabled || state.camera.backgroundMode));
    updateBackgroundButton();
  }

  function toggleBackgroundMode() {
    if (state.camera.backgroundMode || state.camera.backgroundRequested) {
      applyBackgroundMode(false);
      hint.textContent = "深海重新漫回来了";
      return;
    }
    if (state.camera.enabled) {
      applyBackgroundMode(true);
      hint.textContent = "镜头成为了这片海的背景";
      return;
    }
    state.camera.backgroundRequested = true;
    updateBackgroundButton();
    hint.textContent = "正在打开镜头背景";
    startCamera();
  }

  function cancelCameraGesture() {
    state.camera.active = false;
    if (state.pointer.id === "camera") {
      releasePointer();
    }
  }

  function shutdownHandsfree(handsfree) {
    if (!handsfree) return;
    try {
      handsfree.pause();
      const stream = handsfree.debug?.stream || handsfree.debug?.$video?.srcObject;
      stream?.getTracks?.().forEach((track) => track.stop());
      if (handsfree.debug?.$video) {
        handsfree.debug.$video.pause();
        handsfree.debug.$video.srcObject = null;
      }
      if (handsfree.debug) handsfree.debug.stream = null;
    } catch (error) {
      // The library can be interrupted before its video element exists.
    }
    document.body.classList.remove("handsfree-started", "handsfree-loading");
  }

  function hideCameraPreview() {
    if (state.camera.previewTimer) window.clearTimeout(state.camera.previewTimer);
    state.camera.previewTimer = null;
    cameraPreviewShell.classList.remove("is-visible");
    cameraPreviewShell.setAttribute("aria-hidden", "true");
    cameraPreview.pause();
    cameraPreview.srcObject = null;
    cameraBackdrop.pause();
    cameraBackdrop.srcObject = null;
    document.body.classList.remove("camera-background");
  }

  function showCameraPreview(handsfree, attempt = 0) {
    if (!state.camera.enabled || state.camera.handsfree !== handsfree) return;
    const stream = handsfree.debug?.stream || handsfree.debug?.$video?.srcObject;
    const hasLiveVideo = Boolean(stream?.getVideoTracks?.().some((track) => track.readyState === "live"));
    if (!hasLiveVideo) {
      if (attempt < 16) {
        state.camera.previewTimer = window.setTimeout(() => showCameraPreview(handsfree, attempt + 1), 120);
      }
      return;
    }
    state.camera.previewTimer = null;
    cameraPreview.srcObject = stream;
    cameraBackdrop.srcObject = stream;
    cameraPreview.play().catch(() => {});
    cameraBackdrop.play().catch(() => {});
    if (state.camera.backgroundRequested) applyBackgroundMode(true);
    else applyBackgroundMode(state.camera.backgroundMode);
  }

  function stopCamera(message = "摄像头手势已关闭") {
    state.camera.requestToken += 1;
    cancelCameraGesture();
    if (state.camera.startupTimer) window.clearTimeout(state.camera.startupTimer);
    hideCameraPreview();
    shutdownHandsfree(state.camera.handsfree);
    Object.assign(state.camera, {
      enabled: false,
      ready: false,
      starting: false,
      handsfree: null,
      hands: null,
      startupTimer: null,
      previewTimer: null,
      backgroundMode: false,
      backgroundRequested: false,
      presence: 0,
      presenceFrames: 0,
      absentFrames: 0,
      cursorAlpha: 0,
      rearm: true,
      pinchRatio: 2,
      pinchFrames: 0,
      openFrames: 0,
      fistFrames: 0,
      openPalmFrames: 0,
      bubbleArmedAt: 0,
      bubbleCooldownUntil: 0,
      indexPrevX: null,
      indexPrevY: null,
      touchBaby: null,
    });
    updateCameraButton();
    updateBackgroundButton();
    if (message) hint.textContent = message;
  }

  function startCamera() {
    if (state.camera.starting || state.camera.enabled) return;
    if (!window.Handsfree || !navigator.mediaDevices?.getUserMedia) {
      state.camera.backgroundRequested = false;
      updateBackgroundButton();
      hint.textContent = "Handsfree.js 尚未载入，仍可用鼠标或触屏";
      return;
    }
    if (!state.entered) enter();
    const requestToken = ++state.camera.requestToken;
    state.camera.starting = true;
    updateCameraButton("手势·加载中");
    hint.textContent = "正在准备手部动作模型，首次打开会稍慢";
    try {
      const handsfree = new window.Handsfree({
        showDebug: false,
        assetsPath: "https://unpkg.com/handsfree@8.5.1/build/lib/assets",
        hands: {
          enabled: true,
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.5,
        },
        plugin: {
          pinchers: { enabled: true },
        },
      });
      Object.assign(state.camera, {
        handsfree,
        hands: null,
        lastFrameAt: 0,
        x: state.center.x,
        y: state.center.y,
        presence: 0,
        presenceFrames: 0,
        absentFrames: 0,
        cursorAlpha: 0,
        rearm: true,
        pinchRatio: 2,
        pinchFrames: 0,
        openFrames: 0,
        fistFrames: 0,
        openPalmFrames: 0,
        bubbleArmedAt: 0,
        bubbleCooldownUntil: 0,
      });
      handsfree.use("squishBridge", ({ hands }) => {
        if (state.camera.requestToken === requestToken) state.camera.hands = hands || null;
      });
      state.camera.startupTimer = window.setTimeout(() => {
        if (state.camera.requestToken !== requestToken || !state.camera.starting) return;
        stopCamera("Handsfree.js 加载超时，请检查网络后重试");
      }, 45000);
      handsfree.start(() => {
        if (state.camera.requestToken !== requestToken) {
          shutdownHandsfree(handsfree);
          return;
        }
        if (state.camera.startupTimer) window.clearTimeout(state.camera.startupTimer);
        handsfree.hideDebugger();
        Object.assign(state.camera, {
          enabled: true,
          ready: true,
          starting: false,
          startupTimer: null,
          previewTimer: null,
        });
        updateCameraButton("模式·手势");
        showCameraPreview(handsfree);
        hint.textContent = "一指逗水母；双指捏母体会出生；在空白海水握拳再张开会释放气泡";
      });
    } catch (error) {
      if (state.camera.requestToken !== requestToken) return;
      shutdownHandsfree(state.camera.handsfree);
      state.camera.starting = false;
      state.camera.handsfree = null;
      updateCameraButton();
      state.camera.backgroundRequested = false;
      updateBackgroundButton();
      const blocked = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      hint.textContent = blocked ? "没有获得摄像头权限，仍可用鼠标或触屏" : "Handsfree.js 启动失败，仍可用鼠标或触屏";
    }
  }

  function toggleCamera() {
    if (state.camera.enabled || state.camera.starting) stopCamera();
    else startCamera();
  }

  function landmarkDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  }

  function extendedFingerCount(landmarks) {
    const wrist = landmarks[0];
    return [[8, 6], [12, 10], [16, 14], [20, 18]].reduce((count, [tipIndex, jointIndex]) => {
      const tipDistance = landmarkDistance(wrist, landmarks[tipIndex]);
      const jointDistance = landmarkDistance(wrist, landmarks[jointIndex]);
      return count + (tipDistance > jointDistance * 1.18 ? 1 : 0);
    }, 0);
  }

  function processCameraGesture(now) {
    const camera = state.camera;
    if (!camera.enabled || !camera.handsfree || now - camera.lastFrameAt < 30) return;
    camera.lastFrameAt = now;
    const hands = camera.hands || camera.handsfree.data?.hands;
    const landmarks = hands?.multiHandLandmarks?.[0];
    const present = Boolean(landmarks && landmarks.length >= 21);
    let pinching = false;
    if (present) {
      const thumb = landmarks[4];
      const index = landmarks[8];
      const palmA = landmarks[5];
      const palmB = landmarks[17];
      const palmCenter = landmarks[9];
      const handedness = hands.multiHandedness?.[0]?.label;
      const handSlot = handedness === "Right" ? 0 : 1;
      const pinchState = hands.pinchState?.[handSlot]?.[0] || "";
      const pluginPinching = pinchState === "start" || pinchState === "held";
      const targetAX = (1 - thumb.x) * state.width;
      const targetAY = thumb.y * state.height;
      const targetBX = (1 - index.x) * state.width;
      const targetBY = index.y * state.height;
      const targetX = (targetAX + targetBX) * 0.5;
      const targetY = (targetAY + targetBY) * 0.5;
      const fingerGap = Math.hypot(thumb.x - index.x, thumb.y - index.y);
      const palmWidth = Math.max(0.035, Math.hypot(palmA.x - palmB.x, palmA.y - palmB.y));
      const targetPinchRatio = fingerGap / palmWidth;
      const openFingerCount = extendedFingerCount(landmarks);
      const fistDetected = openFingerCount <= 1;
      const openPalmDetected = openFingerCount >= 4;
      // Handsfree can occasionally keep reporting a pinch while the thumb is
      // already folded away from an extended index finger. Cross-check the
      // plugin state with the actual landmark gap so single-finger play stays live.
      pinching = (pluginPinching && targetPinchRatio < 0.92) || targetPinchRatio < 0.46;
      // A quicker follow factor keeps the cursor attached to the real hand
      // without removing the small amount of smoothing needed for jitter.
      const smoothing = camera.presenceFrames ? 0.66 : 1;
      camera.fingerAX = mix(camera.fingerAX || targetAX, targetAX, smoothing);
      camera.fingerAY = mix(camera.fingerAY || targetAY, targetAY, smoothing);
      camera.fingerBX = mix(camera.fingerBX || targetBX, targetBX, smoothing);
      camera.fingerBY = mix(camera.fingerBY || targetBY, targetBY, smoothing);
      camera.x = mix(camera.x || targetX, targetX, smoothing);
      camera.y = mix(camera.y || targetY, targetY, smoothing);
      camera.palmX = mix(camera.palmX || (1 - palmCenter.x) * state.width, (1 - palmCenter.x) * state.width, smoothing);
      camera.palmY = mix(camera.palmY || palmCenter.y * state.height, palmCenter.y * state.height, smoothing);
      camera.pinchRatio = mix(camera.pinchRatio, targetPinchRatio, 0.62);
      camera.presence = mix(camera.presence, clamp((0.76 - camera.pinchRatio) / 0.56, 0, 1), 0.56);
      camera.presenceFrames += 1;
      camera.absentFrames = 0;
      if (pinching) {
        camera.pinchFrames += 1;
        camera.openFrames = 0;
      } else {
        camera.openFrames += 1;
        camera.pinchFrames = 0;
      }
      camera.fistFrames = fistDetected ? Math.min(12, camera.fistFrames + 1) : Math.max(0, camera.fistFrames - 2);
      camera.openPalmFrames = openPalmDetected ? Math.min(12, camera.openPalmFrames + 1) : 0;
    } else {
      camera.presence *= 0.82;
      camera.presenceFrames = 0;
      camera.absentFrames += 1;
      camera.pinchFrames = 0;
      camera.openFrames += 1;
      camera.fistFrames = 0;
      camera.openPalmFrames = 0;
      if (camera.absentFrames >= 8) camera.bubbleArmedAt = 0;
    }
    camera.cursorAlpha = mix(camera.cursorAlpha, present ? 1 : 0, present ? 0.3 : 0.16);

    if (state.tutorial.active && state.tutorial.mode === "gesture") {
      const tutorial = state.tutorial;
      if (tutorial.step === "CAMERA_CHECK") {
        tutorial.cameraCheckFrames = present ? Math.min(10, tutorial.cameraCheckFrames + 1) : 0;
        tutorial.progress = tutorial.cameraCheckFrames / 10;
        renderTutorialPanel();
      } else if (present && tutorial.step === "APPROACH") {
        const distance = Math.hypot(camera.fingerBX - state.center.x, camera.fingerBY - state.center.y);
        tutorial.progress = clamp(1 - (distance - baseRadius() * 1.15) / (baseRadius() * 1.5), 0, 1);
        renderTutorialPanel();
        if (distance <= baseRadius() * 1.38) completeTutorialStep("APPROACH");
      } else if (present && !pinching && tutorial.step === "TOUCH") {
        const fingerX = camera.fingerBX;
        const fingerY = camera.fingerBY;
        const distance = Math.hypot(fingerX - state.center.x, fingerY - state.center.y);
        if (distance <= baseRadius() * 0.92) {
          tutorial.stableFrames += 1;
          tutorial.progress = clamp(tutorial.stableFrames / 6, 0, 1);
          state.touchAngle = Math.atan2(fingerY - state.center.y, fingerX - state.center.x);
          state.nodes.forEach((node) => {
            const proximity = Math.exp(-Math.pow(shortestAngle(node.angle, state.touchAngle) / 0.48, 2));
            node.velocity -= proximity * 0.016;
          });
          state.pressure = Math.max(state.pressure, 0.32);
          setMotherMood();
          renderTutorialPanel();
          if (tutorial.stableFrames >= 6) completeTutorialStep("TOUCH");
        } else {
          tutorial.stableFrames = Math.max(0, tutorial.stableFrames - 1);
        }
      } else if (!present && tutorial.step !== "CAMERA_CHECK") {
        tutorialStatus.textContent = "手部识别暂时丢失，当前动作已暂停";
      }

      if (present && tutorial.step === "BUBBLE_INTERACTION" && pinching && camera.pinchFrames === 2 && camera.rearm) {
        const distance = Math.hypot(camera.x - state.center.x, camera.y - state.center.y);
        if (distance > baseRadius() * 1.35) {
          createBubble(camera.x, camera.y, "gesture");
          camera.rearm = false;
          tutorial.progress = 0.45;
          renderTutorialPanel();
        }
      }
    }

    // Bubble vocabulary is deliberately different from pinching the mother:
    // hold a fist in open water, then open the palm to release one bubble.
    if (present && !state.tutorial.active && !camera.active && now >= camera.bubbleCooldownUntil) {
      const palmDistance = Math.hypot(camera.palmX - state.center.x, camera.palmY - state.center.y);
      const inOpenWater = palmDistance > baseRadius() * 1.48;
      if (!camera.bubbleArmedAt && inOpenWater && camera.fistFrames >= 4) {
        camera.bubbleArmedAt = now;
        hint.textContent = "气泡已经聚在拳心——现在慢慢张开手掌";
      }
      if (camera.bubbleArmedAt && camera.openPalmFrames >= 2) {
        createPalmBubble(camera.palmX, camera.palmY);
        camera.bubbleArmedAt = 0;
        camera.bubbleCooldownUntil = now + 850;
        camera.suspendedUntil = now + 220;
      } else if (camera.bubbleArmedAt && now - camera.bubbleArmedAt > 2200) {
        camera.bubbleArmedAt = 0;
        hint.textContent = "在空白海水重新握拳，再完整张开手掌";
      }
    }

    let cameraTouchBaby = null;
    let playingTentacles = false;
    const allowSingleFingerPlay = !state.tutorial.active || state.tutorial.step === "BABY_INTERACTION";
    if (present && !camera.active && !pinching && now >= camera.suspendedUntil && allowSingleFingerPlay) {
      const fingerX = camera.fingerBX;
      const fingerY = camera.fingerBY;
      const previousX = camera.indexPrevX ?? fingerX;
      const previousY = camera.indexPrevY ?? fingerY;
      const deltaX = clamp(fingerX - previousX, -28, 28);
      const deltaY = clamp(fingerY - previousY, -28, 28);
      const speed = Math.hypot(deltaX, deltaY);
      const heldBaby = camera.touchBaby && state.babies.includes(camera.touchBaby)
        ? camera.touchBaby
        : null;
      const heldDistance = heldBaby ? Math.hypot(fingerX - heldBaby.x, fingerY - heldBaby.y) : Infinity;
      const heldRadius = heldBaby ? Math.max(48, heldBaby.size * 4.4) : 0;
      const touchedBaby = heldDistance <= heldRadius ? heldBaby : findTouchableBaby(fingerX, fingerY, 1.85);
      if (touchedBaby) {
        cameraTouchBaby = touchedBaby;
        const distanceX = touchedBaby.x - fingerX;
        const distanceY = touchedBaby.y - fingerY;
        const distance = Math.max(1, Math.hypot(distanceX, distanceY));
        const entering = camera.touchBaby !== touchedBaby;
        touchedBaby.cameraTouch = 1.35;
        touchedBaby.touchAngle = Math.atan2(fingerY - touchedBaby.y, fingerX - touchedBaby.x);
        touchedBaby.vx += deltaX * 0.24 + (distanceX / distance) * (entering ? 3.6 : 0.34);
        touchedBaby.vy += deltaY * 0.24 + (distanceY / distance) * (entering ? 3.6 : 0.34);
        if (entering && touchedBaby.personality === "shy") {
          touchedBaby.vx += (distanceX / distance) * 8;
          touchedBaby.vy += (distanceY / distance) * 8;
          touchedBaby.expression = "shy";
        } else if (entering && touchedBaby.personality === "lively") {
          touchedBaby.vx += -distanceY / distance * 7;
          touchedBaby.vy += distanceX / distance * 7;
          touchedBaby.expression = "happy";
        } else if (entering) {
          touchedBaby.expression = "gentle";
        }
        touchedBaby.releaseGlow = Math.max(touchedBaby.releaseGlow, entering ? 0.72 : 0.28);
        if (entering) {
          state.ripples.push({
            x: touchedBaby.x,
            y: touchedBaby.y,
            age: 0,
            strength: 0.11,
            hue: touchedBaby.hue,
            duration: 0.8,
          });
          if (state.tutorial.active && state.tutorial.step === "BABY_INTERACTION") completeTutorialStep("BABY_INTERACTION");
        }
        camera.touchBaby = touchedBaby;
        hint.textContent = "指尖碰到了它——它软软地让开了";
      } else {
        camera.touchBaby = null;
        const radius = baseRadius();
        const inTentacles =
          Math.abs(fingerX - state.center.x) <= radius * 1.02 &&
          fingerY >= state.center.y + radius * 0.24 &&
          fingerY <= state.center.y + radius * 1.62;
        if (inTentacles) {
          const positionForce = clamp((fingerX - state.center.x) / (radius * 0.72), -1, 1);
          const motionForce = clamp(deltaX / 7, -1, 1);
          const fingerForce = Math.abs(deltaX) > 1.4
            ? mix(positionForce * 0.42, motionForce, 0.78)
            : positionForce * 0.82;
          state.tentaclePlay.x = fingerX;
          state.tentaclePlay.y = fingerY;
          state.tentaclePlay.direction = mix(
            state.tentaclePlay.direction,
            fingerForce,
            0.72,
          );
          state.tentaclePlay.amount = Math.max(state.tentaclePlay.amount, clamp(0.56 + speed / 10, 0.56, 1.18));
          playingTentacles = true;
          hint.textContent = "食指拨过触须——它们顺着水流摆开了";
        }
      }
      camera.indexPrevX = fingerX;
      camera.indexPrevY = fingerY;
    } else if (!present || pinching) {
      camera.indexPrevX = null;
      camera.indexPrevY = null;
      camera.touchBaby = null;
    }

    // Two open frames are enough to re-arm. The previous four-frame lockout
    // made quick, deliberate second pinches feel randomly ignored.
    if (present && !pinching && !camera.active && camera.openFrames >= 1) camera.rearm = true;

    const canControl = now >= camera.suspendedUntil && (!state.pointer.down || state.pointer.id === "camera");
    if (present && canControl) {
      if (!camera.active) {
        const distance = Math.hypot(camera.x - state.center.x, camera.y - state.center.y);
        // Keep the grab window open while the fingers remain pinched. Requiring
        // exactly the third detected frame meant moving onto the bell one frame
        // late could never start a gesture.
        const tutorialGrabAllowed =
          !state.tutorial.active ||
          state.tutorial.step === "SQUISH" ||
          (state.tutorial.step === "SPAWN" && isTutorialTopZone(camera.x, camera.y));
        if (camera.rearm && camera.pinchFrames >= 2 && distance <= baseRadius() * 1.45 && tutorialGrabAllowed) {
          camera.active = true;
          camera.rearm = false;
          camera.gestureOriginX = camera.x;
          camera.gestureOriginY = camera.y;
          camera.pointerOriginX = camera.x;
          camera.pointerOriginY = camera.y;
          state.pointer = { x: camera.x, y: camera.y, startX: camera.x, startY: camera.y, down: true, id: "camera", startedAt: now };
          state.activeBaby = null;
          state.touchAngle = Math.atan2(camera.y - state.center.y, camera.x - state.center.x);
          state.interactionMode = isBirthZone(camera.x, camera.y, true) ? "birth" : "squish";
          state.birthAngle = Math.atan2(camera.y - state.center.y, camera.x - state.center.x);
          if (state.tutorial.active && state.tutorial.step === "SQUISH") state.interactionMode = "squish";
          if (state.tutorial.active && state.tutorial.step === "SPAWN") {
            state.interactionMode = "birth";
            state.birthAngle = -Math.PI / 2;
            state.touchAngle = -Math.PI / 2;
          }
          state.birthPull = 0;
          canvas.classList.add("is-touching");
          hint.textContent = state.interactionMode === "birth"
            ? "边缘已抓住——保持捏合，沿外侧方向拉"
            : "已经抓住；滑到伞盖任意边缘后向外拉";
        } else if (camera.openFrames >= 2) {
          hint.textContent = cameraTouchBaby
            ? "指尖碰到了它——它软软地让开了"
            : playingTentacles
              ? "食指拨过触须——它们顺着水流摆开了"
              : "食指逗小水母或拨触须；双指移到母体再捏合";
        } else if (pinching && distance > baseRadius() * 1.34) {
          hint.textContent = camera.bubbleArmedAt
            ? "拳心已经聚起气泡——张开整只手掌来释放"
            : "在空白海水握拳再张开，可以释放一串气泡";
        }
      } else {
        const amplification = 1.55;
        state.pointer.x = clamp(
          camera.pointerOriginX + (camera.x - camera.gestureOriginX) * amplification,
          -baseRadius() * 0.4,
          state.width + baseRadius() * 0.4,
        );
        state.pointer.y = clamp(
          camera.pointerOriginY + (camera.y - camera.gestureOriginY) * amplification,
          -baseRadius() * 0.4,
          state.height + baseRadius() * 0.4,
        );
        if (
          state.interactionMode !== "birth" &&
          isBirthZone(state.pointer.x, state.pointer.y, true) &&
          now - state.pointer.startedAt < 1800
        ) {
          state.interactionMode = "birth";
          state.birthAngle = Math.atan2(state.pointer.y - state.center.y, state.pointer.x - state.center.x);
          state.pointer.startX = state.pointer.x;
          state.pointer.startY = state.pointer.y;
          state.birthPull = 0;
          hint.textContent = "边缘已抓住——继续向外拉";
        }
        if (state.interactionMode === "birth") {
          const pullX = state.pointer.x - state.pointer.startX;
          const pullY = state.pointer.y - state.pointer.startY;
          state.birthPull = Math.max(0, pullX * Math.cos(state.birthAngle) + pullY * Math.sin(state.birthAngle));
          state.touchAngle = state.birthAngle;
        } else {
          state.touchAngle = Math.atan2(state.pointer.y - state.center.y, state.pointer.x - state.center.x);
        }
        if (!pinching && camera.openFrames >= 3) {
          camera.active = false;
          camera.suspendedUntil = now + 160;
          releasePointer();
        } else {
          const readyDistance = baseRadius() * 0.2;
          hint.textContent = state.interactionMode === "birth"
            ? state.birthPull >= readyDistance
              ? "可以松开了——新的小水母已经准备好"
              : "边缘已抓住——保持捏合并继续向外拉"
            : "保持捏合；滑到任意边缘后向外拉可以出生";
        }
      }
    } else if (camera.active && camera.absentFrames >= 8) {
      camera.active = false;
      releasePointer();
    } else if (!present && camera.absentFrames >= 6) {
      hint.textContent = "把整只手完整地放进镜头";
    }
  }

  function showAbout(open) {
    aboutPanel.classList.toggle("is-open", open);
    veil.classList.toggle("is-visible", open);
    aboutPanel.setAttribute("aria-hidden", String(!open));
    aboutButton.setAttribute("aria-expanded", String(open));
    if (open) closeAbout.focus();
  }

  const TUTORIAL_ORDER = [
    "INPUT_SELECTION",
    "CAMERA_CHECK",
    "APPROACH",
    "TOUCH",
    "SQUISH",
    "SPAWN",
    "BABY_INTERACTION",
    "BUBBLE_INTERACTION",
    "COMPLETE",
  ];

  const TUTORIAL_COPY = {
    APPROACH: {
      title: "靠近水母",
      mouse: "移动鼠标，慢慢靠近母水母。",
      gesture: "伸出一根食指，慢慢靠近母水母。",
      help: "让指针进入水母周围的粉紫色感知圈。",
    },
    TOUCH: {
      title: "轻触伞盖",
      mouse: "在伞盖中央轻点一次，然后松开。",
      gesture: "用食指轻触伞盖中央，保持片刻。",
      help: "请触碰粉紫色伞盖，不要触碰触手。",
    },
    SQUISH: {
      title: "果冻挤压",
      mouse: "按住伞盖并拖动，保持半秒后松开。",
      gesture: "拇指与食指捏住伞盖，保持后张开。",
      help: "看到局部凹陷后再松开；轻点不足以完成。",
    },
    SPAWN: {
      title: "孕育小水母",
      mouse: "捏住伞盖顶部，向上拉到提示出现后松开。",
      gesture: "在伞盖顶部双指捏合，向上拉，再张开手指。",
      help: "本关只识别顶部向上的拉动；等待小水母完全分离。",
    },
    BABY_INTERACTION: {
      title: "和小水母玩耍",
      mouse: "移动并点击刚出生的小水母。",
      gesture: "用食指轻轻靠近刚出生的小水母。",
      help: "靠近小水母的伞盖，触发它的性格反应。",
    },
    BUBBLE_INTERACTION: {
      title: "气泡互动",
      mouse: "在小水母下方的空白海水点击，吹出气泡。",
      gesture: "在小水母下方的空白处握拳，再张开手掌释放气泡。",
      help: "先稳定握拳，再完整张开；气泡会向上漂向小水母。",
    },
  };

  function tutorialStepNumber(step = state.tutorial.step) {
    return ["APPROACH", "TOUCH", "SQUISH", "SPAWN", "BABY_INTERACTION", "BUBBLE_INTERACTION"].indexOf(step) + 1;
  }

  function saveTutorialProgress() {
    localStorage.setItem("tutorialCurrentStep", state.tutorial.step);
    localStorage.setItem("preferredInputMode", state.tutorial.mode);
  }

  function showTutorial(open) {
    state.tutorial.active = open;
    tutorialPanel.classList.toggle("is-open", open);
    tutorialPanel.setAttribute("aria-hidden", String(!open));
    tutorialButton.setAttribute("aria-expanded", String(open));
    if (!open) {
      tutorialPanel.classList.remove("is-blocking", "is-guiding", "is-success");
      canvas.focus({ preventScroll: true });
    }
  }

  function renderTutorialPanel() {
    const tutorial = state.tutorial;
    const step = tutorial.step;
    const copy = TUTORIAL_COPY[step];
    const stepNumber = tutorialStepNumber(step);
    const quickGuide = step === "QUICK_GUIDE";
    const blocking = quickGuide || ["WELCOME", "INPUT_SELECTION", "CAMERA_CHECK", "COMPLETE"].includes(step);
    tutorialPanel.dataset.step = step;
    tutorialPanel.classList.toggle("is-blocking", blocking);
    tutorialPanel.classList.toggle("is-guiding", !blocking);
    tutorialPanel.classList.toggle("is-success", tutorial.success);
    tutorialModePicker.hidden = step !== "INPUT_SELECTION";
    tutorialQuickGuide.hidden = !quickGuide;
    tutorialResume.hidden = step !== "WELCOME";
    tutorialBack.hidden = quickGuide || ["WELCOME", "INPUT_SELECTION", "COMPLETE"].includes(step);
    tutorialRetry.hidden = blocking;
    skipTutorial.hidden = quickGuide || step === "COMPLETE";
    switchToMouse.hidden = quickGuide || tutorial.mode !== "gesture" || step === "INPUT_SELECTION" || step === "COMPLETE";
    startTutorial.hidden = !quickGuide && !["CAMERA_CHECK", "COMPLETE"].includes(step);
    tutorialProgressBar.style.width = `${Math.round(tutorial.progress * 100)}%`;
    tutorialKicker.textContent = stepNumber > 0 ? "INTERACTIVE GESTURE TUTORIAL" : "SQUISH · FIRST ENCOUNTER";
    tutorialCounter.textContent = stepNumber > 0 ? `${stepNumber} / 6` : step === "COMPLETE" ? "完成" : "准备";

    if (quickGuide) {
      tutorialKicker.textContent = "SQUISH · QUICK GUIDE";
      tutorialCounter.textContent = "简明说明";
      tutorialTitle.textContent = "三种动作，就够了";
      startTutorial.textContent = "知道了，开始体验";
      startTutorial.disabled = false;
    } else if (step === "WELCOME") {
      tutorialTitle.textContent = "继续认识它？";
      tutorialInstruction.textContent = "检测到尚未完成的教学进度。";
      tutorialStatus.textContent = `上次停在第 ${Math.max(1, tutorialStepNumber(localStorage.getItem("tutorialCurrentStep")))} 步`;
      tutorialHelp.textContent = "可以继续，也可以清空教学生成的小水母后重新开始。";
    } else if (step === "INPUT_SELECTION") {
      tutorialTitle.textContent = "选择操作方式";
      tutorialInstruction.textContent = "教程会根据输入方式显示不同动作提示。";
      tutorialStatus.textContent = "请选择鼠标或摄像头手势模式";
      tutorialHelp.textContent = "摄像头模式只在本机分析画面；失败时可切换鼠标。";
    } else if (step === "CAMERA_CHECK") {
      tutorialTitle.textContent = "摄像头与手部检测";
      tutorialInstruction.textContent = state.camera.ready ? "请把一只手完整放入镜头。" : "正在请求权限并载入手部模型。";
      tutorialStatus.textContent = state.camera.ready ? "等待稳定识别手部关键点" : state.camera.starting ? "模型加载中…" : "摄像头尚未就绪";
      tutorialHelp.textContent = "保持手掌正对镜头、光线均匀；无法识别可切换鼠标。";
      startTutorial.textContent = "检测完成，继续";
      startTutorial.disabled = tutorial.progress < 1;
    } else if (copy) {
      tutorialTitle.textContent = copy.title;
      tutorialInstruction.textContent = copy[tutorial.mode];
      tutorialStatus.textContent = tutorial.success ? "识别成功 · 即将进入下一步" : `动作识别 ${Math.round(tutorial.progress * 100)}%`;
      tutorialHelp.textContent = tutorial.success ? "动作已经确认，水母会带你进入下一步。" : tutorial.helpLevel ? `还没有识别成功：${copy.help}` : copy.help;
    } else if (step === "COMPLETE") {
      tutorialTitle.textContent = "你已经学会了";
      tutorialInstruction.textContent = "现在可以自由触摸、挤压、孕育水母和吹出气泡。";
      tutorialStatus.textContent = "六项真实互动均已完成";
      tutorialHelp.textContent = "之后可以从顶部“重新学习操作”再次进入教程。";
      startTutorial.textContent = "进入自由互动";
      startTutorial.disabled = false;
    }
  }

  function setTutorialStep(step, { save = true } = {}) {
    const tutorial = state.tutorial;
    tutorial.step = step;
    tutorial.progress = 0;
    tutorial.success = false;
    tutorial.helpLevel = 0;
    tutorial.stableFrames = 0;
    tutorial.actionStartedAt = 0;
    tutorial.startedAt = performance.now();
    if (step === "SPAWN") tutorial.initialBabyCount = state.babies.length;
    if (["BABY_INTERACTION", "BUBBLE_INTERACTION"].includes(step)) {
      const baby = ensureTutorialBaby();
      const margin = Math.max(68, baby.size * 2.3);
      baby.x = clamp(state.center.x + baseRadius() * 1.42, margin, state.width - margin);
      baby.y = clamp(state.center.y - baseRadius() * 0.45, margin, state.height - margin);
      baby.vx = 0;
      baby.vy = -0.8;
    }
    if (save) saveTutorialProgress();
    showTutorial(true);
    renderTutorialPanel();
  }

  function beginTutorial(restart = false) {
    setTutorialStep("QUICK_GUIDE", { save: false });
  }

  function completeTutorialStep(expectedStep) {
    const tutorial = state.tutorial;
    if (!tutorial.active || tutorial.step !== expectedStep || tutorial.success) return;
    tutorial.progress = 1;
    tutorial.success = true;
    renderTutorialPanel();
    popTone(0.25, state.touchAngle);
    window.setTimeout(() => {
      if (!tutorial.active || tutorial.step !== expectedStep) return;
      const index = TUTORIAL_ORDER.indexOf(expectedStep);
      setTutorialStep(TUTORIAL_ORDER[index + 1] || "COMPLETE");
    }, 680);
  }

  function finishTutorial(skipped = false) {
    localStorage.setItem("tutorialCompleted", "true");
    localStorage.setItem("tutorialCurrentStep", "COMPLETE");
    showTutorial(false);
    hint.textContent = skipped ? "操作说明已关闭，随时可以重新查看" : "说明看完了——现在自由地和它们相处吧";
  }

  function tutorialAllows(kind) {
    if (!state.tutorial.active) return true;
    const step = state.tutorial.step;
    return (
      (kind === "mother" && ["TOUCH", "SQUISH", "SPAWN"].includes(step)) ||
      (kind === "baby" && step === "BABY_INTERACTION") ||
      (kind === "background" && step === "BUBBLE_INTERACTION")
    );
  }

  function retryTutorialStep() {
    const step = state.tutorial.step;
    if (step === "SPAWN" && state.tutorial.spawnedBaby) {
      state.babies = state.babies.filter((baby) => baby !== state.tutorial.spawnedBaby);
      state.tutorial.spawnedBaby = null;
      babyCount.textContent = String(state.babies.length).padStart(2, "0");
    }
    setTutorialStep(step);
  }

  function backTutorialStep() {
    const index = TUTORIAL_ORDER.indexOf(state.tutorial.step);
    if (index <= 0) return;
    if (state.tutorial.step === "BABY_INTERACTION" && state.tutorial.spawnedBaby) {
      state.babies = state.babies.filter((baby) => baby !== state.tutorial.spawnedBaby);
      state.tutorial.spawnedBaby = null;
      babyCount.textContent = String(state.babies.length).padStart(2, "0");
    }
    const previous = TUTORIAL_ORDER[Math.max(0, index - 1)];
    setTutorialStep(previous === "CAMERA_CHECK" && state.tutorial.mode === "mouse" ? "INPUT_SELECTION" : previous);
  }

  function recordActivity() {
    state.lastActivityAt = performance.now();
    document.body.classList.remove("ui-idle");
  }

  function isBirthZone(x, y, generous = false) {
    const radius = baseRadius();
    const dx = x - state.center.x;
    const dy = y - state.center.y;
    const xRadius = radius * (generous ? 1.12 : 1.04);
    const yRadius = radius * (dy > 0 ? (generous ? 0.72 : 0.62) : (generous ? 1.12 : 1.04));
    const edgeDistance = Math.hypot(dx / xRadius, dy / yRadius);
    const innerEdge = generous ? 0.42 : 0.56;
    return edgeDistance >= innerEdge && edgeDistance <= 1.22;
  }

  function setMotherMood() {
    const moods = ["happy", "shy", "surprised"];
    state.motherMood = moods[Math.floor(Math.random() * moods.length)];
    state.motherMoodUntil = performance.now() + 2200;
  }

  function enter() {
    state.entered = true;
    invitation.classList.add("is-gone");
    initAudio();
    canvas.focus({ preventScroll: true });
    recordActivity();
    if (localStorage.getItem("tutorialCompleted") === "true") return;
    beginTutorial(false);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function findTouchableBaby(x, y, reach = 1) {
    for (let i = state.babies.length - 1; i >= 0; i -= 1) {
      const baby = state.babies[i];
      if (baby.age < baby.birthDuration) continue;
      const hitRadius = Math.max(26, baby.size * 2.15) * reach;
      if (Math.hypot(x - baby.x, y - baby.y) <= hitRadius) return baby;
    }
    return null;
  }

  function isTutorialTopZone(x, y) {
    const radius = baseRadius();
    return Math.abs(x - state.center.x) < radius * 0.62 && y < state.center.y - radius * 0.34;
  }

  function createBubble(x, y, source = "mouse", quiet = false) {
    const size = 10 + Math.random() * 8;
    state.bubbles.push({
      x,
      y,
      size,
      vx: (Math.random() - 0.5) * 5,
      vy: -18 - Math.random() * 8,
      age: 0,
      phase: Math.random() * TAU,
      source,
      hit: false,
    });
    if (state.bubbles.length > 18) state.bubbles.shift();
    if (!quiet) {
      popTone(0.12, -Math.PI / 2);
      hint.textContent = "一枚气泡正向小水母漂去";
    }
  }

  function createPalmBubble(x, y) {
    createBubble(x, y, "gesture");
    hint.textContent = "啵——张开的手掌释放出一枚气泡";
  }

  function ensureTutorialBaby() {
    const existing = state.tutorial.spawnedBaby && state.babies.includes(state.tutorial.spawnedBaby)
      ? state.tutorial.spawnedBaby
      : state.babies.find((baby) => baby.detached);
    if (existing) {
      state.tutorial.spawnedBaby = existing;
      return existing;
    }
    state.birthAngle = -Math.PI / 2;
    state.birthPull = baseRadius() * 0.42;
    state.count = Math.max(1, state.count);
    spawnBaby(0.58, state.count % palette.length);
    const baby = state.babies[state.babies.length - 1];
    baby.age = baby.birthDuration + 1;
    baby.detached = true;
    baby.birthSquash = 0;
    baby.x = state.center.x;
    baby.y = Math.max(78, state.center.y - baseRadius() * 1.32);
    baby.vx = 1.4;
    baby.vy = -1.2;
    state.tutorial.spawnedBaby = baby;
    babyCount.textContent = String(state.babies.length).padStart(2, "0");
    return baby;
  }

  function pointerDown(event) {
    if (!state.entered || aboutPanel.classList.contains("is-open")) return;
    if (state.camera.active) cancelCameraGesture();
    state.camera.suspendedUntil = performance.now() + 1400;
    const point = pointerPosition(event);
    recordActivity();
    const baby = findTouchableBaby(point.x, point.y, 1.1);
    const radius = baseRadius();
    const motherDistance = Math.hypot(point.x - state.center.x, point.y - state.center.y);
    const onMother = motherDistance <= radius * 1.28;
    if (state.tutorial.active && state.tutorial.mode !== "mouse") return;
    if (state.tutorial.active && state.tutorial.step === "APPROACH") return;
    if (baby && !tutorialAllows("baby")) return;
    if (baby) {
      state.activeBaby = baby;
      baby.touchAngle = Math.atan2(point.y - baby.y, point.x - baby.x);
      state.pointer = { x: point.x, y: point.y, down: true, id: event.pointerId, startedAt: performance.now() };
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-touching");
      hint.textContent = "它软软地凹下去了";
      initAudio();
      return;
    }
    if (!onMother) {
      if (tutorialAllows("background")) createBubble(point.x, point.y, "mouse");
      return;
    }
    if (!tutorialAllows("mother")) return;
    state.pointer = { x: point.x, y: point.y, startX: point.x, startY: point.y, down: true, id: event.pointerId, startedAt: performance.now() };
    state.touchAngle = Math.atan2(point.y - state.center.y, point.x - state.center.x);
    state.interactionMode = isBirthZone(point.x, point.y) ? "birth" : "squish";
    if (state.tutorial.active) {
      if (state.tutorial.step === "SPAWN") {
        if (!isTutorialTopZone(point.x, point.y)) {
          state.pointer.down = false;
          state.pointer.id = null;
          state.tutorial.helpLevel = 1;
          tutorialStatus.textContent = "请从伞盖最顶部开始";
          renderTutorialPanel();
          return;
        }
        state.interactionMode = "birth";
        state.touchAngle = -Math.PI / 2;
        state.birthAngle = -Math.PI / 2;
      } else {
        state.interactionMode = "squish";
      }
      state.tutorial.actionStartedAt = performance.now();
    }
    state.birthAngle = state.touchAngle;
    state.birthPull = 0;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-touching");
    hint.textContent = state.interactionMode === "birth" ? "捏住伞盖边缘，沿外侧方向慢慢拉" : "慢一点，它正在局部改变";
    initAudio();
  }

  function pointerMove(event) {
    const point = pointerPosition(event);
    if (state.tutorial.active && state.tutorial.mode === "mouse" && state.tutorial.step === "APPROACH") {
      const distance = Math.hypot(point.x - state.center.x, point.y - state.center.y);
      state.tutorial.progress = clamp(1 - (distance - baseRadius() * 1.15) / (baseRadius() * 1.5), 0, 1);
      renderTutorialPanel();
      if (distance <= baseRadius() * 1.38) completeTutorialStep("APPROACH");
    }
    if (!state.pointer.down || state.pointer.id !== event.pointerId) return;
    state.pointer.x = point.x;
    state.pointer.y = point.y;
    recordActivity();
    if (state.activeBaby) {
      state.activeBaby.touchAngle = Math.atan2(point.y - state.activeBaby.y, point.x - state.activeBaby.x);
      return;
    }
    if (state.interactionMode === "birth") {
      const pullX = point.x - state.pointer.startX;
      const pullY = point.y - state.pointer.startY;
      state.birthPull = Math.max(0, pullX * Math.cos(state.birthAngle) + pullY * Math.sin(state.birthAngle));
      state.touchAngle = state.birthAngle;
      if (state.tutorial.active && state.tutorial.step === "SPAWN") {
        state.tutorial.progress = clamp(state.birthPull / (baseRadius() * 0.3), 0, 1);
        renderTutorialPanel();
      }
      hint.textContent = state.birthPull > baseRadius() * 0.3 ? "可以松开了——新的生命准备好了" : "保持向外拉，让果冻慢慢隆起";
    } else {
      state.touchAngle = Math.atan2(point.y - state.center.y, point.x - state.center.x);
      if (state.tutorial.active && state.tutorial.step === "SQUISH") {
        const held = (performance.now() - state.pointer.startedAt) / 650;
        const moved = Math.hypot(point.x - state.pointer.startX, point.y - state.pointer.startY) / (baseRadius() * 0.28);
        state.tutorial.progress = clamp(Math.min(held, Math.max(0.25, moved)), 0, 0.95);
        renderTutorialPanel();
      }
    }
  }

  function releasePointer() {
    if (!state.pointer.down) return;
    if (state.activeBaby) {
      const baby = state.activeBaby;
      const awayAngle = baby.touchAngle + Math.PI;
      const impulse = 15 + baby.squash * 17;
      const personalityBoost = baby.personality === "shy" ? 1.45 : baby.personality === "lively" ? 1.15 : 0.72;
      baby.vx += Math.cos(awayAngle) * impulse * personalityBoost;
      baby.vy += Math.sin(awayAngle) * impulse * personalityBoost - 6;
      if (baby.personality === "lively") baby.spin = 0.9;
      baby.squashVelocity -= 0.16 + baby.squash * 0.16;
      baby.releaseGlow = 1;
      baby.expression = baby.personality === "shy" ? "shy" : baby.personality === "lively" ? "happy" : "gentle";
      baby.expressionUntil = performance.now() + 1800;
      state.ripples.push({
        x: baby.x,
        y: baby.y,
        age: 0,
        strength: 0.14 + baby.squash * 0.08,
        hue: baby.hue,
      });
      state.pointer.down = false;
      state.pointer.id = null;
      state.activeBaby = null;
      canvas.classList.remove("is-touching");
      tone(0.22 + baby.squash * 0.35, baby.touchAngle);
      hint.textContent = "它弹了一下，慢慢游走了";
      if (state.tutorial.active && state.tutorial.step === "BABY_INTERACTION") completeTutorialStep("BABY_INTERACTION");
      window.setTimeout(() => {
        if (!state.pointer.down) hint.textContent = "轻轻碰一碰漂游的小水母";
      }, 1800);
      return;
    }
    const heldDuration = performance.now() - state.pointer.startedAt;
    const strength = clamp(state.pressure * 0.72 + state.dragDistance / (baseRadius() * 2.8), 0.15, 1);
    const birthThreshold = baseRadius() * (state.pointer.id === "camera" ? 0.2 : 0.3);
    const shouldBirth = state.interactionMode === "birth" && state.birthPull >= birthThreshold && state.babies.length < 12;
    state.pointer.down = false;
    state.pointer.id = null;
    canvas.classList.remove("is-touching");
    setMotherMood();
    leaveMemory(strength, shouldBirth);
    if (state.tutorial.active) {
      if (state.tutorial.step === "TOUCH") completeTutorialStep("TOUCH");
      if (state.tutorial.step === "SQUISH") {
        if (heldDuration >= 520 && strength >= 0.22) completeTutorialStep("SQUISH");
        else {
          state.tutorial.helpLevel = 1;
          state.tutorial.progress = Math.min(state.tutorial.progress, 0.65);
          renderTutorialPanel();
        }
      }
      if (state.tutorial.step === "SPAWN" && shouldBirth) {
        state.tutorial.spawnedBaby = state.babies[state.babies.length - 1];
        state.tutorial.progress = 0.92;
        renderTutorialPanel();
      }
    }
    tone(strength, state.touchAngle);
    hint.textContent = shouldBirth
      ? "啵——一只小水母正从伞盖边缘脱离"
      : state.babies.length >= 12 && state.interactionMode === "birth"
        ? "水母之森已经住满 12 只小生命"
        : "软软地弹回来了；普通触摸不会繁殖";
    state.birthPull = 0;
    state.interactionMode = "squish";
    window.setTimeout(() => {
      if (!state.pointer.down) hint.textContent = "触摸小水母，或从母水母任意边缘向外拉";
    }, 2600);
  }

  function spawnBaby(strength, hue) {
    const radius = baseRadius();
    const birthAngle = state.birthAngle;
    const surface = bodySurfacePoint(birthAngle);
    const pullRatio = clamp(state.birthPull / (radius * 0.72), 0, 1);
    const size = 16 + Math.pow(pullRatio, 0.78) * 21;
    const directionX = 0;
    const directionY = -1;
    const margin = size * 1.22;
    const edgeLimits = [];
    if (directionX > 0.001) edgeLimits.push((state.width - margin - surface.x) / directionX);
    if (directionX < -0.001) edgeLimits.push((margin - surface.x) / directionX);
    if (directionY > 0.001) edgeLimits.push((state.height - margin - surface.y) / directionY);
    if (directionY < -0.001) edgeLimits.push((margin - surface.y) / directionY);
    const edgeLimit = edgeLimits.length ? Math.max(size * 0.82, Math.min(...edgeLimits)) : radius * 0.48;
    const desiredTravel = clamp(state.birthPull * 0.55, size * 1.2, radius * 0.55);
    const personalities = ["shy", "lively", "gentle"];
    const personality = personalities[state.count % personalities.length];
    state.babies.push({
      x: surface.x,
      y: surface.y,
      vx: (Math.random() - 0.5) * 8,
      vy: -4 - strength * 4,
      size,
      strength,
      hue,
      phase: state.count * 0.91 + Math.random() * 0.5,
      age: 0,
      birthAngle,
      birthDuration: 1.45 + strength * 0.38,
      birthTravel: Math.min(desiredTravel, edgeLimit / 1.08),
      detached: false,
      birthSquash: 0,
      squash: 0,
      squashVelocity: 0,
      touchAngle: 0,
      releaseGlow: 0,
      cameraTouch: 0,
      personality,
      expression: personality === "shy" ? "shy" : personality === "lively" ? "happy" : "gentle",
      expressionUntil: performance.now() + 2200,
      turnTimer: 1.4 + Math.random() * 2.8,
      wanderAngle: -Math.PI / 2 + (Math.random() - 0.5) * 1.4,
      spin: 0,
    });
    babyCount.textContent = String(state.babies.length).padStart(2, "0");
  }

  function leaveMemory(strength, shouldBirth = false) {
    if (shouldBirth) state.count += 1;
    const hue = state.count % palette.length;
    state.memories.push({
      angle: state.touchAngle + (Math.random() - 0.5) * 0.42,
      radius: 0.38 + Math.random() * 0.38,
      size: 3 + strength * 3.8,
      hue,
      phase: Math.random() * TAU,
      landX: 0.08 + ((state.count * 0.618033) % 0.84),
      landPeak: 0.08 + strength * 0.11,
    });
    if (state.memories.length > 24) state.memories.shift();
    state.ripples.push({
      x: state.center.x + Math.cos(state.touchAngle) * baseRadius() * 0.42,
      y: state.center.y + Math.sin(state.touchAngle) * baseRadius() * 0.42,
      age: 0,
      strength,
      hue,
    });
    if (shouldBirth) spawnBaby(strength, hue);
  }

  function resetMemories() {
    state.count = 0;
    state.memories.length = 0;
    state.ripples.length = 0;
    state.babies.length = 0;
    state.bubbles.length = 0;
    babyCount.textContent = "00";
    hint.textContent = "水流安静下来，母水母重新等待触碰";
    showAbout(false);
  }

  function updateTutorial() {
    const tutorial = state.tutorial;
    if (!tutorial.active) return;
    const now = performance.now();
    if (!tutorial.success && now - tutorial.startedAt > 8500 && !tutorial.helpLevel) {
      tutorial.helpLevel = 1;
      renderTutorialPanel();
    }
    if (tutorial.step === "CAMERA_CHECK") {
      if (!state.camera.starting && !state.camera.enabled && now - tutorial.startedAt > 3500) {
        tutorialHelp.textContent = "摄像头未能启动。请允许权限，或点击“切换鼠标”。";
        switchToMouse.hidden = false;
      }
    }
    if (tutorial.step === "SQUISH" && state.pointer.down && !state.activeBaby) {
      const hold = clamp((now - state.pointer.startedAt) / 700, 0, 0.92);
      tutorial.progress = Math.max(tutorial.progress, hold * clamp(state.pressure + 0.25, 0.25, 1));
      renderTutorialPanel();
    }
    if (tutorial.step === "SPAWN" && state.pointer.down) {
      const threshold = baseRadius() * (state.pointer.id === "camera" ? 0.2 : 0.3);
      tutorial.progress = clamp(state.birthPull / threshold, 0, 0.92);
      renderTutorialPanel();
    }
    const target = tutorial.spawnedBaby && state.babies.includes(tutorial.spawnedBaby) ? tutorial.spawnedBaby : null;
    if (["BABY_INTERACTION", "BUBBLE_INTERACTION"].includes(tutorial.step) && target) {
      tutorialFocus.style.left = `${target.x}px`;
      tutorialFocus.style.top = `${target.y}px`;
      tutorialFocus.style.width = `${Math.max(100, target.size * 5.2)}px`;
    } else {
      tutorialFocus.style.left = `${state.center.x}px`;
      tutorialFocus.style.top = `${state.center.y}px`;
      tutorialFocus.style.width = `${baseRadius() * 2.5}px`;
    }
  }

  function update(dt) {
    state.elapsed += dt;
    updateTutorial();
    document.body.classList.toggle("ui-idle", state.entered && performance.now() - state.lastActivityAt > 4800 && !state.pointer.down);
    state.tentaclePlay.amount *= Math.pow(0.018, dt);
    state.tentaclePlay.direction *= Math.pow(0.08, dt);
    const radius = baseRadius();
    const dx = state.pointer.x - state.center.x;
    const dy = state.pointer.y - state.center.y;
    const pointerDistance = Math.hypot(dx, dy);
    const holdTime = state.pointer.down ? (performance.now() - state.pointer.startedAt) / 1000 : 0;
    const mainActive = state.pointer.down && !state.activeBaby;
    const targetPressure = mainActive
      ? state.pointer.id === "camera"
        ? clamp(0.2 + state.camera.presence * 0.8, 0, 1)
        : clamp(0.28 + holdTime * 0.36, 0, 1)
      : 0;
    state.pressureVelocity += (targetPressure - state.pressure) * 16 * dt;
    state.pressureVelocity *= Math.pow(0.035, dt);
    state.pressure += state.pressureVelocity * dt * 7;
    state.pressure = clamp(state.pressure, -0.12, 1.08);
    state.dragDistance = mainActive
      ? state.interactionMode === "birth"
        ? state.birthPull
        : Math.max(0, pointerDistance - radius * 0.72)
      : mix(state.dragDistance, 0, 1 - Math.pow(0.02, dt));

    const contourEase = 1 - Math.pow(0.16, dt);
    state.contourPressure = mix(state.contourPressure, clamp(state.pressure, 0, 1), contourEase);
    state.contourDrag = mix(state.contourDrag, clamp(state.dragDistance / radius, 0, 0.85), contourEase);
    state.contourRelease = mix(state.contourRelease, clamp(-state.pressureVelocity * 0.34, 0, 1), contourEase * 0.72);
    if (mainActive) {
      state.contourAngle += shortestAngle(state.touchAngle, state.contourAngle) * contourEase * 0.58;
    }

    const idleFloatX = reduceMotion ? 0 : Math.sin(state.elapsed * 0.31) * 3.8;
    const idleFloatY = reduceMotion ? 0 : Math.sin(state.elapsed * 0.27 + 1.2) * 5.2;
    const centerTargetX = state.width * 0.5 + idleFloatX + (mainActive ? dx * 0.075 : 0);
    const centerTargetY = state.height * 0.51 + idleFloatY + (mainActive ? dy * 0.075 : 0);
    state.center.vx += (centerTargetX - state.center.x) * 8.5 * dt;
    state.center.vy += (centerTargetY - state.center.y) * 8.5 * dt;
    state.center.vx *= Math.pow(0.018, dt);
    state.center.vy *= Math.pow(0.018, dt);
    state.center.x += state.center.vx * dt * 7;
    state.center.y += state.center.vy * dt * 7;

    state.nodes.forEach((node) => {
      const proximity = Math.exp(-Math.pow(shortestAngle(node.angle, state.touchAngle) / 0.58, 2));
      const opposite = Math.exp(-Math.pow(shortestAngle(node.angle, state.touchAngle + Math.PI) / 0.9, 2));
      const inside = pointerDistance < radius;
      const indentation = mainActive && inside ? -state.pressure * 0.24 * proximity : 0;
      const pull = mainActive && !inside ? clamp((pointerDistance - radius) / radius, 0, 0.72) * 0.66 * proximity : 0;
      const volume = mainActive ? state.pressure * 0.075 * (1 - proximity) - state.pressure * 0.025 * opposite : 0;
      const breath = (reduceMotion ? 0.006 : 0.026) * Math.sin(state.elapsed * 0.92 + node.phase * 0.22);
      const membrane = (reduceMotion ? 0.002 : 0.007) * Math.sin(state.elapsed * 0.55 + node.angle * 3 + node.phase);
      const target = indentation + pull + volume + breath + membrane;
      node.velocity += (target - node.value) * 31 * dt;
      node.velocity *= Math.pow(0.004, dt);
      node.value += node.velocity * dt * 6.2;
    });

    state.ripples.forEach((ripple) => { ripple.age += dt; });
    state.ripples = state.ripples.filter((ripple) => ripple.age < (ripple.duration || 3.4));

    state.babies.forEach((baby) => {
      baby.age += dt;
      baby.phase += dt * (0.42 + baby.strength * 0.16);
      baby.releaseGlow *= Math.pow(0.055, dt);
      baby.cameraTouch = (baby.cameraTouch || 0) * Math.pow(0.008, dt);
      const heldTarget = state.pointer.down && state.activeBaby === baby ? clamp(0.48 + holdTime * 0.34, 0, 0.88) : 0;
      const babyTarget = Math.max(heldTarget, baby.cameraTouch * 0.48);
      baby.squashVelocity += (babyTarget - baby.squash) * 32 * dt;
      baby.squashVelocity *= Math.pow(0.006, dt);
      baby.squash += baby.squashVelocity * dt * 6.4;
      baby.squash = clamp(baby.squash, -0.12, 0.94);
      const birthing = baby.age < baby.birthDuration;
      if (birthing) {
        const t = clamp(baby.age / baby.birthDuration, 0, 1);
        const stretchT = clamp(t / 0.82, 0, 1);
        const popT = clamp((t - 0.82) / 0.18, 0, 1);
        const travel = easeOut(stretchT) * baby.birthTravel * 0.78 + easeOut(popT) * baby.birthTravel * 0.3;
        const anchor = bodySurfacePoint(baby.birthAngle);
        const curve = Math.sin(t * Math.PI) * baby.size * 0.12;
        baby.x = anchor.x + Math.cos(baby.birthAngle) * travel - Math.sin(baby.birthAngle) * curve;
        baby.y = anchor.y + Math.sin(baby.birthAngle) * travel + Math.cos(baby.birthAngle) * curve;
        const gather = easeOut(clamp((t - 0.46) / 0.38, 0, 1));
        baby.birthSquash = gather * (1 - easeOut(popT)) * 0.38 - Math.sin(popT * Math.PI) * 0.11;
      } else {
        if (!baby.detached) {
          baby.detached = true;
          baby.birthSquash = 0;
          baby.releaseGlow = 1.15;
          baby.squashVelocity = -0.15;
          baby.vx += Math.cos(baby.birthAngle) * (8 + baby.strength * 5);
          baby.vy += Math.sin(baby.birthAngle) * (8 + baby.strength * 5) - 3;
          state.ripples.push({
            x: baby.x,
            y: baby.y,
            age: 0,
            strength: 0.18,
            hue: baby.hue,
            duration: 0.72,
            pop: true,
            radius: baby.size,
          });
          popTone(baby.strength, baby.birthAngle);
          hint.textContent = "啵——它翻过身了";
          if (state.tutorial.active && state.tutorial.step === "SPAWN" && state.tutorial.spawnedBaby === baby) {
            completeTutorialStep("SPAWN");
          }
        }
        baby.turnTimer -= dt;
        if (baby.turnTimer <= 0) {
          baby.wanderAngle += (Math.random() - 0.5) * 1.25;
          baby.turnTimer = 1.8 + Math.random() * 3.4;
          baby.expression = ["shy", "happy", "gentle", "surprised"][Math.floor(Math.random() * 4)];
          baby.expressionUntil = performance.now() + 1200;
        }
        const swim = baby.personality === "lively" ? 5.2 : baby.personality === "shy" ? 3.3 : 2.7;
        baby.vx = mix(baby.vx, Math.cos(baby.wanderAngle) * swim, 1 - Math.pow(0.46, dt));
        baby.vy = mix(baby.vy, Math.sin(baby.wanderAngle) * swim - 1.2, 1 - Math.pow(0.46, dt));
        baby.spin = mix(baby.spin, baby.personality === "lively" && baby.releaseGlow > 0.1 ? 0.3 : 0, 1 - Math.pow(0.1, dt));
      }
      if (!birthing && state.activeBaby !== baby) {
        baby.x += (baby.vx + Math.sin(baby.phase * 0.8) * 2.2) * dt;
        baby.y += baby.vy * dt;
      }
      if (
        state.tutorial.active &&
        state.tutorial.spawnedBaby === baby &&
        ["BABY_INTERACTION", "BUBBLE_INTERACTION"].includes(state.tutorial.step)
      ) {
        const safeMargin = Math.max(64, baby.size * 2.2);
        baby.x = clamp(baby.x, safeMargin, state.width - safeMargin);
        baby.y = clamp(baby.y, safeMargin, state.height - safeMargin);
      }
      if (baby.y < -baby.size * 4) baby.y = state.height + baby.size * 3;
      if (baby.x < -baby.size * 3) baby.x = state.width + baby.size * 2;
      if (baby.x > state.width + baby.size * 3) baby.x = -baby.size * 2;
    });

    for (let i = 0; i < state.babies.length; i += 1) {
      for (let j = i + 1; j < state.babies.length; j += 1) {
        const a = state.babies[i];
        const b = state.babies[j];
        if (!a.detached || !b.detached) continue;
        const dxBaby = b.x - a.x;
        const dyBaby = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dxBaby, dyBaby));
        const spacing = (a.size + b.size) * 1.35;
        if (distance < spacing) {
          const force = (spacing - distance) * 0.12;
          a.vx -= (dxBaby / distance) * force;
          a.vy -= (dyBaby / distance) * force;
          b.vx += (dxBaby / distance) * force;
          b.vy += (dyBaby / distance) * force;
        }
      }
    }

    state.bubbles.forEach((bubble) => {
      bubble.age += dt;
      bubble.phase += dt * 2;
      const nearestBaby = state.babies
        .filter((baby) => baby.detached)
        .sort((a, b) => Math.hypot(a.x - bubble.x, a.y - bubble.y) - Math.hypot(b.x - bubble.x, b.y - bubble.y))[0];
      if (nearestBaby && Math.hypot(nearestBaby.x - bubble.x, nearestBaby.y - bubble.y) < 190) {
        bubble.vx += clamp((nearestBaby.x - bubble.x) * 0.42, -18, 18) * dt;
      }
      bubble.x += (bubble.vx + Math.sin(bubble.phase) * 2.4) * dt;
      bubble.y += bubble.vy * dt;
      bubble.vy = mix(bubble.vy, -24, 1 - Math.pow(0.45, dt));
      if (bubble.hit) return;
      state.babies.forEach((baby) => {
        if (bubble.hit || !baby.detached) return;
        const collision = Math.hypot(bubble.x - baby.x, bubble.y - baby.y) < bubble.size + baby.size * 0.9;
        if (!collision) return;
        bubble.hit = true;
        bubble.age = 99;
        baby.vx += (baby.x - bubble.x) * 0.32;
        baby.vy -= 12;
        baby.releaseGlow = 1;
        baby.expression = baby.personality === "shy" ? "shy" : "happy";
        state.ripples.push({ x: bubble.x, y: bubble.y, age: 0, strength: 0.12, hue: baby.hue, duration: 0.8, pop: true, radius: bubble.size });
        if (state.tutorial.active && state.tutorial.step === "BUBBLE_INTERACTION") completeTutorialStep("BUBBLE_INTERACTION");
      });
    });
    state.bubbles = state.bubbles.filter((bubble) => bubble.age < 9 && bubble.y > -bubble.size * 3);
  }

  function blobPoint(node, radius, offset = 0) {
    const value = node.value * (1 - offset * 0.18);
    const localRadius = radius * (1 + value) - offset;
    const sine = Math.sin(node.angle);
    const lower = Math.max(0, sine);
    const xScale = 1 - lower * 0.09;
    const yScale = lower > 0 ? 0.56 + (1 - lower) * 0.14 : 1;
    return {
      x: state.center.x + Math.cos(node.angle) * localRadius * xScale,
      y: state.center.y + sine * localRadius * yScale,
    };
  }

  function bodySurfacePoint(angle) {
    const normalized = (angle % TAU + TAU) % TAU;
    const index = Math.round((normalized / TAU) * NODES) % NODES;
    return blobPoint(state.nodes[index], baseRadius());
  }

  function traceBlob(radius, offset = 0) {
    const points = state.nodes.map((node) => blobPoint(node, radius, offset));
    ctx.beginPath();
    points.forEach((point, i) => {
      const previous = points[(i - 1 + points.length) % points.length];
      const next = points[(i + 1) % points.length];
      const startX = (previous.x + point.x) / 2;
      const startY = (previous.y + point.y) / 2;
      const endX = (point.x + next.x) / 2;
      const endY = (point.y + next.y) / 2;
      if (i === 0) ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(point.x, point.y, endX, endY);
    });
    ctx.closePath();
  }

  function drawBackground() {
    const w = state.width;
    const h = state.height;
    const time = state.elapsed * (reduceMotion ? 0.03 : 0.12);
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    if (state.camera.backgroundMode) {
      gradient.addColorStop(0, "rgba(5,41,54,0.26)");
      gradient.addColorStop(0.42, "rgba(3,27,42,0.34)");
      gradient.addColorStop(1, "rgba(1,8,18,0.58)");
    } else {
      gradient.addColorStop(0, "#0a3144");
      gradient.addColorStop(0.42, "#082638");
      gradient.addColorStop(1, "#020b16");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const clouds = [
      { x: 0.16 + Math.sin(time * 0.31) * 0.03, y: 0.2, r: 0.42, c: "rgba(68,176,184,0.13)" },
      { x: 0.83 + Math.cos(time * 0.22) * 0.04, y: 0.32, r: 0.34, c: "rgba(72,109,172,0.13)" },
      { x: 0.56 + Math.sin(time * 0.17) * 0.05, y: 0.88, r: 0.4, c: "rgba(87,49,123,0.16)" },
    ];
    clouds.forEach((cloud) => {
      const max = Math.max(w, h) * cloud.r;
      const glow = ctx.createRadialGradient(w * cloud.x, h * cloud.y, 0, w * cloud.x, h * cloud.y, max);
      glow.addColorStop(0, cloud.c);
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    });

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let beam = 0; beam < 4; beam += 1) {
      const topX = w * (0.12 + beam * 0.25 + Math.sin(time * 0.25 + beam) * 0.018);
      const beamGradient = ctx.createLinearGradient(topX, 0, topX + w * 0.12, h * 0.86);
      beamGradient.addColorStop(0, "rgba(123,226,223,0.12)");
      beamGradient.addColorStop(0.58, "rgba(95,181,190,0.035)");
      beamGradient.addColorStop(1, "rgba(75,150,168,0)");
      ctx.fillStyle = beamGradient;
      ctx.beginPath();
      ctx.moveTo(topX - w * 0.025, 0);
      ctx.lineTo(topX + w * 0.045, 0);
      ctx.lineTo(topX + w * (0.16 + beam * 0.018), h);
      ctx.lineTo(topX + w * 0.02, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    state.dust.forEach((mote) => {
      const x = ((mote.x + time * mote.speed) % 1.08) * w - w * 0.04;
      const y = (mote.y + Math.sin(time * 0.4 + mote.phase) * 0.02) * h;
      ctx.beginPath();
      ctx.fillStyle = `rgba(151,226,224,${mote.alpha * 0.82})`;
      ctx.arc(x, y, mote.size, 0, TAU);
      ctx.fill();
      if (mote.size > 1.3) {
        ctx.strokeStyle = `rgba(185,242,239,${mote.alpha * 0.52})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    });
  }

  function drawJellyfishBody(
    x,
    y,
    size,
    phase,
    hue,
    alpha = 1,
    squash = 0,
    touchAngle = 0,
    releaseGlow = 0,
    rotation = 0,
    tentacleGrowth = 1,
    faceExpression = null,
  ) {
    const c = palette[hue % palette.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    const pulse = 1 + Math.sin(phase * 2) * (reduceMotion ? 0.018 : 0.058);
    ctx.scale(pulse, 1 / Math.sqrt(pulse));
    ctx.rotate(touchAngle);
    ctx.scale(1 - squash * 0.23, 1 + squash * 0.17);
    ctx.rotate(-touchAngle);
    ctx.shadowBlur = size * (1.3 + squash * 1.6 + releaseGlow * 2.4);
    ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(0.92, (0.46 + squash * 0.24 + releaseGlow * 0.32) * alpha)})`;

    const bell = ctx.createRadialGradient(-size * 0.28, -size * 0.42, size * 0.02, 0, 0, size * 1.08);
    bell.addColorStop(0, `rgba(250,255,255,${0.9 * alpha})`);
    bell.addColorStop(0.28, `rgba(${c[0]},${c[1]},${c[2]},${0.58 * alpha})`);
    bell.addColorStop(0.72, `rgba(${c[0]},${c[1]},${c[2]},${0.28 * alpha})`);
    bell.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${0.08 * alpha})`);
    ctx.beginPath();
    ctx.moveTo(-size, -size * 0.02);
    ctx.bezierCurveTo(-size * 0.88, -size * 0.96, size * 0.88, -size * 0.96, size, -size * 0.02);
    ctx.bezierCurveTo(size * 0.8, size * 0.35, size * 0.38, size * 0.43, 0, size * 0.37);
    ctx.bezierCurveTo(-size * 0.38, size * 0.43, -size * 0.8, size * 0.35, -size, -size * 0.02);
    ctx.closePath();
    ctx.fillStyle = bell;
    ctx.fill();
    ctx.strokeStyle = `rgba(229,253,255,${0.72 * alpha})`;
    ctx.lineWidth = Math.max(0.8, size * 0.052);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    const veinY = -size * 0.11;
    for (let vein = 0; vein < 20; vein += 1) {
      const angle = (vein / 20) * TAU;
      const endX = Math.cos(angle) * size * (0.72 + (vein % 3) * 0.05);
      const endY = veinY + Math.sin(angle) * size * 0.48;
      const bend = Math.sin(phase * 0.8 + vein * 1.7) * size * 0.055;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * size * 0.24, veinY + Math.sin(angle) * size * 0.13);
      ctx.quadraticCurveTo(endX * 0.58 + bend, endY * 0.56, endX, endY);
      ctx.strokeStyle = `rgba(232,251,255,${(0.11 + (vein % 4 === 0 ? 0.09 : 0)) * alpha})`;
      ctx.lineWidth = Math.max(0.45, size * 0.012);
      ctx.stroke();
    }

    ctx.restore();

    const faceMap = { happy: 0, lively: 1, gentle: 2, surprised: 3, shy: 4 };
    const expression = faceExpression && faceMap[faceExpression] !== undefined ? faceMap[faceExpression] : hue % 5;
    const faceY = -size * 0.045;
    const eyeX = size * 0.21;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = `rgba(42,55,96,${0.7 * alpha})`;
    ctx.fillStyle = `rgba(42,55,96,${0.72 * alpha})`;
    ctx.lineWidth = Math.max(0.75, size * 0.035);
    const dotEye = (side) => {
      ctx.beginPath();
      ctx.arc(side * eyeX, faceY, size * 0.042, 0, TAU);
      ctx.fill();
    };
    const closedEye = (side) => {
      ctx.beginPath();
      ctx.moveTo(side * eyeX - size * 0.065, faceY);
      ctx.quadraticCurveTo(side * eyeX, faceY + size * 0.055, side * eyeX + size * 0.065, faceY);
      ctx.stroke();
    };
    if (expression === 0) {
      dotEye(-1);
      dotEye(1);
      ctx.beginPath();
      ctx.arc(0, faceY + size * 0.055, size * 0.13, 0.18, Math.PI - 0.18);
      ctx.stroke();
    } else if (expression === 1) {
      closedEye(-1);
      dotEye(1);
      ctx.beginPath();
      ctx.arc(0, faceY + size * 0.06, size * 0.12, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else if (expression === 2) {
      closedEye(-1);
      closedEye(1);
      ctx.beginPath();
      ctx.moveTo(-size * 0.07, faceY + size * 0.13);
      ctx.quadraticCurveTo(0, faceY + size * 0.17, size * 0.07, faceY + size * 0.13);
      ctx.stroke();
    } else if (expression === 3) {
      dotEye(-1);
      dotEye(1);
      ctx.beginPath();
      ctx.arc(0, faceY + size * 0.13, size * 0.055, 0, TAU);
      ctx.stroke();
    } else {
      closedEye(-1);
      closedEye(1);
      ctx.beginPath();
      ctx.moveTo(-size * 0.12, faceY + size * 0.09);
      ctx.quadraticCurveTo(-size * 0.055, faceY + size * 0.17, 0, faceY + size * 0.105);
      ctx.quadraticCurveTo(size * 0.055, faceY + size * 0.17, size * 0.12, faceY + size * 0.09);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const highlight = ctx.createRadialGradient(-size * 0.35, -size * 0.48, 0, -size * 0.35, -size * 0.48, size * 0.42);
    highlight.addColorStop(0, `rgba(255,255,255,${0.72 * alpha})`);
    highlight.addColorStop(0.28, `rgba(255,255,255,${0.2 * alpha})`);
    highlight.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(-size * 0.35, -size * 0.48, size * 0.42, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (tentacleGrowth > 0.005) {
      const grown = easeOut(clamp(tentacleGrowth, 0, 1));
      ctx.shadowBlur = size * 0.36;
      ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},${0.35 * alpha})`;
      for (let i = -2; i <= 2; i += 1) {
        const rootX = i * size * 0.23;
        const sway = Math.sin(phase + i * 1.15) * size * (reduceMotion ? 0.08 : 0.18) * grown;
        ctx.beginPath();
        ctx.moveTo(rootX, size * 0.27);
        ctx.bezierCurveTo(
          rootX + sway,
          size * (0.3 + 0.28 * grown),
          rootX - sway * 0.7,
          size * (0.3 + 0.55 * grown),
          rootX + sway * 0.45,
          size * (0.3 + (0.72 + (2 - Math.abs(i)) * 0.1) * grown),
        );
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.38 - Math.abs(i) * 0.04) * alpha * grown})`;
        ctx.lineWidth = Math.max(0.55, size * 0.026);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawBubbles() {
    state.bubbles.forEach((bubble) => {
      const alpha = clamp(1 - bubble.age / 9, 0, 0.72);
      ctx.save();
      ctx.translate(bubble.x, bubble.y);
      ctx.shadowBlur = bubble.size * 1.4;
      ctx.shadowColor = `rgba(143,229,229,${alpha * 0.45})`;
      const fill = ctx.createRadialGradient(-bubble.size * 0.3, -bubble.size * 0.35, 0, 0, 0, bubble.size);
      fill.addColorStop(0, `rgba(255,255,255,${alpha * 0.42})`);
      fill.addColorStop(0.28, `rgba(153,234,232,${alpha * 0.12})`);
      fill.addColorStop(1, `rgba(95,178,205,${alpha * 0.03})`);
      ctx.fillStyle = fill;
      ctx.strokeStyle = `rgba(205,251,248,${alpha * 0.62})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, bubble.size, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawBabyJellyfish() {
    state.babies.forEach((baby) => {
      const separatedAge = Math.max(0, baby.age - baby.birthDuration);
      const turnT = clamp(separatedAge / 0.46, 0, 1);
      const birthRotation = Math.atan2(
        Math.sin(baby.birthAngle - Math.PI / 2),
        Math.cos(baby.birthAngle - Math.PI / 2),
      );
      const rotation = baby.age < baby.birthDuration
        ? birthRotation
        : birthRotation * (1 - easeOut(turnT)) + Math.sin(turnT * Math.PI) * 0.1 + Math.sin(baby.phase * 2.4) * (baby.spin || 0);
      const squashAngle = baby.age < baby.birthDuration
        ? baby.birthAngle - birthRotation
        : baby.touchAngle;
      const tentacleGrowth = easeOut(clamp((separatedAge - 0.08) / 0.62, 0, 1));
      const idleMotion = baby.detached ? clamp(separatedAge / 1.2, 0, 1) : 0;
      const idleX = Math.sin(baby.phase * 1.7 + baby.hue) * baby.size * 0.08 * idleMotion;
      const idleY = Math.cos(baby.phase * 1.34 + baby.hue * 0.7) * baby.size * 0.06 * idleMotion;
      drawJellyfishBody(
        baby.x + (reduceMotion ? 0 : idleX),
        baby.y + (reduceMotion ? 0 : idleY),
        baby.size * (0.58 + clamp(baby.age / baby.birthDuration, 0, 1) * 0.42),
        baby.phase,
        baby.hue,
        clamp(baby.age / 0.8, 0.12, 1),
        baby.squash + baby.birthSquash,
        squashAngle,
        baby.releaseGlow,
        rotation,
        tentacleGrowth,
        baby.expression,
      );
    });
  }

  function drawRipples() {
    state.ripples.forEach((ripple) => {
      const duration = ripple.duration || 3.4;
      const t = ripple.age / duration;
      const color = palette[ripple.hue];
      ctx.save();
      ctx.translate(ripple.x, ripple.y);
      ctx.scale(1, ripple.pop ? 0.82 : 0.62);
      const startRadius = ripple.pop ? ripple.radius * 0.56 : 28;
      const travel = ripple.pop ? ripple.radius * 1.9 : 210 * ripple.strength;
      if (ripple.pop) {
        const glowRadius = startRadius + easeOut(t) * travel;
        const glow = ctx.createRadialGradient(0, 0, glowRadius * 0.15, 0, 0, glowRadius);
        glow.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${0.18 * (1 - t)})`);
        glow.addColorStop(0.52, `rgba(${color[0]},${color[1]},${color[2]},${0.12 * (1 - t)})`);
        glow.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, TAU);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, startRadius + easeOut(t) * travel, 0, TAU);
        ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${(1 - t) * 0.42})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  function drawGestureCursor() {
    const camera = state.camera;
    if (!camera.enabled || !camera.ready || camera.cursorAlpha < 0.01) return;
    const alpha = camera.cursorAlpha;
    const cursorX = camera.active && state.pointer.id === "camera" ? state.pointer.x : camera.x;
    const cursorY = camera.active && state.pointer.id === "camera" ? state.pointer.y : camera.y;
    const shiftX = cursorX - camera.x;
    const shiftY = cursorY - camera.y;
    const fingerA = { x: camera.fingerAX + shiftX, y: camera.fingerAY + shiftY };
    const fingerB = { x: camera.fingerBX + shiftX, y: camera.fingerBY + shiftY };
    const radius = 12 + camera.presence * 8 + (camera.active ? Math.sin(state.elapsed * 4.2) * 1.5 : 0);
    const pinch = clamp((0.78 - camera.pinchRatio) / 0.58, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fingerA.x, fingerA.y);
    ctx.quadraticCurveTo(cursorX, cursorY, fingerB.x, fingerB.y);
    ctx.strokeStyle = `rgba(178,246,239,${(0.1 + pinch * 0.3) * alpha})`;
    ctx.lineWidth = 1 + pinch * 1.6;
    ctx.shadowBlur = 10 + pinch * 12;
    ctx.shadowColor = `rgba(126,229,220,${0.34 * alpha})`;
    ctx.stroke();

    [fingerA, fingerB].forEach((finger) => {
      const glow = ctx.createRadialGradient(finger.x, finger.y, 0, finger.x, finger.y, radius * 2.25);
      glow.addColorStop(0, `rgba(234,255,252,${0.34 * alpha})`);
      glow.addColorStop(0.32, `rgba(126,229,220,${0.2 * alpha})`);
      glow.addColorStop(1, "rgba(126,229,220,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(finger.x, finger.y, radius * 2.25, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(233,255,252,${(0.42 + pinch * 0.34) * alpha})`;
      ctx.beginPath();
      ctx.arc(finger.x, finger.y, 2.2 + pinch * 1.5, 0, TAU);
      ctx.fill();
    });

    if (camera.active) {
      const core = ctx.createRadialGradient(cursorX, cursorY, 0, cursorX, cursorY, 24);
      core.addColorStop(0, `rgba(239,255,253,${0.34 * alpha})`);
      core.addColorStop(0.4, `rgba(126,229,220,${0.12 * alpha})`);
      core.addColorStop(1, "rgba(126,229,220,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 24, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawContourMountainAura() {
    const radius = baseRadius();
    const pressure = state.contourPressure;
    const drag = state.contourDrag;
    const release = state.contourRelease;
    const memories = state.memories.slice(-18);
    const memoryComplexity = clamp(state.memories.length / 18, 0, 1);
    const ringCount = 8 + Math.round(memoryComplexity * 3);
    const energy = 0.24 + pressure * 0.58 + drag * 0.22 + release * 0.28;
    const orbitStart = radius * 1.07;
    const orbitLimit = Math.min(radius * 1.62, Math.min(state.width, state.height) * 0.455);
    const orbitGap = Math.max(2.2, (orbitLimit - orbitStart) / Math.max(1, ringCount - 1));

    ctx.save();
    ctx.translate(state.center.x, state.center.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let ring = 0; ring < ringCount; ring += 1) {
      const c = vortexPalette[(ring + state.count) % vortexPalette.length];
      const base = orbitStart + ring * orbitGap + release * radius * 0.065;
      const alpha = (0.17 + energy * 0.13) * (1 - ring / (ringCount * 1.9));
      const steps = 150;
      ctx.beginPath();
      for (let step = 0; step <= steps; step += 1) {
        const angle = (step / steps) * TAU;
        const touchPull = Math.exp(-Math.pow(shortestAngle(angle, state.contourAngle) / 0.62, 2));
        const opposite = Math.exp(-Math.pow(shortestAngle(angle, state.contourAngle + Math.PI) / 0.9, 2));
        let mountain = 0;
        memories.forEach((memory, index) => {
          const peakAngle = memory.landX * TAU - Math.PI / 2;
          const spread = 0.17 + (index % 4) * 0.025 + ring * 0.004;
          const distance = shortestAngle(angle, peakAngle) / spread;
          const peak = Math.exp(-distance * distance * 0.72) * memory.landPeak * radius * 0.56;
          mountain = Math.max(mountain, peak);
        });
        const fingerprint =
          Math.sin(angle * 3 + ring * 0.76) * radius * 0.009 +
          Math.sin(angle * 7 - ring * 0.31) * radius * 0.0035;
        const slowBreath = reduceMotion ? 0 : Math.sin(state.elapsed * 0.38 + ring * 0.58) * radius * 0.002;
        const deformation =
          -pressure * radius * 0.072 * touchPull +
          drag * radius * 0.11 * touchPull +
          pressure * radius * 0.026 * opposite;
        const localRadius = base + mountain + fingerprint + slowBreath + deformation;
        const x = Math.cos(angle) * localRadius;
        const y = Math.sin(angle) * localRadius * (0.945 + ring * 0.0018);
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.shadowBlur = 5 + energy * 10;
      ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(0.5, alpha * 1.55)})`;
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      ctx.lineWidth = 0.78 + energy * 0.5 - ring * 0.01;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCreature() {
    const radius = baseRadius();
    ctx.save();

    ctx.save();
    const halo = ctx.createRadialGradient(state.center.x, state.center.y, radius * 0.28, state.center.x, state.center.y, radius * 1.72);
    halo.addColorStop(0, "rgba(255,196,225,0.2)");
    halo.addColorStop(0.5, "rgba(147,219,231,0.09)");
    halo.addColorStop(1, "rgba(73,102,151,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(state.center.x - radius * 1.8, state.center.y - radius * 1.8, radius * 3.6, radius * 3.6);
    ctx.restore();

    ctx.save();
    ctx.lineCap = "round";
    for (let i = -6; i <= 6; i += 1) {
      const rootX = state.center.x + i * radius * 0.105;
      const rootY = state.center.y + radius * (0.5 + Math.abs(i) * 0.009);
      const playProximity = Math.exp(-Math.pow((rootX - state.tentaclePlay.x) / (radius * 0.52), 2));
      const playSway = state.tentaclePlay.direction * state.tentaclePlay.amount * playProximity * radius * 0.36;
      const sway = Math.sin(state.elapsed * 0.58 + i * 0.7) * radius * (0.08 + Math.abs(i) * 0.006) + playSway;
      const length = radius * (0.62 + (6 - Math.abs(i)) * 0.045);
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.bezierCurveTo(
        rootX + sway,
        rootY + length * 0.28,
        rootX - sway * 0.8,
        rootY + length * 0.7,
        rootX + sway * 0.55,
        rootY + length,
      );
      ctx.strokeStyle = `rgba(255,153,203,${0.18 + (6 - Math.abs(i)) * 0.012})`;
      ctx.lineWidth = Math.max(0.75, radius * 0.009);
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(255,145,199,0.3)";
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let arm = -2; arm <= 2; arm += 1) {
      const rootX = state.center.x + arm * radius * 0.17;
      const rootY = state.center.y + radius * 0.46;
      const length = radius * (0.72 + (2 - Math.abs(arm)) * 0.13);
      const playProximity = Math.exp(-Math.pow((rootX - state.tentaclePlay.x) / (radius * 0.48), 2));
      const playSway = state.tentaclePlay.direction * state.tentaclePlay.amount * playProximity * radius * 0.3;
      const sway = Math.sin(state.elapsed * 0.48 + arm * 1.4) * radius * 0.11 + playSway;
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.bezierCurveTo(
        rootX + sway * 0.3,
        rootY + length * 0.3,
        rootX - sway,
        rootY + length * 0.62,
        rootX + sway * 0.55,
        rootY + length,
      );
      ctx.strokeStyle = `rgba(250,232,248,${0.3 + (2 - Math.abs(arm)) * 0.055})`;
      ctx.lineWidth = radius * (0.09 + (2 - Math.abs(arm)) * 0.012);
      ctx.shadowBlur = radius * 0.09;
      ctx.shadowColor = "rgba(255,205,235,0.42)";
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      const segments = 36;
      for (let segment = 0; segment <= segments; segment += 1) {
        const t = segment / segments;
        const y = rootY + length * t;
        const centerLine = rootX + Math.sin(t * Math.PI * 1.35 + state.elapsed * 0.48 + arm) * sway;
        const ruffle = Math.sin(t * Math.PI * 7 + arm) * radius * (0.024 + t * 0.008);
        const px = centerLine + ruffle;
        if (segment === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.strokeStyle = "rgba(255,248,253,0.38)";
      ctx.lineWidth = radius * 0.018;
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.filter = `blur(${Math.round(radius * 0.065)}px)`;
    traceBlob(radius + 5);
    ctx.fillStyle = "rgba(255,145,201,0.23)";
    ctx.fill();
    ctx.restore();

    traceBlob(radius);
    const body = ctx.createRadialGradient(
      state.center.x - radius * 0.28,
      state.center.y - radius * 0.36,
      radius * 0.08,
      state.center.x + radius * 0.08,
      state.center.y + radius * 0.12,
      radius * 1.16,
    );
    body.addColorStop(0, "rgba(255,252,253,0.96)");
    body.addColorStop(0.2, "rgba(255,214,233,0.88)");
    body.addColorStop(0.52, "rgba(247,145,194,0.7)");
    body.addColorStop(0.8, "rgba(221,103,169,0.54)");
    body.addColorStop(1, "rgba(145,72,145,0.4)");
    ctx.fillStyle = body;
    ctx.fill();

    ctx.save();
    traceBlob(radius - 4);
    ctx.clip();

    const wash = ctx.createLinearGradient(state.center.x - radius, state.center.y - radius, state.center.x + radius, state.center.y + radius);
    wash.addColorStop(0, "rgba(255,245,249,0.36)");
    wash.addColorStop(0.42, "rgba(255,255,255,0.06)");
    wash.addColorStop(0.73, "rgba(255,179,214,0.24)");
    wash.addColorStop(1, "rgba(156,183,225,0.18)");
    traceBlob(radius - 4);
    ctx.fillStyle = wash;
    ctx.fill();

    const innerGlow = ctx.createRadialGradient(
      state.center.x,
      state.center.y + radius * 0.08,
      radius * 0.02,
      state.center.x,
      state.center.y + radius * 0.08,
      radius * 0.43,
    );
    innerGlow.addColorStop(0, "rgba(255,244,250,0.34)");
    innerGlow.addColorStop(0.46, "rgba(255,181,218,0.18)");
    innerGlow.addColorStop(1, "rgba(255,181,218,0)");
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y + radius * 0.08, radius * 0.43, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    const motherVeinY = state.center.y - radius * 0.1;
    const motherCoreY = state.center.y - radius * 0.66;
    for (let vein = 0; vein < 24; vein += 1) {
      const angle = (vein / 24) * TAU;
      const startX = state.center.x + Math.cos(angle) * radius * 0.23;
      const startY = motherVeinY + Math.sin(angle) * radius * 0.14;
      const endX = state.center.x + Math.cos(angle) * radius * (0.7 + (vein % 3) * 0.025);
      const endY = motherVeinY + Math.sin(angle) * radius * (0.5 + (vein % 2) * 0.018);
      const bend = Math.sin(state.elapsed * 0.32 + vein * 1.7) * radius * 0.022;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(
        (startX + endX) * 0.5 + bend,
        (startY + endY) * 0.5,
        endX,
        endY,
      );
      ctx.strokeStyle = `rgba(255,234,246,${0.1 + (vein % 4 === 0 ? 0.08 : 0)})`;
      ctx.lineWidth = Math.max(0.55, radius * 0.0048);
      ctx.stroke();
    }
    ctx.restore();

    state.memories.forEach((memory) => {
      const drift = Math.sin(state.elapsed * 0.34 + memory.phase) * 0.025;
      const distance = radius * (memory.radius + drift);
      const x = state.center.x + Math.cos(memory.angle + drift) * distance;
      const y = state.center.y + Math.sin(memory.angle + drift) * distance * 0.88;
      const c = palette[memory.hue];
      const glowRadius = memory.size * 2.8;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      glow.addColorStop(0, `rgba(255,255,255,0.5)`);
      glow.addColorStop(0.25, `rgba(${c[0]},${c[1]},${c[2]},0.3)`);
      glow.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, TAU);
      ctx.fill();
    });

    ctx.beginPath();
    const skirtY = state.center.y + radius * 0.48;
    ctx.moveTo(state.center.x - radius * 0.68, skirtY);
    for (let i = -6; i < 7; i += 1) {
      const x1 = state.center.x + (i + 0.5) * radius * 0.105;
      const x2 = state.center.x + (i + 1) * radius * 0.105;
      ctx.quadraticCurveTo(x1, skirtY + radius * (i % 2 === 0 ? 0.05 : 0.025), x2, skirtY);
    }
    ctx.strokeStyle = "rgba(255,207,231,0.68)";
    ctx.lineWidth = Math.max(1.15, radius * 0.009);
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(255,128,188,0.48)";
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.shadowBlur = radius * 0.13;
    ctx.shadowColor = "rgba(255,218,241,0.68)";
    ctx.translate(state.center.x, motherCoreY);
    ctx.scale(1.28, 0.68);
    for (let petal = 0; petal < 4; petal += 1) {
      ctx.save();
      ctx.rotate((petal / 4) * TAU);
      ctx.beginPath();
      ctx.ellipse(0, -radius * 0.068, radius * 0.048, radius * 0.074, 0, 0, TAU);
      ctx.fillStyle = "rgba(255,235,248,0.1)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,232,247,0.62)";
      ctx.lineWidth = Math.max(1.1, radius * 0.014);
      ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,250,253,0.68)";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.032, 0, TAU);
    ctx.fill();
    ctx.restore();

    const blinkCycle = state.elapsed % 8.2;
    const blink = blinkCycle > 7.72 ? Math.abs(blinkCycle - 7.96) / 0.24 : 1;
    const mood = performance.now() < state.motherMoodUntil ? state.motherMood : "happy";
    const eyeY = state.center.y + radius * 0.035;
    [-1, 1].forEach((side) => {
      const x = state.center.x + side * radius * 0.112;
      ctx.beginPath();
      ctx.fillStyle = "rgba(91,36,77,0.64)";
      ctx.ellipse(x, eyeY, radius * (mood === "surprised" ? 0.024 : 0.018), Math.max(0.7, radius * 0.031 * blink), 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.arc(x - radius * 0.005, eyeY - radius * 0.009, radius * 0.0045, 0, TAU);
      ctx.fill();
    });
    ctx.beginPath();
    ctx.strokeStyle = "rgba(101,42,83,0.52)";
    ctx.lineWidth = Math.max(1.1, radius * 0.007);
    ctx.lineCap = "round";
    if (mood === "surprised") {
      ctx.arc(state.center.x, eyeY + radius * 0.058, radius * 0.026, 0, TAU);
    } else if (mood === "shy") {
      ctx.moveTo(state.center.x - radius * 0.035, eyeY + radius * 0.058);
      ctx.quadraticCurveTo(state.center.x, eyeY + radius * 0.076, state.center.x + radius * 0.035, eyeY + radius * 0.058);
    } else {
      ctx.arc(state.center.x, eyeY + radius * 0.044, radius * 0.052, 0.16, Math.PI - 0.16);
    }
    ctx.stroke();
    [-1, 1].forEach((side) => {
      const blushX = state.center.x + side * radius * 0.22;
      const blushY = eyeY + radius * 0.054;
      const blush = ctx.createRadialGradient(blushX, blushY, 0, blushX, blushY, radius * 0.05);
      blush.addColorStop(0, `rgba(255,119,181,${mood === "shy" ? 0.58 : 0.3})`);
      blush.addColorStop(1, "rgba(255,119,181,0)");
      ctx.fillStyle = blush;
      ctx.beginPath();
      ctx.arc(blushX, blushY, radius * 0.05, 0, TAU);
      ctx.fill();
    });
    ctx.restore();

    ctx.save();
    traceBlob(radius);
    ctx.strokeStyle = "rgba(255,183,218,0.62)";
    ctx.lineWidth = 2.2;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(255,116,185,0.5)";
    ctx.stroke();
    ctx.restore();

    ctx.save();
    traceBlob(radius - 8);
    ctx.clip();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.76)";
    ctx.lineWidth = radius * 0.042;
    ctx.lineCap = "round";
    ctx.arc(state.center.x - radius * 0.25, state.center.y - radius * 0.28, radius * 0.48, 3.62, 4.88);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,238,248,0.38)";
    ctx.lineWidth = radius * 0.014;
    ctx.arc(state.center.x - radius * 0.04, state.center.y - radius * 0.04, radius * 0.73, 2.05, 2.72);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function render(now) {
    const dt = Math.min((now - state.lastTime) / 1000, 0.033);
    state.lastTime = now;
    processCameraGesture(now);
    update(dt);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, state.width, state.height);
    drawBackground();
    drawBubbles();
    drawBabyJellyfish();
    drawRipples();
    drawContourMountainAura();
    drawCreature();
    drawGestureCursor();
    requestAnimationFrame(render);
  }

  enterButton.addEventListener("click", enter);
  soundButton.addEventListener("click", () => {
    state.soundOn = !state.soundOn;
    if (state.soundOn) initAudio();
    updateSoundButton();
  });
  cameraButton.addEventListener("click", toggleCamera);
  backgroundButton.addEventListener("click", toggleBackgroundMode);
  tutorialButton.addEventListener("click", () => beginTutorial(true));
  chooseMouseMode.addEventListener("click", () => {
    state.tutorial.mode = "mouse";
    localStorage.setItem("preferredInputMode", "mouse");
    if (state.camera.enabled || state.camera.starting) stopCamera("");
    setTutorialStep("APPROACH");
  });
  chooseGestureMode.addEventListener("click", () => {
    state.tutorial.mode = "gesture";
    state.tutorial.resumeStep = null;
    localStorage.setItem("preferredInputMode", "gesture");
    setTutorialStep("CAMERA_CHECK");
    startCamera();
  });
  resumeTutorial.addEventListener("click", () => {
    const saved = localStorage.getItem("tutorialCurrentStep") || "INPUT_SELECTION";
    state.tutorial.mode = localStorage.getItem("preferredInputMode") || "mouse";
    if (state.tutorial.mode === "gesture") {
      state.tutorial.resumeStep = saved;
      setTutorialStep("CAMERA_CHECK", { save: false });
      startCamera();
    } else {
      setTutorialStep(saved);
    }
  });
  restartTutorial.addEventListener("click", () => beginTutorial(true));
  tutorialBack.addEventListener("click", backTutorialStep);
  tutorialRetry.addEventListener("click", retryTutorialStep);
  switchToMouse.addEventListener("click", () => {
    const next = state.tutorial.step === "CAMERA_CHECK" ? state.tutorial.resumeStep || "APPROACH" : state.tutorial.step;
    state.tutorial.mode = "mouse";
    localStorage.setItem("preferredInputMode", "mouse");
    if (state.camera.enabled || state.camera.starting) stopCamera("");
    setTutorialStep(next);
  });
  skipTutorial.addEventListener("click", () => finishTutorial(true));
  startTutorial.addEventListener("click", () => {
    if (state.tutorial.step === "QUICK_GUIDE") {
      finishTutorial(false);
    } else if (state.tutorial.step === "CAMERA_CHECK" && state.tutorial.progress >= 1) {
      const next = state.tutorial.resumeStep || "APPROACH";
      state.tutorial.resumeStep = null;
      setTutorialStep(next);
    } else if (state.tutorial.step === "COMPLETE") {
      finishTutorial(false);
    }
  });
  aboutButton.addEventListener("click", () => showAbout(true));
  closeAbout.addEventListener("click", () => showAbout(false));
  veil.addEventListener("click", () => showAbout(false));
  resetButton.addEventListener("click", resetMemories);
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  window.addEventListener("resize", resize);
  ["pointermove", "pointerdown", "keydown"].forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "m") {
      state.soundOn = !state.soundOn;
      updateSoundButton();
    }
    if (event.key.toLowerCase() === "c" && !event.repeat) toggleCamera();
    if (event.key.toLowerCase() === "b" && !event.repeat) toggleBackgroundMode();
    if (event.key.toLowerCase() === "r") resetMemories();
    if (event.key === "?") beginTutorial(true);
    if (event.code === "Space" && !event.repeat && state.entered) {
      event.preventDefault();
      state.pointer.x = state.center.x;
      state.pointer.y = state.center.y - baseRadius() * 0.7;
      state.pointer.down = true;
      state.pointer.startX = state.pointer.x;
      state.pointer.startY = state.pointer.y;
      state.pointer.startedAt = performance.now();
      state.touchAngle = -Math.PI / 2;
      state.interactionMode = "squish";
      hint.textContent = "慢一点，它正在改变";
    }
    if (event.key === "Escape") {
      showAbout(false);
      if (state.tutorial.active) tutorialHelp.textContent = "请使用“跳过教程”安全退出，当前进度会被保存。";
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "Space" && state.pointer.down && state.pointer.id === null) {
      event.preventDefault();
      releasePointer();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.camera.enabled) stopCamera("");
  });
  window.addEventListener("beforeunload", () => stopCamera(""));

  babyCount.textContent = String(state.babies.length).padStart(2, "0");
  updateSoundButton();
  updateCameraButton();
  updateBackgroundButton();
  resize();
  requestAnimationFrame(render);
})();
