(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SquishSocial = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TYPES = Object.freeze({
    GREETING: "greeting",
    BUMP: "gentle-bump",
    SYNC: "synchronized-floating",
    SHY_RETREAT: "shy-retreat",
    PLAYFUL_ORBIT: "playful-orbit",
  });
  const STATES = Object.freeze({ IDLE: "idle", APPROACH: "approach", ENGAGE: "engage", SEPARATE: "separate" });
  const CONFIG = Object.freeze({
    socialRadius: 94,
    triggerRatePerSecond: 0.48,
    approachDurationMs: 850,
    separateDurationMs: 720,
    cooldownMinMs: 8000,
    cooldownMaxMs: 18000,
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const idOf = (baby) => baby?.emotionData?.id || baby?.id;

  function createProfile() {
    return {
      socialPartnerId: null,
      socialState: STATES.IDLE,
      socialCooldownUntil: 0,
      socialStartTime: 0,
      socialInteractionType: null,
      phaseEndsAt: 0,
      interactionEndsAt: 0,
      leaderId: null,
      lastSocialType: "none",
      memory: { lastPartnerId: null, lastType: "none", familiarity: Object.create(null) },
    };
  }

  function familiarity(profile, partnerId) {
    return profile.memory.familiarity[partnerId] || 0;
  }

  function isSleeping(baby) {
    return ["sleepy", "sleeping"].includes(baby?.emotionData?.emotion?.current);
  }

  function eligible(baby, now, directIds) {
    if (!baby?.detached || !baby.social || !baby.behavior || isSleeping(baby)) return false;
    if (directIds?.has(idOf(baby))) return false;
    if (baby.social.socialPartnerId || now < baby.social.socialCooldownUntil) return false;
    return baby.behavior.state === "wander";
  }

  function weightedType(a, b, random = Math.random) {
    const aId = idOf(a); const bId = idOf(b);
    const familiar = (familiarity(a.social, bId) + familiarity(b.social, aId)) * 0.5;
    const weights = {
      [TYPES.GREETING]: 2.2 + (a.personality === "calm" ? 2.2 : 0) + (b.personality === "calm" ? 2.2 : 0) + familiar * 0.45,
      [TYPES.BUMP]: 1.1 + (a.personality === "playful" ? 2.3 : 0) + (b.personality === "playful" ? 2.3 : 0),
      [TYPES.SYNC]: 1.3 + (a.personality === "calm" ? 1.9 : 0) + (b.personality === "calm" ? 1.9 : 0) + familiar * 0.65,
      [TYPES.SHY_RETREAT]: (a.personality === "shy" || b.personality === "shy")
        ? 0.35 + (a.personality === "shy" ? 4.8 : 0) + (b.personality === "shy" ? 4.8 : 0) - familiar * 0.55
        : 0,
      [TYPES.PLAYFUL_ORBIT]: (a.personality === "playful" || b.personality === "playful")
        ? 0.45 + (a.personality === "playful" ? 4.6 : 0) + (b.personality === "playful" ? 4.6 : 0)
        : 0,
    };
    if (a.emotionData.emotion.current === "shy" || b.emotionData.emotion.current === "shy") weights[TYPES.SHY_RETREAT] += 1.8;
    if (a.emotionData.emotion.current === "happy" || b.emotionData.emotion.current === "happy") weights[TYPES.GREETING] += 0.8;
    const entries = Object.entries(weights).filter(([, weight]) => weight > 0).map(([type, weight]) => [type, Math.max(0.05, weight)]);
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    let cursor = random() * total;
    for (const [type, weight] of entries) {
      cursor -= weight;
      if (cursor <= 0) return type;
    }
    return TYPES.GREETING;
  }

  function durationFor(type, random = Math.random) {
    const base = {
      [TYPES.GREETING]: 2600,
      [TYPES.BUMP]: 2300,
      [TYPES.SYNC]: 3900,
      [TYPES.SHY_RETREAT]: 2200,
      [TYPES.PLAYFUL_ORBIT]: 3600,
    }[type] || 2800;
    return base + random() * 700;
  }

  function startPair(a, b, type, now, random = Math.random) {
    const aId = idOf(a); const bId = idOf(b);
    const leader = type === TYPES.SHY_RETREAT
      ? (a.personality === "shy" ? aId : bId)
      : type === TYPES.PLAYFUL_ORBIT
        ? (a.personality === "playful" ? aId : bId)
        : aId;
    const duration = durationFor(type, random);
    [a, b].forEach((baby, index) => Object.assign(baby.social, {
      socialPartnerId: index ? aId : bId,
      socialState: type === TYPES.SHY_RETREAT ? STATES.ENGAGE : STATES.APPROACH,
      socialStartTime: now,
      socialInteractionType: type,
      phaseEndsAt: now + (type === TYPES.SHY_RETREAT ? 0 : CONFIG.approachDurationMs),
      interactionEndsAt: now + duration,
      leaderId: leader,
    }));
    return { kind: "start", type, ids: [aId, bId], leaderId: leader };
  }

  function releasePair(a, b, now, random = Math.random, interrupted = false) {
    const aId = idOf(a); const bId = idOf(b);
    const type = a.social.socialInteractionType || b?.social?.socialInteractionType || "none";
    const cooldown = CONFIG.cooldownMinMs + random() * (CONFIG.cooldownMaxMs - CONFIG.cooldownMinMs);
    [[a, bId], [b, aId]].forEach(([baby, partnerId]) => {
      if (!baby?.social) return;
      if (!interrupted && partnerId) {
        baby.social.memory.familiarity[partnerId] = Math.min(12, familiarity(baby.social, partnerId) + 1);
        baby.social.memory.lastPartnerId = partnerId;
        baby.social.memory.lastType = type;
        baby.social.lastSocialType = type;
      }
      Object.assign(baby.social, {
        socialPartnerId: null,
        socialState: STATES.IDLE,
        socialCooldownUntil: now + (interrupted ? Math.min(5000, cooldown * 0.5) : cooldown),
        socialInteractionType: null,
        phaseEndsAt: 0,
        interactionEndsAt: 0,
        leaderId: null,
      });
    });
    return { kind: interrupted ? "interrupt" : "end", type, ids: [aId, bId].filter(Boolean) };
  }

  function desiredCommand(baby, partner, now) {
    const profile = baby.social;
    const dx = partner.x - baby.x;
    const dy = partner.y - baby.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / distance; const ny = dy / distance;
    const type = profile.socialInteractionType;
    const phase = (now - profile.socialStartTime) / 1000;
    const contact = baby.size + partner.size;
    let desiredX = 0; let desiredY = 0; let squash = 0; let nod = 0;

    if (profile.socialState === STATES.APPROACH) {
      const spacing = type === TYPES.BUMP ? contact * 0.88 : contact * 1.28;
      const speed = clamp((distance - spacing) * 0.42, 0, type === TYPES.BUMP ? 8 : 6);
      desiredX = nx * speed; desiredY = ny * speed;
    } else if (profile.socialState === STATES.SEPARATE) {
      desiredX = -nx * 7; desiredY = -ny * 7;
    } else if (type === TYPES.GREETING) {
      nod = Math.sin(phase * 7) * 1.8;
      desiredX = nx * clamp((distance - contact * 1.22) * 0.25, -3, 3);
      desiredY = nod;
    } else if (type === TYPES.BUMP) {
      const pulse = Math.max(0, Math.sin(phase * 8));
      desiredX = nx * clamp((distance - contact * 0.84) * 0.36, -4, 4);
      desiredY = ny * clamp((distance - contact * 0.84) * 0.36, -4, 4);
      squash = pulse * 0.16;
    } else if (type === TYPES.SYNC) {
      desiredX = nx * clamp((distance - contact * 1.48) * 0.22, -2.5, 2.5);
      desiredY = Math.sin(phase * 2.6) * 5;
      nod = Math.sin(phase * 2.6) * 1.2;
    } else if (type === TYPES.SHY_RETREAT) {
      const isLeader = idOf(baby) === profile.leaderId;
      desiredX = (isLeader ? -nx * 12 : nx * 1.5);
      desiredY = (isLeader ? -ny * 12 : ny * 1.5) - 0.8;
    } else if (type === TYPES.PLAYFUL_ORBIT) {
      const isLeader = idOf(baby) === profile.leaderId;
      if (isLeader) {
        const radial = clamp((distance - contact * 1.42) * 0.32, -5, 5);
        desiredX = -ny * 11 + nx * radial;
        desiredY = nx * 11 + ny * radial;
      } else {
        desiredX = nx * clamp((distance - contact * 1.42) * 0.15, -2, 2);
        desiredY = Math.sin(phase * 3.1) * 1.5;
      }
    }
    const ax = clamp((desiredX - baby.vx) * 2.8, -24, 24);
    const ay = clamp((desiredY - baby.vy) * 2.8, -24, 24);
    return { ax, ay, squash, nod, type, state: profile.socialState };
  }

  function tick(babies, { now = 0, dt = 1 / 60, directIds = new Set(), random = Math.random } = {}) {
    const events = [];
    const commands = new Map();
    const byId = new Map(babies.map((baby) => [idOf(baby), baby]));
    const handled = new Set();

    babies.forEach((baby) => {
      const id = idOf(baby);
      const partnerId = baby.social?.socialPartnerId;
      if (!partnerId || handled.has(id)) return;
      const partner = byId.get(partnerId);
      handled.add(id); handled.add(partnerId);
      if (!partner || directIds.has(id) || directIds.has(partnerId) || isSleeping(baby) || isSleeping(partner)) {
        events.push(releasePair(baby, partner, now, random, true));
        return;
      }
      if (now >= baby.social.interactionEndsAt) {
        if (baby.social.socialState !== STATES.SEPARATE) {
          baby.social.socialState = STATES.SEPARATE;
          partner.social.socialState = STATES.SEPARATE;
          baby.social.phaseEndsAt = now + CONFIG.separateDurationMs;
          partner.social.phaseEndsAt = baby.social.phaseEndsAt;
        } else if (now >= baby.social.phaseEndsAt) {
          events.push(releasePair(baby, partner, now, random, false));
          return;
        }
      } else if (baby.social.socialState === STATES.APPROACH && now >= baby.social.phaseEndsAt) {
        baby.social.socialState = STATES.ENGAGE;
        partner.social.socialState = STATES.ENGAGE;
        events.push({ kind: "engage", type: baby.social.socialInteractionType, ids: [id, partnerId] });
      }
      commands.set(id, desiredCommand(baby, partner, now));
      commands.set(partnerId, desiredCommand(partner, baby, now));
    });

    const candidates = babies.filter((baby) => eligible(baby, now, directIds));
    let best = null;
    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const a = candidates[i]; const b = candidates[j];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const radius = CONFIG.socialRadius + (a.size + b.size) * 0.25;
        if (distance > radius) continue;
        const score = distance - (familiarity(a.social, idOf(b)) + familiarity(b.social, idOf(a))) * 2;
        if (!best || score < best.score) best = { a, b, score };
      }
    }
    if (best) {
      const probability = 1 - Math.exp(-CONFIG.triggerRatePerSecond * clamp(dt, 0, 0.1));
      if (random() < probability) {
        const type = weightedType(best.a, best.b, random);
        events.push(startPair(best.a, best.b, type, now, random));
      }
    }
    return { events, commands };
  }

  function interrupt(babies, babyId, now, random = Math.random) {
    const baby = babies.find((item) => idOf(item) === babyId);
    if (!baby?.social?.socialPartnerId) return null;
    const partner = babies.find((item) => idOf(item) === baby.social.socialPartnerId);
    return releasePair(baby, partner, now, random, true);
  }

  return { TYPES, STATES, CONFIG, createProfile, familiarity, eligible, weightedType, startPair, releasePair, desiredCommand, tick, interrupt };
});
