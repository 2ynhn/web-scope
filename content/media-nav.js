// 2. 이미지/영상이 여럿 있을 경우 PageDown / PageUp 으로 미디어 단위 스크롤 (snap-to-center 기반)
(() => {
  if (window !== window.top) return;

  let state = { ...WebScope.DEFAULTS.mediaNav };
  WebScope.get(["mediaNav"]).then((v) => (state = v.mediaNav));
  WebScope.onChange("mediaNav", (v) => (state = v));

  // 조건(최소 크기)을 만족하는 보이는 미디어를 문서 위치 순으로 수집
  function collect() {
    const tags = state.includeVideo ? "img, video" : "img";
    const list = [];
    document.querySelectorAll(tags).forEach((el) => {
      if (el.offsetWidth === 0 || el.offsetHeight === 0) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.position === "fixed") return;
      const r = el.getBoundingClientRect();
      const nw = el.naturalWidth || el.videoWidth || 0;
      const nh = el.naturalHeight || el.videoHeight || 0;
      const ok =
        (nw >= state.minWidth && nh >= state.minHeight) ||
        (r.width >= state.minWidth && r.height >= state.minHeight);
      if (ok) list.push({ el, top: r.top + scrollY });
    });
    list.sort((a, b) => a.top - b.top);
    // 같은 위치(가로로 나란히 있는 이미지 등)는 하나로 취급
    return list.filter((m, i) => i === 0 || Math.abs(m.top - list[i - 1].top) > 4);
  }

  function scrollToMedia(m) {
    window.scrollTo({
      top: Math.max(0, m.top - state.topMargin),
      behavior: state.smooth ? "smooth" : "auto",
    });
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (!state.enabled) return;
      if (e.key !== "PageDown" && e.key !== "PageUp") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.defaultPrevented || WebScope.isTyping()) return;
      if (document.documentElement.hasAttribute("data-ws-comic-open")) return;

      const list = collect();
      if (list.length < state.minCount) return; // 조건 미달 시 기본 동작

      const anchor = scrollY + state.topMargin; // 현재 정렬 기준선
      const target =
        e.key === "PageDown"
          ? list.find((m) => m.top > anchor + 2)
          : [...list].reverse().find((m) => m.top < anchor - 2);
      if (!target) return; // 처음/마지막을 넘어가면 기본 동작

      e.preventDefault();
      e.stopPropagation();
      scrollToMedia(target);
    },
    true
  );
})();
