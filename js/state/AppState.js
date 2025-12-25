/**
 * 应用状态管理模块
 * 统一管理所有应用状态
 */

export class AppState {
    constructor() {
        // 主标签页状态
        this.activeMainTab = 'daily';
        this.activeView = 'practice'; // 'contests', 'practice', or 'interview'
        
        // 比赛视图状态
        this.activeContestTab = 'all';
        this.contestsCurrentTab = 'all';
        this.activeBeisaiCategory = null; // 杯赛分类：'蓝桥杯' | '传智杯' | null（表示全部杯赛）
        this.contests = [];
        this.totalContests = 0;
        this.contestsCurrentPage = 1;
        
        // 练习视图状态
        this.activePracticeSubTab = 'newbie130';
        this.practiceDataCache = null;
        this.practiceItems = [];
        this.practiceCurrentPage = 1;
        
        // 面试视图状态
        this.activeInterviewSubTab = 'campus';
        this.activeCampusSubTab = '100';
        this.interviewDataCache = null;
        this.interviewItems = [];
        this.interviewCurrentPage = 1;
        
        // 课程视图状态
        this.activeCourseCategory = ''; // 空字符串表示"全部课程"
        this.courseContests = [];
        this.totalCourseContests = 0;
        this.courseCurrentPage = 1;
        
        // 排行榜状态
        this.activeRankingsTab = 'problem'; // 'problem' or 'checkin'
        this.rankingsTotalUsers = 0;
        this.rankingsCurrentPage = 1;
        this.lastSearchedUid = null;
        this.lastSearchedUserData = null;
        
        // 用户状态
        this.loggedInUserId = null;
        this.loggedInUserData = null;
        this.isAdmin = false; // 管理员状态
        this.adminCheckedUserId = null; // 已检查过管理员状态的用户ID（用于缓存）
        this.adminCheckPromise = null; // 正在进行的管理员检查Promise（避免并发请求）
        
        // 每日一题状态
        this.currentDailyProblem = null;
        this.calendarDate = new Date();
        this.simulatedCheckIns = new Set();
        
        // 加载状态
        this.isLoading = {
            contests: false,
            practice: false,
            rankings: false,
            daily: false,
            interview: false,
            course: false
        };
        
        // 渠道参数
        this.channelPut = this.getChannelPut();
    }
    
    getChannelPut() {
        const urlParams = new URLSearchParams(window.location.search);
        // 若URL未带channelPut，则返回空字符串；由各功能位自行回退到历史默认
        return urlParams.get('channelPut') || '';
    }
    
    // 状态更新方法
    setActiveMainTab(tab) {
        this.activeMainTab = tab;
    }
    
    setActiveView(view) {
        this.activeView = view;
    }
    
    setActiveContestTab(tab) {
        this.activeContestTab = tab;
        this.contestsCurrentTab = tab;
    }
    
    setActiveBeisaiCategory(category) {
        this.activeBeisaiCategory = category;
    }
    
    setActivePracticeSubTab(tab) {
        this.activePracticeSubTab = tab;
    }
    
    setActiveInterviewSubTab(tab) {
        this.activeInterviewSubTab = tab;
    }
    
    setActiveCampusSubTab(tab) {
        this.activeCampusSubTab = tab;
    }
    
    setActiveCourseCategory(category) {
        this.activeCourseCategory = category;
    }
    
    setActiveRankingsTab(tab) {
        this.activeRankingsTab = tab;
    }
    
    setLoadingState(module, loading) {
        this.isLoading[module] = loading;
    }
    
    setLoggedInUser(userId, userData) {
        // ---- 调试信息 ----
        console.log(`[AppState] 正在设置用户ID:`, userId, `(类型: ${typeof userId})`);
        
        const previousUserId = this.loggedInUserId;
        this.loggedInUserId = userId;
        this.loggedInUserData = userData;
        
        // 如果用户ID变化或用户登出，清除管理员状态缓存
        if (previousUserId !== userId) {
            this.isAdmin = false;
            this.adminCheckedUserId = null;
            this.adminCheckPromise = null;
        }
    }
    
    /**
     * 异步检查当前用户是否为管理员（调用后端接口）
     * 使用缓存机制，避免重复调用接口
     * @param {ApiService} apiService - API服务实例
     * @returns {Promise<boolean>} 返回是否为管理员
     */
    async checkAdminStatus(apiService) {
        // 如果用户未登录，直接返回 false
        if (!this.loggedInUserId) {
            this.isAdmin = false;
            return false;
        }
        
        // 如果已经检查过当前用户的管理员状态，直接返回缓存结果
        if (this.adminCheckedUserId === this.loggedInUserId) {
            return this.isAdmin;
        }
        
        // 如果已经有正在进行的检查请求，等待该请求完成
        if (this.adminCheckPromise) {
            return await this.adminCheckPromise;
        }
        
        // 创建新的检查请求
        this.adminCheckPromise = (async () => {
            try {
                const isAdmin = await apiService.checkAdmin();
                this.isAdmin = isAdmin;
                this.adminCheckedUserId = this.loggedInUserId; // 记录已检查的用户ID
                console.log(`[AppState] 管理员状态判定结果 (isAdmin):`, this.isAdmin, `(用户ID: ${this.loggedInUserId})`);
                return isAdmin;
            } catch (error) {
                console.error('[AppState] 检查管理员状态失败:', error);
                this.isAdmin = false;
                // 即使失败也记录用户ID，避免重复请求
                this.adminCheckedUserId = this.loggedInUserId;
                return false;
            } finally {
                // 清除正在进行的请求标记
                this.adminCheckPromise = null;
            }
        })();
        
        return await this.adminCheckPromise;
    }
    
    isLoggedIn() {
        return !!this.loggedInUserId;
    }
    
    setCurrentDailyProblem(problem) {
        this.currentDailyProblem = problem;
    }
    
    setCalendarDate(date) {
        this.calendarDate = date;
    }
    
    // 重置方法
    resetContestState() {
        this.contests = [];
        this.totalContests = 0;
        this.contestsCurrentPage = 1;
    }
    
    resetPracticeState() {
        this.practiceDataCache = null;
        this.practiceItems = [];
        this.practiceCurrentPage = 1;
    }
    
    resetInterviewState() {
        this.interviewDataCache = null;
        this.interviewItems = [];
        this.interviewCurrentPage = 1;
    }
    
    resetRankingsState() {
        this.rankingsTotalUsers = 0;
        this.rankingsCurrentPage = 1;
        this.lastSearchedUid = null;
        this.lastSearchedUserData = null;
    }
}
