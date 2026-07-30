'use strict';

/**
 * Google(Gmail) SMTP 를 이용한 이메일 발송 모듈.
 *
 * 필요한 환경변수 (GitHub Actions Secrets 로 주입):
 *   GMAIL_USER          발신 Gmail 주소 (예: myname@gmail.com)
 *   GMAIL_APP_PASSWORD  Gmail 앱 비밀번호 (2단계 인증 후 발급한 16자리)
 *   MAIL_FROM_NAME      (선택) 발신자 표시 이름. 기본값 "당근마켓 알림"
 */

const nodemailer = require('nodemailer');

function createTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      'GMAIL_USER / GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다. ' +
        'GitHub 저장소 Settings > Secrets 에 등록하세요.'
    );
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

/**
 * 새 매물 목록을 HTML 이메일로 발송.
 * @param {object} params
 * @param {string} params.to            수신 이메일
 * @param {object} params.watch         {keyword, location}
 * @param {Array}  params.items         새로 발견된 매물 배열
 */
async function sendNewItemsEmail({ to, watch, items }) {
  const transporter = createTransport();
  const fromName = process.env.MAIL_FROM_NAME || '당근마켓 알림';
  const from = `"${fromName}" <${process.env.GMAIL_USER}>`;

  const subject = `[당근마켓 알림] '${watch.keyword}' (${watch.location}) 신규 매물 ${items.length}건`;

  await transporter.sendMail({
    from,
    to,
    subject,
    text: buildText(watch, items),
    html: buildHtml(watch, items),
  });
}

function buildText(watch, items) {
  const lines = [
    `당근마켓에 '${watch.keyword}' 키워드 / '${watch.location}' 지역의 신규 매물이 올라왔습니다.`,
    '',
  ];
  items.forEach((it, i) => {
    lines.push(`${i + 1}. ${it.title || '(제목 없음)'}`);
    if (it.price) lines.push(`   가격: ${it.price}`);
    if (it.region) lines.push(`   지역: ${it.region}`);
    lines.push(`   링크: ${it.url}`);
    lines.push('');
  });
  lines.push('모바일에서 링크를 눌러 빠르게 구매 문의하세요!');
  return lines.join('\n');
}

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[c]));
}

function buildHtml(watch, items) {
  const cards = items
    .map(
      (it) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eee;">
        ${
          it.image
            ? `<img src="${esc(it.image)}" alt="" width="96" height="96" style="border-radius:8px;object-fit:cover;float:left;margin-right:12px;">`
            : ''
        }
        <a href="${esc(it.url)}" style="font-size:16px;font-weight:700;color:#ff6f0f;text-decoration:none;">
          ${esc(it.title || '(제목 없음)')}
        </a>
        <div style="margin-top:4px;color:#333;font-size:15px;">${esc(it.price || '')}</div>
        <div style="margin-top:2px;color:#888;font-size:13px;">${esc(it.region || '')}</div>
        <div style="margin-top:8px;">
          <a href="${esc(it.url)}" style="display:inline-block;background:#ff6f0f;color:#fff;padding:8px 14px;border-radius:6px;font-size:13px;text-decoration:none;">
            당근마켓에서 보기 →
          </a>
        </div>
        <div style="clear:both;"></div>
      </td>
    </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="ko">
<body style="margin:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:20px;">
    <div style="background:#fff;border-radius:12px;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:20px;color:#ff6f0f;">🥕 당근마켓 신규 매물 알림</h1>
      <p style="margin:0 0 16px;color:#555;font-size:14px;">
        키워드 <b>'${esc(watch.keyword)}'</b> · 지역 <b>'${esc(watch.location)}'</b> 조건의 신규 매물 <b>${items.length}</b>건
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>
      <p style="margin:20px 0 0;color:#999;font-size:12px;">
        모바일에서 위 버튼을 눌러 빠르게 구매 의사를 전달하세요.<br>
        이 메일은 GitHub Actions 자동 알림으로 발송되었습니다.
      </p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { sendNewItemsEmail };
