"""Zugangsdaten im App-eigenen /data-Verzeichnis (nie im Repo, nie im Log)."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from .bridge import Credentials

_CLIENT_KEY_RE = re.compile(r"^[0-9A-Fa-f]{32}$")


class CredentialError(Exception):
    """Gespeicherte Zugangsdaten sind unbrauchbar."""


class CredentialStore:
    def __init__(self, path: Path) -> None:
        self._path = path

    def load(self) -> Credentials | None:
        if not self._path.exists():
            return None
        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
            credentials = Credentials(payload["app_key"], payload["client_key"])
        except (OSError, ValueError, KeyError, TypeError) as err:
            raise CredentialError(f"{self._path} ist beschaedigt") from err
        _validate(credentials)
        return credentials

    def save(self, credentials: Credentials) -> None:
        _validate(credentials)
        payload = {"app_key": credentials.app_key, "client_key": credentials.client_key}
        tmp = self._path.with_suffix(".tmp")
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle)
        os.chmod(tmp, 0o600)
        os.replace(tmp, self._path)


def _validate(credentials: Credentials) -> None:
    if not credentials.app_key:
        raise CredentialError("app_key fehlt")
    if not _CLIENT_KEY_RE.match(credentials.client_key):
        raise CredentialError("client_key ist kein 32-stelliger Hex-Wert")
