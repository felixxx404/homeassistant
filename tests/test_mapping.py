"""Unit-Tests: Mapping-Datei (echte Datei und Fehlerfaelle)."""

import copy
from pathlib import Path

import pytest
import yaml

from lightshow.mapping import MappingError, load_mapping, parse_mapping

MAPPING_FILE = Path(__file__).resolve().parent.parent / "gartenhaus_lightshow" / "mapping.yaml"

EXPECTED = {
    # light_id: (Name, Kanal in SYNC HA, (X, Y, Z))
    "ff8ff4cb-4c72-4916-964c-30e035bee0cb": ("6G Waschbeckenlampe", 5, (0.40, 0.00, 2.10)),
    "040d1d3f-ec05-4c5b-b791-17738fa376ca": ("4G Schrankbeleuchtung", 3, (3.00, 0.10, 0.80)),
    "7d116f0f-a4db-46f1-9ac8-56ec8d74e876": ("5G Wandlampe", 4, (4.00, 1.50, 2.55)),
    "cbd921f1-772b-4291-aede-fd7e02fd3719": ("3G Deckenleuchte rechts", 2, (1.35, 2.20, 3.20)),
    "2820a787-833a-4f1f-8717-1c949e8e9a0e": ("1G Deckenleuchte links", 0, (1.35, 3.80, 3.20)),
    "2dd7a69c-e7ef-434c-b09f-d9e2c106e2b0": ("2G Wandlampe", 1, (4.00, 4.50, 2.55)),
    "83c16192-7e44-4a2b-a8d3-7c4a865ac0e1": ("7G Tischlampe", 6, (0.30, 4.00, 0.60)),
}


@pytest.fixture
def raw():
    return yaml.safe_load(MAPPING_FILE.read_text(encoding="utf-8"))


def test_echte_mapping_datei():
    mapping = load_mapping(MAPPING_FILE)
    assert mapping.area_name == "Gartenhaus (SYNC HA)"
    assert (mapping.room.width_m, mapping.room.depth_m, mapping.room.height_m) == (4.0, 6.0, 3.2)
    assert len(mapping.lamps) == 7
    for lamp in mapping.lamps:
        name, channel, (x, y, z) = EXPECTED[lamp.light_id]
        assert lamp.name == name
        assert lamp.channel_recorded == channel
        assert (lamp.position.x, lamp.position.y, lamp.position.z) == (x, y, z)
        assert all(
            -1.0 <= v <= 1.0
            for v in (lamp.hue_position.x, lamp.hue_position.y, lamp.hue_position.z)
        )


def test_laser_steckdose_nicht_im_mapping():
    mapping = load_mapping(MAPPING_FILE)
    assert "light.gartenhaus_laser" not in {lamp.ha_entity for lamp in mapping.lamps}


def test_falsch_berechneter_hue_wert_wird_erkannt(raw):
    raw["lampen"][0]["position_hue"]["z"] = 0.756  # Wert aus der Hue-App statt berechnet
    with pytest.raises(MappingError, match="position_hue.z"):
        parse_mapping(raw)


def test_position_ausserhalb_des_raums(raw):
    raw["lampen"][0]["position_m"]["z"] = 3.25
    with pytest.raises(MappingError, match="Z"):
        parse_mapping(raw)


def test_grenzwerte_als_lampenposition_gueltig(raw):
    lamp = raw["lampen"][0]
    lamp["position_m"] = {"x": 4.0, "y": 6.0, "z": 3.2}
    lamp["position_hue"] = {"x": 1.0, "y": -1.0, "z": 1.0}
    parse_mapping(raw)
    lamp["position_m"] = {"x": 0.0, "y": 0.0, "z": 0.0}
    lamp["position_hue"] = {"x": -1.0, "y": 1.0, "z": -1.0}
    parse_mapping(raw)


@pytest.mark.parametrize("field", ["light_id", "name", "kanal"])
def test_doppelte_eintraege(raw, field):
    raw["lampen"][1][field] = copy.deepcopy(raw["lampen"][0][field])
    with pytest.raises(MappingError, match="mehrfach"):
        parse_mapping(raw)


def test_ungueltige_light_id(raw):
    raw["lampen"][0]["light_id"] = "light.gartenhaus_6g"
    with pytest.raises(MappingError, match="UUID"):
        parse_mapping(raw)


def test_fehlendes_feld(raw):
    del raw["lampen"][0]["position_m"]
    with pytest.raises(MappingError, match="position_m"):
        parse_mapping(raw)
