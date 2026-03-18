/**
 * 管理员视图
 * 只有管理员用户才能看到和访问此视图
 */

export class AdminView {
    constructor(elements, state, apiService) {
        this.container = elements.adminContainer;
        this.apiService = apiService;
        this.state = state;
        // 旧结构：currentTab 用于顶层 tab 切换（保留兼容）
        this.currentTab = 'clock'; // 'clock' | 'battle' | 'import' | 'yearReport' | 'tag' | 'contestDifficulty' | 'promptChallenge' | 'qmsDraft'
        // 新结构：按业务域（顶部）+ 子栏目（左侧）组织
        this.adminDomain = 'course';   // course | library | battle | contest | data | ai | activity | record
        this.adminSection = 'daily';   // depends on domain
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
        // 管理员调试：Redis key 查询
        this.adminRedisDebugLast = null;
        // 管理员验数：春季AI体验站抽奖记录
        this.adminSpring2026AiLotteryLast = null;
        // Prompt Challenge demo
        this.promptChallengeListCache = null;
        this.aiPuzzleAdminSchemaLast = null;
        this.aiPuzzleAdminStatsLast = null;
        // QMS 录题测试：保留最近一次响应（便于排查）
        this.qmsDraftLastResult = null;
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

        // 初始化默认 section（避免空）
        try {
            const dom = this.getAdminDomains();
            const d = dom.find(x => x.id === this.adminDomain) || dom[0];
            if (d) {
                const secIds = d.sections.map(s => s.id);
                if (!secIds.includes(this.adminSection)) this.adminSection = d.sections[0]?.id || this.adminSection;
                this.adminDomain = d.id;
            }
        } catch (_) {}

        // 渲染管理员页面内容
        this.container.innerHTML = `
            <div style="padding: 20px;">
                <h2 style="font-size: 24px; font-weight: 600; color: #333; margin-bottom: 24px;">
                    ⚙️ 管理员面板
                </h2>

                <!-- 顶部：业务域 -->
                <div id="admin-domain-bar" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
                    ${this.renderAdminDomainBar()}
                </div>

                <!-- 主区域：左侧子栏目 + 右侧内容 -->
                <div style="display:flex; gap: 14px; align-items: flex-start;">
                    <div id="admin-side-nav" style="width: 190px; min-width: 190px; background:#fff; border:1px solid #f0f0f0; border-radius: 12px; padding: 10px;">
                        ${this.renderAdminSideNav()}
                    </div>
                    <div style="flex:1; min-width: 0;">
                        <!-- 课程 -->
                        <div id="admin-clock-panel" class="admin-panel" style="display:none;">
                            ${this.renderClockPanel()}
                        </div>
                        <div id="admin-course-livecourse-panel" class="admin-panel" style="display:none;">
                            ${this.renderLivecourseImportOneEmptyCoursePanel()}
                        </div>

                        <!-- 题库 -->
                        <div id="admin-tag-panel" class="admin-panel" style="display:none;">
                            ${this.renderTagPanel()}
                        </div>
                        <div id="admin-library-accept-person-panel" class="admin-panel" style="display:none;">
                            ${this.renderAcmProblemOpenRebuildAcceptPersonPanel()}
                        </div>
                        <div id="admin-library-tracker-import-panel" class="admin-panel" style="display:none;">
                            ${this.renderAcmProblemOpenBatchImportPanel()}
                        </div>

                        <!-- 对战 -->
                        <div id="admin-battle-panel" class="admin-panel" style="display:none;">
                            ${this.renderBattlePanel()}
                        </div>
                        <div id="admin-battle-ops-panel" class="admin-panel" style="display:none;">
                            ${this.renderBattleOpsPanel()}
                        </div>

                        <!-- 竞赛 -->
                        <div id="admin-contest-difficulty-panel" class="admin-panel" style="display:none;">
                            ${this.renderContestDifficultyPanel()}
                        </div>

                        <!-- 数据 -->
                        <div id="admin-data-year-report-panel" class="admin-panel" style="display:none;">
                            ${this.renderYearReportPanel()}
                        </div>
                        <div id="admin-data-redis-debug-panel" class="admin-panel" style="display:none;">
                            ${this.renderRedisDebugPanel()}
                        </div>

                        <!-- AI -->
                        <div id="admin-prompt-challenge-panel" class="admin-panel" style="display:none;">
                            ${this.renderPromptChallengePanel()}
                        </div>
                        <div id="admin-ai-puzzle-panel" class="admin-panel" style="display:none;">
                            ${this.renderAiPuzzleAdminPanel()}
                        </div>
                        <div id="admin-dify-panel" class="admin-panel" style="display:none;">
                            ${this.renderDifyPanel()}
                        </div>

                        <!-- 活动 -->
                        <div id="admin-activity-panel" class="admin-panel" style="display:none;">
                            ${this.renderSpring2026Panel()}
                        </div>
                        <div id="admin-activity-team-stats-panel" class="admin-panel" style="display:none;">
                            ${this.renderActivityTeamStatsPanel()}
                        </div>

                        <!-- 成就 -->
                        <div id="admin-achv-skill-panel" class="admin-panel" style="display:none;">
                            ${this.renderAchvSkillPanel()}
                        </div>

                        <!-- 录题（维持现状） -->
                        <div id="admin-qms-draft-panel" class="admin-panel" style="display:none;">
                            ${this.renderQmsDraftPanel()}
                        </div>

                        <!-- 录 Puzzle 题 -->
                        <div id="admin-puzzle-record-panel" class="admin-panel" style="display:none;">
                            ${this.renderPuzzleRecordPanel()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 根据当前 domain/section 决定显示哪个 panel
        this.applyAdminLayoutVisibility();

        // 绑定事件
        this.bindEvents();
        
        // 按当前可见面板加载数据（避免无意义请求）
        this.loadAdminInitialData();
    }

    getAdminDomains() {
        return [
            { id: 'course', label: '课程', sections: [
                { id: 'daily', label: '每日一题', panelId: 'admin-clock-panel' },
                { id: 'livecourse', label: '直播课导入', panelId: 'admin-course-livecourse-panel' },
            ] },
            { id: 'library', label: '题库', sections: [
                { id: 'tag', label: '知识点', panelId: 'admin-tag-panel' },
                { id: 'acceptPerson', label: '通过人数回填', panelId: 'admin-library-accept-person-panel' },
                { id: 'trackerImport', label: '导入到 acm_problem_open', panelId: 'admin-library-tracker-import-panel' },
            ] },
            { id: 'battle', label: '对战', sections: [
                { id: 'pool', label: '题目池', panelId: 'admin-battle-panel' },
                { id: 'ops', label: '运维', panelId: 'admin-battle-ops-panel' },
            ] },
            { id: 'contest', label: '竞赛', sections: [
                { id: 'difficulty', label: '比赛管理', panelId: 'admin-contest-difficulty-panel' },
            ] },
            { id: 'data', label: '数据', sections: [
                { id: 'yearReport', label: '年度报告', panelId: 'admin-data-year-report-panel' },
                { id: 'redisDebug', label: 'Redis Debug', panelId: 'admin-data-redis-debug-panel' },
            ] },
            { id: 'ai', label: 'AI', sections: [
                { id: 'prompt', label: 'Prompt 挑战', panelId: 'admin-prompt-challenge-panel' },
                { id: 'puzzle', label: '约束解谜', panelId: 'admin-ai-puzzle-panel' },
                { id: 'dify', label: 'Dify', panelId: 'admin-dify-panel' },
            ] },
            { id: 'activity', label: '活动', sections: [
                { id: 'spring2026', label: '活动工具集', panelId: 'admin-activity-panel' },
                { id: 'teamStats', label: '团队活动', panelId: 'admin-activity-team-stats-panel' },
            ] },
            { id: 'achv', label: '成就', sections: [
                { id: 'skill', label: '补发技能树', panelId: 'admin-achv-skill-panel' },
            ] },
            { id: 'record', label: '录题', sections: [
                { id: 'qms', label: '录题', panelId: 'admin-qms-draft-panel' },
                { id: 'puzzle', label: '录 Puzzle 题', panelId: 'admin-puzzle-record-panel' },
            ] },
        ];
    }

    renderAdminDomainBar() {
        const domains = this.getAdminDomains();
        const btnStyle = (active) => `
            padding: 9px 14px;
            border-radius: 999px;
            border: 1px solid ${active ? '#1890ff' : '#ddd'};
            background: ${active ? '#e6f7ff' : '#fff'};
            color: ${active ? '#0958d9' : '#666'};
            cursor: pointer;
            font-size: 13px;
            font-weight: 800;
        `;
        return domains.map(d => `
            <button id="admin-domain-${d.id}" style="${btnStyle(d.id === this.adminDomain)}" type="button">${d.label}</button>
        `).join('');
    }

    renderAdminSideNav() {
        const domains = this.getAdminDomains();
        const d = domains.find(x => x.id === this.adminDomain) || domains[0];
        if (!d) return '';
        const itemStyle = (active) => `
            width: 100%;
            text-align: left;
            padding: 9px 10px;
            border-radius: 10px;
            border: 1px solid ${active ? '#bae0ff' : 'transparent'};
            background: ${active ? '#f0f7ff' : 'transparent'};
            color: ${active ? '#0958d9' : '#333'};
            cursor: pointer;
            font-size: 13px;
            font-weight: ${active ? 800 : 600};
        `;
        return `
            <div style="font-size: 12px; color:#999; margin-bottom: 8px;">${d.label}</div>
            <div style="display:flex; flex-direction:column; gap:6px;">
                ${d.sections.map(s => `
                    <button id="admin-section-${d.id}-${s.id}" style="${itemStyle(s.id === this.adminSection)}" type="button">${s.label}</button>
                `).join('')}
            </div>
        `;
    }

    applyAdminLayoutVisibility() {
        const domains = this.getAdminDomains();
        const d = domains.find(x => x.id === this.adminDomain) || domains[0];
        const s = d ? (d.sections.find(x => x.id === this.adminSection) || d.sections[0]) : null;
        const showPanelId = s ? s.panelId : '';
        for (const dd of domains) {
            for (const sec of dd.sections) {
                const el = document.getElementById(sec.panelId);
                if (el) el.style.display = (sec.panelId === showPanelId) ? 'block' : 'none';
            }
        }
    }

    loadAdminInitialData() {
        const domains = this.getAdminDomains();
        const d = domains.find(x => x.id === this.adminDomain) || domains[0];
        const s = d ? (d.sections.find(x => x.id === this.adminSection) || d.sections[0]) : null;
        const pid = s ? s.panelId : '';
        try {
            if (pid === 'admin-clock-panel') this.loadClockList();
            if (pid === 'admin-battle-panel') this.loadBattleList();
            if (pid === 'admin-tag-panel') this.loadTagList();
            if (pid === 'admin-prompt-challenge-panel') this.loadPromptChallengeList(false);
            if (pid === 'admin-ai-puzzle-panel') this.loadAiPuzzleAdminOverview();
        } catch (_) {}
    }

    bindDifyPanelEventsIfPresent() {
        const saveBtn = document.getElementById('admin-dify-save-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveDifyConfig());
    }

    bindQmsPanelEventsIfPresent() {
        // 一键录题
        const qmsOneBtn = document.getElementById('admin-qms-oneclick');
        if (qmsOneBtn) qmsOneBtn.addEventListener('click', () => this.adminQmsOneClick());

        // 录题 JSON 导入/清空
        const fileInput = document.getElementById('admin-qms-problem-json-file');
        const chooseBtn = document.getElementById('admin-qms-problem-json-choose');
        const clearBtn = document.getElementById('admin-qms-problem-json-clear');
        const msgEl = document.getElementById('admin-qms-problem-json-msg');
        const previewEl = document.getElementById('admin-qms-problem-json-preview');
        const refreshPayloadPreview = () => {};
        if (chooseBtn && fileInput) {
            chooseBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', async () => {
                const f = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
                if (!f) return;
                try {
                    const text = await f.text();
                    const obj = JSON.parse(text);
                    const title = obj?.basic?.title || obj?.title;
                    const content = obj?.statement?.content || obj?.content;
                    if (!title || !content) throw new Error('缺少必要字段：basic.title 与 statement.content（或 title/content）');
                    localStorage.setItem('tracker_qms_problem_json', JSON.stringify(obj));
                    if (msgEl) { msgEl.textContent = `✅ 已导入：${title}`; msgEl.style.color = '#52c41a'; }
                    if (previewEl) previewEl.textContent = JSON.stringify(obj, null, 2);
                    refreshPayloadPreview();
                } catch (e) {
                    const m = e && e.message ? e.message : '导入失败';
                    if (msgEl) { msgEl.textContent = `❌ 导入失败：${m}`; msgEl.style.color = '#ff4d4f'; }
                } finally {
                    fileInput.value = '';
                }
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                try { localStorage.removeItem('tracker_qms_problem_json'); } catch (_) {}
                if (msgEl) { msgEl.textContent = '已清空录题 JSON（回退到默认示例）'; msgEl.style.color = '#999'; }
                if (previewEl) previewEl.textContent = '（未导入）';
                refreshPayloadPreview();
            });
        }

        // source.zip 导入/清空
        const srcZipInput = document.getElementById('admin-qms-source-zip-file');
        const srcZipChooseBtn = document.getElementById('admin-qms-source-zip-choose');
        const srcZipClearBtn = document.getElementById('admin-qms-source-zip-clear');
        const srcZipMsgEl = document.getElementById('admin-qms-source-zip-msg');
        if (srcZipChooseBtn && srcZipInput) {
            srcZipChooseBtn.addEventListener('click', () => srcZipInput.click());
            srcZipInput.addEventListener('change', async () => {
                const f = srcZipInput.files && srcZipInput.files[0] ? srcZipInput.files[0] : null;
                if (!f) return;
                if (srcZipMsgEl) { srcZipMsgEl.textContent = `解析中：${f.name}...`; srcZipMsgEl.style.color = '#999'; }
                try {
                    const r = await this.adminQmsParseSourceZip(f);
                    const parts = [];
                    if (r.problemTitle) parts.push(`JSON：${r.problemTitle}`);
                    if (r.dataZipName) parts.push(`data.zip：${r.dataZipName}（${Math.round((r.dataZipSize || 0) / 1024)} KB）`);
                    if (r.checkerFileName) parts.push(`checker：${r.checkerFileName}（来自内层 zip 也可识别）`);
                    if (srcZipMsgEl) { srcZipMsgEl.textContent = `✅ source.zip 解析完成：` + (parts.join('；') || '（未找到有效内容）'); srcZipMsgEl.style.color = '#52c41a'; }
                    // 同步刷新 JSON 预览
                    try {
                        const imported2 = (() => {
                            try { return JSON.parse(localStorage.getItem('tracker_qms_problem_json') || ''); } catch (_) { return null; }
                        })();
                        if (previewEl) previewEl.textContent = imported2 ? JSON.stringify(imported2, null, 2) : '（未导入）';
                        if (msgEl && imported2) {
                            const title2 = imported2?.basic?.title || imported2?.title || '';
                            msgEl.textContent = title2 ? `✅ 已导入：${title2}` : '✅ 已导入 JSON';
                            msgEl.style.color = '#52c41a';
                        }
                        const zipMsgEl2 = document.getElementById('admin-qms-cases-zip-msg');
                        if (zipMsgEl2 && this._qmsZipFile) {
                            zipMsgEl2.textContent = `✅ 已选择 ZIP：${this._qmsZipFile.name}（${Math.round((this._qmsZipFile.size || 0) / 1024)} KB）（来自 source.zip）`;
                            zipMsgEl2.style.color = '#52c41a';
                        }
                    } catch (_) {}
                    refreshPayloadPreview();
                } catch (e) {
                    const m = e && e.message ? e.message : '解析失败';
                    if (srcZipMsgEl) { srcZipMsgEl.textContent = `❌ source.zip 解析失败：${m}`; srcZipMsgEl.style.color = '#ff4d4f'; }
                } finally {
                    srcZipInput.value = '';
                }
            });
        }
        if (srcZipClearBtn) {
            srcZipClearBtn.addEventListener('click', () => {
                this._qmsSourceZipFile = null;
                try { localStorage.removeItem('tracker_qms_problem_json'); } catch (_) {}
                this._qmsZipFile = null;
                if (srcZipMsgEl) { srcZipMsgEl.textContent = '已清空 source.zip'; srcZipMsgEl.style.color = '#999'; }
                if (msgEl) { msgEl.textContent = '已清空录题 JSON（回退到默认示例）'; msgEl.style.color = '#999'; }
                if (previewEl) previewEl.textContent = '（未导入）';
                const zipMsgEl2 = document.getElementById('admin-qms-cases-zip-msg');
                if (zipMsgEl2) { zipMsgEl2.textContent = '已清空 ZIP（将跳过用例上传）'; zipMsgEl2.style.color = '#999'; }
                refreshPayloadPreview();
            });
        }

        // 用例 ZIP 导入/清空（仅保存在内存里，不落 localStorage）
        const zipInput = document.getElementById('admin-qms-cases-zip-file');
        const zipChooseBtn = document.getElementById('admin-qms-cases-zip-choose');
        const zipClearBtn = document.getElementById('admin-qms-cases-zip-clear');
        const zipMsgEl = document.getElementById('admin-qms-cases-zip-msg');
        if (zipChooseBtn && zipInput) {
            zipChooseBtn.addEventListener('click', () => zipInput.click());
            zipInput.addEventListener('change', () => {
                const f = zipInput.files && zipInput.files[0] ? zipInput.files[0] : null;
                if (!f) return;
                this._qmsZipFile = f;
                if (zipMsgEl) { zipMsgEl.textContent = `✅ 已选择 ZIP：${f.name}（${Math.round((f.size || 0) / 1024)} KB）`; zipMsgEl.style.color = '#52c41a'; }
                zipInput.value = '';
            });
        }
        if (zipClearBtn) {
            zipClearBtn.addEventListener('click', () => {
                this._qmsZipFile = null;
                if (zipMsgEl) { zipMsgEl.textContent = '已清空 ZIP（将跳过用例上传）'; zipMsgEl.style.color = '#999'; }
            });
        }
    }

    renderQmsDraftPanel() {
        const host = (() => {
            try { return (typeof window !== 'undefined' && window.location) ? window.location.hostname : ''; } catch (_) { return ''; }
        })();
        // 本地：走 /__qb/ 在同源下登录（cookie 写到当前域，配合 /__qms/ 直调接口）
        // 线上：www 直接打开 questionbank
        const qbLink = (host === 'www.nowcoder.com') ? 'https://questionbank.nowcoder.com/' : '/__qb/';
        // 录题包 JSON：优先使用管理员导入的 JSON；未导入时使用示例模板
        const imported = (() => {
            try { return JSON.parse(localStorage.getItem('tracker_qms_problem_json') || ''); } catch (_) { return null; }
        })();
        const payloadAdd = this.buildQmsDraftAddPayload(imported);
        const pretty = JSON.stringify(payloadAdd, null, 2);
        const importedHint = imported ? `已导入录题 JSON：${(imported?.basic?.title || imported?.title || '')}` : '尚未导入录题 JSON：将使用默认示例';
        const lastQid = (() => {
            try { return localStorage.getItem('tracker_qms_last_qid') || ''; } catch (_) { return ''; }
        })();
        const savedHeaders = (() => {
            try { return localStorage.getItem('admin_qms_draft_headers') || ''; } catch (_) { return ''; }
        })();
        const zipName = (this._qmsZipFile && this._qmsZipFile.name) ? this._qmsZipFile.name : '';
        const sourceZipName = (this._qmsSourceZipFile && this._qmsSourceZipFile.name) ? this._qmsSourceZipFile.name : '';
        return `
            <div style="background:#fff; border:1px solid #e8e8e8; border-radius: 12px; padding: 16px;">
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div style="font-size: 16px; font-weight: 800; color:#333;">QMS 模拟录题接口测试</div>
                    <div style="font-size: 12px; color:#999;">（仅管理员可见）</div>
                    <div style="flex:1;"></div>
                    <a id="admin-qms-open" class="admin-btn modal-secondary" style="padding: 9px 14px; text-decoration:none;" href="${qbLink}" target="_blank" rel="noopener noreferrer">打开 questionbank</a>
                    <button id="admin-qms-oneclick" class="admin-btn" style="padding: 9px 14px; font-weight:900; background:#52c41a; color:#fff;" type="button">一键录题</button>
                </div>

                <div style="margin-top: 10px; font-size: 13px; color:#666; line-height: 1.65;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST https://questionbank.nowcoder.com/qms/question/draft/add</code><br/>
                    使用前提：<b>同一浏览器</b>已登录 <b>questionbank</b>（与 www 不是同一套 cookie）。<br/>
                    本地建议：先点“打开 questionbank”在当前域完成登录（走 <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">/__qb/</code>），再回到这里点“发送请求”。<br/>
                    说明：Tracker（部署在 www）直连会尝试携带 questionbank 的 <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">cookie</code>（<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">credentials: include</code>），但能否<strong>读到返回值/qid</strong>还取决于：<br/>
                    - questionbank 是否对 www 放行 <b>CORS + credentials</b><br/>
                    - 浏览器是否允许第三方 Cookie（若提示 <b>Failed to fetch</b>，常见原因是 CORS 或第三方 Cookie 被拦）
                </div>

                <div style="margin-top: 12px; padding: 12px; border:1px solid #f0f0f0; border-radius: 12px; background: linear-gradient(180deg,#fbfdff,#ffffff);">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <div style="font-size: 13px; font-weight: 800; color:#111827;">一键录题输入（录题包 JSON）</div>
                        <div style="font-size: 12px; color:#999;">${importedHint}</div>
                        <div style="flex:1;"></div>
                        <input id="admin-qms-problem-json-file" type="file" accept=".json,application/json" style="display:none;" />
                        <button id="admin-qms-problem-json-choose" class="admin-btn modal-secondary" style="padding: 7px 10px;" type="button">选择 JSON</button>
                        <button id="admin-qms-problem-json-clear" class="admin-btn modal-secondary" style="padding: 7px 10px;" type="button">清空 JSON</button>
                    </div>
                    <div id="admin-qms-problem-json-msg" style="margin-top: 8px; font-size: 12px; color:#666;"></div>
                    <pre id="admin-qms-problem-json-preview" style="margin-top: 8px; margin-bottom:0; background:#0b1020; color:#e6edf3; padding: 10px 12px; border-radius: 10px; overflow:auto; max-height: 220px;">${imported ? JSON.stringify(imported, null, 2) : '（未导入）'}</pre>
                </div>

                <div style="margin-top: 12px; padding: 12px; border:1px solid #f0f0f0; border-radius: 12px; background: linear-gradient(180deg,#fbfdff,#ffffff);">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <div style="font-size: 13px; font-weight: 800; color:#111827;">一键录题包（source.zip）</div>
                        <div style="font-size: 12px; color:#999;">结构：source.zip 内含 <b>problem.json</b> + <b>data.zip</b>（用例）</div>
                        <div style="flex:1;"></div>
                        <input id="admin-qms-source-zip-file" type="file" accept=".zip,application/zip" style="display:none;" />
                        <button id="admin-qms-source-zip-choose" class="admin-btn modal-secondary" style="padding: 7px 10px;" type="button">选择 source.zip</button>
                        <button id="admin-qms-source-zip-clear" class="admin-btn modal-secondary" style="padding: 7px 10px;" type="button">清空 source.zip</button>
                    </div>
                    <div id="admin-qms-source-zip-msg" style="margin-top: 8px; font-size: 12px; color:#666;">${sourceZipName ? `已选择：${sourceZipName}` : ''}</div>
                </div>

                <div style="margin-top: 12px; padding: 12px; border:1px solid #f0f0f0; border-radius: 12px; background: linear-gradient(180deg,#fbfdff,#ffffff);">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <div style="font-size: 13px; font-weight: 800; color:#111827;">可选：用例压缩包（cases.zip）</div>
                        <div style="font-size: 12px; color:#999;">${zipName ? `已选择：${zipName}` : '未选择：将跳过用例上传'}</div>
                        <div style="flex:1;"></div>
                        <input id="admin-qms-cases-zip-file" type="file" accept=".zip,application/zip" style="display:none;" />
                        <button id="admin-qms-cases-zip-choose" class="admin-btn modal-secondary" style="padding: 7px 10px;" type="button">选择 ZIP</button>
                        <button id="admin-qms-cases-zip-clear" class="admin-btn modal-secondary" style="padding: 7px 10px;" type="button">清空 ZIP</button>
                    </div>
                    <div id="admin-qms-cases-zip-msg" style="margin-top: 8px; font-size: 12px; color:#666;"></div>
                </div>

                <div id="admin-qms-draft-error" style="margin-top: 10px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div id="admin-qms-draft-qid2" style="margin-top: 6px; font-size: 12px; color:#666;">
                    当前缓存 qid：<b>${lastQid ? lastQid : '（无）'}</b>
                </div>
                <div style="margin-top: 10px; font-size: 12px; color:#666;">
                    可选：如果仍提示“客户端验证错误”，可以从题库页面 Network 里复制 <b>Request Headers</b>（Raw 文本或 JSON 都可）粘到下面。<br/>
                    小技巧：只要成功一次，我们会把你填的 headers <b>自动保存</b>（localStorage）。之后即使输入框清空，也会自动使用已保存的内容。
                </div>
                <textarea id="admin-qms-draft-headers" rows="6" placeholder='支持两种格式：&#10;1) JSON：{"x-csrf-token":"...","x-client-verify":"..."}&#10;2) Raw：x-csrf-token: ...&#10;   x-client-verify: ...'
                          style="width:100%; margin-top:6px; padding: 10px; border:1px solid #ddd; border-radius: 10px; font-size: 12px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;"></textarea>
                <div style="margin-top: 6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div id="admin-qms-draft-headers-hint" style="font-size: 12px; color:#999;">
                        ${savedHeaders ? '已检测到本地保存的 headers：留空也可以直接发送。' : '尚未保存 headers：如遇“客户端验证错误”，请粘贴一次成功请求的 headers。'}
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-qms-draft-headers-clear" class="admin-btn modal-secondary" style="padding: 7px 10px;" type="button">清除已保存</button>
                </div>

                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 700; margin-bottom: 6px;">进度</div>
                    <pre id="admin-qms-draft-result" style="margin:0; background:#111827; color:#f9fafb; padding: 12px; border-radius: 10px; overflow:auto; max-height: 260px;">（等待开始）</pre>
                </div>
            </div>
        `;
    }

    /**
     * 题库：批量将 Tracker 题目导入到 acm_problem_open（从旧 import panel 拆出来）
     */
    renderAcmProblemOpenBatchImportPanel() {
        const savedTagId = localStorage.getItem('tracker_import_source_tag_id') || '';
        const savedBatchSize = localStorage.getItem('tracker_import_batch_size') || '';
        const savedDryRun = localStorage.getItem('tracker_import_dry_run') || 'false';

        return `
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    导入到 acm_problem_open
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    管理员只需要每行一个 <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">problemId</code>。<br>
                    后端接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/acm-problem-open/batch-import-tracker</code>
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
     * 数据：年度报告验数（仅保留年报本体；清理镜像/活动工具已拆出）
     */
    renderYearReportPanel() {
        const savedUid = localStorage.getItem('admin_year_report_uid') || '';
        const savedYear = localStorage.getItem('admin_year_report_year') || '0';
        const savedTrackerOnly = localStorage.getItem('admin_year_report_tracker_only') || 'true';
        // 注入样式（复用旧逻辑）
        try { this.injectVisualStyles(); } catch (_) {}

        return `
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    年度报告（验数）
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
                <div id="admin-year-report-visuals" class="report-visuals-container" style="display:none;"></div>

                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回 JSON</div>
                    <pre id="admin-year-report-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 420px;">（尚未拉取）</pre>
                </div>
            </div>
        `;
    }

    /**
     * 数据：Redis Debug（管理员调试工具）
     */
    renderRedisDebugPanel() {
        const get = (k, defVal) => {
            try {
                const v = localStorage.getItem(k);
                return (v == null || v === '') ? String(defVal) : String(v);
            } catch (_) {
                return String(defVal);
            }
        };
        const getBool = (k, defVal) => {
            try {
                const v = localStorage.getItem(k);
                if (v == null || v === '') return !!defVal;
                return String(v) === 'true';
            } catch (_) {
                return !!defVal;
            }
        };

        const key = get('admin_redis_debug_key', '');
        const type = get('admin_redis_debug_type', 'auto');
        const start = get('admin_redis_debug_start', '0');
        const limit = get('admin_redis_debug_limit', '50');
        const asc = getBool('admin_redis_debug_asc', false);
        const field = get('admin_redis_debug_field', '');
        const member = get('admin_redis_debug_member', '');

        return `
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px;">
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div style="font-size: 16px; font-weight: 800; color:#333;">Redis Debug（查 key）</div>
                    <div style="font-size: 12px; color:#999;">仅 Tracker 管理员可用</div>
                </div>
                <div style="font-size: 13px; color: #666; margin-top: 8px; margin-bottom: 12px; line-height: 1.7;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">GET /problem/tracker/admin/redis/debug</code><br>
                    支持：string/hash/set/zset/list（type=auto 会按 Redis 实际类型读取）。limit 最大 200。
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">key:</label>
                        <input id="admin-redis-debug-key" type="text" value="${this.escapeHtmlAttr(key)}" placeholder="必填，例如 sparta:xxx"
                               style="width: 360px; max-width: 68vw; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">type:</label>
                        <select id="admin-redis-debug-type" style="padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                            ${['auto','string','hash','set','zset','list'].map(t => `<option value="${t}" ${String(type) === t ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">start:</label>
                        <input id="admin-redis-debug-start" type="number" min="0" value="${this.escapeHtmlAttr(start)}"
                               style="width: 110px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">limit:</label>
                        <input id="admin-redis-debug-limit" type="number" min="1" max="200" value="${this.escapeHtmlAttr(limit)}"
                               style="width: 110px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">asc:</label>
                        <input id="admin-redis-debug-asc" type="checkbox" ${asc ? 'checked' : ''} />
                        <span style="font-size: 12px; color:#999;">仅 zset 有效</span>
                    </div>
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">field:</label>
                        <input id="admin-redis-debug-field" type="text" value="${this.escapeHtmlAttr(field)}" placeholder="hash 可选：指定 field"
                               style="width: 240px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">member:</label>
                        <input id="admin-redis-debug-member" type="text" value="${this.escapeHtmlAttr(member)}" placeholder="zset 可选：查 zscore(member)"
                               style="width: 240px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-redis-debug-fetch-btn" style="background:#1890ff; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        查询
                    </button>
                    <button id="admin-redis-debug-copy-btn" style="background:#722ed1; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        复制 JSON
                    </button>
                </div>

                <div id="admin-redis-debug-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>

                <div id="admin-redis-debug-meta" style="margin-top: 10px; font-size: 12px; color:#666; display:none;"></div>
                <div id="admin-redis-debug-value" style="margin-top: 10px; font-size: 13px; color:#333; display:none;"></div>

                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 700; margin-bottom: 6px;">返回 JSON</div>
                    <pre id="admin-redis-debug-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 420px;">（尚未查询）</pre>
                </div>
            </div>
        `;
    }

    escapeHtmlAttr(s) {
        // 轻量转义，避免把输入打断到 attribute 里
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _renderRedisDebugValueBlock(data) {
        const d = data || {};
        const t = String(d.effectiveType || d.redisType || d.requestedType || '').toLowerCase();
        const v = d.value;
        const titleStyle = 'font-weight:800; margin-bottom:6px;';
        const preStyle = 'margin:0; background:#fafafa; border:1px solid #f0f0f0; padding: 10px; border-radius: 8px; overflow:auto; max-height: 260px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; line-height: 1.55;';

        const renderJsonPre = (obj) => `<pre style="${preStyle}">${this.escapeHtmlAttr(JSON.stringify(obj, null, 2))}</pre>`;

        if (t === 'string') {
            return `<div style="${titleStyle}">value（string）</div>${renderJsonPre(v)}`;
        }
        if (t === 'hash') {
            return `<div style="${titleStyle}">value（hash）</div>${renderJsonPre(v)}`;
        }
        if (t === 'set') {
            return `<div style="${titleStyle}">value（set）</div>${renderJsonPre(v)}`;
        }
        if (t === 'zset') {
            const extra = (d.member && d.zscore != null) ? `<div style="margin:6px 0 0; font-size:12px; color:#666;">zscore(${this.escapeHtmlAttr(d.member)}) = <b>${this.escapeHtmlAttr(d.zscore)}</b></div>` : '';
            return `<div style="${titleStyle}">value（zset）</div>${renderJsonPre(v)}${extra}`;
        }
        if (t === 'list') {
            return `<div style="${titleStyle}">value（list）</div>${renderJsonPre(v)}`;
        }
        // unknown / none
        return `<div style="${titleStyle}">value</div>${renderJsonPre(v)}`;
    }

    /**
     * 数据：过题排行榜批量重建（Top N）
     * 兜底方案：先拉取前 N 名用户，再逐个触发 update-accept-count 刷新计数与榜单缓存
     */
    renderAcceptRankRebuildPanel() {
        const get = (k, defVal) => {
            try {
                const v = localStorage.getItem(k);
                return (v == null || v === '') ? String(defVal) : String(v);
            } catch (_) {
                return String(defVal);
            }
        };
        const getBool = (k, defVal) => {
            try {
                const v = localStorage.getItem(k);
                if (v == null || v === '') return !!defVal;
                return String(v) === 'true';
            } catch (_) {
                return !!defVal;
            }
        };
        const topN = get('admin_accept_rank_rebuild_top_n', 1000);
        const pageSize = get('admin_accept_rank_rebuild_page_size', 200);
        const batchSize = get('admin_accept_rank_rebuild_batch_size', 20);
        const sleepMs = get('admin_accept_rank_rebuild_sleep_ms', 80);
        const dryRun = getBool('admin_accept_rank_rebuild_dry_run', false);

        return `
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    过题排行榜：批量重建（Top N）
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    先拉取：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">GET /problem/tracker/ranks/problem</code>（前 N 名）<br>
                    再逐个调用：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/rank/update-accept-count</code>（刷新用户过题数/榜单缓存）
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom: 12px; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">TopN:</label>
                        <input id="admin-accept-rank-rebuild-top-n" type="number" min="1" max="10000" value="${topN}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">pageSize:</label>
                        <input id="admin-accept-rank-rebuild-page-size" type="number" min="1" max="500" value="${pageSize}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">batchSize:</label>
                        <input id="admin-accept-rank-rebuild-batch-size" type="number" min="1" max="50" value="${batchSize}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">sleepMs:</label>
                        <input id="admin-accept-rank-rebuild-sleep-ms" type="number" min="0" max="3000" value="${sleepMs}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">dryRun:</label>
                        <input id="admin-accept-rank-rebuild-dry-run" type="checkbox" ${dryRun ? 'checked' : ''} />
                        <span style="font-size: 12px; color:#999;">只拉榜单/列 UID，不发更新请求</span>
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-accept-rank-rebuild-run-btn"
                            style="background:#fa541c; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px; font-weight: 700;">
                        开始执行
                    </button>
                    <button id="admin-accept-rank-rebuild-stop-btn"
                            style="display:none;background:#ff4d4f; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px; font-weight: 700;">
                        停止
                    </button>
                </div>

                <div id="admin-accept-rank-rebuild-error" style="margin-top: 10px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">执行日志</div>
                    <pre id="admin-accept-rank-rebuild-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 360px;">（尚未执行）</pre>
                </div>
            </div>
        `;
    }

    /**
     * 数据：批量重建用户成就（徽章补发）
     * POST /problem/tracker/badge/backfill
     */
    renderBadgeBackfillPanel() {
        const get = (k, defVal) => {
            try {
                const v = localStorage.getItem(k);
                return (v == null || v === '') ? String(defVal) : String(v);
            } catch (_) {
                return String(defVal);
            }
        };
        const getBool = (k, defVal) => {
            try {
                const v = localStorage.getItem(k);
                if (v == null || v === '') return !!defVal;
                return String(v) === 'true';
            } catch (_) {
                return !!defVal;
            }
        };
        const userId = get('admin_badge_backfill_user_id', 0);
        const offset = get('admin_badge_backfill_offset', 0);
        const limit = get('admin_badge_backfill_limit', 200);
        const dryRun = getBool('admin_badge_backfill_dry_run', true);
        const includeAccept = getBool('admin_badge_backfill_include_accept', true);

        return `
            <div style="background:#fff; border: 1px solid #e8e8e8; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <div style="font-size: 16px; font-weight: 800; color:#333;">批量重建用户成就（徽章补发）</div>
                    <div style="font-size: 12px; color:#999;">
                        接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/badge/backfill</code>
                    </div>
                </div>
                <div style="font-size: 13px; color:#666; margin-top: 8px; line-height: 1.6;">
                    处理范围：仅扫描 <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">tracker_badge_record</code> 出现过的用户（DISTINCT user_id 分页），避免扫全站。<br/>
                    题数来源：Redis <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">trackerRankboard</code>（key=<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">sparta:question:tracker</code>，score=过题数）。<br/>
                    技能树补发：已关闭（前端强制 includeSkillTree=false）。
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top: 12px; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">userId:</label>
                        <input id="admin-badge-backfill-user-id" type="number" min="0" value="${userId}"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                        <span style="font-size: 12px; color:#999;">0=批量；>0=单用户</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">offset:</label>
                        <input id="admin-badge-backfill-offset" type="number" min="0" value="${offset}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">limit:</label>
                        <input id="admin-badge-backfill-limit" type="number" min="1" max="1000" value="${limit}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">dryRun:</label>
                        <input id="admin-badge-backfill-dry-run" type="checkbox" ${dryRun ? 'checked' : ''} />
                        <span style="font-size: 12px; color:#999;">建议先勾选预演</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">includeAccept:</label>
                        <input id="admin-badge-backfill-include-accept" type="checkbox" ${includeAccept ? 'checked' : ''} />
                        <span style="font-size: 12px; color:#999;">补发累计过题成就</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">includeSkillTree:</label>
                        <input type="checkbox" checked disabled />
                        <span style="font-size: 12px; color:#999;">已在后端关闭（强制 false）</span>
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-badge-backfill-run-btn" style="background:#fa541c; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px; font-weight: 800;">
                        开始执行
                    </button>
                    <button id="admin-badge-backfill-stop-btn" style="display:none;background:#ff4d4f; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px; font-weight: 800;">
                        停止
                    </button>
                </div>

                <div id="admin-badge-backfill-error" style="margin-top: 10px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 700; margin-bottom: 6px;">执行日志</div>
                    <pre id="admin-badge-backfill-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 10px; overflow:auto; max-height: 360px;">（尚未执行）</pre>
                </div>
            </div>
        `;
    }

    /**
     * 对战：运维工具集合（目前仅“清理镜像”）
     */
    renderBattleOpsPanel() {
        const savedClearMirrorUid = localStorage.getItem('admin_clear_user_mirrors_uid') || '';
        return `
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    清理用户镜像（Redis）
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

            <div style="background:#fff; border: 1px solid #e8e8e8; border-radius: 12px; padding: 16px; margin-top: 16px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <div style="font-size: 16px; font-weight: 800; color:#333;">重建对战题 matchCount</div>
                    <div style="font-size: 12px; color:#999;">接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/battle/problem/admin/rebuild-match-count</code></div>
                    <div style="flex:1;"></div>
                    <button id="admin-battle-rebuild-matchcount-btn" style="background:#fa541c; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px; font-weight: 800;">
                        开始重建
                    </button>
                </div>
                <div style="margin-top: 10px; font-size: 13px; color:#666; line-height: 1.7;">
                    说明：对<b>所有</b>已纳入对战的题目，按后端口径重建并回填 <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">matchCount</code>。<br/>
                    建议：低峰期执行；执行前确保你有 Tracker 管理员权限（<code>TrackerAdminUtil.isTrackerAdmin</code>）。
                </div>
                <div id="admin-battle-rebuild-matchcount-error" style="margin-top: 10px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 700; margin-bottom: 6px;">执行结果</div>
                    <pre id="admin-battle-rebuild-matchcount-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 10px; overflow:auto; max-height: 280px;">（尚未执行）</pre>
                </div>
            </div>
        `;
    }

    /**
     * 活动：春季AI体验站增加抽奖次数（管理员测试工具）
     */
    renderSpring2026Panel() {
        const savedSpring2026Uid = localStorage.getItem('admin_spring2026_ai_uid') || '';
        const savedSpring2026Delta = localStorage.getItem('admin_spring2026_ai_delta') || '1';
        const savedSpring2026Uuid = localStorage.getItem('admin_spring2026_ai_uuid') || 'spring2026_ai_station';
        const savedRecActivityId = localStorage.getItem('admin_spring2026_ai_records_activity_id') || '465576048';
        const savedRecOffset = localStorage.getItem('admin_spring2026_ai_records_offset') || '0';
        const savedRecLimit = localStorage.getItem('admin_spring2026_ai_records_limit') || '50';
        const savedFortuneClearUid = localStorage.getItem('admin_spring2026_fortune_clear_uid') || '';
        const savedThirdShareClaimedClearUid = localStorage.getItem('admin_spring2026_third_share_claimed_clear_uid') || savedSpring2026Uid || '';
        return `
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    第三期大转盘增加抽奖次数（测试）
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/admin/spring2026-third/chances/add?uid=xxx&delta=1</code><br>
                    说明：仅用于测试抽奖链路（不影响抽奖平台自身的“剩余次数”逻辑）。
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">uid:</label>
                        <input id="admin-spring2026-third-chances-uid" type="number" value="${savedSpring2026Uid}" placeholder="必填"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">delta:</label>
                        <input id="admin-spring2026-third-chances-delta" type="number" min="1" max="1000" value="${savedSpring2026Delta}" placeholder="默认1（1-1000）"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-spring2026-third-chances-add-btn" style="background:#1890ff; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        增加次数
                    </button>
                </div>

                <div id="admin-spring2026-third-chances-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回 JSON</div>
                    <pre id="admin-spring2026-third-chances-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 260px;">（尚未执行）</pre>
                </div>
            </div>

            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    第三期「分享活动页面」领取标记清除（测试）
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/admin/spring2026-third/task/share/claimed/clear?uid=xxx</code><br>
                    说明：只删除“已领取标记”，<b>不会</b>回滚用户抽奖次数；用于重复测试分享功能。
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">uid:</label>
                        <input id="admin-spring2026-third-share-claimed-clear-uid" type="number" value="${this.escapeHtmlAttr(savedThirdShareClaimedClearUid)}" placeholder="必填"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-spring2026-third-share-claimed-clear-btn" style="background:#ff4d4f; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        清除领取标记
                    </button>
                </div>

                <div id="admin-spring2026-third-share-claimed-clear-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回 JSON</div>
                    <pre id="admin-spring2026-third-share-claimed-clear-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 260px;">（尚未执行）</pre>
                </div>
            </div>

            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    春季AI体验站增加抽奖次数（测试）
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/admin/spring2026-ai/chances/add?uid=xxx&delta=1&uuid=spring2026_ai_station</code><br>
                    说明：仅用于测试抽奖链路（不影响抽奖平台自身的“剩余次数”逻辑）。
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">uid:</label>
                        <input id="admin-spring2026-ai-chances-uid" type="number" value="${savedSpring2026Uid}" placeholder="必填"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">delta:</label>
                        <input id="admin-spring2026-ai-chances-delta" type="number" min="1" max="1000" value="${savedSpring2026Delta}" placeholder="默认1（1-1000）"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">uuid:</label>
                        <input id="admin-spring2026-ai-chances-uuid" type="text" value="${savedSpring2026Uuid}" placeholder="spring2026_ai_station"
                               style="width: 240px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-spring2026-ai-chances-add-btn" style="background:#1890ff; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        增加次数
                    </button>
                </div>

                <div id="admin-spring2026-ai-chances-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回 JSON</div>
                    <pre id="admin-spring2026-ai-chances-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 260px;">（尚未执行）</pre>
                </div>
            </div>

            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px; margin-top: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    春季AI体验站抽奖记录查询（验数）
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">GET /problem/tracker/admin/spring2026-ai/lottery/records</code><br>
                    返回：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">award_name</code> / <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">time</code> / <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">user_id</code>；当 <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">award_name</code> 为空时表示“谢谢惠顾”。
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">uid:</label>
                        <input id="admin-spring2026-ai-records-uid" type="number" value="${savedSpring2026Uid}" placeholder="必填"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">activityId:</label>
                        <input id="admin-spring2026-ai-records-activity-id" type="number" value="${this.escapeHtmlAttr(savedRecActivityId)}" placeholder="默认 465576048"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">offset:</label>
                        <input id="admin-spring2026-ai-records-offset" type="number" min="0" value="${this.escapeHtmlAttr(savedRecOffset)}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">limit:</label>
                        <input id="admin-spring2026-ai-records-limit" type="number" min="1" max="200" value="${this.escapeHtmlAttr(savedRecLimit)}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-spring2026-ai-records-fetch-btn" style="background:#1890ff; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        查询记录
                    </button>
                </div>

                <div id="admin-spring2026-ai-records-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>

                <div id="admin-spring2026-ai-records-table" style="margin-top: 10px; display:none;"></div>

                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回 JSON</div>
                    <pre id="admin-spring2026-ai-records-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 320px;">（尚未查询）</pre>
                </div>
            </div>

            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px; margin-top: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    发展说明书 Redis 清空
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/admin/spring2026-fortune/redis/clear?uid=xxx</code><br>
                    说明：清空该用户测运 Redis，使其可重新生成发展说明书。
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">uid:</label>
                        <input id="admin-clear-spring2026-fortune-redis-uid" type="number" value="${savedFortuneClearUid}" placeholder="必填"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-clear-spring2026-fortune-redis-btn" style="background:#ff4d4f; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        清空 Redis
                    </button>
                </div>

                <div id="admin-clear-spring2026-fortune-redis-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回 JSON</div>
                    <pre id="admin-clear-spring2026-fortune-redis-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 260px;">（尚未执行）</pre>
                </div>

                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px dashed #e8e8e8;">
                    <div style="font-size: 14px; font-weight: 600; color:#333; margin-bottom: 8px;">批量清空</div>
                    <div style="font-size: 12px; color:#666; margin-bottom: 8px;">多个 uid 用数字或空格、逗号、换行分隔</div>
                    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-start;">
                        <textarea id="admin-batch-clear-spring2026-fortune-redis-uids" placeholder="例如：919247 123456 789012"
                                  style="width:320px; min-height:80px; padding:8px 10px; border:1px solid #ddd; border-radius:6px; font-size:13px; resize:vertical;"></textarea>
                        <button id="admin-batch-clear-spring2026-fortune-redis-btn" style="background:#ff4d4f; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                            批量清空 Redis
                        </button>
                    </div>
                    <div id="admin-batch-clear-spring2026-fortune-redis-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                    <div style="margin-top: 12px;">
                        <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回 JSON（批量）</div>
                        <pre id="admin-batch-clear-spring2026-fortune-redis-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 320px;">（尚未执行）</pre>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 活动：团队活动（批量统计）
     */
    renderActivityTeamStatsPanel() {
        const savedTeamStatsIds = localStorage.getItem('admin_team_stats_ids') || '';
        const savedTeamStatsBegin = localStorage.getItem('admin_team_stats_begin') || '2025-11-01';
        const savedTeamStatsEnd = localStorage.getItem('admin_team_stats_end') || '2026-03-01';

        return `
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    批量统计团队活动最终数据（严格实时）
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /tracker/activity/teams/statistics</code><br>
                    说明：用于活动结束后，针对一批特定团队，实时计算其最终的活动各项指标（打卡、题单制霸、技能树制霸、最终积分），不走缓存，保证数据绝对准确。
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display:block; font-size: 13px; color:#666; margin-bottom: 6px;">teamIds (逗号分隔):</label>
                    <textarea id="admin-team-stats-ids" placeholder="例如：101,102,103"
                              style="width: 100%; min-height: 60px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px; resize:vertical;">${savedTeamStatsIds}</textarea>
                </div>
                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">beginDate:</label>
                        <input id="admin-team-stats-begin" type="text" value="${savedTeamStatsBegin}" placeholder="yyyy-MM-dd"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">endDate:</label>
                        <input id="admin-team-stats-end" type="text" value="${savedTeamStatsEnd}" placeholder="yyyy-MM-dd"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-team-stats-btn" style="background:#1890ff; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        开始统计
                    </button>
                </div>
                <div id="admin-team-stats-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div style="margin-top: 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                        <div style="font-size: 13px; color:#333; font-weight: 600;">统计结果 JSON</div>
                        <button id="admin-team-stats-copy-btn" style="background:none; border:none; color:#1890ff; font-size:12px; cursor:pointer; padding:2px 5px;">
                            📋 复制 JSON
                        </button>
                    </div>
                    <pre id="admin-team-stats-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 400px;">（尚未执行）</pre>
                </div>
            </div>
        `;
    }

    /**
     * 成就：补发技能树
     */
    renderAchvSkillPanel() {
        const savedRefreshChapterUid = localStorage.getItem('admin_refresh_chapter_uid') || '';
        const savedRefreshChapterKey = localStorage.getItem('admin_refresh_chapter_key') || 'chapter1';

        return `
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    刷新用户技能树进度（含成就补发）
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /tracker/skill-tree/refresh-user-chapter-progress</code><br>
                    说明：用于管理员手动触发指定用户的技能树章节进度重算，并检查是否满足成就条件（可用于修复“进度100%但未发成就”的问题）。
                </div>
                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">userId:</label>
                        <input id="admin-refresh-chapter-uid" type="number" value="${savedRefreshChapterUid}" placeholder="用户ID"
                               style="width: 140px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">chapterKey:</label>
                        <select id="admin-refresh-chapter-key" style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                            <option value="chapter1" ${savedRefreshChapterKey === 'chapter1' ? 'selected' : ''}>第一章 (chapter1)</option>
                            <option value="interlude_dawn" ${savedRefreshChapterKey === 'interlude_dawn' ? 'selected' : ''}>间章 (interlude_dawn)</option>
                            <option value="chapter2" ${savedRefreshChapterKey === 'chapter2' ? 'selected' : ''}>第二章 (chapter2)</option>
                        </select>
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-refresh-chapter-btn" style="background:#1890ff; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        刷新进度 & 检查成就
                    </button>
                </div>
                <div id="admin-refresh-chapter-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回结果</div>
                    <pre id="admin-refresh-chapter-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 260px;">（尚未执行）</pre>
                </div>
            </div>
        `;
    }

    renderDifyPanel() {
        const config = (() => {
            try { return JSON.parse(localStorage.getItem('tracker_dify_config') || '{}'); } catch (_) { return {}; }
        })();
        const url = config.url || '';
        const enabled = config.enabled || false;

        return `
            <div style="background:#fff; border:1px solid #e8e8e8; border-radius: 12px; padding: 16px;">
                <div style="font-size: 16px; font-weight: 800; color:#333; margin-bottom: 8px;">Dify 助手配置</div>
                <div style="font-size: 13px; color:#666; margin-bottom: 16px; line-height: 1.6;">
                    在这里配置 Dify Chatbot 的嵌入链接。配置后，将在主导航栏显示“AI 助手”入口。<br>
                    嵌入代码示例：<code>http://dify.nowcoder.com/chatbot/oe5JwJTQVFiwYvn6</code><br>
                    <span style="color:#ff9c6e;">⚠️ 注意：如果 Tracker 使用 HTTPS 访问，建议配置 <b>https://</b> 开头的链接，否则可能会被浏览器拦截导致白屏。</span>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display:block; font-size: 13px; font-weight: 600; margin-bottom: 6px;">Chatbot URL</label>
                    <input id="admin-dify-url" type="text" value="${url}" placeholder="请输入 Dify Chatbot URL"
                           style="width: 100%; max-width: 600px; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;">
                </div>

                <div style="margin-bottom: 20px; display:flex; align-items:center; gap: 8px;">
                    <input id="admin-dify-enabled" type="checkbox" ${enabled ? 'checked' : ''} style="width: 16px; height: 16px;">
                    <label for="admin-dify-enabled" style="font-size: 14px; cursor: pointer;">启用 AI 助手页签</label>
                </div>

                <button id="admin-dify-save-btn" class="admin-btn" style="padding: 10px 24px; font-weight:700;">保存配置</button>
                <span id="admin-dify-msg" style="margin-left: 12px; font-size: 13px;"></span>
            </div>
        `;
    }

    saveDifyConfig() {
        const urlInput = document.getElementById('admin-dify-url');
        const enabledInput = document.getElementById('admin-dify-enabled');
        const msgEl = document.getElementById('admin-dify-msg');
        
        if (!urlInput || !enabledInput) return;

        const config = {
            url: urlInput.value.trim(),
            enabled: enabledInput.checked
        };

        localStorage.setItem('tracker_dify_config', JSON.stringify(config));
        
        if (msgEl) {
            msgEl.textContent = '✅ 保存成功';
            msgEl.style.color = '#52c41a';
            setTimeout(() => { msgEl.textContent = ''; }, 3000);
        }
        
        // 尝试即时更新全局导航栏
        if (window.app && typeof window.app.updateDifyTabVisibility === 'function') {
            window.app.updateDifyTabVisibility();
        }
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

    renderAiPuzzleAdminPanel() {
        return `
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="background:#fff; border:1px solid #e8e8e8; border-radius: 12px; padding: 16px;">
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <div style="font-size: 16px; font-weight: 800; color:#333;">AI 约束型解谜后台概览</div>
                        <div style="font-size: 12px; color:#999;">查看题目协议、文件型存储表结构、最近提交与榜单物化快照。</div>
                        <div style="flex:1;"></div>
                        <button id="admin-ai-puzzle-refresh-btn" class="admin-btn modal-secondary" type="button">刷新</button>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; align-items:start;">
                    <div style="background:#fff; border:1px solid #e8e8e8; border-radius: 12px; padding: 16px;">
                        <div style="font-size: 14px; font-weight: 800; color:#111827;">运行统计</div>
                        <div id="admin-ai-puzzle-stats-cards" style="margin-top:12px; color:#999;">加载中...</div>
                        <div style="margin-top: 14px; font-size: 13px; color:#333; font-weight: 700;">最近提交</div>
                        <div id="admin-ai-puzzle-recent-submissions" style="margin-top:8px; max-height: 420px; overflow:auto; color:#999;">加载中...</div>
                    </div>

                    <div style="background:#fff; border:1px solid #e8e8e8; border-radius: 12px; padding: 16px;">
                        <div style="font-size: 14px; font-weight: 800; color:#111827;">表结构 / 索引</div>
                        <pre id="admin-ai-puzzle-schema" style="margin:12px 0 0 0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 520px;">加载中...</pre>
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
        const savedSpring2026Uid = localStorage.getItem('admin_spring2026_ai_uid') || '';
        const savedSpring2026Delta = localStorage.getItem('admin_spring2026_ai_delta') || '1';
        const savedSpring2026Uuid = localStorage.getItem('admin_spring2026_ai_uuid') || 'spring2026_ai_station';

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

            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    管理员测试：增加“2026 春季 AI 体验站”抽奖次数
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/admin/spring2026-ai/chances/add?uid=xxx&delta=1&uuid=spring2026_ai_station</code><br>
                    说明：仅用于测试抽奖链路（不影响抽奖平台自身的“剩余次数”逻辑）。
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">uid:</label>
                        <input id="admin-spring2026-ai-chances-uid" type="number" value="${savedSpring2026Uid}" placeholder="必填"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">delta:</label>
                        <input id="admin-spring2026-ai-chances-delta" type="number" min="1" max="1000" value="${savedSpring2026Delta}" placeholder="默认1（1-1000）"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">uuid:</label>
                        <input id="admin-spring2026-ai-chances-uuid" type="text" value="${savedSpring2026Uuid}" placeholder="spring2026_ai_station"
                               style="width: 240px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-spring2026-ai-chances-add-btn" style="background:#1890ff; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        增加次数
                    </button>
                </div>

                <div id="admin-spring2026-ai-chances-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回 JSON</div>
                    <pre id="admin-spring2026-ai-chances-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 260px;">（尚未执行）</pre>
                </div>
            </div>
            </div>
        `;
    }

    /**
     * 渲染竞赛管理面板
     */
    renderContestDifficultyPanel() {
        const savedContestId = localStorage.getItem('contest_difficulty_contest_id') || '';
        const savedAcRateMax = localStorage.getItem('contest_difficulty_ac_rate_max') || '85';
        const savedDirectContestId = localStorage.getItem('admin_contest_direct_contest_id') || savedContestId;

        return `
            <div style="display:flex; flex-direction:column; gap:16px;">
                <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px;">
                    <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                        ACM 比赛管理：榜单持久化 / Rating 直调
                    </div>
                    <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.7;">
                        用于管理员绕过 event，直接执行比赛榜单持久化与 rerating。适合排查“事件没消费 / 状态没推进 / 需要手动补跑”的场景。<br>
                        榜单接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/admin/acm/rank/persist-direct?contestId=xxx</code><br>
                        Rating 接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/admin/acm/rating/rerating-direct?contestId=xxx</code>
                    </div>

                    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label style="font-size: 13px; color:#666;">contestId:</label>
                            <input id="admin-contest-direct-contest-id" type="number" value="${savedDirectContestId}" placeholder="必填：比赛ID"
                                   style="width: 180px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                        </div>
                        <div style="flex:1;"></div>
                        <button id="admin-contest-rank-persist-direct-btn" style="background:#1890ff; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                            持久化 ACM 榜单
                        </button>
                        <button id="admin-contest-rerating-direct-btn" style="background:#fa541c; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                            执行 ACM rerating
                        </button>
                    </div>

                    <div id="admin-contest-direct-error" style="margin-top: 8px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                    <div id="admin-contest-direct-summary" style="margin-top: 12px; padding: 12px; background: #f5f5f5; border-radius: 6px; font-size: 13px; display:none;"></div>

                    <div style="margin-top: 12px;">
                        <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">返回 JSON</div>
                        <pre id="admin-contest-direct-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 320px;">（尚未执行）</pre>
                    </div>
                </div>

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
            ${this.renderAcmProblemOpenRebuildAcceptPersonPanel()}
            ${this.renderLivecourseImportOneEmptyCoursePanel()}
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
     * 管理员工具：直播课后台——一键导入空课程（创建章节/小节）
     */
    renderLivecourseImportOneEmptyCoursePanel() {
        const get = (k, defVal) => {
            try {
                const v = localStorage.getItem(k);
                return (v == null || v === '') ? String(defVal) : String(v);
            } catch (_) {
                return String(defVal);
            }
        };
        const getBool = (k, defVal) => {
            try {
                const v = localStorage.getItem(k);
                if (v == null || v === '') return !!defVal;
                return String(v) === 'true';
            } catch (_) {
                return !!defVal;
            }
        };

        const courseId = get('admin_livecourse_import_course_id', '');
        const dryRun = getBool('admin_livecourse_import_dry_run', true);
        const raw = get('admin_livecourse_import_raw', '');
        const presetType = get('admin_livecourse_import_default_type', '1');
        const presetUnitTagId = get('admin_livecourse_import_default_unit_tag_id', '0');
        const presetFree = getBool('admin_livecourse_import_default_free', false);
        const presetRequireLogin = getBool('admin_livecourse_import_default_require_login', true);

        return `
            <div style="background:#fff; border:1px solid #e8e8e8; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <div style="font-size: 16px; font-weight: 800; color:#333;">直播课：一键导入空课程（章/节）</div>
                    <div style="font-size: 12px; color:#999;">新接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/admin/livecourse/import-one-empty-course</code></div>
                    <div style="flex:1;"></div>
                    <button id="admin-livecourse-import-preview-btn" class="admin-btn modal-secondary" style="padding: 8px 12px;" type="button">解析预览 JSON</button>
                    <button id="admin-livecourse-import-submit-btn" class="admin-btn" style="padding: 8px 14px; background:#1890ff; color:#fff; font-weight:700;" type="button">开始导入</button>
                </div>

                <div style="margin-top: 10px; font-size: 13px; color:#666; line-height: 1.7;">
                    约束：<b>courseId 必须是“空课程”（章节数=0）</b>，否则后端会拒绝导入以避免误覆盖。<br/>
                    入参：courseId + json（字符串参数，内部是 JSON） + dryRun。你可以直接粘贴 JSON；也可以粘贴文本（Tab/逗号分隔）让前端生成 JSON。
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">courseId:</label>
                        <input id="admin-livecourse-import-course-id" type="number" min="1" value="${courseId}" placeholder="必填"
                               style="width: 160px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">dryRun:</label>
                        <input id="admin-livecourse-import-dry-run" type="checkbox" ${dryRun ? 'checked' : ''} />
                        <span style="font-size: 12px; color:#999;">只校验不落库（建议先勾选预演）</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">默认 type:</label>
                        <input id="admin-livecourse-import-default-type" type="number" min="0" value="${presetType}"
                               style="width: 90px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                        <span style="font-size: 12px; color:#999;">文本=6 / 视频=1（按后端枚举）</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">默认 unitTagId:</label>
                        <input id="admin-livecourse-import-default-unitTagId" type="number" min="0" value="${presetUnitTagId}"
                               style="width: 110px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">默认 free:</label>
                        <input id="admin-livecourse-import-default-free" type="checkbox" ${presetFree ? 'checked' : ''} />
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">默认 requireLogin:</label>
                        <input id="admin-livecourse-import-default-requireLogin" type="checkbox" ${presetRequireLogin ? 'checked' : ''} />
                    </div>
                </div>

                <textarea id="admin-livecourse-import-raw" rows="10"
                          placeholder="支持两种输入：&#10;1) 直接粘贴 JSON：{&quot;chapters&quot;:[...]}&#10;2) 粘贴文本（建议 Tab 分隔）：章\t节\t标题\t时长\tvid&#10;可选列：章标题/课程章标题、type、unitTagId、free、requireLogin、mobileVideoId"
                          style="width: 100%; margin-top: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px; resize: vertical;">${raw}</textarea>

                <div id="admin-livecourse-import-error" style="margin-top: 10px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div id="admin-livecourse-import-tip" style="margin-top: 8px; font-size: 12px; color:#666;"></div>
                <div style="margin-top: 10px;">
                    <div style="font-size: 13px; color:#333; font-weight: 700; margin-bottom: 6px;">预览 JSON</div>
                    <pre id="admin-livecourse-import-preview" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 10px; overflow:auto; max-height: 260px;">（尚未解析）</pre>
                </div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 700; margin-bottom: 6px;">导入结果</div>
                    <pre id="admin-livecourse-import-result" style="margin:0; background:#111827; color:#f9fafb; padding: 12px; border-radius: 10px; overflow:auto; max-height: 320px;">（尚未执行）</pre>
                </div>
            </div>
        `;
    }

    /**
     * 管理员工具：重算并回填 acm_problem_open.accept_person
     */
    renderAcmProblemOpenRebuildAcceptPersonPanel() {
        const get = (k, defVal) => {
            try {
                const v = localStorage.getItem(k);
                return (v == null || v === '') ? String(defVal) : String(v);
            } catch (_) {
                return String(defVal);
            }
        };
        const getBool = (k, defVal) => {
            try {
                const v = localStorage.getItem(k);
                if (v == null || v === '') return !!defVal;
                return String(v) === 'true';
            } catch (_) {
                return !!defVal;
            }
        };
        const offset = get('admin_acm_open_rebuild_offset', 0);
        const limit = get('admin_acm_open_rebuild_limit', 0);
        const pageSize = get('admin_acm_open_rebuild_page_size', 200);
        const batchSize = get('admin_acm_open_rebuild_batch_size', 20);
        const sleepMs = get('admin_acm_open_rebuild_sleep_ms', 0);
        const dryRun = getBool('admin_acm_open_rebuild_dry_run', true);
        const autoRun = getBool('admin_acm_open_rebuild_auto_run', false);
        const segmentLimit = get('admin_acm_open_rebuild_segment_limit', 500);

        return `
            <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 8px;">
                    acm_problem_open：重算通过人数（accept_person）
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
                    兜底/回填/验数：按<b>全站口径</b>（主站 + ACM，按用户去重）重算，并写回 <code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">acm_problem_open.accept_person</code>。<br>
                    后端接口：<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">POST /problem/tracker/admin/acm-problem-open/rebuild-accept-person</code>
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">offset:</label>
                        <input id="admin-acm-open-rebuild-offset" type="number" min="0" value="${offset}"
                               style="width: 140px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">limit:</label>
                        <input id="admin-acm-open-rebuild-limit" type="number" min="0" value="${limit}"
                               style="width: 140px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                        <span style="font-size: 12px; color:#999;">0 表示处理到末尾</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">自动跑完:</label>
                        <input id="admin-acm-open-rebuild-auto-run" type="checkbox" ${autoRun ? 'checked' : ''} />
                        <span style="font-size: 12px; color:#999;">分段请求，避免单次 limit 太大</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">每段limit:</label>
                        <input id="admin-acm-open-rebuild-seg-limit" type="number" min="1" value="${segmentLimit}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">pageSize:</label>
                        <input id="admin-acm-open-rebuild-page-size" type="number" min="1" max="500" value="${pageSize}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">batchSize:</label>
                        <input id="admin-acm-open-rebuild-batch-size" type="number" min="1" max="50" value="${batchSize}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">sleepMs:</label>
                        <input id="admin-acm-open-rebuild-sleep-ms" type="number" min="0" max="3000" value="${sleepMs}"
                               style="width: 120px; padding: 8px 10px; border:1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size: 13px; color:#666;">dryRun:</label>
                        <input id="admin-acm-open-rebuild-dry-run" type="checkbox" ${dryRun ? 'checked' : ''} />
                        <span style="font-size: 12px; color:#999;">只统计不落库（推荐先勾选预演）</span>
                    </div>
                    <div style="flex:1;"></div>
                    <button id="admin-acm-open-rebuild-run-btn"
                            style="background:#fa541c; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        开始执行
                    </button>
                    <button id="admin-acm-open-rebuild-stop-btn"
                            style="display:none;background:#ff4d4f; color:#fff; border:none; padding: 8px 14px; border-radius: 6px; cursor:pointer; font-size: 13px;">
                        停止
                    </button>
                </div>

                <div id="admin-acm-open-rebuild-error" style="margin-top: 10px; font-size: 13px; color:#ff4d4f; display:none;"></div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 13px; color:#333; font-weight: 600; margin-bottom: 6px;">执行结果</div>
                    <pre id="admin-acm-open-rebuild-result" style="margin:0; background:#0b1020; color:#e6edf3; padding: 12px; border-radius: 8px; overflow:auto; max-height: 320px;">（尚未执行）</pre>
                </div>
            </div>
        `;
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

    async adminBattleRebuildMatchCount() {
        const btn = document.getElementById('admin-battle-rebuild-matchcount-btn');
        const errEl = document.getElementById('admin-battle-rebuild-matchcount-error');
        const resultEl = document.getElementById('admin-battle-rebuild-matchcount-result');
        if (!btn || !errEl || !resultEl) return;
        errEl.style.display = 'none';

        const ok = confirm(
            `确认重建所有对战题目的 matchCount 吗？\n\n` +
            `接口：POST /problem/tracker/battle/problem/admin/rebuild-match-count\n\n` +
            `注意：这是全量操作，可能较耗时，建议低峰期执行。`
        );
        if (!ok) return;

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '重建中...';
        resultEl.textContent = `请求中...\n`;

        try {
            const data = await this.apiService.adminBattleProblemRebuildMatchCount();
            resultEl.textContent = JSON.stringify(data, null, 2);
            const rebuilt = (data && (data.rebuilt ?? data.updated ?? data.processed)) ?? '-';
            alert(`重建完成：rebuilt/updated/processed=${rebuilt}`);
        } catch (e) {
            const msg = e && e.message ? e.message : '重建失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '开始重建';
        }
    }

    /**
     * 刷新用户技能树进度
     */
    async adminRefreshUserChapterProgress() {
        const uidInput = document.getElementById('admin-refresh-chapter-uid');
        const keyInput = document.getElementById('admin-refresh-chapter-key');
        const errorEl = document.getElementById('admin-refresh-chapter-error');
        const resultEl = document.getElementById('admin-refresh-chapter-result');
        const btn = document.getElementById('admin-refresh-chapter-btn');
        if (!uidInput || !keyInput || !errorEl || !resultEl || !btn) return;

        errorEl.style.display = 'none';
        const uid = parseInt(String(uidInput.value || '').trim(), 10);
        const key = String(keyInput.value || 'chapter1').trim();

        if (!uid || uid <= 0) {
            errorEl.textContent = '请填写有效的 userId（正整数）';
            errorEl.style.display = 'block';
            return;
        }

        try {
            localStorage.setItem('admin_refresh_chapter_uid', String(uid));
            localStorage.setItem('admin_refresh_chapter_key', key);
        } catch (_) {}

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '刷新中...';
        resultEl.textContent = `请求中...\nuserId=${uid}\nchapterKey=${key}\n`;

        try {
            const data = await this.apiService.adminRefreshUserChapterProgress(uid, key);
            resultEl.textContent = JSON.stringify(data, null, 2);
        } catch (e) {
            const msg = e && e.message ? e.message : '刷新进度失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '刷新进度 & 检查成就';
        }
    }

    /**
     * 批量统计团队活动最终数据
     */
    async adminActivityTeamStatistics() {
        const idsInput = document.getElementById('admin-team-stats-ids');
        const beginInput = document.getElementById('admin-team-stats-begin');
        const endInput = document.getElementById('admin-team-stats-end');
        const errorEl = document.getElementById('admin-team-stats-error');
        const resultEl = document.getElementById('admin-team-stats-result');
        const btn = document.getElementById('admin-team-stats-btn');
        if (!idsInput || !beginInput || !endInput || !errorEl || !resultEl || !btn) return;

        errorEl.style.display = 'none';
        const ids = String(idsInput.value || '').trim();
        const begin = String(beginInput.value || '').trim();
        const end = String(endInput.value || '').trim();

        if (!ids) {
            errorEl.textContent = '请填写 teamIds';
            errorEl.style.display = 'block';
            return;
        }

        try {
            localStorage.setItem('admin_team_stats_ids', ids);
            localStorage.setItem('admin_team_stats_begin', begin);
            localStorage.setItem('admin_team_stats_end', end);
        } catch (_) {}

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '统计中...';
        resultEl.textContent = `请求中...\nteamIds=${ids}\nbegin=${begin}\nend=${end}\n`;

        try {
            const data = await this.apiService.adminActivityTeamStatistics(ids, begin, end);
            resultEl.textContent = JSON.stringify(data, null, 2);

            // 渲染可视化报表
            if (data && Array.isArray(data.list)) {
                const teams = data.list;
                const html = teams.map(t => {
                    const tid = t.teamId;
                    const name = this.escapeHtml(t.teamName || `Team ${tid}`);
                    const score = t.score;
                    const totalClock = t.clockTotalTimes;

                    // 1. 打卡统计
                    const ge30 = t.ge30Count || 0;
                    const ge30Uids = Array.isArray(t.ge30UserIds) ? t.ge30UserIds : [];
                    const ge60 = t.ge60Count || 0;
                    const ge60Uids = Array.isArray(t.ge60UserIds) ? t.ge60UserIds : [];
                    const ge90 = t.ge90Count || 0; // 新增 >=90
                    const ge90Uids = Array.isArray(t.ge90UserIds) ? t.ge90UserIds : []; // 新增名单

                    // 2. 题单制霸
                    const tf = t.topicFinished || {};
                    const topicKeys = Object.keys(tf);
                    const topicHtml = topicKeys.map(k => {
                        const item = tf[k];
                        const cnt = item.count || 0;
                        const uids = Array.isArray(item.userIds) ? item.userIds : [];
                        if (cnt === 0) return '';
                        return `<div style="margin-top:2px;">
                            <span style="color:#666;">${k}:</span> <b>${cnt}人</b>
                            <span style="color:#999;font-size:12px;">(${uids.join(',')})</span>
                        </div>`;
                    }).join('');

                    // 3. 技能树制霸
                    const sf = t.skillFinished || {};
                    const skillKeys = Object.keys(sf);
                    const skillHtml = skillKeys.map(k => {
                        const item = sf[k];
                        const cnt = item.count || 0;
                        const uids = Array.isArray(item.userIds) ? item.userIds : [];
                        if (cnt === 0) return '';
                        return `<div style="margin-top:2px;">
                            <span style="color:#666;">${k}:</span> <b>${cnt}人</b>
                            <span style="color:#999;font-size:12px;">(${uids.join(',')})</span>
                        </div>`;
                    }).join('');

                    return `
                        <div style="border:1px solid #eee; border-radius:8px; padding:12px; margin-bottom:12px; background:#fbfbfb;">
                            <div style="font-size:14px; font-weight:700; color:#333; margin-bottom:8px;">
                                [${tid}] ${name} <span style="margin-left:10px; color:#1890ff;">积分: ${score}</span>
                            </div>
                            <div style="font-size:13px; line-height:1.6;">
                                <div style="margin-bottom:6px;">
                                    <b>打卡统计:</b> 总人次 ${totalClock}<br>
                                    ≥30天: <b>${ge30}人</b> <span style="color:#999;font-size:12px;">(${ge30Uids.join(',')})</span><br>
                                    ≥60天: <b>${ge60}人</b> <span style="color:#999;font-size:12px;">(${ge60Uids.join(',')})</span><br>
                                    ≥90天: <b>${ge90}人</b> <span style="color:#999;font-size:12px;">(${ge90Uids.join(',')})</span>
                                </div>
                                ${topicHtml ? `<div style="margin-bottom:6px; border-top:1px dashed #ddd; padding-top:6px;"><b>题单制霸:</b>${topicHtml}</div>` : ''}
                                ${skillHtml ? `<div style="margin-bottom:6px; border-top:1px dashed #ddd; padding-top:6px;"><b>技能树制霸:</b>${skillHtml}</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');

                const reportDiv = document.createElement('div');
                reportDiv.innerHTML = `<div style="margin-top:16px; font-weight:600;">可视化报表：</div>${html}`;
                // 清理旧报表
                const oldReport = document.getElementById('admin-team-stats-report');
                if (oldReport) oldReport.remove();
                
                reportDiv.id = 'admin-team-stats-report';
                resultEl.parentNode.appendChild(reportDiv);
            }

        } catch (e) {
            const msg = e && e.message ? e.message : '统计失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '开始统计';
        }
    }

    async adminSpring2026ThirdAddChances() {
        const uidInput = document.getElementById('admin-spring2026-third-chances-uid');
        const deltaInput = document.getElementById('admin-spring2026-third-chances-delta');
        const errorEl = document.getElementById('admin-spring2026-third-chances-error');
        const resultEl = document.getElementById('admin-spring2026-third-chances-result');
        const btn = document.getElementById('admin-spring2026-third-chances-add-btn');
        if (!uidInput || !deltaInput || !errorEl || !resultEl || !btn) return;

        errorEl.style.display = 'none';
        const uid = parseInt(String(uidInput.value || '').trim(), 10);
        const delta = parseInt(String(deltaInput.value || '').trim(), 10);

        if (!uid || uid <= 0) {
            errorEl.textContent = '请填写有效的 uid（正整数）';
            errorEl.style.display = 'block';
            return;
        }
        if (!delta || delta <= 0) {
            errorEl.textContent = 'delta 必须为正数';
            errorEl.style.display = 'block';
            return;
        }
        if (delta > 1000) {
            errorEl.textContent = 'delta 过大（最大 1000）';
            errorEl.style.display = 'block';
            return;
        }

        try {
            localStorage.setItem('admin_spring2026_ai_uid', String(uid));
            localStorage.setItem('admin_spring2026_ai_delta', String(delta));
        } catch (_) {}

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '增加中...';
        resultEl.textContent = `请求中...\nuid=${uid}\ndelta=${delta}\n`;

        try {
            const data = await this.apiService.adminSpring2026ThirdAddChances(uid, delta);
            resultEl.textContent = JSON.stringify(data, null, 2);
            const chances = data && typeof data.chances !== 'undefined' ? data.chances : '-';
            alert(`已增加抽奖次数：uid=${uid}，本次+${delta}，当前 chances=${chances}`);
        } catch (e) {
            const msg = e && e.message ? e.message : '增加抽奖次数失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '增加次数';
        }
    }

    /**
     * 管理员测试：清除第三期「分享活动页面」的全期领取标记（用于重复测试分享功能）。
     */
    async adminClearSpring2026ThirdShareClaimed() {
        const uidInput = document.getElementById('admin-spring2026-third-share-claimed-clear-uid');
        const errorEl = document.getElementById('admin-spring2026-third-share-claimed-clear-error');
        const resultEl = document.getElementById('admin-spring2026-third-share-claimed-clear-result');
        const btn = document.getElementById('admin-spring2026-third-share-claimed-clear-btn');

        if (!uidInput || !errorEl || !resultEl || !btn) return;
        errorEl.style.display = 'none';

        const uid = parseInt(String(uidInput.value || '').trim(), 10);
        if (!uid || uid <= 0) {
            errorEl.textContent = '请填写有效的 uid（正整数）';
            errorEl.style.display = 'block';
            return;
        }

        try {
            localStorage.setItem('admin_spring2026_third_share_claimed_clear_uid', String(uid));
            // 顺便同步通用 uid，减少重复输入
            localStorage.setItem('admin_spring2026_ai_uid', String(uid));
        } catch (_) {}

        const ok = confirm(`确认清除该用户的“第三期分享活动页面领取标记”？\n\nuid=${uid}\n\n注意：只删除“已领取标记”，不会回滚用户抽奖次数。`);
        if (!ok) return;

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '清除中...';
        resultEl.textContent = `请求中...\nuid=${uid}\n`;

        try {
            const data = await this.apiService.adminClearSpring2026ThirdShareClaimed(uid);
            resultEl.textContent = JSON.stringify(data, null, 2);
            const deleted = !!(data && data.deleted);
            const key = data && data.key ? data.key : '';
            alert(deleted
                ? `已清除领取标记：uid=${uid}${key ? `\nkey=${key}` : ''}`
                : `未找到标记（可能本就未领取/已清除）：uid=${uid}${key ? `\nkey=${key}` : ''}`);
        } catch (e) {
            const msg = e && e.message ? e.message : '清除失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '清除领取标记';
        }
    }

    async adminSpring2026AiAddChances() {
        const uidInput = document.getElementById('admin-spring2026-ai-chances-uid');
        const deltaInput = document.getElementById('admin-spring2026-ai-chances-delta');
        const uuidInput = document.getElementById('admin-spring2026-ai-chances-uuid');
        const errorEl = document.getElementById('admin-spring2026-ai-chances-error');
        const resultEl = document.getElementById('admin-spring2026-ai-chances-result');
        const btn = document.getElementById('admin-spring2026-ai-chances-add-btn');
        if (!uidInput || !deltaInput || !uuidInput || !errorEl || !resultEl || !btn) return;

        errorEl.style.display = 'none';
        const uid = parseInt(String(uidInput.value || '').trim(), 10);
        const delta = parseInt(String(deltaInput.value || '').trim(), 10);
        const uuid = String(uuidInput.value || '').trim() || 'spring2026_ai_station';

        if (!uid || uid <= 0) {
            errorEl.textContent = '请填写有效的 uid（正整数）';
            errorEl.style.display = 'block';
            return;
        }
        if (!delta || delta <= 0) {
            errorEl.textContent = 'delta 必须为正数';
            errorEl.style.display = 'block';
            return;
        }
        if (delta > 1000) {
            errorEl.textContent = 'delta 过大（最大 1000）';
            errorEl.style.display = 'block';
            return;
        }

        try {
            localStorage.setItem('admin_spring2026_ai_uid', String(uid));
            localStorage.setItem('admin_spring2026_ai_delta', String(delta));
            localStorage.setItem('admin_spring2026_ai_uuid', String(uuid));
        } catch (_) {}

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '增加中...';
        resultEl.textContent = `请求中...\nuid=${uid}\ndelta=${delta}\nuuid=${uuid}\n`;

        try {
            const data = await this.apiService.adminSpring2026AiAddChances(uid, delta, uuid);
            resultEl.textContent = JSON.stringify(data, null, 2);
            const chances = data && typeof data.chances !== 'undefined' ? data.chances : '-';
            alert(`已增加抽奖次数：uid=${uid}，本次+${delta}，当前 chances=${chances}`);
        } catch (e) {
            const msg = e && e.message ? e.message : '增加抽奖次数失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '增加次数';
        }
    }

    async adminSpring2026AiFetchLotteryRecords() {
        const uidInput = document.getElementById('admin-spring2026-ai-records-uid');
        const activityIdInput = document.getElementById('admin-spring2026-ai-records-activity-id');
        const offsetInput = document.getElementById('admin-spring2026-ai-records-offset');
        const limitInput = document.getElementById('admin-spring2026-ai-records-limit');
        const errorEl = document.getElementById('admin-spring2026-ai-records-error');
        const tableEl = document.getElementById('admin-spring2026-ai-records-table');
        const resultEl = document.getElementById('admin-spring2026-ai-records-result');
        const btn = document.getElementById('admin-spring2026-ai-records-fetch-btn');
        if (!uidInput || !activityIdInput || !offsetInput || !limitInput || !errorEl || !resultEl || !btn) return;

        errorEl.style.display = 'none';
        if (tableEl) tableEl.style.display = 'none';

        const uid = parseInt(String(uidInput.value || '').trim(), 10);
        const activityId = parseInt(String(activityIdInput.value || '465576048').trim(), 10) || 465576048;
        const offset = Math.max(0, parseInt(String(offsetInput.value || '0').trim(), 10) || 0);
        const limit = Math.max(1, Math.min(200, parseInt(String(limitInput.value || '50').trim(), 10) || 50));

        if (!uid || uid <= 0) {
            errorEl.textContent = '请填写有效的 uid（正整数）';
            errorEl.style.display = 'block';
            return;
        }

        try {
            // 复用 uid 记忆；额外保存 records 参数
            localStorage.setItem('admin_spring2026_ai_uid', String(uid));
            localStorage.setItem('admin_spring2026_ai_records_activity_id', String(activityId));
            localStorage.setItem('admin_spring2026_ai_records_offset', String(offset));
            localStorage.setItem('admin_spring2026_ai_records_limit', String(limit));
        } catch (_) {}

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '查询中...';
        resultEl.textContent = `请求中...\nuid=${uid}\nactivityId=${activityId}\noffset=${offset}\nlimit=${limit}\n`;

        try {
            const data = await this.apiService.adminSpring2026AiLotteryRecords(uid, activityId, offset, limit);
            this.adminSpring2026AiLotteryLast = data || null;
            resultEl.textContent = JSON.stringify(data, null, 2);

            const raw = data;
            let records = [];
            let total = null;
            if (Array.isArray(raw)) {
                records = raw;
            } else if (raw && Array.isArray(raw.records)) {
                records = raw.records;
                if (typeof raw.total === 'number') total = raw.total;
                if (typeof raw.totalCount === 'number') total = raw.totalCount;
            } else if (raw && Array.isArray(raw.list)) {
                records = raw.list;
                if (typeof raw.total === 'number') total = raw.total;
                if (typeof raw.totalCount === 'number') total = raw.totalCount;
            } else if (raw && Array.isArray(raw.items)) {
                records = raw.items;
                if (typeof raw.total === 'number') total = raw.total;
                if (typeof raw.totalCount === 'number') total = raw.totalCount;
            }

            if (tableEl) {
                const header = `
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom: 8px;">
                        <div style="font-size: 13px; font-weight: 700; color:#333;">记录列表</div>
                        <div style="font-size: 12px; color:#999;">本次返回 ${records.length} 条${(typeof total === 'number') ? `，total=${total}` : ''}</div>
                    </div>
                `;
                const rows = records.map((r, idx) => {
                    const award = (r && (r.award_name ?? r.awardName ?? r.award)) ?? '';
                    const time = (r && (r.time ?? r.create_time ?? r.createdAt)) ?? '';
                    const userId = (r && (r.user_id ?? r.userId ?? r.uid)) ?? uid;
                    const awardText = String(award || '').trim() ? String(award).trim() : '谢谢惠顾';
                    return `
                        <tr>
                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f0f0; color:#999; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${offset + idx + 1}</td>
                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f0f0;">${this.escapeHtml(String(userId))}</td>
                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f0f0; font-weight:700;">${this.escapeHtml(String(awardText))}</td>
                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f0f0; color:#666;">${this.escapeHtml(String(time))}</td>
                        </tr>
                    `;
                }).join('');

                const table = `
                    <div style="border: 1px solid #f0f0f0; border-radius: 10px; overflow:hidden;">
                        <table style="width:100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="background:#fafafa;">
                                    <th style="text-align:left; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; color:#666; width: 70px;">#</th>
                                    <th style="text-align:left; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; color:#666; width: 120px;">user_id</th>
                                    <th style="text-align:left; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; color:#666; width: 220px;">award_name</th>
                                    <th style="text-align:left; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; color:#666;">time</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows || `<tr><td colspan="4" style="padding: 14px 10px; color:#999; text-align:center;">（无记录）</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                `;

                tableEl.innerHTML = header + table;
                tableEl.style.display = 'block';
            }
        } catch (e) {
            const msg = e && e.message ? e.message : '查询抽奖记录失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
            this.adminSpring2026AiLotteryLast = null;
            if (tableEl) tableEl.style.display = 'none';
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '查询记录';
        }
    }

    /**
     * 管理员：清空某用户的发展说明书测运 Redis，使其可重新生成。
     */
    async adminClearSpring2026FortuneRedis() {
        const uidInput = document.getElementById('admin-clear-spring2026-fortune-redis-uid');
        const errorEl = document.getElementById('admin-clear-spring2026-fortune-redis-error');
        const resultEl = document.getElementById('admin-clear-spring2026-fortune-redis-result');
        const btn = document.getElementById('admin-clear-spring2026-fortune-redis-btn');

        if (!uidInput || !errorEl || !resultEl || !btn) return;
        errorEl.style.display = 'none';

        const uid = parseInt(String(uidInput.value || '').trim(), 10);
        if (!uid || uid <= 0) {
            errorEl.textContent = '请填写有效的 uid（正整数）';
            errorEl.style.display = 'block';
            return;
        }

        try {
            localStorage.setItem('admin_spring2026_fortune_clear_uid', String(uid));
        } catch (_) {}

        const ok = confirm(`确认清空该用户的发展说明书 Redis？\n\nuid=${uid}\n\n清空后该用户可重新生成发展说明书。`);
        if (!ok) return;

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '清空中...';
        resultEl.textContent = `请求中...\nuid=${uid}\n`;

        try {
            const data = await this.apiService.adminClearSpring2026FortuneRedis(uid);
            resultEl.textContent = JSON.stringify(data, null, 2);
            const deleted = data && data.deleted;
            alert(deleted ? `已清空：uid=${uid}，该用户可重新生成发展说明书。` : `未找到缓存（可能本就无数据）：uid=${uid}`);
        } catch (e) {
            const msg = e && e.message ? e.message : '清空失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '清空 Redis';
        }
    }

    /**
     * 管理员：批量清空多用户的发展说明书测运 Redis。
     * 文本 id 用数字或空格、逗号、换行分隔。
     */
    async adminBatchClearSpring2026FortuneRedis() {
        const textarea = document.getElementById('admin-batch-clear-spring2026-fortune-redis-uids');
        const errorEl = document.getElementById('admin-batch-clear-spring2026-fortune-redis-error');
        const resultEl = document.getElementById('admin-batch-clear-spring2026-fortune-redis-result');
        const btn = document.getElementById('admin-batch-clear-spring2026-fortune-redis-btn');

        if (!textarea || !errorEl || !resultEl || !btn) return;
        errorEl.style.display = 'none';

        const raw = String(textarea.value || '').trim();
        const uids = raw
            .split(/[\s,，、\n]+/)
            .map(s => parseInt(String(s).trim(), 10))
            .filter(n => !isNaN(n) && n > 0);
        const uniqueUids = [...new Set(uids)];

        if (uniqueUids.length === 0) {
            errorEl.textContent = '请填写有效的 uid（多个用数字或空格、逗号、换行分隔）';
            errorEl.style.display = 'block';
            return;
        }

        const ok = confirm(`确认批量清空 ${uniqueUids.length} 个用户的发展说明书 Redis？\n\nuids: ${uniqueUids.join(', ')}\n\n清空后这些用户可重新生成发展说明书。`);
        if (!ok) return;

        const oldText = btn.textContent;
        btn.disabled = true;
        resultEl.textContent = '请求中...\n';
        const results = [];

        for (let i = 0; i < uniqueUids.length; i++) {
            const uid = uniqueUids[i];
            resultEl.textContent = `执行中 (${i + 1}/${uniqueUids.length}) uid=${uid}...\n`;
            try {
                const data = await this.apiService.adminClearSpring2026FortuneRedis(uid);
                results.push({ uid, deleted: !!data?.deleted, ok: true, data });
            } catch (e) {
                results.push({ uid, deleted: false, ok: false, error: (e && e.message) ? e.message : '清空失败' });
            }
        }

        resultEl.textContent = JSON.stringify(results, null, 2);
        const successCount = results.filter(r => r.ok && r.deleted).length;
        const failCount = results.filter(r => !r.ok).length;
        btn.disabled = false;
        btn.textContent = oldText || '批量清空 Redis';
        alert(`批量清空完成：共 ${uniqueUids.length} 个，成功 ${successCount} 个，失败 ${failCount} 个`);
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
        const qmsPanel = document.getElementById('admin-qms-draft-panel');
        const clockBtn = document.getElementById('admin-tab-clock');
        const battleBtn = document.getElementById('admin-tab-battle');
        const tagBtn = document.getElementById('admin-tab-tag');
        const importBtn = document.getElementById('admin-tab-import');
        const yearReportBtn = document.getElementById('admin-tab-year-report');
        const contestDifficultyBtn = document.getElementById('admin-tab-contest-difficulty');
        const pcBtn = document.getElementById('admin-tab-prompt-challenge');
        const qmsBtn = document.getElementById('admin-tab-qms-draft');
        const difyBtn = document.getElementById('admin-tab-dify');

        // hide all
        clockPanel.style.display = 'none';
        battlePanel.style.display = 'none';
        if (tagPanel) tagPanel.style.display = 'none';
        if (importPanel) importPanel.style.display = 'none';
        if (yearReportPanel) yearReportPanel.style.display = 'none';
        if (contestDifficultyPanel) contestDifficultyPanel.style.display = 'none';
        if (pcPanel) pcPanel.style.display = 'none';
        if (qmsPanel) qmsPanel.style.display = 'none';
        const difyPanel = document.getElementById('admin-dify-panel');
        if (difyPanel) difyPanel.style.display = 'none';

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
        if (qmsBtn) {
            qmsBtn.style.color = '#666';
            qmsBtn.style.borderBottomColor = 'transparent';
        }
        if (difyBtn) {
            difyBtn.style.color = '#666';
            difyBtn.style.borderBottomColor = 'transparent';
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
            const contestRankPersistBtn = document.getElementById('admin-contest-rank-persist-direct-btn');
            const contestReratingBtn = document.getElementById('admin-contest-rerating-direct-btn');
            const contestPreviewBtn = document.getElementById('admin-contest-difficulty-preview-btn');
            const contestSubmitBtn = document.getElementById('admin-contest-difficulty-submit-btn');
            if (contestRankPersistBtn) contestRankPersistBtn.addEventListener('click', () => this.handleContestRankPersistDirect());
            if (contestReratingBtn) contestReratingBtn.addEventListener('click', () => this.handleContestReratingDirect());
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
        } else if (tab === 'qmsDraft' && qmsPanel) {
            qmsPanel.innerHTML = this.renderQmsDraftPanel();
            const qmsOneBtn = document.getElementById('admin-qms-oneclick');
            if (qmsOneBtn) qmsOneBtn.addEventListener('click', () => this.adminQmsOneClick());
            // 录题 JSON 导入/清空
            const fileInput = document.getElementById('admin-qms-problem-json-file');
            const chooseBtn = document.getElementById('admin-qms-problem-json-choose');
            const clearBtn = document.getElementById('admin-qms-problem-json-clear');
            const msgEl = document.getElementById('admin-qms-problem-json-msg');
            const previewEl = document.getElementById('admin-qms-problem-json-preview');
            const refreshPayloadPreview = () => {};
            if (chooseBtn && fileInput) {
                chooseBtn.addEventListener('click', () => fileInput.click());
                fileInput.addEventListener('change', async () => {
                    const f = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
                    if (!f) return;
                    try {
                        const text = await f.text();
                        const obj = JSON.parse(text);
                        // minimal validation
                        const title = obj?.basic?.title || obj?.title;
                        const content = obj?.statement?.content || obj?.content;
                        if (!title || !content) throw new Error('缺少必要字段：basic.title 与 statement.content（或 title/content）');
                        localStorage.setItem('tracker_qms_problem_json', JSON.stringify(obj));
                        if (msgEl) { msgEl.textContent = `✅ 已导入：${title}`; msgEl.style.color = '#52c41a'; }
                        if (previewEl) previewEl.textContent = JSON.stringify(obj, null, 2);
                        refreshPayloadPreview();
                    } catch (e) {
                        const m = e && e.message ? e.message : '导入失败';
                        if (msgEl) { msgEl.textContent = `❌ 导入失败：${m}`; msgEl.style.color = '#ff4d4f'; }
                    } finally {
                        // allow selecting the same file again
                        fileInput.value = '';
                    }
                });
            }
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    try { localStorage.removeItem('tracker_qms_problem_json'); } catch (_) {}
                    if (msgEl) { msgEl.textContent = '已清空录题 JSON（回退到默认示例）'; msgEl.style.color = '#999'; }
                    if (previewEl) previewEl.textContent = '（未导入）';
                    refreshPayloadPreview();
                });
            }

            // source.zip 导入/清空：source.zip 内含 problem.json + data.zip
            const srcZipInput = document.getElementById('admin-qms-source-zip-file');
            const srcZipChooseBtn = document.getElementById('admin-qms-source-zip-choose');
            const srcZipClearBtn = document.getElementById('admin-qms-source-zip-clear');
            const srcZipMsgEl = document.getElementById('admin-qms-source-zip-msg');
            if (srcZipChooseBtn && srcZipInput) {
                srcZipChooseBtn.addEventListener('click', () => srcZipInput.click());
                srcZipInput.addEventListener('change', async () => {
                    const f = srcZipInput.files && srcZipInput.files[0] ? srcZipInput.files[0] : null;
                    if (!f) return;
                    if (srcZipMsgEl) { srcZipMsgEl.textContent = `解析中：${f.name}...`; srcZipMsgEl.style.color = '#999'; }
                    try {
                        const r = await this.adminQmsParseSourceZip(f);
                        const parts = [];
                        if (r.problemTitle) parts.push(`JSON：${r.problemTitle}`);
                        if (r.dataZipName) parts.push(`data.zip：${r.dataZipName}（${Math.round((r.dataZipSize || 0) / 1024)} KB）`);
                        if (r.checkerFileName) parts.push(`checker：${r.checkerFileName}（来自内层 zip 也可识别）`);
                        if (srcZipMsgEl) { srcZipMsgEl.textContent = `✅ source.zip 解析完成：` + (parts.join('；') || '（未找到有效内容）'); srcZipMsgEl.style.color = '#52c41a'; }
                        // 同步刷新 JSON 预览与 payload 预览
                        try {
                            const imported2 = (() => {
                                try { return JSON.parse(localStorage.getItem('tracker_qms_problem_json') || ''); } catch (_) { return null; }
                            })();
                            if (previewEl) previewEl.textContent = imported2 ? JSON.stringify(imported2, null, 2) : '（未导入）';
                            if (msgEl && imported2) {
                                const title2 = imported2?.basic?.title || imported2?.title || '';
                                msgEl.textContent = title2 ? `✅ 已导入：${title2}` : '✅ 已导入 JSON';
                                msgEl.style.color = '#52c41a';
                            }
                            // 若 data.zip 注入成功，也同步提示到 cases.zip 区块
                            const zipMsgEl2 = document.getElementById('admin-qms-cases-zip-msg');
                            if (zipMsgEl2 && this._qmsZipFile) {
                                zipMsgEl2.textContent = `✅ 已选择 ZIP：${this._qmsZipFile.name}（${Math.round((this._qmsZipFile.size || 0) / 1024)} KB）（来自 source.zip）`;
                                zipMsgEl2.style.color = '#52c41a';
                            }
                        } catch (_) {}
                        refreshPayloadPreview();
                    } catch (e) {
                        const m = e && e.message ? e.message : '解析失败';
                        if (srcZipMsgEl) { srcZipMsgEl.textContent = `❌ source.zip 解析失败：${m}`; srcZipMsgEl.style.color = '#ff4d4f'; }
                    } finally {
                        srcZipInput.value = '';
                    }
                });
            }
            if (srcZipClearBtn) {
                srcZipClearBtn.addEventListener('click', () => {
                    this._qmsSourceZipFile = null;
                    // 同时清空从 source.zip 注入的 JSON/用例（避免误用旧内容）
                    try { localStorage.removeItem('tracker_qms_problem_json'); } catch (_) {}
                    this._qmsZipFile = null;
                    if (srcZipMsgEl) { srcZipMsgEl.textContent = '已清空 source.zip'; srcZipMsgEl.style.color = '#999'; }
                    if (msgEl) { msgEl.textContent = '已清空录题 JSON（回退到默认示例）'; msgEl.style.color = '#999'; }
                    if (previewEl) previewEl.textContent = '（未导入）';
                    const zipMsgEl2 = document.getElementById('admin-qms-cases-zip-msg');
                    if (zipMsgEl2) { zipMsgEl2.textContent = '已清空 ZIP（将跳过用例上传）'; zipMsgEl2.style.color = '#999'; }
                    refreshPayloadPreview();
                });
            }

            // 用例 ZIP 导入/清空（仅保存在内存里，不落 localStorage）
            const zipInput = document.getElementById('admin-qms-cases-zip-file');
            const zipChooseBtn = document.getElementById('admin-qms-cases-zip-choose');
            const zipClearBtn = document.getElementById('admin-qms-cases-zip-clear');
            const zipMsgEl = document.getElementById('admin-qms-cases-zip-msg');
            if (zipChooseBtn && zipInput) {
                zipChooseBtn.addEventListener('click', () => zipInput.click());
                zipInput.addEventListener('change', () => {
                    const f = zipInput.files && zipInput.files[0] ? zipInput.files[0] : null;
                    if (!f) return;
                    this._qmsZipFile = f;
                    if (zipMsgEl) { zipMsgEl.textContent = `✅ 已选择 ZIP：${f.name}（${Math.round((f.size || 0) / 1024)} KB）`; zipMsgEl.style.color = '#52c41a'; }
                    zipInput.value = '';
                });
            }
            if (zipClearBtn) {
                zipClearBtn.addEventListener('click', () => {
                    this._qmsZipFile = null;
                    if (zipMsgEl) { zipMsgEl.textContent = '已清空 ZIP（将跳过用例上传）'; zipMsgEl.style.color = '#999'; }
                });
            }
            qmsPanel.style.display = 'block';
            if (qmsBtn) {
                qmsBtn.style.color = '#1890ff';
                qmsBtn.style.borderBottomColor = '#1890ff';
            }
        } else if (tab === 'dify' && difyPanel) {
            difyPanel.innerHTML = this.renderDifyPanel();
            const saveBtn = document.getElementById('admin-dify-save-btn');
            if (saveBtn) saveBtn.addEventListener('click', () => this.saveDifyConfig());
            
            difyPanel.style.display = 'block';
            if (difyBtn) {
                difyBtn.style.color = '#1890ff';
                difyBtn.style.borderBottomColor = '#1890ff';
            }
        }
    }

