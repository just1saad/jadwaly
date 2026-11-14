export function initSidebar(activePage) {
  const sideEl = document.querySelector('.side');
  if (!sideEl) return;

  const links = [
    { id: 'home', href: 'index.html', label: 'الرئيسية', icon: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>' },
    { id: 'library', href: 'library.html', label: 'المكتبة وملفات PDF', icon: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h12"/>' },
    { id: 'schedule', href: 'schedule.html', label: 'الجدول والتخطيط', icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>' },
    { id: 'quizzes', href: 'quizzes.html', label: 'الاختبارات والبطاقات', icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' },
    { id: 'recordings', href: 'recordings.html', label: 'التسجيلات الصوتية', icon: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>' },
    { id: 'tools', href: 'tools.html', label: 'الأدوات والذكاء الاصطناعي', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0l2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>' }
  ];

  sideEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:0 6px 20px">
      <div style="width:38px;height:38px;border-radius:10px;background:#0B5F58;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">ر</div>
      <b style="font-size:18px">رفيق المذاكرة</b>
    </div>
    ${links.map(l => `
      <a href="${l.href}" class="nav ${activePage === l.id ? 'on' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${l.icon}</svg>
        <span>${l.label}</span>
      </a>
    `).join('')}
  `;
}
