/* gg-extras v11 – Karten für die gg-Dashboards:
   v11: Rangliste: kein „±k korr." mehr unter der Zahl (Korrektur steckt nur in der Zahl); rechts unten statt „nur Verbrauch · 1 € = 1 Getränk" der Durchschnitt „Ø x,x pro Tag" (Summe ÷ Tage im Zeitraum, mind. 1 Tag; Zeitraum = letzte 30 Tage bzw. seit Zurücksetzen).
   v10: Rangliste: Knopf (Stift) links neben dem ✕ → Korrekturmodus: je Person − und + ändern NUR die Zahl in der Rangliste, nicht das Guthaben.
        Speicher input_text.guthaben_rangliste_korrektur (JSON mit Zeitstempel des letzten Zurücksetzens), Änderung über script.guthaben_rangliste_korrigieren.
   v9: Guthaben zuverlässig: Stand wird nach jeder Buchung, alle 15 s und beim Zurückkehren in die App direkt aus todo.guthaben nachgeladen (nicht mehr nur über das Live-Abo); eigene Buchungen bleiben bis zur Bestätigung sichtbar (nicht mehr nach 15 s zurückspringen) und zählen sofort in der Rangliste; nicht bestätigte Buchungen werden gemeldet.
   v8: Kohlegrill: Schieberegler für die Dauer (8–12 Min., 15-s-Schritte, input_number.kohlegrill_dauer) im Pop-up; Texte nennen die gewählte Dauer, Licht pulsiert bis die Tür Ost aufgeht.
   v7: Rangliste zählt nur den Verbrauch (alle Abzüge), Aufladen zählt nie; „Rückgängig“ wird mit Kennung 'r' gebucht und hebt nur die zurückgenommene Buchung auf.
   v6: +/− wieder grau/blau; Namens-Kreise je Person eigene Farbe (nach alphabetischer Reihenfolge, keine Doppelten bis 10 Personen);
       Rangliste zählt ab input_datetime.guthaben_rangliste_ab (Zurücksetzen), höchstens 30 Tage.
   v5: Rangliste 30 Tage (wer wie viel getrunken hat; 1 € abgezogen = 1 Getränk, sofort rückgängig gemachte Buchungen zählen nicht),
       Knopf als art: knopf (Nest, links neben ✕); im Pop-up wird der Pokal-Knopf links neben das ✕ des Blatts gesetzt.
   v4: Guthaben nur in vollen Euro (Anzeige ohne Nachkommastellen, Ziffernblock mit C statt Komma), +/− als exakt mittige Zeichen, kräftigere Namens-Kreise.
   v3: Kohlegrill-Kachel mit Fortschritt als Rahmen ringsum (abgerundete Ecken), kurze Rückfragen, Toaster-Symbol.
   v2: Personen alphabetisch, Betrags-Vorschläge 5–30 €, kräftigere +/−-Knöpfe.
   • custom:gg-guthaben  – Guthaben je Person in €, gespeichert dauerhaft in todo.guthaben (local_todo, im Backup).
       art: liste (Pop-up iPhone/PC, mit „+ Person“) | nest (Vollbild Nest Hub, zwei Spalten). Name antippen → Verlauf.
       − bucht −1 €, + fragt den Betrag (Ziffernblock, volle Euro). Buchung über script.guthaben_buchen (Warteschlange).
   • custom:gg-pfeife    – Kohlegrill: Außensteckdose + Timer (timer.kohlegrill, Dauer 8–12 Min. per Regler, Standard 10).
       art: voll (Pop-up mit Ring) | kachel (quadratischer Nest-Knopf, Start/Abbruch mit zweitem Tippen). */