    async adminQmsDraftAdd() {
        const btn = document.getElementById('admin-qms-draft-send');
        const errEl = document.getElementById('admin-qms-draft-error');
        const qidEl = document.getElementById('admin-qms-draft-qid');
        const payloadEl = document.getElementById('admin-qms-draft-payload');
        const headersEl = document.getElementById('admin-qms-draft-headers');
        const resultEl = document.getElementById('admin-qms-draft-result');
        if (!btn || !errEl || !payloadEl || !resultEl) return;

        errEl.style.display = 'none';
        if (qidEl) { qidEl.style.display = 'none'; qidEl.textContent = ''; }

        // payload 由录题 JSON 映射生成（页面上 pre 仅用于展示）
        const imported = (() => {
            try { return JSON.parse(localStorage.getItem('tracker_qms_problem_json') || ''); } catch (_) { return null; }
        })();
        const payload = this.buildQmsDraftAddPayload(imported);

        let extraHeaders = {};
        let rawHeaders = headersEl ? String(headersEl.value || '').trim() : '';
        // 若用户没填，则尝试使用上次保存的 headers（避免每次复制）
        if (!rawHeaders) {
            try { rawHeaders = (localStorage.getItem('admin_qms_draft_headers') || '').trim(); } catch (_) {}
        }
        if (rawHeaders) {
            try {
                // 先尝试 JSON；失败则按 Raw headers 解析（Key: Value 每行）
                if (rawHeaders.startsWith('{')) {
                    const obj = JSON.parse(rawHeaders);
                    if (obj && typeof obj === 'object') extraHeaders = obj;
                } else {
                    extraHeaders = this.parseRawHeaders(rawHeaders);
                }
            } catch (e) {
                errEl.textContent = '自定义 Headers 解析失败：支持 JSON 或每行 "Key: Value" 的 Raw 文本';
                errEl.style.display = 'block';
                return;
            }
        }

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '发送中...';
        resultEl.textContent = '请求中...';

        try {
            // 注：ApiService 内部会自动从 localStorage 取一些可能的 token/csrf/verify 头；
            // 这里的 extraHeaders 用于人工兜底覆盖。
            const resp = await this.apiService.adminQmsDraftAdd({ ...payload, __tracker_extra_headers: extraHeaders });
            this.qmsDraftLastResult = resp;

            const raw = resp.text || (resp.json ? JSON.stringify(resp.json, null, 2) : '');
            resultEl.textContent = `HTTP ${resp.status}\n\n` + (raw || '（空响应）');

            // Extract qid in a tolerant way
            const j = resp.json;
            const cand = (() => {
                // most common: data is ["11610849"]
                if (j && Array.isArray(j.data) && j.data.length > 0) return String(j.data[0]);
                if (j && j.data && Array.isArray(j.data.data) && j.data.data.length > 0) return String(j.data.data[0]);
                return [
                    j && j.qid,
                    j && j.data && j.data.qid,
                    j && j.data && j.data.questionId,
                    j && j.data && j.data.id
                ].find(v => v !== undefined && v !== null && String(v) !== '');
            })();
            if (qidEl) {
                if (cand != null) {
                    qidEl.textContent = `✅ 解析到 qid：${cand}`;
                    try { localStorage.setItem('tracker_qms_last_qid', String(cand)); } catch (_) {}
                    // 即时刷新面板上的“当前缓存 qid”与 update payload 预览
                    try {
                        const qid2 = document.getElementById('admin-qms-draft-qid2');
                        if (qid2) qid2.innerHTML = `当前缓存 qid：<b>${String(cand)}</b>`;
                        const imported = (() => {
                            try { return JSON.parse(localStorage.getItem('tracker_qms_problem_json') || ''); } catch (_) { return null; }
                        })();
                        const upd = this.buildQmsDraftUpdatePayload(imported, String(cand));
                        const updEl = document.getElementById('admin-qms-draft-update-payload');
                        if (updEl) updEl.textContent = JSON.stringify(upd, null, 2);
                    } catch (_) {}
                } else {
                    const m = (j && (j.message || j.msg)) ? String(j.message || j.msg) : '';
                    if (String(cand) === '' && m.includes('客户端验证')) {
                        qidEl.textContent = '⚠️ 客户端验证错误：题库页面通常会带额外的校验 header（csrf/verify）。你可以从 Network 复制 Request Headers 粘到上面的框里再试。';
                    } else {
                        qidEl.textContent = '⚠️ 未解析到 qid：请看“响应（原样）”里字段名，并告诉我我再适配';
                    }
                }
                qidEl.style.display = 'block';
            }

            // 如果业务 code=0，视为成功：保存 headers（只要存在 rawHeaders）
            try {
                const okBiz = resp && resp.json && (resp.json.code === 0 || resp.json.code === 200);
                if (okBiz && rawHeaders) {
                    localStorage.setItem('admin_qms_draft_headers', rawHeaders);
                    const hint = document.getElementById('admin-qms-draft-headers-hint');
                    if (hint) hint.textContent = '已保存 headers：留空也可以直接发送。';
                }
            } catch (_) {}
        } catch (e) {
            const msg = e && e.message ? e.message : '发送失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '发送请求';
        }
    }

