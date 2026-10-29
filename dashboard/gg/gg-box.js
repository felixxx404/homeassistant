/* gg-box v4 – Stapel/Raster mit eigenen Stilen (ersetzt vertical-stack, horizontal-stack, grid auf dem Wanddisplay).
   card-mod greift im Cast-Empfänger des Nest Hub bei Stapeln nicht zuverlässig – hier wirken Abstände und Höhen sofort.
   Konfiguration: art (vertical-stack | horizontal-stack | grid), columns, square, stil (CSS für :host und #root, Jinja erlaubt), cards.
   v2/v3: card_mod-Stile der direkten Kinder (auch mit Jinja) werden selbst eingesetzt (card-mod lässt sie im Cast teils weg).
   v4: Stile werden dauerhaft nachgeprüft und bei Verlust wieder eingesetzt (HA 2026.10). */
(() => {
  const w = window;
  if (customElements.get('gg-box')) return;
  let helfer = null;
  const holeHelfer = async () => {
    if (helfer) return helfer;
    if (typeof w.loadCardHelpers === 'function') { try { helfer = await w.loadCardHelpers(); return helfer; } catch (_) {} }
    await customElements.whenDefined('hui-card');
    helfer = {
      createCardElement: (conf) => {
        const el = document.createElement('hui-card');
        el.preview = false;
        el.config = conf;
        if (typeof el.load === 'function') el.load();
        return el;
      }
    };
    return helfer;
  };
  const JINJA = /\{\{|\{%/;
  class GgBox extends HTMLElement {
    setConfig(c) {
      if (!c || !Array.isArray(c.cards)) throw new Error('gg-box: cards fehlt');
      const key = JSON.stringify(c);
      if (key === this._key) return;
      this._key = key;
      this._c = c;
      this._abmelden();
      this._aboEnde();
      if (this._gebaut) this._baue();
    }
    set hass(h) {
      this._h = h;
      if (!this._gebaut) this._baue();
      (this._k || []).forEach((e) => { try { e.hass = h; } catch (_) {} });
      this._vorlage();
    }
    getCardSize() { return 4; }
    connectedCallback() {
      this._an = true;
      clearTimeout(this._wegT);
      if (this._abgebaut && this._h) { this._abgebaut = false; this._baue(); }
      this._vorlage();
    }
    disconnectedCallback() {
      this._an = false;
      this._abmelden();
      clearTimeout(this._wegT);
      this._wegT = setTimeout(() => { if (!this._an) { this._aboEnde(); this._abgebaut = true; } }, 5000);
    }
    _abmelden() {
      if (this._unsub) { const u = this._unsub; this._unsub = null; Promise.resolve(u).then((f) => { if (typeof f === 'function') f(); }).catch(() => {}); }
    }
    _baue() {
      this._gebaut = true;
      const c = this._c;
      const r = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const art = c.art || 'vertical-stack';
      let basis = ':host { display: block; }\n#root > hui-card { display: contents; }\n';
      if (art === 'grid') {
        basis += '#root { display: grid; grid-template-columns: repeat(' + (c.columns || 3) + ', minmax(0, 1fr)); gap: var(--grid-card-gap, 8px); }';
        if (c.square !== false) basis += '\n#root > * { aspect-ratio: 1 / 1; }';
      } else if (art === 'horizontal-stack') {
        basis += '#root { display: flex; flex-direction: row; align-items: stretch; gap: var(--horizontal-stack-card-gap, var(--stack-card-gap, 8px)); }\n#root > * { flex: 1 1 0; min-width: 0; }';
      } else {
        basis += '#root { display: flex; flex-direction: column; gap: var(--vertical-stack-card-gap, var(--stack-card-gap, 8px)); }';
      }
      r.innerHTML = '<style>' + basis + '</style><style class="mod"></style><div id="root"></div>';
      this._mod = r.querySelector('style.mod');
      const stil = c.stil || '';
      this._mod.textContent = JINJA.test(stil) ? '' : stil;
      const root = r.querySelector('#root');
      const lauf = (this._lauf = (this._lauf || 0) + 1);
      this._k = [];
      holeHelfer().then((hf) => {
        if (lauf !== this._lauf) return;
        this._k = (c.cards || []).map((cc) => {
          const el = hf.createCardElement(cc);
          if (this._h) el.hass = this._h;
          el.addEventListener('ll-rebuild', (ev) => {
            ev.stopPropagation();
            const i = this._k.indexOf(el);
            if (i < 0) return;
            const neu = hf.createCardElement(cc);
            if (this._h) neu.hass = this._h;
            el.replaceWith(neu);
            this._k[i] = neu;
            this._stile(neu, cc);
          }, { once: true });
          root.appendChild(el);
          this._stile(el, cc);
          return el;
        });
      });
      this._vorlage();
    }
    /* card_mod-Stile der direkten Kinder selbst setzen – wie card-mod: '.' = Schattenwurzel der Karte, 'x$' = Schattenwurzel von x.
       Jinja wird über render_template ausgewertet (card-mod lässt Stile im Cast teils ganz weg). */
    _stile(el, cc) {
      const s = cc && cc.card_mod && cc.card_mod.style;
      if (!s) return;
      const teile = typeof s === 'string' ? { '.': s } : s;
      if (typeof teile !== 'object') return;
      const texte = {};
      const setze = () => {
        const karte = el.localName === 'hui-card' ? (el._element || el.firstElementChild) : el;
        const sr = karte && karte.shadowRoot;
        if (!sr || !sr.querySelector('ha-card')) return false;
        let ok = true;
        Object.keys(texte).forEach((k) => {
          let ziel = sr;
          if (k !== '.') {
            const e = sr.querySelector(k.replace(/\$$/, '').trim());
            if (!e || !e.shadowRoot) { ok = false; return; }
            ziel = e.shadowRoot;
          }
          let st = ziel.querySelector('style[data-gg-box]');
          if (!st) { st = document.createElement('style'); st.setAttribute('data-gg-box', ''); ziel.appendChild(st); }
          if (st.textContent !== texte[k]) st.textContent = texte[k];
        });
        return ok;
      };
      Object.keys(teile).forEach((k) => {
        const css = teile[k];
        if (typeof css !== 'string') return;
        if (!JINJA.test(css)) { texte[k] = css; return; }
        texte[k] = '';
        this._abo(css, (res) => { texte[k] = res; setze(); });
      });
      /* v4: dauerhaft nachprüfen – Stile, die beim Neuaufbau einer Karte verloren gehen, werden wieder eingesetzt */
      let n = 0;
      const versuch = () => {
        n++;
        if (this._k && this._k.length && !this._k.includes(el)) return;
        const ok = setze();
        setTimeout(versuch, ok ? (n < 40 ? 5000 : 30000) : (n < 120 ? 500 : 5000));
      };
      versuch();
    }
    _abo(vorlage, cb) {
      try {
        if (!this._h || !this._h.connection) return;
        const p = this._h.connection.subscribeMessage((m) => {
          if (m && m.result !== undefined && m.result !== null) cb(String(m.result));
        }, { type: 'render_template', template: vorlage, strict: false, report_errors: false });
        (this._abos = this._abos || []).push(p);
      } catch (_) {}
    }
    _aboEnde() {
      (this._abos || []).forEach((p) => { Promise.resolve(p).then((f) => { if (typeof f === 'function') f(); }).catch(() => {}); });
      this._abos = [];
    }
    /* Jinja im Stil wie bei card-mod über render_template auswerten */
    _vorlage() {
      const stil = this._c && this._c.stil;
      if (!this._an || !this._h || !this._mod || this._unsub || !stil || !JINJA.test(stil)) return;
      try {
        this._unsub = this._h.connection.subscribeMessage((m) => {
          if (m && m.result !== undefined && m.result !== null && this._mod) this._mod.textContent = String(m.result);
        }, { type: 'render_template', template: stil, strict: false, report_errors: false });
      } catch (_) {}
    }
  }
  customElements.define('gg-box', GgBox);
  w.customCards = w.customCards || [];
  w.customCards.push({ type: 'gg-box', name: 'gg Box', description: 'Stapel/Raster mit sofort wirksamen Abständen' });
})();
