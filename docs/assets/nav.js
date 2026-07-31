'use strict';

/**
 * 모든 페이지가 공유하는 상단 네비게이션을 그린다.
 * 각 페이지 <body data-page="..."> 값으로 현재 메뉴를 강조한다.
 * 마운트 지점: <div id="nav-mount"></div>
 */
(function () {
  const REPO = 'leemgs/carrot-market';

  const ITEMS = [
    { id: 'dashboard', label: '대시보드', icon: '📊', href: './index.html' },
    { id: 'issues', label: '매물 알림', icon: '🔔', href: './issues.html' },
    { id: 'admin', label: '감시 목록', icon: '⚙️', href: './admin.html' },
    { id: 'add', label: '간편 등록', icon: '➕', href: './add.html' },
    { id: 'help', label: '도움말', icon: '❓', href: './help.html' },
  ];

  const active = document.body.dataset.page || '';
  const mount = document.getElementById('nav-mount');
  if (!mount) return;

  const links = ITEMS.map(
    (it) =>
      `<a href="${it.href}" class="nav-link${it.id === active ? ' active' : ''}">` +
      `<span class="nav-ico">${it.icon}</span><span>${it.label}</span></a>`
  ).join('');

  mount.innerHTML =
    '<nav class="topnav"><div class="nav-inner">' +
    '<a href="./index.html" class="brand">🥕 <span>당근 알림</span></a>' +
    '<button class="nav-toggle" aria-label="메뉴 열기" aria-expanded="false">☰</button>' +
    '<div class="nav-links">' +
    links +
    `<a href="https://github.com/${REPO}" target="_blank" rel="noopener" class="nav-link nav-ext">GitHub ↗</a>` +
    '</div></div></nav>';

  const toggle = mount.querySelector('.nav-toggle');
  const linksBox = mount.querySelector('.nav-links');
  toggle.addEventListener('click', () => {
    const open = linksBox.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();
