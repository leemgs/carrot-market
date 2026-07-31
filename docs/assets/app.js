'use strict';

// 저장소 정보 (다른 저장소로 포크했다면 이 값만 수정하세요)
const REPO = 'leemgs/carrot-market';
const BRANCH = 'main';
const CONFIG_PATH = 'config/watches.json';

const form = document.getElementById('watch-form');
const result = document.getElementById('result');
const snippetEl = document.querySelector('#snippet code');
const copyBtn = document.getElementById('copy-btn');
const editLink = document.getElementById('edit-link');
const repoLink = document.getElementById('repo-link');

// 저장소 링크를 REPO 값에 맞춰 갱신
if (repoLink) repoLink.href = `https://github.com/${REPO}`;
editLink.href = `https://github.com/${REPO}/edit/${BRANCH}/${CONFIG_PATH}`;

// 지역 선택 드롭다운(시/도 → 시/군/구)
const regionPicker = createRegionPicker(
  document.getElementById('location-sido'),
  document.getElementById('location-sigungu')
);

// 키워드+지역을 조합해 사람이 읽기 쉬운 id 생성
function makeId(keyword, location) {
  const base = `${keyword}-${location}`
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'watch';
}

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const keyword = document.getElementById('keyword').value.trim();
  const location = regionPicker.getValue();
  const email = document.getElementById('email').value.trim();

  const watch = {
    id: makeId(keyword, location),
    keyword,
    location,
    email,
    enabled: true,
  };

  snippetEl.textContent = JSON.stringify(watch, null, 2);
  result.classList.remove('hidden');
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(snippetEl.textContent);
    copyBtn.textContent = '✅ 복사됨';
    setTimeout(() => (copyBtn.textContent = '📋 복사'), 1800);
  } catch (_) {
    // 클립보드 API 실패 시 텍스트 선택으로 폴백
    const range = document.createRange();
    range.selectNodeContents(snippetEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
});
