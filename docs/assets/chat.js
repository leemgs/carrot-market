'use strict';

// URL 파라미터: ?url=매물주소&msg=인사말&title=제목
const params = new URLSearchParams(location.search);
const itemUrl = params.get('url') || '';
const message = params.get('msg') || '안녕하세요. 제가 구매 가능할까요?';
const title = params.get('title') || '매물';

const msgEl = document.getElementById('chat-msg');
const titleEl = document.getElementById('item-title');
const openBtn = document.getElementById('open-item');
const copyBtn = document.getElementById('copy-btn');

msgEl.textContent = message;
titleEl.textContent = title;

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
