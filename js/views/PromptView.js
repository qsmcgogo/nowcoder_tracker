/**
 * Prompt 视图（面向 prompt 测试人员的入口）
 * 当前：先管理员可见；后续可改为后端资格校验
 *
 * 功能（第一阶段：传统 prompt 题目）
 * - 选择题目
 * - 查看题目说明 + 样例输入/输出
 * - 编辑 Prompt
 * - 一键评测并查看通过率与失败用例提示
 */

export class PromptView {
    constructor(elements, state, apiService) {
        this.container = elements.promptContainer;
        this.state = state;
        this.apiService = apiService;

        // sub tab: traditional | puzzle | code | rules
        this.subTab = localStorage.getItem('prompt_subtab') || 'puzzle'; // traditional | puzzle | code | rules

        this.challenges = [];
        this.selectedId = '';
        this.running = false;

        // AI 编程题（MVP）状态
        this.codegenRunning = false;
        this.evalRunning = false;
        this.codegenCode = '';
        this.codegenLang = 'python';
        this.codegenTokens = 0;
        this.codegenMeta = null;
        this.promptScoreTokens = 0;

        // Judge polling state
        this.judgePolling = false;
        this.lastPromptOnlyScoreData = null; // {quality, originality}

        // Modal
        this.activeModalId = 'prompt-code-eval-modal';

        // Code problem selection
        this.selectedCodeProblemId = localStorage.getItem('prompt_code_problem_id') || 'reverse_output_10ints';

        // AI 约束型解谜
        this.aiPuzzles = [];
        this.aiPuzzleTotal = 0;
        this.aiPuzzlePage = 1;
        this.aiPuzzlePageSize = 20;
        this.aiPuzzleOrderBy = localStorage.getItem('ai_puzzle_order_by') || 'id';
        this.aiPuzzleOrder = localStorage.getItem('ai_puzzle_order') || 'desc';
        this.aiPuzzleSelectedId = localStorage.getItem('ai_puzzle_selected_id') || '';
        this.aiPuzzleDetail = null;
        this.aiPuzzleSubmitting = false;
        this.aiPuzzleLastResult = null;
        this.aiPuzzleHistory = [];
        this.aiPuzzleLeaderboard = [];
        this.aiPuzzleSideTab = localStorage.getItem('ai_puzzle_side_tab') || 'records';
    }

    render() {
        if (!this.container) return;


        this.container.innerHTML = `
            <div class="achv-overview-card" style="margin-top:8px;">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <div style="font-size: 18px; font-weight: 900; color:#111827;">🧪 Prompt 评测</div>
                    <div style="font-size: 12px; color:#6b7280;">传统 Prompt / 约束解谜 / AI 编程题</div>
                </div>

                <div style="margin-top: 12px; display:grid; grid-template-columns: 220px 1fr; gap: 12px; align-items:start;">
                    <!-- Left: tabs -->
                    <div style="border:1px solid #f0f0f0; border-radius: 12px; background:#fff; overflow:hidden;">
                        <div style="padding: 10px 12px; border-bottom:1px solid #f0f0f0; font-size: 13px; font-weight: 800; color:#111827;">导航</div>
                        <div style="padding: 10px 12px; display:flex; flex-direction:column; gap:8px;">
                            <button id="prompt-subtab-traditional" class="admin-btn ${this.subTab === 'traditional' ? '' : 'modal-secondary'}" type="button" style="width:100%; justify-content:center;">传统 Prompt 题</button>
                            <button id="prompt-subtab-puzzle" class="admin-btn ${this.subTab === 'puzzle' ? '' : 'modal-secondary'}" type="button" style="width:100%; justify-content:center;">约束型解谜</button>
                            <button id="prompt-subtab-code" class="admin-btn ${this.subTab === 'code' ? '' : 'modal-secondary'}" type="button" style="width:100%; justify-content:center;">AI 编程题</button>
                            <button id="prompt-subtab-rules" class="admin-btn ${this.subTab === 'rules' ? '' : 'modal-secondary'}" type="button" style="width:100%; justify-content:center;">规则 / 提示</button>
                        </div>
                    </div>

                    <!-- Right: content -->
                    <div>
                        <div id="prompt-panel-traditional" style="display:${this.subTab === 'traditional' ? 'grid' : 'none'}; grid-template-columns: 360px 1fr; gap: 12px; align-items:start;">
                    <!-- Left: 题目列表 -->
                    <div style="border:1px solid #f0f0f0; border-radius: 12px; background:#fff; overflow:hidden;">
                        <div style="padding: 10px 12px; border-bottom:1px solid #f0f0f0; font-size: 13px; font-weight: 800; color:#111827;">题目</div>
                        <div style="padding: 10px 12px;">
                            <select id="prompt-challenge-select" style="width:100%; padding: 10px 10px; border:1px solid #ddd; border-radius: 10px; font-size: 13px;">
                                <option value="">（加载中...）</option>
                            </select>
                            <div id="prompt-challenge-desc" style="margin-top: 10px; font-size: 13px; color:#374151; line-height: 1.6;"></div>
                        </div>
                        <div style="padding: 0 12px 12px 12px;">
                            <div style="font-size: 12px; color:#666; margin-bottom: 6px;">样例输入</div>
                            <pre id="prompt-sample-input" style="margin:0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 10px; max-height: 140px; overflow:auto;"></pre>
                            <div style="margin-top: 10px; font-size: 12px; color:#666; margin-bottom: 6px;">样例输出（期望）</div>
                            <pre id="prompt-sample-output" style="margin:0; white-space:pre-wrap; word-break:break-word; background:#111827; color:#f9fafb; padding: 10px; border-radius: 10px; max-height: 140px; overflow:auto;"></pre>
                        </div>
                    </div>

                    <!-- Right: 编辑与评测 -->
                    <div style="border:1px solid #f0f0f0; border-radius: 12px; background:#fff; overflow:hidden;">
                        <div style="padding: 10px 12px; border-bottom:1px solid #f0f0f0; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                            <div style="font-size: 13px; font-weight: 800; color:#111827;">提交 Prompt</div>
                            <div style="flex:1;"></div>
                            <button id="prompt-refresh-btn" class="admin-btn modal-secondary" type="button">刷新题库</button>
                            <button id="prompt-run-btn" class="admin-btn" type="button">开始评测</button>
                        </div>
                        <div style="padding: 12px;">
                            <textarea id="prompt-textarea" rows="10" placeholder="在这里编写 Prompt（建议：明确输出格式、禁止多余输出、处理缺失信息等）"
                                style="width:100%; padding: 10px; border:1px solid #ddd; border-radius: 12px; font-size: 13px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;"></textarea>

                            <div id="prompt-error" style="margin-top: 10px; font-size: 13px; color:#ff4d4f; display:none;"></div>

                            <div id="prompt-result" style="margin-top: 12px; display:none; border:1px solid #f0f0f0; border-radius: 12px; padding: 12px; background: linear-gradient(180deg, #fbfdff, #ffffff);"></div>

                            <div style="margin-top: 12px;">
                                <div style="font-size: 13px; font-weight: 800; color:#111827;">失败用例（仅展示 FAIL）</div>
                                <div id="prompt-fails" style="margin-top: 8px; border:1px solid #f0f0f0; border-radius: 12px; overflow:hidden;">
                                    <div style="padding: 14px; text-align:center; color:#999;">（尚未评测）</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                        <div id="prompt-panel-code" style="display:${this.subTab === 'code' ? 'block' : 'none'};">
                            ${this.renderCodeChallengePanel()}
                        </div>

                        <div id="prompt-panel-puzzle" style="display:${this.subTab === 'puzzle' ? 'block' : 'none'};">
                            ${this.renderAiPuzzlePanel()}
                        </div>

                        <div id="prompt-panel-rules" style="display:${this.subTab === 'rules' ? 'block' : 'none'};">
                            ${this.renderRulesPanel()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        // 传统题需要题库；AI 编程题目前是固定例题，不强依赖题库
        if (this.subTab === 'traditional') this.loadChallenges(true);
        if (this.subTab === 'puzzle') {
            this.bindAiPuzzleEvents();
            this.loadAiPuzzles(true);
            this.handleShareCallbackFromUrl();
        }
        this.bindCodeChallengeEvents();
        this.bindRulesSubTabEvents();
    }

    bindEvents() {
        const btnTraditional = document.getElementById('prompt-subtab-traditional');
        const btnPuzzle = document.getElementById('prompt-subtab-puzzle');
        const btnCode = document.getElementById('prompt-subtab-code');
        const btnRules = document.getElementById('prompt-subtab-rules');
        if (btnTraditional && !btnTraditional._bound) {
            btnTraditional._bound = true;
            btnTraditional.addEventListener('click', () => this.switchSubTab('traditional'));
        }
        if (btnPuzzle && !btnPuzzle._bound) {
            btnPuzzle._bound = true;
            btnPuzzle.addEventListener('click', () => this.switchSubTab('puzzle'));
        }
        if (btnCode && !btnCode._bound) {
            btnCode._bound = true;
            btnCode.addEventListener('click', () => this.switchSubTab('code'));
        }
        if (btnRules && !btnRules._bound) {
            btnRules._bound = true;
            btnRules.addEventListener('click', () => this.switchSubTab('rules'));
        }

        const refreshBtn = document.getElementById('prompt-refresh-btn');
        if (refreshBtn && !refreshBtn._bound) {
            refreshBtn._bound = true;
            refreshBtn.addEventListener('click', () => this.loadChallenges(true));
        }
        const select = document.getElementById('prompt-challenge-select');
        if (select && !select._bound) {
            select._bound = true;
            select.addEventListener('change', () => {
                this.selectedId = String(select.value || '');
                localStorage.setItem('prompt_selected_id', this.selectedId);
                this.renderSelectedChallenge();
            });
        }
        const runBtn = document.getElementById('prompt-run-btn');
        if (runBtn && !runBtn._bound) {
            runBtn._bound = true;
            runBtn.addEventListener('click', () => this.runEvaluate());
        }
    }

    switchSubTab(tab) {
        if (tab === 'code') this.subTab = 'code';
        else if (tab === 'puzzle') this.subTab = 'puzzle';
        else if (tab === 'rules') this.subTab = 'rules';
        else this.subTab = 'traditional';
        localStorage.setItem('prompt_subtab', this.subTab);
        // 重新渲染整页，保证按钮/面板状态一致
        this.render();
    }

    bindRulesSubTabEvents() {
        const puzzleBtn = document.getElementById('rules-subtab-puzzle');
        const aiScoreBtn = document.getElementById('rules-subtab-ai-score');
        if (puzzleBtn && !puzzleBtn._bound) {
            puzzleBtn._bound = true;
            puzzleBtn.addEventListener('click', () => { this._rulesSubTab = 'puzzle'; this.render(); });
        }
        if (aiScoreBtn && !aiScoreBtn._bound) {
            aiScoreBtn._bound = true;
            aiScoreBtn.addEventListener('click', () => { this._rulesSubTab = 'ai-score'; this.render(); });
        }
    }

    renderRulesPanel() {
        const tab = this._rulesSubTab || 'puzzle';
        const isPuzzle = tab === 'puzzle';

        const tabBar = `
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
                <div style="font-size:14px; font-weight:900; color:#111827;">规则 / 提示</div>
                <button id="rules-subtab-puzzle" class="admin-btn ${isPuzzle ? '' : 'modal-secondary'}" type="button">Puzzle 约束题</button>
                <button id="rules-subtab-ai-score" class="admin-btn ${isPuzzle ? 'modal-secondary' : ''}" type="button">AI 打分题</button>
            </div>`;

        if (isPuzzle) {
            return `
            <div style="border:1px solid #f0f0f0; border-radius:12px; background:#fff; padding:14px;">
                ${tabBar}
                <div style="font-size:15px; font-weight:900; color:#111827; margin-bottom:6px;">Prompt Puzzle（约束型解谜）</div>
                <div style="font-size:13px; color:#666; line-height:1.7; margin-bottom:14px;">
                    写一条满足<b>输入约束</b>的 prompt 发给 AI，让 AI 的输出也满足<b>输出约束</b>。系统对每次提交多次采样（通常 3 次），考察 prompt 的鲁棒性。
                </div>
                <div style="font-size:13px; font-weight:800; color:#111827; margin-bottom:8px;">判题流程</div>
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:14px;">
                    <span class="admin-btn modal-secondary" style="pointer-events:none; background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;">1. 校验输入</span>
                    <span style="color:#ccc;">→</span>
                    <span class="admin-btn modal-secondary" style="pointer-events:none; background:#fefce8; color:#a16207; border-color:#fde68a;">2. 调 LLM x N</span>
                    <span style="color:#ccc;">→</span>
                    <span class="admin-btn modal-secondary" style="pointer-events:none; background:#f0fdf4; color:#15803d; border-color:#bbf7d0;">3. 校验输出</span>
                    <span style="color:#ccc;">→</span>
                    <span class="admin-btn modal-secondary" style="pointer-events:none; background:#faf5ff; color:#7c3aed; border-color:#ddd6fe;">4. 汇总得分</span>
                </div>
                <div style="display:flex; gap:12px; margin-bottom:14px;">
                    <div style="flex:1; padding:10px 12px; border:1px solid #dcfce7; border-radius:10px; background:#f0fdf4;">
                        <div style="font-size:12px; font-weight:800; color:#15803d; margin-bottom:4px;">评分规则</div>
                        <div style="font-size:12px; color:#374151; line-height:1.7;">
                            <b>AC</b>：全部采样通过<br>
                            <b>得分</b> = base_score x pass_rate - token罚分<br>
                            <b>排行</b>：同分按 token 少优先
                        </div>
                    </div>
                    <div style="flex:1; padding:10px 12px; border:1px solid #dbeafe; border-radius:10px; background:#eff6ff;">
                        <div style="font-size:12px; font-weight:800; color:#1d4ed8; margin-bottom:4px;">攻略</div>
                        <div style="font-size:12px; color:#374151; line-height:1.7;">
                            先确保 prompt 满足输入约束<br>
                            prompt 越短 → token 越少 → 分越高<br>
                            先试一次，看失败原因再调
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:12px; margin-bottom:14px;">
                    <div style="flex:1; padding:10px 12px; border:1px solid #fde68a; border-radius:10px; background:#fffbeb;">
                        <div style="font-size:12px; font-weight:800; color:#92400e; margin-bottom:4px;">提交次数</div>
                        <div style="font-size:12px; color:#374151; line-height:1.7;">
                            每题每天免费 <b>3 次</b><br>
                            每次评测需调用大模型多次采样，成本较高，因此限制每日次数<br>
                            建议先仔细阅读约束，想好再提交
                        </div>
                    </div>
                    <div style="flex:1; padding:10px 12px; border:1px solid #c4b5fd; border-radius:10px; background:#f5f3ff;">
                        <div style="font-size:12px; font-weight:800; color:#5b21b6; margin-bottom:4px;">分享获取更多次数</div>
                        <div style="font-size:12px; color:#374151; line-height:1.7;">
                            次数用完后可点击「分享给好友」生成链接<br>
                            好友点击链接助力后，你将获得 <b>+3 次</b>提交机会<br>
                            分享次数无上限，邀请越多机会越多
                        </div>
                    </div>
                </div>
                <div style="padding:10px 12px; border:1px solid #f0f0f0; border-radius:10px; background:#fafafa; font-size:12px;">
                    <div style="font-weight:800; color:#111827; margin-bottom:4px;">示例：双回文</div>
                    <div style="color:#666;">输入约束：2~20 个汉字回文串 ｜ 输出约束：2~16 个汉字回文串，不同于输入</div>
                    <pre style="margin:6px 0 0; padding:8px 10px; background:#0b1020; color:#e6edf3; border-radius:8px;">我爱你爱我</pre>
                    <div style="color:#999; margin-top:4px;">→ 模型可能输出 “人上人” 等不同回文串</div>
                </div>
            </div>`;
        }

        // AI 打分题
        return `
            <div style="border:1px solid #f0f0f0; border-radius:12px; background:#fff; padding:14px;">
                ${tabBar}
                <div style="font-size:15px; font-weight:900; color:#111827; margin-bottom:6px;">AI 打分题</div>
                <div style="font-size:13px; color:#666; line-height:1.7; margin-bottom:14px;">
                    最终得分 = <b>用例通过得分</b> x <b>Prompt 质量分</b> x <b>原创质量分</b>
                </div>
                <div style="display:flex; gap:12px; margin-bottom:14px;">
                    <div style="flex:1; padding:10px 12px; border:1px solid #dcfce7; border-radius:10px; background:#f0fdf4;">
                        <div style="font-size:12px; font-weight:800; color:#15803d; margin-bottom:4px;">加分写法</div>
                        <div style="font-size:12px; color:#374151; line-height:1.7;">
                            明确输出格式（JSON / 标签）<br>
                            字段约束写清楚<br>
                            结构化分点表达<br>
                            自造小样例（别抄平台的）
                        </div>
                    </div>
                    <div style="flex:1; padding:10px 12px; border:1px solid #fecaca; border-radius:10px; background:#fef2f2;">
                        <div style="font-size:12px; font-weight:800; color:#dc2626; margin-bottom:4px;">扣分雷区</div>
                        <div style="font-size:12px; color:#374151; line-height:1.7;">
                            粘贴题面/样例原文 → 原创分扣<br>
                            只写一句话没约束 → 质量分低<br>
                            输出要求自相矛盾
                        </div>
                    </div>
                </div>
                <div style="font-size:13px; font-weight:800; color:#111827; margin-bottom:6px;">推荐模板</div>
                <pre style="margin:0 0 12px; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding:10px; border-radius:10px; font-size:12px; line-height:1.6;">你是严格的文本处理器。任务：{一句话说明}
输出要求：仅输出 {JSON/标签}，不要解释
字段/约束：{字段名/类型/缺失如何填}
判定规则：1) ... 2) ...
示例（自造）：输入：... 输出：...</pre>
                <div style="font-size:13px; font-weight:800; color:#111827; margin-bottom:6px;">编程题模板</div>
                <pre style="margin:0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding:10px; border-radius:10px; font-size:12px; line-height:1.6;">请生成 C++17 代码（stdin/stdout），只输出代码，不要 markdown。
