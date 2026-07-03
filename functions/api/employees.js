export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare("SELECT * FROM employees ORDER BY id DESC").all();
        return new Response(JSON.stringify(results), { 
            headers: { 'Content-Type': 'application/json' } 
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const data = await context.request.json();
        const { emp_id, name, phone, team_name } = data;

        // 1. DB에 직원 정보 삽입 (team_name 포함)
        await context.env.DB.prepare(
            "INSERT INTO employees (emp_id, name, phone, team_name) VALUES (?, ?, ?, ?)"
        ).bind(emp_id, name, phone, team_name || '').run();

        // 2. 💡 [핵심 추가] 새로 등록된 team_name이 team_settings 테이블에 없다면 기본값으로 자동 추가
        if (team_name && team_name.trim() !== '') {
            await context.env.DB.prepare(`
                INSERT OR IGNORE INTO team_settings (team_name, kakao_use, max_wait_use, max_wait_count)
                VALUES (?, 0, 0, 50)
            `).bind(team_name.trim()).run();
        }

        return new Response(JSON.stringify({ success: true }), { 
            headers: { 'Content-Type': 'application/json' } 
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestDelete(context) {
    try {
        const data = await context.request.json();
        await context.env.DB.prepare("DELETE FROM employees WHERE id = ?").bind(data.id).run();
        
        return new Response(JSON.stringify({ success: true }), { 
            headers: { 'Content-Type': 'application/json' } 
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
