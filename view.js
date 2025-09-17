// view.js

// --- 전역 변수 및 DOM 요소 ---
const lockScreen = document.getElementById('lock-screen');
const mainContent = document.getElementById('main-content');
const settingsView = document.getElementById('settings-view');
const passwordInput = document.getElementById('password-input');
const unlockButton = document.getElementById('unlock-button');
const messageArea = document.getElementById('message-area');
const dataInput = document.getElementById('dataInput');
const dataList = document.getElementById('dataList');
const settingsButton = document.getElementById('settings-button');
const backButton = document.getElementById('back-button');
const lockToggle = document.getElementById('lock-toggle');
const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const changePasswordButton = document.getElementById('change-password-button');
const settingsMessageArea = document.getElementById('settings-message-area');
let currentKey = null; // currentKey는 view와 event 모두에서 사용되므로 view.js에 둡니다.
const customModal = document.getElementById('custom-modal');
const modalMessage = document.getElementById('modal-message');
const modalInput = document.getElementById('modal-input');
const modalOkButton = document.getElementById('modal-ok');
const modalCancelButton = document.getElementById('modal-cancel');
const storageText = document.getElementById('storage-text');
const storageProgressBar = document.getElementById('storage-progress-bar');


// --- UI 상태 변경 함수 ---
function showMainContent() {
    lockScreen.style.display = 'none';
    mainContent.style.display = 'block';
    settingsView.style.display = 'none';
    passwordInput.value = '';
    renderDataList();
}

function showSettings() {
    mainContent.style.display = 'none';
    settingsView.style.display = 'block';
    settingsMessageArea.textContent = '';
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    getStorageData('useLock').then(({ useLock }) => {
        lockToggle.checked = !!useLock;
    });
}

function showLockScreen() {
    lockScreen.style.display = 'block';
    mainContent.style.display = 'none';
    settingsView.style.display = 'none';
}

function showCustomAlert(message) {
    modalMessage.textContent = message;
    modalInput.style.display = 'none';
    modalOkButton.style.display = 'inline-block';
    modalCancelButton.style.display = 'none';
    customModal.style.display = 'flex';

    return new Promise((resolve) => {
        modalOkButton.onclick = () => {
            customModal.style.display = 'none';
            resolve(true);
        };
    });
}

function showCustomPrompt(message) {
    modalMessage.textContent = message;
    modalInput.value = '';
    modalInput.style.display = 'block';
    modalOkButton.style.display = 'inline-block';
    modalCancelButton.style.display = 'inline-block';
    customModal.style.display = 'flex';

    return new Promise((resolve) => {
        modalOkButton.onclick = () => {
            customModal.style.display = 'none';
            resolve(modalInput.value);
        };
        modalCancelButton.onclick = () => {
            customModal.style.display = 'none';
            resolve(null); // 취소 시 null 반환
        };
    });
}


// --- 데이터 렌더링 함수 ---
async function renderDataList() {
    const items = await getItems(currentKey);
    if (items === null) { 
        showLockScreen(); 
        messageArea.textContent = '데이터를 불러오는 데 실패했습니다.'; 
        return; 
    }
    
    // 배열이 아닌 경우 빈 배열로 초기화
    if (!Array.isArray(items)) {
        console.warn("items가 배열이 아닙니다. 빈 배열로 처리합니다.", items);
        dataList.innerHTML = '';
        await updateStorageUsage();
        return;
    }
    
    dataList.innerHTML = '';
    items.forEach((item, index) => {
        const li = document.createElement('li');
        if (item.type === 'image') {
            const img = document.createElement('img');
            img.src = item.content;
            li.appendChild(img);
        } else if (item.type === 'table') {
            li.innerHTML = item.content;
        } else if (item.type === 'code') {
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.textContent = item.content;
            pre.appendChild(code);
            li.appendChild(pre);
        } else {
            const pre = document.createElement('pre');
            pre.textContent = item.content;
            li.appendChild(pre);
        }
        
        li.dataset.index = index;
        dataList.appendChild(li);
    });
    await updateStorageUsage();
}

async function updateStorageUsage() {
    const QUOTA_BYTES = chrome.storage.local.QUOTA_BYTES; // 5MB
    const bytesInUse = await new Promise(resolve => chrome.storage.local.getBytesInUse(null, resolve));
    
    const usagePercent = (bytesInUse / QUOTA_BYTES) * 100;
    const usedMB = (bytesInUse / 1024 / 1024).toFixed(2);
    const totalMB = (QUOTA_BYTES / 1024 / 1024).toFixed(2);

    storageText.textContent = `사용량: ${usedMB}MB / ${totalMB}MB (${usagePercent.toFixed(2)}%)`;
    storageProgressBar.style.width = `${usagePercent}%`;

    // 사용량에 따라 프로그레스 바 색상 변경
    if (usagePercent > 90) {
        storageProgressBar.style.backgroundColor = '#f44336'; // 빨강
    } else if (usagePercent > 70) {
        storageProgressBar.style.backgroundColor = '#ff9800'; // 주황
    } else {
        storageProgressBar.style.backgroundColor = '#4caf50'; // 초록
    }
}
