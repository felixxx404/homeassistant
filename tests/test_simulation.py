"""SIMULATION: kompletter Ablauf gegen eine simulierte Bridge.

CLIP v2 laeuft als HTTP-Server im Test, DTLS als eigener PSK-Server auf 127.0.0.1:2100.
Diese Tests pruefen den Ablauf und die Bibliothek gegen eine nachgebaute Bridge.
Sie sind KEIN Nachweis, dass es mit der echten Hue Bridge funktioniert.
"""

import asyncio
import json
import time
from pathlib import Path

import pytest
from aiohttp import web

from lightshow import service
from lightshow.bridge import BridgeClient, PairingTimeout
from lightshow.credentials import CredentialStore
from lightshow.service import ServiceConfig, ServiceError, run
from lightshow.snapshot import restore_body_from_light
from lightshow.stream import StreamLost
from lightshow.testpattern import TEST_COLOR
from sim.clip_bridge import BRIDGE_ID, SimulatedClipBridge
from sim.dtls_bridge import SimulatedDtlsBridge

pytestmark = pytest.mark.simulation

MAPPING_FILE = Path(__file__).resolve().parent.parent / "gartenhaus_lightshow" / "mapping.yaml"
TIMING = {"lead_in_s": 0.2, "on_s": 0.3, "gap_s": 0.1, "lead_out_s": 0.2}
DURATION = 0.2 + 7 * 0.3 + 6 * 0.1 + 0.2
ORDER_IN_MAPPING = [5, 3, 4, 2, 0, 1, 6]  # 6G, 4G, 5G, 3G, 1G, 2G, 7G


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


def _config(clip, tmp_path, run_test=True):
    return ServiceConfig(
        mapping_path=MAPPING_FILE,
        data_dir=tmp_path,
        clip_base_url=clip.base_url,
        dtls_host="127.0.0.1",
        bridge_id=BRIDGE_ID,
        run_test=run_test,
        pattern_timing=TIMING,
        status_poll_s=0.5,
    )


def _assert_restored(clip):
    for light_id, initial in clip.initial_lights.items():
        assert restore_body_from_light(clip.lights[light_id]) == restore_body_from_light(initial), (
            initial["metadata"]["name"]
        )


async def test_sim_kopplung_testlauf_und_wiederherstellung(clip, dtls, tmp_path, caplog):
    caplog.set_level("INFO")
    await run(_config(clip, tmp_path))

    # Kopplung: Zugangsdaten gespeichert, nie im Log
    stored = CredentialStore(tmp_path / "credentials.json").load()
    assert stored.app_key == clip.app_key and stored.client_key == clip.client_key
    assert clip.client_key not in caplog.text and clip.app_key not in caplog.text
    assert clip.calls[0][2]["generateclientkey"] is True

    # Start/Stop ueber CLIP, DTLS-Handshake mit gueltigem Finished
    assert clip.area_actions() == ["start", "stop"]
    assert dtls.handshake_ok.is_set() and not dtls.errors

    frames = dtls.frames
    span = frames[-1].received - frames[0].received
    rate = (len(frames) - 1) / span
    assert 45 <= rate <= 52, f"Senderate {rate:.1f} Hz"
    assert span == pytest.approx(DURATION, abs=0.3)

    blue16 = tuple(v * 257 for v in TEST_COLOR)
    lit_order = []
    for frame in frames:
        assert frame.area_id == clip.area_id and frame.color_space == 0
        assert set(frame.channels) == set(range(7))
        lit = [ch for ch, rgb in frame.channels.items() if rgb != (0, 0, 0)]
        assert len(lit) <= 1
        if lit:
            assert frame.channels[lit[0]] == blue16
            if not lit_order or lit_order[-1] != lit[0]:
                lit_order.append(lit[0])
    assert lit_order == ORDER_IN_MAPPING

    _assert_restored(clip)
    assert not (tmp_path / "snapshot.json").exists()


async def test_sim_verbindungsabbruch_dtls(clip, dtls, tmp_path):
    CredentialStore(tmp_path / "credentials.json").save(_creds(clip))
    task = asyncio.create_task(run(_config(clip, tmp_path)))
    await _wait_for(lambda: len(dtls.frames) > 20)
    dtls.close()  # Bridge/Netz weg
    with pytest.raises(StreamLost):
        await asyncio.wait_for(task, 10)
    assert clip.area_actions() == ["start", "stop"]
    _assert_restored(clip)
    assert not (tmp_path / "snapshot.json").exists()


