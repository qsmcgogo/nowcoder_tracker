/**
 * 排行榜视图模块
 * 处理排行榜相关的UI和逻辑
 */

import { APP_CONFIG } from '../config.js';
import { ApiService } from '../services/ApiService.js';
import * as helpers from '../utils/helpers.js';
import { eventBus, EVENTS } from '../events/EventBus.js';

export class RankingsView {
    constructor(elements, state, apiService) {
        this.elements = elements;
        this.state = state;
        this.apiService = apiService;
        
        this.rankingsPageSize = APP_CONFIG.RANKINGS_PAGE_SIZE;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
    }
    
    bindEvents() {
        // 监听视图切换事件
        eventBus.on(EVENTS.VIEW_CHANGED, (view) => {
            if (view === 'rankings') {
                this.fetchAndRenderRankingsPage(1, this.state.activeRankingsTab);
            }
        });
        
        // 监听排行榜页签切换事件
        eventBus.on(EVENTS.RANKINGS_TAB_CHANGED, (rankType) => {
            // 切换时，立即清空旧数据和状态，防止视觉残留
            if (this.elements.rankingsTbody) {
                this.elements.rankingsTbody.innerHTML = '<tr><td colspan="4" class="loading">正在加载...</td></tr>';
            }
            this.clearSearchState();
            
            this.updateRankingsHeader(rankType);
            this.fetchAndRenderRankingsPage(1, rankType);
        });

        // 监听用户搜索事件
        eventBus.on(EVENTS.USER_SEARCH, (userId) => {
            this.handleUserStatusSearch(userId);
        });
    }

    async handleTabChange(rankType) {
        // This method is called by App.js BEFORE the search is triggered.
        // Its job is to synchronously or asynchronously prepare the view for the new tab.
        this.updateRankingsHeader(rankType);
        // We can return a resolved promise to signal completion if no async work is needed.
        return Promise.resolve();
    }
    
    // 每次获取并渲染页面时，都先清理搜索状态
    clearSearchState() {
        if (this.elements.userRankDisplay) {
            this.elements.userRankDisplay.style.display = 'none';
            this.elements.userRankDisplay.innerHTML = '';
        }
        if (this.elements.rankingsSearchInput) {
            this.elements.rankingsSearchInput.value = '';
        }
        this.state.lastSearchedUid = null;
    }
    
    async fetchAndRenderRankingsPage(page, rankType, userIdToHighlight = null, isPreload = false) {
        if (this.state.isLoading.rankings && !isPreload) return;
        
        // 如果不是在特定用户搜索的上下文中调用，则清除旧的搜索状态
        if (!userIdToHighlight) {
            this.clearSearchState();
        }

        this.state.setLoadingState('rankings', true);
        this.state.rankingsCurrentPage = page;
        eventBus.emit(EVENTS.DATA_LOADING, { module: 'rankings' });
        
        try {
            // const rankType = this.state.activeRankingsTab; // OLD: Using potentially stale state
            // This fetch is always for a specific page list, NOT for a specific user
            const data = rankType === 'problem'
                ? await this.apiService.fetchRankingsPage(rankType, page, this.rankingsPageSize)
                : await this.apiService.fetchCheckinRankings(page, this.rankingsPageSize);

            if (data && data.ranks) {
                this.state.rankingsTotalUsers = data.totalCount;
                this.elements.rankingsTbody.innerHTML = '';

                data.ranks.forEach(user => {
                    this.elements.rankingsTbody.innerHTML += this.generateRankingRowHtml(user);
                });
                
                this.renderRankingsPagination();
                
                const userExistsInList = userIdToHighlight ? data.ranks.some(r => r.uid == userIdToHighlight) : false;
                
                if (userIdToHighlight) {
                    if (userExistsInList) {
                         this.elements.userRankDisplay.style.display = 'none';
                         this.highlightSearchedUser();
                    } else {
                        // This can happen if the user is unranked (place > 1w) but we landed on a page.
                        // We will fetch their specific data and append it.
                        const userRankDataResponse = rankType === 'problem'
                            ? await this.apiService.fetchUserData(userIdToHighlight)
                            : await this.apiService.fetchCheckinRankings(1, 1, userIdToHighlight);
                        if(userRankDataResponse && userRankDataResponse.ranks && userRankDataResponse.ranks.length > 0) {
                            this.appendUserToRankings(userRankDataResponse.ranks[0]);
                            this.elements.userRankDisplay.style.display = 'none';
                            this.highlightSearchedUser();
                        } else {
                            this.showRankSearchError('用户未找到');
                        }
                    }
                }

            } else {
                this.elements.rankingsTbody.innerHTML = '<tr><td colspan="4" class="no-data">暂无排行数据</td></tr>';
            }
        } catch (error) {
            console.error(`Error fetching rankings (page ${page}):`, error);
            this.elements.rankingsTbody.innerHTML = `<tr><td colspan="4" class="error">排行榜加载失败</td></tr>`;
        } finally {
            this.state.setLoadingState('rankings', false);
            eventBus.emit(EVENTS.DATA_LOADED, { module: 'rankings' });
        }
    }
    
