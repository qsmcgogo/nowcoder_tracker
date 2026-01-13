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

        // sub tab: traditional | code
        this.subTab = localStorage.getItem('prompt_subtab') || 'traditional'; // traditional | code | rules

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
    }

    render() {
        if (!this.container) return;

        // 权限兜底：管理员 或 具备 Prompt 测试资格
        const canAccess = (this.state.canAccessPrompt && this.state.canAccessPrompt()) || this.state.isAdmin === true || this.state.isPromptTester === true;
        if (!canAccess) {
            this.container.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <div style="font-size: 18px; color: #999; margin-bottom: 12px;">暂无权限访问</div>
                    <div style="font-size: 14px; color: #ccc;">该页面后续将开放给 Prompt 测试人员</div>
                </div>
            `;
            return;
        }

        this.container.innerHTML = `
            <div class="achv-overview-card" style="margin-top:8px;">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <div style="font-size: 18px; font-weight: 900; color:#111827;">🧪 Prompt 评测</div>
                    <div style="font-size: 12px; color:#6b7280;">传统 Prompt / AI 编程题</div>
                </div>

                <div style="margin-top: 12px; display:grid; grid-template-columns: 220px 1fr; gap: 12px; align-items:start;">
                    <!-- Left: tabs -->
                    <div style="border:1px solid #f0f0f0; border-radius: 12px; background:#fff; overflow:hidden;">
                        <div style="padding: 10px 12px; border-bottom:1px solid #f0f0f0; font-size: 13px; font-weight: 800; color:#111827;">导航</div>
                        <div style="padding: 10px 12px; display:flex; flex-direction:column; gap:8px;">
                            <button id="prompt-subtab-traditional" class="admin-btn ${this.subTab === 'traditional' ? '' : 'modal-secondary'}" type="button" style="width:100%; justify-content:center;">传统 Prompt 题</button>
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
        this.bindCodeChallengeEvents();
    }

    bindEvents() {
        const btnTraditional = document.getElementById('prompt-subtab-traditional');
        const btnCode = document.getElementById('prompt-subtab-code');
        const btnRules = document.getElementById('prompt-subtab-rules');
        if (btnTraditional && !btnTraditional._bound) {
            btnTraditional._bound = true;
            btnTraditional.addEventListener('click', () => this.switchSubTab('traditional'));
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
        else if (tab === 'rules') this.subTab = 'rules';
        else this.subTab = 'traditional';
        localStorage.setItem('prompt_subtab', this.subTab);
        // 重新渲染整页，保证按钮/面板状态一致
        this.render();
    }

    renderRulesPanel() {
        return `
            <div style="border:1px solid #f0f0f0; border-radius: 12px; background:#fff; overflow:hidden;">
                <div style="padding: 12px; border-bottom:1px solid #f0f0f0; display:flex; gap:10px; align-items:center;">
                    <div style="font-size: 14px; font-weight: 900; color:#111827;">规则 / 提示</div>
                </div>
                <div style="padding: 12px; font-size: 13px; color:#374151; line-height:1.8;">
                    <div style="font-weight:900; color:#111827;">总分公式</div>
                    <div style="margin-top:4px;">
                        最终得分 = <b>用例通过得分</b> × <b>Prompt 质量分（quality_coeff）</b> × <b>原创质量分（originality_coeff）</b>。
                        所以别只追求“能做出来”，还要让 Prompt 稳定、可复现、少歧义、强约束，并避免粘贴题面/样例原文导致原创分被扣。
                    </div>

                    <div style="margin-top:12px; font-weight:900; color:#111827;">1) 传统 Prompt Challenge（分类/抽取/格式化输出）</div>
                    <div style="margin-top:6px; color:#111827; font-weight:800;">✅ 加分写法</div>
                    <ul style="margin:6px 0 0 0; padding-left: 18px;">
                        <li>明确输出格式：仅输出 JSON / 仅输出 POS|NEG|NEU；不要解释、不要多余字符</li>
                        <li>字段与约束写清楚：缺失信息怎么填、格式错误怎么处理</li>
                        <li>规则可执行：给判定规则/优先级（冲突时如何选）</li>
                        <li>结构化表达：分点/步骤写流程</li>
                        <li>自造小样例：给 1 个你自己造的 输入→输出（不要抄平台样例）</li>
                    </ul>
                    <div style="margin-top:8px; color:#111827; font-weight:800;">❌ 扣分雷区</div>
                    <ul style="margin:6px 0 0 0; padding-left: 18px;">
                        <li>粘贴题面或平台样例原文（尤其样例输入输出）→ 原创分可能扣</li>
                        <li>只写一句“帮我判断/抽取”，没有输出格式/约束/错误处理 → 质量分低</li>
                        <li>输出要求自相矛盾（又要解释又要 JSON）→ 质量分低</li>
                    </ul>
                    <div style="margin-top:8px; font-weight:800; color:#111827;">推荐模板（简版）</div>
                    <pre style="margin:6px 0 0 0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 10px;">你是严格的文本处理器。任务：{一句话说明要做什么}\n输出要求：仅输出 {JSON/标签}，不要解释/不要多余字符\n字段/约束：{字段名/类型/缺失如何填}\n判定规则：1) ... 2) ...\n边界：输入为空/信息缺失/格式错误如何处理\n示例（自造）：输入：... 输出：...</pre>

                    <div style="margin-top:14px; font-weight:900; color:#111827;">2) 编程题（AI 负责质量分+原创分，AC 走判题系统）</div>
                    <div style="margin-top:6px; color:#111827; font-weight:800;">✅ 加分写法</div>
                    <ul style="margin:6px 0 0 0; padding-left: 18px;">
                        <li>给思路/做法（算法/数据结构/关键步骤），不要复述题面</li>
                        <li>写清边界值与特判（空输入、极值、溢出、格式异常等）</li>
                        <li>给复杂度目标（如时间 O(n log n)、空间 O(n)）</li>
                        <li>明确输出要求：只输出代码、C++17、stdin/stdout、不要 markdown</li>
                        <li>结构化：分点步骤或伪代码</li>
                    </ul>
                    <div style="margin-top:8px; color:#111827; font-weight:800;">❌ 扣分雷区</div>
                    <ul style="margin:6px 0 0 0; padding-left: 18px;">
                        <li>直接粘贴题面/输入输出/样例原文 → 原创分风险极高</li>
                        <li>只说“给我一份能 AC 的代码”但不给任何可执行约束/边界 → 质量分低</li>
                    </ul>
                    <div style="margin-top:8px; font-weight:800; color:#111827;">推荐模板（简版）</div>
                    <pre style="margin:6px 0 0 0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 10px;">请生成 C++17 代码（stdin/stdout），只输出代码，不要解释/不要 markdown。\n解题思路：1) ... 2) ...\n关键细节/特判：...\n复杂度目标：时间 O(...), 空间 O(...)\n实现要求：long long/注意溢出/输出格式...</pre>
                </div>
            </div>
        `;
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
}


