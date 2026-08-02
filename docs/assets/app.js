'use strict';

// 저장소를 Pages URL(owner.github.io/repo)에서 유추 → 레포 이름변경에도 안전.
const REPO = (function () {
  try {
    const host = location.hostname;
    const seg = location.pathname.split('/').filter(Boolean)[0];
    if (host.endsWith('github.io') && seg) return host.split('.')[0] + '/' + seg;
  } catch (_) {}
  return 'leemgs/used-notifier';
})();
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
  document.getElementById('location-sigungu'),
  document.getElementById('location-dong')
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
  // 이메일을 쉼표/세미콜론/공백으로 분리해 정규화 (여러 명 지원)
  const emails = document
    .getElementById('email')
    .value.split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // 여러 개면 배열로, 1개면 문자열로 저장
  const email = emails.length > 1 ? emails : emails[0] || '';

  // 희망 금액(이하): 숫자만 추출
  const maxDigits = document.getElementById('maxprice').value.replace(/[^\d]/g, '');
  const maxPrice = maxDigits ? parseInt(maxDigits, 10) : 0;

  // 검색할 사이트 (당근/중고나라)
  const sites = Array.from(document.querySelectorAll('input[name="site"]:checked')).map(
    (el) => el.value
  );

  const watch = {
    id: makeId(keyword, location),
    keyword,
    location,
    email,
    enabled: true,
  };
  if (maxPrice > 0) watch.maxPrice = maxPrice;
  if (sites.length) watch.sites = sites; // 선택한 사이트 명시 (미선택 시 생략 → 기본 전체)

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

// 희망 금액 입력 시 천단위 콤마 자동 표시
const maxPriceInput = document.getElementById('maxprice');
if (maxPriceInput) {
  maxPriceInput.addEventListener('input', () => {
    const d = maxPriceInput.value.replace(/[^\d]/g, '');
    maxPriceInput.value = d ? parseInt(d, 10).toLocaleString('ko-KR') : '';
  });
}
