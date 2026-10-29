/* gg-fenster v5 (29.10.2026: Diagnose-Ausgabe nach input_text.gg_diag entfernt) / v4 – (v4: Nest-Kachel startet wieder – das zweite Tippen wurde von der Prüfung als erstes Tippen gewertet)  v3 – (v2: Steckdosen-Erreichbarkeit per Matter-Ping; v3: Ping einer nicht erreichbaren Steckdose dauert ca. 10 s – Wartezeit 20 s, keine Antwort zählt als „nicht erreichbar“, bekannter Ausfall zeigt den Hinweis sofort)  Ergänzung zu gg-extras:
   • Fensterwarnung: Klimaanlage Gartenhaus lässt sich bei offenem Fenster (Nord/West) nur nach zweiter Bestätigung einschalten (Web, iPhone, Nest).
   • Kohlegrill: Ist die Außensteckdose nicht erreichbar (Strom am Schalter aus), erscheint der Hinweis „Strom einschalten“ (Pop-up, Nest-Kachel). */
(() => {
  const w = window;
  if (w.__ggFenster) return;
  w.__ggFenster = true;
  const root = document.documentElement;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cast = () => location.pathname.indexOf('receiver') >= 0 || !!document.querySelector('hc-main');
  const haptik = (art) => { try { w.dispatchEvent(new CustomEvent('haptic', { detail: art || 'light' })); } catch (_) {} };
  const tag = () => root.hasAttribute('data-gg-tag');

  /* ---------- Dialog über allem */
  const BASIS = `:host { all: initial; font-family: var(--gg-schrift, -apple-system, 'Inter', 'Roboto', sans-serif); -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; color: var(--gg-t1, #FFFFFF);
      --flaeche: rgba(36, 36, 42, 0.92); --taste: rgba(255, 255, 255, 0.12); --t2: rgba(235, 235, 245, 0.7); }
    :host([tag]) { --flaeche: rgba(246, 246, 248, 0.94); --taste: rgba(0, 0, 0, 0.07); --t2: rgba(60, 60, 67, 0.7); color: #000; }
    button { font: inherit; color: inherit; border: none; outline: none; background: none; cursor: pointer; padding: 0; -webkit-tap-highlight-color: transparent; }
    .hg { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); opacity: 0; transition: opacity 0.22s ease; }
    .dlg { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -46%) scale(0.98); opacity: 0; transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
      width: min(520px, calc(100vw - 24px)); max-height: calc(100vh - 24px); box-sizing: border-box; overflow: auto; border-radius: 28px; padding: 20px;
      background: var(--flaeche); backdrop-filter: blur(30px) saturate(180%); -webkit-backdrop-filter: blur(30px) saturate(180%); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45), inset 0 0 0 0.5px rgba(255, 255, 255, 0.18); }
    :host(.auf) .hg { opacity: 1; }
    :host(.auf) .dlg { opacity: 1; transform: translate(-50%, -50%); }
    .kopf { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .kopf h2 { flex: 1 1 auto; min-width: 0; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .zu { width: 36px; height: 36px; border-radius: 50%; background: var(--taste); font-size: 20px; line-height: 36px; color: var(--t2); flex: 0 0 auto; }
    .zu:active, .knopf:active { filter: brightness(1.3); transform: scale(0.96); }
    .fr { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; padding: 4px 4px 2px; }
    .fr .ik { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--f); background: color-mix(in srgb, var(--f) 22%, transparent); --mdc-icon-size: 40px; }
    .fr p { margin: 0; font-size: 17px; line-height: 1.4; color: var(--t2); max-width: 440px; }
    .fr .aktion { display: grid; gap: 10px; width: 100%; max-width: 460px; margin-top: 8px; }
    .knopf { height: 52px; border-radius: 16px; font-size: 16px; font-weight: 600; background: var(--taste); padding: 0 8px; }
    .knopf.ja { background: var(--f); color: #FFF; }
    ha-icon { line-height: 0; }
    :host([nest]) .dlg { width: 780px; max-height: 560px; padding: 22px 26px; }
    :host([nest]) .kopf h2 { font-size: 30px; }
    :host([nest]) .zu { width: 56px; height: 56px; line-height: 56px; font-size: 28px; }
    :host([nest]) .fr { gap: 18px; padding: 6px 20px 4px; }
    :host([nest]) .fr .ik { width: 96px; height: 96px; --mdc-icon-size: 54px; }
    :host([nest]) .fr p { font-size: 26px; max-width: 660px; }
    :host([nest]) .fr .aktion { max-width: 660px; }
    :host([nest]) .knopf { height: 76px; font-size: 26px; border-radius: 22px; }`;
  let offen = false;
  const meldung = (o) => new Promise((ok) => {
    if (offen) { ok(false); return; }
    offen = true;
    let fertig = false;
    const ende = (v) => { if (fertig) return; fertig = true; offen = false; ok(v); };
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147480000;';
    const r = host.attachShadow({ mode: 'open' });
    r.innerHTML = '<style>' + BASIS + '</style><div class="hg"></div><div class="dlg">' +
      `<div class="kopf"><h2>${esc(o.titel)}</h2><button class="zu" aria-label="Schließen">×</button></div>
       <div class="fr" style="--f:${o.farbe || 'var(--gg-c-orange, #FF9F0A)'}"><span class="ik"><ha-icon icon="${esc(o.icon || 'mdi:alert-outline')}"></ha-icon></span><p>${esc(o.text)}</p>
         <div class="aktion" style="grid-template-columns:${o.nein ? '1fr 1fr' : '1fr'}">${o.nein ? '<button class="knopf nein">' + esc(o.nein) + '</button>' : ''}<button class="knopf ja">${esc(o.ja || 'OK')}</button></div></div>` + '</div>';
    if (tag()) host.setAttribute('tag', '');
    if (cast()) host.setAttribute('nest', '');
    document.body.appendChild(host);
    requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add('auf')));
    const zu = () => { if (!host.isConnected) return; host.classList.remove('auf'); setTimeout(() => host.remove(), 260); ende(false); };
    r.querySelector('.hg').addEventListener('click', zu);
    r.querySelector('.zu').addEventListener('click', zu);
    r.querySelector('.ja').addEventListener('click', () => { ende(true); zu(); });
    const n = r.querySelector('.nein');
    if (n) n.addEventListener('click', zu);
    haptik('warning');
  });

  /* ---------- Fensterwarnung: eine Weiche an der WebSocket-Verbindung deckt alles ab
     (Kacheln, Rundmenüs, Tipp-Knöpfe, Web, iPhone und Nest). */
  const KLIMA = 'climate.klima_gartenhaus_room_temperature';
  const FENSTER = [['binary_sensor.gartenhaus_fenster_nord_contact', 'Nord'], ['binary_sensor.gartenhaus_fenster_west_contact', 'West']];
  let hassLetzt = null;
  const hassJetzt = () => {
    const ha = document.querySelector('home-assistant') || document.querySelector('hc-main');
    let x = ha && (ha.hass || ha._hass);
    if (!(x && x.states) && ha && ha.shadowRoot) { const l = ha.shadowRoot.querySelector('hc-lovelace'); x = l && l.hass; }
    return x && x.states ? x : hassLetzt;
  };
  const zieleVon = (m) => {
    const e = [];
    const add = (x) => { if (x) (Array.isArray(x) ? x : String(x).split(',')).forEach((i) => e.push(String(i).trim())); };
    add(m.target && m.target.entity_id); add(m.service_data && m.service_data.entity_id);
    return e;
  };
  const einschalter = (m, hs) => {
    if (!m || m.type !== 'call_service') return null;
    const sd = m.service_data || {};
    if (m.domain === 'climate') {
      if (zieleVon(m).indexOf(KLIMA) < 0) return null;
      if (m.service === 'turn_on' || (m.service === 'set_hvac_mode' && sd.hvac_mode && sd.hvac_mode !== 'off')) return { art: 'direkt' };
      return null;
    }
    if (m.domain === 'script') {
      let name = m.service, v = sd;
      if (m.service === 'turn_on') { const z = zieleVon(m).filter((i) => i.indexOf('script.') === 0); if (!z.length) return null; name = z[0].slice(7); v = sd.variables || {}; }
      if (name === 'klima_modus_setzen' && v.modus && v.modus !== 'off') return { art: 'direkt' };
      if (name === 'klima_tipp_anwenden' && !v.bestaetigt) {
        const a = String((hs.states['sensor.klima_empfehlung'] || {}).state || '').split(';')[0];
        if (a === 'heat' || a === 'cool' || a === 'dry') return { art: 'tipp', turnOn: m.service === 'turn_on' };
      }
    }
    return null;
  };
  const mitBestaetigung = (m, e) => {
    const n = Object.assign({}, m);
    if (e.art !== 'tipp') return n;
    const sd = Object.assign({}, m.service_data || {});
    if (e.turnOn) sd.variables = Object.assign({}, sd.variables, { bestaetigt: true }); else sd.bestaetigt = true;
    n.service_data = sd;
    return n;
  };
  const haenge = (h) => {
    if (h && h.states) hassLetzt = h;
    const c = h && h.connection;
    if (!c || c.__ggFenster || typeof c.sendMessagePromise !== 'function') return;
    c.__ggFenster = true;
    const orig = c.sendMessagePromise.bind(c);
    c.sendMessagePromise = (msg, ...rest) => {
      let e = null, auf = [];
      try {
        const hs = hassJetzt(), k = hs && hs.states[KLIMA];
        if (hs && k && k.state === 'off') {
          e = einschalter(msg, hs);
          if (e) auf = FENSTER.filter((f) => hs.states[f[0]] && hs.states[f[0]].state === 'on').map((f) => f[1]);
        }
      } catch (_) { e = null; }
      if (!e || !auf.length) return orig(msg, ...rest);
      return meldung({
        icon: 'mdi:window-open-variant', titel: 'Fenster offen',
        text: (auf.length > 1 ? 'Die Fenster ' + auf.join(' und ') + ' sind' : 'Das Fenster ' + auf[0] + ' ist') + ' im Gartenhaus offen. Die Klimaanlage arbeitet dann gegen die Außenluft. Trotzdem einschalten?',
        ja: 'Trotzdem einschalten', nein: 'Abbrechen'
      }).then((ja) => (ja ? orig(mitBestaetigung(msg, e), ...rest) : { context: { id: '', parent_id: null, user_id: null } }));
    };
  };
  haenge(hassJetzt());
  setInterval(() => haenge(hassJetzt()), 3000);

  /* ---------- Kohlegrill: Steckdose nicht erreichbar → Hinweis „Strom einschalten“
     Home Assistant meldet eine WLAN-Steckdose erst nach Minuten als „nicht verfügbar“. Darum wird die Erreichbarkeit zusätzlich
     per Matter-Ping geprüft (alle 30 s, solange die Karte sichtbar ist, und frisch beim Antippen). */
  const ROT = 'var(--gg-c-rot, #FF453A)';
  const GERAET = { 'switch.gartenhaus_kohlegrill': '89fc7c1857fc13c9f69b70df5b5511a6' };
  const diag = () => {}; // v5: Diagnose in input_text.gg_diag entfernt (Audit A-11)
  const erreichbar = (h, id) => {
    const dev = (h.entities && h.entities[id] && h.entities[id].device_id) || GERAET[id];
    if (!dev || !h.connection) return Promise.resolve(null);
    return Promise.race([
      h.connection.sendMessagePromise({ type: 'matter/ping_node', device_id: dev }).then((r) => { const v = Object.keys(r || {}).map((k) => r[k]); return v.length ? v.some(Boolean) : null; }),
      new Promise((ok) => setTimeout(() => ok('zeit'), 20000))
    ]).catch(() => null);
  };
  const TEXT_WEG = 'Die Außensteckdose ist nicht erreichbar. Bitte den Strom am Schalter im Außenbereich einschalten, kurz warten und dann den Kohlegrill erneut starten.';
  const patchPfeife = (C) => {
    const P = C.prototype;
    if (P.__ggWeg) return;
    P.__ggWeg = true;
    const st = P._status, tipp = P._tipp, zeige = P._zeige;
    const laeuft = (s) => s.st === 'active' || s.st === 'paused';
    P._status = function () {
      const s = st.call(this), sd = this._h.states[this._c.steckdose];
      s.weg = (!!sd && (sd.state === 'unavailable' || sd.state === 'unknown')) || this._erreichbar === false;
      s.zustandWeg = !!sd && (sd.state === 'unavailable' || sd.state === 'unknown');
      return s;
    };
    P._pruefe = function () {
      if (this._pingLauf) return this._pingLauf;
      this._pingT = Date.now();
      this._pingLauf = erreichbar(this._h, this._c.steckdose).then((v) => {
        this._pingLauf = null;
        const alt = this._erreichbar;
        this._erreichbar = v === 'zeit' ? false : v;
        if (alt !== v || !this._diagGesendet) { this._diagGesendet = true; diag(this._h, 'ping=' + v + ' ' + this._c.art); }
        this._zeige();
        return v;
      });
      return this._pingLauf;
    };
    const TEXT_ZEIT = 'Die Außensteckdose antwortet nicht. Vermutlich ist der Strom am Schalter im Außenbereich aus. Bitte einschalten, kurz warten und den Kohlegrill erneut starten.';
    const dialog = (self, unklar) => {
      diag(self._h, 'dialog ' + (unklar ? 'zeit ' : '') + self._c.art);
      return unklar
        ? meldung({ icon: 'mdi:power-plug-off-outline', titel: 'Strom einschalten', text: TEXT_ZEIT, ja: 'Trotzdem starten', nein: 'Verstanden', farbe: ROT })
        : meldung({ icon: 'mdi:power-plug-off-outline', titel: 'Strom einschalten', text: TEXT_WEG, ja: 'Verstanden', farbe: ROT });
    };
    P._tipp = function () {
      const s = this._status();
      if (laeuft(s)) return tipp.call(this);
      if (this._c.art === 'kachel' && this._frage && Date.now() - this._frage < 4000) return tipp.call(this);
      if (this._prueft) return undefined;
      this._frage = 0;
      if (s.zustandWeg) { dialog(this); this._zeige(); return undefined; }
      if (this._erreichbar === false && Date.now() - (this._pingT || 0) < 45000) {
        dialog(this, false);
        this._pruefe();
        this._zeige();
        return undefined;
      }
      this._prueft = true;
      this._zeige();
      this._pruefe().then((v) => {
        this._prueft = false;
        this._zeige();
        if (v === false) dialog(this, false);
        else if (v === 'zeit') dialog(this, true).then((ja) => { if (ja) tipp.call(this); });
        else tipp.call(this);
      });
      return undefined;
    };
    P._zeige = function () {
      zeige.call(this);
      if (!this._r || !this._h) return;
      if (!this._wegCss) {
        this._wegCss = true;
        const st2 = document.createElement('style');
        st2.textContent = `.zi b.weg { color: ${ROT}; } .kachel.weg { background: color-mix(in srgb, ${ROT} 38%, rgba(40, 40, 46, 0.7)); } .kachel.weg .ic { color: #FFF; background: ${ROT}; }`;
        this._r.appendChild(st2);
      }
      const s = this._status(), aus = laeuft(s), weg = s.weg && !aus;
      if (!this._pingLauf && !aus && !document.hidden && Date.now() - (this._pingT || 0) > 30000 && this.getClientRects().length) this._pruefe();
      const r = this._r, kachel = r.querySelector('.kachel');
      if (kachel) {
        kachel.classList.toggle('weg', weg);
        const ic = kachel.querySelector('.ic ha-icon');
        if (ic) ic.setAttribute('icon', weg ? 'mdi:power-plug-off-outline' : 'mdi:toaster');
        if (this._prueft && !aus) kachel.querySelector('b').textContent = 'Prüfe …';
        else if (weg) kachel.querySelector('b').textContent = 'Kein Strom';
        return;
      }
      const los = r.querySelector('.los');
      if (this._prueft && !aus && los) { los.querySelector('span').textContent = 'Steckdose wird geprüft …'; return; }
      if (!s.weg) return;
      const sd = r.querySelector('.sd'), sdx = r.querySelector('.sdx');
      if (sd) { sd.textContent = 'Nicht erreichbar'; sd.className = 'sd weg'; }
      if (sdx) sdx.textContent = 'Strom am Schalter im Außenbereich einschalten';
      if (weg && los) {
        los.className = 'los frage';
        los.querySelector('span').textContent = 'Strom am Schalter einschalten';
        los.querySelector('ha-icon').setAttribute('icon', 'mdi:power-plug-off-outline');
      }
    };
    const d = Object.getOwnPropertyDescriptor(P, 'hass');
    if (d && d.set) Object.defineProperty(P, 'hass', { configurable: true, get: d.get, set(h) { haenge(h); d.set.call(this, h); } });
  };
  customElements.whenDefined('gg-pfeife').then(patchPfeife);
})();
