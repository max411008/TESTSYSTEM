# 智慧題庫模擬考（Word / PDF / Excel）

這是一個 MVP 網頁程式：
- 上傳題庫檔案（`.docx/.pdf/.xlsx/.xls/.txt`）
- 自動解析題目
- 建立模擬考並作答
- 交卷後立即評分與顯示解析

## 1. 安裝

```bash
cd /Users/maxlin/刷題程式/app
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2. 啟動

```bash
cd /Users/maxlin/刷題程式/app
source .venv/bin/activate
uvicorn main:app --reload
```

打開瀏覽器：
- `http://127.0.0.1:8000`

## 3. 題目格式建議

目前解析器是規則式（非 LLM），請盡量使用以下格式：

```text
1. 台灣首都是哪裡？
A. 台北
B. 台中
C. 高雄
D. 台南
答案: A
解析: 台北是台灣首都。

2) 2+2=?
A) 3
B) 4
C) 5
D) 6
答案: B
```

## 4. 目前限制（MVP）

- 主要支援選擇題（A-F 選項）。
- 若題目沒有 `答案:` 欄位，該題會被略過。
- PDF 若是掃描影像（無文字層），需先 OCR 才能抽題。

## 5. 後續可升級

- 接 LLM 做更強韌的題目抽取（混亂格式也能解析）
- 增加分類、難度、章節標籤
- 錯題本與複習排程
- 使用者登入與多人題庫

## 6. GitHub Pages 前端（可直接使用）

此專案已提供 `docs/` 靜態前端與 `.github/workflows/deploy-pages.yml` 自動部署流程。

- Pages 網址（此 repo）：
  - `https://max411008.github.io/TESTSYSTEM/`
- 使用方式：
  - 直接開網址即可使用，不需要輸入後端網址。
  - 題庫資料存在使用者自己的瀏覽器（localStorage）。

## 7. Firebase Realtime Database 規則

如果 Firebase 主控台出現「測試模式即將到期」警告，表示 Realtime Database 目前仍是 30 天的公開測試規則；到期後，用戶端請求會被全部拒絕。

這個專案的前端只會讀寫：

- `users/{uid}/study/state`

而且要求使用者先經過 Firebase Authentication 登入，所以資料庫規則應改成「只允許登入使用者讀寫自己的節點」，不要保留公開 `.read/.write = true`。

可直接使用專案內的規則檔：

- [`docs/firebase-database.rules.json`](/Users/maxlin/刷題程式/docs/firebase-database.rules.json)

套用方式：

1. 打開 Firebase Console。
2. 進入 `Realtime Database`。
3. 切到 `規則 Rules` 分頁。
4. 用 `docs/firebase-database.rules.json` 的內容覆蓋目前規則並發布。

套用後，只有已登入的使用者能讀寫 `users/{自己的 uid}/study/state`，其他路徑一律拒絕。
