'use strict';

/**
 * 모든 페이지가 공유하는 상단 네비게이션을 그린다.
 * 각 페이지 <body data-page="..."> 값으로 현재 메뉴를 강조한다.
 * 매물 알림(issues)은 ?site=daangn|joongna 로 사이트별 강조.
 * 마운트 지점: <div id="nav-mount"></div>
 */
(function () {
  // 저장소를 Pages URL(owner.github.io/repo)에서 유추 → 레포 이름변경에도 안전.
  const REPO = (function () {
    try {
      const host = location.hostname;
      const seg = location.pathname.split('/').filter(Boolean)[0];
      if (host.endsWith('github.io') && seg) return host.split('.')[0] + '/' + seg;
    } catch (_) {}
    return 'leemgs/used-notifier';
  })();

  const ITEMS = [
    { id: 'dashboard', label: '대시보드', icon: '📊', href: './index.html' },
    { id: 'issues', site: 'daangn', label: '당근마켓', icon: '🥕', href: './issues.html?site=daangn' },
    { id: 'issues', site: 'joongna', label: '중고나라', icon: '🟢', href: './issues.html?site=joongna' },
    { id: 'issues', site: 'bunjang', label: '번개장터', icon: '⚡', href: './issues.html?site=bunjang' },
    { id: 'admin', label: '감시 목록', icon: '⚙️', href: './admin.html' },
    { id: 'add', label: '간편 등록', icon: '➕', href: './add.html' },
    { id: 'help', label: '도움말', icon: '❓', href: './help.html' },
  ];

  const page = document.body.dataset.page || '';
  const curSite = new URLSearchParams(location.search).get('site') || 'daangn';
  const mount = document.getElementById('nav-mount');
  if (!mount) return;

  const links = ITEMS.map((it) => {
    const active = it.id === page && (!it.site || it.site === curSite);
    return (
      `<a href="${it.href}" class="nav-link${active ? ' active' : ''}">` +
      `<span class="nav-ico">${it.icon}</span><span>${it.label}</span></a>`
    );
  }).join('');

  mount.innerHTML =
    '<nav class="topnav"><div class="nav-inner">' +
    '<a href="./index.html" class="brand">🛒 <span>중고 알리미</span></a>' +
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
