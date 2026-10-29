/* gg-push-matrix v2 – Karten custom:gg-push-matrix und custom:gg-pop-zeile
   Jede Push-Art einmal, rechts zwei Schalter nebeneinander (Felix | Laura).
   Konfiguration: { namen: ['Felix','Laura'], zeilen: [{ name, text, icon, farbe, a: 'input_boolean.…', b: 'input_boolean.…' }] } */
(() => {
  const root = document.documentElement;
  class GgPushMatrix extends HTMLElement {
    setConfig(c) {
      if (!c || !Array.isArray(c.zeilen)) throw new Error('zeilen fehlen');
      this._c = c;
    }
    getCardSize() { return this._c.zeilen.length + 1; }
    set hass(h) {
      this._h = h;
      if (!this._r) this._baue();
      this._zeige();
    }
    _baue() {
      const r = this.attachShadow({ mode: 'open' });
      const n = this._c.namen || ['Felix', 'Laura'];
      r.innerHTML = `<style>
        :host { display: block; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; }
        .box { border-radius: 26px; background: var(--gg-zelle, rgba(255, 255, 255, 0.08)); overflow: hidden; }
        .z { position: relative; display: grid; grid-template-columns: 36px minmax(0, 1fr) 48px 48px; column-gap: 10px; align-items: center; padding: 11px 14px; min-height: 34px; }
        .z + .z::before { content: ''; position: absolute; left: 62px; right: 0; top: 0; height: 0.5px; background: var(--gg-trenner, rgba(84, 84, 88, 0.65)); }
        .kopf { padding-top: 12px; padding-bottom: 6px; min-height: 0; }
        .kopf span { font-size: 12.5px; font-weight: 600; letter-spacing: 0.02em; color: var(--gg-l78, rgba(235, 235, 245, 0.78)); text-align: center; }
        .i { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--f); background: color-mix(in srgb, var(--f) 24%, transparent); --mdc-icon-size: 20px; }
        .t { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .t b { font-size: 15px; font-weight: 500; color: var(--gg-t1, #FFFFFF); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .t small { font-size: 12.5px; color: var(--gg-l78, rgba(235, 235, 245, 0.78)); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.25; }
        .c { display: flex; justify-content: center; }
        .sch { position: relative; width: 46px; height: 28px; border-radius: 14px; background: var(--gg-schalter-aus, rgba(120, 120, 128, 0.32)); border: none; padding: 0; cursor: pointer; transition: background 0.25s ease; outline: none; }
        .sch.an { background: var(--gg-schalter-an, #30D158); }
        .sch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15), 0 3px 1px rgba(0, 0, 0, 0.06); transition: left 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
        .sch.an::after { left: 20px; }
        .sch.weg { opacity: 0.3; pointer-events: none; }
      </style><div class="box"><div class="z kopf"><span></span><span></span><span>${n[0]}</span><span>${n[1]}</span></div></div>`;
      this._r = r;
      const box = r.querySelector('.box');
      this._z = this._c.zeilen.map((z) => {
        const el = document.createElement('div');
        el.className = 'z';
        el.style.setProperty('--f', z.farbe || 'var(--gg-c-blau, #0A84FF)');
        el.innerHTML = `<span class="i"><ha-icon icon="${z.icon || 'mdi:bell'}"></ha-icon></span><span class="t"><b>${z.name}</b>${z.text ? `<small>${z.text}</small>` : ''}</span><span class="c"><button class="sch" aria-label="${z.name} ${n[0]}"></button></span><span class="c"><button class="sch" aria-label="${z.name} ${n[1]}"></button></span>`;
        box.appendChild(el);
        const o = { z, el, s: [...el.querySelectorAll('.sch')], gesendet: [0, 0] };
        [z.a, z.b].forEach((ent, k) => {
          o.s[k].addEventListener('click', () => {
            const an = !o.s[k].classList.contains('an');
            o.s[k].classList.toggle('an', an);
            o.gesendet[k] = Date.now();
            this._h.callService('input_boolean', an ? 'turn_on' : 'turn_off', { entity_id: ent });
          });
        });
        return o;
      });
    }
    _zeige() {
      const h = this._h;
      this.toggleAttribute('tag', root.hasAttribute('data-gg-tag'));
      this._z.forEach((o) => {
        [o.z.a, o.z.b].forEach((ent, k) => {
          const st = h.states[ent];
          o.s[k].classList.toggle('weg', !st);
          if (st && Date.now() - o.gesendet[k] > 2500) o.s[k].classList.toggle('an', st.state === 'on');
        });
      });
    }
  }
  if (!customElements.get('gg-push-matrix')) customElements.define('gg-push-matrix', GgPushMatrix);

  /* Eine Zeile im iOS-Stil, die ein Pop-up öffnet. Konfiguration: { name, text, icon, farbe, pfad: '#hash', a: [Entitäten], b: [Entitäten], namen } */
  class GgPopZeile extends HTMLElement {
    setConfig(c) { if (!c || !c.pfad) throw new Error('pfad fehlt'); this._c = c; }
    getCardSize() { return 1; }
    set hass(h) {
      this._h = h;
      if (!this._r) this._baue();
      const c = this._c, n = c.namen || ['Felix', 'Laura'];
      const an = (l) => (l || []).filter((e) => h.states[e] && h.states[e].state === 'on').length;
      const st = this._r.querySelector('small');
      if (c.a && c.b) st.textContent = n[0] + ' ' + an(c.a) + ' von ' + c.a.length + ' · ' + n[1] + ' ' + an(c.b) + ' von ' + c.b.length + ' aktiv';
      this.toggleAttribute('tag', root.hasAttribute('data-gg-tag'));
    }
    _baue() {
      const c = this._c;
      const r = this.attachShadow({ mode: 'open' });
      r.innerHTML = `<style>
        :host { display: block; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; }
        .z { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; column-gap: 12px; align-items: center; padding: 11px 14px; border-radius: 26px; background: var(--gg-zelle, rgba(255, 255, 255, 0.08)); cursor: pointer; transition: background 0.15s ease; --f: ${c.farbe || 'var(--gg-c-blau, #0A84FF)'}; }
        .z:active { background: var(--gg-f14, rgba(255, 255, 255, 0.14)); }
        .i { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--f); background: color-mix(in srgb, var(--f) 24%, transparent); --mdc-icon-size: 20px; }
        .t { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .t b { font-size: 15px; font-weight: 500; color: var(--gg-t1, #FFFFFF); }
        .t small { font-size: 12.5px; color: var(--gg-l78, rgba(235, 235, 245, 0.78)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .p { color: var(--gg-l60, rgba(235, 235, 245, 0.6)); --mdc-icon-size: 22px; display: flex; }
      </style><div class="z"><span class="i"><ha-icon icon="${c.icon || 'mdi:bell-outline'}"></ha-icon></span><span class="t"><b>${c.name}</b><small>${c.text || ''}</small></span><span class="p"><ha-icon icon="mdi:chevron-right"></ha-icon></span></div>`;
      this._r = r;
      r.querySelector('.z').addEventListener('click', () => {
        history.pushState(null, '', c.pfad);
        window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
      });
    }
  }
  if (!customElements.get('gg-pop-zeile')) customElements.define('gg-pop-zeile', GgPopZeile);
})();
