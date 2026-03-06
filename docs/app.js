const BANK_KEY = "questionBankV1";
const HISTORY_KEY = "examHistoryV1";
const DEFAULT_BANK_URL = "./default-question-bank.json";
const PG11501_BANK_URL = "./question-bank-pg11501.json";

const importModeSelect = document.getElementById("import-mode");
const clearAllBankBtn = document.getElementById("clear-all-bank-btn");
const loadDefaultBtn = document.getElementById("load-default-btn");
const loadPg11501Btn = document.getElementById("load-pg11501-btn");
const loadMixedBtn = document.getElementById("load-mixed-btn");
const loadResult = document.getElementById("load-result");

const bankInfo = document.getElementById("bank-info");
const examCountInput = document.getElementById("exam-count");
const startExamBtn = document.getElementById("start-exam-btn");
const clearBankBtn = document.getElementById("clear-bank-btn");
const examSection = document.getElementById("exam-section");
const examProgress = document.getElementById("exam-progress");
const examForm = document.getElementById("exam-form");
const examNav = document.getElementById("exam-nav");
const prevQuestionBtn = document.getElementById("prev-question-btn");
const nextQuestionBtn = document.getElementById("next-question-btn");
const submitExamBtn = document.getElementById("submit-exam-btn");
const resultSection = document.getElementById("result-section");
const scoreDiv = document.getElementById("score");
const resultList = document.getElementById("result-list");
const historySummary = document.getElementById("history-summary");
const historyList = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history-btn");

let currentExamQuestions = [];
let currentExamAnswers = {};
let currentQuestionIndex = 0;

function isPhoneLayout() {
  return window.matchMedia("(max-width: 820px)").matches;
}

function normalizeOptionKey(raw) {
  const upper = (raw || "").trim().toUpperCase();
  const match = upper.match(/[A-F]|[1-9]|[OX]|[TF]/);
  return match ? match[0] : upper.slice(0, 1);
}

