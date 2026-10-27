(() => {
  "use strict";

  const canvas = document.querySelector("#world");
  const ctx = canvas.getContext("2d");
  const invitation = document.querySelector("#invitation");
  const enterButton = document.querySelector("#enterButton");
  const soundButton = document.querySelector("#soundButton");
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

  function updateSoundButton() {
    soundButton.setAttribute("aria-pressed", String(state.soundOn));
    soundButton.setAttribute("aria-label", state.soundOn ? "关闭声音" : "开启声音");
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
    const point = pointerPosition(event);
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
    state.touchAngle = Math.atan2(point.y - state.center.y, point.x - state.center.x);
  }

  function releasePointer() {
    if (!state.pointer.down) return;
    const strength = clamp(state.pressure * 0.72 + state.dragDistance / (baseRadius() * 2.8), 0.15, 1);
    state.pointer.down = false;
    state.pointer.id = null;
    canvas.classList.remove("is-touching");
    leaveMemory(strength);
    tone(strength, state.touchAngle);
    hint.textContent = "一只小水母游走了";
    window.setTimeout(() => {
      if (!state.pointer.down) hint.textContent = "再捏出一只，或只是看它们漂游";
    }, 2200);
  }

  function spawnBaby(strength, hue) {
    const radius = baseRadius();
    const pulledOut = state.dragDistance > radius * 0.04;
    const surfaceX = state.center.x + Math.cos(state.touchAngle) * radius * 0.84;
    const surfaceY = state.center.y + Math.sin(state.touchAngle) * radius * 0.84;
    const originX = pulledOut ? mix(surfaceX, state.pointer.x, 0.58) : surfaceX;
    const originY = pulledOut ? mix(surfaceY, state.pointer.y, 0.58) : surfaceY;
    const size = 10 + strength * 8;
    state.babies.push({
      x: originX,
      y: originY,
      vx: Math.cos(state.touchAngle) * (5 + strength * 7),
      vy: -7 - strength * 7,
      size,
      strength,
      hue,
      phase: state.count * 0.91 + Math.random() * 0.5,
      age: 0,
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
    const targetPressure = state.pointer.down ? clamp(0.28 + holdTime * 0.36, 0, 1) : 0;
    state.pressureVelocity += (targetPressure - state.pressure) * 16 * dt;
    state.pressureVelocity *= Math.pow(0.035, dt);
    state.pressure += state.pressureVelocity * dt * 7;
    state.pressure = clamp(state.pressure, -0.12, 1.08);
    state.dragDistance = state.pointer.down ? Math.max(0, pointerDistance - radius * 0.72) : mix(state.dragDistance, 0, 1 - Math.pow(0.02, dt));

    const contourEase = 1 - Math.pow(0.16, dt);
    state.contourPressure = mix(state.contourPressure, clamp(state.pressure, 0, 1), contourEase);
    state.contourDrag = mix(state.contourDrag, clamp(state.dragDistance / radius, 0, 0.85), contourEase);
    state.contourRelease = mix(state.contourRelease, clamp(-state.pressureVelocity * 0.34, 0, 1), contourEase * 0.72);
    if (state.pointer.down) {
      state.contourAngle += shortestAngle(state.touchAngle, state.contourAngle) * contourEase * 0.58;
    }

    const centerTargetX = state.width * 0.5 + (state.pointer.down ? dx * 0.075 : 0);
    const centerTargetY = state.height * 0.51 + (state.pointer.down ? dy * 0.075 : 0);
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
      const indentation = state.pointer.down && inside ? -state.pressure * 0.24 * proximity : 0;
      const pull = state.pointer.down && !inside ? clamp((pointerDistance - radius) / radius, 0, 0.72) * 0.66 * proximity : 0;
      const volume = state.pointer.down ? state.pressure * 0.075 * (1 - proximity) - state.pressure * 0.025 * opposite : 0;
      const breath = (reduceMotion ? 0.006 : 0.021) * Math.sin(state.elapsed * 0.92 + node.phase * 0.22);
      const membrane = (reduceMotion ? 0.002 : 0.007) * Math.sin(state.elapsed * 0.55 + node.angle * 3 + node.phase);
      const target = indentation + pull + volume + breath + membrane;
      node.velocity += (target - node.value) * 31 * dt;
      node.velocity *= Math.pow(0.004, dt);
      node.value += node.velocity * dt * 6.2;
    });

    state.ripples.forEach((ripple) => { ripple.age += dt; });
    state.ripples = state.ripples.filter((ripple) => ripple.age < 3.4);

    state.babies.forEach((baby) => {
      baby.age += dt;
      baby.phase += dt * (0.42 + baby.strength * 0.16);
      baby.vx *= Math.pow(0.72, dt);
      baby.vy = mix(baby.vy, -4.2 - baby.strength * 2.2, 1 - Math.pow(0.3, dt));
      baby.x += (baby.vx + Math.sin(baby.phase * 0.8) * 3.2) * dt;
      baby.y += baby.vy * dt;
      if (baby.y < -baby.size * 4) baby.y = state.height + baby.size * 3;
      if (baby.x < -baby.size * 3) baby.x = state.width + baby.size * 2;
      if (baby.x > state.width + baby.size * 3) baby.x = -baby.size * 2;
    });
  }

  function blobPoint(node, radius, offset = 0) {
    const value = node.value * (1 - offset * 0.18);
    const localRadius = radius * (1 + value) - offset;
    return {
      x: state.center.x + Math.cos(node.angle) * localRadius,
      y: state.center.y + Math.sin(node.angle) * localRadius,
    };
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

  function drawJellyfishBody(x, y, size, phase, hue, alpha = 1) {
    const c = palette[hue % palette.length];
    ctx.save();
    ctx.translate(x, y);
    const pulse = 1 + Math.sin(phase * 2) * 0.055;
    ctx.scale(pulse, 1 / Math.sqrt(pulse));
    ctx.shadowBlur = size * 1.15;
    ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},${0.42 * alpha})`;
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
    ctx.shadowBlur = size * 0.45;
    for (let i = -1; i <= 1; i += 1) {
      const sway = Math.sin(phase + i * 1.2) * size * 0.22;
      ctx.beginPath();
      ctx.moveTo(i * size * 0.38, size * 0.06);
      ctx.bezierCurveTo(i * size * 0.32 + sway, size * 0.58, i * size * 0.18 - sway, size * 0.9, i * size * 0.28 + sway, size * 1.38);
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.42 - Math.abs(i) * 0.07) * alpha})`;
      ctx.lineWidth = Math.max(0.65, size * 0.035);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBabyJellyfish() {
    state.babies.forEach((baby) => {
      drawJellyfishBody(baby.x, baby.y, baby.size, baby.phase, baby.hue, clamp(baby.age / 0.8, 0.12, 1));
    });
  }

  function drawRipples() {
    state.ripples.forEach((ripple) => {
      const t = ripple.age / 3.4;
      const color = palette[ripple.hue];
      ctx.save();
      ctx.translate(ripple.x, ripple.y);
      ctx.scale(1, 0.62);
      ctx.beginPath();
      ctx.arc(0, 0, 28 + easeOut(t) * 210 * ripple.strength, 0, TAU);
      ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${(1 - t) * 0.42})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    });
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

    const blinkCycle = state.elapsed % 8.2;
    const blink = blinkCycle > 7.72 ? Math.abs(blinkCycle - 7.96) / 0.24 : 1;
    const eyeY = state.center.y + radius * 0.08;
    [-1, 1].forEach((side) => {
      const x = state.center.x + side * radius * 0.112;
      ctx.beginPath();
      ctx.fillStyle = "rgba(68,60,78,0.36)";
      ctx.ellipse(x, eyeY, radius * 0.011, Math.max(0.5, radius * 0.024 * blink), 0, 0, TAU);
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
    update(dt);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, state.width, state.height);
    drawBackground();
    drawBabyJellyfish();
    drawRipples();
    drawContourMountainAura();
    drawCreature();
    requestAnimationFrame(render);
  }

  enterButton.addEventListener("click", enter);
  soundButton.addEventListener("click", () => {
    state.soundOn = !state.soundOn;
    if (state.soundOn) initAudio();
    updateSoundButton();
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

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "m") {
      state.soundOn = !state.soundOn;
      updateSoundButton();
    }
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

  memoryCount.textContent = String(state.count).padStart(2, "0");
  updateSoundButton();
  resize();
  requestAnimationFrame(render);
})();
