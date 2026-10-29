/* gg-auto v21 (Werte einheitlich: Bezeichnung grau klein, Wert größer dunkelgrau; Tank ≤ 20 % rot) / v20 – Reifendruck in bar (eine Nachkommastelle, „bar“ klein, HTML statt SVG-Text, kleiner), Fahrzeug kleiner, Werte rechts größer,
   orange Punkte auf offenen Teilen (nur Anzeige), keine Tippflächen mehr am Auto und an der Statuszeile, nach dem Entriegeln kein „gesendet“
   (Knopf zeigt bis zur Rückmeldung „läuft“, Fehler als Hinweis), Aktion optional nur für bestimmte Benutzer (`nutzer: [user_id]`),
   Aktionsknöpfe mittig über die ganze Karte. Neue Karte custom:gg-auto-profil (Fahrverhalten Woche/Monat/Jahr).
   v19 – echte Mercedes-Daten (mbapi2020): Quellen/Werte-Codes, nur Aktionen, die der Wagen kann (mittig), Reifendruck kPa → bar,
   veraltete Werte (Entität-Zeitstempel älter als 14 Tage) grau + Fußzeile „Stand …“, „Alles schließen“ nur mit Fenster-/Dach-Aktion,
   Teile ohne Fernsteuerung (Fenster, Dach) zeigen beim Antippen „nur Anzeige“.
   v18 – ruhiges Apple-Layout (Wallet-Autoschlüssel/Health): Statuszeile statt Pillen, keine Punkte auf dem Foto (Tippflächen bleiben),
   runde neutrale Aktionsknöpfe, Details als Liste mit Haarlinien statt Kacheln.
   v17 – Fahrzeug-Übersicht von oben (Mercedes E200 Coupé, Foto aus Ressource gg-auto-foto → window.GG_AUTO_FOTO).
   Türen, Fenster, Schiebedach, Motorhaube, Heckklappe und Tankklappe bewegen sich im Foto (Teile direkt antippen).
   Punkte: in der Vorschau lässt sich alles öffnen/schließen; sonst nur Fenster und Dach steuerbar, Türen/Haube/Heckklappe/Tankklappe zeigen nur den Status.
   Konfiguration:
     name, vorschau: 'input_boolean.…', tankseite: 'rechts' | 'links',
     tank: { prozent, reichweite, kilometer, frist },
     quellen: { tuer_vl, tuer_vr, haube, heckklappe, fenster_vl, fenster_vr, fenster_hl, fenster_hr, schiebedach, tankklappe,
                verriegelt, reifen_vl, reifen_vr, reifen_hl, reifen_hr }  – 'entity' | 'entity#attribut' | { entity, attr, offen: […], kipp: […], zu: […] }
     aktionen: [{ name, icon, entity?, dienst: 'domain.service', daten: {…}, bestaetigen: true }],
     infos: [{ name, icon, entity, einheit, nachkomma, werte: {rohwert: 'Text'}, vorschau }],
     alles_zu: 'script.…' (optional – sonst nacheinander Fenster zu, Dach zu, verriegeln)  */