async def test_sim_bridge_beendet_stream(clip, dtls, tmp_path):
    CredentialStore(tmp_path / "credentials.json").save(_creds(clip))
    task = asyncio.create_task(run(_config(clip, tmp_path)))
    await _wait_for(lambda: len(dtls.frames) > 10)
    clip.area_status = "inactive"  # z. B. andere App uebernimmt
    with pytest.raises(StreamLost, match="Status"):
        await asyncio.wait_for(task, 10)
    _assert_restored(clip)


async def test_sim_dienst_wird_gestoppt(clip, dtls, tmp_path):
    CredentialStore(tmp_path / "credentials.json").save(_creds(clip))
    task = asyncio.create_task(run(_config(clip, tmp_path)))
    await _wait_for(lambda: len(dtls.frames) > 20)
    task.cancel()  # entspricht SIGTERM beim Stoppen der App
    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(task, 10)
    assert clip.area_actions() == ["start", "stop"]
    _assert_restored(clip)
    assert not (tmp_path / "snapshot.json").exists()


async def test_sim_wiederherstellung_nach_absturz(clip, tmp_path):
    CredentialStore(tmp_path / "credentials.json").save(_creds(clip))
    # Snapshot eines abgestuerzten Laufs; Lampen stehen noch in Testfarbe
    lights = [
        {
            "light_id": lid,
            "name": light["metadata"]["name"],
            "restore_body": restore_body_from_light(light),
        }
        for lid, light in clip.initial_lights.items()
    ]
    (tmp_path / "snapshot.json").write_text(
        json.dumps({"created": time.time() - 600, "lights": lights})
    )
    async with BridgeClient(clip.base_url, clip.app_key) as client:
        await client.start_area(clip.area_id)
        await client.stop_area(clip.area_id)
    clip.calls.clear()

    await run(_config(clip, tmp_path, run_test=False))
    _assert_restored(clip)
    assert not (tmp_path / "snapshot.json").exists()
    assert clip.area_actions() == []


async def test_sim_restore_fehler_behaelt_snapshot(clip, dtls, tmp_path, monkeypatch):
    monkeypatch.setattr("lightshow.snapshot.RESTORE_RETRY_DELAY_S", 0.01)
    CredentialStore(tmp_path / "credentials.json").save(_creds(clip))
    clip.fail_restore = True  # nach dem Stop scheitert jedes Lampen-PUT

    await run(_config(clip, tmp_path))
    assert (tmp_path / "snapshot.json").exists(), "Snapshot muss fuer den naechsten Start bleiben"


async def test_sim_link_button_nicht_gedrueckt(clip, tmp_path, monkeypatch):
    monkeypatch.setattr(service, "PAIR_TIMEOUT_S", 0.5)
    clip.link_button_pressed = False
    with pytest.raises(PairingTimeout):
        await run(_config(clip, tmp_path))
    assert not (tmp_path / "credentials.json").exists()


async def test_sim_falsche_bridge(clip, tmp_path):
    CredentialStore(tmp_path / "credentials.json").save(_creds(clip))
    clip.bridge_id = "fedcba9876543210"
    with pytest.raises(ServiceError, match="Falsche Bridge"):
        await run(_config(clip, tmp_path))
    assert clip.area_actions() == [] and clip.light_puts() == []


async def test_sim_bereich_schon_aktiv(clip, tmp_path):
    CredentialStore(tmp_path / "credentials.json").save(_creds(clip))
    clip.area_status = "active"
    with pytest.raises(ServiceError, match="anderes Programm"):
        await run(_config(clip, tmp_path))
    assert clip.area_actions() == [] and clip.light_puts() == []


def _creds(clip):
    from lightshow.bridge import Credentials

    return Credentials(clip.app_key, clip.client_key)


async def _wait_for(predicate, timeout=10.0):
    deadline = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > deadline:
            raise TimeoutError("Bedingung nicht erreicht")
        await asyncio.sleep(0.02)
