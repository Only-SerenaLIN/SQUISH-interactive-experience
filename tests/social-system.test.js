const test = require("node:test");
const assert = require("node:assert/strict");
const Social = require("../web/social-system.js");

function baby(id, personality, x = 0, y = 0) {
  return {
    x, y, vx: 0, vy: 0, size: 22, detached: true, personality,
    behavior: { state: "wander" },
    emotionData: { id, emotion: { current: "neutral" } },
    social: Social.createProfile(),
  };
}

test("a pair locks both jellyfish and never allows a second partner", () => {
  const a = baby("A", "calm"); const b = baby("B", "calm", 40); const c = baby("C", "playful", 42);
  Social.startPair(a, b, Social.TYPES.GREETING, 100, () => 0);
  const result = Social.tick([a, b, c], { now: 120, dt: 1, random: () => 0 });
  assert.equal(a.social.socialPartnerId, "B");
  assert.equal(b.social.socialPartnerId, "A");
  assert.equal(c.social.socialPartnerId, null);
  assert.equal(result.events.filter((event) => event.kind === "start").length, 0);
});

test("calm pairs weight greeting and synchronized floating", () => {
  const a = baby("A", "calm"); const b = baby("B", "calm", 40);
  assert.equal(Social.weightedType(a, b, () => 0), Social.TYPES.GREETING);
  a.social.memory.familiarity.B = 8;
  b.social.memory.familiarity.A = 8;
  const types = new Set([Social.weightedType(a, b, () => 0.2), Social.weightedType(a, b, () => 0.55)]);
  assert.ok(types.has(Social.TYPES.GREETING) || types.has(Social.TYPES.SYNC));
});

test("shy retreat moves the shy leader away", () => {
  const shy = baby("S", "shy", 0); const calm = baby("C", "calm", 40);
  Social.startPair(shy, calm, Social.TYPES.SHY_RETREAT, 0, () => 0);
  const command = Social.desiredCommand(shy, calm, 300);
  assert.ok(command.ax < 0);
});

test("playful orbit creates tangential movement", () => {
  const playful = baby("P", "playful", 0); const calm = baby("C", "calm", 50);
  Social.startPair(playful, calm, Social.TYPES.PLAYFUL_ORBIT, 0, () => 0);
  playful.social.socialState = Social.STATES.ENGAGE;
  const command = Social.desiredCommand(playful, calm, 1000);
  assert.ok(Math.abs(command.ay) > Math.abs(command.ax));
});

test("gentle bump produces limited squash and no high-speed collision", () => {
  const a = baby("A", "playful"); const b = baby("B", "calm", 40);
  Social.startPair(a, b, Social.TYPES.BUMP, 0, () => 0);
  a.social.socialState = Social.STATES.ENGAGE;
  const command = Social.desiredCommand(a, b, 200);
  assert.ok(command.squash >= 0 && command.squash <= 0.16);
  assert.ok(Math.hypot(command.ax, command.ay) <= 34);
});

test("synchronized floating gives both partners matching vertical rhythm", () => {
  const a = baby("A", "calm"); const b = baby("B", "calm", 55);
  Social.startPair(a, b, Social.TYPES.SYNC, 0, () => 0);
  a.social.socialState = b.social.socialState = Social.STATES.ENGAGE;
  const first = Social.desiredCommand(a, b, 900);
  const second = Social.desiredCommand(b, a, 900);
  assert.equal(Math.sign(first.nod), Math.sign(second.nod));
});

test("direct player interaction interrupts and unlocks both partners", () => {
  const a = baby("A", "calm"); const b = baby("B", "playful", 40);
  Social.startPair(a, b, Social.TYPES.GREETING, 0, () => 0);
  const result = Social.tick([a, b], { now: 300, directIds: new Set(["A"]), random: () => 0 });
  assert.equal(result.events[0].kind, "interrupt");
  assert.equal(a.social.socialPartnerId, null);
  assert.equal(b.social.socialPartnerId, null);
});

test("sleeping and cooldown jellyfish are not eligible", () => {
  const a = baby("A", "calm");
  a.emotionData.emotion.current = "sleeping";
  assert.equal(Social.eligible(a, 100, new Set()), false);
  a.emotionData.emotion.current = "neutral";
  a.social.socialCooldownUntil = 1000;
  assert.equal(Social.eligible(a, 100, new Set()), false);
});

test("completed interaction records familiarity and a cooldown", () => {
  const a = baby("A", "calm"); const b = baby("B", "calm", 40);
  Social.startPair(a, b, Social.TYPES.GREETING, 0, () => 0);
  Social.releasePair(a, b, 3000, () => 0, false);
  assert.equal(Social.familiarity(a.social, "B"), 1);
  assert.equal(a.social.memory.lastType, Social.TYPES.GREETING);
  assert.equal(a.social.socialCooldownUntil, 11000);
});

test("missing partner safely releases the remaining jellyfish", () => {
  const a = baby("A", "calm"); const b = baby("B", "calm", 40);
  Social.startPair(a, b, Social.TYPES.GREETING, 0, () => 0);
  const result = Social.tick([a], { now: 200, random: () => 0 });
  assert.equal(result.events[0].kind, "interrupt");
  assert.equal(a.social.socialPartnerId, null);
});
