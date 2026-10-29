# AUDIT_REPORT – Home Assistant (Bestandsaufnahme, Dry-Run)

Stand: 29.10.2026, ca. 09:45 Uhr · System: Home Assistant 2026.10.4 auf HA OS 18.4 (Home Assistant Green)
Erstellt rein lesend über den HA-MCP-Server. **Am System wurde nichts verändert.**
Jede Maßnahme in diesem Bericht hat eine ID (z. B. `R-02`) und wartet auf deine Freigabe.

> Hinweis zum Ablageort: Gewünscht war der HA-Konfigurationsordner (`/config`). Darauf habe ich keinen
> Schreib- und keinen Lesezugriff (siehe Kapitel 1). Der Bericht liegt deshalb im Repository
> `felixxx404/homeassistant`. Das Repository ist öffentlich. Interne Kennungen wie Tailscale-Hostname,
> externe IP-Adressen, Benutzer-ID und MAC-Adressen sind deshalb geschwärzt.

---

## 0. Kurzfassung

Das System ist jung (seit 18.09.2026), fachlich sehr durchdacht und überwiegend sauber im UI gepflegt.
Die Konfigurationsprüfung ist gültig, es gibt keine Deprecation-Meldungen und nur ein Reparatur-Hinweis.
Die großen Hebel liegen nicht in „altem Code“, sondern in **drei Lastquellen**:

| # | Befund | Kennzahl | Hebel | Risiko |
|---|---|---|---|---|
| 1 | **8 UniFi-Sensoren der Dream Machine** (Port-9-Durchsatz, CPU, RAM, WAN-Zähler) schreiben fast im Sekundentakt | **≈ 400.000 Zeilen/Tag = 92 % der gemessenen Schreiblast** | DB von ≈ 1 GB auf geschätzt 100–150 MB, rund 90 % weniger Schreibzyklen auf der eMMC | niedrig, wenn die WAN-Diagramme umgestellt werden (R-02) |
| 2 | **Frontend-Ressourcen**: 29 Inline-Module/CSS als `data:`-URI (483 KB) + Haupt-Dashboard 995 KB in **einer** Ansicht (42 Pop-ups, 50 ApexCharts, 66 Markdown-Karten) | ≈ 1,5 MB Konfiguration je Seitenaufruf, nicht vom Browser zwischenspeicherbar | spürbar schnellere Ladezeit auf Handy und Nest Hub | mittel (nur mit Dateizugriff, U-03/U-04) |
| 3 | **Event-Loop**: Template-Trigger über alle 275 Sensoren (Batterie-Automation) rendert bis zu 1×/s; 4 Automationen laufen per Zeitmuster ins Leere (u. a. 1.440 Läufe/Tag beim Kohlegrill-Wächter) | ≈ 86.000 Template-Renderings + ≈ 2.000 leere Automationsläufe pro Tag | weniger CPU, weniger Traces/Logbuch-Rauschen | sehr niedrig (P-01, P-02) |

Daneben: vollständige **Eufy-Altlast** (2 Custom Integrations, 5 Geräte, 4 Timer, Kamera-Block im
Dashboard mit 12 nicht existierenden Entitäten), eine ungenutzte HACS-Integration (DPD), eine ungenutzte und
fehlerwerfende Karte (AliExpress), 51 dauerhaft nicht verfügbare UniFi-PoE-Buttons sowie 5 Log-Fehlerquellen
mit eindeutiger Ursache im Code (Mercedes-Templates, Wecker-Template).

**Wichtiger Befund am Rande:** `input_boolean.ki_heizung_aktiv` steht auf **aus**. Die KI-Heizung
(Frostschutz 16 °C im Gartenhaus) ist damit derzeit inaktiv. Bitte prüfen, ob das gewollt ist (Frage F-01).
Außerdem läuft das **Home-Assistant-Cloud-Abo am 03.11.2026** aus (F-02).

---

## 1. Rahmen, Datenbasis und Grenzen

**Datenquellen (alle live über ha-mcp gelesen):**
- Systemübersicht, Systemzustand, Reparaturen, Konfigurationsprüfung, Erkennung verwaister Entitäten
- alle 53 Automationen und alle 32 Skripte (vollständige Konfiguration)
- alle 158 Helfer, 25 Template-Helfer, 4 Riemann-Integrale, 3 Verbrauchszähler, 86 Integrationseinträge
- alle 3 Dashboards (vollständige JSON-Konfiguration) und alle 34 Dashboard-Ressourcen inkl. Inhalt
- HACS-Bestand (18 Repositories), Blueprints, Apps (Add-ons), Szenen, Geräte
- Logs: `system_log` (dedupliziert, mit Tracebacks) und Core-Log (Fenster 28.10. 03:40 – 29.10. 04:00)
- **Schreiblast-Messung**: Anzahl der Zustandswechsel in 24 h für 69 verdächtige Entitäten

**Grenzen (wichtig für die Bewertung):**
- **Kein Dateizugriff.** Die Komponente `ha_mcp_tools` („HA-MCP File & YAML Tools“) ist nicht installiert,
  und die File-editor-App lehnt den Zugriff über die API mit HTTP 420 ab (Zugriffsrichtlinie; diese habe ich bewusst
  nicht umgangen). Deshalb **nicht gelesen**: `configuration.yaml` (inkl. `recorder:`, `http:`, `logger:`),
  YAML-Pakete/-Includes und die komplette `home-assistant.log`-Datei.
- Aus dem Verhalten lässt sich ableiten, was in YAML steht: Recorder-Aufbewahrung ≈ 14 Tage (älteste Aufzeichnung 15.10.),
  keine wirksamen Recorder-Ausschlüsse (alle gemessenen Entitäten haben volle Historie), YAML-Entitäten:
  `sensor.regenvorschau_recklinghausen` (Template ohne `unique_id`), 2× `thermal_comfort`,
  die „Verleih“-Helfer (`input_text.verleih_*` ×4, `input_select.verleih_art`, `input_datetime.verleih_datum`).
- Auskommentierter toter Code und veraltete Notizen in YAML-Dateien sind deshalb **nicht prüfbar**.
  In den UI-Konfigurationen (JSON) gibt es keine Kommentare. Die Beschreibungen sind aktuell und hilfreich.

---

## 2. Systemsteckbrief

| Kennzahl | Wert |
|---|---|
| Hardware / Speicher | Home Assistant Green (aarch64), eMMC 28 GB, belegt 11,4 GB |
| Entitäten (aktiv / im Register) | 1.097 / 2.147 |
| Automationen / Skripte / Szenen | 53 (alle an) / 32 (1 verwaist) / 77 (76 aus Hue, 1 dynamisch) |
| Helfer | 158 (152 im UI, 6 aus YAML), 25 Template-Helfer, 4 Riemann-Integrale, 3 Verbrauchszähler, 2 Statistik-Helfer |
| Integrationen | 86 Einträge; 14 Custom Integrations über HACS (+ `mcp_proxy` der Webhook-Proxy-App) |
| Recorder | SQLite, **1.040 MiB**, älteste Aufzeichnung 15.10.2026 → ≈ 74 MiB pro Tag |
| Dashboards | 3 (Storage-Modus) + automatische Übersicht; 34 Ressourcen (29 inline) |
| Bereiche / Labels / Etagen | 2 (Gartenhaus, Schlafzimmer) / 0 / 0 |
| Zigbee | Zigbee2MQTT (Koordinator SONOFF Dongle-M) **und** ZHA (2. Koordinator CC2652, 1 Gerät) |

---

## 3. Befunde je Aufgabenbereich

Legende **Risiko**: niedrig = kein Funktionswechsel, umkehrbar · mittel = Verhalten gleich, aber Umbau ·
hoch = sichtbare Änderung oder schwer umkehrbar. **Weg**: API = per ha-mcp direkt umsetzbar ·
YAML = braucht Dateizugriff (Kapitel 5, F-03) · UI = nur von dir in der Oberfläche.

