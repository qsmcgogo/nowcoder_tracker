/**
 * 技能树视图模块
 * 处理技能树相关的UI和逻辑
 */
import { eventBus, EVENTS } from '../events/EventBus.js';
import * as helpers from '../utils/helpers.js';

// --- 新增：前端节点ID到后端Tag ID的映射 ---
export const nodeIdToTagId = {
    'basic-output': 1001,
    'integer': 1002,
    'float': 1003,
    'char': 1004,
    'mixed-input': 1005,
    'arithmetic-add': 1006,
    'arithmetic-sub': 1007,
    'arithmetic-div-mod': 1009, // Merged from mul(1008) and div(1009)
    'bit-shift': 1010,
    'arithmetic-mod': 1011, // 注意：这个在SQL中没有，需要确认ID
    'branch-control': 1012,
    'single-loop': 1013,
    'multi-loop': 1014,
    'mixed-control': 1015,
    'array-1d': 1016,
    'array-2d': 1019,
    'string-type': 1017,
    // --- Interlude (间章：拂晓) ---
    'builtin-func': 1020,
    'lang-feature': 1021,
    'simulation-enum': 1022,
    'construction': 1023,
    'greedy-sort': 1024,
    // --- Stage 2 mappings (预分配tag_id，导表后可与后端一致) ---
    'stack': 1101,
    'queue': 1102,
    'deque': 1103,
    'bit-ops': 1104,
    'primes-divisors': 1105,
    'gcd-lcm': 1106,
    'func-def-call': 1107,
    'recursion': 1108,
    'dp-basic': 1109,
    'dp-linear': 1110,
    'prefix-diff': 1111,
    'dp-practice': 1112,
    'dfs': 1113,
    'bfs': 1114,
    'two-pointers': 1115,
    'binary-search': 1116,
    'graph-def': 1117,
    'build-graph-search': 1118,
    'unweighted-shortest': 1119,
};

