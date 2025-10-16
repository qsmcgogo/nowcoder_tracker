/**
 * 练习视图模块
 * 处理练习题目相关的UI和逻辑
 */

import { APP_CONFIG } from '../config.js';
import { ApiService } from '../services/ApiService.js';
import * as helpers from '../utils/helpers.js';
import { eventBus, EVENTS } from '../events/EventBus.js';

export class PracticeView {
    constructor(elements, state, apiService) {
        this.elements = elements;
        this.state = state;
        this.apiService = apiService;
        
        this.practicePageSize = APP_CONFIG.PRACTICE_PAGE_SIZE;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
    }
    
    bindEvents() {
        // 监听练习标签切换事件
        eventBus.on(EVENTS.PRACTICE_TAB_CHANGED, (tab) => {
            this.state.setActivePracticeSubTab(tab);
            this.state.practiceCurrentPage = 1; // 重置页码
            this.fetchAndRenderPractice();
        });
        
        // 监听视图切换事件
        eventBus.on(EVENTS.VIEW_CHANGED, (view) => {
            if (view === 'practice') {
                this.fetchAndRenderPractice();
            }
        });
    }
    
    // 处理用户状态查询和高亮显示
    async handleUserStatusSearch(userId) {
        if (!userId) return;
        
        try {
            // 获取当前视图中的题目ID
            const qids = this.getCurrentViewProblemIds();
            if (!qids) {
                return;
            }
            
            // 查询用户做题状态
            const diffData = await this.apiService.fetchUserProblemDiff(userId, qids, null);
            
            // 应用高亮显示
            this.applyProblemHighlighting(diffData, false);
            
        } catch (error) {
            console.error('Error in practice user search:', error);
        }
    }
    
    // 获取当前视图中的题目ID
    getCurrentViewProblemIds() {
        const selectIds = (selector) => Array.from(document.querySelectorAll(selector))
            .map(el => el.getAttribute('data-problem-id'))
            .filter(Boolean)
            .join(',');
        
        return selectIds('#practice-view td[data-problem-id]') || null;
    }
    
    // 应用题目高亮显示
    applyProblemHighlighting(data, hasRival) {
        const { ac1Qids = [], ac2Qids = [] } = data || {};
        const ac1Set = new Set(ac1Qids.map(String));
        const ac2Set = new Set(ac2Qids.map(String));

        const allProblemCells = document.querySelectorAll('#practice-view td[data-problem-id]');
        
        allProblemCells.forEach(cell => {
            cell.classList.remove('status-ac', 'status-rival-ac', 'status-none', 'status-all-ac');
        });

        allProblemCells.forEach(cell => {
            const pid = cell.getAttribute('data-problem-id');
            if (ac1Set.has(pid)) {
                cell.classList.add('status-ac');
            } else if (hasRival && ac2Set.has(pid)) {
                cell.classList.add('status-rival-ac');
            } else {
                cell.classList.add('status-none');
            }
        });
    }
    
    async fetchAndRenderPractice() {
        if (!this.state.practiceDataCache) {
            this.elements.practiceTbody.innerHTML = `<tr><td colspan="2" class="loading">正在加载题目数据...</td></tr>`;
        }
        
        this.state.setLoadingState('practice', true);
        eventBus.emit(EVENTS.DATA_LOADING, { module: 'practice' });
        
        try {
            const data = await this.apiService.fetchPracticeData(this.state.activePracticeSubTab);
            
            if (data) {
                this.state.practiceDataCache = data;
                this.renderPracticeView();
            } else {
                this.renderPracticeError('没有找到练习数据');
            }
            
            eventBus.emit(EVENTS.DATA_LOADED, { module: 'practice', data });
            
            // 自动查询用户状态
            if (this.elements.userIdInput && this.elements.userIdInput.value) {
                setTimeout(() => {
                    // 直接调用handleUserStatusSearch方法
                    this.handleUserStatusSearch(this.elements.userIdInput.value);
                }, 100);
            } else if (this.state.loggedInUserId) {
                // 如果有登录用户但没有输入框值，自动填充并查询
                if (this.elements.userIdInput) {
                    this.elements.userIdInput.value = this.state.loggedInUserId;
                }
                setTimeout(() => {
                    this.handleUserStatusSearch(this.state.loggedInUserId);
                }, 100);
            }
        } catch (error) {
            console.error('Error fetching practice data:', error);
            this.renderPracticeError('加载练习数据失败');
            eventBus.emit(EVENTS.DATA_ERROR, { module: 'practice', error });
        } finally {
            this.state.setLoadingState('practice', false);
        }
    }
    
