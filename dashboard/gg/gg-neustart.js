/* gg-neustart v2 (28.10.2026) – Karte custom:gg-neustart: unsichtbare Fläche über der Uhr auf dem Nest Hub, in zwei Hälften geteilt.
   LINKS (wie bisher): 5 Sekunden halten = Dashboard auf dem Hub komplett neu starten (script.nest_gartenhaus_neu_starten: Hub aus, neu casten).
   RECHTS (neu): 5 Sekunden halten = Vollbild-Anzeige des WLAN-QR-Codes (window.GG_QR aus der Ressource gg-qr) auf dunklem Grund, alles andere
   ist verdeckt. Nach exakt 20 Sekunden schließt sie sich von selbst und der Hub zeigt wieder die Startseite (#gartenhaus).
   Ab 0,7 s Halten erscheint ein Fortschrittsring (Restsekunden in der Mitte) – kurzes Berühren zeigt nichts. Loslassen oder Wegwischen (> 24 px) bricht ab.
   Nach dem Auslösen Sperre gegen Doppelstart (links 60 s, rechts bis die Anzeige geschlossen ist).
   Konfig (optional): skript (Standard script.nest_gartenhaus_neu_starten), dauer (Sekunden bis Neustart, Standard 5), qr_dauer (Sekunden Halten bis QR, Standard 5),
   qr_zeit (Sekunden Anzeige, Standard 20), qr_zurueck (Standard #gartenhaus), radius (Standard 28). */
