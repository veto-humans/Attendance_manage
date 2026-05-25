# Firestore 複合索引設置指南

## 📋 必須建立的複合索引

在執行遷移前，請在 Firestore Console 中建立以下複合索引。

### 索引 1: Users - role + managedGrade
**用途**：Manager 頁面查詢管理年段的教師

```
Collection: users
Field 1: role (Ascending)
Field 2: managedGrade (Ascending)
```

**查詢範例**
```javascript
db.collection('users')
  .where('role', '==', 'teacher')
  .where('managedGrade', '==', '1')
  .get()
```

**預期性能**
- 無索引時：O(n) - 全表掃描
- 有索引時：O(log n) - 秒級查詢

---

### 索引 2: Users - role + className
**用途**：查詢班級的教師

```
Collection: users
Field 1: role (Ascending)
Field 2: className (Ascending)
```

---

### 索引 3: AttendanceRecords - className + submittedAt
**用途**：查詢班級的最新出缺席紀錄

```
Collection Path: attendanceRecords/{date}/records
Field 1: className (Ascending)
Field 2: submittedAt (Descending)
```

**查詢範例**
```javascript
db.collection('attendanceRecords')
  .doc('2026-05-25')
  .collection('records')
  .where('className', '==', '1甲')
  .orderBy('submittedAt', 'desc')
  .limit(1)
  .get()
```

---

### 索引 4: AttendanceRecords - email + submittedAt
**用途**：查詢學生的填報歷史

```
Collection Path: attendanceRecords/{date}/records
Field 1: email (Ascending)
Field 2: submittedAt (Descending)
```

---

### 索引 5: ClassStatistics - date + submitted
**用途**：Secretary 查詢特定日期的填報狀態

```
Collection: classStatistics
Field 1: date (Ascending)
Field 2: submitted (Ascending)
```

**查詢範例**
```javascript
db.collection('classStatistics')
  .where('date', '==', '2026-05-25')
  .where('submitted', '==', true)
  .get()
```

---

### 索引 6: ClassStatistics - date + confirmed
**用途**：Secretary 查詢特定日期的確認狀態

```
Collection: classStatistics
Field 1: date (Ascending)
Field 2: confirmed (Ascending)
```

---

## 🚀 在 Firestore Console 建立索引

### 方式 A：使用 Firestore Console UI（推薦新手）

