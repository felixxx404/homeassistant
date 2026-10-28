"""Unit-Tests: Blitzbegrenzung (hoechstens 3 Blitze je Sekunde) und Senderate."""

import pytest

from lightshow.safety import MAX_FLASHES_PER_SECOND, FlashGuard, clamp_rgb
from lightshow.testpattern import build_test_pattern

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)


def _count_onsets(frames):
    """Uebergaenge dunkel -> hell im Ausgang zaehlen (Zeitpunkte)."""
    onsets, dark = [], {}
    for t, frame in frames:
        hit = False
        for ch, rgb in frame.items():
            level = max(rgb) / 255
            if level <= 0.2:
                dark[ch] = True
            elif level >= 0.5 and dark.get(ch, True):
                dark[ch] = False
                hit = True
        if hit:
            onsets.append(t)
    return onsets


def _max_in_window(times, window=1.0):
    return max((sum(1 for u in times if t <= u < t + window) for t in times), default=0)


@pytest.mark.parametrize("strobe_hz", [5, 10, 25])
def test_strobe_wird_auf_3_blitze_pro_sekunde_begrenzt(strobe_hz):
    guard = FlashGuard()
    rate = 50
    out = []
    for i in range(rate * 4):
        t = i / rate
        on = int(t * strobe_hz * 2) % 2 == 0
        out.append((t, guard.apply({0: WHITE if on else BLACK, 1: WHITE if not on else BLACK}, t)))
    onsets = _count_onsets(out)
    assert onsets, "es muss weiterhin Blitze geben, nur begrenzt"
    assert _max_in_window(onsets) <= MAX_FLASHES_PER_SECOND


def test_gleichzeitige_kanaele_zaehlen_als_ein_blitz():
    guard = FlashGuard()
    frame = guard.apply({ch: WHITE for ch in range(7)}, 0.0)
    assert all(rgb == WHITE for rgb in frame.values())


def test_langsamer_wechsel_bleibt_unveraendert():
    guard = FlashGuard()
    for i in range(200):
        t = i / 50
        on = int(t) % 2 == 0  # 0,5 Hz
        frame = {0: WHITE if on else BLACK}
        assert guard.apply(frame, t) == frame


def test_testmuster_ueberschreitet_grenze_nicht():
    pattern = build_test_pattern([5, 3, 4, 2, 0, 1, 6])
    guard = FlashGuard()
    out, t = [], 0.0
    while t < pattern.duration_s:
        frame = pattern.frame(t)
        assert guard.apply(frame, t) == frame  # Waechter greift beim Testmuster nie ein
        out.append((t, frame))
        t += 1 / 50
    assert _max_in_window(_count_onsets(out)) <= 1


def test_mehr_als_3_blitze_nicht_konfigurierbar():
    with pytest.raises(ValueError):
        FlashGuard(max_flashes=4)


def test_farbwerte_auf_8_bit_begrenzt():
    assert clamp_rgb((300, -5, 128)) == (255, 0, 128)
