/**
 * 对战平台视图模块
 * 处理对战相关的UI和逻辑
 */
import { eventBus, EVENTS } from '../events/EventBus.js';
import { getBattleUrl, initBattleDomain } from '../config.js';
import * as helpers from '../utils/helpers.js';

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
        this.templateInfo = null; // 对战模板信息（人机和1v1共用） {templateCode: {}, level: 1, exp: 0, maxLength: 10000}
        this.recordsType = 2; // 1=人机对战，2=1v1对战
        this.recordsPage = 1;
        this.recordsLimit = 20;
        this.recordsTotal = 0;
        this.recordsList = [];
        this.selectedRecordId = null;
        // 路由：查看指定用户的战绩（非本人）
        this.recordsTargetUserId = null; // string|null
        this.recordsTargetUserInfo = null; // {userId, name, nickname, avatar}|null
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
        
        // 时间同步相关
        this.serverTimeOffset = 0; // 服务器时间偏移量（服务器时间 - 客户端时间）
        
        this.bindEvents();
    }

    _normalizeAvatarUrl(url) {
        const s = String(url || '').trim();
        if (!s) return '';
        if (/^https?:\/\//i.test(s)) return s;
        // nowcoder 头像常见为相对路径
        if (s.startsWith('/')) return `https://uploadfiles.nowcoder.com${s}`;
        return s;
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _countHanChars(text) {
        return Array.from(String(text || '')).filter(ch => ch >= '\u4e00' && ch <= '\u9fff').length;
    }

    _looksLikeMojibake(text) {
        const s = String(text || '');
        if (!s) return false;
        const suspicious = /[ÃÂÅÆÇÐÑØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/;
        return suspicious.test(s) || /[\u0080-\u009f]/.test(s);
    }

    _tryDecodeUtf8Mojibake(text) {
        const s = String(text || '');
        if (!s || !this._looksLikeMojibake(s) || typeof TextDecoder === 'undefined') return s;
        try {
            const bytes = Uint8Array.from(Array.from(s), ch => ch.charCodeAt(0) & 0xff);
            const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
            if (!decoded || decoded === s) return s;
            const srcHan = this._countHanChars(s);
            const dstHan = this._countHanChars(decoded);
            if (dstHan > srcHan && !this._looksLikeMojibake(decoded)) return decoded;
        } catch (_) {
            // ignore broken candidates
        }
        return s;
    }

    _normalizeSeasonName(name) {
        const raw = String(name || '').trim();
        if (!raw) return '历史赛季';
        return this._tryDecodeUtf8Mojibake(raw);
    }

    // 解析 hash：支持 #/battle/record?userId=xxx&type=1|2
    parseBattleRecordRoute() {
        try {
            const full = String(window.location.hash || '').replace(/^#\/?/, '');
            const s = full.replace(/^\/?/, '');
            if (!s.toLowerCase().startsWith('battle/record')) return null;
            const q = s.split('?')[1] || '';
            const sp = new URLSearchParams(q);
            const uid = (sp.get('userId') || sp.get('uid') || '').trim();
            const typeRaw = (sp.get('type') || '').trim();
            const type = (typeRaw === '1' || typeRaw === '2') ? Number(typeRaw) : null;
            if (!uid) return { userId: null, type };
            return { userId: uid, type };
        } catch (_) {
            return null;
        }
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
        
        // 初始化对战域名配置（强制刷新以确保获取最新配置）
        await initBattleDomain(true);

        // hash 路由：直接打开对战记录页（可指定 userId）
        const recordRoute = this.parseBattleRecordRoute();
        if (recordRoute) {
            this.currentSidebarTab = 'history';
            this.recordsTargetUserId = recordRoute.userId || null;
            if (recordRoute.type === 1 || recordRoute.type === 2) this.recordsType = recordRoute.type;
            this.recordsPage = 1;
        } else {
            this.recordsTargetUserId = null;
        }
        
        // 检查登录状态
        if (!this.state.isLoggedIn() && !recordRoute) {
            const loginUrl = helpers.buildUrlWithChannelPut('https://ac.nowcoder.com/login?callBack=/');
        this.container.innerHTML = `
            <div class="battle-placeholder" style="padding: 40px; text-align: center;">
                <div style="font-size: 24px; color: #666; margin-bottom: 20px;">
                    ⚔️ 对战平台
                </div>
                <div style="font-size: 16px; color: #999;">
                        请先<a href="${loginUrl}" target="_blank" rel="noopener noreferrer" style="color:#1890ff;text-decoration:none;">登录</a>以使用对战功能
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
            
            // 加载模板信息（人机和1v1共用，默认使用type=1）
            try {
                this.templateInfo = await this.api.battleTemplate(1); // 人机对战（type=1）
            } catch (templateError) {
                console.error('加载模板信息失败:', templateError);
                // 使用默认值
                this.templateInfo = { templateCode: {}, level: 1, exp: 0, maxLength: 10000 };
            }
        } catch (error) {
            console.error('加载对战信息失败:', error);
            // 使用默认值
            this.battleInfo = {
                battle1v1: { levelScore: 500, winCount: 0, totalCount: 0, type: 2, seasonHistory: [] },
                battleAI: { levelScore: 500, winCount: 0, totalCount: 0, type: 1, seasonHistory: [] }
            };
            this.templateInfo = { templateCode: {}, level: 1, exp: 0, maxLength: 10000 };
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
                    ${this.state.isAdmin ? `
                    <!-- 管理员工具区域 -->
                    <div style="margin-bottom: 20px;">
                        <!-- 批量处理房间状态 -->
                        <div id="battle-admin-batch-process" style="background: #f0f5ff; border: 1px solid #adc6ff; border-radius: 6px; padding: 12px 16px; margin-bottom: 12px;">
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
                        
                        <!-- 设置用户对战分数 -->
                        <div id="battle-admin-set-score" style="background: #fff7e6; border: 1px solid #ffd591; border-radius: 6px; padding: 12px 16px;">
                            <div style="font-size: 14px; font-weight: 600; color: #d46b08; margin-bottom: 12px;">
                                ⚙️ 管理员工具：设置用户对战分数
                            </div>
                            <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 12px; color: #666;">用户ID</label>
                                    <input type="number" id="battle-admin-user-id" placeholder="用户ID" 
                                           style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; width: 120px; font-size: 13px;">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 12px; color: #666;">对战类型</label>
                                    <select id="battle-admin-battle-type" 
                                            style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; width: 120px; font-size: 13px;">
                                        <option value="2">1v1对战</option>
                                        <option value="1">人机对战</option>
                                    </select>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 12px; color: #666;">等级分</label>
                                    <input type="number" id="battle-admin-level-score" placeholder="等级分" 
                                           style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; width: 120px; font-size: 13px;">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 12px; color: #666;">胜场数（可选）</label>
                                    <input type="number" id="battle-admin-win-count" placeholder="留空保持原值" 
                                           style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; width: 140px; font-size: 13px;">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 12px; color: #666;">总场次（可选）</label>
                                    <input type="number" id="battle-admin-total-count" placeholder="留空保持原值" 
                                           style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; width: 140px; font-size: 13px;">
                                </div>
                                <button id="battle-admin-set-score-btn" 
                                        style="background: #fa8c16; color: #fff; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600; height: 32px;">
                                    设置
                                </button>
                            </div>
                            <div id="battle-admin-set-score-result" style="margin-top: 12px; font-size: 12px; display: none;"></div>
                        </div>
                        
                        <!-- 重建排行榜 -->
                        <div id="battle-admin-rebuild-leaderboard" style="background: #f6ffed; border: 1px solid #b7eb8f; border-radius: 6px; padding: 12px 16px; margin-top: 12px;">
                            <div style="font-size: 14px; font-weight: 600; color: #389e0d; margin-bottom: 12px;">
                                🔄 管理员工具：重建对战排行榜
                            </div>
                            <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 12px; color: #666;">对战类型</label>
                                    <select id="battle-admin-rebuild-type" 
                                            style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; width: 140px; font-size: 13px;">
                                        <option value="2">1v1对战</option>
                                        <option value="1">人机对战</option>
                                    </select>
                                </div>
                                <button id="battle-admin-rebuild-btn" 
                                        style="background: #52c41a; color: #fff; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600; height: 32px;">
                                    重建排行榜
                                </button>
                            </div>
                            <div id="battle-admin-rebuild-result" style="margin-top: 12px; font-size: 12px; display: none;"></div>
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
        
        // 绑定管理员功能事件
        if (this.state.isAdmin) {
            this.bindAdminBatchProcessEvents();
            this.bindAdminSetScoreEvents();
            this.bindAdminRebuildLeaderboardEvents();
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
     * 绑定管理员设置对战分数事件
     */
    bindAdminSetScoreEvents() {
        const setScoreBtn = document.getElementById('battle-admin-set-score-btn');
        const resultEl = document.getElementById('battle-admin-set-score-result');
        
        if (!setScoreBtn) return;
        
        setScoreBtn.addEventListener('click', async () => {
            const userIdInput = document.getElementById('battle-admin-user-id');
            const typeSelect = document.getElementById('battle-admin-battle-type');
            const levelScoreInput = document.getElementById('battle-admin-level-score');
            const winCountInput = document.getElementById('battle-admin-win-count');
            const totalCountInput = document.getElementById('battle-admin-total-count');
            
            if (!userIdInput || !typeSelect || !levelScoreInput) return;
            
            const userId = userIdInput.value.trim();
            const type = parseInt(typeSelect.value);
            const levelScore = levelScoreInput.value.trim();
            const winCount = winCountInput.value.trim();
            const totalCount = totalCountInput.value.trim();
            
            // 验证必填字段
            if (!userId || !levelScore) {
                if (resultEl) {
                    resultEl.style.display = 'block';
                    resultEl.style.color = '#ff4d4f';
                    resultEl.textContent = '请填写用户ID和等级分';
                }
                return;
            }
            
            // 验证数字格式
            if (isNaN(parseInt(userId)) || isNaN(parseInt(levelScore))) {
                if (resultEl) {
                    resultEl.style.display = 'block';
                    resultEl.style.color = '#ff4d4f';
                    resultEl.textContent = '用户ID和等级分必须是数字';
                }
                return;
            }
            
            // 验证可选字段
            if (winCount && isNaN(parseInt(winCount))) {
                if (resultEl) {
                    resultEl.style.display = 'block';
                    resultEl.style.color = '#ff4d4f';
                    resultEl.textContent = '胜场数必须是数字';
                }
                return;
            }
            
            if (totalCount && isNaN(parseInt(totalCount))) {
                if (resultEl) {
                    resultEl.style.display = 'block';
                    resultEl.style.color = '#ff4d4f';
                    resultEl.textContent = '总场次必须是数字';
                }
                return;
            }
            
            // 禁用按钮，显示加载状态
            setScoreBtn.disabled = true;
            setScoreBtn.style.opacity = '0.6';
            setScoreBtn.style.cursor = 'not-allowed';
            setScoreBtn.textContent = '设置中...';
            
            if (resultEl) {
                resultEl.style.display = 'none';
            }
            
            try {
                const result = await this.api.adminSetBattleScore(
                    parseInt(userId),
                    type,
                    parseInt(levelScore),
                    winCount ? parseInt(winCount) : null,
                    totalCount ? parseInt(totalCount) : null
                );
                
                if (result.success) {
                    if (resultEl) {
                        resultEl.style.display = 'block';
                        resultEl.style.color = '#52c41a';
                        
                        let message = '设置成功！';
                        if (result.before && result.after) {
                            const before = result.before;
                            const after = result.after;
                            message += `\n更新前：等级分=${before.levelScore || 'N/A'}, 胜场=${before.winCount || 'N/A'}, 总场次=${before.totalCount || 'N/A'}`;
                            message += `\n更新后：等级分=${after.levelScore || 'N/A'}, 胜场=${after.winCount || 'N/A'}, 总场次=${after.totalCount || 'N/A'}`;
                        }
                        resultEl.textContent = message;
                        resultEl.style.whiteSpace = 'pre-line';
                    }
                } else {
                    if (resultEl) {
                        resultEl.style.display = 'block';
                        resultEl.style.color = '#ff4d4f';
                        resultEl.textContent = result.message || '设置失败';
                    }
                }
            } catch (error) {
                console.error('设置对战分数失败:', error);
                if (resultEl) {
                    resultEl.style.display = 'block';
                    resultEl.style.color = '#ff4d4f';
                    resultEl.textContent = '设置失败：' + (error.message || '未知错误');
                }
            } finally {
                // 恢复按钮状态
                setScoreBtn.disabled = false;
                setScoreBtn.style.opacity = '1';
                setScoreBtn.style.cursor = 'pointer';
                setScoreBtn.textContent = '设置';
            }
        });
    }

    /**
     * 绑定管理员重建排行榜按钮事件
     */
    bindAdminRebuildLeaderboardEvents() {
        const rebuildBtn = document.getElementById('battle-admin-rebuild-btn');
        const resultEl = document.getElementById('battle-admin-rebuild-result');
        
        if (!rebuildBtn) return;
        
        rebuildBtn.addEventListener('click', async () => {
            const typeSelect = document.getElementById('battle-admin-rebuild-type');
            
            if (!typeSelect) return;
            
            const type = parseInt(typeSelect.value);
            const typeName = type === 1 ? '人机对战' : '1v1对战';
            
            // 确认对话框
            const confirmed = await this.showConfirmDialog(
                '确定要重建排行榜吗？',
                `这将重建${typeName}的排行榜，根据数据库中的所有用户rating重建Redis排行榜。此操作可能需要一些时间。`,
                '确定重建',
                '取消'
            );
            
            if (!confirmed) return;
            
            // 禁用按钮，显示加载状态
            rebuildBtn.disabled = true;
            rebuildBtn.style.opacity = '0.6';
            rebuildBtn.style.cursor = 'not-allowed';
            rebuildBtn.textContent = '重建中...';
            
            if (resultEl) {
                resultEl.style.display = 'none';
            }
            
            try {
                const result = await this.api.adminRebuildLeaderboard(type);
                
                if (result.success) {
                    if (resultEl) {
                        resultEl.style.display = 'block';
                        resultEl.style.color = '#52c41a';
                        
                        let message = `重建成功！`;
                        if (result.updatedCount !== undefined && result.totalUsers !== undefined) {
                            message += ` 更新了 ${result.updatedCount} / ${result.totalUsers} 个用户`;
                        }
                        if (result.message) {
                            message += `\n${result.message}`;
                        }
                        resultEl.textContent = message;
                    }
                    
                    this.showSuccessMessage(`${typeName}排行榜重建成功`);
                } else {
                    throw new Error(result.message || '重建失败');
                }
            } catch (error) {
                console.error('重建排行榜失败:', error);
                if (resultEl) {
                    resultEl.style.display = 'block';
                    resultEl.style.color = '#ff4d4f';
                    resultEl.textContent = '重建失败：' + (error.message || '未知错误');
                }
                this.showErrorMessage('重建排行榜失败：' + (error.message || '未知错误'));
            } finally {
                // 恢复按钮状态
                rebuildBtn.disabled = false;
                rebuildBtn.style.opacity = '1';
                rebuildBtn.style.cursor = 'pointer';
                rebuildBtn.textContent = '重建排行榜';
            }
        });
    }

    /**
     * 渲染当前选中的视图
     */
    renderCurrentView() {
        switch (this.currentSidebarTab) {
            case 'start':
                this.renderStartView();
                // 切换到开始对战页面时，刷新"我的镜像"列表
                this.loadMyMirrors();
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
            battle1v1: { levelScore: 500, winCount: 0, totalCount: 0, type: 2, seasonHistory: [] },
            battleAI: { levelScore: 500, winCount: 0, totalCount: 0, type: 1, seasonHistory: [] }
        };
        
        const info1v1 = battleInfo.battle1v1 || { levelScore: 500, winCount: 0, totalCount: 0, seasonHistory: [] };
        const infoAI = battleInfo.battleAI || { levelScore: 500, winCount: 0, totalCount: 0, seasonHistory: [] };
        
        const templateInfo = this.templateInfo || { level: 1, exp: 0, maxLength: 10000 };
        
        const winRate1v1 = info1v1.totalCount > 0 
            ? ((info1v1.winCount / info1v1.totalCount) * 100).toFixed(1) 
            : '0.0';
        const winRateAI = infoAI.totalCount > 0 
            ? ((infoAI.winCount / infoAI.totalCount) * 100).toFixed(1) 
            : '0.0';
        
        // 使用后端返回的经验值数据
        // currentLevelExp: 当前等级已获得的经验
        // expRequired: 升级到下一级所需的总经验
        const currentLevelExp = templateInfo.currentLevelExp || 0;
        const currentLevel = templateInfo.level || 1;
        const expRequired = templateInfo.expRequired || 10;
        // 还需的经验 = 升级所需总经验 - 当前等级已获得的经验
        const expToNext = Math.max(0, expRequired - currentLevelExp);

        viewEl.innerHTML = `
            <div class="battle-season-hero">
                <div>
                    <div class="battle-season-hero__eyebrow">NOWCODER TRACKER BATTLE</div>
                    <div class="battle-season-hero__title">第一赛季：赛场狂想曲</div>
                    <div class="battle-season-hero__desc">封榜已翻篇，新榜单正在等待下一次漂亮的 AC。</div>
                </div>
                <div class="battle-season-hero__tag">SEASON 1</div>
            </div>

            <!-- 顶部通栏：对战等级 -->
            <div style="margin-bottom: 24px;">
                <div style="background: ${helpers.getBattleLevelColor(currentLevel).gradient}; color: #fff; padding: 24px; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); position: relative; overflow: hidden;">
                    <!-- 装饰背景 -->
                    <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; filter: blur(20px);"></div>
                    <div style="position: absolute; bottom: -30px; left: -10px; width: 150px; height: 150px; background: rgba(255,255,255,0.05); border-radius: 50%; filter: blur(30px);"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; position: relative; z-index: 1;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="font-size: 18px; font-weight: 600; opacity: 0.95; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">⭐ 对战等级</div>
                            <div id="battle-level-help" 
                                 style="width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
                                        display: flex; align-items: center; justify-content: center; cursor: pointer; 
                                        font-size: 12px; font-weight: bold; transition: all 0.2s;"
                                 onmouseover="this.style.background='rgba(255,255,255,0.4)'; this.style.transform='scale(1.1)'"
                                 onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1)'">
                                ?
                        </div>
                            <div id="battle-level-help-tooltip" 
                                 style="display: none; position: fixed; max-width: 300px;
                                        background: #1a1a1a !important; backdrop-filter: blur(10px); color: #ffffff; padding: 16px; border-radius: 12px; 
                                        font-size: 13px; line-height: 1.6; z-index: 999999; box-shadow: 0 8px 24px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); opacity: 1 !important;">
                                <div style="font-weight: 600; margin-bottom: 8px; color: #ffd700; display: flex; align-items: center; gap: 6px; opacity: 1;">
                                    <span>⭐</span> <span>升级规则</span>
                            </div>
                                <div style="margin-bottom: 4px; color: #ffffff; opacity: 1;">• 如果 AC 并胜利，加 10 经验</div>
                                <div style="margin-bottom: 4px; color: #ffffff; opacity: 1;">• 如果 AC 但是失败，加 5 经验</div>
                                <div style="margin-bottom: 8px; color: #ffffff; opacity: 1;">• 任何情况下放弃均无经验</div>
                                <div style="padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); color: #ffd700; font-weight: 600; opacity: 1;">
                                    升级后可以获得更大模板长度限额
                            </div>
                            </div>
                        </div>
                        <div style="font-size: 36px; font-weight: 800; text-shadow: 0 2px 8px rgba(0,0,0,0.2); font-family: 'Arial Black', sans-serif;">Lv.${currentLevel}</div>
                    </div>
                    
                    <div style="position: relative; z-index: 0;">
                        <div style="display: flex; justify-content: space-between; font-size: 14px; opacity: 0.9; margin-bottom: 8px; font-weight: 500;">
                            <span>当前经验</span>
                            <span>${currentLevelExp} / ${expRequired}</span>
                        </div>
                        <div style="background: rgba(0,0,0,0.2); border-radius: 10px; height: 12px; overflow: hidden; margin-bottom: 8px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);">
                            <div style="background: linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.8) 100%); height: 100%; width: ${Math.min(100, expRequired > 0 ? (currentLevelExp / expRequired) * 100 : 0)}%; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 10px; box-shadow: 0 0 10px rgba(255,255,255,0.5);"></div>
                            </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="font-size: 13px; opacity: 0.8;">已完成 ${Math.round(expRequired > 0 ? (currentLevelExp / expRequired) * 100 : 0)}%</div>
                            <div style="font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; backdrop-filter: blur(4px);">还需 ${expToNext} 经验升级</div>
                            </div>
                            </div>
                        </div>
                            </div>

            <div style="display: flex; gap: 24px; align-items: flex-start;">
                <!-- 左侧：启动对战 (60%) -->
                <div style="flex: 3;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="font-size: 20px; color: #333; margin: 0; display: flex; align-items: center; gap: 8px;">
                            <span>🚀</span> 启动对战
                        </h2>
                        <button id="battle-set-template-btn" 
                                style="background: #fff; color: #666; border: 1px solid #e5e7eb; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px;"
                                onmouseover="this.style.borderColor='#667eea'; this.style.color='#667eea'; this.style.background='#f8f9fa'"
                                onmouseout="this.style.borderColor='#e5e7eb'; this.style.color='#666'; this.style.background='#fff'">
                            <span>⚙️</span> 设置初始代码
                        </button>
                </div>
                
                    <!-- 第一赛季说明 -->
                    <div style="background: linear-gradient(135deg, #eef6ff 0%, #f4edff 52%, #fff7e6 100%); border: 1px solid rgba(102,126,234,0.25); padding: 16px 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 8px 26px rgba(102,126,234,0.08);">
                        <div style="display: flex; align-items: center; gap: 10px; color: #1f2937; font-weight: 700; font-size: 15px;">
                            <span style="font-size: 20px;">🏁</span>
                            <span>第一赛季已开启：赛场狂想曲。内测赛季 rating 已归档，可在右侧“赛季rating一览”查看。</span>
                    </div>
                </div>
                
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                        <!-- 1v1匹配 -->
                        <div class="battle-mode-card" 
                             onclick="document.getElementById('battle-1v1-btn').click()"
                             style="background: #fff; border: 2px solid #e5e7eb; border-radius: 16px; padding: 24px; transition: all 0.3s; cursor: pointer; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; min-height: 200px;" 
                             onmouseover="this.style.borderColor='#667eea'; this.style.boxShadow='0 8px 24px rgba(102,126,234,0.15)'; this.style.transform='translateY(-4px)'"
                             onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'; this.style.transform='translateY(0)'">
                                <div>
                                <div style="font-size: 48px; margin-bottom: 16px; filter: drop-shadow(0 4px 8px rgba(102,126,234,0.2));">⚔️</div>
                                <div style="font-size: 20px; font-weight: 700; color: #333; margin-bottom: 8px;">1v1 匹配</div>
                                <div style="font-size: 14px; color: #666; line-height: 1.5;">系统自动匹配实力相近的对手，进行实时编程对战。</div>
                            </div>
                            <button id="battle-1v1-btn" class="battle-mode-btn" 
                                    onclick="event.stopPropagation()" 
                                    style="width: 100%; margin-top: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s;"
                                    onmouseover="this.style.transform='scale(1.02)'"
                                    onmouseout="this.style.transform='scale(1)'">
                                开始匹配
                            </button>
                        </div>
                        
                        <!-- 人机大战 -->
                        <div class="battle-mode-card" 
                             onclick="document.getElementById('battle-ai-btn').click()"
                             style="background: #fff; border: 2px solid #e5e7eb; border-radius: 16px; padding: 24px; transition: all 0.3s; cursor: pointer; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; min-height: 200px;" 
                             onmouseover="this.style.borderColor='#52c41a'; this.style.boxShadow='0 8px 24px rgba(82,196,26,0.15)'; this.style.transform='translateY(-4px)'"
                             onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'; this.style.transform='translateY(0)'">
                                <div>
                                <div style="font-size: 48px; margin-bottom: 16px; filter: drop-shadow(0 4px 8px rgba(82,196,26,0.2));">🤖</div>
                                <div style="font-size: 20px; font-weight: 700; color: #333; margin-bottom: 8px;">人机大战</div>
                                <div style="font-size: 14px; color: #666; line-height: 1.5;">与AI进行对战练习，熟悉比赛流程和题目难度。</div>
                            </div>
                            <button id="battle-ai-btn" class="battle-mode-btn" 
                                    onclick="event.stopPropagation()"
                                    style="width: 100%; margin-top: 20px; background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%); color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s;"
                                    onmouseover="this.style.transform='scale(1.02)'"
                                    onmouseout="this.style.transform='scale(1)'">
                                开始对战
                            </button>
                        </div>
                        
                        <!-- 好友对战 -->
                        <div class="battle-mode-card" style="background: #fff; border: 2px solid #e5e7eb; border-radius: 16px; padding: 24px; transition: all 0.3s; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; min-height: 200px;" 
                             onmouseover="this.style.borderColor='#faad14'; this.style.boxShadow='0 8px 24px rgba(250,173,20,0.15)'; this.style.transform='translateY(-4px)'"
                             onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'; this.style.transform='translateY(0)'">
                                <div>
                                <div style="font-size: 48px; margin-bottom: 16px; filter: drop-shadow(0 4px 8px rgba(250,173,20,0.2));">👥</div>
                                <div style="font-size: 20px; font-weight: 700; color: #333; margin-bottom: 8px;">好友对战</div>
                                <div style="font-size: 14px; color: #666; line-height: 1.5;">创建房间邀请好友，或输入房间码加入对战。</div>
                                </div>
                            <div style="display: flex; gap: 12px; margin-top: 20px;">
                                <button id="battle-create-room-btn" class="battle-mode-btn" 
                                        style="flex: 1; background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%); color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s;"
                                        onmouseover="this.style.transform='scale(1.02)'"
                                        onmouseout="this.style.transform='scale(1)'">
                                    创建
                                </button>
                                <button id="battle-join-room-btn" class="battle-mode-btn" 
                                        style="flex: 1; background: #fff; color: #333; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s;"
                                        onmouseover="this.style.transform='scale(1.02)'; this.style.borderColor='#faad14'; this.style.color='#faad14'"
                                        onmouseout="this.style.transform='scale(1)'; this.style.borderColor='#e5e7eb'; this.style.color='#333'">
                                    加入
                                </button>
                            </div>
                        </div>
                        
                        <!-- 我的镜像 -->
                        <div id="battle-my-mirrors-section" style="margin-top: 24px; background: #fff; border: 2px solid #e5e7eb; border-radius: 16px; padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                <div style="font-size: 18px; font-weight: 700; color: #333; display: flex; align-items: center; gap: 8px;">
                                    <span>🪞</span> 我的镜像
                                    <span
                                        title="镜像模式说明：每人最多创建 10 个镜像；超过 10 个将自动清除最先创建的镜像（先进先出）。"
                                        onclick="alert('镜像模式说明：\n\n- 每人最多创建 10 个镜像\n- 超过 10 个将自动清除最先创建的镜像（先进先出）');"
                                        style="display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background:#f0f5ff; border:1px solid #667eea; color:#667eea; font-size:12px; font-weight:800; cursor:pointer; user-select:none;"
                                        aria-label="镜像模式说明"
                                    >?</span>
                                </div>
                                <button id="battle-refresh-mirrors-btn" 
                                        style="font-size: 12px; color: #667eea; background: #f0f5ff; border: 1px solid #667eea; 
                                               padding: 4px 10px; border-radius: 6px; cursor: pointer; 
                                               transition: all 0.2s; font-weight: 500;"
                                        onmouseover="this.style.background='#667eea'; this.style.color='#fff'"
                                        onmouseout="this.style.background='#f0f5ff'; this.style.color='#667eea'">
                                    刷新
                                </button>
                            </div>
                            <div id="battle-my-mirrors-content" style="min-height: 60px;">
                                <div style="text-align: center; padding: 20px; color: #999; font-size: 14px;">加载中...</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 右侧：战绩概览 (40%) -->
                <div style="flex: 2; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="font-size: 20px; color: #333; margin: 0; display: flex; align-items: center; gap: 8px;">
                            <span>📊</span> 战绩概览
                        </h2>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <button id="battle-season-rating-btn" 
                                    style="font-size: 13px; color: #667eea; background: #f0f5ff; border: 1px solid #667eea; 
                                           padding: 6px 12px; border-radius: 6px; cursor: pointer; 
                                           transition: all 0.2s; font-weight: 500;"
                                    onmouseover="this.style.background='#667eea'; this.style.color='#fff'"
                                    onmouseout="this.style.background='#f0f5ff'; this.style.color='#667eea'">
                                赛季rating一览
                            </button>
                            <div style="font-size: 12px; color: #999; background: #f5f5f5; padding: 4px 10px; border-radius: 12px;">ID: ${this.state.loggedInUserId}</div>
                        </div>
                    </div>
                    
                    <!-- 1v1对战信息卡片 -->
                    ${(() => {
                        const rank1v1 = helpers.getBattleRank(info1v1.levelScore);
                        const rankColor = rank1v1.color;
                        const bgColor = rank1v1.bgColor;
                        const textColor = rank1v1.textColor;
                        // 计算hover时的阴影颜色（使用段位颜色的半透明版本）
                        const shadowColor = helpers.hexToRgba(rankColor, 0.12);
                        const shadowColorHover = helpers.hexToRgba(rankColor, 0.2);
                        const borderColor = helpers.hexToRgba(rankColor, 0.25);
                        const textColorSecondary = helpers.hexToRgba(textColor, 0.8);
                        const textColorDisabled = helpers.hexToRgba(textColor, 0.5);
                        return `
                    <div style="background: ${bgColor}; color: ${textColor}; padding: 24px; border-radius: 16px; margin-bottom: 20px; 
                                box-shadow: 0 4px 16px ${shadowColor};
                                border: 1px solid ${borderColor};
                                border-left: 4px solid ${rankColor};
                                position: relative;
                                overflow: hidden;
                                transition: all 0.3s ease;"
                         onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px ${shadowColorHover}'"
                         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px ${shadowColor}'">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div style="font-size: 16px; font-weight: 700; color: ${textColor}; display: flex; align-items: center; gap: 8px;">
                                <span style="color: ${rankColor};">⚔️</span> 1v1 对战
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                <div style="font-size: 14px; font-weight: 600; color: ${textColor};">
                                    ${rank1v1.name}
                                </div>
                                <div style="font-size: 20px; font-weight: 800; color: ${textColor};">${info1v1.levelScore}</div>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
                            <div style="text-align: center; padding: 10px; background: rgba(255, 255, 255, 0.5); border-radius: 8px;">
                                <div style="font-size: 12px; color: ${textColorSecondary}; margin-bottom: 4px;">胜场</div>
                                <div style="font-size: 18px; font-weight: 700; color: ${textColor};">${info1v1.winCount}</div>
                            </div>
                            <div style="text-align: center; padding: 10px; background: rgba(255, 255, 255, 0.5); border-radius: 8px;">
                                <div style="font-size: 12px; color: ${textColorSecondary}; margin-bottom: 4px;">总场次</div>
                                <div style="font-size: 18px; font-weight: 700; color: ${textColor};">${info1v1.totalCount}</div>
                            </div>
                            <div style="text-align: center; padding: 10px; background: rgba(255, 255, 255, 0.5); border-radius: 8px;">
                                <div style="font-size: 12px; color: ${textColorSecondary}; margin-bottom: 4px;">胜率</div>
                                <div style="font-size: 18px; font-weight: 700; color: ${info1v1.totalCount > 0 ? textColor : textColorDisabled};">${info1v1.totalCount > 0 ? winRate1v1 + '%' : '-'}</div>
                            </div>
                        </div>
                        ${info1v1.totalCount > 0 ? `
                            <div style="border-top: 1px solid ${borderColor}; padding-top: 16px;">
                                <div style="font-size: 12px; color: ${textColorSecondary}; margin-bottom: 12px;">最近分数变化</div>
                                <canvas id="battle-1v1-chart" style="width: 100%; height: 100px;"></canvas>
                            </div>
                        ` : ''}
                    </div>
                        `;
                    })()}
                    
                    <!-- 人机对战信息卡片 -->
                    ${(() => {
                        const rankAI = helpers.getBattleRank(infoAI.levelScore);
                        const rankColor = rankAI.color;
                        const bgColor = rankAI.bgColor;
                        const textColor = rankAI.textColor;
                        // 计算hover时的阴影颜色（使用段位颜色的半透明版本）
                        const shadowColor = helpers.hexToRgba(rankColor, 0.12);
                        const shadowColorHover = helpers.hexToRgba(rankColor, 0.2);
                        const borderColor = helpers.hexToRgba(rankColor, 0.25);
                        const textColorSecondary = helpers.hexToRgba(textColor, 0.8);
                        const textColorDisabled = helpers.hexToRgba(textColor, 0.5);
                        return `
                    <div style="background: ${bgColor}; color: ${textColor}; padding: 24px; border-radius: 16px; 
                                box-shadow: 0 4px 16px ${shadowColor};
                                border: 1px solid ${borderColor};
                                border-left: 4px solid ${rankColor};
                                position: relative;
                                overflow: hidden;
                                transition: all 0.3s ease;"
                         onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px ${shadowColorHover}'"
                         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px ${shadowColor}'">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div style="font-size: 16px; font-weight: 700; color: ${textColor}; display: flex; align-items: center; gap: 8px;">
                                <span style="color: ${rankColor};">🤖</span> 人机对战
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                <div style="font-size: 14px; font-weight: 600; color: ${textColor};">
                                    ${rankAI.name}
                                </div>
                                <div style="font-size: 20px; font-weight: 800; color: ${textColor};">${infoAI.levelScore}</div>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
                            <div style="text-align: center; padding: 10px; background: rgba(255, 255, 255, 0.5); border-radius: 8px;">
                                <div style="font-size: 12px; color: ${textColorSecondary}; margin-bottom: 4px;">胜场</div>
                                <div style="font-size: 18px; font-weight: 700; color: ${textColor};">${infoAI.winCount}</div>
                            </div>
                            <div style="text-align: center; padding: 10px; background: rgba(255, 255, 255, 0.5); border-radius: 8px;">
                                <div style="font-size: 12px; color: ${textColorSecondary}; margin-bottom: 4px;">总场次</div>
                                <div style="font-size: 18px; font-weight: 700; color: ${textColor};">${infoAI.totalCount}</div>
                            </div>
                            <div style="text-align: center; padding: 10px; background: rgba(255, 255, 255, 0.5); border-radius: 8px;">
                                <div style="font-size: 12px; color: ${textColorSecondary}; margin-bottom: 4px;">胜率</div>
                                <div style="font-size: 18px; font-weight: 700; color: ${infoAI.totalCount > 0 ? textColor : textColorDisabled};">${infoAI.totalCount > 0 ? winRateAI + '%' : '-'}</div>
                            </div>
                        </div>
                        ${infoAI.totalCount > 0 ? `
                            <div style="border-top: 1px solid ${borderColor}; padding-top: 16px;">
                                <div style="font-size: 12px; color: ${textColorSecondary}; margin-bottom: 12px;">最近分数变化</div>
                                <canvas id="battle-ai-chart" style="width: 100%; height: 100px;"></canvas>
                            </div>
                        ` : ''}
                    </div>
                        `;
                    })()}
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
        
        // 绘制分数变化折线图
        this.drawRatingCharts(info1v1.levelScore, infoAI.levelScore);
        
        // 绑定等级问号提示
        const levelHelp = document.getElementById('battle-level-help');
        const levelTooltip = document.getElementById('battle-level-help-tooltip');
        if (levelHelp && levelTooltip) {
            levelHelp.addEventListener('mouseenter', () => {
                // 动态计算位置，使用fixed定位
                const helpRect = levelHelp.getBoundingClientRect();
                levelTooltip.style.display = 'block';
                levelTooltip.style.top = (helpRect.bottom + 12) + 'px';
                levelTooltip.style.left = helpRect.left + 'px';
            });
            levelHelp.addEventListener('mouseleave', () => {
                levelTooltip.style.display = 'none';
            });
        }
        
        // 绑定赛季rating一览按钮
        const seasonRatingBtn = document.getElementById('battle-season-rating-btn');
        if (seasonRatingBtn) {
            seasonRatingBtn.addEventListener('click', () => {
                this.showSeasonRatingModal();
            });
        }
        
        // 加载我的镜像
        this.loadMyMirrors();
        
        // 绑定刷新镜像按钮
        const refreshMirrorsBtn = document.getElementById('battle-refresh-mirrors-btn');
        if (refreshMirrorsBtn) {
            refreshMirrorsBtn.addEventListener('click', () => {
                this.loadMyMirrors();
            });
        }
    }
    
    /**
     * 加载我的镜像列表
     */
    async loadMyMirrors() {
        const contentEl = document.getElementById('battle-my-mirrors-content');
        if (!contentEl) return;
        
        try {
            const result = await this.api.getMyMirrors();
            const mirrors = result.mirrors || [];
            
            // 获取当前用户头像
            let userAvatar = '';
            const currentUser = this.state.loggedInUserData || {};
            
            // 优先使用 avatar，然后是 headUrl
            if (currentUser.avatar) {
                userAvatar = currentUser.avatar.startsWith('http') 
                    ? currentUser.avatar 
                    : `https://uploadfiles.nowcoder.com${currentUser.avatar}`;
            } else if (currentUser.headUrl) {
                userAvatar = currentUser.headUrl.startsWith('http') 
                    ? currentUser.headUrl 
                    : `https://uploadfiles.nowcoder.com${currentUser.headUrl}`;
            }
            
            // 如果还是没有头像，尝试从对战排行榜获取
            if (!userAvatar && this.state.loggedInUserId) {
                try {
                    // 使用对战排行榜API获取1v1排行榜，limit设置大一些以增加找到用户的概率
                    const rankingsResult = await this.api.battleLeaderboard(2, 1, 200); // 获取1v1排行榜前200名
                    if (rankingsResult && rankingsResult.list) {
                        const myRanking = rankingsResult.list.find(u => 
                            String(u.userId) === String(this.state.loggedInUserId)
                        );
                        if (myRanking) {
                            userAvatar = myRanking.avatar || myRanking.headUrl || '';
                            if (userAvatar && !userAvatar.startsWith('http')) {
                                // 处理相对路径的头像URL
                                if (userAvatar.startsWith('/')) {
                                    userAvatar = `https://uploadfiles.nowcoder.com${userAvatar}`;
                                } else {
                                    userAvatar = `https://uploadfiles.nowcoder.com/${userAvatar}`;
                                }
                            }
                            // 更新 loggedInUserData 以便后续使用
                            if (userAvatar && this.state.loggedInUserData) {
                                this.state.loggedInUserData.avatar = userAvatar;
                                this.state.loggedInUserData.headUrl = userAvatar;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('从对战排行榜获取头像失败:', e);
                }
            }
            
            // 调试信息
            console.log('镜像头像信息:', {
                loggedInUserId: this.state.loggedInUserId,
                loggedInUserData: this.state.loggedInUserData,
                userAvatar: userAvatar,
                hasAvatar: !!userAvatar
            });
            
            if (mirrors.length === 0) {
                contentEl.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #999; font-size: 14px;">
                        <div style="font-size: 32px; margin-bottom: 8px;">🪞</div>
                        <div>暂无未挑战的镜像</div>
                        <div style="font-size: 12px; color: #ccc; margin-top: 8px;">创建镜像后，其他玩家可以挑战您的镜像</div>
                    </div>
                `;
                return;
            }
            
            // 显示图标列表
            contentEl.innerHTML = `
                <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: flex-start;">
                    ${mirrors.map((mirror, index) => {
                        const mode = mirror.mode === '1v1' ? '1v1对战' : '人机对战';
                        const rankScore = mirror.rankScore || 0;
                        const createTimeMs = mirror.createTime || 0;
                        const createTime = createTimeMs ? new Date(createTimeMs).toLocaleString('zh-CN') : '-';
                        const isAC = mirror.isAC || false;
                        const abandoned = mirror.abandoned || false;
                        const status = isAC ? 'AC' : (abandoned ? '放弃' : '未完成');
                        const statusColor = isAC ? '#52c41a' : (abandoned ? '#ff4d4f' : '#999');
                        
                        // AC时间或放弃时间（直接使用JSON中的时间字段）
                        let acOrAbandonTimeText = '';
                        if (isAC && mirror.acTime && mirror.acTime > 0) {
                            // AC时间：计算从创建时间到AC时间的时长
                            const timeDiff = mirror.acTime - createTimeMs;
                            if (timeDiff > 0) {
                                const minutes = Math.floor(timeDiff / 60000);
                                const seconds = Math.floor((timeDiff % 60000) / 1000);
                                acOrAbandonTimeText = `${minutes}分${seconds}秒`;
                            }
                        } else if (abandoned && mirror.abandonTime && mirror.abandonTime > 0) {
                            // 放弃时间：计算从创建时间到放弃时间的时长
                            const timeDiff = mirror.abandonTime - createTimeMs;
                            if (timeDiff > 0) {
                                const minutes = Math.floor(timeDiff / 60000);
                                const seconds = Math.floor((timeDiff % 60000) / 1000);
                                acOrAbandonTimeText = `${minutes}分${seconds}秒`;
                            }
                        }
                        
                        // 题目信息
                        const problemTitle = mirror.problemTitle || '';
                        const problemUrl = mirror.problemUrl || (mirror.problemId ? `https://ac.nowcoder.com/acm/problem/${mirror.problemId}` : '');
                        const problemId = mirror.problemId || 0;
                        
                        // 提交次数
                        const submissionCount = mirror.submissionCount || 0;
                        
                        // 生成唯一ID用于tooltip
                        const tooltipId = `mirror-tooltip-${index}`;
                        
                        // 生成题目链接
                        const problemLink = problemUrl || (problemId ? `https://ac.nowcoder.com/acm/problem/${problemId}` : '#');
                        
                        return `
                            <div class="mirror-icon-container" 
                                 data-mirror-index="${index}"
                                 data-problem-url="${problemLink}"
                                 style="position: relative; cursor: pointer;">
                                <!-- 镜像图标 -->
                                <div class="mirror-avatar-wrapper" style="position: relative; width: 64px; height: 64px;">
                                    <!-- 外层旋转光环 -->
                                    <div class="mirror-glow-ring" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                                                border-radius: 50%; 
                                                background: conic-gradient(from 0deg, 
                                                    transparent 0deg, 
                                                    rgba(24, 144, 255, 0.3) 60deg,
                                                    rgba(135, 206, 250, 0.6) 120deg,
                                                    rgba(24, 144, 255, 0.8) 180deg,
                                                    rgba(135, 206, 250, 0.6) 240deg,
                                                    rgba(24, 144, 255, 0.3) 300deg,
                                                    transparent 360deg);
                                                animation: mirrorRotate 3s linear infinite;
                                                z-index: 1;
                                                padding: 3px;">
                                        <div style="width: 100%; height: 100%; background: #1a1a1a; border-radius: 50%;"></div>
                                    </div>
                                    
                                    <!-- 中层流光边框 -->
                                    <div class="mirror-border-glow" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                                                border-radius: 50%; 
                                                border: 3px solid transparent;
                                                background: linear-gradient(135deg, 
                                                    rgba(24, 144, 255, 0.8) 0%,
                                                    rgba(135, 206, 250, 0.6) 25%,
                                                    rgba(24, 144, 255, 0.4) 50%,
                                                    rgba(135, 206, 250, 0.6) 75%,
                                                    rgba(24, 144, 255, 0.8) 100%);
                                                background-size: 200% 200%;
                                                animation: mirrorShimmer 2s ease-in-out infinite;
                                                z-index: 2;
                                                box-shadow: 0 0 20px rgba(24, 144, 255, 0.5),
                                                            0 0 40px rgba(135, 206, 250, 0.3),
                                                            inset 0 0 20px rgba(24, 144, 255, 0.2);">
                                    </div>
                                    
                                    <!-- 用户头像 -->
                                    <div class="mirror-avatar" style="position: absolute; top: 4px; left: 4px; width: calc(100% - 8px); height: calc(100% - 8px);
                                                border-radius: 50%; overflow: hidden; z-index: 3;
                                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                                display: flex; align-items: center; justify-content: center;
                                                box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.3),
                                                            0 0 10px rgba(24, 144, 255, 0.4);">
                                        ${userAvatar ? 
                                            `<img src="${userAvatar}" alt="镜像" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'font-size: 28px;\\'>🪞</div>';" />` :
                                            '<div style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🪞</div>'
                                        }
                                    </div>
                                    
                                    <!-- 内层光泽效果 -->
                                    <div class="mirror-shine" style="position: absolute; top: 4px; left: 4px; width: calc(100% - 8px); height: calc(100% - 8px);
                                                border-radius: 50%; 
                                                background: radial-gradient(circle at 30% 30%, 
                                                    rgba(255, 255, 255, 0.4) 0%,
                                                    rgba(255, 255, 255, 0.1) 30%,
                                                    transparent 60%);
                                                z-index: 4;
                                                pointer-events: none;
                                                animation: mirrorShine 3s ease-in-out infinite;">
                                    </div>
                                    
                                    <!-- 状态角标 -->
                                    <div style="position: absolute; bottom: -2px; right: -2px; width: 20px; height: 20px;
                                                background: ${statusColor}; border: 2px solid #fff; border-radius: 50%;
                                                display: flex; align-items: center; justify-content: center;
                                                font-size: 11px; font-weight: 600; color: #fff; z-index: 5;
                                                box-shadow: 0 2px 6px rgba(0,0,0,0.3),
                                                            0 0 8px ${statusColor};">
                                        ${isAC ? '✓' : (abandoned ? '✗' : '○')}
                                    </div>
                                </div>
                                
                                <!-- Tooltip 详细信息 -->
                                <div id="${tooltipId}" 
                                     class="mirror-tooltip"
                                     style="display: none; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
                                            margin-bottom: 8px; background: #1a1a1a; color: #fff; padding: 12px;
                                            border-radius: 8px; font-size: 12px; line-height: 1.6; white-space: nowrap;
                                            z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                                            pointer-events: none; min-width: 200px;">
                                    <div style="font-weight: 600; margin-bottom: 8px; color: #1890ff; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px;">
                                        ${mode}
                                    </div>
                                    ${problemTitle && problemUrl ? `
                                        <div style="margin-bottom: 6px;">
                                            <strong style="color: #999;">题目:</strong> 
                                            <a href="${problemUrl}" target="_blank" rel="noopener noreferrer" 
                                               style="color: #4dabf7; text-decoration: none; display: block; margin-top: 2px; word-break: break-all; white-space: normal;">
                                                ${problemTitle}
                                            </a>
                                            <span style="color: #666;">(${problemId})</span>
                                        </div>
                                    ` : problemId ? `
                                        <div style="margin-bottom: 6px;">
                                            <strong style="color: #999;">题目ID:</strong> 
                                            <a href="${problemUrl}" target="_blank" rel="noopener noreferrer" 
                                               style="color: #4dabf7; text-decoration: none;">
                                                ${problemId}
                                            </a>
                                        </div>
                                    ` : ''}
                                    <div style="margin-bottom: 4px;">
                                        <strong style="color: #999;">等级分:</strong> <span style="color: #fff;">${rankScore}</span>
                                    </div>
                                    ${submissionCount > 0 ? `
                                        <div style="margin-bottom: 4px;">
                                            <strong style="color: #999;">提交次数:</strong> <span style="color: #fff;">${submissionCount}</span>
                                        </div>
                                    ` : ''}
                                    <div style="margin-bottom: 4px;">
                                        <strong style="color: #999;">状态:</strong> 
                                        <span style="color: ${statusColor}; font-weight: 600;">${status}</span>
                                    </div>
                                    <div style="margin-bottom: 4px;">
                                        <strong style="color: #999;">创建时间:</strong> 
                                        <span style="color: #fff;">${createTime}</span>
                                    </div>
                                    ${acOrAbandonTimeText ? `
                                        <div>
                                            <strong style="color: #999;">${isAC ? 'AC时间' : '放弃时间'}:</strong> 
                                            <span style="color: ${statusColor}; font-weight: 600;">${acOrAbandonTimeText.replace(/^(AC时间|放弃时间):\s*/, '')}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            // 绑定hover事件显示tooltip和点击事件跳转题目
            contentEl.querySelectorAll('.mirror-icon-container').forEach((container, index) => {
                const tooltip = document.getElementById(`mirror-tooltip-${index}`);
                if (!tooltip) return;
                
                // 点击事件：跳转到题目
                container.addEventListener('click', (e) => {
                    // 如果点击的是tooltip中的链接，不处理（让链接自己处理）
                    if (e.target.closest('.mirror-tooltip')) {
                        return;
                    }
                    const problemUrl = container.dataset.problemUrl;
                    if (problemUrl && problemUrl !== '#') {
                        window.open(problemUrl, '_blank');
                    }
                });
                
                container.addEventListener('mouseenter', (e) => {
                    tooltip.style.display = 'block';
                    // 动态调整位置，确保不超出视口
                    const rect = container.getBoundingClientRect();
                    const tooltipRect = tooltip.getBoundingClientRect();
                    const left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                    const top = rect.top - tooltipRect.height - 8;
                    
                    // 检查是否超出左边界
                    if (left < 10) {
                        tooltip.style.left = '10px';
                        tooltip.style.transform = 'none';
                    } else if (left + tooltipRect.width > window.innerWidth - 10) {
                        tooltip.style.left = 'auto';
                        tooltip.style.right = '10px';
                        tooltip.style.transform = 'none';
                    } else {
                        tooltip.style.left = '50%';
                        tooltip.style.transform = 'translateX(-50%)';
                    }
                    
                    // 检查是否超出上边界
                    if (top < 10) {
                        tooltip.style.top = 'auto';
                        tooltip.style.bottom = '100%';
                        tooltip.style.marginBottom = '8px';
                        tooltip.style.marginTop = '0';
                    } else {
                        tooltip.style.top = 'auto';
                        tooltip.style.bottom = '100%';
                        tooltip.style.marginBottom = '8px';
                    }
                });
                
                container.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                });
            });
        } catch (error) {
            console.error('加载我的镜像失败:', error);
            contentEl.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #ff4d4f; font-size: 14px;">
                    加载失败，请稍后重试
                </div>
            `;
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
                        const profileUrl = `#/profile?userId=${encodeURIComponent(String(user.userId))}`;
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
                                        <a href="${profileUrl}" style="color: #667eea; text-decoration: none; font-weight: 500;">
                                            ${nickname}
                                        </a>
                                    </div>
                                </td>
                                <td style="padding: 12px; text-align: right;">
                                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                                        <div style="font-size: 12px; font-weight: 600; color: ${helpers.getBattleRank(user.levelScore || 0).color};">
                                            ${helpers.getBattleRank(user.levelScore || 0).name}
                                        </div>
                                        <div style="font-size: 14px; font-weight: 600; color: ${helpers.getRatingColor(user.levelScore || 0)};">
                                            ${user.levelScore || 0}
                                        </div>
                                    </div>
                                </td>
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
            <div style="display: flex; gap: 8px; align-items: center;">
                <button id="battle-rankings-prev" 
                        class="pagination-btn" 
                        ${this.rankingsPage <= 1 ? 'disabled' : ''}
                        style="padding: 6px 12px; border: 1px solid #ddd; background: ${this.rankingsPage <= 1 ? '#f5f5f5' : '#fff'}; border-radius: 4px; cursor: ${this.rankingsPage <= 1 ? 'not-allowed' : 'pointer'}; color: ${this.rankingsPage <= 1 ? '#999' : '#333'}; ${this.rankingsPage <= 1 ? 'opacity: 0.5;' : ''}">
                    上一页
                </button>
                <div style="display: flex; gap: 4px; align-items: center;">
                    <span style="font-size: 14px; color: #666;">跳转到</span>
                    <input type="number" 
                           id="battle-rankings-page-input" 
                           min="1" 
                           max="${totalPages}" 
                           value="${this.rankingsPage}"
                           style="width: 60px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-size: 14px;"
                           onkeypress="if(event.key==='Enter'){document.getElementById('battle-rankings-go-btn').click();}">
                    <span style="font-size: 14px; color: #666;">页</span>
                    <button id="battle-rankings-go-btn" 
                            class="pagination-btn"
                            style="padding: 6px 12px; border: 1px solid #667eea; background: #667eea; color: #fff; border-radius: 4px; cursor: pointer;">
                        跳转
                    </button>
                </div>
                <button id="battle-rankings-next" 
                        class="pagination-btn" 
                        ${this.rankingsPage >= totalPages ? 'disabled' : ''}
                        style="padding: 6px 12px; border: 1px solid #ddd; background: ${this.rankingsPage >= totalPages ? '#f5f5f5' : '#fff'}; border-radius: 4px; cursor: ${this.rankingsPage >= totalPages ? 'not-allowed' : 'pointer'}; color: ${this.rankingsPage >= totalPages ? '#999' : '#333'}; ${this.rankingsPage >= totalPages ? 'opacity: 0.5;' : ''}">
                    下一页
                </button>
            </div>
        `;
        
        // 绑定分页事件
        const prevBtn = document.getElementById('battle-rankings-prev');
        const nextBtn = document.getElementById('battle-rankings-next');
        const goBtn = document.getElementById('battle-rankings-go-btn');
        const pageInput = document.getElementById('battle-rankings-page-input');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.rankingsPage > 1) {
                this.rankingsPage--;
                this.loadRankingsList();
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.rankingsPage < totalPages) {
                this.rankingsPage++;
                this.loadRankingsList();
                }
            });
        }
        
        if (goBtn && pageInput) {
            goBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const targetPage = parseInt(pageInput.value, 10);
                if (targetPage >= 1 && targetPage <= totalPages && targetPage !== this.rankingsPage) {
                    this.rankingsPage = targetPage;
                    this.loadRankingsList();
                } else if (targetPage < 1 || targetPage > totalPages) {
                    alert(`请输入 1 到 ${totalPages} 之间的页码`);
                    pageInput.value = this.rankingsPage;
                }
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
        let currentTemplate = this.templateInfo || { templateCode: {}, maxLength: 10000 };
        
        // 如果模板信息未加载，先加载
        if (!this.templateInfo) {
            try {
                currentTemplate = await this.api.battleTemplate(1); // 默认使用type=1
                this.templateInfo = currentTemplate;
            } catch (error) {
                console.error('加载模板信息失败:', error);
            }
        }
        
        // 所有编程语言配置（按照图片中的顺序，使用从0开始的连续ID）
        // 按照图片中的顺序排列：C++(clang++18)是0，C++(g++13)是1，以此类推
        const allLanguages = [
            { id: 0, name: 'C++ (clang++18)', maxLength: currentTemplate.maxLength || 10000 },
            { id: 1, name: 'C++(g++ 13)', maxLength: currentTemplate.maxLength || 10000 },
            { id: 2, name: 'C(gcc 10)', maxLength: currentTemplate.maxLength || 10000 },
            { id: 3, name: 'Java', maxLength: currentTemplate.maxLength || 10000 },
            { id: 4, name: 'C', maxLength: currentTemplate.maxLength || 10000 },
            { id: 5, name: 'Python2', maxLength: currentTemplate.maxLength || 10000 },
            { id: 6, name: 'Python3', maxLength: currentTemplate.maxLength || 10000 },
            { id: 7, name: 'pypy2', maxLength: currentTemplate.maxLength || 10000 },
            { id: 8, name: 'pypy3', maxLength: currentTemplate.maxLength || 10000 },
            { id: 9, name: 'C#', maxLength: currentTemplate.maxLength || 10000 },
            { id: 10, name: 'PHP', maxLength: currentTemplate.maxLength || 10000 },
            { id: 11, name: 'JavaScript V8', maxLength: currentTemplate.maxLength || 10000 },
            { id: 12, name: 'JavaScript Node', maxLength: currentTemplate.maxLength || 10000 },
            { id: 13, name: 'R', maxLength: currentTemplate.maxLength || 10000 },
            { id: 14, name: 'Go', maxLength: currentTemplate.maxLength || 10000 },
            { id: 15, name: 'Ruby', maxLength: currentTemplate.maxLength || 10000 },
            { id: 16, name: 'Rust', maxLength: currentTemplate.maxLength || 10000 },
            { id: 17, name: 'Swift', maxLength: currentTemplate.maxLength || 10000 },
            { id: 18, name: 'ObjC', maxLength: currentTemplate.maxLength || 10000 },
            { id: 19, name: 'Pascal', maxLength: currentTemplate.maxLength || 10000 },
            { id: 20, name: 'matlab', maxLength: currentTemplate.maxLength || 10000 },
            { id: 21, name: 'bash', maxLength: currentTemplate.maxLength || 10000 },
            { id: 22, name: 'Scala', maxLength: currentTemplate.maxLength || 10000 },
            { id: 23, name: 'Kotlin', maxLength: currentTemplate.maxLength || 10000 },
            { id: 24, name: 'Groovy', maxLength: currentTemplate.maxLength || 10000 },
            { id: 25, name: 'TypeScript', maxLength: currentTemplate.maxLength || 10000 }
        ];
        
        const languages = allLanguages;
        
        // 解析模板代码（可能是JSON字符串或对象）
        let templateCode = {};
        
        try {
            if (typeof currentTemplate.templateCode === 'string') {
                templateCode = JSON.parse(currentTemplate.templateCode) || {};
            } else {
                templateCode = currentTemplate.templateCode || {};
            }
        } catch (e) {
            console.error('解析模板代码失败:', e);
            templateCode = {};
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
        
        templateCode = normalizeTemplateCode(templateCode);
        
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
                    
                    <!-- 对战模板（人机和1v1共用） -->
                    <div>
                        <h4 style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #52c41a;">
                            ⚙️ 对战模板（人机和1v1共用）
                        </h4>
                        <div style="background: #f5f5f5; border-radius: 8px; padding: 12px;">
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px;">选择编程语言</label>
                                <select id="battle-template-lang-select" 
                                        style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px; background: #fff; cursor: pointer;">
                                    ${languageOptions}
                                </select>
                            </div>
                            <div id="battle-template-editor-container" style="position: relative;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 12px; color: #999;">最大长度: ${currentTemplate.maxLength || 10000} 字符</span>
                                    <span class="template-char-count" style="font-size: 12px; color: #666;">0 / ${currentTemplate.maxLength || 10000}</span>
                                </div>
                                <textarea id="battle-template-code-editor" 
                                          class="template-code-editor"
                                          data-max-length="${currentTemplate.maxLength || 10000}"
                                          placeholder="请输入初始代码..."
                                          style="width: 100%; height: 200px; padding: 12px; border: 1px solid #e5e7eb; 
                                                 border-radius: 6px; font-family: 'Courier New', monospace; 
                                                 font-size: 14px; resize: vertical; tab-size: 4; -moz-tab-size: 4;">${templateCode[String(defaultLangId)] || ''}</textarea>
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
        const templateCodeData = {};
        
        // 初始化：加载当前选择的语言的代码
        const select = document.getElementById('battle-template-lang-select');
        const editor = document.getElementById('battle-template-code-editor');
        
        // 初始化代码数据
        languages.forEach(lang => {
            const langIdStr = String(lang.id);
            templateCodeData[langIdStr] = templateCode[langIdStr] || '';
        });
        
        // 语言下拉框切换处理
        const handleLangChange = () => {
            const selectedLangId = select.value;
            const langIdStr = String(selectedLangId);
            
            // 保存当前编辑器的内容
            templateCodeData[select.dataset.currentLang || String(defaultLangId)] = editor.value;
            
            // 更新编辑器内容
            editor.value = templateCodeData[langIdStr] || '';
            select.dataset.currentLang = langIdStr;
            
            // 更新字符计数
            this.updateCharCount(editor);
        };
        
        // 初始化当前语言标记
        select.dataset.currentLang = String(defaultLangId);
        
        // 绑定下拉框切换事件
        select.addEventListener('change', handleLangChange);
        
        // 字符计数更新
        editor.addEventListener('input', () => {
            this.updateCharCount(editor);
        });
        // 初始化字符计数
        this.updateCharCount(editor);
        
        // 处理 Tab 键：在文本框中插入制表符而不是切换焦点
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault(); // 阻止默认的焦点切换行为
                
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                const text = editor.value;
                
                // 在光标位置插入制表符
                editor.value = text.substring(0, start) + '\t' + text.substring(end);
                
                // 设置光标位置到插入的制表符之后
                editor.selectionStart = editor.selectionEnd = start + 1;
                
                // 触发 input 事件以更新字符计数
                editor.dispatchEvent(new Event('input'));
            }
        });
        
        // 保存设置
        const saveTemplate = async () => {
            try {
                // 保存当前正在编辑的语言代码
                const currentLang = select.dataset.currentLang || select.value;
                templateCodeData[currentLang] = editor.value.trim();
                
                // 收集模板代码（使用数字ID作为key，如 "1", "2", "4"）
                const templateCodeToSave = {};
                for (const [langId, code] of Object.entries(templateCodeData)) {
                    if (code && code.trim()) {
                        templateCodeToSave[langId] = code.trim();
                    }
                }
                
                // 保存模板（默认使用type=1，人机和1v1共用）
                await this.api.battleUpdateTemplate(1, JSON.stringify(templateCodeToSave));
                
                alert('初始代码设置成功！');
                closeModal();
                
                // 重新加载模板信息
                const newTemplate = await this.api.battleTemplate(1);
                this.templateInfo = newTemplate;
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
                        <li><strong>镜像模式：</strong>可以创建自己的镜像，等待其他玩家挑战，实现"跨时空挑战"</li>
                    </ul>
                    <p>
                        对战开始后，系统会实时更新双方的提交状态。当双方都完成（AC）或放弃后，系统会根据规则自动结算分数。
                    </p>
                </div>
            </div>
            
            <!-- 初始分数和赛季重置说明 -->
            <div style="background: #e6f7ff; padding: 20px; border-radius: 12px; border: 2px solid #91d5ff; margin-bottom: 24px;">
                <h3 style="font-size: 18px; color: #333; margin-bottom: 16px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    <span>ℹ️</span> <span>初始分数与赛季重置</span>
                </h3>
                <div style="color: #666; line-height: 1.8;">
                    <div style="margin-bottom: 6px;">• 如果没有进行过对战，等级分将初始化为 <span style="color: #1890ff; font-weight: 600;">500 分</span></div>
                    <div style="margin-bottom: 6px;">• 每个赛季开始时，所有玩家的等级分将重置，但可以继承部分上赛季分数</div>
                    <div style="margin-bottom: 6px;">• 内测赛季重置时，参与过 1v1 对战的玩家会按历史 rating 获得牛币奖励：<span style="color: #1890ff; font-weight: 600;">10 × max(1, rating / 100 - 8)</span></div>
                    <div style="margin-bottom: 6px;">• 对战等级不会重置</div>
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

            <!-- 反作弊与惩罚 -->
            <div style="background: #fff1f0; padding: 20px; border-radius: 12px; margin-top: 24px; border: 2px solid #ffccc7;">
                <h3 style="font-size: 18px; color: #333; margin-bottom: 12px; font-weight: 600;">🛡️ 反作弊与惩罚</h3>
                <div style="color: #666; line-height: 1.9;">
                    <div style="margin-bottom: 6px;">
                        为保证公平竞技，严禁使用脚本/外挂/自动化提交等作弊行为。
                    </div>
                    <div style="margin-bottom: 6px;">
                        一经发现将视情节严重性采取惩罚措施：<span style="color:#cf1322; font-weight:700;">扣除 rating、清理异常数据、封禁账号</span> 等。
                    </div>
                    <div style="font-size: 12px; color:#999; margin-top: 6px;">
                        如遇异常对局/疑似作弊，可反馈给管理员协助处理。
                    </div>
                </div>
            </div>
            
            <div style="background: #f6ffed; padding: 20px; border-radius: 12px; margin-top: 24px; border: 2px solid #b7eb8f;">
                <h3 style="font-size: 18px; color: #333; margin-bottom: 16px; font-weight: 600;">🪞 镜像模式说明</h3>
                <div style="line-height: 1.8; color: #666;">
                    <p style="margin-bottom: 12px;">
                        镜像模式是一个特殊的对战模式，让你可以创建自己的镜像，等待其他玩家挑战，实现"跨时空挑战"。
                    </p>
                    <ul style="margin-left: 20px; margin-bottom: 12px;">
                        <li><strong>创建镜像：</strong>你可以创建自己的镜像，系统会记录你当前的对战状态和表现</li>
                        <li><strong>等待挑战：</strong>创建的镜像会保存在系统中，其他玩家可以挑战你的镜像</li>
                        <li><strong>跨时空挑战：</strong>即使你不在线，其他玩家也可以挑战你的镜像，与你进行对战</li>
                        <li><strong>分数影响：</strong>镜像模式的对战结果会影响你的等级分和经验值，就像正常对战一样</li>
                        <li><strong>开启时机：</strong>当匹配不到对手时，可以开启镜像模式创建镜像，等待其他玩家挑战</li>
                    </ul>
                    <p style="color: #999; font-size: 14px; margin-top: 8px;">
                        💡 提示：镜像模式让你即使不在线时也能与其他玩家对战，同时其他玩家也可以挑战你的镜像，实现跨时空的竞技体验。
                    </p>
                </div>
            </div>
            
            <div style="background: #e6f7ff; padding: 20px; border-radius: 12px; margin-top: 24px; border: 2px solid #91d5ff;">
                <h3 style="font-size: 18px; color: #333; margin-bottom: 16px; font-weight: 600;">💡 温馨提示</h3>
                <ul style="line-height: 1.8; color: #666; margin-left: 20px;">
                    <li><strong style="color: #ff4d4f;">⚠️ 重要提示：</strong>不同于平时练习，对战时禁止复制代码。请在牛客在线IDE中完成代码编写和提交</li>
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
            <h2 style="font-size: 20px; color: #333; margin-bottom: 20px;">📋 对战记录${this.recordsTargetUserId ? `（UID: ${this.recordsTargetUserId}）` : ''}</h2>
            
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
                        ${isWaiting ? `
                        <div style="margin-top:12px;padding:12px;background:#fff7e6;border-left:3px solid #faad14;border-radius:4px;margin-bottom:12px;">
                            <div style="font-size:13px;color:#856404;line-height:1.6;">
                                <div style="font-weight:600;margin-bottom:4px;">⚠️ 重要提示：</div>
                                <div>• 请不要关闭此窗口，等待好友加入后即可开始对战</div>
                                <div>• 分享房间码给好友，让他们加入对战吧！</div>
                            </div>
                        </div>
                        ` : ''}
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
            // 构建包含房间号、tracker链接和引导话术的完整文本
            const trackerUrl = window.location.origin + window.location.pathname + '#battle';
            const copyText = `房间号：${roomCode}

快来和我一起对战吧！点击链接加入：
${trackerUrl}

在对战平台输入房间号 "${roomCode}" 即可加入对战！`;
            
            navigator.clipboard.writeText(copyText).then(() => {
                copyBtn.textContent = '已复制！';
                setTimeout(() => {
                    copyBtn.textContent = '复制房间码';
                }, 2000);
            }).catch(err => {
                console.error('复制失败:', err);
                // 降级方案：只复制房间号
                navigator.clipboard.writeText(roomCode).then(() => {
                    copyBtn.textContent = '已复制房间号';
                setTimeout(() => {
                    copyBtn.textContent = '复制房间码';
                }, 2000);
                });
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
        // 解析 startTime：如果是13位数字（毫秒），直接使用；如果是10位（秒），乘以1000
        const serverStartTime = result.startTime ? (result.startTime > 1000000000000 ? result.startTime : result.startTime * 1000) : null;
        
        // 计算时间偏移量：如果后端返回了服务器当前时间，可以用来校准
        // 这里我们假设 startTime 是基于服务器时间的，通过计算剩余时间来避免时间不同步问题
        const clientNow = Date.now();
        let startTime = serverStartTime;
        
        if (serverStartTime) {
            // 计算剩余时间（秒）
            const remainingSeconds = Math.max(0, Math.floor((serverStartTime - clientNow) / 1000));
            console.log('updateRoomCreatedModal - 服务器startTime:', serverStartTime, '客户端当前时间:', clientNow, '剩余秒数:', remainingSeconds);
            
            // 如果剩余时间合理（0-60秒之间），使用相对时间方式
            // 这样可以避免客户端时间不准确的问题
            if (remainingSeconds >= 0 && remainingSeconds <= 60) {
                // 使用客户端时间 + 剩余时间作为目标时间
                startTime = clientNow + remainingSeconds * 1000;
                console.log('使用相对时间方式，调整后的startTime:', startTime);
            } else if (remainingSeconds < 0) {
                // 如果已经过期，使用默认值
                console.warn('startTime已过期，使用默认值');
                startTime = null;
            }
        }
        
        console.log('updateRoomCreatedModal - final startTime:', startTime, 'result:', result);
        
        // 更新模态框内容
        const modal = this.roomCreatedModal;
        const modalActions = modal.querySelector('.modal-actions');
        let enterBtn = null;
        if (modalActions) {
            modalActions.innerHTML = `
                <button id="battle-room-enter" 
                        class="admin-btn" 
                        disabled
                        style="background:#d9d9d9;color:#fff;border:1px solid #d9d9d9;padding:10px 24px;cursor:not-allowed;opacity:0.6;">
                    进入对战
                </button>
            `;
            
            enterBtn = document.getElementById('battle-room-enter');
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
        
        // 添加倒计时（确保倒计时容器存在）
        const body = modal.querySelector('.modal-body > div');
        let countdownContainer = modal.querySelector('#battle-room-countdown-container');
        
        if (!countdownContainer) {
            const countdownHtml = `
                <div id="battle-room-countdown-container" style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;">
                    <div id="battle-room-countdown-text" style="font-size:16px;font-weight:600;color:#667eea;">
                        对战即将开始，<span id="battle-room-countdown-seconds">--</span>秒
                    </div>
                </div>
            `;
            // 尝试在 title 后面插入，如果找不到 title，就在 body 的第一个 div 后面插入
            if (title && title.parentElement) {
            title.insertAdjacentHTML('afterend', countdownHtml);
            } else if (body && body.firstElementChild) {
                body.firstElementChild.insertAdjacentHTML('afterend', countdownHtml);
            } else if (body) {
                body.insertAdjacentHTML('beforeend', countdownHtml);
            }
            countdownContainer = modal.querySelector('#battle-room-countdown-container');
        }
        
        // 更新提示文字
        const tip = modal.querySelector('.modal-body > div:last-child > div:last-child');
        if (tip) tip.textContent = '房间已满，准备开始对战！';
        
        // 更新状态并启动倒计时
        this.roomCreatedModalData.roomStatus = 'started';
        
        // 确保倒计时容器存在后再启动倒计时
        if (countdownContainer) {
            // 如果 startTime 存在且未过期，使用它；否则使用默认值（当前时间+5秒）
            let finalStartTime = startTime;
            const clientNow = Date.now();
            if (!finalStartTime || clientNow >= finalStartTime) {
                // 如果没有startTime或已过期，使用默认值（当前时间+5秒）
                finalStartTime = clientNow + 5000;
                console.log('startTime不存在或已过期，使用默认值:', finalStartTime);
            }
            const remainingSeconds = Math.floor((finalStartTime - clientNow) / 1000);
            console.log('启动倒计时 - finalStartTime:', finalStartTime, '客户端当前时间:', clientNow, '剩余秒数:', remainingSeconds, 'enterBtn:', enterBtn);
            this.startRoomCountdown(finalStartTime, enterBtn, { roomId });
        } else {
            console.error('倒计时容器不存在，无法启动倒计时', { 
                body, 
                countdownContainer, 
                modal: this.roomCreatedModal,
                modalHTML: this.roomCreatedModal ? this.roomCreatedModal.innerHTML.substring(0, 200) : 'null'
            });
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
                console.log('房间轮询结果:', result, '期望的roomId:', roomId);
                
                // 检查是否有人加入：matched为true且roomId匹配，或者有startTime且roomId匹配
                if (result && result.roomId === roomId && (result.matched || result.startTime)) {
                    // 房间已开始（有人加入）
                    console.log('检测到房间已满，停止轮询并更新模态框', result);
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
        
        console.log('startRoomCountdown - startTime:', startTime, 'enterBtn:', enterBtn);
        
        const updateCountdown = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((startTime - now) / 1000));
            const countdownEl = document.getElementById('battle-room-countdown-seconds');
            
            console.log('updateCountdown - remaining:', remaining, 'countdownEl:', countdownEl);
            
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
            } else {
                console.warn('倒计时元素不存在: #battle-room-countdown-seconds');
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
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;gap:12px;">
                    <button id="battle-already-return" 
                            class="admin-btn" 
                            style="background:#52c41a;color:#fff;border:1px solid #52c41a;padding:10px 48px;cursor:pointer;font-size:16px;font-weight:600;">
                        ${isInBattle ? '返回对战' : '返回房间'}
                    </button>
                    ${isInBattle ? `
                    <button id="battle-already-abandon" 
                            class="admin-btn" 
                            style="background:#ff4d4f;color:#fff;border:1px solid #ff4d4f;padding:10px 48px;cursor:pointer;font-size:16px;font-weight:600;">
                        放弃对战
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 使用 requestAnimationFrame 确保 DOM 完全渲染后再获取元素
        requestAnimationFrame(() => {
            this.bindModalEvents(modal, roomId, isInBattle);
        });
    }
    
    /**
     * 绑定模态框事件
     */
    bindModalEvents(modal, roomId, isInBattle) {
        const closeBtn = document.getElementById('battle-already-close');
        const returnBtn = document.getElementById('battle-already-return');
        const abandonBtn = document.getElementById('battle-already-abandon');
        
        const closeModal = () => modal.remove();
        const returnToRoom = async () => {
            if (roomId) {
                // 确保域名已初始化（强制刷新）
                await initBattleDomain(true);
                // 根据 roomMode 判断 battleType：ai=1，其他=2
                const battleType = this.roomMode === 'ai' ? 1 : 2;
                const url = getBattleUrl(roomId, battleType);
                window.open(url, '_blank');
            }
            closeModal();
        };
        
        const abandonBattle = async (e) => {
            console.log('abandonBattle 函数被调用', e);
            
            // 阻止事件冒泡，防止被 modal 的点击事件拦截
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            
            if (!isInBattle) {
                console.warn('放弃对战：isInBattle 为 false');
                return;
            }
            
            // 使用自定义确认对话框
            const confirmed = await this.showConfirmDialog(
                '确定要放弃当前对战吗？',
                '放弃后将无法恢复，且不会获得任何经验。',
                '放弃对战',
                '取消'
            );
            console.log('确认对话框结果:', confirmed);
            if (!confirmed) return;
            
            try {
                // 调用强制放弃接口
                await this.api.battleForceAbandon();
                // 使用自定义成功提示
                this.showSuccessMessage('已成功放弃对战，现在可以开始新的对战了');
                closeModal();
                // 刷新页面以更新状态
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } catch (error) {
                console.error('放弃对战失败:', error);
                this.showErrorMessage('放弃对战失败：' + (error.message || '未知错误'));
            }
        };
        
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeModal();
            });
        }
        if (returnBtn) {
            returnBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                returnToRoom();
            });
        }
        if (abandonBtn) {
            // 添加调试日志
            console.log('放弃对战按钮已找到，准备绑定事件', abandonBtn);
            // 使用捕获阶段绑定，确保事件优先处理
            abandonBtn.addEventListener('click', (e) => {
                console.log('放弃对战按钮被点击了', e);
                e.stopPropagation(); // 立即阻止冒泡
                e.preventDefault(); // 阻止默认行为
                abandonBattle(e);
            }, true); // 使用捕获阶段
            
            // 确保按钮可以点击
            abandonBtn.style.pointerEvents = 'auto';
            abandonBtn.style.cursor = 'pointer';
            abandonBtn.style.zIndex = '10001';
            abandonBtn.style.position = 'relative';
            
            // 添加鼠标悬停测试
            abandonBtn.addEventListener('mouseenter', () => {
                console.log('鼠标悬停在放弃对战按钮上');
            });
            
            // 测试按钮是否真的存在且可见
            setTimeout(() => {
                const testBtn = document.getElementById('battle-already-abandon');
                if (testBtn) {
                    console.log('按钮仍然存在，位置:', testBtn.getBoundingClientRect());
                    console.log('按钮样式:', window.getComputedStyle(testBtn));
                } else {
                    console.error('按钮在延迟检查时不存在了！');
                }
            }, 100);
        } else {
            console.warn('放弃对战按钮未找到，isInBattle:', isInBattle);
            console.warn('modal HTML:', modal.innerHTML.substring(0, 500));
        }
        
        // 只在点击 modal 背景时关闭，不拦截子元素的点击
        // 使用捕获阶段，但让子元素的事件先处理
        modal.addEventListener('click', (e) => {
            // 如果点击的是按钮或其他交互元素，不关闭 modal
            const clickedButton = e.target.closest('button');
            if (clickedButton && clickedButton.id === 'battle-already-abandon') {
                console.log('modal 点击事件检测到放弃按钮被点击，不处理');
                return;
            }
            if (e.target === modal) {
                closeModal();
            }
        }, false); // 使用冒泡阶段，让按钮的捕获事件先处理
    }

    /**
     * 显示自定义确认对话框
     * @param {string} title - 标题
     * @param {string} message - 消息内容
     * @param {string} confirmText - 确认按钮文本
     * @param {string} cancelText - 取消按钮文本
     * @returns {Promise<boolean>} 用户是否确认
     */
    showConfirmDialog(title, message, confirmText = '确定', cancelText = '取消') {
        return new Promise((resolve) => {
            const existing = document.getElementById('battle-confirm-dialog');
            if (existing) existing.remove();
            
            const modal = document.createElement('div');
            modal.id = 'battle-confirm-dialog';
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.zIndex = '10002'; // 确保在最上层
            modal.innerHTML = `
                <div class="modal-content" style="max-width:400px;">
                    <div class="modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="modal-body" style="padding:20px;">
                        <div style="font-size:14px;color:#666;line-height:1.6;">
                            ${message}
                        </div>
                    </div>
                    <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:12px;">
                        <button id="battle-confirm-cancel" 
                                class="admin-btn" 
                                style="background:#f5f5f5;color:#333;border:1px solid #e5e5e5;padding:10px 24px;cursor:pointer;font-size:14px;">
                            ${cancelText}
                        </button>
                        <button id="battle-confirm-ok" 
                                class="admin-btn" 
                                style="background:#ff4d4f;color:#fff;border:1px solid #ff4d4f;padding:10px 24px;cursor:pointer;font-size:14px;">
                            ${confirmText}
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            const closeDialog = (result) => {
                modal.remove();
                resolve(result);
            };
            
            const cancelBtn = document.getElementById('battle-confirm-cancel');
            const okBtn = document.getElementById('battle-confirm-ok');
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeDialog(false);
                });
            }
            if (okBtn) {
                okBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeDialog(true);
                });
            }
            
            // 点击背景关闭（返回 false）
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeDialog(false);
                }
            });
        });
    }

    /**
     * 显示成功消息
     * @param {string} message - 消息内容
     */
    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    /**
     * 显示错误消息
     * @param {string} message - 消息内容
     */
    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    /**
     * 显示消息提示
     * @param {string} message - 消息内容
     * @param {string} type - 类型：'success' 或 'error'
     */
    showMessage(message, type = 'success') {
        const existing = document.getElementById('battle-message-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'battle-message-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#52c41a' : '#ff4d4f'};
            color: #fff;
            padding: 12px 24px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10003;
            font-size: 14px;
            max-width: 400px;
            word-wrap: break-word;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // 3秒后自动消失
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 显示加入房间成功模态框
     */
    showJoinRoomSuccessModal(result) {
        const existing = document.getElementById('battle-join-room-success-modal');
        if (existing) existing.remove();
        
        const roomId = result.roomId;
        const serverStartTime = result.startTime ? (result.startTime > 1000000000000 ? result.startTime : result.startTime * 1000) : null;
        
        // 使用相对时间方式处理时间同步问题
        let startTime = serverStartTime;
        const clientNow = Date.now();
        let canEnterNow = !serverStartTime;
        
        if (serverStartTime) {
            // 计算剩余时间（秒）
            const remainingSeconds = Math.floor((serverStartTime - clientNow) / 1000);
            console.log('showJoinRoomSuccessModal - 服务器startTime:', serverStartTime, '客户端当前时间:', clientNow, '剩余秒数:', remainingSeconds);
            
            // 如果剩余时间合理（0-60秒之间），使用相对时间方式
            if (remainingSeconds >= 0 && remainingSeconds <= 60) {
                // 使用客户端时间 + 剩余时间作为目标时间
                startTime = clientNow + remainingSeconds * 1000;
                canEnterNow = false;
                console.log('使用相对时间方式，调整后的startTime:', startTime);
            } else if (remainingSeconds < 0) {
                // 如果已经过期，可以立即进入
                canEnterNow = true;
                startTime = null;
                console.log('startTime已过期，可以立即进入');
            } else {
                // 剩余时间超过60秒，可能是时间不同步，使用相对时间
                startTime = clientNow + Math.min(remainingSeconds, 60) * 1000;
                canEnterNow = false;
                console.log('剩余时间过长，使用相对时间方式');
            }
        }
        
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
                    <div id="battle-matching-invite-tip" style="display:none;margin-top:16px;padding:12px;background:#fff7e6;border-left:3px solid #faad14;border-radius:4px;text-align:left;">
                        <div style="font-size:13px;color:#856404;line-height:1.6;">
                            目前匹配人数较少，快<a id="battle-matching-invite-link" href="javascript:void(0);" style="color:#1890ff;text-decoration:underline;cursor:pointer;font-weight:600;">邀请</a>你的好友去对战吧！
                        </div>
                        <div id="battle-matching-copy-success" style="display:none;margin-top:8px;font-size:13px;color:#52c41a;font-weight:600;">
                            已复制邀请链接
                        </div>
                    </div>
                    <div id="battle-matching-mirror-tip" style="display:none;margin-top:16px;padding:16px;background:#e6f7ff;border:1px solid #91d5ff;border-radius:4px;">
                        <div style="font-size:14px;color:#1890ff;margin-bottom:12px;font-weight:600;">
                            💡 可选择开启镜像模式
                        </div>
                        <div style="display:flex;gap:8px;justify-content:center;">
                            <button id="battle-matching-enable-mirror" class="admin-btn" style="background:#1890ff;color:#fff;border:1px solid #1890ff;padding:8px 20px;font-size:14px;">开启镜像模式</button>
                        </div>
                    </div>
                    <div id="battle-matching-mirror-loading" style="display:none;margin-top:16px;padding:16px;text-align:center;">
                        <div style="font-size:14px;color:#666;">正在查询镜像...</div>
                    </div>
                    <div id="battle-matching-mirror-options" style="display:none;margin-top:16px;padding:16px;background:#f0f9ff;border:1px solid #91d5ff;border-radius:4px;">
                        <div id="battle-matching-no-mirror" style="display:none;">
                            <div style="font-size:14px;color:#666;margin-bottom:12px;">暂无可用镜像，您可以创建镜像供其他玩家挑战</div>
                            <button id="battle-matching-create-mirror" class="admin-btn" style="background:#52c41a;color:#fff;border:1px solid #52c41a;padding:8px 20px;font-size:14px;width:100%;">创建镜像房间</button>
                        </div>
                        <div id="battle-matching-has-mirror" style="display:none;">
                            <div style="font-size:14px;color:#666;margin-bottom:12px;">发现 <span id="battle-matching-mirror-count" style="color:#1890ff;font-weight:600;">0</span> 个可用镜像</div>
                            <button id="battle-matching-challenge-mirror" class="admin-btn" style="background:#1890ff;color:#fff;border:1px solid #1890ff;padding:8px 20px;font-size:14px;width:100%;">挑战镜像</button>
                        </div>
                    </div>
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
        const inviteTipEl = document.getElementById('battle-matching-invite-tip');
        const inviteLinkEl = document.getElementById('battle-matching-invite-link');
        
        if (!timerEl) return;
        
        // 绑定邀请链接点击事件
        if (inviteLinkEl) {
            inviteLinkEl.addEventListener('click', () => {
                const trackerUrl = window.location.origin + window.location.pathname + '#battle';
                const copyText = `快来和我一起对战吧！点击链接加入：
${trackerUrl}

在对战平台选择"1v1匹配"即可开始对战！`;
                
                navigator.clipboard.writeText(copyText).then(() => {
                    // 显示"已复制邀请链接"提示
                    const copySuccessEl = document.getElementById('battle-matching-copy-success');
                    if (copySuccessEl) {
                        copySuccessEl.style.display = 'block';
                        // 2秒后隐藏提示
                        setTimeout(() => {
                            copySuccessEl.style.display = 'none';
                        }, 2000);
                    }
                }).catch(err => {
                    console.error('复制失败:', err);
                    alert('复制失败，请手动复制链接');
                });
            });
        }
        
        // 绑定镜像模式相关按钮事件
        const enableMirrorBtn = document.getElementById('battle-matching-enable-mirror');
        const createMirrorBtn = document.getElementById('battle-matching-create-mirror');
        const challengeMirrorBtn = document.getElementById('battle-matching-challenge-mirror');
        
        if (enableMirrorBtn) {
            enableMirrorBtn.addEventListener('click', () => {
                this.handleEnableMirrorMode();
            });
        }
        
        if (createMirrorBtn) {
            createMirrorBtn.addEventListener('click', () => {
                this.handleCreateMirror();
            });
        }
        
        if (challengeMirrorBtn) {
            challengeMirrorBtn.addEventListener('click', () => {
                this.handleChallengeMirror();
            });
        }
        
        this.matchingTimer = setInterval(() => {
            if (!this.matchStartTime) return;
            const elapsed = Math.floor((Date.now() - this.matchStartTime) / 1000);
            timerEl.textContent = `已等待 ${elapsed} 秒`;
            
            // 超过10秒时显示邀请提示和镜像模式选项
            if (elapsed >= 10) {
                if (inviteTipEl) {
                    inviteTipEl.style.display = 'block';
                }
                const mirrorTipEl = document.getElementById('battle-matching-mirror-tip');
                if (mirrorTipEl && mirrorTipEl.style.display === 'none') {
                    mirrorTipEl.style.display = 'block';
                }
            }
        }, 1000);
    }
    
    /**
     * 处理开启镜像模式
     */
    async handleEnableMirrorMode() {
        // 停止匹配
        await this.cancelMatch();
        
        // 停止轮询和计时
        this.stopPolling();
        this.stopTimer();
        
        // 隐藏镜像模式提示，显示加载状态
        const mirrorTipEl = document.getElementById('battle-matching-mirror-tip');
        const loadingEl = document.getElementById('battle-matching-mirror-loading');
        const optionsEl = document.getElementById('battle-matching-mirror-options');
        const noMirrorEl = document.getElementById('battle-matching-no-mirror');
        const hasMirrorEl = document.getElementById('battle-matching-has-mirror');
        const mirrorCountEl = document.getElementById('battle-matching-mirror-count');
        
        if (mirrorTipEl) mirrorTipEl.style.display = 'none';
        if (loadingEl) loadingEl.style.display = 'block';
        if (optionsEl) optionsEl.style.display = 'none';
        
        try {
            // 查询可用镜像（只查询1v1模式）
            const result = await this.api.checkAvailableMirrors('1v1');
            
            if (loadingEl) loadingEl.style.display = 'none';
            if (optionsEl) optionsEl.style.display = 'block';
            
            if (result.hasMirrors && result.count > 0) {
                // 有可用镜像，显示挑战镜像选项
                if (noMirrorEl) noMirrorEl.style.display = 'none';
                if (hasMirrorEl) hasMirrorEl.style.display = 'block';
                if (mirrorCountEl) mirrorCountEl.textContent = result.count;
            } else {
                // 没有可用镜像，显示创建镜像房间选项
                if (noMirrorEl) noMirrorEl.style.display = 'block';
                if (hasMirrorEl) hasMirrorEl.style.display = 'none';
            }
        } catch (error) {
            console.error('查询镜像失败:', error);
            if (loadingEl) loadingEl.style.display = 'none';
            if (optionsEl) optionsEl.style.display = 'block';
            // 查询失败时，默认显示创建镜像选项
            if (noMirrorEl) noMirrorEl.style.display = 'block';
            if (hasMirrorEl) hasMirrorEl.style.display = 'none';
        }
    }
    
    /**
     * 处理创建镜像房间
     */
    async handleCreateMirror() {
        try {
            // 创建镜像房间（1v1模式）
            const result = await this.api.createMirrorRoom('1v1');
            
            // 隐藏匹配模态框
            this.hideMatchingModal();
            
            // 显示房间创建成功，进入对战
            if (result.roomId) {
                this.roomId = result.roomId;
                this.roomMode = 'mirror-create';
                this.showMatchResult({
                    matched: true,
                    roomId: result.roomId,
                    problemId: result.problemId,
                    startTime: result.startTime,
                    isMirror: true
                });
            }
        } catch (error) {
            console.error('创建镜像房间失败:', error);
            alert('创建镜像房间失败：' + (error.message || '未知错误'));
        }
    }
    
    /**
     * 处理挑战镜像
     */
    async handleChallengeMirror() {
        try {
            // 匹配镜像（1v1模式）
            const result = await this.api.matchMirror('1v1');
            
            // 隐藏匹配模态框
            this.hideMatchingModal();
            
            if (result.matched && result.roomId) {
                // 匹配成功，显示房间信息
                this.roomId = result.roomId;
                this.roomMode = 'mirror-challenge';
                this.showMatchResult({
                    matched: true,
                    roomId: result.roomId,
                    opponentId: result.opponentId,
                    problemId: result.problemId,
                    startTime: result.startTime,
                    isMirror: true
                });
            } else {
                alert(result.message || '挑战镜像失败，镜像可能已被其他玩家挑战');
            }
        } catch (error) {
            console.error('挑战镜像失败:', error);
            alert('挑战镜像失败：' + (error.message || '未知错误'));
        }
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
        // 判断是否是镜像模式
        const isMirrorMode = result.isMirror || this.roomMode === 'mirror-create' || this.roomMode === 'mirror-challenge';
        const isMirrorChallenge = this.roomMode === 'mirror-challenge';
        const isMirrorCreate = this.roomMode === 'mirror-create';
        
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
                    <h3>${isAIMode ? '正在生成AI对手' : (isMirrorChallenge ? '挑战镜像成功！' : (isMirrorCreate ? '镜像房间创建成功！' : '匹配成功！'))}</h3>
                    <button id="battle-result-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:48px;margin-bottom:12px;">${isAIMode ? '🤖' : (isMirrorMode ? '🪞' : '🎉')}</div>
                        <div style="font-size:18px;font-weight:600;color:#333;margin-bottom:8px;">
                            ${isAIMode ? '正在生成和你旗鼓相当的AI' : (isMirrorChallenge ? '已成功挑战镜像，准备开始对战' : (isMirrorCreate ? '镜像房间已创建，完成对战后将生成镜像' : '匹配成功'))}
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
            // 如果是镜像创建模式，关闭后刷新"我的镜像"列表
            if (isMirrorCreate) {
                this.loadMyMirrors();
            }
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
     * 绘制分数变化折线图
     * @param {number} currentScore1v1 - 当前1v1分数
     * @param {number} currentScoreAI - 当前人机分数
     */
    async drawRatingCharts(currentScore1v1, currentScoreAI) {
        // 绘制1v1对战分数变化图
        if (currentScore1v1 > 0) {
            await this.drawRatingChart('battle-1v1-chart', 2, currentScore1v1, '#667eea');
        }
        
        // 绘制人机对战分数变化图
        if (currentScoreAI > 0) {
            await this.drawRatingChart('battle-ai-chart', 1, currentScoreAI, '#52c41a');
        }
    }
    
    /**
     * 绘制单个分数变化折线图
     * @param {string} canvasId - Canvas元素ID
     * @param {number} type - 对战类型：1=人机对战，2=1v1对战
     * @param {number} currentScore - 当前分数
     * @param {string} color - 线条颜色
     */
    async drawRatingChart(canvasId, type, currentScore, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        try {
            // 获取最近10场记录
            const result = await this.api.battleRecordList(type, 1, 10);
            const records = (result.list || []).reverse(); // 反转，从旧到新
            
            if (records.length === 0) {
                // 如果没有记录，显示提示
                const ctx = canvas.getContext('2d');
                canvas.width = canvas.offsetWidth;
                canvas.height = 120;
                ctx.fillStyle = '#999';
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('暂无对战记录', canvas.width / 2, canvas.height / 2);
                return;
            }
            
            // 计算每场后的分数（从当前分数倒推）
            const scores = [];
            let score = currentScore;
            scores.push(score); // 当前分数
            
            for (let i = records.length - 1; i >= 0; i--) {
                const scoreChange = records[i].myScoreChange || 0;
                score = score - scoreChange; // 倒推：当前分数 - 变化 = 之前分数
                scores.unshift(score);
            }
            
            // 设置canvas尺寸
            const dpr = window.devicePixelRatio || 1;
            canvas.width = canvas.offsetWidth * dpr;
            canvas.height = 120 * dpr;
            canvas.style.width = canvas.offsetWidth + 'px';
            canvas.style.height = '120px';
            
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            
            const width = canvas.offsetWidth;
            const height = 120;
            const padding = { top: 20, right: 20, bottom: 30, left: 40 };
            const chartWidth = width - padding.left - padding.right;
            const chartHeight = height - padding.top - padding.bottom;
            
            // 清空画布
            ctx.clearRect(0, 0, width, height);
            
            // 计算分数范围
            const minScore = Math.min(...scores);
            const maxScore = Math.max(...scores);
            const scoreRange = maxScore - minScore || 100; // 避免除零
            const scorePadding = scoreRange * 0.1; // 上下留10%的边距
            
            // 绘制背景网格
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
                const y = padding.top + (chartHeight / 4) * i;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(padding.left + chartWidth, y);
                ctx.stroke();
            }
            
            // 绘制坐标轴
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 1;
            // Y轴
            ctx.beginPath();
            ctx.moveTo(padding.left, padding.top);
            ctx.lineTo(padding.left, padding.top + chartHeight);
            ctx.stroke();
            // X轴
            ctx.beginPath();
            ctx.moveTo(padding.left, padding.top + chartHeight);
            ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
            ctx.stroke();
            
            // 绘制折线
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            scores.forEach((score, index) => {
                const x = padding.left + (chartWidth / (scores.length - 1 || 1)) * index;
                const y = padding.top + chartHeight - ((score - minScore + scorePadding) / (scoreRange + scorePadding * 2)) * chartHeight;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
            
            // 绘制数据点
            ctx.fillStyle = color;
            scores.forEach((score, index) => {
                const x = padding.left + (chartWidth / (scores.length - 1 || 1)) * index;
                const y = padding.top + chartHeight - ((score - minScore + scorePadding) / (scoreRange + scorePadding * 2)) * chartHeight;
                
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            });
            
            // 绘制Y轴标签（分数）
            ctx.fillStyle = '#666';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            for (let i = 0; i <= 4; i++) {
                const score = maxScore + scorePadding - (scoreRange + scorePadding * 2) * (i / 4);
                const y = padding.top + (chartHeight / 4) * i;
                ctx.fillText(Math.round(score).toString(), padding.left - 8, y);
            }
            
        } catch (error) {
            console.error('绘制分数变化图失败:', error);
            const ctx = canvas.getContext('2d');
            canvas.width = canvas.offsetWidth;
            canvas.height = 120;
            ctx.fillStyle = '#999';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('加载失败', canvas.width / 2, canvas.height / 2);
        }
    }

    /**
     * 加载对战记录列表
     */
    async loadRecordsList() {
        const tbody = document.getElementById('battle-records-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">加载中...</div>';
        
        try {
            const result = this.recordsTargetUserId
                ? await this.api.battleRecordListByUser(this.recordsTargetUserId, this.recordsType, this.recordsPage, this.recordsLimit)
                : await this.api.battleRecordList(this.recordsType, this.recordsPage, this.recordsLimit);
            
            this.recordsList = result.list || [];
            // 按时间倒序排列（最新的在前）
            this.recordsList.sort((a, b) => {
                const timeA = a.startTime || a.createTime || 0;
                const timeB = b.startTime || b.createTime || 0;
                return timeB - timeA; // 倒序：时间大的在前
            });
            this.recordsTotal = result.total || 0;

            // 若在查看“他人战绩”，则预加载目标用户的昵称/头像（用于左侧展示）
            if (this.recordsTargetUserId) {
                const uid = String(this.recordsTargetUserId);
                if (!this.recordsTargetUserInfo || String(this.recordsTargetUserInfo.userId) !== uid) {
                    let info = { userId: uid, name: '', nickname: '', avatar: '' };
                    try {
                        const myInfo = await this.api.fetchUserInfo(uid);
                        const u = (myInfo && myInfo.user) ? myInfo.user : {};
                        info.name = String(u.name || '').trim();
                        info.nickname = String(u.nickName || u.nickname || '').trim();
                        info.avatar = this._normalizeAvatarUrl(u.headUrl || u.avatar || '');
                    } catch (_) {}
                    // 兜底：从过题榜抓一次头像/昵称
                    if (!info.name || !info.avatar) {
                        try {
                            const rankData = await this.api.fetchRankings('problem', 1, uid, 1);
                            const r0 = rankData?.ranks?.[0] || null;
                            if (r0) {
                                info.name = info.name || String(r0.name || '').trim();
                                info.nickname = info.nickname || String(r0.nickName || r0.nickname || '').trim();
                                info.avatar = info.avatar || this._normalizeAvatarUrl(r0.avatar || r0.headUrl || '');
                            }
                        } catch (_) {}
                    }
                    if (!info.name) info.name = `用户${uid}`;
                    if (!info.avatar) info.avatar = '';
                    this.recordsTargetUserInfo = info;
                }
            } else {
                this.recordsTargetUserInfo = null;
            }
            
            // 如果用户信息不完整，尝试从排行榜获取
            const currentUser = this.state.loggedInUserData || {};
            if ((!currentUser.nickname && !currentUser.name) && this.state.loggedInUserId) {
                try {
                    const rankData = await this.api.fetchRankings('problem', 1, this.state.loggedInUserId, 1);
                    if (rankData && rankData.ranks && rankData.ranks.length > 0) {
                        const userInfo = rankData.ranks[0];
                        this.state.loggedInUserData = {
                            ...currentUser,
                            nickname: userInfo.nickname || userInfo.name,
                            name: userInfo.name || userInfo.nickname,
                            avatar: userInfo.avatar || userInfo.headUrl,
                            headUrl: userInfo.headUrl || userInfo.avatar
                        };
                    }
                } catch (err) {
                    console.warn('获取用户信息失败:', err);
                }
            }
            
            this.renderRecordsList();
            this.renderRecordsPagination();
        } catch (error) {
            console.error('加载对战记录失败:', error);
            const msg = (error && error.message) ? error.message : '加载失败，请稍后重试';
            const loginHint = (!this.state.isLoggedIn())
                ? `<div style="margin-top:8px;color:#999;font-size:12px;">如提示无权限，可先登录再查看。</div>`
                : '';
            tbody.innerHTML = `<div style="padding: 40px; text-align: center; color: #f5222d;">${msg}${loginHint}</div>`;
        }
    }

    /**
     * 根据分数变化判断胜利/失败/平局
     * 规则：所有负分都是失败，+3也是失败，0分是平局，其余正分都是胜利
     * @param {number} scoreChange - 分数变化
     * @returns {string} 'win'表示胜利，'loss'表示失败，'draw'表示平局
     */
    getBattleResultByScoreChange(scoreChange) {
        // 分数为0是平局
        if (scoreChange === 0) {
            return 'draw';
        }
        // 所有负分都是失败
        if (scoreChange < 0) {
            return 'loss';
        }
        // +3分也是失败
        if (scoreChange === 3) {
            return 'loss';
        }
        // 其余正分都是胜利
        return 'win';
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
        
        // 左侧“本人”信息：查看他人战绩时应显示目标用户，否则显示自己
        const owner = this.recordsTargetUserId ? (this.recordsTargetUserInfo || {}) : (this.state.loggedInUserData || {});
        const ownerName = String(owner.name || '').trim();
        const ownerNick = String(owner.nickname || owner.nickName || '').trim();
        const myNickname = ownerNick || ownerName || (this.recordsTargetUserId ? `用户${this.recordsTargetUserId}` : '我');
        const myAvatar = this._normalizeAvatarUrl(owner.avatar || owner.headUrl || '');
        
        tbody.innerHTML = this.recordsList.map((record, index) => {
            // 格式化时间（只使用开始时间）
            const startTime = record.startTime ? new Date(record.startTime).toLocaleString('zh-CN') : '-';
            
            // 我的状态
            const myAc = record.myAc || false;
            const myAbandoned = record.myAbandoned || false;
            const myScoreChange = record.myScoreChange || 0;
            // 根据分数变化判断胜利/失败/平局，不依赖后端
            const battleResult = this.getBattleResultByScoreChange(myScoreChange);
            
            // 对手信息
            const opponent = record.opponent || {};
            const opponentNickname = opponent.nickname || opponent.name || (this.recordsType === 1 ? 'AI' : '未知');
            const opponentAvatar = opponent.avatar || opponent.headUrl || '';
            const opponentAc = opponent.ac || false;
            const opponentAbandoned = opponent.abandoned || false;
            
            // 我的状态文本（AC优先于放弃）
            let myStatusText = '';
            let myStatusColor = '#666';
            if (myAc) {
                myStatusText = 'AC';
                myStatusColor = '#52c41a';
            } else if (myAbandoned) {
                myStatusText = '放弃';
                myStatusColor = '#ff4d4f';
            } else {
                myStatusText = '做题中';
                myStatusColor = '#999';
            }
            
            // 对手状态文本（AC优先于放弃）
            let opponentStatusText = '';
            let opponentStatusColor = '#666';
            if (opponentAc) {
                opponentStatusText = 'AC';
                opponentStatusColor = '#52c41a';
            } else if (opponentAbandoned) {
                opponentStatusText = '放弃';
                opponentStatusColor = '#ff4d4f';
            } else {
                opponentStatusText = '做题中';
                opponentStatusColor = '#999';
            }
            
            // 分数变化颜色和文本
            const scoreChangeColor = myScoreChange > 0 ? '#52c41a' : myScoreChange < 0 ? '#ff4d4f' : '#666';
            const scoreChangeText = myScoreChange > 0 ? `+${myScoreChange}` : `${myScoreChange}`;
            
            // 结果文本和颜色（用于右侧标签，AC优先于放弃）
            let resultText = '';
            let resultColor = '#666';
            if (myAc) {
                if (battleResult === 'win') {
                    resultText = '胜利';
                    resultColor = '#52c41a';
                } else if (battleResult === 'loss') {
                    resultText = '失败';
                    resultColor = '#ff4d4f';
                } else {
                    resultText = '平局';
                    resultColor = '#faad14';
                }
            } else if (myAbandoned) {
                resultText = '放弃';
                resultColor = '#ff4d4f';
            } else {
                resultText = '做题中';
                resultColor = '#999';
            }
            
            // 检查是否是镜像对决
            // 如果记录有 isMirror 标记，或者对手是镜像挑战者，说明这是镜像对决
            const recordIsMirror = record.isMirror || false;
            const opponentIsMirrorChallenger = opponent.isMirrorChallenger || false;
            const opponentIsMirror = opponent.isMirror || false;
            
            // 判断当前用户的角色：
            // - 如果对手是镜像挑战者，则当前用户是镜像创建者
            // - 如果对手是镜像，则当前用户是镜像挑战者
            // - 如果记录有 isMirrorCreator 标记，当前用户是镜像创建者
            // - 如果记录有 isMirrorChallenger 标记，当前用户是镜像挑战者
            const isMirrorCreator = record.isMirrorCreator || opponentIsMirrorChallenger || false;
            const isMirrorChallenger = record.isMirrorChallenger || opponentIsMirror || false;
            const isMirrorBattle = recordIsMirror || isMirrorCreator || isMirrorChallenger;
            const mirrorTag = isMirrorCreator ? '🪞 镜像创建' : (isMirrorChallenger ? '🪞 镜像挑战' : '');
            
            return `
                <div class="battle-record-item" 
                     data-record-id="${record.id}" 
                     style="padding: 16px 20px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 20px; ${isMirrorBattle ? 'background: #f0f9ff; border-left: 3px solid #1890ff;' : ''}"
                     onmouseover="this.style.background='${isMirrorBattle ? '#e6f7ff' : '#f8f9fa'}'; ${!isMirrorBattle ? 'this.style.borderLeft=\'3px solid #667eea\'; this.style.paddingLeft=\'17px\';' : ''}"
                     onmouseout="this.style.background='${isMirrorBattle ? '#f0f9ff' : '#fff'}'; ${!isMirrorBattle ? 'this.style.borderLeft=\'none\'; this.style.paddingLeft=\'20px\';' : ''}">
                    <div style="font-size: 14px; color: #666; width: 180px; flex-shrink: 0;">
                        ${startTime}
                        ${mirrorTag ? `<div style="font-size: 11px; color: #1890ff; margin-top: 4px; font-weight: 600;">${mirrorTag}</div>` : ''}
                            </div>
                    <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${myAvatar ? `<img src="${myAvatar}" alt="${myNickname}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" onerror="this.style.display='none'" />` : ''}
                            <span style="font-size: 14px; color: #333; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;">${myNickname}</span>
                            <span style="padding: 2px 6px; background: ${myStatusColor}; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 600; flex-shrink: 0;">${myStatusText}</span>
                            </div>
                        <span style="color: #999; font-size: 14px; flex-shrink: 0;">vs</span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${opponentAvatar ? `<img src="${opponentAvatar}" alt="${opponentNickname}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" onerror="this.style.display='none'" />` : ''}
                            <span style="font-size: 14px; color: #333; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;">${opponentNickname}</span>
                            <span style="padding: 2px 6px; background: ${opponentStatusColor}; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 600; flex-shrink: 0;">${opponentStatusText}</span>
                            ${(isMirrorBattle && (opponentIsMirror || opponentIsMirrorChallenger)) ? '<span style="padding: 2px 6px; background: #1890ff; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 600; flex-shrink: 0;">🪞</span>' : ''}
                        </div>
                        </div>
                    <div style="font-size: 16px; font-weight: 600; color: ${scoreChangeColor}; min-width: 50px; text-align: right; flex-shrink: 0;">
                        ${scoreChangeText}
                    </div>
                </div>
            `;
        }).join('');
        
        // 绑定整行点击事件
        tbody.querySelectorAll('.battle-record-item').forEach(item => {
            item.addEventListener('click', () => {
                const recordId = item.dataset.recordId;
                this.viewRecordDetail(recordId);
            });
        });
    }

    /**
     * 渲染分页控件
     */
    renderRecordsPagination() {
        const pagination = document.getElementById('battle-records-pagination');
        if (!pagination) {
            console.warn('分页控件元素不存在');
            return;
        }
        
        const totalPages = Math.ceil(this.recordsTotal / this.recordsLimit);
        
        // 确保分页控件可见
        pagination.style.display = 'flex';
        pagination.style.justifyContent = 'space-between';
        pagination.style.alignItems = 'center';
        pagination.style.padding = '16px';
        pagination.style.borderTop = '1px solid #eee';
        
        if (totalPages <= 1) {
            pagination.innerHTML = `
                <div style="color: #666; font-size: 14px; width: 100%; text-align: center;">
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
                        style="padding: 6px 12px; border: 1px solid #ddd; background: ${this.recordsPage <= 1 ? '#f5f5f5' : '#fff'}; border-radius: 4px; cursor: ${this.recordsPage <= 1 ? 'not-allowed' : 'pointer'}; color: ${this.recordsPage <= 1 ? '#999' : '#333'}; ${this.recordsPage <= 1 ? 'opacity: 0.5;' : ''}">
                    上一页
                </button>
                <button id="battle-records-next" 
                        class="pagination-btn" 
                        ${this.recordsPage >= totalPages ? 'disabled' : ''}
                        style="padding: 6px 12px; border: 1px solid #ddd; background: ${this.recordsPage >= totalPages ? '#f5f5f5' : '#fff'}; border-radius: 4px; cursor: ${this.recordsPage >= totalPages ? 'not-allowed' : 'pointer'}; color: ${this.recordsPage >= totalPages ? '#999' : '#333'}; ${this.recordsPage >= totalPages ? 'opacity: 0.5;' : ''}">
                    下一页
                </button>
            </div>
        `;
        
        const prevBtn = document.getElementById('battle-records-prev');
        const nextBtn = document.getElementById('battle-records-next');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.recordsPage > 1) {
                this.recordsPage--;
                this.loadRecordsList();
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.recordsPage < totalPages) {
                this.recordsPage++;
                this.loadRecordsList();
                }
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
    /**
     * 显示赛季rating一览模态框
     */
    async showSeasonRatingModal() {
        const existing = document.getElementById('battle-season-rating-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'battle-season-rating-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:800px;max-height:90vh;overflow-y:auto;">
                <div class="modal-header">
                    <h3>赛季rating一览</h3>
                    <button id="battle-season-rating-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div id="battle-season-rating-content" style="text-align: center; padding: 40px; color: #999;">
                        加载中...
                    </div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;">
                    <button id="battle-season-rating-ok" class="admin-btn" style="background:#667eea;color:#fff;border:1px solid #667eea;">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const closeBtn = document.getElementById('battle-season-rating-close');
        const okBtn = document.getElementById('battle-season-rating-ok');
        const contentEl = document.getElementById('battle-season-rating-content');
        
        const closeModal = () => modal.remove();
        
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (okBtn) okBtn.addEventListener('click', closeModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        const info1v1 = (this.battleInfo && this.battleInfo.battle1v1) ? this.battleInfo.battle1v1 : {};
        const seasonData = this.normalizeSeasonHistory(info1v1.seasonHistory);
        contentEl.innerHTML = this.renderSeasonRatingContent(seasonData, info1v1);
    }

    normalizeSeasonHistory(history) {
        if (Array.isArray(history)) return history;
        if (typeof history === 'string' && history.trim()) {
            try {
                const parsed = JSON.parse(history);
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        }
        return [];
    }
    
    /**
     * 渲染赛季rating内容
     */
    renderSeasonRatingContent(seasonData, currentInfo = {}) {
        const currentScore = Number(currentInfo.levelScore ?? 500) || 500;
        const currentRank = helpers.getBattleRank(currentScore);
        const currentWin = Number(currentInfo.winCount ?? 0) || 0;
        const currentTotal = Number(currentInfo.totalCount ?? 0) || 0;
        const currentLose = Math.max(0, currentTotal - currentWin);
        const rows = [
            {
                seasonName: '第一赛季：赛场狂想曲',
                levelScore: currentScore,
                winCount: currentWin,
                loseCount: currentLose,
                totalCount: currentTotal,
                current: true
            },
            ...seasonData
        ];

        if (!rows.length) {
            return `
                <div style="font-size: 16px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
                    <div>暂无赛季数据</div>
                </div>
            `;
        }

        return `
            <div style="text-align:left;">
                <div style="background:linear-gradient(135deg,#0f172a 0%,#312e81 52%,#7c2d12 100%); color:#fff; border-radius:16px; padding:18px 20px; margin-bottom:16px; box-shadow:0 16px 42px rgba(15,23,42,0.22);">
                    <div style="font-size:12px; letter-spacing:.08em; opacity:.72; font-weight:800;">SEASON RATING</div>
                    <div style="font-size:24px; font-weight:900; margin-top:4px;">赛季 rating 一览</div>
                    <div style="font-size:13px; opacity:.78; margin-top:6px;">内测赛季的 rating 和胜负场已经归档；第一赛季的榜单，留给新的出手时刻。</div>
                </div>
                <div style="display:grid; gap:12px;">
                    ${rows.map((season) => {
                        const score = Number(season.levelScore ?? season.rating ?? 0) || 0;
                        const rank = helpers.getBattleRank(score || 500);
                        const win = Number(season.winCount ?? 0) || 0;
                        const total = Number(season.totalCount ?? 0) || 0;
                        const lose = Number(season.loseCount ?? Math.max(0, total - win)) || 0;
                        const rate = total > 0 ? `${((win / total) * 100).toFixed(1)}%` : '-';
                        const name = this.escapeHtml(this._normalizeSeasonName(season.seasonName));
                        return `
                            <div style="border:1px solid rgba(148,163,184,.35); border-left:4px solid ${rank.color}; border-radius:14px; padding:16px; background:${season.current ? 'linear-gradient(135deg,#f8fbff 0%,#fffaf0 100%)' : '#fff'};">
                                <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:12px;">
                                    <div>
                                        <div style="font-size:16px; font-weight:900; color:#111827;">${name}</div>
                                        <div style="font-size:12px; color:#64748b; margin-top:4px;">${season.current ? '当前赛季' : '已归档赛季'}</div>
                                    </div>
                                    <div style="text-align:right;">
                                        <div style="font-size:12px; color:${rank.color}; font-weight:800;">${rank.name}</div>
                                        <div style="font-size:24px; color:#111827; font-weight:900;">${score || '-'}</div>
                                    </div>
                                </div>
                                <div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px;">
                                    <div style="background:#f8fafc; border-radius:10px; padding:10px; text-align:center;"><div style="font-size:12px;color:#64748b;">胜场</div><div style="font-size:18px;font-weight:900;color:#111827;">${win}</div></div>
                                    <div style="background:#f8fafc; border-radius:10px; padding:10px; text-align:center;"><div style="font-size:12px;color:#64748b;">负场</div><div style="font-size:18px;font-weight:900;color:#111827;">${lose}</div></div>
                                    <div style="background:#f8fafc; border-radius:10px; padding:10px; text-align:center;"><div style="font-size:12px;color:#64748b;">总场次</div><div style="font-size:18px;font-weight:900;color:#111827;">${total}</div></div>
                                    <div style="background:#f8fafc; border-radius:10px; padding:10px; text-align:center;"><div style="font-size:12px;color:#64748b;">胜率</div><div style="font-size:18px;font-weight:900;color:#111827;">${rate}</div></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

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
            // acTime 是绝对时间戳（毫秒），需要计算相对于 startTime 的时间差
            const startTime = record.startTime || 0;
            if (!startTime) return '-';
            const timeDiff = acTime - startTime; // 时间差（毫秒）
            if (timeDiff < 0) return '-';
            const seconds = Math.floor(timeDiff / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}分${secs}秒`;
        };
        
        // 对战类型
        const typeText = record.type === 1 ? '人机对战' : record.type === 2 ? '1v1对战' : '未知';

        // 左侧“本人”信息：查看他人战绩时应显示目标用户，否则显示自己
        const owner = this.recordsTargetUserId ? (this.recordsTargetUserInfo || {}) : (this.state.loggedInUserData || {});
        const ownerName = String(owner.name || '').trim();
        const ownerNick = String(owner.nickname || owner.nickName || '').trim();
        const ownerDisplayName = ownerNick || ownerName || (this.recordsTargetUserId ? `用户${this.recordsTargetUserId}` : '我');
        const ownerAvatar = this._normalizeAvatarUrl(owner.avatar || owner.headUrl || '');
        const leftTitle = this.recordsTargetUserId ? ownerDisplayName : '我';
        
        // 对手信息
        const opponent = record.opponent || {};
        // 优先使用 nickname，如果没有则使用 name，最后使用默认值
        const opponentName = opponent.nickname || opponent.name || (record.type === 1 ? 'AI' : '未知');
        const opponentUserId = opponent.userId || (record.type === 1 ? -1 : null);
        const opponentAvatar = opponent.avatar || opponent.headUrl || '';
        const opponentAc = opponent.ac || false;
        
        // 检查是否是镜像对决
        // 如果记录有 isMirror 标记，或者对手是镜像挑战者，说明这是镜像对决
        const recordIsMirror = record.isMirror || false;
        const opponentIsMirrorChallenger = opponent.isMirrorChallenger || false;
        const opponentIsMirror = opponent.isMirror || false;
        
        // 判断当前用户的角色：
        // - 如果对手是镜像挑战者，则当前用户是镜像创建者
        // - 如果对手是镜像，则当前用户是镜像挑战者
        // - 如果记录有 isMirrorCreator 标记，当前用户是镜像创建者
        // - 如果记录有 isMirrorChallenger 标记，当前用户是镜像挑战者
        const isMirrorCreator = record.isMirrorCreator || opponentIsMirrorChallenger || false;
        const isMirrorChallenger = record.isMirrorChallenger || opponentIsMirror || false;
        const isMirrorBattle = recordIsMirror || isMirrorCreator || isMirrorChallenger;
        const mirrorTypeText = isMirrorCreator ? '镜像创建' : (isMirrorChallenger ? '镜像挑战' : '');
        
        // 我的信息
        const myAc = record.myAc || false;
        const myAcTime = record.myAcTime || 0;
        const myAbandoned = record.myAbandoned || false;
        const myScoreChange = record.myScoreChange || 0;
        // 根据分数变化判断胜利/失败/平局，不依赖后端
        const battleResult = this.getBattleResultByScoreChange(myScoreChange);
        const myScoreChangeColor = myScoreChange > 0 ? '#52c41a' : myScoreChange < 0 ? '#ff4d4f' : '#666';
        const myScoreChangeText = myScoreChange > 0 ? `+${myScoreChange}` : `${myScoreChange}`;
        const opponentAcTime = opponent.acTime || 0;
        const opponentAbandoned = opponent.abandoned || false;
        
        // 根据分数变化和双方状态生成详细文案
        let scoreChangeDesc = '';
        // 根据分数变化值推断基础分数和奖励时间加分
        if (myScoreChange === 20) {
            scoreChangeDesc = '（胜利+15以及奖励时间+5）';
        } else if (myScoreChange === 15) {
            scoreChangeDesc = '（先AC+15）';
        } else if (myScoreChange === 3) {
            scoreChangeDesc = '（后AC-2然后奖励时间+5）';
        } else if (myScoreChange === -2) {
            scoreChangeDesc = '（对手AC后AC-2）';
        } else if (myScoreChange === 2) {
            scoreChangeDesc = '（对手放弃后放弃+2）';
        } else if (myScoreChange === -12) {
            scoreChangeDesc = '（对手AC后放弃-12）';
        } else if (myScoreChange === -15) {
            scoreChangeDesc = '（先放弃-15）';
        } else if (myScoreChange === -20) {
            scoreChangeDesc = '（双方超时均未AC/放弃-20）';
        } else if (myScoreChange === 0) {
            scoreChangeDesc = '（平局，无变化）';
        } else {
            // 其他情况，尝试推断是否有奖励时间加分
            // 如果分数是15的倍数+5，可能是先AC+奖励时间
            if (myScoreChange > 15 && (myScoreChange - 15) % 5 === 0) {
                const baseScore = 15;
                const bonusScore = myScoreChange - baseScore;
                scoreChangeDesc = `（胜利+${baseScore}以及奖励时间+${bonusScore}）`;
            }
            // 如果分数是-2+5的倍数，可能是后AC+奖励时间
            else if (myScoreChange > -2 && (myScoreChange + 2) % 5 === 0) {
                const baseScore = -2;
                const bonusScore = myScoreChange - baseScore;
                scoreChangeDesc = `（后AC${baseScore}然后奖励时间+${bonusScore}）`;
            } else {
                scoreChangeDesc = '';
            }
        }
        
        // 结果（AC优先于放弃）
        let resultText = '';
        let resultColor = '#666';
        if (myAc) {
            if (battleResult === 'win') {
                resultText = '胜利';
                resultColor = '#52c41a';
            } else if (battleResult === 'loss') {
                resultText = '失败';
                resultColor = '#ff4d4f';
            } else {
                resultText = '平局';
                resultColor = '#faad14';
            }
        } else if (myAbandoned) {
            resultText = '放弃';
            resultColor = '#ff4d4f';
        } else {
            resultText = '做题中';
            resultColor = '#999';
        }
        
        return `
            ${isMirrorBattle ? `
            <div style="margin-bottom: 20px; background: #e6f7ff; border: 2px solid #1890ff; border-radius: 8px; padding: 16px;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; color: #1890ff;">
                    <span>🪞</span>
                    <span>镜像对决 - ${mirrorTypeText}</span>
                </div>
                <div style="font-size: 13px; color: #666; margin-top: 8px;">
                    ${isMirrorCreator ? '您创建了镜像，其他玩家可以挑战您的镜像进行对战。' : '您挑战了其他玩家创建的镜像进行对战。'}
                </div>
            </div>
            ` : ''}
            <div style="margin-bottom: 20px;">
                <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px;">基本信息</div>
                <div style="background: #f5f5f5; padding: 12px; border-radius: 6px;">
                    <div style="margin-bottom: 8px;"><strong>对战类型:</strong> ${typeText}${isMirrorBattle ? ` <span style="color: #1890ff; font-weight: 600;">(镜像)</span>` : ''}</div>
                    <div style="margin-bottom: 8px;">
                        <strong>题目:</strong> 
                        ${record.problemId ? 
                            `<a href="https://ac.nowcoder.com/acm/problem/${record.problemId}" target="_blank" rel="noopener noreferrer" style="color: #1890ff; text-decoration: none; font-weight: 500;">${record.problemId}</a>` 
                            : '-'}
                    </div>
                    <div style="margin-bottom: 8px;"><strong>房间ID:</strong> ${record.roomId || '-'}</div>
                    <div style="margin-bottom: 8px;"><strong>开始时间:</strong> ${formatTime(record.startTime)}</div>
                    <div style="margin-bottom: 8px;"><strong>结束时间:</strong> ${formatTime(record.endTime)}</div>
                    <div><strong>创建时间:</strong> ${formatTime(record.createTime)}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px;">对战结果</div>
                <div style="background: ${resultColor}; color: #fff; padding: 12px; border-radius: 6px; text-align: center; font-size: 18px; font-weight: 600;">
                    ${resultText} | 分数变动: <span style="color: #fff;">${myScoreChangeText}${scoreChangeDesc}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px;">对战双方</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div style="background: #f0f5ff; padding: 16px; border-radius: 6px; border: 2px solid #667eea;">
                        <div style="font-weight: 600; color: #667eea; margin-bottom: 12px; font-size: 16px; display:flex; align-items:center; gap:8px;">
                            ${ownerAvatar ? `<img src="${ownerAvatar}" alt="${leftTitle}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;" onerror="this.style.display='none'" />` : ''}
                            <span>${leftTitle}</span>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <strong>状态:</strong> 
                            ${myAc ? `<span style="color: #52c41a;">✅ AC (${formatAcTime(myAcTime)})</span>` : 
                              myAbandoned ? '<span style="color: #ff4d4f;">❌ 放弃</span>' : 
                              '<span style="color: #999;">⏳ 进行中</span>'}
                        </div>
                        <div style="margin-bottom: 8px;">
                            <strong>分数变动:</strong> 
                            <span style="color: ${myScoreChangeColor}; font-weight: 600;">${myScoreChangeText}${scoreChangeDesc}</span>
                        </div>
                        <div>
                            <strong>结果:</strong> 
                            <span style="color: ${battleResult === 'win' ? '#52c41a' : battleResult === 'loss' ? '#ff4d4f' : '#faad14'}; font-weight: 600;">${battleResult === 'win' ? '胜利' : battleResult === 'loss' ? '失败' : '平局'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #fff7e6; padding: 16px; border-radius: 6px; border: 2px solid #faad14;">
                        <div style="font-weight: 600; color: #faad14; margin-bottom: 12px; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                            对手
                            ${isMirrorChallenger ? '<span style="color: #1890ff; font-size: 12px; font-weight: normal;">🪞 (镜像)</span>' : ''}
                            ${opponentAbandoned ? '<span style="color: #ff4d4f; font-size: 12px; font-weight: normal;">(已投降)</span>' : ''}
                        </div>
                        ${opponentAvatar ? `<div style="margin-bottom: 8px;"><img src="${opponentAvatar}" alt="${opponentName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" /></div>` : ''}
                        <div style="margin-bottom: 8px;">
                            <strong>昵称:</strong> <span style="font-weight: 600;">${opponentName}</span>
                    </div>
                        ${opponentUserId && opponentUserId !== -1 ? `<div style="margin-bottom: 8px;"><strong>用户ID:</strong> ${opponentUserId}</div>` : ''}
                        <div>
                            <strong>状态:</strong> 
                            ${opponentAc ? `<span style="color: #52c41a;">✅ AC (${formatAcTime(opponentAcTime)})</span>` : 
                              opponentAbandoned ? '<span style="color: #ff4d4f;">❌ 投降</span>' : 
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
