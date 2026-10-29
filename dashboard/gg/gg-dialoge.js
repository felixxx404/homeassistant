/* gg-dialoge v1 (26.10.2026) – Apples Blatt-Stil für Home-Assistants eigene Dialoge (Geräte-Details/more-info, Rückfragen, Auswahl-Blätter).
   Gleiche Glasfläche, Rundung, Schatten und Abdunklung wie die gg-Blätter, Farben nur über --gg-Variablen (Tag/Nacht folgt gg-farben).
   Technik: nur Variablen, die HA-Dialoge ohnehin auslesen (--ha-dialog-*, --ha-bottom-sheet-*, --mdc-dialog-scrim-color); ein kleines Stylesheet wird per attachShadow-Hook in jedes Schatten-DOM gehängt.
   Entfernen der Ressource = alter Stand. */
(function () {
  if (window.__ggDialoge) return; window.__ggDialoge = true;
  var DIALOGE = 'ha-dialog,ha-adaptive-dialog,ha-bottom-sheet,ha-snap-bottom-sheet,ha-more-info-dialog,ha-md-dialog,ha-wa-dialog,dialog-box';
  var CSS = ':root{'
    + '--ha-dialog-surface-background:rgba(30,30,36,.82);'
    + '--ha-dialog-surface-backdrop-filter:blur(40px) saturate(180%);'
    + '--ha-dialog-border-radius:32px;'
    + '--ha-bottom-sheet-border-radius:38px;'
    + '--dialog-box-shadow:var(--gg-glasrand,0 0 0 0 transparent),0 24px 60px var(--gg-schatten,rgba(0,0,0,.35));'
    + '--mdc-dialog-scrim-color:var(--gg-dim,rgba(0,0,0,.38));'
    + '--ha-dialog-show-duration:320ms;--ha-dialog-hide-duration:220ms;'
    + '--ha-dialog-header-title-font-weight:700;'
    + '}'
    + ':root[data-gg-tag]{--ha-dialog-surface-background:rgba(246,246,250,.86);}'
    + '@media (prefers-reduced-transparency:reduce){:root{--ha-dialog-surface-background:rgba(30,30,36,.98);--ha-dialog-surface-backdrop-filter:none;}:root[data-gg-tag]{--ha-dialog-surface-background:rgba(246,246,250,.99);}}'
    + DIALOGE + '{'
    + '--primary-text-color:var(--gg-t1,#fff);'
    + '--secondary-text-color:var(--gg-l78,rgba(235,235,245,.78));'
    + '--disabled-text-color:var(--gg-l62,rgba(235,235,245,.6));'
    + '--divider-color:var(--gg-r16,rgba(255,255,255,.16));'
    + '--primary-color:var(--gg-c-blau,#0A84FF);'
    + '--card-background-color:var(--gg-zelle,rgba(255,255,255,.07));'
    + '--ha-card-background:var(--gg-zelle,rgba(255,255,255,.07));'
    + '--secondary-background-color:var(--gg-f06,rgba(255,255,255,.06));'
    + '--input-fill-color:var(--gg-f06,rgba(255,255,255,.06));'
    + '--mdc-text-field-fill-color:var(--gg-f06,rgba(255,255,255,.06));'
    + '--mdc-text-field-ink-color:var(--gg-t1,#fff);'
    + '--mdc-text-field-label-ink-color:var(--gg-l78,rgba(235,235,245,.78));'
    + '--mdc-dialog-heading-ink-color:var(--gg-t1,#fff);'
    + '--mdc-dialog-content-ink-color:var(--gg-l78,rgba(235,235,245,.78));'
    + '}';
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
