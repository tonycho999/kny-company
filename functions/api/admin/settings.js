export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const teamName = url.searchParams.get("team");
    
    if (!teamName) return new Response(JSON.stringify({ error: "팀 이름 필요" }), { status: 400 });

    try {
        const settings = await context.env.DB.prepare(
            "SELECT * FROM team_settings WHERE team_name = ?"
        ).bind(teamName).first();
        
        return new Response(JSON.stringify(settings || { kakao_use: 0, max_wait_use: 0, max_wait_count: 50 }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const { team_name, kakao_use, max_wait_use, max_wait_count } = await context.request.json();
        
        // INSERT OR REPLACE 구문으로 설정 저장 (있으면 덮어쓰기)
        await context.env.DB.prepare(`
            INSERT INTO team_settings (team_name, kakao_use, max_wait_use, max_wait_count)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(team_name) DO UPDATE SET 
            kakao_use=excluded.kakao_use, max_wait_use=excluded.max_wait_use, max_wait_count=excluded.max_wait_count
        `).bind(team_name, kakao_use, max_wait_use, max_wait_count).run();

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