    renderPracticeView() {
        if (!this.state.practiceDataCache) return;
        
        // 显示/隐藏教程区域
        const tutorialSection = document.getElementById('newbie130-tutorial-section');
        if (tutorialSection) {
            tutorialSection.style.display = this.state.activePracticeSubTab === 'newbie130' ? 'block' : 'none';
        }
        
        const categoryData = this.state.practiceDataCache[this.state.activePracticeSubTab];
        if (!categoryData) {
            this.renderPracticeError('没有找到对应的练习分类');
            return;
        }
        
        // 按备份逻辑处理数据结构
        const originalItems = categoryData.knowledge_points && categoryData.knowledge_points.length > 0
            ? categoryData.knowledge_points
            : [{ category: '题目列表', problems: categoryData.problems }];

        const difficultyScoreMap = { 1: 800, 2: 1200, 3: 1600, 4: 2000, 5: 2400 };
        const allProblemsFlat = [];
        originalItems.forEach(kp => {
            const problems = (kp.problems || []).filter(p => p && p.problemId);
            if (problems.length > 0) {
                problems.forEach(p => {
                    // 对于练习视图，总是转换枚举为分数
                    const score = p.difficulty ? (difficultyScoreMap[p.difficulty] || null) : null;
                    allProblemsFlat.push({ ...p, difficultyScore: score, knowledgePoint: kp.category });
                });
            }
        });
        
        const totalProblems = allProblemsFlat.length;
        const practicePageSize = 100; // 每页100题

        const startIndex = (this.state.practiceCurrentPage - 1) * practicePageSize;
        const endIndex = startIndex + practicePageSize;
        const pageProblems = allProblemsFlat.slice(startIndex, endIndex);

        // 按备份逻辑渲染：每行5个题目，知识点变化时换行
        let finalHtml = '';
        if (pageProblems.length > 0) {
            let problemsInCurrentRow = 0;
            let currentProcessingKp = null; 

            finalHtml += '<tr>'; // 开始第一行
            
            for (const problem of pageProblems) {
                // 情况1：知识点变化，强制换行
                if (problem.knowledgePoint !== currentProcessingKp) {
                    if (problemsInCurrentRow > 0) { // 不是页面第一个题目
                        // 填充并关闭前一行
                        const remaining = 5 - problemsInCurrentRow;
                        if (remaining > 0) finalHtml += `<td></td>`.repeat(remaining);
                        finalHtml += '</tr><tr>';
                    }
                    // 新知识点，打印名称并重置计数器
                    currentProcessingKp = problem.knowledgePoint;
                    finalHtml += `<td class="knowledge-point-cell">${currentProcessingKp}</td>`;
                    problemsInCurrentRow = 0;
                } 
                // 情况2：知识点相同但当前行已满
                else if (problemsInCurrentRow === 5) {
                     finalHtml += '</tr><tr>'; // 关闭旧行，开始新行
                     // 这是续行，所以为知识点名称添加空单元格
                     finalHtml += `<td class="knowledge-point-cell"></td>`;
                     problemsInCurrentRow = 0;
                }

                // 添加当前题目单元格到当前行
                finalHtml += `<td data-problem-id="${problem.problemId}">${this.renderProblemHTML(problem)}</td>`;
                problemsInCurrentRow++;
            }
            
            // 循环结束后，确保最后一行正确填充和关闭
            const remaining = 5 - problemsInCurrentRow;
            if (remaining > 0) finalHtml += `<td></td>`.repeat(remaining);
            finalHtml += '</tr>';
        }

        this.elements.practiceTbody.innerHTML = finalHtml || `<tr><td colspan="6">暂无题目</td></tr>`;
        this.renderPracticePagination(totalProblems);
        this.initTooltips();
    }
    
