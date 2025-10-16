/**
 * 主应用类
 * 整合所有模块，管理应用生命周期
 */

import { APP_CONFIG } from './config.js';
import { ApiService } from './services/ApiService.js';
import { CardGenerator } from './components/CardGenerator.js';
import { AppState } from './state/AppState.js';
import { eventBus, EVENTS } from './events/EventBus.js';
import * as helpers from './utils/helpers.js';

// 导入视图模块
import { ContestView } from './views/ContestView.js';
import { PracticeView } from './views/PracticeView.js';
import { RankingsView } from './views/RankingsView.js';
import { DailyView } from './views/DailyView.js';
import { InterviewView } from './views/InterviewView.js';

export class NowcoderTracker {
    constructor() {
        // 初始化状态管理
        this.state = new AppState();
        
        // 初始化服务
        this.apiService = new ApiService();
        this.cardGenerator = new CardGenerator();
        
        // 初始化DOM元素
        this.elements = this.initElements();
        
        // 初始化视图模块
        this.views = this.initViews();
        
        // 绑定事件
        this.bindEvents();
    }
    
    initElements() {
        return {
            // 主标签页（与index.html保持一致）
            mainTabs: document.querySelectorAll('.tab-btn'),
            
            // 比赛视图元素
            contestTbody: document.querySelector('#contests-view .problems-table tbody'),

            // problems 搜索区元素（与 index.html 保持一致）
            userIdInput: document.getElementById('userId'),
            rivalIdInput: document.getElementById('rivalId'),
            problemSearchBtn: document.getElementById('problem-search-btn'),
            
            // 练习视图元素
            practiceTbody: document.querySelector('#practice-view .practice-table tbody'),
            
            // 排行榜视图元素（与index.html的ID保持一致）
            rankingsTbody: document.getElementById('rankings-tbody'),
            userRankDisplay: document.getElementById('user-rank-display'),
            rankUserIdInput: document.getElementById('rank-user-id-input'),
            userSearchBtn: document.getElementById('rank-search-btn'),
            generateCardBtn: document.getElementById('generate-card-btn'),
            
            // 每日一题视图元素
            dailyProblemContainer: document.getElementById('daily-problem-container'),
            userSummaryPanel: document.getElementById('user-summary-panel'),
            calendarContainer: document.getElementById('check-in-calendar-container'),
            calendarGrid: document.querySelector('#check-in-calendar-container .calendar-grid'),
            calendarMonthYear: document.getElementById('calendar-month-year'),
            prevMonthBtn: document.getElementById('calendar-prev-month'),
            nextMonthBtn: document.getElementById('calendar-next-month'),
            
            // 面试视图元素
            interviewTbody: document.querySelector('#interview-view .practice-table tbody'),
            
            // 模态框元素
            cardImage: document.getElementById('card-image'),
            cardModal: document.getElementById('card-modal'),
            cardModalClose: document.getElementById('card-modal-close')
        };
    }
    
    initViews() {
        return {
            contest: new ContestView(this.elements, this.state, this.apiService),
            practice: new PracticeView(this.elements, this.state, this.apiService),
            rankings: new RankingsView(this.elements, this.state, this.apiService),
            daily: new DailyView(this.elements, this.state, this.apiService),
            interview: new InterviewView(this.elements, this.state, this.apiService)
        };
    }
    