// --- 新增：导出技能树的静态结构数据 ---
export const skillTreeData = {
    'newbie-130': {
        id: 'newbie-130',
        name: '新手入门130题',
        description: '覆盖了编程入门阶段的核心知识点，包括但不限于循环、数组、字符串处理、简单模拟和基础算法。',
        stages: [
            { 
                id: 'stage-1', 
                name: '第一章：晨曦微光',
                // 定义列的结构和内容
                columns: [
                    { id: 'col-1', name: '基础输出', nodeIds: ['basic-output'] },
                    { id: 'col-2', name: '基本类型与输入', nodeIds: ['integer', 'float', 'char', 'mixed-input'] },
                    { 
                        id: 'col-3', 
                        name: '算术运算', 
                        nodeIds: ['arithmetic-add', 'arithmetic-sub', 'arithmetic-div-mod', 'bit-shift', 'arithmetic-mod'] 
                    },
                    { 
                        id: 'col-4', 
                        name: '程序控制', 
                        nodeIds: ['branch-control', 'single-loop', 'multi-loop', 'mixed-control'] 
                    },
                    { 
                        id: 'col-5', 
                        name: '线性基本类型', 
                        nodeIds: ['array-1d', 'array-2d', 'string-type'] 
                    }
                ]
            },
            {
                id: 'stage-2',
                name: '第二章：懵懂新芽',
                // 章为大虚框（列），节为知识点
                columns: [
                    { id: 's2-col-struct', name: '线性数据结构', nodeIds: ['stack', 'queue', 'deque'] },
                    { id: 's2-col-math', name: '简单数学', nodeIds: ['bit-ops', 'primes-divisors', 'gcd-lcm'] },
                    { id: 's2-col-func', name: '函数', nodeIds: ['func-def-call', 'recursion'] },
                    { id: 's2-col-dp', name: '动态规划入门', nodeIds: ['dp-basic', 'dp-linear', 'prefix-diff', 'dp-practice'] }
                ]
            },
            {
                id: 'stage-3',
                name: '第三章：初显峥嵘',
                columns: [
                    { id: 's3-col-search', name: '搜索入门', nodeIds: ['dfs', 'bfs', 'two-pointers', 'binary-search'] },
                    { id: 's3-col-graph', name: '图论入门', nodeIds: ['graph-def', 'build-graph-search', 'unweighted-shortest'] }
                ]
            },
            {
                id: 'stage-4',
                name: '第四章：进阶之路'
            }
        ],
        nodes: {
            // 知识点静态数据：只保留ID, name, dependencies
            // description 和 problems 将从API获取
            'basic-output': { id: 'basic-output', name: '基础输出', dependencies: [] },
            'integer': { id: 'integer', name: '整数', dependencies: ['basic-output'] },
            'float': { id: 'float', name: '浮点数', dependencies: ['basic-output'] },
            'char': { id: 'char', name: '单个字符', dependencies: ['basic-output'] },
            'mixed-input': { id: 'mixed-input', name: '混合输入', dependencies: ['basic-output'] },
            'arithmetic-add': { id: 'arithmetic-add', name: '加减法', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
            'arithmetic-sub': { id: 'arithmetic-sub', name: '乘法', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
            'arithmetic-div-mod': { id: 'arithmetic-div-mod', name: '除法与取余', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
            'bit-shift': { id: 'bit-shift', name: '位移', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
            'arithmetic-mod': { id: 'arithmetic-mod', name: '混合运算', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
            'branch-control': { id: 'branch-control', name: '分支控制', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
            'single-loop': { id: 'single-loop', name: '单层循环', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
            'multi-loop': { id: 'multi-loop', name: '多层循环', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
            'mixed-control': { id: 'mixed-control', name: '混合控制', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
            'array-1d': { id: 'array-1d', name: '一维数组', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
            'array-2d': { id: 'array-2d', name: '二维数组', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
            'string-type': { id: 'string-type', name: '字符串', dependencies: ['integer', 'float', 'char', 'mixed-input'] }
            ,
            // --- Interlude nodes (no extra dependencies inside the interlude) ---
            'builtin-func': { id: 'builtin-func', name: '内置函数', dependencies: [] },
            'lang-feature': { id: 'lang-feature', name: '语言特性', dependencies: [] },
            'simulation-enum': { id: 'simulation-enum', name: '模拟和枚举', dependencies: [] },
            'construction': { id: 'construction', name: '构造', dependencies: [] },
            'greedy-sort': { id: 'greedy-sort', name: '贪心和排序', dependencies: [] }
            ,
            // --- Stage 2 节（知识点） ---
            // 线性数据结构
            'stack': { id: 'stack', name: '栈', dependencies: [] },
            'queue': { id: 'queue', name: '队列', dependencies: [] },
            'deque': { id: 'deque', name: '双端队列', dependencies: [] },
            // 简单数学
            'bit-ops': { id: 'bit-ops', name: '位运算', dependencies: [] },
            'primes-divisors': { id: 'primes-divisors', name: '质数和约数', dependencies: [] },
            'gcd-lcm': { id: 'gcd-lcm', name: '最大公约数与最小公倍数', dependencies: [] },
            // 函数
            'func-def-call': { id: 'func-def-call', name: '函数的定义和调用', dependencies: [] },
            'recursion': { id: 'recursion', name: '递归', dependencies: [] },
            // 动态规划入门
            'dp-basic': { id: 'dp-basic', name: 'dp入门模型', dependencies: [] },
            'dp-linear': { id: 'dp-linear', name: '线性dp', dependencies: [] },
            'prefix-diff': { id: 'prefix-diff', name: '前缀和与差分', dependencies: [] },
            'dp-practice': { id: 'dp-practice', name: 'dp入门综练', dependencies: [] },
            // 搜索入门
            'dfs': { id: 'dfs', name: 'dfs', dependencies: [] },
            'bfs': { id: 'bfs', name: 'bfs', dependencies: [] },
            'two-pointers': { id: 'two-pointers', name: '双指针', dependencies: [] },
            'binary-search': { id: 'binary-search', name: '二分搜索', dependencies: [] },
            // 图论入门
            'graph-def': { id: 'graph-def', name: '树和图的定义', dependencies: [] },
            'build-graph-search': { id: 'build-graph-search', name: '建图和图上搜索', dependencies: [] },
            'unweighted-shortest': { id: 'unweighted-shortest', name: '不带权图的最短路', dependencies: [] }
        }
    }
};

export class SkillTreeView {
    constructor(elements, state, apiService) {
        this.elements = elements; // Main App elements
        this.state = state;
        this.apiService = apiService;
        this.container = this.elements.skillTreeContainer;
        
        // Panel elements
        this.panel = document.getElementById('skill-node-panel');
        this.panelTitle = document.getElementById('skill-node-panel-title');
        this.panelScore = document.getElementById('skill-node-panel-score');
        this.panelDesc = document.getElementById('skill-node-panel-desc');
        this.panelProblems = document.getElementById('skill-node-panel-problems');
        this.panelCloseBtn = document.getElementById('skill-node-panel-close');
        
        this.lines = [];
        this.currentView = 'summary'; // 'summary' or 'detail'
        this.selectedStageId = null;
        this.activeNodeId = null; // To track which node panel is open
        
        // ------------------ 模拟数据更新 ------------------
        // 技能树的静态结构（章节、知识点名称、依赖关系）仍然保留在前端
        this.skillTrees = skillTreeData; // Use the exported data

        // this.userProgress = { ... }; // 移除旧的模拟进度数据
        this.currentStageProgress = { nodeProgress: {} }; // 用于存储当前阶段的进度
        // ---------------------------------------------

        // 全局：点击面板外关闭（对所有章节/视图通用）
        this._outsideCloseBound = false;
        this.attachGlobalPanelCloser();

        // 当切换到其他主标签页时，清理所有连线（避免残留在其它页面）
        try {
            eventBus.on(EVENTS.VIEW_CHANGED, (view) => {
                if (view !== 'skill-tree') {
                    this.clearLines();
                }
            });
        } catch (_) { /* ignore */ }
    }

    // 绑定一次全局“点击外部关闭面板”
    attachGlobalPanelCloser() {
        if (this._outsideCloseBound) return;
        this._outsideCloseBound = true;
        document.addEventListener('mousedown', (e) => {
            if (!this.panel || !this.panel.classList.contains('visible')) return;
            const target = e.target;
            const insidePanel = this.panel.contains(target) || target.closest('#skill-node-panel');
            const onNode = target.closest('.skill-node');
            const onChip = target.closest('.interlude-chip');
            if (!insidePanel && !onNode && !onChip) {
                this.hideNodePanel();
            }
        }, true);
    }

    // 主渲染函数，根据当前视图状态进行分发
    render() {
        if (!this.container) return;

        if (this.currentView === 'summary') {
            this.renderStageSummaryView();
        } else if (this.currentView === 'detail' && this.selectedStageId) {
            this.renderDetailView(this.selectedStageId);
        }
    }

    // 渲染阶段概览页 - (修改)
    async renderStageSummaryView() {
        // 概览页也需要获取所有知识点的进度来计算通关率
        const tree = this.skillTrees['newbie-130'];
        if (!tree || !tree.stages) {
            this.container.innerHTML = '<div>技能树数据加载错误</div>';
            return;
        }

        // 重新进入概览时清理旧连线
        this.clearLines();

        const isLoggedIn = this.state.isLoggedIn();
        const isAdmin = this.state.isAdmin === true;
        const allNodeIds = Object.keys(tree.nodes);
        const allTagIds = allNodeIds.map(nodeId => nodeIdToTagId[nodeId]).filter(Boolean);

        try {
            // 获取所有节点的进度
            const progressData = await this.apiService.fetchSkillTreeProgress(isLoggedIn ? this.state.loggedInUserId : null, allTagIds);
            // 额外：获取用户累计过题数，用于“跳过解锁”判定（>=50）
            let solvedCount = 0;
            if (isLoggedIn) {
                try {
                    const rank = await this.apiService.fetchRankings('problem', 1, this.state.loggedInUserId, 1);
                    const u = rank?.ranks?.[0];
                    solvedCount = Number(u?.count) || 0;
                } catch (e) {
                    // 忽略失败，不影响主流程
                }
            }
            this.currentStageProgress = progressData; // 存储进度, 格式为 { nodeProgress: { ... } }

            // 工具：将进度标准化为 0~100
            const pctOf = (tagId) => {
                const raw = (this.currentStageProgress.nodeProgress || {})[tagId] || 0;
                return raw <= 1 ? raw * 100 : raw;
            };
            // 计算某一章所有知识点的平均进度
            const calcStageAvg = (stage) => {
                if (!stage || !stage.columns || stage.columns.length === 0) return 0;
                const ids = stage.columns.flatMap(c => c.nodeIds || []);
                if (ids.length === 0) return 0;
                const vals = ids.map(n => pctOf(nodeIdToTagId[n]));
                return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
            };

            const stage1Obj = tree.stages.find(s => s.id === 'stage-1');
            const stage2Obj = tree.stages.find(s => s.id === 'stage-2');
            const stage3Obj = tree.stages.find(s => s.id === 'stage-3');
            const stage1Avg = calcStageAvg(stage1Obj);
            const stage2Avg = calcStageAvg(stage2Obj);
            const stage3Avg = calcStageAvg(stage3Obj);
            const interludeIds = ['builtin-func', 'lang-feature', 'simulation-enum', 'construction', 'greedy-sort'];
            const interludeAvg = Math.round(interludeIds.map(id => pctOf(nodeIdToTagId[id])).reduce((a,b)=>a+b,0) / interludeIds.length);

            let previousStageProgress = 100; // 第一关的前置视为已解锁，用于统一逻辑
            const stagesToRender = tree.stages.slice(0, 3);

            const stagesHtml = stagesToRender.map(stage => {
                // 每章通关率 = 该章所有知识点进度的平均值
                let progress = 0;
                if (stage.id === 'stage-1') progress = stage1Avg; else if (stage.id === 'stage-2') progress = stage2Avg; else if (stage.id === 'stage-3') progress = stage3Avg; else progress = 0;
                
                // 第二章的解锁规则：第一章达到≥70%
                let isLocked;
                let lockReason = '';
                if (!isLoggedIn && !isAdmin) {
                    isLocked = true;
                    lockReason = '请先登录开启技能树之旅';
                } else if (stage.id === 'stage-2') {
                    const meetProgress = stage1Avg >= 70;
                    const meetSolved = solvedCount >= 50;
                    isLocked = isAdmin ? false : !(meetProgress || meetSolved);
                    if (isLocked) {
                        lockReason = `第一章平均进度达到70% <br>或<br>tracker累计通过50题：${solvedCount} / 50 <span class=\"dep-cross\">×</span>`;
                    }
                } else if (stage.id === 'stage-3') {
                    isLocked = isAdmin ? false : (stage2Avg < 70);
                    if (isLocked) {
                        lockReason = `第二章平均进度达到70% <span class=\"dep-cross\">×</span>`;
                    }
                } else {
                    // 其他章节仍按上一章节100%解锁的旧规则
                    isLocked = isAdmin ? false : (previousStageProgress < 100);
                    if (isLocked) {
                        lockReason = '上一章通关（100%）后解锁 <span class=\"dep-cross\">×</span>';
                    }
                }
                previousStageProgress = progress;

                const stageClass = stage.id === 'stage-1' ? 'stage-1' : (stage.id === 'stage-2' ? 'stage-2' : (stage.id === 'stage-3' ? 'stage-3' : ''));
                const cardHtml = `
                    <div class="skill-tree-card ${stageClass} ${isLocked ? 'locked' : ''}" data-stage-id="${stage.id}" ${isLocked ? 'aria-disabled="true"' : ''}>
                        <div class="skill-tree-card__header">
                            <h3 class="skill-tree-card__title">${stage.name}</h3>
                            <span class="skill-tree-card__progress-text">通关率: ${progress}%</span>
                        </div>
                        <div class="skill-tree-card__progress-bar">
                            <div class="skill-tree-card__progress-bar-inner" style="width: ${progress}%;"></div>
                        </div>
                        ${isLocked ? `<div class=\"skill-tree-card__tooltip\">${lockReason}</div>` : ''}
                    </div>`;

                if (stage.id === 'stage-1') {
                    // 简章（间章：拂晓）解锁逻辑：第一章平均进度 ≥ 70%
                    const miniMeetProgress = stage1Avg >= 70;
                    const miniMeetSolved = solvedCount >= 50;
                    const miniIsLocked = isAdmin ? false : (!isLoggedIn || !(miniMeetProgress || miniMeetSolved));
                    const miniLockReason = !isLoggedIn
                        ? '请先登录开启技能树之旅'
                        : `第一章平均进度达到70% <br>或<br>tracker累计通过50题：${solvedCount} / 50 <span class=\"dep-cross\">×</span>`;
                   
                    return `
                        <div class="skill-tree-card-group side-mini stage-1">
                            ${cardHtml}
                            <div class="skill-tree-mini-card ${miniIsLocked ? 'locked' : ''}" data-mini-of="stage-1" title="间章：拂晓">
                                <div class="skill-tree-mini-card__header">
                                    <span class="skill-tree-mini-card__title">间章：拂晓</span>
                                    <span class="skill-tree-mini-card__progress-text">通关率: ${interludeAvg}%</span>
                                </div>
                                <div class="skill-tree-mini-card__progress-bar">
                                    <div class="skill-tree-mini-card__progress-bar-inner" style="width: ${interludeAvg}%;"></div>
                                </div>
                                ${miniIsLocked ? `<div class=\"skill-tree-card__tooltip\">${miniLockReason}</div>` : ''}
                            </div>
                        </div>
                    `;
                }

                return cardHtml;
            }).join('');

            const loginUrl = helpers.buildUrlWithChannelPut('https://ac.nowcoder.com/login?callBack=/');
            const banner = isLoggedIn 
                ? ''
                : `<div class="skill-tree-login-banner">请先登录开启技能树之旅：<a class="login-link" href="${loginUrl}" target="_blank" rel="noopener noreferrer">前往登录</a></div>`;

            this.container.innerHTML = `${banner}<div class="skill-tree-summary">${stagesHtml}
                <!-- 占位空格：第四行，撑开视觉间距 -->
                <div class="skill-tree-spacer" style="grid-column: 1 / 4; grid-row: 4; height: 10px;"></div>
            </div>`;
            this.bindSummaryEvents();
            // 待DOM稳定后绘制阶段之间的连线
            setTimeout(() => this.drawStageSummaryLines(), 0);

        } catch (error) {
            console.error('Error rendering stage summary:', error);
            this.container.innerHTML = `<div class="error">加载技能树进度失败，请稍后重试。</div>`;
        }
    }

    // 渲染技能树详情页（单个阶段） - (修改)
    async renderDetailView(stageId) {
        // 进入某章节详情前，先清理上一视图可能遗留的连线
        this.clearLines();
        const tree = this.skillTrees['newbie-130'];
        const stage = tree.stages.find(s => s.id === stageId);
        if (!stage) return;

        // 处理TBC的阶段
        if (!stage.columns || stage.columns.length === 0) {
            const html = `
                <div class="skill-tree-detail">
                    <div class="skill-tree-detail__header">
                        <button id="skill-tree-back-btn" class="back-button">&larr; 返回所有阶段</button>
                        <h2>${stage.name}</h2>
                    </div>
                    <div class="coming-soon"><h3>内容正在紧张建设中...</h3><p>敬请期待！</p></div>
                </div>
            `;
            this.container.innerHTML = html;
            this.bindDetailEvents();
            return;
        }

        this.container.innerHTML = `<div class="loading-spinner"></div>`; // 显示加载中

        try {
            // 获取本阶段所有节点的Tag ID
            const stageNodeIds = stage.columns.flatMap(c => c.nodeIds);
            const stageTagIds = stageNodeIds.map(nodeId => nodeIdToTagId[nodeId]).filter(Boolean);

            // 调用API获取进度
            const progressData = await this.apiService.fetchSkillTreeProgress(this.state.loggedInUserId, stageTagIds);
            this.currentStageProgress = progressData; // 格式为 { nodeProgress: { ... } }

            // The node states are now calculated based on progress percentage
            const nodeStates = this.calculateNodeStates(tree.nodes);
            
            let leftColumnHtml = '';
            let rightColumnHtml = '';
            const isStage2 = stage.id === 'stage-2';
            const posOrder = ['top','left','right','bottom'];
            let stage2AllHtml = '';

            if (stage.columns) {
                stage.columns.forEach((column, idx) => {
                    const nodesHtml = column.nodeIds.map(nodeId => {
                        if (tree.nodes[nodeId]) {
                            const tagId = nodeIdToTagId[nodeId];
                            let progress = this.currentStageProgress.nodeProgress[tagId] || 0;
                            progress = progress <= 1 ? Math.round(progress * 100) : Math.round(progress);
                            return this.renderNode(nodeId, tree.nodes, nodeStates, progress);
                        }
                        return '';
                    }).join('');
                    
                    let columnLockClass = '';
                    let columnElementsHtml = '';

                    // 统计本列中是否存在未解锁的节点
                    let hasLockedNode = column.nodeIds.some(id => nodeStates[id] && nodeStates[id].state === 'locked');

                    // 新规则：线性基本类型(col-5) 依赖 程序控制(col-4) 全部知识点 >=60%
                    // 若未满足，则整列保持锁定，并提示具体未达标项
                    let col5PrereqUnmet = false;
                    let col5UnmetNames = [];
                    if (column.id === 'col-5') {
                        const controlColumn = stage.columns.find(c => c.id === 'col-4');
                        if (controlColumn) {
                            col5UnmetNames = controlColumn.nodeIds.filter(nodeId => {
                                const tagId = nodeIdToTagId[nodeId];
                                const raw = this.currentStageProgress.nodeProgress[tagId] || 0;
                                const pct = raw <= 1 ? raw * 100 : raw;
                                return pct < 60;
                            }).map(nodeId => this.skillTrees['newbie-130'].nodes[nodeId]?.name || nodeId);
                            col5PrereqUnmet = col5UnmetNames.length > 0;
                        }
                    }

                    // 管理员不受列锁定与前置限制影响
                    if (!this.state.isAdmin && (hasLockedNode || col5PrereqUnmet)) {
                        columnLockClass = 'skill-tree-column--locked';

                        const lockIcon = `<img src="https://api.iconify.design/mdi/lock-outline.svg?color=%23adb5bd" class="skill-tree-column__lock-icon" alt="Locked">`;

                        // 汇总本列所有未满足的依赖（去重）
                        const unmetDeps = new Map(); // depTagId -> depNodeName
                        column.nodeIds.forEach(nodeId => {
                            const node = tree.nodes[nodeId];
                            const deps = (node && node.dependencies) ? node.dependencies : [];
                            deps.forEach(depId => {
                                const depTagId = nodeIdToTagId[depId];
                                const raw = (this.currentStageProgress.nodeProgress[depTagId] || 0);
                                const pct = raw <= 1 ? raw * 100 : raw;
                                if (pct < 60) {
                                    unmetDeps.set(depTagId, tree.nodes[depId]?.name || String(depTagId));
                                }
                            });
                        });

                        let tooltipContent = '';
                        if (column.id === 'col-5') {
                            // 线性基本类型新增解锁条件：程序控制全部>=60%
                            const unmetList = (col5UnmetNames || []).map(n => `<div class="unmet">${n} 进度达到60% <span class=\"tooltip-cross\">✗</span></div>`).join('');
                            const header = `<div>解锁条件：程序控制 所有知识点达到60%</div>`;
                            tooltipContent = header + (unmetList ? `<div style="margin-top:6px">${unmetList}</div>` : '');
                        } else if (unmetDeps.size > 0) {
                            tooltipContent = Array.from(unmetDeps.entries()).map(([depTagId, depName]) => {
                                return `<div class="unmet">${depName} 进度达到60% <span class=\"tooltip-cross\">✗</span></div>`;
                            }).join('');
                        }

                        const tooltip = `<div class="skill-tree-column__tooltip">${tooltipContent}</div>`;
                        columnElementsHtml = lockIcon + tooltip;
                    }

                    // --- Hotfix for col-5 tooltip clipping ---
                    const extraStyle = column.id === 'col-5' ? 'style="overflow: visible;"' : '';

                    const extraClasses = isStage2 ? ` two-per-row stage2-pos-${posOrder[idx] || 'top'}` : '';
                    const columnHtml = `
                        <div class="skill-tree-column ${columnLockClass}${extraClasses}" id="skill-tree-column-${column.id}" ${extraStyle}>
                            ${columnElementsHtml}
                            <h4 class="skill-tree-column__title">${column.name}</h4>
                            <div class="skill-tree-column__nodes">${nodesHtml}</div>
                        </div>
                    `;
                    if (isStage2) {
                        stage2AllHtml += columnHtml;
                    } else {
                        if (column.id === 'col-1' || column.id === 'col-2') {
                            leftColumnHtml += columnHtml;
                        } else {
                            rightColumnHtml += columnHtml;
                        }
                    }
                });
            }

            const innerLayout = isStage2
                ? `<div class="stage2-diamond">
                        <svg class="stage2-diamond-decor" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                            <path d="M5,50 L50,5 L95,50 L50,95 Z" fill="none" stroke="rgba(124,47,75,0.25)" stroke-width="1.2"></path>
                            <path d="M20,50 L50,20 L80,50 L50,80 Z" fill="none" stroke="rgba(124,47,75,0.12)" stroke-width="1"></path>
                            <path d="M50,15 L50,85 M15,50 L85,50" fill="none" stroke="rgba(124,47,75,0.18)" stroke-width="1"></path>
                        </svg>
                        ${stage2AllHtml}
                   </div>`
                : `<div class=\"skill-tree-dag-container\"><div class=\"dag-main-column\">${leftColumnHtml}</div><div class=\"dag-main-column\">${rightColumnHtml}</div></div>`;

            const html = `
                <div class="skill-tree-detail ${isStage2 ? 'skill-tree-detail--stage2' : ''}">
                    <div class="skill-tree-detail__header">
                        <button id="skill-tree-back-btn" class="back-button">&larr; 返回所有阶段</button>
                        <h2>${stage.name}</h2>
                    </div>
                    ${innerLayout}
                </div>
            `;
            this.container.innerHTML = html;
            this.bindDetailEvents();
            // 仅在“第一章：晨曦微光”中绘制列间依赖箭头
            if (stage.id === 'stage-1') {
                setTimeout(() => this.drawColumnDependencyLines(stage), 0);
            }

        } catch (error) {
            console.error(`Error rendering detail view for stage ${stageId}:`, error);
            this.container.innerHTML = `<div class="error">加载关卡详情失败，请稍后重试。</div>`;
        }
    }

    // 渲染“占位/敬请期待”详情页（用于间章：拂晓）
    renderComingSoonDetail(title) {
        const html = `
            <div class="skill-tree-detail">
                <div class="skill-tree-detail__header">
                    <button id="skill-tree-back-btn" class="back-button">&larr; 返回所有阶段</button>
                    <h2>${title}</h2>
                </div>
                <div class="coming-soon"><h3>内容正在紧张建设中...</h3><p>敬请期待！</p></div>
            </div>
        `;
        this.container.innerHTML = html;
        this.bindDetailEvents();
    }

    // 渲染“间章：拂晓” —— 5个知识点的轻量布局
    async renderInterludeDetail() {
        const tree = this.skillTrees['newbie-130'];
        const nodeIds = ['builtin-func', 'lang-feature', 'simulation-enum', 'construction', 'greedy-sort'];
        // 预取进度
        try {
            const tagIds = nodeIds.map(id => nodeIdToTagId[id]).filter(Boolean);
            if (tagIds.length) {
                const progressData = await this.apiService.fetchSkillTreeProgress(this.state.loggedInUserId, tagIds);
                this.currentStageProgress = progressData || { nodeProgress: {} };
            }
        } catch (_) { /* ignore progress fetch error */ }

        const chips = nodeIds.map((id, idx) => {
            const n = tree.nodes[id];
            const tagId = nodeIdToTagId[id];
            let pct = 0;
            if (this.currentStageProgress && this.currentStageProgress.nodeProgress) {
                const raw = this.currentStageProgress.nodeProgress[tagId] || 0;
                pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
            }
            const isCompleted = pct >= 100;
            const stateClass = isCompleted ? 'skill-node--completed' : '';
            const posClass = `interlude-chip--pos${idx + 1}`;
            let backgroundStyle = '';
            if (pct > 0 && pct < 100) {
                backgroundStyle = `style="background: linear-gradient(to right, var(--primary-color-light) ${pct}%, #fff ${pct}%);"`;
            }
            return `
                <div class="interlude-chip skill-node ${stateClass} ${posClass}" data-id="${id}" ${backgroundStyle}>
                    <div class="skill-node__title">${n.name}</div>
                    <div class="skill-node__progress-text">${pct}%</div>
                </div>
            `;
        }).join('');

        const html = `
            <div class="interlude-detail">
                <div class="interlude-ribbon">间章：拂晓</div>
                <div class="interlude-circle">
                    <svg class="interlude-magic" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(124,47,75,0.25)" stroke-width="1.5"></circle>
                        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(124,47,75,0.15)" stroke-width="1"></circle>
                        <!-- 五角形轮廓（外） -->
                        <path d="M50,10 L88,38 L74,82 L26,82 L12,38 Z" fill="none" stroke="rgba(124,47,75,0.18)" stroke-width="1.1"></path>
                        <!-- 五角形轮廓（内，整体微上移） -->
                        <path d="M50,20 L79,41 L68,74 L32,74 L21,41 Z" fill="none" stroke="rgba(124,47,75,0.12)" stroke-width="1"></path>
                        <!-- 五角星（外顶点连线） -->
                        <path d="M50,10 L74,82 L12,38 L88,38 L26,82 Z" fill="none" stroke="rgba(124,47,75,0.30)" stroke-width="1.4"></path>
                    </svg>
                    ${chips}
                </div>
            </div>
        `;
        this.container.innerHTML = html;

        // 绑定点击 -> 展示面板（沿用节点面板逻辑）
        this.container.querySelectorAll('.interlude-chip').forEach(el => {
            el.addEventListener('click', (e) => {
                const nodeId = e.currentTarget.getAttribute('data-id');
                this.showNodePanel(nodeId);
            });
        });

        // 返回按钮（复用详情页的绑定逻辑）
        // 在标题栏左上角加一个返回按钮
        const backBtn = document.createElement('button');
        backBtn.className = 'back-button';
        backBtn.textContent = '\u2190 返回所有阶段';
        backBtn.style.marginBottom = '12px';
        this.container.prepend(backBtn);
        backBtn.addEventListener('click', () => {
            this.currentView = 'summary';
            this.render();
        });
    }
    
    // 计算所有知识点和题目的状态 (修改)
    calculateNodeStates(nodes) {
        const states = {};
        // 使用获取到的真实进度, 直接解构
        const { nodeProgress } = this.currentStageProgress; 
        
        const isAdmin = this.state.isAdmin === true;
        for (const nodeId in nodes) {
            const node = nodes[nodeId];
            const tagId = nodeIdToTagId[nodeId];
            let progress = nodeProgress ? (nodeProgress[tagId] || 0) : 0;
            progress = progress <= 1 ? Math.round(progress * 100) : Math.round(progress);
            let tagState = 'locked';

            const isCompleted = progress === 100;
            const areDependenciesMet = (node.dependencies || []).every(depId => {
                const depTagId = nodeIdToTagId[depId];
                const v = nodeProgress ? (nodeProgress[depTagId] || 0) : 0;
                const pct = v <= 1 ? v * 100 : v;
                return pct >= 60;
            });

            if (isCompleted) {
                tagState = 'completed';
            } else if (isAdmin || areDependenciesMet) {
                tagState = 'unlocked';
            }
            
            if (tagState === 'locked') {
                const unmetDependencies = (node.dependencies || []).filter(depId => {
                    const depTagId = nodeIdToTagId[depId];
                    const v = nodeProgress ? (nodeProgress[depTagId] || 0) : 0;
                    const pct = v <= 1 ? v * 100 : v;
                    return pct < 60;
                });
                states[nodeId] = { state: 'locked', unmetDependencies };
            } else {
                states[nodeId] = { state: tagState, unmetDependencies: [] };
            }
        }
        return states;
    }

    // 渲染单个知识点节点 (修改)
    renderNode(nodeId, nodes, nodeStates, progress) {
        const node = nodes[nodeId];
        const stateInfo = nodeStates[nodeId];
        const stateClass = `skill-node--${stateInfo.state}`;
        
        // progress 从参数传入，不再从 this.userProgress 读取
        let backgroundStyle = '';
        if (progress > 0 && progress < 100) {
            backgroundStyle = `style="background: linear-gradient(to right, var(--primary-color-light) ${progress}%, #fff ${progress}%);"`;
        }

        return `
            <div class="skill-node ${stateClass}" data-id="${nodeId}" id="skill-node-${nodeId}" ${backgroundStyle}>
                <div class="skill-node__title">${node.name}</div>
                <div class="skill-node__progress-text">${progress}%</div>
            </div>
        `;
    }

    // 绘制列之间的依赖连线
    drawColumnDependencyLines(stage) {
        this.lines = []; // 清空旧的线
        if (!stage.columns) return;

        // 手动定义列之间的依赖关系，根据手绘图
        const dependencies = [
            { start: 'col-1', end: 'col-2', options: { startSocket: 'bottom', endSocket: 'top' } },
            { start: 'col-2', end: 'col-3', options: { startSocket: 'right', endSocket: 'left', startSocketGravity: 80, endSocketGravity: 80 } },
            { start: 'col-2', end: 'col-4', options: { startSocket: 'right', endSocket: 'left', startSocketGravity: 0, endSocketGravity: 0 } },
            { start: 'col-4', end: 'col-5', options: { startSocket: 'bottom', endSocket: 'top', startSocketGravity: 0, endSocketGravity: 0 } }
        ];

        dependencies.forEach(dep => {
            const startCol = document.getElementById(`skill-tree-column-${dep.start}`);
            const endCol = document.getElementById(`skill-tree-column-${dep.end}`);

            if (startCol && endCol) {
                const defaultOptions = {
                    color: 'rgba(173, 181, 189, 0.8)',
                    size: 2,
                    path: 'straight', // Use straight path
                    endPlug: 'arrow1',
                    endPlugSize: 1.2,
                    dash: { animation: true, len: 6, gap: 3 }
                };

                const line = new LeaderLine(
                    startCol,
                    endCol,
                    { ...defaultOptions, ...dep.options }
                );
                this.lines.push(line);
            }
        });
    }

    // 绘制依赖连线 (旧函数，保留备用)
    drawNodeDependencyLines(tree, nodeIds) {
        this.lines = []; // 保存所有线实例，以便后续移除
        nodeIds.forEach(nodeId => {
            const node = tree.nodes[nodeId];
            if (node && node.dependencies) {
                node.dependencies.forEach(depId => {
                    const startNode = document.getElementById(`skill-node-${depId}`);
                    const endNode = document.getElementById(`skill-node-${nodeId}`);

                    if (startNode && endNode) {
                        const line = new LeaderLine(
                            startNode,
                            endNode,
                            {
                                color: '#adb5bd',
                                size: 2,
                                path: 'fluid',
                                endPlug: 'arrow1',
                                endPlugSize: 1.5,
                            }
                        );
                        this.lines.push(line);
                    }
                });
            }
        });
    }

    // 清除所有连线
    clearLines() {
        if (this.lines) {
            this.lines.forEach(line => line.remove());
            this.lines = [];
        }
    }


    // 绑定概览页事件
    bindSummaryEvents() {
        const cards = this.container.querySelectorAll('.skill-tree-card');
        cards.forEach(card => {
            // 如果卡片是锁定的，则不添加点击事件
            if (card.classList.contains('locked')) {
                return;
            }
            card.addEventListener('click', () => {
                this.clearLines();
                this.selectedStageId = card.dataset.stageId;
                this.currentView = 'detail';
                this.render();
            });
        });

        // 间章：拂晓（迷你卡）点击进入：自定义迷你详情
        const mini = this.container.querySelector('.skill-tree-mini-card');
        if (mini && !mini.classList.contains('locked')) {
            mini.addEventListener('click', () => {
                this.clearLines();
                this.renderInterludeDetail();
            });
        }
    }

    // 在概览页绘制阶段之间的直线连接（第一章->第二章，第二章->第三章）
    drawStageSummaryLines() {
        try {
            const s1 = this.container.querySelector('.skill-tree-card.stage-1');
            const s2 = this.container.querySelector('.skill-tree-card.stage-2');
            const s3 = this.container.querySelector('.skill-tree-card.stage-3');

            const baseOptions = {
                color: 'rgba(173, 181, 189, 0.9)',
                size: 2,
                path: 'straight',
                startPlug: 'behind',
                endPlug: 'behind'
            };

            if (s1 && s2) {
                // 第一章右下角 → 第二章左上角
                const startA = LeaderLine.pointAnchor(s1, { x: '100%', y: '100%' });
                const endA = LeaderLine.pointAnchor(s2, { x: '0%', y: '0%' });
                const line12 = new LeaderLine(startA, endA, { ...baseOptions });
                this.lines.push(line12);
            }
            if (s2 && s3) {
                // 第二章左下角 → 第三章右上角
                const startB = LeaderLine.pointAnchor(s2, { x: '0%', y: '100%' });
                const endB = LeaderLine.pointAnchor(s3, { x: '100%', y: '0%' });
                const line23 = new LeaderLine(startB, endB, { ...baseOptions });
                this.lines.push(line23);
            }
        } catch (e) {
            // 忽略绘制失败（例如库未加载）
            console.warn('Stage summary lines draw failed:', e);
        }
    }

    // 已移除全量同步入口

    // 绑定详情页事件
    bindDetailEvents() {
        const backButton = this.container.querySelector('#skill-tree-back-btn');
        if (backButton) {
            backButton.addEventListener('click', () => {
                this.clearLines();
                this.selectedStageId = null;
                this.currentView = 'summary';
                this.render();
            });
        }

        // Bind click on skill nodes
        this.container.querySelectorAll('.skill-node').forEach(nodeEl => {
            nodeEl.addEventListener('click', (e) => {
                const nodeId = e.currentTarget.dataset.id;
                const stateInfo = this.calculateNodeStates(this.skillTrees['newbie-130'].nodes)[nodeId];
                
                // Only show panel for unlocked or completed nodes
                if (stateInfo && stateInfo.state !== 'locked') {
                    this.showNodePanel(nodeId);
                }
            });
        });

        // Bind panel close button
        if (this.panelCloseBtn) {
            this.panelCloseBtn.addEventListener('click', () => this.hideNodePanel());
        }

        // 确保全局“点击外部关闭”已绑定
        this.attachGlobalPanelCloser();
    }

    async showNodePanel(nodeId) {
        // If panel is already visible and we click a different node, handle transition
        if (this.panel.classList.contains('visible') && this.activeNodeId !== nodeId) {
            this.hideNodePanel();
            setTimeout(() => {
                this.activeNodeId = nodeId;
                this.panel.classList.add('visible');
                this.fetchAndRenderPanelContent(nodeId);
            }, 300); // Wait for hide animation
        } else {
            this.activeNodeId = nodeId;
            this.panel.classList.add('visible');
            this.fetchAndRenderPanelContent(nodeId);
        }
    }

    async fetchAndRenderPanelContent(nodeId) {
        const staticNodeData = this.skillTrees['newbie-130'].nodes[nodeId];
        if (!staticNodeData) return;

        // Show loading state first
        this.showPanelContent(staticNodeData, null, true);

        try {
            const tagInfo = await this.apiService.fetchTagInfo(nodeIdToTagId[nodeId]);
            const problemsWithStatus = await this.mergeProblemStatus(tagInfo);
            // Re-render with actual data
            this.showPanelContent(staticNodeData, problemsWithStatus, false);
        } catch (error) {
            console.error(`Failed to fetch content for node panel ${nodeId}:`, error);
            this.showPanelError(error.message);
        }
    }

    /**
     * Fetches user's AC status for all problems and merges it with the tag's problem list.
     * @param {object} tagInfo - The raw tag info from the API.
     * @returns {Promise<object>} - A promise that resolves to the tag info with an updated problems array.
     */
    async mergeProblemStatus(tagInfo) {
        // Prefer new-structure problems if present; else parse legacy string
        let problems = Array.isArray(tagInfo.problems) ? tagInfo.problems : [];
        if (problems.length === 0 && typeof tagInfo.tagQuestionstrs === 'string' && tagInfo.tagQuestionstrs.length > 2) {
            try {
                problems = JSON.parse(tagInfo.tagQuestionstrs);
            } catch (e) {
                console.error('Failed to parse tagQuestionstrs:', e);
                problems = [];
            }
        }

        // If still no problems, return as-is
        if (problems.length === 0) return { ...tagInfo, problems: [] };

        // For diff, only keep problems that have a valid problemId
        const validProblemIds = Array.from(new Set(
            problems
                .map(p => (p && p.problemId != null ? String(p.problemId).trim() : ''))
                .filter(id => id !== '')
        ));

        // If not logged in OR no valid problemIds, return without diff merge
        if (!this.state.isLoggedIn() || validProblemIds.length === 0) {
            return { ...tagInfo, problems };
        }

        const problemIds = validProblemIds; // Use problemId for diff
        const userId = this.state.loggedInUserId;

        try {
            const diffData = await this.apiService.fetchUserProblemDiff(userId, problemIds.join(','));
            const solvedIds = new Set(diffData.ac1Qids.map(String)); // Ensure IDs are strings

            const problemsWithStatus = problems.map(p => ({
                ...p,
                solved: solvedIds.has(String(p.problemId)) // Ensure comparison is string vs string
            }));
            
            return { ...tagInfo, problems: problemsWithStatus };

        } catch (error) {
            console.error('Failed to fetch or merge problem statuses:', error);
            // On failure, return problems without status
            return { ...tagInfo, problems: problems.map(p => ({...p, solved: false})) };
        }
    }

    showPanelContent(staticNodeData, tagInfo = null, isLoading = true) {
        if (isLoading) {
            this.panelTitle.textContent = staticNodeData.name;
            this.panelScore.textContent = ''; // Clear score while loading
            this.panelDesc.textContent = '正在加载描述...';
            this.panelProblems.innerHTML = '<div class="loading-spinner-small"></div>';
            return;
        }

        // 标题左侧追加刷新按钮
        this.panelTitle.innerHTML = `<button id="skill-node-refresh-btn" class="skill-node-refresh-btn" title="刷新本知识点进度">⟳</button> ${tagInfo.tagName || staticNodeData.name}`;
        this.panelDesc.textContent = tagInfo.tagDesc || '暂无描述。';

        const problems = tagInfo.problems || [];

        // Build tagId -> progress map for quick lookup
        const nodeProgress = (this.currentStageProgress && this.currentStageProgress.nodeProgress) || {};

        // Build tagId -> nodeName map for tooltip display in Chinese
        const nodesDict = this.skillTrees['newbie-130'].nodes;
        const tagIdToName = new Map(Object.entries(nodeIdToTagId).map(([nodeId, tagId]) => [String(tagId), (nodesDict[nodeId] && nodesDict[nodeId].name) || String(tagId)]));

        // Helper: parse dependency field from problem (supports 'yilai' by tagId string like "1004,1005" or array)
        const parseDeps = (p) => {
            if (Array.isArray(p.dependencies)) return p.dependencies.map(String);
            if (p.yilai == null) return [];
            if (Array.isArray(p.yilai)) return p.yilai.map(String);
            const raw = String(p.yilai).trim();
            if (!raw) return [];
            return raw.split(',').map(s => s.trim()).filter(Boolean);
        };

        // --- New Logic: Calculate and display scores by summing solved problems ---
        const totalScore = problems.reduce((sum, p) => sum + (p.score || 0), 0);
        const currentScore = problems
            .filter(p => p.solved)
            .reduce((sum, p) => sum + (p.score || 0), 0);
        
        this.panelScore.textContent = `得分/总分: ${currentScore} / ${totalScore}`;
        // --- End of New Logic ---

        if (problems.length === 0) {
            this.panelProblems.innerHTML = '<p class="no-problems-msg">暂无相关题目。</p>';
            return;
        }

        const escapeHtml = (s) => String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        // 附加题（需要在列表中加重点标识）
        const extraQuestionIds = new Set(['1497534', '11506730', '11269123']);

        const problemsHtml = problems.map(problem => {
            const isSolved = problem.solved;
            const depTagIds = parseDeps(problem);
            const unmetDeps = depTagIds.filter(tagId => {
                const v = nodeProgress[tagId] || 0;
                const pct = v <= 1 ? v * 100 : v;
                return pct < 60;
            });
            // 已通过的题目不锁定（即使依赖未达标）
            const isLocked = !this.state.isAdmin && !isSolved && unmetDeps.length > 0;
            const problemClass = `${isSolved ? 'completed' : ''} ${isLocked ? 'locked' : ''}`.trim();
            const baseUrl = `https://www.nowcoder.com/practice/${problem.uuid}`;
            const problemUrl = helpers.buildUrlWithChannelPut(baseUrl, this.state.channelPut);

            // Changed: Display score instead of difficulty text
            let scoreHtml = '';
            if (problem.score) {
                 scoreHtml = `<span class="problem-score">${problem.score}分</span>`;
            }

            // 附加题标识（根据 question_id/qid 判断）
            const qid = String(problem.qid || problem.questionId || '');
            const extraFlag = extraQuestionIds.has(qid) ? '<span class="problem-extra-flag" title="附加题">★</span>' : '';

            // Tooltip content for lock reasons, using Chinese node names
            let lockTooltipInner = '';
            if (isLocked) {
                lockTooltipInner = unmetDeps.map(tid => {
                    const name = tagIdToName.get(String(tid)) || String(tid);
                    return `${name} 进度达到60% <span class="dep-cross">×</span>`;
                }).join('<br>');
            }

            // If locked, disable link and show lock icon
            const linkAttrs = isLocked ? 'href="javascript:void(0)" class="disabled-link"' : `href="${problemUrl}" target="_blank" rel="noopener noreferrer"`;

            const lockAttr = isLocked
                ? ` data-lock-reason='${(lockTooltipInner || '前置知识点未达60%').replace(/'/g, '&#39;')}'`
                : '';

            return `
                <li class="problem-item ${problemClass}"${lockAttr}>
                    <a ${linkAttrs}>
                        <span class="problem-status-icon">${isSolved ? '✔' : ''}</span>
                        ${extraFlag}<span class="problem-title">${problem.name}</span>
                        ${scoreHtml}
                        ${isLocked ? '<span class="problem-lock-icon" aria-label="未解锁" title="未解锁"><svg class="icon-lock" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 1a5 5 0 0 0-5 5v4H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 9V6a3 3 0 1 1 6 0v4H9z"></path></svg></span>' : ''}
                    </a>
                </li>
            `;
        }).join('');

        this.panelProblems.innerHTML = `<ul>${problemsHtml}</ul>`;

        // 绑定刷新按钮：仅刷新此 tag 的进度
        const refreshBtn = document.getElementById('skill-node-refresh-btn');
        if (refreshBtn) {
            try { refreshBtn.setAttribute('type', 'button'); } catch (_) {}
            refreshBtn.addEventListener('click', async (e) => {
                // 防止影响滚动或触发父级锚点
                if (e && e.preventDefault) e.preventDefault();
                if (e && e.stopPropagation) e.stopPropagation();
                try {
                    refreshBtn.disabled = true;
                    const tagId = nodeIdToTagId[this.activeNodeId];
                    // 先触发后端同步，再读取一次最新进度
                    await this.apiService.syncSingleTag(this.state.loggedInUserId, tagId);
                    const res = await this.apiService.fetchSingleTagProgress(this.state.loggedInUserId, tagId);
                    // 更新内存中的进度
                    if (!this.currentStageProgress.nodeProgress) this.currentStageProgress.nodeProgress = {};
                    this.currentStageProgress.nodeProgress[tagId] = res.progress || 0;
                    // 仅重新渲染当前面板内容，避免跳回到概览
                    this.showPanelContent(staticNodeData, tagInfo, false);
            // 如果当前是间章视图，顺手把对应按钮的进度和底色更新一下
            this.updateInterludeChip(tagId, this.activeNodeId);
                    // 如需刷新概览，外部返回后会统一刷新
                } finally {
                    refreshBtn.disabled = false;
                }
            });
        }

        // Attach floating tooltip on body to avoid clipping
        const ensureGlobalTooltip = () => {
            if (!this._problemLockTooltip) {
                const div = document.createElement('div');
                div.className = 'floating-problem-lock-tooltip';
                div.style.display = 'none';
                document.body.appendChild(div);
                this._problemLockTooltip = div;
            }
            return this._problemLockTooltip;
        };

        const tip = ensureGlobalTooltip();
        const lockedItems = this.panelProblems.querySelectorAll('li.locked');
        lockedItems.forEach(li => {
            const show = () => {
                tip.innerHTML = li.getAttribute('data-lock-reason') || '前置知识点未达60%';
                tip.style.display = 'block';
                // initial position
                const rect = li.getBoundingClientRect();
                tip.style.left = Math.max(8, rect.left - tip.offsetWidth - 12) + 'px';
                tip.style.top = Math.max(8, rect.top + rect.height / 2 - tip.offsetHeight / 2) + 'px';
            };
            const move = (e) => {
                const rect = li.getBoundingClientRect();
                tip.style.left = Math.max(8, rect.left - tip.offsetWidth - 12) + 'px';
                tip.style.top = Math.max(8, rect.top + rect.height / 2 - tip.offsetHeight / 2) + 'px';
            };
            const hide = () => { tip.style.display = 'none'; };

            li.addEventListener('mouseenter', show);
            li.addEventListener('mousemove', move);
            li.addEventListener('mouseleave', hide);
        });
    }

    // 在“间章：拂晓”页面上，刷新某个知识点后同步更新对应按钮
    updateInterludeChip(tagId, nodeId) {
        try {
            const pctRaw = this.currentStageProgress && this.currentStageProgress.nodeProgress
                ? this.currentStageProgress.nodeProgress[tagId] || 0 : 0;
            const pct = pctRaw <= 1 ? Math.round(pctRaw * 100) : Math.round(pctRaw);
            const chip = document.querySelector(`.interlude-chip[data-id="${nodeId}"]`);
            if (!chip) return; // 不是在间章视图
            const text = chip.querySelector('.skill-node__progress-text');
            if (text) text.textContent = `${pct}%`;
            // 渐变填充
            if (pct > 0 && pct < 100) {
                chip.style.background = `linear-gradient(to right, var(--primary-color-light) ${pct}%, #fff ${pct}%)`;
            } else {
                chip.style.background = pct >= 100 ? 'var(--primary-color-light)' : '#fff';
            }
            // 完成态样式
            if (pct >= 100) chip.classList.add('skill-node--completed');
            else chip.classList.remove('skill-node--completed');
        } catch (_) {}
    }

    getDifficultyInfo(score) {
        if (score <= 1) return { text: '入门', class: 'difficulty-basic' };
        if (score <= 2) return { text: '简单', class: 'difficulty-easy' };
        if (score <= 4) return { text: '中等', class: 'difficulty-medium' };
        if (score <= 6) return { text: '困难', class: 'difficulty-hard' };
        return { text: '较难', class: 'difficulty-very-hard' };
    }

    showPanelError(message) {
        this.panelTitle.textContent = "加载失败";
        this.panelDesc.textContent = "";
        this.panelProblems.innerHTML = `<p class="error">${message}</p>`;
    }

    hideNodePanel() {
        this.panel.classList.remove('visible');
        this.activeNodeId = null;
    }

    /**
     * Resets the view to the initial stage summary.
     */
    resetView() {
        if (this.currentView === 'detail') {
            this.clearLines();
            this.selectedStageId = null;
            this.currentView = 'summary';
            // No need to re-render here, as the tab is becoming inactive.
            // The view will be correctly rendered next time it's activated.
        }
    }

    hide() {
        this.clearLines();
    }
}
