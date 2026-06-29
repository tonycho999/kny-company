export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    if (!env.DB) {
        return Response.json({ error: "DB 설정 오류" }, { status: 500 });
    }

    try {
        if (method === "GET") {
            const id = url.searchParams.get("id");
            const teamName = url.searchParams.get("teamName");

            if (!id || !teamName) {
                return Response.json({ error: "필수 정보가 없습니다." }, { status: 400 });
            }

            // 1. 현재 접속한 고객의 대기 정보(내 번호, 내 상태) 조회
            const myInfo = await env.DB.prepare(
                "SELECT waiting_number, status FROM waitlist WHERE id = ? AND team_name = ?"
            ).bind(id, teamName).first();

            if (!myInfo) {
                return Response.json({ error: "대기 정보를 찾을 수 없습니다." }, { status: 404 });
            }

            // 2. 내 앞에 대기 중인 사람(status가 'waiting'이고, 내 번호보다 작은 사람) 수 계산
            let remainTeams = 0;
            if (myInfo.status === 'waiting') {
                const countResult = await env.DB.prepare(
                    "SELECT COUNT(*) as remain FROM waitlist WHERE team_name = ? AND status = 'waiting' AND waiting_number < ?"
                ).bind(teamName, myInfo.waiting_number).first();
                
                remainTeams = countResult.remain || 0;
            }

            // 프론트엔드로 필요한 데이터만 응답
            return Response.json({
                waitingNumber: myInfo.waiting_number,
                status: myInfo.status,
                remainTeams: remainTeams
            });
        }

        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
