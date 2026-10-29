/* gg-lichtfest v1 – besondere Anlässe fürs Licht (Licht → Stimmung → runder Knopf).
   custom:gg-lichtfest-knopf  { raum: 'gartenhaus' | 'schlafzimmer', pfad: '#lichtfest-gartenhaus' }
     runder Knopf neben „Stimmung“: neutral (Funkeln-Symbol) oder – wenn ein Anlass läuft – in dessen Farben mit dessen Symbol.
   custom:gg-lichtfest  { raum }
     Pop-up-Inhalt: Status (läuft seit … · endet spätestens …, „Beenden“), Liste der Anlässe (Antippen = starten/beenden, Haken),
     „Automatisch beenden nach“ mit −/+ (input_number.lichtfest_hochstdauer).
   Steuerung nur über input_select.lichtfest_<raum> → automation.lichtfest_steuern + script.lichtfest_ablauf. */
(() => {
  if (customElements.get('gg-lichtfest')) return;
  const FESTE = [
    { k: 'Halloween', icon: 'mdi:halloween', f: ['#FF6A00', '#7A00FF'], t: 'Dunkel, Kürbis-Orange und Giftgrün, Kerzenflackern, Wackelkontakt und Geisterblitze' },
    { k: 'Silvester', icon: 'mdi:firework', f: ['#FFC23C', '#1A2A8C'], t: 'Nachtblau mit Goldfunkeln, Raketen in allen Farben, um 0:00 ein goldener Moment' },
    { k: 'Geburtstag', icon: 'mdi:cake-variant', f: ['#FF5AAA', '#00C8D2'], t: 'Bunte Pastelltöne, Kerzenschein und ab und zu Konfetti' },
    { k: 'Weihnachten', icon: 'mdi:pine-tree', f: ['#E0201A', '#00A040'], t: 'Rot, Grün und Gold, Kerzenlicht und Funkeln' },
    { k: 'Party', icon: 'mdi:party-popper', f: ['#B2008C', '#0038B2'], t: 'Satte, etwas gedimmte Farben im Wechsel, ab und zu ein Drop' },
    { k: 'Rave', icon: 'mdi:speaker-wireless', f: ['#5A00FF', '#050510'], t: 'Fast dunkel, Stroboblitze, dunkle Farbwellen und harte Drops' },
    { k: 'Gewitter', icon: 'mdi:weather-lightning', f: ['#3A5BFF', '#1B1464'], t: 'Dunkles Blau, Wetterleuchten und plötzliche Blitze' },
    { k: 'Romantik', icon: 'mdi:heart', f: ['#FF2850', '#9A0034'], t: 'Tiefes Rot und Rosa, Kerzenlicht, ganz ruhig' },
  ];
  const fest = (k) => FESTE.find((x) => x.k === k);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const uhr = (d) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const verlauf = (f) => `linear-gradient(135deg, ${f.f[0]}, ${f.f[1]})`;
  const geh = (pfad) => {
    if (!pfad) return;
    const url = pfad.startsWith('#') ? location.pathname + location.search + pfad : pfad;
    history.pushState(null, '', url);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  };
  // gemeinsamer optimistischer Stand je Raum (Knopf und Liste sehen dasselbe sofort)
  const lokal = (window.__ggLichtfest = window.__ggLichtfest || {});
  const stand = (h, raum) => {
    const e = `input_select.lichtfest_${raum}`;
    const st = h?.states?.[e];
    const o = lokal[raum];
    if (o && Date.now() - o.t < 8000 && st && st.state !== o.wert) return { wert: o.wert, seit: new Date(), e };
    return { wert: st ? st.state : 'Aus', seit: st ? new Date(st.last_changed) : new Date(), e, fehlt: !st };
  };
  const setze = (h, raum, wert) => {
    lokal[raum] = { wert, t: Date.now() };
    window.dispatchEvent(new CustomEvent('gg-lichtfest', { detail: { raum } }));
    h.callService('input_select', 'select_option', { entity_id: `input_select.lichtfest_${raum}`, option: wert }).catch(() => {
      delete lokal[raum];
      window.dispatchEvent(new CustomEvent('gg-lichtfest', { detail: { raum, fehler: true } }));
    });
  };

  class GgLichtfestKnopf extends HTMLElement {
    constructor() { super(); this._neu = () => this._zeichnen(); this._sig = null; }
    setConfig(c) {
      this._c = { raum: 'gartenhaus', ...c };
      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `<style>
          :host { display: flex; justify-content: flex-end; align-items: center; height: 100%; }
          button { all: unset; position: relative; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;
            line-height: 0; --mdc-icon-size: 18px; color: var(--gg-t1, #FFF); background: var(--gg-f12, rgba(255,255,255,0.12));
            transition: transform 0.15s ease, background 0.25s ease; -webkit-tap-highlight-color: transparent; }
          button::before { content: ''; position: absolute; inset: -6px; border-radius: 50%; }
          button.an { color: #FFFFFF; box-shadow: 0 0 0 2px var(--gg-wand-farbe, rgba(0,0,0,0.3)), 0 0 0 3.5px var(--ring); }
          button:active { transform: scale(0.92); }
          button:focus-visible { outline: 2px solid var(--gg-c-blau, #0A84FF); outline-offset: 3px; }
          @media (prefers-reduced-motion: reduce) { button { transition: none; } button:active { transform: none; } }
        </style><button type="button"><ha-icon icon="mdi:creation"></ha-icon></button>`;
        this._b = this.shadowRoot.querySelector('button');
        this._b.addEventListener('click', () => geh(this._c.pfad));
      }
      this._sig = null;
    }
    connectedCallback() { window.addEventListener('gg-lichtfest', this._neu); }
    disconnectedCallback() { window.removeEventListener('gg-lichtfest', this._neu); }
    getCardSize() { return 1; }
    set hass(h) { this._h = h; this._zeichnen(); }
    _zeichnen() {
      if (!this._b || !this._h) return;
      const s = stand(this._h, this._c.raum);
      const f = fest(s.wert);
      const sig = f ? f.k : '';
      if (sig === this._sig) return;
      this._sig = sig;
      this._b.classList.toggle('an', !!f);
      this._b.style.background = f ? verlauf(f) : '';
      this._b.style.setProperty('--ring', f ? f.f[0] : 'transparent');
      this._b.querySelector('ha-icon').setAttribute('icon', f ? f.icon : 'mdi:creation');
      this._b.setAttribute('aria-label', f ? `${f.k} läuft – besondere Anlässe öffnen` : 'Besondere Anlässe');
      this._b.title = f ? `${f.k} läuft` : 'Besondere Anlässe';
    }
  }

  class GgLichtfest extends HTMLElement {
    constructor() { super(); this._neu = (ev) => { if (ev?.detail?.fehler) this._fehler = Date.now(); this._sig = ''; this._zeichnen(); }; }
    setConfig(c) {
      this._c = { raum: 'gartenhaus', dauer: 'input_number.lichtfest_hochstdauer', ...c };
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      this._sig = '';
    }
    connectedCallback() { window.addEventListener('gg-lichtfest', this._neu); this._takt = setInterval(() => { this._sig = ''; this._zeichnen(); }, 30000); }
    disconnectedCallback() { window.removeEventListener('gg-lichtfest', this._neu); clearInterval(this._takt); }
    getCardSize() { return 8; }
    set hass(h) { this._h = h; this._zeichnen(); }
    _dauer() { const v = parseFloat(this._h?.states?.[this._c.dauer]?.state); return Number.isFinite(v) ? v : 5; }
    _zeichnen() {
      const h = this._h; if (!h || !this.shadowRoot) return;
      const s = stand(h, this._c.raum);
      const d = this._dauer();
      const fehler = this._fehler && Date.now() - this._fehler < 6000;
      const sig = JSON.stringify([s.wert, +s.seit, d, fehler, s.fehlt]);
      if (sig === this._sig) return;
      this._sig = sig;
      const f = fest(s.wert);
      const ende = new Date(+s.seit + d * 3600000);
      const kopf = s.fehlt ? `<div class="kopf"><span class="bild leer"><ha-icon icon="mdi:alert-circle-outline"></ha-icon></span><span class="txt"><b>Noch nicht eingerichtet</b><small>Helfer input_select.lichtfest_${esc(this._c.raum)} fehlt</small></span></div>`
        : f ? `<div class="kopf"><span class="bild" style="background:${verlauf(f)}"><ha-icon icon="${f.icon}"></ha-icon></span>
               <span class="txt"><b>${esc(f.k)} läuft</b><small>seit ${uhr(s.seit)} · endet spätestens ${uhr(ende)}</small></span>
               <button class="ende" data-wert="Aus">Beenden</button></div>`
        : `<div class="kopf"><span class="bild leer"><ha-icon icon="mdi:creation"></ha-icon></span>
               <span class="txt"><b>Kein Anlass aktiv</b><small>Danach kommt dein vorheriges Licht zurück.</small></span></div>`;
      const zeilen = FESTE.map((x) => {
        const an = f && f.k === x.k;
        return `<button class="z${an ? ' an' : ''}" role="listitem" data-wert="${an ? 'Aus' : x.k}" aria-pressed="${an}" aria-label="${esc(x.k)}${an ? ', läuft – antippen zum Beenden' : ''}. ${esc(x.t)}">
          <span class="bild" style="background:${verlauf(x)}"><ha-icon icon="${x.icon}"></ha-icon></span>
          <span class="txt"><b>${esc(x.k)}</b><small>${esc(x.t)}</small></span>
          <span class="haken">${an ? '<ha-icon icon="mdi:check"></ha-icon>' : ''}</span>
        </button>`;
      }).join('');
      this.shadowRoot.innerHTML = `<style>
        :host { display: block; font-family: var(--gg-schrift, -apple-system, Inter, sans-serif); }
        .gruppe { background: var(--gg-zelle, rgba(255,255,255,0.07)); box-shadow: var(--gg-zellschatten, none); border-radius: 26px; overflow: hidden; }
        .gruppe + .gruppe, .hinweis + .gruppe { margin-top: 14px; }
        .kopf, .z, .zeit { display: grid; grid-template-columns: 44px minmax(0,1fr) auto; column-gap: 12px; align-items: center; padding: 10px 16px; min-height: 64px; box-sizing: border-box; }
        .bild { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; line-height: 0; color: #FFFFFF; --mdc-icon-size: 24px; }
        .bild.leer { color: var(--gg-l80, rgba(235,235,245,0.8)); background: var(--gg-f10, rgba(255,255,255,0.1)); }
        .txt { min-width: 0; }
        .txt b { display: block; font-size: 15px; font-weight: 600; line-height: 19px; color: var(--gg-t1, #FFF); }
        .txt small { display: block; font-size: 13px; line-height: 17px; color: var(--gg-wert, rgba(235,235,245,0.64)); margin-top: 1px; }
        .kopf .txt b { font-size: 17px; line-height: 22px; letter-spacing: -0.2px; }
        .ende { all: unset; cursor: pointer; padding: 8px 4px 8px 12px; min-height: 28px; font-size: 15px; font-weight: 600; color: var(--gg-c-rot, #FF453A); -webkit-tap-highlight-color: transparent; }
        .ende:focus-visible, .z:focus-visible, .stepper button:focus-visible { outline: 2px solid var(--gg-c-blau, #0A84FF); outline-offset: -2px; }
        .z { all: unset; box-sizing: border-box; width: 100%; display: grid; grid-template-columns: 44px minmax(0,1fr) 24px; column-gap: 12px; align-items: center;
          min-height: 64px; padding: 10px 16px; position: relative; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .z + .z::before { content: ''; position: absolute; top: 0; left: 72px; right: 0; height: 0.5px; background: var(--gg-trenner, rgba(84,84,88,0.65)); }
        .z:active { background: var(--gg-f07, rgba(255,255,255,0.07)); }
        .haken { color: var(--gg-c-blau, #0A84FF); --mdc-icon-size: 22px; line-height: 0; display: flex; justify-content: flex-end; }
        .hinweis { margin: 8px 16px 0; font-size: 13px; line-height: 17px; color: var(--gg-c-rot, #FF453A); }
        .stepper { display: flex; align-items: center; gap: 4px; }
        .stepper span { min-width: 48px; text-align: center; font-size: 15px; font-weight: 600; color: var(--gg-t1, #FFF); font-variant-numeric: tabular-nums; }
        .stepper button { all: unset; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; line-height: 0;
          background: var(--gg-f12, rgba(255,255,255,0.12)); color: var(--gg-t1, #FFF); --mdc-icon-size: 20px; -webkit-tap-highlight-color: transparent; }
        .stepper button[disabled] { opacity: 0.35; pointer-events: none; }
        .stepper button:active, .z:active .bild { transform: scale(0.94); }
        @media (prefers-reduced-motion: reduce) { .stepper button:active, .z:active .bild { transform: none; } }
      </style>
      <div class="gruppe">${kopf}</div>
      ${fehler ? '<div class="hinweis">Konnte nicht umschalten – bitte erneut versuchen.</div>' : ''}
      <div class="gruppe" role="list">${zeilen}</div>
      <div class="gruppe"><div class="zeit">
        <span class="bild leer"><ha-icon icon="mdi:timer-sand"></ha-icon></span>
        <span class="txt"><b>Automatisch aus</b><small>nach dieser Zeit</small></span>
        <span class="stepper"><button data-d="-1" aria-label="Kürzer" ${d <= 1 ? 'disabled' : ''}><ha-icon icon="mdi:minus"></ha-icon></button><span>${d.toLocaleString('de-DE')} Std.</span><button data-d="1" aria-label="Länger" ${d >= 12 ? 'disabled' : ''}><ha-icon icon="mdi:plus"></ha-icon></button></span>
      </div></div>`;
      this.shadowRoot.querySelectorAll('[data-wert]').forEach((b) => b.addEventListener('click', () => setze(this._h, this._c.raum, b.dataset.wert)));
      this.shadowRoot.querySelectorAll('.stepper button').forEach((b) => b.addEventListener('click', () => {
        const v = Math.min(12, Math.max(1, this._dauer() + Number(b.dataset.d)));
        this._h.callService('input_number', 'set_value', { entity_id: this._c.dauer, value: v });
      }));
    }
  }
  customElements.define('gg-lichtfest-knopf', GgLichtfestKnopf);
  customElements.define('gg-lichtfest', GgLichtfest);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'gg-lichtfest', name: 'gg-lichtfest', description: 'Besondere Anlässe fürs Licht' }, { type: 'gg-lichtfest-knopf', name: 'gg-lichtfest-knopf', description: 'Runder Knopf für besondere Anlässe' });
})();
