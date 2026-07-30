'use strict';

/**
 * 메인 실행 스크립트 (GitHub Actions 에서 주기적으로 실행).
 *
 * 1) config/watches.json 의 각 감시 항목(watch)을 읽는다.
 * 2) 당근마켓에서 키워드로 검색하고 지역으로 필터링한다.
 * 3) state/seen.json 과 비교하여 "신규" 매물만 골라낸다.
 * 4) 신규 매물이 있으면 지정 이메일로 알림을 보낸다.
 * 5) state/seen.json 을 갱신한다 (워크플로가 커밋).
 *
 * 환경변수:
 *   DRY_RUN=true  이면 이메일을 실제로 보내지 않고 콘솔에만 출력한다.
 */

const fs = require('fs');
const path = require('path');
const { searchDaangn } = require('./daangn');
const { sendNewItemsEmail } = require('./mailer');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'watches.json');
const STATE_PATH = path.join(ROOT, 'state', 'seen.json');

// 감시 항목당 상태에 보관하는 최대 매물 ID 개수 (파일 비대화 방지)
const MAX_SEEN_PER_WATCH = 500;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function watchId(watch, index) {
  return watch.id || `${watch.keyword}__${watch.location}__${index}`;
}

async function main() {
  const dryRun = process.env.DRY_RUN === 'true';
  const config = readJson(CONFIG_PATH, null);

  if (!config || !Array.isArray(config.watches) || config.watches.length === 0) {
    console.log('감시 항목이 없습니다. config/watches.json 을 확인하세요.');
    return;
  }

  const state = readJson(STATE_PATH, {});
  let stateChanged = false;
  let totalNew = 0;
  const errors = [];

  for (let i = 0; i < config.watches.length; i++) {
    const watch = config.watches[i];
    if (watch.enabled === false) continue;

    const id = watchId(watch, i);
    const to = watch.email || config.defaultEmail;
    const chatMessage =
      watch.chatMessage || config.defaultChatMessage || '안녕하세요. 제가 구매 가능할까요?';

    if (!watch.keyword) {
      console.warn(`[${id}] keyword 가 없어 건너뜁니다.`);
      continue;
    }
    if (!to) {
      console.warn(`[${id}] 수신 이메일(email)이 없어 건너뜁니다.`);
      continue;
    }

    console.log(`\n▶ 검색: 키워드='${watch.keyword}' 지역='${watch.location || '(전체)'}' → ${to}`);

    let found;
    try {
      found = await searchDaangn(watch);
    } catch (err) {
      console.error(`  ✖ 검색 실패: ${err.message}`);
      errors.push(`${id}: ${err.message}`);
      continue;
    }

    console.log(`  조건 일치 매물: ${found.length}건`);

    const seen = new Set(state[id] || []);
    const newItems = found.filter((it) => !seen.has(it.id));

    if (newItems.length === 0) {
      console.log('  신규 매물 없음.');
      continue;
    }

    console.log(`  ✨ 신규 매물 ${newItems.length}건 발견`);
    totalNew += newItems.length;

    if (dryRun) {
      newItems.forEach((it) =>
        console.log(`    - ${it.title} | ${it.price} | ${it.region} | ${it.url}`)
      );
    } else {
      try {
        await sendNewItemsEmail({ to, watch, items: newItems, chatMessage });
        console.log(`  ✉ 이메일 발송 완료 → ${to}`);
      } catch (err) {
        console.error(`  ✖ 이메일 발송 실패: ${err.message}`);
        errors.push(`${id} 이메일: ${err.message}`);
        // 발송 실패 시 상태를 갱신하지 않아 다음 실행 때 재시도한다.
        continue;
      }
    }

    // 상태 갱신: 이번에 조건 일치한 모든 매물 ID 를 기록 (신규 + 기존)
    const merged = [...found.map((it) => it.id), ...(state[id] || [])];
    state[id] = Array.from(new Set(merged)).slice(0, MAX_SEEN_PER_WATCH);
    stateChanged = true;
  }

  if (stateChanged) {
    writeJson(STATE_PATH, state);
    console.log(`\n상태 저장됨: ${path.relative(ROOT, STATE_PATH)}`);
  }

  console.log(`\n완료. 신규 매물 총 ${totalNew}건.`);

  if (errors.length > 0) {
    console.error(`\n오류 ${errors.length}건 발생:`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('예기치 못한 오류:', err);
  process.exit(1);
});
