/* gg-mercedes v1 (28.10.2026) – Ergänzungen für die Mercedes-Ansicht, ändert gg-auto nicht:
   • Karte custom:gg-wochentage – Mo bis Fr antippen (Bürotage), schreibt „mo,mi“ in einen input_text.
       Konfiguration: { entity: 'input_text.…', name, text, icon, farbe, hinweis }
   • gg-auto: Ist der Vorschau-Schalter an, lassen sich Türen, Fenster, Schiebedach, Haube, Heckklappe und Tankklappe direkt am Auto
       antippen (öffnen/schließen simulieren). Es wird NIE etwas an das Fahrzeug gesendet – die Flächen sind nur in der Vorschau aktiv.
   • gg-auto-profil: Überschrift „Geschätztes Fahrverhalten“ (mit echten Messwerten „Gemessenes Fahrverhalten“). */
(() => {
  if (window.__ggMercedes) return;
  window.__ggMercedes = true;
  const root = document.documentElement;
  const NS = 'http://www.w3.org/2000/svg';
  const NAMEN = { tuer_vl: 'Fahrertür', tuer_vr: 'Beifahrertür', haube: 'Motorhaube', heckklappe: 'Heckklappe', fenster_vl: 'Fenster Fahrer', fenster_vr: 'Fenster Beifahrer', fenster_hl: 'Fenster hinten links', fenster_hr: 'Fenster hinten rechts', schiebedach: 'Schiebedach', tankklappe: 'Tankklappe' };
  /* Tippflächen in Foto-Koordinaten (wie in gg-auto); spätere liegen oben (Fenster vor Türen) */
  const FLAECHEN = [
    ['tuer_vl', '-70,590 58,588 100,600 112,640 118,690 94,700 95,800 97,880 98,960 100,1040 104,1082 85,1086 50,1100 -70,1100'], ['tuer_vr', '840,590 712,588 670,600 658,640 654,690 686,700 682,780 676,840 668,900 668,960 664,1020 662,1082 685,1086 720,1100 840,1100'],
    ['haube', '110,551 140,533 177,520 218,514 272,499 366,491 451,493 483,499 560,505 656,539 668,525 682,492 686,426 684,320 673,184 662,144 647,114 593,63 577,57 483,39 403,39 344,34 293,44 223,46 194,55 158,72 139,97 102,131 96,150 91,180 88,220 85,270 80,340 79,389 82,450 84,515 97,539 105,542'], ['heckklappe', '150,1528 175,1555 220,1580 300,1600 400,1606 500,1597 560,1578 598,1548 618,1532 628,1570 628,1620 620,1665 610,1695 598,1712 550,1726 400,1734 250,1724 160,1712 145,1695 138,1660 136,1600 138,1555'], ['schiebedach', '204,866 589,866 586,1000 580,1100 575,1168 213,1168 208,1100 205,1000'],
    ['fenster_vl', '124,752 128,760 138,790 144,820 150,850 156,880 160,910 164,940 166,970 168,1000 168,1082 104,1082 101,1040 99,960 98,880 97,800 97,752'], ['fenster_vr', '658,748 650,760 646,780 640,800 634,840 628,870 622,910 618,950 614,1000 612,1040 612,1082 662,1082 666,1040 666,1000 668,960 671,900 673,840 673,800 672,760 668,750'], ['fenster_hl', '109,1104 164,1104 162,1150 160,1200 156,1250 152,1300 146,1350 140,1400 132,1440 124,1455 121,1440 117,1400 115,1350 118,1300 117,1250 114,1200 111,1150'], ['fenster_hr', '616,1104 661,1104 657,1150 655,1200 652,1250 647,1300 643,1350 644,1380 637,1410 639,1455 636,1445 631,1410 628,1380 624,1350 620,1300 618,1250 618,1150'],
  ];
  const TANK_R = '684,1450 762,1450 762,1552 684,1552';
  const TANK_L = '8,1450 86,1450 86,1552 8,1552';

  /* ---------- gg-auto: Teile in der Vorschau antippen ---------- */
  const tipp = (card, k) => {
    if (!card._vor) return; /* nur in der Vorschau – sonst passiert nichts */
    const t = card._test || (card._test = {});
    const cur = card._status(k);
    if (k === 'schiebedach') t[k] = cur === 'kipp' ? true : cur === true ? false : 'kipp';
    else t[k] = !(cur === true);
    card._zeige();
    const neu = card._status(k);
    card._hinweis(NAMEN[k] + (neu === true ? ' offen' : neu === 'kipp' ? ' gelüftet' : ' geschlossen') + ' (Vorschau, nichts gesendet)');
  };
  const flaechen = (card) => {
    const r = card._r;
    const svg = r && r.querySelector('svg');
    if (!svg || svg.querySelector('#gm_tipp')) return;
    const st = document.createElement('style');
    st.textContent = '.gm_tp { fill: transparent; stroke: none; pointer-events: none; cursor: pointer; -webkit-tap-highlight-color: transparent; outline: none; }'
      + ' .karte.vor .gm_tp { pointer-events: all; } .karte.vor .gm_tp:focus-visible { stroke: var(--gg-c-blau, #0A84FF); stroke-width: 6; }';
    r.appendChild(st);
    const g = document.createElementNS(NS, 'g');
    g.id = 'gm_tipp';
    const liste = FLAECHEN.slice();
    liste.splice(5, 0, ['tankklappe', card._c && card._c.tankseite === 'links' ? TANK_L : TANK_R]);
    liste.forEach(([k, pts]) => {
      const p = document.createElementNS(NS, 'polygon');
      p.setAttribute('points', pts);
      p.setAttribute('class', 'gm_tp');
      p.setAttribute('role', 'button');
      p.setAttribute('aria-label', NAMEN[k] + ' (Vorschau)');
      p.dataset.k = k;
      p.addEventListener('click', () => tipp(card, k));
      p.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tipp(card, k); } });
      g.appendChild(p);
    });
    svg.appendChild(g);
  };
  const patcheAuto = () => {
    const C = customElements.get('gg-auto');
    if (!C || C.prototype.__gmPatch) return;
    C.prototype.__gmPatch = true;
    const baue0 = C.prototype._baue, zeige0 = C.prototype._zeige;
    C.prototype._baue = function () {
      baue0.apply(this, arguments);
      try { flaechen(this); } catch (e) { console.warn('gg-mercedes', e); }
    };
    C.prototype._zeige = function () {
      zeige0.apply(this, arguments);
      try {
        const r = this._r;
        if (!r) return;
        flaechen(this);
        const k = r.querySelector('.karte');
        if (k) k.classList.toggle('vor', !!this._vor);
        r.querySelectorAll('.gm_tp').forEach((p) => { if (this._vor) p.setAttribute('tabindex', '0'); else p.removeAttribute('tabindex'); });
        const hin = r.getElementById('hin');
        if (this._vor && hin && hin.textContent.startsWith('Vorschau –')) hin.textContent = 'Vorschau – Teile am Auto antippen, es wird nichts gesendet';
      } catch (e) { console.warn('gg-mercedes', e); }
    };
  };

  /* ---------- gg-auto-profil: Überschrift ---------- */
  const patcheProfil = () => {
    const C = customElements.get('gg-auto-profil');
    if (!C || C.prototype.__gmPatch) return;
    C.prototype.__gmPatch = true;
    const d = Object.getOwnPropertyDescriptor(C.prototype, 'hass');
    if (!d || !d.set) return;
    Object.defineProperty(C.prototype, 'hass', {
      configurable: true,
      get: d.get,
      set(h) {
        d.set.call(this, h);
        try {
          const r = this.shadowRoot;
          if (!r) return;
          const sp = r.querySelector('.kopf span'), em = r.getElementById('q');
          const gemessen = em && em.textContent === 'gemessen';
          if (sp) sp.textContent = gemessen ? 'Gemessenes Fahrverhalten' : 'Geschätztes Fahrverhalten';
          if (em) em.textContent = '';
        } catch (e) { console.warn('gg-mercedes', e); }
      },
    });
  };
  customElements.whenDefined('gg-auto').then(patcheAuto);
  customElements.whenDefined('gg-auto-profil').then(patcheProfil);

  /* ---------- Karte gg-wochentage ---------- */
  const TAGE = [['mo', 'Mo', 'Montag'], ['di', 'Di', 'Dienstag'], ['mi', 'Mi', 'Mittwoch'], ['do', 'Do', 'Donnerstag'], ['fr', 'Fr', 'Freitag']];
  const CSS = `
    :host { display: block; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; --spur: rgba(120, 120, 128, 0.32); --an-schrift: #FFFFFF; }
    :host([tag]) { --spur: rgba(120, 120, 128, 0.16); }
    .box { border-radius: 26px; background: var(--gg-zelle, rgba(255, 255, 255, 0.08)); box-shadow: var(--gg-zellschatten, none); overflow: hidden; padding: 11px 14px 13px; }
    .z { display: grid; grid-template-columns: 36px minmax(0, 1fr); column-gap: 12px; align-items: center; min-height: 36px; }
    .i { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--f); background: color-mix(in srgb, var(--f) 24%, transparent); --mdc-icon-size: 20px; }
    .t { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .t b { font-size: 15px; font-weight: 500; color: var(--gg-t1, #FFFFFF); }
    .t small { font-size: 12.5px; color: var(--gg-l78, rgba(235, 235, 245, 0.78)); }
    .tage { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
    .tage button { all: unset; box-sizing: border-box; height: 44px; border-radius: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 15px; font-weight: 500; color: var(--gg-t1, #FFFFFF); background: var(--spur); transition: background-color 0.2s ease, transform 0.12s ease; }
    .tage button:active { transform: scale(0.96); }
    .tage button:focus-visible { outline: 2px solid var(--gg-c-blau, #0A84FF); outline-offset: 2px; }
    .tage button.an { font-weight: 700; color: var(--an-schrift); background: var(--gg-c-blau, #0A84FF); }
    .hin { margin-top: 10px; font-size: 12.5px; line-height: 16px; color: var(--gg-l78, rgba(235, 235, 245, 0.78)); }
  `;
  class GgWochentage extends HTMLElement {
    setConfig(c) {
      if (!c || !c.entity) throw new Error('entity fehlt');
      this._c = c;
    }
    getCardSize() { return 2; }
    set hass(h) {
      this._h = h;
      if (!this._r) this._baue();
      this.toggleAttribute('tag', root.hasAttribute('data-gg-tag'));
      const s = h.states[this._c.entity];
      this._r.querySelector('.box').style.display = s ? '' : 'none';
      if (s && Date.now() - (this._gesendet || 0) > 2500) this._setze(this._lies(s.state));
    }
    _lies(txt) {
      const l = String(txt || '').toLowerCase().replace(/\s/g, '').split(',');
      return TAGE.map((t) => t[0]).filter((k) => l.includes(k));
    }
    _baue() {
      const c = this._c;
      const r = this.attachShadow({ mode: 'open' });
      r.innerHTML = `<style>${CSS}</style><div class="box" style="--f:${c.farbe || 'var(--gg-c-hellblau, #64D2FF)'}">
        <div class="z"><span class="i"><ha-icon icon="${c.icon || 'mdi:briefcase-outline'}"></ha-icon></span><span class="t"><b>${c.name || 'Bürotage'}</b>${c.text ? `<small>${c.text}</small>` : ''}</span></div>
        <div class="tage" role="group" aria-label="${c.name || 'Bürotage'}">${TAGE.map((t) => `<button data-k="${t[0]}" aria-label="${t[2]}" aria-pressed="false">${t[1]}</button>`).join('')}</div>
        ${c.hinweis ? `<div class="hin">${c.hinweis}</div>` : ''}</div>`;
      this._r = r;
      this._an = [];
      r.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.k;
        const neu = this._an.includes(k) ? this._an.filter((x) => x !== k) : this._an.concat(k);
        const sortiert = TAGE.map((t) => t[0]).filter((x) => neu.includes(x));
        this._setze(sortiert);
        this._gesendet = Date.now();
        this._h.callService('input_text', 'set_value', { entity_id: this._c.entity, value: sortiert.join(',') });
      }));
    }
    _setze(liste) {
      this._an = liste;
      this._r.querySelectorAll('button').forEach((b) => {
        const an = liste.includes(b.dataset.k);
        b.classList.toggle('an', an);
        b.setAttribute('aria-pressed', an ? 'true' : 'false');
      });
    }
  }
  if (!customElements.get('gg-wochentage')) customElements.define('gg-wochentage', GgWochentage);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'gg-wochentage', name: 'Wochentage wählen', description: 'Mo bis Fr antippen, schreibt „mo,mi“ in einen input_text' });
})();