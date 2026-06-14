export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    // 한국 시간(KST)을 기준으로 현재 날짜와 시간 구하기
    const now = new Date();
    const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayDate = kstTime.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = kstTime.toISOString().split('T')[1].substring(0, 5); // HH:MM

    try {
        // [GET] 특정 날짜의 출퇴근 기록 조회 (관리자용)
        if (method === "GET") {
            const date = url.searchParams.get("date") || todayDate;
            
            // 등록된 전체 직원과 해당 날짜의 기록을 합쳐서 조회 (LEFT JOIN)
            const query = `
                SELECT e.employee_id as employeeId, e.name, e.contact, a.clock_in as clockIn, a.clock_out as clockOut
                FROM Employees e
                LEFT JOIN Attendance a ON e.employee_id = a.employee_id AND a.date = ?
            `;
            const { results } = await env.DB.prepare(query).bind(date).all();
            return Response.json(results);
        }

        // [POST] 출퇴근 기록 추가 (직원용)
        if (method === "POST") {
            const { employeeId, type } = await request.json();

            // 1. 등록된 사원번호인지 & 재직 중인지 확인
            const emp = await env.DB.prepare(
                "SELECT name, status FROM Employees WHERE employee_id = ?"
            ).bind(employeeId).first();

            if (!emp) return Response.json({ error: "등록되지 않은 사원번호입니다." }, { status: 400 });
            if (emp.status !== "재직") return Response.json({ error: "퇴사 처리된 직원입니다." }, { status: 400 });

            // 2. 오늘의 기록 존재 여부 확인
            const record = await env.DB.prepare(
                "SELECT * FROM Attendance WHERE employee_id = ? AND date = ?"
            ).bind(employeeId, todayDate).first();

            if (type === 'in') { // 출근 버튼을 눌렀을 때
                if (record && record.clock_in) {
                    return Response.json({ error: "이미 오늘 출근 처리가 완료되었습니다." }, { status: 400 });
                }
                if (record) {
                    await env.DB.prepare("UPDATE Attendance SET clock_in = ? WHERE employee_id = ? AND date = ?")
                        .bind(currentTime, employeeId, todayDate).run();
                } else {
                    await env.DB.prepare("INSERT INTO Attendance (employee_id, date, clock_in) VALUES (?, ?, ?)")
                        .bind(employeeId, todayDate, currentTime).run();
                }
            } 
            else if (type === 'out') { // 퇴근 버튼을 눌렀을 때
                if (record && record.clock_out) {
                    return Response.json({ error: "이미 오늘 퇴근 처리가 완료되었습니다." }, { status: 400 });
                }
                if (record) {
                    await env.DB.prepare("UPDATE Attendance SET clock_out = ? WHERE employee_id = ? AND date = ?")
                        .bind(currentTime, employeeId, todayDate).run();
                } else {
                    // 예외: 출근을 안 찍고 퇴근만 찍었을 경우
                    await env.DB.prepare("INSERT INTO Attendance (employee_id, date, clock_out) VALUES (?, ?, ?)")
                        .bind(employeeId, todayDate, currentTime).run();
                }
            }

            return Response.json({ success: true, name: emp.name });
        }

        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
