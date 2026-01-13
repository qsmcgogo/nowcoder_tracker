/**
 * 主应用类
 * 整合所有模块，管理应用生命周期
 */

import { APP_CONFIG, initBattleDomain } from './config.js';
import { ApiService } from './services/ApiService.js';
import { AppState } from './state/AppState.js';
import { eventBus, EVENTS } from './events/EventBus.js';
import * as helpers from './utils/helpers.js';

// 导入视图模块
import { ContestView } from './views/ContestView.js';
import { PracticeView } from './views/PracticeView.js';
import { RankingsView } from './views/RankingsView.js';
import { DailyView } from './views/DailyView.js';
import { InterviewView } from './views/InterviewView.js';
import { SkillTreeView } from './views/SkillTreeView.js';
import { ProfileView } from './views/ProfileView.js';
import { AchievementsView } from './views/AchievementsView.js';
import { TeamView } from './views/TeamView.js';
import { BattleView } from './views/BattleView.js';
import { ActivityView } from './views/ActivityView.js';
import { AdminView } from './views/AdminView.js';
import { PromptView } from './views/PromptView.js';
import { OutputDemoView } from './views/learn/OutputDemoView.js';
import { DigitDPDemoView } from './views/learn/DigitDPDemoView.js';
import { DifyView } from './views/DifyView.js';
import { AchievementNotifier } from './services/AchievementNotifier.js';

