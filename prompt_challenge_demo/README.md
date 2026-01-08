# Prompt Challenge Demo（评分机制最小闭环）

这是一个独立于 `prompt_demo/app.py` 的小型 demo，用来验证“提示词挑战”题型的**评分机制**：

**最终得分 = 用例通过分（CaseScore） × 提示词质量系数（QualityCoeff）**

## 功能

- 后端（FastAPI）：
  - 列出挑战题：`GET /api/challenges`
  - 评测：`POST /api/evaluate`
    - CaseScore：按用例通过率计算
    - QualityCoeff：对 Prompt 做启发式质量打分，并给出可解释分项
    - 返回：最终分、分项、每用例输出与判定
- 前端（纯静态 HTML/JS）：
  - 选择挑战
  - 填写 Prompt 与模型配置
  - 一键评测并展示分数与明细

## 启动（示例）

你可以用任意方式启动 FastAPI（例如 uvicorn）。端口随意，示例：

```bash
uvicorn prompt_challenge_demo.app:app --reload --port 8010
```

然后访问：

- `http://localhost:8010/`

## 模型配置

该 demo 默认不内置 key。你可以：

- 在页面里填写 `base_url/api_key/model`；或
- 通过环境变量提供默认值：
  - `ONE_API_URL`
  - `ONE_API_KEY`
  - `LLM_MODEL`


