import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs";

const BANK_KEY = "questionBankV1";
const HISTORY_KEY = "examHistoryV1";
const DEFAULT_BANK_URL = "./default-question-bank.json";

const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");
const importModeSelect = document.getElementById("import-mode");
const clearAllBankBtn = document.getElementById("clear-all-bank-btn");
const loadDefaultBtn = document.getElementById("load-default-btn");
const uploadResult = document.getElementById("upload-result");
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

async function loadDefaultBank(replace = false) {
  const res = await fetch(DEFAULT_BANK_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error("無法載入內建題庫檔案");
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error("內建題庫為空");

  const current = loadBank();
  const merged = replace ? [] : [...current];
  const exists = new Set(merged.map((q) => q.id));
  let added = 0;
  for (const q of data) {
    if (q && q.id && !exists.has(q.id)) {
      merged.push(q);
      exists.add(q.id);
      added += 1;
    }
  }
  saveBank(merged);
  refreshBankInfo();
  uploadResult.textContent = `已載入內建題庫 ${added} 題（總題數 ${merged.length} 題）`;
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
  const circledMap = {
    "①": "1",
    "②": "2",
    "③": "3",
    "④": "4",
    "⑤": "5",
    "⑥": "6",
    "⑦": "7",
    "⑧": "8",
    "⑨": "9",
  };
  const upper = (raw || "")
    .trim()
    .toUpperCase()
    .replace(/[Ａ-Ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248))
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248))
    .replace(/[①②③④⑤⑥⑦⑧⑨]/g, (ch) => circledMap[ch] || ch);
  const match = upper.match(/[A-F]|[1-9]|[OX]|[TF]/);
  return match ? match[0] : upper.slice(0, 1);
}

function normalizeText(rawText) {
  return (rawText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248))
    .replace(/[Ａ-Ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248))
    .replace(/[ａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248))
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/．/g, ".")
    .replace(/\n{3,}/g, "\n\n");
}

function extractGlobalAnswers(text) {
  const answerMap = {};
  const answerSectionMatch = text.match(
    /(?:答案|解答|參考答案|answer\s*key|answers?)\s*[:：]?([\s\S]{0,5000})/i
  );
  const source = answerSectionMatch ? answerSectionMatch[1] : text;

  const pairRegex =
    /(?:^|\s)(\d{1,4})\s*[\.\)、:：-]?\s*[\(（]?([A-Fa-f1-9①②③④⑤⑥⑦⑧⑨Ａ-Ｆ０-９])[\)）]?(?=\s|$)/gi;
  let match;
  while ((match = pairRegex.exec(source)) !== null) {
    answerMap[match[1]] = normalizeOptionKey(match[2]);
  }
  return answerMap;
}

function parseCompactTableQuestions(rawText) {
  const text = normalizeText(rawText).replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!text) return [];

  const records =
    text.match(
      /(?:^|\s)(\d{1,4})\s+[\s\S]*?\(A\)[\s\S]*?\(B\)[\s\S]*?(?=(?:\s\d{1,4}\s+[\s\S]*?\(A\))|$)/gi
    ) || [];

  const result = [];
  for (const rec of records) {
    const m = rec.match(/^\s*(\d{1,4})\s+([\s\S]+)$/);
    if (!m) continue;
    const qNo = m[1];
    let content = m[2].trim();

    content = content.replace(/^序號\s*課程名稱\s*題目\s*答案\s*/i, "").trim();
    if (!/\(A\).+\(B\)/i.test(content)) continue;

    const answerMatch = content.match(/(?:[。.!?]|\s|[)）])([A-F1-9Ａ-Ｆ０-９①②③④⑤⑥⑦⑧⑨])\s*$/i);
    const answer = answerMatch ? normalizeOptionKey(answerMatch[1]) : "";
    if (answerMatch) {
      content = content.slice(0, answerMatch.index).trim();
    }

    const optIter = [...content.matchAll(/\(([A-F1-9])\)/gi)];
    if (optIter.length < 2) continue;

    const stem = content.slice(0, optIter[0].index).trim(" ：:。;；");
    if (!stem) continue;

    const options = [];
    for (let i = 0; i < optIter.length; i += 1) {
      const key = normalizeOptionKey(optIter[i][1]);
      const start = optIter[i].index + optIter[i][0].length;
      const end = i + 1 < optIter.length ? optIter[i + 1].index : content.length;
      const optText = content.slice(start, end).trim(" ，,。;；:：");
      if (optText) options.push({ key, text: optText });
    }

    if (options.length >= 2) {
      result.push({
        id: randomId(),
        no: qNo,
        question: stem,
        options,
        answer,
        explanation: "",
      });
    }
  }

  return result;
}

