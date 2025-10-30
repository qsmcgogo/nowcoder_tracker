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
            return;
        }

        this.container.innerHTML = `<div class="loader"></div>`;
        try {
            const userId = this.appState.loggedInUserId;
            
            // --- Fetch all data in parallel ---
            const checkinPromise = this.apiService.fetchUserCheckinData(userId);
            const problemRankPromise = this.apiService.fetchRankings('problem', 1, userId, 1);
            const badgeInfoPromise = this.apiService.fetchBadgeUserInfo();
            
            // 覆盖一层：构造“所有需要统计的 tagId”集合（包含第一章、间章、第二章，确保二维数组 1019 也在内）
            const allTagIds = this._collectAllTrackedTagIds();
            const skillProgressPromise = this.apiService.fetchSkillTreeProgress(userId, allTagIds);

            const [checkinData, problemRankData, skillProgressData, badgeInfo] = await Promise.all([
                checkinPromise,
                problemRankPromise,
                skillProgressPromise,
                badgeInfoPromise
            ]);
            
            // --- Process Data ---
            const problemUser = problemRankData?.ranks?.[0];
            if (!problemUser) {
                throw new Error('无法获取用户的过题信息。');
            }

            const skillTreeStats = this._calculateSkillTreeStats(skillProgressData.nodeProgress);

            // 连续打卡：若“今天”和“昨天”都未打卡则置 0，否则使用 continueday 参数（多名兼容）
            const rawConsecutive = Number(checkinData?.continueday ?? checkinData?.continueDay ?? checkinData?.continueDays ?? 0) || 0;
            const todayVal = (checkinData && (checkinData.todayClockRank ?? checkinData.todayChecked ?? checkinData.todayClocked))
                ;
            const yestVal = (checkinData && (checkinData.yesterdayClockCount ?? checkinData.yesterdayChecked ?? checkinData.yesterdayClocked))
                ;
            const bothFlagsPresent = (todayVal !== undefined && yestVal !== undefined);
            const fixedConsecutive = (bothFlagsPresent && Number(todayVal) === 0 && Number(yestVal) === 0) ? 0 : rawConsecutive;

            const userData = {
                uid: problemUser.uid,
                name: problemUser.name,
                headUrl: problemUser.headUrl,
                problemPassed: problemUser.count,
                rank: problemUser.place === 0 ? '1w+' : problemUser.place,
                checkin: {
                    count: checkinData?.count || 0,
                    continueDays: fixedConsecutive
                },
                skillTree: { 
                    completedChapters: skillTreeStats.completedChapters 
                },
                completedKnowledgePoints: skillTreeStats.completedKnowledgePoints,
                achievements: {
                    totalPoints: (badgeInfo && typeof badgeInfo.totalPoints === 'number') ? badgeInfo.totalPoints : 0
                }
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

        // 工具：判断一个进度值是否视为“通关”
        const isCompleted = (v) => {
            const val = Number(v) || 0;
            const isRate = val <= 1;
            return isRate ? (val >= 0.999) : (val >= 99.9);
        };

        // 1) 统计知识点通关数量（仅统计我们跟踪的节点集合，避免噪音 tag）
        const trackedNodeIds = this._collectAllTrackedNodeIds();
        trackedNodeIds.forEach(nodeId => {
            const tagId = nodeIdToTagId[nodeId];
            if (tagId != null && isCompleted(nodeProgress[tagId])) {
                completedKnowledgePoints++;
            }
        });

        // 2) 统计章节通关数量：第一章、间章：拂晓、第二章
        const newbieTree = skillTreeData['newbie-130'];
        if (newbieTree && newbieTree.stages) {
            const stage1 = newbieTree.stages.find(s => s.id === 'stage-1');
            const stage2 = newbieTree.stages.find(s => s.id === 'stage-2');

            const checkStage = (stage) => {
                if (!stage || !stage.columns) return false;
                // 章节通关：该章节的所有知识点都“通关”
                return stage.columns.every(col => col.nodeIds.every(nodeId => {
                    const tagId = nodeIdToTagId[nodeId];
                    return isCompleted(nodeProgress[tagId]);
                }));
            };

            if (checkStage(stage1)) completedChapters++;
            if (checkStage(stage2)) completedChapters++;

            // 间章：拂晓（5个节点）作为独立一章统计
            const interludeIds = ['builtin-func', 'lang-feature', 'simulation-enum', 'construction', 'greedy-sort'];
            const interludeComplete = interludeIds.every(id => {
                const tagId = nodeIdToTagId[id];
                return isCompleted(nodeProgress[tagId]);
            });
            if (interludeComplete) completedChapters++;
        }

        return { completedChapters, completedKnowledgePoints };
    }

    // 收集用于统计的全部 nodeId（第一章 + 第二章 + 间章）
    _collectAllTrackedNodeIds() {
        const tree = skillTreeData['newbie-130'];
        const all = new Set();
        if (tree && tree.stages) {
            tree.stages.forEach(stage => {
                if (stage.columns && stage.columns.length) {
                    stage.columns.forEach(c => c.nodeIds.forEach(id => all.add(id)));
                }
            });
        }
        // 间章节点
        ['builtin-func', 'lang-feature', 'simulation-enum', 'construction', 'greedy-sort']
            .forEach(id => all.add(id));
        return Array.from(all);
    }

    // 收集所有需要查询进度的 tagId（包含二维数组 1019）
    _collectAllTrackedTagIds() {
        const nodeIds = this._collectAllTrackedNodeIds();
        const tagSet = new Set(nodeIds.map(id => nodeIdToTagId[id]).filter(v => v != null));
        // 保底确保二维数组(1019)在内
        tagSet.add(1019);
        return Array.from(tagSet);
    }

    getLoggedOutHtml() {
        return `
            <div class="profile-logged-out">
                <h2>登录后查看个人主页</h2>
                <p>登录后可查看详细的刷题统计、打卡记录和技能树进度。</p>
                <a href="https://ac.nowcoder.com/login?callBack=/" target="_blank" rel="noopener noreferrer" class="action-btn">前往登录</a>
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
                    <div class="stat-item">
                        <span class="stat-value">${user.achievements.totalPoints}</span>
                        <span class="stat-label">成就点数</span>
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
