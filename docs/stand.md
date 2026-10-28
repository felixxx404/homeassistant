# Ist-Stand Home Assistant / Hue (Gartenhaus-Lichtshow)

Stand: 28.10.2026, gelesen über HA (ha-mcp) und die HA-Diagnosedaten der Hue-Integration.

## System

- Home Assistant 2026.10.4 auf HA OS.
- Installierte Apps: Matter Server, File editor, eufy-sdk bridge (gestoppt), Home Assistant MCP
  Server, Webhook Proxy, Zigbee2MQTT, Mosquitto, Tailscale. Keine Samba- und keine SSH-App.
- Die App „Gartenhaus Lichtshow“ ist **noch nicht installiert**.

## Gartenhaus-Bridge

- HA-Eintrag `01M2V4ST629HNYTTF997B9ZGVT`, Gerät „Gartenhaus Hue“, Hue Bridge v2 (BSB002),
  Firmware 6.3.1978545030, Bridge-ID `<BRIDGE-ID>`, MAC `<MAC-ADRESSE>`, feste IP `<BRIDGE-IP>`.
  Die echten Werte stehen nur in den App-Optionen in HA (`bridge_id`, `bridge_host`), nicht im Repo.
- Entertainment-Bereiche:
  - **Gartenhaus (SYNC HA)**, Typ `music`, `/groups/201`, 7 Kanäle (von Felix angelegt).
  - iLightShow#iOS, Typ `other`, `/groups/200`, 7 Kanäle, alle Positionen 0/0/0 (bleibt unverändert).
- Neue HA-Entitäten der Hue-Integration für die Bereiche:
  - `binary_sensor.gartenhaus_hue_unterhaltungsbereich_gartenhaus_sync_ha`
  - `binary_sensor.gartenhaus_hue_unterhaltungsbereich_ilightshow_ios`

## Kanäle in „Gartenhaus (SYNC HA)“

| Kanal | Lampe | HA-Entität | Hue light_id |
|---|---|---|---|
| 0 | 1G Deckenleuchte links | light.gartenhaus_1g_deckenleuchte | 2820a787-833a-4f1f-8717-1c949e8e9a0e |
| 1 | 2G Wandlampe | light.gartenhaus_2g_wandlampe | 2dd7a69c-e7ef-434c-b09f-d9e2c106e2b0 |
| 2 | 3G Deckenleuchte rechts | light.gartenhaus_3g_deckenleuchte | cbd921f1-772b-4291-aede-fd7e02fd3719 |
| 3 | 4G Schrankbeleuchtung | light.gartenhaus_4g_schrankbeleuchtung | 040d1d3f-ec05-4c5b-b791-17738fa376ca |
| 4 | 5G Wandlampe | light.gartenhaus_5g_wandlampe | 7d116f0f-a4db-46f1-9ac8-56ec8d74e876 |
| 5 | 6G Waschbeckenlampe | light.gartenhaus_6g_waschbeckenlampe | ff8ff4cb-4c72-4916-964c-30e035bee0cb |
| 6 | 7G Tischlampe | light.gartenhaus_7g_tischlampe | 83c16192-7e44-4a2b-a8d3-7c4a865ac0e1 |

Nicht im Stream: `light.gartenhaus_laser` (Hue Smart Plug, kein Entertainment-Dienst).

Die Positionen auf der Bridge (in der Hue-App gesetzt) weichen von den gemessenen Werten ab,
bei Z teils deutlich. Maßgeblich ist `gartenhaus_lightshow/mapping.yaml`; die Bridge-Werte
werden nicht überschrieben.

## Nach dem ersten Start der App zu erwarten

- In der Hue-App erscheint eine neue verbundene App `gartenhaus_lightshow#ha_app`.
- Die Zugangsdaten liegen nur im `/data`-Verzeichnis der App.

## Entscheidungen für Phase 3 (Stand 28.10.2026)

- Stream nur bei Bedarf starten, nicht dauerhaft. Grund: Die Bridge erlaubt nur einen Stream,
  und solange er läuft, sind die Lampen für die Hue-App und Automationen blockiert.
- Unbeteiligte Lampen bleiben in ihrer Snapshot-Farbe statt dunkel. Umsetzung über den Stream:
  Snapshot (xy bzw. Farbtemperatur und Helligkeit) in RGB umrechnen und für diese Kanäle senden.
  Effekte wie „candle“ (4G, 7G) lassen sich im Stream nicht abbilden; dort wird die Grundfarbe
  des Effekts gesendet.

## Offene Punkte

- Repository öffentlich schalten (GitHub-Einstellungen, macht Felix); Branch `main` ist angelegt.
- Testlauf an der echten Bridge mit Felix steht aus.
- Offizielle Hue-Doku (Frequenzen, Koordinatengrenzen) nicht geprüft, Seite war nicht erreichbar.
- Verhalten ausgeschalteter Lampen nach dem Stream an der echten Bridge prüfen (siehe README).