function loadBank() {
  try {
    const raw = localStorage.getItem(BANK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBank(bank) {
  localStorage.setItem(BANK_KEY, JSON.stringify(bank));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function refreshBankInfo() {
  const bank = loadBank();
  bankInfo.textContent = `目前題庫：${bank.length} 題（存在此瀏覽器）`;
}

function shouldReplaceImport() {
  return importModeSelect && importModeSelect.value === "replace";
}

async function fetchBankJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error("無法載入題庫檔案");
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error("題庫檔案是空的");
  return data;
}

function mergeBank(current, incoming, replace) {
  const merged = replace ? [] : [...current];
  const exists = new Set(merged.map((q) => q.id));
  let added = 0;

  for (const q of incoming) {
    if (q && q.id && !exists.has(q.id)) {
      merged.push(q);
      exists.add(q.id);
      added += 1;
    }
  }
  return { merged, added };
}

async function loadBankFromFile(url, replace = false, label = "內建題庫") {
  const incoming = await fetchBankJson(url);
  const current = loadBank();
  const { merged, added } = mergeBank(current, incoming, replace);
  saveBank(merged);
  refreshBankInfo();
  loadResult.textContent = `已載入${label} ${added} 題（總題數 ${merged.length} 題）`;
}

async function loadMixedBanks(replace = false) {
  const [bankA, bankB] = await Promise.all([fetchBankJson(DEFAULT_BANK_URL), fetchBankJson(PG11501_BANK_URL)]);
  const current = loadBank();
  const source = [...bankA, ...bankB];
  const { merged, added } = mergeBank(current, source, replace);
  saveBank(merged);
  refreshBankInfo();
  loadResult.textContent = `已載入混合題庫 ${added} 題（總題數 ${merged.length} 題）`;
}

function formatDate(isoText) {
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return isoText;
  return date.toLocaleString("zh-TW", { hour12: false });
}

function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    historySummary.textContent = "尚無考試紀錄。";
    historyList.innerHTML = "";
    return;
  }

  const scores = history.map((h) => Number(h.score) || 0);
  const totalAttempts = history.length;
  const avg = Math.round((scores.reduce((sum, s) => sum + s, 0) / totalAttempts) * 100) / 100;
  const best = Math.max(...scores);
  const recent = history.slice(-5);
  const recentAvg =
    Math.round(
      (recent.reduce((sum, h) => sum + (Number(h.score) || 0), 0) / Math.max(1, recent.length)) * 100
    ) / 100;

  historySummary.textContent = `總考次：${totalAttempts} 次 | 平均分數：${avg} | 最高分：${best} | 最近${recent.length}次平均：${recentAvg}`;

  historyList.innerHTML = "";
  const descHistory = [...history].reverse();
  descHistory.forEach((item) => {
    const box = document.createElement("div");
    box.className = "question";
    box.innerHTML = `
      <p><strong>第 ${item.attempt} 次考試</strong>（${formatDate(item.submittedAt)}）</p>
      <p>分數：${item.score}（${item.correct}/${item.total}）</p>
      <p>作答：${item.answered} 題，未作答：${item.unanswered} 題</p>
    `;
    historyList.appendChild(box);
  });
}

loadDefaultBtn.addEventListener("click", async () => {
  try {
    await loadBankFromFile(DEFAULT_BANK_URL, shouldReplaceImport(), "內建題庫（802396666）");
  } catch (err) {
    loadResult.textContent = `載入失敗：${err.message}`;
  }
});

loadPg11501Btn.addEventListener("click", async () => {
  try {
    await loadBankFromFile(PG11501_BANK_URL, shouldReplaceImport(), "內建題庫（品管(土建)【115年1月起適用】）");
  } catch (err) {
    loadResult.textContent = `載入失敗：${err.message}`;
  }
});

loadMixedBtn.addEventListener("click", async () => {
  try {
    await loadMixedBanks(shouldReplaceImport());
  } catch (err) {
    loadResult.textContent = `載入失敗：${err.message}`;
  }
});

startExamBtn.addEventListener("click", () => {
  const bank = loadBank();
  if (bank.length === 0) {
    alert("題庫是空的，請先載入題庫");
    return;
  }

  const count = Math.max(1, Math.min(Number(examCountInput.value || 10), bank.length));
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  currentExamQuestions = shuffled.slice(0, count);
  currentExamAnswers = {};
  currentQuestionIndex = 0;

  renderExam(currentExamQuestions);
  examSection.classList.remove("hidden");
  resultSection.classList.add("hidden");
});

submitExamBtn.addEventListener("click", () => {
  const answers = { ...currentExamAnswers };

  let correct = 0;
  let scorableTotal = 0;
  const details = currentExamQuestions.map((q) => {
    const yourAnswer = normalizeOptionKey(answers[q.id] || "");
    const correctAnswer = normalizeOptionKey(q.answer || "");
    const isScorable = Boolean(correctAnswer);
    if (isScorable) scorableTotal += 1;
    const isCorrect = isScorable && yourAnswer && yourAnswer === correctAnswer;
    if (isCorrect) correct += 1;

    return {
      question: q.question,
      yourAnswer,
      correctAnswer,
      isScorable,
      isCorrect,
      explanation: q.explanation || "",
    };
  });

  const total = currentExamQuestions.length;
  const totalForScore = scorableTotal;
  const finalScore = totalForScore ? Math.round((correct / totalForScore) * 10000) / 100 : 0;
  renderResult({ score: finalScore, correct, total, totalForScore, details });

  const history = loadHistory();
  const answered = Object.keys(answers).length;
  const unanswered = Math.max(0, total - answered);
  history.push({
    attempt: history.length + 1,
    submittedAt: new Date().toISOString(),
    score: finalScore,
    correct,
    total,
    answered,
    unanswered,
  });
  saveHistory(history);
  renderHistory();
});

clearBankBtn.addEventListener("click", () => {
  if (!confirm("確定要清空題庫嗎？")) return;

  saveBank([]);
  currentExamQuestions = [];
  currentExamAnswers = {};
  currentQuestionIndex = 0;
  examSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  refreshBankInfo();
  alert("題庫已清空");
});

clearAllBankBtn.addEventListener("click", () => {
  if (!confirm("確定要先清空總題庫嗎？")) return;
  saveBank([]);
  currentExamQuestions = [];
  currentExamAnswers = {};
  currentQuestionIndex = 0;
  examSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  refreshBankInfo();
  loadResult.textContent = "已清空總題庫，現在可以重新載入。";
});

clearHistoryBtn.addEventListener("click", () => {
  if (!confirm("確定要清空所有考試紀錄嗎？")) return;
  saveHistory([]);
  renderHistory();
  alert("考試紀錄已清空");
});

prevQuestionBtn.addEventListener("click", () => {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex -= 1;
    renderExam(currentExamQuestions);
  }
});

