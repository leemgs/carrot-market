'use strict';

/**
 * 이메일/이슈 등에서 공용으로 쓰는 링크 생성 유틸.
 */

// 빠른 채팅 도우미 페이지(GitHub Pages). CHAT_HELPER_URL 로 재정의 가능하며,
// 없으면 GITHUB_REPOSITORY(owner/repo)에서 Pages 주소를 유추한다(레포 이름변경에도 안전).
function defaultChatHelperUrl() {
  const full = process.env.GITHUB_REPOSITORY || '';
  const [owner, repo] = full.split('/');
  if (owner && repo) return `https://${owner}.github.io/${repo}/chat.html`;
  return 'https://leemgs.github.io/used-notifier/chat.html';
}
const CHAT_HELPER_URL = process.env.CHAT_HELPER_URL || defaultChatHelperUrl();

// 매물별 "채팅 도우미" 링크 생성 (매물 주소 + 인사말 + 제목 + 사이트키를 파라미터로 전달)
// siteKey(daangn/joongna/bunjang)를 넘기면 채팅 도우미 페이지가 해당 사이트 테마/문구로 표시된다.
function chatHelperLink(item, message, siteKey) {
  const params = {
    url: item.url || '',
    msg: message || '',
    title: item.title || '',
  };
  if (siteKey) params.site = siteKey;
  const q = new URLSearchParams(params);
  return `${CHAT_HELPER_URL}?${q.toString()}`;
}

module.exports = { chatHelperLink, CHAT_HELPER_URL };
