"""Farbumrechnung fuer den Stream: Hue-Zustand (xy/Farbtemperatur + Helligkeit) -> 8-Bit-RGB.

Der Stream ueberschreibt alle Lampen im Bereich. Damit unbeteiligte Lampen in ihrer
Snapshot-Farbe bleiben, wird ihr Zustand vor dem Stream in RGB umgerechnet.

Umrechnung xy -> RGB nach der Formel aus der Hue-Entwicklerdoku (Wide-Gamut-Matrix, sRGB-Gamma).
Helligkeit: Hue-Dimmwert in Prozent wird linear auf den groessten RGB-Kanal abgebildet.
Ob die Bridge diese Helligkeit genauso darstellt, ist nur an der echten Bridge zu pruefen.
"""

from __future__ import annotations

from typing import Any

from .safety import RGB

BLACK: RGB = (0, 0, 0)


def xy_to_rgb(x: float, y: float, brightness_pct: float) -> RGB:
    """CIE-xy plus Helligkeit (0..100 %) in 8-Bit-RGB."""
    if brightness_pct <= 0:
        return BLACK
    y = max(y, 1e-6)
    z = 1.0 - x - y
    big_y = 1.0
    big_x = big_y / y * x
    big_z = big_y / y * z
    r = big_x * 1.656492 - big_y * 0.354851 - big_z * 0.255038
    g = -big_x * 0.707196 + big_y * 1.655397 + big_z * 0.036152
    b = big_x * 0.051713 - big_y * 0.121364 + big_z * 1.011530
    channels = [_gamma(max(0.0, c)) for c in (r, g, b)]
    peak = max(channels)
    if peak <= 0:
        return BLACK
    scale = min(100.0, brightness_pct) / 100.0 * 255.0 / peak
    return tuple(round(c * scale) for c in channels)  # type: ignore[return-value]


def _gamma(value: float) -> float:
    """Lineare Farbkomponente in sRGB-Gamma (Hue-Doku: reverse gamma correction)."""
    if value <= 0.0031308:
        return 12.92 * value
    return 1.055 * value ** (1.0 / 2.4) - 0.055


def mirek_to_xy(mirek: float) -> tuple[float, float]:
    """Farbtemperatur (Mirek) in CIE-xy (Planck-Kurve, Naeherung nach Kim et al.)."""
    kelvin = min(25000.0, max(1667.0, 1_000_000.0 / mirek))
    t = kelvin
    if t <= 4000:
        x = -0.2661239e9 / t**3 - 0.2343589e6 / t**2 + 0.8776956e3 / t + 0.179910
    else:
        x = -3.0258469e9 / t**3 + 2.1070379e6 / t**2 + 0.2226347e3 / t + 0.240390
    if t <= 2222:
        y = -1.1063814 * x**3 - 1.34811020 * x**2 + 2.18555832 * x - 0.20219683
    elif t <= 4000:
        y = -0.9549476 * x**3 - 1.37418593 * x**2 + 2.09137015 * x - 0.16748867
    else:
        y = 3.0817580 * x**3 - 5.87338670 * x**2 + 3.75112997 * x - 0.37001483
    return x, y


def base_rgb_from_light(light: dict[str, Any]) -> RGB:
    """Aktuellen Lampenzustand (CLIP v2) als RGB fuer den Stream."""
    if not light.get("on", {}).get("on", False):
        return BLACK
    brightness = light.get("dimming", {}).get("brightness")
    if not isinstance(brightness, (int, float)):
        brightness = 100.0
    temperature = light.get("color_temperature") or {}
    xy = (light.get("color") or {}).get("xy")
    if temperature.get("mirek_valid") and temperature.get("mirek"):
        x, y = mirek_to_xy(float(temperature["mirek"]))
    elif isinstance(xy, dict) and "x" in xy and "y" in xy:
        x, y = float(xy["x"]), float(xy["y"])
    else:
        x, y = mirek_to_xy(366.0)  # ~2730 K, Hue-Standardweiss
    return xy_to_rgb(x, y, float(brightness))


def blend(base: RGB, target: RGB, weight: float) -> RGB:
    """Linear zwischen zwei Farben mischen (weight 0 = base, 1 = target)."""
    w = min(1.0, max(0.0, weight))
    return tuple(round(b + (t - b) * w) for b, t in zip(base, target, strict=True))  # type: ignore[return-value]
