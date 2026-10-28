"""Gemeinsame Fixtures: SIMULIERTE Bridge (CLIP per HTTP, DTLS auf 127.0.0.1:2100)."""

import asyncio
import time
from pathlib import Path

import pytest
from aiohttp import web

from lightshow.bridge import Credentials
from lightshow.credentials import CredentialStore
from lightshow.service import LightshowService, ServiceConfig
from lightshow.snapshot import restore_body_from_light
from sim.clip_bridge import BRIDGE_ID, SimulatedClipBridge
from sim.dtls_bridge import SimulatedDtlsBridge

MAPPING_FILE = Path(__file__).resolve().parent.parent / "gartenhaus_lightshow" / "mapping.yaml"
TEST_TIMING = {"lead_in_s": 0.2, "on_s": 0.3, "gap_s": 0.1, "lead_out_s": 0.2}
TEST_DURATION = 0.2 + 7 * 0.3 + 6 * 0.1 + 0.2


@pytest.fixture
async def clip():
    sim = SimulatedClipBridge()
    runner = web.AppRunner(sim.app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    port = site._server.sockets[0].getsockname()[1]
    sim.base_url = f"http://127.0.0.1:{port}"
    yield sim
    await runner.cleanup()


@pytest.fixture
def dtls(clip):
    server = SimulatedDtlsBridge(identity=clip.app_key, psk_hex=clip.client_key)
    yield server
    server.close()


def make_config(clip, data_dir: Path) -> ServiceConfig:
    return ServiceConfig(
        mapping_path=MAPPING_FILE,
        data_dir=data_dir,
        clip_base_url=clip.base_url,
        dtls_host="127.0.0.1",
        bridge_id=BRIDGE_ID,
        pattern_timing=TEST_TIMING,
        status_poll_s=0.5,
    )


def make_service(clip, data_dir: Path, *, paired: bool = True, on_status=None) -> LightshowService:
    if paired:
        CredentialStore(data_dir / "credentials.json").save(
            Credentials(clip.app_key, clip.client_key)
        )
    return LightshowService(make_config(clip, data_dir), on_status=on_status)


def assert_restored(clip) -> None:
    for light_id, initial in clip.initial_lights.items():
        assert restore_body_from_light(clip.lights[light_id]) == restore_body_from_light(initial), (
            initial["metadata"]["name"]
        )


async def wait_for(predicate, timeout: float = 10.0) -> None:
    deadline = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > deadline:
            raise TimeoutError("Bedingung nicht erreicht")
        await asyncio.sleep(0.02)
