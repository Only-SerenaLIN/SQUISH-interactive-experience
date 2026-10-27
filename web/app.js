(() => {
  "use strict";

  const canvas = document.querySelector("#world");
  const ctx = canvas.getContext("2d");
  const invitation = document.querySelector("#invitation");
  const enterButton = document.querySelector("#enterButton");
  const soundButton = document.querySelector("#soundButton");
  const cameraButton = document.querySelector("#cameraButton");
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
      stream: null,
      video: null,
      frameCanvas: null,
      frameContext: null,
      background: null,
      warmupFrames: 0,
      lastFrameAt: 0,
      x: 0,
      y: 0,
      presence: 0,
      presenceFrames: 0,
      absentFrames: 0,
      cursorAlpha: 0,
      suspendedUntil: 0,
      requestToken: 0,
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
    [126, 229, 220],
    [139, 174, 255],
    [230, 143, 211],
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
    cameraButton.setAttribute("aria-pressed", String(state.camera.enabled));
    cameraButton.setAttribute("aria-label", state.camera.enabled ? "关闭摄像头手势" : "开启摄像头手势");
    cameraButton.querySelector(".camera-copy").textContent = label;
    cameraButton.classList.toggle("is-calibrating", state.camera.starting || (state.camera.enabled && !state.camera.ready));
  }

  function cancelCameraGesture() {
    state.camera.active = false;
    if (state.pointer.id === "camera") {
      state.pointer.down = false;
      state.pointer.id = null;
      state.activeBaby = null;
      canvas.classList.remove("is-touching");
    }
  }

  function stopCamera(message = "摄像头手势已关闭") {
    state.camera.requestToken += 1;
    cancelCameraGesture();
    if (state.camera.stream) {
      state.camera.stream.getTracks().forEach((track) => track.stop());
    }
    if (state.camera.video) state.camera.video.srcObject = null;
    Object.assign(state.camera, {
      enabled: false,
      ready: false,
      starting: false,
      stream: null,
      video: null,
      frameCanvas: null,
      frameContext: null,
      background: null,
      warmupFrames: 0,
      presence: 0,
      presenceFrames: 0,
      absentFrames: 0,
      cursorAlpha: 0,
    });
    updateCameraButton();
    if (message) hint.textContent = message;
  }

  async function startCamera() {
    if (state.camera.starting || state.camera.enabled) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      hint.textContent = "这个浏览器暂时无法使用摄像头手势";
      return;
    }
    if (!state.entered) enter();
    const requestToken = ++state.camera.requestToken;
    state.camera.starting = true;
    updateCameraButton("连接中");
    hint.textContent = "正在请求摄像头权限";
    let requestedStream = null;
    try {
      requestedStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 20, max: 30 },
        },
      });
      if (state.camera.requestToken !== requestToken) {
        requestedStream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = document.createElement("video");
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = requestedStream;
      await video.play();
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = 96;
      frameCanvas.height = 72;
      const frameContext = frameCanvas.getContext("2d", { willReadFrequently: true });
      Object.assign(state.camera, {
        enabled: true,
        ready: false,
        starting: false,
        stream: requestedStream,
        video,
        frameCanvas,
        frameContext,
        background: new Float32Array(96 * 72 * 3),
        warmupFrames: 0,
        lastFrameAt: 0,
        x: state.center.x,
        y: state.center.y,
        presence: 0,
        presenceFrames: 0,
        absentFrames: 0,
        cursorAlpha: 0,
      });
      updateCameraButton("校准中");
      hint.textContent = "请暂时保持画面不动，正在记住背景";
    } catch (error) {
      if (requestedStream) requestedStream.getTracks().forEach((track) => track.stop());
      if (state.camera.requestToken !== requestToken) return;
      state.camera.starting = false;
      updateCameraButton();
      const blocked = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      hint.textContent = blocked ? "没有获得摄像头权限，仍可用鼠标或触屏" : "摄像头暂时不可用，仍可继续触碰";
    }
  }

  function toggleCamera() {
    if (state.camera.enabled || state.camera.starting) stopCamera();
    else startCamera();
  }

  function processCameraGesture(now) {
    const camera = state.camera;
    if (!camera.enabled || !camera.video || camera.video.readyState < 2 || now - camera.lastFrameAt < 78) return;
    camera.lastFrameAt = now;
    const width = camera.frameCanvas.width;
    const height = camera.frameCanvas.height;
    camera.frameContext.drawImage(camera.video, 0, 0, width, height);
    const pixels = camera.frameContext.getImageData(0, 0, width, height).data;

    if (camera.warmupFrames < 28) {
      const blend = camera.warmupFrames === 0 ? 1 : 1 / (camera.warmupFrames + 1);
      for (let pixel = 0, sample = 0; pixel < pixels.length; pixel += 4, sample += 3) {
        camera.background[sample] = mix(camera.background[sample], pixels[pixel], blend);
        camera.background[sample + 1] = mix(camera.background[sample + 1], pixels[pixel + 1], blend);
        camera.background[sample + 2] = mix(camera.background[sample + 2], pixels[pixel + 2], blend);
      }
      camera.warmupFrames += 1;
      if (camera.warmupFrames === 28) {
        camera.ready = true;
        updateCameraButton("手势已开");
        hint.textContent = "把一只手慢慢伸进镜头，移动它触碰水母";
      }
      return;
    }

    let foreground = 0;
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    for (let y = 0, pixel = 0, sample = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1, pixel += 4, sample += 3) {
        const difference = (
          Math.abs(pixels[pixel] - camera.background[sample]) +
          Math.abs(pixels[pixel + 1] - camera.background[sample + 1]) +
          Math.abs(pixels[pixel + 2] - camera.background[sample + 2])
        ) / 3;
        const backgroundBlend = difference < 34 ? 0.025 : 0.0007;
        camera.background[sample] = mix(camera.background[sample], pixels[pixel], backgroundBlend);
        camera.background[sample + 1] = mix(camera.background[sample + 1], pixels[pixel + 1], backgroundBlend);
        camera.background[sample + 2] = mix(camera.background[sample + 2], pixels[pixel + 2], backgroundBlend);
        if (difference > 42) {
          const weight = Math.min(100, difference - 34);
          foreground += 1;
          totalWeight += weight;
          weightedX += x * weight;
          weightedY += y * weight;
        }
      }
    }

    const area = foreground / (width * height);
    const present = totalWeight > 0 && area > 0.022 && area < 0.62;
    if (present) {
      const targetX = (1 - weightedX / totalWeight / width) * state.width;
      const targetY = (weightedY / totalWeight / height) * state.height;
      camera.x = mix(camera.x || targetX, targetX, 0.32);
      camera.y = mix(camera.y || targetY, targetY, 0.32);
      camera.presence = mix(camera.presence, clamp((area - 0.022) / 0.18, 0, 1), 0.28);
      camera.presenceFrames += 1;
      camera.absentFrames = 0;
    } else {
      camera.presence *= 0.82;
      camera.presenceFrames = 0;
      camera.absentFrames += 1;
    }
    camera.cursorAlpha = mix(camera.cursorAlpha, present ? 1 : 0, present ? 0.3 : 0.16);

    const canControl = now >= camera.suspendedUntil && (!state.pointer.down || state.pointer.id === "camera");
    if (present && canControl) {
      if (!camera.active) {
        const distance = Math.hypot(camera.x - state.center.x, camera.y - state.center.y);
        if (camera.presenceFrames >= 3 && distance <= baseRadius() * 1.16) {
          camera.active = true;
          state.pointer = { x: camera.x, y: camera.y, down: true, id: "camera", startedAt: now };
          state.touchAngle = Math.atan2(camera.y - state.center.y, camera.x - state.center.x);
          canvas.classList.add("is-touching");
          hint.textContent = "手势正在触碰它，移开手就会松开";
        }
      } else {
        state.pointer.x = camera.x;
        state.pointer.y = camera.y;
        state.touchAngle = Math.atan2(camera.y - state.center.y, camera.x - state.center.x);
      }
    } else if (camera.active && camera.absentFrames >= 5) {
      camera.active = false;
      releasePointer();
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

  function pointerDown(event) {
    if (!state.entered || aboutPanel.classList.contains("is-open")) return;
    if (state.camera.active) cancelCameraGesture();
    state.camera.suspendedUntil = performance.now() + 1400;
    const point = pointerPosition(event);
    for (let i = state.babies.length - 1; i >= 0; i -= 1) {
      const baby = state.babies[i];
      if (baby.age < baby.birthDuration) continue;
      if (Math.hypot(point.x - baby.x, point.y - baby.y) <= Math.max(30, baby.size * 2.35)) {
        state.activeBaby = baby;
        baby.touchAngle = Math.atan2(point.y - baby.y, point.x - baby.x);
        state.pointer = { x: point.x, y: point.y, down: true, id: event.pointerId, startedAt: performance.now() };
        canvas.setPointerCapture(event.pointerId);
        canvas.classList.add("is-touching");
        hint.textContent = "它软软地凹下去了";
        initAudio();
        return;
      }
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
      const babyTarget = state.pointer.down && state.activeBaby === baby ? clamp(0.48 + holdTime * 0.34, 0, 0.88) : 0;
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
    const pulse = 1 + Math.sin(phase * 2) * (reduceMotion ? 0.025 : 0.072);
    ctx.scale(pulse, 1 / Math.sqrt(pulse));
    ctx.rotate(touchAngle);
    ctx.scale(1 - squash * 0.26, 1 + squash * 0.18);
    ctx.rotate(-touchAngle);
    ctx.shadowBlur = size * (1.15 + squash * 1.6 + releaseGlow * 2.2);
    ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(0.9, (0.42 + squash * 0.28 + releaseGlow * 0.3) * alpha)})`;
    const bell = ctx.createRadialGradient(-size * 0.22, -size * 0.34, 0, 0, 0, size * 1.05);
    bell.addColorStop(0, `rgba(236,255,255,${0.78 * alpha})`);
    bell.addColorStop(0.5, `rgba(${c[0]},${c[1]},${c[2]},${0.48 * alpha})`);
    bell.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${0.08 * alpha})`);
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.bezierCurveTo(-size * 0.92, -size * 1.1, size * 0.92, -size * 1.1, size, 0);
    ctx.quadraticCurveTo(size * 0.48, size * 0.18, 0, size * 0.04);
    ctx.quadraticCurveTo(-size * 0.48, size * 0.18, -size, 0);
    ctx.closePath();
    ctx.fillStyle = bell;
    ctx.fill();
    ctx.strokeStyle = `rgba(205,252,250,${0.48 * alpha})`;
    ctx.lineWidth = Math.max(0.7, size * 0.045);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(9,45,59,${0.66 * alpha})`;
    ctx.beginPath();
    ctx.arc(-size * 0.24, -size * 0.22, Math.max(0.8, size * 0.055), 0, TAU);
    ctx.arc(size * 0.24, -size * 0.22, Math.max(0.8, size * 0.055), 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = `rgba(25,76,86,${0.5 * alpha})`;
    ctx.lineWidth = Math.max(0.55, size * 0.035);
    ctx.arc(0, -size * 0.08, size * 0.13, 0.14, Math.PI - 0.14);
    ctx.stroke();
    if (tentacleGrowth > 0.005) {
      const grown = easeOut(clamp(tentacleGrowth, 0, 1));
      ctx.shadowBlur = size * 0.45;
      for (let i = -1; i <= 1; i += 1) {
        const rootX = i * size * 0.38;
        const sway = Math.sin(phase + i * 1.2) * size * (reduceMotion ? 0.16 : 0.29) * grown;
        ctx.beginPath();
        ctx.moveTo(rootX, size * 0.06);
        ctx.bezierCurveTo(
          mix(rootX, i * size * 0.32 + sway, grown),
          size * (0.06 + 0.52 * grown),
          mix(rootX, i * size * 0.18 - sway, grown),
          size * (0.06 + 0.84 * grown),
          mix(rootX, i * size * 0.28 + sway, grown),
          size * (0.06 + 1.32 * grown),
        );
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.42 - Math.abs(i) * 0.07) * alpha * grown})`;
        ctx.lineWidth = Math.max(0.65, size * 0.035);
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
    const radius = 18 + camera.presence * 22 + (camera.active ? Math.sin(state.elapsed * 4.2) * 2 : 0);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const glow = ctx.createRadialGradient(camera.x, camera.y, 0, camera.x, camera.y, radius * 2.2);
    glow.addColorStop(0, `rgba(225,255,250,${0.28 * alpha})`);
    glow.addColorStop(0.32, `rgba(126,229,220,${0.17 * alpha})`);
    glow.addColorStop(1, "rgba(126,229,220,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, radius * 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(225,255,250,${0.52 * alpha})`;
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 2.1 + camera.presence * 1.6, 0, TAU);
    ctx.fill();
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
    halo.addColorStop(0, "rgba(129,229,223,0.13)");
    halo.addColorStop(0.52, "rgba(104,162,207,0.07)");
    halo.addColorStop(1, "rgba(45,99,126,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(state.center.x - radius * 1.8, state.center.y - radius * 1.8, radius * 3.6, radius * 3.6);
    ctx.restore();

    ctx.save();
    ctx.lineCap = "round";
    for (let i = -3; i <= 3; i += 1) {
      const rootX = state.center.x + i * radius * 0.18;
      const rootY = state.center.y + radius * (0.58 + Math.abs(i) * 0.018);
      const sway = Math.sin(state.elapsed * 0.62 + i * 0.78) * radius * (0.12 + Math.abs(i) * 0.012);
      const length = radius * (0.72 + (3 - Math.abs(i)) * 0.095);
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.bezierCurveTo(
        rootX + sway,
        rootY + length * 0.3,
        rootX - sway * 0.72,
        rootY + length * 0.68,
        rootX + sway * 0.45,
        rootY + length,
      );
      const c = palette[(i + 6) % palette.length];
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.22 + (3 - Math.abs(i)) * 0.035})`;
      ctx.lineWidth = radius * (0.014 + (3 - Math.abs(i)) * 0.0025);
      ctx.shadowBlur = 10;
      ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},0.28)`;
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.filter = `blur(${Math.round(radius * 0.055)}px)`;
    traceBlob(radius + 4);
    ctx.fillStyle = "rgba(112,220,218,0.16)";
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
    body.addColorStop(0, "rgba(232,255,253,0.9)");
    body.addColorStop(0.32, "rgba(151,226,224,0.68)");
    body.addColorStop(0.7, "rgba(91,148,190,0.48)");
    body.addColorStop(1, "rgba(91,73,158,0.36)");
    ctx.fillStyle = body;
    ctx.fill();

    ctx.save();
    traceBlob(radius - 4);
    ctx.clip();

    const wash = ctx.createLinearGradient(state.center.x - radius, state.center.y - radius, state.center.x + radius, state.center.y + radius);
    wash.addColorStop(0, "rgba(163,247,237,0.24)");
    wash.addColorStop(0.45, "rgba(255,255,255,0.04)");
    wash.addColorStop(0.73, "rgba(119,182,231,0.22)");
    wash.addColorStop(1, "rgba(188,116,211,0.22)");
    traceBlob(radius - 4);
    ctx.fillStyle = wash;
    ctx.fill();

    for (let i = 0; i < 5; i += 1) {
      const phase = state.elapsed * (0.09 + i * 0.007) + i * 1.47;
      const sweep = radius * (0.3 + i * 0.075);
      const x = state.center.x + Math.cos(phase) * radius * 0.09;
      const y = state.center.y + Math.sin(phase * 0.7) * radius * 0.11;
      const c = palette[i % palette.length];
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.12 + i * 0.012})`;
      ctx.lineWidth = radius * (0.025 + i * 0.002);
      ctx.lineCap = "round";
      ctx.arc(x, y, sweep, phase + 0.2, phase + 1.42);
      ctx.stroke();
    }

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let rib = -3; rib <= 3; rib += 1) {
      ctx.beginPath();
      ctx.moveTo(state.center.x + rib * radius * 0.045, state.center.y - radius * 0.7);
      ctx.quadraticCurveTo(
        state.center.x + rib * radius * 0.14,
        state.center.y - radius * 0.05,
        state.center.x + rib * radius * 0.2,
        state.center.y + radius * 0.55,
      );
      ctx.strokeStyle = `rgba(176,241,236,${0.1 + (3 - Math.abs(rib)) * 0.018})`;
      ctx.lineWidth = 0.8;
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
    for (let i = -3; i < 4; i += 1) {
      const x1 = state.center.x + (i + 0.5) * radius * 0.19;
      const x2 = state.center.x + (i + 1) * radius * 0.19;
      ctx.quadraticCurveTo(x1, skirtY + (i % 2 === 0 ? radius * 0.045 : -radius * 0.02), x2, skirtY);
    }
    ctx.strokeStyle = "rgba(169,244,237,0.34)";
    ctx.lineWidth = 1.15;
    ctx.shadowBlur = 7;
    ctx.shadowColor = "rgba(112,231,222,0.36)";
    ctx.stroke();
    ctx.shadowBlur = 0;

    const blinkCycle = state.elapsed % 8.2;
    const blink = blinkCycle > 7.72 ? Math.abs(blinkCycle - 7.96) / 0.24 : 1;
    const eyeY = state.center.y + radius * 0.02;
    [-1, 1].forEach((side) => {
      const x = state.center.x + side * radius * 0.112;
      ctx.beginPath();
      ctx.fillStyle = "rgba(8,48,62,0.62)";
      ctx.ellipse(x, eyeY, radius * 0.018, Math.max(0.7, radius * 0.031 * blink), 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.arc(x - radius * 0.005, eyeY - radius * 0.009, radius * 0.0045, 0, TAU);
      ctx.fill();
    });
    ctx.beginPath();
    ctx.strokeStyle = "rgba(18,70,80,0.5)";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.arc(state.center.x, eyeY + radius * 0.045, radius * 0.055, 0.16, Math.PI - 0.16);
    ctx.stroke();
    [-1, 1].forEach((side) => {
      const blush = ctx.createRadialGradient(
        state.center.x + side * radius * 0.22,
        eyeY + radius * 0.055,
        0,
        state.center.x + side * radius * 0.22,
        eyeY + radius * 0.055,
        radius * 0.055,
      );
      blush.addColorStop(0, "rgba(239,143,206,0.3)");
      blush.addColorStop(1, "rgba(239,143,206,0)");
      ctx.fillStyle = blush;
      ctx.beginPath();
      ctx.arc(state.center.x + side * radius * 0.22, eyeY + radius * 0.055, radius * 0.055, 0, TAU);
      ctx.fill();
    });
    ctx.restore();

    ctx.save();
    traceBlob(radius);
    ctx.strokeStyle = "rgba(141,230,224,0.38)";
    ctx.lineWidth = 2.2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(113,232,223,0.44)";
    ctx.stroke();
    ctx.restore();

    ctx.save();
    traceBlob(radius - 8);
    ctx.clip();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.62)";
    ctx.lineWidth = radius * 0.035;
    ctx.lineCap = "round";
    ctx.arc(state.center.x - radius * 0.25, state.center.y - radius * 0.28, radius * 0.48, 3.62, 4.88);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
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
