/* gg-wecker v6 (29.10.2026: Anzeige und Knöpfe weiter nach oben – die Lautstärke-Anzeige des Nest Hub liegt unten und verdeckte „Schlummern“/„Ausschalten“ beim Lauterwerden).
   v5 – Wecker-Anzeige für den Nest Hub Schlafzimmer (Dashboard nest-schlafzimmer, erstes Blatt „schlafzimmer“).
   v5: Schlummerdauer aus input_number.wecker_schlummerdauer.
   v4: Weckton wie ein gewöhnlicher, moderner Digitalwecker (4 weiche Pieptöne, Pause, wiederholt).
   Klingelt input_boolean.wecker_schlafzimmer_klingelt, legt sich eine Vollbild-Anzeige über das Dashboard:
   Uhrzeit, Art des Weckers, Knöpfe „Schlummern“ und „Ausschalten“. Der Weckton entsteht im Browser (Web Audio, kein Datei-Download).
   v3: Karte gg-uhr-rolle (Uhrzeit-Rollen, siehe unten).
   v2: nach „Wecker stellen“/„Aus“ im Blatt #wecker automatisch zurück zur Startseite.
   Läuft der Ton, meldet das Modul input_boolean.wecker_schlafzimmer_ton_lauft = an – sonst spricht Home Assistant eine Weckansage (Ersatz). */
