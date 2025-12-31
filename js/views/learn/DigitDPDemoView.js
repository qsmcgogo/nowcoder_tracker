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
        defaults: { N: 234, K: 10 },
        coach: {
            subtitle: '先把状态写对：pos / sum / tight',
            say: '核心思路：从高位到低位枚举当前位 digit，累加 sum；tight=1 时上界是 N 的该位。',
            code:
`// C++ 版本（每行都有注释，配合右侧“单步/运行”高亮）\n\
\n\
long long dp[20][200];                 // dp[pos][sum]：tight=0 时的缓存（火力全开才安全复用）\n\
bool vis[20][200];                     // vis[pos][sum]：标记 dp 是否已经算过\n\
vector<int> digits;                    // N 的每一位（从高位到低位）\n\
int len, K;                            // len=位数，K=目标数位和\n\
\n\
long long dfs(int pos, int sum, bool tight) {                 // 从第 pos 位开始填，当前已累加 sum\n\
    if (pos == len) return (sum == K) ? 1LL : 0LL;            // ① 所有位填完：检查总数位和是否等于 K\n\
    if (!tight && vis[pos][sum]) return dp[pos][sum];         // ② tight=0：后面不受上界影响，可直接复用缓存\n\
    int up = tight ? digits[pos] : 9;                         // ③ 本位上界：受限=digits[pos]，火力全开=9\n\
    long long ans = 0;                                        // ④ 累加所有选择的方案数\n\
    for (int d = 0; d <= up; d++) {                           // ⑤ 枚举本位要填的数字 d\n\
        ans += dfs(pos + 1, sum + d, tight && (d == up));      // ⑥ 递归到下一位：d==up 才继续受限\n\
    }                                                         // ⑦ 枚举结束\n\
    if (!tight) { vis[pos][sum] = true; dp[pos][sum] = ans; } // ⑧ 只在 tight=0 时写缓存（否则受上界影响不能复用）\n\
    return ans;                                               // ⑨ 返回答案\n\
}`
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
            code:
`// C++ 版本（示意：遇到 digit=4 就跳过）\n\
\n\
long long dp2[20];                      // dp2[pos]：tight=0 时的缓存\n\
bool vis2[20];                          // vis2[pos]：标记 dp2 是否算过\n\
vector<int> digits;                     // N 的每一位（从高位到低位）\n\
int len;                                // 位数\n\
\n\
long long dfs(int pos, bool tight) {                        // 从第 pos 位开始填\n\
    if (pos == len) return 1LL;                             // ① 填完了：这是一种合法方案\n\
    if (!tight && vis2[pos]) return dp2[pos];               // ② tight=0：可复用缓存\n\
    int up = tight ? digits[pos] : 9;                       // ③ 本位上界\n\
    long long ans = 0;                                      // ④ 累加答案\n\
    for (int d = 0; d <= up; d++) {                         // ⑤ 枚举 d\n\
        if (d == 4) continue;                               // ⑥ 不允许出现 4：直接跳过\n\
        ans += dfs(pos + 1, tight && (d == up));            // ⑦ 递归下一位\n\
    }\n\
    if (!tight) { vis2[pos] = true; dp2[pos] = ans; }       // ⑧ tight=0 时写缓存\n\
    return ans;                                             // ⑨ 返回答案\n\
}`
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

function delayFromSpeed(speed) {
    const s = clampInt(speed, 1, 5);
    // 整体放慢：更适合演示“递归轨迹/步骤列表”
    // 1..5 => 650, 520, 420, 320, 240 (ms)
    return [650, 520, 420, 320, 240][s - 1];
}

function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
        this.backTutorialBtn = document.getElementById('digit-dp-demo-back-tutorial');
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
        this.visualEl = document.getElementById('digit-dp-demo-visual');
        this.errorsEl = document.getElementById('digit-dp-demo-errors');
        this.statusEl = document.getElementById('digit-dp-demo-status');
        this.runBtn = document.getElementById('digit-dp-demo-run');
        this.pauseBtn = document.getElementById('digit-dp-demo-pause');
        this.stepBtn = document.getElementById('digit-dp-demo-step');
        this.resetBtn = document.getElementById('digit-dp-demo-reset');

        this._runId = 0;
        this._cursor = 0;
        this._compiled = null; // { trace, answer, summary }
        this._activeChallenge = CHALLENGES[0];
        this._overviewPage = 0;
        this._isRunning = false;
        this._isPaused = false;
        this._speedTouched = false;
        this._viz = null; // { digits, len, N, K, stack, cache, lastEvent }
        this._activeCoachLine = null;

        this.init();
    }

    updatePauseBtn() {
        if (!this.pauseBtn) return;
        if (this._isRunning) {
            this.pauseBtn.disabled = false;
            this.pauseBtn.textContent = '暂停';
            return;
        }
        if (this._isPaused) {
            this.pauseBtn.disabled = false;
            this.pauseBtn.textContent = '继续';
            return;
        }
        this.pauseBtn.disabled = true;
        this.pauseBtn.textContent = '暂停';
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
        this.backTutorialBtn && this.backTutorialBtn.addEventListener('click', () => this.enterOverview());
        this.prevBtn && this.prevBtn.addEventListener('click', () => this.gotoOverviewPage(this._overviewPage - 1));
        this.nextBtn && this.nextBtn.addEventListener('click', () => this.gotoOverviewPage(this._overviewPage + 1));
        this.runBtn && this.runBtn.addEventListener('click', () => this.run());
        this.pauseBtn && this.pauseBtn.addEventListener('click', () => this.togglePause());
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

    resetViz() {
        const N = clampInt(this.nInput ? this.nInput.value : 0, 0, 1000000000);
        const digits = digitsOfN(N);
        const len = digits.length;
        const K = clampInt(this.kInput ? this.kInput.value : 0, 0, 9 * len);
        this._viz = {
            N,
            K,
            digits,
            len,
            stack: [], // [{pos,sum,tight,chosen?}]
            cache: new Map(), // key "pos|sum" or "pos" (when sum absent)
            lastEvent: null,
            lastCacheKey: null
        };
        this.renderVisual(null);
    }

    renderVisual(t) {
        if (!this.visualEl) return;
        if (!this._viz) this.resetViz();

        const v = this._viz;
        const digits = v.digits || [];
        const len = v.len || digits.length || 0;
        const top = v.stack.length ? v.stack[v.stack.length - 1] : null;

        const mode = top ? (top.tight ? '受限形态 tight=1' : '火力全开 tight=0') : '—';
        const pos = top && top.pos != null ? top.pos : 0;
        const sum = top && top.sum != null ? top.sum : null;

        const prefix = [];
        for (let i = 0; i < Math.min(pos, v.stack.length); i++) {
            const d = v.stack[i] && v.stack[i].chosen;
            prefix.push(d == null ? '_' : String(d));
        }

        const digitRow = digits.map((d, i) => {
            const isCur = (i === pos);
            const isDone = (i < pos);
            const bg = isCur ? 'background:#111827;color:#fff;border-color:#111827;' :
                (isDone ? 'background:rgba(37,99,235,0.10);border-color:rgba(37,99,235,0.18);' : '');
            const txt = (isDone ? (prefix[i] != null ? prefix[i] : '_') : String(d));
            return `<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9px;border:1px solid rgba(55,65,81,0.18);margin-right:6px;${bg}">${escHtml(txt)}</span>`;
        }).join('') || `<span style="color:#9ca3af;">（digits 为空）</span>`;

        const rawKey = (sum == null) ? String(pos) : `${pos}|${sum}`;
        const formatKey = (k) => {
            const s = String(k);
            if (s.includes('|')) {
                const [a, b] = s.split('|');
                return `dp[${a}][${b}]`;
            }
            return `dp[${s}]`;
        };
        const explainKey = (k, val) => {
            const s = String(k);
            if (s.includes('|')) {
                const [a, b] = s.split('|');
                const K = v.K;
                const need = (K != null) ? (Number(K) - Number(b)) : null;
                return `代表：从第 ${a} 位开始往后填（tight=0，后面可任意选 0..9），在当前已累加 sum=${b} 的前提下，让“后面这些位的数位和”恰好等于 ${need} 的方案数为 ${val}（等价于最终总和=K）。`;
            }
            // no-sum challenges
            return `代表：当 pos=${s} 且 tight=0（火力全开）时，后续满足条件的方案数为 ${val}。`;
        };

        const cached = v.cache.has(rawKey);
        const cachedVal = cached ? v.cache.get(rawKey) : null;

        const isSumDp = (sum != null) && (v.K != null);
        const focusRowPos = pos;
        const focusSum = sum;
        const maxSum = isSumDp ? Math.max(0, Math.min(Number(v.K), 9 * len)) : 0;

        // dp row heatmap for current pos (only for sum-DP)
        let heatmapHtml = '';
        if (isSumDp) {
            const vals = [];
            for (let s = 0; s <= maxSum; s++) {
                const k = `${focusRowPos}|${s}`;
                const vv = v.cache.has(k) ? Number(v.cache.get(k)) : null;
                if (vv != null && !Number.isNaN(vv)) vals.push(vv);
            }
            const maxVal = Math.max(1, ...vals);
            const lastKey = v.lastCacheKey ? String(v.lastCacheKey) : '';

            const cells = [];
            for (let s = 0; s <= maxSum; s++) {
                const k = `${focusRowPos}|${s}`;
                const has = v.cache.has(k);
                const vv = has ? Number(v.cache.get(k)) : null;
                const intensity = has ? (Math.log1p(Math.max(0, vv)) / Math.log1p(maxVal)) : 0;
                const bg = has ? `background: rgba(37,99,235, ${0.08 + 0.30 * intensity});` : 'background: rgba(17,24,39,0.03);';
                const border =
                    (k === lastKey) ? 'border: 2px solid rgba(124,58,237,0.85);' :
                    (s === focusSum ? 'border: 2px solid rgba(17,24,39,0.85);' : 'border: 1px solid rgba(55,65,81,0.16);');
                const need = Number(v.K) - s;
                const title = `dp[${focusRowPos}][${s}] = ${has ? vv : '(未缓存)'}\n含义：从第 ${focusRowPos} 位开始往后填（tight=0），当前 sum=${s}，需要后面数位和=K-sum=${need}`;
                cells.push(
                    `<div title="${escHtml(title)}" style="width:54px;height:46px;border-radius:12px;${border}${bg}display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
                      <div style="font-size:11px;color:#6b7280;font-variant-numeric: tabular-nums;">sum=${s}</div>
                      <div style="font-size:12px;font-weight:900;color:#111827;font-variant-numeric: tabular-nums;">${has ? escHtml(vv) : '—'}</div>
                    </div>`
                );
            }

            heatmapHtml = `
              <div style="margin-bottom:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                  <div style="font-weight:900;color:#111827;">dp 表（当前行：pos=${escHtml(focusRowPos)}，sum=0..${escHtml(maxSum)}）</div>
                  <div style="color:#6b7280;font-size:12px;">颜色越深 = 值越大；紫框=最近一次写入/命中；黑框=当前关注 sum</div>
                </div>
                <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">
                  ${cells.join('')}
                </div>
              </div>
            `;
        }

        // Recent cache entries (last 8)
        const entries = Array.from(v.cache.entries()).slice(-8).reverse().map(([k, val]) => {
            return `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:12px; color:#111827;">
              <div><span style="color:#6b7280;">${escHtml(formatKey(k))}</span> = <b>${escHtml(val)}</b></div>
              <div style="margin-top:2px; color:#6b7280; font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
                ${escHtml(explainKey(k, val))}
              </div>
            </div>`;
        }).join('') || `<div style="color:#9ca3af;">（暂无缓存：还没进入 tight=0 或还没写入）</div>`;

        const last = v.lastEvent ? escHtml(v.lastEvent) : '—';
        const stackLines = v.stack.slice(-6).map((f, i) => {
            const idx = v.stack.length - Math.min(6, v.stack.length) + i;
            const s2 = f.sum == null ? '' : `, sum=${f.sum}`;
            const ch = f.chosen == null ? '' : `, d=${f.chosen}`;
            return `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color:#111827;">
              #${idx}: dfs(pos=${f.pos}${s2}, tight=${f.tight ? 1 : 0}${ch})
            </div>`;
        }).join('') || `<div style="color:#9ca3af;">（尚未进入 dfs）</div>`;

        const summary = `
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;">
            <div style="flex: 1 1 360px; min-width: 320px;">
              <div style="font-weight:800;color:#111827;margin-bottom:6px;">X 的状态（digits）</div>
              <div style="margin-bottom:6px;">${digitRow}</div>
              <div style="color:#6b7280;">
                当前形态：<b style="color:#111827;">${escHtml(mode)}</b>；
                当前状态：<b style="color:#111827;">dfs(pos=${pos}${sum == null ? '' : `, sum=${sum}`}, tight=${top && top.tight ? 1 : 0})</b>
              </div>
              <div style="color:#6b7280;margin-top:4px;">
                缓存关注点：<b style="color:#111827;">${escHtml(formatKey(rawKey))}</b>
                ${cached ? `已存在（值=${escHtml(cachedVal)}）` : `未缓存`}
              </div>
              <div style="margin-top:8px;padding:8px 10px;border-radius:12px;border:1px solid rgba(55,65,81,0.14);background:rgba(255,255,255,0.75);">
                <div style="font-weight:800;color:#111827;margin-bottom:4px;">本步图解</div>
                <div style="color:#374151;">${escHtml(last)}</div>
              </div>
            </div>
            <div style="flex: 1 1 280px; min-width: 260px;">
              <div style="font-weight:800;color:#111827;margin-bottom:6px;">dfs 调用栈（最近几层）</div>
              <div style="padding:8px 10px;border-radius:12px;border:1px solid rgba(55,65,81,0.14);background:rgba(255,255,255,0.75);">
                ${stackLines}
              </div>
              <div style="font-weight:800;color:#111827;margin:10px 0 6px;">dp 缓存（最近写入/命中）</div>
              <div style="padding:8px 10px;border-radius:12px;border:1px solid rgba(55,65,81,0.14);background:rgba(255,255,255,0.75);">
                ${heatmapHtml}
                ${entries}
              </div>
            </div>
          </div>
        `;
        this.visualEl.innerHTML = summary;
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
        if (this.speedRange && !this._speedTouched) this.speedRange.value = '1';
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
        if (this.coachCode) this.renderCoachCode(c.coach.code || '');
        this.reset();
    }

    renderCoachCode(code) {
        if (!this.coachCode) return;
        const raw = String(code || '');
        const lines = raw.split('\n');
        const html = lines.map((line, i) => {
            const ln = i + 1;
            return `<div class="code-line" data-ln="${ln}"><span class="code-ln">${ln}</span><span class="code-src">${escHtml(line)}</span></div>`;
        }).join('');
        this.coachCode.classList.add('code-debug');
        this.coachCode.innerHTML = html;
        this.highlightCoachLine(null);
    }

    highlightCoachLine(ln) {
        if (!this.coachCode) return;
        const next = (ln == null) ? null : Number(ln);
        if (this._activeCoachLine === next) return;
        this._activeCoachLine = next;
        const nodes = this.coachCode.querySelectorAll('.code-line');
        nodes.forEach((el) => {
            const v = Number(el.getAttribute('data-ln'));
            el.classList.toggle('active', next != null && v === next);
        });
    }

    getCoachLineForTrace(t) {
        const id = this._activeChallenge ? this._activeChallenge.id : 'sum';
        if (!t) return null;

        // 注意：这里的行号与 CHALLENGES[*].coach.code 的“按行渲染结果”一致（包含空行）
        if (id === 'sum') {
            if (t.kind === 'enter') return 8;       // long long dfs(...)
            if (t.kind === 'memo_hit') return 10;   // if (!tight && vis...) return dp...
            if (t.kind === 'choose') return 14;     // ans += dfs(...)
            if (t.kind === 'memo_store') return 16; // 写缓存
            if (t.kind === 'return') {
                if (this._viz && typeof t.pos === 'number' && t.pos === this._viz.len) return 9; // base case
                return 17; // return ans
            }
            return 8;
        }
        if (id === 'no4') {
            if (t.kind === 'enter') return 8;
            if (t.kind === 'memo_hit') return 10;
            if (t.kind === 'skip') return 14;      // if (d==4) continue;
            if (t.kind === 'choose') return 15;    // ans += dfs(...)
            if (t.kind === 'memo_store') return 17;
            if (t.kind === 'return') {
                if (this._viz && typeof t.pos === 'number' && t.pos === this._viz.len) return 9;
                return 18;
            }
            return 8;
        }
        return null;
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
        this._isRunning = false;
        this._isPaused = false;
        this._cursor = 0;
        this._compiled = null;
        this.clearError();
        if (this.consoleEl) this.consoleEl.textContent = '';
        if (this.stepsEl) this.stepsEl.innerHTML = '';
        if (this.statusEl) this.statusEl.textContent = '选择参数后，点击“运行”或“单步”。';
        this.updatePauseBtn();
        this.resetViz();
        this.highlightCoachLine(null);
    }

    togglePause() {
        // running -> pause
        if (this._isRunning) {
            this._runId++; // stop the current loop
            this._isRunning = false;
            this._isPaused = true;
            if (this.statusEl) this.statusEl.textContent = '已暂停：点击“继续”从当前步骤接着跑。';
            this.updatePauseBtn();
            return;
        }
        // paused -> resume
        if (this._isPaused) {
            this._isPaused = false;
            this._isRunning = true;
            this.updatePauseBtn();
            this.runContinue();
        }
    }

    async runContinue() {
        const runId = ++this._runId;
        try {
            this.clearError();
            if (!this._compiled) {
                this._compiled = this.compile();
                this._cursor = 0;
                if (this.consoleEl) this.consoleEl.textContent = '';
                if (this.stepsEl) this.stepsEl.innerHTML = '';
            }
            if (this.statusEl) this.statusEl.textContent = `运行中：${this._compiled.summary}`;
            const speed = clampInt(this.speedRange ? this.speedRange.value : 1, 1, 5);
            const delay = delayFromSpeed(speed);

            while (runId === this._runId) {
                const t = this._compiled.trace[this._cursor];
                if (!t) break;
                this.stepOnce();
                await new Promise(r => setTimeout(r, delay));
            }

            if (runId === this._runId) {
                this._isRunning = false;
                this._isPaused = false;
                this.updatePauseBtn();
                if (this.statusEl) {
                    this.statusEl.textContent = `完成！答案 = ${this._compiled.answer}（${this._compiled.summary}）`;
                }
            }
        } catch (e) {
            this._isRunning = false;
            this._isPaused = false;
            this.updatePauseBtn();
            this.showError(e && e.message ? e.message : '运行失败');
        }
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
                this.resetViz();
                this.highlightCoachLine(null);
            }
            const t = this._compiled.trace[this._cursor];
            if (!t) {
                if (this.statusEl) this.statusEl.textContent = `完成！答案 = ${this._compiled.answer}（${this._compiled.summary}）`;
                this._viz && (this._viz.lastEvent = '完成：递归已结束');
                this.renderVisual(null);
                this.highlightCoachLine(null);
                return;
            }
            const line = this.renderTraceStep(t);
            if (this.consoleEl) {
                this.consoleEl.textContent += (this.consoleEl.textContent ? '\n' : '') + line;
            }
            if (this.stepsEl) {
                const li = document.createElement('li');
                const activeLn = this.getCoachLineForTrace(t);
                li.textContent = activeLn ? `[L${activeLn}] ${line}` : line;
                const prev = this.stepsEl.querySelector('li.is-active');
                if (prev) prev.classList.remove('is-active');
                li.classList.add('is-active');
                this.stepsEl.appendChild(li);
                // keep latest visible
                li.scrollIntoView({ block: 'end' });
            }

            // update viz state (stack/cache) for newbies
            if (!this._viz) this.resetViz();
            if (t.kind === 'enter') {
                this._viz.stack.push({ pos: t.pos, sum: t.sum, tight: !!t.tight, chosen: null });
                this._viz.lastEvent = `进入 dfs(pos=${t.pos}${t.sum != null ? `, sum=${t.sum}` : ''}, tight=${t.tight ? 1 : 0})`;
            } else if (t.kind === 'choose') {
                const top = this._viz.stack.length ? this._viz.stack[this._viz.stack.length - 1] : null;
                if (top) top.chosen = t.d;
                const up = t.up != null ? t.up : (t.tight ? (this._viz.digits && this._viz.digits[t.pos]) : 9);
                const nextTight = !!t.tight && t.d === up;
                this._viz.lastEvent = `枚举本位：d=${t.d}（up=${up}），nextTight=${nextTight ? 1 : 0}`;
            } else if (t.kind === 'memo_store') {
                const key = (t.sum != null) ? `${t.pos}|${t.sum}` : String(t.pos);
                this._viz.cache.set(key, t.value);
                this._viz.lastCacheKey = key;
                if (key.includes('|')) {
                    const [p, s] = key.split('|');
                    const need = (this._viz && this._viz.K != null) ? (Number(this._viz.K) - Number(s)) : null;
                    this._viz.lastEvent = `写入缓存：dp[${p}][${s}] = ${t.value}（tight=0：后面任意选；需要后面数位和=K-sum=${need}）`;
                } else {
                    this._viz.lastEvent = `写入缓存：dp[${key}] = ${t.value}（仅 tight=0 时安全复用）`;
                }
            } else if (t.kind === 'memo_hit') {
                const key = (t.sum != null) ? `${t.pos}|${t.sum}` : String(t.pos);
                this._viz.lastCacheKey = key;
                if (key.includes('|')) {
                    const [p, s] = key.split('|');
                    const need = (this._viz && this._viz.K != null) ? (Number(this._viz.K) - Number(s)) : null;
                    this._viz.lastEvent = `命中缓存：dp[${p}][${s}] = ${t.value}（tight=0：需要后面数位和=K-sum=${need}，直接返回）`;
                } else {
                    this._viz.lastEvent = `命中缓存：dp[${key}] = ${t.value}（直接返回，跳过重复计算）`;
                }
            } else if (t.kind === 'return') {
                this._viz.lastEvent = `返回：dfs(...) = ${t.value}`;
                if (this._viz.stack.length) this._viz.stack.pop();
            } else if (t.kind === 'skip') {
                this._viz.lastEvent = `跳过：d=${t.d}（原因：${t.reason}）`;
            } else {
                this._viz.lastEvent = `事件：${t.kind}`;
            }
            this.renderVisual(t);
            this.highlightCoachLine(this.getCoachLineForTrace(t));

            this._cursor++;
        } catch (e) {
            this.showError(e && e.message ? e.message : '运行失败');
        }
    }

    async run() {
        const runId = ++this._runId;
        try {
            this.clearError();
            this._isRunning = true;
            this._isPaused = false;
            this.updatePauseBtn();
            this._compiled = this.compile();
            this._cursor = 0;
            if (this.consoleEl) this.consoleEl.textContent = '';
            if (this.stepsEl) this.stepsEl.innerHTML = '';
            if (this.statusEl) this.statusEl.textContent = `运行中：${this._compiled.summary}`;

            const speed = clampInt(this.speedRange ? this.speedRange.value : 1, 1, 5);
            const delay = delayFromSpeed(speed);

            while (runId === this._runId) {
                const t = this._compiled.trace[this._cursor];
                if (!t) break;
                this.stepOnce();
                await new Promise(r => setTimeout(r, delay));
            }
            if (runId === this._runId) {
                this._isRunning = false;
                this._isPaused = false;
                this.updatePauseBtn();
                if (this.statusEl) {
                    this.statusEl.textContent = `完成！答案 = ${this._compiled.answer}（${this._compiled.summary}）`;
                }
            }
        } catch (e) {
            this._isRunning = false;
            this._isPaused = false;
            this.updatePauseBtn();
            this.showError(e && e.message ? e.message : '运行失败');
        }
    }
}


