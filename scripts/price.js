'use strict';

/**
 * 가격 문자열 정규화 유틸 (당근/중고나라 등 모든 소스 공용).
 */

// 가격 값을 "16,000원" 형태로 정규화한다.
//  - "16000.0", "16000.0 KRW", "16,000원" → "16,000원"
//  - 0 → "나눔"
//  - "나눔", "가격 제안" 등 숫자가 아닌 표기는 소수 꼬리만 정리해 그대로 둔다.
function formatPrice(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  if (!s) return '';
  s = s.replace(/\bKRW\b/gi, '').replace(/\s+/g, ' ').trim();
  // 숫자(콤마/소수점 허용) + 선택적 "원" 만으로 이루어진 경우
  if (/^[\d,]+(?:\.\d+)?\s*원?$/.test(s)) {
    const n = Math.round(parseFloat(s.replace(/[,원\s]/g, '')));
    if (!Number.isFinite(n)) return s;
    if (n === 0) return '나눔';
    return n.toLocaleString('ko-KR') + '원';
  }
  // 텍스트가 섞인 경우: "16000.0" 같은 소수 꼬리만 정리
  return s.replace(/(\d)\.0+(?!\d)/g, '$1');
}

// 가격 문자열에서 숫자(원)만 추출한다. 나눔/무료 → 0, 가격 불명 → null.
function parsePriceValue(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/\bKRW\b/gi, '').trim();
  if (!s) return null;
  if (/나눔|무료/.test(s)) return 0;
  const m = s.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!m) return null; // "가격 제안" 등 숫자가 없는 경우
  return Math.round(parseFloat(m[0]));
}

module.exports = { formatPrice, parsePriceValue };
