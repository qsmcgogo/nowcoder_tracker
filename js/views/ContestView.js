/**
 * 比赛视图模块
 * 处理比赛相关的UI和逻辑
 */

import { APP_CONFIG } from '../config.js';
import { ApiService } from '../services/ApiService.js';
import * as helpers from '../utils/helpers.js';
import { eventBus, EVENTS } from '../events/EventBus.js';

export class ContestView {
    constructor(elements, state, apiService) {
        this.elements = elements;
        this.state = state;
        this.apiService = apiService;
        
        this.contestsPageSize = APP_CONFIG.CONTESTS_PAGE_SIZE;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
    }
    
    bindEvents() {
        // 监听比赛标签切换事件
        eventBus.on(EVENTS.CONTEST_TAB_CHANGED, (tab) => {
            this.state.setActiveContestTab(tab);
            this.state.contestsCurrentPage = 1; // 重置页码
            this.fetchAndRenderContests();
        });
        
        // 监听视图切换事件
        eventBus.on(EVENTS.VIEW_CHANGED, (view) => {
            if (view === 'contests') {
                this.fetchAndRenderContests();
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
            console.error('Error in contest user search:', error);
        }
    }
    
    // 获取当前视图中的题目ID
    getCurrentViewProblemIds() {
        const selectIds = (selector) => Array.from(document.querySelectorAll(selector))
            .map(el => el.getAttribute('data-problem-id'))
            .filter(Boolean)
            .join(',');
        
        return selectIds('#contests-view td[data-problem-id]') || null;
    }
    
    // 应用题目高亮显示
    applyProblemHighlighting(data, hasRival) {
        const { ac1Qids = [], ac2Qids = [] } = data || {};
        const ac1Set = new Set(ac1Qids.map(String));
        const ac2Set = new Set(ac2Qids.map(String));

        const allProblemCells = document.querySelectorAll('#contests-view td[data-problem-id]');
        
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
    
    async fetchAndRenderContests() {
        this.elements.contestTbody.innerHTML = `<tr><td colspan="8" class="loading">正在加载比赛数据...</td></tr>`;
        
        this.state.setLoadingState('contests', true);
        eventBus.emit(EVENTS.DATA_LOADING, { module: 'contests' });
        
        try {
            const data = await this.apiService.fetchContests(
                this.state.activeContestTab,
                this.state.contestsCurrentPage,
                this.contestsPageSize
            );
            
            if (data && data.contests) {
                // 将后端返回的 papers 结构转换为渲染所需结构
                const transformed = this.transformApiData(data.contests || []);
                this.state.contests = transformed;
                this.state.totalContests = data.totalCount;
                this.renderContests();
                this.renderContestPagination();
            } else {
                this.renderContestError('没有找到比赛数据');
            }
            
            eventBus.emit(EVENTS.DATA_LOADED, { module: 'contests', data });
            
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
            console.error('Error fetching contests:', error);
            this.renderContestError('加载比赛数据失败');
            eventBus.emit(EVENTS.DATA_ERROR, { module: 'contests', error });
        } finally {
            this.state.setLoadingState('contests', false);
        }
    }
    
    // 将 API 原始字段（contestId/contestName/contestUrl/questions）
    // 转换为视图渲染所需字段（id/name/url/problems，并计算 difficultyScore）
    transformApiData(contests) {
        const difficultyScoreMap = { 1: 800, 2: 1200, 3: 1600, 4: 2000, 5: 2400, 6: 2800, 7: 3000, 8: 3200, 9: 3400, 10: 3500 };
        // 非校园类（周赛/小白/练习/挑战/寒假营/多校/XCPC/蓝桥杯）
        const nonCampusContestTabs = ['19', '9', '6', '2', '20', '21', '22', '25'];
        const isNonCampusSpecificView = nonCampusContestTabs.includes(String(this.state.activeContestTab));
        
        return contests.map(contest => ({
            id: contest.contestId,
            name: contest.contestName,
            url: contest.contestUrl,
            problems: (contest.questions || []).map(p => {
                let score = null;
                const d = Number(p.difficulty);
                if (!isNaN(d) && d > 0) {
                    if (d > 10) {
                        // 已是分数型（如 1200/1600/...）
                        score = d;
                    } else {
                        // 1~10 等级映射为分数，确保 >6 也能正确渲染
                        score = difficultyScoreMap[d] || null;
                    }
                }
                return { ...p, difficultyScore: score };
            })
        }));
    }
    
    renderContests() {
        if (!this.elements.contestTbody) return;
        
        if (this.state.contests.length === 0) {
            this.elements.contestTbody.innerHTML = `<tr><td colspan="8">暂无比赛数据</td></tr>`;
            return;
        }
        
        // 计算最大题目数量（不限制为8列，完整展示）
        const maxProblems = Math.max(...this.state.contests.map(c => c.problems?.length || 0));
        
        // 更新表头
        const headerRow = document.querySelector('#contests-view .problems-table thead tr');
        if (headerRow) {
            // 放宽列宽：XCPC(22)、多校(20)、寒假营(21)
            const tab = String(this.state.activeContestTab);
            const wideTabs = new Set(['22', '20', '21']);
            const contestColWidth = wideTabs.has(tab) ? 'style="width: 40%;"' : '';
            headerRow.innerHTML = `<th ${contestColWidth}>Contest</th>${Array.from({length: maxProblems}, (_, i) => `<th>${String.fromCharCode(65+i)}</th>`).join('')}`;
        }
        
        const rowsHtml = this.state.contests.map(contest => {
            // 若入口URL带 channelPut，则竞赛加后缀"a"，否则回落到历史默认（helpers 内部默认）
            const cp = this.state.channelPut ? (this.state.channelPut + 'a') : undefined;
            const contestUrl = helpers.buildUrlWithChannelPut(contest.url, cp);
            let problemsHtml = '';
            
            for (let i = 0; i < maxProblems; i++) {
                const p = contest.problems[i];
                const problemLetter = String.fromCharCode(65 + i);
                problemsHtml += p ? 
                    `<td data-problem-id="${p.problemId}">${this.renderProblemHTML(p, problemLetter)}</td>` : 
                    '<td>-</td>';
            }
            
            return `
                <tr>
                    <td><a href="${contestUrl}" target="_blank" rel="noopener noreferrer">${contest.name}</a></td>
                    ${problemsHtml}
                </tr>
            `;
        }).join('');
        
        this.elements.contestTbody.innerHTML = rowsHtml;
        this.initTooltips();
    }
    
    renderProblemHTML(problem, letter = null) {
        let difficultyCircleHtml = '';

        // Only render the circle if there is a valid difficulty score.
        if (problem.difficultyScore) {
            const difficultyInfo = helpers.getDifficultyInfo(problem.difficultyScore);
            const circleStyle = helpers.getCircleStyle(difficultyInfo);
            const tooltipContent = helpers.generateTooltipContent(problem).replace(/"/g, '&quot;');
            difficultyCircleHtml = `<span class="difficulty-circle" style="${circleStyle}" data-tooltip="${tooltipContent}"></span>`;
        }
        
        // Check if current tab is XCPC (type 22)
        const isXCPC = String(this.state.activeContestTab) === '22';
        
        // 若入口URL带 channelPut，则竞赛加后缀"1"，否则回落到历史默认（helpers 内部默认）
        const cp = this.state.channelPut ? (this.state.channelPut + '1') : undefined;
        let finalUrl = helpers.buildUrlWithChannelPut(problem.url || problem.questionUrl, cp);
        let titleHtml;
        
        if (isXCPC) {
            // For XCPC: only show difficulty circle and clickable letter, no title
            if (finalUrl) {
                titleHtml = `<a class="problem-link" href="${finalUrl}" target="_blank" rel="noopener noreferrer" title="${problem.title || 'N/A'}">${letter || ''}</a>`;
            } else {
                titleHtml = `<span title="${problem.title || 'N/A'}">${letter || ''}</span>`;
            }
        } else {
            // For other tabs: show normal title with ellipsis
            const truncatedTitle = problem.title && problem.title.length > 20 ? 
                problem.title.substring(0, 20) + '...' : 
                (problem.title || 'N/A');
            
            if (finalUrl) {
                titleHtml = `<a class="problem-link" href="${finalUrl}" target="_blank" rel="noopener noreferrer" title="${problem.title}">${truncatedTitle}</a>`;
            } else {
                titleHtml = `<span title="${problem.title || 'N/A'}">${truncatedTitle}</span>`;
            }
        }

        const letterPrefix = letter && !isXCPC ? `${letter}. ` : '';
        
        return `
            <div class="problem-cell-content">
                ${difficultyCircleHtml}
                ${letterPrefix}${titleHtml}
            </div>
        `;
    }
    
    renderContestPagination() {
        // 修正：匹配 index.html 中的分页容器结构
        const container = document.querySelector('#contests-view .pagination-container');
        const info = document.getElementById('contestsPaginationInfo');
        
        if (!container || !info) return;
        
        this.renderPaginationUI(
            container,
            info,
            this.state.totalContests,
            this.state.contestsCurrentPage,
            this.contestsPageSize,
            (page) => this.handleContestPageChange(page)
        );
    }
    
    renderPaginationUI(container, infoEl, totalItems, currentPage, itemsPerPage, pageClickHandler) {
        if (!container || !infoEl) return;
        
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);
        
        infoEl.textContent = totalItems > 0 ? 
            `显示 ${startItem}-${endItem} 共 ${totalItems} 条记录` : 
            '共 0 条记录';
        
        const prevBtn = container.querySelector('.pagination-btn:first-of-type');
        const nextBtn = container.querySelector('.pagination-btn:last-of-type');
        const pageNumbers = container.querySelector('.page-numbers');
        
        if (!prevBtn || !nextBtn || !pageNumbers) return;
        
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
        
        pageNumbers.innerHTML = '';
        
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        if (startPage > 1) {
            const firstPage = helpers.createPageLink(1, pageClickHandler);
            pageNumbers.appendChild(firstPage);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageLink = helpers.createPageLink(i, pageClickHandler, i === currentPage);
            pageNumbers.appendChild(pageLink);
        }
        
        if (endPage < totalPages) {
            const lastPage = helpers.createPageLink(totalPages, pageClickHandler);
            pageNumbers.appendChild(lastPage);
        }
        
        // 更新上一页/下一页按钮处理器
        prevBtn.onclick = () => {
            if (currentPage > 1) {
                pageClickHandler(currentPage - 1);
            }
        };
        
        nextBtn.onclick = () => {
            if (currentPage < totalPages) {
                pageClickHandler(currentPage + 1);
            }
        };
    }
    
    async handleContestPageChange(page) {
        this.state.contestsCurrentPage = page;
        await this.fetchAndRenderContests();
        
        // 自动查询用户状态（如果有用户ID）
        if (this.elements.userIdInput && this.elements.userIdInput.value) {
            setTimeout(() => {
                if (window.app && window.app.handleUserStatusSearch) {
                    window.app.handleUserStatusSearch();
                }
            }, 100);
        }
    }
    
    renderContestError(message) {
        if (this.elements.contestTbody) {
            this.elements.contestTbody.innerHTML = `<tr><td colspan="8" class="error">${message}</td></tr>`;
        }
    }
    
    initTooltips() {
        // 初始化题目标题的原生title提示
        const problemLinks = document.querySelectorAll('#contests-view .problem-link');
        problemLinks.forEach(link => {
            const td = link.closest('td');
            const problemId = td && td.dataset.problemId;
            if (!problemId) return;

            link.addEventListener('mouseenter', (e) => {
                helpers.showCustomTooltip(e.target, e.target.title);
            });
            link.addEventListener('mouseleave', () => {
                helpers.hideCustomTooltip();
            });
        });

        // 初始化难度圈的自定义提示框
        const circles = document.querySelectorAll('#contests-view .difficulty-circle');
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
