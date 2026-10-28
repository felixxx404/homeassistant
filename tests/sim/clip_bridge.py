"""SIMULATION: CLIP-v2-REST-API der Gartenhaus-Bridge (HTTP statt HTTPS).

IDs, Kanaele und Bereichsname sind aus den HA-Diagnosedaten vom 28.10.2026 uebernommen.
Die Bereichs-ID ist dort maskiert; die Simulation nutzt eine eigene UUID.
Lampenzustaende sind Beispielwerte, nicht der echte Zustand.
"""

from __future__ import annotations

import copy
import uuid
from typing import Any

from aiohttp import web

BRIDGE_ID = "0123456789abcdef"  # Dummy, nicht die echte Bridge-ID
AREA_NAME = "Gartenhaus (SYNC HA)"

# light_id -> (Name, Entertainment-Dienst, Kanal in SYNC HA)
LAMPS = {
    "2820a787-833a-4f1f-8717-1c949e8e9a0e": (
        "1G Deckenleuchte",
        "e515ccbe-a148-44d9-ba54-bdf85cb7b1ff",
        0,
    ),
    "2dd7a69c-e7ef-434c-b09f-d9e2c106e2b0": (
        "2G Wandlampe",
        "129eea8c-44f7-4453-841a-67080449d9e4",
        1,
    ),
    "cbd921f1-772b-4291-aede-fd7e02fd3719": (
        "3G Deckenleuchte",
        "6a83ad97-3704-4478-a5d2-c41516a1fe21",
        2,
    ),
    "040d1d3f-ec05-4c5b-b791-17738fa376ca": (
        "4G Schrankbeleuchtung",
        "a8cab5f8-8c7e-4c61-b826-4b36c2b38132",
        3,
    ),
    "7d116f0f-a4db-46f1-9ac8-56ec8d74e876": (
        "5G Wandlampe",
        "0f3222ff-daaf-421a-8026-64043ec5a598",
        4,
    ),
    "ff8ff4cb-4c72-4916-964c-30e035bee0cb": (
        "6G Waschbeckenlampe",
        "9e18cb12-b6e6-424a-8ab4-c59cd52487c7",
        5,
    ),
    "83c16192-7e44-4a2b-a8d3-7c4a865ac0e1": (
        "7G Tischlampe",
        "d80d1f43-a2b0-46f0-ac90-6c06f376fce2",
        6,
    ),
}
LASER_LIGHT_ID = "9374b9ab-b502-4b18-bc82-7c8695d1f7aa"

STREAM_LEFTOVER_STATE = {
    "mode": "normal",
    "on": {"on": True},
    "dimming": {"brightness": 78.0},
    "color": {"xy": {"x": 0.153, "y": 0.048}},
    "color_temperature": {"mirek": None, "mirek_valid": False},
}


def _light(light_id: str, name: str, **state: Any) -> dict[str, Any]:
    light = {
        "id": light_id,
        "type": "light",
        "metadata": {"name": name},
        "mode": "normal",
        "on": {"on": True},
        "dimming": {"brightness": 25.0},
        "color_temperature": {"mirek": None, "mirek_valid": False},
        "color": {"xy": {"x": 0.6798, "y": 0.3026}},
        "effects_v2": {"status": {"effect": "no_effect", "effect_values": ["no_effect", "candle"]}},
    }
    light.update(state)
    return light


def default_lights() -> dict[str, dict[str, Any]]:
    lights = {lid: _light(lid, name) for lid, (name, _, _) in LAMPS.items()}
    # Beispiele fuer verschiedene Ausgangszustaende:
    lights["040d1d3f-ec05-4c5b-b791-17738fa376ca"].update(
        color_temperature={"mirek": 430, "mirek_valid": True},
        effects_v2={
            "status": {
                "effect": "candle",
                "parameters": {
                    "color_temperature": {"mirek": 430, "mirek_valid": True},
                    "speed": 0.5,
                },
            }
        },
    )
    lights["83c16192-7e44-4a2b-a8d3-7c4a865ac0e1"].update(
        color_temperature={"mirek": 430, "mirek_valid": True},
        color={"xy": {"x": 0.565, "y": 0.389}},
    )
    lights["2dd7a69c-e7ef-434c-b09f-d9e2c106e2b0"].update(on={"on": False})
    return lights


