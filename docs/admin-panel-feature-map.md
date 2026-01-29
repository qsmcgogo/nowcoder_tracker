## Admin 面板重排版：现状功能清单 & 新分组对照

本文档用于在重做 Admin 面板信息架构（顶部“业务域”分组 + 左侧子栏目）前，**完整枚举现有功能**，并给出到新分组的对应关系，避免重排版时遗漏。

> 现状实现文件：`js/views/AdminView.js`
>  
> 新增直播课导入接口封装：`js/services/ApiService.js#adminLivecourseImportOneEmptyCourse`

---

## 1）现状：顶层 Tab（旧结构）

当前 Admin 顶层为 9 个 Tab（按钮文本里普遍带“管理/验数/配置”等字样）：

- **每日一题管理**（`clock`）
- **对战题目管理**（`battle`，内部还有二级 Tab）
- **知识点管理**（`tag`）
- **批量导入题库**（`import`，已成为“杂物箱”）
- **年度报告验数**（`yearReport`，内部混入了对战运维 + 活动工具）
- **比赛难度更新**（`contestDifficulty`）
- **Prompt 挑战评测**（`promptChallenge`）
- **QMS 录题测试**（`qmsDraft`，内部功能非常多；后续顶层名称拟调整为“录题”，内部维持现状）
- **Dify 配置**（`dify`）

---

## 2）现状：功能清单（逐一枚举）

下面按“旧 Tab → 功能点”列出，每条都给出：**入口/按钮**、**功能描述**、**调用接口（若可确定）**。

### A. 每日一题（旧 Tab：`每日一题管理`）

- **列表/分页**：加载列表（默认按页），支持日期范围过滤
  - 接口：`GET /problem/tracker/clock/list`（分页）与 `GET /problem/tracker/clock/list-by-date-range`（日期范围，具体以 ApiService 实现为准）
- **新增/编辑**：弹窗编辑每日题（日期、questionId、problemId…）
  - 接口：`POST /problem/tracker/clock/add`、`POST /problem/tracker/clock/update`
- **删除**：按 id 删除
  - 接口：`POST /problem/tracker/clock/question/delete-by-id`（或同类 delete 接口，见 ApiService）
- **快速定位**：按 `questionId` / `problemId` 查询并定位
  - 接口：`GET /problem/tracker/clock/question/find`（见 `adminClockQuestionFind`）
- **（相关入口但不在 Admin 内）**：`/problem/tracker/clock/daylink`、`/problem/tracker/clock/add-share-link` 等属于“每日一题内容运营”，但当前不在 Admin 的主入口里集中呈现（仅部分在其他页/工具里出现）。

### B. 对战（旧 Tab：`对战题目管理`）

顶层有二级 Tab（按钮样式类似胶囊）：

1. **管理题目**（`battleSubTab=manage`）
   - **新增/编辑**：单题添加/更新（problemId + levelScore）
     - 接口：`POST /problem/tracker/battle/problem/admin/add`、`POST /problem/tracker/battle/problem/admin/update`
   - **列表/分页/筛选**：按难度范围、排序字段过滤；支持按 problemId 查询
     - 接口：`GET /problem/tracker/battle/problem/admin/list`（或同类 list/get-by-problem-id）
   - **删除**：单条删除（含删除前 check）
     - 接口：`GET /problem/tracker/battle/problem/admin/check-delete`、`POST /problem/tracker/battle/problem/admin/delete`
   - **批量添加/批量删除**
     - 接口：`POST /problem/tracker/battle/problem/admin/batch-add`、`POST /problem/tracker/battle/problem/admin/batch-delete`

2. **查看数量（难度分布直方图）**（`battleSubTab=histogram`）
   - **刷新直方图**：50 桶（bucketSize=100，1~5000）
     - 接口：`GET /problem/tracker/battle/problem-difficulty-histogram`

> 备注：对战域里还有“清理用户镜像（Redis 运维）”，但当前放在“年度报告验数”Tab 内（见 D.2）。

### C. 题库/标签（旧 Tab：`知识点管理`）

- **知识点列表/分页/搜索**：按 `tag_name/tag_desc` 关键词
  - 接口：`GET /problem/tracker/tag/admin/list`（见 `trackerTagAdminList`）
- **新增/编辑知识点**（单条）
  - 接口：`POST /problem/tracker/tag/admin/create`、`POST /problem/tracker/tag/admin/update`
- **删除知识点**
  - 接口：`POST /problem/tracker/tag/admin/delete`（支持 dryRun/强制）
- **批量新增知识点**：支持“预览解析→提交”
  - 接口：多次调用 `trackerTagAdminCreate` / `trackerTagAdminUpdate`

### D. 数据（旧 Tab：`年度报告验数`）

> 当前这个 Tab 混入了“对战运维”和“活动工具”，属于信息架构最混乱的位置之一。

1. **年度报告验数：查看某用户年度报告（不走缓存）**
   - 输入：uid/year/trackerOnly
   - 接口：`GET /problem/tracker/admin/year-report`

2. **对战运维：清理某用户的所有镜像（Redis only）**
   - 输入：userId
   - 接口：`POST /problem/tracker/battle/clear-user-mirrors?userId=xxx`

3. **活动临时工具：增加“2026 春季 AI 体验站”抽奖次数**
   - 输入：uid/delta/uuid
   - 接口：`POST /problem/tracker/admin/spring2026-ai/chances/add`

### E. 竞赛（旧 Tab：`比赛难度更新`）

- **比赛题目难度一键更新**：预览（dryRun）/写库
  - 输入：contestId、acRateMax
  - 接口：`POST /problem/tracker/admin/acm-contest/rebuild-problem-difficulty`

