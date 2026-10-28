"""Ablauf des Dienstes: Wiederherstellung, Kopplung, Pruefung, Testlauf."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from .area import ResolvedArea, resolve_area
from .bridge import BridgeClient, Credentials
from .credentials import CredentialStore
from .mapping import LampMapping, load_mapping
from .snapshot import SnapshotStore, capture, restore
from .stream import EntertainmentStream, Streamer
from .testpattern import build_test_pattern

LOGGER = logging.getLogger(__name__)

DEVICE_TYPE = "gartenhaus_lightshow#ha_app"
PAIR_TIMEOUT_S = 60.0


class ServiceError(Exception):
    """Dienst muss abbrechen; Meldung ist fuer das App-Log gedacht."""


@dataclass
class ServiceConfig:
    mapping_path: Path
    data_dir: Path
    clip_base_url: str
    dtls_host: str
    bridge_id: str
    run_test: bool
    pattern_timing: dict[str, float] = field(default_factory=dict)
    streamer_factory: Callable[[], Streamer] | None = None
    status_poll_s: float | None = None


async def run(config: ServiceConfig) -> None:
    mapping = load_mapping(config.mapping_path)
    LOGGER.info("Mapping geladen: %d Lampen, Bereich %r", len(mapping.lamps), mapping.area_name)
    snapshot_store = SnapshotStore(config.data_dir / "snapshot.json")
    credentials = await _ensure_credentials(
        config, CredentialStore(config.data_dir / "credentials.json")
    )

    async with BridgeClient(config.clip_base_url, credentials.app_key) as client:
        bridge_id = await client.get_bridge_id()
        if bridge_id != config.bridge_id:
            raise ServiceError(
                f"Falsche Bridge: {bridge_id} statt {config.bridge_id} (App-Option bridge_id)"
            )

        await _restore_pending(client, snapshot_store)

        area = resolve_area(
            mapping,
            await client.get_entertainment_configurations(),
            await client.get_entertainment_services(),
        )
        _log_area(area)

        if not config.run_test:
            LOGGER.info("Testlauf ist in den App-Optionen ausgeschaltet; Dienst endet.")
            return
        if area.status != "inactive":
            raise ServiceError(
                f"Bereich {area.name!r} hat Status {area.status!r}; anderes Programm streamt?"
            )
        await _run_test(config, client, credentials, mapping, area, snapshot_store)


async def _ensure_credentials(config: ServiceConfig, store: CredentialStore) -> Credentials:
    credentials = store.load()
    if credentials is not None:
        return credentials
    LOGGER.warning(
        "Keine Kopplung vorhanden. Bitte JETZT den Link-Button der Gartenhaus-Bridge "
        "druecken (Wartezeit %d s).",
        PAIR_TIMEOUT_S,
    )
    async with BridgeClient(config.clip_base_url) as client:
        credentials = await client.pair(DEVICE_TYPE, timeout_s=PAIR_TIMEOUT_S)
    store.save(credentials)
    LOGGER.info("Kopplung erfolgreich, Zugangsdaten in /data gespeichert.")
    return credentials


async def _restore_pending(client: BridgeClient, store: SnapshotStore) -> None:
    pending = store.load()
    if pending is None:
        return
    created, snapshots = pending
    age_min = (time.time() - created) / 60
    LOGGER.warning(
        "Snapshot eines abgebrochenen Laufs gefunden (%.0f min alt), stelle Lampen wieder her.",
        age_min,
    )
    failed = await restore(client, snapshots)
    if failed:
        raise ServiceError("Wiederherstellen fehlgeschlagen fuer: " + ", ".join(failed))
    store.clear()
    LOGGER.info("Lampen aus altem Snapshot wiederhergestellt.")


async def _run_test(
    config: ServiceConfig,
    client: BridgeClient,
    credentials: Credentials,
    mapping: LampMapping,
    area: ResolvedArea,
    store: SnapshotStore,
) -> None:
    lamps = [(entry.lamp.light_id, entry.lamp.name) for entry in area.channels]
    snapshots = await capture(client, lamps)
    store.save(snapshots)
    LOGGER.info("Snapshot von %d Lampen gespeichert.", len(snapshots))

    pattern = build_test_pattern(
        [entry.channel_id for entry in area.channels], **config.pattern_timing
    )
    names = {entry.channel_id: entry.lamp.name for entry in area.channels}
    for step in pattern.steps:
        LOGGER.info(
            "Testlauf %4.1f s: %s (Kanal %d)", step.start_s, names[step.channel_id], step.channel_id
        )

    stream_kwargs: dict[str, object] = {}
    if config.streamer_factory is not None:
        stream_kwargs["streamer"] = config.streamer_factory()
    if config.status_poll_s is not None:
        stream_kwargs["status_poll_s"] = config.status_poll_s

    try:
        async with EntertainmentStream(
            client, config.dtls_host, credentials, area.area_id, **stream_kwargs
        ) as stream:
            await stream.play(pattern.frame, pattern.duration_s)
        LOGGER.info("Testlauf beendet, %d Frames gesendet.", stream.frames_sent)
    finally:
        failed = await restore(client, snapshots)
        if failed:
            LOGGER.error(
                "Wiederherstellen fehlgeschlagen fuer: %s. Snapshot bleibt in %s und wird "
                "beim naechsten Start erneut angewendet.",
                ", ".join(failed),
                store.path,
            )
        else:
            store.clear()
            LOGGER.info("Ursprungszustand aller %d Lampen wiederhergestellt.", len(snapshots))


def _log_area(area: ResolvedArea) -> None:
    LOGGER.info("Bereich %r gefunden (Status %s):", area.name, area.status)
    for entry in sorted(area.channels, key=lambda item: item.channel_id):
        LOGGER.info("  Kanal %d: %s", entry.channel_id, entry.lamp.name)
