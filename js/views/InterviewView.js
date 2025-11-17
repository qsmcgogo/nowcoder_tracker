/**
 * 面试视图模块
 * 处理面试题目相关的UI和逻辑
 */

import { APP_CONFIG } from '../config.js';
import { ApiService } from '../services/ApiService.js';
import * as helpers from '../utils/helpers.js';
import { eventBus, EVENTS } from '../events/EventBus.js';

export class InterviewView {
    constructor(elements, state, apiService) {
        this.elements = elements;
        this.state = state;
        this.apiService = apiService;
        
        this.interviewPageSize = APP_CONFIG.INTERVIEW_PAGE_SIZE;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
    }
    
    bindEvents() {
        // 监听面试标签切换事件
        eventBus.on(EVENTS.INTERVIEW_TAB_CHANGED, (tab) => {
            this.state.setActiveInterviewSubTab(tab);
            this.state.interviewCurrentPage = 1; // 重置页码
            this.fetchAndRenderInterview();
        });
        
        // 监听视图切换事件
        eventBus.on(EVENTS.VIEW_CHANGED, (view) => {
            if (view === 'interview') {
                this.fetchAndRenderInterview();
            }
        });
        
        // 移除USER_SEARCH事件监听器，避免死循环
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
            console.error('Error in interview user search:', error);
        }
    }
    
    // 获取当前视图中的题目ID
    getCurrentViewProblemIds() {
        const selectIds = (selector) => Array.from(document.querySelectorAll(selector))
            .map(el => el.getAttribute('data-problem-id'))
            .filter(Boolean)
            .join(',');
        
        return selectIds('#interview-view td[data-problem-id]') || null;
    }
    
    // 应用题目高亮显示
    applyProblemHighlighting(data, hasRival) {
        const { ac1Qids = [], ac2Qids = [] } = data || {};
        const ac1Set = new Set(ac1Qids.map(String));
        const ac2Set = new Set(ac2Qids.map(String));

        const allProblemCells = document.querySelectorAll('#interview-view td[data-problem-id]');
        
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
    
    async fetchCampusDataPage(page = 1) {
        const contestType = parseInt(this.state.activeCampusSubTab) || 100;
        const limit = 20;
        
        try {
            const data = await this.apiService.fetchCampusData(contestType, page, limit);
            
            if (data && data.contests) {
                const transformedContests = this.transformApiData(data.contests);
                
                // 存储当前页面数据
                if (!this.state.interviewDataCache) {
                    this.state.interviewDataCache = {};
                }
                this.state.interviewDataCache.campus = {
                    contests: transformedContests,
                    totalCount: data.totalCount,
                    currentPage: page
                };
                
                console.log(`Loaded page ${page}: ${transformedContests.length} contests, total: ${data.totalCount}`);
                return {
                    contests: transformedContests,
                    totalCount: data.totalCount,
                    currentPage: page
                };
            }
        } catch (error) {
            console.error(`Error loading page ${page}:`, error);
            throw error;
        }
    }
    
    async fetchAndRenderInterview() {
        // 处理校园招聘 - 使用API请求和分页
        if (this.state.activeInterviewSubTab === 'campus') {
            this.elements.interviewTbody.innerHTML = `<tr><td colspan="2" class="loading">正在加载校园招聘数据...</td></tr>`;
            
            try {
                await this.fetchCampusDataPage(this.state.interviewCurrentPage);
                this.renderInterviewView();
                
                // 自动查询用户状态（直接调用，避免事件循环）
                if (this.elements.userIdInput && this.elements.userIdInput.value) {
                    setTimeout(() => this.handleUserStatusSearch(this.elements.userIdInput.value), 100);
                } else if (this.state.loggedInUserId) {
                    // 如果有登录用户但没有输入框值，自动填充并查询
                    if (this.elements.userIdInput) {
                        this.elements.userIdInput.value = this.state.loggedInUserId;
                    }
                    setTimeout(() => this.handleUserStatusSearch(this.state.loggedInUserId), 100);
                }
            } catch (error) {
                console.error('Error loading campus data:', error);
                this.elements.interviewTbody.innerHTML = `<tr><td colspan="2">加载校园招聘数据失败</td></tr>`;
            }
            return;
        }
        
        // 处理其他面试标签 - 使用静态JSON
        if (!this.state.interviewDataCache || !this.state.interviewDataCache[this.state.activeInterviewSubTab]) {
            this.elements.interviewTbody.innerHTML = `<tr><td colspan="2" class="loading">正在加载面试数据...</td></tr>`;
            
            try {
                const data = await this.apiService.fetchInterviewData();
                
                if (data) {
                    // 与现有缓存合并以保留校园数据
                    if (!this.state.interviewDataCache) {
                        this.state.interviewDataCache = {};
                    }
                    Object.assign(this.state.interviewDataCache, data);
                    
                    console.log('Successfully loaded interview data:', this.state.interviewDataCache);
                }
            } catch (error) {
                console.error(error);
                this.elements.interviewTbody.innerHTML = `<tr><td colspan="2" class="error">加载面试数据失败</td></tr>`;
                return;
            }
        }
        
        this.renderInterviewView();
        
        // 自动查询用户状态（直接调用，避免事件循环）
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
    
    renderInterviewView() {
        // 处理校园招聘 - 使用比赛样式渲染
        if (this.state.activeInterviewSubTab === 'campus') {
            const categoryData = this.state.interviewDataCache?.campus;
            if (!categoryData || !categoryData.contests || categoryData.contests.length === 0) {
                this.elements.interviewTbody.innerHTML = `<tr><td colspan="6">暂无校园招聘数据</td></tr>`;
                this.renderInterviewPagination(0);
                return;
            }
            
            const contests = categoryData.contests;
            const totalCount = categoryData.totalCount;
            
            // 计算最大题目数
            let maxProblems = 0;
            contests.forEach(contest => {
                maxProblems = Math.max(maxProblems, contest.problems?.length || 0);
            });
            maxProblems = Math.min(maxProblems, 8); // 限制为8列
            
            // 更新表头
            const headerRow = document.querySelector('#interview-view .problems-table thead tr');
            if (headerRow) {
                headerRow.innerHTML = `<th>Contest</th>${Array.from({length: maxProblems}, (_, i) => `<th>${String.fromCharCode(65+i)}</th>`).join('')}`;
            }
            
            // 渲染比赛行
            const rowsHtml = contests.map(contest => {
                let problemsHtml = '';
                for (let i = 0; i < maxProblems; i++) {
                    const p = contest.problems[i];
                    const problemLetter = String.fromCharCode(65 + i);
                    problemsHtml += p ? 
                        `<td data-problem-id="${p.problemId}">${this.renderProblemHTML(p, problemLetter)}</td>` : 
                        '<td>-</td>';
                }
                return `<tr><td>${contest.name}</td>${problemsHtml}</tr>`;
            }).join('');
            
            this.elements.interviewTbody.innerHTML = rowsHtml;
            this.initTooltips();
            
            // 使用API总数进行分页
            this.renderInterviewPagination(totalCount);
        } else {
            // 处理其他面试标签 - 使用练习样式渲染
            const tabMapping = {
                'templates': 'templates', 
                'interview-top101': 'interview-top101',
                'interview-high-freq': 'interview-high-freq'
            };
            
            const dataKey = tabMapping[this.state.activeInterviewSubTab] || this.state.activeInterviewSubTab;
            const categoryData = this.state.interviewDataCache?.[dataKey];
            
            if (!categoryData) {
                this.elements.interviewTbody.innerHTML = `<tr><td colspan="6">暂无面试数据</td></tr>`;
                this.renderInterviewPagination(0);
                return;
            }
            
            // 重置表头为练习样式
            const headerRow = document.querySelector('#interview-view .problems-table thead tr');
            if (headerRow) {
                headerRow.innerHTML = '<th>知识点</th><th>题目</th><th>题目</th><th>题目</th><th>题目</th><th>题目</th>';
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
                        // 对于面试视图，总是转换枚举为分数
                        const score = p.difficulty ? (difficultyScoreMap[p.difficulty] || null) : null;
                        allProblemsFlat.push({ ...p, difficultyScore: score, knowledgePoint: kp.category });
                    });
                }
            });
            
            const totalProblems = allProblemsFlat.length;
            const interviewPageSize = 100; // 每页100题

            const startIndex = (this.state.interviewCurrentPage - 1) * interviewPageSize;
            const endIndex = startIndex + interviewPageSize;
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

            this.elements.interviewTbody.innerHTML = finalHtml || `<tr><td colspan="6">暂无题目</td></tr>`;
            this.initTooltips();
            this.renderInterviewPagination(totalProblems);
        }
    }
    
    renderProblemHTML(problem, letter = null) {
        // 若入口URL带 channelPut，则笔面试加后缀"a"，否则回落到历史默认（helpers 内部默认）
        const cp = this.state.channelPut ? (this.state.channelPut + 'a') : undefined;
        const problemUrl = helpers.buildUrlWithChannelPut(problem.url || problem.questionUrl, cp);
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
    
    renderPracticeProblems(categoryData) {
        if (!this.elements.interviewTbody) return;
        
        let totalItems = 0;
        let problems = [];
        
        // 根据数据结构提取题目
        if (categoryData.knowledge_points && categoryData.knowledge_points.length > 0) {
            totalItems = categoryData.knowledge_points.reduce((total, kp) => {
                return total + (kp.problems?.length || 0);
            }, 0);
            
            // 获取当前页的题目
            const startIndex = (this.state.interviewCurrentPage - 1) * this.interviewPageSize;
            let currentIndex = 0;
            
            for (const kp of categoryData.knowledge_points) {
                if (kp.problems) {
                    for (const problem of kp.problems) {
                        if (currentIndex >= startIndex && problems.length < this.interviewPageSize) {
                            problems.push(problem);
                        }
                        currentIndex++;
                    }
                }
            }
        } else if (categoryData.problems && categoryData.problems.length > 0) {
            totalItems = categoryData.problems.length;
            const startIndex = (this.state.interviewCurrentPage - 1) * this.interviewPageSize;
            problems = categoryData.problems.slice(startIndex, startIndex + this.interviewPageSize);
        } else {
            this.elements.interviewTbody.innerHTML = `<tr><td colspan="2">暂无题目数据</td></tr>`;
            return;
        }
        
        if (problems.length === 0) {
            this.elements.interviewTbody.innerHTML = `<tr><td colspan="2">暂无题目数据</td></tr>`;
            return;
        }
        
        const rowsHtml = problems.map(problem => {
            // 若入口URL带 channelPut，则笔面试加后缀"1"，否则回落到历史默认（helpers 内部默认）
            const cp = this.state.channelPut ? (this.state.channelPut + '1') : undefined;
            const problemUrl = helpers.buildUrlWithChannelPut(problem.url, cp);
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
        
        this.elements.interviewTbody.innerHTML = rowsHtml;
    }
    
    renderInterviewPagination(totalItems) {
        const container = document.querySelector('#interview-pagination-container .pagination-controls');
        const info = document.getElementById('interviewPaginationInfo');
        
        if (!container || !info) return;
        
        // 使用不同页面大小
        let pageSize;
        if (this.state.activeInterviewSubTab === 'campus') {
            pageSize = this.interviewPageSize; // 20 for campus recruitment
        } else {
            pageSize = 100; // 100 for practice-style tabs (templates, interview-top101, etc.)
        }
        
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        
        // 对于面试标签，显示"第x页，共y页"而不是"显示x-y共z条记录"
        if (this.state.activeInterviewSubTab === 'campus') {
            // 对于校园招聘，显示正常分页信息
            const startItem = (this.state.interviewCurrentPage - 1) * pageSize + 1;
            const endItem = Math.min(this.state.interviewCurrentPage * pageSize, totalItems);
            info.textContent = totalItems > 0 ? 
                `显示 ${startItem}-${endItem} 共 ${totalItems} 条记录` : 
                '共 0 条记录';
        } else {
            // 对于其他标签（模板等），显示页面信息
            info.textContent = totalPages > 0 ? 
                `第 ${this.state.interviewCurrentPage} 页，共 ${totalPages} 页` : 
                '共 0 页';
        }
        
        const prevBtn = container.querySelector('.pagination-btn:first-of-type');
        const nextBtn = container.querySelector('.pagination-btn:last-of-type');
        const pageNumbers = container.querySelector('.page-numbers');
        
        if (!prevBtn || !nextBtn || !pageNumbers) return;
        
        prevBtn.disabled = this.state.interviewCurrentPage === 1;
        nextBtn.disabled = this.state.interviewCurrentPage === totalPages || totalItems === 0;
        
        pageNumbers.innerHTML = '';
        
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.state.interviewCurrentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageLink = helpers.createPageLink(i, (page) => this.handleInterviewPageChange(page), i === this.state.interviewCurrentPage);
            pageNumbers.appendChild(pageLink);
        }
        
        // 更新上一页/下一页按钮处理器
        prevBtn.onclick = async () => {
            if (this.state.interviewCurrentPage > 1) {
                this.state.interviewCurrentPage--;
                if (this.state.activeInterviewSubTab === 'campus') {
                    await this.fetchAndRenderInterview();
                    // 自动查询用户状态（校园招聘）
                    if (this.elements.userIdInput && this.elements.userIdInput.value) {
                        setTimeout(() => this.handleUserStatusSearch(this.elements.userIdInput.value), 100);
                    }
                } else {
                    this.renderInterviewView();
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
            }
        };
        
        nextBtn.onclick = async () => {
            if (this.state.interviewCurrentPage < totalPages) {
                this.state.interviewCurrentPage++;
                if (this.state.activeInterviewSubTab === 'campus') {
                    await this.fetchAndRenderInterview();
                    // 自动查询用户状态（校园招聘）
                    if (this.elements.userIdInput && this.elements.userIdInput.value) {
                        setTimeout(() => this.handleUserStatusSearch(this.elements.userIdInput.value), 100);
                    }
                } else {
                    this.renderInterviewView();
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
            }
        };
    }
    
    async handleInterviewPageChange(page) {
        this.state.interviewCurrentPage = page;
        
        if (this.state.activeInterviewSubTab === 'campus') {
            await this.fetchAndRenderInterview();
            // 自动查询用户状态（校园招聘）
            if (this.elements.userIdInput && this.elements.userIdInput.value) {
                setTimeout(() => this.handleUserStatusSearch(this.elements.userIdInput.value), 100);
            }
        } else {
            this.renderInterviewView();
            // 自动查询用户状态（通过事件总线）
            if (this.elements.userIdInput && this.elements.userIdInput.value) {
                setTimeout(() => eventBus.emit(EVENTS.USER_SEARCH, this.elements.userIdInput.value), 100);
            }
        }
    }
    
    transformApiData(contests) {
        const difficultyScoreMap = { 1: 800, 2: 1200, 3: 1600, 4: 2000, 5: 2400 };
        // These are the specific contest types where we want to HIDE enum-based difficulties.
        const nonCampusContestTabs = ['weekly', 'monthly', 'practice', 'challenge', 'xcpc'];
        const isNonCampusSpecificView = nonCampusContestTabs.includes(this.state.activeContestTab);

        return contests.map(contest => ({
            id: contest.contestId,
            name: contest.contestName,
            url: contest.contestUrl,
            problems: (contest.questions || []).map(p => {
                let score = null;
                // If difficulty is a score (> 5), always show it.
                if (p.difficulty > 5) {
                    score = p.difficulty;
                // If it's an enum (1-5), show it ONLY IF we are NOT in a specific non-campus view.
                // This means it WILL show in "all" and "campus" views.
                } else if (!isNonCampusSpecificView) {
                    score = difficultyScoreMap[p.difficulty] || null;
                }
                return {
                    ...p,
                    difficultyScore: score,
                };
            })
        }));
    }
    
    initTooltips() {
        const circles = document.querySelectorAll('#interview-view .difficulty-circle');
        
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