    async adminQmsDraftUpdate() {
        const btn = document.getElementById('admin-qms-draft-update');
        const errEl = document.getElementById('admin-qms-draft-error');
        const qidEl = document.getElementById('admin-qms-draft-qid');
        const headersEl = document.getElementById('admin-qms-draft-headers');
        const resultEl = document.getElementById('admin-qms-draft-result');
        if (!btn || !errEl || !resultEl) return;

        errEl.style.display = 'none';
        if (qidEl) { qidEl.style.display = 'none'; qidEl.textContent = ''; }

        const imported = (() => { try { return JSON.parse(localStorage.getItem('tracker_qms_problem_json') || ''); } catch (_) { return null; } })();
        const qid = (() => { try { return localStorage.getItem('tracker_qms_last_qid') || ''; } catch (_) { return ''; } })();
        if (!qid) {
            errEl.textContent = '请先创建草稿(add) 获取 qid，再进行 update';
            errEl.style.display = 'block';
            return;
        }
        const payload = this.buildQmsDraftUpdatePayload(imported, qid);

        let extraHeaders = {};
        let rawHeaders = headersEl ? String(headersEl.value || '').trim() : '';
        if (!rawHeaders) {
            try { rawHeaders = (localStorage.getItem('admin_qms_draft_headers') || '').trim(); } catch (_) {}
        }
        if (rawHeaders) {
            try {
                if (rawHeaders.startsWith('{')) {
                    const obj = JSON.parse(rawHeaders);
                    if (obj && typeof obj === 'object') extraHeaders = obj;
                } else {
                    extraHeaders = this.parseRawHeaders(rawHeaders);
                }
            } catch (_) {}
        }

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '更新中...';
        resultEl.textContent = '请求中...';

        try {
            const resp = await this.apiService.adminQmsDraftUpdate({ ...payload, __tracker_extra_headers: extraHeaders });
            const raw = resp.text || (resp.json ? JSON.stringify(resp.json, null, 2) : '');
            resultEl.textContent = `HTTP ${resp.status}\n\n` + (raw || '（空响应）');
            // 成功时缓存 headers
            try {
                const okBiz = resp && resp.json && (resp.json.code === 0 || resp.json.code === 200);
                if (okBiz && rawHeaders) localStorage.setItem('admin_qms_draft_headers', rawHeaders);
            } catch (_) {}
        } catch (e) {
            const msg = e && e.message ? e.message : '更新失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '更新草稿(update)';
        }
    }