export class NowcoderTracker {
    constructor() {
        // 初始化状态管理
        this.state = new AppState();
        // 成就轮询冷却时间（避免频繁触发）
        this._lastAchvCheck = 0;
        // 题库搜索防抖时间戳
        this._lastProblemSearchTs = 0;
        
        // 初始化服务
        this.apiService = new ApiService();
        this.achvNotifier = new AchievementNotifier(this.apiService);
        
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
            
            // 技能树视图元素
            skillTreeContainer: document.querySelector('#skill-tree .skill-tree-container'),

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
            cardModalClose: document.getElementById('card-modal-close'),
            // 我的页面容器
            profile: document.getElementById('profile'),
            team: document.getElementById('team'),
            // team sub containers
            teamDashboard: document.getElementById('team-dashboard'),
            teamLeaderboard: document.getElementById('team-leaderboard'),
            teamActivity: document.getElementById('team-activity'),
            faq: document.getElementById('faq'),
            // battle container
            battleContainer: document.getElementById('battle-container'),
            // activity container
            activityContainer: document.getElementById('activity-view'),
            // admin container
            adminContainer: document.getElementById('admin-container'),
            // prompt container
            promptContainer: document.getElementById('prompt-container'),
            // dify container
            difyContainer: document.getElementById('dify-container')
        };
    }
    
    initViews() {
        return {
            contest: new ContestView(this.elements, this.state, this.apiService),
            practice: new PracticeView(this.elements, this.state, this.apiService),
            rankings: new RankingsView(this.elements, this.state, this.apiService),
            daily: new DailyView(this.elements, this.state, this.apiService),
            interview: new InterviewView(this.elements, this.state, this.apiService),
            skillTree: new SkillTreeView(this.elements, this.state, this.apiService),
            achievements: new AchievementsView(this.elements, this.state, this.apiService),
            team: new TeamView(this.elements, this.state, this.apiService),
            battle: new BattleView(this.elements, this.state, this.apiService),
            activity: new ActivityView(this.elements, this.state, this.apiService),
            profile: new ProfileView(this.elements, this.state, this.apiService),
            admin: new AdminView(this.elements, this.state, this.apiService),
            prompt: new PromptView(this.elements, this.state, this.apiService),
            dify: new DifyView(this.elements, this.state, this.apiService),
            // 学习 Demo（不属于主 tab，但需要在全局初始化以订阅事件）
            outputDemo: new OutputDemoView(this.elements, this.state, this.apiService),
            digitDpDemo: new DigitDPDemoView(this.elements, this.state, this.apiService)
        };
        
        // 将adminView实例暴露到全局，方便内联事件调用
        window.adminView = this.views.admin;
    }
    
    bindEvents() {
        // 主标签切换
        this.elements.mainTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                // 活动页签特殊处理
                if (tab.id === 'activity-tab-btn') {
                    this.switchMainTab('activity');
                    return;
                }
                const tabName = tab.dataset.tab;
                this.switchMainTab(tabName);
            });
        });

        // problems页内视图切换（竞赛/算法学习/笔面试/课程）
        document.querySelectorAll('.view-type-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const view = btn.dataset.view; // contests | practice | interview | course

                // 切换按钮激活态
                document.querySelectorAll('.view-type-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 切换对应内容区域显示
                const viewIds = ['contests-view', 'practice-view', 'interview-view', 'course-view'];
                viewIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.style.display = (id === `${view}-view`) ? 'block' : 'none';
                    el.classList.toggle('active', id === `${view}-view`);
                });

                // 通知对应视图加载数据
                this.state.setActiveView(view);
                eventBus.emit(EVENTS.VIEW_CHANGED, view);
                // 切换到竞赛/算法学习/笔面试后，通过“Search”按钮触发一次刷新，避免重复调用
                if (this.state.loggedInUserId) this.triggerSearchWhenReady(view);
            });
        });

        // team 子标签切换
        document.querySelectorAll('.team-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = btn.dataset.teamTab; // dashboard|members|settings|invites
                if (!tab) return;
                document.querySelectorAll('.team-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                eventBus.emit(EVENTS.TEAM_TAB_CHANGED, tab);
            });
        });
        
        // 比赛标签切换（仅限 contests 视图，读取 data-contest）
        const contestTabs = document.querySelectorAll('#contests-view .contest-tab');
        contestTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = tab.dataset.contest; // all | weekly | monthly | practice | challenge | xcpc | 25
                const beisaiCategory = tab.dataset.beisaiCategory; // 蓝桥杯 | 传智杯（仅当contestType=25时有效）
                if (!tabName) return;

                // 切换UI高亮
                contestTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // 如果是杯赛（25），需要设置category
                if (tabName === '25' && beisaiCategory) {
                    this.state.setActiveBeisaiCategory(beisaiCategory);
                } else {
                    this.state.setActiveBeisaiCategory(null);
                }

                this.switchContestTab(tabName);
                // 切换竞赛子标签后，通过"Search"按钮触发刷新
                if (this.state.loggedInUserId) this.triggerSearchWhenReady('contests');
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
                if (this.state.loggedInUserId) this.triggerSearchWhenReady('interview');
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
                if (this.state.loggedInUserId) this.triggerSearchWhenReady('interview');
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
                // 练习子标签（如新手入门130）切换后，通过“Search”按钮触发刷新
                if (this.state.loggedInUserId) this.triggerSearchWhenReady('practice');
            });
        });
        
        // 课程标签切换（读取 data-course-category）
        const courseTabs = document.querySelectorAll('#course-view .contest-tab');
        courseTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const category = tab.dataset.courseCategory || ''; // 空字符串表示"全部课程"

                // 切换UI高亮
                courseTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                this.switchCourseCategory(category);
                if (this.state.loggedInUserId) this.triggerSearchWhenReady('course');
            });
        });
        
        // Problems 搜索（用户/对比用户）
        if (this.elements.problemSearchBtn) {
            this.elements.problemSearchBtn.addEventListener('click', () => this.handleUserStatusSearch());
        }
        const handleEnter = (e) => { if (e.key === 'Enter') this.handleUserStatusSearch(); };
        if (this.elements.userIdInput) this.elements.userIdInput.addEventListener('keypress', handleEnter);
        if (this.elements.rivalIdInput) this.elements.rivalIdInput.addEventListener('keypress', handleEnter);

        // Rankings 视图页签切换
        document.querySelectorAll('.rank-tab').forEach(tab => {
            tab.addEventListener('click', async (e) => {
                e.preventDefault();
                const rankType = tab.dataset.rankType;
                if (!rankType) return;

                document.querySelectorAll('.rank-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // 异步更新状态和UI，然后触发搜索
                this.handleRankTabChange(rankType);
            });
        });

        // 当用户从其它标签页/应用切回本页时，做一次成就增量检查（带冷却）
        const onRefocus = () => {
            if (document.visibilityState !== 'visible') return;
            const now = Date.now();
            // 冷却：至少间隔 60s
            if (now - (this._lastAchvCheck || 0) < 60000) return;
            this._lastAchvCheck = now;
            setTimeout(() => {
                try { this.achvNotifier && this.achvNotifier.diffAndNotify([1,2,3,4,6]); } catch (_) {}
            }, 300);
        };
        document.addEventListener('visibilitychange', onRefocus);
        window.addEventListener('focus', onRefocus);

        // Rankings 搜索
        if (this.elements.userSearchBtn) {
            this.elements.userSearchBtn.addEventListener('click', () => {
                const userId = this.elements.rankUserIdInput?.value?.trim();
                // 无论userId是否存在，都发出事件。
                // RankingsView将处理空userId的情况（即加载第一页）
                eventBus.emit(EVENTS.USER_SEARCH, userId);
            });
        }
        // 管理员：更新某用户过题数
        const adminUpdateBtn = document.getElementById('rank-admin-update-btn');
        if (adminUpdateBtn) {
            // 根据管理员态显示/隐藏
            adminUpdateBtn.style.display = this.state.isAdmin ? 'inline-block' : 'none';
            adminUpdateBtn.addEventListener('click', async () => {
                if (!this.state.isAdmin) return alert('需要管理员权限');
                const uid = this.elements.rankUserIdInput?.value?.trim();
                if (!uid) { alert('请输入用户ID'); return; }
                adminUpdateBtn.disabled = true;
                const oldText = adminUpdateBtn.textContent;
                adminUpdateBtn.textContent = '更新中...';
                try {
                    // 同时更新过题数与提交数
                    await this.apiService.adminUpdateUserAcceptCount(uid);
                    try { await this.apiService.adminUpdateUserSubmissionCount(uid); } catch (_) {}
                    // 更新成功后刷新当前页 / 或定位到该用户
                    eventBus.emit(EVENTS.USER_SEARCH, uid);
                    alert('已触发更新（过题数 + 提交数）');
                } catch (e) {
                    console.error(e);
                    alert(e.message || '更新失败');
                } finally {
                    adminUpdateBtn.disabled = false;
                    adminUpdateBtn.textContent = oldText;
                }
            });
        }
        if (this.elements.rankUserIdInput) {
            this.elements.rankUserIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.elements.userSearchBtn.click(); // 模拟点击搜索按钮
                }
            });
        }

        // 管理员：清题库缓存（比赛列表缓存）
        const clearBtn = document.getElementById('contest-cache-clear-btn');
        if (clearBtn && !clearBtn._bound) {
            clearBtn._bound = true;
            clearBtn.addEventListener('click', async () => {
                try {
                    if (!this.state.isAdmin) return alert('需要管理员权限');
                    const ok = window.confirm('确认清理 Tracker 题库（比赛列表）缓存？清理后将重新拉取最新数据。');
                    if (!ok) return;
                    const oldText = clearBtn.textContent;
                    clearBtn.disabled = true;
                    clearBtn.textContent = '清理中...';
                    await this.apiService.adminClearContestCache();
                    alert('已清理缓存（OK），将刷新当前列表');
                    // 刷新当前 view（若在题库页）
                    const v = this.state.activeView;
                    if (v === 'contests' && this.views && this.views.contest) {
                        await this.views.contest.fetchAndRenderContests();
                    } else if (v === 'course' && this.views && this.views.contest) {
                        await this.views.contest.fetchAndRenderCourseContests();
                    }
                    clearBtn.disabled = false;
                    clearBtn.textContent = oldText;
                } catch (e) {
                    clearBtn.disabled = false;
                    clearBtn.textContent = '清题库缓存';
                    alert(e?.message || '清题库缓存失败');
                }
            });
        }

        // 初始化帮助菜单
        this.initHelpMenu();
        
        // 监听 USER_LOGIN（来自 todayinfo），自动填充并在相应页签触发查询
        eventBus.on(EVENTS.USER_LOGIN, async (userData) => {
            const uid = userData && (userData.uid ? String(userData.uid) : String(userData));
            if (!uid) return;
            
            // 调用 AppState 的方法来统一设置用户
            this.state.setLoggedInUser(uid, userData);
            
            // 异步检查管理员状态
            await this.state.checkAdminStatus(this.apiService);

            if (this.elements.userIdInput && !this.elements.userIdInput.value) this.elements.userIdInput.value = uid;
            if (this.elements.rankUserIdInput && !this.elements.rankUserIdInput.value) this.elements.rankUserIdInput.value = uid;

            // 如果是管理员，添加视觉提示（确保只添加一次）
            if (this.state.isAdmin && !document.querySelector('h1 .admin-badge')) {
                const h1Element = document.querySelector('h1');
                if (h1Element) {
                    const adminBadge = document.createElement('span');
                    adminBadge.textContent = '[Admin]';
                    adminBadge.className = 'admin-badge'; // 添加一个class用于检查
                    adminBadge.style.color = 'red';
                    adminBadge.style.marginLeft = '10px';
                    h1Element.appendChild(adminBadge);
                }
            }

            // 显示/隐藏管理员页签
            this.updateAdminTabVisibility();
            // 显示/隐藏 Prompt 页签（当前与管理员相同：仅 admin 可见）
            this.updatePromptTabVisibility();
            // 显示/隐藏 Dify 页签（基于配置）
            this.updateDifyTabVisibility();

            // 显示/隐藏“清题库缓存”按钮（仅管理员）
            const cacheBtn = document.getElementById('contest-cache-clear-btn');
            if (cacheBtn) cacheBtn.style.display = this.state.isAdmin ? 'inline-block' : 'none';

            // 登录后根据管理员身份刷新"更新过题数"按钮可见性
            const adminUpdateBtn2 = document.getElementById('rank-admin-update-btn');
            if (adminUpdateBtn2) {
                adminUpdateBtn2.style.display = this.state.isAdmin ? 'inline-block' : 'none';
            }

            if (this.state.activeMainTab === 'problems') {
                this.handleUserStatusSearch();
            }
            // 移除rankings的自动查询，避免死循环
        });
        
        // 移除USER_SEARCH事件监听器，避免死循环
        
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
        
        // 优先初始化对战域名配置（在用户操作前完成）
        try {
            await initBattleDomain(true);
        } catch (error) {
            console.warn('Failed to initialize battle domain:', error);
        }
        
        // 优先使用哈希路由，其次回退到 ?tab=，最后默认 daily
        const fromHash = this.getRouteFromHash();
        // 提前记录是否为邀请路由以及原始hash，避免后续被重写
        const initialInviteTid = this.parseTeamInviteRoute();
        const initialHashRaw = window.location.hash || '';
        const urlParams = new URLSearchParams(window.location.search);
        const fromQuery = urlParams.get('tab');
        const rawRoute = fromHash || fromQuery || 'daily';
        const initialTab = this.normalizeTabName(rawRoute);
        const initialSubview = this.extractProblemsSubview(rawRoute);

        // 在任何标签页下先探测登录状态（通过 todayinfo），避免刷新后显示"未登录"
        try {
            await this.detectAndSetLoggedInUser();
            // 初始化时更新管理员页签可见性（detectAndSetLoggedInUser 已经检查了管理员状态）
            this.updateAdminTabVisibility();
            this.updatePromptTabVisibility();
            this.updateDifyTabVisibility();
            const cacheBtn = document.getElementById('contest-cache-clear-btn');
            if (cacheBtn) cacheBtn.style.display = this.state.isAdmin ? 'inline-block' : 'none';
        } catch (_) { /* ignore login bootstrap errors */ }

        if (initialInviteTid) {
            // 直接进入团队页，避免默认跳转到 daily
            this.switchMainTab('team', { subview: null });
        } else {
            this.switchMainTab(initialTab, { subview: initialSubview });
        }

        // 监听哈希变化，实现前进/后退导航
        window.addEventListener('hashchange', () => {
            const route = this.getRouteFromHash();
            const target = this.normalizeTabName(route || 'daily');
            const subview = this.extractProblemsSubview(route);
            if (target) {
                this.switchMainTab(target, { subview });
            }
            const tid = this.parseTeamInviteRoute();
            if (tid) this.showTeamInviteLanding(tid);
        });
        
        // 发布应用初始化完成事件
        eventBus.emit(EVENTS.PAGE_LOADED, { app: this });
        // 初始化时处理邀请落地，并恢复原始hash（若被重写）
        if (initialInviteTid) {
            if ((window.location.hash || '') !== initialHashRaw) {
                window.location.hash = initialHashRaw;
            }
            this.showTeamInviteLanding(initialInviteTid);
        }
    }
    
    switchMainTab(tabName, options = {}) {
        const normalizedPre = this.normalizeTabName(tabName);
        // AI 助手权限 gate：无权限则不允许进入 dify
        if (normalizedPre === 'dify') {
            const ok = (this.state && this.state.canAccessDify) ? this.state.canAccessDify() : (this.state && this.state.isAdmin === true);
            if (!ok) {
                alert('无权限访问 AI 助手（需要 Dify 管理员权限）');
                tabName = 'daily';
            }
        }
        // 更新导航栏active状态
        this.updateNavActiveState(tabName);
        // 将当前标签写入哈希，保持可分享/可返回
        const normalized = this.normalizeTabName(tabName);
        const currentHash = (window.location.hash || '').replace(/^#/, '');
        // 邀请链接：当路由以 /team/ 或 /inviteTeam 开头时，保留完整哈希（避免被重写为 /team 导致丢参）
        let shouldPreserveHash = false;
        if (normalized === 'team') {
            const h = (currentHash || '').toLowerCase();
            if (h.startsWith('/team/') || h.startsWith('/inviteteam')) shouldPreserveHash = true;
        }
        if (!shouldPreserveHash) {
            let expectedHash = `/${normalized}`;
            if (normalized === 'problems' && options && options.subview === 'contests') {
                expectedHash = '/contest';
            }
            if (currentHash !== expectedHash) {
                // 仅当不同再写入，避免触发重复 hashchange
                window.location.hash = expectedHash;
            }
        }

        const previousTab = this.state.activeMainTab;

        // If leaving the skill tree tab, reset its view to summary.
        if (previousTab === 'skill-tree' && tabName !== 'skill-tree') {
            this.views.skillTree.resetView();
        }
        
        // Hide all views first to ensure cleanup
        Object.values(this.views).forEach(view => {
            if (view.hide) {
                view.hide();
            }
        });

        // Update state
        this.state.setActiveMainTab(normalized);
        
        // Update UI (button active)
        this.elements.mainTabs.forEach(tab => {
            // 活动页签特殊处理
            if (tab.id === 'activity-tab-btn') {
                tab.classList.toggle('active', normalized === 'activity');
            } else {
                tab.classList.toggle('active', tab.dataset.tab === normalized);
            }
        });
 
         // 切换主内容区域（与index.html的结构对应：.tab-content + section id）
         document.querySelectorAll('.tab-content').forEach(section => {
            const isActive = section.id === normalized;
             section.classList.toggle('active', isActive);
             // The line below is removed to allow CSS to control display property
         });
         
         // 触发视图切换
         switch (normalized) {
            case 'daily':
                // 不在此处重复触发事件，统一由函数末尾的通用 emit 触发
                break;
            case 'problems':
                // 默认展示practice视图（与原备份一致），并高亮按钮
                {
                    const defaultView = (options && options.subview) || 'practice';
                    // 激活view-type按钮
                    document.querySelectorAll('.view-type-tab').forEach(b => {
                        b.classList.toggle('active', b.dataset.view === defaultView);
                    });
                    // 显示对应内容
                    ['contests-view','practice-view','interview-view','course-view'].forEach(id => {
                        const el = document.getElementById(id);
                        if (!el) return;
                        const shouldShow = id === `${defaultView}-view`;
                        el.style.display = shouldShow ? 'block' : 'none';
                        el.classList.toggle('active', shouldShow);
                    });
                    this.state.setActiveView(defaultView);
                    eventBus.emit(EVENTS.VIEW_CHANGED, defaultView);

                    // 如果需要刷新，由各子标签点击时统一触发Search按钮；此处不再自动调用，避免重复 /diff
                    // 但当用户只是点击顶部“题库”标签进入时，仍需刷新一次以计算绿色高亮
                    if (this.state.loggedInUserId) this.triggerSearchWhenReady(defaultView);
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
                        if (this.elements.userSearchBtn) {
                            this.elements.userSearchBtn.click();
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
                this.views.skillTree.render();
                break;
            case 'achievements':
                this.views.achievements.render();
                // 进入成就页时尝试检查是否有新成就（模拟或站外触发的情况）
                setTimeout(() => {
                    try { this.achvNotifier.diffAndNotify([1,2,3,4,6]); } catch (_) {}
                }, 500);
                break;
            case 'battle':
                this.views.battle.render();
                break;
            case 'activity':
                this.views.activity.render();
                break;
            case 'team':
                this.views.team.render();
                break;
            case 'profile':
                this.views.profile.render();
                break;
            case 'admin':
                this.views.admin.render();
                break;
            case 'prompt':
                this.views.prompt.render();
                break;
            case 'dify':
                this.views.dify.render();
                break;
        }
        
        // 发布事件
        eventBus.emit(EVENTS.MAIN_TAB_CHANGED, normalized);
    }

    async handleRankTabChange(rankType) {
        // Step 1: Update state
        this.state.setActiveRankingsTab(rankType);
        
        // Step 2: Notify the view to update its internal state and UI (like headers)
        // This is now an async operation if the view needs to re-render parts of itself
        await this.views.rankings.handleTabChange(rankType);

        // Step 3: Now that the view is ready and in the correct state, trigger the search
        if (this.elements.userSearchBtn) {
            this.elements.userSearchBtn.click();
        }
    }
    
    switchContestTab(tabName) {
        this.state.setActiveContestTab(tabName);
        // 如果不是杯赛（25），清除杯赛分类状态
        if (tabName !== '25') {
            this.state.setActiveBeisaiCategory(null);
        }
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
    
    switchCourseCategory(category) {
        this.state.setActiveCourseCategory(category);
        this.state.courseCurrentPage = 1; // 重置页码
        eventBus.emit(EVENTS.COURSE_CATEGORY_CHANGED, category);
    }
    
    // 工具方法
    buildUrlWithChannelPut(baseUrl) {
        return helpers.buildUrlWithChannelPut(baseUrl, this.state.channelPut);
    }

    // --- Team invite landing ---
    async showTeamInviteLanding(teamId) {
        try {
            const modal = document.getElementById('team-invite-landing');
            const txt = document.getElementById('team-invite-text');
            const btnJoin = document.getElementById('team-invite-join');
            const btnCancel = document.getElementById('team-invite-cancel');
            if (!modal || !txt || !btnJoin || !btnCancel) return;

            let teamName = '';
            try {
                const summary = await this.apiService.teamStatsSummary(teamId);
                teamName = summary && (summary.teamName || summary.name || '');
            } catch (_) {}
            txt.textContent = teamName ? `是否加入 ${teamName}` : '是否加入该团队？';

            modal.style.display = 'flex';
            const close = () => { modal.style.display = 'none'; };
            const redirectToTeamHome = () => {
                // 重定向到团队首页（hash路由）
                setTimeout(() => { window.location.hash = '/team'; }, 0);
            };

            if (!btnCancel._bound) {
                btnCancel._bound = true;
                btnCancel.addEventListener('click', () => { close(); redirectToTeamHome(); });
            }
            if (!btnJoin._bound) {
                btnJoin._bound = true;
                btnJoin.addEventListener('click', async () => {
                    try {
                        await this.apiService.teamApply(teamId, '');
                        alert('已提交加入申请');
                        close();
                        redirectToTeamHome();
                    } catch (e) {
                        alert(e.message || '申请失败');
                        // 即使失败也回到团队首页，避免停留在邀请页
                        close();
                        redirectToTeamHome();
                    }
                });
            }
        } catch (_) {}
    }

    // --- Hash Routing helpers ---
    getRouteFromHash() {
        const h = (window.location.hash || '').replace(/^#/, '').trim();
        if (!h) return '';
        // 支持 #/tab 或 #tab 两种形式
        const cleaned = h.startsWith('/') ? h.slice(1) : h;
        const [first] = cleaned.split('?');
        return first || '';
    }

    normalizeTabName(name) {
        const key = String(name || '').toLowerCase();
        const allowed = new Set(['problems','rankings','daily','skill-tree','achievements','battle','activity','team','profile','faq','changelog','admin','prompt','dify']);
        if (key.startsWith('team/')) return 'team';
        if (key.startsWith('invitet') || key.startsWith('inviteTeam'.toLowerCase())) return 'team';
        if (allowed.has(key)) return key;
        // 允许一些别名
        if (key === 'skills' || key === 'skill' || key === 'skilltree') return 'skill-tree';
        if (key === 'contest' || key === 'practice' || key === 'interview') return 'problems';
        return 'daily';
    }

    /**
     * 更新 Dify 页签的显示/隐藏状态
     */
    updateDifyTabVisibility() {
        const difyNavItem = document.getElementById('dify-nav-item');
        const difyTabBtn = document.getElementById('dify-tab-btn');
        let enabled = false;
        try {
            const config = JSON.parse(localStorage.getItem('tracker_dify_config') || '{}');
            enabled = !!config.enabled;
        } catch (_) {}

        // 仅当配置了 enabled=true 且 当前用户具备 AI 助手权限（Dify 管理员）时显示
        const shouldShow = enabled && (this.state.canAccessDify ? this.state.canAccessDify() : this.state.isAdmin === true);

        if (shouldShow) {
            if (difyNavItem) difyNavItem.style.display = '';
            if (difyTabBtn) difyTabBtn.style.display = '';
        } else {
            if (difyNavItem) difyNavItem.style.display = 'none';
            if (difyTabBtn) difyTabBtn.style.display = 'none';
        }
    }

    /**
     * 更新 Prompt 页签的显示/隐藏状态
     * 当前：管理员或具备 Prompt 测试资格可见
     */
    updatePromptTabVisibility() {
        const promptNavItem = document.getElementById('prompt-nav-item');
        const promptTabBtn = document.getElementById('prompt-tab-btn');
        if (this.state.canAccessPrompt && this.state.canAccessPrompt()) {
            if (promptNavItem) promptNavItem.style.display = '';
            if (promptTabBtn) promptTabBtn.style.display = '';
        } else {
            if (promptNavItem) promptNavItem.style.display = 'none';
            if (promptTabBtn) promptTabBtn.style.display = 'none';
        }
    }

    parseTeamInviteRoute() {
        // 直接从完整 hash 解析，保留查询参数
        const full = String(window.location.hash || '').replace(/^#\/?/, '');
        const s = full.replace(/^\/?/, '');
        // 支持两种形式：team/{id} 或 team/join?teamId={id}
        let m = s.match(/^team\/(\d+)/i);
        if (m) return m[1];
        if (s.toLowerCase().startsWith('team/join')) {
            const q = s.split('?')[1] || '';
            const sp = new URLSearchParams(q);
            const tid = sp.get('teamId');
            if (tid) return tid;
        }
        // 新前缀：inviteTeam/{id} 或 inviteTeam?teamId=...
        m = s.match(/^inviteTeam\/(\d+)/i);
        if (m) return m[1];
        if (s.toLowerCase().startsWith('inviteteam')) {
            const q = s.split('?')[1] || '';
            const sp = new URLSearchParams(q);
            const tid = sp.get('teamId');
            if (tid) return tid;
        }
        return null;
    }

    extractProblemsSubview(name) {
        const key = String(name || '').toLowerCase();
        if (key === 'contest') return 'contests';
        if (key === 'practice') return 'practice';
        if (key === 'interview') return 'interview';
        return null;
    }

    // 在全局初始化阶段探测并设置登录态（使用 todayinfo，避免必须在"打卡"页才识别登录）
    async detectAndSetLoggedInUser() {
        try {
            const data = await this.apiService.fetchDailyTodayInfo();
            if (data && data.code === 0 && data.data) {
                const d = data.data;
                const uid = d.uid && d.uid !== 0 ? String(d.uid) : null;
                this.state.setLoggedInUser(uid, d.user || null);
                
                // 如果用户已登录，检查管理员状态 + Prompt 测试资格
                if (uid) {
                    await this.state.checkAdminStatus(this.apiService);
                    // 注意：Prompt gate 本身也会放行管理员，但这里仍做一次检查以支持非管理员白名单用户
                    await this.state.checkPromptTestAccessStatus(this.apiService);
                    await this.state.checkDifyAdminStatus(this.apiService);
                    eventBus.emit(EVENTS.USER_LOGIN, { uid, user: d.user || null, ...d });
                }
            } else {
                // 未登录或异常时，显式清空本地登录态
                this.state.setLoggedInUser(null, null);
                this.state.isAdmin = false;
                this.state.isPromptTester = false;
                this.state.isDifyAdmin = false;
            }
        } catch (_) {
            // 忽略错误，不影响其它页面加载
        }
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
        const selectIds = (selector, filterFn = null) => Array.from(document.querySelectorAll(selector))
            .map(el => el.getAttribute('data-problem-id'))
            .filter(pid => (filterFn ? filterFn(pid) : Boolean(pid)))
            .map(String)
            .join(',');

        const activeView = this.state.activeView;
        if (activeView === 'contests') {
            qids = selectIds('#contests-view td[data-problem-id]');
        } else if (activeView === 'interview') {
            qids = selectIds('#interview-view td[data-problem-id]');
        } else if (activeView === 'practice') {
            // practice 视图题目由 JSON 渲染，直接从 DOM 提取
            qids = selectIds('#practice-view td[data-problem-id]');
        } else if (activeView === 'course') {
            // 课程：只统计“正常题目”（有效 problemId），避免 undefined/0 影响全AC/AK判定
            qids = selectIds('#course-view td[data-problem-id]', helpers.isValidProblemId);
        }
        return qids || null;
    }

    // Apply highlighting based on diff results
    applyProblemHighlighting(data, hasRival) {
        const dbgEnabled = (typeof window !== 'undefined') && !!window.__TRACKER_DEBUG_COURSE_AK__;
        const dbg = (...args) => { if (dbgEnabled) console.log('[course-ak][App]', ...args); };

        const { ac1Qids = [], ac2Qids = [] } = data || {};
        const ac1Set = new Set(ac1Qids.map(String));
        const ac2Set = new Set(ac2Qids.map(String));

        const allProblemCells = document.querySelectorAll('#contests-view td[data-problem-id], #practice-view td[data-problem-id], #interview-view td[data-problem-id], #course-view td[data-problem-id]');
        
        // Reset all statuses first
        allProblemCells.forEach(cell => {
            cell.classList.remove('status-ac', 'status-rival-ac', 'status-none');
        });

        // Apply new statuses
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

        // contests/interview 行首 “全AC” 标记（逐行）
        const contestRows = document.querySelectorAll('#contests-view tbody tr, #interview-view tbody tr');
        contestRows.forEach(row => {
            const cells = row.querySelectorAll('td[data-problem-id]');
            if (!cells.length) return;
            const allAc = Array.from(cells).every(c => ac1Set.has(c.getAttribute('data-problem-id')));
            const first = row.querySelector('td:first-child');
            if (!first) return;
            if (allAc) first.classList.add('status-all-ac'); else first.classList.remove('status-all-ac');
        });

        // practice 视图：按知识点维度（跨行）“全AC” 标记
        const practiceProblems = document.querySelectorAll('#practice-view td[data-problem-id][data-kp]');
        if (practiceProblems.length) {
            const kpToPids = new Map();
            practiceProblems.forEach(cell => {
                const kp = cell.getAttribute('data-kp') || '';
                const pid = cell.getAttribute('data-problem-id');
                if (!kpToPids.has(kp)) kpToPids.set(kp, []);
                kpToPids.get(kp).push(pid);
            });
            kpToPids.forEach((pids, kp) => {
                const allAc = pids.every(pid => ac1Set.has(String(pid)));
                const kpCells = document.querySelectorAll(`#practice-view td.knowledge-point-cell[data-kp="${kp.replace(/"/g, '\\"')}"]`);
                kpCells.forEach((cell, idx) => {
                    // 只在第一行显示绿色标记，其它行移除
                    if (idx === 0 && allAc) cell.classList.add('status-all-ac');
                    else cell.classList.remove('status-all-ac');
                });
            });
        }

        // course 视图：按“比赛”维度（跨行）“全AC” 标记（比赛名变绿）
        const courseProblems = document.querySelectorAll('#course-view td[data-problem-id][data-contest-id]');
        dbg('applyProblemHighlighting: courseProblems', courseProblems.length);
        if (courseProblems.length) {
            const cidToPids = new Map();
            courseProblems.forEach(cell => {
                const cid = cell.getAttribute('data-contest-id') || '';
                const pid = cell.getAttribute('data-problem-id');
                if (!cid) return;
                if (!helpers.isValidProblemId(pid)) return;
                if (!cidToPids.has(cid)) cidToPids.set(cid, []);
                cidToPids.get(cid).push(pid);
            });
            dbg('applyProblemHighlighting: contests aggregated', { contests: cidToPids.size });
            cidToPids.forEach((pids, cid) => {
                const allAc = pids.length > 0 && pids.every(pid => ac1Set.has(String(pid)));
                const titleCell = document.querySelector(`#course-view td.course-contest-cell[data-contest-id="${String(cid).replace(/"/g, '\\"')}"]`);
                if (dbgEnabled) dbg('contest check', { cid, pidsCnt: pids.length, allAc, titleCellFound: !!titleCell });
                if (!titleCell) return;
                if (allAc) titleCell.classList.add('status-all-ac');
                else titleCell.classList.remove('status-all-ac');
            });
        } else {
            dbg('applyProblemHighlighting: no courseProblems found (selector td[data-problem-id][data-contest-id])');
        }
    }

    // 统一通过“Search”按钮触发题库刷新，带防抖，避免重复 /diff 请求
    debouncedProblemSearch(delay = 0) {
        const now = Date.now();
        if (now - (this._lastProblemSearchTs || 0) < 150) return; // 150ms 防抖
        this._lastProblemSearchTs = now;
        setTimeout(() => {
            try {
                if (this.elements && this.elements.problemSearchBtn) {
                    this.elements.problemSearchBtn.click();
                } else {
                    // 兜底：若按钮未挂载，直接调用逻辑
                    this.handleUserStatusSearch();
                }
            } catch (_) {}
        }, delay);
    }

    // 等待列表渲染完成后再触发搜索，避免空DOM导致qids收集不到
    triggerSearchWhenReady(view) {
        const map = {
            contests: '#contests-view td[data-problem-id]',
            practice: '#practice-view td[data-problem-id]',
            interview: '#interview-view td[data-problem-id]'
        };
        const selector = map[view] || '#contests-view td[data-problem-id]';
        let tries = 0;
        const check = () => {
            tries += 1;
            if (document.querySelector(selector)) {
                this.debouncedProblemSearch(0);
                return;
            }
            if (tries < 25) { // 最多等待 ~2.5s
                setTimeout(check, 100);
            } else {
                // 超时兜底也触发一次
                this.debouncedProblemSearch(0);
            }
        };
        check();
    }
    
    /**
     * 初始化帮助菜单
     */
    initHelpMenu() {
        const helpMenu = document.getElementById('tracker-help-menu');
        const helpDropdown = document.getElementById('tracker-help-dropdown');
        if (!helpMenu || !helpDropdown) return;
        
        // 点击帮助链接显示/隐藏下拉菜单
        const helpLink = helpMenu.querySelector('.tracker-help-link');
        if (helpLink) {
            helpLink.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = helpDropdown.style.display === 'block';
                helpDropdown.style.display = isVisible ? 'none' : 'block';
            });
        }
        
        // 点击外部区域关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!helpMenu.contains(e.target) && !helpDropdown.contains(e.target)) {
                helpDropdown.style.display = 'none';
            }
        });
    }
    
    /**
     * 更新导航栏active状态
     */
    updateNavActiveState(tabName) {
        const navItems = document.querySelectorAll('.tracker-nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
        });
        
        // 根据tabName映射到导航栏项
        // 导航栏顺序：首页(0), 题库(1), 排行榜(2), 技能树(3), 成就(4), 对战(5), 团队(6), 竞赛(7), 活动(8), 我的(9), AI(10), 管理员(11)
        const navMap = {
            'daily': 0,         // 首页
            'problems': 1,      // 题库
            'rankings': 2,      // 排行榜
            'skill-tree': 3,    // 技能树
            'achievements': 4,  // 成就
            'battle': 5,        // 对战
            'team': 6,          // 团队
            'activity': 8,      // 活动（在竞赛后面）
            'profile': 9,       // 我的
            'dify': 10          // AI
        };
        
        const navIndex = navMap[tabName];
        if (navIndex !== undefined && navItems[navIndex]) {
            navItems[navIndex].classList.add('active');
        }
    }

    /**
     * 更新管理员页签的显示/隐藏状态
     */
    updateAdminTabVisibility() {
        const adminNavItem = document.getElementById('admin-nav-item');
        const adminTabBtn = document.getElementById('admin-tab-btn');
        
        if (this.state.isAdmin) {
            if (adminNavItem) adminNavItem.style.display = '';
            if (adminTabBtn) adminTabBtn.style.display = '';
        } else {
            if (adminNavItem) adminNavItem.style.display = 'none';
            if (adminTabBtn) adminTabBtn.style.display = 'none';
        }
    }
}

// 导出单例实例
export const app = new NowcoderTracker();

// 将app实例设置到window对象上，供其他模块使用
window.app = app;

// Debug marker：用于确认是否加载到最新前端代码（不会影响功能）
try {
    console.log('[course-ak][marker] App.js loaded', {
        ts: Date.now(),
        debugFlag: (typeof window !== 'undefined') ? !!window.__TRACKER_DEBUG_COURSE_AK__ : false
    });
} catch (_) {}
