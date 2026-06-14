export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    try {
        // [GET] 직원 목록 조회
        if (method === "GET") {
            const { results } = await env.DB.prepare(
                "SELECT employee_id as employeeId, name, contact, status FROM Employees ORDER BY employee_id ASC"
            ).all();
            return Response.json(results);
        }

        // [POST] 신규 직원 추가
        if (method === "POST") {
            const { employeeId, name, contact } = await request.json();
            
            // 중복 확인
            const exist = await env.DB.prepare("SELECT * FROM Employees WHERE employee_id = ?").bind(employeeId).first();
            if (exist) {
                return Response.json({ error: "이미 존재하는 사원번호입니다." }, { status: 400 });
            }

            await env.DB.prepare(
                "INSERT INTO Employees (employee_id, name, contact) VALUES (?, ?, ?)"
            ).bind(employeeId, name, contact).run();
            
            return Response.json({ success: true });
        }

        // [PUT] 직원 상태 수정 (재직 <-> 퇴사)
        if (method === "PUT") {
            const { employeeId, status } = await request.json();
            await env.DB.prepare(
                "UPDATE Employees SET status = ? WHERE employee_id = ?"
            ).bind(status, employeeId).run();
            
            return Response.json({ success: true });
        }

        // [DELETE] 직원 완전 삭제
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
