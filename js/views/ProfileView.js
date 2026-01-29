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

    // 从 hash 路由解析 profile 目标 userId（支持 #/profile?userId=123 或 #/profile/123）
    getTargetUserIdFromHash() {
        try {
            const full = String(window.location.hash || '').replace(/^#\/?/, '');
            const s = full.replace(/^\/?/, '');
            if (!s.toLowerCase().startsWith('profile')) return null;
            // profile/search 是搜索页，不应当被识别为 userId
            if (s.toLowerCase().startsWith('profile/search')) return null;
            // query: profile?userId=...
            const q = s.split('?')[1] || '';
            if (q) {
                const sp = new URLSearchParams(q);
                const uid = sp.get('userId') || sp.get('uid');
                if (uid && String(uid).trim()) return String(uid).trim();
            }
            // path: profile/123
            const m = s.match(/^profile\/(\d+)/i);
            if (m && m[1]) return String(m[1]);
        } catch (_) {}
        return null;
    }

    // 解析 profile/search?query=xxx
    getSearchQueryFromHash() {
        try {
            const full = String(window.location.hash || '').replace(/^#\/?/, '');
            const s = full.replace(/^\/?/, '');
            if (!s.toLowerCase().startsWith('profile/search')) return null;
            const q = s.split('?')[1] || '';
            const sp = new URLSearchParams(q);
            const query = (sp.get('query') || sp.get('q') || '').trim();
            return query || '';
        } catch (_) {
            return null;
        }
    }

    async render() {
        if (!this.container) {
            return;
        }

        const searchQuery = this.getSearchQueryFromHash();
        if (searchQuery != null) {
            await this.renderSearchPage(searchQuery);
            return;
        }

        const targetUidFromHash = this.getTargetUserIdFromHash();
        const viewingOther = !!(targetUidFromHash && String(targetUidFromHash) !== String(this.appState.loggedInUserId || ''));

        // 未登录且也没有指定 userId：仍提示登录（或给出可分享链接提示）
        if (!this.appState.isLoggedIn() && !targetUidFromHash) {
            this.container.innerHTML = this.getLoggedOutHtml();
            return;
        }

        this.container.innerHTML = `<div class="loader"></div>`;
        try {
            const userId = targetUidFromHash || this.appState.loggedInUserId;

            // 使用整合接口获取所有信息（看他人用 user-info；看自己用 my-info）
            const myInfo = targetUidFromHash
                ? await this.apiService.fetchUserInfo(userId)
                : await this.apiService.fetchMyInfo();
            
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
            const follow = myInfo.follow || {};
            
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
                'interlude_3_5': '间章：惊鸿',
                'boss_dream': '梦',
                'chapter4': '第四章：韬光逐影'
            };
            
            // 章节顺序（按照技能树页面的顺序）
            const chapterOrder = ['chapter1', 'interlude_dawn', 'chapter2', 'interlude_2_5', 'chapter3', 'interlude_3_5', 'boss_dream', 'chapter4'];

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
            // userInfo（排行榜）字段优先用于补齐 name/headUrl/rank/count
            const mergedName = (userInfo && (userInfo.name || userInfo.nickname)) || user.name || '';
            const mergedHead = (userInfo && userInfo.headUrl) || user.headUrl || '';
            const mergedPassed = (userInfo && (userInfo.count ?? userInfo.acceptCount)) ?? user.count ?? 0;
            const mergedRank = (userInfo && (userInfo.place ?? userInfo.rank)) ?? user.place ?? 0;
            const userData = {
                uid: user.uid || userId,
                name: mergedName || '',
                headUrl: mergedHead || '',
                problemPassed: Number(mergedPassed) || 0,
                rank: Number(mergedRank) === 0 ? '1w+' : (Number(mergedRank) || '1w+'),
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
                battle1v1Score: myInfo.battle1v1Score || 1000,
                battle1v1WinCount: Number(myInfo.battle1v1WinCount ?? 0) || 0,
                battle1v1TotalCount: Number(myInfo.battle1v1TotalCount ?? 0) || 0,
                battleAiWinCount: Number(myInfo.battleAiWinCount ?? 0) || 0,
                battleAiTotalCount: Number(myInfo.battleAiTotalCount ?? 0) || 0,
                follow,
                __viewingOther: viewingOther
            };
            
            this.container.innerHTML = this.getUserProfileHtml(userData);
            
            // 绑定展开/收起事件
            this.bindSkillTreeExpandEvents();
            // 绑定关注/取关按钮
            this.bindFollowButton(userData);
            // 绑定搜索框（浮动）
            this.bindProfileSearch();

        } catch (error) {
            console.error("Failed to render profile view:", error);
            this.container.innerHTML = `<div class="error-message">无法加载您的个人信息，请稍后重试。(${error.message})</div>`;
        }
    }

    async renderSearchPage(query) {
        const q = String(query || '').trim();
        this.container.innerHTML = this.getSearchPageHtml(q, { loading: true, users: [], error: '' });
        this.bindProfileSearch();
        if (!q) return;

        try {
            const { records = [] } = await this.apiService.spartaSearchUser(q, 1, 15);
            const users = (Array.isArray(records) ? records : [])
                .filter(r => r && (r.userId != null))
                .map(r => ({
                    userId: String(r.userId),
                    nickname: String(r.nickname || '').trim(),
                    avatar: String(r.headImgUrl || '').trim()
                }));
            this.container.innerHTML = this.getSearchPageHtml(q, { loading: false, users, error: '' });
            this.bindProfileSearch();
        } catch (e) {
            this.container.innerHTML = this.getSearchPageHtml(q, { loading: false, users: [], error: (e && e.message) ? e.message : '搜索失败' });
            this.bindProfileSearch();
        }
    }

    bindProfileSearch() {
        const box = this.container.querySelector('#profile-search-box');
        const input = this.container.querySelector('#profile-search-input');
        const btn = this.container.querySelector('#profile-search-btn');
        if (!box || !input || !btn) return;
        if (btn._bound) return;
        btn._bound = true;

        // 若当前在搜索页，把 query 回填到输入框
        const currentQ = this.getSearchQueryFromHash();
        if (currentQ != null && !input.value) input.value = currentQ;

        const doSearch = () => {
            const q = String(input.value || '').trim();
            if (!q) return;
            window.location.hash = `#/profile/search?query=${encodeURIComponent(q)}`;
        };

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            doSearch();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doSearch();
            }
        });
    }

    bindFollowButton(userData) {
        const btn = this.container.querySelector('#profile-follow-btn');
        if (!btn || btn._bound) return;
        btn._bound = true;

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (btn.disabled) return;

            const followType = Number(btn.dataset.followType);
            const targetUid = Number(btn.dataset.targetUid || userData.uid);
            if (!targetUid || targetUid <= 0) return;

            const shouldFollow = (followType === 0 || followType === 2);
            const shouldUnfollow = (followType === 1 || followType === 3);
            if (!shouldFollow && !shouldUnfollow) return;

            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = '处理中...';

            try {
                if (shouldFollow) {
                    await this.apiService.snsFollow(targetUid);
                } else {
                    await this.apiService.snsUnfollow(targetUid);
                }
                // 不猜测新 followType，直接刷新名片（走 user-info，拿到最新四态）
                await this.render();
            } catch (err) {
                btn.textContent = oldText;
                btn.disabled = false;
                alert(err?.message || '操作失败');
            }
        });
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
        const profileUrl = helpers.buildUrlWithChannelPut(`https://www.nowcoder.com/users/${user.uid}`, this.appState?.channelPut);

        const follow = user.follow || {};
        const followType = Number(follow.followType);
        const showFollow = user.__viewingOther === true;
        const followTextMap = {
            0: '关注',
            1: '已关注',
            2: '回关',
            3: '已互粉'
        };
        const followText = followTextMap.hasOwnProperty(followType) ? followTextMap[followType] : '关注';
        const followDisabled = !(followType === 0 || followType === 1 || followType === 2 || followType === 3);
        // 悬停不展示说明（不使用 title）
        const followTone = (followType === 0 || followType === 2) ? 'pink' : 'gray';
        return `
            <div class="profile-card">
                <div class="profile-header">
                    <img src="${avatarUrl}" alt="${user.name}的头像" class="profile-avatar">
                    <div class="profile-name-row">
                        <h2 class="profile-name">
                            <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="profile-name-link" title="打开牛客个人主页">
                                ${user.name}
                            </a>
                        </h2>
                        ${showFollow ? `
                            <button
                                id="profile-follow-btn"
                                class="profile-follow-btn ${followTone === 'pink' ? 'is-pink' : 'is-gray'}"
                                data-follow-type="${Number.isFinite(followType) ? followType : ''}"
                                data-viewer-uid="${follow.viewerUserId ?? ''}"
                                data-target-uid="${follow.targetUserId ?? user.uid}"
                                ${followDisabled ? 'disabled' : ''}
                            >${followText}</button>
                        ` : ''}
                    </div>
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
                    <div class="detail-item">
                        <span class="detail-icon">🎮</span>
                        <div class="battle-mini">
                            <div class="battle-mini-head">
                                <span class="battle-mini-title">1v1对战统计</span>
                            </div>
                            <div class="battle-mini-stats">
                                <div class="battle-mini-stat">
                                    <span class="battle-mini-k">总场数</span>
                                    <span class="battle-mini-v">${Number(user.battle1v1TotalCount) || 0}</span>
                                </div>
                                <div class="battle-mini-stat">
                                    <span class="battle-mini-k">胜场数</span>
                                    <span class="battle-mini-v">${Number(user.battle1v1WinCount) || 0}</span>
                                </div>
                            </div>
                            <div class="battle-mini-actions">
                                <a class="battle-mini-link" href="#/battle/record?userId=${encodeURIComponent(String(user.uid))}">查看战绩</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="profile-search-box" class="profile-search-box profile-search-floating">
                <input id="profile-search-input" class="profile-search-input" placeholder="搜索用户：ID / 名字" />
                <button id="profile-search-btn" class="profile-search-btn">搜索</button>
            </div>
        `;
    }

    getSearchPageHtml(query, { loading, users, error }) {
        const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const q = String(query || '').trim();
        const list = Array.isArray(users) ? users : [];
        const emptyText = loading ? '搜索中...' : (error ? `搜索失败：${error}` : '未找到用户');

        const items = list.map(u => {
            const uid = String(u.userId || '').trim();
            const name = String(u.nickname || '').trim() || (uid ? `用户${uid}` : '用户');
            const avatar = String(u.avatar || '').trim();
            return `
                <div class="profile-search-card">
                    <a class="profile-search-avatar-link" href="#/profile?userId=${encodeURIComponent(uid)}" aria-label="打开名片">
                        ${avatar ? `<img class="profile-search-avatar-lg" src="${escapeHtml(avatar)}" onerror="this.style.display='none'" />` : `<div class="profile-search-avatar-lg ph"></div>`}
                    </a>
                    <div class="profile-search-row-meta">
                        <a class="profile-search-name-link" href="#/profile?userId=${encodeURIComponent(uid)}">${escapeHtml(name)}</a>
                        <div class="profile-search-row-uid">UID: ${escapeHtml(uid)}</div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="profile-search-page">
                <div class="profile-search-page-title">搜索结果：<b>${escapeHtml(q || '（空）')}</b></div>
                <div class="profile-search-page-card">
                    ${list.length ? `<div class="profile-search-grid">${items}</div>` : `<div class="profile-search-page-empty">${escapeHtml(emptyText)}</div>`}
                </div>
            </div>
            <div id="profile-search-box" class="profile-search-box profile-search-floating">
                <input id="profile-search-input" class="profile-search-input" placeholder="搜索用户：ID / 名字" value="${escapeHtml(q)}" />
                <button id="profile-search-btn" class="profile-search-btn">搜索</button>
            </div>
        `;
    }
}
