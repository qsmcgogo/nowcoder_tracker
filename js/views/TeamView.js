import { eventBus, EVENTS } from '../events/EventBus.js';

export class TeamView {
    constructor(elements, state, api) {
        this.elements = elements;
        this.state = state;
        this.api = api;

        this.activeTeamTab = 'dashboard';
        this.currentTeamId = null; // 未选择团队时展示“我的团队”列表
        this.role = 'owner'; // 预设：owner|admin|member，后续从接口赋值
        this.teamInfo = null; // { name, desc, memberCount }
        this.myTeams = [];
        // 看板分页状态
        this.teamLeaderboardPage = 1;
        this.teamLeaderboardLimit = 20;
        this.teamLeaderboardTotal = 0;
        this.teamLeaderboardMetric = 'solve_total';

        this.bindEvents();
    }

    // 统一绑定 ACM 徽章提示
    bindAcmBadgesTooltip() {
        const tipId = 'team-type-tooltip';
        let tip = document.getElementById(tipId);
        if (!tip) {
            tip = document.createElement('div');
            tip.id = tipId;
            tip.style.position = 'absolute';
            tip.style.zIndex = '9999';
            tip.style.background = '#fff';
            tip.style.border = '1px solid #eee';
            tip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
            tip.style.borderRadius = '6px';
            tip.style.padding = '8px 10px';
            tip.style.fontSize = '12px';
            tip.style.color = '#333';
            tip.style.display = 'none';
            document.body.appendChild(tip);
        }
        let hideTimer = null;
        let pointerInside = false; // 是否在徽章或提示框内
        const clearHide = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };
        const show = (target) => {
            clearHide();
            tip.innerHTML = `ACM 队伍请前往 <a href="https://ac.nowcoder.com/acm/team/manager/create-team-index" target="_blank" rel="noopener noreferrer" style="color:#1d39c4;text-decoration:underline;">竞赛站</a> 创建`;
            const rect = target.getBoundingClientRect();
            tip.style.left = `${rect.left + window.scrollX}px`;
            tip.style.top = `${rect.bottom + window.scrollY + 6}px`;
            tip.style.display = 'block';
        };
        const hideNow = () => { tip.style.display = 'none'; };
        const delayedHide = () => {
            clearHide();
            hideTimer = setTimeout(() => {
                if (!pointerInside) hideNow();
            }, 800);
        };
        // 全局跟踪鼠标是否在徽章或提示框内
        if (!window._acmTipGlobalBound) {
            window._acmTipGlobalBound = true;
            document.addEventListener('mousemove', (e) => {
                const t = e.target;
                pointerInside = !!(t && (t.closest && (t.closest('#' + tipId) || t.closest('.team-type-badge-acm'))));
                if (pointerInside) clearHide();
            }, { passive: true });
        }
        document.querySelectorAll('.team-type-badge-acm').forEach(el => {
            if (el._tipBound) return; el._tipBound = true;
            el.addEventListener('mouseenter', () => { show(el); });
            el.addEventListener('mouseleave', () => { delayedHide(); });
            el.addEventListener('click', (e) => { e.stopPropagation(); });
        });
    }

    bindEvents() {
        eventBus.on(EVENTS.MAIN_TAB_CHANGED, (tab) => {
            if (tab === 'team') this.render();
        });
        eventBus.on(EVENTS.TEAM_TAB_CHANGED, (tab) => {
            this.activeTeamTab = tab;
            this.render();
        });
    }

    hide() {
        const section = this.elements.team;
        if (section) section.classList.remove('active');
    }

    render() {
        const section = this.elements.team;
        if (!section) return;
        section.classList.add('active');

        // 邀请链接落地：如果 hash 为 /team/join?teamId=... 或 /team/{id}，在团队页生命周期内兜底弹窗
        try {
            const h = String(window.location.hash || '');
            if (/^#\/?(team\/(join|\d+)|inviteteam(\/|\?|$))/i.test(h)) {
                const app = window.app;
                if (app && typeof app.parseTeamInviteRoute === 'function' && typeof app.showTeamInviteLanding === 'function') {
                    const tid = app.parseTeamInviteRoute();
                    const modal = document.getElementById('team-invite-landing');
                    const shownFor = modal ? modal.getAttribute('data-shown-for') : '';
                    if (tid && modal && shownFor !== String(tid)) {
                        modal.setAttribute('data-shown-for', String(tid));
                        app.showTeamInviteLanding(tid);
                    }
                }
            }
        } catch (_) {}

        // 若未选择团队，展示团队列表
        const listView = document.getElementById('team-list');
        const subTabs = document.getElementById('team-subtabs');
        // 未登录：仅显示提示，不可使用团队功能
        if (!this.state.loggedInUserId) {
            if (subTabs) subTabs.style.display = 'none';
            if (listView) listView.style.display = 'block';
            ['team-dashboard','team-leaderboard'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
            const tbody = document.getElementById('team-list-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="4">请登录来获取团队信息</td></tr>`;
            const joinBtn = document.getElementById('team-join-open-btn');
            const createBtn = document.getElementById('team-create-btn');
            [joinBtn, createBtn].forEach(b => { if (b) { b.setAttribute('disabled','disabled'); b.style.pointerEvents='none'; b.style.opacity='0.6'; b.title='请先登录'; } });
            return;
        }
        if (!this.currentTeamId) {
            if (subTabs) subTabs.style.display = 'none';
            if (listView) listView.style.display = 'block';
            // 隐藏子视图
            ['team-dashboard','team-leaderboard'].forEach(id => {
                const el = document.getElementById(id); if (el) el.style.display = 'none';
            });
            this.fetchAndRenderTeamList();
            this.bindTeamHomeTabs();
            this.bindTeamListActions();
            this.bindJoinTeamActions();
            return;
        }

        // 已选择团队：显示子标签与对应视图
        if (subTabs) subTabs.style.display = 'flex';
        if (listView) listView.style.display = 'none';

        const map = {
            dashboard: this.elements.teamDashboard,
            leaderboard: this.elements.teamLeaderboard
        };
        Object.values(map).forEach(el => { if (el) el.style.display = 'none'; });
        if (map[this.activeTeamTab]) map[this.activeTeamTab].style.display = 'block';

        switch (this.activeTeamTab) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'leaderboard':
                this.renderLeaderboard();
                break;
        }
        this.bindDOMActions();
    }

    bindTeamHomeTabs() {
        const tabs = [
            { id: 'team-home-tab-my', panel: 'team-home-my' },
            { id: 'team-home-tab-applying', panel: 'team-home-applying' },
            { id: 'team-home-tab-invited', panel: 'team-home-invited' }
        ];
        tabs.forEach(t => {
            const btn = document.getElementById(t.id);
            if (!btn || btn._bound) return;
            btn._bound = true;
            btn.addEventListener('click', async () => {
                // 切tab
                document.querySelectorAll('.team-home-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                tabs.forEach(x => {
                    const p = document.getElementById(x.panel); if (p) p.style.display = (x.id === t.id ? 'block' : 'none');
                });
                // 数据渲染
                if (t.id === 'team-home-tab-applying') {
                    await this.renderMyApplies();
                } else if (t.id === 'team-home-tab-invited') {
                    await this.renderMyInvites();
                }
            });
        });
    }

    bindJoinTeamActions() {
        const openBtn = document.getElementById('team-join-open-btn');
        if (openBtn && !openBtn._bound) {
            openBtn._bound = true;
            openBtn.addEventListener('click', () => {
                const modal = document.getElementById('team-join-modal');
                if (!modal) return; modal.style.display = 'flex';
                const tips = document.getElementById('team-join-result'); if (tips) tips.textContent = '请输入团队ID搜索';
                const input = document.getElementById('team-join-id-input'); if (input) { input.value=''; setTimeout(()=>input.focus(),0); }
            });
        }
        const closeBtn = document.getElementById('team-join-close');
        if (closeBtn && !closeBtn._bound) { closeBtn._bound = true; closeBtn.addEventListener('click', () => { const m = document.getElementById('team-join-modal'); if (m) m.style.display='none'; }); }
        const cancelBtn = document.getElementById('team-join-cancel');
        if (cancelBtn && !cancelBtn._bound) { cancelBtn._bound = true; cancelBtn.addEventListener('click', () => { const m = document.getElementById('team-join-modal'); if (m) m.style.display='none'; }); }
        const searchBtn = document.getElementById('team-join-search-btn');
        if (searchBtn && !searchBtn._bound) {
            searchBtn._bound = true;
            searchBtn.addEventListener('click', async () => {
                const input = document.getElementById('team-join-id-input');
                const id = (input?.value || '').trim();
                const result = document.getElementById('team-join-result');
                if (!id) { if (result) result.textContent='请输入团队ID'; return; }
                if (result) result.textContent='搜索中...';
                try {
                    const [sum, ck] = await Promise.all([
                        this.api.teamStatsSummary(id),
                        this.api.teamMemberCheck(id)
                    ]);
                    if (!sum || !sum.teamId) { if (result) result.textContent='未找到该团队'; return; }
                    const name = sum.name || `团队${id}`;
                    const member = Number(sum.memberCount||0);
                    const limit = Number(sum.personLimit||500);
                    const isFull = (limit > 0 && member >= limit);
                    if (result) {
                        const right = (ck && ck.inTeam)
                            ? `<span style=\"color:#999;\">已在团队</span>`
                            : (isFull ? `<span style=\"color:#999;\">已满员</span>`
                                     : `<button id=\"team-join-apply-btn\" class=\"admin-btn\" data-team-id=\"${id}\">申请加入</button>`);
                        result.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
                            <div><b>${name}</b>（${member}/${limit}）</div>
                            <div>${right}</div>
                        </div>`;
                        const applyBtn = document.getElementById('team-join-apply-btn');
                        if (applyBtn && !applyBtn._bound) {
                            applyBtn._bound = true;
                            applyBtn.addEventListener('click', async () => {
                                try {
                                    // 申请前预检：是否已在该团队
                                    const ck2 = await this.api.teamMemberCheck(id);
                                    if (ck2 && ck2.inTeam) {
                                        alert('你已在该团队');
                                        return;
                                    }
                                    // 满员再校验
                                    const s2 = await this.api.teamStatsSummary(id).catch(()=>({}));
                                    const mem2 = Number(s2?.memberCount||0);
                                    const lim2 = Number(s2?.personLimit||500);
                                    if (lim2 > 0 && mem2 >= lim2) { alert('该团队已满员'); return; }
                                    await this.api.teamApply(id, '');
                                    alert('已提交申请');
                                } catch (e) { alert(e.message || '申请失败'); }
                            });
                        }
                    }
                } catch (e) {
                    if (result) result.textContent = e.message || '搜索失败';
                }
            });
        }
    }

    bindDOMActions() {
        // 成员管理按钮
        const addBtn = document.getElementById('team-add-member-btn');
        if (addBtn && !addBtn._bound) {
            addBtn._bound = true;
            addBtn.addEventListener('click', async () => {
                const uid = (document.getElementById('team-add-user-id')?.value || '').trim();
                if (!uid) return alert('请输入用户ID');
                try {
                    await this.api.teamAddMember(this.currentTeamId, uid);
                    alert('已添加成员');
                    this.renderMembers();
                } catch (e) {
                    alert(e.message || '添加成员失败');
                }
            });
        }

        // 编辑资料弹窗（关闭/取消/保存）
        const editClose = document.getElementById('team-edit-close');
        if (editClose && !editClose._bound) {
            editClose._bound = true;
            editClose.addEventListener('click', () => { const m = document.getElementById('team-edit-modal'); if (m) m.style.display = 'none'; });
        }
        const editCancel = document.getElementById('team-edit-cancel');
        if (editCancel && !editCancel._bound) {
            editCancel._bound = true;
            editCancel.addEventListener('click', () => { const m = document.getElementById('team-edit-modal'); if (m) m.style.display = 'none'; });
        }
        const editConfirm = document.getElementById('team-edit-confirm');
        if (editConfirm && !editConfirm._bound) {
            editConfirm._bound = true;
            editConfirm.addEventListener('click', async () => {
                const name = document.getElementById('team-edit-name')?.value || '';
                const desc = document.getElementById('team-edit-desc')?.value || '';
                try {
                    await this.api.teamUpdate(this.currentTeamId, name.trim(), desc.trim());
                    this.teamInfo = { ...(this.teamInfo || {}), name: name.trim(), desc: desc.trim() };
                    const m = document.getElementById('team-edit-modal'); if (m) m.style.display = 'none';
                    this.render();
                } catch (e) { alert(e.message || '保存失败'); }
            });
        }

        const copyInviteBtn = document.getElementById('team-copy-invite-link-btn');
        if (copyInviteBtn && !copyInviteBtn._bound) {
            copyInviteBtn._bound = true;
            copyInviteBtn.addEventListener('click', async () => {
                try {
                    if (this.teamInfo && Number(this.teamInfo.personLimit||0) > 0 && Number(this.teamInfo.memberCount||0) >= Number(this.teamInfo.personLimit||0)) {
                        alert('团队已满员，无法生成新的邀请');
                        return;
                    }
                    const data = await this.api.teamInviteCreate(this.currentTeamId);
                    const info = this.teamInfo || {};
                    const teamName = info.name || info.teamName || '我的团队';
                    // 无论后端返回什么路径，统一使用新的哈希路由前缀：/#/inviteTeam/{teamId}
                    const finalLink = `https://www.nowcoder.com/problem/tracker#/inviteTeam/${encodeURIComponent(this.currentTeamId)}`;
                    const copyText = `点击链接加入${teamName}：${finalLink}`;
                    const span = document.getElementById('team-invite-created');
                    if (span) span.textContent = `邀请链接：${finalLink}`;
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(copyText);
                        alert('邀请信息已复制到剪贴板');
                    } else {
                        const ta = document.createElement('textarea'); ta.value = copyText; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); alert('邀请信息已复制到剪贴板');
                    }
                } catch (e) { alert(e.message || '生成邀请失败'); }
            });
        }

        // 发送成员邀请
        const inviteUserBtn = document.getElementById('team-invite-user-btn');
        if (inviteUserBtn && !inviteUserBtn._bound) {
            inviteUserBtn._bound = true;
            inviteUserBtn.addEventListener('click', async () => {
                const uid = (document.getElementById('team-invite-user-id')?.value || '').trim();
                if (!uid) return alert('请输入用户ID');
                try {
                    if (this.teamInfo && Number(this.teamInfo.personLimit||0) > 0 && Number(this.teamInfo.memberCount||0) >= Number(this.teamInfo.personLimit||0)) {
                        alert('团队已满员，无法邀请新成员');
                        return;
                    }
                    const r = await this.api.teamInviteUser(this.currentTeamId, uid);
                    const applyId = (r && r.applyId) ? r.applyId : '';
                    alert(`已发送邀请${applyId ? `（申请号：${applyId}` : ''}`);
                } catch (e) {
                    alert(e.message || '邀请失败');
                }
            });
        }

        // 转移队长
        const transferBtn = document.getElementById('team-transfer-btn');
        if (transferBtn && !transferBtn._bound) {
            transferBtn._bound = true;
            transferBtn.addEventListener('click', async () => {
                const uid = prompt('请输入新队长的用户ID');
                if (!uid) return;
                try {
                    await this.api.teamTransferOwner(this.currentTeamId, uid.trim());
                    alert('已转移队长');
                } catch (e) {
                    alert(e.message || '操作失败');
                }
            });
        }

        // 返回“我的团队”
        const backBtn = document.getElementById('team-back-btn');
        if (backBtn && !backBtn._bound) {
            backBtn._bound = true;
            backBtn.addEventListener('click', () => {
                this.currentTeamId = null;
                this.activeTeamTab = 'dashboard';
                this.render();
            });
        }
    }

    renderDashboard() {
        const metrics = document.getElementById('team-dashboard-metrics');
        if (!metrics) return;
        const info = this.teamInfo || { name: '我的团队', desc: '团队简介', memberCount: '--', personLimit: 500 };
        const canEdit = (this.role === 'owner');
        const editBtn = canEdit ? `<button id="team-edit-entry-btn" class="admin-btn" style="position:absolute; right:12px; top:10px;">编辑</button>` : '';
        const nameLineBtns = canEdit
            ? `<button id="team-add-member-top" class="admin-btn">邀请成员</button>
               <button id="team-approve-open-btn" class="admin-btn">审批</button>
               <button id="team-disband-btn" class="admin-btn" style="background:#ffecec;color:#e00;">解散团队</button>`
            : (this.role !== 'owner' ? `<button id="team-quit-btn" class="admin-btn" style="background:#ffecec;color:#e00;">退出团队</button>` : '');
        metrics.innerHTML = `
            <div class="achv-overview-card" style="position:relative; text-align:center; padding:20px 16px;">
                <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:6px;">
                    <div style="font-size:22px; font-weight:700;">${info.name}</div>
                    <div>${nameLineBtns}</div>
                </div>
                <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; color:#888; font-size:12px; margin-bottom:4px;">
                    <span>ID: ${String(this.currentTeamId || info.teamId || '')}</span>
                    <button id="team-copy-id-btn" class="admin-btn" style="background:#f5f5f5;color:#666;border:1px solid #e5e5e5;padding:2px 8px;height:auto;line-height:1;font-size:12px;">复制</button>
                </div>
                <div id="team-dashboard-alerts" style="margin:4px 0 0 0;"></div>
                <div class="team-slogan-box" style="position:relative; margin:12px auto 0; text-align:left; max-width:720px; border:1px solid #eee; background:#fafafa; border-radius:8px; padding:12px 14px;">
                    <div class="team-slogan-title" style="font-weight:600; color:#555; margin-bottom:6px;">团队宣言</div>
                    ${editBtn}
                    <div class="team-slogan-content" style="white-space:pre-wrap; color:#444; line-height:1.6;">${info.desc || '暂无宣言'}</div>
                </div>
                <div style="margin-top:10px; color:#333;">成员数：<b>${info.memberCount}</b> / ${info.personLimit || 500}</div>

                <!-- 团队指标卡片：今日过题 / 近7日过题 / 总过题 / 总提交 -->
                <div id="team-metric-cards" style="display:flex; gap:12px; justify-content:space-between; margin-top:12px;">
                    <div class="metric-card" style="flex:1; border:1px solid #eee; border-radius:8px; padding:14px; background:#fff;">
                        <div style="color:#777; font-size:12px;">今日过题</div>
                        <div id="metric-today-accept" style="font-size:24px; font-weight:700; margin-top:6px;">-</div>
                    </div>
                    <div class="metric-card" style="flex:1; border:1px solid #eee; border-radius:8px; padding:14px; background:#fff;">
                        <div style="color:#777; font-size:12px;">近7日过题</div>
                        <div id="metric-seven-accept" style="font-size:24px; font-weight:700; margin-top:6px;">-</div>
                    </div>
                    <div class="metric-card" style="flex:1; border:1px solid #eee; border-radius:8px; padding:14px; background:#fff;">
                        <div style="color:#777; font-size:12px;">总过题</div>
                        <div id="metric-total-accept" style="font-size:24px; font-weight:700; margin-top:6px;">-</div>
                    </div>
                    <div class="metric-card" style="flex:1; border:1px solid #eee; border-radius:8px; padding:14px; background:#fff;">
                        <div style="color:#777; font-size:12px;">总提交</div>
                        <div id="metric-total-submission" style="font-size:24px; font-weight:700; margin-top:6px;">-</div>
                    </div>
                </div>
                <div id="team-dashboard-members" style="margin-top:12px; text-align:left;"></div>
            </div>
        `;
        // 排行榜占位
        const tbody = document.getElementById('team-rankings-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3">请选择指标或稍候接入后端数据</td></tr>`;
        }
        const editEntry = document.getElementById('team-edit-entry-btn');
        if (editEntry && !editEntry._bound) {
            editEntry._bound = true;
            editEntry.addEventListener('click', () => {
                const modal = document.getElementById('team-edit-modal');
                if (!modal) return;
                const nameI = document.getElementById('team-edit-name');
                const descI = document.getElementById('team-edit-desc');
                if (nameI) nameI.value = this.teamInfo?.name || '';
                if (descI) descI.value = this.teamInfo?.desc || '';
                modal.style.display = 'flex';
            });
        }
        const copyIdBtn = document.getElementById('team-copy-id-btn');
        if (copyIdBtn && !copyIdBtn._bound) {
            copyIdBtn._bound = true;
            copyIdBtn.addEventListener('click', async () => {
                const id = String(this.currentTeamId || '');
                try {
                    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(id); }
                    else { const ta = document.createElement('textarea'); ta.value = id; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
                    const old = copyIdBtn.textContent; copyIdBtn.textContent = '已复制'; setTimeout(()=> copyIdBtn.textContent = old || '复制', 1200);
                } catch (_) {}
            });
        }

        // 顶部右上角操作按钮
        const addTop = document.getElementById('team-add-member-top');
        if (addTop && !addTop._bound) {
            addTop._bound = true;
            addTop.addEventListener('click', async () => {
                const modal = document.getElementById('team-add-member-modal');
                if (!modal) return;
                const uidI = document.getElementById('team-add-userid-input');
                if (uidI) uidI.value = '';
                const linkShown = document.getElementById('team-add-link-shown');
                if (linkShown) linkShown.textContent = '';
                modal.style.display = 'flex';
            });
        }
        const addClose = document.getElementById('team-add-member-close');
        if (addClose && !addClose._bound) { addClose._bound = true; addClose.addEventListener('click', () => { const m = document.getElementById('team-add-member-modal'); if (m) m.style.display = 'none'; }); }
        const addCancel = document.getElementById('team-add-member-cancel');
        if (addCancel && !addCancel._bound) { addCancel._bound = true; addCancel.addEventListener('click', () => { const m = document.getElementById('team-add-member-modal'); if (m) m.style.display = 'none'; }); }
        const addInvite = document.getElementById('team-add-invite-confirm');
        if (addInvite && !addInvite._bound) {
            addInvite._bound = true;
            addInvite.addEventListener('click', async () => {
                const uid = (document.getElementById('team-add-userid-input')?.value || '').trim();
                if (!uid) return alert('请输入用户ID');
                try {
                    if (this.teamInfo && Number(this.teamInfo.personLimit||0) > 0 && Number(this.teamInfo.memberCount||0) >= Number(this.teamInfo.personLimit||0)) {
                        alert('团队已满员，无法邀请新成员');
                        return;
                    }
                    await this.api.teamInviteUser(this.currentTeamId, uid); alert('邀请已发送');
                } catch (e) { alert(e.message || '发送失败'); }
            });
        }
        const addCopy = document.getElementById('team-add-copy-link');
        if (addCopy && !addCopy._bound) {
            addCopy._bound = true;
            addCopy.addEventListener('click', async () => {
                try {
                    if (this.teamInfo && Number(this.teamInfo.personLimit||0) > 0 && Number(this.teamInfo.memberCount||0) >= Number(this.teamInfo.personLimit||0)) {
                        alert('团队已满员，无法生成新的邀请');
                        return;
                    }
                    const data = await this.api.teamInviteCreate(this.currentTeamId);
                    const info = this.teamInfo || {};
                    const teamName = info.name || info.teamName || '我的团队';
                    // 无论后端返回什么路径，统一使用新的哈希路由前缀
                    const finalLink = `https://www.nowcoder.com/problem/tracker#/inviteTeam/${encodeURIComponent(this.currentTeamId)}`;
                    const copyText = `点击链接加入${teamName}：${finalLink}`;
                    const span = document.getElementById('team-add-link-shown');
                    if (span) span.textContent = finalLink;
                    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(copyText); alert('已复制邀请信息'); }
                    else {
                        const ta = document.createElement('textarea'); ta.value = copyText; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); alert('已复制邀请信息');
                    }
                } catch (e) { alert(e.message || '生成邀请失败'); }
            });
        }

        // 审批弹窗
        const approveOpen = document.getElementById('team-approve-open-btn');
        if (approveOpen && !approveOpen._bound) {
            approveOpen._bound = true;
            approveOpen.addEventListener('click', async () => {
                const modal = document.getElementById('team-approve-modal');
                if (!modal) return; modal.style.display = 'flex';
                await this.renderApproveList();

                // 动态添加“一键通过全部 / 一键拒绝全部”
                const actions = modal.querySelector('.modal-actions');
                if (actions) {
                    let passAll = document.getElementById('team-approve-pass-all');
                    let rejectAll = document.getElementById('team-approve-reject-all');
                    if (!passAll) {
                        passAll = document.createElement('button');
                        passAll.id = 'team-approve-pass-all';
                        passAll.className = 'admin-btn';
                        passAll.textContent = '一键通过全部';
                        actions.insertBefore(passAll, actions.firstChild);
                        passAll.addEventListener('click', async () => {
                            if (!confirm('确认通过所有待审批申请？')) return;
                            try {
                                try {
                                    await this.api.teamApplyApproveAll(this.currentTeamId);
                                } catch (bulkErr) {
                                    // 后端未提供批量：回退为逐条
                                    const list = await this.api.teamApplyList(this.currentTeamId, 500);
                                    const ids = Array.isArray(list) ? list.map(a => a.id || a.applyId).filter(Boolean) : [];
                                    for (const id of ids) {
                                        try { await this.api.teamApplyApprove(id); } catch (_) {}
                                    }
                                }
                                await this.renderApproveList();
                                alert('已处理完毕');
                            } catch (e) { alert(e.message || '一键通过失败'); }
                        });
                    }
                    if (!rejectAll) {
                        rejectAll = document.createElement('button');
                        rejectAll.id = 'team-approve-reject-all';
                        rejectAll.className = 'admin-btn';
                        rejectAll.style.marginLeft = '8px';
                        rejectAll.textContent = '一键拒绝全部';
                        actions.insertBefore(rejectAll, actions.firstChild.nextSibling);
                        rejectAll.addEventListener('click', async () => {
                            if (!confirm('确认拒绝所有待审批申请？')) return;
                            try {
                                try {
                                    await this.api.teamApplyRejectAll(this.currentTeamId);
                                } catch (bulkErr) {
                                    // 后端未提供批量：回退为逐条
                                    const list = await this.api.teamApplyList(this.currentTeamId, 500);
                                    const ids = Array.isArray(list) ? list.map(a => a.id || a.applyId).filter(Boolean) : [];
                                    for (const id of ids) {
                                        try { await this.api.teamApplyReject(id); } catch (_) {}
                                    }
                                }
                                await this.renderApproveList();
                                alert('已处理完毕');
                            } catch (e) { alert(e.message || '一键拒绝失败'); }
                        });
                    }
                }
            });
        }
        const approveClose = document.getElementById('team-approve-close');
        if (approveClose && !approveClose._bound) { approveClose._bound = true; approveClose.addEventListener('click', () => { const m = document.getElementById('team-approve-modal'); if (m) m.style.display = 'none'; }); }
        const approveCancel = document.getElementById('team-approve-cancel');
        if (approveCancel && !approveCancel._bound) { approveCancel._bound = true; approveCancel.addEventListener('click', () => { const m = document.getElementById('team-approve-modal'); if (m) m.style.display = 'none'; }); }
        const approveConfirm = document.getElementById('team-approve-confirm');
        if (approveConfirm && !approveConfirm._bound) {
            approveConfirm._bound = true;
            approveConfirm.addEventListener('click', async () => {
                const name = document.getElementById('team-approve-name')?.value || '';
                const desc = document.getElementById('team-approve-desc')?.value || '';
                if (!name) {
                    alert('请填写团队名称');
                    return;
                }
                try {
                    await this.api.teamCreate(name, desc);
                    const newId = res?.teamId || res?.data?.teamId || null;
                    const modal = document.getElementById('team-approve-modal');
                    if (modal) modal.style.display = 'none';
                    await this.fetchAndRenderTeamList();
                    if (newId) {
                        // 直接进入新团队，角色为 owner
                        this.currentTeamId = String(newId);
                        this.role = 'owner';
                        this.teamInfo = { name, desc, memberCount: 1 };
                        this.activeTeamTab = 'dashboard';
                        this.render();
                    }
                } catch (e) {
                    alert(e.message || '创建失败');
                }
            });
        }

        // 解散团队
        const disband = document.getElementById('team-disband-btn');
        if (disband && !disband._bound) {
            disband._bound = true;
            disband.addEventListener('click', async () => {
                if (!confirm('确认解散团队？该操作不可恢复')) return;
                try { await this.api.teamDisband(this.currentTeamId); alert('团队已解散'); this.currentTeamId = null; this.render(); } catch (e) { alert(e.message || '操作失败'); }
            });
        }
        const quitBtn = document.getElementById('team-quit-btn');
        if (quitBtn && !quitBtn._bound) {
            quitBtn._bound = true;
            quitBtn.addEventListener('click', async () => {
                if (!confirm('确认退出该团队？')) return;
                try { await this.api.teamQuit(this.currentTeamId); alert('已退出团队'); this.currentTeamId = null; this.render(); } catch (e) { alert(e.message || '操作失败'); }
            });
        }

        // 拉取 summary 与排行榜
        (async () => {
            // 队长：拉取本团队待审批数量，更新按钮文案
            if (this.role === 'owner') {
                try {
                    const list = await this.api.teamApplyList(this.currentTeamId, 200);
                    const cnt = Array.isArray(list) ? list.length : 0;
                    const btn = document.getElementById('team-approve-open-btn');
                    if (btn) btn.textContent = `审批${cnt > 0 ? `(${cnt})` : ''}`;
                } catch (_) {}
            }
            // 统计指标
            try {
                const sum = await this.api.teamStatsSummary(this.currentTeamId);
                const setNum = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(Number(val || 0)); };
                setNum('metric-today-accept', sum?.todayAcceptCount);
                setNum('metric-seven-accept', sum?.sevenDaysAcceptCount);
                setNum('metric-total-accept', sum?.totalAcceptCount);
                setNum('metric-total-submission', sum?.totalSubmissionCount);
                // 同步 teamInfo 的当前人数与上限，供“满员”判断使用
                if (!this.teamInfo) this.teamInfo = {};
                this.teamInfo.memberCount = Number(sum?.memberCount || this.teamInfo.memberCount || 0);
                this.teamInfo.personLimit = Number(sum?.personLimit || this.teamInfo.personLimit || 0);
            } catch (_) {}
            try {
                const members = await this.api.teamMembers(this.currentTeamId);
                const box = document.getElementById('team-dashboard-members');
                if (box && Array.isArray(members)) {
                    const tableRows = members.map(m => {
                        const isOwner = (typeof m.role === 'number' ? m.role === 2 : String(m.role||'').toLowerCase()==='owner');
                        const uid = m.userId || m.id;
                        const name = m.name || (`用户${uid}`);
                        const avatar = m.headUrl || '';
                        const profileUrl = `https://www.nowcoder.com/users/${uid}`;
                        const crown = isOwner ? `<span title="队长" style="margin-left:6px;">👑</span>` : '';
                        const actionBtnHtml = (this.role === 'owner' && !isOwner)
                            ? `<button class="admin-btn team-btn-transfer" data-user-id="${uid}" style="margin-left:10px;">转让队长</button>
                               <button class="admin-btn team-btn-kick" data-user-id="${uid}" style="margin-left:6px;background:#ffecec;color:#e00;">踢出</button>`
                            : '';
                        return `
                            <tr style="border-bottom:1px dashed #f0f0f0;">
                                <td style="padding:8px 6px;">
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <img src="${avatar}" alt="avatar" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" />
                                        <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" style="color:#333;text-decoration:none;">${name}</a>
                                        ${crown}
                                        ${actionBtnHtml}
                                    </div>
                                </td>
                            </tr>`;
                    }).join('');
                    box.innerHTML = `
                        <div style="margin-bottom:6px; font-weight:600;">成员一览</div>
                        <table style="width:100%; border-collapse:collapse;">
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    `;
                    // 绑定行内操作（仅队长）
                    if (this.role === 'owner') {
                        document.querySelectorAll('.team-btn-kick').forEach(btn => {
                            if (btn._bound) return; btn._bound = true;
                            btn.addEventListener('click', async () => {
                                const uid = btn.getAttribute('data-user-id');
                                if (!uid) return;
                                if (!confirm('确认踢出该成员？')) return;
                                try { await this.api.teamDeleteMember(this.currentTeamId, uid); this.render(); } catch (e) { alert(e.message || '操作失败'); }
                            });
                        });
                        document.querySelectorAll('.team-btn-transfer').forEach(btn => {
                            if (btn._bound) return; btn._bound = true;
                            btn.addEventListener('click', async () => {
                                const uid = btn.getAttribute('data-user-id');
                                if (!uid) return;
                                if (!confirm('确认将队长转移给该成员？')) return;
                                try { await this.api.teamTransferOwner(this.currentTeamId, uid); alert('已转移队长'); this.render(); } catch (e) { alert(e.message || '操作失败'); }
                            });
                        });
                    }
                }
            } catch (_) {}
            try {
                const rows = await this.api.teamLeaderboard(this.currentTeamId, 20);
                const tb = document.getElementById('team-rankings-tbody');
                if (tb && Array.isArray(rows) && rows.length > 0) {
                    tb.innerHTML = rows.map(r => {
                        const rank = r.rank || '-';
                        const name = r.name || `用户${r.userId}`;
                        const ac = r.acceptCount != null ? r.acceptCount : '-';
                        const avatar = r.headUrl || '';
                        const nameCell = `<div style="display:flex;align-items:center;gap:8px;">
                            <img src="${avatar}" alt="avatar" style="width:20px;height:20px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" />
                            <span>${name}</span>
                        </div>`;
                        return `<tr><td>${rank}</td><td>${nameCell}</td><td>${ac}</td></tr>`;
                    }).join('');
                }
            } catch (_) {}
            // 队长：显示该团队待审批计数提醒
            try {
                if (this.role === 'owner') {
                    const applyList = await this.api.teamApplyList(this.currentTeamId, 100);
                    const alertBox = document.getElementById('team-dashboard-alerts');
                    if (alertBox) {
                        if (Array.isArray(applyList) && applyList.length > 0) {
                            alertBox.innerHTML = `<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:16px;background:#f6ffed;border:1px solid #b7eb8f;color:#135200;">有 ${applyList.length} 条入队申请待审批 <button id=\"team-approve-open-btn2\" class=\"admin-btn\" style=\"margin-left:6px;\">去审批</button></div>`;
                            const btn2 = document.getElementById('team-approve-open-btn2');
                            if (btn2 && !btn2._bound) { btn2._bound = true; btn2.addEventListener('click', () => { const b = document.getElementById('team-approve-open-btn'); if (b) b.click(); }); }
                        } else {
                            alertBox.innerHTML = '';
                        }
                    }
                }
            } catch (_) {}
        })();
    }

    async fetchAndRenderTeamList() {
        const tbody = document.getElementById('team-list-tbody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="5">加载中...</td></tr>`;
        try {
            const list = await this.api.teamListMy();
            this.myTeams = Array.isArray(list) ? list : [];
            // 排序：练习团队(1) 在上、ACM 团队(0) 在下；同类型按成员数降序
            const getCount = (t) => (t.memberCount != null ? t.memberCount : (t.personCount != null ? t.personCount : ((t.members || []).length || 0)));
            this.myTeams.sort((a, b) => {
                const ta = Number(a.teamType);
                const tb = Number(b.teamType);
                if (ta !== tb) return tb - ta; // 1(练习)优先，其次0(ACM)
                return getCount(b) - getCount(a); // 同类型按人数降序
            });
            if (!this.myTeams.length) {
                tbody.innerHTML = `<tr><td colspan="4">暂无团队，点击上方“创建团队”</td></tr>`;
                return;
            }
            tbody.innerHTML = this.myTeams.map(t => {
                const id = t.teamId || t.id || '';
                const name = t.name || t.teamName || '未命名团队';
                const desc = t.description || t.desc || '';
                const currentCount = (t.memberCount != null ? t.memberCount : (t.personCount != null ? t.personCount : ((t.members || []).length || '-')));
                const maxCount = (t.personLimit != null ? t.personLimit : (t.maxPerson != null ? t.maxPerson : 500));
                const teamType = Number(t.teamType);
                const typeLabel = (teamType === 0 ? 'ACM' : (teamType === 1 ? '练习' : ''));
                const typeBadge = typeLabel ? `<span class="team-type-badge ${teamType===0?'team-type-badge-acm':''}" style="display:inline-block;padding:2px 6px;border-radius:10px;font-size:12px;line-height:1;border:1px solid ${teamType===0?'#adc6ff':'#95de64'};color:${teamType===0?'#1d39c4':'#237804'};background:${teamType===0?'#f0f5ff':'#f6ffed'};cursor:${teamType===0?'help':'default'};">${typeLabel}</span>` : '';
                const role = (() => {
                    if (t.role) return String(t.role).toLowerCase();
                    const r = Number(t.myRole);
                    if (!isNaN(r)) {
                        if (r === 2) return 'owner';
                        if (r === 1) return 'admin';
                        return 'member';
                    }
                    return 'member';
                })();
                return `<tr>
                    <td><div style="display:flex;align-items:center;gap:8px;">${typeBadge}<span>${name}</span></div></td>
                    <td>${currentCount}/${maxCount}</td>
                    <td>${desc}</td>
                    <td><button class="admin-btn team-enter-btn" data-team-id="${id}" data-role="${role || 'member'}">进入</button></td>
                </tr>`;
            }).join('');
            // 渲染完成后再绑定事件
            this.bindTeamListActions();
            // 绑定 ACM 徽章提示
            this.bindAcmBadgesTooltip();
            // 更新“我的团队”页面顶部提醒
            try { await this.updateTeamHomeAlerts(); } catch (_) {}
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5">加载失败：${e.message || '请稍后重试'}</td></tr>`;
        }
    }

    bindTeamListActions() {
        // 进入团队（事件委托，避免异步渲染时丢绑定）
        const tbody = document.getElementById('team-list-tbody');
        if (tbody && !tbody._enterBound) {
            tbody._enterBound = true;
            tbody.addEventListener('click', (ev) => {
                const btn = ev.target && ev.target.closest && ev.target.closest('.team-enter-btn');
                if (!btn) return;
                const tid = btn.getAttribute('data-team-id');
                const role = btn.getAttribute('data-role') || 'member';
                this.currentTeamId = tid; // 选中团队
                this.role = role; // 切换视角
                const match = (this.myTeams || []).find(t => String(t.teamId || t.id) === String(tid));
                if (match) {
                    this.teamInfo = {
                        name: match.name || match.teamName || '我的团队',
                        desc: match.description || match.desc || '',
                        memberCount: (match.memberCount != null ? match.memberCount : (match.personCount != null ? match.personCount : ((match.members || []).length || '-'))),
                        personLimit: match.personLimit || 500,
                        teamId: String(tid)
                    };
                    // 同步基于 myRole 的角色
                    const r = Number(match.myRole);
                    if (!isNaN(r)) {
                        this.role = (r === 2) ? 'owner' : (r === 1 ? 'admin' : 'member');
                    }
                } else {
                    this.teamInfo = { name: '我的团队', desc: '', memberCount: '-' };
                }
                this.activeTeamTab = 'dashboard';
                this.render();
            });
        }

        // 创建团队（打开弹窗）
        const createBtn = document.getElementById('team-create-btn');
        if (createBtn && !createBtn._bound) {
            createBtn._bound = true;
            createBtn.addEventListener('click', async () => {
                const modal = document.getElementById('team-create-modal');
                if (!modal) return;
                modal.style.display = 'flex';
                const nameI = document.getElementById('team-create-name');
                const descI = document.getElementById('team-create-desc');
                if (nameI) { nameI.value = ''; setTimeout(() => nameI.focus(), 0); }
                if (descI) descI.value = '';
            });
        }

        // 创建团队弹窗：关闭
        const closeBtn = document.getElementById('team-create-close');
        if (closeBtn && !closeBtn._bound) {
            closeBtn._bound = true;
            closeBtn.addEventListener('click', () => {
                const modal = document.getElementById('team-create-modal');
                if (modal) modal.style.display = 'none';
            });
        }
        const cancelBtn = document.getElementById('team-create-cancel');
        if (cancelBtn && !cancelBtn._bound) {
            cancelBtn._bound = true;
            cancelBtn.addEventListener('click', () => {
                const modal = document.getElementById('team-create-modal');
                if (modal) modal.style.display = 'none';
            });
        }

        // 创建团队弹窗：确认
        const confirmBtn = document.getElementById('team-create-confirm');
        if (confirmBtn && !confirmBtn._bound) {
            confirmBtn._bound = true;
            confirmBtn.addEventListener('click', async () => {
                const nameI = document.getElementById('team-create-name');
                const descI = document.getElementById('team-create-desc');
                const name = (nameI?.value || '').trim();
                const desc = (descI?.value || '').trim();
                if (!name) {
                    alert('请填写团队名称');
                    nameI?.focus();
                    return;
                }
                try {
                    const res = await this.api.teamCreate(name, desc);
                    const newId = res?.teamId || res?.data?.teamId || null;
                    const modal = document.getElementById('team-create-modal');
                    if (modal) modal.style.display = 'none';
                    await this.fetchAndRenderTeamList();
                    if (newId) {
                        // 直接进入新团队，角色为 owner
                        this.currentTeamId = String(newId);
                        this.role = 'owner';
                        this.teamInfo = { name, desc, memberCount: 1 };
                        this.activeTeamTab = 'dashboard';
                        this.render();
                    }
                } catch (e) {
                    alert(e.message || '创建失败');
                }
            });
        }
    }

    async renderMembers() {
        const tbody = document.getElementById('team-members-tbody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="5">加载中...</td></tr>`;
        try {
            const list = await this.api.teamMembers(this.currentTeamId);
            if (!Array.isArray(list) || list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5">暂无成员</td></tr>`;
            } else {
                tbody.innerHTML = list.map(m => {
                    const name = m.nickname || m.name || `用户${m.userId}`;
                    const role = (() => {
                        const rv = m.role;
                        if (typeof rv === 'number') {
                            if (rv === 2) return 'owner';
                            if (rv === 1) return 'admin';
                            return 'member';
                        }
                        return String(rv || '').toLowerCase();
                    })();
                    const solves = (m.acceptCount != null ? m.acceptCount : (m.solveTotal != null ? m.solveTotal : '-'));
                    const checkins = (m.checkinTotal != null ? m.checkinTotal : '-');
                    const uid = m.userId || m.id;
                    return `<tr>
                        <td>${name}</td>
                        <td>${role || 'member'}</td>
                        <td>${solves}</td>
                        <td>${checkins}</td>
                        <td class="team-actions-cell">
                            <button class="admin-btn team-remove" data-user-id="${uid}" style="background:#ffecec;color:#e00;">删除</button>
                        </td>
                    </tr>`;
                }).join('');
            }
            // 绑定删除（仅队长可见）
            if (this.role !== 'owner') {
                document.querySelectorAll('#team-members .team-actions-cell, #team-members .team-remove, #team-invite-user-id, #team-invite-user-btn').forEach(el => {
                    if (el) el.style.display = 'none';
                });
                // 非管理者隐藏审批/邀请列表
                const applyT = document.getElementById('team-apply-list-tbody');
                const inviteT = document.getElementById('team-invite-list-tbody');
                if (applyT) applyT.parentElement.parentElement.style.display = 'none';
                if (inviteT) inviteT.parentElement.parentElement.style.display = 'none';
            } else {
                document.querySelectorAll('.team-remove').forEach(btn => {
                    if (btn._bound) return; btn._bound = true;
                    btn.addEventListener('click', async () => {
                        const uid = btn.getAttribute('data-user-id');
                        if (!uid) return;
                        if (!confirm('确认删除该成员？')) return;
                        try {
                            await this.api.teamDeleteMember(this.currentTeamId, uid);
                            this.renderMembers();
                        } catch (e) {
                            alert(e.message || '删除失败');
                        }
                    });
                });

                // 管理者：加载审批/邀请列表
                try {
                    const applyList = await this.api.teamApplyList(this.currentTeamId, 100);
                    const t = document.getElementById('team-apply-list-tbody');
                    if (t) {
                        if (Array.isArray(applyList) && applyList.length) {
                            t.innerHTML = applyList.map(a => {
                                const id = a.id || a.applyId || '';
                                const user = a.applyUserName || a.applyUid || '';
                                const avatar = a.applyUserHeadUrl || a.headUrl || '';
                                const solved = (a.acceptCount != null ? a.acceptCount : (a.solveTotal != null ? a.solveTotal : (a.ac != null ? a.ac : 0)));
                                const timeRaw = a.createTime || '';
                                const time = timeRaw ? (new Date(Number(timeRaw))).toISOString().slice(0,10) : '';
                                const userCell = `<div style=\"display:flex;align-items:center;gap:8px;\">\n                                        <img src=\"${avatar}\" alt=\"avatar\" style=\"width:24px;height:24px;border-radius:50%;object-fit:cover;\" onerror=\"this.style.display='none'\" />\n                                        <span>${user}</span>\n                                    </div>`;
                                return `<tr>\n                                    <td style=\"padding:8px 6px;min-width:240px;\">${userCell}</td><td>${solved}</td><td>${time}</td>\n                                    <td>\n                                        <button class=\"admin-btn team-apply-approve\" data-apply-id=\"${id}\">同意</button>\n                                        <button class=\"admin-btn team-apply-reject\" data-apply-id=\"${id}\" style=\"background:#ffecec;color:#e00;\">拒绝</button>\n                                    </td>\n                                </tr>`;
                            }).join('');
                        } else {
                            t.innerHTML = `<tr><td colspan=\"4\">暂无待审批</td></tr>`;
                        }
                    }
                } catch (_) {}

                try {
                    const inviteList = await this.api.teamInviteList(this.currentTeamId, 100);
                    const t2 = document.getElementById('team-invite-list-tbody');
                    if (t2) {
                        if (Array.isArray(inviteList) && inviteList.length) {
                            t2.innerHTML = inviteList.map(i => {
                                const id = i.id || '';
                                const user = i.applyUserName || i.applyUid || '';
                                const time = i.createTime || '';
                                return `<tr>
                                    <td>${id}</td><td>${user}</td><td>${time}</td>
                                    <td><button class="admin-btn team-invite-cancel" data-apply-id="${id}" style="background:#ffecec;color:#e00;">撤销</button></td>
                                </tr>`;
                            }).join('');
                        } else {
                            t2.innerHTML = `<tr><td colspan="4">暂无待接受</td></tr>`;
                        }
                    }
                } catch (_) {}

                // 绑定审批按钮
                document.querySelectorAll('.team-apply-approve').forEach(btn => {
                    if (btn._bound) return; btn._bound = true;
                    btn.addEventListener('click', async () => {
                        const id = btn.getAttribute('data-apply-id');
                        try { await this.api.teamApplyApprove(id); this.renderMembers(); } catch (e) { alert(e.message || '操作失败'); }
                    });
                });
                document.querySelectorAll('.team-apply-reject').forEach(btn => {
                    if (btn._bound) return; btn._bound = true;
                    btn.addEventListener('click', async () => {
                        const id = btn.getAttribute('data-apply-id');
                        try { await this.api.teamApplyReject(id); this.renderMembers(); } catch (e) { alert(e.message || '操作失败'); }
                    });
                });

                document.querySelectorAll('.team-invite-cancel').forEach(btn => {
                    if (btn._bound) return; btn._bound = true;
                    btn.addEventListener('click', async () => {
                        const id = btn.getAttribute('data-apply-id');
                        if (!confirm('确认撤销该邀请？')) return;
                        try { await this.api.teamInviteCancel(id); this.renderMembers(); } catch (e) { alert(e.message || '操作失败'); }
                    });
                });
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5">加载失败：${e.message || '请稍后重试'}</td></tr>`;
        }
    }

    async renderMyApplies() {
        const tbody = document.getElementById('team-my-apply-tbody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="4">加载中...</td></tr>`;
        try {
            const list = await this.api.teamMyApplies();
            if (!Array.isArray(list) || list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5">暂无数据</td></tr>`;
            } else {
                const fmtYmd = (t) => {
                    const ts = Number(t);
                    if (!ts) return '';
                    const d = new Date(ts);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const hh = String(d.getHours()).padStart(2, '0');
                    const mi = String(d.getMinutes()).padStart(2, '0');
                    return `${y}年${m}月${day}日 ${hh}:${mi}`;
                };
                tbody.innerHTML = list.map(a => {
                    const id = a.id || a.applyId || '';
                    const team = a.teamName || a.teamId || '';
                    const time = fmtYmd(a.createTime);
                    const s = String(a.statusText || '').toUpperCase();
                    const status = (s === 'INIT') ? '待审批' : (s === 'ACCEPTED' ? '已通过' : (s === 'REJECT' ? '已拒绝' : (a.statusText || '待审批')));
                    return `<tr><td>${id}</td><td>${team}</td><td>${time}</td><td>${status}</td></tr>`;
                }).join('');
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4">加载失败：${e.message || '请稍后重试'}</td></tr>`;
        }
    }

    async renderMyInvites() {
        const tbody = document.getElementById('team-my-invite-tbody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="4">加载中...</td></tr>`;
        try {
            const list = await this.api.teamMyInvites();
            if (!Array.isArray(list) || list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4">暂无数据</td></tr>`;
            } else {
                const fmtYmd = (t) => {
                    const ts = Number(t);
                    if (!ts) return '';
                    const d = new Date(ts);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const hh = String(d.getHours()).padStart(2, '0');
                    const mi = String(d.getMinutes()).padStart(2, '0');
                    return `${y}年${m}月${day}日 ${hh}:${mi}`;
                };
                tbody.innerHTML = list.map(i => {
                    const id = i.id || i.applyId || '';
                    const team = i.teamName || i.teamId || '';
                    const time = fmtYmd(i.createTime);
                    const ownerName = i.ownerName || i.ownerUserName || '';
                    const ownerHead = i.ownerHeadUrl || '';
                    const teamType = Number(i.teamType);
                    const typeLabel = (teamType === 0 ? 'ACM' : (teamType === 1 ? '练习' : ''));
                    const typeBadge = typeLabel ? `<span class="team-type-badge ${teamType===0?'team-type-badge-acm':''}" style="display:inline-block;padding:2px 6px;border-radius:10px;font-size:12px;line-height:1;border:1px solid ${teamType===0?'#adc6ff':'#95de64'};color:${teamType===0?'#1d39c4':'#237804'};background:${teamType===0?'#f0f5ff':'#f6ffed'};cursor:${teamType===0?'help':'default'};">${typeLabel}</span>` : '';
                    const teamCell = `<div style="display:flex;align-items:center;gap:8px;">${typeBadge}<span>${team}</span></div>`;
                    const ownerCell = (ownerName || ownerHead) ? `
                        <div style="display:flex;align-items:center;gap:6px;">
                            ${ownerHead ? `<img src="${ownerHead}" alt="owner" style="width:20px;height:20px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" />` : ''}
                            <span>${ownerName || '-'}</span>
                        </div>` : '-';
                    return `<tr>
                        <td>${id}</td><td>${teamCell}</td><td>${ownerCell}</td><td>${time}</td>
                        <td>
                            <button class="admin-btn my-invite-accept" data-apply-id="${id}">接受</button>
                            <button class="admin-btn my-invite-decline" data-apply-id="${id}" style="background:#ffecec;color:#e00;">拒绝</button>
                        </td>
                    </tr>`;
                }).join('');
                // 绑定操作
                document.querySelectorAll('.my-invite-accept').forEach(btn => {
                    if (btn._bound) return; btn._bound = true;
                    btn.addEventListener('click', async () => {
                        const id = btn.getAttribute('data-apply-id');
                        try { await this.api.teamInviteAccept(id); this.renderMyInvites(); } catch (e) { alert(e.message || '操作失败'); }
                    });
                });
                document.querySelectorAll('.my-invite-decline').forEach(btn => {
                    if (btn._bound) return; btn._bound = true;
                    btn.addEventListener('click', async () => {
                        const id = btn.getAttribute('data-apply-id');
                        try { await this.api.teamInviteDecline(id); this.renderMyInvites(); } catch (e) { alert(e.message || '操作失败'); }
                    });
                });
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4">加载失败：${e.message || '请稍后重试'}</td></tr>`;
        }
    }

    async renderLeaderboard() {
        const tb = document.getElementById('team-rankings-tbody');
        if (!tb) return;
        // 绑定子页签
        const tabs = document.querySelectorAll('#team-leaderboard .team-rank-tab');
        tabs.forEach(btn => {
            if (btn._bound) return; btn._bound = true;
            btn.addEventListener('click', () => {
                tabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const metric = btn.getAttribute('data-metric') || 'solve_total';
                this.teamLeaderboardMetric = metric;
                this.teamLeaderboardPage = 1; // 切换指标重置页码
                this.loadLeaderboard(metric);
            });
        });

        // 绑定分页按钮
        const prevBtn = document.getElementById('teamLeaderboardPrev');
        const nextBtn = document.getElementById('teamLeaderboardNext');
        const sizeSel = document.getElementById('teamLeaderboardPageSize');
        if (prevBtn && !prevBtn._bound) {
            prevBtn._bound = true;
            prevBtn.addEventListener('click', () => {
                if (this.teamLeaderboardPage > 1) {
                    this.teamLeaderboardPage -= 1;
                    this.loadLeaderboard(this.teamLeaderboardMetric);
                }
            });
        }
        if (nextBtn && !nextBtn._bound) {
            nextBtn._bound = true;
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.max(1, Math.ceil(this.teamLeaderboardTotal / this.teamLeaderboardLimit));
                if (this.teamLeaderboardPage < totalPages) {
                    this.teamLeaderboardPage += 1;
                    this.loadLeaderboard(this.teamLeaderboardMetric);
                }
            });
        }
        if (sizeSel && !sizeSel._bound) {
            sizeSel._bound = true;
            sizeSel.value = String(this.teamLeaderboardLimit);
            sizeSel.addEventListener('change', () => {
                const v = Number(sizeSel.value) || 20;
                this.teamLeaderboardLimit = Math.max(1, v);
                this.teamLeaderboardPage = 1; // 改变每页条数重置到第一页
                this.loadLeaderboard(this.teamLeaderboardMetric);
            });
        }

        // 默认加载
        this.loadLeaderboard(this.teamLeaderboardMetric || 'solve_total');
    }

    /**
     * 我的团队页：顶部提醒（待处理邀请/待审批申请）
     */
    async updateTeamHomeAlerts() {
        const container = document.getElementById('team-list');
        if (!container) return;
        const card = container.querySelector('.achv-overview-card');
        const anchor = document.getElementById('team-home-my');
        if (!card || !anchor) return;

        let banner = document.getElementById('team-alert-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'team-alert-banner';
            banner.style.margin = '8px 0';
            card.insertBefore(banner, anchor);
        }

        // 1) 用户侧：邀请我的团队数量
        let inviteCount = 0;
        try {
            const invites = await this.api.teamMyInvites();
            inviteCount = Array.isArray(invites) ? invites.length : 0;
        } catch (_) {}

        if (inviteCount === 0) {
            banner.style.display = 'none';
            banner.innerHTML = '';
            return;
        }

        banner.style.display = 'block';
        banner.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;"><span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:16px;background:#fff7e6;border:1px solid #ffd591;color:#ad4e00;">有 ${inviteCount} 条团队邀请待处理 <button id=\"go-my-invites\" class=\"admin-btn\" style=\"margin-left:6px;\">去查看</button></span></div>`;

        // 交互：跳转到“邀请我的团队”
        const goInv = document.getElementById('go-my-invites');
        if (goInv && !goInv._bound) {
            goInv._bound = true;
            goInv.addEventListener('click', () => {
                const tabBtn = document.getElementById('team-home-tab-invited');
                if (tabBtn) tabBtn.click();
            });
        }
    }

    async loadLeaderboard(metric) {
        const tb = document.getElementById('team-rankings-tbody');
        if (!tb) return;
        tb.innerHTML = `<tr><td colspan="3">加载中...</td></tr>`;
        // metric 支持：solve_total | solve_7days | solve_today
        try {
            const type = (() => {
                switch (metric) {
                    case 'solve_today': return 'today';
                    case 'solve_7days':
                    case 'solve_7d':
                        return '7days';
                    case 'solve_total':
                    default: return 'total';
                }
            })();
            const result = await this.api.teamLeaderboard(this.currentTeamId, this.teamLeaderboardLimit, type, this.teamLeaderboardPage);
            const rows = (result && Array.isArray(result.list)) ? result.list : (Array.isArray(result) ? result : []);
            this.teamLeaderboardTotal = (result && typeof result.total === 'number') ? result.total : 0; // 0 表示未知总数（旧接口）

            if (Array.isArray(rows) && rows.length > 0) {
                tb.innerHTML = rows.map(r => {
                    const rank = r.rank || '-';
                    const name = r.name || `用户${r.userId}`;
                    const ac = r.acceptCount != null ? r.acceptCount : '-';
                    const avatar = r.headUrl || '';
                    const nameCell = `<div style="display:flex;align-items:center;gap:8px;">
                        <img src="${avatar}" alt="avatar" style="width:20px;height:20px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" />
                        <span>${name}</span>
                    </div>`;
                    return `<tr><td>${rank}</td><td>${nameCell}</td><td>${ac}</td></tr>`;
                }).join('');
            } else {
                tb.innerHTML = `<tr><td colspan="3">暂无数据</td></tr>`;
            }

            // 刷新分页信息
            const info = document.getElementById('teamLeaderboardPaginationInfo');
            const pageText = document.getElementById('teamLeaderboardPage');
            const prevBtn = document.getElementById('teamLeaderboardPrev');
            const nextBtn = document.getElementById('teamLeaderboardNext');
            if (this.teamLeaderboardTotal > 0) {
                const totalPages = Math.max(1, Math.ceil(this.teamLeaderboardTotal / this.teamLeaderboardLimit));
                if (info) info.textContent = `共 ${this.teamLeaderboardTotal} 条`;
                if (pageText) pageText.textContent = `第 ${this.teamLeaderboardPage} / ${totalPages} 页`;
                if (prevBtn) prevBtn.disabled = this.teamLeaderboardPage <= 1;
                if (nextBtn) nextBtn.disabled = this.teamLeaderboardPage >= totalPages;
            } else {
                // 兼容旧接口（无 total）——仅根据当前页数据是否满页来判断是否还有下一页
                const hasNext = rows.length === this.teamLeaderboardLimit;
                if (info) info.textContent = '';
                if (pageText) pageText.textContent = `第 ${this.teamLeaderboardPage} 页`;
                if (prevBtn) prevBtn.disabled = this.teamLeaderboardPage <= 1;
                if (nextBtn) nextBtn.disabled = !hasNext;
            }
        } catch (e) {
            tb.innerHTML = `<tr><td colspan="3">加载失败：${e.message || '请稍后重试'}</td></tr>`;
        }
    }

    async renderApproveList() {
        const tbody = document.getElementById('team-approve-tbody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="4">加载中...</td></tr>`;
        try {
            const applyList = await this.api.teamApplyList(this.currentTeamId, 100);
            if (Array.isArray(applyList) && applyList.length) {
                tbody.innerHTML = applyList.map(a => {
                    const id = a.id || a.applyId || '';
                    const user = a.applyUserName || a.applyUid || '';
                    const avatar = a.applyUserHeadUrl || a.headUrl || '';
                    const solved = (a.acceptCount != null ? a.acceptCount : (a.solveTotal != null ? a.solveTotal : (a.ac != null ? a.ac : 0)));
                    const timeRaw = a.createTime || '';
                    const time = timeRaw ? (new Date(Number(timeRaw))).toISOString().slice(0,10) : '';
                    const userCell = `<div style=\"display:flex;align-items:center;gap:8px;\">\n                            <img src=\"${avatar}\" alt=\"avatar\" style=\"width:24px;height:24px;border-radius:50%;object-fit:cover;\" onerror=\"this.style.display='none'\" />\n                            <span>${user}</span>\n                        </div>`;
                    return `<tr>\n                        <td style=\"padding:8px 6px;min-width:240px;\">${userCell}</td><td>${solved}</td><td>${time}</td>\n                        <td>\n                            <button class=\"admin-btn modal-apply-approve\" data-apply-id=\"${id}\">通过</button>\n                            <button class=\"admin-btn modal-apply-reject\" data-apply-id=\"${id}\" style=\"background:#ffecec;color:#e00;\">拒绝</button>\n                        </td>\n                    </tr>`;
                }).join('');
                document.querySelectorAll('.modal-apply-approve').forEach(btn => {
                    if (btn._bound) return; btn._bound = true;
                    btn.addEventListener('click', async () => { const id = btn.getAttribute('data-apply-id'); try { await this.api.teamApplyApprove(id); await this.renderApproveList(); } catch (e) { alert(e.message || '操作失败'); } });
                });
                document.querySelectorAll('.modal-apply-reject').forEach(btn => {
                    if (btn._bound) return; btn._bound = true;
                    btn.addEventListener('click', async () => { const id = btn.getAttribute('data-apply-id'); try { await this.api.teamApplyReject(id); await this.renderApproveList(); } catch (e) { alert(e.message || '操作失败'); } });
                });
            } else {
                tbody.innerHTML = `<tr><td colspan=\"4\">暂无待审批</td></tr>`;
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan=\"4\">加载失败：${e.message || '请稍后重试'}</td></tr>`;
        }
    }
}


