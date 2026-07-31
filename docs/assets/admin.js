'use strict';

/**
 * 감시 목록(config/watches.json) 웹 관리자.
 * 서버 없이 브라우저에서 GitHub Contents API 로 직접 읽고 커밋한다.
 */

const CONFIG_PATH = 'config/watches.json';
const LS_TOKEN = 'cma_token';
const LS_REPO = 'cma_repo';
const LS_BRANCH = 'cma_branch';
const DEFAULT_REPO = 'leemgs/carrot-market';
const DEFAULT_BRANCH = 'main';

// ------- 상태 -------
let data = null; // watches.json 전체 객체
let fileSha = null; // 커밋 시 필요한 현재 파일 sha

// ------- DOM -------
const $ = (id) => document.getElementById(id);
const tokenEl = $('token');
const repoEl = $('repo');
const branchEl = $('branch');
const connStatus = $('conn-status');
const saveStatus = $('save-status');
const tbody = $('watch-tbody');

// 지역 선택 드롭다운(시/도 → 시/군/구)
const regionPicker = createRegionPicker($('f-sido'), $('f-sigungu'), $('f-dong'));

// ------- 초기화: 저장된 값 복원 -------
tokenEl.value = localStorage.getItem(LS_TOKEN) || '';
repoEl.value = localStorage.getItem(LS_REPO) || DEFAULT_REPO;
branchEl.value = localStorage.getItem(LS_BRANCH) || DEFAULT_BRANCH;

// ------- UTF-8 안전 base64 -------
function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
function b64ToUtf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ------- GitHub API -------
function apiBase() {
  return `https://api.github.com/repos/${repoEl.value.trim()}/contents/${CONFIG_PATH}`;
}
function authHeaders() {
  return {
    Authorization: `Bearer ${tokenEl.value.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function loadFile() {
  const branch = branchEl.value.trim() || DEFAULT_BRANCH;
  const res = await fetch(`${apiBase()}?ref=${encodeURIComponent(branch)}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) {
    // 파일이 아직 없으면 빈 구조로 시작
    fileSha = null;
    return {
      $schema: './watches.schema.json',
      defaultEmail: '',
      defaultChatMessage: '안녕하세요. 제가 구매 가능할까요?',
      watches: [],
    };
  }
  if (!res.ok) throw new Error(await errMsg(res));
  const json = await res.json();
  fileSha = json.sha;
  const parsed = JSON.parse(b64ToUtf8(json.content));
  if (!Array.isArray(parsed.watches)) parsed.watches = [];
  return parsed;
}

async function saveFile(message) {
  const branch = branchEl.value.trim() || DEFAULT_BRANCH;
  const body = {
    message,
    content: utf8ToB64(JSON.stringify(data, null, 2) + '\n'),
    branch,
  };
  if (fileSha) body.sha = fileSha;
  const res = await fetch(apiBase(), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errMsg(res));
  const json = await res.json();
  fileSha = json.content.sha; // 다음 저장을 위해 sha 갱신
}

async function errMsg(res) {
  let detail = '';
  try {
    const j = await res.json();
    detail = j.message || '';
  } catch (_) {}
  if (res.status === 401) return '인증 실패(401): 토큰이 올바른지 확인하세요.';
  if (res.status === 403) return '권한 없음(403): 토큰에 Contents 쓰기 권한이 있는지 확인하세요.';
  if (res.status === 404) return '저장소/경로를 찾을 수 없음(404): owner/repo 와 브랜치를 확인하세요.';
  if (res.status === 409) return '충돌(409): 파일이 그 사이 변경되었습니다. 다시 불러온 뒤 저장하세요.';
  return `오류 ${res.status}: ${detail}`;
}

// ------- 렌더링 -------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));
}

