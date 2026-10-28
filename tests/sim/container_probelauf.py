"""SIMULATION: App-Container wie unter HA OS steuern, aber gegen eine simulierte Umgebung.

Simuliert werden: Hue Bridge (CLIP per HTTPS, DTLS auf 2100), Supervisor-API fuer die
MQTT-Zugangsdaten (http://supervisor/services/mqtt) und Home Assistant (Buttons per MQTT).
Echt sind: das App-Image und ein lokaler Mosquitto-Broker. Kein Test an echter Hardware.

Aufruf (Docker, mosquitto und requirements-dev.txt noetig; Ports 80, 443, 2100 frei):
    python tests/sim/container_probelauf.py <image>
"""

from __future__ import annotations

import asyncio
import json
import shutil
import socket
import ssl
import sys
import tempfile
import time
from pathlib import Path

import aiomqtt
from aiohttp import web

_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path[:0] = [str(_ROOT / "tests"), str(_ROOT / "gartenhaus_lightshow")]

from lightshow.snapshot import restore_body_from_light
from sim.clip_bridge import BRIDGE_ID, SimulatedClipBridge
from sim.dtls_bridge import SimulatedDtlsBridge

TOPIC = "gartenhaus_lichtshow"


async def sh(*cmd: str, check: bool = True) -> str:
    """Prozess ausfuehren, ohne die Event-Loop (und damit die simulierte Bridge) zu blockieren."""
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
    )
    out, _ = await proc.communicate()
    if check and proc.returncode != 0:
        raise RuntimeError(f"{cmd[0]} fehlgeschlagen: {out.decode(errors='replace')}")
    return out.decode(errors="replace")


def free_port(host: str) -> int:
    with socket.socket() as sock:
        sock.bind((host, 0))
        return sock.getsockname()[1]


async def main(image: str) -> int:
    host = (
        await sh("docker", "network", "inspect", "bridge", "--format",
                 "{{(index .IPAM.Config 0).Gateway}}")
    ).strip()  # fmt: skip
    work = Path(tempfile.mkdtemp())
    (work / "data").mkdir()
    (work / "data" / "options.json").write_text(
        json.dumps({"bridge_host": host, "bridge_id": BRIDGE_ID})
    )
    await sh(
        "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
        "-keyout", str(work / "key.pem"), "-out", str(work / "cert.pem"), "-subj", "/CN=sim",
    )  # fmt: skip

    broker_port = free_port(host)
    (work / "mosquitto.conf").write_text(
        f"listener {broker_port} {host}\nallow_anonymous true\npersistence false\n"
    )
    broker = await asyncio.create_subprocess_exec(
        shutil.which("mosquitto") or "/usr/sbin/mosquitto",
        "-c",
        str(work / "mosquitto.conf"),
        stderr=asyncio.subprocess.DEVNULL,
    )

    clip = SimulatedClipBridge()
    dtls = SimulatedDtlsBridge(identity=clip.app_key, psk_hex=clip.client_key, host=host)
    context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    context.load_cert_chain(work / "cert.pem", work / "key.pem")
    clip_runner = web.AppRunner(clip.app)
    await clip_runner.setup()
    await web.TCPSite(clip_runner, host, 443, ssl_context=context).start()

    supervisor = web.Application()

    async def mqtt_service(request: web.Request) -> web.Response:
        if request.headers.get("Authorization") != "Bearer sim-token":
            return web.json_response({"result": "error", "message": "unauthorized"}, status=401)
        data = {"host": host, "port": broker_port, "ssl": False, "protocol": "3.1.1"}
        return web.json_response({"result": "ok", "data": data})

    supervisor.router.add_get("/services/mqtt", mqtt_service)
    sup_runner = web.AppRunner(supervisor)
    await sup_runner.setup()
    await web.TCPSite(sup_runner, host, 80).start()
    await asyncio.sleep(0.5)

    container = f"lightshow_probelauf_{int(time.time())}"
    await sh(
        "docker", "run", "-d", "--name", container, "-e", "SUPERVISOR_TOKEN=sim-token",
        "--add-host", f"supervisor:{host}", "-v", f"{work / 'data'}:/data", image,
    )  # fmt: skip

    topics: dict[str, str] = {}
    history: list[str] = []
    result = {}
    try:
        async with aiomqtt.Client(host, broker_port, identifier="sim_ha") as ha:
            await ha.subscribe(f"{TOPIC}/#")
            await ha.subscribe("homeassistant/#")

            async def collect() -> None:
                async for message in ha.messages:
                    topics[str(message.topic)] = message.payload.decode()
                    if str(message.topic) == f"{TOPIC}/state/status":
                        history.append(message.payload.decode())

            collector = asyncio.create_task(collect())

            async def wait(predicate, timeout=60.0) -> None:
                deadline = time.monotonic() + timeout
                while not predicate():
                    if time.monotonic() > deadline:
                        raise TimeoutError(f"Zeitueberschreitung, Status-Verlauf: {history}")
                    await asyncio.sleep(0.1)

            await wait(lambda: topics.get(f"{TOPIC}/state/status") == "Bereit")
            result["discovery_configs"] = sum(
                1 for t in topics if t.startswith("homeassistant/") and t.endswith("/config")
            )
            await ha.publish(f"{TOPIC}/cmd/test", "PRESS")
            await wait(lambda: "Testlauf läuft" in history)
            await wait(lambda: topics.get(f"{TOPIC}/state/status") == "Bereit")
            frames_after_test = len(dtls.frames)

            await ha.publish(f"{TOPIC}/cmd/start", "PRESS")
            await wait(lambda: topics.get(f"{TOPIC}/state/status") == "Show läuft")
            await asyncio.sleep(5)
            await ha.publish(f"{TOPIC}/cmd/stop", "PRESS")
            await wait(lambda: topics.get(f"{TOPIC}/state/status") == "Bereit")
            result["frames_test"] = frames_after_test
            result["frames_show"] = len(dtls.frames) - frames_after_test
            result["status_history"] = history

            # App stoppen, waehrend eine Show laeuft (wie "Stoppen" in der HA-App-Seite)
            await ha.publish(f"{TOPIC}/cmd/start", "PRESS")
            await wait(lambda: topics.get(f"{TOPIC}/state/status") == "Show läuft")
            await asyncio.sleep(3)
            await sh("docker", "stop", "-t", "60", container)
            await wait(lambda: topics.get(f"{TOPIC}/availability") == "offline", timeout=10)
            result["availability_nach_stop"] = topics[f"{TOPIC}/availability"]
            collector.cancel()
    finally:
        print(await sh("docker", "logs", container, check=False))
        await sh("docker", "rm", "-f", container, check=False)
        result["handshake_ok"] = dtls.handshake_ok.is_set()
        result["dtls_errors"] = dtls.errors
        result["area_actions"] = clip.area_actions()
        result["lights_restored"] = all(
            restore_body_from_light(clip.lights[lid]) == restore_body_from_light(initial)
            for lid, initial in clip.initial_lights.items()
        )
        dtls.close()
        await clip_runner.cleanup()
        await sup_runner.cleanup()
        broker.terminate()
        await broker.wait()
        shutil.rmtree(work, ignore_errors=True)
    print("Bericht der SIMULATION:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    ok = (
        result.get("lights_restored")
        and result.get("area_actions") == ["start", "stop"] * 3
        and result.get("discovery_configs") == 5
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1])))
