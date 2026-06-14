document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const date = urlParams.get('date');
    const team = urlParams.get('team');
    const token = urlParams.get('token');

    // 1. QR코드로 접속했을 때 파라미터들을 가로채 세션에 은밀히 저장 후 주소창 세척
    if (date && team && token) {
        sessionStorage.setItem('qr_date', date);
        sessionStorage.setItem('qr_team', team);
        sessionStorage.setItem('qr_token', token);
        // 주소창을 깔끔하게 https://kny-company.pages.dev/attendance/ 로 청소
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const currentTeam = sessionStorage.getItem('qr_team');
    const badge = document.getElementById('teamDisplay');
    
    if (!currentTeam) {
        if(badge) badge.innerText = "❌ 올바르지 않은 접근 (QR 필요)";
        document.getElementById('employeeId').disabled = true;
        return;
    }

    if(badge) badge.innerText = `허가 팀: ${currentTeam}`;

    const btnIn = document.getElementById('btn-in');
    const btnOut = document.getElementById('btn-out');

    if (btnIn) btnIn.addEventListener('click', () => handleAttendance('in'));
    if (btnOut) btnOut.addEventListener('click', () => handleAttendance('out'));
});

async function handleAttendance(type) {
    const employeeIdInput = document.getElementById('employeeId');
    const messageDiv = document.getElementById('message');
    const employeeId = employeeIdInput.value.trim();
    
    const date = sessionStorage.getItem('qr_date');
    const team = sessionStorage.getItem('qr_team');
    const token = sessionStorage.getItem('qr_token');
    
    if (!employeeId) {
        messageDiv.style.color = '#e74c3c';
        messageDiv.innerText = '⚠️ 사원번호를 입력해주세요.';
        return;
    }

    messageDiv.style.color = '#7f8c8d';
    messageDiv.innerText = '인증 확인 중...';

    try {
        const response = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, type, date, team, token })
        });

        const result = await response.json();

        if (response.ok) {
            messageDiv.style.color = '#2ecc71';
            messageDiv.innerText = `✅ ${result.name}님, ${type === 'in' ? '출근' : '퇴근'} 완료.`;
            employeeIdInput.value = '';
        } else {
            messageDiv.style.color = '#e74c3c';
            messageDiv.innerText = `❌ 오류: ${result.error || '기록 실패'}`;
        }
    } catch (error) {
        messageDiv.style.color = '#e74c3c';
        messageDiv.innerText = '📡 네트워크 또는 서버 연결에 실패했습니다.';
    }
}
