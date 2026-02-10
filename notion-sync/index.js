const path = require('path');
require('dotenv').config();
// notion-sync/.env 없으면 프로젝트 루트 .env 사용
if (!process.env.NOTION_API_KEY) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}
const { Client } = require('@notionhq/client');

// 필수 환경 변수 검증
const requiredEnv = ['NOTION_API_KEY', 'XP_LOG_DB_ID', 'HARUCHI_PAGE_ID'];
const missing = requiredEnv.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error('❌ 필수 환경 변수가 없습니다:', missing.join(', '));
  console.error('   notion-sync/.env 또는 프로젝트 루트 .env 파일을 확인하세요.');
  process.exit(1);
}

// 노션 클라이언트 초기화
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// ==========================================
// ⚙️ CONFIG: 데이터베이스 속성 매핑 (이미지 기반)
// ==========================================
const CONFIG = {
  // 1. 소스 DB별 설정 (속성 이름 정확도 필수)
  sources: {
    todo: {
      dbId: process.env.TODO_DB_ID,
      type: '할일',
      titleKey: '할 일',        // 띄어쓰기 주의
      doneKey: '완료',
      xpGrantedKey: 'XP 지급됨',
      reward: 10,
      relationKey: '할일 DB'
    },
    routine: {
      dbId: process.env.ROUTINE_DB_ID,
      type: '루틴',
      titleKey: '이름',
      doneKey: '완료',
      xpGrantedKey: 'XP 지급됨',
      reward: 20,
      relationKey: '루틴 DB'
    },
    workout: {
      dbId: process.env.WORKOUT_DB_ID,
      type: '운동',
      titleKey: '운동',         // '이름' 아님
      doneKey: '완료',
      xpGrantedKey: 'XP 지급됨',
      reward: 80,
      relationKey: '운동 DB'
    },
    readingSession: {
      dbId: process.env.READING_SESSION_DB_ID,
      type: '독서',
      titleKey: '세션 이름',    // '이름' 아님
      doneKey: '완료',
      xpGrantedKey: 'XP 지급됨',
      reward: 40,
      relationKey: '독서 DB'
    },
    // 특수 로직 DB들
    book: {
      dbId: process.env.READING_BOOK_DB_ID,
      type: '독서', // 로그 타입은 독서로 통일
      titleKey: '책 이름',
      statusKey: '상태',
      targetStatus: '완독',
      xpGrantedKey: 'XP 지급됨',
      bonusXpKey: '완독 보너스 XP',
      defaultReward: 300,
      relationKey: '책형DB'     // 띄어쓰기 없음
    },
    sns: {
      dbId: process.env.SNS_DB_ID,
      type: '콘텐츠',
      titleKey: '제목',
      statusKey: '상태',
      targetStatus: '발행',
      platformKey: '선택',      // '플랫폼' 아님
      xpGrantedKey: 'XP 지급됨',
      relationKey: 'SNS DB'
    }
  },

  // 2. XP 로그 DB 속성 (타겟)
  xpLog: {
    titleKey: '[타입] · [원본/내용] · [XP]', // 복잡한 키 이름
    dateKey: '날짜',
    typeKey: '타입',
    amountKey: 'XP',
    uniqueKey: '지급키',
    haruchiRelationKey: '하루치 DB' // 필수 연결
  }
};

/**
 * 🚀 메인 실행 함수
 */
async function syncGamification() {
  console.log('🐹 [Start] 하루치 OS 동기화 시작...');

  try {
    // 1. 일반 DB 처리 (할일, 루틴, 운동, 독서세션)
    await processSimpleDB(CONFIG.sources.todo);
    await processSimpleDB(CONFIG.sources.routine);
    await processSimpleDB(CONFIG.sources.workout);
    await processSimpleDB(CONFIG.sources.readingSession);

    // 2. 특수 DB 처리 (책형, SNS)
    await processBookDB(CONFIG.sources.book);
    await processSNSDB(CONFIG.sources.sns);

    console.log('✨ [Finish] 모든 동기화가 완료되었습니다.');
  } catch (error) {
    console.error('❌ [Critical Error] 전체 프로세스 중단:', error.body || error.message);
  }
}

/**
 * 🟢 [공통] 단순 완료 체크형 DB 처리
 */
async function processSimpleDB(config) {
  if (!config.dbId) return;

  // XP 미지급 & 완료된 항목 조회
  const pages = await queryDatabase(config.dbId, {
    and: [
      { property: config.doneKey, checkbox: { equals: true } },
      { property: config.xpGrantedKey, checkbox: { equals: false } }
    ]
  });

  for (const page of pages) {
    const title = getTitle(page, config.titleKey);
    const logTitle = `${config.type} · ${title} · ${config.reward}XP`;

    console.log(`running... ${logTitle}`);

    await createXPLogAndGrant({
      title: logTitle,
      type: config.type,
      xp: config.reward,
      sourceRelationKey: config.relationKey,
      sourcePageId: page.id,
      xpGrantedKey: config.xpGrantedKey
    });
  }
}

