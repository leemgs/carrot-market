'use strict';

/**
 * 대시보드 / 매물 알림 페이지가 공유하는 데이터 접근 모듈.
 * 공개 저장소이므로 토큰 없이 브라우저에서 직접 읽는다.
 *   - 감시 목록: raw.githubusercontent 의 config/watches.json
 *   - 매물 알림: GitHub Issues API (라벨: 당근마켓-알림)
 */
const GHData = (function () {
  const REPO = 'leemgs/carrot-market';
  const BRANCH = 'main';
  const LABEL = '당근마켓-알림';

  const RAW_CONFIG = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/config/watches.json`;
  const ISSUES_API =
    `https://api.github.com/repos/${REPO}/issues` +
    `?state=all&labels=${encodeURIComponent(LABEL)}&per_page=100`;

  async function fetchWatches() {
    const res = await fetch(RAW_CONFIG, { cache: 'no-store' });
    if (!res.ok) throw new Error(`watches.json 로드 실패 (HTTP ${res.status})`);
    const cfg = await res.json();
    return {
      watches: Array.isArray(cfg.watches) ? cfg.watches : [],
      config: cfg,
    };
  }

  async function fetchIssues() {
    const res = await fetch(ISSUES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('GitHub API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.');
      }
      throw new Error(`이슈 목록 로드 실패 (HTTP ${res.status})`);
    }
    const arr = await res.json();
    // 풀리퀘스트는 제외하고 이슈만 파싱
    return arr.filter((it) => !it.pull_request).map(parseIssue);
  }

  // 제목 형식: [당근마켓 신규] '키워드' (지역) N건 · YYYY-MM-DD
  function parseIssue(issue) {
    const m = (issue.title || '').match(/'([^']*)'\s*\(([^)]*)\)\s*(\d+)\s*건/);
    return {
      number: issue.number,
      rawTitle: issue.title || '',
      url: issue.html_url,
      state: issue.state, // 'open' | 'closed'
      createdAt: issue.created_at,
      keyword: m ? m[1] : '',
      location: m ? m[2] : '',
      count: m ? parseInt(m[3], 10) : null,
    };
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

  return { REPO, LABEL, fetchWatches, fetchIssues, fmtDate, fmtRelative, escapeHtml };
})();
