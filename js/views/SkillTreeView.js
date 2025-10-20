/**
 * 技能树视图模块
 * 处理技能树相关的UI和逻辑
 */
export class SkillTreeView {
    constructor(elements, state, apiService) {
        this.elements = elements;
        this.state = state;
        this.apiService = apiService;
        this.container = elements.skillTreeContainer;

        // ------------------ 模拟数据 ------------------
        // 在你提供真实数据前，我们先用这个模拟结构来开发
        // 知识点ID -> 知识点详情
        this.skillTreeData = {
            'basic-syntax': {
                name: '基础语法',
                dependencies: [],
                problems: [
                    { qid: 'SKILL_Q1', name: 'Hello Nowcoder' },
                    { qid: 'SKILL_Q2', name: '变量与常量' },
                ]
            },
            'data-types': {
                name: '数据类型',
                dependencies: ['basic-syntax'],
                problems: [
                    { qid: 'SKILL_Q3', name: '整数与浮点数' },
                    { qid: 'SKILL_Q4', name: '字符与字符串' },
                ]
            },
            'arrays-loops': {
                name: '数组与循环',
                dependencies: ['data-types'],
                problems: [
                    { qid: 'SKILL_Q5', name: '遍历数组' },
                    { qid: 'SKILL_Q6', name: '多维数组' },
                    // 这道题虽然在“数组”知识点下，但它依赖“排序”知识点
                    { qid: 'SKILL_Q7', name: '数组去重', dependencies: ['sorting'] },
                ]
            },
            'sorting': {
                name: '简单排序',
                dependencies: ['arrays-loops'],
                problems: [
                    { qid: 'SKILL_Q8', name: '冒泡排序' },
                    { qid: 'SKILL_Q9', name: '选择排序' },
                ]
            },
        };

        // 模拟当前登录用户的进度
        // 在真实场景中，这将从后端API获取
        this.userProgress = {
            // 已完成（不是已解锁）的知识点
            completedTags: new Set(['basic-syntax', 'data-types']),
            // 已解决的题目
            solvedProblems: new Set(['SKILL_Q1', 'SKILL_Q2', 'SKILL_Q3', 'SKILL_Q4', 'SKILL_Q5']),
        };
        // ---------------------------------------------
    }

    // 主渲染函数
    render() {
        if (!this.container) return;

        // 如果未登录，显示提示信息
        if (!this.state.isLoggedIn()) {
            this.container.innerHTML = `<div class="skill-tree-login-prompt">请先登录以查看您的技能树进度</div>`;
            return;
        }

        const nodeStates = this.calculateNodeStates();
        
        let html = '';
        for (const tagId in this.skillTreeData) {
            html += this.renderNode(tagId, nodeStates);
        }

        this.container.innerHTML = `<div class="skill-tree-graph">${html}</div>`;
    }
    
    // 计算所有知识点和题目的状态
    calculateNodeStates() {
        const states = {};
        const { completedTags, solvedProblems } = this.userProgress;

        // 递归检查函数，防止无限循环（虽然我们假设是DAG）
        const checkCompletion = (tagId, visited = new Set()) => {
            if (visited.has(tagId)) return false; // 依赖循环
            visited.add(tagId);
            
            const node = this.skillTreeData[tagId];
            if (!node) return false;
            
            for (const depId of node.dependencies) {
                if (!completedTags.has(depId)) {
                    return false;
                }
            }
            return true;
        };
        
        // 遍历所有节点，计算状态
        for (const tagId in this.skillTreeData) {
            const node = this.skillTreeData[tagId];
            let tagState = 'locked';

            // 检查前置知识点是否都已“完成”
            const areDependenciesMet = node.dependencies.every(depId => completedTags.has(depId));

            if (completedTags.has(tagId)) {
                tagState = 'completed';
            } else if (areDependenciesMet) {
                tagState = 'unlocked';
            }

            states[tagId] = {
                state: tagState,
                problems: {}
            };

            // 计算该节点下每个题目的状态
            node.problems.forEach(problem => {
                let problemState = 'locked';
                const areProblemDepsMet = (problem.dependencies || []).every(depId => completedTags.has(depId));

                if (solvedProblems.has(problem.qid)) {
                    problemState = 'completed';
                } else if (tagState !== 'locked' && areProblemDepsMet) {
                    problemState = 'unlocked';
                }
                states[tagId].problems[problem.qid] = { state: problemState };
            });
        }
        return states;
    }

    // 渲染单个知识点节点
    renderNode(tagId, nodeStates) {
        const node = this.skillTreeData[tagId];
        const stateInfo = nodeStates[tagId];
        const stateClass = `skill-node--${stateInfo.state}`; // locked, unlocked, completed
        
        // 渲染题目列表
        const problemsHtml = node.problems.map(problem => {
            const problemState = nodeStates[tagId].problems[problem.qid].state;
            const problemStateClass = `problem-item--${problemState}`;
            return `<li class="problem-item ${problemStateClass}" data-qid="${problem.qid}">${problem.name}</li>`;
        }).join('');

        return `
            <div class="skill-node ${stateClass}" data-id="${tagId}">
                <div class="skill-node__title">${node.name}</div>
                <ul class="skill-node__problems">${problemsHtml}</ul>
            </div>
        `;
    }
}
