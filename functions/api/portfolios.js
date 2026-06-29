// functions/api/portfolios.js (필요한 경우에만 추가)
export async function onRequest(context) {
    const { request, env } = context;
    if (request.method === "POST") {
        const { title, content } = await request.json();
        try {
            await env.DB.prepare(
                "INSERT INTO portfolios (title, content) VALUES (?, ?)"
            ).bind(title, content).run();
            return Response.json({ success: true });
        } catch (e) {
            return Response.json({ error: e.message }, { status: 500 });
        }
    }
    return new Response("Method Not Allowed", { status: 405 });
}
