'use strict';

/**
 * 페이지/사이트별 브랜드 테마를 CSS 변수로 주입한다.
 * <head> 에서 로드되어(스크립트 태그 순서상 style.css 뒤) 히어로 색이 깜빡이지 않도록
 * location(경로/site 파라미터)만으로 즉시 테마를 결정·적용한다.
 *
 *   - 통합/공용 페이지(대시보드·감시목록·간편등록·도움말) → 회색(neutral)
 *   - 당근마켓 → 오렌지 · 중고나라 → 그린 · 번개장터 → 파랑
 *
 * scripts/theme.js(이메일/이슈 서버측)와 색상을 일치시켜야 한다.
 */
(function () {
  var SITE_THEME = {
    neutral: { name: '중고 알리미', emoji: '🛒', primary: '#64748b', dark: '#475569', lite: '#94a3b8', soft: '#f1f5f9' },
    daangn:  { name: '당근마켓',   emoji: '🥕', primary: '#ff6f0f', dark: '#e5620a', lite: '#ff9a3d', soft: '#fff4ec' },
    joongna: { name: '중고나라',   emoji: '🟢', primary: '#0ba85c', dark: '#08834a', lite: '#2ed47f', soft: '#eafaf1' },
    bunjang: { name: '번개장터',   emoji: '⚡', primary: '#2563eb', dark: '#1d4ed8', lite: '#60a5fa', soft: '#eef4ff' },
  };

  function applySiteTheme(key) {
    var t = SITE_THEME[key] || SITE_THEME.neutral;
    var s = document.documentElement.style;
    s.setProperty('--carrot', t.primary);
    s.setProperty('--carrot-dark', t.dark);
    s.setProperty('--carrot-lite', t.lite);
    s.setProperty('--soft', t.soft);
    return t;
  }

  // 다른 스크립트(nav.js, chat.js)에서 재사용
  window.SITE_THEME = SITE_THEME;
  window.applySiteTheme = applySiteTheme;

  // 경로 기반 자동 적용.
  //   issues.html → ?site 값의 사이트 테마(기본 당근)
  //   chat.html   → chat.js 가 매물 URL 호스트까지 보고 결정하므로 여기선 건너뜀
  //   그 외(대시보드/감시목록/간편등록/도움말) → 회색
  var path = location.pathname;
  if (/chat\.html/.test(path)) return;
  var key = /issues\.html/.test(path)
    ? new URLSearchParams(location.search).get('site') || 'daangn'
    : 'neutral';
  applySiteTheme(key);
})();
