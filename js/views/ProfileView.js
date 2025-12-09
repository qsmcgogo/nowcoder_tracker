import { eventBus, EVENTS } from '../events/EventBus.js';
import * as helpers from '../utils/helpers.js';

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
            
            // 使用整合接口获取所有信息
            const myInfo = await this.apiService.fetchMyInfo();
            
            // 如果整合接口失败，回退到原来的多个接口调用方式
            if (!myInfo) {
                throw new Error('无法获取用户信息');
            }

            // 获取用户基本信息（需要从排行榜获取，因为 myInfo 接口没有返回用户基本信息）
            let userInfo = null;
            try {
                const problemRankData = await this.apiService.fetchRankings('problem', 1, userId, 1);
                userInfo = problemRankData?.ranks?.[0];
            } catch (err) {
                console.warn('Failed to fetch user info:', err);
            }
            
            // 处理数据：后端返回的是扁平结构
            const user = myInfo.user || {};
            const checkin = myInfo.checkin || {};
            const skillTree = myInfo.skillTree || {};
            const badge = myInfo.badge || {};
            
            // 处理技能树数据
            const skillTreeTotalProgress = skillTree.totalProgress || 0;
            const chapterProgress = skillTree.chapterProgress || {};
            
            // 章节显示名称映射（按照技能树页面的顺序和名称）
            const chapterDisplayNames = {
                'chapter1': '第一章：晨曦微光',
                'interlude_dawn': '间章：拂晓',
                'chapter2': '第二章：懵懂新芽',
                'interlude_2_5': '间章：含苞',
                'chapter3': '第三章：初显峥嵘',
                'boss_dream': '梦'
            };
            
            // 章节顺序（按照技能树页面的顺序）
            const chapterOrder = ['chapter1', 'interlude_dawn', 'chapter2', 'interlude_2_5', 'chapter3', 'boss_dream'];

            // 提取成就点数：badge.userTotalScore 是一个对象，包含 totalScore 字段
            let achievementPoints = 0;
            if (badge && typeof badge === 'object') {
                // badge.userTotalScore 是一个 JSONObject，结构为 {"totalScore": 123}
                if (badge.userTotalScore && typeof badge.userTotalScore === 'object') {
                    achievementPoints = badge.userTotalScore.totalScore || 0;
                } else if (typeof badge.userTotalScore === 'number') {
                    // 兼容直接是数字的情况
                    achievementPoints = badge.userTotalScore;
                } else {
                    // 尝试其他可能的字段
                    achievementPoints = badge.score || badge.totalScore || badge.points || 0;
                }
            } else if (typeof badge === 'number') {
                achievementPoints = badge;
            }

            // 构建用户数据对象
            const userData = {
                uid: user.uid || userId,
                name: user.name || '',
                headUrl: user.headUrl || '',
                problemPassed: user.count || 0,
                rank: user.place === 0 ? '1w+' : (user.place || '1w+'),
                checkin: {
                    count: checkin.countDay || 0,
                    continueDays: checkin.continueDay || 0
                },
                skillTree: { 
                    totalProgress: Math.round(skillTreeTotalProgress * 100), // 转换为百分比
                    chapterProgress: chapterProgress,
                    chapterDisplayNames: chapterDisplayNames,
                    chapterOrder: chapterOrder
                },
                achievements: {
                    totalPoints: achievementPoints
                },
                battle1v1Score: myInfo.battle1v1Score || 1000
            };
            
            this.container.innerHTML = this.getUserProfileHtml(userData);
            
            // 绑定展开/收起事件
            this.bindSkillTreeExpandEvents();

        } catch (error) {
            console.error("Failed to render profile view:", error);
            this.container.innerHTML = `<div class="error-message">无法加载您的个人信息，请稍后重试。(${error.message})</div>`;
        }
    }

    /**
     * 绑定技能树进度展开/收起事件
     */
    bindSkillTreeExpandEvents() {
        const skillTreeItem = this.container.querySelector('.skill-tree-progress-item');
        if (skillTreeItem) {
            skillTreeItem.style.cursor = 'pointer';
            
            skillTreeItem.addEventListener('click', (e) => {
                // 如果点击的是展开的内容区域，不触发折叠
                if (e.target.closest('.chapter-progress-list')) {
                    return;
                }
                
                skillTreeItem.classList.toggle('expanded');
                // chapter-progress-list 现在是 skill-tree-progress-item 的兄弟元素
                const chapterList = skillTreeItem.parentElement.querySelector('.chapter-progress-list');
                const expandIcon = skillTreeItem.querySelector('.expand-icon');
                
                if (chapterList && expandIcon) {
                    if (skillTreeItem.classList.contains('expanded')) {
                        chapterList.style.display = 'block';
                        expandIcon.style.transform = 'rotate(180deg)';
                    } else {
                        chapterList.style.display = 'none';
                        expandIcon.style.transform = 'rotate(0deg)';
                    }
                }
            });
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
                        <span class="stat-value">${Number(user.achievements?.totalPoints) || 0}</span>
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
                    <div>
                        <div class="detail-item skill-tree-progress-item" style="cursor: pointer;">
                            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <div style="display: flex; align-items: center; flex: 1;">
                                    <span class="detail-icon">📊</span>
                                    <span class="detail-label">技能树总进度</span>
                                    <span class="detail-value" style="margin-left: auto; margin-right: 8px;">${user.skillTree.totalProgress}%</span>
                                </div>
                                <span class="expand-icon" style="font-size: 12px; color: #999; transition: transform 0.2s;">▼</span>
                            </div>
                        </div>
                        <div class="chapter-progress-list" style="display: none; margin-top: 8px; padding: 12px; background: #f8f9fa; border-radius: 6px; margin-left: 0;">
                            ${(user.skillTree.chapterOrder || Object.keys(user.skillTree.chapterProgress || {})).map(key => {
                                const progress = user.skillTree.chapterProgress[key];
                                if (progress === undefined) return '';
                                const displayName = user.skillTree.chapterDisplayNames[key] || key;
                                const progressPercent = Math.round((progress || 0) * 100);
                                return `
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px;">
                                        <span style="color: #666;">${displayName}</span>
                                        <span style="color: #1890ff; font-weight: 600;">${progressPercent}%</span>
                                    </div>
                                `;
                            }).filter(html => html).join('')}
                        </div>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">⚔️</span>
                        <span class="detail-label">1v1对战分数</span>
                        <span class="detail-value" style="color: ${helpers.getRatingColor(user.battle1v1Score)}; font-weight: 600;">${user.battle1v1Score}</span>
                    </div>
                </div>
            </div>
        `;
    }
}
