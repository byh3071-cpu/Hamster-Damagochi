/**
 * Hamster Damagochi - Notion 연동 API (Vercel Serverless)
 *
 * [연동 순서]
 * 1. Notion Integration 생성 → Internal Integration Token 발급
 * 2. 각 DB(할 일, 루틴, 독서, 운동)에 Integration 연결
 * 3. NOTION_API_KEY, DB_ID_* 환경변수 설정
 *
 * [응답 형식] { completed: { routine: N, task: N, reading: N, exercise: N } }
 * - 오늘(KST) 완료된 체크박스 개수
 * - 프론트에서 addExpFromTask() 반복 호출 또는 합산 XP 계산
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // TODO: Notion API 연동
  // const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  // const [tasks, routines, books, exercise] = await Promise.all([
  //   fetchNotionCompleted(DB_ID_TASKS, today),
  //   fetchNotionCompleted(DB_ID_ROUTINES, today),
  //   ...
  // ]);

  return res.status(200).json({
    completed: { routine: 0, task: 0, reading: 0, exercise: 0 },
    today: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
    message: "Notion 연동 준비 중. 환경변수 설정 후 구현.",
  });
}
