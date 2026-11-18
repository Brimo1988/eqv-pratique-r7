/* Écran de connexion : le contenu (app.enc, images, vidéos) est chiffré en AES-256-GCM.
   La clé est dérivée du mot de passe (PBKDF2-SHA256). Sans le bon mot de passe, rien n'est lisible. */
(function(){
  'use strict';
  const SALT_B64 = 'IZExoP+hLSg4a1mLpyZJTA==', ITER = 250000, KEYSTORE = 'ecc_equin_k';
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64e = u => btoa(String.fromCharCode.apply(null, new Uint8Array(u)));
  const TYPES = {mp4:'video/mp4', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg'};
  let KEY = null; const URLS = new Map();

  async function derive(pw){
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt:b64d(SALT_B64), iterations:ITER, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, true, ['decrypt']);
  }
  async function dec(key, buf){ return crypto.subtle.decrypt({name:'AES-GCM', iv:buf.slice(0,12)}, key, buf.slice(12)); }
  async function get(url){ const r = await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status); return new Uint8Array(await r.arrayBuffer()); }

  window.MEDIA = function(path){
    if(URLS.has(path)) return URLS.get(path);
    const p = (async () => { const plain = await dec(KEY, await get(path + '.enc')); const ext = path.split('.').pop().toLowerCase();
      return URL.createObjectURL(new Blob([plain], {type: TYPES[ext] || 'application/octet-stream'})); })();
    URLS.set(path, p); p.catch(() => URLS.delete(path)); return p;
  };
  window.LOGOUT = function(){ try{ localStorage.removeItem(KEYSTORE); }catch(e){} location.reload(); };

  async function start(key){
    const code = new TextDecoder().decode(await dec(key, await get('app.enc')));   // lève une erreur si la clé est fausse
    KEY = key;
    document.getElementById('gate').remove();
    document.body.classList.remove('locked');
    const s = document.createElement('script'); s.src = URL.createObjectURL(new Blob([code], {type:'text/javascript'})); document.body.appendChild(s);
  }

  const form = document.getElementById('gate-form'), pw = document.getElementById('gate-pw'), msg = document.getElementById('gate-msg'), btn = document.getElementById('gate-btn'), rem = document.getElementById('gate-rem');
  if(!window.crypto || !crypto.subtle){ msg.textContent = 'Ce navigateur ne permet pas le déchiffrement. Ouvrez l\'adresse https dans Safari ou Chrome.'; btn.disabled = true; return; }

  form.addEventListener('submit', async e => {
    e.preventDefault(); if(!pw.value) return;
    btn.disabled = true; msg.className = ''; msg.textContent = 'Vérification…';
    try{
      const key = await derive(pw.value);
      await start(key);
      if(rem.checked){ try{ localStorage.setItem(KEYSTORE, b64e(await crypto.subtle.exportKey('raw', key))); }catch(err){} }
    }catch(err){
      msg.className = 'err'; msg.textContent = (err && err.name === 'OperationError') ? 'Mot de passe incorrect.' : 'Connexion impossible. Vérifiez internet, puis réessayez.';
      btn.disabled = false; pw.select();
    }
  });

  (async () => {   // reconnexion automatique si « Rester connectée » a été coché
    let raw = null; try{ raw = localStorage.getItem(KEYSTORE); }catch(e){}
    if(raw){ try{ const key = await crypto.subtle.importKey('raw', b64d(raw), {name:'AES-GCM'}, true, ['decrypt']); await start(key); return; }catch(e){ try{ localStorage.removeItem(KEYSTORE); }catch(_){} } }
    pw.focus();
  })();

  if('serviceWorker' in navigator && location.protocol === 'https:'){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
})();
