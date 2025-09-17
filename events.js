// events.js (수정된 버전)

function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e.target.error);
        reader.readAsDataURL(blob);
    });
}

function itemToString(item) {
    return new Promise(resolve => {
        item.getAsString(str => resolve(str || ''));
    });
}


// --- 비밀번호 변경 로직 ---
async function handlePasswordChange() {
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    if (!currentPassword || !newPassword) { 
        settingsMessageArea.textContent = '현재 비밀번호와 새 비밀번호를 모두 입력하세요.'; 
        return; 
    }
    if (newPassword.length < 4 || newPassword.length > 16) { 
        settingsMessageArea.textContent = '새 비밀번호는 4~16자 사이여야 합니다.'; 
        return; 
    }

    settingsMessageArea.textContent = '비밀번호 확인 중...';
    const { salt, verification } = await getStorageData(['salt', 'verification']);
    if (!salt) { 
        settingsMessageArea.textContent = '기존 비밀번호가 설정되어 있지 않습니다.'; 
        return; 
    }
    
    const oldKey = await getKey(currentPassword, new Uint8Array(salt));
    try {
        const decrypted = await decrypt(verification, oldKey);
        if (decrypted.message !== 'verified') throw new Error();
    } catch (e) { 
        settingsMessageArea.textContent = '현재 비밀번호가 일치하지 않습니다.'; 
        return; 
    }

    settingsMessageArea.textContent = '데이터를 재암호화하는 중...';
    currentKey = await enableEncryption(newPassword);
    
    settingsMessageArea.textContent = '비밀번호가 성공적으로 변경되었습니다.';
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
}

// --- 이벤트 리스너 ---
unlockButton.addEventListener('click', async () => {
    const password = passwordInput.value;
    if (!password) { 
        messageArea.textContent = '비밀번호를 입력해주세요.'; 
        return; 
    }
    messageArea.textContent = '';
    
    try {
        const { salt, verification } = await getStorageData(['salt', 'verification']);

        if (salt && verification) {
            const key = await getKey(password, new Uint8Array(salt));
            const decrypted = await decrypt(verification, key);
            if (decrypted.message === 'verified') {
                currentKey = key;
                showMainContent();
            } else { 
                throw new Error('Verification failed'); 
            }
        } else {
            if (password.length < 4 || password.length > 16) {
                messageArea.textContent = '비밀번호는 4~16자 사이여야 합니다.'; 
                return;
            }
            currentKey = await enableEncryption(password);
            showMainContent();
        }
    } catch (error) { 
        messageArea.textContent = '비밀번호가 올바르지 않습니다.';
        console.error('잠금 해제 실패:', error);
    }
});

passwordInput.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') unlockButton.click(); 
});

settingsButton.addEventListener('click', showSettings);
backButton.addEventListener('click', showMainContent);

lockToggle.addEventListener('change', async (e) => {
    const willBeLocked = e.target.checked;
    settingsMessageArea.textContent = '';
    
    try {
        if (willBeLocked) {
            const newPassword = await showCustomPrompt("새로운 비밀번호를 설정하세요 (4~16자):");
            if (!newPassword || newPassword.length < 4 || newPassword.length > 16) {
                await showCustomAlert("비밀번호 규칙에 맞지 않아 취소되었습니다.");
                lockToggle.checked = false; 
                return;
            }
            currentKey = await enableEncryption(newPassword);
            settingsMessageArea.textContent = "암호화가 활성화되었습니다.";
        } else {
            const password = await showCustomPrompt("현재 비밀번호를 입력하여 잠금을 해제하세요:");
            if (!password) { 
                lockToggle.checked = true; 
                return; 
            }
            const { salt, verification } = await getStorageData(['salt', 'verification']);
            const key = await getKey(password, new Uint8Array(salt));
            const decrypted = await decrypt(verification, key);
            if (decrypted.message !== 'verified') throw new Error();
            await disableEncryption(key);
            currentKey = null;
            settingsMessageArea.textContent = "암호화가 비활성화되었습니다. 데이터가 일반 텍스트로 저장됩니다.";
        }
    } catch(err) {
        await showCustomAlert("비밀번호가 올바르지 않아 취소되었습니다.");
        lockToggle.checked = !willBeLocked; // 원래 상태로 복원
        console.error('잠금 토글 오류:', err);
    }
});