(() => {
  const w = window;
  if (w.__ggWecker) return;
  w.__ggWecker = true;
  const KL = 'input_boolean.wecker_schlafzimmer_klingelt';
  const ART = 'input_select.wecker_schlafzimmer';
  const TON = 'input_boolean.wecker_schlafzimmer_ton_lauft';
  let gg = null, letzterKey = null, suchZeit = 0, ov = null, uhr = null, titel = null, ctx = null, takt = null, quittiert = 0, gemeldet = false;

  const finde = () => {
    const st = [document.documentElement];
    let n = 0;
    while (st.length && n < 40000) {
      const x = st.pop();
      n++;
      if (x.localName === 'gg-blaetter-view') return x;
      if (x.shadowRoot) for (const c of x.shadowRoot.children) st.push(c);
      for (const c of x.children || []) st.push(c);
    }
    return null;
  };

  const tonAn = (h) => {
    if (ctx) return;
    try {
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const master = ctx.createGain();
      master.connect(ctx.destination);
      const t0 = ctx.currentTime;
      master.gain.setValueAtTime(0.3, t0);
      master.gain.linearRampToValueAtTime(1, t0 + 60);
      /* Weckton v4: gewöhnlicher, moderner Digitalwecker – vier kurze, weiche Pieptöne, kurze Pause, wiederholt alle 1,4 s */
      const piep = (t, laut) => {
        [[1, 1], [2, 0.1], [3, 0.04]].forEach(([fak, anteil]) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = 1480 * fak;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(laut * anteil, t + 0.008);
          g.gain.setValueAtTime(laut * anteil, t + 0.07);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
          o.connect(g);
          g.connect(master);
          o.start(t);
          o.stop(t + 0.13);
        });
      };
      const muster = () => {
        if (!ctx) return;
        const t = ctx.currentTime + 0.05;
        for (let i = 0; i < 4; i++) piep(t + i * 0.16, 0.5);
      };
      muster();
      takt = setInterval(muster, 1400);
      Promise.resolve(ctx.resume && ctx.resume()).catch(() => {});
      setTimeout(() => {
        if (ctx && ctx.state === 'running' && !gemeldet) {
          gemeldet = true;
          try { h.callService('input_boolean', 'turn_on', { entity_id: TON }); } catch (_) {}
        }
      }, 900);
    } catch (_) {}
  };

  const tonAus = () => {
    clearInterval(takt);
    takt = null;
    if (ctx) { try { ctx.close(); } catch (_) {} }
    ctx = null;
    gemeldet = false;
  };

  const zeit = () => {
    const d = new Date();
    return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  const baue = (h) => {
    ov = document.createElement('div');
    ov.setAttribute('data-gg-wecker', '');
    ov.innerHTML = `<style>
      [data-gg-wecker] { position: fixed; inset: 0; z-index: 2147483000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding-bottom: 190px; box-sizing: border-box;
        font-family: var(--gg-schrift, -apple-system, 'Inter', 'Segoe UI', sans-serif); color: #FFFFFF;
        background: linear-gradient(rgba(10, 10, 14, 0.72), rgba(10, 10, 14, 0.82)), var(--gg-bild-weich, none) center / cover no-repeat, #141416;
        animation: ggWRein 0.35s ease; }
      @keyframes ggWRein { from { opacity: 0; } to { opacity: 1; } }
      @keyframes ggWPuls { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
      [data-gg-wecker] .glocke { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(48, 209, 88, 0.22); color: #30D158; animation: ggWPuls 1.5s ease-in-out infinite; }
      [data-gg-wecker] .glocke svg { width: 40px; height: 40px; fill: currentColor; }
      [data-gg-wecker] .uhr { font-size: 130px; font-weight: 200; line-height: 1; letter-spacing: -5px; font-variant-numeric: tabular-nums; }
      [data-gg-wecker] .titel { font-size: 26px; font-weight: 600; color: rgba(235, 235, 245, 0.8); margin-bottom: 18px; }
      [data-gg-wecker] .knoepfe { display: flex; gap: 20px; }
      [data-gg-wecker] button { font: inherit; border: none; outline: none; cursor: pointer; -webkit-tap-highlight-color: transparent; height: 88px; min-width: 300px; padding: 0 34px; border-radius: 44px; font-size: 28px; font-weight: 700; transition: transform 0.12s ease; }
      [data-gg-wecker] button:active { transform: scale(0.95); }
      [data-gg-wecker] .schlummern { color: #FFFFFF; background: rgba(118, 118, 132, 0.42); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16); }
      [data-gg-wecker] .aus { color: #FFFFFF; background: #30D158; box-shadow: 0 0 28px -6px #30D158; }
    </style>
    <div class="glocke"><svg viewBox="0 0 24 24"><path d="M12 20a7 7 0 0 1-7-7 7 7 0 0 1 7-7 7 7 0 0 1 7 7 7 7 0 0 1-7 7m0-16a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9m.5 4H11v6l4.75 2.85.75-1.23-4-2.37V8M7.88 3.39 6.6 1.86 2 5.71l1.29 1.53 4.59-3.85M22 5.72l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72Z"/></svg></div>
    <div class="uhr"></div><div class="titel"></div>
    <div class="knoepfe"><button class="schlummern">Schlummern · 9 Min.</button><button class="aus">Ausschalten</button></div>`;
    uhr = ov.querySelector('.uhr');
    titel = ov.querySelector('.titel');
    const druecke = (skript) => (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      quittiert = Date.now();
      tonAus();
      weg();
      try { (gg && gg._hass ? gg._hass : h).callService('script', 'turn_on', { entity_id: skript }); } catch (_) {}
    };
    ov.querySelector('.aus').addEventListener('click', druecke('script.wecker_schlafzimmer_aus'));
    ov.querySelector('.schlummern').addEventListener('click', druecke('script.wecker_schlafzimmer_schlummern'));
    document.body.appendChild(ov);
  };

  const weg = () => {
    if (ov) { try { ov.remove(); } catch (_) {} }
    ov = null;
  };

  setInterval(() => {
    try {
      if (!gg || !gg.isConnected) {
        if (Date.now() - suchZeit < 4000) return;
        suchZeit = Date.now();
        gg = finde();
        if (!gg) return;
      }
      const h = gg._hass;
      const cfg = gg._cfg;
      const hier = cfg && cfg.vollbild && cfg.seiten && cfg.seiten[0] && cfg.seiten[0].pfad === 'schlafzimmer';
      if (hier && h) {
        const sel = h.states[ART], zt = h.states['input_datetime.wecker_schlafzimmer_zeit'];
        const key = (sel ? sel.state + sel.last_changed : '') + '|' + (zt ? zt.last_updated : '');
        if (letzterKey !== null && key !== letzterKey && location.hash === '#wecker') {
          history.replaceState(null, '', location.pathname + location.search);
          w.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
        }
        letzterKey = key;
      }
      const s = h && h.states[KL];
      if (!hier || !s || s.state !== 'on' || Date.now() - quittiert < 6000) {
        if (ov) weg();
        if (ctx) tonAus();
        return;
      }
      if (!ov) baue(h);
      tonAn(h);
      uhr.textContent = zeit();
      const sd = parseInt((h.states['input_number.wecker_schlummerdauer'] || {}).state, 10) || 9;
      const sk = ov.querySelector('.schlummern');
      if (sk && sk.textContent !== 'Schlummern · ' + sd + ' Min.') sk.textContent = 'Schlummern · ' + sd + ' Min.';
      const a = h.states[ART] ? h.states[ART].state : '';
      titel.textContent = a === 'Büro' ? 'Büro-Wecker' : (a === 'Homeoffice' ? 'Homeoffice-Wecker' : 'Wecker');
    } catch (_) {}
  }, 1000);

  /* ---------------------------------------------------------------- gg-uhr-rolle (v3)
     Uhrzeit-Auswahl als Rollen (wie iOS-Wecker): Stunden 00–23, Minuten 00–59 in 1er-Schritten.
     Wischen nach oben/unten dreht die Rolle (mit Schwung), Antippen einer Zahl springt dorthin.
     Nach dem Einrasten wird input_datetime (entity) gesetzt. Konfiguration: entity, hoehe (Zeilenhöhe, Standard 64). */
  class GgUhrRolle extends HTMLElement {
    setConfig(c) {
      if (!c || !c.entity) throw new Error('entity fehlt');
      this._c = c;
    }
    getCardSize() { return 5; }
    set hass(h) {
      this._h = h;
      if (!this._r) this._baue();
      const s = h.states[this._c.entity];
      if (!s) return;
      const t = String(s.state).split(':');
      const hh = parseInt(t[0], 10), mm = parseInt(t[1], 10);
      if (isNaN(hh) || isNaN(mm)) return;
      const key = hh + ':' + mm;
      if (key === this._ext) return;
      this._ext = key;
      if (this._sendT || Date.now() - (this._gesendet || 0) < 1500) return;
      this._r[0].ziel(hh, !this._erst);
      this._r[1].ziel(mm, !this._erst);
      this._erst = true;
    }
    _baue() {
      const H = this._c.hoehe || 64;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>
        :host { display: block; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
        .feld { position: relative; height: ${H * 5}px; display: flex; justify-content: center; align-items: stretch; gap: 0; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); }
        .band { position: absolute; left: 50%; top: ${H * 2}px; height: ${H}px; width: 520px; transform: translateX(-50%); border-radius: ${H / 2}px;
          background: var(--gg-nestfrost, rgba(118, 118, 132, 0.36)); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 8px 24px rgba(0, 0, 0, 0.16); pointer-events: none; }
        .rolle { position: relative; width: 220px; overflow: hidden; touch-action: none; cursor: grab;
          -webkit-mask-image: linear-gradient(transparent 0%, #000 30%, #000 70%, transparent 100%); mask-image: linear-gradient(transparent 0%, #000 30%, #000 70%, transparent 100%); }
        .zahl { position: absolute; left: 0; right: 0; top: ${H * 2}px; height: ${H}px; line-height: ${H}px; text-align: center; font-size: ${Math.round(H * 0.9)}px; font-weight: 300;
          color: var(--gg-t1, #FFFFFF); font-variant-numeric: tabular-nums; letter-spacing: -1px; will-change: transform, opacity; }
        .doppel { position: relative; width: 60px; height: 100%; display: flex; align-items: center; justify-content: center; font-size: ${Math.round(H * 0.9)}px; font-weight: 300; color: var(--gg-t1, #FFFFFF); padding-bottom: 6px; box-sizing: border-box; }
      </style><div class="feld"><div class="band"></div><div class="rolle"></div><div class="doppel">:</div><div class="rolle"></div></div>`;
      const els = root.querySelectorAll('.rolle');
      this._r = [this._rolle(els[0], 24, H), this._rolle(els[1], 60, H)];
    }
    _rolle(el, n, H) {
      const self = this;
      const slots = [];
      for (let i = 0; i < 9; i++) { const d = document.createElement('div'); d.className = 'zahl'; el.appendChild(d); slots.push(d); }
      const r = { pos: 0, anim: null };
      const mod = (x) => ((x % n) + n) % n;
      const zeichne = () => {
        const basis = Math.floor(r.pos);
        slots.forEach((d, k) => {
          const i = basis - 4 + k;
          const off = i - r.pos;
          d.textContent = String(mod(i)).padStart(2, '0');
          const a = Math.abs(off);
          d.style.transform = `translateY(${off * H}px) scale(${Math.max(0.6, 1 - a * 0.12)})`;
          d.style.opacity = String(Math.max(0, 1 - a * 0.32));
        });
      };
      const stop = () => { if (r.anim) cancelAnimationFrame(r.anim); r.anim = null; };
      const fahre = (ziel, dauer, fertig) => {
        stop();
        const von = r.pos, t0 = performance.now();
        const schritt = (t) => {
          const p = Math.min(1, (t - t0) / dauer);
          const e = 1 - Math.pow(1 - p, 3);
          r.pos = von + (ziel - von) * e;
          zeichne();
          if (p < 1) r.anim = requestAnimationFrame(schritt);
          else { r.anim = null; r.pos = ziel; zeichne(); if (fertig) fertig(); }
        };
        r.anim = requestAnimationFrame(schritt);
      };
      const einrasten = (ziel) => {
        const z = Math.round(ziel);
        fahre(z, Math.min(700, 220 + Math.abs(z - r.pos) * 60), () => self._senden());
      };
      r.wert = () => mod(Math.round(r.pos));
      r.ziel = (v, sofort) => {
        if (r.zieht) return;
        let z = Math.round(r.pos) + (((v - r.wert()) % n) + n) % n;
        if (z - r.pos > n / 2) z -= n;
        if (sofort) { stop(); r.pos = z; zeichne(); } else fahre(z, 350);
      };
      /* Wischen */
      let y0 = 0, p0 = 0, letzteY = 0, letzteT = 0, v = 0, bewegt = false, id = null;
      el.addEventListener('pointerdown', (e) => {
        stop();
        id = e.pointerId;
        try { el.setPointerCapture(id); } catch (_) {}
        r.zieht = true; bewegt = false;
        y0 = letzteY = e.clientY; p0 = r.pos; letzteT = performance.now(); v = 0;
        self._sendT && clearTimeout(self._sendT); self._sendT = null;
      });
      el.addEventListener('pointermove', (e) => {
        if (!r.zieht || e.pointerId !== id) return;
        const t = performance.now();
        const dy = e.clientY - letzteY;
        if (Math.abs(e.clientY - y0) > 6) bewegt = true;
        if (t > letzteT) v = 0.8 * (-dy / H / (t - letzteT)) + 0.2 * v;
        letzteY = e.clientY; letzteT = t;
        r.pos = p0 - (e.clientY - y0) / H;
        zeichne();
      });
      const ende = (e) => {
        if (!r.zieht || (e && e.pointerId !== id)) return;
        r.zieht = false;
        if (!bewegt) {
          const box = el.getBoundingClientRect();
          const off = Math.round((e.clientY - box.top - H * 2.5) / H);
          einrasten(r.pos + off);
          return;
        }
        const alt = performance.now() - letzteT > 80 ? 0 : v;
        einrasten(r.pos + Math.max(-12, Math.min(12, alt * 260)));
      };
      el.addEventListener('pointerup', ende);
      el.addEventListener('pointercancel', ende);
      el.addEventListener('wheel', (e) => { e.preventDefault(); einrasten(Math.round(r.pos) + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
      zeichne();
      return r;
    }
    _senden() {
      clearTimeout(this._sendT);
      this._sendT = setTimeout(() => {
        this._sendT = null;
        if (!this._h || this._r.some((r) => r.zieht || r.anim)) return;
        const hh = this._r[0].wert(), mm = this._r[1].wert();
        const zeit = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':00';
        if (hh + ':' + mm === this._ext) return;
        this._gesendet = Date.now();
        this._ext = hh + ':' + mm;
        try { this._h.callService('input_datetime', 'set_datetime', { entity_id: this._c.entity, time: zeit }); } catch (_) {}
      }, 250);
    }
  }
  if (!customElements.get('gg-uhr-rolle')) customElements.define('gg-uhr-rolle', GgUhrRolle);
})();