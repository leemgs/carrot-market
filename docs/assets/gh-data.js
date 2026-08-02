'use strict';

/**
 * 대시보드 / 매물 알림 페이지가 공유하는 데이터 접근 모듈.
 * 공개 저장소이므로 토큰 없이 브라우저에서 직접 읽는다.
 *   - 감시 목록: raw.githubusercontent 의 config/watches.json
 *   - 매물 알림: GitHub Issues API (라벨: 당근마켓-알림)
 */
const GHData = (function () {
  // 저장소를 GitHub Pages URL(owner.github.io/repo)에서 유추 → 레포 이름변경에도 안전.
  const REPO = (function () {
    try {
      const host = location.hostname;
      const seg = location.pathname.split('/').filter(Boolean)[0];
      if (host.endsWith('github.io') && seg) return host.split('.')[0] + '/' + seg;
    } catch (_) {}
    return 'leemgs/used-notifier';
  })();
  const BRANCH = 'main';

  // 사이트(소스)별 이슈 라벨
  const SITES = [
    { key: 'daangn', name: '당근마켓', label: '당근마켓-알림' },
    { key: 'joongna', name: '중고나라', label: '중고나라-알림' },
    { key: 'bunjang', name: '번개장터', label: '번개장터-알림' },
  ];
  const SITE_BY_LABEL = Object.fromEntries(SITES.map((s) => [s.label, s]));
  const SITE_BY_KEY = Object.fromEntries(SITES.map((s) => [s.key, s]));

  const RAW_CONFIG = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/config/watches.json`;

  async function fetchWatches() {
    const res = await fetch(RAW_CONFIG, { cache: 'no-store' });
    if (!res.ok) throw new Error(`watches.json 로드 실패 (HTTP ${res.status})`);
    const cfg = await res.json();
    return {
      watches: Array.isArray(cfg.watches) ? cfg.watches : [],
      config: cfg,
    };
  }

  // 사이트별 라벨로 각각 이슈를 받아 site 태그를 붙여 합친다.
  async function fetchIssues() {
    const results = await Promise.all(SITES.map((s) => fetchIssuesForSite(s)));
    return results.flat();
  }

  async function fetchIssuesForSite(site) {
    const url =
      `https://api.github.com/repos/${REPO}/issues` +
      `?state=all&labels=${encodeURIComponent(site.label)}&per_page=100`;
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('GitHub API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.');
      }
      throw new Error(`이슈 목록 로드 실패 (HTTP ${res.status})`);
    }
    const arr = await res.json();
    return arr.filter((it) => !it.pull_request).map((it) => parseIssue(it, site));
  }

  // 제목 형식: [당근마켓 신규] '키워드' (지역) N건 · YYYY-MM-DD
  function parseIssue(issue, site) {
    const m = (issue.title || '').match(/'([^']*)'\s*\(([^)]*)\)\s*(\d+)\s*건/);
    // site 인자가 없으면 라벨에서 유추
    let resolved = site;
    if (!resolved) {
      const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
      resolved = labels.map((n) => SITE_BY_LABEL[n]).find(Boolean) || SITE_BY_KEY.daangn;
    }
    return {
      number: issue.number,
      rawTitle: issue.title || '',
      url: issue.html_url,
      state: issue.state, // 'open' | 'closed'
      createdAt: issue.created_at,
      site: resolved.key,
      siteName: resolved.name,
      keyword: m ? m[1] : '',
      location: m ? m[2] : '',
      count: m ? parseInt(m[3], 10) : null,
      items: parseItems(issue.body),
    };
  }

  // 이슈 본문(마크다운)에서 매물 항목들을 파싱한다.
  // 형식:  ### 1. 제목 / - 가격: .. / - 지역: .. / - 매물 보기: URL / - 💬 빠른 채팅: URL
  function parseItems(body) {
    if (!body) return [];
    const blocks = String(body).split(/\n###\s+/).slice(1); // 첫 블록(인트로) 제외
    return blocks.map((blk) => {
      const lines = blk.split('\n');
      const item = {
        title: lines[0].replace(/^\d+\.\s*/, '').trim(),
        price: '',
        region: '',
        url: '',
        chat: '',
      };
      let mm;
      for (const ln of lines.slice(1)) {
        if ((mm = ln.match(/^-\s*가격:\s*(.+)$/))) item.price = mm[1].trim();
        else if ((mm = ln.match(/^-\s*지역:\s*(.+)$/))) item.region = mm[1].trim();
        else if ((mm = ln.match(/^-\s*매물\s*보기:\s*(.+)$/))) item.url = mm[1].trim();
        else if ((mm = ln.match(/빠른\s*채팅:\s*(.+)$/))) item.chat = mm[1].trim();
      }
      return item;
    });
  }

  // 이슈 1건을 카드(헤더 + 매물 테이블)로 렌더링. 대시보드/매물알림 페이지 공용.
  function issueCardHtml(it) {
    const badge =
      it.state === 'open'
        ? '<span class="badge open">열림</span>'
        : '<span class="badge closed">닫힘</span>';
    const siteBadge = it.siteName
      ? `<span class="badge site site-${it.site}">${escapeHtml(it.siteName)}</span>`
      : '';
    const cnt = it.count != null ? `<span class="badge count">${it.count}건</span>` : '';
    const kw = it.keyword ? `<b>${escapeHtml(it.keyword)}</b>` : escapeHtml(it.rawTitle);
    const loc = it.location ? escapeHtml(it.location) : '전국';

    let table = '';
    const items = it.items || [];
    if (items.length) {
      const rows = items
        .map((m, i) => {
          const link = m.url
            ? `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener">🔗 보기</a>`
            : '—';
          const chat = m.chat
            ? `<a href="${escapeHtml(m.chat)}" target="_blank" rel="noopener">💬 채팅</a>`
            : '—';
          return (
            `<tr><td>${i + 1}</td><td class="it-title">${escapeHtml(m.title || '(제목 없음)')}</td>` +
            `<td>${escapeHtml(m.price || '-')}</td><td>${escapeHtml(m.region || '-')}</td>` +
            `<td>${link}</td><td>${chat}</td></tr>`
          );
        })
        .join('');
      table =
        '<div class="table-scroll"><table class="item-table"><thead><tr>' +
        '<th>#</th><th>제목</th><th>가격</th><th>지역</th><th>매물</th><th>빠른채팅</th>' +
        '</tr></thead><tbody>' +
        rows +
        '</tbody></table></div>';
    }

    return (
      '<div class="issue-item static">' +
      `<div class="issue-top">${siteBadge}${badge}${cnt}<span class="issue-title">${kw} · ${loc}</span></div>` +
      `<div class="issue-meta"><span>#${it.number}</span>` +
      `<span>🕑 ${fmtRelative(it.createdAt)}</span>` +
      `<span>${fmtDate(it.createdAt)}</span>` +
      `<a href="${escapeHtml(it.url)}" target="_blank" rel="noopener" class="issue-link">GitHub 이슈 ↗</a>` +
      '</div>' +
      table +
      '</div>'
    );
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function fmtRelative(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return '방금 전';
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}일 전`;
    return fmtDate(iso).slice(0, 10);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  return {
    REPO, SITES, SITE_BY_KEY,
    fetchWatches, fetchIssues, issueCardHtml, fmtDate, fmtRelative, escapeHtml,
  };
})();
