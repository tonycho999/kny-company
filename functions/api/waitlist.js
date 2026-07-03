export async function onRequest(context) {
    const { request, env } = context;
    const method = request.method;

    if (!env.DB) return Response.json({ error: "DB 오류" }, { status: 500 });

    try {
        if (method === "POST") {
            const { team_name, name, phone, count, kakao_enabled } = await request.json();

            // 1. 설정 검사 (최대 대기 인원 제한 확인)
            const settings = await env.DB.prepare("SELECT * FROM team_settings WHERE team_name = ?").bind(team_name).first();
            
            if (settings && settings.max_wait_use === 1) {
                // 현재 대기 중인 사람 수 계산 (오늘 날짜 기준)
                const currentWaiting = await env.DB.prepare(`
                    SELECT SUM(count) as totalPeople FROM waitlist 
                    WHERE team_name = ? AND status = 'waiting' 
                    AND date(created_at, '+9 hours') = date('now', '+9 hours')
                `).bind(team_name).first();
                
                const totalCurrent = (currentWaiting && currentWaiting.totalPeople) ? currentWaiting.totalPeople : 0;
                
                if ((totalCurrent + count) > settings.max_wait_count) {
                    return Response.json({ error: `접수 마감 (현재 최대 ${settings.max_wait_count}명까지만 대기 가능합니다.)` }, { status: 400 });
                }
            }

            // 2. 어뷰징 방지
            const exist = await env.DB.prepare(
                "SELECT * FROM waitlist WHERE team_name = ? AND phone = ? AND status = 'waiting' AND date(created_at, '+9 hours') = date('now', '+9 hours')"
            ).bind(team_name, phone).first();
            if (exist) return Response.json({ error: "이미 대기 등록된 연락처입니다." }, { status: 400 });

            // 3. 날짜별 대기 번호 부여 로직 (오늘 날짜 기준 최대번호 + 1)
            const maxNumberResult = await env.DB.prepare(`
                SELECT MAX(waiting_number) as maxNum FROM waitlist 
                WHERE team_name = ? AND date(created_at, '+9 hours') = date('now', '+9 hours')
            `).bind(team_name).first();
            
            let nextWaitingNumber = 1;
            if (maxNumberResult && maxNumberResult.maxNum !== null) {
                nextWaitingNumber = maxNumberResult.maxNum + 1;
            }

            // 4. 저장
            const insertResult = await env.DB.prepare(`
                INSERT INTO waitlist (team_name, name, phone, count, kakao_enabled, waiting_number, status)
                VALUES (?, ?, ?, ?, ?, ?, 'waiting')
                RETURNING id
            `).bind(team_name, name, phone, count, kakao_enabled, nextWaitingNumber).first();

            return Response.json({ success: true, id: insertResult.id });
        }
        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
