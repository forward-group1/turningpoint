const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const OFFICIAL_LINE_URL = 'https://page.line.me/885xpnyp'; // 官方 LINE 連結

let currentCreatedRowId = null;
let isBoundSuccess = false; // 紀錄是否已完成綁定

document.addEventListener('DOMContentLoaded', async function() {
    // 初始化 LIFF SDK
    if (typeof liff !== 'undefined') {
        try {
            await liff.init({ liffId: LIFF_ID });
            console.log('LIFF 初始化完成');
        } catch (err) {
            console.error('LIFF Init error:', err);
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

        // 發送表單資料給 GAS
        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(formData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.result === 'success') {
                currentCreatedRowId = data.rowId;
                isBoundSuccess = false;

                const bindBtn = document.getElementById('lineBindBtn');
                if (bindBtn) {
                    bindBtn.removeAttribute('href');
                    bindBtn.style.pointerEvents = 'auto';
                    bindBtn.style.opacity = '1';
                    bindBtn.style.backgroundColor = '#4CAF50';
                    bindBtn.innerHTML = '點此綁定 LINE 接收通知';

                    // 綁定點擊事件
                    bindBtn.onclick = function(evt) {
                        evt.preventDefault();
                        handleLineBindingProcess(bindBtn, currentCreatedRowId);
                    };
                }
                
                // 顯示圖 1 的成功彈窗
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
   2. 處理 LINE 綁定與 User ID 收集（畫面不亂跳）
   ---------------------------------------------------- */
async function handleLineBindingProcess(btnElem, rowId) {
    if (!rowId) {
        alert('找不到預約單號，請重新提交表單');
        return;
    }

    // 階段二：如果已經綁定成功，再次點擊時才真正跳轉至官方 LINE
    if (isBoundSuccess) {
        window.location.href = OFFICIAL_LINE_URL;
        return;
    }

    // 鎖定按鈕顯示處理中狀態
    btnElem.style.pointerEvents = 'none';
    btnElem.style.opacity = '0.85';
    btnElem.innerHTML = '⏳ 綁定處理中，請稍候...';

    try {
        if (typeof liff === 'undefined') {
            throw new Error('LIFF SDK 載入失敗');
        }

        // 情境 A：若使用者未登入（如 Android 外部 Chrome 瀏覽器），觸發彈窗授權
        if (!liff.isLoggedIn()) {
            await liff.login({ botPrompt: 'aggressive' });
            return; // 登入完畢後頁面保持
        }

        // 情境 B：已登入（LINE App 內建瀏覽器或已授權狀態），立刻背景抓 Profile
        const profile = await liff.getProfile();
        const userId = profile.userId;

        if (!userId) throw new Error('無法取得 LINE User ID');

        // 背景發送 POST 給 GAS (寫入 Column P + 發送客戶推播 & 管理員推播)
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'bindLine',
                rowId: rowId,
                clientUserId: userId
            })
        });

        // 綁定成功狀態變更
        isBoundSuccess = true;

        // 變更按鈕外觀與文字
        btnElem.style.pointerEvents = 'auto';
        btnElem.style.opacity = '1';
        btnElem.style.backgroundColor = '#00B900'; // LINE 經典綠
        btnElem.innerHTML = '✅ 綁定成功！點此前往官方 LINE';

    } catch (err) {
        console.error('綁定失敗:', err);
        alert('綁定處理發生異常，請重試或點擊直接前往官方 LINE。');
        
        // 失敗時的退路：允許直接前往官方 LINE
        isBoundSuccess = true;
        btnElem.style.pointerEvents = 'auto';
        btnElem.style.opacity = '1';
        btnElem.innerHTML = '點此前往官方 LINE';
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
