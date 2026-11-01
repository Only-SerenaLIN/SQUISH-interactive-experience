const test = require("node:test");
const assert = require("node:assert/strict");
const Behavior = require("../web/behavior-system.js");

const baby = (x = 0, y = 0) => ({ x, y, vx: 0, vy: 0, size: 24, detached: true });
const pointer = (x, y, speed = 0) => ({ position: { x, y }, velocity: { x: speed, y: 0 }, speed, isActive: true, inputMode: "mouse" });

test("mouse and camera samples share the same world pointer model", () => {
  const mouse = Behavior.createPointerState();
  const camera = Behavior.createPointerState();
  Behavior.updatePointer(mouse, { x: 180, y: 90, inputMode: "mouse" }, 1 / 60, 1);
  Behavior.updatePointer(camera, { x: 180, y: 90, inputMode: "camera" }, 1 / 60, 1);
  assert.deepEqual(mouse.position, camera.position);
  assert.equal(mouse.inputMode, "mouse");
  assert.equal(camera.inputMode, "camera");
});

test("calm jellyfish follows slow motion but only reacts to a fast approach", () => {
  const profile = Behavior.createProfile({ personality: "calm", size: 24, random: () => 0 });
  let result = Behavior.decide(profile, { personality: "calm", pointer: pointer(90, 0, 80), baby: baby(), now: 1000 });
  assert.equal(result.state, Behavior.STATES.FOLLOW);
  result = Behavior.decide(profile, { personality: "calm", pointer: pointer(60, 0, 800), baby: baby(), now: 2000 });
  assert.equal(result.state, Behavior.STATES.REACT);
  assert.notEqual(result.state, Behavior.STATES.FLEE);
});

test("shy jellyfish flees at low trust and can approach at high trust", () => {
  const low = Behavior.createProfile({ personality: "shy", random: () => 0 });
  const lowResult = Behavior.decide(low, { personality: "shy", trust: 12, stress: 70, fleeProbability: 0.8, pointer: pointer(42, 0, 700), baby: baby(), now: 1000, random: () => 0 });
  assert.equal(lowResult.state, Behavior.STATES.FLEE);
  const high = Behavior.createProfile({ personality: "shy", random: () => 0 });
  const highResult = Behavior.decide(high, { personality: "shy", trust: 92, stress: 2, fleeProbability: 0.04, pointer: pointer(85, 0, 50), baby: baby(), now: 1000, random: () => 0.9 });
  assert.equal(highResult.state, Behavior.STATES.FOLLOW);
});

test("playful orbit is timed and never permanent", () => {
  const profile = Behavior.createProfile({ personality: "playful", random: () => 0 });
  let result = Behavior.decide(profile, { personality: "playful", pointer: pointer(48, 0, 20), baby: baby(), now: 1000, random: () => 0 });
  assert.equal(result.state, Behavior.STATES.ORBIT);
  result = Behavior.decide(profile, { personality: "playful", pointer: pointer(48, 0, 20), baby: baby(), now: profile.orbitUntil + 1, random: () => 0.9 });
  assert.notEqual(result.state, Behavior.STATES.ORBIT);
});

test("direct interaction, recovery, and sleep override autonomous follow", () => {
  const profile = Behavior.createProfile({ personality: "calm" });
  assert.equal(Behavior.decide(profile, { personality: "calm", pointer: pointer(80, 0), baby: baby(), now: 100, directInteraction: true }).state, Behavior.STATES.REACT);
  Behavior.beginRecover(profile, 200, 900);
  assert.equal(Behavior.decide(profile, { personality: "calm", pointer: pointer(80, 0), baby: baby(), now: 500 }).state, Behavior.STATES.RECOVER);
  assert.equal(Behavior.decide(profile, { personality: "calm", emotion: "sleeping", pointer: pointer(20, 0), baby: baby(), now: 600 }).state, Behavior.STATES.SLEEP);
});

test("steering respects acceleration cap and separation pushes neighbors apart", () => {
  const profile = Behavior.createProfile({ personality: "playful" });
  profile.state = Behavior.STATES.FOLLOW;
  const force = Behavior.steering(profile, baby(), pointer(100, 0));
  assert.ok(Math.hypot(force.x, force.y) <= profile.maxAcceleration + 1e-9);
  const a = baby(0, 0);
  const b = baby(10, 0);
  const separation = Behavior.separation(a, [a, b]);
  assert.ok(separation.x < 0);
  assert.ok(Math.hypot(separation.x, separation.y) <= 28 + 1e-9);
});

test("inactive pointer returns autonomous behavior", () => {
  const profile = Behavior.createProfile({ personality: "playful" });
  const inactive = pointer(20, 0);
  inactive.isActive = false;
  assert.equal(Behavior.decide(profile, { personality: "playful", pointer: inactive, baby: baby(), now: 10 }).state, Behavior.STATES.WANDER);
});
