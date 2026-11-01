const test = require("node:test");
const assert = require("node:assert/strict");
const Save = require("../web/save-system.js");

function storage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key), map };
}

function sampleBaby(overrides = {}) {
  return {
    id: "J-01", nickname: "泡泡", colorIndex: 2, pattern: "petal", personality: "shy",
    bornAt: "2026-11-01T08:00:00.000Z", size: 24, strength: 0.6, emotion: "happy",
    stats: { happiness: 70, trust: 45, curiosity: 50, energy: 66, stress: 12 },
    memory: { lastInteractionType: "touch", lastInteractionAt: 1200, gentleInteractionCount: 3, totalInteractions: 4 },
    socialMemory: { lastPartnerId: "J-02", lastType: "greeting", familiarity: { "J-02": 2 } },
    ...overrides,
  };
}

test("default save is versioned and valid", () => {
  const save = Save.createDefault("2026-11-01T00:00:00.000Z");
  assert.equal(save.version, 1);
  assert.equal(Save.validate(save).ok, true);
});

test("baby identity, stats, and memories survive normalization", () => {
  const save = Save.createDefault();
  save.world = { count: 1, babies: [sampleBaby()] };
  const result = Save.normalize(save).world.babies[0];
  assert.equal(result.id, "J-01");
  assert.equal(result.nickname, "泡泡");
  assert.equal(result.stats.trust, 45);
  assert.equal(result.memory.gentleInteractionCount, 3);
  assert.equal(result.socialMemory.familiarity["J-02"], 2);
});

test("stats are clamped and unsafe nickname markup is removed", () => {
  const baby = Save.sanitizeBaby(sampleBaby({ nickname: "<b>月亮</b>", stats: { happiness: 200, trust: -5 } }));
  assert.equal(baby.nickname.includes("<"), false);
  assert.equal(baby.stats.happiness, 100);
  assert.equal(baby.stats.trust, 0);
});

test("discoveries distinguish colors, patterns, personalities, and combinations", () => {
  const collection = Save.createDefault().collection;
  assert.equal(Save.registerDiscovery(collection, sampleBaby()), true);
  assert.deepEqual(collection.colors, ["2"]);
  assert.deepEqual(collection.patterns, ["petal"]);
  assert.deepEqual(collection.personalities, ["shy"]);
  assert.deepEqual(collection.combinations, ["2:petal:shy"]);
  assert.equal(Save.registerDiscovery(collection, sampleBaby()), false);
});

test("historical collection records remain without an owned baby", () => {
  const save = Save.createDefault();
  save.collection.combinations.push("4:moon:calm");
  const normalized = Save.normalize(save);
  assert.equal(normalized.world.babies.length, 0);
  assert.ok(normalized.collection.combinations.includes("4:moon:calm"));
});

test("write creates a backup of the previous valid save", () => {
  const memory = storage();
  let save = Save.write(memory, Save.createDefault());
  save.world = { count: 1, babies: [sampleBaby()] };
  Save.write(memory, save);
  assert.ok(memory.getItem(Save.BACKUP_KEY));
  assert.equal(Save.load(memory).data.world.babies.length, 1);
});

test("exported JSON can be imported without data loss", () => {
  const save = Save.createDefault();
  save.world = { count: 1, babies: [sampleBaby()] };
  const imported = Save.importJson(Save.exportJson(save));
  assert.equal(imported.ok, true);
  assert.equal(imported.data.world.babies[0].nickname, "泡泡");
});

test("damaged current save offers a valid backup instead of throwing", () => {
  const backup = Save.createDefault();
  backup.world = { count: 1, babies: [sampleBaby()] };
  const memory = storage({ [Save.STORAGE_KEY]: "{broken", [Save.BACKUP_KEY]: JSON.stringify(backup) });
  const loaded = Save.load(memory);
  assert.equal(loaded.status, "corrupt");
  assert.equal(loaded.backup.world.babies[0].id, "J-01");
});

test("unsupported versions and duplicate IDs are rejected", () => {
  assert.equal(Save.validate({ version: 99, world: { babies: [] } }).ok, false);
  const save = Save.createDefault();
  save.world.babies = [sampleBaby(), sampleBaby()];
  assert.equal(Save.validate(save).ok, false);
});

test("invalid import does not produce a save", () => {
  assert.equal(Save.importJson("not json").ok, false);
  assert.equal(Save.importJson(JSON.stringify({ version: 1 })).ok, false);
});
