export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    if (!env.DB) {
        return Response.json({ error: "DB 바인딩 오류" }, { status: 500 });
    }

    try {
        // 목록 조회
        if (method === "GET") {
            const { results } = await env.DB.prepare(
                "SELECT * FROM portfolios ORDER BY created_at DESC"
            ).all();
            return Response.json(results);
        }

        // 신규 등록
        if (method === "POST") {
            const { title, content } = await request.json();
            await env.DB.prepare(
                "INSERT INTO portfolios (title, content) VALUES (?, ?)"
            ).bind(title, content).run();
            return Response.json({ success: true });
        }

        // 데이터 수정
        if (method === "PUT") {
            const { id, title, content } = await request.json();
            await env.DB.prepare(
                "UPDATE portfolios SET title = ?, content = ? WHERE id = ?"
            ).bind(title, content, id).run();
            return Response.json({ success: true });
        }

        // 데이터 삭제
        if (method === "DELETE") {
            const id = url.searchParams.get("id");
            await env.DB.prepare(
                "DELETE FROM portfolios WHERE id = ?"
            ).bind(id).run();
            return Response.json({ success: true });
        }

        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
