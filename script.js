const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const OFFICIAL_LINE_URL = 'https://page.line.me/885xpnyp'; // 官方 LINE 連結

let currentCreatedRowId = null;
let isBoundSuccess = false;

// 判斷是否為 iOS 裝置 (iPhone / iPad)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

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

    // 2. 檢查 URL 是否帶有 iOS 跳轉回來的 bindRowId 參數
    const urlParams = new URLSearchParams(window.location.search);
    const pendingRowId = urlParams.get('bindRowId') || localStorage.getItem('pending_bind_row_id');

    // 若帶有單號且已經是登入狀態（或剛授權回來）
    if (pendingRowId && typeof liff !== 'undefined') {
        if (liff.isLoggedIn() || urlParams.has('code')) {
            currentCreatedRowId = pendingRowId;
            const successModal = document.getElementById('successModal');
            if (successModal) successModal.style.display = 'flex';
            
            // 自動背景執行綁定寫入並發送推播
            await executeAutoBind(pendingRowId);
        }
    }

    initFormSubmit();
});

/* ----------------------------------------------------
   通用工具：HTML5 原生氣泡提示 (加強版 Focus 觸發)
   ---------------------------------------------------- */
function showCustomValidity(element, message) {
    if (!element) return;
    
    // 1. 先讓畫面流暢捲動到該元素
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // 2. 強制取得焦點 (關鍵：沒有 focus 氣泡經常跳不出來)
    element.focus();

    // 3. 設定客製化錯誤訊息並觸發瀏覽器氣泡
    element.setCustomValidity(message);
    element.reportValidity();

    // 4. 當使用者輸入或修改時，自動清除錯誤訊息
    const clearValidity = () => {
        element.setCustomValidity('');
        element.removeEventListener('input', clearValidity);
        element.removeEventListener('change', clearValidity);
    };
    element.addEventListener('input', clearValidity);
    element.addEventListener('change', clearValidity);
}

/* ----------------------------------------------------
   台灣電話 / 手機格式驗證函式
   ---------------------------------------------------- */