### 3.1 Altlasten und tote Komponenten

| ID | Befund | Beleg | Maßnahme | Risiko | Weg |
|---|---|---|---|---|---|
| A-01 | **Eufy komplett stillgelegt**: Integration `eufy_sdk` vom Benutzer deaktiviert, App „eufy-sdk bridge“ gestoppt, 5 Geräte (HomeBase, Privattür, Firmentür, Gartenhaus, Bienenhaus) ohne Funktion; HACS-Integration `eufy_security` installiert **ohne** Integrationseintrag | Integrationsliste, HACS, Geräte | Nach Bestätigung (F-04): Integrationseintrag + Geräte entfernen, App deinstallieren, beide HACS-Integrationen entfernen | mittel | API |
| A-02 | Eufy-Reste im Haupt-Dashboard: Der Kamera-Bereich (Bild-, Sirenen-, Licht- und Stumm-Karten der 4 Eufy-Kameras) verweist auf **12 nicht existierende Entitäten** (`image.*_last_event` ×4, `siren.*_siren` ×4, `switch.*_light` ×4) | Dashboard-Analyse | Eufy-Karten entfernen; die UniFi-Klingeln bleiben | mittel | API |
| A-03 | 4 Eufy-Stummschalt-Timer `timer.timer_kamera_{privattur,firmentur,gartenhaus,bienenhaus}` (Name = Entity-ID) | Helferliste, Dashboard | mit A-02 entfernen; `timer.timer_klingel_*` (UniFi) bleiben | niedrig | API |
| A-04 | HACS-Integration **DPD** installiert, kein Eintrag, wird bei jedem Start geladen | HACS, Loader-Warnungen | deinstallieren | niedrig | API |
| A-05 | Ressource `/local/lovelace-aliexpress-package-card/…js` wird in **keinem** Dashboard benutzt und wirft JS-Fehler | Ressourcen, Frontend-Log 4× | Ressource entfernen (Dateien in `www/` optional löschen) | niedrig | API |
| A-06 | Drucker **Canon MF650C** dauerhaft in `setup_retry`; 5 verwaiste Sensoren mit Suffix `_2`; Kachel „Toner Schwarz“ im Dashboard | Erkennung verwaister Entitäten | Entscheidung F-05: Drucker behalten (nur Kachel ausblenden, wenn aus) oder Integration + Entitäten entfernen | niedrig | API |
| A-07 | Verwaister Registereintrag `script.kamera_snooze_wahlen` (Konfiguration existiert nicht mehr) | Erkennung verwaister Entitäten | Registereintrag entfernen | niedrig | API |
| A-08 | 51 UniFi-Buttons „Port X aus- und einschalten“ dauerhaft `unavailable` (Ports ohne PoE) + 4 UniFi-Protect-Zahlen (`number.klingel_*_klingel_dauer`, `…_infrarot_lux_ausloser`) | Zustandsliste | Entitäten deaktivieren (nicht löschen, kommen sonst zurück) | niedrig | API |
| A-09 | Dauerhaft `unknown`, fachlich sinnlos: `sensor.re_fl20_end_of_charge` (Verbrenner), 3× `sensor.dream_machine_*_auflosung_*`, `sensor.dream_machine_*_typ_*` | Zustandsliste | deaktivieren | niedrig | API |
| A-10 | Helfer ohne Verwendung: `input_select.nest_gartenhaus_ansicht` | Referenzanalyse (Dashboards, Ressourcen, Automationen, Skripte, Template-Helfer) | entfernen | niedrig | API |
| A-11 | **Debug-Rest** `input_text.gg_diag`: Ressource `gg-fenster` schreibt bei jedem Laden auf dem Nest Hub einen Diagnosetext (zusätzlicher Dienstaufruf + Recorder-Zeile) | Ressource gg-fenster v4 | `diag()`-Aufruf aus gg-fenster entfernen, danach Helfer löschen | niedrig | API |
| A-12 | **Nur-Schreib-Helfer**: `input_text.ki_tipp_kalt/_mild/_nachts/_vorheizen`, `ki_status`, `ki_ausblick` werden jede Nacht von Gemini befüllt, aber **nirgends angezeigt** | Referenzanalyse | Entscheidung F-06: im Dashboard anzeigen **oder** Texterzeugung aus `script.ki_heizung_nachtanalyse` entfernen (spart Gemini-Tokens) | niedrig | API |
| A-13 | Fachlich stillgelegter Code in der KI-Heizung: Strategien „Intervall“ und „Wärmepuffer am Nachmittag“ (2 Zweige der Steuerung, `input_number.ki_pufferziel`, Feld `pufferziel` im Gemini-Aufruf). Die Nachtanalyse setzt fest „Sanft durchlaufen“ | Skript + Automation | Entscheidung F-07: entfernen (schlanker) oder als Reserve behalten | mittel | API |
| A-14 | 2 Standard-Blueprints (`motion_light`, `notify_leaving_zone`) ohne Nutzer | Blueprint-Liste | optional löschen (kosmetisch) | niedrig | API |
| A-15 | Hue-Altgruppen: Szenenwähler `select.gartenhaus_2_szene`, `…_ha_sync_szene`, `…_ohne_designlampe_szene` dauerhaft `unknown`; 76 Hue-Szenen, davon 12 in Automationen/Dashboards genutzt. `light.gartenhaus_ohne_designlampe` wird vom Lichtfest noch benutzt | Szenen, Selects | optional: ungenutzte Hue-Zonen in der Hue-App aufräumen; nicht genutzte Szenen-Entitäten deaktivieren | niedrig | UI |
| A-16 | ZHA betreibt einen **zweiten Zigbee-Koordinator** (CC2652 „ZigBee-Dongle Firma“) für genau **1 Gerät** (`binary_sensor.fenster_schlafzimmer`); ZHA verzögert den Start | Geräteliste, Bootstrap-Warnung | Entscheidung F-08: Sensor in Zigbee2MQTT einlernen, ZHA entfernen | mittel | UI |
| A-17 | Toter Standardwert in Ressource `gg-extras`: `steckdose: 'input_boolean.kohlegrill_steckdose'` (existiert nicht; beide Karten überschreiben ihn korrekt) | Ressource | Standard auf `switch.gartenhaus_kohlegrill` setzen | niedrig | API |

**Keine** ungenutzten oder defekten Automationen gefunden. Alle 53 sind aktiv und referenzieren nur existierende Entitäten.
Alte Gruppen (`group.*`) gibt es nicht.

### 3.2 Recorder und Datenbank (Hebel Nr. 1)

**Messung: Zustandswechsel in 24 h (28.10. 09:37 – 29.10. 09:37)**

