/* gg-mehr v2 (29.10.2026: Pakete zeigen Status, Fortschritt, Verlauf und Zustellfenster direkt in der Karte, Fahrerkarte sobald liveTracking Koordinaten liefert, Hermes automatisch) – Karten custom:gg-automationen (alle Automationen mit Schalter + Kurzbeschreibung) und custom:gg-pakete
   (Sendungen aus Parcel Aggregator, „+“ mit Carrier-Erkennung). Zusatz: gg-batterien zeigt live Zustand und Batterietyp (Sensoren). */
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BASIS = `:host{display:block;font-family:var(--gg-schrift,-apple-system,Inter,sans-serif);--tr:var(--gg-trenner,rgba(84,84,88,.65))}
  .gruppe{background:var(--gg-zelle,rgba(255,255,255,.07));box-shadow:var(--gg-zellschatten,none);border-radius:26px;overflow:hidden}
  .gruppe+.gruppe,.titel+.gruppe{margin-top:6px}.titel+.gruppe{margin-top:6px}
  .titel{margin:18px 16px 0;font-size:13px;font-weight:600;letter-spacing:.2px;text-transform:uppercase;color:var(--gg-wert,rgba(235,235,245,.6))}
  .titel:first-child{margin-top:2px}
  .zeile{box-sizing:border-box;width:100%;display:grid;align-items:center;column-gap:12px;min-height:60px;padding:9px 16px;position:relative;color:var(--gg-t1,#fff)}
  .zeile+.zeile::before{content:'';position:absolute;top:0;left:62px;right:0;height:.5px;background:var(--tr)}
  .ic{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;line-height:0;--mdc-icon-size:20px;color:#fff;background:var(--k,var(--gg-c-blau,#0A84FF))}
  .tx{min-width:0}.tx b{display:block;font-size:15px;font-weight:600;line-height:19px;letter-spacing:-.2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tx small{display:block;font-size:12.5px;line-height:16px;margin-top:1px;color:var(--gg-wert,rgba(235,235,245,.6));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  button{all:unset;cursor:pointer;-webkit-tap-highlight-color:transparent}button:focus-visible{outline:2px solid var(--gg-c-blau,#0A84FF);outline-offset:2px}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

  /* ---------- Automationen ---------- */
  const AUT = {
    'batterie_fast_leer_push': ['Sicherheit', 'mdi:battery-alert-variant-outline', 'rot', 'Schickt eine Mitteilung, sobald eine Batterie die Warnschwelle erreicht.'],
    'co2_warnung': ['Sicherheit', 'mdi:molecule-co2', 'rot', 'Warnt bei zu hohem CO₂-Wert in der Raumluft.'],
    'frostwarnung': ['Sicherheit', 'mdi:snowflake-alert', 'blau', 'Meldet Frostgefahr für Außenbereiche.'],
    'warnung_niedrige_temperatur_im_gartenhaus': ['Sicherheit', 'mdi:thermometer-low', 'blau', 'Warnt, wenn es im Gartenhaus zu kalt wird.'],
    'regen_bei_offenem_fenster_melden': ['Sicherheit', 'mdi:weather-rainy', 'blau', 'Meldet Regen, solange ein Fenster offen ist.'],
    'kohlegrill_kohlen_bereit': ['Kohlegrill', 'mdi:grill', 'orange', 'Meldet, wenn die Kohlen durchgeglüht und bereit sind.'],
    'kohlegrill_sicherheits_wachter_hochstdauer': ['Kohlegrill', 'mdi:shield-timer-outline', 'orange', 'Überwacht die maximale Laufzeit des Grills.'],
    'kohlegrill_sicherheitsabschaltung': ['Kohlegrill', 'mdi:power-plug-off-outline', 'orange', 'Schaltet den Grill-Strom bei Ablauf oder Störung ab.'],
    'gartenhaus_abendfrage_vorheizen_iphone': ['Klima & Gartenhaus', 'mdi:radiator', 'orange', 'Fragt abends per iPhone, ob das Gartenhaus vorgeheizt werden soll.'],
    'gartenhaus_antwort_auf_abendfrage_verarbeiten': ['Klima & Gartenhaus', 'mdi:message-reply-text-outline', 'orange', 'Setzt deine Antwort auf die Abendfrage um.'],
    'gartenhaus_ki_heizung_steuerung': ['Klima & Gartenhaus', 'mdi:brain', 'orange', 'Steuert die Heizung des Gartenhauses nach den gelernten Werten.'],
    'gartenhaus_ki_lernt_halbstundlich': ['Klima & Gartenhaus', 'mdi:school-outline', 'orange', 'Wertet alle 30 Minuten Raum und Wetter für die KI-Heizung aus.'],
    'gartenhaus_warm_chill_beim_betreten_nach_sonnenuntergang': ['Klima & Gartenhaus', 'mdi:lightbulb-night-outline', 'orange', 'Schaltet beim Betreten nach Sonnenuntergang warmes Licht ein.'],
    'ki_heizung_nachtanalyse_starten': ['Klima & Gartenhaus', 'mdi:chart-timeline-variant', 'orange', 'Startet nachts die Analyse für die KI-Heizung.'],
    'klima_aussentemperatur_der_nachsten_12_stunden': ['Klima & Gartenhaus', 'mdi:thermometer-lines', 'tuerkis', 'Berechnet die Außentemperatur der nächsten 12 Stunden.'],
    'klima_energie_tarif_nach_betriebsart': ['Klima & Gartenhaus', 'mdi:currency-eur', 'tuerkis', 'Wählt den Stromtarif für die Kostenrechnung je Betriebsart.'],
    'klima_gartenhaus_runde_menus_automatisch_schliessen': ['Klima & Gartenhaus', 'mdi:close-circle-outline', 'tuerkis', 'Schließt die runden Menüs am Nest-Display automatisch.'],
    'klima_modus_menu_automatisch_schliessen': ['Klima & Gartenhaus', 'mdi:close-circle-outline', 'tuerkis', 'Schließt das Modus-Menü der Klimaanlage nach kurzer Zeit.'],
    'klima_pflege_erinnerung_aufs_iphone': ['Klima & Gartenhaus', 'mdi:air-filter', 'tuerkis', 'Erinnert per iPhone an die fällige Klima-Pflege.'],
    'klima_pflege_erledigt_aus_der_mitteilung': ['Klima & Gartenhaus', 'mdi:check-circle-outline', 'tuerkis', 'Trägt „Erledigt“ aus der Mitteilung als Pflege ein.'],
    'klima_prognose_wetter_schnappschuss_um_mitternacht': ['Klima & Gartenhaus', 'mdi:weather-night', 'tuerkis', 'Sichert um Mitternacht das Wetter für die Kostenprognose.'],
    'klima_raumfuhler_regelung_gartenhaus': ['Klima & Gartenhaus', 'mdi:thermostat', 'tuerkis', 'Regelt die Klimaanlage nach dem Raumfühler statt dem Gerätefühler.'],
    'klima_sollwert_von_hand_wunschtemperatur_raum': ['Klima & Gartenhaus', 'mdi:gesture-tap', 'tuerkis', 'Übernimmt eine Handeinstellung als Wunschtemperatur.'],
    'klima_tipp_aus_push_nachricht_anwenden': ['Klima & Gartenhaus', 'mdi:lightbulb-on-outline', 'tuerkis', 'Wendet die Antwort auf einen Klima-Tipp an.'],
    'klima_tipp_nach_ablauf_ausschalten': ['Klima & Gartenhaus', 'mdi:timer-off-outline', 'tuerkis', 'Schaltet die Klimaanlage nach Ablauf eines Tipps aus.'],
    'klima_tipp_wichtige_empfehlung_aufs_iphone': ['Klima & Gartenhaus', 'mdi:bell-ring-outline', 'tuerkis', 'Schickt wichtige Klima-Empfehlungen aufs iPhone.'],
    'klimaanlage_strommesser_automatisch_einschalten': ['Klima & Gartenhaus', 'mdi:flash-outline', 'tuerkis', 'Schaltet den Strommesser der Klimaanlage bei Bedarf ein.'],
    'lichtfest_steuern': ['Licht & Szenen', 'mdi:led-strip-variant', 'gelb', 'Steuert das Lichtfest-Programm.'],
    'hue_wall_switch_taste_2_long_press': ['Licht & Szenen', 'mdi:light-switch', 'gelb', 'Langer Druck auf Taste 2: Licht und TV ausschalten.'],
    'luften_automatisch_erkennen_gartenhaus': ['Lüften', 'mdi:window-open-variant', 'hellblau', 'Erkennt Lüften im Gartenhaus aus dem Temperaturverlauf.'],
    'luften_automatisch_erkennen_schlafzimmer': ['Lüften', 'mdi:window-open-variant', 'hellblau', 'Erkennt Lüften im Schlafzimmer aus dem Temperaturverlauf.'],
    'stossluften_uberwachen_und_melden': ['Lüften', 'mdi:timer-sand', 'hellblau', 'Überwacht Stoßlüften und meldet, wenn es zu lange dauert.'],
    'mercedes_burotag_erkennen': ['Mercedes', 'mdi:domain', 'hellblau', 'Erkennt Fahrten ins Büro (3 Minuten bei „Arbeit“).'],
    'mercedes_fahrten_auswerten_buroweg_und_privatkilometer': ['Mercedes', 'mdi:map-marker-path', 'hellblau', 'Lernt Büroweg und Privatkilometer aus dem Kilometerstand.'],
    'mercedes_fernbefehle_uberwachen': ['Mercedes', 'mdi:remote', 'hellblau', 'Überwacht Fernbefehle ans Auto.'],
    'mercedes_messung_fahrleistung_und_verbrauch': ['Mercedes', 'mdi:speedometer', 'hellblau', 'Misst Fahrleistung und Verbrauch.'],
    'mercedes_schutz_beim_entriegeln': ['Mercedes', 'mdi:car-key', 'hellblau', 'Schützt beim Entriegeln vor ungewollten Befehlen.'],
    'mercedes_tank_wird_knapp_push_mit_tank_zeitpunkt': ['Mercedes', 'mdi:gas-station-outline', 'hellblau', 'Meldet knappen Tank samt Tank-Zeitpunkt.'],
    'mercedes_warnung_melden_push': ['Mercedes', 'mdi:alert-outline', 'hellblau', 'Meldet Fahrzeugwarnungen per Mitteilung.'],
    'mercedes_woche_abschliessen_privatkilometer_durchschnitt': ['Mercedes', 'mdi:calendar-check-outline', 'hellblau', 'Rechnet montags den Privatkilometer-Durchschnitt fort.'],
    'nest_hub_gartenhaus_dashboard_anzeigen': ['Nest-Displays', 'mdi:google-nest', 'lila', 'Zeigt das Dashboard auf dem Nest Hub im Gartenhaus.'],
    'nest_hub_gartenhaus_design_nach_start_nachladen': ['Nest-Displays', 'mdi:refresh', 'lila', 'Lädt das Design nach dem Start des Gartenhaus-Hubs neu.'],
    'nest_hub_schlafzimmer_dashboard_anzeigen': ['Nest-Displays', 'mdi:google-nest', 'lila', 'Zeigt das Dashboard auf dem Nest Hub im Schlafzimmer.'],
    'nest_hub_schlafzimmer_design_nach_start_nachladen': ['Nest-Displays', 'mdi:refresh', 'lila', 'Lädt das Design nach dem Start des Schlafzimmer-Hubs neu.'],
    'the_frame_gartenhaus_einschalten_per_wake_on_lan': ['Nest-Displays', 'mdi:television-ambient-light', 'lila', 'Schaltet The Frame per Wake-on-LAN ein.'],
    'wecker_schlafzimmer_geanderte_weckzeit_ubernehmen': ['Wecker', 'mdi:alarm', 'pink', 'Übernimmt eine geänderte Weckzeit.'],
    'wecker_schlafzimmer_klingeln': ['Wecker', 'mdi:alarm-note', 'pink', 'Lässt den Wecker im Schlafzimmer zur Weckzeit klingeln.'],
    'updates_nachts_morgen_mitteilung': ['System', 'mdi:update', 'lila', 'Meldet morgens, was nachts aktualisiert wurde.'],
    'updates_nachts_nach_dem_backup_starten': ['System', 'mdi:backup-restore', 'lila', 'Startet die Updates nach dem nächtlichen Backup.'],
    'updates_nachts_nach_neustart_fortsetzen': ['System', 'mdi:restart', 'lila', 'Setzt Updates nach einem Neustart fort.'],
    'uv_vorschau_aktualisieren': ['System', 'mdi:weather-sunny-alert', 'gelb', 'Aktualisiert die UV-Vorschau.'],
    'verleih_datum_auf_heute': ['System', 'mdi:hand-coin-outline', 'pink', 'Setzt das Verleih-Datum auf heute.'],
  };
  const FARBEN = { rot: '#FF453A', orange: '#FF9F0A', gelb: '#FFD60A', gruen: '#30D158', tuerkis: '#40C8E0', hellblau: '#64D2FF', blau: '#0A84FF', lila: '#BF5AF2', pink: '#FF375F', grau: '#8E8E93' };
  const farbe = (n) => `var(--gg-c-${n}, ${FARBEN[n] || '#0A84FF'})`;
  const RANG = ['Sicherheit', 'Klima & Gartenhaus', 'Kohlegrill', 'Licht & Szenen', 'Lüften', 'Mercedes', 'Nest-Displays', 'Wecker', 'System', 'Weitere'];

  class GgAutomationen extends HTMLElement {
    setConfig(c) { this._c = c || {}; if (!this.shadowRoot) this.attachShadow({ mode: 'open' }); this._sig = ''; }
    getCardSize() { return 12; }
    set hass(h) {
      this._h = h;
      const l = Object.values(h.states).filter((s) => s.entity_id.startsWith('automation.'))
        .map((s) => s.entity_id + (s.state === 'on' ? '1' : '0') + (s.attributes.friendly_name || ''));
      const sig = l.join('|');
      if (sig === this._sig) return; this._sig = sig; this._zeichnen();
    }
    _zeichnen() {
      const h = this._h;
      const all = Object.values(h.states).filter((s) => s.entity_id.startsWith('automation.')).map((s) => {
        const k = s.entity_id.slice(11), m = AUT[k];
        return { id: s.entity_id, on: s.state === 'on', name: s.attributes.friendly_name || k, gruppe: m ? m[0] : 'Weitere', icon: m ? m[1] : 'mdi:robot-outline', farbe: m ? m[2] : 'grau', info: m ? m[3] : '' };
      });
      const g = {}; all.forEach((a) => (g[a.gruppe] = g[a.gruppe] || []).push(a));
      const an = all.filter((a) => a.on).length;
      const teile = RANG.filter((r) => g[r]).map((r) => `<div class="titel">${esc(r)}</div><div class="gruppe">${
        g[r].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((a) => `<div class="zeile" style="grid-template-columns:34px minmax(0,1fr) auto;--k:${farbe(a.farbe)}">
          <button class="ic" data-i="${esc(a.id)}" aria-label="Details ${esc(a.name)}"><ha-icon icon="${a.icon}"></ha-icon></button>
          <span class="tx"><b>${esc(a.name)}</b><small>${esc(a.info) || '&nbsp;'}</small></span>
          <button class="sw${a.on ? ' an' : ''}" role="switch" aria-checked="${a.on}" aria-label="${esc(a.name)}" data-t="${esc(a.id)}"><i></i></button></div>`).join('')}</div>`).join('');
      this.shadowRoot.innerHTML = `<style>${BASIS}
        .kopf{padding:4px 16px 0;font-size:15px;color:var(--gg-wert,rgba(235,235,245,.6))}
        .ic{cursor:pointer}
        .sw{width:51px;height:31px;border-radius:16px;background:var(--gg-f16,rgba(120,120,128,.36));position:relative;transition:background .2s}
        .sw i{position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.25);transition:transform .2s}
        .sw.an{background:var(--gg-c-gruen,#30D158)}.sw.an i{transform:translateX(20px)}</style>
        <div class="kopf">${all.length} Automationen · ${an} aktiv</div>${teile}`;
      this.shadowRoot.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => h.callService('automation', 'toggle', { entity_id: b.dataset.t })));
      this.shadowRoot.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: b.dataset.i }, bubbles: true, composed: true }))));
    }
  }

  /* ---------- Pakete ---------- */
  const TRAEGER = {
    DHL: { name: 'DHL', farbe: 'gelb', url: (n) => `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${n}`, re: [/^00\d{18}$/, /^JJD\d{12,}$/i, /^JVGL\d+$/i, /^[A-Z]{2}\d{9}DE$/i, /^\d{12}$/] },
    DPD: { name: 'DPD', farbe: 'rot', url: (n) => `https://tracking.dpd.de/parcelstatus?query=${n}`, re: [/^0?\d{14}$/, /^\d{28}$/] },
    UPS: { name: 'UPS', farbe: 'orange', url: (n) => `https://www.ups.com/track?tracknum=${n}`, re: [/^1Z[0-9A-Z]{16}$/i] },
    GLS: { name: 'GLS', farbe: 'blau', url: (n) => `https://gls-group.com/DE/de/paketverfolgung?match=${n}`, re: [/^\d{11,12}$/, /^[A-Z0-9]{8}$/] },
    Hermes: { name: 'Hermes', farbe: 'tuerkis', url: (n) => `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation/#${n}`, re: [/^\d{14}$/, /^(?!00)\d{20}$/, /^H\d{18,}$/i] },
  };
  const erkenne = (t) => { const n = t.replace(/[\s-]/g, ''); return n.length < 8 ? [] : Object.keys(TRAEGER).filter((k) => TRAEGER[k].re.some((r) => r.test(n))); };
  const STATUS = { registered: 'Angekündigt', in_transit: 'Unterwegs', out_for_delivery: 'In Zustellung', delivered: 'Zugestellt', ready_for_pickup: 'Abholbereit', exception: 'Problem' };

  class GgPakete extends HTMLElement {
    setConfig(c) {
      this._c = { dhl_entry: '01M60YMBM58CFRXVSXS5P3631V', plz: '45665', ...c };
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' }); this._sig = ''; this._dlg = null; this._offen = this._offen || new Set();
    }
    getCardSize() { return 6; }
    set hass(h) {
      this._h = h;
      const s = ['incoming_parcels', 'awaiting_pickup', 'delivered_parcels', 'en_route_to_pickup_point'].map((k) => h.states['sensor.parcel_aggregator_' + k]);
      const sig = JSON.stringify(s.map((x) => x && [x.state, x.attributes.parcels]));
      if (sig === this._sig) return; this._sig = sig; if (!this._dlg) this._zeichnen();
    }
    _liste(k) { return this._h.states['sensor.parcel_aggregator_' + k]?.attributes?.parcels || []; }
    _verlauf(p) {
      const sv = p.raw?.sendungsdetails?.sendungsverlauf;
      let ev = (sv?.events || []).map((e) => ({ t: e.datum, s: e.status, o: e.ort }));
      if (!ev.length && Array.isArray(p.history)) ev = p.history.map((e) => ({ t: e.time || e.datum || e.timestamp, s: e.status || e.description || e.text || e.raw_status || '', o: e.location || e.ort || '' }));
      ev = ev.filter((e) => e.s).sort((x, y) => String(y.t).localeCompare(String(x.t)));
      return { sv, ev };
    }
    _pos(p) {
      const lt = p.raw?.sendungsdetails?.liveTracking; if (!lt || typeof lt !== 'object') return null;
      let la = null, lo = null;
      const lauf = (o, d) => { if (!o || typeof o !== 'object' || d > 4) return; for (const [k, v] of Object.entries(o)) {
        const n = typeof v === 'string' ? parseFloat(v) : v;
        if (typeof n === 'number' && isFinite(n)) { if (/^(lat|latitude|breite)$/i.test(k)) la = n; else if (/^(lon|lng|long|longitude|laenge|länge)$/i.test(k)) lo = n; }
        else if (v && typeof v === 'object') lauf(v, d + 1); } };
      lauf(lt, 0);
      return la !== null && lo !== null && Math.abs(la) <= 90 && Math.abs(lo) <= 180 ? { la, lo } : null;
    }
    _fmt(t) { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    _detail(p) {
      const t = TRAEGER[p.carrier] || { farbe: 'grau', name: p.carrier }, { sv, ev } = this._verlauf(p), pos = this._pos(p);
      const st = sv?.status || p.raw_status || STATUS[p.status] || '';
      const zeit = p.planned_from ? `${this._fmt(p.planned_from)}${p.planned_to ? ' – ' + new Date(p.planned_to).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}` : '';
      const fort = sv && sv.maximalFortschritt ? `<div class="bar" aria-label="Fortschritt ${sv.fortschritt} von ${sv.maximalFortschritt}">${Array.from({ length: sv.maximalFortschritt }, (_, i) => `<i class="${i < sv.fortschritt ? 'f' : ''}"></i>`).join('')}</div>` : '';
      let karte = '';
      if (pos) {
        const d = 0.012, src = `https://www.openstreetmap.org/export/embed.html?bbox=${pos.lo - d},${pos.la - d / 1.6},${pos.lo + d},${pos.la + d / 1.6}&layer=mapnik&marker=${pos.la},${pos.lo}`;
        karte = `<div class="kt"><iframe loading="lazy" title="Live-Standort des Fahrers" src="${src}"></iframe><small>Live-Standort des Zustellers · aktualisiert sich mit DHL</small></div>`;
      } else if (p.carrier === 'DHL' && p.status === 'out_for_delivery') {
        karte = `<a class="lnk" href="https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(p.barcode)}&plz=${this._c.plz}" target="_blank" rel="noopener"><ha-icon icon="mdi:map-marker-radius"></ha-icon>Zusteller live bei DHL ansehen</a><small class="hn">Der Standort des Fahrers liegt (noch) nicht in Home Assistant vor. Erscheint er, wird hier automatisch die Karte gezeigt.</small>`;
      }
      return `<div class="dt" style="--k:${farbe(t.farbe)}"><div class="stt">${esc(st)}</div>${fort}${zeit ? `<div class="fe"><ha-icon icon="mdi:clock-outline"></ha-icon>Zustellfenster: ${esc(zeit)}</div>` : ''}${karte}
        ${ev.length ? `<div class="tl">${ev.map((e) => `<div class="ev"><b>${esc(e.s)}</b><small>${esc([this._fmt(e.t), e.o].filter(Boolean).join(' · '))}</small></div>`).join('')}</div>` : ''}
        ${p.url ? `<a class="lnk g" href="${esc(p.url)}" target="_blank" rel="noopener"><ha-icon icon="mdi:open-in-new"></ha-icon>Beim Anbieter öffnen</a>` : ''}</div>`;
    }
    _zeile(p) {
      const t = TRAEGER[p.carrier] || { farbe: 'grau' }, id = p.carrier + p.barcode, auf = this._offen.has(id);
      const st = p.raw?.sendungsdetails?.sendungsverlauf?.status || p.raw_status || STATUS[p.status] || p.status || '';
      const f = p.planned_from ? new Date(p.planned_from).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
      const sub = [p.sender, st].filter(Boolean).join(' · ');
      return `<button class="zeile r" data-id="${esc(id)}" aria-expanded="${auf}" style="grid-template-columns:34px minmax(0,1fr) auto;--k:${farbe(t.farbe)}">
        <span class="ic"><ha-icon icon="${p.delivered ? 'mdi:package-variant-closed-check' : p.pickup ? 'mdi:store-marker-outline' : 'mdi:package-variant-closed'}"></ha-icon></span>
        <span class="tx"><b>${esc(p.carrier)} · ${esc(p.barcode)}</b><small>${esc(sub)}</small></span>
        <span class="re">${esc(f)}</span></button>${auf ? this._detail(p) : ''}`;
    }
    _zeichnen() {
      this._offen = this._offen || new Set();
      const grp = [['Unterwegs', this._liste('incoming_parcels').concat(this._liste('en_route_to_pickup_point'))], ['Abholbereit', this._liste('awaiting_pickup')], ['Zugestellt', this._liste('delivered_parcels')]];
      const gs = new Set(); grp.forEach((g) => { g[1] = g[1].filter((p) => { const k = p.carrier + p.barcode; if (gs.has(k)) return false; gs.add(k); return true; }); });
      const alle = grp.flatMap((g) => g[1]);
      if (!this._init && alle.length) { this._init = true; alle.forEach((p) => { if (p.status === 'out_for_delivery') this._offen.add(p.carrier + p.barcode); }); if (alle.length === 1) this._offen.add(alle[0].carrier + alle[0].barcode); }
      const n = alle.length;
      const body = grp.filter((g) => g[1].length).map((g) => `<div class="titel">${g[0]}</div><div class="gruppe">${g[1].map((p) => this._zeile(p)).join('')}</div>`).join('')
        || `<div class="gruppe"><div class="zeile" style="grid-template-columns:1fr;min-height:70px"><span class="tx"><b>Keine Sendungen</b><small>DHL und Hermes erscheinen automatisch aus den verbundenen Konten. Andere mit „+“ hinzufügen.</small></span></div></div>`;
      this.shadowRoot.innerHTML = `<style>${BASIS}
        .kopf{display:flex;align-items:center;justify-content:space-between;padding:2px 16px 0}.kopf span{font-size:15px;color:var(--gg-wert,rgba(235,235,245,.6))}
        .plus{width:36px;height:36px;border-radius:50%;background:var(--gg-c-blau,#0A84FF);color:#fff;display:flex;align-items:center;justify-content:center;--mdc-icon-size:22px;line-height:0}
        .r{text-align:left}.r:active{background:var(--gg-f07,rgba(255,255,255,.07))}.re{font-size:13px;color:var(--gg-wert,rgba(235,235,245,.6))}
        .zeile .ic{background:var(--k)}
        .dt{padding:4px 16px 14px 62px;display:flex;flex-direction:column;gap:10px}
        .stt{font-size:17px;font-weight:700;color:var(--gg-t1,#fff)}
        .bar{display:flex;gap:4px}.bar i{flex:1;height:6px;border-radius:3px;background:var(--gg-f16,rgba(120,120,128,.36))}.bar i.f{background:var(--k)}
        .fe{display:flex;align-items:center;gap:6px;font-size:14px;color:var(--gg-l80,rgba(235,235,245,.8));--mdc-icon-size:18px}
        .kt iframe{width:100%;height:220px;border:0;border-radius:16px;display:block}.kt small,.hn{display:block;margin-top:6px;font-size:12px;color:var(--gg-wert,rgba(235,235,245,.6))}
        .tl{display:flex;flex-direction:column;gap:10px;border-left:2px solid var(--gg-f16,rgba(120,120,128,.36));padding-left:12px}
        .ev b{display:block;font-size:14px;font-weight:600;color:var(--gg-t1,#fff)}.ev small{font-size:12px;color:var(--gg-wert,rgba(235,235,245,.6))}
        .lnk{display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:14px;background:var(--gg-c-blau,#0A84FF);color:#fff;font-size:15px;font-weight:600;text-decoration:none;--mdc-icon-size:20px}
        .lnk.g{background:var(--gg-f10,rgba(120,120,128,.24));color:var(--gg-c-blau,#0A84FF)}</style>
        <div class="kopf"><span>${n} Sendungen</span><button class="plus" aria-label="Sendung hinzufügen"><ha-icon icon="mdi:plus"></ha-icon></button></div>${body}`;
      this.shadowRoot.querySelector('.plus').addEventListener('click', () => this._dialog());
      this.shadowRoot.querySelectorAll('.r').forEach((b) => b.addEventListener('click', () => { const i = b.dataset.id; this._offen.has(i) ? this._offen.delete(i) : this._offen.add(i); this._zeichnen(); }));
    }
    _dialog() {
      this._dlg = { nr: '', traeger: '', hand: false, msg: '' };
      const o = document.createElement('div'); this._ov = o;
      o.attachShadow({ mode: 'open' });
      o.style.cssText = 'position:fixed;inset:0;z-index:2147483000';
      document.body.appendChild(o);
      this._dlgDraw();
    }
    _zu() { this._ov?.remove(); this._ov = null; this._dlg = null; this._zeichnen(); }
    _dlgDraw() {
      const d = this._dlg, sr = this._ov.shadowRoot, kand = erkenne(d.nr);
      if (!d.hand) d.traeger = kand.length === 1 ? kand[0] : '';
      const hint = !d.nr.trim() ? 'Sendungsnummer eingeben oder einfügen.' : d.hand && d.traeger ? 'Anbieter von Hand gewählt.'
        : kand.length === 1 ? `Erkannt: ${kand[0]}` : kand.length > 1 ? `Mehrere möglich (${kand.join(', ')}) – bitte Anbieter wählen.` : 'Nicht erkannt – bitte Anbieter wählen.';
      const aktiv = d.nr.replace(/\s/g, '').length >= 8 && d.traeger;
      const fokus = sr.activeElement?.tagName === 'INPUT';
      sr.innerHTML = `<style>${BASIS}
        .bg{position:absolute;inset:0;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
        .box{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 32px));box-sizing:border-box;padding:20px;border-radius:26px;background:var(--gg-menu,rgba(44,44,46,.97));color:var(--gg-t1,#fff);box-shadow:0 20px 60px rgba(0,0,0,.5)}
        h3{margin:0 0 12px;font-size:20px;font-weight:700}
        input{box-sizing:border-box;width:100%;height:46px;border-radius:12px;border:none;padding:0 14px;font:inherit;font-size:16px;background:var(--gg-f10,rgba(120,120,128,.24));color:inherit;outline:none}
        input:focus{box-shadow:0 0 0 2px var(--gg-c-blau,#0A84FF)}
        .hint{margin:8px 2px 12px;font-size:13px;color:var(--gg-wert,rgba(235,235,245,.6));min-height:17px}
        .ch{display:flex;flex-wrap:wrap;gap:8px}.ch button{padding:9px 16px;border-radius:999px;font-size:15px;font-weight:600;background:var(--gg-f10,rgba(120,120,128,.24))}
        .ch button.a{background:var(--gg-c-blau,#0A84FF);color:#fff}
        .akt{display:flex;gap:10px;margin-top:18px}.akt button{flex:1;text-align:center;height:46px;line-height:46px;border-radius:14px;font-size:16px;font-weight:600;background:var(--gg-f10,rgba(120,120,128,.24))}
        .akt .ok{background:var(--gg-c-blau,#0A84FF);color:#fff}.akt .ok[disabled]{opacity:.4;pointer-events:none}
        .msg{margin-top:12px;font-size:13px;color:var(--gg-c-orange,#FF9F0A)}</style>
        <div class="bg"></div><div class="box" role="dialog" aria-modal="true" aria-label="Sendung hinzufügen"><h3>Sendung hinzufügen</h3>
        <input inputmode="text" autocapitalize="characters" autocomplete="off" placeholder="Sendungsnummer" value="${esc(d.nr)}">
        <div class="hint">${esc(hint)}</div>
        <div class="ch">${Object.keys(TRAEGER).filter((k) => k !== 'Hermes').map((k) => `<button data-k="${k}" class="${d.traeger === k ? 'a' : ''}">${k}</button>`).join('')}</div>
        ${d.msg ? `<div class="msg">${esc(d.msg)}</div>` : ''}
        <div class="akt"><button class="ab">Abbrechen</button><button class="ok" ${aktiv ? '' : 'disabled'}>Hinzufügen</button></div></div>`;
      const inp = sr.querySelector('input');
      inp.addEventListener('input', () => { d.nr = inp.value; d.msg = ''; this._dlgDraw(); });
      if (fokus || !d.nr) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      sr.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { d.traeger = b.dataset.k; d.hand = true; this._dlgDraw(); }));
      sr.querySelector('.bg').addEventListener('click', () => this._zu());
      sr.querySelector('.ab').addEventListener('click', () => this._zu());
      sr.querySelector('.ok').addEventListener('click', () => this._senden());
    }
    async _senden() {
      const d = this._dlg, nr = d.nr.replace(/[\s-]/g, ''), h = this._h;
      try {
        if (d.traeger === 'DHL') await h.callService('dhl', 'track_parcel', { tracking_code: nr, direction: 'incoming', config_entry_id: this._c.dhl_entry });
        else if (d.traeger === 'UPS') await h.callService('ups', 'track_parcel', { tracking_code: nr });
        else if (d.traeger === 'GLS') await h.callService('gls', 'track_parcel', { tracking_code: nr, postal_code: this._c.plz });
        else { d.msg = `${d.traeger}: Hinzufügen per Nummer ist hier nicht möglich. Sendungen dieses Anbieters erscheinen automatisch, sobald sie dem verbundenen Konto zugeordnet sind – die Verfolgung beim Anbieter wird geöffnet.`; window.open(TRAEGER[d.traeger].url(nr), '_blank', 'noopener'); this._dlgDraw(); return; }
        this._zu();
      } catch (e) { d.msg = 'Konnte nicht hinzugefügt werden: ' + (e?.message || e); this._dlgDraw(); }
    }
    disconnectedCallback() { this._ov?.remove(); }
  }

  customElements.get('gg-automationen') || customElements.define('gg-automationen', GgAutomationen);
  customElements.get('gg-pakete') || customElements.define('gg-pakete', GgPakete);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'gg-automationen', name: 'gg-automationen', description: 'Alle Automationen' }, { type: 'gg-pakete', name: 'gg-pakete', description: 'Pakete' });
  window.GG_PAKETE_ERKENNE = erkenne;

  /* ---------- Sensoren: gg-batterien erweitern ---------- */
  const TYP = (modell) => /temperature|humidity/i.test(modell) ? ['2× AAA', 'Zwei Mikrozellen (AAA)']
    : /hue|door|window|ts0203|contact/i.test(modell) ? ['1× CR2032', 'Eine Knopfzelle (CR2032)'] : ['unbekannt', 'Batterietyp nicht hinterlegt'];
  const fmt = (v, e) => `${parseFloat(v).toLocaleString('de-DE', { maximumFractionDigits: 1 })} ${e || ''}`.trim();
  customElements.whenDefined('gg-batterien').then(() => {
    const P = customElements.get('gg-batterien').prototype;
    if (P._ggSens) return; P._ggSens = true;
    const liste0 = P._liste, zeich0 = P._zeichnen;
    P._liste = function () {
      const h = this._h; const out = liste0.call(this);
      out.forEach((g) => {
        const dev = h.entities?.[g.id]?.device_id; const teile = [];
        if (dev) for (const [id, en] of Object.entries(h.entities)) {
          if (en.device_id !== dev || id === g.id) continue; const s = h.states[id]; if (!s || ['unavailable', 'unknown'].includes(s.state)) continue;
          const dc = s.attributes.device_class;
          if (id.startsWith('binary_sensor.') && ['door', 'window', 'opening', 'garage_door'].includes(dc)) teile.push(s.state === 'on' ? 'Auf' : 'Zu');
          else if (id.startsWith('sensor.') && dc === 'temperature') teile.push(fmt(s.state, s.attributes.unit_of_measurement));
          else if (id.startsWith('sensor.') && dc === 'humidity') teile.push(fmt(s.state, '%'));
        }
        g.live = teile.join(' · '); g.typ = TYP(g.modell);
      });
      return out;
    };
    P._zeichnen = function (liste) {
      zeich0.call(this, liste); const sr = this.shadowRoot; this._offen = this._offen || new Set();
      { const stl = document.createElement('style'); stl.textContent = '.z + div + .z::before { content: ""; position: absolute; top: 0; left: 72px; right: 0; height: 0.5px; background: var(--tr); }'; sr.prepend(stl); }
      sr.querySelectorAll('.z').forEach((b) => {
        const g = liste.find((x) => x.id === b.dataset.id); if (!g) return;
        if (g.live) { const sm = b.querySelector('small'); if (sm) sm.insertAdjacentHTML('beforeend', `<br><span style="color:var(--gg-t1,#fff);font-weight:600">${esc(g.live)}</span>`); sm.style.whiteSpace = 'normal'; }
        const info = document.createElement('div');
        info.style.cssText = 'padding:2px 16px 12px 72px;font-size:13px;line-height:18px;color:var(--gg-l80,rgba(235,235,245,.8))';
        info.innerHTML = `<b style="color:var(--gg-t1,#fff)">Batterie: ${esc(g.typ[0])}</b> – ${esc(g.typ[1])}<br><a href="#" style="color:var(--gg-c-blau,#0A84FF);text-decoration:none">Verlauf anzeigen</a>`;
        info.hidden = !this._offen.has(g.id); b.after(info);
        info.querySelector('a').addEventListener('click', (e) => { e.preventDefault(); this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: g.id }, bubbles: true, composed: true })); });
        b.addEventListener('click', (e) => { e.stopImmediatePropagation(); this._offen.has(g.id) ? this._offen.delete(g.id) : this._offen.add(g.id); info.hidden = !this._offen.has(g.id); }, true);
      });
    };
    document.querySelectorAll('gg-batterien').forEach((el) => { el._sig = ''; if (el._h) el.hass = el._h; });
  });
})();
