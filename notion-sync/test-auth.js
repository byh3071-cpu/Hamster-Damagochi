require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const pageId = process.env.HARUCHI_PAGE_ID;

(async () => {
  if (!pageId) {
    console.error('❌ HARUCHI_PAGE_ID가 .env에 없습니다.');
    process.exit(1);
  }
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    console.log('✅ Integration이 하루치 페이지에 접근 가능합니다.');
    console.log('   제목:', page.properties?.title?.title?.[0]?.plain_text || '(제목 없음)');
    console.log('   ID:', page.id);
  } catch (e) {
    console.error('❌ 접근 불가:', e.message);
    console.error('   → 해당 페이지에 Integration(Connections)을 추가했는지 확인하세요.');
    process.exit(1);
  }
})();
