"""Effekte, die aus den Raumkoordinaten der Mapping-Datei berechnet werden.

Welle: Ein weiches Lichtband laeuft entlang der Raumtiefe (Y) von der Waschbecken-Wand
(Y = 0) zur hinteren Wand und wieder zurueck. Jede Lampe mischt ihre Snapshot-Farbe mit
der Effektfarbe, je naeher das Band an ihrer Y-Position ist. Lampen fern vom Band bleiben
in ihrer Snapshot-Farbe.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .color import blend
from .safety import RGB

WAVE_COLOR: RGB = (40, 120, 255)  # kuehles Blau
WAVE_SWEEP_S = 8.0  # Dauer einer Richtung (vorne -> hinten)
WAVE_WIDTH_M = 1.2  # Breite des Bandes (Gauss-Sigma in Metern)
# Kleinere Anteile zaehlen als 0, damit Lampen fern vom Band exakt ihre Snapshot-Farbe zeigen.
WAVE_CUTOFF = 0.02


@dataclass(frozen=True)
class EffectLamp:
    channel_id: int
    y_m: float
    base: RGB


@dataclass(frozen=True)
class WaveEffect:
    lamps: tuple[EffectLamp, ...]
    depth_m: float
    color: RGB = WAVE_COLOR
    sweep_s: float = WAVE_SWEEP_S
    width_m: float = WAVE_WIDTH_M

    def __post_init__(self) -> None:
        if self.depth_m <= 0 or self.sweep_s <= 0 or self.width_m <= 0:
            raise ValueError("Tiefe, Dauer und Breite der Welle muessen > 0 sein")

    def band_position(self, t: float) -> float:
        """Y-Position des Bandes in Metern (Dreieck: hin und zurueck, ohne Sprung)."""
        phase = (t / self.sweep_s) % 2.0
        fraction = phase if phase <= 1.0 else 2.0 - phase
        return fraction * self.depth_m

    def weight(self, y_m: float, t: float) -> float:
        distance = y_m - self.band_position(t)
        weight = math.exp(-((distance / self.width_m) ** 2))
        return weight if weight >= WAVE_CUTOFF else 0.0

    def frame(self, t: float) -> dict[int, RGB]:
        return {
            lamp.channel_id: blend(lamp.base, self.color, self.weight(lamp.y_m, t))
            for lamp in self.lamps
        }
