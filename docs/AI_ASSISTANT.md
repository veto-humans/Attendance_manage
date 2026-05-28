# 專案總覽 — AI 助理查閱指南

此文件為供 AI 助理快速理解與導航本專案的參考，包含主要檔案、API 流程、驗證機制、前端行為與安全性要點。

## 快速啟動
- 安裝：`npm install`
- 啟動：`npm start`（或 `npm run dev` 使用 `nodemon`）

## 必要環境變數
- `JWT_SECRET`：JWT 簽章用密鑰（必填）
- `GAS_WEBAPP_URL`, `GAS_API_KEY`：呼叫 Google Apps Script API
- `FIREBASE_SERVICE_ACCOUNT`：Firebase admin 初始化所需（若使用 Firestore）

## 主要目錄與檔案對照
- `app.js`：Express 應用設定、middleware 與路由掛載。
- `server.js`：啟動伺服器並初始化 Firebase（若提供）。
- `routes/`：定義 API 路由
  - `routes/auth.js`：`POST /api/auth/login`，`GET /api/auth/profile`
  - `routes/attendance.js`：出勤相關 API
  - `routes/manager.js`：管理者功能 API
  - `routes/pages.js`：前端頁面路由
- `controllers/`：API 邏輯實作
  - `controllers/authController.js`：Google OAuth (idToken) 與 GAS (email/password) 登錄流程、token 建立、`getProfile`
  - `controllers/attendanceController.js`：出勤 CRUD 與匯入功能
  - `controllers/managerController.js`：班級/管理相關邏輯
- `middleware/auth.js`：Bearer JWT 驗證（`Authorization: Bearer <token>`）
- `models/`：資料模型抽象
  - `models/User.js`：取得使用者、class 資訊（透過 Firestore 或 GAS）
  - `models/Attendance.js`：出勤資料存取
- `config/`：外部整合
  - `config/gas.js`：呼叫 Google Apps Script WebApp API
  - `config/firebase.js`：Firebase admin 初始化與 `getAuth()` 使用
- `public/`：前端靜態資源（HTML/JS/CSS），例如 `public/main.js` 會在前端處理 token 與登出行為

## 驗證與會話流程摘要
- 登錄（`POST /api/auth/login`）:
  - 若有 `idToken`：透過 Firebase Admin `verifyIdToken()` 驗證 Google 帳號，然後從 Firestore 讀取使用者資料，再以 `JWT_SECRET` 簽發 API token。
  - 若無 `idToken`：使用 email/password，呼叫 GAS API 取得使用者資料（目前是直接比對 `user.password === password`），成功後簽發 JWT token。
- JWT 簽發：`jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' })`。
- 驗證中介層：`middleware/auth.js` 使用 `jwt.verify(token, process.env.JWT_SECRET)`，將 payload 放在 `req.user`。
- 登出：沒有後端登出端點；前端 `public/main.js` 的 `logout()` 會移除 `localStorage` 中的 `authToken` 與使用者資料。

## 前端 token 與儲存
- token 儲存在 `localStorage`（`authToken`），前端邏輯以此判斷是否已登入並導引頁面。
- 因為 `localStorage` 易受 XSS，請注意前端輸入消毒與 CSP 設定。

## 已發現的安全性要點（供 AI 助理參考）
- 密碼儲存/比對：目前看起來使用 GAS/Sheet 儲存密碼且以明文比對，應改為使用雜湊（bcrypt/argon2）與安全傳輸。若無法修改 GAS 端，至少在 server 端把傳入密碼雜湊後再比對儲存雜湊（視情況可行）。
- Token 撤銷/登出：目前沒有 server-side token 黑名單或撤銷機制，已簽發的 JWT 在過期前仍有效。建議:
  - 縮短 access token 存活時間（例如 15m~1h），並實作 refresh token（存在 HttpOnly cookie）
  - 或者在後端維護撤銷清單（Redis / Firestore / DB），middleware 驗證時檢查
- Token 儲存：優先使用 `Secure`, `HttpOnly`, `SameSite` cookie 替代 `localStorage`，防止 XSS 讀取。
- JWT_SECRET：確保為高熵值、非硬編碼、且僅在安全環境變數中提供。

## 修改建議位置（快速導引）
- 認證邏輯：`controllers/authController.js`（簽發與 payload 組裝）
- 驗證 middleware：`middleware/auth.js`（可加入撤銷檢查）
- 密碼處理：若要在 server 加入雜湊，修改 `controllers/authController.js` 的帳密分支；若 GAS 需改，檢視 `config/gas.js` 與 GAS WebApp。
- 前端登出/儲存：`public/main.js` 與各頁面的相關 JS (`public/teacher.js`, `public/secretary.js`, `public/manager.js`)。

## 重要檔案快速鏈接
- `app.js` — 應用啟動與路由設定
- `server.js` — 伺服器啟動、Firebase 初始化
- `routes/auth.js` — 登錄 / profile
- `controllers/authController.js` — 登錄實作
- `middleware/auth.js` — JWT 驗證
- `config/gas.js`, `config/firebase.js` — 外部服務連線

## 後續工作建議（優先順序）
1. 在 server 端或 GAS 端改為密碼雜湊（`bcrypt` 或 `argon2`）。
2. 縮短 JWT 存活並實作 refresh token（HttpOnly cookie）。
3. 增加 token 撤銷/黑名單機制（Redis 或 DB）。
4. 將前端 token 儲存移至安全 cookie，並落實 CSP 與輸入消毒。

---
若要我直接實作第 1 或第 2 項（改寫登錄流程、加入 refresh token、或加入 token 撤銷），我可以繼續修改相應檔案並執行測試。
