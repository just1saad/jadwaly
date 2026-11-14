// ==========================================
// 1. الأساسيات وقاعدة البيانات (DB & Helpers)
// ==========================================
const DB_NAME = 'rafeeq-comprehensive-db', DB_VER = 3;
function makeId(){ return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now(); }
function esc(s){ const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

function openDB(){
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains('files')) db.createObjectStore('files', {keyPath:'id'});
      if(!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings', {keyPath:'id'});
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function storeAction(storeName, mode, action, val){
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

// نظام التنقل الفوري (SPA)
function go(id){
  document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id));
  if(id === 'home') initHome();
  if(id === 'library') initLibrary();
  if(id === 'schedule') initSchedule();
  if(id === 'quizzes') initQuizzes();
  if(id === 'recordings') initRecordings();
}

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if(g){ e.preventDefault(); go(g.dataset.go); }
});

// حقن القائمة الجانبية فوراً لأن السكريبت في نهاية الصفحة
const tpl = document.getElementById('sidebarTemplate');
if(tpl){
  document.querySelectorAll('.side').forEach(side => {
    if(!side.hasChildNodes()) side.appendChild(tpl.content.cloneNode(true));
  });
}

initHome();
initPdfImporter();
initToolsAi();

let pdfState = { files: [], current: null, doc: null, fullTextCache: '' };
function initPdfImporter(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/pdf,.pdf'; inp.style.display = 'none';
  document.body.appendChild(inp);

  document.addEventListener('click', e => {
    if(e.target.closest('[data-import-pdf]')){ e.preventDefault(); inp.value = ''; inp.click(); }
  });

  inp.onchange = async () => {
    const file = inp.files[0];
    if(!file) return;
    const buffer = await file.arrayBuffer();
    const rec = { id: makeId(), name: file.name, size: file.size, data: buffer };
    await storeAction('files', 'readwrite', 'put', rec);
    openStudyView(rec);
  };
}

// ==========================================
// 2. قسم الرئيسية (Home Logic)
// ==========================================
async function initHome(){
  pdfState.files = await storeAction('files', 'readonly', 'getAll');
  
  const prev = document.getElementById('homeLibPreview');
  if(prev){
    prev.innerHTML = pdfState.files.slice(0,4).map(f => `
      <div class="card" style="padding:10px;cursor:pointer;display:flex;align-items:center;gap:8px" onclick="openStudyViewById('${f.id}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B5F58" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</div>
      </div>
    `).join('') || '<div class="mut">لا توجد ملفات.</div>';
  }

  const DAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'];
  const s = JSON.parse(localStorage.getItem('rafeeq-school-timetable-v1') || '{"classes":[]}');
  const todayName = DAYS[new Date().getDay() === 0 || new Date().getDay() === 6 ? 0 : new Date().getDay() - 1] || 'الأحد';
  const list = s.classes.filter(c => c.day === todayName);
  const todayBox = document.getElementById('todayClassesList');
  if(todayBox){
    todayBox.innerHTML = list.length ? list.map(c => `<div style="padding:8px 12px;background:#F3F5F9;border-radius:8px;font-weight:600">${esc(c.title)}</div>`).join('') : '<div class="mut" style="text-align:center;padding:10px">لا توجد حصص اليوم.</div>';
  }

  initHomeMic();
}

function initHomeMic(){
  const startBtn = document.getElementById('homeLiveMicBtn');
  const statusEl = document.getElementById('homeLiveStatus');
  const textBox = document.getElementById('homeLiveBox');
  const saveBtn = document.getElementById('saveHomeLiveBtn');
  if(!startBtn || startBtn.dataset.bound) return;
  startBtn.dataset.bound = "true";

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRec){ statusEl.textContent = 'متصفحك لا يدعم التفريغ.'; startBtn.disabled = true; return; }

  let rec = new SpeechRec();
  rec.lang = 'ar-SA'; rec.continuous = true; rec.interimResults = true;
  let listening = false, finalTxt = '';

  startBtn.onclick = () => {
    if(!listening){
      listening = true; finalTxt = textBox.value ? textBox.value + ' ' : '';
      rec.start(); startBtn.textContent = 'إيقاف'; startBtn.style.background = '#B42318'; statusEl.textContent = 'جاري الاستماع...';
    } else {
      listening = false; rec.stop(); startBtn.textContent = 'بدء الاستماع'; startBtn.style.background = '#E8590C'; statusEl.textContent = 'تم الإيقاف.';
    }
  };

  rec.onresult = (e) => {
    let interim = '', curFinal = '';
    for(let i = e.resultIndex; i < e.results.length; ++i){
      if(e.results[i].isFinal) curFinal += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    if(curFinal) finalTxt += curFinal;
    textBox.value = finalTxt + interim;
  };

  saveBtn.onclick = async () => {
    const text = textBox.value.trim();
    if(!text) return alert('لا يوجد نص لحفظه');
    await storeAction('recordings', 'readwrite', 'put', { id: makeId(), title: 'تفريغ ' + new Date().toLocaleDateString('ar-SA'), date: new Date().toLocaleDateString('ar-SA'), transcript: text });
    alert('تم حفظ التفريغ في التسجيلات!'); textBox.value = ''; finalTxt = '';
  };
}

