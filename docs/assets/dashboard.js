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
    const siteNames = Object.fromEntries((GHData.SITES || []).map((s) => [s.key, s.name]));
    chipsEl.innerHTML = watches
      .map((w) => {
        const off = w.enabled === false;
        const loc = w.location ? ` · ${esc(w.location)}` : ' · 전국';
        const sites = Array.isArray(w.sites) && w.sites.length ? w.sites : ['daangn', 'joongna', 'bunjang'];
        const siteTag = ' · ' + sites.map((k) => esc(siteNames[k] || k)).join('+');
        const price = Number(w.maxPrice) > 0 ? ` · ≤${Number(w.maxPrice).toLocaleString('ko-KR')}원` : '';
        return `<span class="chip${off ? ' off' : ''}"><span class="dot"></span>${esc(w.keyword)}<span style="opacity:.7">${loc}${siteTag}${price}</span></span>`;
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

    // 키워드별로 "가장 최근" 알림 1건만 남긴다 (같은 키워드 중복 제거).
    const sorted = issues
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const seenKw = new Set();
    const recent = [];
    for (const it of sorted) {
      // 사이트 + 키워드 조합으로 최신 1건만 (당근/중고나라를 각각 표시)
      const key = `${it.site}::${it.keyword || it.rawTitle}`;
      if (seenKw.has(key)) continue;
      seenKw.add(key);
      recent.push(it);
    }

    if (!recent.length) {
      listEl.innerHTML =
        '<p class="state-msg">아직 매물 알림이 없습니다. 신규 매물이 발견되면 여기에 표시됩니다.</p>';
      return;
    }
    listEl.innerHTML = recent.map(GHData.issueCardHtml).join('');
  }

  load();
})();
