"""Raumgeometrie: Validierung der Meter-Koordinaten und Umrechnung in Hue-Koordinaten.

Raum-Koordinaten (Meter), Ursprung oben links im Grundriss:
    X: 0 .. Breite  (links -> rechts)
    Y: 0 .. Tiefe   (oben/Waschbecken-Wand -> unten)
    Z: 0 .. Hoehe   (Boden -> Decke)

Hue-Koordinaten (normiert, -1 .. 1):
    x = 2 * X / Breite - 1   (links = -1, rechts = +1)
    y = 1 - 2 * Y / Tiefe    (oben im Grundriss = +1, unten = -1)
    z = 2 * Z / Hoehe - 1    (Boden = -1, Decke = +1)

Die Richtung der Achsen ist aus den Werten abgeleitet, die die Hue-App fuer den
Bereich "Gartenhaus (SYNC HA)" gespeichert hat. Gegen die offizielle Hue-Doku ist
sie nicht geprueft (developers.meethue.com war nicht erreichbar).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

HUE_MIN = -1.0
HUE_MAX = 1.0
HUE_DECIMALS = 4


class CoordinateError(ValueError):
    """Koordinate liegt ausserhalb des Raums oder ist keine gueltige Zahl."""


@dataclass(frozen=True)
class Room:
    """Quaderfoermiger Raum in Metern."""

    width_m: float
    depth_m: float
    height_m: float

    def __post_init__(self) -> None:
        for label, value in (
            ("Breite", self.width_m),
            ("Tiefe", self.depth_m),
            ("Hoehe", self.height_m),
        ):
            if not _is_number(value) or value <= 0:
                raise CoordinateError(f"Raum-{label} muss eine Zahl > 0 sein, ist {value!r}")


@dataclass(frozen=True)
class Position:
    """Position in Metern."""

    x: float
    y: float
    z: float


@dataclass(frozen=True)
class HuePosition:
    """Normierte Hue-Position (-1 .. 1)."""

    x: float
    y: float
    z: float


def validate_position(room: Room, position: Position) -> None:
    """Pruefen, dass die Position im Raum liegt (Grenzen inklusive)."""
    for axis, value, limit in (
        ("X", position.x, room.width_m),
        ("Y", position.y, room.depth_m),
        ("Z", position.z, room.height_m),
    ):
        if not _is_number(value):
            raise CoordinateError(f"{axis} muss eine Zahl sein, ist {value!r}")
        if value < 0.0 or value > limit:
            raise CoordinateError(f"{axis} = {value} m liegt ausserhalb von 0 .. {limit} m")


def to_hue(room: Room, position: Position) -> HuePosition:
    """Meter-Position in normierte Hue-Koordinaten umrechnen."""
    validate_position(room, position)
    x = 2.0 * position.x / room.width_m - 1.0
    y = 1.0 - 2.0 * position.y / room.depth_m
    z = 2.0 * position.z / room.height_m - 1.0
    return HuePosition(_round(x), _round(y), _round(z))


def _round(value: float) -> float:
    clamped = min(HUE_MAX, max(HUE_MIN, value))
    rounded = round(clamped, HUE_DECIMALS)
    # -0.0 vermeiden, damit Vergleiche und YAML-Ausgabe eindeutig bleiben.
    return 0.0 if rounded == 0 else rounded


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
