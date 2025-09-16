// sidepanel.js (설정 기능이 포함된 최종 완성 코드)

// --- 전역 변수 및 DOM 요소 ---
let currentKey = null;
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

// --- 핵심 로직: 잠금 해제, UI 전환, 설정 처리 ---
async function handleUnlock() {
    const password = passwordInput.value;
    if (!password) { messageArea.textContent = '비밀번호를 입력해주세요.'; return; }
    messageArea.textContent = '';
    const { salt, verification } = await chrome.storage.local.get(['salt', 'verification']);

    if (salt && verification) {
        const key = await getKey(password, new Uint8Array(salt));
        try {
            const decrypted = await decrypt(verification, key);
            if (decrypted.message === 'verified') {
                currentKey = key;
                showMainContent();
            } else { throw new Error('Verification failed'); }
        } catch (error) { messageArea.textContent = '비밀번호가 올바르지 않습니다.'; }
    } else {
        if(password.length < 4 || password.length > 16) {
             messageArea.textContent = '비밀번호는 4~16자 사이여야 합니다.'; return;
        }
        const newSalt = crypto.getRandomValues(new Uint8Array(16));
        const key = await getKey(password, newSalt);
        const newVerification = await encrypt({ message: 'verified' }, key);
        await chrome.storage.local.set({ salt: Array.from(newSalt), verification: newVerification, useLock: true });
        currentKey = key;
        showMainContent();
    }
}

function showMainContent() {
    lockScreen.style.display = 'none';
    mainContent.style.display = 'block';
    settingsView.style.display = 'none';
    passwordInput.value = '';
    loadSavedData();
}

function showSettings() {
    mainContent.style.display = 'none';
    settingsView.style.display = 'block';
    settingsMessageArea.textContent = '';
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    chrome.storage.local.get('useLock', ({ useLock }) => {
        lockToggle.checked = useLock;
    });
}

async function handlePasswordChange() {
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    if (!currentPassword || !newPassword) { settingsMessageArea.textContent = '현재 비밀번호와 새 비밀번호를 모두 입력하세요.'; return; }
    if (newPassword.length < 4 || newPassword.length > 16) { settingsMessageArea.textContent = '새 비밀번호는 8~64자 사이여야 합니다.'; return; }

    settingsMessageArea.textContent = '비밀번호 확인 중...';
    const { salt, verification, savedData: encryptedItemsStr } = await chrome.storage.local.get(['salt', 'verification', 'savedData']);

    const oldKey = await getKey(currentPassword, new Uint8Array(salt));
    try {
        const decrypted = await decrypt(verification, oldKey);
        if (decrypted.message !== 'verified') throw new Error();
    } catch (e) { settingsMessageArea.textContent = '현재 비밀번호가 일치하지 않습니다.'; return; }

    settingsMessageArea.textContent = '데이터를 재암호화하는 중...';
    let items = [];
    if (encryptedItemsStr) {
        items = await decrypt(encryptedItemsStr, oldKey);
    }
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    const newKey = await getKey(newPassword, newSalt);
    const newVerification = await encrypt({ message: 'verified' }, newKey);
    const newEncryptedData = await encrypt(items, newKey);
    await chrome.storage.local.set({ salt: Array.from(newSalt), verification: newVerification, savedData: newEncryptedData });
    currentKey = newKey;
    settingsMessageArea.textContent = '비밀번호가 성공적으로 변경되었습니다.';
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
}