| Entität | Wechsel/Tag | in Dashboards genutzt als |
|---|---:|---|
| `sensor.dream_machine_special_edition_port_9_tx` | 69.070 | 24-h-Mittelwert (Statistik) |
| `sensor.dream_machine_special_edition_port_9_rx` | 69.066 | 24-h-Mittelwert (Statistik) |
| `sensor.dream_machine_special_edition_speicherauslastung` | 47.473 | – |
| `sensor.dream_machine_special_edition_wan_download_gesamt` (Riemann) | 43.381 | – (Quelle für Monatszähler) |
| `sensor.dream_machine_special_edition_wan_download_monat` (Verbrauchszähler) | 43.312 | 31-Tage-Diagramm (Statistik) |
| `sensor.dream_machine_special_edition_wan_upload_gesamt` (Riemann) | 43.016 | – |
| `sensor.dream_machine_special_edition_wan_upload_monat` (Verbrauchszähler) | 42.946 | 31-Tage-Diagramm (Statistik) |
| `sensor.dream_machine_special_edition_cpu_auslastung` | 41.684 | – |
| **Summe Dream Machine** | **≈ 399.900** | |
| `sensor.gartenhaus_kuhlschrank_leistung` | 5.948 | 30-Tage-Mittelwert |
| `sensor.gartenhaus_absolute_humidity` (thermal_comfort) | 3.142 | Verlauf 24 h / 8 Tage |
| `sensor.gartenhaus_thermostat_gartenhaus_kohlendioxid` | 2.712 | Verlauf |
| `sensor.gartenhaus_kuhlschrank_spannung` | 2.505 | – |
| `sensor.gartenhaus_thermostat_gartenhaus_luftfeuchtigkeit` | 1.732 | Verlauf |
| `sensor.dream_machine_special_edition_google_wan_latenz` | 1.483 | Anzeige |
| `sensor.gartenhaus_klima_strommesser_energie` | 1.436 | Kosten/Statistik |
| `sensor.klima_empfehlung` (lange Textzustände) | 1.386 | Anzeige (kein Verlauf) |
| `sensor.klima_empfehlung_schlafzimmer` | 1.109 | Anzeige (kein Verlauf) |
| übrige 50 gemessene Entitäten | ≈ 10.000 | |

**Einordnung:** 1.040 MiB in 14 Tagen bei ≈ 434.000 Zeilen/Tag entspricht ≈ 180 Byte je Zeile. Die Rechnung geht auf.
**92 % der Datenbank stammen von acht Netzwerk-Sensoren**, die du größtenteils gar nicht auswertest.

| ID | Befund | Maßnahme | Risiko | Weg |
|---|---|---|---|---|
| R-01 | Dream-Machine-CPU und -RAM sowie U7-Pro-CPU und -RAM sind nirgends genutzt | Entitäten **deaktivieren**. Das entlastet Recorder **und** Event-Loop | niedrig | API |
| R-02 | WAN-Volumen und -Durchsatz brauchen Langzeitstatistik. Ein reines Recorder-Exclude würde die Diagramme zerstören, weil Statistik nur aus aufgezeichneten Zuständen entsteht | **Gedrosselte Kopien** (Template mit Zeit-Trigger alle 5 min, Anhang C) der beiden Riemann-Summen. Verbrauchszähler „WAN Download/Upload Monat“ auf diese Kopien umstellen (Option im UI). Durchsatz-Diagramm aus der 5-Minuten-Statistik der Kopie (Δ / 300 s = Mbit/s, gleicher Informationsgehalt wie bisher der 5-min-Mittelwert). Danach `port_9_rx/tx` und `wan_*_gesamt` vom Recorder ausschließen. Riemann rechnet weiter mit voller Auflösung im Speicher | mittel | YAML + API |
| R-03 | Recorder-Konfiguration unbekannt, wirkt wie Standard mit ≈ 14 Tagen | Recorder-Block nach Anhang B: `purge_keep_days: 10` (reicht für die 8-Tage-Diagramme), `commit_interval: 30` (weniger eMMC-Transaktionen; Verlauf erscheint bis zu 30 s später, Automationen sind nicht betroffen), Ausschlüsse für Rauschen | mittel | YAML |
| R-04 | Rauschwerte ohne Auswertung: Betriebszeiten, Uplink-MAC, IP-Adressen, WLAN-Signal, Batteriespannungen (mV), `sun.sun` (Attribute ändern sich laufend), `sensor.sun_next_*`, Kühlschrank-Spannung/-Strom, UI-Zustände (`input_boolean.ki_menu_offen`, `…klima_modusauswahl_offen`), Messpunkt-Text, 78 UniFi-`device_tracker` | Recorder-Ausschluss (Anhang B). Personen-Historie bleibt über `person.*` erhalten; die Positionshistorie des Autos (`device_tracker` von Mercedes) entfällt dann, falls du sie nicht brauchst | niedrig | YAML |
| R-05 | `sensor.klima_empfehlung*`: über 2.400 lange Textzeilen pro Tag, Historie wird nirgends gebraucht (Trigger nutzen nur den Live-Zustand) | ausschließen | niedrig | YAML |
| R-06 | Kühlschrank-Stecker (Zigbee2MQTT) meldet Leistung im Sekundenbereich | In Zigbee2MQTT das Reporting für `power` auf min. 30–60 s bzw. ≥ 1 W Änderung setzen. Die 30-Tage-Statistik bleibt gleich aussagekräftig | niedrig | UI (Z2M) |
| R-07 | Event-Tabelle: `call_service`-Ereignisse werden mitgeschrieben (u. a. jeder Lichtbefehl; das Lichtfest-Skript enthält 259 davon, die Effekt-Schleifen wiederholen sie) | `exclude: event_types: [call_service]`. Logbuch und Automations-Trigger bleiben unberührt | niedrig | YAML |
| R-08 | Nach der Umstellung bleibt die Datei groß, weil SQLite den Platz nicht freigibt | einmalig `recorder.purge_entities` für ausgeschlossene Entitäten + `recorder.purge` mit `repack: true` (nachts) | niedrig | API |

**Erwartetes Ergebnis:** ≈ 35.000–50.000 statt ≈ 434.000 Zeilen/Tag. Datenbank bei 10 Tagen Aufbewahrung ≈ 100–150 MB
statt ≈ 1 GB. Schnellere Verlaufsansichten, kürzere Backups, deutlich weniger eMMC-Verschleiß.

### 3.3 Modularisierung und Architektur

| ID | Befund | Empfehlung | Risiko | Weg |
|---|---|---|---|---|
| M-01 | Fast alles liegt im UI-Speicher (Automationen, Skripte, Helfer, Template-Helfer). Das ist der heutige HA-Standard und gut so | **Automationen und Skripte NICHT in YAML-Pakete verschieben**: Die UI-Bearbeitbarkeit, Traces und die Bearbeitung per API würden leiden. `packages/` nur für das, was YAML zwingend braucht | – | – |
| M-02 | Kleiner YAML-Anteil (Verleih-Helfer, Regenvorschau, thermal_comfort, Recorder) | Struktur nach Anhang D: `configuration.yaml` schlank, `homeassistant: packages: !include_dir_named packages`, je Thema eine Datei (`recorder.yaml`, `netzwerk.yaml`, `klima.yaml`, `verleih.yaml`, `wetter.yaml`) | niedrig | YAML |
| M-03 | Verleih-Helfer gemischt: 6 aus YAML, die zugehörige Automation und das Skript aus dem UI | entweder alle 6 Helfer als UI-Helfer neu anlegen (gleiche Entity-IDs) **oder** als Paket `verleih.yaml` bündeln | niedrig | YAML/API |
| M-04 | Keine Labels und Kategorien, nur 2 Bereiche (Bereichs-ID `kuche` trägt den Namen „Gartenhaus“, Altlast einer Umbenennung) | Labels für Themen anlegen (Klima/KI, Mercedes, Kohlegrill, Wecker, Lichtfest, Push, System, Dashboard-UI) und Automationen, Skripte und Helfer zuordnen. Ändert keine Entity-IDs | niedrig | API |
| M-05 | Benennung: Die Entity-IDs folgen größtenteils schon `bereich_gerät_funktion` (`gartenhaus_*`, `schlafzimmer_*`). Abweichungen: Dyson-IDs mit Seriennummer, Mercedes `re_fl20_*`, `timer.timer_kamera_*` | **Keine Massen-Umbenennung**: Die 29 Inline-Module und das 1-MB-Dashboard enthalten Entity-IDs fest im Code (z. B. Geräte-Zuordnungen in gg-fenster, Standardwerte in gg-extras). Jede Umbenennung bräuchte eine vollständige Folgenanalyse je ID. Empfehlung: Anzeigenamen vereinheitlichen, Entity-IDs nur bei Neuanlagen nach Schema | – | – |
| M-06 | Datenspeicher in `input_text` (255 Zeichen, mit `;`/`|` kodiert): KI-Modell, Lernmodell, Messpunkt, Prognose, Bürofahrten, gemeldete Batterien. `ki_heizprotokoll` steht bei 237/255 (Rollierend, gewollt). `batterie_gemeldet` würde ab ≈ 10 leeren Geräten still abgeschnitten | mittelfristig: Trigger-basierte Template-Sensoren mit JSON-Attributen (kein 255-Limit, lesbar). Großer Umbau, daher Phase 7 | mittel | YAML |
| M-07 | `script.lichtfest_ablauf` ist ein **100-KB-Monolith** (259 Lichtbefehle, 204 Pausen, 140 Wenn-Blöcke). Im UI-Editor kaum noch bearbeitbar | aufteilen: ein Skript je Anlass + gemeinsame Effekt-Skripte (Blitz, Flackern, Konfetti). Ablauf bleibt identisch | mittel | API |
| M-08 | Dubletten: `script.updates_installieren` und `script.updates_nachts` teilen ≈ 70 % Logik | gemeinsamen Kern als Skript mit Feld `bericht/push` | mittel | API |

