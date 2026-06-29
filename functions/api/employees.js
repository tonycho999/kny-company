export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    if (!env.DB) {
        return Response.json({ error: "데이터베이스 바인딩(DB)이 설정되지 않았습니다." }, { status: 500 });
    }

    try {
        if (method === "GET") {
            // DB 컬럼명에 맞게 조회
            const { results } = await env.DB.prepare(
                "SELECT employee_id, name, team_name, phone, email, status FROM employees ORDER BY team_name ASC, employee_id ASC"
            ).all();
            return Response.json(results);
        }

        if (method === "POST") {
            // 프론트엔드에서 보내는 변수명과 일치
            const { employee_id, name, team_name, phone, email } = await request.json();
            
            const exist = await env.DB.prepare("SELECT * FROM employees WHERE employee_id = ?").bind(employee_id).first();
            if (exist) {
                return Response.json({ error: "이미 존재하는 사원번호입니다." }, { status: 400 });
            }

            // DB 컬럼명에 맞게 INSERT
            await env.DB.prepare(
                "INSERT INTO employees (employee_id, name, team_name, phone, email) VALUES (?, ?, ?, ?, ?)"
            ).bind(employee_id, name, team_name, phone, email).run();

            return Response.json({ success: true });
        }

        if (method === "PUT") {
            // 퇴사/재직 상태 변경
            const { employee_id, status } = await request.json();
            await env.DB.prepare(
                "UPDATE employees SET status = ? WHERE employee_id = ?"
            ).bind(status, employee_id).run();
            return Response.json({ success: true });
        }

        if (method === "DELETE") {
            // URL 파라미터에서 employee_id 가져오기
            const employee_id = url.searchParams.get("employee_id");
            await env.DB.prepare(
                "DELETE FROM employees WHERE employee_id = ?"
            ).bind(employee_id).run();
            return Response.json({ success: true });
        }

        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
