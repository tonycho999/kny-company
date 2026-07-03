export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    if (!env.DB) return Response.json({ error: "DB 설정 안됨" }, { status: 500 });

    const now = new Date();
    const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayDate = kstTime.toISOString().split('T')[0];
    const currentTime = kstTime.toISOString().split('T')[1].substring(0, 5);

    try {
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS Attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                emp_id TEXT NOT NULL,
                date TEXT NOT NULL,
                clock_in TEXT,
                clock_out TEXT
            )
        `).run();

        if (method === "GET") {
            const date = url.searchParams.get("date") || todayDate;
            const query = `
                SELECT e.emp_id, e.name, e.phone, e.team_name, a.clock_in, a.clock_out
                FROM employees e
                LEFT JOIN Attendance a ON e.emp_id = a.emp_id AND a.date = ?
            `;
            const { results } = await env.DB.prepare(query).bind(date).all();
            return Response.json(results);
        }

        if (method === "POST") {
            const { employeeId, type, date, token } = await request.json();
            const targetDate = date || todayDate;

            const currentSlice = Math.floor(kstTime.getTime() / 10000);
            const tokenDiff = currentSlice - parseInt(token);
            if (isNaN(tokenDiff) || tokenDiff < 0 || tokenDiff > 5) {
                return Response.json({ error: "만료되거나 유효하지 않은 QR코드입니다." }, { status: 400 });
            }

            const emp = await env.DB.prepare("SELECT name, team_name FROM employees WHERE emp_id = ?").bind(employeeId).first();
            if (!emp) return Response.json({ error: "등록되지 않은 사원번호입니다." }, { status: 400 });

            const record = await env.DB.prepare("SELECT * FROM Attendance WHERE emp_id = ? AND date = ?").bind(employeeId, targetDate).first();

            if (type === 'in') {
                // 🛠️ 수정됨: 이미 출근/퇴근 기록이 있어도 에러를 내지 않고 '재출근'으로 덮어씌웁니다. (퇴근 기록은 초기화)
                if (record) {
                    await env.DB.prepare("UPDATE Attendance SET clock_in = ?, clock_out = NULL WHERE emp_id = ? AND date = ?").bind(currentTime, employeeId, targetDate).run();
                } else {
                    await env.DB.prepare("INSERT INTO Attendance (emp_id, date, clock_in) VALUES (?, ?, ?)").bind(employeeId, targetDate, currentTime).run();
                }
                
                await env.DB.prepare("UPDATE employees SET check_in_time = ?, check_out_time = NULL WHERE emp_id = ?").bind(now.toISOString(), employeeId).run();

            } else if (type === 'out') {
                if (record && record.clock_out) return Response.json({ error: "이미 퇴근 처리되었습니다." }, { status: 400 });
                if (record) {
                    await env.DB.prepare("UPDATE Attendance SET clock_out = ? WHERE emp_id = ? AND date = ?").bind(currentTime, employeeId, targetDate).run();
                } else {
                    await env.DB.prepare("INSERT INTO Attendance (emp_id, date, clock_out) VALUES (?, ?, ?)").bind(employeeId, targetDate, currentTime).run();
                }
                
                await env.DB.prepare("UPDATE employees SET check_out_time = ? WHERE emp_id = ?").bind(now.toISOString(), employeeId).run();
            }

            return Response.json({ success: true, name: emp.name });
        }
        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