    renderPracticeProblems(categoryData) {
        if (!this.elements.practiceTbody) return;
        
        let totalItems = 0;
        let problems = [];
        
        // 根据数据结构提取题目
        if (categoryData.knowledge_points && categoryData.knowledge_points.length > 0) {
            // 对于有知识点的分类（如模板、面试top101）
            totalItems = categoryData.knowledge_points.reduce((total, kp) => {
                return total + (kp.problems?.length || 0);
            }, 0);
            
            // 获取当前页的题目
            const startIndex = (this.state.practiceCurrentPage - 1) * this.practicePageSize;
            let currentIndex = 0;
            
            for (const kp of categoryData.knowledge_points) {
                if (kp.problems) {
                    for (const problem of kp.problems) {
                        if (currentIndex >= startIndex && problems.length < this.practicePageSize) {
                            problems.push(problem);
                        }
                        currentIndex++;
                    }
                }
            }
        } else if (categoryData.problems && categoryData.problems.length > 0) {
            // 对于直接包含题目的分类（如高频题）
            totalItems = categoryData.problems.length;
            const startIndex = (this.state.practiceCurrentPage - 1) * this.practicePageSize;
            problems = categoryData.problems.slice(startIndex, startIndex + this.practicePageSize);
        } else {
            this.elements.practiceTbody.innerHTML = `<tr><td colspan="2">暂无题目数据</td></tr>`;
            return;
        }
        
        if (problems.length === 0) {
            this.elements.practiceTbody.innerHTML = `<tr><td colspan="2">暂无题目数据</td></tr>`;
            return;
        }
        
        const rowsHtml = problems.map(problem => {
            const problemUrl = helpers.buildUrlWithChannelPut(problem.url, this.state.channelPut);
            const difficultyInfo = problem.difficultyScore ? 
                helpers.getDifficultyInfo(problem.difficultyScore) : null;
            const difficultyText = difficultyInfo ? 
                helpers.getDifficultyText(difficultyInfo.class, problem.difficultyScore) : 'N/A';
            
            return `
                <tr>
                    <td><a href="${problemUrl}" target="_blank" rel="noopener noreferrer">${problem.title}</a></td>
                    <td>${difficultyText}</td>
                </tr>
            `;
        }).join('');
        
        this.elements.practiceTbody.innerHTML = rowsHtml;
    }
    
    renderPracticePagination(totalItems) {
        const container = document.querySelector('#practice-view .pagination-controls');
        const info = document.getElementById('practicePaginationInfo');
        
        if (!container || !info) return;
        
        const practicePageSize = 100;
        const totalPages = Math.ceil(totalItems / practicePageSize) || 1;
        
        info.textContent = totalItems > 0 ? 
            `第 ${this.state.practiceCurrentPage} 页，共 ${totalPages} 页` : 
            '共 0 页';
        
        const prevBtn = container.querySelector('.pagination-btn:first-of-type');
        const nextBtn = container.querySelector('.pagination-btn:last-of-type');
        const pageNumbers = container.querySelector('.page-numbers');
        
        if (!prevBtn || !nextBtn || !pageNumbers) return;
        
        prevBtn.disabled = this.state.practiceCurrentPage === 1;
        nextBtn.disabled = this.state.practiceCurrentPage === totalPages;
        
        pageNumbers.innerHTML = '';
        
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.state.practiceCurrentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageLink = helpers.createPageLink(i, (page) => this.handlePracticePageChange(page), i === this.state.practiceCurrentPage);
            pageNumbers.appendChild(pageLink);
        }
        
