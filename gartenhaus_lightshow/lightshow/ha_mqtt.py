"""Home-Assistant-Anbindung per MQTT-Discovery (Mosquitto-App).

Entitaeten (Geraet "Gartenhaus Lichtshow"):
    button.gartenhaus_lichtshow_starten   Show mit der eingestellten Dauer starten
    button.gartenhaus_lichtshow_stoppen   laufende Show oder Testlauf beenden
    button.gartenhaus_lichtshow_testlauf  Testlauf (jede Lampe kurz blau)
    number.gartenhaus_lichtshow_dauer     Dauer der Show in Minuten (1..120)
    sensor.gartenhaus_lichtshow_status    Bereit / Startet / Show laeuft / Testlauf laeuft / Stoppt / Fehler
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import suppress
from dataclasses import dataclass

import aiohttp
import aiomqtt

from . import __version__
from .controller import DURATION_MAX, DURATION_MIN, ShowController

LOGGER = logging.getLogger(__name__)

NODE_ID = "gartenhaus_lichtshow"
BASE = "gartenhaus_lichtshow"
DISCOVERY_PREFIX = "homeassistant"
AVAILABILITY_TOPIC = f"{BASE}/availability"
STATUS_TOPIC = f"{BASE}/state/status"
ATTRIBUTES_TOPIC = f"{BASE}/state/attribute"
DURATION_STATE_TOPIC = f"{BASE}/state/dauer"
COMMAND_TOPIC = f"{BASE}/cmd/"
HA_STATUS_TOPIC = f"{DISCOVERY_PREFIX}/status"
RECONNECT_DELAY_S = 10.0
SUPERVISOR_MQTT_URL = "http://supervisor/services/mqtt"

DEVICE = {
    "identifiers": [NODE_ID],
    "name": "Gartenhaus Lichtshow",
    "manufacturer": "Eigene App (Felix)",
    "model": "Hue Entertainment",
}


class MqttUnavailable(Exception):
    """Keine MQTT-Zugangsdaten vom Supervisor."""


@dataclass(frozen=True)
class MqttSettings:
    host: str
    port: int
    username: str | None
    password: str | None

    def __repr__(self) -> str:
        return f"MqttSettings(host={self.host!r}, port={self.port}, zugang=<verborgen>)"


async def mqtt_settings_from_supervisor() -> MqttSettings:
    """Zugangsdaten der Mosquitto-App ueber die Supervisor-API (config.yaml: mqtt:need)."""
    token = os.environ.get("SUPERVISOR_TOKEN")
    if not token:
        raise MqttUnavailable("SUPERVISOR_TOKEN fehlt (laeuft die App unter HA OS?)")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with (
            aiohttp.ClientSession(timeout=timeout) as session,
            session.get(SUPERVISOR_MQTT_URL, headers=headers) as resp,
        ):
            payload = await resp.json(content_type=None)
    except (aiohttp.ClientError, TimeoutError, ValueError) as err:
        raise MqttUnavailable(f"Supervisor-API nicht erreichbar: {err}") from err
    data = payload.get("data") if isinstance(payload, dict) else None
    if payload.get("result") != "ok" or not isinstance(data, dict):
        raise MqttUnavailable(f"Kein MQTT-Dienst: {payload.get('message', payload)}")
    return MqttSettings(
        host=data["host"],
        port=int(data["port"]),
        username=data.get("username"),
        password=data.get("password"),
    )


def discovery_messages() -> list[tuple[str, dict[str, object]]]:
    """Discovery-Konfigurationen (Topic, Payload) aller Entitaeten."""
    common = {
        "availability_topic": AVAILABILITY_TOPIC,
        "device": {**DEVICE, "sw_version": __version__},
    }

    def button(key: str, name: str, icon: str, category: str | None = None) -> tuple[str, dict]:
        payload: dict[str, object] = {
            **common,
            "name": name,
            "unique_id": f"{NODE_ID}_{key}",
            "command_topic": f"{COMMAND_TOPIC}{key}",
            "payload_press": "PRESS",
            "icon": icon,
        }
        if category:
            payload["entity_category"] = category
        return f"{DISCOVERY_PREFIX}/button/{NODE_ID}/{key}/config", payload

    return [
        button("start", "Starten", "mdi:play"),
        button("stop", "Stoppen", "mdi:stop"),
        button("test", "Testlauf", "mdi:lightbulb-on-outline", "config"),
        (
            f"{DISCOVERY_PREFIX}/number/{NODE_ID}/dauer/config",
            {
                **common,
                "name": "Dauer",
                "unique_id": f"{NODE_ID}_dauer",
                "command_topic": f"{COMMAND_TOPIC}dauer",
                "state_topic": DURATION_STATE_TOPIC,
                "min": DURATION_MIN,
                "max": DURATION_MAX,
                "step": 1,
                "mode": "box",
                "unit_of_measurement": "min",
                "icon": "mdi:timer-outline",
                "entity_category": "config",
            },
        ),
        (
            f"{DISCOVERY_PREFIX}/sensor/{NODE_ID}/status/config",
            {
                **common,
                "name": "Status",
                "unique_id": f"{NODE_ID}_status",
                "state_topic": STATUS_TOPIC,
                "json_attributes_topic": ATTRIBUTES_TOPIC,
                "icon": "mdi:television-ambient-light",
            },
        ),
    ]


class HaMqttBridge:
    """Verbindet die Steuerung mit Home Assistant und haelt die Verbindung."""

    def __init__(self, settings: MqttSettings) -> None:
        self._settings = settings
        self._client: aiomqtt.Client | None = None
        self._controller: ShowController | None = None
        self._background: set[asyncio.Task[None]] = set()

    def attach(self, controller: ShowController) -> None:
        self._controller = controller

    async def publish_status(self, status: str, attributes: dict[str, object]) -> None:
        if self._client is None:
            return
        with suppress(aiomqtt.MqttError):
            await self._client.publish(STATUS_TOPIC, status, retain=True)
            await self._client.publish(ATTRIBUTES_TOPIC, json.dumps(attributes), retain=True)

    async def run_forever(self) -> None:
        """Verbinden, Entitaeten anmelden, Befehle verarbeiten; bei Abbruch neu verbinden."""
        while True:
            try:
                await self._session()
            except aiomqtt.MqttError as err:
                self._client = None
                LOGGER.warning(
                    "MQTT-Verbindung getrennt (%s), neuer Versuch in %.0f s", err, RECONNECT_DELAY_S
                )
                await asyncio.sleep(RECONNECT_DELAY_S)

    async def _session(self) -> None:
        will = aiomqtt.Will(AVAILABILITY_TOPIC, "offline", retain=True)
        async with aiomqtt.Client(
            hostname=self._settings.host,
            port=self._settings.port,
            username=self._settings.username,
            password=self._settings.password,
            identifier=NODE_ID,
            will=will,
        ) as client:
            self._client = client
            try:
                await client.subscribe(f"{COMMAND_TOPIC}#")
                await client.subscribe(HA_STATUS_TOPIC)
                await self._announce()
                LOGGER.info("Mit MQTT verbunden, Entitaeten in Home Assistant angemeldet.")
                async for message in client.messages:
                    await self._handle(str(message.topic), message.payload)
            finally:
                with suppress(aiomqtt.MqttError):
                    await client.publish(AVAILABILITY_TOPIC, "offline", retain=True)
                self._client = None

    async def _announce(self) -> None:
        assert self._client is not None and self._controller is not None
        for topic, payload in discovery_messages():
            await self._client.publish(topic, json.dumps(payload), retain=True)
        await self._client.publish(AVAILABILITY_TOPIC, "online", retain=True)
        await self._client.publish(
            DURATION_STATE_TOPIC, str(self._controller.settings.duration_min), retain=True
        )
        await self.publish_status(self._controller.status, self._controller.attributes)

    async def _handle(self, topic: str, payload: object) -> None:
        assert self._controller is not None
        text = payload.decode("utf-8", "replace") if isinstance(payload, bytes) else str(payload)
        if topic == HA_STATUS_TOPIC:
            if text == "online":
                await self._announce()
            return
        command = topic.removeprefix(COMMAND_TOPIC)
        if command == "start":
            self._controller.start_show()
        elif command == "test":
            self._controller.start_test()
        elif command == "stop":
            self._spawn(self._controller.stop())
        elif command == "dauer":
            try:
                minutes = self._controller.settings.set_duration(float(text))
            except ValueError as err:
                LOGGER.warning("Dauer %r abgelehnt: %s", text, err)
                minutes = self._controller.settings.duration_min
            assert self._client is not None
            await self._client.publish(DURATION_STATE_TOPIC, str(minutes), retain=True)
        else:
            LOGGER.warning("Unbekannter Befehl %r", topic)

    def _spawn(self, coro: object) -> None:
        task = asyncio.ensure_future(coro)  # type: ignore[arg-type]
        self._background.add(task)
        task.add_done_callback(self._background.discard)
