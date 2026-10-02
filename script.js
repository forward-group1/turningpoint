好友可以收到的js
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 如果網址帶有 ?bind=1 或帶有 rowId，代表是從 LIFF 進來做綁定的
    if (urlParams.get('bind') === '1' || urlParams.has('rowId') || window.location.search.includes('liff.state')) {
        handleLiffBinding();
        return;
    }

    // 綁定一般表單提交事件
    initFormSubmit();
});

function handleLiffBinding() {
    if (typeof liff === 'undefined') {
        alert('LINE SDK 載入失敗，請重新整理頁面');
        return;
    }
    
    /* 處理 LIFF 進入時的 LINE 帳號綁定邏輯*/
    liff.init({ liffId: LIFF_ID }).then(() => {
        // 1. 未登入處理
        if (!liff.isLoggedIn()) {
            liff.login({ redirectUri: window.location.href });
            return;
        }

        // 2. 已登入，解析 URL 參數取得 rowId
        let urlParams = new URLSearchParams(window.location.search);
        let rowId = urlParams.get('rowId');

        // 相容性處理：若經由 LINE LIFF 轉址，參數可能放在 liff.state 中
        if (!rowId && urlParams.has('liff.state')) {
            const stateSearch = new URLSearchParams(urlParams.get('liff.state'));
            rowId = stateSearch.get('rowId');
        }

        if (!rowId) {
            alert('綁定失敗：找不到預約單 ID (rowId)');
            return;
        }

        // 3. 取得 User Profile 並回傳至 GAS 綁定
        liff.getProfile().then(profile => {
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
                    
                    if (liff.isInClient()) {
                        liff.closeWindow();
                    } else {
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

// 修正2：補上 initFormSubmit 函數，整合表單送出邏輯
function initFormSubmit() {
    const form = document.getElementById('consultForm');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            const btnSpan = submitBtn.querySelector('span');
            if (btnSpan) btnSpan.innerText = '資料處理中...';
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
                const bindBtn = document.getElementById('lineBindBtn');
                if (bindBtn) bindBtn.href = bindUrl;
                
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

/* 重置提交按鈕狀態 */
function resetSubmitBtn() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = submitBtn.querySelector('span');
        if (btnText) btnText.innerText = '送出申請';
    }
}
