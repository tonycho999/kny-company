export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    // DB 바인딩 체크
    if (!env.DB) {
        return Response.json({ error: "데이터베이스가 연결되지 않았습니다. Cloudflare 설정에서 DB 바인딩을 확인하세요." }, { status: 500 });
    }

    const now = new Date();
    const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayDate = kstTime.toISOString().split('T')[0];
    const currentTime = kstTime.toISOString().split('T')[1].substring(0, 5);

    try {
        if (method === "GET") {
            const date = url.searchParams.get("date") || todayDate;
            const query = `
                SELECT e.employee_id as employeeId, e.name, e.contact, a.clock_in as clockIn, a.clock_out as clockOut
                FROM Employees e
                LEFT JOIN Attendance a ON e.employee_id = a.employee_id AND a.date = ?
            `;
            const { results } = await env.DB.prepare(query).bind(date).all();
            return Response.json(results);
        }

        if (method === "POST") {
            const { employeeId, type, date } = await request.json();
            const targetDate = date || todayDate;

            const emp = await env.DB.prepare(
                "SELECT name, status FROM Employees WHERE employee_id = ?"
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
