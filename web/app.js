(() => {
  "use strict";

  const canvas = document.querySelector("#world");
  const ctx = canvas.getContext("2d");
  const invitation = document.querySelector("#invitation");
  const enterButton = document.querySelector("#enterButton");
  const soundButton = document.querySelector("#soundButton");
  const cameraButton = document.querySelector("#cameraButton");
  const cameraPreviewShell = document.querySelector("#cameraPreviewShell");
  const cameraPreview = document.querySelector("#cameraPreview");
  const aboutButton = document.querySelector("#aboutButton");
  const aboutPanel = document.querySelector("#aboutPanel");
  const closeAbout = document.querySelector("#closeAbout");
  const resetButton = document.querySelector("#resetButton");
  const veil = document.querySelector("#veil");
  const hint = document.querySelector("#hint");
  const memoryCount = document.querySelector("#memoryCount");

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
    activeBaby: null,
    tentaclePlay: { amount: 0, x: 0, y: 0, direction: 0 },
    entered: false,
    soundOn: true,
    lastTime: performance.now(),
    elapsed: 0,
    count: Number.parseInt(localStorage.getItem("softness-memory-count") || "0", 10),
    nodes: Array.from({ length: NODES }, (_, i) => ({
      angle: (i / NODES) * TAU,
      value: 0,
      velocity: 0,
      phase: Math.sin(i * 4.17) * 0.7,
    })),
    memories: [],
    ripples: [],
    babies: [],
    dust: [],
    audio: null,
    camera: {
      enabled: false,
      ready: false,
      starting: false,
      active: false,
      handsfree: null,
      hands: null,
      startupTimer: null,
      previewTimer: null,
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
      gestureOriginX: 0,
      gestureOriginY: 0,
      pointerOriginX: 0,
      pointerOriginY: 0,
      indexPrevX: null,
      indexPrevY: null,
      touchBaby: null,
    },
  };

  const memorySeed = state.count;
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

  for (let i = 0; i < 54; i += 1) {
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

  function updateCameraButton(label = "手势") {
    const engaged = state.camera.enabled || state.camera.starting;
    cameraButton.setAttribute("aria-pressed", String(engaged));
    cameraButton.setAttribute("aria-label", engaged ? "关闭摄像头手势" : "开启摄像头手势");
    cameraButton.querySelector(".camera-copy").textContent = label;
    cameraButton.classList.toggle("is-calibrating", state.camera.starting || (state.camera.enabled && !state.camera.ready));
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
    cameraPreview.play().catch(() => {});
    cameraPreviewShell.classList.add("is-visible");
    cameraPreviewShell.setAttribute("aria-hidden", "false");
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
      presence: 0,
      presenceFrames: 0,
      absentFrames: 0,
      cursorAlpha: 0,
      rearm: true,
      pinchRatio: 2,
      pinchFrames: 0,
      openFrames: 0,
      indexPrevX: null,
      indexPrevY: null,
      touchBaby: null,
    });
    updateCameraButton();
    if (message) hint.textContent = message;
  }

  function startCamera() {
    if (state.camera.starting || state.camera.enabled) return;
    if (!window.Handsfree || !navigator.mediaDevices?.getUserMedia) {
      hint.textContent = "Handsfree.js 尚未载入，仍可用鼠标或触屏";
      return;
    }
    if (!state.entered) enter();
    const requestToken = ++state.camera.requestToken;
    state.camera.starting = true;
    updateCameraButton("加载 Handsfree");
    hint.textContent = "正在准备双指捏合模型，首次打开会稍慢";
    try {
      const handsfree = new window.Handsfree({
        showDebug: false,
        assetsPath: "https://unpkg.com/handsfree@8.5.1/build/lib/assets",
        hands: {
          enabled: true,
          maxNumHands: 1,
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
        updateCameraButton("Handsfree 已开");
        showCameraPreview(handsfree);
        hint.textContent = "一根食指可以逗小水母、拨触须；双指捏母体会出生";
      });
    } catch (error) {
      if (state.camera.requestToken !== requestToken) return;
      shutdownHandsfree(state.camera.handsfree);
      state.camera.starting = false;
      state.camera.handsfree = null;
      updateCameraButton();
      const blocked = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      hint.textContent = blocked ? "没有获得摄像头权限，仍可用鼠标或触屏" : "Handsfree.js 启动失败，仍可用鼠标或触屏";
    }
  }

  function toggleCamera() {
    if (state.camera.enabled || state.camera.starting) stopCamera();
    else startCamera();
  }

  function processCameraGesture(now) {
    const camera = state.camera;
    if (!camera.enabled || !camera.handsfree || now - camera.lastFrameAt < 46) return;
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
      // Handsfree can occasionally keep reporting a pinch while the thumb is
      // already folded away from an extended index finger. Cross-check the
      // plugin state with the actual landmark gap so single-finger play stays live.
      pinching = (pluginPinching && targetPinchRatio < 0.92) || targetPinchRatio < 0.46;
      const smoothing = camera.presenceFrames ? 0.42 : 1;
      camera.fingerAX = mix(camera.fingerAX || targetAX, targetAX, smoothing);
      camera.fingerAY = mix(camera.fingerAY || targetAY, targetAY, smoothing);
      camera.fingerBX = mix(camera.fingerBX || targetBX, targetBX, smoothing);
      camera.fingerBY = mix(camera.fingerBY || targetBY, targetBY, smoothing);
      camera.x = mix(camera.x || targetX, targetX, smoothing);
      camera.y = mix(camera.y || targetY, targetY, smoothing);
      camera.pinchRatio = mix(camera.pinchRatio, targetPinchRatio, 0.44);
      camera.presence = mix(camera.presence, clamp((0.76 - camera.pinchRatio) / 0.56, 0, 1), 0.38);
      camera.presenceFrames += 1;
      camera.absentFrames = 0;
      if (pinching) {
        camera.pinchFrames += 1;
        camera.openFrames = 0;
      } else {
        camera.openFrames += 1;
        camera.pinchFrames = 0;
      }
    } else {
      camera.presence *= 0.82;
      camera.presenceFrames = 0;
      camera.absentFrames += 1;
      camera.pinchFrames = 0;
      camera.openFrames += 1;
    }
    camera.cursorAlpha = mix(camera.cursorAlpha, present ? 1 : 0, present ? 0.3 : 0.16);

    let cameraTouchBaby = null;
    let playingTentacles = false;
    if (present && !camera.active && !pinching && now >= camera.suspendedUntil) {
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

    if (present && !pinching && !camera.active && camera.openFrames >= 4) camera.rearm = true;

    const canControl = now >= camera.suspendedUntil && (!state.pointer.down || state.pointer.id === "camera");
    if (present && canControl) {
      if (!camera.active) {
        const distance = Math.hypot(camera.x - state.center.x, camera.y - state.center.y);
        if (camera.rearm && camera.pinchFrames === 3 && distance <= baseRadius() * 1.34) {
          camera.active = true;
          camera.rearm = false;
          camera.gestureOriginX = camera.x;
          camera.gestureOriginY = camera.y;
          camera.pointerOriginX = camera.x;
          camera.pointerOriginY = camera.y;
          state.pointer = { x: camera.x, y: camera.y, down: true, id: "camera", startedAt: now };
          state.activeBaby = null;
          state.touchAngle = Math.atan2(camera.y - state.center.y, camera.x - state.center.x);
          canvas.classList.add("is-touching");
          hint.textContent = "夹住母体了——保持双指合拢，向外拉";
        } else if (camera.openFrames >= 2) {
          hint.textContent = cameraTouchBaby
            ? "指尖碰到了它——它软软地让开了"
            : playingTentacles
              ? "食指拨过触须——它们顺着水流摆开了"
              : "食指逗小水母或拨触须；双指移到母体再捏合";
        } else if (pinching && distance > baseRadius() * 1.34) {
          hint.textContent = "双指捏合只会抓住母体；一根食指可以逗小水母";
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
        state.touchAngle = Math.atan2(state.pointer.y - state.center.y, state.pointer.x - state.center.x);
        if (!pinching && camera.openFrames >= 3) {
          camera.active = false;
          camera.suspendedUntil = now + 260;
          releasePointer();
          hint.textContent = "张开手指——啵，它松开了";
        } else {
          hint.textContent = "保持夹住向外拉；张开双指就松手";
        }
      }
    } else if (camera.active && camera.absentFrames >= 5) {
      camera.active = false;
      releasePointer();
    } else if (!present && camera.absentFrames >= 6) {
      hint.textContent = "把拇指和食指伸进镜头";
    }
  }

  function showAbout(open) {
    aboutPanel.classList.toggle("is-open", open);
    veil.classList.toggle("is-visible", open);
    aboutPanel.setAttribute("aria-hidden", String(!open));
    aboutButton.setAttribute("aria-expanded", String(open));
    if (open) closeAbout.focus();
  }

  function enter() {
    state.entered = true;
    invitation.classList.add("is-gone");
    initAudio();
    canvas.focus({ preventScroll: true });
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

  function pointerDown(event) {
    if (!state.entered || aboutPanel.classList.contains("is-open")) return;
    if (state.camera.active) cancelCameraGesture();
    state.camera.suspendedUntil = performance.now() + 1400;
    const point = pointerPosition(event);
    const baby = findTouchableBaby(point.x, point.y, 1.1);
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
    const radius = baseRadius();
    const distance = Math.hypot(point.x - state.center.x, point.y - state.center.y);
    if (distance > radius * 1.28) return;
    state.pointer = { x: point.x, y: point.y, down: true, id: event.pointerId, startedAt: performance.now() };
    state.touchAngle = Math.atan2(point.y - state.center.y, point.x - state.center.x);
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-touching");
    hint.textContent = "慢一点，它正在改变";
    initAudio();
  }

  function pointerMove(event) {
    if (!state.pointer.down || state.pointer.id !== event.pointerId) return;
    const point = pointerPosition(event);
    state.pointer.x = point.x;
    state.pointer.y = point.y;
    if (state.activeBaby) {
      state.activeBaby.touchAngle = Math.atan2(point.y - state.activeBaby.y, point.x - state.activeBaby.x);
      return;
    }
    state.touchAngle = Math.atan2(point.y - state.center.y, point.x - state.center.x);
  }

  function releasePointer() {
    if (!state.pointer.down) return;
    if (state.activeBaby) {
      const baby = state.activeBaby;
      const awayAngle = baby.touchAngle + Math.PI;
      const impulse = 15 + baby.squash * 17;
      baby.vx += Math.cos(awayAngle) * impulse;
      baby.vy += Math.sin(awayAngle) * impulse - 6;
      baby.squashVelocity -= 0.16 + baby.squash * 0.16;
      baby.releaseGlow = 1;
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
      window.setTimeout(() => {
        if (!state.pointer.down) hint.textContent = "轻轻碰一碰漂游的小水母";
      }, 1800);
      return;
    }
    const strength = clamp(state.pressure * 0.72 + state.dragDistance / (baseRadius() * 2.8), 0.15, 1);
    state.pointer.down = false;
    state.pointer.id = null;
    canvas.classList.remove("is-touching");
    leaveMemory(strength);
    tone(strength, state.touchAngle);
    hint.textContent = "它正从母体慢慢分离";
    window.setTimeout(() => {
      if (!state.pointer.down) hint.textContent = "再捏出一只，或只是看它们漂游";
    }, 3200);
  }

  function spawnBaby(strength, hue) {
    const radius = baseRadius();
    const surface = bodySurfacePoint(state.touchAngle);
    const pullRatio = clamp(state.dragDistance / (radius * 0.7), 0, 1);
    const size = 14 + Math.pow(pullRatio, 0.8) * 20;
    const directionX = Math.cos(state.touchAngle);
    const directionY = Math.sin(state.touchAngle);
    const margin = size * 1.22;
    const edgeLimits = [];
    if (directionX > 0.001) edgeLimits.push((state.width - margin - surface.x) / directionX);
    if (directionX < -0.001) edgeLimits.push((margin - surface.x) / directionX);
    if (directionY > 0.001) edgeLimits.push((state.height - margin - surface.y) / directionY);
    if (directionY < -0.001) edgeLimits.push((margin - surface.y) / directionY);
    const edgeLimit = edgeLimits.length ? Math.max(size * 0.82, Math.min(...edgeLimits)) : radius * 0.48;
    const desiredTravel = clamp(state.dragDistance * 0.54, size * 1.05, radius * 0.48);
    state.babies.push({
      x: surface.x,
      y: surface.y,
      vx: Math.cos(state.touchAngle) * (5 + strength * 7),
      vy: -4 - strength * 4,
      size,
      strength,
      hue,
      phase: state.count * 0.91 + Math.random() * 0.5,
      age: 0,
      birthAngle: state.touchAngle,
      birthDuration: 1.55 + strength * 0.45,
      birthTravel: Math.min(desiredTravel, edgeLimit / 1.08),
      detached: false,
      birthSquash: 0,
      squash: 0,
      squashVelocity: 0,
      touchAngle: 0,
      releaseGlow: 0,
      cameraTouch: 0,
    });
    if (state.babies.length > 18) state.babies.shift();
  }

  function leaveMemory(strength) {
    state.count += 1;
    localStorage.setItem("softness-memory-count", String(state.count));
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
    spawnBaby(strength, hue);
    memoryCount.textContent = String(state.count).padStart(2, "0");
  }

  function resetMemories() {
    state.count = 0;
    state.memories.length = 0;
    state.ripples.length = 0;
    state.babies.length = 0;
    localStorage.removeItem("softness-memory-count");
    memoryCount.textContent = "00";
    hint.textContent = "它又一次，与你素不相识";
    showAbout(false);
  }

  function update(dt) {
    state.elapsed += dt;
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
    state.dragDistance = mainActive ? Math.max(0, pointerDistance - radius * 0.72) : mix(state.dragDistance, 0, 1 - Math.pow(0.02, dt));

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
        }
        baby.vx *= Math.pow(0.72, dt);
        baby.vy = mix(baby.vy, -2.2 - baby.strength * 1.5, 1 - Math.pow(0.3, dt));
      }
      if (!birthing && state.activeBaby !== baby) {
        baby.x += (baby.vx + Math.sin(baby.phase * 0.8) * 2.2) * dt;
        baby.y += baby.vy * dt;
      }
      if (baby.y < -baby.size * 4) baby.y = state.height + baby.size * 3;
      if (baby.x < -baby.size * 3) baby.x = state.width + baby.size * 2;
      if (baby.x > state.width + baby.size * 3) baby.x = -baby.size * 2;
    });
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
    gradient.addColorStop(0, "#0a3144");
    gradient.addColorStop(0.42, "#082638");
    gradient.addColorStop(1, "#020b16");
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

    const expression = hue % 5;
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
        : birthRotation * (1 - easeOut(turnT)) + Math.sin(turnT * Math.PI) * 0.1;
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
    const eyeY = state.center.y + radius * 0.035;
    [-1, 1].forEach((side) => {
      const x = state.center.x + side * radius * 0.112;
      ctx.beginPath();
      ctx.fillStyle = "rgba(91,36,77,0.64)";
      ctx.ellipse(x, eyeY, radius * 0.018, Math.max(0.7, radius * 0.031 * blink), 0, 0, TAU);
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
    ctx.arc(state.center.x, eyeY + radius * 0.044, radius * 0.052, 0.16, Math.PI - 0.16);
    ctx.stroke();
    [-1, 1].forEach((side) => {
      const blushX = state.center.x + side * radius * 0.22;
      const blushY = eyeY + radius * 0.054;
      const blush = ctx.createRadialGradient(blushX, blushY, 0, blushX, blushY, radius * 0.05);
      blush.addColorStop(0, "rgba(255,119,181,0.3)");
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
  aboutButton.addEventListener("click", () => showAbout(true));
  closeAbout.addEventListener("click", () => showAbout(false));
  veil.addEventListener("click", () => showAbout(false));
  resetButton.addEventListener("click", resetMemories);
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  window.addEventListener("resize", resize);

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "m") {
      state.soundOn = !state.soundOn;
      updateSoundButton();
    }
    if (event.key.toLowerCase() === "c" && !event.repeat) toggleCamera();
    if (event.key.toLowerCase() === "r") resetMemories();
    if (event.code === "Space" && !event.repeat && state.entered) {
      event.preventDefault();
      state.pointer.x = state.center.x;
      state.pointer.y = state.center.y - baseRadius() * 0.7;
      state.pointer.down = true;
      state.pointer.startedAt = performance.now();
      state.touchAngle = -Math.PI / 2;
      hint.textContent = "慢一点，它正在改变";
    }
    if (event.key === "Escape") showAbout(false);
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

  memoryCount.textContent = String(state.count).padStart(2, "0");
  updateSoundButton();
  updateCameraButton();
  resize();
  requestAnimationFrame(render);
})();
