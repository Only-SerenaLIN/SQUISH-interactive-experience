"""Pygame application for SQUISH!."""

from __future__ import annotations

import argparse
import array
import math
import random
import sys
from dataclasses import dataclass

import pygame

from .camera import HandCamera
from .gesture import SpringValue, breathing_phase, clamp, is_pull_apart_tear, pressure_band


WIDTH, HEIGHT = 1000, 700
FPS = 60
BG = (247, 241, 255)
INK = (46, 35, 61)
PURPLE = (117, 82, 255)
PINK = (255, 104, 166)
MINT = (86, 218, 182)
RIPPLE_COLORS = ((69, 190, 220), (137, 104, 225), (244, 119, 174))

RAMEN_FLAVORS = (
    ("VOLCANO KIMCHI", (255, 91, 68), (255, 190, 61)),
    ("MIDNIGHT CHEESE", (118, 82, 224), (255, 203, 72)),
    ("CYBER APPLE", (114, 205, 70), (52, 157, 113)),
    ("SHRIMP STATIC", (48, 190, 207), (255, 116, 145)),
)

RAMEN_REWARDS = (
    ("CLASSIC CRUNCH", "classic"),
    ("DOUBLE NOODLES!", "double"),
    ("SEASONING STORM!", "seasoning"),
    ("WHO ATE THE NOODLES?", "empty"),
    ("GOLDEN NOODLE!", "golden"),
    ("CYBER APPLE CAMEO!", "apple"),
)


@dataclass(frozen=True)
class ToySpec:
    name: str
    tagline: str
    color: tuple[int, int, int]
    accent: tuple[int, int, int]
    stiffness: float
    damping: float


TOYS = (
    ToySpec("CYBER APPLE", "slow, glossy, reassuring", (147, 224, 63), (74, 180, 83), 22.0, 7.5),
    ToySpec("SOFT BLOB", "bouncy original friend", PURPLE, PINK, 28.0, 8.0),
    ToySpec("CRISPY PEACH", "crack the shell, find the soft core", (255, 210, 157), (255, 116, 145), 38.0, 10.0),
    ToySpec("RAMEN PACK", "crinkle the bag, then pop the noodles", (255, 91, 68), (255, 190, 61), 42.0, 11.0),
    ToySpec("RIPPLE JELLY", "breathe, squeeze, leave a shared ripple", (166, 218, 238), (129, 108, 225), 22.0, 8.0),
)


@dataclass
class Particle:
    x: float
    y: float
    vx: float
    vy: float
    life: float
    color: tuple[int, int, int]
    size: float
    shard: bool = False


@dataclass
class Ripple:
    pressure: float
    participant: int
    age: float
    phase: float


