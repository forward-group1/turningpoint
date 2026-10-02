const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const OFFICIAL_LINE_URL = 'https://page.line.me/885xpnyp'; // 您的官方 LINE 連結

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 檢查是否是點擊綁定進入 LIFF 流程
    if (urlParams.get('bind') === '1' || urlParams.has('rowId') || window.location.search.includes('liff.state')) {
        handleLiffBinding();
        return;
    }

    initFormSubmit();
});

/* ----------------------------------------------------
   1. 處理 LIFF 綁定邏輯 (iOS 完美優化版)
   ---------------------------------------------------- */
function handleLiffBinding() {
    // 進入 LIFF 綁定流程時，立即將按鈕顯示為「綁定處理中...」
    const bindBtn = document.getElementById('lineBindBtn');
    if (bindBtn) {
        bindBtn.style.pointerEvents = 'none';
        bindBtn.style.opacity = '0.8';
        bindBtn.innerHTML = '⏳ 綁定處理中...';
    }

    if (typeof liff === 'undefined') {
        alert('LINE SDK 載入失敗，請重新整理頁面');
        return;
    }

    liff.init({ liffId: LIFF_ID }).then(() => {
        // 未登入時觸發登入 (iOS 會重寫網頁)
        if (!liff.isLoggedIn()) {
            liff.login({ redirectUri: window.location.href });
            return;
        }

        // 解析 URL 參數取得 rowId
        let urlParams = new URLSearchParams(window.location.search);
        let rowId = urlParams.get('rowId');

        if (!rowId && urlParams.has('liff.state')) {
            const stateSearch = new URLSearchParams(urlParams.get('liff.state'));
            rowId = stateSearch.get('rowId');
        }

        if (!rowId) {
            alert('綁定失敗：找不到預約單 ID (rowId)');
            return;
        }

        // 取得 Profile 並發送給 GAS
        liff.getProfile().then(profile => {
            const payload = JSON.stringify({
                action: 'bindLine',
                rowId: rowId,
                clientUserId: profile.userId
            });

            fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors', // 避開 iOS CORS 限制
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: payload
            })
            .then(() => {
                // 更新按鈕為完成狀態
                if (bindBtn) {
                    bindBtn.innerHTML = '✅ 綁定成功！前往官方 LINE';
                    bindBtn.style.backgroundColor = '#1DB954';
                    bindBtn.style.pointerEvents = 'auto';
                    bindBtn.href = OFFICIAL_LINE_URL;
                }

                // 強制導向至官方 LINE 帳號
                if (liff.isInClient()) {
                    // 使用 external: true 開啟系統層級深層連結，解決 iOS 開新視窗卡住問題
                    liff.openWindow({
                        url: OFFICIAL_LINE_URL,
                        external: true
                    });
                    setTimeout(() => {
                        liff.closeWindow(); // 順利開啟後自動關閉 LIFF 彈窗
                    }, 500);
                } else {
                    window.location.href = OFFICIAL_LINE_URL;
                }
            })
            .catch(err => {
                console.error('Fetch Error:', err);
                alert('綁定請求發送失敗，請稍後再試：' + err);
            });
        }).catch(err => {
            alert('無法取得 LINE 用戶資料：' + err);
        });
    }).catch(err => {
        console.error('LIFF Init Error:', err);
        alert('LIFF 初始化失敗：' + err);
    });
}

/* ----------------------------------------------------
   2. 表單提交與彈窗初始化
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
                const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;
                const bindUrl = `${LIFF_URL}?bind=1&rowId=${data.rowId}`;
                const bindBtn = document.getElementById('lineBindBtn');
                
                if (bindBtn) {
                    bindBtn.href = bindUrl;
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

function resetSubmitBtn() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = submitBtn.querySelector('span') || submitBtn;
        btnText.innerText = '送出申請';
    }
}
