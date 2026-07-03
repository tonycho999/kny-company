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

export async function onRequestPut(context) {
    try {
        const data = await context.request.json();
        const { id, emp_id, name, phone, team_name } = data;

        if (!id) throw new Error("ID가 필요합니다.");

        const numId = parseInt(id, 10);

        await context.env.DB.prepare(
            "UPDATE employees SET emp_id = ?, name = ?, phone = ?, team_name = ? WHERE id = ?"
        ).bind(emp_id, name, phone, team_name || '', numId).run();

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

// 💡 [핵심] 직원을 삭제할 때, 관련 기록을 먼저 지우고 직원을 삭제합니다.
export async function onRequestDelete(context) {
    try {
        const url = new URL(context.request.url);
        const idParam = url.searchParams.get("id");
        
        if (!idParam) throw new Error("삭제할 ID가 전달되지 않았습니다.");
        const numId = parseInt(idParam, 10);

        // 1. 해당 직원의 사원번호(emp_id)를 먼저 알아냅니다.
        const emp = await context.env.DB.prepare("SELECT emp_id FROM employees WHERE id = ?").bind(numId).first();

        // 2. 관련 출퇴근 기록이 있다면 에러가 나지 않게 먼저 삭제해 줍니다.
        if (emp && emp.emp_id) {
            try { await context.env.DB.prepare("DELETE FROM Attendance WHERE emp_id = ?").bind(emp.emp_id).run(); } catch(e) {}
        }

        // 3. 마지막으로 직원을 완벽하게 삭제합니다.
        await context.env.DB.prepare("DELETE FROM employees WHERE id = ?").bind(numId).run();
        
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
