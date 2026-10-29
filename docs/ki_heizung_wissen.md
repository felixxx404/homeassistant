# KI-Heizung Gartenhaus – gesammeltes Wissen zu den Heizstrategien

Stand: 29.10.2026. Die Strategien „Intervall“ und „Wärmepuffer am Nachmittag“ wurden aus der Steuerung
entfernt (Aufräumen, siehe `AUDIT_REPORT.md`, A-13). Diese Datei hält fest, warum, und was gemessen wurde.
Aktiv bleibt nur „Sanft durchlaufen“.

## Ergebnis

| Strategie | Prinzip | Gemessen | Bewertung |
|---|---|---|---|
| **Sanft durchlaufen** (aktiv) | ab 16,3 °C an und durchgehend mit kleinem Sollwert laufen lassen; der Inverter moduliert mit ≈ 100–300 W | 10./11.10.2026: Sollwert 16–17 °C → ≈ 90–270 Wh pro Stunde, **≈ 23 Wh je K Unterschied innen/außen und Stunde** | am effizientesten |
| Intervall (entfernt) | an/aus takten um die Mindesttemperatur (16,2 °C) | Takten an/aus: **≈ 30–70 Wh je K und Stunde** | 1,3- bis 3-fach teurer |
| Wärmepuffer am Nachmittag (entfernt) | 13–16 Uhr bei besserem COP auf ein Pufferziel (17–19 °C) vorheizen, Wärme in die Nacht mitnehmen | kein ungestörter Lerntag (Tagesmodell `P=0/0,…`) | nicht belegt; Felix will tags und nachts nur die Mindesttemperatur |

## Fakten, auf denen die Entscheidung beruht

- Inverter arbeiten am effizientesten dauerhaft mit kleiner Leistung. Jeder Start kostet 5–15 Minuten mit
  schlechtem COP. 2–3 Takte pro Stunde kosten ≈ 10 %, sehr häufiges Takten bis zur Hälfte der Effizienz.
  Kleine Leistung bedeutet außerdem weniger Abtauen.
- Der COP steigt mit der Außentemperatur (nachmittags meist am höchsten). Bei feuchter Kälte um 0–5 °C kostet Abtauen extra.
- Das Innengerät misst beim Heizen ≈ 5 K zu warm (8.10.: Raum 19 °C, Gerät 24–25 °C). Mit Sollwert 22 °C
  taktete die Anlage mit 600–850 W.
- Das Gartenhaus heizt schnell auf (16,4 → 19 °C in 25 min mit ≈ 700 W). Die Luftwärme fließt danach in
  die Wände, nachts kühlt es langsam aus.

## Was weiter gelernt wird

- Tagesmodell `S=` in `input_text.ki_modell`: Wh je Gradstunde unter 16 °C, je Außentemperatur-Band (ab 10 / 5–10 / 0–5 / unter 0 °C).
- Halbstündliches Lernmodell `input_text.ki_lernmodell_halbstundlich`: Auskühlzeit, Wh je K, Versatz Raum zu Sollwert.
- Aufheizraten der Vorheizmodi „Sanft & früh“ und „Zügig & spät“.

## Falls ein Wärmepuffer später doch getestet werden soll

Die entfernte Logik: Bei Strategie „Wärmepuffer am Nachmittag“ wurde zwischen 13 und 17 Uhr der Sollwert um
2 °C angehoben (`s_soll + 2`, max. 30 °C), Heizstart schon unterhalb `Pufferziel − 0,5 °C`; um 17 Uhr
zurück auf den gelernten Sollwert. Die Version vor dem Entfernen liegt in den Objekt-Sicherungen von ha-mcp
(`automation.gartenhaus_ki_heizung_steuerung`, `script.ki_heizung_nachtanalyse`) und im HA-Backup vom 29.10.2026.
