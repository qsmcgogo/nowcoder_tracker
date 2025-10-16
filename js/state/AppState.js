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
        
        // 排行榜状态
        this.rankingsTotalUsers = 0;
        this.rankingsCurrentPage = 1;
        this.lastSearchedUid = null;
        this.lastSearchedUserData = null;
        
        // 用户状态
        this.loggedInUserId = null;
        this.loggedInUserData = null;
        
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
            interview: false
        };
        
        // 渠道参数
        this.channelPut = this.getChannelPut();
    }
    
    getChannelPut() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('channelPut') || 'w251acm';
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
    
    setActivePracticeSubTab(tab) {
        this.activePracticeSubTab = tab;
    }
    
    setActiveInterviewSubTab(tab) {
        this.activeInterviewSubTab = tab;
    }
    
    setActiveCampusSubTab(tab) {
        this.activeCampusSubTab = tab;
    }
    
    setLoadingState(module, loading) {
        this.isLoading[module] = loading;
    }
    
    setLoggedInUser(userId, userData) {
        this.loggedInUserId = userId;
        this.loggedInUserData = userData;
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
