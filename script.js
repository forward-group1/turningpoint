const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const ADD_FRIEND_URL = 'https://line.me/R/ti/p/@885xpnyp'; 

let currentCreatedRowId = sessionStorage.getItem('pending_row_id') || null;

document.addEventListener('DOMContentLoaded', async function() {
    // 進入頁面先初始化 LIFF
    if (typeof liff !== 'undefined') {
        try {
            await liff.init({ liffId: LIFF_ID });

            // 如果已經是登入狀態（剛授權重定向回來）
            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                const userId = profile.userId;

                // 如果暫存中有尚未綁定的單號，立即向 GAS 補發綁定！
                if (currentCreatedRowId) {
                    await sendBindRequest(currentCreatedRowId, userId);
                    sessionStorage.removeItem('pending_row_id');
                    alert('✅ LINE 帳號綁定成功！即將跳轉加好友。');
                    window.location.href = ADD_FRIEND_URL;
                }
            }
        } catch (err) {
            console.error('LIFF 初始化錯誤:', err);
        }
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
                sessionStorage.setItem('pending_row_id', data.rowId);
                
                const bindBtn = document.getElementById('lineBindBtn');
                if (bindBtn) {
                    bindBtn.removeAttribute('href');
                    bindBtn.style.pointerEvents = 'auto';
                    bindBtn.style.opacity = '1';
                    bindBtn.style.backgroundColor = '#00B900';
                    bindBtn.innerHTML = '💬 點此授權綁定 LINE 並開啟通知';

                    // 使用者點擊按鈕時，強行要求登入
                    bindBtn.onclick = function(evt) {
                        evt.preventDefault();
                        if (typeof liff !== 'undefined') {
                            if (!liff.isLoggedIn()) {
                                // 手機外部瀏覽器點擊後跳轉 LINE 登入頁
                                liff.login({ redirectUri: window.location.origin + window.location.pathname });
                            } else {
                                liff.getProfile().then(profile => {
                                    sendBindRequest(currentCreatedRowId, profile.userId).then(() => {
                                        window.location.href = ADD_FRIEND_URL;
                                    });
                                });
                            }
                        } else {
                            window.location.href = ADD_FRIEND_URL;
                        }
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

function sendBindRequest(rowId, userId) {
    return fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'bindLine',
            rowId: rowId,
            clientUserId: userId
        })
    }).then(res => res.json());
}

function resetSubmitBtn() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = submitBtn.querySelector('span') || submitBtn;
        btnText.innerText = '送出申請';
    }
}
