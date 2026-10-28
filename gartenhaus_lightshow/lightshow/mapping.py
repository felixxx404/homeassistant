"""Lampen-Mapping laden und pruefen.

Die Mapping-Datei ist die einzige Quelle fuer Lampen und Positionen. Zugeordnet wird
ueber die Hue-Lampen-ID (light resource id). Die Kanalnummer in der Datei ist nur der
Stand bei der Erfassung; der Dienst ermittelt den Kanal beim Start aus der Bridge.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from .geometry import CoordinateError, HuePosition, Position, Room, to_hue

HUE_TOLERANCE = 0.0005
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class MappingError(ValueError):
    """Mapping-Datei ist ungueltig."""


@dataclass(frozen=True)
class Lamp:
    """Eine Lampe im Entertainment-Bereich."""

    name: str
    light_id: str
    ha_entity: str
    channel_recorded: int
    position: Position
    hue_position: HuePosition


@dataclass(frozen=True)
class LampMapping:
    """Gesamtes Mapping inklusive Raum und Ziel-Bereich."""

    room: Room
    area_name: str
    lamps: tuple[Lamp, ...]


def load_mapping(path: Path) -> LampMapping:
    """Mapping-Datei lesen und vollstaendig pruefen."""
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as err:
        raise MappingError(f"Mapping-Datei {path} nicht lesbar: {err}") from err
    return parse_mapping(raw)


def parse_mapping(raw: Any) -> LampMapping:
    """Mapping aus bereits geladenem YAML pruefen."""
    data = _require_dict(raw, "Mapping")
    room_data = _require_dict(data.get("raum"), "raum")
    try:
        room = Room(
            width_m=room_data.get("breite_m"),
            depth_m=room_data.get("tiefe_m"),
            height_m=room_data.get("hoehe_m"),
        )
    except CoordinateError as err:
        raise MappingError(str(err)) from err

    area_name = _require_str(data.get("entertainment_bereich"), "entertainment_bereich")

    lamps_raw = data.get("lampen")
    if not isinstance(lamps_raw, list) or not lamps_raw:
        raise MappingError("lampen muss eine nicht leere Liste sein")

    lamps = tuple(_parse_lamp(room, entry, index) for index, entry in enumerate(lamps_raw))
    _require_unique([lamp.light_id for lamp in lamps], "light_id")
    _require_unique([lamp.name for lamp in lamps], "name")
    _require_unique([lamp.channel_recorded for lamp in lamps], "kanal")
    return LampMapping(room=room, area_name=area_name, lamps=lamps)


def _parse_lamp(room: Room, raw: Any, index: int) -> Lamp:
    where = f"lampen[{index}]"
    entry = _require_dict(raw, where)
    name = _require_str(entry.get("name"), f"{where}.name")
    where = f"Lampe {name!r}"

    light_id = _require_str(entry.get("light_id"), f"{where}: light_id").lower()
    if not _UUID_RE.match(light_id):
        raise MappingError(f"{where}: light_id {light_id!r} ist keine UUID")

    ha_entity = _require_str(entry.get("ha_entity"), f"{where}: ha_entity")
    if not ha_entity.startswith("light."):
        raise MappingError(f"{where}: ha_entity muss mit 'light.' beginnen")

    channel = entry.get("kanal")
    if not isinstance(channel, int) or isinstance(channel, bool) or not 0 <= channel <= 19:
        raise MappingError(f"{where}: kanal muss eine ganze Zahl von 0 bis 19 sein")

    pos_raw = _require_dict(entry.get("position_m"), f"{where}: position_m")
    position = Position(pos_raw.get("x"), pos_raw.get("y"), pos_raw.get("z"))
    try:
        computed = to_hue(room, position)
    except CoordinateError as err:
        raise MappingError(f"{where}: {err}") from err

    hue_raw = _require_dict(entry.get("position_hue"), f"{where}: position_hue")
    for axis in ("x", "y", "z"):
        stored = hue_raw.get(axis)
        expected = getattr(computed, axis)
        if not isinstance(stored, (int, float)) or isinstance(stored, bool):
            raise MappingError(f"{where}: position_hue.{axis} fehlt oder ist keine Zahl")
        if abs(stored - expected) > HUE_TOLERANCE:
            raise MappingError(
                f"{where}: position_hue.{axis} = {stored} passt nicht zu position_m "
                f"(erwartet {expected})"
            )

    return Lamp(
        name=name,
        light_id=light_id,
        ha_entity=ha_entity,
        channel_recorded=channel,
        position=position,
        hue_position=computed,
    )


def _require_dict(value: Any, where: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise MappingError(f"{where} muss ein Objekt sein")
    return value


def _require_str(value: Any, where: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise MappingError(f"{where} muss ein nicht leerer Text sein")
    return value.strip()


def _require_unique(values: list[Any], field: str) -> None:
    seen: set[Any] = set()
    for value in values:
        if value in seen:
            raise MappingError(f"{field} {value!r} kommt mehrfach vor")
        seen.add(value)