    async adminQmsOneClick() {
        const btn = document.getElementById('admin-qms-oneclick');
        const errEl = document.getElementById('admin-qms-draft-error');
        const resultEl = document.getElementById('admin-qms-draft-result');
        const headersEl = document.getElementById('admin-qms-draft-headers');
        if (!btn || !errEl || !resultEl) return;
        errEl.style.display = 'none';

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '执行中...';
        const log = (s) => { resultEl.textContent = String(s || ''); };
        const step = (n, total, msg) => log(`进度：(${n}/${total}) ${msg}`);
        log('进度：准备开始...');

        // 复用 headers 解析/缓存逻辑：add -> update -> (zip) -> question -> review confirm -> open library
        try {
            // 解析 headers（若用户清空输入框，则回退使用已保存）
            let rawHeaders = headersEl ? String(headersEl.value || '').trim() : '';
            if (!rawHeaders) {
                try { rawHeaders = (localStorage.getItem('admin_qms_draft_headers') || '').trim(); } catch (_) {}
            }
            let extraHeaders = {};
            try {
                if (rawHeaders) {
                    if (rawHeaders.startsWith('{')) extraHeaders = JSON.parse(rawHeaders) || {};
                    else extraHeaders = this.parseRawHeaders(rawHeaders);
                }
            } catch (_) { extraHeaders = {}; }

            // 当前导入的录题 JSON
            const imported = (() => { try { return JSON.parse(localStorage.getItem('tracker_qms_problem_json') || ''); } catch (_) { return null; } })();

            // 1) add（拿 qid）
            step(1, 6, '创建草稿（add）');
            {
                const payload = this.buildQmsDraftAddPayload(imported);
                const resp = await this.apiService.adminQmsDraftAdd({ ...payload, __tracker_extra_headers: extraHeaders });
                const j = resp && resp.json ? resp.json : null;
                const qid = (j && Array.isArray(j.data) && j.data.length > 0) ? String(j.data[0]) : '';
                if (!resp.ok || !qid) throw new Error(`add 失败：HTTP ${resp.status}`);
                try { localStorage.setItem('tracker_qms_last_qid', qid); } catch (_) {}
                const qid2 = document.getElementById('admin-qms-draft-qid2');
                if (qid2) qid2.innerHTML = `当前缓存 qid：<b>${qid}</b>`;
                // 成功缓存 headers
                try { if (rawHeaders) localStorage.setItem('admin_qms_draft_headers', rawHeaders); } catch (_) {}
            }

            const qid = (() => { try { return localStorage.getItem('tracker_qms_last_qid') || ''; } catch (_) { return ''; } })();
            if (!qid) throw new Error('qid 丢失：add 未产出 qid');

            // 2) update（写入样例/IO 等）
            step(2, 6, '更新草稿（update）');
            {
                const payload = this.buildQmsDraftUpdatePayload(imported, qid);
                const resp = await this.apiService.adminQmsDraftUpdate({ ...payload, __tracker_extra_headers: extraHeaders });
                if (!resp.ok) throw new Error(`update 失败：HTTP ${resp.status}`);
            }

            // 3) upload cases（可选）
            if (this._qmsZipFile) {
                step(3, 6, `上传用例（${this._qmsZipFile.name}）`);
                await this.adminQmsUploadCasesZipAndUpdate();
            } else {
                step(3, 6, '上传用例（未选择，跳过）');
            }

            // 4) question（最终提交）
            step(4, 6, '最终提交（question）');
            {
                const payload = this.buildQmsQuestionPayload(imported, qid);
                const resp = await this.apiService.adminQmsQuestionUpsert({ ...payload, __tracker_extra_headers: extraHeaders });
                if (!resp.ok) throw new Error(`question 失败：HTTP ${resp.status}`);
            }

            // 5) review confirm（审题）
            step(5, 6, '审题确认（review/confirm）');
            {
                const nextResp = await this.apiService.adminQmsReviewNextQuestion({ curQid: [String(qid)], scene: 1, __tracker_extra_headers: extraHeaders });
                const snap = nextResp && nextResp.json && nextResp.json.data ? nextResp.json.data : null;
                if (!nextResp.ok || !snap || !snap.id) throw new Error(`next-question 失败：HTTP ${nextResp.status}`);
                const question = this._normalizeReviewQuestionFromSnapshot(snap);
                const confirmResp = await this.apiService.adminQmsReviewConfirm({ question, type: 1, __tracker_extra_headers: extraHeaders });
                if (!confirmResp.ok) throw new Error(`review/confirm 失败：HTTP ${confirmResp.status}`);
            }

            // 6) open-library/save（开放范围）
            step(6, 6, '设置开放范围（open-library/save）');
            {
                // 只保留必要功能：这里用本地默认/缓存配置，不再暴露复杂 UI
                let type = 1;
                let ids = ['391696'];
                let scopes = [1, 3];
                try {
                    const t = Number(localStorage.getItem('tracker_qms_open_library_type') || 1) || 1;
                    const idsStr = String(localStorage.getItem('tracker_qms_open_library_ids') || '391696');
                    const scopesStr = String(localStorage.getItem('tracker_qms_open_library_scopes') || '1,3');
                    type = t;
                    ids = idsStr.split(',').map(s => s.trim()).filter(Boolean);
                    scopes = scopesStr.split(',').map(s => s.trim()).filter(Boolean).map(x => Number(x)).filter(x => Number.isFinite(x));
                    if (!ids.length) ids = ['391696'];
                    if (!scopes.length) scopes = [1, 3];
                } catch (_) {}
                const resp = await this.apiService.adminQmsQuestionOpenLibrarySave({ questionId: String(qid), type, ids, openScopes: scopes, __tracker_extra_headers: extraHeaders });
                if (!resp.ok) throw new Error(`open-library/save 失败：HTTP ${resp.status}`);
            }

            log('✅ 一键录题完成（已提交 + 已审题 + 已设置开放范围）');
        } catch (e) {
            const msg = e && e.message ? e.message : '一键录题失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            log(`❌ 失败：${msg}`);
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '一键录题';
        }
    }

