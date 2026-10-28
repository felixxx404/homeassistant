# Gartenhaus Lichtshow (Phase 2: Testlauf)

Die App verbindet sich per Hue Entertainment API (DTLS 1.2, UDP 2100) mit dem Bereich
**Gartenhaus (SYNC HA)** der Gartenhaus-Bridge und führt einen Testlauf aus. Effekte,
Musik-Steuerung und Home-Assistant-Entitäten gibt es in dieser Phase nicht.

## Ablauf beim Start

1. Liegt ein Snapshot aus einem abgebrochenen Lauf vor, werden die Lampen zuerst daraus
   wiederhergestellt.
2. Ohne gespeicherte Kopplung wartet die App 60 Sekunden auf den **Link-Button** der
   Gartenhaus-Bridge. App-Key und Client-Key landen in `/data/credentials.json`
   (nur für die App lesbar), nie im Log.
3. Die App prüft, dass unter `bridge_host` die Bridge mit der ID `bridge_id` antwortet, sucht
   den Bereich über den exakten Namen und ordnet jede Lampe über ihre Hue-Lampen-ID einem
   Kanal zu. Fehlt eine Lampe oder ist eine fremde drin, bricht sie ab.
4. Testlauf (Option `testlauf`): Snapshot aller 7 Lampen, Stream starten, jede Lampe
   nacheinander 1,5 s blau, dazwischen 0,5 s Pause, alle anderen aus. Danach Stream stoppen
   und den Ursprungszustand wiederherstellen. Dauer etwa 16 Sekunden.
5. Danach beendet sich die App.

## Optionen

| Option | Bedeutung |
|---|---|
| `bridge_host` | Feste IPv4 der Gartenhaus-Bridge (Pflichtfeld). |
| `bridge_id` | 16-stellige ID der Gartenhaus-Bridge (Pflichtfeld, Schutz vor der falschen Bridge). |
| `testlauf` | `true`: Testlauf ausführen. `false`: nur Kopplung und Bereich prüfen. |

## Sicherheit und Abbruch

- Senderate 50 Hz, Blitze höchstens 3 pro Sekunde im ganzen Raum (der Testlauf hat 0,5 pro Sekunde).
- Stoppen der App, Verbindungsabbruch oder Bridge-Stopp beenden den Stream und stellen die
  Lampen wieder her. Bei hartem Abbruch (Stromausfall) passiert das beim nächsten Start.
- Streamt ein anderes Programm (z. B. iLightShow oder die Hue-App) auf den Bereich, startet
  die App nicht.
- Die Positionen aus `mapping.yaml` werden nicht auf die Bridge geschrieben.
