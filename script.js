const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const OFFICIAL_LINE_URL = 'https://page.line.me/885xpnyp'; // 官方 LINE 連結

let currentCreatedRowId = null;
let isBoundSuccess = false;

// 判斷是否為 iOS 裝置 (iPhone / iPad)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

document.addEventListener('DOMContentLoaded', async function() {
    // 1. 初始化 LIFF SDK
    if (typeof liff !== 'undefined') {
        try {
            await liff.init({ liffId: LIFF_ID });
            console.log('LIFF 初始化完成');
        } catch (err) {
            console.error('LIFF Init error:', err);
        }
    }

    // 2. 檢查 URL 是否帶有 iOS 跳轉回來的 bindRowId 參數
    const urlParams = new URLSearchParams(window.location.search);
    const pendingRowId = urlParams.get('bindRowId') || localStorage.getItem('pending_bind_row_id');

    // 若帶有單號且已經是登入狀態（或剛授權回來）
    if (pendingRowId && typeof liff !== 'undefined') {
        if (liff.isLoggedIn() || urlParams.has('code')) {
            currentCreatedRowId = pendingRowId;
            const successModal = document.getElementById('successModal');
            if (successModal) successModal.style.display = 'flex';
            
            // 自動背景執行綁定寫入並發送推播
            await executeAutoBind(pendingRowId);
        }
    }

    initFormSubmit();
});

/* ----------------------------------------------------
   1. 表單提交處理
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
                currentCreatedRowId = data.rowId;
                localStorage.setItem('pending_bind_row_id', currentCreatedRowId);

                const bindBtn = document.getElementById('lineBindBtn');
                if (bindBtn) {
                    bindBtn.removeAttribute('href');
                    bindBtn.style.pointerEvents = 'auto';
                    bindBtn.style.opacity = '1';
                    bindBtn.style.backgroundColor = '#4CAF50';
                    bindBtn.innerHTML = '點此綁定 LINE 接收通知';

                    bindBtn.onclick = function(evt) {
                        evt.preventDefault();
                        handleLineBindingProcess(bindBtn, currentCreatedRowId);
                    };
                }
                
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
   台灣電話 / 手機格式驗證函式
   ---------------------------------------------------- */
function isValidTaiwanPhone(phoneStr) {
    if (!phoneStr) return false;

    // 清除使用者輸入的空格與連字符號 (-)
    const cleanPhone = phoneStr.trim().replace(/[\s-]/g, '');

    // 1. 驗證手機格式：09 開頭且剛好 10 位數字
    const mobileRegex = /^09\d{8}$/;
    if (mobileRegex.test(cleanPhone)) {
        return true;
    }

    // 2. 驗證市話格式（含可選的分機 #123 或 分機123）
    // 區碼 02~08，總號碼 9~10 位數，可接 #/分機/ext 加上數字
    const telRegex = /^0\d{1,2}\d{6,8}(?:(?:#|分機|ext\.?)\d{1,6})?$/i;
    if (telRegex.test(cleanPhone)) {
        return true;
    }

    return false;
}

// 取得電話輸入框內容
const phoneInput = document.getElementById('phone');
const phoneValue = phoneInput ? phoneInput.value.trim() : '';

// 驗證電話格式
if (!isValidTaiwanPhone(phoneValue)) {
    alert('請輸入有效的台灣電話或手機號碼！\n例如：0912345678 或 02-12345678#123');
    if (phoneInput) phoneInput.focus();
    resetSubmitBtn(); // 重置按鈕狀態
    return; // 攔截不送出
}

/* ----------------------------------------------------
   2. 綁定處理邏輯 (特別優化 iOS)
   ---------------------------------------------------- */
async function handleLineBindingProcess(btnElem, rowId) {
    if (!rowId) {
        alert('找不到預約單號，請重新提交表單');
        return;
    }

    // 已綁定成功時，點擊直接前往官方 LINE
    if (isBoundSuccess) {
        window.location.href = OFFICIAL_LINE_URL;
        return;
    }

    btnElem.style.pointerEvents = 'none';
    btnElem.style.opacity = '0.85';
    btnElem.innerHTML = '⏳ 綁定處理中，請稍候...';

    if (typeof liff !== 'undefined') {
        // 如果使用者尚未授權/登入
        if (!liff.isLoggedIn()) {
            const cleanUrl = window.location.origin + window.location.pathname;
            const redirectTarget = `${cleanUrl}?bindRowId=${rowId}`;

            // 對於 iOS Safari：直接在當前頁面導向重定向網址，避免跳出新分頁
            liff.login({
                redirectUri: redirectTarget,
                botPrompt: 'aggressive'
            });
            return;
        }

        // 已授權狀態下（或 LINE App 內），直接執行背景綁定與發送推播
        await executeAutoBind(rowId);
    } else {
        alert('LINE SDK 載入失敗');
    }
}

/* ----------------------------------------------------
   3. 背景發送 POST 給 GAS (寫入 ID + 發推播)
   ---------------------------------------------------- */
async function executeAutoBind(rowId) {
    const bindBtn = document.getElementById('lineBindBtn');
    try {
        const profile = await liff.getProfile();
        const userId = profile.userId;

        if (!userId) throw new Error('無法取得 LINE User ID');

        // 打 POST API 給 GAS
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'bindLine',
                rowId: rowId,
                clientUserId: userId
            })
        });

        // 成功後清除單號暫存
        localStorage.removeItem('pending_bind_row_id');

        // 設定完成狀態
        isBoundSuccess = true;

        if (bindBtn) {
            bindBtn.style.pointerEvents = 'auto';
            bindBtn.style.opacity = '1';
            bindBtn.style.backgroundColor = '#00B900'; // LINE 綠色
            bindBtn.innerHTML = '✅ 綁定成功！點此前往官方 LINE';
            
            bindBtn.onclick = function(e) {
                e.preventDefault();
                window.location.href = OFFICIAL_LINE_URL;
            };
        }
    } catch (err) {
        console.error('背景綁定失敗:', err);
        localStorage.removeItem('pending_bind_row_id');
        isBoundSuccess = true;
        if (bindBtn) {
            bindBtn.style.pointerEvents = 'auto';
            bindBtn.style.opacity = '1';
            bindBtn.innerHTML = '點此前往官方 LINE';
            bindBtn.onclick = function(e) {
                e.preventDefault();
                window.location.href = OFFICIAL_LINE_URL;
            };
        }
    }
}

function resetSubmitBtn() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = submitBtn.querySelector('span') || submitBtn;
        btnText.innerText = '送出申請';
    }
}
