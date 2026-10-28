"""Unit-Tests: Farbumrechnung (Snapshot -> RGB) und Effekt Welle."""

import pytest

from lightshow.color import BLACK, base_rgb_from_light, blend, mirek_to_xy, xy_to_rgb
from lightshow.effects import WAVE_COLOR, EffectLamp, WaveEffect
from lightshow.safety import FlashGuard


def test_aus_ist_schwarz():
    assert base_rgb_from_light({"on": {"on": False}, "dimming": {"brightness": 80}}) == BLACK
    assert xy_to_rgb(0.3, 0.3, 0) == BLACK


def test_helligkeit_skaliert_groessten_kanal():
    assert max(xy_to_rgb(0.3127, 0.3290, 100)) == 255
    assert max(xy_to_rgb(0.3127, 0.3290, 50)) == 128
    assert max(xy_to_rgb(0.3127, 0.3290, 10)) == 26


def test_farbton_rot_und_blau():
    red = xy_to_rgb(0.6798, 0.3026, 100)
    assert red[0] == 255 and red[1] < 60 and red[2] < 60
    blue = xy_to_rgb(0.1532, 0.0475, 100)
    assert blue[2] == 255 and blue[0] < 80 and blue[1] < 40


@pytest.mark.parametrize(
    ("mirek", "x", "y"),
    [(153, 0.313, 0.323), (370, 0.459, 0.411), (500, 0.527, 0.413)],
)
def test_farbtemperatur_auf_planck_kurve(mirek, x, y):
    got_x, got_y = mirek_to_xy(mirek)
    assert got_x == pytest.approx(x, abs=0.005)
    assert got_y == pytest.approx(y, abs=0.005)


def test_lampe_im_farbtemperatur_modus_ist_warm():
    light = {
        "on": {"on": True},
        "dimming": {"brightness": 40.0},
        "color_temperature": {"mirek": 430, "mirek_valid": True},
        "color": {"xy": {"x": 0.1, "y": 0.1}},  # wird im CT-Modus ignoriert
    }
    r, g, b = base_rgb_from_light(light)
    assert r == 102 and r > g > b


def test_blend():
    assert blend((0, 0, 0), (200, 100, 50), 0.0) == (0, 0, 0)
    assert blend((0, 0, 0), (200, 100, 50), 1.0) == (200, 100, 50)
    assert blend((0, 0, 0), (200, 100, 50), 0.5) == (100, 50, 25)
    assert blend((10, 10, 10), (20, 20, 20), 7) == (20, 20, 20)


LAMPS = (
    EffectLamp(5, 0.0, (59, 10, 9)),  # 6G, Y 0,0
    EffectLamp(4, 1.5, (0, 0, 0)),  # 5G, Y 1,5 (aus)
    EffectLamp(1, 4.5, (40, 40, 40)),  # 2G, Y 4,5
)


def test_welle_laeuft_hin_und_zurueck_ohne_sprung():
    wave = WaveEffect(LAMPS, depth_m=6.0, sweep_s=8.0)
    assert wave.band_position(0) == 0.0
    assert wave.band_position(4) == pytest.approx(3.0)
    assert wave.band_position(8) == pytest.approx(6.0)
    assert wave.band_position(12) == pytest.approx(3.0)
    assert wave.band_position(16) == pytest.approx(0.0)
    previous = wave.band_position(0)
    for i in range(1, 2000):
        position = wave.band_position(i * 0.02)
        assert abs(position - previous) <= 6.0 / 8.0 * 0.02 + 1e-9
        previous = position


def test_welle_erreicht_lampen_in_der_reihenfolge_ihrer_y_position():
    wave = WaveEffect(LAMPS, depth_m=6.0, sweep_s=8.0)
    peak_time = {}
    for i in range(400):
        t = i * 0.02
        for lamp in LAMPS:
            w = wave.weight(lamp.y_m, t)
            if w > peak_time.get(lamp.channel_id, (-1, 0))[0]:
                peak_time[lamp.channel_id] = (w, t)
    assert peak_time[5][1] < peak_time[4][1] < peak_time[1][1]
    assert all(w == pytest.approx(1.0, abs=0.01) for w, _ in peak_time.values())


def test_fern_vom_band_exakt_snapshot_farbe():
    wave = WaveEffect(LAMPS, depth_m=6.0)
    frame = wave.frame(0.0)
    assert frame[5] == WAVE_COLOR
    assert frame[1] == (40, 40, 40)


def test_welle_loest_keine_blitzbegrenzung_aus():
    wave = WaveEffect(LAMPS, depth_m=6.0)
    guard = FlashGuard()
    for i in range(50 * 60):
        t = i / 50
        frame = wave.frame(t)
        assert guard.apply(frame, t) == frame


def test_ungueltige_welle():
    with pytest.raises(ValueError):
        WaveEffect(LAMPS, depth_m=0)
