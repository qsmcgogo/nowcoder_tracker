/**
 * 对战平台视图模块
 * 处理对战相关的UI和逻辑
 */
import { eventBus, EVENTS } from '../events/EventBus.js';

export class BattleView {
    constructor(elements, state, api) {
        this.elements = elements;
        this.state = state;
        this.api = api;
        this.container = this.elements.battleContainer;
        this.matchingTimer = null;
        this.pollingInterval = null;
        this.matchStartTime = null;
        
        // 当前视图状态
        this.currentSidebarTab = 'start'; // 'start' 开始对战, 'rankings' 对战排行榜, 'history' 对战历史
        this.battleInfo = null; // 用户对战信息
        this.recordsPage = 1;
        this.recordsLimit = 10;
        this.recordsTotal = 0;
        this.recordsList = [];
        this.selectedRecordId = null;
        this.rankingsPage = 1;
        this.rankingsLimit = 20;
        this.rankingsList = [];
        this.rankingsTotal = 0;
        
        // 房间相关
        this.roomId = null;
        this.roomMode = null; // '1v1', 'ai', 'friend'
        
        this.bindEvents();
    }

    bindEvents() {
        eventBus.on(EVENTS.MAIN_TAB_CHANGED, (tab) => {
            if (tab === 'battle') {
                this.render();
            }
        });
    }

    async render() {
        if (!this.container) return;
        
        // 检查登录状态
        if (!this.state.isLoggedIn()) {
            this.container.innerHTML = `
                <div class="battle-placeholder" style="padding: 40px; text-align: center;">
                    <div style="font-size: 24px; color: #666; margin-bottom: 20px;">
                        ⚔️ 对战平台
                    </div>
                    <div style="font-size: 16px; color: #999;">
                        请先登录以使用对战功能
                    </div>
                </div>
            `;
            return;
        }

        // 加载用户对战信息
        await this.loadBattleInfo();
        
        // 渲染主界面（侧边栏布局）
        this.renderMainView();
    }

    /**
     * 加载用户对战信息
     */
    async loadBattleInfo() {
        try {
            // 调用后端接口获取对战信息，type=2 表示1v1对战
            this.battleInfo = await this.api.battleInfo(2);
        } catch (error) {
            console.error('加载对战信息失败:', error);
            // 使用默认值
            this.battleInfo = { levelScore: 1000, winCount: 0, totalCount: 0, type: 2 };
        }
    }

    /**
     * 渲染主界面（侧边栏布局）
     */
    renderMainView() {
        this.container.innerHTML = `
            <div class="battle-layout" style="display: flex; gap: 20px;">
                <!-- 侧边栏 -->
                <aside class="battle-sidebar" style="flex: 0 0 240px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; height: fit-content;">
                    <button class="battle-sidebar-btn ${this.currentSidebarTab === 'start' ? 'active' : ''}" 
                            data-tab="start" 
                            style="width: 100%; text-align: left; background: transparent; border: none; padding: 10px 12px; border-radius: 6px; cursor: pointer; color: #333; font-weight: 600; margin-bottom: 4px;">
                        🎮 开始对战
                    </button>
                    <button class="battle-sidebar-btn ${this.currentSidebarTab === 'rankings' ? 'active' : ''}" 
                            data-tab="rankings" 
                            style="width: 100%; text-align: left; background: transparent; border: none; padding: 10px 12px; border-radius: 6px; cursor: pointer; color: #333; font-weight: 600; margin-bottom: 4px;">
                        🏆 对战排行榜
                    </button>
                    <button class="battle-sidebar-btn ${this.currentSidebarTab === 'history' ? 'active' : ''}" 
                            data-tab="history" 
                            style="width: 100%; text-align: left; background: transparent; border: none; padding: 10px 12px; border-radius: 6px; cursor: pointer; color: #333; font-weight: 600;">
                        📋 对战历史
                    </button>
                </aside>
                
                <!-- 主内容区 -->
                <section class="battle-content" style="flex: 1; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px;">
                    <div id="battle-start-view" class="battle-view-panel" style="display: ${this.currentSidebarTab === 'start' ? 'block' : 'none'};">
                        <!-- 开始对战视图 -->
                    </div>
                    <div id="battle-rankings-view" class="battle-view-panel" style="display: ${this.currentSidebarTab === 'rankings' ? 'block' : 'none'};">
                        <!-- 对战排行榜视图 -->
                    </div>
                    <div id="battle-history-view" class="battle-view-panel" style="display: ${this.currentSidebarTab === 'history' ? 'block' : 'none'};">
                        <!-- 对战历史视图 -->
                    </div>
                </section>
            </div>
        `;

        // 绑定侧边栏切换事件
        this.bindSidebarEvents();
        
        // 渲染当前选中的视图
        this.renderCurrentView();
    }

