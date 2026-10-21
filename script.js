const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const OFFICIAL_LINE_URL = 'https://line.me/R/ti/p/@885xpnyp'; // 官方 LINE 深層跳轉連結

let currentCreatedRowId = null;
let isBoundSuccess = false;

// 判斷是否為 iOS 裝置 (iPhone / iPad)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

document.addEventListener('DOMContentLoaded', async function() {
    // 0. 初始化日期選擇器：禁用「今天、過去日期、週六、週日」
    setupDatePickerPicker();

    // 1. 綁定「其他」選項連動顯示/隱藏自訂輸入框的事件
    const otherCheckbox = document.getElementById('otherNeedCheckbox');
    const otherInputContainer = document.getElementById('otherNeedInputContainer');
    if (otherCheckbox && otherInputContainer) {
        otherCheckbox.addEventListener('change', function() {
            otherInputContainer.style.display = this.checked ? 'block' : 'none';
            if (!this.checked) {
                document.getElementById('otherNeedText').value = '';
            }
        });
    }

    // 2. 初始化 LIFF SDK
    if (typeof liff !== 'undefined') {
        try {
            await liff.init({ liffId: LIFF_ID });
            console.log('LIFF 初始化完成');
        } catch (err) {
            console.error('LIFF Init error:', err);
        }
    }

    // 3. 檢查 URL 是否帶有 iOS 跳轉回來的 bindRowId 參數
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
   日期選擇器初始化：跨平台強制使用 Flatpickr 月曆
   ---------------------------------------------------- */
function setupDatePickerPicker() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const datePickerConfig = {
        locale: 'zh_tw',            // 繁體中文
        dateFormat: 'Y-m-d',        // 日期格式
        minDate: tomorrow,          // 最小可選日期為「明天」
        disable: [
            function(date) {
                return (date.getDay() === 0 || date.getDay() === 6);
            }
        ],
        disableMobile: true         // 強制禁止調用手機原生月曆
    };

    ['bookingDate1', 'bookingDate2', 'bookingDate3'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem && typeof flatpickr !== 'undefined') {
            flatpickr(elem, datePickerConfig);
        }
    });
}

/* ----------------------------------------------------
   日期驗證核心函式 (雙重防呆驗證)
   ---------------------------------------------------- */
function validateBookingDate(dateInput, slotName) {
    if (!dateInput) return false;
    
    const rawVal = dateInput.value;
    if (!rawVal) {
        dateInput.setCustomValidity(`請選擇${slotName}的預約日期！`);
        dateInput.reportValidity();
        dateInput.focus();
        dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }

    const selectedDate = new Date(rawVal + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
        dateInput.setCustomValidity(`${slotName}的日期不可選擇「今天」或「過去日期」，請選擇明天之後的預約日期！`);
        dateInput.reportValidity();
        dateInput.focus();
        dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }

    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        dateInput.setCustomValidity(`${slotName}選擇的日期為週末假日，請選擇平工作日（週一至週五）！`);
        dateInput.reportValidity();
        dateInput.focus();
        dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }

    dateInput.setCustomValidity('');
    return true;
}

/* ----------------------------------------------------
   台灣電話 / 手機格式驗證函式
   ---------------------------------------------------- */
