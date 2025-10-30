// API服务层
import { APP_CONFIG } from '../config.js';

/**
 * API服务类 - 统一管理所有API调用
 */
export class ApiService {
    constructor(apiBase = APP_CONFIG.API_BASE) {
        this.apiBase = apiBase;
    }

    /**
     * 获取用户排名数据
     * @param {string} userId - 用户ID
     * @returns {Promise<object>} 用户数据
     */
    async fetchUserData(userId) {
        if (!userId) return null;
        try {
            const response = await fetch(`${this.apiBase}/problem/tracker/ranks/problem?userId=${userId}`);
            if (!response.ok) throw new Error('User rank fetch failed');
            const data = await response.json();
            // 统一返回 data.data（包含 ranks 数组与 totalCount），以匹配 RankingsView 的使用
            if (data && data.code === 0 && data.data) {
                return data.data; // { ranks: [...], totalCount: number }
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch user data:', error);
            return null;
        }
    }

    async fetchRankings(rankType, page, userId = null, limit = 20) {
        let url;
        if (userId) {
            // If a specific user is requested, build a URL without pagination params.
            url = `${this.apiBase}/problem/tracker/ranks/${rankType}?userId=${userId}`;
        } else {
            // For general leaderboard, build a URL with pagination params.
            url = `${this.apiBase}/problem/tracker/ranks/${rankType}?page=${page}&limit=${limit}`;
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.code !== 0) {
                throw new Error(data.msg || 'Failed to fetch rankings');
            }
            return data.data;
        } catch (error) {
            console.error(`Error fetching ${rankType} rankings:`, error);
            throw error;
        }
    }

    /**
     * 获取比赛列表
     * @param {string} contestType - 比赛类型字符串
     * @param {number} page - 页码
     * @param {number} limit - 每页数量
     * @returns {Promise<object>} 比赛数据
     */
    async fetchContests(contestType, page = 1, limit = 30) {
        try {
            // 比赛类型映射
            const contestTypeMap = {
                'all': 0,
                '19': 19,
                '9': 9,
                '6': 6,
                '2': 2,
                '20': 20, // 多校
                '21': 21, // 寒假营
                '22': 22, // XCPC
                '100': 100, '101': 101, '102': 102, '103': 103
            };

            let apiContestType = contestTypeMap[String(contestType)];
            
            // 如果contestType是数字字符串，直接使用
            if (apiContestType === undefined && !isNaN(parseInt(contestType))) {
                apiContestType = parseInt(contestType);
            }

            // 保底：仍找不到时，直接透传（以便后端做兼容路由）
            if (apiContestType === undefined) apiContestType = contestType;

            const url = `${this.apiBase}/problem/tracker/list?contestType=${apiContestType}&page=${page}&limit=${limit}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
            const data = await response.json();
            if (data.code !== 0) throw new Error(`API error: ${data.msg}`);
            
            return {
                contests: data.data.papers || [],
                totalCount: data.data.totalCount || 0
            };
        } catch (error) {
            console.error('Failed to fetch contest data:', error);
            throw error;
        }
    }

    /**
     * 获取用户题目状态差异
     * @param {string} userId1 - 用户1 ID
     * @param {string} qids - 题目ID列表（逗号分隔）
     * @param {string} userId2 - 用户2 ID（可选）
     * @returns {Promise<object>} 差异数据
     */
    async fetchUserProblemDiff(user1Id, qids, user2Id = null) {
        if (!user1Id || !qids) return null;
        
        const url = `${this.apiBase}/problem/tracker/diff`;
        
        // Manually construct the body to prevent URL-encoding of commas within qids
        let body = `userId1=${encodeURIComponent(user1Id)}&qids=${qids}`;
        if (user2Id) {
            body += `&userId2=${encodeURIComponent(user2Id)}`;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                },
                body: body,
            });

            if (!response.ok) throw new Error('Failed to fetch user problem diff');
            const result = await response.json();
            if (result.code !== 0) throw new Error(`API Error: ${result.msg}`);
            
            return result.data;
        } catch (error) {
            console.error('Error in fetchUserProblemDiff:', error);
            throw error; // Rethrow the error to be caught by the caller
        }
    }

    /**
     * 获取每日一题信息
     * @returns {Promise<object>} 每日一题数据
     */
    async fetchDailyTodayInfo() {
        try {
            const response = await fetch(`${this.apiBase}/problem/tracker/clock/todayinfo`);
            if (!response.ok) throw new Error(`服务器错误: ${response.statusText}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Failed to fetch daily problem:', error);
            throw error;
        }
    }

