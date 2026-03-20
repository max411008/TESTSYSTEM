const STARRED_KEY = "starredQuestionIdsV1";
const WRONG_KEY = "wrongQuestionIdsV1";
const BANK_URL = "./pcc_2690_questions.json";
const BROWSE_STATE_KEY = "browsePageStateV1";

const searchInput = document.getElementById("browse-search");
const summary = document.getElementById("browse-summary");
const list = document.getElementById("browse-list");
const pageInfo = document.getElementById("browse-page-info");
const pageInput = document.getElementById("browse-page-input");
const jumpBtn = document.getElementById("browse-jump-btn");
const prevBtn = document.getElementById("browse-prev-btn");
const nextBtn = document.getElementById("browse-next-btn");
const scrollTopBtn = document.getElementById("scroll-top-btn");
const scrollBottomBtn = document.getElementById("scroll-bottom-btn");
const filterAllBtn = document.getElementById("filter-all-btn");
const filterStarredBtn = document.getElementById("filter-starred-btn");
const filterWrongBtn = document.getElementById("filter-wrong-btn");

const state = {
  bank: [],
  filter: "all",
  keyword: "",
  page: 1,
  pageSize: getPageSize(),
};

function loadBrowseState() {
  try {
    const raw = localStorage.getItem(BROWSE_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return;
    state.filter = parsed.filter || "all";
    state.keyword = parsed.keyword || "";
    state.page = Math.max(1, Number(parsed.page) || 1);
  } catch {
    // Ignore invalid local state and keep defaults.
  }
}

function saveBrowseState() {
  localStorage.setItem(
    BROWSE_STATE_KEY,
    JSON.stringify({
      filter: state.filter,
      keyword: state.keyword,
      page: state.page,
    })
  );
}

function getPageSize() {
  return window.matchMedia("(max-width: 820px)").matches ? 8 : 12;
}

function normalizeOptionKey(raw) {
  const upper = String(raw || "").trim().toUpperCase();
  const match = upper.match(/[A-F]|[1-9]|[OX]|[TF]/);
  return match ? match[0] : upper.slice(0, 1);
}

function escapeHtml(raw) {
  return String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseInlineOptions(questionText) {
  const text = String(questionText || "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .trim();
  const matches = [...text.matchAll(/\(([A-F])\)/g)];
  if (matches.length < 2) return null;

  const stem = text.slice(0, matches[0].index).trim();
  const options = [];
  const seenKeys = new Set();

  for (let i = 0; i < matches.length; i += 1) {
    const key = matches[i][1].toUpperCase();
    if (seenKeys.has(key)) continue;
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const optionText = text
      .slice(start, end)
      .replace(/^[\s,，、.。:：;；]+/, "")
      .trim();
    if (!optionText) continue;
    options.push({ key, text: optionText });
    seenKeys.add(key);
  }

  if (options.length < 2) return null;
  return { stem: stem || text, options };
}

function normalizeQuestion(item, idx) {
  const parsed = parseInlineOptions(item.question || item.stem || "");
  const options = Array.isArray(item.options) && item.options.length
    ? item.options
        .map((opt) => ({ key: normalizeOptionKey(opt.key), text: String(opt.text || "").trim() }))
        .filter((opt) => opt.key && opt.text)
    : parsed
      ? parsed.options
      : [];

  return {
    id: String(item.id || `pcc2690-${item.no || idx + 1}`),
    no: String(item.no || idx + 1),
    question: parsed ? parsed.stem : String(item.question || item.stem || "").trim(),
    options,
    answer: normalizeOptionKey(item.answer || item.correctAnswer || item.correct || ""),
    category: String(item.category || ""),
  };
}

function loadIdSet(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function buildOptionHtml(question) {
  return (question.options || [])
    .map((opt) => {
      const isAnswer = normalizeOptionKey(opt.key) === normalizeOptionKey(question.answer);
      return `
        <li class="browse-option${isAnswer ? " browse-option-answer" : ""}">
          <span class="browse-option-key">${escapeHtml(opt.key)}.</span>
          <span>${escapeHtml(opt.text)}</span>
        </li>
      `;
    })
    .join("");
}

function setActiveFilterButton() {
  [filterAllBtn, filterStarredBtn, filterWrongBtn].forEach((btn) => btn.classList.remove("active"));
  if (state.filter === "all") filterAllBtn.classList.add("active");
  if (state.filter === "starred") filterStarredBtn.classList.add("active");
  if (state.filter === "wrong") filterWrongBtn.classList.add("active");
}

function getFilteredQuestions() {
  const starredSet = loadIdSet(STARRED_KEY);
  const wrongSet = loadIdSet(WRONG_KEY);
  const keyword = state.keyword.trim().toLowerCase();

  return state.bank.filter((q) => {
    if (state.filter === "starred" && !starredSet.has(q.id)) return false;
    if (state.filter === "wrong" && !wrongSet.has(q.id)) return false;
    if (!keyword) return true;

    const haystack = [q.no, q.category, q.question, ...(q.options || []).map((opt) => `${opt.key} ${opt.text}`)]
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword);
  });
}

function render() {
  const filtered = getFilteredQuestions();
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;

  const start = (state.page - 1) * state.pageSize;
  const pageItems = filtered.slice(start, start + state.pageSize);
  const starredSet = loadIdSet(STARRED_KEY);
  const wrongSet = loadIdSet(WRONG_KEY);

  summary.textContent = `共 ${filtered.length} 題，目前第 ${state.page} / ${totalPages} 頁`;
  pageInfo.textContent = `${state.page} / ${totalPages}`;
  pageInput.value = String(state.page);
  prevBtn.disabled = state.page === 1;
  nextBtn.disabled = state.page === totalPages;
  setActiveFilterButton();
  saveBrowseState();

  if (pageItems.length === 0) {
    list.innerHTML = `<section class="card"><p class="hint">找不到符合條件的題目。</p></section>`;
    return;
  }

  list.innerHTML = pageItems
    .map((q) => {
      const tags = [
        q.category ? `<span class="browse-tag">${escapeHtml(q.category)}</span>` : "",
        starredSet.has(q.id) ? `<span class="browse-tag browse-tag-star">星號</span>` : "",
        wrongSet.has(q.id) ? `<span class="browse-tag browse-tag-wrong">錯題</span>` : "",
      ]
        .filter(Boolean)
        .join("");

      return `
        <article class="card browse-card">
          <div class="browse-card-head">
            <p class="browse-no">第 ${escapeHtml(q.no)} 題</p>
            <p class="browse-answer">答案：${escapeHtml(q.answer || "(未設定)")}</p>
          </div>
          <div class="browse-tags">${tags}</div>
          <h2 class="browse-question">${escapeHtml(q.question)}</h2>
          <ul class="browse-options">
            ${buildOptionHtml(q)}
          </ul>
        </article>
      `;
    })
    .join("");
}

async function loadBank() {
  const res = await fetch(BANK_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error("無法載入題庫");
  const data = await res.json();
  state.bank = Array.isArray(data) ? data.map((item, idx) => normalizeQuestion(item, idx)) : [];
  searchInput.value = state.keyword;
  render();
}

searchInput.addEventListener("input", (event) => {
  state.keyword = event.target.value || "";
  state.page = 1;
  render();
});

filterAllBtn.addEventListener("click", () => {
  state.filter = "all";
  state.page = 1;
  render();
});

filterStarredBtn.addEventListener("click", () => {
  state.filter = "starred";
  state.page = 1;
  render();
});

filterWrongBtn.addEventListener("click", () => {
  state.filter = "wrong";
  state.page = 1;
  render();
});

prevBtn.addEventListener("click", () => {
  if (state.page > 1) {
    state.page -= 1;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

nextBtn.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(getFilteredQuestions().length / state.pageSize));
  if (state.page < totalPages) {
    state.page += 1;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

function jumpToPage() {
  const totalPages = Math.max(1, Math.ceil(getFilteredQuestions().length / state.pageSize));
  const target = Math.max(1, Math.min(Number(pageInput.value || 1), totalPages));
  state.page = target;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

jumpBtn.addEventListener("click", jumpToPage);

pageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    jumpToPage();
  }
});

scrollTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

scrollBottomBtn.addEventListener("click", () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
});

window.addEventListener("resize", () => {
  const nextPageSize = getPageSize();
  if (nextPageSize !== state.pageSize) {
    state.pageSize = nextPageSize;
    render();
  }
});

loadBrowseState();
loadBank().catch((err) => {
  summary.textContent = `載入失敗：${err.message}`;
  list.innerHTML = `<section class="card"><p class="hint">題庫頁面暫時無法讀取資料。</p></section>`;
});
