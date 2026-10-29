/* gg-luefter v3 (29.10.2026: Lüfter stand still, wenn die Anlage beim Laden schon lief – die Drehzahl wurde nur auf bereits eingehängte Symbole angewendet, die Karte hängt aber erst nach dem ersten hass-Update im DOM; jetzt auch auf noch nicht eingehängte Symbole und zusätzlich alle 1,5 s) / v2 (28.10.2026: Chip-Hintergrund wie andere Kacheln, Lüfter dreht wieder (Karte wurde vor dem Einhängen aus der Liste gestrichen), Regler größer, Lüfter mittig, Wert unten in der Lücke) / v1 (28.10.2026) – weich drehendes Lüfter-Symbol der Klimaanlage Gartenhaus + runder Temperaturregler
   • Eine gemeinsame Drehzahl (Umdrehungen pro Sekunde) aus der Leistung des Strommessers (wie bisher: < 20 W steht, sonst in 6 Stufen).
     Sie nähert sich dem Ziel exponentiell an (Beschleunigen ca. 1,6 s, Abbremsen ca. 2,6 s) – das Symbol dreht über die Web-Animations-API
     mit veränderter playbackRate, dadurch springt der Winkel nie und die Drehung bricht nicht ab, auch wenn eine Karte neu gezeichnet wird.
   • Hauptdashboard: Die Klima-Kachel (hui-tile-card für climate.klima_gartenhaus_room_temperature) wird über deren updated()-Hook gefunden.
   • custom:gg-klima-chip – Klima-Kachel der Nest-Startseite (ersetzt die Markdown-Karte, deren Symbol bei jedem Neuzeichnen von vorn begann).
   • custom:gg-klima-dial – runder Schieberegler (Thermostat) mit drehendem Lüfter in der Mitte; setzt die Wunschtemperatur.
   Bewegung reduzieren (prefers-reduced-motion): das Symbol bleibt stehen. */
