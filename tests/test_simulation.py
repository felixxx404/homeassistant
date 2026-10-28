"""SIMULATION: Dienst gegen eine simulierte Bridge (CLIP per HTTP, eigener DTLS-PSK-Server).

Diese Tests pruefen Ablauf und Bibliothek gegen eine nachgebaute Bridge.
Sie sind KEIN Nachweis, dass es mit der echten Hue Bridge funktioniert.
"""

import asyncio
import json
import time

import pytest
from conftest import TEST_DURATION, assert_restored, make_service, wait_for

from lightshow import service as service_module
from lightshow.bridge import BridgeClient, PairingTimeout
from lightshow.color import base_rgb_from_light
from lightshow.credentials import CredentialStore
from lightshow.effects import WAVE_COLOR
from lightshow.service import ServiceError
from lightshow.snapshot import restore_body_from_light
from lightshow.stream import StreamLost
from lightshow.testpattern import TEST_COLOR
from sim.clip_bridge import LAMPS

pytestmark = pytest.mark.simulation

ORDER_IN_MAPPING = [5, 3, 4, 2, 0, 1, 6]  # 6G, 4G, 5G, 3G, 1G, 2G, 7G
CHANNEL_BY_LIGHT = {lid: channel for lid, (_, _, channel) in LAMPS.items()}


def _base16(clip) -> dict[int, tuple[int, int, int]]:
    """Erwartete Grundfarbe je Kanal im Stream (16 Bit), aus dem Ausgangszustand."""
    return {
        CHANNEL_BY_LIGHT[lid]: tuple(v * 257 for v in base_rgb_from_light(light))
        for lid, light in clip.initial_lights.items()
    }


def _to16(rgb):
    return tuple(v * 257 for v in rgb)


async def test_sim_kopplung_testlauf_und_wiederherstellung(clip, dtls, tmp_path, caplog):
    caplog.set_level("INFO")
    service = make_service(clip, tmp_path, paired=False)
    await service.prepare()
    await service.run_test()
    await service.close()

    stored = CredentialStore(tmp_path / "credentials.json").load()
    assert stored.app_key == clip.app_key and stored.client_key == clip.client_key
    assert clip.client_key not in caplog.text and clip.app_key not in caplog.text
    assert clip.calls[0][2]["generateclientkey"] is True

    assert clip.area_actions() == ["start", "stop"]
    assert dtls.handshake_ok.is_set() and not dtls.errors

    frames = dtls.frames
    span = frames[-1].received - frames[0].received
    rate = (len(frames) - 1) / span
    assert 45 <= rate <= 52, f"Senderate {rate:.1f} Hz"
    assert span == pytest.approx(TEST_DURATION, abs=0.3)

    blue16 = _to16(TEST_COLOR)
    base16 = _base16(clip)
    lit_order = []
    for frame in frames:
        assert frame.area_id == clip.area_id and frame.color_space == 0
        assert set(frame.channels) == set(range(7))
        lit = [ch for ch, rgb in frame.channels.items() if rgb == blue16]
        assert len(lit) <= 1
        for channel, rgb in frame.channels.items():
            if channel not in lit:
                assert rgb == base16[channel], "unbeteiligte Lampe muss Snapshot-Farbe zeigen"
        if lit and (not lit_order or lit_order[-1] != lit[0]):
            lit_order.append(lit[0])
    assert lit_order == ORDER_IN_MAPPING

    assert_restored(clip)
    assert not (tmp_path / "snapshot.json").exists()


async def test_sim_show_welle_nutzt_raumkoordinaten(clip, dtls, tmp_path):
    service = make_service(clip, tmp_path)
    await service.prepare()
    await service.run_show(1.5)
    await service.close()

    frames = dtls.frames
    assert 60 <= len(frames) <= 80  # 1,5 s bei 50 Hz
    base16 = _base16(clip)
    wave16 = _to16(WAVE_COLOR)
    first = frames[0].channels
    # Band startet an der Waschbecken-Wand (Y = 0): 6G (Kanal 5) zeigt die Wellenfarbe.
    assert first[5] == wave16
    # 7G (Kanal 6, Y = 4,0 m) und 2G (Kanal 1, Y = 4,5 m) bleiben in ihrer Snapshot-Farbe.
    for frame in frames:
        assert frame.channels[6] == base16[6]
        assert frame.channels[1] == base16[1]
        for channel, rgb in frame.channels.items():
            for value, low, high in zip(rgb, base16[channel], wave16, strict=True):
                assert min(low, high) - 257 <= value <= max(low, high) + 257
    assert clip.area_actions() == ["start", "stop"]
    assert_restored(clip)


async def test_sim_zweiter_lauf_wird_abgelehnt(clip, dtls, tmp_path):
    service = make_service(clip, tmp_path)
    await service.prepare()
    first = asyncio.create_task(service.run_show(2.0))
    await wait_for(lambda: len(dtls.frames) > 5)
    with pytest.raises(ServiceError, match="bereits"):
        await service.run_test()
    await first
    await service.close()
    assert clip.area_actions() == ["start", "stop"]