(() => {
  const w = window;
  if (w.__ggExtras) return;
  w.__ggExtras = true;
  const root = document.documentElement;
  const LISTE = 'todo.guthaben';
  const KOR = 'input_text.guthaben_rangliste_korrektur', RESET = 'input_datetime.guthaben_rangliste_ab';
  const eur = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const betrag = (c) => (c < 0 ? '−' : '') + eur.format(Math.abs(c) / 100) + ' €';
  const delta = (c) => (c < 0 ? '−' : '+') + eur.format(Math.abs(c) / 100) + ' €';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FARBEN = ['var(--gg-c-blau, #0A84FF)', 'var(--gg-c-orange, #FF9F0A)', 'var(--gg-c-gruen, #30D158)', 'var(--gg-c-pink, #FF375F)', 'var(--gg-c-lila, #BF5AF2)', 'var(--gg-c-gelb, #FFD60A)', 'var(--gg-c-tuerkis, #40C8E0)', 'var(--gg-c-rot, #FF453A)', 'var(--gg-c-indigo, #5E5CE6)', 'var(--gg-c-hellblau, #64D2FF)'];
  /* jede Person eine eigene Farbe: Reihenfolge wie die alphabetische Liste */
  const farbe = (n) => {
    const namen = store.items.map((x) => x.name).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
    let i = namen.indexOf(n);
    if (i < 0) { i = 7; for (const ch of String(n)) i = (i * 31 + ch.charCodeAt(0)) >>> 0; }
    return FARBEN[i % FARBEN.length];
  };
  const cast = () => location.pathname.indexOf('receiver') >= 0 || !!document.querySelector('hc-main');
  const haptik = (art) => { try { w.dispatchEvent(new CustomEvent('haptic', { detail: art || 'light' })); } catch (_) {} };
  const tag = () => root.hasAttribute('data-gg-tag');
  const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const z2 = (n) => String(n).padStart(2, '0');
  const datum = (sek) => { const d = new Date(sek * 1000); return WT[d.getDay()] + ', ' + z2(d.getDate()) + '.' + z2(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2) + ' · ' + z2(d.getHours()) + ':' + z2(d.getMinutes()); };
  const kurz = (sek) => { const d = new Date(sek * 1000), h = new Date(); const heute = d.toDateString() === h.toDateString(); return (heute ? 'heute' : z2(d.getDate()) + '.' + z2(d.getMonth() + 1) + '.') + ' ' + z2(d.getHours()) + ':' + z2(d.getMinutes()); };

  /* ---------- gemeinsamer Speicher: ein Abo auf die Liste für alle Karten */
  const store = { items: [], geladen: false, fehler: '', subs: new Set(), conn: null, offen: {} };
  const parse = (it) => {
    let s = 0, v = [];
    const t = it.description || '';
    if (t.indexOf('#GB1 ') === 0) { try { const j = JSON.parse(t.slice(5)); if (j && typeof j.s === 'number') { s = j.s; v = Array.isArray(j.v) ? j.v : []; } } catch (_) {} }
    return { uid: it.uid, name: it.summary, s, v };
  };
  const melde = () => store.subs.forEach((f) => { try { f(); } catch (_) {} });
  const setze = (items) => {
    store.items = (items || []).map(parse);
    store.geladen = true; store.fehler = '';
    store.items.forEach((p) => { const o = store.offen[p.name]; if (o && p.v.length - o.basis >= o.liste.length) delete store.offen[p.name]; });
    melde();
  };
  /* Stand direkt vom Server holen (unabhängig vom Live-Abo) */
  const lade = (hass) => {
    const h = hass || store.hass;
    if (!h || typeof h.callWS !== 'function') return Promise.resolve(false);
    return h.callWS({ type: 'todo/item/list', entity_id: LISTE }).then((m) => { setze(m && m.items); return true; }).catch(() => false);
  };
  const verbinde = (hass) => {
    if (hass) {
      store.hass = hass;
      const ks = hass.states && hass.states[KOR], rs = hass.states && hass.states[RESET];
      const tok = (ks ? ks.state : '') + '|' + (rs ? rs.state : '');
      if (tok !== store.korTok) { store.korTok = tok; melde(); }
    }
    if (!hass || !hass.connection || store.conn === hass.connection) return;
    store.conn = hass.connection;
    if (!store.takt) {
      store.takt = setInterval(() => { if (!document.hidden && store.subs.size) lade(); }, 15000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) lade(); });
      w.addEventListener('focus', () => lade());
    }
    lade(hass);
    hass.connection.subscribeMessage((m) => setze(m && m.items), { type: 'todo/item/subscribe', entity_id: LISTE }).catch((e) => { store.fehler = String((e && e.message) || e); store.conn = null; melde(); });
  };
  const saldo = (p) => {
    const o = store.offen[p.name];
    if (!o) return p.s;
    if (Date.now() - o.zeit > 90000) { delete store.offen[p.name]; return p.s; }
    return p.s + o.liste.slice(Math.max(0, p.v.length - o.basis)).reduce((a, b) => a + b, 0);
  };
  const buchen = (hass, p, cent, art) => {
    if (!cent) return;
    const o = store.offen[p.name] || { basis: p.v.length, liste: [], arten: [] };
    o.liste.push(cent); o.arten.push(art || ''); o.zeit = Date.now();
    store.offen[p.name] = o;
    melde();
    haptik(cent < 0 ? 'light' : 'success');
    const pruefe = () => {
      /* nach 8 s: ist die Buchung beim Server angekommen? sonst ehrlich melden */
      setTimeout(() => lade(hass).then((ok) => {
        const q = store.offen[p.name];
        if (ok && q && Date.now() - q.zeit > 7000) { delete store.offen[p.name]; melde(); hinweis('Buchung für ' + esc(p.name) + ' nicht bestätigt – bitte Stand prüfen'); }
      }), 8000);
    };
    hass.callService('script', 'guthaben_buchen', art ? { name: p.name, betrag: cent / 100, art } : { name: p.name, betrag: cent / 100 }).then(() => { lade(hass); setTimeout(() => lade(hass), 1500); pruefe(); }).catch((e) => {
      const q = store.offen[p.name];
      if (q) { const i = q.liste.lastIndexOf(cent); if (i >= 0) { q.liste.splice(i, 1); q.arten.splice(i, 1); } if (!q.liste.length) delete store.offen[p.name]; }
      melde(); lade(hass);
      hinweis('Buchung fehlgeschlagen: ' + ((e && e.message) || e));
    });
    if (art === 'r') hinweis(esc(p.name) + ' <b>' + delta(cent) + '</b> · rückgängig gemacht');
    else hinweis(esc(p.name) + ' <b>' + delta(cent) + '</b>', 'Rückgängig', () => buchen(hass, store.items.find((x) => x.name === p.name) || p, -cent, 'r'));
  };

  /* ---------- Ebenen über allem (am body, damit Pop-ups/Transformationen nicht stören) */
  const BASIS = `:host { all: initial; font-family: var(--gg-schrift, -apple-system, 'Inter', 'Roboto', sans-serif); -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; color: var(--gg-t1, #FFFFFF);
      --flaeche: rgba(36, 36, 42, 0.92); --zelle: rgba(255, 255, 255, 0.08); --taste: rgba(255, 255, 255, 0.12); --taste2: rgba(255, 255, 255, 0.2); --t2: rgba(235, 235, 245, 0.7); --trenner: rgba(84, 84, 88, 0.6); }
    :host([tag]) { --flaeche: rgba(246, 246, 248, 0.94); --zelle: rgba(0, 0, 0, 0.05); --taste: rgba(0, 0, 0, 0.07); --taste2: rgba(0, 0, 0, 0.14); --t2: rgba(60, 60, 67, 0.7); --trenner: rgba(60, 60, 67, 0.2); color: #000; }
    button { font: inherit; color: inherit; border: none; outline: none; background: none; cursor: pointer; padding: 0; -webkit-tap-highlight-color: transparent; }
    .hg { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); opacity: 0; transition: opacity 0.22s ease; }
    .dlg { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -46%) scale(0.98); opacity: 0; transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
      width: min(760px, calc(100vw - 24px)); max-height: calc(100vh - 24px); box-sizing: border-box; overflow: auto; border-radius: 28px; padding: 20px;
      background: var(--flaeche); backdrop-filter: blur(30px) saturate(180%); -webkit-backdrop-filter: blur(30px) saturate(180%); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45), inset 0 0 0 0.5px rgba(255, 255, 255, 0.18); }
    :host(.auf) .hg { opacity: 1; }
    :host(.auf) .dlg { opacity: 1; transform: translate(-50%, -50%); }
    .kopf { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .kopf h2 { flex: 1 1 auto; min-width: 0; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .kopf h2 small { font-size: 0.62em; font-weight: 500; color: var(--t2); letter-spacing: 0; margin-left: 4px; }
    .zu { width: 36px; height: 36px; border-radius: 50%; background: var(--taste); font-size: 20px; line-height: 36px; color: var(--t2); flex: 0 0 auto; }
    .zu:active, .k:active, .chip:active, .knopf:active { filter: brightness(1.3); transform: scale(0.96); }
    :host([nest]) .dlg { width: 980px; height: 560px; max-height: 560px; padding: 22px 26px; }
    :host([nest]) .kopf h2 { font-size: 30px; }
    :host([nest]) .zu { width: 56px; height: 56px; line-height: 56px; font-size: 28px; }`;
  const ebene = (css, html, opt) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147480000;';
    const r = host.attachShadow({ mode: 'open' });
    r.innerHTML = '<style>' + BASIS + css + '</style><div class="hg"></div><div class="dlg">' + html + '</div>';
    if (tag()) host.setAttribute('tag', '');
    if (cast()) host.setAttribute('nest', '');
    document.body.appendChild(host);
    requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add('auf')));
    const zu = () => { if (!host.isConnected) return; host.classList.remove('auf'); setTimeout(() => host.remove(), 260); if (opt && opt.zu) opt.zu(); };
    r.querySelector('.hg').addEventListener('click', zu);
    r.querySelectorAll('.zu').forEach((b) => b.addEventListener('click', zu));
    return { host, r, zu };
  };

  /* ---------- kurzer Hinweis unten (mit Rückgängig) */
  let hinweisEl = null;
  const hinweis = (html, knopf, fn) => {
    if (hinweisEl) hinweisEl.remove();
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom, 0px));transform:translateX(-50%);z-index:2147480500;';
    const r = host.attachShadow({ mode: 'open' });
    r.innerHTML = `<style>:host { all: initial; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); }
      div { display: flex; align-items: center; gap: 14px; padding: 10px 10px 10px 18px; border-radius: 22px; background: rgba(30, 30, 34, 0.92); color: #FFF; font-size: ${cast() ? 22 : 15}px;
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); white-space: nowrap; animation: e 0.25s ease; }
      b { font-weight: 700; } button { font: inherit; font-weight: 600; color: var(--gg-c-orange, #FF9F0A); background: rgba(255, 255, 255, 0.1); border: none; border-radius: 16px; padding: ${cast() ? '12px 20px' : '7px 14px'}; cursor: pointer; }
      @keyframes e { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }</style><div><span>${html}</span>${knopf ? '<button>' + knopf + '</button>' : ''}</div>`;
    document.body.appendChild(host);
    hinweisEl = host;
    const b = r.querySelector('button');
    if (b) b.addEventListener('click', () => { host.remove(); if (hinweisEl === host) hinweisEl = null; fn && fn(); });
    setTimeout(() => { if (host.isConnected) host.remove(); if (hinweisEl === host) hinweisEl = null; }, 5000);
  };

  /* ---------- Betrag eingeben (Ziffernblock – funktioniert auch auf dem Nest Hub ohne Tastatur) */
  const betragDialog = (hass, p) => {
    let wert = '', minus = false;
    const { r, zu } = ebene(`
      .inhalt { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: stretch; }
      @media (max-width: 620px) { .inhalt { grid-template-columns: minmax(0, 1fr); } }
      .links { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
      .seg { display: flex; height: 38px; border-radius: 19px; background: var(--zelle); padding: 3px; box-sizing: border-box; }
      .seg button { flex: 1 1 0; border-radius: 16px; font-size: 15px; font-weight: 600; color: var(--t2); }
      .seg button.an { background: var(--taste2); color: inherit; }
      .anz { display: flex; align-items: baseline; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-radius: 18px; background: var(--zelle); min-height: 64px; box-sizing: border-box; }
      .anz b { font-size: 44px; font-weight: 600; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
      .anz.plus b { color: var(--gg-c-gruen, #30D158); } .anz.minus b { color: var(--gg-c-rot, #FF453A); }
      .anz small { font-size: 22px; color: var(--t2); }
      .neu { font-size: 14px; color: var(--t2); text-align: right; min-height: 18px; }
      .chips { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .chip { height: 42px; border-radius: 14px; background: var(--taste); font-size: 17px; font-weight: 600; }
      .aktion { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: auto; }
      .knopf { height: 50px; border-radius: 16px; font-size: 17px; font-weight: 600; background: var(--taste); }
      .knopf.ok { background: var(--gg-c-blau, #0A84FF); color: #FFF; }
      .knopf.ok[disabled] { opacity: 0.35; pointer-events: none; }
      .block { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: minmax(54px, 1fr); gap: 8px; }
      .k { border-radius: 16px; background: var(--taste); font-size: 26px; font-weight: 500; font-variant-numeric: tabular-nums; }
      :host([nest]) .seg { height: 52px; border-radius: 26px; } :host([nest]) .seg button { font-size: 20px; border-radius: 23px; }
      :host([nest]) .anz b { font-size: 56px; } :host([nest]) .anz small { font-size: 28px; } :host([nest]) .neu { font-size: 18px; }
      :host([nest]) .chip { height: 56px; font-size: 22px; } :host([nest]) .knopf { height: 66px; font-size: 22px; border-radius: 20px; }
      :host([nest]) .k { font-size: 32px; border-radius: 18px; } :host([nest]) .block { grid-auto-rows: minmax(0, 1fr); height: 440px; }`,
      `<div class="kopf"><h2>${esc(p.name)} · Betrag</h2><button class="zu" aria-label="Schließen">✕</button></div>
       <div class="inhalt"><div class="links">
         <div class="seg"><button class="an" data-m="0">Hinzufügen</button><button data-m="1">Abziehen</button></div>
         <div class="anz plus"><b>0</b><small>€</small></div><div class="neu"></div>
         <div class="chips">${[5, 10, 15, 20, 25, 30].map((x) => `<button class="chip" data-c="${x}">${x} €</button>`).join('')}</div>
         <div class="aktion"><button class="knopf zu2">Abbrechen</button><button class="knopf ok" disabled>Hinzufügen</button></div>
       </div><div class="block">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((x) => `<button class="k" data-k="${x}">${x}</button>`).join('')}</div></div>`);
    const anz = r.querySelector('.anz'), b = anz.querySelector('b'), ok = r.querySelector('.ok'), neu = r.querySelector('.neu');
    const cent = () => { const n = parseInt(wert || '0', 10); return isFinite(n) ? n * 100 * (minus ? -1 : 1) : 0; };
    const zeige = () => {
      b.textContent = wert || '0';
      anz.className = 'anz ' + (minus ? 'minus' : 'plus');
      const c = cent();
      ok.disabled = !c;
      ok.textContent = minus ? 'Abziehen' : 'Hinzufügen';
      const akt = store.items.find((x) => x.name === p.name) || p;
      neu.textContent = c ? 'Neuer Stand: ' + betrag(saldo(akt) + c) : 'Aktuell: ' + betrag(saldo(akt));
    };
    r.querySelectorAll('.seg button').forEach((x) => x.addEventListener('click', () => { minus = x.dataset.m === '1'; r.querySelectorAll('.seg button').forEach((y) => y.classList.toggle('an', y === x)); zeige(); }));
    r.querySelectorAll('.chip').forEach((x) => x.addEventListener('click', () => { wert = x.dataset.c; haptik('selection'); zeige(); }));
    r.querySelectorAll('.k').forEach((x) => x.addEventListener('click', () => {
      const k = x.dataset.k;
      haptik('selection');
      if (k === '⌫') wert = wert.slice(0, -1);
      else if (k === 'C') wert = '';
      else {
        if (wert.length >= 4) return;
        wert = wert === '0' || wert === '' ? (k === '0' ? '' : k) : wert + k;
      }
      zeige();
    }));
    r.querySelector('.zu2').addEventListener('click', zu);
    ok.addEventListener('click', () => { const c = cent(); if (!c) return; zu(); buchen(hass, store.items.find((x) => x.name === p.name) || p, c); });
    zeige();
  };

  /* ---------- Verlauf einer Person */
  const verlaufDialog = (hass, name) => {
    const { r, zu } = ebene(`
      .stand { display: flex; align-items: baseline; gap: 10px; margin: -4px 0 14px; }
      .stand b { font-size: 40px; font-weight: 700; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
      .stand span { font-size: 15px; color: var(--t2); }
      .pos { color: var(--gg-c-gruen, #30D158); } .neg { color: var(--gg-c-rot, #FF453A); }
      .liste { border-radius: 18px; background: var(--zelle); max-height: calc(100vh - 220px); overflow: auto; -webkit-overflow-scrolling: touch; }
      .z { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 12px; padding: 11px 16px; position: relative; }
      .z + .z::before { content: ''; position: absolute; left: 16px; right: 0; top: 0; height: 0.5px; background: var(--trenner); }
      .z span { font-size: 15px; } .z small { grid-column: 1 / -1; font-size: 13px; color: var(--t2); }
      .z b { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
      .leer { padding: 22px 16px; text-align: center; color: var(--t2); font-size: 15px; }
      .aktion { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
      .knopf { height: 48px; border-radius: 16px; font-size: 17px; font-weight: 600; background: var(--taste); }
      .knopf.p { background: var(--gg-c-blau, #0A84FF); color: #FFF; }
      :host([nest]) .stand b { font-size: 48px; } :host([nest]) .stand span { font-size: 20px; }
      :host([nest]) .liste { max-height: 330px; } :host([nest]) .z { padding: 12px 20px; } :host([nest]) .z span { font-size: 21px; } :host([nest]) .z small { font-size: 17px; } :host([nest]) .z b { font-size: 23px; }
      :host([nest]) .knopf { height: 64px; font-size: 22px; border-radius: 20px; }`,
      `<div class="kopf"><h2>${esc(name)}</h2><button class="zu" aria-label="Schließen">✕</button></div>
       <div class="stand"><b></b><span></span></div><div class="liste"></div>
       <div class="aktion"><button class="knopf m">− 1 €</button><button class="knopf p">+ Betrag</button></div>`, { zu: () => store.subs.delete(neu) });
    const neu = () => {
      const p = store.items.find((x) => x.name === name);
      if (!p) return;
      const s = saldo(p);
      const sb = r.querySelector('.stand b');
      sb.textContent = betrag(s); sb.className = s < 0 ? 'neg' : '';
      r.querySelector('.stand span').textContent = p.v.length ? p.v.length + (p.v.length === 1 ? ' Buchung' : ' Buchungen') : '';
      let lauf = 0;
      const zeilen = p.v.map((e) => { lauf += e[1]; return [e[0], e[1], lauf, e[2]]; }).reverse();
      r.querySelector('.liste').innerHTML = zeilen.length ? zeilen.map((e) => `<div class="z"><span>${datum(e[0])}</span><b class="${e[1] < 0 ? 'neg' : 'pos'}">${delta(e[1])}</b><small>${e[3] === 'r' ? 'Rückgängig · ' : ''}Stand danach ${betrag(e[2])}</small></div>`).join('') : '<div class="leer">Noch keine Buchungen.</div>';
    };
    r.querySelector('.m').addEventListener('click', () => { const p = store.items.find((x) => x.name === name); if (p) buchen(hass, p, -100); });
    r.querySelector('.p').addEventListener('click', () => { const p = store.items.find((x) => x.name === name); if (p) betragDialog(hass, p); });
    store.subs.add(neu);
    neu();
  };

  /* ---------- Person anlegen (Texteingabe – nur iPhone/PC) */
  const personDialog = (hass) => {
    const { r, zu } = ebene(`
      input { width: 100%; box-sizing: border-box; height: 50px; border-radius: 14px; border: none; outline: none; padding: 0 16px; font: inherit; font-size: 18px; color: inherit; background: var(--zelle); -webkit-user-select: text; user-select: text; }
      .fehler { min-height: 20px; margin: 8px 2px 0; font-size: 14px; color: var(--gg-c-rot, #FF453A); }
      .aktion { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
      .knopf { height: 50px; border-radius: 16px; font-size: 17px; font-weight: 600; background: var(--taste); }
      .knopf.ok { background: var(--gg-c-blau, #0A84FF); color: #FFF; }
      .dlg { width: min(460px, calc(100vw - 24px)); top: 30%; }`,
      `<div class="kopf"><h2>Person hinzufügen</h2><button class="zu" aria-label="Schließen">✕</button></div>
       <input type="text" placeholder="Name" maxlength="40" autocomplete="off" autocapitalize="words" enterkeyhint="done"><div class="fehler"></div>
       <div class="aktion"><button class="knopf zu2">Abbrechen</button><button class="knopf ok">Hinzufügen</button></div>`);
    const inp = r.querySelector('input'), f = r.querySelector('.fehler');
    setTimeout(() => inp.focus(), 280);
    const los = () => {
      const n = inp.value.trim().replace(/\s+/g, ' ');
      if (!n) { f.textContent = 'Bitte einen Namen eingeben.'; return; }
      if (store.items.some((x) => x.name.toLowerCase() === n.toLowerCase())) { f.textContent = n + ' gibt es schon.'; return; }
      zu();
      haptik('success');
      hass.callService('script', 'guthaben_person_hinzufugen', { name: n }).catch((e) => hinweis('Fehler: ' + ((e && e.message) || e)));
    };
    r.querySelector('.zu2').addEventListener('click', zu);
    r.querySelector('.ok').addEventListener('click', los);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') los(); });
  };

  /* ---------- Rangliste: nur Verbrauch (alle Abzüge, 1 € = 1 Getränk). Aufladen zählt nie.
     „Rückgängig“ (Kennung 'r'): +x nimmt einen Abzug zurück und wird abgezogen; −x nimmt ein Aufladen zurück und zählt nicht. */
  /* manuelle Korrekturen: nur die Zahl in der Rangliste, nie das Guthaben. Gelten nur für den aktuellen Zurücksetz-Zeitstempel. */
  const korLesen = () => {
    const h = store.hass;
    const rs = h && h.states[RESET];
    const reset = rs && rs.attributes && rs.attributes.timestamp ? rs.attributes.timestamp : 0;
    const st = h && h.states[KOR];
    const roh = st ? st.state : '';
    if (store.korLokal && (Date.now() - store.korLokal.zeit > 20000 || store.korLokal.roh === roh)) store.korLokal = null;
    const text = store.korLokal ? store.korLokal.roh : roh;
    let o = {};
    try { if (text && text.charAt(0) === '{') o = JSON.parse(text) || {}; } catch (_) { o = {}; }
    if (Number(o.r || 0) !== Number(reset)) o = {};
    return { reset, k: o };
  };
  const korrigiere = (name, basis, schritt) => {
    const { reset, k } = korLesen();
    const o = Object.assign({ r: reset }, k);
    const jetzt = Math.max(0, basis + (Number(o[name]) || 0));
    const neu = Math.max(0, jetzt + schritt);
    if (neu === jetzt) return;
    const kv = neu - basis;
    if (kv) o[name] = kv; else delete o[name];
    store.korLokal = { roh: JSON.stringify(o), zeit: Date.now() };
    haptik('light'); melde();
    store.hass.callService('script', 'guthaben_rangliste_korrigieren', { name, schritt: neu - jetzt }).catch((e) => {
      store.korLokal = null; melde();
      hinweis('Korrektur fehlgeschlagen: ' + ((e && e.message) || e));
    });
  };
  const getrunken = (p, ab) => {
    let c = 0;
    const zaehle = (cent, art) => {
      if (art === 'r') { if (cent > 0) c -= cent; }
      else if (cent < 0) c -= cent;
    };
    p.v.forEach((e) => { if (e[0] >= ab) zaehle(e[1], e[2]); });
    /* eigene Buchungen, die der Server noch nicht bestätigt hat, zählen sofort */
    const o = store.offen[p.name];
    if (o) { const start = Math.max(0, p.v.length - o.basis); o.liste.slice(start).forEach((cent, i) => zaehle(cent, o.arten[start + i])); }
    return Math.max(0, Math.round(c / 100));
  };
  const ranglisteDialog = (hass) => {
    const { r } = ebene(`
      .liste { border-radius: 18px; background: var(--zelle); max-height: calc(100vh - 200px); overflow: auto; -webkit-overflow-scrolling: touch; }
      .z { position: relative; display: grid; grid-template-columns: 30px 36px minmax(0, 1fr) auto; column-gap: 12px; align-items: center; padding: 9px 16px; }
      .z + .z::before { content: ''; position: absolute; left: 16px; right: 0; top: 0; height: 0.5px; background: var(--trenner); }
      .pl { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: var(--t2); background: var(--taste); }
      .pl.g1 { background: #FFD60A; color: #3A2E00; } .pl.g2 { background: #C7C7CC; color: #2C2C2E; } .pl.g3 { background: #D08A4F; color: #2E1A08; }
      .av { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #FFF; background: color-mix(in srgb, var(--f) 78%, #000000); }
      .n { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
      .n b { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bal { height: 6px; border-radius: 3px; background: var(--taste); overflow: hidden; }
      .bal i { display: block; height: 100%; border-radius: 3px; background: var(--f); }
      .w { text-align: right; font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .w small { display: block; font-size: 12.5px; font-weight: 500; color: var(--t2); }
      .null { opacity: 0.5; }
      .ed { width: 36px; height: 36px; border-radius: 50%; background: var(--taste); color: var(--t2); flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
      .ed svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
      .ed.an { background: var(--gg-c-blau, #0A84FF); color: #FFF; }
      .ed:active, .km:active { transform: scale(0.92); }
      .z.e { grid-template-columns: 36px minmax(0, 1fr) auto 40px 40px; column-gap: 10px; padding: 8px 12px 8px 14px; }
      .n small { font-size: 12.5px; color: var(--t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .km { width: 40px; height: 40px; border-radius: 50%; background: var(--taste2); color: inherit; display: flex; align-items: center; justify-content: center; transition: transform 0.12s ease; }
      .km svg { width: 46%; height: 46%; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; }
      .km.p { background: var(--gg-c-blau, #0A84FF); color: #FFF; }
      .km[disabled] { opacity: 0.3; pointer-events: none; }
      :host([nest]) .ed { width: 56px; height: 56px; } :host([nest]) .ed svg { width: 26px; height: 26px; }
      :host([nest]) .z.e { grid-template-columns: 46px minmax(0, 1fr) auto 56px 56px; column-gap: 14px; padding: 8px 20px; }
      :host([nest]) .km { width: 56px; height: 56px; } :host([nest]) .n small { font-size: 16px; }
      .fuss { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; padding: 0 4px; font-size: 14px; color: var(--t2); }
      .fuss b { color: inherit; font-weight: 600; }
      .leer { padding: 22px 16px; text-align: center; color: var(--t2); font-size: 15px; }
      :host([nest]) .liste { max-height: 400px; }
      :host([nest]) .z { grid-template-columns: 40px 46px minmax(0, 1fr) auto; padding: 8px 20px; column-gap: 16px; }
      :host([nest]) .pl { width: 40px; height: 40px; font-size: 20px; } :host([nest]) .av { width: 46px; height: 46px; font-size: 20px; }
      :host([nest]) .n b { font-size: 22px; } :host([nest]) .bal { height: 8px; border-radius: 4px; }
      :host([nest]) .w { font-size: 24px; } :host([nest]) .w small { font-size: 16px; } :host([nest]) .fuss { font-size: 18px; }`,
      `<div class="kopf"><h2>Rangliste · letzte 30 Tage</h2><button class="ed" aria-label="Rangliste korrigieren" aria-pressed="false"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button><button class="zu" aria-label="Schließen">✕</button></div>
       <div class="liste"></div><div class="fuss"><span></span><span></span></div>`, { zu: () => store.subs.delete(neu) });
    let edit = false;
    const edBtn = r.querySelector('.ed'), liste = r.querySelector('.liste');
    const PEN = '<path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>', HAKEN = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
    edBtn.addEventListener('click', () => {
      edit = !edit; haptik('light');
      edBtn.classList.toggle('an', edit); edBtn.setAttribute('aria-pressed', String(edit));
      edBtn.setAttribute('aria-label', edit ? 'Korrektur beenden' : 'Rangliste korrigieren');
      edBtn.querySelector('svg').innerHTML = edit ? HAKEN : PEN;
      neu();
    });
    liste.addEventListener('click', (e) => {
      const b = e.target.closest('.km');
      if (!b || b.disabled) return;
      korrigiere(b.dataset.n, Number(b.dataset.b) || 0, Number(b.dataset.s));
    });
    const neu = () => {
      const rs = (store.hass || hass) && (store.hass || hass).states[RESET];
      const reset = rs && rs.attributes && rs.attributes.timestamp ? rs.attributes.timestamp : 0;
      const ab = Math.max(Date.now() / 1000 - 30 * 86400, reset);
      r.querySelector('h2').innerHTML = 'Rangliste <small>' + (reset > Date.now() / 1000 - 30 * 86400 ? 'seit ' + esc(kurz(reset).replace(/ \d\d:\d\d$/, '')) : '30 Tage') + '</small>';
      const kor = korLesen().k;
      const z = store.items.map((p) => { const b = getrunken(p, ab), kv = Number(kor[p.name]) || 0; return { p, b, kv, g: Math.max(0, b + kv) }; }).sort((a, b) => b.g - a.g || a.p.name.localeCompare(b.p.name, 'de', { sensitivity: 'base' }));
      const max = Math.max(1, ...z.map((x) => x.g));
      const sum = z.reduce((a, x) => a + x.g, 0);
      let platz = 0, vor = null;
      const sc = liste.scrollTop;
      const korTxt = (kv) => (kv > 0 ? '+' : '−') + Math.abs(kv);
      liste.innerHTML = z.length ? z.map((x, i) => {
        if (x.g !== vor) { platz = i + 1; vor = x.g; }
        const pl = x.g > 0 ? platz : '–';
        const nm = esc(x.p.name);
        if (edit) {
          return `<div class="z e${x.g ? '' : ' null'}" style="--f:${farbe(x.p.name)}">
          <span class="av">${esc((x.p.name.trim()[0] || '?').toUpperCase())}</span>
          <span class="n"><b>${nm}</b><small>${x.b} gezählt${x.kv ? ' · ' + korTxt(x.kv) + ' Korrektur' : ''}</small></span>
          <span class="w">${x.g}</span>
          <button class="km" data-n="${nm}" data-b="${x.b}" data-s="-1" ${x.g <= 0 ? 'disabled' : ''} aria-label="${nm}: eins weniger"><svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg></button><button class="km p" data-n="${nm}" data-b="${x.b}" data-s="1" aria-label="${nm}: eins mehr"><svg viewBox="0 0 24 24"><path d="M4 12h16M12 4v16"/></svg></button></div>`;
        }
        return `<div class="z${x.g ? '' : ' null'}" style="--f:${farbe(x.p.name)}"><span class="pl${x.g && platz <= 3 ? ' g' + platz : ''}">${pl}</span>
          <span class="av">${esc((x.p.name.trim()[0] || '?').toUpperCase())}</span>
          <span class="n"><b>${nm}</b><span class="bal"><i style="width:${(x.g / max * 100).toFixed(1)}%"></i></span></span>
          <span class="w">${x.g}<small>${x.g === 1 ? 'Getränk' : 'Getränke'}</small></span></div>`;
      }).join('') : '<div class="leer">Noch keine Personen.</div>';
      liste.scrollTop = sc;
      const tage = Math.max(1, (Date.now() / 1000 - ab) / 86400), schnitt = sum / tage;
      r.querySelector('.fuss span:last-child').textContent = edit ? 'Ändert nur die Zahl, nicht das Guthaben' : 'Ø ' + (Math.round(schnitt * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' pro Tag';
      r.querySelector('.fuss span').innerHTML = 'Zusammen <b>' + sum + (sum === 1 ? ' Getränk' : ' Getränke') + '</b> · ' + eur.format(sum) + ' €';
    };
    store.subs.add(neu);
    neu();
  };

  /* ---------- Karte: Guthaben */
  class GgGuthaben extends HTMLElement {
    setConfig(c) { this._c = Object.assign({ art: 'liste' }, c || {}); }
    getCardSize() { return 6; }
    getGridOptions() { return { columns: 'full' }; }
    connectedCallback() {
      this._f = this._f || (() => this._zeige()); store.subs.add(this._f); if (this._r) this._zeige();
      [50, 600, 2000].forEach((t) => setTimeout(() => this._imBlatt(), t));
    }
    /* Pop-up (gg-blaetter): Pokal-Knopf links neben das ✕ im Kopf des Blatts setzen */
    _imBlatt() {
      if (!this._c || this._c.art !== 'liste' || !this.isConnected) return;
      if (this._kk && this._kk.isConnected) return;
      let n = this, blatt = null;
      for (let i = 0; i < 40 && n; i++) { if (n.classList && n.classList.contains('blatt')) { blatt = n; break; } n = n.parentNode || n.host; }
      const kopf = blatt && blatt.querySelector('header'), zu = kopf && kopf.querySelector('.zu');
      if (!zu) return;
      let b = kopf.querySelector('.gg-rang');
      if (!b) {
        b = document.createElement('button');
        b.className = 'gg-rang';
        b.setAttribute('aria-label', 'Rangliste 30 Tage');
        b.style.cssText = 'flex:0 0 36px;width:36px;height:36px;border-radius:50%;border:none;padding:0;display:flex;align-items:center;justify-content:center;background:var(--gg-f16, rgba(255, 255, 255, 0.16));color:var(--gg-t1, #FFFFFF);--mdc-icon-size:20px;cursor:pointer;-webkit-tap-highlight-color:transparent;';
        b.innerHTML = '<ha-icon icon="mdi:trophy-outline" style="line-height:0"></ha-icon>';
        b.addEventListener('click', (e) => { e.stopPropagation(); haptik(); ranglisteDialog(this._h); });
        kopf.insertBefore(b, zu);
      }
      this._kk = b;
      const alt = this._r && this._r.querySelector('.neu.rang');
      if (alt) alt.style.display = 'none';
    }
    disconnectedCallback() { store.subs.delete(this._f); }
    set hass(h) {
      this._h = h;
      verbinde(h);
      if (!this._r) this._baue();
      const t = tag();
      if (this._tag !== t) { this._tag = t; this.toggleAttribute('tag', t); }
    }
    _baue() {
      const nest = this._c.art === 'nest';
      const r = this.attachShadow({ mode: 'open' });
      if (this._c.art === 'knopf') {
        /* runder Knopf für die Rangliste (Nest: absolut neben dem ✕, Abstand rechts über „rechts“) */
        if (this._c.rechts !== undefined) { this.style.position = 'absolute'; this.style.top = '0'; this.style.right = this._c.rechts + 'px'; this.style.zIndex = '3'; }
        r.innerHTML = `<style>:host { display: block; width: 60px; height: 60px; }
          button { width: 60px; height: 60px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; outline: none;
            background: var(--gg-f12, rgba(255, 255, 255, 0.12)); border: 1px solid var(--gg-r14, rgba(255, 255, 255, 0.14)); color: var(--gg-t1, #FFFFFF); --mdc-icon-size: 28px; transition: transform 0.12s ease; -webkit-tap-highlight-color: transparent; }
          button:active { transform: scale(0.9); } ha-icon { line-height: 0; }</style><button aria-label="Rangliste 30 Tage"><ha-icon icon="mdi:trophy-outline"></ha-icon></button>`;
        this._r = r;
        r.querySelector('button').addEventListener('click', () => { haptik(); ranglisteDialog(this._h); });
        return;
      }
      r.innerHTML = `<style>
        :host { display: block; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; color: var(--gg-t1, #FFFFFF);
          --t2: var(--gg-l78, rgba(235, 235, 245, 0.78)); --taste: rgba(255, 255, 255, 0.14); --minus: rgba(255, 255, 255, 0.24); }
        :host([tag]) { --taste: rgba(0, 0, 0, 0.07); --minus: rgba(0, 0, 0, 0.12); }
        button { font: inherit; color: inherit; border: none; outline: none; background: none; cursor: pointer; padding: 0; -webkit-tap-highlight-color: transparent; }
        .pos { color: var(--gg-c-gruen, #30D158); } .neg { color: var(--gg-c-rot, #FF453A); } .null { color: var(--t2); }
        .kopf { display: flex; align-items: center; justify-content: space-between; padding: 0 6px; margin-bottom: 10px; }
        .kopf b { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
        .kn { display: flex; gap: 8px; }
        .neu.rang { color: var(--gg-c-gelb, #FFD60A); }
        :host([tag]) .neu.rang { color: #B8860B; }
        .neu { display: flex; align-items: center; gap: 4px; height: 34px; padding: 0 14px 0 10px; border-radius: 17px; background: var(--taste); font-size: 15px; font-weight: 600; color: var(--gg-c-blau, #0A84FF); --mdc-icon-size: 20px; }
        .box { border-radius: 26px; background: var(--gg-zelle, rgba(255, 255, 255, 0.08)); overflow: hidden; }
        .z { position: relative; display: grid; grid-template-columns: 40px minmax(0, 1fr) auto auto auto; column-gap: 10px; align-items: center; padding: 10px 12px 10px 14px; }
        .z + .z::before { content: ''; position: absolute; left: 64px; right: 0; top: 0; height: 0.5px; background: var(--gg-trenner, rgba(84, 84, 88, 0.65)); }
        .av { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #FFFFFF; background: color-mix(in srgb, var(--f) 78%, #000000); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); }
        .t { min-width: 0; display: flex; flex-direction: column; gap: 1px; cursor: pointer; }
        .t b { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .t small { font-size: 12.5px; color: var(--t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .s { font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; cursor: pointer; padding-right: 4px; white-space: nowrap; }
        .pm { width: 38px; height: 38px; border-radius: 50%; background: var(--minus); display: flex; align-items: center; justify-content: center; transition: transform 0.12s ease; }
        .pm svg { width: 46%; height: 46%; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; }
        .pm.p { background: var(--gg-c-blau, #0A84FF); color: #FFFFFF; box-shadow: 0 2px 8px color-mix(in srgb, var(--gg-c-blau, #0A84FF) 40%, transparent); }
        .pm:active, .neu:active { transform: scale(0.9); }
        .t:active, .s:active { opacity: 0.6; }
        .fuss { display: flex; justify-content: space-between; padding: 12px 8px 0; font-size: 14px; color: var(--t2); }
        .fuss b { font-weight: 600; font-variant-numeric: tabular-nums; }
        .leer { padding: 22px; text-align: center; color: var(--t2); font-size: 15px; }
        /* Nest Hub: Vollbild, zwei Spalten */
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: var(--zeile, 84px); gap: 14px 20px; overflow-y: auto; -webkit-overflow-scrolling: touch; height: var(--hoehe, 480px); align-content: start; }
        .grid .z { padding: 0 14px 0 16px; border-radius: 22px; background: var(--gg-nestfrost, rgba(118, 118, 132, 0.36)); box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.16), 0 8px 24px rgba(0, 0, 0, 0.16);
          grid-template-columns: 52px minmax(0, 1fr) auto 60px 60px; column-gap: 12px; }
        .grid .z::before { display: none; }
        .grid .av { width: 52px; height: 52px; font-size: 22px; }
        .grid .t b { font-size: 24px; } .grid .t small { font-size: 16px; }
        .grid .s { font-size: 26px; font-weight: 700; }
        .grid .pm { width: 60px; height: 60px; }
      </style>${nest ? '' : '<div class="kopf"><b>Personen</b><span class="kn"><button class="neu rang"><ha-icon icon="mdi:trophy-outline"></ha-icon>30 Tage</button><button class="neu"><ha-icon icon="mdi:plus"></ha-icon>Person</button></span></div>'}<div class="${nest ? 'grid' : 'box'}"></div>${nest ? '' : '<div class="fuss"><span>Summe aller Guthaben</span><b></b></div>'}`;
      this._r = r;
      this._liste = r.querySelector(nest ? '.grid' : '.box');
      if (nest) {
        this._liste.style.setProperty('--hoehe', (this._c.hoehe || 480) + 'px');
      } else {
        r.querySelector('.neu:not(.rang)').addEventListener('click', () => { haptik(); personDialog(this._h); });
        r.querySelector('.rang').addEventListener('click', () => { haptik(); ranglisteDialog(this._h); });
        this._imBlatt();
      }
      this._liste.addEventListener('click', (e) => {
        const el = e.target.closest('[data-a]');
        if (!el || !this._h) return;
        const p = store.items.find((x) => x.name === el.closest('.z').dataset.n);
        if (!p) return;
        const a = el.dataset.a;
        if (a === 'm') buchen(this._h, p, -100);
        else if (a === 'p') { haptik(); betragDialog(this._h, p); }
        else if (a === 'v') { haptik(); verlaufDialog(this._h, p.name); }
      });
      this._zeige();
    }
    _zeige() {
      if (!this._r || this._c.art === 'knopf') return;
      const nest = this._c.art === 'nest';
      if (!store.geladen) { this._liste.innerHTML = '<div class="leer">' + (store.fehler ? 'Guthaben-Liste nicht erreichbar: ' + esc(store.fehler) : 'Lade …') + '</div>'; this._sig = ''; return; }
      const zeilen = store.items.map((p) => ({ p, s: saldo(p), l: p.v.length ? p.v[p.v.length - 1][0] : 0 })).sort((a, b) => a.p.name.localeCompare(b.p.name, 'de', { sensitivity: 'base' }));
      const sig = zeilen.map((x) => x.p.name + ':' + x.s + ':' + x.l).join('|');
      if (nest) {
        const n = Math.max(1, Math.ceil(zeilen.length / 2)), hoehe = this._c.hoehe || 480;
        const zh = Math.max(76, Math.min(104, Math.floor((hoehe - 14 * (n - 1)) / n)));
        this._liste.style.setProperty('--zeile', zh + 'px');
      }
      if (sig === this._sig) return;
      this._sig = sig;
      this._liste.innerHTML = zeilen.length ? zeilen.map(({ p, s, l }) => `<div class="z" data-n="${esc(p.name)}" style="--f:${farbe(p.name)}">
          <span class="av" data-a="v">${esc((p.name.trim()[0] || '?').toUpperCase())}</span>
          <span class="t" data-a="v"><b>${esc(p.name)}</b><small>${l ? (nest ? '' : 'zuletzt ') + kurz(l) : (nest ? 'neu' : 'noch keine Buchung')}</small></span>
          <span class="s ${s < 0 ? 'neg' : s > 0 ? 'pos' : 'null'}" data-a="v">${betrag(s)}</span>
          <button class="pm" data-a="m" aria-label="1 € abziehen"><svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg></button><button class="pm p" data-a="p" aria-label="Betrag hinzufügen"><svg viewBox="0 0 24 24"><path d="M4 12h16M12 4v16"/></svg></button></div>`).join('')
        : '<div class="leer">Noch keine Personen.</div>';
      const f = this._r.querySelector('.fuss b');
      if (f) { const sum = zeilen.reduce((a, x) => a + x.s, 0); f.textContent = betrag(sum); f.className = sum < 0 ? 'neg' : ''; }
    }
  }
  if (!customElements.get('gg-guthaben')) customElements.define('gg-guthaben', GgGuthaben);

  /* ---------- Karte: Pfeife / Kohlegrill */
  const sek = (s) => { const t = String(s || '').split(':').map((x) => parseFloat(x) || 0); return t.length === 3 ? t[0] * 3600 + t[1] * 60 + t[2] : t.length === 2 ? t[0] * 60 + t[1] : t[0]; };
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + z2(s % 60); };
  const minTxt = (s) => { s = Math.round(s); const m = Math.floor(s / 60), r = s % 60; return r ? m + ':' + z2(r) + ' Min.' : m + ' Min.'; };
  const hhmm = (d) => z2(d.getHours()) + ':' + z2(d.getMinutes());
  class GgPfeife extends HTMLElement {
    setConfig(c) {
      this._c = Object.assign({ art: 'voll', timer: 'timer.kohlegrill', steckdose: 'input_boolean.kohlegrill_steckdose', start: 'script.kohlegrill_starten', stopp: 'script.kohlegrill_stoppen', fertig: 'automation.kohlegrill_kohlen_bereit', dauer: 'input_number.kohlegrill_dauer' }, c || {});
    }
    getCardSize() { return this._c && this._c.art === 'kachel' ? 2 : 5; }
    connectedCallback() { clearInterval(this._iv); this._iv = setInterval(() => this._zeige(), 1000); }
    disconnectedCallback() { clearInterval(this._iv); }
    set hass(h) {
      this._h = h;
      if (!this._r) this._baue();
      const t = tag();
      if (this._tag !== t) { this._tag = t; this.toggleAttribute('tag', t); }
      this._zeige();
    }
    _status() {
      const h = this._h, c = this._c, s = h.states[c.timer];
      const st = s ? s.state : 'unavailable', a = (s && s.attributes) || {};
      const hd = h.states[c.dauer], hv = hd ? parseFloat(hd.state) : NaN;
      const lauf = st === 'active' || st === 'paused';
      const dauer = lauf ? (sek(a.duration) || 600) : hv > 0 ? hv : (sek(a.duration) || 600);
      let rest = dauer, ende = null;
      if (st === 'active' && a.finishes_at) { ende = new Date(a.finishes_at); rest = (ende - Date.now()) / 1000; }
      else if (st === 'paused') rest = sek(a.remaining);
      const sd = h.states[c.steckdose], fe = h.states[c.fertig];
      const zuletzt = fe && fe.attributes.last_triggered ? new Date(fe.attributes.last_triggered) : null;
      return { st, dauer, regler: hv > 0 ? hv : 0, rest: Math.max(0, rest), ende, an: !!sd && sd.state === 'on', platzhalter: c.steckdose.indexOf('input_boolean.') === 0, zuletzt };
    }
    _baue() {
      const k = this._c.art === 'kachel';
      const r = this.attachShadow({ mode: 'open' });
      r.innerHTML = `<style>
        :host { display: block; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; color: var(--gg-t1, #FFFFFF);
          --o: var(--gg-c-orange, #FF9F0A); --t2: var(--gg-l78, rgba(235, 235, 245, 0.78)); --spur: rgba(120, 120, 128, 0.32); }
        :host([tag]) { --spur: rgba(120, 120, 128, 0.2); }
        button { font: inherit; color: inherit; border: none; outline: none; background: none; cursor: pointer; padding: 0; -webkit-tap-highlight-color: transparent; }
        /* Pop-up */
        .voll { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 8px 0 4px; }
        .ring { position: relative; width: 230px; height: 230px; }
        .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
        .ring circle { fill: none; stroke-width: 10; }
        .ring .bg { stroke: var(--spur); }
        .ring .fg { stroke: var(--o); stroke-linecap: round; transition: stroke-dashoffset 0.9s linear; }
        .mitte { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
        .mitte ha-icon { --mdc-icon-size: 30px; color: var(--o); margin-bottom: 4px; }
        .mitte b { font-size: 52px; font-weight: 600; letter-spacing: -1.5px; line-height: 1; font-variant-numeric: tabular-nums; }
        .mitte small { font-size: 15px; color: var(--t2); text-align: center; max-width: 170px; }
        .los { width: min(100%, 420px); height: 54px; border-radius: 27px; background: var(--o); color: #FFF; font-size: 18px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; --mdc-icon-size: 22px; transition: transform 0.12s ease, background 0.2s ease; }
        .los.stopp { background: var(--gg-zelle, rgba(255, 255, 255, 0.1)); color: var(--gg-c-rot, #FF453A); }
        .los.frage { background: var(--gg-c-rot, #FF453A); color: #FFF; }
        .los:active { transform: scale(0.97); }
        .info { width: 100%; border-radius: 22px; background: var(--gg-zelle, rgba(255, 255, 255, 0.08)); overflow: hidden; }
        .zi { position: relative; display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; column-gap: 12px; align-items: center; padding: 11px 14px; }
        .zi + .zi::before { content: ''; position: absolute; left: 58px; right: 0; top: 0; height: 0.5px; background: var(--gg-trenner, rgba(84, 84, 88, 0.65)); }
        .zi ha-icon { --mdc-icon-size: 18px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--f, var(--o)); background: color-mix(in srgb, var(--f, var(--o)) 22%, transparent); }
        .zi span { font-size: 15px; } .zi span small { display: block; font-size: 12.5px; color: var(--t2); }
        .zi b { font-size: 15px; font-weight: 600; color: var(--t2); white-space: nowrap; }
        .zi b.an { color: var(--gg-c-gruen, #30D158); }
        .dauer { width: min(100%, 420px); display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; column-gap: 12px; font-size: 14px; font-weight: 600; color: var(--t2); font-variant-numeric: tabular-nums; }
        .dauer[hidden] { display: none; }
        .dauer input { -webkit-appearance: none; appearance: none; width: 100%; height: 32px; margin: 0; background: transparent; cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent; }
        .dauer input::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(to right, var(--o) var(--p, 50%), var(--spur) var(--p, 50%)); }
        .dauer input::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px; margin-top: -11px; border-radius: 50%; background: #FFF; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35), 0 0 0 0.5px rgba(0, 0, 0, 0.12); }
        .dauer input::-moz-range-track { height: 6px; border-radius: 3px; background: var(--spur); }
        .dauer input::-moz-range-progress { height: 6px; border-radius: 3px; background: var(--o); }
        .dauer input::-moz-range-thumb { width: 28px; height: 28px; border: none; border-radius: 50%; background: #FFF; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35); }
        /* Nest-Kachel (quadratisch) */
        .kachel { position: relative; box-sizing: border-box; width: 100%; aspect-ratio: 1 / 1; border-radius: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; overflow: hidden;
          background: var(--gg-nestfrost, rgba(118, 118, 132, 0.36)); box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.16), 0 8px 24px rgba(0, 0, 0, 0.16); transition: transform 0.12s ease; }
        .kachel:active { transform: scale(0.96); }
        .kachel.an { background: color-mix(in srgb, var(--o) 30%, rgba(40, 40, 46, 0.7)); }
        .kachel.frage { background: color-mix(in srgb, var(--gg-c-rot, #FF453A) 45%, rgba(40, 40, 46, 0.7)); }
        .kachel .ic { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--o); background: color-mix(in srgb, var(--o) 22%, transparent); --mdc-icon-size: 24px; }
        .kachel.an .ic, .kachel.frage .ic { color: #FFF; background: var(--o); }
        .kachel.frage .ic { background: var(--gg-c-rot, #FF453A); }
        .kachel b { font-size: 17px; font-weight: 600; line-height: 20px; text-align: center; padding: 0 6px; }
        .kachel.an b { font-size: 24px; font-variant-numeric: tabular-nums; }
        .kachel .rand { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
        .kachel .rand path { fill: none; stroke-width: 3.2; stroke-linecap: round; }
        .kachel .rand .spur { stroke: transparent; }
        .kachel.an .rand .spur { stroke: rgba(255, 255, 255, 0.16); }
        .kachel .rand .lauf { stroke: var(--o); transition: stroke-dasharray 0.9s linear; }
        .kachel:not(.an) .rand .lauf { stroke: transparent; }
        ha-icon { line-height: 0; }
      </style>` + (k
        ? '<button class="kachel"><svg class="rand" viewBox="0 0 100 100" preserveAspectRatio="none"><path class="spur" pathLength="100" d="M50,1.6 H78.4 A20,20 0 0 1 98.4,21.6 V78.4 A20,20 0 0 1 78.4,98.4 H21.6 A20,20 0 0 1 1.6,78.4 V21.6 A20,20 0 0 1 21.6,1.6 Z"/><path class="lauf" pathLength="100" stroke-dasharray="0 100" d="M50,1.6 H78.4 A20,20 0 0 1 98.4,21.6 V78.4 A20,20 0 0 1 78.4,98.4 H21.6 A20,20 0 0 1 1.6,78.4 V21.6 A20,20 0 0 1 21.6,1.6 Z"/></svg><span class="ic"><ha-icon icon="mdi:toaster"></ha-icon></span><b>Kohlegrill</b></button>'
        : `<div class="voll"><div class="ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" cx="60" cy="60" r="54" stroke-dasharray="339.29" stroke-dashoffset="339.29"/></svg>
             <div class="mitte"><ha-icon icon="mdi:toaster"></ha-icon><b>10:00</b><small>Bereit</small></div></div>
             <div class="dauer" hidden><span class="d0">8 Min.</span><input type="range" min="480" max="720" step="15" value="600" aria-label="Dauer des Timers"><span class="d1">12 Min.</span></div>
             <button class="los"><ha-icon icon="mdi:fire"></ha-icon><span>Kohlegrill anschalten</span></button>
             <div class="info">
               <div class="zi"><ha-icon icon="mdi:power-socket-de"></ha-icon><span>Außensteckdose<small class="sdx"></small></span><b class="sd">Aus</b></div>
               <div class="zi" style="--f: var(--gg-c-gelb, #FFD60A)"><ha-icon icon="mdi:lightbulb-on-outline"></ha-icon><span><em class="nm" style="font-style: normal">Nach 10 Min.</em><small>Steckdose aus · Schrankbeleuchtung pulsiert, bis die Tür Ost aufgeht · Mitteilung aufs iPhone</small></span><b></b></div>
               <div class="zi" style="--f: var(--gg-c-gruen, #30D158)"><ha-icon icon="mdi:check-circle-outline"></ha-icon><span>Zuletzt bereit</span><b class="zl">–</b></div>
             </div></div>`);
      this._r = r;
      r.querySelector(k ? '.kachel' : '.los').addEventListener('click', () => this._tipp());
      const rg = r.querySelector('.dauer input');
      if (rg) {
        const fertig = () => { this._zieht = false; };
        rg.addEventListener('pointerdown', () => { this._zieht = true; });
        rg.addEventListener('pointerup', fertig);
        rg.addEventListener('pointercancel', fertig);
        rg.addEventListener('input', () => {
          const v = Number(rg.value);
          this._lokal = v; this._lokalT = Date.now();
          if (v !== this._letzt) { this._letzt = v; haptik('light'); }
          this._zeige();
        });
        rg.addEventListener('change', () => {
          const v = Number(rg.value);
          this._lokal = v; this._lokalT = Date.now(); this._zieht = false;
          this._h.callService('input_number', 'set_value', { entity_id: this._c.dauer, value: v }).catch((e) => hinweis('Fehler: ' + ((e && e.message) || e)));
        });
      }
    }
    _tipp() {
      const h = this._h, c = this._c, s = this._status();
      const laeuft = s.st === 'active' || s.st === 'paused';
      const k = c.art === 'kachel';
      /* Starten auf dem Nest und Abbrechen überall nur mit zweitem Tippen (Schutz vor versehentlichem Anzünden) */
      if ((laeuft || k) && !(this._frage && Date.now() - this._frage < 4000)) { this._frage = Date.now(); haptik('warning'); this._zeige(); return; }
      this._frage = 0;
      haptik(laeuft ? 'light' : 'success');
      const [d, n] = (laeuft ? c.stopp : c.start).split('.');
      h.callService(d, n, {}).catch((e) => hinweis('Fehler: ' + ((e && e.message) || e)));
      if (!laeuft) hinweis('Kohlegrill an · <b>fertig in ' + minTxt(s.dauer) + '</b>');
    }
    _zeige() {
      if (!this._r || !this._h) return;
      const s = this._status(), k = this._c.art === 'kachel';
      const laeuft = s.st === 'active' || s.st === 'paused';
      const frage = this._frage && Date.now() - this._frage < 4000;
      if (!frage && this._frage) this._frage = 0;
      const anteil = laeuft ? Math.min(1, Math.max(0, 1 - s.rest / s.dauer)) : 0;
      if (k) {
        const el = this._r.querySelector('.kachel');
        el.className = 'kachel' + (laeuft ? ' an' : '') + (frage ? ' frage' : '');
        el.querySelector('b').textContent = frage ? (laeuft ? 'Stopp?' : 'Starten?') : laeuft ? mmss(s.rest) : 'Kohlegrill';
        const pz = laeuft ? Math.max(0.5, anteil * 100) : 0;
        el.querySelector('.lauf').setAttribute('stroke-dasharray', pz.toFixed(2) + ' 100');
        return;
      }
      const fg = this._r.querySelector('.fg');
      fg.style.strokeDashoffset = (339.29 * (1 - anteil)).toFixed(1);
      const lokal = this._lokal != null && Date.now() - this._lokalT < 3000;
      if (!lokal) this._lokal = null;
      const dz = lokal ? this._lokal : s.dauer;
      const reg = this._r.querySelector('.dauer'), rg = reg.querySelector('input');
      const rs = this._h.states[this._c.dauer], at = (rs && rs.attributes) || {};
      reg.hidden = laeuft || !s.regler;
      if (!reg.hidden) {
        const mn = Number(at.min) || 480, mx = Number(at.max) || 720, stp = Number(at.step) || 15;
        rg.min = mn; rg.max = mx; rg.step = stp;
        if (!this._zieht) rg.value = dz;
        reg.style.setProperty('--p', Math.max(0, Math.min(100, (dz - mn) / (mx - mn) * 100)).toFixed(1) + '%');
        reg.querySelector('.d0').textContent = minTxt(mn); reg.querySelector('.d1').textContent = minTxt(mx);
      }
      this._r.querySelector('.nm').textContent = 'Nach ' + minTxt(dz);
      this._r.querySelector('.mitte b').textContent = mmss(laeuft ? s.rest : dz);
      this._r.querySelector('.mitte small').textContent = s.st === 'active' && s.ende ? 'bereit ' + hhmm(s.ende) : s.st === 'paused' ? 'Pausiert' : s.st === 'unavailable' ? 'Timer nicht verfügbar' : 'Bereit';
      const los = this._r.querySelector('.los');
      los.className = 'los' + (frage ? ' frage' : laeuft ? ' stopp' : '');
      los.querySelector('span').textContent = frage ? 'Wirklich abbrechen?' : laeuft ? 'Abbrechen' : 'Kohlegrill anschalten';
      los.querySelector('ha-icon').setAttribute('icon', laeuft ? 'mdi:close' : 'mdi:fire');
      const sd = this._r.querySelector('.sd');
      sd.textContent = s.an ? 'Ein' : 'Aus';
      sd.className = 'sd' + (s.an ? ' an' : '');
      this._r.querySelector('.sdx').textContent = s.platzhalter ? 'Platzhalter – echte Steckdose folgt' : '';
      this._r.querySelector('.zl').textContent = s.zuletzt && Date.now() - s.zuletzt < 30 * 86400000 ? kurz(s.zuletzt.getTime() / 1000) : '–';
    }
  }
  if (!customElements.get('gg-pfeife')) customElements.define('gg-pfeife', GgPfeife);
})();