### 3.4 Code-Modernisierung und Template-Effizienz

**Legacy-Template-Syntax:** Nur **ein** Sensor nutzt noch das alte Format (`sensor.regenvorschau_recklinghausen`,
YAML, ohne `unique_id`). Alle 25 übrigen Template-Sensoren sind moderne UI-Template-Helfer.
**Unsichere Getter** `states.domain.entity.state` kommen **nicht** vor. `states.x.y.last_changed` (7×) ist zulässig.

| ID | Befund | Maßnahme | Risiko | Weg |
|---|---|---|---|---|
| T-01 | `sensor.regenvorschau_recklinghausen`: Legacy-Template ohne `unique_id` (nicht im UI verwaltbar) | in moderne `template:`-Syntax mit `unique_id` überführen (gleiche Entity-ID). Vorlage folgt, sobald die YAML lesbar ist | niedrig | YAML |
| T-02 | **Ursache der Log-Fehler** „invalid sensor state: unknown … expected a number/date“: Die Template-Helfer Mercedes Tankstand, Reichweite, Tankinhalt, Tage bis Tanken und Tanken spätestens geben den **Text** `unknown` zurück, obwohl Einheit/Zustandsklasse eine Zahl verlangen | `unknown` durch `none` ersetzen (bzw. Verfügbarkeits-Template). Gleiches Verhalten, keine Fehler mehr | niedrig | API |
| T-03 | **Ursache des Log-Fehlers** `today_at('unkno')`: `today_at(states('input_datetime.…')[:5])` ohne Absicherung. Beim Start ist der Helfer kurz `unknown` | Absicherung mit `has_value()`/Standardzeit in Markdown-Karte (nest-schlafzimmer), `script.wecker_schlafzimmer_stellen` und Automation „geänderte Weckzeit übernehmen“ | niedrig | API |
| T-04 | Automation „Batterie fast leer“: **Template-Trigger iteriert über alle Sensoren** (`states.sensor`) und rendert bis zu 1×/s, weil die Dream Machine ständig Sensoren ändert (≈ 86.000 Renderings/Tag) | Template-Trigger entfernen. Der stündliche Lauf (:07) wertet ohnehin alles aus → Meldung kommt spätestens nach 60 min (**kleine Verhaltensänderung**, F-09). Alternative ohne Verzögerung: zweckgebundener Trigger `battery.level_crossed_threshold` auf ein Label „Batterie“ (neue Geräte müssen dann das Label bekommen) | niedrig | API |
| T-05 | Geprüft: Zustands-Trigger ohne `to:` (Mercedes-Messung, -Fahrten, -Warnung, Klima-Tipp-Push, Stoßlüften) hängen an Template-Helfern ohne wechselnde Attribute und feuern deshalb nur bei echten Wertänderungen. „Energie-Tarif“ braucht die Attribut-Auslösung (Modus `heat_cool`) | kein Handlungsbedarf | – | – |
| T-06 | Hue-Wandschalter „Alles aus“: Zustands-Trigger auf `event.*` + Template-Bedingung `event_type == 'long_press'` | Zweckgebundener Trigger `event.received` mit Ereignistyp `long_press` (Best Practice seit 2026.x; Syntax wird beim Umbau gegen die Doku geprüft) | niedrig | API |
| T-07 | 4 Automationen nutzen den alten Ereignis-Trigger `timer.finished`/`timer.cancelled` (Klima-Tipp-Ablauf, Stoßlüften, Kohlen bereit, KI-Steuerung) | zweckgebundene Timer-Trigger `timer.finished` mit `target` | niedrig | API |
| T-08 | CO₂-Warnung: `wait_for_trigger` **ohne Timeout**. Fällt der Sensor aus, hängt der Lauf bis zum Neustart, und neue Warnungen werden (Modus `single`) verschluckt | Timeout (z. B. 6 h) mit sauberem Ende, Ausgangszustand wiederherstellen (**kleine Verhaltensänderung**, F-09) | niedrig | API |
| T-09 | Lüften-Erkennung (Gartenhaus, Schlafzimmer): Template-Trigger mit `now()` und `states.timer….last_changed` → minütliche Auswertung | Zustands-Trigger auf Fenster/Empfehlung + Bedingungen. Gleiches Verhalten | mittel | API |
| T-10 | `| int` / `| float` ohne Standardwert: ≈ 34× in Automationen/Skripten, ≈ 37× in Dashboard-Templates. Meist unkritisch (Werte aus Feldern), aber Fehlerquelle bei `unknown` | in jedem angefassten Objekt mit Standardwert härten | niedrig | API |
| T-11 | Wettervorhersage wird stündlich **zweimal** geholt (:05 Außentemperatur 12 h, :07 UV-Vorschau) | eine Automation, ein Abruf, beide Helfer füllen (Trigger-IDs) | niedrig | API |
| T-12 | Kohlegrill „Kohlen bereit“: Pulsieren per Schleife mit bis zu **1.700 Lichtbefehlen** in 20 min (alle 0,7 s) | Option: Hue-Effekt `flash: long`/`breathe` alle ≈ 15 s (≈ 80 statt 1.700 Befehle). Sieht leicht anders aus → nur mit deinem OK (F-10) | mittel | API |

**Konsolidierung fragmentierter Automationen (Trigger-IDs / `choose`):**

| ID | Heute | Danach | Verhalten |
|---|---|---|---|
| K-01 | „Nest Hub Gartenhaus – Dashboard anzeigen“ + „Nest Hub Schlafzimmer – Dashboard anzeigen“ (identisch bis auf Entität/Pfad) | 1 Automation mit Trigger-IDs + Variablen-Tabelle | identisch |
| K-02 | „… Design nach Start nachladen“ ×2 | 1 Automation (Modus `parallel`, je Hub eigener Ablauf) | identisch |
| K-03 | „Klima Modus-Menü automatisch schließen“ (8 s) + „runde Menüs automatisch schließen“ (15 s) | 1 Automation, 2 Trigger mit eigenen `for:` | identisch |
| K-04 | Außentemperatur 12 h + UV-Vorschau | siehe T-11 | identisch |

Bewusst **nicht** zusammengelegt: die beiden Kohlegrill-Sicherungen (doppelte Sicherung bei einer Heizlast ist richtig),
die CarPlay-Skripte (CarPlay braucht feldlose Einzelskripte), Lüften Gartenhaus/Schlafzimmer (unterschiedliche Logik mit Türen).

### 3.5 Logfile- und Fehleranalyse

