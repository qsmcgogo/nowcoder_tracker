/**
 * 学习 Demo：基础输出（MVP）
 * - 目标：用“简化解释器 + 动画 stdout”讲清楚 cout/endl/\n 的输出效果
 * - 注意：这不是 C++ 编译器，只覆盖极小子集用于入门演示
 */
import { eventBus, EVENTS } from '../../events/EventBus.js';

const DEFAULT_CODE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    cout << "Hello" << endl;
    return 0;
}
`;

const CHALLENGES = [
    {
        id: 'c1',
        title: '关卡1：输出一行 Hello',
        desc: '目标输出：Hello + 换行',
        expected: 'Hello\n',
        coach: {
            say: '先别管花里胡哨：把字符串输出出来，然后换行就完事了。',
            code: 'cout << "Hello" << endl;'
        },
        seed: `#include <bits/stdc++.h>
using namespace std;

int main() {
    // TODO: 输出 Hello 并换行
    return 0;
}
`
    },
    {
        id: 'c2',
        title: '关卡2：输出两行（注意换行）',
        desc: '目标输出两行：Hello / World',
        expected: 'Hello\nWorld\n',
        coach: {
            say: '两行=两次换行：可以写两条 cout，也可以一条 cout 输出两次再 endl。',
            code: 'cout << "Hello" << endl;\ncout << "World" << endl;'
        },
        seed: `#include <bits/stdc++.h>
using namespace std;

int main() {
    // TODO: 输出两行：Hello 和 World（每行末尾换行）
    return 0;
}
`
    },
    {
        id: 'c3',
        title: '关卡3：理解 \\n 与 endl',
        desc: '目标输出：A(换行)B(换行)。要求至少使用一次 "\\n" 或 \'\\n\'。',
        expected: 'A\nB\n',
        coach: {
            say: 'endl 和 "\\n" 都能换行：endl 还会刷新缓冲区（这关先把换行玩明白）。',
            code: 'cout << "A\\n" << "B\\n";'
        },
        seed: `#include <bits/stdc++.h>
using namespace std;

