"""Unit-Tests: App-Optionen (Bridge-Adresse und Bridge-ID, nicht im Repo hinterlegt)."""

from pathlib import Path

import pytest
import yaml

from lightshow.__main__ import bridge_host_from_options, bridge_id_from_options
from lightshow.service import ServiceError

CONFIG_FILE = Path(__file__).resolve().parent.parent / "gartenhaus_lightshow" / "config.yaml"

# Dummy-Werte: 192.0.2.0/24 ist ein Dokumentations-Netz (RFC 5737), die ID ist erfunden.
DUMMY_HOST = "192.0.2.10"
DUMMY_ID = "0123456789abcdef"


def test_config_enthaelt_keine_echten_bridge_angaben():
    config = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8"))
    assert config["options"]["bridge_host"] == ""
    assert config["options"]["bridge_id"] == ""
    assert "host_network" not in config


def test_leere_vorgaben_werden_beim_start_abgelehnt():
    config = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8"))
    with pytest.raises(ServiceError):
        bridge_host_from_options(config["options"])
    with pytest.raises(ServiceError):
        bridge_id_from_options(config["options"])


def test_gueltige_werte():
    assert bridge_host_from_options({"bridge_host": f" {DUMMY_HOST} "}) == DUMMY_HOST
    assert bridge_id_from_options({"bridge_id": " 0123456789ABCDEF "}) == DUMMY_ID


@pytest.mark.parametrize("value", ["", None, "hue-bridge.local", "192.0.2.300", "fe80::1"])
def test_ungueltige_adresse(value):
    with pytest.raises(ServiceError):
        bridge_host_from_options({"bridge_host": value})


@pytest.mark.parametrize(
    "value", ["", None, "0123456789abcde", "0123456789abcdefa", "g123456789abcdef"]
)
def test_ungueltige_bridge_id(value):
    with pytest.raises(ServiceError):
        bridge_id_from_options({"bridge_id": value})
