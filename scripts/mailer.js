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
 * @param {string} [params.chatMessage] 채팅 도우미에 미리 채울 인사말
 */
async function sendNewItemsEmail({ to, watch, items, chatMessage }) {
  const transporter = createTransport();
  const fromName = process.env.MAIL_FROM_NAME || '당근마켓 알림';
  const from = `"${fromName}" <${process.env.GMAIL_USER}>`;
  const message = chatMessage || '안녕하세요. 제가 구매 가능할까요?';

  const subject = `[당근마켓 알림] '${watch.keyword}' (${watch.location}) 신규 매물 ${items.length}건`;

  await transporter.sendMail({
    from,
    to,
    subject,
    text: buildText(watch, items, message),
    html: buildHtml(watch, items, message),
  });
}

function buildText(watch, items, message) {
  const lines = [
    `당근마켓에 '${watch.keyword}' 키워드 / '${watch.location}' 지역의 신규 매물이 올라왔습니다.`,
    '',
  ];
  items.forEach((it, i) => {
    lines.push(`${i + 1}. ${it.title || '(제목 없음)'}`);
    if (it.price) lines.push(`   가격: ${it.price}`);
    if (it.region) lines.push(`   지역: ${it.region}`);
    lines.push(`   매물: ${it.url}`);
    lines.push(`   빠른 채팅: ${chatHelperLink(it, message)}`);
    lines.push('');
  });
  lines.push(`인사말: "${message}"`);
  lines.push('모바일에서 "빠른 채팅" 링크를 눌러 인사말을 복사한 뒤, 매물에서 "채팅하기"에 붙여넣으세요.');
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

function buildHtml(watch, items, message) {
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
        <div style="margin-top:10px;">
          <a href="${esc(chatHelperLink(it, message))}" style="display:inline-block;background:#ff6f0f;color:#fff;padding:9px 15px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;margin-right:6px;">
            💬 빠른 채팅
          </a>
          <a href="${esc(it.url)}" style="display:inline-block;background:#fff;color:#e5620a;border:1.5px solid #ff6f0f;padding:7px 14px;border-radius:6px;font-size:13px;text-decoration:none;">
            매물 보기 →
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
      <div style="margin:18px 0 0;padding:12px 14px;background:#fff4ec;border-radius:8px;">
        <div style="font-size:12px;color:#e5620a;font-weight:700;margin-bottom:4px;">미리 준비된 인사말</div>
        <div style="font-size:15px;color:#333;">${esc(message)}</div>
      </div>
      <p style="margin:14px 0 0;color:#999;font-size:12px;">
        <b>💬 빠른 채팅</b> 버튼 → 인사말 <b>복사</b> → <b>매물에서 "채팅하기"</b>에 붙여넣기 후 전송하세요.<br>
        (계정 보호 및 당근마켓 이용약관 준수를 위해 전송은 직접 완료합니다.)<br>
        이 메일은 GitHub Actions 자동 알림으로 발송되었습니다.
      </p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { sendNewItemsEmail };
