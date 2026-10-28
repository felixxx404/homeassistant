"""Entertainment-Bereich auf der Bridge finden und gegen das Mapping pruefen."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from .mapping import Lamp, LampMapping

LOGGER = logging.getLogger(__name__)


class AreaError(Exception):
    """Bereich fehlt oder passt nicht zum Mapping."""


@dataclass(frozen=True)
class ChannelLamp:
    """Lampe mit dem Kanal, den die Bridge aktuell vorgibt."""

    lamp: Lamp
    channel_id: int


@dataclass(frozen=True)
class ResolvedArea:
    area_id: str
    name: str
    status: str
    channels: tuple[ChannelLamp, ...]


def resolve_area(
    mapping: LampMapping,
    configurations: list[dict[str, Any]],
    entertainment_services: list[dict[str, Any]],
) -> ResolvedArea:
    """Bereich per exaktem Namen finden und jede Lampe ueber ihre light_id einem Kanal zuordnen."""
    matches = [
        cfg
        for cfg in configurations
        if cfg.get("metadata", {}).get("name", cfg.get("name")) == mapping.area_name
    ]
    if not matches:
        raise AreaError(f"Entertainment-Bereich {mapping.area_name!r} nicht auf der Bridge")
    if len(matches) > 1:
        raise AreaError(f"Entertainment-Bereich {mapping.area_name!r} ist mehrfach vorhanden")
    config = matches[0]

    channel_by_service: dict[str, int] = {}
    for channel in config.get("channels", []):
        members = channel.get("members", [])
        if len(members) != 1:
            raise AreaError(
                f"Kanal {channel.get('channel_id')} hat {len(members)} Mitglieder, erwartet 1"
            )
        rid = members[0].get("service", {}).get("rid", "")
        channel_by_service[rid] = int(channel["channel_id"])

    service_by_light: dict[str, str] = {}
    for service in entertainment_services:
        light_rid = (service.get("renderer_reference") or {}).get("rid")
        if service.get("renderer") and light_rid:
            service_by_light[light_rid] = service["id"]

    resolved: list[ChannelLamp] = []
    used_services: set[str] = set()
    for lamp in mapping.lamps:
        service_id = service_by_light.get(lamp.light_id)
        if service_id is None:
            raise AreaError(f"{lamp.name}: kein Entertainment-Dienst fuer light_id {lamp.light_id}")
        if service_id not in channel_by_service:
            raise AreaError(f"{lamp.name}: Lampe ist nicht im Bereich {mapping.area_name!r}")
        channel_id = channel_by_service[service_id]
        if channel_id != lamp.channel_recorded:
            LOGGER.warning(
                "%s: Kanal auf der Bridge ist %d, im Mapping erfasst %d (Zuordnung ueber light_id)",
                lamp.name,
                channel_id,
                lamp.channel_recorded,
            )
        used_services.add(service_id)
        resolved.append(ChannelLamp(lamp=lamp, channel_id=channel_id))

    extra = set(channel_by_service) - used_services
    if extra:
        raise AreaError(
            f"Bereich enthaelt {len(extra)} Kanal/Kanaele ohne Eintrag im Mapping: "
            + ", ".join(sorted(extra))
        )

    return ResolvedArea(
        area_id=config["id"],
        name=mapping.area_name,
        status=str(config.get("status", "")),
        channels=tuple(resolved),
    )
