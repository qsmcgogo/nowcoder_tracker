import { eventBus, EVENTS } from '../events/EventBus.js';

export class ProfileView {
    constructor(elements, state, apiService) {
        this.container = elements.profile; // Fix: was elements.profileView, now matches App.js
        this.apiService = apiService;
        this.appState = state; // Correctly assign the state object
    }

    async render() {
        if (!this.container) {
            return;
        }

        if (!this.appState.isLoggedIn()) {
            this.container.innerHTML = this.getLoggedOutHtml();
            this.bindLoginEvent();
            return;
        }

        this.container.innerHTML = `<div class="loader"></div>`;
        try {
            const userId = this.appState.loggedInUserId;
            
            // 并行获取打卡数据和过题榜数据
            const checkinPromise = this.apiService.fetchUserCheckinData(userId);
            // Use the refactored fetchRankings to get a single user's problem rank data
            const problemRankPromise = this.apiService.fetchRankings('problem', 1, userId, 1); 
            
            const [checkinData, problemRankData] = await Promise.all([checkinPromise, problemRankPromise]);
            
            const problemUser = problemRankData?.ranks?.[0];
            
            if (!problemUser) {
                throw new Error('无法获取用户的过题信息。');
            }

            const userData = {
                uid: problemUser.uid,
                name: problemUser.name,
                headUrl: problemUser.headUrl, // Correct field name is headUrl
                problemPassed: problemUser.count, // Correct field name, was solvedCount
                rank: problemUser.place === 0 ? '1w+' : problemUser.place, // Correct field name and logic
                checkin: {
                    count: checkinData?.count || 0,
                    continueDays: checkinData?.continueDays || 0
                },
                skillTree: { completedChapters: 1 }, // Placeholder
                completedKnowledgePoints: 12, // Placeholder for new data point
                contestsAttended: 25, // Placeholder
                contestsAKed: 3 // Placeholder
            };
            
            this.container.innerHTML = this.getUserProfileHtml(userData);

        } catch (error) {
            console.error("Failed to render profile view:", error);
            this.container.innerHTML = `<div class="error-message">无法加载您的个人信息，请稍后重试。(${error.message})</div>`;
        }
    }

    getLoggedOutHtml() {
        return `
            <div class="profile-logged-out">
                <h2>登录后查看个人主页</h2>
                <p>登录后可查看详细的刷题统计、打卡记录和技能树进度。</p>
                <div class="input-group">
                    <input type="text" id="profile-login-uid" placeholder="输入你的牛客UID登录">
                    <button id="profile-login-btn" class="action-btn">登录</button>
                </div>
            </div>
        `;
    }

    bindLoginEvent() {
        const loginBtn = document.getElementById('profile-login-btn');
        const uidInput = document.getElementById('profile-login-uid');
        if (loginBtn && uidInput) {
            loginBtn.addEventListener('click', () => {
                const userId = uidInput.value.trim();
                if (userId) {
                    eventBus.emit(EVENTS.USER_LOGIN_SUCCESS, userId);
                    // 登录成功后立即重新渲染
                    this.render(); 
                }
            });
        }
    }

    getUserProfileHtml(user) {
        const avatarUrl = user.headUrl && user.headUrl.startsWith('http') ? user.headUrl : `https://uploadfiles.nowcoder.com${user.headUrl || ''}`;
        
        return `
            <div class="profile-card">
                <div class="profile-header">
                    <img src="${avatarUrl}" alt="${user.name}的头像" class="profile-avatar">
                    <h2 class="profile-name">${user.name}</h2>
                    <p class="profile-uid">UID: ${user.uid}</p>
                </div>
                <div class="profile-stats">
                    <div class="stat-item">
                        <span class="stat-value">${user.problemPassed}</span>
                        <span class="stat-label">总过题数</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${user.rank}</span>
                        <span class="stat-label">全站排名</span>
                    </div>
                </div>
                <div class="profile-details">
                    <div class="detail-item">
                        <span class="detail-icon">📅</span>
                        <span class="detail-label">累积打卡</span>
                        <span class="detail-value">${user.checkin.count} 天</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">🔥</span>
                        <span class="detail-label">连续打卡</span>
                        <span class="detail-value">${user.checkin.continueDays} 天</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">🌳</span>
                        <span class="detail-label">技能树</span>
                        <span class="detail-value">已通关 ${user.skillTree.completedChapters} 章</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">🧠</span>
                        <span class="detail-label">知识点</span>
                        <span class="detail-value">已通关 ${user.completedKnowledgePoints} 个</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">🏆</span>
                        <span class="detail-label">
                            参赛数量
                            <span class="tooltip-container">
                                <span class="tooltip-icon">?</span>
                                <span class="tooltip-text">只计算牛客竞赛官方系列赛</span>
                            </span>
                        </span>
                        <span class="detail-value">${user.contestsAttended} 场</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">🚀</span>
                        <span class="detail-label">AK数量</span>
                        <span class="detail-value">${user.contestsAKed} 场</span>
                    </div>
                </div>
            </div>
        `;
    }
}