        // 更新上一页/下一页按钮处理器
        if (prevBtn) {
            prevBtn.onclick = () => {
                if (this.state.practiceCurrentPage > 1) {
                    this.handlePracticePageChange(this.state.practiceCurrentPage - 1);
                }
            };
        }
        
        if (nextBtn) {
            nextBtn.onclick = () => {
                if (this.state.practiceCurrentPage < totalPages) {
                    this.handlePracticePageChange(this.state.practiceCurrentPage + 1);
                }
            };
        }
    }
    
    async handlePracticePageChange(page) {
        this.state.practiceCurrentPage = page;
        this.renderPracticeView();
        // 自动查询用户状态（直接调用）
        if (this.elements.userIdInput && this.elements.userIdInput.value) {
            setTimeout(() => this.handleUserStatusSearch(this.elements.userIdInput.value), 100);
        } else if (this.state.loggedInUserId) {
            // 如果有登录用户但没有输入框值，自动填充并查询
            if (this.elements.userIdInput) {
                this.elements.userIdInput.value = this.state.loggedInUserId;
            }
            setTimeout(() => this.handleUserStatusSearch(this.state.loggedInUserId), 100);
        }
    }
    
    renderPracticeError(message) {
        if (this.elements.practiceTbody) {
            this.elements.practiceTbody.innerHTML = `<tr><td colspan="6" class="error">${message}</td></tr>`;
        }
    }
    
    renderProblemHTML(problem) {
        const problemUrl = helpers.buildUrlWithChannelPut(problem.url || problem.questionUrl, this.state.channelPut);
        let difficultyCircleHtml = '';
        
        if (problem.difficultyScore) {
            const difficultyInfo = helpers.getDifficultyInfo(problem.difficultyScore);
            const circleStyle = helpers.getCircleStyle(difficultyInfo);
            const tooltipContent = helpers.generateTooltipContent(problem).replace(/"/g, '&quot;');
            difficultyCircleHtml = `<span class="difficulty-circle" style="${circleStyle}" data-tooltip="${tooltipContent}"></span>`;
        }
        
        // 题目名字省略处理
        const truncatedTitle = problem.title && problem.title.length > 20 ? 
            problem.title.substring(0, 20) + '...' : 
            (problem.title || 'N/A');
        
        return `
            <div class="problem-cell-content">
                ${difficultyCircleHtml}
                <a href="${problemUrl}" target="_blank" rel="noopener noreferrer" class="problem-link" title="${problem.title}">
                    ${truncatedTitle}
                </a>
            </div>
        `;
    }
    
    initTooltips() {
        const circles = document.querySelectorAll('#practice-view .difficulty-circle');
        
        circles.forEach(circle => {
            if (circle.dataset.tooltipBound) return;
            circle.dataset.tooltipBound = 'true';

            const tooltipContent = circle.getAttribute('data-tooltip');
            if (!tooltipContent) return;

            const showTooltip = (e) => {
                helpers.hideCustomTooltip();
                const tooltip = document.createElement('div');
                tooltip.className = 'custom-tooltip';
                tooltip.innerHTML = tooltipContent.replace(/\\n/g, '<br>');
                document.body.appendChild(tooltip);
                
                const rect = e.target.getBoundingClientRect();
                tooltip.style.left = `${rect.left + window.scrollX}px`;
                tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 5}px`;
                tooltip.style.opacity = '1';
            };

            const hideTooltip = () => {
                helpers.hideCustomTooltip();
            };

            circle.addEventListener('mouseenter', showTooltip);
            circle.addEventListener('mouseleave', hideTooltip);
        });
    }
}
