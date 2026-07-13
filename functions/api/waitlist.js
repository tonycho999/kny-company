export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const teamName = url.searchParams.get("teamName");
    const targetDate = url.searchParams.get("date"); 

    if (!teamName || !targetDate) {
        return new Response(JSON.stringify({ error: "팀 이름과 날짜 파라미터가 필요합니다." }), { status: 400 });
    }

    try {
        const query = `
            SELECT * FROM waitlist 
            WHERE team_name = ? AND date(created_at, '+9 hours') = ? 
            ORDER BY waiting_number ASC
        `;
        
        const { results } = await context.env.DB.prepare(query).bind(teamName, targetDate).all();
        
        return new Response(JSON.stringify(results), { 
            headers: { 'Content-Type': 'application/json' } 
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestPut(context) {
    try {
        const { id, status, phone, team_name } = await context.request.json();
        
        if (!id || !status) {
            return new Response(JSON.stringify({ error: "필수 파라미터 누락" }), { status: 400 });
        }

        // 💡 1. 상태 업데이트 및 호출 횟수(call_count) 증가
        if (status === 'called') {
            await context.env.DB.prepare(`
                UPDATE waitlist 
                SET status = ?, call_count = IFNULL(call_count, 0) + 1 
                WHERE id = ?
            `).bind(status, id).run();
        } else {
            await context.env.DB.prepare(`
                UPDATE waitlist 
                SET status = ? 
                WHERE id = ?
            `).bind(status, id).run();
        }

        // 💡 2. 카카오톡 알림톡 발송 (상태가 '호출됨'으로 바뀌었을 때만)
        if (status === 'called' && phone && team_name) {
            // 행사장의 카카오톡 사용 설정 확인
            const settings = await context.env.DB.prepare("SELECT kakao_use FROM team_settings WHERE team_name = ?").bind(team_name).first();
            
            // 고객의 정보(이름, 대기번호, 인원수, 카톡 수신 동의 여부) 조회
            const customer = await context.env.DB.prepare("SELECT name, waiting_number, count, kakao_enabled FROM waitlist WHERE id = ?").bind(id).first();

            // 행사장 설정 ON & 고객 동의 ON 일 때만 발송
            if (settings && settings.kakao_use === 1 && customer && customer.kakao_enabled === 1) {
                
                const BIZM_USERID = "knycompany"; 
                
                // 고객 전화번호 국제규격 변환 (010 -> 8210)
                let cleanPhone = phone.replace(/-/g, '');
                if (cleanPhone.startsWith('0')) {
                    cleanPhone = '82' + cleanPhone.substring(1);
                }

                // 템플릿 변수에 맞게 메시지 조합
                const kakaoMsg = `${customer.name}님, 곧 입장 차례입니다!\n\n지금 바로 행사장 입구(안내데스크)로 와주시기 바랍니다.\n\n■ 대기 번호: ${customer.waiting_number}\n■ 입장 인원: ${customer.count}명\n\n※ 주의사항\n알림을 받으신 후 5분 이내에 입구에 안 계실 경우, 다음 대기자에게 순서가 넘어가 자동 취소될 수 있으니 신속히 이동해 주세요!`;

                const payload = [{
                    "message_type": "at",
                    "phn": cleanPhone,
                    "profile": "e58dde367b164d7ad7b421cf0e15902ec3f244e2",
                    "tmplId": "WAIT_CALL_01",
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
                    console.error("호출 알림톡 실패", e);
                    // 실패해도 DB 처리에는 영향을 주지 않도록 무시
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