    renderRankings(users) {
        if (!this.elements.rankingsTbody) return;
        
        if (users.length === 0) {
            this.elements.rankingsTbody.innerHTML = `<tr><td colspan="4">暂无排行榜数据</td></tr>`;
            return;
        }
        
        const rowsHtml = users.map((user, index) => {
            const actualRank = (this.state.rankingsCurrentPage - 1) * this.rankingsPageSize + index + 1;
            return this.generateRankingRowHtml(user, actualRank);
        }).join('');
        
        this.elements.rankingsTbody.innerHTML = rowsHtml;
    }
    
    generateRankingRowHtml(user, actualRank = null) {
        const avatarUrl = user.headUrl && user.headUrl.startsWith('http')
            ? user.headUrl
            : `${APP_CONFIG.NOWCODER_UI_BASE}${user.headUrl || ''}`;
        const profileUrl = helpers.buildUrlWithChannelPut(`/users/${user.uid}`, this.state.channelPut);
        
        // Use actualRank if provided, otherwise fall back to user.place
        let displayRank;
        if (actualRank !== null) {
            displayRank = actualRank;
        } else {
            displayRank = user.place === 0 ? '1w+' : user.place;
        }
        const highlightClass = user.uid === this.state.lastSearchedUid ? 'highlight-row' : '';
        
        // 根据排行榜类型显示不同的数据
        const rankType = this.state.activeRankingsTab;
        const count = user.count || 0;
        // 兼容 continueday/continueDay/continueDays
        let consecutiveDays = Number(user.continueday ?? user.continueDay ?? user.continueDays ?? 0) || 0;
        // 清零逻辑只在后端显式提供“今天/昨天”状态时才启用，避免列表页无该字段时被误清零
        const hasToday = ('todayClockRank' in user) || ('todayClockCount' in user) || ('todayChecked' in user) || ('todayClocked' in user);
        const hasYest = ('yesterdayClockCount' in user) || ('yesterdayChecked' in user) || ('yesterdayClocked' in user);
        if (hasToday && hasYest) {
            const todayVal = Number(user.todayClockRank ?? user.todayClockCount ?? user.todayChecked ?? user.todayClocked ?? 0);
            const yestVal = Number(user.yesterdayClockCount ?? user.yesterdayChecked ?? user.yesterdayClocked ?? 0);
            if (todayVal === 0 && yestVal === 0) {
                consecutiveDays = 0;
            }
        }

        // 根据排行榜类型生成数据列
        let statsHtml;
        if (rankType === 'checkin') {
            statsHtml = `<td>${count}</td><td>${consecutiveDays}</td>`;
        } else {
            // 对于过题榜，让“过题数”一栏横跨两列以匹配表头结构
            statsHtml = `<td colspan="2">${count}</td>`;
        }

        return `
            <tr class="${highlightClass}" data-uid="${user.uid}" data-rank="${displayRank}">
                <td>${displayRank}</td>
                <td class="user-cell">
                    <a href="${profileUrl}" target="_blank" rel="noopener noreferrer">
                        <img src="${avatarUrl}" alt="${user.name}'s avatar" class="user-avatar">
                    </a>
                    <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="user-nickname-link">
                        <span class="user-nickname">${user.name}</span>
                    </a>
                </td>
                ${statsHtml}
            </tr>
        `;
    }
    
    appendUserToRankings(user) {
        if (!this.elements.rankingsTbody) return;
        
        // For appended users, use their actual place from the API
        const actualRank = user.place === 0 ? '1w+' : user.place;
        const userRow = this.generateRankingRowHtml(user, actualRank);
        this.elements.rankingsTbody.insertAdjacentHTML('beforeend', userRow);
    }
    
    updateRankingsHeader(rankType) {
        const acHeader = document.querySelector('#rankings-table .ac-header');
        const consecutiveHeader = document.querySelector('#rankings-table .consecutive-days-header');

        if (acHeader) {
            acHeader.textContent = rankType === 'problem' ? '过题数' : '累计打卡';
        }
        if (consecutiveHeader) {
            consecutiveHeader.style.display = rankType === 'checkin' ? '' : 'none';
        }
    }