int main() {
    // TODO: 输出 A 和 B，中间换行，末尾也换行
    return 0;
}
`
    }
];

function stripComments(code) {
    // remove /* */ first
    let s = String(code || '');
    s = s.replace(/\/\*[\s\S]*?\*\//g, '');
    // remove // to end of line
    s = s.replace(/\/\/.*$/gm, '');
    return s;
}

function unescapeCString(raw) {
    // raw without surrounding quotes
    const s = String(raw);
    return s.replace(/\\([\\'"nrt])/g, (_, c) => {
        if (c === 'n') return '\n';
        if (c === 'r') return '\r';
        if (c === 't') return '\t';
        if (c === '\\') return '\\';
        if (c === '"') return '"';
        if (c === "'") return "'";
        return c;
    });
}

function parseLiteral(expr) {
    const t = String(expr || '').trim();
    // string literal
    if (/^"([\s\S]*)"$/.test(t)) {
        const inner = t.slice(1, -1);
        return { ok: true, type: 'string', value: unescapeCString(inner) };
    }
    // char literal (supports '\n', '\\', '\'', 'A')
    if (/^'([\s\S])'$/.test(t)) {
        return { ok: true, type: 'char', value: t.slice(1, -1) };
    }
    if (/^'\\[nrt\\']'$/.test(t)) {
        const inner = t.slice(2, -1); // n/r/t/\/'
        return { ok: true, type: 'char', value: unescapeCString('\\' + inner) };
    }
    // number literal
    if (/^[+-]?\d+(\.\d+)?$/.test(t)) {
        return { ok: true, type: 'number', value: t };
    }
    return { ok: false };
}

function parseVariables(code) {
    const vars = new Map();
    const lines = String(code || '').split(/\r?\n/);
    for (const line of lines) {
        // very small subset: (int|long long|double|char|string) name = literal;
        const m = line.match(/^\s*(int|long\s+long|double|char|string)\s+([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;\s*$/);
        if (!m) continue;
        const [, type, name, expr] = m;
        const lit = parseLiteral(expr);
        if (!lit.ok) continue;
        if (type === 'char') vars.set(name, String(lit.value));
        else vars.set(name, String(lit.value));
    }
    return vars;
}

function parseCoutStatements(code) {
    const cleaned = stripComments(code);
    const vars = parseVariables(cleaned);
    const lines = cleaned.split(/\r?\n/);
    const steps = [];
    const errors = [];

    const pushWrite = (text, explain, lineNo) => {
        steps.push({ kind: 'write', text, explain, lineNo });
    };
    const pushNewline = (explain, lineNo) => {
        steps.push({ kind: 'write', text: '\n', explain, lineNo });
    };

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        if (!rawLine.includes('cout')) continue;
        // support: cout << ... << ... ;
        const m = rawLine.match(/\bcout\b([\s\S]*?)\s*;\s*$/);
        if (!m) continue;
        const rhs = m[1];
        const parts = rhs.split('<<').map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) continue;

        for (const p of parts) {
            const lineNo = i + 1;
            if (p === 'endl') {
                pushNewline('输出 endl（换行）', lineNo);
                continue;
            }
            const lit = parseLiteral(p);
            if (lit.ok) {
                if (lit.type === 'string') pushWrite(String(lit.value), `输出字符串 ${JSON.stringify(lit.value)}`, lineNo);
                else pushWrite(String(lit.value), `输出字面量 ${String(p).trim()}`, lineNo);
                continue;
            }
            if (vars.has(p)) {
                pushWrite(String(vars.get(p)), `输出变量 ${p} 的值`, lineNo);
                continue;
            }
            // allow '\n' token as a char literal already handled above; if still here, treat as unknown
            errors.push(`第 ${lineNo} 行：不支持的输出片段：${p}`);
        }
    }

    return { steps, errors };
}

export class OutputDemoView {
    constructor(elements, state, apiService) {
        this.elements = elements;
        this.state = state;
        this.apiService = apiService;

        this.modal = document.getElementById('output-demo-modal');
        this.overview = document.getElementById('output-demo-overview');
        this.startBtn = document.getElementById('output-demo-start');
        this.layout = this.modal ? this.modal.querySelector('.learning-demo-layout') : null;
        this.actionsBar = this.modal ? this.modal.querySelector('.learning-demo-actions') : null;
        this.titleEl = document.getElementById('output-demo-title');
        this.closeBtn = document.getElementById('output-demo-close');
        this.codeEl = document.getElementById('output-demo-code');
        this.consoleEl = document.getElementById('output-demo-console');
        this.stepsEl = document.getElementById('output-demo-steps');
        this.errorsEl = document.getElementById('output-demo-errors');
        this.statusEl = document.getElementById('output-demo-status');
        this.runBtn = document.getElementById('output-demo-run');
        this.stepBtn = document.getElementById('output-demo-step');
        this.resetBtn = document.getElementById('output-demo-reset');
        this.challengeSelect = document.getElementById('output-demo-challenge');
        this.speedRange = document.getElementById('output-demo-speed');
        this.coach = document.getElementById('output-demo-coach');
        this.coachSubtitle = document.getElementById('output-demo-coach-subtitle');
        this.coachSay = document.getElementById('output-demo-coach-say');
        this.coachCode = document.getElementById('output-demo-coach-code');
        this.coachInsertBtn = document.getElementById('output-demo-coach-insert');
        this.coachRestoreBtn = document.getElementById('output-demo-coach-restore');

        this._runId = 0;
        this._paused = false;
        this._cursor = 0;
        this._compiled = null; // { steps, expected }
        this._lastCompiledCode = '';
        this._lastBeforeInsertCode = ''; // 单步还原：记录最近一次“一键填入”前的代码
        this._activeChallenge = CHALLENGES[0];
        this._speedTouched = false;

        this.init();
    }

    delayFromSpeed(speed) {
        const s = Math.max(1, Math.min(5, Number(speed) || 1));
        // 整体放慢：更适合看清每一步输出发生在哪里
        // 1..5 => 650, 520, 420, 320, 240 (ms)
        return [650, 520, 420, 320, 240][s - 1];
    }

    init() {
        if (!this.modal) return;

        // practice speed default: slowest, but don't fight user once they touched it
        if (this.speedRange) {
            this.speedRange.value = '1';
            this.speedRange.addEventListener('input', () => {
                this._speedTouched = true;
            });
        }

        // init select
        if (this.challengeSelect) {
            this.challengeSelect.innerHTML = CHALLENGES.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
            this.challengeSelect.value = this._activeChallenge.id;
            this.challengeSelect.addEventListener('change', () => {
                const id = this.challengeSelect.value;
                const c = CHALLENGES.find(x => x.id === id) || CHALLENGES[0];
                this.setChallenge(c);
            });
        }

        this.closeBtn && this.closeBtn.addEventListener('click', () => this.close());
        this.startBtn && this.startBtn.addEventListener('click', () => this.enterPractice());
        this.runBtn && this.runBtn.addEventListener('click', () => this.run());
        this.stepBtn && this.stepBtn.addEventListener('click', () => this.stepOnce());
        this.resetBtn && this.resetBtn.addEventListener('click', () => this.reset());
        this.coachInsertBtn && this.coachInsertBtn.addEventListener('click', () => this.insertCoachCode());
        this.coachRestoreBtn && this.coachRestoreBtn.addEventListener('click', () => this.restoreBeforeInsert());

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        eventBus.on(EVENTS.OPEN_OUTPUT_DEMO, (payload) => this.open(payload));
        this.setChallenge(this._activeChallenge);
    }

    open(payload) {
        if (!this.modal) return;
        const title = payload && payload.title ? String(payload.title) : '学习 Demo：基础输出';
        if (this.titleEl) this.titleEl.textContent = title;
        this.modal.style.display = 'flex';
        this.enterOverview();
    }

    close() {
        if (!this.modal) return;
        this.modal.style.display = 'none';
    }

    enterOverview() {
        // 打开时先讲原理，再进入练习
        if (this.overview) this.overview.style.display = 'flex';
        if (this.layout) this.layout.style.display = 'none';
        if (this.actionsBar) this.actionsBar.style.display = 'none';
        this.reset();
        if (this.statusEl) this.statusEl.textContent = '先读完原理概览，再开始练习。';
    }

    enterPractice() {
        if (this.overview) this.overview.style.display = 'none';
        if (this.layout) this.layout.style.display = 'flex';
        if (this.actionsBar) this.actionsBar.style.display = 'flex';
        if (this.speedRange && !this._speedTouched) this.speedRange.value = '1';
        this.reset();
        // 聚焦编辑器（更像“进入练习”）
        try { this.codeEl && this.codeEl.focus(); } catch (_) {}
    }

    setChallenge(c) {
        this._activeChallenge = c;
        if (this.coachSubtitle) this.coachSubtitle.textContent = c.desc || '';
        if (this.coachSay) this.coachSay.textContent = (c.coach && c.coach.say) || '';
        if (this.coachCode) this.coachCode.textContent = (c.coach && c.coach.code) || '';
        if (this.codeEl) this.codeEl.value = c.seed || DEFAULT_CODE;
        this.reset();
    }

    showError(msg) {
        if (this.errorsEl) {
            this.errorsEl.style.display = 'block';
            this.errorsEl.textContent = msg;
        }
        if (this.statusEl) this.statusEl.textContent = '';
    }

    clearError() {
        if (this.errorsEl) {
            this.errorsEl.style.display = 'none';
            this.errorsEl.textContent = '';
        }
    }

    reset() {
        this._runId++;
        this._paused = false;
        this._cursor = 0;
        this._compiled = null;
        this._lastCompiledCode = '';
        this._lastBeforeInsertCode = '';
        if (this.coachRestoreBtn) this.coachRestoreBtn.disabled = true;
        this.clearError();
        if (this.consoleEl) this.consoleEl.textContent = '';
        if (this.stepsEl) this.stepsEl.innerHTML = '';
        if (this.statusEl) this.statusEl.textContent = '写完代码后，点击“运行”或“单步”。';
    }

    insertCoachCode() {
        if (!this.codeEl) return;
        const c = this._activeChallenge;
        const snippet = (c.coach && c.coach.code) || '';
        if (!snippet) return;
        this._lastBeforeInsertCode = this.codeEl.value;
        this.codeEl.value = this._lastBeforeInsertCode.replace(/\/\/\s*TODO:.*$/m, snippet);
        if (this.coachRestoreBtn) this.coachRestoreBtn.disabled = false;
        this._compiled = null;
        if (this.statusEl) this.statusEl.textContent = '已填入提示代码，可运行验证。';
    }

    restoreBeforeInsert() {
        if (!this.codeEl) return;
        if (!this._lastBeforeInsertCode) return;
        this.codeEl.value = this._lastBeforeInsertCode;
        this._lastBeforeInsertCode = '';
        if (this.coachRestoreBtn) this.coachRestoreBtn.disabled = true;
        this._compiled = null;
        if (this.statusEl) this.statusEl.textContent = '已还原。';
    }

    compile() {
        const code = String(this.codeEl ? this.codeEl.value : '');
        const c = this._activeChallenge;
        const { steps, errors } = parseCoutStatements(code);
        if (errors && errors.length) {
            throw new Error(errors.join('\n'));
        }
        const expected = c.expected || '';
        return { steps, expected };
    }

    stepOnce() {
        try {
            this.clearError();
            const code = String(this.codeEl ? this.codeEl.value : '');
            if (!this._compiled || this._lastCompiledCode !== code) {
                this._compiled = this.compile();
                this._lastCompiledCode = code;
                this._cursor = 0;
                if (this.consoleEl) this.consoleEl.textContent = '';
                if (this.stepsEl) this.stepsEl.innerHTML = '';
            }
            const st = this._compiled.steps[this._cursor];
            if (!st) {
                const out = String(this.consoleEl ? this.consoleEl.textContent : '');
                if (out === this._compiled.expected) {
                    if (this.statusEl) this.statusEl.textContent = `✅ 通过：输出完全一致（长度 ${out.length}）`;
                } else {
                    if (this.statusEl) this.statusEl.textContent = `❌ 未通过：当前输出与目标不一致（当前长度 ${out.length}）`;
                }
                return;
            }
            if (st.kind === 'write') {
                if (this.consoleEl) this.consoleEl.textContent += st.text;
                if (this.stepsEl) {
                    const li = document.createElement('li');
                    li.textContent = `第 ${st.lineNo} 行：${st.explain}`;
                    this.stepsEl.appendChild(li);
                    li.scrollIntoView({ block: 'end' });
                }
            }
            this._cursor++;
        } catch (e) {
            this.showError(e && e.message ? e.message : '运行失败');
        }
    }

    async run() {
        const runId = ++this._runId;
        try {
            this.clearError();
            const code = String(this.codeEl ? this.codeEl.value : '');
            this._compiled = this.compile();
            this._lastCompiledCode = code;
            this._cursor = 0;
            if (this.consoleEl) this.consoleEl.textContent = '';
            if (this.stepsEl) this.stepsEl.innerHTML = '';
            if (this.statusEl) this.statusEl.textContent = '运行中...';

            const speed = Math.max(1, Math.min(5, Number(this.speedRange ? this.speedRange.value : 1) || 1));
            const delay = this.delayFromSpeed(speed);

            while (runId === this._runId) {
                const st = this._compiled.steps[this._cursor];
                if (!st) break;
                this.stepOnce();
                await new Promise(r => setTimeout(r, delay));
            }
            if (runId === this._runId) this.stepOnce(); // final check
        } catch (e) {
            this.showError(e && e.message ? e.message : '运行失败');
        }
    }
}


