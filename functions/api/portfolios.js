export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    if (!env.DB) {
        return Response.json({ error: "DB Binding Error" }, { status: 500 });
    }

    try {
        if (method === "GET") {
            const { results } = await env.DB.prepare(
                "SELECT * FROM portfolios ORDER BY created_at DESC"
            ).all();
            return Response.json(results);
        }

        if (method === "POST") {
            const body = await request.json();
            await env.DB.prepare(
                "INSERT INTO portfolios (title, content) VALUES (?, ?)"
            ).bind(body.title, body.content).run();
            return Response.json({ success: true });
        }

        if (method === "PUT") {
            const body = await request.json();
            await env.DB.prepare(
                "UPDATE portfolios SET title = ?, content = ? WHERE id = ?"
            ).bind(body.title, body.content, body.id).run();
            return Response.json({ success: true });
        }

        if (method === "DELETE") {
            const id = url.searchParams.get("id");
            await env.DB.prepare(
                "DELETE FROM portfolios WHERE id = ?"
            ).bind(id).run();
            return Response.json({ success: true });
        }

        return Response.json({ error: "Method Not Allowed" }, { status: 405 });
    } catch (e) {
        // 백엔드 에러 원인을 반드시 문자열로 리턴
        return Response.json({ error: String(e) }, { status: 500 });
    }
}
