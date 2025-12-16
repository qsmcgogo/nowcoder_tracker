# Tracker后台管理系统 API 文档

## 目录

1. [基础信息](#基础信息)
2. [每日一题管理系统](#每日一题管理系统)
3. [对战系统题目后台管理系统](#对战系统题目后台管理系统)
4. [通用说明](#通用说明)

---

## 基础信息

### 服务器地址
```
API_BASE_PATH: /problem/tracker
```

### 认证方式
所有接口都需要：
- 用户登录（`@LoginRequired`）
- Tracker管理员权限

### 请求格式
- Content-Type: `application/x-www-form-urlencoded` (POST)
- 或使用 Query Parameters (GET)

### 响应格式
所有接口统一返回JSON格式：
```json
{
  "code": 0,           // 0表示成功，非0表示失败
  "message": "success", // 响应消息
  "data": {}           // 具体数据
}
```

### 错误码说明
| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| -1 | 权限不足 |
| -2 | 参数错误 |
| -3 | 题目不存在 |
| -4 | 记录不存在 |
| -5 | 重复添加 |
| -6 | 数据库操作失败 |

---

## 每日一题管理系统

### 数据模型

#### TrackerClockQuestion
```typescript
interface TrackerClockQuestion {
  id: number;              // 主键ID
  questionId: number;      // 题目ID
  problemId: number;      // 问题ID
  shareLink: string;       // 分享链接
  createTime: string;      // 创建时间 (格式: "2025-01-15 10:00:00")
  updateTime: string;      // 更新时间 (格式: "2025-01-15 10:00:00")
}
```

---

### 1. 新增每日一题

**接口**: `POST /clock/question/add`

**功能**: 添加一道题目到每日一题题库

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| date | string | 是 | 日期，格式：YYYY-MM-DD |
| questionId | number | 否* | 题目ID（questionId和problemId至少提供一个） |
| problemId | number | 否* | 问题ID（questionId和problemId至少提供一个） |
| shareLink | string | 否 | 分享链接，默认为空字符串 |

**说明**: 
- `questionId` 和 `problemId` 至少需要提供一个
- 如果只提供其中一个，系统会自动获取另一个

**请求示例**:
```javascript
// 方式1: 只传questionId
{
  date: "2025-01-15",
  questionId: 12345,
  shareLink: "https://example.com/share/123"
}

// 方式2: 只传problemId
{
  date: "2025-01-15",
  problemId: 67890,
  shareLink: "https://example.com/share/123"
}

// 方式3: 两个都传（会验证是否匹配）
{
  date: "2025-01-15",
  questionId: 12345,
  problemId: 67890,
  shareLink: "https://example.com/share/123"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "date": "2025-01-15",
    "questionId": 12345,
    "problemId": 67890,
    "shareLink": "https://example.com/share/123"
  }
}
```

**错误响应**:
```json
{
  "code": -2,
  "message": "参数非法：questionId 和 problemId 至少需要提供一个",
  "data": null
}
```

---

### 2. 更新每日一题（按日期）

**接口**: `POST /clock/question/update`

**功能**: 更新指定日期的每日一题

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| date | string | 是 | 日期，格式：YYYY-MM-DD |
| questionId | number | 否* | 题目ID（questionId和problemId至少提供一个） |
| problemId | number | 否* | 问题ID（questionId和problemId至少提供一个） |
| shareLink | string | 否 | 分享链接，默认为空字符串 |

**请求示例**:
```javascript
{
  date: "2025-01-15",
  questionId: 12345,
  shareLink: "https://example.com/share/456"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rowsAffected": 1,
    "date": "2025-01-15",
    "questionId": 12345,
    "problemId": 67890,
    "shareLink": "https://example.com/share/456"
  }
}
```

---

### 3. 更新每日一题（按ID）

**接口**: `POST /clock/question/update-by-id`

**功能**: 根据ID更新每日一题

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 每日一题记录ID |
| questionId | number | 否* | 题目ID（questionId和problemId至少提供一个） |
| problemId | number | 否* | 问题ID（questionId和problemId至少提供一个） |
| shareLink | string | 否 | 分享链接，默认为空字符串 |

**请求示例**:
```javascript
{
  id: 1,
  questionId: 12345,
  shareLink: "https://example.com/share/789"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rowsAffected": 1,
    "id": 1,
    "questionId": 12345,
    "problemId": 67890,
    "shareLink": "https://example.com/share/789"
  }
}
```

---

### 4. 删除每日一题（按日期）

**接口**: `POST /clock/question/delete`

**功能**: 删除指定日期的每日一题

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| date | string | 是 | 日期，格式：YYYY-MM-DD |

**请求示例**:
```javascript
{
  date: "2025-01-15"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rowsAffected": 1,
    "date": "2025-01-15"
  }
}
```

---

### 5. 删除每日一题（按ID）

**接口**: `POST /clock/question/delete-by-id`

**功能**: 根据ID删除每日一题

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 每日一题记录ID |

**请求示例**:
```javascript
{
  id: 1
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rowsAffected": 1,
    "id": 1
  }
}
```

---

### 6. 根据ID查询每日一题

**接口**: `GET /clock/question/get`

**功能**: 根据ID查询每日一题的详细信息

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 每日一题记录ID |

**请求示例**:
```
GET /problem/tracker/clock/question/get?id=1
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "questionId": 12345,
    "problemId": 67890,
    "shareLink": "https://example.com/share/123",
    "createTime": "2025-01-15 10:00:00",
    "updateTime": "2025-01-15 12:00:00"
  }
}
```

---

### 7. 分页查询每日一题列表

**接口**: `GET /clock/question/list`

**功能**: 分页查询每日一题列表

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认20，最大200 |

**请求示例**:
```
GET /problem/tracker/clock/question/list?page=1&limit=20
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "list": [
      {
        "id": 1,
        "questionId": 12345,
        "problemId": 67890,
        "shareLink": "https://example.com/share/123",
        "createTime": "2025-01-15 10:00:00",
        "updateTime": "2025-01-15 12:00:00"
      }
    ]
  }
}
```

---

## 对战系统题目后台管理系统

### 数据模型

#### TrackerBattleProblem
```typescript
interface TrackerBattleProblem {
  id: number;              // 主键ID
  problemId: number;       // 题目ID
  levelScore: number;      // 题目难度等级分（用于匹配，范围：800-2500）
  matchCount: number;      // 匹配次数（该题目被匹配到的总次数）
  acCount: number;         // AC次数（该题目在对战中被AC的总次数）
  avgSeconds: number;      // 平均用时（秒）
  createTime: string;      // 创建时间 (格式: "2025-01-15 10:00:00")
  updateTime: string;      // 更新时间 (格式: "2025-01-15 10:00:00")
}
```

#### BatchAddResult（批量添加结果）
```typescript
interface BatchAddResult {
  successCount: number;    // 成功数量
  failCount: number;       // 失败数量
  failItems: BatchFailItem[]; // 失败项列表
}

interface BatchFailItem {
  problemId: number;       // 题目ID
  levelScore: number;      // 难度等级分
  reason: string;          // 失败原因
}
```

#### CheckDeleteResult（删除安全检查结果）
```typescript
interface CheckDeleteResult {
  canDelete: boolean;      // 是否可以删除
  riskLevel: string;       // 风险等级：low/medium/high
  warnings: string[];      // 警告信息列表
  matchCount: number;      // 匹配次数
  acCount: number;         // AC次数
  hasActiveRooms: boolean; // 是否有活跃房间（暂未实现）
}
```

---

### 1. 新增对战题目

**接口**: `POST /battle/problem/admin/add`

**功能**: 添加一道题目到对战系统题库

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| problemId | number | 是 | 题目ID |
| levelScore | number | 是 | 难度等级分，范围：800-2500 |

**请求示例**:
```javascript
{
  problemId: 12345,
  levelScore: 1600
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "problemId": 12345,
    "levelScore": 1600,
    "matchCount": 0,
    "acCount": 0,
    "avgSeconds": 0,
    "createTime": "2025-01-15 10:00:00",
    "updateTime": "2025-01-15 10:00:00"
  }
}
```

**错误响应**:
```json
{
  "code": -2,
  "message": "难度等级分必须提供且大于0",
  "data": null
}
```

```json
{
  "code": -2,
  "message": "难度等级分范围应在800-2500之间",
  "data": null
}
```

```json
{
  "code": -5,
  "message": "该题目已存在于对战题库中",
  "data": null
}
```

---

### 2. 更新对战题目

**接口**: `POST /battle/problem/admin/update`

**功能**: 更新对战题目的难度等级分

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 对战题目记录ID |
| levelScore | number | 是 | 新的难度等级分，范围：800-2500 |

**请求示例**:
```javascript
{
  id: 1,
  levelScore: 1700
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rowsAffected": 1,
    "id": 1,
    "levelScore": 1700
  }
}
```

---

### 3. 删除对战题目

**接口**: `POST /battle/problem/admin/delete`

**功能**: 从对战系统题库中删除一道题目

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 对战题目记录ID |

**请求示例**:
```javascript
{
  id: 1
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rowsAffected": 1,
    "id": 1
  }
}
```

**注意事项**: 
- 删除操作不会影响已有的对战记录和排行榜
- 删除后该题目将无法再被匹配系统选中
- 建议删除前先调用检查接口评估风险

---

### 4. 根据ID查询对战题目

**接口**: `GET /battle/problem/admin/get`

**功能**: 根据ID查询对战题目的详细信息

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 对战题目记录ID |

**请求示例**:
```
GET /problem/tracker/battle/problem/admin/get?id=1
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "problemId": 12345,
    "levelScore": 1600,
    "matchCount": 100,
    "acCount": 65,
    "avgSeconds": 1200,
    "createTime": "2025-01-15 10:00:00",
    "updateTime": "2025-01-15 12:00:00"
  }
}
```

---

### 5. 根据problemId查询对战题目

**接口**: `GET /battle/problem/admin/get-by-problem-id`

**功能**: 根据题目ID查询对战题目信息

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| problemId | number | 是 | 题目ID |

**请求示例**:
```
GET /problem/tracker/battle/problem/admin/get-by-problem-id?problemId=12345
```

**响应示例**: 同接口4

---

### 6. 分页查询对战题目列表

**接口**: `GET /battle/problem/admin/list`

**功能**: 分页查询对战题目列表，支持按难度等级分排序和筛选

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认20，最大200 |
| levelScoreMin | number | 否 | 最小难度等级分（筛选条件），0表示不限制 |
| levelScoreMax | number | 否 | 最大难度等级分（筛选条件），0表示不限制 |
| orderBy | string | 否 | 排序字段，默认id<br>可选值：`id`、`levelScore`、`matchCount`、`acCount`、`avgSeconds` |
| order | string | 否 | 排序方向，默认DESC<br>可选值：`ASC`、`DESC` |

**请求示例**:
```
GET /problem/tracker/battle/problem/admin/list?page=1&limit=20&levelScoreMin=1500&levelScoreMax=2000&orderBy=levelScore&order=ASC
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "list": [
      {
        "id": 1,
        "problemId": 12345,
        "levelScore": 1600,
        "matchCount": 100,
        "acCount": 65,
        "avgSeconds": 1200,
        "createTime": "2025-01-15 10:00:00",
        "updateTime": "2025-01-15 12:00:00"
      }
    ]
  }
}
```

---

### 7. 批量添加对战题目

**接口**: `POST /battle/problem/admin/batch-add`

**功能**: 批量添加题目到对战系统题库

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| items | string | 是 | JSON数组字符串，每个元素包含problemId和levelScore |

**请求示例**:
```javascript
{
  items: JSON.stringify([
    {problemId: 12345, levelScore: 1600},
    {problemId: 12346, levelScore: 1700}
  ])
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "successCount": 2,
    "failCount": 0,
    "failItems": []
  }
}
```

**部分失败示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "successCount": 1,
    "failCount": 1,
    "failItems": [
      {
        "problemId": 12346,
        "levelScore": 1700,
        "reason": "该题目已存在于对战题库中"
      }
    ]
  }
}
```

---

### 8. 批量删除对战题目

**接口**: `POST /battle/problem/admin/batch-delete`

**功能**: 批量删除对战题目

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ids | string | 是 | JSON数组字符串，包含要删除的ID列表 |

**请求示例**:
```javascript
{
  ids: JSON.stringify([1, 2, 3])
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rowsAffected": 3
  }
}
```

---

### 9. 检查题目是否可以安全删除

**接口**: `GET /battle/problem/admin/check-delete`

**功能**: 检查题目是否可以安全删除，返回风险评估信息

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 对战题目记录ID |

**请求示例**:
```
GET /problem/tracker/battle/problem/admin/check-delete?id=1
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "canDelete": true,
    "riskLevel": "low",
    "warnings": [],
    "matchCount": 50,
    "acCount": 30,
    "hasActiveRooms": false
  }
}
```

**高风险示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "canDelete": true,
    "riskLevel": "high",
    "warnings": [
      "该题目匹配次数很高（600次），删除后可能影响匹配系统",
      "该题目已有65次AC记录，删除后历史统计数据会丢失"
    ],
    "matchCount": 600,
    "acCount": 65,
    "hasActiveRooms": false
  }
}
```