class SimulatedClipBridge:
    """SIMULATION der CLIP-v2-API inklusive Kopplung und Entertainment-Status."""

    def __init__(self) -> None:
        self.bridge_id = BRIDGE_ID
        self.app_key = "sim-app-key-" + uuid.uuid4().hex[:8]
        self.client_key = uuid.uuid4().hex.upper()
        self.link_button_pressed = True
        self.area_id = str(uuid.uuid4())
        self.area_status = "inactive"
        self.lights = default_lights()
        self.initial_lights = copy.deepcopy(self.lights)
        self.calls: list[tuple[str, str, Any]] = []
        self.fail_light_puts = 0
        self.fail_restore = False
        self.app = web.Application()
        self.app.router.add_post("/api", self._pair)
        self.app.router.add_get("/clip/v2/resource/bridge", self._bridge)
        self.app.router.add_get("/clip/v2/resource/entertainment_configuration", self._areas)
        self.app.router.add_get("/clip/v2/resource/entertainment_configuration/{id}", self._area)
        self.app.router.add_put(
            "/clip/v2/resource/entertainment_configuration/{id}", self._area_action
        )
        self.app.router.add_get("/clip/v2/resource/entertainment", self._entertainment)
        self.app.router.add_get("/clip/v2/resource/light/{id}", self._get_light)
        self.app.router.add_put("/clip/v2/resource/light/{id}", self._put_light)

    # -- Hilfen fuer Tests --

    def area_config(self) -> dict[str, Any]:
        channels = [
            {
                "channel_id": channel,
                "position": {"x": 0, "y": 0, "z": 0},
                "members": [{"service": {"rtype": "entertainment", "rid": ent}, "index": 0}],
            }
            for _, ent, channel in sorted(LAMPS.values(), key=lambda item: item[2])
        ]
        return {
            "id": self.area_id,
            "type": "entertainment_configuration",
            "metadata": {"name": AREA_NAME},
            "name": AREA_NAME,
            "status": self.area_status,
            "configuration_type": "music",
            "channels": channels,
        }

    def other_area(self) -> dict[str, Any]:
        return {
            "id": "00000000-0000-4000-8000-000000000200",
            "type": "entertainment_configuration",
            "metadata": {"name": "iLightShow#iOS"},
            "status": "inactive",
            "channels": [],
        }

    # -- Handler --

    def _authorized(self, request: web.Request) -> bool:
        return request.headers.get("hue-application-key") == self.app_key

    def _unauthorized(self) -> web.Response:
        return web.json_response(
            {"errors": [{"description": "unauthorized user"}], "data": []}, status=403
        )

    async def _pair(self, request: web.Request) -> web.Response:
        body = await request.json()
        self.calls.append(("POST", "/api", body))
        if not self.link_button_pressed:
            return web.json_response(
                [{"error": {"type": 101, "description": "link button not pressed"}}]
            )
        return web.json_response(
            [{"success": {"username": self.app_key, "clientkey": self.client_key}}]
        )

    async def _bridge(self, request: web.Request) -> web.Response:
        if not self._authorized(request):
            return self._unauthorized()
        bridge = {"id": str(uuid.uuid4()), "bridge_id": self.bridge_id, "type": "bridge"}
        return web.json_response({"errors": [], "data": [bridge]})

    async def _areas(self, request: web.Request) -> web.Response:
        if not self._authorized(request):
            return self._unauthorized()
        return web.json_response({"errors": [], "data": [self.other_area(), self.area_config()]})

    async def _area(self, request: web.Request) -> web.Response:
        if not self._authorized(request):
            return self._unauthorized()
        if request.match_info["id"] != self.area_id:
            return web.json_response(
                {"errors": [{"description": "not found"}], "data": []}, status=404
            )
        return web.json_response({"errors": [], "data": [self.area_config()]})

    async def _area_action(self, request: web.Request) -> web.Response:
        if not self._authorized(request):
            return self._unauthorized()
        body = await request.json()
        self.calls.append(("PUT", f"area/{request.match_info['id']}", body))
        action = body.get("action")
        if action == "start":
            self.area_status = "active"
            for light in self.lights.values():
                light["mode"] = "streaming"
        elif action == "stop":
            self.area_status = "inactive"
            for light in self.lights.values():
                # Unguenstigster Fall: Lampe bleibt im letzten Stream-Zustand (Testfarbe).
                light.update(STREAM_LEFTOVER_STATE)
                light["effects_v2"] = {"status": {"effect": "no_effect"}}
            if self.fail_restore:
                self.fail_light_puts = 10**6
        return web.json_response(
            {"errors": [], "data": [{"rid": self.area_id, "rtype": "entertainment_configuration"}]}
        )

    async def _entertainment(self, request: web.Request) -> web.Response:
        if not self._authorized(request):
            return self._unauthorized()
        data = [
            {
                "id": ent,
                "type": "entertainment",
                "renderer": True,
                "renderer_reference": {"rid": lid, "rtype": "light"},
            }
            for lid, (_, ent, _) in LAMPS.items()
        ]
        data.append(
            {"id": str(uuid.uuid4()), "type": "entertainment", "renderer": False, "proxy": True}
        )
        return web.json_response({"errors": [], "data": data})

    async def _get_light(self, request: web.Request) -> web.Response:
        if not self._authorized(request):
            return self._unauthorized()
        light = self.lights.get(request.match_info["id"])
        if light is None:
            return web.json_response(
                {"errors": [{"description": "not found"}], "data": []}, status=404
            )
        return web.json_response({"errors": [], "data": [light]})

    async def _put_light(self, request: web.Request) -> web.Response:
        if not self._authorized(request):
            return self._unauthorized()
        light_id = request.match_info["id"]
        body = await request.json()
        self.calls.append(("PUT", f"light/{light_id}", body))
        if self.fail_light_puts > 0:
            self.fail_light_puts -= 1
            return web.json_response(
                {"errors": [{"description": "simulierter Fehler"}], "data": []}, status=503
            )
        light = self.lights[light_id]
        if "on" in body:
            light["on"] = body["on"]
        if "dimming" in body:
            light["dimming"] = body["dimming"]
        if "color_temperature" in body:
            light["color_temperature"] = {
                "mirek": body["color_temperature"]["mirek"],
                "mirek_valid": True,
            }
        if "color" in body:
            light["color"] = body["color"]
            light["color_temperature"] = {"mirek": None, "mirek_valid": False}
        if "effects_v2" in body:
            action = body["effects_v2"]["action"]
            light["effects_v2"] = {
                "status": {"effect": action["effect"], "parameters": action.get("parameters", {})}
            }
        return web.json_response({"errors": [], "data": [{"rid": light_id, "rtype": "light"}]})

    def light_puts(self) -> list[tuple[str, Any]]:
        return [
            (path.split("/", 1)[1], body)
            for method, path, body in self.calls
            if path.startswith("light/")
        ]

    def area_actions(self) -> list[str]:
        return [body["action"] for _, path, body in self.calls if path.startswith("area/")]
