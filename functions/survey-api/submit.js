export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    
    // DB 바인딩 이름이 DB라고 가정 (wrangler.toml 설정에 맞추세요)
    const stmt = context.env.DB.prepare(`
      INSERT INTO survey_responses 
      (q1_age, q2_experience, q3_awareness, q4_integration, q5_integration_detail, q6_free_opinion) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      data.q1_age, 
      data.q2_experience, 
      data.q3_awareness, 
      data.q4_integration, 
      data.q5_integration_detail || null, 
      data.q6_free_opinion || null
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