// ==========================================
// 3. قسم المكتبة (Library Logic)
// ==========================================
async function initLibrary(){
  pdfState.files = await storeAction('files', 'readonly', 'getAll');
  const grid = document.getElementById('libGrid');
  if(!grid) return;

  if(!pdfState.files.length){
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:#566178">مكتبتك فارغة. اضغط «استيراد PDF».</div>';
    return;
  }

  grid.innerHTML = pdfState.files.map(f => `
    <div class="card" style="padding:12px;display:flex;flex-direction:column;gap:8px">
      <div style="aspect-ratio:3/4;border-radius:10px;background:#E4F2F0;color:#0B5F58;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="openStudyViewById('${f.id}')">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div style="font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</div>
      <div style="display:flex;gap:6px;">
        <button class="btn pri" style="flex:1;height:32px;font-size:13px;" onclick="openStudyViewById('${f.id}')">افتح</button>
        <button class="btn sec" style="height:32px;padding:0 10px;color:#B42318;" onclick="deleteFile('${f.id}')">حذف</button>
      </div>
    </div>
  `).join('');
}

async function deleteFile(id){
  if(confirm('هل تريد حذف الملف؟')){
    await storeAction('files', 'readwrite', 'delete', id);
    initLibrary();
  }
}

// ==========================================
// 4. قراءة وعرض ملفات PDF وقلم الرسم (Study & Canvas)
// ==========================================
async function openStudyViewById(id){
  const file = pdfState.files.find(x => x.id === id) || (await storeAction('files', 'readonly', 'getAll')).find(x => x.id === id);
  if(file) openStudyView(file);
}

async function openStudyView(file){
  if(!file || !file.data) return;
  pdfState.current = file;
  go('study');

  const paper = document.getElementById('paper');
  paper.innerHTML = '<div style="margin:auto;color:#566178">جاري فتح المستند...</div>';

  try {
    const blob = new Blob([file.data], { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(blob);
    pdfState.doc = await pdfjsLib.getDocument(pdfUrl).promise;
    
    paper.innerHTML = '';
    pdfState.fullTextCache = '';
    const thumbList = document.getElementById('thumbList');
    if(thumbList) thumbList.innerHTML = '';

    for(let i=1; i<=pdfState.doc.numPages; i++){
      const page = await pdfState.doc.getPage(i);
      const vp = page.getViewport({ scale: 1.5 });
      const dpr = window.devicePixelRatio || 1;

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;margin:0 auto 20px;width:100%;';

      const canvas = document.createElement('canvas');
      canvas.width = vp.width * dpr; canvas.height = vp.height * dpr;
      canvas.style.cssText = 'display:block;width:100%;height:auto;box-shadow:0 4px 16px rgba(0,0,0,.15);background:#fff;';
      const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;

      const drawCanvas = document.createElement('canvas');
      drawCanvas.width = vp.width * dpr; drawCanvas.height = vp.height * dpr;
      drawCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;z-index:5;';
      setupDrawing(drawCanvas, vp.width, vp.height);

      wrapper.appendChild(canvas); wrapper.appendChild(drawCanvas);
      paper.appendChild(wrapper);

      if(thumbList){
        const tCanvas = document.createElement('canvas');
        const tvp = page.getViewport({ scale: 0.2 });
        tCanvas.width = tvp.width; tCanvas.height = tvp.height;
        tCanvas.style.cssText = 'width:100px;cursor:pointer;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.1);';
        await page.render({ canvasContext: tCanvas.getContext('2d'), viewport: tvp }).promise;
        tCanvas.onclick = () => wrapper.scrollIntoView({ behavior: 'smooth' });
        thumbList.appendChild(tCanvas);
      }

      const txt = await page.getTextContent();
      pdfState.fullTextCache += ' ' + txt.items.map(item => item.str).join(' ');
    }
    document.getElementById('pdfFileTitleBanner').textContent = `${file.name} (${pdfState.doc.numPages} صفحة)`;
  } catch(err){
    paper.innerHTML = '<div style="margin:auto;color:#B42318;">تعذر تحميل المستند.</div>';
  }
}

let currentTool = 'pen', strokeColor = '#14213D';
function setupDrawing(canvas, w, h){
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);
  let drawing = false;

  const getPos = e => {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (w / rect.width), y: (e.clientY - rect.top) * (h / rect.height) };
  };

  canvas.onmousedown = e => {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = currentTool === 'highlighter' ? 'multiply' : 'source-over';
  };

  canvas.onmousemove = e => {
    if(!drawing) return;
    const pos = getPos(e);
    if(currentTool === 'eraser'){
      ctx.clearRect(pos.x - 15, pos.y - 15, 30, 30);
    } else {
      ctx.strokeStyle = currentTool === 'highlighter' ? strokeColor + '55' : strokeColor;
      ctx.lineWidth = currentTool === 'highlighter' ? 18 : 3;
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
    }
  };
  canvas.onmouseup = () => drawing = false;
}