    /**
     * 打卡
     * @param {number} questionId - 题目ID
     * @returns {Promise<object>} 打卡结果
     */
    async checkInDailyProblem(questionId) {
        try {
            const response = await fetch(`${this.apiBase}/problem/tracker/clock/add`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                },
                body: `questionId=${questionId}`
            });
            if (!response.ok) throw new Error('网络错误');
            const result = await response.json();
            if (result.code !== 0) throw new Error(result.msg || '打卡失败');
            return result;
        } catch (error) {
            console.error('Check-in failed:', error);
            throw error;
        }
    }

    /**
     * 获取指定月份的每日一题信息
     * @param {number} year - 年份
     * @param {number} month - 月份
     * @returns {Promise<Array>} 月度题目数据数组
     */
    async fetchMonthInfo(year, month) {
        try {
            const response = await fetch(`${this.apiBase}/problem/tracker/clock/monthinfo?year=${year}&month=${month}`);
            if (!response.ok) throw new Error('Failed to fetch month info');
            const data = await response.json();
            if (data.code === 0 && Array.isArray(data.data)) {
                return data.data; // e.g., [{questionId, questionTitle, date, ...}, ...]
            }
            return [];
        } catch (error) {
            console.error("Error fetching month info:", error);
            return [];
        }
    }

    /**
     * 获取打卡日历数据
     * @param {number} year - 年份
     * @param {number} month - 月份
     * @returns {Promise<Set>} 打卡日期集合
     */
    async fetchCheckInList(year, month) {
        try {
            const response = await fetch(`${this.apiBase}/problem/tracker/clock/list?year=${year}&month=${month}`);
            if (!response.ok) throw new Error('Failed to fetch calendar data');
            const data = await response.json();
            if (data.code === 0 && Array.isArray(data.data)) {
                return new Set(data.data); // e.g., ["2025-09-01", "2025-09-15"]
            }
            return new Set();
        } catch (error) {
            console.error("Error fetching check-in data:", error);
            return new Set();
        }
    }

    /**
     * 获取打卡统计信息（快速方法，使用todayinfo接口）
     * @returns {Promise<object|null>} 统计数据或null
     */
    async fetchCheckInStats() {
        try {
            const res = await fetch(`${this.apiBase}/problem/tracker/clock/todayinfo`);
            if (!res.ok) throw new Error('todayinfo request failed');
            const data = await res.json();
            
            if (data && data.code === 0 && data.data) {
                const continueDay = Number(data.data.continueDay) || 0;
                const countDay = Number(data.data.countDay) || 0;
                
                if (continueDay !== undefined && countDay !== undefined) {
                    return {
                        consecutiveDays: continueDay,
                        totalDays: countDay
                    };
                }
            }
            return null;
        } catch (err) {
            console.warn('fetchCheckInStats failed:', err);
            return null;
        }
    }

    /**
     * 获取练习题目数据（静态JSON）
     * @returns {Promise<object>} 练习题目数据
     */
    async fetchPracticeData(tabName) {
        try {
            const res = await fetch(`https://static.nowcoder.com/book/tracker/parsed_practice_problems.json?v=${new Date().getTime()}`);
            if (!res.ok) throw new Error('Failed to load practice JSON');
            return await res.json();
        } catch (error) {
            console.error('Failed to fetch practice problems:', error);
            throw error;
        }
    }

    /**
     * 获取排行榜页面数据（别名方法）
     * @param {string} rankType - 排行榜类型
     * @param {number} page - 页码
     * @param {number} limit - 每页数量
     * @returns {Promise<object>} 排行榜数据
     */
    async fetchRankingsPage(rankType, page = 1, limit = 20) {
        return this.fetchRankings(rankType, page, null, limit);
    }

    /**
     * 获取打卡排行榜数据
     * @param {number} page - 页码
     * @param {number} limit - 每页数量
     * @returns {Promise<object>} 打卡排行榜数据
     */
    async fetchCheckinRankings(page = 1, limit = 20, userId = null) {
        try {
            let url = `${this.apiBase}/problem/tracker/ranks/checkin?page=${page}&limit=${limit}`;
            if (userId) {
                url = `${this.apiBase}/problem/tracker/ranks/checkin?userId=${userId}`;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            if (data.code === 0 && data.data) {
                return data.data;
            } else {
                throw new Error(data.msg || '未知错误');
            }
        } catch (error) {
            console.error('Error fetching checkin rankings:', error);
            throw error;
        }
    }

    /**
     * 为指定用户补卡
     * @param {string} userId - 用户ID
     * @returns {Promise<object>} 操作结果
     */
    async addCheckin(userId) {
        if (!userId) {
            throw new Error('User ID is required for addCheckin');
        }
        try {
            const url = `${this.apiBase}/problem/tracker/addcheckin?userId=${userId}`;
            const response = await fetch(url, { method: 'POST' }); // 假设是 POST 请求
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error in addCheckin:', error);
            throw error;
        }
    }

    /**
     * 获取校园招聘数据
     * @param {number} contestType - 比赛类型
     * @param {number} page - 页码
     * @param {number} limit - 每页数量
     * @returns {Promise<object>} 校园招聘数据
     */
    async fetchCampusData(contestType, page = 1, limit = 20) {
        return this.fetchContests(contestType, page, limit);
    }

    /**
     * 获取面试数据（静态JSON）
     * @returns {Promise<object>} 面试数据
     */
    async fetchInterviewData() {
        try {
            const res = await fetch(`https://static.nowcoder.com/book/tracker/parsed_practice_problems.json?v=${new Date().getTime()}`);
            if (!res.ok) throw new Error('Failed to load interview JSON');
            return await res.json();
        } catch (error) {
            console.error('Failed to fetch interview data:', error);
            throw error;
        }
    }

    async fetchUserCheckinData(userId) {
        if (!userId) return null;
        
        // This endpoint seems to be different from the base API, so we use the full URL.
        // Note: This might cause CORS issues in development if not proxied.
        // Assuming the proxy is configured to handle this path.
        const url = `${this.apiBase}/problem/tracker/ranks/checkin?userId=${userId}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch user check-in data');
            const result = await response.json();
            if (result.code !== 0) throw new Error(`API Error: ${result.msg}`);

            // The API returns a list, we need the first user that matches.
            const userData = result.data?.ranks?.find(rank => String(rank.uid) === String(userId));
            return userData || { count: 0, continueDays: 0 }; // Return default if user not found in ranks
        } catch (error) {
            console.error('Error in fetchUserCheckinData:', error);
            // Return a default object on error to prevent card generation failure
            return { count: 0, continueDays: 0 };
        }
    }

    /**
     * 管理员：设置某日分享链接（占位，等待后端POST地址）
     * 暂时仅做入参校验与日志打印，实际调用待接入后端
     */
    async setDailyShareLink(dateStr, shareLinkRaw) {
        if (!dateStr || !shareLinkRaw) {
            throw new Error('参数缺失：需要日期与分享链接');
        }

        // 若传入的是整段 iframe，提取 src；否则原样使用
        const extractSrc = (html) => {
            const text = String(html);
            const m1 = text.match(/src\s*=\s*"([^"]+)"/i);
            const m2 = text.match(/src\s*=\s*'([^']+)'/i);
            return (m1 && m1[1]) || (m2 && m2[1]) || text.trim();
        };
        const shareLink = extractSrc(shareLinkRaw);

        const qs = `date=${encodeURIComponent(dateStr)}&shareLink=${encodeURIComponent(shareLink)}`;
        const url = `${this.apiBase}/problem/tracker/clock/add-share-link?${qs}`;

        const res = await fetch(url, {
            method: 'POST',
            // 空 body 即可，参数在 querystring
            headers: {
                'Accept': 'application/json, text/plain, */*'
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (data && typeof data.code !== 'undefined' && data.code !== 0) {
            throw new Error(data.msg || '服务端返回错误');
        }
        return data || { code: 0 };
    }

    /**
     * 获取指定日期的视频嵌入代码（或其 src）
     * @param {string} dateStr - 形如 YYYY-MM-DD
     * @returns {Promise<{src:string, raw?:string}>}
     */
    async fetchDailyDayLink(dateStr) {
        if (!dateStr) return { src: '' };
        const url = `${this.apiBase}/problem/tracker/clock/daylink?date=${encodeURIComponent(dateStr)}`;
        const extractSrc = (htmlOrUrl) => {
            if (!htmlOrUrl) return '';
            const text = String(htmlOrUrl);
            // 若是完整 iframe，提取 src；否则若看起来像 URL，则直接返回
            const m1 = text.match(/src\s*=\s*"([^"]+)"/i);
            const m2 = text.match(/src\s*=\s*'([^']+)'/i);
            const fromAttr = (m1 && m1[1]) || (m2 && m2[1]);
            if (fromAttr) return fromAttr.trim();
            // 简单 URL 识别（以 http(s):// 或 // 开头）
            if (/^(https?:)?\/\//i.test(text)) return text.trim();
            return '';
        };
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            // 兼容两种返回体：JSON 或 纯文本
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const body = await res.json();
                const d = body && (body.data ?? body);
                let raw = '';
                if (typeof d === 'string') raw = d;
                else if (d && typeof d === 'object') raw = d.shareLink || d.link || d.url || d.html || '';
                const src = extractSrc(raw);
                return { src, raw };
            } else {
                const raw = await res.text();
                const src = extractSrc(raw);
                return { src, raw };
            }
        } catch (e) {
            console.warn('fetchDailyDayLink failed:', e);
            return { src: '' };
        }
    }

    /**
     * Fetches detailed information for a specific skill tree tag (node).
     * @param {string} tagId - The ID of the skill tree tag.
     * @returns {Promise<Object>} - A promise that resolves to the tag's detailed info.
     */
    async fetchTagInfo(tagId) {
        const url = `${this.apiBase}/problem/tracker/skill-tree/tagInfo?tagId=${tagId}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            // 后端新格式：code=200，data={ tag: {...}, questions: [...] }
            if ((data.code === 200 || data.code === 0) && data.data) {
                const d = data.data;

                // 如果是新结构，标准化为旧结构，便于前端其余代码复用
                if (d.tag && Array.isArray(d.questions)) {
                    const normalizeDeps = (raw) => {
                        if (!raw) return [];
                        if (Array.isArray(raw)) return raw.map(String);
                        return String(raw).split(',').map(s => s.trim()).filter(Boolean);
                    };

                    const problems = d.questions.map(q => ({
                        qid: q.questionId != null ? String(q.questionId) : undefined,
                        problemId: q.problemId != null ? String(q.problemId) : undefined,
                        uuid: q.uuid || '',
                        name: q.title || q.name || '',
                        score: Number(q.score) || 0,
                        dependencies: normalizeDeps(q.dependencies),
                        yilai: normalizeDeps(q.dependencies),
                    }));

                    return {
                        tagId: d.tag.tagId,
                        tagName: d.tag.tagName,
                        tagDesc: d.tag.tagDesc,
                        tagTutorials: d.tag.tagTutorials || '[]',
                        problems,
                    };
                }

                // 旧结构保持不变返回
                return d;
            }
            throw new Error((data && data.msg) || `Failed to fetch info for tag ${tagId}`);
        } catch (error) {
            console.error(`Error fetching tag info for tagId ${tagId}:`, error);
            throw error;
        }
    }

    /**
     * 批量获取用户在多个知识点上的进度
     * @param {string} userId - 用户ID
     * @param {Array<string|number>} tagIds - 知识点ID数组
     * @returns {Promise<object>} 进度数据
     */
    async fetchSkillTreeProgress(userId, tagIds) {
        // 保留兼容，但优先推荐使用 fetchSingleTagProgress
        if (!userId || !tagIds || tagIds.length === 0) {
            return { nodeProgress: {} };
        }
        const tagsParam = tagIds.join(',');
        const url = `${this.apiBase}/problem/tracker/skill-tree/progress?userId=${userId}&tags=${tagsParam}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if ((data.code === 0 || data.code === 200) && data.data) {
                if (data.data.nodeProgress) return data.data;
                // 容错：若返回单个进度
                if (typeof data.data.progress === 'number' && tagIds.length === 1) {
                    return { nodeProgress: { [tagIds[0]]: data.data.progress } };
                }
            }
            throw new Error(data.msg || 'Failed to fetch skill tree progress');
        } catch (error) {
            console.error(`Error fetching progress for tags ${tagsParam}:`, error);
            throw error;
        }
    }

    /**
     * 获取单个知识点的进度
     */
    async fetchSingleTagProgress(userId, tagId) {
        if (!userId || !tagId) return { progress: 0 };
        // 接口要求使用 tags（逗号分隔），即便只有一个
        const url = `${this.apiBase}/problem/tracker/skill-tree/progress?userId=${encodeURIComponent(userId)}&tags=${encodeURIComponent(String(tagId))}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if ((data.code === 0 || data.code === 200) && data.data) {
                if (typeof data.data.progress === 'number') return { progress: data.data.progress };
                if (data.data.nodeProgress && data.data.nodeProgress[tagId] != null) return { progress: data.data.nodeProgress[tagId] };
            }
            return { progress: 0 };
        } catch (e) {
            console.error('fetchSingleTagProgress failed:', e);
            return { progress: 0 };
        }
    }

    /**
     * 同步单个知识点进度（POST）
     * 接口约定：/problem/tracker/skill-tree/update?userId=xxx&tagId=yyy
     * 有的实现参数名可能为 tafId，做兼容同时传两者
     */
    async syncSingleTag(userId, tagId) {
        if (!userId || !tagId) throw new Error('userId and tagId are required');
        const qs = `userId=${encodeURIComponent(userId)}&tagId=${encodeURIComponent(tagId)}`;
        const url = `${this.apiBase}/problem/tracker/skill-tree/update?${qs}`;
        try {
            const res = await fetch(url, { method: 'POST' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json().catch(() => ({}));
            return data;
        } catch (e) {
            console.error('syncSingleTag failed:', e);
            throw e;
        }
    }

    /**
     * 触发后端同步技能树进度
     * @param {string} userId - 用户ID
     */
    async syncSkillTreeProgress(userId) {
        if (!userId) throw new Error('userId is required');
        const url = `${this.apiBase}/problem/tracker/skill-tree/update?userId=${encodeURIComponent(userId)}`;
        try {
            const res = await fetch(url, { method: 'POST' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json().catch(() => ({}));
            return data;
        } catch (e) {
            console.error('syncSkillTreeProgress failed:', e);
            throw e;
        }
    }

    /**
     * 获取成就徽章列表
     * 后端约定：/problem/tracker/badge/list?types=1,2,3
     * 渲染约定：打卡用 1/2/3，过题用 4/5，技能树用 6
     * @param {string|number|Array<string|number>} types - 枚举类型或其数组
     * @returns {Promise<Array>} 徽章列表（由后端定义结构）
     */
    async fetchBadgeList(types) {
        try {
            const typesParam = Array.isArray(types)
                ? types.map(t => String(t).trim()).filter(Boolean).join(',')
                : String(types).trim();

            // 后端参数名为 typeList；为兼容历史实现，优先使用 typeList
            const url = `${this.apiBase}/problem/tracker/badge/list?typeList=${encodeURIComponent(typesParam)}&_=${Date.now()}`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            // 兼容常见返回格式 { code, data }
            if (data && (data.code === 0 || data.code === 200)) {
                const d = data.data;
                if (Array.isArray(d)) return d;
                if (d && typeof d === 'object') return Object.values(d);
                if (Array.isArray(data)) return data;
                return [];
            }
            // 非标准结构则直接返回原始体，交由调用方兜底
            if (Array.isArray(data)) return data;
            if (data && typeof data === 'object' && data.data && typeof data.data === 'object') {
                const dd = data.data;
                return Array.isArray(dd) ? dd : Object.values(dd);
            }
            return [];
        } catch (e) {
            console.error('fetchBadgeList failed:', e);
            return [];
        }
    }

    /**
     * 获取用户成就总分与最近获得的成就（最多5条）
     */
    async fetchBadgeUserInfo() {
        try {
            // 后端要求该接口路径后不带任何查询参数
            const url = `${this.apiBase}/problem/tracker/badge/userInfo`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = await res.json();
            const d = body && body.data ? body.data : body;
            // total score may be nested in userTotalScore.totalScore
            const nestedTotal = d && d.userTotalScore && (d.userTotalScore.totalScore ?? d.userTotalScore.points);
            const totalPoints = (nestedTotal != null
                ? nestedTotal
                : (d && (d.totalPoints ?? d.totalScore ?? d.points ?? 0))) || 0;
            let recent = [];
            const formatTime = (t) => {
                const ts = Number(t);
                if (!ts) return '';
                const dt = new Date(ts);
                const mm = String(dt.getMonth() + 1).padStart(2, '0');
                const dd = String(dt.getDate()).padStart(2, '0');
                const hh = String(dt.getHours()).padStart(2, '0');
                const mi = String(dt.getMinutes()).padStart(2, '0');
                return `${mm}-${dd} ${hh}:${mi}`;
            };
            if (Array.isArray(d?.recent)) recent = d.recent;
            else if (Array.isArray(d?.recentBadges)) recent = d.recentBadges;
            else if (d?.list && Array.isArray(d.list)) recent = d.list;
            else if (d?.userRecentBadge && typeof d.userRecentBadge === 'object') {
                recent = Object.values(d.userRecentBadge || {}).map(b => ({
                    ...b,
                    time: formatTime(b.createTime)
                }))
                // sort by createTime desc if provided
                .sort((a, b) => Number(b.createTime || 0) - Number(a.createTime || 0));
            }
            return { totalPoints: Number(totalPoints) || 0, recent };
        } catch (e) {
            console.warn('fetchBadgeUserInfo failed:', e);
            return { totalPoints: 0, recent: [] };
        }
    }
}

