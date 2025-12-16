# 每日一题时间段查询 API 文档

## 接口概述

根据指定的时间段分页查询每日一题列表，支持按日期范围筛选。

---

## 接口信息

### 基本信息

- **接口路径**: `/problem/tracker/clock/question/list-by-date-range`
- **请求方法**: `GET`
- **接口描述**: 根据时间段分页查询每日一题列表
- **权限要求**: 需要 Tracker 管理员权限（需要登录）

---

## 请求参数

### Query 参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `startDate` | String | 是 | - | 开始日期，格式：`yyyy-MM-dd`（例如：`2025-01-01`） |
| `endDate` | String | 是 | - | 结束日期，格式：`yyyy-MM-dd`（例如：`2025-01-31`） |
| `page` | Integer | 否 | `1` | 页码，从 1 开始 |
| `limit` | Integer | 否 | `20` | 每页数量，最大值为 `200` |

### 参数说明

1. **日期格式**: 必须使用 `yyyy-MM-dd` 格式，例如：`2025-01-15`
2. **日期范围**: `startDate` 不能晚于 `endDate`
3. **分页参数**: 
   - `page` 最小值为 `1`，小于 1 会自动设置为 1
   - `limit` 最小值为 `1`，最大值为 `200`，超出范围会自动调整

---

## 请求示例

### cURL 示例

```bash
curl -X GET "https://d.nowcoder.com/problem/tracker/clock/question/list-by-date-range?startDate=2025-01-01&endDate=2025-01-31&page=1&limit=20" \
  -H "Cookie: session_id=your_session_id"
```

### JavaScript (Fetch) 示例

```javascript
const startDate = '2025-01-01';
const endDate = '2025-01-31';
const page = 1;
const limit = 20;

const url = `/problem/tracker/clock/question/list-by-date-range?startDate=${startDate}&endDate=${endDate}&page=${page}&limit=${limit}`;

fetch(url, {
  method: 'GET',
  credentials: 'include', // 包含 Cookie
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => {
    console.log('查询结果:', data);
  })
  .catch(error => {
    console.error('请求失败:', error);
  });
```

### JavaScript (Axios) 示例

```javascript
import axios from 'axios';

const params = {
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  page: 1,
  limit: 20
};

axios.get('/problem/tracker/clock/question/list-by-date-range', {
  params: params,
  withCredentials: true // 包含 Cookie
})
  .then(response => {
    console.log('查询结果:', response.data);
  })
  .catch(error => {
    console.error('请求失败:', error);
  });
```

---

## 响应格式

### 成功响应

**HTTP 状态码**: `200`

**响应体结构**:

```json
{
  "code": 0,
  "msg": "OK",
  "data": {
    "total": 31,
    "page": 1,
    "limit": 20,
    "startDate": "2025-01-01",
    "endDate": "2025-01-31",
    "list": [
      {
        "id": 123,
        "questionId": 594365,
        "problemId": 53380,
        "shareLink": "https://example.com/share/123",
        "createTime": "2025-01-31 10:00:00",
        "updateTime": "2025-01-31 10:00:00"
      },
      {
        "id": 122,
        "questionId": 594364,
        "problemId": 53379,
        "shareLink": "",
        "createTime": "2025-01-30 10:00:00",
        "updateTime": "2025-01-30 10:00:00"
      }
      // ... 更多数据
    ]
  }
}
```

### 响应字段说明

#### 顶层字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `code` | Integer | 响应码，`0` 表示成功，非 `0` 表示失败 |
| `msg` | String | 响应消息 |
| `data` | Object | 响应数据 |

#### data 对象字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `total` | Integer | 符合条件的总记录数 |
| `page` | Integer | 当前页码 |
| `limit` | Integer | 每页数量 |
| `startDate` | String | 查询的开始日期 |
| `endDate` | String | 查询的结束日期 |
| `list` | Array | 每日一题列表 |

#### list 数组中每个对象的字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | Long | 每日一题记录ID |
| `questionId` | Long | 题目ID |
| `problemId` | Long | 问题ID |
| `shareLink` | String | 分享链接（可能为空字符串） |
| `createTime` | String | 创建时间，格式：`yyyy-MM-dd HH:mm:ss` |
| `updateTime` | String | 更新时间，格式：`yyyy-MM-dd HH:mm:ss` |

---

## 错误响应

### 错误响应格式

```json
{
  "code": 1,
  "msg": "错误信息"
}
```

### 常见错误码

| HTTP 状态码 | code | msg | 说明 |
|------------|------|-----|------|
| 200 | 1 | `参数非法：startDate 和 endDate 不能为空` | startDate 或 endDate 参数缺失 |
| 200 | 1 | `参数非法：startDate 不能晚于 endDate` | 开始日期晚于结束日期 |
| 200 | 1 | `invalid date format, expect yyyy-MM-dd` | 日期格式不正确 |
| 200 | 999 | `请登录` | 未登录 |
| 200 | 1 | `无权限：需要Tracker管理员权限` | 无管理员权限 |

---

## 业务规则

1. **时间范围**: 查询范围包含 `startDate` 当天的 00:00:00，到 `endDate` 当天的 23:59:59
2. **排序规则**: 结果按创建时间倒序排列（最新的在前）
3. **分页**: 支持分页查询，每页最多返回 200 条记录
4. **权限**: 需要 Tracker 管理员权限才能访问

---

## 使用场景示例

### 场景1: 查询某个月的每日一题

```javascript
// 查询 2025年1月 的每日一题
const params = {
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  page: 1,
  limit: 50
};
```

### 场景2: 查询最近一周的每日一题

```javascript
// 获取最近7天的日期范围
const today = new Date();
const lastWeek = new Date(today);
lastWeek.setDate(today.getDate() - 7);

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const params = {
  startDate: formatDate(lastWeek),
  endDate: formatDate(today),
  page: 1,
  limit: 20
};
```

### 场景3: 分页查询大量数据

```javascript
// 查询所有数据，需要分页处理
async function getAllQuestionsByDateRange(startDate, endDate) {
  const allQuestions = [];
  let page = 1;
  const limit = 200; // 每页最大数量
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `/problem/tracker/clock/question/list-by-date-range?startDate=${startDate}&endDate=${endDate}&page=${page}&limit=${limit}`,
      { credentials: 'include' }
    );
    const result = await response.json();
    
    if (result.code === 0 && result.data) {
      allQuestions.push(...result.data.list);
      const total = result.data.total;
      const currentCount = page * limit;
      hasMore = currentCount < total;
      page++;
    } else {
      hasMore = false;
      console.error('查询失败:', result.msg);
    }
  }

  return allQuestions;
}
```

---

## 注意事项

1. **日期格式**: 必须严格按照 `yyyy-MM-dd` 格式，例如：`2025-01-15`，不能使用其他格式
2. **时区**: 日期使用服务器时区，建议前端统一使用服务器时区进行日期处理
3. **权限**: 接口需要 Tracker 管理员权限，普通用户无法访问
4. **性能**: 如果查询的时间范围很大，建议使用分页查询，避免一次性获取过多数据
5. **Cookie**: 请求需要携带登录 Cookie，确保已登录且具有管理员权限

---

## 更新日志

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2025-01-XX | 初始版本，支持时间段查询和分页 |

---

## 相关接口

- [查询每日一题列表（全部）](./test_clock_question_api_README.md#7-分页查询每日一题列表)
- [根据ID查询每日一题](./test_clock_question_api_README.md#6-查询每日一题按id)
- [新增每日一题](./test_clock_question_api_README.md#1-新增每日一题)

