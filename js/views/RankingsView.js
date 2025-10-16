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
        this.preloadRankingsData();
    }
    
    bindEvents() {
        // 监听视图切换事件
        eventBus.on(EVENTS.VIEW_CHANGED, (view) => {
            if (view === 'rankings') {
                this.fetchAndRenderRankingsPage(1);
            }
        });
        
        // 监听用户搜索事件
        eventBus.on(EVENTS.USER_SEARCH, (userId) => {
            this.handleUserStatusSearch(userId);
        });
    }
    
    preloadRankingsData() {
        // 预加载第一页排行榜数据
        this.fetchAndRenderRankingsPage(1, null, true);
    }
    
    async fetchAndRenderRankingsPage(page, userToAppend = null, isPreload = false) {
        if (this.state.isLoading.rankings && !isPreload) return;
        
        if (!isPreload) {
            this.elements.rankingsTbody.innerHTML = `<tr><td colspan="3" class="loading">正在加载排行榜...</td></tr>`;
        }
        
        this.state.setLoadingState('rankings', true);
        this.state.rankingsCurrentPage = page; // Set current page in state
        eventBus.emit(EVENTS.DATA_LOADING, { module: 'rankings' });
        
        try {
            const data = await this.apiService.fetchRankingsPage(page, this.rankingsPageSize);
            
            if (data && data.ranks) {
                this.state.rankingsTotalUsers = data.totalCount;
                
                this.renderRankings(data.ranks); // Always render the fetched page
                
                if (userToAppend) {
                    // If a user needs to be appended (e.g., >1w+ rank), add them to the end
                    this.appendUserToRankings(userToAppend);
                }
                
                this.highlightSearchedUser();
                this.renderRankingsPagination();
            } else {
                this.renderRankingsError('没有找到排行榜数据');
            }
            
            eventBus.emit(EVENTS.DATA_LOADED, { module: 'rankings', data });
        } catch (error) {
            console.error('Error fetching rankings:', error);
            this.renderRankingsError('加载排行榜失败');
            eventBus.emit(EVENTS.DATA_ERROR, { module: 'rankings', error });
        } finally {
            this.state.setLoadingState('rankings', false);
        }
    }
    
    renderRankings(users) {
        if (!this.elements.rankingsTbody) return;
        
        if (users.length === 0) {
            this.elements.rankingsTbody.innerHTML = `<tr><td colspan="3">暂无排行榜数据</td></tr>`;
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
                <td>${user.count || 0}</td>
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
        await this.fetchAndRenderRankingsPage(page);
    }
    
    async handleUserStatusSearch(userId) {
        if (!userId || userId.trim() === '') return;
        
        this.elements.userRankDisplay.innerHTML = `正在查询用户 ID: ${userId} ...`;
        this.elements.userRankDisplay.style.display = 'block';
        this.state.lastSearchedUid = userId;
        
        try {
            const userData = await this.apiService.fetchUserData(userId);
            
            if (userData) {
                this.elements.userRankDisplay.style.display = 'none';

                let totalRankedUsers = this.state.rankingsTotalUsers;
                // 如果总用户数为0，则重新获取
                if (totalRankedUsers === 0) {
                    try {
                        const page1Data = await this.apiService.fetchRankings(1, 1);
                        if (page1Data && page1Data.totalCount) {
                            this.state.rankingsTotalUsers = page1Data.totalCount;
                            totalRankedUsers = page1Data.totalCount;
                        }
                    } catch (e) {
                        console.error("无法获取总用户数，后续分页可能不准确。", e);
                    }
                }
                
                // 计算用户应该在哪一页
                const placeStr = String(userData.place);
                const userRank = parseInt(placeStr, 10);
                
                if (/^\d+$/.test(placeStr) && !isNaN(userRank) && userRank > 0 && userRank <= totalRankedUsers) {
                    const targetPage = Math.ceil(userRank / this.rankingsPageSize);
                    await this.fetchAndRenderRankingsPage(targetPage);
                    this.highlightSearchedUser();
                } else {
                    // 用户不在排名内或排名格式特殊（如 1w+），显示在最后一页
                    const lastPage = Math.ceil(totalRankedUsers / this.rankingsPageSize) || 1;
                    await this.fetchAndRenderRankingsPage(lastPage, userData);
                }
                
                eventBus.emit(EVENTS.USER_SEARCH, { userId, userData });
            } else {
                this.showRankSearchError('用户未找到');
            }
        } catch (error) {
            console.error('Error searching user rank:', error);
            this.showRankSearchError('查询用户排名失败');
            eventBus.emit(EVENTS.DATA_ERROR, { module: 'rankings', error });
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
        
        // 清除之前的高亮
        const highlighted = this.elements.rankingsTbody.querySelector('.highlight-row');
        if (highlighted) {
            highlighted.classList.remove('highlight-row');
        }
        
        this.state.lastSearchedUid = null;
    }
    
    renderRankingsError(message) {
        if (this.elements.rankingsTbody) {
            this.elements.rankingsTbody.innerHTML = `<tr><td colspan="3" class="error">${message}</td></tr>`;
        }
    }
}
