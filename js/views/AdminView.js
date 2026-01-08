/**
 * 管理员视图
 * 只有管理员用户才能看到和访问此视图
 */

export class AdminView {
    constructor(elements, state, apiService) {
        this.container = elements.adminContainer;
        this.apiService = apiService;
        this.state = state;
        this.currentTab = 'clock'; // 'clock' | 'battle' | 'import' | 'yearReport' | 'tag' | 'contestDifficulty' | 'promptChallenge'
        this.clockPage = 1;
        this.battlePage = 1;
        this.battleSubTab = 'manage'; // 'manage' | 'histogram'
        this.tagPage = 1;
        this.tagKeyword = '';
        // 每日一题搜索条件
        this.clockSearchStartDate = null;
        this.clockSearchEndDate = null;
        // 批量导入 Tracker 题库到 acm_problem_open：保存最近一次结果便于复用
        this.importLastResult = null;
        // 管理员验数：年度报告
        this.adminYearReportLast = null;
        // Prompt Challenge demo
        this.promptChallengeListCache = null;
    }

    /**
     * 渲染管理员页面
     */
    render() {
        if (!this.container) {
            console.warn('[AdminView] admin-container not found');
            return;
        }

        // 检查管理员权限
        if (!this.state.isAdmin) {
            this.container.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <div style="font-size: 18px; color: #999; margin-bottom: 12px;">无权限访问</div>
                    <div style="font-size: 14px; color: #ccc;">此页面仅限管理员访问</div>
                </div>
            `;
            return;
        }

        // 渲染管理员页面内容
        this.container.innerHTML = `
            <div style="padding: 20px;">
                <h2 style="font-size: 24px; font-weight: 600; color: #333; margin-bottom: 24px;">
                    ⚙️ 管理员面板
                </h2>
                
                <!-- 标签页切换 -->
                <div style="display: flex; gap: 12px; margin-bottom: 24px; border-bottom: 2px solid #f0f0f0;">
                    <button id="admin-tab-clock" class="admin-tab-btn" style="padding: 12px 24px; border: none; background: transparent; font-size: 16px; font-weight: 600; color: #666; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px;">
                        每日一题管理
                    </button>
                    <button id="admin-tab-battle" class="admin-tab-btn" style="padding: 12px 24px; border: none; background: transparent; font-size: 16px; font-weight: 600; color: #666; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px;">
                        对战题目管理
                    </button>
                    <button id="admin-tab-tag" class="admin-tab-btn" style="padding: 12px 24px; border: none; background: transparent; font-size: 16px; font-weight: 600; color: #666; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px;">
                        知识点管理
                    </button>
                    <button id="admin-tab-import" class="admin-tab-btn" style="padding: 12px 24px; border: none; background: transparent; font-size: 16px; font-weight: 600; color: #666; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px;">
                        批量导入题库
                    </button>
                    <button id="admin-tab-year-report" class="admin-tab-btn" style="padding: 12px 24px; border: none; background: transparent; font-size: 16px; font-weight: 600; color: #666; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px;">
                        年度报告验数
                    </button>
                    <button id="admin-tab-contest-difficulty" class="admin-tab-btn" style="padding: 12px 24px; border: none; background: transparent; font-size: 16px; font-weight: 600; color: #666; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px;">
                        比赛难度更新
                    </button>
                    <button id="admin-tab-prompt-challenge" class="admin-tab-btn" style="padding: 12px 24px; border: none; background: transparent; font-size: 16px; font-weight: 600; color: #666; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px;">
                        Prompt 挑战评测
                    </button>
                </div>

                <!-- 每日一题管理 -->
                <div id="admin-clock-panel" class="admin-panel" style="display: block;">
                    ${this.renderClockPanel()}
                </div>

                <!-- 对战题目管理 -->
                <div id="admin-battle-panel" class="admin-panel" style="display: none;">
                    ${this.renderBattlePanel()}
                </div>

                <!-- Tracker 知识点管理 -->
                <div id="admin-tag-panel" class="admin-panel" style="display: none;">
                    ${this.renderTagPanel()}
                </div>

                <!-- 批量导入 Tracker 题库到 acm_problem_open -->
                <div id="admin-import-panel" class="admin-panel" style="display: none;">
                    ${this.renderImportPanel()}
                </div>

                <!-- 管理员验数：年度报告 -->
                <div id="admin-year-report-panel" class="admin-panel" style="display: none;">
                    ${this.renderAdminYearReportPanel()}
                </div>

                <!-- 比赛题目难度一键更新 -->
                <div id="admin-contest-difficulty-panel" class="admin-panel" style="display: none;">
                    ${this.renderContestDifficultyPanel()}
                </div>

                <!-- Prompt Challenge Demo（管理员工具） -->
                <div id="admin-prompt-challenge-panel" class="admin-panel" style="display: none;">
                    ${this.renderPromptChallengePanel()}
                </div>
            </div>
        `;

        // 绑定事件
        this.bindEvents();
        
        // 加载初始数据
        this.loadClockList();
        this.loadBattleList();
        this.loadTagList();
    }

    renderPromptChallengePanel() {
        const saved = {
            prompt: localStorage.getItem('pc_prompt') || '',
            mode: localStorage.getItem('pc_mode') || 'normal',
            // Dify 场景下 model 实际不参与调用，但为了减少每次手填，这里给一个默认值
            model: localStorage.getItem('pc_model') || 'doubao-seed-1-6-flash-250828',
            challengeId: localStorage.getItem('pc_challenge_id') || '',
            maxCases: localStorage.getItem('pc_max_cases') || ''
        };
        return `
            <div style="background:#fff; border:1px solid #e8e8e8; border-radius: 12px; padding: 16px;">
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div style="font-size: 16px; font-weight: 800; color:#333;">Prompt Challenge 评测（Demo）</div>
                    <div style="font-size: 12px; color:#999;">评分：final = CaseScore × QualityCoeff（启发式分项，仅用于验证闭环）</div>
                    <div style="flex:1;"></div>
                    <button id="pc-refresh-challenges" class="admin-btn modal-secondary" style="padding: 8px 12px;" type="button">刷新题单</button>
                </div>

                <div style="margin-top: 12px; display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size: 12px; color:#666;">挑战题</label>
                        <select id="pc-challenge-select" style="min-width:260px; padding: 8px 10px; border:1px solid #ddd; border-radius: 8px; font-size: 13px;">
                            <option value="">（加载中...）</option>
                        </select>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size: 12px; color:#666;">赛道</label>
                        <select id="pc-mode" style="min-width:140px; padding: 8px 10px; border:1px solid #ddd; border-radius: 8px; font-size: 13px;">
                            <option value="normal" ${saved.mode === 'normal' ? 'selected' : ''}>常规</option>
                            <option value="hacker" ${saved.mode === 'hacker' ? 'selected' : ''}>黑客（更偏短 prompt）</option>
                        </select>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size: 12px; color:#666;">maxCases</label>
                        <input id="pc-max-cases" value="${saved.maxCases}" placeholder="可不填"
                               style="width:120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 8px; font-size: 13px;" />
                    </div>
                    <div style="flex:1;"></div>
                    <button id="pc-run" class="admin-btn" style="padding: 9px 14px; font-weight:700;" type="button">开始评测</button>
                </div>

                <!-- 题目说明 / 样例 -->
                <div id="pc-challenge-preview" style="margin-top: 12px; display:none; border:1px solid #f0f0f0; border-radius: 12px; padding: 12px; background: linear-gradient(180deg, #fbfdff, #ffffff);">
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <div style="font-size: 13px; font-weight: 900; color:#111827;">题目说明</div>
                        <div style="flex:1;"></div>
                        <div id="pc-challenge-meta" style="font-size: 12px; color:#999;"></div>
                    </div>
                    <div id="pc-challenge-desc" style="margin-top: 8px; font-size: 13px; color:#374151; line-height: 1.65;"></div>
                    <div style="margin-top: 10px; display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <div style="font-size: 12px; color:#666; margin-bottom: 6px;">样例输入</div>
                            <pre id="pc-sample-input" style="margin:0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 10px; max-height: 160px; overflow:auto;"></pre>
                        </div>
                        <div>
                            <div style="font-size: 12px; color:#666; margin-bottom: 6px;">样例输出（期望）</div>
                            <pre id="pc-sample-output" style="margin:0; white-space:pre-wrap; word-break:break-word; background:#111827; color:#f9fafb; padding: 10px; border-radius: 10px; max-height: 160px; overflow:auto;"></pre>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 12px; display:flex; gap:12px; flex-wrap:wrap;">
                    <div style="flex:1; min-width: 320px;">
                        <label style="display:block; font-size: 12px; color:#666; margin-bottom: 6px;">Prompt</label>
                        <textarea id="pc-prompt" rows="8" placeholder="在这里粘贴/编辑提示词（建议包含：仅输出 + 格式约束 + 边界处理）"
                                  style="width:100%; padding: 10px; border:1px solid #ddd; border-radius: 10px; font-size: 13px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${saved.prompt}</textarea>
                    </div>
                    <div style="width: 360px; min-width: 320px;">
                        <div style="font-size: 12px; color:#666; margin-bottom: 6px;">模型配置（可选；不填走后端默认）</div>
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <div style="display:flex; gap:10px; align-items:center;">
                                <label style="width:72px; font-size: 12px; color:#666;">model</label>
                                <input id="pc-model" value="${saved.model}" placeholder="doubao-seed-1-6-flash-250828"
                                       style="flex:1; padding: 8px 10px; border:1px solid #ddd; border-radius: 8px; font-size: 13px;" />
                            </div>
                            <div style="font-size: 12px; color:#999; line-height: 1.5;">
                                说明：api_key/base_url 由后端托管，不再从前端传参。
                            </div>
                        </div>
                    </div>
                </div>

                <div id="pc-error" style="margin-top: 12px; font-size: 13px; color:#ff4d4f; display:none;"></div>

                <div id="pc-summary" style="margin-top: 12px; display:none; padding: 12px; border:1px solid #f0f0f0; border-radius: 12px; background: linear-gradient(180deg, #fbfdff, #ffffff);"></div>

                <div style="margin-top: 12px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="font-size: 13px; font-weight: 700; color:#333;">用例明细</div>
                        <div style="font-size: 12px; color:#999;">（pass=严格匹配归一化结果）</div>
                    </div>
                    <div id="pc-details" style="margin-top: 8px; border:1px solid #f0f0f0; border-radius: 12px; overflow:auto; max-height: 520px;">
                        <div style="padding: 18px; text-align:center; color:#999;">（尚未评测）</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染知识点管理面板（tracker_tag）
     */
    renderTagPanel() {
        const kw = this.tagKeyword || '';
        return `
            <div>
                <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items:center;">
                    <button id="admin-tag-add-btn" style="background: #52c41a; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        ➕ 新增知识点
                    </button>
                    <button id="admin-tag-batch-btn" style="background: #722ed1; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        📦 批量新增
                    </button>
                    <div style="flex:1;"></div>
                    <div style="display:flex; align-items:center; gap: 8px; flex-wrap: wrap;">
                        <label style="font-size: 14px; color: #666;">关键词:</label>
                        <input id="admin-tag-keyword" type="text" value="${kw}"
                               placeholder="按 tag_name / tag_desc 搜索"
                               style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; width: 240px;">
                        <button id="admin-tag-search-btn" style="background: #1890ff; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            搜索
                        </button>
                        <button id="admin-tag-reset-btn" style="background: #999; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            重置
                        </button>
                    </div>
                </div>

                <div id="admin-tag-list" style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; overflow: hidden;">
                    <div style="padding: 20px; text-align: center; color: #999;">加载中...</div>
                </div>

                <div id="admin-tag-pagination" style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 20px;"></div>
            </div>
        `;
    }

    renderAdminYearReportPanel() {
        const savedUid = localStorage.getItem('admin_year_report_uid') || '';
        const savedYear = localStorage.getItem('admin_year_report_year') || '0';
        const savedTrackerOnly = localStorage.getItem('admin_year_report_tracker_only') || 'true';
        const savedClearMirrorUid = localStorage.getItem('admin_clear_user_mirrors_uid') || '';

        // 注入样式
        this.injectVisualStyles();

        return `
            <div style="display:flex; flex-direction:column; gap: 16px;">
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    管理员验数：查看某用户年度报告（不走缓存）
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">GET /problem/tracker/admin/year-report</code><br>
                    用途：快速检查后端年报数据结构/口径是否符合预期，并预览可视化效果。
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">uid:</label>
                        <input id="admin-year-report-uid" type="number" value="${savedUid}" placeholder="必填"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">year:</label>
                        <input id="admin-year-report-year" type="number" value="${savedYear}" placeholder="0=当前年"
                               style="width: 100px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">trackerOnly:</label>
                        <input id="admin-year-report-tracker-only" type="checkbox" ${String(savedTrackerOnly) === 'true' ? 'checked' : ''} />
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-year-report-fetch-btn" style="background:#1890ff; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        拉取数据
                    </button>
                </div>

                <div id="admin-year-report-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>

                <!-- 可视化预览区域 -->
                <div id="admin-year-report-visuals" class="report-visuals-container" style="display:none;"></div>

                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回 JSON</div>
                    <pre id="admin-year-report-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 420px;">（尚未拉取）</pre>
                </div>
            </div>

            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    对战运维：清理某用户的所有镜像
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/battle/clear-user-mirrors?userId=xxx</code><br>
                    说明：仅清理 Redis 里的镜像数据（镜像池/分桶/用户索引/队列），用于紧急处理异常刷镜像用户。
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">userId:</label>
                        <input id="admin-clear-user-mirrors-uid" type="number" value="${savedClearMirrorUid}" placeholder="必填"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-clear-user-mirrors-btn" style="background:#ff4d4f; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        执行清理
                    </button>
                </div>

                <div id="admin-clear-user-mirrors-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>

                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回 JSON</div>
                    <pre id="admin-clear-user-mirrors-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 260px;">（尚未执行）</pre>
                </div>
            </div>
            </div>
        `;
    }

    /**
     * 渲染比赛题目难度一键更新面板
     */
    renderContestDifficultyPanel() {
        const savedContestId = localStorage.getItem('contest_difficulty_contest_id') || '';
        const savedAcRateMax = localStorage.getItem('contest_difficulty_ac_rate_max') || '85';

        return `
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    比赛题目难度一键更新
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    用于<strong>已结束比赛</strong>：基于「每题通过人数 + 参赛者当前平均 rating」一键计算该比赛所有题目的难度，并更新到表 <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">acm_problem_open.difficulty</code>。<br>
                    后端接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/admin/acm-contest/rebuild-problem-difficulty</code>
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">contestId:</label>
                        <input id="admin-contest-difficulty-contest-id" type="number" value="${savedContestId}" placeholder="必填：比赛ID"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">acRateMax:</label>
                        <input id="admin-contest-difficulty-ac-rate-max" type="number" min="1" max="100" value="${savedAcRateMax}" placeholder="默认85（1-100）"
                               style="width: 140px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="flex: 1;"></div>
                    <button id="admin-contest-difficulty-preview-btn" style="background:#722ed1; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        🔍 预览（不写库）
                    </button>
                    <button id="admin-contest-difficulty-submit-btn" style="background:#ff4d4f; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        ✅ 写入数据库
                    </button>
                </div>

                <div id="admin-contest-difficulty-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>

                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">计算结果</div>
                    <div id="admin-contest-difficulty-summary" style="margin-bottom: 12px; padding: 12px; background: #f5f5f5; border-radius: 6px; font-size: 13px; display: none;"></div>
                    <div id="admin-contest-difficulty-list" style="max-height: 500px; overflow-y: auto; border: 1px solid #e8e8e8; border-radius: 6px;">
                        <div style="padding: 20px; text-align: center; color: #999;">（尚未执行）</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染每日一题管理面板
     */
    renderClockPanel() {
        return `
            <div>
                <!-- 操作栏 -->
                <div style="display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
                    <button id="admin-clock-add-btn" style="background: #52c41a; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        ➕ 新增
                    </button>
                    <div style="flex: 1;"></div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 14px; color: #666;">开始日期:</label>
                        <input type="date" id="admin-clock-start-date" 
                               style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <label style="font-size: 14px; color: #666;">结束日期:</label>
                        <input type="date" id="admin-clock-end-date" 
                               style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <button id="admin-clock-search-btn" style="background: #1890ff; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            搜索
                        </button>
                        <button id="admin-clock-reset-btn" style="background: #999; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            重置
                        </button>
                    </div>
                </div>

                <!-- 快速定位 -->
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom: 20px;">
                    <div style="font-size: 13px; color:#666; font-weight: 600;">快速定位：</div>
                    <input id="admin-clock-find-question-id" type="number" placeholder="questionId"
                           style="width: 140px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    <input id="admin-clock-find-problem-id" type="number" placeholder="problemId"
                           style="width: 140px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    <button id="admin-clock-find-btn" style="background:#722ed1; color:#fff; border:none; padding: 8px 16px; border-radius: 4px; cursor:pointer; font-size: 14px;">
                        定位
                    </button>
                    <span style="font-size: 12px; color:#999;">二选一即可，两个都填会校验匹配</span>
                </div>

                <!-- 列表 -->
                <div id="admin-clock-list" style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; overflow: hidden;">
                    <div style="padding: 20px; text-align: center; color: #999;">加载中...</div>
                </div>

                <!-- 分页 -->
                <div id="admin-clock-pagination" style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 20px;">
                </div>
            </div>
        `;
    }

    /**
     * 渲染对战题目管理面板
     */
    renderBattlePanel() {
        return `
            <div>
                <!-- 二级页签 -->
                <div style="display:flex; gap:10px; align-items:center; margin-bottom: 14px; flex-wrap:wrap;">
                    <button id="admin-battle-subtab-manage"
                            style="padding: 8px 14px; border-radius: 999px; border: 1px solid ${this.battleSubTab === 'manage' ? '#1890ff' : '#ddd'}; background: ${this.battleSubTab === 'manage' ? '#e6f7ff' : '#fff'}; color: ${this.battleSubTab === 'manage' ? '#0958d9' : '#666'}; cursor:pointer; font-size: 13px; font-weight: 700;">
                        管理题目
                    </button>
                    <button id="admin-battle-subtab-histogram"
                            style="padding: 8px 14px; border-radius: 999px; border: 1px solid ${this.battleSubTab === 'histogram' ? '#1890ff' : '#ddd'}; background: ${this.battleSubTab === 'histogram' ? '#e6f7ff' : '#fff'}; color: ${this.battleSubTab === 'histogram' ? '#0958d9' : '#666'}; cursor:pointer; font-size: 13px; font-weight: 700;">
                        查看数量
                    </button>
                    <span style="font-size: 12px; color:#999;">难度桶：1~100, 101~200, …, 4901~5000（共 50 桶）</span>
                </div>

                <div id="admin-battle-subpanel-manage" style="display:${this.battleSubTab === 'manage' ? 'block' : 'none'};">
                <!-- 操作栏 -->
                <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                    <button id="admin-battle-add-btn" style="background: #52c41a; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        ➕ 新增
                    </button>
                    <button id="admin-battle-batch-add-btn" style="background: #1890ff; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        📦 批量添加
                    </button>
                    <button id="admin-battle-batch-delete-btn" style="background: #ff4d4f; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        🗑️ 批量删除
                    </button>
                    <div style="flex: 1;"></div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-right: 12px;">
                        <label style="font-size: 14px; color: #666;">题目ID:</label>
                        <input type="number" id="admin-battle-problem-id-search" placeholder="输入题目ID查询" 
                               style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; width: 150px;">
                        <button id="admin-battle-search-by-id-btn" style="background: #722ed1; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            查询
                        </button>
                    </div>
                    <input type="number" id="admin-battle-level-min" placeholder="最小难度" 
                           style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; width: 100px;">
                    <span style="color: #666;">-</span>
                    <input type="number" id="admin-battle-level-max" placeholder="最大难度" 
                           style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; width: 100px;">
                    <select id="admin-battle-order-by" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="id">ID</option>
                        <option value="levelScore">难度</option>
                        <option value="matchCount">匹配次数</option>
                        <option value="acCount">AC次数</option>
                        <option value="avgSeconds">平均用时</option>
                    </select>
                    <select id="admin-battle-order" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="DESC">降序</option>
                        <option value="ASC">升序</option>
                    </select>
                    <button id="admin-battle-search-btn" style="background: #1890ff; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        搜索
                    </button>
                </div>

                <!-- 列表 -->
                <div id="admin-battle-list" style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; overflow: hidden;">
                    <div style="padding: 20px; text-align: center; color: #999;">加载中...</div>
                </div>

                <!-- 分页 -->
                <div id="admin-battle-pagination" style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 20px;">
                </div>
                </div>

                <div id="admin-battle-subpanel-histogram" style="display:${this.battleSubTab === 'histogram' ? 'block' : 'none'};">
                    <div style="background:#fff; border:1px solid #e8e8e8; border-radius: 12px; padding: 14px;">
                        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                            <div style="font-size: 15px; font-weight: 800; color:#333;">难度分布柱状图</div>
                            <div style="flex:1;"></div>
                            <button id="admin-battle-histogram-refresh"
                                    style="background:#1890ff; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                                刷新
                            </button>
                        </div>
                        <div id="admin-battle-histogram-meta" style="margin-top: 8px; font-size: 13px; color:#666;"></div>
                        <div id="admin-battle-histogram-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                        <div id="admin-battle-histogram-chart"
                             style="margin-top: 12px; overflow:auto; border: 1px solid #f0f0f0; border-radius: 10px; padding: 12px; background: linear-gradient(180deg, #fbfdff, #ffffff);">
                            <div style="padding: 18px; text-align:center; color:#999;">（尚未加载）</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染批量导入面板：把 Tracker 题目导入 acm_problem_open
     */
    renderImportPanel() {
        const savedTagId = localStorage.getItem('tracker_import_source_tag_id') || '';
        const savedBatchSize = localStorage.getItem('tracker_import_batch_size') || '';
        const savedDryRun = localStorage.getItem('tracker_import_dry_run') || 'false';

        return `
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    批量将 Tracker 题目导入到 acm_problem_open
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    管理员只需要每行一个 <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">problemId</code>。<br>
                    后端接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /acm-problem-open/batch-import-tracker</code>
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">trackerSourceTagId:</label>
                        <input id="admin-import-tag-id" type="number" value="${savedTagId}" placeholder="可不填（走后端默认）"
                               style="width: 220px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">batchSize:</label>
                        <input id="admin-import-batch-size" type="number" min="1" max="500" value="${savedBatchSize}" placeholder="默认200（1-500）"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">dryRun:</label>
                        <input id="admin-import-dry-run" type="checkbox" ${String(savedDryRun) === 'true' ? 'checked' : ''} />
                        <span style="font-size: 12px; color:#999;">只统计不落库</span>
                    </div>
                    <div style="flex: 1;"></div>
                    <button id="admin-import-preview-btn" style="background:#722ed1; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        解析预览
                    </button>
                    <button id="admin-import-submit-btn" style="background:#1890ff; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        开始导入
                    </button>
                </div>

                <textarea id="admin-import-problem-ids" rows="14"
                          placeholder="每行一个 problemId，例如：&#10;1001&#10;1002&#10;1003"
                          style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 13px; resize: vertical;"></textarea>

                <div id="admin-import-preview" style="margin-top: 10px; font-size: 13px; color:#666;"></div>
                <div id="admin-import-error" style="margin-top: 10px; font-size: 13px; color:#ff4d4f; display:none;"></div>

                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">导入结果</div>
                    <pre id="admin-import-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 320px;">（尚未执行）</pre>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 标签页切换
        document.getElementById('admin-tab-clock').addEventListener('click', () => {
            this.switchTab('clock');
        });
        document.getElementById('admin-tab-battle').addEventListener('click', () => {
            this.switchTab('battle');
        });
        const tagTabBtn = document.getElementById('admin-tab-tag');
        if (tagTabBtn) {
            tagTabBtn.addEventListener('click', () => {
                this.switchTab('tag');
            });
        }
        document.getElementById('admin-tab-import').addEventListener('click', () => {
            this.switchTab('import');
        });
        document.getElementById('admin-tab-year-report').addEventListener('click', () => {
            this.switchTab('yearReport');
        });
        document.getElementById('admin-tab-contest-difficulty').addEventListener('click', () => {
            this.switchTab('contestDifficulty');
        });
        const pcTabBtn = document.getElementById('admin-tab-prompt-challenge');
        if (pcTabBtn) {
            pcTabBtn.addEventListener('click', () => {
                this.switchTab('promptChallenge');
            });
        }

        // 每日一题操作
        document.getElementById('admin-clock-add-btn').addEventListener('click', () => {
            this.showClockModal();
        });
        document.getElementById('admin-clock-search-btn').addEventListener('click', () => {
            this.handleClockSearch();
        });
        document.getElementById('admin-clock-reset-btn').addEventListener('click', () => {
            this.resetClockSearch();
        });
        const clockFindBtn = document.getElementById('admin-clock-find-btn');
        if (clockFindBtn) clockFindBtn.addEventListener('click', () => this.handleClockFind());

        // 对战题目操作
        document.getElementById('admin-battle-add-btn').addEventListener('click', () => {
            this.showBattleModal();
        });
        document.getElementById('admin-battle-batch-add-btn').addEventListener('click', () => {
            this.showBattleBatchAddModal();
        });
        document.getElementById('admin-battle-batch-delete-btn').addEventListener('click', () => {
            this.handleBatchDelete();
        });
        document.getElementById('admin-battle-search-btn').addEventListener('click', () => {
            this.loadBattleList();
        });
        document.getElementById('admin-battle-search-by-id-btn').addEventListener('click', () => {
            this.searchBattleByProblemId();
        });

        // 对战二级页签
        const battleManageBtn = document.getElementById('admin-battle-subtab-manage');
        const battleHistBtn = document.getElementById('admin-battle-subtab-histogram');
        if (battleManageBtn) battleManageBtn.addEventListener('click', () => this.setBattleSubTab('manage'));
        if (battleHistBtn) battleHistBtn.addEventListener('click', () => this.setBattleSubTab('histogram'));
        const histRefreshBtn = document.getElementById('admin-battle-histogram-refresh');
        if (histRefreshBtn) histRefreshBtn.addEventListener('click', () => this.loadBattleDifficultyHistogram());

        // 批量导入（如果 DOM 已渲染）
        const previewBtn = document.getElementById('admin-import-preview-btn');
        const submitBtn = document.getElementById('admin-import-submit-btn');
        if (previewBtn) previewBtn.addEventListener('click', () => this.previewImportIds());
        if (submitBtn) submitBtn.addEventListener('click', () => this.submitImportIds());

        // 年度报告验数
        const yrBtn = document.getElementById('admin-year-report-fetch-btn');
        if (yrBtn) yrBtn.addEventListener('click', () => this.fetchAdminYearReport());

        // 对战运维：清理某用户镜像
        const clearMirrorsBtn = document.getElementById('admin-clear-user-mirrors-btn');
        if (clearMirrorsBtn) clearMirrorsBtn.addEventListener('click', () => this.adminClearUserMirrors());

        // 知识点管理
        const tagAddBtn = document.getElementById('admin-tag-add-btn');
        const tagBatchBtn = document.getElementById('admin-tag-batch-btn');
        const tagSearchBtn = document.getElementById('admin-tag-search-btn');
        const tagResetBtn = document.getElementById('admin-tag-reset-btn');
        if (tagAddBtn) tagAddBtn.addEventListener('click', () => this.showTagModal(null));
        if (tagBatchBtn) tagBatchBtn.addEventListener('click', () => this.showTagBatchModal());
        if (tagSearchBtn) tagSearchBtn.addEventListener('click', () => this.handleTagSearch());
        if (tagResetBtn) tagResetBtn.addEventListener('click', () => this.resetTagSearch());
        const kwInput = document.getElementById('admin-tag-keyword');
        if (kwInput) {
            kwInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleTagSearch();
            });
        }

        // 比赛题目难度更新
        const contestPreviewBtn = document.getElementById('admin-contest-difficulty-preview-btn');
        const contestSubmitBtn = document.getElementById('admin-contest-difficulty-submit-btn');
        if (contestPreviewBtn) contestPreviewBtn.addEventListener('click', () => this.handleContestDifficultyPreview());
        if (contestSubmitBtn) contestSubmitBtn.addEventListener('click', () => this.handleContestDifficultySubmit());

        // Prompt Challenge demo
        const pcRefreshBtn = document.getElementById('pc-refresh-challenges');
        if (pcRefreshBtn) pcRefreshBtn.addEventListener('click', () => this.loadPromptChallengeList(true));
        const pcRunBtn = document.getElementById('pc-run');
        if (pcRunBtn) pcRunBtn.addEventListener('click', () => this.runPromptChallengeEvaluate());
    }

    async adminClearUserMirrors() {
        const uidInput = document.getElementById('admin-clear-user-mirrors-uid');
        const errorEl = document.getElementById('admin-clear-user-mirrors-error');
        const resultEl = document.getElementById('admin-clear-user-mirrors-result');
        const btn = document.getElementById('admin-clear-user-mirrors-btn');

        if (!uidInput || !errorEl || !resultEl || !btn) return;
        errorEl.style.display = 'none';

        const uid = parseInt(String(uidInput.value || '').trim(), 10);
        if (!uid || uid <= 0) {
            errorEl.textContent = '请填写有效的 userId（正整数）';
            errorEl.style.display = 'block';
            return;
        }

        localStorage.setItem('admin_clear_user_mirrors_uid', String(uid));

        const ok = confirm(
            `确认清理该用户的所有镜像？\n\nuserId=${uid}\n\n说明：只清理 Redis 镜像数据（镜像池/分桶/索引/队列），用于紧急处理异常刷镜像。`
        );
        if (!ok) return;

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '清理中...';
        resultEl.textContent = `请求中...\nuserId=${uid}\n`;

        try {
            const data = await this.apiService.adminClearUserMirrors(uid);
            resultEl.textContent = JSON.stringify(data, null, 2);
            alert(`清理完成：total=${data?.total ?? '-'}，removed=${data?.removed ?? '-'}，missing=${data?.missing ?? '-'}`);
        } catch (e) {
            const msg = e && e.message ? e.message : '清理失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '执行清理';
        }
    }

    /**
     * 切换标签页
     */
    switchTab(tab) {
        this.currentTab = tab;
        const clockPanel = document.getElementById('admin-clock-panel');
        const battlePanel = document.getElementById('admin-battle-panel');
        const tagPanel = document.getElementById('admin-tag-panel');
        const importPanel = document.getElementById('admin-import-panel');
        const yearReportPanel = document.getElementById('admin-year-report-panel');
        const contestDifficultyPanel = document.getElementById('admin-contest-difficulty-panel');
        const pcPanel = document.getElementById('admin-prompt-challenge-panel');
        const clockBtn = document.getElementById('admin-tab-clock');
        const battleBtn = document.getElementById('admin-tab-battle');
        const tagBtn = document.getElementById('admin-tab-tag');
        const importBtn = document.getElementById('admin-tab-import');
        const yearReportBtn = document.getElementById('admin-tab-year-report');
        const contestDifficultyBtn = document.getElementById('admin-tab-contest-difficulty');
        const pcBtn = document.getElementById('admin-tab-prompt-challenge');

        // hide all
        clockPanel.style.display = 'none';
        battlePanel.style.display = 'none';
        if (tagPanel) tagPanel.style.display = 'none';
        if (importPanel) importPanel.style.display = 'none';
        if (yearReportPanel) yearReportPanel.style.display = 'none';
        if (contestDifficultyPanel) contestDifficultyPanel.style.display = 'none';
        if (pcPanel) pcPanel.style.display = 'none';

        // reset btn styles
        clockBtn.style.color = '#666';
        clockBtn.style.borderBottomColor = 'transparent';
        battleBtn.style.color = '#666';
        battleBtn.style.borderBottomColor = 'transparent';
        if (tagBtn) {
            tagBtn.style.color = '#666';
            tagBtn.style.borderBottomColor = 'transparent';
        }
        if (importBtn) {
            importBtn.style.color = '#666';
            importBtn.style.borderBottomColor = 'transparent';
        }
        if (yearReportBtn) {
            yearReportBtn.style.color = '#666';
            yearReportBtn.style.borderBottomColor = 'transparent';
        }
        if (contestDifficultyBtn) {
            contestDifficultyBtn.style.color = '#666';
            contestDifficultyBtn.style.borderBottomColor = 'transparent';
        }
        if (pcBtn) {
            pcBtn.style.color = '#666';
            pcBtn.style.borderBottomColor = 'transparent';
        }

        if (tab === 'clock') {
            clockPanel.style.display = 'block';
            clockBtn.style.color = '#1890ff';
            clockBtn.style.borderBottomColor = '#1890ff';
        } else if (tab === 'battle') {
            battlePanel.style.display = 'block';
            battleBtn.style.color = '#1890ff';
            battleBtn.style.borderBottomColor = '#1890ff';
            // 切到对战面板时，确保二级页签状态正确；若在 histogram 则拉取数据
            try { this.setBattleSubTab(this.battleSubTab || 'manage'); } catch (_) {}
        } else if (tab === 'tag' && tagPanel) {
            tagPanel.style.display = 'block';
            if (tagBtn) {
                tagBtn.style.color = '#1890ff';
                tagBtn.style.borderBottomColor = '#1890ff';
            }
            this.loadTagList(this.tagPage || 1);
        } else if (tab === 'import' && importPanel) {
            importPanel.style.display = 'block';
            if (importBtn) {
                importBtn.style.color = '#1890ff';
                importBtn.style.borderBottomColor = '#1890ff';
            }
        } else if (tab === 'yearReport' && yearReportPanel) {
            yearReportPanel.style.display = 'block';
            if (yearReportBtn) {
                yearReportBtn.style.color = '#1890ff';
                yearReportBtn.style.borderBottomColor = '#1890ff';
            }
        } else if (tab === 'contestDifficulty' && contestDifficultyPanel) {
            // 强制渲染：避免某些环境下初次渲染丢失/被清空导致 tab 内容为空
            contestDifficultyPanel.innerHTML = this.renderContestDifficultyPanel();
            // 重新绑定按钮事件（因为 innerHTML 重新注入会丢失事件）
            const contestPreviewBtn = document.getElementById('admin-contest-difficulty-preview-btn');
            const contestSubmitBtn = document.getElementById('admin-contest-difficulty-submit-btn');
            if (contestPreviewBtn) contestPreviewBtn.addEventListener('click', () => this.handleContestDifficultyPreview());
            if (contestSubmitBtn) contestSubmitBtn.addEventListener('click', () => this.handleContestDifficultySubmit());

            contestDifficultyPanel.style.display = 'block';
            if (contestDifficultyBtn) {
                contestDifficultyBtn.style.color = '#1890ff';
                contestDifficultyBtn.style.borderBottomColor = '#1890ff';
            }
        } else if (tab === 'promptChallenge' && pcPanel) {
            // 强制渲染：避免之前 tab 的 innerHTML 覆盖影响
            pcPanel.innerHTML = this.renderPromptChallengePanel();
            // 重新绑定按钮事件
            const pcRefreshBtn = document.getElementById('pc-refresh-challenges');
            if (pcRefreshBtn) pcRefreshBtn.addEventListener('click', () => this.loadPromptChallengeList(true));
            const pcRunBtn = document.getElementById('pc-run');
            if (pcRunBtn) pcRunBtn.addEventListener('click', () => this.runPromptChallengeEvaluate());

            pcPanel.style.display = 'block';
            if (pcBtn) {
                pcBtn.style.color = '#1890ff';
                pcBtn.style.borderBottomColor = '#1890ff';
            }
            // 首次进入自动拉取题单
            this.loadPromptChallengeList(false);
        }
    }

    async loadPromptChallengeList(force = false) {
        const select = document.getElementById('pc-challenge-select');
        const errorEl = document.getElementById('pc-error');
        if (!select) return;
        if (errorEl) errorEl.style.display = 'none';

        if (!force && Array.isArray(this.promptChallengeListCache) && this.promptChallengeListCache.length > 0) {
            this.renderPromptChallengeOptions(select, this.promptChallengeListCache);
            this.updatePromptChallengePreview();
            return;
        }

        select.innerHTML = `<option value="">（加载中...）</option>`;
        try {
            const list = await this.apiService.promptChallengeList();
            this.promptChallengeListCache = Array.isArray(list) ? list : [];
            this.renderPromptChallengeOptions(select, this.promptChallengeListCache);
            this.updatePromptChallengePreview();
        } catch (e) {
            const msg = e && e.message ? e.message : '加载失败';
            select.innerHTML = `<option value="">（加载失败）</option>`;
            if (errorEl) {
                errorEl.textContent = `题单加载失败：${msg}`;
                errorEl.style.display = 'block';
            }
        }
    }

    renderPromptChallengeOptions(selectEl, list) {
        const savedId = localStorage.getItem('pc_challenge_id') || '';
        const opts = ['<option value="">请选择挑战题</option>'];
        for (const ch of (list || [])) {
            const id = String(ch.id || '');
            const name = String(ch.name || id);
            const cnt = Number(ch.case_count || 0);
            opts.push(`<option value="${id}" ${savedId === id ? 'selected' : ''}>${name}（${cnt}）</option>`);
        }
        selectEl.innerHTML = opts.join('');
        // 如果没有 saved，默认选第一个可用
        const cur = selectEl.value;
        if (!cur) {
            const first = (list || []).find(x => x && x.id);
            if (first) selectEl.value = String(first.id);
        }
        // 绑定变更保存
        selectEl.addEventListener('change', () => {
            localStorage.setItem('pc_challenge_id', String(selectEl.value || ''));
            this.updatePromptChallengePreview();
        });
    }

    updatePromptChallengePreview() {
        const preview = document.getElementById('pc-challenge-preview');
        const metaEl = document.getElementById('pc-challenge-meta');
        const descEl = document.getElementById('pc-challenge-desc');
        const sinEl = document.getElementById('pc-sample-input');
        const soutEl = document.getElementById('pc-sample-output');
        const select = document.getElementById('pc-challenge-select');
        if (!preview || !descEl || !sinEl || !soutEl || !select) return;

        const cid = String(select.value || '').trim();
        const list = Array.isArray(this.promptChallengeListCache) ? this.promptChallengeListCache : [];
        const ch = list.find(x => x && String(x.id || '') === cid);
        if (!ch) {
            preview.style.display = 'none';
            return;
        }
        const name = String(ch.name || ch.id || '');
        const cnt = Number(ch.case_count || 0);
        const type = String(ch.type || '');
        const desc = String(ch.description || '').trim();
        const sampleIn = String(ch.sample_input || '');
        const sampleOut = String(ch.sample_output || '');

        if (metaEl) metaEl.textContent = `${name}${type ? ` · ${type}` : ''}${Number.isFinite(cnt) ? ` · ${cnt} cases` : ''}`;
        descEl.textContent = desc || '（暂无说明）';
        sinEl.textContent = sampleIn || '（暂无样例）';
        soutEl.textContent = sampleOut || '（暂无样例）';
        preview.style.display = 'block';
    }

    async runPromptChallengeEvaluate() {
        const errorEl = document.getElementById('pc-error');
        const summaryEl = document.getElementById('pc-summary');
        const detailsEl = document.getElementById('pc-details');
        const btn = document.getElementById('pc-run');

        const challengeSel = document.getElementById('pc-challenge-select');
        const promptEl = document.getElementById('pc-prompt');
        const modeEl = document.getElementById('pc-mode');
        const modelEl = document.getElementById('pc-model');
        const maxCasesEl = document.getElementById('pc-max-cases');

        if (errorEl) errorEl.style.display = 'none';
        if (summaryEl) summaryEl.style.display = 'none';
        if (detailsEl) detailsEl.innerHTML = `<div style="padding: 18px; text-align:center; color:#999;">评测中...</div>`;

        const challengeId = challengeSel ? String(challengeSel.value || '').trim() : '';
        const prompt = promptEl ? String(promptEl.value || '') : '';
        const mode = modeEl ? String(modeEl.value || 'normal') : 'normal';

        if (!challengeId) {
            if (errorEl) { errorEl.textContent = '请先选择挑战题'; errorEl.style.display = 'block'; }
            return;
        }
        if (!prompt.trim()) {
            if (errorEl) { errorEl.textContent = '请填写 Prompt'; errorEl.style.display = 'block'; }
            return;
        }

        // 保存输入（本地）
        localStorage.setItem('pc_prompt', prompt);
        localStorage.setItem('pc_mode', mode);
        if (modelEl) localStorage.setItem('pc_model', String(modelEl.value || ''));
        localStorage.setItem('pc_challenge_id', challengeId);
        if (maxCasesEl) localStorage.setItem('pc_max_cases', String(maxCasesEl.value || ''));

        const payload = {
            // Java 后端为表单参数（camelCase）；ApiService 也兼容 snake_case，但这里统一用 camelCase 更清晰
            challengeId,
            prompt,
            mode,
            model: modelEl ? String(modelEl.value || '').trim() || null : null,
            maxCases: (maxCasesEl && String(maxCasesEl.value || '').trim()) ? Number(maxCasesEl.value) : null,
            debug: true
        };
        // 记录本次请求（用于页面 log 展示，注意脱敏）
        this.lastPromptChallengePayload = payload;

        const oldText = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = '评测中...'; }

        try {
            const res = await this.apiService.promptChallengeEvaluate(payload);
            this.renderPromptChallengeResult(res);
        } catch (e) {
            const msg = e && e.message ? e.message : '评测失败';
            if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
            if (detailsEl) detailsEl.innerHTML = `<div style="padding: 18px; text-align:center; color:#ff4d4f;">失败：${msg}</div>`;
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = oldText || '开始评测'; }
        }
    }

    renderPromptChallengeResult(res) {
        const summaryEl = document.getElementById('pc-summary');
        const detailsEl = document.getElementById('pc-details');
        if (!summaryEl || !detailsEl) return;

        const total = Number(res.total || 0);
        const passed = Number(res.passed || 0);
        const caseScore = Number(res.case_score || 0);
        const q = res.quality || {};
        const qCoeff = Number(res.quality_coeff || q.coeff || 1);
        const finalScore = Number(res.final_score || 0);
        const finalBeforeCopy = Number(res.final_score_before_copy || 0);
        const copyPenalty = (res.copy_penalty != null) ? Number(res.copy_penalty) : 1;
        const copyCheck = res.copy_check || null;
        const tokens = Number(res.tokens || 0);

        const dims = (q && q.dims) ? q.dims : {};
        const _fmtDim = (k, v) => {
            try {
                if (k === 'chars') return String(parseInt(String(v), 10) || 0);
                if (typeof v === 'number' && Number.isFinite(v)) return v.toFixed(3);
                const fv = Number(v);
                if (Number.isFinite(fv)) return fv.toFixed(3);
                return String(v ?? '');
            } catch (e) {
                return String(v ?? '');
            }
        };
        const dimRows = Object.keys(dims).map(k => `<div style="display:flex; gap:8px;"><span style="width:120px; color:#666;">${k}</span><span style="color:#111827; font-weight:700;">${this.escapeHtml(_fmtDim(k, dims[k]))}</span></div>`).join('');
        const reasons = Array.isArray(q.reasons) ? q.reasons : [];

        summaryEl.innerHTML = `
            <div style="display:flex; gap:14px; flex-wrap:wrap; align-items:flex-start;">
                <div style="min-width: 260px;">
                    <div style="font-size: 12px; color:#666;">挑战</div>
                    <div style="font-size: 14px; font-weight: 800; color:#111827;">${res.challenge_name || res.challenge_id || '-'}</div>
                    ${copyCheck ? `
                    <div style="margin-top: 8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <div style="padding: 2px 8px; border-radius: 999px; border:1px solid ${copyCheck.is_copy ? '#ffccc7' : '#b7eb8f'}; background:#fff; font-size: 12px; font-weight: 800; color:${copyCheck.is_copy ? '#a8071a' : '#135200'};">
                            ${copyCheck.is_copy ? '疑似复制题面' : '未发现复制'}
                        </div>
                        <div style="font-size: 12px; color:#999;">confidence=${(Number(copyCheck.confidence || 0)).toFixed(3)}</div>
                        <div style="font-size: 12px; color:#999;">penalty=${Number.isFinite(copyPenalty) ? copyPenalty.toFixed(3) : '1.000'}</div>
                    </div>` : ``}
                    <div style="margin-top: 10px; display:flex; gap:10px; flex-wrap:wrap;">
                        <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                            <div style="font-size: 12px; color:#666;">CaseScore</div>
                            <div style="font-size: 18px; font-weight: 900; color:#111827;">${(caseScore * 100).toFixed(3)}%</div>
                            <div style="font-size: 12px; color:#999;">${passed}/${total}</div>
                        </div>
                        <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                            <div style="font-size: 12px; color:#666;">QualityCoeff</div>
                            <div style="font-size: 18px; font-weight: 900; color:#111827;">${qCoeff.toFixed(3)}</div>
                            <div style="font-size: 12px; color:#999;">mode=${res.mode || '-'}</div>
                        </div>
                        <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                            <div style="font-size: 12px; color:#666;">Final</div>
                            <div style="font-size: 18px; font-weight: 900; color:#111827;">${(finalScore * 100).toFixed(3)}%</div>
                            <div style="font-size: 12px; color:#999;">beforeCopy=${(finalBeforeCopy * 100).toFixed(3)}% · tokens=${tokens}</div>
                        </div>
                    </div>
                </div>
                <div style="flex:1; min-width: 320px;">
                    <div style="font-size: 12px; color:#666;">质量分项（启发式）</div>
                    <div style="margin-top: 6px; display:grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 12px;">
                        ${dimRows || '<div style="color:#999;">（无）</div>'}
                    </div>
                    <div style="margin-top: 10px; font-size: 12px; color:#666;">
                        <div style="font-weight: 800; color:#111827; margin-bottom: 6px;">建议</div>
                        <ul style="margin:0; padding-left: 18px; color:#374151; line-height:1.6;">
                            ${reasons.map(x => `<li>${String(x)}</li>`).join('')}
                        </ul>
                    </div>
                    ${copyCheck && Array.isArray(copyCheck.reasons) && copyCheck.reasons.length ? `
                    <div style="margin-top: 10px; font-size: 12px; color:#666;">
                        <div style="font-weight: 800; color:#111827; margin-bottom: 6px;">复制检测原因</div>
                        <ul style="margin:0; padding-left: 18px; color:#374151; line-height:1.6;">
                            ${copyCheck.reasons.map(x => `<li>${String(x)}</li>`).join('')}
                        </ul>
                    </div>` : ``}
                </div>
            </div>

            <details style="margin-top: 12px;">
                <summary style="cursor:pointer; font-size: 12px; color:#666;">本次请求（log，api_key 已脱敏）</summary>
                <pre style="margin:8px 0 0 0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 10px; max-height: 260px; overflow:auto;">${this.escapeHtml(JSON.stringify(this.maskPromptChallengePayload(this.lastPromptChallengePayload), null, 2))}</pre>
            </details>
            <details style="margin-top: 10px;">
                <summary style="cursor:pointer; font-size: 12px; color:#666;">原始返回 JSON（log）</summary>
                <pre style="margin:8px 0 0 0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 10px; max-height: 320px; overflow:auto;">${this.escapeHtml(JSON.stringify(res || {}, null, 2))}</pre>
            </details>
        `;
        summaryEl.style.display = 'block';

        const rows = (res.details || []).map((d, i) => {
            const ok = !!d.pass;
            const bg = ok ? '#f6ffed' : '#fff2f0';
            const bd = ok ? '#b7eb8f' : '#ffccc7';
            const t = (d && (d.tokens ?? d.token ?? d.used_tokens)) != null ? Number(d.tokens ?? d.token ?? d.used_tokens) : null;
            return `
                <div style="border-top:1px solid #f0f0f0; padding: 12px; background:${bg};">
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <div style="font-weight: 900; color:#111827;">Case ${d.case || (i + 1)}</div>
                        <div style="padding: 2px 8px; border-radius: 999px; border:1px solid ${bd}; background:#fff; font-size: 12px; font-weight: 800; color:${ok ? '#135200' : '#a8071a'};">
                            ${ok ? 'PASS' : 'FAIL'}
                        </div>
                        ${t != null && Number.isFinite(t) ? `<div style="font-size: 12px; color:#999;">tokens=${t}</div>` : ``}
                    </div>
                    <div style="margin-top: 8px; display:grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items:start;">
                        <div>
                            <div style="font-size: 12px; color:#666; margin-bottom: 6px;">input</div>
                            <pre style="margin:0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 10px; max-height: 160px; overflow:auto;">${this.escapeHtml(String(d.input || ''))}</pre>
                        </div>
                        <div>
                            <div style="font-size: 12px; color:#666; margin-bottom: 6px;">expected / prediction</div>
                            <div style="display:flex; gap:10px;">
                                <pre style="flex:1; margin:0; white-space:pre-wrap; word-break:break-word; background:#111827; color:#f9fafb; padding: 10px; border-radius: 10px; max-height: 160px; overflow:auto;">${this.escapeHtml(String(d.expected || ''))}</pre>
                                <pre style="flex:1; margin:0; white-space:pre-wrap; word-break:break-word; background:#111827; color:#f9fafb; padding: 10px; border-radius: 10px; max-height: 160px; overflow:auto;">${this.escapeHtml(String(d.prediction || ''))}</pre>
                            </div>
                        </div>
                    </div>
                    <details style="margin-top: 10px;">
                        <summary style="cursor:pointer; font-size: 12px; color:#666;">raw_output（展开）</summary>
                        <pre style="margin:8px 0 0 0; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e6edf3; padding: 10px; border-radius: 10px; max-height: 200px; overflow:auto;">${this.escapeHtml(String(d.raw_output || ''))}</pre>
                    </details>
                </div>
            `;
        }).join('');

        detailsEl.innerHTML = rows ? `<div style="border-radius: 12px; overflow:hidden;">${rows}</div>` : `<div style="padding: 18px; text-align:center; color:#999;">（无明细）</div>`;
    }

    escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    maskPromptChallengePayload(payload) {
        const p = payload ? JSON.parse(JSON.stringify(payload)) : {};
        // api_key 不再由前端传参；无需脱敏
        return p;
    }

    // ====== 知识点管理（tracker_tag）======

    handleTagSearch() {
        const kwInput = document.getElementById('admin-tag-keyword');
        this.tagKeyword = String(kwInput ? kwInput.value : '').trim();
        this.tagPage = 1;
        this.loadTagList(1);
    }

    resetTagSearch() {
        const kwInput = document.getElementById('admin-tag-keyword');
        if (kwInput) kwInput.value = '';
        this.tagKeyword = '';
        this.tagPage = 1;
        this.loadTagList(1);
    }

    async loadTagList(page = 1) {
        this.tagPage = page;
        const listEl = document.getElementById('admin-tag-list');
        const paginationEl = document.getElementById('admin-tag-pagination');
        if (!listEl) return;
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">加载中...</div>';
        if (paginationEl) paginationEl.innerHTML = '';
        try {
            const kwInput = document.getElementById('admin-tag-keyword');
            const kw = String(kwInput ? kwInput.value : (this.tagKeyword || '')).trim();
            this.tagKeyword = kw;
            const data = await this.apiService.trackerTagAdminList(page, 20, kw);
            this.renderTagList(data);
            this.renderTagPagination(data.total, data.page, data.limit);
        } catch (e) {
            listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff4d4f;">加载失败: ${e && e.message ? e.message : '未知错误'}</div>`;
        }
    }

    renderTagList(data) {
        const listEl = document.getElementById('admin-tag-list');
        if (!listEl) return;
        const list = Array.isArray(data.list) ? data.list : [];
        if (list.length === 0) {
            listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无数据</div>';
            return;
        }

        const esc = (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const short = (s, n = 80) => {
            const t = String(s || '').replace(/\s+/g, ' ').trim();
            if (!t) return '-';
            return t.length > n ? (t.slice(0, n) + '…') : t;
        };

        const rows = list.map(item => {
            const tagId = item.tagId != null ? item.tagId : (item.id || '');
            const name = item.tagName || '';
            const desc = item.tagDesc || '';
            return `
                <div class="admin-tag-row" data-tag-id="${esc(tagId)}"
                     style="display:flex; align-items:center; padding: 14px 16px; border-bottom: 1px solid #f0f0f0; gap: 16px; cursor: pointer;">
                    <div style="width: 90px; flex: 0 0 auto; color:#111; font-weight:700;">#${esc(tagId)}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; color: #333; margin-bottom: 4px; overflow:hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(name)}</div>
                        <div style="font-size: 13px; color: #666; overflow:hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${esc(short(desc, 120))}
                        </div>
                    </div>
                    <div style="display:flex; gap: 8px; flex: 0 0 auto;">
                        <button class="admin-tag-edit-btn" data-tag-id="${esc(tagId)}"
                                style="background: #1890ff; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            编辑
                        </button>
                        <button class="admin-tag-delete-btn" data-tag-id="${esc(tagId)}" data-tag-name="${esc(name)}"
                                style="background: #ff4d4f; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            删除
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = rows;

        listEl.querySelectorAll('.admin-tag-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const t = e.target;
                if (t && (t.closest('.admin-tag-edit-btn') || t.closest('.admin-tag-delete-btn'))) return;
                const tid = Number(row.getAttribute('data-tag-id'));
                if (tid) this.editTag(tid);
            });
        });
        listEl.querySelectorAll('.admin-tag-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tid = Number(btn.getAttribute('data-tag-id'));
                if (tid) this.editTag(tid);
            });
        });
        listEl.querySelectorAll('.admin-tag-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tid = Number(btn.getAttribute('data-tag-id'));
                const name = btn.getAttribute('data-tag-name') || '';
                if (tid) this.deleteTag(tid, name);
            });
        });
    }

    renderTagPagination(total, page, limit) {
        const paginationEl = document.getElementById('admin-tag-pagination');
        if (!paginationEl) return;
        const totalPages = Math.ceil((Number(total) || 0) / (Number(limit) || 20));
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }
        let html = '';
        if (page > 1) {
            html += `<button class="admin-tag-prev-btn" data-page="${page - 1}" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">上一页</button>`;
        }
        html += `<span style="color: #666; margin: 0 12px;">第 ${page} / ${totalPages} 页 (共 ${total} 条)</span>`;
        if (page < totalPages) {
            html += `<button class="admin-tag-next-btn" data-page="${page + 1}" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">下一页</button>`;
        }
        html += `<span style="margin-left: 16px; color: #666;">跳转到:</span>`;
        html += `<input type="number" id="admin-tag-goto-page" min="1" max="${totalPages}" value="${page}"
                        style="width: 60px; padding: 4px 8px; margin: 0 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center;">`;
        html += `<button class="admin-tag-goto-btn" style="padding: 6px 12px; border: 1px solid #1890ff; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">跳转</button>`;

        paginationEl.innerHTML = html;
        paginationEl.querySelectorAll('.admin-tag-prev-btn, .admin-tag-next-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPage = parseInt(btn.dataset.page);
                this.loadTagList(targetPage);
            });
        });
        const gotoBtn = paginationEl.querySelector('.admin-tag-goto-btn');
        const gotoInput = paginationEl.querySelector('#admin-tag-goto-page');
        if (gotoBtn && gotoInput) {
            gotoBtn.addEventListener('click', () => {
                const targetPage = parseInt(gotoInput.value);
                if (targetPage >= 1 && targetPage <= totalPages) {
                    this.loadTagList(targetPage);
                } else {
                    alert(`请输入 1-${totalPages} 之间的页码`);
                }
            });
            gotoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') gotoBtn.click();
            });
        }
    }

    async editTag(tagId) {
        try {
            const item = await this.apiService.trackerTagAdminGet(tagId);
            this.showTagModal(item);
        } catch (e) {
            alert('加载失败: ' + (e && e.message ? e.message : '未知错误'));
        }
    }

    async deleteTag(tagId, tagName = '') {
        const name = tagName ? `（${tagName}）` : '';
        if (!confirm(`确定要删除知识点 #${tagId}${name} 吗？`)) return;
        try {
            await this.apiService.trackerTagAdminDelete(tagId, false);
            this.loadTagList(this.tagPage);
            alert('删除成功');
        } catch (e) {
            const msg = e && e.message ? e.message : '删除失败';
            const needForce = /force\s*=\s*true|强制|关联数据/i.test(msg);
            if (needForce) {
                const ok = confirm(`后端提示该知识点仍有关联数据，是否强制删除（force=true）？\n\n${msg}`);
                if (!ok) return;
                try {
                    await this.apiService.trackerTagAdminDelete(tagId, true);
                    this.loadTagList(this.tagPage);
                    alert('强制删除成功');
                } catch (e2) {
                    alert('强制删除失败: ' + (e2 && e2.message ? e2.message : '未知错误'));
                }
            } else {
                alert('删除失败: ' + msg);
            }
        }
    }

    showTagModal(item = null) {
        const isEdit = !!item;
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';

        const tagId = item?.tagId || '';
        const tagName = item?.tagName || '';
        const tagDesc = item?.tagDesc || '';
        const tagTutorials = item?.tagTutorials || '';

        const escAttr = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 720px;">
                <div class="modal-header">
                    <h3>${isEdit ? '编辑' : '新增'}知识点</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="margin-bottom: 16px; display:flex; gap: 12px; flex-wrap: wrap;">
                        <div style="flex: 0 0 180px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 600;">tagId *</label>
                            <input type="number" id="tag-modal-tag-id" value="${escAttr(tagId)}" ${isEdit ? 'readonly' : ''}
                                   placeholder="例如 1506"
                                   style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div style="flex: 1 1 320px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 600;">tagName *</label>
                            <input type="text" id="tag-modal-tag-name" value="${escAttr(tagName)}"
                                   placeholder="例如 数位DP"
                                   style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">tagDesc</label>
                        <textarea id="tag-modal-tag-desc" rows="4"
                                  style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; line-height: 1.5; resize: vertical;">${tagDesc || ''}</textarea>
                    </div>

                    <div style="margin-bottom: 6px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">tagTutorials</label>
                        <textarea id="tag-modal-tag-tutorials" rows="6"
                                  placeholder="可放教程链接/JSON/文本（后端按字符串存储）"
                                  style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; line-height: 1.5; resize: vertical;">${tagTutorials || ''}</textarea>
                    </div>
                    <div style="font-size: 12px; color: #888; line-height: 1.5;">
                        提示：搜索支持按 tag_name / tag_desc 模糊匹配；删除默认会检查关联数据，必要时再 force=true 强制删除。
                    </div>

                    <div id="tag-modal-error" style="color: #ff4d4f; margin-top: 12px; display: none;"></div>
                </div>
                <div class="modal-actions" style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="tag-modal-submit" style="padding: 8px 16px; border: none; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">
                        ${isEdit ? '更新' : '添加'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const submitBtn = modal.querySelector('#tag-modal-submit');
        submitBtn.addEventListener('click', async () => {
            const errorEl = modal.querySelector('#tag-modal-error');
            errorEl.style.display = 'none';

            const tid = parseInt(String(modal.querySelector('#tag-modal-tag-id').value || '').trim(), 10);
            const name = String(modal.querySelector('#tag-modal-tag-name').value || '').trim();
            const desc = String(modal.querySelector('#tag-modal-tag-desc').value || '');
            const tutorials = String(modal.querySelector('#tag-modal-tag-tutorials').value || '');

            if (!tid || tid <= 0) {
                errorEl.textContent = '请填写有效的 tagId（正整数）';
                errorEl.style.display = 'block';
                return;
            }
            if (!name) {
                errorEl.textContent = '请填写 tagName（不能为空）';
                errorEl.style.display = 'block';
                return;
            }

            const oldText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = isEdit ? '更新中...' : '添加中...';

            try {
                if (isEdit) {
                    await this.apiService.trackerTagAdminUpdate(tid, name, desc, tutorials);
                } else {
                    await this.apiService.trackerTagAdminCreate(tid, name, desc, tutorials);
                }
                modal.remove();
                this.loadTagList(this.tagPage || 1);
                alert(isEdit ? '更新成功' : '添加成功');
            } catch (e) {
                errorEl.textContent = e && e.message ? e.message : '操作失败';
                errorEl.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = oldText || (isEdit ? '更新' : '添加');
            }
        });
    }

    // ===== 批量新增知识点 =====

    parseTagBatchText(text) {
        const lines = String(text || '').split(/\r?\n/);
        const items = [];
        const errors = [];

        const parseLine = (raw, lineNo) => {
            const s = String(raw || '').trim();
            if (!s) return;

            // 支持分隔符：Tab / | / 逗号 / 英文逗号
            let parts = [];
            if (s.includes('\t')) parts = s.split('\t');
            else if (s.includes('|')) parts = s.split('|');
            else if (s.includes('，')) parts = s.split('，');
            else if (s.includes(',')) parts = s.split(',');
            else parts = s.split(/\s+/); // 最后兜底：空格

            parts = parts.map(x => String(x).trim());
            const tagId = parseInt(parts[0] || '', 10);
            const tagName = parts.length >= 2 ? parts[1] : '';
            const tagDesc = parts.length >= 3 ? parts.slice(2).join(' ') : ''; // desc 允许包含空格

            if (!Number.isFinite(tagId) || tagId <= 0) {
                errors.push(`第 ${lineNo} 行：tagId 不合法：${parts[0] || ''}`);
                return;
            }
            if (!tagName) {
                errors.push(`第 ${lineNo} 行：tagName 不能为空`);
                return;
            }
            items.push({ tagId, tagName, tagDesc, lineNo, raw: s });
        };

        lines.forEach((ln, idx) => parseLine(ln, idx + 1));
        return { items, errors };
    }

    showTagBatchModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 760px;">
                <div class="modal-header">
                    <h3>批量新增知识点</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="font-size: 13px; color:#666; line-height:1.6; margin-bottom: 10px;">
                        每行一条：<b>tagId</b>、<b>知识点名</b>、<b>desc</b><br/>
                        分隔符支持：<code>Tab</code> / <code>|</code> / <code>,</code> / <code>空格</code><br/>
                        例：<code>1517\t拓扑排序\t熟悉拓扑排序与入度法/DFS法，处理依赖关系并判断有向图是否存在环。</code>
                    </div>
                    <div style="display:flex; gap: 14px; align-items:center; flex-wrap:wrap; margin-bottom: 10px;">
                        <label style="font-size: 13px; color:#666; display:flex; align-items:center; gap:8px;">
                            <input id="admin-tag-batch-upsert" type="checkbox" checked />
                            已存在则自动更新（create 失败后改走 update）
                        </label>
                        <div style="flex:1;"></div>
                        <button id="admin-tag-batch-preview-btn" style="background:#722ed1; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                            解析预览
                        </button>
                    </div>

                    <textarea id="admin-tag-batch-text" rows="12"
                              placeholder="每行：tagId<Tab>name<Tab>desc"
                              style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 13px; resize: vertical;"></textarea>

                    <div id="admin-tag-batch-preview" style="margin-top: 10px; font-size: 13px; color:#666;"></div>
                    <div id="admin-tag-batch-error" style="margin-top: 10px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                    <div style="margin-top: 12px;">
                        <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">执行结果</div>
                        <pre id="admin-tag-batch-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 320px;">（尚未执行）</pre>
                    </div>
                </div>
                <div class="modal-actions" style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="admin-tag-batch-submit-btn" style="padding: 8px 16px; border: none; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">
                        开始提交
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const textarea = modal.querySelector('#admin-tag-batch-text');
        const previewEl = modal.querySelector('#admin-tag-batch-preview');
        const errorEl = modal.querySelector('#admin-tag-batch-error');
        const resultEl = modal.querySelector('#admin-tag-batch-result');
        const previewBtn = modal.querySelector('#admin-tag-batch-preview-btn');
        const submitBtn = modal.querySelector('#admin-tag-batch-submit-btn');

        const doPreview = () => {
            errorEl.style.display = 'none';
            const { items, errors } = this.parseTagBatchText(textarea.value);
            if (errors.length) {
                previewEl.innerHTML = `解析到 <b>${items.length}</b> 条可提交，发现 <b>${errors.length}</b> 条错误（请修正后再提交）。`;
                errorEl.textContent = errors.slice(0, 20).join('\n') + (errors.length > 20 ? `\n... 还有 ${errors.length - 20} 条` : '');
                errorEl.style.display = 'block';
            } else {
                previewEl.innerHTML = `解析到 <b>${items.length}</b> 条可提交。`;
            }
        };

        previewBtn.addEventListener('click', doPreview);
        textarea.addEventListener('input', () => { /* 用户输入时不强制预览 */ });

        submitBtn.addEventListener('click', async () => {
            errorEl.style.display = 'none';
            resultEl.textContent = '准备解析...\n';

            const { items, errors } = this.parseTagBatchText(textarea.value);
            if (errors.length) {
                errorEl.textContent = `存在解析错误，无法提交：\n` + errors.slice(0, 40).join('\n') + (errors.length > 40 ? `\n... 还有 ${errors.length - 40} 条` : '');
                errorEl.style.display = 'block';
                return;
            }
            if (items.length === 0) {
                errorEl.textContent = '未解析到可提交的行（请按格式填写）';
                errorEl.style.display = 'block';
                return;
            }

            const upsert = !!modal.querySelector('#admin-tag-batch-upsert').checked;
            const ok = confirm(`确认提交 ${items.length} 条知识点？\n\n模式：${upsert ? '已存在则更新' : '仅新增（已存在会失败）'}`);
            if (!ok) return;

            const oldText = submitBtn.textContent;
            submitBtn.disabled = true;
            previewBtn.disabled = true;
            submitBtn.textContent = '提交中...';

            const agg = { total: items.length, created: 0, updated: 0, failed: 0, failures: [] };
            resultEl.textContent = `开始提交：total=${agg.total}, upsert=${upsert}\n`;

            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                resultEl.textContent += `\n[${i + 1}/${items.length}] #${it.tagId} ${it.tagName} ... `;
                try {
                    await this.apiService.trackerTagAdminCreate(it.tagId, it.tagName, it.tagDesc, '');
                    agg.created++;
                    resultEl.textContent += `✅ created\n`;
                } catch (e) {
                    const msg = e && e.message ? e.message : 'create failed';
                    if (upsert && /tagId\\s*已存在|已存在/i.test(msg)) {
                        try {
                            await this.apiService.trackerTagAdminUpdate(it.tagId, it.tagName, it.tagDesc, '');
                            agg.updated++;
                            resultEl.textContent += `♻️ updated\n`;
                        } catch (e2) {
                            const msg2 = e2 && e2.message ? e2.message : 'update failed';
                            agg.failed++;
                            agg.failures.push({ line: it.lineNo, tagId: it.tagId, reason: msg2 });
                            resultEl.textContent += `❌ update failed: ${msg2}\n`;
                        }
                    } else {
                        agg.failed++;
                        agg.failures.push({ line: it.lineNo, tagId: it.tagId, reason: msg });
                        resultEl.textContent += `❌ create failed: ${msg}\n`;
                    }
                }
            }

            resultEl.textContent += `\n==== 汇总 ====\ncreated=${agg.created}, updated=${agg.updated}, failed=${agg.failed}\n`;
            if (agg.failures.length) {
                resultEl.textContent += `\n失败明细（前 50 条）：\n` + agg.failures.slice(0, 50).map(x => `line=${x.line}, tagId=${x.tagId}, reason=${x.reason}`).join('\n');
                if (agg.failures.length > 50) resultEl.textContent += `\n... 还有 ${agg.failures.length - 50} 条`;
            }

            try { this.loadTagList(this.tagPage || 1); } catch (_) {}

            submitBtn.disabled = false;
            previewBtn.disabled = false;
            submitBtn.textContent = oldText || '开始提交';
        });
    }

    async fetchAdminYearReport() {
        const uidInput = document.getElementById('admin-year-report-uid');
        const yearInput = document.getElementById('admin-year-report-year');
        const trackerOnlyInput = document.getElementById('admin-year-report-tracker-only');
        const errorEl = document.getElementById('admin-year-report-error');
        const resultEl = document.getElementById('admin-year-report-result');
        const btn = document.getElementById('admin-year-report-fetch-btn');

        if (!uidInput || !yearInput || !trackerOnlyInput || !errorEl || !resultEl) return;
        errorEl.style.display = 'none';

        const uid = parseInt(String(uidInput.value || '').trim(), 10);
        const year = parseInt(String(yearInput.value || '0').trim(), 10) || 0;
        const trackerOnly = !!trackerOnlyInput.checked;

        if (!uid || uid <= 0) {
            errorEl.textContent = '请填写有效的 uid（正整数）';
            errorEl.style.display = 'block';
            return;
        }

        localStorage.setItem('admin_year_report_uid', String(uid));
        localStorage.setItem('admin_year_report_year', String(yearInput.value || '0'));
        localStorage.setItem('admin_year_report_tracker_only', String(trackerOnly));

        const oldText = btn ? btn.textContent : '';
        if (btn) {
            btn.disabled = true;
            btn.textContent = '拉取中...';
        }
        resultEl.textContent = `请求中...\nuid=${uid}, year=${year}, trackerOnly=${trackerOnly}\n`;

        try {
            const data = await this.apiService.adminYearReport(uid, year, trackerOnly);
            this.adminYearReportLast = data;
            resultEl.textContent = JSON.stringify(data, null, 2);
            this.renderYearReportVisuals(data);
        } catch (e) {
            const msg = e && e.message ? e.message : '拉取失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
            document.getElementById('admin-year-report-visuals').style.display = 'none';
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = oldText || '拉取数据';
            }
        }
    }

    /**
     * 比赛题目难度更新：预览（dryRun=true）
     */
    async handleContestDifficultyPreview() {
        const contestIdInput = document.getElementById('admin-contest-difficulty-contest-id');
        const acRateMaxInput = document.getElementById('admin-contest-difficulty-ac-rate-max');
        const errorEl = document.getElementById('admin-contest-difficulty-error');
        const summaryEl = document.getElementById('admin-contest-difficulty-summary');
        const listEl = document.getElementById('admin-contest-difficulty-list');
        const previewBtn = document.getElementById('admin-contest-difficulty-preview-btn');

        if (!contestIdInput || !acRateMaxInput || !errorEl || !summaryEl || !listEl) return;

        errorEl.style.display = 'none';
        const contestId = parseInt(String(contestIdInput.value || '').trim(), 10);
        const acRateMax = parseInt(String(acRateMaxInput.value || '85').trim(), 10) || 85;

        if (!contestId || contestId <= 0) {
            errorEl.textContent = '请填写有效的 contestId（正整数）';
            errorEl.style.display = 'block';
            return;
        }

        localStorage.setItem('contest_difficulty_contest_id', String(contestId));
        localStorage.setItem('contest_difficulty_ac_rate_max', String(acRateMax));

        const oldText = previewBtn ? previewBtn.textContent : '';
        if (previewBtn) {
            previewBtn.disabled = true;
            previewBtn.textContent = '预览中...';
        }
        summaryEl.style.display = 'none';
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">计算中...</div>';

        try {
            const data = await this.apiService.adminRebuildProblemDifficulty(contestId, true, acRateMax);
            this.renderContestDifficultyResult(data, true);
        } catch (e) {
            const msg = e && e.message ? e.message : '预览失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff4d4f;">失败：${msg}</div>`;
        } finally {
            if (previewBtn) {
                previewBtn.disabled = false;
                previewBtn.textContent = oldText || '🔍 预览（不写库）';
            }
        }
    }

    /**
     * 比赛题目难度更新：写入数据库（dryRun=false）
     */
    async handleContestDifficultySubmit() {
        const contestIdInput = document.getElementById('admin-contest-difficulty-contest-id');
        const acRateMaxInput = document.getElementById('admin-contest-difficulty-ac-rate-max');
        const errorEl = document.getElementById('admin-contest-difficulty-error');
        const summaryEl = document.getElementById('admin-contest-difficulty-summary');
        const listEl = document.getElementById('admin-contest-difficulty-list');
        const submitBtn = document.getElementById('admin-contest-difficulty-submit-btn');

        if (!contestIdInput || !acRateMaxInput || !errorEl || !summaryEl || !listEl) return;

        errorEl.style.display = 'none';
        const contestId = parseInt(String(contestIdInput.value || '').trim(), 10);
        const acRateMax = parseInt(String(acRateMaxInput.value || '85').trim(), 10) || 85;

        if (!contestId || contestId <= 0) {
            errorEl.textContent = '请填写有效的 contestId（正整数）';
            errorEl.style.display = 'block';
            return;
        }

        // 二次确认
        const confirmed = confirm(`确认要将比赛 ${contestId} 的所有题目难度写入数据库吗？\n\n此操作将更新 acm_problem_open.difficulty 字段，请确保比赛已结束。`);
        if (!confirmed) return;

        localStorage.setItem('contest_difficulty_contest_id', String(contestId));
        localStorage.setItem('contest_difficulty_ac_rate_max', String(acRateMax));

        const oldText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '写入中...';
        }
        summaryEl.style.display = 'none';
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">计算并写入中...</div>';

        try {
            const data = await this.apiService.adminRebuildProblemDifficulty(contestId, false, acRateMax);
            this.renderContestDifficultyResult(data, false);
            alert(`成功更新 ${data.updatedCount || 0} 道题目的难度！`);
        } catch (e) {
            const msg = e && e.message ? e.message : '写入失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff4d4f;">失败：${msg}</div>`;
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = oldText || '✅ 写入数据库';
            }
        }
    }

    /**
     * 渲染比赛题目难度计算结果
     */
    renderContestDifficultyResult(data, isDryRun) {
        const summaryEl = document.getElementById('admin-contest-difficulty-summary');
        const listEl = document.getElementById('admin-contest-difficulty-list');

        if (!summaryEl || !listEl) return;

        const list = Array.isArray(data.list) ? data.list : [];
        const updatedCount = data.updatedCount || 0;
        const skippedCount = data.skippedCount || 0;
        const failedCount = data.failedCount || 0;
        const userCount = data.userCount || 0;
        const avgRating = data.avgRating || 0;

        // 汇总信息
        summaryEl.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                <div><strong>比赛ID:</strong> ${data.contestId || '-'}</div>
                <div><strong>比赛名称:</strong> ${data.contestName || '-'}</div>
                <div><strong>参赛人数:</strong> ${userCount}</div>
                <div><strong>平均Rating:</strong> ${avgRating.toFixed(1)}</div>
                <div><strong>acRateMax:</strong> ${data.acRateMax || 85}</div>
                <div><strong>模式:</strong> ${isDryRun ? '预览（不写库）' : '已写入数据库'}</div>
                <div style="color: #52c41a;"><strong>成功更新:</strong> ${updatedCount}</div>
                <div style="color: #faad14;"><strong>跳过:</strong> ${skippedCount}</div>
                <div style="color: #ff4d4f;"><strong>失败:</strong> ${failedCount}</div>
            </div>
        `;
        summaryEl.style.display = 'block';

        // 题目列表
        if (list.length === 0) {
            listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无题目数据</div>';
            return;
        }

        const listHtml = list.map(item => {
            const difficulty = item.difficulty || 0;
            const isInvalid = difficulty <= 0;
            const rowStyle = isInvalid 
                ? 'background: #fff1f0; border-left: 3px solid #ff4d4f;' 
                : 'background: #fff;';
            const difficultyStyle = isInvalid 
                ? 'color: #ff4d4f; font-weight: 600;' 
                : 'color: #333;';
            const statusText = isDryRun ? '（预览，未写入）' : (item.updated ? '✅ 已更新' : '❌ 未更新');
            const reasonHtml = item.reason ? `<div style="font-size: 12px; color: #999; margin-top: 4px;">原因: ${item.reason}</div>` : '';

            return `
                <div style="${rowStyle} padding: 12px; border-bottom: 1px solid #f0f0f0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 4px;">
                                题目ID: ${item.problemId || '-'}
                            </div>
                            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">
                                通过人数: ${item.acceptedCount || 0} / ${item.userCount || 0} 
                                (通过率: ${(item.passingRate || 0).toFixed(2)}%)
                            </div>
                            <div style="font-size: 13px; color: #666;">
                                平均Rating: ${(item.avgRating || 0).toFixed(1)}
                            </div>
                            ${reasonHtml}
                        </div>
                        <div style="text-align: right; margin-left: 16px;">
                            <div style="${difficultyStyle} font-size: 18px; font-weight: 700; margin-bottom: 4px;">
                                ${isInvalid ? '无效' : difficulty}
                            </div>
                            <div style="font-size: 12px; color: #999;">
                                ${statusText}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = `
            <div style="max-height: 500px; overflow-y: auto;">
                ${listHtml}
            </div>
        `;
    }

    /**
     * 解析输入的 problemId（支持换行/空格/逗号/Tab）
     */
    parseImportIds(text) {
        const raw = String(text || '').trim();
        if (!raw) return { ids: [], invalidTokens: [], inputCount: 0 };
        const tokens = raw.split(/[\n\r,，\t\s]+/).map(s => s.trim()).filter(Boolean);
        const invalidTokens = [];
        const ids = [];
        for (const t of tokens) {
            const v = parseInt(t, 10);
            if (!Number.isFinite(v) || v <= 0) invalidTokens.push(t);
            else ids.push(v);
        }
        const unique = [...new Set(ids)];
        return { ids: unique, invalidTokens, inputCount: tokens.length };
    }

    /**
     * 解析预览
     */
    previewImportIds() {
        const textarea = document.getElementById('admin-import-problem-ids');
        const previewEl = document.getElementById('admin-import-preview');
        const errorEl = document.getElementById('admin-import-error');
        if (!textarea || !previewEl || !errorEl) return;

        errorEl.style.display = 'none';
        const { ids, invalidTokens, inputCount } = this.parseImportIds(textarea.value);
        const invalidTip = invalidTokens.length > 0
            ? `，发现 ${invalidTokens.length} 个非法项（已忽略）`
            : '';
        previewEl.innerHTML = `解析到 <b>${ids.length}</b> 个有效 problemId（输入项 ${inputCount}${invalidTip}）。`;
    }

    /**
     * 提交导入
     */
    async submitImportIds() {
        const textarea = document.getElementById('admin-import-problem-ids');
        const tagIdInput = document.getElementById('admin-import-tag-id');
        const batchSizeInput = document.getElementById('admin-import-batch-size');
        const dryRunInput = document.getElementById('admin-import-dry-run');
        const resultEl = document.getElementById('admin-import-result');
        const errorEl = document.getElementById('admin-import-error');
        const previewEl = document.getElementById('admin-import-preview');
        const submitBtn = document.getElementById('admin-import-submit-btn');

        if (!textarea || !tagIdInput || !batchSizeInput || !dryRunInput || !resultEl || !errorEl) return;
        errorEl.style.display = 'none';

        const { ids, invalidTokens, inputCount } = this.parseImportIds(textarea.value);
        if (ids.length === 0) {
            errorEl.textContent = '未解析到有效的 problemId（请每行一个数字 ID）';
            errorEl.style.display = 'block';
            return;
        }

        // trackerSourceTagId 允许不填：不填则传 0，让后端使用 DEFAULT_TRACKER_SOURCE_TAG_ID
        const trackerSourceTagId = parseInt(String(tagIdInput.value || '').trim(), 10) || 0;
        const batchSizeRaw = String(batchSizeInput.value || '').trim();
        let batchSize = parseInt(batchSizeRaw || '', 10);
        if (!Number.isFinite(batchSize) || batchSize <= 0) batchSize = 200;
        const dryRun = !!dryRunInput.checked;

        // 保存配置，方便下次使用
        localStorage.setItem('tracker_import_source_tag_id', String(tagIdInput.value || '').trim());
        // 允许留空：留空时不写死成 200，保持用户的“未填写”状态
        localStorage.setItem('tracker_import_batch_size', batchSizeRaw);
        localStorage.setItem('tracker_import_dry_run', String(dryRun));

        // 不填则依赖后端默认值；若后端未配置，会返回明确错误（前端直接展示）
        if (trackerSourceTagId <= 0) {
            const ok = confirm('trackerSourceTagId 未填写，将使用后端默认值（DEFAULT_TRACKER_SOURCE_TAG_ID）。\n\n若后端未配置默认值，本次会失败并返回“未配置”错误。\n\n是否继续？');
            if (!ok) return;
        }

        if (previewEl) {
            const invalidTip = invalidTokens.length > 0 ? `（忽略非法项 ${invalidTokens.length} 个）` : '';
            previewEl.innerHTML = `即将提交：有效 problemId <b>${ids.length}</b> 个 / 输入项 ${inputCount} ${invalidTip}。`;
        }

        const oldBtnText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = dryRun ? '统计中...' : '导入中...';
        }

        try {
            // 为避免一次请求携带过多 problemIds 触发网关/服务端 body 限制，做“自动分段提交”
            const payloadStr = JSON.stringify(ids);
            const MAX_IDS_PER_REQUEST = 2000;
            const MAX_PAYLOAD_CHARS = 60000; // 粗略阈值：避免过大 body（编码后更大）
            const needChunk = ids.length > MAX_IDS_PER_REQUEST || payloadStr.length > MAX_PAYLOAD_CHARS;

            const chunks = [];
            if (needChunk) {
                for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
                    chunks.push(ids.slice(i, i + MAX_IDS_PER_REQUEST));
                }
            } else {
                chunks.push(ids);
            }

            if (needChunk) {
                const ok = confirm(`检测到本次导入数量较大（${ids.length} 个）。\n为避免单次请求过大导致失败，将自动拆分为 ${chunks.length} 次请求（每次最多 ${MAX_IDS_PER_REQUEST} 个）。\n\n是否继续？`);
                if (!ok) {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = oldBtnText || '开始导入';
                    }
                    return;
                }
            }

            // 汇总结果
            const agg = {
                inputCount: inputCount,
                distinctCount: ids.length,
                requestCount: chunks.length,
                batchSize: batchSize,
                trackerSourceTagId: trackerSourceTagId,
                dryRun: dryRun,
                created: 0,
                updated: 0,
                skipped: 0,
                failed: 0,
                failedIds: [],
                failedReason: {}
            };

            resultEl.textContent = (dryRun ? 'dryRun 统计中...\n' : '导入执行中...\n')
                + `idsCount=${ids.length}, requestCount=${chunks.length}, batchSize=${batchSize}, trackerSourceTagId=${trackerSourceTagId}\n`;

            for (let idx = 0; idx < chunks.length; idx++) {
                const chunk = chunks[idx];
                resultEl.textContent += `\n[${idx + 1}/${chunks.length}] 提交 ${chunk.length} 个...\n`;
                const data = await this.apiService.adminAcmProblemOpenBatchImportTracker(
                    chunk,
                    trackerSourceTagId,
                    batchSize,
                    dryRun
                );

                // 聚合统计
                agg.created += Number(data?.created || 0);
                agg.updated += Number(data?.updated || 0);
                agg.skipped += Number(data?.skipped || 0);
                const failedCount = Number(data?.failed || 0);
                agg.failed += failedCount;

                const failedIds = Array.isArray(data?.failedIds) ? data.failedIds : [];
                for (const fid of failedIds) agg.failedIds.push(fid);

                const fr = data?.failedReason && typeof data.failedReason === 'object' ? data.failedReason : {};
                for (const k of Object.keys(fr)) {
                    // 以首次原因优先，避免覆盖（也便于看“最早错误”）
                    if (agg.failedReason[k] == null) agg.failedReason[k] = fr[k];
                }

                resultEl.textContent += `[${idx + 1}/${chunks.length}] 完成：created=${data?.created || 0}, updated=${data?.updated || 0}, skipped=${data?.skipped || 0}, failed=${data?.failed || 0}\n`;
            }

            // failedIds 去重
            agg.failedIds = [...new Set(agg.failedIds.map(x => Number(x)).filter(n => Number.isFinite(n) && n > 0))];
            agg.failed = agg.failedIds.length > 0 ? agg.failedIds.length : agg.failed;

            this.importLastResult = agg;
            resultEl.textContent += `\n==== 汇总 ====\n` + JSON.stringify(agg, null, 2);

            if (agg.failed > 0) {
                alert(`执行完成：新增 ${agg.created}，追加tag ${agg.updated}，跳过 ${agg.skipped}，失败 ${agg.failed}\n可在“导入结果”中查看 failedIds/failedReason。`);
            } else {
                alert(`执行完成：新增 ${agg.created}，追加tag ${agg.updated}，跳过 ${agg.skipped}。`);
            }
        } catch (e) {
            errorEl.textContent = e && e.message ? e.message : '批量导入失败';
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${errorEl.textContent}`;
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = oldBtnText || '开始导入';
            }
        }
    }

    /**
     * 处理每日一题搜索
     */
    handleClockSearch() {
        const startDate = document.getElementById('admin-clock-start-date').value;
        const endDate = document.getElementById('admin-clock-end-date').value;
        
        if (!startDate || !endDate) {
            alert('请选择开始日期和结束日期');
            return;
        }
        
        if (startDate > endDate) {
            alert('开始日期不能晚于结束日期');
            return;
        }
        
        this.clockSearchStartDate = startDate;
        this.clockSearchEndDate = endDate;
        this.clockPage = 1;
        this.loadClockList(1);
    }

    /**
     * 重置每日一题搜索
     */
    resetClockSearch() {
        document.getElementById('admin-clock-start-date').value = '';
        document.getElementById('admin-clock-end-date').value = '';
        this.clockSearchStartDate = null;
        this.clockSearchEndDate = null;
        this.clockPage = 1;
        this.loadClockList(1);
    }

    /**
     * 加载每日一题列表
     */
    async loadClockList(page = 1) {
        this.clockPage = page;
        const listEl = document.getElementById('admin-clock-list');
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">加载中...</div>';

        try {
            let data;
            // 如果有搜索条件，使用时间段查询接口
            if (this.clockSearchStartDate && this.clockSearchEndDate) {
                data = await this.apiService.adminClockQuestionListByDateRange(
                    this.clockSearchStartDate, 
                    this.clockSearchEndDate, 
                    page, 
                    20
                );
            } else {
                // 否则使用普通列表接口
                data = await this.apiService.adminClockQuestionList(page, 20);
            }
            this.renderClockList(data);
            this.renderClockPagination(data.total, data.page, data.limit);
        } catch (error) {
            listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff4d4f;">加载失败: ${error.message}</div>`;
        }
    }

    /**
     * 渲染每日一题列表
     */
    renderClockList(data) {
        const listEl = document.getElementById('admin-clock-list');
        if (!data.list || data.list.length === 0) {
            listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无数据</div>';
            return;
        }

        const rows = data.list.map(item => {
            // 处理日期：可能是字符串 "2025-01-15 10:00:00" 或时间戳
            let date = '-';
            if (item.createTime) {
                if (typeof item.createTime === 'string') {
                    // 字符串格式直接提取日期部分，避免时区问题
                    date = item.createTime.split(' ')[0];
                } else if (typeof item.createTime === 'number') {
                    // 时间戳转日期字符串，使用本地时区
                    const d = new Date(item.createTime);
                    // 使用本地时区的年月日，避免时区转换问题
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    date = `${year}-${month}-${day}`;
                }
            }

            const title = item.questionTitle || '';
            const uuid = item.questionUuid || '';
            const questionLink = uuid ? `https://www.nowcoder.com/practice/${uuid}?channelPut=w252acm` : '';
            const trackerLink = `https://www.nowcoder.com/problem/tracker`;
            const videoCopy = this.buildDailyVideoCopy(title, date, questionLink);

            return `
                <div style="display: flex; align-items: center; padding: 16px; border-bottom: 1px solid #f0f0f0; gap: 16px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 4px;">日期: ${date}</div>
                        <div style="font-size: 13px; color: #666;">
                            题目ID: ${item.questionId || '-'} | 
                            问题ID: ${item.problemId || '-'}
                        </div>
                        ${title ? `<div style="margin-top:6px; font-size: 13px; color:#333; font-weight:600;">题目名：${title}</div>` : ''}
                        ${questionLink ? `<div style="margin-top:4px; font-size: 12px;">
                            <a href="${questionLink}" target="_blank" rel="noopener noreferrer" style="color:#1890ff; text-decoration:none;">题目链接（practice）</a>
                            <span style="color:#999;"> | </span>
                            <a href="${trackerLink}" target="_blank" rel="noopener noreferrer" style="color:#1890ff; text-decoration:none;">每日打卡链接</a>
                        </div>` : `<div style="margin-top:4px; font-size: 12px; color:#999;">题目链接：暂无（questionUuid 缺失）</div>`}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="admin-clock-video-copy-btn" data-copy="${encodeURIComponent(videoCopy)}" ${questionLink ? '' : 'disabled'}
                                style="background: ${questionLink ? '#722ed1' : '#ccc'}; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: ${questionLink ? 'pointer' : 'not-allowed'}; font-size: 13px;">
                            生成发视频文案
                        </button>
                        <button class="admin-clock-edit-btn" data-id="${item.id}" style="background: #1890ff; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            编辑
                        </button>
                        <button class="admin-clock-delete-btn" data-id="${item.id}" data-date="${date}" style="background: #ff4d4f; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            删除
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = rows;

        // 绑定“生成发视频文案”
        listEl.querySelectorAll('.admin-clock-video-copy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const copy = decodeURIComponent(String(btn.dataset.copy || ''));
                    if (!copy) return;
                    await this.copyToClipboard(copy);
                    alert('已复制到剪贴板');
                } catch (e) {
                    alert(`复制失败：${e && e.message ? e.message : '未知错误'}`);
                }
            });
        });
        
        // 绑定编辑和删除按钮事件
        listEl.querySelectorAll('.admin-clock-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.editClock(id);
            });
        });
        
        listEl.querySelectorAll('.admin-clock-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const date = btn.dataset.date;
                this.deleteClock(id, date);
            });
        });
    }

    // ===== 每日一题：快速定位（find） =====
    async handleClockFind() {
        const qidInput = document.getElementById('admin-clock-find-question-id');
        const pidInput = document.getElementById('admin-clock-find-problem-id');
        const qid = parseInt(String(qidInput ? qidInput.value : '0').trim(), 10) || 0;
        const pid = parseInt(String(pidInput ? pidInput.value : '0').trim(), 10) || 0;
        if (qid <= 0 && pid <= 0) {
            alert('请至少填写一个：questionId 或 problemId');
            return;
        }

        // 清空时间段筛选，避免用户误解
        this.clockSearchStartDate = null;
        this.clockSearchEndDate = null;
        const startEl = document.getElementById('admin-clock-start-date');
        const endEl = document.getElementById('admin-clock-end-date');
        if (startEl) startEl.value = '';
        if (endEl) endEl.value = '';

        const listEl = document.getElementById('admin-clock-list');
        const paginationEl = document.getElementById('admin-clock-pagination');
        if (listEl) listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">定位中...</div>';
        if (paginationEl) paginationEl.innerHTML = '';

        try {
            const item = await this.apiService.adminClockQuestionFind(qid, pid);
            this.renderClockList({ list: [item], total: 1, page: 1, limit: 20 });
            if (paginationEl) paginationEl.innerHTML = `<span style="color:#666;">定位结果：共 1 条（使用 find 接口）</span>`;
        } catch (e) {
            if (listEl) listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff4d4f;">定位失败: ${e && e.message ? e.message : '未知错误'}</div>`;
        }
    }

    // ===== 每日一题：发视频文案 =====
    buildDailyVideoCopy(questionTitle, dateYmd, questionLink) {
        const safeTitle = String(questionTitle || '').trim() || '（题目名）';
        const d = String(dateYmd || '').trim();
        const ymd = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
        const prettyDate = ymd ? ymd.replaceAll('-', '.') : 'YYYY.MM.DD';
        const dailyLink = 'https://www.nowcoder.com/problem/tracker';
        const qLink = String(questionLink || '').trim() || 'https://www.nowcoder.com/practice/{questionUuid}?channelPut=w252acm';
        return `【每日一题讲解】${safeTitle} {${prettyDate}}\n每日打卡链接：${dailyLink}\n题目链接：${qLink}`;
    }

    async copyToClipboard(text) {
        const s = String(text ?? '');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(s);
            return;
        }
        // fallback
        const ta = document.createElement('textarea');
        ta.value = s;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
        } finally {
            document.body.removeChild(ta);
        }
    }

    /**
     * 渲染每日一题分页
     */
    renderClockPagination(total, page, limit) {
        const paginationEl = document.getElementById('admin-clock-pagination');
        const totalPages = Math.ceil(total / limit);
        
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        let html = '';
        if (page > 1) {
            html += `<button class="admin-clock-prev-btn" data-page="${page - 1}" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">上一页</button>`;
        }
        html += `<span style="color: #666; margin: 0 12px;">第 ${page} / ${totalPages} 页 (共 ${total} 条)</span>`;
        if (page < totalPages) {
            html += `<button class="admin-clock-next-btn" data-page="${page + 1}" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">下一页</button>`;
        }
        
        // 添加跳转输入框
        html += `<span style="margin-left: 16px; color: #666;">跳转到:</span>`;
        html += `<input type="number" id="admin-clock-goto-page" min="1" max="${totalPages}" value="${page}" 
                        style="width: 60px; padding: 4px 8px; margin: 0 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center;">`;
        html += `<button class="admin-clock-goto-btn" style="padding: 6px 12px; border: 1px solid #1890ff; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">跳转</button>`;

        paginationEl.innerHTML = html;
        
        // 绑定分页按钮事件
        paginationEl.querySelectorAll('.admin-clock-prev-btn, .admin-clock-next-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPage = parseInt(btn.dataset.page);
                this.loadClockList(targetPage);
            });
        });
        
        // 绑定跳转按钮事件
        const gotoBtn = paginationEl.querySelector('.admin-clock-goto-btn');
        const gotoInput = paginationEl.querySelector('#admin-clock-goto-page');
        if (gotoBtn && gotoInput) {
            gotoBtn.addEventListener('click', () => {
                const targetPage = parseInt(gotoInput.value);
                if (targetPage >= 1 && targetPage <= totalPages) {
                    this.loadClockList(targetPage);
                } else {
                    alert(`请输入 1-${totalPages} 之间的页码`);
                }
            });
            
            // 支持回车键跳转
            gotoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    gotoBtn.click();
                }
            });
        }
    }

    /**
     * 根据problemId查询对战题目
     */
    async searchBattleByProblemId() {
        const problemIdInput = document.getElementById('admin-battle-problem-id-search');
        const problemId = problemIdInput.value.trim();
        
        // 如果查询框为空，显示全部题目
        if (!problemId) {
            this.battlePage = 1;
            this.loadBattleList(1);
            return;
        }
        
        const problemIdNum = parseInt(problemId);
        if (isNaN(problemIdNum) || problemIdNum <= 0) {
            alert('请输入有效的题目ID');
            return;
        }
        
        const listEl = document.getElementById('admin-battle-list');
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">查询中...</div>';

        try {
            const item = await this.apiService.adminBattleProblemGetByProblemId(problemIdNum);
            
            if (item) {
                // 如果查询到结果，显示在列表中
                const data = {
                    total: 1,
                    page: 1,
                    limit: 20,
                    list: [item]
                };
                this.renderBattleList(data);
                // 隐藏分页，因为只有一条结果
                const paginationEl = document.getElementById('admin-battle-pagination');
                if (paginationEl) {
                    paginationEl.innerHTML = '<div style="padding: 12px; text-align: center; color: #666;">查询到1条结果</div>';
                }
            } else {
                listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #999;">未找到题目ID为 ${problemId} 的对战题目</div>`;
                const paginationEl = document.getElementById('admin-battle-pagination');
                if (paginationEl) {
                    paginationEl.innerHTML = '';
                }
            }
        } catch (error) {
            // 如果接口返回404或查询失败，显示未找到
            if (error.message.includes('404') || error.message.includes('查询失败')) {
                listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #999;">未找到题目ID为 ${problemId} 的对战题目</div>`;
            } else {
                listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff4d4f;">查询失败: ${error.message}</div>`;
            }
            const paginationEl = document.getElementById('admin-battle-pagination');
            if (paginationEl) {
                paginationEl.innerHTML = '';
            }
        }
    }

    /**
     * 加载对战题目列表
     */
    async loadBattleList(page = 1) {
        this.battlePage = page;
        const listEl = document.getElementById('admin-battle-list');
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">加载中...</div>';

        try {
            const levelMin = parseInt(document.getElementById('admin-battle-level-min').value) || 0;
            const levelMax = parseInt(document.getElementById('admin-battle-level-max').value) || 0;
            const orderBy = document.getElementById('admin-battle-order-by').value;
            const order = document.getElementById('admin-battle-order').value;

            const data = await this.apiService.adminBattleProblemList(page, 20, levelMin, levelMax, orderBy, order);
            this.renderBattleList(data);
            this.renderBattlePagination(data.total, data.page, data.limit);
        } catch (error) {
            listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff4d4f;">加载失败: ${error.message}</div>`;
        }
    }

    // ===== 对战：二级页签切换 =====
    setBattleSubTab(subTab) {
        const t = (subTab === 'histogram') ? 'histogram' : 'manage';
        this.battleSubTab = t;

        const managePanel = document.getElementById('admin-battle-subpanel-manage');
        const histPanel = document.getElementById('admin-battle-subpanel-histogram');
        if (managePanel) managePanel.style.display = t === 'manage' ? 'block' : 'none';
        if (histPanel) histPanel.style.display = t === 'histogram' ? 'block' : 'none';

        const btnManage = document.getElementById('admin-battle-subtab-manage');
        const btnHist = document.getElementById('admin-battle-subtab-histogram');
        if (btnManage) {
            btnManage.style.borderColor = t === 'manage' ? '#1890ff' : '#ddd';
            btnManage.style.background = t === 'manage' ? '#e6f7ff' : '#fff';
            btnManage.style.color = t === 'manage' ? '#0958d9' : '#666';
        }
        if (btnHist) {
            btnHist.style.borderColor = t === 'histogram' ? '#1890ff' : '#ddd';
            btnHist.style.background = t === 'histogram' ? '#e6f7ff' : '#fff';
            btnHist.style.color = t === 'histogram' ? '#0958d9' : '#666';
        }

        if (t === 'histogram') {
            this.loadBattleDifficultyHistogram();
        }
    }

    // ===== 对战：难度直方图 =====
    async loadBattleDifficultyHistogram() {
        const metaEl = document.getElementById('admin-battle-histogram-meta');
        const errorEl = document.getElementById('admin-battle-histogram-error');
        const chartEl = document.getElementById('admin-battle-histogram-chart');
        if (!metaEl || !errorEl || !chartEl) return;
        errorEl.style.display = 'none';
        chartEl.innerHTML = '<div style="padding: 18px; text-align:center; color:#999;">加载中...</div>';
        metaEl.textContent = '';

        try {
            const data = await this.apiService.battleProblemDifficultyHistogram();
            this.renderBattleDifficultyHistogram(data);
        } catch (e) {
            const msg = e && e.message ? e.message : '加载失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            chartEl.innerHTML = `<div style="padding: 18px; text-align:center; color:#ff4d4f;">加载失败：${msg}</div>`;
        }
    }

    renderBattleDifficultyHistogram(data) {
        const metaEl = document.getElementById('admin-battle-histogram-meta');
        const chartEl = document.getElementById('admin-battle-histogram-chart');
        if (!metaEl || !chartEl) return;

        const bucketSize = Number(data?.bucketSize || 100);
        const rangeMin = Number(data?.range?.min || 1);
        const rangeMax = Number(data?.range?.max || 5000);
        const total = Number(data?.total || 0);
        const buckets = Array.isArray(data?.buckets) ? data.buckets : [];

        metaEl.innerHTML = `bucketSize=<b>${bucketSize}</b>，range=<b>${rangeMin}~${rangeMax}</b>，total=<b>${total}</b>（1~5000 范围内题目总数）`;

        if (!buckets.length) {
            chartEl.innerHTML = '<div style="padding: 18px; text-align:center; color:#999;">暂无数据</div>';
            return;
        }

        const maxCount = Math.max(1, ...buckets.map(b => Number(b?.count || 0)));
        const barW = 14;
        const gap = 4;
        const height = 240;
        const axisLeft = 46;   // 给 y 轴留的左边距
        const axisBottom = 22; // x 轴区域高度
        const axisTop = 10;    // 顶部留白
        const plotH = height - axisTop - axisBottom;
        const width = axisLeft + buckets.length * (barW + gap) + 12;

        const bars = buckets.map((b, idx) => {
            const start = Number(b?.start || 0);
            const end = Number(b?.end || 0);
            const count = Number(b?.count || 0);
            const h = Math.round((count / maxCount) * plotH);
            const x = axisLeft + idx * (barW + gap);
            const y = axisTop + (plotH - h);
            const title = `${start}~${end}: ${count}`;
            const fill = count === 0 ? 'rgba(173,181,189,0.55)' : 'rgba(24,144,255,0.78)';
            return `<g><title>${title}</title><rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" ry="3" fill="${fill}"></rect></g>`;
        }).join('');

        const ticks = buckets.map((b, idx) => {
            if (idx % 10 !== 0) return '';
            const start = Number(b?.start || 0);
            const x = axisLeft + idx * (barW + gap);
            return `<text x="${x}" y="${height - 6}" font-size="10" fill="rgba(0,0,0,0.45)">${start}</text>`;
        }).join('');

        // y 轴刻度（0/25/50/75/100%）
        const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => {
            const value = Math.round(maxCount * p);
            const y = axisTop + (plotH - Math.round(plotH * p));
            return `
                <g>
                    <line x1="${axisLeft - 6}" y1="${y}" x2="${axisLeft - 2}" y2="${y}" stroke="rgba(0,0,0,0.25)"></line>
                    <line x1="${axisLeft}" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(0,0,0,0.06)"></line>
                    <text x="${axisLeft - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="rgba(0,0,0,0.55)">${value}</text>
                </g>
            `;
        }).join('');

        const svg = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="difficulty histogram">
                <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
                <!-- y axis -->
                <line x1="${axisLeft}" y1="${axisTop}" x2="${axisLeft}" y2="${height - axisBottom}" stroke="rgba(0,0,0,0.18)"></line>
                ${yTicks}
                <!-- x axis -->
                <line x1="${axisLeft}" y1="${height - axisBottom}" x2="${width}" y2="${height - axisBottom}" stroke="rgba(0,0,0,0.10)"></line>
                ${bars}
                ${ticks}
            </svg>
        `;

        const top10 = buckets
            .map(b => ({ start: Number(b?.start || 0), end: Number(b?.end || 0), count: Number(b?.count || 0) }))
            .sort((a, c) => c.count - a.count)
            .slice(0, 10);

        chartEl.innerHTML = `
            <div style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap;">
                <div style="min-width: 520px; flex: 1;">
                    ${svg}
                    <div style="margin-top:6px; font-size: 12px; color:#999;">
                        提示：鼠标悬停每根柱子可查看区间与数量；底部刻度每 1000 标一次起点。
                    </div>
                </div>
                <div style="min-width: 280px; max-width: 420px; flex: 0 0 auto;">
                    <div style="font-size: 13px; font-weight: 700; color:#333; margin-bottom: 8px;">Top 10 桶</div>
                    <div style="border:1px solid #f0f0f0; border-radius: 10px; overflow:hidden; background:#fff;">
                        ${top10.map((b, i) => `<div style="display:flex; justify-content:space-between; padding: 10px 12px; border-bottom: ${i === top10.length - 1 ? 'none' : '1px solid #f5f5f5'};">
                            <span style="color:#666; font-size:12px;">${b.start}~${b.end}</span>
                            <span style="color:#111; font-weight:800;">${b.count}</span>
                        </div>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染对战题目列表
     */
    renderBattleList(data) {
        const listEl = document.getElementById('admin-battle-list');
        if (!data.list || data.list.length === 0) {
            listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无数据</div>';
            return;
        }

        const rows = data.list.map(item => {
            return `
                <div style="display: flex; align-items: center; padding: 16px; border-bottom: 1px solid #f0f0f0; gap: 16px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 4px;">题目ID: ${item.problemId}</div>
                        <div style="font-size: 13px; color: #666;">
                            难度: ${item.levelScore} | 
                            匹配: ${item.matchCount} | 
                            AC: ${item.acCount} | 
                            平均用时: ${item.avgSeconds}s
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="admin-battle-edit-btn" data-id="${item.id}" style="background: #1890ff; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            编辑
                        </button>
                        <button class="admin-battle-check-delete-btn" data-id="${item.id}" style="background: #faad14; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            检查删除
                        </button>
                        <button class="admin-battle-delete-btn" data-id="${item.id}" style="background: #ff4d4f; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            删除
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = rows;
        
        // 绑定编辑和删除按钮事件
        listEl.querySelectorAll('.admin-battle-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.editBattle(id);
            });
        });
        
        listEl.querySelectorAll('.admin-battle-check-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.checkDeleteBattle(id);
            });
        });
        
        listEl.querySelectorAll('.admin-battle-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.deleteBattle(id);
            });
        });
    }

    /**
     * 渲染对战题目分页
     */
    renderBattlePagination(total, page, limit) {
        const paginationEl = document.getElementById('admin-battle-pagination');
        const totalPages = Math.ceil(total / limit);
        
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        let html = '';
        if (page > 1) {
            html += `<button class="admin-battle-prev-btn" data-page="${page - 1}" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">上一页</button>`;
        }
        html += `<span style="color: #666; margin: 0 12px;">第 ${page} / ${totalPages} 页 (共 ${total} 条)</span>`;
        if (page < totalPages) {
            html += `<button class="admin-battle-next-btn" data-page="${page + 1}" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">下一页</button>`;
        }
        
        // 添加跳转输入框
        html += `<span style="margin-left: 16px; color: #666;">跳转到:</span>`;
        html += `<input type="number" id="admin-battle-goto-page" min="1" max="${totalPages}" value="${page}" 
                        style="width: 60px; padding: 4px 8px; margin: 0 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center;">`;
        html += `<button class="admin-battle-goto-btn" style="padding: 6px 12px; border: 1px solid #1890ff; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">跳转</button>`;

        paginationEl.innerHTML = html;
        
        // 绑定分页按钮事件
        paginationEl.querySelectorAll('.admin-battle-prev-btn, .admin-battle-next-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPage = parseInt(btn.dataset.page);
                this.loadBattleList(targetPage);
            });
        });
        
        // 绑定跳转按钮事件
        const gotoBtn = paginationEl.querySelector('.admin-battle-goto-btn');
        const gotoInput = paginationEl.querySelector('#admin-battle-goto-page');
        if (gotoBtn && gotoInput) {
            gotoBtn.addEventListener('click', () => {
                const targetPage = parseInt(gotoInput.value);
                if (targetPage >= 1 && targetPage <= totalPages) {
                    this.loadBattleList(targetPage);
                } else {
                    alert(`请输入 1-${totalPages} 之间的页码`);
                }
            });
            
            // 支持回车键跳转
            gotoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    gotoBtn.click();
                }
            });
        }
    }

    /**
     * 格式化日期为 YYYY-MM-DD
     */
    formatDate(dateValue) {
        if (!dateValue) return '';
        if (typeof dateValue === 'string') {
            // 字符串格式直接提取日期部分，避免时区问题
            return dateValue.split(' ')[0];
        }
        if (typeof dateValue === 'number') {
            // 时间戳转日期字符串，使用本地时区
            const d = new Date(dateValue);
            // 使用本地时区的年月日，避免时区转换问题
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return '';
    }

    /**
     * 显示每日一题新增/编辑模态框
     */
    showClockModal(item = null) {
        const isEdit = !!item;
        const dateValue = item ? this.formatDate(item.createTime) : '';
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>${isEdit ? '编辑' : '新增'}每日一题</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">日期 (YYYY-MM-DD) *</label>
                        <input type="date" id="clock-modal-date" value="${dateValue}" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">题目ID (questionId)</label>
                        <input type="number" id="clock-modal-question-id" value="${item?.questionId || ''}" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">问题ID (problemId)</label>
                        <input type="number" id="clock-modal-problem-id" value="${item?.problemId || ''}" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div id="clock-modal-error" style="color: #ff4d4f; margin-top: 12px; display: none;"></div>
                </div>
                <div class="modal-actions" style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="clock-modal-submit" style="padding: 8px 16px; border: none; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">
                        ${isEdit ? '更新' : '添加'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('clock-modal-submit').addEventListener('click', async () => {
            const errorEl = document.getElementById('clock-modal-error');
            errorEl.style.display = 'none';

            const date = document.getElementById('clock-modal-date').value;
            const questionId = document.getElementById('clock-modal-question-id').value;
            const problemId = document.getElementById('clock-modal-problem-id').value;

            if (!date) {
                errorEl.textContent = '请填写日期';
                errorEl.style.display = 'block';
                return;
            }

            if (!questionId && !problemId) {
                errorEl.textContent = '题目ID和问题ID至少填写一个';
                errorEl.style.display = 'block';
                return;
            }

            try {
                if (isEdit) {
                    // 编辑时使用按日期更新的接口，支持修改日期
                    await this.apiService.adminClockQuestionUpdate(date, questionId || null, problemId || null, '');
                } else {
                    await this.apiService.adminClockQuestionAdd(date, questionId || null, problemId || null, '');
                }
                modal.remove();
                this.loadClockList(this.clockPage);
                alert(isEdit ? '更新成功' : '添加成功');
            } catch (error) {
                errorEl.textContent = error.message || '操作失败';
                errorEl.style.display = 'block';
            }
        });

        // 移除点击外部关闭的功能，只能通过取消按钮关闭
    }

    /**
     * 编辑每日一题
     */
    async editClock(id) {
        try {
            const item = await this.apiService.adminClockQuestionGet(id);
            this.showClockModal(item);
        } catch (error) {
            alert('加载失败: ' + error.message);
        }
    }

    /**
     * 删除每日一题
     */
    async deleteClock(id, date) {
        if (!confirm(`确定要删除 ${date} 的每日一题吗？`)) return;

        try {
            await this.apiService.adminClockQuestionDeleteById(id);
            this.loadClockList(this.clockPage);
            alert('删除成功');
        } catch (error) {
            alert('删除失败: ' + error.message);
        }
    }

    /**
     * 显示对战题目新增/编辑模态框
     */
    showBattleModal(item = null) {
        const isEdit = !!item;
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>${isEdit ? '编辑' : '新增'}对战题目</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">题目ID (problemId) *</label>
                        <input type="number" id="battle-modal-problem-id" value="${item?.problemId || ''}" 
                               ${isEdit ? 'readonly' : ''} style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">难度等级分 *</label>
                        <input type="number" id="battle-modal-level-score" value="${item?.levelScore || ''}" 
                               min="1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    ${isEdit ? `
                        <div style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; font-size: 13px; color: #666;">
                            <div>匹配次数: ${item.matchCount || 0}</div>
                            <div>AC次数: ${item.acCount || 0}</div>
                            <div>平均用时: ${item.avgSeconds || 0}秒</div>
                        </div>
                    ` : ''}
                    <div id="battle-modal-error" style="color: #ff4d4f; margin-top: 12px; display: none;"></div>
                </div>
                <div class="modal-actions" style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="battle-modal-submit" style="padding: 8px 16px; border: none; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">
                        ${isEdit ? '更新' : '添加'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('battle-modal-submit').addEventListener('click', async () => {
            const errorEl = document.getElementById('battle-modal-error');
            errorEl.style.display = 'none';

            const problemId = document.getElementById('battle-modal-problem-id').value;
            const levelScore = parseInt(document.getElementById('battle-modal-level-score').value);

            if (!problemId) {
                errorEl.textContent = '请填写题目ID';
                errorEl.style.display = 'block';
                return;
            }

            if (!levelScore || levelScore <= 0) {
                errorEl.textContent = '难度等级分必须是正数';
                errorEl.style.display = 'block';
                return;
            }

            try {
                if (isEdit) {
                    await this.apiService.adminBattleProblemUpdate(item.id, levelScore);
                } else {
                    await this.apiService.adminBattleProblemAdd(problemId, levelScore);
                }
                modal.remove();
                this.loadBattleList(this.battlePage);
                alert(isEdit ? '更新成功' : '添加成功');
            } catch (error) {
                errorEl.textContent = error.message || '操作失败';
                errorEl.style.display = 'block';
            }
        });

        // 移除点击外部关闭的功能，只能通过取消按钮关闭
    }

    /**
     * 显示批量添加模态框
     */
    showBattleBatchAddModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>批量添加对战题目</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="margin-bottom: 12px; color: #666; font-size: 13px;">
                        每行一个，格式：problemId,levelScore<br>
                        例如：12345,1600
                    </div>
                    <textarea id="battle-batch-text" rows="15" 
                              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px;"
                              placeholder="12345,1600&#10;12346,1700&#10;12347,1800"></textarea>
                    <div id="battle-batch-error" style="color: #ff4d4f; margin-top: 12px; display: none;"></div>
                </div>
                <div class="modal-actions" style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="battle-batch-submit" style="padding: 8px 16px; border: none; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">
                        添加
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('battle-batch-submit').addEventListener('click', async () => {
            const errorEl = document.getElementById('battle-batch-error');
            errorEl.style.display = 'none';

            const text = document.getElementById('battle-batch-text').value.trim();
            if (!text) {
                errorEl.textContent = '请填写题目数据';
                errorEl.style.display = 'block';
                return;
            }

            const lines = text.split('\n').filter(line => line.trim());
            const items = [];
            for (const line of lines) {
                const parts = line.split(',').map(s => s.trim());
                if (parts.length !== 2) {
                    errorEl.textContent = `格式错误: ${line}`;
                    errorEl.style.display = 'block';
                    return;
                }
                const problemId = parseInt(parts[0]);
                const levelScore = parseInt(parts[1]);
                if (!problemId || !levelScore || levelScore <= 0) {
                    errorEl.textContent = `数据错误: ${line} (难度必须是正数)`;
                    errorEl.style.display = 'block';
                    return;
                }
                items.push({ problemId, levelScore });
            }

            try {
                const result = await this.apiService.adminBattleProblemBatchAdd(items);
                modal.remove();
                this.loadBattleList(this.battlePage);
                if (result.failCount > 0) {
                    alert(`成功添加 ${result.successCount} 条，失败 ${result.failCount} 条\n失败项：\n${result.failItems.map(item => `题目${item.problemId}: ${item.reason}`).join('\n')}`);
                } else {
                    alert(`成功添加 ${result.successCount} 条`);
                }
            } catch (error) {
                errorEl.textContent = error.message || '批量添加失败';
                errorEl.style.display = 'block';
            }
        });

        // 移除点击外部关闭的功能，只能通过取消按钮关闭
    }

    /**
     * 编辑对战题目
     */
    async editBattle(id) {
        try {
            const item = await this.apiService.adminBattleProblemGet(id);
            this.showBattleModal(item);
        } catch (error) {
            alert('加载失败: ' + error.message);
        }
    }

    /**
     * 检查删除对战题目
     */
    async checkDeleteBattle(id) {
        try {
            const result = await this.apiService.adminBattleProblemCheckDelete(id);
            const riskColors = { low: '#52c41a', medium: '#faad14', high: '#ff4d4f' };
            const riskTexts = { low: '低风险', medium: '中等风险', high: '高风险' };
            
            let message = `删除风险评估\n\n`;
            message += `风险等级: ${riskTexts[result.riskLevel]}\n`;
            message += `匹配次数: ${result.matchCount}\n`;
            message += `AC次数: ${result.acCount}\n`;
            if (result.warnings && result.warnings.length > 0) {
                message += `\n警告:\n${result.warnings.join('\n')}\n`;
            }
            message += `\n确定要删除吗？`;

            if (confirm(message)) {
                await this.deleteBattle(id);
            }
        } catch (error) {
            alert('检查失败: ' + error.message);
        }
    }

    /**
     * 删除对战题目
     */
    async deleteBattle(id) {
        if (!confirm('确定要删除这道题目吗？')) return;

        try {
            await this.apiService.adminBattleProblemDelete(id);
            this.loadBattleList(this.battlePage);
            alert('删除成功');
        } catch (error) {
            alert('删除失败: ' + error.message);
        }
    }

    /**
     * 批量删除对战题目
     */
    /**
     * 显示批量删除模态框
     */
    showBatchDeleteModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>批量删除对战题目</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">problemId列表 *</label>
                        <textarea id="batch-delete-problem-ids" 
                                  placeholder="请输入problemId，支持用换行、空格或逗号分隔&#10;例如：&#10;12345&#10;12346, 12347&#10;12348 12349" 
                                  style="width: 100%; min-height: 150px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 14px; resize: vertical;"></textarea>
                        <div style="margin-top: 6px; font-size: 12px; color: #666;">
                            提示：支持换行、空格或逗号分隔多个problemId
                        </div>
                    </div>
                    <div id="batch-delete-error" style="color: #ff4d4f; margin-top: 12px; display: none;"></div>
                    <div id="batch-delete-result" style="margin-top: 12px; display: none;">
                        <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">删除结果</div>
                        <pre id="batch-delete-result-json" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 220px;"></pre>
                    </div>
                </div>
                <div class="modal-actions" style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="batch-delete-submit" style="padding: 8px 16px; border: none; background: #ff4d4f; color: #fff; border-radius: 4px; cursor: pointer;">
                        批量删除
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const errorEl = modal.querySelector('#batch-delete-error');
        const resultWrapEl = modal.querySelector('#batch-delete-result');
        const resultJsonEl = modal.querySelector('#batch-delete-result-json');
        const submitBtn = modal.querySelector('#batch-delete-submit');
        const problemIdsInput = modal.querySelector('#batch-delete-problem-ids');

        submitBtn.addEventListener('click', async () => {
            const problemIdsText = problemIdsInput.value.trim();
            if (!problemIdsText) {
                errorEl.textContent = '请输入problemId列表';
                errorEl.style.display = 'block';
                return;
            }

            // 解析problemId：支持换行、空格、逗号分隔
            const problemIds = problemIdsText
                .split(/[\n\r,，\s]+/)
                .map(id => id.trim())
                .filter(id => id.length > 0)
                .map(id => parseInt(id))
                .filter(id => !isNaN(id) && id > 0);

            if (problemIds.length === 0) {
                errorEl.textContent = '未找到有效的problemId';
                errorEl.style.display = 'block';
                return;
            }

            // 去重
            const uniqueProblemIds = [...new Set(problemIds)];

            errorEl.style.display = 'none';
            if (resultWrapEl) resultWrapEl.style.display = 'none';
            
            // 确认删除
            if (!confirm(`确定要删除 ${uniqueProblemIds.length} 道题目吗？\n\nproblemId列表：${uniqueProblemIds.join(', ')}`)) {
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = '删除中...';

            try {
                // 直接使用problemId列表进行批量删除
                const result = await this.apiService.adminBattleProblemBatchDelete(uniqueProblemIds);
                this.loadBattleList(this.battlePage);
                
                const deletedCount = Number(
                    (result && (result.rowsAffected ?? result.deletedCount ?? result.deleted ?? result.count)) ?? uniqueProblemIds.length
                ) || uniqueProblemIds.length;

                // 在弹窗内展示结果（比 alert 更直观）
                if (resultWrapEl && resultJsonEl) {
                    resultWrapEl.style.display = 'block';
                    const showObj = Object.assign(
                        {
                            requested: uniqueProblemIds.length,
                            deletedCount: deletedCount
                        },
                        (result && typeof result === 'object') ? result : { raw: result }
                    );
                    resultJsonEl.textContent = JSON.stringify(showObj, null, 2);
                }

                alert(`成功删除 ${deletedCount} 道题目`);
                submitBtn.textContent = '再删一批';
                submitBtn.disabled = false;
            } catch (error) {
                errorEl.textContent = error.message || '批量删除失败';
                errorEl.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = '批量删除';
            }
        });

        // 移除点击外部关闭的功能，只能通过取消按钮关闭
    }

    async handleBatchDelete() {
        this.showBatchDeleteModal();
    }

    /**
     * 渲染年度报告可视化（分页酷炫版）
     */
    renderYearReportVisuals(data) {
        const container = document.getElementById('admin-year-report-visuals');
        if (!container) return;
        
        container.style.display = 'block';
        
        // 1. 生成页面数据
        const slides = this.generateReportSlides(data);
        
        // 2. 构建 HTML 结构
        let slidesHtml = '';
        slides.forEach((slide, idx) => {
            const isHidden = idx !== 0 ? 'display:none;' : '';
            const chartHtml = slide.chartId ? `<div class="slide-chart-container" id="${slide.chartId}"></div>` : '';
            const contentHtml = slide.content ? slide.content : `
                <div class="slide-text">${slide.text}</div>
                ${chartHtml}
            `;
            
            slidesHtml += `
                <div class="report-slide slide-${slide.type}" id="report-slide-${idx}" style="${isHidden}">
                    <div class="slide-inner">
                        <div class="slide-header">
                            <div class="slide-subtitle">${slide.subtitle || ''}</div>
                            <div class="slide-title">${slide.title}</div>
                        </div>
                        <div class="slide-body">
                            ${contentHtml}
                        </div>
                        <div class="slide-footer">
                            ${idx + 1} / ${slides.length}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="report-stage">
                ${slidesHtml}
                <div class="slide-controls">
                    <button id="slide-prev-btn" class="slide-btn" disabled>❮</button>
                    <button id="slide-next-btn" class="slide-btn">❯</button>
                </div>
            </div>
        `;

        // 3. 渲染图表 (在 DOM 插入后)
        // 注意：某些图表库如果容器隐藏可能渲染大小有问题，但我们是手写SVG，通常没问题。
        // 如果有问题，可以在切换 slide 时再渲染。这里先一次性渲染。
        
        // Slide 2: Time
        if (slides.find(s => s.type === 'time')) {
            this.drawTimeDistribution(data.habits?.hour_histogram, document.getElementById('slide-chart-time'));
        }
        // Slide 3: Trend
        if (slides.find(s => s.type === 'trend')) {
            this.drawTrend(data.timeseries?.by_month, document.getElementById('slide-chart-trend'));
        }
        // Slide 4: Radar
        if (slides.find(s => s.type === 'radar')) {
            this.drawRadar(data.tags?.radar, document.getElementById('slide-chart-radar'));
        }
        // Slide 5: Difficulty
        if (slides.find(s => s.type === 'difficulty')) {
            this.drawDifficulty(data.difficulty?.bucket_breakdown, document.getElementById('slide-chart-diff'));
        }

        // 4. 绑定翻页事件
        let currentSlide = 0;
        const totalSlides = slides.length;
        const prevBtn = document.getElementById('slide-prev-btn');
        const nextBtn = document.getElementById('slide-next-btn');

        const updateButtons = () => {
            prevBtn.disabled = currentSlide === 0;
            nextBtn.disabled = currentSlide === totalSlides - 1;
            prevBtn.style.opacity = prevBtn.disabled ? '0.3' : '1';
            nextBtn.style.opacity = nextBtn.disabled ? '0.3' : '1';
        };

        const showSlide = (idx) => {
            // 简单切换：隐藏所有，显示当前
            for (let i = 0; i < totalSlides; i++) {
                const el = document.getElementById(`report-slide-${i}`);
                if (el) {
                    el.style.display = i === idx ? 'flex' : 'none';
                    if (i === idx) {
                        // 简单的进入动画类重置
                        el.classList.remove('fade-in');
                        void el.offsetWidth; // trigger reflow
                        el.classList.add('fade-in');
                    }
                }
            }
            currentSlide = idx;
            updateButtons();
        };

        prevBtn.onclick = () => {
            if (currentSlide > 0) showSlide(currentSlide - 1);
        };
        nextBtn.onclick = () => {
            if (currentSlide < totalSlides - 1) showSlide(currentSlide + 1);
        };

        // 键盘支持
        if (!this.hasBoundSlideKeys) {
            document.addEventListener('keydown', (e) => {
                // 只有当面板显示时才响应
                if (container.style.display === 'none') return;
                if (e.key === 'ArrowLeft') document.getElementById('slide-prev-btn')?.click();
                if (e.key === 'ArrowRight') document.getElementById('slide-next-btn')?.click();
            });
            this.hasBoundSlideKeys = true;
        }
        
        updateButtons();
    }

    /**
     * 生成报告各页面的文案和数据
     */
    generateReportSlides(data) {
        const slides = [];

        // --- Slide 1: 封面 ---
        slides.push({
            type: 'cover',
            title: `${data.year || '2025'} 年度代码旅程`,
            subtitle: `USER ID: ${data.uid}`,
            content: `
                <div class="stat-big-box">
                    <div class="stat-val-huge">${data.overview.problems_solved}</div>
                    <div class="stat-label">年度解题数</div>
                </div>
                <div class="stat-sub-text">击败了 <span style="color:#faad14">自己的懒惰</span></div>
                <div style="margin-top:30px;font-size:14px;color:#999;">按左右键翻页 →</div>
            `
        });

        // --- Slide 2: 勤奋 (活跃天数 + 作息) ---
        const hours = data.habits?.hour_histogram || [];
        let lateNightCount = 0;
        // 23, 0, 1, 2, 3, 4 点视为深夜
        [23, 0, 1, 2, 3, 4].forEach(h => lateNightCount += (hours[h] || 0));
        
        let timeCopy = '';
        if (lateNightCount > 10) {
            timeCopy = `你是名副其实的 <span class="highlight-text">深夜战神</span>，<br>在万籁俱寂时提交了 <span class="highlight-num">${lateNightCount}</span> 次代码。<br>记得早点休息，头发很重要。`;
        } else if (hours.slice(6, 12).reduce((a,b)=>a+(b||0), 0) > hours.slice(18, 24).reduce((a,b)=>a+(b||0), 0)) {
            timeCopy = `你习惯在 <span class="highlight-text">清晨</span> 开启挑战，<br>早起的鸟儿有虫吃。<br>清晨的第一行代码，最清醒。`;
        } else {
            timeCopy = `无数个 <span class="highlight-text">日与夜</span>，<br>都见证了你思维的火花。<br>坚持，是最大的天赋。`;
        }

        slides.push({
            type: 'time',
            title: '日夜兼程',
            subtitle: 'ACTIVE DAYS',
            text: `这一年，你活跃了 <span class="highlight-num">${data.overview.active_days}</span> 天。<br>${timeCopy}`,
            chartId: 'slide-chart-time'
        });

        // --- Slide 3: 热血 (月份趋势) ---
        let maxMonth = 1;
        let maxMonthVal = 0;
        const months = data.timeseries?.by_month || [];
        months.forEach((m, i) => {
            if (m.submissions > maxMonthVal) {
                maxMonthVal = m.submissions;
                maxMonth = i + 1;
            }
        });
        
        let monthCopy = '';
        if (maxMonthVal > 0) {
            monthCopy = `<span class="highlight-num">${maxMonth}月</span> 是你最热血的时刻，<br>单月狂飙 <span class="highlight-num">${maxMonthVal}</span> 次提交！<br>那个月发生了什么？`;
        } else {
            monthCopy = `平平淡淡才是真，<br>每一步都算数。<br>明年继续加油！`;
        }

        slides.push({
            type: 'trend',
            title: '热血时刻',
            subtitle: 'MONTHLY TREND',
            text: monthCopy,
            chartId: 'slide-chart-trend'
        });

        // --- Slide 4: 技能 (雷达) ---
        const favTag = data.tags?.favorite_tag;
        let tagCopy = '';
        if (favTag && favTag.tag_name) {
            tagCopy = `你的真爱是 <span class="highlight-text">${favTag.tag_name}</span>，<br>解决该类题目 <span class="highlight-num">${favTag.solved_count}</span> 道。<br>专精一项，也是绝技。`;
        } else {
            tagCopy = `你正在构建自己的 <span class="highlight-text">六边形</span> 战士属性。<br>多点开花，全面发展。`;
        }
        
        slides.push({
            type: 'radar',
            title: '能力版图',
            subtitle: 'SKILL RADAR',
            text: tagCopy,
            chartId: 'slide-chart-radar'
        });

        // --- Slide 5: 攻坚 (最难题) ---
        const hardest = data.difficulty?.hardest_solved;
        let hardCopy = '';
        if (hardest && hardest.title) {
            hardCopy = `当你 AC <span class="highlight-text">${hardest.title}</span> (R${hardest.difficulty}) 时，<br>那种成就感一定无与伦比。<br>困难是强者的垫脚石。`;
        } else {
            hardCopy = `攀登高峰的路上，<br>每一步都值得铭记。<br>去挑战更难的题目吧！`;
        }

        slides.push({
            type: 'difficulty',
            title: '攻坚克难',
            subtitle: 'DIFFICULTY',
            text: hardCopy,
            chartId: 'slide-chart-diff'
        });

        // --- Slide 6: 质量 (拆分出来) ---
        const oneShot = data.highlights?.one_shot_ac?.count || 0;
        let acRateRaw = data.quality?.first_ac_rate || 0;
        // 格式化为百分比整数，例如 0.452 -> 45%
        const acRate = Math.floor(Number(acRateRaw) * 100) + '%';
        
        slides.push({
            type: 'quality',
            title: '极致追求',
            subtitle: 'QUALITY',
            content: `
                 <div class="summary-grid" style="gap:50px;">
                    <div class="summary-item">
                        <div class="s-val">${oneShot}</div>
                        <div class="s-label">无伤AC次数</div>
                    </div>
                    <div class="summary-item">
                        <div class="s-val">${acRate}</div>
                        <div class="s-label">无伤AC率</div>
                    </div>
                 </div>
                 <div class="slide-text" style="margin-top:30px;">
                    每一次 <span class="highlight-text">One Shot</span>，<br>都是思维与代码的完美共鸣。
                 </div>
            `
        });

        // --- Slide 7: 结尾 (年度称号 + 总结) ---
        const streak = data.overview.longest_streak || 0;
        const solved = data.overview.problems_solved || 0;
        const activeDays = data.overview.active_days || 0;
        const hardestRating = data.difficulty?.hardest_solved?.difficulty || 0;
        
        // 计算称号
        let titleName = '潜力新星';
        let titleDesc = '未来的路还很长，保持热爱。';
        let titleColor = '#52c41a'; // Green
        if (activeDays > 200) {
            titleName = '绝世卷王';
            titleDesc = '只要卷不死，就往死里卷。';
            titleColor = '#faad14'; // Gold
        } else if (solved > 500) {
            titleName = '登峰造极';
            titleDesc = '你站在群山之巅，俯视代码的海洋。';
            titleColor = '#f5222d'; // Red
        } else if (hardestRating >= 2400) {
            titleName = '屠龙勇士';
            titleDesc = '面对最凶恶的难题，你挥出了致命一击。';
            titleColor = '#722ed1'; // Purple
        } else if (streak >= 30) {
            titleName = '毅力帝';
            titleDesc = '风雨无阻，你是时间的朋友。';
            titleColor = '#1890ff'; // Blue
        } else if (solved > 150) {
            titleName = '中流砥柱';
            titleDesc = '现在的你，已是独当一面的强者。';
            titleColor = '#13c2c2'; // Cyan
        }

        slides.push({
            type: 'end',
            title: '年度称号',
            subtitle: `${data.year || '2025'} ACHIEVEMENT`,
            content: `
                 <div style="position:relative; display:inline-block; padding: 20px 40px; border: 4px solid ${titleColor}; border-radius: 8px; margin-top: 20px;">
                    <div style="font-size: 48px; font-weight: 900; color: ${titleColor}; letter-spacing: 6px; text-shadow: 0 0 15px ${titleColor}66;">
                        ${titleName}
                    </div>
                    <div style="position:absolute; top:-14px; left:50%; transform:translateX(-50%); background:#1f1f1f; padding:0 10px; color:${titleColor}; font-size:12px; letter-spacing:2px;">
                        NO. ${data.uid}
                    </div>
                 </div>
                 
                 <div class="slide-text" style="margin-top:30px; font-style: italic;">
                    “${titleDesc}”
                 </div>

                 <div style="margin-top:50px; display:flex; gap:30px; justify-content:center; opacity:0.8;">
                     <div style="text-align:center">
                        <div style="font-size:18px; font-weight:700; color:#fff;">${solved}</div>
                        <div style="font-size:10px; color:#888;">总解题</div>
                     </div>
                     <div style="text-align:center">
                        <div style="font-size:18px; font-weight:700; color:#fff;">${streak}</div>
                        <div style="font-size:10px; color:#888;">连打卡</div>
                     </div>
                     <div style="text-align:center">
                        <div style="font-size:18px; font-weight:700; color:#fff;">${activeDays}</div>
                        <div style="font-size:10px; color:#888;">活跃天</div>
                     </div>
                 </div>
                 
                 <div style="margin-top:40px;font-size:12px;opacity:0.3;">Generated by Nowcoder Tracker</div>
            `
        });

        return slides;
    }

    /**
     * 绘制简易热力图 (12个月平铺)
     */
    drawHeatmap(dayData, container) {
        if (!dayData || !container) return;
        // Map date -> count
        const counts = {};
        let maxVal = 0;
        dayData.forEach(d => {
            counts[d.date] = d.submissions; // 或 d.problems_solved
            if (d.submissions > maxVal) maxVal = d.submissions;
        });

        // 生成12个月
        let html = '';
        for (let m = 0; m < 12; m++) {
            // 简单起见，每个月 5x7 格子示意，真实日历计算较繁琐
            // 这里我们做简化：直接把当月数据铺开
            html += `<div class="month-grid-item"><div class="month-label">${m + 1}月</div><div class="month-days">`;
            // 假设每月30天，真实对齐需要 new Date
            for (let d = 1; d <= 31; d++) {
                // 构造 YYYY-MM-DD (假定2025)
                // 注意：这里没传年份，暂时无法准确对应星期，仅做格子展示
                // 实际应从 dayData[0].date 获取年份
                const dateKey = `2025-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const val = counts[dateKey] || 0;
                let colorClass = 'lvl-0';
                if (val > 0) colorClass = 'lvl-1';
                if (val > 2) colorClass = 'lvl-2';
                if (val > 5) colorClass = 'lvl-3';
                if (val > 8) colorClass = 'lvl-4';
                html += `<div class="day-cell ${colorClass}" title="${dateKey}: ${val}"></div>`;
            }
            html += `</div></div>`;
        }
        container.innerHTML = html;
    }

    /**
     * 绘制 SVG 雷达图
     */
    drawRadar(radarData, container) {
        if (!radarData || radarData.length < 3) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#999">数据不足</div>';
            return;
        }
        // 扩大画板尺寸以容纳长标签（如“动态规划”）
        const size = 280;
        const center = size / 2;
        const radius = 85; // 半径适中
        const count = radarData.length;
        
        // 计算多边形点
        const getPolyPoints = (r) => {
            return radarData.map((_, i) => {
                const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
                const x = center + r * Math.cos(angle);
                const y = center + r * Math.sin(angle);
                return `${x},${y}`;
            }).join(' ');
        };

        // 背景网格 (3层)
        let svg = `<svg width="100%" height="100%" viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet">`;
        [0.3, 0.6, 1].forEach(scale => {
            svg += `<polygon points="${getPolyPoints(radius * scale)}" fill="none" stroke="#ddd" stroke-width="1"/>`;
        });

        // 数据多边形
        const dataPoints = radarData.map((item, i) => {
            const score = item.score || 0;
            const r = radius * score;
            const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);
            return `${x},${y}`;
        }).join(' ');

        svg += `<polygon points="${dataPoints}" fill="rgba(24, 144, 255, 0.2)" stroke="#1890ff" stroke-width="2"/>`;

        // 文字标签
        radarData.forEach((item, i) => {
            const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
            const labelR = radius + 20; // 文字距离图形更远一点
            const x = center + labelR * Math.cos(angle);
            const y = center + labelR * Math.sin(angle);
            
            // 优化对齐逻辑
            let anchor = 'middle';
            // 角度归一化到 0~2PI
            let normAngle = angle % (Math.PI * 2);
            if (normAngle < 0) normAngle += Math.PI * 2;
            
            // 上 (3/2 PI 或 -1/2 PI)
            if (Math.abs(normAngle - Math.PI * 1.5) < 0.2) {
                anchor = 'middle';
            } 
            // 下 (1/2 PI)
            else if (Math.abs(normAngle - Math.PI * 0.5) < 0.2) {
                anchor = 'middle';
            }
            // 右 (0 或 2PI)
            else if (Math.abs(normAngle) < 0.2 || Math.abs(normAngle - Math.PI*2) < 0.2) {
                anchor = 'start';
            }
            // 左 (PI)
            else if (Math.abs(normAngle - Math.PI) < 0.2) {
                anchor = 'end';
            }
            // 其他象限
            else {
                anchor = x > center ? 'start' : 'end';
            }

            // 微调 Y 轴
            let dy = 4;
            if (y < center - radius) dy = 0; // 顶部文字上移
            if (y > center + radius) dy = 10; // 底部文字下移

            svg += `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="12" fill="#888" dy="${dy}">${item.name}</text>`;
        });

        svg += `</svg>`;
        container.innerHTML = svg;
    }

    /**
     * 绘制 SVG 趋势图 (柱状)
     */
    drawTrend(monthData, container) {
        if (!monthData) return;
        const h = 150;
        const w = 300;
        const barW = (w / 12) * 0.6;
        const gap = (w / 12) * 0.4;
        
        let maxVal = 0;
        monthData.forEach(d => maxVal = Math.max(maxVal, d.submissions));
        if (maxVal === 0) maxVal = 1;

        let svg = `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`;
        
        monthData.forEach((d, i) => {
            const val = d.submissions;
            const barH = (val / maxVal) * (h - 20);
            const x = i * (w / 12) + gap / 2;
            const y = h - barH - 20; // 留底部文字空间
            svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="#1890ff" rx="2" />`;
            svg += `<text x="${x + barW/2}" y="${h - 5}" font-size="10" fill="#999" text-anchor="middle">${i+1}</text>`;
        });
        
        svg += `</svg>`;
        container.innerHTML = svg;
    }

    /**
     * 绘制 SVG 难度分布 (垂直柱状图)
     */
    drawDifficulty(rawBuckets, container) {
        if (!rawBuckets) return;
        
        // 过滤掉 unknown (不区分大小写)
        const buckets = rawBuckets.filter(b => b.bucket && b.bucket.toLowerCase() !== 'unknown');

        const total = buckets.reduce((acc, cur) => acc + cur.problems_solved, 0);
        if (total === 0) {
            container.innerHTML = '<div style="color:#999">暂无数据</div>';
            return;
        }

        const h = 180; // 增加高度
        const w = 340;
        let maxVal = 0;
        buckets.forEach(b => maxVal = Math.max(maxVal, b.problems_solved));
        if (maxVal === 0) maxVal = 1;

        let svg = `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`;
        
        const count = buckets.length;
        const gap = 10;
        const barW = count > 0 ? (w - (count - 1) * gap) / count : w;
        const colors = ['#bfbfbf', '#52c41a', '#1890ff', '#722ed1', '#eb2f96', '#f5222d', '#333']; // 对应不同段位颜色
        
        buckets.forEach((b, i) => {
            const val = b.problems_solved;
            const barH = (val / maxVal) * (h - 30); // 留出底部文字空间
            const x = i * (barW + gap);
            const y = h - barH - 20;
            const color = colors[i % colors.length];
            
            // 柱子
            if (val > 0) {
                svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="2" opacity="0.8" />`;
                // 数值 (如果柱子太矮就显示在上方，否则内部)
                const textY = barH > 20 ? y + 15 : y - 5;
                const textColor = barH > 20 ? '#fff' : '#888';
                if (val > 0) {
                     svg += `<text x="${x + barW/2}" y="${textY}" font-size="10" fill="${textColor}" text-anchor="middle">${val}</text>`;
                }
            }
            
            // 标签 (简化显示，如 "入门")
            let label = b.bucket;
            // 尝试简化标签，例如 "入门(0-999)" -> "入门"
            if (label.includes('(')) label = label.split('(')[0];
            
            svg += `<text x="${x + barW/2}" y="${h-5}" font-size="10" fill="#666" text-anchor="middle">${label}</text>`;
        });
        
        svg += `</svg>`;
        container.innerHTML = svg;
    }

    /**
     * 绘制 SVG 时间分布 (柱状)
     */
    drawTimeDistribution(hours, container) {
        if (!hours) return;
        const h = 100;
        const w = 300;
        let maxVal = 0;
        hours.forEach(d => maxVal = Math.max(maxVal, d.submissions));
        if (maxVal === 0) maxVal = 1;

        let svg = `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`;
        const barW = w / 24;
        
        hours.forEach((d, i) => {
            const val = d.submissions;
            const barH = (val / maxVal) * h;
            const x = i * barW;
            const y = h - barH;
            svg += `<rect x="${x}" y="${y}" width="${barW - 1}" height="${barH}" fill="#faad14" />`;
        });
        
        svg += `</svg>`;
        container.innerHTML = svg;
    }

    /**
     * 注入可视化样式
     */
    injectVisualStyles() {
        if (document.getElementById('admin-visual-styles')) return;
        const style = document.createElement('style');
        style.id = 'admin-visual-styles';
        style.textContent = `
            .report-visuals-container {
                margin-top: 20px;
                padding: 0;
                background: #000;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            .report-stage {
                position: relative;
                width: 100%;
                height: 480px; /* 固定高度模拟手机屏比例或幻灯片 */
                background: linear-gradient(135deg, #1f1f1f 0%, #111 100%);
                color: #fff;
            }
            .report-slide {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 40px;
                box-sizing: border-box;
                text-align: center;
                animation: fadeIn 0.5s ease;
            }
            .fade-in {
                animation: fadeIn 0.5s ease forwards;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .slide-inner {
                width: 100%;
                max-width: 400px;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .slide-header {
                margin-bottom: 24px;
            }
            .slide-subtitle {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 2px;
                opacity: 0.6;
                color: #faad14;
                margin-bottom: 4px;
            }
            .slide-title {
                font-size: 28px;
                font-weight: 800;
                background: linear-gradient(to right, #fff, #bbb);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .slide-body {
                flex: 1;
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 20px;
            }
            .slide-text {
                font-size: 16px;
                line-height: 1.6;
                color: #ddd;
                margin-bottom: 10px;
            }
            .highlight-text {
                color: #1890ff;
                font-weight: 700;
                font-size: 18px;
            }
            .highlight-num {
                color: #faad14;
                font-weight: 700;
                font-size: 20px;
                font-family: 'Segoe UI', Roboto, sans-serif;
            }
            .slide-footer {
                margin-top: 30px;
                font-size: 12px;
                opacity: 0.3;
            }
            
            .stat-val-huge {
                font-size: 64px;
                font-weight: 800;
                color: #1890ff;
                text-shadow: 0 0 20px rgba(24,144,255,0.3);
                line-height: 1;
            }
            .stat-label {
                font-size: 14px;
                opacity: 0.7;
                margin-top: 8px;
            }
            .stat-sub-text {
                font-size: 16px;
                margin-top: 16px;
                font-weight: 600;
            }
            
            .slide-chart-container {
                width: 100%;
                height: 220px;
                background: rgba(255,255,255,0.03);
                border-radius: 8px;
                padding: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .summary-grid {
                display: flex;
                gap: 30px;
                justify-content: center;
            }
            .summary-item .s-val {
                font-size: 28px;
                font-weight: 700;
                color: #52c41a;
            }
            .summary-item .s-label {
                font-size: 12px;
                opacity: 0.6;
            }
            
            .slide-controls {
                position: absolute;
                bottom: 20px;
                right: 20px;
                display: flex;
                gap: 8px;
                z-index: 10;
            }
            .slide-btn {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                color: #fff;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
            }
            .slide-btn:hover:not(:disabled) {
                background: rgba(255,255,255,0.3);
            }
            .slide-btn:disabled {
                opacity: 0.3;
                cursor: not-allowed;
            }

            /* 覆盖SVG文字颜色为浅色 */
            .slide-chart-container text {
                fill: #888 !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 隐藏视图
     */
    hide() {
        // 可以在这里添加清理逻辑
    }
}
    