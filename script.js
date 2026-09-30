// ⚠️ 請確認 LIFF ID 與 GAS 網址正確
const LIFF_ID = "2011796780-42NFl2WH";
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';

document.addEventListener('DOMContentLoaded', function() {
    
    // 1. 初始化 LIFF SDK 取得客戶 LINE User ID
    liff.init({ liffId: LIFF_ID })
        .then(() => {
            if (liff.isLoggedIn()) {
                liff.getProfile().then(profile => {
                    const userId = profile.userId;
                    const clientInput = document.getElementById('clientUserId');
                    if (clientInput) {
                        clientInput.value = userId;
                    }
                    console.log("成功取得 LINE User ID:", userId);
                }).catch(err => console.error("取得 Profile 失敗:", err));
            } else {
                liff.login(); // 引導登入
            }
        })
        .catch(err => console.error("LIFF 初始化失敗:", err));

  document.addEventListener("DOMContentLoaded", function () {
    // 鎖定只能選擇明天及未來的日期
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    document.getElementById('bookingDate1').setAttribute('min', minDate);
    document.getElementById('bookingDate2').setAttribute('min', minDate);
    document.getElementById('bookingDate3').setAttribute('min', minDate);
});
    // 3. 表單送出監聽
    const form = document.getElementById('consultForm');
    const submitBtn = document.getElementById('submitBtn');

    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault(); // 阻止表單預設刷新

            // 鎖定按鈕避免重複提交
            submitBtn.disabled = true;
            submitBtn.querySelector('span').innerText = '資料送出中...';

            // 收集勞務議題 (複選)
            let selectedIssues = Array.from(document.querySelectorAll('input[name="issues"]:checked'))
                                      .map(cb => cb.value);

            // 收集單選題 (Radio) Helper
            const getRadioValue = (name) => {
                const selected = document.querySelector(`input[name="${name}"]:checked`);
                return selected ? selected.value : '';
            };

            // 取得隱藏欄位中的 clientUserId
            const clientUserIdVal = document.getElementById('clientUserId') ? document.getElementById('clientUserId').value : '';

            if (selectedIndustries.length === 0) {
    alert('還沒填寫完成再檢查一下吧!');
    submitBtn.disabled = false;
    submitBtn.querySelector('span').innerText = '送出試用申請';
    return;
}

if (selectedIssues.length === 0) {
    alert('請至少選擇一項遇到的勞務議題！');
    submitBtn.disabled = false;
    submitBtn.querySelector('span').innerText = '送出試用申請';
    return;
}

            // 打包 JSON 物件 (包含帶給 GAS 發送給客戶的 clientUserId)
            const formData = {
                clientUserId: clientUserIdVal, // 👈 補上 critical 欄位
                companyName: document.getElementById('companyName').value,
                userName: document.getElementById('userName').value,
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                industry: selectedIndustries.join(', '),
                companySize: getRadioValue('companySize'),
                issues: selectedIssues.join(', '),
                description: document.getElementById('description').value,
                pastExperience: getRadioValue('pastExperience'),
                externalConsultant: getRadioValue('externalConsultant'),
                booking1: `${document.getElementById('bookingDate1').value} ${document.getElementById('bookingTime1').value}`,
                booking2: `${document.getElementById('bookingDate2').value} ${document.getElementById('bookingTime2').value}`,
                booking3: `${document.getElementById('bookingDate3').value} ${document.getElementById('bookingTime3').value}`
            };

    // 發送資料至 Google Apps Script
fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'text/plain;charset=utf-8' // 使用 text/plain 避開 CORS 預檢，同時能完整傳送 JSON
    },
    body: JSON.stringify(formData)
})
.then(response => response.json())
.then(data => {
    if (data.result === 'success') {
        alert('感謝您的申請！我們已收到您的資訊，並已發送預約確認訊息至您的 LINE 聊天室！');
        
        // 若在 LINE App 內開啟，自動關閉 LIFF 視窗回到聊天室
        if (typeof liff !== 'undefined' && liff.isInClient()) {
            liff.closeWindow();
        } else {
            // 若在外部瀏覽器開啟，跳轉回官方 LINE 聊天室
            window.location.href = 'https://page.line.me/885xpnyp?oat_content=url&openQrModal=true'; 
        }
    } else {
        alert('送出失敗：' + (data.error || '未知錯誤'));
    }
})
.catch(error => {
    console.error('Error:', error);
    // 即使前端跨域攔截，若 GAS 有收到資料依然會執行發送
    alert('申請已送出!我們會在3個工作天內與您聯繫。');
})
.finally(() => {
    // 恢復按鈕狀態
    submitBtn.disabled = false;
    submitBtn.querySelector('span').innerText = '送出試用申請';
});
        });
    }
});
