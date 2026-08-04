'use strict';

/**
 * 사이트(소스)별 브랜드 테마 정의.
 * 이메일/이슈/채팅 도우미에서 사이트별 색상·이모지·표기·매물 링크 문구를 일치시킨다.
 *
 * 브랜드 색상:
 *   - 당근마켓  : 오렌지 (#ff6f0f)
 *   - 중고나라  : 그린   (#0ba85c)
 *   - 번개장터  : 파랑   (#2563eb)
 *
 * docs/assets/theme.js(브라우저)에도 동일한 맵이 있으니 색상을 바꿀 때 함께 수정할 것.
 */

const SITE_THEME = {
  daangn: {
    key: 'daangn',
    name: '당근마켓',
    emoji: '🥕',
    primary: '#ff6f0f',
    dark: '#e5620a',
    lite: '#ff9a3d',
    soft: '#fff4ec',
    host: 'www.daangn.com',
  },
  joongna: {
    key: 'joongna',
    name: '중고나라',
    emoji: '🟢',
    primary: '#0ba85c',
    dark: '#08834a',
    lite: '#2ed47f',
    soft: '#eafaf1',
    host: 'web.joongna.com',
  },
  bunjang: {
    key: 'bunjang',
    name: '번개장터',
    emoji: '⚡',
    primary: '#2563eb',
    dark: '#1d4ed8',
    lite: '#60a5fa',
    soft: '#eef4ff',
    host: 'www.bunjang.com',
  },
};

// 기본값(사이트 미지정 시): 당근마켓 테마
const DEFAULT_THEME = SITE_THEME.daangn;

// 사이트 키로 테마를 찾는다. 없으면 당근마켓 테마로 폴백.
function themeFor(siteKey) {
  return (siteKey && SITE_THEME[siteKey]) || DEFAULT_THEME;
}

module.exports = { SITE_THEME, DEFAULT_THEME, themeFor };
