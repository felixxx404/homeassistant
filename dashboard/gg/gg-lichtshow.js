/* gg-lichtshow v1 (28.10.2026) – Steuerung der Gartenhaus-Lichtshow (MQTT-Gerät „Gartenhaus Lichtshow“)
   custom:gg-lichtshow-knopf { pfad: '#lichtshow' }  – runder Knopf neben „Stimmung“ (läuft die Show: Wellen-Symbol mit hellblauem Ring, Fehler: roter Ring).
   custom:gg-lichtshow                               – Blatt-Inhalt: Status (+ Endzeit/Restzeit/Fehler), Starten/Stoppen, Dauer (−/+), Testlauf,
                                                       Lampen-Anzeige (Hue-Sync-Sensor), App-Version (update-Entität).
   Entitäten konfigurierbar (starten, stoppen, test, dauer, status, hue, update). Alle fünf Show-Entitäten „nicht verfügbar“ = App gestoppt. */
(() => {
  if (customElements.get('gg-lichtshow')) return;
  const STD = {
    starten: 'button.gartenhaus_lichtshow_starten', stoppen: 'button.gartenhaus_lichtshow_stoppen', test: 'button.gartenhaus_lichtshow_testlauf',
    dauer: 'number.gartenhaus_lichtshow_dauer', status: 'sensor.gartenhaus_lichtshow_status',
    hue: 'binary_sensor.gartenhaus_hue_unterhaltungsbereich_gartenhaus_sync_ha', update: 'update.gartenhaus_lichtshow_update', pfad: '#lichtshow',
  };
  const WEG = ['unavailable', 'unknown', undefined, ''];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const uhr = (d) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const geh = (pfad) => {
    if (!pfad) return;
    const url = pfad.startsWith('#') ? location.pathname + location.search + pfad : pfad;
    history.pushState(null, '', url);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  };
  /* Zustand der Show aus dem Status-Sensor */
  const lies = (h, c) => {
    const st = h.states[c.status];
    const s = st ? st.state : 'unavailable';
    const a = (st && st.attributes) || {};
    const weg = !st || WEG.includes(s);
    const ende = a.endet_um ? new Date(a.endet_um) : null;
    return {
      weg, s,
      bereit: !weg && s === 'Bereit',
      laeuft: !weg && (s === 'Show läuft' || s === 'Startet'),
      test: !weg && s === 'Testlauf läuft',
      stoppt: !weg && s === 'Stoppt',
      fehler: !weg && s === 'Fehler',
      fehlertext: a.fehler || '',
      ende: ende && isFinite(ende) ? ende : null,
      blockiert: !!(h.states[c.hue] && h.states[c.hue].state === 'on'),
    };
  };
  const farbeVon = (z) => z.fehler ? 'var(--gg-c-rot, #FF453A)' : z.weg ? 'var(--gg-l55, rgba(235,235,245,0.55))' : (z.laeuft || z.test) ? 'var(--gg-c-hellblau, #64D2FF)' : z.stoppt ? 'var(--gg-c-orange, #FF9F0A)' : 'var(--gg-c-gruen, #30D158)';

  /* ---------- Knopf ---------- */
  class GgLichtshowKnopf extends HTMLElement {
    setConfig(c) {
      this._c = { ...STD, ...c };
      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `<style>
          :host { display: flex; justify-content: flex-end; align-items: center; height: 100%; }
          button { all: unset; position: relative; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;
            line-height: 0; --mdc-icon-size: 18px; color: var(--gg-t1, #FFF); background: var(--gg-f12, rgba(255,255,255,0.12));
            transition: transform 0.15s ease, background 0.25s ease; -webkit-tap-highlight-color: transparent; }
          button::before { content: ''; position: absolute; inset: -6px; border-radius: 50%; }
          button.an { box-shadow: 0 0 0 2px var(--gg-wand-farbe, rgba(0,0,0,0.3)), 0 0 0 3.5px var(--ring); }
          button:active { transform: scale(0.92); }
          button:focus-visible { outline: 2px solid var(--gg-c-blau, #0A84FF); outline-offset: 3px; }
          @media (prefers-reduced-motion: reduce) { button { transition: none; } button:active { transform: none; } }
        </style><button type="button"><ha-icon icon="mdi:waveform"></ha-icon></button>`;
        this._b = this.shadowRoot.querySelector('button');
        this._b.addEventListener('click', () => geh(this._c.pfad));
      }
      this._sig = null;
    }
    getCardSize() { return 1; }
    set hass(h) {
      this._h = h; if (!this._b) return;
      const z = lies(h, this._c);
      const sig = [z.s, z.weg].join('|');
      if (sig === this._sig) return; this._sig = sig;
      const an = z.laeuft || z.test || z.fehler;
      this._b.classList.toggle('an', an);
      this._b.style.setProperty('--ring', an ? farbeVon(z) : 'transparent');
      this._b.style.background = z.fehler ? 'color-mix(in srgb, var(--gg-c-rot, #FF453A) 35%, transparent)' : (z.laeuft || z.test) ? 'color-mix(in srgb, var(--gg-c-hellblau, #64D2FF) 35%, transparent)' : '';
      this._b.style.opacity = z.weg ? '0.6' : '';
      const txt = z.weg ? 'Lichtshow (App nicht erreichbar)' : z.laeuft ? 'Lichtshow läuft' : z.test ? 'Testlauf läuft' : z.fehler ? 'Lichtshow: Fehler' : 'Lichtshow';
      this._b.setAttribute('aria-label', txt + ' – Steuerung öffnen'); this._b.title = txt;
    }
  }

  /* ---------- Blatt-Inhalt ---------- */
  class GgLichtshow extends HTMLElement {
    setConfig(c) { this._c = { ...STD, ...c }; if (!this.shadowRoot) this.attachShadow({ mode: 'open' }); this._sig = null; this._opt = null; }
    getCardSize() { return 6; }
    connectedCallback() { this._t = setInterval(() => { if (this._h && this._z && (this._z.laeuft || this._z.test)) { this._sig = null; this.hass = this._h; } }, 15000); }
    disconnectedCallback() { clearInterval(this._t); clearTimeout(this._dt); }
    set hass(h) {
      this._h = h;
      const z = this._z = lies(h, this._c);
      const dn = h.states[this._c.dauer];
      const up = h.states[this._c.update];
      const opt = this._opt && Date.now() - this._opt.t < 6000 ? this._opt.s : '';
      if (opt && z.s !== 'Bereit') this._opt = null;
      const minute = Math.floor(Date.now() / 60000);
      const sig = JSON.stringify([z, dn && dn.state, up && [up.state, up.attributes.installed_version, up.attributes.latest_version], opt, z.laeuft || z.test ? minute : 0, this._dauerLokal]);
      if (sig === this._sig) return; this._sig = sig;
      this._zeichnen(z, dn, up, opt);
    }
    _zeichnen(z, dn, up, opt) {
      const c = this._c, h = this._h;
      const dauer = this._dauerLokal != null ? this._dauerLokal : (dn && !WEG.includes(dn.state) ? parseFloat(dn.state) : null);
      const mn = dn && dn.attributes.min != null ? Number(dn.attributes.min) : 1, mx = dn && dn.attributes.max != null ? Number(dn.attributes.max) : 120, stp = dn && Number(dn.attributes.step) || 1;
      const f = farbeVon(z);
      const wartet = opt === 'start';
      let titel, unter;
      if (z.weg) { titel = 'Nicht erreichbar'; unter = 'Die App „Gartenhaus Lichtshow“ läuft nicht. Unter Einstellungen → Apps starten.'; }
      else if (z.fehler) { titel = 'Fehler'; unter = z.fehlertext || 'Die Show meldet einen Fehler.'; }
      else if (z.laeuft || wartet) {
        titel = z.s === 'Startet' || wartet ? 'Startet …' : 'Show läuft';
        if (z.ende) { const rest = Math.max(0, Math.round((z.ende - Date.now()) / 60000)); unter = `endet um ${uhr(z.ende)} · noch ${rest} Min.`; } else unter = 'Welle in kühlem Blau';
      } else if (z.test) { titel = 'Testlauf läuft'; unter = 'Jede Lampe leuchtet kurz blau (etwa 16 s).'; }
      else if (z.stoppt) { titel = 'Stoppt …'; unter = 'Die Lampen werden wiederhergestellt.'; }
      else { titel = 'Bereit'; unter = dauer != null ? `Startet eine Show mit dem Effekt „Welle“ für ${dauer.toLocaleString('de-DE')} Min.` : 'Startet eine Show mit dem Effekt „Welle“.'; }
      const kannStart = z.bereit && !z.blockiert && !wartet;
      const kannStopp = z.laeuft || z.test || z.fehler || wartet;
      const lampen = z.laeuft || z.test ? 'Von der Show belegt' : z.blockiert ? 'Blockiert – ein anderes Programm streamt' : 'Frei';
      const lampenF = (z.blockiert && !(z.laeuft || z.test)) ? 'var(--gg-c-orange, #FF9F0A)' : 'var(--gg-wert, rgba(235,235,245,0.6))';
      const ver = up && up.attributes.installed_version ? `Version ${esc(up.attributes.installed_version)}${up.state === 'on' ? ` · Update ${esc(up.attributes.latest_version || '')} verfügbar` : ' · aktuell'}` : '';
      this.shadowRoot.innerHTML = `<style>
        :host { display: block; font-family: var(--gg-schrift, -apple-system, Inter, sans-serif); --tr: var(--gg-trenner, rgba(84,84,88,0.65)); }
        .gruppe { background: var(--gg-zelle, rgba(255,255,255,0.07)); box-shadow: var(--gg-zellschatten, none); border-radius: 26px; overflow: hidden; }
        .gruppe + .gruppe { margin-top: 14px; }
        .kopf { display: grid; grid-template-columns: 44px minmax(0,1fr); column-gap: 12px; align-items: center; padding: 14px 16px; }
        .ring { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; line-height: 0; color: var(--k); background: color-mix(in srgb, var(--k) 22%, transparent); --mdc-icon-size: 24px; }
        .kopf b { display: block; font-size: 17px; font-weight: 600; line-height: 22px; letter-spacing: -0.2px; color: var(--gg-t1, #FFF); }
        .kopf small { display: block; font-size: 13px; line-height: 17px; margin-top: 1px; color: var(--gg-wert, rgba(235,235,245,0.64)); }
        .aktion { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px 16px; }
        button { all: unset; box-sizing: border-box; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        button:focus-visible { outline: 2px solid var(--gg-c-blau, #0A84FF); outline-offset: 2px; }
        .gross { height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 16px; font-weight: 600; line-height: 0; --mdc-icon-size: 20px; transition: transform 0.12s ease; }
        .gross:active { transform: scale(0.97); }
        .start { background: var(--gg-c-blau, #0A84FF); color: #FFF; }
        .stopp { background: var(--gg-f12, rgba(255,255,255,0.12)); color: var(--gg-c-rot, #FF453A); }
        .gross[disabled] { opacity: 0.38; pointer-events: none; }
        .zeile { display: grid; grid-template-columns: minmax(0,1fr) auto; column-gap: 12px; align-items: center; min-height: 52px; padding: 8px 16px; position: relative; color: var(--gg-t1, #FFF); }
        .zeile + .zeile::before { content: ''; position: absolute; top: 0; left: 16px; right: 0; height: 0.5px; background: var(--tr); }
        .zeile b { font-size: 15px; font-weight: 500; }
        .zeile small { display: block; font-size: 12.5px; line-height: 16px; color: var(--gg-wert, rgba(235,235,245,0.6)); }
        .wert { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
        .stepper { display: flex; align-items: center; gap: 4px; }
        .stepper span { min-width: 64px; text-align: center; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .stepper button { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; line-height: 0; background: var(--gg-f12, rgba(255,255,255,0.12)); --mdc-icon-size: 20px; }
        .stepper button:active { transform: scale(0.92); }
        .stepper button[disabled] { opacity: 0.35; pointer-events: none; }
        .text { color: var(--gg-c-blau, #0A84FF); font-size: 15px; font-weight: 600; padding: 8px 0 8px 12px; }
        .text[disabled] { opacity: 0.38; pointer-events: none; }
        .fuss { margin: 10px 16px 0; font-size: 12px; line-height: 1.45; color: var(--gg-l74, rgba(235,235,245,0.74)); }
        @media (prefers-reduced-motion: reduce) { .gross, .stepper button { transition: none; } .gross:active, .stepper button:active { transform: none; } }
      </style>
      <div class="gruppe">
        <div class="kopf" style="--k:${f}"><span class="ring"><ha-icon icon="${z.fehler ? 'mdi:alert-circle-outline' : z.weg ? 'mdi:power-plug-off-outline' : (z.laeuft || wartet || z.test) ? 'mdi:waveform' : 'mdi:lightbulb-group-outline'}"></ha-icon></span>
          <span><b>${esc(titel)}</b><small>${esc(unter)}</small></span></div>
        <div class="aktion">
          <button class="gross start" data-a="start" ${kannStart ? '' : 'disabled'}><ha-icon icon="mdi:play"></ha-icon>Starten</button>
          <button class="gross stopp" data-a="stopp" ${kannStopp ? '' : 'disabled'}><ha-icon icon="mdi:stop"></ha-icon>Stoppen</button>
        </div>
      </div>
      <div class="gruppe">
        <div class="zeile"><span><b>Dauer</b></span>
          <span class="stepper"><button data-d="-1" aria-label="Dauer verkürzen" ${dauer == null || dauer <= mn ? 'disabled' : ''}><ha-icon icon="mdi:minus"></ha-icon></button><span>${dauer == null ? '–' : dauer.toLocaleString('de-DE') + ' min'}</span><button data-d="1" aria-label="Dauer verlängern" ${dauer == null || dauer >= mx ? 'disabled' : ''}><ha-icon icon="mdi:plus"></ha-icon></button></span></div>
        <div class="zeile"><span><b>Testlauf</b><small>Jede Lampe leuchtet nacheinander kurz blau</small></span>
          <button class="text" data-a="test" ${z.bereit && !z.blockiert ? '' : 'disabled'}>Starten</button></div>
        <div class="zeile"><span><b>Lampen</b></span><span class="wert" style="color:${lampenF}">${esc(lampen)}</span></div>
      </div>
      ${ver ? `<div class="fuss">App „Gartenhaus Lichtshow“ · ${ver}</div>` : ''}`;
      const sr = this.shadowRoot;
      sr.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.a;
        const id = a === 'start' ? c.starten : a === 'stopp' ? c.stoppen : c.test;
        if (a === 'start') { this._opt = { s: 'start', t: Date.now() }; this._sig = null; }
        h.callService('button', 'press', { entity_id: id }).catch(() => { this._opt = null; this._sig = null; this.hass = this._h; });
        if (a === 'start') this.hass = this._h;
      }));
      sr.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => {
        const cur = this._dauerLokal != null ? this._dauerLokal : dauer;
        const neu = Math.min(mx, Math.max(mn, cur + stp * Number(b.dataset.d)));
        this._dauerLokal = neu; this._sig = null; this.hass = this._h;
        clearTimeout(this._dt);
        this._dt = setTimeout(() => { h.callService('number', 'set_value', { entity_id: c.dauer, value: neu }).finally(() => { this._dauerLokal = null; this._sig = null; if (this._h) this.hass = this._h; }); }, 450);
      }));
    }
  }
  customElements.define('gg-lichtshow-knopf', GgLichtshowKnopf);
  customElements.define('gg-lichtshow', GgLichtshow);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'gg-lichtshow', name: 'gg-lichtshow', description: 'Gartenhaus-Lichtshow' }, { type: 'gg-lichtshow-knopf', name: 'gg-lichtshow-knopf', description: 'Knopf Lichtshow' });
})();
