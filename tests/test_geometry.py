"""Unit-Tests: Koordinaten-Validierung und Umrechnung (Grenzwerte 0, 4,0, 6,0, 3,2)."""

import math

import pytest

from lightshow.geometry import (
    CoordinateError,
    HuePosition,
    Position,
    Room,
    to_hue,
    validate_position,
)

ROOM = Room(4.0, 6.0, 3.2)


@pytest.mark.parametrize(
    "position",
    [
        Position(0.0, 0.0, 0.0),
        Position(4.0, 6.0, 3.2),
        Position(4.0, 0.0, 0.0),
        Position(0.0, 6.0, 0.0),
        Position(0.0, 0.0, 3.2),
        Position(2.0, 3.0, 1.6),
    ],
)
def test_grenzwerte_im_raum_gueltig(position):
    validate_position(ROOM, position)


@pytest.mark.parametrize(
    "position",
    [
        Position(-0.01, 0.0, 0.0),
        Position(4.01, 0.0, 0.0),
        Position(0.0, -0.01, 0.0),
        Position(0.0, 6.01, 0.0),
        Position(0.0, 0.0, -0.01),
        Position(0.0, 0.0, 3.21),
    ],
)
def test_ausserhalb_des_raums_abgelehnt(position):
    with pytest.raises(CoordinateError):
        validate_position(ROOM, position)


@pytest.mark.parametrize("value", [math.nan, math.inf, None, "1.0", True])
def test_keine_gueltige_zahl_abgelehnt(value):
    with pytest.raises(CoordinateError):
        validate_position(ROOM, Position(value, 1.0, 1.0))


def test_ecken_werden_auf_minus_eins_bis_eins_abgebildet():
    assert to_hue(ROOM, Position(0.0, 0.0, 0.0)) == HuePosition(-1.0, 1.0, -1.0)
    assert to_hue(ROOM, Position(4.0, 6.0, 3.2)) == HuePosition(1.0, -1.0, 1.0)
    assert to_hue(ROOM, Position(2.0, 3.0, 1.6)) == HuePosition(0.0, 0.0, 0.0)


def test_achsenrichtung():
    # rechts = +x, oben im Grundriss (Waschbecken-Wand) = +y, Decke = +z
    assert to_hue(ROOM, Position(4.0, 3.0, 1.6)).x == 1.0
    assert to_hue(ROOM, Position(2.0, 0.0, 1.6)).y == 1.0
    assert to_hue(ROOM, Position(2.0, 3.0, 3.2)).z == 1.0


def test_beispiel_deckenleuchte_rechts():
    # Grundriss: 1,2 m vom linken Rand + halbe Breite 0,15 m; 1,7 m von oben + halbe Laenge 0,5 m
    assert to_hue(ROOM, Position(1.35, 2.2, 3.2)) == HuePosition(-0.325, 0.2667, 1.0)


@pytest.mark.parametrize("dims", [(0, 6, 3.2), (4, -1, 3.2), (4, 6, math.nan)])
def test_ungueltiger_raum(dims):
    with pytest.raises(CoordinateError):
        Room(*dims)