function isValidTaiwanPhone(phoneStr) {
    if (!phoneStr) return false;

    // 清除空格與連線
    const cleanPhone = phoneStr.trim().replace(/[\s-]/g, '');

    // 0. 防呆：不允許全是相同數字（例如 0000000000、0900000000、0911111111）
    if (/^(\d)\1+$/.test(cleanPhone.split('#')[0].split('分機')[0])) {
        return false;
    }

    // 1. 驗證手機格式：09 開頭且總共 10 位數字 (09XX-XXX-XXX)
    const mobileRegex = /^09\d{8}$/;
    if (mobileRegex.test(cleanPhone)) {
        return true;
    }

    // 2. 驗證市話格式：必須符合台灣合法區碼
    const telRegex = /^(02|03|037|04|049|05|06|07|08|082|0836)\d{6,8}(?:(?:#|分機|ext\.?)\d{1,6})?$/i;
    if (telRegex.test(cleanPhone)) {
        return true;
    }

    return false;
}

/* ----------------------------------------------------
   1. 表單提交處理
   ---------------------------------------------------- */
function initFormSubmit() {
    const form = document.getElementById('consultForm');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // ----------------------------------------------------
        // 表單前端驗證（按順序防呆，找到第一個錯誤就聚焦跳出氣泡）
        // ----------------------------------------------------

        // 1. 驗證公司名稱
        const companyNameInput = document.getElementById('companyName');
        if (companyNameInput && !companyNameInput.value.trim()) {
            showCustomValidity(companyNameInput, '請填寫公司名稱！');
            return;
        }

        // 2. 驗證產業類別
        const industryInput = document.getElementById('industry');
        if (industryInput && !industryInput.value.trim()) {
            showCustomValidity(industryInput, '請填寫貴公司的產業類別！');
            return;
        }

        // 3. 驗證承辦姓名
        const userNameInput = document.getElementById('userName');
        if (userNameInput && !userNameInput.value.trim()) {
            showCustomValidity(userNameInput, '請填寫承辦姓名！');
            return;
        }

        // 4. 驗證職稱
        const jobTitleSelect = document.getElementById('jobTitle');
        if (jobTitleSelect && !jobTitleSelect.value) {
            showCustomValidity(jobTitleSelect, '請選擇職稱！');
            return;
        }

        // 5. 驗證聯絡電話 / 手機
        const phoneInput = document.getElementById('phone');
        const phoneValue = phoneInput ? phoneInput.value.trim() : '';
        if (!phoneInput || !phoneValue) {
            if (phoneInput) showCustomValidity(phoneInput, '請填寫聯絡電話！');
            return;
        } else if (!isValidTaiwanPhone(phoneValue)) {
            showCustomValidity(phoneInput, '請輸入有效的電話號碼（例如：0912345678 或 03-1234567#123）');
            return;
        }

        // 6. 驗證電子郵件
        const emailInput = document.getElementById('email');
        const emailValue = emailInput ? emailInput.value.trim() : '';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailInput || !emailValue) {
            if (emailInput) showCustomValidity(emailInput, '請填寫電子郵件！');
            return;
        } else if (!emailRegex.test(emailValue)) {
            showCustomValidity(emailInput, '請輸入有效的電子郵件地址！');
            return;
        }

        // 7. 驗證公司規模 (單選)
        const companySizeSelected = document.querySelector('input[name="companySize"]:checked');
        if (!companySizeSelected) {
            const firstRadio = document.querySelector('input[name="companySize"]');
            if (firstRadio) {
                showCustomValidity(firstRadio, '請選擇公司規模！');
            }
            return;
        }

        // 8. 驗證勞務議題（多選一）
        const issueCheckboxes = document.querySelectorAll('input[name="issues"]');
        const selectedIssues = Array.from(issueCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        if (selectedIssues.length === 0) {
            if (issueCheckboxes.length > 0) {
                showCustomValidity(issueCheckboxes[0], '請至少選擇一項遇到的勞務議題！');
            }
            return;
        }

        // 9. 驗證具體爭議與遭遇的問題
        const descriptionInput = document.getElementById('description');
        if (descriptionInput && !descriptionInput.value.trim()) {
            showCustomValidity(descriptionInput, '請填寫具體爭議與遭遇的問題！');
            return;
        }

        // 10. 驗證期望諮詢日期與時間 (時段一、二、三均為必填)
        const bookingDate1 = document.getElementById('bookingDate1');
        const bookingTime1 = document.getElementById('bookingTime1');
        if (bookingDate1 && !bookingDate1.value) {
            showCustomValidity(bookingDate1, '請選擇時段一的預約日期！');
            return;
        }
        if (bookingTime1 && !bookingTime1.value) {
            showCustomValidity(bookingTime1, '請選擇時段一的預約時間！');
            return;
        }

        const bookingDate2 = document.getElementById('bookingDate2');
        const bookingTime2 = document.getElementById('bookingTime2');
        if (bookingDate2 && !bookingDate2.value) {
            showCustomValidity(bookingDate2, '請選擇時段二的預約日期！');
            return;
        }
        if (bookingTime2 && !bookingTime2.value) {
            showCustomValidity(bookingTime2, '請選擇時段二的預約時間！');
            return;
        }

        const bookingDate3 = document.getElementById('bookingDate3');
        const bookingTime3 = document.getElementById('bookingTime3');
        if (bookingDate3 && !bookingDate3.value) {
            showCustomValidity(bookingDate3, '請選擇時段三的預約日期！');
            return;
        }
        if (bookingTime3 && !bookingTime3.value) {
            showCustomValidity(bookingTime3, '請選擇時段三的預約時間！');
            return;
        }

        // 11. 個資同意條款勾選 (相容 consent 與 agreeCheck)
        const consentCheckbox = document.getElementById('consent') || document.getElementById('agreeCheck');
        if (consentCheckbox && !consentCheckbox.checked) {
            showCustomValidity(consentCheckbox, '請勾選同意個人資料保護條款以繼續提交！');
            return;
        }

        // ----------------------------------------------------
        // 通過驗證，開始送出表單
        // ----------------------------------------------------
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            const btnSpan = submitBtn.querySelector('span') || submitBtn;
            btnSpan.innerText = '資料處理中...';
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
            companyName: companyNameInput?.value || '',
            userName: userNameInput?.value || '',
            jobTitle: jobTitleSelect?.value || '',
            phone: phoneValue,
            email: emailValue,
            industry: industryInput?.value || '',
            companySize: getRadioValue('companySize'),
            issues: selectedIssues.join(', '),
            description: descriptionInput?.value || '',
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
                        handleLineBindingProcess(bindBtn, currentCreatedRowId);
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
   2. 綁定處理邏輯 (特別優化 iOS)
   ---------------------------------------------------- */
async function handleLineBindingProcess(btnElem, rowId) {
    if (!rowId) {
        alert('找不到預約單號，請重新提交表單');
        return;
    }

    if (isBoundSuccess) {
        window.location.href = OFFICIAL_LINE_URL;
        return;
    }

    btnElem.style.pointerEvents = 'none';
    btnElem.style.opacity = '0.85';
    btnElem.innerHTML = '⏳ 綁定處理中，請稍候...';

    if (typeof liff !== 'undefined') {
        if (!liff.isLoggedIn()) {
            const cleanUrl = window.location.origin + window.location.pathname;
            const redirectTarget = `${cleanUrl}?bindRowId=${rowId}`;

            liff.login({
                redirectUri: redirectTarget,
                botPrompt: 'aggressive'
            });
            return;
        }

        await executeAutoBind(rowId);
    } else {
        alert('LINE SDK 載入失敗');
    }
}

/* ----------------------------------------------------
   3. 背景發送 POST 給 GAS (寫入 ID + 發推播)
   ---------------------------------------------------- */
async function executeAutoBind(rowId) {
    const bindBtn = document.getElementById('lineBindBtn');
    try {
        const profile = await liff.getProfile();
        const userId = profile.userId;

        if (!userId) throw new Error('無法取得 LINE User ID');

        await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'bindLine',
                rowId: rowId,
                clientUserId: userId
            })
        });

        localStorage.removeItem('pending_bind_row_id');
        isBoundSuccess = true;

        if (bindBtn) {
            bindBtn.style.pointerEvents = 'auto';
            bindBtn.style.opacity = '1';
            bindBtn.style.backgroundColor = '#00B900';
            bindBtn.innerHTML = '✅ 綁定成功！點此前往官方 LINE';
            
            bindBtn.onclick = function(e) {
                e.preventDefault();
                window.location.href = OFFICIAL_LINE_URL;
            };
        }
    } catch (err) {
        console.error('背景綁定失敗:', err);
        localStorage.removeItem('pending_bind_row_id');
        isBoundSuccess = true;
        if (bindBtn) {
            bindBtn.style.pointerEvents = 'auto';
            bindBtn.style.opacity = '1';
            bindBtn.innerHTML = '點此前往官方 LINE';
            bindBtn.onclick = function(e) {
                e.preventDefault();
                window.location.href = OFFICIAL_LINE_URL;
            };
        }
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