Fenster: 28.10. 03:40 – 29.10. 04:00 (2.000 Zeilen, 417 Einträge, 74 verschiedene Meldungen). Deprecation-Meldungen: **keine**.
Am 28.10. gab es ≈ 10 Neustarts (Entwicklung Lichtshow). Gegen 03:25 am 29.10. fiel das Netz bzw. DNS aus;
viele Folgemeldungen stammen daher.

| Meldung | Anzahl | Ursache | Behebung | Art |
|---|---:|---|---|---|
| Template-Validator „invalid sensor state: unknown“ (5 Mercedes-Sensoren) | 11 | Textwert `unknown` statt `none` | **T-02** | Code |
| `today_at … 'unkno'` (Markdown Wecker) | 4 | fehlende Absicherung | **T-03** | Code |
| Frontend: `aliexpress_package_card.js` TypeError | 4 | ungenutzte, defekte Ressource | **A-05** | Code |
| Dyson: lokale MQTT-Verbindung Timeout + Reparatur „configured host unreachable“ (IoT-VLAN 192.168.20.x) | 9 + Reparatur | HA (192.168.10.x) erreicht den Dyson nicht direkt; fällt auf Cloud zurück und verzögert den Start (> 10 s) | UniFi-Firewall-Regel HA → Dyson TCP 1883 **oder** Dyson-Integration auf reinen Cloud-Betrieb stellen (F-11) | Netzwerk |
| UniFi Websocket / FirewallPolicies (502/503, DNS-Timeout) | 32 | Netzausfall 03:25 und kurzzeitige UniFi-OS-Fehler | keine Konfigurationsursache; beobachten | extern |
| Apple TV „Failed to connect“ (Port 7000 verweigert) | 19 | Apple TV im Ruhezustand | harmlos, kein Handlungsbedarf | extern |
| MCP Proxy: upstream 127.0.0.1:9583 | 140 | Neustarts der ha-mcp-App während der Entwicklung | harmlos | extern |
| Cast: `_connect_hass failed` (externe Tailscale-Adresse) | 6 | Nest Hubs erreichen die externe URL während des DNS-Ausfalls nicht | beobachten; bei Häufung interne URL für Cast prüfen | Netzwerk |
| Login fehlgeschlagen (1× lokale iPhone-App, 2× externe Adressen) | 3 + Benachrichtigung | HA ist von außen erreichbar (Tailscale-Adresse); veraltetes Token in einer App | `http: ip_ban_enabled: true` + `login_attempts_threshold: 5` (F-12); App neu anmelden | Sicherheit |
| `update.install` auf „Gartenhaus Lichtshow“ ohne Update | 5 | manuelle Klicks | harmlos | – |
| `ki_heizung_nachtanalyse`: Already running | 1 | Handstart während des Laufs | harmlos | – |
| Custom-Integration-Warnungen (je Start ≈ 15) | 124 | normal für HACS | sinkt mit A-01/A-04 | – |
| DHL „unrecognised field oneTimeCode“, Matter Node 4, Google requestSync 500, Hermes-Postfach | je 1–3 | Integrationen selbst (upstream) | kein Handlungsbedarf | upstream |

### 3.6 Event-Loop-Entlastung und Polling

`scan_interval` in YAML ist nicht lesbar (Kapitel 1). Die UI-Integrationen arbeiten fast alle **push-basiert**
(UniFi, Hue, Shelly, Zigbee2MQTT, Matter, Mercedes-Websocket, Apple TV, Cast). Polling betrifft nur Daikin (Cloud,
Tageslimit 200 Befehle, Automationen sparen bereits), Paketdienste, Tankerkönig und Wetter. Das ist unkritisch.

Die Event-Loop-Last entsteht **im System selbst**:

| ID | Befund | Maßnahme | Ersparnis | Risiko | Weg |
|---|---|---|---|---|---|
| P-01 | **Kohlegrill-Wächter**: Zeitmuster jede Minute **ohne** Bedingung → 1.440 Läufe/Tag (jeder mit Trace, `automation_triggered`-Ereignis und neuer Zustandszeile) | Bedingung „Steckdose ist an“ auf oberste Ebene. Alle Zweige setzen das ohnehin voraus | ≈ 1.440 Läufe/Tag | niedrig | API |
| P-02 | KI-Steuerung (alle 5 min), Raumfühler-Regelung (alle 10 min), Strommesser-Wächter (alle 15 min) laufen auch dann, wenn ihr Zweig gar nicht greifen kann (die KI ist zurzeit aus!) | Bedingungen „Trigger ≠ Takt **oder** Voraussetzung erfüllt“ auf oberster Ebene, identisch zur heutigen Zweiglogik | ≈ 530 Läufe/Tag | niedrig | API |
| P-03 | Template-Trigger über `states.sensor` (Batterie) | **T-04** | ≈ 86.000 Renderings/Tag | niedrig | API |
| P-04 | 78 UniFi-Client-Tracker (`device_tracker`, Quelle Router) ohne Verwendung; Personen nutzen die iPhone-GPS-Tracker | UniFi-Option „Clients verfolgen“ bzw. „kabelgebundene Clients“ abschalten **oder** Tracker deaktivieren (F-13). Die WLAN-Client-Zähler bleiben | 78 Entitäten weniger | niedrig | API |
| P-05 | 14 UniFi-Client-Bandbreitensensoren (`*_rx`/`*_tx` von PC, iMac, Watch, Android …) ungenutzt | deaktivieren (die Option „Bandbreitensensoren“ muss an bleiben, sie liefert Port 9) | – | niedrig | API |
| P-06 | Dashboards: 107 Markdown-Karten mit Jinja (jede ist ein Server-Abo, das bei jeder Änderung einer referenzierten Entität neu rendert), 3 davon iterieren über `states.sensor`/`states.update` | siehe U-05 | – | – | – |

### 3.7 UI- und Lovelace-Hygiene

| ID | Befund | Maßnahme | Risiko | Weg |
|---|---|---|---|---|
| U-01 | Karten mit nicht existierenden Entitäten: Eufy-Kamera-Block (A-02), `sensor.super_95_shell_7_tage` (Markdown, Mercedes/Tanken, 2×), Canon-Toner-Kachel (A-06) | entfernen bzw. auf vorhandene Sensoren umstellen | niedrig | API |
| U-02 | Haupt-Dashboard **995 KB** in **einer** Ansicht: 42 Bubble-Pop-ups, 50 ApexCharts, 66 Markdown-Karten, 53 card-mod-Karten. Dazu Hintergrundbild 65 KB und 2 eingebettete Bilder 130 KB als Base64 in der Konfiguration | Bilder nach `/config/www/gg/` auslagern (−195 KB); schwere Analyse-Pop-ups (Klima-Verläufe, Energie, Netzwerk) in eigene Unteransichten verschieben, damit sie erst beim Öffnen laden (F-14) | mittel | API (+ Dateien) |
| U-03 | **29 Inline-Ressourcen (483 KB)** als `data:`-URI: werden auf **jeder** HA-Seite, auf jedem Gerät und bei jedem Laden mitgeschickt, sind nicht separat zwischenspeicherbar und enthalten zusätzlich Base64-Bilder (`GG_AUTO_FOTO`, `GG_AUTO_MOTOR`, `gg-bild`) | als Dateien nach `/config/www/gg/*.js|css` mit Versionsparameter (`?v=12`) → Browser-Cache und gzip. **Vorschlag:** Quelltext der gg-Karten in diesem Repository versionieren (Ordner `dashboard/gg/`), damit es eine einzige Quelle gibt | mittel | Dateien (F-03) |
| U-04 | 50 ApexCharts; die 8-Tage-Verläufe (11×) und mehrere 30-Tage-Diagramme aktualisieren alle 5 min → bei geöffnetem Dashboard laufend Verlaufs- und Statistikabfragen über viele Tage | Intervalle staffeln: 24 h → 5 min, 7–8 Tage → 30 min, 30–31 Tage → 1 h, 365 Tage → 6 h | niedrig | API |
| U-05 | Markdown-Karten ohne Templates (reine Überschriften) und mit sehr breiten Templates (`states.sensor`, `states.update`) | Überschriften → `heading`-Karte; breite Iterationen auf vorhandene Helfer/Sensoren umstellen (z. B. Batterieliste aus der gg-batterien-Karte, Update-Zähler aus `update`-Entitäten) | niedrig | API |
| U-06 | Ungenutzte Custom Card AliExpress | **A-05** | niedrig | API |
| U-07 | Benötigt und sinnvoll: card-mod (53×), Bubble Card (43×), ApexCharts (50×), Kiosk-Mode sowie alle gg-Module (jedes definierte Element wird verwendet; reine Stil-/Verhaltensmodule geprüft) | keine Entfernung | – | – |

