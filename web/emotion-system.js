(function attachSquishEmotion(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SquishEmotion = api;
})(typeof window !== "undefined" ? window : globalThis, function createEmotionSystem() {
  "use strict";

  const PERSONALITIES = Object.freeze({
    CALM: "calm",
    SHY: "shy",
    PLAYFUL: "playful",
  });

  const EMOTIONS = Object.freeze({
    NEUTRAL: "neutral",
    HAPPY: "happy",
    SHY: "shy",
    SURPRISED: "surprised",
    DIZZY: "dizzy",
    SLEEPY: "sleepy",
    SLEEPING: "sleeping",
  });

  const PRIORITY = Object.freeze({
    neutral: 0,
    happy: 30,
    sleepy: 35,
    shy: 45,
    dizzy: 65,
    surprised: 75,
    sleeping: 20,
  });

  const STAT_NAMES = ["happiness", "trust", "curiosity", "energy", "stress"];

  function clampStat(value) {
    return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  }

  function normalizePersonality(value) {
    return Object.values(PERSONALITIES).includes(value) ? value : PERSONALITIES.CALM;
  }

  function createProfile({ id, personality, now = 0, random = Math.random } = {}) {
    const kind = normalizePersonality(personality);
    const bases = {
      calm: { happiness: 58, trust: 42, curiosity: 48, energy: 72, stress: 18 },
      shy: { happiness: 48, trust: 24, curiosity: 42, energy: 66, stress: 34 },
      playful: { happiness: 68, trust: 36, curiosity: 72, energy: 86, stress: 16 },
    }[kind];
    return {
      id: id || `jelly-${Math.random().toString(36).slice(2, 8)}`,
      personality: kind,
      stats: { ...bases },
      emotion: {
        current: EMOTIONS.NEUTRAL,
        startedAt: now,
        until: 0,
        priority: PRIORITY.neutral,
      },
      memory: {
        lastInteractionType: "none",
        lastInteractionAt: now,
        lastInteractionIntensity: 0,
        lastScaredAt: -Infinity,
        gentleInteractionCount: 0,
        totalInteractions: 0,
      },
      cooldowns: Object.create(null),
      restDelayMs: 18000 + random() * 10000,
      lastUpdateAt: now,
    };
  }

  function changeStats(profile, delta = {}) {
    STAT_NAMES.forEach((name) => {
      if (delta[name] === undefined) return;
      profile.stats[name] = clampStat(profile.stats[name] + delta[name]);
    });
    return profile.stats;
  }

  function setEmotion(profile, emotion, now, durationMs = 1400, force = false) {
    const nextPriority = PRIORITY[emotion] ?? 0;
    const currentActive = profile.emotion.until === Infinity || now < profile.emotion.until;
    if (!force && currentActive && nextPriority < profile.emotion.priority) return false;
    profile.emotion.current = emotion;
    profile.emotion.startedAt = now;
    profile.emotion.until = durationMs === Infinity ? Infinity : now + Math.max(0, durationMs);
    profile.emotion.priority = nextPriority;
    return true;
  }

  function cooldownReady(profile, key, now, durationMs) {
    if ((profile.cooldowns[key] || 0) > now) return false;
    profile.cooldowns[key] = now + durationMs;
    return true;
  }

  function recordMemory(profile, type, intensity, now) {
    profile.memory.lastInteractionType = type;
    profile.memory.lastInteractionAt = now;
    profile.memory.lastInteractionIntensity = Math.max(0, Math.min(1, intensity || 0));
    profile.memory.totalInteractions += 1;
  }

  function wakeIfSleeping(profile, now) {
    if (profile.emotion.current !== EMOTIONS.SLEEPING && profile.emotion.current !== EMOTIONS.SLEEPY) return false;
    changeStats(profile, { energy: 5 });
    setEmotion(profile, EMOTIONS.SURPRISED, now, 1100, true);
    return true;
  }

  function interact(profile, type, options = {}) {
    const now = options.now ?? 0;
    const intensity = Math.max(0, Math.min(1, options.intensity ?? 0.4));
    const durationMs = Math.max(0, options.durationMs || 0);
    const random = options.random || Math.random;
    const woke = wakeIfSleeping(profile, now);
    const cooldown = type === "hold" ? 700 : type === "sudden" ? 550 : 320;
    if (!cooldownReady(profile, type, now, cooldown)) return { applied: false, woke };
    recordMemory(profile, type, intensity, now);

    if (type === "touch") {
      changeStats(profile, { happiness: 5, trust: 2 });
      profile.memory.gentleInteractionCount += 1;
      if (!woke) {
        const response = profile.personality === PERSONALITIES.SHY && profile.stats.trust < 40
          ? EMOTIONS.SHY
          : EMOTIONS.HAPPY;
        setEmotion(profile, response, now, 1500, true);
      }
    } else if (type === "squeeze") {
      changeStats(profile, { happiness: 3, curiosity: 2 });
      profile.memory.gentleInteractionCount += 1;
      const dizzyChance = Math.max(0, intensity - 0.55) * 0.75 + Math.max(0, durationMs - 900) / 4200;
      setEmotion(profile, random() < dizzyChance ? EMOTIONS.DIZZY : EMOTIONS.HAPPY, now, 1700, true);
    } else if (type === "hold") {
      changeStats(profile, { energy: -3.5 - intensity * 2, stress: intensity > 0.75 ? 1 : 0 });
      const dizzyChance = 0.22 + intensity * 0.38 + Math.max(0, durationMs - 1200) / 5000;
      if (random() < dizzyChance) setEmotion(profile, EMOTIONS.DIZZY, now, 2100, true);
    } else if (type === "sudden") {
      const shyBoost = profile.personality === PERSONALITIES.SHY ? 4 : 0;
      changeStats(profile, { stress: 8 + shyBoost, curiosity: -1 });
      profile.memory.lastScaredAt = now;
      setEmotion(profile, EMOTIONS.SURPRISED, now, profile.personality === PERSONALITIES.SHY ? 1900 : 1350, true);
    } else if (type === "bubble") {
      changeStats(profile, { happiness: 1, curiosity: 3 });
      setEmotion(profile, EMOTIONS.SURPRISED, now, 900, true);
    }

    return { applied: true, woke, emotion: profile.emotion.current };
  }

  function shyFleeProbability(profile) {
    if (profile.personality !== PERSONALITIES.SHY) return profile.personality === PERSONALITIES.PLAYFUL ? 0.12 : 0.28;
    const familiarity = profile.memory.gentleInteractionCount * 0.055 + profile.stats.trust * 0.006;
    return Math.max(0.16, Math.min(0.92, 0.94 - familiarity));
  }

  function update(profile, dt, now, options = {}) {
    const seconds = Math.max(0, Math.min(0.25, dt || 0));
    const interacting = Boolean(options.interacting);
    const idleMs = Math.max(0, now - profile.memory.lastInteractionAt);
    if (!interacting && idleMs > 2500) {
      changeStats(profile, { stress: -0.42 * seconds, energy: 0.34 * seconds });
    }

    if (!interacting && idleMs >= profile.restDelayMs && profile.emotion.current === EMOTIONS.SLEEPY && now - profile.emotion.startedAt >= 5600) {
      setEmotion(profile, EMOTIONS.SLEEPING, now, Infinity, true);
    } else {
      if (profile.emotion.current !== EMOTIONS.SLEEPING && profile.emotion.until !== Infinity && now >= profile.emotion.until) {
        setEmotion(profile, EMOTIONS.NEUTRAL, now, 0, true);
      }
      if (!interacting && idleMs >= profile.restDelayMs && profile.emotion.current === EMOTIONS.NEUTRAL) {
        setEmotion(profile, EMOTIONS.SLEEPY, now, 6200, true);
      }
    }

    profile.lastUpdateAt = now;
    return profile.emotion.current;
  }

  function snapshot(profile) {
    return {
      id: profile.id,
      personality: profile.personality,
      emotion: profile.emotion.current,
      happiness: Math.round(profile.stats.happiness),
      trust: Math.round(profile.stats.trust),
      curiosity: Math.round(profile.stats.curiosity),
      energy: Math.round(profile.stats.energy),
      stress: Math.round(profile.stats.stress),
      lastInteraction: profile.memory.lastInteractionType,
      gentleInteractions: profile.memory.gentleInteractionCount,
      fleeProbability: shyFleeProbability(profile),
    };
  }

  return {
    PERSONALITIES,
    EMOTIONS,
    clampStat,
    createProfile,
    changeStats,
    setEmotion,
    interact,
    update,
    shyFleeProbability,
    snapshot,
  };
});
