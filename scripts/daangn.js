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

  // --- 2) 매물 링크 기반 폴백 파싱 ---
  // /kr/buy-sell/....-<id>/ 또는 /articles/<id> 형태의 링크를 찾는다.
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

  return Array.from(byId.values());
}

/* ------------------------- 필터링 ------------------------- */

/**
 * 매물이 (제목에 키워드 포함) AND (지역에 location 포함) 조건을 만족하는지.
 * region 정보가 비어있는 경우엔 지역 조건을 통과시키지 않는다(오탐 방지),
 * 단 STRICT_REGION=false 이면 통과시킨다.
 */
function matchesWatch(item, watch) {
  const kw = normalize(watch.keyword);
  const loc = normalize(watch.location);

  const titleOk = kw ? normalize(item.title).includes(kw) : true;

  let regionOk = true;
  if (loc) {
    const hay = normalize(`${item.region} ${item.title}`);
    if (hay.includes(loc)) {
      regionOk = true;
    } else if (!item.region && process.env.STRICT_REGION === 'false') {
      regionOk = true; // 지역 정보가 없을 때 관대하게 처리(옵션)
    } else {
      regionOk = false;
    }
  }

  return titleOk && regionOk;
}

/**
 * 검색 + 파싱 + 필터를 한 번에 수행.
 * @param {{keyword:string,location:string}} watch
 * @returns {Promise<Array>} 조건을 만족하는 매물 목록
 */
async function searchDaangn(watch) {
  const html = await fetchSearchHtml(watch.keyword);
  const items = parseItems(html);
  return items.filter((it) => matchesWatch(it, watch));
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
