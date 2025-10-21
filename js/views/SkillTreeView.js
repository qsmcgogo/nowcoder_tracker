/**
 * 技能树视图模块
 * 处理技能树相关的UI和逻辑
 */
import { eventBus, EVENTS } from '../events/EventBus.js';

export class SkillTreeView {
    constructor(elements, state, apiService) {
        this.elements = elements; // Main App elements
        this.state = state;
        this.apiService = apiService;
        this.container = this.elements.skillTreeContainer;
        
        // Panel elements
        this.panel = document.getElementById('skill-node-panel');
        this.panelTitle = document.getElementById('skill-node-panel-title');
        this.panelDesc = document.getElementById('skill-node-panel-desc');
        this.panelProblems = document.getElementById('skill-node-panel-problems');
        this.panelCloseBtn = document.getElementById('skill-node-panel-close');
        
        this.lines = [];
        this.currentView = 'summary'; // 'summary' or 'detail'
        this.selectedStageId = null;
        
        // ------------------ 模拟数据 ------------------
        // 将技能树数据包装成一个对象，方便未来扩展
        this.skillTrees = {
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
                                nodeIds: ['arithmetic-add', 'arithmetic-sub', 'arithmetic-mul', 'arithmetic-div', 'bit-shift', 'arithmetic-mod'] 
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
                    // Column 1
                    'basic-output': { id: 'basic-output', name: '基础输出', description: '学习如何在屏幕上打印出第一行代码，这是所有编程旅程的起点。我们将学习如何输出文字、数字和简单的符号。', dependencies: [], problems: [{ qid: '2370904', name: 'Hello Nowcoder!' }, { qid: '1254547', name: '我爱刷题' }, { qid: '274324', name: '输出学生信息' }] },

                    // Column 2
                    'integer': { id: 'integer', name: '整数', description: '掌握计算机中最基础的数据类型——整数。学习如何定义整数变量，以及如何从用户那里读取一个整数值。', dependencies: ['basic-output'], problems: [{ qid: '308923', name: '牛牛学说话之-整数' }, { qid: '308924', name: '牛牛学说话之-整数II' }] },
                    'float': { id: 'float', name: '浮点数', description: '了解如何表示和处理带有小数的数字，即浮点数。这对于进行精确的科学计算和处理货币等场景至关重要。', dependencies: ['basic-output'], problems: [{ qid: '308926', name: '牛牛学说话之-浮点数' }] },
                    'char': { id: 'char', name: '单个字符', description: '探索如何处理单个字符，比如一个字母 \'a\' 或一个符号 \'#\'。这是构建更复杂字符串和文本处理的基础。', dependencies: ['basic-output'], problems: [{ qid: '308927', name: '牛牛学说话之-字符' }] },
                    'mixed-input': { id: 'mixed-input', name: '混合输入', description: '学习如何在一行内读取多种不同类型的数据，例如同时读取一个整数和一个字符。这是处理复杂输入格式的关键技巧。', dependencies: ['basic-output'], problems: [{ qid: '308928', name: '牛牛学说话之-混合' }] },

                    // Column 3
                    'arithmetic-add': { id: 'arithmetic-add', name: '加减法', description: '从最简单的加减法开始，学习如何在代码中进行基本的数学运算，让计算机为你计算。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [{ qid: '308925', name: '牛牛学加法' }] },
                    'arithmetic-sub': { id: 'arithmetic-sub', name: '乘法', description: '学习如何在代码中进行乘法运算，这是循环、数组和许多算法的基础。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [] },
                    'arithmetic-mul': { id: 'arithmetic-mul', name: '除法', description: '学习如何在代码中进行除法运算，并理解整数除法和浮点数除法的区别。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [] },
                    'arithmetic-div': { id: 'arithmetic-div', name: '取余', description: '掌握取余（或取模）运算，这是一个在编程中非常有用的工具，常用于判断奇偶、周期性问题和数据分组。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [] },
                    'bit-shift': { id: 'bit-shift', name: '位移', description: '探索位运算的奥秘，学习如何通过位移操作高效地进行乘除2的幂次运算，这是底层优化和算法竞赛中的常用技巧。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [] },
                    'arithmetic-mod': { id: 'arithmetic-mod', name: '混合运算', description: '综合运用多种算术运算符，解决需要遵循特定运算优先级的复杂数学表达式问题。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [] },
                    
                    // Column 4
                    'branch-control': { id: 'branch-control', name: '分支控制', description: '学习使用if-else语句，让你的程序学会“决策”，根据不同的条件执行不同的代码路径。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [] },
                    'single-loop': { id: 'single-loop', name: '单层循环', description: '掌握for和while等循环结构，让计算机重复执行任务，从而处理大量数据和实现自动化。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [] },
                    'multi-loop': { id: 'multi-loop', name: '多层循环', description: '学习如何嵌套循环，通过外层和内层循环的组合，解决更复杂的问题，例如打印图形和处理二维数据。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [] },
                    'mixed-control': { id: 'mixed-control', name: '混合', description: '综合运用分支和循环结构，解决需要将判断和重复执行结合起来的复杂逻辑问题。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [] },

                    // Column 5: 1D Array (Updated)
                    'array-1d': { id: 'array-1d', name: '一维数组', description: '学习使用数组，这是一种可以一次性存储多个相同类型数据的强大工具，是数据结构学习的基石。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [] },
                    'string-type': { id: 'string-type', name: '字符串', description: '学习处理由多个字符组成的序列——字符串。掌握字符串的输入、输出和常用操作，是处理文本信息的必备技能。', dependencies: ['integer', 'float', 'char', 'mixed-input'], problems: [] }
                }
            }
        };

        this.userProgress = {
            // All progress set to 100% for completion view testing
            solvedProblems: new Set([
                '2370904', '1254547', '274324',
                '308923', '308924',
                '308926',
                '308927',
                '308928',
                '308925'
            ]),
            nodeProgress: {
                'basic-output': 100,
                'integer': 100,
                'float': 100,
                'char': 100,
                'mixed-input': 100,
                'arithmetic-add': 100,
                'arithmetic-sub': 100,
                'arithmetic-mul': 100,
                'arithmetic-div': 100,
                'bit-shift': 100,
                'arithmetic-mod': 100,
                'branch-control': 100,
                'single-loop': 100,
                'multi-loop': 100,
                'mixed-control': 100,
                'array-1d': 100,
                'string-type': 100
            }
        };
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

    // 渲染阶段概览页
    renderStageSummaryView() {
        const tree = this.skillTrees['newbie-130'];
        if (!tree || !tree.stages) {
            this.container.innerHTML = '<div>技能树数据加载错误</div>';
            return;
        }

        let previousStageProgress = 100; // 第一关默认解锁

        const stagesToRender = tree.stages.slice(0, 3); // Only take the first three stages

        const stagesHtml = stagesToRender.map(stage => {
            let progress = 0;
            // Special calculation for the first stage "晨曦微光"
            if (stage.id === 'stage-1') {
                const totalColumns = stage.columns.length;
                let completedColumns = 0;
                
                stage.columns.forEach(column => {
                    // A column is completed if all its nodes have >= 60% progress
                    const isColumnCompleted = column.nodeIds.every(nodeId => 
                        (this.userProgress.nodeProgress[nodeId] || 0) >= 60
                    );
                    if (isColumnCompleted) {
                        completedColumns++;
                    }
                });
                
                progress = completedColumns * 20; // Each completed column is 20%
            } else {
                // Standard calculation for other stages
                const totalNodes = stage.columns ? stage.columns.flatMap(c => c.nodeIds).length : 0;
                const completedNodes = totalNodes > 0 
                    ? stage.columns.flatMap(c => c.nodeIds).filter(nodeId => (this.userProgress.nodeProgress[nodeId] || 0) === 100).length 
                    : 0;
                progress = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;
            }
            
            // A stage is locked if the previous stage's progress is not 100%
            const isLocked = previousStageProgress < 100;
            
            previousStageProgress = progress; // Update for the next iteration

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
    }

    // 渲染技能树详情页（单个阶段）
    renderDetailView(stageId) {
        const tree = this.skillTrees['newbie-130'];
        const stage = tree.stages.find(s => s.id === stageId);
        if (!stage) return;

        // Handle stages with no content (no columns defined)
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

        // The node states are now calculated based on progress percentage
        const nodeStates = this.calculateNodeStates(tree.nodes);
        
        // --- 修改开始：按手绘图布局组织 ---
        let leftColumnHtml = '';
        let rightColumnHtml = '';

        if (stage.columns) {
            stage.columns.forEach(column => {
                const nodesHtml = column.nodeIds.map(nodeId => {
                    if (tree.nodes[nodeId]) {
                        return this.renderNode(nodeId, tree.nodes, nodeStates);
                    }
                    return '';
                }).join('');
                
                let columnLockClass = '';
                let columnElementsHtml = '';

                // Check the state of the first node to determine if the column is locked
                const firstNodeId = column.nodeIds[0];
                if (firstNodeId) {
                    const firstNodeState = nodeStates[firstNodeId];
                    if (firstNodeState.state === 'locked') {
                        columnLockClass = 'skill-tree-column--locked';

                        const lockIcon = `<img src="https://api.iconify.design/mdi/lock-outline.svg?color=%23adb5bd" class="skill-tree-column__lock-icon" alt="Locked">`;
                        
                        let tooltipContent = '';
                        const dependencies = tree.nodes[firstNodeId]?.dependencies || [];

                        if (dependencies.length > 0) {
                            tooltipContent = dependencies.map(depId => {
                                const depNode = tree.nodes[depId];
                                const progress = this.userProgress.nodeProgress[depId] || 0;
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

                const columnHtml = `
                    <div class="skill-tree-column ${columnLockClass}" id="skill-tree-column-${column.id}">
                        ${columnElementsHtml}
                        <h4 class="skill-tree-column__title">${column.name}</h4>
                        <div class="skill-tree-column__nodes">${nodesHtml}</div>
                    </div>
                `;

                // 根据手绘图分配到左列或右列
                if (column.id === 'col-1' || column.id === 'col-2') {
                    leftColumnHtml += columnHtml;
                } else {
                    rightColumnHtml += columnHtml;
                }
            });
        }
        // --- 修改结束 ---

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

        // DOM渲染完成后绘制依赖连线
        setTimeout(() => this.drawColumnDependencyLines(stage), 0);
    }
    
    // 计算所有知识点和题目的状态 (基于进度百分比)
    calculateNodeStates(nodes) {
        const states = {};
        const { nodeProgress } = this.userProgress;
        
        for (const tagId in nodes) {
            const node = nodes[tagId];
            const progress = nodeProgress[tagId] || 0;
            let tagState = 'locked';

            const isCompleted = progress === 100;
            // A node is unlocked if all its dependencies have >= 60% progress.
            const areDependenciesMet = (node.dependencies || []).every(depId => (nodeProgress[depId] || 0) >= 60);

            if (isCompleted) {
                tagState = 'completed';
            } else if (areDependenciesMet) {
                tagState = 'unlocked';
            }
            
            if (tagState === 'locked') {
                const unmetDependencies = (node.dependencies || []).filter(depId => (nodeProgress[depId] || 0) < 60);
                states[tagId] = { state: 'locked', unmetDependencies };
            } else {
                states[tagId] = { state: tagState, unmetDependencies: [] };
            }
        }
        return states;
    }

    // 渲染单个知识点节点 (不再处理锁状态)
    renderNode(tagId, nodes, nodeStates) {
        const node = nodes[tagId];
        const stateInfo = nodeStates[tagId];
        const stateClass = `skill-node--${stateInfo.state}`;
        
        const progress = this.userProgress.nodeProgress[tagId] || 0;
        
        let backgroundStyle = '';
        if (progress > 0 && progress < 100) {
            backgroundStyle = `style="background: linear-gradient(to right, var(--primary-color-light) ${progress}%, #fff ${progress}%);"`;
        }

        return `
            <div class="skill-node ${stateClass}" data-id="${tagId}" id="skill-node-${tagId}" ${backgroundStyle}>
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
                const tagId = e.currentTarget.dataset.id;
                const state = this.calculateNodeStates(this.skillTrees['newbie-130'].nodes)[tagId].state;
                
                if (state !== 'locked') {
                    this.showNodePanel(tagId);
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

    showNodePanel(tagId) {
        const node = this.skillTrees['newbie-130'].nodes[tagId];
        if (!node) return;

        const show = () => {
            this.panelTitle.textContent = node.name;
            this.panelDesc.textContent = node.description || '暂无描述。';
    
            const problemsHtml = (node.problems || []).map(problem => {
                const isSolved = this.userProgress.solvedProblems.has(problem.qid);
                const problemClass = isSolved ? 'completed' : '';
                const problemUrl = `https://www.nowcoder.com/practice/${problem.qid}`;
                return `
                    <li class="${problemClass}">
                        <a href="${problemUrl}" target="_blank" rel="noopener noreferrer">${problem.name}</a>
                    </li>
                `;
            }).join('');
    
            this.panelProblems.innerHTML = problemsHtml;
            this.panel.classList.add('visible');
        };

        if (this.panel.classList.contains('visible')) {
            this.hideNodePanel();
            setTimeout(show, 300); // Wait for hide animation to finish
        } else {
            show();
        }
    }

    hideNodePanel() {
        this.panel.classList.remove('visible');
    }

    hide() {
        this.clearLines();
    }
}
