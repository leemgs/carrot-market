'use strict';

/* 매물 알림: GitHub 이슈(라벨 당근마켓-알림) 목록을 필터/검색해서 보여준다. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = GHData.escapeHtml;

  let all = [];
  let stateFilter = 'open'; // open | closed | all
  let keyword = '';

  const listEl = $('issue-list');
  const searchEl = $('search');
  const countEl = $('result-count');

  async function load() {
    listEl.innerHTML = '<p class="state-msg"><span class="spinner"></span> 불러오는 중…</p>';
    try {
      all = await GHData.fetchIssues();
      render();
    } catch (e) {
      listEl.innerHTML = `<p class="state-msg">${esc(e.message)}</p>`;
      countEl.textContent = '';
    }
  }

  function render() {
    let rows = all.filter((it) => stateFilter === 'all' || it.state === stateFilter);
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
    listEl.innerHTML = rows.map(card).join('');
  }

  function card(it) {
    const badge =
      it.state === 'open'
        ? '<span class="badge open">열림</span>'
        : '<span class="badge closed">닫힘</span>';
    const cnt = it.count != null ? `<span class="badge count">${it.count}건</span>` : '';
    const kw = it.keyword ? `<b>${esc(it.keyword)}</b>` : esc(it.rawTitle);
    const loc = it.location ? esc(it.location) : '전국';
    return (
      `<a class="issue-item" href="${esc(it.url)}" target="_blank" rel="noopener">` +
      `<div class="issue-top">${badge}${cnt}<span class="issue-title">${kw}</span></div>` +
      `<div class="issue-meta"><span>📍 <b>${loc}</b></span>` +
      `<span>#${it.number}</span>` +
      `<span>🕑 ${GHData.fmtRelative(it.createdAt)}</span>` +
      `<span>${GHData.fmtDate(it.createdAt)}</span></div></a>`
    );
  }

  // 상태 세그먼트 버튼
  document.querySelectorAll('.seg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg button').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      stateFilter = btn.dataset.state;
      render();
    });
  });

  // 검색
  searchEl.addEventListener('input', () => {
    keyword = searchEl.value.trim();
    render();
  });

  $('reload-btn').addEventListener('click', load);

  load();
})();
