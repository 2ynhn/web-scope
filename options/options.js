// 설정 페이지 공용: 사이드 메뉴, 켜기 스위치, data-key 입력 자동 저장
(async () => {
  const key = document.body.dataset.feature;
  const feature = WebScope.FEATURES.find((f) => f.key === key);
  const main = document.querySelector("main");

  // 레이아웃 구성
  const layout = document.createElement("div");
  layout.className = "layout";
  const nav = document.createElement("nav");
  nav.innerHTML = `
    <div class="brand"><img src="../icons/icon48.png" alt=""><div><b>Web Scope</b><span>Web browsing utility toolkit</span></div></div>
    ${WebScope.FEATURES.map(
      (f) => `<a href="../${f.page}" data-key="${f.key}" class="${f.key === key ? "current" : ""}">${f.name}<i class="dot"></i></a>`
    ).join("")}`;
  document.body.prepend(layout);
  layout.append(nav, main);

  const head = document.createElement("div");
  head.className = "head";
  head.innerHTML = `<h1>${feature.name}</h1><label class="switch" title="켜기/끄기"><input type="checkbox" data-key="enabled"><span class="slider"></span></label>`;
  main.prepend(head);
  document.title = `${feature.name} 설정 - Web Scope`;

  const footer = document.createElement("div");
  footer.className = "footer";
  footer.innerHTML = '<button class="btn" id="reset">기본값으로 되돌리기</button><span class="saved">저장됨</span>';
  main.append(footer);
  const savedEl = footer.querySelector(".saved");

  const inputs = [...main.querySelectorAll("[data-key]")];

  function fill(values) {
    inputs.forEach((el) => {
      const v = values[el.dataset.key];
      if (el.type === "checkbox") el.checked = !!v;
      else if (el.type === "radio") el.checked = el.value === String(v);
      else if (el.hasAttribute("data-blank-zero") && !v) el.value = "";
      else el.value = v;
      showValue(el);
    });
  }

  function showValue(el) {
    const out = main.querySelector(`[data-value-of="${el.dataset.key}"]`);
    if (out && el.type === "range") out.textContent = el.value + (out.dataset.unit || "");
  }

  function read(el) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "number" || el.type === "range") {
      if (el.hasAttribute("data-blank-zero") && el.value.trim() === "") return 0;
      const n = Number(el.value);
      const def = WebScope.DEFAULTS[key][el.dataset.key];
      if (!Number.isFinite(n)) return def;
      const min = el.min !== "" ? Number(el.min) : -Infinity;
      const max = el.max !== "" ? Number(el.max) : Infinity;
      return Math.min(max, Math.max(min, n));
    }
    return el.value;
  }

  let savedTimer = 0;
  async function save(el) {
    if (el.type === "radio" && !el.checked) return;
    await WebScope.patch(key, { [el.dataset.key]: read(el) });
    savedEl.classList.add("show");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => savedEl.classList.remove("show"), 1200);
  }

  inputs.forEach((el) => {
    el.addEventListener("input", () => showValue(el));
    el.addEventListener("change", () => save(el));
  });

  footer.querySelector("#reset").addEventListener("click", async () => {
    const enabled = (await WebScope.get([key]))[key].enabled;
    await WebScope.reset(key);
    await WebScope.patch(key, { enabled }); // 켜짐 상태는 유지
  });

  function renderDots(all) {
    nav.querySelectorAll("a").forEach((a) => {
      a.querySelector(".dot").classList.toggle("on", all[a.dataset.key].enabled);
    });
  }

  const all = await WebScope.get();
  fill(all[key]);
  renderDots(all);

  // 다른 곳(팝업, 뷰어)에서 바뀐 설정도 반영
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "sync") return;
    const cur = await WebScope.get();
    if (changes[key]) fill(cur[key]);
    renderDots(cur);
  });

  // 단축키 설정 링크 (chrome:// 페이지는 tabs API 로만 열 수 있음)
  document.querySelectorAll("[data-open-shortcuts]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    })
  );
})();
