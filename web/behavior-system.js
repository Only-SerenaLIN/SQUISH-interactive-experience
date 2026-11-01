(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SquishBehavior = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const STATES = Object.freeze({
    WANDER: "wander", FOLLOW: "follow", FLEE: "flee", ORBIT: "orbit",
    REACT: "react", RECOVER: "recover", SLEEP: "sleep",
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const length = (vector) => Math.hypot(vector.x, vector.y);

  function limit(vector, maximum) {
    const magnitude = length(vector);
    if (!magnitude || magnitude <= maximum) return { x: vector.x, y: vector.y };
    const ratio = maximum / magnitude;
    return { x: vector.x * ratio, y: vector.y * ratio };
  }

  function createPointerState() {
    return {
      position: { x: 0, y: 0 }, previousPosition: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 }, speed: 0, isActive: false,
      inputMode: "mouse", initialized: false, lastUpdateAt: 0,
    };
  }

  function updatePointer(pointer, sample, dt = 1 / 60, smoothing = 0.58) {
    const safeDt = clamp(dt || 1 / 60, 1 / 240, 0.12);
    const blend = clamp(smoothing, 0.08, 1);
    if (!pointer.initialized) {
      pointer.position.x = sample.x;
      pointer.position.y = sample.y;
      pointer.previousPosition.x = sample.x;
      pointer.previousPosition.y = sample.y;
      pointer.initialized = true;
    } else {
      pointer.previousPosition.x = pointer.position.x;
      pointer.previousPosition.y = pointer.position.y;
      pointer.position.x += (sample.x - pointer.position.x) * blend;
      pointer.position.y += (sample.y - pointer.position.y) * blend;
    }
    const raw = {
      x: (pointer.position.x - pointer.previousPosition.x) / safeDt,
      y: (pointer.position.y - pointer.previousPosition.y) / safeDt,
    };
    pointer.velocity.x += (raw.x - pointer.velocity.x) * 0.34;
    pointer.velocity.y += (raw.y - pointer.velocity.y) * 0.34;
    pointer.speed = length(pointer.velocity);
    pointer.isActive = sample.isActive !== false;
    pointer.inputMode = sample.inputMode || pointer.inputMode;
    pointer.lastUpdateAt = sample.now || 0;
    return pointer;
  }

  function deactivatePointer(pointer) {
    pointer.isActive = false;
    pointer.velocity.x = 0;
    pointer.velocity.y = 0;
    pointer.speed = 0;
    return pointer;
  }

  function createProfile({ personality = "calm", size = 24, random = Math.random } = {}) {
    const scale = clamp(size / 24, 0.72, 1.45);
    return {
      state: STATES.WANDER,
      previousState: STATES.WANDER,
      detectionRadius: 120 * scale,
      comfortDistance: 35 * scale,
      fleeDistance: 70 * scale,
      followSpeed: ({ calm: 18, shy: 14, playful: 27 }[personality] || 18) * scale,
      fleeSpeed: ({ calm: 21, shy: 40, playful: 28 }[personality] || 24) * scale,
      maxSpeed: ({ calm: 24, shy: 42, playful: 34 }[personality] || 28) * scale,
      maxAcceleration: ({ calm: 24, shy: 48, playful: 38 }[personality] || 30) * scale,
      reactionCooldownUntil: 0,
      recoverUntil: 0,
      orbitUntil: 0,
      orbitDirection: random() < 0.5 ? -1 : 1,
      lastDecisionAt: 0,
    };
  }

  function beginRecover(profile, now, duration = 900) {
    profile.previousState = profile.state;
    profile.state = STATES.RECOVER;
    profile.recoverUntil = now + duration;
  }

  function decide(profile, context) {
    const {
      personality = "calm", emotion = "neutral", trust = 45, stress = 10,
      fleeProbability = 0.25, pointer, baby, now = 0, directInteraction = false,
      allowFollow = true, random = Math.random,
    } = context;
    const previous = profile.state;
    let next = STATES.WANDER;
    const dx = pointer.position.x - baby.x;
    const dy = pointer.position.y - baby.y;
    const distance = Math.hypot(dx, dy);
    const fastApproach = pointer.speed > 520;

    if (emotion === "sleeping") next = STATES.SLEEP;
    else if (directInteraction) next = STATES.REACT;
    else if (now < profile.recoverUntil) next = STATES.RECOVER;
    else if (!pointer.isActive) next = STATES.WANDER;
    else if (profile.state === STATES.REACT && now < profile.reactionCooldownUntil) next = STATES.REACT;
    else if (profile.state === STATES.FLEE && now < profile.reactionCooldownUntil && distance < profile.detectionRadius * 1.3) next = STATES.FLEE;
    else if (distance > profile.detectionRadius) next = STATES.WANDER;
    else if (personality === "calm") {
      next = fastApproach && now >= profile.reactionCooldownUntil
        ? STATES.REACT
        : distance > profile.comfortDistance ? STATES.FOLLOW : STATES.RECOVER;
      if (next === STATES.REACT) profile.reactionCooldownUntil = now + 720;
    } else if (personality === "shy") {
      const trustEase = clamp((trust - 45) / 55, 0, 1);
      const adjustedDanger = clamp(fleeProbability + stress / 250 + pointer.speed / 1800 - trustEase * 0.42, 0.03, 0.96);
      if (distance < profile.fleeDistance * (1.12 - trustEase * 0.28) && random() < adjustedDanger) {
        next = STATES.FLEE;
        profile.reactionCooldownUntil = now + 900;
      } else if (trust >= 68 && distance > profile.comfortDistance * 0.9 && allowFollow) next = STATES.FOLLOW;
      else next = STATES.RECOVER;
    } else {
      if (!allowFollow) next = STATES.WANDER;
      else if (distance < profile.comfortDistance * 1.8 && now >= profile.reactionCooldownUntil && random() < 0.2) {
        next = STATES.ORBIT;
        profile.orbitUntil = now + 900 + random() * 700;
        profile.reactionCooldownUntil = profile.orbitUntil + 1400;
      } else if (profile.state === STATES.ORBIT && now < profile.orbitUntil) next = STATES.ORBIT;
      else if (distance > profile.comfortDistance * 0.78) next = STATES.FOLLOW;
      else next = STATES.RECOVER;
    }
    if (!allowFollow && (next === STATES.FOLLOW || next === STATES.ORBIT)) next = STATES.WANDER;
    profile.previousState = previous;
    profile.state = next;
    profile.lastDecisionAt = now;
    return { state: next, changed: next !== previous, distance, fastApproach };
  }

  function steering(profile, baby, pointer) {
    const dx = pointer.position.x - baby.x;
    const dy = pointer.position.y - baby.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const toward = { x: dx / distance, y: dy / distance };
    let desired = { x: 0, y: 0 };
    if (profile.state === STATES.FOLLOW) {
      const arrival = clamp((distance - profile.comfortDistance) / Math.max(1, profile.comfortDistance), 0, 1);
      desired = { x: toward.x * profile.followSpeed * arrival, y: toward.y * profile.followSpeed * arrival };
    } else if (profile.state === STATES.FLEE) {
      const urgency = clamp((profile.fleeDistance * 1.55 - distance) / profile.fleeDistance, 0.32, 1);
      desired = { x: -toward.x * profile.fleeSpeed * urgency, y: -toward.y * profile.fleeSpeed * urgency };
    } else if (profile.state === STATES.ORBIT) {
      const radialError = clamp((distance - profile.comfortDistance * 1.18) / profile.comfortDistance, -0.7, 0.7);
      desired = {
        x: -toward.y * profile.followSpeed * profile.orbitDirection + toward.x * radialError * 12,
        y: toward.x * profile.followSpeed * profile.orbitDirection + toward.y * radialError * 12,
      };
    }
    return limit({ x: desired.x - baby.vx, y: desired.y - baby.vy }, profile.maxAcceleration);
  }

  function separation(baby, neighbors, radius) {
    let x = 0; let y = 0; let count = 0;
    neighbors.forEach((other) => {
      if (other === baby || !other.detached) return;
      const dx = baby.x - other.x;
      const dy = baby.y - other.y;
      const distance = Math.hypot(dx, dy);
      const spacing = radius || (baby.size + other.size) * 1.45;
      if (distance > 0 && distance < spacing) {
        const strength = (spacing - distance) / spacing;
        x += (dx / distance) * strength;
        y += (dy / distance) * strength;
        count += 1;
      }
    });
    if (!count) return { x: 0, y: 0 };
    return limit({ x: x * 34, y: y * 34 }, 28);
  }

  return { STATES, createPointerState, updatePointer, deactivatePointer, createProfile, beginRecover, decide, steering, separation, limit };
});