1. 打開 [Firestore Console](https://console.firebase.google.com)
2. 進入 **Indexes** 標籤
3. 點擊 **Create Index**
4. 按上述規格填入欄位
5. 點擊 **Create**

### 方式 B：使用 Firebase CLI（推薦開發者）

1. 安裝 Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

2. 建立索引配置檔 `firestore.indexes.json`
```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "managedGrade", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "className", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "records",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "className", "order": "ASCENDING" },
        { "fieldPath": "submittedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "records",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "email", "order": "ASCENDING" },
        { "fieldPath": "submittedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "classStatistics",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "submitted", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "classStatistics",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "confirmed", "order": "ASCENDING" }
      ]
    }
  ]
}
```

3. 部署索引
```bash
firebase deploy --only firestore:indexes
```

---

## 📊 性能對比：設計前 vs 設計後

### Scenario 1: Manager 載入班級（查詢 20 個班級的狀態）

**設計前（無索引 + 多次查詢）**
```javascript
// 步驟 1：查詢 20 位教師 (~200ms)
const teachers = await db.collection('users')
  .where('role', '==', 'teacher')
  .where('managedGrade', '==', '1')
  .get();  // ⚠️ 無複合索引，全表掃描

// 步驟 2：為每位教師查詢最新出缺席 (20 × ~30ms = 600ms)
const statuses = await Promise.all(
  teachers.docs.map(teacher =>
    db.collection('attendance')
      .where('className', '==', teacher.data().className)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()  // ⚠️ N+1 查詢問題
  )
);

// 總耗時：~800ms - 1000ms
```

**設計後（使用索引 + 反範式化）**
```javascript
// 步驟 1：查詢教師 (~50ms)
const teachers = await db.collection('users')
  .where('role', '==', 'teacher')
  .where('managedGrade', '==', '1')
  .get();  // ✓ 複合索引，快速查詢

// 步驟 2：查詢班級反範式化狀態 (~80ms)
const classStatuses = await db.collection('classes')
  .where('grade', '==', '1')
  .get();  // ✓ 已包含 submitted/teacherConfirmed 等狀態

// 步驟 3：組合響應 (~20ms)
const response = {
  grade: '1',
  classes: teachers.docs.map((teacherDoc, idx) => ({
    ...teacherDoc.data(),
    ...classStatuses.docs[idx].data()  // ✓ 反範式化避免額外查詢
  }))
};

// 總耗時：~150ms（改善 85%）
```

---

### Scenario 2: Secretary 全班級統計

**設計前**
```javascript
// 查詢全部班級 + 計算統計 (~2000ms)
const allClasses = await db.collection('attendance').get();

const stats = {};
allClasses.docs.forEach(doc => {
  const data = doc.data();
  // 手動計算聚合...
  stats[data.className] = {
    submitted: !!data.submittedAt,
    confirmed: !!data.teacherConfirmedAt
  };
});

// ⚠️ 每次都需要重新計算聚合
```

**設計後**
```javascript
// 查詢預計算的統計快照 (~200ms)
const snapshot = await db.collection('classStatistics')
  .where('date', '==', '2026-05-25')
  .get();

const stats = snapshot.docs.reduce((acc, doc) => {
  acc[doc.data().className] = doc.data();
  return acc;
}, {});

// ✓ 秒級查詢，無需計算
```

---

### Scenario 3: 統計面板（全校缺席分佈）

**設計前**
```javascript
// 遍歷全部出缺席記錄並手動計算
const records = await db.collection('attendance').get();
let stats = {
  sick: 0, personal: 0, absent: 0, late: 0,
  menstrual: 0, mental: 0, official: 0, other: 0
};

records.docs.forEach(doc => {
  doc.data().records?.forEach(record => {
    stats[mapReason(record.reason)]++;
  });
});

// ⚠️ O(n) 複雜度，大量計算
```

**設計後**
```javascript
// 查詢預計算的系統統計
const sysStats = await db.collection('systemStatistics')
  .doc('2026-05-25')
  .get();

const stats = sysStats.data().stats;
// ✓ O(1) 查詢，瞬間返回
```

---

## 📈 成本優化

| 操作 | 設計前 (讀次數) | 設計後 (讀次數) | 成本減少 |
|------|--------------|--------------|---------|
| Manager 載入班級 | 21 | 2 | 90% ⬇️ |
| Secretary 全班級統計 | 18 | 1 | 94% ⬇️ |
| 統計面板生成 | 500+ | 1 | 99% ⬇️ |
| Teacher 確認頁面 | 3 | 1 | 67% ⬇️ |

**月度成本估算**
- 設計前：~10,000 讀操作 × $0.06 / 100K = ~$6 / 月
- 設計後：~1,000 讀操作 × $0.06 / 100K = ~$0.6 / 月
- **節省：90% 成本**

---

## ⚠️ 遷移前檢查清單

- [ ] 已備份所有 Firestore 數據
- [ ] 已在 Firestore Console 建立所有複合索引
- [ ] 已測試遷移腳本（DRY_RUN 模式）
- [ ] 已檢查舊數據完整性
- [ ] 已更新後端代碼以支持新結構
- [ ] 已在開發環境進行完整測試
- [ ] 已準備好回滾計畫
- [ ] 已通知所有利益相關者

---

## 🔄 遷移步驟

### Step 1：準備工作（1 天）
```bash
# 建立備份
gsutil -m cp -r gs://your-project.appspot.com/* ./firestore-backup/

# 測試遷移
DRY_RUN=true npm run migrate:firestore

# 檢查遷移日誌
```

### Step 2：執行遷移（1 小時）
```bash
# 停止應用服務
pm2 stop attendance-service

# 執行遷移
npm run migrate:firestore

# 驗證數據
node scripts/validate-firestore.js
```

### Step 3：測試驗證（2 小時）
```bash
# 啟動應用
pm2 start attendance-service

# 運行集成測試
npm run test:integration

# 監控性能指標
```

### Step 4：上線切換（30 分鐘）
```bash
# 監控線上系統
tail -f logs/production.log

# 若出現問題，執行回滾
npm run migrate:rollback
```

---

## 📞 技術支援

遇到問題？參考以下文件：
- [Firestore 查詢最佳實踐](https://firebase.google.com/docs/firestore/query-data/queries)
- [Firestore 複合索引](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase CLI 索引部署](https://firebase.google.com/docs/firestore/manage-indexes#deploy_indexes)
