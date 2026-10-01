const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 如果網址帶有 ?bind=1 或帶有 rowId，代表是從 LIFF 進來做綁定的
    if (urlParams.get('bind') === '1' || urlParams.has('rowId')) {
        handleLiffBinding();
        return;
    }
   // 當使用者點擊彈窗按鈕，進入 LIFF 頁面後的綁定處理
function handleLiffBinding() {
    if (typeof liff === 'undefined') {
        alert('LINE SDK 載入失敗，請重新整理頁面');
        return;
    }

    liff.init({ liffId: LIFF_ID }).then(() => {
        // 1. 檢查使用者是否已登入 LINE
        if (!liff.isLoggedIn()) {
            // 關鍵修改：登入時，指定登入成功後要帶妥原網址（包含 ?bind=1&rowId=XX）重定向回來！
            liff.login({ redirectUri: window.location.href });
            return;
        }

        // 2. 已登入，取得 User Profile
        liff.getProfile().then(profile => {
            const urlParams = new URLSearchParams(window.location.search);
            const rowId = urlParams.get('rowId');

            if (!rowId) {
                alert('綁定失敗：找不到預約單 ID (rowId)');
                return;
            }

            // 3. 將 LINE User ID 更新回 GAS 試算表，並發送推播
            fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'bindLine',
                    rowId: rowId,
                    clientUserId: profile.userId
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.result === 'success') {
                    alert('LINE 帳號綁定成功！已發送確認訊息至您的 LINE。');
                    
                    // 如果是在 LINE App 內開啟，直接關閉 LIFF 視窗
                    if (liff.isInClient()) {
                        liff.closeWindow();
                    } else {
                        // 如果是在外部瀏覽器，引導前往官方帳號聊天室
                        window.location.href = 'https://page.line.me/885xpnyp';
                    }
                } else {
                    alert('綁定失敗：' + (data.error || '未知錯誤'));
                }
            })
            .catch(err => {
                console.error(err);
                alert('網路異常，綁定請求發送失敗');
            });
        }).catch(err => {
            alert('無法取得 LINE 用戶資料：' + err);
        });
    }).catch(err => {
        console.error('LIFF Init Error:', err);
        alert('LIFF 初始化失敗：' + err);
    });
}
    // 普通填表邏輯
    const form = document.getElementById('consultForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();

            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.querySelector('span').innerText = '資料處理中...';
            }

            let selectedIssues = Array.from(document.querySelectorAll('input[name="issues"]:checked')).map(cb => cb.value);
            if (selectedIssues.length === 0) {
                alert('請至少選擇一項遇到的勞務議題！');
                resetSubmitBtn();
                return;
            }

            const getRadioValue = (name) => {
                const selected = document.querySelector(`input[name="${name}"]:checked`);
                return selected ? selected.value : '';
            };

            const getBookingStr = (dateId, timeId) => {
                const d = document.getElementById(dateId).value;
                const t = document.getElementById(timeId).value;
                return (d && t) ? `${d} ${t}` : '';
            };

            const formData = {
                action: 'submitForm',
                companyName: document.getElementById('companyName').value,
                userName: document.getElementById('userName').value,
                jobTitle: document.getElementById('jobTitle').value,
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                industry: document.getElementById('industry').value,
                companySize: getRadioValue('companySize'),
                issues: selectedIssues.join(', '),
                description: document.getElementById('description').value,
                pastExperience: getRadioValue('pastExperience'),
                externalConsultant: getRadioValue('externalConsultant'),
                booking1: getBookingStr('bookingDate1', 'bookingTime1'),
                booking2: getBookingStr('bookingDate2', 'bookingTime2'),
                booking3: getBookingStr('bookingDate3', 'bookingTime3')
            };

            // 送出表單資料到 GAS
            fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(formData)
            })
            .then(res => res.json())
            .then(data => {
                if (data.result === 'success') {
                    // 將 rowId 與 bind 標記帶入 LIFF 連結中
                    const bindUrl = `${LIFF_URL}?bind=1&rowId=${data.rowId}`;
                    document.getElementById('lineBindBtn').href = bindUrl;
                    
                    // 顯示成功彈窗
                    document.getElementById('successModal').style.display = 'flex';
                } else {
                    alert('送出失敗：' + (data.error || '未知錯誤'));
                    resetSubmitBtn();
                }
            })
            .catch(err => {
                console.error(err);
                alert('網路連線異常，請重新嘗試。');
                resetSubmitBtn();
            });
        });
    }
});



function resetSubmitBtn() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').innerText = '送出申請';
    }
}
