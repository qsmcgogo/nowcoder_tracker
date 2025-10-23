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
                        name: '一维基本类型', 
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
            'mixed-control': { id: 'mixed-control', name: '混合', dependencies: ['integer', 'float', 'char', 'mixed-input'] },
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

        if (!this.state.isLoggedIn()) {
            this.container.innerHTML = `<div class="skill-tree-login-prompt">请先登录以查看您的技能树进度</div>`;
            return;
        }

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

        const allNodeIds = Object.keys(tree.nodes);
        const allTagIds = allNodeIds.map(nodeId => nodeIdToTagId[nodeId]).filter(Boolean);

        try {
            // 获取所有节点的进度
            const progressData = await this.apiService.fetchSkillTreeProgress(this.state.loggedInUserId, allTagIds);
            this.currentStageProgress = progressData; // 存储进度, 格式为 { nodeProgress: { ... } }

            let previousStageProgress = 100; // 第一关默认解锁
            const stagesToRender = tree.stages.slice(0, 3);

            const stagesHtml = stagesToRender.map(stage => {
                let progress = 0;
                if (stage.id === 'stage-1') {
                    const totalColumns = stage.columns.length;
                    let completedColumns = 0;
                    
                    stage.columns.forEach(column => {
                        const isColumnCompleted = column.nodeIds.every(nodeId => {
                            const tagId = nodeIdToTagId[nodeId];
                            // 直接从 currentStageProgress.nodeProgress 中获取
                            return (this.currentStageProgress.nodeProgress[tagId] || 0) >= 60;
                        });
                        if (isColumnCompleted) {
                            completedColumns++;
                        }
                    });
                    
                    progress = completedColumns * 20;
                } else {
                    // 其他阶段暂时维持原有简单逻辑或显示为0
                    progress = 0;
                }
                
                const isLocked = previousStageProgress < 100;
                previousStageProgress = progress;

                return `
                    <div class="skill-tree-card ${isLocked ? 'locked' : ''}" data-stage-id="${stage.id}" ${isLocked ? 'aria-disabled="true"' : ''}>
                        <div class="skill-tree-card__header">
                            <h3 class="skill-tree-card__title">${stage.name}</h3>
                            <span class="skill-tree-card__progress-text">通关率: ${progress}%</span>
                        </div>
                        <div class="skill-tree-card__progress-bar">
                            <div class="skill-tree-card__progress-bar-inner" style="width: ${progress}%;"></div>
                        </div>
                    </div>
                `;
            }).join('');

            this.container.innerHTML = `<div class="skill-tree-summary">${stagesHtml}</div>`;
            this.bindSummaryEvents();

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
                            const progress = this.currentStageProgress.nodeProgress[tagId] || 0;
                            return this.renderNode(nodeId, tree.nodes, nodeStates, progress);
                        }
                        return '';
                    }).join('');
                    
                    let columnLockClass = '';
                    let columnElementsHtml = '';

                    const firstNodeId = column.nodeIds[0];
                    if (firstNodeId) {
                        const firstNodeState = nodeStates[firstNodeId];
                        if (firstNodeState && firstNodeState.state === 'locked') {
                            columnLockClass = 'skill-tree-column--locked';

                            const lockIcon = `<img src="https://api.iconify.design/mdi/lock-outline.svg?color=%23adb5bd" class="skill-tree-column__lock-icon" alt="Locked">`;
                            
                            let tooltipContent = '';
                            const dependencies = tree.nodes[firstNodeId]?.dependencies || [];

                            if (dependencies.length > 0) {
                                tooltipContent = dependencies.map(depId => {
                                    const depNode = tree.nodes[depId];
                                    const depTagId = nodeIdToTagId[depId];
                                    const progress = this.currentStageProgress.nodeProgress[depTagId] || 0;
                                    const isMet = progress >= 60;
                                    
                                    const statusSymbol = isMet 
                                        ? `<span class="tooltip-check">✓</span>`
                                        : `<span class="tooltip-cross">✗</span>`;

                                    return `<div class="${isMet ? 'met' : 'unmet'}">${depNode.name} 进度达到60% ${statusSymbol}</div>`;
                                }).join('');
                            }
                            const tooltip = `<div class="skill-tree-column__tooltip">${tooltipContent}</div>`;
                            columnElementsHtml = lockIcon + tooltip;
                        }
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
            const progress = nodeProgress ? (nodeProgress[tagId] || 0) : 0;
            let tagState = 'locked';

            const isCompleted = progress === 100;
            const areDependenciesMet = (node.dependencies || []).every(depId => {
                const depTagId = nodeIdToTagId[depId];
                return nodeProgress ? (nodeProgress[depTagId] || 0) >= 60 : false;
            });

            if (isCompleted) {
                tagState = 'completed';
            } else if (areDependenciesMet) {
                tagState = 'unlocked';
            }
            
            if (tagState === 'locked') {
                const unmetDependencies = (node.dependencies || []).filter(depId => {
                    const depTagId = nodeIdToTagId[depId];
                    return nodeProgress ? (nodeProgress[depTagId] || 0) < 60 : true;
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
            { start: 'col-2', end: 'col-5', options: { startSocket: 'right', endSocket: 'left', startSocketGravity: -80, endSocketGravity: -80 } }
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
                this.selectedStageId = card.dataset.stageId;
                this.currentView = 'detail';
                this.render();
            });
        });
    }

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
        if (!this.state.isLoggedIn()) {
            return tagInfo; // Not logged in, no status to merge
        }

        let problems = [];
        if (typeof tagInfo.tagQuestionstrs === 'string' && tagInfo.tagQuestionstrs.length > 2) {
            try {
                problems = JSON.parse(tagInfo.tagQuestionstrs);
            } catch (e) {
                console.error('Failed to parse tagQuestionstrs:', e);
                return { ...tagInfo, problems: [] }; // Return with empty problems on parse error
            }
        }

        if (problems.length === 0) {
            return { ...tagInfo, problems: [] };
        }

        const problemIds = problems.map(p => p.problemId); // Use problemId for diff
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

        this.panelTitle.textContent = tagInfo.tagName || staticNodeData.name;
        this.panelDesc.textContent = tagInfo.tagDesc || '暂无描述。';

        const problems = tagInfo.problems || [];

        // Build tagId -> progress map for quick lookup
        const nodeProgress = (this.currentStageProgress && this.currentStageProgress.nodeProgress) || {};

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

        const problemsHtml = problems.map(problem => {
            const isSolved = problem.solved;
            const depTagIds = parseDeps(problem);
            const unmetDeps = depTagIds.filter(tagId => (nodeProgress[tagId] || 0) < 60);
            const isLocked = unmetDeps.length > 0;
            const problemClass = `${isSolved ? 'completed' : ''} ${isLocked ? 'locked' : ''}`.trim();
            const baseUrl = `https://www.nowcoder.com/practice/${problem.uuid}`;
            const problemUrl = helpers.buildUrlWithChannelPut(baseUrl, this.state.channelPut);

            // Changed: Display score instead of difficulty text
            let scoreHtml = '';
            if (problem.score) {
                 scoreHtml = `<span class="problem-score">${problem.score}分</span>`;
            }

            // Tooltip content for lock reasons
            let lockTooltip = '';
            if (isLocked) {
                const items = unmetDeps.map(tid => {
                    const progress = nodeProgress[tid] || 0;
                    return `依赖知识点(${tid}) 进度 ${progress}%`;
                }).join('<br>');
                lockTooltip = `<div class="problem-lock-tooltip">${items || '前置知识点未达60%'}</div>`;
            }

            // If locked, disable link and show lock icon
            const linkAttrs = isLocked ? 'href="javascript:void(0)" class="disabled-link"' : `href="${problemUrl}" target="_blank" rel="noopener noreferrer"`;

            return `
                <li class="problem-item ${problemClass}">
                    <a ${linkAttrs}>
                        <span class="problem-status-icon">${isSolved ? '✔' : ''}</span>
                        <span class="problem-title">${problem.name}</span>
                        ${scoreHtml}
                        ${isLocked ? '<span class="problem-lock-icon">🔒</span>' : ''}
                    </a>
                    ${lockTooltip}
                </li>
            `;
        }).join('');

        this.panelProblems.innerHTML = `<ul>${problemsHtml}</ul>`;
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
