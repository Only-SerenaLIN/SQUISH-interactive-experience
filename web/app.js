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
  const aboutPanel = document.querySelector("#aboutPanel");
  const closeAbout = document.querySelector("#closeAbout");
  const resetButton = document.querySelector("#resetButton");
  const veil = document.querySelector("#veil");
  const hint = document.querySelector("#hint");
  const memoryCount = document.querySelector("#memoryCount");
  const glowCount = document.querySelector("#glowCount");
  const glowRateLabel = document.querySelector("#glowRate");
  const jellyCount = document.querySelector("#jellyCount");
  const jellyCapacity = document.querySelector("#jellyCapacity");
  const habitatButtons = Array.from(document.querySelectorAll(".habitat-card"));
  const surfaceButton = document.querySelector("#surfaceButton");
  const reefButton = document.querySelector("#reefButton");
  const tutorialPanel = document.querySelector("#tutorialPanel");
  const tutorialButton = document.querySelector("#tutorialButton");
  const tutorialClose = document.querySelector("#tutorialClose");
  const savePanel = document.querySelector("#savePanel");
  const saveButton = document.querySelector("#saveButton");
  const saveClose = document.querySelector("#saveClose");
  const saveNow = document.querySelector("#saveNow");
  const exportSave = document.querySelector("#exportSave");
  const importSave = document.querySelector("#importSave");
  const saveStatus = document.querySelector("#saveStatus");

  const TAU = Math.PI * 2;
  const NODES = 72;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const shortestAngle = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function readTankState() {
    try {
      const saved = JSON.parse(localStorage.getItem("softness-jelly-tank") || "{}");
      return {
        glow: Math.max(0, Number(saved.glow) || 0),
        population: clamp(Number.parseInt(saved.population || "0", 10), 0, 18),
        levels: {
          algae: clamp(Number.parseInt(saved.levels?.algae || "0", 10), 0, 5),
          nursery: clamp(Number.parseInt(saved.levels?.nursery || "0", 10), 0, 4),
          lantern: clamp(Number.parseInt(saved.levels?.lantern || "0", 10), 0, 3),
        },
        lastSavedAt: Number(saved.lastSavedAt) || Date.now(),
        babies: Array.isArray(saved.babies) ? saved.babies.slice(0, 18) : [],
      };
    } catch (error) {
      return {
        glow: 0,
        population: 0,
        levels: { algae: 0, nursery: 0, lantern: 0 },
        lastSavedAt: Date.now(),
        babies: [],
      };
    }
  }

  const storedTank = readTankState();

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
    glowMotes: [],
    map: {
      scrollY: 0,
      targetY: 0,
      zoom: 1,
      targetZoom: 1,
      gesture: null,
      pointers: new Map(),
      worldHeight: 0,
    },
    tank: {
      glow: storedTank.glow,
      population: storedTank.population,
      levels: storedTank.levels,
      lastSavedAt: storedTank.lastSavedAt,
      restored: false,
      saveElapsed: 0,
      hudElapsed: 0,
      awayGlow: 0,
      savedBabies: storedTank.babies,
      guests: { algae: null, nursery: null, lantern: null },
      guestTimers: { algae: 0, nursery: 0, lantern: 0 },
      queueCursor: { algae: 0, nursery: 0, lantern: 0 },
    },
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
      gestureOriginX: 0,
      gestureOriginY: 0,
      pointerOriginX: 0,
      pointerOriginY: 0,
      indexPrevX: null,
      indexPrevY: null,
      touchBaby: null,
      mapGesture: null,
      babyGesture: false,
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
  const reefImage = new Image();
  reefImage.src = "assets/connected-reef.png";

  const habitatConfig = {
    algae: { label: "月光藻床", baseCost: 12, max: 5 },
    nursery: { label: "珊瑚育婴湾", baseCost: 35, max: 4 },
    lantern: { label: "深海灯塔", baseCost: 90, max: 3 },
  };

  const personalityNames = ["活泼", "害羞", "好奇", "爱睡觉"];

  function unlockedHues() {
    const hues = [0];
    if (state.tank.levels.algae > 0) hues.push(3);
    if (state.tank.levels.nursery > 0) hues.push(2);
    if (state.tank.levels.lantern > 0) hues.push(1);
    if (state.tank.levels.lantern > 1) hues.push(4);
    return hues;
  }

  function habitatPosition(key) {
    const x = { algae: 0.2, nursery: 0.5, lantern: 0.8 }[key] || 0.5;
    return { x: state.width * x, y: state.map.worldHeight - state.height * 0.46 };
  }

  function worldPoint(screenX, screenY) {
    const zoom = state.map.zoom;
    return {
      x: (screenX - state.width * 0.5) / zoom + state.width * 0.5,
      y: (screenY - state.height * 0.5) / zoom + state.height * 0.5 + state.map.scrollY,
    };
  }

  function screenPoint(worldX, worldY) {
    const zoom = state.map.zoom;
    return {
      x: (worldX - state.width * 0.5) * zoom + state.width * 0.5,
      y: (worldY - state.map.scrollY - state.height * 0.5) * zoom + state.height * 0.5,
    };
  }

  function setMapView(target) {
    state.map.targetY = clamp(target, 0, state.map.worldHeight - state.height / state.map.targetZoom);
    surfaceButton.classList.toggle("is-current", state.map.targetY < state.height * 0.4);
    reefButton.classList.toggle("is-current", state.map.targetY >= state.height * 0.4);
  }

  function serializeBaby(baby) {
    return {
      x: clamp(baby.x / state.width, -0.1, 1.1),
      y: clamp(baby.y / state.map.worldHeight, 0, 1),
      size: clamp(baby.size, 12, 38),
      hue: clamp(baby.hue, 0, 4),
      personality: clamp(baby.personality || 0, 0, 3),
      home: baby.home || baby.queuedFor || null,
    };
  }

  function tankSnapshot() {
    return {
      version: 2,
      glow: state.tank.glow,
      population: state.tank.population,
      levels: { ...state.tank.levels },
      babies: state.babies.filter((baby) => baby.detached).map(serializeBaby),
      lastSavedAt: Date.now(),
      memoryCount: state.count,
    };
  }

  function tankCapacity() {
    return Math.min(18, 6 + state.tank.levels.nursery * 3);
  }

  function tankGlowRate() {
    const base = state.tank.population * 0.28;
    const active = Object.keys(habitatConfig).filter((key) => state.tank.levels[key] > 0).slice(0, state.tank.population);
    const play = active.reduce((total, key) => total + 0.55 + state.tank.levels[key] * 0.38, 0);
    return (base + play) * (1 + state.tank.levels.lantern * 0.12);
  }

  function habitatCost(key) {
    const config = habitatConfig[key];
    return Math.round(config.baseCost * Math.pow(1.85, state.tank.levels[key]));
  }

  function formatGlow(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    if (value >= 100) return String(Math.floor(value));
    return value.toFixed(value < 10 ? 1 : 0);
  }

  function saveTank() {
    try {
      localStorage.setItem("softness-jelly-tank", JSON.stringify(tankSnapshot()));
      saveStatus.textContent = `已保存 · ${new Date().toLocaleString("zh-CN", { hour12: false })}`;
    } catch (error) {
      // The artwork remains playable when storage is unavailable.
    }
  }

  function updateTankUI() {
    const capacity = tankCapacity();
    state.tank.population = clamp(state.tank.population, 0, capacity);
    glowCount.textContent = formatGlow(state.tank.glow);
    glowRateLabel.textContent = `+${tankGlowRate().toFixed(1)} / 秒`;
    jellyCount.textContent = String(state.tank.population);
    jellyCapacity.textContent = String(capacity);
    habitatButtons.forEach((button) => {
      const key = button.dataset.habitat;
      const config = habitatConfig[key];
      const level = state.tank.levels[key];
      const maxed = level >= config.max;
      const cost = habitatCost(key);
      button.querySelector("[data-level]").textContent = `LV.${level}`;
      button.querySelector("[data-cost]").textContent = maxed ? "已完成" : `${cost} 微光`;
      button.classList.toggle("is-affordable", !maxed && state.tank.glow >= cost);
      button.classList.toggle("is-maxed", maxed);
      button.disabled = maxed;
      button.setAttribute("aria-label", maxed
        ? `${config.label}，已达到最高等级`
        : `${config.label}，等级 ${level}，升级需要 ${cost} 微光`);
    });
  }

  function addTankGlow(amount) {
    state.tank.glow += Math.max(0, amount);
    updateTankUI();
  }

  function restoreTankBabies() {
    if (state.tank.restored || !state.width || !state.height) return;
    state.tank.restored = true;
    const restoredPopulation = Math.min(state.tank.population, tankCapacity());
    state.tank.population = restoredPopulation;
    for (let i = 0; i < restoredPopulation; i += 1) {
      const saved = state.tank.savedBabies[i];
      state.babies.push({
        x: state.width * (saved && Number.isFinite(saved.x) ? clamp(saved.x, 0.05, 0.95) : 0.12 + ((i * 0.618033) % 0.76)),
        y: state.map.worldHeight * (saved && Number.isFinite(saved.y) ? clamp(saved.y, 0.05, 0.95) : 0.25 + ((i * 0.173) % 0.55)),
        vx: Math.sin(i * 1.91) * 2.4,
        vy: -1.5 - (i % 3) * 0.5,
        size: saved && Number.isFinite(saved.size) ? clamp(saved.size, 12, 38) : 14 + (i % 5) * 2.3,
        strength: 0.35 + (i % 4) * 0.12,
        hue: saved && Number.isFinite(saved.hue) ? clamp(saved.hue, 0, 4) : unlockedHues()[i % unlockedHues().length],
        personality: saved && Number.isFinite(saved.personality) ? clamp(saved.personality, 0, 3) : i % 4,
        expression: i % 5,
        moodTimer: 3 + (i % 4) * 1.9,
        playTimer: 1 + (i % 3),
        home: null,
        queuedFor: saved && habitatConfig[saved.home] ? saved.home : null,
        wanderX: state.width * (i % 2 ? 0.12 + (i % 4) * 0.045 : 0.72 + (i % 4) * 0.045),
        wanderY: state.height * (0.55 + ((i * 0.31) % 1.18)),
        wanderTimer: 3 + (i % 5),
        phase: i * 1.17,
        age: 8 + i * 0.4,
        birthAngle: -Math.PI / 2,
        birthDuration: 1,
        birthTravel: 0,
        detached: true,
        birthSquash: 0,
        squash: 0,
        squashVelocity: 0,
        touchAngle: 0,
        releaseGlow: 0,
        cameraTouch: 0,
      });
    }
    Object.keys(habitatConfig).forEach((key, index) => {
      if (!state.tank.levels[key] || !state.babies[index]) return;
      const guest = state.babies[index];
      const home = habitatPosition(key);
      guest.home = key;
      guest.queuedFor = null;
      guest.x = home.x + (index - 1) * 18;
      guest.y = home.y - 52;
      state.tank.guests[key] = guest;
      state.tank.guestTimers[key] = 5 + index * 1.5;
    });
    updateTankUI();
  }

  function upgradeHabitat(key) {
    const config = habitatConfig[key];
    if (!config) return;
    const level = state.tank.levels[key];
    if (level >= config.max) return;
    const cost = habitatCost(key);
    if (state.tank.glow < cost) {
      hint.textContent = `还差 ${formatGlow(cost - state.tank.glow)} 微光，先陪水母玩一会儿`;
      return;
    }
    state.tank.glow -= cost;
    state.tank.levels[key] += 1;
    state.tank.guestTimers[key] = 0;
    const messages = {
      algae: "月光藻舒展开了，微光流动得更快",
      nursery: "育婴湾变宽了，可以住进更多小水母",
      lantern: "深海灯塔亮了一层，整只缸都被照亮",
    };
    hint.textContent = messages[key];
    state.ripples.push({
      x: state.width * (key === "algae" ? 0.18 : key === "nursery" ? 0.79 : 0.52),
      y: state.height * 0.86,
      age: 0,
      strength: 0.36,
      hue: key === "algae" ? 3 : key === "nursery" ? 2 : 4,
      duration: 2.2,
    });
    saveTank();
    updateTankUI();
  }

  function showTutorial(open) {
    tutorialPanel.classList.toggle("is-open", open);
    tutorialPanel.setAttribute("aria-hidden", String(!open));
    if (open) tutorialClose.focus();
    else {
      localStorage.setItem("softness-jelly-tutorial-v2", "seen");
      canvas.focus({ preventScroll: true });
    }
  }

  function showSavePanel(open) {
    savePanel.classList.toggle("is-open", open);
    savePanel.setAttribute("aria-hidden", String(!open));
    if (open) {
      saveStatus.textContent = `自动保存已开启 · ${state.tank.population} 只小水母 · ${formatGlow(state.tank.glow)} 微光`;
      saveClose.focus();
    } else canvas.focus({ preventScroll: true });
  }

  function loadSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== 2 || !snapshot.levels || !Array.isArray(snapshot.babies)) {
      throw new Error("这不是水母缸存档文件");
    }
    state.tank.levels = {
      algae: clamp(Number(snapshot.levels.algae) || 0, 0, 5),
      nursery: clamp(Number(snapshot.levels.nursery) || 0, 0, 4),
      lantern: clamp(Number(snapshot.levels.lantern) || 0, 0, 3),
    };
    state.tank.glow = clamp(Number(snapshot.glow) || 0, 0, 1e9);
    state.tank.population = clamp(Number(snapshot.population) || snapshot.babies.length, 0, tankCapacity());
    state.tank.savedBabies = snapshot.babies.slice(0, 18);
    state.tank.guests = { algae: null, nursery: null, lantern: null };
    state.tank.guestTimers = { algae: 0, nursery: 0, lantern: 0 };
    state.tank.restored = false;
    state.babies.length = 0;
    state.glowMotes.length = 0;
    state.count = clamp(Number(snapshot.memoryCount) || 0, 0, 999999);
    memoryCount.textContent = String(state.count).padStart(2, "0");
    localStorage.setItem("softness-memory-count", String(state.count));
    restoreTankBabies();
    saveTank();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const oldWidth = state.width;
    const oldWorldHeight = state.map.worldHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * state.dpr);
    canvas.height = Math.round(rect.height * state.dpr);
    state.width = rect.width;
    state.height = rect.height;
    state.map.worldHeight = Math.max(rect.height * 2.05, 1100);
    if (oldWidth && oldWorldHeight) {
      state.babies.forEach((baby) => {
        baby.x *= rect.width / oldWidth;
        baby.y *= state.map.worldHeight / oldWorldHeight;
      });
    }
    setMapView(state.map.targetY);
    if (!state.center.x) {
      state.center.x = rect.width * 0.5;
      state.center.y = rect.height * 0.51;
      state.pointer.x = state.center.x;
      state.pointer.y = state.center.y;
    }
    restoreTankBabies();
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
      indexPrevX: null,
      indexPrevY: null,
      touchBaby: null,
      mapGesture: null,
      babyGesture: false,
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
    updateCameraButton("加载 Handsfree");
    hint.textContent = "正在准备双指捏合模型，首次打开会稍慢";
    try {
      const handsfree = new window.Handsfree({
        showDebug: false,
        assetsPath: "https://unpkg.com/handsfree@8.5.1/build/lib/assets",
        hands: {
          enabled: true,
          maxNumHands: 2,
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

  function processCameraGesture(now) {
    const camera = state.camera;
    if (!camera.enabled || !camera.handsfree || now - camera.lastFrameAt < 46) return;
    camera.lastFrameAt = now;
    const hands = camera.hands || camera.handsfree.data?.hands;
    const visibleHands = hands?.multiHandLandmarks?.filter((hand) => hand?.length >= 21) || [];
    if (visibleHands.length >= 2) {
      const palms = visibleHands.slice(0, 2).map((hand) => ({
        x: (1 - (hand[0].x + hand[5].x + hand[17].x) / 3) * state.width,
        y: ((hand[0].y + hand[5].y + hand[17].y) / 3) * state.height,
      }));
      const midpointY = (palms[0].y + palms[1].y) * 0.5;
      const distance = Math.max(45, Math.hypot(palms[0].x - palms[1].x, palms[0].y - palms[1].y));
      if (!camera.mapGesture) {
        camera.mapGesture = { midpointY, distance, scrollY: state.map.scrollY, zoom: state.map.zoom };
        camera.active = false;
        state.pointer.down = false;
        state.activeBaby = null;
        canvas.classList.remove("is-touching");
        hint.textContent = "双手上下移动探索海底，张开或靠近来缩放地图";
      } else {
        state.map.zoom = clamp(camera.mapGesture.zoom * distance / camera.mapGesture.distance, 0.72, 1.65);
        state.map.targetZoom = state.map.zoom;
        state.map.scrollY = clamp(
          camera.mapGesture.scrollY + (camera.mapGesture.midpointY - midpointY) / state.map.zoom,
          0,
          state.map.worldHeight - state.height / state.map.zoom,
        );
        setMapView(state.map.scrollY);
      }
      camera.cursorAlpha = mix(camera.cursorAlpha, 0, 0.2);
      camera.rearm = true;
      return;
    }
    camera.mapGesture = null;
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
      const thumbPoint = worldPoint((1 - thumb.x) * state.width, thumb.y * state.height);
      const indexPoint = worldPoint((1 - index.x) * state.width, index.y * state.height);
      const targetAX = thumbPoint.x;
      const targetAY = thumbPoint.y;
      const targetBX = indexPoint.x;
      const targetBY = indexPoint.y;
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
        const reaction = touchedBaby.personality === 1 ? 2.8 : touchedBaby.personality === 0 ? -0.35 : 1;
        touchedBaby.vx += deltaX * 0.24 + (distanceX / distance) * (entering ? 3.6 : 0.34) * reaction;
        touchedBaby.vy += deltaY * 0.24 + (distanceY / distance) * (entering ? 3.6 : 0.34) * reaction;
        if (touchedBaby.personality === 0) {
          touchedBaby.teaseX = fingerX;
          touchedBaby.teaseY = fingerY;
          touchedBaby.teaseUntil = state.elapsed + 2.2;
          touchedBaby.teaseAngle = Math.atan2(touchedBaby.y - fingerY, touchedBaby.x - fingerX);
        } else if (touchedBaby.personality === 1) {
          touchedBaby.fleeX = fingerX;
          touchedBaby.fleeY = fingerY;
          touchedBaby.fleeUntil = state.elapsed + 2;
        }
        touchedBaby.expression = touchedBaby.personality === 1 ? 3 : touchedBaby.personality === 0 ? 1 : 0;
        touchedBaby.moodTimer = 1.8;
        touchedBaby.releaseGlow = Math.max(touchedBaby.releaseGlow, entering ? 0.72 : 0.28);
        if (entering) {
          addTankGlow(0.8 + touchedBaby.size * 0.03);
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
        const pinchedBaby = camera.pinchFrames === 3 ? findTouchableBaby(camera.x, camera.y, 1.25) : null;
        if (camera.rearm && camera.pinchFrames === 3 && (distance <= baseRadius() * 1.34 || pinchedBaby)) {
          camera.active = true;
          camera.rearm = false;
          camera.babyGesture = Boolean(pinchedBaby);
          camera.gestureOriginX = camera.x;
          camera.gestureOriginY = camera.y;
          camera.pointerOriginX = camera.x;
          camera.pointerOriginY = camera.y;
          state.pointer = { x: camera.x, y: camera.y, down: true, id: "camera", startedAt: now };
          state.activeBaby = pinchedBaby;
          if (pinchedBaby) {
            pinchedBaby.expression = 3;
            pinchedBaby.moodTimer = 1.5;
          }
          state.touchAngle = Math.atan2(camera.y - state.center.y, camera.x - state.center.x);
          canvas.classList.add("is-touching");
          hint.textContent = pinchedBaby ? "轻轻夹住小水母，可以挤压或带它去栖息地" : "夹住母体了——保持双指合拢，向外拉";
        } else if (camera.openFrames >= 2) {
          hint.textContent = cameraTouchBaby
            ? "指尖碰到了它——它软软地让开了"
            : playingTentacles
              ? "食指拨过触须——它们顺着水流摆开了"
              : "食指逗小水母或拨触须；双指移到母体再捏合";
        } else if (pinching && distance > baseRadius() * 1.34) {
          hint.textContent = "靠近母体或小水母，再合拢拇指和食指";
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
          state.map.worldHeight + baseRadius() * 0.4,
        );
        if (camera.babyGesture && state.activeBaby) {
          state.activeBaby.x = mix(state.activeBaby.x, state.pointer.x, 0.55);
          state.activeBaby.y = mix(state.activeBaby.y, state.pointer.y, 0.55);
          state.activeBaby.cameraTouch = 1.4;
        }
        state.touchAngle = Math.atan2(state.pointer.y - state.center.y, state.pointer.x - state.center.x);
        if (!pinching && camera.openFrames >= 3) {
          camera.active = false;
          camera.suspendedUntil = now + 260;
          releasePointer();
          hint.textContent = camera.babyGesture ? "小水母软软地弹开了" : "张开手指——啵，它松开了";
          camera.babyGesture = false;
        } else {
          hint.textContent = camera.babyGesture ? "继续带它游动，张开手指放下" : "保持夹住向外拉；张开双指就松手";
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
    if (state.tank.awayGlow >= 1) {
      hint.textContent = `水母缸在你离开时积攒了 ${formatGlow(state.tank.awayGlow)} 微光`;
      state.tank.awayGlow = 0;
    }
    if (!localStorage.getItem("softness-jelly-tutorial-v2")) showTutorial(true);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return worldPoint(event.clientX - rect.left, event.clientY - rect.top);
  }

  function pointerScreenPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function mapTouchGesture() {
    const points = [...state.map.pointers.values()];
    if (points.length < 2) return;
    const midpoint = { x: (points[0].x + points[1].x) * 0.5, y: (points[0].y + points[1].y) * 0.5 };
    const distance = Math.max(20, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
    const baby = distance < 115 ? findTouchableBaby(worldPoint(midpoint.x, midpoint.y).x, worldPoint(midpoint.x, midpoint.y).y, 1.2) : null;
    state.pointer.down = false;
    state.activeBaby = null;
    canvas.classList.remove("is-touching");
    state.map.gesture = {
      type: baby ? "baby" : "map",
      baby,
      startY: midpoint.y,
      startDistance: distance,
      startScroll: state.map.scrollY,
      startZoom: state.map.zoom,
    };
    if (baby) hint.textContent = "两指夹住小水母，拖到栖息地放开";
    else hint.textContent = "双指滑动看海底，张合双指缩放";
  }

  function moveTouchGesture() {
    const points = [...state.map.pointers.values()];
    const gesture = state.map.gesture;
    if (!gesture || points.length < 2) return;
    const midpoint = { x: (points[0].x + points[1].x) * 0.5, y: (points[0].y + points[1].y) * 0.5 };
    if (gesture.type === "baby") {
      const point = worldPoint(midpoint.x, midpoint.y);
      gesture.baby.x = point.x;
      gesture.baby.y = point.y;
      gesture.baby.squash = 0.42;
      gesture.baby.expression = 3;
      return;
    }
    const distance = Math.max(20, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
    state.map.zoom = clamp(gesture.startZoom * distance / gesture.startDistance, 0.72, 1.65);
    state.map.targetZoom = state.map.zoom;
    state.map.scrollY = clamp(gesture.startScroll + (gesture.startY - midpoint.y) / state.map.zoom, 0, state.map.worldHeight - state.height / state.map.zoom);
    setMapView(state.map.scrollY);
  }

  function placeBabyAtHabitat(baby) {
    if (!baby) return;
    const closest = Object.keys(habitatConfig)
      .filter((key) => state.tank.levels[key] > 0)
      .map((key) => ({ key, distance: Math.hypot(baby.x - habitatPosition(key).x, baby.y - habitatPosition(key).y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (closest && closest.distance < 175) {
      Object.keys(state.tank.guests).forEach((key) => {
        if (state.tank.guests[key] === baby) state.tank.guests[key] = null;
      });
      baby.queuedFor = closest.key;
      baby.home = null;
      if (!state.tank.guests[closest.key]) {
        state.tank.guests[closest.key] = baby;
        state.tank.guestTimers[closest.key] = 8;
        baby.home = closest.key;
        baby.queuedFor = null;
      }
      baby.playTimer = 0.3;
      baby.expression = 1;
      hint.textContent = baby.home
        ? `${personalityNames[baby.personality]}水母来到${habitatConfig[closest.key].label}玩耍`
        : `${habitatConfig[closest.key].label}里有朋友，它稍后再来玩`;
      addTankGlow(1.4);
      saveTank();
    }
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
    if (!state.entered || aboutPanel.classList.contains("is-open") || tutorialPanel.classList.contains("is-open") || savePanel.classList.contains("is-open")) return;
    if (event.pointerType === "touch") {
      state.map.pointers.set(event.pointerId, pointerScreenPosition(event));
      canvas.setPointerCapture(event.pointerId);
      if (state.map.pointers.size >= 2) {
        mapTouchGesture();
        return;
      }
    }
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
    if (event.pointerType === "touch" && state.map.pointers.has(event.pointerId)) {
      state.map.pointers.set(event.pointerId, pointerScreenPosition(event));
      if (state.map.gesture) {
        moveTouchGesture();
        return;
      }
    }
    if (!state.pointer.down || state.pointer.id !== event.pointerId) return;
    const point = pointerPosition(event);
    state.pointer.x = point.x;
    state.pointer.y = point.y;
    if (state.activeBaby) {
      state.activeBaby.touchAngle = Math.atan2(point.y - state.activeBaby.y, point.x - state.activeBaby.x);
      state.activeBaby.x = mix(state.activeBaby.x, point.x, 0.58);
      state.activeBaby.y = mix(state.activeBaby.y, point.y, 0.58);
      return;
    }
    state.touchAngle = Math.atan2(point.y - state.center.y, point.x - state.center.x);
  }

  function releasePointer(event) {
    if (event?.pointerType === "touch") {
      state.map.pointers.delete(event.pointerId);
      if (state.map.gesture) {
        if (state.map.gesture.type === "baby") placeBabyAtHabitat(state.map.gesture.baby);
        state.map.gesture = null;
        state.pointer.down = false;
        state.pointer.id = null;
        return;
      }
    }
    if (!state.pointer.down) return;
    if (state.activeBaby) {
      const baby = state.activeBaby;
      placeBabyAtHabitat(baby);
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
      addTankGlow(0.8 + baby.size * 0.04);
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
      personality: state.count % 4,
      expression: 0,
      moodTimer: 2.5 + Math.random() * 4,
      playTimer: 2 + Math.random() * 3,
      home: null,
      queuedFor: Object.keys(habitatConfig).filter((key) => state.tank.levels[key] > 0)[state.count % Math.max(1, Object.values(state.tank.levels).filter(Boolean).length)] || null,
      wanderX: state.width * (Math.random() < 0.5 ? 0.12 + Math.random() * 0.18 : 0.7 + Math.random() * 0.18),
      wanderY: state.height * (0.55 + Math.random() * 0.45),
      wanderTimer: 2 + Math.random() * 4,
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
    const capacity = tankCapacity();
    if (state.babies.length > capacity) state.babies.shift();
    state.tank.population = Math.min(capacity, state.tank.population + 1);
    addTankGlow(3 + strength * 3);
    saveTank();
  }

  function leaveMemory(strength) {
    state.count += 1;
    localStorage.setItem("softness-memory-count", String(state.count));
    const hues = unlockedHues();
    const hue = hues[(state.count - 1) % hues.length];
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
    state.glowMotes.length = 0;
    state.tank.glow = 0;
    state.tank.population = 0;
    state.tank.levels = { algae: 0, nursery: 0, lantern: 0 };
    state.tank.savedBabies = [];
    state.tank.guests = { algae: null, nursery: null, lantern: null };
    state.tank.guestTimers = { algae: 0, nursery: 0, lantern: 0 };
    localStorage.removeItem("softness-memory-count");
    localStorage.removeItem("softness-jelly-tank");
    memoryCount.textContent = "00";
    updateTankUI();
    hint.textContent = "它又一次，与你素不相识";
    showAbout(false);
  }

  function updateHabitatGuests(dt) {
    Object.keys(habitatConfig).forEach((key) => {
      if (state.tank.levels[key] <= 0) return;
      let guest = state.tank.guests[key];
      state.tank.guestTimers[key] -= dt;
      if (guest && (!state.babies.includes(guest) || guest === state.activeBaby || state.tank.guestTimers[key] <= 0)) {
        guest.home = null;
        guest.lastPlayedAt = state.elapsed;
        guest.wanderTimer = 0;
        state.tank.guests[key] = null;
        state.tank.guestTimers[key] = 1.8;
        guest = null;
      }
      if (guest || state.tank.guestTimers[key] > 0) return;
      const candidates = state.babies.filter((baby) =>
        baby.detached && baby !== state.activeBaby && !baby.home &&
        (baby.queuedFor === key || !baby.queuedFor) &&
        state.elapsed - (baby.lastPlayedAt || -100) > 5,
      );
      if (!candidates.length) return;
      const queued = candidates.filter((baby) => baby.queuedFor === key);
      const pool = queued.length ? queued : candidates;
      const selected = pool[state.tank.queueCursor[key] % pool.length];
      state.tank.queueCursor[key] += 1;
      selected.home = key;
      selected.queuedFor = null;
      selected.playTimer = 1 + Math.random() * 1.2;
      selected.expression = 1;
      state.tank.guests[key] = selected;
      state.tank.guestTimers[key] = 7 + Math.random() * 4;
    });
  }

  function update(dt) {
    state.elapsed += dt;
    if (!state.map.gesture && !state.camera.mapGesture) {
      const ease = 1 - Math.pow(0.002, dt);
      state.map.zoom = mix(state.map.zoom, state.map.targetZoom, ease);
      state.map.scrollY = mix(state.map.scrollY, state.map.targetY, ease);
    }
    if (state.entered) {
      state.tank.glow += tankGlowRate() * dt;
      state.tank.hudElapsed += dt;
      state.tank.saveElapsed += dt;
      if (state.tank.hudElapsed >= 0.2) {
        state.tank.hudElapsed = 0;
        updateTankUI();
      }
      if (state.tank.saveElapsed >= 4) {
        state.tank.saveElapsed = 0;
        saveTank();
      }
    }
    state.tentaclePlay.amount *= Math.pow(0.018, dt);
    state.tentaclePlay.direction *= Math.pow(0.08, dt);
    updateHabitatGuests(dt);
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

    state.glowMotes.forEach((mote) => {
      mote.age += dt;
      if (mote.age >= mote.duration && !mote.collected) {
        mote.collected = true;
        addTankGlow(mote.amount);
      }
    });
    state.glowMotes = state.glowMotes.filter((mote) => !mote.collected);

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
      baby.moodTimer -= dt;
      if (baby.moodTimer <= 0) {
        baby.expression = baby.personality === 1 ? 4 : baby.personality === 3 ? 2 : Math.floor(Math.random() * 4);
        baby.moodTimer = 2.4 + Math.random() * 5.6;
      }
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
        if (baby.home && state.tank.levels[baby.home] > 0) {
          const home = habitatPosition(baby.home);
          const orbit = state.elapsed * (baby.personality === 0 ? 1.25 : 0.55) + baby.phase;
          const targetX = home.x + Math.cos(orbit) * (baby.personality === 0 ? 55 : 28);
          const targetY = home.y - 55 + Math.sin(orbit) * (baby.personality === 0 ? 38 : 20);
          const deltaX = targetX - baby.x;
          const deltaY = targetY - baby.y;
          baby.vx = mix(baby.vx, clamp(deltaX * 0.9, -48, 48), 1 - Math.pow(0.08, dt));
          baby.vy = mix(baby.vy, clamp(deltaY * 0.9, -44, 44), 1 - Math.pow(0.08, dt));
          if (Math.hypot(deltaX, deltaY) < 115) {
            baby.playTimer -= dt;
            if (baby.playTimer <= 0) {
              baby.expression = baby.personality === 3 ? 2 : 1;
              baby.moodTimer = 2.2;
              baby.playTimer = 3.2 + Math.random() * 2.5;
              state.glowMotes.push({
                x: baby.x,
                y: baby.y,
                age: 0,
                delay: 2 + Math.random() * 3.2,
                duration: 16 + Math.random() * 7,
                seed: Math.random() * TAU,
                amount: 0.75 + state.tank.levels[baby.home] * 0.45,
                hue: baby.hue,
              });
              if (state.glowMotes.length > 80) state.glowMotes.shift();
            }
          }
        } else {
          baby.wanderTimer -= dt;
          if (baby.wanderTimer <= 0 && state.elapsed >= (baby.teaseUntil || 0) && state.elapsed >= (baby.fleeUntil || 0)) {
            baby.wanderX = state.width * (Math.random() < 0.5 ? 0.1 + Math.random() * 0.2 : 0.7 + Math.random() * 0.2);
            baby.wanderY = state.height * (0.55 + Math.random() * 1.18);
            baby.wanderTimer = 5 + Math.random() * 5;
          }
          let targetX = baby.wanderX;
          let targetY = baby.wanderY;
          if (state.elapsed < (baby.teaseUntil || 0)) {
            const angle = baby.teaseAngle + (state.elapsed - (baby.teaseUntil - 2.2)) * 2.3;
            targetX = baby.teaseX + Math.cos(angle) * 60;
            targetY = baby.teaseY + Math.sin(angle) * 45;
          } else if (state.elapsed < (baby.fleeUntil || 0)) {
            const awayX = baby.x - baby.fleeX;
            const awayY = baby.y - baby.fleeY;
            const distance = Math.max(1, Math.hypot(awayX, awayY));
            targetX = baby.x + awayX / distance * 145;
            targetY = baby.y + awayY / distance * 110;
          }
          const dx = targetX - baby.x;
          const dy = targetY - baby.y;
          baby.vx = mix(baby.vx, clamp(dx * 0.37 + Math.sin(baby.phase) * 4, -23, 23), 1 - Math.pow(0.3, dt));
          baby.vy = mix(baby.vy, clamp(dy * 0.37 + Math.cos(baby.phase) * 4, -23, 23), 1 - Math.pow(0.3, dt));
        }
      }
      if (!birthing && state.activeBaby !== baby) {
        baby.x += (baby.vx + Math.sin(baby.phase * 0.8) * 2.2) * dt;
        baby.y += baby.vy * dt;
      }
      baby.y = clamp(baby.y, baby.size * 2, state.map.worldHeight - baby.size * 2);
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

  function drawTankHabitat() {
    const w = state.width;
    const h = state.height;
    const floorY = h * 0.875;
    const algaeLevel = state.tank.levels.algae;
    const nurseryLevel = state.tank.levels.nursery;
    const lanternLevel = state.tank.levels.lantern;
    ctx.save();

    const floorGlow = ctx.createLinearGradient(0, floorY - 30, 0, h);
    floorGlow.addColorStop(0, "rgba(79,199,200,0)");
    floorGlow.addColorStop(0.55, "rgba(62,168,175,0.08)");
    floorGlow.addColorStop(1, "rgba(12,45,62,0.3)");
    ctx.fillStyle = floorGlow;
    ctx.fillRect(0, floorY - 30, w, h - floorY + 30);

    ctx.strokeStyle = "rgba(136,229,225,0.13)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.045, 0);
    ctx.bezierCurveTo(w * 0.02, h * 0.3, w * 0.025, h * 0.7, w * 0.07, floorY);
    ctx.quadraticCurveTo(w * 0.5, h * 0.94, w * 0.93, floorY);
    ctx.bezierCurveTo(w * 0.975, h * 0.7, w * 0.98, h * 0.3, w * 0.955, 0);
    ctx.stroke();

    if (algaeLevel > 0) {
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 3 + algaeLevel * 2; i += 1) {
        const x = w * (0.08 + i * 0.028);
        const height = 25 + (i % 3) * 14 + algaeLevel * 7;
        const sway = Math.sin(state.elapsed * 0.7 + i * 1.7) * (4 + algaeLevel);
        ctx.strokeStyle = `rgba(${96 + i * 3},${215 + i * 2},210,${0.2 + algaeLevel * 0.055})`;
        ctx.lineWidth = 2 + (i % 2) * 1.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, floorY + 12);
        ctx.bezierCurveTo(x - sway, floorY - height * 0.34, x + sway, floorY - height * 0.7, x + sway * 0.6, floorY - height);
        ctx.stroke();
      }
    }

    if (nurseryLevel > 0) {
      ctx.globalCompositeOperation = "screen";
      const baseX = w * 0.82;
      ctx.strokeStyle = `rgba(255,145,198,${0.22 + nurseryLevel * 0.08})`;
      ctx.lineWidth = 3 + nurseryLevel * 0.6;
      ctx.lineCap = "round";
      for (let branch = 0; branch < 2 + nurseryLevel; branch += 1) {
        const direction = branch % 2 ? 1 : -1;
        const spread = (branch + 1) * 7;
        ctx.beginPath();
        ctx.moveTo(baseX + spread * 0.2, floorY + 14);
        ctx.bezierCurveTo(
          baseX + direction * spread * 0.3,
          floorY - 18,
          baseX + direction * spread,
          floorY - 30 - branch * 6,
          baseX + direction * spread * 1.15,
          floorY - 45 - nurseryLevel * 6,
        );
        ctx.stroke();
      }
    }

    if (lanternLevel > 0) {
      const x = w * 0.52;
      const y = floorY + 2;
      const radius = 18 + lanternLevel * 4;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 5.2);
      glow.addColorStop(0, `rgba(255,224,171,${0.42 + lanternLevel * 0.1})`);
      glow.addColorStop(0.2, `rgba(146,232,231,${0.18 + lanternLevel * 0.05})`);
      glow.addColorStop(1, "rgba(92,211,215,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius * 5.2, y - radius * 5.2, radius * 10.4, radius * 10.4);
      ctx.fillStyle = `rgba(231,255,250,${0.55 + lanternLevel * 0.1})`;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.32, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawReefScene() {
    const w = state.width;
    const h = state.height;
    const bottom = state.map.worldHeight;
    const floorY = bottom - h * 0.24;
    ctx.save();
    const depth = ctx.createLinearGradient(0, h * 0.82, 0, bottom);
    depth.addColorStop(0, "rgba(5,31,48,0)");
    depth.addColorStop(0.48, "rgba(11,43,63,0.4)");
    depth.addColorStop(1, "rgba(31,42,76,0.82)");
    ctx.fillStyle = depth;
    ctx.fillRect(0, h * 0.82, w, bottom - h * 0.82);

    const currentStartY = state.center.y + baseRadius() * 1.45;
    const currentEndY = habitatPosition("nursery").y - h * 0.12;
    const sway = Math.sin(state.elapsed * 0.23) * w * 0.018;
    const current = ctx.createLinearGradient(0, currentStartY, 0, currentEndY);
    current.addColorStop(0, "rgba(156,230,231,0.025)");
    current.addColorStop(0.5, "rgba(126,217,231,0.075)");
    current.addColorStop(1, "rgba(181,192,248,0.04)");
    ctx.lineCap = "round";
    [18, 5].forEach((width) => {
      ctx.beginPath();
      ctx.moveTo(state.center.x, currentStartY);
      ctx.bezierCurveTo(w * 0.43 + sway, h * 0.9, w * 0.57 - sway, h * 1.02, w * 0.52, currentEndY);
      ctx.strokeStyle = current;
      ctx.lineWidth = width;
      ctx.stroke();
    });

    ctx.strokeStyle = "rgba(154,235,229,0.13)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(w * 0.035, h * 0.05);
    ctx.bezierCurveTo(w * 0.015, h * 0.65, w * 0.02, bottom - h * 0.15, w * 0.09, bottom - h * 0.07);
    ctx.quadraticCurveTo(w * 0.5, bottom + h * 0.04, w * 0.91, bottom - h * 0.07);
    ctx.bezierCurveTo(w * 0.98, bottom - h * 0.15, w * 0.985, h * 0.65, w * 0.965, h * 0.05);
    ctx.stroke();

    const sand = ctx.createLinearGradient(0, floorY - 20, 0, bottom);
    sand.addColorStop(0, "rgba(98,156,170,0)");
    sand.addColorStop(0.45, "rgba(92,113,155,0.14)");
    sand.addColorStop(1, "rgba(35,59,87,0.42)");
    ctx.fillStyle = sand;
    ctx.fillRect(0, floorY - 20, w, bottom - floorY + 20);

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(218,245,245,0.28)";
    ctx.font = `10px "PingFang SC", sans-serif`;
    ctx.fillText("深海花园 · 小水母的游乐场", w * 0.5, h * 1.04);
    ctx.strokeStyle = "rgba(162,230,228,0.12)";
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 1.065);
    ctx.lineTo(w * 0.65, h * 1.065);
    ctx.stroke();

    const imageReady = reefImage.complete && reefImage.naturalWidth > 0;
    if (imageReady) {
      const imageWidth = Math.min(w * 0.97, 940);
      const imageHeight = imageWidth * reefImage.naturalHeight / reefImage.naturalWidth;
      const imageX = (w - imageWidth) * 0.5;
      const imageY = habitatPosition("nursery").y - imageHeight * 0.62;
      ctx.globalAlpha = 0.73;
      ctx.drawImage(reefImage, imageX, imageY, imageWidth, imageHeight);
      ctx.globalAlpha = 1;
      Object.keys(habitatConfig).forEach((key) => {
        const level = state.tank.levels[key];
        if (!level) return;
        const center = habitatPosition(key);
        const color = key === "algae" ? "121,240,212" : key === "nursery" ? "255,184,216" : "190,180,255";
        const glow = ctx.createRadialGradient(center.x, center.y - 18, 10, center.x, center.y - 18, 160);
        glow.addColorStop(0, `rgba(${color},${0.17 + level * 0.035})`);
        glow.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(center.x - 170, center.y - 188, 340, 340);
      });
    }

    Object.keys(habitatConfig).forEach((key) => {
      const center = habitatPosition(key);
      const level = state.tank.levels[key];
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.globalAlpha = level ? 1 : 0.28;
      const colors = { algae: [115, 226, 205], nursery: [255, 174, 208], lantern: [180, 170, 255] };
      const color = colors[key];
      if (!imageReady) {
        const halo = ctx.createRadialGradient(0, 12, 4, 0, 12, 125 + level * 12);
        halo.addColorStop(0, `rgba(${color.join(",")},${level ? 0.17 + level * 0.04 : 0.05})`);
        halo.addColorStop(1, `rgba(${color.join(",")},0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(-170, -150, 340, 300);
        if (key === "algae") drawAlgaeHabitat(level);
        if (key === "nursery") drawNurseryHabitat(level);
        if (key === "lantern") drawLanternHabitat(level);
      }
      ctx.fillStyle = `rgba(${color.join(",")},0.78)`;
      ctx.font = `12px "PingFang SC", sans-serif`;
      ctx.fillText(habitatConfig[key].label, 0, 132);
      ctx.fillStyle = "rgba(224,247,244,0.43)";
      ctx.font = `9px "PingFang SC", sans-serif`;
      ctx.fillText(level ? `LV.${level} · 小水母正在玩耍` : "收集微光后培育", 0, 149);
      ctx.restore();
    });
    ctx.restore();
  }

  function drawAlgaeHabitat(level) {
    const sway = Math.sin(state.elapsed * 0.65) * 7;
    ctx.save();
    ctx.lineCap = "round";
    for (let i = -3; i <= 3; i += 1) {
      const length = 78 + (i % 3) * 15 + level * 9;
      ctx.beginPath();
      ctx.moveTo(i * 15, 77);
      ctx.bezierCurveTo(i * 16 - 18, 20, i * 10 + sway, -length * 0.58, i * 13 + sway, 77 - length);
      ctx.strokeStyle = `rgba(109,221,198,${0.25 + level * 0.08})`;
      ctx.lineWidth = 5 + (i % 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(203,255,238,0.28)";
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, 46, 58, 25, -0.12, Math.PI, TAU);
    ctx.strokeStyle = "rgba(182,248,225,0.6)";
    ctx.lineWidth = 5;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(108,236,211,0.5)";
    ctx.stroke();
    ctx.restore();
  }

  function drawNurseryHabitat(level) {
    ctx.save();
    ctx.shadowBlur = 17;
    ctx.shadowColor = "rgba(255,162,202,0.42)";
    const shell = ctx.createLinearGradient(0, -80, 0, 85);
    shell.addColorStop(0, "rgba(255,221,222,0.5)");
    shell.addColorStop(1, "rgba(199,102,164,0.44)");
    ctx.beginPath();
    ctx.moveTo(-68, 72);
    ctx.bezierCurveTo(-95, -10, -68, -85, 0, -72);
    ctx.bezierCurveTo(72, -98, 96, -8, 68, 72);
    ctx.quadraticCurveTo(0, 109, -68, 72);
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,214,230,0.68)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 12, 71);
      ctx.quadraticCurveTo(i * 25, -12, i * 20, -58);
      ctx.strokeStyle = "rgba(255,238,238,0.27)";
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, 55, 33, 17, 0, 0, TAU);
    ctx.fillStyle = "rgba(255,239,244,0.72)";
    ctx.fill();
    ctx.restore();
  }

  function drawLanternHabitat(level) {
    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = "rgba(178,177,255,0.7)";
    ctx.strokeStyle = "rgba(200,205,255,0.72)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, -7, 60 + level * 2, -Math.PI * 0.1, Math.PI * 1.47);
    ctx.stroke();
    ctx.strokeStyle = "rgba(242,240,255,0.76)";
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(-70, 77);
    ctx.quadraticCurveTo(0, 52, 70, 77);
    ctx.strokeStyle = "rgba(154,160,227,0.6)";
    ctx.lineWidth = 13;
    ctx.stroke();
    for (let i = -1; i <= 1; i += 1) {
      const x = i * 29;
      ctx.beginPath();
      ctx.moveTo(x, -58);
      ctx.lineTo(x, -22 + (i % 2) * 13);
      ctx.strokeStyle = "rgba(211,212,255,0.42)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,239,190,0.84)";
      ctx.beginPath();
      ctx.arc(x, -19 + (i % 2) * 13, 3.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
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
    mood = 0,
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

    if (hue !== 0) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.translate(0, -size * 0.42);
      ctx.strokeStyle = `rgba(255,255,255,${0.54 * alpha})`;
      ctx.lineWidth = Math.max(0.75, size * 0.035);
      ctx.lineCap = "round";
      if (hue === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.16, -Math.PI * 0.3, Math.PI * 0.8);
        ctx.stroke();
      } else if (hue === 2) {
        for (let i = 0; i < 5; i += 1) {
          const angle = i * TAU / 5;
          ctx.beginPath();
          ctx.ellipse(Math.cos(angle) * size * 0.085, Math.sin(angle) * size * 0.085, size * 0.045, size * 0.075, angle, 0, TAU);
          ctx.stroke();
        }
      } else if (hue === 3) {
        ctx.beginPath();
        ctx.moveTo(-size * 0.12, size * 0.04);
        ctx.quadraticCurveTo(0, -size * 0.18, size * 0.12, size * 0.04);
        ctx.quadraticCurveTo(0, size * 0.1, -size * 0.12, size * 0.04);
        ctx.stroke();
      } else {
        for (let i = 0; i < 5; i += 1) {
          const angle = i * TAU / 5 - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * size * 0.17, Math.sin(angle) * size * 0.17);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    const expression = mood % 5;
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
        baby.expression,
      );
    });
  }

  function drawGlowMotes() {
    state.glowMotes.forEach((mote) => {
      const t = clamp((mote.age - mote.delay) / Math.max(1, mote.duration - mote.delay), 0, 1);
      const glide = t * t * (3 - 2 * t);
      const wander = Math.sin(Math.PI * t);
      const driftX = Math.sin(mote.age * 0.67 + mote.seed) * 22 + Math.sin(mote.age * 0.31 + mote.seed * 2.1) * 14;
      const driftY = Math.cos(mote.age * 0.48 + mote.seed) * 13;
      const x = mix(mote.x, state.center.x, glide) + driftX * (1 - glide) + Math.sin(mote.seed * 3.1) * wander * 42;
      const y = mix(mote.y, state.center.y, glide) + driftY * (1 - glide) - wander * 18;
      const color = palette[mote.hue];
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.shadowBlur = 16;
      ctx.shadowColor = `rgba(${color[0]},${color[1]},${color[2]},0.55)`;
      const flicker = 0.48 + Math.sin(mote.age * 1.1 + mote.seed) * 0.14;
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${flicker * (1 - glide * 0.25)})`;
      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.sin(mote.age * 0.9 + mote.seed) * 0.35, 0, TAU);
      ctx.fill();
      ctx.restore();
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
    ctx.save();
    ctx.translate(state.width * 0.5, state.height * 0.5);
    ctx.scale(state.map.zoom, state.map.zoom);
    ctx.translate(-state.width * 0.5, -state.height * 0.5 - state.map.scrollY);
    drawReefScene();
    drawBabyJellyfish();
    drawGlowMotes();
    drawRipples();
    drawContourMountainAura();
    drawCreature();
    drawGestureCursor();
    ctx.restore();
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
  surfaceButton.addEventListener("click", () => setMapView(0));
  reefButton.addEventListener("click", () => setMapView(state.map.worldHeight - state.height));
  tutorialButton.addEventListener("click", () => showTutorial(true));
  tutorialClose.addEventListener("click", () => showTutorial(false));
  saveButton.addEventListener("click", () => showSavePanel(true));
  saveClose.addEventListener("click", () => showSavePanel(false));
  saveNow.addEventListener("click", () => {
    saveTank();
    hint.textContent = "这一片海已经存好了";
  });
  exportSave.addEventListener("click", () => {
    saveTank();
    const blob = new Blob([JSON.stringify(tankSnapshot(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jelly-tank-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    saveStatus.textContent = "存档文件已导出，可以在另一台设备导入";
  });
  importSave.addEventListener("change", async () => {
    const file = importSave.files?.[0];
    if (!file) return;
    try {
      if (file.size > 250000) throw new Error("存档文件过大");
      loadSnapshot(JSON.parse(await file.text()));
      saveStatus.textContent = `已读取 ${file.name} · ${state.tank.population} 只小水母`;
      hint.textContent = "熟悉的小水母又回到了这片海";
    } catch (error) {
      saveStatus.textContent = error?.message || "无法读取存档文件";
    }
    importSave.value = "";
  });
  habitatButtons.forEach((button) => {
    button.addEventListener("click", () => upgradeHabitat(button.dataset.habitat));
  });
  aboutButton.addEventListener("click", () => showAbout(true));
  closeAbout.addEventListener("click", () => showAbout(false));
  veil.addEventListener("click", () => showAbout(false));
  resetButton.addEventListener("click", resetMemories);
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("wheel", (event) => {
    if (!state.entered || tutorialPanel.classList.contains("is-open")) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      state.map.targetZoom = clamp(state.map.targetZoom - event.deltaY * 0.003, 0.72, 1.65);
      setMapView(state.map.targetY);
    } else {
      setMapView(state.map.targetY + event.deltaY * 0.9 / state.map.zoom);
    }
  }, { passive: false });
  window.addEventListener("resize", resize);

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "m") {
      state.soundOn = !state.soundOn;
      updateSoundButton();
    }
    if (event.key.toLowerCase() === "c" && !event.repeat) toggleCamera();
    if (event.key.toLowerCase() === "b" && !event.repeat) toggleBackgroundMode();
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
    if (event.key === "Escape") {
      showAbout(false);
      if (tutorialPanel.classList.contains("is-open")) showTutorial(false);
      showSavePanel(false);
    }
    if (event.key === "ArrowDown") setMapView(state.map.targetY + state.height * 0.32);
    if (event.key === "ArrowUp") setMapView(state.map.targetY - state.height * 0.32);
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "Space" && state.pointer.down && state.pointer.id === null) {
      event.preventDefault();
      releasePointer();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      saveTank();
      if (state.camera.enabled) stopCamera("");
    }
  });
  window.addEventListener("beforeunload", () => {
    saveTank();
    stopCamera("");
  });

  const awaySeconds = Math.min(6 * 60 * 60, Math.max(0, (Date.now() - state.tank.lastSavedAt) / 1000));
  const awayGlow = tankGlowRate() * awaySeconds * 0.7;
  state.tank.glow += awayGlow;
  state.tank.awayGlow = awayGlow;

  memoryCount.textContent = String(state.count).padStart(2, "0");
  updateTankUI();
  updateSoundButton();
  updateCameraButton();
  updateBackgroundButton();
  resize();
  requestAnimationFrame(render);
})();
