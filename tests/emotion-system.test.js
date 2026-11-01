const test = require("node:test");
const assert = require("node:assert/strict");
const Emotion = require("../web/emotion-system.js");

test("profiles own independent mutable state", () => {
  const a = Emotion.createProfile({ id: "a", personality: "calm", now: 0, random: () => 0 });
  const b = Emotion.createProfile({ id: "b", personality: "shy", now: 0, random: () => 0 });
  Emotion.interact(a, "touch", { now: 1000 });
  assert.equal(a.stats.trust, 44);
  assert.equal(b.stats.trust, 24);
  assert.notEqual(a.stats, b.stats);
  assert.notEqual(a.memory, b.memory);
});

test("gentle touch applies exact changes and remembers it", () => {
  const profile = Emotion.createProfile({ personality: "calm", now: 0, random: () => 0 });
  Emotion.interact(profile, "touch", { now: 1000, intensity: 0.2 });
  assert.equal(profile.stats.happiness, 63);
  assert.equal(profile.stats.trust, 44);
  assert.equal(profile.memory.lastInteractionType, "touch");
  assert.equal(profile.memory.gentleInteractionCount, 1);
  assert.equal(profile.emotion.current, "happy");
});

test("sudden approach raises stress and shy response is stronger", () => {
  const calm = Emotion.createProfile({ personality: "calm", now: 0, random: () => 0 });
  const shy = Emotion.createProfile({ personality: "shy", now: 0, random: () => 0 });
  Emotion.interact(calm, "sudden", { now: 1000 });
  Emotion.interact(shy, "sudden", { now: 1000 });
  assert.equal(calm.stats.stress, 26);
  assert.equal(shy.stats.stress, 46);
  assert.equal(shy.memory.lastScaredAt, 1000);
  assert.equal(shy.emotion.current, "surprised");
});

test("gentle history lowers a shy jellyfish flee probability", () => {
  const profile = Emotion.createProfile({ personality: "shy", now: 0, random: () => 0 });
  const before = Emotion.shyFleeProbability(profile);
  for (let index = 0; index < 7; index += 1) {
    Emotion.interact(profile, "touch", { now: 1000 + index * 400 });
  }
  assert.ok(Emotion.shyFleeProbability(profile) < before);
});

test("long hold drains energy with cooldown instead of every frame", () => {
  const profile = Emotion.createProfile({ personality: "playful", now: 0, random: () => 1 });
  Emotion.interact(profile, "hold", { now: 1000, intensity: 0.8, durationMs: 1500, random: () => 1 });
  const afterFirst = profile.stats.energy;
  const second = Emotion.interact(profile, "hold", { now: 1100, intensity: 0.8, durationMs: 1600, random: () => 1 });
  assert.equal(second.applied, false);
  assert.equal(profile.stats.energy, afterFirst);
});

test("idle jellyfish becomes sleepy, sleeps, and touch wakes it", () => {
  const profile = Emotion.createProfile({ personality: "calm", now: 0, random: () => 0 });
  Emotion.update(profile, 0.016, 18000, { interacting: false });
  assert.equal(profile.emotion.current, "sleepy");
  Emotion.update(profile, 0.016, 24000, { interacting: false });
  assert.equal(profile.emotion.current, "sleeping");
  const result = Emotion.interact(profile, "touch", { now: 25000 });
  assert.equal(result.woke, true);
  assert.equal(profile.emotion.current, "surprised");
});

test("all stats remain within zero to one hundred", () => {
  const profile = Emotion.createProfile({ personality: "calm", now: 0, random: () => 0 });
  Emotion.changeStats(profile, { happiness: 1000, trust: -1000, curiosity: 1000, energy: -1000, stress: 1000 });
  Object.values(profile.stats).forEach((value) => assert.ok(value >= 0 && value <= 100));
});

test("a lower priority expression cannot flicker over surprise", () => {
  const profile = Emotion.createProfile({ personality: "calm", now: 0, random: () => 0 });
  Emotion.setEmotion(profile, "surprised", 1000, 1500, true);
  assert.equal(Emotion.setEmotion(profile, "happy", 1100, 1000), false);
  assert.equal(profile.emotion.current, "surprised");
  Emotion.update(profile, 0.016, 2600, { interacting: false });
  assert.equal(profile.emotion.current, "neutral");
});
