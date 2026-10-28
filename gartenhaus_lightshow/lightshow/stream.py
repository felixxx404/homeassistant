"""DTLS-Stream zur Entertainment-Area mit fester Senderate.

Ablauf: CLIP `action: start` -> DTLS-Handshake (hue-entertainment) -> Frames mit 50 Hz
-> beim Verlassen DTLS trennen und CLIP `action: stop`, auch bei Fehlern und Abbruch.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from contextlib import suppress
from typing import Protocol, Self

from hue_entertainment import HueDtlsStreamer, LightColorCommand

from .bridge import BridgeClient, BridgeError, Credentials
from .safety import MAX_SEND_RATE_HZ, RGB, SEND_RATE_HZ, FlashGuard

LOGGER = logging.getLogger(__name__)

STATUS_POLL_S = 2.0
STOP_SETTLE_S = 1.0


class StreamLost(Exception):
    """Stream wurde von der Bridge oder durch einen Netzfehler beendet."""


class Streamer(Protocol):
    @property
    def is_connected(self) -> bool: ...

    def connect(self, host: str, username: str, clientkey: str, area_id: str) -> None: ...

    def send_colors(self, commands: list[LightColorCommand]) -> None: ...

    def disconnect(self) -> None: ...


class EntertainmentStream:
    """Async-Kontextmanager fuer genau einen Stream."""

    def __init__(
        self,
        client: BridgeClient,
        dtls_host: str,
        credentials: Credentials,
        area_id: str,
        *,
        streamer: Streamer | None = None,
        rate_hz: float = SEND_RATE_HZ,
        guard: FlashGuard | None = None,
        status_poll_s: float = STATUS_POLL_S,
    ) -> None:
        if not 0 < rate_hz <= MAX_SEND_RATE_HZ:
            raise ValueError(f"Senderate muss 0 < rate <= {MAX_SEND_RATE_HZ} Hz sein")
        self._client = client
        self._host = dtls_host
        self._credentials = credentials
        self._area_id = area_id
        self._streamer = streamer if streamer is not None else HueDtlsStreamer()
        self._period = 1.0 / rate_hz
        self._guard = guard if guard is not None else FlashGuard()
        self._status_poll_s = status_poll_s
        self._started = False
        self.frames_sent = 0

    async def __aenter__(self) -> Self:
        await self._client.start_area(self._area_id)
        self._started = True
        loop = asyncio.get_running_loop()
        handshake = loop.run_in_executor(
            None,
            self._streamer.connect,
            self._host,
            self._credentials.app_key,
            self._credentials.client_key,
            self._area_id,
        )
        try:
            await asyncio.shield(handshake)
        except asyncio.CancelledError:
            # Der Handshake laeuft im Thread weiter; erst abwarten, dann sauber trennen,
            # sonst koennte danach ein verwaister Sender-Thread starten.
            with suppress(Exception):
                await handshake
            await self._shutdown()
            raise
        except (TimeoutError, OSError, ValueError) as err:
            await self._shutdown()
            raise StreamLost(f"DTLS-Handshake fehlgeschlagen: {type(err).__name__}: {err}") from err
        except BaseException:
            await self._shutdown()
            raise
        LOGGER.info("Stream offen (Bereich %s)", self._area_id)
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self._shutdown()

    async def play(self, frame_at: Callable[[float], dict[int, RGB]], duration_s: float) -> None:
        """Frames mit fester Rate senden, bis duration_s erreicht ist."""
        start = time.monotonic()
        next_tick = start
        next_poll = start + self._status_poll_s
        while True:
            now = time.monotonic()
            elapsed = now - start
            if elapsed >= duration_s:
                return
            if not self._streamer.is_connected:
                raise StreamLost("DTLS-Verbindung beendet")
            if now >= next_poll:
                await self._check_bridge_status()
                next_poll = now + self._status_poll_s

            frame = self._guard.apply(frame_at(elapsed), now)
            self._streamer.send_colors(
                [LightColorCommand(ch, *rgb) for ch, rgb in sorted(frame.items())]
            )
            self.frames_sent += 1

            next_tick += self._period
            delay = next_tick - time.monotonic()
            if delay < -self._period:
                # Nach einer Verzoegerung nicht nachholen, sondern neu takten.
                next_tick = time.monotonic()
                delay = 0.0
            await asyncio.sleep(max(0.0, delay))

    async def _check_bridge_status(self) -> None:
        try:
            config = await self._client.get_entertainment_configuration(self._area_id)
        except BridgeError as err:
            raise StreamLost(f"Bridge nicht erreichbar: {err}") from err
        if config.get("status") != "active":
            raise StreamLost(f"Bridge meldet Bereich-Status {config.get('status')!r}")

    async def _shutdown(self) -> None:
        loop = asyncio.get_running_loop()
        with suppress(Exception):
            await loop.run_in_executor(None, self._streamer.disconnect)
        if self._started:
            self._started = False
            try:
                await self._client.stop_area(self._area_id)
                LOGGER.info("Stream beendet (Bereich %s)", self._area_id)
            except BridgeError as err:
                LOGGER.error("Stop an der Bridge fehlgeschlagen: %s", err)
            await asyncio.sleep(STOP_SETTLE_S)
