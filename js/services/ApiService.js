// API服务层
import { APP_CONFIG } from '../config.js';

/**
 * API服务类 - 统一管理所有API调用
 */
export class ApiService {
    constructor(apiBase = APP_CONFIG.API_BASE) {
        this.apiBase = apiBase;
    }

    // 团队题单排行榜（一次返回累计/7日/今日）
    async teamTopicLeaderboard(teamId, topicId, page = 1, limit = 20) {
        const p = Math.max(1, Number(page) || 1);
        const tid = Number(topicId) || 383;
        const url = `${this.apiBase}/problem/tracker/team/leaderboard/topic?teamId=${encodeURIComponent(teamId)}&topicId=${encodeURIComponent(tid)}&page=${encodeURIComponent(p)}&limit=${encodeURIComponent(limit)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            const d = data.data || {};
            const list = Array.isArray(d.list) ? d.list : (Array.isArray(d) ? d : []);
            const total = (typeof d.total === 'number') ? d.total : list.length;
            // 可选的总题数（后端新增字段，兼容不同命名）
            const problemTotal = (typeof d.problemTotal === 'number')
                ? d.problemTotal
                : ((typeof d.totalProblemCount === 'number') ? d.totalProblemCount : 0);
            return { list, total, problemTotal };
        }
        return { list: [], total: 0, problemTotal: 0 };
    }

    // ===== 团队活动 =====
    async teamActivityClockTotal(teamId, beginTs = 0, endTs = 0) {
        const url = `${this.apiBase}/problem/tracker/team/activity/clock-total?teamId=${encodeURIComponent(teamId)}&beginTs=${encodeURIComponent(beginTs)}&endTs=${encodeURIComponent(endTs)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || {};
        return {};
    }

    async teamActivityClockDaysUsers(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/activity/clock-days-users?teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || {};
        return {};
    }

    async teamActivityTopicFinishedUsers(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/activity/topic-finished-users?teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || {};
        return {};
    }

    async teamActivitySkillFinishedUsers(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/activity/skill-finished-users?teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || {};
        return {};
    }

    async teamActivityTeamsLeaderboard(page = 1, limit = 20, beginTs = 0, endTs = 0) {
        const p = Math.max(1, Number(page) || 1);
        const url = `${this.apiBase}/problem/tracker/team/activity/teams/leaderboard?page=${encodeURIComponent(p)}&limit=${encodeURIComponent(limit)}&beginTs=${encodeURIComponent(beginTs)}&endTs=${encodeURIComponent(endTs)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            const d = data.data || {};
            const list = Array.isArray(d.list) ? d.list : (Array.isArray(d) ? d : []);
            const total = (typeof d.total === 'number') ? d.total : list.length;
            const problemTotal = (typeof d.problemTotal === 'number')
                ? d.problemTotal
                : ((typeof d.totalProblemCount === 'number') ? d.totalProblemCount : 0);
            return { list, total, problemTotal };
        }
        return { list: [], total: 0, problemTotal: 0 };
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

    // ================= TEAM APIs =================
    async teamListMy() {
        const url = `${this.apiBase}/problem/tracker/team/my`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (body && (body.code === 0 || body.code === 200)) return body.data || [];
        return Array.isArray(body) ? body : [];
    }

    async teamCreate(name, description = '') {
        const url = `${this.apiBase}/problem/tracker/team/create`;
        const body = `name=${encodeURIComponent(name)}&description=${encodeURIComponent(description || '')}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || data;
        throw new Error((data && data.msg) || '创建团队失败');
    }

    async teamUpdate(teamId, name, description = '') {
        const url = `${this.apiBase}/problem/tracker/team/update`;
        const body = `teamId=${encodeURIComponent(teamId)}&name=${encodeURIComponent(name)}&description=${encodeURIComponent(description || '')}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '更新团队失败');
    }

    async teamMembers(teamId, limit = 10, page = 1) {
        const p = Math.max(1, Number(page) || 1);
        const l = Math.max(1, Number(limit) || 10);
        const url = `${this.apiBase}/problem/tracker/team/members?teamId=${encodeURIComponent(teamId)}&limit=${encodeURIComponent(l)}&page=${encodeURIComponent(p)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (body && (body.code === 0 || body.code === 200)) return body.data || [];
        return Array.isArray(body) ? body : [];
    }

    async teamAddMember(teamId, userId) {
        const url = `${this.apiBase}/problem/tracker/team/member/add`;
        const body = `teamId=${encodeURIComponent(teamId)}&userId=${encodeURIComponent(userId)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '添加成员失败');
    }

    async teamDeleteMember(teamId, userId) {
        const url = `${this.apiBase}/problem/tracker/team/member/delete`;
        const body = `teamId=${encodeURIComponent(teamId)}&userId=${encodeURIComponent(userId)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '删除成员失败');
    }

    async teamTransferOwner(teamId, userId) {
        const url = `${this.apiBase}/problem/tracker/team/transfer`;
        const body = `teamId=${encodeURIComponent(teamId)}&userId=${encodeURIComponent(userId)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '转移队长失败');
    }

    /**
     * 队长修改成员昵称
     * @param {number|string} teamId - 团队ID
     * @param {number|string} userId - 成员用户ID
     * @param {string} nickName - 昵称
     * @returns {Promise<boolean>}
     */
    async teamUpdateMemberNickname(teamId, userId, nickName) {
        const url = `${this.apiBase}/problem/tracker/team/member/nickname`;
        const body = `teamId=${encodeURIComponent(teamId)}&userId=${encodeURIComponent(userId)}&nickName=${encodeURIComponent(nickName || '')}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body,
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '修改昵称失败');
    }

    /**
     * 用户修改自己的昵称
     * @param {number|string} teamId - 团队ID
     * @param {string} nickName - 昵称
     * @returns {Promise<boolean>}
     */
    async teamUpdateMyNickname(teamId, nickName) {
        const url = `${this.apiBase}/problem/tracker/team/member/my/nickname`;
        const body = `teamId=${encodeURIComponent(teamId)}&nickName=${encodeURIComponent(nickName || '')}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body,
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '修改昵称失败');
    }

    async teamInviteCreate(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/invite/create`;
        const body = `teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            const d = data.data;
            if (typeof d === 'string') return { inviteLink: d };
            return d || data;
        }
        throw new Error((data && data.msg) || '生成邀请失败');
    }

    async teamInviteGet(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/invite?teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            const d = data.data;
            if (typeof d === 'string') return { inviteLink: d };
            return d || {};
        }
        if (typeof data === 'string') return { inviteLink: data };
        return {};
    }

    async teamStatsSummary(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/stats/summary?teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || {};
        return {};
    }

    // 成员自查：我是否在该团队
    async teamMemberCheck(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/member/check?teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || { inTeam: false };
        return { inTeam: false };
    }

    // 队长侧：检查指定 uid 是否在团队中
    async teamMemberCheckByUid(teamId, userId) {
        const url = `${this.apiBase}/problem/tracker/team/member/check/uid?teamId=${encodeURIComponent(teamId)}&userId=${encodeURIComponent(userId)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || { inTeam: false };
        return { inTeam: false };
    }

    async teamLeaderboard(teamId, limit = 20, type = 'total', page = 1) {
        const t = (type == null ? 'total' : String(type)).toLowerCase();
        const p = Math.max(1, Number(page) || 1);
        const url = `${this.apiBase}/problem/tracker/team/leaderboard?teamId=${encodeURIComponent(teamId)}&limit=${encodeURIComponent(limit)}&type=${encodeURIComponent(t)}&page=${encodeURIComponent(p)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            const d = data.data || {};
            const list = Array.isArray(d.list) ? d.list : (Array.isArray(d) ? d : []);
            const total = (typeof d.total === 'number') ? d.total : list.length;
            return { list, total };
        }
        return { list: [], total: 0 };
    }

    // 团队打卡排行榜（scope: total|7days，分页）
    async teamClockLeaderboard(teamId, scope = 'total', page = 1, limit = 20) {
        const p = Math.max(1, Number(page) || 1);
        const sc = (scope == null ? 'total' : String(scope)).toLowerCase();
        const url = `${this.apiBase}/problem/tracker/team/leaderboard/clock?teamId=${encodeURIComponent(teamId)}&scope=${encodeURIComponent(sc)}&page=${encodeURIComponent(p)}&limit=${encodeURIComponent(limit)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            const d = data.data || {};
            const list = Array.isArray(d.list) ? d.list : (Array.isArray(d) ? d : []);
            const total = (typeof d.total === 'number') ? d.total : list.length;
            return { list, total };
        }
        return { list: [], total: 0 };
    }

    // 团队技能树排行榜（scope: total|today, stage: all|INTERLUDE_DAWN|CHAPTER1|CHAPTER2...）
    async teamSkillLeaderboard(teamId, scope = 'total', stage = 'all', page = 1, limit = 20) {
        const s = (scope == null ? 'total' : String(scope)).toLowerCase();
        const st = (stage == null ? 'all' : String(stage));
        const p = Math.max(1, Number(page) || 1);
        const url = `${this.apiBase}/problem/tracker/team/leaderboard/skill?teamId=${encodeURIComponent(teamId)}&scope=${encodeURIComponent(s)}&stage=${encodeURIComponent(st)}&page=${encodeURIComponent(p)}&limit=${encodeURIComponent(limit)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            const d = data.data || {};
            const list = Array.isArray(d.list) ? d.list : (Array.isArray(d) ? d : []);
            const total = (typeof d.total === 'number') ? d.total : list.length;
            // 兼容 problemTotal 返回在 data.problemTotal
            const problemTotal = (typeof d.problemTotal === 'number')
                ? d.problemTotal
                : ((typeof d.totalProblemCount === 'number') ? d.totalProblemCount : 0);
            try {
                // eslint-disable-next-line no-console
                console.debug('[ApiService] teamSkillLeaderboard', { stage: st, keys: Object.keys(d || {}), problemTotal, total, len: list.length });
            } catch (_) {}
            return { list, total, problemTotal };
        }
        return { list: [], total: 0, problemTotal: 0 };
    }

    async teamApply(teamId, message = '') {
        const url = `${this.apiBase}/problem/tracker/team/apply`;
        const body = `teamId=${encodeURIComponent(teamId)}&message=${encodeURIComponent(message)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || data;
        throw new Error((data && data.msg) || '申请加入失败');
    }

    async teamApplyApprove(applyId) {
        const url = `${this.apiBase}/problem/tracker/team/apply/approve`;
        const body = `applyId=${encodeURIComponent(applyId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '同意申请失败');
    }

    async teamApplyReject(applyId) {
        const url = `${this.apiBase}/problem/tracker/team/apply/reject`;
        const body = `applyId=${encodeURIComponent(applyId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '拒绝申请失败');
    }

    // 批量：一键通过全部
    async teamApplyApproveAll(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/apply/approve-all`;
        const body = `teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '一键通过失败');
    }

    // 批量：一键拒绝全部
    async teamApplyRejectAll(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/apply/reject-all`;
        const body = `teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '一键拒绝失败');
    }

    // 管理员：更新某用户的过题数（用于排行榜刷新）
    async adminUpdateUserAcceptCount(userId) {
        if (!userId) throw new Error('userId required');
        const url = `${this.apiBase}/problem/tracker/rank/update-accept-count`;
        const body = `userId=${encodeURIComponent(userId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || 'update accept count failed');
    }

    // 管理员：更新用户提交总数（用于排行榜刷新）
    async adminUpdateUserSubmissionCount(userId) {
        if (!userId) throw new Error('userId required');
        const url = `${this.apiBase}/problem/tracker/rank/update-submission-count`;
        const body = `userId=${encodeURIComponent(userId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || 'update submission count failed');
    }

    async teamInviteUser(teamId, userId) {
        const url = `${this.apiBase}/problem/tracker/team/invite/user`;
        const body = `teamId=${encodeURIComponent(teamId)}&userId=${encodeURIComponent(userId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || data;
        throw new Error((data && data.msg) || '邀请失败');
    }

    async teamInviteAccept(applyId) {
        const url = `${this.apiBase}/problem/tracker/team/invite/accept`;
        const body = `applyId=${encodeURIComponent(applyId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '接受邀请失败');
    }

    async teamInviteDecline(applyId) {
        const url = `${this.apiBase}/problem/tracker/team/invite/decline`;
        const body = `applyId=${encodeURIComponent(applyId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '拒绝邀请失败');
    }

    async teamInviteCancel(applyId) {
        const url = `${this.apiBase}/problem/tracker/team/invite/cancel`;
        const body = `applyId=${encodeURIComponent(applyId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '撤销邀请失败');
    }

    // 队长：触发重建团队成员的指标（每日最多一次）
    async teamRankRebuild(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/rank/rebuild`;
        const body = `teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            const d = data.data || {};
            return typeof d.queued === 'number' ? d.queued : 0;
        }
        throw new Error((data && data.msg) || '触发重建失败');
    }

    // 退出团队（成员）
    async teamQuit(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/quit`;
        const body = `teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '退出团队失败');
    }

    // 解散团队（队长）
    async teamDisband(teamId) {
        const url = `${this.apiBase}/problem/tracker/team/disband`;
        const body = `teamId=${encodeURIComponent(teamId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return true;
        throw new Error((data && data.msg) || '解散团队失败');
    }

    async teamApplyList(teamId, page = 1, limit = 5) {
        const url = `${this.apiBase}/problem/tracker/team/apply/list?teamId=${encodeURIComponent(teamId)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            const result = data.data || {};
            // 后端返回格式：{ dataList: [], pageInfo: { total, page, limit, ... } }
            const list = Array.isArray(result.dataList) ? result.dataList : [];
            const pageInfo = result.pageInfo || {};
            const totalCount = pageInfo.totalCount;
            console.debug('teamApplyList API 返回:', { result, list, totalCount, pageInfo });
           // console.log('apitotal=',totalCount);
            return { list, totalCount };
        }
        return { list: [], totalCount: 0 };
    }

    async teamInviteList(teamId, limit = 100) {
        const url = `${this.apiBase}/problem/tracker/team/invite/list?teamId=${encodeURIComponent(teamId)}&limit=${encodeURIComponent(limit)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || [];
        return [];
    }

    // 用户侧：我申请中的团队列表
    async teamMyApplies() {
        const url = `${this.apiBase}/problem/tracker/team/my/apply`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json().catch(() => ([]));
        if (data && (data.code === 0 || data.code === 200)) return data.data || [];
        return Array.isArray(data) ? data : [];
    }

    // 用户侧：邀请我的团队列表
    async teamMyInvites() {
        const url = `${this.apiBase}/problem/tracker/team/my/invite`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json().catch(() => ([]));
        if (data && (data.code === 0 || data.code === 200)) return data.data || [];
        return Array.isArray(data) ? data : [];
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
        // 后端需要完整的 iframe 串；保持原样传递（仅做 URL 编码）
        const shareLink = String(shareLinkRaw).trim();

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
                        passTotal: Number(q.passTotal || q.acCount || 0) || 0,
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
     * 管理员：为指定知识点新增题目
     * @param {number} tagId
     * @param {number|string} questionId
     * @param {number} score
     */
    async addSkillTreeQuestion(tagId, questionId, score) {
        const url = `${this.apiBase}/problem/tracker/skill-tree/add-question`;
        const body = `tagId=${encodeURIComponent(tagId)}&questionId=${encodeURIComponent(questionId)}&score=${encodeURIComponent(score)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || data;
        throw new Error((data && data.msg) || '新增题目失败');
    }
    

    /**
     * 管理员：更新知识点题目分数
     * @param {number} tagId
     * @param {number|string} questionId
     * @param {number} score
     */
    async updateSkillTreeQuestion(tagId, questionId, score) {
        const url = `${this.apiBase}/problem/tracker/skill-tree/update-question`;
        const body = `tagId=${encodeURIComponent(tagId)}&questionId=${encodeURIComponent(questionId)}&score=${encodeURIComponent(score)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || data;
        throw new Error((data && data.msg) || '更新题目失败');
    }

    /**
     * 管理员：删除知识点题目
     * @param {number|string} questionId
     */
    async deleteSkillTreeQuestion(questionId) {
        const url = `${this.apiBase}/problem/tracker/skill-tree/delete-question`;
        const body = `questionId=${encodeURIComponent(questionId)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) return data.data || data;
        throw new Error((data && data.msg) || '删除题目失败');
    }

    /**
     * 批量替换：重建某知识点下的全部题目（按顺序、分数、依赖）
     * @param {number|string} tagId
     * @param {Array<{questionId:string|number, score:number, dependencies?:Array<string|number>}>} items
     */
    async batchReplaceSkillTree(tagId, items) {
        if (!tagId) throw new Error('tagId required');
        const url = `${this.apiBase}/problem/tracker/skill-tree/batch-replace`;
        // 后端期望 dependencies 为逗号分隔的字符串
        const safeItems = (Array.isArray(items) ? items : []).map((it) => {
            // 兼容 questionId/qid/questionid 三种写法
            const qid = it && (it.questionId ?? it.qid ?? it.questionid);
            const score = Number(it && it.score);
            let depsStr = '';
            if (Array.isArray(it && it.dependencies)) {
                depsStr = it.dependencies.map(String).filter(Boolean).join(',');
            } else if (it && typeof it.dependencies === 'string') {
                depsStr = it.dependencies.trim();
            }
            return {
                questionId: qid,
                score: Number.isFinite(score) && score >= 0 ? score : 0,
                dependencies: depsStr
            };
        });
        const body = `tagId=${encodeURIComponent(tagId)}&items=${encodeURIComponent(JSON.stringify(safeItems))}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'Accept': 'application/json'
            },
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
            const data = await res.json();
            if (data && (data.code === 0 || data.code === 200)) return data.data || data;
            throw new Error((data && data.msg) || '批量替换失败');
        } else {
            const text = await res.text();
            // 尝试解析为 JSON，否则抛出原文（常见为HTML报错/登录页）
            try {
                const data = JSON.parse(text);
                if (data && (data.code === 0 || data.code === 200)) return data.data || data;
                throw new Error((data && data.msg) || '批量替换失败');
            } catch (_) {
                throw new Error(text.slice(0, 300) || '批量替换失败（非JSON响应）');
            }
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

    // 管理员：更新用户的所有题单类型成就
    async adminUpdateAllTopicBadges(userId) {
        if (!userId) throw new Error('userId required');
        const url = `${this.apiBase}/problem/tracker/badge/update-all-topic-badges`;
        const body = `userId=${encodeURIComponent(userId)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (data && (data.code === 0 || data.code === 200)) {
            return data.data || { updatedCount: 0 };
        }
        throw new Error((data && data.msg) || 'update all topic badges failed');
    }

    // ===== 对战平台 =====
    /**
     * 发起匹配
     * @param {number} rankScore - 段位分
     * @param {string} mode - 匹配模式，默认 '1v1'
     * @returns {Promise<{matched: boolean, roomId?: string, opponentId?: number}>}
     */
    async battleMatch(mode = '1v1') {
        const url = `${this.apiBase}/problem/tracker/battle/match?mode=${encodeURIComponent(mode)}`;
        const res = await fetch(url, {
            method: 'POST',
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            return data.data || { matched: false };
        }
        return { matched: false };
    }

    /**
     * 轮询匹配结果
     * @returns {Promise<{matched: boolean, roomId?: string}>}
     */
    async battlePoll() {
        const url = `${this.apiBase}/problem/tracker/battle/poll`;
        const res = await fetch(url, {
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            return data.data || { matched: false };
        }
        return { matched: false };
    }

    /**
     * 人机对战：直接创建房间，不需要匹配
     * rankScore 由后端自动获取，避免用户传递错误的rankScore
     * @returns {Promise<{matched: boolean, roomId: string, problemId?: number, startTime?: number, aiAcTime?: number}>}
     */
    async battleMatchAI() {
        const url = `${this.apiBase}/problem/tracker/battle/match-ai`;
        const res = await fetch(url, {
            method: 'POST',
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            return data.data || { matched: false };
        }
        return { matched: false };
    }

    /**
     * 取消匹配
     * @param {string} mode - 匹配模式，默认 '1v1'
     */
    async battleCancel(mode = '1v1') {
        const url = `${this.apiBase}/problem/tracker/battle/cancel?mode=${encodeURIComponent(mode)}`;
        const res = await fetch(url, {
            method: 'POST',
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data && (data.code === 0 || data.code === 200);
    }

    /**
     * 获取用户对战信息
     * @returns {Promise<{battle1v1: {levelScore, winCount, totalCount, type}, battleAI: {levelScore, winCount, totalCount, type}}>}
     */
    async battleInfo() {
        const url = `${this.apiBase}/problem/tracker/battle/info`;
        const res = await fetch(url, {
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            return data.data || {
                battle1v1: { levelScore: 1000, winCount: 0, totalCount: 0, type: 2 },
                battleAI: { levelScore: 1000, winCount: 0, totalCount: 0, type: 1 }
            };
        }
        // 如果接口失败，返回默认值
        return {
            battle1v1: { levelScore: 1000, winCount: 0, totalCount: 0, type: 2 },
            battleAI: { levelScore: 1000, winCount: 0, totalCount: 0, type: 1 }
        };
    }

    /**
     * 创建自定义房间
     * @param {string} roomCode - 房间码（前端生成）
     * @returns {Promise<{success: boolean, roomId?: string, roomCode?: string, alreadyInRoom?: boolean, message?: string}>}
     */
    async battleCreateRoom(roomCode) {
        const url = `${this.apiBase}/problem/tracker/battle/create-room?roomCode=${encodeURIComponent(roomCode)}`;
        const res = await fetch(url, {
            method: 'POST',
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            return data.data || { success: false };
        }
        // 如果返回错误，解析错误信息
        return { success: false, message: data.message || '创建房间失败' };
    }

    /**
     * 加入自定义房间
     * @param {string} roomCode - 房间码
     * @returns {Promise<{success: boolean, roomId?: string, problemId?: number, startTime?: number, opponentId?: number, alreadyInRoom?: boolean, message?: string}>}
     */
    async battleJoinRoom(roomCode) {
        const url = `${this.apiBase}/problem/tracker/battle/join-room?roomCode=${encodeURIComponent(roomCode)}`;
        const res = await fetch(url, {
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            return data.data || { success: false };
        }
        // 如果返回错误，解析错误信息
        return { success: false, message: data.message || '加入房间失败' };
    }

    /**
     * 解散自定义房间
     * @param {string} roomCode - 房间码
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async battleDisbandRoom(roomCode) {
        const url = `${this.apiBase}/problem/tracker/battle/disband-room?roomCode=${encodeURIComponent(roomCode)}`;
        const res = await fetch(url, {
            method: 'POST',
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            return data.data || { success: false };
        }
        // 如果返回错误，解析错误信息
        return { success: false, message: data.message || '解散房间失败' };
    }

    /**
     * 分页获取用户对战记录列表
     * @param {number|string} userId - 用户ID
     * @param {number} page - 页码
     * @param {number} limit - 每页数量
     * @returns {Promise<{list: Array, total: number}>}
     */
    /**
     * 获取对战记录列表
     * @param {number} type - 对战类型：1=人机对战，2=1v1对战
     * @param {number} page - 页码（从1开始）
     * @param {number} limit - 每页数量
     * @returns {Promise<object>} 返回包含list、total、page、limit的对象
     */
    async battleRecordList(type = 2, page = 1, limit = 20) {
        const url = `${this.apiBase}/problem/tracker/battle/records?type=${encodeURIComponent(type)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
        try {
            const res = await fetch(url, {
                cache: 'no-store',
                credentials: 'include'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data && (data.code === 0 || data.code === 200)) {
                return data.data || { list: [], total: 0, page: page, limit: limit };
            }
            throw new Error('API返回错误');
        } catch (error) {
            console.error('获取对战记录列表失败:', error);
            return { list: [], total: 0, page: page, limit: limit };
        }
    }

    /**
     * 获取对战排行榜
     * @param {number} type - 对战类型：1=人机对战，2=1v1对战
     * @param {number} page - 页码（从1开始）
     * @param {number} limit - 每页数量
     * @returns {Promise<object>} 返回包含list、total、page、limit的对象
     */
    async battleLeaderboard(type = 2, page = 1, limit = 20) {
        const url = `${this.apiBase}/problem/tracker/battle/leaderboard?type=${encodeURIComponent(type)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
        try {
            const res = await fetch(url, {
                cache: 'no-store',
                credentials: 'include'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data && (data.code === 0 || data.code === 200)) {
                return data.data || { list: [], total: 0, page: page, limit: limit };
            }
            throw new Error('API返回错误');
        } catch (error) {
            console.error('获取对战排行榜失败:', error);
            return { list: [], total: 0, page: page, limit: limit };
        }
    }

    /**
     * 获取用户模板代码
     * @param {number} type - 对战类型：1=人机对战，2=1v1对战
     * @returns {Promise<object>} 返回包含templateCode、level、exp、maxLength的对象
     */
    async battleTemplate(type = 2) {
        const url = `${this.apiBase}/problem/tracker/battle/template?type=${encodeURIComponent(type)}`;
        try {
            const res = await fetch(url, {
                cache: 'no-store',
                credentials: 'include'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data && (data.code === 0 || data.code === 200)) {
                return data.data || { templateCode: {}, level: 1, exp: 0, maxLength: 10000 };
            }
            throw new Error('API返回错误');
        } catch (error) {
            console.error('获取模板代码失败:', error);
            return { templateCode: {}, level: 1, exp: 0, maxLength: 10000 };
        }
    }

    /**
     * 更新用户模板代码
     * @param {number} type - 对战类型：1=人机对战，2=1v1对战
     * @param {string} templateCode - 模板代码（JSON格式字符串）
     * @returns {Promise<object>} 返回更新结果
     */
    async battleUpdateTemplate(type, templateCode) {
        const url = `${this.apiBase}/problem/tracker/battle/template`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                cache: 'no-store',
                credentials: 'include',
                body: `type=${encodeURIComponent(type)}&templateCode=${encodeURIComponent(templateCode)}`
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data && (data.code === 0 || data.code === 200)) {
                return data.data || { success: true };
            }
            throw new Error(data.message || 'API返回错误');
        } catch (error) {
            console.error('更新模板代码失败:', error);
            throw error;
        }
    }

    /**
     * 获取单场对战记录详情
     * @param {number|string} battleRecordId - 对战记录ID
     * @returns {Promise<object>}
     */
    async battleRecord(battleRecordId) {
        const url = `${this.apiBase}/problem/tracker/battle/battleRecord?battleRecordId=${encodeURIComponent(battleRecordId)}`;
        try {
            const res = await fetch(url, {
                cache: 'no-store',
                credentials: 'include'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data && (data.code === 0 || data.code === 200)) {
                return data.data || null;
            }
        } catch (error) {
            console.log('获取对战记录详情失败，使用模拟数据:', error);
        }
        // 模拟数据（后端未实现时）
        const mockRecord = {
            id: battleRecordId,
            type: '1v1',
            battleTime: new Date(Date.now() - 86400000 * 2).toISOString(),
            problemId: 1001,
            problemName: '两数之和',
            user: {
                userId: '919247',
                name: '当前用户',
                levelScore: 1200,
                scoreChange: 15,
                headUrl: 'https://static.nowcoder.com/fe/file/images/nowpick/web/www-favicon.ico'
            },
            opponentJson: JSON.stringify({
                userId: '999999',
                name: '对手用户',
                levelScore: 1180,
                scoreChange: -15,
                headUrl: 'https://static.nowcoder.com/fe/file/images/nowpick/web/www-favicon.ico'
            }),
            details: {
                user: {
                    time: 120,
                    completed: true
                },
                opponent: {
                    time: 180,
                    completed: true
                }
            }
        };
        return mockRecord;
    }

    /**
     * 结算一场对战
     * @param {object} battleRecord - 对战记录数据
     * @returns {Promise<boolean>}
     */
    async completeBattle(battleRecord) {
        const url = `${this.apiBase}/problem/tracker/battle/completeBattle`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(battleRecord),
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data && (data.code === 0 || data.code === 200);
    }

    /**
     * 查询当前比赛状态
     * @param {string} roomId - 房间ID
     * @returns {Promise<object>}
     */
    async checkStatus(roomId) {
        const url = `${this.apiBase}/problem/tracker/battle/checkStatus?roomid=${encodeURIComponent(roomId)}`;
        const res = await fetch(url, {
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && (data.code === 0 || data.code === 200)) {
            return data.data || null;
        }
        return null;
    }

    /**
     * 更新当前比赛状态
     * @param {string} roomId - 房间ID
     * @returns {Promise<boolean>}
     */
    async updateStatus(roomId) {
        const url = `${this.apiBase}/problem/tracker/battle/updateStatus?roomid=${encodeURIComponent(roomId)}`;
        const res = await fetch(url, {
            method: 'POST',
            cache: 'no-store',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data && (data.code === 0 || data.code === 200);
    }

    /**
     * 管理员：批量处理对战房间状态
     * @returns {Promise<object>} 返回处理结果
     */
    async adminBatchProcessRoomStatus() {
        const url = `${this.apiBase}/problem/tracker/battle/batch-process-room-status`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                cache: 'no-store',
                credentials: 'include'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data && (data.code === 0 || data.code === 200)) {
                return data.data || {};
            }
            throw new Error(data.message || 'API返回错误');
        } catch (error) {
            console.error('批量处理房间状态失败:', error);
            throw error;
        }
    }
}

