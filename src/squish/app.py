"""Pygame application for SQUISH!."""

from __future__ import annotations

import argparse
import math
import random
import sys
from dataclasses import dataclass

import pygame

from .camera import HandCamera
from .gesture import SpringValue, clamp


WIDTH, HEIGHT = 1000, 700
FPS = 60
BG = (247, 241, 255)
INK = (46, 35, 61)
PURPLE = (117, 82, 255)
PINK = (255, 104, 166)
MINT = (86, 218, 182)


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


class SquishApp:
    def __init__(self, camera_index: int = 0, use_camera: bool = True) -> None:
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
        self.toy_index = 0
        self.shell_broken = False
        self.heal_timer = 0.0
        self.running = True

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
                elif event.key in (pygame.K_1, pygame.K_KP1):
                    self.select_toy(0)
                elif event.key in (pygame.K_2, pygame.K_KP2):
                    self.select_toy(1)
                elif event.key in (pygame.K_3, pygame.K_KP3):
                    self.select_toy(2)
                elif event.key == pygame.K_TAB:
                    self.select_toy(self.toy_index + 1)

    def manual_input(self, dt: float) -> tuple[float, str] | None:
        keys = pygame.key.get_pressed()
        mouse_pressed = pygame.mouse.get_pressed(num_buttons=3)[0]
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

    def spawn_pop(self, cx: float, cy: float, *, crispy: bool = False) -> None:
        palette = (self.toy.color, self.toy.accent, MINT, (255, 245, 200))
        for _ in range(28 if crispy else 18):
            angle = random.uniform(math.pi, 2 * math.pi)
            speed = random.uniform(100, 290 if crispy else 230)
            self.particles.append(Particle(cx, cy, math.cos(angle) * speed, math.sin(angle) * speed, random.uniform(0.55, 1.0), random.choice(palette), random.uniform(4, 10 if crispy else 8), crispy))

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
        if manual is not None:
            self.target, self.squeeze_axis = manual
            status = "Manual side squeeze" if self.squeeze_axis == "horizontal" else "Manual squish"
            active = True
        elif camera_result.horizontal_squish is not None:
            self.target = camera_result.horizontal_squish
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
        if self.toy_index == 2 and squish > 0.82 and not self.shell_broken:
            self.shell_broken = True
            w, h = self.screen.get_size()
            self.spawn_pop(w * 0.5, h * 0.49, crispy=True)
        elif self.toy_index != 2 and squish > 0.80 and self.last_squish <= 0.80:
            w, h = self.screen.get_size()
            self.spawn_pop(w * 0.5, h * 0.52)

        if self.shell_broken and squish < 0.12 and self.target < 0.08:
            self.heal_timer += dt
            if self.heal_timer > 0.9:
                self.shell_broken = False
                self.heal_timer = 0.0
        else:
            self.heal_timer = 0.0
        self.last_squish = squish
        self.update_particles(dt)
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
        surface.blit(self.font.render("1 hand: close fist   |   2 hands: move together", True, INK), (panel.x + 22, panel.y + 14))
        line = "SPACE = squish  |  SHIFT + SPACE = side squeeze  |  1 2 3 toys  |  C camera  |  R reset  |  ESC quit"
        surface.blit(self.font_tiny.render(line, True, (99, 80, 116)), (panel.x + 22, panel.y + 51))

    def draw(self, status: str, active: bool) -> None:
        w, h = self.screen.get_size()
        self.screen.fill(BG)
        pygame.draw.circle(self.screen, (234, 225, 250), (80, 90), 120)
        pygame.draw.circle(self.screen, (255, 225, 238), (w - 45, h - 30), 170)
        pygame.draw.circle(self.screen, (221, 247, 239), (w - 80, 150), 70)
        self.screen.blit(self.font_big.render("SQUISH!", True, INK), (30, 18))
        self.screen.blit(self.font_small.render(self.toy.tagline, True, (100, 82, 116)), (34, 79))
        self.draw_selector(self.screen)
        scale, cx, cy = min(w / WIDTH, h / HEIGHT), w * 0.5, h * 0.48
        if self.toy_index == 0:
            self.draw_apple(self.screen, cx, cy, scale)
        elif self.toy_index == 1:
            self.draw_blob(self.screen, cx, cy, scale)
        else:
            self.draw_crispy(self.screen, cx, cy, scale)
        self.draw_particles(self.screen)
        meter_w = min(300, int(w * 0.34))
        meter = pygame.Rect(w // 2 - meter_w // 2, int(h * 0.73), meter_w, 14)
        pygame.draw.rect(self.screen, (223, 212, 235), meter, border_radius=7)
        fill = meter.copy()
        fill.width = int(meter.width * clamp(self.spring.value))
        pygame.draw.rect(self.screen, self.toy.accent, fill, border_radius=7)
        if self.shell_broken:
            label = "CRACK! release to regrow the shell"
        else:
            direction = "side squeeze" if self.squeeze_axis == "horizontal" else "squish level"
            label = f"{direction}  {round(clamp(self.spring.value) * 100):02d}%"
        text = self.font_small.render(label, True, INK)
        self.screen.blit(text, (meter.centerx - text.get_width() // 2, meter.y + 22))
        self.draw_status(self.screen, status, active, w)
        self.draw_help(self.screen, w, h)
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
