/* gg-bedienung v1 (26.10.2026) – Bedienhilfen nach Apple HIG (Accessibility › Mobility/Vision), ergänzt alle gg-Dashboards ohne deren Code anzufassen:
   · „Bewegung reduzieren“ des Geräts: Animationen/Übergänge aller Karten (auch in Schatten-DOMs) auf ~0 ms
   · sichtbarer Tastaturfokus (Ring in --gg-c-blau) nur bei Tastaturbedienung
   · touch-action: manipulation (kein Doppeltipp-Zoom, schnelleres Tippen auf Karten/Knöpfen)
   Technik: ein kleines Stylesheet wird in jedes neu erzeugte Schatten-DOM eingehängt (attachShadow-Hook) und einmalig in bereits vorhandene. Entfernen der Ressource = alter Stand. */
(function () {
  if (window.__ggBedienung) return; window.__ggBedienung = true;
  var CSS = '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;transition-delay:0s!important;scroll-behavior:auto!important}}'
    + ':focus-visible{outline:2px solid var(--gg-c-blau,#0A84FF);outline-offset:2px}'
    + 'ha-card,button,a,[role="button"],[role="switch"]{touch-action:manipulation}';
  var sheet = null;
  try { sheet = new CSSStyleSheet(); sheet.replaceSync(CSS); } catch (e) { sheet = null; }
  function add(root) {
    if (!sheet || !root || !('adoptedStyleSheets' in root)) return;
    try { if (root.adoptedStyleSheets.indexOf(sheet) < 0) root.adoptedStyleSheets = root.adoptedStyleSheets.concat([sheet]); } catch (e) {}
  }
  try {
    var orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) { var r = orig.call(this, init); add(r); return r; };
  } catch (e) {}
  add(document);
  function walk(root, n) {
    if (n > 40) return;
    add(root);
    var all; try { all = root.querySelectorAll('*'); } catch (e) { return; }
    for (var i = 0; i < all.length; i++) { var s = all[i].shadowRoot; if (s) walk(s, n + 1); }
  }
  [600, 2500, 6000].forEach(function (t) { setTimeout(function () { try { walk(document, 0); } catch (e) {} }, t); });
})();
