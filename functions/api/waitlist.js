export async function onRequest(context) {
    const { request, env } = context;
    const method = request.method;

    if (!env.DB) return Response.json({ error: "DB 연결 실패" }, { status: 500 });

    try {
        if (method === "POST") {
            const { team_name, name, phone, count, kakao_enabled } = await request.json();

            let settings = null;
            try { settings = await env.DB.prepare("SELECT * FROM team_settings WHERE team_name = ?").bind(team_name).first(); } catch (e) {}
            
            if (settings && settings.max_wait_use === 1) {
                const currentWaiting = await env.DB.prepare(`
                    SELECT SUM(count) as totalPeople FROM waitlist 
                    WHERE team_name = ? AND status = 'waiting' 
                    AND date(created_at, '+9 hours') = date('now', '+9 hours')
                `).bind(team_name).first();
                const totalCurrent = (currentWaiting && currentWaiting.totalPeople) ? currentWaiting.totalPeople : 0;
                if ((totalCurrent + count) > settings.max_wait_count) {
                    return Response.json({ error: `접수 마감 (현재 최대 ${settings.max_wait_count}명까지만 대기 가능합니다.)` }, { status: 400 });
                }
            }

            const exist = await env.DB.prepare("SELECT * FROM waitlist WHERE team_name = ? AND phone = ? AND status = 'waiting' AND date(created_at, '+9 hours') = date('now', '+9 hours')").bind(team_name, phone).first();
            if (exist) return Response.json({ error: "이미 대기 등록된 연락처입니다." }, { status: 400 });

            const maxNumberResult = await env.DB.prepare(`SELECT MAX(waiting_number) as maxNum FROM waitlist WHERE team_name = ? AND date(created_at, '+9 hours') = date('now', '+9 hours')`).bind(team_name).first();
            
            let nextWaitingNumber = 1;
            let teamsAhead = 0; 
            
            if (maxNumberResult && maxNumberResult.maxNum !== null) {
                nextWaitingNumber = maxNumberResult.maxNum + 1;
                const aheadCount = await env.DB.prepare("SELECT COUNT(id) as cnt FROM waitlist WHERE team_name = ? AND status = 'waiting' AND date(created_at, '+9 hours') = date('now', '+9 hours')").bind(team_name).first();
                teamsAhead = aheadCount ? aheadCount.cnt : 0;
            }

            const insertResult = await env.DB.prepare(`
                INSERT INTO waitlist (team_name, name, phone, count, kakao_enabled, waiting_number, status)
                VALUES (?, ?, ?, ?, ?, ?, 'waiting')
                RETURNING id
            `).bind(team_name, name, phone, count, kakao_enabled, nextWaitingNumber).first();

            // 💡 알림톡 발송부
            if (settings && settings.kakao_use === 1 && kakao_enabled === 1) {
                const BIZM_USERID = "knycompany"; 
                
                let cleanPhone = phone.replace(/-/g, '');
                if (cleanPhone.startsWith('0')) cleanPhone = '82' + cleanPhone.substring(1);
                
                // 💡 [중요] 카카오 심사 시 줄바꿈(\n)과 띄어쓰기가 1글자라도 다르면 발송 실패합니다.
                const kakaoMsg = `${name}님, 현장 대기 접수가 완료되었습니다.\n\n■ 대기 번호: ${nextWaitingNumber}\n■ 내 앞 대기: ${teamsAhead}팀\n■ 대기 인원: ${count}명\n\n입장 차례가 다가오면 다시 카카오톡으로 알려드립니다. 행사장 주변에서 대기해 주시기 바랍니다.\n\n※ 대기 시간이 길어질 수 있으며, 마감 시간 임박 시 입장이 제한될 수 있습니다.`;

                const payload = [{
                    "message_type": "at", 
                    "phn": cleanPhone,
                    "profile": "e58dde367b164d7ad7b421cf0e15902ec3f244e2", 
                    "tmplId": "WAIT_REG_01", 
                    "msg": kakaoMsg,
                    "reserveDt": "00000000000000" 
                }];

                try {
                    const bizmRes = await fetch('https://alimtalk-api.bizmsg.kr/v2/sender/send', {
                        method: 'POST',
                        headers: { 'Content-type': 'application/json', 'userid': BIZM_USERID },
                        body: JSON.stringify(payload)
                    });
                    
                    // 💡 [디버깅] 비즈엠 응답 로그를 남깁니다.
                    const bizmResult = await bizmRes.json();
                    console.log("BizM Result(REG):", JSON.stringify(bizmResult));
                } catch (e) {
                    console.error("BizM fetch error:", e);
                }
            }

            return Response.json({ success: true, id: insertResult.id });
        }
        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
    }
}
