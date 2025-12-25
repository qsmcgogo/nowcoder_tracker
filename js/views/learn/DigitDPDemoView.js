/**
 * 学习 Demo：数位 DP（MVP）
 * - 目标：用“状态递归 + 记忆化 + 轨迹回放”讲清楚数位DP的核心
 * - 说明：这是可视化模拟器，不是竞赛模板代码生成器
 */
import { eventBus, EVENTS } from '../../events/EventBus.js';

const CHALLENGES = [
    {
        id: 'sum',
        title: '关卡1：统计数位和 = K 的个数',
        desc: '统计区间 [0, N] 中“数位和 = K”的数字个数（含前导零等价于短位数）。',
        requiresK: true,
        defaults: { N: 5000, K: 10 },
        coach: {
            subtitle: '先把状态写对：pos / sum / tight',
            say: '核心思路：从高位到低位枚举当前位 digit，累加 sum；tight=1 时上界是 N 的该位。',
            code: `// dfs(pos, sum, tight)\n// 返回：从 pos 开始填到末尾，且数位和最终=K 的方案数\nif (pos==len) return (sum==K);\nup = tight ? digits[pos] : 9;\nans = 0;\nfor d in [0..up]: ans += dfs(pos+1, sum+d, tight && d==up);\nif (!tight) memo[pos][sum] = ans;`
        }
    },
    {
        id: 'no4',
        title: '关卡2：统计不包含数字 4 的个数',
        desc: '统计区间 [0, N] 中“不含数字 4”的数字个数。',
        requiresK: false,
        defaults: { N: 200000, K: 0 },
        coach: {
            subtitle: '状态更简单：pos / tight / ok',
            say: '只要在枚举 d 时跳过 4 即可。非 tight 的状态可以记忆化复用。',
            code: `// dfs(pos, tight)\n// 返回：从 pos 开始填到末尾，且后续不出现4 的方案数\nif (pos==len) return 1;\nup = tight ? digits[pos] : 9;\nans = 0;\nfor d in [0..up]: if (d!=4) ans += dfs(pos+1, tight && d==up);\nif (!tight) memo[pos] = ans;`
        }
    }
];

function clampInt(v, lo, hi) {
    const n = Number(v);
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, Math.trunc(n)));
}

function digitsOfN(N) {
    const s = String(Math.max(0, Math.trunc(N)));
    return s.split('').map(ch => Number(ch));
}

export class DigitDPDemoView {
    constructor(elements, state, apiService) {
        this.elements = elements;
        this.state = state;
        this.apiService = apiService;

        this.modal = document.getElementById('digit-dp-demo-modal');
        this.overview = document.getElementById('digit-dp-demo-overview');
        this.startBtn = document.getElementById('digit-dp-demo-start');
        this.layout = this.modal ? this.modal.querySelector('.learning-demo-layout') : null;
        this.actionsBar = this.modal ? this.modal.querySelector('.learning-demo-actions') : null;
        this.overviewPages = this.overview ? Array.from(this.overview.querySelectorAll('.learning-demo-overview__page')) : [];
        this.prevBtn = document.getElementById('digit-dp-demo-prev');
        this.nextBtn = document.getElementById('digit-dp-demo-next');
        this.pageIndicator = document.getElementById('digit-dp-demo-page-indicator');
        this.titleEl = document.getElementById('digit-dp-demo-title');
        this.closeBtn = document.getElementById('digit-dp-demo-close');
        this.challengeSelect = document.getElementById('digit-dp-demo-challenge');
        this.speedRange = document.getElementById('digit-dp-demo-speed');

        this.nInput = document.getElementById('digit-dp-demo-n');
        this.kInput = document.getElementById('digit-dp-demo-k');
        this.kWrap = document.getElementById('digit-dp-demo-k-wrap');

        this.coachSubtitle = document.getElementById('digit-dp-demo-coach-subtitle');
        this.coachSay = document.getElementById('digit-dp-demo-coach-say');
        this.coachCode = document.getElementById('digit-dp-demo-coach-code');

        this.consoleEl = document.getElementById('digit-dp-demo-console');
        this.stepsEl = document.getElementById('digit-dp-demo-steps');
        this.errorsEl = document.getElementById('digit-dp-demo-errors');
        this.statusEl = document.getElementById('digit-dp-demo-status');
        this.runBtn = document.getElementById('digit-dp-demo-run');
        this.stepBtn = document.getElementById('digit-dp-demo-step');
        this.resetBtn = document.getElementById('digit-dp-demo-reset');

        this._runId = 0;
        this._cursor = 0;
        this._compiled = null; // { trace, answer, summary }
        this._activeChallenge = CHALLENGES[0];
        this._overviewPage = 0;

        this.init();
    }

