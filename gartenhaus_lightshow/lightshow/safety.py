"""Sicherheitsgrenzen fuer den Stream.

Blitzbegrenzung: Ein Blitz ist ein Frame, in dem mindestens ein Kanal von dunkel
(Helligkeit <= 20 %) auf hell (>= 50 %) springt. Gleichzeitige Spruenge mehrerer Kanaele
zaehlen als ein Blitz. Im Raum sind hoechstens 3 Blitze je gleitender Sekunde erlaubt;
weitere werden unterdrueckt, der Kanal bleibt so lange auf seinem letzten Wert.
"""

from __future__ import annotations

from collections import deque

RGB = tuple[int, int, int]

MAX_FLASHES_PER_SECOND = 3
FLASH_WINDOW_S = 1.0
DARK_LEVEL = 0.2
BRIGHT_LEVEL = 0.5

# Senderate an die Bridge (Projektentscheidung). Die Bridge gibt laut Drittquellen
# hoechstens ~25 Hz per Zigbee an die Lampen weiter; offiziell nicht bestaetigt.
SEND_RATE_HZ = 50.0
MAX_SEND_RATE_HZ = 50.0


def clamp_rgb(rgb: RGB) -> RGB:
    """Farbe auf 8 Bit (0..255) begrenzen."""
    return (
        max(0, min(255, int(rgb[0]))),
        max(0, min(255, int(rgb[1]))),
        max(0, min(255, int(rgb[2]))),
    )


def _level(rgb: RGB) -> float:
    return max(rgb) / 255.0


class FlashGuard:
    """Begrenzt Blitze auf hoechstens MAX_FLASHES_PER_SECOND im ganzen Raum."""

    def __init__(
        self,
        max_flashes: int = MAX_FLASHES_PER_SECOND,
        window_s: float = FLASH_WINDOW_S,
    ) -> None:
        if not 1 <= max_flashes <= MAX_FLASHES_PER_SECOND:
            raise ValueError(f"max_flashes muss 1 bis {MAX_FLASHES_PER_SECOND} sein")
        self._max = max_flashes
        self._window = window_s
        self._events: deque[float] = deque()
        self._dark: dict[int, bool] = {}
        self._last: dict[int, RGB] = {}

    def apply(self, frame: dict[int, RGB], now: float) -> dict[int, RGB]:
        """Frame pruefen und ggf. Blitz-Kanaele auf ihren letzten Wert halten."""
        while self._events and now - self._events[0] >= self._window:
            self._events.popleft()

        output: dict[int, RGB] = {}
        onsets: list[int] = []
        for channel, color in frame.items():
            rgb = clamp_rgb(color)
            level = _level(rgb)
            dark = self._dark.get(channel, True)
            if level <= DARK_LEVEL:
                self._dark[channel] = True
            elif level >= BRIGHT_LEVEL and dark:
                onsets.append(channel)
            output[channel] = rgb

        if onsets:
            if len(self._events) >= self._max:
                for channel in onsets:
                    output[channel] = self._last.get(channel, (0, 0, 0))
            else:
                self._events.append(now)
                for channel in onsets:
                    self._dark[channel] = False

        self._last.update(output)
        return output
