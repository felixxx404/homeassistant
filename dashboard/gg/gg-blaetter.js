/* gg-blaetter v12 (Handy: weicher Verlauf unter der Überschrift, erstes Element sitzt tiefer und überdeckt weder Kreuz noch Titel; Rücksprung nach oben ohne Fingerbewegung wird zurückgesetzt) / v11 (Handy-Scrollen: Blatt folgt der echten Bildschirmhöhe (dvh), keine Maske am Handy, mehr Luft unten, Scrollposition bleibt erhalten wenn sich der Inhalt kurz neu aufbaut) / v10 (Unterkanten-Ausblendung nur am PC, am Handy ohne – Scrollen bis ganz unten) / v9 (Inhalt blendet auch an der Unterkante weich aus; am PC schneidet das Blatt seinen Inhalt an den runden Ecken ab) / v8 (Inhalt blendet unter dem Kopf weich aus statt hartem Schnitt) / v7 – alle Blätter eines Dashboards einmal laden und sofort umschalten (ohne Neuaufbau).
   v3: gleiche Konfiguration → kein Neuaufbau; neue Instanz übernimmt die fertigen Karten der alten.
   v4: Neuladen der Konfiguration beim Wiederverbinden abfangen (nur dashboard-dashboard).
   v5: Euro-Beträge in Apex-Kopfzeilen immer 0,00 €; Tab-Leiste auf die gemessene Breite der Kästen.
   v6: Systemschrift (SF Pro auf Apple-Geräten), Abstände wie Apple Home.
   v7: Eigene Apple-Blätter statt Bubble-Pop-ups – Inhalte bleiben dauerhaft aufgebaut und gezeichnet (öffnen sofort),
       Live-Kamera-Blätter (#live…) bauen sich erst beim Öffnen auf. Wischen nach unten / ✕ / daneben tippen schließt.
       Kamera-Wache: Live-Bild mit Fehler oder nach Rückkehr aus dem Hintergrund wird neu aufgebaut.
       Optionen für Wanddisplays: vollbild, zurueck_nach (Sek. ohne Bedienung → erstes Blatt), Blatt mit lazy: true
       wird nur aufgebaut, solange es angezeigt wird. Pop-up-Option gg_nach {entity, ziel}: nach Ausführen weiter.
       Live-Kameras auf verdeckten Blättern ruhen nach 30 s. Vollbild: Blattwahl per #hash (Cast-tauglich).
       Geräte-Karten (30 Tage) mit zwei Nachkommastellen. Läuft auch im Cast-Empfänger (ohne loadCardHelpers).
       Blätter nutzen die Farbwerte --gg-* aus der Ressource gg-farben (dunkel; hell = html[data-gg-tag] zwischen
       Sonnenauf- und -untergang, gesetzt aus sun.sun). */