function render() {
  $('defaults-card').classList.remove('hidden');
  $('list-card').classList.remove('hidden');
  $('save-card').classList.remove('hidden');

  $('default-email').value = data.defaultEmail || '';
  $('default-msg').value = data.defaultChatMessage || '';
  $('opt-email').checked = data.sendEmail !== false;
  $('opt-issue').checked = data.createIssues !== false;

  const watches = data.watches;
  $('count').textContent = watches.length;
  tbody.innerHTML = '';

  watches.forEach((w, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" data-toggle="${i}" ${w.enabled === false ? '' : 'checked'}></td>
      <td><b>${esc(w.keyword)}</b></td>
      <td>${esc(w.location)}</td>
      <td class="muted-cell">${esc(w.email || '(기본값)')}</td>
      <td class="muted-cell">${esc(w.chatMessage || '(기본값)')}</td>
      <td class="actions">
        <button type="button" class="mini" data-edit="${i}">수정</button>
        <button type="button" class="mini danger" data-del="${i}">삭제</button>
      </td>`;
    tbody.appendChild(tr);
  });

  $('empty-note').classList.toggle('hidden', watches.length > 0);
}

// ------- 이벤트: 연결/불러오기 -------
$('conn-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!tokenEl.value.trim()) return setStatus(connStatus, '토큰을 입력하세요.', 'err');
  localStorage.setItem(LS_TOKEN, tokenEl.value.trim());
  localStorage.setItem(LS_REPO, repoEl.value.trim());
  localStorage.setItem(LS_BRANCH, branchEl.value.trim());
  setStatus(connStatus, '불러오는 중...', '');
  try {
    data = await loadFile();
    render();
    setStatus(connStatus, `✅ 불러오기 완료 (${data.watches.length}개 항목)`, 'ok');
  } catch (err) {
    setStatus(connStatus, '✖ ' + err.message, 'err');
  }
});

$('clear-token-btn').addEventListener('click', () => {
  localStorage.removeItem(LS_TOKEN);
  tokenEl.value = '';
  setStatus(connStatus, '토큰을 이 브라우저에서 삭제했습니다.', 'ok');
});

// ------- 이벤트: 목록 조작(수정/삭제/토글) -------
tbody.addEventListener('click', (e) => {
  const editI = e.target.getAttribute('data-edit');
  const delI = e.target.getAttribute('data-del');
  if (editI !== null && editI !== undefined && e.target.dataset.edit) openEdit(+editI);
  if (delI !== null && delI !== undefined && e.target.dataset.del) {
    const i = +delI;
    if (confirm(`'${data.watches[i].keyword}' 항목을 삭제할까요?`)) {
      data.watches.splice(i, 1);
      render();
    }
  }
});
tbody.addEventListener('change', (e) => {
  const t = e.target.getAttribute('data-toggle');
  if (t !== null) data.watches[+t].enabled = e.target.checked;
});

// ------- 이벤트: 기본값 입력 반영 -------
$('default-email').addEventListener('input', (e) => (data.defaultEmail = e.target.value.trim()));
$('default-msg').addEventListener('input', (e) => (data.defaultChatMessage = e.target.value.trim()));
$('opt-email').addEventListener('change', (e) => (data.sendEmail = e.target.checked));
$('opt-issue').addEventListener('change', (e) => (data.createIssues = e.target.checked));

// ------- 이벤트: 추가/수정 폼 -------
function slugId(keyword, location) {
  const base = `${keyword}-${location}`.toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'watch';
}

function openEdit(index) {
  const isNew = index < 0;
  $('edit-card').classList.remove('hidden');
  $('edit-title').textContent = isNew ? '항목 추가' : '항목 수정';
  $('edit-index').value = index;
  const w = isNew ? {} : data.watches[index];
  $('f-keyword').value = w.keyword || '';
  regionPicker.setValue(w.location || '');
  $('f-email').value = w.email || '';
  $('f-msg').value = w.chatMessage || '';
  $('f-enabled').checked = w.enabled !== false;
  $('edit-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('add-btn').addEventListener('click', () => openEdit(-1));
$('edit-cancel').addEventListener('click', () => $('edit-card').classList.add('hidden'));

$('edit-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const index = +$('edit-index').value;
  const keyword = $('f-keyword').value.trim();
  const location = regionPicker.getValue();
  const entry = {
    id: slugId(keyword, location),
    keyword,
    location,
    email: $('f-email').value.trim() || undefined,
    chatMessage: $('f-msg').value.trim() || undefined,
    enabled: $('f-enabled').checked,
  };
  // undefined 필드 제거
  Object.keys(entry).forEach((k) => entry[k] === undefined && delete entry[k]);

  if (index < 0) data.watches.push(entry);
  else data.watches[index] = entry;

  $('edit-card').classList.add('hidden');
  render();
});

// ------- 이벤트: 저장(커밋) -------
$('save-btn').addEventListener('click', async () => {
  if (!data) return;
  setStatus(saveStatus, '저장 중...', '');
  try {
    await saveFile('chore: 웹 관리자에서 감시 목록 업데이트');
    setStatus(saveStatus, '✅ GitHub에 저장 완료! 다음 실행부터 반영됩니다.', 'ok');
  } catch (err) {
    setStatus(saveStatus, '✖ ' + err.message, 'err');
  }
});

function setStatus(el, msg, kind) {
  el.textContent = msg;
  el.className = 'status' + (kind ? ' ' + kind : '');
}