---

## 4. Umsetzungsplan (Reihenfolge nach Nutzen/Risiko)

Für jede Phase gilt: vorher Sicherung **des einzelnen Objekts** (ha-mcp legt bei jeder Änderung automatisch eine
Sicherung an, Rückgängig ohne Neustart), danach Prüfung (Trace, Log, Zustand). Dein manuelles Komplett-Backup ist
die Rückfallebene für YAML-Änderungen.

| Phase | Inhalt | IDs | Weg | Neustart | Rückweg |
|---|---|---|---|---|---|
| **0** | Zugriff klären (F-03), Ausgangswerte festhalten (DB-Größe, Ladezeit Dashboard) | – | – | – | – |
| **1 – Schnelle Gewinne** | Entitäten deaktivieren; leere Automationsläufe stoppen; Log-Fehler beheben; Batterie-Trigger; verwaiste Einträge; AliExpress-Ressource | R-01, A-08, A-09, P-01, P-02, P-05, T-02, T-03, T-04, A-05, A-07 | API | nein | Objekt-Sicherung / Entität wieder aktivieren |
| **2 – Datenbank** | WAN-Drosselung + Umstellung Verbrauchszähler + Diagramm; Recorder-Block; Neustart; einmalig bereinigen + Repack; Z2M-Reporting | R-02 … R-08 | YAML + API | **ja** | YAML-Datei zurückkopieren |
| **3 – Altlasten** | Eufy, DPD, Kamera-Timer, Dashboard-Blöcke, gg_diag, ungenutzter Helfer, Blueprints, KI-Texte (nach Entscheidung) | A-01 … A-04, A-06, A-10 … A-14, U-01 | API | nein | Komplett-Backup (Integrationen) |
| **4 – Konsolidierung** | Nest-Hub-, Menü- und Wetter-Automationen zusammenlegen; Hue-Schalter auf `event.received`; Timer-Trigger; CO₂-Timeout; Lüften-Trigger | K-01 … K-04, T-06 … T-09, T-11 | API | nein | Objekt-Sicherung |
| **5 – YAML-Struktur** | Pakete, Regenvorschau modernisieren, Verleih bündeln, Labels | M-02 … M-04, T-01 | YAML + API | ja | YAML zurück |
| **6 – Frontend** | Ressourcen und Bilder auslagern, Diagramm-Intervalle, Ansichten aufteilen | U-02 … U-05 | API + Dateien | nein | Dashboard-Sicherung |
| **7 – Optional** | Lichtfest aufteilen, Update-Skripte, `input_text`-Speicher → Template-Sensoren, ZHA → Z2M, Kohlegrill-Puls | M-06 … M-08, A-16, T-12 | API/YAML/UI | teils | Objekt-Sicherung |

---

## 5. Offene Entscheidungen (bitte beantworten)

| Nr. | Frage |
|---|---|
| F-01 | `input_boolean.ki_heizung_aktiv` ist **aus**, der Frostschutz im Gartenhaus also inaktiv. Gewollt? |
| F-02 | Das HA-Cloud-Abo endet am **03.11.2026**. Davon hängen ab: Google Assistant und die Cloud-Sprachausgabe als Ersatzansage des Weckers. Verlängern oder Ersatz planen? |
| F-03 | Dateizugriff: Soll ich die Komponente **„HA-MCP File & YAML Tools“** (`ha_mcp_tools`, über HACS) installieren? Damit kann ich YAML lesen, mit Sicherung und Konfigurationsprüfung ändern und Dateien in `/config/www` ablegen. Alternativ setzt du die YAML-Teile nach meiner Vorlage selbst im File editor um. |
| F-04 | Eufy endgültig aufgeben (Integrationen, App, Geräte, Dashboard-Block entfernen)? |
| F-05 | Canon-Drucker: behalten (nur wenn eingeschaltet sichtbar) oder Integration entfernen? |
| F-06 | KI-Texte (Tipps, Status, Ausblick): im Dashboard anzeigen oder die Erzeugung abschalten? |
| F-07 | Stillgelegte KI-Strategien „Intervall“/„Wärmepuffer“ entfernen oder behalten? |
| F-08 | Fenstersensor Schlafzimmer nach Zigbee2MQTT umziehen und ZHA samt zweitem Dongle entfernen? |
| F-09 | Kleine Verhaltensänderungen ok? (a) Batteriewarnung spätestens zur nächsten vollen Stunde statt sofort (oder Label-Variante ohne Verzögerung), (b) CO₂-Warnung endet nach 6 h ohne Entwarnung von selbst |
| F-10 | Kohlegrill-Hinweis: Hue-Effekt statt 1.700 Einzelbefehle (sieht etwas anders aus)? |
| F-11 | Dyson: Firewall-Regel im UniFi für lokalen Zugriff oder reiner Cloud-Betrieb? |
| F-12 | Login-Schutz (`ip_ban_enabled`, 5 Fehlversuche) aktivieren? Achtung: Eine eigene App mit veraltetem Token kann sich dann selbst sperren. Entsperren über `ip_bans.yaml`. |
| F-13 | UniFi-Client-Verfolgung (78 Tracker) abschalten? |
| F-14 | Haupt-Dashboard: Analyse-Pop-ups in Unteransichten verschieben (Bedienung ändert sich leicht) oder nur Bilder/Intervalle optimieren? |

---

## 6. Bewusst nicht empfohlen

- **UI-Automationen in YAML-Pakete verschieben**: Verlust von UI-Editor, Traces und API-Pflege, kein Leistungsgewinn.
- **Massen-Umbenennung von Entity-IDs**: hohes Bruchrisiko durch fest kodierte IDs in 29 JS-Modulen und dem Dashboard.
- **`automation`-Domäne vom Recorder ausschließen**: Das Logbuch „ausgelöst durch“ ginge verloren. Besser die Ursache beheben (P-01/P-02).
- **Riemann-Integrale auf eine andere Einheit umbauen**: bräche die Statistik-Historie. Die Drosselung (R-02) erreicht dasselbe ohne Bruch.
- **Doppelte Kohlegrill-Sicherung zusammenlegen**: Redundanz bei einer Heizlast ist gewollt.

---

## Anhang A – Schreiblast der übrigen gemessenen Entitäten (Auszug, Wechsel/24 h)

