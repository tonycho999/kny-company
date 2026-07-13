export async function onRequest(context) {
    const { request, env } = context;
    const method = request.method;

    if (!env.DB) return Response.json({ error: "DB 오류" }, { status: 500 });

    try {
        if (method === "POST") {
            const { team_name, name, phone, count, kakao_enabled } = await request.json();

            // 1. 설정 검사 (최대 대기 인원 제한 확인)
            const settings = await env.DB.prepare("SELECT * FROM team_settings WHERE team_name = ?").bind(team_name).first();
            
            if (settings && settings.max_wait_use === 1) {
                // 현재 대기 중인 사람 수 계산 (오늘 날짜 기준)
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

            // 2. 어뷰징 방지
            const exist = await env.DB.prepare(
                "SELECT * FROM waitlist WHERE team_name = ? AND phone = ? AND status = 'waiting' AND date(created_at, '+9 hours') = date('now', '+9 hours')"
            ).bind(team_name, phone).first();
            if (exist) return Response.json({ error: "이미 대기 등록된 연락처입니다." }, { status: 400 });

            // 3. 날짜별 대기 번호 부여 로직 및 내 앞 대기팀 수 계산
            const maxNumberResult = await env.DB.prepare(`
                SELECT MAX(waiting_number) as maxNum, COUNT(id) as waitCount 
                FROM waitlist 
                WHERE team_name = ? AND date(created_at, '+9 hours') = date('now', '+9 hours')
            `).bind(team_name).first();
            
            let nextWaitingNumber = 1;
            let teamsAhead = 0; // 내 앞 대기팀 수
            
            if (maxNumberResult && maxNumberResult.maxNum !== null) {
                nextWaitingNumber = maxNumberResult.maxNum + 1;
                // 현재 대기 중인(waiting) 사람만 카운트
                const aheadCount = await env.DB.prepare(
                    "SELECT COUNT(*) as cnt FROM waitlist WHERE team_name = ? AND status = 'waiting' AND date(created_at, '+9 hours') = date('now', '+9 hours')"
                ).bind(team_name).first();
                teamsAhead = aheadCount ? aheadCount.cnt : 0;
            }

            // 4. 저장
            const insertResult = await env.DB.prepare(`
                INSERT INTO waitlist (team_name, name, phone, count, kakao_enabled, waiting_number, status)
                VALUES (?, ?, ?, ?, ?, ?, 'waiting')
                RETURNING id
            `).bind(team_name, name, phone, count, kakao_enabled, nextWaitingNumber).first();

            // 💡 5. 카카오톡 알림톡 발송 (행사장이 카톡 사용 설정 & 손님이 수신 동의한 경우)
            if (settings && settings.kakao_use === 1 && kakao_enabled === 1) {
                // 비즈엠 계정 아이디 (🔥스윗트래커 비즈엠 로그인 아이디를 여기에 반드시 입력하세요!)
                const BIZM_USERID = "knycompany"; 
                
                // 고객 폰 번호의 하이픈 제거 및 국제번호 변환 (01012345678 -> 821012345678)
                let cleanPhone = phone.replace(/-/g, '');
                if (cleanPhone.startsWith('0')) {
                    cleanPhone = '82' + cleanPhone.substring(1);
                }
                
                // 알림톡 템플릿 변수에 맞게 메시지 구성
                const kakaoMsg = `${name}님, 현장 대기 접수가 완료되었습니다.\n\n■ 대기 번호: ${nextWaitingNumber}\n■ 내 앞 대기: ${teamsAhead}팀\n■ 대기 인원: ${count}명\n\n입장 차례가 다가오면 다시 카카오톡으로 알려드립니다. 행사장 주변에서 대기해 주시기 바랍니다.\n\n※ 대기 시간이 길어질 수 있으며, 마감 시간 임박 시 입장이 제한될 수 있습니다.`;

                const payload = [{
                    "message_type": "at", // at: 알림톡
                    "phn": cleanPhone,
                    "profile": "e58dde367b164d7ad7b421cf0e15902ec3f244e2", // 발신프로필키
                    "tmplId": "WAIT_REG_01", // 템플릿코드
                    "msg": kakaoMsg,
                    "reserveDt": "00000000000000" // 즉시 발송
                }];

                try {
                    await fetch('https://alimtalk-api.bizmsg.kr/v2/sender/send', {
                        method: 'POST',
                        headers: { 
                            'Content-type': 'application/json', 
                            'userid': BIZM_USERID 
                        },
                        body: JSON.stringify(payload)
                    });
                } catch (e) {
                    console.error("접수 알림톡 실패", e);
                    // 실패해도 대기 접수는 정상 처리되도록 에러 무시
                }
            }

            return Response.json({ success: true, id: insertResult.id });
        }
        return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
