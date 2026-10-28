"""Dienst: Bridge-Verbindung, Kopplung, Pruefung und genau ein Lauf (Show oder Test) zur Zeit.

Der Stream laeuft nur waehrend eines Laufs. Solange er laeuft, sind die Lampen fuer die
Hue-App und Automationen blockiert; deshalb endet jede Show nach der eingestellten Dauer.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path

from .area import ResolvedArea, resolve_area
from .bridge import BridgeClient, Credentials
from .credentials import CredentialStore
from .effects import EffectLamp, WaveEffect
from .mapping import LampMapping, load_mapping
from .safety import RGB
from .snapshot import LightSnapshot, SnapshotStore, capture, restore
from .stream import EntertainmentStream, Streamer
from .testpattern import build_test_pattern

LOGGER = logging.getLogger(__name__)

DEVICE_TYPE = "gartenhaus_lightshow#ha_app"
PAIR_TIMEOUT_S = 60.0

STATUS_READY = "Bereit"
STATUS_STARTING = "Startet"
STATUS_SHOW = "Show läuft"
STATUS_TEST = "Testlauf läuft"
STATUS_STOPPING = "Stoppt"
STATUS_ERROR = "Fehler"

StatusCallback = Callable[[str, dict[str, object]], Awaitable[None]]


class ServiceError(Exception):
    """Dienst muss abbrechen; Meldung ist fuer das App-Log gedacht."""


@dataclass
class ServiceConfig:
    mapping_path: Path
    data_dir: Path
    clip_base_url: str
    dtls_host: str
    bridge_id: str
    pattern_timing: dict[str, float] = field(default_factory=dict)
    streamer_factory: Callable[[], Streamer] | None = None
    status_poll_s: float | None = None


async def _no_status(status: str, attributes: dict[str, object]) -> None:
    return None


class LightshowService:
    """Haelt Mapping, Zugangsdaten und Bridge-Client; fuehrt Laeufe nacheinander aus."""

    def __init__(self, config: ServiceConfig, on_status: StatusCallback | None = None) -> None:
        self._config = config
        self._on_status = on_status or _no_status
        self._client: BridgeClient | None = None
        self._credentials: Credentials | None = None
        self._mapping: LampMapping | None = None
        self._store = SnapshotStore(config.data_dir / "snapshot.json")
        self._lock = asyncio.Lock()
        self._ready = False

    @property
    def mapping(self) -> LampMapping:
        if self._mapping is None:
            raise ServiceError("Dienst ist nicht vorbereitet")
        return self._mapping

    async def prepare(self) -> None:
        """Mapping laden, koppeln, Bridge pruefen, alten Snapshot wiederherstellen.

        Erst wenn alles geklappt hat, sind Laeufe moeglich. Ein Lauf ruft prepare() erneut
        auf, falls die Vorbereitung beim App-Start gescheitert ist (z. B. Bridge offline).
        """
        self._ready = False
        await self.close()
        self._mapping = load_mapping(self._config.mapping_path)
        LOGGER.info(
            "Mapping geladen: %d Lampen, Bereich %r",
            len(self._mapping.lamps),
            self._mapping.area_name,
        )
        self._credentials = await self._ensure_credentials()
        client = BridgeClient(self._config.clip_base_url, self._credentials.app_key)
        try:
            bridge_id = await client.get_bridge_id()
        except BaseException:
            await client.close()
            raise
        if bridge_id != self._config.bridge_id:
            await client.close()
            raise ServiceError(
                f"Falsche Bridge: {bridge_id} statt {self._config.bridge_id} (App-Option bridge_id)"
            )
        self._client = client
        await self._restore_pending()
        area = await self._resolve_area()
        _log_area(area)
        self._ready = True

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()
            self._client = None

    async def run_test(self) -> None:
        """Testlauf: jede Lampe nacheinander blau, alle anderen in ihrer Snapshot-Farbe."""

        def build(area: ResolvedArea, base: dict[int, RGB]) -> tuple[Callable, float]:
            pattern = build_test_pattern(
                [entry.channel_id for entry in area.channels],
                base=base,
                **self._config.pattern_timing,
            )
            names = {entry.channel_id: entry.lamp.name for entry in area.channels}
            for step in pattern.steps:
                LOGGER.info(
                    "Testlauf %4.1f s: %s (Kanal %d)",
                    step.start_s,
                    names[step.channel_id],
                    step.channel_id,
                )
            return pattern.frame, pattern.duration_s

        await self._run("Testlauf", STATUS_TEST, build)

    async def run_show(self, duration_s: float) -> None:
        """Show mit dem Effekt Welle fuer duration_s Sekunden."""
        if duration_s <= 0:
            raise ServiceError("Dauer der Show muss > 0 sein")

        def build(area: ResolvedArea, base: dict[int, RGB]) -> tuple[Callable, float]:
            effect = WaveEffect(
                lamps=tuple(
                    EffectLamp(entry.channel_id, entry.lamp.position.y, base[entry.channel_id])
                    for entry in area.channels
                ),
                depth_m=self.mapping.room.depth_m,
            )
            return effect.frame, duration_s

        await self._run("Show", STATUS_SHOW, build, ends_in_s=duration_s)

    async def _run(
        self,
        label: str,
        running_status: str,
        build: Callable[[ResolvedArea, dict[int, RGB]], tuple[Callable, float]],
        *,
        ends_in_s: float | None = None,
    ) -> None:
        if self._lock.locked():
            raise ServiceError("Es laeuft bereits eine Show oder ein Testlauf")
        async with self._lock:
            await self._on_status(STATUS_STARTING, {})
            if not self._ready:
                await self.prepare()
            client, credentials = self._require_ready()
            area = await self._resolve_area()
            if area.status != "inactive":
                raise ServiceError(
                    f"Bereich {area.name!r} hat Status {area.status!r}; anderes Programm streamt?"
                )
            snapshots = await capture(
                client, [(entry.lamp.light_id, entry.lamp.name) for entry in area.channels]
            )
            self._store.save(snapshots)
            LOGGER.info("Snapshot von %d Lampen gespeichert.", len(snapshots))
            base = _base_by_channel(area, snapshots)
            frame_at, duration_s = build(area, base)

            stream_kwargs: dict[str, object] = {}
            if self._config.streamer_factory is not None:
                stream_kwargs["streamer"] = self._config.streamer_factory()
            if self._config.status_poll_s is not None:
                stream_kwargs["status_poll_s"] = self._config.status_poll_s
            try:
                async with EntertainmentStream(
                    client, self._config.dtls_host, credentials, area.area_id, **stream_kwargs
                ) as stream:
                    attributes: dict[str, object] = {}
                    if ends_in_s is not None:
                        attributes["endet_um"] = _iso_in(ends_in_s)
                    await self._on_status(running_status, attributes)
                    try:
                        await stream.play(frame_at, duration_s)
                    finally:
                        await _shielded(self._on_status(STATUS_STOPPING, {}))
                LOGGER.info("%s beendet, %d Frames gesendet.", label, stream.frames_sent)
            finally:
                await _shielded(self._restore_after_run(client, snapshots))

    async def _restore_after_run(
        self, client: BridgeClient, snapshots: list[LightSnapshot]
    ) -> None:
        failed = await restore(client, snapshots)
        if failed:
            LOGGER.error(
                "Wiederherstellen fehlgeschlagen fuer: %s. Snapshot bleibt in %s und wird "
                "beim naechsten Start erneut angewendet.",
                ", ".join(failed),
                self._store.path,
            )
        else:
            self._store.clear()
            LOGGER.info("Ursprungszustand aller %d Lampen wiederhergestellt.", len(snapshots))

    def _require_ready(self) -> tuple[BridgeClient, Credentials]:
        if self._client is None or self._credentials is None:
            raise ServiceError("Dienst ist nicht vorbereitet")
        return self._client, self._credentials

    async def _resolve_area(self) -> ResolvedArea:
        client, _ = self._require_ready()
        return resolve_area(
            self.mapping,
            await client.get_entertainment_configurations(),
            await client.get_entertainment_services(),
        )

    async def _ensure_credentials(self) -> Credentials:
        store = CredentialStore(self._config.data_dir / "credentials.json")
        credentials = store.load()
        if credentials is not None:
            return credentials
        LOGGER.warning(
            "Keine Kopplung vorhanden. Bitte JETZT den Link-Button der Gartenhaus-Bridge "
            "druecken (Wartezeit %d s).",
            PAIR_TIMEOUT_S,
        )
        async with BridgeClient(self._config.clip_base_url) as client:
            credentials = await client.pair(DEVICE_TYPE, timeout_s=PAIR_TIMEOUT_S)
        store.save(credentials)
        LOGGER.info("Kopplung erfolgreich, Zugangsdaten in /data gespeichert.")
        return credentials

    async def _restore_pending(self) -> None:
        client, _ = self._require_ready()
        pending = self._store.load()
        if pending is None:
            return
        created, snapshots = pending
        LOGGER.warning(
            "Snapshot eines abgebrochenen Laufs gefunden (%.0f min alt), stelle Lampen wieder her.",
            (time.time() - created) / 60,
        )
        failed = await restore(client, snapshots)
        if failed:
            raise ServiceError("Wiederherstellen fehlgeschlagen fuer: " + ", ".join(failed))
        self._store.clear()
        LOGGER.info("Lampen aus altem Snapshot wiederhergestellt.")


def _base_by_channel(area: ResolvedArea, snapshots: list[LightSnapshot]) -> dict[int, RGB]:
    by_light = {snapshot.light_id: snapshot.base_rgb for snapshot in snapshots}
    return {entry.channel_id: by_light[entry.lamp.light_id] for entry in area.channels}


def _iso_in(seconds: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(time.time() + seconds))


async def _shielded(awaitable: Awaitable[None]) -> None:
    """Aufraeumen auch dann zu Ende fuehren, wenn der Lauf gerade abgebrochen wird."""
    task = asyncio.ensure_future(awaitable)
    try:
        await asyncio.shield(task)
    except asyncio.CancelledError:
        await task
        raise


def _log_area(area: ResolvedArea) -> None:
    LOGGER.info("Bereich %r gefunden (Status %s):", area.name, area.status)
    for entry in sorted(area.channels, key=lambda item: item.channel_id):
        LOGGER.info("  Kanal %d: %s", entry.channel_id, entry.lamp.name)