function parseQuestionBlocks(rawText) {
  const text = normalizeText(rawText);
  const blankBlocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const numberedBlocks =
    text.match(
      /(?:^|\n)\s*(?:Q\s*)?\d{1,4}[\)\]\.、:：-][\s\S]*?(?=(?:\n\s*(?:Q\s*)?\d{1,4}[\)\]\.、:：-])|$)/gim
    ) || [];
  const blocks = numberedBlocks.length > blankBlocks.length ? numberedBlocks : blankBlocks;

  const questions = [];
  const globalAnswers = extractGlobalAnswers(text);

  for (const block of blocks) {
    const rawLines = block
      .split("\n")
      .map((ln) => ln.trim())
      .filter(Boolean);
    const lines = [];
    for (const line of rawLines) {
      const markerCount = (
        line.match(/[\(（]?[A-FＡ-Ｆ1-9０-９①②③④⑤⑥⑦⑧⑨][\)）]?[\.\、:：-]/g) || []
      ).length;
      if (markerCount >= 2) {
        const expanded = line
          .replace(/([^\s])\s+(?=[\(（]?[A-FＡ-Ｆ1-9０-９①②③④⑤⑥⑦⑧⑨][\)）]?[\.\、:：-])/g, "$1\n")
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean);
        lines.push(...expanded);
      } else {
        lines.push(line);
      }
    }

    if (lines.length < 2) continue;

    let qNo = "";
    const qTextParts = [];
    const options = [];
    let answer = "";
    let explanation = "";
    let currentOptIdx = null;

    for (const line of lines) {
      const ansMatch = line.match(
        /^(?:答案|解答|answer)\s*[:：]\s*[\(（]?([A-Fa-fＡ-Ｆ1-9０-９①②③④⑤⑥⑦⑧⑨])[\)）]?/i
      );
      const expMatch = line.match(/^(?:解析|explanation)\s*[:：]\s*(.+)/i);
      const optMatch = line.match(
        /^(?:[\(（])?([A-Fa-fＡ-Ｆ1-9０-９①②③④⑤⑥⑦⑧⑨])(?:[\)）])?[\]\.、:：\s-]+(.+)$/
      );

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

      // Some table PDFs place the answer in a standalone cell/line.
      if (!answer && options.length >= 2) {
        const soloAns = line.match(/^[\s\(（]*([A-F1-9Ａ-Ｆ０-９①②③④⑤⑥⑦⑧⑨])[\s\)）]*$/i);
        if (soloAns) {
          answer = normalizeOptionKey(soloAns[1]);
          currentOptIdx = null;
          continue;
        }
      }

      if (currentOptIdx !== null) {
        options[currentOptIdx].text += ` ${line}`;
      } else {
        const qNoMatch = line.match(/^(?:Q\s*)?(\d{1,4})\s*[\)\]\.、:：-]+\s*/i);
        if (!qNo && qNoMatch) qNo = qNoMatch[1];
        const clean = line.replace(/^(?:Q\s*\d+|\d+|題\s*\d+)\s*[\)\]\.、:：-]?\s*/i, "");
        qTextParts.push(clean);
      }
    }

    if (!answer && qNo && globalAnswers[qNo]) {
      answer = globalAnswers[qNo];
    }

    if (!answer && options.length > 0) {
      const lastIdx = options.length - 1;
      const lastText = options[lastIdx].text || "";
      const punctMatch = lastText.match(/([\s\S]*?)[。.!?]\s*([A-F1-9])\s*$/i);
      if (punctMatch) {
        answer = normalizeOptionKey(punctMatch[2]);
        options[lastIdx].text = punctMatch[1].trim();
      } else {
        const tailMatch = lastText.match(/([\s\S]*?)\s+([A-F1-9])\s*$/i);
        if (tailMatch) {
          answer = normalizeOptionKey(tailMatch[2]);
          options[lastIdx].text = tailMatch[1].trim();
        }
      }
    }

    if (!answer) {
      const blockTail = block.match(/(?:[。.!?]|[\)）])\s*([A-F1-9])\s*$/i);
      if (blockTail) {
        answer = normalizeOptionKey(blockTail[1]);
      }
    }

    if (options.length >= 2 && qTextParts.length > 0) {
      questions.push({
        id: randomId(),
        no: qNo,
        question: qTextParts.join(" ").trim(),
        options,
        answer,
        explanation,
      });
    }
  }

  if (questions.length === 0) {
    return parseCompactTableQuestions(rawText);
  }

  const compact = parseCompactTableQuestions(rawText);
  if (compact.length > 0) {
    const qWithAns = questions.filter((q) => q.answer).length;
    const cWithAns = compact.filter((q) => q.answer).length;
    // Prefer compact parser when it clearly recovers more answers.
    if (cWithAns > qWithAns * 2 && compact.length >= Math.floor(questions.length * 0.5)) {
      return compact;
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
    const rows = content.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({
        text: it.str.trim(),
        x: it.transform?.[4] || 0,
        y: it.transform?.[5] || 0,
      }))
      .sort((a, b) => {
        if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
        return a.x - b.x;
      });

    const lines = [];
    let current = [];
    let currentY = null;
    for (const item of rows) {
      if (currentY === null || Math.abs(item.y - currentY) <= 2) {
        current.push(item);
        currentY = currentY === null ? item.y : (currentY + item.y) / 2;
      } else {
        current.sort((a, b) => a.x - b.x);
        lines.push(current.map((r) => r.text).join(" "));
        current = [item];
        currentY = item.y;
      }
    }
    if (current.length > 0) {
      current.sort((a, b) => a.x - b.x);
      lines.push(current.map((r) => r.text).join(" "));
    }

    parts.push(lines.join("\n"));
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
  let extractedText = "";

  try {
    extractedText = await extractText(file);
    const parsed = parseQuestionBlocks(extractedText);
    if (parsed.length === 0) {
      throw new Error("沒有抽出有效題目，請確認題目含選項（A/B/C/D）");
    }

    const bank = shouldReplaceImport() ? [] : loadBank();
    bank.push(...parsed);
    saveBank(bank);

    const withAnswer = parsed.filter((q) => q.answer).length;
    const withoutAnswer = parsed.length - withAnswer;
    const modeText = shouldReplaceImport() ? "覆蓋" : "追加";
    uploadResult.textContent = `成功${modeText} ${parsed.length} 題（有答案 ${withAnswer} 題，無答案 ${withoutAnswer} 題），總題數 ${bank.length} 題`;
    refreshBankInfo();
  } catch (err) {
    const preview = extractedText ? `；抽取文字預覽：${extractedText.slice(0, 120).replace(/\n/g, " ")}` : "";
    uploadResult.textContent = `失敗：${err.message}${preview}`;
  }
});

loadDefaultBtn.addEventListener("click", async () => {
  try {
    await loadDefaultBank(shouldReplaceImport());
  } catch (err) {
    uploadResult.textContent = `載入失敗：${err.message}`;
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
  uploadResult.textContent = "已清空總題庫，現在可以重新匯入。";
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

if (loadBank().length === 0) {
  loadDefaultBank(false).catch((err) => {
    uploadResult.textContent = `自動載入內建題庫失敗：${err.message}`;
  });
}

window.addEventListener("resize", () => {
  if (!examSection.classList.contains("hidden") && currentExamQuestions.length > 0) {
    renderExam(currentExamQuestions);
  }
});
