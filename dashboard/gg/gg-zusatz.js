/* gg-zusatz v3 – ergänzt gg-blaetter:
   gg-kamera-bild: Live-Bild aus Einzelbildern (läuft auch im Cast-Empfänger des Nest Hub, dort bleibt WebRTC/HLS schwarz).
   gg-verlauf: 24-h-Diagramm im Stil von Apple Health.
   Rückkehr zum ersten Blatt (zurueck_nach) sekundengenau statt im 5-s-Takt; Blatt mit bleiben: true kehrt nicht zurück.
   Option melden: true (Vollbild) schreibt einmal die Bildschirmmaße ins Systemprotokoll (Logger gg.nest).
   v3: Schrift wie gg-farben (Inter statt Helvetica/Arial außerhalb von Apple-Geräten, Inter wird geladen),
       Vollbild (Nest Hub): Hintergrund --gg-wand direkt am Element (die Ansicht zeichnet ihn im Cast nicht). */
(() => {
  const w = window;
  if (w.__ggZusatz) return;
  w.__ggZusatz = true;
  const SCHRIFT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif";
  try {
    if (!document.querySelector('link[data-gg-inter]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap';
      l.setAttribute('data-gg-inter', '');
      document.head.appendChild(l);
    }
  } catch (_) {}
  /* Rückkehr-Wache von gg-blaetter jede Sekunde prüfen */
  customElements.whenDefined('gg-blaetter-view').then(() => {
    const P = customElements.get('gg-blaetter-view').prototype;
    if (!P || P.__ggSek || typeof P._wachen !== 'function') return;
    P.__ggSek = true;
    const orig = P._wachen;
    P._wachen = function () {
      orig.apply(this, arguments);
      if (!this.__ggStil) {
        this.__ggStil = true;
        this.style.setProperty('--gg-schrift', SCHRIFT);
        if (this._cfg && this._cfg.vollbild) {
          this.style.background = 'var(--gg-wand, #141416)';
          this.style.minHeight = '100vh';
        }
      }
      if (this._cfg && this._cfg.vollbild && this._cfg.melden && !w.__ggGemeldet) {
        w.__ggGemeldet = true;
        setTimeout(() => {
          try {
            const de = document.documentElement;
            const r = this.getBoundingClientRect();
            const se = this.shadowRoot && this.shadowRoot.querySelector('.seite.aktiv');
            const rs = se ? se.getBoundingClientRect() : null;
            const vv = w.visualViewport;
            const m = { iw: w.innerWidth, ih: w.innerHeight, cw: de.clientWidth, ch: de.clientHeight, sh: de.scrollHeight, dpr: w.devicePixelRatio,
              scr: [screen.width, screen.height], vv: vv ? [vv.width, vv.height, vv.scale] : null,
              gg: [r.left, r.top, r.width, r.height], seite: rs ? [rs.left, rs.top, rs.width, rs.height] : null };
            this._hass.callService('system_log', 'write', { message: 'gg-mass ' + JSON.stringify(m), level: 'warning', logger: 'gg.nest' });
          } catch (_) {}
        }, 6000);
      }
      if (!this._rwI || this._rwI === this._rwSek || !this._cfg || !this._cfg.zurueck_nach) return;
      clearInterval(this._rwI);
      this._rwI = this._rwSek = setInterval(() => {
        if (!this._idx || (!this._cfg.vollbild && location.hash)) return;
        const sd = this._cfg.seiten[this._idx];
        if (sd && sd.bleiben) { this._letzteBed = Date.now(); return; }
        if (Date.now() - (this._letzteBed || 0) < this._cfg.zurueck_nach * 1000) return;
        const b = location.pathname.split('/')[1];
        if (this._cfg.vollbild) history.replaceState(null, '', location.pathname + location.search);
        else history.replaceState(null, '', '/' + b + '/' + this._cfg.seiten[0].pfad);
        w.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
        this._pruefeOrt();
      }, 1000);
    };
  });
  /* ---------------------------------------------------------------- gg-kamera-bild
     Live-Bild ohne Videostrom: lädt fortlaufend Einzelbilder (camera_proxy, verkleinert) und blendet ohne Flackern über.
     Läuft überall, auch im Cast-Empfänger des Nest Hub (dort bleibt WebRTC/HLS schwarz). */
  class GgKameraBild extends HTMLElement {
    setConfig(c) {
      if (!c || !c.entity) throw new Error('entity fehlt');
      this._c = c;
    }
    set hass(h) {
      this._h = h;
      if (!this._box) this._baue();
      if (this._an && !this._t && !this._laedt) this._weiter();
    }
    getCardSize() { return 6; }
    connectedCallback() {
      this._an = true;
      if (this._box && !this._t && !this._laedt) this._weiter();
    }
    disconnectedCallback() {
      this._an = false;
      clearTimeout(this._t); this._t = null;
      this._laedt = false;
      if (this._img) this._img.forEach((i) => { i.onload = i.onerror = null; i.removeAttribute('src'); });
    }
    _baue() {
      const r = this.attachShadow({ mode: 'open' });
      const hoehe = this._c.hoehe ? this._c.hoehe + 'px' : '100%';
      r.innerHTML = `<style>
        :host { display: block; height: ${hoehe}; }
        .box { position: relative; height: 100%; border-radius: 22px; overflow: hidden; background: var(--gg-platzhalter, #000000); }
        img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: ${this._c.fit || 'contain'}; opacity: 0; }
        img.an { opacity: 1; }
        .info { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; font-size: 18px; font-weight: 500; color: var(--gg-l62, rgba(235, 235, 245, 0.62)); transition: opacity 0.3s ease; }
        .info.weg { opacity: 0; pointer-events: none; }
        .rad { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--gg-f12, rgba(255, 255, 255, 0.12)); border-top-color: var(--gg-l62, rgba(235, 235, 245, 0.62)); animation: dreh 0.9s linear infinite; }
        @keyframes dreh { to { transform: rotate(360deg); } }
        .live { position: absolute; top: 12px; left: 12px; display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 8px; border-radius: 999px; font-size: 14px; font-weight: 600; letter-spacing: 0.3px; color: #FFFFFF; background: rgba(0, 0, 0, 0.42); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); opacity: 0; transition: opacity 0.3s ease; }
        .live.an { opacity: 1; }
        .live i { width: 8px; height: 8px; border-radius: 50%; background: #FF453A; }
        .name { position: absolute; left: 12px; bottom: 12px; padding: 4px 10px; border-radius: 999px; font-size: 15px; font-weight: 600; color: #FFFFFF; background: rgba(0, 0, 0, 0.42); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
      </style>
      <div class="box"><img alt=""><img alt=""><div class="info"><div class="rad"></div><span>Verbinde …</span></div>
      <div class="live"><i></i>LIVE</div>${this._c.name ? '<div class="name"></div>' : ''}</div>`;
      this._box = r.querySelector('.box');
      this._img = Array.from(r.querySelectorAll('img'));
      this._info = r.querySelector('.info');
      this._liveEl = r.querySelector('.live');
      const n = r.querySelector('.name');
      if (n) n.textContent = this._c.name;
      this._n = 0;
      this._fehler = 0;
    }
    _url() {
      const s = this._h && this._h.states[this._c.entity];
      const tok = s && s.attributes && s.attributes.access_token;
      if (!tok) return null;
      const p = '/api/camera_proxy/' + this._c.entity + '?token=' + encodeURIComponent(tok) + '&width=' + (this._c.breite || 960) + '&_=' + Date.now();
      try { return typeof this._h.hassUrl === 'function' ? this._h.hassUrl(p) : p; } catch (_) { return p; }
    }
    _weiter() {
      this._t = null;
      if (!this._an || !this._h || !this._box) return;
      if (document.visibilityState === 'hidden') { this._t = setTimeout(() => this._weiter(), 1000); return; }
      const url = this._url();
      if (!url) { this._t = setTimeout(() => this._weiter(), 2000); return; }
      const ziel = this._img[this._n ^ 1];
      const t0 = Date.now();
      this._laedt = true;
      ziel.onload = () => {
        if (!this._an) return;
        this._laedt = false;
        ziel.classList.add('an');
        this._img[this._n].classList.remove('an');
        this._n ^= 1;
        this._fehler = 0;
        this._info.classList.add('weg');
        this._liveEl.classList.add('an');
        const pause = Math.max(0, (this._c.intervall || 250) - (Date.now() - t0));
        this._t = setTimeout(() => this._weiter(), pause);
      };
      ziel.onerror = () => {
        if (!this._an) return;
        this._laedt = false;
        this._fehler++;
        if (this._fehler > 2) {
          this._info.querySelector('span').textContent = 'Keine Verbindung – versuche erneut …';
          this._info.classList.remove('weg');
          this._liveEl.classList.remove('an');
        }
        this._t = setTimeout(() => this._weiter(), Math.min(8000, 1000 * this._fehler));
      };
      ziel.src = url;
    }
  }
  if (!customElements.get('gg-kamera-bild')) customElements.define('gg-kamera-bild', GgKameraBild);

  /* ---------------------------------------------------------------- gg-verlauf
     24-Stunden-Verlauf eines Sensors im Stil von Apple Health: Linie in Ampelfarben (stufen), weiche Fläche,
     Referenzbereich/-linien, Min · Ø · Max. Daten aus der Verlaufsdatenbank, alle 5 Minuten neu. */
  class GgVerlauf extends HTMLElement {
    setConfig(c) {
      if (!c || !c.entity) throw new Error('entity fehlt');
      this._c = Object.assign({ stunden: 24, hoehe: 400, nachkomma: 0, einheit: '' }, c);
    }
    set hass(h) {
      const erst = !this._h;
      this._h = h;
      if (!this.shadowRoot) this._baue();
      if (erst && this._an) this._lade();
    }
    getCardSize() { return 8; }
    connectedCallback() {
      this._an = true;
      if (this._h) this._lade();
      clearInterval(this._iv);
      this._iv = setInterval(() => this._lade(), 300000);
      if (!this._ro && w.ResizeObserver) {
        this._ro = new ResizeObserver(() => this._zeichne());
        this._ro.observe(this);
      }
    }
    disconnectedCallback() {
      this._an = false;
      clearInterval(this._iv); this._iv = null;
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
    }
    _baue() {
      const r = this.attachShadow({ mode: 'open' });
      r.innerHTML = `<style>
        :host { display: block; }
        .karte { box-sizing: border-box; height: ${this._c.hoehe}px; display: flex; flex-direction: column; padding: 18px 20px 14px; border-radius: 28px;
          background: var(--gg-glas, rgba(30, 32, 40, 0.5)); border: none;
          box-shadow: var(--gg-kachelschatten, none); font-family: var(--gg-schrift, inherit); }
        .kopf { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 8px; }
        .titel { font-size: 18px; font-weight: 600; color: var(--gg-t1, #FFFFFF); }
        .werte { display: flex; gap: 18px; font-size: 16px; color: var(--gg-l62, rgba(235, 235, 245, 0.62)); white-space: nowrap; }
        .werte b { font-weight: 600; color: var(--gg-t1, #FFFFFF); font-variant-numeric: tabular-nums; }
        .flaeche { position: relative; flex: 1; min-height: 0; }
        svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
        .leer { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 17px; color: var(--gg-l62, rgba(235, 235, 245, 0.62)); }
        text { font-family: var(--gg-schrift, inherit); font-size: 14px; fill: var(--gg-achse, rgba(235, 235, 245, 0.74)); font-variant-numeric: tabular-nums; }
      </style>
      <div class="karte"><div class="kopf"><span class="titel"></span><span class="werte"></span></div>
      <div class="flaeche"><svg></svg><div class="leer">Lade Verlauf …</div></div></div>`;
      r.querySelector('.titel').textContent = this._c.titel || ('Letzte ' + this._c.stunden + ' Stunden');
      this._svg = r.querySelector('svg');
      this._werte = r.querySelector('.werte');
      this._leer = r.querySelector('.leer');
    }
    _zahl(x) {
      return Number(x).toLocaleString('de-DE', { minimumFractionDigits: this._c.nachkomma, maximumFractionDigits: this._c.nachkomma });
    }
    async _lade() {
      if (!this._h || !this._an || this._holt) return;
      this._holt = true;
      try {
        const ende = new Date();
        const start = new Date(ende.getTime() - this._c.stunden * 3600000);
        const res = await this._h.callWS({
          type: 'history/history_during_period', start_time: start.toISOString(), end_time: ende.toISOString(),
          entity_ids: [this._c.entity], minimal_response: true, no_attributes: true, significant_changes_only: false
        });
        const roh = (res && res[this._c.entity]) || [];
        const p = [];
        roh.forEach((x) => {
          const v = parseFloat(x.s);
          const t = (x.lu || x.lc || 0) * 1000;
          if (!isNaN(v) && t) p.push([Math.max(t, start.getTime()), v]);
        });
        const st = this._h.states[this._c.entity];
        const jetzt = st ? parseFloat(st.state) : NaN;
        if (!isNaN(jetzt)) p.push([ende.getTime(), jetzt]);
        /* gleichmäßig abtasten (letzter bekannter Wert), 5-Minuten-Raster */
        const n = Math.round(this._c.stunden * 12);
        const pts = [];
        let j = 0, last = null;
        for (let i = 0; i <= n; i++) {
          const t = start.getTime() + (ende.getTime() - start.getTime()) * i / n;
          while (j < p.length && p[j][0] <= t) { last = p[j][1]; j++; }
          if (last !== null) pts.push([t, last]);
        }
        this._d = { pts: pts, start: start.getTime(), ende: ende.getTime() };
      } catch (e) {
        this._d = null;
      }
      this._holt = false;
      this._zeichne();
    }
    _skala(lo, hi) {
      if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
      const roh = (hi - lo) / 4;
      const p = Math.pow(10, Math.floor(Math.log10(roh)));
      const f = roh / p;
      const s = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
      return { lo: Math.floor(lo / s) * s, hi: Math.ceil(hi / s) * s, s: s };
    }
    _zeichne() {
      if (!this._svg) return;
      const d = this._d;
      const pts = d && d.pts;
      if (!pts || pts.length < 2) {
        this._svg.innerHTML = '';
        this._leer.textContent = d ? 'Noch keine Daten' : 'Lade Verlauf …';
        this._leer.style.display = '';
        return;
      }
      this._leer.style.display = 'none';
      const W = this._svg.clientWidth, H = this._svg.clientHeight;
      if (W < 50 || H < 50) return;
      const c = this._c;
      const vals = pts.map((x) => x[1]);
      const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const e = c.einheit ? ' ' + c.einheit : '';
      this._werte.innerHTML = `<span>Min <b>${this._zahl(min)}</b></span><span>Ø <b>${this._zahl(avg)}</b></span><span>Max <b>${this._zahl(max)}${e}</b></span>`;
      const pad = Math.max((max - min) * 0.15, c.mindestspanne ? c.mindestspanne / 2 : 1);
      const sk = this._skala(min - pad, max + pad);
      const L = 4, R = 56, T = 10, B = 30;
      const pw = W - L - R, ph = H - T - B;
      const X = (t) => L + (t - d.start) / (d.ende - d.start) * pw;
      const Y = (v) => T + (1 - (v - sk.lo) / (sk.hi - sk.lo)) * ph;
      const id = 'g' + Math.random().toString(36).slice(2, 8);
      let s = '';
      /* Farbverlauf der Linie nach Stufen (Ampel) */
      const stufen = c.stufen || [{ farbe: c.farbe || 'var(--gg-c-hellblau, #64D2FF)' }];
      const yv = (v) => Math.min(1, Math.max(0, (Y(v) - T) / ph));
      let stops = '';
      const sorted = stufen.slice();
      /* von oben (hohe Werte) nach unten */
      let oben = 0;
      for (let i = sorted.length - 1; i >= 0; i--) {
        const unterGrenze = i > 0 ? sorted[i - 1].bis : -Infinity;
        const unten = i > 0 ? yv(unterGrenze) : 1;
        stops += `<stop offset="${oben}" style="stop-color: ${sorted[i].farbe}"/><stop offset="${unten}" style="stop-color: ${sorted[i].farbe}"/>`;
        oben = unten;
      }
      s += `<defs><linearGradient id="${id}l" gradientUnits="userSpaceOnUse" x1="0" y1="${T}" x2="0" y2="${T + ph}">${stops}</linearGradient>
        <linearGradient id="${id}f" gradientUnits="userSpaceOnUse" x1="0" y1="${T}" x2="0" y2="${T + ph}">${stops}</linearGradient>
        <linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <mask id="${id}k"><rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="url(#${id}m)"/></mask></defs>`;
      /* Referenzbereich (z. B. ideale Luftfeuchte) */
      if (c.bereich) {
        const a = Math.max(sk.lo, c.bereich[0]), b = Math.min(sk.hi, c.bereich[1]);
        if (b > a) {
          s += `<rect x="${L}" y="${Y(b)}" width="${pw}" height="${Y(a) - Y(b)}" rx="6" style="fill: var(--gg-f06, rgba(255, 255, 255, 0.06))"/>`;
          if (c.bereich_text) s += `<text x="${L + 10}" y="${Y(b) + 19}" style="fill: var(--gg-l45, rgba(235, 235, 245, 0.45)); font-weight: 600;">${c.bereich_text}</text>`;
        }
      }
      /* Gitter + Achsenbeschriftung rechts */
      for (let v = sk.lo; v <= sk.hi + sk.s / 2; v += sk.s) {
        const y = Y(v);
        s += `<line x1="${L}" x2="${L + pw}" y1="${y}" y2="${y}" style="stroke: var(--gg-gitter, rgba(255, 255, 255, 0.06))" stroke-width="1"/>`;
        s += `<text x="${L + pw + 10}" y="${y + 5}">${this._zahl(v)}</text>`;
      }
      /* Referenzlinien (z. B. CO₂ 1.000 ppm) */
      (c.linien || []).forEach((v) => {
        if (v <= sk.lo || v >= sk.hi) return;
        s += `<line x1="${L}" x2="${L + pw}" y1="${Y(v)}" y2="${Y(v)}" style="stroke: var(--gg-anno, rgba(255, 255, 255, 0.35))" stroke-width="1.5" stroke-dasharray="4 6"/>`;
      });
      /* Zeitachse: volle 6 Stunden */
      const tz = new Date(d.start);
      tz.setMinutes(0, 0, 0);
      for (let k = 0; k < 60 && tz.getTime() < d.ende; k++) {
        tz.setHours(tz.getHours() + 1);
        if (tz.getHours() % 6) continue;
        const x = X(tz.getTime());
        if (x < L + 20 || x > L + pw - 20) continue;
        s += `<line x1="${x}" x2="${x}" y1="${T}" y2="${T + ph}" style="stroke: var(--gg-gitter, rgba(255, 255, 255, 0.06))" stroke-width="1"/>`;
        s += `<text x="${x}" y="${T + ph + 22}" text-anchor="middle">${tz.getHours()} Uhr</text>`;
      }
      /* Linie (leicht geglättet) + Fläche */
      let pfad = '';
      pts.forEach((p, i) => {
        const x = X(p[0]), y = Y(p[1]);
        if (i === 0) { pfad = `M${x.toFixed(1)},${y.toFixed(1)}`; return; }
        const q = pts[i - 1];
        const xm = (X(q[0]) + x) / 2;
        pfad += ` C${xm.toFixed(1)},${Y(q[1]).toFixed(1)} ${xm.toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
      });
      const xe = X(pts[pts.length - 1][0]), ye = Y(pts[pts.length - 1][1]);
      s += `<path d="${pfad} L${xe.toFixed(1)},${T + ph} L${X(pts[0][0]).toFixed(1)},${T + ph} Z" fill="url(#${id}f)" mask="url(#${id}k)"/>`;
      s += `<path d="${pfad}" fill="none" stroke="url(#${id}l)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
      /* aktueller Wert */
      s += `<circle cx="${xe}" cy="${ye}" r="7.5" fill="#FFFFFF" style="filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.25))"/><circle cx="${xe}" cy="${ye}" r="4.5" fill="url(#${id}l)"/>`;
      this._svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      this._svg.innerHTML = s;
    }
  }
  if (!customElements.get('gg-verlauf')) customElements.define('gg-verlauf', GgVerlauf);
  w.customCards = w.customCards || [];
  w.customCards.push({ type: 'gg-kamera-bild', name: 'gg Kamera-Bild', description: 'Live-Bild aus Einzelbildern (Cast-tauglich)' });
  w.customCards.push({ type: 'gg-verlauf', name: 'gg Verlauf', description: '24-h-Verlauf im Apple-Health-Stil' });
})();
