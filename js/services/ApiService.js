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
            if (data.code === 0 && data.data && data.data.ranks && data.data.ranks.length > 0) {
                return data.data.ranks[0]; // Returns { uid, name, headUrl, count, place }
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
                'all': 0, 'weekly': 19, 'monthly': 9, 'practice': 6, 'challenge': 2, 'xcpc': 22,
                '100': 100, '101': 101, '102': 102, '103': 103  // 校园招聘类型
            };

            let apiContestType = contestTypeMap[contestType];
            
            // 如果contestType是数字字符串，直接使用
            if (apiContestType === undefined && !isNaN(parseInt(contestType))) {
                apiContestType = parseInt(contestType);
            }

            if (apiContestType === undefined) {
                throw new Error(`暂不支持此比赛类型: ${contestType}`);
            }

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
     * @param {number} page - 页码
     * @param {number} limit - 每页数量
     * @returns {Promise<object>} 排行榜数据
     */
    async fetchRankingsPage(page = 1, limit = 20) {
        return this.fetchRankings(page, limit);
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
}