nextQuestionBtn.addEventListener("click", () => {
  if (currentQuestionIndex < currentExamQuestions.length - 1) {
    currentQuestionIndex += 1;
    renderExam(currentExamQuestions);
  }
});

function renderExam(questions) {
  if (!questions || questions.length === 0) {
    examForm.innerHTML = "";
    examProgress.textContent = "";
    return;
  }

  if (isPhoneLayout()) {
    renderExamPhone(questions);
  } else {
    renderExamDesktop(questions);
  }
}

function renderExamPhone(questions) {
  const safeIndex = Math.max(0, Math.min(currentQuestionIndex, questions.length - 1));
  currentQuestionIndex = safeIndex;
  const q = questions[safeIndex];

  examForm.innerHTML = "";
  const box = document.createElement("div");
  box.className = "question";

  const title = document.createElement("p");
  title.textContent = `${safeIndex + 1}. ${q.question}`;
  box.appendChild(title);

  q.options.forEach((opt) => {
    const label = document.createElement("label");
    label.className = "option-label";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = q.id;
    radio.value = opt.key;
    radio.checked = currentExamAnswers[q.id] === opt.key;
    radio.addEventListener("change", () => {
      currentExamAnswers[q.id] = opt.key;
      updateProgress();
    });

    label.appendChild(radio);
    label.append(` ${opt.key}. ${opt.text}`);
    box.appendChild(label);
  });

  examForm.appendChild(box);
  examNav.classList.remove("hidden");
  prevQuestionBtn.disabled = safeIndex === 0;
  nextQuestionBtn.disabled = safeIndex === questions.length - 1;
  updateProgress();
}

function renderExamDesktop(questions) {
  examForm.innerHTML = "";
  questions.forEach((q, idx) => {
    const box = document.createElement("div");
    box.className = "question";

    const title = document.createElement("p");
    title.textContent = `${idx + 1}. ${q.question}`;
    box.appendChild(title);

    q.options.forEach((opt) => {
      const label = document.createElement("label");
      label.className = "option-label";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = q.id;
      radio.value = opt.key;
      radio.checked = currentExamAnswers[q.id] === opt.key;
      radio.addEventListener("change", () => {
        currentExamAnswers[q.id] = opt.key;
        updateProgress();
      });

      label.appendChild(radio);
      label.append(` ${opt.key}. ${opt.text}`);
      box.appendChild(label);
    });

    examForm.appendChild(box);
  });
  examNav.classList.remove("hidden");
  prevQuestionBtn.disabled = true;
  nextQuestionBtn.disabled = true;
  updateProgress();
}

function updateProgress() {
  const total = currentExamQuestions.length;
  const answered = Object.keys(currentExamAnswers).filter((id) => Boolean(currentExamAnswers[id])).length;
  if (total === 0) {
    examProgress.textContent = "";
    return;
  }
  if (isPhoneLayout()) {
    examProgress.textContent = `第 ${currentQuestionIndex + 1}/${total} 題，已作答 ${answered} 題`;
  } else {
    examProgress.textContent = `共 ${total} 題，已作答 ${answered} 題`;
  }
}

function renderResult(data) {
  resultSection.classList.remove("hidden");
  scoreDiv.textContent = `成績：${data.score} 分（可評分題 ${data.correct}/${data.totalForScore}，總題數 ${data.total}）`;

  resultList.innerHTML = "";
  data.details.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "question";

    const stateClass = item.isScorable ? (item.isCorrect ? "result-ok" : "result-bad") : "";
    const stateText = item.isScorable ? (item.isCorrect ? "答對" : "答錯") : "此題未設定答案";

    div.innerHTML = `
      <p><strong>${idx + 1}. ${item.question}</strong></p>
      <p class="${stateClass}">${stateText}</p>
      <p>你的答案：${item.yourAnswer || "(未作答)"}</p>
      <p>正確答案：${item.correctAnswer || "(未設定)"}</p>
      <p>解析：${item.explanation || "(無)"}</p>
    `;

    resultList.appendChild(div);
  });
}

refreshBankInfo();
renderHistory();

window.addEventListener("resize", () => {
  if (!examSection.classList.contains("hidden") && currentExamQuestions.length > 0) {
    renderExam(currentExamQuestions);
  }
});
