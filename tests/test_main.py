"""Unit-Tests: Steuerung, Einstellungen, Discovery und Verhalten der App ohne Bridge."""

import asyncio
import json
from pathlib import Path

import pytest
import yaml

import lightshow.__main__ as app
from lightshow import __version__
from lightshow.controller import DURATION_DEFAULT, Settings, ShowController
from lightshow.ha_mqtt import AVAILABILITY_TOPIC, MqttUnavailable, discovery_messages
from lightshow.service import STATUS_ERROR, STATUS_READY, STATUS_STOPPING, ServiceError

CONFIG_FILE = Path(__file__).resolve().parent.parent / "gartenhaus_lightshow" / "config.yaml"


class FakeService:
    def __init__(self, fail: Exception | None = None) -> None:
        self.calls: list[tuple[str, float | None]] = []
        self.fail = fail
        self.release = asyncio.Event()

    async def run_show(self, duration_s: float) -> None:
        self.calls.append(("show", duration_s))
        if self.fail:
            raise self.fail
        await self.release.wait()

    async def run_test(self) -> None:
        self.calls.append(("test", None))
        await self.release.wait()


def _controller(tmp_path, service):
    statuses = []

    async def publish(status, attributes):
        statuses.append((status, attributes))

    return ShowController(service, Settings(tmp_path / "settings.json"), publish), statuses


def test_version_passt_zu_config_yaml():
    config = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8"))
    assert config["version"] == __version__
    assert config["services"] == ["mqtt:need"]
    assert "testlauf" not in config["options"]


def test_einstellungen_dauer(tmp_path):
    settings = Settings(tmp_path / "settings.json")
    assert settings.duration_min == DURATION_DEFAULT
    assert settings.set_duration(30.4) == 30
    assert Settings(tmp_path / "settings.json").duration_min == 30
    for bad in (0, 121, -5):
        with pytest.raises(ValueError):
            settings.set_duration(bad)
    assert settings.duration_min == 30


def test_einstellungen_beschaedigte_datei(tmp_path):
    (tmp_path / "settings.json").write_text("{kaputt")
    assert Settings(tmp_path / "settings.json").duration_min == DURATION_DEFAULT


async def test_show_nutzt_eingestellte_dauer_und_nur_ein_lauf(tmp_path):
    service = FakeService()
    controller, _ = _controller(tmp_path, service)
    controller.settings.set_duration(20)
    assert controller.start_show() is True
    await asyncio.sleep(0)
    assert controller.start_test() is False  # laeuft schon
    assert controller.start_show() is False
    service.release.set()
    await asyncio.sleep(0.05)
    assert service.calls == [("show", 1200.0)]
    assert controller.status == STATUS_READY


async def test_stopp_bricht_lauf_ab(tmp_path):
    service = FakeService()
    controller, statuses = _controller(tmp_path, service)
    controller.start_show()
    await asyncio.sleep(0.01)
    await controller.stop()
    assert not controller.busy
    assert [s for s, _ in statuses] == [STATUS_STOPPING, STATUS_READY]
    await controller.stop()  # ohne Lauf: nichts passiert


async def test_fehler_im_lauf_meldet_status_fehler(tmp_path):
    service = FakeService(fail=ServiceError("anderes Programm streamt?"))
    controller, statuses = _controller(tmp_path, service)
    controller.start_show()
    await asyncio.sleep(0.05)
    assert controller.status == STATUS_ERROR
    assert "anderes Programm" in str(statuses[-1][1]["fehler"])
    assert controller.start_show() is True  # nach Fehler wieder startbar


def test_discovery_entitaeten():
    messages = dict(discovery_messages())
    topics = sorted(messages)
    assert topics == [
        "homeassistant/button/gartenhaus_lichtshow/start/config",
        "homeassistant/button/gartenhaus_lichtshow/stop/config",
        "homeassistant/button/gartenhaus_lichtshow/test/config",
        "homeassistant/number/gartenhaus_lichtshow/dauer/config",
        "homeassistant/sensor/gartenhaus_lichtshow/status/config",
    ]
    unique_ids = {payload["unique_id"] for payload in messages.values()}
    assert len(unique_ids) == 5
    for payload in messages.values():
        assert payload["availability_topic"] == AVAILABILITY_TOPIC
        assert payload["device"]["identifiers"] == ["gartenhaus_lichtshow"]
        assert payload["device"]["sw_version"] == __version__
        json.dumps(payload)
    number = messages["homeassistant/number/gartenhaus_lichtshow/dauer/config"]
    assert (number["min"], number["max"], number["unit_of_measurement"]) == (1, 120, "min")


async def test_app_beendet_sich_nicht_bei_ungueltigen_optionen():
    def bad_config():
        raise ServiceError("bridge_id fehlt")

    async def no_mqtt():
        raise AssertionError("darf ohne gueltige Optionen nicht aufgerufen werden")

    task = asyncio.create_task(app.run_app(bad_config, no_mqtt))
    await asyncio.sleep(0.1)
    assert not task.done(), "App darf sich nicht selbst beenden (Watchdog-Schleife)"
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task


async def test_app_laeuft_weiter_ohne_mqtt_und_ohne_bridge(tmp_path, clip):
    from conftest import make_config

    clip.bridge_id = "fedcba9876543210"  # Vorbereitung scheitert

    async def no_mqtt():
        raise MqttUnavailable("kein Dienst")

    task = asyncio.create_task(app.run_app(lambda: make_config(clip, tmp_path), no_mqtt))
    await asyncio.sleep(0.5)
    assert not task.done()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task


async def test_unerwarteter_fehler_haengt_nicht_in_startet(tmp_path):
    service = FakeService(fail=RuntimeError("unerwartet"))
    controller, _ = _controller(tmp_path, service)
    controller.start_show()
    await asyncio.sleep(0.05)
    assert controller.status == STATUS_ERROR
    assert not controller.busy
