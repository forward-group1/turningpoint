const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const OFFICIAL_LINE_URL = 'https://page.line.me/885xpnyp'; // 官方 LINE 連結

let currentCreatedRowId = null;
let isProcessingBind = false; // 防止重複執行綁定

document.addEventListener('DOMContentLoaded', async function() {
    await checkAndExecuteBinding();
    initFormSubmit();
});

// 解決 Android BFCache / 頁面喚醒不重新執行 JS 的問題
window.addEventListener('pageshow', async function(event) {
    if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
        await checkAndExecuteBinding();
    }
});

document.addEventListener('visibilitychange', async function() {
    if (document.visibilityState === 'visible') {
        await checkAndExecuteBinding();
    }
});

/* ----------------------------------------------------
   核心：檢查登入狀態與觸發自動綁定
   ---------------------------------------------------- */
async function checkAndExecuteBinding() {
    if (isProcessingBind) return;

    const urlParams = new URLSearchParams(window.location.search);
    let bindRowId = urlParams.get('bindRowId') || localStorage.getItem('pending_bind_row_id');

    if (!bindRowId) return;

    if (typeof liff !== 'undefined') {
        try {
            if (!liff.id) {
                await liff.init({ liffId: LIFF_ID });
            }

            // 只要網址有 bindRowId，且 (已登入 或 帶有 OAuth code 參數)
            if (liff.isLoggedIn() || urlParams.has('code')) {
                isProcessingBind = true;

                // 顯示彈窗並更新按鈕狀態
                const successModal = document.getElementById('successModal');
                if (successModal) successModal.style.display = 'flex';

                const bindBtn = document.getElementById('lineBindBtn');
                if (bindBtn) {
                    bindBtn.style.pointerEvents = 'none';
                    bindBtn.style.opacity = '0.8';
                    bindBtn.innerHTML = '⏳ 綁定處理中，即將導向官方 LINE...';
                }

                await autoProcessBindingAndRedirect(bindRowId);
            }
        } catch (err) {
            console.error('LIFF Check/Init error:', err);
            isProcessingBind = false;
        }
    }
}

/* ----------------------------------------------------
   表單提交處理
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
                
                // 暫存單號至 LocalStorage
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
                        triggerLineLoginWithRowId(currentCreatedRowId);
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
   觸發 LINE 登入與加好友提示
   ---------------------------------------------------- */
function triggerLineLoginWithRowId(rowId) {
    if (!rowId) {
        alert('找不到預約單號，請重新提交表單');
        return;
    }

    const cleanUrl = window.location.origin + window.location.pathname;
    const redirectTarget = `${cleanUrl}?bindRowId=${rowId}`;

    if (typeof liff !== 'undefined') {
        if (liff.isLoggedIn()) {
            checkAndExecuteBinding();
        } else {
            // Android 外部瀏覽器：帶入 redirectUri 與 botPrompt
            liff.login({
                redirectUri: redirectTarget,
                botPrompt: 'aggressive'
            });
        }
    } else {
        alert('LINE SDK 載入失敗，請重新整理頁面');
    }
}

/* ----------------------------------------------------
   登入跳轉回來後，自動背景發送 POST 並跳轉官方 LINE
   ---------------------------------------------------- */
async function autoProcessBindingAndRedirect(rowId) {
    try {
        if (!liff.isLoggedIn()) {
            // 稍作等待以防 Android LIFF 狀態更新延遲
            await new Promise(resolve => setTimeout(resolve, 600));
            if (!liff.isLoggedIn()) {
                throw new Error('LINE 授權尚未完備');
            }
        }

        // 取得 Profile (包含 userId)
        const profile = await liff.getProfile();
        const userId = profile.userId;

        if (!userId) throw new Error('無法取得 LINE User ID');

        const payload = JSON.stringify({
            action: 'bindLine',
            rowId: rowId,
            clientUserId: userId
        });

        // 發送 POST 給 GAS
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: payload
        });

        // 綁定成功後清除單號暫存
        localStorage.removeItem('pending_bind_row_id');

        const bindBtn = document.getElementById('lineBindBtn');
        if (bindBtn) {
            bindBtn.style.backgroundColor = '#1DB954';
            bindBtn.innerHTML = '✅ 綁定成功！正為您開啟官方 LINE...';
        }

        // 成功後自動跳轉官方 LINE 帳號
        setTimeout(() => {
            window.location.href = OFFICIAL_LINE_URL;
        }, 800);

    } catch (err) {
        console.error('自動綁定失敗:', err);
        // 若出錯仍清除暫存並自動引導至官方 LINE
        localStorage.removeItem('pending_bind_row_id');
        window.location.href = OFFICIAL_LINE_URL;
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
