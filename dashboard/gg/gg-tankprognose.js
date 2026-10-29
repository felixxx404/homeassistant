/* gg-tankprognose v6 (Überschrift im Kompaktmodus größer und dunkelgrau, einheitlich mit den Werten) / v5 – Kompaktmodus: optional `einstellungen: '#hash'` → kleiner runder Knopf mit Zahnrad oben rechts (öffnet das Blatt).
   v4 – (v4: Kompaktmodus ohne Symbolkreis und Großbuchstaben, Apple-Listenstil)
   v3 – Tank-Prognose aus den eigenen Tankerkönig-Preisen (Langzeitstatistik, stündlich).
   v3: `kompakt: true` – nur eine Zeile „Nächster Tank-Stopp“ (ohne Balken, Tabellen, Hinweis).
   v2: optional `tank: { prozent, liter, reichweite, tage }` (Mercedes) – dann steht oben der beste Tank-Stopp bis zur Frist. */
(() => {
  if (customElements.get('gg-tankprognose')) return;
  const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const mittel = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  const preis = (p) => {
    const t = p.toFixed(3);
    return t.slice(0, -1).replace('.', ',') + '<sup>' + t.slice(-1) + '</sup> €';
  };
  const cent = (d) => (d > 0.0005 ? '+' : d < -0.0005 ? '−' : '±') + Math.abs(d * 100).toFixed(1).replace('.', ',') + ' ct';
  const CSS = `
    :host { display: block; }
    ha-card { box-sizing: border-box; padding: 14px 16px 16px; border-radius: 27px !important; border: none !important; overflow: hidden;
      background: var(--gg-zelle, rgba(255, 255, 255, 0.08)) !important; box-shadow: var(--gg-zellschatten, none) !important;
      color: var(--gg-t1, #FFFFFF); font-family: var(--gg-schrift, inherit); }
    .kopf { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
    .kopf span { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }
    .kopf em { font-style: normal; font-size: 11px; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }
    .haupt { display: flex; gap: 12px; align-items: center; }
    .haupt ha-icon { flex: 0 0 44px; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; --mdc-icon-size: 22px;
      color: var(--farbe); background: color-mix(in srgb, var(--farbe) 18%, transparent); }
    .haupt.jetzt ha-icon { color: #FFFFFF; background: var(--farbe); box-shadow: 0 0 18px -3px var(--farbe); }
    .haupt div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .haupt small { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--farbe); }
    .haupt b { font-size: 17px; font-weight: 600; line-height: 21px; }
    .haupt p { margin: 0; font-size: 13px; line-height: 17px; color: var(--gg-wert, rgba(235, 235, 245, 0.55)); }
    sup { font-size: 0.62em; margin-left: 1px; }
    .balken { display: flex; align-items: flex-end; gap: 3px; height: 64px; margin: 16px 0 4px; }
    .balken i { flex: 1 1 0; min-height: 3px; border-radius: 3px; background: var(--gg-l22, rgba(235, 235, 245, 0.22)); position: relative; }
    .balken i.g { background: var(--gg-c-gruen, #30D158); }
    .balken i.r { background: var(--gg-c-rot, #FF453A); opacity: 0.85; }
    .balken i.n::after { content: ''; position: absolute; left: 50%; bottom: -7px; width: 4px; height: 4px; margin-left: -2px; border-radius: 50%; background: var(--gg-t1, #FFFFFF); }
    .achse { display: flex; justify-content: space-between; font-size: 10px; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); margin-top: 8px; }
    .zeilen { display: grid; gap: 0; margin-top: 12px; }
    .zeilen div { display: flex; justify-content: space-between; align-items: center; gap: 10px; min-height: 34px; border-top: 0.5px solid var(--gg-trenner, rgba(84, 84, 88, 0.65)); font-size: 13px; }
    .zeilen span { color: var(--gg-l85, rgba(235, 235, 245, 0.85)); }
    .zeilen b { font-weight: 600; text-align: right; }
    .zeilen b.g { color: var(--gg-c-gruen, #30D158); }
    .zeilen b.r { color: var(--gg-c-rot, #FF453A); }
    .tank { margin-bottom: 14px; padding-bottom: 14px; border-bottom: 0.5px solid var(--gg-trenner, rgba(84, 84, 88, 0.65)); }
    .tank .info { margin: 8px 0 0 56px; font-size: 12px; color: var(--gg-wert, rgba(235, 235, 245, 0.55)); }
    .tank.k { margin: 0; padding: 0; border: none; }
    ha-card.k { padding: 14px 16px; }
    /* v4: kompakt ruhig – Symbol ohne Kreis, Überschrift normal geschrieben und grau, Farbe nur am Symbol */
    ha-card.k .haupt { gap: 14px; }
    ha-card.k .haupt ha-icon, ha-card.k .haupt.jetzt ha-icon { flex: 0 0 26px; width: 26px; height: 26px; background: none; box-shadow: none; color: var(--farbe); --mdc-icon-size: 24px; }
    ha-card.k .haupt small { font-size: 13px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }
    ha-card.k .haupt b { font-size: 19px; line-height: 24px; letter-spacing: -0.3px; color: var(--gg-l85, rgba(235, 235, 245, 0.85)); }
    ha-card.k { position: relative; }
    ha-card.k.mitz .haupt { padding-right: 34px; }
    .zahnrad { all: unset; box-sizing: border-box; position: absolute; top: 4px; right: 4px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .zahnrad ha-icon { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; --mdc-icon-size: 18px; color: var(--gg-l78, rgba(235, 235, 245, 0.78)); background: var(--gg-f12, rgba(255, 255, 255, 0.12)); transition: background-color 0.15s ease; }
    .zahnrad:active ha-icon { background: var(--gg-f22, rgba(255, 255, 255, 0.22)); }
    .zahnrad:focus-visible ha-icon { outline: 2px solid var(--gg-c-blau, #0A84FF); outline-offset: 2px; }
    .regel { margin: 10px 0 0; font-size: 12px; line-height: 16px; color: var(--gg-wert, rgba(235, 235, 245, 0.55)); }
  `;
  class GgTankprognose extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    setConfig(c) {
      if (!c || !Array.isArray(c.entities) || !c.entities.length) throw new Error('entities fehlt');
      this._c = c;
    }
    set hass(h) {
      this._h = h;
      if (!this._los) {
        this._los = true;
        this._laden();
      }
    }
    getCardSize() { return 6; }
    connectedCallback() {
      if (!this._iv) this._iv = setInterval(() => (this._daten ? this._laden() : null), 30 * 60 * 1000);
      if (!this._uhr) this._uhr = setInterval(() => this._zeichnen(), 5 * 60 * 1000);
    }
    disconnectedCallback() {
      clearInterval(this._iv);
      clearInterval(this._uhr);
      this._iv = null;
      this._uhr = null;
    }
    async _laden() {
      if (!this._h) return;
      const ende = new Date();
      const start = new Date(ende.getTime() - 35 * 864e5);
      try {
        this._daten = await this._h.callWS({
          type: 'recorder/statistics_during_period',
          start_time: start.toISOString(),
          end_time: ende.toISOString(),
          statistic_ids: this._c.entities,
          period: 'hour',
          types: ['mean'],
        });
        this._fehler = null;
      } catch (e) {
        this._fehler = String((e && e.message) || e);
      }
      this._zeichnen();
    }
    _rechnen() {
      const ids = this._c.entities;
      const devH = Array.from({ length: 24 }, () => []);
      const devSt = {};
      const tagListe = {};
      const alleTage = new Set();
      for (const id of ids) {
        const tage = new Map();
        for (const x of this._daten[id] || []) {
          if (typeof x.mean !== 'number') continue;
          const d = new Date(typeof x.start === 'number' ? x.start : Date.parse(x.start));
          const k = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
          if (!tage.has(k)) tage.set(k, { wd: d.getDay(), t: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), w: [] });
          tage.get(k).w.push([d.getHours(), x.mean]);
        }
        devSt[id] = Array.from({ length: 24 }, () => []);
        tagListe[id] = [];
        for (const tg of tage.values()) {
          if (tg.w.length < 18) continue;
          const avg = mittel(tg.w.map((v) => v[1]));
          tagListe[id].push({ wd: tg.wd, t: tg.t, avg });
          alleTage.add(tg.t);
          for (const [hr, v] of tg.w) {
            devH[hr].push(v - avg);
            devSt[id][hr].push(v - avg);
          }
        }
      }
      const mh = devH.map(mittel);
      const stH = {};
      for (const id of ids) stH[id] = devSt[id].map((a, i) => (a.length ? mittel(a) : mh[i]));
      // Wochentage: Tagesmittel gegen das Mittel der Nachbartage (±3 Tage)
      const wd = Array.from({ length: 7 }, () => ({ v: [], tage: new Set() }));
      for (const id of ids) {
        const L = tagListe[id];
        for (const x of L) {
          const nb = L.filter((y) => Math.abs(y.t - x.t) <= 3.6 * 864e5);
          if (nb.length < 5) continue;
          wd[x.wd].v.push(x.avg - mittel(nb.map((y) => y.avg)));
          wd[x.wd].tage.add(x.t);
        }
      }
      const wdM = wd.filter((x) => x.tage.size >= 2).length >= 5 ? wd.map((x) => (x.tage.size >= 2 ? mittel(x.v) : 0)) : null;
      return { mh, stH, wd, nTage: alleTage.size, wdM };
    }
    _tankBlock(R, jetzt) {
      const t = this._c.tank;
      const kp = !!this._c.kompakt;
      const h = this._h;
      const num = (id) => { const st = id && h && h.states[id]; const v = st ? parseFloat(st.state) : NaN; return isFinite(v) ? v : null; };
      const kopf = kp ? '' : '<div class="kopf"><span>Dein Mercedes</span><em>Tank-Stopp bis zur Frist</em></div>';
      const kl = kp ? 'tank k' : 'tank';
      const p = num(t.prozent);
      if (p === null) {
        if (kp) return null;
        return `<div class="tank">${kopf}<div class="haupt" style="--farbe:var(--gg-l68, rgba(235, 235, 245, 0.68))"><ha-icon icon="mdi:car-sports"></ha-icon><div><small>Noch nicht verbunden</small><b>Kein Tankstand</b><p>Sobald der Wagen verbunden ist, planen wir hier den besten Tank-Stopp.</p></div></div></div>`;
      }
      const l = num(t.liter);
      const km = num(t.reichweite);
      const tage = num(t.tage);
      const info = [`${Math.round(p)} %`, l !== null ? `${Math.round(l)} l` : null, km !== null ? `ca. ${Math.round(km)} km` : null].filter(Boolean).join(' · ');
      if (tage === null || tage > 14) {
        return `<div class="${kl}">${kopf}<div class="haupt" style="--farbe:var(--gg-c-gruen, #30D158)"><ha-icon icon="mdi:check-circle-outline"></ha-icon><div><small>Tank reicht</small><b>Kein Tanken nötig</b><p>${kp ? 'die nächsten zwei Wochen abgedeckt' : info + ' · die nächsten zwei Wochen sind abgedeckt'}</p></div></div></div>`;
      }
      const fristTag = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + tage);
      const fristTxt = tage === 0 ? 'heute' : tage === 1 ? 'morgen' : `${TAGE[fristTag.getDay()]}, ${String(fristTag.getDate()).padStart(2, '0')}.${String(fristTag.getMonth() + 1).padStart(2, '0')}.`;
      const farbe = tage <= 1 ? 'var(--gg-c-rot, #FF453A)' : tage <= 3 ? 'var(--gg-c-orange, #FF9F0A)' : 'var(--gg-c-blau, #0A84FF)';
      let best = null;
      if (R) {
        const start = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate(), jetzt.getHours());
        const ende = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + tage, 23, 59);
        for (let d0 = new Date(start); d0 <= ende; d0 = new Date(d0.getTime() + 3600e3)) {
          const hr = d0.getHours();
          if (hr < 6 || hr > 21) continue;
          const sc = (R.mh[hr] !== null ? R.mh[hr] : 0) + (R.wdM ? R.wdM[d0.getDay()] : 0);
          if (!best || sc < best.sc - 1e-9) best = { d: new Date(d0), hr, sc };
        }
      }
      let titel;
      let zeile = kp ? `spätestens ${fristTxt}` : `${info} · spätestens ${fristTxt}`;
      if (!best) {
        titel = tage === 0 ? 'Heute noch tanken' : 'Vor der Frist tanken';
      } else {
        const hn = jetzt.getHours();
        const jetztSlot = best.d.getTime() <= jetzt.getTime() + 3600e3 && best.d.getHours() === hn && best.d.getDate() === jetzt.getDate();
        const tagDiff = Math.round((new Date(best.d.getFullYear(), best.d.getMonth(), best.d.getDate()) - new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate())) / 864e5);
        const tagName = tagDiff === 0 ? 'Heute' : tagDiff === 1 ? 'Morgen' : TAGE[best.d.getDay()];
        titel = jetztSlot ? `Jetzt tanken – bis ${best.hr + 1} Uhr` : `${tagName} ${best.hr}–${best.hr + 1} Uhr`;
        let bestSt = null;
        this._c.entities.forEach((id, i) => {
          const p0 = parseFloat(h && h.states[id] ? h.states[id].state : NaN);
          if (!isFinite(p0)) return;
          const st = R.stH[id];
          const ab = st && st[hn] !== null ? st[hn] : 0;
          const zu = st && st[best.hr] !== null ? st[best.hr] : 0;
          const wdD = R.wdM ? R.wdM[best.d.getDay()] - R.wdM[jetzt.getDay()] : 0;
          const erw = jetztSlot ? p0 : p0 - ab + zu + wdD;
          if (!bestSt || erw < bestSt.erw) bestSt = { erw, name: (this._c.namen || [])[i] || (h.states[id].attributes.friendly_name || id) };
        });
        if (bestSt) zeile = kp ? `ca. ${preis(bestSt.erw)} · ${bestSt.name}` : zeile + ` · ca. ${preis(bestSt.erw)} · ${bestSt.name}`;
      }
      return `<div class="${kl}">${kopf}<div class="haupt" style="--farbe:${farbe}"><ha-icon icon="mdi:gas-station"></ha-icon><div><small>Nächster Tank-Stopp</small><b>${titel}</b><p>${zeile}</p></div></div></div>`;
    }
    /* Kompaktkarte schreiben, optional mit Zahnrad-Knopf oben rechts */
    _k(inner) {
      const ziel = this._c.einstellungen;
      const z = ziel ? '<button class="zahnrad" aria-label="Einstellungen" title="Einstellungen"><ha-icon icon="mdi:cog-outline"></ha-icon></button>' : '';
      this.shadowRoot.innerHTML = `<style>${CSS}</style><ha-card class="k${z ? ' mitz' : ''}">${inner}${z}</ha-card>`;
      const b = z && this.shadowRoot.querySelector('.zahnrad');
      if (b) b.addEventListener('click', (e) => {
        e.stopPropagation();
        history.pushState(null, '', location.pathname + location.search + ziel);
        window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
      });
    }
    _zeichnen() {
      if (!this._c) return;
      const sr = this.shadowRoot;
      const h = this._h;
      let inhalt = '';
      const regel = '<p class="regel">Seit April 2026 dürfen Tankstellen die Preise nur noch einmal täglich um 12 Uhr erhöhen, senken jederzeit. Laut ADAC ist es kurz vor 12 Uhr meist am günstigsten, direkt nach 12 Uhr am teuersten.</p>';
      const kp = !!this._c.kompakt;
      if (!this._daten) {
        const tb = this._c.tank ? this._tankBlock(null, new Date()) : null;
        if (kp) { this._k(tb || `<div class="haupt" style="--farbe:var(--gg-l68, rgba(235, 235, 245, 0.68))"><ha-icon icon="mdi:gas-station"></ha-icon><div><small>Tanken</small><b>${this._fehler ? 'Preisdaten nicht verfügbar' : 'Prognose lädt …'}</b></div></div>`); return; }
        inhalt = `${tb || ''}<div class="kopf"><span>Tank-Prognose</span><em>${this._fehler ? 'Daten nicht verfügbar' : 'lädt …'}</em></div>${regel}`;
      } else {
        const R = this._rechnen();
        const { mh, stH, wd, nTage } = R;
        const gueltig = mh.filter((v) => v !== null);
        const tankHtml = (this._c.tank ? this._tankBlock(nTage < 2 || gueltig.length < 20 ? null : R, new Date()) : '') || '';
        if (kp && tankHtml) { this._k(tankHtml); return; }
        if (nTage < 2 || gueltig.length < 20) {
          if (kp) { this._k(`<div class="haupt" style="--farbe:var(--gg-l68, rgba(235, 235, 245, 0.68))"><ha-icon icon="mdi:gas-station"></ha-icon><div><small>Tanken</small><b>Noch zu wenig Preisdaten</b></div></div>`); return; }
          inhalt = `${tankHtml}<div class="kopf"><span>Tank-Prognose</span><em>noch zu wenig Daten</em></div>${regel}`;
        } else {
          const min = Math.min(...gueltig);
          const max = Math.max(...gueltig);
          let best = mh.indexOf(min);
          let a = best;
          let b = best;
          while (a > 0 && mh[a - 1] !== null && mh[a - 1] <= min + 0.006) a--;
          while (b < 23 && mh[b + 1] !== null && mh[b + 1] <= min + 0.006) b++;
          const jetzt = new Date();
          const hn = jetzt.getHours();
          let k0 = null;
          if (hn >= a && hn <= b) k0 = 0;
          else for (let k = 1; k <= 48; k++) { const x = (hn + k) % 24; if (x >= a && x <= b) { k0 = k; break; } }
          const ziel = new Date(jetzt.getTime() + k0 * 3600e3);
          const tagDiff = Math.round((new Date(ziel.getFullYear(), ziel.getMonth(), ziel.getDate()) - new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate())) / 864e5);
          const tagName = tagDiff === 0 ? 'Heute' : tagDiff === 1 ? 'Morgen' : TAGE[ziel.getDay()];
          const titel = k0 === 0 ? `Jetzt tanken – noch bis ${b + 1} Uhr` : `${tagName} ${k0 > 0 ? ziel.getHours() : a}–${b + 1} Uhr`;
          // erwarteter Preis je Tankstelle: aktueller Preis, verschoben um das typische Stundenprofil
          let bestSt = null;
          let jetztMin = null;
          this._c.entities.forEach((id, i) => {
            const p = parseFloat(h && h.states[id] ? h.states[id].state : NaN);
            if (!isFinite(p)) return;
            const st = stH[id];
            const ab = st[hn] !== null ? st[hn] : 0;
            const zielH = k0 === 0 ? hn : ziel.getHours();
            const erw = k0 === 0 ? p : p - ab + (st[zielH] !== null ? st[zielH] : 0);
            if (jetztMin === null || p < jetztMin) jetztMin = p;
            if (!bestSt || erw < bestSt.erw) bestSt = { erw, name: (this._c.namen || [])[i] || (h.states[id].attributes.friendly_name || id) };
          });
          const spar = bestSt && jetztMin !== null ? jetztMin - bestSt.erw : 0;
          const teuerJetzt = mh[hn] !== null && mh[hn] - min > 0.03;
          const farbe = k0 === 0 ? 'var(--gg-c-gruen, #30D158)' : teuerJetzt ? 'var(--gg-c-orange, #FF9F0A)' : 'var(--gg-c-blau, #0A84FF)';
          const zeile = bestSt
            ? `ca. ${preis(bestSt.erw)} · ${bestSt.name}${k0 === 0 ? '' : spar > 0.004 ? ` · ${cent(-spar)} gegenüber jetzt` : ''}`
            : '';
          const unter = k0 === 0 ? 'Günstiges Zeitfenster' : teuerJetzt ? 'Jetzt eher teuer – besser warten' : 'Nächstes günstiges Zeitfenster';
          const span = Math.max(max - min, 0.001);
          const balken = mh
            .map((v, i) => {
              const hoch = v === null ? 0 : Math.round(8 + ((v - min) / span) * 92);
              const kl = v === null ? '' : v - min <= 0.006 ? 'g' : max - v <= span / 3 ? 'r' : '';
              return `<i class="${kl}${i === hn ? ' n' : ''}" style="height:${hoch}%" title="${i} Uhr: ${v === null ? '–' : cent(v)}"></i>`;
            })
            .join('');
          const wdOk = wd.filter((x) => x.tage.size >= 2);
          let wdZeilen = '';
          if (wdOk.length >= 5) {
            const liste = wd.map((x, i) => ({ i, d: x.tage.size >= 2 ? mittel(x.v) : null })).filter((x) => x.d !== null);
            liste.sort((x, y) => x.d - y.d);
            const g = liste[0];
            const r = liste[liste.length - 1];
            wdZeilen = `<div><span>Günstigster Wochentag</span><b class="g">${TAGE[g.i]} · ${cent(g.d)}</b></div><div><span>Teuerster Wochentag</span><b class="r">${TAGE[r.i]} · ${cent(r.d)}</b></div>`;
          } else {
            wdZeilen = `<div><span>Wochentag</span><b>ab ca. 2 Wochen Daten (bisher ${nTage} Tage)</b></div>`;
          }
          const tz = `<div><span>Beste Uhrzeit</span><b class="g">${a}–${b + 1} Uhr · ${cent(min)}</b></div><div><span>Teuerste Uhrzeit</span><b class="r">${mh.indexOf(max)}–${mh.indexOf(max) + 1} Uhr · ${cent(max)}</b></div>`;
          const hauptHtml = `<div class="haupt${k0 === 0 ? ' jetzt' : ''}" style="--farbe:${farbe}"><ha-icon icon="${k0 === 0 ? 'mdi:gas-station' : 'mdi:clock-outline'}"></ha-icon><div><small>${unter}</small><b>${titel}</b><p>${zeile}</p></div></div>`;
          if (kp) { this._k(hauptHtml); return; }
          inhalt = `${tankHtml}<div class="kopf"><span>Tank-Prognose</span><em>Basis: ${nTage} Tage · Shell in der Nähe</em></div>
            <div class="haupt${k0 === 0 ? ' jetzt' : ''}" style="--farbe:${farbe}"><ha-icon icon="${k0 === 0 ? 'mdi:gas-station' : 'mdi:clock-outline'}"></ha-icon><div><small>${unter}</small><b>${titel}</b><p>${zeile}</p></div></div>
            <div class="balken">${balken}</div><div class="achse"><span>0</span><span>6</span><span>12</span><span>18</span><span>24 Uhr</span></div>
            <div class="zeilen">${tz}${wdZeilen}</div>${regel}`;
        }
      }
      sr.innerHTML = `<style>${CSS}</style><ha-card>${inhalt}</ha-card>`;
    }
  }
  customElements.define('gg-tankprognose', GgTankprognose);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'gg-tankprognose', name: 'Tank-Prognose', description: 'Bester Tankzeitpunkt aus dem Preisverlauf' });
})();
