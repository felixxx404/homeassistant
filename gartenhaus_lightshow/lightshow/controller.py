"""Steuerung: nimmt Befehle an (Start, Stopp, Testlauf, Dauer) und meldet den Status.

Immer nur ein Lauf zur Zeit. Ein Stopp bricht den laufenden Lauf ab; das Aufraeumen
(Stream beenden, Lampen wiederherstellen) erledigt der Dienst selbst.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from contextlib import suppress
from pathlib import Path

from .area import AreaError
from .bridge import BridgeError
from .service import (
    STATUS_ERROR,
    STATUS_READY,
    STATUS_STOPPING,
    LightshowService,
    ServiceError,
)
from .snapshot import SnapshotError
from .stream import StreamLost

LOGGER = logging.getLogger(__name__)

DURATION_MIN = 1
DURATION_MAX = 120
DURATION_DEFAULT = 15

RUN_ERRORS = (AreaError, BridgeError, ServiceError, SnapshotError, StreamLost)

StatusPublisher = Callable[[str, dict[str, object]], Awaitable[None]]


class Settings:
    """Dauer der Show in Minuten, gespeichert in /data/settings.json."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self.duration_min = DURATION_DEFAULT
        try:
            value = json.loads(path.read_text(encoding="utf-8")).get("dauer_min")
            if isinstance(value, int) and DURATION_MIN <= value <= DURATION_MAX:
                self.duration_min = value
        except (OSError, ValueError, AttributeError):
            pass

    def set_duration(self, value: float) -> int:
        minutes = round(value)
        if not DURATION_MIN <= minutes <= DURATION_MAX:
            raise ValueError(f"Dauer muss {DURATION_MIN} bis {DURATION_MAX} Minuten sein")
        self.duration_min = minutes
        self._path.write_text(json.dumps({"dauer_min": minutes}), encoding="utf-8")
        return minutes


class ShowController:
    def __init__(
        self,
        service: LightshowService,
        settings: Settings,
        publish_status: StatusPublisher,
    ) -> None:
        self._service = service
        self._settings = settings
        self._publish = publish_status
        self._task: asyncio.Task[None] | None = None
        self.status = STATUS_READY
        self.attributes: dict[str, object] = {}

    @property
    def busy(self) -> bool:
        return self._task is not None and not self._task.done()

    @property
    def settings(self) -> Settings:
        return self._settings

    async def set_status(self, status: str, attributes: dict[str, object]) -> None:
        if status == self.status and attributes == self.attributes:
            return
        self.status = status
        self.attributes = attributes
        await self._publish(status, attributes)

    def start_show(self) -> bool:
        minutes = self._settings.duration_min
        return self._start(f"Show ({minutes} min)", self._service.run_show(minutes * 60.0))

    def start_test(self) -> bool:
        return self._start("Testlauf", self._service.run_test())

    def _start(self, label: str, run: Awaitable[None]) -> bool:
        if self.busy:
            LOGGER.warning("%s abgelehnt: es laeuft bereits ein Lauf.", label)
            if asyncio.iscoroutine(run):
                run.close()
            return False
        LOGGER.info("%s gestartet.", label)
        self._task = asyncio.create_task(self._guarded(label, run))
        return True

    async def _guarded(self, label: str, run: Awaitable[None]) -> None:
        try:
            await run
        except asyncio.CancelledError:
            LOGGER.info("%s gestoppt.", label)
            await self.set_status(STATUS_READY, {})
            raise
        except RUN_ERRORS as err:
            LOGGER.error("%s abgebrochen: %s: %s", label, type(err).__name__, err)
            await self.set_status(STATUS_ERROR, {"fehler": f"{type(err).__name__}: {err}"})
            return
        except Exception as err:
            # Unerwarteter Fehler: mit Traceback ins Log, Status nie auf "Startet" haengen lassen.
            LOGGER.exception("%s mit unerwartetem Fehler abgebrochen", label)
            await self.set_status(STATUS_ERROR, {"fehler": f"{type(err).__name__}: {err}"})
            return
        await self.set_status(STATUS_READY, {})

    async def stop(self) -> None:
        """Laufenden Lauf abbrechen und warten, bis Stream und Lampen aufgeraeumt sind."""
        if not self.busy:
            return
        assert self._task is not None
        await self.set_status(STATUS_STOPPING, {})
        self._task.cancel()
        with suppress(asyncio.CancelledError):
            await self._task
