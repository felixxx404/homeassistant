/* gg-weich v1 – erzeugt auf dem Nest Hub (Cast) einmalig das Milchglas-Bild (640 px, blur 14 px, Sättigung 170 %)
   aus der 4K-Version, falls im Hintergrund-Helfer noch die alte 160-px-Version (ohne Kennung „w2“) steht. */
(() => {
  const w = window;
  if (w.__ggWeich) return;
  w.__ggWeich = true;
  const ZIELE = ['input_text.dashboard_hintergrund_eigen', 'input_text.dashboard_hintergrund_bild'];
  const cast = () => location.pathname.indexOf('receiver') >= 0 || !!document.querySelector('hc-main');
  const hassVon = () => { const e = document.querySelector('home-assistant') || document.querySelector('hc-main'); return e && e.hass; };
  const S = (h, e) => (h && h.states[e] ? h.states[e].state : '');
  const versucht = {};
  let laeuft = false;
  const lauf = async () => {
    const h = hassVon();
    if (!h || !h.states || laeuft || !cast()) return;
    for (const ziel of ZIELE) {
      const v = S(h, ziel), t = v.split(',');
      if (t.length !== 3 || !/^[0-9a-f]{32}$/.test(t[0]) || versucht[ziel + v]) continue;
      versucht[ziel + v] = true;
      laeuft = true;
      try {
        const pfad = '/api/image/serve/' + t[0] + '/original';
        const r = await fetch(h.hassUrl ? h.hassUrl(pfad) : pfad, { cache: 'no-store' });
        if (!r.ok) throw new Error('breit ' + r.status);
        const bmp = await createImageBitmap(await r.blob(), { resizeWidth: 1280, resizeQuality: 'high' });
        const bw = 640, bh = Math.round(640 * bmp.height / bmp.width);
        const c = document.createElement('canvas');
        c.width = bw; c.height = bh;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.filter = 'blur(14px) saturate(170%)';
        g.drawImage(bmp, 0, 0, bmp.width, bmp.height, -40, -40, bw + 80, bh + 80);
        if (bmp.close) bmp.close();
        const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
        const fd = new FormData();
        fd.append('file', new File([blob], 'hintergrund-weich.jpg', { type: 'image/jpeg' }));
        const u = await h.fetchWithAuth('/api/image/upload', { method: 'POST', body: fd });
        if (!u.ok) throw new Error('upload ' + u.status);
        const id = (await u.json()).id;
        const h2 = hassVon() || h;
        if (S(h2, ziel) !== v) { try { await h2.callWS({ type: 'image/delete', image_id: id }); } catch (_) {} }
        else {
          await h2.callService('input_text', 'set_value', { entity_id: ziel, value: [t[0], t[1], id, 'w2'].join(',') });
          try { await h2.callWS({ type: 'image/delete', image_id: t[2] }); } catch (_) {}
        }
      } catch (e) {
        try { h.callService('system_log', 'write', { logger: 'gg.nest', level: 'warning', message: 'gg-weich: ' + (e && e.message || e) }); } catch (_) {}
      }
      laeuft = false;
      return;
    }
  };
  setTimeout(() => { lauf(); setInterval(lauf, 60000); }, 6000 + Math.random() * 20000);
})();
