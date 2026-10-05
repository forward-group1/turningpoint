const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const OFFICIAL_LINE_URL = 'https://page.line.me/885xpnyp'; // 官方 LINE 連結

let currentCreatedRowId = null;

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

    // 2. 檢查 URL 網址參數或 LocalStorage，判斷是否剛從 LINE 登入跳轉回來
    const urlParams = new URLSearchParams(window.location.search);
    const bindRowId = urlParams.get('bindRowId') || localStorage.getItem('pending_bind_row_id');

    if (bindRowId && typeof liff !== 'undefined' && liff.isLoggedIn()) {
        // 展示成功彈窗並顯示處理狀態
        const successModal = document.getElementById('successModal');
        if (successModal) successModal.style.display = 'flex';

        const bindBtn = document.getElementById('lineBindBtn');
        if (bindBtn) {
            bindBtn.style.pointerEvents = 'none';
            bindBtn.innerHTML = '⏳ 綁定處理中，即將為您跳轉官方 LINE...';
        }

        // 自動執行後端綁定與推播，成功後自動跳轉
        autoProcessBindingAndRedirect(bindRowId);
    }

    initFormSubmit();
});

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
                
                // 暫存單號備用
                localStorage.setItem('pending_bind_row_id', currentCreatedRowId);

                const bindBtn = document.getElementById('lineBindBtn');
                if (bindBtn) {
                    bindBtn.removeAttribute('href');
                    bindBtn.style.pointerEvents = 'auto';
                    bindBtn.style.opacity = '1';
                    bindBtn.style.backgroundColor = '#4CAF50';
                    bindBtn.innerHTML = '點此綁定 LINE 接收通知';

                    // 點擊後直接發起 LINE 登入/加好友流程
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
   強制引導 LINE 登入與加好友提示
   ---------------------------------------------------- */
function triggerLineLoginWithRowId(rowId) {
    if (!rowId) {
        alert('找不到預約單號，請重新提交表單');
        return;
    }

    // 清除網址原有的 query string，組裝新的重定向網址
    const cleanUrl = window.location.origin + window.location.pathname;
    const redirectTarget = `${cleanUrl}?bindRowId=${rowId}`;

    if (typeof liff !== 'undefined') {
        // 不論原本是否登入，都調用 liff.login 並帶入帶有 rowId 的 redirectUri 與 botPrompt (強制提示加好友)
        liff.login({
            redirectUri: redirectTarget,
            botPrompt: 'aggressive'
        });
    } else {
        alert('LINE LIFF 元件載入失敗，請重新整理頁面');
    }
}

/* ----------------------------------------------------
   從 LINE 登入跳轉回來後，自動執行綁定與自動跳轉
   ---------------------------------------------------- */
async function autoProcessBindingAndRedirect(rowId) {
    try {
        // 取得 LINE 使用者 Profile
        const profile = await liff.getProfile();
        const userId = profile.userId;

        if (!userId) throw new Error('無法取得 LINE User ID');

        const payload = JSON.stringify({
            action: 'bindLine',
            rowId: rowId,
            clientUserId: userId
        });

        // 發送 POST 請求給 GAS (後端發送推播給客戶與管理員)
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: payload
        });

        // 綁定處理完畢，清除暫存
        localStorage.removeItem('pending_bind_row_id');

        // 更新 UI 狀態並在 1 秒後【自動跳轉】至官方 LINE
        const bindBtn = document.getElementById('lineBindBtn');
        if (bindBtn) {
            bindBtn.style.backgroundColor = '#1DB954';
            bindBtn.innerHTML = '✅ 綁定成功！正為您開啟官方 LINE...';
        }

        setTimeout(() => {
            window.location.href = OFFICIAL_LINE_URL;
        }, 1000);

    } catch (err) {
        console.error('自動綁定失敗:', err);
        alert('LINE 綁定時發生錯誤，點擊後將帶您前往官方 LINE。');
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