async def test_sim_verbindungsabbruch_dtls(clip, dtls, tmp_path):
    service = make_service(clip, tmp_path)
    await service.prepare()
    task = asyncio.create_task(service.run_show(30))
    await wait_for(lambda: len(dtls.frames) > 20)
    dtls.close()  # Bridge/Netz weg
    with pytest.raises(StreamLost):
        await asyncio.wait_for(task, 10)
    await service.close()
    assert clip.area_actions() == ["start", "stop"]
    assert_restored(clip)
    assert not (tmp_path / "snapshot.json").exists()


async def test_sim_bridge_beendet_stream(clip, dtls, tmp_path):
    service = make_service(clip, tmp_path)
    await service.prepare()
    task = asyncio.create_task(service.run_show(30))
    await wait_for(lambda: len(dtls.frames) > 10)
    clip.area_status = "inactive"  # z. B. andere App uebernimmt
    with pytest.raises(StreamLost, match="Status"):
        await asyncio.wait_for(task, 10)
    await service.close()
    assert_restored(clip)


async def test_sim_show_wird_gestoppt(clip, dtls, tmp_path):
    service = make_service(clip, tmp_path)
    await service.prepare()
    task = asyncio.create_task(service.run_show(30))
    await wait_for(lambda: len(dtls.frames) > 20)
    task.cancel()  # Stopp-Button oder SIGTERM beim Stoppen der App
    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(task, 10)
    await service.close()
    assert clip.area_actions() == ["start", "stop"]
    assert_restored(clip)
    assert not (tmp_path / "snapshot.json").exists()


async def test_sim_wiederherstellung_nach_absturz(clip, tmp_path):
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
        await client.stop_area(clip.area_id)  # Lampen stehen jetzt in der Testfarbe
    clip.calls.clear()

    service = make_service(clip, tmp_path)
    await service.prepare()
    await service.close()
    assert_restored(clip)
    assert not (tmp_path / "snapshot.json").exists()
    assert clip.area_actions() == []


async def test_sim_restore_fehler_behaelt_snapshot(clip, dtls, tmp_path, monkeypatch):
    monkeypatch.setattr("lightshow.snapshot.RESTORE_RETRY_DELAY_S", 0.01)
    service = make_service(clip, tmp_path)
    await service.prepare()
    clip.fail_restore = True  # nach dem Stop scheitert jedes Lampen-PUT
    await service.run_test()
    await service.close()
    assert (tmp_path / "snapshot.json").exists(), "Snapshot muss fuer den naechsten Start bleiben"


async def test_sim_link_button_nicht_gedrueckt(clip, tmp_path, monkeypatch):
    monkeypatch.setattr(service_module, "PAIR_TIMEOUT_S", 0.5)
    clip.link_button_pressed = False
    service = make_service(clip, tmp_path, paired=False)
    with pytest.raises(PairingTimeout):
        await service.prepare()
    assert not (tmp_path / "credentials.json").exists()


async def test_sim_falsche_bridge_kein_stream_auch_nicht_spaeter(clip, dtls, tmp_path):
    clip.bridge_id = "fedcba9876543210"
    service = make_service(clip, tmp_path)
    with pytest.raises(ServiceError, match="Falsche Bridge"):
        await service.prepare()
    with pytest.raises(ServiceError, match="Falsche Bridge"):
        await service.run_test()  # Lauf versucht die Vorbereitung erneut
    assert clip.area_actions() == [] and clip.light_puts() == []

    clip.bridge_id = "0123456789abcdef"  # richtige Bridge wieder erreichbar
    await service.run_test()
    await service.close()
    assert clip.area_actions() == ["start", "stop"]


async def test_sim_bereich_schon_aktiv(clip, tmp_path):
    service = make_service(clip, tmp_path)
    await service.prepare()
    clip.area_status = "active"
    with pytest.raises(ServiceError, match="anderes Programm"):
        await service.run_show(10)
    await service.close()
    assert clip.area_actions() == [] and clip.light_puts() == []


async def test_sim_bridge_antwortet_nicht_auf_dtls(clip, tmp_path, monkeypatch):
    """Kein DTLS-Server: Handshake-Timeout wird zu StreamLost, Lampen wiederhergestellt."""
    monkeypatch.setattr("hue_entertainment.dtls.HANDSHAKE_TIMEOUT", 0.3)
    service = make_service(clip, tmp_path)
    await service.prepare()
    with pytest.raises(StreamLost, match="Handshake"):
        await asyncio.wait_for(service.run_show(10), 30)
    await service.close()
    assert clip.area_actions() == ["start", "stop"]
    assert_restored(clip)


async def test_sim_zwei_laeufe_nacheinander(clip, dtls, tmp_path):
    service = make_service(clip, tmp_path)
    await service.prepare()
    await service.run_show(0.5)
    await service.run_show(0.5)
    await service.close()
    assert clip.area_actions() == ["start", "stop", "start", "stop"]
    assert not dtls.errors
