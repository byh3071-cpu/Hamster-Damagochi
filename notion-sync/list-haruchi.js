/**
 * 하루치 DB(데이터베이스) 안의 행(페이지) 목록 조회
 * → HARUCHI_PAGE_ID에 넣을 올바른 페이지 ID 찾기
 */
require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// 현재 .env의 HARUCHI_PAGE_ID (실제로는 DB ID)
const dbId = process.env.HARUCHI_PAGE_ID;

(async () => {
  if (!dbId) {
    console.error('❌ HARUCHI_PAGE_ID가 .env에 없습니다.');
    process.exit(1);
  }
  try {
    const res = await notion.databases.query({ database_id: dbId });
    console.log(`\n📋 하루치 DB 안의 행 목록 (총 ${res.results.length}개):\n`);
    for (const page of res.results) {
      const title = page.properties?.title?.title?.[0]?.plain_text
        || page.properties?.이름?.title?.[0]?.plain_text
        || page.properties?.Name?.title?.[0]?.plain_text
        || '(제목 없음)';
      console.log(`   • "${title}"`);
      console.log(`     ID: ${page.id}  ← .env HARUCHI_PAGE_ID에 이 값을 넣으세요\n`);
    }
    if (res.results.length === 0) {
      console.log('   (행이 없습니다. DB에 하루치 캐릭터를 추가한 뒤 다시 실행하세요.)\n');
    }
  } catch (e) {
    console.error('❌ 조회 실패:', e.message);
    process.exit(1);
  }
})();
