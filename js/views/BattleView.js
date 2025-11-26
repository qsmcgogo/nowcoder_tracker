/**
 * 对战平台视图模块
 * 处理对战相关的UI和逻辑
 */
import { eventBus, EVENTS } from '../events/EventBus.js';
import { getBattleUrl, initBattleDomain } from '../config.js';

export class BattleView {
    constructor(elements, state, api) {
        this.elements = elements;
        this.state = state;
        this.api = api;
        this.container = this.elements.battleContainer;
        this.matchingTimer = null;
        this.pollingInterval = null;
        this.matchStartTime = null;
        this.countdownTimer = null; // 倒计时定时器
        
        // 当前视图状态
        this.currentSidebarTab = 'start'; // 'start' 开始对战, 'rankings' 对战排行榜, 'history' 对战历史
        this.battleInfo = null; // 用户对战信息 {battle1v1: {...}, battleAI: {...}}
        this.templateInfo1v1 = null; // 1v1对战模板信息 {templateCode: {}, level: 1, exp: 0, maxLength: 10000}
        this.templateInfoAI = null; // 人机对战模板信息 {templateCode: {}, level: 1, exp: 0, maxLength: 10000}
        this.recordsType = 2; // 1=人机对战，2=1v1对战
        this.recordsPage = 1;
        this.recordsLimit = 20;
        this.recordsTotal = 0;
        this.recordsList = [];
        this.selectedRecordId = null;
        this.rankingsType = 2; // 1=人机对战，2=1v1对战
        this.rankingsPage = 1;
        this.rankingsLimit = 20;
        this.rankingsList = [];
        this.rankingsTotal = 0;
        
        // 房间相关
        this.roomId = null;
        this.roomCode = null;
        this.roomMode = null; // '1v1', 'ai', 'friend'
        this.roomPollingInterval = null; // 房间轮询定时器
        this.roomCountdownInterval = null; // 房间倒计时定时器
        this.joinRoomCountdownInterval = null; // 加入房间倒计时定时器
        this.roomCreatedModal = null; // 房间创建模态框引用
        this.roomCreatedModalData = null; // 房间创建模态框数据
        
        // 管理员批量处理房间状态定时器
        this.batchProcessInterval = null;
        this.batchProcessRunning = false;
        
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
        
        // 初始化对战域名配置
        await initBattleDomain();
        
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
            // 调用后端接口获取对战信息，同时返回1v1和人机对战两种类型的信息
            this.battleInfo = await this.api.battleInfo();
            
            // 并行加载模板信息
            try {
                const [template1v1, templateAI] = await Promise.all([
                    this.api.battleTemplate(2), // 1v1对战
                    this.api.battleTemplate(1)  // 人机对战
                ]);
                this.templateInfo1v1 = template1v1;
                this.templateInfoAI = templateAI;
            } catch (templateError) {
                console.error('加载模板信息失败:', templateError);
                // 使用默认值
                this.templateInfo1v1 = { templateCode: {}, level: 1, exp: 0, maxLength: 10000 };
                this.templateInfoAI = { templateCode: {}, level: 1, exp: 0, maxLength: 10000 };
            }
        } catch (error) {
            console.error('加载对战信息失败:', error);
            // 使用默认值
            this.battleInfo = {
                battle1v1: { levelScore: 1000, winCount: 0, totalCount: 0, type: 2 },
                battleAI: { levelScore: 1000, winCount: 0, totalCount: 0, type: 1 }
            };
            this.templateInfo1v1 = { templateCode: {}, level: 1, exp: 0, maxLength: 10000 };
            this.templateInfoAI = { templateCode: {}, level: 1, exp: 0, maxLength: 10000 };
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
                            style="width: 100%; text-align: left; background: transparent; border: none; padding: 10px 12px; border-radius: 6px; cursor: pointer; color: #333; font-weight: 600; margin-bottom: 4px;">
                        📋 对战历史
                    </button>
                    <button class="battle-sidebar-btn ${this.currentSidebarTab === 'rules' ? 'active' : ''}" 
                            data-tab="rules" 
                            style="width: 100%; text-align: left; background: transparent; border: none; padding: 10px 12px; border-radius: 6px; cursor: pointer; color: #333; font-weight: 600;">
                        📖 说明
                    </button>
                </aside>
                
                <!-- 主内容区 -->
                <section class="battle-content" style="flex: 1; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px;">
                    <!-- 删档内测提示 -->
                    <div style="background: linear-gradient(135deg, #fff7e6 0%, #ffecc7 100%); border-left: 4px solid #faad14; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 18px;">⚠️</span>
                            <div style="flex: 1;">
                                <div style="font-size: 14px; font-weight: 600; color: #fa8c16; margin-bottom: 2px;">
                                    删档内测版本
                                </div>
                                <div style="font-size: 13px; color: #666;">
                                    目前是删档内测版本，正式版会重置等级分
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${this.state.isAdmin ? `
                    <!-- 管理员：批量处理房间状态 -->
                    <div id="battle-admin-batch-process" style="background: #f0f5ff; border: 1px solid #adc6ff; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <div style="font-size: 14px; font-weight: 600; color: #1d39c4; margin-bottom: 4px;">
                                    🔧 管理员工具：批量处理房间状态
                                </div>
                                <div style="font-size: 12px; color: #666;">
                                    每10秒自动批量处理所有活跃房间的状态
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <span id="battle-batch-process-status" style="font-size: 12px; color: #999; margin-right: 8px;">
                                    ${this.batchProcessRunning ? '运行中...' : '已停止'}
                                </span>
                                <button id="battle-batch-process-start" 
                                        ${this.batchProcessRunning ? 'disabled' : ''}
                                        style="background: ${this.batchProcessRunning ? '#d9d9d9' : '#52c41a'}; color: #fff; border: none; padding: 6px 16px; border-radius: 4px; cursor: ${this.batchProcessRunning ? 'not-allowed' : 'pointer'}; font-size: 14px; font-weight: 600; opacity: ${this.batchProcessRunning ? '0.6' : '1'};">
                                    开始
                                </button>
                                <button id="battle-batch-process-stop" 
                                        ${!this.batchProcessRunning ? 'disabled' : ''}
                                        style="background: ${!this.batchProcessRunning ? '#d9d9d9' : '#ff4d4f'}; color: #fff; border: none; padding: 6px 16px; border-radius: 4px; cursor: ${!this.batchProcessRunning ? 'not-allowed' : 'pointer'}; font-size: 14px; font-weight: 600; opacity: ${!this.batchProcessRunning ? '0.6' : '1'};">
                                    停止
                                </button>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div id="battle-start-view" class="battle-view-panel" style="display: ${this.currentSidebarTab === 'start' ? 'block' : 'none'};">
                        <!-- 开始对战视图 -->
                    </div>
                    <div id="battle-rankings-view" class="battle-view-panel" style="display: ${this.currentSidebarTab === 'rankings' ? 'block' : 'none'};">
                        <!-- 对战排行榜视图 -->
                    </div>
                    <div id="battle-history-view" class="battle-view-panel" style="display: ${this.currentSidebarTab === 'history' ? 'block' : 'none'};">
                        <!-- 对战历史视图 -->
                    </div>
                    <div id="battle-rules-view" class="battle-view-panel" style="display: ${this.currentSidebarTab === 'rules' ? 'block' : 'none'};">
                        <!-- 说明视图 -->
                    </div>
                </section>
            </div>
        `;

        // 绑定侧边栏切换事件
        this.bindSidebarEvents();
        
        // 绑定管理员批量处理按钮事件
        if (this.state.isAdmin) {
            this.bindAdminBatchProcessEvents();
        }
        
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
                const views = ['start', 'rankings', 'history', 'rules'];
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
     * 绑定管理员批量处理按钮事件
     */
    bindAdminBatchProcessEvents() {
        const startBtn = document.getElementById('battle-batch-process-start');
        const stopBtn = document.getElementById('battle-batch-process-stop');
        const statusEl = document.getElementById('battle-batch-process-status');
        
        if (!startBtn || !stopBtn) return;
        
        const startBatchProcess = () => {
            if (this.batchProcessRunning) return;
            
            this.batchProcessRunning = true;
            startBtn.disabled = true;
            startBtn.style.background = '#d9d9d9';
            startBtn.style.cursor = 'not-allowed';
            startBtn.style.opacity = '0.6';
            
            stopBtn.disabled = false;
            stopBtn.style.background = '#ff4d4f';
            stopBtn.style.cursor = 'pointer';
            stopBtn.style.opacity = '1';
            
            if (statusEl) {
                statusEl.textContent = '运行中...';
                statusEl.style.color = '#52c41a';
            }
            
            // 立即执行一次
            this.executeBatchProcess();
            
            // 每10秒执行一次
            this.batchProcessInterval = setInterval(() => {
                this.executeBatchProcess();
            }, 10000);
        };
        
        const stopBatchProcess = () => {
            if (!this.batchProcessRunning) return;
            
            this.batchProcessRunning = false;
            
            if (this.batchProcessInterval) {
                clearInterval(this.batchProcessInterval);
                this.batchProcessInterval = null;
            }
            
            startBtn.disabled = false;
            startBtn.style.background = '#52c41a';
            startBtn.style.cursor = 'pointer';
            startBtn.style.opacity = '1';
            
            stopBtn.disabled = true;
            stopBtn.style.background = '#d9d9d9';
            stopBtn.style.cursor = 'not-allowed';
            stopBtn.style.opacity = '0.6';
            
            if (statusEl) {
                statusEl.textContent = '已停止';
                statusEl.style.color = '#999';
            }
        };
        
        startBtn.addEventListener('click', startBatchProcess);
        stopBtn.addEventListener('click', stopBatchProcess);
    }
    
    /**
     * 执行批量处理房间状态
     */
    async executeBatchProcess() {
        try {
            const result = await this.api.adminBatchProcessRoomStatus();
            console.log('批量处理房间状态成功:', result);
            // 可以在这里更新状态显示，比如显示处理的房间数等
        } catch (error) {
            console.error('批量处理房间状态失败:', error);
            // 如果失败，可以选择停止定时器
            // this.stopBatchProcess();
        }
    }
    
    /**
     * 停止批量处理（清理资源）
     */
    stopBatchProcess() {
        if (this.batchProcessInterval) {
            clearInterval(this.batchProcessInterval);
            this.batchProcessInterval = null;
        }
        this.batchProcessRunning = false;
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
            case 'rules':
                this.renderRulesView();
                break;
        }
    }

    /**
     * 渲染开始对战视图
     */
    renderStartView() {
        const viewEl = document.getElementById('battle-start-view');
        if (!viewEl) return;
        
        const battleInfo = this.battleInfo || {
            battle1v1: { levelScore: 1000, winCount: 0, totalCount: 0, type: 2 },
            battleAI: { levelScore: 1000, winCount: 0, totalCount: 0, type: 1 }
        };
        
        const info1v1 = battleInfo.battle1v1 || { levelScore: 1000, winCount: 0, totalCount: 0 };
        const infoAI = battleInfo.battleAI || { levelScore: 1000, winCount: 0, totalCount: 0 };
        
        const template1v1 = this.templateInfo1v1 || { level: 1, exp: 0, maxLength: 10000 };
        const templateAI = this.templateInfoAI || { level: 1, exp: 0, maxLength: 10000 };
        
        // 使用统一的等级和经验（两个类型返回的值相同）
        const templateInfo = template1v1;
        
        const winRate1v1 = info1v1.totalCount > 0 
            ? ((info1v1.winCount / info1v1.totalCount) * 100).toFixed(1) 
            : '0.0';
        const winRateAI = infoAI.totalCount > 0 
            ? ((infoAI.winCount / infoAI.totalCount) * 100).toFixed(1) 
            : '0.0';
        
        // 使用后端返回的经验值数据
        const currentExp = templateInfo.exp || 0;
        const currentLevel = templateInfo.level || 1;
        // 后端返回 expNeeded 表示升级到下一级所需的总经验，expRequired 表示当前等级所需的总经验
        const expNeeded = templateInfo.expNeeded || templateInfo.expRequired || 10;
        const expRequired = templateInfo.expRequired || expNeeded;
        // 当前等级的总经验 = 当前经验 + 还需的经验
        const totalExpForCurrentLevel = expRequired;
        // 还需的经验 = 总经验 - 当前经验
        const expToNext = Math.max(0, expRequired - currentExp);

        viewEl.innerHTML = `
            <div style="display: flex; gap: 20px;">
                <!-- 左侧：对战信息 -->
                <div style="flex: 1;">
                    <h2 style="font-size: 20px; color: #333; margin-bottom: 20px;">⚔️ 我的对战信息</h2>
                    
                    <!-- 1v1对战信息卡片 -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 24px; border-radius: 12px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div style="font-size: 16px; font-weight: 600; opacity: 0.95;">1v1 对战</div>
                            <div style="font-size: 12px; opacity: 0.8;">用户ID: ${this.state.loggedInUserId}</div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                            <div style="text-align: center;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">等级分</div>
                                <div style="font-size: 32px; font-weight: bold;">${info1v1.levelScore}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">胜场</div>
                                <div style="font-size: 32px; font-weight: bold;">${info1v1.winCount}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">总场次</div>
                                <div style="font-size: 32px; font-weight: bold;">${info1v1.totalCount}</div>
                            </div>
                        </div>
                        ${info1v1.totalCount > 0 ? `
                            <div style="text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.2);">
                                <div style="font-size: 14px; opacity: 0.9;">胜率</div>
                                <div style="font-size: 24px; font-weight: bold;">${winRate1v1}%</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- 人机对战信息卡片 -->
                    <div style="background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%); color: #fff; padding: 24px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div style="font-size: 16px; font-weight: 600; opacity: 0.95;">人机对战</div>
                            <div style="font-size: 12px; opacity: 0.8;">用户ID: ${this.state.loggedInUserId}</div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                            <div style="text-align: center;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">等级分</div>
                                <div style="font-size: 32px; font-weight: bold;">${infoAI.levelScore}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">胜场</div>
                                <div style="font-size: 32px; font-weight: bold;">${infoAI.winCount}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">总场次</div>
                                <div style="font-size: 32px; font-weight: bold;">${infoAI.totalCount}</div>
                            </div>
                        </div>
                        ${infoAI.totalCount > 0 ? `
                            <div style="text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.2);">
                                <div style="font-size: 14px; opacity: 0.9;">胜率</div>
                                <div style="font-size: 24px; font-weight: bold;">${winRateAI}%</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- 等级和经验卡片（统一显示） -->
                    <div style="background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%); color: #fff; padding: 24px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); position: relative;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="font-size: 16px; font-weight: 600; opacity: 0.95;">⭐ 对战等级</div>
                                <div id="battle-level-help" 
                                     style="width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,0.3); 
                                            display: flex; align-items: center; justify-content: center; cursor: pointer; 
                                            font-size: 12px; font-weight: bold; transition: all 0.2s;"
                                     onmouseover="this.style.background='rgba(255,255,255,0.5)'; this.style.transform='scale(1.1)'"
                                     onmouseout="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='scale(1)'">
                                    ?
                                </div>
                                <div id="battle-level-help-tooltip" 
                                     style="display: none; position: absolute; top: 60px; left: 24px; right: 24px; 
                                            background: rgba(0,0,0,0.9); color: #fff; padding: 12px 16px; border-radius: 8px; 
                                            font-size: 13px; line-height: 1.6; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                                    <div style="font-weight: 600; margin-bottom: 8px; color: #ffd700;">⭐ 升级规则</div>
                                    <div style="margin-bottom: 4px;">• 如果 AC 并胜利，加 10 经验</div>
                                    <div style="margin-bottom: 4px;">• 如果 AC 但是失败，加 5 经验</div>
                                    <div style="margin-bottom: 8px;">• 任何情况下放弃均无经验</div>
                                    <div style="padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); color: #ffd700; font-weight: 600;">
                                        升级后可以获得更大模板长度限额
                                    </div>
                                </div>
                            </div>
                            <div style="font-size: 24px; font-weight: bold;">Lv.${currentLevel}</div>
                        </div>
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">当前经验: ${currentExp} / ${totalExpForCurrentLevel}</div>
                        <div style="background: rgba(255,255,255,0.2); border-radius: 6px; height: 8px; overflow: hidden; margin-bottom: 8px;">
                            <div style="background: #fff; height: 100%; width: ${Math.min(100, totalExpForCurrentLevel > 0 ? (currentExp / totalExpForCurrentLevel) * 100 : 0)}%; transition: width 0.3s; border-radius: 6px;"></div>
                        </div>
                        <div style="font-size: 12px; opacity: 0.8; text-align: right;">还需 ${expToNext} 经验升级</div>
                    </div>
                    
                    <!-- 设置初始代码按钮 -->
                    <div style="margin-top: 20px;">
                        <button id="battle-set-template-btn" 
                                style="width: 100%; background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%); color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 12px rgba(255,107,157,0.3);"
                                onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 16px rgba(255,107,157,0.4)'"
                                onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(255,107,157,0.3)'">
                            ⚙️ 设置初始代码
                        </button>
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
        
        // 绑定设置初始代码按钮事件
        const setTemplateBtn = document.getElementById('battle-set-template-btn');
        if (setTemplateBtn) {
            setTemplateBtn.addEventListener('click', () => {
                this.showTemplateModal();
            });
        }
        
        // 绑定等级问号提示
        const levelHelp = document.getElementById('battle-level-help');
        const levelTooltip = document.getElementById('battle-level-help-tooltip');
        if (levelHelp && levelTooltip) {
            levelHelp.addEventListener('mouseenter', () => {
                levelTooltip.style.display = 'block';
            });
            levelHelp.addEventListener('mouseleave', () => {
                levelTooltip.style.display = 'none';
            });
        }
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
            
            <!-- 类型切换 -->
            <div style="margin-bottom: 20px; display: flex; gap: 12px;">
                <button id="battle-rankings-type-1v1" 
                        class="battle-rankings-type-btn"
                        data-type="2"
                        style="padding: 8px 20px; border: 2px solid ${this.rankingsType === 2 ? '#667eea' : '#ddd'}; 
                               background: ${this.rankingsType === 2 ? '#667eea' : '#fff'}; 
                               color: ${this.rankingsType === 2 ? '#fff' : '#666'}; 
                               border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;
                               transition: all 0.2s;">
                    1v1对战
                </button>
                <button id="battle-rankings-type-ai" 
                        class="battle-rankings-type-btn"
                        data-type="1"
                        style="padding: 8px 20px; border: 2px solid ${this.rankingsType === 1 ? '#667eea' : '#ddd'}; 
                               background: ${this.rankingsType === 1 ? '#667eea' : '#fff'}; 
                               color: ${this.rankingsType === 1 ? '#fff' : '#666'}; 
                               border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;
                               transition: all 0.2s;">
                    人机对战
                </button>
            </div>
            
            <div id="battle-rankings-list" style="min-height: 400px;">
                <div style="padding: 40px; text-align: center; color: #999;">加载中...</div>
            </div>
            <div id="battle-rankings-pagination" class="pagination" style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
                <!-- 分页控件将在这里渲染 -->
            </div>
        `;

        // 绑定类型切换事件
        const type1v1Btn = document.getElementById('battle-rankings-type-1v1');
        const typeAiBtn = document.getElementById('battle-rankings-type-ai');
        if (type1v1Btn) {
            type1v1Btn.addEventListener('click', () => {
                this.rankingsType = 2;
                this.rankingsPage = 1;
                this.renderRankingsView();
            });
        }
        if (typeAiBtn) {
            typeAiBtn.addEventListener('click', () => {
                this.rankingsType = 1;
                this.rankingsPage = 1;
                this.renderRankingsView();
            });
        }

        await this.loadRankingsList();
    }

    /**
     * 加载对战排行榜列表
     */
    async loadRankingsList() {
        const listEl = document.getElementById('battle-rankings-list');
        if (!listEl) return;
        
        try {
            const result = await this.api.battleLeaderboard(this.rankingsType, this.rankingsPage, this.rankingsLimit);
            
            this.rankingsList = result.list || [];
            this.rankingsTotal = result.total || 0;
            
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
                        const winRate = user.winRate !== undefined 
                            ? user.winRate.toFixed(1)
                            : (user.totalCount > 0 
                                ? ((user.winCount / user.totalCount) * 100).toFixed(1) 
                                : '0.0');
                        const rankIcon = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : '';
                        const nickname = user.nickname || user.name || `用户${user.userId}`;
                        const avatar = user.avatar || '';
                        return `
                            <tr style="border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" 
                                onmouseover="this.style.background='#f5f5f5'"
                                onmouseout="this.style.background='#fff'">
                                <td style="padding: 12px;">
                                    <span style="font-weight: 600; color: #333;">${rankIcon} ${user.rank}</span>
                                </td>
                                <td style="padding: 12px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        ${avatar ? `<img src="${avatar}" style="width: 32px; height: 32px; border-radius: 50%;" onerror="this.style.display='none'" />` : ''}
                                        <a href="https://www.nowcoder.com/users/${user.userId}" target="_blank" style="color: #667eea; text-decoration: none; font-weight: 500;">
                                            ${nickname}
                                        </a>
                                    </div>
                                </td>
                                <td style="padding: 12px; text-align: right; font-weight: 600; color: #333;">${user.levelScore || 0}</td>
                                <td style="padding: 12px; text-align: right; color: #666;">${user.winCount || 0}</td>
                                <td style="padding: 12px; text-align: right; color: #666;">${user.totalCount || 0}</td>
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
     * 显示设置初始代码模态框
     */
    async showTemplateModal() {
        const existing = document.getElementById('battle-template-modal');
        if (existing) existing.remove();
        
        // 加载当前模板信息
        let currentTemplate1v1 = this.templateInfo1v1 || { templateCode: {}, maxLength: 10000 };
        let currentTemplateAI = this.templateInfoAI || { templateCode: {}, maxLength: 10000 };
        
        // 如果模板信息未加载，先加载
        if (!this.templateInfo1v1 || !this.templateInfoAI) {
            try {
                const [template1v1, templateAI] = await Promise.all([
                    this.api.battleTemplate(2),
                    this.api.battleTemplate(1)
                ]);
                currentTemplate1v1 = template1v1;
                currentTemplateAI = templateAI;
                this.templateInfo1v1 = template1v1;
                this.templateInfoAI = templateAI;
            } catch (error) {
                console.error('加载模板信息失败:', error);
            }
        }
        
        // 所有编程语言配置（按照图片中的顺序，使用从0开始的连续ID）
        // 按照图片中的顺序排列：C++(clang++18)是0，C++(g++13)是1，以此类推
        const allLanguages = [
            { id: 0, name: 'C++ (clang++18)', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 1, name: 'C++(g++ 13)', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 2, name: 'C(gcc 10)', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 3, name: 'Java', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 4, name: 'C', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 5, name: 'Python2', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 6, name: 'Python3', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 7, name: 'pypy2', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 8, name: 'pypy3', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 9, name: 'C#', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 10, name: 'PHP', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 11, name: 'JavaScript V8', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 12, name: 'JavaScript Node', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 13, name: 'R', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 14, name: 'Go', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 15, name: 'Ruby', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 16, name: 'Rust', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 17, name: 'Swift', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 18, name: 'ObjC', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 19, name: 'Pascal', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 20, name: 'matlab', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 21, name: 'bash', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 22, name: 'Scala', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 23, name: 'Kotlin', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 24, name: 'Groovy', maxLength: currentTemplate1v1.maxLength || 10000 },
            { id: 25, name: 'TypeScript', maxLength: currentTemplate1v1.maxLength || 10000 }
        ];
        
        const languages = allLanguages;
        
        // 解析模板代码（可能是JSON字符串或对象）
        let templateCode1v1 = {};
        let templateCodeAI = {};
        
        try {
            if (typeof currentTemplate1v1.templateCode === 'string') {
                templateCode1v1 = JSON.parse(currentTemplate1v1.templateCode) || {};
            } else {
                templateCode1v1 = currentTemplate1v1.templateCode || {};
            }
        } catch (e) {
            console.error('解析1v1模板代码失败:', e);
            templateCode1v1 = {};
        }
        
        try {
            if (typeof currentTemplateAI.templateCode === 'string') {
                templateCodeAI = JSON.parse(currentTemplateAI.templateCode) || {};
            } else {
                templateCodeAI = currentTemplateAI.templateCode || {};
            }
        } catch (e) {
            console.error('解析人机对战模板代码失败:', e);
            templateCodeAI = {};
        }
        
        // templateCode使用数字ID作为key（如 "1", "2", "4"）
        // 确保key是字符串格式，以便正确匹配
        const normalizeTemplateCode = (codeObj) => {
            const normalized = {};
            for (const [key, value] of Object.entries(codeObj || {})) {
                // 支持字符串和数字格式的key
                const numKey = String(key);
                normalized[numKey] = value;
            }
            return normalized;
        };
        
        templateCode1v1 = normalizeTemplateCode(templateCode1v1);
        templateCodeAI = normalizeTemplateCode(templateCodeAI);
        
        // 生成语言下拉框选项
        const languageOptions = languages.map(lang => 
            `<option value="${lang.id}">${lang.name}</option>`
        ).join('');
        
        // 默认选择第一个（C++）
        const defaultLangId = languages[0].id;
        
        const modal = document.createElement('div');
        modal.id = 'battle-template-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:900px;max-height:90vh;overflow-y:auto;">
                <div class="modal-header">
                    <h3>⚙️ 设置初始代码</h3>
                    <button id="battle-template-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div style="margin-bottom: 24px;">
                        <div style="font-size: 14px; color: #666; margin-bottom: 12px;">
                            设置不同编程语言的初始代码模板。在对战开始时，系统会自动加载对应语言的初始代码。
                        </div>
                        <div style="background: linear-gradient(135deg, #fff7e6 0%, #ffecc7 100%); border-left: 4px solid #faad14; padding: 12px 16px; border-radius: 6px; margin-top: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 18px;">⭐</span>
                                <div style="flex: 1;">
                                    <div style="font-size: 13px; color: #666;">
                                        升级后可以获得更大模板长度限额
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 1v1对战模板 -->
                    <div style="margin-bottom: 32px;">
                        <h4 style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #667eea;">
                            ⚔️ 1v1对战模板
                        </h4>
                        <div style="background: #f5f5f5; border-radius: 8px; padding: 12px;">
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px;">选择编程语言</label>
                                <select id="battle-template-lang-select-1v1" 
                                        data-type="1v1"
                                        style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px; background: #fff; cursor: pointer;">
                                    ${languageOptions}
                                </select>
                            </div>
                            <div id="battle-template-editor-container-1v1" style="position: relative;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 12px; color: #999;">最大长度: ${currentTemplate1v1.maxLength || 10000} 字符</span>
                                    <span class="template-char-count" style="font-size: 12px; color: #666;">0 / ${currentTemplate1v1.maxLength || 10000}</span>
                                </div>
                                <textarea id="battle-template-code-editor-1v1" 
                                          class="template-code-editor"
                                          data-type="1v1"
                                          data-max-length="${currentTemplate1v1.maxLength || 10000}"
                                          placeholder="请输入初始代码..."
                                          style="width: 100%; height: 200px; padding: 12px; border: 1px solid #e5e7eb; 
                                                 border-radius: 6px; font-family: 'Courier New', monospace; 
                                                 font-size: 14px; resize: vertical;">${templateCode1v1[String(defaultLangId)] || ''}</textarea>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 人机对战模板 -->
                    <div>
                        <h4 style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #52c41a;">
                            🤖 人机对战模板
                        </h4>
                        <div style="background: #f5f5f5; border-radius: 8px; padding: 12px;">
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px;">选择编程语言</label>
                                <select id="battle-template-lang-select-ai" 
                                        data-type="ai"
                                        style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px; background: #fff; cursor: pointer;">
                                    ${languageOptions}
                                </select>
                            </div>
                            <div id="battle-template-editor-container-ai" style="position: relative;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 12px; color: #999;">最大长度: ${currentTemplateAI.maxLength || 10000} 字符</span>
                                    <span class="template-char-count" style="font-size: 12px; color: #666;">0 / ${currentTemplateAI.maxLength || 10000}</span>
                                </div>
                                <textarea id="battle-template-code-editor-ai" 
                                          class="template-code-editor"
                                          data-type="ai"
                                          data-max-length="${currentTemplateAI.maxLength || 10000}"
                                          placeholder="请输入初始代码..."
                                          style="width: 100%; height: 200px; padding: 12px; border: 1px solid #e5e7eb; 
                                                 border-radius: 6px; font-family: 'Courier New', monospace; 
                                                 font-size: 14px; resize: vertical;">${templateCodeAI[String(defaultLangId)] || ''}</textarea>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;gap:12px;">
                    <button id="battle-template-save" class="admin-btn" style="background:#52c41a;color:#fff;border:1px solid #52c41a;padding:10px 48px;font-size:16px;font-weight:600;">
                        保存设置
                    </button>
                    <button id="battle-template-cancel" class="admin-btn" style="background:#f5f5f5;color:#333;border:1px solid #e5e5e5;padding:10px 24px;">
                        取消
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 绑定事件
        const closeBtn = document.getElementById('battle-template-close');
        const cancelBtn = document.getElementById('battle-template-cancel');
        const saveBtn = document.getElementById('battle-template-save');
        
        const closeModal = () => modal.remove();
        
        // 存储当前选择的语言和对应的代码（用于保存）
        const templateCodeData1v1 = {};
        const templateCodeDataAI = {};
        
        // 初始化：加载当前选择的语言的代码
        const select1v1 = document.getElementById('battle-template-lang-select-1v1');
        const selectAI = document.getElementById('battle-template-lang-select-ai');
        const editor1v1 = document.getElementById('battle-template-code-editor-1v1');
        const editorAI = document.getElementById('battle-template-code-editor-ai');
        
        // 初始化1v1对战的代码数据
        languages.forEach(lang => {
            const langIdStr = String(lang.id);
            templateCodeData1v1[langIdStr] = templateCode1v1[langIdStr] || '';
        });
        
        // 初始化人机对战的代码数据
        languages.forEach(lang => {
            const langIdStr = String(lang.id);
            templateCodeDataAI[langIdStr] = templateCodeAI[langIdStr] || '';
        });
        
        // 语言下拉框切换处理（1v1对战）
        const handleLangChange1v1 = () => {
            const selectedLangId = select1v1.value;
            const langIdStr = String(selectedLangId);
            
            // 保存当前编辑器的内容
            templateCodeData1v1[select1v1.dataset.currentLang || String(defaultLangId)] = editor1v1.value;
            
            // 更新编辑器内容
            editor1v1.value = templateCodeData1v1[langIdStr] || '';
            select1v1.dataset.currentLang = langIdStr;
            
            // 更新字符计数
            this.updateCharCount(editor1v1);
        };
        
        // 语言下拉框切换处理（人机对战）
        const handleLangChangeAI = () => {
            const selectedLangId = selectAI.value;
            const langIdStr = String(selectedLangId);
            
            // 保存当前编辑器的内容
            templateCodeDataAI[selectAI.dataset.currentLang || String(defaultLangId)] = editorAI.value;
            
            // 更新编辑器内容
            editorAI.value = templateCodeDataAI[langIdStr] || '';
            selectAI.dataset.currentLang = langIdStr;
            
            // 更新字符计数
            this.updateCharCount(editorAI);
        };
        
        // 初始化当前语言标记
        select1v1.dataset.currentLang = String(defaultLangId);
        selectAI.dataset.currentLang = String(defaultLangId);
        
        // 绑定下拉框切换事件
        select1v1.addEventListener('change', handleLangChange1v1);
        selectAI.addEventListener('change', handleLangChangeAI);
        
        // 字符计数更新
        [editor1v1, editorAI].forEach(textarea => {
            textarea.addEventListener('input', () => {
                this.updateCharCount(textarea);
            });
            // 初始化字符计数
            this.updateCharCount(textarea);
        });
        
        // 保存设置
        const saveTemplate = async () => {
            try {
                // 保存当前正在编辑的语言代码
                const currentLang1v1 = select1v1.dataset.currentLang || select1v1.value;
                const currentLangAI = selectAI.dataset.currentLang || selectAI.value;
                templateCodeData1v1[currentLang1v1] = editor1v1.value.trim();
                templateCodeDataAI[currentLangAI] = editorAI.value.trim();
                
                // 收集1v1对战的模板代码（使用数字ID作为key，如 "1", "2", "4"）
                const templateCode1v1ToSave = {};
                for (const [langId, code] of Object.entries(templateCodeData1v1)) {
                    if (code && code.trim()) {
                        templateCode1v1ToSave[langId] = code.trim();
                    }
                }
                
                // 收集人机对战的模板代码（使用数字ID作为key）
                const templateCodeAIToSave = {};
                for (const [langId, code] of Object.entries(templateCodeDataAI)) {
                    if (code && code.trim()) {
                        templateCodeAIToSave[langId] = code.trim();
                    }
                }
                
                // 保存1v1对战模板
                await this.api.battleUpdateTemplate(2, JSON.stringify(templateCode1v1ToSave));
                
                // 保存人机对战模板
                await this.api.battleUpdateTemplate(1, JSON.stringify(templateCodeAIToSave));
                
                alert('初始代码设置成功！');
                closeModal();
                
                // 重新加载模板信息
                const [newTemplate1v1, newTemplateAI] = await Promise.all([
                    this.api.battleTemplate(2),
                    this.api.battleTemplate(1)
                ]);
                this.templateInfo1v1 = newTemplate1v1;
                this.templateInfoAI = newTemplateAI;
            } catch (error) {
                console.error('保存模板代码失败:', error);
                alert(`保存失败: ${error.message || '未知错误'}`);
            }
        };
        
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (saveBtn) saveBtn.addEventListener('click', saveTemplate);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
    
    /**
     * 更新字符计数
     */
    updateCharCount(textarea) {
        const maxLength = parseInt(textarea.dataset.maxLength) || 10000;
        const currentLength = textarea.value.length;
        // 查找字符计数元素：在 textarea 的父容器中查找
        const container = textarea.parentElement;
        const charCountEl = container?.querySelector('.template-char-count');
        
        if (charCountEl) {
            charCountEl.textContent = `${currentLength} / ${maxLength}`;
            if (currentLength > maxLength) {
                charCountEl.style.color = '#ff4d4f';
            } else if (currentLength > maxLength * 0.9) {
                charCountEl.style.color = '#faad14';
            } else {
                charCountEl.style.color = '#666';
            }
        }
        
        // 如果超过最大长度，截断
        if (currentLength > maxLength) {
            textarea.value = textarea.value.substring(0, maxLength);
            if (charCountEl) {
                charCountEl.textContent = `${maxLength} / ${maxLength}`;
                charCountEl.style.color = '#ff4d4f';
            }
        }
    }

    /**
     * 渲染说明视图
     */
    renderRulesView() {
        const viewEl = document.getElementById('battle-rules-view');
        if (!viewEl) return;
        
        viewEl.innerHTML = `
            <h2 style="font-size: 20px; color: #333; margin-bottom: 20px;">📖 对战平台说明</h2>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                <h3 style="font-size: 18px; color: #333; margin-bottom: 16px; font-weight: 600;">🎮 玩法介绍</h3>
                <div style="line-height: 1.8; color: #666;">
                    <p style="margin-bottom: 12px;">
                        对战平台是一个实时竞技的算法对战系统。系统会为匹配成功的玩家分配相同的题目，双方需要在规定时间内完成题目。
                    </p>
                    <p style="margin-bottom: 12px;">
                        <strong>对战模式：</strong>
                    </p>
                    <ul style="margin-left: 20px; margin-bottom: 12px;">
                        <li><strong>1v1 匹配：</strong>与实力相近的玩家进行对战</li>
                        <li><strong>人机大战：</strong>与AI对手进行练习对战</li>
                        <li><strong>好友对战：</strong>创建房间邀请好友一起对战</li>
                    </ul>
                    <p>
                        对战开始后，系统会实时更新双方的提交状态。当双方都完成（AC）或放弃后，系统会根据规则自动结算分数。
                    </p>
                </div>
            </div>
            
            <div style="background: #fff7e6; padding: 20px; border-radius: 12px; border: 2px solid #faad14;">
                <h3 style="font-size: 18px; color: #333; margin-bottom: 16px; font-weight: 600;">⚖️ 分数结算规则</h3>
                <p style="color: #666; margin-bottom: 16px; line-height: 1.8;">
                    当两个玩家均完成（AC）或放弃后，系统会根据以下规则结算分数：
                </p>
                
                <!-- 特判规则 -->
                <div style="background: #fff1f0; padding: 16px; border-radius: 8px; border: 1px solid #ffccc7; margin-bottom: 16px;">
                    <div style="font-weight: 600; color: #cf1322; margin-bottom: 8px;">⚠️ 特判规则（惩罚消极比赛）</div>
                    <div style="color: #666; line-height: 1.8;">
                        双方都超时且均未AC/放弃 → <span style="color: #ff4d4f; font-weight: 600;">双方各扣 20 分</span>，<span style="color: #999; font-weight: 600;">0 经验</span>
                        <div style="font-size: 12px; color: #999; margin-top: 4px;">此规则是为了惩罚消极比赛，避免双方都不认真做题，等待对方放弃的情况</div>
                    </div>
                </div>
                
                <!-- 常规规则 -->
                <div style="background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #ffe58f;">
                    <div style="font-weight: 600; color: #333; margin-bottom: 12px;">常规规则</div>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #fafafa; border-bottom: 2px solid #e5e7eb;">
                                <th style="padding: 12px; text-align: left; font-weight: 600; color: #333;">规则</th>
                                <th style="padding: 12px; text-align: left; font-weight: 600; color: #333;">你的状态</th>
                                <th style="padding: 12px; text-align: left; font-weight: 600; color: #333;">对方状态</th>
                                <th style="padding: 12px; text-align: right; font-weight: 600; color: #333;">分数变动</th>
                                <th style="padding: 12px; text-align: right; font-weight: 600; color: #333;">经验变化</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding: 12px; color: #999; font-size: 14px;">规则1</td>
                                <td style="padding: 12px; color: #666;">首先 AC</td>
                                <td style="padding: 12px; color: #666;">后 AC 或放弃（包括对方放弃后你AC）</td>
                                <td style="padding: 12px; text-align: right;">
                                    <div style="color: #52c41a; font-weight: 600;">+15 分</div>
                                    <div style="font-size: 12px; color: #999; margin-top: 4px;">如果在奖励时间内AC，额外+5分</div>
                                </td>
                                <td style="padding: 12px; text-align: right; color: #52c41a; font-weight: 600;">+10 经验</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding: 12px; color: #999; font-size: 14px;">规则2</td>
                                <td style="padding: 12px; color: #666;">对方先 AC 后，你放弃</td>
                                <td style="padding: 12px; color: #666;">先 AC</td>
                                <td style="padding: 12px; text-align: right; color: #ff4d4f; font-weight: 600;">-12 分</td>
                                <td style="padding: 12px; text-align: right; color: #999; font-weight: 600;">0 经验</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding: 12px; color: #999; font-size: 14px;">规则3</td>
                                <td style="padding: 12px; color: #666;">对方先 AC 后，你后 AC</td>
                                <td style="padding: 12px; color: #666;">先 AC</td>
                                <td style="padding: 12px; text-align: right;">
                                    <div style="color: #ff4d4f; font-weight: 600;">-2 分</div>
                                    <div style="font-size: 12px; color: #999; margin-top: 4px;">如果在奖励时间内AC，额外+5分</div>
                                </td>
                                <td style="padding: 12px; text-align: right; color: #faad14; font-weight: 600;">+5 经验</td>
                            </tr>
                           
                            <tr style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding: 12px; color: #999; font-size: 14px;">规则4</td>
                                <td style="padding: 12px; color: #666;">对方 AC/放弃之前，你先放弃</td>
                                <td style="padding: 12px; color: #666;">未 AC 且未放弃，或后完成</td>
                                <td style="padding: 12px; text-align: right; color: #ff4d4f; font-weight: 600;">-15 分</td>
                                <td style="padding: 12px; text-align: right; color: #999; font-weight: 600;">0 经验</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px; color: #999; font-size: 14px;">规则5</td>
                                <td style="padding: 12px; color: #666;">对方放弃后，你放弃</td>
                                <td style="padding: 12px; color: #666;">先放弃（未 AC）</td>
                                <td style="padding: 12px; text-align: right; color: #52c41a; font-weight: 600;">+2 分</td>
                                <td style="padding: 12px; text-align: right; color: #999; font-weight: 600;">0 经验</td>
                            </tr>
                            <tr style="background: #f6ffed;">
                                <td colspan="5" style="padding: 8px 12px; font-size: 12px; color: #999; font-style: italic;">
                                    💡 规则3和5说明：鼓励失败后的顽强拼搏。同时，这也避免了对方放弃了你不会做的题时，你获得过多加分的情况。
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div style="background: #e6f7ff; padding: 20px; border-radius: 12px; margin-top: 24px; border: 2px solid #91d5ff;">
                <h3 style="font-size: 18px; color: #333; margin-bottom: 16px; font-weight: 600;">💡 温馨提示</h3>
                <ul style="line-height: 1.8; color: #666; margin-left: 20px;">
                    <li>匹配成功后，系统会为双方分配相同的题目</li>
                    <li>对战开始前会有5秒倒计时，请做好准备</li>
                    <li>系统会实时显示对方的提交状态（AC、WA、TLE等）</li>
                    <li>如果60秒内没有心跳，系统会自动判定为放弃。请不要关闭房间页面，否则也视为放弃对战。请务必保持网络畅通的环境下进行对战</li>
                    <li>分数变动会影响你的等级分，等级分用于匹配实力相近的对手</li>
                </ul>
            </div>
        `;
    }

    /**
     * 渲染对战历史视图
     */
    renderHistoryView() {
        const viewEl = document.getElementById('battle-history-view');
        if (!viewEl) return;
        
        viewEl.innerHTML = `
            <h2 style="font-size: 20px; color: #333; margin-bottom: 20px;">📋 对战历史</h2>
            
            <!-- 类型切换 -->
            <div style="margin-bottom: 20px; display: flex; gap: 12px;">
                <button id="battle-records-type-1v1" 
                        class="battle-records-type-btn"
                        data-type="2"
                        style="padding: 8px 20px; border: 2px solid ${this.recordsType === 2 ? '#667eea' : '#ddd'}; 
                               background: ${this.recordsType === 2 ? '#667eea' : '#fff'}; 
                               color: ${this.recordsType === 2 ? '#fff' : '#666'}; 
                               border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;
                               transition: all 0.2s;">
                    1v1对战
                </button>
                <button id="battle-records-type-ai" 
                        class="battle-records-type-btn"
                        data-type="1"
                        style="padding: 8px 20px; border: 2px solid ${this.recordsType === 1 ? '#667eea' : '#ddd'}; 
                               background: ${this.recordsType === 1 ? '#667eea' : '#fff'}; 
                               color: ${this.recordsType === 1 ? '#fff' : '#666'}; 
                               border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;
                               transition: all 0.2s;">
                    人机对战
                </button>
            </div>
            
            <div id="battle-records-list" style="background: #fff; border-radius: 12px; overflow: hidden;">
                <div id="battle-records-tbody" style="min-height: 200px;">
                    <!-- 记录列表将在这里渲染 -->
                </div>
                <div id="battle-records-pagination" class="pagination" style="padding: 16px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <!-- 分页控件将在这里渲染 -->
                </div>
            </div>
        `;

        // 绑定类型切换事件
        const type1v1Btn = document.getElementById('battle-records-type-1v1');
        const typeAiBtn = document.getElementById('battle-records-type-ai');
        if (type1v1Btn) {
            type1v1Btn.addEventListener('click', () => {
                this.recordsType = 2;
                this.recordsPage = 1;
                this.renderHistoryView();
            });
        }
        if (typeAiBtn) {
            typeAiBtn.addEventListener('click', () => {
                this.recordsType = 1;
                this.recordsPage = 1;
                this.renderHistoryView();
            });
        }

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
            btn.textContent = mode === 'ai' ? '创建中...' : '匹配中...';
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
        }
        
        try {
            if (mode === 'ai') {
                // 人机对战：直接调用 match-ai 接口，不需要匹配和轮询
                // rankScore 由后端自动获取，避免用户传递错误的rankScore
                const result = await this.api.battleMatchAI();
                
                // 检查是否已在房间中
                if (result.alreadyInRoom && result.roomId) {
                    // 如果有startTime，说明已在对战中
                    const isInBattle = !!result.startTime;
                    this.showAlreadyInRoomModal(result.roomId, isInBattle);
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = '开始对战';
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                    }
                    return;
                }
                
                if (result.matched && result.roomId) {
                    // 人机对战直接成功，显示结果
                    this.showMatchResult(result);
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = '开始对战';
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                    }
                } else {
                    throw new Error('创建人机对战房间失败');
                }
                return; // 人机对战成功，直接返回
            } else {
                // 1v1匹配：需要匹配和轮询
        // 显示等待提示框
        this.showMatchingModal();
        
            // rankScore 由后端自动获取，避免用户传递错误的rankScore
            const result = await this.api.battleMatch('1v1');
            
                // 检查是否已在房间中
                if (result.alreadyInRoom && result.roomId) {
                    this.hideMatchingModal();
                    // 如果有startTime，说明已在对战中
                    const isInBattle = !!result.startTime;
                    this.showAlreadyInRoomModal(result.roomId, isInBattle);
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = '开始匹配';
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                    }
                    return;
                }
            
                if (result.matched && result.roomId) {
                // 立即匹配成功
                this.hideMatchingModal();
                this.showMatchResult(result);
                    if (btn) {
                btn.disabled = false;
                        btn.textContent = '开始匹配';
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                    }
            } else {
                // 未匹配成功，开始轮询
                this.startPolling();
                }
            }
        } catch (error) {
            console.error('操作失败:', error);
            // 只有1v1匹配时才需要隐藏匹配等待框
            if (mode === '1v1') {
            this.hideMatchingModal();
            }
            alert(`${mode === 'ai' ? '创建' : '匹配'}失败: ${error.message || '未知错误'}`);
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
            // 生成房间码：随机数字+用户ID+时间戳
            const randomNum = Math.floor(1000 + Math.random() * 9000); // 4位随机数
            const userId = this.state.loggedInUserId || '0';
            const timestamp = Date.now().toString().slice(-6); // 时间戳后6位
            const roomCode = `${randomNum}${userId}${timestamp}`;
            
            // 调用后端API创建房间
            const result = await this.api.battleCreateRoom(roomCode);
            
            // 检查是否已在房间中
            if (result.alreadyInRoom && result.roomId) {
                // 如果房间还在等待中（有roomCode且没有startTime），显示确认对话框
                if (result.roomCode && !result.startTime) {
                    // 房间还在等待中，询问是否返回房间
                    if (confirm('您已创建房间，是否返回房间？')) {
                        this.roomId = result.roomId;
                        this.roomCode = result.roomCode;
                        this.roomMode = 'friend';
                        this.showRoomCreatedModal(result.roomId, result.roomCode, 'waiting');
                        // 开始轮询检查是否有人加入
                        this.startRoomPolling(result.roomId, result.roomCode);
                    }
                } else {
                    // 房间已开始（有startTime），显示"已经在对战"对话框
                    this.showAlreadyInRoomModal(result.roomId, true);
                }
                return;
            }
            
            if (result.success && result.roomId && result.roomCode) {
                this.roomId = result.roomId;
                this.roomCode = result.roomCode;
                this.roomMode = 'friend';
                this.showRoomCreatedModal(result.roomId, result.roomCode);
                // 开始轮询检查是否有人加入
                this.startRoomPolling(result.roomId, result.roomCode);
            } else {
                throw new Error(result.message || '创建房间失败');
            }
        } catch (error) {
            console.error('创建房间失败:', error);
            alert(`创建房间失败: ${error.message || '未知错误'}`);
        }
    }

    /**
     * 显示房间创建成功模态框
     */
    showRoomCreatedModal(roomId, roomCode, roomStatus = 'waiting') {
        const existing = document.getElementById('battle-room-created-modal');
        if (existing) existing.remove();
        
        // 根据房间状态决定显示什么按钮
        const isWaiting = roomStatus === 'waiting';
        const startTime = null; // 等待加入时没有startTime
        
        const modal = document.createElement('div');
        modal.id = 'battle-room-created-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <div class="modal-header">
                    <h3>${isWaiting ? '房间创建成功！' : '有人加入房间！'}</h3>
                    <button id="battle-room-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:48px;margin-bottom:12px;">${isWaiting ? '🎉' : '🎮'}</div>
                        <div style="font-size:18px;font-weight:600;color:#333;margin-bottom:8px;">
                            ${isWaiting ? '房间已创建' : '对战即将开始'}
                        </div>
                        ${!isWaiting ? `
                            <div id="battle-room-countdown-container" style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;">
                                <div id="battle-room-countdown-text" style="font-size:16px;font-weight:600;color:#667eea;">
                                    对战即将开始，<span id="battle-room-countdown-seconds">--</span>秒
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div style="background:#f5f5f5;padding:16px;border-radius:6px;margin-bottom:16px;">
                        <div style="margin-bottom:8px;">
                            <strong>房间码:</strong> 
                            <code style="background:#fff;padding:4px 8px;border-radius:3px;font-family:monospace;font-size:20px;font-weight:bold;color:#667eea;">${roomCode}</code>
                        </div>
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;">
                            <div style="font-size:14px;color:#666;margin-bottom:8px;">
                                ${isWaiting ? '分享房间码给好友，让他们加入对战吧！' : '房间已满，准备开始对战！'}
                            </div>
                            <button id="battle-copy-room-code" style="width:100%;background:#667eea;color:#fff;border:none;padding:10px;border-radius:6px;cursor:pointer;font-size:14px;">
                                复制房间码
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;gap:12px;">
                    ${isWaiting ? `
                        <button id="battle-room-disband" class="admin-btn" style="background:#ff4d4f;color:#fff;border:1px solid #ff4d4f;padding:10px 24px;">
                            解散房间
                        </button>
                    ` : `
                        <button id="battle-room-enter" 
                                class="admin-btn" 
                                disabled
                                style="background:#d9d9d9;color:#fff;border:1px solid #d9d9d9;padding:10px 24px;cursor:not-allowed;opacity:0.6;">
                            进入对战
                        </button>
                    `}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 绑定事件
        const closeBtn = document.getElementById('battle-room-close');
        const enterBtn = document.getElementById('battle-room-enter');
        const disbandBtn = document.getElementById('battle-room-disband');
        const copyBtn = document.getElementById('battle-copy-room-code');
        
        const closeModal = () => {
            this.stopRoomPolling();
            this.stopRoomCountdown();
            this.roomCreatedModal = null;
            this.roomCreatedModalData = null;
            modal.remove();
        };
        const enterRoom = () => {
            if (roomId) {
                // 自定义房间使用 battleType=2
                window.open(getBattleUrl(roomId, 2), '_blank');
            }
            closeModal();
        };
        const disbandRoom = async () => {
            if (!confirm('确认解散房间？')) return;
            try {
                await this.api.battleDisbandRoom(roomCode);
                alert('房间已解散');
                closeModal();
            } catch (error) {
                console.error('解散房间失败:', error);
                alert(`解散房间失败: ${error.message || '未知错误'}`);
            }
        };
        const copyRoomCode = () => {
            navigator.clipboard.writeText(roomCode).then(() => {
                copyBtn.textContent = '已复制！';
                setTimeout(() => {
                    copyBtn.textContent = '复制房间码';
                }, 2000);
            });
        };
        
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (enterBtn) {
            enterBtn.addEventListener('click', enterRoom);
            enterBtn.dataset.roomId = roomId;
        }
        if (disbandBtn) disbandBtn.addEventListener('click', disbandRoom);
        if (copyBtn) copyBtn.addEventListener('click', copyRoomCode);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // 存储modal引用，以便后续更新
        this.roomCreatedModal = modal;
        this.roomCreatedModalData = { roomId, roomCode, roomStatus };
    }
    
    /**
     * 更新房间创建模态框（当有人加入时）
     */
    updateRoomCreatedModal(result) {
        if (!this.roomCreatedModal || !this.roomCreatedModalData) return;
        
        const { roomId, roomCode } = this.roomCreatedModalData;
        const startTime = result.startTime ? (result.startTime > 1000000000000 ? result.startTime : result.startTime * 1000) : null;
        
        // 更新模态框内容
        const modal = this.roomCreatedModal;
        const modalActions = modal.querySelector('.modal-actions');
        if (modalActions) {
            modalActions.innerHTML = `
                <button id="battle-room-enter" 
                        class="admin-btn" 
                        disabled
                        style="background:#d9d9d9;color:#fff;border:1px solid #d9d9d9;padding:10px 24px;cursor:not-allowed;opacity:0.6;">
                    进入对战
                </button>
            `;
            
            const enterBtn = document.getElementById('battle-room-enter');
            if (enterBtn) {
                enterBtn.addEventListener('click', () => {
                    if (roomId) {
                        // 自定义房间使用 battleType=2
                        window.open(getBattleUrl(roomId, 2), '_blank');
                    }
                    this.stopRoomPolling();
                    modal.remove();
                });
                enterBtn.dataset.roomId = roomId;
            }
        }
        
        // 更新标题和内容
        const header = modal.querySelector('.modal-header h3');
        if (header) header.textContent = '有人加入房间！';
        
        const emoji = modal.querySelector('.modal-body > div > div:first-child');
        if (emoji) emoji.textContent = '🎮';
        
        const title = modal.querySelector('.modal-body > div > div:nth-child(2)');
        if (title) title.textContent = '对战即将开始';
        
        // 添加倒计时
        const body = modal.querySelector('.modal-body > div');
        if (body && !body.querySelector('#battle-room-countdown-container')) {
            const countdownHtml = `
                <div id="battle-room-countdown-container" style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;">
                    <div id="battle-room-countdown-text" style="font-size:16px;font-weight:600;color:#667eea;">
                        对战即将开始，<span id="battle-room-countdown-seconds">--</span>秒
                    </div>
                </div>
            `;
            title.insertAdjacentHTML('afterend', countdownHtml);
        }
        
        // 更新提示文字
        const tip = modal.querySelector('.modal-body > div:last-child > div:last-child');
        if (tip) tip.textContent = '房间已满，准备开始对战！';
        
        // 更新状态并启动倒计时
        this.roomCreatedModalData.roomStatus = 'started';
        if (startTime) {
            this.startRoomCountdown(startTime, enterBtn, { roomId });
        }
    }
    
    /**
     * 开始房间轮询（检查是否有人加入）
     */
    startRoomPolling(roomId, roomCode) {
        this.stopRoomPolling();
        
        this.roomPollingInterval = setInterval(async () => {
            try {
                // 轮询检查房间状态（通过poll接口）
                const result = await this.api.battlePoll();
                if (result.matched && result.roomId === roomId) {
                    // 房间已开始（有人加入）
                    this.stopRoomPolling();
                    this.updateRoomCreatedModal(result);
                }
            } catch (error) {
                console.error('轮询房间状态失败:', error);
            }
        }, 2000);
    }
    
    /**
     * 停止房间轮询
     */
    stopRoomPolling() {
        if (this.roomPollingInterval) {
            clearInterval(this.roomPollingInterval);
            this.roomPollingInterval = null;
        }
    }
    
    /**
     * 启动房间倒计时
     */
    startRoomCountdown(startTime, enterBtn, result) {
        this.stopRoomCountdown();
        
        const updateCountdown = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((startTime - now) / 1000));
            const countdownEl = document.getElementById('battle-room-countdown-seconds');
            
            if (countdownEl) {
                if (remaining > 0) {
                    countdownEl.textContent = remaining;
                } else {
                    // 倒计时结束，启用按钮
                    countdownEl.textContent = '0';
                    if (enterBtn) {
                        enterBtn.disabled = false;
                        enterBtn.style.background = '#52c41a';
                        enterBtn.style.borderColor = '#52c41a';
                        enterBtn.style.cursor = 'pointer';
                        enterBtn.style.opacity = '1';
                    }
                    this.stopRoomCountdown();
                }
            }
        };
        
        updateCountdown();
        this.roomCountdownInterval = setInterval(updateCountdown, 1000);
    }
    
    /**
     * 停止房间倒计时
     */
    stopRoomCountdown() {
        if (this.roomCountdownInterval) {
            clearInterval(this.roomCountdownInterval);
            this.roomCountdownInterval = null;
        }
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
                        <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">房间码</label>
                        <input id="battle-room-code-input" type="text" placeholder="请输入房间码" 
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
        const input = document.getElementById('battle-room-code-input');
        
        const closeModal = () => modal.remove();
        const joinRoom = async () => {
            const roomCode = input?.value?.trim();
            if (!roomCode) {
                alert('请输入房间码');
                return;
            }
            
            try {
                // 调用后端API加入房间
                const result = await this.api.battleJoinRoom(roomCode);
                
                // 检查是否已在房间中
                if (result.alreadyInRoom && result.roomId) {
                    modal.remove();
                    // 如果房间还在等待中（有roomCode且没有startTime），显示确认对话框
                    if (result.roomCode && !result.startTime) {
                        // 房间还在等待中，询问是否返回房间
                        if (confirm('您已创建房间，是否返回房间？')) {
                            this.roomId = result.roomId;
                            this.roomCode = result.roomCode;
                            this.roomMode = 'friend';
                            this.showRoomCreatedModal(result.roomId, result.roomCode, 'waiting');
                            // 开始轮询检查是否有人加入
                            this.startRoomPolling(result.roomId, result.roomCode);
                        }
                    } else {
                        // 房间已开始（有startTime），显示"已经在对战"对话框
                        this.showAlreadyInRoomModal(result.roomId, true);
                    }
                    return;
                }
                
                if (result.success && result.roomId) {
                    // 加入成功，显示加入成功结果（5秒倒计时后可以进入对战）
                    modal.remove();
                    this.showJoinRoomSuccessModal({
                        roomId: result.roomId,
                        problemId: result.problemId,
                        startTime: result.startTime,
                        opponentId: result.opponentId
                    });
                } else {
                    alert(result.message || '加入房间失败');
                }
            } catch (error) {
                console.error('加入房间失败:', error);
                alert(`加入房间失败: ${error.message || '未知错误'}`);
            }
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
     * 显示已在房间中的提示框
     * @param {string} roomId - 房间ID
     * @param {boolean} isInBattle - 是否在对战中（有startTime）
     */
    showAlreadyInRoomModal(roomId, isInBattle = false) {
        const existing = document.getElementById('battle-already-in-room-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'battle-already-in-room-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:450px;">
                <div class="modal-header">
                    <h3>${isInBattle ? '检测到已在对战' : '检测到已在房间中'}</h3>
                    <button id="battle-already-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
                        <div style="font-size:18px;font-weight:600;color:#333;margin-bottom:8px;">
                            ${isInBattle ? '你已经在对战中' : '检测到你已经在房间中'}
                        </div>
                        <div style="font-size:14px;color:#666;margin-top:8px;">
                            ${isInBattle ? '你当前有一个正在进行的对战' : '你当前有一个正在进行的对战房间'}
                        </div>
                    </div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;">
                    <button id="battle-already-return" 
                            class="admin-btn" 
                            style="background:#52c41a;color:#fff;border:1px solid #52c41a;padding:10px 48px;cursor:pointer;font-size:16px;font-weight:600;">
                        ${isInBattle ? '返回对战' : '返回房间'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const closeBtn = document.getElementById('battle-already-close');
        const returnBtn = document.getElementById('battle-already-return');
        
        const closeModal = () => modal.remove();
        const returnToRoom = () => {
            if (roomId) {
                // 根据 roomMode 判断 battleType：ai=1，其他=2
                const battleType = this.roomMode === 'ai' ? 1 : 2;
                window.open(getBattleUrl(roomId, battleType), '_blank');
            }
            closeModal();
        };
        
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (returnBtn) returnBtn.addEventListener('click', returnToRoom);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    /**
     * 显示加入房间成功模态框
     */
    showJoinRoomSuccessModal(result) {
        const existing = document.getElementById('battle-join-room-success-modal');
        if (existing) existing.remove();
        
        const roomId = result.roomId;
        const startTime = result.startTime ? (result.startTime > 1000000000000 ? result.startTime : result.startTime * 1000) : null;
        const canEnterNow = !startTime || Date.now() >= startTime;
        
        const modal = document.createElement('div');
        modal.id = 'battle-join-room-success-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <div class="modal-header">
                    <h3>加入房间成功！</h3>
                    <button id="battle-join-success-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:48px;margin-bottom:12px;">🎉</div>
                        <div style="font-size:18px;font-weight:600;color:#333;margin-bottom:8px;">
                            成功加入房间
                        </div>
                        ${startTime && !canEnterNow ? `
                            <div id="battle-join-countdown-container" style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;">
                                <div id="battle-join-countdown-text" style="font-size:16px;font-weight:600;color:#667eea;">
                                    对战即将开始，<span id="battle-join-countdown-seconds">--</span>秒
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;">
                    <button id="battle-join-success-enter" 
                            class="admin-btn" 
                            ${canEnterNow ? '' : 'disabled'}
                            style="background:${canEnterNow ? '#52c41a' : '#d9d9d9'};color:#fff;border:1px solid ${canEnterNow ? '#52c41a' : '#d9d9d9'};padding:10px 48px;cursor:${canEnterNow ? 'pointer' : 'not-allowed'};opacity:${canEnterNow ? '1' : '0.6'};font-size:16px;font-weight:600;">
                        进入对战
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const closeBtn = document.getElementById('battle-join-success-close');
        const enterBtn = document.getElementById('battle-join-success-enter');
        
        const closeModal = () => {
            this.stopJoinRoomCountdown();
            modal.remove();
        };
        const enterRoom = () => {
            // 检查按钮是否被禁用，如果禁用则不执行
            if (enterBtn && enterBtn.disabled) {
                return;
            }
            if (roomId) {
                // 加入自定义房间使用 battleType=2
                window.open(getBattleUrl(roomId, 2), '_blank');
            }
            closeModal();
        };
        
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (enterBtn) {
            enterBtn.addEventListener('click', enterRoom);
            enterBtn.dataset.roomId = roomId;
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // 如果有startTime且还未到时间，启动倒计时
        if (startTime && !canEnterNow) {
            this.startJoinRoomCountdown(startTime, enterBtn, result);
        }
    }
    
    /**
     * 启动加入房间倒计时
     */
    startJoinRoomCountdown(startTime, enterBtn, result) {
        this.stopJoinRoomCountdown();
        
        const updateCountdown = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((startTime - now) / 1000));
            const countdownEl = document.getElementById('battle-join-countdown-seconds');
            
            if (countdownEl) {
                if (remaining > 0) {
                    countdownEl.textContent = remaining;
                } else {
                    // 倒计时结束，启用按钮
                    countdownEl.textContent = '0';
                    if (enterBtn) {
                        enterBtn.disabled = false;
                        enterBtn.style.background = '#52c41a';
                        enterBtn.style.borderColor = '#52c41a';
                        enterBtn.style.cursor = 'pointer';
                        enterBtn.style.opacity = '1';
                    }
                    this.stopJoinRoomCountdown();
                }
            }
        };
        
        updateCountdown();
        this.joinRoomCountdownInterval = setInterval(updateCountdown, 1000);
    }
    
    /**
     * 停止加入房间倒计时
     */
    stopJoinRoomCountdown() {
        if (this.joinRoomCountdownInterval) {
            clearInterval(this.joinRoomCountdownInterval);
            this.joinRoomCountdownInterval = null;
        }
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
                // 检查是否已在房间中
                if (result.alreadyInRoom && result.roomId) {
                    this.hideMatchingModal();
                    // 如果有startTime，说明已在对战中
                    const isInBattle = !!result.startTime;
                    this.showAlreadyInRoomModal(result.roomId, isInBattle);
                    
                    const mode = this.roomMode === '1v1' ? '1v1' : 'ai';
                    const btn = document.getElementById(`battle-${mode}-btn`);
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = mode === '1v1' ? '开始匹配' : '开始对战';
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                    }
                    this.stopPolling();
                    return;
                }
                
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
                    this.stopPolling();
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
        
        // 停止之前的倒计时
        this.stopCountdown();
        
        // 判断是否是人机对战
        const isAIMode = this.roomMode === 'ai';
        
        // 解析开始时间（startTime 是时间戳，单位可能是秒或毫秒）
        const startTime = result.startTime ? (result.startTime > 1000000000000 ? result.startTime : result.startTime * 1000) : null;
        const canEnterNow = !startTime || Date.now() >= startTime;
        
        // 人机对战：固定5秒倒计时
        const aiCountdownTime = isAIMode ? Date.now() + 5000 : null;
        const aiCanEnterNow = isAIMode ? false : canEnterNow;
        
        const modal = document.createElement('div');
        modal.id = 'battle-match-result-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <div class="modal-header">
                    <h3>${isAIMode ? '正在生成AI对手' : '匹配成功！'}</h3>
                    <button id="battle-result-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:48px;margin-bottom:12px;">${isAIMode ? '🤖' : '🎉'}</div>
                        <div style="font-size:18px;font-weight:600;color:#333;margin-bottom:8px;">
                            ${isAIMode ? '正在生成和你旗鼓相当的AI' : '匹配成功'}
                    </div>
                    </div>
                    <div style="background:#f5f5f5;padding:16px;border-radius:6px;margin-bottom:16px;">
                        ${result.opponentId && !isAIMode ? `
                            <div style="margin-bottom:8px;">
                                <strong>对手ID:</strong> ${result.opponentId}
                            </div>
                        ` : ''}
                        ${isAIMode ? `
                            <div id="battle-countdown-container" style="margin-top:${result.opponentId ? '12px' : '0'};padding-top:${result.opponentId ? '12px' : '0'};border-top:${result.opponentId ? '1px solid #e5e7eb' : 'none'};text-align:center;">
                                <div id="battle-countdown-text" style="font-size:16px;font-weight:600;color:#667eea;">
                                    AI生成中，<span id="battle-countdown-seconds">5</span>秒后可以开始对战
                                </div>
                            </div>
                        ` : startTime ? `
                            <div id="battle-countdown-container" style="margin-top:${result.opponentId ? '12px' : '0'};padding-top:${result.opponentId ? '12px' : '0'};border-top:${result.opponentId ? '1px solid #e5e7eb' : 'none'};text-align:center;">
                                <div id="battle-countdown-text" style="font-size:16px;font-weight:600;color:#667eea;">
                                    对战即将开始，<span id="battle-countdown-seconds">--</span>秒
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;">
                    <button id="battle-result-enter" 
                            class="admin-btn" 
                            ${aiCanEnterNow ? '' : 'disabled'}
                            style="background:${aiCanEnterNow ? '#52c41a' : '#d9d9d9'};color:#fff;border:1px solid ${aiCanEnterNow ? '#52c41a' : '#d9d9d9'};padding:10px 48px;cursor:${aiCanEnterNow ? 'pointer' : 'not-allowed'};opacity:${aiCanEnterNow ? '1' : '0.6'};font-size:16px;font-weight:600;">
                        开始对战
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const closeBtn = document.getElementById('battle-result-close');
        const enterBtn = document.getElementById('battle-result-enter');
        
        const closeResult = () => {
            this.stopCountdown();
            modal.remove();
        };
        
        const enterRoom = () => {
            // 检查按钮是否被禁用，如果禁用则不执行
            if (enterBtn && enterBtn.disabled) {
                return;
            }
            if (result.roomId) {
                // 根据 isAIMode 判断：人机对战=1，1v1匹配=2
                const battleType = isAIMode ? 1 : 2;
                window.open(getBattleUrl(result.roomId, battleType), '_blank');
            }
            closeResult();
        };
        
        if (closeBtn) closeBtn.addEventListener('click', closeResult);
        if (enterBtn) {
            enterBtn.addEventListener('click', enterRoom);
            // 存储 result 到按钮上，以便倒计时结束后使用
            enterBtn.dataset.roomId = result.roomId;
            // 存储 enterRoom 函数引用，以便倒计时结束后可以直接调用
            enterBtn.dataset.result = JSON.stringify(result);
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeResult();
        });
        
        // 人机对战：固定5秒倒计时
        if (isAIMode && aiCountdownTime) {
            this.startAICountdown(aiCountdownTime, enterBtn, result);
        } else if (startTime && !canEnterNow) {
            // 1v1匹配：使用实际的startTime倒计时
            this.startCountdown(startTime, enterBtn, result);
        }
    }

    /**
     * 启动人机对战倒计时（固定5秒）
     */
    startAICountdown(targetTime, enterBtn, result) {
        this.stopCountdown();
        
        const updateCountdown = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((targetTime - now) / 1000));
            const countdownEl = document.getElementById('battle-countdown-seconds');
            const countdownText = document.getElementById('battle-countdown-text');
            
            if (countdownEl && countdownText) {
                if (remaining > 0) {
                    countdownEl.textContent = remaining;
                } else {
                    // 倒计时结束，显示成功并启用按钮
                    countdownEl.textContent = '0';
                    countdownText.innerHTML = '<span style="color:#52c41a;">✅ AI已生成，可以开始对战了！</span>';
                    
                    if (enterBtn) {
                        enterBtn.disabled = false;
                        enterBtn.style.background = '#52c41a';
                        enterBtn.style.borderColor = '#52c41a';
                        enterBtn.style.cursor = 'pointer';
                        enterBtn.style.opacity = '1';
                        // 不需要重新设置onclick，原有的addEventListener事件处理函数会继续工作
                    }
                    
                    // 停止倒计时
                    this.stopCountdown();
                }
            }
        };
        
        // 立即更新一次
        updateCountdown();
        
        // 每秒更新一次
        this.countdownTimer = setInterval(updateCountdown, 1000);
    }

    /**
     * 启动倒计时
     */
    startCountdown(startTime, enterBtn, result) {
        this.stopCountdown();
        
        const updateCountdown = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((startTime - now) / 1000));
            const countdownEl = document.getElementById('battle-countdown-seconds');
            
            if (countdownEl) {
                if (remaining > 0) {
                    countdownEl.textContent = remaining;
                } else {
                    // 倒计时结束，启用按钮
                    countdownEl.textContent = '0';
                    if (enterBtn) {
                        enterBtn.disabled = false;
                        enterBtn.style.background = '#52c41a';
                        enterBtn.style.borderColor = '#52c41a';
                        enterBtn.style.cursor = 'pointer';
                        enterBtn.style.opacity = '1';
                        // 不需要重新设置onclick，原有的addEventListener事件处理函数会继续工作
                    }
                    
                    // 更新倒计时文本
                    const container = document.getElementById('battle-countdown-container');
                    if (container) {
                        container.innerHTML = '<div style="font-size:16px;font-weight:600;color:#52c41a;">✅ 对战已开始，可以进入房间了！</div>';
                    }
                    
                    // 停止倒计时
                    this.stopCountdown();
                }
            }
        };
        
        // 立即更新一次
        updateCountdown();
        
        // 每秒更新一次
        this.countdownTimer = setInterval(updateCountdown, 1000);
    }

    /**
     * 停止倒计时
     */
    stopCountdown() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
        // 同时停止房间倒计时
        this.stopRoomCountdown();
    }

    /**
     * 加载对战记录列表
     */
    async loadRecordsList() {
        const tbody = document.getElementById('battle-records-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">加载中...</div>';
        
        try {
            const result = await this.api.battleRecordList(this.recordsType, this.recordsPage, this.recordsLimit);
            
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
            // 格式化时间
            const createTime = record.createTime ? new Date(record.createTime).toLocaleString('zh-CN') : '-';
            const startTime = record.startTime ? new Date(record.startTime).toLocaleString('zh-CN') : '-';
            
            // 格式化AC时间
            const formatAcTime = (acTime) => {
                if (!acTime || acTime === 0) return '-';
                const seconds = Math.floor(acTime / 1000);
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                return `${minutes}分${secs}秒`;
            };
            
            // 我的状态
            const myAc = record.myAc || false;
            const myAcTime = record.myAcTime || 0;
            const myAbandoned = record.myAbandoned || false;
            const myScoreChange = record.myScoreChange || 0;
            const isWin = record.isWin || false;
            
            // 对手信息
            const opponent = record.opponent || {};
            const opponentName = opponent.name || (this.recordsType === 1 ? 'AI' : '未知');
            const opponentAc = opponent.ac || false;
            const opponentAcTime = opponent.acTime || 0;
            const opponentAbandoned = opponent.abandoned || false;
            
            // 分数变化颜色
            const scoreChangeColor = myScoreChange > 0 ? '#52c41a' : myScoreChange < 0 ? '#ff4d4f' : '#666';
            const scoreChangeText = myScoreChange > 0 ? `+${myScoreChange}` : `${myScoreChange}`;
            
            // 结果文本
            let resultText = '';
            let resultColor = '#666';
            if (myAbandoned) {
                resultText = '放弃';
                resultColor = '#ff4d4f';
            } else if (myAc) {
                resultText = isWin ? '胜利' : '失败';
                resultColor = isWin ? '#52c41a' : '#ff4d4f';
            } else {
                resultText = '未完成';
                resultColor = '#999';
            }
            
            return `
                <div class="battle-record-item" 
                     data-record-id="${record.id}" 
                     style="padding: 16px 20px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;"
                     onmouseover="this.style.background='#f5f5f5'"
                     onmouseout="this.style.background='#fff'">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                <span style="font-size: 16px; font-weight: 600; color: #333;">
                                    题目 #${record.problemId || '-'}
                                </span>
                                <span style="padding: 2px 8px; background: ${resultColor}; color: #fff; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                    ${resultText}
                                </span>
                                <span style="color: ${scoreChangeColor}; font-weight: 600; font-size: 14px;">
                                    ${scoreChangeText}
                                </span>
                            </div>
                            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">
                                对手: ${opponentName} | 
                                我的状态: ${myAc ? `✅ AC (${formatAcTime(myAcTime)})` : myAbandoned ? '❌ 放弃' : '⏳ 进行中'} | 
                                对手状态: ${opponentAc ? `✅ AC (${formatAcTime(opponentAcTime)})` : opponentAbandoned ? '❌ 放弃' : '⏳ 进行中'}
                            </div>
                            <div style="font-size: 12px; color: #999;">
                                开始时间: ${startTime} | 创建时间: ${createTime}
                            </div>
                        </div>
                        <div>
                            <button class="view-record-btn" 
                                    data-record-id="${record.id}"
                                    style="background: #667eea; color: #fff; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; white-space: nowrap;">
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
        // 从当前列表中查找记录
        const record = this.recordsList.find(r => r.id == recordId);
        
        if (!record) {
            alert('未找到对战记录');
            return;
        }
        
        this.showRecordDetailModal(record);
    }

    /**
     * 显示对战记录详情模态框
     */
    showRecordDetailModal(record) {
        const existing = document.getElementById('battle-record-detail-modal');
        if (existing) existing.remove();
        
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
                    ${this.renderRecordDetailContent(record)}
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
    renderRecordDetailContent(record) {
        // 格式化时间
        const formatTime = (timestamp) => {
            if (!timestamp) return '-';
            return new Date(timestamp).toLocaleString('zh-CN');
        };
        
        const formatAcTime = (acTime) => {
            if (!acTime || acTime === 0) return '-';
            const seconds = Math.floor(acTime / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}分${secs}秒`;
        };
        
        // 对战类型
        const typeText = record.type === 1 ? '人机对战' : record.type === 2 ? '1v1对战' : '未知';
        
        // 我的信息
        const myAc = record.myAc || false;
        const myAcTime = record.myAcTime || 0;
        const myAbandoned = record.myAbandoned || false;
        const myScoreChange = record.myScoreChange || 0;
        const isWin = record.isWin || false;
        const myScoreChangeColor = myScoreChange > 0 ? '#52c41a' : myScoreChange < 0 ? '#ff4d4f' : '#666';
        const myScoreChangeText = myScoreChange > 0 ? `+${myScoreChange}` : `${myScoreChange}`;
        
        // 对手信息
        const opponent = record.opponent || {};
        const opponentName = opponent.name || (record.type === 1 ? 'AI' : '未知');
        const opponentUserId = opponent.userId || (record.type === 1 ? -1 : null);
        const opponentHeadUrl = opponent.headUrl || '';
        const opponentAc = opponent.ac || false;
        const opponentAcTime = opponent.acTime || 0;
        const opponentAbandoned = opponent.abandoned || false;
        
        // 结果
        let resultText = '';
        let resultColor = '#666';
        if (myAbandoned) {
            resultText = '放弃';
            resultColor = '#ff4d4f';
        } else if (myAc) {
            resultText = isWin ? '胜利' : '失败';
            resultColor = isWin ? '#52c41a' : '#ff4d4f';
        } else {
            resultText = '未完成';
            resultColor = '#999';
        }
        
        return `
            <div style="margin-bottom: 20px;">
                <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px;">基本信息</div>
                <div style="background: #f5f5f5; padding: 12px; border-radius: 6px;">
                    <div style="margin-bottom: 8px;"><strong>对战类型:</strong> ${typeText}</div>
                    <div style="margin-bottom: 8px;"><strong>题目ID:</strong> ${record.problemId || '-'}</div>
                    <div style="margin-bottom: 8px;"><strong>房间ID:</strong> ${record.roomId || '-'}</div>
                    <div style="margin-bottom: 8px;"><strong>开始时间:</strong> ${formatTime(record.startTime)}</div>
                    <div style="margin-bottom: 8px;"><strong>结束时间:</strong> ${formatTime(record.endTime)}</div>
                    <div><strong>创建时间:</strong> ${formatTime(record.createTime)}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px;">对战结果</div>
                <div style="background: ${resultColor}; color: #fff; padding: 12px; border-radius: 6px; text-align: center; font-size: 18px; font-weight: 600;">
                    ${resultText} | 分数变动: <span style="color: ${myScoreChangeColor === '#666' ? '#fff' : myScoreChangeColor};">${myScoreChangeText}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px;">对战双方</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div style="background: #f0f5ff; padding: 16px; border-radius: 6px; border: 2px solid #667eea;">
                        <div style="font-weight: 600; color: #667eea; margin-bottom: 12px; font-size: 16px;">我</div>
                        <div style="margin-bottom: 8px;">
                            <strong>状态:</strong> 
                            ${myAc ? `<span style="color: #52c41a;">✅ AC (${formatAcTime(myAcTime)})</span>` : 
                              myAbandoned ? '<span style="color: #ff4d4f;">❌ 放弃</span>' : 
                              '<span style="color: #999;">⏳ 进行中</span>'}
                        </div>
                        <div style="margin-bottom: 8px;">
                            <strong>分数变动:</strong> 
                            <span style="color: ${myScoreChangeColor}; font-weight: 600;">${myScoreChangeText}</span>
                        </div>
                        <div>
                            <strong>结果:</strong> 
                            <span style="color: ${isWin ? '#52c41a' : '#ff4d4f'}; font-weight: 600;">${isWin ? '胜利' : '失败'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #fff7e6; padding: 16px; border-radius: 6px; border: 2px solid #faad14;">
                        <div style="font-weight: 600; color: #faad14; margin-bottom: 12px; font-size: 16px;">对手</div>
                        ${opponentHeadUrl ? `<div style="margin-bottom: 8px;"><img src="${opponentHeadUrl}" style="width: 40px; height: 40px; border-radius: 50%;" /></div>` : ''}
                        <div style="margin-bottom: 8px;"><strong>名称:</strong> ${opponentName}</div>
                        ${opponentUserId && opponentUserId !== -1 ? `<div style="margin-bottom: 8px;"><strong>用户ID:</strong> ${opponentUserId}</div>` : ''}
                        <div>
                            <strong>状态:</strong> 
                            ${opponentAc ? `<span style="color: #52c41a;">✅ AC (${formatAcTime(opponentAcTime)})</span>` : 
                              opponentAbandoned ? '<span style="color: #ff4d4f;">❌ 放弃</span>' : 
                              '<span style="color: #999;">⏳ 进行中</span>'}
                        </div>
                    </div>
                </div>
            </div>
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
        this.stopCountdown();
    }
}
