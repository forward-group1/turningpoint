const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby8NlePGVKzMRI3enrV8fI8xndRowhWXUBY5nMrHkTPQXH0AK2N4KIssQMtyM0N0envkg/exec';
const LIFF_ID = '2011796780-42NFl2WH'; 
const OFFICIAL_LINE_URL = 'https://line.me/R/ti/p/@885xpnyp'; // 官方 LINE 連結 (改用深層跳轉)

let currentCreatedRowId = null;
let isBoundSuccess = false;

// 判斷是否為 iOS 裝置 (iPhone / iPad)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

document.addEventListener('DOMContentLoaded', async function() {
    // 0. 初始化日期選擇器：禁用「今天、過去日期、週六、週日」
    setupDatePickerPicker();

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
   日期選擇器初始化：跨平台強制使用 Flatpickr 月曆
   ---------------------------------------------------- */
function setupDatePickerPicker() {
    // 取得明天的日期
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const datePickerConfig = {
        locale: 'zh_tw',            // 繁體中文
        dateFormat: 'Y-m-d',        // 日期格式
        minDate: tomorrow,          // 最小可選日期為「明天」（今天與過去自動禁選）
        disable: [
            function(date) {
                // 回傳 true 代表該日期要禁選 (0: 星期日, 6: 星期六)
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
   通用工具：HTML5 原生氣泡提示
   ---------------------------------------------------- */
function showCustomValidity(element, message) {
    if (!element) return;
    
    // 設定客製化錯誤訊息並觸發瀏覽器氣泡
    element.setCustomValidity(message);
    element.reportValidity();

    // 當使用者輸入或修改時，自動清除錯誤訊息
    const clearValidity = () => {
        element.setCustomValidity('');
        element.removeEventListener('input', clearValidity);
        element.removeEventListener('change', clearValidity);
    };
    element.addEventListener('input', clearValidity);
    element.addEventListener('change', clearValidity);
}

/* ----------------------------------------------------
   日期驗證核心函式 (雙重防呆驗證)
   ---------------------------------------------------- */
function validateBookingDate(dateInput, slotName) {
    if (!dateInput) return false;
    
    const rawVal = dateInput.value;
    if (!rawVal) {
        showCustomValidity(dateInput, `請選擇${slotName}的預預約日期！`);
        return false;
    }

    const selectedDate = new Date(rawVal + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. 驗證不能選擇「今天」或「過去的日期」
    if (selectedDate <= today) {
        showCustomValidity(dateInput, `${slotName}的日期不可選擇「今天」或「過去日期」，請選擇明天之後的預約日期！`);
        return false;
    }

    // 2. 驗證不能選擇「假日（星期六 / 星期日）」
    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        showCustomValidity(dateInput, `${slotName}選擇的日期為週末假日，請選擇平工作日（週一至週五）！`);
        return false;
    }

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
   1. 表單提交處理
   ---------------------------------------------------- */
function initFormSubmit() {
    const form = document.getElementById('consultForm');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();

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
