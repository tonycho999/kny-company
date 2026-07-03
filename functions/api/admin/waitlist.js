export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const teamName = url.searchParams.get("teamName");
    const targetDate = url.searchParams.get("date"); // 💡 날짜값을 받아옵니다.

    if (!teamName || !targetDate) {
        return new Response(JSON.stringify({ error: "팀 이름과 날짜 파라미터가 필요합니다." }), { status: 400 });
    }

    try {
        // 💡 해당 팀 + 해당 날짜의 대기열만 뽑아냅니다. (DB의 created_at 시간을 기준으로 날짜만 자름)
        const query = `
            SELECT * FROM waitlist 
            WHERE team_name = ? AND date(created_at, '+9 hours') = ? 
            ORDER BY waiting_number ASC
        `;
        
        const { results } = await context.env.DB.prepare(query).bind(teamName, targetDate).all();
        
        return new Response(JSON.stringify(results), { 
            headers: { 'Content-Type': 'application/json' } 
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestPut(context) {
    try {
        const { id, status, phone, team_name } = await context.request.json();
        
        if (!id || !status) {
            return new Response(JSON.stringify({ error: "필수 파라미터 누락" }), { status: 400 });
        }

        // 상태 업데이트
        await context.env.DB.prepare("UPDATE waitlist SET status = ? WHERE id = ?").bind(status, id).run();

        // 💡 [카카오톡 알림톡 발송 기능 확장 포인트]
        // 만약 상태가 'called'(호출됨)로 바뀌었고 phone 정보가 넘어왔다면, 여기서 team_settings를 조회하여 카톡 발송 로직을 탈 수 있습니다.
        /*
        if (status === 'called' && phone && team_name) {
            const settings = await context.env.DB.prepare("SELECT kakao_use FROM team_settings WHERE team_name = ?").bind(team_name).first();
            if (settings && settings.kakao_use === 1) {
                // 여기에 외부 알림톡 발송 API(알리고, 비즈톡 등) 호출 로직 작성
                console.log(`[카톡발송 시뮬레이션] ${phone} 번호로 입장 안내 카톡 전송 완료`);
            }
        }
        */

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
