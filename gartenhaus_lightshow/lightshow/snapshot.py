"""Snapshot & Restore der Lampenzustaende vor und nach dem Stream.

Der Snapshot wird vor dem Streamen in /data gespeichert. Bricht der Dienst hart ab
(Stromausfall, Absturz), stellt der naechste Start die Lampen daraus wieder her.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from .bridge import BridgeClient, BridgeError
from .color import BLACK, base_rgb_from_light
from .safety import RGB

LOGGER = logging.getLogger(__name__)

RESTORE_ATTEMPTS = 3
RESTORE_RETRY_DELAY_S = 1.0
RESTORE_SPACING_S = 0.15


class SnapshotError(Exception):
    """Snapshot nicht moeglich oder Wiederherstellung fehlgeschlagen."""


@dataclass(frozen=True)
class LightSnapshot:
    light_id: str
    name: str
    restore_body: dict[str, Any]
    # Farbe der Lampe vor dem Stream; damit bleiben unbeteiligte Lampen im Stream unveraendert.
    base_rgb: RGB = BLACK


def restore_body_from_light(light: dict[str, Any]) -> dict[str, Any]:
    """Aus einer CLIP-v2-Lampe den PUT-Body bauen, der den Zustand wiederherstellt."""
    if light.get("mode") == "streaming":
        raise SnapshotError(
            f"{_light_name(light)} ist bereits im Streaming-Modus (anderes Programm aktiv?)"
        )
    on = bool(light.get("on", {}).get("on", False))
    if not on:
        return {"on": {"on": False}}

    body: dict[str, Any] = {"on": {"on": True}}
    brightness = light.get("dimming", {}).get("brightness")
    if isinstance(brightness, (int, float)):
        body["dimming"] = {"brightness": brightness}

    effect_action = _effect_action(light)
    if effect_action is not None:
        body["effects_v2"] = {"action": effect_action}
        return body

    temperature = light.get("color_temperature") or {}
    xy = (light.get("color") or {}).get("xy")
    if temperature.get("mirek_valid") and temperature.get("mirek") is not None:
        body["color_temperature"] = {"mirek": temperature["mirek"]}
    elif isinstance(xy, dict) and "x" in xy and "y" in xy:
        body["color"] = {"xy": {"x": xy["x"], "y": xy["y"]}}
    return body


def _effect_action(light: dict[str, Any]) -> dict[str, Any] | None:
    status = (light.get("effects_v2") or {}).get("status") or {}
    effect = status.get("effect")
    if effect and effect != "no_effect":
        action: dict[str, Any] = {"effect": effect}
        params = status.get("parameters") or {}
        clean: dict[str, Any] = {}
        xy = (params.get("color") or {}).get("xy")
        if isinstance(xy, dict):
            clean["color"] = {"xy": {"x": xy["x"], "y": xy["y"]}}
        mirek = (params.get("color_temperature") or {}).get("mirek")
        if mirek is not None:
            clean["color_temperature"] = {"mirek": mirek}
        if isinstance(params.get("speed"), (int, float)):
            clean["speed"] = params["speed"]
        if clean:
            action["parameters"] = clean
        return action

    legacy = (light.get("effects") or {}).get("status")
    if legacy and legacy != "no_effect":
        return {"effect": legacy}
    return None


def _light_name(light: dict[str, Any]) -> str:
    return light.get("metadata", {}).get("name") or light.get("id", "Lampe")


async def capture(client: BridgeClient, lamps: list[tuple[str, str]]) -> list[LightSnapshot]:
    """Zustand aller Lampen lesen. lamps: Liste aus (light_id, name)."""
    snapshots: list[LightSnapshot] = []
    for light_id, name in lamps:
        light = await client.get_light(light_id)
        snapshots.append(
            LightSnapshot(
                light_id, name, restore_body_from_light(light), base_rgb_from_light(light)
            )
        )
    return snapshots


async def restore(client: BridgeClient, snapshots: list[LightSnapshot]) -> list[str]:
    """Alle Lampen zuruecksetzen. Gibt die Namen der Lampen zurueck, die scheiterten."""
    failed: list[str] = []
    for snapshot in snapshots:
        for attempt in range(1, RESTORE_ATTEMPTS + 1):
            try:
                await client.put_light(snapshot.light_id, snapshot.restore_body)
                break
            except BridgeError as err:
                LOGGER.warning(
                    "Wiederherstellen %s fehlgeschlagen (Versuch %d/%d): %s",
                    snapshot.name,
                    attempt,
                    RESTORE_ATTEMPTS,
                    err,
                )
                if attempt == RESTORE_ATTEMPTS:
                    failed.append(snapshot.name)
                else:
                    await asyncio.sleep(RESTORE_RETRY_DELAY_S)
        await asyncio.sleep(RESTORE_SPACING_S)
    return failed


class SnapshotStore:
    """Snapshot als JSON-Datei, damit ein Neustart nach Absturz wiederherstellen kann."""

    def __init__(self, path: Path) -> None:
        self._path = path

    @property
    def path(self) -> Path:
        return self._path

    def save(self, snapshots: list[LightSnapshot]) -> None:
        payload = {
            "created": time.time(),
            "lights": [asdict(snapshot) for snapshot in snapshots],
        }
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        os.replace(tmp, self._path)

    def load(self) -> tuple[float, list[LightSnapshot]] | None:
        if not self._path.exists():
            return None
        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
            snapshots = [
                LightSnapshot(**{**entry, "base_rgb": tuple(entry.get("base_rgb", BLACK))})
                for entry in payload["lights"]
            ]
            return float(payload["created"]), snapshots
        except (OSError, ValueError, KeyError, TypeError) as err:
            raise SnapshotError(f"Snapshot-Datei {self._path} ist beschaedigt: {err}") from err

    def clear(self) -> None:
        self._path.unlink(missing_ok=True)
