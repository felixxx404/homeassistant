"""Schlanker CLIP-v2-Client fuer die Hue Bridge (Kopplung, Bereich, Lampen).

Die Bridge nutzt ein selbst signiertes Zertifikat; wie aiohue und hue-entertainment
wird es nicht geprueft (nur LAN-Verkehr zur Bridge).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Self

import aiohttp

LOGGER = logging.getLogger(__name__)

REQUEST_TIMEOUT_S = 5.0
LINK_BUTTON_NOT_PRESSED = 101


class BridgeError(Exception):
    """Fehler in der Kommunikation mit der Bridge."""


class PairingTimeout(BridgeError):
    """Link-Button wurde nicht rechtzeitig gedrueckt."""


@dataclass(frozen=True)
class Credentials:
    """Zugangsdaten: app_key (CLIP und DTLS-Identitaet) und client_key (DTLS-PSK)."""

    app_key: str
    client_key: str

    def __repr__(self) -> str:
        return "Credentials(app_key=<verborgen>, client_key=<verborgen>)"


class BridgeClient:
    """CLIP-v2-Zugriff auf eine Bridge."""

    def __init__(self, base_url: str, app_key: str | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._app_key = app_key
        self._session: aiohttp.ClientSession | None = None

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    async def close(self) -> None:
        if self._session is not None and not self._session.closed:
            await self._session.close()
        self._session = None

    async def pair(
        self,
        device_type: str,
        *,
        timeout_s: float = 60.0,
        retry_interval_s: float = 2.0,
    ) -> Credentials:
        """Neue App-Kopplung anlegen; wartet, bis der Link-Button gedrueckt ist."""
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout_s
        body = {"devicetype": device_type, "generateclientkey": True}
        while True:
            result = await self._request("POST", "/api", body, authenticated=False)
            entry = result[0] if isinstance(result, list) and result else {}
            if "success" in entry:
                success = entry["success"]
                app_key = success.get("username")
                client_key = success.get("clientkey")
                if not app_key or not client_key:
                    raise BridgeError("Bridge hat keinen clientkey geliefert")
                return Credentials(app_key=app_key, client_key=client_key)
            error = entry.get("error", {})
            if error.get("type") != LINK_BUTTON_NOT_PRESSED:
                raise BridgeError(f"Kopplung abgelehnt: {error.get('description', entry)}")
            if loop.time() + retry_interval_s > deadline:
                raise PairingTimeout("Link-Button wurde nicht innerhalb der Wartezeit gedrueckt")
            await asyncio.sleep(retry_interval_s)

    async def get_bridge_id(self) -> str:
        data = await self._get_resource("bridge")
        if not data or "bridge_id" not in data[0]:
            raise BridgeError("Bridge-Ressource ohne bridge_id")
        return str(data[0]["bridge_id"]).lower()

    async def get_entertainment_configurations(self) -> list[dict[str, Any]]:
        return await self._get_resource("entertainment_configuration")

    async def get_entertainment_configuration(self, area_id: str) -> dict[str, Any]:
        data = await self._get_resource(f"entertainment_configuration/{area_id}")
        if not data:
            raise BridgeError(f"Entertainment-Bereich {area_id} nicht gefunden")
        return data[0]

    async def get_entertainment_services(self) -> list[dict[str, Any]]:
        return await self._get_resource("entertainment")

    async def get_light(self, light_id: str) -> dict[str, Any]:
        data = await self._get_resource(f"light/{light_id}")
        if not data:
            raise BridgeError(f"Lampe {light_id} nicht gefunden")
        return data[0]

    async def put_light(self, light_id: str, body: dict[str, Any]) -> None:
        await self._put_resource(f"light/{light_id}", body)

    async def start_area(self, area_id: str) -> None:
        await self._put_resource(f"entertainment_configuration/{area_id}", {"action": "start"})

    async def stop_area(self, area_id: str) -> None:
        await self._put_resource(f"entertainment_configuration/{area_id}", {"action": "stop"})

    async def _get_resource(self, path: str) -> list[dict[str, Any]]:
        result = await self._request("GET", f"/clip/v2/resource/{path}")
        _raise_clip_errors(result, path)
        data = result.get("data") if isinstance(result, dict) else None
        if not isinstance(data, list):
            raise BridgeError(f"Unerwartete Antwort fuer {path}")
        return data

    async def _put_resource(self, path: str, body: dict[str, Any]) -> None:
        result = await self._request("PUT", f"/clip/v2/resource/{path}", body)
        _raise_clip_errors(result, path)

    async def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        *,
        authenticated: bool = True,
    ) -> Any:
        if authenticated and not self._app_key:
            raise BridgeError("Kein app_key vorhanden, zuerst koppeln")
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT_S),
            )
        headers = {"hue-application-key": self._app_key} if authenticated else {}
        url = f"{self._base_url}{path}"
        try:
            async with self._session.request(
                method, url, json=body, headers=headers, ssl=False
            ) as resp:
                payload = await resp.json(content_type=None)
                if resp.status >= 400:
                    detail = _error_text(payload) or resp.reason
                    raise BridgeError(f"{method} {path}: HTTP {resp.status} {detail}")
                return payload
        except (aiohttp.ClientError, TimeoutError) as err:
            raise BridgeError(f"{method} {path}: {type(err).__name__}: {err}") from err


def _raise_clip_errors(result: Any, path: str) -> None:
    text = _error_text(result)
    if text:
        raise BridgeError(f"{path}: {text}")


def _error_text(payload: Any) -> str:
    if not isinstance(payload, dict):
        return ""
    errors = payload.get("errors") or []
    return "; ".join(str(err.get("description", err)) for err in errors if err)
