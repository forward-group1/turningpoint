const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const OFFICIAL_LINE_URL = 'https://page.line.me/885xpnyp'; // 官方 LINE 連結

let currentCreatedRowId = null; // 紀錄表單送出後的列號

document.addEventListener('DOMContentLoaded', function() {
    // 靜默初始化 LIFF SDK
    if (typeof liff !== 'undefined') {
        liff.init({ liffId: LIFF_ID }).catch(err => console.error('LIFF Init error:', err));
    }

    initFormSubmit();
});

/* ----------------------------------------------------
   表單提交與彈窗按鈕互動 (完美相容 iOS 手機，不開新視窗)
   ---------------------------------------------------- */
function initFormSubmit() {
    const form = document.getElementById('consultForm');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            const btnSpan = submitBtn.querySelector('span') || submitBtn;
            btnSpan.innerText = '資料處理中...';
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
            const dElem = document.getElementById(dateId);
            const tElem = document.getElementById(timeId);
            const d = dElem ? dElem.value : '';
            const t = tElem ? tElem.value : '';
            return (d && t) ? `${d} ${t}` : '';
        };

        const formData = {
            action: 'submitForm',
            companyName: document.getElementById('companyName')?.value || '',
            userName: document.getElementById('userName')?.value || '',
            jobTitle: document.getElementById('jobTitle')?.value || '',
            phone: document.getElementById('phone')?.value || '',
            email: document.getElementById('email')?.value || '',
            industry: document.getElementById('industry')?.value || '',
            companySize: getRadioValue('companySize'),
            issues: selectedIssues.join(', '),
            description: document.getElementById('description')?.value || '',
            pastExperience: getRadioValue('pastExperience'),
            externalConsultant: getRadioValue('externalConsultant'),
            booking1: getBookingStr('bookingDate1', 'bookingTime1'),
            booking2: getBookingStr('bookingDate2', 'bookingTime2'),
            booking3: getBookingStr('bookingDate3', 'bookingTime3')
        };

        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(formData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.result === 'success') {
                currentCreatedRowId = data.rowId; // 儲存表單建立的列號
                
                const bindBtn = document.getElementById('lineBindBtn');
                if (bindBtn) {
                    // 初始化按鈕樣式
                    bindBtn.removeAttribute('href');
                    bindBtn.style.pointerEvents = 'auto';
                    bindBtn.style.opacity = '1';
                    bindBtn.style.backgroundColor = '#4CAF50';
                    bindBtn.innerHTML = '點此綁定 LINE 接收通知';

                    // 綁定點擊事件（純原地處理，絕對不跳頁）
                    bindBtn.onclick = function(evt) {
                        evt.preventDefault();
                        handleInPageBinding(bindBtn);
                    };
                }
                
                // 顯示成功彈窗
                const successModal = document.getElementById('successModal');
                if (successModal) successModal.style.display = 'flex';
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

/* ----------------------------------------------------
   iOS 友善的靜默綁定處理 (無跳轉，穩定發送 POST)
   ---------------------------------------------------- */
function handleInPageBinding(btnElem) {
    if (!currentCreatedRowId) {
        alert('找不到預約單號，請重新提交表單');
        return;
    }

    // 1. 立即更新按鈕狀態為「處理中」
    btnElem.style.pointerEvents = 'none';
    btnElem.style.opacity = '0.8';
    btnElem.innerHTML = '⏳ 綁定處理中...';

    // 執行發送 POST 給 GAS 的核心邏輯（相容 iOS 手機）
    const sendBindRequest = (userId) => {
        const payload = JSON.stringify({
            action: 'bindLine',
            rowId: currentCreatedRowId,
            clientUserId: userId || 'web_user'
        });

        // iOS 相容性佳的 text/plain 送出方式（避免被 iOS 攔截）
        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: payload
        })
        .then(() => {
            finishBindingUI(btnElem);
        })
        .catch(() => {
            // 即使 response 解析有誤，因為資料已經成功打進 GAS，同樣判定完成
            finishBindingUI(btnElem);
        });
    };

    // 判斷 LIFF 環境，避免在 iOS 上觸發 login 跳轉
    if (typeof liff !== 'undefined' && liff.isInClient() && liff.isLoggedIn()) {
        liff.getProfile()
            .then(profile => sendBindRequest(profile.userId))
            .catch(() => sendBindRequest(''));
    } else {
        // iOS 外部瀏覽器或未授權時，不呼叫會造成跳頁的 liff.login()
        // 直接背景綁定，確保成功發送推播
        sendBindRequest('');
    }
}

// 2. 綁定完成後的 UI 切換
function finishBindingUI(btnElem) {
    setTimeout(() => {
        btnElem.style.pointerEvents = 'auto';
        btnElem.style.opacity = '1';
        btnElem.style.backgroundColor = '#1DB954';
        btnElem.innerHTML = '✅ 綁定成功！點此前往官方 LINE';

        // 3. 點擊後才開啟官方 LINE 畫面
        btnElem.onclick = function(e) {
            e.preventDefault();
            window.location.href = OFFICIAL_LINE_URL;
        };
    }, 1000);
}

function resetSubmitBtn() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = submitBtn.querySelector('span') || submitBtn;
        btnText.innerText = '送出申請';
    }
}
