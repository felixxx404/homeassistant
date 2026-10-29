# gg-Karten und -Stile

Quelltext der eigenen Dashboard-Module (`gg-*`). In Home Assistant liegen sie als Dateien unter
`/config/www/gg/` und sind als Dashboard-Ressourcen mit Versionsparameter eingebunden
(`/local/gg/<datei>?v=<n>`). Stand: 29.10.2026, Audit U-03.

## Regeln

- **Maßgeblich ist die Datei in HA.** Dieses Verzeichnis dient der Versionierung und dem Vergleich.
- **Bilder sind hier nicht enthalten.** Eingebettete Bilder (`gg-auto-foto.js`, `gg-auto-motor.js`,
  `gg-bild.css`, `gg-glas.css`) stehen als `data:image/…;base64,BILD_NICHT_IM_REPOSITORY`.
  Die echten Daten liegen nur in HA. Das Hintergrundbild des Haupt-Dashboards liegt als
  `/config/www/gg/hintergrund.webp`.
- **`gg-qr` (WLAN-QR-Code) bleibt Inline-Ressource** und wird nicht als Datei abgelegt:
  `/local/` ist ohne Anmeldung abrufbar, der QR-Code enthält das WLAN-Passwort.
- **Nach jeder Änderung** die Datei in HA ersetzen und in der Ressource den Parameter `?v=` hochzählen,
  sonst liefert der Browser-Cache die alte Fassung.

## Dateien

| Datei | Inhalt |
|---|---|
| `gg-blaetter.js` | Blätter-Ansicht (`gg-blaetter-view`), Pop-ups, Navigation |
| `gg-farben.css`, `gg-bild.css`, `gg-glas.css`, `gg-kontrast.css` | Farben, Hintergrundbild, Milchglas, Kontrast (Reihenfolge wichtig) |
| `gg-zusatz.js` | `gg-kamera-bild`, `gg-verlauf` |
| `gg-box.js` | Stapel/Raster für den Nest Hub |
| `gg-extras.js` | Guthaben, Pfeife und weitere Karten |
| `gg-fenster.js` | Fensterwarnung Klima, Kohlegrill-Steckdose (v5: ohne `gg_diag`) |
| `gg-auto.js`, `gg-auto-foto.js`, `gg-auto-motor.js`, `gg-tankprognose.js`, `gg-mercedes.js` | Mercedes |
| `gg-einstellungen.js`, `gg-weich.js` | Einstellungen, Hintergrundwahl, Milchglas-Bild |
| `gg-wecker.js` | Wecker Nest Schlafzimmer |
| `gg-luefter.js` | Klima-Chip, Klima-Dial |
| `gg-klima-wunsch.js` | Tile-Feature Wunschtemperatur |
| `gg-push-matrix.js` | Push-Einstellungen |
| `gg-batterien.js` | Batterieliste |
| `gg-neustart.js` | Neustartfläche Nest Hub |
| `gg-lichtfest.js`, `gg-lichtshow.js` | Lichtfest, Lichtshow |
| `gg-mehr.js` | Automationen-Liste, Pakete |
| `gg-dialoge.js`, `gg-bedienung.js`, `gg-nachtschwarz.js` | Dialog-Stil, Bedienhilfen, Nachtschleier Nest |