// تشغيل أدوات شاشة الدراسة عند تحميل العناصر
const aiDr = document.getElementById('aiDr');
const thumbDr = document.getElementById('thumbDr');

const bAI = document.getElementById('bAI');
if(bAI) bAI.onclick = () => { aiDr.classList.toggle('hide'); thumbDr.classList.add('hide'); };

const closeAiDr = document.getElementById('closeAiDr');
if(closeAiDr) closeAiDr.onclick = () => aiDr.classList.add('hide');

const btnThumbToggle = document.getElementById('btnThumbToggle');
if(btnThumbToggle) btnThumbToggle.onclick = () => { thumbDr.classList.toggle('hide'); aiDr.classList.add('hide'); };

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tool-btn').forEach(b => { b.style.background = 'transparent'; b.style.color = '#44506A'; });
    btn.style.background = '#0B5F58'; btn.style.color = '#fff';
    currentTool = btn.dataset.tool;
  };
});

const colorPicker = document.getElementById('colorPicker');
if(colorPicker) colorPicker.oninput = e => strokeColor = e.target.value;

const studyAiSendBtn = document.getElementById('studyAiSendBtn');
if(studyAiSendBtn){
  studyAiSendBtn.onclick = () => {
    const inp = document.getElementById('studyAiInput');
    const box = document.getElementById('studyAiChatBox');
    const q = inp.value.trim(); if(!q) return;
    box.innerHTML += `<div style="background:#0B5F58;color:#fff;padding:6px 10px;border-radius:8px;align-self:flex-end;">${esc(q)}</div>`;
    inp.value = '';
    setTimeout(() => {
      box.innerHTML += `<div style="background:#fff;padding:6px 10px;border-radius:8px;align-self:flex-start;">بناءً على الملف الحالي، هذا جزء مهم لمراجعتك وتثبيت معلوماتك.</div>`;
      box.scrollTop = box.scrollHeight;
    }, 500);
  };
}

const internalGenQuizBtn = document.getElementById('internalGenQuizBtn');
if(internalGenQuizBtn){
  internalGenQuizBtn.onclick = () => {
    const questions = generateAccurateQuestions(pdfState.fullTextCache, 4);
    const container = document.getElementById('internalQuizContainer');
    let idx = 0;
    function showQ(){
      if(idx >= questions.length){ container.innerHTML = '<div style="color:#0B5F58;font-weight:700;text-align:center;">انتهى الاختبار!</div>'; return; }
      const item = questions[idx];
      container.innerHTML = `
        <div style="font-size:12px;font-weight:700;">${esc(item.q)}</div>
        ${item.options.map(o => `<button class="q-opt" data-val="${esc(o)}" style="background:#F3F5F9;border:1px solid #D5DBE7;padding:6px;border-radius:6px;text-align:right;font-size:11px;margin-top:4px;">${esc(o)}</button>`).join('')}
        <button id="nxtQBtn" class="btn pri hide" style="height:26px;font-size:11px;margin-top:4px;">التالي</button>
      `;
      container.querySelectorAll('.q-opt').forEach(b => {
        b.onclick = () => {
          b.style.background = b.dataset.val === item.answer ? '#E4F2F0' : '#FDECEA';
          container.querySelector('#nxtQBtn').classList.remove('hide');
        };
      });
      container.querySelector('#nxtQBtn').onclick = () => { idx++; showQ(); };
    }
    showQ();
  };
}

