# Firestore NoSQL 數據結構重新設計

## 📊 當前系統分析

### 核心功能
1. **用戶認證與授權** - 教師、教官（管理者）、秘書、學生
2. **班級管理** - 班級資訊、教師、學生名單
3. **出缺席填報** - 學生填報、教師確認、管理者查看
4. **統計報表** - 按年段、按班級、按缺席事由統計

### 主要查詢模式（效能瓶頸）
| 查詢場景 | 用途 | 查詢條件 | 頻率 |
|---------|------|---------|------|
| Q1 | Manager 頁面載入 | `role='teacher' AND grade=管理年段` | 高 |
| Q2 | Teacher 頁面載入 | `className=班級 AND submitted=true ORDER BY createdAt DESC LIMIT 1` | 高 |
| Q3 | 登入認證 | `email=用戶電郵` | 中 |
| Q4 | Secretary 頁面載入 | `SELECT ALL classes STATUS` | 中 |
| Q5 | 統計面板 | `COUNT(records) GROUP BY reason` | 低 |

---

## 🗄️ 重新設計的 Collections 結構

### Collection 1: `users`
**用途**：存儲所有用戶（教師、管理者、秘書、學生）

```javascript
// Document ID: ${email}（使用 email 作為 primary key）
{
  email: "teacher001@school.edu.tw",
  name: "王老師",
  role: "teacher",                    // 'teacher' | 'Military Instructor' | 'secretary' | 'student'
  
  // 依 role 的條件欄位
  className: "1甲",                  // 教師/學生適用
  managedGrade: "1",                 // 管理者適用
  studentCount: 32,                  // 教師適用
  
  // 驗證相關
  password: "hashed_password",       // 帳密登入用
  googleId: "google_uid_xxx",        // Google OAuth 用
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  // 中繼資訊
  lastLoginAt: Timestamp,
  isActive: true
}
```

**索引需求**
```
✓ PRIMARY: email (已有)
✓ COMPOSITE-1: (role, email)
✓ COMPOSITE-2: (role, className) - 查詢班級教師
✓ COMPOSITE-3: (role, managedGrade) - 查詢管理年段教師
```

**Firestore 複合索引設置**
```json
{
  "collectionId": "users",
  "fields": [
    { "fieldPath": "role", "order": "ASCENDING" },
    { "fieldPath": "className", "order": "ASCENDING" }
  ]
}
{
  "collectionId": "users",
  "fields": [
    { "fieldPath": "role", "order": "ASCENDING" },
    { "fieldPath": "managedGrade", "order": "ASCENDING" }
  ]
}
```

---

### Collection 2: `classes`
**用途**：班級主檔

```javascript
// Document ID: ${className}（例如 "1a"）
{
  className: "1甲",
  grade: "1",                        // 年級
  studentCount: 32,
  teacherEmail: "teacher001@school.edu.tw",
  teacherName: "王老師",
  
  // 當日狀態（反範式化，便於快速查詢）
  submitted: true,
  submittedAt: Timestamp,
  teacherConfirmed: true,
  teacherConfirmedAt: Timestamp,
  
  // 統計快照（每日更新一次）
  dailyStats: {
    attendanceCount: 30,
    absentCount: 2,
    statsSnapshot: {
      sick: 1,
      personal: 1,
      absent: 0,
      late: 0,
      menstrual: 0,
      mental: 0,
      official: 0,
      other: 0
    }
  },
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**索引需求**
```
✓ PRIMARY: className
✓ COMPOSITE-1: (grade, submitted) - Secretary 快速查詢所有班級狀態
✓ COMPOSITE-2: (teacherEmail, submitted) - 老師查詢自己班級狀態
```

---

### Collection 3: `attendance`（逐日子集合）
**用途**：出缺席紀錄，按日期分割（時間序列設計）

```javascript
// Document Path: attendance/${date}/records/${recordId}
// 例如: attendance/2026-05-25/records/record_001

// 子集合結構：
attendanceRecords/
  ├── 2026-05-25/           // 按日期分割（時間序列）
  │   ├── metadata
  │   │   ├── totalRecords: 18
  │   │   ├── createdAt: Timestamp
  │   │   └── processedAt: Timestamp
  │   └── records/
  │       ├── record_001
  │       ├── record_002
  │       └── record_003
  ├── 2026-05-24/
  └── 2026-05-23/

