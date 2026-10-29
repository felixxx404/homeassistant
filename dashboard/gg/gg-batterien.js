/* gg-batterien v1 – Karte custom:gg-batterien: alle Batteriestände (sensor.* mit device_class battery) als Apple-Liste.
   Je Gerät ein kleines gezeichnetes Bild (nach Modell: Hue-Dimmschalter, Hue-Taster, Hue-Wandschaltermodul,
   Tür-/Fensterkontakt, Klimasensor mit Display; sonst Batteriesymbol), Name, Raum · Modell, Prozent + Batterie-Glyphe.
   Sortiert nach Ladestand (niedrigster zuerst). Stand ≤ Schwelle: rot + „Bald wechseln“ (nicht nur Farbe).
   Unten: Zeile „Push ab“ mit −/+ (input_number.batterie_warnschwelle). Neue Batterie-Sensoren erscheinen automatisch.
   Konfig: schwelle (Standard input_number.batterie_warnschwelle), ausblenden: [entity_ids]  */
(() => {
  if (customElements.get('gg-batterien')) return;
  const WEG = ['unavailable', 'unknown', ''];
  const KOERPER = 'fill="#F7F7F9" stroke="rgba(0,0,0,0.16)" stroke-width="0.8"';
  const BILD = {
    dimmer: `<rect x="15" y="5" width="14" height="34" rx="4" ${KOERPER}/>
      <rect x="17.2" y="7.6" width="9.6" height="9" rx="2.4" fill="#EDEDF0" stroke="rgba(0,0,0,0.1)" stroke-width="0.6"/>
      <rect x="17.2" y="18.2" width="9.6" height="6.4" rx="1.8" fill="#EDEDF0" stroke="rgba(0,0,0,0.1)" stroke-width="0.6"/>
      <rect x="17.2" y="26.2" width="9.6" height="6.4" rx="1.8" fill="#EDEDF0" stroke="rgba(0,0,0,0.1)" stroke-width="0.6"/>
      <circle cx="22" cy="35.6" r="1.6" fill="#E2E2E6"/>
      <path d="M20.6 12.1h2.8M22 20.1v2.6M20.7 21.4h2.6M20.7 29.4h2.6" stroke="#9A9AA0" stroke-width="0.8" stroke-linecap="round"/>`,
    taster: `<rect x="8" y="8" width="28" height="28" rx="8" ${KOERPER}/>
      <circle cx="22" cy="22" r="9.5" fill="#EFEFF2" stroke="rgba(0,0,0,0.12)" stroke-width="0.7"/>
      <circle cx="22" cy="22" r="6.5" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="1.2"/>`,
    modul: `<path d="M18.5 30c-1 4-2.5 6-5 8M25.5 30c1 4 2.5 6 5 8" fill="none" stroke="#B9B9BF" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="22" cy="20" r="12" ${KOERPER}/>
      <circle cx="22" cy="20" r="2.2" fill="#E2E2E6" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>`,
    kontakt: `<rect x="9" y="7" width="15" height="30" rx="3.5" ${KOERPER}/>
      <rect x="27" y="12" width="8" height="20" rx="2.5" ${KOERPER}/>
      <circle cx="16.5" cy="11.5" r="1" fill="#30D158"/>`,
    klima: `<rect x="8" y="8" width="28" height="28" rx="7" ${KOERPER}/>
      <rect x="11.5" y="11.5" width="21" height="16" rx="2.5" fill="#D7DBD5"/>
      <text x="22" y="22.6" text-anchor="middle" font-size="8.4" font-weight="600" font-family="-apple-system,Inter,sans-serif" fill="#2C2C2E">21°</text>
      <text x="22" y="26.3" text-anchor="middle" font-size="3.4" font-family="-apple-system,Inter,sans-serif" fill="#505055">48 %</text>
      <circle cx="22" cy="31.5" r="1.3" fill="#E2E2E6"/>`,
  };
  const art = (modell, name) => {
    const t = `${modell || ''} ${name || ''}`.toLowerCase();
    if (/dimmer/.test(t)) return 'dimmer';
    if (/smart button|taster/.test(t)) return 'taster';
    if (/wall switch|wandschalter/.test(t)) return 'modul';
    if (/temperature|humidity|klima|thermo/.test(t)) return 'klima';
    if (/door|window|contact|fenster|tür/.test(t)) return 'kontakt';
    return '';
  };
  const ARTNAME = { dimmer: 'Dimmschalter', taster: 'Taster', modul: 'Wandschaltermodul', kontakt: 'Tür-/Fensterkontakt', klima: 'Klimasensor' };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  class GgBatterien extends HTMLElement {
    setConfig(c) {
      this._c = { schwelle: 'input_number.batterie_warnschwelle', ausblenden: [], ...c };
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      this._sig = '';
    }
    getCardSize() { return 6; }
    set hass(h) {
      this._h = h;
      const liste = this._liste();
      const sig = JSON.stringify([liste, this._schwelle()]);
      if (sig === this._sig) return;
      this._sig = sig;
      this._zeichnen(liste);
    }
    _schwelle() {
      const s = parseFloat(this._h?.states?.[this._c.schwelle]?.state);
      return Number.isFinite(s) ? s : 10;
    }
    _liste() {
      const h = this._h; if (!h) return [];
      const aus = new Set(this._c.ausblenden || []);
      const out = [];
      for (const [id, st] of Object.entries(h.states)) {
        if (!id.startsWith('sensor.') || st.attributes.device_class !== 'battery' || aus.has(id)) continue;
        const ent = h.entities?.[id] || {};
        if (ent.hidden) continue;
        const dev = ent.device_id ? h.devices?.[ent.device_id] : null;
        const area = h.areas?.[ent.area_id || dev?.area_id]?.name || '';
        let name = dev ? (dev.name_by_user || dev.name) : (st.attributes.friendly_name || id);
        name = String(name).replace(/\s*(Batterie|Battery|Akku)$/i, '');
        const wert = WEG.includes(st.state) ? null : parseFloat(st.state);
        out.push({ id, name, area, modell: dev?.model || '', art: art(dev?.model, name), wert: Number.isFinite(wert) ? Math.round(wert) : null });
      }
      out.sort((a, b) => (a.wert ?? 999) - (b.wert ?? 999) || a.name.localeCompare(b.name, 'de'));
      return out;
    }
    _farbe(w, s) {
      if (w == null) return 'var(--gg-l55, rgba(235,235,245,0.55))';
      if (w <= s) return 'var(--gg-c-rot, #FF453A)';
      if (w <= Math.max(25, s + 10)) return 'var(--gg-c-orange, #FF9F0A)';
      return 'var(--gg-c-gruen, #30D158)';
    }
    _glyphe(w, farbe) {
      const b = w == null ? 0 : Math.max(1.5, Math.min(100, w) / 100 * 19);
      return `<svg class="gl" viewBox="0 0 27 13" aria-hidden="true"><rect x="0.75" y="0.75" width="22.5" height="11.5" rx="3.4" fill="none" stroke="currentColor" stroke-opacity="0.38" stroke-width="1.2"/><rect x="24.6" y="4.3" width="1.8" height="4.4" rx="0.9" fill="currentColor" fill-opacity="0.38"/><rect x="2.5" y="2.5" width="${b.toFixed(1)}" height="8" rx="1.8" fill="${farbe}"/></svg>`;
    }
    _zeichnen(liste) {
      const s = this._schwelle();
      const leer = liste.filter((g) => g.wert != null && g.wert <= s);
      const weg = liste.filter((g) => g.wert == null);
      const kopf = liste.length === 0 ? 'Keine Batterie-Sensoren gefunden'
        : leer.length ? `${leer.length} ${leer.length === 1 ? 'Batterie' : 'Batterien'} bald wechseln`
        : 'Alle Batterien in Ordnung';
      const unter = liste.length ? `${liste.length} Geräte${weg.length ? ` · ${weg.length} nicht erreichbar` : ''} · Warnung ab ${s.toLocaleString('de-DE')} %` : '';
      const zeilen = liste.map((g) => {
        const f = this._farbe(g.wert, s);
        const tief = g.wert != null && g.wert <= s;
        const zusatz = [g.area, ARTNAME[g.art] || g.modell].filter(Boolean).join(' · ');
        return `<button class="z${tief ? ' tief' : ''}" data-id="${esc(g.id)}" aria-label="${esc(g.name)}: ${g.wert == null ? 'nicht erreichbar' : g.wert + ' Prozent'}${tief ? ', bald wechseln' : ''}">
          <span class="bild">${g.art ? `<svg viewBox="0 0 44 44" aria-hidden="true">${BILD[g.art]}</svg>` : '<ha-icon icon="mdi:battery-outline"></ha-icon>'}</span>
          <span class="txt"><b>${esc(g.name)}</b><small>${tief ? '<em>Bald wechseln</em>' : ''}${tief && zusatz ? ' · ' : ''}${esc(zusatz) || (tief ? '' : 'Batterie')}</small></span>
          <span class="wert" style="color:${tief ? f : 'var(--gg-t1, #FFFFFF)'}">${g.wert == null ? '–' : g.wert + ' %'}</span>
          ${this._glyphe(g.wert, f)}
        </button>`;
      }).join('');
      this.shadowRoot.innerHTML = `<style>
        :host { display: block; font-family: var(--gg-schrift, -apple-system, Inter, sans-serif); --tr: var(--gg-trenner, rgba(84,84,88,0.65)); }
        .gruppe { background: var(--gg-zelle, rgba(255,255,255,0.07)); box-shadow: var(--gg-zellschatten, none); border-radius: 26px; overflow: hidden; }
        .gruppe + .gruppe { margin-top: 14px; }
        .kopf { display: grid; grid-template-columns: 44px minmax(0,1fr); column-gap: 12px; align-items: center; padding: 14px 16px; }
        .kopf .ring { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; line-height: 0;
          color: var(--k); background: color-mix(in srgb, var(--k) 22%, transparent); --mdc-icon-size: 24px; }
        .kopf b { display: block; font-size: 17px; font-weight: 600; line-height: 22px; color: var(--gg-t1, #FFF); letter-spacing: -0.2px; }
        .kopf small { display: block; font-size: 13px; line-height: 17px; color: var(--gg-wert, rgba(235,235,245,0.64)); margin-top: 1px; }
        .z { all: unset; box-sizing: border-box; width: 100%; display: grid; grid-template-columns: 44px minmax(0,1fr) auto 27px; column-gap: 12px; align-items: center;
          min-height: 64px; padding: 10px 16px; position: relative; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .z:active { background: var(--gg-f07, rgba(255,255,255,0.07)); }
        .z:focus-visible { outline: 2px solid var(--gg-c-blau, #0A84FF); outline-offset: -2px; }
        .z + .z::before { content: ''; position: absolute; top: 0; left: 72px; right: 0; height: 0.5px; background: var(--tr); }
        .bild { width: 44px; height: 44px; border-radius: 12px; background: var(--gg-f10, rgba(255,255,255,0.1)); display: flex; align-items: center; justify-content: center; overflow: hidden; line-height: 0;
          color: var(--gg-l80, rgba(235,235,245,0.8)); --mdc-icon-size: 24px; }
        .bild svg { width: 40px; height: 40px; }
        .txt { min-width: 0; }
        .txt b { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 15px; font-weight: 600; line-height: 19px; color: var(--gg-t1, #FFF); overflow: hidden; overflow-wrap: anywhere; }
        .txt small { display: block; font-size: 13px; line-height: 17px; color: var(--gg-wert, rgba(235,235,245,0.64)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
        .txt em { font-style: normal; font-weight: 600; color: var(--gg-c-rot, #FF453A); }
        .wert { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
        .gl { width: 27px; height: 13px; color: var(--gg-t1, #FFF); }
        .schwelle { display: grid; grid-template-columns: 44px minmax(0,1fr) auto; column-gap: 12px; align-items: center; min-height: 60px; padding: 8px 16px; }
        .schwelle .txt small { white-space: normal; }
        .schwelle .bild { color: var(--gg-c-rot, #FF453A); background: color-mix(in srgb, var(--gg-c-rot, #FF453A) 18%, transparent); }
        .stepper { display: flex; align-items: center; gap: 4px; }
        .stepper span { min-width: 48px; text-align: center; font-size: 15px; font-weight: 600; color: var(--gg-t1, #FFF); font-variant-numeric: tabular-nums; }
        .stepper button { all: unset; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; line-height: 0;
          background: var(--gg-f12, rgba(255,255,255,0.12)); color: var(--gg-t1, #FFF); --mdc-icon-size: 20px; -webkit-tap-highlight-color: transparent; }
        .stepper button:active { transform: scale(0.92); }
        .stepper button:focus-visible { outline: 2px solid var(--gg-c-blau, #0A84FF); }
        .stepper button[disabled] { opacity: 0.35; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) { .stepper button:active { transform: none; } }
      </style>
      <div class="gruppe">
        <div class="kopf" style="--k:${leer.length ? 'var(--gg-c-rot, #FF453A)' : 'var(--gg-c-gruen, #30D158)'}">
          <span class="ring"><ha-icon icon="${leer.length ? 'mdi:battery-alert-variant-outline' : 'mdi:battery-check-outline'}"></ha-icon></span>
          <span><b>${kopf}</b><small>${unter}</small></span>
        </div>
      </div>
      ${liste.length ? `<div class="gruppe" role="list">${zeilen}</div>` : ''}
      <div class="gruppe">
        <div class="schwelle">
          <span class="bild"><ha-icon icon="mdi:bell-badge-outline"></ha-icon></span>
          <span class="txt"><b>Push ab</b><small>Mitteilung, sobald ein Gerät diesen Stand erreicht</small></span>
          <span class="stepper"><button data-d="-1" aria-label="Schwelle senken" ${s <= 5 ? 'disabled' : ''}><ha-icon icon="mdi:minus"></ha-icon></button><span>${s.toLocaleString('de-DE')} %</span><button data-d="1" aria-label="Schwelle erhöhen" ${s >= 50 ? 'disabled' : ''}><ha-icon icon="mdi:plus"></ha-icon></button></span>
        </div>
      </div>`;
      this.shadowRoot.querySelectorAll('.z').forEach((b) => b.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: b.dataset.id }, bubbles: true, composed: true }));
      }));
      this.shadowRoot.querySelectorAll('.stepper button').forEach((b) => b.addEventListener('click', () => {
        const st = this._h?.states?.[this._c.schwelle];
        const step = parseFloat(st?.attributes?.step) || 5;
        const v = Math.min(parseFloat(st?.attributes?.max) || 50, Math.max(parseFloat(st?.attributes?.min) || 5, this._schwelle() + step * Number(b.dataset.d)));
        this._h?.callService('input_number', 'set_value', { entity_id: this._c.schwelle, value: v });
      }));
    }
  }
  customElements.define('gg-batterien', GgBatterien);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'gg-batterien', name: 'gg-batterien', description: 'Batteriestände aller Geräte' });
})();
