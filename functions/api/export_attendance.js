export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    
    // ⭐️ 프론트엔드에서 넘어온 팀과 키워드(이름) 정보 파라미터 받기
    const team = url.searchParams.get("team") || "";
    const keyword = url.searchParams.get("keyword") || "";

    if (!start || !end) {
        return new Response("시작 날짜와 종료 날짜가 필요합니다.", { status: 400 });
    }

    try {
        // ⭐️ 기본 쿼리: 날짜 범위는 필수
        let query = `
            SELECT a.date, e.emp_id, e.name, e.phone, e.team_name, a.clock_in, a.clock_out
            FROM Attendance a
            LEFT JOIN employees e ON a.emp_id = e.emp_id
            WHERE a.date >= ? AND a.date <= ?
        `;
        
        let params = [start, end];

        // ⭐️ 팀 필터가 있으면 쿼리에 추가
        if (team) {
            query += " AND e.team_name = ?";
            params.push(team);
        }

        // ⭐️ 이름 키워드 검색이 있으면 쿼리에 추가 (부분 일치 LIKE)
        if (keyword) {
            query += " AND e.name LIKE ?";
            params.push(`%${keyword}%`);
        }

        // 정렬 조건 추가
        query += " ORDER BY a.date DESC, e.team_name ASC, e.name ASC";
        
        // 동적 쿼리 실행
        const stmt = context.env.DB.prepare(query);
        const { results } = await stmt.bind(...params).all();

        // 한글이 엑셀에서 깨지지 않도록 BOM(\uFEFF) 추가
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
            
            // 엑셀에서 쉼표(,)로 열을 구분
            csv += `${date},${empId},${name},${phone},${teamName},${clockIn},${clockOut}\n`;
        });

        // ⭐️ 파일명에 팀명이나 검색어가 들어갔다면 반영하여 더 명확하게 다운로드 되도록 설정
        let filename = `출퇴근기록_${start}_to_${end}`;
        if (team) filename += `_${team}`;
        filename += `.csv`;

        // 브라우저가 파일 다운로드로 인식하도록 헤더 설정
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