// 每個 record 文件：
{
  recordId: "record_001",
  email: "student001@school.edu.tw",
  className: "1甲",
  date: Timestamp("2026-05-25"),     // 填報日期
  
  // 出缺席明細
  studentCount: 32,
  attendanceCount: 30,
  records: [                          // 缺席學生列表
    {
      seat: "01",
      reason: "病假",
      remark: "感冒"
    },
    {
      seat: "05",
      reason: "遲到",
      remark: ""
    }
  ],
  
  // 確認狀態
  submitted: true,
  submittedAt: Timestamp,
  teacherConfirmed: false,
  teacherConfirmedBy: null,
  teacherConfirmedAt: null,
  
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  // TTL 欄位（可選：30 天後自動刪除）
  expiresAt: Timestamp
}
```

**設計考量**
- **時間序列分割**：按日期創建子集合，避免單一文件過大
- **查詢優化**：快速查找特定日期的所有記錄
- **TTL 清理**：設置過期時間自動刪除舊紀錄

**索引需求**
```
✓ COMPOSITE-1: (className, submittedAt DESC)
  - 用於查詢班級的最新填報

✓ COMPOSITE-2: (email, submittedAt DESC)
  - 用於查詢學生的填報歷史

✓ COMPOSITE-3: (date, submitted)
  - 用於統計特定日期的提交狀態
```

**Firestore 複合索引設置**
```json
{
  "collectionPath": "attendanceRecords/{date}/records",
  "fields": [
    { "fieldPath": "className", "order": "ASCENDING" },
    { "fieldPath": "submittedAt", "order": "DESCENDING" }
  ]
}
{
  "collectionPath": "attendanceRecords/{date}/records",
  "fields": [
    { "fieldPath": "email", "order": "ASCENDING" },
    { "fieldPath": "submittedAt", "order": "DESCENDING" }
  ]
}
```

---

### Collection 4: `classStatistics`（每日快照）
**用途**：班級日統計（便於報表與秘書面板）

```javascript
// Document ID: ${className}_${date}
// 例如：1a_2026-05-25

