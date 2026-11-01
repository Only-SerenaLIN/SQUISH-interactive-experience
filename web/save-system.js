(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SquishSave = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "squish.save.v1";
  const BACKUP_KEY = "squish.save.backup.v1";
  const PATTERNS = Object.freeze(["ripple", "petal", "stardust", "moon"]);
  const PERSONALITIES = Object.freeze(["calm", "shy", "playful"]);
  const COLOR_NAMES = Object.freeze(["潮汐蓝", "梦境紫", "珊瑚粉", "薄荷青", "月光杏"]);
  const PATTERN_NAMES = Object.freeze({ ripple: "水纹", petal: "花瓣", stardust: "星尘", moon: "月牙" });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
  const unique = (items) => [...new Set((items || []).filter((item) => typeof item === "string" && item.length))];
  const cleanText = (value, fallback = "") => String(value ?? fallback).replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 24) || fallback;

  function combinationKey(colorIndex, pattern, personality) {
    return `${clamp(colorIndex, 0, COLOR_NAMES.length - 1)}:${PATTERNS.includes(pattern) ? pattern : PATTERNS[0]}:${PERSONALITIES.includes(personality) ? personality : "calm"}`;
  }

  function createDefault(now = new Date().toISOString()) {
    return {
      version: VERSION,
      savedAt: now,
      world: { count: 0, babies: [] },
      collection: { colors: [], patterns: [], personalities: [], combinations: [] },
      settings: {
        soundOn: true,
        preferredInputMode: "mouse",
        tutorialCompleted: false,
        tutorialCurrentStep: "INPUT_SELECTION",
      },
    };
  }

  function sanitizeMemory(memory = {}) {
    return {
      lastInteractionType: cleanText(memory.lastInteractionType, "none"),
      lastInteractionAt: clamp(memory.lastInteractionAt, 0, Number.MAX_SAFE_INTEGER),
      lastInteractionIntensity: clamp(memory.lastInteractionIntensity, 0, 1),
      lastScaredAt: clamp(memory.lastScaredAt, -1, Number.MAX_SAFE_INTEGER),
      gentleInteractionCount: clamp(memory.gentleInteractionCount, 0, 100000),
      totalInteractions: clamp(memory.totalInteractions, 0, 100000),
    };
  }

  function sanitizeSocialMemory(memory = {}) {
    const familiarity = {};
    if (memory.familiarity && typeof memory.familiarity === "object") {
      Object.entries(memory.familiarity).slice(0, 64).forEach(([id, value]) => {
        const safeId = cleanText(id);
        if (safeId) familiarity[safeId] = clamp(value, 0, 12);
      });
    }
    return {
      lastPartnerId: memory.lastPartnerId ? cleanText(memory.lastPartnerId) : null,
      lastType: cleanText(memory.lastType, "none"),
      familiarity,
    };
  }

  function sanitizeBaby(baby = {}, index = 0) {
    const id = cleanText(baby.id, `J-${String(index + 1).padStart(2, "0")}`);
    const colorIndex = Math.round(clamp(baby.colorIndex ?? baby.hue, 0, COLOR_NAMES.length - 1));
    const pattern = PATTERNS.includes(baby.pattern) ? baby.pattern : PATTERNS[index % PATTERNS.length];
    const personality = PERSONALITIES.includes(baby.personality) ? baby.personality : PERSONALITIES[index % PERSONALITIES.length];
    const stats = baby.stats || {};
    return {
      id,
      nickname: cleanText(baby.nickname, `小水母 ${index + 1}`),
      colorIndex,
      pattern,
      personality,
      bornAt: Number.isFinite(Date.parse(baby.bornAt)) ? new Date(baby.bornAt).toISOString() : new Date().toISOString(),
      size: clamp(baby.size, 14, 42),
      strength: clamp(baby.strength, 0.1, 1),
      emotion: ["neutral", "happy", "shy", "surprised", "dizzy", "sleepy", "sleeping"].includes(baby.emotion) ? baby.emotion : "neutral",
      stats: {
        happiness: clamp(stats.happiness, 0, 100),
        trust: clamp(stats.trust, 0, 100),
        curiosity: clamp(stats.curiosity, 0, 100),
        energy: clamp(stats.energy, 0, 100),
        stress: clamp(stats.stress, 0, 100),
      },
      memory: sanitizeMemory(baby.memory),
      socialMemory: sanitizeSocialMemory(baby.socialMemory),
    };
  }

  function normalize(input) {
    const source = input && typeof input === "object" ? input : {};
    if (Number(source.version) !== VERSION) throw new Error(`Unsupported save version: ${source.version}`);
    if (!source.world || !Array.isArray(source.world.babies)) throw new Error("Save is missing world.babies");
    const babies = source.world.babies.slice(0, 12).map(sanitizeBaby);
    const ids = babies.map((baby) => baby.id);
    if (new Set(ids).size !== ids.length) throw new Error("Jellyfish IDs must be unique");
    const collection = source.collection && typeof source.collection === "object" ? source.collection : {};
    const normalized = {
      version: VERSION,
      savedAt: Number.isFinite(Date.parse(source.savedAt)) ? new Date(source.savedAt).toISOString() : new Date().toISOString(),
      world: { count: Math.max(babies.length, Math.round(clamp(source.world.count, 0, 100000))), babies },
      collection: {
        colors: unique(collection.colors).filter((value) => /^\d+$/.test(value) && Number(value) < COLOR_NAMES.length),
        patterns: unique(collection.patterns).filter((value) => PATTERNS.includes(value)),
        personalities: unique(collection.personalities).filter((value) => PERSONALITIES.includes(value)),
        combinations: unique(collection.combinations).filter((value) => /^\d+:(ripple|petal|stardust|moon):(calm|shy|playful)$/.test(value)),
      },
      settings: {
        soundOn: source.settings?.soundOn !== false,
        preferredInputMode: source.settings?.preferredInputMode === "gesture" ? "gesture" : "mouse",
        tutorialCompleted: Boolean(source.settings?.tutorialCompleted),
        tutorialCurrentStep: cleanText(source.settings?.tutorialCurrentStep, "INPUT_SELECTION"),
      },
    };
    babies.forEach((baby) => registerDiscovery(normalized.collection, baby));
    return normalized;
  }

  function validate(input) {
    try { return { ok: true, data: normalize(input), errors: [] }; }
    catch (error) { return { ok: false, data: null, errors: [error.message] }; }
  }

  function registerDiscovery(collection, baby) {
    const before = JSON.stringify(collection);
    collection.colors = unique([...(collection.colors || []), String(baby.colorIndex)]);
    collection.patterns = unique([...(collection.patterns || []), baby.pattern]);
    collection.personalities = unique([...(collection.personalities || []), baby.personality]);
    collection.combinations = unique([...(collection.combinations || []), combinationKey(baby.colorIndex, baby.pattern, baby.personality)]);
    return before !== JSON.stringify(collection);
  }

  function parseStored(raw) {
    if (!raw) return { ok: false, missing: true, data: null, errors: [] };
    try { return validate(JSON.parse(raw)); }
    catch (error) { return { ok: false, missing: false, data: null, errors: ["Save JSON is damaged"] }; }
  }

  function load(storage) {
    const current = parseStored(storage.getItem(STORAGE_KEY));
    if (current.ok) return { status: "ok", data: current.data, backup: null, errors: [] };
    if (current.missing) return { status: "new", data: createDefault(), backup: null, errors: [] };
    const backup = parseStored(storage.getItem(BACKUP_KEY));
    return { status: "corrupt", data: createDefault(), backup: backup.ok ? backup.data : null, errors: current.errors };
  }

  function write(storage, save) {
    const normalized = normalize({ ...save, savedAt: new Date().toISOString() });
    const current = storage.getItem(STORAGE_KEY);
    if (current && parseStored(current).ok) storage.setItem(BACKUP_KEY, current);
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function importJson(text) {
    try {
      const parsed = JSON.parse(text);
      const result = validate(parsed);
      if (!result.ok) return result;
      return { ok: true, data: result.data, errors: [] };
    } catch (error) {
      return { ok: false, data: null, errors: ["Import file is not valid JSON"] };
    }
  }

  function exportJson(save) {
    return JSON.stringify(normalize(save), null, 2);
  }

  return {
    VERSION, STORAGE_KEY, BACKUP_KEY, PATTERNS, PERSONALITIES, COLOR_NAMES, PATTERN_NAMES,
    combinationKey, createDefault, sanitizeBaby, normalize, validate, registerDiscovery,
    load, write, importJson, exportJson, cleanText,
  };
});