function isValidTaiwanPhone(phoneStr) {
    if (!phoneStr) return false;

    const cleanPhone = phoneStr.trim().replace(/[\s-]/g, '');

    if (/^(\d)\1+$/.test(cleanPhone.split('#')[0].split('分機')[0])) {
        return false;
    }

    const mobileRegex = /^09\d{8}$/;
    if (mobileRegex.test(cleanPhone)) {
        return true;
    }

    const telRegex = /^(02|03|037|04|049|05|06|07|08|082|0836)\d{6,8}(?:(?:#|分機|ext\.?)\d{1,6})?$/i;
    if (telRegex.test(cleanPhone)) {
        return true;
    }

    return false;
}

/* ----------------------------------------------------
   1. 表單提交處理（1-14題全面統一使用瀏覽器原生提示泡泡）
   ---------------------------------------------------- */
function initFormSubmit() {
    const form = document.getElementById('consultForm');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // 1. 公司名稱驗證
        const companyNameInput = document.getElementById('companyName');
        if (!companyNameInput || !companyNameInput.value.trim()) {
            if (companyNameInput) {
                companyNameInput.setCustomValidity('請填寫公司名稱！');
                companyNameInput.reportValidity();
                companyNameInput.focus();
                companyNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else {
            companyNameInput.setCustomValidity('');
        }

        // 2. 產業類別驗證
        const industryInput = document.getElementById('industry');
        if (!industryInput || !industryInput.value.trim()) {
            if (industryInput) {
                industryInput.setCustomValidity('請填寫貴公司的產業類別！');
                industryInput.reportValidity();
                industryInput.focus();
                industryInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else {
            industryInput.setCustomValidity('');
        }

        // 3. 承辦姓名驗證
        const userNameInput = document.getElementById('userName');
        if (!userNameInput || !userNameInput.value.trim()) {
            if (userNameInput) {
                userNameInput.setCustomValidity('請填寫承辦姓名！');
                userNameInput.reportValidity();
                userNameInput.focus();
                userNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else {
            userNameInput.setCustomValidity('');
        }

        // 4. 職稱驗證
        const jobTitleSelect = document.getElementById('jobTitle');
        if (!jobTitleSelect || !jobTitleSelect.value) {
            if (jobTitleSelect) {
                jobTitleSelect.setCustomValidity('請選擇職稱！');
                jobTitleSelect.reportValidity();
                jobTitleSelect.focus();
                jobTitleSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else {
            jobTitleSelect.setCustomValidity('');
        }

        // 5. 聯絡電話驗證
        const phoneInput = document.getElementById('phone');
        const phoneValue = phoneInput ? phoneInput.value.trim() : '';
        if (!phoneInput || !phoneValue) {
            if (phoneInput) {
                phoneInput.setCustomValidity('請填寫聯絡電話！');
                phoneInput.reportValidity();
                phoneInput.focus();
                phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else if (!isValidTaiwanPhone(phoneValue)) {
            if (phoneInput) {
                phoneInput.setCustomValidity('請輸入有效的電話號碼（例如：0912345678 或 03-1234567#123）');
                phoneInput.reportValidity();
                phoneInput.focus();
                phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else {
            phoneInput.setCustomValidity('');
        }

        // 6. 電子郵件驗證
        const emailInput = document.getElementById('email');
        const emailValue = emailInput ? emailInput.value.trim() : '';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailInput || !emailValue) {
            if (emailInput) {
                emailInput.setCustomValidity('請填寫電子郵件！');
                emailInput.reportValidity();
                emailInput.focus();
                emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else if (!emailRegex.test(emailValue)) {
            if (emailInput) {
                emailInput.setCustomValidity('請輸入有效的電子郵件地址！');
                emailInput.reportValidity();
                emailInput.focus();
                emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else {
            emailInput.setCustomValidity('');
        }

        // 7. 公司規模驗證 (單選)
        const companySizeRadios = document.querySelectorAll('input[name="companySize"]');
        const companySizeSelected = document.querySelector('input[name="companySize"]:checked');
        if (!companySizeSelected) {
            const firstRadio = document.querySelector('input[name="companySize"]');
            if (firstRadio) {
                companySizeRadios.forEach(r => r.setCustomValidity('')); // 先清空其他
                firstRadio.setCustomValidity('請選擇公司規模！');
                firstRadio.reportValidity();
                firstRadio.focus();
                firstRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else {
            companySizeRadios.forEach(r => r.setCustomValidity(''));
        }

        // 8. 主要需求驗證 (複選：mainNeeds)
        const mainNeedsCheckboxes = document.querySelectorAll('input[name="mainNeeds"]');
        const selectedMainNeeds = Array.from(document.querySelectorAll('input[name="mainNeeds"]:checked')).map(cb => {
            if (cb.value === '其他') {
                const customText = document.getElementById('otherNeedText').value.trim();
                return customText ? `其他：${customText}` : '其他';
            }
            return cb.value;
        });
        if (selectedMainNeeds.length === 0) {
            const firstNeed = document.querySelector('input[name="mainNeeds"]');
            if (firstNeed) {
                mainNeedsCheckboxes.forEach(cb => cb.setCustomValidity(''));
                firstNeed.setCustomValidity('請至少勾選一項「8. 主要需求」！');
                firstNeed.reportValidity();
                firstNeed.focus();
                firstNeed.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else {
            mainNeedsCheckboxes.forEach(cb => cb.setCustomValidity(''));
        }

        // 9. 希望協助解決的問題驗證 (四格卡片複選：helpIssues)
        const helpIssuesCheckboxes = document.querySelectorAll('input[name="helpIssues"]');
        const selectedHelpIssues = Array.from(document.querySelectorAll('input[name="helpIssues"]:checked')).map(cb => cb.value);
        if (selectedHelpIssues.length === 0) {
            const firstIssue = document.querySelector('input[name="helpIssues"]');
            if (firstIssue) {
                helpIssuesCheckboxes.forEach(cb => cb.setCustomValidity(''));
                firstIssue.setCustomValidity('請至少選擇一項「9. 希望協助解決的問題」！');
                firstIssue.reportValidity();
                firstIssue.focus();
                firstIssue.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else {
            helpIssuesCheckboxes.forEach(cb => cb.setCustomValidity(''));
        }

        // 10. 具體爭議與遭遇的問題驗證
        const descriptionInput = document.getElementById('description');
        if (!descriptionInput || !descriptionInput.value.trim()) {
            if (descriptionInput) {
                descriptionInput.setCustomValidity('請填寫具體爭議與遭遇的問題！');
                descriptionInput.reportValidity();
                descriptionInput.focus();
                descriptionInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else {
            descriptionInput.setCustomValidity('');
        }

        // 11. 需求急迫程度驗證 (單選：urgency)
        const urgencyRadios = document.querySelectorAll('input[name="urgency"]');
        const urgencySelected = document.querySelector('input[name="urgency"]:checked');
        if (!urgencySelected) {
            const firstUrgency = document.querySelector('input[name="urgency"]');
            if (firstUrgency) {
                urgencyRadios.forEach(r => r.setCustomValidity(''));
                firstUrgency.setCustomValidity('請選擇需求急迫程度！');
                firstUrgency.reportValidity();
                firstUrgency.focus();
                firstUrgency.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        } else {
            urgencyRadios.forEach(r => r.setCustomValidity(''));
        }

        // 14. 期望諮詢日期與時間驗證 (時段一、二、三)
        const bookingDate1 = document.getElementById('bookingDate1');
        const bookingTime1 = document.getElementById('bookingTime1');
        if (!validateBookingDate(bookingDate1, '時段一')) return;
        if (bookingTime1 && !bookingTime1.value) {
            bookingTime1.setCustomValidity('請選擇時段一的預約時間！');
            bookingTime1.reportValidity();
            bookingTime1.focus();
            bookingTime1.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        } else if (bookingTime1) {
            bookingTime1.setCustomValidity('');
        }

        const bookingDate2 = document.getElementById('bookingDate2');
        const bookingTime2 = document.getElementById('bookingTime2');
        if (!validateBookingDate(bookingDate2, '時段二')) return;
        if (bookingTime2 && !bookingTime2.value) {
            bookingTime2.setCustomValidity('請選擇時段二的預約時間！');
            bookingTime2.reportValidity();
            bookingTime2.focus();
            bookingTime2.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        } else if (bookingTime2) {
            bookingTime2.setCustomValidity('');
        }

        const bookingDate3 = document.getElementById('bookingDate3');
        const bookingTime3 = document.getElementById('bookingTime3');
        if (!validateBookingDate(bookingDate3, '時段三')) return;
        if (bookingTime3 && !bookingTime3.value) {
            bookingTime3.setCustomValidity('請選擇時段三的預約時間！');
            bookingTime3.reportValidity();
            bookingTime3.focus();
            bookingTime3.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        } else if (bookingTime3) {
            bookingTime3.setCustomValidity('');
        }

        // 同意條款勾選驗證
        const consentCheckbox = document.getElementById('consent');
        if (consentCheckbox && !consentCheckbox.checked) {
            consentCheckbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            consentCheckbox.focus();
            consentCheckbox.setCustomValidity('請勾選同意個人資料保護條款以繼續提交！');
            consentCheckbox.reportValidity();
            return;
        } else if (consentCheckbox) {
            consentCheckbox.setCustomValidity('');
        }

        // 鎖定送出按鈕
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            const btnSpan = submitBtn.querySelector('span') || submitBtn;
            btnSpan.innerText = '資料處理中...';
        }

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
            companySize: document.querySelector('input[name="companySize"]:checked')?.value || '',
            mainNeeds: selectedMainNeeds.join(', '), 
            issues: selectedHelpIssues.join(', '),     
            description: descriptionInput?.value || '',
            urgency: document.querySelector('input[name="urgency"]:checked')?.value || '',
            pastExperience: document.querySelector('input[name="pastExperience"]:checked')?.value || '',
            externalConsultant: document.querySelector('input[name="externalConsultant"]:checked')?.value || '',
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
   2. 綁定處理邏輯 (含好友狀態檢查與強效提示)
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
        const cleanUrl = window.location.origin + window.location.pathname;
        const redirectTarget = `${cleanUrl}?bindRowId=${rowId}`;

        if (!liff.isLoggedIn()) {
            liff.login({
                redirectUri: redirectTarget,
                botPrompt: 'aggressive'
            });
            return;
        }

        try {
            const friendship = await liff.getFriendship();
            if (!friendship.friendFlag) {
                liff.login({
                    redirectUri: redirectTarget,
                    botPrompt: 'aggressive'
                });
                return;
            }
        } catch (fErr) {
            console.warn('無法取得好友狀態，繼續執行綁定:', fErr);
        }

        await executeAutoBind(rowId);
    } else {
        alert('LINE SDK 載入失敗');
    }
}

/* ----------------------------------------------------
   3. 背景發送 POST 給 GAS (寫入名稱、User ID + 發推播)
   ---------------------------------------------------- */
async function executeAutoBind(rowId) {
    const bindBtn = document.getElementById('lineBindBtn');
    try {
        const profile = await liff.getProfile();
        const userId = profile.userId;
        const displayName = profile.displayName || '';

        if (!userId) throw new Error('無法取得 LINE User ID');

        await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'bindLine',
                rowId: rowId,
                clientUserId: userId,
                displayName: displayName
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