    async adminQmsUploadZipOnly() {
        const btn = document.getElementById('admin-qms-upload-zip');
        const errEl = document.getElementById('admin-qms-draft-error');
        const resultEl = document.getElementById('admin-qms-draft-result');
        if (!btn || !errEl || !resultEl) return;
        errEl.style.display = 'none';

        if (!this._qmsZipFile) {
            errEl.textContent = '请先选择 ZIP（cases.zip）';
            errEl.style.display = 'block';
            return;
        }
        const qid = (() => { try { return localStorage.getItem('tracker_qms_last_qid') || ''; } catch (_) { return ''; } })();
        if (!qid) {
            errEl.textContent = '请先创建草稿(add) 获取 qid，再上传 ZIP';
            errEl.style.display = 'block';
            return;
        }

        const old = btn.textContent;
        btn.disabled = true;
        btn.textContent = '上传中...';
        resultEl.textContent = `仅上传 ZIP：${this._qmsZipFile.name}\n`;
        try {
            await this.adminQmsUploadCasesZipAndUpdate();
            resultEl.textContent += '\n✅ ZIP 上传并回填完成\n';
        } catch (e) {
            const msg = e && e.message ? e.message : '上传失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent += `\n❌ 上传失败：${msg}\n`;
        } finally {
            btn.disabled = false;
            btn.textContent = old || '仅上传 ZIP';
        }
    }

