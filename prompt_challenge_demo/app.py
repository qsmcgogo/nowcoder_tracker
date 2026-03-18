from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
DEMO_ROOT = Path(__file__).resolve().parent
CHALLENGES_DIR = DEMO_ROOT / "challenges"
AI_PUZZLES_DIR = DEMO_ROOT / "puzzles"
AI_PUZZLE_DATA_DIR = DEMO_ROOT / "data"
AI_PUZZLE_STORE_PATH = AI_PUZZLE_DATA_DIR / "ai_puzzle_store.json"
AI_PUZZLE_STORE_LOCK = threading.Lock()

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


class AiPuzzleSubmitRequest(BaseModel):
    puzzle_id: str
    user_prompt: str
    user_id: str | None = None
    visibility: str | None = "public"  # public | private | ac_only
    anonymous: bool | None = False
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    debug: bool | None = False


def _ensure_ai_puzzle_store() -> None:
    AI_PUZZLE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    if AI_PUZZLE_STORE_PATH.exists():
        return
    empty = {
        "submissions": [],
        "submission_runs": [],
        "user_best": [],
        "leaderboard_snapshots": [],
        "submission_visibility": [],
    }
    AI_PUZZLE_STORE_PATH.write_text(json.dumps(empty, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_ai_puzzle_store() -> dict:
    _ensure_ai_puzzle_store()
    try:
        data = json.loads(AI_PUZZLE_STORE_PATH.read_text(encoding="utf-8"))
    except Exception:
        data = {}
    if not isinstance(data, dict):
        data = {}
    data.setdefault("submissions", [])
    data.setdefault("submission_runs", [])
    data.setdefault("user_best", [])
    data.setdefault("leaderboard_snapshots", [])
    data.setdefault("submission_visibility", [])
    return data


def _save_ai_puzzle_store(data: dict) -> None:
    _ensure_ai_puzzle_store()
    AI_PUZZLE_STORE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_ai_puzzles() -> list[dict]:
    if not AI_PUZZLES_DIR.exists():
        return []
    out: list[dict] = []
    for fp in sorted(AI_PUZZLES_DIR.glob("*.json")):
        try:
            item = json.loads(fp.read_text(encoding="utf-8"))
            if not isinstance(item, dict):
                continue
            item["_file"] = fp.name
            out.append(item)
        except Exception:
            continue
    return out


def _get_ai_puzzle(puzzle_id: str) -> dict:
    for item in _load_ai_puzzles():
        if str(item.get("id") or "") == str(puzzle_id):
            return item
    raise HTTPException(status_code=404, detail=f"puzzle_id not found: {puzzle_id}")


def _ai_puzzle_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _ai_puzzle_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _next_submission_id() -> str:
    return f"sub_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"


def _normalize_text_basic(text: str) -> str:
    return str(text or "").strip()


def _is_chinese_only(text: str) -> bool:
    s = str(text or "")
    return bool(s) and bool(re.fullmatch(r"[\u4e00-\u9fff]+", s))


def _is_palindrome(text: str) -> bool:
    s = str(text or "")
    return bool(s) and s == s[::-1]


def _apply_rule(rule: dict, text: str, ctx: dict, phase: str) -> str | None:
    rule_type = str((rule or {}).get("type") or "").strip()
    if not rule_type:
        return None
    s = str(text or "")
    if rule_type == "length":
        min_v = rule.get("min")
        max_v = rule.get("max")
        if min_v is not None and max_v is not None and int(min_v) == int(max_v):
            exact = int(min_v)
            if len(s) != exact:
                return f"{phase}长度需 = {exact}"
            return None
        if min_v is not None and len(s) < int(min_v):
            return f"{phase}长度需 >= {int(min_v)}"
        if max_v is not None and len(s) > int(max_v):
            return f"{phase}长度需 <= {int(max_v)}"
        return None
    if rule_type == "charset":
        value = str(rule.get("value") or "").strip()
        if value == "chinese_only" and not _is_chinese_only(s):
            return f"{phase}必须为全中文且不含空格/标点/英文/数字"
        if value == "no_digit" and re.search(r"\d", s):
            return f"{phase}不能包含数字"
        if value == "no_ascii" and re.search(r"[A-Za-z]", s):
            return f"{phase}不能包含英文字符"
        if value == "single_line" and ("\n" in s or "\r" in s):
            return f"{phase}必须为单行"
        if value == "no_whitespace" and re.search(r"\s", s):
            return f"{phase}不能包含空白字符"
        return None
    if rule_type == "palindrome":
        if not _is_palindrome(s):
            return f"{phase}必须是回文串"
        return None
    if rule_type == "forbidSubstring":
        vals = rule.get("values") if isinstance(rule.get("values"), list) else []
        hit = [str(v) for v in vals if str(v) and str(v) in s]
        if hit:
            return f"{phase}不能包含：{'、'.join(hit[:5])}"
        return None
    if rule_type == "regex":
        pattern = str(rule.get("pattern") or "")
        should_match = bool(rule.get("should_match", True))
        matched = bool(pattern) and bool(re.fullmatch(pattern, s))
        if should_match and not matched:
            return f"{phase}不符合格式要求"
        if (not should_match) and matched:
            return f"{phase}命中了禁止格式"
        return None
    if rule_type == "notEqualInput":
        prompt_text = str(ctx.get("prompt_text") or "")
        if s == prompt_text:
            return f"{phase}不能与输入 prompt 完全相同"
        return None
    if rule_type == "notContainInputChars":
        prompt_text = str(ctx.get("prompt_text") or "")
        forbid_chars = {ch for ch in prompt_text if ch.strip()}
        hit = [ch for ch in s if ch in forbid_chars]
        if hit:
            uniq = []
            for ch in hit:
                if ch not in uniq:
                    uniq.append(ch)
            return f"{phase}不能包含输入中的字符：{'、'.join(uniq[:8])}"
        return None
    if rule_type == "lengthCompareInput":
        op = str(rule.get("operator") or "gt").strip()
        prompt_len = len(str(ctx.get("prompt_text") or ""))
        cur_len = len(s)
        ok = True
        if op == "gt":
            ok = cur_len > prompt_len
        elif op == "gte":
            ok = cur_len >= prompt_len
        elif op == "lt":
            ok = cur_len < prompt_len
        elif op == "lte":
            ok = cur_len <= prompt_len
        elif op == "eq":
            ok = cur_len == prompt_len
        if not ok:
            op_desc = {
                "gt": ">",
                "gte": ">=",
                "lt": "<",
                "lte": "<=",
                "eq": "=",
            }.get(op, op)
            return f"{phase}长度需 {op_desc} 输入长度"
        return None
    if rule_type == "notAllSameChar":
        uniq = {ch for ch in s}
        if len(uniq) <= 1:
            return f"{phase}不能全部由同一个汉字组成"
        return None
    if rule_type == "containsAllSubstrings":
        vals = rule.get("values") if isinstance(rule.get("values"), list) else []
        missing = [str(v) for v in vals if str(v) and str(v) not in s]
        if missing:
            return f"{phase}必须包含：{'、'.join(missing[:8])}"
        return None
    return None


def _validate_rules(rules: list[dict], text: str, ctx: dict, phase: str) -> tuple[bool, list[str], str]:
    normalized = _normalize_text_basic(text)
    violations: list[str] = []
    for rule in rules or []:
        if not isinstance(rule, dict):
            continue
        reason = _apply_rule(rule, normalized, ctx, phase)
        if reason:
            violations.append(reason)
    return len(violations) == 0, violations, normalized


def _effective_visibility(raw_visibility: str, solved: bool) -> str:
    v = str(raw_visibility or "public").strip().lower()
    if v not in {"public", "private", "ac_only"}:
        v = "public"
    if v == "ac_only":
        return "public" if solved else "private"
    return v


def _pick_best_submission(items: list[dict]) -> dict | None:
    if not items:
        return None
    def sort_key(item: dict):
        return (
            float(item.get("final_score", 0.0) or 0.0),
            float(item.get("pass_rate", 0.0) or 0.0),
            -int(item.get("token_total", 0) or 0),
            -int(item.get("created_at_ts", 0) or 0),
        )
    return sorted(items, key=sort_key, reverse=True)[0]


def _rebuild_ai_puzzle_materialized_views(store: dict) -> None:
    submissions = [x for x in store.get("submissions", []) if isinstance(x, dict)]
    for sub in submissions:
        try:
            solved = bool(sub.get("solved"))
            pass_rate = float(sub.get("pass_rate", 0.0) or 0.0)
            if solved and pass_rate >= 1.0:
                judge_spec = sub.get("judge_spec_json") if isinstance(sub.get("judge_spec_json"), dict) else {}
                scoring = judge_spec.get("scoring") if isinstance(judge_spec.get("scoring"), dict) else {}
                base_score = float(scoring.get("base_score") or 100.0)
                sub["final_score"] = round(base_score, 4)
        except Exception:
            continue
    best_map: dict[tuple[str, str], dict] = {}
    for sub in submissions:
        key = (str(sub.get("user_id") or ""), str(sub.get("puzzle_id") or ""))
        cur = best_map.get(key)
        if cur is None:
            best_map[key] = sub
            continue
        cur_score = float(cur.get("final_score", 0.0) or 0.0)
        new_score = float(sub.get("final_score", 0.0) or 0.0)
        if new_score > cur_score:
            best_map[key] = sub
        elif new_score == cur_score:
            cur_ts = int(cur.get("created_at_ts", 0) or 0)
            new_ts = int(sub.get("created_at_ts", 0) or 0)
            if new_ts < cur_ts:
                best_map[key] = sub

    user_best_rows: list[dict] = []
    snapshots: list[dict] = []
    per_user: dict[str, list[dict]] = {}
    per_user_daily: dict[tuple[str, str], list[dict]] = {}
    per_problem: dict[str, list[dict]] = {}

    for (user_id, puzzle_id), best in best_map.items():
        user_all = [s for s in submissions if str(s.get("user_id") or "") == user_id and str(s.get("puzzle_id") or "") == puzzle_id]
        first_ac = None
        for s in sorted(user_all, key=lambda x: int(x.get("created_at_ts", 0) or 0)):
            if bool(s.get("solved")):
                first_ac = str(s.get("created_at") or "")
                break
        row = {
            "user_id": user_id,
            "puzzle_id": puzzle_id,
            "best_submission_id": best.get("submission_id"),
            "best_score": round(float(best.get("final_score", 0.0) or 0.0), 4),
            "first_ac_at": first_ac or "",
            "best_ac_at": str(best.get("created_at") or "") if bool(best.get("solved")) else "",
            "submit_count": len(user_all),
            "best_pass_rate": round(float(best.get("pass_rate", 0.0) or 0.0), 4),
            "best_token_total": int(best.get("token_total", 0) or 0),
        }
        user_best_rows.append(row)
        per_user.setdefault(user_id, []).append(row)
        if row["best_ac_at"]:
            date_key = row["best_ac_at"][:10]
            per_user_daily.setdefault((date_key, user_id), []).append(row)
        per_problem.setdefault(puzzle_id, []).append(row)

    overall_rows: list[dict] = []
    for user_id, rows in per_user.items():
        solved_count = sum(1 for r in rows if r.get("best_ac_at"))
        total_score = sum(float(r.get("best_score", 0.0) or 0.0) for r in rows)
        avg_pass_rate = (sum(float(r.get("best_pass_rate", 0.0) or 0.0) for r in rows) / len(rows)) if rows else 0.0
        ac_times = [r.get("first_ac_at") for r in rows if r.get("first_ac_at")]
        earliest_ac = min(ac_times) if ac_times else ""
        overall_rows.append({
            "board_type": "overall",
            "board_date": "",
            "dimension_key": "overall",
            "user_id": user_id,
            "score": round(total_score, 4),
            "solved_count": solved_count,
            "avg_pass_rate": round(avg_pass_rate, 4),
            "earliest_ac_time": earliest_ac,
            "last_submit_at": max((str(s.get("created_at") or "") for s in submissions if str(s.get("user_id") or "") == user_id), default=""),
        })

    def _rank_rows(rows: list[dict], sort_key):
        sorted_rows = sorted(rows, key=sort_key)
        out: list[dict] = []
        for idx, row in enumerate(sorted_rows, start=1):
            row2 = dict(row)
            row2["rank"] = idx
            out.append(row2)
        return out

    snapshots.extend(_rank_rows(
        overall_rows,
        lambda r: (
            -int(r.get("solved_count", 0) or 0),
            -float(r.get("score", 0.0) or 0.0),
            -float(r.get("avg_pass_rate", 0.0) or 0.0),
            str(r.get("earliest_ac_time") or "9999-12-31T23:59:59+00:00"),
            str(r.get("user_id") or ""),
        ),
    ))

    for (date_key, user_id), rows in per_user_daily.items():
        solved_count = sum(1 for r in rows if r.get("best_ac_at"))
        total_score = sum(float(r.get("best_score", 0.0) or 0.0) for r in rows)
        avg_pass_rate = (sum(float(r.get("best_pass_rate", 0.0) or 0.0) for r in rows) / len(rows)) if rows else 0.0
        snapshots.append({
            "board_type": "daily",
            "board_date": date_key,
            "dimension_key": date_key,
            "user_id": user_id,
            "score": round(total_score, 4),
            "solved_count": solved_count,
            "avg_pass_rate": round(avg_pass_rate, 4),
            "earliest_ac_time": min((r.get("first_ac_at") for r in rows if r.get("first_ac_at")), default=""),
            "last_submit_at": max((str(s.get("created_at") or "") for s in submissions if str(s.get("user_id") or "") == user_id and str(s.get("created_at") or "").startswith(date_key)), default=""),
            "rank": 0,
        })

    daily_by_date: dict[str, list[dict]] = {}
    for row in snapshots:
        if row.get("board_type") == "daily":
            daily_by_date.setdefault(str(row.get("board_date") or ""), []).append(row)
    fixed_daily: list[dict] = []
    for date_key, rows in daily_by_date.items():
        fixed_daily.extend(_rank_rows(
            rows,
            lambda r: (
                -int(r.get("solved_count", 0) or 0),
                -float(r.get("score", 0.0) or 0.0),
                -float(r.get("avg_pass_rate", 0.0) or 0.0),
                str(r.get("earliest_ac_time") or "9999-12-31T23:59:59+00:00"),
                str(r.get("user_id") or ""),
            ),
        ))

    snapshots = [x for x in snapshots if x.get("board_type") != "daily"] + fixed_daily

    for puzzle_id, rows in per_problem.items():
        problem_rows = []
        for row in rows:
            problem_rows.append({
                "board_type": "problem",
                "board_date": "",
                "dimension_key": puzzle_id,
                "user_id": row.get("user_id"),
                "score": round(float(row.get("best_score", 0.0) or 0.0), 4),
                "solved_count": 1 if row.get("best_ac_at") else 0,
                "avg_pass_rate": round(float(row.get("best_pass_rate", 0.0) or 0.0), 4),
                "token_total": int(row.get("best_token_total", 0) or 0),
                "earliest_ac_time": row.get("first_ac_at") or "",
                "last_submit_at": row.get("best_ac_at") or "",
                "best_submission_id": row.get("best_submission_id"),
            })
        snapshots.extend(_rank_rows(
            problem_rows,
            lambda r: (
                -int(r.get("solved_count", 0) or 0),
                int(r.get("token_total", 0) or 0) if int(r.get("solved_count", 0) or 0) > 0 else 10**9,
                str(r.get("earliest_ac_time") or "9999-12-31T23:59:59+00:00"),
                -float(r.get("score", 0.0) or 0.0),
                str(r.get("user_id") or ""),
            ),
        ))

    store["user_best"] = user_best_rows
    store["leaderboard_snapshots"] = snapshots


def _summarize_ai_puzzle(item: dict, store: dict | None = None) -> dict:
    store = store or _load_ai_puzzle_store()
    puzzle_id = str(item.get("id") or "")
    submissions = [x for x in store.get("submissions", []) if isinstance(x, dict) and str(x.get("puzzle_id") or "") == puzzle_id]
    public_count = sum(1 for x in submissions if str(x.get("visibility") or "public") == "public")
    best_rows = [x for x in store.get("user_best", []) if isinstance(x, dict) and str(x.get("puzzle_id") or "") == puzzle_id]
    judge_spec = item.get("judge_spec") if isinstance(item.get("judge_spec"), dict) else {}
    scoring = judge_spec.get("scoring") if isinstance(judge_spec.get("scoring"), dict) else {}
    model_profile = item.get("model_profile") if isinstance(item.get("model_profile"), dict) else {}
    sample_prompt = ""
    sample_output = ""
    examples = item.get("examples") if isinstance(item.get("examples"), list) else []
    if examples and isinstance(examples[0], dict):
        sample_prompt = str(examples[0].get("prompt") or "")
        sample_output = str(examples[0].get("output") or "")
    return {
        "id": puzzle_id,
        "name": item.get("name") or item.get("title") or puzzle_id,
        "title": item.get("title") or item.get("name") or puzzle_id,
        "subtitle": item.get("subtitle") or "",
        "description": item.get("description") or "",
        "statement_md": item.get("statement_md") or item.get("description") or "",
        "difficulty": item.get("difficulty") or "",
        "tags": item.get("tags") if isinstance(item.get("tags"), list) else [],
        "publish_status": item.get("publish_status") or "draft",
        "validation_mode": item.get("validation_mode") or "single_turn",
        "prompt_rule_count": len(judge_spec.get("prompt_rules") or []),
        "output_rule_count": len(judge_spec.get("output_rules") or []),
        "run_count": int(scoring.get("run_count") or model_profile.get("run_count") or 1),
        "pass_mode": scoring.get("pass_mode") or "all_runs",
        "sample_input": sample_prompt,
        "sample_output": sample_output,
        "public_submission_count": public_count,
        "best_user_count": len(best_rows),
    }


def _score_ai_puzzle_submission(puzzle: dict, prompt_text: str, outputs: list[dict], token_total: int) -> dict:
    judge_spec = puzzle.get("judge_spec") if isinstance(puzzle.get("judge_spec"), dict) else {}
    scoring = judge_spec.get("scoring") if isinstance(judge_spec.get("scoring"), dict) else {}
    run_count = max(1, int(scoring.get("run_count") or len(outputs) or 1))
    pass_mode = str(scoring.get("pass_mode") or "all_runs")
    min_pass_count = int(scoring.get("min_pass_count") or run_count)
    if pass_mode == "k_of_n":
        min_pass_count = max(1, min(run_count, min_pass_count))
    pass_count = sum(1 for x in outputs if bool(x.get("output_valid")))
    pass_rate = (pass_count / run_count) if run_count > 0 else 0.0
    solved = pass_count >= (run_count if pass_mode == "all_runs" else min_pass_count)
    base_score = float(scoring.get("base_score") or 100.0)
    token_penalty_per_1k = float(scoring.get("token_penalty_per_1k") or 0.0)
    token_penalty = (token_total / 1000.0) * token_penalty_per_1k
    final_score = max(0.0, base_score * pass_rate - token_penalty)
    if pass_rate >= 1.0:
        final_score = base_score
    if solved and final_score <= 0:
        final_score = max(1.0, base_score * pass_rate)
    return {
        "run_count": run_count,
        "pass_mode": pass_mode,
        "min_pass_count": min_pass_count,
        "pass_count": pass_count,
        "pass_rate": round(pass_rate, 4),
        "solved": solved,
        "base_score": round(base_score, 4),
        "token_penalty": round(token_penalty, 4),
        "final_score": round(final_score, 4),
    }


@app.get("/api/ai-puzzle/problems")
def list_ai_puzzles():
    with AI_PUZZLE_STORE_LOCK:
        store = _load_ai_puzzle_store()
        _rebuild_ai_puzzle_materialized_views(store)
        _save_ai_puzzle_store(store)
    items = [_summarize_ai_puzzle(p, store) for p in _load_ai_puzzles() if str(p.get("publish_status") or "draft") != "deleted"]
    return {"code": 0, "msg": "OK", "data": {"problems": items}}


@app.get("/api/ai-puzzle/problems/{puzzle_id}")
def get_ai_puzzle_problem(puzzle_id: str):
    puzzle = _get_ai_puzzle(puzzle_id)
    with AI_PUZZLE_STORE_LOCK:
        store = _load_ai_puzzle_store()
        _rebuild_ai_puzzle_materialized_views(store)
        _save_ai_puzzle_store(store)
    data = _summarize_ai_puzzle(puzzle, store)
    data["input_requirement"] = puzzle.get("input_requirement") or ""
    data["output_requirement"] = puzzle.get("output_requirement") or ""
    data["forbidden_rules"] = puzzle.get("forbidden_rules") if isinstance(puzzle.get("forbidden_rules"), list) else []
    data["judge_spec"] = puzzle.get("judge_spec") if isinstance(puzzle.get("judge_spec"), dict) else {}
    data["model_profile"] = puzzle.get("model_profile") if isinstance(puzzle.get("model_profile"), dict) else {}
    data["examples"] = puzzle.get("examples") if isinstance(puzzle.get("examples"), list) else []
    data["version"] = int(puzzle.get("version") or 1)
    return {"code": 0, "msg": "OK", "data": data}


@app.post("/api/ai-puzzle/submit")
def submit_ai_puzzle(req: AiPuzzleSubmitRequest):
    puzzle = _get_ai_puzzle(req.puzzle_id)
    prompt_text = str(req.user_prompt or "").strip()
    if not prompt_text:
        raise HTTPException(status_code=400, detail="user_prompt is required")

    judge_spec = puzzle.get("judge_spec") if isinstance(puzzle.get("judge_spec"), dict) else {}
    scoring = judge_spec.get("scoring") if isinstance(judge_spec.get("scoring"), dict) else {}
    model_profile = puzzle.get("model_profile") if isinstance(puzzle.get("model_profile"), dict) else {}
    prompt_rules = judge_spec.get("prompt_rules") if isinstance(judge_spec.get("prompt_rules"), list) else []
    output_rules = judge_spec.get("output_rules") if isinstance(judge_spec.get("output_rules"), list) else []

    prompt_valid, prompt_violations, normalized_prompt = _validate_rules(
        prompt_rules,
        prompt_text,
        {"prompt_text": prompt_text},
        "输入",
    )

    api_key = (req.api_key or DEFAULT_API_KEY or "").strip()
    base_url = (req.base_url or DEFAULT_API_URL or "").strip()
    run_count = max(1, int(scoring.get("run_count") or model_profile.get("run_count") or 1))
    outputs: list[dict] = []
    token_total = 0
    raw_request = {
        "puzzle_id": req.puzzle_id,
        "user_prompt": prompt_text,
        "model": req.model or DEFAULT_MODEL,
        "base_url": base_url,
        "run_count": run_count,
    }

    if prompt_valid:
        if not api_key:
            raise HTTPException(status_code=400, detail="api_key is required (set DIFY_API_KEY env or pass in request)")
        for idx in range(run_count):
            started = time.time()
            out_text, used_tokens = call_llm(
                prompt=prompt_text,
                user_input="",
                model=req.model or DEFAULT_MODEL,
                api_key=api_key,
                base_url=base_url,
            )
            token_total += int(used_tokens or 0)
            output_valid, output_violations, normalized_output = _validate_rules(
                output_rules,
                out_text,
                {"prompt_text": normalized_prompt},
                "输出",
            )
            outputs.append({
                "run_index": idx + 1,
                "raw_output": out_text,
                "normalized_output": normalized_output,
                "output_valid": output_valid,
                "output_violations": output_violations,
                "token_output": int(used_tokens or 0),
                "latency_ms": int((time.time() - started) * 1000),
            })

    score_data = _score_ai_puzzle_submission(puzzle, normalized_prompt, outputs, token_total)
    created_at = _ai_puzzle_now_iso()
    created_at_ts = int(time.time() * 1000)
    submission_id = _next_submission_id()
    user_id = str(req.user_id or "guest").strip() or "guest"
    effective_visibility = _effective_visibility(str(req.visibility or "public"), bool(score_data.get("solved")))
    anonymous = bool(req.anonymous)

    submission = {
        "submission_id": submission_id,
        "puzzle_id": str(req.puzzle_id),
        "user_id": user_id,
        "user_prompt": prompt_text,
        "normalized_prompt": normalized_prompt,
        "prompt_valid": prompt_valid,
        "prompt_violations": prompt_violations,
        "final_status": "AC" if bool(score_data.get("solved")) else ("INVALID_PROMPT" if not prompt_valid else "FAIL"),
        "final_score": float(score_data.get("final_score", 0.0) or 0.0),
        "pass_rate": float(score_data.get("pass_rate", 0.0) or 0.0),
        "solved": bool(score_data.get("solved")),
        "run_count": int(score_data.get("run_count", run_count) or run_count),
        "pass_count": int(score_data.get("pass_count", 0) or 0),
        "pass_mode": str(score_data.get("pass_mode") or "all_runs"),
        "model_name": str(req.model or DEFAULT_MODEL or ""),
        "model_version": str(model_profile.get("model_version") or ""),
        "temperature": float(model_profile.get("temperature") or 0.0),
        "token_total": int(token_total),
        "latency_ms": int(sum(int(x.get("latency_ms", 0) or 0) for x in outputs)),
        "visibility": effective_visibility,
        "visibility_requested": str(req.visibility or "public"),
        "anonymous": anonymous,
        "created_at": created_at,
        "created_at_ts": created_at_ts,
        "board_date": created_at[:10],
        "version_no": int(puzzle.get("version") or 1),
        "judge_spec_json": judge_spec,
        "model_profile_json": model_profile,
    }

    run_rows = []
    for item in outputs:
        run_rows.append({
            "submission_id": submission_id,
            "run_index": int(item.get("run_index", 0) or 0),
            "raw_output": item.get("raw_output") or "",
            "normalized_output": item.get("normalized_output") or "",
            "output_valid": bool(item.get("output_valid")),
            "output_violation_json": item.get("output_violations") or [],
            "judge_detail_json": {
                "pass": bool(item.get("output_valid")),
                "latency_ms": int(item.get("latency_ms", 0) or 0),
            },
            "token_input": 0,
            "token_output": int(item.get("token_output", 0) or 0),
            "latency_ms": int(item.get("latency_ms", 0) or 0),
        })

    visibility_row = {
        "submission_id": submission_id,
        "user_id": user_id,
        "puzzle_id": str(req.puzzle_id),
        "visibility": effective_visibility,
        "anonymous": anonymous,
        "updated_at": created_at,
    }

    with AI_PUZZLE_STORE_LOCK:
        store = _load_ai_puzzle_store()
        store["submissions"].append(submission)
        store["submission_runs"].extend(run_rows)
        store["submission_visibility"] = [x for x in store.get("submission_visibility", []) if isinstance(x, dict) and str(x.get("submission_id") or "") != submission_id]
        store["submission_visibility"].append(visibility_row)
        _rebuild_ai_puzzle_materialized_views(store)
        _save_ai_puzzle_store(store)
        best_rows = [x for x in store.get("user_best", []) if isinstance(x, dict) and str(x.get("user_id") or "") == user_id and str(x.get("puzzle_id") or "") == str(req.puzzle_id)]
        best_row = best_rows[0] if best_rows else None

    return {
        "code": 0,
        "msg": "OK",
        "data": {
            "submission_id": submission_id,
            "problem": _summarize_ai_puzzle(puzzle),
            "prompt_valid": prompt_valid,
            "prompt_violations": prompt_violations,
            "normalized_prompt": normalized_prompt,
            "runs": outputs,
            "score": score_data,
            "submission": submission,
            "best": best_row,
            "raw_request": raw_request if req.debug else None,
        },
    }


@app.get("/api/ai-puzzle/history")
def get_ai_puzzle_history(user_id: str = "guest", puzzle_id: str = "", limit: int = 20):
    uid = str(user_id or "guest").strip() or "guest"
    pid = str(puzzle_id or "").strip()
    lim = max(1, min(100, int(limit or 20)))
    with AI_PUZZLE_STORE_LOCK:
        store = _load_ai_puzzle_store()
    rows = [x for x in store.get("submissions", []) if isinstance(x, dict) and str(x.get("user_id") or "") == uid]
    if pid:
        rows = [x for x in rows if str(x.get("puzzle_id") or "") == pid]
    rows = sorted(rows, key=lambda x: int(x.get("created_at_ts", 0) or 0), reverse=True)[:lim]
    return {"code": 0, "msg": "OK", "data": {"items": rows}}


@app.get("/api/ai-puzzle/submissions")
def list_ai_puzzle_submissions(puzzle_id: str = "", public_only: bool = True, limit: int = 20):
    pid = str(puzzle_id or "").strip()
    lim = max(1, min(100, int(limit or 20)))
    with AI_PUZZLE_STORE_LOCK:
        store = _load_ai_puzzle_store()
    rows = [x for x in store.get("submissions", []) if isinstance(x, dict)]
    if pid:
        rows = [x for x in rows if str(x.get("puzzle_id") or "") == pid]
    if public_only:
        rows = [x for x in rows if str(x.get("visibility") or "public") == "public"]
    rows = sorted(rows, key=lambda x: int(x.get("created_at_ts", 0) or 0), reverse=True)[:lim]
    items = []
    for row in rows:
        item = dict(row)
        if bool(item.get("anonymous")):
            item["user_id"] = "anonymous"
        items.append(item)
    return {"code": 0, "msg": "OK", "data": {"items": items}}


@app.get("/api/ai-puzzle/leaderboard")
def get_ai_puzzle_leaderboard(board_type: str = "overall", dimension_key: str = "", board_date: str = "", limit: int = 50):
    bt = str(board_type or "overall").strip().lower()
    lim = max(1, min(200, int(limit or 50)))
    with AI_PUZZLE_STORE_LOCK:
        store = _load_ai_puzzle_store()
        _rebuild_ai_puzzle_materialized_views(store)
        _save_ai_puzzle_store(store)
    rows = [x for x in store.get("leaderboard_snapshots", []) if isinstance(x, dict) and str(x.get("board_type") or "") == bt]
    if bt == "problem" and str(dimension_key or "").strip():
        rows = [x for x in rows if str(x.get("dimension_key") or "") == str(dimension_key).strip()]
    if bt == "daily":
        target_date = str(board_date or dimension_key or _ai_puzzle_today()).strip()
        rows = [x for x in rows if str(x.get("board_date") or "") == target_date]
    rows = sorted(rows, key=lambda x: int(x.get("rank", 999999) or 999999))[:lim]
    return {"code": 0, "msg": "OK", "data": {"items": rows}}


@app.get("/api/ai-puzzle/admin/schema")
def get_ai_puzzle_admin_schema():
    with AI_PUZZLE_STORE_LOCK:
        store = _load_ai_puzzle_store()
        _rebuild_ai_puzzle_materialized_views(store)
        _save_ai_puzzle_store(store)
    tables = {
        "ai_puzzle_problem": {
            "source": "json files in prompt_challenge_demo/puzzles",
            "fields": ["id", "slug", "title", "statement_md", "difficulty", "judge_spec_json", "model_profile_json", "publish_status"],
            "indexes": ["PRIMARY(id)", "UNIQUE(slug)", "IDX_publish_status"],
        },
        "ai_puzzle_problem_version": {
            "source": "problem json version field",
            "fields": ["problem_id", "version_no", "statement_md", "judge_spec_json", "model_profile_json"],
            "indexes": ["PRIMARY(problem_id, version_no)"],
        },
        "ai_puzzle_submission": {
            "rows": len(store.get("submissions", [])),
            "fields": ["submission_id", "puzzle_id", "user_id", "user_prompt", "prompt_valid", "final_status", "final_score", "pass_rate", "token_total", "created_at"],
            "indexes": ["PRIMARY(submission_id)", "IDX_user_problem_created(user_id,puzzle_id,created_at_ts)", "IDX_puzzle_score(puzzle_id,final_score)"],
        },
        "ai_puzzle_submission_run": {
            "rows": len(store.get("submission_runs", [])),
            "fields": ["submission_id", "run_index", "raw_output", "normalized_output", "output_valid", "output_violation_json", "latency_ms"],
            "indexes": ["PRIMARY(submission_id, run_index)"],
        },
        "ai_puzzle_user_best": {
            "rows": len(store.get("user_best", [])),
            "fields": ["user_id", "puzzle_id", "best_submission_id", "best_score", "first_ac_at", "best_ac_at", "submit_count"],
            "indexes": ["PRIMARY(user_id,puzzle_id)", "IDX_best_score(best_score)"],
        },
        "ai_puzzle_leaderboard_snapshot": {
            "rows": len(store.get("leaderboard_snapshots", [])),
            "fields": ["board_type", "board_date", "dimension_key", "user_id", "score", "rank", "solved_count", "last_submit_at"],
            "indexes": ["IDX_board(board_type,board_date,dimension_key,rank)"],
        },
        "ai_puzzle_submission_visibility": {
            "rows": len(store.get("submission_visibility", [])),
            "fields": ["submission_id", "user_id", "puzzle_id", "visibility", "anonymous", "updated_at"],
            "indexes": ["PRIMARY(submission_id)", "IDX_visibility(puzzle_id,visibility)"],
        },
    }
    return {"code": 0, "msg": "OK", "data": {"tables": tables, "problems": [_summarize_ai_puzzle(p, store) for p in _load_ai_puzzles()]}}


@app.get("/api/ai-puzzle/admin/stats")
def get_ai_puzzle_admin_stats():
    with AI_PUZZLE_STORE_LOCK:
        store = _load_ai_puzzle_store()
        _rebuild_ai_puzzle_materialized_views(store)
        _save_ai_puzzle_store(store)
    problems = _load_ai_puzzles()
    recent_submissions = sorted(
        [x for x in store.get("submissions", []) if isinstance(x, dict)],
        key=lambda x: int(x.get("created_at_ts", 0) or 0),
        reverse=True,
    )[:20]
    return {
        "code": 0,
        "msg": "OK",
        "data": {
            "problem_count": len(problems),
            "submission_count": len(store.get("submissions", [])),
            "public_submission_count": sum(1 for x in store.get("submissions", []) if isinstance(x, dict) and str(x.get("visibility") or "public") == "public"),
            "best_user_count": len(store.get("user_best", [])),
            "recent_submissions": recent_submissions,
        },
    }


