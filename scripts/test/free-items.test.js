'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatPrice } = require('../price');
const { matchesWatch, parseItems: parseDaangn } = require('../daangn');
const { parseItems: parseJoongna } = require('../joongna');
const { parseItems: parseBunjang } = require('../bunjang');

test('0원 감시는 무료 매물만 매칭한다', () => {
  const watch = { keyword: '의자', location: '', maxPrice: 0 };

  assert.equal(matchesWatch({ title: '의자 나눔', priceValue: 0 }, watch), true);
  assert.equal(matchesWatch({ title: '의자 판매', priceValue: 1 }, watch), false);
  assert.equal(matchesWatch({ title: '의자 가격제안', priceValue: null }, watch), false);
});

test('maxPrice 미지정은 기존처럼 가격 제한을 적용하지 않는다', () => {
  assert.equal(
    matchesWatch({ title: '의자 판매', priceValue: 100000 }, { keyword: '의자', location: '' }),
    true
  );
});

test('사이트별 0원 표시를 유지한다', () => {
  assert.equal(formatPrice(0), '나눔');
  assert.equal(formatPrice(0, '0원'), '0원');

  const joongnaHtml = `<script type="application/json">${JSON.stringify({
    id: 10101,
    title: '의자',
    price: 0,
  })}</script>`;
  assert.equal(parseJoongna(joongnaHtml)[0].price, '0원');
  assert.equal(parseJoongna(joongnaHtml)[0].priceValue, 0);

  const bunjang = parseBunjang({ list: [{ pid: 20202, name: '의자', price: 0 }] });
  assert.equal(bunjang[0].price, '0원');
  assert.equal(bunjang[0].priceValue, 0);
});

test('당근 카드의 나눔 문구와 숫자 0 가격을 무료 매물로 파싱한다', () => {
  const cardHtml = `
    <a href="/kr/buy-sell/벽돌-나눔-abc123/">
      <span class="title">벽돌</span>
      <span class="price">나눔</span>
      <span class="region">권선동</span>
    </a>`;
  const card = parseDaangn(cardHtml)[0];
  assert.equal(card.price, '나눔');
  assert.equal(card.priceValue, 0);
  assert.equal(matchesWatch(card, { keyword: '벽돌', location: '', maxPrice: 0 }), true);

  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    '@type': 'Product',
    name: '무료 벽돌',
    url: '/kr/buy-sell/무료-벽돌-def456/',
    price: 0,
  })}</script>`;
  const numeric = parseDaangn(jsonLd).find((item) => item.id === 'def456');
  assert.ok(numeric);
  assert.equal(numeric.price, '나눔');
  assert.equal(numeric.priceValue, 0);
});

test('무료 모드의 나눔 키워드는 제품명과 무관하게 무료 품목만 허용한다', () => {
  const watch = { keyword: '나눔', location: '', maxPrice: 0 };
  assert.equal(matchesWatch({ title: '벽돌', priceValue: 0 }, watch), true);
  assert.equal(matchesWatch({ title: '벽돌', priceValue: 10000 }, watch), false);
});
