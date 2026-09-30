// 1. 替換為 Make (Integromat) 的 Custom Webhook URL
const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/nkvl8lkkv1zaxiu2bp3vxvo8abpkcru2'; // 請替換為您的 Make Webhook 網址
const LIFF_ID = "2011796780-42NFl2WH";

fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    mode: 'cors', // 新增此行
    body: JSON.stringify(formData)
})

document.addEventListener('DOMContentLoaded', function() {
    
    // 初始化 LIFF SDK 取得客戶 LINE User ID
    if (typeof liff !== 'undefined') {
        liff.init({ liffId: 'LIFF_ID' })
            .then(() => {
                if (liff.isLoggedIn()) {
                    liff.getProfile().then(profile => {
                        const userId = profile.userId;
                        const clientInput = document.getElementById('clientUserId');
                        if (clientInput) {
                            clientInput.value = userId;
                        }
                        console.log("成功取得 LINE User ID:", userId);
                    }).catch(err => console.error("取得 Profile 失敗:", err));
                } else {
                    liff.login();
                }
            })
            .catch(err => console.error("LIFF 初始化失敗:", err));
    }

    // 設定日期選擇器最小日期
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    ['bookingDate1', 'bookingDate2', 'bookingDate3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('min', minDate);
    });

    // 表單提交處理
   // 請確保填入 Make 的 Custom Webhook 網址
const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/你的專屬網址';

// 輔助函式：取得單選按鈕 (Radio) 的值
function getRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : '';
}

// 輔助函式：取得多選按鈕 (Checkbox) 的所有選取值
function getCheckboxValues(name) {
    const checkedBoxes = document.querySelectorAll(`input[name="${name}"]:checked`);
    return Array.from(checkedBoxes).map(cb => cb.value).join(', ');
}

// 輔助函式：組合日期與時間
function getBookingSlot(dateId, timeId) {
    const dateVal = document.getElementById(dateId)?.value || '';
    const timeVal = document.getElementById(timeId)?.value || '';
    if (dateVal && timeVal) {
        return `${dateVal} ${timeVal}`;
    }
    return dateVal || timeVal || '';
}

// 表單送出事件處理
async function handleSubmit(event) {
    event.preventDefault(); // 防止頁面刷新

    // 1. 打包表單資料為 JSON
    const formData = {
        // LINE 用戶識別碼（若有整合 LIFF 可填，無則為空）
        lineUserId: typeof liff !== 'undefined' && liff.isLoggedIn() ? (await liff.getProfile()).userId : '',
        
        // 基本資料
        companyName: document.getElementById('companyName')?.value || '',         // 1. 公司名稱
        userName: document.getElementById('userName')?.value || '',               // 2. 承辦姓名
        jobTitle: document.getElementById('jobTitle')?.value || '',               // 3. 職稱
        phone: document.getElementById('phone')?.value || '',                     // 4. 聯絡電話
        email: document.getElementById('email')?.value || '',                     // 5. 電子郵件
        industry: document.getElementById('industry')?.value || '',               // 6. 產業類別
        
        // 選項調查
        companySize: getRadioValue('companySize'),                               // 7. 公司規模
        issues: getCheckboxValues('issues'),                                     // 8. 勞務議題(多選)
        description: document.getElementById('description')?.value || '',         // 9. 具體爭議
        pastExperience: getRadioValue('pastExperience'),                         // 10. 過去經驗
        externalConsultant: getRadioValue('externalConsultant'),                 // 11. 外部顧問
        
        // 預約時段
        booking1: getBookingSlot('bookingDate1', 'bookingTime1'),                 // 時段一
        booking2: getBookingSlot('bookingDate2', 'bookingTime2'),                 // 時段二
        booking3: getBookingSlot('bookingDate3', 'bookingTime3'),                 // 時段三
        
        // 同意條款
        consent: document.getElementById('consent')?.checked ? '是' : '否',        // 個資同意
        timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) // 填寫時間
    };

    console.log('準備發送至 Make 的資料：', formData);

    try {
        // 2. 發送資料至 Make Webhook
        const response = await fetch(MAKE_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            mode: 'cors',
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('表單已成功送出！我們將儘速與您聯繫。');
            document.getElementById('yourFormId').reset(); // 重置表單 (請替換為您的 form ID)
        } else {
            alert('送出失敗，請稍後再試。');
        }
    } catch (error) {
        console.error('送出錯誤：', error);
        alert('網路連線異常，請重新嘗試！');
    }
}
            // 4. 發送至 Make Webhook
            fetch(MAKE_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })
            .then(response => {
                if (response.ok) {
                    alert('感謝您的申請！資料已成功送出，請至您的 LINE 聊天室確認預約訊息。');
                    
                    if (typeof liff !== 'undefined' && liff.isInClient()) {
                        liff.closeWindow(); // 若在 LINE APP 內開 LIFF，送出後自動關閉視窗
                    } else {
                        window.location.href = 'https://page.line.me/885xpnyp?oat_content=url&openQrModal=true';
                    }
                } else {
                    throw new Error('Webhook 回應異常');
                }
            })
            .catch(error => {
                console.error('Webhook 發送失敗:', error);
                alert('資料發送失敗，請稍後再試或直接聯繫客服。');
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.querySelector('span').innerText = '送出試用申請';
            });
        });
    }
});