    bindEvents() {
        // 主标签切换
        this.elements.mainTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = tab.dataset.tab;
                this.switchMainTab(tabName);
            });
        });

        // problems页内视图切换（竞赛/算法学习/笔面试）
        document.querySelectorAll('.view-type-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const view = btn.dataset.view; // contests | practice | interview

                // 切换按钮激活态
                document.querySelectorAll('.view-type-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 切换对应内容区域显示
                const viewIds = ['contests-view', 'practice-view', 'interview-view'];
                viewIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.style.display = (id === `${view}-view`) ? 'block' : 'none';
                    el.classList.toggle('active', id === `${view}-view`);
                });

                // 通知对应视图加载数据
                this.state.setActiveView(view);
                eventBus.emit(EVENTS.VIEW_CHANGED, view);
            });
        });
        
        // 比赛标签切换（仅限 contests 视图，读取 data-contest）
        const contestTabs = document.querySelectorAll('#contests-view .contest-tab');
        contestTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = tab.dataset.contest; // all | weekly | monthly | practice | challenge | xcpc
                if (!tabName) return;

                // 切换UI高亮
                contestTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                this.switchContestTab(tabName);
            });
        });
        
        // 面试标签切换（仅限 interview 视图，读取 data-interview-type）
        const interviewTabs = document.querySelectorAll('#interview-view .contest-tabs:first-child .contest-tab');
        const campusSubTabsContainer = document.getElementById('campus-sub-tabs-interview');
        
        interviewTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = tab.dataset.interviewType; // campus | templates | interview-top101 | interview-high-freq
                if (!tabName) return;

                // 切换UI高亮
                interviewTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // 显示/隐藏校园招聘子标签
                if (campusSubTabsContainer) {
                    campusSubTabsContainer.style.display = tabName === 'campus' ? 'flex' : 'none';
                }

                this.switchInterviewTab(tabName);
            });
        });
        
        // 校园招聘子标签切换
        const campusSubTabs = document.querySelectorAll('#campus-sub-tabs-interview .contest-tab');
        campusSubTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const tabName = tab.dataset.contestType; // 100 | 101 | 102 | 103
                if (!tabName) return;

                // 切换UI高亮
                campusSubTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                this.switchCampusSubTab(tabName);
            });
        });
        
        // 练习标签切换（读取 data-practice-type）
        const practiceTabs = document.querySelectorAll('#practice-view .sub-tabs .contest-tab');
        practiceTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = tab.dataset.practiceType;
                if (!tabName) return;

                // 切换UI高亮
                practiceTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                this.switchPracticeTab(tabName);
            });
        });
        
        // Problems 搜索（用户/对比用户）
        if (this.elements.problemSearchBtn) {
            this.elements.problemSearchBtn.addEventListener('click', () => this.handleUserStatusSearch());
        }
        const handleEnter = (e) => { if (e.key === 'Enter') this.handleUserStatusSearch(); };
        if (this.elements.userIdInput) this.elements.userIdInput.addEventListener('keypress', handleEnter);
        if (this.elements.rivalIdInput) this.elements.rivalIdInput.addEventListener('keypress', handleEnter);

        // Rankings 搜索
        if (this.elements.userSearchBtn) {
            this.elements.userSearchBtn.addEventListener('click', () => {
                const userId = this.elements.rankUserIdInput?.value?.trim();
                if (userId) eventBus.emit(EVENTS.USER_SEARCH, userId);
            });
        }

        // 监听 USER_LOGIN（来自 todayinfo），自动填充并在相应页签触发查询
        eventBus.on(EVENTS.USER_LOGIN, (userData) => {
            const uid = userData && (userData.uid ? String(userData.uid) : String(userData));
            if (!uid) return;
            
            // 设置登录用户ID到状态中
            this.state.loggedInUserId = uid;
            this.state.loggedInUserData = userData;
            
            if (this.elements.userIdInput && !this.elements.userIdInput.value) this.elements.userIdInput.value = uid;
            if (this.elements.rankUserIdInput && !this.elements.rankUserIdInput.value) this.elements.rankUserIdInput.value = uid;

            if (this.state.activeMainTab === 'problems') {
                this.handleUserStatusSearch();
            }
            // 移除rankings的自动查询，避免死循环
        });
        
        // 移除USER_SEARCH事件监听器，避免死循环
        
        // 生成卡片
        if (this.elements.generateCardBtn) {
            this.elements.generateCardBtn.addEventListener('click', () => {
                this.generateCard();
            });
        }
        
        // 卡片模态框关闭
        if (this.elements.cardModal) {
            this.elements.cardModal.addEventListener('click', () => {
                this.elements.cardModal.classList.remove('visible');
            });
        }
        if (this.elements.cardImage) {
            this.elements.cardImage.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止点击图片时关闭模态框
            });
        }
        if (this.elements.cardModalClose) {
            this.elements.cardModalClose.addEventListener('click', () => {
                this.elements.cardModal.classList.remove('visible');
            });
        }
        
        // 日历导航
        const calendarPrevBtn = document.getElementById('calendar-prev-month');
        const calendarNextBtn = document.getElementById('calendar-next-month');
        
        if (calendarPrevBtn) {
            calendarPrevBtn.addEventListener('click', () => {
                const currentDate = this.state.calendarDate;
                currentDate.setMonth(currentDate.getMonth() - 1);
                this.state.setCalendarDate(currentDate);
                this.views.daily.renderCalendar();
            });
        }
        
        if (calendarNextBtn) {
            calendarNextBtn.addEventListener('click', () => {
                const currentDate = this.state.calendarDate;
                currentDate.setMonth(currentDate.getMonth() + 1);
                this.state.setCalendarDate(currentDate);
                this.views.daily.renderCalendar();
            });
        }
    }
    
    async init() {
        console.log('🚀 NowcoderTracker App Initialized');
        
        // 根据URL参数或默认值设置初始标签
        const urlParams = new URLSearchParams(window.location.search);
        const initialTab = urlParams.get('tab') || 'daily';
        
        this.switchMainTab(initialTab);
        
        // 发布应用初始化完成事件
        eventBus.emit(EVENTS.PAGE_LOADED, { app: this });
    }
    
    switchMainTab(tabName) {
        // 更新状态
        this.state.setActiveMainTab(tabName);
        
        // 更新UI（按钮active）
        this.elements.mainTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // 切换主内容区域（与index.html的结构对应：.tab-content + section id）
        document.querySelectorAll('.tab-content').forEach(section => {
            const isActive = section.id === tabName;
            section.classList.toggle('active', isActive);
            // 统一使用display切换，兼容旧样式
            section.style.display = isActive ? 'block' : 'none';
        });
        
        // 触发视图切换
        switch (tabName) {
            case 'daily':
                eventBus.emit(EVENTS.MAIN_TAB_CHANGED, 'daily');
                break;
            case 'problems':
                // 默认展示practice视图（与原备份一致），并高亮按钮
                {
                    const defaultView = 'practice';
                    // 激活view-type按钮
                    document.querySelectorAll('.view-type-tab').forEach(b => {
                        b.classList.toggle('active', b.dataset.view === defaultView);
                    });
                    // 显示对应内容
                    ['contests-view','practice-view','interview-view'].forEach(id => {
                        const el = document.getElementById(id);
                        if (!el) return;
                        const shouldShow = id === `${defaultView}-view`;
                        el.style.display = shouldShow ? 'block' : 'none';
                        el.classList.toggle('active', shouldShow);
                    });
                    this.state.setActiveView(defaultView);
                    eventBus.emit(EVENTS.VIEW_CHANGED, defaultView);
                }
                break;
            case 'rankings':
                this.state.setActiveView('rankings');
                eventBus.emit(EVENTS.VIEW_CHANGED, 'rankings');
                
                // 如果已登录，自动填充UID并触发查询
                if (this.state.loggedInUserId) {
                    if (this.elements.rankUserIdInput && !this.elements.rankUserIdInput.value) {
                        this.elements.rankUserIdInput.value = this.state.loggedInUserId;
                    }
                    // 自动触发Search按钮
                    setTimeout(() => {
                        // RankingsView 监听 USER_SEARCH 事件
                        if (this.elements.rankUserIdInput?.value) {
                            eventBus.emit(EVENTS.USER_SEARCH, this.elements.rankUserIdInput.value);
                        }
                    }, 100);
                }
                break;
            case 'interview':
                this.state.setActiveView('interview');
                eventBus.emit(EVENTS.VIEW_CHANGED, 'interview');
                
                // 如果已登录，自动填充UID并触发查询
                if (this.state.loggedInUserId) {
                    if (this.elements.userIdInput && !this.elements.userIdInput.value) {
                        this.elements.userIdInput.value = this.state.loggedInUserId;
                    }
                    // 自动触发Search按钮
                    setTimeout(() => this.handleUserStatusSearch(), 100);
                }
                break;
            case 'skill-tree':
                this.loadSkillTree();
                break;
        }
        
        // 发布事件
        eventBus.emit(EVENTS.MAIN_TAB_CHANGED, tabName);
    }
    
    switchContestTab(tabName) {
        this.state.setActiveContestTab(tabName);
        eventBus.emit(EVENTS.CONTEST_TAB_CHANGED, tabName);
    }
    
    switchPracticeTab(tabName) {
        this.state.setActivePracticeSubTab(tabName);
        eventBus.emit(EVENTS.PRACTICE_TAB_CHANGED, tabName);
    }
    
    switchInterviewTab(tabName) {
        this.state.setActiveInterviewSubTab(tabName);
        eventBus.emit(EVENTS.INTERVIEW_TAB_CHANGED, tabName);
    }
    
    switchCampusSubTab(tabName) {
        this.state.setActiveCampusSubTab(tabName);
        eventBus.emit(EVENTS.INTERVIEW_TAB_CHANGED, 'campus');
    }
    
    async generateCard() {
        if (!this.state.lastSearchedUserData || !this.state.lastSearchedUserData.user1) {
            alert('请先查询一个有效的用户。');
            return;
        }
        
        const { user1, user2 } = this.state.lastSearchedUserData;
        
        let cardDataUrl;
        if (user1 && user2) {
            cardDataUrl = await this.cardGenerator.drawComparisonCard(user1, user2);
        } else if (user1) {
            cardDataUrl = await this.cardGenerator.drawSingleCard(user1);
        }
        
        // 显示卡片
        if (this.elements.cardImage && this.elements.cardModal && cardDataUrl) {
            this.elements.cardImage.src = cardDataUrl;
            this.elements.cardModal.classList.add('visible');
            eventBus.emit(EVENTS.CARD_GENERATED, { cardDataUrl });
        }
    }
    
    loadSkillTree() {
        const container = document.querySelector('.skill-tree-container');
        if (!container) return;
        
        // 显示加载状态
        container.innerHTML = `
            <div class="skill-tree-loading">
                <div class="loading-spinner"></div>
                <p>技能树功能开发中...</p>
            </div>
        `;
        
        console.log('技能树功能开发中...');
    }
    
    // 工具方法
    buildUrlWithChannelPut(baseUrl) {
        return helpers.buildUrlWithChannelPut(baseUrl, this.state.channelPut);
    }
    
    // 获取用户搜索数据（供RankingsView使用）
    async handleUserStatusSearch() {
        const userId1 = this.elements.userIdInput?.value?.trim();
        const userId2 = this.elements.rivalIdInput?.value?.trim();
        if (!userId1) return;

        try {
            // 并行拉取用户数据
            const user1Promise = this.apiService.fetchUserData(userId1);
            const user2Promise = userId2 ? this.apiService.fetchUserData(userId2) : Promise.resolve(null);
            const [user1, user2] = await Promise.all([user1Promise, user2Promise]);

            if (user1) {
                this.state.lastSearchedUserData = { user1, user2 };
                
                // 根据当前视图获取题目ID并查询做题状态
                const qids = await this.getScopedProblemIds();
                if (qids) {
                    const diffData = await this.apiService.fetchUserProblemDiff(userId1, qids, userId2 || null);
                    this.applyProblemHighlighting(diffData, !!userId2);
                }
                // 使生成名片可用
                if (this.elements.generateCardBtn) {
                    this.elements.generateCardBtn.disabled = false;
                    this.elements.generateCardBtn.textContent = user2 ? '生成对比卡片' : '生成名片';
                }
            } else {
                alert('用户未找到');
            }
        } catch (error) {
            console.error('Error searching user:', error);
            alert('查询用户失败');
        }
    }

    // 收集当前视图中的题目ID，用于调用 diff 接口
    async getScopedProblemIds() {
        let qids = '';
        const selectIds = (selector) => Array.from(document.querySelectorAll(selector))
            .map(el => el.getAttribute('data-problem-id'))
            .filter(Boolean)
            .join(',');

        const activeView = this.state.activeView;
        if (activeView === 'contests') {
            qids = selectIds('#contests-view td[data-problem-id]');
        } else if (activeView === 'interview') {
            qids = selectIds('#interview-view td[data-problem-id]');
        } else if (activeView === 'practice') {
            // practice 视图题目由 JSON 渲染，直接从 DOM 提取
            qids = selectIds('#practice-view td[data-problem-id]');
        }
        return qids || null;
    }

    // 根据 diff 结果高亮题目单元格
    applyProblemHighlighting(data, hasRival) {
        const { ac1Qids = [], ac2Qids = [] } = data || {};
        const ac1Set = new Set(ac1Qids.map(String));
        const ac2Set = new Set(ac2Qids.map(String));

        const allProblemCells = document.querySelectorAll('#contests-view td[data-problem-id], #practice-view td[data-problem-id], #interview-view td[data-problem-id]');
        
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

        // contests/interview 行首 “全AC” 标记
        const contestRows = document.querySelectorAll('#contests-view tbody tr, #interview-view tbody tr');
        contestRows.forEach(row => {
            const cells = row.querySelectorAll('td[data-problem-id]');
            if (!cells.length) return;
            const allAc = Array.from(cells).every(c => ac1Set.has(c.getAttribute('data-problem-id')));
            const first = row.querySelector('td:first-child');
            if (!first) return;
            first.classList.toggle('status-all-ac', allAc);
        });
    }
}

// 导出单例实例
export const app = new NowcoderTracker();

// 将app实例设置到window对象上，供其他模块使用
window.app = app;