    // ===== Step3: upload cases.zip -> async -> status -> draft/update =====
    async adminQmsUploadCasesZipAndUpdate() {
        const errEl = document.getElementById('admin-qms-draft-error');
        const resultEl = document.getElementById('admin-qms-draft-result');
        if (!errEl || !resultEl) return;
        errEl.style.display = 'none';

        const zip = this._qmsZipFile;
        if (!zip) return;

        const imported = (() => { try { return JSON.parse(localStorage.getItem('tracker_qms_problem_json') || ''); } catch (_) { return null; } })();
        const qid = (() => { try { return localStorage.getItem('tracker_qms_last_qid') || ''; } catch (_) { return ''; } })();
        if (!qid) throw new Error('缺少 qid：请先执行 add');

        // headers：沿用已保存的“客户端验证 headers”（重点是 Authorization）
        const headersEl = document.getElementById('admin-qms-draft-headers');
        let rawHeaders = headersEl ? String(headersEl.value || '').trim() : '';
        if (!rawHeaders) {
            try { rawHeaders = (localStorage.getItem('admin_qms_draft_headers') || '').trim(); } catch (_) {}
        }
        let extraHeaders = {};
        try {
            if (rawHeaders) {
                if (rawHeaders.startsWith('{')) extraHeaders = JSON.parse(rawHeaders) || {};
                else extraHeaders = this.parseRawHeaders(rawHeaders);
            }
        } catch (_) { extraHeaders = {}; }

        // 1) credential
        resultEl.textContent = '用例上传：获取 credential...';
        const credResp = await this.apiService.adminQmsTestcaseCredential(0, extraHeaders);
        const credJson = credResp && credResp.json ? credResp.json : null;
        const credData = credJson && credJson.data ? credJson.data : null;
        if (!credResp.ok || !credData || !credData.accessKeyId) {
            const u = credResp && credResp.url ? ` url=${credResp.url}` : '';
            throw new Error(`credential 失败：HTTP ${credResp.status}${u} ${credResp.text || ''}`);
        }

        // 2) upload zip to OSS via OSS SDK (browser)
        const oss = await this.ensureAliyunOssSdk();
        const bucket = String(credData.bucket || '').trim();
        // credData.endpoints 观测到形态： "https://nowcoder.oss-accelerate.aliyuncs.com"
        // ali-oss SDK 会自动把 bucket 前缀拼到 endpoint host 前面，因此这里必须去掉协议 + 去掉可能重复的 bucket 前缀，
        // 否则会变成 nowcoder.nowcoder.oss-accelerate.aliyuncs.com 导致签名/跨域失败。
        const endpointHost = (() => {
            let ep = String(credData.endpoints || '').trim();
            ep = ep.replace(/^https?:\/\//i, '');
            ep = ep.replace(/\/+$/g, '');
            if (bucket && ep.toLowerCase().startsWith((bucket + '.').toLowerCase())) {
                ep = ep.slice(bucket.length + 1);
            }
            return ep;
        })();
        const path = String(credData.path || 'front_upload').replace(/^\//, '').replace(/\/$/, '');
        const rand = Math.random().toString(36).slice(2, 14).toUpperCase();
        const objectKey = `${path}/${Date.now()}_${rand}.zip`;
        const uploadUrl = `https://uploadfiles.nowcoder.com/${objectKey}`;

        resultEl.textContent = `用例上传：上传 zip 到 OSS...\nendpoint=${endpointHost}\nbucket=${bucket}\nobjectKey=${objectKey}\n`;
        const client = new oss({
            accessKeyId: credData.accessKeyId,
            accessKeySecret: credData.accessKeySecret,
            stsToken: credData.securityToken,
            bucket,
            endpoint: endpointHost,
            secure: true
        });
        // put(file) 走 PUT + 签名 + x-oss-security-token
        await client.put(objectKey, zip, { headers: { 'Content-Type': 'application/zip' } });

        // 3) async (notify backend)
        resultEl.textContent = `用例上传：触发 async...\ndataFileUrl=${uploadUrl}\n`;
        const setting = {
            autoDeleteSpace: !!(imported?.coding?.setting?.autoDeleteSpace),
            deleteBlankLine: !!(imported?.coding?.setting?.deleteBlankLine),
            noSamples: !!(imported?.coding?.noSamples),
            floatAccuracyDigit: Number(imported?.coding?.floatAccuracyDigit || 0)
        };
        const asyncPayload = {
            dataFileUrl: uploadUrl,
            type: Number(imported?.basic?.type || imported?.type || 10),
            cases: [],
            setting
        };
        const asyncResp = await this.apiService.adminQmsTestcaseUploadAsync(asyncPayload, extraHeaders);
        const asyncJson = asyncResp && asyncResp.json ? asyncResp.json : null;
        const taskId = asyncJson && asyncJson.data ? String(asyncJson.data) : '';
        if (!asyncResp.ok || !taskId) {
            const u = asyncResp && asyncResp.url ? ` url=${asyncResp.url}` : '';
            throw new Error(`async 失败：HTTP ${asyncResp.status}${u} ${asyncResp.text || ''}`);
        }

        // 4) status polling
        resultEl.textContent = `用例上传：轮询 status...\ntaskId=${taskId}\n`;
        let finalResult = null;
        for (let i = 0; i < 60; i++) {
            const st = await this.apiService.adminQmsTestcaseUploadStatus(taskId, extraHeaders);
            const sj = st && st.json ? st.json : null;
            const d = sj && sj.data ? sj.data : null;
            const status = d && d.status != null ? Number(d.status) : -1;
            const msg = d && d.message ? String(d.message) : '';
            const prog = d && d.progress != null ? Number(d.progress) : 0;
            const tried = Array.isArray(st?.tried) && st.tried.length
                ? ('\ntried:\n' + st.tried.map(x => `- ${x.status} ${x.url}`).join('\n') + '\n')
                : '';
            resultEl.textContent = `用例上传：轮询 status...\ntaskId=${taskId}\nstatus=${status} progress=${prog}\n${msg}\n${tried}`;
            if (status === 2 && d && d.result) { finalResult = d.result; break; }
            await new Promise(r => setTimeout(r, 1000));
        }
        if (!finalResult) throw new Error('status 轮询超时/未成功');

        // 5) draft/update 回填（dataFileUrl/caseCount）
        const finalDataFileUrl = String(finalResult.dataFileUrl || '').trim();
        const caseCount = Number(finalResult.caseCount || 0);
        // 缓存回填信息，便于后续 /qms/question 自动组装（仅与用例 zip 相关字段）
        // 注意：checker 文件名必须以“导入的 source.zip / problem.json”为准，不能从上传用例接口结果里缓存兜底。
        // 否则会出现：本次没有 checker 也被自动回填成 checker.cc，导致提交后评测找不到文件而报错。
        try {
            if (finalDataFileUrl) localStorage.setItem('tracker_qms_last_dataFileUrl', finalDataFileUrl);
            if (!Number.isNaN(caseCount)) localStorage.setItem('tracker_qms_last_caseCount', String(caseCount));
        } catch (_) {}
        resultEl.textContent = `用例上传成功：回填 draft/update...\nfinalDataFileUrl=${finalDataFileUrl}\ncaseCount=${caseCount}\n`;

        const updPayload = this.buildQmsDraftUpdatePayload(imported, qid, {
            dataFileUrl: finalDataFileUrl,
            caseCount
        });
        const updResp = await this.apiService.adminQmsDraftUpdate({ ...updPayload, __tracker_extra_headers: extraHeaders });
        resultEl.textContent = `draft/update 回填结果：HTTP ${updResp.status}\n\n${updResp.text || ''}`;
    }

    async ensureAliyunOssSdk() {
        if (typeof window !== 'undefined' && window.OSS) return window.OSS;
        const src = 'https://static.nowcoder.com/lib/aliyun-oss-sdk-6.17.0.min.js';
        await new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('OSS SDK load error')));
                // if already loaded
                if (window.OSS) resolve();
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('OSS SDK load error'));
            document.head.appendChild(s);
        });
        if (!window.OSS) throw new Error('OSS SDK 未加载');
        return window.OSS;
    }

    async ensureJsZip() {
        if (typeof window !== 'undefined' && window.JSZip) return window.JSZip;
        // CDN：jszip（UMD，挂到 window.JSZip）。不同环境可能对某些域名不可达，因此做多候选兜底。
        const candidates = [
            'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
            'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
            'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js'
        ];

        const loadOne = (src) => new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error(`JSZip load error: ${src}`)));
                if (window.JSZip) resolve();
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error(`JSZip load error: ${src}`));
            document.head.appendChild(s);
        });

        let lastErr = null;
        for (const src of candidates) {
            try {
                await loadOne(src);
                if (window.JSZip) return window.JSZip;
            } catch (e) {
                lastErr = e;
            }
        }
        const msg = lastErr && lastErr.message ? lastErr.message : 'JSZip load error';
        throw new Error(msg);
    }

    async adminQmsParseSourceZip(file) {
        const JSZip = await this.ensureJsZip();
        this._qmsSourceZipFile = file || null;
        const buf = await (file && file.arrayBuffer ? file.arrayBuffer() : Promise.reject(new Error('无法读取文件')));
        const zip = await JSZip.loadAsync(buf);

        // 寻找 problem.json（优先固定名，其次任意 .json）
        const entries = Object.keys(zip.files || {});
        const pickBy = (re) => entries.find(name => re.test(String(name || '')));
        const jsonName = pickBy(/(^|\/)problem\.json$/i) || pickBy(/\.json$/i) || '';
        const dataZipName = pickBy(/(^|\/)data\.zip$/i) || pickBy(/(^|\/)cases\.zip$/i) || '';

        // 从 source.zip（以及可能的内层 cases.zip/data.zip）探测 checker 文件名（以 zip 内容为准）
        // 约定：优先匹配根目录的 checker.*，其次任意目录下的 checker.*
        const baseName = (p) => String(p || '').split('/').pop() || '';
        const checkerExtPriority = ['cc', 'cpp', 'cxx', 'c', 'py', 'java', 'js', 'ts', 'go', 'rs'];
        const checkerRe = /(^|\/)checker\.(cc|cpp|cxx|c|py|java|js|ts|go|rs)$/i;
        const pickCheckerFromZip = (z) => {
            const names = Object.keys(z?.files || {});
            const isFile = (name) => {
                try { return !!(z.files && z.files[name] && !z.files[name].dir); } catch (_) { return false; }
            };
            const checkerCandidates = names.filter(n => checkerRe.test(String(n || '')) && isFile(n));
            if (!checkerCandidates.length) return '';
            const score = (n) => {
                const b = baseName(n).toLowerCase();
                const ext = b.split('.').pop() || '';
                const extRank = checkerExtPriority.indexOf(ext);
                const depth = String(n || '').split('/').length; // root: 1
                return (depth * 100) + (extRank >= 0 ? extRank : 99);
            };
            const best = checkerCandidates.slice().sort((a, b) => score(a) - score(b))[0];
            return baseName(best);
        };

        // 先在外层 source.zip 找 checker；若没找到且存在 cases.zip/data.zip，则尝试解内层 zip 再找
        let checkerNameInZip = pickCheckerFromZip(zip);
        if (!checkerNameInZip && dataZipName) {
            try {
                const innerBuf = await zip.file(dataZipName).async('arraybuffer');
                const innerZip = await JSZip.loadAsync(innerBuf);
                checkerNameInZip = pickCheckerFromZip(innerZip);
            } catch (_) {
                // ignore：内层 zip 无法读取/不是 zip/损坏等，保持空字符串
            }
        }

        let problemTitle = '';
        if (jsonName) {
            const jsonText = await zip.file(jsonName).async('string');
            const obj = JSON.parse(jsonText);
            // minimal validation
            const title = obj?.basic?.title || obj?.title;
            const content = obj?.statement?.content || obj?.content;
            if (!title || !content) throw new Error('problem.json 缺少必要字段：basic.title 与 statement.content（或 title/content）');
            // 关键：checker 文件名必须与 source.zip 内容一致；若 zip 不含 checker，则强制清空（避免误用历史值导致提交后找不到 checker 文件）
            try {
                const next = { ...(obj || {}) };
                // 兼容两种字段形态：顶层 codingCheckerFileName / coding.checkerFileName
                if (checkerNameInZip) {
                    next.codingCheckerFileName = checkerNameInZip;
                    next.coding = { ...(next.coding || {}), checkerFileName: checkerNameInZip };
                } else {
                    next.codingCheckerFileName = '';
                    next.coding = { ...(next.coding || {}), checkerFileName: '' };
                }
                localStorage.setItem('tracker_qms_problem_json', JSON.stringify(next));
            } catch (_) {}
            problemTitle = String(title || '');
        }

        let dataZipFile = null;
        let dataZipSize = 0;
        if (dataZipName) {
            const blob = await zip.file(dataZipName).async('blob');
            dataZipSize = blob && blob.size ? blob.size : 0;
            // 注入到现有链路：作为 cases.zip 上传
            try {
                dataZipFile = new File([blob], 'data.zip', { type: 'application/zip' });
            } catch (_) {
                // 兼容旧浏览器：退化为 Blob + name
                dataZipFile = blob;
                dataZipFile.name = 'data.zip';
            }
            this._qmsZipFile = dataZipFile;
        }

        return {
            jsonName,
            problemTitle,
            dataZipName,
            dataZipSize,
            checkerFileName: checkerNameInZip
        };
    }

    // ===== Step4? (实验)：直接调用 /qms/question =====
    adminQmsQuestionSaveBody() {
        const ta = document.getElementById('admin-qms-question-body');
        const errEl = document.getElementById('admin-qms-draft-error');
        if (!ta) return;
        const s = String(ta.value || '').trim();
        try { localStorage.setItem('tracker_qms_question_body', s); } catch (_) {}
        if (errEl) { errEl.textContent = s ? '✅ 已保存 question request（localStorage）' : '已清空保存的 question request'; errEl.style.display = 'block'; errEl.style.color = s ? '#52c41a' : '#999'; }
    }

    adminQmsQuestionClearBody() {
        const ta = document.getElementById('admin-qms-question-body');
        const errEl = document.getElementById('admin-qms-draft-error');
        if (ta) ta.value = '';
        try { localStorage.removeItem('tracker_qms_question_body'); } catch (_) {}
        if (errEl) { errEl.textContent = '已清空 question request'; errEl.style.display = 'block'; errEl.style.color = '#999'; }
    }

    async adminQmsQuestionUpsert() {
        const btn = document.getElementById('admin-qms-question-send-btn');
        const errEl = document.getElementById('admin-qms-draft-error');
        const resultEl = document.getElementById('admin-qms-draft-result');
        const headersEl = document.getElementById('admin-qms-draft-headers');
        const bodyEl = document.getElementById('admin-qms-question-body');
        if (!btn || !errEl || !resultEl || !bodyEl) return;
        errEl.style.display = 'none';
        errEl.style.color = '#ff4d4f';

        const raw = String(bodyEl.value || '').trim();
        if (!raw) {
            errEl.textContent = '请先在“最终提交（question 接口请求体）”里粘贴 request JSON';
            errEl.style.display = 'block';
            return;
        }

        let body = null;
        try { body = JSON.parse(raw); } catch (e) {
            errEl.textContent = 'question request 不是合法 JSON：请直接粘贴 Network 里 Request 的 JSON';
            errEl.style.display = 'block';
            return;
        }

        // headers：沿用已保存的“客户端验证 headers”（重点是 Authorization）
        let rawHeaders = headersEl ? String(headersEl.value || '').trim() : '';
        if (!rawHeaders) {
            try { rawHeaders = (localStorage.getItem('admin_qms_draft_headers') || '').trim(); } catch (_) {}
        }
        let extraHeaders = {};
        try {
            if (rawHeaders) {
                if (rawHeaders.startsWith('{')) extraHeaders = JSON.parse(rawHeaders) || {};
                else extraHeaders = this.parseRawHeaders(rawHeaders);
            }
        } catch (_) { extraHeaders = {}; }

        const old = btn.textContent;
        btn.disabled = true;
        btn.textContent = '调用中...';
        resultEl.textContent = '调用 /qms/question...\n';
        try {
            const resp = await this.apiService.adminQmsQuestionUpsert({ ...(body || {}), __tracker_extra_headers: extraHeaders });
            resultEl.textContent = `question 结果：HTTP ${resp.status}\nurl=${resp.url || ''}\n\n${resp.text || ''}`;
            if (resp.ok && resp.json && (resp.json.code === 0 || resp.json.code === 200)) {
                try { localStorage.setItem('tracker_qms_question_body', JSON.stringify(body, null, 2)); } catch (_) {}
            }
        } catch (e) {
            const msg = e && e.message ? e.message : 'question 调用失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent += `\n❌ question 调用失败：${msg}\n`;
        } finally {
            btn.disabled = false;
            btn.textContent = old || '调用 question';
        }
    }

    async adminQmsQuestionAuto() {
        const btn = document.getElementById('admin-qms-question-auto-btn');
        const errEl = document.getElementById('admin-qms-draft-error');
        const resultEl = document.getElementById('admin-qms-draft-result');
        const headersEl = document.getElementById('admin-qms-draft-headers');
        if (!btn || !errEl || !resultEl) return;
        errEl.style.display = 'none';
        errEl.style.color = '#ff4d4f';

        const imported = (() => { try { return JSON.parse(localStorage.getItem('tracker_qms_problem_json') || ''); } catch (_) { return null; } })();
        const qid = (() => { try { return localStorage.getItem('tracker_qms_last_qid') || ''; } catch (_) { return ''; } })();
        if (!qid) {
            errEl.textContent = '缺少 qid：请先创建草稿(add)';
            errEl.style.display = 'block';
            return;
        }
        const payload = this.buildQmsQuestionPayload(imported, qid);

        // headers：沿用已保存的“客户端验证 headers”（重点是 Authorization）
        let rawHeaders = headersEl ? String(headersEl.value || '').trim() : '';
        if (!rawHeaders) {
            try { rawHeaders = (localStorage.getItem('admin_qms_draft_headers') || '').trim(); } catch (_) {}
        }
        let extraHeaders = {};
        try {
            if (rawHeaders) {
                if (rawHeaders.startsWith('{')) extraHeaders = JSON.parse(rawHeaders) || {};
                else extraHeaders = this.parseRawHeaders(rawHeaders);
            }
        } catch (_) { extraHeaders = {}; }

        const old = btn.textContent;
        btn.disabled = true;
        btn.textContent = '提交中...';
        resultEl.textContent = '最终提交 /qms/question...\n';
        try {
            const resp = await this.apiService.adminQmsQuestionUpsert({ ...payload, __tracker_extra_headers: extraHeaders });
            resultEl.textContent = `question(auto) 结果：HTTP ${resp.status}\nurl=${resp.url || ''}\n\n${resp.text || ''}`;
            // 成功后刷新预览（可能需要把返回 id 再写回）
            try {
                const okBiz = resp && resp.json && (resp.json.code === 0 || resp.json.code === 200);
                if (okBiz && resp.json && resp.json.data) {
                    const id = String(resp.json.data);
                    localStorage.setItem('tracker_qms_last_qid', id);
                    const qid2 = document.getElementById('admin-qms-draft-qid2');
                    if (qid2) qid2.innerHTML = `当前缓存 qid：<b>${id}</b>`;
                }
            } catch (_) {}
        } catch (e) {
            const msg = e && e.message ? e.message : 'question(auto) 调用失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent += `\n❌ ${msg}\n`;
        } finally {
            btn.disabled = false;
            btn.textContent = old || '最终提交(question)';
        }
    }

    _normalizeReviewQuestionFromSnapshot(q) {
        const src = (q && typeof q === 'object') ? q : {};
        const out = { ...src };

        // 你确认：isEditStatus/hasQuestionChange 填 false 即可
        out.isEditStatus = false;
        out.hasQuestionChange = false;

        // 标准程序（可先空着试）：建议用 [] 而不是 null/缺省
        if (!Array.isArray(out.codingStandardSubmissionIds)) out.codingStandardSubmissionIds = [];

        // skills/previewSkills：next-question 可能返回对象数组；confirm 侧更常见是 id 数组。这里做一次归一化。
        const toIdArray = (arr) => {
            if (!Array.isArray(arr)) return arr;
            if (arr.length === 0) return arr;
            if (typeof arr[0] === 'string' || typeof arr[0] === 'number') return arr.map(x => String(x));
            return arr
                .map(x => (x && (x.id != null)) ? String(x.id) : '')
                .filter(Boolean);
        };
        out.skills = toIdArray(out.skills);
        out.previewSkills = toIdArray(out.previewSkills);

        return out;
    }

    async adminQmsReviewConfirm() {
        const btn = document.getElementById('admin-qms-review-confirm-btn');
        const errEl = document.getElementById('admin-qms-draft-error');
        const resultEl = document.getElementById('admin-qms-draft-result');
        const headersEl = document.getElementById('admin-qms-draft-headers');
        if (!btn || !errEl || !resultEl) return;
        errEl.style.display = 'none';
        errEl.style.color = '#ff4d4f';

        const qid = (() => { try { return localStorage.getItem('tracker_qms_last_qid') || ''; } catch (_) { return ''; } })();
        if (!qid) {
            errEl.textContent = '缺少 qid：请先完成录题（至少创建草稿/最终提交）';
            errEl.style.display = 'block';
            return;
        }

        // headers：沿用已保存的“客户端验证 headers”
        let rawHeaders = headersEl ? String(headersEl.value || '').trim() : '';
        if (!rawHeaders) {
            try { rawHeaders = (localStorage.getItem('admin_qms_draft_headers') || '').trim(); } catch (_) {}
        }
        let extraHeaders = {};
        try {
            if (rawHeaders) {
                if (rawHeaders.startsWith('{')) extraHeaders = JSON.parse(rawHeaders) || {};
                else extraHeaders = this.parseRawHeaders(rawHeaders);
            }
        } catch (_) { extraHeaders = {}; }

        const old = btn.textContent;
        btn.disabled = true;
        btn.textContent = '审题中...';
        resultEl.textContent = '审题(confirm)：\n';
        try {
            // 1) next-question：拿到完整 question 快照
            resultEl.textContent += `\n[1/2] review/next-question... qid=${qid}\n`;
            const nextResp = await this.apiService.adminQmsReviewNextQuestion({ curQid: [String(qid)], scene: 1, __tracker_extra_headers: extraHeaders });
            const nextJson = nextResp && nextResp.json ? nextResp.json : null;
            const snap = nextJson && nextJson.data ? nextJson.data : null;
            if (!nextResp.ok || !snap || !snap.id) {
                throw new Error(`next-question 失败：HTTP ${nextResp.status} url=${nextResp.url || ''}`);
            }

            // 2) confirm：按你粘贴的格式 {question:{...}, type:1}
            const question = this._normalizeReviewQuestionFromSnapshot(snap);
            const payload = { question, type: 1 };
            resultEl.textContent += `\n[2/2] review/confirm...\n`;
            const confirmResp = await this.apiService.adminQmsReviewConfirm({ ...payload, __tracker_extra_headers: extraHeaders });
            resultEl.textContent += `\nconfirm 结果：HTTP ${confirmResp.status}\nurl=${confirmResp.url || ''}\n\n${confirmResp.text || ''}\n`;
        } catch (e) {
            const msg = e && e.message ? e.message : '审题失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent += `\n❌ ${msg}\n`;
        } finally {
            btn.disabled = false;
            btn.textContent = old || '审题(confirm)';
        }
    }

    async adminQmsOpenLibrarySave() {
        const btn = document.getElementById('admin-qms-open-library-save-btn');
        const errEl = document.getElementById('admin-qms-draft-error');
        const resultEl = document.getElementById('admin-qms-draft-result');
        const headersEl = document.getElementById('admin-qms-draft-headers');
        if (!btn || !errEl || !resultEl) return;
        errEl.style.display = 'none';
        errEl.style.color = '#ff4d4f';

        const qid = (() => { try { return localStorage.getItem('tracker_qms_last_qid') || ''; } catch (_) { return ''; } })();
        if (!qid) {
            errEl.textContent = '缺少 qid：请先完成录题（至少创建草稿/最终提交）';
            errEl.style.display = 'block';
            return;
        }

        const typeEl = document.getElementById('admin-qms-open-library-type');
        const idsEl = document.getElementById('admin-qms-open-library-ids');
        const scopesEl = document.getElementById('admin-qms-open-library-scopes');
        const type = Number(typeEl ? typeEl.value : 1) || 1;
        const ids = String(idsEl ? idsEl.value : '').split(',').map(s => s.trim()).filter(Boolean);
        const openScopes = String(scopesEl ? scopesEl.value : '').split(',').map(s => s.trim()).filter(Boolean).map(x => Number(x)).filter(x => Number.isFinite(x));
        if (!ids.length) {
            errEl.textContent = 'ids 不能为空（例如：391696）';
            errEl.style.display = 'block';
            return;
        }
        if (!openScopes.length) {
            errEl.textContent = 'openScopes 不能为空（例如：1,3）';
            errEl.style.display = 'block';
            return;
        }

        // headers：沿用已保存的“客户端验证 headers”
        let rawHeaders = headersEl ? String(headersEl.value || '').trim() : '';
        if (!rawHeaders) {
            try { rawHeaders = (localStorage.getItem('admin_qms_draft_headers') || '').trim(); } catch (_) {}
        }
        let extraHeaders = {};
        try {
            if (rawHeaders) {
                if (rawHeaders.startsWith('{')) extraHeaders = JSON.parse(rawHeaders) || {};
                else extraHeaders = this.parseRawHeaders(rawHeaders);
            }
        } catch (_) { extraHeaders = {}; }

        // 保存输入便于复用
        try {
            localStorage.setItem('tracker_qms_open_library_type', String(type));
            localStorage.setItem('tracker_qms_open_library_ids', ids.join(','));
            localStorage.setItem('tracker_qms_open_library_scopes', openScopes.join(','));
        } catch (_) {}

        const payload = { questionId: String(qid), type, ids, openScopes };

        const old = btn.textContent;
        btn.disabled = true;
        btn.textContent = '保存中...';
        resultEl.textContent = `open-library/save...\n\n${JSON.stringify(payload, null, 2)}\n`;
        try {
            const resp = await this.apiService.adminQmsQuestionOpenLibrarySave({ ...payload, __tracker_extra_headers: extraHeaders });
            resultEl.textContent = `open-library/save 结果：HTTP ${resp.status}\nurl=${resp.url || ''}\n\n${resp.text || ''}`;
        } catch (e) {
            const msg = e && e.message ? e.message : '保存开放范围失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent += `\n❌ ${msg}\n`;
        } finally {
            btn.disabled = false;
            btn.textContent = old || '保存开放范围';
        }
    }

    bindEvents() {
        // 新结构：顶部业务域 + 左侧子栏目（点击后直接重渲染，避免漏隐藏/事件残留）
        const domains = this.getAdminDomains();
        for (const d of domains) {
            const btn = document.getElementById(`admin-domain-${d.id}`);
            if (!btn) continue;
            btn.addEventListener('click', () => {
                this.adminDomain = d.id;
                this.adminSection = d.sections[0]?.id || this.adminSection;
                this.render();
            });
            for (const s of d.sections) {
                const sbtn = document.getElementById(`admin-section-${d.id}-${s.id}`);
                if (!sbtn) continue;
                sbtn.addEventListener('click', () => {
                    this.adminDomain = d.id;
                    this.adminSection = s.id;
                    this.render();
                });
            }
        }

        // 每日一题操作
        const clockAddBtn = document.getElementById('admin-clock-add-btn');
        if (clockAddBtn) clockAddBtn.addEventListener('click', () => this.showClockModal());
        const clockSearchBtn = document.getElementById('admin-clock-search-btn');
        if (clockSearchBtn) clockSearchBtn.addEventListener('click', () => this.handleClockSearch());
        const clockResetBtn = document.getElementById('admin-clock-reset-btn');
        if (clockResetBtn) clockResetBtn.addEventListener('click', () => this.resetClockSearch());
        const clockFindBtn = document.getElementById('admin-clock-find-btn');
        if (clockFindBtn) clockFindBtn.addEventListener('click', () => this.handleClockFind());

        // 对战题目操作
        const battleAddBtn = document.getElementById('admin-battle-add-btn');
        if (battleAddBtn) battleAddBtn.addEventListener('click', () => this.showBattleModal());
        const battleBatchAddBtn = document.getElementById('admin-battle-batch-add-btn');
        if (battleBatchAddBtn) battleBatchAddBtn.addEventListener('click', () => this.showBattleBatchAddModal());
        const battleBatchDelBtn = document.getElementById('admin-battle-batch-delete-btn');
        if (battleBatchDelBtn) battleBatchDelBtn.addEventListener('click', () => this.handleBatchDelete());
        const battleSearchBtn = document.getElementById('admin-battle-search-btn');
        if (battleSearchBtn) battleSearchBtn.addEventListener('click', () => this.loadBattleList());
        const battleSearchByIdBtn = document.getElementById('admin-battle-search-by-id-btn');
        if (battleSearchByIdBtn) battleSearchByIdBtn.addEventListener('click', () => this.searchBattleByProblemId());

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

        // 直播课：一键导入空课程
        const lcPreviewBtn = document.getElementById('admin-livecourse-import-preview-btn');
        const lcSubmitBtn = document.getElementById('admin-livecourse-import-submit-btn');
        if (lcPreviewBtn) lcPreviewBtn.addEventListener('click', () => this.previewLivecourseImportOneEmptyCourse());
        if (lcSubmitBtn) lcSubmitBtn.addEventListener('click', () => this.submitLivecourseImportOneEmptyCourse());

        // acm_problem_open：重算 accept_person
        const rebuildBtn = document.getElementById('admin-acm-open-rebuild-run-btn');
        if (rebuildBtn) rebuildBtn.addEventListener('click', () => this.adminAcmOpenRebuildAcceptPerson());
        const rebuildStopBtn = document.getElementById('admin-acm-open-rebuild-stop-btn');
        if (rebuildStopBtn) rebuildStopBtn.addEventListener('click', () => { this._adminAcmOpenRebuildStop = true; });

        // 年度报告验数
        const yrBtn = document.getElementById('admin-year-report-fetch-btn');
        if (yrBtn) yrBtn.addEventListener('click', () => this.fetchAdminYearReport());

        // Redis Debug：查 key
        const redisDebugBtn = document.getElementById('admin-redis-debug-fetch-btn');
        if (redisDebugBtn) redisDebugBtn.addEventListener('click', () => this.fetchAdminRedisDebugKey());
        const redisCopyBtn = document.getElementById('admin-redis-debug-copy-btn');
        if (redisCopyBtn) {
            redisCopyBtn.addEventListener('click', async () => {
                try {
                    const text = JSON.stringify(this.adminRedisDebugLast || {}, null, 2);
                    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(text);
                        alert('已复制到剪贴板');
                    } else {
                        // 兜底：选中 pre 文本
                        const pre = document.getElementById('admin-redis-debug-result');
                        if (pre) {
                            const r = document.createRange();
                            r.selectNodeContents(pre);
                            const sel = window.getSelection();
                            sel.removeAllRanges();
                            sel.addRange(r);
                            document.execCommand('copy');
                            sel.removeAllRanges();
                            alert('已复制到剪贴板（兼容模式）');
                        } else {
                            alert('复制失败：找不到结果区');
                        }
                    }
                } catch (e) {
                    const msg = e && e.message ? e.message : '复制失败';
                    alert(msg);
                }
            });
        }

        // 过题排行榜：批量重建（Top N）
        const acceptRankRunBtn = document.getElementById('admin-accept-rank-rebuild-run-btn');
        if (acceptRankRunBtn) acceptRankRunBtn.addEventListener('click', () => this.adminAcceptRankRebuildTopN());
        const acceptRankStopBtn = document.getElementById('admin-accept-rank-rebuild-stop-btn');
        if (acceptRankStopBtn) acceptRankStopBtn.addEventListener('click', () => { this._adminAcceptRankRebuildStop = true; });

        // 成就补发：徽章 backfill
        const badgeRunBtn = document.getElementById('admin-badge-backfill-run-btn');
        if (badgeRunBtn) badgeRunBtn.addEventListener('click', () => this.adminBadgeBackfillRun());
        const badgeStopBtn = document.getElementById('admin-badge-backfill-stop-btn');
        if (badgeStopBtn) badgeStopBtn.addEventListener('click', () => { this._adminBadgeBackfillStop = true; });

        // 对战运维：清理某用户镜像
        const clearMirrorsBtn = document.getElementById('admin-clear-user-mirrors-btn');
        if (clearMirrorsBtn) clearMirrorsBtn.addEventListener('click', () => this.adminClearUserMirrors());

        // 对战运维：重建所有对战题 matchCount
        const rebuildMatchCountBtn = document.getElementById('admin-battle-rebuild-matchcount-btn');
        if (rebuildMatchCountBtn) rebuildMatchCountBtn.addEventListener('click', () => this.adminBattleRebuildMatchCount());

        // 2026 第三期大转盘：增加抽奖次数（管理员测试）
        const spring2026ThirdAddBtn = document.getElementById('admin-spring2026-third-chances-add-btn');
        if (spring2026ThirdAddBtn) spring2026ThirdAddBtn.addEventListener('click', () => this.adminSpring2026ThirdAddChances());
        const spring2026ThirdShareClaimedClearBtn = document.getElementById('admin-spring2026-third-share-claimed-clear-btn');
        if (spring2026ThirdShareClaimedClearBtn) spring2026ThirdShareClaimedClearBtn.addEventListener('click', () => this.adminClearSpring2026ThirdShareClaimed());

        // 刷新用户技能树进度
        const refreshChapterBtn = document.getElementById('admin-refresh-chapter-btn');
        if (refreshChapterBtn) refreshChapterBtn.addEventListener('click', () => this.adminRefreshUserChapterProgress());

        // 批量统计团队活动最终数据
        const teamStatsBtn = document.getElementById('admin-team-stats-btn');
        if (teamStatsBtn) teamStatsBtn.addEventListener('click', () => this.adminActivityTeamStatistics());

        // 复制统计结果 JSON
        const teamStatsCopyBtn = document.getElementById('admin-team-stats-copy-btn');
        if (teamStatsCopyBtn) {
            teamStatsCopyBtn.addEventListener('click', async () => {
                const resultEl = document.getElementById('admin-team-stats-result');
                if (!resultEl) return;
                
                const text = resultEl.innerText || resultEl.textContent;
                if (!text || text.trim() === '（尚未执行）') {
                    alert('暂无数据可复制');
                    return;
                }

                try {
                    await navigator.clipboard.writeText(text);
                    const originalText = teamStatsCopyBtn.innerHTML; // 保存原始 HTML（含 emoji）
                    teamStatsCopyBtn.textContent = '✅ 已复制';
                    setTimeout(() => { teamStatsCopyBtn.innerHTML = originalText; }, 2000);
                } catch (e) {
                    // 兜底：选中并提示手动复制
                    const range = document.createRange();
                    range.selectNodeContents(resultEl);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    try {
                        document.execCommand('copy');
                        alert('已尝试复制（兼容模式）。若失败，请手动 Ctrl+C。');
                    } catch (_) {
                        alert('复制失败，请手动复制');
                    }
                }
            });
        }

        // 2026 春季 AI 体验站：增加抽奖次数（管理员测试）
        const spring2026AiAddBtn = document.getElementById('admin-spring2026-ai-chances-add-btn');
        if (spring2026AiAddBtn) spring2026AiAddBtn.addEventListener('click', () => this.adminSpring2026AiAddChances());
        const spring2026AiRecordsBtn = document.getElementById('admin-spring2026-ai-records-fetch-btn');
        if (spring2026AiRecordsBtn) spring2026AiRecordsBtn.addEventListener('click', () => this.adminSpring2026AiFetchLotteryRecords());
        const clearFortuneRedisBtn = document.getElementById('admin-clear-spring2026-fortune-redis-btn');
        if (clearFortuneRedisBtn) clearFortuneRedisBtn.addEventListener('click', () => this.adminClearSpring2026FortuneRedis());
        const batchClearFortuneRedisBtn = document.getElementById('admin-batch-clear-spring2026-fortune-redis-btn');
        if (batchClearFortuneRedisBtn) batchClearFortuneRedisBtn.addEventListener('click', () => this.adminBatchClearSpring2026FortuneRedis());

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
        const contestRankPersistBtn = document.getElementById('admin-contest-rank-persist-direct-btn');
        const contestReratingBtn = document.getElementById('admin-contest-rerating-direct-btn');
        const contestPreviewBtn = document.getElementById('admin-contest-difficulty-preview-btn');
        const contestSubmitBtn = document.getElementById('admin-contest-difficulty-submit-btn');
        if (contestRankPersistBtn) contestRankPersistBtn.addEventListener('click', () => this.handleContestRankPersistDirect());
        if (contestReratingBtn) contestReratingBtn.addEventListener('click', () => this.handleContestReratingDirect());
        if (contestPreviewBtn) contestPreviewBtn.addEventListener('click', () => this.handleContestDifficultyPreview());
        if (contestSubmitBtn) contestSubmitBtn.addEventListener('click', () => this.handleContestDifficultySubmit());

        // Prompt Challenge demo
        const pcRefreshBtn = document.getElementById('pc-refresh-challenges');
        if (pcRefreshBtn) pcRefreshBtn.addEventListener('click', () => this.loadPromptChallengeList(true));
        const pcRunBtn = document.getElementById('pc-run');
        if (pcRunBtn) pcRunBtn.addEventListener('click', () => this.runPromptChallengeEvaluate());
        const aiPuzzleRefreshBtn = document.getElementById('admin-ai-puzzle-refresh-btn');
        if (aiPuzzleRefreshBtn) aiPuzzleRefreshBtn.addEventListener('click', () => this.loadAiPuzzleAdminOverview());

        // QMS 录题测试
        const qmsSendBtn = document.getElementById('admin-qms-draft-send');
        if (qmsSendBtn) qmsSendBtn.addEventListener('click', () => this.adminQmsDraftAdd());
        const qmsClearBtn = document.getElementById('admin-qms-draft-headers-clear');
        if (qmsClearBtn) {
            qmsClearBtn.addEventListener('click', () => {
                try { localStorage.removeItem('admin_qms_draft_headers'); } catch (_) {}
                const hint = document.getElementById('admin-qms-draft-headers-hint');
                if (hint) hint.textContent = '已清除保存的 headers。若再次出现“客户端验证错误”，请粘贴一次成功请求的 headers。';
                const ta = document.getElementById('admin-qms-draft-headers');
                if (ta) ta.value = '';
                alert('已清除本地保存的 headers');
            });
        }

        // Dify / 录题：补齐面板内部事件绑定（以前依赖 switchTab 的 innerHTML 重渲染）
        this.bindDifyPanelEventsIfPresent();
        this.bindQmsPanelEventsIfPresent();
        this.bindPuzzleRecordEventsIfPresent();
    }

    async fetchAdminRedisDebugKey() {
        const keyEl = document.getElementById('admin-redis-debug-key');
        const typeEl = document.getElementById('admin-redis-debug-type');
        const startEl = document.getElementById('admin-redis-debug-start');
        const limitEl = document.getElementById('admin-redis-debug-limit');
        const ascEl = document.getElementById('admin-redis-debug-asc');
        const fieldEl = document.getElementById('admin-redis-debug-field');
        const memberEl = document.getElementById('admin-redis-debug-member');
        const errEl = document.getElementById('admin-redis-debug-error');
        const metaEl = document.getElementById('admin-redis-debug-meta');
        const valueEl = document.getElementById('admin-redis-debug-value');
        const resultEl = document.getElementById('admin-redis-debug-result');
        const btn = document.getElementById('admin-redis-debug-fetch-btn');

        if (!keyEl || !typeEl || !startEl || !limitEl || !ascEl || !fieldEl || !memberEl || !errEl || !resultEl) return;
        errEl.style.display = 'none';
        if (metaEl) metaEl.style.display = 'none';
        if (valueEl) valueEl.style.display = 'none';

        const key = String(keyEl.value || '').trim();
        const type = String(typeEl.value || 'auto').trim() || 'auto';
        const start = Math.max(0, parseInt(String(startEl.value || '0').trim(), 10) || 0);
        const limit = Math.max(1, Math.min(200, parseInt(String(limitEl.value || '50').trim(), 10) || 50));
        const asc = !!ascEl.checked;
        const field = String(fieldEl.value || '').trim();
        const member = String(memberEl.value || '').trim();

        if (!key) {
            errEl.textContent = '请填写 key（不能为空）';
            errEl.style.display = 'block';
            return;
        }

        try {
            localStorage.setItem('admin_redis_debug_key', key);
            localStorage.setItem('admin_redis_debug_type', type);
            localStorage.setItem('admin_redis_debug_start', String(start));
            localStorage.setItem('admin_redis_debug_limit', String(limit));
            localStorage.setItem('admin_redis_debug_asc', String(asc));
            localStorage.setItem('admin_redis_debug_field', field);
            localStorage.setItem('admin_redis_debug_member', member);
        } catch (_) {}

        const oldText = btn ? btn.textContent : '';
        if (btn) {
            btn.disabled = true;
            btn.textContent = '查询中...';
        }
        resultEl.textContent = `请求中...\nkey=${key}\ntype=${type}\nstart=${start}\nlimit=${limit}\nasc=${asc}\nfield=${field || '(empty)'}\nmember=${member || '(empty)'}\n`;

        try {
            const data = await this.apiService.adminRedisDebugKey({ key, type, start, limit, asc, field, member });
            this.adminRedisDebugLast = data || {};
            resultEl.textContent = JSON.stringify(data, null, 2);

            if (metaEl) {
                const exists = (data && data.exists === true) ? 'true' : 'false';
                const ttl = (data && typeof data.ttl !== 'undefined') ? String(data.ttl) : '';
                const rt = data?.redisType || '';
                const et = data?.effectiveType || '';
                metaEl.innerHTML = `exists=<b>${this.escapeHtmlAttr(exists)}</b>，redisType=<b>${this.escapeHtmlAttr(rt)}</b>，effectiveType=<b>${this.escapeHtmlAttr(et)}</b>，ttl=<b>${this.escapeHtmlAttr(ttl)}</b>`;
                metaEl.style.display = 'block';
            }
            if (valueEl) {
                valueEl.innerHTML = this._renderRedisDebugValueBlock(data);
                valueEl.style.display = 'block';
            }
        } catch (e) {
            const msg = e && e.message ? e.message : '查询失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
            this.adminRedisDebugLast = null;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = oldText || '查询';
            }
        }
    }

    async adminAcmOpenRebuildAcceptPerson() {
        const btn = document.getElementById('admin-acm-open-rebuild-run-btn');
        const stopBtn = document.getElementById('admin-acm-open-rebuild-stop-btn');
        const errEl = document.getElementById('admin-acm-open-rebuild-error');
        const resultEl = document.getElementById('admin-acm-open-rebuild-result');
        if (!btn || !errEl || !resultEl) return;
        errEl.style.display = 'none';

        const getNum = (id, defVal = 0) => {
            const el = document.getElementById(id);
            const v = parseInt(String(el ? el.value : defVal).trim(), 10);
            return Number.isFinite(v) ? v : defVal;
        };
        const offset = Math.max(0, getNum('admin-acm-open-rebuild-offset', 0));
        const limit = Math.max(0, getNum('admin-acm-open-rebuild-limit', 0));
        const autoRunEl = document.getElementById('admin-acm-open-rebuild-auto-run');
        const autoRun = !!(autoRunEl && autoRunEl.checked);
        const segLimit = Math.max(1, getNum('admin-acm-open-rebuild-seg-limit', 500));
        const pageSize = Math.max(1, Math.min(500, getNum('admin-acm-open-rebuild-page-size', 200)));
        const batchSize = Math.max(1, Math.min(50, getNum('admin-acm-open-rebuild-batch-size', 20)));
        const sleepMs = Math.max(0, Math.min(3000, getNum('admin-acm-open-rebuild-sleep-ms', 0)));
        const dryRunEl = document.getElementById('admin-acm-open-rebuild-dry-run');
        const dryRun = !!(dryRunEl && dryRunEl.checked);

        // 保存参数便于复用
        try {
            localStorage.setItem('admin_acm_open_rebuild_offset', String(offset));
            localStorage.setItem('admin_acm_open_rebuild_limit', String(limit));
            localStorage.setItem('admin_acm_open_rebuild_page_size', String(pageSize));
            localStorage.setItem('admin_acm_open_rebuild_batch_size', String(batchSize));
            localStorage.setItem('admin_acm_open_rebuild_sleep_ms', String(sleepMs));
            localStorage.setItem('admin_acm_open_rebuild_dry_run', String(dryRun));
            localStorage.setItem('admin_acm_open_rebuild_auto_run', String(autoRun));
            localStorage.setItem('admin_acm_open_rebuild_segment_limit', String(segLimit));
        } catch (_) {}

        if (!dryRun) {
            const ok = confirm(
                `确认要回填 acm_problem_open.accept_person 吗？\n\n` +
                `offset=${offset}\nlimit=${limit}\npageSize=${pageSize}\nbatchSize=${batchSize}\nsleepMs=${sleepMs}\n\n` +
                `注意：dryRun=false 会写库，建议先 dryRun=true 预演一小段。`
            );
            if (!ok) return;
        }

        if (autoRun && !dryRun) {
            const ok2 = confirm(
                `你开启了“自动跑完（分段）”。\n\n` +
                `起始offset=${offset}\n每段limit=${segLimit}\npageSize=${pageSize}\nbatchSize=${batchSize}\nsleepMs=${sleepMs}\n\n` +
                `这会多次发请求直到跑完（或你点“停止”）。确认继续？`
            );
            if (!ok2) return;
        }

        const old = btn.textContent;
        btn.disabled = true;
        btn.textContent = autoRun ? (dryRun ? '分段预演中...' : '分段执行中...') : (dryRun ? '预演中...' : '执行中...');
        this._adminAcmOpenRebuildStop = false;
        if (stopBtn) stopBtn.style.display = 'inline-block';
        resultEl.textContent = `请求中...\n` +
            `offset=${offset}, limit=${limit}, pageSize=${pageSize}, batchSize=${batchSize}, sleepMs=${sleepMs}, dryRun=${dryRun}, autoRun=${autoRun}${autoRun ? `, segLimit=${segLimit}` : ''}\n`;

        try {
            if (!autoRun) {
                const data = await this.apiService.adminAcmProblemOpenRebuildAcceptPerson({
                    offset, limit, pageSize, batchSize, sleepMs, dryRun
                });
                resultEl.textContent = JSON.stringify(data, null, 2);
                const updated = data && typeof data.updated === 'number' ? data.updated : (data?.updated ?? '-');
                const processed = data && typeof data.processed === 'number' ? data.processed : (data?.processed ?? '-');
                const failed = data && typeof data.failed === 'number' ? data.failed : (data?.failed ?? '-');
                alert(`${dryRun ? '预演完成' : '执行完成'}：processed=${processed}，updated=${updated}，failed=${failed}`);
            } else {
                let curOffset = offset;
                let round = 0;
                let totalProcessed = 0;
                let totalUpdated = 0;
                let totalFailed = 0;
                let total = null;
                resultEl.textContent = `分段开始...\n起始offset=${curOffset}, 每段limit=${segLimit}\n`;

                while (true) {
                    if (this._adminAcmOpenRebuildStop) {
                        resultEl.textContent += `\n已停止。\n当前offset=${curOffset}\n`;
                        break;
                    }
                    round += 1;
                    resultEl.textContent += `\n[${round}] 请求中... offset=${curOffset}, limit=${segLimit}\n`;

                    const data = await this.apiService.adminAcmProblemOpenRebuildAcceptPerson({
                        offset: curOffset, limit: segLimit, pageSize, batchSize, sleepMs, dryRun
                    });
                    if (total == null && data && typeof data.total === 'number') total = data.total;
                    const processed = (data && typeof data.processed === 'number') ? data.processed : 0;
                    const updated = (data && typeof data.updated === 'number') ? data.updated : 0;
                    const failed = (data && typeof data.failed === 'number') ? data.failed : 0;
                    const endExclusive = (data && typeof data.endExclusive === 'number') ? data.endExclusive : null;

                    totalProcessed += processed;
                    totalUpdated += updated;
                    totalFailed += failed;

                    resultEl.textContent += `结果：processed=${processed}, updated=${updated}, failed=${failed}` +
                        (endExclusive != null ? `, endExclusive=${endExclusive}` : '') +
                        (total != null ? `, total=${total}` : '') + `\n`;

                    if (endExclusive == null) {
                        resultEl.textContent += `未返回 endExclusive，停止分段。\n`;
                        break;
                    }
                    if (processed <= 0) {
                        resultEl.textContent += `processed=0，停止分段。\n`;
                        break;
                    }
                    if (total != null && endExclusive >= total) {
                        resultEl.textContent += `已到末尾（endExclusive>=total），完成。\n`;
                        break;
                    }
                    curOffset = endExclusive;
                }

                try { localStorage.setItem('admin_acm_open_rebuild_offset', String(curOffset)); } catch (_) {}
                alert(`${dryRun ? '分段预演完成' : '分段执行完成'}：processed=${totalProcessed}，updated=${totalUpdated}，failed=${totalFailed}`);
            }
        } catch (e) {
            const msg = e && e.message ? e.message : '执行失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = old || '开始执行';
            if (stopBtn) stopBtn.style.display = 'none';
            this._adminAcmOpenRebuildStop = false;
        }
    }

    // 数据：过题排行榜批量重建（Top N）
    async adminAcceptRankRebuildTopN() {
        const btn = document.getElementById('admin-accept-rank-rebuild-run-btn');
        const stopBtn = document.getElementById('admin-accept-rank-rebuild-stop-btn');
        const errEl = document.getElementById('admin-accept-rank-rebuild-error');
        const resultEl = document.getElementById('admin-accept-rank-rebuild-result');
        if (!btn || !stopBtn || !errEl || !resultEl) return;

        const getNum = (id, defVal) => {
            const el = document.getElementById(id);
            const v = el ? Number(String(el.value || '').trim()) : Number(defVal);
            return Number.isFinite(v) ? v : Number(defVal);
        };
        const getBool = (id) => {
            const el = document.getElementById(id);
            return !!(el && el.checked);
        };

        errEl.style.display = 'none';
        this._adminAcceptRankRebuildStop = false;

        const topN = Math.max(1, Math.min(10000, getNum('admin-accept-rank-rebuild-top-n', 1000)));
        const pageSize = Math.max(1, Math.min(500, getNum('admin-accept-rank-rebuild-page-size', 200)));
        const batchSize = Math.max(1, Math.min(50, getNum('admin-accept-rank-rebuild-batch-size', 20)));
        const sleepMs = Math.max(0, Math.min(3000, getNum('admin-accept-rank-rebuild-sleep-ms', 80)));
        const dryRun = getBool('admin-accept-rank-rebuild-dry-run');

        try {
            localStorage.setItem('admin_accept_rank_rebuild_top_n', String(topN));
            localStorage.setItem('admin_accept_rank_rebuild_page_size', String(pageSize));
            localStorage.setItem('admin_accept_rank_rebuild_batch_size', String(batchSize));
            localStorage.setItem('admin_accept_rank_rebuild_sleep_ms', String(sleepMs));
            localStorage.setItem('admin_accept_rank_rebuild_dry_run', String(dryRun));
        } catch (_) {}

        const ok = confirm(
            `确认批量重建过题榜 Top ${topN} 吗？\n\n` +
            `步骤：GET ranks/problem 分页拉取 -> 对每个 uid POST rank/update-accept-count\n\n` +
            (dryRun ? `当前 dryRun=ON：只拉取不更新\n\n` : '') +
            `建议低峰期执行，避免对后端造成压力。`
        );
        if (!ok) return;

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = dryRun ? '拉取中...' : '执行中...';
        stopBtn.style.display = 'inline-block';
        resultEl.textContent = `准备中...\nTopN=${topN}, pageSize=${pageSize}, batchSize=${batchSize}, sleepMs=${sleepMs}, dryRun=${dryRun}\n`;

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const pickUid = (row) => {
            if (!row || typeof row !== 'object') return null;
            return row.uid ?? row.userId ?? row.user_id ?? row.id ?? row.ID ?? null;
        };

        try {
            // 1) 拉取前 N 的 uid 列表
            const uids = [];
            const seen = new Set();
            let page = 1;
            while (uids.length < topN && !this._adminAcceptRankRebuildStop) {
                const data = await this.apiService.fetchRankings('problem', page, null, pageSize);
                const list = Array.isArray(data?.ranks) ? data.ranks : (Array.isArray(data) ? data : []);
                if (!list.length) break;
                for (const r of list) {
                    const uid = pickUid(r);
                    if (!uid) continue;
                    const key = String(uid);
                    if (seen.has(key)) continue;
                    seen.add(key);
                    uids.push(Number(uid));
                    if (uids.length >= topN) break;
                }
                resultEl.textContent = `拉取榜单中...\npage=${page}, got=${uids.length}/${topN}\n`;
                page += 1;
                if (list.length < pageSize) break;
            }

            if (this._adminAcceptRankRebuildStop) {
                resultEl.textContent = `已停止。\n已拉取 uid=${uids.length}\n`;
                return;
            }
            resultEl.textContent = `榜单拉取完成：uid=${uids.length}\n` + (dryRun ? `dryRun=ON（不更新）\n` : `开始更新...\n`);

            if (dryRun) {
                resultEl.textContent += `uids(前${Math.min(50, uids.length)}): ${uids.slice(0, 50).join(', ')}\n`;
                return;
            }

            // 2) 分批更新
            let okCount = 0;
            let failCount = 0;
            const fails = [];
            for (let i = 0; i < uids.length; i += batchSize) {
                if (this._adminAcceptRankRebuildStop) break;
                const batch = uids.slice(i, i + batchSize);
                await Promise.all(batch.map(async (uid) => {
                    try {
                        await this.apiService.adminUpdateUserAcceptCount(uid);
                        okCount += 1;
                    } catch (e) {
                        failCount += 1;
                        const msg = (e && e.message) ? e.message : 'update failed';
                        fails.push({ uid, msg });
                    }
                }));
                resultEl.textContent =
                    `更新中...\n` +
                    `done=${Math.min(i + batch.length, uids.length)}/${uids.length}\n` +
                    `ok=${okCount}, fail=${failCount}\n` +
                    (failCount ? `lastFail=${fails[fails.length - 1]?.uid ?? ''} ${fails[fails.length - 1]?.msg ?? ''}\n` : '');
                if (sleepMs > 0) await sleep(sleepMs);
            }

            if (this._adminAcceptRankRebuildStop) {
                resultEl.textContent += `\n已停止。\n`;
            }
            if (failCount) {
                resultEl.textContent += `\n失败列表（最多50条）：\n` + JSON.stringify(fails.slice(0, 50), null, 2);
            }
            alert(`完成：ok=${okCount}, fail=${failCount}, total=${uids.length}`);
        } catch (e) {
            const msg = e && e.message ? e.message : '执行失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '开始执行';
            stopBtn.style.display = 'none';
            this._adminAcceptRankRebuildStop = false;
        }
    }

    // 数据：徽章/成就补发（批量/单用户）
    async adminBadgeBackfillRun() {
        const btn = document.getElementById('admin-badge-backfill-run-btn');
        const stopBtn = document.getElementById('admin-badge-backfill-stop-btn');
        const errEl = document.getElementById('admin-badge-backfill-error');
        const resultEl = document.getElementById('admin-badge-backfill-result');
        if (!btn || !stopBtn || !errEl || !resultEl) return;

        const getNum = (id, defVal) => {
            const el = document.getElementById(id);
            const v = el ? Number(String(el.value || '').trim()) : Number(defVal);
            return Number.isFinite(v) ? v : Number(defVal);
        };
        const getBool = (id) => {
            const el = document.getElementById(id);
            return !!(el && el.checked);
        };

        errEl.style.display = 'none';
        this._adminBadgeBackfillStop = false;

        const userId = Math.max(0, Math.floor(getNum('admin-badge-backfill-user-id', 0)));
        const offset0 = Math.max(0, Math.floor(getNum('admin-badge-backfill-offset', 0)));
        const limit = Math.max(1, Math.min(1000, Math.floor(getNum('admin-badge-backfill-limit', 200))));
        const dryRun = getBool('admin-badge-backfill-dry-run');
        const includeAccept = getBool('admin-badge-backfill-include-accept');

        try {
            localStorage.setItem('admin_badge_backfill_user_id', String(userId));
            localStorage.setItem('admin_badge_backfill_offset', String(offset0));
            localStorage.setItem('admin_badge_backfill_limit', String(limit));
            localStorage.setItem('admin_badge_backfill_dry_run', String(dryRun));
            localStorage.setItem('admin_badge_backfill_include_accept', String(includeAccept));
        } catch (_) {}

        const ok = confirm(
            `确认执行“成就补发（badge backfill）”吗？\n\n` +
            `userId=${userId}（0=批量）\n` +
            (userId === 0 ? `offset=${offset0}, limit=${limit}\n` : '') +
            `dryRun=${dryRun}\nincludeAccept=${includeAccept}\nincludeSkillTree=false（强制）\n\n` +
            `接口：POST /problem/tracker/badge/backfill`
        );
        if (!ok) return;

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = dryRun ? '预演中...' : '执行中...';
        stopBtn.style.display = 'inline-block';
        resultEl.textContent = `开始...\nuserId=${userId}\n` + (userId === 0 ? `offset=${offset0}, limit=${limit}\n` : '') +
            `dryRun=${dryRun}, includeAccept=${includeAccept}, includeSkillTree=false\n\n`;

        try {
            if (userId > 0) {
                const data = await this.apiService.adminBadgeBackfill({ userId, dryRun, includeAccept, includeSkillTree: false });
                resultEl.textContent += JSON.stringify(data, null, 2);
                alert('执行完成');
                return;
            }

            // 批量：按 offset 分页循环
            let offset = offset0;
            let page = 0;
            while (!this._adminBadgeBackfillStop) {
                page += 1;
                resultEl.textContent += `\n--- page ${page} ---\noffset=${offset}, limit=${limit}\n`;
                const data = await this.apiService.adminBadgeBackfill({ userId: 0, offset, limit, dryRun, includeAccept, includeSkillTree: false });
                resultEl.textContent += JSON.stringify(data, null, 2) + '\n';

                // 尝试从返回值推断是否还有下一页
                const processed = Number(data?.processed ?? data?.processedCount ?? data?.count ?? data?.handled ?? data?.total ?? 0);
                const hasMore = (data?.hasMore === true) || (data?.nextOffset != null) || (processed >= limit);

                if (data?.nextOffset != null) {
                    offset = Math.max(offset + limit, Number(data.nextOffset) || offset + limit);
                } else {
                    offset += limit;
                }
                if (!hasMore) break;
            }

            if (this._adminBadgeBackfillStop) {
                resultEl.textContent += `\n已停止。\n`;
            }
            alert('执行完成');
        } catch (e) {
            const msg = e && e.message ? e.message : '执行失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent += `\n失败：${msg}\n`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '开始执行';
            stopBtn.style.display = 'none';
            this._adminBadgeBackfillStop = false;
        }
    }

    parseRawHeaders(text) {
        const out = {};
        const lines = String(text || '')
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean);

        for (const line of lines) {
            // 忽略类似 "POST https://..." / "HTTP/1.1 200" 这类
            if (/^(GET|POST|PUT|DELETE|OPTIONS|PATCH)\s+/i.test(line)) continue;
            if (/^HTTP\/\d/i.test(line)) continue;

            const idx = line.indexOf(':');
            if (idx <= 0) continue;
            const k = line.slice(0, idx).trim();
            const v = line.slice(idx + 1).trim();
            if (!k) continue;
            // 过滤一些不应手动注入/无意义的头
            const lk = k.toLowerCase();
            if (lk === 'content-length' || lk === 'host') continue;
            if (lk === 'cookie') continue; // cookie 由浏览器/credentials 管理
            out[k] = v;
        }
        return out;
    }

    // ===== LaTeX $$...$$ -> nowcoder equation img =====
    _nowcoderEquationImg(latex) {
        const tex = encodeURIComponent(String(latex ?? ''));
        return `<img src="https://www.nowcoder.com/equation?tex=${tex}" alt="latex" />`;
    }

    _replaceDoubleDollarLatexToImg(input) {
        const s = String(input ?? '');
        // 仅处理 $$...$$（双美元），支持跨行；非贪婪匹配
        return s.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => this._nowcoderEquationImg(expr));
    }

    _replaceSingleDollarLatexToImg(input) {
        const s = String(input ?? '');
        // 处理 $...$（单美元，行内公式）
        // 约束：
        // - 不匹配 $$...$$（由上一步处理）
        // - 不跨行（更贴近行内公式语义）
        // - 支持转义 \$（不替换）
        //
        // 说明：这是一个“够用”的启发式实现（题面里通常不会出现货币 $100$ 这种写法）。
        return s.replace(/(^|[^\\])\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_, pre, expr) => {
            return `${pre}${this._nowcoderEquationImg(expr)}`;
        });
    }

    _replaceParenLatexToImg(input) {
        const s = String(input ?? '');
        // 兼容 \( ... \) 与 \[ ... \]
        const a = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => this._nowcoderEquationImg(expr));
        return a.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => this._nowcoderEquationImg(expr));
    }

    _replaceMarkdownBoldToStrong(input) {
        const s = String(input ?? '');
        // 处理 **...**（markdown 加粗）
        // - 不跨行（题面里加粗通常是行内）
        // - 支持转义 \*\*（不替换）
        // - 非贪婪
        return s.replace(/(^|[^\\])\*\*([^\n*][^\n]*?)\*\*/g, (_, pre, text) => {
            return `${pre}<strong>${text}</strong>`;
        });
    }

    _normalizeQmsNewlinesPlain(input) {
        // 纯文本字段：把 \n\n 变成 \n\n\n\t（你验证过中台能正确分段）
        // 注意：JSON parse 后这里拿到的是“真实换行符”，JSON stringify 预览会显示成 \\n。
        let s = String(input ?? '');
        s = s.replace(/\r\n/g, '\n');
        s = s.replace(/\n\n/g, '\n\n\n\t');
        return s;
    }

    _normalizeQmsNewlinesHtml(input) {
        // 富文本字段：中台对“纯换行符”不稳定，按你抓包的成功形态转换为 <div> 分段。
        // 若已包含明显的 HTML 标签，则不做 div 分段（避免二次包裹）。
        let s = String(input ?? '');
        s = s.replace(/\r\n/g, '\n');
        if (/<\s*(div|p|br|span|img|ul|ol|li|pre|code|table|tr|td|th)\b/i.test(s)) return s;
        if (!s.trim()) return s;

        // 以空行分段；段内的单换行用 <br/> 保留
        const parts = s.split(/\n\s*\n/g).map(x => String(x || '').trim()).filter(Boolean);
        const blocks = parts.map(p => {
            const inner = p.replace(/\n/g, '<br/>\n\t');
            return `<div>\n\t${inner}\n</div>`;
        });
        return blocks.join('\n');
    }

    // ==================== 录 Puzzle 题 ====================

    renderPuzzleRecordPanel() {
        const savedTitle = (() => { try { return localStorage.getItem('puzzle_record_title') || ''; } catch (_) { return ''; } })();
        const savedContent = (() => { try { return localStorage.getItem('puzzle_record_content') || ''; } catch (_) { return ''; } })();
        const savedJudge = (() => { try { return localStorage.getItem('puzzle_record_judge') || ''; } catch (_) { return ''; } })();
        const savedDifficulty = (() => { try { return Number(localStorage.getItem('puzzle_record_difficulty')) || 4; } catch (_) { return 4; } })();
        return `
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div style="font-size: 16px; font-weight: 800; color:#333;">录 Prompt Puzzle 题</div>
                    <div style="font-size: 12px; color:#999;">QMS 建题(type=4) → 审核 → convert(type=21) + 写入 judge 代码</div>
                    <div style="flex:1;"></div>
                    <button id="puzzle-record-save-btn" class="admin-btn" style="padding: 9px 18px; font-weight:900; background:#52c41a; color:#fff;" type="button">一键录题</button>
                </div>

                <div id="puzzle-record-error" style="display:none; padding:10px 12px; background:#fff2f0; border:1px solid #ffccc7; border-radius:10px; color:#a8071a; font-size:13px;"></div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; align-items:start;">
                    <!-- 左：题面信息 -->
                    <div style="border:1px solid #f0f0f0; border-radius:12px; background:#fff; overflow:hidden;">
                        <div style="padding:10px 12px; border-bottom:1px solid #f0f0f0; font-size:13px; font-weight:800; color:#111827;">题目信息</div>
                        <div style="padding:12px; display:flex; flex-direction:column; gap:10px;">
                            <div>
                                <label style="font-size:12px; color:#666;">标题</label>
                                <input id="puzzle-record-title" type="text" value="${this.escapeHtmlAttr(savedTitle)}" placeholder="如：双回文"
                                    style="width:100%; padding:8px 10px; border:1px solid #ddd; border-radius:10px; font-size:13px; margin-top:4px;" />
                            </div>
                            <div>
                                <label style="font-size:12px; color:#666;">难度（1~5）</label>
                                <input id="puzzle-record-difficulty" type="number" min="1" max="5" value="${savedDifficulty}"
                                    style="width:80px; padding:8px 10px; border:1px solid #ddd; border-radius:10px; font-size:13px; margin-top:4px;" />
                            </div>
                            <div>
                                <label style="font-size:12px; color:#666;">题面（HTML）</label>
                                <textarea id="puzzle-record-content" rows="12" placeholder="<h3>题目</h3>&#10;<p>...</p>&#10;<h3>输入限制</h3>&#10;..."
                                    style="width:100%; padding:10px; border:1px solid #ddd; border-radius:12px; font-size:13px; resize:vertical; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; margin-top:4px;">${this.escapeHtml(savedContent)}</textarea>
                            </div>
                        </div>
                    </div>

                    <!-- 右：judge 代码 -->
                    <div style="border:1px solid #f0f0f0; border-radius:12px; background:#fff; overflow:hidden;">
                        <div style="padding:10px 12px; border-bottom:1px solid #f0f0f0; font-size:13px; font-weight:800; color:#111827;">Judge 代码（Python）</div>
                        <div style="padding:12px;">
                            <textarea id="puzzle-record-judge" rows="22" placeholder="# @temperature 0.1&#10;# @run_count 3&#10;# @max_tokens 64&#10;&#10;def check_prompt(prompt):&#10;    ...&#10;&#10;def check_output(prompt, output):&#10;    ..."
                                style="width:100%; padding:10px; border:1px solid #ddd; border-radius:12px; font-size:12px; resize:vertical; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; line-height:1.5; background:#fafafa;">${this.escapeHtml(savedJudge)}</textarea>
                        </div>
                    </div>
                </div>

                <!-- 日志 -->
                <div style="border:1px solid #f0f0f0; border-radius:12px; background:#fff; overflow:hidden;">
                    <div style="padding:10px 12px; border-bottom:1px solid #f0f0f0; font-size:13px; font-weight:800; color:#111827;">执行日志</div>
                    <pre id="puzzle-record-log" style="margin:0; padding:12px; font-size:12px; color:#374151; line-height:1.6; max-height:300px; overflow:auto; white-space:pre-wrap; background:#fafafa;">（点击"一键录题"开始）</pre>
                </div>
            </div>
        `;
    }

    bindPuzzleRecordEventsIfPresent() {
        const saveBtn = document.getElementById('puzzle-record-save-btn');
        if (saveBtn && !saveBtn._bound) {
            saveBtn._bound = true;
            saveBtn.addEventListener('click', () => this.adminPuzzleOneClick());
        }
        // 自动保存输入
        for (const [elId, key] of [
            ['puzzle-record-title', 'puzzle_record_title'],
            ['puzzle-record-content', 'puzzle_record_content'],
            ['puzzle-record-judge', 'puzzle_record_judge'],
            ['puzzle-record-difficulty', 'puzzle_record_difficulty'],
        ]) {
            const el = document.getElementById(elId);
            if (el && !el._bound) {
                el._bound = true;
                el.addEventListener('input', () => {
                    try { localStorage.setItem(key, el.value); } catch (_) {}
                });
            }
        }
    }

    async adminPuzzleOneClick() {
        const btn = document.getElementById('puzzle-record-save-btn');
        const errEl = document.getElementById('puzzle-record-error');
        const logEl = document.getElementById('puzzle-record-log');
        if (!btn || !errEl || !logEl) return;

        const titleEl = document.getElementById('puzzle-record-title');
        const contentEl = document.getElementById('puzzle-record-content');
        const judgeEl = document.getElementById('puzzle-record-judge');
        const diffEl = document.getElementById('puzzle-record-difficulty');

        const title = String(titleEl?.value || '').trim();
        const content = String(contentEl?.value || '').trim();
        const judgeCode = String(judgeEl?.value || '').trim();
        const difficulty = Number(diffEl?.value) || 4;

        errEl.style.display = 'none';
        if (!title) { errEl.textContent = '请填写标题'; errEl.style.display = 'block'; return; }
        if (!content) { errEl.textContent = '请填写题面'; errEl.style.display = 'block'; return; }
        if (!judgeCode) { errEl.textContent = '请填写 judge 代码'; errEl.style.display = 'block'; return; }
        if (!judgeCode.includes('check_prompt')) { errEl.textContent = 'judge 代码缺少 check_prompt 函数'; errEl.style.display = 'block'; return; }
        if (!judgeCode.includes('check_output')) { errEl.textContent = 'judge 代码缺少 check_output 函数'; errEl.style.display = 'block'; return; }

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '录题中...';
        logEl.textContent = '';

        const log = (msg) => { logEl.textContent += msg + '\n'; logEl.scrollTop = logEl.scrollHeight; };
        const step = (i, total, desc) => { log(`[${i}/${total}] ${desc}`); };

        // QMS headers
        let extraHeaders = {};
        try {
            const raw = String(localStorage.getItem('admin_qms_draft_headers') || '').trim();
            if (raw) {
                extraHeaders = raw.startsWith('{') ? (JSON.parse(raw) || {}) : this.parseRawHeaders(raw);
            }
        } catch (_) {}

        try {
            // 1) QMS draft/add (type=4)
            step(1, 6, '创建草稿（QMS draft/add, type=4）');
            const addPayload = {
                type: 4,
                title,
                content,
                analysis: '',
                difficulty,
                defaultScore: null,
                skills: ['584'],
                remark: '',
                openScopes: [],
                designSetting: { attachmentUploadNum: 0, attachmentSizeOption: 0, uploadPhotoSwitch: 0 },
                aiJudgeSetting: { aiJudge: false, scoringCriteria: '', scoringExamples: [], attachment: [], customScoringSwitch: true, spokenTestSwitch: false, spokenScoringSetting: { newLanguage: [], assessmentType: null, languageSettings: [] } },
                previewSkills: ['584'],
                caseCount: null,
                aiDigitalHumanResource: { ttsText: String(content).replace(/<[^>]*>/g, '').slice(0, 200) }
            };
            const addResp = await this.apiService.adminQmsDraftAdd({ ...addPayload, __tracker_extra_headers: extraHeaders });
            const addJson = addResp && addResp.json ? addResp.json : null;
            const qid = (addJson && Array.isArray(addJson.data) && addJson.data.length > 0) ? String(addJson.data[0]) : '';
            if (!addResp.ok || !qid) throw new Error(`draft/add 失败：HTTP ${addResp.status} ${addResp.text || ''}`);
            log(`   → qid = ${qid}`);

            // 2) QMS question（最终提交）
            step(2, 6, '最终提交（QMS question）');
            const questionPayload = { ...addPayload, id: qid, regenerateDigitalHumanResource: false, tags: [] };
            const qResp = await this.apiService.adminQmsQuestionUpsert({ ...questionPayload, __tracker_extra_headers: extraHeaders });
            if (!qResp.ok) throw new Error(`question 失败：HTTP ${qResp.status} ${qResp.text || ''}`);
            log(`   → 提交成功`);

            // 3) review/next-question → 拿快照（含 uuid）
            step(3, 6, '审题：获取快照（review/next-question）');
            const nextResp = await this.apiService.adminQmsReviewNextQuestion({ curQid: [String(qid)], scene: 1, __tracker_extra_headers: extraHeaders });
            const snap = nextResp && nextResp.json && nextResp.json.data ? nextResp.json.data : null;
            if (!nextResp.ok || !snap || !snap.id) throw new Error(`next-question 失败：HTTP ${nextResp.status}`);
            log(`   → uuid = ${snap.uuid || '(空)'}`);

            // 4) review/confirm
            step(4, 6, '审题：确认（review/confirm）');
            const question = this._normalizeReviewQuestionFromSnapshot(snap);
            const confirmResp = await this.apiService.adminQmsReviewConfirm({ question, type: 1, __tracker_extra_headers: extraHeaders });
            if (!confirmResp.ok) throw new Error(`review/confirm 失败：HTTP ${confirmResp.status}`);
            log(`   → 审核通过`);

            // 5) open-library/save
            step(5, 6, '设置开放范围（open-library/save）');
            {
                let olType = 1, olIds = ['391696'], olScopes = [1, 3];
                try {
                    olType = Number(localStorage.getItem('tracker_qms_open_library_type') || 1) || 1;
                    olIds = String(localStorage.getItem('tracker_qms_open_library_ids') || '391696').split(',').map(s => s.trim()).filter(Boolean);
                    olScopes = String(localStorage.getItem('tracker_qms_open_library_scopes') || '1,3').split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
                    if (!olIds.length) olIds = ['391696'];
                    if (!olScopes.length) olScopes = [1, 3];
                } catch (_) {}
                const olResp = await this.apiService.adminQmsQuestionOpenLibrarySave({ questionId: String(qid), type: olType, ids: olIds, openScopes: olScopes, __tracker_extra_headers: extraHeaders });
                if (!olResp.ok) throw new Error(`open-library/save 失败：HTTP ${olResp.status}`);
                log(`   → 开放范围已设置`);
            }

            // 6) convert → type=21 + 写入 judge 代码
            step(6, 6, '转换为 Puzzle 题（convert）');
            const convertResp = await this.apiService.promptPuzzleAdminConvert(qid, judgeCode);
            if (!convertResp || convertResp.code !== 0) {
                const msg = (convertResp && convertResp.message) ? convertResp.message : 'convert 失败';
                throw new Error(msg);
            }
            const judgeConfig = convertResp.data && convertResp.data.judgeConfig ? convertResp.data.judgeConfig : {};
            log(`   → 转换成功！questionId=${qid}`);
            log(`   → judge_config: run_count=${judgeConfig.run_count || '?'}, temperature=${judgeConfig.temperature || '?'}, max_tokens=${judgeConfig.max_tokens || '?'}`);

            log(`\n✅ 录题完成！questionId = ${qid}`);
        } catch (e) {
            const msg = e && e.message ? e.message : '录题失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            log(`\n❌ 失败：${msg}`);
        } finally {
            btn.disabled = false;
            btn.textContent = oldText;
        }
    }

    _normalizeQmsRichText(input, mode = 'html') {
        // mode:
        // - html: 题面/解析/IO/说明等富文本（用 <div> 分段）
        // - plain: 样例输入输出/ttsText 等纯文本（用 \n\n -> \n\n\n\t）
        const s0 = this._replaceMarkdownBoldToStrong(input);
        const s1 = (mode === 'plain') ? this._normalizeQmsNewlinesPlain(s0) : this._normalizeQmsNewlinesHtml(s0);
        const a = this._replaceDoubleDollarLatexToImg(s1);
        const b = this._replaceParenLatexToImg(a);
        return this._replaceSingleDollarLatexToImg(b);
    }

    buildQmsDraftAddPayload(problemJson) {
        // 如果未导入，则回退到一个可用的默认示例（便于快速验证链路）
        const fallback = {
            type: 10,
            title: 'test0112',
            timeLimit: 1,
            memoryLimit: 256,
            content: '0112',
            analysis: '',
            difficulty: 4,
            defaultScore: null,
            customSimilar: null,
            remark: '',
            openScopes: [],
            skills: ['584'],
            codingSupportLang: ['1','2','3','4','5','8','9','10','11','13','16','17','19','20','21','24','25','27','28','29','30','31'],
            codingHint: '',
            codingCheckerFileName: '',
            floatAccuracyDigit: 0,
            noSamples: false,
            codingSamples: [],
            dataFileUrl: '',
            codingStandardSubmissionIds: [],
            codingTemplates: [],
            codingSetting: { deleteBlankLine: true, autoDeleteSpace: true, advanceCode: false, enablePreCode: false },
            codingDesc: { inputDesc: 'in', outputDesc: '' },
            previewSkills: ['584'],
            caseCount: null,
            aiDigitalHumanResource: { ttsText: '0112' }
        };

        if (!problemJson || typeof problemJson !== 'object') return fallback;

        const basic = problemJson.basic || {};
        const statement = problemJson.statement || {};
        const io = problemJson.io || {};
        const coding = problemJson.coding || {};

        const title = basic.title || problemJson.title || fallback.title;
        const type = (basic.type != null ? basic.type : problemJson.type) ?? fallback.type;
        const difficulty = (basic.difficulty != null ? basic.difficulty : problemJson.difficulty) ?? fallback.difficulty;
        const timeLimit = (basic.timeLimitSec != null ? basic.timeLimitSec : problemJson.timeLimitSec) ?? fallback.timeLimit;
        const memoryLimit = (basic.memoryLimitMB != null ? basic.memoryLimitMB : problemJson.memoryLimitMB) ?? fallback.memoryLimit;
        const content = this._normalizeQmsRichText((statement.content != null ? statement.content : problemJson.content) ?? fallback.content, 'html');
        const analysis = this._normalizeQmsRichText((statement.analysis != null ? statement.analysis : problemJson.analysis) ?? '', 'html');
        const remark = this._normalizeQmsRichText((statement.remark != null ? statement.remark : problemJson.remark) ?? '', 'html');
        const openScopes = Array.isArray(basic.openScopes) ? basic.openScopes : (Array.isArray(problemJson.openScopes) ? problemJson.openScopes : []);
        const skills = Array.isArray(basic.skills) ? basic.skills : (Array.isArray(problemJson.skills) ? problemJson.skills : fallback.skills);

        const supportLang = Array.isArray(coding.supportLang) ? coding.supportLang : (Array.isArray(problemJson.codingSupportLang) ? problemJson.codingSupportLang : fallback.codingSupportLang);
        const setting = coding.setting && typeof coding.setting === 'object' ? coding.setting : fallback.codingSetting;
        const noSamples = (coding.noSamples != null ? !!coding.noSamples : (problemJson.noSamples != null ? !!problemJson.noSamples : fallback.noSamples));
        const floatAccuracyDigit = (coding.floatAccuracyDigit != null ? coding.floatAccuracyDigit : problemJson.floatAccuracyDigit) ?? fallback.floatAccuracyDigit;
        const checkerFileName = (coding.checkerFileName != null ? coding.checkerFileName : problemJson.codingCheckerFileName) ?? '';
        const codingHint = (coding.hint != null ? coding.hint : problemJson.codingHint) ?? '';
        const codingStandardSubmissionIds = Array.isArray(coding.standardSubmissionIds)
            ? coding.standardSubmissionIds
            : (Array.isArray(problemJson.codingStandardSubmissionIds) ? problemJson.codingStandardSubmissionIds : []);
        const codingTemplates = Array.isArray(coding.templates)
            ? coding.templates
            : (Array.isArray(problemJson.codingTemplates) ? problemJson.codingTemplates : []);

        // QMS draft/add body（按你提供的格式组装；其它字段后续可扩展）
        return {
            type,
            title,
            timeLimit,
            memoryLimit,
            content,
            analysis,
            difficulty,
            defaultScore: null,
            customSimilar: null,
            remark,
            openScopes,
            skills,
            codingSupportLang: supportLang,
            codingHint: String(codingHint || ''),
            codingCheckerFileName: checkerFileName,
            floatAccuracyDigit,
            noSamples,
            codingSamples: [],
            dataFileUrl: '',
            codingStandardSubmissionIds,
            codingTemplates,
            codingSetting: {
                deleteBlankLine: !!setting.deleteBlankLine,
                autoDeleteSpace: !!setting.autoDeleteSpace,
                advanceCode: !!setting.advanceCode,
                enablePreCode: !!setting.enablePreCode
            },
            codingDesc: {
                inputDesc: this._normalizeQmsRichText(io.inputDesc || fallback.codingDesc.inputDesc, 'html'),
                outputDesc: this._normalizeQmsRichText(io.outputDesc || fallback.codingDesc.outputDesc, 'html')
            },
            previewSkills: Array.isArray(problemJson.previewSkills) ? problemJson.previewSkills : (Array.isArray(skills) ? skills : fallback.previewSkills),
            caseCount: null,
            aiDigitalHumanResource: { ttsText: this._normalizeQmsRichText(String(problemJson?.aiDigitalHumanResource?.ttsText || content || '').slice(0, 200), 'plain') }
        };
    }

    buildQmsDraftUpdatePayload(problemJson, qid, overrides = null) {
        // update 基于 add 的 payload，再补充 id 与样例/IO 等“草稿快照”字段
        const base = this.buildQmsDraftAddPayload(problemJson);
        const id = (qid != null && String(qid).trim()) ? String(qid).trim() : (problemJson && (problemJson.id || problemJson.qid) ? String(problemJson.id || problemJson.qid) : '');

        const samples = Array.isArray(problemJson?.samples) ? problemJson.samples : [];
        const codingSamples = samples.map((s, idx) => ({
            index: idx + 1,
            input: this._normalizeQmsRichText(String(s?.input ?? ''), 'plain'),
            output: this._normalizeQmsRichText(String(s?.output ?? ''), 'plain'),
            note: this._normalizeQmsRichText(String(s?.explain ?? s?.note ?? ''), 'html')
        }));

        const io = problemJson?.io || {};

        const merged = {
            ...base,
            id,
            // update 常见字段：样例与 io 描述
            codingSamples,
            codingDesc: {
                inputDesc: this._normalizeQmsRichText(String(io.inputDesc ?? base.codingDesc?.inputDesc ?? ''), 'html'),
                outputDesc: this._normalizeQmsRichText(String(io.outputDesc ?? base.codingDesc?.outputDesc ?? ''), 'html')
            },
            previewSkills: Array.isArray(problemJson?.basic?.skills) ? problemJson.basic.skills : base.previewSkills,
            caseCount: (problemJson?.cases && typeof problemJson.cases === 'object' && problemJson.cases.caseCount != null)
                ? Number(problemJson.cases.caseCount)
                : (problemJson?.caseCount != null ? Number(problemJson.caseCount) : 0)
        };

        // 回填/覆盖字段（用于上传用例后写入 dataFileUrl/caseCount/checker 等）
        if (overrides && typeof overrides === 'object') {
            if (overrides.dataFileUrl != null) merged.dataFileUrl = String(overrides.dataFileUrl);
            if (overrides.caseCount != null) merged.caseCount = Number(overrides.caseCount);
            if (overrides.codingCheckerFileName != null) merged.codingCheckerFileName = String(overrides.codingCheckerFileName);
        }
        return merged;
    }

    buildQmsQuestionPayload(problemJson, qid) {
        // /qms/question：新增/修改题目。根据抓包观测，uuid 在“新增”时可缺省，响应只回 id。
        const base = this.buildQmsDraftUpdatePayload(problemJson, qid, (() => {
            // 若刚完成用例回填，则从本地缓存兜底带上 dataFileUrl/caseCount（避免用户没点 update 预览也能提交）
            // 注意：checker 文件名禁止在这里兜底缓存，必须以导入的 source.zip / problem.json 为准。
            try {
                const dataFileUrl = localStorage.getItem('tracker_qms_last_dataFileUrl') || '';
                const caseCount = localStorage.getItem('tracker_qms_last_caseCount') || '';
                const o = {};
                if (dataFileUrl) o.dataFileUrl = dataFileUrl;
                if (caseCount) o.caseCount = Number(caseCount);
                return o;
            } catch (_) { return null; }
        })());

        const tags = Array.isArray(problemJson?.tags) ? problemJson.tags : (Array.isArray(problemJson?.basic?.tags) ? problemJson.basic.tags : []);
        const verifiedLang = Array.isArray(problemJson?.verifiedLang)
            ? problemJson.verifiedLang
            : (Array.isArray(problemJson?.coding?.verifiedLang) ? problemJson.coding.verifiedLang : []);
        const hasQuestionChange = (problemJson?.hasQuestionChange != null) ? !!problemJson.hasQuestionChange : false;

        // openScopes: 题库抓包里是 []；我们的 add payload 已有 openScopes 字段
        return {
            ...base,
            tags,
            verifiedLang,
            hasQuestionChange
        };
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

    async loadAiPuzzleAdminOverview() {
        const schemaEl = document.getElementById('admin-ai-puzzle-schema');
        const cardsEl = document.getElementById('admin-ai-puzzle-stats-cards');
        const recentEl = document.getElementById('admin-ai-puzzle-recent-submissions');
        if (schemaEl) schemaEl.textContent = '加载中...';
        if (cardsEl) cardsEl.innerHTML = '加载中...';
        if (recentEl) recentEl.innerHTML = '加载中...';
        try {
            const [schema, stats] = await Promise.all([
                this.apiService.aiPuzzleAdminSchema(),
                this.apiService.aiPuzzleAdminStats()
            ]);
            this.aiPuzzleAdminSchemaLast = schema;
            this.aiPuzzleAdminStatsLast = stats;
            if (schemaEl) schemaEl.textContent = JSON.stringify(schema.tables || {}, null, 2);
            if (cardsEl) {
                cardsEl.innerHTML = `
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                            <div style="font-size: 12px; color:#666;">题目数</div>
                            <div style="font-size: 20px; font-weight: 900; color:#111827;">${Number(stats.problem_count || 0)}</div>
                        </div>
                        <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                            <div style="font-size: 12px; color:#666;">提交数</div>
                            <div style="font-size: 20px; font-weight: 900; color:#111827;">${Number(stats.submission_count || 0)}</div>
                        </div>
                        <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                            <div style="font-size: 12px; color:#666;">公开提交</div>
                            <div style="font-size: 20px; font-weight: 900; color:#111827;">${Number(stats.public_submission_count || 0)}</div>
                        </div>
                        <div style="padding: 10px 12px; border:1px solid #f0f0f0; border-radius: 12px; background:#fff;">
                            <div style="font-size: 12px; color:#666;">最佳成绩记录</div>
                            <div style="font-size: 20px; font-weight: 900; color:#111827;">${Number(stats.best_user_count || 0)}</div>
                        </div>
                    </div>
                `;
            }
            const recent = Array.isArray(stats.recent_submissions) ? stats.recent_submissions : [];
            if (recentEl) {
                recentEl.innerHTML = recent.length ? recent.map(item => `
                    <div style="padding:10px 0; border-bottom:1px solid #f0f0f0;">
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <div style="font-size:12px; font-weight:800; color:#111827;">${this.escapeHtml(String(item.user_id || 'guest'))}</div>
                            <div style="font-size:12px; color:#6b7280;">${this.escapeHtml(String(item.puzzle_id || ''))}</div>
                            <div style="font-size:12px; color:#6b7280;">${this.escapeHtml(String(item.final_status || ''))}</div>
                            <div style="font-size:12px; color:#6b7280;">score=${Number(item.final_score || 0).toFixed(2)}</div>
                        </div>
                        <div style="margin-top:4px; font-size:12px; color:#6b7280;">${this.escapeHtml(String(item.created_at || ''))}</div>
                    </div>
                `).join('') : '<div style="color:#999;">（暂无提交）</div>';
            }
        } catch (e) {
            const msg = e && e.message ? e.message : '加载失败';
            if (schemaEl) schemaEl.textContent = msg;
            if (cardsEl) cardsEl.innerHTML = `<div style="color:#ff4d4f;">${this.escapeHtml(msg)}</div>`;
            if (recentEl) recentEl.innerHTML = `<div style="color:#ff4d4f;">${this.escapeHtml(msg)}</div>`;
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
     * 读取竞赛管理面板中的 contestId
     */
    getContestDirectContestId() {
        const input = document.getElementById('admin-contest-direct-contest-id');
        const errorEl = document.getElementById('admin-contest-direct-error');
        const contestId = parseInt(String(input && input.value ? input.value : '').trim(), 10);
        if (!contestId || contestId <= 0) {
            if (errorEl) {
                errorEl.textContent = '请填写有效的 contestId（正整数）';
                errorEl.style.display = 'block';
            }
            return 0;
        }
        try { localStorage.setItem('admin_contest_direct_contest_id', String(contestId)); } catch (_) {}
        return contestId;
    }

    /**
     * 渲染 ACM 榜单/Rating 直调结果摘要
     */
    renderContestDirectSummary(data, mode) {
        const summaryEl = document.getElementById('admin-contest-direct-summary');
        if (!summaryEl) return;

        if (mode === 'persistRank') {
            const success = !!data?.success;
            summaryEl.innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
                    <div><strong>比赛ID:</strong> ${data?.contestId ?? '-'}</div>
                    <div><strong>比赛名称:</strong> ${data?.contestName || '-'}</div>
                    <div><strong>执行结果:</strong> <span style="color:${success ? '#52c41a' : '#ff4d4f'};">${success ? '成功' : '未完成'}</span></div>
                    <div><strong>榜单数:</strong> ${data?.beforeRankCount ?? 0} -> ${data?.afterRankCount ?? 0}</div>
                    <div><strong>持久化状态:</strong> ${data?.beforeRankSaveStatus || '-'} -> ${data?.afterRankSaveStatus || '-'}</div>
                </div>
            `;
        } else {
            const finished = !!data?.finished;
            const hintHtml = data?.hint
                ? `<div style="margin-top:8px; color:#d46b08;"><strong>提示:</strong> ${data.hint}</div>`
                : '';
            summaryEl.innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
                    <div><strong>比赛ID:</strong> ${data?.contestId ?? '-'}</div>
                    <div><strong>比赛名称:</strong> ${data?.contestName || '-'}</div>
                    <div><strong>执行结果:</strong> <span style="color:${finished ? '#52c41a' : '#ff4d4f'};">${finished ? 'Finished' : '未完成'}</span></div>
                    <div><strong>Rating 状态:</strong> ${data?.beforeRatingStatus || '-'} -> ${data?.afterRatingStatus || '-'}</div>
                </div>
                ${hintHtml}
            `;
        }
        summaryEl.style.display = 'block';
    }

    /**
     * ACM 榜单直调持久化
     */
    async handleContestRankPersistDirect() {
        const errorEl = document.getElementById('admin-contest-direct-error');
        const summaryEl = document.getElementById('admin-contest-direct-summary');
        const resultEl = document.getElementById('admin-contest-direct-result');
        const btn = document.getElementById('admin-contest-rank-persist-direct-btn');
        if (!errorEl || !summaryEl || !resultEl || !btn) return;

        errorEl.style.display = 'none';
        summaryEl.style.display = 'none';
        const contestId = this.getContestDirectContestId();
        if (!contestId) return;

        const confirmed = confirm(
            `确认直接持久化比赛 ${contestId} 的 ACM 榜单吗？\n\n` +
            `接口：POST /problem/tracker/admin/acm/rank/persist-direct?contestId=${contestId}\n\n` +
            `该操作会直接写入 acm_contest_rank，不经过 event。`
        );
        if (!confirmed) return;

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '持久化中...';
        resultEl.textContent = `请求中...\ncontestId=${contestId}\nmode=persist-direct\n`;

        try {
            const data = await this.apiService.adminPersistAcmRankDirect(contestId);
            this.renderContestDirectSummary(data, 'persistRank');
            resultEl.textContent = JSON.stringify(data, null, 2);
            alert(`榜单持久化完成：afterRankCount=${data?.afterRankCount ?? 0}，status=${data?.afterRankSaveStatus || '-'}`);
        } catch (e) {
            const msg = e && e.message ? e.message : '持久化失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '持久化 ACM 榜单';
        }
    }

    /**
     * ACM rating 直调 rerating
     */
    async handleContestReratingDirect() {
        const errorEl = document.getElementById('admin-contest-direct-error');
        const summaryEl = document.getElementById('admin-contest-direct-summary');
        const resultEl = document.getElementById('admin-contest-direct-result');
        const btn = document.getElementById('admin-contest-rerating-direct-btn');
        if (!errorEl || !summaryEl || !resultEl || !btn) return;

        errorEl.style.display = 'none';
        summaryEl.style.display = 'none';
        const contestId = this.getContestDirectContestId();
        if (!contestId) return;

        const confirmed = confirm(
            `确认直接执行比赛 ${contestId} 的 ACM rerating 吗？\n\n` +
            `接口：POST /problem/tracker/admin/acm/rating/rerating-direct?contestId=${contestId}\n\n` +
            `该操作会直接调用 computeRating，不经过 event。`
        );
        if (!confirmed) return;

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '执行中...';
        resultEl.textContent = `请求中...\ncontestId=${contestId}\nmode=rerating-direct\n`;

        try {
            const data = await this.apiService.adminReratingAcmDirect(contestId);
            this.renderContestDirectSummary(data, 'rerating');
            resultEl.textContent = JSON.stringify(data, null, 2);
            alert(`rerating 执行完成：status=${data?.afterRatingStatus || '-'}${data?.finished ? '' : '（未到 FINISHED）'}`);
        } catch (e) {
            const msg = e && e.message ? e.message : 'rerating 失败';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            btn.disabled = false;
            btn.textContent = oldText || '执行 ACM rerating';
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

    _parseDurationToMins(raw) {
        const s = String(raw ?? '').trim();
        if (!s) return 0;
        // number-like: treat as minutes
        if (/^\d+(\.\d+)?$/.test(s)) {
            const n = Number(s);
            if (!Number.isFinite(n) || n <= 0) return 0;
            return Math.max(1, Math.round(n));
        }
        // HH:MM:SS or MM:SS
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
            const parts = s.split(':').map(x => parseInt(x, 10));
            if (parts.some(v => !Number.isFinite(v))) return 0;
            let seconds = 0;
            if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
            else seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (seconds <= 0) return 0;
            return Math.max(1, Math.round(seconds / 60));
        }
        return 0;
    }

    _parseTruthy(raw) {
        const s = String(raw ?? '').trim().toLowerCase();
        if (!s) return null;
        if (s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === '是') return true;
        if (s === 'false' || s === '0' || s === 'no' || s === 'n' || s === '否') return false;
        return null;
    }

    /**
     * 文本/TSV/CSV -> 导入 JSON（空课程）
     *
     * 期望至少能得到：chapterPos, sectionPos, title
     * 可选：chapterTitle, duration/时长, videoId/vid, mobileVideoId, type, unitTagId, free, requireLogin
     */
    buildLivecourseImportJsonFromRaw(raw, defaults) {
        const text = String(raw || '').trim();
        if (!text) throw new Error('请输入 JSON 或文本数据');
        // JSON direct
        if (text.startsWith('{') || text.startsWith('[')) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return { chapters: parsed };
            return parsed;
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) throw new Error('未解析到任何行');

        const splitLine = (line) => {
            // 优先 tab；否则逗号；否则多空格
            if (line.includes('\t')) return line.split('\t').map(s => s.trim());
            if (line.includes(',')) return line.split(',').map(s => s.trim());
            if (line.includes('，')) return line.split('，').map(s => s.trim());
            return line.split(/\s{2,}|\s+/).map(s => s.trim());
        };

        const firstCols = splitLine(lines[0]);
        const maybeHeader = firstCols.some(c => /章|节|标题|title|vid|video|时长|duration/i.test(String(c)));
        let header = null;
        let startIdx = 0;
        if (maybeHeader) {
            header = firstCols.map(c => String(c || '').trim());
            startIdx = 1;
        }

        const normKey = (k) => String(k || '').trim().toLowerCase()
            .replace(/\s+/g, '')
            .replace(/（.*?）/g, '')
            .replace(/[()]/g, '');

        const keyMap = {
            // chapter
            '章': 'chapterPos',
            'chapter': 'chapterPos',
            'chapterpos': 'chapterPos',
            '章序': 'chapterPos',
            '章序号': 'chapterPos',
            'chapterposition': 'chapterPos',
            '章标题': 'chapterTitle',
            'chaptertitle': 'chapterTitle',
            'chaptername': 'chapterTitle',
            // section
            '节': 'sectionPos',
            'section': 'sectionPos',
            'sectionpos': 'sectionPos',
            '节序': 'sectionPos',
            '节序号': 'sectionPos',
            'sectionposition': 'sectionPos',
            // title
            '标题': 'title',
            '小节标题': 'title',
            'sectiontitle': 'title',
            'title': 'title',
            'name': 'title',
            // duration
            '时长': 'duration',
            'duration': 'duration',
            'durationmins': 'duration',
            'mins': 'duration',
            // video ids
            'vid': 'videoId',
            'videoid': 'videoId',
            'video': 'videoId',
            'mobilevideoid': 'mobileVideoId',
            // other
            'type': 'type',
            'unittagid': 'unitTagId',
            'free': 'free',
            'requirelogin': 'requireLogin',
        };

        const rows = [];
        for (let i = startIdx; i < lines.length; i++) {
            const cols = splitLine(lines[i]);
            if (cols.length === 0) continue;
            const row = {};
            if (header) {
                for (let j = 0; j < header.length; j++) {
                    const hk = keyMap[normKey(header[j])] || normKey(header[j]);
                    row[hk] = cols[j] ?? '';
                }
            } else {
                // 无表头：按最小约定
                // 章 节 标题 时长 vid mobileVideoId
                row.chapterPos = cols[0] ?? '';
                row.sectionPos = cols[1] ?? '';
                row.title = cols[2] ?? '';
                row.duration = cols[3] ?? '';
                row.videoId = cols[4] ?? '';
                row.mobileVideoId = cols[5] ?? '';
            }
            rows.push(row);
        }
        if (rows.length === 0) throw new Error('未解析到数据行（请确认第一行是否是表头）');

        const d = defaults || {};
        const defType = parseInt(String(d.type ?? 1), 10);
        const defUnitTagId = parseInt(String(d.unitTagId ?? 0), 10) || 0;
        const defFree = !!d.free;
        const defRequireLogin = !!d.requireLogin;

        // group by chapterPos
        const chaptersMap = new Map();
        const toInt = (x) => {
            const v = parseInt(String(x ?? '').trim(), 10);
            return Number.isFinite(v) ? v : 0;
        };

        for (const r of rows) {
            const cpos = toInt(r.chapterPos || r['chapterpos']);
            const spos = toInt(r.sectionPos || r['sectionpos']);
            const title = String(r.title ?? '').trim();
            if (!cpos || cpos <= 0) continue;
            if (!title) continue;
            const chapterTitle = String(r.chapterTitle ?? '').trim();

            if (!chaptersMap.has(cpos)) {
                chaptersMap.set(cpos, {
                    title: chapterTitle || `第${cpos}章`,
                    position: cpos,
                    sections: []
                });
            } else if (chapterTitle) {
                // 如果后续行补充了章标题，优先用非默认值覆盖
                const ch = chaptersMap.get(cpos);
                if (ch && (!ch.title || /^第\d+章$/.test(ch.title))) ch.title = chapterTitle;
            }

            const typeRaw = (r.type != null && String(r.type).trim() !== '') ? parseInt(String(r.type).trim(), 10) : defType;
            const type = Number.isFinite(typeRaw) ? typeRaw : defType;
            const unitTagIdRaw = (r.unitTagId != null && String(r.unitTagId).trim() !== '') ? parseInt(String(r.unitTagId).trim(), 10) : defUnitTagId;
            const unitTagId = Number.isFinite(unitTagIdRaw) ? unitTagIdRaw : defUnitTagId;
            const freeParsed = this._parseTruthy(r.free);
            const requireLoginParsed = this._parseTruthy(r.requireLogin);
            const durationMins = this._parseDurationToMins(r.duration);

            const section = {
                title,
                position: spos > 0 ? spos : undefined,
                type,
                durationMins,
                unitTagId,
                free: freeParsed == null ? defFree : freeParsed,
                requireLogin: requireLoginParsed == null ? defRequireLogin : requireLoginParsed,
            };

            const videoId = String(r.videoId ?? '').trim();
            const mobileVideoId = String(r.mobileVideoId ?? '').trim();
            if (videoId) section.videoId = videoId;
            if (mobileVideoId) section.mobileVideoId = mobileVideoId;
            if (String(r.text ?? '').trim()) section.text = String(r.text).trim();

            chaptersMap.get(cpos).sections.push(section);
        }

        const chapters = [...chaptersMap.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, ch]) => {
                // section sort by position if present
                ch.sections = (ch.sections || []).slice().sort((s1, s2) => {
                    const p1 = Number.isFinite(Number(s1.position)) ? Number(s1.position) : 0;
                    const p2 = Number.isFinite(Number(s2.position)) ? Number(s2.position) : 0;
                    return p1 - p2;
                });
                // drop undefined position to keep JSON clean
                ch.sections = ch.sections.map(s => {
                    const out = { ...s };
                    if (!out.position) delete out.position;
                    if (!out.durationMins) delete out.durationMins;
                    return out;
                });
                return ch;
            });

        if (chapters.length === 0) {
            throw new Error('未生成任何章节：请检查文本格式，至少需要“章/节/标题”列');
        }
        return { chapters };
    }

    previewLivecourseImportOneEmptyCourse() {
        const courseIdEl = document.getElementById('admin-livecourse-import-course-id');
        const dryRunEl = document.getElementById('admin-livecourse-import-dry-run');
        const rawEl = document.getElementById('admin-livecourse-import-raw');
        const typeEl = document.getElementById('admin-livecourse-import-default-type');
        const unitTagEl = document.getElementById('admin-livecourse-import-default-unitTagId');
        const freeEl = document.getElementById('admin-livecourse-import-default-free');
        const requireLoginEl = document.getElementById('admin-livecourse-import-default-requireLogin');
        const errEl = document.getElementById('admin-livecourse-import-error');
        const tipEl = document.getElementById('admin-livecourse-import-tip');
        const previewEl = document.getElementById('admin-livecourse-import-preview');
        if (!courseIdEl || !dryRunEl || !rawEl || !errEl || !previewEl || !tipEl) return;

        errEl.style.display = 'none';
        tipEl.textContent = '';

        const courseId = parseInt(String(courseIdEl.value || '').trim(), 10) || 0;
        const dryRun = !!dryRunEl.checked;
        const raw = String(rawEl.value || '').trim();
        const defaults = {
            type: parseInt(String(typeEl ? typeEl.value : '1').trim(), 10) || 1,
            unitTagId: parseInt(String(unitTagEl ? unitTagEl.value : '0').trim(), 10) || 0,
            free: !!(freeEl && freeEl.checked),
            requireLogin: !!(requireLoginEl && requireLoginEl.checked),
        };

        try {
            if (!courseId || courseId <= 0) throw new Error('请填写有效的 courseId（正整数）');
            const json = this.buildLivecourseImportJsonFromRaw(raw, defaults);
            const chapters = Array.isArray(json?.chapters) ? json.chapters : [];
            const sectionCount = chapters.reduce((acc, ch) => acc + (Array.isArray(ch.sections) ? ch.sections.length : 0), 0);
            previewEl.textContent = JSON.stringify(json, null, 2);
            tipEl.textContent = `解析完成：chapters=${chapters.length}，sections=${sectionCount}，dryRun=${dryRun ? 'true' : 'false'}。`;

            // 保存，便于刷新/切换tab复用
            try {
                localStorage.setItem('admin_livecourse_import_course_id', String(courseId));
                localStorage.setItem('admin_livecourse_import_dry_run', String(dryRun));
                localStorage.setItem('admin_livecourse_import_raw', raw);
                localStorage.setItem('admin_livecourse_import_default_type', String(defaults.type));
                localStorage.setItem('admin_livecourse_import_default_unit_tag_id', String(defaults.unitTagId));
                localStorage.setItem('admin_livecourse_import_default_free', String(!!defaults.free));
                localStorage.setItem('admin_livecourse_import_default_require_login', String(!!defaults.requireLogin));
            } catch (_) {}
        } catch (e) {
            const msg = e && e.message ? e.message : '解析失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            previewEl.textContent = `（解析失败）\n${msg}`;
        }
    }

    async submitLivecourseImportOneEmptyCourse() {
        const courseIdEl = document.getElementById('admin-livecourse-import-course-id');
        const dryRunEl = document.getElementById('admin-livecourse-import-dry-run');
        const rawEl = document.getElementById('admin-livecourse-import-raw');
        const typeEl = document.getElementById('admin-livecourse-import-default-type');
        const unitTagEl = document.getElementById('admin-livecourse-import-default-unitTagId');
        const freeEl = document.getElementById('admin-livecourse-import-default-free');
        const requireLoginEl = document.getElementById('admin-livecourse-import-default-requireLogin');
        const errEl = document.getElementById('admin-livecourse-import-error');
        const resultEl = document.getElementById('admin-livecourse-import-result');
        const previewEl = document.getElementById('admin-livecourse-import-preview');
        const btn = document.getElementById('admin-livecourse-import-submit-btn');
        if (!courseIdEl || !dryRunEl || !rawEl || !errEl || !resultEl || !previewEl) return;

        errEl.style.display = 'none';
        const courseId = parseInt(String(courseIdEl.value || '').trim(), 10) || 0;
        const dryRun = !!dryRunEl.checked;
        const raw = String(rawEl.value || '').trim();
        const defaults = {
            type: parseInt(String(typeEl ? typeEl.value : '1').trim(), 10) || 1,
            unitTagId: parseInt(String(unitTagEl ? unitTagEl.value : '0').trim(), 10) || 0,
            free: !!(freeEl && freeEl.checked),
            requireLogin: !!(requireLoginEl && requireLoginEl.checked),
        };

        let jsonObj;
        try {
            if (!courseId || courseId <= 0) throw new Error('请填写有效的 courseId（正整数）');
            jsonObj = this.buildLivecourseImportJsonFromRaw(raw, defaults);
        } catch (e) {
            const msg = e && e.message ? e.message : '参数解析失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
            return;
        }

        if (!dryRun) {
            const ok = confirm(
                `确认要对 courseId=${courseId} 执行导入并落库吗？\n\n` +
                `注意：该接口仅允许“空课程”（章节数=0）。建议先 dryRun=true 预演。`
            );
            if (!ok) return;
        }

        const oldText = btn ? btn.textContent : '';
        if (btn) {
            btn.disabled = true;
            btn.textContent = dryRun ? '校验中...' : '导入中...';
        }

        resultEl.textContent = `${dryRun ? 'dryRun 校验中...' : '导入执行中...'}\ncourseId=${courseId}\n`;

        try {
            // 同步更新预览
            previewEl.textContent = JSON.stringify(jsonObj, null, 2);
            const data = await this.apiService.adminLivecourseImportOneEmptyCourse(courseId, jsonObj, dryRun);
            resultEl.textContent = JSON.stringify(data, null, 2);
            const createdChapters = data && typeof data.createdChapters !== 'undefined' ? data.createdChapters : '-';
            const createdSections = data && typeof data.createdSections !== 'undefined' ? data.createdSections : '-';
            alert(`完成：courseId=${courseId}，dryRun=${dryRun ? 'true' : 'false'}，createdChapters=${createdChapters}，createdSections=${createdSections}`);
        } catch (e) {
            const msg = e && e.message ? e.message : '导入失败';
            errEl.textContent = msg;
            errEl.style.display = 'block';
            resultEl.textContent = `失败：${msg}`;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = oldText || '开始导入';
            }
        }
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
        return `【每日一题讲解】${safeTitle} ${prettyDate}\n每日打卡链接：${dailyLink}\n题目链接：${qLink}`;
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
                let ret = null;
                if (isEdit) {
                    // 编辑时使用按日期更新的接口，支持修改日期
                    ret = await this.apiService.adminClockQuestionUpdate(date, questionId || null, problemId || null, '');
                } else {
                    ret = await this.apiService.adminClockQuestionAdd(date, questionId || null, problemId || null, '');
                }
                // 自动题目公开（best-effort，不影响主流程）
                let pubMsg = '';
                try {
                    const finalQid = ret && (ret.questionId || ret.qid) ? String(ret.questionId || ret.qid) : '';
                    if (finalQid) {
                        const extra = (this.apiService && typeof this.apiService.loadTrackerSavedQmsHeaders === 'function')
                            ? this.apiService.loadTrackerSavedQmsHeaders()
                            : {};
                        if (!extra || Object.keys(extra).length === 0) {
                            pubMsg = '；题目公开：跳过（未配置 QMS headers）';
                        } else {
                            const r = await this.apiService.adminQmsQuestionOpenLibrarySave({
                                questionId: finalQid,
                                type: 2,
                                ids: ['400'],
                                __tracker_extra_headers: extra
                            });
                            pubMsg = r && r.ok ? '；题目公开：成功' : `；题目公开：失败（HTTP ${r?.status || 'unknown'}）`;
                        }
                    } else {
                        pubMsg = '；题目公开：跳过（未拿到 questionId）';
                    }
                } catch (e) {
                    const m = e && e.message ? e.message : 'unknown';
                    pubMsg = `；题目公开：失败（${m}）`;
                }
                modal.remove();
                this.loadClockList(this.clockPage);
                alert((isEdit ? '更新成功' : '添加成功') + pubMsg);
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
    