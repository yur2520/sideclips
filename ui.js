// ui.js (설정 UI 로직이 추가된 최종 버전)

// --- UI 제어 및 이벤트 처리 담당 ---

// --- 전역 변수 및 DOM 요소 ---
let currentKey = null;
const lockScreen = document.getElementById('lock-screen');
const mainContent = document.getElementById('main-content');
const settingsView = document.getElementById('settings-view'); // 추가
const passwordInput = document.getElementById('password-input');
const unlockButton = document.getElementById('unlock-button');
const messageArea = document.getElementById('message-area');
const dataInput = document.getElementById('dataInput');
const dataList = document.getElementById('dataList');

// 설정 화면 요소 (추가)
const settingsButton = document.getElementById('settings-button');
const backButton = document.getElementById('back-button');
// (향후 기능 추가를 위한 나머지 설정 요소들)


// --- UI 상태 변경 함수 ---
function showMainContent() {
    lockScreen.style.display = 'none';
    mainContent.style.display = 'block';
    settingsView.style.display = 'none'; // 추가
    passwordInput.value = '';
    renderDataList();
}

function showSettings() { // 추가
    mainContent.style.display = 'none';
    settingsView.style.display = 'block';
}


// --- 데이터 렌더링 함수 ---
async function renderDataList() {
    if (!currentKey) return;

    const items = await getAllItems(currentKey);
    if (items === null) {
        lockScreen.style.display = 'block';
        mainContent.style.display = 'none';
        messageArea.textContent = '데이터를 불러오는 데 실패했습니다.';
        return;
    }

    dataList.innerHTML = '';
    items.forEach((item, index) => {
        const li = document.createElement('li');
        if (item.type === 'image') { const img = document.createElement('img'); img.src = item.content; li.appendChild(img); }
        else if (item.type === 'table') { li.innerHTML = item.content; }
        else { const pre = document.createElement('pre'); pre.textContent = item.content; li.appendChild(pre); }
        
        // --- 복사 기능 (누락되었던 부분 채움) ---
        li.addEventListener('click', async () => {
            try {
                if (item.type === 'image') {
                    const response = await fetch(item.content);
                    const blob = await response.blob();
                    await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
                } else if (item.type === 'table') {
                    const htmlBlob = new Blob([item.content], { type: 'text/html' });
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = item.content;
                    const textContent = tempDiv.innerText;
                    const textBlob = new Blob([textContent], { type: 'text/plain' });
                    await navigator.clipboard.write([ new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob }) ]);
                } else {
                    await navigator.clipboard.writeText(item.content);
                }
                li.style.backgroundColor = '#a7d7a7';
                setTimeout(() => { li.style.backgroundColor = '#f0f0f0'; }, 500);
            } catch (err) {
                console.error('클립보드 복사에 실패했습니다:', err);
            }
        });

        li.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            await deleteItem(index, currentKey);
            renderDataList();
        });
        dataList.appendChild(li);
    });
}


// --- 이벤트 리스너 ---
unlockButton.addEventListener('click', async () => {
    const password = passwordInput.value;
    if (!password) { messageArea.textContent = '비밀번호를 입력해주세요.'; return; }
    messageArea.textContent = '';
    const { salt, verification } = await getStorageData(['salt', 'verification']);

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
        const newSalt = crypto.getRandomValues(new Uint8Array(16));
        const key = await getKey(password, newSalt);
        const newVerification = await encrypt({ message: 'verified' }, key);
        // useLock: true도 함께 저장
        await setStorageData({ salt: Array.from(newSalt), verification: newVerification, savedData: null, useLock: true });
        currentKey = key;
        showMainContent();
    }
});

passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') unlockButton.click(); });

// 설정 버튼 및 뒤로가기 버튼 이벤트 리스너 (추가)
settingsButton.addEventListener('click', showSettings);
backButton.addEventListener('click', showMainContent);

dataInput.addEventListener('paste', async (event) => {
    event.preventDefault();
    if (!currentKey) { alert("데이터를 저장하려면 먼저 잠금을 해제해야 합니다."); return; }
    const items = event.clipboardData.items; const plainText = event.clipboardData.getData('text/plain');
    let htmlItem = null; let imageItem = null;
    for (const item of items) { if (item.type === 'text/html') htmlItem = item; if (item.type.startsWith('image/')) imageItem = item; }
    
    let newItem = null;
    if (imageItem) {
        const imageFile = imageItem.getAsFile();
        const dataUrl = await new Promise(resolve => { const reader = new FileReader(); reader.onload = e => resolve(e.target.result); reader.readAsDataURL(imageFile); });
        newItem = { type: 'image', content: dataUrl };
    } else if (htmlItem) {
        const htmlString = await new Promise(resolve => { htmlItem.getAsString(str => resolve(str || '')); });
        if (htmlString.includes('<table')) { newItem = { type: 'table', content: htmlString }; }
    }
    if (!newItem && plainText && plainText.trim()) {
        newItem = { type: 'text', content: plainText.trim() };
    }

    if(newItem) {
        await addItem(newItem, currentKey);
        renderDataList();
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    // 잠금 사용 여부도 함께 확인
    const { salt, useLock } = await getStorageData(['salt', 'useLock']);
    if (salt && useLock) {
        lockScreen.style.display = 'block';
    } else {
        // 잠금을 사용하지 않거나, 아예 처음인 경우
        // 다음 단계에서 '방법 1'을 구현하기 전까지는 잠금화면을 기본으로 표시합니다.
        // 현재는 비밀번호 없이는 키를 생성할 수 없어 데이터를 볼 수 없기 때문입니다.
        if (salt) { // 비밀번호는 있지만 잠금을 꺼둔 경우
             mainContent.style.display = 'block'; // 우선 메인화면을 보여주지만,
             dataList.innerHTML = '<li>잠금 기능이 꺼져있습니다. 데이터를 보려면 설정에서 잠금을 켜고 비밀번호로 로그인하세요.</li>'; // 안내 메시지 표시
        } else { // 아예 처음 사용하는 경우
            lockScreen.style.display = 'block';
        }
    }
});