    renderRankingsPagination() {
        const container = document.getElementById('rankings-pagination');
        const info = document.getElementById('rankingsPaginationInfo');
        
        if (!container || !info) return;
        
        const totalPages = Math.ceil(this.state.rankingsTotalUsers / this.rankingsPageSize) || 1;
        const startItem = (this.state.rankingsCurrentPage - 1) * this.rankingsPageSize + 1;
        const endItem = Math.min(this.state.rankingsCurrentPage * this.rankingsPageSize, this.state.rankingsTotalUsers);
        
        info.textContent = this.state.rankingsTotalUsers > 0 ? 
            `显示 ${startItem}-${endItem} 共 ${this.state.rankingsTotalUsers} 条记录` : 
            '共 0 条记录';
        
        const prevBtn = container.querySelector('.pagination-btn:first-of-type');
        const nextBtn = container.querySelector('.pagination-btn:last-of-type');
        const pageNumbers = container.querySelector('.page-numbers');
        
        if (!prevBtn || !nextBtn || !pageNumbers) return;
        
        prevBtn.disabled = this.state.rankingsCurrentPage === 1;
        nextBtn.disabled = this.state.rankingsCurrentPage === totalPages;
        
        pageNumbers.innerHTML = '';
        
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.state.rankingsCurrentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        if (startPage > 1) {
            const firstPage = helpers.createPageLink(1, (page) => this.handleRankingsPageChange(page));
            pageNumbers.appendChild(firstPage);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageLink = helpers.createPageLink(i, (page) => this.handleRankingsPageChange(page), i === this.state.rankingsCurrentPage);
            pageNumbers.appendChild(pageLink);
        }
        
        if (endPage < totalPages) {
            const lastPage = helpers.createPageLink(totalPages, (page) => this.handleRankingsPageChange(page));
            pageNumbers.appendChild(lastPage);
        }
        
        // 更新上一页/下一页按钮处理器
        if (prevBtn) {
            prevBtn.onclick = () => {
                if (this.state.rankingsCurrentPage > 1) {
                    this.handleRankingsPageChange(this.state.rankingsCurrentPage - 1);
                }
            };
        }
        
        if (nextBtn) {
            nextBtn.onclick = () => {
                if (this.state.rankingsCurrentPage < totalPages) {
                    this.handleRankingsPageChange(this.state.rankingsCurrentPage + 1);
                }
            };
        }
    }
    
    async handleRankingsPageChange(page) {
        this.state.rankingsCurrentPage = page;
        await this.fetchAndRenderRankingsPage(page, this.state.activeRankingsTab);
    }
    
    async handleUserStatusSearch(userId) {
        const trimmedUserId = typeof userId === 'string' ? userId.trim() : String(userId);
        if (!trimmedUserId) {
            this.fetchAndRenderRankingsPage(1, this.state.activeRankingsTab); // No user, just load page 1
            return;
        }

        this.elements.userRankDisplay.innerHTML = `正在查询用户 ID: ${trimmedUserId} ...`;
        this.elements.userRankDisplay.style.display = 'block';
        this.state.lastSearchedUid = trimmedUserId;

        try {
            // Step 1: "Ask for directions" - get the user's specific rank data first
            const rankType = this.state.activeRankingsTab;
            const userRankDataResponse = rankType === 'problem'
                ? await this.apiService.fetchUserData(trimmedUserId)
                // For check-in, the API should also support fetching a single user by userId
                : await this.apiService.fetchCheckinRankings(1, 1, trimmedUserId); 
            
            if (userRankDataResponse && userRankDataResponse.ranks && userRankDataResponse.ranks.length > 0) {
                const userData = userRankDataResponse.ranks[0];
                const place = userData.place;

                if (place > 0) {
                    // Step 2: "Fetch the cargo" - calculate the correct page and fetch it
                    const targetPage = Math.ceil(place / this.rankingsPageSize);
                    await this.fetchAndRenderRankingsPage(targetPage, rankType, trimmedUserId);
                } else {
                    // User has 0 count or is unranked, just show them on the last page
                    const totalUsers = userRankDataResponse.totalCount || this.state.rankingsTotalUsers || 1;
                    const lastPage = Math.ceil(totalUsers / this.rankingsPageSize) || 1;
                    await this.fetchAndRenderRankingsPage(lastPage, rankType, trimmedUserId);
                }
            } else {
                this.showRankSearchError('用户未找到');
                // 当用户搜索不到时，同样需要清空表格
                if (this.elements.rankingsTbody) {
                    this.elements.rankingsTbody.innerHTML = '<tr><td colspan="4" class="no-data">暂无排行数据</td></tr>';
                }
                this.state.rankingsTotalUsers = 0;
                this.renderRankingsPagination(); // 重置分页
            }
        } catch (error) {
            console.error('Error in handleUserStatusSearch:', error);
            this.showRankSearchError('查询用户排名失败');
        }
    }
    
    highlightSearchedUser() {
        if (!this.state.lastSearchedUid) return;
        
        setTimeout(() => {
            const highlighted = this.elements.rankingsTbody.querySelector('.highlight-row');
            if (highlighted) {
                highlighted.classList.remove('highlight-row');
            }
            
            const userRow = this.elements.rankingsTbody.querySelector(`tr[data-uid="${this.state.lastSearchedUid}"]`);
            if (userRow) {
                userRow.classList.add('highlight-row');
                userRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }
    
    showRankSearchError(message) {
        this.elements.userRankDisplay.innerHTML = message;
        this.elements.userRankDisplay.style.display = 'block';
    }
    
    renderRankingsError(message) {
        if (this.elements.rankingsTbody) {
            this.elements.rankingsTbody.innerHTML = `<tr><td colspan="4" class="error">${message}</td></tr>`;
        }
    }
}
