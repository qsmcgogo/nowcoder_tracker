from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import os
import json
import re
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path(__file__).resolve().parents[1]
# Prefer promptquestion/questions; fallback to project_root/questions
_primary_q = ROOT / "questions"
_fallback_q = ROOT.parent / "questions"
QUESTIONS_DIR = _primary_q if _primary_q.exists() else _fallback_q

DEFAULT_API_URL = os.getenv("ONE_API_URL", "https://one-api.nowcoder.com/v1/chat/completions")
DEFAULT_MODEL = os.getenv("LLM_MODEL", "doubao-seed-1-6-flash-250828")
DEFAULT_API_KEY = os.getenv("ONE_API_KEY", "sk-CZov8xJ3CucUGw5F9f342fF9A8624aC3B79d7c226dC4E01d")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# （已移除外部相似度依赖）


class EvalRequest(BaseModel):
    question_id: str  # "question1" or "question2"
    prompt: str | None = None
    # for question3
    code: str | None = None
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    max_cases: int | None = None  # optional, limit cases


def list_cases(question_id: str):
    qdir = QUESTIONS_DIR / question_id
    if not qdir.exists():
        raise FileNotFoundError(f"not found: {qdir}")
    ins = sorted(qdir.glob("*.in"), key=lambda p: int(p.stem))
    outs = {p.stem: p for p in qdir.glob("*.out")}
    cases = []
    for i, pin in enumerate(ins, 1):
        key = pin.stem
        pout = outs.get(key)
        if not pout:
            continue
        cases.append((pin, pout))
    return cases

