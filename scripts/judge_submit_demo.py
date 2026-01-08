import argparse
import json
import os
import time
from typing import Any, Dict, Optional

import requests


DEFAULT_SUBMIT_URL = "https://victorinox.nowcoder.com/api/service/judge/submit"
DEFAULT_STATUS_URL = "https://victorinox.nowcoder.com/api/service/judge/submit-status"


def _mask(s: str, head: int = 6, tail: int = 6) -> str:
    s = s or ""
    if len(s) <= head + tail + 3:
        return "***"
    return f"{s[:head]}***{s[-tail:]}"


def _now_ms() -> int:
    return int(time.time() * 1000)


def _post_json(url: str, payload: Dict[str, Any], timeout_s: int = 30) -> Dict[str, Any]:
    r = requests.post(url, json=payload, params={"_": _now_ms()}, timeout=timeout_s)
    r.raise_for_status()
    return r.json()


def _get_json(url: str, params: Dict[str, Any], timeout_s: int = 30) -> Dict[str, Any]:
    p = dict(params)
    p["_"] = _now_ms()
    r = requests.get(url, params=p, timeout=timeout_s)
    r.raise_for_status()
    return r.json()


def _is_done(status: Any) -> bool:
    """
    submit-status 返回里 status=4 表示结束（示例里 4=Wrong Answer 已结束）。
    这里做宽松处理：status 为 4/5/6/7/8 视为终态（不同环境可能编码不同）。
    """
    try:
        s = int(status)
    except Exception:
        return False
    return s in {4, 5, 6, 7, 8}


def submit_and_poll(
    *,
    code: str,
    question_id: str,
    user_id: str,
    language: int = 2,
    app_id: int = 9,
    submit_type: int = 1,
    tag_id: int = 0,
    remark: str = "{}",
    token: str = "",
    submit_url: str = DEFAULT_SUBMIT_URL,
    status_url: str = DEFAULT_STATUS_URL,
    poll_interval_s: float = 0.8,
    max_wait_s: float = 60.0,
) -> Dict[str, Any]:
    submit_payload: Dict[str, Any] = {
        "content": code,
        "questionId": str(question_id),
        "language": str(int(language)),
        "tagId": int(tag_id),
        "appId": int(app_id),
        "userId": str(user_id),
        "submitType": int(submit_type),
        "remark": remark,
        "token": token or "",
    }

    submit_resp = _post_json(submit_url, submit_payload)
    if not isinstance(submit_resp, dict):
        raise RuntimeError("submit returned non-json object")

    if submit_resp.get("code") != 0:
        raise RuntimeError(f"submit failed: code={submit_resp.get('code')} msg={submit_resp.get('msg')}")

    submit_id = submit_resp.get("data")
    if not submit_id:
        raise RuntimeError(f"submit ok but missing id: {submit_resp}")

    params = {
        "id": submit_id,
        "tagId": int(tag_id),
        "appId": int(app_id),
        "userId": str(user_id),
        "submitType": int(submit_type),
        "remark": remark,
        "token": token or "",
    }

    deadline = time.time() + max_wait_s
    last = None
    while time.time() < deadline:
        last = _get_json(status_url, params)
        if isinstance(last, dict) and last.get("code") == 0:
            data = last.get("data") or {}
            if _is_done(data.get("status")):
                return last
        time.sleep(poll_interval_s)

    raise TimeoutError(f"poll timeout after {max_wait_s}s, last={last}")


def main():
    ap = argparse.ArgumentParser(description="Nowcoder judge submit/status demo (victorinox).")
    ap.add_argument("--question-id", required=True, help="编程题 qid，例如 352865")
    ap.add_argument("--user-id", required=True, help="用户 uid，例如 919247")
    ap.add_argument("--language", type=int, default=2, help="语言 id，默认 2=C++")
    ap.add_argument("--app-id", type=int, default=9, help="appId，默认 9")
    ap.add_argument("--submit-type", type=int, default=1, help="submitType，默认 1")
    ap.add_argument("--tag-id", type=int, default=0, help="tagId，默认 0")
    ap.add_argument("--remark", default="{}", help='remark，默认 "{}"')
    ap.add_argument("--token", default=os.getenv("NOWCODER_JUDGE_TOKEN", ""), help="判题 token（建议通过环境变量 NOWCODER_JUDGE_TOKEN 提供）")
    ap.add_argument("--code-file", help="代码文件路径（优先）")
    ap.add_argument("--code", help="直接传代码字符串（不推荐）")
    ap.add_argument("--submit-url", default=DEFAULT_SUBMIT_URL)
    ap.add_argument("--status-url", default=DEFAULT_STATUS_URL)
    ap.add_argument("--poll-interval", type=float, default=0.8)
    ap.add_argument("--max-wait", type=float, default=60.0)
    args = ap.parse_args()

    if args.code_file:
        with open(args.code_file, "r", encoding="utf-8") as f:
            code = f.read()
    else:
        code = args.code or ""
    if not code.strip():
        raise SystemExit("missing code: provide --code-file or --code")

    if not args.token:
        print("WARN: token is empty; endpoint may return code=683 token service error.")
    else:
        print(f"token={_mask(args.token)}")

    resp = submit_and_poll(
        code=code,
        question_id=args.question_id,
        user_id=args.user_id,
        language=args.language,
        app_id=args.app_id,
        submit_type=args.submit_type,
        tag_id=args.tag_id,
        remark=args.remark,
        token=args.token,
        submit_url=args.submit_url,
        status_url=args.status_url,
        poll_interval_s=args.poll_interval,
        max_wait_s=args.max_wait,
    )

    data = (resp or {}).get("data") or {}
    print("\n=== RESULT ===")
    print(f"id={data.get('id')}")
    print(f"status={data.get('status')} ({data.get('enJudgeReplyDesc') or data.get('judgeReplyDesc')})")
    print(f"right={data.get('rightCaseNum')}/{data.get('allCaseNum')} rate={data.get('rightHundredRate')}")
    if data.get("expectedOutput") is not None:
        print(f"expectedOutput={repr(data.get('expectedOutput'))}")
    if data.get("userOutput") is not None:
        print(f"userOutput={repr(data.get('userOutput'))}")
    if data.get("userInput") is not None:
        print(f"userInput={repr(data.get('userInput'))}")
    print("\n(raw json)")
    print(json.dumps(resp, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()