**风险等级说明**:
- `low`: 可以安全删除，题目使用频率较低
- `medium`: 建议谨慎删除，题目使用频率中等（matchCount > 100）
- `high`: 不建议删除，题目使用频率很高（matchCount > 500）

---

### 10. 重置题目统计信息

**接口**: `POST /battle/problem/admin/reset-stats`

**功能**: 重置题目的统计信息（匹配次数、AC次数、平均用时）

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 对战题目记录ID |

**请求示例**:
```javascript
{
  id: 1
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rowsAffected": 1,
    "id": 1
  }
}
```

**注意事项**:
- 重置操作不会影响已有的对战记录和排行榜
- 重置后，题目的平均用时变为0，匹配时系统会使用默认值
- 统计信息会重新累积，但历史统计数据会丢失
- 谨慎使用，建议记录操作日志

---

## 通用说明

### 权限要求
所有接口都需要：
1. 用户已登录
2. 当前用户是 Tracker 管理员

如果权限不足，会返回：
```json
{
  "code": -1,
  "message": "无权限：需要Tracker管理员权限",
  "data": null
}
```

### 日期格式
- 日期格式：`YYYY-MM-DD`，例如：`2025-01-15`
- 时间格式：`YYYY-MM-DD HH:mm:ss`，例如：`2025-01-15 10:00:00`

