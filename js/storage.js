/* DreamLand - IndexedDB persistence (worlds + chunks) and settings. */
(function () {
  const DL = window.DL;
  const St = DL.Storage = {};
  DL.dimSlot = (slot, dim) => (dim ? slot + '@' + dim : slot);
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      if (!window.indexedDB) { resolve(null); return; }
      let req;
      try { req = indexedDB.open('dreamland', 1); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds');
        if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then(db => new Promise((resolve) => {
      if (!db) { resolve(null); return; }
      let t;
      try { t = db.transaction(store, mode); } catch (e) { resolve(null); return; }
      const s = t.objectStore(store);
      let result = null;
      const r = fn(s);
      if (r) r.onsuccess = () => { result = r.result; };
      t.oncomplete = () => resolve(result);
      t.onerror = () => resolve(null);
      t.onabort = () => resolve(null);
    }));
  }

  St.getWorld = slot => tx('worlds', 'readonly', s => s.get(slot));
  St.putWorld = (slot, data) => tx('worlds', 'readwrite', s => s.put(data, slot));
  St.listWorlds = () => tx('worlds', 'readonly', s => s.getAll()).then(r => r || []);
  St.getChunk = (slot, cx, cz) => tx('chunks', 'readonly', s => s.get(slot + ':' + cx + ',' + cz));
  St.putChunk = (slot, cx, cz, data) => tx('chunks', 'readwrite', s => s.put(data, slot + ':' + cx + ',' + cz));
  St.putChunks = (slot, list) => tx('chunks', 'readwrite', s => { for (const c of list) s.put(c.data, slot + ':' + c.cx + ',' + c.cz); return null; });
  St.chunkKeys = (slot) => tx('chunks', 'readonly', s => s.getAllKeys(IDBKeyRange.bound(slot + ':', slot + ':￿'))).then(r => r || []);
  St.deleteWorld = slot => open().then(db => new Promise(resolve => {
    if (!db) { resolve(); return; }
    const t = db.transaction(['worlds', 'chunks'], 'readwrite');
    t.objectStore('worlds').delete(slot);
    t.objectStore('chunks').delete(IDBKeyRange.bound(slot + ':', slot + ':￿'));
    for (let d = 1; d <= 3; d++) t.objectStore('chunks').delete(IDBKeyRange.bound(slot + '@' + d + ':', slot + '@' + d + ':￿'));
    t.oncomplete = () => resolve(); t.onerror = () => resolve();
  }));

  /* Compression (deflate) when supported */
  const canCompress = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
  St.compress = async function (u8) {
    if (!canCompress) return { raw: true, data: u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) };
    try {
      const cs = new CompressionStream('deflate');
      const out = new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer();
      return { raw: false, data: await out };
    } catch (e) { return { raw: true, data: u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) }; }
  };
  St.decompress = async function (rec) {
    if (rec.raw) return new Uint8Array(rec.data);
    const ds = new DecompressionStream('deflate');
    return new Uint8Array(await new Response(new Blob([rec.data]).stream().pipeThrough(ds)).arrayBuffer());
  };

  /* Settings */
  St.loadSettings = function () {
    try { const s = localStorage.getItem('dreamland.settings'); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  };
  St.saveSettings = function (o) {
    try { localStorage.setItem('dreamland.settings', JSON.stringify(o)); } catch (e) { /* ignore */ }
  };
})();
