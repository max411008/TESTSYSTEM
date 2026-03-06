const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");
const uploadResult = document.getElementById("upload-result");
const bankInfo = document.getElementById("bank-info");
const examCountInput = document.getElementById("exam-count");
const startExamBtn = document.getElementById("start-exam-btn");
const clearBankBtn = document.getElementById("clear-bank-btn");
const examSection = document.getElementById("exam-section");
const examForm = document.getElementById("exam-form");
const submitExamBtn = document.getElementById("submit-exam-btn");
const resultSection = document.getElementById("result-section");
const scoreDiv = document.getElementById("score");
const resultList = document.getElementById("result-list");
const apiBaseInput = document.getElementById("api-base");
const saveApiBtn = document.getElementById("save-api-btn");
const apiResult = document.getElementById("api-result");

let currentExamId = "";
let apiBase = (localStorage.getItem("apiBase") || "").trim();

function normalizeBase(url) {
  return (url || "").trim().replace(/\/+$/, "");
}

function getApiUrl(path) {
  const base = normalizeBase(apiBase);
  if (!base) return path;
  return `${base}${path}`;
}

function updateApiHint() {
  apiResult.textContent = apiBase
    ? `目前 API：${apiBase}`
    : "目前 API：使用同網域（本機後端可留空）";
}

async function fetchJson(path, options = {}) {
  const url = getApiUrl(path);
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "請求失敗");
  return data;
}

async function fetchBankInfo() {
  try {
    const data = await fetchJson("/api/questions");
    bankInfo.textContent = `目前題庫：${data.count} 題`;
  } catch (err) {
    bankInfo.textContent = `讀取題庫失敗：${err.message}`;
  }
}

saveApiBtn.addEventListener("click", async () => {
  apiBase = normalizeBase(apiBaseInput.value);
  localStorage.setItem("apiBase", apiBase);
  updateApiHint();
  await fetchBankInfo();
});

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  const fd = new FormData();
  fd.append("file", file);

  uploadResult.textContent = "上傳與解析中...";

  try {
    const url = getApiUrl("/api/upload");
    const res = await fetch(url, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "上傳失敗");
    uploadResult.textContent = `成功新增 ${data.added_count} 題，總題數 ${data.total_count} 題`;
    await fetchBankInfo();
  } catch (err) {
    uploadResult.textContent = `失敗：${err.message}`;
  }
});

startExamBtn.addEventListener("click", async () => {
  const count = Number(examCountInput.value || 10);

  try {
    const data = await fetchJson("/api/exam/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });

    currentExamId = data.exam_id;
    renderExam(data.questions);
    examSection.classList.remove("hidden");
    resultSection.classList.add("hidden");
  } catch (err) {
    alert(`開始失敗：${err.message}`);
  }
});

submitExamBtn.addEventListener("click", async () => {
  const answers = {};
  const radios = examForm.querySelectorAll("input[type='radio']:checked");
  radios.forEach((r) => {
    answers[r.name] = r.value;
  });

  try {
    const data = await fetchJson("/api/exam/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exam_id: currentExamId, answers }),
    });

    renderResult(data);
  } catch (err) {
    alert(`交卷失敗：${err.message}`);
  }
});

clearBankBtn.addEventListener("click", async () => {
  if (!confirm("確定要清空題庫嗎？")) return;

  try {
    const data = await fetchJson("/api/questions/clear", { method: "POST" });
    alert(data.message || "已清空");
    await fetchBankInfo();
    examSection.classList.add("hidden");
    resultSection.classList.add("hidden");
  } catch (err) {
    alert(`清空失敗：${err.message}`);
  }
});

function renderExam(questions) {
  examForm.innerHTML = "";
  questions.forEach((q, idx) => {
    const box = document.createElement("div");
    box.className = "question";

    const title = document.createElement("p");
    title.textContent = `${idx + 1}. ${q.question}`;
    box.appendChild(title);

    q.options.forEach((opt) => {
      const label = document.createElement("label");
      label.style.display = "block";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = q.id;
      radio.value = opt.key;

      label.appendChild(radio);
      label.append(` ${opt.key}. ${opt.text}`);
      box.appendChild(label);
    });

    examForm.appendChild(box);
  });
}

function renderResult(data) {
  resultSection.classList.remove("hidden");
  scoreDiv.textContent = `成績：${data.score} 分（${data.correct}/${data.total}）`;

  resultList.innerHTML = "";
  data.details.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "question";

    const stateClass = item.is_correct ? "result-ok" : "result-bad";
    const stateText = item.is_correct ? "答對" : "答錯";

    div.innerHTML = `
      <p><strong>${idx + 1}. ${item.question}</strong></p>
      <p class="${stateClass}">${stateText}</p>
      <p>你的答案：${item.your_answer || "(未作答)"}</p>
      <p>正確答案：${item.correct_answer || "(未設定)"}</p>
      <p>解析：${item.explanation || "(無)"}</p>
    `;
    resultList.appendChild(div);
  });
}

apiBaseInput.value = apiBase;
updateApiHint();
fetchBankInfo();