changePasswordButton.addEventListener('click', handlePasswordChange);

function isCodeSnippet(text) {
    const lines = text.split('\n');
    if (lines.length >= 3) {
        const hasBraces = text.includes('{') && text.includes('}');
        const indentedLines = lines.filter(line => line.startsWith('    ') || line.startsWith('\t')).length;
        if (hasBraces || indentedLines >= 2) {
            return true;
        }
    }
    const codeKeywords = ['function', 'const', 'let', 'var', 'import', 'export', 'class', '<div>', 'SELECT'];
    return codeKeywords.some(keyword => text.includes(keyword));
}

// 일반 텍스트 입력 처리 추가
dataInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = dataInput.value.trim();
        if (!text) return;
        
        try {
            const { useLock } = await getStorageData('useLock');
            if (useLock && !currentKey) { 
                await showCustomAlert("데이터를 저장하려면 먼저 잠금을 해제해야 합니다."); 
                return; 
            }

            const newItem = {
                type: isCodeSnippet(text) ? 'code' : 'text',
                content: text
            };

            await addItem(newItem, currentKey);
            renderDataList();
            dataInput.value = '';
        } catch (error) {
            console.error('데이터 저장 오류:', error);
            await showCustomAlert("데이터 저장 중 오류가 발생했습니다.");
        }
    }
});

// 기존 paste 이벤트 대신 Clipboard API 사용
dataInput.addEventListener('paste', async (event) => {
    event.preventDefault();
    console.log('붙여넣기 이벤트 시작 - Clipboard API 사용');

    try {
        const { useLock } = await getStorageData('useLock');
        if (useLock && !currentKey) {
            await showCustomAlert("데이터를 저장하려면 먼저 잠금을 해제해야 합니다.");
            return;
        }

        let newItem = null;

        // 1. 이미지 먼저 시도
        try {
            if (navigator.clipboard && navigator.clipboard.read) {
                console.log('이미지 클립보드 확인 중...');
                const clipboardItems = await navigator.clipboard.read();
                
                for (const clipboardItem of clipboardItems) {
                    console.log('클립보드 아이템 타입들:', clipboardItem.types);
                    
                    // 이미지 타입 확인
                    const imageType = clipboardItem.types.find(type => type.startsWith('image/'));
                    if (imageType) {
                        console.log('이미지 발견:', imageType);
                        const blob = await clipboardItem.getType(imageType);
                        const dataUrl = await blobToDataURL(blob);
                        newItem = { type: 'image', content: dataUrl };
                        console.log('이미지 처리 완료');
                        break;
                    }
                    
                    // HTML 타입 확인
                    if (clipboardItem.types.includes('text/html')) {
                        console.log('HTML 발견');
                        const htmlBlob = await clipboardItem.getType('text/html');
                        const htmlString = await htmlBlob.text();
                        console.log('HTML 내용:', htmlString.substring(0, 200) + '...');
                        
                        if (htmlString.includes('<table')) {
                            newItem = { type: 'table', content: htmlString };
                            console.log('테이블로 처리됨');
                            break;
                        } else if (htmlString.trim()) {
                            // HTML을 텍스트로 변환
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = htmlString;
                            const textContent = tempDiv.innerText || tempDiv.textContent || '';
                            if (textContent.trim()) {
                                newItem = isCodeSnippet(textContent.trim())
                                    ? { type: 'code', content: textContent.trim() }
                                    : { type: 'text', content: textContent.trim() };
                                console.log('HTML을 텍스트로 변환하여 처리됨');
                                break;
                            }
                        }
                    }
                }
            }
        } catch (clipError) {
            console.log('Clipboard read API 실패, readText로 재시도:', clipError);
        }

        // 2. 이미지나 HTML이 없으면 텍스트 시도
        if (!newItem) {
            try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    console.log('텍스트 클립보드 확인 중...');
                    const text = await navigator.clipboard.readText();
                    console.log('텍스트 길이:', text.length);
                    console.log('텍스트 내용:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
                    
                    if (text && text.trim()) {
                        newItem = isCodeSnippet(text.trim())
                            ? { type: 'code', content: text.trim() }
                            : { type: 'text', content: text.trim() };
                        console.log('텍스트 처리 완료:', newItem.type);
                    }
                }
            } catch (textError) {
                console.error('텍스트 클립보드 읽기 실패:', textError);
            }
        }

        // 3. 최종 저장
        if (newItem) {
            console.log('데이터 저장 중...', newItem);
            await addItem(newItem, currentKey);
            renderDataList();
            dataInput.value = '';
            console.log('붙여넣기 성공적으로 완료');
        } else {
            console.warn('처리할 수 있는 데이터가 없습니다.');
            await showCustomAlert("클립보드에서 데이터를 읽을 수 없습니다. 브라우저가 클립보드 접근을 허용했는지 확인해주세요.");
        }

    } catch (error) {
        console.error('붙여넣기 오류:', error);
        await showCustomAlert("붙여넣기 중 오류가 발생했습니다: " + error.message);
    }
});

