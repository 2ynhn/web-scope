// 1. 이미지/영상이 큰 경우 화면 세로 크기에 맞춤 (fit-images 기반)
(() => {
  const STYLE_ID = "__web-scope-fit-media__";
  const ORIG_ATTR = "data-ws-fit-orig"; // 원본 보기로 전환된 요소 표시
  const SKIP_ATTR = "data-ws-fit-skip"; // 너무 길어서 맞추지 않는 요소 표시
  let state = { ...WebScope.DEFAULTS.fitMedia };

  const selector = () => (state.includeVideo ? ["img", "video"] : ["img"]);

  const css = () => `
${selector().map((t) => `${t}:not([${ORIG_ATTR}]):not([${SKIP_ATTR}])`).join(",\n")} {
  max-height: ${state.percent}vh !important;
  object-fit: contain !important;
}`;

  function apply() {
    let el = document.getElementById(STYLE_ID);
    if (!state.enabled) {
      if (el) el.remove();
      hideBtn();
      return;
    }
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
    }
    el.textContent = css();
    if (!el.isConnected) (document.head || document.documentElement).appendChild(el);
    if (!state.showToggleButton) hideBtn();
  }

  // SPA 등에서 스타일이 사라지면 다시 붙임
  const reattach = () => {
    if (state.enabled && !document.getElementById(STYLE_ID)) apply();
  };
  new MutationObserver(reattach).observe(document.documentElement, { childList: true });
  document.addEventListener("DOMContentLoaded", () => {
    if (document.head) new MutationObserver(reattach).observe(document.head, { childList: true });
  });

  /* ---------- 너무 긴 이미지/영상은 줄이지 않음 ---------- */
  const skipOn = () => state.enabled && state.skipTallerThan > 0;

  function checkTall(el) {
    if (!(el instanceof HTMLImageElement || el instanceof HTMLVideoElement)) return;
    const h = el.naturalHeight || el.videoHeight || 0; // 원본 세로 (로딩 전에는 0)
    const skip = skipOn() && h >= state.skipTallerThan;
    if (skip !== el.hasAttribute(SKIP_ATTR)) el.toggleAttribute(SKIP_ATTR, skip);
  }

  function checkAllTall(root = document) {
    root.querySelectorAll("img, video").forEach(checkTall);
  }

  // 로딩이 끝나야 원본 크기를 알 수 있음
  document.addEventListener("load", (e) => skipOn() && checkTall(e.target), true);
  document.addEventListener("loadedmetadata", (e) => skipOn() && checkTall(e.target), true);
  // 이미 로딩된 채로 추가되는 요소(캐시 이미지 등)
  new MutationObserver((muts) => {
    if (!skipOn()) return;
    for (const m of muts)
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        checkTall(n);
        if (n.firstElementChild) checkAllTall(n);
      }
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => skipOn() && checkAllTall());

  function update(v) {
    const prev = state;
    state = v;
    apply();
    if (skipOn() || prev.skipTallerThan > 0) checkAllTall(); // 켜기/끄기/값 변경 반영
  }
  WebScope.get(["fitMedia"]).then((v) => update(v.fitMedia));
  WebScope.onChange("fitMedia", update);

  /* ---------- 마우스 오버 버튼 (원본 크기 / 화면 맞춤 전환) ---------- */
  const SIZE = 28;
  const ICON_EXPAND =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
  const ICON_SHRINK =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>';

  let host = null;
  let btn = null;
  let current = null; // 현재 버튼이 붙은 요소

  function ensureBtn() {
    if (host && host.isConnected) return;
    host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;z-index:2147483646;top:0;left:0;display:none;";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>
        button {
          width:${SIZE}px;height:${SIZE}px;padding:0;border:0;border-radius:6px;
          display:flex;align-items:center;justify-content:center;cursor:pointer;
          background:rgba(0,0,0,.6);color:#fff;opacity:.85;
          box-shadow:0 1px 4px rgba(0,0,0,.4);
        }
        button:hover { opacity:1; background:rgba(0,0,0,.8); }
      </style>
      <button type="button"></button>`;
    btn = root.querySelector("button");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!current) return;
      if (current.hasAttribute(ORIG_ATTR)) current.removeAttribute(ORIG_ATTR);
      else current.setAttribute(ORIG_ATTR, "");
      updateBtn();
    });
    // 링크/사이트 핸들러로 이벤트가 새지 않도록
    ["mousedown", "mouseup", "pointerdown", "pointerup"].forEach((t) =>
      btn.addEventListener(t, (e) => e.stopPropagation())
    );
    document.documentElement.appendChild(host);
  }

  const isMedia = (t) =>
    t instanceof HTMLImageElement || (state.includeVideo && t instanceof HTMLVideoElement);

  // 화면 제한에 걸린 요소인지 (또는 이미 원본 보기 상태인지)
  function isRelevant(el) {
    if (el.hasAttribute(ORIG_ATTR)) return true;
    const limit = (innerHeight * state.percent) / 100;
    const h = el.getBoundingClientRect().height;
    const natural = el.naturalHeight || el.videoHeight || 0;
    return h >= limit - 2 && natural > h + 1;
  }

  function updateBtn() {
    if (!current || !current.isConnected) return hideBtn();
    const r = current.getBoundingClientRect();
    if (r.width < SIZE + 16 || r.height < SIZE + 16) return hideBtn();
    // 원본 보기로 커진 요소는 우하단이 화면 밖일 수 있어 뷰포트 안으로 고정
    const bottom = Math.min(r.bottom, innerHeight);
    const right = Math.min(r.right, innerWidth);
    // 영상은 컨트롤 바를 가리지 않도록 우상단에 표시
    const top = current instanceof HTMLVideoElement ? Math.max(r.top, 0) + 8 : bottom - SIZE - 8;
    host.style.top = top + "px";
    host.style.left = right - SIZE - 8 + "px";
    host.style.display = "block";
    const orig = current.hasAttribute(ORIG_ATTR);
    btn.innerHTML = orig ? ICON_SHRINK : ICON_EXPAND;
    btn.title = orig ? "화면에 맞추기" : "원본 크기로 보기";
  }

  function hideBtn() {
    current = null;
    if (host) host.style.display = "none";
  }

  document.addEventListener(
    "mouseover",
    (e) => {
      if (!state.enabled || !state.showToggleButton) return;
      const t = e.target;
      if (t === host) return; // 버튼 위로 이동한 경우 유지
      if (isMedia(t) && isRelevant(t)) {
        ensureBtn();
        current = t;
        updateBtn();
      } else if (current) {
        hideBtn();
      }
    },
    true
  );

  const reposition = () => current && updateBtn();
  addEventListener("scroll", reposition, { capture: true, passive: true });
  addEventListener("resize", reposition, { passive: true });
})();