class SquishApp:
    def __init__(self, camera_index: int = 0, use_camera: bool = True) -> None:
        pygame.mixer.pre_init(44100, -16, 2, 512)
        pygame.init()
        pygame.display.set_caption("SQUISH! — hand-powered stress toy")
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
        self.clock = pygame.time.Clock()
        self.font_big = pygame.font.SysFont("arialrounded", 52, bold=True)
        self.font = pygame.font.SysFont("arialrounded", 21, bold=True)
        self.font_small = pygame.font.SysFont("arialrounded", 16)
        self.font_tiny = pygame.font.SysFont("arialrounded", 13, bold=True)
        self.spring = SpringValue()
        self.camera = HandCamera(camera_index)
        if use_camera:
            self.camera.start()
        else:
            self.camera.error = "Camera disabled — use SPACE or mouse"
        self.target = 0.0
        self.manual_target = 0.0
        self.help_visible = True
        self.particles: list[Particle] = []
        self.last_squish = 0.0
        self.squeeze_axis = "vertical"
        self.toy_index = 4
        self.shell_broken = False
        self.heal_timer = 0.0
        self.sound_on = True
        self.crinkle_cooldown = 0.0
        self.ramen_armed = False
        self.ramen_peak = 0.0
        self.ramen_reward = "CLASSIC CRUNCH"
        self.ramen_reward_kind = "classic"
        self.ramen_flavor = RAMEN_FLAVORS[0][0]
        self.ramen_color = RAMEN_FLAVORS[0][1]
        self.ramen_accent = RAMEN_FLAVORS[0][2]
        self.packs_popped = 0
        self.shake_timer = 0.0
        self.flash_timer = 0.0
        self.restock_timer = 0.0
        self.breath_elapsed = 0.0
        self.jelly_peak = 0.0
        self.jelly_armed = False
        self.ripples: list[Ripple] = []
        self.ripple_layers = 0
        self.ripple_flash = 0.0
        self.collaborator = 0
        self.jelly_roundness = 1.0
        self.jelly_rotation = 0.0
        self.jelly_roll_strength = 0.0
        self.crinkle_sound = self.make_sound("crinkle")
        self.burst_sound = self.make_sound("burst")
        self.ripple_sounds = {
            band: self.make_chord(band) for band in ("light", "medium", "deep")
        }
        if self.crinkle_sound is not None:
            self.crinkle_sound.set_volume(0.28)
        if self.burst_sound is not None:
            self.burst_sound.set_volume(0.48)
        for sound in self.ripple_sounds.values():
            if sound is not None:
                sound.set_volume(0.24)
        self.running = True

    @staticmethod
    def make_sound(kind: str) -> pygame.mixer.Sound | None:
        """Create short tactile sounds in memory so the project needs no audio files."""
        if pygame.mixer.get_init() is None:
            return None
        sample_rate = 44100
        duration = 0.13 if kind == "crinkle" else 0.34
        rng = random.Random(73 if kind == "crinkle" else 109)
        samples = array.array("h")
        previous_noise = 0.0
        for i in range(int(sample_rate * duration)):
            t = i / sample_rate
            envelope = max(0.0, 1.0 - t / duration)
            noise = rng.uniform(-1.0, 1.0)
            crisp_noise = noise - previous_noise * 0.72
            previous_noise = noise
            if kind == "crinkle":
                pulse = 1.0 if (i // 390) % 3 == 0 else 0.30
                value = crisp_noise * envelope * pulse * 0.23
            else:
                thump = math.sin(math.tau * (92 - 100 * t) * t) * math.exp(-18 * t)
                crackle = crisp_noise * envelope * (0.50 if t < 0.11 else 0.18)
                value = thump * 0.70 + crackle
            sample = int(max(-1.0, min(1.0, value)) * 32767)
            samples.extend((sample, sample))
        try:
            return pygame.mixer.Sound(buffer=samples.tobytes())
        except pygame.error:
            return None

    def play_sound(self, sound: pygame.mixer.Sound | None) -> None:
        if self.sound_on and sound is not None:
            sound.play()

    @staticmethod
    def make_chord(band: str) -> pygame.mixer.Sound | None:
        """Generate a soft layered chord for a released pressure wave."""
        if pygame.mixer.get_init() is None:
            return None
        frequencies = {
            "light": (523.25, 659.25, 783.99),
            "medium": (392.00, 493.88, 587.33),
            "deep": (261.63, 392.00, 523.25),
        }[band]
        sample_rate, duration = 44100, 1.65
        samples = array.array("h")
        for i in range(int(sample_rate * duration)):
            t = i / sample_rate
            attack = min(1.0, t / 0.10)
            release = max(0.0, 1.0 - t / duration) ** 1.7
            shimmer = sum(math.sin(math.tau * frequency * t) for frequency in frequencies) / len(frequencies)
            breath = math.sin(math.tau * frequencies[0] * 0.5 * t) * 0.12
            value = (shimmer * 0.42 + breath) * attack * release
            sample = int(max(-1.0, min(1.0, value)) * 32767)
            samples.extend((sample, sample))
        try:
            return pygame.mixer.Sound(buffer=samples.tobytes())
        except pygame.error:
            return None

    @property
    def toy(self) -> ToySpec:
        return TOYS[self.toy_index]

    def select_toy(self, index: int) -> None:
        self.toy_index = index % len(TOYS)
        self.reset_toy()
        self.particles.clear()

    def reset_toy(self) -> None:
        self.spring.value = self.spring.velocity = 0.0
        self.target = self.manual_target = 0.0
        self.shell_broken = False
        self.heal_timer = 0.0
        self.crinkle_cooldown = 0.0
        self.ramen_armed = False
        self.ramen_peak = 0.0
        self.shake_timer = 0.0
        self.flash_timer = 0.0
        self.restock_timer = 0.0
        if self.toy_index == 3:
            self.prepare_ramen()
        if self.toy_index == 4:
            self.breath_elapsed = 0.0
            self.jelly_peak = 0.0
            self.jelly_armed = False
            self.ripples.clear()
            self.ripple_layers = 0
            self.ripple_flash = 0.0
            self.jelly_roundness = 1.0
            self.jelly_rotation = 0.0
            self.jelly_roll_strength = 0.0

    def release_ripple(self) -> None:
        pressure = clamp(self.jelly_peak)
        if pressure < 0.16:
            return
        self.ripples.append(Ripple(pressure, self.collaborator, 0.0, random.uniform(0, math.tau)))
        self.ripples = self.ripples[-8:]
        self.ripple_layers += 1
        self.ripple_flash = 0.55
        self.play_sound(self.ripple_sounds[pressure_band(pressure)])
        self.jelly_peak = 0.0
        self.jelly_armed = False

    def prepare_ramen(self) -> None:
        self.ramen_flavor, self.ramen_color, self.ramen_accent = random.choice(RAMEN_FLAVORS)
        self.ramen_reward = "SQUEEZE, THEN PULL APART"
        self.ramen_reward_kind = "classic"

    def burst_ramen(self) -> None:
        if self.shell_broken:
            return
        self.shell_broken = True
        self.ramen_armed = False
        self.packs_popped += 1
        roll = random.random()
        if roll < 0.48:
            reward_index = 0
        elif roll < 0.66:
            reward_index = 1
        elif roll < 0.80:
            reward_index = 2
        elif roll < 0.90:
            reward_index = 3
        elif roll < 0.97:
            reward_index = 4
        else:
            reward_index = 5
        self.ramen_reward, self.ramen_reward_kind = RAMEN_REWARDS[reward_index]
        w, h = self.screen.get_size()
        self.spawn_pop(w * 0.5, h * 0.49, crispy=True, ramen=True)
        if self.ramen_reward_kind == "seasoning":
            self.spawn_pop(w * 0.5, h * 0.45, ramen=True)
        self.play_sound(self.burst_sound)
        self.shake_timer = 0.36
        self.flash_timer = 0.11

    def handle_events(self) -> None:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key in (pygame.K_ESCAPE, pygame.K_q):
                    self.running = False
                elif event.key == pygame.K_c:
                    self.camera.toggle()
                elif event.key == pygame.K_h:
                    self.help_visible = not self.help_visible
                elif event.key == pygame.K_r:
                    self.reset_toy()
                elif event.key == pygame.K_m:
                    self.sound_on = not self.sound_on
                elif event.key in (pygame.K_1, pygame.K_KP1):
                    self.select_toy(0)
                elif event.key in (pygame.K_2, pygame.K_KP2):
                    self.select_toy(1)
                elif event.key in (pygame.K_3, pygame.K_KP3):
                    self.select_toy(2)
                elif event.key in (pygame.K_4, pygame.K_KP4):
                    self.select_toy(3)
                elif event.key in (pygame.K_5, pygame.K_KP5):
                    self.select_toy(4)
                elif event.key == pygame.K_n and self.toy_index == 4:
                    self.collaborator = (self.collaborator + 1) % 3
                    self.jelly_peak = 0.0
                    self.jelly_armed = False
                elif event.key == pygame.K_TAB:
                    self.select_toy(self.toy_index + 1)

    def manual_input(self, dt: float) -> tuple[float, str] | None:
        keys = pygame.key.get_pressed()
        mouse_pressed = pygame.mouse.get_pressed(num_buttons=3)[0]
        if self.toy_index == 4 and keys[pygame.K_g]:
            self.manual_target = max(0.0, self.manual_target - dt * 4.8)
            return self.manual_target, "rolling"
        axis = "horizontal" if keys[pygame.K_LSHIFT] or keys[pygame.K_RSHIFT] else "vertical"
        if keys[pygame.K_SPACE] or mouse_pressed:
            self.manual_target = min(1.0, self.manual_target + dt * 3.8)
            return self.manual_target, axis
        if keys[pygame.K_DOWN] or keys[pygame.K_RIGHT]:
            self.manual_target = min(1.0, self.manual_target + dt * 1.6)
            return self.manual_target, "vertical"
        if keys[pygame.K_UP] or keys[pygame.K_LEFT]:
            self.manual_target = max(0.0, self.manual_target - dt * 1.6)
            return self.manual_target, "vertical"
        self.manual_target = max(0.0, self.manual_target - dt * 2.7)
        return None

    def spawn_pop(self, cx: float, cy: float, *, crispy: bool = False, ramen: bool = False) -> None:
        palette = ((244, 190, 75), (255, 226, 135), (213, 55, 45), (255, 247, 201)) if ramen else (self.toy.color, self.toy.accent, MINT, (255, 245, 200))
        count = 38 if ramen else 28 if crispy else 18
        for _ in range(count):
            angle = random.uniform(math.pi, 2 * math.pi)
            speed = random.uniform(100, 330 if ramen else 290 if crispy else 230)
            self.particles.append(Particle(cx, cy, math.cos(angle) * speed, math.sin(angle) * speed, random.uniform(0.55, 1.0), random.choice(palette), random.uniform(4, 11 if crispy or ramen else 8), crispy or ramen))

    def update_particles(self, dt: float) -> None:
        alive = []
        for p in self.particles:
            p.life -= dt
            if p.life <= 0:
                continue
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.vy += 270 * dt
            p.vx *= 0.99
            alive.append(p)
        self.particles = alive

    def update(self, dt: float) -> tuple[str, bool]:
        camera_result = self.camera.read()
        manual = self.manual_input(dt)
        roll_input = camera_result.roll_motion
        if manual is not None:
            self.target, self.squeeze_axis = manual
            if self.squeeze_axis == "rolling":
                roll_input = 1.0
                status = "Manual rolling round"
            else:
                roll_input = 0.0
                status = "Manual side squeeze" if self.squeeze_axis == "horizontal" else "Manual squish"
            active = True
        elif camera_result.horizontal_squish is not None:
            # When opposing palm motion is strong, interpret the gesture as
            # rolling rather than continuing to crush the ball.
            self.target = camera_result.horizontal_squish * (1.0 - 0.82 * roll_input)
            self.manual_target = self.target
            self.squeeze_axis = "horizontal"
            status, active = camera_result.message, camera_result.hands_visible == 2
        elif camera_result.openness is not None:
            self.target = clamp(1.0 - camera_result.openness)
            self.manual_target = self.target
            self.squeeze_axis = "vertical"
            status, active = camera_result.message, camera_result.hands_visible == 1
        else:
            self.target, status, active = self.manual_target, camera_result.message, False

        self.spring.stiffness = self.toy.stiffness
        self.spring.damping = self.toy.damping
        squish = self.spring.update(self.target, dt)
        self.crinkle_cooldown = max(0.0, self.crinkle_cooldown - dt)
        self.shake_timer = max(0.0, self.shake_timer - dt)
        self.flash_timer = max(0.0, self.flash_timer - dt)
        self.restock_timer = max(0.0, self.restock_timer - dt)
        self.ripple_flash = max(0.0, self.ripple_flash - dt)
        if self.toy_index == 4:
            self.jelly_roll_strength += (roll_input - self.jelly_roll_strength) * min(1.0, dt * 10.0)
            if roll_input > 0.12:
                self.jelly_roundness = clamp(self.jelly_roundness + dt * (0.75 + roll_input * 1.65))
                self.jelly_rotation = (self.jelly_rotation + dt * (1.6 + roll_input * 5.2)) % math.tau
            elif squish > 0.12:
                self.jelly_roundness = clamp(self.jelly_roundness - dt * (0.34 + squish * 0.62), 0.36, 1.0)
                self.jelly_rotation = (self.jelly_rotation + dt * 0.16) % math.tau
            else:
                # The gel very slowly relaxes by itself, but rolling is the
                # deliberate and clearly visible way to restore a sphere.
                self.jelly_roundness = clamp(self.jelly_roundness + dt * 0.055, 0.36, 1.0)
                self.jelly_rotation = (self.jelly_rotation + dt * 0.10) % math.tau
            self.breath_elapsed = (self.breath_elapsed + dt) % 12.0
            self.jelly_peak = max(self.jelly_peak, clamp(squish))
            if self.jelly_peak > 0.16:
                self.jelly_armed = True
            if self.jelly_armed and squish < 0.10 and self.target < 0.08:
                self.release_ripple()
            for ripple in self.ripples:
                ripple.age += dt
            self.ripples = [ripple for ripple in self.ripples if ripple.age < 22.0]
        if self.toy_index == 3 and not self.shell_broken:
            crossed_crinkle = any(self.last_squish <= level < squish for level in (0.22, 0.43, 0.64))
            if crossed_crinkle and self.crinkle_cooldown <= 0:
                self.play_sound(self.crinkle_sound)
                self.crinkle_cooldown = 0.12

            if self.squeeze_axis == "horizontal":
                self.ramen_peak = max(self.ramen_peak, squish)
                if self.ramen_peak > 0.72:
                    self.ramen_armed = True
                    status = "PULL HANDS APART!"
                if self.ramen_armed and is_pull_apart_tear(self.ramen_peak, squish, self.target):
                    self.burst_ramen()
                    status = self.ramen_reward
            elif squish > 0.92:
                self.burst_ramen()
                status = self.ramen_reward

            if squish < 0.10 and self.target < 0.10 and not self.ramen_armed:
                self.ramen_peak = 0.0

        if self.toy_index == 2 and squish > 0.82 and not self.shell_broken:
            self.shell_broken = True
            w, h = self.screen.get_size()
            self.spawn_pop(w * 0.5, h * 0.49, crispy=True)
            self.play_sound(self.burst_sound)
        elif self.toy_index not in (2, 3, 4) and squish > 0.80 and self.last_squish <= 0.80:
            w, h = self.screen.get_size()
            self.spawn_pop(w * 0.5, h * 0.52)

        if self.shell_broken and squish < 0.12 and self.target < 0.08:
            self.heal_timer += dt
            if self.heal_timer > (1.25 if self.toy_index == 3 else 0.9):
                self.shell_broken = False
                self.heal_timer = 0.0
                if self.toy_index == 3:
                    self.prepare_ramen()
                    self.restock_timer = 0.65
        else:
            self.heal_timer = 0.0
        self.last_squish = squish
        self.update_particles(dt)
        if self.toy_index == 3 and self.shell_broken:
            status = self.ramen_reward
        elif self.toy_index == 4:
            phase, _ = breathing_phase(self.breath_elapsed)
            if self.jelly_roll_strength > 0.20:
                action = "ROLLING ROUND"
            elif self.squeeze_axis == "horizontal" and squish > 0.12:
                action = "FLATTENING"
            else:
                action = phase
            status = f"Collaborator {chr(65 + self.collaborator)} | {action}"
        return status, active

    @staticmethod
    def ellipse_points(cx: float, cy: float, width: float, height: float, count: int = 72) -> list[tuple[float, float]]:
        return [(cx + math.cos(i / count * math.tau) * width / 2, cy + math.sin(i / count * math.tau) * height / 2) for i in range(count)]

    def deformed_size(
        self,
        base_width: float,
        base_height: float,
        s: float,
        vertical_spread: float,
        vertical_flatten: float,
        scale: float,
    ) -> tuple[float, float]:
        if self.squeeze_axis == "horizontal":
            return base_width * (1 - 0.40 * s) * scale, base_height * (1 + 0.28 * s) * scale
        return base_width * (1 + vertical_spread * s) * scale, base_height * (1 - vertical_flatten * s) * scale

    def draw_face(self, surface: pygame.Surface, cx: float, cy: float, width: float, height: float, scale: float, s: float) -> None:
        eye_y = cy - height * (0.07 - 0.03 * s)
        eye_gap = width * 0.16
        eye_h = max(6 * scale, 23 * (1 - 0.72 * s) * scale)
        for eye_x in (cx - eye_gap, cx + eye_gap):
            pygame.draw.ellipse(surface, INK, pygame.Rect(eye_x - 7 * scale, eye_y - eye_h / 2, 14 * scale, eye_h))
        mouth_w = (36 + 42 * s) * scale
        mouth = pygame.Rect(cx - mouth_w / 2, cy + height * 0.10, mouth_w, 18 * scale)
        pygame.draw.arc(surface, INK, mouth, math.pi * 0.08, math.pi * 0.92, max(3, int(5 * scale)))
        if s > 0.48:
            r = max(5, int(9 * scale))
            pygame.draw.circle(surface, PINK, (int(cx - width * 0.28), int(eye_y + 24 * scale)), r)
            pygame.draw.circle(surface, PINK, (int(cx + width * 0.28), int(eye_y + 24 * scale)), r)

    def draw_shadow(self, surface: pygame.Surface, cx: float, y: float, width: float, scale: float) -> None:
        shadow = pygame.Rect(0, 0, width * 0.76, 30 * scale)
        shadow.center = (cx, y)
        pygame.draw.ellipse(surface, (218, 203, 231), shadow)

    def draw_blob(self, surface: pygame.Surface, cx: float, cy: float, scale: float) -> None:
        s = clamp(self.spring.value)
        width, height = self.deformed_size(290, 300, s, 0.46, 0.48, scale)
        cy += (42 * s if self.squeeze_axis == "vertical" else 0) + math.sin(pygame.time.get_ticks() * 0.004) * 4 * (1 - s)
        self.draw_shadow(surface, cx, cy + height * 0.5, width, scale)
        points, now = [], pygame.time.get_ticks() * 0.002
        for i in range(72):
            a = i / 72 * math.tau
            wobble = 1 + 0.025 * math.sin(a * 5 + now) * (0.4 + s)
            points.append((cx + math.cos(a) * width * 0.5 * wobble, cy + math.sin(a) * height * 0.5 * wobble))
        pygame.draw.polygon(surface, INK, points)
        pygame.draw.polygon(surface, self.toy.color, [(cx + (x - cx) * 0.955, cy + (y - cy) * 0.955) for x, y in points])
        highlight = pygame.Rect(0, 0, width * 0.33, height * 0.13)
        highlight.center = (cx - width * 0.17, cy - height * 0.25)
        pygame.draw.ellipse(surface, (175, 151, 255), highlight)
        self.draw_face(surface, cx, cy, width, height, scale, s)

    def draw_apple(self, surface: pygame.Surface, cx: float, cy: float, scale: float) -> None:
        s = clamp(self.spring.value)
        width, height = self.deformed_size(300, 300, s, 0.36, 0.42, scale)
        cy += (40 * s if self.squeeze_axis == "vertical" else 0) + math.sin(pygame.time.get_ticks() * 0.003) * 3 * (1 - s)
        self.draw_shadow(surface, cx, cy + height * 0.51, width, scale)
        points = []
        for i in range(84):
            a = i / 84 * math.tau
            xu, yu = math.cos(a), math.sin(a)
            indent = 0.20 * math.exp(-((xu / 0.20) ** 2)) * max(0.0, -yu) ** 6
            lobes = 1 + 0.055 * max(0.0, -yu) * abs(xu)
            points.append((cx + xu * width * 0.5 * lobes, cy + (yu + indent) * height * 0.5))
        pygame.draw.polygon(surface, INK, points)
        pygame.draw.polygon(surface, self.toy.color, [(cx + (x - cx) * 0.952, cy + (y - cy) * 0.952) for x, y in points])
        stem_h = 54 * (1 - 0.38 * s) * scale
        pygame.draw.line(surface, INK, (cx + 2 * scale, cy - height * 0.46), (cx + 14 * scale, cy - height * 0.46 - stem_h), max(5, int(9 * scale)))
        leaf = pygame.Rect(cx + 5 * scale, cy - height * 0.54 - stem_h * 0.55, 74 * scale, 35 * scale)
        pygame.draw.ellipse(surface, INK, leaf)
        pygame.draw.ellipse(surface, (64, 168, 91), leaf.inflate(-7 * scale, -7 * scale))
        shine = pygame.Rect(0, 0, width * 0.18, height * 0.32)
        shine.center = (cx - width * 0.24, cy - height * 0.16)
        pygame.draw.ellipse(surface, (221, 255, 163), shine)
        small = pygame.Rect(0, 0, width * 0.06, height * 0.10)
        small.center = (cx - width * 0.13, cy - height * 0.31)
        pygame.draw.ellipse(surface, (245, 255, 222), small)
        self.draw_face(surface, cx, cy + 7 * scale, width, height, scale, s)

    def draw_cracks(self, surface: pygame.Surface, cx: float, cy: float, width: float, height: float, stage: int, scale: float) -> None:
        paths = (((-0.05, -0.42), (-0.02, -0.24), (-0.11, -0.11), (-0.02, 0.02)), ((0.31, -0.15), (0.18, -0.05), (0.26, 0.09), (0.12, 0.20)), ((-0.34, 0.02), (-0.20, 0.10), (-0.27, 0.25), (-0.10, 0.33)))
        for path in paths[:stage]:
            pygame.draw.lines(surface, (137, 82, 78), False, [(cx + x * width, cy + y * height) for x, y in path], max(2, int(4 * scale)))

    def draw_crispy(self, surface: pygame.Surface, cx: float, cy: float, scale: float) -> None:
        s = clamp(self.spring.value)
        width, height = self.deformed_size(305, 285, s, 0.40, 0.40, scale)
        cy += 40 * s if self.squeeze_axis == "vertical" else 0
        self.draw_shadow(surface, cx, cy + height * 0.53, width, scale)
        if not self.shell_broken:
            points = self.ellipse_points(cx, cy, width, height)
            pygame.draw.polygon(surface, INK, points)
            pygame.draw.polygon(surface, self.toy.color, [(cx + (x - cx) * 0.95, cy + (y - cy) * 0.95) for x, y in points])
            glow = pygame.Rect(0, 0, width * 0.32, height * 0.12)
            glow.center = (cx - width * 0.18, cy - height * 0.28)
            pygame.draw.ellipse(surface, (255, 239, 205), glow)
            stage = 3 if s > 0.66 else 2 if s > 0.43 else 1 if s > 0.22 else 0
            self.draw_cracks(surface, cx, cy, width, height, stage, scale)
            self.draw_face(surface, cx, cy, width, height, scale, s)
            return
        core_w, core_h = width * 0.77, max(height * 0.82, 95 * scale)
        core = self.ellipse_points(cx, cy + 7 * scale, core_w, core_h)
        pygame.draw.polygon(surface, INK, core)
        pygame.draw.polygon(surface, self.toy.accent, [(cx + (x - cx) * 0.94, cy + 7 * scale + (y - (cy + 7 * scale)) * 0.94) for x, y in core])
        pieces = (((-0.50, -0.12), (-0.29, -0.38), (-0.20, -0.08), (-0.36, 0.13)), ((0.49, -0.15), (0.27, -0.39), (0.19, -0.07), (0.36, 0.15)), ((-0.24, -0.46), (0.00, -0.55), (0.20, -0.43), (0.04, -0.28)))
        for piece in pieces:
            poly = [(cx + x * width, cy + y * height) for x, y in piece]
            pygame.draw.polygon(surface, INK, poly)
            pygame.draw.polygon(surface, (255, 218, 173), [(cx + (x - cx) * 0.93, cy + (y - cy) * 0.93) for x, y in poly])
        self.draw_face(surface, cx, cy + 8 * scale, core_w, core_h, scale, s)

    def draw_ramen_cake(
        self,
        surface: pygame.Surface,
        cx: float,
        cy: float,
        width: float,
        height: float,
        scale: float,
        color: tuple[int, int, int] = (247, 201, 91),
    ) -> None:
        cake = pygame.Rect(0, 0, width, height)
        cake.center = (cx, cy)
        pygame.draw.rect(surface, INK, cake, border_radius=max(8, int(18 * scale)))
        inner = cake.inflate(-9 * scale, -9 * scale)
        pygame.draw.rect(surface, color, inner, border_radius=max(6, int(14 * scale)))
        for row in range(7):
            points = []
            for column in range(18):
                x = inner.left + column / 17 * inner.width
                y = inner.top + (row + 0.6) / 7 * inner.height + math.sin(column * 1.75 + row) * 4 * scale
                points.append((x, y))
            pygame.draw.lines(surface, (196, 132, 45), False, points, max(1, int(3 * scale)))

    def draw_ramen(self, surface: pygame.Surface, cx: float, cy: float, scale: float) -> None:
        s = clamp(self.spring.value)
        width, height = self.deformed_size(330, 285, s, 0.30, 0.36, scale)
        cy += 38 * s if self.squeeze_axis == "vertical" else 0
        if self.restock_timer > 0:
            progress = 1.0 - self.restock_timer / 0.65
            cx += (1.0 - progress) ** 3 * surface.get_width() * 0.72
        self.draw_shadow(surface, cx, cy + height * 0.54, width, scale)
        if self.shell_broken:
            if self.ramen_reward_kind == "double":
                self.draw_ramen_cake(surface, cx - 32 * scale, cy + 1 * scale, width * 0.57, height * 0.47, scale)
                self.draw_ramen_cake(surface, cx + 35 * scale, cy + 35 * scale, width * 0.57, height * 0.47, scale)
            elif self.ramen_reward_kind == "apple":
                pygame.draw.circle(surface, INK, (int(cx), int(cy + 10 * scale)), int(78 * scale))
                pygame.draw.circle(surface, (143, 225, 64), (int(cx), int(cy + 10 * scale)), int(71 * scale))
                pygame.draw.line(surface, INK, (cx, cy - 55 * scale), (cx + 12 * scale, cy - 88 * scale), max(4, int(8 * scale)))
            elif self.ramen_reward_kind != "empty":
                cake_color = (255, 220, 58) if self.ramen_reward_kind == "golden" else (247, 201, 91)
                self.draw_ramen_cake(surface, cx, cy + 8 * scale, width * 0.70, height * 0.62, scale, cake_color)
            else:
                ghost = pygame.Rect(0, 0, width * 0.50, height * 0.40)
                ghost.center = (cx, cy + 8 * scale)
                pygame.draw.rect(surface, (218, 203, 231), ghost, max(2, int(4 * scale)), border_radius=max(8, int(18 * scale)))
            tear = 30 * scale
            left = [(cx - width * 0.48, cy - height * 0.44), (cx - width * 0.18, cy - height * 0.34), (cx - width * 0.29, cy + height * 0.39), (cx - width * 0.58, cy + height * 0.26)]
            right = [(cx + width * 0.48, cy - height * 0.44), (cx + width * 0.18, cy - height * 0.34), (cx + width * 0.29, cy + height * 0.39), (cx + width * 0.58, cy + height * 0.26)]
            for piece in (left, right):
                pygame.draw.polygon(surface, INK, piece)
                inset = [(x + (cx - x) * 0.035, y + (cy - y) * 0.035) for x, y in piece]
                pygame.draw.polygon(surface, self.ramen_color, inset)
            pygame.draw.line(surface, (255, 225, 140), (cx - tear, cy - height * 0.36), (cx, cy - height * 0.25), max(3, int(5 * scale)))
            if self.ramen_reward_kind != "empty":
                self.draw_face(surface, cx, cy + 10 * scale, width * 0.62, height * 0.54, scale, s)
            return

        bag = pygame.Rect(0, 0, width, height)
        bag.center = (cx, cy)
        pygame.draw.rect(surface, INK, bag, border_radius=max(12, int(35 * scale)))
        inner = bag.inflate(-10 * scale, -10 * scale)
        pygame.draw.rect(surface, self.ramen_color, inner, border_radius=max(10, int(30 * scale)))
        seal_h = max(12, int(20 * scale))
        pygame.draw.rect(surface, self.ramen_accent, (inner.left, inner.top, inner.width, seal_h), border_radius=max(3, int(8 * scale)))
        pygame.draw.rect(surface, self.ramen_accent, (inner.left, inner.bottom - seal_h, inner.width, seal_h), border_radius=max(3, int(8 * scale)))
        label = pygame.Rect(0, 0, width * 0.64, height * 0.50)
        label.center = (cx, cy)
        pygame.draw.rect(surface, (255, 241, 191), label, border_radius=max(8, int(22 * scale)))
        bowl = pygame.Rect(0, 0, label.width * 0.58, label.height * 0.40)
        bowl.center = (cx, cy + label.height * 0.13)
        pygame.draw.arc(surface, (218, 74, 49), bowl, 0, math.pi, max(3, int(7 * scale)))
        for offset in (-0.16, 0.0, 0.16):
            x = cx + label.width * offset
            pygame.draw.arc(surface, (224, 154, 48), (x - 19 * scale, cy - 30 * scale, 38 * scale, 62 * scale), 0, math.pi, max(2, int(4 * scale)))
        crinkle_count = 1 + int(s * 6)
        for index in range(crinkle_count):
            y = inner.top + (index + 1) * inner.height / (crinkle_count + 1)
            side = -1 if index % 2 == 0 else 1
            x1 = cx + side * width * 0.47
            x2 = cx + side * width * (0.28 - 0.04 * s)
            pygame.draw.line(surface, (171, 49, 47), (x1, y), (x2, y + (12 if index % 3 else -12) * scale), max(1, int(3 * scale)))
        if s > 0.68:
            pygame.draw.lines(surface, (94, 38, 42), False, [(cx, inner.top), (cx - 15 * scale, cy - height * 0.30), (cx + 8 * scale, cy - height * 0.20)], max(2, int(4 * scale)))
        self.draw_face(surface, cx, cy + 22 * scale, width * 0.58, height * 0.46, scale, s)

    def draw_supermarket(self, surface: pygame.Surface, w: int, h: int) -> None:
        shelf_y = int(h * 0.61)
        pygame.draw.rect(surface, (230, 214, 239), (0, shelf_y, w, 18))
        pygame.draw.rect(surface, INK, (0, shelf_y + 18, w, 7))
        for x in range(-20, w + 100, 115):
            pack = pygame.Rect(x, shelf_y - 52, 82, 48)
            pygame.draw.rect(surface, (255, 255, 255), pack, border_radius=9)
            pygame.draw.rect(surface, (222, 208, 232), pack, 2, border_radius=9)
            pygame.draw.line(surface, (255, 190, 61), (pack.left + 8, pack.centery), (pack.right - 8, pack.centery), 5)
        count = self.font_tiny.render(f"AISLE 04  |  PACKS POPPED {self.packs_popped:02d}", True, (93, 73, 111))
        badge = pygame.Rect(30, 160, count.get_width() + 26, 30)
        pygame.draw.rect(surface, (255, 255, 255), badge, border_radius=15)
        pygame.draw.rect(surface, (220, 207, 231), badge, 2, border_radius=15)
        surface.blit(count, (badge.x + 13, badge.y + 8))

    def draw_ripples(self, surface: pygame.Surface, w: int, h: int, scale: float) -> None:
        layer = pygame.Surface((w, h), pygame.SRCALPHA)
        centre_y = h * 0.48
        offsets = (-115 * scale, 0, 115 * scale)
        for ripple in self.ripples:
            fade = max(0.0, 1.0 - ripple.age / 22.0)
            band = pressure_band(ripple.pressure)
            ring_count = {"light": 2, "medium": 4, "deep": 6}[band]
            lobes = {"light": 8, "medium": 6, "deep": 4}[band]
            amplitude = (2.0 + ripple.pressure * 10.0) * scale
            cx = w * 0.5 + offsets[ripple.participant]
            color = RIPPLE_COLORS[ripple.participant]
            for ring in range(ring_count):
                radius = (40 + ripple.age * 13 + ring * (17 + ripple.pressure * 10)) * scale
                points = []
                for index in range(100):
                    angle = index / 100 * math.tau
                    warped = radius + math.sin(angle * lobes + ripple.phase + ring * 0.48) * amplitude
                    points.append((cx + math.cos(angle) * warped, centre_y + math.sin(angle) * warped * 0.58))
                alpha = int((82 - ring * 7) * fade)
                width = max(1, int((1.2 + ripple.pressure * 3.6) * scale))
                pygame.draw.lines(layer, (*color, alpha), True, points, width)
        surface.blit(layer, (0, 0))

    def draw_breath_prompt(self, surface: pygame.Surface, w: int, h: int) -> None:
        phase, progress = breathing_phase(self.breath_elapsed)
        copy = {
            "inhale": ("BREATHE IN", "open your hand | let the jelly rise"),
            "hold": ("HOLD SOFTLY", "stay comfortable | no need to be perfectly still"),
            "exhale": ("BREATHE OUT & SQUEEZE", "close your hand slowly | release when ready"),
        }
        title, subtitle = copy[phase]
        heading = self.font.render(title, True, (86, 67, 143))
        hint = self.font_tiny.render(subtitle, True, (107, 102, 132))
        surface.blit(heading, (w // 2 - heading.get_width() // 2, 157))
        surface.blit(hint, (w // 2 - hint.get_width() // 2, 187))
        track = pygame.Rect(w // 2 - 145, 211, 290, 7)
        pygame.draw.rect(surface, (219, 216, 236), track, border_radius=4)
        fill = track.copy()
        fill.width = int(track.width * progress)
        phase_color = {"inhale": RIPPLE_COLORS[0], "hold": RIPPLE_COLORS[1], "exhale": RIPPLE_COLORS[2]}[phase]
        pygame.draw.rect(surface, phase_color, fill, border_radius=4)

        participant = self.font_tiny.render(
            f"COLLABORATOR {chr(65 + self.collaborator)}  |  SHARED WAVES {self.ripple_layers:02d}",
            True,
            (82, 73, 112),
        )
        badge = pygame.Rect(30, 160, participant.get_width() + 26, 30)
        pygame.draw.rect(surface, (255, 255, 255), badge, border_radius=15)
        pygame.draw.rect(surface, (*RIPPLE_COLORS[self.collaborator],), badge, 2, border_radius=15)
        surface.blit(participant, (badge.x + 13, badge.y + 8))

    def draw_jelly(self, surface: pygame.Surface, cx: float, cy: float, scale: float) -> None:
        spring_pressure = clamp(self.spring.value)
        remembered_flatness = (1.0 - self.jelly_roundness) * 0.72
        pressure = max(spring_pressure, remembered_flatness) * (1.0 - self.jelly_roll_strength * 0.76)
        pressure = clamp(pressure)
        phase, progress = breathing_phase(self.breath_elapsed)
        if phase == "inhale":
            breath_scale = 0.94 + progress * 0.10
        elif phase == "hold":
            breath_scale = 1.04
        else:
            breath_scale = 1.04 - progress * 0.08

        # Keep the resting form close to a water-gel sphere. Pressure turns that
        # sphere into a convincing squish without losing its glossy silhouette.
        width = 252 * (1.0 + pressure * 0.43) * scale * breath_scale
        height = 252 * (1.0 - pressure * 0.40) * scale * breath_scale
        cy += pressure * 25 * scale
        cy += math.sin(pygame.time.get_ticks() * 0.0016) * 5 * scale

        layer = pygame.Surface(surface.get_size(), pygame.SRCALPHA)
        tint = RIPPLE_COLORS[self.collaborator]
        edge = tuple(max(0, int(channel * 0.67)) for channel in tint)
        pale = tuple(min(255, int(channel + (255 - channel) * 0.45)) for channel in tint)
        light = tuple(min(255, int(channel + (255 - channel) * 0.67)) for channel in tint)

        # A layered contact shadow and a small coloured caustic sell the sense
        # that the translucent ball is resting just above a surface.
        for step in range(6, 0, -1):
            shadow = pygame.Rect(0, 0, width * (0.55 + step * 0.045), (10 + step * 4) * scale)
            shadow.center = (cx + width * 0.035, cy + height * 0.51)
            pygame.draw.ellipse(layer, (66, 58, 92, 7 + step * 4), shadow)
        caustic = pygame.Rect(0, 0, width * 0.48, height * 0.12)
        caustic.center = (cx + width * 0.08, cy + height * 0.48)
        pygame.draw.ellipse(layer, (*tint, 42), caustic)

        glow = pygame.Rect(0, 0, width + 64 * scale, height + 58 * scale)
        glow.center = (cx, cy + height * 0.03)
        pygame.draw.ellipse(layer, (*tint, 18), glow)

        now = pygame.time.get_ticks() * 0.0018
        points = []
        for index in range(96):
            angle = index / 96 * math.tau
            wobble = 1 + math.sin(angle * 6 + now) * (0.018 + pressure * 0.012)
            points.append((cx + math.cos(angle) * width * 0.5 * wobble, cy + math.sin(angle) * height * 0.5 * wobble))
        pygame.draw.polygon(layer, (*edge, 205), points)

        # Nested bodies act like a simple radial material: saturated at the rim,
        # luminous and transparent through the middle.
        body_layers = (
            (0.94, (*tint, 202), 0.00, 0.00),
            (0.83, (*pale, 190), -0.025, -0.025),
            (0.68, (*light, 170), -0.055, -0.065),
            (0.46, (*light, 150), -0.08, -0.09),
        )
        for factor, color, shift_x, shift_y in body_layers:
            inner = [
                (cx + (x - cx) * factor + width * shift_x, cy + (y - cy) * factor + height * shift_y)
                for x, y in points
            ]
            pygame.draw.polygon(layer, color, inner)

        # Project a sparse rotating sphere mesh in software. Only front-facing
        # segments are drawn, so the material reads as a volume rather than a
        # flat ellipse without adding an OpenGL dependency.
        mesh_color = (*edge, 34)
        for longitude in (-1.18, -0.43, 0.22, 0.91, 1.57):
            segments: list[list[tuple[float, float]]] = []
            segment: list[tuple[float, float]] = []
            rotated_longitude = longitude + self.jelly_rotation
            for step in range(33):
                latitude = -math.pi / 2 + step / 32 * math.pi
                x3 = math.cos(latitude) * math.cos(rotated_longitude)
                z3 = math.cos(latitude) * math.sin(rotated_longitude)
                point = (cx + x3 * width * 0.43, cy + math.sin(latitude) * height * 0.43)
                if z3 > -0.04:
                    segment.append(point)
                elif len(segment) > 1:
                    segments.append(segment)
                    segment = []
            if len(segment) > 1:
                segments.append(segment)
            for visible_segment in segments:
                pygame.draw.lines(layer, mesh_color, False, visible_segment, max(1, int(scale)))
        for latitude in (-0.48, 0.0, 0.48):
            latitude_y = cy + math.sin(latitude) * height * 0.43
            latitude_width = width * math.cos(latitude) * 0.86
            latitude_height = max(5 * scale, height * 0.055 * math.cos(latitude))
            latitude_rect = pygame.Rect(0, 0, latitude_width, latitude_height)
            latitude_rect.center = (cx, latitude_y)
            pygame.draw.arc(layer, (*pale, 30), latitude_rect, 0, math.pi, max(1, int(scale)))

        lower_refraction = pygame.Rect(0, 0, width * 0.61, height * 0.22)
        lower_refraction.center = (cx + width * 0.07, cy + height * 0.30)
        pygame.draw.ellipse(layer, (*tint, 112), lower_refraction)
        lower_light = pygame.Rect(0, 0, width * 0.35, height * 0.075)
        lower_light.center = (cx - width * 0.09, cy + height * 0.34)
        pygame.draw.ellipse(layer, (255, 255, 255, 105), lower_light)

        # A darker lower rim and bright upper rim mimic refraction through a
        # thick hydrogel skin while still allowing the ripples to show through.
        rim_rect = pygame.Rect(0, 0, width * 0.96, height * 0.96)
        rim_rect.center = (cx, cy)
        pygame.draw.arc(layer, (*edge, 96), rim_rect, math.radians(12), math.radians(166), max(2, int(4 * scale)))
        pygame.draw.arc(layer, (255, 255, 255, 210), rim_rect, math.radians(196), math.radians(330), max(2, int(4 * scale)))
        pygame.draw.lines(layer, (*pale, 122), True, points, max(1, int(2 * scale)))

        # A few barely visible inclusions add depth without turning the clean
        # gel material back into the earlier dotted, misty blob.
        for index in range(6):
            angle = index * 2.399 + self.jelly_rotation
            distance = 0.12 + (index % 3) * 0.085
            px = cx + math.cos(angle) * width * distance
            py = cy + math.sin(angle) * height * distance * 0.72
            radius = max(2, int((2 + index % 2) * scale))
            pygame.draw.circle(layer, (255, 255, 255, 52), (int(px), int(py)), radius)

        # Crisp, offset specular highlights are the strongest material cue in
        # the user's reference: one stretched reflection plus a small sparkle.
        highlight_size = (max(12, int(width * 0.30)), max(8, int(height * 0.105)))
        highlight = pygame.Surface(highlight_size, pygame.SRCALPHA)
        pygame.draw.ellipse(highlight, (255, 255, 255, 244), highlight.get_rect())
        highlight = pygame.transform.rotate(highlight, 24)
        highlight_shift = math.sin(self.jelly_rotation) * width * 0.025
        highlight_rect = highlight.get_rect(center=(cx - width * 0.20 + highlight_shift, cy - height * 0.27))
        layer.blit(highlight, highlight_rect)
        pygame.draw.ellipse(
            layer,
            (255, 255, 255, 235),
            pygame.Rect(cx + width * 0.10, cy - height * 0.36, width * 0.095, height * 0.06),
        )
        pygame.draw.ellipse(
            layer,
            (*pale, 90),
            pygame.Rect(cx - width * 0.23, cy + height * 0.30, width * 0.48, height * 0.095),
        )
        surface.blit(layer, (0, 0))

    def draw_particles(self, surface: pygame.Surface) -> None:
        for p in self.particles:
            size = max(1, int(p.size * clamp(p.life * 2)))
            if p.shard:
                pygame.draw.polygon(surface, p.color, ((p.x, p.y - size), (p.x + size, p.y), (p.x, p.y + size), (p.x - size, p.y)))
            else:
                pygame.draw.circle(surface, p.color, (int(p.x), int(p.y)), size)

    def draw_selector(self, surface: pygame.Surface) -> None:
        x = 30
        for index, toy in enumerate(TOYS):
            text = self.font_tiny.render(f"{index + 1}  {toy.name}", True, INK if index == self.toy_index else (111, 93, 126))
            width = text.get_width() + 28
            box = pygame.Rect(x, 112, width, 34)
            pygame.draw.rect(surface, (255, 255, 255) if index != self.toy_index else toy.color, box, border_radius=17)
            pygame.draw.rect(surface, INK if index == self.toy_index else (218, 207, 229), box, 2, border_radius=17)
            surface.blit(text, (box.x + 14, box.y + 9))
            x += width + 10

    def draw_status(self, surface: pygame.Surface, status: str, active: bool, w: int) -> None:
        text = self.font_small.render(status, True, INK)
        box_w = min(text.get_width() + 54, w - 40)
        box = pygame.Rect(w - box_w - 28, 26, box_w, 38)
        pygame.draw.rect(surface, (255, 255, 255), box, border_radius=19)
        pygame.draw.rect(surface, (220, 210, 232), box, 2, border_radius=19)
        pygame.draw.circle(surface, MINT if active else (255, 185, 84), (box.x + 21, box.centery), 6)
        surface.blit(text, (box.x + 36, box.y + 10))

    def draw_help(self, surface: pygame.Surface, w: int, h: int) -> None:
        if not self.help_visible:
            surface.blit(self.font_small.render("H  show controls", True, (118, 101, 133)), (26, h - 35))
            return
        panel = pygame.Rect(26, h - 112, min(735, w - 52), 84)
        pygame.draw.rect(surface, (255, 255, 255), panel, border_radius=22)
        pygame.draw.rect(surface, (224, 213, 235), panel, 2, border_radius=22)
        if self.toy_index == 4:
            surface.blit(self.font.render("Two hands: squeeze flat or rub in opposite directions to roll round", True, INK), (panel.x + 22, panel.y + 14))
        else:
            surface.blit(self.font.render("1 hand: close fist   |   2 hands: squeeze, then pull apart", True, INK), (panel.x + 22, panel.y + 14))
        if self.burst_sound is None:
            sound_label = "sound unavailable"
        else:
            sound_label = "sound ON" if self.sound_on else "sound OFF"
        if self.toy_index == 4:
            line = f"SPACE flatten/release  |  G roll round  |  N next collaborator  |  M {sound_label}  |  C camera  |  R clear"
        else:
            line = f"SPACE squish  |  SHIFT + SPACE squeeze/release to tear  |  1-5 modes  |  M {sound_label}  |  C camera  |  R reset"
        surface.blit(self.font_tiny.render(line, True, (99, 80, 116)), (panel.x + 22, panel.y + 51))

    def draw(self, status: str, active: bool) -> None:
        w, h = self.screen.get_size()
        if self.toy_index == 4:
            self.screen.fill((240, 246, 252))
            pygame.draw.circle(self.screen, (226, 238, 250), (70, 80), 145)
            pygame.draw.circle(self.screen, (246, 226, 243), (w - 20, h - 10), 200)
            pygame.draw.circle(self.screen, (221, 246, 242), (w - 75, 170), 90)
        else:
            self.screen.fill(BG)
            pygame.draw.circle(self.screen, (234, 225, 250), (80, 90), 120)
            pygame.draw.circle(self.screen, (255, 225, 238), (w - 45, h - 30), 170)
            pygame.draw.circle(self.screen, (221, 247, 239), (w - 80, 150), 70)
        if self.toy_index == 3:
            self.draw_supermarket(self.screen, w, h)
        self.screen.blit(self.font_big.render("SQUISH!", True, INK), (30, 18))
        if self.toy_index == 3:
            tagline = f"SUPERMARKET PACK | {self.ramen_flavor}"
        elif self.toy_index == 4:
            tagline = "BREATHE & RIPPLE | a collaborative jelly instrument"
        else:
            tagline = self.toy.tagline
        self.screen.blit(self.font_small.render(tagline, True, (100, 82, 116)), (34, 79))
        self.draw_selector(self.screen)
        scale, cx, cy = min(w / WIDTH, h / HEIGHT), w * 0.5, h * 0.48
        if self.toy_index == 4:
            self.draw_ripples(self.screen, w, h, scale)
            self.draw_breath_prompt(self.screen, w, h)
        shake = 0.0
        if self.toy_index == 3 and not self.shell_broken and self.spring.value > 0.72:
            shake = (self.spring.value - 0.72) * 18
        if self.shake_timer > 0:
            shake = max(shake, self.shake_timer / 0.36 * 13)
        if shake > 0:
            cx += random.uniform(-shake, shake) * scale
            cy += random.uniform(-shake, shake) * scale
        if self.toy_index == 0:
            self.draw_apple(self.screen, cx, cy, scale)
        elif self.toy_index == 1:
            self.draw_blob(self.screen, cx, cy, scale)
        elif self.toy_index == 2:
            self.draw_crispy(self.screen, cx, cy, scale)
        elif self.toy_index == 3:
            self.draw_ramen(self.screen, cx, cy, scale)
        else:
            self.draw_jelly(self.screen, cx, cy, scale)
        self.draw_particles(self.screen)
        meter_w = min(300, int(w * 0.34))
        meter = pygame.Rect(w // 2 - meter_w // 2, int(h * 0.73), meter_w, 14)
        pygame.draw.rect(self.screen, (223, 212, 235), meter, border_radius=7)
        fill = meter.copy()
        meter_value = self.jelly_roundness if self.toy_index == 4 and self.jelly_roll_strength > 0.20 else clamp(self.spring.value)
        fill.width = int(meter.width * meter_value)
        pygame.draw.rect(self.screen, self.toy.accent, fill, border_radius=7)
        if self.toy_index == 4:
            if self.jelly_roll_strength > 0.20:
                label = f"ROLLING ROUND  |  form {round(self.jelly_roundness * 100):02d}%"
            elif clamp(self.spring.value) > 0.12:
                level = pressure_band(clamp(self.spring.value)).upper()
                label = f"{level} PRESSURE  |  FLATTENING"
            else:
                label = f"FORM {round(self.jelly_roundness * 100):02d}% ROUND  |  squeeze or roll"
        elif self.shell_broken:
            label = "POP! release to reseal the pack" if self.toy_index == 3 else "CRACK! release to regrow the shell"
        elif self.toy_index == 3 and self.ramen_armed:
            label = "READY! PULL YOUR HANDS APART"
        elif self.toy_index == 3 and self.spring.value > 0.72:
            label = "CAREFUL... THE SEAM IS READY"
        else:
            direction = "side squeeze" if self.squeeze_axis == "horizontal" else "squish level"
            label = f"{direction}  {round(clamp(self.spring.value) * 100):02d}%"
        text = self.font_small.render(label, True, INK)
        self.screen.blit(text, (meter.centerx - text.get_width() // 2, meter.y + 22))
        if self.toy_index == 3 and self.shell_broken:
            reward = self.font.render(self.ramen_reward, True, INK)
            reward_box = pygame.Rect(0, 0, reward.get_width() + 34, 42)
            reward_box.center = (w // 2, int(h * 0.65))
            pygame.draw.rect(self.screen, (255, 245, 184), reward_box, border_radius=21)
            pygame.draw.rect(self.screen, INK, reward_box, 2, border_radius=21)
            self.screen.blit(reward, (reward_box.x + 17, reward_box.y + 10))
        self.draw_status(self.screen, status, active, w)
        self.draw_help(self.screen, w, h)
        if self.flash_timer > 0:
            flash = pygame.Surface((w, h), pygame.SRCALPHA)
            flash.fill((255, 248, 205, int(175 * self.flash_timer / 0.11)))
            self.screen.blit(flash, (0, 0))
        if self.ripple_flash > 0 and self.toy_index == 4:
            flash = pygame.Surface((w, h), pygame.SRCALPHA)
            flash.fill((*RIPPLE_COLORS[self.collaborator], int(32 * self.ripple_flash / 0.55)))
            self.screen.blit(flash, (0, 0))
        pygame.display.flip()

    def run(self) -> None:
        try:
            while self.running:
                dt = self.clock.tick(FPS) / 1000.0
                self.handle_events()
                status, active = self.update(dt)
                self.draw(status, active)
        finally:
            self.camera.stop()
            pygame.quit()


def main() -> None:
    parser = argparse.ArgumentParser(description="SQUISH! interactive digital stress toy")
    parser.add_argument("--no-camera", action="store_true", help="start in keyboard/mouse mode without requesting webcam access")
    parser.add_argument("--camera-index", type=int, default=0, help="OpenCV camera number to use (default: 0)")
    args = parser.parse_args()
    try:
        SquishApp(camera_index=args.camera_index, use_camera=not args.no_camera).run()
    except KeyboardInterrupt:
        pygame.quit()
        sys.exit(0)


if __name__ == "__main__":
    main()
