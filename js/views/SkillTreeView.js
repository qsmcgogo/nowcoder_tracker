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
    'string-type': 1017,
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
                        nodeIds: ['array-1d', 'string-type'] 
                    }
                ]
            },
            {
                id: 'stage-2',
                name: '第二章：懵懂新芽'
            },
            {
                id: 'stage-3',
                name: '第三章：初显峥嵘'
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
            'string-type': { id: 'string-type', name: '字符串', dependencies: ['integer', 'float', 'char', 'mixed-input'] }
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

            let previousStageProgress = 100; // 第一关的前置视为已解锁，用于统一逻辑
            const stagesToRender = tree.stages.slice(0, 3);

            const stagesHtml = stagesToRender.map(stage => {
                let progress = 0;
                if (stage.id === 'stage-1') {
                    // 晨曦微光的进度 = 所有知识点进度的平均值
                    const allStageNodeIds = stage.columns.flatMap(c => c.nodeIds);
                    const values = allStageNodeIds.map(nodeId => {
                        const tagId = nodeIdToTagId[nodeId];
                        const v = this.currentStageProgress.nodeProgress[tagId] || 0;
                        return v <= 1 ? v * 100 : v; // 后端返回0-1时转为百分比
                    });
                    if (isLoggedIn && values.length > 0) {
                        const avg = values.reduce((a, b) => a + b, 0) / values.length;
                        progress = Math.round(avg);
                    } else {
                        progress = 0;
                    }
                } else {
                    progress = 0;
                }
                
                // 第二章的解锁规则：第一章达到≥70%
                let isLocked;
                let lockReason = '';
                if (!isLoggedIn) {
                    isLocked = true;
                    lockReason = '请先登录开启技能树之旅';
                } else if (stage.id === 'stage-2') {
                    const stage1Progress = stagesToRender[0] && stagesToRender[0].id === 'stage-1' ? progress : 0;
                    // 注意：这里的 progress 变量当前就是当前 stage 的进度。为避免混淆，单独读取 earlierProgress
                    // 重新按节点计算第一章平均值
                    const s1 = tree.stages.find(s => s.id === 'stage-1');
                    const s1NodeIds = s1.columns.flatMap(c => c.nodeIds);
                    const s1Vals = s1NodeIds.map(n => {
                        const v = this.currentStageProgress.nodeProgress[nodeIdToTagId[n]] || 0;
                        return v <= 1 ? v * 100 : v;
                    });
                    const s1Avg = s1Vals.length > 0 ? Math.round(s1Vals.reduce((a, b) => a + b, 0) / s1Vals.length) : 0;
                    const meetProgress = s1Avg >= 70;
                    const meetSolved = solvedCount >= 50;
                    isLocked = !(meetProgress || meetSolved);
                    if (isLocked) {
                        lockReason = `第一章平均进度达到70% <br>或<br>tracker累计通过50题：${solvedCount} / 50 <span class=\"dep-cross\">×</span>`;
                    }
                } else if (stage.id === 'stage-3') {
                    const s2 = tree.stages.find(s => s.id === 'stage-2');
                    const s2NodeIds = (s2 && s2.columns) ? s2.columns.flatMap(c => c.nodeIds) : [];
                    const s2Vals = s2NodeIds.map(n => {
                        const v = this.currentStageProgress.nodeProgress[nodeIdToTagId[n]] || 0;
                        return v <= 1 ? v * 100 : v;
                    });
                    const s2Avg = s2Vals.length > 0 ? Math.round(s2Vals.reduce((a, b) => a + b, 0) / s2Vals.length) : 0;
                    isLocked = s2Avg < 70;
                    if (isLocked) {
                        lockReason = `第二章平均进度达到70% <span class=\"dep-cross\">×</span>`;
                    }
                } else {
                    // 其他章节仍按上一章节100%解锁的旧规则
                    isLocked = previousStageProgress < 100;
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
                    const miniMeetProgress = progress >= 70;
                    const miniMeetSolved = solvedCount >= 50;
                    const miniIsLocked = !isLoggedIn || !(miniMeetProgress || miniMeetSolved);
                    const miniLockReason = !isLoggedIn
                        ? '请先登录开启技能树之旅'
                        : `第一章平均进度达到70% <br>或<br>tracker累计通过50题：${solvedCount} / 50 <span class=\"dep-cross\">×</span>`;
                   
                    return `
                        <div class="skill-tree-card-group side-mini stage-1">
                            ${cardHtml}
                            <div class="skill-tree-mini-card ${miniIsLocked ? 'locked' : ''}" data-mini-of="stage-1" title="间章：拂晓">
                                <div class="skill-tree-mini-card__header">
                                    <span class="skill-tree-mini-card__title">间章：拂晓</span>
                                    <span class="skill-tree-mini-card__progress-text">通关率: ${progress}%</span>
                                </div>
                                <div class="skill-tree-mini-card__progress-bar">
                                    <div class="skill-tree-mini-card__progress-bar-inner" style="width: ${progress}%;"></div>
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

            if (stage.columns) {
                stage.columns.forEach(column => {
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

                    if (hasLockedNode || col5PrereqUnmet) {
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

                    const columnHtml = `
                        <div class="skill-tree-column ${columnLockClass}" id="skill-tree-column-${column.id}" ${extraStyle}>
                            ${columnElementsHtml}
                            <h4 class="skill-tree-column__title">${column.name}</h4>
                            <div class="skill-tree-column__nodes">${nodesHtml}</div>
                        </div>
                    `;

                    if (column.id === 'col-1' || column.id === 'col-2') {
                        leftColumnHtml += columnHtml;
                    } else {
                        rightColumnHtml += columnHtml;
                    }
                });
            }

            const html = `
                <div class="skill-tree-detail">
                    <div class="skill-tree-detail__header">
                        <button id="skill-tree-back-btn" class="back-button">&larr; 返回所有阶段</button>
                        <h2>${stage.name}</h2>
                    </div>
                    <div class="skill-tree-dag-container">
                        <div class="dag-main-column">${leftColumnHtml}</div>
                        <div class="dag-main-column">${rightColumnHtml}</div>
                    </div>
                </div>
            `;
            this.container.innerHTML = html;
            this.bindDetailEvents();
            setTimeout(() => this.drawColumnDependencyLines(stage), 0);

        } catch (error) {
            console.error(`Error rendering detail view for stage ${stageId}:`, error);
            this.container.innerHTML = `<div class="error">加载关卡详情失败，请稍后重试。</div>`;
        }
    }
    
    // 计算所有知识点和题目的状态 (修改)
    calculateNodeStates(nodes) {
        const states = {};
        // 使用获取到的真实进度, 直接解构
        const { nodeProgress } = this.currentStageProgress; 
        
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
            } else if (areDependenciesMet) {
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

        // Bind click outside to close panel
        document.addEventListener('click', (e) => {
            if (!this.panel || !this.panel.classList.contains('visible')) return;
            
            const isClickInsidePanel = this.panel.contains(e.target);
            const isClickOnNode = e.target.closest('.skill-node');

            if (!isClickInsidePanel && !isClickOnNode) {
                this.hideNodePanel();
            }
        });
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

        const problemsHtml = problems.map(problem => {
            const isSolved = problem.solved;
            const depTagIds = parseDeps(problem);
            const unmetDeps = depTagIds.filter(tagId => {
                const v = nodeProgress[tagId] || 0;
                const pct = v <= 1 ? v * 100 : v;
                return pct < 60;
            });
            // 已通过的题目不锁定（即使依赖未达标）
            const isLocked = !isSolved && unmetDeps.length > 0;
            const problemClass = `${isSolved ? 'completed' : ''} ${isLocked ? 'locked' : ''}`.trim();
            const baseUrl = `https://www.nowcoder.com/practice/${problem.uuid}`;
            const problemUrl = helpers.buildUrlWithChannelPut(baseUrl, this.state.channelPut);

            // Changed: Display score instead of difficulty text
            let scoreHtml = '';
            if (problem.score) {
                 scoreHtml = `<span class="problem-score">${problem.score}分</span>`;
            }

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
                        <span class="problem-title">${problem.name}</span>
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
            refreshBtn.addEventListener('click', async () => {
                try {
                    refreshBtn.disabled = true;
                    const tagId = nodeIdToTagId[this.activeNodeId];
                    // 先触发后端同步，再读取一次最新进度
                    await this.apiService.syncSingleTag(this.state.loggedInUserId, tagId);
                    const res = await this.apiService.fetchSingleTagProgress(this.state.loggedInUserId, tagId);
                    // 更新内存中的进度
                    if (!this.currentStageProgress.nodeProgress) this.currentStageProgress.nodeProgress = {};
                    this.currentStageProgress.nodeProgress[tagId] = res.progress || 0;
                    // 重新渲染当前面板与概要
                    this.showPanelContent(staticNodeData, tagInfo, false);
                    this.render();
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