| Entität | Wechsel | | Entität | Wechsel |
|---|---:|---|---|---:|
| `sensor.gartenhaus_thermostat_gartenhaus_temperatur` | 1.413 | | `sensor.dyson_*_voc` | 1.202 |
| `sensor.dyson_*_luftqualitatsindex` | 1.239 | | `sensor.gartenhaus_klima_strommesser_leistung` | 1.168 |
| `sensor.gartenhaus_klima_strommesser_klima_energie_sonstiges` | 1.152 | | `sensor.gartenhaus_kuhlschrank_wirkstrom` | 883 |
| `sensor.dyson_*_pm10` / `_pm2_5` | 843 / 827 | | `sensor.gartenhaus_u7_pro_cpu_auslastung` / `_speicherauslastung` | 680 / 648 |
| `sensor.gartenhaus_thermostat_gartenhaus_pm25` | 612 | | `sensor.gartenhaus_kuhlschrank_energie_berechnet` | 599 |
| `sensor.dyson_*_hcho` | 148 | | `sensor.dyson_*_wifi_signal` | 133 |
| `sensor.unifi_wifi_clients` | 118 | | `light.gartenhaus_gartenhaus` | 104 |
| `binary_sensor.gartenhaus_tur_ost_contact` | 87 | | `sun.sun` (nur Zustand; Attribute zusätzlich) | 2 |

## Anhang B – Entwurf Recorder-Konfiguration

Wird **mit** der bestehenden `recorder:`-Konfiguration zusammengeführt, sobald sie lesbar ist (F-03).
Erst nach Umsetzung von R-02 aktivieren.

```yaml
# packages/recorder.yaml (bzw. recorder: in configuration.yaml)
recorder:
  purge_keep_days: 10          # 8-Tage-Diagramme brauchen ≥ 8 Tage Rohdaten
  commit_interval: 30          # weniger Schreibtransaktionen auf der eMMC
  auto_purge: true
  auto_repack: true
  exclude:
    event_types:
      - call_service
    domains:
      - device_tracker         # Personen-Historie bleibt über person.* erhalten
    entities:
      - sun.sun
      - sensor.dream_machine_special_edition_port_9_rx
      - sensor.dream_machine_special_edition_port_9_tx
      - sensor.dream_machine_special_edition_wan_download_gesamt
      - sensor.dream_machine_special_edition_wan_upload_gesamt
      - sensor.gartenhaus_kuhlschrank_spannung
      - sensor.gartenhaus_kuhlschrank_wirkstrom
      - sensor.klima_empfehlung
      - sensor.klima_empfehlung_schlafzimmer
      - input_boolean.ki_menu_offen
      - input_boolean.klima_modusauswahl_offen
      - input_text.ki_messpunkt
    entity_globs:
      - sensor.*_betriebszeit*
      - sensor.*_uplink_mac
      - sensor.*_ip_adresse
      - sensor.*_wifi_signal
      - sensor.*_voltage
      - sensor.sun_next_*
```

## Anhang C – Entwurf gedrosselte WAN-Zähler (R-02)

```yaml
# packages/netzwerk.yaml
template:
  - triggers:
      - trigger: time_pattern
        minutes: "/5"
      - trigger: homeassistant
        event: start
    sensor:
      - name: "WAN Download gesamt (5 min)"
        unique_id: wan_download_gesamt_5min
        state: "{{ states('sensor.dream_machine_special_edition_wan_download_gesamt') | float(none) }}"
        availability: "{{ has_value('sensor.dream_machine_special_edition_wan_download_gesamt') }}"
        unit_of_measurement: "Mbit"
        device_class: data_size
        state_class: total_increasing
      - name: "WAN Upload gesamt (5 min)"
        unique_id: wan_upload_gesamt_5min
        state: "{{ states('sensor.dream_machine_special_edition_wan_upload_gesamt') | float(none) }}"
        availability: "{{ has_value('sensor.dream_machine_special_edition_wan_upload_gesamt') }}"
        unit_of_measurement: "Mbit"
        device_class: data_size
        state_class: total_increasing
```

Danach: Verbrauchszähler „WAN Download/Upload Monat“ in den Helfer-Optionen auf die neuen Sensoren umstellen
(der Zähler läuft mit seinem Stand weiter), das 24-h-Durchsatzdiagramm auf `statistics: {type: change, period: 5minute}`
der neuen Sensoren mit `transform: "return x / 300;"` umstellen. Vor dem Recorder-Ausschluss wird geprüft, dass beide
Diagramme Werte zeigen.

## Anhang D – Zielstruktur YAML

```text
/config
├── configuration.yaml        # nur default_config, homeassistant (packages), http, frontend
├── packages/
│   ├── recorder.yaml         # Anhang B
│   ├── netzwerk.yaml         # Anhang C
│   ├── klima.yaml            # thermal_comfort (absolute Luftfeuchte)
│   ├── wetter.yaml           # Regenvorschau (modernes template:)
│   └── verleih.yaml          # oder Helfer ins UI überführen (M-03)
├── www/gg/                   # gg-Karten als Dateien (U-03), Quelle: dieses Repository
├── automations.yaml          # UI-verwaltet, bleibt
├── scripts.yaml              # UI-verwaltet, bleibt
└── scenes.yaml               # UI-verwaltet, bleibt
```

## Anhang E – Dauerhaft nicht verfügbare Entitäten (63)

- 51× `button.*_port_N_aus_und_einschalten` (Dream Machine Ports 1–8, USW 24 Firmenbereich, USW 24 Wohnbereich)
- 4× `number.klingel_{firma,privat}_{klingel_dauer,benutzerdefinierter_infrarot_lux_ausloser}`
- 5× Canon MF650C (`sensor.canon_mf650c_series_2` + 4 Toner), Integration in `setup_retry`
- `script.kamera_snooze_wahlen` (verwaist), `sensor.klingel_{firma,privat}_spannung` (UniFi Protect liefert sie nicht mehr)

---

## 7. Umsetzungsstand (29.10.2026, nach Freigabe F-01 … F-14)

Alle Änderungen liefen über die HA-API (ha-mcp), mit Objekt-Sicherung je Automation/Skript/Dashboard.
Jede geänderte Automation wurde danach geprüft (Zustand `on`, kein Log-Fehler, wo möglich ein Testlauf mit Trace).

### Erledigt

