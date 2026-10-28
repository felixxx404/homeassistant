"""Unit-Tests: Ablauf des Testlaufs."""

import pytest

from lightshow.testpattern import BLACK, TEST_COLOR, build_test_pattern

ORDER = [5, 3, 4, 2, 0, 1, 6]


def test_jede_lampe_genau_einmal_in_reihenfolge():
    pattern = build_test_pattern(ORDER)
    assert [step.channel_id for step in pattern.steps] == ORDER
    for prev, step in zip(pattern.steps, pattern.steps[1:]):
        assert step.start_s >= prev.end_s


def test_immer_hoechstens_eine_lampe_an_und_alle_kanaele_im_frame():
    pattern = build_test_pattern(ORDER)
    t = 0.0
    while t < pattern.duration_s:
        frame = pattern.frame(t)
        assert set(frame) == set(ORDER)
        assert sum(1 for rgb in frame.values() if rgb != BLACK) <= 1
        t += 0.02


def test_zeitpunkte():
    pattern = build_test_pattern(ORDER, lead_in_s=1, on_s=1.5, gap_s=0.5, lead_out_s=1)
    assert pattern.frame(0.5) == {ch: BLACK for ch in ORDER}
    assert pattern.frame(1.0)[5] == TEST_COLOR
    assert pattern.frame(2.6)[5] == BLACK
    assert pattern.frame(3.0)[3] == TEST_COLOR
    assert pattern.duration_s == pytest.approx(1 + 7 * 1.5 + 6 * 0.5 + 1)


@pytest.mark.parametrize("order", [[], [1, 1]])
def test_ungueltige_reihenfolge(order):
    with pytest.raises(ValueError):
        build_test_pattern(order)
