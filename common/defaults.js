// Web Scope 공용 설정 (content script / popup / options / background 공용)
(() => {
  if (globalThis.WebScope) return;

  const DEFAULTS = {
    // 1. 이미지/영상 화면 맞춤
    fitMedia: {
      enabled: false,
      percent: 96, // 화면 높이 대비 최대 높이(%)
      includeVideo: true,
      showToggleButton: true, // 마우스 오버 시 원본/맞춤 전환 버튼
    },
    // 2. PageDown / PageUp 미디어 이동
    mediaNav: {
      enabled: false,
      minWidth: 200,
      minHeight: 200,
      minCount: 3,
      includeVideo: true,
      topMargin: 20, // 이동 후 미디어 위쪽 여백(px)
      smooth: true,
    },
    // 3. 만화 뷰어
    comicViewer: {
      enabled: false,
      minWidth: 300,
      minHeight: 400,
      minCount: 3,
      direction: "ltr", // ltr: 오른쪽 넘김(→ 다음), rtl: 왼쪽 넘김(← 다음)
      fitMode: "contain", // contain: 화면 맞춤, width: 가로 맞춤
      showLauncher: true,
      autoOpen: false,
      wheelNav: true,
      loadMore: true, // 넘길 때 뒤의 페이지도 스크롤해서 동적 로딩 이미지 불러오기
      background: "#111111",
    },
  };

  const FEATURES = [
    {
      key: "fitMedia",
      name: "화면 맞춤",
      desc: "큰 이미지/영상을 화면 세로 크기에 맞춤",
      page: "options/fit-media.html",
    },
    {
      key: "mediaNav",
      name: "미디어 이동",
      desc: "PageDown / PageUp 으로 이미지·영상 단위 스크롤",
      page: "options/media-nav.html",
    },
    {
      key: "comicViewer",
      name: "만화 뷰어",
      desc: "만화형 이미지를 뷰어로 보고 ← → 로 넘김",
      page: "options/comic-viewer.html",
    },
  ];

  const merge = (key, value) => Object.assign({}, DEFAULTS[key], value || {});

  function get(keys) {
    const list = keys || Object.keys(DEFAULTS);
    return new Promise((resolve) => {
      chrome.storage.sync.get(list, (raw) => {
        const out = {};
        list.forEach((k) => (out[k] = merge(k, raw[k])));
        resolve(out);
      });
    });
  }

  async function patch(key, values) {
    const cur = (await get([key]))[key];
    const next = Object.assign(cur, values);
    await chrome.storage.sync.set({ [key]: next });
    return next;
  }

  function reset(key) {
    return chrome.storage.sync.set({ [key]: merge(key) });
  }

  // key 설정이 바뀔 때마다 병합된 새 값으로 콜백
  function onChange(key, cb) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes[key]) cb(merge(key, changes[key].newValue));
    });
  }

  // 입력창 등에 포커스가 있는지 (키보드 단축키 무시용)
  function isTyping() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  globalThis.WebScope = { DEFAULTS, FEATURES, get, patch, reset, onChange, isTyping };
})();
