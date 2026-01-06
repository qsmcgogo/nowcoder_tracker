## 课程页“正常题目全AC=比赛AK(变绿)”回归检查

### 背景
- **课程页**的数据加载完成后会自动触发用户状态查询（`ContestView.handleCourseUserStatusSearch`）。
- **期望行为**：同一个 `contestId` 下，“正常题目”（口径：`problemId` 为正整数）全部 AC 时，课程页左侧比赛名（`.course-contest-cell`）应加上 `status-all-ac`，显示为绿色。

### 手工回归步骤（推荐）
1. 打开页面，切到“课程”视图（`#course-view`）。
2. 输入一个你确认在某个课程比赛里已全 AC 的用户ID，触发查询（或等待页面自动触发）。
3. 检查该比赛所在行的比赛名 `<td class="course-contest-cell" ...>`：
   - 应带有 `status-all-ac` class
   - 比赛名链接颜色应变绿（样式在 `styles.css`：`#course-view td.course-contest-cell.status-all-ac a`）
4. 检查未全 AC 的比赛：比赛名不应带 `status-all-ac`。

### 边界用例（用来验证“正常题目”口径）
- **存在异常/非正常题目**：某些题目 `problemId` 缺失/为 0/非数字。
  - 这些题目不应影响“比赛AK/变绿”判定（即只统计有效 `problemId`）。
  - 页面上这些单元格不会挂 `data-problem-id`，也不会参与 `/diff` 查询与“全AC”统计。

### 相关代码点
- `js/views/ContestView.js`
  - 渲染课程题目：无效 `problemId` 不写 `data-problem-id`
  - `applyCourseProblemHighlighting`：按 `data-contest-id` 汇总有效 `problemId` 做全AC统计，并给 `.course-contest-cell` 加 `status-all-ac`
- `js/utils/helpers.js`
  - `isValidProblemId`：判断“正常题目”口径





