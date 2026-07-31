'use strict';

/**
 * 당근마켓(중고거래) 검색 및 파싱 모듈.
 *
 * 당근마켓 웹 검색 페이지를 가져와서 매물 목록을 구조화된 객체 배열로 변환한다.
 * 당근마켓은 SSR(Next.js 계열) 페이지이므로 다음 순서로 데이터를 추출한다.
 *   1) JSON-LD (<script type="application/ld+json">) 의 ItemList / Product
 *   2) __NEXT_DATA__ 등 페이지에 임베드된 JSON
 *   3) 위 방법이 실패하면 매물 링크(<a href>) 기반 정규식 파싱 (폴백)
 *
 * 마크업이 바뀌면 parseItems() 내부의 추출기만 손보면 된다.
 */

// 시/도 → 시/군/구 → 읍/면/동 데이터 (시 단위 입력을 동 목록으로 확장해 매칭)
let REGIONS = {};
try {
  REGIONS = require('./regions-data');
} catch (_) {
  /* 데이터 파일이 없어도 기본 매칭은 동작 */
}

// 검색 URL 템플릿. {kw} 는 URL 인코딩된 키워드로 치환된다.
// 환경변수 DAANGN_SEARCH_URL 로 재정의 가능.
const DEFAULT_SEARCH_URL = 'https://www.daangn.com/kr/buy-sell/?search={kw}';

// 매물 상세 페이지의 기본 도메인 (상대경로 -> 절대경로 변환용)
const BASE_URL = 'https://www.daangn.com';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * 검색어로 당근마켓 검색 결과 HTML 을 가져온다.
 * @param {string} keyword
 * @returns {Promise<string>} HTML 문자열
 */
async function fetchSearchHtml(keyword) {
  const template = process.env.DAANGN_SEARCH_URL || DEFAULT_SEARCH_URL;
  const url = template.replace('{kw}', encodeURIComponent(keyword));

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`당근마켓 검색 요청 실패: HTTP ${res.status} (${url})`);
  }
  return res.text();
}

/**
 * 문자열을 비교용으로 정규화 (공백 제거 + 소문자).
 */
function normalize(s) {
  return String(s || '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/**
 * HTML 에서 매물 항목들을 추출한다.
 * @param {string} html
 * @returns {Array<{id:string,title:string,price:string,region:string,url:string,image:string}>}
 */
function parseItems(html) {
  const byId = new Map();

  const add = (item) => {
    if (!item || !item.id) return;
    const id = String(item.id);
    const existing = byId.get(id) || {};
    byId.set(id, {
      id,
      title: item.title || existing.title || '',
      price: item.price || existing.price || '',
      region: item.region || existing.region || '',
      url: item.url || existing.url || `${BASE_URL}/kr/buy-sell/${id}/`,
      image: item.image || existing.image || '',
    });
  };

  // --- 1) JSON-LD ---
  for (const block of extractJsonLd(html)) {
    for (const node of flattenJsonLd(block)) {
      if (!node || typeof node !== 'object') continue;
      const type = node['@type'];
      if (type === 'Product' || type === 'ListItem' || node.url || node.name) {
        const target = node.item && typeof node.item === 'object' ? node.item : node;
        const url = target.url || node.url;
        const id = extractIdFromUrl(url);
        if (!id && !target.name) continue;
        add({
          id: id || slugId(target.name),
          title: target.name,
          price: extractPrice(target),
          region: target.address || target.areaServed || '',
          url: absolutize(url),
          image: firstImage(target.image),
        });
      }
    }
  }

  // --- 2) <a> 태그 기반 매물 카드 파싱 ---
  const linkRe =
    /<a[^>]+href="((?:https?:\/\/[^"]+)?\/(?:kr\/buy-sell|articles)\/[^"]*?)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1];
    const inner = m[2];
    const id = extractIdFromUrl(href);
    if (!id) continue;
    const text = stripTags(inner);
    add({
      id,
      title: pickTitle(inner) || text,
      price: pickPrice(inner),
      region: pickRegion(inner),
      url: absolutize(href),
      image: pickImage(inner),
    });
  }

  // --- 3) 임베드 JSON / RSC 스트림 파싱 ---
  // 최신 당근 웹은 Next.js RSC 스트림(self.__next_f.push[...])에 매물 데이터를
  // 이스케이프된 문자열로 담는다. 원본과 언이스케이프본 양쪽에서 매물 URL과
  // 주변 필드(title/price/region)를 추출한다.
  extractFromText(html, add);
  extractFromText(deEscape(html), add);

  return Array.from(byId.values());
}

// 이스케이프된 JSON 문자열( /, \" 등 )을 실제 문자로 복원
function deEscape(s) {
  return String(s)
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"');
}

// 특정 키들 중 먼저 매칭되는 문자열 값을 반환
function matchField(win, keys) {
  for (const k of keys) {
    const mm = win.match(new RegExp('"' + k + '"\\s*:\\s*"([^"]{1,120})"', 'i'));
    if (mm) return mm[1];
  }
  return '';
}

