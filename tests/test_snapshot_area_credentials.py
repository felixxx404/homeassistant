"""Unit-Tests: Snapshot-Body, Snapshot-Datei, Bereichszuordnung, Zugangsdaten."""

import copy
import stat
from pathlib import Path

import pytest

from lightshow.area import AreaError, resolve_area
from lightshow.bridge import Credentials
from lightshow.credentials import CredentialError, CredentialStore
from lightshow.mapping import load_mapping
from lightshow.snapshot import LightSnapshot, SnapshotError, SnapshotStore, restore_body_from_light
from sim.clip_bridge import LAMPS, SimulatedClipBridge

MAPPING_FILE = Path(__file__).resolve().parent.parent / "gartenhaus_lightshow" / "mapping.yaml"


# -- Snapshot-Body --


def test_snapshot_lampe_aus():
    assert restore_body_from_light({"on": {"on": False}, "dimming": {"brightness": 50}}) == {
        "on": {"on": False}
    }


def test_snapshot_xy_farbe():
    light = {
        "on": {"on": True},
        "dimming": {"brightness": 23.1},
        "color": {"xy": {"x": 0.68, "y": 0.30}},
        "color_temperature": {"mirek": None, "mirek_valid": False},
    }
    assert restore_body_from_light(light) == {
        "on": {"on": True},
        "dimming": {"brightness": 23.1},
        "color": {"xy": {"x": 0.68, "y": 0.30}},
    }


def test_snapshot_farbtemperatur():
    light = {
        "on": {"on": True},
        "dimming": {"brightness": 35.0},
        "color": {"xy": {"x": 0.56, "y": 0.39}},
        "color_temperature": {"mirek": 430, "mirek_valid": True},
    }
    body = restore_body_from_light(light)
    assert body["color_temperature"] == {"mirek": 430}
    assert "color" not in body


def test_snapshot_effekt_kerze():
    light = {
        "on": {"on": True},
        "dimming": {"brightness": 25.0},
        "color_temperature": {"mirek": 430, "mirek_valid": True},
        "effects_v2": {
            "status": {
                "effect": "candle",
                "parameters": {
                    "color_temperature": {"mirek": 430, "mirek_valid": True},
                    "speed": 0.5,
                },
            }
        },
    }
    body = restore_body_from_light(light)
    assert body["effects_v2"] == {
        "action": {
            "effect": "candle",
            "parameters": {"color_temperature": {"mirek": 430}, "speed": 0.5},
        }
    }
    assert "color_temperature" not in body


def test_snapshot_verweigert_lampe_im_streaming():
    with pytest.raises(SnapshotError, match="Streaming"):
        restore_body_from_light({"mode": "streaming", "on": {"on": True}})


def test_snapshot_datei_rundlauf(tmp_path):
    store = SnapshotStore(tmp_path / "snapshot.json")
    assert store.load() is None
    snaps = [LightSnapshot("id-1", "Lampe", {"on": {"on": False}})]
    store.save(snaps)
    created, loaded = store.load()
    assert loaded == snaps and created > 0
    store.clear()
    assert store.load() is None


def test_snapshot_datei_beschaedigt(tmp_path):
    path = tmp_path / "snapshot.json"
    path.write_text("{kaputt")
    with pytest.raises(SnapshotError):
        SnapshotStore(path).load()


# -- Bereich --


@pytest.fixture
def sim():
    return SimulatedClipBridge()


def _services(sim):
    return [
        {"id": ent, "renderer": True, "renderer_reference": {"rid": lid}}
        for lid, (_, ent, _) in LAMPS.items()
    ]


def test_bereich_zuordnung_ueber_light_id(sim):
    mapping = load_mapping(MAPPING_FILE)
    area = resolve_area(mapping, [sim.other_area(), sim.area_config()], _services(sim))
    assert area.area_id == sim.area_id
    by_light = {entry.lamp.light_id: entry.channel_id for entry in area.channels}
    assert by_light == {lid: channel for lid, (_, _, channel) in LAMPS.items()}


def test_bereich_mit_anderen_kanalnummern_bleibt_richtig(sim):
    mapping = load_mapping(MAPPING_FILE)
    config = sim.area_config()
    for channel in config["channels"]:
        channel["channel_id"] = 6 - channel["channel_id"]
    area = resolve_area(mapping, [config], _services(sim))
    service_to_light = {ent: lid for lid, (_, ent, _) in LAMPS.items()}
    for channel in config["channels"]:
        light_id = service_to_light[channel["members"][0]["service"]["rid"]]
        entry = next(e for e in area.channels if e.lamp.light_id == light_id)
        assert entry.channel_id == channel["channel_id"]


def test_bereich_fehlt(sim):
    with pytest.raises(AreaError, match="nicht auf der Bridge"):
        resolve_area(load_mapping(MAPPING_FILE), [sim.other_area()], _services(sim))


def test_bereich_ohne_eine_lampe(sim):
    config = sim.area_config()
    config["channels"] = config["channels"][:-1]
    with pytest.raises(AreaError, match="nicht im Bereich"):
        resolve_area(load_mapping(MAPPING_FILE), [config], _services(sim))


def test_bereich_mit_zusaetzlicher_lampe(sim):
    config = sim.area_config()
    extra = copy.deepcopy(config["channels"][0])
    extra["channel_id"] = 7
    extra["members"][0]["service"]["rid"] = "11111111-2222-4333-8444-555555555555"
    config["channels"].append(extra)
    with pytest.raises(AreaError, match="ohne Eintrag"):
        resolve_area(load_mapping(MAPPING_FILE), [config], _services(sim))


# -- Zugangsdaten --


def test_zugangsdaten_rechte_und_rundlauf(tmp_path):
    store = CredentialStore(tmp_path / "credentials.json")
    creds = Credentials("app-key", "0123456789ABCDEF0123456789ABCDEF")
    store.save(creds)
    mode = stat.S_IMODE((tmp_path / "credentials.json").stat().st_mode)
    assert mode == 0o600
    assert store.load() == creds
    assert "0123" not in repr(creds) and "app-key" not in repr(creds)


def test_zugangsdaten_ungueltiger_client_key(tmp_path):
    with pytest.raises(CredentialError):
        CredentialStore(tmp_path / "c.json").save(Credentials("app", "kein-hex"))
