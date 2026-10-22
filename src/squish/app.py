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


@dataclass
class Particle:
    x: float
    y: float
    vx: float
    vy: float
    life: float
    color: tuple[int, int, int]
    size: float


class SquishApp:
    def __init__(self, camera_index: int = 0, use_camera: bool = True) -> None:
        pygame.init()
        pygame.display.set_caption("SQUISH! — hand-powered stress toy")
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
        self.clock = pygame.time.Clock()
        self.font_big = pygame.font.SysFont("arialrounded", 56, bold=True)
        self.font = pygame.font.SysFont("arialrounded", 22, bold=True)
        self.font_small = pygame.font.SysFont("arialrounded", 16)
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
        self.pulse = 0.0
        self.running = True

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
                    self.spring.value = self.spring.velocity = 0.0
                    self.manual_target = 0.0

    def manual_input(self, dt: float) -> float | None:
        keys = pygame.key.get_pressed()
        mouse_pressed = pygame.mouse.get_pressed(num_buttons=3)[0]
        if keys[pygame.K_SPACE] or mouse_pressed:
            self.manual_target = min(1.0, self.manual_target + dt * 3.8)
            return self.manual_target
        if keys[pygame.K_DOWN] or keys[pygame.K_RIGHT]:
            self.manual_target = min(1.0, self.manual_target + dt * 1.6)
            return self.manual_target
        if keys[pygame.K_UP] or keys[pygame.K_LEFT]:
            self.manual_target = max(0.0, self.manual_target - dt * 1.6)
            return self.manual_target
        self.manual_target = max(0.0, self.manual_target - dt * 2.7)
        return None

    def spawn_pop(self, cx: float, cy: float) -> None:
        for _ in range(18):
            angle = random.uniform(math.pi, 2 * math.pi)
            speed = random.uniform(80, 230)
            self.particles.append(
                Particle(
                    cx,
                    cy,
                    math.cos(angle) * speed,
                    math.sin(angle) * speed,
                    random.uniform(0.45, 0.9),
                    random.choice((PINK, PURPLE, MINT, (255, 194, 82))),
                    random.uniform(3, 8),
                )
            )

    def update_particles(self, dt: float) -> None:
        alive = []
        for p in self.particles:
            p.life -= dt
            if p.life <= 0:
                continue
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.vy += 260 * dt
            p.vx *= 0.99
            alive.append(p)
        self.particles = alive

    def update(self, dt: float) -> tuple[str, bool]:
        camera_result = self.camera.read()
        manual = self.manual_input(dt)
        if manual is not None:
            self.target = manual
            status = "Manual squish"
            active = True
        elif camera_result.openness is not None:
            self.target = clamp(1.0 - camera_result.openness)
            self.manual_target = self.target
            status = camera_result.message
            active = camera_result.hand_visible
        else:
            self.target = self.manual_target
            status = camera_result.message
            active = False

        squish = self.spring.update(self.target, dt)
        if squish > 0.78 and self.last_squish <= 0.78:
            w, h = self.screen.get_size()
            self.spawn_pop(w * 0.5, h * 0.57)
            self.pulse = 1.0
        self.last_squish = squish
        self.pulse = max(0.0, self.pulse - dt * 2.4)
        self.update_particles(dt)
        return status, active

    def draw_blob(self, surface: pygame.Surface, cx: float, cy: float, scale: float) -> None:
        s = clamp(self.spring.value)
        width = 290 * (1.0 + 0.46 * s) * scale
        height = 310 * (1.0 - 0.48 * s) * scale
        bounce = math.sin(pygame.time.get_ticks() * 0.004) * 4 * (1 - s)
        cy += 45 * s + bounce

        shadow_rect = pygame.Rect(0, 0, width * 0.82, 34 * scale)
        shadow_rect.center = (cx, cy + height * 0.48)
        pygame.draw.ellipse(surface, (218, 203, 231), shadow_rect)

        points = []
        count = 72
        now = pygame.time.get_ticks() * 0.002
        for i in range(count):
            angle = i / count * math.tau
            wobble = 1 + 0.025 * math.sin(angle * 5 + now) * (0.4 + s)
            x = cx + math.cos(angle) * width * 0.5 * wobble
            y = cy + math.sin(angle) * height * 0.5 * wobble
            points.append((x, y))

        # Layered outlines give the blob a tactile, sticker-like appearance.
        pygame.draw.polygon(surface, INK, points)
        inner = [
            (cx + (x - cx) * 0.955, cy + (y - cy) * 0.955) for x, y in points
        ]
        pygame.draw.polygon(surface, PURPLE, inner)

        highlight = pygame.Rect(0, 0, width * 0.33, height * 0.13)
        highlight.center = (cx - width * 0.17, cy - height * 0.25)
        pygame.draw.ellipse(surface, (175, 151, 255), highlight)

        eye_y = cy - height * (0.08 - 0.03 * s)
        eye_gap = width * 0.16
        eye_h = max(7 * scale, 25 * (1 - 0.72 * s) * scale)
        for eye_x in (cx - eye_gap, cx + eye_gap):
            pygame.draw.ellipse(
                surface,
                INK,
                pygame.Rect(eye_x - 8 * scale, eye_y - eye_h / 2, 16 * scale, eye_h),
            )

        mouth_width = (42 + 38 * s) * scale
        mouth_y = cy + height * 0.11
        mouth_rect = pygame.Rect(cx - mouth_width / 2, mouth_y, mouth_width, 18 * scale)
        pygame.draw.arc(surface, INK, mouth_rect, math.pi * 0.08, math.pi * 0.92, max(3, int(5 * scale)))

        if s > 0.52:
            cheek_r = int(10 * scale)
            pygame.draw.circle(surface, PINK, (int(cx - width * 0.28), int(eye_y + 25 * scale)), cheek_r)
            pygame.draw.circle(surface, PINK, (int(cx + width * 0.28), int(eye_y + 25 * scale)), cheek_r)

    def draw_status(self, surface: pygame.Surface, status: str, active: bool, w: int) -> None:
        label = status
        color = MINT if active else (255, 185, 84)
        text = self.font_small.render(label, True, INK)
        box_w = text.get_width() + 54
        box = pygame.Rect(w - box_w - 28, 26, box_w, 38)
        pygame.draw.rect(surface, (255, 255, 255), box, border_radius=19)
        pygame.draw.rect(surface, (220, 210, 232), box, width=2, border_radius=19)
        pygame.draw.circle(surface, color, (box.x + 21, box.centery), 6)
        surface.blit(text, (box.x + 36, box.y + 10))

    def draw_help(self, surface: pygame.Surface, w: int, h: int) -> None:
        if not self.help_visible:
            hint = self.font_small.render("H  show controls", True, (118, 101, 133))
            surface.blit(hint, (26, h - 35))
            return
        panel = pygame.Rect(26, h - 132, min(660, w - 52), 104)
        pygame.draw.rect(surface, (255, 255, 255), panel, border_radius=22)
        pygame.draw.rect(surface, (224, 213, 235), panel, width=2, border_radius=22)
        line1 = self.font.render("Open hand = release   |   Close fist = squish", True, INK)
        line2 = self.font_small.render(
            "Fallback: hold SPACE or mouse  |  C camera  |  H help  |  R reset  |  ESC quit",
            True,
            (99, 80, 116),
        )
        surface.blit(line1, (panel.x + 22, panel.y + 20))
        surface.blit(line2, (panel.x + 22, panel.y + 62))

    def draw(self, status: str, active: bool) -> None:
        w, h = self.screen.get_size()
        self.screen.fill(BG)

        # Calm background shapes.
        pygame.draw.circle(self.screen, (234, 225, 250), (80, 90), 120)
        pygame.draw.circle(self.screen, (255, 225, 238), (w - 45, h - 30), 170)
        pygame.draw.circle(self.screen, (221, 247, 239), (w - 80, 150), 70)

        title = self.font_big.render("SQUISH!", True, INK)
        subtitle = self.font_small.render("A tiny hand-powered stress toy", True, (100, 82, 116))
        self.screen.blit(title, (30, 22))
        self.screen.blit(subtitle, (34, 84))

        scale = min(w / WIDTH, h / HEIGHT)
        self.draw_blob(self.screen, w * 0.5, h * 0.48, scale)

        for p in self.particles:
            alpha_scale = clamp(p.life * 2)
            pygame.draw.circle(self.screen, p.color, (int(p.x), int(p.y)), int(p.size * alpha_scale))

        meter_w = min(300, int(w * 0.34))
        meter = pygame.Rect(w // 2 - meter_w // 2, int(h * 0.72), meter_w, 14)
        pygame.draw.rect(self.screen, (223, 212, 235), meter, border_radius=7)
        fill = meter.copy()
        fill.width = int(meter.width * clamp(self.spring.value))
        pygame.draw.rect(self.screen, PINK, fill, border_radius=7)
        meter_text = self.font_small.render(
            f"squish level  {round(clamp(self.spring.value) * 100):02d}%", True, INK
        )
        self.screen.blit(meter_text, (meter.centerx - meter_text.get_width() // 2, meter.y + 22))

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
    parser.add_argument(
        "--no-camera",
        action="store_true",
        help="start in keyboard/mouse mode without requesting webcam access",
    )
    parser.add_argument(
        "--camera-index",
        type=int,
        default=0,
        help="OpenCV camera number to use (default: 0)",
    )
    args = parser.parse_args()
    try:
        SquishApp(camera_index=args.camera_index, use_camera=not args.no_camera).run()
    except KeyboardInterrupt:
        pygame.quit()
        sys.exit(0)


if __name__ == "__main__":
    main()