// ==========================================
// 5. محرك توليد الاختبارات الدقيقة (Quiz Engine)
// ==========================================
function generateAccurateQuestions(text, count = 5){
  const sentences = (text || "").split(/[.!?؟؛\n]+/).map(s => s.trim()).filter(s => s.length > 15);
  if(!sentences.length){
    return [{ q: "ما هو المحتوى الرئيسي في المستند؟", options: ["العنصر الأساسي", "تفاصيل فرعية", "ملاحظة", "عنوان"], answer: "العنصر الأساسي", explanation: "سؤال افتراضي." }];
  }
  const step = Math.max(1, Math.floor(sentences.length / count));
  const selected = [];
  for(let i = 0; i < sentences.length && selected.length < count; i += step) selected.push(sentences[i]);

  const distractors = [...new Set(text.split(/\s+/).filter(w => w.length > 4))];

  return selected.map((sent, idx) => {
    const words = sent.split(' ').filter(w => w.length > 4);
    const target = words[Math.floor(words.length / 2)] || words[0];
    const prompt = sent.replace(target, '________');
    let wrong = distractors.filter(w => w !== target).sort(() => Math.random() - .5).slice(0, 3);
    while(wrong.length < 3) wrong.push('مفهوم علمي');

    return {
      q: `سؤال (${idx+1}): أكمل الفراغ بدقة:\n"${prompt}"`,
      options: [target, ...wrong].sort(() => Math.random() - .5),
      answer: target,
      explanation: `المرجع:\n"${sent}"`
    };
  });
}

async function initQuizzes(){
  const qMain = document.getElementById('qMain');
  if(!qMain) return;
  const files = await storeAction('files', 'readonly', 'getAll');

  if(!files.length){
    qMain.innerHTML = `<h1>الاختبارات الذكية</h1><div class="card" style="padding:40px;text-align:center"><h2>لا توجد ملفات في المكتبة</h2><button class="btn pri" onclick="go('library')">الذهاب للمكتبة</button></div>`;
    return;
  }

  qMain.innerHTML = `
    <h1>الاختبارات الذكية</h1>
    <div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px;max-width:600px">
      <label style="font-weight:600">اختر الملف لتوليد الأسئلة:</label>
      <select id="quizFileSelect" class="inp">${files.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select>
      <button class="btn pri" id="startQuizBtn">بدء الاختبار</button>
    </div>
  `;

  document.getElementById('startQuizBtn').onclick = async () => {
    const file = files.find(f => f.id === document.getElementById('quizFileSelect').value);
    qMain.innerHTML = `<div style="margin:auto;font-weight:600;">جاري استخراج الأسئلة من الملف...</div>`;

    const doc = await pdfjsLib.getDocument(URL.createObjectURL(new Blob([file.data], {type:'application/pdf'}))).promise;
    let fullText = '';
    for(let i=1; i<=doc.numPages; i++){
      const page = await doc.getPage(i);
      const txt = await page.getTextContent();
      fullText += ' ' + txt.items.map(item => item.str).join(' ');
    }

    const questions = generateAccurateQuestions(fullText, 5);
    runQuizSession(questions, 0, 0);
  };
}