### 分页说明
- `page`: 页码，从1开始
- `limit`: 每页数量，最大200
- `total`: 符合条件的总记录数

### 排序说明
- `orderBy`: 排序字段
  - 每日一题：默认按创建时间倒序
  - 对战题目：支持 `id`、`levelScore`、`matchCount`、`acCount`、`avgSeconds`
- `order`: 排序方向，`ASC`（升序）或 `DESC`（降序）

### 错误处理
所有接口统一返回格式：
```json
{
  "code": 错误码,
  "message": "错误信息",
  "data": null
}
```

常见错误：
- `参数非法：xxx` - 参数校验失败
- `题目不存在` - 题目ID不存在
- `记录不存在` - 记录ID不存在
- `该题目已存在于对战题库中` - 重复添加
- `难度等级分范围应在800-2500之间` - 参数范围错误

### 前端开发建议

1. **统一错误处理**
   ```javascript
   function handleResponse(response) {
     if (response.code === 0) {
       return response.data;
     } else {
       // 统一错误提示
       showError(response.message);
       throw new Error(response.message);
     }
   }
   ```

2. **权限检查**
   ```javascript
   // 在页面加载时检查权限
   async function checkAdminPermission() {
     const response = await fetch('/problem/tracker/admin/check');
     const data = await response.json();
     if (!data.data.isAdmin) {
       // 跳转到无权限页面
       redirectToNoPermission();
     }
   }
   ```

