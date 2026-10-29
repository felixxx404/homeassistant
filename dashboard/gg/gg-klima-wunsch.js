/* gg-klima-wunsch v1 – Kachel-Feature (Tile-Feature) „Wunschtemperatur Raum“ für die Klimaanlage.
   Zeigt input_number.klima_wunschtemperatur_raum mit − / + und ruft script.nest_klima_temperatur (schritt ±0,5) auf.
   Verwendung in den features einer Tile-Karte: { type: 'custom:gg-klima-wunsch' }
   Optionen: wunsch, skript, schritt */
(() => {
  if (customElements.get('gg-klima-wunsch')) return;
  const CSS = `
    :host { display: block; height: var(--feature-height, 42px); }
    .box { display: flex; align-items: center; height: 100%; border-radius: var(--feature-border-radius, 12px); background: color-mix(in srgb, var(--disabled-color, #6F6F6F) 20%, transparent); overflow: hidden; color: var(--primary-text-color, #FFFFFF); font-family: inherit; }
    .box.matt b { opacity: 0.35; }
    button { all: unset; box-sizing: border-box; flex: 0 0 33.333%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: inherit; color: var(--gg-l85, rgba(235, 235, 245, 0.85)); --mdc-icon-size: 20px; -webkit-tap-highlight-color: transparent; }
    button:active { background: color-mix(in srgb, var(--gg-t1, #FFFFFF) 14%, transparent); }
    b { flex: 1 1 auto; text-align: center; font-size: 14px; font-weight: 500; white-space: nowrap; font-variant-numeric: tabular-nums; }
  `;
  class GgKlimaWunsch extends HTMLElement {
    static getStubConfig() { return { type: 'custom:gg-klima-wunsch' }; }
    setConfig(c) {
      if (!c) throw new Error('Konfiguration fehlt');
      this._c = { wunsch: 'input_number.klima_wunschtemperatur_raum', skript: 'script.nest_klima_temperatur', schritt: 0.5, ...c };
    }
    set context(v) { this._ctx = v; this._zeige(); }
    set stateObj(v) { this._so = v; this._zeige(); }
    set hass(h) { this._h = h; this._zeige(); }
    _baue() {
      const r = this.attachShadow({ mode: 'open' });
      r.innerHTML = `<style>${CSS}</style><div class="box"><button id="m" aria-label="Wunschtemperatur senken"><ha-icon icon="mdi:minus"></ha-icon></button><b id="w">– °C</b><button id="p" aria-label="Wunschtemperatur erhöhen"><ha-icon icon="mdi:plus"></ha-icon></button></div>`;
      r.getElementById('m').addEventListener('click', (e) => { e.stopPropagation(); this._schritt(-1); });
      r.getElementById('p').addEventListener('click', (e) => { e.stopPropagation(); this._schritt(1); });
      this._r = r;
    }
    _schritt(richtung) {
      if (!this._h || !this._c) return;
      const st = this._h.states[this._c.wunsch];
      const s = Number(this._c.schritt) * richtung;
      if (st) {
        const v = parseFloat(st.state);
        const min = Number(st.attributes.min ?? 10), max = Number(st.attributes.max ?? 30);
        if (isFinite(v)) this._lokal = Math.min(max, Math.max(min, (this._lokal ?? v) + s));
        clearTimeout(this._lt);
        this._lt = setTimeout(() => { this._lokal = null; this._zeige(); }, 4000);
        this._zeige();
      }
      const [d, n] = this._c.skript.split('.');
      if (d === 'script') this._h.callService('script', n, { schritt: s });
    }
    _zeige() {
      if (!this._c || !this._h) return;
      if (!this._r) this._baue();
      const st = this._h.states[this._c.wunsch];
      const v = this._lokal ?? (st ? parseFloat(st.state) : NaN);
      this._r.getElementById('w').textContent = isFinite(v) ? `${String(v).replace('.', ',')} °C` : '– °C';
      const id = (this._ctx && this._ctx.entity_id) || (this._so && this._so.entity_id);
      const kl = id && this._h.states[id];
      this._r.querySelector('.box').classList.toggle('matt', !!kl && kl.state === 'dry');
    }
  }
  customElements.define('gg-klima-wunsch', GgKlimaWunsch);
  window.customCardFeatures = window.customCardFeatures || [];
  window.customCardFeatures.push({ type: 'gg-klima-wunsch', name: 'Wunschtemperatur (Raum)', supported: () => true, configurable: false });
})();
