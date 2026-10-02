const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const OFFICIAL_LINE_URL = 'https://page.line.me/885xpnyp'; // 官方 LINE 連結

let currentCreatedRowId = null; // 紀錄表單送出後的列號

document.addEventListener('DOMContentLoaded', function() {
    // 初始化 LIFF SDK（在背景預先初始化）
    if (typeof liff !== 'undefined') {
        liff.init({ liffId: LIFF_ID }).catch(err => console.error('LIFF Init error:', err));
    }

    initFormSubmit();
});

/* ----------------------------------------------------
   表單提交與彈窗按鈕互動 (不開啟新視窗，原地更新狀態)
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
            industry: document.getElementById('industry')?.value || '',
            userName: document.getElementById('userName')?.value || '',
            jobTitle: document.getElementById('jobTitle')?.value || '',
            phone: document.getElementById('phone')?.value || '',
            email: document.getElementById('email')?.value || '',
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
                currentCreatedRowId = data.rowId; // 儲存 rowId
                
                const bindBtn = document.getElementById('lineBindBtn');
                if (bindBtn) {
                    // 重置按鈕狀態與點擊事件
                    bindBtn.removeAttribute('href');
                    bindBtn.style.pointerEvents = 'auto';
                    bindBtn.style.opacity = '1';
                    bindBtn.style.backgroundColor = '#4CAF50';
                    bindBtn.innerHTML = '點此綁定 LINE 接收通知';

                    // 綁定點擊處理邏輯（不跳頁）
                    bindBtn.onclick = function(evt) {
                        evt.preventDefault();
                        handleInPageBinding(bindBtn);
                    };
                }
                
                // 顯示成功彈窗 (圖2)
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
   原地執行綁定 (留在彈窗畫面，改變按鈕狀態)
   ---------------------------------------------------- */
function handleInPageBinding(btnElem) {
    if (!currentCreatedRowId) {
        alert('找不到資料列號，請重新提交表單');
        return;
    }

    // 1. 立即將按鈕顯示為處理中，並鎖定避免重複點擊
    btnElem.style.pointerEvents = 'none';
    btnElem.style.opacity = '0.8';
    btnElem.innerHTML = '⏳ 綁定處理中...';

    const doGasBinding = (userId) => {
        const payload = JSON.stringify({
            action: 'bindLine',
            rowId: currentCreatedRowId,
            clientUserId: userId || 'web_user'
        });

        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: payload
        }).then(() => {
            // 2. 處理成功後，按鈕轉為綠色，顯示「綁定成功！點此前往官方 LINE」
            btnElem.style.pointerEvents = 'auto';
            btnElem.style.opacity = '1';
            btnElem.style.backgroundColor = '#1DB954';
            btnElem.innerHTML = '✅ 綁定成功！點此前往官方 LINE';

            // 3. 點擊後才開啟官方 LINE 畫面
            btnElem.onclick = function() {
                window.location.href = OFFICIAL_LINE_URL;
            };
        }).catch(err => {
            console.error(err);
            alert('綁定發生錯誤，請重試');
            btnElem.style.pointerEvents = 'auto';
            btnElem.innerHTML = '點此綁定 LINE 接收通知';
        });
    };

    // 如果支援 LIFF，在背景靜默取得 Profile
    if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
        liff.getProfile().then(profile => {
            doGasBinding(profile.userId);
        }).catch(() => {
            doGasBinding('');
        });
    } else if (typeof liff !== 'undefined') {
        // 若未登入 LIFF，直接引導登入，登入後回原頁
        liff.login({ redirectUri: window.location.href });
    } else {
        doGasBinding('');
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