3. **日期格式化**
   ```javascript
   function formatDate(dateString) {
     // 将 "2025-01-15 10:00:00" 格式化为前端显示格式
     const date = new Date(dateString);
     return date.toLocaleString('zh-CN');
   }
   ```

4. **批量操作处理**
   ```javascript
   async function batchAdd(items) {
     const response = await fetch('/problem/tracker/battle/problem/admin/batch-add', {
       method: 'POST',
       body: new URLSearchParams({
         items: JSON.stringify(items)
       })
     });
     const result = await response.json();
     if (result.code === 0) {
       if (result.data.failCount > 0) {
         // 显示部分失败提示
         showWarning(`成功添加 ${result.data.successCount} 条，失败 ${result.data.failCount} 条`);
         // 显示失败详情
         result.data.failItems.forEach(item => {
           console.error(`题目 ${item.problemId} 添加失败: ${item.reason}`);
         });
       } else {
         showSuccess(`成功添加 ${result.data.successCount} 条`);
       }
     }
   }
   ```

5. **删除前确认**
   ```javascript
   async function deleteWithCheck(id) {
     // 先检查是否可以安全删除
     const checkResponse = await fetch(`/problem/tracker/battle/problem/admin/check-delete?id=${id}`);
     const checkResult = await checkResponse.json();
     
     if (checkResult.code === 0 && checkResult.data.canDelete) {
       const riskLevel = checkResult.data.riskLevel;
       const warnings = checkResult.data.warnings;
       
       // 根据风险等级显示不同的确认对话框
       if (riskLevel === 'high') {
         const confirmed = confirm(`高风险删除！\n${warnings.join('\n')}\n\n确定要删除吗？`);
         if (!confirmed) return;
       } else if (riskLevel === 'medium') {
         const confirmed = confirm(`中等风险删除：\n${warnings.join('\n')}\n\n确定要删除吗？`);
         if (!confirmed) return;
       } else {
         const confirmed = confirm('确定要删除这道题目吗？');
         if (!confirmed) return;
       }
       
       // 执行删除
       await deleteBattleProblem(id);
     }
   }
   ```

---

## 更新日志

### 2025-01-15
- 初始版本
- 添加每日一题管理系统API文档
- 添加对战系统题目后台管理系统API文档