(() => {
  if (customElements.get('gg-auto')) return;
  const NAMEN = { tuer_vl: 'Fahrertür', tuer_vr: 'Beifahrertür', haube: 'Motorhaube', heckklappe: 'Heckklappe', fenster_vl: 'Fenster Fahrer', fenster_vr: 'Fenster Beifahrer', fenster_hl: 'Fenster hinten links', fenster_hr: 'Fenster hinten rechts', schiebedach: 'Schiebedach', tankklappe: 'Tankklappe' };
  const FENSTER = ['fenster_vl', 'fenster_vr', 'fenster_hl', 'fenster_hr'];
  const OFFEN = ['on', 'true', 'open', 'opened', 'offen', '1', 'yes'];
  const WEG = ['unavailable', 'unknown', 'none', ''];
  const VORSCHAU = { tank: { prozent: 38, reichweite: 245, kilometer: 41230, frist: 'Di, 27.10.' }, reifen: [2.4, 2.4, 2.6, 2.6] };
  const SIM = {
    doors_lock: { verriegelt: true }, doors_unlock: { verriegelt: false },
    windows_open: { fenster_vl: true, fenster_vr: true, fenster_hl: true, fenster_hr: true },
    windows_close: { fenster_vl: false, fenster_vr: false, fenster_hl: false, fenster_hr: false },
    sunroof_open: { schiebedach: true }, sunroof_tilt: { schiebedach: 'kipp' }, sunroof_close: { schiebedach: false },
    preheat_start: { klima: true }, preheat_stop: { klima: false }, auxheat_start: { klima: true }, auxheat_stop: { klima: false },
  };
  /* je Funktion ein Knopf: [Aktion wenn zu/aus, Aktion wenn offen/an] */
  const PAARE = { verriegelt: ['doors_lock', 'doors_unlock'], fenster: ['windows_open', 'windows_close'], schiebedach: ['sunroof_open', 'sunroof_close'], klima: ['preheat_start', 'preheat_stop'], heizung: ['auxheat_start', 'auxheat_stop'] };
  const num = (v) => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null; };
  const zerlege = (q) => (!q ? null : typeof q === 'string' ? (q.includes('#') ? { entity: q.split('#')[0], attr: q.split('#')[1] } : { entity: q }) : q);
  const CSS = `
    :host { display: block; --f: var(--gg-c-blau, #0A84FF); font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; }
    .karte { container-type: inline-size; box-sizing: border-box; padding: 16px 16px 6px; border-radius: 27px; background: var(--gg-zelle, rgba(255, 255, 255, 0.08)); box-shadow: var(--gg-zellschatten, none); color: var(--gg-t1, #FFFFFF); }
    /* Kopf: Status links, „Alles schließen“ als Textknopf rechts (nur wenn nötig) */
    .kopf { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; min-height: 42px; }
    .status { min-width: 0; }
    .status b { display: flex; align-items: center; gap: 6px; font-size: 20px; font-weight: 600; letter-spacing: -0.4px; line-height: 24px; --mdc-icon-size: 20px; }
    .status b ha-icon { color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }
    .status b.zu ha-icon { color: var(--gg-c-gruen, #30D158); }
    .status b.auf ha-icon { color: var(--gg-c-orange, #FF9F0A); }
    #sum { margin-top: 2px; font-size: 13px; line-height: 18px; height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }
    #sum.warn { color: var(--gg-c-orange, #FF9F0A); }
    #alleszu { all: unset; flex: none; cursor: pointer; margin-top: 2px; font-size: 15px; font-weight: 600; line-height: 20px; color: var(--gg-c-blau, #0A84FF); }
    #alleszu:active { opacity: 0.5; }
    #alleszu.frage { color: var(--gg-c-orange, #FF9F0A); }
    #alleszu.aus { visibility: hidden; }
    /* Fahrzeug + Werte */
    .bild { margin-top: 6px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(108px, 128px); align-items: center; column-gap: 26px; }
    .fz { position: relative; width: 100%; max-width: calc(var(--hmax, 250px) * 1030 / 1776); aspect-ratio: 1030 / 1776; margin: 0 auto; }
    .fz svg { display: block; width: 100%; height: 100%; overflow: visible; }
    /* Reifendruck: kleine Zahl + „bar“, links/rechts neben den Rädern */
    .rp { position: absolute; top: var(--y); transform: translateY(-50%); font-size: 13px; line-height: 16px; font-weight: 500; white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); pointer-events: none; }
    .rp.l { right: calc(100% - var(--x)); }
    .rp.r { left: var(--x); }
    .rp small { font-size: 11px; margin-left: 2px; }
    .rp.warn { color: var(--gg-c-orange, #FF9F0A); }
    /* offenes Teil: kleiner oranger Punkt (nur Anzeige) */
    .pt { position: absolute; left: var(--x); top: var(--y); width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: var(--gg-c-orange, #FF9F0A); box-shadow: 0 0 0 2px var(--gg-schatten, rgba(0, 0, 0, 0.35)); opacity: 0; transform: scale(0.4); transition: opacity 0.25s ease, transform 0.25s ease; pointer-events: none; }
    .pt.an { opacity: 1; transform: none; }
    .werte { min-width: 0; }
    .wert { min-width: 0; padding: 10px 0; border-top: 0.5px solid var(--gg-trenner, rgba(84, 84, 88, 0.65)); }
    .wert:first-child { border-top: none; padding-top: 0; }
    .wert small { display: block; font-size: 13px; line-height: 16px; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wert b { display: block; margin-top: 2px; font-size: 22px; font-weight: 600; letter-spacing: -0.4px; line-height: 26px; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--gg-l85, rgba(235, 235, 245, 0.85)); }
    .wert b.rot { color: var(--gg-c-rot, #FF453A); }
    .wert b u { text-decoration: none; font-size: 13px; font-weight: 500; margin-left: 2px; letter-spacing: 0; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }
    .wert i { display: block; height: 4px; margin-top: 6px; border-radius: 2px; background: var(--gg-f12, rgba(255, 255, 255, 0.12)); overflow: hidden; }
    .wert i s { display: block; height: 100%; border-radius: 2px; background: var(--c, var(--gg-c-gruen, #30D158)); }
    .wert em { display: block; margin-top: 4px; font-size: 12px; font-style: normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }
    @container (min-width: 521px) {
      .bild { grid-template-columns: minmax(0, 40%) minmax(0, 1fr); column-gap: 28px; }
      .fz { --hmax: 330px; }
      .wert { padding: 16px 0; }
      .wert small { font-size: 15px; line-height: 20px; }
      .wert b { font-size: 34px; line-height: 40px; letter-spacing: -0.6px; }
      .wert b u { font-size: 17px; }
      .wert i { height: 5px; margin-top: 8px; }
      .wert em { font-size: 13px; }
    }
    /* Aktionen: runde, neutrale Knöpfe (wie Autoschlüssel in Apple Wallet) */
    .aktionen { width: 100%; margin: 16px 0 4px; display: flex; justify-content: center; gap: 16px; }
    .aktionen:empty { display: none; }
    .aktionen button { all: unset; box-sizing: border-box; flex: 0 0 88px; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; padding: 2px 0; cursor: pointer; text-align: center; }
    .aktionen .kreis { font-style: normal; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--gg-f12, rgba(255, 255, 255, 0.12)); color: var(--gg-t1, #FFFFFF); --mdc-icon-size: 24px; transition: background-color 0.2s ease, transform 0.12s ease; }
    .aktionen button:active .kreis { transform: scale(0.94); }
    .aktionen span { max-width: 100%; font-size: 11px; line-height: 13px; font-weight: 500; color: var(--gg-l78, rgba(235, 235, 245, 0.78)); overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; hyphens: auto; }
    .aktionen button.frage .kreis { background: var(--gg-c-orange, #FF9F0A); color: #FFFFFF; }
    .aktionen button.frage span { color: var(--gg-c-orange, #FF9F0A); }
    .aktionen button.weg { opacity: 0.35; pointer-events: none; }
    .aktionen button.laeuft { pointer-events: none; }
    .aktionen button.laeuft .kreis { opacity: 0.5; }
    @container (min-width: 521px) { .aktionen .kreis { width: 56px; height: 56px; } .aktionen span { font-size: 12px; line-height: 14px; } }
    /* Details: schlichte Liste mit Haarlinien, ohne Kacheln und bunte Symbole */
    .infos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; margin-top: 12px; }
    .infos:empty { display: none; }
    .info { min-width: 0; padding: 10px 0; border-top: 0.5px solid var(--gg-trenner, rgba(84, 84, 88, 0.65)); }
    .info small { display: block; font-size: 13px; line-height: 16px; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .info b { display: block; margin-top: 2px; font-size: 19px; font-weight: 600; letter-spacing: -0.3px; line-height: 24px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--gg-l85, rgba(235, 235, 245, 0.85)); }
    .info.warn b { color: var(--gg-c-orange, #FF9F0A); }
    .veraltet { margin: 10px 0 2px; font-size: 12px; line-height: 16px; white-space: pre-line; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }
    .veraltet:empty { display: none; }
    .hinweis { min-height: 0; margin: 2px 0 8px; font-size: 12px; line-height: 16px; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }
    .hinweis:empty { margin: 0; }
    /* Fahrzeug */
    .teil { pointer-events: none; }
    .unter { opacity: 0; transition: opacity 0.25s ease 0.75s; }
    .auf .unter, .kipp .unter { opacity: 1; transition-delay: 0s; }
    .klon { transform-origin: 0 0; transition: transform 1s cubic-bezier(0.3, 0.75, 0.25, 1); }
    .k_tvl { transform: translate(52px, 604px) rotate(0deg) translate(-52px, -604px); }
    .auf .k_tvl { transform: translate(52px, 604px) rotate(32deg) translate(-52px, -604px); }
    .k_tvr { transform: translate(718px, 604px) rotate(0deg) translate(-718px, -604px); }
    .auf .k_tvr { transform: translate(718px, 604px) rotate(-32deg) translate(-718px, -604px); }
    .k_haube { transform: translate(385px, 505px) scale(1, 1) translate(-385px, -505px); }
    .auf .k_haube { transform: translate(385px, 505px) scale(1, 0.36) translate(-385px, -505px); }
    .k_heck { transform: translate(385px, 1535px) scale(1, 1) translate(-385px, -1535px); }
    .auf .k_heck { transform: translate(385px, 1535px) scale(1, 0.58) translate(-385px, -1535px); }
    .k_dach { transform: translate(0px, 0px); transition: transform 2.8s cubic-bezier(0.45, 0.05, 0.25, 1); }
    .auf .k_dach { transform: translate(0px, 272px); }
    .kipp .k_dach { transform: translate(0px, 24px); }
    #schiebedach .unter { transition: opacity 0.25s ease 2.6s; }
    #schiebedach.auf .unter, #schiebedach.kipp .unter { transition-delay: 0s; }
    .glas { transition: transform 2.6s cubic-bezier(0.4, 0.1, 0.3, 1); transform: translate(0px, 0px); }
    .fe .unter { transition: opacity 0.25s ease 2.4s; }
    .fe.auf .unter { transition-delay: 0s; }
    #fenster_vl.auf .glas, #fenster_hl.auf .glas { transform: translate(-80px, 0px); }
    #fenster_vr.auf .glas, #fenster_hr.auf .glas { transform: translate(80px, 0px); }
    .tk .loch { opacity: 0; transition: opacity 0.3s ease 0.4s; }
    .tk .klappe { fill: url(#lack); opacity: 0; transform-origin: 0 0; transition: transform 0.7s cubic-bezier(0.3, 0.75, 0.25, 1), opacity 0.3s ease 0.4s; }
    #tankklappe.auf .loch, #tankklappe.auf .klappe { opacity: 1; transition-delay: 0s; }
    .kr { transform: translate(715px, 1476px) rotate(0deg) translate(-715px, -1476px); }
    #tankklappe.auf .kr { transform: translate(715px, 1476px) rotate(-75deg) translate(-715px, -1476px); }
    .kl { transform: translate(55px, 1476px) rotate(0deg) translate(-55px, -1476px); }
    #tankklappe.auf .kl { transform: translate(55px, 1476px) rotate(75deg) translate(-55px, -1476px); }
    .leer #auto { opacity: 0.6; }
  `;
  const TVL = '58,588 100,600 112,640 118,700 132,760 140,800 150,850 158,900 166,1000 168,1092 85,1086 50,1100 40,1000 38,850 40,700 45,620';
  const TVR = '712,588 670,600 658,640 652,700 640,760 634,800 624,850 618,900 613,1000 611,1092 685,1086 720,1100 730,1000 732,850 730,700 725,620';
  const FVL = '124,752 128,760 138,790 144,820 150,850 156,880 160,910 164,940 166,970 168,1000 168,1082 104,1082 101,1040 99,960 98,880 97,800 97,752';
  const FVR = '658,748 650,760 646,780 640,800 634,840 628,870 622,910 618,950 614,1000 612,1040 612,1082 662,1082 666,1040 666,1000 668,960 671,900 673,840 673,800 672,760 668,750';
  const FHL = '109,1104 164,1104 162,1150 160,1200 156,1250 152,1300 146,1350 140,1400 132,1440 124,1455 121,1440 117,1400 115,1350 118,1300 117,1250 114,1200 111,1150';
  const FHR = '616,1104 661,1104 657,1150 655,1200 652,1250 647,1300 643,1350 644,1380 637,1410 639,1455 636,1445 631,1410 628,1380 624,1350 620,1300 618,1250 618,1150';
  const THL = '-70,590 58,588 100,600 112,640 118,690 94,700 95,800 97,880 98,960 100,1040 104,1082 85,1086 50,1100 -70,1100';
  const THR = '840,590 712,588 670,600 658,640 654,690 686,700 682,780 676,840 668,900 668,960 664,1020 662,1082 685,1086 720,1100 840,1100';
  const HA = '110,551 140,533 177,520 218,514 272,499 366,491 451,493 483,499 560,505 656,539 668,525 682,492 686,426 684,320 673,184 662,144 647,114 593,63 577,57 483,39 403,39 344,34 293,44 223,46 194,55 158,72 139,97 102,131 96,150 91,180 88,220 85,270 80,340 79,389 82,450 84,515 97,539 105,542';
  const HE = '150,1528 175,1555 220,1580 300,1600 400,1606 500,1597 560,1578 598,1548 618,1532 628,1570 628,1620 620,1665 610,1695 598,1712 550,1726 400,1734 250,1724 160,1712 145,1695 138,1660 136,1600 138,1555';
  const DA = '204,866 589,866 586,1000 580,1100 575,1168 213,1168 208,1100 205,1000';
  const M = (p) => p.split(' ').map((a) => (770 - a.split(',')[0]) + ',' + a.split(',')[1]).join(' ');
  const SITZ = (x) => `<g transform="translate(${x} 0)"><rect x="-76" y="800" width="152" height="135" rx="34" fill="url(#leder)"/><rect x="-52" y="812" width="104" height="112" rx="22" fill="#1A1B1E"/><path d="M-40 830h80M-40 852h80M-40 874h80M-40 896h80" stroke="rgba(255,255,255,.07)" stroke-width="3"/><rect x="-84" y="928" width="168" height="118" rx="30" fill="url(#leder)"/><rect x="-56" y="940" width="112" height="92" rx="20" fill="#18191C"/><rect x="-42" y="1040" width="84" height="44" rx="18" fill="url(#leder)"/></g>`;
  const UNTEN = `
      <filter id="rau" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/></filter>
      <linearGradient id="leder" x1="0" x2="1"><stop offset="0" stop-color="#2C2D31"/><stop offset=".5" stop-color="#1D1E21"/><stop offset="1" stop-color="#2C2D31"/></linearGradient>
      <radialGradient id="vign" cx=".5" cy=".5" r=".62"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
      <linearGradient id="alu" x1="0" x2="1"><stop offset="0" stop-color="#3E4247"/><stop offset=".5" stop-color="#7D838A"/><stop offset="1" stop-color="#454950"/></linearGradient>
      <linearGradient id="deckel" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#303236"/><stop offset=".6" stop-color="#1D1E21"/><stop offset="1" stop-color="#121315"/></linearGradient>
      <linearGradient id="mboden" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101114"/><stop offset=".6" stop-color="#17181C"/><stop offset="1" stop-color="#0B0C0E"/></linearGradient>
      <linearGradient id="gehaeuse" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A3E44"/><stop offset=".5" stop-color="#1A1C20"/><stop offset="1" stop-color="#0C0D0F"/></linearGradient>
      <radialGradient id="dom" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#9AA0A8"/><stop offset=".55" stop-color="#4B4F56"/><stop offset="1" stop-color="#1D1F23"/></radialGradient>
      <linearGradient id="glanz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".13"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient>
      <radialGradient id="glanz2" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
      <pattern id="lamellen" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#121315"/><rect width="12" height="5" fill="#26282C"/></pattern>
      <g id="motor">
        <rect x="60" y="0" width="650" height="560" fill="url(#mboden)"/>
        <rect x="60" y="0" width="650" height="560" filter="url(#rau)" opacity=".06"/>
        <path d="M120 38Q385 4 650 38L664 118Q385 86 106 118Z" fill="#0A0B0D"/><path d="M150 52Q385 22 620 52L626 82Q385 54 144 82Z" fill="url(#lamellen)" opacity=".8"/>
        <path d="M96 92Q150 76 214 88L206 176Q140 184 92 168Z" fill="url(#gehaeuse)"/><path d="M674 92Q620 76 556 88L564 176Q630 184 678 168Z" fill="url(#gehaeuse)"/>
        <path d="M106 108Q150 98 198 106" stroke="rgba(255,255,255,.14)" stroke-width="3" fill="none"/><path d="M664 108Q620 98 572 106" stroke="rgba(255,255,255,.14)" stroke-width="3" fill="none"/>
        <path d="M96 190L206 196 218 430 112 452Z" fill="#101114"/><path d="M674 190L564 196 552 430 658 452Z" fill="#101114"/>
        <circle cx="152" cy="330" r="62" fill="#08090B"/><circle cx="152" cy="330" r="52" fill="url(#dom)"/><circle cx="152" cy="330" r="21" fill="#0F1013"/><circle cx="152" cy="330" r="21" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="2"/>
        <circle cx="618" cy="330" r="62" fill="#08090B"/><circle cx="618" cy="330" r="52" fill="url(#dom)"/><circle cx="618" cy="330" r="21" fill="#0F1013"/><circle cx="618" cy="330" r="21" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="2"/>
        <g fill="#6B7076"><circle cx="152" cy="280" r="4.5"/><circle cx="108" cy="352" r="4.5"/><circle cx="196" cy="352" r="4.5"/><circle cx="618" cy="280" r="4.5"/><circle cx="574" cy="352" r="4.5"/><circle cx="662" cy="352" r="4.5"/></g>
        <path d="M214 150Q385 118 556 150L566 420Q385 452 204 420Z" fill="#0A0B0D"/>
        <path d="M262 160Q385 138 508 160L518 410Q385 432 252 410Z" fill="url(#deckel)"/>
        <path d="M262 160Q385 138 508 160L518 410Q385 432 252 410Z" fill="url(#glanz)"/>
        <path d="M262 160Q385 138 508 160L518 410Q385 432 252 410Z" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="2.5"/>
        <path d="M282 196Q385 178 488 196M280 232Q385 214 490 232M278 268Q385 250 492 268M276 304Q385 286 494 304M274 340Q385 322 496 340" stroke="rgba(255,255,255,.045)" stroke-width="5" fill="none" stroke-linecap="round"/>
        <rect x="318" y="372" width="134" height="14" rx="4" fill="#1A1B1F" stroke="rgba(255,255,255,.1)" stroke-width="1.5"/>
        <circle cx="304" cy="214" r="17" fill="#12100A"/><circle cx="304" cy="214" r="13" fill="#B58E1E"/><circle cx="304" cy="214" r="13" fill="url(#glanz2)"/><circle cx="304" cy="214" r="6" fill="#4B3A0D"/>
        <path d="M514 204Q562 196 584 188L588 236Q560 246 516 252Z" fill="#0A0B0D"/>
        <rect x="536" y="168" width="108" height="170" rx="22" fill="#0B0C0E"/><rect x="544" y="178" width="92" height="150" rx="16" fill="#15161A"/>
        <path d="M552 200h76M552 224h76M552 248h76M552 272h76M552 296h76" stroke="rgba(255,255,255,.06)" stroke-width="4" stroke-linecap="round"/>
        <path d="M590 168C592 136 600 118 622 108" stroke="#0A0B0D" stroke-width="30" fill="none" stroke-linecap="round"/>
        <path d="M214 232Q168 250 150 300" stroke="#0A0B0D" stroke-width="14" fill="none" stroke-linecap="round"/>
        <rect x="128" y="190" width="58" height="60" rx="12" fill="#3A3D42"/><rect x="132" y="194" width="50" height="52" rx="9" fill="#26282C"/><circle cx="157" cy="204" r="9" fill="#C9A227"/><circle cx="157" cy="204" r="9" fill="url(#glanz2)"/>
        <rect x="598" y="372" width="48" height="60" rx="12" fill="#B9BEC4" opacity=".4"/><rect x="604" y="378" width="36" height="48" rx="8" fill="#1B2A44" opacity=".55"/><circle cx="622" cy="372" r="9" fill="#1F5FBF"/>
        <circle cx="236" cy="452" r="12" fill="#1E64C8"/><circle cx="236" cy="452" r="12" fill="url(#glanz2)"/><path d="M236 440V400" stroke="#0A0B0D" stroke-width="8"/>
        <path d="M70 468Q385 438 700 468L706 560L64 560Z" fill="#08090B"/>
        <path d="M95 478Q385 448 675 478L672 548Q385 518 98 548Z" fill="url(#lamellen)" opacity=".95"/>
        <path d="M95 478Q385 448 675 478" stroke="rgba(255,255,255,.12)" stroke-width="2.5" fill="none"/>
        <g fill="#8A9097" opacity=".75"><rect x="196" y="500" width="9" height="30" rx="4"/><rect x="566" y="500" width="9" height="30" rx="4"/></g>
      </g>
      <g id="kabine">
        <rect x="30" y="540" width="710" height="1060" fill="#18191C"/>
        <rect x="30" y="540" width="710" height="1060" filter="url(#rau)" opacity=".08"/>
        <rect x="40" y="600" width="40" height="515" rx="8" fill="url(#alu)"/><rect x="690" y="600" width="40" height="515" rx="8" fill="url(#alu)"/>
        <path d="M80 600h610" stroke="#0B0C0E" stroke-width="2"/>
        <path d="M70 545Q385 520 700 545L700 740Q385 700 70 740Z" fill="#121316"/>
        <path d="M70 545Q385 520 700 545L700 560Q385 536 70 560Z" fill="#26282C"/>
        <rect x="285" y="635" width="200" height="66" rx="12" fill="#050607"/><path d="M295 645L360 645 320 692 295 692Z" fill="rgba(255,255,255,.07)"/>
        <circle cx="175" cy="700" r="20" fill="none" stroke="url(#alu)" stroke-width="6"/><circle cx="595" cy="700" r="20" fill="none" stroke="url(#alu)" stroke-width="6"/>
        <circle cx="352" cy="730" r="17" fill="none" stroke="url(#alu)" stroke-width="5"/><circle cx="418" cy="730" r="17" fill="none" stroke="url(#alu)" stroke-width="5"/>
        <circle cx="235" cy="768" r="78" fill="none" stroke="#0B0C0E" stroke-width="20"/><circle cx="235" cy="768" r="30" fill="#1E1F23"/><path d="M160 768h45M265 768h45M235 798v48" stroke="#0B0C0E" stroke-width="16"/>
        <rect x="338" y="745" width="94" height="320" rx="22" fill="#141518"/><circle cx="385" cy="880" r="16" fill="#3A3D42"/><circle cx="385" cy="880" r="16" fill="none" stroke="url(#alu)" stroke-width="3"/><rect x="350" y="960" width="70" height="98" rx="18" fill="url(#leder)"/>
        ${SITZ(235)}${SITZ(535)}
        <rect x="165" y="1145" width="440" height="228" rx="36" fill="#151619"/>
        <rect x="178" y="1158" width="196" height="122" rx="32" fill="url(#leder)"/><rect x="396" y="1158" width="196" height="122" rx="32" fill="url(#leder)"/>
        <rect x="178" y="1286" width="196" height="80" rx="26" fill="url(#leder)"/><rect x="396" y="1286" width="196" height="80" rx="26" fill="url(#leder)"/>
        <rect x="236" y="1368" width="80" height="34" rx="14" fill="url(#leder)"/><rect x="454" y="1368" width="80" height="34" rx="14" fill="url(#leder)"/>
        <rect x="150" y="1405" width="470" height="70" rx="10" fill="#101113"/><circle cx="215" cy="1440" r="20" fill="url(#lamellen)"/><circle cx="555" cy="1440" r="20" fill="url(#lamellen)"/>
      </g>
      <g id="tuerinnen">
        <path d="M60 640L170 650 190 1100 70 1110Z" fill="#1D1E21"/><path d="M98 660L104 1100" stroke="#0A0B0C" stroke-width="10"/><path d="M120 760Q150 880 152 1060" stroke="url(#alu)" stroke-width="4" fill="none"/><rect x="128" y="900" width="38" height="120" rx="14" fill="url(#leder)"/>
        <path d="M710 640L600 650 580 1100 700 1110Z" fill="#1D1E21"/><path d="M672 660L666 1100" stroke="#0A0B0C" stroke-width="10"/><path d="M650 760Q620 880 618 1060" stroke="url(#alu)" stroke-width="4" fill="none"/><rect x="604" y="900" width="38" height="120" rx="14" fill="url(#leder)"/>
        <path d="M90 1110L180 1110 172 1460 110 1460Z" fill="#1D1E21"/><path d="M680 1110L590 1110 598 1460 660 1460Z" fill="#1D1E21"/>
        <path d="M108 1120L112 1440M662 1120L658 1440" stroke="#0A0B0C" stroke-width="10"/>
      </g>
      <g id="kofferraum">
        <rect x="120" y="1500" width="530" height="260" fill="#26282C"/>
        <rect x="120" y="1500" width="530" height="260" filter="url(#rau)" opacity=".12"/>
        <path d="M120 1500h50l-6 250h-44ZM650 1500h-50l6 250h44Z" fill="#1A1B1E"/><path d="M170 1530Q385 1590 600 1530L600 1560Q385 1620 170 1560Z" fill="#1A1B1E"/>
        <rect x="150" y="1700" width="470" height="20" rx="8" fill="url(#alu)" opacity=".75"/><rect x="368" y="1703" width="34" height="14" rx="4" fill="#0E0F11"/>
        <circle cx="205" cy="1680" r="9" fill="url(#alu)"/><circle cx="565" cy="1680" r="9" fill="url(#alu)"/>
      </g>`;
  const DOTS = [['haube', 385, 300], ['schiebedach', 385, 1018], ['tuer_vl', 64, 930], ['tuer_vr', 706, 930], ['fenster_vl', 138, 900], ['fenster_vr', 632, 900], ['fenster_hl', 140, 1290], ['fenster_hr', 630, 1290], ['heckklappe', 385, 1655], ['tankklappe', 706, 1500]];
  const px = (x) => ((x + 130) / 1030 * 100).toFixed(2) + '%';
  const py = (y) => (y / 1776 * 100).toFixed(2) + '%';
  const PUNKTE = DOTS.map(([k, x, y]) => `<i class="pt" data-k="${k}" style="--x:${px(x)};--y:${py(y)}"></i>`).join('');
  const REIFEN = [['vl', 'l', -12, 330], ['vr', 'r', 782, 330], ['hl', 'l', -12, 1380], ['hr', 'r', 782, 1380]].map(([k, s, x, y]) => `<span class="rp ${s}" id="reifen_${k}" style="--x:${px(x)};--y:${py(y)}"></span>`).join('');
  const SVG = `
  <svg viewBox="-130 0 1030 1776" role="img" aria-label="Fahrzeug von oben">
    <defs>
      <image id="foto" x="0" y="0" width="770" height="1776"/>
      <radialGradient id="schatten" cx=".5" cy=".5" r=".5"><stop offset=".6" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <linearGradient id="lack" x1="0" x2="1"><stop offset="0" stop-color="#5A5F66"/><stop offset="1" stop-color="#8A8F96"/></linearGradient>
      <clipPath id="c_tvl"><polygon points="${TVL}"/></clipPath><clipPath id="c_tvr"><polygon points="${TVR}"/></clipPath>
      <clipPath id="c_fvl"><polygon points="${FVL}"/></clipPath><clipPath id="c_fvr"><polygon points="${FVR}"/></clipPath>
      <clipPath id="c_fhl"><polygon points="${FHL}"/></clipPath><clipPath id="c_fhr"><polygon points="${FHR}"/></clipPath>
      <clipPath id="c_haube"><polygon points="${HA}"/></clipPath><clipPath id="c_heck"><polygon points="${HE}"/></clipPath>
      <clipPath id="c_dach"><polygon points="${DA}"/></clipPath>
      ${UNTEN}
    </defs>
    <ellipse cx="385" cy="900" rx="470" ry="940" fill="url(#schatten)"/>
    <g id="auto"><use href="#foto"/></g>
    <g id="fenster_hl" class="teil fe"><g clip-path="url(#c_fhl)"><g class="unter"><use href="#kabine"/><use href="#tuerinnen"/></g><g class="glas"><g clip-path="url(#c_fhl)"><use href="#foto"/></g></g></g></g>
    <g id="fenster_hr" class="teil fe"><g clip-path="url(#c_fhr)"><g class="unter"><use href="#kabine"/><use href="#tuerinnen"/></g><g class="glas"><g clip-path="url(#c_fhr)"><use href="#foto"/></g></g></g></g>
    <g id="haube" class="teil"><g class="unter" clip-path="url(#c_haube)"><use href="#motor"/><image id="motorfoto" x="79" y="34" width="607" height="517" preserveAspectRatio="xMidYMid slice"/><polygon points="${HA}" fill="url(#vign)"/></g><g class="klon k_haube"><g clip-path="url(#c_haube)"><use href="#foto"/></g></g></g>
    <g id="heckklappe" class="teil"><g class="unter" clip-path="url(#c_heck)"><use href="#kofferraum"/><polygon points="${HE}" fill="url(#vign)"/></g><g class="klon k_heck"><g clip-path="url(#c_heck)"><use href="#foto"/></g></g></g>
    <g id="schiebedach" class="teil"><g class="unter" clip-path="url(#c_dach)"><use href="#kabine"/><polygon points="${DA}" fill="url(#vign)"/></g><g class="klon k_dach"><g clip-path="url(#c_dach)"><use href="#foto"/></g></g></g>
    <g id="tuer_vl" class="teil"><g class="unter" clip-path="url(#c_tvl)"><use href="#kabine"/><polygon points="${TVL}" fill="url(#vign)" opacity=".7"/></g><g class="klon k_tvl"><g clip-path="url(#c_tvl)"><use href="#foto"/></g>
      <g id="fenster_vl" class="fe"><g clip-path="url(#c_fvl)"><g class="unter"><use href="#kabine"/><use href="#tuerinnen"/></g><g class="glas"><g clip-path="url(#c_fvl)"><use href="#foto"/></g></g></g></g></g></g>
    <g id="tuer_vr" class="teil"><g class="unter" clip-path="url(#c_tvr)"><use href="#kabine"/><polygon points="${TVR}" fill="url(#vign)" opacity=".7"/></g><g class="klon k_tvr"><g clip-path="url(#c_tvr)"><use href="#foto"/></g>
      <g id="fenster_vr" class="fe"><g clip-path="url(#c_fvr)"><g class="unter"><use href="#kabine"/><use href="#tuerinnen"/></g><g class="glas"><g clip-path="url(#c_fvr)"><use href="#foto"/></g></g></g></g></g></g>
    <g id="tankklappe" class="teil"><g id="tk_r" class="tk"><ellipse class="loch" cx="709" cy="1500" rx="8" ry="22" fill="#08090B"/><rect class="klappe kr" x="711" y="1477" width="10" height="46" rx="5"/></g><g id="tk_l" class="tk"><ellipse class="loch" cx="61" cy="1500" rx="8" ry="22" fill="#08090B"/><rect class="klappe kl" x="49" y="1477" width="10" height="46" rx="5"/></g></g>
  </svg>`;
  class GgAuto extends HTMLElement {
    setConfig(c) {
      this._c = { quellen: {}, tank: {}, aktionen: [], ...c };
      this._frage = null;
      this._test = {};
    }
    getCardSize() { return 8; }
    set hass(h) {
      this._h = h;
      if (!this._r) this._baue();
      this._zeige();
    }
    _baue() {
      const r = this.attachShadow({ mode: 'open' });
      r.innerHTML = `<style>${CSS}</style><div class="karte">
        <div class="kopf"><div class="status"><b id="schloss"><ha-icon icon="mdi:lock-question"></ha-icon><span>–</span></b><div id="sum"></div></div><button id="alleszu" title="Fenster und Dach schließen, dann verriegeln">Alles schließen</button></div>
        <div class="mitte"><div class="bild"><div class="fz">${SVG}${REIFEN}${PUNKTE}</div><div class="werte">
          <div class="wert"><small>Tank</small><b id="w_tank">–</b><i><s id="w_balken" style="width:0"></s></i><em id="w_frist"></em></div>
          <div class="wert"><small>Reichweite</small><b id="w_reich">–</b></div>
          <div class="wert"><small>Kilometerstand</small><b id="w_km">–</b></div></div></div>
          <div class="aktionen" id="akt"></div></div>
        <div class="hinweis" id="hin"></div><div class="infos" id="inf"></div><div class="veraltet" id="alt"></div></div>`;
      this._r = r;
      const foto = r.getElementById('foto');
      const setze = () => { if (window.GG_AUTO_FOTO) foto.setAttribute('href', window.GG_AUTO_FOTO); };
      setze();
      if (!window.GG_AUTO_FOTO) window.addEventListener('gg-auto-foto', setze, { once: true });
      const mfoto = r.getElementById('motorfoto');
      const mset = () => { if (window.GG_AUTO_MOTOR) mfoto.setAttribute('href', window.GG_AUTO_MOTOR); };
      mset();
      if (!window.GG_AUTO_MOTOR) window.addEventListener('gg-auto-motor', mset, { once: true });
      const links = this._c.tankseite === 'links';
      r.getElementById(links ? 'tk_r' : 'tk_l').style.display = 'none';
      if (links) r.querySelector('.pt[data-k="tankklappe"]').style.setProperty('--x', px(64));
      r.getElementById('alleszu').addEventListener('click', () => this._allesZu());
      const inf = r.getElementById('inf');
      this._i = (this._c.infos || []).map((i) => {
        const d = document.createElement('div');
        d.className = 'info';
        d.style.display = 'none';
        d.innerHTML = `<small>${i.name}</small><b></b>`;
        inf.appendChild(d);
        return { i, d };
      });
      const uid = this._h && this._h.user ? this._h.user.id : null;
      this._akt = (this._c.aktionen || []).filter((a) => !Array.isArray(a.nutzer) || (uid && a.nutzer.includes(uid)));
      const akt = r.getElementById('akt');
      const suffix = (a) => (a.dienst || '').split('.')[1];
      const paarVon = (s) => Object.keys(PAARE).find((k) => PAARE[k].includes(s));
      this._kipp = PAARE.schiebedach.every((s) => this._aktion(s)) ? this._aktion('sunroof_tilt') : null;
      const fertig = new Set();
      this._b = [];
      this._akt.forEach((a) => {
        const s = suffix(a);
        if (this._kipp && a === this._kipp) return;
        const p = paarVon(s);
        const paar = p && PAARE[p].every((x) => this._aktion(x)) ? p : null;
        if (paar && fertig.has(paar)) return;
        if (paar) fertig.add(paar);
        const b = document.createElement('button');
        b.innerHTML = `<i class="kreis"><ha-icon icon="${a.icon || 'mdi:car'}"></ha-icon></i><span>${a.name}</span>`;
        const eintrag = { a, b, paar };
        b.addEventListener('click', () => {
          if (this._lang) { this._lang = false; return; }
          this._knopf(paar ? this._paarAktion(paar) : a, b);
        });
        if (paar === 'schiebedach' && this._kipp) {
          b.title = 'Gedrückt halten: Dach lüften';
          const los = () => clearTimeout(this._lt);
          b.addEventListener('pointerdown', () => { los(); this._lt = setTimeout(() => { this._lang = true; this._knopf(this._kipp, b); }, 650); });
          ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, los));
        }
        akt.appendChild(b);
        this._b.push(eintrag);
      });
    }
    _vorschau() {
      const e = this._c.vorschau;
      const an = !!(e && this._h.states[e] && this._h.states[e].state === 'on');
      if (!an && this._warVor) this._test = {};
      if (an && !this._warVor) this._test = { verriegelt: true, fenster_vl: true, schiebedach: 'kipp' };
      this._warVor = an;
      return an;
    }
    _bereit(a) {
      if (!a) return false;
      if (this._vorschau()) return true;
      const h = this._h;
      if (!a.dienst) return false;
      const [d, s] = a.dienst.split('.');
      if (!(h.services && h.services[d] && h.services[d][s])) return false;
      if (a.entity && !h.states[a.entity]) return false;
      return Object.values(a.daten || {}).every((v) => v !== '' && v !== null && v !== undefined);
    }
    _paarAktion(p) {
      const [zu, auf] = PAARE[p];
      let offen;
      if (p === 'fenster') { const st = FENSTER.map((f) => this._status(f)); offen = st.some((x) => x === true) || st.every((x) => x === null); }
      else if (p === 'verriegelt') offen = this._status('verriegelt') === true;
      else if (p === 'schiebedach') { const st = this._status('schiebedach'); offen = st === null || st === true || st === 'kipp'; }
      else offen = this._status(p === 'heizung' ? 'klima' : p) === true;
      return this._aktion(offen ? auf : zu);
    }
    _aktion(dienst) { return (this._akt || []).find((a) => a.dienst && a.dienst.split('.')[1] === dienst); }
    _senden(a, b) {
      const s = a.dienst.split('.')[1];
      if (this._vorschau()) {
        if (SIM[s]) Object.assign(this._test, SIM[s]);
        this._zeige();
        this._hinweis(a.name + ' (Vorschau, nichts gesendet)');
        return;
      }
      const [d] = a.dienst.split('.');
      const daten = { ...(a.daten || {}) };
      if (a.entity) daten.entity_id = a.entity;
      const p = this._h.callService(d, s, daten);
      if (b) {
        this._laufEnde();
        b.classList.add('laeuft');
        b.setAttribute('aria-busy', 'true');
        this._lauf = { b, zu: this._status('verriegelt'), schloss: s === 'doors_lock' || s === 'doors_unlock' };
        this._lt2 = setTimeout(() => this._laufEnde(), this._lauf.schloss ? 30000 : 2500);
      }
      if (p && typeof p.catch === 'function') p.catch(() => { this._laufEnde(); this._hinweis(a.name + ' hat nicht geklappt – bitte später erneut versuchen'); });
    }
    _laufEnde() {
      clearTimeout(this._lt2);
      if (this._lauf) { this._lauf.b.classList.remove('laeuft'); this._lauf.b.removeAttribute('aria-busy'); }
      this._lauf = null;
    }
    _knopf(a, b) {
      if (!this._bereit(a)) return;
      if (a.bestaetigen && !this._vorschau() && this._frage !== a) {
        this._frage = a;
        b.classList.add('frage');
        b.querySelector('span').textContent = 'Nochmal tippen';
        clearTimeout(this._ft);
        this._ft = setTimeout(() => { this._frage = null; b.classList.remove('frage'); b.querySelector('span').textContent = a.name; }, 3500);
        return;
      }
      clearTimeout(this._ft);
      this._frage = null;
      b.classList.remove('frage');
      b.querySelector('span').textContent = a.name;
      this._senden(a, b);
    }
    _allesZuBereit() {
      if (this._vorschau()) return true;
      if (this._c.alles_zu) return !!this._h.states[this._c.alles_zu];
      return ['windows_close', 'sunroof_close', 'doors_lock'].some((s) => this._bereit(this._aktion(s)));
    }
    _allesZu() {
      const p = this._r.getElementById('alleszu');
      if (!this._allesZuBereit()) { this._hinweis('Noch nicht verbunden'); return; }
      if (!this._frageZ) {
        this._frageZ = true;
        p.classList.add('frage');
        p.textContent = 'Wirklich?';
        clearTimeout(this._fz);
        this._fz = setTimeout(() => { this._frageZ = false; p.classList.remove('frage'); this._zeige(); }, 3500);
        return;
      }
      clearTimeout(this._fz);
      this._frageZ = false;
      p.classList.remove('frage');
      const offenTeil = ['tuer_vl', 'tuer_vr', 'haube', 'heckklappe'].filter((k) => this._status(k) === true).map((k) => NAMEN[k]);
      if (this._vorschau()) {
        Object.assign(this._test, SIM.windows_close, SIM.sunroof_close);
        if (!offenTeil.length) this._test.verriegelt = true;
        this._zeige();
        this._hinweis(offenTeil.length ? 'Fenster und Dach zu – nicht verriegelt: ' + offenTeil.join(', ') + ' offen' : 'Alles zu und verriegelt (Vorschau)');
        return;
      }
      if (this._c.alles_zu) {
        const [d] = this._c.alles_zu.split('.');
        this._h.callService(d === 'script' ? 'script' : d, 'turn_on', { entity_id: this._c.alles_zu });
        this._hinweis('Alles zu: gestartet …');
        return;
      }
      const schritte = [];
      if (FENSTER.some((f) => this._status(f) !== false)) schritte.push(this._aktion('windows_close'));
      if (this._status('schiebedach') !== false) schritte.push(this._aktion('sunroof_close'));
      if (!offenTeil.length) schritte.push(this._aktion('doors_lock'));
      const los = schritte.filter((a) => this._bereit(a));
      los.forEach((a, i) => setTimeout(() => {
        const [d, s] = a.dienst.split('.');
        const daten = { ...(a.daten || {}) };
        if (a.entity) daten.entity_id = a.entity;
        this._h.callService(d, s, daten);
      }, i * 2000));
      this._hinweis(offenTeil.length ? 'Fenster/Dach werden geschlossen – nicht verriegelt: ' + offenTeil.join(', ') + ' offen' : 'Fenster und Dach schließen, dann verriegeln …');
    }
    _hinweis(t) {
      const el = this._r.getElementById('hin');
      el.textContent = t;
      clearTimeout(this._ht);
      this._ht = setTimeout(() => { el.textContent = ''; this._zeige(); }, 3500);
    }
    /* Datum der Messwerte, wenn der Zeitstempel der Entität älter als 14 Tage ist, sonst null */
    _alt(id) {
      const s = id && this._h.states[id];
      const ts = s && s.attributes && s.attributes.timestamp;
      if (!ts) return null;
      const d = new Date(ts);
      return isNaN(d) || Date.now() - d.getTime() <= 14 * 864e5 ? null : d;
    }
    _lies(k) {
      const o = zerlege(this._c.quellen[k]);
      if (!o || !o.entity) return undefined;
      const s = this._h.states[o.entity];
      if (!s) return undefined;
      return { v: o.attr ? (s.attributes ? s.attributes[o.attr] : undefined) : s.state, o };
    }
    /* true = offen/verriegelt, 'kipp' = gelüftet, false = zu, null = unbekannt */
    _status(k) {
      if (this._vor) { const v = this._test[k]; return v === undefined ? false : v; }
      const r = this._lies(k);
      if (!r || r.v === undefined || r.v === null) return null;
      if (typeof r.v === 'boolean') return r.v;
      const t = String(r.v).toLowerCase();
      if (WEG.includes(t)) return null;
      if (k === 'verriegelt') return (r.o.zu || ['locked']).map((x) => String(x).toLowerCase()).includes(t);
      if (r.o.kipp && r.o.kipp.map((x) => String(x).toLowerCase()).includes(t)) return 'kipp';
      return (r.o.offen || OFFEN).map((x) => String(x).toLowerCase()).includes(t);
    }
    _zeige() {
      const r = this._r, c = this._c;
      const vor = this._vor = this._vorschau();
      const q = (id) => r.getElementById(id);
      const offene = [];
      let bekannt = 0;
      Object.keys(NAMEN).forEach((k) => {
        const o = this._status(k);
        if (o !== null) bekannt++;
        const el = q(k);
        if (el) { el.classList.toggle('auf', o === true); el.classList.toggle('kipp', o === 'kipp'); }
        const pt = r.querySelector('.pt[data-k="' + k + '"]');
        if (pt) pt.classList.toggle('an', o === true || o === 'kipp');
        if (o === true) offene.push(NAMEN[k]);
        if (o === 'kipp') offene.push(NAMEN[k] + ' gelüftet');
      });
      const zu = this._status('verriegelt');
      if (this._lauf && this._lauf.schloss && zu !== null && zu !== this._lauf.zu) this._laufEnde();
      const pille = q('schloss');
      pille.className = zu === null ? '' : zu ? 'zu' : 'auf';
      pille.querySelector('ha-icon').setAttribute('icon', zu === null ? 'mdi:lock-question' : zu ? 'mdi:lock' : 'mdi:lock-open-variant');
      const sum = q('sum');
      const verbunden = vor || bekannt > 0 || zu !== null;
      pille.querySelector('span').textContent = !verbunden ? 'Nicht verbunden' : zu === null ? 'Schloss unbekannt' : zu ? 'Verriegelt' : 'Entriegelt';
      if (!verbunden) { sum.className = ''; sum.textContent = 'Mercedes me fehlt noch'; }
      else if (offene.length) { sum.className = 'warn'; sum.textContent = 'Offen: ' + offene.join(' · '); }
      else { sum.className = ''; sum.textContent = 'Alles geschlossen'; }
      sum.title = sum.textContent;
      const az = q('alleszu');
      if (!az.classList.contains('frage')) {
        const noetig = offene.length > 0 || zu === false;
        const kannZu = ['windows_close', 'sunroof_close'].some((s) => this._aktion(s));
        az.classList.toggle('aus', !noetig || !kannZu || !this._allesZuBereit());
        az.textContent = 'Alles schließen';
      }
      r.querySelector('svg').classList.toggle('leer', !verbunden);
      const t = c.tank || {};
      const zahl = (k, def) => { if (vor) return def; const s = t[k] && this._h.states[t[k]]; return s ? num(s.state) : null; };
      const pr = zahl('prozent', VORSCHAU.tank.prozent), rw = zahl('reichweite', VORSCHAU.tank.reichweite), km = zahl('kilometer', VORSCHAU.tank.kilometer);
      const alt = {};
      const merke = (name, d) => {
        if (!d) return;
        const m = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
        alt[m] = alt[m] || [];
        if (!alt[m].includes(name)) alt[m].push(name);
      };
      const aT = vor ? null : this._alt(t.prozent), aR = vor ? null : this._alt(t.reichweite), aK = vor ? null : this._alt(t.kilometer);
      merke('Tank', pr === null ? null : aT); merke('Reichweite', rw === null ? null : aR); merke('Kilometerstand', km === null ? null : aK);
      q('w_tank').classList.toggle('alt', !!aT); q('w_reich').classList.toggle('alt', !!aR); q('w_km').classList.toggle('alt', !!aK);
      q('w_tank').innerHTML = pr === null ? '–' : Math.round(pr) + '<u>%</u>';
      const bal = q('w_balken');
      q('w_tank').classList.toggle('rot', pr !== null && pr <= 20 && !aT);
      bal.style.width = (pr === null ? 0 : Math.max(0, Math.min(100, pr))) + '%';
      bal.style.setProperty('--c', aT ? 'var(--gg-l68, rgba(235, 235, 245, 0.68))' : pr !== null && pr <= 20 ? 'var(--gg-c-rot, #FF453A)' : pr !== null && pr < 30 ? 'var(--gg-c-orange, #FF9F0A)' : 'var(--gg-c-gruen, #30D158)');
      q('w_reich').innerHTML = rw === null ? '–' : Math.round(rw).toLocaleString('de-DE') + '<u>km</u>';
      q('w_km').innerHTML = km === null ? '–' : Math.round(km).toLocaleString('de-DE') + '<u>km</u>';
      let frist = '';
      if (vor) frist = 'bis ' + VORSCHAU.tank.frist;
      else if (t.frist && this._h.states[t.frist] && /^\d{4}-\d\d-\d\d$/.test(this._h.states[t.frist].state)) {
        const d = new Date(this._h.states[t.frist].state + 'T12:00:00');
        const tage = Math.round((d - new Date(new Date().toDateString() + ' 12:00')) / 864e5);
        if (tage < 60) frist = 'bis ' + d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      }
      q('w_frist').textContent = pr === null || aT ? '' : frist;
      ['vl', 'vr', 'hl', 'hr'].forEach((p, i) => {
        const el = q('reifen_' + p);
        let v = null;
        if (vor) v = VORSCHAU.reifen[i];
        else {
          const l = this._lies('reifen_' + p);
          v = l ? num(l.v) : null;
          if (v !== null) {
            const u = String(((this._h.states[l.o.entity] || {}).attributes || {}).unit_of_measurement || '').toLowerCase();
            if (u === 'kpa') v /= 100; else if (u === 'hpa' || u === 'mbar') v /= 1000; else if (u === 'psi') v *= 0.0689476; else if (v > 50) v /= 100;
            merke('Reifendruck', this._alt(l.o.entity));
          }
        }
        el.innerHTML = v === null ? '' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ',') + '<small>bar</small>';
        el.classList.toggle('warn', v !== null && v < 2.0);
      });
      this._i.forEach(({ i, d }) => {
        let txt = null, roh = null;
        if (vor) txt = i.vorschau || null;
        else {
          const o = zerlege(i.entity);
          const s = o && o.entity && this._h.states[o.entity];
          if (s) {
            const v = o.attr ? (s.attributes || {})[o.attr] : s.state;
            if (v !== undefined && v !== null && !WEG.includes(String(v).toLowerCase())) {
              const n = num(v);
              roh = String(v).toLowerCase();
              const map = (i.werte || {})[String(v).toLowerCase()];
              txt = map !== undefined ? map : (n !== null && /^-?[\d.,]+$/.test(String(v)) ? (i.nachkomma !== undefined ? n.toFixed(i.nachkomma).replace('.', ',') : String(Math.round(n * 10) / 10).replace('.', ',')) : String(v)) + (i.einheit && n !== null ? ' ' + i.einheit : '');
            }
          }
        }
        const io = vor ? null : zerlege(i.entity);
        const da = txt !== null && io && io.entity ? this._alt(io.entity) : null;
        d.classList.toggle('alt', !!da);
        d.classList.toggle('warn', !da && roh !== null && (i.warn || []).includes(roh));
        merke(i.name, da);
        d.style.display = txt === null ? 'none' : '';
        d.querySelector('b').textContent = txt === null ? '' : txt;
      });
      const monate = Object.keys(alt);
      q('alt').textContent = monate.length ? monate.map((m) => 'Stand ' + m + ': ' + alt[m].join(', ')).join('\n') + '\nMercedes liefert dafür noch keine neueren Werte.' : '';
      this._b.forEach((e) => {
        const a = e.paar ? this._paarAktion(e.paar) : e.a;
        e.b.classList.toggle('weg', !this._bereit(a));
        if (e.paar && !e.b.classList.contains('frage')) {
          e.b.querySelector('span').textContent = a.name;
          e.b.querySelector('ha-icon').setAttribute('icon', a.icon || 'mdi:car');
        }
      });
      const hin = q('hin');
      if (vor && !this._ht_aktiv()) hin.textContent = 'Vorschau – Beispieldaten, es wird nichts gesendet';
      else if (!vor && hin.textContent.startsWith('Vorschau –')) hin.textContent = '';
    }
    _ht_aktiv() { const el = this._r.getElementById('hin'); return el.textContent && !el.textContent.startsWith('Vorschau –'); }
  }
  customElements.define('gg-auto', GgAuto);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'gg-auto', name: 'Fahrzeug von oben', description: 'Türen, Fenster und Dach bewegen sich im Foto; Fernsteuerung' });
  /* custom:gg-auto-profil – Fahrverhalten klein und schlicht: Woche / Monat / Jahr.
     Konfiguration: { messung: 'sensor.… (km pro Tag, gemessen)', plan: 'sensor.… (km pro Woche, aus Bürotagen)', buerotage: 'input_text.…' } */
  if (!customElements.get('gg-auto-profil')) {
    const TAG = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };
    const CSSP = `
      :host { display: block; font-family: var(--gg-schrift, -apple-system, 'Inter', sans-serif); }
      .k { box-sizing: border-box; padding: 12px 16px 13px; border-radius: 27px; background: var(--gg-zelle, rgba(255, 255, 255, 0.08)); box-shadow: var(--gg-zellschatten, none); color: var(--gg-t1, #FFFFFF); }
      .kopf { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
      .kopf span { font-size: 13px; line-height: 18px; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }
      .kopf em { font-style: normal; font-size: 12px; line-height: 16px; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .reihe { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 12px; margin-top: 6px; }
      .reihe small { display: block; font-size: 12px; line-height: 16px; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }
      .reihe b { display: block; font-size: 19px; line-height: 24px; font-weight: 600; letter-spacing: -0.3px; color: var(--gg-l85, rgba(235, 235, 245, 0.85)); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .reihe b u { text-decoration: none; font-size: 13px; font-weight: 500; margin-left: 2px; color: var(--gg-l68, rgba(235, 235, 245, 0.68)); }`;
    class GgAutoProfil extends HTMLElement {
      setConfig(c) { this._c = c || {}; }
      getCardSize() { return 1; }
      set hass(h) {
        this._h = h;
        if (!this.shadowRoot) {
          this.attachShadow({ mode: 'open' }).innerHTML = `<style>${CSSP}</style><div class="k"><div class="kopf"><span>Fahrverhalten</span><em id="q"></em></div><div class="reihe"><div><small>Woche</small><b id="w">–</b></div><div><small>Monat</small><b id="m">–</b></div><div><small>Jahr</small><b id="j">–</b></div></div></div>`;
        }
        const st = (id) => (id && h.states[id] ? h.states[id].state : null);
        const zahl = (id) => { const x = parseFloat(st(id)); return isFinite(x) ? x : null; };
        const tagKm = zahl(this._c.messung);
        const woche = tagKm !== null ? tagKm * 7 : zahl(this._c.plan);
        const r = this.shadowRoot;
        const f = (v, s) => (v === null ? '–' : (tagKm === null ? '≈ ' : '') + (Math.round(v / s) * s).toLocaleString('de-DE') + '<u>km</u>');
        r.getElementById('w').innerHTML = f(woche, 1);
        r.getElementById('m').innerHTML = f(woche === null ? null : woche * 365 / 7 / 12, 10);
        r.getElementById('j').innerHTML = f(woche === null ? null : woche * 365 / 7, 100);
        let q = '';
        if (tagKm !== null) q = 'gemessen';
        else if (woche !== null) {
          const t = String(st(this._c.buerotage) || '').toLowerCase().replace(/\s/g, '').split(',').filter((x) => TAG[x]).map((x) => TAG[x]);
          q = 'geschätzt' + (t.length ? ' · Büro ' + t.join(', ') : '');
        }
        r.getElementById('q').textContent = q;
      }
    }
    customElements.define('gg-auto-profil', GgAutoProfil);
    window.customCards.push({ type: 'gg-auto-profil', name: 'Fahrverhalten', description: 'km pro Woche, Monat und Jahr' });
  }
})();
