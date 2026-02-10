/**
 * Hamster Damagochi - Notion XP 조회 API (Vercel Serverless)
 *
 * XP 로그 DB에서 하루치(HARUCHI_PAGE_ID)에 연결된 XP 합계를 조회하여 반환합니다.
 * [환경변수] Vercel에 설정: NOTION_API_KEY, XP_LOG_DB_ID, HARUCHI_PAGE_ID
 *
 * [응답] { totalXP, level, exp, maxExp }
 */

import { Client } from '@notionhq/client';

const XP_AMOUNT_KEY = 'XP';
const HARUCHI_RELATION_KEY = '하루치 DB';
const MAX_EXP_PER_LEVEL = 100;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.NOTION_API_KEY;
  const xpDbId = process.env.XP_LOG_DB_ID;
  const haruchiPageId = process.env.HARUCHI_PAGE_ID;

  if (!apiKey || !xpDbId || !haruchiPageId) {
    return res.status(500).json({
      error: 'Notion 연동 미설정',
      message: 'Vercel에 NOTION_API_KEY, XP_LOG_DB_ID, HARUCHI_PAGE_ID 를 설정해주세요.',
      totalXP: 0,
      level: 1,
      exp: 0,
      maxExp: MAX_EXP_PER_LEVEL,
    });
  }

  try {
    const notion = new Client({ auth: apiKey });
    let totalXP = 0;
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: xpDbId,
        filter: {
          property: HARUCHI_RELATION_KEY,
          relation: { contains: haruchiPageId },
        },
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        const prop = page.properties[XP_AMOUNT_KEY];
        if (prop?.type === 'number' && typeof prop.number === 'number') {
          totalXP += prop.number;
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor ?? undefined;
    }

    const level = Math.floor(totalXP / MAX_EXP_PER_LEVEL) + 1;
    const exp = totalXP % MAX_EXP_PER_LEVEL;

    return res.status(200).json({
      totalXP,
      level,
      exp,
      maxExp: MAX_EXP_PER_LEVEL,
    });
  } catch (e) {
    console.error('[api/game] Notion 오류:', e.message);
    return res.status(500).json({
      error: 'Notion 조회 실패',
      message: e.message,
      totalXP: 0,
      level: 1,
      exp: 0,
      maxExp: MAX_EXP_PER_LEVEL,
    });
  }
}
