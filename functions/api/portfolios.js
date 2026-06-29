export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    // 1. D1 데이터베이스 바인딩 확인
    if (!env.DB) {
        return Response.json({ error: "데이터베이스 바인딩(DB)이 설정되지 않았습니다. Cloudflare 대시보드 환경 변수 설정을 확인하세요." }, { status: 500 });
    }

    try {
        // [GET] 포트폴리오 목록 조회
        if (method === "GET") {
            const { results } = await env.DB.prepare(
                "SELECT * FROM portfolios ORDER BY created_at DESC"
            ).all();
            return Response.json(results);
        }

        // [POST] 포트폴리오 신규 등록
        if (method === "POST") {
            const { title, content } = await request.json();
            
            // 필수 값 체크
            if (!title || !content) {
                return Response.json({ error: "타이틀과 내용을 모두 입력해야 합니다." }, { status: 400 });
            }

            await env.DB.prepare(
                "INSERT INTO portfolios (title, content) VALUES (?, ?)"
            ).bind(title, content).run();
            
            return Response.json({ success: true });
        }

        // [PUT] 포트폴리오 데이터 수정
        if (method === "PUT") {
            const { id, title, content } = await request.json();
            
            if (!id || !title) {
                 return Response.json({ error: "수정할 대상을 찾을 수 없거나 타이틀이 없습니다." }, { status: 400 });
            }

            await env.DB.prepare(
                "UPDATE portfolios SET title = ?, content = ? WHERE id = ?"
            ).bind(title, content, id).run();
            
            return Response.json({ success: true });
        }

        // [DELETE] 포트폴리오 데이터 삭제
        if (method === "DELETE") {
            const id = url.searchParams.get("id");
            
            if (!id) {
                return Response.json({ error: "삭제할 대상을 찾을 수 없습니다." }, { status: 400 });
            }

            await env.DB.prepare(
                "DELETE FROM portfolios WHERE id = ?"
            ).bind(id).run();
            
            return Response.json({ success: true });
        }

        // 허용되지 않은 메서드 호출 시
        return new Response("Method Not Allowed", { status: 405 });
        
    } catch (e) {
        // [핵심] D1 에러가 발생하면 에러 내용을 그대로 프론트엔드로 전달합니다.
        console.error("D1 Database Error:", e.message);
        return Response.json({ error: e.message }, { status: 500 });
    }
}
