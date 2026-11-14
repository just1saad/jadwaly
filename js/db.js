const DB_NAME = 'rafeeq-comprehensive-db';
const DB_VER = 3;

export function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

export function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings', { keyPath: 'id' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function storeAction(storeName, mode, action, val) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, mode);
    const st = tx.objectStore(storeName);
    const req = action === 'getAll' ? st.getAll() : action === 'delete' ? st.delete(val) : st.put(val);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
    tx.oncomplete = () => db.close();
  });
}

// استيراد ملف PDF مشترك لأي صفحة
export function setupPdfImporter(onSuccessCallback) {
  const pdfInput = document.createElement('input');
  pdfInput.type = 'file';
  pdfInput.accept = 'application/pdf,.pdf';
  pdfInput.style.display = 'none';
  document.body.appendChild(pdfInput);

  document.addEventListener('click', e => {
    if (e.target.closest('[data-import-pdf]')) {
      e.preventDefault();
      pdfInput.value = '';
      pdfInput.click();
    }
  });

  pdfInput.addEventListener('change', async () => {
    const file = pdfInput.files[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const rec = { id: makeId(), name: file.name, size: file.size, data: buffer };
    await storeAction('files', 'readwrite', 'put', rec);
    if (onSuccessCallback) onSuccessCallback(rec);
  });
}
