# Home Assistant – Felix

## Gartenhaus-Lichtshow (Hue Entertainment)

Eigene HA-OS-App, die per Hue Entertainment API (DTLS 1.2 PSK, UDP 2100) die 7 Lampen im
Bereich „Gartenhaus (SYNC HA)“ der Gartenhaus-Bridge ansteuert.

**Stand: Phase 2.** Dienst und Testlauf sind gebaut und gegen eine simulierte Bridge geprüft.
Ein Test an der echten Bridge steht aus. Auto-DJ, Spotify, Effekte, MQTT und Dashboard
folgen erst in späteren Phasen.

### Struktur

| Pfad | Inhalt |
|---|---|
| `repository.yaml` | macht das Repo zum HA-App-Repository |
| `gartenhaus_lightshow/config.yaml`, `build.yaml`, `Dockerfile` | App-Definition für HA OS |
| `gartenhaus_lightshow/mapping.yaml` | Lampen, Lampen-IDs, Positionen in Metern und Hue-Werten (einzige Quelle) |
| `gartenhaus_lightshow/lightshow/` | Python-Dienst (asyncio) |
| `gartenhaus_lightshow/DOCS.md` | Bedienung der App |
| `docs/stand.md` | Ist-Stand Home Assistant und Hue |
| `tests/` | Unit-Tests und SIMULIERTE Bridge (`tests/sim/`) |

### Technische Eckpunkte

- Bibliothek `hue-entertainment` 0.1.2 (Music Assistant) für DTLS und HueStream v2.
  Farben mit 8 Bit je Kanal (RGB); für die Testmuster ausreichend.
- CLIP v2 (`action: start/stop`, Lampen lesen und setzen) über einen eigenen kleinen Client.
- Senderate 50 Hz. Laut Drittquellen gibt die Bridge höchstens ~25 Hz an die Lampen weiter;
  die offizielle Hue-Doku war nicht erreichbar, beides ist **nicht offiziell bestätigt**.
- Blitzbegrenzung: höchstens 3 Blitze je gleitender Sekunde im ganzen Raum.
- Koordinaten: x = X/2 − 1, y = 1 − Y/3, z = Z/1,6 − 1 (Raum 4,0 × 6,0 × 3,2 m).
  Achsenrichtung aus den Werten der Hue-App abgeleitet, **nicht offiziell bestätigt**.
- Zugangsdaten nur in `/data/credentials.json` der App, nie im Repo oder Log. Bridge-IP und
  Bridge-ID nur in den App-Optionen.

### Installation auf HA OS

Einstellungen → Apps → App-Store → ⋮ → Repositories → `https://github.com/felixxx404/homeassistant`.
HA liest den Branch `main`; das Repository muss dafür öffentlich sein. Danach
„Gartenhaus Lichtshow“ installieren und starten. Beim ersten Start den Link-Button der
Gartenhaus-Bridge drücken. Vorher in den App-Optionen `bridge_host` (IP) und `bridge_id`
eintragen; beide stehen absichtlich nicht im Repo.

### Tests

```bash
pip install -r requirements-dev.txt
```

```bash
python -m pytest
```

Die Tests in `tests/test_simulation.py` und `tests/sim/container_probelauf.sh` laufen gegen eine
**simulierte** Bridge und sind kein Nachweis für die echte Hardware.