    /**
     * 绑定侧边栏切换事件
     */
    bindSidebarEvents() {
        const sidebarButtons = this.container.querySelectorAll('.battle-sidebar-btn');
        sidebarButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.currentSidebarTab = tab;
                
                // 更新按钮样式
                sidebarButtons.forEach(b => {
                    if (b === btn) {
                        b.classList.add('active');
                        b.style.background = '#eff7f3';
                        b.style.color = '#0f5132';
                        b.style.borderLeft = '3px solid #32ca99';
                    } else {
                        b.classList.remove('active');
                        b.style.background = 'transparent';
                        b.style.color = '#333';
                        b.style.borderLeft = 'none';
                    }
                });
                
                // 显示/隐藏对应视图
                const views = ['start', 'rankings', 'history'];
                views.forEach(view => {
                    const viewEl = document.getElementById(`battle-${view}-view`);
                    if (viewEl) {
                        viewEl.style.display = view === tab ? 'block' : 'none';
                    }
                });
                
                // 渲染当前视图
                this.renderCurrentView();
            });
        });
    }

    /**
     * 渲染当前选中的视图
     */
    renderCurrentView() {
        switch (this.currentSidebarTab) {
            case 'start':
                this.renderStartView();
                break;
            case 'rankings':
                this.renderRankingsView();
                break;
            case 'history':
                this.renderHistoryView();
                break;
        }
    }

    /**
     * 渲染开始对战视图
     */
    renderStartView() {
        const viewEl = document.getElementById('battle-start-view');
        if (!viewEl) return;
        
        const battleInfo = this.battleInfo || { levelScore: 1000, winCount: 0, totalCount: 0 };
        const winRate = battleInfo.totalCount > 0 
            ? ((battleInfo.winCount / battleInfo.totalCount) * 100).toFixed(1) 
            : '0.0';

        viewEl.innerHTML = `
            <div style="display: flex; gap: 20px;">
                <!-- 左侧：对战信息 -->
                <div style="flex: 1;">
                    <h2 style="font-size: 20px; color: #333; margin-bottom: 20px;">⚔️ 我的对战信息</h2>
                    
                    <!-- 个人信息卡片 -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 24px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div style="font-size: 14px; opacity: 0.9;">用户ID: ${this.state.loggedInUserId}</div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                            <div style="text-align: center;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">等级分</div>
                                <div style="font-size: 32px; font-weight: bold;">${battleInfo.levelScore}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">胜场</div>
                                <div style="font-size: 32px; font-weight: bold;">${battleInfo.winCount}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">总场次</div>
                                <div style="font-size: 32px; font-weight: bold;">${battleInfo.totalCount}</div>
                            </div>
                        </div>
                        ${battleInfo.totalCount > 0 ? `
                            <div style="text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.2);">
                                <div style="font-size: 14px; opacity: 0.9;">胜率</div>
                                <div style="font-size: 24px; font-weight: bold;">${winRate}%</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- 右侧：启动对战系统 -->
                <div style="flex: 0 0 360px;">
                    <h2 style="font-size: 20px; color: #333; margin-bottom: 20px;">🚀 启动对战</h2>
                    
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <!-- 1v1匹配 -->
                        <div class="battle-mode-card" style="background: #fff; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; transition: all 0.3s; cursor: pointer;" 
                             onmouseover="this.style.borderColor='#667eea'; this.style.boxShadow='0 4px 12px rgba(102,126,234,0.2)'"
                             onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                <div style="font-size: 32px;">⚔️</div>
                                <div>
                                    <div style="font-size: 18px; font-weight: 600; color: #333;">1v1 匹配</div>
                                    <div style="font-size: 14px; color: #666;">与实力相近的玩家对战</div>
                                </div>
                            </div>
                            <button id="battle-1v1-btn" class="battle-mode-btn" 
                                    style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s;"
                                    onmouseover="this.style.transform='scale(1.02)'"
                                    onmouseout="this.style.transform='scale(1)'">
                                开始匹配
                            </button>
                        </div>
                        
                        <!-- 人机大战 -->
                        <div class="battle-mode-card" style="background: #fff; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; transition: all 0.3s; cursor: pointer;" 
                             onmouseover="this.style.borderColor='#52c41a'; this.style.boxShadow='0 4px 12px rgba(82,196,26,0.2)'"
                             onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                <div style="font-size: 32px;">🤖</div>
                                <div>
                                    <div style="font-size: 18px; font-weight: 600; color: #333;">人机大战</div>
                                    <div style="font-size: 14px; color: #666;">与AI对手练习对战</div>
                                </div>
                            </div>
                            <button id="battle-ai-btn" class="battle-mode-btn" 
                                    style="width: 100%; background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%); color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s;"
                                    onmouseover="this.style.transform='scale(1.02)'"
                                    onmouseout="this.style.transform='scale(1)'">
                                开始对战
                            </button>
                        </div>
                        
                        <!-- 好友对战（开房间） -->
                        <div class="battle-mode-card" style="background: #fff; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; transition: all 0.3s; cursor: pointer;" 
                             onmouseover="this.style.borderColor='#faad14'; this.style.boxShadow='0 4px 12px rgba(250,173,20,0.2)'"
                             onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                <div style="font-size: 32px;">👥</div>
                                <div>
                                    <div style="font-size: 18px; font-weight: 600; color: #333;">好友对战</div>
                                    <div style="font-size: 14px; color: #666;">创建房间邀请好友</div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button id="battle-create-room-btn" class="battle-mode-btn" 
                                        style="flex: 1; background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%); color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s;"
                                        onmouseover="this.style.transform='scale(1.02)'"
                                        onmouseout="this.style.transform='scale(1)'">
                                    创建房间
                                </button>
                                <button id="battle-join-room-btn" class="battle-mode-btn" 
                                        style="flex: 1; background: #f5f5f5; color: #333; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s;"
                                        onmouseover="this.style.transform='scale(1.02)'; this.style.background='#e5e7eb'"
                                        onmouseout="this.style.transform='scale(1)'; this.style.background='#f5f5f5'">
                                    加入房间
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 绑定对战模式按钮事件
        this.bindBattleModeEvents();
    }

    /**
     * 绑定对战模式按钮事件
     */
    bindBattleModeEvents() {
        // 1v1匹配
        const btn1v1 = document.getElementById('battle-1v1-btn');
        if (btn1v1) {
            btn1v1.addEventListener('click', () => {
                this.startMatch('1v1');
            });
        }

        // 人机大战
        const btnAI = document.getElementById('battle-ai-btn');
        if (btnAI) {
            btnAI.addEventListener('click', () => {
                this.startMatch('ai');
            });
        }

        // 创建房间
        const btnCreateRoom = document.getElementById('battle-create-room-btn');
        if (btnCreateRoom) {
            btnCreateRoom.addEventListener('click', () => {
                this.createRoom();
            });
        }

        // 加入房间
        const btnJoinRoom = document.getElementById('battle-join-room-btn');
        if (btnJoinRoom) {
            btnJoinRoom.addEventListener('click', () => {
                this.showJoinRoomModal();
            });
        }
    }

    /**
     * 渲染对战排行榜视图
     */
    async renderRankingsView() {
        const viewEl = document.getElementById('battle-rankings-view');
        if (!viewEl) return;
        
        viewEl.innerHTML = `
            <h2 style="font-size: 20px; color: #333; margin-bottom: 20px;">🏆 对战排行榜</h2>
            <div id="battle-rankings-list" style="min-height: 400px;">
                <div style="padding: 40px; text-align: center; color: #999;">加载中...</div>
            </div>
            <div id="battle-rankings-pagination" class="pagination" style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
                <!-- 分页控件将在这里渲染 -->
            </div>
        `;

        await this.loadRankingsList();
    }

    /**
     * 加载对战排行榜列表
     */
    async loadRankingsList() {
        const listEl = document.getElementById('battle-rankings-list');
        if (!listEl) return;
        
        try {
            // TODO: 调用后端API获取排行榜
            // const result = await this.api.battleRankings(this.rankingsPage, this.rankingsLimit);
            
            // 模拟数据
            const mockRankings = [
                { rank: 1, userId: '919247', name: '用户1', levelScore: 2500, winCount: 150, totalCount: 200 },
                { rank: 2, userId: '999991351', name: '用户2', levelScore: 2400, winCount: 140, totalCount: 180 },
                { rank: 3, userId: '1030029998', name: '用户3', levelScore: 2300, winCount: 130, totalCount: 170 },
            ];
            
            this.rankingsList = mockRankings;
            this.rankingsTotal = mockRankings.length;
            
            this.renderRankingsList();
            this.renderRankingsPagination();
        } catch (error) {
            console.error('加载排行榜失败:', error);
            listEl.innerHTML = '<div style="padding: 40px; text-align: center; color: #f5222d;">加载失败，请稍后重试</div>';
        }
    }

    /**
     * 渲染排行榜列表
     */
    renderRankingsList() {
        const listEl = document.getElementById('battle-rankings-list');
        if (!listEl) return;
        
        if (this.rankingsList.length === 0) {
            listEl.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">暂无排行榜数据</div>';
            return;
        }
        
        listEl.innerHTML = `
            <table class="rankings-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f5f5f5; border-bottom: 2px solid #e5e7eb;">
                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #333;">排名</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #333;">用户</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600; color: #333;">等级分</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600; color: #333;">胜场</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600; color: #333;">总场次</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600; color: #333;">胜率</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.rankingsList.map(user => {
                        const winRate = user.totalCount > 0 
                            ? ((user.winCount / user.totalCount) * 100).toFixed(1) 
                            : '0.0';
                        const rankIcon = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : '';
                        return `
                            <tr style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding: 12px;">
                                    <span style="font-weight: 600; color: #333;">${rankIcon} ${user.rank}</span>
                                </td>
                                <td style="padding: 12px;">
                                    <a href="https://www.nowcoder.com/users/${user.userId}" target="_blank" style="color: #667eea; text-decoration: none;">
                                        ${user.name || `用户${user.userId}`}
                                    </a>
                                </td>
                                <td style="padding: 12px; text-align: right; font-weight: 600; color: #333;">${user.levelScore}</td>
                                <td style="padding: 12px; text-align: right; color: #666;">${user.winCount}</td>
                                <td style="padding: 12px; text-align: right; color: #666;">${user.totalCount}</td>
                                <td style="padding: 12px; text-align: right; color: #666;">${winRate}%</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * 渲染排行榜分页
     */
    renderRankingsPagination() {
        const pagination = document.getElementById('battle-rankings-pagination');
        if (!pagination) return;
        
        const totalPages = Math.ceil(this.rankingsTotal / this.rankingsLimit);
        
        if (totalPages <= 1) {
            pagination.innerHTML = `
                <div style="color: #666; font-size: 14px;">
                    共 ${this.rankingsTotal} 条记录
                </div>
            `;
            return;
        }
        
        pagination.innerHTML = `
            <div style="color: #666; font-size: 14px;">
                共 ${this.rankingsTotal} 条记录，第 ${this.rankingsPage} / ${totalPages} 页
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="battle-rankings-prev" 
                        class="pagination-btn" 
                        ${this.rankingsPage <= 1 ? 'disabled' : ''}
                        style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; ${this.rankingsPage <= 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                    上一页
                </button>
                <button id="battle-rankings-next" 
                        class="pagination-btn" 
                        ${this.rankingsPage >= totalPages ? 'disabled' : ''}
                        style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; ${this.rankingsPage >= totalPages ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                    下一页
                </button>
            </div>
        `;
        
        // 绑定分页事件
        const prevBtn = document.getElementById('battle-rankings-prev');
        const nextBtn = document.getElementById('battle-rankings-next');
        
        if (prevBtn && this.rankingsPage > 1) {
            prevBtn.addEventListener('click', () => {
                this.rankingsPage--;
                this.loadRankingsList();
            });
        }
        
        if (nextBtn && this.rankingsPage < totalPages) {
            nextBtn.addEventListener('click', () => {
                this.rankingsPage++;
                this.loadRankingsList();
            });
        }
    }

    /**
     * 渲染对战历史视图
     */
    renderHistoryView() {
        const viewEl = document.getElementById('battle-history-view');
        if (!viewEl) return;
        
        viewEl.innerHTML = `
            <h2 style="font-size: 20px; color: #333; margin-bottom: 20px;">📋 对战历史</h2>
            <div id="battle-records-list" style="background: #fff; border-radius: 12px; overflow: hidden;">
                <div id="battle-records-tbody" style="min-height: 200px;">
                    <!-- 记录列表将在这里渲染 -->
                </div>
                <div id="battle-records-pagination" class="pagination" style="padding: 16px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <!-- 分页控件将在这里渲染 -->
                </div>
            </div>
        `;

        this.loadRecordsList();
    }

    /**
     * 开始匹配
     */
    async startMatch(mode = '1v1') {
        this.roomMode = mode;
        
        const btn = document.getElementById(`battle-${mode === '1v1' ? '1v1' : 'ai'}-btn`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = '匹配中...';
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
        }
        
        // 显示等待提示框
        this.showMatchingModal();
        
        try {
            // 使用从后端获取的等级分，如果没有则使用默认值1000
            const rankScore = this.battleInfo?.levelScore || 1000;
            const matchMode = mode === 'ai' ? 'single' : '1v1';
            const result = await this.api.battleMatch(rankScore, matchMode);
            
            if (result.matched && result.roomId) {
                // 立即匹配成功
                this.hideMatchingModal();
                this.showMatchResult(result);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = mode === '1v1' ? '开始匹配' : '开始对战';
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                }
            } else {
                // 未匹配成功，开始轮询
                this.startPolling();
            }
        } catch (error) {
            console.error('匹配失败:', error);
            this.hideMatchingModal();
            alert(`匹配失败: ${error.message || '未知错误'}`);
            if (btn) {
                btn.disabled = false;
                btn.textContent = mode === '1v1' ? '开始匹配' : '开始对战';
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        }
    }

    /**
     * 创建房间
     */
    async createRoom() {
        try {
            // TODO: 调用后端API创建房间
            // const result = await this.api.createRoom();
            
            // 模拟创建房间
            const mockRoomId = `room_${Date.now()}`;
            this.roomId = mockRoomId;
            this.roomMode = 'friend';
            
            this.showRoomCreatedModal(mockRoomId);
        } catch (error) {
            console.error('创建房间失败:', error);
            alert(`创建房间失败: ${error.message || '未知错误'}`);
        }
    }

    /**
     * 显示房间创建成功模态框
     */
    showRoomCreatedModal(roomId) {
        const existing = document.getElementById('battle-room-created-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'battle-room-created-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <div class="modal-header">
                    <h3>房间创建成功！</h3>
                    <button id="battle-room-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:48px;margin-bottom:12px;">🎉</div>
                        <div style="font-size:18px;font-weight:600;color:#333;margin-bottom:8px;">房间已创建</div>
                    </div>
                    <div style="background:#f5f5f5;padding:16px;border-radius:6px;margin-bottom:16px;">
                        <div style="margin-bottom:8px;">
                            <strong>房间ID:</strong> 
                            <code style="background:#fff;padding:4px 8px;border-radius:3px;font-family:monospace;font-size:16px;">${roomId}</code>
                        </div>
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;">
                            <div style="font-size:14px;color:#666;margin-bottom:8px;">分享房间ID给好友，让他们加入对战吧！</div>
                            <button id="battle-copy-room-id" style="width:100%;background:#667eea;color:#fff;border:none;padding:10px;border-radius:6px;cursor:pointer;font-size:14px;">
                                复制房间ID
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;gap:12px;">
                    <button id="battle-room-enter" class="admin-btn" style="background:#52c41a;color:#fff;border:1px solid #52c41a;padding:10px 24px;">
                        进入房间
                    </button>
                    <button id="battle-room-ok" class="admin-btn" style="background:#f5f5f5;color:#333;border:1px solid #e5e5e5;padding:10px 24px;">
                        稍后进入
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 绑定事件
        const closeBtn = document.getElementById('battle-room-close');
        const okBtn = document.getElementById('battle-room-ok');
        const enterBtn = document.getElementById('battle-room-enter');
        const copyBtn = document.getElementById('battle-copy-room-id');
        
        const closeModal = () => modal.remove();
        const enterRoom = () => {
            if (roomId) {
                window.open(`https://dac.nowcoder.com/acm/battle/fight/${roomId}`, '_blank');
            }
            modal.remove();
        };
        const copyRoomId = () => {
            navigator.clipboard.writeText(roomId).then(() => {
                copyBtn.textContent = '已复制！';
                setTimeout(() => {
                    copyBtn.textContent = '复制房间ID';
                }, 2000);
            });
        };
        
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (okBtn) okBtn.addEventListener('click', closeModal);
        if (enterBtn) enterBtn.addEventListener('click', enterRoom);
        if (copyBtn) copyBtn.addEventListener('click', copyRoomId);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    /**
     * 显示加入房间模态框
     */
    showJoinRoomModal() {
        const existing = document.getElementById('battle-join-room-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'battle-join-room-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header">
                    <h3>加入房间</h3>
                    <button id="battle-join-room-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div style="margin-bottom:16px;">
                        <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">房间ID</label>
                        <input id="battle-room-id-input" type="text" placeholder="请输入房间ID" 
                               style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:6px;font-size:14px;">
                    </div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;gap:12px;">
                    <button id="battle-join-room-confirm" class="admin-btn" style="background:#667eea;color:#fff;border:1px solid #667eea;padding:10px 24px;">
                        加入
                    </button>
                    <button id="battle-join-room-cancel" class="admin-btn" style="background:#f5f5f5;color:#333;border:1px solid #e5e5e5;padding:10px 24px;">
                        取消
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 绑定事件
        const closeBtn = document.getElementById('battle-join-room-close');
        const cancelBtn = document.getElementById('battle-join-room-cancel');
        const confirmBtn = document.getElementById('battle-join-room-confirm');
        const input = document.getElementById('battle-room-id-input');
        
        const closeModal = () => modal.remove();
        const joinRoom = () => {
            const roomId = input?.value?.trim();
            if (!roomId) {
                alert('请输入房间ID');
                return;
            }
            // 跳转到房间
            window.open(`https://dac.nowcoder.com/acm/battle/fight/${roomId}`, '_blank');
            modal.remove();
        };
        
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (confirmBtn) confirmBtn.addEventListener('click', joinRoom);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') joinRoom();
            });
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    /**
     * 显示匹配等待提示框
     */
    showMatchingModal() {
        const existing = document.getElementById('battle-matching-modal');
        if (existing) existing.remove();
        
        this.matchStartTime = Date.now();
        const modal = document.createElement('div');
        modal.id = 'battle-matching-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header">
                    <h3>匹配中...</h3>
                    <button id="battle-matching-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="text-align:center;padding:30px 20px;">
                    <div style="font-size:48px;margin-bottom:16px;">⏳</div>
                    <div style="font-size:16px;color:#666;margin-bottom:8px;">正在寻找对手...</div>
                    <div id="battle-matching-timer" style="font-size:14px;color:#999;">已等待 0 秒</div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;">
                    <button id="battle-matching-cancel" class="admin-btn" style="background:#ff4d4f;color:#fff;border:1px solid #ff4d4f;">取消匹配</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const closeBtn = document.getElementById('battle-matching-close');
        const cancelBtn = document.getElementById('battle-matching-cancel');
        
        const closeModal = () => {
            this.cancelMatch();
            this.hideMatchingModal();
        };
        
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        this.startTimer();
    }

    /**
     * 开始计时
     */
    startTimer() {
        const timerEl = document.getElementById('battle-matching-timer');
        if (!timerEl) return;
        
        this.matchingTimer = setInterval(() => {
            if (!this.matchStartTime) return;
            const elapsed = Math.floor((Date.now() - this.matchStartTime) / 1000);
            timerEl.textContent = `已等待 ${elapsed} 秒`;
        }, 1000);
    }

    /**
     * 停止计时
     */
    stopTimer() {
        if (this.matchingTimer) {
            clearInterval(this.matchingTimer);
            this.matchingTimer = null;
        }
    }

    /**
     * 隐藏匹配等待提示框
     */
    hideMatchingModal() {
        this.stopTimer();
        this.stopPolling();
        const modal = document.getElementById('battle-matching-modal');
        if (modal) modal.remove();
        this.matchStartTime = null;
    }

    /**
     * 开始轮询匹配结果
     */
    startPolling() {
        this.stopPolling();
        
        this.pollingInterval = setInterval(async () => {
            try {
                const result = await this.api.battlePoll();
                if (result.matched && result.roomId) {
                    this.hideMatchingModal();
                    this.showMatchResult(result);
                    
                    const mode = this.roomMode === '1v1' ? '1v1' : 'ai';
                    const btn = document.getElementById(`battle-${mode}-btn`);
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = mode === '1v1' ? '开始匹配' : '开始对战';
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                    }
                }
            } catch (error) {
                console.error('轮询失败:', error);
            }
        }, 2000);
    }

    /**
     * 停止轮询
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * 取消匹配
     */
    async cancelMatch() {
        try {
            await this.api.battleCancel('1v1');
        } catch (error) {
            console.error('取消匹配失败:', error);
        }
        
        const mode = this.roomMode === '1v1' ? '1v1' : 'ai';
        const btn = document.getElementById(`battle-${mode}-btn`);
        if (btn) {
            btn.disabled = false;
            btn.textContent = mode === '1v1' ? '开始匹配' : '开始对战';
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    }

    /**
     * 显示匹配结果
     */
    showMatchResult(result) {
        const existing = document.getElementById('battle-match-result-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'battle-match-result-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <div class="modal-header">
                    <h3>匹配成功！</h3>
                    <button id="battle-result-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:48px;margin-bottom:12px;">🎉</div>
                        <div style="font-size:18px;font-weight:600;color:#333;margin-bottom:8px;">匹配成功</div>
                    </div>
                    <div style="background:#f5f5f5;padding:16px;border-radius:6px;margin-bottom:16px;">
                        <div style="margin-bottom:8px;">
                            <strong>房间ID:</strong> 
                            <code style="background:#fff;padding:4px 8px;border-radius:3px;font-family:monospace;">${result.roomId || '-'}</code>
                        </div>
                        ${result.problemId ? `
                            <div style="margin-bottom:8px;">
                                <strong>题目ID:</strong> ${result.problemId}
                            </div>
                        ` : ''}
                        ${result.opponentId ? `
                            <div>
                                <strong>对手ID:</strong> ${result.opponentId}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;gap:12px;">
                    <button id="battle-result-enter" class="admin-btn" style="background:#52c41a;color:#fff;border:1px solid #52c41a;padding:10px 24px;">
                        进入房间
                    </button>
                    <button id="battle-result-ok" class="admin-btn" style="background:#f5f5f5;color:#333;border:1px solid #e5e5e5;padding:10px 24px;">
                        稍后进入
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const closeBtn = document.getElementById('battle-result-close');
        const okBtn = document.getElementById('battle-result-ok');
        const enterBtn = document.getElementById('battle-result-enter');
        
        const closeResult = () => modal.remove();
        const enterRoom = () => {
            if (result.roomId) {
                window.open(`https://dac.nowcoder.com/acm/battle/fight/${result.roomId}`, '_blank');
            }
            modal.remove();
        };
        
        if (closeBtn) closeBtn.addEventListener('click', closeResult);
        if (okBtn) okBtn.addEventListener('click', closeResult);
        if (enterBtn) enterBtn.addEventListener('click', enterRoom);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeResult();
        });
    }

    /**
     * 加载对战记录列表
     */
    async loadRecordsList() {
        const tbody = document.getElementById('battle-records-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">加载中...</div>';
        
        try {
            const userId = this.state.loggedInUserId;
            const result = await this.api.battleRecordList(userId, this.recordsPage, this.recordsLimit);
            
            this.recordsList = result.list || [];
            this.recordsTotal = result.total || 0;
            
            this.renderRecordsList();
            this.renderRecordsPagination();
        } catch (error) {
            console.error('加载对战记录失败:', error);
            tbody.innerHTML = '<div style="padding: 40px; text-align: center; color: #f5222d;">加载失败，请稍后重试</div>';
        }
    }

    /**
     * 渲染对战记录列表
     */
    renderRecordsList() {
        const tbody = document.getElementById('battle-records-tbody');
        if (!tbody) return;
        
        if (this.recordsList.length === 0) {
            tbody.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">暂无对战记录</div>';
            return;
        }
        
        tbody.innerHTML = this.recordsList.map((record, index) => {
            const date = record.battleTime ? new Date(record.battleTime).toLocaleString('zh-CN') : '-';
            const typeText = record.type === 'single' ? '单机' : record.type === '1v1' ? '1v1对战' : record.type || '未知';
            
            return `
                <div class="battle-record-item" 
                     data-record-id="${record.id || index}" 
                     style="padding: 16px 20px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;"
                     onmouseover="this.style.background='#f5f5f5'"
                     onmouseout="this.style.background='#fff'">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 4px;">
                                ${typeText}
                            </div>
                            <div style="font-size: 14px; color: #666;">
                                时间: ${date}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <button class="view-record-btn" 
                                    data-record-id="${record.id || index}"
                                    style="background: #667eea; color: #fff; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                查看详情
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        tbody.querySelectorAll('.view-record-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const recordId = btn.dataset.recordId;
                this.viewRecordDetail(recordId);
            });
        });
    }

    /**
     * 渲染分页控件
     */
    renderRecordsPagination() {
        const pagination = document.getElementById('battle-records-pagination');
        if (!pagination) return;
        
        const totalPages = Math.ceil(this.recordsTotal / this.recordsLimit);
        
        if (totalPages <= 1) {
            pagination.innerHTML = `
                <div style="color: #666; font-size: 14px;">
                    共 ${this.recordsTotal} 条记录
                </div>
            `;
            return;
        }
        
        pagination.innerHTML = `
            <div style="color: #666; font-size: 14px;">
                共 ${this.recordsTotal} 条记录，第 ${this.recordsPage} / ${totalPages} 页
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="battle-records-prev" 
                        class="pagination-btn" 
                        ${this.recordsPage <= 1 ? 'disabled' : ''}
                        style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; ${this.recordsPage <= 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                    上一页
                </button>
                <button id="battle-records-next" 
                        class="pagination-btn" 
                        ${this.recordsPage >= totalPages ? 'disabled' : ''}
                        style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; ${this.recordsPage >= totalPages ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                    下一页
                </button>
            </div>
        `;
        
        const prevBtn = document.getElementById('battle-records-prev');
        const nextBtn = document.getElementById('battle-records-next');
        
        if (prevBtn && this.recordsPage > 1) {
            prevBtn.addEventListener('click', () => {
                this.recordsPage--;
                this.loadRecordsList();
            });
        }
        
        if (nextBtn && this.recordsPage < totalPages) {
            nextBtn.addEventListener('click', () => {
                this.recordsPage++;
                this.loadRecordsList();
            });
        }
    }

    /**
     * 查看对战记录详情
     */
    async viewRecordDetail(recordId) {
        try {
            const record = await this.api.battleRecord(recordId);
            
            if (!record) {
                alert('未找到对战记录');
                return;
            }
            
            this.showRecordDetailModal(record);
        } catch (error) {
            console.error('加载对战记录详情失败:', error);
            alert('加载失败，请稍后重试');
        }
    }

    /**
     * 显示对战记录详情模态框
     */
    showRecordDetailModal(record) {
        const existing = document.getElementById('battle-record-detail-modal');
        if (existing) existing.remove();
        
        let opponentInfo = null;
        try {
            if (record.opponentJson) {
                opponentInfo = typeof record.opponentJson === 'string' 
                    ? JSON.parse(record.opponentJson) 
                    : record.opponentJson;
            }
        } catch (e) {
            console.error('解析对手信息失败:', e);
        }
        
        const modal = document.createElement('div');
        modal.id = 'battle-record-detail-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:700px;max-height:90vh;overflow-y:auto;">
                <div class="modal-header">
                    <h3>对战记录详情</h3>
                    <button id="battle-record-detail-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    ${this.renderRecordDetailContent(record, opponentInfo)}
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;">
                    <button id="battle-record-detail-ok" class="admin-btn" style="background:#667eea;color:#fff;border:1px solid #667eea;">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const closeBtn = document.getElementById('battle-record-detail-close');
        const okBtn = document.getElementById('battle-record-detail-ok');
        
        const closeModal = () => modal.remove();
        
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (okBtn) okBtn.addEventListener('click', closeModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    /**
     * 渲染对战记录详情内容
     */
    renderRecordDetailContent(record, opponentInfo) {
        const date = record.battleTime ? new Date(record.battleTime).toLocaleString('zh-CN') : '-';
        const typeText = record.type === 'single' ? '单机' : record.type === '1v1' ? '1v1对战' : record.type || '未知';
        
        const userInfo = record.user || {};
        const userLevelScore = userInfo.levelScore || 0;
        const userScoreChange = userInfo.scoreChange || 0;
        const userScoreChangeText = userScoreChange > 0 
            ? `+${userScoreChange}` 
            : userScoreChange < 0 
                ? `${userScoreChange}` 
                : '0';
        const userScoreChangeColor = userScoreChange > 0 ? '#52c41a' : userScoreChange < 0 ? '#ff4d4f' : '#666';
        
        const oppLevelScore = opponentInfo?.levelScore || 0;
        const oppScoreChange = opponentInfo?.scoreChange || 0;
        const oppScoreChangeText = oppScoreChange > 0 
            ? `+${oppScoreChange}` 
            : oppScoreChange < 0 
                ? `${oppScoreChange}` 
                : '0';
        const oppScoreChangeColor = oppScoreChange > 0 ? '#52c41a' : oppScoreChange < 0 ? '#ff4d4f' : '#666';
        
        return `
            <div style="margin-bottom: 20px;">
                <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px;">基本信息</div>
                <div style="background: #f5f5f5; padding: 12px; border-radius: 6px;">
                    <div style="margin-bottom: 8px;"><strong>对战类型:</strong> ${typeText}</div>
                    <div style="margin-bottom: 8px;"><strong>对战时间:</strong> ${date}</div>
                    ${record.problemId ? `<div style="margin-bottom: 8px;"><strong>题目ID:</strong> ${record.problemId}</div>` : ''}
                    ${record.problemName ? `<div><strong>题目名称:</strong> ${record.problemName}</div>` : ''}
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px;">对战双方</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div style="background: #f0f5ff; padding: 16px; border-radius: 6px; border: 2px solid #667eea;">
                        <div style="font-weight: 600; color: #667eea; margin-bottom: 8px;">我</div>
                        <div style="margin-bottom: 4px;"><strong>等级分:</strong> ${userLevelScore}</div>
                        <div style="margin-bottom: 4px;"><strong>分数变动:</strong> 
                            <span style="color: ${userScoreChangeColor}; font-weight: 600;">${userScoreChangeText}</span>
                        </div>
                        ${userInfo.name ? `<div><strong>用户名:</strong> ${userInfo.name}</div>` : ''}
                        ${userInfo.headUrl ? `<div style="margin-top: 8px;"><img src="${userInfo.headUrl}" style="width: 40px; height: 40px; border-radius: 50%;" /></div>` : ''}
                    </div>
                    
                    <div style="background: #fff7e6; padding: 16px; border-radius: 6px; border: 2px solid #faad14;">
                        <div style="font-weight: 600; color: #faad14; margin-bottom: 8px;">对手</div>
                        <div style="margin-bottom: 4px;"><strong>等级分:</strong> ${oppLevelScore}</div>
                        <div style="margin-bottom: 4px;"><strong>分数变动:</strong> 
                            <span style="color: ${oppScoreChangeColor}; font-weight: 600;">${oppScoreChangeText}</span>
                        </div>
                        ${opponentInfo?.name ? `<div><strong>用户名:</strong> ${opponentInfo.name}</div>` : ''}
                        ${opponentInfo?.headUrl ? `<div style="margin-top: 8px;"><img src="${opponentInfo.headUrl}" style="width: 40px; height: 40px; border-radius: 50%;" /></div>` : ''}
                    </div>
                </div>
            </div>
            
            ${record.details ? `
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px;">对战细节</div>
                    <div style="background: #f5f5f5; padding: 12px; border-radius: 6px;">
                        ${this.renderBattleDetails(record.details)}
                    </div>
                </div>
            ` : ''}
        `;
    }

    /**
     * 渲染对战细节
     */
    renderBattleDetails(details) {
        if (!details || typeof details !== 'object') {
            return '<div>暂无对战细节</div>';
        }
        
        let parsedDetails = details;
        if (typeof details === 'string') {
            try {
                parsedDetails = JSON.parse(details);
            } catch (e) {
                return `<div>${details}</div>`;
            }
        }
        
        let html = '';
        
        if (parsedDetails.user) {
            const userDetail = parsedDetails.user;
            html += `
                <div style="margin-bottom: 12px;">
                    <strong>我的状态:</strong>
                    ${userDetail.time ? `<span style="margin-left: 8px;">用时: ${userDetail.time}秒</span>` : ''}
                    ${userDetail.completed !== undefined ? `<span style="margin-left: 8px; color: ${userDetail.completed ? '#52c41a' : '#ff4d4f'};">${userDetail.completed ? '已完成' : '未完成'}</span>` : ''}
                </div>
            `;
        }
        
        if (parsedDetails.opponent) {
            const oppDetail = parsedDetails.opponent;
            html += `
                <div>
                    <strong>对手状态:</strong>
                    ${oppDetail.time ? `<span style="margin-left: 8px;">用时: ${oppDetail.time}秒</span>` : ''}
                    ${oppDetail.completed !== undefined ? `<span style="margin-left: 8px; color: ${oppDetail.completed ? '#52c41a' : '#ff4d4f'};">${oppDetail.completed ? '已完成' : '未完成'}</span>` : ''}
                </div>
            `;
        }
        
        return html || '<div>暂无对战细节</div>';
    }

    hide() {
        const section = document.getElementById('battle');
        if (section) section.classList.remove('active');
        
        this.stopTimer();
        this.stopPolling();
    }
}