// 카드 본문 텍스트에서 동네(…동/읍/면/가) 토큰을 추출. 태그/JSON 경계를 넘지 않도록
// 링크 직후 구간에서 뒤에 한글이 붙지 않는 첫 지역 토큰을 찾는다.
function extractNeighborhood(s) {
  const m = String(s).match(/([가-힣]{2,}[0-9]{0,2}(?:동|읍|면|가))(?![가-힣])/);
  return m ? m[1] : '';
}

// 텍스트(HTML/JSON)에서 매물 URL 을 찾아 주변 창(window)에서 필드를 추출
function extractFromText(text, add) {
  // 슬러그 전체를 탐욕적으로 잡아 마지막 하이픈 세그먼트(진짜 id)까지 포함시킨다.
  const urlRe =
    /(?:https?:\/\/www\.daangn\.com)?\/(?:kr\/buy-sell\/[^"'\\\s)]*-[0-9a-zA-Z]{5,}|articles\/\d+)\/?/g;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    const href = m[0];
    const id = extractIdFromUrl(href);
    if (!id) continue;
    const start = Math.max(0, m.index - 500);
    const end = Math.min(text.length, m.index + 500);
    const win = text.slice(start, end);
    const price =
      matchField(win, ['price']) || (win.match(/([0-9][0-9,]{2,})\s*원/) || [])[1] || '';
    // 지역: JSON 필드 우선, 없으면 링크 뒤쪽(카드 본문)에서 동네(…동/읍/면/가) 추출
    let region = matchField(win, ['regionName', 'region', 'address', 'areaName', 'location']);
    if (!region) region = extractNeighborhood(text.slice(m.index, m.index + 900));
    add({
      id,
      title: matchField(win, ['title', 'name', 'subject']),
      price,
      region,
      url: absolutize(href),
      image: '',
    });
  }
}

/* ------------------------- 필터링 ------------------------- */

/**
 * 지역 미입력(또는 '전국'/'전체')이면 전국 검색으로 간주.
 */
function isNationwide(location) {
  const loc = normalize(location);
  return !loc || loc === '전국' || loc === '전체' || loc === 'all';
}

/**
 * 지역 문자열의 매칭 후보들을 만든다.
 * 당근은 매물 위치를 '수원시 영통구' 처럼 전체로 주기도, '영통동' 처럼 동만 주기도 한다.
 * 그래서 입력값과 행정구역 접미사를 뗀 어간(수원시 -> 수원)을 모두 후보로 사용한다.
 */
function locationVariants(location) {
  const loc = normalize(location);
  if (!loc) return [];
  const variants = new Set([loc]);

  const addStem = (s) => {
    const stem = s.replace(
      /(특별자치시|특별자치도|특별시|광역시|시|군|구|읍|면|동|리)$/,
      ''
    );
    if (stem && stem.length >= 2 && stem !== s) variants.add(stem);
  };
  addStem(loc);

  // 연결된 행정구역명 분해 (수원시영통구 -> 수원시, 영통구 / 각 어간도 추가)
  const chunks = loc.match(
    /[가-힣]+?(?:특별자치시|특별자치도|특별시|광역시|시|군|구|읍|면|동|리)/g
  );
  if (chunks && chunks.length > 1) {
    for (const c of chunks) {
      if (c.length >= 2) variants.add(c);
      addStem(c);
    }
  }
  return [...variants];
}

// 시/도·시/군/구 입력을 그 안의 읍/면/동 이름 집합으로 확장 (당근은 동 이름으로 표기)
const _dongCache = new Map();
function dongsForLocation(location) {
  const n = normalize(location);
  if (!n) return _EMPTY_SET;
  if (_dongCache.has(n)) return _dongCache.get(n);
  const set = new Set();
  for (const sido of Object.keys(REGIONS)) {
    const nsido = normalize(sido);
    for (const sgg of Object.keys(REGIONS[sido])) {
      const nsgg = normalize(sgg);
      const hit = n === nsido || n === nsgg || nsgg.startsWith(n) || n.startsWith(nsgg);
      if (hit) for (const d of REGIONS[sido][sgg]) set.add(normalize(d));
    }
  }
  _dongCache.set(n, set);
  return set;
}
const _EMPTY_SET = new Set();

/**
 * 매물이 (제목에 키워드 포함) AND (지역 일치) 조건을 만족하는지.
 * - 지역 미입력 = 전국(지역 조건 없음)
 * - 지역 입력 시: 매물 지역/제목에 지역명(또는 어간)이 포함되면 통과
 * - 매물에 지역 정보가 아예 없을 땐 기본 제외(STRICT_REGION=false 면 통과)
 */
function keywordMatches(title, keyword) {
  const t = normalize(title);
  // 다중 단어 키워드는 순서와 무관하게 모든 토큰이 제목에 있으면 매칭
  const tokens = String(keyword || '')
    .trim()
    .split(/\s+/)
    .map(normalize)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((tok) => t.includes(tok));
}

function matchesWatch(item, watch) {
  if (!keywordMatches(item.title, watch.keyword)) return false;

  if (isNationwide(watch.location)) return true; // 지역 미입력 → 전국

  const hay = normalize(`${item.region} ${item.title}`);
  const variants = locationVariants(watch.location);
  if (variants.some((v) => hay.includes(v))) return true;

  // 시/구 단위 입력 → 그 안의 동 이름이 매물 지역/제목에 있으면 매칭
  for (const d of dongsForLocation(watch.location)) {
    if (d.length >= 2 && hay.includes(d)) return true;
  }

  if (!item.region && process.env.STRICT_REGION === 'false') return true;
  return false;
}

/**
 * 검색 + 파싱 + 필터를 한 번에 수행.
 * @param {{keyword:string,location:string}} watch
 * @returns {Promise<Array>} 조건을 만족하는 매물 목록
 */
async function searchDaangn(watch) {
  const html = await fetchSearchHtml(watch.keyword);
  const items = parseItems(html);
  const matched = items.filter((it) => matchesWatch(it, watch));

  if (process.env.DEBUG === 'true') {
    console.log(
      `    [DEBUG] HTML ${html.length}자, 파싱된 매물 ${items.length}건, 매칭 ${matched.length}건` +
        (isNationwide(watch.location) ? ' (전국 검색)' : '')
    );
    // 매물 링크가 페이지에 몇 번 등장하는지(파서와 무관한 원자료 신호)
    const rawLinks = (html.match(/\/kr\/buy-sell\//g) || []).length;
    const hasNextData = html.includes('__NEXT_DATA__') || html.includes('__next_f');
    console.log(
      `    [DEBUG] buy-sell 링크 흔적 ${rawLinks}회, RSC/NEXT ${hasNextData ? '있음' : '없음'}`
    );
    if (items.length === 0) {
      // 파싱 0건이면 페이지 앞부분을 덤프해 차단/리다이렉트/JS쉘 여부 확인
      const snippet = html.replace(/\s+/g, ' ').slice(0, 400);
      console.log(`    [DEBUG] HTML 앞부분: ${snippet}`);
    }
    items.slice(0, 5).forEach((it) =>
      console.log(`    [DEBUG] · ${it.title || '(제목없음)'} | ${it.region || '-'} | ${it.url}`)
    );
  }
  return matched;
}

/* ------------------------- 헬퍼 ------------------------- */

function extractJsonLd(html) {
  const out = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch (_) {
      /* 무시 */
    }
  }
  return out;
}

function flattenJsonLd(node, acc = []) {
  if (Array.isArray(node)) {
    node.forEach((n) => flattenJsonLd(n, acc));
  } else if (node && typeof node === 'object') {
    acc.push(node);
    if (Array.isArray(node.itemListElement)) {
      flattenJsonLd(node.itemListElement, acc);
    }
    if (Array.isArray(node['@graph'])) {
      flattenJsonLd(node['@graph'], acc);
    }
  }
  return acc;
}

function extractIdFromUrl(url) {
  if (!url) return '';
  // 예: /kr/buy-sell/멋진-가마솥-abcdef123456/  또는 /articles/123456789
  const mBuySell = String(url).match(/\/kr\/buy-sell\/[^/?#]*?-([0-9a-zA-Z]+)\/?(?:[?#]|$)/);
  if (mBuySell) return mBuySell[1];
  const mArticle = String(url).match(/\/articles\/(\d+)/);
  if (mArticle) return mArticle[1];
  const mGeneric = String(url).match(/\/([0-9a-zA-Z]{6,})\/?(?:[?#]|$)/);
  if (mGeneric) return mGeneric[1];
  return '';
}

function extractPrice(node) {
  if (node.offers) {
    const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    if (offer && (offer.price || offer.price === 0)) {
      return `${offer.price}${offer.priceCurrency ? ' ' + offer.priceCurrency : ''}`;
    }
  }
  return node.price || '';
}

function firstImage(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return firstImage(image[0]);
  if (typeof image === 'object') return image.url || image.contentUrl || '';
  return '';
}

function slugId(name) {
  return normalize(name).slice(0, 40);
}

function absolutize(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return BASE_URL + (url.startsWith('/') ? url : '/' + url);
}

function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 폴백 파서에서 매물 카드 내부 텍스트로부터 제목/가격/지역/이미지 추정
function pickTitle(inner) {
  const m =
    inner.match(/class="[^"]*(?:title|name)[^"]*"[^>]*>([\s\S]*?)</i) ||
    inner.match(/<(?:h\d|strong|span)[^>]*>([\s\S]*?)<\//i);
  return m ? stripTags(m[1]) : '';
}
function pickPrice(inner) {
  const m =
    inner.match(/class="[^"]*price[^"]*"[^>]*>([\s\S]*?)</i) ||
    inner.match(/([0-9][0-9,]{2,})\s*원/);
  return m ? stripTags(m[1]) : '';
}
function pickRegion(inner) {
  const m = inner.match(/class="[^"]*(?:region|location|area)[^"]*"[^>]*>([\s\S]*?)</i);
  return m ? stripTags(m[1]) : '';
}
function pickImage(inner) {
  const m = inner.match(/<img[^>]+src="([^"]+)"/i);
  return m ? m[1] : '';
}

module.exports = {
  fetchSearchHtml,
  parseItems,
  matchesWatch,
  searchDaangn,
  normalize,
};
