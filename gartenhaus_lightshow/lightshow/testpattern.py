"""Testmuster: jede Lampe nacheinander kurz in einer Farbe, alle anderen in ihrer Grundfarbe."""

from __future__ import annotations

from dataclasses import dataclass, field

from .safety import RGB

TEST_COLOR: RGB = (0, 60, 200)  # Blau, max. Kanal ~78 %
BLACK: RGB = (0, 0, 0)

LEAD_IN_S = 1.0
ON_S = 1.5
GAP_S = 0.5
LEAD_OUT_S = 1.0


@dataclass(frozen=True)
class Step:
    channel_id: int
    start_s: float
    end_s: float


@dataclass(frozen=True)
class TestPattern:
    channels: tuple[int, ...]
    steps: tuple[Step, ...]
    duration_s: float
    color: RGB = TEST_COLOR
    base: dict[int, RGB] = field(default_factory=dict)

    def frame(self, t: float) -> dict[int, RGB]:
        """Farben aller Kanaele zum Zeitpunkt t (Sekunden seit Streamstart)."""
        frame = {channel: self.base.get(channel, BLACK) for channel in self.channels}
        for step in self.steps:
            if step.start_s <= t < step.end_s:
                frame[step.channel_id] = self.color
        return frame


def build_test_pattern(
    channel_order: list[int],
    *,
    lead_in_s: float = LEAD_IN_S,
    on_s: float = ON_S,
    gap_s: float = GAP_S,
    lead_out_s: float = LEAD_OUT_S,
    color: RGB = TEST_COLOR,
    base: dict[int, RGB] | None = None,
) -> TestPattern:
    """Ablauf fuer die Kanaele in der gegebenen Reihenfolge erzeugen."""
    if not channel_order:
        raise ValueError("Testablauf braucht mindestens einen Kanal")
    if len(set(channel_order)) != len(channel_order):
        raise ValueError("Kanal mehrfach im Testablauf")
    if min(on_s, gap_s) <= 0 or min(lead_in_s, lead_out_s) < 0:
        raise ValueError("Zeiten muessen positiv sein")
    steps: list[Step] = []
    t = lead_in_s
    for channel in channel_order:
        steps.append(Step(channel, t, t + on_s))
        t += on_s + gap_s
    duration = t - gap_s + lead_out_s
    return TestPattern(
        channels=tuple(channel_order),
        steps=tuple(steps),
        duration_s=duration,
        color=color,
        base=dict(base or {}),
    )
