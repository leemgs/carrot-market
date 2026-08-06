'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatPrice } = require('../price');
const { matchesWatch } = require('../daangn');
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
