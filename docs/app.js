import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, getFirestore, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, hasFirebaseConfig } from "./firebase-config.js";

const BANK_KEY = "questionBankV1";
const HISTORY_KEY = "examHistoryV1";
const STARRED_KEY = "starredQuestionIdsV1";
const WRONG_KEY = "wrongQuestionIdsV1";
const PCC2690_BANK_URL = "./pcc_2690_questions.json";

const authStatus = document.getElementById("auth-status");
const syncStatus = document.getElementById("sync-status");
const authUsernameInput = document.getElementById("auth-username");
const authPasswordInput = document.getElementById("auth-password");
const authSignupBtn = document.getElementById("auth-signup-btn");
const authLoginBtn = document.getElementById("auth-login-btn");
const authLogoutBtn = document.getElementById("auth-logout-btn");

const loadPcc2690Btn = document.getElementById("load-pcc2690-btn");
const loadResult = document.getElementById("load-result");

const bankInfo = document.getElementById("bank-info");
const examCountInput = document.getElementById("exam-count");
const startExamBtn = document.getElementById("start-exam-btn");
const startWrongExamBtn = document.getElementById("start-wrong-exam-btn");
const startStarredExamBtn = document.getElementById("start-starred-exam-btn");
const startStarredWrongExamBtn = document.getElementById("start-starred-wrong-exam-btn");
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
const starredSummary = document.getElementById("starred-summary");
const clearStarredBtn = document.getElementById("clear-starred-btn");
const starredList = document.getElementById("starred-list");
const wrongSummary = document.getElementById("wrong-summary");
const clearWrongBtn = document.getElementById("clear-wrong-btn");
const wrongList = document.getElementById("wrong-list");

let currentExamQuestions = [];
let currentExamAnswers = {};
let currentQuestionIndex = 0;
let auth = null;
let db = null;
let currentUser = null;
let isApplyingRemoteState = false;

function isPhoneLayout() {
  return window.matchMedia("(max-width: 820px)").matches;
}

function normalizeOptionKey(raw) {
  const upper = (raw || "").trim().toUpperCase();
  const match = upper.match(/[A-F]|[1-9]|[OX]|[TF]/);
  return match ? match[0] : upper.slice(0, 1);
}

function setSyncStatus(text) {
  syncStatus.textContent = text;
}

function setAuthStatus(text) {
  authStatus.textContent = text;
}

function cloudDocRef(uid) {
  return doc(db, "users", uid, "study", "state");
}

