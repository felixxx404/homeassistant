"""Unit-Tests: Die App fuehrt genau einen Lauf aus und bleibt danach ohne Stream aktiv."""

import asyncio

import pytest

import lightshow.__main__ as app
from lightshow.service import ServiceError


@pytest.mark.parametrize("outcome", ["ok", "fehler"])
async def test_ein_lauf_danach_warten_bis_gestoppt(monkeypatch, outcome):
    calls = []

    async def fake_run(config):
        calls.append(config)
        if outcome == "fehler":
            raise ServiceError("Bridge nicht erreichbar")

    monkeypatch.setattr(app, "run", fake_run)
    task = asyncio.create_task(app.run_once_then_idle(lambda: "config"))
    await asyncio.sleep(0.2)
    assert not task.done(), "App darf sich nicht selbst beenden (Watchdog-Schleife)"
    assert calls == ["config"]
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert calls == ["config"]


async def test_ungueltige_optionen_fuehren_nicht_zum_beenden():
    def bad_config():
        raise ServiceError("bridge_id fehlt")

    task = asyncio.create_task(app.run_once_then_idle(bad_config))
    await asyncio.sleep(0.1)
    assert not task.done()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