    init() {
        if (!this.modal) return;

        // init challenge select
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
        this.prevBtn && this.prevBtn.addEventListener('click', () => this.gotoOverviewPage(this._overviewPage - 1));
        this.nextBtn && this.nextBtn.addEventListener('click', () => this.gotoOverviewPage(this._overviewPage + 1));
        this.runBtn && this.runBtn.addEventListener('click', () => this.run());
        this.stepBtn && this.stepBtn.addEventListener('click', () => this.stepOnce());
        this.resetBtn && this.resetBtn.addEventListener('click', () => this.reset());

        // outside click close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // subscribe open
        eventBus.on(EVENTS.OPEN_DIGIT_DP_DEMO, (payload) => this.open(payload));

        // default challenge
        this.setChallenge(this._activeChallenge);
    }

    open(payload) {
        if (!this.modal) return;
        const title = payload && payload.title ? String(payload.title) : '学习 Demo：数位DP';
        if (this.titleEl) this.titleEl.textContent = title;
        this.modal.style.display = 'flex';
        this.enterOverview();
    }

    close() {
        if (!this.modal) return;
        this.modal.style.display = 'none';
    }

    enterOverview() {
        if (this.overview) this.overview.style.display = 'flex';
        if (this.layout) this.layout.style.display = 'none';
        if (this.actionsBar) this.actionsBar.style.display = 'none';
        this._overviewPage = 0;
        this.gotoOverviewPage(0);
        this.reset();
        if (this.statusEl) this.statusEl.textContent = '先把状态/dfs/记忆化看明白，再开始练习。';
    }

    enterPractice() {
        if (this.overview) this.overview.style.display = 'none';
        if (this.layout) this.layout.style.display = 'flex';
        if (this.actionsBar) this.actionsBar.style.display = 'flex';
        this.reset();
        try { this.nInput && this.nInput.focus(); } catch (_) {}
    }

    gotoOverviewPage(idx) {
        const pages = this.overviewPages || [];
        const total = pages.length || 0;
        if (total <= 0) return;
        const next = Math.max(0, Math.min(total - 1, idx));
        this._overviewPage = next;
        pages.forEach((el, i) => {
            el.style.display = (i === next) ? 'block' : 'none';
        });
        if (this.pageIndicator) this.pageIndicator.textContent = `${next + 1} / ${total}`;
        if (this.prevBtn) this.prevBtn.disabled = (next === 0);
        if (this.nextBtn) this.nextBtn.disabled = (next === total - 1);
    }

    setChallenge(c) {
        this._activeChallenge = c;
        // toggle K input
        const needK = !!c.requiresK;
        if (this.kWrap) this.kWrap.style.display = needK ? 'flex' : 'none';
        // apply defaults
        if (this.nInput) this.nInput.value = String(c.defaults.N);
        if (this.kInput) this.kInput.value = String(c.defaults.K);
        // coach
        if (this.coachSubtitle) this.coachSubtitle.textContent = c.coach.subtitle || '';
        if (this.coachSay) this.coachSay.textContent = c.coach.say || '';
        if (this.coachCode) this.coachCode.textContent = c.coach.code || '';
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
        this._cursor = 0;
        this._compiled = null;
        this.clearError();
        if (this.consoleEl) this.consoleEl.textContent = '';
        if (this.stepsEl) this.stepsEl.innerHTML = '';
        if (this.statusEl) this.statusEl.textContent = '选择参数后，点击“运行”或“单步”。';
    }

    compile() {
        const c = this._activeChallenge;
        const N = clampInt(this.nInput ? this.nInput.value : 0, 0, 1000000000);
        const digits = digitsOfN(N);
        const len = digits.length;
        const K = clampInt(this.kInput ? this.kInput.value : 0, 0, 9 * len);

        // demo guard: avoid huge traces
        if (len > 10) {
            throw new Error('N 位数过长（>10位）。为了演示可视化，请使用更小的 N。');
        }
        if (c.id === 'sum' && K > 9 * len) {
            throw new Error(`K 不合法：最大为 ${9 * len}`);
        }

        const trace = [];
        const push = (kind, obj) => trace.push({ kind, ...obj });

        let memoHits = 0;
        let memoStores = 0;

        if (c.id === 'sum') {
            const memo = new Map(); // key pos|sum -> val (only when tight=0)
            const dfs = (pos, sum, tight) => {
                push('enter', { pos, sum, tight });
                if (pos === len) {
                    const v = (sum === K) ? 1 : 0;
                    push('return', { pos, sum, tight, value: v });
                    return v;
                }
                if (!tight) {
                    const key = `${pos}|${sum}`;
                    if (memo.has(key)) {
                        memoHits++;
                        const v = memo.get(key);
                        push('memo_hit', { pos, sum, value: v });
                        push('return', { pos, sum, tight, value: v });
                        return v;
                    }
                }
                const up = tight ? digits[pos] : 9;
                let ans = 0;
                for (let d = 0; d <= up; d++) {
                    push('choose', { pos, sum, tight, d, up });
                    ans += dfs(pos + 1, sum + d, tight && d === up);
                }
                if (!tight) {
                    memoStores++;
                    memo.set(`${pos}|${sum}`, ans);
                    push('memo_store', { pos, sum, value: ans });
                }
                push('return', { pos, sum, tight, value: ans });
                return ans;
            };
            const answer = dfs(0, 0, true);
            return {
                answer,
                trace,
                summary: `N=${N}, K=${K}, len=${len}, memo_hit=${memoHits}, memo_store=${memoStores}`
            };
        }

        // no4
        {
            const memo = new Map(); // key pos -> val (only when tight=0)
            const dfs = (pos, tight) => {
                push('enter', { pos, tight });
                if (pos === len) {
                    push('return', { pos, tight, value: 1 });
                    return 1;
                }
                if (!tight) {
                    const key = String(pos);
                    if (memo.has(key)) {
                        memoHits++;
                        const v = memo.get(key);
                        push('memo_hit', { pos, value: v });
                        push('return', { pos, tight, value: v });
                        return v;
                    }
                }
                const up = tight ? digits[pos] : 9;
                let ans = 0;
                for (let d = 0; d <= up; d++) {
                    if (d === 4) {
                        push('skip', { pos, tight, d, reason: 'digit=4' });
                        continue;
                    }
                    push('choose', { pos, tight, d, up });
                    ans += dfs(pos + 1, tight && d === up);
                }
                if (!tight) {
                    memoStores++;
                    memo.set(String(pos), ans);
                    push('memo_store', { pos, value: ans });
                }
                push('return', { pos, tight, value: ans });
                return ans;
            };
            const answer = dfs(0, true);
            return {
                answer,
                trace,
                summary: `N=${N}, len=${len}, memo_hit=${memoHits}, memo_store=${memoStores}`
            };
        }
    }