(() => {
  if (customElements.get('gg-neustart')) return;
  const ZEIGE = 700, WEG = 24, UMFANG = 226.19;
  class GgNeustart extends HTMLElement {
    setConfig(c) { this._c = Object.assign({ skript: 'script.nest_gartenhaus_neu_starten', dauer: 5, radius: 28, qr_dauer: 5, qr_zeit: 20, qr_zurueck: '#gartenhaus' }, c || {}); if (this._r) this._r.querySelectorAll('.fl, .fr, .hub').forEach((e) => { e.style.borderRadius = this._c.radius + 'px'; }); }
    getCardSize() { return 1; }
    set hass(h) { this._h = h; if (!this._r) this._baue(); }
    _baue() {
      const r = this.attachShadow({ mode: 'open' });
      this._r = r;
      r.innerHTML = `<style>
        :host { position: absolute !important; inset: 0; z-index: 3; display: block; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
          font-family: var(--gg-schrift, -apple-system, 'Inter', 'Roboto', sans-serif); color: var(--gg-t1, #FFFFFF); }
        .fl { position: absolute; top: 0; bottom: 0; left: 0; right: 50%; }
        .fr { position: absolute; top: 0; bottom: 0; left: 50%; right: 0; }
        .hub { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: rgba(18, 18, 22, 0.92);
          opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }
        .hub.an { opacity: 1; }
        .ring { position: relative; width: 84px; height: 84px; }
        .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
        .ring circle { fill: none; stroke-width: 6; }
        .ring .bg { stroke: rgba(255, 255, 255, 0.22); }
        .ring .fg { stroke: #FFFFFF; stroke-linecap: round; stroke-dasharray: ${UMFANG}; stroke-dashoffset: ${UMFANG}; }
        .ring b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .t { font-size: 22px; font-weight: 600; text-align: center; padding: 0 16px; }
      </style><div class="fl" role="button" aria-label="Uhr links: 5 Sekunden halten, um die Ansicht neu zu starten"></div><div class="fr" role="button" aria-label="Uhr rechts: 5 Sekunden halten, um den WLAN-QR-Code zu zeigen"></div>
      <div class="hub"><div class="ring"><svg viewBox="0 0 84 84"><circle class="bg" cx="42" cy="42" r="36"/><circle class="fg" cx="42" cy="42" r="36"/></svg><b>5</b></div><div class="t"></div></div>`;
      const rad = (this._c && this._c.radius) || 28;
      r.querySelectorAll('.fl, .fr, .hub').forEach((e) => { e.style.borderRadius = rad + 'px'; });
      const hub = r.querySelector('.hub'), fg = r.querySelector('.fg'), zahl = r.querySelector('.ring b'), txt = r.querySelector('.t');
      /* gemeinsame Halte-Logik für beide Hälften */
      const halte = (f, art) => {
        let t0 = 0, raf = 0, x0 = 0, y0 = 0, id = null;
        const dauer = () => Math.max(1, Number(this._c && (art === 'qr' ? this._c.qr_dauer : this._c.dauer)) || 5) * 1000;
        const ruhe = () => { cancelAnimationFrame(raf); raf = 0; t0 = 0; hub.classList.remove('an'); fg.style.strokeDashoffset = String(UMFANG); };
        const schritt = () => {
          if (!t0) return;
          const d = dauer(), ab = performance.now() - t0, p = Math.min(1, ab / d);
          if (ab >= ZEIGE) hub.classList.add('an');
          fg.style.strokeDashoffset = (UMFANG * (1 - p)).toFixed(2);
          zahl.textContent = String(Math.max(1, Math.ceil((d - ab) / 1000)));
          if (p >= 1) { if (art === 'qr') { ruhe(); this._qr(); } else this._los(hub, txt, zahl, ruhe); return; }
          raf = requestAnimationFrame(schritt);
        };
        f.addEventListener('pointerdown', (e) => {
          if ((e.button || 0) > 0 || t0 || !this._h) return;
          if (art === 'qr' ? window.__ggQrOffen : Date.now() < (this._sperre || 0)) return;
          id = e.pointerId; x0 = e.clientX; y0 = e.clientY;
          try { f.setPointerCapture(id); } catch (_) { /* egal */ }
          txt.textContent = art === 'qr' ? 'Weiter halten für WLAN-QR-Code' : 'Weiter halten für Neustart';
          t0 = performance.now(); raf = requestAnimationFrame(schritt);
        });
        f.addEventListener('pointermove', (e) => { if (t0 && !this._fertig && e.pointerId === id && Math.hypot(e.clientX - x0, e.clientY - y0) > WEG) ruhe(); });
        ['pointerup', 'pointercancel'].forEach((n) => f.addEventListener(n, (e) => { if (t0 && !this._fertig && e.pointerId === id) ruhe(); }));
        f.addEventListener('contextmenu', (e) => e.preventDefault());
      };
      halte(r.querySelector('.fl'), 'neustart');
      halte(r.querySelector('.fr'), 'qr');
    }
    _los(hub, txt, zahl, ruhe) {
      this._sperre = Date.now() + 60000;
      zahl.textContent = '✓';
      txt.textContent = 'Ansicht wird neu gestartet …';
      const [d, n] = String((this._c && this._c.skript) || '').split('.');
      this._h.callService('script', 'turn_on', { entity_id: d + '.' + n }).catch(() => { txt.textContent = 'Neustart fehlgeschlagen'; });
      this._fertig = true;
      setTimeout(() => { this._fertig = false; ruhe(); }, 6000);
    }
    /* WLAN-QR-Code im Vollbild – liegt direkt im <body>, damit nichts anderes (auch keine transformierten Karten) ihn verdeckt oder verschiebt */
    _qr() {
      if (window.__ggQrOffen) return;
      window.__ggQrOffen = true;
      const c = this._c || {};
      const zeit = Math.max(1, Number(c.qr_zeit) || 20) * 1000;
      const host = document.createElement('div');
      host.setAttribute('data-gg-qr', '');
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;';
      const sr = host.attachShadow({ mode: 'open' });
      sr.innerHTML = `<style>
        .b { position: fixed; inset: 0; background: #000000; display: flex; align-items: center; justify-content: center; font-family: -apple-system, 'Inter', 'Roboto', sans-serif; color: #FFFFFF; -webkit-user-select: none; user-select: none; }
        img { display: block; height: min(94vh, 94vw); width: min(94vh, 94vw); object-fit: contain; }
        p { margin: 0; font-size: 26px; font-weight: 600; text-align: center; padding: 0 24px; }
      </style><div class="b"></div>`;
      const b = sr.querySelector('.b');
      if (window.GG_QR) {
        const img = document.createElement('img');
        img.alt = 'QR-Code für das WLAN';
        img.src = window.GG_QR;
        b.appendChild(img);
      } else b.innerHTML = '<p>QR-Code fehlt (Ressource „gg-qr“)</p>';
      document.body.appendChild(host);
      setTimeout(() => {
        host.remove();
        window.__ggQrOffen = false;
        const ziel = String(c.qr_zurueck || '#gartenhaus');
        try {
          history.pushState(null, '', ziel);
          window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
          window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (_) { /* egal */ }
      }, zeit);
    }
  }
  customElements.define('gg-neustart', GgNeustart);
})();