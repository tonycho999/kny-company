export async function onRequest(context) {
    const { request, env } = context;
    const method = request.method;

    if (!env.DB) {
        return Response.json({ error: "데이터베이스 바인딩(DB)이 설정되지 않았습니다." }, { status: 500 });
    }

    try {
        if (method === "POST") {
            // 프론트엔드에서 보낸 웨이팅 접수 데이터 파싱
            const { team_name, name, phone, count, kakao_enabled } = await request.json();

            // 1. 같은 팀(행사장)에 이미 등록된 동일 번호 대기자가 있는지 확인 (어뷰징 방지)
            const exist = await env.DB.prepare(
                "SELECT * FROM waitlist WHERE team_name = ? AND phone = ? AND status = 'waiting'"
            ).bind(team_name, phone).first();

            if (exist) {
                return Response.json({ error: "이미 대기 등록된 연락처입니다." }, { status: 400 });
            }

            // 2. 현재 해당 행사장(team_name)의 오늘 대기 번호 중 가장 큰 번호 조회
            // (보통 매일 번호를 초기화하거나 계속 이어나갈 수 있습니다. 여기서는 누적으로 번호 발급)
            const maxNumberResult = await env.DB.prepare(
                "SELECT MAX(waiting_number) as maxNum FROM waitlist WHERE team_name = ?"
            ).bind(team_name).first();
            
            let nextWaitingNumber = 1;
            if (maxNumberResult && maxNumberResult.maxNum !== null) {
                nextWaitingNumber = maxNumberResult.maxNum + 1;
            }

            // 3. DB에 웨이팅 데이터 저장
            const insertResult = await env.DB.prepare(`
                INSERT INTO waitlist (team_name, name, phone, count, kakao_enabled, waiting_number, status)
                VALUES (?, ?, ?, ?, ?, ?, 'waiting')
                RETURNING id
            `).bind(team_name, name, phone, count, kakao_enabled, nextWaitingNumber).first();

            if (!insertResult) {
                return Response.json({ error: "대기 접수 중 오류가 발생했습니다." }, { status: 500 });
            }

            // 성공 시 방금 저장된 레코드의 id 반환 (프론트에서 상태 페이지로 이동할 때 사용)
            return Response.json({ success: true, id: insertResult.id });
        }

        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
