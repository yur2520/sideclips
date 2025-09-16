// service-worker.js (최종 수정 코드)

// 확장 프로그램이 처음 설치되거나 업데이트될 때 실행
chrome.runtime.onInstalled.addListener(() => {
  // 초기 설정 코드 (필요 시 작성)
});

// (수정된 부분) 툴바의 확장 프로그램 아이콘을 클릭했을 때 실행
chrome.action.onClicked.addListener(async (tab) => {
  // 현재 탭이 속한 '창(window)'에 사이드 패널을 엽니다.
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// 탭의 URL이 변경될 때마다 사이드 패널을 해당 탭에 맞게 활성화
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status === 'complete' && tab.url) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true
    });
  }
});