def normalize_question1_output(text: str) -> str:
    """
    question1：结构化信息抽取校验
    期望模型输出 JSON：{"name": "...", "phone": "...", "date": "YYYY-MM-DD"}
    - phone 仅保留数字（允许为空）
    - date 需为 YYYY-MM-DD（允许为空；为空表示文本中缺失该信息）
    - 比对时将 JSON 解析后，按 sort_keys=True 再序列化，确保键顺序无关
    返回：若成功解析且字段齐全，返回规范化JSON字符串；否则返回空串判错。
    """
    try:
        js = json.loads(text)
        name = str(js.get("name", "")).strip()
        phone = re.sub(r"\D+", "", str(js.get("phone", "")))
        date = str(js.get("date", "")).strip()
        # 日期允许为空；非空时需满足 YYYY-MM-DD
        if date:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
                return ""
        norm = {"name": name, "phone": phone, "date": date}
        # 使用无空格分隔，确保与期望文本严格一致
        return json.dumps(norm, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    except Exception:
        return ""

def normalize_question2_output(text: str) -> str:
    """
    情感三分类输出归一化（严格模式）：
    - 仅当去除首尾空白后，整体内容严格等于 POS/NEG/NEU（大小写均可）时，才判为有效。
    - 含有任何其他字符（说明、标点、换行、中文等）一律判错。
    """
    s = text.strip()
    if s.upper() in {"POS", "NEG", "NEU"} and re.fullmatch(r"(POS|NEG|NEU)", s, re.I):
        return s.upper()
    return ""

def normalize_question3_output(text: str) -> str:
    """
    第三题输出格式调整：
    期望模型输出 JSON：
    {
      "reason": "详细的计算过程说明",
      "total": "总美分值"  或 数字
    }
    判分仅比较 total 与用例 .out 的数值是否一致。
    兼容回退：若非 JSON，则退回到旧规则（提取文本中的首个整数）。
    """
    text_s = str(text or "")
    try:
        print(f"[Q3] raw_len={len(text_s)} preview={text_s[:120].replace(chr(10),' ')}")
    except Exception:
        pass
    # 先尝试从 markdown 代码块中提取 json
    try:
        # 复用 question7 的清洗逻辑（若函数不存在则用本地正则）
        try:
            cleaned = _q7_clean_json_string(text_s)  # type: ignore  # noqa
        except NameError:
            mcode = re.search(r"```json\s*(.*?)\s*```", text_s, re.S | re.I)
            cleaned = mcode.group(1) if mcode else text_s
        data = json.loads(cleaned)
        try:
            print(f"[Q3] parsed_json keys={list(data.keys()) if isinstance(data, dict) else type(data).__name__}")
        except Exception:
            pass
        if isinstance(data, dict) and "total" in data:
            total_val = data.get("total")
            if isinstance(total_val, (int, float)):
                print(f"[Q3] total numeric={total_val}")
                return str(int(total_val))
            # 字符串形式，去掉逗号后取整数
            if isinstance(total_val, str):
                s = total_val.replace(",", "").strip()
                m = re.search(r"-?\d+", s)
                if m:
                    print(f"[Q3] total string parsed={m.group(0)}")
                    return m.group(0)
    except Exception:
        try:
            print("[Q3] parse json failed, fallback to regex")
        except Exception:
            pass
    # 回退1：直接在原文中用正则抓取 total 字段的值（即使整体不是严格 JSON）
    m_total = re.search(r'"?total"?\s*:\s*"?(-?\d[\d,]*)"?', text_s, re.I | re.S)
    if m_total:
        val = m_total.group(1).replace(",", "").strip()
        m2 = re.search(r"-?\d+", val)
        if m2:
            try:
                print(f"[Q3] regex total match={m2.group(0)}")
            except Exception:
                pass
            return m2.group(0)
    # 回退2：从整段文本中提取首个整数（去逗号）
    m = re.search(r"-?\d+", text_s.replace(",", ""))
    if m:
        try:
            print(f"[Q3] fallback first_int={m.group(0)}")
        except Exception:
            pass
        return m.group(0)
    try:
        print("[Q3] no integer found")
    except Exception:
        pass
    return ""


def normalize_question4_output(text: str) -> str:
    # 只允许输出 4档/3档/2档/1档，其他一律判错
    m = re.search(r"[1234]档", text.strip())
    return m.group(0) if m else ""

def _normalize_nowcoder_chanpin_output(text: str) -> str:
    """
    归一化为 '2' 或 '1'：
    - '2' 表示含有搜索策略产品经验
    - '1' 表示不含
    兼容 true/false（true->'2', false->'1'）；若解析唯一数字仅为1或2也接受
    其余返回空串用于判错
    """
    s = str(text or "").strip()
    return s

def _q7_clean_json_string(text: str) -> str:
    m = re.search(r"```json\s*(.*?)\s*```", text, re.S)
    if m:
        return m.group(1)
    return text


def _q7_norm_result(val) -> str:
    s = str(val).strip().lower()
    if s in ("yes", "y", "true"):
        return "Yes"
    if s in ("no", "n", "false"):
        return "No"
    return str(val)


def _q7_norm_amount(val):
    try:
        print(f"[Q7] norm_amount input type={type(val).__name__} val={val}")
    except Exception:
        pass
    if isinstance(val, int):
        try:
            print(f"[Q7] norm_amount return int={val}")
        except Exception:
            pass
        return val
    if isinstance(val, float):
        try:
            iv = int(val)
            try:
                print(f"[Q7] norm_amount float->{iv}")
            except Exception:
                pass
            return iv
        except Exception:
            return val
    if isinstance(val, str):
        s = val.strip()
        if re.fullmatch(r"-?\d+", s):
            try:
                iv = int(s)
                try:
                    print(f"[Q7] norm_amount strint->{iv}")
                except Exception:
                    pass
                return iv
            except Exception:
                return val
        try:
            f = float(s)
            iv = int(f)
            try:
                print(f"[Q7] norm_amount strfloat->{iv}")
            except Exception:
                pass
            return iv
        except Exception:
            return val
    try:
        print(f"[Q7] norm_amount passthrough type={type(val).__name__}")
    except Exception:
        pass
    return val


def _q7_norm_citation_str(s: str) -> str:
    t = str(s).strip()
    m = re.fullmatch(r"\[?\s*(\d+\.\d+)\s*\]?", t)
    if m:
        return f"[{m.group(1)}]"
    return t


def _q7_norm_citations(lst) -> list[str]:
    try:
        return sorted({ _q7_norm_citation_str(x) for x in (lst or []) })
    except Exception:
        return []


def normalize_question7_expected(text: str) -> tuple[str, list[str]]:
    """标准化期望 JSON，返回(规范化JSON字符串, 键列表顺序固定)"""
    data = json.loads(_q7_clean_json_string(text))
    keys = []
    norm: dict = {}
    if "result" in data:
        norm["result"] = _q7_norm_result(data.get("result"))
        keys.append("result")
    if "amount" in data:
        norm["amount"] = _q7_norm_amount(data.get("amount"))
        keys.append("amount")
    if "citation" in data:
        norm["citation"] = _q7_norm_citations(data.get("citation"))
        keys.append("citation")
    # 不参与对比的字段（如 reason）不纳入
    return json.dumps(norm, ensure_ascii=False, sort_keys=True, separators=(",", ":")), keys


def normalize_question7_output(text: str, keys_wanted: list[str]) -> str:
    """按期望的键集合对模型输出做标准化，仅保留这些键用于对比。"""
    try:
        data = json.loads(_q7_clean_json_string(text))
    except Exception:
        # 解析失败直接返回原文包裹，保证比较失败
        return text.strip()
    norm: dict = {}
    if "result" in keys_wanted:
        norm["result"] = _q7_norm_result(data.get("result"))
    if "amount" in keys_wanted:
        norm["amount"] = _q7_norm_amount(data.get("amount"))
    if "citation" in keys_wanted:
        norm["citation"] = _q7_norm_citations(data.get("citation"))
    return json.dumps(norm, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


#（已移除旧版保险评分器）


def call_llm(prompt: str, user_input: str, model: str, api_key: str, base_url: str) -> tuple[str, int]:
    """
    支持两个模型：
    - doubao-seed-1-6-flash-250828：使用 thinking: {type: disabled}
    - qwen3-4b-nothinking（映射 qwen3-4b）：使用 enable_thinking=false（含 parameters）
    返回：(content, tokens)
    """
    url = base_url or DEFAULT_API_URL
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    use_model = (model or DEFAULT_MODEL) or "doubao-seed-1-6-flash-250828"
    # 构造 payload
    if use_model == "doubao-seed-1-6-flash-250828":
        data = {
            "model": "doubao-seed-1-6-flash-250828",
            "messages": [
                {"role": "user", "content": f"{prompt}\n\n【输入】\n{user_input}"},
            ],
            "thinking": {"type": "disabled"},
            "temperature": 0.01, 
            "top_p": 0.01
        }
    elif use_model == "qwen3-4b-nothinking" or use_model == "qwen3-4b":
        data = {
            "model": "qwen3-4b-nothinking",
            "messages": [
                {"role": "user", "content": f"{prompt}\n\n【输入】\n{user_input}"},
            ],
            "enable_thinking": False,
            "parameters": {"enable_thinking": False},
            "temperature": 0.01, 
            "top_p": 0.01
        }
    else:
        data = {
            "model": use_model,
            "messages": [
                {"role": "user", "content": f"{prompt}\n\n【输入】\n{user_input}"},
            ],
            "temperature": 0.01,
            "top_p": 0.01,
        }
    try:
        print("data="+json.dumps(data))
        resp = requests.post(url, headers=headers, data=json.dumps(data), timeout=60)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        js = resp.json()
        try:
            print("js="+json.dumps(js, ensure_ascii=False)[:500])
        except Exception:
            print(f"js_type={type(js).__name__}")
        tokens = 0
        try:
            usage = js.get("usage") or {}
            tokens = int(
                usage.get("total_tokens")
                or usage.get("totalTokens")
                or usage.get("total")
                or 0
            )
        except Exception:
            tokens = 0
        try:
            content = js["choices"][0]["message"]["content"]
        except Exception:
            content = json.dumps(js, ensure_ascii=False)
        return (content or "").strip(), tokens
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def eval_question5_with_evalfile(case_input: str, user_output: str, eval_text: str, model: str, api_key: str, base_url: str) -> dict:
    """
    使用题库中每个用例自带的 .eval 评测提示词进行打分。
    约定：模型输出严格为 JSON：{"score": 0-100, "reasons": "..."}
    """
    try:
        merged = (
            f"{eval_text}\n\n"
            f"【案例输入】\n{case_input}\n\n"
            f"【用户输出】\n{user_output}\n\n"
            "请仅输出JSON：{\"score\": 整数0-100, \"reasons\": \"一句话说明\"}"
        )
        txt, tokens = call_llm(
            prompt="task3-eval",
            user_input=merged,
            model=model,
            api_key=api_key,
            base_url=base_url,
        )
        data = json.loads(txt)
        score = int(data.get("score", 0))
        reasons = str(data.get("reasons", "")).strip()
        score = max(0, min(100, score))
        return {"score": score, "reasons": reasons or "LLM给出评分", "tokens": tokens}
    except Exception as e:
        # 失败则回退到内置评测逻辑
        fallback = {}
        fallback["reasons"] = f"失败，已使用兜底: {e}"
        return fallback

from fastapi.responses import HTMLResponse

@app.get("/index", response_class=HTMLResponse)
def serve_index():
    index_path = ROOT / "web" / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return index_path.read_text(encoding="utf-8")

@app.get("/nowcoder/chanpin", response_class=HTMLResponse)
def serve_nowcoder_chanpin():
    # 返回统一的前端页，由前端根据路径选择题库接口
    index_path = ROOT / "web" / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return index_path.read_text(encoding="utf-8")

@app.get("/nowcoder/chanpin/questions")
def get_nowcoder_chanpin_questions():
    qids = []
    base = QUESTIONS_DIR / "nowcoder" / "chanpin-1"
    if base.exists():
        qids.append({"id": "nowcoder/chanpin-1", "name": "搜索策略产品经验判断"})
    return {"questions": qids}
@app.get("/questions")
def get_questions():
    qids = []
    if (QUESTIONS_DIR / "question1").exists():
        qids.append({"id": "question1", "name": "信息抽取（CRM录入场景）"})
    if (QUESTIONS_DIR / "question2").exists():
        qids.append({"id": "question2", "name": "情感三分类（POS/NEG/NEU）"})
    if (QUESTIONS_DIR / "question3").exists():
        qids.append({"id": "question3", "name": "难-金额抽取"})
    if (QUESTIONS_DIR / "question4").exists():
        qids.append({"id": "question4", "name": "难-简历打分之工作经历"})
    if (QUESTIONS_DIR / "question5").exists():
        qids.append({"id": "question5", "name": "难-理财产品推荐与营销话术"})
    # 新增：题目6（仅展示，不做自动评测）
    qids.append({"id": "question6", "name": "SQL 业务需求 - 视频热度 Top3"})
    if (QUESTIONS_DIR / "question7").exists():
        qids.append({"id": "question7", "name": "保险理赔助手（JSON+条款引用）"})
    if (QUESTIONS_DIR / "question8").exists():
        qids.append({"id": "question8", "name": "智能家居中控（函数调用 JSON）"})
    return {"questions": qids}

class GenRequest(BaseModel):
    prompt: str
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None

@app.post("/generate")
def generate(req: GenRequest):
    """
    question6 的辅助接口：直接调用大模型，根据输入 prompt 生成内容并返回。
    """
    try:
        # 打印本次调用的信息
        print(f"[LLM] qid=generate model={(req.model or DEFAULT_MODEL)} prompt={req.prompt}")
        content, tokens = call_llm(
            prompt=req.prompt,
            user_input="",
            model=req.model or DEFAULT_MODEL,
            api_key=req.api_key or DEFAULT_API_KEY,
            base_url=req.base_url or DEFAULT_API_URL,
        )
        return {"content": content, "tokens": tokens}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/evaluate")
def evaluate(req: EvalRequest):
    try:
        cases = list_cases(req.question_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if req.max_cases:
        cases = cases[: req.max_cases]

    results: list[dict] = []
    passed = 0
    total_tokens = 0

    if req.question_id in ("question1", "question2", "question3", "question4", "question5", "question7", "question8") or req.question_id.startswith("nowcoder/chanpin-"):
        if not req.prompt:
            raise HTTPException(status_code=400, detail="prompt is required for question1/2/3/4/5/7/8")
        # 并行评测：按用例并发调用 LLM
        selected_model = req.model or DEFAULT_MODEL
        # 仅在本次 evaluate 调用开始时打印一次信息（题号/模型/提示词）
        print(f"[LLM] qid={req.question_id} model={selected_model} prompt={req.prompt}")
        knowledge_txt = ""
        if req.question_id == "question7":
            kpath = QUESTIONS_DIR / "question7" / "knowledge.txt"
            if kpath.exists():
                try:
                    knowledge_txt = kpath.read_text(encoding="utf-8").strip()
                except Exception:
                    knowledge_txt = ""
        def eval_one(idx: int, pin: Path, pout: Path):
            def eval_one(idx: int, pin: Path, pout: Path):
                print(f"[eval_one] start idx={idx} case={pin.stem} qid={req.question_id}")
                inp = pin.read_text(encoding="utf-8")
                expected = pout.read_text(encoding="utf-8").strip()
                try:
                    print(f"[eval_one] input_len={len(inp)} expected_len={len(expected)}")
                except Exception:
                    pass
                if req.question_id == "question7":
                    # 将知识库拼入用户输入，实现最小化RAG效果
                    merged_input = (
                        f"【知识库】\n{knowledge_txt}\n\n"
                        f"【问题】\n{inp}\n\n"
                    )
                    out_text, used_tokens = call_llm(
                        prompt=req.prompt,
                        user_input=merged_input,
                        model=selected_model,
                        api_key=req.api_key or DEFAULT_API_KEY,
                        base_url=req.base_url or DEFAULT_API_URL,
                    )
                elif req.question_id == "question8":
                    out_text, used_tokens = call_llm(
                        prompt=req.prompt,
                        user_input=inp,
                        model=selected_model,
                        api_key=req.api_key or DEFAULT_API_KEY,
                        base_url=req.base_url or DEFAULT_API_URL,
                    )
                else:
                    out_text, used_tokens = call_llm(
                        prompt=req.prompt,
                        user_input=inp,
                        model=selected_model,
                        api_key=req.api_key or DEFAULT_API_KEY,
                        base_url=req.base_url or DEFAULT_API_URL,
                    )
                try:
                    print(f"[eval_one] used_tokens={used_tokens} out_len={len(out_text)}")
                except Exception:
                    pass
                # 第5题：评分流
                if req.question_id == "question5":
                    eval_path = pin.with_suffix(".eval")
                    eval_text = eval_path.read_text(encoding="utf-8") if eval_path.exists() else ""
                    eval_res = eval_question5_with_evalfile(
                        case_input=inp,
                        user_output=out_text,
                        eval_text=eval_text,
                        model=req.model or DEFAULT_MODEL,
                        api_key=req.api_key or DEFAULT_API_KEY,
                        base_url=req.base_url or DEFAULT_API_URL,
                    )
                    score_i = int(eval_res.get("score", 0))
                    add_tokens = int(eval_res.get("tokens", 0) or 0)
                    detail = {
                        "case": pin.stem,
                        "input": inp,
                        "raw_output": out_text,
                        "score": score_i,
                        "reasons": eval_res.get("reasons", ""),
                        "expected": expected,
                    }
                    print(f"[eval_one] q5 score={score_i} add_tokens={add_tokens}")
                    return {"idx": idx, "tokens": used_tokens + add_tokens, "passed_inc": score_i, "detail": detail}
                # 第7题：改为与 question1 相同的“期望JSON对比”判定
                if req.question_id == "question7":
                    expected_norm, keys_wanted = normalize_question7_expected(expected)
                    pred = normalize_question7_output(out_text, keys_wanted)
                    ok = (pred == expected_norm)
                    detail = {
                        "case": pin.stem,
                        "input": inp,
                        "expected": expected_norm,
                        "raw_output": out_text,
                        "prediction": pred,
                        "pass": ok,
                    }
                    print(f"[eval_one] q7 pass={ok}")
                    return {"idx": idx, "tokens": used_tokens, "passed_inc": (1 if ok else 0), "detail": detail}
                # 第8题：结构化工具调用比对（顺序无关；同一工具的多个调用仅按 location 配对，其它值需匹配；允许多余参数/动作）
                if req.question_id == "question8":
                    def _clean_json(s: str) -> str:
                        # 清理 ```json ... ``` 包裹
                        return re.sub(r"```json\s*|\s*```", "", s, flags=re.I).strip()
    
                    def _parse_json_list(s: str):
                        data = json.loads(_clean_json(s))
                        if not isinstance(data, list):
                            raise ValueError("not a list")
                        return data
    
                    def _to_int_if_numlike(v):
                        try:
                            if isinstance(v, bool):
                                return v
                            if isinstance(v, (int, float)):
                                return int(v)
                            if isinstance(v, str) and re.fullmatch(r"-?\d+", v.strip()):
                                return int(v.strip())
                        except Exception:
                            pass
                        return v
    
                    def _norm_str(v, key: str):
                        if isinstance(v, str):
                            s = v.strip()
                            if key in ("location", "action", "mode", "tool_name"):
                                return s.lower()
                            return s
                        return v
    
                    def _val_equal(gt_v, ai_v, key: str):
                        gt_n = _to_int_if_numlike(gt_v)
                        ai_n = _to_int_if_numlike(ai_v)
                        if isinstance(gt_n, (int, float)) and isinstance(ai_n, (int, float)):
                            return int(gt_n) == int(ai_n)
                        return _norm_str(gt_v, key) == _norm_str(ai_v, key)
    
                    def _args_match(gt_args: dict, ai_args: dict):
                        for k, v in (gt_args or {}).items():
                            if not _val_equal(v, ai_args.get(k), k):
                                return False
                        return True
    
                    # 解析 GT/AI
                    try:
                        gt_list = _parse_json_list(expected)
                    except Exception:
                        gt_list = []
                    try:
                        ai_list = _parse_json_list(out_text)
                    except Exception:
                        ai_list = None
    
                    if isinstance(ai_list, list) and len(gt_list) == 0:
                        ok = (len(ai_list) == 0)
                    elif isinstance(ai_list, list):
                        # 核心：同一工具的多个调用，仅按 location 配对；在同一 location 上，要求 GT 的 key/value 被 AI 覆盖（允许 AI 多余参数）
                        ok = True
                        used = set()  # 已匹配的 AI 下标，防止一个 AI 调用被多个 GT 消耗
                        for gt in gt_list:
                            t_gt = _norm_str(gt.get("tool_name"), "tool_name")
                            gt_args = gt.get("arguments", {}) or {}
                            loc_gt = _norm_str(gt_args.get("location"), "location")
                            found = False
                            for i, ai in enumerate(ai_list):
                                if i in used:
                                    continue
                                if _norm_str(ai.get("tool_name"), "tool_name") != t_gt:
                                    continue
                                ai_args = ai.get("arguments", {}) or {}
                                if _norm_str(ai_args.get("location"), "location") != loc_gt:
                                    continue
                                # 其它字段按“GT 被包含”校验
                                if _args_match(gt_args, ai_args):
                                    used.add(i)
                                    found = True
                                    break
                            if not found:
                                ok = False
                                break
                    else:
                        ok = False
    
                    detail = {
                        "case": pin.stem,
                        "input": inp,
                        "expected": json.dumps(gt_list if 'gt_list' in locals() else [], ensure_ascii=False),
                        "raw_output": out_text,
                        "prediction": _clean_json(out_text),
                        "pass": ok,
                    }
                    print(f"[eval_one] q8 pass={ok}")
                    return {"idx": idx, "tokens": used_tokens, "passed_inc": (1 if ok else 0), "detail": detail}
    
                # Nowcoder chanpin：同 question1 的评测流程思想（严格匹配归一化值）
                if req.question_id.startswith("nowcoder/chanpin-"):
                    pred = _normalize_nowcoder_chanpin_output(out_text)
                    expected_norm = _normalize_nowcoder_chanpin_output(expected) or expected.strip()
                    ok = (pred == expected_norm)
                    detail = {
                        "case": pin.stem,
                        "input": inp,
                        "expected": expected_norm,
                        "raw_output": out_text,
                        "prediction": pred,
                        "pass": ok,
                    }
                    return {"idx": idx, "tokens": used_tokens, "passed_inc": (1 if ok else 0), "detail": detail}

                # 判定型：归一化或严格比对
                if req.question_id == "question1":
                    pred = normalize_question1_output(out_text)
                    expected_norm = normalize_question1_output(expected) or expected
                elif req.question_id == "question2":
                    pred = normalize_question2_output(out_text)
                    expected_norm = normalize_question2_output(expected) or expected
                elif req.question_id == "question3":
                    pred = normalize_question3_output(out_text)
                    expected_norm = normalize_question3_output(expected) or expected
                else:
                    pred = normalize_question4_output(out_text)
                    expected_norm = normalize_question4_output(expected) or expected
                ok = (pred == expected_norm)
                detail = {
                    "case": pin.stem,
                    "input": inp,
                    "expected": expected_norm,
                    "raw_output": out_text,
                    "prediction": pred,
                    "pass": ok,
                }
                print(f"[eval_one] q{req.question_id[-1]} pass={ok}")
                return {"idx": idx, "tokens": used_tokens, "passed_inc": (1 if ok else 0), "detail": detail}
            return eval_one(idx, pin, pout)

        results_buffer = [None] * len(cases)
        max_workers = min(8, len(cases))
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            future_to_idx = {ex.submit(eval_one, i, pin, pout): i for i, (pin, pout) in enumerate(cases)}
            for fut in as_completed(future_to_idx):
                try:
                    res = fut.result()
                except HTTPException as he:
                    raise he
                except Exception as e:
                    raise HTTPException(status_code=500, detail=str(e))
                total_tokens += int(res.get("tokens", 0))
                passed += int(res.get("passed_inc", 0))
                results_buffer[res["idx"]] = res["detail"]
        results = [r for r in results_buffer if r is not None]
    else:
        raise HTTPException(status_code=400, detail=f"unknown question_id: {req.question_id}")

    if req.question_id in ("question1", "question2"):
        score_str = f"avg {round((passed/len(cases)) if len(cases)>0 else 0, 1)}"
        passed_val = passed
        score_label = "平均分"
    elif req.question_id in ("question3", "question4", "question7", "question8") or req.question_id.startswith("nowcoder/chanpin-"):
        score_str = f"{passed}/{len(cases)}"
        passed_val = passed
        score_label = None
    elif req.question_id in ("question5",):
        # question5（eval）返回总分，passed 不适用
        score_str = f"{passed}"
        passed_val = None
        score_label = "总分"
    else:
        score_str = f"{passed}"
        passed_val = None
        score_label = None

    return {
        "question_id": req.question_id,
        "total": len(cases),
        "passed": passed_val,
        "score": score_str,
        "score_label": score_label,
        "tokens": total_tokens,
        "details": results,
    }


