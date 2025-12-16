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
    'bit-shift': 1010,
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
    // --- Interlude 2.5 (间章：含苞) ---
    'geometry': 1200,
    'game-theory': 1201,
    'simulation-advanced': 1202,
    'construction-advanced': 1203,
    'greedy-priority-queue': 1204,
    // --- Stage 3 mappings ---
    // 搜索入门
    'dfs-advanced': 1300,
    'bfs-advanced': 1301,
    'two-pointers-advanced': 1302,
    'binary-search-advanced': 1303,
    // 图论入门
    'graph-def-advanced': 1304,
    'build-graph-search-advanced': 1305,
    'unweighted-shortest-advanced': 1306,
    // 动态规划进阶
    'backpack-intro': 1307,
    'interval-dp': 1308,
    'tree-dp': 1309,
    'state-compression-dp': 1310,
    'dp-advanced-practice': 1311,
    // 枚举进阶
    'state-compression-enum': 1312,
    'subset-enum': 1313,
    'enum-advanced-practice': 1314,
    // 并查集
    'union-find-intro': 1315,
    'minimum-spanning-tree': 1316,
    // --- Boss章节：梦 ---
    'thinking-challenge': 1400,  // 思维挑战
    'knowledge-challenge': 1401, // 知识点挑战
    'code-challenge': 1402,      // 代码挑战
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
                        nodeIds: ['arithmetic-add', 'arithmetic-sub', 'arithmetic-div-mod', 'arithmetic-mod'] 
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
                    { id: 's2-col-math', name: '简单数学', nodeIds: ['bit-ops', 'bit-shift', 'primes-divisors', 'gcd-lcm'] },
                    { id: 's2-col-func', name: '函数', nodeIds: ['func-def-call', 'recursion'] },
                    { id: 's2-col-dp', name: '动态规划入门', nodeIds: ['dp-basic', 'dp-linear', 'prefix-diff', 'dp-practice'] }
                ]
            },
            {
                id: 'stage-3',
                name: '第三章：初显峥嵘',
                columns: [
                    // 左边列：从上到下
                    { id: 's3-col-enum-advanced', name: '枚举进阶', nodeIds: ['state-compression-enum', 'enum-advanced-practice'] },
                    { id: 's3-col-dp-advanced', name: '动态规划进阶', nodeIds: ['backpack-intro', 'interval-dp', 'tree-dp', 'state-compression-dp', 'subset-enum', 'dp-advanced-practice'] },
                    // 右边列：从上到下
                    { id: 's3-col-search', name: '搜索入门', nodeIds: ['dfs-advanced', 'bfs-advanced', 'two-pointers-advanced', 'binary-search-advanced'] },
                    { id: 's3-col-graph', name: '图论入门', nodeIds: ['graph-def-advanced', 'build-graph-search-advanced', 'unweighted-shortest-advanced'] },
                    { id: 's3-col-union-find', name: '并查集', nodeIds: ['union-find-intro'] }
                ]
            },
            {
                id: 'stage-4',
                name: '第四章：韬光逐影'
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
            'bit-shift': { id: 'bit-shift', name: '位移', dependencies: [] },
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
            'unweighted-shortest': { id: 'unweighted-shortest', name: '不带权图的最短路', dependencies: [] },
            // --- Interlude 2.5 nodes (间章：含苞) ---
            'geometry': { id: 'geometry', name: '几何', dependencies: [] },
            'game-theory': { id: 'game-theory', name: '博弈', dependencies: [] },
            'simulation-advanced': { id: 'simulation-advanced', name: '模拟进阶', dependencies: [] },
            'construction-advanced': { id: 'construction-advanced', name: '构造进阶', dependencies: [] },
            'greedy-priority-queue': { id: 'greedy-priority-queue', name: '贪心和优先队列', dependencies: [] },
            // --- Stage 3 节（知识点） ---
            // 搜索入门
            'dfs-advanced': { id: 'dfs-advanced', name: 'dfs', dependencies: [] },
            'bfs-advanced': { id: 'bfs-advanced', name: 'bfs', dependencies: [] },
            'two-pointers-advanced': { id: 'two-pointers-advanced', name: '双指针', dependencies: [] },
            'binary-search-advanced': { id: 'binary-search-advanced', name: '二分搜索', dependencies: [] },
            // 图论入门
            'graph-def-advanced': { id: 'graph-def-advanced', name: '树和图的定义', dependencies: [] },
            'build-graph-search-advanced': { id: 'build-graph-search-advanced', name: '建图和图上搜索', dependencies: [] },
            'unweighted-shortest-advanced': { id: 'unweighted-shortest-advanced', name: '不带权图的最短路', dependencies: [] },
            // 动态规划进阶
            'backpack-intro': { id: 'backpack-intro', name: '背包入门', dependencies: [] },
            'interval-dp': { id: 'interval-dp', name: '区间dp', dependencies: [] },
            'tree-dp': { id: 'tree-dp', name: '树形dp', dependencies: ['graph-def-advanced', 'build-graph-search-advanced'] },
            'state-compression-dp': { id: 'state-compression-dp', name: '状压dp', dependencies: ['state-compression-enum'] },
            'dp-advanced-practice': { id: 'dp-advanced-practice', name: 'dp进阶综练', dependencies: [] },
            // 枚举进阶
            'state-compression-enum': { id: 'state-compression-enum', name: '状压枚举', dependencies: [] },
            'subset-enum': { id: 'subset-enum', name: '子集枚举', dependencies: ['state-compression-enum'] },
            'enum-advanced-practice': { id: 'enum-advanced-practice', name: '枚举进阶综练', dependencies: [] },
            // 并查集
            'union-find-intro': { id: 'union-find-intro', name: '并查集入门', dependencies: [] },
            'minimum-spanning-tree': { id: 'minimum-spanning-tree', name: '最小生成树', dependencies: [] },
            // --- Boss章节：梦 ---
            'thinking-challenge': { id: 'thinking-challenge', name: '思维挑战', dependencies: [] },
            'knowledge-challenge': { id: 'knowledge-challenge', name: '知识点挑战', dependencies: [] },
            'code-challenge': { id: 'code-challenge', name: '代码挑战', dependencies: [] }
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
        // 控制是否绘制概览页阶段之间的连线（默认关闭，以避免缩放时的错位视觉）
        this.enableSummaryLines = true;
        
        // 统一的连线重定位处理（窗口缩放/视口变化/滚动）
        this._repositionLines = () => {
            try {
                if (this.lines && this.lines.length) {
                    this.lines.forEach(line => { try { line.position(); } catch (_) {} });
                }
            } catch (_) {}
        };
        this._viewportListenersBound = false;
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
            // 当主标签切换离开技能树时，清除已绘制的连线，避免回来重复叠加
            eventBus.on(EVENTS.MAIN_TAB_CHANGED, (tab) => {
                if (tab !== 'skill-tree') {
                    this.clearLines();
                }
            });
        } catch (_) { /* ignore */ }
    }

    // 绑定一次全局"点击外部关闭面板"
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
        const tree = this.skillTrees['newbie-130'];
        if (!tree || !tree.stages) {
            this.container.innerHTML = '<div>技能树数据加载错误</div>';
            return;
        }

        // 重新进入概览时清理旧连线
        this.clearLines();

        const isLoggedIn = this.state.isLoggedIn();
        const isAdmin = this.state.isAdmin === true;

        try {
            // 使用新的章节进度接口获取所有章节的进度（后端已计算好）
            let chapterProgressMap = {};
            if (isLoggedIn) {
                try {
                    const chapterProgressList = await this.apiService.fetchChapterProgress();
                    // 将章节进度列表转换为 map，key 为章节 key（后端返回小写，如 "chapter1", "interlude_dawn"）
                    chapterProgressMap = {};
                    chapterProgressList.forEach(chapter => {
                        if (chapter.key) {
                            // 后端返回的 progress 是 0.0-1.0 的浮点数，需要转换为 0-100 的整数
                            const progressPercent = Math.round((chapter.progress || 0) * 100);
                            chapterProgressMap[chapter.key.toUpperCase()] = { progress: progressPercent };
                        }
                    });
                } catch (e) {
                    console.warn('Failed to fetch chapter progress, falling back to old method:', e);
                    // 如果新接口失败，回退到旧方法
                    chapterProgressMap = null;
                }
            }

            // 如果新接口失败或未登录，回退到旧方法：获取所有节点的进度
            if (!chapterProgressMap || Object.keys(chapterProgressMap).length === 0) {
                const allNodeIds = Object.keys(tree.nodes);
                const allTagIds = allNodeIds.map(nodeId => nodeIdToTagId[nodeId]).filter(Boolean);
                const progressData = await this.apiService.fetchSkillTreeProgress(isLoggedIn ? this.state.loggedInUserId : null, allTagIds);
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
                chapterProgressMap = {
                    'CHAPTER1': { progress: calcStageAvg(stage1Obj) },
                    'INTERLUDE_DAWN': { progress: Math.round(['builtin-func', 'lang-feature', 'simulation-enum', 'construction', 'greedy-sort'].map(id => pctOf(nodeIdToTagId[id])).reduce((a,b)=>a+b,0) / 5) },
                    'CHAPTER2': { progress: calcStageAvg(stage2Obj) },
                    'INTERLUDE_2_5': { progress: Math.round(['geometry', 'game-theory', 'simulation-advanced', 'construction-advanced', 'greedy-priority-queue'].map(id => pctOf(nodeIdToTagId[id])).reduce((a,b)=>a+b,0) / 5) },
                    'CHAPTER3': { progress: calcStageAvg(stage3Obj) }
                };
            }

            // 从章节进度 map 中获取各章节的进度
            const stage1Avg = chapterProgressMap['CHAPTER1']?.progress || 0;
            const stage2Avg = chapterProgressMap['CHAPTER2']?.progress || 0;
            const stage3Avg = chapterProgressMap['CHAPTER3']?.progress || 0;
            const interludeAvg = chapterProgressMap['INTERLUDE_DAWN']?.progress || 0;
            const interlude25Avg = chapterProgressMap['INTERLUDE_2_5']?.progress || 0;

            // 额外：获取用户累计过题数，用于"跳过解锁"判定（>=50）
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
                    const meetProgress = stage2Avg >= 70;
                    const meetSolved = solvedCount >= 80;
                    isLocked = isAdmin ? false : !(meetProgress || meetSolved);
                    if (isLocked) {
                        lockReason = `第二章平均进度达到70% <br>或<br>tracker累计通过80题：${solvedCount} / 80 <span class=\"dep-cross\">×</span>`;
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
                
                // 根据章节添加背景图案
                let backgroundPattern = '';
                if (stage.id === 'stage-1') {
                    // 第一章：晨曦微光 - 太阳发光
                    backgroundPattern = `
                        <div class="stage-bg-pattern stage-bg-sun">
                            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
                                <defs>
                                    <radialGradient id="sunGradient">
                                        <stop offset="0%" stop-color="#ffd700" stop-opacity="0.5" />
                                        <stop offset="70%" stop-color="#ffa500" stop-opacity="0.3" />
                                        <stop offset="100%" stop-color="#ff8c00" stop-opacity="0.1" />
                                    </radialGradient>
                                </defs>
                                <circle cx="100" cy="100" r="35" fill="url(#sunGradient)" />
                                <circle cx="100" cy="100" r="25" fill="#ffd700" opacity="0.3" />
                                <g stroke="#ffd700" stroke-width="2.5" fill="none" opacity="0.4">
                                    <line x1="100" y1="100" x2="100" y2="25" />
                                    <line x1="100" y1="100" x2="100" y2="175" />
                                    <line x1="100" y1="100" x2="25" y2="100" />
                                    <line x1="100" y1="100" x2="175" y2="100" />
                                    <line x1="100" y1="100" x2="40" y2="40" />
                                    <line x1="100" y1="100" x2="160" y2="160" />
                                    <line x1="100" y1="100" x2="160" y2="40" />
                                    <line x1="100" y1="100" x2="40" y2="160" />
                                </g>
                            </svg>
                        </div>
                    `;
                } else if (stage.id === 'stage-2') {
                    // 第二章：懵懂新芽 - 发芽
                    backgroundPattern = `
                        <div class="stage-bg-pattern stage-bg-sprout">
                            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
                                <defs>
                                    <linearGradient id="sproutGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                                        <stop offset="0%" stop-color="#52c41a" stop-opacity="0.3" />
                                        <stop offset="100%" stop-color="#73d13d" stop-opacity="0.4" />
                                    </linearGradient>
                                </defs>
                                <!-- 土壤 -->
                                <rect x="0" y="170" width="200" height="30" fill="#8b6914" opacity="0.15" />
                                <!-- 茎 -->
                                <path d="M 100 170 Q 98 150 100 130 Q 102 110 100 90" stroke="#52c41a" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.35" />
                                <!-- 叶子 -->
                                <ellipse cx="85" cy="100" rx="15" ry="25" fill="url(#sproutGradient)" />
                                <ellipse cx="115" cy="100" rx="15" ry="25" fill="url(#sproutGradient)" />
                                <!-- 新芽 -->
                                <path d="M 100 90 L 100 70" stroke="#52c41a" stroke-width="5" stroke-linecap="round" opacity="0.4" />
                                <circle cx="100" cy="65" r="6" fill="#73d13d" opacity="0.5" />
                            </svg>
                        </div>
                    `;
                } else if (stage.id === 'stage-3') {
                    // 第三章：初显峥嵘 - 山脉
                    backgroundPattern = `
                        <div class="stage-bg-pattern stage-bg-mountain">
                            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
                                <defs>
                                    <linearGradient id="mountainGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stop-color="#1890ff" stop-opacity="0.35" />
                                        <stop offset="50%" stop-color="#096dd9" stop-opacity="0.25" />
                                        <stop offset="100%" stop-color="#0050b3" stop-opacity="0.15" />
                                    </linearGradient>
                                </defs>
                                <!-- 远山 -->
                                <path d="M 0 160 L 40 120 L 80 140 L 120 100 L 160 130 L 200 110 L 200 200 L 0 200 Z" fill="url(#mountainGradient)" />
                                <!-- 近山 -->
                                <path d="M 0 180 L 60 130 L 120 150 L 180 100 L 200 120 L 200 200 L 0 200 Z" fill="#1890ff" opacity="0.2" />
                                <!-- 山峰细节 -->
                                <path d="M 40 120 L 50 110 L 60 120" stroke="#096dd9" stroke-width="2" fill="none" opacity="0.25" />
                                <path d="M 120 100 L 130 90 L 140 100" stroke="#096dd9" stroke-width="2" fill="none" opacity="0.25" />
                            </svg>
                        </div>
                    `;
                }
                
                const cardHtml = `
                    <div class="skill-tree-card ${stageClass} ${isLocked ? 'locked' : ''}" data-stage-id="${stage.id}" ${isLocked ? 'aria-disabled="true"' : ''}>
                        ${backgroundPattern}
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

                if (stage.id === 'stage-2') {
                    // 间章2.5（间章：含苞）解锁逻辑：第二章平均进度 ≥ 70% 或 tracker累计通过80题
                    const mini25MeetProgress = stage2Avg >= 70;
                    const mini25MeetSolved = solvedCount >= 80;
                    const mini25IsLocked = isAdmin ? false : (!isLoggedIn || !(mini25MeetProgress || mini25MeetSolved));
                    const mini25LockReason = !isLoggedIn
                        ? '请先登录开启技能树之旅'
                        : `第二章平均进度达到70% <br>或<br>tracker累计通过80题：${solvedCount} / 80 <span class=\"dep-cross\">×</span>`;
                   
                    return `
                        <div class="skill-tree-card-group side-mini-left stage-2">
                            <div class="skill-tree-mini-card ${mini25IsLocked ? 'locked' : ''}" data-mini-of="stage-2" title="间章：含苞">
                                <div class="skill-tree-mini-card__header">
                                    <span class="skill-tree-mini-card__title">间章：含苞</span>
                                    <span class="skill-tree-mini-card__progress-text">通关率: ${interlude25Avg}%</span>
                                </div>
                                <div class="skill-tree-mini-card__progress-bar">
                                    <div class="skill-tree-mini-card__progress-bar-inner" style="width: ${interlude25Avg}%;"></div>
                                </div>
                                ${mini25IsLocked ? `<div class=\"skill-tree-card__tooltip\">${mini25LockReason}</div>` : ''}
                            </div>
                            ${cardHtml}
                        </div>
                    `;
                }

                if (stage.id === 'stage-3') {
                    // 第三章后的间章：惊鸿
                    // 解锁逻辑：第三章平均进度 ≥ 70% 或 tracker累计通过100题（与 Boss 关解锁条件保持一致）
                    const jinghongAvg = 0; // 暂不单独统计间章进度，占位为 0%
                    const mini3MeetProgress = stage3Avg >= 70;
                    const mini3MeetSolved = solvedCount >= 100;
                    const mini3IsLocked = isAdmin ? false : (!isLoggedIn || !(mini3MeetProgress || mini3MeetSolved));
                    const mini3LockReason = !isLoggedIn
                        ? '请先登录开启技能树之旅'
                        : `第三章平均进度达到70% <br>或<br>tracker累计通过100题：${solvedCount} / 100 <span class=\"dep-cross\">×</span>`;

                    return `
                        <div class="skill-tree-card-group side-mini stage-3">
                            ${cardHtml}
                            <div class="skill-tree-mini-card ${mini3IsLocked ? 'locked' : ''}" data-mini-of="stage-3" title="间章：惊鸿">
                                <div class="skill-tree-mini-card__header">
                                    <span class="skill-tree-mini-card__title">间章：惊鸿</span>
                                    <span class="skill-tree-mini-card__progress-text">通关率: ${jinghongAvg}%</span>
                                </div>
                                <div class="skill-tree-mini-card__progress-bar">
                                    <div class="skill-tree-mini-card__progress-bar-inner" style="width: ${jinghongAvg}%;"></div>
                                </div>
                                ${mini3IsLocked ? `<div class=\"skill-tree-card__tooltip\">${mini3LockReason}</div>` : ''}
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

            // Boss章节：梦 - 解锁限制：第三章>=70%或通过100题
            const bossMeetProgress = stage3Avg >= 70;
            const bossMeetSolved = solvedCount >= 100;
            const bossIsLocked = isAdmin ? false : !(bossMeetProgress || bossMeetSolved);
            const bossLockReason = bossIsLocked 
                ? `第三章平均进度达到70% <br>或<br>tracker累计通过100题：${solvedCount} / 100 <span class=\"dep-cross\">×</span>`
                : '';
            
            const bossChapterHtml = `
                <div class="skill-tree-boss-container ${bossIsLocked ? 'locked' : ''}" style="grid-column: 3 / 4; grid-row: 5; display: flex; justify-content: flex-end; align-items: center; margin-top: 40px; padding: 20px; position: relative;">
                    ${bossIsLocked ? `<div class="skill-tree-card__tooltip">${bossLockReason}</div>` : ''}
                    <button class="skill-tree-boss-btn" id="skill-tree-boss-dream" ${bossIsLocked ? 'disabled' : ''} style="
                        position: relative;
                        padding: 28px 56px;
                        font-size: 32px;
                        font-weight: 800;
                        color: #fff;
                        background: ${bossIsLocked 
                            ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 30%, #4b5563 60%, #374151 100%)'
                            : 'linear-gradient(135deg, #ffb3d9 0%, #ffc0e5 30%, #ffd1f0 60%, #ffe0f5 100%)'};
                        background-size: 200% 200%;
                        border: 3px solid rgba(255, 255, 255, 0.4);
                        border-radius: 20px;
                        cursor: ${bossIsLocked ? 'not-allowed' : 'pointer'};
                        opacity: ${bossIsLocked ? '0.8' : '1'};
                        box-shadow: ${bossIsLocked 
                            ? '0 10px 30px rgba(107, 114, 128, 0.2), 0 0 50px rgba(75, 85, 99, 0.15), 0 0 80px rgba(55, 65, 81, 0.1), inset 0 2px 6px rgba(255, 255, 255, 0.2)'
                            : '0 10px 30px rgba(255, 179, 217, 0.3), 0 0 50px rgba(255, 192, 229, 0.25), 0 0 80px rgba(255, 209, 240, 0.2), inset 0 2px 6px rgba(255, 255, 255, 0.4)'};
                        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                        overflow: hidden;
                        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2), 0 0 20px rgba(255, 255, 255, 0.4);
                        letter-spacing: 4px;
                        animation: ${bossIsLocked ? 'none' : 'gradientShift 4s ease infinite'};
                    ">
                        <span style="position: relative; z-index: 2; display: flex; align-items: center; gap: 16px;">
                            <span style="font-size: 36px; filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.8)); animation: ${bossIsLocked ? 'none' : 'sparkle 2s ease-in-out infinite'}; opacity: ${bossIsLocked ? '0.5' : '1'};">✨</span>
                            <span style="color: ${bossIsLocked ? '#6b7280' : '#764ba2'}; font-weight: 900; text-shadow: 0 2px 8px rgba(118, 75, 162, 0.4);">梦</span>
                            <span style="font-size: 36px; filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.8)); animation: ${bossIsLocked ? 'none' : 'sparkle 2s ease-in-out infinite 0.5s'}; opacity: ${bossIsLocked ? '0.5' : '1'};">✨</span>
                        </span>
                        ${bossIsLocked ? '' : `<div class="boss-btn-shine" style="
                            position: absolute;
                            top: 0;
                            left: -100%;
                            width: 100%;
                            height: 100%;
                            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
                            animation: shine 3s infinite;
                            z-index: 1;
                        "></div>`}
                        <style>
                            @keyframes gradientShift {
                                0%, 100% { background-position: 0% 50%; }
                                50% { background-position: 100% 50%; }
                            }
                            @keyframes shine {
                                0% { left: -100%; }
                                50%, 100% { left: 100%; }
                            }
                            @keyframes sparkle {
                                0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
                                50% { transform: scale(1.2) rotate(180deg); opacity: 0.8; }
                            }
                            .skill-tree-boss-btn:hover:not(:disabled) {
                                transform: translateY(-6px) scale(1.08);
                                box-shadow: 0 15px 40px rgba(255, 179, 217, 0.4), 
                                            0 0 80px rgba(255, 192, 229, 0.35),
                                            0 0 120px rgba(255, 209, 240, 0.3),
                                            inset 0 2px 8px rgba(255, 255, 255, 0.5);
                                border-color: rgba(255, 255, 255, 0.6);
                            }
                            .skill-tree-boss-btn:disabled:hover {
                                transform: none;
                            }
                            .skill-tree-boss-btn:active:not(:disabled) {
                                transform: translateY(-3px) scale(1.04);
                            }
                            .skill-tree-boss-btn:not(:disabled)::before {
                                content: '';
                                position: absolute;
                                top: -50%;
                                left: -50%;
                                width: 200%;
                                height: 200%;
                                background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
                                animation: pulse 2.5s ease-in-out infinite;
                                z-index: 0;
                            }
                            @keyframes pulse {
                                0%, 100% { opacity: 0.6; transform: scale(1); }
                                50% { opacity: 1; transform: scale(1.15); }
                            }
                        </style>
                    </button>
                </div>
            `;

            // 第四章：韬光逐影，作为第二篇章（潜龙篇）的开端，目前仅做占位展示
            const stage4Obj = tree.stages.find(s => s.id === 'stage-4');
            const stage4CardHtml = stage4Obj ? `
                <div class="skill-tree-card stage-4 locked" data-stage-id="${stage4Obj.id}" aria-disabled="true" style="opacity: 0.95;">
                    <div class="stage-bg-pattern stage-bg-shadow">
                        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
                            <defs>
                                <linearGradient id="shadowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#722ed1" stop-opacity="0.2" />
                                    <stop offset="100%" stop-color="#22075e" stop-opacity="0.4" />
                                </linearGradient>
                            </defs>
                            <circle cx="100" cy="100" r="60" fill="url(#shadowGradient)" />
                            <path d="M 60 100 Q 100 40 140 100 T 60 100" fill="#ffffff" fill-opacity="0.06" />
                            <path d="M 60 100 Q 100 160 140 100 T 60 100" fill="#000000" fill-opacity="0.06" />
                        </svg>
                    </div>
                    <div class="skill-tree-card__header">
                        <h3 class="skill-tree-card__title">${stage4Obj.name}</h3>
                        <span class="skill-tree-card__progress-text">通关率: 0%</span>
                    </div>
                    <div class="skill-tree-card__progress-bar">
                        <div class="skill-tree-card__progress-bar-inner" style="width: 0%;"></div>
                    </div>
                    <div class="skill-tree-card__tooltip">内容正在建设中，敬请期待</div>
                </div>
            ` : '';

            this.container.innerHTML = `${banner}
                <!-- 萌新篇：第1~3章 + 间章 + Boss梦 -->
                <div style="border: 3px dashed #d9d9d9; border-radius: 16px; padding: 24px; margin-bottom: 24px; background: linear-gradient(135deg, rgba(255, 245, 238, 0.3) 0%, rgba(255, 250, 250, 0.2) 100%); position: relative;">
                    <div style="position: absolute; top: -14px; left: 24px; background: #fff; padding: 4px 16px; font-size: 18px; font-weight: 700; color: #fa8c16; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 8px;">
                        <span>萌新篇</span>
                        <div id="newbie-guide-help" 
                             style="width: 20px; height: 20px; border-radius: 50%; background: rgba(250, 140, 22, 0.1); border: 1px solid rgba(250, 140, 22, 0.3);
                                    display: flex; align-items: center; justify-content: center; cursor: pointer; 
                                    font-size: 12px; font-weight: bold; color: #fa8c16; transition: all 0.2s;"
                             onmouseover="this.style.background='rgba(250, 140, 22, 0.2)'; this.style.transform='scale(1.1)'"
                             onmouseout="this.style.background='rgba(250, 140, 22, 0.1)'; this.style.transform='scale(1)'">
                            ?
                        </div>
                        <div id="newbie-guide-tooltip" 
                             style="display: none; position: fixed; max-width: 400px;
                                    background: #1a1a1a; backdrop-filter: blur(10px); color: #ffffff; padding: 16px; border-radius: 12px; 
                                    font-size: 13px; line-height: 1.8; z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2);">
                            <div style="font-weight: 600; margin-bottom: 12px; color: #ffd700; display: flex; align-items: center; gap: 6px; opacity: 1;">
                                <span>📚</span> <span>萌新篇说明</span>
                            </div>
                            <div style="margin-bottom: 12px; opacity: 1;">
                                <div style="color: #ffd700; font-weight: 600; margin-bottom: 6px;">学习前置：</div>
                                <div style="color: #ffffff; margin-left: 12px;">• 具备基本的计算机操作能力</div>
                            </div>
                            <div style="padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2); opacity: 1;">
                                <div style="color: #ffd700; font-weight: 600; margin-bottom: 6px;">该篇毕业水平参考：</div>
                                <div style="color: #ffffff; margin-left: 12px;">• 牛客周赛可完成 5~6 题</div>
                                <div style="color: #ffffff; margin-left: 12px;">• 蓝桥杯 B 组全国二等奖</div>
                                <div style="color: #ffffff; margin-left: 12px;">• 百度之星可入围决赛</div>
                                <div style="color: #ffffff; margin-left: 12px;">• 区域赛概率获得铜奖</div>
                            </div>
                        </div>
                    </div>
                    <div class="skill-tree-summary">${stagesHtml}
                <!-- 占位空格：第四行，撑开视觉间距 -->
                <div class="skill-tree-spacer" style="grid-column: 1 / 4; grid-row: 4; height: 10px;"></div>
                        ${bossChapterHtml}
                    </div>
                </div>

                <!-- 潜龙篇：第4~6章 占位（先展示第四章），下方用云雾表示后续内容建设中 -->
                <div style="border: 3px dashed #d9d9d9; border-radius: 16px; padding: 24px; margin-bottom: 24px; background: linear-gradient(135deg, rgba(230, 247, 255, 0.35) 0%, rgba(241, 245, 255, 0.25) 100%); position: relative;">
                    <div style="position: absolute; top: -14px; left: 24px; background: #fff; padding: 4px 16px; font-size: 18px; font-weight: 700; color: #1890ff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 8px;">
                        <span>潜龙篇</span>
                        <div id="dragon-guide-help" 
                             style="width: 20px; height: 20px; border-radius: 50%; background: rgba(24, 144, 255, 0.06); border: 1px solid rgba(24, 144, 255, 0.25);
                                    display: flex; align-items: center; justify-content: center; cursor: pointer; 
                                    font-size: 12px; font-weight: bold; color: #1890ff; transition: all 0.2s;">
                            ?
                        </div>
                        <div id="dragon-guide-tooltip" 
                             style="display: none; position: fixed; max-width: 400px;
                                    background: #0b1220; backdrop-filter: blur(10px); color: #ffffff; padding: 16px; border-radius: 12px; 
                                    font-size: 13px; line-height: 1.8; z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.6); border: 1px solid rgba(144,205,244,0.4);">
                            <div style="font-weight: 600; margin-bottom: 12px; color: #40a9ff; display: flex; align-items: center; gap: 6px; opacity: 1;">
                                <span>🐉</span> <span>潜龙篇说明</span>
                            </div>
                            <div style="margin-bottom: 12px; opacity: 1;">
                                <div style="color: #40a9ff; font-weight: 600; margin-bottom: 6px;">学习前置（推荐）：</div>
                                <div style="color: #ffffff; margin-left: 12px;">• 已基本掌握萌新篇中的全部知识点</div>
                                <div style="color: #ffffff; margin-left: 12px;">• 对图论、动态规划等方向已有一定实践经验</div>
                            </div>
                            <div style="padding-top: 12px; border-top: 1px solid rgba(144,205,244,0.35); opacity: 1;">
                                <div style="color: #40a9ff; font-weight: 600; margin-bottom: 6px;">该篇毕业水平参考：</div>
                                <div style="color: #ffffff; margin-left: 12px;">• 区域赛稳定获得铜奖，具备争夺银奖的实力</div>
                                <div style="color: #ffffff; margin-left: 12px;">• Codeforces 稳定橙名水平</div>
                                <div style="color: #ffffff; margin-left: 12px;">• 蓝桥杯 A 组全国一等奖</div>
                            </div>
                        </div>
                    </div>
                    <div class="skill-tree-summary" style="position: relative; margin-top: 8px;">
                        ${stage4CardHtml}
                    </div>
                    <!-- 云雾渐隐效果，表示后续章节还在更新中 -->
                    <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 140px; background: linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,1) 100%); pointer-events: none; z-index: 10;"></div>
                    <div style="position: absolute; bottom: 18px; left: 0; width: 100%; text-align: center; color: #8c8c8c; font-size: 14px; z-index: 11; font-weight: 500; letter-spacing: 2px;">
                        ✨ 更多篇章正在建设中 ✨
                    </div>
            </div>`;
            this.bindSummaryEvents();
            // 概览页连线（使用SVG覆盖层，避免重复与错位）
            if (this.enableSummaryLines) setTimeout(() => this.setupSummarySvg(), 0);

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

        // 第三章已开放，正常渲染

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
            const isStage3 = stage.id === 'stage-3';
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
                    // 注意：只统计因为列级别依赖而被锁定的节点，不包括因为节点级别依赖而被锁定的节点
                    // 节点级别依赖（如状压dp依赖状压枚举）只锁定单个节点，不应该锁定整列
                    let hasLockedNode = false; // 默认不因为节点锁定而锁定整列
                    // 如果需要保留某些列因为节点锁定而锁定整列的逻辑，可以在这里添加特殊判断

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
                    
                    // 第三章：图论入门依赖搜索入门，并查集依赖图论入门
                    let colPrereqUnmet = false;
                    let colUnmetNames = [];
                    let prereqColumnName = '';
                    if (column.id === 's3-col-graph') {
                        // 图论入门依赖搜索入门
                        const searchColumn = stage.columns.find(c => c.id === 's3-col-search');
                        if (searchColumn) {
                            prereqColumnName = '搜索入门';
                            colUnmetNames = searchColumn.nodeIds.filter(nodeId => {
                                const tagId = nodeIdToTagId[nodeId];
                                const raw = this.currentStageProgress.nodeProgress[tagId] || 0;
                                const pct = raw <= 1 ? raw * 100 : raw;
                                return pct < 60;
                            }).map(nodeId => this.skillTrees['newbie-130'].nodes[nodeId]?.name || nodeId);
                            colPrereqUnmet = colUnmetNames.length > 0;
                        }
                    } else if (column.id === 's3-col-union-find') {
                        // 并查集依赖图论入门
                        const graphColumn = stage.columns.find(c => c.id === 's3-col-graph');
                        if (graphColumn) {
                            prereqColumnName = '图论入门';
                            colUnmetNames = graphColumn.nodeIds.filter(nodeId => {
                                const tagId = nodeIdToTagId[nodeId];
                                const raw = this.currentStageProgress.nodeProgress[tagId] || 0;
                                const pct = raw <= 1 ? raw * 100 : raw;
                                return pct < 60;
                            }).map(nodeId => this.skillTrees['newbie-130'].nodes[nodeId]?.name || nodeId);
                            colPrereqUnmet = colUnmetNames.length > 0;
                        }
                    }

                    // 管理员不受列锁定与前置限制影响
                    if (!this.state.isAdmin && (hasLockedNode || col5PrereqUnmet || colPrereqUnmet)) {
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
                        } else if (column.id === 's3-col-graph' || column.id === 's3-col-union-find') {
                            // 第三章：图论入门依赖搜索入门，并查集依赖图论入门
                            const unmetList = (colUnmetNames || []).map(n => `<div class="unmet">${n} 进度达到60% <span class=\"tooltip-cross\">✗</span></div>`).join('');
                            const header = `<div>解锁条件：${prereqColumnName} 所有知识点达到60%</div>`;
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
                    } else if (isStage3) {
                        // 第三章布局：左边是枚举进阶和动态规划进阶，右边是搜索入门、图论入门、并查集
                        if (column.id === 's3-col-enum-advanced' || column.id === 's3-col-dp-advanced') {
                            leftColumnHtml += columnHtml;
                        } else {
                            rightColumnHtml += columnHtml;
                        }
                    } else {
                        // 第一章布局
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
                            <!-- 扁一些的菱形（减少上下高度） -->
                            <path d="M18,50 L50,28 L82,50 L50,72 Z" fill="none" stroke="rgba(124,47,75,0.25)" stroke-width="1.2"></path>
                            <path d="M30,50 L50,40 L70,50 L50,60 Z" fill="none" stroke="rgba(124,47,75,0.12)" stroke-width="1"></path>
                            <path d="M50,34 L50,66 M24,50 L76,50" fill="none" stroke="rgba(124,47,75,0.18)" stroke-width="1"></path>
                        </svg>
                        ${stage2AllHtml}
                   </div>`
                : `<div class=\"skill-tree-dag-container ${isStage3 ? 'skill-tree-dag-container--stage3' : ''}\"><div class=\"dag-main-column\">${leftColumnHtml}</div><div class=\"dag-main-column\">${rightColumnHtml}</div></div>`;

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
            // 仅在"第一章：晨曦微光"中绘制列间依赖箭头
            if (stage.id === 'stage-1') {
                setTimeout(() => this.drawColumnDependencyLines(stage), 0);
            }
            // 第二章：动态调整菱形SVG位置以匹配虚框位置
            if (stage.id === 'stage-2') {
                setTimeout(() => this.updateStage2DiamondPosition(), 0);
            }
            // 第三章：绘制列间依赖箭头（图论入门依赖搜索入门，并查集依赖图论入门）
            if (stage.id === 'stage-3') {
                setTimeout(() => this.drawColumnDependencyLines(stage), 0);
            }

        } catch (error) {
            console.error(`Error rendering detail view for stage ${stageId}:`, error);
            this.container.innerHTML = `<div class="error">加载关卡详情失败，请稍后重试。</div>`;
        }
    }

    // 渲染"占位/敬请期待"详情页（用于间章：拂晓）
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

    // 渲染"间章：拂晓" —— 5个知识点的轻量布局
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

    // 渲染Boss章节"梦"的详情页
    async renderBossDreamDetail() {
        const tree = this.skillTrees['newbie-130'];
        const nodeIds = ['thinking-challenge', 'knowledge-challenge', 'code-challenge'];
        
        // 预取进度
        try {
            const tagIds = nodeIds.map(id => nodeIdToTagId[id]).filter(Boolean);
            if (tagIds.length && this.state.isLoggedIn()) {
                const progressData = await this.apiService.fetchSkillTreeProgress(this.state.loggedInUserId, tagIds);
                this.currentStageProgress = progressData || { nodeProgress: {} };
            } else {
                this.currentStageProgress = { nodeProgress: {} };
            }
        } catch (_) { 
            this.currentStageProgress = { nodeProgress: {} };
        }

        // 检查所有知识点是否都完成
        const allCompleted = nodeIds.every((id) => {
            const tagId = nodeIdToTagId[id];
            if (!tagId || !this.currentStageProgress || !this.currentStageProgress.nodeProgress) {
                return false;
            }
            const raw = this.currentStageProgress.nodeProgress[tagId] || 0;
            const pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
            return pct >= 100;
        });

        // 根据完成状态选择风格：暗黑风 vs 童话风
        const isFairyTaleStyle = allCompleted;

        // 渲染三个知识点卡片
        const challengeCards = nodeIds.map((id, idx) => {
            const n = tree.nodes[id];
            const tagId = nodeIdToTagId[id];
            let pct = 0;
            if (this.currentStageProgress && this.currentStageProgress.nodeProgress) {
                const raw = this.currentStageProgress.nodeProgress[tagId] || 0;
                pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
            }
            const isCompleted = pct >= 100;
            
            // 根据风格和索引设置不同的主题色
            const darkColors = [
                { primary: '#9d4edd', secondary: '#c77dff', glow: 'rgba(157, 78, 221, 0.4)' }, // 紫色 - 思维挑战
                { primary: '#e63946', secondary: '#ff6b7a', glow: 'rgba(230, 57, 70, 0.4)' }, // 红色 - 知识点挑战
                { primary: '#06d6a0', secondary: '#4ecdc4', glow: 'rgba(6, 214, 160, 0.4)' }  // 青色 - 代码挑战
            ];
            const fairyTaleColors = [
                { primary: '#ff6b9d', secondary: '#ffb3d9', glow: 'rgba(255, 107, 157, 0.5)', bg: 'linear-gradient(135deg, #fff0f5 0%, #ffe4e1 50%, #fff5ee 100%)' }, // 粉红 - 思维挑战
                { primary: '#ffd700', secondary: '#ffed4e', glow: 'rgba(255, 215, 0, 0.5)', bg: 'linear-gradient(135deg, #fffacd 0%, #fff8dc 50%, #ffffe0 100%)' }, // 金色 - 知识点挑战
                { primary: '#87ceeb', secondary: '#b0e0e6', glow: 'rgba(135, 206, 235, 0.5)', bg: 'linear-gradient(135deg, #e0f6ff 0%, #f0f8ff 50%, #e6f3ff 100%)' }  // 天蓝 - 代码挑战
            ];
            const colorTheme = isFairyTaleStyle ? fairyTaleColors[idx] : darkColors[idx];
            
            // 根据风格选择背景和文字颜色
            const cardBg = isFairyTaleStyle 
                ? colorTheme.bg 
                : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
            const textColor = isFairyTaleStyle ? '#333' : '#fff';
            const subTextColor = isFairyTaleStyle ? '#666' : '#888';
            const progressBg = isFairyTaleStyle 
                ? 'rgba(255, 255, 255, 0.6)' 
                : 'rgba(0, 0, 0, 0.4)';
            const progressBorder = isFairyTaleStyle 
                ? 'rgba(0, 0, 0, 0.1)' 
                : 'rgba(255, 255, 255, 0.1)';
            const shadowColor = isFairyTaleStyle 
                ? 'rgba(255, 107, 157, 0.3)' 
                : 'rgba(0, 0, 0, 0.5)';
            
            return `
                <div class="boss-challenge-card ${isFairyTaleStyle ? 'fairy-tale' : 'dark'}" data-node-id="${id}" style="
                    background: ${cardBg};
                    border: 3px solid ${colorTheme.primary};
                    border-radius: 24px;
                    padding: 32px;
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: ${isFairyTaleStyle 
                        ? `0 8px 32px ${shadowColor}, 0 0 60px ${colorTheme.glow}, inset 0 2px 8px rgba(255, 255, 255, 0.8)` 
                        : `0 8px 24px rgba(0, 0, 0, 0.5), 0 0 40px ${colorTheme.glow}, inset 0 1px 2px rgba(255, 255, 255, 0.1)`};
                ">
                    ${isFairyTaleStyle ? `
                        <!-- 童话风格装饰：星星和彩虹 -->
                        <div style="
                            position: absolute;
                            top: 10px;
                            right: 15px;
                            font-size: 24px;
                            opacity: 0.6;
                            animation: twinkle 2s ease-in-out infinite;
                            z-index: 0;
                        ">⭐</div>
                        <div style="
                            position: absolute;
                            bottom: 10px;
                            left: 15px;
                            font-size: 20px;
                            opacity: 0.5;
                            animation: twinkle 2s ease-in-out infinite 1s;
                            z-index: 0;
                        ">✨</div>
                        <div style="
                            position: absolute;
                            top: 50%;
                            left: -20px;
                            width: 60px;
                            height: 4px;
                            background: linear-gradient(90deg, ${colorTheme.primary}, ${colorTheme.secondary}, ${colorTheme.primary});
                            border-radius: 2px;
                            opacity: 0.3;
                            transform: rotate(45deg);
                            animation: rainbowShift 3s ease-in-out infinite;
                            z-index: 0;
                        "></div>
                    ` : `
                        <!-- 暗黑风格背景光效 -->
                        <div style="
                            position: absolute;
                            top: -50%;
                            left: -50%;
                            width: 200%;
                            height: 200%;
                            background: radial-gradient(circle, ${colorTheme.glow} 0%, transparent 70%);
                            animation: challengeGlow 3s ease-in-out infinite;
                            z-index: 0;
                        "></div>
                        
                        <!-- 装饰性边框光效 -->
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            border-radius: 20px;
                            padding: 2px;
                            background: linear-gradient(135deg, ${colorTheme.primary}, ${colorTheme.secondary}, ${colorTheme.primary});
                            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                            -webkit-mask-composite: xor;
                            mask-composite: exclude;
                            opacity: 0.6;
                            z-index: 1;
                        "></div>
                    `}
                    
                    <!-- 内容 -->
                    <div style="position: relative; z-index: 2;">
                        <!-- 图标和标题 -->
                        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
                            <div style="
                                width: 64px;
                                height: 64px;
                                background: ${isFairyTaleStyle 
                                    ? `linear-gradient(135deg, ${colorTheme.primary}, ${colorTheme.secondary})` 
                                    : `linear-gradient(135deg, ${colorTheme.primary}, ${colorTheme.secondary})`};
                                border-radius: ${isFairyTaleStyle ? '50%' : '12px'};
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 32px;
                                box-shadow: ${isFairyTaleStyle 
                                    ? `0 6px 20px ${colorTheme.glow}, inset 0 2px 4px rgba(255, 255, 255, 0.8)` 
                                    : `0 4px 12px ${colorTheme.glow}`};
                                animation: iconPulse 2s ease-in-out infinite;
                                ${isFairyTaleStyle ? 'border: 3px solid rgba(255, 255, 255, 0.8);' : ''}
                            ">
                                ${idx === 0 ? '🧠' : idx === 1 ? '📚' : '💻'}
                            </div>
                            <div style="flex: 1;">
                                <div style="
                                    font-size: 26px;
                                    font-weight: 800;
                                    color: ${textColor};
                                    margin-bottom: 4px;
                                    text-shadow: ${isFairyTaleStyle 
                                        ? `0 2px 8px ${colorTheme.glow}, 0 0 20px rgba(255, 255, 255, 0.5)` 
                                        : `0 0 20px ${colorTheme.glow}`};
                                ">${n.name}</div>
                                <div style="
                                    font-size: 14px;
                                    color: ${subTextColor};
                                    text-transform: uppercase;
                                    letter-spacing: 2px;
                                    font-weight: ${isFairyTaleStyle ? '600' : '400'};
                                ">Challenge ${idx + 1}</div>
                            </div>
                        </div>
                        
                        <!-- 进度条 -->
                        <div style="
                            background: ${progressBg};
                            border-radius: 12px;
                            height: 14px;
                            overflow: hidden;
                            margin-bottom: 16px;
                            position: relative;
                            border: 2px solid ${progressBorder};
                            ${isFairyTaleStyle ? 'box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);' : ''}
                        ">
                            <div style="
                                width: ${pct}%;
                                height: 100%;
                                background: linear-gradient(90deg, ${colorTheme.primary}, ${colorTheme.secondary});
                                border-radius: 12px;
                                transition: width 0.5s ease;
                                box-shadow: ${isFairyTaleStyle 
                                    ? `0 2px 8px ${colorTheme.glow}, inset 0 1px 2px rgba(255, 255, 255, 0.8)` 
                                    : `0 0 20px ${colorTheme.glow}`};
                                position: relative;
                                overflow: hidden;
                            ">
                                <div style="
                                    position: absolute;
                                    top: 0;
                                    left: -100%;
                                    width: 100%;
                                    height: 100%;
                                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, ${isFairyTaleStyle ? '0.6' : '0.3'}), transparent);
                                    animation: progressShine 2s infinite;
                                "></div>
                            </div>
                        </div>
                        
                        <!-- 进度文字 -->
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            color: ${subTextColor};
                            font-size: 15px;
                            font-weight: ${isFairyTaleStyle ? '600' : '400'};
                        ">
                            <span>进度</span>
                            <span style="
                                color: ${colorTheme.primary};
                                font-weight: 800;
                                font-size: 20px;
                                text-shadow: ${isFairyTaleStyle 
                                    ? `0 2px 4px ${colorTheme.glow}` 
                                    : `0 0 10px ${colorTheme.glow}`};
                            ">${pct}%</span>
                        </div>
                        
                        ${isCompleted ? `
                            <div style="
                                margin-top: 18px;
                                padding: 10px 18px;
                                background: ${isFairyTaleStyle 
                                    ? `linear-gradient(135deg, ${colorTheme.primary}, ${colorTheme.secondary})` 
                                    : `linear-gradient(135deg, ${colorTheme.primary}, ${colorTheme.secondary})`};
                                border-radius: 12px;
                                color: #fff;
                                font-weight: 700;
                                text-align: center;
                                font-size: 15px;
                                box-shadow: ${isFairyTaleStyle 
                                    ? `0 6px 20px ${colorTheme.glow}, inset 0 2px 4px rgba(255, 255, 255, 0.5)` 
                                    : `0 4px 12px ${colorTheme.glow}`};
                                border: ${isFairyTaleStyle ? '2px solid rgba(255, 255, 255, 0.8);' : 'none'};
                            ">✨ 已完成 ✨</div>
                        ` : ''}
                    </div>
                    
                    <style>
                        @keyframes challengeGlow {
                            0%, 100% { opacity: 0.3; transform: scale(1) rotate(0deg); }
                            50% { opacity: 0.6; transform: scale(1.1) rotate(180deg); }
                        }
                        @keyframes iconPulse {
                            0%, 100% { transform: scale(1); }
                            50% { transform: scale(1.1); }
                        }
                        @keyframes progressShine {
                            0% { left: -100%; }
                            100% { left: 100%; }
                        }
                        @keyframes twinkle {
                            0%, 100% { opacity: 0.4; transform: scale(1) rotate(0deg); }
                            50% { opacity: 0.8; transform: scale(1.2) rotate(180deg); }
                        }
                        @keyframes rainbowShift {
                            0%, 100% { opacity: 0.2; transform: rotate(45deg) translateX(0); }
                            50% { opacity: 0.4; transform: rotate(45deg) translateX(20px); }
                        }
                        .boss-challenge-card:hover {
                            transform: translateY(-${isFairyTaleStyle ? '10' : '8'}px) scale(1.03);
                            box-shadow: ${isFairyTaleStyle 
                                ? `0 15px 40px ${shadowColor}, 0 0 80px ${colorTheme.glow}, inset 0 2px 10px rgba(255, 255, 255, 0.9)` 
                                : `0 12px 32px rgba(0, 0, 0, 0.6), 0 0 60px ${colorTheme.glow}, inset 0 1px 2px rgba(255, 255, 255, 0.15)`};
                            border-color: ${colorTheme.secondary};
                        }
                    </style>
                </div>
            `;
        }).join('');

        // 根据完成状态选择整体背景样式
        const pageBg = isFairyTaleStyle 
            ? 'linear-gradient(to bottom, #fff0f5 0%, #ffe4e1 30%, #fff5ee 60%, #f0f8ff 100%)'
            : 'linear-gradient(to bottom, #0a0a0f, #1a1a2e)';
        const backButtonStyle = isFairyTaleStyle
            ? 'margin-bottom: 24px; background: linear-gradient(135deg, #ffb3d9, #ffc0e5); color: #333; border-color: rgba(255, 255, 255, 0.8); font-weight: 600; box-shadow: 0 4px 12px rgba(255, 179, 217, 0.4);'
            : 'margin-bottom: 24px; background: rgba(255, 255, 255, 0.1); color: #fff; border-color: rgba(255, 255, 255, 0.2);';
        const titleTextShadow = isFairyTaleStyle
            ? 'drop-shadow(0 4px 12px rgba(255, 179, 217, 0.6)) drop-shadow(0 0 30px rgba(255, 192, 229, 0.5))'
            : 'drop-shadow(0 4px 12px rgba(255, 179, 217, 0.4))';
        const subtitleColor = isFairyTaleStyle ? '#ff6b9d' : '#ff9ec7';
        const sloganBg = isFairyTaleStyle
            ? 'linear-gradient(135deg, rgba(255, 240, 245, 0.95) 0%, rgba(255, 228, 225, 0.95) 50%, rgba(255, 245, 238, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(22, 33, 62, 0.8) 100%)';
        const sloganBorder = isFairyTaleStyle
            ? '3px solid rgba(255, 107, 157, 0.5)'
            : '2px solid rgba(255, 179, 217, 0.3)';
        const sloganShadow = isFairyTaleStyle
            ? '0 10px 40px rgba(255, 179, 217, 0.3), 0 0 80px rgba(255, 192, 229, 0.2), inset 0 2px 8px rgba(255, 255, 255, 0.8)'
            : '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 60px rgba(255, 192, 229, 0.15), inset 0 2px 4px rgba(255, 255, 255, 0.1)';
        const sloganTextColor = isFairyTaleStyle ? '#555' : '#ddd';
        const sectionTitleColor = isFairyTaleStyle ? '#333' : '#fff';
        const sectionTitleShadow = isFairyTaleStyle
            ? '0 2px 8px rgba(255, 179, 217, 0.4), 0 0 20px rgba(255, 192, 229, 0.3)'
            : '0 0 20px rgba(255, 179, 217, 0.5)';

        const html = `
            <div class="boss-dream-detail ${isFairyTaleStyle ? 'fairy-tale-mode' : 'dark-mode'}" style="background: ${pageBg}; min-height: 100vh; padding: 40px 20px; position: relative; overflow: hidden;">
                ${isFairyTaleStyle ? `
                    <!-- 童话风格背景装饰：云朵和彩虹 -->
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        pointer-events: none;
                        z-index: 0;
                        overflow: hidden;
                    ">
                        <div style="
                            position: absolute;
                            top: 10%;
                            left: 5%;
                            width: 120px;
                            height: 60px;
                            background: rgba(255, 255, 255, 0.6);
                            border-radius: 60px;
                            opacity: 0.4;
                            animation: cloudFloat 8s ease-in-out infinite;
                        "></div>
                        <div style="
                            position: absolute;
                            top: 10%;
                            left: 5%;
                            width: 100px;
                            height: 50px;
                            background: rgba(255, 255, 255, 0.6);
                            border-radius: 50px;
                            margin-left: 20px;
                            margin-top: 20px;
                            opacity: 0.4;
                            animation: cloudFloat 8s ease-in-out infinite;
                        "></div>
                        <div style="
                            position: absolute;
                            top: 20%;
                            right: 10%;
                            width: 100px;
                            height: 50px;
                            background: rgba(255, 255, 255, 0.5);
                            border-radius: 50px;
                            opacity: 0.3;
                            animation: cloudFloat 10s ease-in-out infinite 2s;
                        "></div>
                        <div style="
                            position: absolute;
                            top: 20%;
                            right: 10%;
                            width: 80px;
                            height: 40px;
                            background: rgba(255, 255, 255, 0.5);
                            border-radius: 40px;
                            margin-right: 15px;
                            margin-top: 15px;
                            opacity: 0.3;
                            animation: cloudFloat 10s ease-in-out infinite 2s;
                        "></div>
                        <div style="
                            position: absolute;
                            bottom: 15%;
                            left: 50%;
                            transform: translateX(-50%);
                            width: 200px;
                            height: 8px;
                            background: linear-gradient(90deg, #ff6b9d, #ffd700, #87ceeb, #ff6b9d);
                            border-radius: 4px;
                            opacity: 0.3;
                            animation: rainbowGlow 4s ease-in-out infinite;
                        "></div>
                    </div>
                ` : ''}
                
                <!-- 返回按钮 -->
                <button id="skill-tree-back-btn" class="back-button" style="${backButtonStyle}">&larr; 返回所有阶段</button>
                
                <!-- 标题区域 -->
                <div class="boss-dream-header" style="text-align: center; margin-bottom: 50px; position: relative; z-index: 1;">
                        <div style="
                            font-size: 56px;
                            font-weight: 800;
                            margin-bottom: 20px;
                            background: linear-gradient(135deg, #ffb3d9 0%, #ffc0e5 50%, #ffd1f0 100%);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                            letter-spacing: 4px;
                            filter: ${titleTextShadow};
                        ">✨ 梦 ✨</div>
                        <div style="
                            font-size: 20px;
                            font-weight: 600;
                            color: ${subtitleColor};
                            margin-bottom: 8px;
                            letter-spacing: 2px;
                        ">Boss章节</div>
                        <div style="
                            width: 120px;
                            height: 3px;
                            background: linear-gradient(90deg, transparent, #ffb3d9, transparent);
                            margin: 0 auto;
                            border-radius: 2px;
                        "></div>
                </div>
                
                <!-- 标语区域 -->
                <div class="boss-dream-slogan" style="
                    background: ${sloganBg};
                    border: ${sloganBorder};
                    border-radius: 24px;
                    padding: 40px 48px;
                    margin: 0 auto 50px;
                    max-width: 900px;
                    box-shadow: ${sloganShadow};
                    position: relative;
                    overflow: hidden;
                    z-index: 1;
                ">
                    <!-- 背景光晕动画 -->
                    <div style="
                        position: absolute;
                        top: -50%;
                        left: -50%;
                        width: 200%;
                        height: 200%;
                        background: radial-gradient(circle, ${isFairyTaleStyle ? 'rgba(255, 192, 229, 0.3)' : 'rgba(255, 255, 255, 0.05)'} 0%, transparent 70%);
                        animation: dreamPulse 4s ease-in-out infinite;
                        z-index: 0;
                    "></div>
                    
                    ${isFairyTaleStyle ? `
                        <!-- 童话风格装饰：星星 -->
                        <div style="
                            position: absolute;
                            top: 20px;
                            right: 30px;
                            font-size: 28px;
                            opacity: 0.5;
                            animation: twinkle 2s ease-in-out infinite;
                            z-index: 0;
                        ">⭐</div>
                        <div style="
                            position: absolute;
                            bottom: 20px;
                            left: 30px;
                            font-size: 24px;
                            opacity: 0.4;
                            animation: twinkle 2s ease-in-out infinite 1s;
                            z-index: 0;
                        ">✨</div>
                    ` : ''}
                    
                    <div style="position: relative; z-index: 1;">
                        <div style="
                            font-size: 19px;
                            line-height: 2;
                            color: ${sloganTextColor};
                            text-align: center;
                            font-weight: 500;
                        ">
                            <p style="margin-bottom: 20px;">
                                完成此章节，对于非竞赛选手来说，<strong style="color: ${isFairyTaleStyle ? '#ff6b9d' : '#ff9ec7'}; font-size: 20px;">算法、代码、思维的掌握已经达标</strong>。
                            </p>
                            <p style="margin: 0;">
                                如果希望未来在<strong style="color: ${isFairyTaleStyle ? '#ff8cc0' : '#ff8cc0'}; font-size: 20px;">ICPC/CCPC</strong>等竞赛中获取成绩，则需要进行下一步的学习。
                            </p>
                        </div>
                    </div>
                    <style>
                        @keyframes dreamPulse {
                            0%, 100% { opacity: ${isFairyTaleStyle ? '0.5' : '0.3'}; transform: scale(1); }
                            50% { opacity: ${isFairyTaleStyle ? '0.8' : '0.6'}; transform: scale(1.15); }
                        }
                        ${isFairyTaleStyle ? `
                            @keyframes cloudFloat {
                                0%, 100% { transform: translateX(0) translateY(0); }
                                50% { transform: translateX(20px) translateY(-10px); }
                            }
                            @keyframes rainbowGlow {
                                0%, 100% { opacity: 0.2; }
                                50% { opacity: 0.5; }
                            }
                        ` : ''}
                    </style>
                </div>
                
                <!-- 知识点挑战区域 -->
                <div class="boss-dream-content" style="
                    padding: 40px 20px;
                    margin: 0 auto;
                    max-width: 1200px;
                    position: relative;
                    z-index: 1;
                ">
                    <div style="
                        font-size: 28px;
                        font-weight: 700;
                        color: ${sectionTitleColor};
                        text-align: center;
                        margin-bottom: 40px;
                        text-shadow: ${sectionTitleShadow};
                    ">三大挑战</div>
                    
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                        gap: 32px;
                        margin-bottom: ${isFairyTaleStyle ? '60px' : '40px'};
                    ">
                        ${challengeCards}
                    </div>
                    
                    ${isFairyTaleStyle ? `
                        <!-- "新的挑战"按钮 -->
                        <div style="
                            text-align: center;
                            margin-top: 60px;
                            padding: 40px 20px;
                        ">
                            <button id="boss-new-challenge-btn" style="
                                position: relative;
                                padding: 24px 64px;
                                font-size: 28px;
                                font-weight: 800;
                                color: #fff;
                                background: linear-gradient(135deg, #ff6b9d 0%, #ffd700 50%, #87ceeb 100%);
                                background-size: 200% 200%;
                                border: 4px solid rgba(255, 255, 255, 0.9);
                                border-radius: 30px;
                                cursor: pointer;
                                box-shadow: 0 12px 40px rgba(255, 107, 157, 0.5),
                                            0 0 80px rgba(255, 215, 0, 0.4),
                                            0 0 120px rgba(135, 206, 235, 0.3),
                                            inset 0 2px 8px rgba(255, 255, 255, 0.8);
                                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                                overflow: hidden;
                                text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3), 0 0 30px rgba(255, 255, 255, 0.5);
                                letter-spacing: 3px;
                                animation: gradientShift 3s ease infinite, buttonFloat 3s ease-in-out infinite;
                            ">
                                <span style="position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 12px;">
                                    <span style="font-size: 32px; animation: sparkle 2s ease-in-out infinite;">🌟</span>
                                    <span>新的挑战</span>
                                    <span style="font-size: 32px; animation: sparkle 2s ease-in-out infinite 0.5s;">🚀</span>
                                </span>
                                <div style="
                                    position: absolute;
                                    top: 0;
                                    left: -100%;
                                    width: 100%;
                                    height: 100%;
                                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
                                    animation: shine 3s infinite;
                                    z-index: 1;
                                "></div>
                                <style>
                                    @keyframes gradientShift {
                                        0%, 100% { background-position: 0% 50%; }
                                        50% { background-position: 100% 50%; }
                                    }
                                    @keyframes shine {
                                        0% { left: -100%; }
                                        50%, 100% { left: 100%; }
                                    }
                                    @keyframes sparkle {
                                        0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
                                        50% { transform: scale(1.3) rotate(180deg); opacity: 0.9; }
                                    }
                                    @keyframes buttonFloat {
                                        0%, 100% { transform: translateY(0px); }
                                        50% { transform: translateY(-8px); }
                                    }
                                    #boss-new-challenge-btn:hover {
                                        transform: translateY(-10px) scale(1.08);
                                        box-shadow: 0 18px 50px rgba(255, 107, 157, 0.6),
                                                    0 0 100px rgba(255, 215, 0, 0.5),
                                                    0 0 150px rgba(135, 206, 235, 0.4),
                                                    inset 0 2px 10px rgba(255, 255, 255, 0.9);
                                        border-color: rgba(255, 255, 255, 1);
                                    }
                                    #boss-new-challenge-btn:active {
                                        transform: translateY(-5px) scale(1.04);
                                    }
                                    #boss-new-challenge-btn::before {
                                        content: '';
                                        position: absolute;
                                        top: -50%;
                                        left: -50%;
                                        width: 200%;
                                        height: 200%;
                                        background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
                                        animation: pulse 2.5s ease-in-out infinite;
                                        z-index: 0;
                                    }
                                    @keyframes pulse {
                                        0%, 100% { opacity: 0.7; transform: scale(1); }
                                        50% { opacity: 1; transform: scale(1.2); }
                                    }
                                </style>
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // 绑定返回按钮
        const backBtn = document.getElementById('skill-tree-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.currentView = 'summary';
                this.render();
            });
        }
        
        // 绑定知识点卡片点击事件
        this.container.querySelectorAll('.boss-challenge-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const nodeId = card.getAttribute('data-node-id');
                if (nodeId) {
                    this.showNodePanel(nodeId);
                }
            });
        });

        // 绑定"新的挑战"按钮（如果存在）
        const newChallengeBtn = document.getElementById('boss-new-challenge-btn');
        if (newChallengeBtn) {
            newChallengeBtn.addEventListener('click', () => {
                // TODO: 实现新的挑战功能
                alert('新的挑战功能即将上线！敬请期待！');
                // 可以在这里添加跳转到新挑战页面的逻辑
            });
        }
    }

    // 渲染"间章：含苞" —— 5个知识点的轻量布局
    async renderInterlude25Detail() {
        const tree = this.skillTrees['newbie-130'];
        const nodeIds = ['geometry', 'game-theory', 'simulation-advanced', 'construction-advanced', 'greedy-priority-queue'];
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
                <div class="interlude-ribbon">间章：含苞</div>
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

    // 旧版管理员增删改面板已移除
    
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

        // 如果节点被锁定且有未满足的依赖，显示锁定图标和提示
        let lockIcon = '';
        let lockTooltip = '';
        if (stateInfo.state === 'locked' && stateInfo.unmetDependencies && stateInfo.unmetDependencies.length > 0) {
            // 获取当前节点的进度数据，用于检查每个依赖的进度
            const { nodeProgress } = this.currentStageProgress || {};
            
            // 分别检查每个依赖，显示未满足的依赖列表
            const unmetList = stateInfo.unmetDependencies.map(depId => {
                const depNode = nodes[depId];
                const depTagId = nodeIdToTagId[depId];
                const depName = depNode ? depNode.name : depId;
                // 检查该依赖的进度
                const raw = nodeProgress ? (nodeProgress[depTagId] || 0) : 0;
                const pct = raw <= 1 ? raw * 100 : raw;
                return `<div class="unmet">${depName} 进度达到60% <span class="tooltip-cross">✗</span></div>`;
            }).join('');
            
            lockIcon = `<img src="https://api.iconify.design/mdi/lock-outline.svg?color=%23adb5bd" class="skill-node__lock-icon" alt="Locked">`;
            lockTooltip = `<div class="skill-node__lock-tooltip">${unmetList}</div>`;
        }

        return `
            <div class="skill-node ${stateClass}" data-id="${nodeId}" id="skill-node-${nodeId}" ${backgroundStyle}>
                ${lockIcon}
                ${lockTooltip}
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
        let dependencies = [];
        
        if (stage.id === 'stage-1') {
            // 第一章的依赖关系
            dependencies = [
                { start: 'col-1', end: 'col-2', options: { startSocket: 'bottom', endSocket: 'top' } },
                { start: 'col-2', end: 'col-3', options: { startSocket: 'right', endSocket: 'left', startSocketGravity: 80, endSocketGravity: 80 } },
                { start: 'col-2', end: 'col-4', options: { startSocket: 'right', endSocket: 'left', startSocketGravity: 0, endSocketGravity: 0 } },
                { start: 'col-4', end: 'col-5', options: { startSocket: 'bottom', endSocket: 'top', startSocketGravity: 0, endSocketGravity: 0 } }
            ];
        } else if (stage.id === 'stage-3') {
            // 第三章的依赖关系：图论入门依赖搜索入门，并查集依赖图论入门
            dependencies = [
                { start: 's3-col-search', end: 's3-col-graph', options: { startSocket: 'bottom', endSocket: 'top' } },
                { start: 's3-col-graph', end: 's3-col-union-find', options: { startSocket: 'bottom', endSocket: 'top' } }
            ];
        }

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
        // 绑定重定位监听，缩放/滚动时同步位置
        try { if (this._bindViewportListeners) this._bindViewportListeners(); } catch (_) {}
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
        try { if (this._unbindViewportListeners) this._unbindViewportListeners(); } catch (_) {}
    }

    // 动态更新第二章菱形SVG的位置，使其与四个虚框位置绑定
    updateStage2DiamondPosition() {
        const diamondContainer = this.container.querySelector('.stage2-diamond');
        const svgDecor = diamondContainer?.querySelector('.stage2-diamond-decor');
        if (!diamondContainer || !svgDecor) return;

        // 获取四个虚框的位置
        const topCol = diamondContainer.querySelector('.stage2-pos-top');
        const leftCol = diamondContainer.querySelector('.stage2-pos-left');
        const rightCol = diamondContainer.querySelector('.stage2-pos-right');
        const bottomCol = diamondContainer.querySelector('.stage2-pos-bottom');

        if (!topCol || !leftCol || !rightCol || !bottomCol) return;

        // 获取四个虚框的中心点位置（相对于diamondContainer）
        const getCenter = (el) => {
            const rect = el.getBoundingClientRect();
            const containerRect = diamondContainer.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2 - containerRect.left,
                y: rect.top + rect.height / 2 - containerRect.top
            };
        };

        const topCenter = getCenter(topCol);
        const leftCenter = getCenter(leftCol);
        const rightCenter = getCenter(rightCol);
        const bottomCenter = getCenter(bottomCol);

        // 计算菱形的边界框（包含四个中心点的最小矩形）
        const minX = Math.min(topCenter.x, leftCenter.x, rightCenter.x, bottomCenter.x);
        const maxX = Math.max(topCenter.x, leftCenter.x, rightCenter.x, bottomCenter.x);
        const minY = Math.min(topCenter.y, leftCenter.y, rightCenter.y, bottomCenter.y);
        const maxY = Math.max(topCenter.y, leftCenter.y, rightCenter.y, bottomCenter.y);

        // 添加一些边距（padding）
        const padding = 20;
        const left = minX - padding;
        const top = minY - padding;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;

        // 更新SVG的位置和大小
        svgDecor.style.position = 'absolute';
        svgDecor.style.left = `${left}px`;
        svgDecor.style.top = `${top}px`;
        svgDecor.style.width = `${width}px`;
        svgDecor.style.height = `${height}px`;
        svgDecor.style.right = 'auto';
        svgDecor.style.bottom = 'auto';

        // 绑定窗口resize事件，重新计算位置
        // 先清理旧的监听器（如果存在）
        if (this._stage2DiamondResizeHandler) {
            window.removeEventListener('resize', this._stage2DiamondResizeHandler, { passive: true });
            window.removeEventListener('scroll', this._stage2DiamondResizeHandler, { passive: true });
        }
        
        this._stage2DiamondResizeHandler = () => {
            // 使用防抖，避免频繁计算
            if (this._stage2DiamondResizeTimer) {
                clearTimeout(this._stage2DiamondResizeTimer);
            }
            this._stage2DiamondResizeTimer = setTimeout(() => {
                // 检查是否还在第二章视图
                const diamondContainer = this.container.querySelector('.stage2-diamond');
                if (diamondContainer) {
                    this.updateStage2DiamondPosition();
                }
            }, 100);
        };
        window.addEventListener('resize', this._stage2DiamondResizeHandler, { passive: true });
        // 也监听滚动事件，因为滚动可能影响位置
        window.addEventListener('scroll', this._stage2DiamondResizeHandler, { passive: true });
    }

    // 绑定概览页事件
    bindSummaryEvents() {
        // 绑定"萌新篇"问号提示框事件
        const newbieHelp = document.getElementById('newbie-guide-help');
        const newbieTooltip = document.getElementById('newbie-guide-tooltip');
        if (newbieHelp && newbieTooltip) {
            newbieHelp.addEventListener('mouseenter', () => {
                // 动态计算位置，使用fixed定位
                const helpRect = newbieHelp.getBoundingClientRect();
                newbieTooltip.style.display = 'block';
                // 提示框显示在问号下方，右对齐（先设置为右对齐）
                newbieTooltip.style.top = (helpRect.bottom + 12) + 'px';
                // 先获取提示框宽度，然后计算位置
                setTimeout(() => {
                    const tooltipWidth = newbieTooltip.offsetWidth || 400;
                    let leftPos = helpRect.right - tooltipWidth;
                    // 如果提示框超出左边界，则左对齐
                    if (leftPos < 12) {
                        leftPos = helpRect.left;
                    }
                    // 如果提示框超出右边界，则右对齐到窗口边缘
                    if (leftPos + tooltipWidth > window.innerWidth - 12) {
                        leftPos = window.innerWidth - tooltipWidth - 12;
                    }
                    newbieTooltip.style.left = leftPos + 'px';
                }, 0);
            });
            newbieHelp.addEventListener('mouseleave', () => {
                // 延迟隐藏，允许鼠标移动到提示框
                setTimeout(() => {
                    if (!newbieTooltip.matches(':hover')) {
                        newbieTooltip.style.display = 'none';
                    }
                }, 100);
            });
            // 鼠标移入提示框时保持显示
            newbieTooltip.addEventListener('mouseenter', () => {
                newbieTooltip.style.display = 'block';
            });
            newbieTooltip.addEventListener('mouseleave', () => {
                newbieTooltip.style.display = 'none';
            });
        }
        // 绑定"潜龙篇"问号提示框事件
        const dragonHelp = document.getElementById('dragon-guide-help');
        const dragonTooltip = document.getElementById('dragon-guide-tooltip');
        if (dragonHelp && dragonTooltip) {
            dragonHelp.addEventListener('mouseenter', () => {
                const helpRect = dragonHelp.getBoundingClientRect();
                dragonTooltip.style.display = 'block';
                dragonTooltip.style.top = (helpRect.bottom + 12) + 'px';
                setTimeout(() => {
                    const tooltipWidth = dragonTooltip.offsetWidth || 400;
                    let leftPos = helpRect.right - tooltipWidth;
                    if (leftPos < 12) {
                        leftPos = helpRect.left;
                    }
                    if (leftPos + tooltipWidth > window.innerWidth - 12) {
                        leftPos = window.innerWidth - tooltipWidth - 12;
                    }
                    dragonTooltip.style.left = leftPos + 'px';
                }, 0);
            });
            dragonHelp.addEventListener('mouseleave', () => {
                setTimeout(() => {
                    if (!dragonTooltip.matches(':hover')) {
                        dragonTooltip.style.display = 'none';
                    }
                }, 100);
            });
            dragonTooltip.addEventListener('mouseenter', () => {
                dragonTooltip.style.display = 'block';
            });
            dragonTooltip.addEventListener('mouseleave', () => {
                dragonTooltip.style.display = 'none';
            });
        }
        const cards = this.container.querySelectorAll('.skill-tree-card');
        cards.forEach(card => {
            // 如果卡片是锁定的，则不添加点击事件
            if (card.classList.contains('locked')) {
                return;
            }
            card.addEventListener('click', () => {
                this.clearLines();
                this.teardownSummarySvg && this.teardownSummarySvg();
                this.selectedStageId = card.dataset.stageId;
                this.currentView = 'detail';
                this.render();
            });
        });

        // 间章：拂晓（迷你卡）点击进入：自定义迷你详情
        const mini1 = this.container.querySelector('.skill-tree-mini-card[data-mini-of="stage-1"]');
        if (mini1 && !mini1.classList.contains('locked')) {
            mini1.addEventListener('click', () => {
                this.clearLines();
                this.teardownSummarySvg && this.teardownSummarySvg();
                this.renderInterludeDetail();
            });
        }
        // 间章2.5：含苞（迷你卡）点击进入：自定义迷你详情
        const mini25 = this.container.querySelector('.skill-tree-mini-card[data-mini-of="stage-2"]');
        if (mini25 && !mini25.classList.contains('locked')) {
            mini25.addEventListener('click', () => {
                this.clearLines();
                this.teardownSummarySvg && this.teardownSummarySvg();
                this.renderInterlude25Detail();
            });
        }
        // 间章3：惊鸿（迷你卡）点击进入：建设中占位页
        const mini3 = this.container.querySelector('.skill-tree-mini-card[data-mini-of="stage-3"]');
        if (mini3 && !mini3.classList.contains('locked')) {
            mini3.addEventListener('click', () => {
                this.clearLines();
                this.teardownSummarySvg && this.teardownSummarySvg();
                // 目前“惊鸿”暂未正式开放，使用通用的“建设中”详情页
                this.renderComingSoonDetail('间章：惊鸿');
            });
        }
        
        // Boss章节：梦
        const bossBtn = document.getElementById('skill-tree-boss-dream');
        if (bossBtn) {
            bossBtn.addEventListener('click', () => {
                // 检查是否锁定
                if (bossBtn.disabled) {
                    return;
                }
                this.clearLines();
                this.teardownSummarySvg && this.teardownSummarySvg();
                this.renderBossDreamDetail();
            });
        }
    }

    // 使用 SVG 覆盖层绘制概览页连线（第一章->第二章，第二章->第三章，第三章->第四章）
    setupSummarySvg() {
        const root = this.container;
        if (!root) return;
        this.teardownSummarySvg && this.teardownSummarySvg();
        // 创建 SVG 覆盖层
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('skill-tree-svg');
        svg.setAttribute('preserveAspectRatio', 'none');
        root.appendChild(svg);
        this._summarySvg = svg;

        // 绑定更新
        this._summarySvgUpdate = () => this.updateSummarySvg();
        window.addEventListener('resize', this._summarySvgUpdate, { passive: true });
        window.addEventListener('scroll', this._summarySvgUpdate, true);
        this.updateSummarySvg();
    }

    updateSummarySvg() {
        const root = this.container;
        if (!root || !this._summarySvg) return;
        const s1 = root.querySelector('.skill-tree-card.stage-1');
        const s2 = root.querySelector('.skill-tree-card.stage-2');
        const s3 = root.querySelector('.skill-tree-card.stage-3');
        const s4 = root.querySelector('.skill-tree-card.stage-4');
        const rect = root.getBoundingClientRect();
        const getPoint = (el, px, py) => {
            const r = el.getBoundingClientRect();
            const x = r.left - rect.left + r.width * px;
            const y = r.top - rect.top + r.height * py;
            return { x, y };
        };
        // 清空
        while (this._summarySvg.firstChild) this._summarySvg.removeChild(this._summarySvg.firstChild);
        const draw = (a, b) => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', a.x);
            line.setAttribute('y1', a.y);
            line.setAttribute('x2', b.x);
            line.setAttribute('y2', b.y);
            line.setAttribute('stroke', 'rgba(173,181,189,0.9)');
            line.setAttribute('stroke-width', '2');
            this._summarySvg.appendChild(line);
        };
        if (s1 && s2) draw(getPoint(s1, 1, 1), getPoint(s2, 0, 0));
        if (s2 && s3) draw(getPoint(s2, 0, 1), getPoint(s3, 1, 0));
        // 第三章->第四章：从第三章底部中心连接到第四章顶部中心
        if (s3 && s4) draw(getPoint(s3, 0.5, 1), getPoint(s4, 0.5, 0));
    }

    teardownSummarySvg() {
        if (this._summarySvgUpdate) {
            window.removeEventListener('resize', this._summarySvgUpdate, { passive: true });
            window.removeEventListener('scroll', this._summarySvgUpdate, true);
            this._summarySvgUpdate = null;
        }
        if (this._summarySvg && this._summarySvg.parentNode) {
            this._summarySvg.parentNode.removeChild(this._summarySvg);
        }
        this._summarySvg = null;
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

        // 确保全局"点击外部关闭"已绑定
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
            // 当用户点击知识点进入详情页时，调用更新接口
            const tagId = nodeIdToTagId[nodeId];
            if (tagId && this.state.isLoggedIn()) {
                try {
                    await this.apiService.syncSingleTag(this.state.loggedInUserId, tagId);
                    // 更新当前页面所有知识点的进度显示
                    await this.updateCurrentPageNodeProgress();
                } catch (syncError) {
                    console.error('更新技能树进度失败:', syncError);
                    // 即使更新失败，也继续加载详情页
                }
            }

            const tagInfo = await this.apiService.fetchTagInfo(tagId);
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

        // 标题（已移除刷新按钮，改为在打开详情页时自动更新）
        this.panelTitle.textContent = tagInfo.tagName || staticNodeData.name;
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
            // 即使没有题目，管理员也应该能看到批量管理按钮
            if (this.state.isAdmin) {
                const tagId = nodeIdToTagId[this.activeNodeId];
                const manageHtml = `
                    <div class="admin-batch-panel" style="margin-top:12px;padding-top:8px;border-top:1px dashed #ddd;">
                        <button id="skill-manage-problems-btn" type="button" class="admin-btn">管理题目（批量）</button>
                    </div>
                `;
                this.panelProblems.insertAdjacentHTML('beforeend', manageHtml);
                const manageBtn = this.panelProblems.querySelector('#skill-manage-problems-btn');
                if (manageBtn && !manageBtn._bound) {
                    manageBtn._bound = true;
                    manageBtn.addEventListener('click', () => {
                        const nodeData = skillTreeData['newbie-130'].nodes[this.activeNodeId];
                        const tagName = nodeData ? nodeData.name : '';
                        this.openBatchManageModal({
                            tagId,
                            tagName,
                            problems: [],
                            stageNodeOptions: this.getStageNodeOptionsForActiveNode()
                        }, async (saved) => {
                            if (!saved) return;
                            try {
                                await this.apiService.batchReplaceSkillTree(tagId, saved);
                                alert('已保存');
                                const fresh = await this.apiService.fetchTagInfo(tagId);
                                this.showPanelContent(staticNodeData, fresh, false);
                            } catch (e) {
                                console.error('批量保存失败', e);
                                alert(e.message || '保存失败');
                            }
                        });
                    });
                }
            }
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
            // 技能树题目默认使用 tracker3 渠道标识
            // 若入口URL带 channelPut，则技能树题目加后缀"c"，否则回落到缺省 tracker3
            const chan = (this.state?.channelPut || '');
            const cp = chan ? (chan + 'c') : 'tracker3';
            const problemUrl = helpers.buildUrlWithChannelPut(baseUrl, cp);

            // Changed: Display score and pass total
            let scoreHtml = '';
            if (problem.score) {
                 scoreHtml = `<span class="problem-score">${problem.score}分</span>`;
            }
            const passTotal = Number(problem.passTotal || 0);
            const passText = (typeof passTotal.toLocaleString === 'function') ? passTotal.toLocaleString() : String(passTotal);
            const passHtml = `<br><span class=\"problem-pass-total\" title=\"通过人数\">👥 ${passText}</span>`;

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

            const adminControls = '';

            return `
                <li class="problem-item ${problemClass}"${lockAttr}>
                    <a ${linkAttrs}>
                        <span class="problem-status-icon">${isSolved ? '✔' : ''}</span>
                        ${extraFlag}<span class="problem-title">${problem.name}</span>
                        ${scoreHtml}
                        ${passHtml}
                        ${isLocked ? '<span class="problem-lock-icon" aria-label="未解锁" title="未解锁"><svg class="icon-lock" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 1a5 5 0 0 0-5 5v4H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 9V6a3 3 0 1 1 6 0v4H9z"></path></svg></span>' : ''}
                    </a>
                    ${adminControls}
                </li>
            `;
        }).join('');

        this.panelProblems.innerHTML = `<ul>${problemsHtml}</ul>`;

        // 管理员：批量管理入口
        if (this.state.isAdmin) {
            const tagId = nodeIdToTagId[this.activeNodeId];
            const manageHtml = `
                <div class="admin-batch-panel" style="margin-top:12px;padding-top:8px;border-top:1px dashed #ddd;">
                    <button id="skill-manage-problems-btn" type="button" class="admin-btn">管理题目（批量）</button>
                </div>
            `;
            this.panelProblems.insertAdjacentHTML('beforeend', manageHtml);
            const manageBtn = this.panelProblems.querySelector('#skill-manage-problems-btn');
            if (manageBtn && !manageBtn._bound) {
                manageBtn._bound = true;
                manageBtn.addEventListener('click', () => {
                    const nodeData = skillTreeData['newbie-130'].nodes[this.activeNodeId];
                    const tagName = nodeData ? nodeData.name : '';
                    this.openBatchManageModal({
                        tagId,
                        tagName,
                        problems: (tagInfo.problems || []).map(p => ({
                            questionId: String(p.qid || p.questionId || ''),
                            score: Number(p.score || 0),
                            dependencies: parseDeps(p)
                        })),
                        stageNodeOptions: this.getStageNodeOptionsForActiveNode()
                    }, async (saved) => {
                        if (!saved) return;
                        try {
                            await this.apiService.batchReplaceSkillTree(tagId, saved);
                            alert('已保存');
                            const fresh = await this.apiService.fetchTagInfo(tagId);
                            this.showPanelContent(staticNodeData, fresh, false);
                        } catch (e) {
                            console.error('批量保存失败', e);
                            alert(e.message || '保存失败');
                        }
                    });
                });
            }
        }

        // 刷新按钮已移除，改为在打开详情页时自动更新进度

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

    // 在"间章：拂晓"页面上，刷新某个知识点后同步更新对应按钮
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

    // 更新当前页面所有知识点的进度显示
    async updateCurrentPageNodeProgress() {
        try {
            const tree = this.skillTrees['newbie-130'];
            let stageNodeIds = [];
            let stageTagIds = [];

            // 检查是否是Boss章节详情页
            const bossDreamDetail = this.container.querySelector('.boss-dream-detail');
            if (bossDreamDetail) {
                // Boss章节：需要重新渲染整个页面以更新进度和风格
                await this.renderBossDreamDetail();
                return;
            }

            // 检查是否是间章视图
            const interludeChips = this.container.querySelectorAll('.interlude-chip');
            if (interludeChips.length > 0) {
                // 间章视图：根据间章标题判断是哪个间章
                const ribbon = this.container.querySelector('.interlude-ribbon');
                if (ribbon && ribbon.textContent.includes('拂晓')) {
                    // 间章1.5：拂晓
                    stageNodeIds = ['builtin-func', 'lang-feature', 'simulation-enum', 'construction', 'greedy-sort'];
                } else if (ribbon && ribbon.textContent.includes('含苞')) {
                    // 间章2.5：含苞
                    stageNodeIds = ['geometry', 'game-theory', 'simulation-advanced', 'construction-advanced', 'greedy-priority-queue'];
                } else {
                    // 默认使用间章1.5
                    stageNodeIds = ['builtin-func', 'lang-feature', 'simulation-enum', 'construction', 'greedy-sort'];
                }
                stageTagIds = stageNodeIds.map(nodeId => nodeIdToTagId[nodeId]).filter(Boolean);
            } else if (this.currentView === 'detail' && this.selectedStageId) {
                // 普通章节详情视图
                const stage = tree.stages.find(s => s.id === this.selectedStageId);
                if (!stage || !stage.columns) return;

                stageNodeIds = stage.columns.flatMap(c => c.nodeIds);
                stageTagIds = stageNodeIds.map(nodeId => nodeIdToTagId[nodeId]).filter(Boolean);
            } else {
                // 不在详情视图，不需要更新
                return;
            }

            if (stageTagIds.length === 0) return;

            // 调用API获取最新进度
            const progressData = await this.apiService.fetchSkillTreeProgress(this.state.loggedInUserId, stageTagIds);
            
            // 更新内存中的进度
            if (!this.currentStageProgress.nodeProgress) {
                this.currentStageProgress.nodeProgress = {};
            }
            Object.assign(this.currentStageProgress.nodeProgress, progressData.nodeProgress || {});

            // 更新页面上所有知识点节点的进度显示
            stageNodeIds.forEach(nodeId => {
                const tagId = nodeIdToTagId[nodeId];
                if (!tagId) return;

                // 尝试通过 ID 查找（普通章节）或 data-id 查找（间章）
                let nodeEl = document.getElementById(`skill-node-${nodeId}`);
                if (!nodeEl) {
                    nodeEl = this.container.querySelector(`.interlude-chip[data-id="${nodeId}"]`);
                }
                if (!nodeEl) return;

                // 获取最新进度
                const raw = this.currentStageProgress.nodeProgress[tagId] || 0;
                const progress = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);

                // 更新进度文本
                const progressTextEl = nodeEl.querySelector('.skill-node__progress-text');
                if (progressTextEl) {
                    progressTextEl.textContent = `${progress}%`;
                }

                // 更新背景样式
                if (progress > 0 && progress < 100) {
                    nodeEl.style.background = `linear-gradient(to right, var(--primary-color-light) ${progress}%, #fff ${progress}%)`;
                } else {
                    nodeEl.style.background = progress >= 100 ? 'var(--primary-color-light)' : '#fff';
                }

                // 更新完成态样式
                if (progress >= 100) {
                    nodeEl.classList.add('skill-node--completed');
                } else {
                    nodeEl.classList.remove('skill-node--completed');
                }
            });
        } catch (error) {
            console.error('Failed to update current page node progress:', error);
        }
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
        
        // 关闭面板时，重新绘制当前页面所有知识点的进度
        // 异步调用，不阻塞面板关闭动画
        this.updateCurrentPageNodeProgress().catch(err => {
            console.error('Failed to update node progress on panel close:', err);
        });
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
        this.teardownSummarySvg && this.teardownSummarySvg();
        // 清理第二章菱形位置更新的监听器
        if (this._stage2DiamondResizeHandler) {
            window.removeEventListener('resize', this._stage2DiamondResizeHandler, { passive: true });
            window.removeEventListener('scroll', this._stage2DiamondResizeHandler, { passive: true });
            this._stage2DiamondResizeHandler = null;
        }
        if (this._stage2DiamondResizeTimer) {
            clearTimeout(this._stage2DiamondResizeTimer);
            this._stage2DiamondResizeTimer = null;
        }
    }

    // 获取与当前知识点同一章节的tag选项（找不到则回退为全量）
    getStageNodeOptionsForActiveNode() {
        const tree = this.skillTrees && this.skillTrees['newbie-130'];
        const nodesDict = tree && tree.nodes ? tree.nodes : {};
        const activeId = this.activeNodeId;
        let stage = null;
        if (tree && Array.isArray(tree.stages)) {
            for (const s of tree.stages) {
                const ids = (s.columns || []).flatMap(c => c.nodeIds || []);
                if (ids.includes(activeId)) { stage = s; break; }
            }
        }
        const pickIds = stage ? (stage.columns || []).flatMap(c => c.nodeIds || []) : Object.keys(nodesDict);
        const uniqIds = Array.from(new Set(pickIds));
        return uniqIds.map(nid => {
            const tagId = nodeIdToTagId[nid];
            const name = (nodesDict[nid] && nodesDict[nid].name) || String(tagId);
            return { tagId: String(tagId), label: `${tagId} - ${name}` };
        }).filter(o => o.tagId && o.tagId !== 'undefined');
    }

    // 打开批量管理对话框
    openBatchManageModal(context, onSave) {
        const { tagId, tagName = '', problems = [], stageNodeOptions = [] } = context || {};
        let modal = document.getElementById('skill-batch-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'skill-batch-modal';
            modal.className = 'modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:920px;">
                    <div class="modal-header">
                        <h3>管理题目（Tag ${tagId}${tagName ? ` - ${tagName}` : ''}）</h3>
                        <button id="skill-batch-close" class="modal-close" aria-label="关闭">&times;</button>
                    </div>
                    <div class="modal-body" style="max-height:60vh;overflow:auto;">
                        <table class="rankings-table" style="width:100%;">
                            <thead>
                                <tr>
                                    <th style="width:60px;">顺序</th>
                                    <th style="width:140px;">questionId</th>
                                    <th style="width:100px;">分数</th>
                                    <th>依赖（可多选）</th>
                                    <th style="width:160px;">调整</th>
                                </tr>
                            </thead>
                            <tbody id="skill-batch-tbody"></tbody>
                        </table>
                        <div style="margin-top:12px;text-align:left;">
                            <button type="button" id="skill-batch-add-btn" class="admin-btn" style="background:#1890ff;color:#fff;border:1px solid #1890ff;">添加题目</button>
                        </div>
                    </div>
                    <div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;">
                        <button id="skill-batch-cancel" class="admin-btn modal-secondary" style="background:#f5f5f5;color:#333;border:1px solid #e5e5e5;">取消</button>
                        <button id="skill-batch-save" class="admin-btn" style="background:#52c41a;color:#fff;border:1px solid #52c41a;">保存</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        // 更新标题（如果 modal 已存在）
        const titleElement = modal.querySelector('.modal-header h3');
        if (titleElement) {
            titleElement.textContent = `管理题目（Tag ${tagId}${tagName ? ` - ${tagName}` : ''}）`;
        }
        const tbody = modal.querySelector('#skill-batch-tbody');
        // 从 DOM 中读取当前编辑的值并更新到 state
        const syncStateFromDOM = () => {
            const rows = Array.from(tbody.querySelectorAll('tr'));
            rows.forEach((tr, idx) => {
                if (idx < state.length) {
                    const qidInput = tr.querySelector('.skill-batch-qid');
                    const scoreInput = tr.querySelector('.skill-batch-score');
                    if (qidInput) {
                        state[idx].questionId = qidInput.value.trim();
                    }
                    if (scoreInput) {
                        const score = Number(scoreInput.value);
                        state[idx].score = (Number.isFinite(score) && score >= 0) ? score : 0;
                    }
                }
            });
        };
        const renderRows = (list) => {
            tbody.innerHTML = list.map((it, idx) => {
                const depIds = Array.isArray(it.dependencies) ? it.dependencies.map(String) : [];
                const depLabels = depIds.length
                    ? depIds.map(id => {
                        const opt = stageNodeOptions.find(o => String(o.tagId) === String(id));
                        return opt ? opt.label : id;
                    }).join('、')
                    : '未选择';
                return `
                    <tr data-idx="${idx}">
                        <td>${idx + 1}</td>
                        <td><input type="text" class="skill-batch-qid" value="${(it.questionId || '').replace(/"/g,'&quot;')}" style="width:120px;"></td>
                        <td><input type="number" min="0" class="skill-batch-score" value="${Number(it.score)||0}" style="width:80px;"></td>
                        <td>
                            <div class="dep-select-cell" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <span class="dep-summary" title="${depLabels}">${depLabels}</span>
                                <button type="button" class="admin-btn skill-batch-choose-deps" style="padding:2px 8px;">选择依赖</button>
                            </div>
                        </td>
                        <td>
                            <button type="button" class="admin-btn skill-batch-up" style="padding:2px 8px;">↑</button>
                            <button type="button" class="admin-btn skill-batch-down" style="padding:2px 8px;margin-left:6px;">↓</button>
                            <button type="button" class="admin-btn skill-batch-delete" style="padding:2px 8px;margin-left:6px;background:#ff4d4f;color:#fff;border:1px solid #ff4d4f;">×</button>
                        </td>
                    </tr>
                `;
            }).join('');
        };
        // 深拷贝用于编辑
        const state = problems.map(p => ({ questionId: String(p.questionId || ''), score: Number(p.score)||0, dependencies: Array.isArray(p.dependencies) ? p.dependencies.map(String) : [] }));
        renderRows(state);

        // 绑定上下移动、删除与依赖对话框
        const bindReorder = () => {
            tbody.querySelectorAll('.skill-batch-up').forEach(btn => {
                btn.addEventListener('click', () => {
                    syncStateFromDOM();
                    const tr = btn.closest('tr'); const idx = Number(tr.getAttribute('data-idx'));
                    if (idx <= 0) return;
                    const tmp = state[idx-1]; state[idx-1] = state[idx]; state[idx] = tmp;
                    renderRows(state); bindReorder();
                });
            });
            tbody.querySelectorAll('.skill-batch-down').forEach(btn => {
                btn.addEventListener('click', () => {
                    syncStateFromDOM();
                    const tr = btn.closest('tr'); const idx = Number(tr.getAttribute('data-idx'));
                    if (idx >= state.length - 1) return;
                    const tmp = state[idx+1]; state[idx+1] = state[idx]; state[idx] = tmp;
                    renderRows(state); bindReorder();
                });
            });
            // 删除按钮
            tbody.querySelectorAll('.skill-batch-delete').forEach(btn => {
                btn.addEventListener('click', () => {
                    syncStateFromDOM();
                    const tr = btn.closest('tr'); const idx = Number(tr.getAttribute('data-idx'));
                    if (confirm('确定要删除这道题目吗？')) {
                        state.splice(idx, 1);
                        renderRows(state); bindReorder();
                    }
                });
            });
            // 依赖弹窗
            tbody.querySelectorAll('.skill-batch-choose-deps').forEach(btn => {
                btn.addEventListener('click', () => {
                    syncStateFromDOM();
                    const tr = btn.closest('tr'); const idx = Number(tr.getAttribute('data-idx'));
                    openDepsDialog(idx);
                });
            });
        };
        bindReorder();

        // 添加题目按钮
        const addBtn = modal.querySelector('#skill-batch-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                syncStateFromDOM();
                state.push({ questionId: '', score: 0, dependencies: [] });
                renderRows(state); bindReorder();
            });
        }

        const openDepsDialog = (rowIdx) => {
            // 先移除已存在的
            let d = document.getElementById('skill-batch-deps-modal');
            if (d) d.remove();
            d = document.createElement('div');
            d.id = 'skill-batch-deps-modal';
            d.className = 'modal';
            d.style.display = 'none';
            const current = Array.isArray(state[rowIdx].dependencies) ? state[rowIdx].dependencies.map(String) : [];
            const optionsHtml = stageNodeOptions.map(opt => {
                const checked = current.includes(String(opt.tagId)) ? 'checked' : '';
                return `<label style="display:flex;align-items:center;gap:6px;margin:4px 0;">
                    <input type="checkbox" class="deps-opt" value="${opt.tagId}" ${checked} />
                    <span>${opt.label}</span>
                </label>`;
            }).join('');
            d.innerHTML = `
                <div class="modal-content" style="max-width:640px;">
                    <div class="modal-header">
                        <h3>选择依赖</h3>
                        <button id="deps-modal-close" class="modal-close" aria-label="关闭">&times;</button>
                    </div>
                    <div class="modal-body" style="max-height:50vh;overflow:auto;">
                        <div style="margin-bottom:8px;">
                            <input id="deps-search" type="text" placeholder="搜索（支持tagId/名称）" style="width:100%;padding:6px;border:1px solid #e5e5e5;border-radius:6px;">
                        </div>
                        <div id="deps-list">${optionsHtml}</div>
                    </div>
                    <div class="modal-actions">
                        <button id="deps-cancel" class="admin-btn modal-secondary">取消</button>
                        <button id="deps-save" class="admin-btn">确定</button>
                    </div>
                </div>
            `;
            document.body.appendChild(d);
            const open = () => { d.style.display = 'flex'; };
            const close = () => { d.style.display = 'none'; d.remove(); };
            d.querySelector('#deps-modal-close').onclick = close;
            d.querySelector('#deps-cancel').onclick = close;
            // 搜索过滤
            const searchInput = d.querySelector('#deps-search');
            const listDiv = d.querySelector('#deps-list');
            searchInput.addEventListener('input', () => {
                const kw = searchInput.value.trim().toLowerCase();
                Array.from(listDiv.querySelectorAll('label')).forEach(lb => {
                    const text = lb.innerText.toLowerCase();
                    lb.style.display = text.includes(kw) ? '' : 'none';
                });
            });
            d.querySelector('#deps-save').onclick = () => {
                syncStateFromDOM();
                const vals = Array.from(listDiv.querySelectorAll('.deps-opt:checked')).map(i => i.value);
                state[rowIdx].dependencies = vals;
                renderRows(state); bindReorder();
                close();
            };
            open();
        };

        // 打开与关闭
        const open = () => { modal.style.display = 'flex'; };
        const close = () => { modal.style.display = 'none'; };
        modal.querySelector('#skill-batch-close').onclick = close;
        modal.querySelector('#skill-batch-cancel').onclick = close;

        // 保存
        modal.querySelector('#skill-batch-save').onclick = async () => {
            // 采集最新值（从 state，而非 DOM 多选）
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const payload = rows.map((tr, order) => {
                const idx = Number(tr.getAttribute('data-idx'));
                const qid = tr.querySelector('.skill-batch-qid').value.trim();
                const score = Number(tr.querySelector('.skill-batch-score').value);
                const deps = Array.isArray(state[idx].dependencies) ? state[idx].dependencies.map(String) : [];
                return { questionId: qid, score: (Number.isFinite(score) && score >= 0) ? score : 0, dependencies: deps };
            });
            if (onSave) await onSave(payload);
            close();
        };
        open();
    }
}

// Attach viewport listeners outside the class definition to avoid reflow inside class
SkillTreeView.prototype._bindViewportListeners = function () {
    if (this._viewportListenersBound) return;
    this._viewportListenersBound = true;
    if (!this._repositionLines) return;
    window.addEventListener('resize', this._repositionLines, { passive: true });
    window.addEventListener('scroll', this._repositionLines, true);
    if (window.visualViewport) {
        try {
            window.visualViewport.addEventListener('resize', this._repositionLines, { passive: true });
            window.visualViewport.addEventListener('scroll', this._repositionLines, { passive: true });
        } catch (_) {}
    }
};

SkillTreeView.prototype._unbindViewportListeners = function () {
    if (!this._viewportListenersBound) return;
    this._viewportListenersBound = false;
    if (!this._repositionLines) return;
    window.removeEventListener('resize', this._repositionLines, { passive: true });
    window.removeEventListener('scroll', this._repositionLines, true);
    if (window.visualViewport) {
        try {
            window.visualViewport.removeEventListener('resize', this._repositionLines, { passive: true });
            window.visualViewport.removeEventListener('scroll', this._repositionLines, { passive: true });
        } catch (_) {}
    }
};