解题思路：1) ... 2) ...
关键细节/特判：...
复杂度目标：时间 O(...), 空间 O(...)</pre>
            </div>`;
    }

    async loadChallenges(force = false) {
        const select = document.getElementById('prompt-challenge-select');
        const descEl = document.getElementById('prompt-challenge-desc');
        if (!select) return;
        select.innerHTML = `<option value="">（加载中...）</option>`;
        if (descEl) descEl.textContent = '';

        try {
            if (!force && Array.isArray(this.challenges) && this.challenges.length) {
                this.renderChallengeOptions();
                return;
            }
            const list = await this.apiService.promptChallengeList();
            this.challenges = Array.isArray(list) ? list : [];
            this.renderChallengeOptions();
        } catch (e) {
            select.innerHTML = `<option value="">（加载失败）</option>`;
            if (descEl) descEl.innerHTML = `<span style="color:#ff4d4f;">题库加载失败：${this.escapeHtml(e?.message || 'unknown')}</span>`;
        }
    }

    renderChallengeOptions() {
        const select = document.getElementById('prompt-challenge-select');
        if (!select) return;
        const saved = localStorage.getItem('prompt_selected_id') || '';
        const opts = ['<option value="">请选择题目</option>'];
        for (const ch of this.challenges) {
            const id = String(ch.id || '');
            const name = String(ch.name || id);
            const cnt = Number(ch.case_count || 0);
            opts.push(`<option value="${id}" ${id === saved ? 'selected' : ''}>${this.escapeHtml(name)}（${cnt}）</option>`);
        }
        select.innerHTML = opts.join('');

        // 默认选择第一题
        if (!select.value) {
            const first = this.challenges.find(x => x && x.id);
            if (first) select.value = String(first.id);
        }
        this.selectedId = String(select.value || '');
        localStorage.setItem('prompt_selected_id', this.selectedId);
        this.renderSelectedChallenge();
    }

    renderSelectedChallenge() {
        const ch = this.challenges.find(x => x && String(x.id) === this.selectedId);
        const descEl = document.getElementById('prompt-challenge-desc');
        const sinEl = document.getElementById('prompt-sample-input');
        const soutEl = document.getElementById('prompt-sample-output');
        if (!descEl || !sinEl || !soutEl) return;
        if (!ch) {
            descEl.textContent = '';
            sinEl.textContent = '';
            soutEl.textContent = '';
            return;
        }
        descEl.textContent = String(ch.description || '').trim() || '（暂无说明）';
        sinEl.textContent = String(ch.sample_input || '').trim() || '（暂无样例）';
        soutEl.textContent = String(ch.sample_output || '').trim() || '（暂无样例）';
    }

    async runEvaluate() {
        if (this.running) return;
        const promptEl = document.getElementById('prompt-textarea');
        const errEl = document.getElementById('prompt-error');
        const resEl = document.getElementById('prompt-result');
        const failsEl = document.getElementById('prompt-fails');
        const runBtn = document.getElementById('prompt-run-btn');
        if (!promptEl || !failsEl || !resEl) return;

        if (errEl) errEl.style.display = 'none';
        resEl.style.display = 'none';
        failsEl.innerHTML = `<div style="padding: 14px; text-align:center; color:#999;">评测中...</div>`;

        const prompt = String(promptEl.value || '');
        if (!this.selectedId) {
            if (errEl) { errEl.textContent = '请先选择题目'; errEl.style.display = 'block'; }
            return;
        }
        if (!prompt.trim()) {
            if (errEl) { errEl.textContent = '请填写 Prompt'; errEl.style.display = 'block'; }
            return;
        }

        // 保存用户输入
        localStorage.setItem(`prompt_text_${this.selectedId}`, prompt);
        this.running = true;
        if (runBtn) { runBtn.disabled = true; runBtn.textContent = '评测中...'; }

        try {
            const payload = {
                // Java 后端为表单参数（camelCase）；ApiService 也兼容 snake_case，但这里统一用 camelCase 更清晰
                challengeId: this.selectedId,
                prompt,
                mode: 'normal',
                // 对外用户页不展示 debug/log
                debug: false
            };
            const res = await this.apiService.promptChallengeEvaluate(payload);
            this.renderEvaluateResult(res);
        } catch (e) {
            if (errEl) { errEl.textContent = e?.message || '评测失败'; errEl.style.display = 'block'; }
            failsEl.innerHTML = `<div style="padding: 14px; text-align:center; color:#ff4d4f;">失败：${this.escapeHtml(e?.message || 'unknown')}</div>`;
        } finally {
            this.running = false;
            if (runBtn) { runBtn.disabled = false; runBtn.textContent = '开始评测'; }
        }
    }

    renderEvaluateResult(res) {
        const resEl = document.getElementById('prompt-result');
        const failsEl = document.getElementById('prompt-fails');
        const promptEl = document.getElementById('prompt-textarea');
        if (!resEl || !failsEl) return;

        // 回填上次输入
        if (promptEl && this.selectedId) {
            const saved = localStorage.getItem(`prompt_text_${this.selectedId}`) || '';
            if (saved && !String(promptEl.value || '').trim()) promptEl.value = saved;
        }

        const total = Number(res.total || 0);
        const passed = Number(res.passed || 0);
        const finalScore = Number(res.final_score || 0);
        const qualityCoeff = Number(res.quality_coeff || (res.quality && res.quality.coeff) || 0);
        // 评分展示：按 /100 呈现（综合分按 final_score*100，超过 100 则 clamp）
        const promptScore100 = Math.max(0, Math.min(100, qualityCoeff * 100));
        const finalScore100 = Math.max(0, Math.min(100, finalScore * 100));
        const qualityReasons = (res.quality && Array.isArray(res.quality.reasons)) ? res.quality.reasons : [];
        const copyCheck = res.copy_check || null;
        const copyReasons = (copyCheck && Array.isArray(copyCheck.reasons)) ? copyCheck.reasons : [];
        const copyMeta = copyCheck ? `is_copy=${!!copyCheck.is_copy} · confidence=${Number(copyCheck.confidence || 0).toFixed(3)} · penalty=${(res.copy_penalty != null ? Number(res.copy_penalty) : 1).toFixed(3)}` : '';

        resEl.innerHTML = `
            <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                    <div style="font-size: 12px; color:#666;">通过</div>
                    <div style="font-size: 18px; font-weight: 900; color:#111827;">${passed}/${total}</div>
                </div>
                <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                    <div style="font-size: 12px; color:#666;">Prompt 评分</div>
                    <div style="font-size: 18px; font-weight: 900; color:#111827;">${promptScore100.toFixed(1)}/100</div>
                </div>
                <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                    <div style="font-size: 12px; color:#666;">综合评分</div>
                    <div style="font-size: 18px; font-weight: 900; color:#111827;">${finalScore100.toFixed(1)}/100</div>
                </div>
                <div style="flex:1;"></div>
                <div style="font-size: 12px; color:#6b7280;">提示：若 FAIL，通常是“输出格式不严格/多余解释”导致</div>
            </div>
            <details style="margin-top: 10px;">
                <summary style="cursor:pointer; font-size: 12px; color:#666;">展开查看 AI 评价</summary>
                <div style="margin-top: 8px; display:flex; flex-direction:column; gap:10px;">
                    <div style="font-size: 12px; color:#111827; font-weight: 900;">质量建议</div>
                    <ul style="margin:0; padding-left: 18px; color:#374151; line-height:1.6;">
                        ${(qualityReasons && qualityReasons.length)
                            ? qualityReasons.map(x => `<li>${this.escapeHtml(String(x))}</li>`).join('')
                            : `<li>（暂无）</li>`}
                    </ul>
                    ${copyCheck ? `
                        <div style="font-size: 12px; color:#111827; font-weight: 900;">复制检测</div>
                        <div style="font-size: 12px; color:#6b7280;">${this.escapeHtml(copyMeta)}</div>
                        <ul style="margin:0; padding-left: 18px; color:#374151; line-height:1.6;">
                            ${(copyReasons && copyReasons.length)
                                ? copyReasons.map(x => `<li>${this.escapeHtml(String(x))}</li>`).join('')
                                : `<li>（暂无）</li>`}
                        </ul>
                    ` : ``}
                </div>
            </details>
        `;
        resEl.style.display = 'block';

        const details = Array.isArray(res.details) ? res.details.filter(x => x) : [];
        if (!details.length) {
            failsEl.innerHTML = `<div style="padding: 14px; text-align:center; color:#999;">（无用例明细）</div>`;
            return;
        }
        const cards = details.map((d, i) => `
            <div style="padding: 12px; border-top:1px solid #f0f0f0;">
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div style="font-weight: 900; color:#111827;">Case ${this.escapeHtml(String(d.case || (i + 1)))}</div>
                    ${d.pass === false
                        ? `<div style="padding: 2px 8px; border-radius: 999px; border:1px solid #ffccc7; background:#fff; font-size: 12px; font-weight: 800; color:#a8071a;">FAIL</div>`
                        : `<div style="padding: 2px 8px; border-radius: 999px; border:1px solid #b7eb8f; background:#fff; font-size: 12px; font-weight: 800; color:#135200;">PASS</div>`}
                </div>
                <div style="margin-top: 8px; display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <div style="font-size: 12px; color:#666; margin-bottom: 6px;">输入</div>
                        <pre style="margin:0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 10px; max-height: 140px; overflow:auto;">${this.escapeHtml(String(d.input || ''))}</pre>
                    </div>
                    <div>
                        <div style="font-size: 12px; color:#666; margin-bottom: 6px;">期望 / 你的输出（raw）</div>
                        <div style="display:flex; gap:10px;">
                            <pre style="flex:1; margin:0; white-space:pre-wrap; word-break:break-word; background:#111827; color:#f9fafb; padding: 10px; border-radius: 10px; max-height: 140px; overflow:auto;">${this.escapeHtml(String(d.expected || ''))}</pre>
                            <pre style="flex:1; margin:0; white-space:pre-wrap; word-break:break-word; background:#111827; color:#f9fafb; padding: 10px; border-radius: 10px; max-height: 140px; overflow:auto;">${this.escapeHtml(String(d.raw_output || ''))}</pre>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        failsEl.innerHTML = `<div style="border-radius: 12px; overflow:hidden;">${cards}</div>`;
    }

    // ==================== AI 约束型解谜 ====================

    renderAiPuzzlePanel() {
        return `
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <div style="font-size:15px; font-weight:900; color:#111827;">Prompt Puzzle 题库</div>
                    <div style="font-size:12px; color:#9ca3af;">写出满足约束的 prompt，让 AI 给出合法输出</div>
                    <div style="flex:1;"></div>
                    <select id="ai-puzzle-sort" style="padding:6px 10px; border:1px solid #e5e7eb; border-radius:8px; font-size:12px; color:#374151; background:#fff;">
                        <option value="id-desc" ${this.aiPuzzleOrderBy === 'id' && this.aiPuzzleOrder === 'desc' ? 'selected' : ''}>最新</option>
                        <option value="id-asc" ${this.aiPuzzleOrderBy === 'id' && this.aiPuzzleOrder === 'asc' ? 'selected' : ''}>最早</option>
                        <option value="passTotal-desc" ${this.aiPuzzleOrderBy === 'passTotal' ? 'selected' : ''}>通过最多</option>
                        <option value="personTotal-desc" ${this.aiPuzzleOrderBy === 'personTotal' ? 'selected' : ''}>提交最多</option>
                        <option value="difficulty-asc" ${this.aiPuzzleOrderBy === 'difficulty' && this.aiPuzzleOrder === 'asc' ? 'selected' : ''}>难度升序</option>
                        <option value="difficulty-desc" ${this.aiPuzzleOrderBy === 'difficulty' && this.aiPuzzleOrder === 'desc' ? 'selected' : ''}>难度降序</option>
                    </select>
                    <button id="ai-puzzle-refresh-btn" style="padding:6px 14px; border:1px solid #e5e7eb; border-radius:8px; background:#fff; color:#6b7280; cursor:pointer; font-size:12px; font-weight:600;" type="button">刷新</button>
                </div>
                <div id="ai-puzzle-list" style="border:1px solid #e5e7eb; border-radius:14px; background:#fff; overflow:hidden;">
                    <div style="padding:20px; text-align:center; color:#9ca3af; font-size:13px;">加载中...</div>
                </div>
            </div>
            <!-- 做题弹窗 -->
            <div id="ai-puzzle-modal-overlay" style="display:none; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.45); backdrop-filter:blur(2px);">
                <div id="ai-puzzle-modal" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:min(1100px,94vw); max-height:90vh; background:#fff; border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,.2); display:flex; flex-direction:column; overflow:hidden;">
                    <!-- 弹窗头 -->
                    <div style="padding:16px 20px; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; gap:12px; flex-shrink:0;">
                        <div id="ai-puzzle-modal-title" style="font-size:17px; font-weight:900; color:#111827;">题目</div>
                        <div id="ai-puzzle-modal-badges" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
                        <div style="flex:1;"></div>
                        <button id="ai-puzzle-modal-close" style="width:32px; height:32px; border:none; border-radius:8px; background:#f3f4f6; color:#6b7280; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center;" type="button">&times;</button>
                    </div>
                    <!-- 弹窗体 -->
                    <div style="flex:1; overflow-y:auto; padding:20px; display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start;">
                        <!-- 左：题面 + 排行榜 -->
                        <div style="display:flex; flex-direction:column; gap:16px;">
                            <div id="ai-puzzle-modal-desc" style="font-size:13px; color:#374151; line-height:1.8;"></div>
                            <div style="border-top:1px solid #f3f4f6; padding-top:14px;">
                                <div style="display:flex; gap:4px; margin-bottom:10px;">
                                    <button id="ai-puzzle-side-tab-records" style="padding:5px 12px; border-radius:8px; border:none; font-size:12px; font-weight:700; cursor:pointer; background:#111827; color:#fff;" type="button">我的记录</button>
                                    <button id="ai-puzzle-side-tab-leaderboard" style="padding:5px 12px; border-radius:8px; border:none; font-size:12px; font-weight:700; cursor:pointer; background:transparent; color:#6b7280;" type="button">排行榜</button>
                                </div>
                                <div id="ai-puzzle-history-panel"><div id="ai-puzzle-history" style="max-height:260px; overflow:auto; color:#9ca3af; font-size:13px;">（加载中...）</div></div>
                                <div id="ai-puzzle-leaderboard-panel" style="display:none;"><div id="ai-puzzle-leaderboard" style="max-height:260px; overflow:auto; color:#9ca3af; font-size:13px;">（加载中...）</div></div>
                            </div>
                        </div>
                        <!-- 右：提交 + 结果 -->
                        <div style="display:flex; flex-direction:column; gap:14px;">
                            <div>
                                <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                                    <div style="font-size:13px; font-weight:800; color:#111827;">你的 Prompt</div>
                                    <div style="flex:1;"></div>
                                </div>
                                <textarea id="ai-puzzle-prompt" rows="6" placeholder="在这里写 prompt..."
                                    style="width:100%; padding:12px; border:1px solid #e5e7eb; border-radius:12px; font-size:13px; resize:vertical; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; line-height:1.5; background:#fafafa;"></textarea>
                                <div style="margin-top:10px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                                    <button id="ai-puzzle-run-btn" style="padding:9px 24px; border:none; border-radius:10px; background:#111827; color:#fff; font-size:13px; font-weight:800; cursor:pointer;" type="button">提交评测</button>
                                    <div id="ai-puzzle-quota" style="font-size:12px; color:#6b7280;"></div>
                                    <div id="ai-puzzle-error" style="font-size:12px; color:#ef4444; display:none;"></div>
                                </div>
                                <!-- 配额用完提示 + 分享 -->
                                <div id="ai-puzzle-share-bar" style="display:none; margin-top:10px; padding:10px 14px; background:#fffbeb; border:1px solid #fde68a; border-radius:10px;">
                                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                                        <span style="font-size:12px; color:#92400e; font-weight:700;">今日次数已用完</span>
                                        <button id="ai-puzzle-share-btn" style="padding:6px 14px; border:none; border-radius:8px; background:#f59e0b; color:#fff; font-size:12px; font-weight:700; cursor:pointer;" type="button">分享给好友 +3 次</button>
                                        <div id="ai-puzzle-share-msg" style="font-size:11px; color:#6b7280;"></div>
                                    </div>
                                </div>
                            </div>
                            <div id="ai-puzzle-result-wrap" style="display:none;">
                                <div id="ai-puzzle-result" style="padding:12px; border:1px solid #e5e7eb; border-radius:12px; background:#fafafa;"></div>
                            </div>
                            <div>
                                <div style="font-size:13px; font-weight:800; color:#111827; margin-bottom:6px;">采样明细</div>
                                <div id="ai-puzzle-runs" style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
                                    <div style="padding:16px; text-align:center; color:#9ca3af; font-size:12px;">（尚未评测）</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 编辑弹窗（管理员） -->
            <div id="ai-puzzle-edit-overlay" style="display:none; position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.45); backdrop-filter:blur(2px);">
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:min(700px,92vw); max-height:88vh; background:#fff; border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,.2); display:flex; flex-direction:column; overflow:hidden;">
                    <div style="padding:16px 20px; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; gap:10px; flex-shrink:0;">
                        <div style="font-size:15px; font-weight:900; color:#111827;">编辑题目</div>
                        <div id="ai-puzzle-edit-qid" style="font-size:12px; color:#9ca3af;"></div>
                        <div style="flex:1;"></div>
                        <button id="ai-puzzle-edit-close" style="width:32px; height:32px; border:none; border-radius:8px; background:#f3f4f6; color:#6b7280; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center;" type="button">&times;</button>
                    </div>
                    <div style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:12px;">
                        <div>
                            <label style="font-size:12px; color:#6b7280; font-weight:600;">标题</label>
                            <input id="ai-puzzle-edit-title" type="text" style="width:100%; padding:8px 12px; border:1px solid #e5e7eb; border-radius:10px; font-size:13px; margin-top:4px;" />
                        </div>
                        <div>
                            <label style="font-size:12px; color:#6b7280; font-weight:600;">难度（1~5）</label>
                            <input id="ai-puzzle-edit-difficulty" type="number" min="1" max="5" style="width:80px; padding:8px 12px; border:1px solid #e5e7eb; border-radius:10px; font-size:13px; margin-top:4px;" />
                        </div>
                        <div>
                            <label style="font-size:12px; color:#6b7280; font-weight:600;">题面（HTML）</label>
                            <textarea id="ai-puzzle-edit-content" rows="8" style="width:100%; padding:10px; border:1px solid #e5e7eb; border-radius:10px; font-size:12px; resize:vertical; font-family:ui-monospace,monospace; line-height:1.5; margin-top:4px;"></textarea>
                        </div>
                        <div>
                            <label style="font-size:12px; color:#6b7280; font-weight:600;">Judge 代码（Python）<span style="color:#9ca3af; font-weight:400;"> — 不改可留空</span></label>
                            <textarea id="ai-puzzle-edit-judge" rows="10" style="width:100%; padding:10px; border:1px solid #e5e7eb; border-radius:10px; font-size:12px; resize:vertical; font-family:ui-monospace,monospace; line-height:1.5; background:#fafafa; margin-top:4px;"></textarea>
                        </div>
                        <div id="ai-puzzle-edit-error" style="display:none; padding:8px 12px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; color:#dc2626; font-size:12px;"></div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <button id="ai-puzzle-edit-save" style="padding:9px 24px; border:none; border-radius:10px; background:#111827; color:#fff; font-size:13px; font-weight:800; cursor:pointer;" type="button">保存</button>
                            <div id="ai-puzzle-edit-status" style="font-size:12px; color:#6b7280;"></div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 提交详情弹窗 -->
            <div id="ai-puzzle-submission-modal-overlay" style="display:none; position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.45); backdrop-filter:blur(2px);">
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:min(800px,92vw); max-height:88vh; background:#fff; border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,.2); display:flex; flex-direction:column; overflow:hidden;">
                    <div style="padding:16px 20px; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; gap:10px; flex-shrink:0;">
                        <div style="font-size:15px; font-weight:900; color:#111827;">提交详情</div>
                        <div style="flex:1;"></div>
                        <button id="ai-puzzle-submission-modal-close" style="width:32px; height:32px; border:none; border-radius:8px; background:#f3f4f6; color:#6b7280; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center;" type="button">&times;</button>
                    </div>
                    <div id="ai-puzzle-submission-modal-content" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px; background:#fafafa;">
                        <div style="text-align:center; color:#9ca3af; font-size:13px;">加载中...</div>
                    </div>
                </div>
            </div>
        `;
    }

    bindAiPuzzleEvents() {
        if (this.subTab !== 'puzzle') return;
        const refreshBtn = document.getElementById('ai-puzzle-refresh-btn');
        const closeBtn = document.getElementById('ai-puzzle-modal-close');
        const overlay = document.getElementById('ai-puzzle-modal-overlay');
        const runBtn = document.getElementById('ai-puzzle-run-btn');
        const tabRecordsBtn = document.getElementById('ai-puzzle-side-tab-records');
        const tabLeaderboardBtn = document.getElementById('ai-puzzle-side-tab-leaderboard');

        if (refreshBtn && !refreshBtn._bound) {
            refreshBtn._bound = true;
            refreshBtn.addEventListener('click', () => { this.aiPuzzlePage = 1; this.loadAiPuzzles(true); });
        }
        const sortEl = document.getElementById('ai-puzzle-sort');
        if (sortEl && !sortEl._bound) {
            sortEl._bound = true;
            sortEl.addEventListener('change', () => {
                const [ob, od] = String(sortEl.value).split('-');
                this.aiPuzzleOrderBy = ob || 'id';
                this.aiPuzzleOrder = od || 'desc';
                this.aiPuzzlePage = 1;
                localStorage.setItem('ai_puzzle_order_by', this.aiPuzzleOrderBy);
                localStorage.setItem('ai_puzzle_order', this.aiPuzzleOrder);
                this.loadAiPuzzles(true);
            });
        }
        if (closeBtn && !closeBtn._bound) {
            closeBtn._bound = true;
            closeBtn.addEventListener('click', () => this.closeAiPuzzleModal());
        }
        if (overlay && !overlay._bound) {
            overlay._bound = true;
            overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeAiPuzzleModal(); });
        }
        if (runBtn && !runBtn._bound) {
            runBtn._bound = true;
            runBtn.addEventListener('click', () => this.runAiPuzzleSubmit());
        }
        if (tabRecordsBtn && !tabRecordsBtn._bound) {
            tabRecordsBtn._bound = true;
            tabRecordsBtn.addEventListener('click', () => this.switchAiPuzzleSideTab('records'));
        }
        if (tabLeaderboardBtn && !tabLeaderboardBtn._bound) {
            tabLeaderboardBtn._bound = true;
            tabLeaderboardBtn.addEventListener('click', () => this.switchAiPuzzleSideTab('leaderboard'));
        }
        // 分享按钮
        const shareBtn = document.getElementById('ai-puzzle-share-btn');
        if (shareBtn && !shareBtn._bound) {
            shareBtn._bound = true;
            shareBtn.addEventListener('click', () => this.handleAiPuzzleShare());
        }
        // 编辑弹窗
        const editClose = document.getElementById('ai-puzzle-edit-close');
        const editOverlay = document.getElementById('ai-puzzle-edit-overlay');
        const editSave = document.getElementById('ai-puzzle-edit-save');
        if (editClose && !editClose._bound) {
            editClose._bound = true;
            editClose.addEventListener('click', () => this.closeAiPuzzleEditModal());
        }
        if (editOverlay && !editOverlay._bound) {
            editOverlay._bound = true;
            editOverlay.addEventListener('click', (e) => { if (e.target === editOverlay) this.closeAiPuzzleEditModal(); });
        }
        if (editSave && !editSave._bound) {
            editSave._bound = true;
            editSave.addEventListener('click', () => this.saveAiPuzzleEdit());
        }
        // prompt input auto-save
        const promptEl = document.getElementById('ai-puzzle-prompt');
        if (promptEl && !promptEl._bound) {
            promptEl._bound = true;
            promptEl.addEventListener('input', () => {
                if (this.aiPuzzleSelectedId) localStorage.setItem(`ai_puzzle_prompt_${this.aiPuzzleSelectedId}`, String(promptEl.value || ''));
            });
        }
        const visibilityEl = document.getElementById('ai-puzzle-visibility');
        if (visibilityEl && !visibilityEl._bound) {
            visibilityEl._bound = true;
            visibilityEl.addEventListener('change', () => localStorage.setItem('ai_puzzle_visibility', String(visibilityEl.value || 'public')));
        }
        const anonymousEl = document.getElementById('ai-puzzle-anonymous');
        if (anonymousEl && !anonymousEl._bound) {
            anonymousEl._bound = true;
            anonymousEl.addEventListener('change', () => localStorage.setItem('ai_puzzle_anonymous', anonymousEl.checked ? 'true' : 'false'));
        }

        // 提交详情弹窗
        const subModalClose = document.getElementById('ai-puzzle-submission-modal-close');
        const subModalOverlay = document.getElementById('ai-puzzle-submission-modal-overlay');
        if (subModalClose && !subModalClose._bound) {
            subModalClose._bound = true;
            subModalClose.addEventListener('click', () => this.closeSubmissionDetailModal());
        }
        if (subModalOverlay && !subModalOverlay._bound) {
            subModalOverlay._bound = true;
            subModalOverlay.addEventListener('click', (e) => { if (e.target === subModalOverlay) this.closeSubmissionDetailModal(); });
        }

        // 历史与排行榜的点击代理 (用于提交详情)
        const historyEl = document.getElementById('ai-puzzle-history');
        if (historyEl && !historyEl._bound) {
            historyEl._bound = true;
            historyEl.addEventListener('click', (e) => {
                const item = e.target.closest('.ai-puzzle-submission-item');
                if (item && item.dataset.id) this.openSubmissionDetailModal(item.dataset.id);
            });
        }
        const leaderboardEl = document.getElementById('ai-puzzle-leaderboard');
        if (leaderboardEl && !leaderboardEl._bound) {
            leaderboardEl._bound = true;
            leaderboardEl.addEventListener('click', (e) => {
                const item = e.target.closest('.ai-puzzle-submission-item');
                if (item && item.dataset.id) this.openSubmissionDetailModal(item.dataset.id);
            });
        }
    }

    async loadAiPuzzles(force = false) {
        const listEl = document.getElementById('ai-puzzle-list');
        try {
            if (!force && Array.isArray(this.aiPuzzles) && this.aiPuzzles.length) {
                this.renderAiPuzzleOptions();
                return;
            }
            const resp = await this.apiService.promptPuzzleProblems({
                page: this.aiPuzzlePage,
                pageSize: this.aiPuzzlePageSize,
                orderBy: this.aiPuzzleOrderBy,
                order: this.aiPuzzleOrder
            }).catch(() => null);
            if (resp && Array.isArray(resp.problems)) {
                this.aiPuzzles = resp.problems;
                this.aiPuzzleTotal = Number(resp.total || 0);
            } else {
                // fallback 旧接口
                const list = await this.apiService.aiPuzzleList().catch(() => []);
                this.aiPuzzles = Array.isArray(list) ? list : [];
                this.aiPuzzleTotal = this.aiPuzzles.length;
            }
            this.renderAiPuzzleOptions();
        } catch (e) {
            if (listEl) listEl.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444; font-size:13px;">加载失败：${this.escapeHtml(e?.message || 'unknown')}</div>`;
        }
    }

    renderAiPuzzleOptions() {
        const listEl = document.getElementById('ai-puzzle-list');
        if (!listEl) return;
        if (!this.aiPuzzles.length) {
            listEl.innerHTML = `<div style="padding:20px; text-align:center; color:#9ca3af; font-size:13px;">暂无题目</div>`;
            return;
        }
        // 表头
        let html = `<div style="display:grid; grid-template-columns:70px 1fr 80px 80px 140px; padding:10px 16px; border-bottom:1px solid #f3f4f6; font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.5px;">
            <div>ID</div><div>题目</div><div style="text-align:center;">通过</div><div style="text-align:center;">提交</div><div></div>
        </div>`;
        for (const item of this.aiPuzzles) {
            const id = String(item.id || '');
            const title = String(item.title || item.name || id);
            const pass = Number(item.passTotal || item.pass_total || 0);
            const total = Number(item.personTotal || item.person_total || 0);
            const diff = item.difficulty ? Number(item.difficulty) : 0;
            const diffLabel = diff ? (['', '简单', '较易', '中等', '较难', '困难'][diff] || `Lv${diff}`) : '';
            const diffColor = diff <= 2 ? '#15803d' : (diff <= 3 ? '#a16207' : '#dc2626');
            html += `
                <div style="display:grid; grid-template-columns:70px 1fr 80px 80px 140px; align-items:center; padding:12px 16px; border-bottom:1px solid #f9fafb; transition:background .15s;${item.accepted ? ' background:#f0fdf4;' : ''}" onmouseenter="this.style.background='${item.accepted ? '#e5f7ed' : '#f9fafb'}'" onmouseleave="this.style.background='${item.accepted ? '#f0fdf4' : ''}'">
                    <div style="font-size:12px; color:#9ca3af; font-family:ui-monospace,monospace;">${this.escapeHtml(id)}</div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="font-size:13px; font-weight:700; color:${item.accepted ? '#15803d' : '#111827'};">${this.escapeHtml(title)}</div>
                        ${diffLabel ? `<span style="font-size:10px; font-weight:700; color:${diffColor};">${diffLabel}</span>` : ''}
                    </div>
                    <div style="text-align:center; font-size:13px; color:#15803d; font-weight:700;">${pass}</div>
                    <div style="text-align:center; font-size:13px; color:#6b7280;">${total}</div>
                    <div style="text-align:right; display:flex; gap:6px; justify-content:flex-end;">
                        ${this.state.isAdmin ? `<button class="ai-puzzle-edit-btn" data-id="${this.escapeHtml(id)}" style="padding:6px 12px; border:1px solid #e5e7eb; border-radius:8px; background:#fff; color:#6b7280; font-size:12px; font-weight:600; cursor:pointer;" type="button">编辑</button>` : ''}
                        <button class="ai-puzzle-open-btn" data-id="${this.escapeHtml(id)}" style="padding:6px 16px; border:none; border-radius:8px; background:#111827; color:#fff; font-size:12px; font-weight:700; cursor:pointer;" type="button">做题</button>
                    </div>
                </div>
            `;
        }
        // 分页
        const totalPages = Math.max(1, Math.ceil(this.aiPuzzleTotal / this.aiPuzzlePageSize));
        const page = this.aiPuzzlePage;
        if (this.aiPuzzleTotal > this.aiPuzzlePageSize) {
            html += `
                <div style="padding:12px 16px; border-top:1px solid #f3f4f6; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <button class="ai-puzzle-page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} style="padding:5px 12px; border:1px solid #e5e7eb; border-radius:6px; background:#fff; color:${page <= 1 ? '#d1d5db' : '#374151'}; cursor:${page <= 1 ? 'default' : 'pointer'}; font-size:12px;" type="button">上一页</button>
                    <span style="font-size:12px; color:#6b7280;">${page} / ${totalPages}</span>
                    <button class="ai-puzzle-page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} style="padding:5px 12px; border:1px solid #e5e7eb; border-radius:6px; background:#fff; color:${page >= totalPages ? '#d1d5db' : '#374151'}; cursor:${page >= totalPages ? 'default' : 'pointer'}; font-size:12px;" type="button">下一页</button>
                    <span style="font-size:11px; color:#9ca3af; margin-left:8px;">共 ${this.aiPuzzleTotal} 题</span>
                </div>
            `;
        }

        listEl.innerHTML = html;
        // 绑定做题按钮
        listEl.querySelectorAll('.ai-puzzle-open-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pid = btn.getAttribute('data-id');
                if (pid) this.openAiPuzzleModal(pid);
            });
        });
        // 绑定编辑按钮
        listEl.querySelectorAll('.ai-puzzle-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pid = btn.getAttribute('data-id');
                if (pid) this.openAiPuzzleEditModal(pid);
            });
        });
        // 绑定分页
        listEl.querySelectorAll('.ai-puzzle-page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = Number(btn.getAttribute('data-page'));
                if (p >= 1 && p <= totalPages && p !== this.aiPuzzlePage) {
                    this.aiPuzzlePage = p;
                    this.loadAiPuzzles(true);
                }
            });
        });
    }

    openAiPuzzleModal(puzzleId) {
        this.aiPuzzleSelectedId = String(puzzleId);
        localStorage.setItem('ai_puzzle_selected_id', this.aiPuzzleSelectedId);
        this.aiPuzzleSideTab = 'records';
        this.resetAiPuzzleTransientState();
        // 恢复已保存的 prompt
        const promptEl = document.getElementById('ai-puzzle-prompt');
        if (promptEl) promptEl.value = localStorage.getItem(`ai_puzzle_prompt_${this.aiPuzzleSelectedId}`) || '';
        // 恢复 visibility
        const visibilityEl = document.getElementById('ai-puzzle-visibility');
        if (visibilityEl) visibilityEl.value = localStorage.getItem('ai_puzzle_visibility') || 'public';
        const anonymousEl = document.getElementById('ai-puzzle-anonymous');
        if (anonymousEl) anonymousEl.checked = localStorage.getItem('ai_puzzle_anonymous') === 'true';
        // 显示弹窗
        const overlay = document.getElementById('ai-puzzle-modal-overlay');
        if (overlay) overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
        this.loadSelectedAiPuzzle();
        this.loadAiPuzzleQuota();
    }

    closeAiPuzzleModal() {
        const overlay = document.getElementById('ai-puzzle-modal-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = '';
    }

    async openAiPuzzleEditModal(questionId) {
        const overlay = document.getElementById('ai-puzzle-edit-overlay');
        const qidEl = document.getElementById('ai-puzzle-edit-qid');
        const titleEl = document.getElementById('ai-puzzle-edit-title');
        const diffEl = document.getElementById('ai-puzzle-edit-difficulty');
        const contentEl = document.getElementById('ai-puzzle-edit-content');
        const judgeEl = document.getElementById('ai-puzzle-edit-judge');
        const errEl = document.getElementById('ai-puzzle-edit-error');
        const statusEl = document.getElementById('ai-puzzle-edit-status');
        if (!overlay) return;

        // 记住正在编辑的 id
        this._editingPuzzleId = String(questionId);
        if (qidEl) qidEl.textContent = `#${questionId}`;
        if (errEl) errEl.style.display = 'none';
        if (statusEl) statusEl.textContent = '加载中...';

        // 清空
        if (titleEl) titleEl.value = '';
        if (diffEl) diffEl.value = '';
        if (contentEl) contentEl.value = '';
        if (judgeEl) judgeEl.value = '';

        overlay.style.display = 'block';

        try {
            // 并行拉详情和 judge 代码
            const [detail, judgeResp] = await Promise.all([
                this.apiService.promptPuzzleDetail(questionId).catch(() => null),
                this.apiService.promptPuzzleAdminJudgeCode(questionId).catch(() => ({}))
            ]);
            const d = detail || {};
            if (titleEl) titleEl.value = d.title || d.name || '';
            if (diffEl) diffEl.value = d.difficulty || '';
            if (contentEl) contentEl.value = d.content || '';
            const judgeData = (judgeResp && judgeResp.code === 0 && judgeResp.data) ? judgeResp.data : {};
            if (judgeEl) judgeEl.value = judgeData.judgeCode || '';
            if (statusEl) statusEl.textContent = '';
        } catch (e) {
            if (statusEl) statusEl.textContent = `加载失败：${e?.message || 'unknown'}`;
        }
    }

    closeAiPuzzleEditModal() {
        const overlay = document.getElementById('ai-puzzle-edit-overlay');
        if (overlay) overlay.style.display = 'none';
        this._editingPuzzleId = null;
    }

    // ==================== 配额 & 分享 ====================

    async loadAiPuzzleQuota() {
        if (!this.aiPuzzleSelectedId) return;
        const quotaEl = document.getElementById('ai-puzzle-quota');
        const shareBar = document.getElementById('ai-puzzle-share-bar');
        const runBtn = document.getElementById('ai-puzzle-run-btn');
        try {
            const q = await this.apiService.promptPuzzleQuota(this.aiPuzzleSelectedId);
            this._aiPuzzleQuota = q;
            if (quotaEl) quotaEl.textContent = `今日剩余 ${q.remaining}/${q.total} 次`;
            if (shareBar) shareBar.style.display = q.remaining <= 0 ? 'block' : 'none';
            if (runBtn) runBtn.disabled = q.remaining <= 0;
        } catch (_) {
            // 接口不可用时不阻塞，隐藏配额显示
            if (quotaEl) quotaEl.textContent = '';
            if (shareBar) shareBar.style.display = 'none';
        }
    }

    async handleAiPuzzleShare() {
        const msgEl = document.getElementById('ai-puzzle-share-msg');
        const shareBtn = document.getElementById('ai-puzzle-share-btn');
        if (!this.aiPuzzleSelectedId) return;
        if (shareBtn) { shareBtn.disabled = true; shareBtn.textContent = '生成中...'; }
        try {
            const resp = await this.apiService.promptPuzzleShareGenerate(this.aiPuzzleSelectedId);
            const fullUrl = `${window.location.origin}/problem/tracker?share=${encodeURIComponent(resp.shareCode)}&qid=${encodeURIComponent(this.aiPuzzleSelectedId)}#/prompt`;
            // 复制到剪贴板
            try {
                await navigator.clipboard.writeText(fullUrl);
                if (msgEl) msgEl.textContent = '链接已复制到剪贴板，分享给好友即可获得 +3 次';
            } catch (_) {
                // fallback: 显示链接让用户手动复制
                if (msgEl) msgEl.innerHTML = `复制链接：<input type="text" value="${this.escapeHtml(fullUrl)}" readonly onclick="this.select()" style="width:300px; padding:4px 8px; border:1px solid #e5e7eb; border-radius:6px; font-size:11px;" />`;
            }
        } catch (e) {
            if (msgEl) msgEl.textContent = e?.message || '生成失败';
        } finally {
            if (shareBtn) { shareBtn.disabled = false; shareBtn.textContent = '分享给好友 +3 次'; }
        }
    }

    handleShareCallbackFromUrl() {
        // 从 URL query 解析 share 参数：?share=xxx&qid=xxx#/prompt
        try {
            const params = new URLSearchParams(window.location.search);
            const shareCode = params.get('share');
            const qid = params.get('qid') || '';
            if (!shareCode) return;

            // 清除 URL 中的 share 参数（避免刷新重复触发）
            params.delete('share');
            params.delete('qid');
            const cleanSearch = params.toString();
            const newUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '') + (window.location.hash || '#/prompt');
            window.history.replaceState(null, '', newUrl);

            // 调回调接口
            this.apiService.promptPuzzleShareCallback(shareCode, qid).then(resp => {
                const data = resp && resp.data ? resp.data : {};
                if (data.success) {
                    alert(data.message || '助力成功！');
                } else {
                    alert(data.message || '助力失败');
                }
                // 打开对应题目
                if (qid) {
                    this.subTab = 'puzzle';
                    localStorage.setItem('prompt_subtab', 'puzzle');
                    this.render();
                    setTimeout(() => this.openAiPuzzleModal(qid), 500);
                }
            }).catch(_ => {});
        } catch (_) {}
    }

    async openSubmissionDetailModal(submissionId) {
        if (!submissionId) return;
        const overlay = document.getElementById('ai-puzzle-submission-modal-overlay');
        const contentEl = document.getElementById('ai-puzzle-submission-modal-content');
        if (!overlay || !contentEl) return;
        
        overlay.style.display = 'block';
        contentEl.innerHTML = `<div style="text-align:center; padding:40px; color:#9ca3af; font-size:13px;">加载中...</div>`;
        
        try {
            const detail = await this.apiService.promptPuzzleSubmissionDetail(submissionId);
            
            // 渲染 runs
            const runs = Array.isArray(detail.runs) ? detail.runs : [];
            let runsHtml = '';
            if (runs.length) {
                runsHtml = runs.map((run, i) => {
                    const isValid = run.output_valid || run.outputValid;
                    const validColor = isValid ? '#15803d' : '#dc2626';
                    const validBg = isValid ? '#f0fdf4' : '#fef2f2';
                    const rawOutput = String(run.raw_output || run.rawOutput || '');
                    const violations = Array.isArray(run.output_violations || run.outputViolations) ? (run.output_violations || run.outputViolations) : [];
                    const time = Number(run.latency_ms || run.latencyMs || 0);
                    const tokens = Number(run.token_output || run.tokenOutput || 0);
                    
                    return `
                        <div style="margin-bottom:12px; border:1px solid ${isValid ? '#dcfce7' : '#fecaca'}; border-radius:10px; background:#fff; overflow:hidden;">
                            <div style="padding:8px 12px; background:${validBg}; border-bottom:1px solid ${isValid ? '#dcfce7' : '#fecaca'}; display:flex; gap:10px; align-items:center; font-size:12px;">
                                <div style="font-weight:800; color:${validColor};">采样 ${i + 1}</div>
                                <div style="flex:1;"></div>
                                <div style="color:#6b7280;">${time}ms</div>
                                <div style="color:#6b7280;">${tokens} tok</div>
                            </div>
                            <div style="padding:12px;">
                                <pre style="margin:0; white-space:pre-wrap; word-break:break-word; font-size:12px; color:#374151; line-height:1.5;">${this.escapeHtml(rawOutput) || '<span style="color:#9ca3af;">（空输出）</span>'}</pre>
                                ${violations.length ? `
                                    <div style="margin-top:10px; padding:8px 10px; background:#fef2f2; border-radius:6px;">
                                        <div style="font-size:11px; font-weight:800; color:#dc2626; margin-bottom:4px;">未满足约束：</div>
                                        <ul style="margin:0; padding-left:16px; font-size:11px; color:#b91c1c;">
                                            ${violations.map(v => `<li>${this.escapeHtml(v)}</li>`).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                runsHtml = `<div style="text-align:center; padding:20px; color:#9ca3af; font-size:12px;">无采样明细</div>`;
            }

            const promptHtml = detail.userPrompt === undefined ? 
                `<div style="font-style:italic; color:#9ca3af;">（该提交为匿名，已隐藏）</div>` : 
                `<pre style="margin:0; white-space:pre-wrap; word-break:break-word; background:#f3f4f6; color:#111827; padding:12px; border-radius:10px; font-size:13px; line-height:1.5; font-family:ui-monospace,monospace;">${this.escapeHtml(detail.userPrompt)}</pre>`;

            contentEl.innerHTML = `
                <!-- 顶部状态卡片 -->
                <div style="display:flex; gap:16px; flex-wrap:wrap;">
                    <div style="flex:1; min-width:200px; padding:16px; border:1px solid #e5e7eb; border-radius:12px; background:#fff;">
                        <div style="font-size:12px; color:#6b7280; font-weight:600; margin-bottom:4px;">提交用户</div>
                        <div style="font-size:14px; font-weight:800; color:#111827;">${this.escapeHtml(detail.nickname || detail.userId || '匿名用户')}</div>
                        ${detail.userId && detail.userId !== '0' ? `<div style="font-size:11px; color:#9ca3af; margin-top:2px;">UID: ${detail.userId}</div>` : ''}
                    </div>
                    <div style="flex:1; min-width:120px; padding:16px; border:1px solid #e5e7eb; border-radius:12px; background:#fff;">
                        <div style="font-size:12px; color:#6b7280; font-weight:600; margin-bottom:4px;">最终状态</div>
                        <div style="font-size:16px; font-weight:900; color:${detail.finalStatus === 'AC' ? '#15803d' : (detail.finalStatus === 'PARTIAL' ? '#a16207' : '#6b7280')};">${this.escapeHtml(detail.finalStatus || '—')}</div>
                    </div>
                    <div style="flex:1; min-width:120px; padding:16px; border:1px solid #e5e7eb; border-radius:12px; background:#fff;">
                        <div style="font-size:12px; color:#6b7280; font-weight:600; margin-bottom:4px;">最终得分</div>
                        <div style="font-size:16px; font-weight:900; color:#111827;">${Number(detail.finalScore || 0).toFixed(1)}</div>
                    </div>
                </div>

                <!-- Prompt 区域 -->
                <div>
                    <div style="font-size:13px; font-weight:800; color:#111827; margin-bottom:8px;">提交的 Prompt</div>
                    ${promptHtml}
                </div>

                <!-- Runs 区域 -->
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;">
                        <div style="font-size:13px; font-weight:800; color:#111827;">采样明细</div>
                        <div style="font-size:11px; color:#6b7280;">通过率: ${(Number(detail.passRate || 0) * 100).toFixed(0)}% (${detail.passCount || 0}/${detail.runCount || 0}) | 消耗: ${detail.tokenTotal || 0} tok</div>
                    </div>
                    ${runsHtml}
                </div>
            `;
        } catch (e) {
            contentEl.innerHTML = `
                <div style="text-align:center; padding:40px;">
                    <div style="font-size:14px; color:#dc2626; font-weight:700; margin-bottom:8px;">获取详情失败</div>
                    <div style="font-size:12px; color:#6b7280;">${this.escapeHtml(e?.message || '未知错误')}</div>
                </div>
            `;
        }
    }

    closeSubmissionDetailModal() {
        const overlay = document.getElementById('ai-puzzle-submission-modal-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    async saveAiPuzzleEdit() {
        const btn = document.getElementById('ai-puzzle-edit-save');
        const errEl = document.getElementById('ai-puzzle-edit-error');
        const statusEl = document.getElementById('ai-puzzle-edit-status');
        const titleEl = document.getElementById('ai-puzzle-edit-title');
        const diffEl = document.getElementById('ai-puzzle-edit-difficulty');
        const contentEl = document.getElementById('ai-puzzle-edit-content');
        const judgeEl = document.getElementById('ai-puzzle-edit-judge');

        const qid = this._editingPuzzleId;
        if (!qid) return;
        if (errEl) errEl.style.display = 'none';

        const title = String(titleEl?.value || '').trim();
        const content = String(contentEl?.value || '').trim();
        const judgeCode = String(judgeEl?.value || '').trim();
        const difficulty = Number(diffEl?.value) || 0;

        if (!title && !content && !judgeCode && !difficulty) {
            if (errEl) { errEl.textContent = '没有任何修改'; errEl.style.display = 'block'; }
            return;
        }

        const oldText = btn?.textContent;
        if (btn) { btn.disabled = true; btn.textContent = '保存中...'; }
        if (statusEl) statusEl.textContent = '';

        try {
            const params = { questionId: qid };
            if (title) params.title = title;
            if (content) params.content = content;
            if (difficulty) params.difficulty = difficulty;
            // judgeCode: 如果用户改了就传，没改就用原值（textarea 里已经有）
            params.judgeCode = judgeCode;

            const resp = await this.apiService.promptPuzzleAdminUpdateJudge(params);
            if (resp && resp.code === 0) {
                this.closeAiPuzzleEditModal();
                this.loadAiPuzzles(true);
            } else {
                throw new Error((resp && resp.message) || '保存失败');
            }
        } catch (e) {
            if (errEl) { errEl.textContent = e?.message || '保存失败'; errEl.style.display = 'block'; }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = oldText || '保存'; }
        }
    }

    resetAiPuzzleTransientState() {
        this.aiPuzzleLastResult = null;
        this.aiPuzzleHistory = [];
        this.aiPuzzleLeaderboard = [];
        const errEl = document.getElementById('ai-puzzle-error');
        const wrapEl = document.getElementById('ai-puzzle-result-wrap');
        const resultEl = document.getElementById('ai-puzzle-result');
        const runsEl = document.getElementById('ai-puzzle-runs');
        const historyEl = document.getElementById('ai-puzzle-history');
        const leaderboardEl = document.getElementById('ai-puzzle-leaderboard');
        if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
        if (wrapEl) wrapEl.style.display = 'none';
        if (resultEl) resultEl.innerHTML = '';
        if (runsEl) runsEl.innerHTML = `<div style="padding:20px; text-align:center; color:#9ca3af; font-size:13px;">（尚未评测）</div>`;
        if (historyEl) historyEl.innerHTML = `<div style="color:#9ca3af; text-align:center; padding:8px 0;">（加载中...）</div>`;
        if (leaderboardEl) leaderboardEl.innerHTML = `<div style="color:#9ca3af; text-align:center; padding:8px 0;">（加载中...）</div>`;
    }

    switchAiPuzzleSideTab(tab) {
        this.aiPuzzleSideTab = (tab === 'leaderboard') ? 'leaderboard' : 'records';
        localStorage.setItem('ai_puzzle_side_tab', this.aiPuzzleSideTab);
        const recordsBtn = document.getElementById('ai-puzzle-side-tab-records');
        const leaderboardBtn = document.getElementById('ai-puzzle-side-tab-leaderboard');
        const recordsPanel = document.getElementById('ai-puzzle-history-panel');
        const leaderboardPanel = document.getElementById('ai-puzzle-leaderboard-panel');
        if (recordsBtn) {
            recordsBtn.style.background = this.aiPuzzleSideTab === 'records' ? '#111827' : 'transparent';
            recordsBtn.style.color = this.aiPuzzleSideTab === 'records' ? '#fff' : '#6b7280';
        }
        if (leaderboardBtn) {
            leaderboardBtn.style.background = this.aiPuzzleSideTab === 'leaderboard' ? '#111827' : 'transparent';
            leaderboardBtn.style.color = this.aiPuzzleSideTab === 'leaderboard' ? '#fff' : '#6b7280';
        }
        if (recordsPanel) recordsPanel.style.display = this.aiPuzzleSideTab === 'records' ? 'block' : 'none';
        if (leaderboardPanel) leaderboardPanel.style.display = this.aiPuzzleSideTab === 'leaderboard' ? 'block' : 'none';
    }

    async loadSelectedAiPuzzle() {
        if (!this.aiPuzzleSelectedId) {
            this.aiPuzzleDetail = null;
            return;
        }
        try {
            const detail = await this.apiService.promptPuzzleDetail(this.aiPuzzleSelectedId).catch(() => null)
                || await this.apiService.aiPuzzleGet(this.aiPuzzleSelectedId).catch(() => null);
            this.aiPuzzleDetail = detail || null;
            this.renderSelectedAiPuzzle();
            this.renderAiPuzzleSavedPrompt();
            await this.refreshAiPuzzleSideData();
        } catch (e) {
            const errEl = document.getElementById('ai-puzzle-error');
            if (errEl) {
                errEl.textContent = e?.message || '加载题目详情失败';
                errEl.style.display = 'block';
            }
        }
    }

    renderSelectedAiPuzzle() {
        const detail = this.aiPuzzleDetail || {};
        const titleEl = document.getElementById('ai-puzzle-modal-title');
        const badgesEl = document.getElementById('ai-puzzle-modal-badges');
        const descEl = document.getElementById('ai-puzzle-modal-desc');
        const judgeConfig = detail.judgeConfig || {};
        if (titleEl) titleEl.textContent = String(detail.title || detail.name || '题目');
        if (badgesEl) {
            const badges = [];
            if (judgeConfig.run_count) badges.push(`<span style="padding:3px 10px; border-radius:999px; background:#f0f7ff; color:#1d4ed8; font-size:10px; font-weight:700;">采样 ${judgeConfig.run_count} 次</span>`);
            if (judgeConfig.base_score) badges.push(`<span style="padding:3px 10px; border-radius:999px; background:#f0fdf4; color:#15803d; font-size:10px; font-weight:700;">满分 ${judgeConfig.base_score}</span>`);
            if (judgeConfig.max_tokens) badges.push(`<span style="padding:3px 10px; border-radius:999px; background:#fefce8; color:#a16207; font-size:10px; font-weight:700;">max_tokens ${judgeConfig.max_tokens}</span>`);
            badgesEl.innerHTML = badges.join('');
        }
        if (descEl) descEl.innerHTML = detail.content || this.renderSimpleMarkdown(String(detail.statement_md || detail.description || '（暂无说明）'));
    }

    renderAiPuzzleSavedPrompt() {
        // prompt 已在 openAiPuzzleModal 中恢复
    }

    async refreshAiPuzzleSideData() {
        if (!this.aiPuzzleSelectedId) return;
        const [history, leaderboard] = await Promise.all([
            this.apiService.promptPuzzleHistory({ questionId: this.aiPuzzleSelectedId, limit: 10 }).catch(() => []),
            this.apiService.promptPuzzleLeaderboard({ questionId: this.aiPuzzleSelectedId, limit: 10 }).catch(() => [])
        ]);
        this.aiPuzzleHistory = Array.isArray(history) ? history : [];
        this.aiPuzzleLeaderboard = Array.isArray(leaderboard) ? leaderboard : [];
        this.renderAiPuzzleHistory();
        this.renderAiPuzzleLeaderboard();
    }

    renderAiPuzzleHistory() {
        const el = document.getElementById('ai-puzzle-history');
        if (!el) return;
        if (!this.aiPuzzleHistory.length) {
            el.innerHTML = `<div style="color:#9ca3af; text-align:center; padding:8px 0;">暂无提交记录</div>`;
            return;
        }
        el.innerHTML = this.aiPuzzleHistory.map(item => {
            const status = String(item.finalStatus || item.final_status || '');
            const score = Number(item.finalScore || item.final_score || 0);
            const passRate = Number(item.passRate || item.pass_rate || 0);
            const prompt = String(item.userPrompt || item.user_prompt || '');
            const time = String(item.createdAt || item.created_at || '');
            const isAC = status === 'AC';
            const statusColor = isAC ? '#15803d' : (status === 'PARTIAL' ? '#a16207' : '#6b7280');
            const statusBg = isAC ? '#f0fdf4' : (status === 'PARTIAL' ? '#fefce8' : '#f9fafb');
            const submissionId = item.id || '';
            return `
                <div class="ai-puzzle-submission-item" data-id="${submissionId}" style="padding:10px 0; border-bottom:1px solid #f3f4f6; cursor:pointer; transition:background .15s;" onmouseenter="this.style.background='#f9fafb'" onmouseleave="this.style.background=''">
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span style="padding:2px 8px; border-radius:6px; background:${statusBg}; color:${statusColor}; font-size:11px; font-weight:800;">${this.escapeHtml(status)}</span>
                        <span style="font-size:12px; font-weight:700; color:#111827;">${score.toFixed(1)}</span>
                        <span style="font-size:11px; color:#9ca3af;">${(passRate * 100).toFixed(0)}% pass</span>
                        <span style="flex:1;"></span>
                        <span style="font-size:11px; color:#9ca3af;">${this.escapeHtml(time.replace('T', ' ').slice(0, 19))}</span>
                    </div>
                    <pre style="margin:6px 0 0 0; white-space:pre-wrap; word-break:break-word; background:#f9fafb; color:#374151; padding:8px; border-radius:8px; max-height:60px; overflow:auto; font-size:12px; line-height:1.4;">${this.escapeHtml(prompt)}</pre>
                </div>
            `;
        }).join('');
    }

    renderAiPuzzleLeaderboard() {
        const el = document.getElementById('ai-puzzle-leaderboard');
        if (!el) return;
        if (!this.aiPuzzleLeaderboard.length) {
            el.innerHTML = `<div style="color:#9ca3af; text-align:center; padding:8px 0;">暂无排名</div>`;
            return;
        }
        el.innerHTML = this.aiPuzzleLeaderboard.map((item, i) => {
            const rank = Number(item.rank || (i + 1));
            const nickname = item.nickname || item.userId || item.user_id || '匿名用户';
            const headerUrl = item.headerUrl || '';
            const score = Number(item.finalScore || item.final_score || 0);
            const token = Number(item.tokenTotal || item.token_total || 0);
            const submissionId = item.submissionId || item.submission_id || item.id || '';
            const medalColors = ['#f59e0b', '#9ca3af', '#cd7f32'];
            const rankStyle = rank <= 3 ? `color:${medalColors[rank - 1]}; font-weight:900;` : 'color:#6b7280; font-weight:700;';
            const avatarHtml = headerUrl
                ? `<img src="${this.escapeHtml(headerUrl)}" style="width:22px; height:22px; border-radius:50%; object-fit:cover; flex-shrink:0;" />`
                : `<div style="width:22px; height:22px; border-radius:50%; background:#e5e7eb; flex-shrink:0;"></div>`;
            return `
                <div class="ai-puzzle-submission-item" data-id="${submissionId}" style="display:flex; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid #f3f4f6; font-size:13px; cursor:pointer; transition:background .15s;" onmouseenter="this.style.background='#f9fafb'" onmouseleave="this.style.background=''">
                    <div style="width:28px; text-align:center; ${rankStyle}">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : '#' + rank}</div>
                    ${avatarHtml}
                    <div style="flex:1; color:#111827; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.escapeHtml(String(nickname))}</div>
                    <div style="font-weight:800; color:#111827;">${score.toFixed(1)}</div>
                    <div style="color:#9ca3af; font-size:11px; min-width:60px; text-align:right;">${token} tok</div>
                </div>
            `;
        }).join('');
    }

    async runAiPuzzleSubmit() {
        if (this.aiPuzzleSubmitting) return;
        const promptEl = document.getElementById('ai-puzzle-prompt');
        const errEl = document.getElementById('ai-puzzle-error');
        const resultEl = document.getElementById('ai-puzzle-result');
        const runsEl = document.getElementById('ai-puzzle-runs');
        const runBtn = document.getElementById('ai-puzzle-run-btn');
        const visibilityEl = document.getElementById('ai-puzzle-visibility');
        const anonymousEl = document.getElementById('ai-puzzle-anonymous');
        if (!promptEl || !resultEl || !runsEl) return;
        if (errEl) errEl.style.display = 'none';
        const wrapEl = document.getElementById('ai-puzzle-result-wrap');
        if (wrapEl) wrapEl.style.display = 'none';
        runsEl.innerHTML = `<div style="padding: 14px; text-align:center; color:#999;">评测中...</div>`;

        const userPrompt = String(promptEl.value || '');
        if (!this.aiPuzzleSelectedId) {
            if (errEl) { errEl.textContent = '请先选择题目'; errEl.style.display = 'block'; }
            return;
        }
        if (!userPrompt.trim()) {
            if (errEl) { errEl.textContent = '请填写 Prompt'; errEl.style.display = 'block'; }
            return;
        }
        localStorage.setItem(`ai_puzzle_prompt_${this.aiPuzzleSelectedId}`, userPrompt);
        localStorage.setItem('ai_puzzle_visibility', String(visibilityEl?.value || 'public'));
        localStorage.setItem('ai_puzzle_anonymous', anonymousEl?.checked ? 'true' : 'false');

        this.aiPuzzleSubmitting = true;
        if (runBtn) { runBtn.disabled = true; runBtn.textContent = '评测中...'; }
        try {
            const res = await this.apiService.promptPuzzleSubmit({
                questionId: this.aiPuzzleSelectedId,
                userPrompt: userPrompt,
                visibility: visibilityEl ? String(visibilityEl.value || 'public') : 'public',
                anonymous: !!(anonymousEl && anonymousEl.checked)
            });
            this.aiPuzzleLastResult = res;
            this.renderAiPuzzleResult(res);
            await Promise.all([this.refreshAiPuzzleSideData(), this.loadAiPuzzleQuota()]);
        } catch (e) {
            const msg = e?.message || '评测失败';
            if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
            runsEl.innerHTML = `<div style="padding: 14px; text-align:center; color:#ff4d4f;">失败：${this.escapeHtml(msg)}</div>`;
            // 次数用完时刷新配额显示分享栏
            if (msg.includes('次数') || msg.includes('用完')) this.loadAiPuzzleQuota();
        } finally {
            this.aiPuzzleSubmitting = false;
            if (runBtn) { runBtn.disabled = false; runBtn.textContent = '提交评测'; }
        }
    }

    renderAiPuzzleResult(res) {
        const wrapEl = document.getElementById('ai-puzzle-result-wrap');
        const resultEl = document.getElementById('ai-puzzle-result');
        const runsEl = document.getElementById('ai-puzzle-runs');
        if (!resultEl || !runsEl) return;
        const submission = res.submission || {};
        const promptViolations = Array.isArray(res.prompt_violations) ? res.prompt_violations : [];
        const status = String(submission.final_status || submission.finalStatus || '—');
        const score = Number(submission.final_score || submission.finalScore || 0);
        const passRate = Number(submission.pass_rate || submission.passRate || 0);
        const passCount = Number(submission.pass_count || submission.passCount || 0);
        const runCount = Number(submission.run_count || submission.runCount || 0);
        const tokenTotal = Number(submission.token_total || submission.tokenTotal || 0);
        const isAC = status === 'AC';
        const statusColor = isAC ? '#15803d' : (status === 'PARTIAL' ? '#a16207' : (status === 'INVALID_PROMPT' ? '#dc2626' : '#6b7280'));
        const statusBg = isAC ? '#f0fdf4' : (status === 'PARTIAL' ? '#fefce8' : (status === 'INVALID_PROMPT' ? '#fef2f2' : '#f9fafb'));
        resultEl.innerHTML = `
            <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
                <div style="padding:8px 16px; border-radius:12px; background:${statusBg};">
                    <div style="font-size:11px; color:#9ca3af; font-weight:600;">状态</div>
                    <div style="font-size:20px; font-weight:900; color:${statusColor};">${this.escapeHtml(status)}</div>
                </div>
                <div>
                    <div style="font-size:11px; color:#9ca3af; font-weight:600;">得分</div>
                    <div style="font-size:20px; font-weight:900; color:#111827;">${score.toFixed(1)}</div>
                </div>
                <div>
                    <div style="font-size:11px; color:#9ca3af; font-weight:600;">通过率</div>
                    <div style="font-size:20px; font-weight:900; color:#111827;">${(passRate * 100).toFixed(0)}%</div>
                </div>
                <div>
                    <div style="font-size:11px; color:#9ca3af; font-weight:600;">采样</div>
                    <div style="font-size:20px; font-weight:900; color:#111827;">${passCount}/${runCount}</div>
                </div>
                <div>
                    <div style="font-size:11px; color:#9ca3af; font-weight:600;">token</div>
                    <div style="font-size:20px; font-weight:900; color:#111827;">${tokenTotal}</div>
                </div>
            </div>
            ${promptViolations.length ? `
                <div style="margin-top:12px; padding:10px 14px; border-radius:10px; background:#fef2f2; border:1px solid #fecaca;">
                    <div style="font-size:12px; font-weight:800; color:#dc2626; margin-bottom:4px;">输入不合法</div>
                    <ul style="margin:0; padding-left:16px; color:#7f1d1d; font-size:12px; line-height:1.6;">
                        ${promptViolations.map(x => `<li>${this.escapeHtml(String(x))}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        `;
        if (wrapEl) wrapEl.style.display = 'block';

        const runs = Array.isArray(res.runs) ? res.runs : [];
        if (!runs.length) {
            runsEl.innerHTML = `<div style="padding:20px; text-align:center; color:#9ca3af; font-size:13px;">（无采样明细）</div>`;
            return;
        }
        runsEl.innerHTML = runs.map(run => {
            const valid = run.output_valid;
            const violations = Array.isArray(run.output_violations) ? run.output_violations : [];
            return `
                <div style="padding:14px 16px; border-top:1px solid #f3f4f6;">
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <span style="font-size:13px; font-weight:800; color:#111827;">Run ${this.escapeHtml(String(run.run_index || ''))}</span>
                        <span style="padding:2px 10px; border-radius:6px; font-size:11px; font-weight:800; ${valid
                            ? 'background:#f0fdf4; color:#15803d;'
                            : 'background:#fef2f2; color:#dc2626;'}">${valid ? 'PASS' : 'FAIL'}</span>
                        <span style="font-size:11px; color:#9ca3af;">${Number(run.token_output || 0)} tok · ${Number(run.latency_ms || 0)}ms${run.finish_reason && run.finish_reason !== 'stop' ? ` · ${run.finish_reason}` : ''}</span>
                    </div>
                    <pre style="margin:8px 0 0 0; white-space:pre-wrap; word-break:break-word; background:#0f172a; color:#e2e8f0; padding:12px; border-radius:10px; max-height:100px; overflow:auto; font-size:12px; line-height:1.5;">${this.escapeHtml(String(run.raw_output || run.normalized_output || '（空）'))}</pre>
                    ${violations.length ? `
                        <div style="margin-top:6px; padding:6px 10px; border-radius:8px; background:#fef2f2;">
                            ${violations.map(x => `<div style="font-size:11px; color:#991b1b;">· ${this.escapeHtml(String(x))}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // ==================== AI 编程题（前端先做 UI，后端接口待接入） ====================

    getCodeProblems() {
        return [
            {
                id: 'reverse_output_10ints',
                qid: 352865,
                title: '逆序输出',
                timeLimit: '1s',
                memoryLimit: '256MB',
                description:
                    '对于在一行上输入的十个整数 a1,a2,…,a10，要求将它们逆序输出。\n\n【名词解释】\n逆序输出：按照输入相反的顺序（越晚输入的越早输出）进行输出。',
                inputSpec:
                    '在一行上输入十个整数 a1,a2,…,a10 (−2^31 ≤ ai < 2^31)，用空格分隔。',
                outputSpec: '在一行上输出十个整数，用空格分隔。',
                sampleInput: '1 2 3 4 5 6 7 8 9 10',
                sampleOutput: '10 9 8 7 6 5 4 3 2 1',
                language: 'cpp',
                imageUrl: null
            },
            {
                id: 'xh_fangshen',
                qid: 11214303,
                title: '小红的方神题',
                timeLimit: '1s',
                memoryLimit: '256MB',
                description:
                    '对于数组 a，我们定义它的退化状态为：取每个相邻两数之差的绝对值构成的新数组。\n'
                    + '退化后的 a 数组长度为 len(a)-1，第 i 个元素为 |a_i - a_{i+1}|。\n\n'
                    + 'TRfirst 希望小红构造一个长度为 n 的排列，使得其连续进行 n-1 次退化后，最终生成的一个整数恰好等于 n-2。\n'
                    + '如果不存在这样的排列，输出 -1。',
                inputSpec: '输入一个正整数 n (1 ≤ n ≤ 10^3)，代表待构造的排列的长度。',
                outputSpec:
                    '如果不存在满足条件的排列，输出 -1。\n'
                    + '否则输出一个长度为 n 的排列 a1..an（1..n 各出现一次）。若多解可输出任意一个。',
                sampleInput: '3',
                sampleOutput: '1 3 2',
                language: 'cpp',
                imageUrl: null
            },
            {
                id: 'war_board',
                qid: 10744174,
                title: '小红的战争棋盘',
                timeLimit: '1s',
                memoryLimit: '256MB',
                description:
                    '小红正在玩一个战争棋盘。\n'
                    + '棋盘可以视为一个 n 行 m 列的矩阵。小红初始往棋盘上投放了 k 支军队，每个军队属于不同势力。每回合，小红可以任选一个军队按“上、下、左、右”四种方向中的一种移动一个方格，会出现以下 4 种情况：\n'
                    + '1.当这个军队移动到一个未被任何势力占领的格子，则军队移动成功，并将其占领。\n'
                    + '2.当这个军队移动到自己势力的格子，此时军队移动成功。\n'
                    + '3.若这个军队将移出地图的边界，将移动失败。该军队原地不动。\n'
                    + '4.若这个军队将移动到另外一个势力的格子，那么两个势力将发生冲突，拥有较多领土的势力将获胜，并占领对方所有领土，消灭对方的军队。特殊的，若两个冲突的势力领土数量相等，那么势力名字的字典序较大者获胜。如果进攻方获胜，则进攻方移动成功。如果防守方获胜，那么防守方的军队保持原来的位置。\n'
                    + '请你在每次移动操作后输出当前操作的结果。\n'
                    + 'ps：若投放军队的时候有两个或多个军队在同一格子，则直接发生冲突，名字字典序最大的那个势力存活，其他势力消亡。\n'
                    + '对于字符串 a 和 b，我们认为满足以下两个条件中的一种时，a 的字典序大于 b：\n'
                    + '1. b 是 a 的一个前缀，且 a 和 b 不相等。\n'
                    + '2. 对于 a 和 b 中出现的第一个不同的字母，a 的那个字母的 ascii 值比 b 的那个字母更大。',
                inputSpec:
                    '第一行输入三个正整数 n,m,k，分别代表棋盘的行数、列数，以及势力的数量。\n'
                    + '接下来的 k 行，每行输入一个字符串 str，以及两个正整数 x 和 y，代表每个势力的名字，以及初始的坐标为 (x,y)。保证初始投放的军队是没有重名的。\n'
                    + '接下来的一行输入一个正整数 q，代表回合数。\n'
                    + '接下来的 q 行，每行输入一个字符串 str 和一个字符 c，代表即将行动的军队的势力名称，以及行动方向。c 为 \'W\' 代表该军队向上走，\'S\' 代表向下走，\'A\' 代表向左走，\'D\' 代表向右走。\n'
                    + '\n'
                    + '数据范围：\n'
                    + '1≤n,m≤500\n'
                    + '1≤k≤min(n×m,2⋅10^4)\n'
                    + '1≤x≤n,1≤y≤m\n'
                    + '1≤q≤2⋅10^4\n'
                    + '保证 str 是长度不超过 10 的、仅包含小写字母的字符串。保证 c 为 \'W\'、\'A\'、\'S\'、\'D\' 四种字符中的一种。',
                outputSpec:
                    '对于每次操作，输出一行答案：\n'
                    + '若本次移动占领了新的边界，则输出一行字符串 "vanquish!"\n'
                    + '若本次移动到了自己的领土，则输出一行字符串 "peaceful."\n'
                    + '若本次由于将移出边界导致移动失败，则输出一行字符串 "out of bounds!"\n'
                    + '若本次移动发生了冲突，胜利者是 xxx，则输出一行字符串 "xxx wins!"（xxx 为势力名字）\n'
                    + '若输入了不存在的势力，或者输入的字符串代表的势力已经败北，则输出一行字符串 "unexisted empire."',
                samples: [
                    {
                        title: '示例1',
                        input:
                            '3 3 2\n'
                            + 'ranko 1 1\n'
                            + 'kotori 2 2\n'
                            + '5\n'
                            + 'ranko D\n'
                            + 'ranko W\n'
                            + 'ranko A\n'
                            + 'kotori W\n'
                            + 'kotori W',
                        output:
                            'vanquish!\n'
                            + 'out of bounds!\n'
                            + 'peaceful.\n'
                            + 'ranko wins!\n'
                            + 'unexisted empire.'
                    },
                    {
                        title: '示例2',
                        input:
                            '2 2 2\n'
                            + 'abcd 1 1\n'
                            + 'abcad 1 2\n'
                            + '1\n'
                            + 'abcd D',
                        output: 'abcd wins!'
                    }
                ],
                // 兼容旧渲染/其它逻辑：默认取示例 1
                sampleInput:
                    '3 3 2\n'
                    + 'ranko 1 1\n'
                    + 'kotori 2 2\n'
                    + '5\n'
                    + 'ranko D\n'
                    + 'ranko W\n'
                    + 'ranko A\n'
                    + 'kotori W\n'
                    + 'kotori W',
                sampleOutput:
                    'vanquish!\n'
                    + 'out of bounds!\n'
                    + 'peaceful.\n'
                    + 'ranko wins!\n'
                    + 'unexisted empire.',
                language: 'cpp',
                imageUrl: null // 用户稍后会提供图片 url
            }
        ];
    }

    getCurrentCodeProblem() {
        const all = this.getCodeProblems();
        const id = String(this.selectedCodeProblemId || '').trim();
        return all.find(x => x && String(x.id) === id) || all[0];
    }

    renderCodeChallengePanel() {
        const p = this.getCurrentCodeProblem();
        const savedPrompt = localStorage.getItem(`prompt_code_prompt_${p.id}`) || '';
        const problems = this.getCodeProblems();
        const options = problems.map(x => {
            const id = String(x.id || '');
            const name = String(x.title || id);
            return `<option value="${this.escapeHtml(id)}" ${id === p.id ? 'selected' : ''}>${this.escapeHtml(name)}</option>`;
        }).join('');
        // 内部配置不在用户页展示
        const samples = Array.isArray(p.samples) ? p.samples : null;
        let sampleHtml = '';
        if (samples && samples.length) {
            const cards = samples.map((s, i) => {
                const title = String(s?.title || `示例${i + 1}`);
                const input = String(s?.input || '');
                const output = String(s?.output || '');
                return `
                    <div style="border:1px solid #f0f0f0; border-radius: 12px; background:#fafafa; padding: 10px;">
                        <div style="font-size: 12px; font-weight: 900; color:#111827; margin-bottom: 8px;">${this.escapeHtml(title)}</div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <div style="font-size: 12px; color:#666; margin-bottom: 6px;">示例输入</div>
                                <pre style="margin:0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 10px; max-height: 160px; overflow:auto;">${this.escapeHtml(input)}</pre>
                            </div>
                            <div>
                                <div style="font-size: 12px; color:#666; margin-bottom: 6px;">示例输出</div>
                                <pre style="margin:0; white-space:pre-wrap; word-break:break-word; background:#111827; color:#f9fafb; padding: 10px; border-radius: 10px; max-height: 160px; overflow:auto;">${this.escapeHtml(output)}</pre>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            sampleHtml = `<div style="margin-top: 12px; display:flex; flex-direction:column; gap: 10px;">${cards}</div>`;
        } else {
            sampleHtml = `
                <div style="margin-top: 12px; display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <div style="font-size: 12px; color:#666; margin-bottom: 6px;">示例输入</div>
                        <pre style="margin:0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 10px; max-height: 140px; overflow:auto;">${this.escapeHtml(p.sampleInput)}</pre>
                    </div>
                    <div>
                        <div style="font-size: 12px; color:#666; margin-bottom: 6px;">示例输出</div>
                        <pre style="margin:0; white-space:pre-wrap; word-break:break-word; background:#111827; color:#f9fafb; padding: 10px; border-radius: 10px; max-height: 140px; overflow:auto;">${this.escapeHtml(p.sampleOutput)}</pre>
                    </div>
                </div>
            `;
        }

        return `
            <div style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap: 12px; align-items:start;">
                <div style="border:1px solid #f0f0f0; border-radius: 12px; background:#fff; overflow:hidden;">
                    <div style="padding: 12px; border-bottom:1px solid #f0f0f0; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <select id="pcg-problem-select" style="max-width: 320px; padding: 8px 10px; border:1px solid #ddd; border-radius: 10px; font-size: 13px;">
                            ${options}
                        </select>
                        <div style="font-size: 16px; font-weight: 900; color:#111827;">${this.escapeHtml(p.title)}</div>
                        <div style="font-size: 12px; color:#6b7280;">时间限制：${this.escapeHtml(p.timeLimit)} · 空间限制：${this.escapeHtml(p.memoryLimit)}</div>
                    </div>
                    <div style="padding: 12px;">
                        <div style="font-size: 13px; font-weight: 800; color:#111827; margin-bottom:6px;">题目描述</div>
                        <div style="font-size: 13px; color:#374151; line-height:1.7; white-space:pre-wrap;">${this.escapeHtml(p.description)}</div>
                        ${p.imageUrl ? `
                            <div style="margin-top: 10px;">
                                <img src="${this.escapeHtml(p.imageUrl)}" alt="题目图片" style="max-width:100%; border-radius: 10px; border:1px solid #f0f0f0;" />
                            </div>
                        ` : ``}
                        <div style="margin-top: 10px; font-size: 13px; font-weight: 800; color:#111827;">输入描述</div>
                        <div style="font-size: 13px; color:#374151; line-height:1.7; white-space:pre-wrap;">${this.escapeHtml(p.inputSpec)}</div>
                        <div style="margin-top: 10px; font-size: 13px; font-weight: 800; color:#111827;">输出描述</div>
                        <div style="font-size: 13px; color:#374151; line-height:1.7; white-space:pre-wrap;">${this.escapeHtml(p.outputSpec)}</div>
                        ${sampleHtml}
                    </div>
                </div>

                <div style="border:1px solid #f0f0f0; border-radius: 12px; background:#fff; overflow:hidden;">
                    <div style="padding: 12px; border-bottom:1px solid #f0f0f0; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <div style="font-size: 13px; font-weight: 900; color:#111827;">提交 Prompt（AI 生成代码）</div>
                        <div style="flex:1;"></div>
                        <div style="font-size: 12px; color:#6b7280;">评测将绑定本次生成时的 Prompt（防止“改 Prompt 刷分”）</div>
                    </div>

                    <div style="padding: 12px;">
                        <textarea id="pcg-prompt" rows="9" placeholder="只填写 Prompt。你不能修改生成的代码（只读展示）。默认生成 C++17。"
                            style="width:100%; padding: 10px; border:1px solid #ddd; border-radius: 12px; font-size: 13px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${this.escapeHtml(savedPrompt)}</textarea>

                        <div id="pcg-error" style="margin-top: 10px; font-size: 13px; color:#ff4d4f; display:none;"></div>

                        <div style="margin-top: 12px;">
                            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                                <div style="font-size: 13px; font-weight: 900; color:#111827;">生成代码（只读）</div>
                                <div style="flex:1;"></div>
                                <div id="pcg-code-meta" style="font-size: 12px; color:#6b7280;"></div>
                            </div>
                            <pre id="pcg-code" style="margin-top: 8px; white-space:pre; overflow:auto; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 12px; max-height: 360px;">（尚未生成）</pre>
                            <div style="margin-top: 10px; display:flex; justify-content:flex-end; gap:10px; align-items:center;">
                                <button id="pcg-copy-code" class="admin-btn modal-secondary" type="button" style="display:none;">复制代码</button>
                                <button id="pcg-run-btn" class="admin-btn" type="button">生成并提交评测</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    openModal(title, bodyHtml) {
        // remove existing
        const old = document.getElementById(this.activeModalId);
        if (old) old.remove();
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = this.activeModalId;
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 860px; width: 860px;">
                <div class="modal-header">
                    <h3>${this.escapeHtml(title)}</h3>
                    <button class="modal-close" type="button" aria-label="close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 16px;">
                    ${bodyHtml}
                </div>
                <div class="modal-actions">
                    <button class="admin-btn modal-secondary" type="button" data-action="close">关闭</button>
                </div>
            </div>
        `;
        modal.addEventListener('click', (e) => {
            const t = e.target;
            if (t && (t.classList.contains('modal-close') || t.getAttribute('data-action') === 'close')) {
                modal.remove();
            }
            // 点击遮罩关闭
            if (t === modal) modal.remove();
        });
        document.body.appendChild(modal);
    }

    showCodeEvalModal() {
        const html = this.buildUserFriendlyEvalHtml();
        this.openModal('评测结果', html);
    }

    buildUserFriendlyEvalHtml() {
        const r = this.lastPromptOnlyScoreData || {};
        const q = r.quality || null;
        const o = r.originality || null;
        const qCoeff = Number(q?.quality_coeff ?? q?.quality?.coeff ?? 0);
        const oCoeff = Number(o?.originality_coeff ?? o?.copy_penalty ?? 1);
        const judgeData = (this.lastJudgeStatusResp && this.lastJudgeStatusResp.data) ? this.lastJudgeStatusResp.data : null;
        const allCaseNum = judgeData && judgeData.allCaseNum != null ? Number(judgeData.allCaseNum) : 0;
        const rightCaseNum = judgeData && judgeData.rightCaseNum != null ? Number(judgeData.rightCaseNum) : 0;
        const caseScore = (allCaseNum > 0 && rightCaseNum >= 0) ? Math.max(0, Math.min(1, rightCaseNum / allCaseNum)) : 0;
        const overall = Math.max(0, Math.min(1, caseScore * qCoeff * oCoeff));
        const promptScore100 = Math.max(0, Math.min(100, qCoeff * 100));
        const overall100 = Math.max(0, Math.min(100, overall * 100));

        const en = judgeData ? (judgeData.enJudgeReplyDesc || '') : '';
        const zh = judgeData ? (judgeData.judgeReplyDesc || '') : '';
        const statusText = (en || zh || (judgeData ? `status=${judgeData.status}` : '') || '').toString();

        const qReasons = Array.isArray(q?.quality?.reasons) ? q.quality.reasons : [];
        const oReasons = Array.isArray(o?.originality_check?.reasons) ? o.originality_check.reasons : [];
        const qDims = (q && q.quality && q.quality.dims) ? q.quality.dims : {};
        const oCheck = (o && o.originality_check) ? o.originality_check : null;
        const fmt3 = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return '';
            return n.toFixed(3);
        };
        const dimRows = Object.keys(qDims || {}).map(k => {
            const v = qDims[k];
            if (k === 'chars') return `<div style="display:flex; gap:8px;"><span style="width:120px; color:#666;">${k}</span><span style="color:#111827; font-weight:700;">${this.escapeHtml(String(parseInt(String(v), 10) || 0))}</span></div>`;
            return `<div style="display:flex; gap:8px;"><span style="width:120px; color:#666;">${k}</span><span style="color:#111827; font-weight:700;">${this.escapeHtml(fmt3(v) || String(v ?? ''))}</span></div>`;
        }).join('');

        return `
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                    <div style="font-size: 12px; color:#666;">通过</div>
                    <div style="font-size: 18px; font-weight: 900; color:#111827;">${(allCaseNum > 0) ? `${rightCaseNum}/${allCaseNum}` : '—'}</div>
                </div>
                <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                    <div style="font-size: 12px; color:#666;">Prompt 评分</div>
                    <div style="font-size: 18px; font-weight: 900; color:#111827;">${promptScore100.toFixed(1)}/100</div>
                </div>
                <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                    <div style="font-size: 12px; color:#666;">原创系数</div>
                    <div style="font-size: 18px; font-weight: 900; color:#111827;">${Number.isFinite(oCoeff) ? oCoeff.toFixed(3) : '1.000'}</div>
                </div>
                <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                    <div style="font-size: 12px; color:#666;">综合评分</div>
                    <div style="font-size: 18px; font-weight: 900; color:#111827;">${overall100.toFixed(1)}/100</div>
                </div>
            </div>
            <div style="margin-top: 10px; font-size: 13px; color:#374151;">判题状态：${this.escapeHtml(statusText || '—')}</div>
            <details style="margin-top: 12px;">
                <summary style="cursor:pointer; font-size: 12px; color:#666;">展开查看 AI 评价</summary>
                <div style="margin-top: 8px; display:flex; flex-direction:column; gap:10px;">
                    <div style="font-size: 12px; color:#111827; font-weight: 900;">质量分项（dims）</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 12px;">
                        ${dimRows || '<div style="color:#999;">（无）</div>'}
                    </div>
                    <div style="font-size: 12px; color:#111827; font-weight: 900;">质量建议</div>
                    <ul style="margin:0; padding-left: 18px; color:#374151; line-height:1.6;">
                        ${(qReasons && qReasons.length) ? qReasons.map(x => `<li>${this.escapeHtml(String(x))}</li>`).join('') : `<li>（暂无）</li>`}
                    </ul>
                    ${o ? `
                    <div style="font-size: 12px; color:#111827; font-weight: 900;">原创检测</div>
                    <div style="font-size: 12px; color:#6b7280;">is_copy=${this.escapeHtml(String(!!(oCheck && oCheck.is_copy)))} · confidence=${this.escapeHtml(fmt3(oCheck?.confidence ?? 0) || '0.000')} · coeff=${this.escapeHtml(Number.isFinite(oCoeff) ? oCoeff.toFixed(3) : '1.000')}</div>
                    <ul style="margin:0; padding-left: 18px; color:#374151; line-height:1.6;">
                        ${(oReasons && oReasons.length) ? oReasons.map(x => `<li>${this.escapeHtml(String(x))}</li>`).join('') : `<li>（暂无）</li>`}
                    </ul>` : ''}
                </div>
            </details>
        `;
    }

    bindCodeChallengeEvents() {
        if (this.subTab !== 'code') return;
        const p = this.getCurrentCodeProblem();
        const sel = document.getElementById('pcg-problem-select');
        const runBtn = document.getElementById('pcg-run-btn');
        const promptEl = document.getElementById('pcg-prompt');
        const copyBtn = document.getElementById('pcg-copy-code');

        if (sel && !sel._bound) {
            sel._bound = true;
            sel.addEventListener('change', () => {
                this.selectedCodeProblemId = String(sel.value || '').trim();
                localStorage.setItem('prompt_code_problem_id', this.selectedCodeProblemId);
                // 切题后清空上一次 judge 结果，避免误读
                this.lastJudgeSubmitResp = null;
                this.lastJudgeStatusResp = null;
                this.lastJudgeTokenResp = null;
                this.lastPromptOnlyScoreData = null;
                // 重新渲染整个 code panel
                this.render();
            });
        }

        if (promptEl && !promptEl._bound) {
            promptEl._bound = true;
            promptEl.addEventListener('input', () => {
                localStorage.setItem(`prompt_code_prompt_${p.id}`, String(promptEl.value || ''));
            });
        }
        if (runBtn && !runBtn._bound) {
            runBtn._bound = true;
            runBtn.addEventListener('click', () => this.runCodeGenerateAndEvaluate());
        }
        if (copyBtn && !copyBtn._bound) {
            copyBtn._bound = true;
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(String(this.codegenCode || ''));
                    alert('已复制代码');
                } catch (e) {
                    alert('复制失败（浏览器权限限制）');
                }
            });
        }
    }

    async runCodeGenerateAndEvaluate() {
        // 合并：生成代码 + 立即提交评测（评测绑定生成时 Prompt 快照）
        if (this.codegenRunning || this.evalRunning) return;
        const p = this.getCurrentCodeProblem();
        const errEl = document.getElementById('pcg-error');
        const promptEl = document.getElementById('pcg-prompt');
        const runBtn = document.getElementById('pcg-run-btn');
        const codeEl = document.getElementById('pcg-code');
        const metaEl = document.getElementById('pcg-code-meta');
        const copyBtn = document.getElementById('pcg-copy-code');
        const resEl = document.getElementById('pcg-result');

        if (errEl) errEl.style.display = 'none';
        if (resEl) { resEl.style.display = 'none'; resEl.textContent = ''; }

        const userPrompt = String(promptEl ? promptEl.value : '').trim();
        if (!userPrompt) {
            if (errEl) { errEl.textContent = '请先填写 Prompt'; errEl.style.display = 'block'; }
            return;
        }
        // 保存用户输入
        localStorage.setItem(`prompt_code_prompt_${p.id}`, userPrompt);

        this.codegenRunning = true;
        this.evalRunning = true;
        if (runBtn) { runBtn.disabled = true; runBtn.textContent = '生成中...'; }
        if (codeEl) codeEl.textContent = '（生成中...）';
        if (metaEl) metaEl.textContent = '';
        if (copyBtn) copyBtn.style.display = 'none';

        // ====== 1) 生成代码（并保存 Prompt 快照）======
        const payload = {
            problemId: p.id,
            language: p.language,
            problemJson: {
                title: p.title,
                description: p.description,
                input_spec: p.inputSpec,
                output_spec: p.outputSpec,
                sample_input: p.sampleInput,
                sample_output: p.sampleOutput
            },
            prompt: userPrompt,
            model: localStorage.getItem('pc_model') || null,
        };

        let usedCode = '';
        let usedLang = String(p.language || 'cpp');
        try {
            const r = await this.apiService.promptCodeGenerate(payload);
            const code = String(r.code || '');
            const lang = String(r.language || p.language || 'cpp');
            const tokens = Number(r.tokens || 0);
            if (!code) throw new Error('后端未返回 code（接口待接入）');
            this.codegenCode = code;
            this.codegenLang = lang;
            this.codegenTokens = Number.isFinite(tokens) ? tokens : 0;
            this.codegenMeta = r.meta || null;
            usedCode = code;
            usedLang = lang;
            if (codeEl) codeEl.textContent = code;
            if (metaEl) metaEl.textContent = `lang=${lang}${this.codegenTokens ? ` · tokens=${this.codegenTokens}` : ''}`;
            if (copyBtn) copyBtn.style.display = '';
        } catch (e) {
            // 前端占位 demo：给一个可运行解（仅用于 UI 演示；后端接入后会覆盖）
            const demoCode = [
                '// Demo fallback (backend not connected yet)',
                '// Read 10 integers and print them in reverse order.',
                '#include <bits/stdc++.h>',
                'using namespace std;',
                'int main(){',
                '    ios::sync_with_stdio(false);',
                '    cin.tie(nullptr);',
                '    vector<long long> a; a.reserve(10);',
                '    long long x;',
                '    while (cin >> x) {',
                '        a.push_back(x);',
                '        if ((int)a.size() >= 10) break;',
                '    }',
                '    for (int i = (int)a.size() - 1; i >= 0; i--) {',
                '        if (i != (int)a.size() - 1) cout << " ";',
                '        cout << a[i];',
                '    }',
                '    return 0;',
                '}',
                ''
            ].join('\n');
            this.codegenCode = demoCode;
            this.codegenLang = 'cpp';
            this.codegenTokens = 0;
            usedCode = demoCode;
            usedLang = 'cpp';
            if (codeEl) codeEl.textContent = demoCode;
            if (metaEl) metaEl.textContent = '使用前端占位 Demo 代码（后端接口未接入）';
            if (copyBtn) copyBtn.style.display = '';
            if (errEl) {
                errEl.textContent = `后端生成接口不可用：${e?.message || 'unknown'}（已使用占位 Demo 代码）`;
                errEl.style.display = 'block';
            }
        }

        // 关键：绑定评测到“生成时 Prompt 快照 + 生成出来的 code”
        this.codegenPromptSnapshot = userPrompt;
        this.codegenPromptSnapshotAt = Date.now();
        this.codegenCodeSnapshot = usedCode;
        this.codegenLangSnapshot = usedLang;

        // ====== 2) 评测（使用快照 prompt，避免用户修改 prompt 投机）======
        try {
            if (runBtn) runBtn.textContent = '评测中...';

            const mode = 'normal';
            const qid = String(p.qid || '').trim();
            const promptSnap = String(this.codegenPromptSnapshot || '').trim();
            if (!promptSnap) throw new Error('评测失败：未获取到生成时 Prompt 快照');

            const quality = await this.apiService.promptQualityScore({ prompt: promptSnap, mode, debug: false });
            const orig = await this.apiService.promptOriginalityCheck({ qid, prompt: promptSnap, debug: false });
            this.lastPromptOnlyScoreData = { quality, originality: orig };

            // ====== 同时模拟“编程题提交”链路：提交生成代码（绑定 code 快照）======
            if (this.codegenCodeSnapshot) {
                const uid = this.state?.loggedInUserId ? String(this.state.loggedInUserId) : '';
                const accessToken = await this.apiService.judgeAccessToken();
                this.lastJudgeTokenResp = { ok: true, accessToken: accessToken ? `${String(accessToken).slice(0, 6)}***${String(accessToken).slice(-6)}` : '' };
                const judgePayload = {
                    content: String(this.codegenCodeSnapshot),
                    questionId: String(p.qid),
                    language: "2",
                    tagId: 0,
                    appId: 9,
                    userId: uid || "0",
                    submitType: 1,
                    remark: "{}",
                    token: accessToken || ""
                };
                const submitResp = await this.apiService.judgeSubmit(judgePayload);
                this.lastJudgeSubmitResp = submitResp;

                const extractSubmitId = (r) => {
                    try {
                        const d = r && r.data;
                        if (typeof d === 'number') return d;
                        if (typeof d === 'string') return d;
                        if (d && typeof d === 'object') {
                            if (d.id != null) return d.id;
                            if (d.submissionId != null) return d.submissionId;
                        }
                    } catch (e) { }
                    return null;
                };
                const submitId = (submitResp && submitResp.code === 0) ? extractSubmitId(submitResp) : null;
                if (submitId) {
                    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                    const isDone = (statusResp) => {
                        try {
                            const d = statusResp && statusResp.data ? statusResp.data : {};
                            const s = Number(d.status);
                            const en = String(d.enJudgeReplyDesc || '');
                            const enLower = en.toLowerCase();
                            if (enLower.includes('waiting') || enLower.includes('judging') || enLower.includes('pending') || enLower.includes('running')) return false;
                            const allCaseNum = d.allCaseNum != null ? Number(d.allCaseNum) : 0;
                            if (allCaseNum > 0 && d.testCaseResults) {
                                try {
                                    const arr = typeof d.testCaseResults === 'string' ? JSON.parse(d.testCaseResults) : d.testCaseResults;
                                    if (Array.isArray(arr) && arr.length >= allCaseNum) return true;
                                } catch (_) { /* ignore */ }
                            }
                            if (Number.isFinite(s) && [4, 5, 6, 7, 8, 13].includes(s)) return true;
                            if (en && enLower && !enLower.includes('waiting')) return true;
                            return false;
                        } catch (e) { return false; }
                    };

                    if (runBtn) runBtn.textContent = '等待评测中...';
                    const params = {
                        id: submitId,
                        tagId: 0,
                        appId: 9,
                        userId: uid || "0",
                        submitType: 1,
                        remark: "{}",
                        token: accessToken || ""
                    };
                    let last = null;
                    const deadline = Date.now() + 90_000;
                    while (Date.now() < deadline) {
                        last = await this.apiService.judgeSubmitStatus(params);
                        this.lastJudgeStatusResp = last;
                        if (last && last.code != null && Number(last.code) !== 0) break;
                        if (isDone(last)) break;
                        await sleep(1000);
                    }
                } else if (submitResp && submitResp.code === 0) {
                    this.lastJudgeStatusResp = { code: -1, msg: 'submit ok but missing id', data: submitResp.data };
                }
            }

            this.showCodeEvalModal();
        } catch (e) {
            if (errEl) {
                errEl.textContent = e?.message || '评测失败';
                errEl.style.display = 'block';
            }
        } finally {
            this.codegenRunning = false;
            this.evalRunning = false;
            if (runBtn) { runBtn.disabled = false; runBtn.textContent = '生成并提交评测'; }
        }
    }

    // 兼容旧入口（历史代码可能仍在调用），统一走合并链路
    async runCodeGenerate() {
        return await this.runCodeGenerateAndEvaluate();
    }

    // 兼容旧入口（历史代码可能仍在调用），统一走合并链路
    async runCodeEvaluate() {
        return await this.runCodeGenerateAndEvaluate();
    }

    async runCodeGenerate_DEPRECATED() {
        if (this.codegenRunning) return;
        const p = this.getCurrentCodeProblem();
        const errEl = document.getElementById('pcg-error');
        const promptEl = document.getElementById('pcg-prompt');
        const genBtn = document.getElementById('pcg-generate-btn');
        const evalBtn = document.getElementById('pcg-eval-btn');
        const codeEl = document.getElementById('pcg-code');
        const metaEl = document.getElementById('pcg-code-meta');
        const copyBtn = document.getElementById('pcg-copy-code');
        const resEl = document.getElementById('pcg-result');

        if (errEl) errEl.style.display = 'none';
        if (resEl) resEl.style.display = 'none';

        const userPrompt = String(promptEl ? promptEl.value : '').trim();
        if (!userPrompt) {
            if (errEl) { errEl.textContent = '请先填写 Prompt'; errEl.style.display = 'block'; }
            return;
        }

        // 保存用户输入
        localStorage.setItem(`prompt_code_prompt_${p.id}`, userPrompt);

        this.codegenRunning = true;
        if (genBtn) { genBtn.disabled = true; genBtn.textContent = '生成中...'; }
        if (evalBtn) { evalBtn.disabled = true; }
        if (codeEl) codeEl.textContent = '（生成中...）';
        if (metaEl) metaEl.textContent = '';
        if (copyBtn) copyBtn.style.display = 'none';

        const payload = {
            // Java 后端为表单参数（camelCase）
            problemId: p.id,
            language: p.language,
            // 后端接收 problemJson 字符串；ApiService 会自动 stringify
            problemJson: {
                title: p.title,
                description: p.description,
                input_spec: p.inputSpec,
                output_spec: p.outputSpec,
                sample_input: p.sampleInput,
                sample_output: p.sampleOutput
            },
            prompt: userPrompt,
            // 配置不让用户填：默认从 localStorage/后端环境走
            model: localStorage.getItem('pc_model') || null,
            // apiKey/baseUrl 由后端托管，不再从前端传参
        };

        try {
            const r = await this.apiService.promptCodeGenerate(payload);
            // 期望后端返回（Java 包装已在 ApiService 解包）：{code, language, tokens, meta}
            const code = String(r.code || '');
            const lang = String(r.language || p.language || 'cpp');
            const tokens = Number(r.tokens || 0);
            if (!code) throw new Error('后端未返回 code（接口待接入）');
            this.codegenCode = code;
            this.codegenLang = lang;
            this.codegenTokens = Number.isFinite(tokens) ? tokens : 0;
            this.codegenMeta = r.meta || null;
            if (codeEl) codeEl.textContent = code;
            if (metaEl) metaEl.textContent = `lang=${lang}${this.codegenTokens ? ` · tokens=${this.codegenTokens}` : ''}`;
            if (copyBtn) copyBtn.style.display = '';
            if (evalBtn) { evalBtn.disabled = false; evalBtn.classList.remove('modal-secondary'); }
        } catch (e) {
            // 前端占位 demo：给一个可运行解（仅用于 UI 演示；后端接入后会覆盖）
            const demoCode = [
                '// Demo fallback (backend not connected yet)',
                '// Read 10 integers and print them in reverse order.',
                '#include <bits/stdc++.h>',
                'using namespace std;',
                'int main(){',
                '    ios::sync_with_stdio(false);',
                '    cin.tie(nullptr);',
                '    vector<long long> a; a.reserve(10);',
                '    long long x;',
                '    while (cin >> x) {',
                '        a.push_back(x);',
                '        if ((int)a.size() >= 10) break;',
                '    }',
                '    for (int i = (int)a.size() - 1; i >= 0; i--) {',
                '        if (i != (int)a.size() - 1) cout << " ";',
                '        cout << a[i];',
                '    }',
                '    return 0;',
                '}',
                ''
            ].join('\n');
            this.codegenCode = demoCode;
            this.codegenLang = 'cpp';
            this.codegenTokens = 0;
            if (codeEl) codeEl.textContent = demoCode;
            if (metaEl) metaEl.textContent = '使用前端占位 Demo 代码（后端接口未接入）';
            if (copyBtn) copyBtn.style.display = '';
            if (evalBtn) evalBtn.disabled = false;
            if (errEl) {
                errEl.textContent = `后端生成接口不可用：${e?.message || 'unknown'}（已使用占位 Demo 代码）`;
                errEl.style.display = 'block';
            }
        } finally {
            this.codegenRunning = false;
            if (genBtn) { genBtn.disabled = false; genBtn.textContent = '生成代码'; }
        }
    }

    async runCodeEvaluate_DEPRECATED() {
        if (this.evalRunning) return;
        const p = this.getCurrentCodeProblem();
        const errEl = document.getElementById('pcg-error');
        const evalBtn = document.getElementById('pcg-eval-btn');
        const resEl = document.getElementById('pcg-result');
        if (errEl) errEl.style.display = 'none';

        // 这里“评测”改为：仅对 prompt 打分（质量分 + 原创度），不提交 code
        const qid = String(p.qid || '').trim();

        this.evalRunning = true;
        if (evalBtn) { evalBtn.disabled = true; evalBtn.textContent = '计算中...'; }
        if (resEl) { resEl.style.display = 'none'; resEl.textContent = ''; }

        try {
            const mode = 'normal';
            const prompt = String(localStorage.getItem(`prompt_code_prompt_${p.id}`) || '').trim();
            if (!prompt) throw new Error('请先填写 Prompt');

            const quality = await this.apiService.promptQualityScore({ prompt, mode, debug: false });
            let orig = null;
            orig = await this.apiService.promptOriginalityCheck({ qid, prompt, debug: false });
            const scoreData = { quality, originality: orig };
            this.lastPromptOnlyScoreData = scoreData;
            // 评测结果用弹窗展示（避免页面拥挤）

            // ====== 同时模拟“编程题提交”链路：token 先传空，观察报错 ======
            if (this.codegenCode) {
                const uid = this.state?.loggedInUserId ? String(this.state.loggedInUserId) : '';
                const accessToken = await this.apiService.judgeAccessToken();
                this.lastJudgeTokenResp = { ok: true, accessToken: accessToken ? `${String(accessToken).slice(0, 6)}***${String(accessToken).slice(-6)}` : '' };
                const judgePayload = {
                    content: String(this.codegenCode),
                    questionId: String(p.qid), // 352865
                    language: "2", // C++
                    tagId: 0,
                    appId: 9,
                    userId: uid || "0",
                    submitType: 1,
                    remark: "{}",
                    token: accessToken || ""
                };
                const submitResp = await this.apiService.judgeSubmit(judgePayload);
                this.lastJudgeSubmitResp = submitResp;

                // 如果 submit 成功并返回 id，则轮询一次 status
                const extractSubmitId = (r) => {
                    try {
                        const d = r && r.data;
                        if (typeof d === 'number') return d;
                        if (typeof d === 'string') return d;
                        if (d && typeof d === 'object') {
                            if (d.id != null) return d.id;
                            if (d.submissionId != null) return d.submissionId;
                        }
                    } catch (e) { }
                    return null;
                };
                const submitId = (submitResp && submitResp.code === 0) ? extractSubmitId(submitResp) : null;
                if (submitId) {
                    // 轮询直到判题结束
                    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                    const isDone = (statusResp) => {
                        try {
                            const d = statusResp && statusResp.data ? statusResp.data : {};
                            const s = Number(d.status);

                            // 1) 明确的“等待/评测中”文案：继续轮询
                            const en = String(d.enJudgeReplyDesc || '');
                            const enLower = en.toLowerCase();
                            if (enLower.includes('waiting') || enLower.includes('judging') || enLower.includes('pending') || enLower.includes('running')) return false;

                            // 2) 若已返回每个测试点结果（testCaseResults 长度 >= allCaseNum），认为判题结束
                            const allCaseNum = d.allCaseNum != null ? Number(d.allCaseNum) : 0;
                            if (allCaseNum > 0 && d.testCaseResults) {
                                try {
                                    const arr = typeof d.testCaseResults === 'string' ? JSON.parse(d.testCaseResults) : d.testCaseResults;
                                    if (Array.isArray(arr) && arr.length >= allCaseNum) return true;
                                } catch (_) { /* ignore parse errors */ }
                            }

                            // 3) 终态 status（补全 PE 等常见终态）
                            // 经验值：4/5/6/7/8/13 多为终态（WA/AC/RE/TLE/MLE/PE...）
                            if (Number.isFinite(s) && [4, 5, 6, 7, 8, 13].includes(s)) return true;

                            // 4) 若已经有明确的评测结论文案（非空且非 waiting），也可认为终态
                            if (en && enLower && !enLower.includes('waiting')) {
                                // 例如：Accepted/Wrong Answer/Presentation Error/Compile Error...
                                return true;
                            }

                            // 默认：继续等
                            return false;
                        } catch (e) {
                            return false;
                        }
                    };

                    this.judgePolling = true;
                    this.lastJudgeStatusResp = null;
                    // 轮询期间给用户明确反馈（结果最终用弹窗展示）
                    if (evalBtn) evalBtn.textContent = '等待评测中...';

                    const params = {
                        id: submitId,
                        tagId: 0,
                        appId: 9,
                        userId: uid || "0",
                        submitType: 1,
                        remark: "{}",
                        token: accessToken || ""
                    };

                    let last = null;
                    const deadline = Date.now() + 90_000; // 90s 上限，避免无限等待
                    while (Date.now() < deadline) {
                        last = await this.apiService.judgeSubmitStatus(params);
                        this.lastJudgeStatusResp = last;
                        if (last && last.code != null && Number(last.code) !== 0) break;
                        if (isDone(last)) break;
                        await sleep(1000);
                    }
                    this.judgePolling = false;
                    this.showCodeEvalModal();
                } else if (submitResp && submitResp.code === 0) {
                    // submit 成功但 id 结构不符合预期，方便排查
                    this.lastJudgeStatusResp = { code: -1, msg: 'submit ok but missing id', data: submitResp.data };
                    this.judgePolling = false;
                    this.showCodeEvalModal();
                }
            }
        } catch (e) {
            if (resEl) {
                resEl.style.display = 'block';
                resEl.innerHTML = `
                    <div style="font-size: 13px; color:#111827; font-weight: 900;">评测接口待接入</div>
                    <div style="margin-top: 6px; font-size: 12px; color:#6b7280; line-height:1.6;">${this.escapeHtml(e?.message || 'unknown')}</div>
                `;
            }
            if (errEl) {
                errEl.textContent = e?.message || '计算失败';
                errEl.style.display = 'block';
            }
        } finally {
            this.evalRunning = false;
            if (evalBtn) { evalBtn.disabled = false; evalBtn.textContent = '提交评测'; }
        }
    }

    escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    renderSimpleMarkdown(md) {
        const lines = String(md || '').replace(/\r/g, '').split('\n');
        const html = [];
        let listBuffer = [];
        const flushList = () => {
            if (!listBuffer.length) return;
            html.push(`<ul style="margin:8px 0; padding-left: 20px; color:#374151; line-height:1.7;">${listBuffer.join('')}</ul>`);
            listBuffer = [];
        };
        const inlineFormat = (text) => {
            let out = this.escapeHtml(text);
            out = out.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#111827;">$1</strong>');
            out = out.replace(/`([^`]+)`/g, '<code style="background:#f3f4f6; color:#111827; padding:1px 4px; border-radius:4px;">$1</code>');
            return out;
        };
        for (const rawLine of lines) {
            const line = String(rawLine || '');
            const trimmed = line.trim();
            if (!trimmed) {
                flushList();
                html.push('<div style="height:8px;"></div>');
                continue;
            }
            if (trimmed.startsWith('- ')) {
                listBuffer.push(`<li>${inlineFormat(trimmed.slice(2))}</li>`);
                continue;
            }
            flushList();
            if (trimmed.startsWith('## ')) {
                html.push(`<div style="margin-top:6px; font-size:14px; font-weight:900; color:#111827;">${inlineFormat(trimmed.slice(3))}</div>`);
                continue;
            }
            if (trimmed.startsWith('# ')) {
                html.push(`<div style="margin-top:6px; font-size:15px; font-weight:900; color:#111827;">${inlineFormat(trimmed.slice(2))}</div>`);
                continue;
            }
            html.push(`<div style="color:#374151; line-height:1.7;">${inlineFormat(trimmed)}</div>`);
        }
        flushList();
        return html.join('');
    }

    formatCompactNumber(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return '0';
        return n.toFixed(2).replace(/\.?0+$/, '');
    }
}