(() => {
  if (customElements.get('gg-blaetter-view')) return;
  const w = window;
  const CACHE = w.__ggBlaetterCache || (w.__ggBlaetterCache = {});
  /* Tag/Nacht: hell zwischen Sonnenauf- und -untergang (sun.sun), letzter Stand sofort beim Laden */
  try { if (localStorage.getItem('ggTag') === '1') document.documentElement.setAttribute('data-gg-tag', ''); } catch (_) {}
  const tagNacht = (h) => {
    try {
      const so = h && h.states && h.states['sun.sun'];
      if (!so) return;
      const tag = so.state === 'above_horizon';
      if (w.__ggTag === tag) return;
      w.__ggTag = tag;
      document.documentElement.toggleAttribute('data-gg-tag', tag);
      try { localStorage.setItem('ggTag', tag ? '1' : '0'); } catch (_) {}
    } catch (_) {}
  };
  /* Neuladen der Konfiguration abfangen (nur dieses Dashboard) */
  const DASH = 'dashboard-dashboard';
  customElements.whenDefined('ha-panel-lovelace').then(() => {
    const K = customElements.get('ha-panel-lovelace');
    const P = K && K.prototype;
    if (!P || P.__ggPatch || typeof P._fetchConfig !== 'function') return;
    P.__ggPatch = true;
    const orig = P._fetchConfig;
    P._fetchConfig = async function (force) {
      const self = this, args = arguments;
      try {
        if (!force && self.lovelace && self.urlPath === DASH && !self.lovelace.editMode && self.hass && self.hass.connection) {
          const neu = await self.hass.connection.sendMessagePromise({ type: 'lovelace/config', url_path: self.urlPath, force: false });
          if (JSON.stringify(neu) === JSON.stringify(self.lovelace.rawConfig)) return;
          if (document.visibilityState === 'visible') {
            if (self.__ggWartet) return;
            self.__ggWartet = true;
            const los = () => {
              if (document.visibilityState !== 'hidden') return;
              document.removeEventListener('visibilitychange', los);
              self.__ggWartet = false;
              orig.apply(self, args);
            };
            document.addEventListener('visibilitychange', los);
            return;
          }
        }
      } catch (e) {}
      return orig.apply(self, args);
    };
  });
  /* Euro immer 0,00 € – greift nach jedem Neuzeichnen der Apex-Kopfzeile, ohne Lit-Markierungen anzufassen */
  const EUR = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const zahl = (t) => {
    let x = String(t).replace(/\s/g, '').replace('−', '-');
    if (!/^-?[\d.,]+$/.test(x)) return null;
    if (x.indexOf(',') >= 0) x = x.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, '');
    const n = parseFloat(x);
    return isFinite(n) ? n : null;
  };
  const euro = (root) => {
    if (!root) return;
    root.querySelectorAll('#state__value').forEach((v) => {
      const u = v.querySelector('#uom'), s = v.querySelector('#state');
      if (!u || !s || u.textContent.indexOf('€') < 0) return;
      s.childNodes.forEach((n) => {
        if (n.nodeType !== 3 || !n.data.trim()) return;
        const z = zahl(n.data.trim());
        if (z === null) return;
        const f = EUR.format(z);
        if (n.data !== f) n.data = f;
      });
    });
  };
  /* Geräte-Karten (30 Tage): Werte immer mit zwei Nachkommastellen (1,00 W · 0,70 €) */
  const zwei = (root) => {
    if (!root) return;
    root.querySelectorAll('#state').forEach((s) => {
      s.childNodes.forEach((n) => {
        if (n.nodeType !== 3 || !n.data.trim()) return;
        const z = zahl(n.data.trim());
        if (z === null) return;
        const f = EUR.format(z);
        if (n.data !== f) n.data = f;
      });
    });
  };
  customElements.whenDefined('apexcharts-card').then(() => {
    const K = customElements.get('apexcharts-card');
    const P = K && K.prototype;
    if (!P || P.__ggEuro) return;
    P.__ggEuro = true;
    const orig = P.updated;
    P.updated = function (ch) {
      if (orig) orig.call(this, ch);
      try {
        euro(this.shadowRoot);
        if (this._config && this._config.graph_span === '30d') zwei(this.shadowRoot);
      } catch (e) {}
    };
  });
  w.__ggSeiteNav = function () {
    try {
      const ctx = w.__ggNavCtx;
      const box = ctx && ctx.elements && ctx.elements.cardContainer;
      if (!box) return;
      const i = String(w.__ggSeite || 0);
      if (box.getAttribute('data-gg-seite') !== i) {
        box.setAttribute('data-gg-seite', i);
        box.style.setProperty('--gg-seite', i);
      }
    } catch (e) {}
  };
  /* Karten erzeugen: im Dashboard über loadCardHelpers, im Cast-Empfänger (Nest Hub) über hui-card */
  const holeHelfer = async () => {
    if (typeof w.loadCardHelpers === 'function') { try { return await w.loadCardHelpers(); } catch (_) {} }
    await customElements.whenDefined('hui-card');
    return {
      createCardElement: (conf) => {
        const el = document.createElement('hui-card');
        el.preview = false;
        el.config = conf;
        if (typeof el.load === 'function') el.load();
        return el;
      }
    };
  };
  const CSS = `
    :host {
      display: block; position: relative; width: 100%;
      --gg-schrift: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      --ha-font-family-body: var(--gg-schrift);
      --ha-font-family-heading: var(--gg-schrift);
      --mdc-typography-font-family: var(--gg-schrift);
      --paper-font-common-base_-_font-family: var(--gg-schrift);
      --ha-font-smoothing: antialiased;
      font-family: var(--gg-schrift);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .blaetter { position: relative; width: 100%; container-type: inline-size; }
    .seite { box-sizing: border-box; max-width: 1032px; margin: 0 auto; padding-bottom: 112px; }
    .seite:not(.aktiv) { position: absolute; top: 0; left: 0; right: 0; height: 0; overflow: hidden; visibility: hidden; opacity: 0; pointer-events: none; }
    .kopf { margin: 0 0 4px; }
    .raster { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px 28px; align-items: start; }
    @container (min-width: 700px) {
      .raster { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .breit { grid-column: 1 / -1; }
    }
    .abschnitt { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    :host([vollbild]) .seite { max-width: none; padding: 0; }
    :host([vollbild]) .raster { display: block; }
    :host([vollbild]) .abschnitt { gap: 0; }
    .immer { height: 0; overflow: hidden; }
    .blaetter, .immer { transition: opacity 0.18s ease; }
    :host(:not([bereit])) .blaetter, :host(:not([bereit])) .immer { opacity: 0; pointer-events: none; }
    /* Apple-Blatt (ersetzt Bubble-Pop-ups) */
    .pop { position: fixed; inset: 0; height: 100vh; height: 100dvh; z-index: 30; pointer-events: none; }
    .pop .dim { position: absolute; inset: 0; background: var(--gg-dim, rgba(0, 0, 0, 0.38)); opacity: 0; transition: opacity 0.35s ease; }
    .pop .blatt {
      position: absolute; left: 0; right: 0; bottom: 0; margin: 0 auto; width: 100%; max-width: var(--breite, 600px);
      max-height: calc(100% - max(44px, env(safe-area-inset-top, 0px) + 18px)); box-sizing: border-box;
      display: flex; flex-direction: column; border-radius: 38px 38px 0 0; color: var(--gg-t1, #FFFFFF);
      background: var(--gg-blatt, rgba(28, 30, 38, 0.88)); backdrop-filter: blur(40px) saturate(180%); -webkit-backdrop-filter: blur(40px) saturate(180%);
      border-top: 1px solid var(--gg-r16, rgba(255, 255, 255, 0.16)); box-shadow: var(--gg-glasrand, 0 0 0 0 transparent), 0 -12px 40px var(--gg-schatten, rgba(0, 0, 0, 0.35));
      transform: translateY(calc(100% + 40px)); visibility: hidden;
      transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1), visibility 0s linear 0.42s;
    }
    .pop.offen { pointer-events: auto; }
    .pop.offen .dim { opacity: 1; }
    .pop.offen .blatt { transform: none; visibility: visible; transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1), visibility 0s; }
    @media (min-width: 769px) {
      .pop .blatt { bottom: 20px; width: calc(100% - 40px); max-height: calc(100% - 80px); border-radius: 38px; border: 1px solid var(--gg-r14, rgba(255, 255, 255, 0.14)); overflow: hidden; }
      .blatt .inhalt { -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 14px, #000 calc(100% - 20px), transparent 100%); mask-image: linear-gradient(to bottom, transparent 0, #000 14px, #000 calc(100% - 20px), transparent 100%); }
    }
    .blatt header { position: relative; z-index: 2; flex: 0 0 auto; display: flex; align-items: center; gap: 12px; padding: 22px 16px 10px 22px; touch-action: none; }
    .blatt .griff { position: absolute; top: 7px; left: 50%; width: 38px; height: 5px; margin-left: -19px; border-radius: 3px; background: var(--gg-l42, rgba(255, 255, 255, 0.32)); }
    .blatt h2 { flex: 1 1 auto; min-width: 0; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; line-height: 28px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .blatt .zu { flex: 0 0 36px; width: 36px; height: 36px; border-radius: 50%; border: none; padding: 0; display: flex; align-items: center; justify-content: center; background: var(--gg-f16, rgba(255, 255, 255, 0.16)); color: var(--gg-t1, #FFFFFF); --mdc-icon-size: 20px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .blatt .zu:active { background: var(--gg-f30, rgba(255, 255, 255, 0.3)); }
    .blatt .inhalt { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; overflow-anchor: none; -webkit-overflow-scrolling: touch; margin-top: 0; padding: 24px 16px calc(40px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 10px; -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 22px); mask-image: linear-gradient(to bottom, transparent 0, #000 22px); }
  `;
  class GgBlaetter extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._els = [];
      this._seitenEl = [];
      this._idx = null;
      this._scroll = {};
      this._ort = () => this._pruefeOrt();
      this._mass = () => this._navMass();
      this._taste = (ev) => { if (ev.key === 'Escape' && location.hash) this._schliesse(); };
      this._tipp = () => { this._letzteBed = Date.now(); };
      this._sicht = () => this._sichtWechsel();
    }
    setConfig(c) {
      if (!c || !Array.isArray(c.seiten) || !c.seiten.length) throw new Error('gg-blaetter: seiten fehlt');
      const key = JSON.stringify(c);
      if (key === this._key) return;
      this._key = key;
      this._cfg = c;
      if (this._gestartet) this._baue();
    }
    getCardSize() { return 12; }
    getGridOptions() { return { columns: 'full' }; }
    set hass(h) {
      this._hass = h;
      tagNacht(h);
      for (const e of this._els) { try { e.el.hass = h; } catch (_) {} }
      this._sichtbar();
      this._nachSkript(h);
    }
    /* Sicherheitsnetz: die eigene Hülle darf nie ausgeblendet werden */
    _sichtbar() {
      try {
        const hc = this.parentElement && this.parentElement.closest ? this.parentElement.closest('hui-card') : null;
        if (hc && (hc.hidden || hc.style.display === 'none')) {
          hc.hidden = false;
          hc.style.display = '';
          const c = hc.closest('.card');
          if (c) { c.style.display = ''; c.style.position = ''; }
        }
      } catch (_) {}
    }
    connectedCallback() {
      w.addEventListener('location-changed', this._ort);
      w.addEventListener('popstate', this._ort);
      w.addEventListener('hashchange', this._ort);
      w.addEventListener('resize', this._mass);
      w.addEventListener('keydown', this._taste);
      w.addEventListener('pointerdown', this._tipp, true);
      document.addEventListener('visibilitychange', this._sicht);
      if (!this._gestartet) { this._gestartet = true; this._baue(); } else { this._pruefeOrt(); }
      this._wachen();
    }
    disconnectedCallback() {
      w.removeEventListener('location-changed', this._ort);
      w.removeEventListener('popstate', this._ort);
      w.removeEventListener('hashchange', this._ort);
      w.removeEventListener('resize', this._mass);
      w.removeEventListener('keydown', this._taste);
      w.removeEventListener('pointerdown', this._tipp, true);
      document.removeEventListener('visibilitychange', this._sicht);
      clearInterval(this._kwI); this._kwI = null;
      clearInterval(this._rwI); this._rwI = null;
    }
    /* Tab-Leiste genau so breit wie die Kästen (max. 440 px, mittig über dem Inhalt) */
    _navMass() {
      try {
        if (this._cfg && this._cfg.vollbild) return;
        const se = this._seitenEl[this._idx || 0];
        const r = se && se.querySelector('.raster');
        const im = this.shadowRoot.querySelector('.immer');
        if (!r || !im) return;
        const b = r.getBoundingClientRect();
        if (b.width < 200) return;
        const bw = Math.min(b.width, 440);
        const l = b.left + (b.width - bw) / 2;
        im.style.setProperty('--gg-nav-w', bw.toFixed(1) + 'px');
        im.style.setProperty('--gg-nav-l', l.toFixed(1) + 'px');
      } catch (_) {}
    }
    _beobachte(el) {
      try {
        if (!this._ro && w.ResizeObserver) this._ro = new ResizeObserver(() => this._navMass());
        if (this._ro && el) { this._ro.disconnect(); this._ro.observe(el); }
      } catch (_) {}
    }
    async _baue() {
      const lauf = (this._lauf = (this._lauf || 0) + 1);
      const h = await holeHelfer();
      if (lauf !== this._lauf) return;
      this._h = h;
      const root = this.shadowRoot;
      root.innerHTML = '<style>' + CSS + '</style>';
      this.toggleAttribute('vollbild', !!this._cfg.vollbild);
      /* fertige Karten einer früheren Instanz mit gleicher Konfiguration übernehmen */
      const alt = CACHE.eintrag;
      if (alt && alt.key === this._key && alt.besitzer !== this) {
        if (alt.besitzer) alt.besitzer._els = [];
        alt.besitzer = this;
        root.appendChild(alt.blaetter);
        root.appendChild(alt.immer);
        this._els = alt.els;
        this._seitenEl = alt.seiten;
        this._pops = alt.pops || [];
        this._pops.forEach((p) => this._blattAnbinden(p));
        if (this._hass) this.hass = this._hass;
        this._idx = null;
        this._pruefeOrt();
        this._beobachte(alt.blaetter);
        this.setAttribute('bereit', '');
        this._sichtbar();
        return;
      }
      this.removeAttribute('bereit');
      this._els = [];
      this._seitenEl = [];
      const bl = document.createElement('div');
      bl.className = 'blaetter';
      const im = document.createElement('div');
      im.className = 'immer';
      root.appendChild(bl);
      root.appendChild(im);
      this._cfg.seiten.forEach((s) => {
        const se = document.createElement('div');
        se.className = 'seite';
        se._def = s;
        if (!s.lazy) this._seiteFuellen(se);
        bl.appendChild(se);
        this._seitenEl.push(se);
      });
      this._pops = [];
      (this._cfg.immer || []).forEach((cc) => {
        if (cc && cc.card_type === 'pop-up' && cc.hash) {
          const p = this._blatt(cc);
          im.appendChild(p);
          this._pops.push(p);
        } else {
          im.appendChild(this._karte(cc));
        }
      });
      CACHE.eintrag = { key: this._key, blaetter: bl, immer: im, els: this._els, seiten: this._seitenEl, pops: this._pops, besitzer: this };
      this._idx = null;
      this._pruefeOrt();
      this._beobachte(bl);
      this._sichtbar();
      setTimeout(() => this._sichtbar(), 500);
      setTimeout(() => this._sichtbar(), 2000);
      this._warteBereit(lauf);
      this._wachen();
    }
    _seiteFuellen(se) {
      if (se._voll) return;
      se._voll = true;
      const s = se._def;
      const n0 = this._els.length;
      if (s.kopf) {
        const k = document.createElement('div');
        k.className = 'kopf';
        k.appendChild(this._karte(s.kopf));
        se.appendChild(k);
      }
      const r = document.createElement('div');
      r.className = 'raster';
      (s.abschnitte || []).forEach((a) => {
        const d = document.createElement('div');
        d.className = 'abschnitt' + ((a.breite || 1) > 1 ? ' breit' : '');
        (a.cards || []).forEach((cc) => d.appendChild(this._karte(cc)));
        r.appendChild(d);
      });
      se.appendChild(r);
      this._els.slice(n0).forEach((e) => { e.seite = se; });
    }
    _seiteLeeren(se) {
      if (!se._voll) return;
      se._voll = false;
      this._els = this._els.filter((e) => e.seite !== se);
      se.textContent = '';
    }
    /* ---------------------------------------------------------------- Apple-Blätter */
    _blatt(cc) {
      const p = document.createElement('div');
      p.className = 'pop';
      p.dataset.hash = cc.hash;
      p._cfg = cc;
      p.innerHTML = '<div class="dim"></div><section class="blatt" role="dialog" aria-modal="true"><header><span class="griff"></span><h2></h2><button class="zu" aria-label="Schließen"><ha-icon icon="mdi:close"></ha-icon></button></header><div class="inhalt"></div></section>';
      p.querySelector('h2').textContent = cc.name || '';
      if (cc.width_desktop) p.querySelector('.blatt').style.setProperty('--breite', cc.width_desktop);
      p._inhalt = p.querySelector('.inhalt');
      p._faul = cc.background_update === false || String(cc.hash).indexOf('#live') === 0;
      if (!p._faul) this._blattFuellen(p);
      this._blattAnbinden(p);
      return p;
    }
    _blattAnbinden(p) {
      if (p._besitzer === this) return;
      p._besitzer = this;
      const b = p.querySelector('.blatt');
      const kopf = b.querySelector('header');
      const zu = () => this._schliesse();
      p.querySelector('.zu').onclick = zu;
      p.querySelector('.dim').onclick = p._cfg.close_by_clicking_outside === false ? null : zu;
      let y0 = null, dy = 0;
      /* Scrollposition halten: baut sich der Inhalt kurz neu auf (Diagramm, Karte), schrumpft die Höhe kurz und der Browser setzt die Position höher – die zuletzt vom Nutzer erreichte Position wird dann zurückgesetzt */
      const ink = p._inhalt;
      p._top = 0; let hv = 0, usr = 0, fing = 0;
      const merke = () => { usr = Date.now(); };
      ['touchmove', 'wheel', 'pointerdown'].forEach((ev) => ink.addEventListener(ev, merke, { passive: true }));
      ink.addEventListener('touchstart', () => { fing = 1; merke(); }, { passive: true });
      ['touchend', 'touchcancel'].forEach((ev) => ink.addEventListener(ev, () => { fing = 0; merke(); }, { passive: true }));
      const halte = () => {
        const max = ink.scrollHeight - ink.clientHeight;
        if (p._top > 4 && ink.scrollTop < p._top - 4 && max >= p._top - 1) ink.scrollTop = p._top;
      };
      ink.addEventListener('scroll', () => {
        const h = ink.scrollHeight, t = ink.scrollTop;
        const sprung = p._top - t > 150 && !fing && Date.now() - usr > 120;
        if (sprung) { requestAnimationFrame(halte); return; }
        if (h >= hv - 1 || fing || Date.now() - usr < 250) { p._top = t; hv = h; }
      }, { passive: true });
      setInterval(() => {
        if (!p.classList.contains('offen') || fing || Date.now() - usr < 400) return;
        halte();
        hv = ink.scrollHeight;
      }, 200);
      kopf.ontouchstart = (e) => { y0 = e.touches[0].clientY; dy = 0; b.style.transition = 'none'; };
      kopf.ontouchmove = (e) => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); b.style.transform = 'translateY(' + dy + 'px)'; };
      kopf.ontouchend = kopf.ontouchcancel = () => {
        if (y0 === null) return;
        y0 = null;
        b.style.transition = '';
        if (dy > 90) { p.classList.remove('offen'); this._schliesse(); }
        b.style.transform = '';
      };
    }
    _blattFuellen(p) {
      if (p._voll) return;
      p._voll = true;
      const n0 = this._els.length;
      (p._cfg.cards || []).forEach((c) => p._inhalt.appendChild(this._karte(c)));
      this._els.slice(n0).forEach((e) => { e.pop = p; });
    }
    _blattLeeren(p) {
      if (!p._voll) return;
      p._voll = false;
      this._els = this._els.filter((e) => e.pop !== p);
      p._inhalt.textContent = '';
    }
    _schliesse() {
      (this._pops || []).forEach((p) => p.classList.remove('offen'));
      if (!location.hash) { this._popsAktualisieren(); return; }
      if (this._zurueck && history.length > 1) { this._zurueck = false; history.back(); return; }
      history.replaceState(history.state, '', location.pathname + location.search);
      w.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
      this._pruefeOrt();
    }
    /* Blatt nur offen, solange sein #hash aktiv ist */
    _popsAktualisieren() {
      const h = location.hash;
      if (h && !this._hashVorher && this._pfadVorher === location.pathname) this._zurueck = true;
      else if (h && !this._hashVorher) this._zurueck = false;
      this._hashVorher = h;
      this._pfadVorher = location.pathname;
      let offen = false;
      (this._pops || []).forEach((p) => {
        if (p.dataset.hash === h) {
          offen = true;
          if (p._t) { clearTimeout(p._t); p._t = null; }
          if (!p.classList.contains('offen')) {
            if (p._faul) this._blattFuellen(p);
            p._inhalt.scrollTop = 0; p._top = 0;
            p.classList.add('offen');
          }
        } else {
          p.classList.remove('offen');
          if (p._faul && p._voll && !p._t) {
            p._t = setTimeout(() => { p._t = null; if (!p.classList.contains('offen')) this._blattLeeren(p); }, 600);
          }
        }
      });
      if (this._sperre !== offen) {
        this._sperre = offen;
        try { document.body.style.overflow = offen ? 'hidden' : ''; } catch (_) {}
      }
    }
    /* nach Ausführen eines Skripts zu einem anderen Blatt (z. B. Verleih speichern → Übersicht) */
    _nachSkript(h) {
      (this._pops || []).forEach((p) => {
        const n = p._cfg && p._cfg.gg_nach;
        if (!n || !h || !h.states) return;
        const s = h.states[n.entity];
        const t = s && s.attributes ? String(s.attributes.last_triggered || '') : '';
        if (p._nachT === undefined) { p._nachT = t; return; }
        if (!t || t === p._nachT) return;
        p._nachT = t;
        if (location.hash !== p.dataset.hash) return;
        setTimeout(() => {
          history.pushState(null, '', location.pathname + location.search + n.ziel);
          w.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
          this._pruefeOrt();
        }, 250);
      });
    }
    /* ---------------------------------------------------------------- Wachen: Kamera, Rückkehr */
    _wachen() {
      if (!this._kwI) {
        this._kwI = setInterval(() => {
          if (document.visibilityState !== 'visible') return;
          this._els.slice().forEach((e) => { if (e.kamera && e.el.isConnected && this._hatFehler(e.el)) this._neuBauen(e); });
        }, 6000);
      }
      if (!this._rwI && this._cfg && this._cfg.zurueck_nach) {
        this._letzteBed = Date.now();
        this._rwI = setInterval(() => {
          if (!this._idx || (!this._cfg.vollbild && location.hash)) return;
          if (Date.now() - (this._letzteBed || 0) < this._cfg.zurueck_nach * 1000) return;
          const b = location.pathname.split('/')[1];
          if (this._cfg.vollbild) history.replaceState(null, '', location.pathname + location.search);
          else history.replaceState(null, '', '/' + b + '/' + this._cfg.seiten[0].pfad);
          w.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
          this._pruefeOrt();
        }, 5000);
      }
    }
    _hatFehler(el) {
      const st = [el];
      let n = 0;
      while (st.length && n < 8000) {
        const x = st.pop();
        n++;
        if (x.localName === 'ha-alert' && x.getAttribute('alert-type') === 'error') return true;
        if (x.shadowRoot) for (const c of x.shadowRoot.children) st.push(c);
        for (const c of x.children) st.push(c);
      }
      return false;
    }
    _neuBauen(e) {
      const t = Date.now();
      if (e._neu && t - e._neu < 15000) return;
      e._neu = t;
      try { e.el.dispatchEvent(new Event('ll-rebuild')); } catch (_) {}
    }
    _sichtWechsel() {
      if (document.visibilityState === 'hidden') { this._wegSeit = Date.now(); return; }
      if (this._wegSeit && Date.now() - this._wegSeit > 8000) {
        this._els.slice().forEach((e) => { if (e.kamera && e.el.isConnected) { e._neu = 0; this._neuBauen(e); } });
      }
      this._wegSeit = 0;
    }
    /* erst zeigen, wenn Leiste und Kopf des aktuellen Blatts stehen (max. 3 s) */
    _warteBereit(lauf) {
      const t0 = Date.now();
      const pruefe = () => {
        if (lauf !== this._lauf) return;
        const dt = Date.now() - t0;
        let ok = false;
        try {
          if (this._cfg.vollbild) ok = dt > 60;
          else {
            const ctx = w.__ggNavCtx;
            const box = ctx && ctx.isConnected && ctx.elements && ctx.elements.cardContainer;
            const navOk = !!(box && box.getBoundingClientRect().height > 0);
            const se = this._seitenEl[this._idx || 0];
            const kopf = se && se.querySelector('.kopf');
            const kopfOk = !kopf || kopf.getBoundingClientRect().height > 20;
            ok = navOk && kopfOk && dt > 200;
          }
        } catch (_) {}
        if (ok || dt > 3000) { this.setAttribute('bereit', ''); w.__ggSeiteNav(); return; }
        setTimeout(pruefe, 60);
      };
      pruefe();
    }
    _karte(conf) {
      const e = { conf: conf, el: this._h.createCardElement(conf) };
      e.kamera = JSON.stringify(conf).indexOf('"camera_view":"live"') >= 0;
      this._els.push(e);
      if (this._hass) e.el.hass = this._hass;
      this._binde(e);
      return e.el;
    }
    _binde(e) {
      e.el.addEventListener('ll-rebuild', (ev) => {
        ev.stopPropagation();
        const neu = this._h.createCardElement(e.conf);
        if (this._hass) neu.hass = this._hass;
        e.el.replaceWith(neu);
        e.el = neu;
        this._binde(e);
      }, { once: true });
    }
    /* Live-Kameras auf nicht angezeigten Blättern nach 30 s pausieren (spart Daten/Akku), beim Zurückkommen sofort neu */
    _kameraRuhe() {
      const aktiv = this._seitenEl[this._idx];
      this._els.forEach((e) => {
        if (!e.kamera || !e.seite) return;
        if (e.seite === aktiv) {
          if (e._pt) { clearTimeout(e._pt); e._pt = null; }
          if (e._ruhe && e._ph) {
            e._ruhe = false;
            const neu = this._h.createCardElement(e.conf);
            if (this._hass) neu.hass = this._hass;
            e._ph.replaceWith(neu);
            e._ph = null;
            e.el = neu;
            this._binde(e);
          }
        } else if (!e._ruhe && !e._pt) {
          e._pt = setTimeout(() => {
            e._pt = null;
            if (e.seite === this._seitenEl[this._idx] || !e.el.isConnected) return;
            const ph = document.createElement('div');
            ph.style.minHeight = (e.el.offsetHeight || 0) + 'px';
            e.el.replaceWith(ph);
            e._ph = ph;
            e._ruhe = true;
          }, 30000);
        }
      });
    }
    _seiteAusPfad() {
      /* Vollbild (z. B. Nest Hub per Cast): Blatt über #hash, der Pfad bleibt unberührt */
      if (this._cfg.vollbild) {
        const hh = decodeURIComponent(location.hash.slice(1));
        return hh ? this._cfg.seiten.findIndex((s) => s.pfad === hh) : 0;
      }
      const t = location.pathname.split('/');
      return this._cfg.seiten.findIndex((s) => s.pfad === (t[2] || ''));
    }
    _pruefeOrt() {
      this._popsAktualisieren();
      if (!this._seitenEl.length) return;
      const i = this._seiteAusPfad();
      if (i >= 0 && i !== this._idx) this._zeige(i);
      else if (this._idx === null) this._zeige(Math.max(i, 0));
    }
    _y() {
      const s = document.scrollingElement || document.documentElement;
      return Math.max(w.scrollY || 0, (s && s.scrollTop) || 0);
    }
    _zeige(i) {
      const alt = this._idx;
      if (alt !== null) this._scroll[alt] = this._y();
      this._idx = i;
      this._letzteBed = Date.now();
      w.__ggSeite = i;
      this._seitenEl.forEach((s, k) => {
        if (k === i && s._def && s._def.lazy) this._seiteFuellen(s);
        s.classList.toggle('aktiv', k === i);
        if (k !== i && s._def && s._def.lazy) this._seiteLeeren(s);
      });
      this._kameraRuhe();
      if (alt !== null && alt !== i) { try { w.scrollTo(0, this._scroll[i] || 0); } catch (_) {} }
      w.__ggSeiteNav();
      requestAnimationFrame(() => this._navMass());
    }
  }
  customElements.define('gg-blaetter-view', GgBlaetter);
  w.customCards = w.customCards || [];
  w.customCards.push({ type: 'gg-blaetter-view', name: 'gg Blätter', description: 'Alle Blätter einmal laden, sofort umschalten' });
})();
