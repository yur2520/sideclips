// storage.js (새로 만드는 파일)

// --- 데이터 저장 및 관리 담당 ---

async function getStorageData(keys) {
    return await chrome.storage.local.get(keys);
}

async function setStorageData(dataObject) {
    await chrome.storage.local.set(dataObject);
}

async function getAllItems(key) {
    const { savedData: encryptedItemsStr } = await getStorageData('savedData');
    if (!encryptedItemsStr) return [];
    try {
        return await decrypt(encryptedItemsStr, key);
    } catch (e) {
        console.error("데이터 복호화 실패", e);
        return null; // 실패 시 null 반환
    }
}

async function saveAllItems(items, key) {
    const newEncryptedString = await encrypt(items, key);
    await setStorageData({ savedData: newEncryptedString });
}

async function addItem(newItem, key) {
    let items = await getAllItems(key);
    if (items === null) return; // 복호화 실패 시 저장 중단

    if (!items.some(item => item.content === newItem.content)) {
        items.unshift(newItem);
        await saveAllItems(items, key);
    }
    return items;
}

async function deleteItem(index, key) {
    let items = await getAllItems(key);
    if (items === null) return;

    items.splice(index, 1);
    await saveAllItems(items, key);
    return items;
}