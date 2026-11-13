/* الجزء الأول: استيراد ملفات PDF وحفظها محليًا وعرضها */
(() => {
  'use strict';

  const DB_NAME = 'tahseeli-study-app';
  const DB_VERSION = 1;
  const STORE = 'files';

  const state = {
    files: [],
    currentFile: null,
    pdf: null,
    page: 1,
    rendering: false
  };

  window.StudyApp = state;

  // تحميل PDF.js لعرض صفحات ملفات PDF
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

      script.onload = () => {
        if (window.pdfjsLib) {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve();
        } else {
          reject(new Error('تعذر تحميل مكتبة عرض PDF'));
        }
      };

      script.onerror = () => reject(new Error('تعذر الاتصال لتحميل عارض PDF'));
      document.head.appendChild(script);
    });
  }

  // قاعدة بيانات محلية لحفظ ملفات PDF على الجهاز
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbAction(mode, action, value) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const request = action === 'getAll'
        ? store.getAll()
        : action === 'delete'
          ? store.delete(value)
          : store.put(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error);
    });
  }

  function makeId() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : 'f-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function safeText(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function notify(message) {
    let box = document.getElementById('appToast');

    if (!box) {
      box = document.createElement('div');
      box.id = 'appToast';
      box.style.cssText = [
        'position:fixed',
        'z-index:99999',
        'bottom:22px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:#14213D',
        'color:white',
        'padding:12px 18px',
        'border-radius:12px',
        'font:600 14px IBM Plex Sans Arabic, sans-serif',
        'box-shadow:0 8px 28px #14213d40',
        'max-width:90vw',
        'text-align:center'
      ].join(';');
      document.body.appendChild(box);
    }

    box.textContent = message;
    box.style.display = 'block';
    clearTimeout(box._timer);
    box._timer = setTimeout(() => {
      box.style.display = 'none';
    }, 3000);
  }

  // إضافة اختيار الملف عند الضغط على أزرار استيراد PDF
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf,.pdf';
  fileInput.hidden = true;
  document.body.appendChild(fileInput);

  function choosePdf() {
    fileInput.value = '';
    fileInput.click();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;

    const label = (button.innerText || '').trim();
    if (label.includes('استيراد PDF')) {
      event.preventDefault();
      choosePdf();
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify('الرجاء اختيار ملف PDF');
      return;
    }

    try {
      const record = {
        id: makeId(),
        name: file.name,
        subject: 'غير مصنف',
        size: file.size,
        addedAt: new Date().toISOString(),
        data: await file.arrayBuffer()
      };

      await dbAction('readwrite', 'put', record);
      await refreshLibrary();
      notify('تم استيراد الملف وحفظه على جهازك');
    } catch (error) {
      console.error(error);
      notify('تعذر حفظ الملف. تأكد من وجود مساحة كافية في المتصفح');
    }
  });

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' ك.ب';
    return (bytes / (1024 * 1024)).toFixed(1) + ' م.ب';
  }

  async function refreshLibrary() {
    try {
      state.files = await dbAction('readonly', 'getAll');
    } catch (error) {
      console.error(error);
      state.files = [];
    }

    const grid = document.getElementById('libGrid');
    if (!grid) return;

    if (!state.files.length) {
      grid.innerHTML =
        '<div class="card" style="grid-column:1/-1;padding:32px;text-align:center">' +
        '<div style="font-size:17px;font-weight:700">مكتبتك فارغة</div>' +
        '<div class="mut" style="margin-top:8px">اضغط «استيراد PDF» لإضافة أول ملف</div>' +
        '</div>';
      return;
    }

    grid.innerHTML = state.files.map(file => `
      <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0">
        <button type="button" data-study-file="${safeText(file.id)}"
          style="border:0;background:#F3F5F9;border-radius:12px;padding:20px 12px;
          min-height:150px;color:#0B5F58;cursor:pointer">
          <div style="font-size:34px">▤</div>
          <div style="font-size:12px;margin-top:8px">ملف PDF</div>
        </button>
        <div style="font-size:14px;font-weight:700;overflow-wrap:anywhere">
          ${safeText(file.name)}
        </div>
        <div class="mut">${safeText(file.subject || 'غير مصنف')} · ${formatSize(file.size)}</div>
        <div style="display:flex;gap:8px">
          <button class="btn pri" type="button" data-study-file="${safeText(file.id)}"
            style="height:38px;padding:0 12px;flex:1;justify-content:center">افتح</button>
          <button class="btn sec" type="button" data-delete-file="${safeText(file.id)}"
            style="height:38px;padding:0 12px" aria-label="حذف الملف">حذف</button>
        </div>
      </div>
    `).join('');
  }

  // فتح ملف من المكتبة
  document.addEventListener('click', async event => {
    const deleteButton = event.target.closest('[data-delete-file]');
    if (deleteButton) {
      const id = deleteButton.dataset.deleteFile;
      const file = state.files.find(item => item.id === id);
      if (!file) return;

      if (confirm(`هل تريد حذف الملف «${file.name}» من هذا الجهاز؟`)) {
        await dbAction('readwrite', 'delete', id);
        if (state.currentFile && state.currentFile.id === id) {
          state.currentFile = null;
          state.pdf = null;
        }
        await refreshLibrary();
        notify('تم حذف الملف');
      }
      return;
    }

    const openButton = event.target.closest('[data-study-file]');
    if (openButton) {
      event.preventDefault();
      const file = state.files.find(item => item.id === openButton.dataset.studyFile);
      if (file) await openPdf(file);
    }
  });

  async function openPdf(file) {
    state.currentFile = file;
    state.page = 1;

    const title = document.querySelector('#study .card');
    if (title) title.textContent = file.name + ' · جارٍ فتح الملف';

    // الانتقال إلى شاشة الدراسة باستخدام تنقل التطبيق الأصلي
    const backToStudy = document.querySelector('[data-go="study"]');
    if (backToStudy) backToStudy.click();
    else document.getElementById('study')?.classList.add('on');

    const paper = document.getElementById('paper');
    if (!paper) return;

    paper.innerHTML =
      '<div style="direction:rtl;text-align:center;margin:auto;color:#566178">' +
      'جارٍ فتح ملف PDF…</div>';

    try {
      await loadPdfJs();

      const bytes = new Uint8Array(file.data);
      state.pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

      paper.innerHTML = `
        <div id="pdfPageHost" style="position:absolute;inset:0;overflow:auto;
          display:flex;justify-content:center;align-items:flex-start;padding:24px;background:#fff">
          <canvas id="pdfCanvas" style="max-width:100%;height:auto;box-shadow:0 2px 14px #14213d18"></canvas>
        </div>
      `;

      await renderPdfPage();

      const pageLabel = document.querySelector('#study .card');
      if (pageLabel) {
        pageLabel.textContent =
          `${file.name} · ${state.page} / ${state.pdf.numPages}`;
      }
    } catch (error) {
      console.error(error);
      paper.innerHTML =
        '<div style="direction:rtl;text-align:center;margin:auto;color:#B42318">' +
        'تعذر عرض الملف. تأكد من اتصال الإنترنت لتحميل عارض PDF، ثم أعد فتح الملف.</div>';
      notify('تعذر فتح الملف');
    }
  }

  async function renderPdfPage() {
    if (!state.pdf || state.rendering) return;

    state.rendering = true;
    try {
      const page = await state.pdf.getPage(state.page);
      const canvas = document.getElementById('pdfCanvas');
      if (!canvas) return;

      const host = document.getElementById('pdfPageHost');
      const maxWidth = Math.max(300, (host?.clientWidth || 900) - 48);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(maxWidth / base.width, 1.8);
      const viewport = page.getViewport({ scale });

      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';

      const context = canvas.getContext('2d');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      await page.render({ canvasContext: context, viewport }).promise;

      const pageLabel = document.querySelector('#study .card');
      if (pageLabel && state.currentFile) {
        pageLabel.textContent =
          `${state.currentFile.name} · ${state.page} / ${state.pdf.numPages}`;
      }
    } finally {
      state.rendering = false;
    }
  }

  // أزرار الصفحات والتنقل بينها
  document.addEventListener('keydown', event => {
    if (!state.pdf || document.getElementById('study')?.classList.contains('on') !== true) return;

    if (event.key === 'ArrowLeft' && state.page < state.pdf.numPages) {
      state.page++;
      renderPdfPage();
    }

    if (event.key === 'ArrowRight' && state.page > 1) {
      state.page--;
      renderPdfPage();
    }
  });

  const pageButton = document.getElementById('bPages');
  if (pageButton) {
    pageButton.addEventListener('click', () => { // تم التعديل من dblclick إلى click عادي
      if (!state.pdf) return;
      const page = prompt(`رقم الصفحة من 1 إلى ${state.pdf.numPages}:`, state.page);
      const number = Number(page);
      if (Number.isInteger(number) && number >= 1 && number <= state.pdf.numPages) {
        state.page = number;
        renderPdfPage();
      }
    });
  }

  // بدء المكتبة واستبدال الملفات التجريبية بملفات المستخدم
  refreshLibrary();

  // إتاحة وظائف الصفحة لبقية أجزاء الإضافة
  state.refreshLibrary = refreshLibrary;
  state.openPdf = openPdf;
  state.renderPdfPage = renderPdfPage;
  state.notify = notify;
})();