async function pushCloudState(reason = "") {
  if (!db || !currentUser || isApplyingRemoteState) return;
  try {
    await setDoc(
      cloudDocRef(currentUser.uid),
      {
        username: fromInternalEmail(currentUser.email || ""),
        history: loadHistory(),
        starredIds: loadStarredIds(),
        wrongIds: loadWrongIds(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    setSyncStatus(`已同步雲端${reason ? `（${reason}）` : ""}`);
  } catch (err) {
    setSyncStatus(`同步失敗：${err.message}`);
  }
}

async function pullCloudState() {
  if (!db || !currentUser) return;
  try {
    setSyncStatus("同步中...");
    const snap = await getDoc(cloudDocRef(currentUser.uid));
    if (!snap.exists()) {
      await pushCloudState("建立雲端資料");
      return;
    }

    const data = snap.data() || {};
    isApplyingRemoteState = true;
    saveHistory(Array.isArray(data.history) ? data.history : []);
    saveStarredIds(Array.isArray(data.starredIds) ? data.starredIds : []);
    saveWrongIds(Array.isArray(data.wrongIds) ? data.wrongIds : []);
    isApplyingRemoteState = false;

    renderHistory();
    renderStarred();
    renderWrong();
    setSyncStatus("已從雲端同步");
  } catch (err) {
    isApplyingRemoteState = false;
    setSyncStatus(`讀取雲端失敗：${err.message}`);
  }
}

function getAuthFormValue() {
  const username = String(authUsernameInput.value || "")
    .trim()
    .toLowerCase();
  const password = String(authPasswordInput.value || "");
  return { username, password };
}

function toInternalEmail(username) {
  return `${username}@testsystem.local`;
}

function fromInternalEmail(emailText) {
  const email = String(emailText || "");
  return email.endsWith("@testsystem.local") ? email.replace("@testsystem.local", "") : email;
}

async function setupCloudAuth() {
  if (!hasFirebaseConfig()) {
    setAuthStatus("尚未設定 Firebase，請先填寫 firebase-config.js");
    setSyncStatus("未啟用雲端同步");
    return;
  }

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    if (!currentUser) {
      setAuthStatus("尚未登入");
      setSyncStatus("未同步（請登入）");
      return;
    }

    setAuthStatus(`已登入：${fromInternalEmail(currentUser.email) || currentUser.uid}`);
    await pullCloudState();
  });
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
  if (!isApplyingRemoteState) {
    void pushCloudState("更新考試紀錄");
  }
}

function loadStarredIds() {
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function saveStarredIds(ids) {
  localStorage.setItem(STARRED_KEY, JSON.stringify(ids));
  if (!isApplyingRemoteState) {
    void pushCloudState("更新星號題");
  }
}

function loadWrongIds() {
  try {
    const raw = localStorage.getItem(WRONG_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function saveWrongIds(ids) {
  localStorage.setItem(WRONG_KEY, JSON.stringify(ids));
  if (!isApplyingRemoteState) {
    void pushCloudState("更新錯題");
  }
}

function isStarred(questionId) {
  return loadStarredIds().includes(questionId);
}

function toggleStar(questionId) {
  const ids = loadStarredIds();
  const exists = ids.includes(questionId);
  const next = exists ? ids.filter((id) => id !== questionId) : [...ids, questionId];
  saveStarredIds(next);
  renderStarred();
  if (!examSection.classList.contains("hidden") && currentExamQuestions.length > 0) {
    renderExam(currentExamQuestions);
  }
}

function addWrongIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const current = new Set(loadWrongIds());
  ids.forEach((id) => {
    if (id) current.add(id);
  });
  saveWrongIds([...current]);
}

function removeWrongId(questionId) {
  const ids = loadWrongIds().filter((id) => id !== questionId);
  saveWrongIds(ids);
  renderWrong();
}

function refreshBankInfo() {
  const bank = loadBank();
  bankInfo.textContent = `目前題庫：${bank.length} 題（存在此瀏覽器）`;
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
      .replace(/^[\s,，、.。:：;；\-]+/, "")
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
    explanation: String(item.explanation || ""),
    category: String(item.category || ""),
  };
}

async function fetchBankJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error("無法載入題庫檔案");
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error("題庫檔案是空的");
  const normalized = data.map((item, idx) => normalizeQuestion(item, idx));
  const valid = normalized.filter((q) => q.question && Array.isArray(q.options) && q.options.length >= 2);
  if (valid.length === 0) throw new Error("題庫格式不正確，找不到有效題目");
  return valid;
}

async function loadBankFromFile(url, label = "內建題庫") {
  const incoming = await fetchBankJson(url);
  saveBank(incoming);
  refreshBankInfo();
  loadResult.textContent = `已載入${label} ${incoming.length} 題（總題數 ${incoming.length} 題）`;
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

function getStarredQuestions() {
  const bank = loadBank();
  const idSet = new Set(loadStarredIds());
  return bank.filter((q) => idSet.has(q.id));
}

function getWrongQuestions() {
  const bank = loadBank();
  const idSet = new Set(loadWrongIds());
  return bank.filter((q) => idSet.has(q.id));
}

function renderStarred() {
  const starred = getStarredQuestions();
  starredSummary.textContent = `已標記星號：${starred.length} 題`;
  starredList.innerHTML = "";

  if (starred.length === 0) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "目前沒有星號題目。";
    starredList.appendChild(hint);
    return;
  }

  starred.forEach((q, idx) => {
    const box = document.createElement("div");
    box.className = "question";
    box.innerHTML = `
      <p><strong>${idx + 1}. ${q.question}</strong></p>
      <p class="hint">題號：${q.no || q.id} | 答案：${q.answer || "(未設定)"}</p>
    `;

    const unstarBtn = document.createElement("button");
    unstarBtn.type = "button";
    unstarBtn.className = "star-toggle active";
    unstarBtn.textContent = "取消星號";
    unstarBtn.addEventListener("click", () => toggleStar(q.id));

    box.appendChild(unstarBtn);
    starredList.appendChild(box);
  });
}

function renderWrong() {
  const wrong = getWrongQuestions();
  wrongSummary.textContent = `已累積錯題：${wrong.length} 題`;
  wrongList.innerHTML = "";

  if (wrong.length === 0) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "目前沒有錯題。";
    wrongList.appendChild(hint);
    return;
  }

  wrong.forEach((q, idx) => {
    const box = document.createElement("div");
    box.className = "question";
    box.innerHTML = `
      <p><strong>${idx + 1}. ${q.question}</strong></p>
      <p class="hint">題號：${q.no || q.id} | 答案：${q.answer || "(未設定)"}</p>
    `;

    const mark = document.createElement("span");
    mark.className = "wrong-mark";
    mark.textContent = "✘";
    box.appendChild(mark);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "danger";
    removeBtn.textContent = "移除此錯題";
    removeBtn.addEventListener("click", () => removeWrongId(q.id));

    box.appendChild(removeBtn);
    wrongList.appendChild(box);
  });
}

function startExamFromPool(pool, emptyMessage) {
  if (pool.length === 0) {
    alert(emptyMessage);
    return;
  }
  const count = Math.max(1, Math.min(Number(examCountInput.value || 10), pool.length));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  currentExamQuestions = shuffled.slice(0, count);
  currentExamAnswers = {};
  currentQuestionIndex = 0;

  renderExam(currentExamQuestions);
  examSection.classList.remove("hidden");
  resultSection.classList.add("hidden");
}

loadPcc2690Btn.addEventListener("click", async () => {
  try {
    await loadBankFromFile(PCC2690_BANK_URL, "內建題庫（品管(土建)2690題，115年1月起適用）");
    renderStarred();
    renderWrong();
  } catch (err) {
    loadResult.textContent = `載入失敗：${err.message}`;
  }
});

authSignupBtn.addEventListener("click", async () => {
  if (!auth) {
    alert("尚未設定 Firebase，請先填寫 firebase-config.js");
    return;
  }
  const { username, password } = getAuthFormValue();
  if (!username || !password) {
    alert("請輸入帳號與密碼");
    return;
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    alert("帳號格式錯誤：限 3-32 字元，可用小寫英數與 . _ -");
    return;
  }
  if (password.length < 6) {
    alert("密碼至少需要 6 碼");
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, toInternalEmail(username), password);
    setSyncStatus("註冊成功，正在同步...");
  } catch (err) {
    alert(`註冊失敗：${err.message}`);
  }
});