// 추가: Ctrl+V 단축키도 처리
dataInput.addEventListener('keydown', async (event) => {
    if (event.ctrlKey && event.key === 'v') {
        console.log('Ctrl+V 감지됨, paste 이벤트가 처리할 예정');
        // paste 이벤트가 자동으로 처리됩니다
    }
});

// 데이터 목록 클릭 및 컨텍스트 메뉴 처리
dataList.addEventListener('click', async (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    
    try {
        const index = parseInt(li.dataset.index, 10);
        const items = await getItems(currentKey);
        if (!items) {
            await showCustomAlert("데이터를 불러올 수 없습니다.");
            return;
        }
        
        const item = items[index];
        if (!item) return;

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
            await navigator.clipboard.write([ 
                new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob }) 
            ]);
        } else {
            await navigator.clipboard.writeText(item.content);
        }
        
        li.style.backgroundColor = '#a7d7a7';
        setTimeout(() => { li.style.backgroundColor = '#f0f0f0'; }, 500);
    } catch (err) {
        console.error('클립보드 복사에 실패했습니다:', err);
        await showCustomAlert("클립보드 복사에 실패했습니다.");
    }
});

dataList.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const li = e.target.closest('li');
    if (!li) return;
    
    try {
        const index = parseInt(li.dataset.index, 10);
        await deleteItem(index, currentKey);
        renderDataList();
    } catch (error) {
        console.error('항목 삭제 오류:', error);
        await showCustomAlert("항목 삭제 중 오류가 발생했습니다.");
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { salt, useLock } = await getStorageData(['salt', 'useLock']);
        
        if (!salt && !useLock) {
            // 첫 설정 - 비밀번호 설정 모드
            showLockScreen();
            passwordInput.placeholder = "새 비밀번호 설정 (4~16자)";
            unlockButton.textContent = "비밀번호 설정";
        } else if (useLock) {
            // 잠금 모드 - 비밀번호 입력 필요
            showLockScreen();
            passwordInput.placeholder = "비밀번호를 입력하세요";
            unlockButton.textContent = "잠금 해제";
        } else {
            // 잠금 없음 - 바로 메인 화면
            currentKey = null;
            showMainContent();
        }
    } catch (error) {
        console.error('초기화 오류:', error);
        showLockScreen();
        messageArea.textContent = '초기화 중 오류가 발생했습니다.';
    }
});