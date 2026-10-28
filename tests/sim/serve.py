"""SIMULATION: simulierte Bridge als eigenstaendiger Prozess (CLIP per HTTPS, DTLS auf 2100).

Fuer einen Probelauf des App-Containers ohne echte Bridge:
    python tests/sim/serve.py --cert cert.pem --key key.pem --port 443 --report report.json
Der Prozess laeuft bis SIGTERM/SIGINT und schreibt dann einen Bericht als JSON.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import signal
import ssl
import sys
from pathlib import Path

from aiohttp import web

_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path[:0] = [str(_ROOT / "tests"), str(_ROOT / "gartenhaus_lightshow")]

from lightshow.snapshot import restore_body_from_light
from sim.clip_bridge import SimulatedClipBridge
from sim.dtls_bridge import SimulatedDtlsBridge


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cert", required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=443)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()

    clip = SimulatedClipBridge()
    dtls = SimulatedDtlsBridge(identity=clip.app_key, psk_hex=clip.client_key, host=args.host)
    context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    context.load_cert_chain(args.cert, args.key)
    runner = web.AppRunner(clip.app)
    await runner.setup()
    await web.TCPSite(runner, args.host, args.port, ssl_context=context).start()
    print("SIMULIERTE Bridge bereit", flush=True)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    await stop.wait()

    restored = all(
        restore_body_from_light(clip.lights[lid]) == restore_body_from_light(initial)
        for lid, initial in clip.initial_lights.items()
    )
    frames = dtls.frames
    report = {
        "handshake_ok": dtls.handshake_ok.is_set(),
        "dtls_errors": dtls.errors,
        "frames": len(frames),
        "rate_hz": (len(frames) - 1) / (frames[-1].received - frames[0].received)
        if len(frames) > 1
        else 0,
        "area_actions": clip.area_actions(),
        "lights_restored": restored,
        "light_puts": len(clip.light_puts()),
    }
    Path(args.report).write_text(json.dumps(report, indent=2))
    dtls.close()
    await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
