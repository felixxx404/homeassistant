"""Einstiegspunkt der App: Optionen lesen, Dienst ausfuehren."""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import re
import signal
import sys
from collections.abc import Callable
from pathlib import Path

from .area import AreaError
from .bridge import BridgeError
from .credentials import CredentialError
from .mapping import MappingError
from .service import ServiceConfig, ServiceError, run
from .snapshot import SnapshotError
from .stream import StreamLost

OPTIONS_PATH = Path("/data/options.json")
DATA_DIR = Path("/data")
MAPPING_PATH = Path(__file__).resolve().parent.parent / "mapping.yaml"

LOGGER = logging.getLogger("lightshow")

_BRIDGE_ID_RE = re.compile(r"^[0-9a-f]{16}$")


def bridge_host_from_options(options: dict[str, object]) -> str:
    """Feste IPv4-Adresse der Bridge aus den App-Optionen (DTLS-Socket ist IPv4)."""
    raw = str(options.get("bridge_host") or "").strip()
    try:
        address = ipaddress.ip_address(raw)
    except ValueError as err:
        raise ServiceError(f"bridge_host {raw!r} ist keine gueltige IP-Adresse") from err
    if address.version != 4:
        raise ServiceError(f"bridge_host {raw!r} muss eine IPv4-Adresse sein")
    return str(address)


def bridge_id_from_options(options: dict[str, object]) -> str:
    """Bridge-ID (16 Hex-Zeichen) aus den App-Optionen; schuetzt vor der falschen Bridge."""
    raw = str(options.get("bridge_id") or "").strip().lower()
    if not _BRIDGE_ID_RE.match(raw):
        raise ServiceError("bridge_id muss die 16-stellige Hex-ID der Gartenhaus-Bridge sein")
    return raw


def _read_options() -> dict[str, object]:
    try:
        options = json.loads(OPTIONS_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError) as err:
        raise ServiceError(f"App-Optionen {OPTIONS_PATH} nicht lesbar: {err}") from err
    if not isinstance(options, dict):
        raise ServiceError(f"App-Optionen {OPTIONS_PATH} sind kein Objekt")
    return options


KNOWN_ERRORS = (
    AreaError,
    BridgeError,
    CredentialError,
    MappingError,
    ServiceError,
    SnapshotError,
    StreamLost,
)


def _build_config() -> ServiceConfig:
    options = _read_options()
    host = bridge_host_from_options(options)
    bridge_id = bridge_id_from_options(options)
    LOGGER.info("Bridge-Adresse: %s", host)
    return ServiceConfig(
        mapping_path=MAPPING_PATH,
        data_dir=DATA_DIR,
        clip_base_url=f"https://{host}",
        dtls_host=host,
        bridge_id=bridge_id,
        run_test=bool(options.get("testlauf", False)),
    )


async def run_once_then_idle(build_config: Callable[[], ServiceConfig]) -> None:
    """Einmal ausfuehren, danach ohne Stream warten, bis die App gestoppt wird.

    Die App beendet sich nicht von selbst: Ein Supervisor-Watchdog wuerde sie sonst
    sofort neu starten und den Testlauf endlos wiederholen.
    """
    try:
        await run(build_config())
        LOGGER.info("Fertig. Die App bleibt ohne Stream aktiv, bis sie gestoppt wird.")
    except KNOWN_ERRORS as err:
        LOGGER.error("%s: %s", type(err).__name__, err)
        LOGGER.info(
            "Kein weiterer Versuch. Die App bleibt ohne Stream aktiv, bis sie gestoppt wird."
        )
    await asyncio.Event().wait()


async def _main() -> None:
    task = asyncio.current_task()
    assert task is not None
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, task.cancel)
    await run_once_then_idle(_build_config)


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    try:
        asyncio.run(_main())
    except asyncio.CancelledError:
        LOGGER.info("Dienst gestoppt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
