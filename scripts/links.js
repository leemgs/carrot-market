'use strict';

/**
 * 이메일/이슈 등에서 공용으로 쓰는 링크 생성 유틸.
 */

// 빠른 채팅 도우미 페이지(GitHub Pages). CHAT_HELPER_URL 로 재정의 가능.
const CHAT_HELPER_URL =
  process.env.CHAT_HELPER_URL || 'https://leemgs.github.io/carrot-market/chat.html';

// 매물별 "채팅 도우미" 링크 생성 (매물 주소 + 인사말 + 제목을 파라미터로 전달)
function chatHelperLink(item, message) {
  const q = new URLSearchParams({
    url: item.url || '',
    msg: message || '',
    title: item.title || '',
  });
  return `${CHAT_HELPER_URL}?${q.toString()}`;
}

module.exports = { chatHelperLink, CHAT_HELPER_URL };
