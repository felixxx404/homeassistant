"""SIMULATION: Steuerung wie aus Home Assistant ueber einen lokalen Mosquitto-Broker.

Home Assistant selbst ist hier nicht beteiligt; der Test spielt HA nach (Discovery lesen,
Buttons druecken) und nutzt die simulierte Bridge. Kein Nachweis fuer die echte Umgebung.
"""

import asyncio
import json
import shutil
import socket
import subprocess
import time

import aiomqtt
import pytest
from conftest import assert_restored, make_config, wait_for

from lightshow import __main__ as app
from lightshow.bridge import Credentials
from lightshow.credentials import CredentialStore
from lightshow.ha_mqtt import MqttSettings
from lightshow.service import STATUS_READY, STATUS_SHOW, STATUS_TEST

pytestmark = pytest.mark.simulation

MOSQUITTO = shutil.which("mosquitto") or "/usr/sbin/mosquitto"


@pytest.fixture
def broker(tmp_path):
    if not shutil.os.path.exists(MOSQUITTO):
        pytest.skip("mosquitto nicht installiert")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    conf = tmp_path / "mosquitto.conf"
    conf.write_text(f"listener {port} 127.0.0.1\nallow_anonymous true\npersistence false\n")
    proc = subprocess.Popen([MOSQUITTO, "-c", str(conf)], stderr=subprocess.DEVNULL)
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        with socket.socket() as sock:
            if sock.connect_ex(("127.0.0.1", port)) == 0:
                break
        time.sleep(0.05)
    yield port
    proc.terminate()
    proc.wait(timeout=5)


class FakeHomeAssistant:
    """Liest retained Topics wie HA und drueckt Buttons."""

    def __init__(self, port: int) -> None:
        self.port = port
        self.topics: dict[str, str] = {}
        self.status_history: list[str] = []

    async def run(self, ready: asyncio.Event) -> None:
        async with aiomqtt.Client("127.0.0.1", self.port, identifier="fake_ha") as client:
            self.client = client
            await client.subscribe("homeassistant/#")
            await client.subscribe("gartenhaus_lichtshow/#")
            ready.set()
            async for message in client.messages:
                text = message.payload.decode()
                self.topics[str(message.topic)] = text
                if str(message.topic) == "gartenhaus_lichtshow/state/status":
                    self.status_history.append(text)

    async def press(self, key: str, payload: str = "PRESS") -> None:
        await self.client.publish(f"gartenhaus_lichtshow/cmd/{key}", payload)


async def test_mqtt_steuerung_ende_zu_ende(broker, clip, dtls, tmp_path):
    CredentialStore(tmp_path / "credentials.json").save(Credentials(clip.app_key, clip.client_key))
    ha = FakeHomeAssistant(broker)
    ready = asyncio.Event()
    ha_task = asyncio.create_task(ha.run(ready))
    await ready.wait()

    async def settings():
        return MqttSettings("127.0.0.1", broker, None, None)

    app_task = asyncio.create_task(app.run_app(lambda: make_config(clip, tmp_path), settings))
    try:
        await wait_for(lambda: ha.topics.get("gartenhaus_lichtshow/availability") == "online")
        await wait_for(lambda: ha.topics.get("gartenhaus_lichtshow/state/status") == STATUS_READY)
        configs = [t for t in ha.topics if t.startswith("homeassistant/") and t.endswith("/config")]
        assert len(configs) == 5
        assert (
            json.loads(ha.topics["homeassistant/button/gartenhaus_lichtshow/start/config"])[
                "command_topic"
            ]
            == "gartenhaus_lichtshow/cmd/start"
        )
        assert ha.topics["gartenhaus_lichtshow/state/dauer"] == "15"

        # Dauer setzen (ungueltige Werte werden abgelehnt)
        await ha.press("dauer", "30")
        await wait_for(lambda: ha.topics.get("gartenhaus_lichtshow/state/dauer") == "30")
        await ha.press("dauer", "500")
        await asyncio.sleep(0.3)
        assert ha.topics["gartenhaus_lichtshow/state/dauer"] == "30"

        # Show starten, laufen lassen, stoppen
        await ha.press("start")
        await wait_for(lambda: ha.topics.get("gartenhaus_lichtshow/state/status") == STATUS_SHOW)
        attributes = json.loads(ha.topics["gartenhaus_lichtshow/state/attribute"])
        assert "endet_um" in attributes
        await wait_for(lambda: len(dtls.frames) > 30)
        await ha.press("start")  # zweiter Start waehrend der Show: ignoriert
        await ha.press("stop")
        await wait_for(lambda: ha.topics.get("gartenhaus_lichtshow/state/status") == STATUS_READY)
        assert clip.area_actions() == ["start", "stop"]
        assert_restored(clip)
        assert ha.status_history[-4:] == ["Startet", STATUS_SHOW, "Stoppt", STATUS_READY]
    finally:
        app_task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await app_task
    await wait_for(lambda: ha.topics.get("gartenhaus_lichtshow/availability") == "offline")
    ha_task.cancel()


async def test_mqtt_testlauf_button(broker, clip, dtls, tmp_path):
    CredentialStore(tmp_path / "credentials.json").save(Credentials(clip.app_key, clip.client_key))
    ha = FakeHomeAssistant(broker)
    ready = asyncio.Event()
    ha_task = asyncio.create_task(ha.run(ready))
    await ready.wait()

    async def settings():
        return MqttSettings("127.0.0.1", broker, None, None)

    app_task = asyncio.create_task(app.run_app(lambda: make_config(clip, tmp_path), settings))
    try:
        await wait_for(lambda: ha.topics.get("gartenhaus_lichtshow/state/status") == STATUS_READY)
        await ha.press("test")
        await wait_for(lambda: STATUS_TEST in ha.status_history)
        await wait_for(lambda: ha.topics.get("gartenhaus_lichtshow/state/status") == STATUS_READY)
        assert clip.area_actions() == ["start", "stop"]
        assert_restored(clip)
    finally:
        app_task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await app_task
        ha_task.cancel()