### F. 题库导入 & 数据回填（旧 Tab：`批量导入题库`）

> 这个 Tab 目前承担了多个业务域：数据回填 / 题库导入 / 课程导入。

1. **acm_problem_open：重算通过人数 accept_person（全站口径）**
   - 支持 offset/limit/pageSize/batchSize/sleepMs/dryRun
   - 支持“自动跑完（分段请求）/停止”
   - 接口：`POST /problem/tracker/admin/acm-problem-open/rebuild-accept-person`

2. **直播课：一键导入空课程（章/节）**
   - 输入：courseId + json（字符串参数） + dryRun
   - 支持：粘贴 JSON 或粘贴文本→解析生成 JSON→提交
   - 接口：`POST /problem/tracker/admin/livecourse/import-one-empty-course`

3. **批量将 Tracker 题目导入到 acm_problem_open**
   - 输入：problemIds（多行）、trackerSourceTagId、batchSize、dryRun
   - 支持：解析预览、自动分段提交（避免 body 过大）
   - 接口：`POST /problem/tracker/acm-problem-open/batch-import-tracker`（兼容旧路径 `/acm-problem-open/batch-import-tracker` 在文案里出现）

### G. AI（旧 Tab：`Prompt 挑战评测`）

- **Prompt Challenge 评测（Demo）**
  - 刷新题单、选择 challenge、编辑 prompt、开始评测、展示用例明细
  - 接口（前端路径）：`/problem/tracker/api/prompt-challenge/...`（具体见 ApiService：`promptChallengeList`、`promptChallengeEvaluate`）

### H. AI/工具链（旧 Tab：`QMS 录题测试`）

这个 Tab 是“多工具聚合”，入口很多，关键点如下：

- **QMS Draft Add / Update（模拟录题）**
  - 打开 questionbank（本地走 `/__qb/`）
  - 导入录题 JSON（选择 JSON/清空）
  - 选择 `source.zip`、选择 `cases.zip`
  - 填写并保存 “QMS Request Headers”（支持 JSON/Raw）
  - 手动：发送 draft/add、draft/update
  - 一键链路：`一键录题`（通常会串联 draft/add → draft/update → 用例上传 → 审题 → 设置开放范围）
  - 涉及接口（通过 ApiService）：`adminQmsDraftAdd`、`adminQmsDraftUpdate`

- **用例上传链路（cases.zip）**
  - 获取 credential → async upload → 轮询 status → 回填 draft/update
  - 涉及接口（通过 ApiService）：`adminQmsTestcaseCredential`、`adminQmsTestcaseUploadAsync`、`adminQmsTestcaseUploadStatus`、`adminQmsDraftUpdate`

- **题目保存/审题/开放范围**
  - question upsert（保存题目主体）
  - review next-question / confirm（审题）
  - open-library/save（设置开放范围）
  - 涉及接口（通过 ApiService）：`adminQmsQuestionUpsert`、`adminQmsReviewNextQuestion`、`adminQmsReviewConfirm`、`adminQmsQuestionOpenLibrarySave`

> 备注：QMS 相关工具与 Tracker 其它业务域几乎无关，适合在新结构里单独归为“工具链”或“AI/内容生产”。

### I. AI（旧 Tab：`Dify 配置`）

- **Dify 助手配置**
  - 配置 Chatbot URL
  - 是否启用 AI 助手页签（影响主导航显示）
  - 本地保存（localStorage）+ 尝试调用 `window.app.updateDifyTabVisibility()`

---

## 3）新结构（目标 IA）：业务域顶层 + 左侧子栏目（建议草案）

你提到的目标结构：
- **顶部按业务域分组**：课程 / 题库 / 对战 / 竞赛 / 数据 / AI / 活动（顶层按钮去掉“管理”二字）
- **内容区域左侧再做子栏目**（类似现在“对战页签”的二级 Tab，但更体系化）

下面是将“现状功能”迁移到“新结构”的**建议对照**（仅做信息架构映射，不涉及功能实现更改）。

### 顶部：课程
- **左侧栏目**
  - 每日一题
  - 直播课导入（空课程一键导入）

### 顶部：题库
- **左侧栏目**
  - 知识点（tracker_tag）
  - acm_problem_open：accept_person 回填（全站口径回填/验数）
  - Tracker→acm_problem_open 导入

### 顶部：对战
- **左侧栏目**
  - 题目池（CRUD/批量）
  - 难度分布
  - 运维：清理镜像（从“数据”里迁出）

### 顶部：竞赛
- **左侧栏目**
  - 难度更新（acm-contest difficulty rebuild）

### 顶部：数据
- **左侧栏目**
  - 年度报告验数
  - （预留）其它验数/统计工具

### 顶部：AI
- **左侧栏目**
  - Prompt Challenge（评测 Demo）
  - Dify 配置（也可放“设置”域；看你希望归属）
  - 录题（维持现状：原 `QMS 录题测试` Tab 的全部功能）

### 顶部：活动
- **左侧栏目**
  - 2026 春季 AI 体验站：抽奖次数工具（以及未来其它活动工具都放这里）

---

## 4）重排版前的注意点（避免遗漏）

- **录题（QMS）是最大风险点**：入口多且流程复杂。按你的要求“内部维持现状”，重排版时建议先只改外层导航/布局，不动内部 DOM 结构与事件绑定，避免漏功能。
- **旧 Tab 文案中出现的路径可能与实际调用不一致**：例如导入题库文案写 `/acm-problem-open/...`，实际调用用的是 `/problem/tracker/acm-problem-open/...`；重排版时建议统一文案到“实际调用路径”。

