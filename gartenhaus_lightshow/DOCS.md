# Gartenhaus Lichtshow

Die App steuert per Hue Entertainment API (DTLS 1.2, UDP 2100) die 7 Lampen im Bereich
**Gartenhaus (SYNC HA)** der Gartenhaus-Bridge. Bedient wird sie aus Home Assistant über
Entitäten, die die App per MQTT anlegt (Mosquitto-App nötig).

## Einrichtung

1. App-Optionen ausfüllen: `bridge_host` (feste IPv4 der Gartenhaus-Bridge) und `bridge_id`
   (16-stellige ID der Bridge). Beide stehen absichtlich nicht im Repository.
2. App starten. Ohne gespeicherte Kopplung wartet sie 60 Sekunden auf den **Link-Button**
   der Gartenhaus-Bridge. App-Key und Client-Key liegen danach nur in `/data/credentials.json`.
3. Watchdog und „Beim Start ausführen“ nach Wunsch. Die App läuft dauerhaft, öffnet den Stream
   aber nur während einer Show oder eines Testlaufs.

## Entitäten in Home Assistant (Gerät „Gartenhaus Lichtshow“)

| Entität | Funktion |
|---|---|
| `button.gartenhaus_lichtshow_starten` | Show mit dem Effekt „Welle“ starten |
| `button.gartenhaus_lichtshow_stoppen` | laufende Show oder Testlauf beenden |
| `button.gartenhaus_lichtshow_testlauf` | jede Lampe nacheinander kurz blau |
| `number.gartenhaus_lichtshow_dauer` | Dauer der Show in Minuten (1 bis 120, Vorgabe 15) |
| `sensor.gartenhaus_lichtshow_status` | Bereit, Startet, Show läuft, Testlauf läuft, Stoppt oder Fehler; Attribute `endet_um` bzw. `fehler` |

Die Entitäts-IDs vergibt Home Assistant aus Geräte- und Entitätsnamen; maßgeblich ist die
Anzeige unter Einstellungen → Geräte & Dienste → MQTT → Gartenhaus Lichtshow.

## Ablauf einer Show

1. Snapshot aller 7 Lampen (Zustand und Farbe), gespeichert in `/data/snapshot.json`.
2. Stream starten. Lampen, die der Effekt gerade nicht nutzt, zeigen ihre Snapshot-Farbe.
3. Effekt „Welle“: Ein weiches blaues Lichtband läuft entlang der Raumtiefe von der
   Waschbecken-Wand nach hinten und zurück (8 s je Richtung). Jede Lampe mischt ihre Farbe
   mit dem Band, je näher es ihrer Position aus `mapping.yaml` ist.
4. Nach der eingestellten Dauer, per Stopp-Button oder beim Stoppen der App: Stream beenden
   und alle Lampen in den Zustand vor der Show zurücksetzen.

Während des Streams sind die Lampen für die Hue-App und Automationen blockiert. Deshalb gibt
es keinen Dauerbetrieb, jede Show endet spätestens nach 120 Minuten.

## Sicherheit und Fehler

- Senderate 50 Hz, Blitze höchstens 3 pro Sekunde im ganzen Raum. Welle und Testlauf liegen
  weit darunter.
- Bricht die Verbindung ab oder beendet die Bridge den Stream, werden die Lampen sofort
  wiederhergestellt; der Status zeigt „Fehler“ mit Grund. Bei hartem Abbruch (Stromausfall)
  passiert das beim nächsten Start der App.
- Streamt ein anderes Programm (z. B. iLightShow oder die Hue-App), startet keine Show.
- Ist die Bridge beim App-Start nicht erreichbar, versucht der nächste Start-Button die
  Vorbereitung erneut. Die App beendet sich nie von selbst.
