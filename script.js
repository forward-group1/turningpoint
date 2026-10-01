// ⚠️ 請確認 LIFF ID 與 GAS 網址正確
const LIFF_ID = "2011796780-42NFl2WH";
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LINE_OFFICIAL_ACCOUNT_URL = 'https://page.line.me/885xpnyp?oat_content=url&openQrModal=true'; // 官方帳號加好友連結

document.addEventListener('DOMContentLoaded', function() {
    
    // 1. 設定日期選擇器（鎖定只能選擇明天及未來的日期）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    if (document.getElementById('bookingDate1')) document.getElementById('bookingDate1').setAttribute('min', minDate);
    if (document.getElementById('bookingDate2')) document.getElementById('bookingDate2').setAttribute('min', minDate);
    if (document.getElementById('bookingDate3')) document.getElementById('bookingDate3').setAttribute('min', minDate);

    // 2. 檢查頁面重新載入後，是否有「等待送出」的表單資料（從 LINE 登入跳回）
    checkPendingSubmission();

    // 3. 表單送出監聽
    const form = document.getElementById('consultForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault(); // 阻止預設送出

            // 收集勞務議題 (複選)
            let selectedIssues = Array.from(document.querySelectorAll('input[name="issues"]:checked'))
                                      .map(cb => cb.value);

            if (selectedIssues.length === 0) {
                alert('請至少選擇一項遇到的勞務議題！');
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

            // 打包表單資料
            const formData = {
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

            // 將表單資料暫存於 SessionStorage
            sessionStorage.setItem('pendingFormData', JSON.stringify(formData));

            // 觸發 LINE 登入流程
            handleLineAuthAndSubmit();
        });
    }
});

// 處理 LINE 登入/認證
function handleLineAuthAndSubmit() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('span').innerText = '正轉接 LINE 驗證中...';
    }

    if (typeof liff !== 'undefined') {
        liff.init({ liffId: LIFF_ID })
            .then(() => {
                if (liff.isLoggedIn()) {
                    // 若已登入，直接取得 Profile 並提交資料
                    liff.getProfile().then(profile => {
                        sendDataToGas(profile.userId);
                    }).catch(err => {
                        console.error("取得 Profile 失敗:", err);
                        sendDataToGas(''); // 拿不到 ID 依然嘗試送出表單
                    });
                } else {
                    // 若未登入，引導登入（登入完成後會刷新頁面跳回本頁）
                    liff.login({ redirectUri: window.location.href });
                }
            })
            .catch(err => {
                console.error("LIFF 初始化失敗:", err);
                alert("LINE 驗證失敗，將直接提交表單。");
                sendDataToGas('');
            });
    } else {
        // 如果無 LIFF 環境，直接送出
        sendDataToGas('');
    }
}

// 檢查是否有登入回傳後待處理的資料
function checkPendingSubmission() {
    const savedData = sessionStorage.getItem('pendingFormData');
    if (savedData && typeof liff !== 'undefined') {
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.querySelector('span').innerText = '資料傳送中...';
        }

        liff.init({ liffId: LIFF_ID })
            .then(() => {
                if (liff.isLoggedIn()) {
                    liff.getProfile().then(profile => {
                        sendDataToGas(profile.userId);
                    }).catch(() => {
                        sendDataToGas('');
                    });
                } else {
                    sendDataToGas('');
                }
            })
            .catch(() => {
                sendDataToGas('');
            });
    }
}

// 發送資料至 Google Apps Script
function sendDataToGas(clientUserId) {
    const savedDataStr = sessionStorage.getItem('pendingFormData');
    if (!savedDataStr) return;

    let formData = JSON.parse(savedDataStr);
    formData.clientUserId = clientUserId || '';

    fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.result === 'success') {
            // 清除暫存
            sessionStorage.removeItem('pendingFormData');
            alert('感謝您的申請！我們已收到您的資訊，將引導您加入官方 LINE 以便後續推播通知！');
            
            // 引導加好友或回到官方帳號
            if (typeof liff !== 'undefined' && liff.isInClient()) {
                window.location.href = LINE_OFFICIAL_ACCOUNT_URL;
            } else {
                window.location.href = LINE_OFFICIAL_ACCOUNT_URL;
            }
        } else {
            alert('送出失敗：' + (data.error || '未知錯誤'));
            resetSubmitBtn();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('網路連線異常，請重新嘗試送出。');
        resetSubmitBtn();
    });
}

function resetSubmitBtn() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').innerText = '送出申請';
    }
}
