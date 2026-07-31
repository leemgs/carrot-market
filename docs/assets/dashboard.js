'use strict';

/* 대시보드: 감시 목록 + 매물 알림 이슈를 요약해서 보여준다. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = GHData.escapeHtml;

  async function load() {
    // 감시 목록과 이슈를 병렬로 로드 (한쪽 실패해도 나머지는 표시)
    const [watchesRes, issuesRes] = await Promise.allSettled([
      GHData.fetchWatches(),
      GHData.fetchIssues(),
    ]);

    renderWatches(watchesRes);
    renderIssues(issuesRes, watchesRes);
  }

  function renderWatches(res) {
    const chipsEl = $('kw-chips');
    if (res.status !== 'fulfilled') {
      $('stat-watch').textContent = '—';
      $('stat-watch-sub').textContent = '감시 목록을 불러오지 못했습니다';
      chipsEl.innerHTML = `<p class="state-msg">${esc(res.reason.message || '로드 실패')}</p>`;
      return;
    }
    const watches = res.value.watches;
    const enabled = watches.filter((w) => w.enabled !== false);
    $('stat-watch').textContent = watches.length;
    $('stat-watch-sub').textContent = `활성 ${enabled.length} · 중지 ${watches.length - enabled.length}`;

    if (!watches.length) {
      chipsEl.innerHTML =
        '<p class="state-msg">등록된 감시 항목이 없습니다. ' +
        '<a href="./admin.html">감시 목록 관리</a>에서 추가하세요.</p>';
      return;
    }
    chipsEl.innerHTML = watches
      .map((w) => {
        const off = w.enabled === false;
        const loc = w.location ? ` · ${esc(w.location)}` : ' · 전국';
        return `<span class="chip${off ? ' off' : ''}"><span class="dot"></span>${esc(w.keyword)}<span style="opacity:.7">${loc}</span></span>`;
      })
      .join('');
  }

  function renderIssues(res, watchesRes) {
    const listEl = $('recent-list');
    if (res.status !== 'fulfilled') {
      $('stat-open').textContent = '—';
      $('stat-total').textContent = '—';
      $('stat-items').textContent = '—';
      listEl.innerHTML = `<p class="state-msg">${esc(res.reason.message || '이슈 로드 실패')}</p>`;
      return;
    }
    const issues = res.value;
    const open = issues.filter((i) => i.state === 'open');
    const totalItems = issues.reduce((s, i) => s + (i.count || 0), 0);

    $('stat-open').textContent = open.length;
    $('stat-open-sub').textContent = open.length ? '확인이 필요합니다' : '모두 확인됨 🎉';
    $('stat-total').textContent = issues.length;
    $('stat-items').textContent = totalItems;

    // 최근 알림 시각
    if (issues.length) {
      const latest = issues.reduce((a, b) =>
        new Date(a.createdAt) > new Date(b.createdAt) ? a : b
      );
      $('stat-last').textContent = GHData.fmtRelative(latest.createdAt);
      $('stat-last-sub').textContent = GHData.fmtDate(latest.createdAt);
    } else {
      $('stat-last').textContent = '—';
      $('stat-last-sub').textContent = '아직 알림이 없습니다';
    }

    // 최근 알림 5건
    const recent = issues
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    if (!recent.length) {
      listEl.innerHTML =
        '<p class="state-msg">아직 매물 알림이 없습니다. 신규 매물이 발견되면 여기에 표시됩니다.</p>';
      return;
    }
    listEl.innerHTML = recent.map(issueCard).join('');
  }

  function issueCard(it) {
    const badge =
      it.state === 'open'
        ? '<span class="badge open">열림</span>'
        : '<span class="badge closed">닫힘</span>';
    const cnt = it.count != null ? `<span class="badge count">${it.count}건</span>` : '';
    const kw = it.keyword ? `<b>${esc(it.keyword)}</b>` : esc(it.rawTitle);
    const loc = it.location ? ` · ${esc(it.location)}` : '';
    return (
      `<a class="issue-item" href="${esc(it.url)}" target="_blank" rel="noopener">` +
      `<div class="issue-top">${badge}${cnt}<span class="issue-title">${kw}${loc}</span></div>` +
      `<div class="issue-meta"><span>#${it.number}</span>` +
      `<span>${GHData.fmtRelative(it.createdAt)}</span>` +
      `<span>${GHData.fmtDate(it.createdAt)}</span></div></a>`
    );
  }

  load();
})();