function runQuizSession(questions, index, score){
  const qMain = document.getElementById('qMain');
  if(index >= questions.length){
    qMain.innerHTML = `<div class="card" style="margin:auto;padding:40px;text-align:center"><h1>انتهى الاختبار!</h1><h3>النتيجة: ${score} / ${questions.length}</h3><button class="btn pri" onclick="initQuizzes()">اختبار جديد</button></div>`;
    return;
  }
  const item = questions[index];
  qMain.innerHTML = `
    <b>السؤال ${index+1} من ${questions.length}</b>
    <div class="card" style="padding:24px;font-size:18px;font-weight:600;white-space:pre-line">${esc(item.q)}</div>
    <div style="display:flex;flex-direction:column;gap:10px;max-width:650px">
      ${item.options.map(o => `<button class="opt" data-opt="${esc(o)}">${esc(o)}</button>`).join('')}
    </div>
    <div id="expBox" class="card hide" style="padding:14px;background:#E4F2F0;max-width:650px"><b>المرجع:</b> ${esc(item.explanation)}</div>
    <button id="nextQuizBtn" class="btn pri hide" style="max-width:200px;">السؤال التالي</button>
  `;

  let answered = false;
  document.querySelectorAll('.opt').forEach(btn => {
    btn.onclick = () => {
      if(answered) return; answered = true;
      if(btn.dataset.opt === item.answer) score++;
      document.querySelectorAll('.opt').forEach(b => {
        if(b.dataset.opt === item.answer) b.classList.add('ok');
        else if(b === btn) b.classList.add('no');
      });
      document.getElementById('expBox').classList.remove('hide');
      document.getElementById('nextQuizBtn').classList.remove('hide');
    };
  });
  document.getElementById('nextQuizBtn').onclick = () => runQuizSession(questions, index+1, score);
}

// ==========================================
// 6. الجدول والتسجيلات والأدوات (Schedule, Recordings, Tools)
// ==========================================
function initSchedule(){
  const DAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'];
  const s = JSON.parse(localStorage.getItem('rafeeq-school-timetable-v1') || '{"classes":[]}');
  const container = document.getElementById('schedContainer');
  if(!container) return;

  container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">${DAYS.map(day => `
    <div style="background:#F3F5F9;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px">
      <div style="font-weight:700;text-align:center;padding:6px;background:#fff;border-radius:8px">${day}</div>
      ${s.classes.filter(c => c.day === day).map(c => `<div style="background:#fff;padding:8px;border-radius:8px;font-size:13px;font-weight:600">${esc(c.title)}</div>`).join('')}
    </div>`).join('')}</div>`;
}

const addSchedClassBtn = document.getElementById('addSchedClassBtn');
if(addSchedClassBtn){
  addSchedClassBtn.onclick = () => {
    const title = prompt('اسم المادة:');
    const day = prompt('اليوم (الأحد، الإثنين، الثلاثاء، الأربعاء، الخميس):', 'الأحد');
    if(title){
      const s = JSON.parse(localStorage.getItem('rafeeq-school-timetable-v1') || '{"classes":[]}');
      s.classes.push({ id: makeId(), title, day });
      localStorage.setItem('rafeeq-school-timetable-v1', JSON.stringify(s));
      initSchedule();
    }
  };
}

async function initRecordings(){
  const recList = document.getElementById('recList');
  if(!recList) return;
  const recs = await storeAction('recordings', 'readonly', 'getAll');
  recList.innerHTML = recs.length ? recs.map(r => `
    <div class="card" style="padding:16px">
      <div style="font-weight:700;color:#0B5F58;margin-bottom:6px">${esc(r.title)} (${esc(r.date)})</div>
      <div style="font-size:14px;line-height:1.6">${esc(r.transcript)}</div>
    </div>
  `).join('') : '<div class="mut">لا توجد تسجيلات محفوظة بعد.</div>';
}

function initToolsAi(){
  const input = document.getElementById('globalAiInput');
  const send = document.getElementById('globalAiSendBtn');
  const box = document.getElementById('globalAiChatBox');
  if(!send || send.dataset.bound) return;
  send.dataset.bound = "true";

  send.onclick = () => {
    const txt = input.value.trim(); if(!txt) return;
    box.innerHTML += `<div style="background:#0B5F58;color:#fff;padding:10px;border-radius:10px;align-self:flex-end;max-width:80%">${esc(txt)}</div>`;
    input.value = '';
    setTimeout(() => {
      box.innerHTML += `<div style="background:#fff;padding:10px;border-radius:10px;align-self:flex-start;max-width:80%">أهلاً بك! يمكنك فتح أي ملف من المكتبة لتوليد الأسئلة وتحليله فوراً.</div>`;
      box.scrollTop = box.scrollHeight;
    }, 500);
  };
}
