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
  // chunk writes made in the same moment share a transaction (an autosave can write hundreds);
  // small batches keep each write task short
  let batch = null;
  St.putChunk = (slot, cx, cz, data) => {
    if (!batch || batch.list.length >= 12) {
      const b = batch = { list: [] };
      b.done = new Promise(r => setTimeout(r, 0)).then(() => { if (batch === b) batch = null; return tx('chunks', 'readwrite', s => { for (const [k, d] of b.list) s.put(d, k); return null; }); });
    }
    batch.list.push([slot + ':' + cx + ',' + cz, data]);
    return batch.done;
  };
  St.putChunks = (slot, list) => tx('chunks', 'readwrite', s => { for (const c of list) s.put(c.data, slot + ':' + c.cx + ',' + c.cz); return null; });
  St.chunkKeys = (slot) => tx('chunks', 'readonly', s => s.getAllKeys(IDBKeyRange.bound(slot + ':', slot + ':￿'))).then(r => r || []);
  St.deleteWorld = slot => open().then(db => new Promise(resolve => {
    if (!db) { resolve(); return; }
    const t = db.transaction(['worlds', 'chunks'], 'readwrite');
    t.objectStore('worlds').delete(slot);
    t.objectStore('chunks').delete(IDBKeyRange.bound(slot + ':', slot + ':￿'));
    for (let d = 1; d <= 16; d++) t.objectStore('chunks').delete(IDBKeyRange.bound(slot + '@' + d + ':', slot + '@' + d + ':￿'));
    t.oncomplete = () => resolve(); t.onerror = () => resolve();
  }));

  /* Compression (deflate) when supported. It runs in a small worker so that
     saving and loading chunks never stalls a frame; the main thread is the fallback. */
  const canCompress = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
  const deflate = async (buf, inflate) => {
    const s = inflate ? new DecompressionStream('deflate') : new CompressionStream('deflate');
    return new Response(new Blob([buf]).stream().pipeThrough(s)).arrayBuffer();
  };
  let zw = null, zSeq = 0;
  const zWait = new Map();
  function zipWorker() {
    if (zw !== null) return zw;
    zw = false;
    if (!canCompress || typeof Worker === 'undefined') return zw;
    try {
      const body = function () {
        self.onmessage = async (e) => {
          const { id, buf, inflate } = e.data;
          try {
            const s = inflate ? new DecompressionStream('deflate') : new CompressionStream('deflate');
            const out = await new Response(new Blob([buf]).stream().pipeThrough(s)).arrayBuffer();
            self.postMessage({ id, out }, [out]);
          } catch (err) { self.postMessage({ id, err: String(err) }); }
        };
      };
      const w = new Worker(URL.createObjectURL(new Blob(['(' + body.toString() + ')()'], { type: 'application/javascript' })));
      w.onmessage = (e) => {
        const r = zWait.get(e.data.id);
        if (!r) return;
        zWait.delete(e.data.id);
        if (e.data.err) r.no(); else r.ok(e.data.out);
      };
      w.onerror = () => { zw = false; for (const r of zWait.values()) r.no(); zWait.clear(); };
      zw = w;
    } catch (e) { zw = false; }
    return zw;
  }
  // in the worker if possible, else (or if it fails) right here
  const zip = (buf, inflate) => {
    const w = zipWorker();
    if (!w) return deflate(buf, inflate);
    return new Promise((ok, no) => {
      const id = ++zSeq;
      zWait.set(id, { ok, no });
      w.postMessage({ id, buf, inflate });
    }).catch(() => deflate(buf, inflate));
  };
  St.compress = async function (u8) {
    const copy = () => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    if (!canCompress) return { raw: true, data: copy() };
    try { return { raw: false, data: await zip(u8, false) }; } catch (e) { return { raw: true, data: copy() }; }
  };
  St.decompress = async function (rec) {
    if (rec.raw) return new Uint8Array(rec.data);
    return new Uint8Array(await zip(rec.data, true));
  };

  /* Settings */
  St.loadSettings = function () {
    try { const s = localStorage.getItem('dreamland.settings'); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  };
  St.saveSettings = function (o) {
    try { localStorage.setItem('dreamland.settings', JSON.stringify(o)); } catch (e) { /* ignore */ }
  };
})();