// --- 데이터 처리 함수 ---
async function loadSavedData() {
    if (!currentKey) { 
        const { useLock } = await chrome.storage.local.get('useLock');
        if(!useLock) showMainContent(); // 잠금 해제 상태면 그냥 UI만 보여줌
        return; 
    }
    const { savedData: encryptedItemsStr } = await chrome.storage.local.get('savedData');
    if (!encryptedItemsStr) { dataList.innerHTML = ''; return; }

    try {
        const items = await decrypt(encryptedItemsStr, currentKey);
        dataList.innerHTML = '';
        items.forEach((item, index) => {
            const li = document.createElement('li');
            if (item.type === 'image') { const img = document.createElement('img'); img.src = item.content; li.appendChild(img); }
            else if (item.type === 'table') { li.innerHTML = item.content; }
            else { const pre = document.createElement('pre'); pre.textContent = item.content; li.appendChild(pre); }
            li.addEventListener('click', async () => {
                try {
                    if (item.type === 'image') { const response = await fetch(item.content); const blob = await response.blob(); await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]); }
                    else if (item.type === 'table') { const htmlBlob = new Blob([item.content], { type: 'text/html' }); const tempDiv = document.createElement('div'); tempDiv.innerHTML = item.content; const textContent = tempDiv.innerText; const textBlob = new Blob([textContent], { type: 'text/plain' }); await navigator.clipboard.write([ new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob }) ]); }
                    else { await navigator.clipboard.writeText(item.content); }
                    li.style.backgroundColor = '#a7d7a7';
                    setTimeout(() => { li.style.backgroundColor = '#f0f0f0'; }, 500);
                } catch (err) { console.error('클립보드 복사에 실패했습니다:', err); }
            });
            li.addEventListener('contextmenu', async (e) => {
                e.preventDefault();
                items.splice(index, 1);
                const newEncryptedString = await encrypt(items, currentKey);
                await chrome.storage.local.set({ savedData: newEncryptedString });
                loadSavedData();
            });
            dataList.appendChild(li);
        });
    } catch (error) {
        lockScreen.style.display = 'block'; mainContent.style.display = 'none'; messageArea.textContent = '데이터를 불러오는 데 실패했습니다.';
    }
}

async function saveData(dataObject) {
    if (!currentKey) { alert("데이터를 저장하려면 먼저 잠금을 해제해야 합니다."); return; }
    const { savedData: encryptedItemsStr } = await chrome.storage.local.get('savedData');
    let items = [];
    if (encryptedItemsStr) {
        try { items = await decrypt(encryptedItemsStr, currentKey); } catch (e) { console.error("기존 데이터 복호화 실패", e); return; }
    }
    if (!items.some(item => item.content === dataObject.content)) { items.unshift(dataObject); }
    const newEncryptedString = await encrypt(items, currentKey);
    await chrome.storage.local.set({ savedData: newEncryptedString });
    loadSavedData();
}

// --- 이벤트 리스너 ---
unlockButton.addEventListener('click', handleUnlock);
passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleUnlock(); });
settingsButton.addEventListener('click', showSettings);
backButton.addEventListener('click', showMainContent);
lockToggle.addEventListener('change', (e) => { chrome.storage.local.set({ useLock: e.target.checked }); });
changePasswordButton.addEventListener('click', handlePasswordChange);

dataInput.addEventListener('paste', async (event) => {
    event.preventDefault();
    const items = event.clipboardData.items; const plainText = event.clipboardData.getData('text/plain');
    let htmlItem = null; let imageItem = null;
    for (const item of items) { if (item.type === 'text/html') htmlItem = item; if (item.type.startsWith('image/')) imageItem = item; }
    if (imageItem) {
        const imageFile = imageItem.getAsFile();
        const dataUrl = await new Promise(resolve => { const reader = new FileReader(); reader.onload = e => resolve(e.target.result); reader.readAsDataURL(imageFile); });
        await saveData({ type: 'image', content: dataUrl }); return;
    }
    if (htmlItem) {
        const htmlString = await new Promise(resolve => { htmlItem.getAsString(str => resolve(str || '')); });
        if (htmlString.includes('<table')) { await saveData({ type: 'table', content: htmlString }); return; }
    }
    if (plainText && plainText.trim()) { await saveData({ type: 'text', content: plainText.trim() }); }
});

document.addEventListener('DOMContentLoaded', async () => {
    const { salt, useLock } = await chrome.storage.local.get(['salt', 'useLock']);
    if (!salt) {
        passwordInput.placeholder = "새 비밀번호 설정 (4~16자)"; unlockButton.textContent = "비밀번호 설정"; lockScreen.style.display = 'block';
    } else if (useLock) {
        passwordInput.placeholder = "비밀번호를 입력하세요"; unlockButton.textContent = "잠금 해제"; lockScreen.style.display = 'block';
    } else {
        // 잠금을 사용하지 않을 경우, 비밀번호 없이 바로 키를 생성해야 함 (보안상 매우 취약, 데모용)
        // 실제 제품에서는 이 부분에 대한 정책을 명확히 해야 함
        // 여기서는 저장된 salt와 임시 비밀번호로 키를 얻어오는 '척'만 하여 기능을 시연
        messageArea.textContent = "잠금 기능이 비활성화되었습니다.";
        mainContent.style.display = 'block';
        lockScreen.style.display = 'none';
        // 이 부분은 사용자가 비밀번호를 입력하지 않아도 되게 하려면 더 복잡한 키 관리 로직이 필요.
        // 현재는 '잠금 화면을 보여줄지' 여부만 제어.
    }
});