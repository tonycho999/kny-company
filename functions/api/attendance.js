export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    if (!env.DB) return Response.json({ error: "DB 설정 안됨" }, { status: 500 });

    const now = new Date();
    const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const currentTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(now);

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
            const start = url.searchParams.get("start");
            const end = url.searchParams.get("end");
            const legacyDate = url.searchParams.get("date"); 
            
            const startDate = start || legacyDate || todayDate;
            const endDate = end || legacyDate || todayDate;

            let query = "";
            let params = [];

            // ⭐️ 단일 날짜 조회: LIKE를 사용하여 시간 꼬리가 붙은 데이터도 100% 긁어옵니다.
            if (startDate === endDate) {
                query = `
                    SELECT ? as date, e.emp_id, e.name, e.phone, e.team_name, 
                           MAX(a.clock_in) as clock_in, MAX(a.clock_out) as clock_out
                    FROM employees e
                    LEFT JOIN Attendance a ON e.emp_id = a.emp_id AND a.date LIKE ?
                    GROUP BY e.emp_id, e.name, e.phone, e.team_name
                    ORDER BY e.team_name ASC, e.name ASC
                `;
                params = [startDate, startDate + '%'];
            } 
            // ⭐️ 기간 날짜 조회: 종료일에 23:59:59를 붙여서 마지막 날의 퇴근 기록까지 놓치지 않습니다.
            else {
                query = `
                    SELECT SUBSTR(a.date, 1, 10) as date, e.emp_id, e.name, e.phone, e.team_name, 
                           MAX(a.clock_in) as clock_in, MAX(a.clock_out) as clock_out
                    FROM Attendance a
                    LEFT JOIN employees e ON a.emp_id = a.emp_id
                    WHERE a.date >= ? AND a.date <= ?
                    GROUP BY SUBSTR(a.date, 1, 10), e.emp_id, e.name, e.phone, e.team_name
                    ORDER BY date DESC, e.team_name ASC, e.name ASC
                `;
                params = [startDate, endDate + ' 23:59:59'];
            }

            const { results } = await env.DB.prepare(query).bind(...params).all();
            return Response.json(results);
        }

        // POST 로직 (기존과 동일)
        if (method === "POST") {
            const { employeeId, type, date, token } = await request.json();
            
            let targetDate = todayDate;
            if (date && typeof date === 'string' && date.length >= 10) {
                targetDate = date.substring(0, 10);
            }

            const currentSlice = Math.floor(now.getTime() / 10000); 
            const tokenDiff = currentSlice - parseInt(token);

            if (isNaN(tokenDiff) || tokenDiff < 0 || tokenDiff > 5) {
                return Response.json({ error: "만료되거나 유효하지 않은 QR코드입니다." }, { status: 400 });
            }

            const emp = await env.DB.prepare("SELECT name, team_name FROM employees WHERE emp_id = ?").bind(employeeId).first();
            if (!emp) return Response.json({ error: "등록되지 않은 사원번호입니다." }, { status: 400 });

            const record = await env.DB.prepare("SELECT * FROM Attendance WHERE emp_id = ? AND SUBSTR(date, 1, 10) = ?").bind(employeeId, targetDate).first();

            if (type === 'in') {
                let newClockIn = currentTime;
                if (record && record.clock_in) newClockIn = record.clock_in + ', ' + currentTime;

                if (record) {
                    await env.DB.prepare("UPDATE Attendance SET clock_in = ? WHERE emp_id = ? AND SUBSTR(date, 1, 10) = ?").bind(newClockIn, employeeId, targetDate).run();
                } else {
                    await env.DB.prepare("INSERT INTO Attendance (emp_id, date, clock_in) VALUES (?, ?, ?)").bind(employeeId, targetDate, newClockIn).run();
                }

                const empRec = await env.DB.prepare("SELECT check_in_time FROM employees WHERE emp_id = ?").bind(employeeId).first();
                let newCheckInTime = `${todayDate} ${currentTime}`;
                if (empRec && empRec.check_in_time) newCheckInTime = empRec.check_in_time + ', ' + `${todayDate} ${currentTime}`;
                await env.DB.prepare("UPDATE employees SET check_in_time = ? WHERE emp_id = ?").bind(newCheckInTime, employeeId).run();

            } else if (type === 'out') {
                let newClockOut = currentTime;
                if (record && record.clock_out) newClockOut = record.clock_out + ', ' + currentTime;

                if (record) {
                    await env.DB.prepare("UPDATE Attendance SET clock_out = ? WHERE emp_id = ? AND SUBSTR(date, 1, 10) = ?").bind(newClockOut, employeeId, targetDate).run();
                } else {
                    await env.DB.prepare("INSERT INTO Attendance (emp_id, date, clock_out) VALUES (?, ?, ?)").bind(employeeId, targetDate, newClockOut).run();
                }

                const empRec = await env.DB.prepare("SELECT check_out_time FROM employees WHERE emp_id = ?").bind(employeeId).first();
                let newCheckOutTime = `${todayDate} ${currentTime}`;
                if (empRec && empRec.check_out_time) newCheckOutTime = empRec.check_out_time + ', ' + `${todayDate} ${currentTime}`;
                await env.DB.prepare("UPDATE employees SET check_out_time = ? WHERE emp_id = ?").bind(newCheckOutTime, employeeId).run();
            }

            return Response.json({ success: true, name: emp.name });
        }

        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
