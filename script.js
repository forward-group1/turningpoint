const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const OFFICIAL_LINE_URL = 'https://page.line.me/885xpnyp'; // 官方 LINE 連結

let currentCreatedRowId = null;
let isLiffInit = false;

document.addEventListener('DOMContentLoaded', async function() {
    if (typeof liff !== 'undefined') {
        try {
            await liff.init({ liffId: LIFF_ID });
            isLiffInit = true;
            console.log('LIFF 初始化完成');
        } catch (err) {
            console.error('LIFF Init error:', err);
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
                
                const bindBtn = document.getElementById('lineBindBtn');
                if (bindBtn) {
                    bindBtn.removeAttribute('href');
                    bindBtn.style.pointerEvents = 'auto';
                    bindBtn.style.opacity = '1';
                    bindBtn.style.backgroundColor = '#4CAF50';
                    bindBtn.innerHTML = '點此授權並加入好友接收通知';

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

/* ----------------------------------------------------
   驗證好友狀態、取得 User ID 並綁定
   ---------------------------------------------------- */
async function handleInPageBinding(btnElem) {
    if (!currentCreatedRowId) {
        alert('找不到預約單號，請重新提交表單');
        return;
    }

    btnElem.style.pointerEvents = 'none';
    btnElem.style.opacity = '0.8';
    btnElem.innerHTML = '⏳ 正在驗證 LINE 帳號...';

    if (!isLiffInit || typeof liff === 'undefined') {
        alert('LINE LIFF 未初始化成功，請重新整理頁面');
        resetBindBtnUI(btnElem);
        return;
    }

    // 1. 若未登入，強制喚起登入畫面（包含要求加入好友）
    if (!liff.isLoggedIn()) {
        liff.login({ botPrompt: 'aggressive' });
        return;
    }

    try {
        // 2. 檢查好友狀態
        const friendship = await liff.getFriendship();
        if (!friendship.friendFlag) {
            // 使用者還沒加好友，觸發帶有 botPrompt 的登入/授權畫面以提示加好友
            alert('需先將官方帳號加為好友，才能接收預約確認推播通知喔！');
            liff.login({ botPrompt: 'aggressive' });
            return;
        }

        // 3. 取得 LINE User ID
        const profile = await liff.getProfile();
        const userId = profile.userId;

        if (!userId) {
            throw new Error('無法取得 User ID');
        }

        // 4. 發送給 GAS 進行綁定與推播
        const payload = JSON.stringify({
            action: 'bindLine',
            rowId: currentCreatedRowId,
            clientUserId: userId
        });

        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: payload
        });
        
        const data = await res.json();

        if (data.result === 'success') {
            finishBindingUI(btnElem);
        } else {
            alert('綁定失敗：' + (data.error || '未知錯誤'));
            resetBindBtnUI(btnElem);
        }

    } catch (err) {
        console.error('綁定發生錯誤:', err);
        alert('無法完成 LINE 綁定，請確認是否已授權並加為好友。');
        resetBindBtnUI(btnElem);
    }
}

function finishBindingUI(btnElem) {
    btnElem.style.pointerEvents = 'auto';
    btnElem.style.opacity = '1';
    btnElem.style.backgroundColor = '#1DB954';
    btnElem.innerHTML = '✅ 綁定成功！點此前往官方 LINE';

    btnElem.onclick = function(e) {
        e.preventDefault();
        window.location.href = OFFICIAL_LINE_URL;
    };
}

function resetBindBtnUI(btnElem) {
    btnElem.style.pointerEvents = 'auto';
    btnElem.style.opacity = '1';
    btnElem.innerHTML = '點此授權並加入好友接收通知';
}

function resetSubmitBtn() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = submitBtn.querySelector('span') || submitBtn;
        btnText.innerText = '送出申請';
    }
}
