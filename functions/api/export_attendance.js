export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!start || !end) {
        return new Response("시작 날짜와 종료 날짜가 필요합니다.", { status: 400 });
    }

    try {
        // Attendance 테이블과 employees 테이블을 조인하여 데이터 추출
        const query = `
            SELECT a.date, e.emp_id, e.name, e.phone, e.team_name, a.clock_in, a.clock_out
            FROM Attendance a
            LEFT JOIN employees e ON a.emp_id = e.emp_id
            WHERE a.date >= ? AND a.date <= ?
            ORDER BY a.date DESC, e.team_name ASC, e.name ASC
        `;
        
        const { results } = await context.env.DB.prepare(query).bind(start, end).all();

        // 한글이 엑셀에서 깨지지 않도록 BOM(\uFEFF) 추가
        let csv = '\uFEFF'; 
        csv += "근무일자,사원번호,이름,연락처,배정행사장,출근시간,퇴근시간\n";

        results.forEach(row => {
            const date = row.date || '-';
            const empId = row.emp_id || '-';
            const name = row.name || '-';
            const phone = row.phone || '-';
            const team = row.team_name || '-';
            const clockIn = row.clock_in || '미출근';
            const clockOut = row.clock_out || '미퇴근';
            
            // 엑셀에서 쉼표(,)로 열을 구분
            csv += `${date},${empId},${name},${phone},${team},${clockIn},${clockOut}\n`;
        });

        // 브라우저가 파일 다운로드로 인식하도록 헤더 설정
        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="출퇴근기록_${start}_to_${end}.csv"`
            }
        });
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}
