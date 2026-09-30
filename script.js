document.addEventListener('DOMContentLoaded', function() {
    // 取得明天的日期字串 (YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    // 鎖定三個日期輸入框的 min 屬性
    document.getElementById('bookingDate1').setAttribute('min', minDate);
    document.getElementById('bookingDate2').setAttribute('min', minDate);
    document.getElementById('bookingDate3').setAttribute('min', minDate);
    const form = document.getElementById('consultForm');
    const submitBtn = document.getElementById('submitBtn');

    // ⚠️ 請在此處貼上您從 Google Apps Script 取得的部署 URL
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';

    form.addEventListener('submit', function(e) {
        e.preventDefault(); // 阻止表單預設重新整理行為

        // 鎖定按鈕避免重複提交
        submitBtn.disabled = true;
        submitBtn.querySelector('span').innerText = '資料送出中...';

        // 收集產業類別 (複選 + 其他)
        let selectedIndustries = Array.from(document.querySelectorAll('input[name="industry"]:checked'))
                                     .map(cb => cb.value);
        const otherIndustry = document.getElementById('otherIndustry').value.trim();
        if (otherIndustry) {
            selectedIndustries.push(`其他: ${otherIndustry}`);
        }

        // 收集勞務議題 (複選)
        let selectedIssues = Array.from(document.querySelectorAll('input[name="issues"]:checked'))
                                  .map(cb => cb.value);

        // 收集單選題 (Radio)
        const getRadioValue = (name) => {
            const selected = document.querySelector(`input[name="${name}"]:checked`);
            return selected ? selected.value : '';
        };

        // 在表單送出處理邏輯中加入這段驗證
        function validateBookingTimes() {
            for (let i = 1; i <= 3; i++) {
                const timeInput = document.getElementById(`bookingTime${i}`).value;
                if (timeInput) {
                    const [hours, minutes] = timeInput.split(':').map(Number);
                    // 檢查時間是否在 09:00 至 18:00 之間
                    if (hours < 9 || hours > 18 || (hours === 18 && minutes > 0)) {
                alert(`第 ${i} 個預約時段請選擇 09:00 至 18:00 之間的時間！`);
                return false;
            }
        }
    }
    return true;
}


let clientLineUserId = "";

// 網頁載入時初始化 LIFF
document.addEventListener("DOMContentLoaded", function() {
    liff.init({ liffId: "填入你的_LIFF_ID" })
        .then(() => {
            if (liff.isLoggedIn()) {
                liff.getProfile().then(profile => {
                    clientLineUserId = profile.userId; // 取得填表客戶的 User ID
                });
            } else {
                liff.login(); // 若未登入則引導登入
            }
        })
        .catch((err) => {
            console.error("LIFF 初始化失敗", err);
        });
});

// 送出按鈕點擊時：
if (!validateBookingTimes()) {
    return; // 阻止表單送出
}


        // 打包 JSON 物件
        const formData = {
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
            booking3: `${document.getElementById('bookingDate3').value} ${document.getElementById('bookingTime3').value}`,

        };

        // 發送資料至 Google Apps Script
        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', // 使用 no-cors 避免跨網域預檢問題
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(() => {
           // 成功提示與跳轉至 LINE 官方帳號
    alert('感謝您的申請！我們已收到您的資訊。點擊確定將為您開啟官方 LINE，您可以直接發送訊息與顧問確認！');
    
    // 官方LINE帳號的加入好友連結
    window.location.href = 'https://page.line.me/885xpnyp?oat_content=url&openQrModal=true'; 
})
        .catch(error => {
            console.error('Error:', error);
            alert('送出失敗，請稍微再試一次或直接與我們電話聯繫。');
        })
        .finally(() => {
            // 恢復按鈕狀態
            submitBtn.disabled = false;
            submitBtn.querySelector('span').innerText = '送出試用申請';
        });
    });
});
