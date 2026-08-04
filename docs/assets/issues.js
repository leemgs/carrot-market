'use strict';

/* 매물 알림: GitHub 이슈(라벨 당근마켓-알림) 목록을 필터/검색해서 보여준다. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = GHData.escapeHtml;

  let all = [];
  let stateFilter = 'open'; // open | closed | all
  let siteFilter = new URLSearchParams(location.search).get('site') || 'all'; // daangn | joongna | all
  let keyword = '';

  const listEl = $('issue-list');
  const searchEl = $('search');
  const countEl = $('result-count');
  const titleEl = $('page-title');

  // 사이트에 맞춰 제목 갱신
  function siteName(key) {
    const s = (GHData.SITES || []).find((x) => x.key === key);
    return s ? s.name : '전체';
  }
  const SITE_EMOJI = { daangn: '🥕', joongna: '🟢', bunjang: '⚡' };
  if (titleEl) {
    titleEl.textContent =
      siteFilter === 'all' ? '🔔 매물 알림' : `${SITE_EMOJI[siteFilter] || '🔔'} ${siteName(siteFilter)} 알림`;
  }

  async function load(force) {
    listEl.innerHTML = '<p class="state-msg"><span class="spinner"></span> 불러오는 중…</p>';
    try {
      all = await GHData.fetchIssues(force);
      render();
    } catch (e) {
      listEl.innerHTML = `<p class="state-msg">${esc(e.message)}</p>`;
      countEl.textContent = '';
    }
  }

  function render() {
    let rows = all.filter(
      (it) =>
        (stateFilter === 'all' || it.state === stateFilter) &&
        (siteFilter === 'all' || it.site === siteFilter)
    );
    if (keyword) {
      const q = keyword.toLowerCase();
      rows = rows.filter(
        (it) =>
          it.keyword.toLowerCase().includes(q) ||
          it.location.toLowerCase().includes(q) ||
          it.rawTitle.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    countEl.textContent = `${rows.length}건`;

    if (!rows.length) {
      listEl.innerHTML =
        '<p class="state-msg">조건에 맞는 알림이 없습니다.</p>';
      return;
    }
    listEl.innerHTML = rows.map(GHData.issueCardHtml).join('');
  }

  // 상태 세그먼트 버튼
  document.querySelectorAll('.seg-state button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-state button').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      stateFilter = btn.dataset.state;
      render();
    });
  });

  // 사이트 세그먼트 버튼 (초기 선택은 ?site 값에 맞춤)
  document.querySelectorAll('.seg-site button').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.site === siteFilter);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-site button').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      siteFilter = btn.dataset.site;
      render();
    });
  });

  // 검색
  searchEl.addEventListener('input', () => {
    keyword = searchEl.value.trim();
    render();
  });

  $('reload-btn').addEventListener('click', () => load(true));

  load();
})();
