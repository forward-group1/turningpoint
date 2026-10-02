const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const ADD_FRIEND_URL = 'https://line.me/R/ti/p/@885xpnyp'; 

let currentCreatedRowId = null; 
let isLiffInitialized = false;

document.addEventListener('DOMContentLoaded', function() {
    // 初始化 LIFF
    if (typeof liff !== 'undefined') {
        liff.init({ liffId: LIFF_ID })
            .then(() => {
                isLiffInitialized = true;
                // 如果在外部瀏覽器且尚未登入，且 URL 帶有轉址參數時處理
            })
            .catch(err => console.error('LIFF Init error:', err));
    }
    initFormSubmit();
});

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

    let userId = 'web_user';

    try {
        if (typeof liff !== 'undefined') {
            // 如果尚未初始化完成，稍作等待
            if (!isLiffInitialized) {
                await liff.init({ liffId: LIFF_ID });
                isLiffInitialized = true;
            }

            // 檢查是否登入，未登入則彈出 LINE 登入頁
            if (!liff.isLoggedIn()) {
                liff.login({ redirectUri: window.location.href });
                return;
            }

            // 取得 Profile 中的 userId
            const profile = await liff.getProfile();
            if (profile && profile.userId) {
                userId = profile.userId;
            }
        }
    } catch (err) {
        console.error('取得 LINE User ID 失敗:', err);
    }

    // 發送綁定請求至 GAS
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
        btnElem.innerHTML = '✅ 綁定成功！點此開啟 LINE 聊天室';

        btnElem.onclick = function(e) {
            e.preventDefault();
            window.location.href = ADD_FRIEND_URL;
        };
    }, 800);
}

function resetSubmitBtn() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = submitBtn.querySelector('span') || submitBtn;
        btnText.innerText = '送出申請';
    }
}
