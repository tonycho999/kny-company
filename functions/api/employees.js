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

        await context.env.DB.prepare(
            "INSERT INTO employees (emp_id, name, phone, team_name) VALUES (?, ?, ?, ?)"
        ).bind(emp_id, name, phone, team_name || '').run();

        // 등록된 행사장 자동 세팅
        if (team_name && team_name.trim() !== '') {
            await context.env.DB.prepare(`
                INSERT OR IGNORE INTO team_settings (team_name, kakao_use, max_wait_use, max_wait_count)
                VALUES (?, 0, 0, 50)
            `).bind(team_name.trim()).run();
        }

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// 💡 [새로 추가됨] 직원 정보 수정(업데이트) 기능
export async function onRequestPut(context) {
    try {
        const data = await context.request.json();
        const { id, emp_id, name, phone, team_name } = data;

        if (!id) throw new Error("ID가 필요합니다.");

        await context.env.DB.prepare(
            "UPDATE employees SET emp_id = ?, name = ?, phone = ?, team_name = ? WHERE id = ?"
        ).bind(emp_id, name, phone, team_name || '', id).run();

        // 수정된 행사장도 자동 세팅
        if (team_name && team_name.trim() !== '') {
            await context.env.DB.prepare(`
                INSERT OR IGNORE INTO team_settings (team_name, kakao_use, max_wait_use, max_wait_count)
                VALUES (?, 0, 0, 50)
            `).bind(team_name.trim()).run();
        }

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// 💡 삭제 기능 강화
export async function onRequestDelete(context) {
    try {
        const data = await context.request.json();
        await context.env.DB.prepare("DELETE FROM employees WHERE id = ?").bind(data.id).run();
        
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
