export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    
    const team = url.searchParams.get("team") || "";
    const keyword = url.searchParams.get("keyword") || "";

    if (!start || !end) {
        return new Response("시작 날짜와 종료 날짜가 필요합니다.", { status: 400 });
    }

    try {
        // ⭐️ [수정] 엑셀 다운로드도 강제로 1명당 1줄로 압축(GROUP BY)
        let query = `
            SELECT a.date, e.emp_id, e.name, e.phone, e.team_name, MAX(a.clock_in) as clock_in, MAX(a.clock_out) as clock_out
            FROM Attendance a
            LEFT JOIN employees e ON a.emp_id = e.emp_id
            WHERE a.date >= ? AND a.date <= ?
        `;
        
        let params = [start, end];

        if (team) {
            query += " AND e.team_name = ?";
            params.push(team);
        }

        if (keyword) {
            query += " AND e.name LIKE ?";
            params.push(`%${keyword}%`);
        }

        // ⭐️ 여기서 중복을 방지합니다.
        query += " GROUP BY a.date, e.emp_id, e.name, e.phone, e.team_name";
        query += " ORDER BY a.date DESC, e.team_name ASC, e.name ASC";
        
        const stmt = context.env.DB.prepare(query);
        const { results } = await stmt.bind(...params).all();

        let csv = '\uFEFF'; 
        csv += "근무일자,사원번호,이름,연락처,배정행사장,출근시간,퇴근시간\n";

        results.forEach(row => {
            const date = row.date || '-';
            const empId = row.emp_id || '-';
            const name = row.name || '-';
            const phone = row.phone || '-';
            const teamName = row.team_name || '-';
            const clockIn = row.clock_in || '미출근';
            const clockOut = row.clock_out || '미퇴근';
            
            csv += `${date},${empId},${name},${phone},${teamName},${clockIn},${clockOut}\n`;
        });

        let filename = `출퇴근기록_${start}_to_${end}`;
        if (team) filename += `_${team}`;
        filename += `.csv`;

        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
            }
        });

    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}