/**
 * 🔵 [특수] 책형 DB 처리 (완독 보너스)
 */
async function processBookDB(config) {
  if (!config.dbId) return;

  const pages = await queryDatabase(config.dbId, {
    and: [
      { property: config.statusKey, status: { equals: config.targetStatus } },
      { property: config.xpGrantedKey, checkbox: { equals: false } }
    ]
  });

  for (const page of pages) {
    const title = getTitle(page, config.titleKey);

    // 보너스 XP 확인 (없으면 기본값, 0도 유효)
    let xp = config.defaultReward;
    const bonusProp = page.properties[config.bonusXpKey];
    if (bonusProp && typeof bonusProp.number === 'number') {
      xp = bonusProp.number;
    }

    const logTitle = `${config.type} · ${title} 완독 · ${xp}XP`;
    console.log(`running... ${logTitle}`);

    await createXPLogAndGrant({
      title: logTitle,
      type: config.type,
      xp: xp,
      sourceRelationKey: config.relationKey,
      sourcePageId: page.id,
      xpGrantedKey: config.xpGrantedKey
    });
  }
}

/**
 * 🟣 [특수] SNS DB 처리 (플랫폼별 차등 지급)
 */
async function processSNSDB(config) {
  if (!config.dbId) return;

  const pages = await queryDatabase(config.dbId, {
    and: [
      { property: config.statusKey, status: { equals: config.targetStatus } },
      { property: config.xpGrantedKey, checkbox: { equals: false } }
    ]
  });

  for (const page of pages) {
    const title = getTitle(page, config.titleKey);

    // 플랫폼 확인 ('선택' 속성)
    const selectProp = page.properties[config.platformKey];
    const platform = selectProp?.select ? selectProp.select.name : '기타';

    // 점수 계산
    let xp = 10;
    if (platform.includes('쓰레드')) xp = 20;
    else if (platform.includes('인스타')) xp = 30;
    else if (platform.includes('블로그')) xp = 80;

    const logTitle = `${config.type} · ${platform} · ${xp}XP`;
    console.log(`running... ${logTitle}`);

    await createXPLogAndGrant({
      title: logTitle,
      type: config.type,
      xp: xp,
      sourceRelationKey: config.relationKey,
      sourcePageId: page.id,
      xpGrantedKey: config.xpGrantedKey
    });
  }
}

/**
 * 🛠 [Helper] 데이터베이스 조회
 */
async function queryDatabase(dbId, filter) {
  try {
    const response = await notion.databases.query({
      database_id: dbId,
      filter: filter
    });
    return response.results;
  } catch (e) {
    console.error(`⚠️ DB 조회 실패 (ID: ${dbId}):`, e.message);
    return [];
  }
}

/**
 * 🛠 [Helper] XP 로그 생성 및 처리 완료 마킹 (트랜잭션 처럼)
 */
async function createXPLogAndGrant({ title, type, xp, sourceRelationKey, sourcePageId, xpGrantedKey }) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const uniqueKey = `${type}_${sourcePageId}`; // 중복 생성 방지용 키

    // 1. XP 로그 생성
    const props = {
      [CONFIG.xpLog.titleKey]: { title: [{ text: { content: title } }] },
      [CONFIG.xpLog.dateKey]: { date: { start: today } },
      [CONFIG.xpLog.typeKey]: { select: { name: type } },
      [CONFIG.xpLog.amountKey]: { number: xp },
      [CONFIG.xpLog.uniqueKey]: { rich_text: [{ text: { content: uniqueKey } }] },

      // [핵심] 하루치 캐릭터 연결
      [CONFIG.xpLog.haruchiRelationKey]: {
        relation: [{ id: process.env.HARUCHI_PAGE_ID }]
      }
    };

    // 소스 DB 연결 추가
    if (sourceRelationKey) {
      props[sourceRelationKey] = { relation: [{ id: sourcePageId }] };
    }

    await notion.pages.create({
      parent: { database_id: process.env.XP_LOG_DB_ID },
      properties: props
    });

    // 2. 원본 페이지 'XP 지급됨' 체크
    await notion.pages.update({
      page_id: sourcePageId,
      properties: {
        [xpGrantedKey]: { checkbox: true }
      }
    });

  } catch (e) {
    console.error(`   ❌ 로그 생성 실패 (${title}):`, e.body || e.message);
  }
}

/**
 * 🛠 [Helper] 제목/텍스트 추출 (title 또는 rich_text 속성 지원)
 */
function getTitle(page, key) {
  const prop = page.properties[key];
  if (!prop) return '제목 없음';
  if (prop.title?.length > 0) return prop.title[0].plain_text;
  if (prop.rich_text?.length > 0) return prop.rich_text[0].plain_text;
  return '제목 없음';
}

// 실행
syncGamification();
