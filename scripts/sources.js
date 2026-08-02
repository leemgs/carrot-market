'use strict';

/**
 * 매물 소스(사이트) 레지스트리.
 * 각 소스는 search(watch) -> 정규화된 매물 배열(Promise) 을 제공한다.
 * 새 사이트를 추가하려면 여기에 항목만 등록하면 된다.
 */

const { searchDaangn } = require('./daangn');
const { searchJoongna } = require('./joongna');
const { searchBunjang } = require('./bunjang');

const SOURCES = {
  daangn: {
    key: 'daangn',
    name: '당근마켓',
    issueLabel: '당근마켓-알림',
    search: searchDaangn,
  },
  joongna: {
    key: 'joongna',
    name: '중고나라',
    issueLabel: '중고나라-알림',
    search: searchJoongna,
  },
  bunjang: {
    key: 'bunjang',
    name: '번개장터',
    issueLabel: '번개장터-알림',
    search: searchBunjang,
  },
};

// 감시 항목이 sites 를 지정하지 않으면 모든 사이트에서 검색 (당근 + 중고나라 + 번개장터)
const DEFAULT_SITES = ['daangn', 'joongna', 'bunjang'];

// watch.sites 를 유효한 사이트 키 배열로 정규화
function watchSites(watch) {
  const raw = Array.isArray(watch && watch.sites) ? watch.sites : [];
  const valid = raw.filter((k) => SOURCES[k]);
  return valid.length ? valid : DEFAULT_SITES.slice();
}

module.exports = { SOURCES, DEFAULT_SITES, watchSites };