| ID | Was | Ergebnis |
|---|---|---|
| F-03 | HACS: `ha_mcp_tools` installiert, DPD entfernt, Neustart | Datei-/YAML-Zugriff fehlt noch → **zwei UI-Schritte durch dich**, siehe unten |
| P-04 / F-13 | UniFi: „Clients verfolgen“ und „kabelgebundene Clients“ aus | 78 Tracker weniger |
| R-01, P-05, A-08, A-09 | deaktiviert: CPU/RAM UDM + U7 Pro, 3× UDM-Auflösung, `re_fl20_end_of_charge`, 16 Client-rx/tx, 51 PoE-Port-Buttons, 4 Klingel-Zahlen | deutlich weniger Recorder-Zeilen |
| P-01 | Kohlegrill-Wächter: Bedingung „Steckdose an“ oben | ≈ 1.440 leere Läufe/Tag weniger |
| P-02 | KI-Steuerung, Raumfühler-Regelung, Strommesser-Wächter: Takt-Auslöser nur, wenn ein Zweig greifen kann | ≈ 530 leere Läufe/Tag weniger |
| T-04 / F-09a | Batterie-Warnung: Template-Trigger über alle Sensoren entfernt, stündlicher Lauf bleibt | ≈ 86.000 Renderings/Tag weniger |
| T-08 / F-09b | CO₂-Warnung: Timeout 6 h; danach Lampe ohne Grün-Signal zurück, Automation wieder frei | kein hängender Lauf mehr |
| K-01 | Nest Hubs: „Dashboard anzeigen“ und „Design nachladen“ je zu **einer** Automation (Trigger-IDs, `for_each`) | 4 → 2 Automationen |
| K-02 | Klima-Menüs: zwei Schließ-Automationen zu einer (`trigger.entity_id`) | 2 → 1 |
| K-04 / T-11 | Wetter: ein stündlicher Abruf füllt 12-h-Tief/Hoch **und** UV-Vorschau; `uv_vorschau_aktualisieren` gelöscht | 1 statt 2 Abrufe/Stunde, Werte geprüft |
| T-12 / F-10 | Kohlegrill „Kohlen bereit“: Hue-Effekt „Atmen“ (`flash: long`) alle 15 s statt Dimm-Schleife | ≈ 80 statt bis zu 1.700 Lichtbefehle |
| T-07 | Timer-Trigger zweckgebunden (`timer.finished` mit `target`): Kohlegrill, Klima-Tipp, Stoßlüften | – |
| T-09 | Lüften erkennen (Gartenhaus, Schlafzimmer): Zustands-Trigger + Bedingungen statt Template mit `now()` | keine minütliche Auswertung mehr, gleiches Verhalten |
| T-06 | Hue-Wandschalter „Alles aus“: `event.received` mit `long_press` statt Zustands-Trigger + Template | – |
| A-13 / F-07 | KI-Heizung: Strategien Intervall/Wärmepuffer entfernt (Steuerung + Nachtanalyse), `input_number.ki_pufferziel` gelöscht | Wissen gesichert in `docs/ki_heizung_wissen.md` |
| F-06 | Nachtanalyse: KI-Texte max. 120 Zeichen, ein klarer Satz | – |
| T-02 | Mercedes-Template-Helfer: `none` statt Text `'unknown'` | Werte geprüft |
| A-05 / U-06 | AliExpress-Ressource entfernt | – |
| A-10 … A-12 | gelöscht: `script.kamera_snooze_wahlen`, 2 Klingel-Spannungssensoren, `input_select.nest_gartenhaus_ansicht` | – |
| – | Nest Schlafzimmer: Wecker-Karte zeigt „Weckzeit wird geladen …“ statt Fehler | – |
| F-11 | Dyson: Verbindung „Cloud mit lokalem Fallback“ (lokal war aus dem IoT-VLAN nie erreichbar) | kein 10-s-Timeout beim Start; Werte kommen |
| F-05 | Drucker behalten. Neue Sensoren `sensor.drucker_toner_{schwarz,cyan,magenta,gelb}` (letzter bekannter Wert) und `sensor.drucker_status` („Aus“ statt „nicht verfügbar“); Dashboard-Kachel umgestellt | siehe Hinweis unten |
| F-02 | Wecker-Ersatzansage: Google-Übersetzer-TTS statt Nabu-Casa-Cloud | läuft ohne Abo |
| R-02 (Teil, ohne YAML) | Gedrosselte Kopien als UI-Filter-Helfer (`time_throttle`, 5 min): `sensor.wan_download_gesamt_5_min`, `sensor.wan_upload_gesamt_5_min`. Verbrauchszähler „WAN Download/Upload Monat“ auf diese Quelle umgestellt | Monatszähler: ≈ 290 statt ≈ 43.000 Zeilen/Tag je Zähler; Übergang geprüft (Zähler +709,8 Mbit = Differenz der Summen, nichts verloren) |
| R-08 (Teil) | `recorder.purge_entities` für die abgeschalteten Dream-Machine-Sensoren CPU und Speicher | Verlauf von ≈ 14 Tagen × 89.000 Zeilen gelöscht; Langzeitstatistik bleibt |
| U-04 / F-14 | ApexCharts gestaffelt: 7–8 Tage → 30 min, 30–31 Tage → 1 h, 365 Tage → 6 h; 24-h-Diagramme unverändert (5 min bzw. 1 min) | 36 von 50 Diagrammen fragen seltener ab; Optik unverändert |

### Bewusst so gelassen / Hinweise

- **UniFi seltener aktualisieren:** geht nicht. Die Integration bekommt die Daten per Websocket-Push von der Dream Machine,
  es gibt kein Abfrageintervall. Die Last wird stattdessen gesenkt durch: Entitäten deaktivieren (erledigt),
  Client-Tracking aus (erledigt), Recorder-Excludes + gedrosselte WAN-Kopie alle 5 min (R-01/R-02, braucht YAML).
- **T-07 KI-Steuerung:** nutzt noch die alte Ereignis-Form `timer.finished`/`timer.cancelled`. Funktioniert weiter;
  wird beim nächsten Umbau der (sehr großen) Automation mit umgestellt.
- **Drucker:** Die UI-Template-Sensoren behalten den letzten Wert, solange HA läuft. Nach einem HA-Neustart sind sie
  bis zum nächsten Einschalten des Druckers leer. Mit YAML-Zugriff werden sie zu Trigger-Template-Sensoren
  (stellen ihren Wert nach Neustart wieder her). **Fernstart:** Die IPP-Schnittstelle kann den Drucker nicht einschalten.
  Möglich ist das nur mit einem schaltbaren Zwischenstecker (z. B. Zigbee-Steckdose) **und** wenn der Drucker nach
  Stromzufuhr selbst startet (Canon: Einstellung „Automatisch einschalten“ prüfen); Wake-on-LAN weckt ihn nur aus dem
  Ruhezustand, nicht aus „aus“.
- **ZHA (F-08):** bleibt. Alternativen, falls gewünscht: (a) netzwerkfähiger Koordinator (Ethernet, z. B. SLZB-06) im
  Gartenhaus für Zigbee2MQTT, dann ein Netz über LAN statt zweiter USB-Stick; (b) Zigbee-Router als Brücke zwischen
  den Gebäuden, falls die Entfernung das hergibt. Eine zweite Z2M-Instanz bringt gegenüber ZHA keinen Vorteil.
- **Eufy (F-04):** Integration bleibt entfernt/deaktiviert, die Kamera-Timer und Dashboard-Blöcke bleiben vorerst stehen
  (A-01 … A-03 zurückgestellt). Empfehlung für den Wiedereinstieg: `eufy_security` + Add-on `eufy-security-ws`,
  **ohne** Dauer-Stream und ohne periodische Snapshots; Bilder nur bei Ereignis (Bewegung/Klingel), Livebild nur auf Tipp.
  Das ist der akkuschonende Betrieb.
- **Cloud-Ersatz (F-02):** Google Assistant läuft über Nabu Casa. Ersatz ohne Abo: manuelle `google_assistant`-Einrichtung
  (Google-Cloud-Projekt + Actions-Projekt, braucht von außen erreichbare HTTPS-Adresse) oder Sprachsteuerung über
  Assist auf dem Handy. Fernzugriff bleibt über Tailscale möglich.

### Noch offen

| Phase | Was | braucht |
|---|---|---|
| 2 | Recorder-Block (Anhang B) mit Ausschluss von `port_9_rx/tx` und `wan_*_gesamt` (≈ 224.000 Zeilen/Tag), `ip_ban` (F-12), danach Purge + Repack | YAML-Zugriff (die YAML-/Datei-Werkzeuge kommen trotz Freigabe noch nicht beim Client an) |
| 5 | Pakete (`packages/`), Regenvorschau modernisieren, Verleih bündeln, Labels | YAML-Zugriff |
| 6 | Ressourcen/Bilder nach `/config/www/gg/`, `gg_diag` entfernen (F-14, Pop-ups bleiben) | Dateizugriff |

**Damit es weitergeht – zwei Schritte in der HA-Oberfläche:**

1. *Einstellungen → Geräte & Dienste → Integration hinzufügen →* „HA-MCP Custom Component“ → Eintrag
   „HA-MCP File & YAML Tools“ anlegen.
2. In der Web-Oberfläche der MCP-App unter *Server Settings* „Enable beta features“ sowie die Schalter für
   YAML- und Dateisystem-Zugriff einschalten, App neu starten.

Danach lese ich `configuration.yaml` und setze Phase 2 (Recorder) um.

---

_Ursprünglicher Abschluss des Dry-Run-Berichts:_ **Nächster Schritt:** Ich warte auf dein „Go“. Am einfachsten je Phase (z. B. „Go Phase 1“) oder je ID
(z. B. „Go R-01, P-01, T-02“), dazu die Antworten auf F-01 bis F-14, soweit sie die freigegebenen Schritte betreffen.
