const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const ADD_FRIEND_URL = 'https://line.me/R/ti/p/@885xpnyp'; 

let currentCreatedRowId = sessionStorage.getItem('pending_row_id') || null; 
let cachedUserId = '';

document.addEventListener('DOMContentLoaded', async function() {
    // 1. 初始化 LIFF 並嘗試在載入時就拿到 User ID
    if (typeof liff !== 'undefined') {
        try {
            await liff.init({ liffId: LIFF_ID });
            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                cachedUserId = profile.userId;
                console.log('✅ 頁面載入即取得 UserID:', cachedUserId);
            }
        } catch (err) {
            console.error('LIFF Init error:', err);
        }
    }

    // 2. 檢查是否有登入轉址後「待完成的綁定任務」
    if (currentCreatedRowId && cachedUserId) {
        autoFinishPendingBinding();
    }

    initFormSubmit();
});

// 如果登入轉址回來，自動完成綁定
function autoFinishPendingBinding() {
    const rowId = currentCreatedRowId;
    sessionStorage.removeItem('pending_row_id'); // 執行後清除

    const payload = JSON.stringify({
        action: 'bindLine',
        rowId: rowId,
        clientUserId: cachedUserId
    });

    fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload
    })
    .then(res => res.json())
    .then(data => {
        // 綁定成功後，自動導向 LINE 加好友/聊天室畫面
        window.location.href = ADD_FRIEND_URL;
    })
    .catch(err => console.error('Auto bind error:', err));
}

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
                currentCreatedRowId = data.rowId; 
                sessionStorage.setItem('pending_row_id', data.rowId);
                
                const bindBtn = document.getElementById('lineBindBtn');
                if (bindBtn) {
                    bindBtn.removeAttribute('href');
                    bindBtn.style.pointerEvents = 'auto';
                    bindBtn.style.opacity = '1';
                    bindBtn.style.backgroundColor = '#4CAF50';
                    bindBtn.innerHTML = '點此綁定 LINE 接收通知';

                    bindBtn.onclick = function(evt) {
                        evt.preventDefault();
                        handleInPageBinding(bindBtn);
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

async function handleInPageBinding(btnElem) {
    if (!currentCreatedRowId) {
        alert('找不到預約單號，請重新提交表單');
        return;
    }

    btnElem.style.pointerEvents = 'none';
    btnElem.style.opacity = '0.8';
    btnElem.innerHTML = '⏳ 綁定處理中...';

    // 如果已經拿到 cachedUserId，直接發送
    if (cachedUserId) {
        sendBindRequest(cachedUserId, btnElem);
        return;
    }

    // 否則嘗試檢查登入
    if (typeof liff !== 'undefined') {
        if (!liff.isLoggedIn()) {
            sessionStorage.setItem('pending_row_id', currentCreatedRowId);
            liff.login({ redirectUri: window.location.href });
            return;
        } else {
            try {
                const profile = await liff.getProfile();
                cachedUserId = profile.userId;
                sendBindRequest(cachedUserId, btnElem);
            } catch(e) {
                alert('無法讀取 LINE Profile，請確認權限後重試');
                finishBindingUI(btnElem);
            }
        }
    } else {
        alert('LIFF SDK 載入失敗');
        finishBindingUI(btnElem);
    }
}

function sendBindRequest(userId, btnElem) {
    const payload = JSON.stringify({
        action: 'bindLine',
        rowId: currentCreatedRowId,
        clientUserId: userId
    });

    fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload
    })
    .then(res => res.json())
    .then(data => {
        finishBindingUI(btnElem);
    })
    .catch(err => {
        console.error('Bind Error:', err);
        finishBindingUI(btnElem);
    });
}

function finishBindingUI(btnElem) {
    setTimeout(() => {
        btnElem.style.pointerEvents = 'auto';
        btnElem.style.opacity = '1';
        btnElem.style.backgroundColor = '#1DB954';
        btnElem.innerHTML = '✅ 綁定完成！點此開啟 LINE 查看通知';

        btnElem.onclick = function(e) {
            e.preventDefault();
            // 直接跳轉開啟 LINE 加好友/聊天室畫面
            window.location.href = ADD_FRIEND_URL;
        };
    }, 600);
}

function resetSubmitBtn() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = submitBtn.querySelector('span') || submitBtn;
        btnText.innerText = '送出申請';
    }
}
