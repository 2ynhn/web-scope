importScripts("common/defaults.js");

// 켜진 기능 수를 배지로 표시
async function updateBadge() {
  const all = await WebScope.get();
  const n = WebScope.FEATURES.filter((f) => all[f.key].enabled).length;
  chrome.action.setBadgeText({ text: n ? String(n) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#2e7d32" });
}

chrome.runtime.onInstalled.addListener(async () => {
  // 누락된 설정 키를 기본값으로 채워 저장
  await chrome.storage.sync.set(await WebScope.get());
  updateBadge();
});
chrome.runtime.onStartup.addListener(updateBadge);
chrome.storage.onChanged.addListener((_, area) => area === "sync" && updateBadge());

// 단축키 (chrome://extensions/shortcuts 에서 변경 가능)
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "toggle-comic-viewer") return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: "comicViewer:toggle" }, { frameId: 0 }).catch(() => {});
});
