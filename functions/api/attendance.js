export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    if (!env.DB) {
        return Response.json({ error: "DB 설정 안됨" }, { status: 500 });
    }

    // 서버 KST 시간 기준 생성
    const now = new Date();
    const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayDate = kstTime.toISOString().split('T')[0];
    const currentTime = kstTime.toISOString().split('T')[1].substring(0, 5);

    try {
        // [안전장치] 만약 Attendance 테이블 구조가 바뀌어서 지워졌다면 여기서 새로 만들어줌
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
            
            // 현재 DB 구조(emp_id)에 맞게 쿼리 수정
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

            // 토큰 검사 (5칸 = 약 50초 이내만 허용)
            const currentSlice = Math.floor(kstTime.getTime() / 10000);
            const tokenDiff = currentSlice - parseInt(token);
            if (isNaN(tokenDiff) || tokenDiff < 0 || tokenDiff > 5) {
                return Response.json({ error: "만료되거나 유효하지 않은 QR코드입니다." }, { status: 400 });
            }

            // 1. 직원 정보 확인 (현재 DB에는 status='재직' 컬럼이 없으므로 존재 여부만 체크)
            const emp = await env.DB.prepare(
                "SELECT name, team_name FROM employees WHERE emp_id = ?"
            ).bind(employeeId).first();
            
            if (!emp) return Response.json({ error: "등록되지 않은 사원번호입니다." }, { status: 400 });

            // 2. 근태 DB 기록
            const record = await env.DB.prepare(
                "SELECT * FROM Attendance WHERE emp_id = ? AND date = ?"
            ).bind(employeeId, targetDate).first();

            if (type === 'in') {
                if (record && record.clock_in) return Response.json({ error: "이미 출근 처리됨" }, { status: 400 });
                if (record) {
                    await env.DB.prepare("UPDATE Attendance SET clock_in = ? WHERE emp_id = ? AND date = ?").bind(currentTime, employeeId, targetDate).run();
                } else {
                    await env.DB.prepare("INSERT INTO Attendance (emp_id, date, clock_in) VALUES (?, ?, ?)").bind(employeeId, targetDate, currentTime).run();
                }
                // 관리자 화면을 위해 employees 테이블에도 시간 복사
                await env.DB.prepare("UPDATE employees SET check_in_time = ? WHERE emp_id = ?").bind(kstTime.toISOString(), employeeId).run();

            } else if (type === 'out') {
                if (record && record.clock_out) return Response.json({ error: "이미 퇴근 처리됨" }, { status: 400 });
                if (record) {
                    await env.DB.prepare("UPDATE Attendance SET clock_out = ? WHERE emp_id = ? AND date = ?").bind(currentTime, employeeId, targetDate).run();
                } else {
                    await env.DB.prepare("INSERT INTO Attendance (emp_id, date, clock_out) VALUES (?, ?, ?)").bind(employeeId, targetDate, currentTime).run();
                }
                // 관리자 화면을 위해 employees 테이블에도 시간 복사
                await env.DB.prepare("UPDATE employees SET check_out_time = ? WHERE emp_id = ?").bind(kstTime.toISOString(), employeeId).run();
            }

            return Response.json({ success: true, name: emp.name });
        }
        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
