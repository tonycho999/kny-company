// functions/survey-api/get-results.js
export async function onRequestGet(context) {
  try {
    // D1에서 데이터를 최신순(내림차순)으로 모두 가져옵니다.
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM survey_responses ORDER BY submitted_at DESC"
    ).all();

    return new Response(JSON.stringify({ success: true, data: results }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
