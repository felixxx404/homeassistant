# Home Assistant – Felix

## Gartenhaus-Lichtshow (Hue Entertainment)

Eigene HA-OS-App, die per Hue Entertainment API (DTLS 1.2 PSK, UDP 2100) die 7 Lampen im
Bereich „Gartenhaus (SYNC HA)“ der Gartenhaus-Bridge ansteuert.

**Stand: Phase 3 (Grundlage).** Steuerung aus HA per MQTT (Starten, Stoppen, Testlauf, Dauer,
Status), Stream nur bei Bedarf, Effekt „Welle“, unbeteiligte Lampen in Snapshot-Farbe.
Der Testlauf aus Phase 2 lief an der echten Bridge; die Show aus Phase 3 ist bisher nur gegen
eine simulierte Bridge geprüft. Auto-DJ, Spotify, weitere Effekte und Dashboard folgen später.

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
  Farben mit 8 Bit je Kanal (RGB). Snapshot-Farben werden aus xy bzw. Farbtemperatur und
  Helligkeit umgerechnet; ob sie an der echten Bridge genauso aussehen, ist **ungeprüft**.
- Steuerung per MQTT-Discovery über die Mosquitto-App (Zugangsdaten vom Supervisor,
  `services: mqtt:need`), Entitäten siehe `gartenhaus_lightshow/DOCS.md`.
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

Für die MQTT-Tests muss `mosquitto` installiert sein, sonst werden sie übersprungen.
Probelauf des App-Images (Docker nötig):

```bash
python tests/sim/container_probelauf.py <image>
```

Die Tests in `tests/test_simulation.py`, `tests/test_mqtt_simulation.py` und der Probelauf
laufen gegen eine **simulierte** Bridge (und einen simulierten Supervisor) und sind kein
Nachweis für die echte Hardware.
