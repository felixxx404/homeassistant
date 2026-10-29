/* gg-einstellungen v5 (29.10.2026: Nest Hub Schlafzimmer nachts auf einstellbare Helligkeit (Standard 1 %) gedimmt, eigenes Zeitfenster; Helfer nest_schlafzimmer_nachthelligkeit/_nacht_von/_nacht_bis)
   v4 – Einstellungen für die gg-Dashboards (iPhone, PC, Nest Hub):
   v4: Milchglas-Bild (weich) 640 px im Seitenverhältnis des Bildes, blur 14 px + Sättigung 170 % wie das echte Milchglas (Nest);
       alte 160-px-Versionen werden einmal auf iPhone/PC aus der 4K-Version neu erzeugt (Kennung „w2“).
   v3: Bild-Adressen absolut (hass.hassUrl) – im Cast-Empfänger des Nest liegt die Seite auf einer anderen Domain.
   v2: Farbhintergründe mit radialem Verlauf + deckendere Kacheln, Bilder in 4K (3840 px), Erzeugen auf jedem Gerät,
       Nest nachts abdunkeln (Zeitfenster) + Rückkehrzeit, Karte „custom:gg-einstellungen-liste“ (Auswahl, Regler, Schalter, Uhrzeit, Stufen).
   • Hintergrund: Bild (scharf, in voller Auflösung aus /local/hintergrund_neu_beige.jpg erzeugt), eigenes Bild (Upload), einfarbig (Tag/Nacht-Paare) oder eigene Farbe
   • Abdunkeln nachts (iPhone/PC), Erscheinungsbild Automatisch/Immer hell/Immer dunkel
   • Karte „custom:gg-hintergrund-wahl“ für Mehr → Einstellungen
   Bilder werden im Browser verkleinert (breit 3840 px, hoch 1320×2868 für das iPhone, weich 160 px für Milchglas) und als JPEG
   über /api/image/upload in Home Assistant abgelegt; die IDs stehen in input_text.dashboard_hintergrund_bild / _eigen. */
