# Changelog

## 0.3.0

- Steuerung aus Home Assistant per MQTT-Discovery: Buttons Starten, Stoppen, Testlauf,
  Zahl Dauer (1 bis 120 min), Sensor Status. Benötigt die Mosquitto-App (`mqtt:need`).
- Stream nur bei Bedarf: Show startet per Button und endet nach der eingestellten Dauer.
- Erster Effekt „Welle“ auf Basis der Raumkoordinaten aus `mapping.yaml`.
- Unbeteiligte Lampen zeigen im Stream ihre Snapshot-Farbe statt dunkel zu werden
  (auch im Testlauf).
- Option `testlauf` entfällt, dafür gibt es den Button „Testlauf“.
- Fehler behoben: Schlug der DTLS-Handshake mit Timeout fehl, blieb der Status hängen.

## 0.2.3

- Die App beendet sich nach dem Testlauf nicht mehr, sondern bleibt ohne Stream aktiv,
  bis sie gestoppt wird. Vorher hat der Supervisor-Watchdog sie neu gestartet und den
  Testlauf endlos wiederholt. Auch nach Fehlern gibt es keinen automatischen Neuversuch.

## 0.2.2

- Bridge-Adresse und Bridge-ID nur noch als App-Optionen (nicht mehr im Repo).

## 0.2.1

- Feste Bridge-Adresse als App-Option, mDNS-Suche entfernt.
- App läuft ohne `host_network` (nur ausgehend HTTPS 443 und UDP 2100 zur Bridge).

## 0.2.0

- Erste Version: Kopplung mit Client-Key, Prüfung des Bereichs „Gartenhaus (SYNC HA)“,
  DTLS-Stream mit 50 Hz, Testlauf mit Snapshot & Restore, Blitzbegrenzung (3 pro Sekunde).