authLoginBtn.addEventListener("click", async () => {
  if (!auth) {
    alert("尚未設定 Firebase，請先填寫 firebase-config.js");
    return;
  }
  const { username, password } = getAuthFormValue();
  if (!username || !password) {
    alert("請輸入帳號與密碼");
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, toInternalEmail(username), password);
    setSyncStatus("登入成功，正在同步...");
  } catch (err) {
    alert(`登入失敗：${err.message}`);
  }
});

authLogoutBtn.addEventListener("click", async () => {
  if (!auth || !currentUser) {
    alert("目前尚未登入");
    return;
  }
  try {
    await signOut(auth);
    setSyncStatus("已登出");
  } catch (err) {
    alert(`登出失敗：${err.message}`);
  }
});

startExamBtn.addEventListener("click", () => {
  const bank = loadBank();
  startExamFromPool(bank, "題庫是空的，請先載入 2690 題庫");
});

startStarredExamBtn.addEventListener("click", () => {
  const starred = getStarredQuestions();
  startExamFromPool(starred, "目前沒有星號題目，請先在作答區打星號");
});

startWrongExamBtn.addEventListener("click", () => {
  const wrong = getWrongQuestions();
  startExamFromPool(wrong, "目前沒有錯題，請先完成考試累積錯題");
});

startStarredWrongExamBtn.addEventListener("click", () => {
  const bank = loadBank();
  const starredSet = new Set(loadStarredIds());
  const wrongSet = new Set(loadWrongIds());
  const unionSet = new Set([...starredSet, ...wrongSet]);
  const mixed = bank.filter((q) => unionSet.has(q.id));
  startExamFromPool(mixed, "目前沒有星號或錯題，請先打星號或先完成考試");
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
      questionId: q.id,
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
  addWrongIds(details.filter((item) => item.isScorable && !item.isCorrect).map((item) => item.questionId));
  renderWrong();

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
  saveWrongIds([]);
  renderStarred();
  renderWrong();
  alert("題庫已清空");
});

clearHistoryBtn.addEventListener("click", () => {
  if (!confirm("確定要清空所有考試紀錄嗎？")) return;
  saveHistory([]);
  renderHistory();
  alert("考試紀錄已清空");
});

clearStarredBtn.addEventListener("click", () => {
  if (!confirm("確定要清空所有星號註記嗎？")) return;
  saveStarredIds([]);
  renderStarred();
});

clearWrongBtn.addEventListener("click", () => {
  if (!confirm("確定要清空所有錯題嗎？")) return;
  saveWrongIds([]);
  renderWrong();
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

  const header = document.createElement("div");
  header.className = "question-header";

  const title = document.createElement("p");
  title.textContent = `${safeIndex + 1}. ${q.question}`;
  header.appendChild(title);

  const starBtn = document.createElement("button");
  starBtn.type = "button";
  starBtn.className = `star-toggle${isStarred(q.id) ? " active" : ""}`;
  starBtn.textContent = isStarred(q.id) ? "★ 已星號" : "☆ 星號";
  starBtn.addEventListener("click", () => toggleStar(q.id));
  header.appendChild(starBtn);

  box.appendChild(header);

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

    const header = document.createElement("div");
    header.className = "question-header";

    const title = document.createElement("p");
    title.textContent = `${idx + 1}. ${q.question}`;
    header.appendChild(title);

    const starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.className = `star-toggle${isStarred(q.id) ? " active" : ""}`;
    starBtn.textContent = isStarred(q.id) ? "★ 已星號" : "☆ 星號";
    starBtn.addEventListener("click", () => toggleStar(q.id));
    header.appendChild(starBtn);

    box.appendChild(header);

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

async function bootstrapBank() {
  if (loadBank().length > 0) {
    refreshBankInfo();
    renderStarred();
    renderWrong();
    return;
  }
  try {
    await loadBankFromFile(PCC2690_BANK_URL, "內建題庫（品管(土建)2690題，115年1月起適用）");
    renderStarred();
    renderWrong();
  } catch (err) {
    refreshBankInfo();
    renderStarred();
    renderWrong();
    loadResult.textContent = `自動載入失敗：${err.message}`;
  }
}

setupCloudAuth();
bootstrapBank();
renderHistory();

window.addEventListener("resize", () => {
  if (!examSection.classList.contains("hidden") && currentExamQuestions.length > 0) {
    renderExam(currentExamQuestions);
  }
});