(() => {
  const w = window;
  if (w.__ggEinst) return;
  w.__ggEinst = true;
  const SEL = 'input_select.dashboard_hintergrund';
  const BILD = 'input_text.dashboard_hintergrund_bild';
  const EIGEN = 'input_text.dashboard_hintergrund_eigen';
  const FARBE = 'input_text.dashboard_hintergrund_farbe';
  const DUNKEL = 'input_number.dashboard_abdunkeln_nachts';
  const MODUS = 'input_select.dashboard_erscheinungsbild';
  const QUELLE = '/local/hintergrund_neu_beige.jpg';
  const FARBEN = {
    'Graphit': ['#6E6E78', '#1C1C1E'],
    'Blau': ['#4F6F9A', '#0E1A2C'],
    'Grün': ['#5E7F68', '#122019'],
    'Beere': ['#8C5A78', '#22121C'],
    'Sand': ['#A8927A', '#2A231C'],
  };
  const root = document.documentElement;
  const cast = () => location.pathname.indexOf('receiver') >= 0 || !!document.querySelector('hc-main');
  const hassVon = () => {
    const e = document.querySelector('home-assistant') || document.querySelector('hc-main');
    return e && e.hass;
  };
  const S = (h, e) => (h && h.states[e] ? h.states[e].state : '');
  let hassRef = null;
  const url = (id) => { const p = '/api/image/serve/' + id + '/original'; try { return hassRef && hassRef.hassUrl ? hassRef.hassUrl(p) : p; } catch (_) { return p; } };
  const ids = (s) => {
    const t = String(s || '').split(',');
    return t.length >= 3 && /^[0-9a-f]{32}$/.test(t[0]) ? { breit: t[0], hoch: t[1], weich: t[2] } : null;
  };
  const hexOk = (s) => /^#[0-9a-fA-F]{6}$/.test(s || '');
  const dunkler = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const k = (x) => Math.round(x * f).toString(16).padStart(2, '0');
    return '#' + k((n >> 16) & 255) + k((n >> 8) & 255) + k(n & 255);
  };
  const hoch = w.matchMedia ? w.matchMedia('(orientation: portrait)') : null;
  const mische = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const k = (x) => Math.max(0, Math.min(255, Math.round(f >= 1 ? x + (255 - x) * (f - 1) : x * f))).toString(16).padStart(2, '0');
    return '#' + k((n >> 16) & 255) + k((n >> 8) & 255) + k(n & 255);
  };
  /* einfarbig: weicher radialer Verlauf (Licht oben links, dunklere Ecke unten rechts) */
  const verlauf = (c, tag) => 'radial-gradient(130% 95% at 15% 0%, ' + mische(c, tag ? 1.35 : 1.6) + ' 0%, ' + c + ' 48%, ' + mische(c, tag ? 0.62 : 0.55) + ' 100%)';

  /* ---------- Erscheinungsbild: Immer hell / Immer dunkel hält html[data-gg-tag] fest */
  let modus = 'Automatisch', sonneTag = null;
  const tagSoll = () => (modus === 'Immer hell' ? true : modus === 'Immer dunkel' ? false : null);
  new MutationObserver(() => {
    const soll = tagSoll();
    if (soll === null) return;
    if (root.hasAttribute('data-gg-tag') !== soll) root.toggleAttribute('data-gg-tag', soll);
  }).observe(root, { attributes: true, attributeFilter: ['data-gg-tag'] });

  /* ---------- Hintergrund berechnen */
  const plan = (h) => {
    const wahl = S(h, SEL) || 'Bild';
    const tag = root.hasAttribute('data-gg-tag');
    const a = Math.max(0, Math.min(0.9, (parseFloat(S(h, DUNKEL)) || 50) / 100));
    const p = { abd: tag ? 'rgba(0, 0, 0, 0)' : 'rgba(12, 12, 16, ' + a.toFixed(2) + ')', bild: null, weich: null, farbe: null };
    if (wahl === 'Bild' || wahl === 'Eigenes Bild') {
      const i = ids(S(h, wahl === 'Bild' ? BILD : EIGEN)) || (wahl === 'Eigenes Bild' ? ids(S(h, BILD)) : null);
      if (i) {
        p.bild = 'url("' + url(hoch && hoch.matches && !cast() ? i.hoch : i.breit) + '")';
        p.weich = 'url("' + url(i.weich) + '")';
      }
    } else {
      let f = FARBEN[wahl];
      if (wahl === 'Eigene Farbe') {
        const c = hexOk(S(h, FARBE)) ? S(h, FARBE) : '#3A4A5E';
        f = [c, dunkler(c, 0.35)];
      }
      if (f) { p.farbe = tag ? f[0] : f[1]; p.verlauf = verlauf(p.farbe, tag); }
    }
    return p;
  };

  /* ---------- auf die Seite anwenden */
  let vb = [], vbZeit = 0, letzter = '';
  const sucheVB = () => {
    const out = [], st = [root];
    let n = 0;
    while (st.length && n < 60000) {
      const x = st.pop();
      n++;
      if (x.localName === 'hui-view-background') out.push(x);
      if (x.shadowRoot) for (const c of x.shadowRoot.children) st.push(c);
      for (const c of x.children || []) st.push(c);
    }
    return out;
  };
  const setze = (el, prop, wert) => {
    if (wert == null) { if (el.style.getPropertyValue(prop)) el.style.removeProperty(prop); return; }
    if (el.style.getPropertyValue(prop) !== wert || el.style.getPropertyPriority(prop) !== 'important') el.style.setProperty(prop, wert, 'important');
  };
  const anwenden = (h) => {
    const p = plan(h);
    root.style.setProperty('--gg-abdunkeln', p.abd);
    let hg = null;
    if (p.bild) hg = 'linear-gradient(var(--gg-abdunkeln), var(--gg-abdunkeln)), ' + p.bild + ' center / cover no-repeat, var(--gg-wand-farbe, #1C1C1E)';
    else if (p.farbe) hg = 'linear-gradient(var(--gg-abdunkeln), var(--gg-abdunkeln)), ' + p.verlauf + ', ' + p.farbe;
    /* Nest Hub & Pop-ups nutzen --gg-bild / --gg-bild-weich */
    if (p.bild) { root.style.setProperty('--gg-bild', p.bild); root.style.setProperty('--gg-bild-weich', p.weich); }
    else if (p.farbe) { root.style.setProperty('--gg-bild', p.verlauf); root.style.setProperty('--gg-bild-weich', p.verlauf); }
    else { root.style.removeProperty('--gg-bild'); root.style.removeProperty('--gg-bild-weich'); }
    if (p.farbe) root.style.setProperty('--gg-wand-farbe', p.farbe); else root.style.removeProperty('--gg-wand-farbe');
    /* auf einfarbigem Grund Kacheln deckender, damit Symbole gut lesbar bleiben */
    if (p.farbe) root.style.setProperty('--gg-kachel', root.hasAttribute('data-gg-tag') ? 'rgba(255, 255, 255, 0.62)' : 'rgba(40, 40, 46, 0.62)');
    else root.style.removeProperty('--gg-kachel');
    const key = hg + '|' + location.pathname;
    if (key !== letzter || Date.now() - vbZeit > 5000 || vb.some((x) => !x.isConnected)) {
      if (key !== letzter || Date.now() - vbZeit > 5000) { vb = sucheVB(); vbZeit = Date.now(); }
      letzter = key;
    }
    vb.forEach((el) => setze(el, 'background', hg));
  };

  /* ---------- Bilder erzeugen und hochladen */
  const zuJpeg = (c, q) => new Promise((r) => c.toBlob(r, 'image/jpeg', q));
  const variante = async (bmp, bw, bh, weich) => {
    const c = document.createElement('canvas');
    c.width = bw; c.height = bh;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    const iw = bmp.naturalWidth || bmp.width, ih = bmp.naturalHeight || bmp.height;
    const s = Math.max(bw / iw, bh / ih), sw = bw / s, sh = bh / s;
    if (weich) {
      /* Milchglas: kräftig weichgezeichnet und gesättigt; Rand überstehend zeichnen, damit die Ecken nicht dunkel auslaufen */
      g.filter = 'blur(14px) saturate(170%)';
      const r = 40;
      g.drawImage(bmp, (iw - sw) / 2, (ih - sh) / 2, sw, sh, -r, -r, bw + 2 * r, bh + 2 * r);
      return zuJpeg(c, 0.82);
    }
    g.drawImage(bmp, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, bw, bh);
    return zuJpeg(c, 0.88);
  };
  const hochladen = async (h, blob, name) => {
    const fd = new FormData();
    fd.append('file', new File([blob], name, { type: 'image/jpeg' }));
    const r = await h.fetchWithAuth('/api/image/upload', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('Upload fehlgeschlagen (' + r.status + ')');
    return (await r.json()).id;
  };
  /* Bild einlesen – möglichst schon beim Dekodieren verkleinert (spart auf dem iPhone Speicher bei 50-MB-Fotos) */
  const lies = async (blob) => {
    try {
      const b = await createImageBitmap(blob, { resizeWidth: 4800, resizeQuality: 'high' });
      if (b && b.width === 4800) return b;
      if (b && b.close) b.close();
    } catch (_) {}
    try { return await createImageBitmap(blob); } catch (_) {}
    const u = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = u;
      await img.decode();
      return img;
    } finally { setTimeout(() => URL.revokeObjectURL(u), 60000); }
  };
  const erzeuge = async (h, blob, ziel, name, status) => {
    status && status('Bild wird vorbereitet …');
    const bmp = await lies(blob);
    const bw = Math.min(3840, bmp.width || bmp.naturalWidth), bh = Math.round(bw * (bmp.height || bmp.naturalHeight) / (bmp.width || bmp.naturalWidth));
    const teile = [[bw, bh, false, 'breit'], [1320, 2868, false, 'hoch'], [640, Math.round(640 * bh / bw), true, 'weich']];
    const neu = [];
    for (const t of teile) {
      status && status('Speichere ' + (t[3] === 'breit' ? '4K-Version' : t[3] === 'hoch' ? 'iPhone-Version' : 'Vorschau') + ' …');
      neu.push(await hochladen(h, await variante(bmp, t[0], t[1], t[2]), name + '-' + t[3] + '.jpg'));
    }
    if (bmp.close) bmp.close();
    if (bmp.src) bmp.src = '';
    const alt = ids(S(h, ziel));
    await h.callService('input_text', 'set_value', { entity_id: ziel, value: neu.join(',') + ',w2' });
    if (alt) for (const id of [alt.breit, alt.hoch, alt.weich]) { try { await h.callWS({ type: 'image/delete', image_id: id }); } catch (_) {} }
    status && status('Fertig.');
  };
  /* Standardbild einmalig in voller Schärfe erzeugen – nur auf einem PC (genug Speicher für 9000 × 6000 px) */
  let standardLaeuft = false;
  const standard = async (h, erzwingen, status) => {
    if (standardLaeuft) return;
    const v = S(h, BILD);
    if (!erzwingen) {
      if (ids(v) || cast() || /iPhone|iPad|Android|CrKey/i.test(navigator.userAgent) || (navigator.deviceMemory && navigator.deviceMemory < 4)) return;
      const m = /^erzeuge\|(\d+)$/.exec(v);
      if (m && Date.now() - parseInt(m[1], 10) < 600000) return;
    }
    standardLaeuft = true;
    try {
      await h.callService('input_text', 'set_value', { entity_id: BILD, value: 'erzeuge|' + Date.now() });
      const r = await fetch(QUELLE, { cache: 'no-store' });
      if (!r.ok) throw new Error('Originaldatei /local/hintergrund_neu_beige.jpg nicht gefunden (' + r.status + ')');
      await erzeuge(h, await r.blob(), BILD, 'hintergrund-beige', status);
    } catch (e) {
      status && status(String(e.message || e));
      try { await h.callService('input_text', 'set_value', { entity_id: BILD, value: 'fehler' }); } catch (_) {}
    }
    standardLaeuft = false;
  };
  w.__ggHintergrund = { erzeuge, standard, ids, url, FARBEN, hassVon };
  /* alte Milchglas-Versionen (160 px) einmal aus der 4K-Version neu erzeugen – nur auf iPhone/PC */
  let weichLaeuft = false;
  const weichVersucht = {};
  const weichNeu = async (h) => {
    if (weichLaeuft || cast()) return;
    for (const ziel of [EIGEN, BILD]) {
      const v = S(h, ziel), i = ids(v);
      if (!i || v.split(',').length >= 4 || weichVersucht[ziel + v]) continue;
      weichVersucht[ziel + v] = true;
      weichLaeuft = true;
      try {
        const r = await fetch(url(i.breit), { cache: 'no-store' });
        if (!r.ok) throw new Error('breit ' + r.status);
        const bmp = await lies(await r.blob());
        const iw = bmp.naturalWidth || bmp.width, ih = bmp.naturalHeight || bmp.height;
        const id = await hochladen(h, await variante(bmp, 640, Math.round(640 * ih / iw), true), (ziel === EIGEN ? 'hintergrund-eigen' : 'hintergrund-beige') + '-weich.jpg');
        if (bmp.close) bmp.close();
        await h.callService('input_text', 'set_value', { entity_id: ziel, value: [i.breit, i.hoch, id, 'w2'].join(',') });
        try { await h.callWS({ type: 'image/delete', image_id: i.weich }); } catch (_) {}
      } catch (_) {}
      weichLaeuft = false;
      return;
    }
  };

  /* ---------- Nest Hubs: nachts abdunkeln (Zeitfenster, Antippen hellt 30 s auf) und Rückkehrzeit */
  let dimm = null, wach = 0, gg = null, ggZeit = 0;
  document.addEventListener('pointerdown', () => { wach = Date.now(); if (dimm) dimm.style.opacity = '0'; }, true);
  const minuten = (s) => { const t = String(s || '').split(':'); return t.length >= 2 ? parseInt(t[0], 10) * 60 + parseInt(t[1], 10) : NaN; };
  const findeGG = () => { const st = [root]; let n = 0; while (st.length && n < 40000) { const x = st.pop(); n++; if (x.localName === 'gg-blaetter-view') return x; if (x.shadowRoot) for (const c of x.shadowRoot.children) st.push(c); for (const c of x.children || []) st.push(c); } return null; };
  const nest = (h) => {
    if (!gg || !gg.isConnected) {
      if (Date.now() - ggZeit > 5000) { ggZeit = Date.now(); gg = findeGG(); }
    }
    const sz = !!(gg && gg._cfg && gg._cfg.seiten && gg._cfg.seiten[0] && gg._cfg.seiten[0].pfad === 'schlafzimmer');
    let a, von, bis, jetzt;
    if (sz) {
      /* Schlafzimmer: eigene Helligkeit (1–100 %) und eigenes Zeitfenster, Zeit nach Home Assistant */
      const hell = parseFloat(S(h, 'input_number.nest_schlafzimmer_nachthelligkeit'));
      a = isNaN(hell) ? 0 : Math.max(0, Math.min(0.99, 1 - hell / 100));
      von = minuten(S(h, 'input_datetime.nest_schlafzimmer_nacht_von')); bis = minuten(S(h, 'input_datetime.nest_schlafzimmer_nacht_bis'));
      jetzt = (() => { try { const z = h.config && h.config.time_zone; if (z) { const p = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: z }).format(new Date()).split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); } } catch (_) { /* Rückfall */ } const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
    } else {
      a = (parseFloat(S(h, 'input_number.nest_nachts_abdunkeln')) || 0) / 100;
      von = minuten(S(h, 'input_datetime.nest_nachtruhe_beginn')); bis = minuten(S(h, 'input_datetime.nest_nachtruhe_ende'));
      const d = new Date(); jetzt = d.getHours() * 60 + d.getMinutes();
    }
    const nacht = !isNaN(von) && !isNaN(bis) && von !== bis && (von <= bis ? jetzt >= von && jetzt < bis : jetzt >= von || jetzt < bis);
    const soll = a > 0 && nacht && Date.now() - wach > 30000 ? a : 0;
    if (soll > 0 && !dimm) {
      dimm = document.createElement('div');
      dimm.setAttribute('data-gg-dimm', '');
      dimm.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:2147482000;opacity:0;transition:opacity 1.2s ease;';
      document.body.appendChild(dimm);
    }
    if (dimm) dimm.style.opacity = String(soll);
    const r = parseFloat(S(h, 'input_number.nest_ruckkehr_zur_startseite'));
    if (gg && gg._cfg && typeof gg._cfg.zurueck_nach === 'number' && r >= 10 && gg._cfg.zurueck_nach !== r) gg._cfg.zurueck_nach = r;
  };

  /* ---------- Takt */
  const takt = () => {
    try {
      const h = hassVon();
      if (!h || !h.states) return;
      hassRef = h;
      const m = S(h, MODUS) || 'Automatisch';
      if (m !== modus) {
        modus = m;
        const soll = tagSoll();
        if (soll !== null) root.toggleAttribute('data-gg-tag', soll);
        else if (h.states['sun.sun']) root.toggleAttribute('data-gg-tag', h.states['sun.sun'].state === 'above_horizon');
      }
      anwenden(h);
      if (cast()) nest(h); else weichNeu(h);
      const bv = S(h, BILD);
      if (!bv || bv === 'unknown' || bv.indexOf('erzeuge|') === 0) standard(h, false);
    } catch (_) {}
  };
  setInterval(takt, 1500);
  setTimeout(takt, 300);
  if (hoch && hoch.addEventListener) hoch.addEventListener('change', () => { letzter = ''; takt(); });

  /* ---------- Karte: Hintergrund wählen */
  class GgHintergrundWahl extends HTMLElement {
    setConfig(c) { this._c = c || {}; }
    getCardSize() { return 4; }
    set hass(h) {
      this._h = h;
      if (!this._r) this._baue();
      this._zeige();
    }
    _baue() {
      const r = this.attachShadow({ mode: 'open' });
      const opt = ['Bild', 'Eigenes Bild', 'Graphit', 'Blau', 'Grün', 'Beere', 'Sand', 'Eigene Farbe'];
      r.innerHTML = `<style>
        :host { display: block; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); -webkit-tap-highlight-color: transparent; }
        .box { border-radius: 27px; background: var(--gg-zelle, rgba(255, 255, 255, 0.08)); padding: 14px; }
        h4 { margin: 0 4px 10px; font-size: 15px; font-weight: 600; color: var(--gg-t1, #FFFFFF); }
        .raster { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        button { font: inherit; border: none; outline: none; cursor: pointer; padding: 0; background: none; color: inherit; -webkit-tap-highlight-color: transparent; }
        .f { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
        .m { position: relative; width: 100%; aspect-ratio: 1 / 1; max-width: 72px; border-radius: 18px; background: #2C2C32 center / cover no-repeat; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12); transition: transform 0.12s ease; overflow: hidden; display: flex; align-items: center; justify-content: center; color: rgba(255, 255, 255, 0.9); font-size: 26px; }
        .f:active .m { transform: scale(0.94); }
        .f.an .m { box-shadow: 0 0 0 3px var(--gg-c-gruen, #30D158), inset 0 0 0 1px rgba(255, 255, 255, 0.12); }
        .n { font-size: 12px; color: var(--gg-l78, rgba(235, 235, 245, 0.78)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .f.an .n { color: var(--gg-t1, #FFFFFF); font-weight: 600; }
        .m input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
        .zeile { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
        .k { flex: 1 1 0; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 12px; height: 44px; border-radius: 22px; background: var(--gg-schalter-aus, rgba(120, 120, 128, 0.32)); color: var(--gg-t1, #FFFFFF); font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .k:active { transform: scale(0.97); }
        .s { margin: 10px 4px 0; font-size: 12px; line-height: 1.4; color: var(--gg-l62, rgba(235, 235, 245, 0.62)); min-height: 17px; }
        @media (max-width: 699px) { .raster { gap: 8px; } .m { border-radius: 16px; } }
      </style>
      <div class="box"><h4>Hintergrund</h4><div class="raster">${opt.map((o) => `<button class="f" data-o="${o}"><span class="m">${o === 'Eigenes Bild' ? '+' : ''}${o === 'Eigene Farbe' ? '<input type="color" aria-label="Eigene Farbe">' : ''}</span><span class="n">${o === 'Bild' ? 'Standardbild' : o}</span></button>`).join('')}</div>
      <div class="zeile"><button class="k hoch">Bild hochladen</button><button class="k neu">Standard neu laden</button></div>
      <input class="datei" type="file" accept="image/*" hidden>
      <div class="s"></div></div>`;
      this._r = r;
      this._s = r.querySelector('.s');
      const status = (t) => { this._s.textContent = t; };
      r.querySelectorAll('.f').forEach((b) => b.addEventListener('click', (ev) => {
        const o = b.dataset.o;
        if (o === 'Eigenes Bild' && !ids(S(this._h, EIGEN))) { r.querySelector('.datei').click(); return; }
        if (ev.target.localName === 'input') return;
        this._h.callService('input_select', 'select_option', { entity_id: SEL, option: o });
      }));
      const farbe = r.querySelector('input[type=color]');
      farbe.addEventListener('click', (ev) => { ev.stopPropagation(); this._h.callService('input_select', 'select_option', { entity_id: SEL, option: 'Eigene Farbe' }); });
      farbe.addEventListener('change', () => {
        this._h.callService('input_text', 'set_value', { entity_id: FARBE, value: farbe.value.toUpperCase() });
        this._h.callService('input_select', 'select_option', { entity_id: SEL, option: 'Eigene Farbe' });
      });
      r.querySelector('.hoch').addEventListener('click', () => r.querySelector('.datei').click());
      r.querySelector('.datei').addEventListener('change', async (ev) => {
        const f = ev.target.files && ev.target.files[0];
        ev.target.value = '';
        if (!f) return;
        this._busy = true;
        try {
          await erzeuge(this._h, f, EIGEN, 'hintergrund-eigen', status);
          await this._h.callService('input_select', 'select_option', { entity_id: SEL, option: 'Eigenes Bild' });
          status('Eigenes Bild ist jetzt der Hintergrund.');
        } catch (e) { status('Das hat nicht geklappt: ' + (e.message || e)); }
        this._busy = false;
      });
      r.querySelector('.neu').addEventListener('click', async () => {
        this._busy = true;
        await standard(this._h, true, status);
        this._busy = false;
      });
    }
    _zeige() {
      const h = this._h;
      const wahl = S(h, SEL) || 'Bild';
      const tag = root.hasAttribute('data-gg-tag');
      const b = ids(S(h, BILD)), e = ids(S(h, EIGEN));
      const bildV = S(h, BILD);
      const k = [wahl, bildV, S(h, EIGEN), S(h, FARBE), tag].join('|');
      if (k === this._k) return;
      this._k = k;
      this._r.querySelectorAll('.f').forEach((x) => {
        const o = x.dataset.o, m = x.querySelector('.m');
        x.classList.toggle('an', o === wahl);
        if (o === 'Bild') m.style.backgroundImage = b ? 'url("' + url(b.weich) + '")' : 'var(--gg-bild-weich, none)';
        else if (o === 'Eigenes Bild') { m.style.backgroundImage = e ? 'url("' + url(e.weich) + '")' : 'none'; m.firstChild && m.firstChild.nodeType === 3 && (m.firstChild.textContent = e ? '' : '+'); }
        else if (o === 'Eigene Farbe') { const c = hexOk(S(h, FARBE)) ? S(h, FARBE) : '#3A4A5E'; m.style.background = verlauf(tag ? c : dunkler(c, 0.35), tag); const i = m.querySelector('input'); if (i && i.value.toUpperCase() !== c.toUpperCase()) i.value = c; }
        else if (FARBEN[o]) m.style.background = verlauf(FARBEN[o][tag ? 0 : 1], tag);
      });
      if (!this._busy) {
        this._s.textContent = bildV.indexOf('erzeuge|') === 0 ? 'Standardbild wird gerade in 4K erzeugt …'
          : bildV === 'fehler' ? 'Standardbild konnte nicht erzeugt werden – „Standard neu laden“ tippen, um es erneut zu versuchen.'
          : wahl === 'Eigenes Bild' && e ? 'Eigenes Bild aktiv (4K bzw. iPhone-Auflösung).'
          : (b ? 'Standardbild in 4K aktiv.' : 'Standardbild in 4K: „Standard neu laden“ tippen.');
      }
    }
  }
  if (!customElements.get('gg-hintergrund-wahl')) customElements.define('gg-hintergrund-wahl', GgHintergrundWahl);
  /* ---------- Karte: Einstellungsliste im iOS-Stil
     zeilen: [{ entity, name, icon, farbe, art: segment | regler | schalter | zeit | stufen, text? }] */
  const zahl = (v, st) => { const d = String(st || 1).indexOf('.') >= 0 ? String(st).split('.')[1].length : 0; return Number(v).toFixed(d).replace('.', ','); };
  class GgEinstellungenListe extends HTMLElement {
    setConfig(c) {
      if (!c || !Array.isArray(c.zeilen)) throw new Error('zeilen fehlen');
      this._c = c;
    }
    getCardSize() { return this._c.zeilen.length; }
    set hass(h) {
      this._h = h;
      if (!this._r) this._baue();
      this._zeige();
    }
    _baue() {
      const r = this.attachShadow({ mode: 'open' });
      r.innerHTML = `<style>
        :host { display: block; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none;
          --spur: rgba(120, 120, 128, 0.32); --daumen: rgba(255, 255, 255, 0.24); --daumen-schrift: #FFFFFF; --wahl-schatten: none; }
        :host([tag]) { --spur: rgba(120, 120, 128, 0.16); --daumen: #FFFFFF; --daumen-schrift: #000000; --wahl-schatten: 0 3px 8px rgba(0, 0, 0, 0.12), 0 3px 1px rgba(0, 0, 0, 0.04); }
        .box { border-radius: 26px; background: var(--gg-zelle, rgba(255, 255, 255, 0.08)); overflow: hidden; }
        .z { position: relative; display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; column-gap: 12px; row-gap: 10px; align-items: center; padding: 11px 14px; min-height: 34px; }
        .z + .z::before { content: ''; position: absolute; left: 62px; right: 0; top: 0; height: 0.5px; background: var(--gg-trenner, rgba(84, 84, 88, 0.65)); }
        .i { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--f); background: color-mix(in srgb, var(--f) 24%, transparent); --mdc-icon-size: 20px; }
        .t { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .t b { font-size: 15px; font-weight: 500; color: var(--gg-t1, #FFFFFF); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .t small { font-size: 12.5px; color: var(--gg-l78, rgba(235, 235, 245, 0.78)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .w { font-size: 15px; color: var(--gg-l78, rgba(235, 235, 245, 0.78)); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .u { grid-column: 2 / 4; }
        /* Segmente */
        .seg { position: relative; display: flex; height: 34px; border-radius: 17px; background: var(--spur); padding: 2px; box-sizing: border-box; }
        .seg button { flex: 1 1 0; min-width: 0; position: relative; z-index: 1; border: none; outline: none; background: none; font: inherit; font-size: 13px; font-weight: 500; color: var(--gg-t1, #FFFFFF); border-radius: 15px; cursor: pointer; padding: 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s ease; }
        .seg button.an { font-weight: 600; color: var(--daumen-schrift); }
        .seg .d { position: absolute; top: 2px; bottom: 2px; left: 2px; border-radius: 15px; background: var(--daumen); box-shadow: var(--wahl-schatten); transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1); }
        /* Regler */
        .reg { position: relative; height: 34px; border-radius: 17px; background: var(--spur); overflow: hidden; touch-action: none; cursor: pointer; }
        .reg .fl { position: absolute; left: 0; top: 0; bottom: 0; background: var(--f); border-radius: 17px 0 0 17px; min-width: 34px; }
        .reg .fl::after { content: ''; position: absolute; right: 5px; top: 50%; width: 4px; height: 14px; margin-top: -7px; border-radius: 2px; background: rgba(255, 255, 255, 0.85); }
        /* Schalter wie beim Licht */
        .sch { position: relative; width: 51px; height: 31px; border-radius: 16px; background: var(--gg-schalter-aus, rgba(120, 120, 128, 0.32)); border: none; padding: 0; cursor: pointer; transition: background 0.25s ease; outline: none; }
        .sch.an { background: var(--gg-schalter-an, #30D158); }
        .sch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15), 0 3px 1px rgba(0, 0, 0, 0.06); transition: left 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
        .sch.an::after { left: 22px; }
        /* Uhrzeit */
        input[type=time] { font: inherit; font-size: 17px; font-weight: 500; color: var(--gg-t1, #FFFFFF); background: var(--spur); border: none; outline: none; border-radius: 10px; padding: 5px 10px; height: 34px; box-sizing: border-box; color-scheme: dark; font-variant-numeric: tabular-nums; }
        :host([tag]) input[type=time] { color-scheme: light; }
        input[type=time]::-webkit-calendar-picker-indicator { display: none; }
        /* Stufen */
        .stf { display: flex; align-items: center; height: 34px; border-radius: 17px; background: var(--spur); }
        .stf button { width: 40px; height: 34px; border: none; background: none; font: inherit; font-size: 20px; color: var(--gg-t1, #FFFFFF); cursor: pointer; outline: none; }
        .stf button:active { opacity: 0.5; }
        .stf span { min-width: 92px; text-align: center; font-size: 15px; font-weight: 600; color: var(--gg-t1, #FFFFFF); font-variant-numeric: tabular-nums; }
      </style><div class="box"></div>`;
      this._r = r;
      const box = r.querySelector('.box');
      this._z = this._c.zeilen.map((z) => {
        const el = document.createElement('div');
        el.className = 'z';
        el.style.setProperty('--f', z.farbe || 'var(--gg-c-blau, #0A84FF)');
        el.innerHTML = `<span class="i"><ha-icon icon="${z.icon || 'mdi:cog'}"></ha-icon></span><span class="t"><b>${z.name}</b>${z.text ? `<small>${z.text}</small>` : ''}</span><span class="c"></span>`;
        box.appendChild(el);
        const c = el.querySelector('.c');
        const o = { z, el, c };
        if (z.art === 'segment') {
          const u = document.createElement('div'); u.className = 'u';
          u.innerHTML = '<div class="seg"><span class="d"></span></div>';
          el.appendChild(u);
          o.seg = u.querySelector('.seg');
        } else if (z.art === 'regler') {
          c.className = 'c w';
          const u = document.createElement('div'); u.className = 'u';
          u.innerHTML = '<div class="reg"><span class="fl"></span></div>';
          el.appendChild(u);
          o.reg = u.querySelector('.reg'); o.fl = u.querySelector('.fl');
          const wert = (ev) => {
            const a = this._h.states[z.entity].attributes, b = o.reg.getBoundingClientRect();
            const p = Math.max(0, Math.min(1, (ev.clientX - b.left) / b.width));
            const st = a.step || 1;
            return Math.round((a.min + p * (a.max - a.min)) / st) * st;
          };
          const setze = (v) => { o.lokal = v; this._regler(o, v); };
          o.reg.addEventListener('pointerdown', (ev) => { o.zieht = true; try { o.reg.setPointerCapture(ev.pointerId); } catch (_) {} setze(wert(ev)); });
          o.reg.addEventListener('pointermove', (ev) => { if (o.zieht) setze(wert(ev)); });
          const ende = () => {
            if (!o.zieht) return;
            o.zieht = false;
            o.gesendet = Date.now();
            this._h.callService('input_number', 'set_value', { entity_id: z.entity, value: o.lokal });
          };
          o.reg.addEventListener('pointerup', ende);
          o.reg.addEventListener('pointercancel', ende);
        } else if (z.art === 'schalter') {
          c.innerHTML = '<button class="sch" aria-label="' + z.name + '"></button>';
          o.sch = c.querySelector('.sch');
          o.sch.addEventListener('click', () => {
            const an = !o.sch.classList.contains('an');
            o.sch.classList.toggle('an', an);
            o.gesendet = Date.now();
            this._h.callService('input_boolean', an ? 'turn_on' : 'turn_off', { entity_id: z.entity });
          });
        } else if (z.art === 'zeit') {
          c.innerHTML = '<input type="time" step="60">';
          o.zeit = c.querySelector('input');
          o.zeit.addEventListener('change', () => {
            if (!o.zeit.value) return;
            o.gesendet = Date.now();
            this._h.callService('input_datetime', 'set_datetime', { entity_id: z.entity, time: o.zeit.value + ':00' });
          });
        } else if (z.art === 'stufen') {
          c.innerHTML = '<div class="stf"><button class="m">−</button><span></span><button class="p">+</button></div>';
          o.stf = c.querySelector('span');
          const schritt = (r2) => {
            const s0 = this._h.states[z.entity], a = s0.attributes, st = a.step || 1;
            const alt = o.lokal != null && Date.now() - (o.gesendet || 0) < 3000 ? o.lokal : parseFloat(s0.state);
            const v = Math.max(a.min, Math.min(a.max, Math.round((alt + r2 * st) / st) * st));
            o.lokal = v; o.gesendet = Date.now();
            o.stf.textContent = zahl(v, st) + (z.einheit || (' ' + (a.unit_of_measurement || '')));
            clearTimeout(o.t);
            o.t = setTimeout(() => this._h.callService('input_number', 'set_value', { entity_id: z.entity, value: Number(v.toFixed(4)) }), 500);
          };
          c.querySelector('.m').addEventListener('click', () => schritt(-1));
          c.querySelector('.p').addEventListener('click', () => schritt(1));
        }
        return o;
      });
    }
    _regler(o, v) {
      const a = this._h.states[o.z.entity].attributes;
      const p = (v - a.min) / ((a.max - a.min) || 1);
      o.fl.style.width = 'calc(' + (p * 100).toFixed(2) + '% )';
      o.c.textContent = (o.z.format ? o.z.format.replace('{}', zahl(v, a.step)) : zahl(v, a.step) + ' ' + (a.unit_of_measurement || '')).trim();
    }
    _zeige() {
      const h = this._h;
      this.toggleAttribute('tag', root.hasAttribute('data-gg-tag'));
      this._z.forEach((o) => {
        const s0 = h.states[o.z.entity];
        if (!s0) { o.el.style.display = 'none'; return; }
        o.el.style.display = '';
        const frisch = Date.now() - (o.gesendet || 0) > 2500;
        if (o.seg) {
          const opt = s0.attributes.options || [];
          if (o.seg.dataset.k !== opt.join('|')) {
            o.seg.dataset.k = opt.join('|');
            o.seg.querySelectorAll('button').forEach((b) => b.remove());
            opt.forEach((x) => {
              const b = document.createElement('button');
              b.textContent = (o.z.optionen && o.z.optionen[x]) || x;
              b.dataset.o = x;
              b.addEventListener('click', () => { o.gesendet = Date.now(); this._seg(o, x); h.callService('input_select', 'select_option', { entity_id: o.z.entity, option: x }); });
              o.seg.appendChild(b);
            });
          }
          if (frisch) this._seg(o, s0.state);
        } else if (o.reg) {
          if (!o.zieht && frisch) this._regler(o, parseFloat(s0.state));
        } else if (o.sch) {
          if (frisch) o.sch.classList.toggle('an', s0.state === 'on');
        } else if (o.zeit) {
          const v = String(s0.state).slice(0, 5);
          if (frisch && this._r.activeElement !== o.zeit && o.zeit.value !== v) o.zeit.value = v;
        } else if (o.stf) {
          if (frisch) o.stf.textContent = zahl(s0.state, s0.attributes.step) + (o.z.einheit || (' ' + (s0.attributes.unit_of_measurement || '')));
        }
      });
    }
    _seg(o, wert) {
      const bs = [...o.seg.querySelectorAll('button')];
      const i = Math.max(0, bs.findIndex((b) => b.dataset.o === wert));
      bs.forEach((b, k) => b.classList.toggle('an', k === i));
      const d = o.seg.querySelector('.d');
      d.style.width = 'calc((100% - 4px) / ' + (bs.length || 1) + ')';
      d.style.transform = 'translateX(' + (i * 100) + '%)';
    }
  }
  if (!customElements.get('gg-einstellungen-liste')) customElements.define('gg-einstellungen-liste', GgEinstellungenListe);
})();
