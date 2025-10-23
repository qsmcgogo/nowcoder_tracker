import { eventBus, EVENTS } from '../events/EventBus.js';

// Import skill tree structure and mapping from SkillTreeView
// This is a bit of a hack, in a larger app this might come from a shared module.
import { skillTreeData, nodeIdToTagId } from './SkillTreeView.js';


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
            
            // --- Fetch all data in parallel ---
            const checkinPromise = this.apiService.fetchUserCheckinData(userId);
            const problemRankPromise = this.apiService.fetchRankings('problem', 1, userId, 1);
            
            const allTagIds = Object.values(nodeIdToTagId);
            const skillProgressPromise = this.apiService.fetchSkillTreeProgress(userId, allTagIds);

            const [checkinData, problemRankData, skillProgressData] = await Promise.all([
                checkinPromise, 
                problemRankPromise,
                skillProgressPromise
            ]);
            
            // --- Process Data ---
            const problemUser = problemRankData?.ranks?.[0];
            if (!problemUser) {
                throw new Error('无法获取用户的过题信息。');
            }

            const skillTreeStats = this._calculateSkillTreeStats(skillProgressData.nodeProgress);

            const userData = {
                uid: problemUser.uid,
                name: problemUser.name,
                headUrl: problemUser.headUrl,
                problemPassed: problemUser.count,
                rank: problemUser.place === 0 ? '1w+' : problemUser.place,
                checkin: {
                    count: checkinData?.count || 0,
                    continueDays: checkinData?.continueDays || 0
                },
                skillTree: { 
                    completedChapters: skillTreeStats.completedChapters 
                },
                completedKnowledgePoints: skillTreeStats.completedKnowledgePoints
            };
            
            this.container.innerHTML = this.getUserProfileHtml(userData);

        } catch (error) {
            console.error("Failed to render profile view:", error);
            this.container.innerHTML = `<div class="error-message">无法加载您的个人信息，请稍后重试。(${error.message})</div>`;
        }
    }

    /**
     * Calculates skill tree statistics based on user progress.
     * @param {Object} nodeProgress - An object mapping tagId to progress percentage.
     * @returns {{completedChapters: number, completedKnowledgePoints: number}}
     */
    _calculateSkillTreeStats(nodeProgress) {
        let completedKnowledgePoints = 0;
        let completedChapters = 0;

        if (!nodeProgress) {
            return { completedChapters, completedKnowledgePoints };
        }

        // 1. Calculate completed knowledge points
        //    以“rate 为 1”判定通关；兼容两种量纲：
        //    - 0~1 浮点：>= 0.999 视为 1
        //    - 0~100 百分比：>= 99.9 视为 100
        for (const tagId in nodeProgress) {
            const value = Number(nodeProgress[tagId]) || 0;
            const isRateScale = value <= 1; // 后端多数返回 0~1
            const completed = isRateScale ? (value >= 0.999) : (value >= 99.9);
            if (completed) {
                completedKnowledgePoints++;
            }
        }
        
        // 2. Calculate completed chapters (currently only "晨曦微光")
        const newbieTree = skillTreeData['newbie-130'];
        if (newbieTree && newbieTree.stages) {
            const firstStage = newbieTree.stages.find(s => s.id === 'stage-1');

            if (firstStage && firstStage.columns) {
                const isFirstStageComplete = firstStage.columns.every(column => {
                    // A column is complete if all its nodes are >= 60%
                    return column.nodeIds.every(nodeId => {
                        const tagId = nodeIdToTagId[nodeId];
                        return (nodeProgress[tagId] || 0) >= 60;
                    });
                });

                if (isFirstStageComplete) {
                    completedChapters++;
                }
            }
        }
        
        // Logic for other chapters can be added here in the future
        // ...

        return { completedChapters, completedKnowledgePoints };
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
                </div>
            </div>
        `;
    }
}
