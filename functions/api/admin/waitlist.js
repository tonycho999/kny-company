export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    if (!env.DB) {
        return Response.json({ error: "데이터베이스 바인딩(DB)이 설정되지 않았습니다." }, { status: 500 });
    }

    try {
        // 1. 특정 행사장의 대기열 목록 조회
        if (method === "GET") {
            const teamName = url.searchParams.get("teamName");
            if (!teamName) {
                return Response.json({ error: "행사장(팀명)이 필요합니다." }, { status: 400 });
            }

            // 오늘 날짜 데이터만 가져오거나 전체를 가져오도록 쿼리 작성
            // 우선 해당 팀의 전체 대기열을 번호 순서대로 가져옵니다.
            const { results } = await env.DB.prepare(
                "SELECT * FROM waitlist WHERE team_name = ? ORDER BY waiting_number ASC"
            ).bind(teamName).all();

            return Response.json(results);
        }

        // 2. 관리자가 호출(called) 또는 완료(completed) 버튼을 눌렀을 때 상태 업데이트
        if (method === "PUT") {
            const { id, status } = await request.json();
            
            await env.DB.prepare(
                "UPDATE waitlist SET status = ? WHERE id = ?"
            ).bind(status, id).run();

            return Response.json({ success: true });
        }

        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
