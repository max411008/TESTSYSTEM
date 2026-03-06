import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs";

const BANK_KEY = "questionBankV1";
const HISTORY_KEY = "examHistoryV1";

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
const historySummary = document.getElementById("history-summary");
const historyList = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history-btn");

let currentExamQuestions = [];

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

function randomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function normalizeOptionKey(raw) {
  const upper = (raw || "").trim().toUpperCase();
  const match = upper.match(/[A-F]/);
  return match ? match[0] : upper.slice(0, 1);
}

function parseQuestionBlocks(rawText) {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n");
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((ln) => ln.trim())
      .filter(Boolean);

    if (lines.length < 2) continue;

    const qTextParts = [];
    const options = [];
    let answer = "";
    let explanation = "";
    let currentOptIdx = null;

    for (const line of lines) {
      const ansMatch = line.match(/^(?:答案|answer)\s*[:：]\s*([A-Fa-f])/i);
      const expMatch = line.match(/^(?:解析|explanation)\s*[:：]\s*(.+)/i);
      const optMatch = line.match(/^([A-Fa-f])[\)\]\.、:：\s-]+(.+)$/);

      if (ansMatch) {
        answer = normalizeOptionKey(ansMatch[1]);
        currentOptIdx = null;
        continue;
      }

      if (expMatch) {
        explanation = expMatch[1].trim();
        currentOptIdx = null;
        continue;
      }

      if (optMatch) {
        options.push({ key: normalizeOptionKey(optMatch[1]), text: optMatch[2].trim() });
        currentOptIdx = options.length - 1;
        continue;
      }

      if (currentOptIdx !== null) {
        options[currentOptIdx].text += ` ${line}`;
      } else {
        const clean = line.replace(/^(?:\d+|Q\d+|題\s*\d+)\s*[\)\]\.、:：-]?\s*/i, "");
        qTextParts.push(clean);
      }
    }

    if (options.length >= 2 && qTextParts.length > 0 && answer) {
      questions.push({
        id: randomId(),
        question: qTextParts.join(" ").trim(),
        options,
        answer,
        explanation,
      });
    }
  }

  return questions;
}

async function readPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const parts = [];

  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => it.str || "").join(" ");
    parts.push(pageText);
  }

  return parts.join("\n");
}

async function readDocx(file) {
  const buffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value || "";
}

async function readExcel(file) {
  const buffer = await file.arrayBuffer();
  const wb = window.XLSX.read(buffer, { type: "array" });
  const rows = [];

  for (const sheetName of wb.SheetNames) {
    rows.push(`### 工作表: ${sheetName}`);
    const ws = wb.Sheets[sheetName];
    const data = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    for (const row of data) {
      const vals = row.map((v) => String(v || "").trim()).filter(Boolean);
      if (vals.length > 0) rows.push(vals.join(" | "));
    }
  }

  return rows.join("\n");
}

async function extractText(file) {
  const ext = file.name.toLowerCase().split(".").pop();

  if (ext === "txt") return file.text();
  if (ext === "pdf") return readPdf(file);
  if (ext === "docx") return readDocx(file);
  if (ext === "xlsx" || ext === "xls") return readExcel(file);

  throw new Error("不支援的檔案格式");
}

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  uploadResult.textContent = "上傳與解析中...";

  try {
    const text = await extractText(file);
    const parsed = parseQuestionBlocks(text);
    if (parsed.length === 0) {
      throw new Error("沒有抽出有效題目，請確認有題幹、選項(A/B/...)與答案欄位");
    }

    const bank = loadBank();
    bank.push(...parsed);
    saveBank(bank);

    uploadResult.textContent = `成功新增 ${parsed.length} 題，總題數 ${bank.length} 題`;
    refreshBankInfo();
  } catch (err) {
    uploadResult.textContent = `失敗：${err.message}`;
  }
});

startExamBtn.addEventListener("click", () => {
  const bank = loadBank();
  if (bank.length === 0) {
    alert("題庫是空的，請先上傳題目");
    return;
  }

  const count = Math.max(1, Math.min(Number(examCountInput.value || 10), bank.length));
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  currentExamQuestions = shuffled.slice(0, count);

  renderExam(currentExamQuestions);
  examSection.classList.remove("hidden");
  resultSection.classList.add("hidden");
});

submitExamBtn.addEventListener("click", () => {
  const answers = {};
  const radios = examForm.querySelectorAll("input[type='radio']:checked");
  radios.forEach((r) => {
    answers[r.name] = r.value;
  });

  let correct = 0;
  const details = currentExamQuestions.map((q) => {
    const yourAnswer = normalizeOptionKey(answers[q.id] || "");
    const correctAnswer = normalizeOptionKey(q.answer || "");
    const isCorrect = yourAnswer && yourAnswer === correctAnswer;
    if (isCorrect) correct += 1;

    return {
      question: q.question,
      yourAnswer,
      correctAnswer,
      isCorrect,
      explanation: q.explanation || "",
    };
  });

  const total = currentExamQuestions.length;
  const score = total ? Math.round((correct / total) * 10000) / 100 : 0;
  renderResult({ score, correct, total, details });

  const history = loadHistory();
  const answered = Object.keys(answers).length;
  const unanswered = Math.max(0, total - answered);
  history.push({
    attempt: history.length + 1,
    submittedAt: new Date().toISOString(),
    score,
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
  examSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  refreshBankInfo();
  alert("題庫已清空");
});

clearHistoryBtn.addEventListener("click", () => {
  if (!confirm("確定要清空所有考試紀錄嗎？")) return;
  saveHistory([]);
  renderHistory();
  alert("考試紀錄已清空");
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

    const stateClass = item.isCorrect ? "result-ok" : "result-bad";
    const stateText = item.isCorrect ? "答對" : "答錯";

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