/* الجزء الثاني: الجدول، الملاحظات، التدريب والتسجيل */
(() => {
  'use strict';

  const app = window.StudyApp;
  const PREFIX = 'tahseeli-app-';

  function toast(message) {
    if (app && typeof app.notify === 'function') {
      app.notify(message);
      return;
    }
    alert(message);
  }

  function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function readStore(key, fallback) {
    try {
      const value = localStorage.getItem(PREFIX + key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error(error);
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(error);
      toast('تعذر الحفظ في المتصفح؛ قد تكون مساحة التخزين ممتلئة');
      return false;
    }
  }

  // نافذة موحدة تحافظ على ألوان وخطوط الواجهة
  function openModal(title, content) {
    closeModal();

    const overlay = document.createElement('div');
    overlay.id = 'studyFeatureModal';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:100000;background:#14213d80;' +
      'display:flex;align-items:center;justify-content:center;padding:16px;' +
      'font-family:"IBM Plex Sans Arabic",sans-serif';

    overlay.innerHTML = `
      <section dir="rtl" style="
        width:min(620px,100%);max-height:90vh;overflow:auto;
        background:#fff;border-radius:18px;padding:20px;
        box-shadow:0 18px 60px #14213d40;color:#14213D">
        <header style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <h2 style="font-size:20px;margin:0">${escapeHTML(title)}</h2>
          <button type="button" data-modal-close
            aria-label="إغلاق"
            style="border:0;background:#F3F5F9;border-radius:10px;
            width:38px;height:38px;font-size:20px;cursor:pointer">×</button>
        </header>
        <div style="margin-top:16px">${content}</div>
      </section>
    `;

    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-modal-close]')) {
        closeModal();
      }
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function closeModal() {
    document.getElementById('studyFeatureModal')?.remove();
  }

  function fieldStyle() {
    return 'width:100%;box-sizing:border-box;border:1px solid #D9DFEA;' +
      'border-radius:10px;padding:11px 12px;font:14px "IBM Plex Sans Arabic",sans-serif;' +
      'color:#14213D;background:#fff';
  }

  function buttonStyle(primary = true) {
    return primary
      ? 'border:0;border-radius:10px;padding:10px 15px;background:#0B5F58;' +
        'color:#fff;font:600 14px "IBM Plex Sans Arabic",sans-serif;cursor:pointer'
      : 'border:1px solid #D9DFEA;border-radius:10px;padding:9px 13px;' +
        'background:#fff;color:#14213D;font:600 14px "IBM Plex Sans Arabic",sans-serif;cursor:pointer';
  }

  // =========================
  // الجدول الدراسي
  // =========================

  function getTasks() {
    return readStore('schedule', []);
  }

  function renderTasks(list) {
    const target = list || getTasks();
    const host = document.getElementById('taskList');

    if (!host) return;

    if (!target.length) {
      host.innerHTML =
        '<p style="color:#657087;text-align:center;padding:14px">لا توجد مهام بعد.</p>';
      return;
    }

    host.innerHTML = target
      .slice()
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map(task => `
        <article style="
          display:flex;align-items:center;gap:10px;padding:12px 0;
          border-bottom:1px solid #E8ECF2;opacity:${task.done ? '.6' : '1'}">
          <input type="checkbox" data-task-done="${escapeHTML(task.id)}"
            ${task.done ? 'checked' : ''} aria-label="إكمال المهمة">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;${task.done ? 'text-decoration:line-through' : ''}">
              ${escapeHTML(task.title)}
            </div>
            <div style="font-size:12px;color:#657087;margin-top:4px">
              ${escapeHTML(task.date || '')}
              ${task.time ? ' · ' + escapeHTML(task.time) : ''}
              ${task.type ? ' · ' + escapeHTML(task.type) : ''}
            </div>
          </div>
          <button type="button" data-task-delete="${escapeHTML(task.id)}"
            aria-label="حذف المهمة"
            style="border:0;background:#FFF1F0;color:#B42318;border-radius:8px;
            padding:7px 10px;cursor:pointer">حذف</button>
        </article>
      `).join('');
  }

  function showSchedule() {
    const overlay = openModal('الجدول الدراسي', `
      <form id="taskForm" style="display:grid;gap:10px">
        <input name="title" required maxlength="120" placeholder="اسم المادة أو المهمة"
          style="${fieldStyle()}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <input name="date" type="date" style="${fieldStyle()}">
          <input name="time" type="time" style="${fieldStyle()}">
        </div>
        <select name="type" style="${fieldStyle()}">
          <option value="مذاكرة">مذاكرة</option>
          <option value="مراجعة">مراجعة</option>
          <option value="اختبار">اختبار</option>
          <option value="أخرى">أخرى</option>
        </select>
        <button type="submit" style="${buttonStyle()}">إضافة إلى الجدول</button>
      </form>
      <div id="taskList" style="margin-top:16px"></div>
    `);

    const dateInput = overlay.querySelector('[name="date"]');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    renderTasks();

    overlay.querySelector('#taskForm').addEventListener('submit', event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const title = String(form.get('title') || '').trim();
      if (!title) return;

      const tasks = getTasks();
      tasks.push({
        id: makeId(),
        title,
        date: String(form.get('date') || ''),
        time: String(form.get('time') || ''),
        type: String(form.get('type') || ''),
        done: false
      });

      writeStore('schedule', tasks);
      event.currentTarget.reset();
      dateInput.value = new Date().toISOString().slice(0, 10);
      renderTasks();
      toast('تمت إضافة المهمة إلى الجدول');
    });

    overlay.addEventListener('change', event => {
      const id = event.target.dataset.taskDone;
      if (!id) return;

      const tasks = getTasks();
      const task = tasks.find(item => item.id === id);
      if (task) {
        task.done = event.target.checked;
        writeStore('schedule', tasks);
        renderTasks();
      }
    });

    overlay.addEventListener('click', event => {
      const id = event.target.dataset.taskDelete;
      if (!id) return;

      writeStore('schedule', getTasks().filter(task => task.id !== id));
      renderTasks();
      toast('تم حذف المهمة');
    });
  }

  // =========================
  // الملاحظات
  // =========================

  function currentNoteKey() {
    return app && app.currentFile
      ? 'note-' + app.currentFile.id
      : 'note-general';
  }

  function showNotes() {
    const saved = readStore(currentNoteKey(), '');
    const fileName = app && app.currentFile ? app.currentFile.name : 'ملاحظات عامة';

    const overlay = openModal('الملاحظات', `
      <p style="color:#657087;margin:0 0 10px">
        ${escapeHTML(fileName)} — تُحفظ الملاحظات على هذا الجهاز.
      </p>
      <textarea id="studyNotes" rows="12" placeholder="اكتب ملاحظاتك هنا…"
        style="${fieldStyle()}resize:vertical;line-height:1.8">${escapeHTML(saved)}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button id="saveNotes" type="button" style="${buttonStyle()}">حفظ الملاحظات</button>
        <button id="downloadNotes" type="button" style="${buttonStyle(false)}">تنزيل نسخة</button>
        <button id="clearNotes" type="button" style="${buttonStyle(false)}">مسح</button>
      </div>
    `);

    const textarea = overlay.querySelector('#studyNotes');

    overlay.querySelector('#saveNotes').addEventListener('click', () => {
      if (writeStore(currentNoteKey(), textarea.value)) {
        toast('تم حفظ الملاحظات');
      }
    });

    overlay.querySelector('#downloadNotes').addEventListener('click', () => {
      const blob = new Blob([textarea.value], { type: 'text/plain;charset=utf-8' });
      downloadBlob(blob, 'ملاحظاتي.txt');
    });

    overlay.querySelector('#clearNotes').addEventListener('click', () => {
      if (confirm('هل تريد مسح الملاحظات؟')) {
        textarea.value = '';
        writeStore(currentNoteKey(), '');
        toast('تم مسح الملاحظات');
      }
    });
  }

  // =========================
  // تدريب قصير من نص تدخله
  // =========================

  function makeQuestions(text) {
    const lines = text
      .split(/\n|[.!؟]+/)
      .map(line => line.trim())
      .filter(line => line.length >= 12);

    return lines.slice(0, 30).map(line => {
      const pair = line.match(/^(.{2,50})\s*[:：=]\s*(.{4,})$/);
      if (pair) {
        return {
          question: 'ما المقصود بـ «' + pair[1].trim() + '»؟',
          answer: pair[2].trim()
        };
      }

      const words = line.match(/[\u0600-\u06FF]{4,}|[A-Za-z]{4,}/g) || [];
      const answer = words.sort((a, b) => b.length - a.length)[0];

      if (!answer) {
        return { question: 'أكمل العبارة: ' + line, answer: line };
      }

      const index = line.indexOf(answer);
      return {
        question: 'أكمل العبارة: ' +
          line.slice(0, index) + 'ــــــ' + line.slice(index + answer.length),
        answer
      };
    });
  }

  function showQuiz() {
    openModal('تدريب واختبار', `
      <p style="color:#657087;margin-top:0">
        الصق ملاحظاتك أو محتوى للمراجعة. سيُنشئ التطبيق أسئلة إكمال بسيطة من النص؛
        لا يعتمد هذا التدريب على الذكاء الاصطناعي.
      </p>
      <textarea id="quizSource" rows="8"
        placeholder="مثال: البناء الضوئي: عملية تصنع فيها النباتات غذاءها باستخدام الضوء."
        style="${fieldStyle()}resize:vertical;line-height:1.8"></textarea>
      <button id="makeQuiz" type="button" style="${buttonStyle()};margin-top:10px">
        إنشاء التدريب
      </button>
      <div id="quizArea" style="margin-top:16px"></div>
    `);

    const overlay = document.getElementById('studyFeatureModal');
    const source = overlay.querySelector('#quizSource');

    const note = readStore(currentNoteKey(), '');
    if (note) source.value = note;

    overlay.querySelector('#makeQuiz').addEventListener('click', () => {
      const questions = makeQuestions(source.value);
      if (!questions.length) {
        toast('أدخل نصًا أطول أو أضف أسطرًا للمراجعة');
        return;
      }
      runQuiz(questions);
    });
  }

  function runQuiz(questions) {
    const area = document.querySelector('#studyFeatureModal #quizArea');
    let index = 0;
    let score = 0;

    function showQuestion() {
      if (index >= questions.length) {
        area.innerHTML = `
          <div style="padding:16px;background:#F3F8F6;border-radius:12px;text-align:center">
            <strong>انتهى التدريب</strong>
            <p>نتيجتك: ${score} من ${questions.length}</p>
            <button type="button" id="againQuiz" style="${buttonStyle(false)}">إعادة التدريب</button>
          </div>
        `;
        area.querySelector('#againQuiz').addEventListener('click', () => {
          index = 0;
          score = 0;
          showQuestion();
        });
        return;
      }

      const item = questions[index];
      area.innerHTML = `
        <div style="padding:14px;border:1px solid #E3E8F0;border-radius:12px">
          <div style="font-size:12px;color:#657087">السؤال ${index + 1} من ${questions.length}</div>
          <div style="font-weight:700;line-height:1.8;margin:8px 0 12px">
            ${escapeHTML(item.question)}
          </div>
          <input id="quizAnswer" placeholder="اكتب إجابتك"
            style="${fieldStyle()}">
          <div id="quizFeedback" style="margin-top:8px"></div>
          <button id="checkAnswer" type="button" style="${buttonStyle()};margin-top:10px">
            تحقق من الإجابة
          </button>
        </div>
      `;

      const input = area.querySelector('#quizAnswer');
      const feedback = area.querySelector('#quizFeedback');

      function check() {
        const userAnswer = input.value.trim().toLowerCase();
        const correctAnswer = item.answer.trim().toLowerCase();

        if (!userAnswer) {
          toast('اكتب إجابتك أولًا');
          return;
        }

        const correct = userAnswer === correctAnswer ||
          correctAnswer.includes(userAnswer) ||
          userAnswer.includes(correctAnswer);

        if (correct) score++;

        feedback.innerHTML = `
          <div style="color:${correct ? '#067647' : '#B42318'};line-height:1.8">
            ${correct ? 'إجابة صحيحة!' : 'ليست مطابقة تمامًا.'}
            <br>الإجابة المقترحة: <strong>${escapeHTML(item.answer)}</strong>
          </div>
          <button id="nextQuestion" type="button" style="${buttonStyle(false)};margin-top:8px">
            السؤال التالي
          </button>
        `;

        area.querySelector('#checkAnswer').disabled = true;
        area.querySelector('#nextQuestion').addEventListener('click', () => {
          index++;
          showQuestion();
        });
      }

      area.querySelector('#checkAnswer').addEventListener('click', check);
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') check();
      });
    }

    showQuestion();
  }

  // =========================
  // التسجيل الصوتي والتفريغ عند دعم المتصفح
  // =========================

  let mediaRecorder = null;
  let audioStream = null;
  let recognition = null;
  let audioChunks = [];
  let audioBlob = null;
  let transcript = '';

  function showRecorder() {
    const speechSupported =
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

    const overlay = openModal('التسجيل الصوتي', `
      <p style="color:#657087;margin-top:0">
        يحتاج التسجيل إلى السماح باستخدام الميكروفون. التفريغ النصي يعتمد على دعم
        المتصفح وقد يحتاج اتصالًا بالإنترنت.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="startRecording" type="button" style="${buttonStyle()}">بدء التسجيل</button>
        <button id="stopRecording" type="button" style="${buttonStyle(false)}" disabled>إيقاف</button>
        <button id="downloadRecording" type="button" style="${buttonStyle(false)}" disabled>تنزيل الصوت</button>
      </div>
      <p id="recordingStatus" style="color:#657087;margin:12px 0">
        ${speechSupported
          ? 'التفريغ النصي متاح إذا كان مدعومًا في متصفحك.'
          : 'متصفحك لا يدعم التفريغ الصوتي التلقائي؛ يمكنك تسجيل الصوت وتنزيله.'}
      </p>
      <label for="transcriptText" style="display:block;font-weight:700;margin-bottom:7px">
        النص المفرّغ أو ملاحظات التسجيل
      </label>
      <textarea id="transcriptText" rows="8"
        placeholder="سيظهر التفريغ هنا إذا كان مدعومًا…"
        style="${fieldStyle()}resize:vertical;line-height:1.8"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button id="saveTranscript" type="button" style="${buttonStyle()}">حفظ النص</button>
        <button id="downloadTranscript" type="button" style="${buttonStyle(false)}">تنزيل النص</button>
      </div>
    `);

    const status = overlay.querySelector('#recordingStatus');
    const transcriptBox = overlay.querySelector('#transcriptText');

    transcript = readStore(currentNoteKey() + '-transcript', '');
    transcriptBox.value = transcript;

    overlay.querySelector('#startRecording').addEventListener('click', async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        status.textContent = 'التسجيل غير مدعوم في هذا المتصفح.';
        return;
      }

      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        audioBlob = null;

        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = event => {
          if (event.data && event.data.size) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          audioBlob = new Blob(audioChunks, {
            type: mediaRecorder.mimeType || 'audio/webm'
          });

          overlay.querySelector('#downloadRecording').disabled = false;
          status.textContent = 'انتهى التسجيل. يمكنك تنزيل الملف الصوتي.';
          audioStream?.getTracks().forEach(track => track.stop());
          audioStream = null;
        };

        mediaRecorder.start();
        overlay.querySelector('#startRecording').disabled = true;
        overlay.querySelector('#stopRecording').disabled = false;
        status.textContent = 'جارٍ التسجيل…';

        startSpeechRecognition(status, transcriptBox);
      } catch (error) {
        console.error(error);
        status.textContent = 'تعذر استخدام الميكروفون. تحقق من صلاحيات الموقع.';
      }
    });

    overlay.querySelector('#stopRecording').addEventListener('click', () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      if (recognition) {
        try { recognition.stop(); } catch (_) {}
      }
      overlay.querySelector('#startRecording').disabled = false;
      overlay.querySelector('#stopRecording').disabled = true;
    });

    overlay.querySelector('#downloadRecording').addEventListener('click', () => {
      if (audioBlob) downloadBlob(audioBlob, 'تسجيل-مذاكرة.webm');
    });

    overlay.querySelector('#saveTranscript').addEventListener('click', () => {
      transcript = transcriptBox.value;
      if (writeStore(currentNoteKey() + '-transcript', transcript)) {
        toast('تم حفظ النص');
      }
    });

    overlay.querySelector('#downloadTranscript').addEventListener('click', () => {
      downloadBlob(
        new Blob([transcriptBox.value], { type: 'text/plain;charset=utf-8' }),
        'تفريغ-التسجيل.txt'
      );
    });

    overlay.addEventListener('click', event => {
      if (event.target.closest('[data-modal-close]')) stopAllRecording();
    });
  }

  function startSpeechRecognition(status, transcriptBox) {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = event => {
        let finalText = '';
        let interimText = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript + ' ';
          else interimText += result[0].transcript;
        }

        if (finalText) transcript += finalText;
        transcriptBox.value = transcript + interimText;
      };

      recognition.onerror = event => {
        status.textContent =
          'التسجيل الصوتي مستمر، لكن التفريغ توقف: ' + event.error;
      };

      recognition.start();
    } catch (error) {
      console.warn('تعذر بدء التفريغ الصوتي:', error);
      status.textContent = 'التسجيل الصوتي يعمل، لكن تعذر بدء التفريغ النصي.';
    }
  }

  function stopAllRecording() {
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (_) {}
    }
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }
  }

  // =========================
  // أدوات مساعدة وربط الأزرار
  // =========================

  function makeId() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : 'task-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button,[role="button"],a,.btn');
    if (!button) return;

    const label = (button.innerText || button.getAttribute('aria-label') || '')
      .trim()
      .replace(/\s+/g, ' ');

    if (/استيراد\s*PDF/i.test(label)) return;

    if (/جدول|جدولي|المهام/i.test(label)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showSchedule();
      return;
    }

    if (/اختبار|اختبارات|تدريب/i.test(label)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showQuiz();
      return;
    }

    if (/تسجيل|صوت|تفريغ/i.test(label)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showRecorder();
      return;
    }

    if (/ملاحظات|ملاحظة/i.test(label)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showNotes();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      stopAllRecording();
      closeModal();
    }
  });

  window.StudyFeatures = {
    showSchedule,
    showNotes,
    showQuiz,
    showRecorder,
    renderTasks
  };
})();
