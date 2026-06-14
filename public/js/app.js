document.addEventListener('DOMContentLoaded', () => {
    const btnIn = document.getElementById('btn-in');
    const btnOut = document.getElementById('btn-out');

    if (btnIn) btnIn.addEventListener('click', () => handleAttendance('in'));
    if (btnOut) btnOut.addEventListener('click', () => handleAttendance('out'));
});

async function handleAttendance(type) {
    const employeeIdInput = document.getElementById('employeeId');
    const messageDiv = document.getElementById('message');
    const employeeId = employeeIdInput.value.trim();
    
    // URL에서 QR 날짜 파라미터 추출
    const urlParams = new URLSearchParams(window.location.search);
    const date = urlParams.get('date');
    
    if (!employeeId) {
        messageDiv.style.color = '#e74c3c';
        messageDiv.innerText = '⚠️ 사원번호를 입력해주세요.';
        return;
    }

    messageDiv.style.color = '#7f8c8d';
    messageDiv.innerText = '처리 중...';

    try {
        const response = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, type, date })
        });

        const result = await response.json();

        if (response.ok) {
            messageDiv.style.color = '#2ecc71';
            messageDiv.innerText = `✅ ${result.name}님, ${type === 'in' ? '출근' : '퇴근'} 처리가 완료되었습니다.`;
            employeeIdInput.value = '';
        } else {
            messageDiv.style.color = '#e74c3c';
            messageDiv.innerText = `❌ 오류: ${result.error || '기록 실패'}`;
        }
    } catch (error) {
        messageDiv.style.color = '#e74c3c';
        messageDiv.innerText = '📡 서버 연결 실패. 네트워크를 확인해주세요.';
    }
}