(() => {
  if (window.__ggLuefter) return;
  const KLIMA = 'climate.klima_gartenhaus_room_temperature';
  const LEISTUNG = 'sensor.gartenhaus_klima_strommesser_leistung';
  const WUNSCH = 'input_number.klima_wunschtemperatur_raum';
  const REGELUNG = 'input_boolean.klima_raumfuhler_regelung';
  const RAUM = 'sensor.gartenhaus_thermostat_gartenhaus_temperatur';
  const root = document.documentElement;
  const reduziert = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- gemeinsame Drehzahl ---------- */
  const E = { v: 0, z: 0, t: 0, lauf: false, init: false, liste: new Set() };
  const anwenden = () => {
    E.liste.forEach((a) => {
      if (!a.el.isConnected) { if (a.gesehen) { E.liste.delete(a); try { a.anim.cancel(); } catch (_) { /* weg */ } return; } }
      else a.gesehen = true; /* noch nicht eingehängte Symbole bekommen Drehzahl und Lauf trotzdem (v3) */
      if (E.v < 0.004) { if (a.anim.playState === 'running') a.anim.pause(); }
      else { a.anim.playbackRate = E.v; if (a.anim.playState !== 'running') a.anim.play(); }
    });
  };
  const tick = (jetzt) => {
    const dt = Math.min(Math.max((jetzt - E.t) / 1000, 0), 0.1);
    E.t = jetzt;
    const tau = E.z > E.v ? 1.6 : 2.6;
    E.v += (E.z - E.v) * (1 - Math.exp(-dt / tau));
    if (Math.abs(E.z - E.v) < 0.004) E.v = E.z;
    anwenden();
    if (E.v !== E.z) requestAnimationFrame(tick); else E.lauf = false;
  };
  const setzeZiel = (z) => {
    if (!E.init) { E.init = true; E.z = E.v = z; anwenden(); return; } /* beim Laden sofort mit Zielgeschwindigkeit */
    if (z === E.z) return;
    E.z = z;
    if (!E.lauf) { E.lauf = true; E.t = performance.now(); requestAnimationFrame(tick); }
  };
  const hassUpdate = (h) => {
    if (!h || !h.states) return;
    const s = h.states[LEISTUNG];
    const p = s ? parseFloat(s.state) : NaN;
    let z = 0;
    if (isFinite(p) && p >= 20) z = 1 / (p < 150 ? 3.0 : p < 350 ? 2.2 : p < 600 ? 1.6 : p < 900 ? 1.1 : p < 1300 ? 0.8 : 0.6);
    if (reduziert()) z = 0;
    setzeZiel(z);
  };
  const binde = (el) => {
    for (const a of E.liste) if (a.el === el) return a;
    const anim = el.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 1000, iterations: Infinity, easing: 'linear' });
    anim.playbackRate = Math.max(E.v, 0.001);
    if (E.v < 0.004) anim.pause();
    const a = { el, anim };
    E.liste.add(a);
    return a;
  };
  window.__ggLuefter = { hass: hassUpdate, binde, rate: () => E.v };

  /* ---------- Hauptdashboard: Klima-Kachel ---------- */
  const hassGlobal = () => {
    const e = document.querySelector('home-assistant') || document.querySelector('hc-main');
    return e && e.hass;
  };
  const anKachel = (kachel) => {
    const c = kachel._config;
    if (!c || c.entity !== KLIMA || !kachel.shadowRoot) return;
    const icon = kachel.shadowRoot.querySelector('ha-tile-icon ha-state-icon');
    if (!icon) return;
    icon.style.transformOrigin = '50% 50%';
    binde(icon);
    hassUpdate(kachel.hass || hassGlobal());
  };
  customElements.whenDefined('hui-tile-card').then(() => {
    const P = customElements.get('hui-tile-card').prototype;
    if (P.__ggLf) return;
    P.__ggLf = true;
    const u = P.updated;
    P.updated = function (c) {
      if (u) u.call(this, c);
      try { anKachel(this); } catch (e) { console.warn('gg-luefter', e); }
    };
  });
  setInterval(() => { if (E.liste.size) { hassUpdate(hassGlobal()); anwenden(); } }, 1500);

  /* ---------- Hilfen für die Karten ---------- */
  const MODI = { off: 'Aus', heat: 'Heizt', cool: 'Kühlt', dry: 'Trocknet', fan_only: 'Lüftet', auto: 'Automatik', heat_cool: 'Automatik' };
  const FARBE = { heat: 'var(--gg-c-orange, #FF9F0A)', cool: 'var(--gg-c-hellblau, #64D2FF)', dry: 'var(--gg-c-blau, #0A84FF)', fan_only: 'var(--gg-c-gruen, #30D158)', heat_cool: 'var(--gg-c-lila, #BF5AF2)', auto: 'var(--gg-c-lila, #BF5AF2)' };
  const komma = (x, n) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  const zahl = (s) => { const x = parseFloat(s); return isFinite(x) ? x : null; };
  const wunschVon = (h, c) => {
    const reg = h.states[c.regelung];
    const mit = !reg || reg.state === 'on';
    const k = h.states[c.klima];
    const s = mit ? h.states[c.wunsch] : null;
    return zahl(s ? s.state : k && k.attributes ? k.attributes.temperature : null);
  };

  /* ---------- custom:gg-klima-chip (Nest-Startseite) ---------- */
  class GgKlimaChip extends HTMLElement {
    setConfig(c) { this._c = Object.assign({ klima: KLIMA, wunsch: WUNSCH, regelung: REGELUNG }, c); }
    getCardSize() { return 2; }
    set hass(h) {
      this._h = h;
      if (!this._r) {
        this._r = this.attachShadow({ mode: 'open' });
        this._r.innerHTML = `<style>
          :host { display: block; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); }
          em { font-style: normal; display: block; }
          span { box-sizing: border-box; height: 96px; display: grid; grid-template-columns: 54px minmax(0, 1fr); grid-template-rows: auto auto; column-gap: 14px; align-items: center; padding: 14px 16px; border-radius: 22px; background: var(--gg-nestfrost, rgba(118, 118, 132, 0.36)); border: none; box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.16), 0 8px 24px rgba(0, 0, 0, 0.16); transition: background 0.3s ease; }
          ha-icon { grid-row: 1 / 3; --mdc-icon-size: 28px; width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--gg-c); background: color-mix(in srgb, var(--gg-c) 18%, transparent); line-height: 0; }
          b { grid-column: 2; grid-row: 2; font-size: 24px; font-weight: 500; line-height: 1.15; color: var(--gg-wert, rgba(235, 235, 245, 0.55)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          small { grid-column: 2; grid-row: 1; font-size: 18px; font-weight: 600; line-height: 1.2; color: var(--gg-t1, #FFFFFF); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          em.an ha-icon { color: #FFFFFF; background: var(--gg-c); }
        </style><em><span><ha-icon icon="mdi:fan"></ha-icon><b></b><small></small></span></em>`;
        binde(this._r.querySelector('ha-icon'));
      }
      hassUpdate(h);
      const c = this._c, r = this._r;
      const k = h.states[c.klima] ? h.states[c.klima].state : 'unavailable';
      const an = k in MODI && k !== 'off';
      const t = wunschVon(h, c);
      r.querySelector('em').classList.toggle('an', an);
      r.querySelector('span').style.setProperty('--gg-c', FARBE[k] || 'var(--gg-l78, rgba(235, 235, 245, 0.78))');
      r.querySelector('b').textContent = an ? (t !== null ? komma(t, 1).replace(/,0$/, '') + '°' : 'An') : 'Aus';
      r.querySelector('small').textContent = an ? 'Klima ' + (MODI[k] || '').toLowerCase() : 'Klimaanlage';
    }
  }
  if (!customElements.get('gg-klima-chip')) customElements.define('gg-klima-chip', GgKlimaChip);

  /* ---------- custom:gg-klima-dial (Nest Klima-Seite) ---------- */
  const W = 340, CX = 170, CY = 170, R = 140, SW = 18, START = 225, SWEEP = 270;
  const pol = (a, r) => { const w = a * Math.PI / 180; return [CX + r * Math.sin(w), CY - r * Math.cos(w)]; };
  const bogen = (a0, a1) => {
    const [x0, y0] = pol(a0, R), [x1, y1] = pol(a1, R);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  class GgKlimaDial extends HTMLElement {
    setConfig(c) { this._c = Object.assign({ klima: KLIMA, wunsch: WUNSCH, regelung: REGELUNG, raum: RAUM, hoehe: 490 }, c); }
    getCardSize() { return 6; }
    set hass(h) {
      this._h = h;
      if (!this._r) this._baue();
      hassUpdate(h);
      this._zeige();
    }
    _grenzen() {
      const s = this._h.states[this._c.wunsch], a = (s && s.attributes) || {};
      const k = this._h.states[this._c.klima], ka = (k && k.attributes) || {};
      const mit = !this._h.states[this._c.regelung] || this._h.states[this._c.regelung].state === 'on';
      return mit && s ? { min: a.min != null ? a.min : 10, max: a.max != null ? a.max : 30, st: a.step || 0.5, mit } : { min: ka.min_temp != null ? ka.min_temp : 10, max: ka.max_temp != null ? ka.max_temp : 30, st: ka.target_temp_step || 1, mit };
    }
    _baue() {
      const r = this._r = this.attachShadow({ mode: 'open' });
      const [sx, sy] = pol(START, R), [ex, ey] = pol(START + SWEEP, R);
      const hh = Number(this._c.hoehe) || 490, dd = hh - 32;
      r.innerHTML = `<style>
        :host { display: block; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; }
        .k { height: ${hh}px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; }
        .d { position: relative; flex: none; width: min(100%, ${dd}px); aspect-ratio: 1 / 1; --u: 1; --f: var(--gg-l78, rgba(235, 235, 245, 0.78)); }
        .zeile { flex: none; margin-top: 8px; font-size: 16px; line-height: 22px; font-weight: 500; text-align: center; color: var(--gg-l80, rgba(235, 235, 245, 0.8)); white-space: nowrap; font-variant-numeric: tabular-nums; }
        svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; touch-action: none; cursor: pointer; }
        .spur { fill: none; stroke: var(--gg-f12, rgba(255, 255, 255, 0.12)); stroke-width: ${SW}; stroke-linecap: round; }
        .an { fill: none; stroke: var(--f); stroke-width: ${SW}; stroke-linecap: round; }
        .knopf { fill: var(--f); stroke: #FFFFFF; stroke-width: 3.5; filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35)); }
        .luefter { position: absolute; left: 50%; top: 50%; width: calc(150px * var(--u)); height: calc(150px * var(--u)); margin: calc(-75px * var(--u)) 0 0 calc(-75px * var(--u)); display: flex; align-items: center; justify-content: center; color: var(--f); --mdc-icon-size: calc(140px * var(--u)); pointer-events: none; line-height: 0; }
        .luefter ha-icon { width: calc(140px * var(--u)); height: calc(140px * var(--u)); display: flex; }
        .wert { position: absolute; left: 0; right: 0; top: 87%; transform: translateY(-50%); text-align: center; pointer-events: none; color: var(--gg-t1, #FFFFFF); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .wert b { font-size: calc(52px * var(--u)); font-weight: 700; letter-spacing: -1.5px; line-height: 1.1; }
        .wert u { text-decoration: none; font-size: calc(26px * var(--u)); font-weight: 600; margin-left: 3px; color: var(--gg-l78, rgba(235, 235, 245, 0.78)); }
        .modus { position: absolute; left: 0; right: 0; top: 24%; transform: translateY(-50%); text-align: center; pointer-events: none; font-size: calc(21px * var(--u)); line-height: 1.2; font-weight: 700; color: var(--f); white-space: nowrap; }
        .aus .luefter { opacity: 0.55; }
      </style><div class="k"><div class="d"><svg viewBox="0 0 ${W} ${W}" role="slider" aria-label="Wunschtemperatur" tabindex="0">
        <path class="spur" d="${bogen(START, START + SWEEP)}"/><path class="an" d="${bogen(START, START + 1)}"/>
        <circle class="knopf" r="16" cx="${sx}" cy="${sy}"/>
      </svg><div class="luefter"><ha-icon icon="mdi:fan"></ha-icon></div>
      <div class="wert"><b></b><u>°C</u></div><div class="modus"></div></div><div class="zeile"></div></div>`;
      try { const dEl = r.querySelector('.d'); new ResizeObserver(() => { const w = dEl.getBoundingClientRect().width; if (w) dEl.style.setProperty('--u', (w / W).toFixed(3)); }).observe(dEl); } catch (_) { /* ohne Skalierung */ }
      this._svg = r.querySelector('svg');
      this._an = r.querySelector('.an');
      this._kn = r.querySelector('.knopf');
      binde(r.querySelector('.luefter ha-icon'));
      const wert = (ev) => {
        const b = this._svg.getBoundingClientRect(), f = W / b.width;
        const x = (ev.clientX - b.left) * f - CX, y = (ev.clientY - b.top) * f - CY;
        let a = Math.atan2(x, -y) * 180 / Math.PI;
        if (a < 0) a += 360;
        let rel = a - START;
        if (rel < 0) rel += 360;
        if (rel > SWEEP) rel = (rel - SWEEP) < (360 - SWEEP) / 2 ? SWEEP : 0;
        const g = this._grenzen();
        const v = g.min + (rel / SWEEP) * (g.max - g.min);
        return Math.max(g.min, Math.min(g.max, Math.round(v / g.st) * g.st));
      };
      const treffer = (ev) => {
        const b = this._svg.getBoundingClientRect(), f = W / b.width;
        const x = (ev.clientX - b.left) * f - CX, y = (ev.clientY - b.top) * f - CY;
        const d = Math.hypot(x, y);
        if (!(d > R - 52 && d < R + 40)) return false;
        let a = Math.atan2(x, -y) * 180 / Math.PI;
        if (a < 0) a += 360;
        let rel = a - START;
        if (rel < 0) rel += 360;
        return rel <= SWEEP + 14 || rel >= 360 - 14; /* nicht in der Lücke unten */
      };
      this._svg.addEventListener('pointerdown', (ev) => {
        if (!treffer(ev)) return;
        this._zieht = true;
        try { this._svg.setPointerCapture(ev.pointerId); } catch (_) { /* egal */ }
        this._lokal = wert(ev);
        this._zeige();
      });
      this._svg.addEventListener('pointermove', (ev) => {
        if (!this._zieht) return;
        this._lokal = wert(ev);
        this._zeige();
      });
      const ende = () => {
        if (!this._zieht) return;
        this._zieht = false;
        this._gesendet = Date.now();
        this._sende(this._lokal);
      };
      this._svg.addEventListener('pointerup', ende);
      this._svg.addEventListener('pointercancel', ende);
      this._svg.addEventListener('keydown', (ev) => {
        const g = this._grenzen();
        const aktuell = this._lokal != null && Date.now() - (this._gesendet || 0) < 2500 ? this._lokal : wunschVon(this._h, this._c);
        const d = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? g.st : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -g.st : 0;
        if (!d || aktuell === null) return;
        ev.preventDefault();
        this._lokal = Math.max(g.min, Math.min(g.max, aktuell + d));
        this._gesendet = Date.now();
        clearTimeout(this._kt);
        this._kt = setTimeout(() => this._sende(this._lokal), 500);
        this._zeige();
      });
    }
    _sende(v) {
      if (v == null) return;
      const g = this._grenzen();
      if (g.mit) this._h.callService('input_number', 'set_value', { entity_id: this._c.wunsch, value: Number(v.toFixed(2)) });
      else this._h.callService('climate', 'set_temperature', { entity_id: this._c.klima, temperature: Math.round(v) });
    }
    _zeige() {
      const h = this._h, c = this._c, r = this._r;
      const k = h.states[c.klima] ? h.states[c.klima].state : 'unavailable';
      const g = this._grenzen();
      const frisch = this._zieht || Date.now() - (this._gesendet || 0) < 2500;
      const t = frisch && this._lokal != null ? this._lokal : wunschVon(h, c);
      const d = r.querySelector('.d');
      d.style.setProperty('--f', k === 'off' || !(k in MODI) ? 'var(--gg-l62, rgba(235, 235, 245, 0.62))' : FARBE[k]);
      d.classList.toggle('aus', k === 'off');
      const p = t === null ? 0 : Math.max(0, Math.min(1, (t - g.min) / ((g.max - g.min) || 1)));
      const a1 = START + Math.max(0.01, SWEEP * p);
      this._an.setAttribute('d', bogen(START, a1));
      const [kx, ky] = pol(START + SWEEP * p, R);
      this._kn.setAttribute('cx', kx.toFixed(2)); this._kn.setAttribute('cy', ky.toFixed(2));
      r.querySelector('.wert b').textContent = t === null ? '–' : komma(t, 1);
      const raum = zahl((h.states[c.raum] || {}).state), kl = h.states[c.klima], dev = zahl(kl && kl.attributes ? kl.attributes.current_temperature : null);
      r.querySelector('.modus').textContent = MODI[k] || '–';
      r.querySelector('.zeile').textContent = (raum !== null ? 'Raum ' + komma(raum, 1) + '°' : '') + (raum !== null && dev !== null ? ' · ' : '') + (dev !== null ? 'Gerät ' + komma(dev, 0) + '°' : '');
      this._svg.setAttribute('aria-valuenow', t === null ? '' : String(t));
      this._svg.setAttribute('aria-valuemin', String(g.min)); this._svg.setAttribute('aria-valuemax', String(g.max));
      this._svg.setAttribute('aria-valuetext', t === null ? '' : komma(t, 1) + ' Grad');
    }
  }
  if (!customElements.get('gg-klima-dial')) customElements.define('gg-klima-dial', GgKlimaDial);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'gg-klima-dial', name: 'Klima: runder Regler', description: 'Thermostat-Dial mit drehendem Lüfter' });
  window.customCards.push({ type: 'gg-klima-chip', name: 'Klima: Kachel', description: 'Klima-Kachel mit drehendem Lüfter (Nest)' });
  window.__ggLuefter.ok = true;
})();