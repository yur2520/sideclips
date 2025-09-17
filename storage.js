// storage.js (개선된 버전 - 에러 처리 강화)

// --- 기본 스토리지 함수 ---
async function getStorageData(keys) {
    try {
        return await chrome.storage.local.get(keys);
    } catch (error) {
        console.error('스토리지 읽기 오류:', error);
        return {};
    }
}

async function setStorageData(dataObject) {
    try {
        await chrome.storage.local.set(dataObject);
    } catch (error) {
        console.error('스토리지 저장 오류:', error);
        throw error;
    }
}

async function removeStorageData(keys) {
    try {
        await chrome.storage.local.remove(keys);
    } catch (error) {
        console.error('스토리지 삭제 오류:', error);
        throw error;
    }
}

// --- 핵심 상태 변환 함수 ---
async function disableEncryption(key) {
    try {
        const { savedData: encryptedStr } = await getStorageData('savedData');
        let items = [];
        
        if (encryptedStr) {
            items = await decrypt(encryptedStr, key);
        }
        
        // 복호화된 데이터를 그대로 저장
        await setStorageData({ savedData: items, useLock: false });
        //암호화하는 솔트 삭제하는 로직 await removeStorageData(['salt', 'verification']);
        return true;
    } catch (error) {
        console.error('암호화 비활성화 오류:', error);
        throw error;
    }
}

async function enableEncryption(password) {
    try {
        const { savedData: items } = await getStorageData('savedData');
        const newSalt = crypto.getRandomValues(new Uint8Array(16));
        const newKey = await getKey(password, newSalt);
        const newVerification = await encrypt({ message: 'verified' }, newKey);
        const newEncryptedData = await encrypt(items || [], newKey);

        // 새 암호화 정보와 암호화된 데이터를 저장
        await setStorageData({
            salt: Array.from(newSalt),
            verification: newVerification,
            savedData: newEncryptedData,
            useLock: true
        });
        return newKey;
    } catch (error) {
        console.error('암호화 활성화 오류:', error);
        throw error;
    }
}

// --- 범용 데이터 처리 함수 ---
async function getItems(key) {
    try {
        const { useLock, savedData } = await getStorageData(['useLock', 'savedData']);
        
        // savedData가 없으면 빈 배열 반환
        if (!savedData) return [];

        if (useLock) {
            if (!key) {
                console.warn("암호화 모드인데 키가 없습니다.");
                return null; // 키가 없으면 복호화 불가
            }
            const decryptedData = await decrypt(savedData, key);
            // 복호화된 데이터가 배열이 아니면 빈 배열 반환
            return Array.isArray(decryptedData) ? decryptedData : [];
        } else {
            // 잠금 안 씀 = 일반 텍스트이므로 그대로 반환, 배열이 아니면 빈 배열 반환
            return Array.isArray(savedData) ? savedData : [];
        }
    } catch (error) {
        console.error("데이터 가져오기 실패:", error);
        return null;
    }
}

async function saveItems(items, key) {
    try {
        const { useLock } = await getStorageData('useLock');
        
        if (useLock) {
            if (!key) { 
                throw new Error("암호화 키가 없어 저장할 수 없습니다."); 
            }
            const newEncryptedString = await encrypt(items, key);
            await setStorageData({ savedData: newEncryptedString });
        } else {
            await setStorageData({ savedData: items }); // 일반 텍스트로 저장
        }
    } catch (error) {
        console.error("데이터 저장 실패:", error);
        throw error;
    }
}

async function addItem(newItem, key) {
    try {
        let items = await getItems(key);
        if (items === null) {
            throw new Error("데이터를 불러올 수 없습니다.");
        }
        
        // 배열이 아닌 경우 빈 배열로 초기화
        if (!Array.isArray(items)) {
            console.warn("items가 배열이 아닙니다. 빈 배열로 초기화합니다.", items);
            items = [];
        }
        
        // 중복 체크 - 같은 내용이 이미 있는지 확인
        if (!items.some(item => item.content === newItem.content && item.type === newItem.type)) {
            items.unshift(newItem);
            await saveItems(items, key);
        }
        return items;
    } catch (error) {
        console.error("항목 추가 실패:", error);
        throw error;
    }
}

async function deleteItem(index, key) {
    try {
        let items = await getItems(key);
        if (items === null) {
            throw new Error("데이터를 불러올 수 없습니다.");
        }
        
        // 배열이 아닌 경우 빈 배열로 초기화
        if (!Array.isArray(items)) {
            console.warn("items가 배열이 아닙니다. 빈 배열로 초기화합니다.", items);
            items = [];
        }
        
        if (index >= 0 && index < items.length) {
            items.splice(index, 1);
            await saveItems(items, key);
        }
        return items;
    } catch (error) {
        console.error("항목 삭제 실패:", error);
        throw error;
    }
}