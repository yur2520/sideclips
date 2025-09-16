// sidepanel.js (이미지 저장을 위해 수정된 전체 코드)

const dataInput = document.getElementById('dataInput');
const dataList = document.getElementById('dataList');

// 저장된 데이터 객체의 배열을 불러와 화면에 표시하는 함수
async function loadSavedData() {
    const result = await chrome.storage.local.get(['savedData']);
    const savedItems = result.savedData || [];

    dataList.innerHTML = ''; // 목록 초기화

    savedItems.forEach((item, index) => {
        const li = document.createElement('li');

        // 데이터 유형(type)에 따라 다르게 표시
        if (item.type === 'image') {
            const img = document.createElement('img');
            img.src = item.content; // Data URL을 이미지 소스로 사용
            li.appendChild(img);
        } else { // 'text' 또는 미지정
            li.textContent = item.content;
        }

        // 목록 아이템 클릭 시 클립보드에 복사하는 기능
        li.addEventListener('click', () => {
            // 참고: 이미지의 경우 Data URL 텍스트가 복사됩니다.
            // 실제 이미지를 클립보드에 넣으려면 Clipboard API의 write() 메서드 등 심화 과정이 필요합니다.
            navigator.clipboard.writeText(item.content)
                .then(() => {
                    li.style.backgroundColor = '#a7d7a7';
                    setTimeout(() => { li.style.backgroundColor = '#f0f0f0'; }, 500);
                });
        });

        // 목록 아이템 우클릭 시 삭제하는 기능
        li.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            savedItems.splice(index, 1);
            chrome.storage.local.set({ savedData: savedItems });
            loadSavedData();
        });

        dataList.appendChild(li);
    });
}

// 입력창에 데이터 붙여넣기 이벤트 리스너
dataInput.addEventListener('paste', async (event) => {
    const items = event.clipboardData.items;
    let found = false;

    for (const item of items) {
        // 붙여넣은 것이 이미지 파일인지 확인
        if (item.type.indexOf('image') !== -1) {
            found = true;
            const imageFile = item.getAsFile();
            
            // FileReader를 사용해 이미지를 Data URL로 변환
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target.result;

                const result = await chrome.storage.local.get(['savedData']);
                const savedItems = result.savedData || [];
                
                // 데이터를 객체 형태로 저장 { type: 'image', content: '...' }
                savedItems.unshift({ type: 'image', content: dataUrl });
                await chrome.storage.local.set({ savedData: savedItems });
                
                loadSavedData(); // 목록 새로고침
            };
            reader.readAsDataURL(imageFile);
            break; // 첫 번째 이미지만 처리
        }
    }

    // 붙여넣은 것이 이미지가 아닐 경우, 텍스트로 처리
    if (!found) {
        setTimeout(async () => {
            const pastedText = dataInput.value.trim();
            if (pastedText) {
                const result = await chrome.storage.local.get(['savedData']);
                const savedItems = result.savedData || [];
                
                if (!savedItems.some(item => item.content === pastedText)) {
                    // 데이터를 객체 형태로 저장 { type: 'text', content: '...' }
                    savedItems.unshift({ type: 'text', content: pastedText });
                    await chrome.storage.local.set({ savedData: savedItems });
                }
                
                loadSavedData(); // 목록 새로고침
            }
        }, 0);
    }
    
    dataInput.value = ''; // 입력창은 항상 비워줌
});

// 페이지가 처음 로드될 때 저장된 데이터 불러오기
loadSavedData();