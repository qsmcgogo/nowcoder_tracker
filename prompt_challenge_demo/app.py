from __future__ import annotations

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
DEMO_ROOT = Path(__file__).resolve().parent
CHALLENGES_DIR = DEMO_ROOT / "challenges"

# 可选：从本地文件读取 Dify 配置（仅用于本地开发；文件已在 .gitignore 中忽略）
def _load_local_config() -> None:
    cfg_path = DEMO_ROOT / "local_config.json"
    if not cfg_path.exists():
        return
    try:
        data = json.loads(cfg_path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return
        for k in ("DIFY_API_URL", "DIFY_API_KEY", "LLM_MODEL", "ONE_API_KEY"):
            v = data.get(k)
            if isinstance(v, str) and v.strip() and not os.getenv(k):
                os.environ[k] = v.strip()
    except Exception:
        return

_load_local_config()

# Dify Chat Messages API（默认 blocking）
# 参考：POST http://dify.nowcoder.com/v1/chat-messages
DEFAULT_API_URL = os.getenv("DIFY_API_URL", "https://dify.nowcoder.com/v1/chat-messages")
# 兼容旧环境变量名（可选）
DEFAULT_MODEL = os.getenv("LLM_MODEL", "")  # Dify 不需要 model；保留字段避免前端空值处理
# 不提供默认 key，避免泄露；如需本地默认请用环境变量
DEFAULT_API_KEY = os.getenv("DIFY_API_KEY", "") or os.getenv("ONE_API_KEY", "")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EvaluateRequest(BaseModel):
    challenge_id: str
    prompt: str
    mode: str | None = "normal"  # normal | hacker
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    max_cases: int | None = None
    debug: bool | None = False  # 返回更多调试信息（不包含 api_key）


class CodeGenerateRequest(BaseModel):
    problem_id: str
    language: str | None = "cpp"  # 暂定：C++17
    problem: dict | None = None  # {title, description, input_spec, output_spec, sample_input, sample_output}
    prompt: str
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    debug: bool | None = False


def _load_challenges() -> list[dict]:
    if not CHALLENGES_DIR.exists():
        return []
    out: list[dict] = []
    for fp in sorted(CHALLENGES_DIR.glob("*.json")):
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                data["_file"] = fp.name
                out.append(data)
        except Exception:
            continue
    return out


def _get_challenge(challenge_id: str) -> dict:
    for ch in _load_challenges():
        if ch.get("id") == challenge_id:
            return ch
    raise HTTPException(status_code=404, detail=f"challenge_id not found: {challenge_id}")


def _clean_json_codeblock(text: str) -> str:
    s = str(text or "")
    m = re.search(r"```json\s*(.*?)\s*```", s, re.I | re.S)
    return (m.group(1) if m else s).strip()


def _norm_sentiment(text: str) -> str:
    s = str(text or "").strip()
    if s.upper() in {"POS", "NEG", "NEU"} and re.fullmatch(r"(POS|NEG|NEU)", s, re.I):
        return s.upper()
    return ""


def _norm_extract_contact(text: str) -> str:
    """
    期望输出 JSON：{"name": "...", "phone": "...", "date": "YYYY-MM-DD"}
    phone 只保留数字；date 允许为空，非空需 YYYY-MM-DD
    """
    try:
        data = json.loads(_clean_json_codeblock(text))
        if not isinstance(data, dict):
            return ""
        name = str(data.get("name", "")).strip()
        phone = re.sub(r"\D+", "", str(data.get("phone", "")))
        date = str(data.get("date", "")).strip()
        if date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            return ""
        norm = {"name": name, "phone": phone, "date": date}
        return json.dumps(norm, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    except Exception:
        return ""


def _quality_breakdown(prompt: str, mode: str) -> dict:
    """
    质量系数：做“可解释的启发式”打分，用于 demo（非最终线上规则）。
    返回：
      - dims: 各维度 0~1
      - coeff: 质量系数（建议范围：normal 0.6~1.0；hacker 0.5~1.2）
      - reasons: 人类可读说明（用于 admin 面板展示）
    """
    p = str(prompt or "")
    p_strip = p.strip()
    p_lower = p_strip.lower()
    n_chars = len(p_strip)

    # 维度 1：输出约束（强相关，提升可复现）
    has_only_output = bool(re.search(r"(仅输出|只输出|不要输出|不得输出|输出必须|必须输出)", p_strip))
    mentions_json = ("json" in p_lower) or ("{" in p_strip and "}" in p_strip)
    out_format = 1.0 if (has_only_output and (mentions_json or "pos" in p_lower or "neg" in p_lower or "neu" in p_lower)) else (0.6 if has_only_output else (0.4 if mentions_json else 0.2))

    # 维度 2：约束/边界（禁止多余内容、处理缺失信息等）
    has_forbid = bool(re.search(r"(禁止|不得|不要|严禁|必须|务必|仅允许)", p_strip))
    has_edge = bool(re.search(r"(为空|缺失|无|边界|异常|极端|非法|格式错误)", p_strip))
    constraints = min(1.0, (0.6 if has_forbid else 0.2) + (0.4 if has_edge else 0.0))

    # 维度 3：结构化（分点/步骤/表格/伪代码）
    has_steps = bool(re.search(r"(步骤|step|分步|依次|然后|首先|其次|最后)", p_lower))
    has_bullets = bool(re.search(r"(^\s*[-*]\s+|\n\s*[-*]\s+)", p_strip, re.M))
    has_numbered = bool(re.search(r"(^\s*\d+[\.\)、]\s+|\n\s*\d+[\.\)、]\s+)", p_strip, re.M))
    structured = 1.0 if (has_steps and (has_bullets or has_numbered)) else (0.7 if (has_bullets or has_numbered) else (0.5 if has_steps else 0.2))

    # 维度 4：示例（例子越少越“黑客”，但对常规赛道更稳定）
    has_example = bool(re.search(r"(示例|例如|example|输入|输出)", p_lower))
    examples = 0.9 if has_example else 0.4

    # 维度 5：长度（mode 不同偏好不同）
    # - normal：过短容易不稳定；过长也会啰嗦。给一个“适中”的钟形奖励。
    # - hacker：鼓励更短（但不让它无限飙到 1.0，避免只比长度不比质量）
    if mode == "hacker":
        # 0~40 字符：高；>120 逐渐降
        length_score = 1.0 if n_chars <= 40 else (0.8 if n_chars <= 80 else (0.6 if n_chars <= 120 else 0.4))
    else:
        if n_chars <= 60:
            length_score = 0.6
        elif n_chars <= 180:
            length_score = 1.0
        elif n_chars <= 320:
            length_score = 0.8
        else:
            length_score = 0.6

    dims = {
        "output_format": round(float(out_format), 3),
        "constraints": round(float(constraints), 3),
        "structured": round(float(structured), 3),
        "examples": round(float(examples), 3),
        "length": round(float(length_score), 3),
        "chars": n_chars,
    }

    # 权重：输出约束与结构化更关键
    w = {"output_format": 0.30, "constraints": 0.22, "structured": 0.22, "examples": 0.16, "length": 0.10}
    base = (
        dims["output_format"] * w["output_format"]
        + dims["constraints"] * w["constraints"]
        + dims["structured"] * w["structured"]
        + dims["examples"] * w["examples"]
        + dims["length"] * w["length"]
    )

    if mode == "hacker":
        coeff = 0.5 + 0.7 * base  # 0.5~1.2
    else:
        coeff = 0.6 + 0.4 * base  # 0.6~1.0

    reasons: list[str] = []
    if dims["output_format"] < 0.5:
        reasons.append("建议增加“仅输出/只输出”与明确输出格式（JSON/标签），提高稳定性。")
    if dims["constraints"] < 0.5:
        reasons.append("建议补充约束/边界：缺失信息如何处理、禁止解释文字、格式错误如何输出等。")
    if dims["structured"] < 0.5:
        reasons.append("建议用分点/步骤/伪代码结构化表达，减少歧义。")
    if mode != "hacker" and dims["examples"] < 0.6:
        reasons.append("常规赛道建议给 1 个最小示例（输入/输出/格式），通常能显著提升通过率。")
    if mode == "hacker" and dims["length"] < 0.7:
        reasons.append("黑客赛道更偏好短 prompt（token 触发器）；可尝试压缩字数并保留关键约束。")
    if not reasons:
        reasons.append("提示词质量分项表现良好。")

    return {
        "mode": mode,
        "dims": dims,
        "base": round(float(base), 4),
        "coeff": round(float(coeff), 4),
        "reasons": reasons,
    }


def _extract_json_object(text: str) -> dict | None:
    """
    尝试从模型输出中提取 JSON object。
    - 支持 ```json ... ``` 代码块
    - 支持输出夹杂说明文字时，抓取第一个 {...}
    """
    s = str(text or "").strip()
    if not s:
        return None
    s = _clean_json_codeblock(s)
    # 直接解析
    try:
        data = json.loads(s)
        return data if isinstance(data, dict) else None
    except Exception:
        pass
    # 抓取第一个 JSON object
    m = re.search(r"\{[\s\S]*\}", s)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _build_quality_judge_query(prompt: str, mode: str) -> str:
    """
    让 Dify/LLM 对“提示词质量”打分并返回严格 JSON。
    说明：
    - 这不是判题用例执行，只评估 prompt 的表达质量与约束完整性
    - 输出必须是单一 JSON object，不要代码块、不要解释文本
    """
    # 目标系数范围（与当前 demo 逻辑保持一致，方便前端展示）
    if mode == "hacker":
        coeff_range = "0.500 ~ 1.200"
    else:
        coeff_range = "0.600 ~ 1.000"

    return (
        "你是一个“提示词工程挑战”的评测裁判。请根据用户的 Prompt 质量进行评分。\n"
        "评估目标：更稳定、更可复现、更少歧义、更强约束、更结构化。\n"
        "注意：你只评估 Prompt 本身，不要去完成题目。\n\n"
        f"赛道：{mode}\n"
        f"质量系数范围：{coeff_range}\n\n"
        "请仅输出一个 JSON object，字段要求：\n"
        "- coeff: number（质量系数，按赛道范围给值）\n"
        "- dims: object（每项为一个小数，保留3位小数，包含：output_format, constraints, structured, examples, length）\n"
        "- reasons: string[]（3~6 条中文建议，简短、可执行）\n"
        "- base: number（为一个小数，保留4位小数，可选；若给出则表示综合基础分）\n\n"
        "再次强调：只输出 JSON，不要任何额外字符。\n\n"
        "【Prompt】\n"
        f"{prompt.strip()}\n"
    )


def score_quality_via_dify(prompt: str, mode: str, api_key: str, base_url: str) -> tuple[dict, int]:
    """
    调 Dify 对 prompt 做质量评分，返回 (quality_dict, tokens)。
    若解析失败，将抛异常由上层兜底回退到启发式。
    """
    judge_query = _build_quality_judge_query(prompt, mode)
    # 复用 call_llm 的 Dify 调用，但这里传的 prompt 本身是 judge_query，user_input 为空
    answer, tokens = call_llm(prompt=judge_query, user_input="", model="", api_key=api_key, base_url=base_url)
    data = _extract_json_object(answer)
    if not data:
        raise ValueError("quality judge returned non-JSON")

    # 规范化字段
    coeff = data.get("coeff")
    dims = data.get("dims") if isinstance(data.get("dims"), dict) else {}
    reasons = data.get("reasons") if isinstance(data.get("reasons"), list) else []
    base = data.get("base")

    def _to01(x, default=0.0):
        try:
            v = float(x)
            if v != v:
                return default
            return max(0.0, min(1.0, v))
        except Exception:
            return default

    # coeff 合法性与范围 clamp
    try:
        c = float(coeff)
    except Exception:
        raise ValueError("missing coeff")
    if mode == "hacker":
        c = max(0.5, min(1.2, c))
    else:
        c = max(0.6, min(1.0, c))

    norm_dims = {
        "output_format": round(_to01(dims.get("output_format"), 0.0), 3),
        "constraints": round(_to01(dims.get("constraints"), 0.0), 3),
        "structured": round(_to01(dims.get("structured"), 0.0), 3),
        "examples": round(_to01(dims.get("examples"), 0.0), 3),
        "length": round(_to01(dims.get("length"), 0.0), 3),
        "chars": len(str(prompt or "").strip()),
    }
    norm_reasons = [str(x).strip() for x in reasons if str(x).strip()][:8]
    if not norm_reasons:
        norm_reasons = ["（AI 评测未给出建议）"]

    out = {
        "mode": mode,
        "dims": norm_dims,
        "base": round(_to01(base, 0.0), 4),
        "coeff": round(float(c), 4),
        "reasons": norm_reasons,
        "judge": "dify",
    }
    return out, tokens


def _build_copycheck_query(
    *,
    challenge_id: str,
    challenge_name: str,
    challenge_desc: str,
    sample_input: str,
    sample_output: str,
    user_prompt: str,
) -> str:
    """
    让模型判断用户是否“复制题面/样例”来投机：
    - 这里的“题面”指平台展示给用户的题目说明/约束/样例（而不是用例全集）
    - 输出严格 JSON，不要解释文本
    """
    return (
        "你是一个提示词挑战平台的反作弊裁判。\n"
        "请判断用户提交的 Prompt 是否存在“复制题面/样例/固定模板”来投机的行为。\n"
        "注意：允许用户复述“输出格式/输出标签含义/仅输出约束/边界条件”等关键约束，这是正常的 Prompt 设计。\n"
        "这里的“复制投机”更严格地定义为：\n"
        "1）Prompt 里直接包含或近似复述【样例输入/样例输出】的内容（尤其是把样例原文搬进去）；或\n"
        "2）Prompt 大段照搬题目说明/提示（例如连续多句几乎相同、包含明显的题面段落结构）；且\n"
        "3）整体看不到用户自己的建模/约束设计（只是把题面原话换一种说法）。\n"
        "如果只是复述“POS/NEG/NEU”含义、或强调“仅输出三字母”，通常不应判为复制。\n\n"
        "关键要求（避免误伤）：\n"
        "- 只有当你能在【用户 Prompt】中找到与【题目说明】或【样例输入/输出】“明显的原文重合片段”时，才允许判 is_copy=true。\n"
        "- 所谓“明显原文重合”：至少包含一个连续片段，长度>=12（中文按字符数），并且该片段在题面/样例中也出现。\n"
        "- 如果用户只是用了“样例输入/样例输出”这种结构，但样例内容是用户自造且与平台样例原文不同，应判 is_copy=false。\n\n"
        "请仅输出一个 JSON object，字段要求：\n"
        "- is_copy: boolean（是否疑似复制题面/样例）\n"
        "- confidence: number（0~1，保留小数点后 3 位）\n"
        "- overlap_spans: string[]（0~3 个证据片段，必须是你在 Prompt 中发现的“原文重合”连续片段；若 is_copy=false 可为空数组）\n"
        "- reasons: string[]（2~5 条中文原因，指出可疑点即可；若判不复制，可简要说明“允许复述约束/自造样例”）\n\n"
        "只输出 JSON，不要任何额外字符。\n\n"
        f"【challenge_id】{challenge_id}\n"
        f"【challenge_name】{challenge_name}\n"
        f"【题目说明】\n{(challenge_desc or '').strip()}\n\n"
        f"【样例输入】\n{(sample_input or '').strip()}\n\n"
        f"【样例输出】\n{(sample_output or '').strip()}\n\n"
        f"【用户 Prompt】\n{(user_prompt or '').strip()}\n"
    )


def copy_check_via_dify(
    *,
    challenge_id: str,
    challenge_name: str,
    challenge_desc: str,
    sample_input: str,
    sample_output: str,
    user_prompt: str,
    api_key: str,
    base_url: str,
) -> tuple[dict, int, str]:
    """
    调 Dify 做“复制题面/样例”判定。
    返回：(copy_check_dict, tokens, judge_query)
    """
    judge_query = _build_copycheck_query(
        challenge_id=challenge_id,
        challenge_name=challenge_name,
        challenge_desc=challenge_desc,
        sample_input=sample_input,
        sample_output=sample_output,
        user_prompt=user_prompt,
    )
    answer, tokens = call_llm(prompt=judge_query, user_input="", model="", api_key=api_key, base_url=base_url)
    data = _extract_json_object(answer) or {}

    is_copy = bool(data.get("is_copy"))
    try:
        conf = float(data.get("confidence", 0.0))
    except Exception:
        conf = 0.0
    conf = max(0.0, min(1.0, conf))
    overlap_spans = data.get("overlap_spans") if isinstance(data.get("overlap_spans"), list) else []
    overlap_spans = [str(x).strip() for x in overlap_spans if str(x).strip()][:3]
    reasons = data.get("reasons") if isinstance(data.get("reasons"), list) else []
    reasons = [str(x).strip() for x in reasons if str(x).strip()][:8]
    if not reasons:
        reasons = ["（AI 未给出具体原因）"]

    # 防误伤兜底：如果判复制但没有给证据片段，则认为不成立（或强制降置信度）
    if is_copy and not overlap_spans:
        is_copy = False
        conf = min(conf, 0.3)
        reasons = ["未提供与题面/样例的原文重合证据，按不复制处理（防误伤兜底）。"]

    out = {
        "judge": "dify",
        "is_copy": is_copy,
        "confidence": round(conf, 3),
        "overlap_spans": overlap_spans,
        "reasons": reasons,
    }
    return out, int(tokens or 0), judge_query

def call_llm(prompt: str, user_input: str, model: str, api_key: str, base_url: str) -> tuple[str, int]:
    """
    Dify agent/app 调用：POST /v1/chat-messages
    - 这里使用 blocking 模式，直接拿最终 answer
    - model 参数在 Dify 中通常不需要；保留签名以兼容前端
    返回：(content, tokens) —— tokens 若无法获取则为 0
    """
    url = (base_url or DEFAULT_API_URL).strip()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # 将“用户提交的 prompt”与“用例输入”合并为一次 query，便于按题跑评测
    query = f"{prompt}\n\n【输入】\n{user_input}".strip()
    data = {
        "inputs": {},
        "query": query,
        "response_mode": "blocking",
        "conversation_id": "",
        # user 需要稳定唯一标识；demo 用固定值即可
        "user": "tracker-admin",
        # files：目前 demo 不传
        "files": [],
    }

    try:
        resp = requests.post(url, headers=headers, json=data, timeout=120)
        if resp.status_code != 200:
            # 尽量返回可读错误
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        js = resp.json()

        # Dify blocking 通常返回 answer；做一层兜底兼容
        content = ""
        if isinstance(js, dict):
            content = str(js.get("answer") or js.get("message") or "").strip()
            if not content:
                # 有些实现会把数据放在 data 字段里
                data2 = js.get("data")
                if isinstance(data2, dict):
                    content = str(data2.get("answer") or data2.get("message") or "").strip()

        tokens = 0
        try:
            meta = js.get("metadata") if isinstance(js, dict) else None
            usage = (meta.get("usage") if isinstance(meta, dict) else None) or {}
            # 兼容常见字段名（如果上游返回）
            tokens = int(
                usage.get("total_tokens")
                or usage.get("totalTokens")
                or usage.get("total")
                or 0
            )
        except Exception:
            tokens = 0

        if not content:
            content = json.dumps(js, ensure_ascii=False)
        return content.strip(), tokens
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _build_sent_query(prompt: str, user_input: str) -> str:
    return f"{prompt}\n\n【输入】\n{user_input}".strip()


def _extract_code_from_answer(text: str) -> str:
    """
    从模型输出中提取代码：
    1) JSON: {"code":"..."} 或 {"data":{"code":"..."}}
    2) ```python ... ``` / ```...``` 代码块
    3) 兜底：原文
    """
    s = str(text or "").strip()
    if not s:
        return ""
    # JSON
    try:
        data = _extract_json_object(s)
        if isinstance(data, dict):
            if isinstance(data.get("code"), str) and data["code"].strip():
                return data["code"].strip()
            d2 = data.get("data")
            if isinstance(d2, dict) and isinstance(d2.get("code"), str) and d2["code"].strip():
                return d2["code"].strip()
    except Exception:
        pass
    # fenced code block
    m = re.search(r"```(?:cpp|c\\+\\+|cc|cxx|c\\+\\+17|c\\+\\+20|python|py)?\s*([\s\S]*?)\s*```", s, re.I)
    if m:
        return m.group(1).strip()
    # any code block
    m2 = re.search(r"```\s*([\s\S]*?)\s*```", s, re.S)
    if m2:
        return m2.group(1).strip()
    return s


def _build_codegen_query(problem: dict, user_prompt: str, language: str) -> str:
    """
    生成代码的提示词：
    - 强制输出“纯代码”（不允许解释/markdown）
    - 约定 stdin/stdout
    """
    title = str(problem.get("title") or "")
    desc = str(problem.get("description") or "")
    in_spec = str(problem.get("input_spec") or "")
    out_spec = str(problem.get("output_spec") or "")
    sample_in = str(problem.get("sample_input") or "")
    sample_out = str(problem.get("sample_output") or "")
    lang_show = "C++17" if language in ("cpp", "c++", "cxx", "cc") else language
    return (
        "你是一个严谨的竞赛编程助手。请根据题目要求生成可直接运行的代码。\n"
        f"语言：{lang_show}\n"
        "必须满足：\n"
        "1) 只输出代码本身（不要任何解释、不要 markdown 代码块、不要多余空行前后的文字）。\n"
        "2) 从 stdin 读取输入，向 stdout 输出结果。\n"
        "3) 通过样例与隐藏用例。\n"
        "4) 使用 C++17 标准；推荐使用 <bits/stdc++.h>。\n\n"
        "【题目】\n"
        f"{title}\n\n"
        "【描述】\n"
        f"{desc}\n\n"
        "【输入描述】\n"
        f"{in_spec}\n\n"
        "【输出描述】\n"
        f"{out_spec}\n\n"
        "【样例输入】\n"
        f"{sample_in}\n\n"
        "【样例输出】\n"
        f"{sample_out}\n\n"
        "【用户 Prompt】\n"
        f"{str(user_prompt or '').strip()}\n"
    )


@app.post("/api/prompt-code/generate")
def prompt_code_generate(req: CodeGenerateRequest):
    """
    AI 编程题：根据用户 Prompt 生成代码（只读展示）
    返回：{code, language, tokens, meta}
    """
    language = (req.language or "cpp").strip().lower()
    if language in ("c++", "cxx", "cc", "cpp17", "c++17", "c++20"):
        language = "cpp"
    if language not in ("cpp",):
        language = "cpp"

    api_key = (req.api_key or DEFAULT_API_KEY or "").strip()
    base_url = (req.base_url or DEFAULT_API_URL or "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key is required (set DIFY_API_KEY env or pass in request)")
    if not req.prompt or not str(req.prompt).strip():
        raise HTTPException(status_code=400, detail="prompt is required")

    prob = req.problem or {}
    query = _build_codegen_query(prob, req.prompt, language)
    ans, tokens = call_llm(prompt=query, user_input="", model=req.model or "", api_key=api_key, base_url=base_url)
    code = _extract_code_from_answer(ans)

    if not code:
        raise HTTPException(status_code=500, detail="no code generated")

    meta = {
        "problem_id": req.problem_id,
        "language": language,
        "tokens": tokens,
    }
    if req.debug:
        meta["sent_query"] = query
        meta["raw_answer"] = ans
        meta["base_url"] = base_url

    return {
        "problem_id": req.problem_id,
        "language": "cpp",
        "code": code,
        "tokens": tokens,
        "meta": meta,
    }

@app.get("/api/prompt-challenge/challenges")
def list_challenges():
    items = []
    for ch in _load_challenges():
        cases = ch.get("cases") if isinstance(ch.get("cases"), list) else []
        sample_input = ""
        sample_output = ""
        try:
            if cases and isinstance(cases[0], dict):
                sample_input = str(cases[0].get("input", "") or "")
                sample_output = str(cases[0].get("expected", "") or "")
        except Exception:
            sample_input = ""
            sample_output = ""
        items.append(
            {
                "id": ch.get("id"),
                "name": ch.get("name"),
                "description": ch.get("description", ""),
                "type": ch.get("type"),
                "case_count": len(cases),
                "sample_input": sample_input,
                "sample_output": sample_output,
            }
        )
    return {"challenges": items}


@app.post("/api/prompt-challenge/evaluate")
def evaluate(req: EvaluateRequest):
    ch = _get_challenge(req.challenge_id)
    cases = ch.get("cases") if isinstance(ch.get("cases"), list) else []
    if not cases:
        raise HTTPException(status_code=400, detail="challenge has no cases")

    if req.max_cases:
        cases = cases[: max(1, int(req.max_cases))]

    mode = (req.mode or "normal").strip().lower()
    if mode not in ("normal", "hacker"):
        mode = "normal"

    model = req.model or DEFAULT_MODEL
    api_key = (req.api_key or DEFAULT_API_KEY or "").strip()
    base_url = req.base_url or DEFAULT_API_URL

    if not api_key:
        raise HTTPException(status_code=400, detail="api_key is required (set ONE_API_KEY env or pass in request)")
    if not req.prompt or not str(req.prompt).strip():
        raise HTTPException(status_code=400, detail="prompt is required")

    # 反作弊：复制题面/样例检测（AI 判定）
    sample_input = ""
    sample_output = ""
    try:
        if cases and isinstance(cases[0], dict):
            sample_input = str(cases[0].get("input", "") or "")
            sample_output = str(cases[0].get("expected", "") or "")
    except Exception:
        sample_input = ""
        sample_output = ""

    copy_tokens = 0
    copy_query = None
    try:
        copy_check, copy_tokens, copy_query = copy_check_via_dify(
            challenge_id=str(ch.get("id") or req.challenge_id),
            challenge_name=str(ch.get("name") or ""),
            challenge_desc=str(ch.get("description") or ""),
            sample_input=sample_input,
            sample_output=sample_output,
            user_prompt=req.prompt,
            api_key=api_key,
            base_url=base_url,
        )
    except Exception:
        # 失败时不拦截，只给默认“未判定”
        copy_check = {"judge": "dify", "is_copy": False, "confidence": 0.0, "reasons": ["（复制检测失败，已跳过）"]}
        copy_tokens = 0
        copy_query = None

    # quality：优先使用 Dify/LLM 评测；失败则回退到启发式（保证 demo 可用性）
    quality_tokens = 0
    quality_debug_query = None
    try:
        quality, quality_tokens = score_quality_via_dify(req.prompt, mode, api_key=api_key, base_url=base_url)
        if req.debug:
            quality_debug_query = _build_quality_judge_query(req.prompt, mode)
    except Exception:
        quality = _quality_breakdown(req.prompt, mode)

    # 按挑战类型选择归一化函数
    ch_type = str(ch.get("type") or "").strip()
    if ch_type == "sentiment":
        norm_fn = _norm_sentiment
    elif ch_type == "extract_contact":
        norm_fn = _norm_extract_contact
    else:
        # 默认：严格去首尾空白
        norm_fn = lambda s: str(s or "").strip()

    def eval_one(idx: int, case_obj: dict):
        inp = str(case_obj.get("input", ""))
        expected_raw = str(case_obj.get("expected", "")).strip()
        expected = norm_fn(expected_raw) or expected_raw

        sent_query = _build_sent_query(req.prompt, inp)
        out_text, used_tokens = call_llm(
            prompt=req.prompt,
            user_input=inp,
            model=model,
            api_key=api_key,
            base_url=base_url,
        )
        pred = norm_fn(out_text)
        ok = (pred == expected)
        detail = {
            "case": str(case_obj.get("id") or str(idx + 1)),
            "input": inp,
            "expected": expected,
            "raw_output": out_text,
            "prediction": pred,
            "pass": ok,
            "tokens": used_tokens,
        }
        if req.debug:
            detail["sent_query"] = sent_query
            detail["dify_url"] = base_url
        return {
            "idx": idx,
            "tokens": used_tokens,
            "detail": detail,
            "passed_inc": 1 if ok else 0,
        }

    results_buffer = [None] * len(cases)
    total_tokens = 0
    passed = 0

    max_workers = min(8, len(cases))
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futs = {ex.submit(eval_one, i, c): i for i, c in enumerate(cases)}
        for fut in as_completed(futs):
            res = fut.result()
            total_tokens += int(res.get("tokens", 0))
            passed += int(res.get("passed_inc", 0))
            results_buffer[res["idx"]] = res["detail"]

    details = [r for r in results_buffer if r is not None]
    case_score = (passed / len(cases)) if cases else 0.0  # 0~1
    quality_coeff = float(quality.get("coeff", 1.0))
    # 复制题面：按置信度降分（更宽容：只有高置信度才扣分）
    # 设计：
    # - 若 is_copy=false 或 confidence < THRESHOLD：不扣分（penalty=1）
    # - 若 is_copy=true 且 confidence >= THRESHOLD：
    #     x = (confidence-THRESHOLD)/(1-THRESHOLD) 归一化到 0..1
    #     penalty = clamp(1 - K*x, MIN..1)
    COPY_PENALTY_THRESHOLD = 0.75
    COPY_PENALTY_K = 0.7
    COPY_PENALTY_MIN_FACTOR = 0.2
    is_copy = bool(copy_check.get("is_copy")) is True
    try:
        copy_conf = float(copy_check.get("confidence", 0.0))
    except Exception:
        copy_conf = 0.0
    copy_conf = max(0.0, min(1.0, copy_conf))
    copy_penalty = 1.0
    if is_copy and copy_conf >= COPY_PENALTY_THRESHOLD:
        x = (copy_conf - COPY_PENALTY_THRESHOLD) / max(1e-9, (1.0 - COPY_PENALTY_THRESHOLD))
        x = max(0.0, min(1.0, x))
        copy_penalty = max(COPY_PENALTY_MIN_FACTOR, min(1.0, 1.0 - COPY_PENALTY_K * x))

    base_final = case_score * quality_coeff  # 0~1.2（hacker 上限 1.2）
    final_score = base_final * copy_penalty

    return {
        "challenge_id": req.challenge_id,
        "challenge_name": ch.get("name"),
        "mode": mode,
        "total": len(cases),
        "passed": passed,
        "case_score": round(case_score, 4),
        "copy_check": copy_check,
        "copy_penalty": round(float(copy_penalty), 4),
        "final_score_before_copy": round(float(base_final), 4),
        "quality": quality,
        "quality_coeff": round(quality_coeff, 4),
        "final_score": round(final_score, 4),
        # tokens：包含用例调用 token + 质量评测 token（如可获取）
        "tokens": total_tokens + int(quality_tokens or 0) + int(copy_tokens or 0),
        "tokens_breakdown": {
            "cases": total_tokens,
            "quality": int(quality_tokens or 0),
            "copy_check": int(copy_tokens or 0),
        },
        "debug": bool(req.debug),
        "request": {
            "challenge_id": req.challenge_id,
            "mode": mode,
            "model": model,
            "base_url": base_url,
            "max_cases": req.max_cases,
            "prompt": req.prompt,
        }
        if req.debug
        else None,
        "quality_judge_query": quality_debug_query if req.debug else None,
        "copy_check_query": copy_query if req.debug else None,
        "details": details,
    }


