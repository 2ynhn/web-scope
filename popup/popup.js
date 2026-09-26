const list = document.getElementById("features");
const tpl = document.getElementById("feature-tpl");

function activeTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => t);
}

function sendToTab(tab, msg) {
  return chrome.tabs.sendMessage(tab.id, msg, { frameId: 0 }).catch(() => null);
}

// 만화 뷰어: 현재 탭에서 바로 열기 + 감지된 이미지 수 표시
async function buildComicExtra(li) {
  const extra = document.createElement("div");
  extra.className = "extra";
  extra.innerHTML = '<span class="hint"></span><button class="btn primary">지금 열기</button>';
  li.appendChild(extra);
  const hint = extra.querySelector(".hint");
  const btn = extra.querySelector("button");

  const refresh = async () => {
    const tab = await activeTab();
    const st = tab && (await sendToTab(tab, { type: "comicViewer:status" }));
    if (!st) {
      hint.textContent = "이 페이지에서는 사용할 수 없습니다";
      btn.disabled = true;
      return;
    }
    const ok = st.count >= st.minCount;
    hint.textContent = ok ? `만화 이미지 ${st.count}개 감지` : `조건에 맞는 이미지 ${st.count}개 (최소 ${st.minCount}개)`;
    btn.disabled = !ok;
  };

  btn.addEventListener("click", async () => {
    const tab = await activeTab();
    const res = tab && (await sendToTab(tab, { type: "comicViewer:open" }));
    if (res && res.ok) window.close();
    else refresh();
  });
  return refresh;
}

(async () => {
  const all = await WebScope.get();
  for (const f of WebScope.FEATURES) {
    const li = tpl.content.firstElementChild.cloneNode(true);
    li.querySelector(".name").textContent = f.name;
    li.querySelector(".desc").textContent = f.desc;
    const input = li.querySelector("input");
    input.checked = all[f.key].enabled;
    li.classList.toggle("on", input.checked);

    const refresh = f.key === "comicViewer" ? await buildComicExtra(li) : null;
    if (refresh && input.checked) refresh();

    input.addEventListener("change", async () => {
      li.classList.toggle("on", input.checked);
      await WebScope.patch(f.key, { enabled: input.checked });
      if (refresh && input.checked) setTimeout(refresh, 150);
    });
    li.querySelector(".settings").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL(f.page) });
      window.close();
    });
    list.appendChild(li);
  }
})();
