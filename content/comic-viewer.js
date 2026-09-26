// 3. 만화형 이미지가 여럿 있을 경우 뷰어로 보기 (← → 로 넘김, F 풀화면, Esc 닫기)
(() => {
  if (window !== window.top) return;

  const OPEN_ATTR = "data-ws-comic-open"; // 다른 기능(미디어 이동)이 참고하는 열림 표시
  const LAZY_ATTRS = ["data-src", "data-original", "data-lazy-src", "data-lazy", "data-url", "data-echo"];

  let state = { ...WebScope.DEFAULTS.comicViewer };
  let pages = []; // { el, src }
  let index = 0;
  let isOpen = false;
  let autoOpened = false;
  let launcherDismissed = false;

  /* ---------------- 이미지 수집 ---------------- */

  const absUrl = (u) => {
    try {
      return new URL(u, location.href).href;
    } catch {
      return u;
    }
  };

  function srcOf(img) {
    const cur = img.currentSrc || img.src || "";
    const loaded = img.complete && img.naturalWidth > 1;
    let lazy = null;
    for (const a of LAZY_ATTRS) {
      const v = img.getAttribute(a);
      if (v && !v.startsWith("data:")) {
        lazy = v;
        break;
      }
    }
    // 지연 로딩 자리표시 이미지 대신 실제 주소 사용
    if (lazy && (!loaded || cur.startsWith("data:") || img.naturalWidth < state.minWidth)) return absUrl(lazy);
    return cur;
  }

  function qualifies(img) {
    if (!img.isConnected) return false;
    const r = img.getBoundingClientRect();
    if (r.width === 0 && r.height === 0 && !img.naturalWidth) return false;
    const cs = getComputedStyle(img);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const byNatural = img.naturalWidth >= state.minWidth && img.naturalHeight >= state.minHeight;
    const byRendered = r.width >= state.minWidth && r.height >= state.minHeight;
    return byNatural || byRendered;
  }

  function collect() {
    const seen = new Set();
    const list = [];
    document.querySelectorAll("img").forEach((el) => {
      if (!qualifies(el)) return;
      const src = srcOf(el);
      if (!src || seen.has(src)) return;
      seen.add(src);
      list.push({ el, src });
    });
    return list;
  }

  /* ---------------- 조건 감시 & 실행 버튼 ---------------- */

  let scanTimer = 0;
  function scheduleScan(delay = 400) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, delay);
  }

  function scan() {
    if (!state.enabled) {
      hideLauncher();
      return;
    }
    const list = collect();
    if (isOpen) {
      // 열린 상태에서 새로 로딩된 이미지 반영 (현재 페이지 유지)
      const curSrc = pages[index] && pages[index].src;
      pages = list.length ? list : pages;
      const i = pages.findIndex((p) => p.src === curSrc);
      if (i >= 0) index = i;
      renderMeta();
      return;
    }
    const eligible = list.length >= state.minCount;
    if (eligible && state.autoOpen && !autoOpened) {
      autoOpened = true;
      openViewer();
      return;
    }
    if (eligible && state.showLauncher && !launcherDismissed) showLauncher(list.length);
    else hideLauncher();
  }

  let launcherHost = null;
  let launcherCount = null;

  function showLauncher(count) {
    if (!launcherHost) {
      launcherHost = document.createElement("div");
      launcherHost.style.cssText = "all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483646;";
      const root = launcherHost.attachShadow({ mode: "closed" });
      root.innerHTML = `
        <style>
          .wrap { display:flex; align-items:center; gap:2px; font:13px/1 system-ui,sans-serif;
            background:rgba(20,20,20,.82); color:#fff; border-radius:20px; padding:3px;
            box-shadow:0 2px 10px rgba(0,0,0,.35); opacity:.75; transition:opacity .15s; }
          .wrap:hover { opacity:1; }
          button { all:unset; cursor:pointer; border-radius:16px; }
          .open { display:flex; align-items:center; gap:6px; padding:7px 10px 7px 9px; }
          .open:hover, .x:hover { background:rgba(255,255,255,.14); }
          .x { width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:15px; color:#bbb; }
          svg { display:block; }
        </style>
        <div class="wrap">
          <button class="open" title="만화 뷰어로 보기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/></svg>
            <span>만화보기 <b class="count"></b></span>
          </button>
          <button class="x" title="이 페이지에서 숨기기">×</button>
        </div>`;
      launcherCount = root.querySelector(".count");
      root.querySelector(".open").addEventListener("click", (e) => {
        e.stopPropagation();
        openViewer();
      });
      root.querySelector(".x").addEventListener("click", (e) => {
        e.stopPropagation();
        launcherDismissed = true;
        hideLauncher();
      });
    }
    launcherCount.textContent = count;
    if (!launcherHost.isConnected) document.documentElement.appendChild(launcherHost);
    launcherHost.style.display = "block";
  }

  function hideLauncher() {
    if (launcherHost) launcherHost.style.display = "none";
  }

  /* ---------------- 뷰어 UI ---------------- */

  const ICON = {
    prev: '<path d="M15 18l-6-6 6-6"/>',
    next: '<path d="M9 18l6-6-6-6"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    fs: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    fsExit: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
    fitContain: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 7v10M9 10l3-3 3 3M9 14l3 3 3-3"/>',
    fitWidth: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3"/>',
  };
  const svg = (p, s = 20) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  let host = null;
  let ui = null;

  function buildViewer() {
    host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;display:block;";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        .viewer { position:fixed; inset:0; background:var(--bg,#111); color:#eee; font:13px/1.4 system-ui,sans-serif;
          user-select:none; -webkit-user-select:none; overflow:hidden; }
        .viewer.idle { cursor:none; }
        .viewer:focus { outline:none; }
        .stage { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .page { display:block; width:100%; height:100%; object-fit:contain; }
        .viewer[data-fit="width"] .stage { display:block; overflow-y:auto; overflow-x:hidden; }
        .viewer[data-fit="width"] .page { height:auto; object-fit:initial; }
        .page.loading { opacity:0; }
        .status { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); color:#999; pointer-events:none; }
        .bar { position:absolute; left:0; right:0; top:0; height:48px; display:flex; align-items:center; gap:4px;
          padding:0 10px; background:linear-gradient(rgba(0,0,0,.75),rgba(0,0,0,0)); transition:opacity .2s; }
        .bar .counter { font-variant-numeric:tabular-nums; padding:0 8px; min-width:72px; }
        .bar .spacer { flex:1; }
        button { all:unset; cursor:pointer; color:#eee; display:inline-flex; align-items:center; justify-content:center;
          gap:6px; height:34px; min-width:34px; padding:0 8px; border-radius:8px; }
        button:hover { background:rgba(255,255,255,.14); }
        button:focus-visible { outline:2px solid #6aa7ff; }
        .dir { border:1px solid rgba(255,255,255,.25); }
        .nav { position:absolute; top:50%; transform:translateY(-50%); width:48px; height:96px; border-radius:10px;
          background:rgba(0,0,0,.35); transition:opacity .2s; }
        .nav:hover { background:rgba(0,0,0,.6); }
        .nav.left { left:10px; } .nav.right { right:10px; }
        .nav[disabled] { opacity:.15 !important; pointer-events:none; }
        .progress { position:absolute; left:0; right:0; bottom:0; height:3px; background:rgba(255,255,255,.1); transition:opacity .2s; }
        .fill { height:100%; background:#6aa7ff; width:0; }
        .viewer[data-dir="rtl"] .fill { margin-left:auto; }
        .viewer.idle .bar, .viewer.idle .nav, .viewer.idle .progress { opacity:0; pointer-events:none; }
        .toast { position:absolute; left:50%; bottom:40px; transform:translateX(-50%); background:rgba(0,0,0,.8);
          padding:8px 14px; border-radius:8px; opacity:0; transition:opacity .2s; pointer-events:none; white-space:nowrap; }
        .toast.show { opacity:1; }
        .help { color:#aaa; font-size:12px; padding:0 8px; }
        @media (max-width: 640px) { .help { display:none; } }
      </style>
      <div class="viewer" tabindex="-1">
        <div class="stage"><img class="page" alt="" draggable="false"></div>
        <div class="status"></div>
        <button class="nav left" title="왼쪽">${svg(ICON.prev, 28)}</button>
        <button class="nav right" title="오른쪽">${svg(ICON.next, 28)}</button>
        <div class="bar">
          <span class="counter"></span>
          <span class="help">← → 넘기기 · F 풀화면 · Esc 닫기</span>
          <span class="spacer"></span>
          <button class="dir" title="넘김 방향 전환"></button>
          <button class="fit"></button>
          <button class="fs"></button>
          <button class="close" title="닫기 (Esc)">${svg(ICON.close)}</button>
        </div>
        <div class="progress"><div class="fill"></div></div>
        <div class="toast"></div>
      </div>`;

    const $ = (s) => root.querySelector(s);
    ui = {
      viewer: $(".viewer"),
      stage: $(".stage"),
      img: $(".page"),
      status: $(".status"),
      left: $(".nav.left"),
      right: $(".nav.right"),
      counter: $(".counter"),
      dir: $(".dir"),
      fit: $(".fit"),
      fs: $(".fs"),
      close: $(".close"),
      fill: $(".fill"),
      toast: $(".toast"),
    };

    ui.left.addEventListener("click", () => sideAction("left"));
    ui.right.addEventListener("click", () => sideAction("right"));
    ui.close.addEventListener("click", closeViewer);
    ui.fs.addEventListener("click", toggleFullscreen);
    ui.dir.addEventListener("click", toggleDirection);
    ui.fit.addEventListener("click", toggleFit);

    // 화면 좌/우 1/3 클릭으로 넘김, 가운데 클릭은 메뉴 표시 전환
    ui.stage.addEventListener("click", (e) => {
      const x = e.clientX / innerWidth;
      if (x < 1 / 3) sideAction("left");
      else if (x > 2 / 3) sideAction("right");
      else ui.viewer.classList.toggle("idle");
    });
    ui.stage.addEventListener("dblclick", (e) => {
      const x = e.clientX / innerWidth;
      if (x >= 1 / 3 && x <= 2 / 3) toggleFullscreen();
    });

    ui.img.addEventListener("load", () => {
      ui.img.classList.remove("loading");
      ui.status.textContent = "";
    });
    ui.img.addEventListener("error", () => {
      ui.img.classList.remove("loading");
      ui.status.textContent = "이미지를 불러오지 못했습니다";
    });

    ui.viewer.addEventListener("mousemove", wake);
    ui.viewer.addEventListener("wheel", onWheel, { passive: false });
    // 페이지(사이트)로 마우스 이벤트가 새지 않도록
    ["mousedown", "mouseup", "click", "dblclick", "contextmenu", "pointerdown", "pointerup", "touchstart", "touchend"].forEach(
      (t) => host.addEventListener(t, (e) => e.stopPropagation())
    );
  }

  /* ---------------- 동작 ---------------- */

  const isRtl = () => state.direction === "rtl";

  function go(i) {
    if (!pages.length) return;
    const next = Math.max(0, Math.min(pages.length - 1, i));
    if (next === index && ui.img.getAttribute("src")) {
      if (i >= pages.length) toast("마지막 이미지입니다");
      else if (i < 0) toast("첫 번째 이미지입니다");
      return;
    }
    index = next;
    render();
  }
  const next = () => go(index + 1);
  const prev = () => go(index - 1);

  function sideAction(side) {
    // 오른쪽 넘김(ltr): → 다음 / 왼쪽 넘김(rtl): ← 다음
    if ((side === "right") !== isRtl()) next();
    else prev();
  }

  function render() {
    const p = pages[index];
    if (!p) return;
    if (ui.img.getAttribute("src") !== p.src) {
      ui.img.classList.add("loading");
      ui.status.textContent = "불러오는 중…";
      ui.img.src = p.src;
      if (ui.img.complete && ui.img.naturalWidth) {
        ui.img.classList.remove("loading");
        ui.status.textContent = "";
      }
    }
    ui.stage.scrollTop = 0;
    renderMeta();
    preload();
  }

  function renderMeta() {
    if (!ui) return;
    const n = pages.length;
    ui.counter.textContent = `${index + 1} / ${n}`;
    ui.fill.style.width = n ? ((index + 1) / n) * 100 + "%" : "0";
    const atStart = index <= 0;
    const atEnd = index >= n - 1;
    // 넘김 방향에 따라 좌/우 버튼 역할이 바뀜
    ui.left.disabled = isRtl() ? atEnd : atStart;
    ui.right.disabled = isRtl() ? atStart : atEnd;
    ui.left.title = isRtl() ? "다음" : "이전";
    ui.right.title = isRtl() ? "이전" : "다음";
  }

  function renderSettings() {
    if (!ui) return;
    ui.viewer.style.setProperty("--bg", state.background);
    ui.viewer.dataset.dir = state.direction;
    ui.viewer.dataset.fit = state.fitMode;
    ui.dir.innerHTML = isRtl() ? `${svg(ICON.prev, 16)}<span>왼쪽 넘김</span>` : `<span>오른쪽 넘김</span>${svg(ICON.next, 16)}`;
    const width = state.fitMode === "width";
    ui.fit.innerHTML = svg(width ? ICON.fitWidth : ICON.fitContain);
    ui.fit.title = width ? "가로 맞춤 (클릭: 화면 맞춤으로)" : "화면 맞춤 (클릭: 가로 맞춤으로)";
    renderFullscreen();
    renderMeta();
  }

  function renderFullscreen() {
    if (!ui) return;
    const fs = document.fullscreenElement === host;
    ui.fs.innerHTML = svg(fs ? ICON.fsExit : ICON.fs);
    ui.fs.title = fs ? "풀화면 끝내기 (F)" : "풀화면 (F)";
  }

  const preloaded = new Set();
  function preload() {
    [index + 1, index + 2, index - 1].forEach((i) => {
      const p = pages[i];
      if (p && !preloaded.has(p.src)) {
        preloaded.add(p.src);
        new Image().src = p.src;
      }
    });
  }

  function toggleDirection() {
    const direction = isRtl() ? "ltr" : "rtl";
    state.direction = direction;
    renderSettings();
    toast(direction === "rtl" ? "왼쪽 넘김 (← 다음)" : "오른쪽 넘김 (→ 다음)");
    WebScope.patch("comicViewer", { direction }); // 바꿀 때까지 계속 유지
  }

  function toggleFit() {
    const fitMode = state.fitMode === "width" ? "contain" : "width";
    state.fitMode = fitMode;
    renderSettings();
    ui.stage.scrollTop = 0;
    toast(fitMode === "width" ? "가로 맞춤" : "화면 맞춤");
    WebScope.patch("comicViewer", { fitMode });
  }

  function toggleFullscreen() {
    if (document.fullscreenElement === host) document.exitFullscreen().catch(() => {});
    else host.requestFullscreen().catch(() => toast("풀화면을 사용할 수 없습니다"));
  }

  let toastTimer = 0;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 1200);
  }

  let idleTimer = 0;
  function wake() {
    ui.viewer.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => ui.viewer.classList.add("idle"), 2200);
  }

  let wheelLock = 0;
  function onWheel(e) {
    e.stopPropagation();
    const down = e.deltaY > 0;
    if (state.fitMode === "width") {
      // 가로 맞춤: 스크롤 끝에서 한 번 더 굴리면 넘김
      const s = ui.stage;
      const atEdge = down ? s.scrollTop + s.clientHeight >= s.scrollHeight - 2 : s.scrollTop <= 0;
      if (!atEdge || !state.wheelNav) return;
    } else if (!state.wheelNav) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    if (!e.deltaY || Date.now() < wheelLock) return;
    wheelLock = Date.now() + 300;
    down ? next() : prev();
  }

  // 가로 맞춤에서 화면 단위 스크롤, 끝이면 넘김
  function pageScroll(down) {
    const s = ui.stage;
    if (state.fitMode === "width") {
      const atEdge = down ? s.scrollTop + s.clientHeight >= s.scrollHeight - 2 : s.scrollTop <= 0;
      if (!atEdge) {
        s.scrollBy({ top: (down ? 1 : -1) * s.clientHeight * 0.9, behavior: "smooth" });
        return;
      }
    }
    down ? next() : prev();
  }

  function onKey(e) {
    if (!isOpen) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // 브라우저 단축키는 그대로
    // 사이트의 키보드 단축키(예: 다음 화 이동)가 동작하지 않도록 차단
    e.stopImmediatePropagation();
    if (e.key === " ") e.preventDefault(); // 포커스된 버튼이 스페이스로 눌리지 않도록
    if (e.type !== "keydown") return;

    const k = e.key;
    let handled = true;
    if (k === "ArrowRight") sideAction("right");
    else if (k === "ArrowLeft") sideAction("left");
    else if (k === "PageDown" || (k === " " && !e.shiftKey)) pageScroll(true);
    else if (k === "PageUp" || (k === " " && e.shiftKey)) pageScroll(false);
    else if (k === "ArrowDown" && state.fitMode === "width") ui.stage.scrollBy({ top: 80 });
    else if (k === "ArrowUp" && state.fitMode === "width") ui.stage.scrollBy({ top: -80 });
    else if (k === "Home") go(0);
    else if (k === "End") go(pages.length - 1);
    else if (k === "f" || k === "F") toggleFullscreen();
    else if (k === "Escape") closeViewer();
    else handled = false;
    if (handled) e.preventDefault();
  }
  ["keydown", "keyup", "keypress"].forEach((t) => window.addEventListener(t, onKey, true));

  document.addEventListener("fullscreenchange", renderFullscreen);

  // 현재 화면에 가장 많이 보이는 이미지부터 시작
  function startIndex() {
    let best = -1;
    let bestArea = 0;
    pages.forEach((p, i) => {
      const r = p.el.getBoundingClientRect();
      const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      if (h * w > bestArea) {
        bestArea = h * w;
        best = i;
      }
    });
    if (best >= 0) return best;
    const below = pages.findIndex((p) => p.el.getBoundingClientRect().top >= 0);
    return below >= 0 ? below : 0;
  }

  let savedOverflow = "";

  function openViewer() {
    if (isOpen) return { ok: true, count: pages.length };
    if (!state.enabled) return { ok: false, reason: "disabled" };
    const list = collect();
    if (list.length < state.minCount) return { ok: false, reason: "notEnough", count: list.length };

    pages = list;
    index = startIndex();
    if (!host) buildViewer();
    isOpen = true;
    hideLauncher();
    document.documentElement.setAttribute(OPEN_ATTR, "");
    savedOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.appendChild(host);
    ui.img.removeAttribute("src");
    renderSettings();
    render();
    wake();
    ui.viewer.focus({ preventScroll: true });
    return { ok: true, count: pages.length };
  }

  function closeViewer() {
    if (!isOpen) return;
    isOpen = false;
    if (document.fullscreenElement === host) document.exitFullscreen().catch(() => {});
    host.remove();
    document.documentElement.removeAttribute(OPEN_ATTR);
    document.documentElement.style.overflow = savedOverflow;
    // 보던 이미지 위치로 페이지를 맞춤
    const p = pages[index];
    if (p && p.el.isConnected) p.el.scrollIntoView({ block: "start" });
    scheduleScan(0);
  }

  /* ---------------- 설정 / 메시지 / 초기화 ---------------- */

  function applyState(v) {
    state = v;
    if (!state.enabled && isOpen) closeViewer();
    renderSettings();
    scheduleScan(0);
  }

  WebScope.get(["comicViewer"]).then((v) => applyState(v.comicViewer));
  WebScope.onChange("comicViewer", applyState);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "comicViewer:open") {
      sendResponse(openViewer());
    } else if (msg.type === "comicViewer:toggle") {
      if (isOpen) closeViewer();
      else openViewer();
      sendResponse({ ok: true });
    } else if (msg.type === "comicViewer:status") {
      sendResponse({ open: isOpen, count: collect().length, minCount: state.minCount });
    }
  });

  function start() {
    scheduleScan(0);
    new MutationObserver((muts) => {
      // 뷰어/버튼 자체의 변경은 무시
      if (muts.every((m) => m.target === document.documentElement && [...m.addedNodes, ...m.removedNodes].every((n) => n === host || n === launcherHost)))
        return;
      scheduleScan();
    }).observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset", ...LAZY_ATTRS],
    });
    // 이미지 로딩 완료 시 크기가 확정되므로 재검사
    document.addEventListener("load", (e) => e.target instanceof HTMLImageElement && scheduleScan(), true);
    addEventListener("load", () => scheduleScan(0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
