document.addEventListener('DOMContentLoaded', () => {
    // [1] 출퇴근 기록 조회 페이지 로직 실행 조건 검사
    const datePicker = document.getElementById('datePicker');
    if (datePicker) {
        // 오늘 날짜 기본 세팅 (한국 시간 기준 연월일)
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const localDate = new Date(today.getTime() - offset).toISOString().split('T')[0];
        datePicker.value = localDate;

        // 날짜가 변경될 때마다 데이터 재호출
        datePicker.addEventListener('change', (e) => loadAttendance(e.target.value));
        loadAttendance(localDate); // 첫 로딩 시 자동 호출
    }

    // [2] 직원 관리 설정 페이지 로직 실행 조건 검사
    const employeeForm = document.getElementById('employee-form');
    if (employeeForm) {
        employeeForm.addEventListener('submit', addEmployee);
        loadEmployees(); // 등록된 직원 목록 가져오기
    }
});

// --- [출퇴근 기록 관련 함수] ---
async function loadAttendance(date) {
    const tbody = document.getElementById('attendance-body');
    if (!tbody) return;

    try {
        const response = await fetch(`/api/attendance?date=${date}`);
        const list = await response.json();

        tbody.innerHTML = '';
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #7f8c8d;">해당 날짜에 출퇴근 기록이 없습니다.</td></tr>';
            return;
        }

        list.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.employeeId}</td>
                <td>${item.name}</td>
                <td>${item.contact}</td>
                <td>${item.clockIn ? item.clockIn : '-'}</td>
                <td>${item.clockOut ? item.clockOut : '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">기록을 불러오는 도중 오류가 발생했습니다.</td></tr>';
    }
}

// --- [직원 관리 관련 함수] ---
async function loadEmployees() {
    const tbody = document.getElementById('employee-body');
    if (!tbody) return;

    try {
        const response = await fetch('/api/employees');
        const employees = await response.json();

        tbody.innerHTML = '';
        if (employees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #7f8c8d;">등록된 직원이 없습니다.</td></tr>';
            return;
        }

        employees.forEach(emp => {
            const tr = document.createElement('tr');
            const isWorking = emp.status === '재직';
            const statusClass = isWorking ? 'status-active' : 'status-retired';
            
            // 상태에 맞춰 버튼 텍스트 토글 (재직 -> 퇴사처리, 퇴사 -> 복직처리)
            const statusBtnText = isWorking ? '퇴사처리' : '복직처리';

            tr.innerHTML = `
                <td>${emp.employeeId}</td>
                <td>${emp.name}</td>
                <td>${emp.contact}</td>
                <td><span class="${statusClass}">${emp.status}</span></td>
                <td>
                    <button class="btn-sm btn-status-change" onclick="changeStatus('${emp.employeeId}', '${isWorking ? '퇴사' : '재직'}')">${statusBtnText}</button>
                    <button class="btn-sm btn-delete" onclick="deleteEmployee('${emp.employeeId}')">삭제</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">직원 목록을 불러오는 도중 오류가 발생했습니다.</td></tr>';
    }
}

// 직원 추가 함수
async function addEmployee(e) {
    e.preventDefault();
    const employeeId = document.getElementById('empId').value.trim();
    const name = document.getElementById('empName').value.trim();
    const contact = document.getElementById('empContact').value.trim();

    try {
        const response = await fetch('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, name, contact })
        });

        const result = await response.json();

        if (response.ok) {
            alert('직원이 정상적으로 등록되었습니다.');
            document.getElementById('employee-form').reset();
            loadEmployees();
        } else {
            alert(`등록 실패: ${result.error}`);
        }
    } catch (error) {
        alert('서버 통신 중 오류가 발생했습니다.');
    }
}

// 퇴사/복직 처리 함수
async function changeStatus(employeeId, newStatus) {
    if (!confirm(`해당 직원을 [${newStatus}] 처리하시겠습니까?`)) return;

    try {
        const response = await fetch('/api/employees', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, status: newStatus })
        });

        if (response.ok) {
            loadEmployees();
        } else {
            const result = await response.json();
            alert(`수정 실패: ${result.error}`);
        }
    } catch (error) {
        alert('서버 통신 중 오류가 발생했습니다.');
    }
}

// 완전 삭제 함수
async function deleteEmployee(employeeId) {
    if (!confirm('직원 정보를 완전히 삭제하시겠습니까?\n(기존 출퇴근 기록 연동에 영향을 줄 수 있습니다.)')) return;

    try {
        const response = await fetch(`/api/employees?employeeId=${employeeId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadEmployees();
        } else {
            const result = await response.json();
            alert(`삭제 실패: ${result.error}`);
        }
    } catch (error) {
        alert('서버 통신 중 오류가 발생했습니다.');
    }
}

// HTML 내의 onclick 호출용 전역 바인딩
window.changeStatus = changeStatus;
window.deleteEmployee = deleteEmployee;
