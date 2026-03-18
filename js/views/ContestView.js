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
        
        // 监听课程分类切换事件
        eventBus.on(EVENTS.COURSE_CATEGORY_CHANGED, (category) => {
            this.fetchAndRenderCourseContests();
        });
        
        // 监听视图切换事件
        eventBus.on(EVENTS.VIEW_CHANGED, (view) => {
            if (view === 'contests') {
                this.fetchAndRenderContests();
            } else if (view === 'course') {
                this.fetchAndRenderCourseContests();
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
            // 如果是杯赛（25），需要传递category参数
            let category = null;
            if (this.state.activeContestTab === '25' && this.state.activeBeisaiCategory) {
                category = this.state.activeBeisaiCategory;
            }
            
            const data = await this.apiService.fetchContests(
                this.state.activeContestTab,
                this.state.contestsCurrentPage,
                this.contestsPageSize,
                category
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
        
        return contests.map(contest => {
            const cid = (contest.contestId != null ? contest.contestId : contest.id);
            const needCharge = contest.needCharge === true;
            const purchased = contest.purchased === true;
            const canAccess = contest.canAccess != null ? contest.canAccess === true : (!needCharge || purchased);
            return ({
            // 兼容后端字段：有的接口返回 contestId/contestName/contestUrl，有的返回 id/contestName/contestUrl 或 id/name/url
            id: cid,
            name: (contest.contestName != null ? contest.contestName : (contest.name != null ? contest.name : '')),
            url: (contest.contestUrl != null ? contest.contestUrl : (contest.url != null ? contest.url : '')),
            needCharge,
            purchased,
            canAccess,
            problems: (contest.questions || contest.problems || []).map(p => {
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
                // question level canAccess（后端会补齐）；若缺省则沿用比赛级
                const pCanAccess = (p.canAccess != null) ? (p.canAccess === true) : canAccess;
                return { ...p, contestId: cid, needCharge, purchased, canAccess: pCanAccess, difficultyScore: score };
            })
        });
        });
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
                    <td>
                        ${contest.needCharge && !contest.canAccess
                            ? `<span class="contest-link contest-locked js-paywall-buy"
                                    data-contest-id="${this.escapeHtml(String(contest.id))}"
                                    data-buy-url="${this.escapeHtml(this.buildBuyUrl(contest.id))}"
                                    title="需购买后访问"
                                    style="color:#9ca3af; cursor:pointer; font-weight:700;">
                                    ${this.escapeHtml(contest.name)} 🔒
                               </span>`
                            : `<a href="${contestUrl}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(contest.name)}</a>`}
                    </td>
                    ${problemsHtml}
                </tr>
            `;
        }).join('');
        
        this.elements.contestTbody.innerHTML = rowsHtml;
        this.initTooltips();
        this.bindPaywallHandlers();
    }
    
    buildBuyUrl(contestId) {
        const cid = String(contestId || '').trim();
        return `https://www.nowcoder.com/order?itemType=ACM_CONTEST_CHARGE&itemId=${encodeURIComponent(cid)}`;
    }

    escapeHtml(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    bindPaywallHandlers() {
        // 题目/比赛入口的“需购买”交互：点击引导到购买页
        const els = document.querySelectorAll('#contests-view .js-paywall-buy, #course-view .js-paywall-buy');
        els.forEach(el => {
            if (el.dataset._bound === '1') return;
            el.dataset._bound = '1';
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const buyUrl = el.getAttribute('data-buy-url') || '';
                const msg = this.state.loggedInUserId
                    ? '该题/比赛为付费内容，购买后可访问。现在去购买？'
                    : '该题/比赛为付费内容，登录后可查看是否已购买并购买。现在去登录/购买？';
                const ok = window.confirm(msg);
                if (!ok) return;
                if (buyUrl) window.open(buyUrl, '_blank', 'noopener,noreferrer');
            });
        });
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
        const isLocked = (problem.needCharge === true) && (problem.canAccess === false);
        const buyUrl = isLocked ? this.buildBuyUrl(problem.contestId) : '';
        
        if (isXCPC) {
            // For XCPC: only show difficulty circle and clickable letter, no title
            if (finalUrl && !isLocked) {
                titleHtml = `<a class="problem-link" href="${finalUrl}" target="_blank" rel="noopener noreferrer" title="${problem.title || 'N/A'}">${letter || ''}</a>`;
            } else if (isLocked) {
                titleHtml = `<span class="problem-link problem-locked js-paywall-buy"
                                data-contest-id="${this.escapeHtml(String(problem.contestId))}"
                                data-buy-url="${this.escapeHtml(buyUrl)}"
                                title="需购买后访问"
                                style="color:#9ca3af; cursor:pointer; font-weight:800;">
                                ${letter || ''} 🔒
                             </span>`;
            } else {
                titleHtml = `<span title="${problem.title || 'N/A'}">${letter || ''}</span>`;
            }
        } else {
            // For other tabs: show normal title with ellipsis
            const truncatedTitle = problem.title && problem.title.length > 20 ? 
                problem.title.substring(0, 20) + '...' : 
                (problem.title || 'N/A');
            
            if (finalUrl && !isLocked) {
                const letterPrefix = letter ? `${letter}. ` : '';
                titleHtml = `<a class="problem-link" href="${finalUrl}" target="_blank" rel="noopener noreferrer" title="${problem.title}">${letterPrefix}${truncatedTitle}</a>`;
            } else if (isLocked) {
                const letterPrefix = letter ? `${letter}. ` : '';
                titleHtml = `<span class="problem-link problem-locked js-paywall-buy"
                                data-contest-id="${this.escapeHtml(String(problem.contestId))}"
                                data-buy-url="${this.escapeHtml(buyUrl)}"
                                title="需购买后访问"
                                style="color:#9ca3af; cursor:pointer; font-weight:700;">
                                ${this.escapeHtml(letterPrefix)}${this.escapeHtml(truncatedTitle)} 🔒
                             </span>`;
            } else {
                const letterPrefix = letter ? `${letter}. ` : '';
                titleHtml = `<span title="${problem.title || 'N/A'}">${this.escapeHtml(letterPrefix)}${this.escapeHtml(truncatedTitle)}</span>`;
            }
        }
        
        return `
            <div class="problem-cell-content" style="${isLocked ? 'opacity:0.65;' : ''}">
                ${difficultyCircleHtml}
                ${titleHtml}
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
        // 初始化题目标题的原生title提示（支持竞赛视图和课程视图）
        const problemLinks = document.querySelectorAll('#contests-view .problem-link, #course-view .problem-link');
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

        // 初始化难度圈的自定义提示框（支持竞赛视图和课程视图）
        const circles = document.querySelectorAll('#contests-view .difficulty-circle, #course-view .difficulty-circle');
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
    
    // 获取课程比赛并渲染
    async fetchAndRenderCourseContests() {
        const courseTbody = document.getElementById('course-tbody');
        if (!courseTbody) return;
        
        // 显示/隐藏教程卡片
        this.renderCourseTutorial();
        
        courseTbody.innerHTML = `<tr><td colspan="8" class="loading">正在加载课程比赛数据...</td></tr>`;
        
        this.state.setLoadingState('course', true);
        eventBus.emit(EVENTS.DATA_LOADING, { module: 'course' });
        
        try {
            const category = this.state.activeCourseCategory || '';
            const data = await this.apiService.fetchContests('23', this.state.courseCurrentPage, this.contestsPageSize, category);
            
            if (data && data.contests) {
                const transformed = this.transformApiData(data.contests);
                this.state.courseContests = transformed;
                this.state.totalCourseContests = data.totalCount;
                this.renderCourseContests();
                this.renderCoursePagination();
            } else {
                this.renderCourseError('没有找到课程比赛数据');
            }
            
            eventBus.emit(EVENTS.DATA_LOADED, { module: 'course', data });
            
            // 自动查询用户状态
            if (this.elements.userIdInput && this.elements.userIdInput.value) {
                setTimeout(() => {
                    this.handleCourseUserStatusSearch(this.elements.userIdInput.value);
                }, 100);
            } else if (this.state.loggedInUserId) {
                if (this.elements.userIdInput) {
                    this.elements.userIdInput.value = this.state.loggedInUserId;
                }
                setTimeout(() => {
                    this.handleCourseUserStatusSearch(this.state.loggedInUserId);
                }, 100);
            }
        } catch (error) {
            console.error('Error fetching course contests:', error);
            this.renderCourseError('加载课程比赛数据失败');
            eventBus.emit(EVENTS.DATA_ERROR, { module: 'course', error });
        } finally {
            this.state.setLoadingState('course', false);
        }
    }
    
    // 渲染课程教程卡片
    renderCourseTutorial() {
        const tutorialSection = document.getElementById('course-tutorial-section');
        if (!tutorialSection) return;
        
        const category = this.state.activeCourseCategory || '';
        const courseLink = APP_CONFIG.COURSE_LINKS[category];
        
        if (courseLink) {
            // 显示教程卡片
            tutorialSection.style.display = 'block';
            
            // 更新内容
            const titleEl = document.getElementById('course-tutorial-title');
            const descEl = document.getElementById('course-tutorial-desc');
            const linkEl = document.getElementById('course-tutorial-link');
            
            if (titleEl) titleEl.textContent = `${courseLink.name}视频讲解`;
            if (descEl) descEl.textContent = courseLink.description;
            if (linkEl) {
                linkEl.href = courseLink.url;
                linkEl.textContent = '🎬 观看视频讲解';
            }
        } else {
            // 隐藏教程卡片（全部课程或其他未配置的类别）
            tutorialSection.style.display = 'none';
        }
    }
    
    // 渲染课程比赛列表（类似newbie130的展示方式：每行最多5个题目，满5个换行）
    renderCourseContests() {
        const courseTbody = document.getElementById('course-tbody');
        if (!courseTbody) return;
        
        if (this.state.courseContests.length === 0) {
            courseTbody.innerHTML = `<tr><td colspan="6">暂无课程比赛数据</td></tr>`;
            return;
        }
        
        let finalHtml = '';
        
        // 遍历每个比赛
        for (const contest of this.state.courseContests) {
            const cp = this.state.channelPut ? (this.state.channelPut + 'a') : undefined;
            const contestUrl = helpers.buildUrlWithChannelPut(contest.url, cp);
            const problems = contest.problems || [];
            const contestIdAttr = String(contest.id != null ? contest.id : '');
            
            if (problems.length === 0) {
                // 如果没有题目，只显示比赛名称
                finalHtml += `<tr><td class="knowledge-point-cell">${contest.name}</td><td colspan="5"></td></tr>`;
                continue;
            }
            
            // 每行最多5个题目，满5个换行
            let problemsInCurrentRow = 0;
            let isFirstRow = true;
            
            for (let i = 0; i < problems.length; i++) {
                const problem = problems[i];
                
                // 如果是每行的第一个题目，需要显示比赛名称
                if (problemsInCurrentRow === 0) {
                    if (!isFirstRow) {
                        // 不是第一行，比赛名称列显示为空（续行）
                        finalHtml += '<tr>';
                        finalHtml += `<td class="knowledge-point-cell"></td>`;
                    } else {
                        // 第一行，显示比赛名称
                        finalHtml += '<tr>';
                        finalHtml += `<td class="knowledge-point-cell course-contest-cell" data-contest-id="${contestIdAttr}">
                            ${contest.needCharge && !contest.canAccess
                                ? `<span class="contest-link contest-locked js-paywall-buy"
                                        data-contest-id="${this.escapeHtml(String(contest.id))}"
                                        data-buy-url="${this.escapeHtml(this.buildBuyUrl(contest.id))}"
                                        title="需购买后访问"
                                        style="color:#9ca3af; cursor:pointer; font-weight:700;">
                                        ${this.escapeHtml(contest.name)} 🔒
                                   </span>`
                                : `<a href="${contestUrl}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(contest.name)}</a>`}
                        </td>`;
                        isFirstRow = false;
                    }
                }
                
                // 添加题目单元格
                // 只给“正常题目”（有效 problemId）挂 data-problem-id，避免 undefined/0 参与全AC/AK判断
                if (helpers.isValidProblemId(problem.problemId)) {
                    finalHtml += `<td data-problem-id="${problem.problemId}" data-contest-id="${contestIdAttr}">${this.renderCourseProblemHTML(problem)}</td>`;
                } else {
                    finalHtml += `<td data-contest-id="${contestIdAttr}">${this.renderCourseProblemHTML(problem)}</td>`;
                }
                problemsInCurrentRow++;
                
                // 如果当前行已满5个题目，或者这是最后一个题目，需要换行
                if (problemsInCurrentRow === 5 || i === problems.length - 1) {
                    // 如果当前行不满5个，填充空单元格
                    if (problemsInCurrentRow < 5 && i === problems.length - 1) {
                        const remaining = 5 - problemsInCurrentRow;
                        finalHtml += `<td></td>`.repeat(remaining);
                    }
                    finalHtml += '</tr>';
                    problemsInCurrentRow = 0;
                }
            }
        }
        
        courseTbody.innerHTML = finalHtml || `<tr><td colspan="6">暂无课程比赛数据</td></tr>`;
        this.initTooltips();
        this.bindPaywallHandlers();
    }
    
    // 渲染课程题目HTML（不显示题号）
    renderCourseProblemHTML(problem) {
        let difficultyCircleHtml = '';

        // Only render the circle if there is a valid difficulty score.
        if (problem.difficultyScore) {
            const difficultyInfo = helpers.getDifficultyInfo(problem.difficultyScore);
            const circleStyle = helpers.getCircleStyle(difficultyInfo);
            const tooltipContent = helpers.generateTooltipContent(problem).replace(/"/g, '&quot;');
            difficultyCircleHtml = `<span class="difficulty-circle" style="${circleStyle}" data-tooltip="${tooltipContent}"></span>`;
        }
        
        // 若入口URL带 channelPut，则竞赛加后缀"1"，否则回落到历史默认（helpers 内部默认）
        const cp = this.state.channelPut ? (this.state.channelPut + '1') : undefined;
        let finalUrl = helpers.buildUrlWithChannelPut(problem.url || problem.questionUrl, cp);
        const isLocked = (problem.needCharge === true) && (problem.canAccess === false);
        const buyUrl = isLocked ? this.buildBuyUrl(problem.contestId) : '';
        
        // 题目名字省略处理
        const truncatedTitle = problem.title && problem.title.length > 20 ? 
            problem.title.substring(0, 20) + '...' : 
            (problem.title || 'N/A');
        
        let titleHtml;
        if (finalUrl && !isLocked) {
            titleHtml = `<a class="problem-link" href="${finalUrl}" target="_blank" rel="noopener noreferrer" title="${problem.title}">${truncatedTitle}</a>`;
        } else if (isLocked) {
            titleHtml = `<span class="problem-link problem-locked js-paywall-buy"
                            data-contest-id="${this.escapeHtml(String(problem.contestId))}"
                            data-buy-url="${this.escapeHtml(buyUrl)}"
                            title="需购买后访问"
                            style="color:#9ca3af; cursor:pointer; font-weight:700;">
                            ${this.escapeHtml(truncatedTitle)} 🔒
                         </span>`;
        } else {
            titleHtml = `<span title="${problem.title || 'N/A'}">${truncatedTitle}</span>`;
        }

        return `
            <div class="problem-cell-content" style="${isLocked ? 'opacity:0.65;' : ''}">
                ${difficultyCircleHtml}
                ${titleHtml}
            </div>
        `;
    }
    
    // 渲染课程分页
    renderCoursePagination() {
        const totalPages = Math.ceil(this.state.totalCourseContests / this.contestsPageSize);
        const currentPage = this.state.courseCurrentPage;
        
        // 更新分页信息
        const paginationInfo = document.getElementById('coursePaginationInfo');
        if (paginationInfo) {
            const start = (currentPage - 1) * this.contestsPageSize + 1;
            const end = Math.min(currentPage * this.contestsPageSize, this.state.totalCourseContests);
            paginationInfo.textContent = `共 ${this.state.totalCourseContests} 个比赛，显示第 ${start}-${end} 个`;
        }
        
        // 更新分页按钮
        const prevBtn = document.getElementById('coursePrevPage');
        const nextBtn = document.getElementById('courseNextPage');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
        
        // 更新页码显示
        const pageNumbers = document.getElementById('coursePageNumbers');
        if (pageNumbers) {
            const maxVisiblePages = 10;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            if (endPage - startPage < maxVisiblePages - 1) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
            
            let pageHtml = '';
            for (let i = startPage; i <= endPage; i++) {
                pageHtml += `<button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            pageNumbers.innerHTML = pageHtml;
            
            // 绑定页码点击事件
            pageNumbers.querySelectorAll('.page-number').forEach(btn => {
                btn.addEventListener('click', () => {
                    const page = parseInt(btn.dataset.page);
                    this.state.courseCurrentPage = page;
                    this.fetchAndRenderCourseContests();
                });
            });
        }
        
        // 绑定上一页/下一页按钮
        if (prevBtn) {
            prevBtn.onclick = () => {
                if (currentPage > 1) {
                    this.state.courseCurrentPage = currentPage - 1;
                    this.fetchAndRenderCourseContests();
                }
            };
        }
        if (nextBtn) {
            nextBtn.onclick = () => {
                if (currentPage < totalPages) {
                    this.state.courseCurrentPage = currentPage + 1;
                    this.fetchAndRenderCourseContests();
                }
            };
        }
    }
    
    // 渲染课程错误信息
    renderCourseError(message) {
        const courseTbody = document.getElementById('course-tbody');
        if (courseTbody) {
            courseTbody.innerHTML = `<tr><td colspan="8" class="error">${message}</td></tr>`;
        }
    }
    
    // 处理课程用户状态查询
    async handleCourseUserStatusSearch(userId) {
        if (!userId) return;
        
        try {
            const dbgEnabled = (typeof window !== 'undefined') && !!window.__TRACKER_DEBUG_COURSE_AK__;
            const dbg = (...args) => { if (dbgEnabled) console.log('[course-ak][ContestView]', ...args); };

            const qids = this.getCourseViewProblemIds();
            dbg('handleCourseUserStatusSearch: qids', qids ? `len=${qids.split(',').length}` : 'null');
            if (!qids) return;
            
            const diffData = await this.apiService.fetchUserProblemDiff(userId, qids, null);
            dbg('diffData', { ac1: diffData?.ac1Qids?.length || 0, ac2: diffData?.ac2Qids?.length || 0 });
            this.applyCourseProblemHighlighting(diffData, false);
        } catch (error) {
            console.error('Error in course user search:', error);
        }
    }
    
    // 获取课程视图中的题目ID
    getCourseViewProblemIds() {
        const dbgEnabled = (typeof window !== 'undefined') && !!window.__TRACKER_DEBUG_COURSE_AK__;
        const dbg = (...args) => { if (dbgEnabled) console.log('[course-ak][ContestView]', ...args); };

        const ids = Array.from(document.querySelectorAll('#course-view td[data-problem-id]'))
            .map(el => el.getAttribute('data-problem-id'))
            .filter(pid => helpers.isValidProblemId(pid))
            .map(String);
        dbg('getCourseViewProblemIds: collected', { totalCells: document.querySelectorAll('#course-view td[data-problem-id]').length, validIds: ids.length });
        return ids.length ? ids.join(',') : null;
    }
    
    // 应用课程题目高亮显示
    applyCourseProblemHighlighting(data, hasRival) {
        const dbgEnabled = (typeof window !== 'undefined') && !!window.__TRACKER_DEBUG_COURSE_AK__;
        const dbg = (...args) => { if (dbgEnabled) console.log('[course-ak][ContestView]', ...args); };

        const { ac1Qids = [], ac2Qids = [] } = data || {};
        const ac1Set = new Set(ac1Qids.map(String));
        const ac2Set = new Set(ac2Qids.map(String));

        const allProblemCells = document.querySelectorAll('#course-view td[data-problem-id]');
        const allContestTitleCells = document.querySelectorAll('#course-view td.course-contest-cell[data-contest-id]');
        dbg('applyCourseProblemHighlighting: dom counts', { problemCells: allProblemCells.length, titleCells: allContestTitleCells.length });
        
        allProblemCells.forEach(cell => {
            cell.classList.remove('status-ac', 'status-rival-ac', 'status-none', 'status-all-ac');
        });
        allContestTitleCells.forEach(cell => {
            cell.classList.remove('status-all-ac');
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

        // 课程视图：按比赛维度（跨行）“正常题目全AC”=> 视为 AK，比赛名变绿
        const courseProblems = document.querySelectorAll('#course-view td[data-problem-id][data-contest-id]');
        dbg('applyCourseProblemHighlighting: courseProblems', courseProblems.length);
        if (courseProblems.length) {
            const cidToPids = new Map();
            courseProblems.forEach(cell => {
                const cid = cell.getAttribute('data-contest-id') || '';
                const pid = cell.getAttribute('data-problem-id');
                if (!cid) return;
                if (!helpers.isValidProblemId(pid)) return;
                if (!cidToPids.has(cid)) cidToPids.set(cid, []);
                cidToPids.get(cid).push(String(pid));
            });
            dbg('applyCourseProblemHighlighting: contests aggregated', { contests: cidToPids.size });
            cidToPids.forEach((pids, cid) => {
                // “正常题目”口径：有效 problemId；全部在 ac1Set 则标绿
                const allAc = pids.length > 0 && pids.every(pid => ac1Set.has(pid));
                const titleCell = document.querySelector(`#course-view td.course-contest-cell[data-contest-id="${String(cid).replace(/"/g, '\\"')}"]`);
                if (dbgEnabled) dbg('contest check', { cid, pidsCnt: pids.length, allAc, titleCellFound: !!titleCell });
                if (!titleCell) return;
                if (allAc) titleCell.classList.add('status-all-ac');
                else titleCell.classList.remove('status-all-ac');
            });
        } else {
            dbg('applyCourseProblemHighlighting: no courseProblems found (selector td[data-problem-id][data-contest-id])');
        }
    }
}
