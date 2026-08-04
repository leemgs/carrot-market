'use strict';

// 사이트별 브랜드 테마 (scripts/theme.js 와 동일하게 유지할 것)
const SITE_THEME = {
  daangn: { name: '당근마켓', emoji: '🥕', primary: '#ff6f0f', dark: '#e5620a', lite: '#ff9a3d', soft: '#fff4ec' },
  joongna: { name: '중고나라', emoji: '🟢', primary: '#0ba85c', dark: '#08834a', lite: '#2ed47f', soft: '#eafaf1' },
  bunjang: { name: '번개장터', emoji: '⚡', primary: '#1a1a1a', dark: '#000000', lite: '#4a4a4a', soft: '#f2f2f2' },
};

// URL 파라미터: ?url=매물주소&msg=인사말&title=제목&site=사이트키
const params = new URLSearchParams(location.search);
const itemUrl = params.get('url') || '';
const message = params.get('msg') || '안녕하세요. 제가 구매 가능할까요?';
const title = params.get('title') || '매물';

// 사이트 키: site 파라미터 우선, 없으면 매물 URL 호스트에서 유추 (구버전 링크 호환)
function inferSiteKey() {
  const explicit = params.get('site');
  if (explicit && SITE_THEME[explicit]) return explicit;
  const host = (() => {
    try {
      return new URL(itemUrl).hostname;
    } catch (_) {
      return '';
    }
  })();
  if (/joongna/.test(host)) return 'joongna';
  if (/bunjang/.test(host)) return 'bunjang';
  if (/daangn|karrotmarket/.test(host)) return 'daangn';
  return 'daangn';
}
const siteKey = inferSiteKey();
const theme = SITE_THEME[siteKey] || SITE_THEME.daangn;

// 페이지 전체를 사이트 테마 색상으로 재도색 (CSS 변수 오버라이드)
const rootStyle = document.documentElement.style;
rootStyle.setProperty('--carrot', theme.primary);
rootStyle.setProperty('--carrot-dark', theme.dark);
rootStyle.setProperty('--carrot-lite', theme.lite);

const msgEl = document.getElementById('chat-msg');
const titleEl = document.getElementById('item-title');
const openBtn = document.getElementById('open-item');
const openHint = document.getElementById('open-hint');
const copyBtn = document.getElementById('copy-btn');

msgEl.textContent = message;
titleEl.textContent = title;

// 사이트명/이모지에 맞춰 버튼·안내 문구 갱신
openBtn.textContent = `${theme.emoji} ${theme.name} 매물에서 채팅하기 →`;
if (openHint) {
  openHint.innerHTML =
    `아래 버튼을 누르면 <b>${theme.name}</b> 매물이 열립니다. ` +
    `<b>"채팅하기"</b>를 누른 뒤 방금 복사한 인사말을 붙여넣고 전송하세요.`;
}

if (itemUrl) {
  openBtn.href = itemUrl;
} else {
  openBtn.style.display = 'none';
}

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(message);
    copyBtn.textContent = '✅ 복사됨! 이제 매물로 이동하세요';
    setTimeout(() => (copyBtn.textContent = '📋 인사말 복사'), 2200);
  } catch (_) {
    // 클립보드 API 미지원 시: 텍스트 선택으로 폴백
    const range = document.createRange();
    range.selectNodeContents(msgEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    copyBtn.textContent = '길게 눌러 복사하세요';
  }
});
