/* gg-nachtschwarz v1 (29.10.2026) – Nest Hub Gartenhaus: nachts ganz schwarz.
   Zwischen 0:00 und 9:00 Uhr (Zeit von Home Assistant) legt sich ein schwarzer Vollbild-Schleier über das Dashboard,
   solange das Licht im Gartenhaus aus ist (light.gartenhaus_gartenhaus ≠ an) und beide Türen zu sind (≠ an).
   Geht das Licht an oder eine Tür auf, ist der Schleier sofort weg. Antippen hellt für 30 s auf.
   Gilt nur im Nest-Gartenhaus-Dashboard (Cast; erstes Blatt „gartenhaus“); alle anderen Ansichten bleiben unberührt.
   Hinweis: Home Assistant kann den Bildschirm des Nest Hub nicht ausschalten – Schwarz ist die nächstbeste Lösung.
   Entfernen der Ressource = alter Stand. */
(() => {
  const w = window;
  if (w.__ggNachtSchwarz) return;
  w.__ggNachtSchwarz = true;
  const LICHT = 'light.gartenhaus_gartenhaus';
  const TUEREN = ['binary_sensor.gartenhaus_tur_nord_contact', 'binary_sensor.gartenhaus_tur_ost_contact'];
  const VON = 0, BIS = 9;
  const root = document.documentElement;
  const cast = () => location.pathname.indexOf('receiver') >= 0 || !!document.querySelector('hc-main');
  const finde = () => { const st = [root]; let n = 0; while (st.length && n < 40000) { const x = st.pop(); n++; if (x.localName === 'gg-blaetter-view') return x; if (x.shadowRoot) for (const c of x.shadowRoot.children) st.push(c); for (const c of x.children || []) st.push(c); } return null; };
  let gg = null, suchZeit = 0, ov = null, wach = 0;
  document.addEventListener('pointerdown', () => { wach = Date.now(); zeige(false, 0.2); }, true);
  const zeige = (an, dauer) => {
    if (an && !ov) {
      ov = document.createElement('div');
      ov.setAttribute('data-gg-nachtschwarz', '');
      ov.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;cursor:none;z-index:2147483000;opacity:0;';
      document.body.appendChild(ov);
    }
    if (!ov) return;
    ov.style.transition = 'opacity ' + dauer + 's ease';
    ov.style.opacity = an ? '1' : '0';
  };
  const stunde = (h) => {
    try { const z = h && h.config && h.config.time_zone; if (z) return parseInt(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: z }).format(new Date()), 10); } catch (_) { /* Rückfall */ }
    return new Date().getHours();
  };
  setInterval(() => {
    try {
      if (!cast()) { zeige(false, 0.2); return; }
      if (!gg || !gg.isConnected) {
        if (Date.now() - suchZeit < 4000) return;
        suchZeit = Date.now();
        gg = finde();
        if (!gg) return;
      }
      const cfg = gg._cfg, h = gg._hass;
      const hier = cfg && cfg.seiten && cfg.seiten[0] && cfg.seiten[0].pfad === 'gartenhaus';
      if (!hier || !h || !h.states) { zeige(false, 0.2); return; }
      const s = (e) => (h.states[e] ? h.states[e].state : '');
      const st = stunde(h);
      const nacht = st >= VON && st < BIS;
      const dunkel = nacht && s(LICHT) !== 'on' && TUEREN.every((t) => s(t) !== 'on') && Date.now() - wach > 30000;
      zeige(dunkel, dunkel ? 1.5 : 0.25);
    } catch (_) { /* nichts tun */ }
  }, 1000);
})();
