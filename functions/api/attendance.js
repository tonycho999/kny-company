export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    if (!env.DB) {
        return Response.json({ error: "데이터베이스 바인딩(DB)이 설정되지 않았습니다." }, { status: 500 });
    }

    const now = new Date();
    const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayDate = kstTime.toISOString().split('T')[0];
    const currentTime = kstTime.toISOString().split('T')[1].substring(0, 5);

    try {
        if (method === "GET") {
            const date = url.searchParams.get("date") || todayDate;
            const team = url.searchParams.get("team");
            const type = url.searchParams.get("type");

            if (type === "teams") {
                const { results } = await env.DB.prepare("SELECT DISTINCT team_name FROM employees WHERE status = '재직'").all();
                return Response.json(results.map(r => r.team_name));
            }

            let query = `
                SELECT e.employee_id, e.name, e.phone, e.team_name, a.clock_in, a.clock_out
                FROM employees e
                LEFT JOIN Attendance a ON e.employee_id = a.employee_id AND a.date = ?
            `;
            
            let results;
            if (team && team !== "전체") {
                query += " WHERE e.team_name = ? ORDER BY e.employee_id ASC";
                const res = await env.DB.prepare(query).bind(date, team).all();
                results = res.results;
            } else {
                query += " ORDER BY e.team_name ASC, e.employee_id ASC";
                const res = await env.DB.prepare(query).bind(date).all();
                results = res.results;
            }
            return Response.json(results);
        }

        if (method === "POST") {
            const { employeeId, type, date, token } = await request.json();
            const targetDate = date || todayDate;

            // 💡 1. 토큰 검증 여유시간(오차 허용)을 늘리고 KST 기준으로 계산
            const currentSlice = Math.floor(kstTime.getTime() / 10000);
            const tokenDiff = currentSlice - parseInt(token);

            // 여유를 5칸(약 50초)으로 늘림. 
            if (isNaN(tokenDiff) || tokenDiff < 0 || tokenDiff > 5) {
                return Response.json({ error: "만료되거나 유효하지 않은 QR코드입니다. 입구에서 다시 스캔하세요." }, { status: 400 });
            }

            const emp = await env.DB.prepare(
                "SELECT name, status, team_name FROM employees WHERE employee_id = ?"
            ).bind(employeeId).first();

            if (!emp) return Response.json({ error: "등록되지 않은 사원번호입니다." }, { status: 400 });
            if (emp.status !== "재직") return Response.json({ error: "퇴사 처리된 직원입니다." }, { status: 400 });

            const record = await env.DB.prepare(
                "SELECT * FROM Attendance WHERE employee_id = ? AND date = ?"
            ).bind(employeeId, targetDate).first();

            if (type === 'in') {
                if (record && record.clock_in) return Response.json({ error: "이미 오늘 출근 처리가 완료되었습니다." }, { status: 400 });
                if (record) {
                    await env.DB.prepare("UPDATE Attendance SET clock_in = ? WHERE employee_id = ? AND date = ?")
                        .bind(currentTime, employeeId, targetDate).run();
                } else {
                    await env.DB.prepare("INSERT INTO Attendance (employee_id, date, clock_in) VALUES (?, ?, ?)")
                        .bind(employeeId, targetDate, currentTime).run();
                }
            } else if (type === 'out') {
                if (record && record.clock_out) return Response.json({ error: "이미 오늘 퇴근 처리가 완료되었습니다." }, { status: 400 });
                if (record) {
                    await env.DB.prepare("UPDATE Attendance SET clock_out = ? WHERE employee_id = ? AND date = ?")
                        .bind(currentTime, employeeId, targetDate).run();
                } else {
                    await env.DB.prepare("INSERT INTO Attendance (employee_id, date, clock_out) VALUES (?, ?, ?)")
                        .bind(employeeId, targetDate, currentTime).run();
                }
            }
            return Response.json({ success: true, name: emp.name });
        }
        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