    renderTraceStep(t) {
        const fmtTight = (x) => (x ? 'tight=1' : 'tight=0');
        if (t.kind === 'enter') {
            if (t.sum != null) return `进入 dfs(pos=${t.pos}, sum=${t.sum}, ${fmtTight(t.tight)})`;
            return `进入 dfs(pos=${t.pos}, ${fmtTight(t.tight)})`;
        }
        if (t.kind === 'choose') {
            if (t.sum != null) return `  选择 d=${t.d}（上界 up=${t.up}），sum -> ${t.sum + t.d}`;
            return `  选择 d=${t.d}（上界 up=${t.up}）`;
        }
        if (t.kind === 'skip') {
            return `  跳过 d=${t.d}（原因：${t.reason}）`;
        }
        if (t.kind === 'memo_hit') {
            if (t.sum != null) return `命中记忆化：pos=${t.pos}, sum=${t.sum} -> ${t.value}`;
            return `命中记忆化：pos=${t.pos} -> ${t.value}`;
        }
        if (t.kind === 'memo_store') {
            if (t.sum != null) return `写入记忆化：pos=${t.pos}, sum=${t.sum} = ${t.value}`;
            return `写入记忆化：pos=${t.pos} = ${t.value}`;
        }
        if (t.kind === 'return') {
            if (t.sum != null) return `返回 dfs(pos=${t.pos}, sum=${t.sum}, ${fmtTight(t.tight)}) = ${t.value}`;
            return `返回 dfs(pos=${t.pos}, ${fmtTight(t.tight)}) = ${t.value}`;
        }
        return JSON.stringify(t);
    }

    stepOnce() {
        try {
            this.clearError();
            if (!this._compiled) {
                this._compiled = this.compile();
                this._cursor = 0;
                if (this.consoleEl) this.consoleEl.textContent = '';
                if (this.stepsEl) this.stepsEl.innerHTML = '';
                if (this.statusEl) this.statusEl.textContent = `已编译：${this._compiled.summary}`;
            }
            const t = this._compiled.trace[this._cursor];
            if (!t) {
                if (this.statusEl) this.statusEl.textContent = `完成！答案 = ${this._compiled.answer}（${this._compiled.summary}）`;
                return;
            }
            const line = this.renderTraceStep(t);
            if (this.consoleEl) {
                this.consoleEl.textContent += (this.consoleEl.textContent ? '\n' : '') + line;
            }
            if (this.stepsEl) {
                const li = document.createElement('li');
                li.textContent = line;
                this.stepsEl.appendChild(li);
                // keep latest visible
                li.scrollIntoView({ block: 'end' });
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
            this._compiled = this.compile();
            this._cursor = 0;
            if (this.consoleEl) this.consoleEl.textContent = '';
            if (this.stepsEl) this.stepsEl.innerHTML = '';
            if (this.statusEl) this.statusEl.textContent = `运行中：${this._compiled.summary}`;

            const speed = clampInt(this.speedRange ? this.speedRange.value : 3, 1, 5);
            const delay = 260 - (speed - 1) * 45; // 260..80

            while (runId === this._runId) {
                const t = this._compiled.trace[this._cursor];
                if (!t) break;
                this.stepOnce();
                await new Promise(r => setTimeout(r, delay));
            }
            if (runId === this._runId && this.statusEl) {
                this.statusEl.textContent = `完成！答案 = ${this._compiled.answer}（${this._compiled.summary}）`;
            }
        } catch (e) {
            this.showError(e && e.message ? e.message : '运行失败');
        }
    }
}