{
  className: "1甲",
  date: "2026-05-25",
  
  // 當日聚合統計
  submitted: true,
  confirmed: true,
  studentCount: 32,
  attendanceCount: 30,
  absentCount: 2,
  
  // 缺席類型統計
  stats: {
    sick: 1,
    personal: 1,
    absent: 0,
    late: 0,
    menstrual: 0,
    mental: 0,
    official: 0,
    other: 0
  },
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**優點**
- Secretary 可以快速查詢所有班級統計
- 不需要即時計算，預計算結果
- 便於圖表和報表生成

**索引需求**
```
✓ COMPOSITE-1: (date, confirmed) - Secretary 查詢特定日期的確認狀態
✓ COMPOSITE-2: (date, submitted) - Secretary 查詢特定日期的填報狀態
```

---

### Collection 5: `systemStatistics`（全系統快照）
**用途**：全校統計（管理儀表板）

```javascript
// Document ID: ${date}（例如 2026-05-25）
{
  date: "2026-05-25",
  
  // 全校覆蓋率
  totalClasses: 18,
  submittedClasses: 16,
  confirmedClasses: 14,
  
  // 全校缺席統計
  totalAbsentCount: 27,
  stats: {
    sick: 5,
    personal: 8,
    absent: 3,
    late: 7,
    menstrual: 2,
    mental: 1,
    official: 1,
    other: 0
  },
  
  // 年段分佈
  gradeStats: {
    "1": { classes: 6, absent: 8 },
    "2": { classes: 6, absent: 10 },
    "3": { classes: 6, absent: 9 }
  },
  
  createdAt: Timestamp,
  generatedAt: Timestamp
}
```

**更新策略**
- 每天晚上 11:59 自動生成（或教師確認後觸發）
- 支持即時查詢與歷史趨勢分析

---

## 🔄 查詢優化方案

### Query 1: Manager 載入班級（最常用）
```javascript
// 優化前（低效）
db.collection('users')
  .where('role', '==', 'teacher')
  .where('managedGrade', '==', '1')
  .get()

// 需要複合索引：(role, managedGrade)
```

**對應的 API 改進**
```javascript
// 後端：managerController.js
// 現有邏輯已可以利用複合索引，只需確保索引已建立
const teachers = await db.collection('users')
  .where('role', '==', 'teacher')
  .where('managedGrade', '==', managedGrade)
  .get();

// 利用反範式化的班級狀態快速構建響應
const classStatuses = teachers.docs.map(doc => {
  const teacher = doc.data();
  // 查詢最新出缺席
  return queryLatestAttendance(teacher.className);
});
```

### Query 2: Teacher 確認班級狀態（次常用）
```javascript
// 優化前（低效）
db.collection('attendance')
  .where('className', '==', 'className')
  .orderBy('submittedAt', 'desc')
  .limit(1)
  .get()

// 改用時間序列子集合
db.collection('attendanceRecords')
  .doc(today)
  .collection('records')
  .where('className', '==', 'className')
  .limit(1)
  .get()
```

### Query 3: Secretary 全班級狀態
```javascript
// 優化後（快速聚合）
// 方案 A：查詢快照表
db.collection('classStatistics')
  .where('date', '==', today)
  .get()

// 方案 B：查詢反範式化班級檔
db.collection('classes')
  .where('submitted', '==', true)
  .get()
```

---

## 📈 索引清單（必須在 Firestore 建立）

| Collection | 欄位組合 | 用途 |
|-----------|--------|------|
| `users` | (role, managedGrade) | Manager 查詢班級教師 |
| `users` | (role, className) | 查詢班級教師 |
| `attendanceRecords/{date}/records` | (className, submittedAt DESC) | 查詢班級最新出缺席 |
| `attendanceRecords/{date}/records` | (email, submittedAt DESC) | 查詢學生填報歷史 |
| `classStatistics` | (date, submitted) | Secretary 查詢填報狀態 |
| `classStatistics` | (date, confirmed) | Secretary 查詢確認狀態 |

**自動索引**（Firestore 會自動建立）
- 所有單欄查詢（WHERE、ORDER BY）

---

## 💾 實施步驟

### Phase 1：修改數據模型（後端）
1. 更新 `models/User.js` - 加入 `managedGrade` 與 `className` 索引欄位
2. 更新 `models/Attendance.js` - 改用時間序列子集合結構
3. 新增 `models/ClassStatistics.js` - 快照聚合邏輯
4. 新增 `models/SystemStatistics.js` - 系統統計邏輯

### Phase 2：建立 Firestore 複合索引
1. 在 Firestore Console 建立所有複合索引
2. 驗證索引是否已生效

### Phase 3：遷移舊數據
1. 備份現有數據
2. 執行數據轉換腳本，遷移到新結構
3. 驗證數據完整性

### Phase 4：測試與上線
1. 單元測試：驗證查詢性能提升
2. 集成測試：驗證所有 API 正常運作
3. 灰度上線：逐步切換流量

---

## 🎯 效能指標改善預期

| 場景 | 優化前 | 優化後 | 改善 |
|------|------|------|------|
| Manager 載入班級 | ~500ms | ~150ms | 70% ⬇️ |
| Secretary 全班級統計 | ~1000ms | ~200ms | 80% ⬇️ |
| Teacher 確認頁面 | ~300ms | ~100ms | 67% ⬇️ |
| 統計報表生成 | ~2000ms | ~300ms | 85% ⬇️ |

---

## 📝 建議事項

1. **立即實施**
   - ✅ 建立複合索引（無需代碼改動）
   - ✅ 加入 `managedGrade` 欄位到 teacher 文件
   - ✅ 加入反範式化班級狀態到 `classes` 集合

2. **中期實施（2-4 週）**
   - 時間序列設計遷移（attendanceRecords/{date}/records）
   - 日統計快照表實施

3. **長期規劃**
   - 實施 TTL 自動清理舊紀錄
   - 建立實時統計儀表板
   - 考慮分層存儲（熱數據/冷數據）

