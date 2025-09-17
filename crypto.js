// crypto.js (새로 만드는 파일)

// PBKDF2 반복 횟수. 숫자가 높을수록 안전하지만 약간 느려질 수 있습니다.
const ITERATIONS = 250000;

// 1. 비밀번호와 솔트(salt)로부터 암호화 키를 생성하는 함수
async function getKey(password, salt) {
    const baseKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        { name: "PBKDF2" },
        false,
        ['deriveBits', 'deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: ITERATIONS,
            hash: "SHA-256",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// 2. 데이터를 암호화하는 함수
async function encrypt(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 암호화에 사용할 초기화 벡터 (매번 달라야 함)
    const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        new TextEncoder().encode(JSON.stringify(data))
    );
    
    // IV와 암호화된 데이터를 합쳐서 Base64 문자열로 반환 (저장하기 좋은 형태)
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);
    
    return btoa(String.fromCharCode.apply(null, combined));
}

// 3. 암호화된 데이터를 복호화하는 함수
async function decrypt(encryptedString, key) {
    const combined = new Uint8Array(atob(encryptedString).split('').map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encryptedData
    );
    
    return JSON.parse(new TextDecoder().decode(decryptedData));
}