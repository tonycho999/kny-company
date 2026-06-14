export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    if (!env.DB) {
        return Response.json({ error: "데이터베이스 바인딩(DB)이 설정되지 않았습니다." }, { status: 500 });
    }

    try {
        if (method === "GET") {
            const { results } = await env.DB.prepare(
                "SELECT employee_id as employeeId, name, contact, team, status FROM Employees ORDER BY team ASC, employee_id ASC"
            ).all();
            return Response.json(results);
        }

        if (method === "POST") {
            const { employeeId, name, contact, team } = await request.json();
            
            const exist = await env.DB.prepare("SELECT * FROM Employees WHERE employee_id = ?").bind(employeeId).first();
            if (exist) {
                return Response.json({ error: "이미 존재하는 사원번호입니다." }, { status: 400 });
            }

            await env.DB.prepare(
                "INSERT INTO Employees (employee_id, name, contact, team) VALUES (?, ?, ?, ?)"
            ).bind(employeeId, name, contact, team).run();
            return Response.json({ success: true });
        }

        if (method === "PUT") {
            const { employeeId, status } = await request.json();
            await env.DB.prepare(
                "UPDATE Employees SET status = ? WHERE employee_id = ?"
            ).bind(status, employeeId).run();
            return Response.json({ success: true });
        }

        if (method === "DELETE") {
            const employeeId = url.searchParams.get("employeeId");
            await env.DB.prepare(
                "DELETE FROM Employees WHERE employee_id = ?"
            ).bind(employeeId).run();
            return Response.json({ success: true });
        }

        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
