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

        this.bindEvents();
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

        // 若未选择团队，展示团队列表
        const listView = document.getElementById('team-list');
        const subTabs = document.getElementById('team-subtabs');
        if (!this.currentTeamId) {
            if (subTabs) subTabs.style.display = 'none';
            if (listView) listView.style.display = 'block';
            // 隐藏子视图
            ['team-dashboard','team-members','team-settings','team-invites'].forEach(id => {
                const el = document.getElementById(id); if (el) el.style.display = 'none';
            });
            this.fetchAndRenderTeamList();
            this.bindTeamHomeTabs();
            this.bindTeamListActions();
            return;
        }

        // 已选择团队：显示子标签与对应视图
        if (subTabs) subTabs.style.display = 'flex';
        if (listView) listView.style.display = 'none';

        const map = {
            dashboard: this.elements.teamDashboard,
            members: this.elements.teamMembers,
            settings: this.elements.teamSettings,
            invites: this.elements.teamInvites
        };
        Object.values(map).forEach(el => { if (el) el.style.display = 'none'; });
        if (map[this.activeTeamTab]) map[this.activeTeamTab].style.display = 'block';

        switch (this.activeTeamTab) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'members':
                this.renderMembers();
                break;
            case 'settings':
                this.renderSettings();
                break;
            case 'invites':
                this.renderInvites();
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

        const saveBtn = document.getElementById('team-save-btn');
        if (saveBtn && !saveBtn._bound) {
            saveBtn._bound = true;
            saveBtn.addEventListener('click', async () => {
                const name = document.getElementById('team-name-input')?.value || '';
                const desc = document.getElementById('team-desc-input')?.value || '';
                try {
                    await this.api.teamUpdate(this.currentTeamId, name, desc);
                    alert('已保存');
                    this.teamInfo = { ...(this.teamInfo || {}), name, desc };
                    // 更新概览中的资料卡
                    this.activeTeamTab = 'dashboard';
                    this.render();
                } catch (e) {
                    alert(e.message || '保存失败');
                }
            });
        }

        const createInviteBtn = document.getElementById('team-create-invite-btn');
        if (createInviteBtn && !createInviteBtn._bound) {
            createInviteBtn._bound = true;
            createInviteBtn.addEventListener('click', async () => {
                try {
                    const data = await this.api.teamInviteCreate(this.currentTeamId);
                    const link = data.inviteLink || data.url || '';
                    const span = document.getElementById('team-invite-created');
                    if (span) span.textContent = `邀请链接：${link}`;
                } catch (e) {
                    alert(e.message || '生成邀请失败');
                }
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
        const info = this.teamInfo || { name: '我的团队', desc: '团队简介', memberCount: '--' };
        const canEdit = (this.role === 'owner');
        const editBtn = canEdit ? `<button id="team-edit-entry-btn" class="admin-btn" style="margin-left:8px;">编辑资料</button>` : '';
        metrics.innerHTML = `
            <div class="achv-overview-card" style="min-width:280px; margin-bottom:12px;">
                <div class="achv-overview-title">团队资料</div>
                <div><b>名称：</b>${info.name}${editBtn}</div>
                <div style="margin-top:4px;"><b>简介：</b>${info.desc}</div>
                <div style="margin-top:4px;"><b>成员数：</b>${info.memberCount}</div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <div class="achv-overview-card" style="min-width:180px;flex:1;">
                    <div class="achv-overview-title">今日过题</div>
                    <div class="achv-overview-value" id="team-metric-solve-today">--</div>
                </div>
                <div class="achv-overview-card" style="min-width:180px;flex:1;">
                    <div class="achv-overview-title">7日过题</div>
                    <div class="achv-overview-value" id="team-metric-solve-7d">--</div>
                </div>
                <div class="achv-overview-card" style="min-width:180px;flex:1;">
                    <div class="achv-overview-title">历史过题</div>
                    <div class="achv-overview-value" id="team-metric-solve-total">--</div>
                </div>
                <div class="achv-overview-card" style="min-width:220px;flex:1;">
                    <div class="achv-overview-title">技能树·第一章通关率</div>
                    <div class="achv-overview-value">--%</div>
                </div>
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
                this.activeTeamTab = 'settings';
                this.render();
            });
        }

        // 拉取 summary 与排行榜
        (async () => {
            try {
                const sum = await this.api.teamStatsSummary(this.currentTeamId);
                const total = Number(sum.totalAcceptCount || 0);
                const totalEl = document.getElementById('team-metric-solve-total');
                if (totalEl) totalEl.textContent = String(total);
                const todayEl = document.getElementById('team-metric-solve-today');
                if (todayEl) todayEl.textContent = String(Number(sum.todayAcceptCount || 0));
                const sevenEl = document.getElementById('team-metric-solve-7d');
                if (sevenEl) sevenEl.textContent = String(Number(sum.sevenDaysAcceptCount || 0));
            } catch (_) {}
            try {
                const rows = await this.api.teamLeaderboard(this.currentTeamId, 20);
                const tb = document.getElementById('team-rankings-tbody');
                if (tb && Array.isArray(rows) && rows.length > 0) {
                    tb.innerHTML = rows.map(r => {
                        const rank = r.rank || '-';
                        const name = r.name || `用户${r.userId}`;
                        const ac = r.acceptCount != null ? r.acceptCount : '-';
                        return `<tr><td>${rank}</td><td>${name}</td><td>${ac}</td></tr>`;
                    }).join('');
                }
            } catch (_) {}
        })();
    }

    async fetchAndRenderTeamList() {
        const tbody = document.getElementById('team-list-tbody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="4">加载中...</td></tr>`;
        try {
            const list = await this.api.teamListMy();
            this.myTeams = Array.isArray(list) ? list : [];
            if (!this.myTeams.length) {
                tbody.innerHTML = `<tr><td colspan="4">暂无团队，点击上方“创建团队”</td></tr>`;
                return;
            }
            tbody.innerHTML = this.myTeams.map(t => {
                const id = t.teamId || t.id || '';
                const name = t.name || t.teamName || '未命名团队';
                const desc = t.description || t.desc || '';
                const memberCount = (t.memberCount != null ? t.memberCount : (t.personCount != null ? t.personCount : ((t.members || []).length || '-')));
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
                    <td>${name}</td>
                    <td>${memberCount}</td>
                    <td>${desc}</td>
                    <td><button class="admin-btn team-enter-btn" data-team-id="${id}" data-role="${role || 'member'}">进入</button></td>
                </tr>`;
            }).join('');
            // 渲染完成后再绑定事件
            this.bindTeamListActions();
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4">加载失败：${e.message || '请稍后重试'}</td></tr>`;
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
                        memberCount: (match.memberCount != null ? match.memberCount : (match.personCount != null ? match.personCount : ((match.members || []).length || '-')))
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
                                const msg = a.message || '';
                                const time = a.createTime || '';
                                return `<tr>
                                    <td>${id}</td><td>${user}</td><td>${msg}</td><td>${time}</td>
                                    <td>
                                        <button class="admin-btn team-apply-approve" data-apply-id="${id}">同意</button>
                                        <button class="admin-btn team-apply-reject" data-apply-id="${id}" style="background:#ffecec;color:#e00;">拒绝</button>
                                    </td>
                                </tr>`;
                            }).join('');
                        } else {
                            t.innerHTML = `<tr><td colspan="5">暂无待审批</td></tr>`;
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
                                    <td><button class=\"admin-btn team-invite-cancel\" data-apply-id=\"${id}\" style=\"background:#ffecec;color:#e00;\">撤销</button></td>
                                </tr>`;
                            }).join('');
                        } else {
                            t2.innerHTML = `<tr><td colspan=\"4\">暂无待接受</td></tr>`;
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
        tbody.innerHTML = `<tr><td colspan="5">加载中...</td></tr>`;
        try {
            const list = await this.api.teamMyApplies();
            if (!Array.isArray(list) || list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5">暂无数据</td></tr>`;
            } else {
                tbody.innerHTML = list.map(a => {
                    const id = a.id || a.applyId || '';
                    const team = a.teamName || a.teamId || '';
                    const msg = a.message || '';
                    const time = a.createTime || '';
                    const status = a.statusText || '待审核';
                    return `<tr><td>${id}</td><td>${team}</td><td>${msg}</td><td>${time}</td><td>${status}</td></tr>`;
                }).join('');
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5">加载失败：${e.message || '请稍后重试'}</td></tr>`;
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
                tbody.innerHTML = list.map(i => {
                    const id = i.id || i.applyId || '';
                    const team = i.teamName || i.teamId || '';
                    const time = i.createTime || '';
                    return `<tr>
                        <td>${id}</td><td>${team}</td><td>${time}</td>
                        <td>
                            <button class=\"admin-btn my-invite-accept\" data-apply-id=\"${id}\">接受</button>
                            <button class=\"admin-btn my-invite-decline\" data-apply-id=\"${id}\" style=\"background:#ffecec;color:#e00;\">拒绝</button>
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

    renderSettings() {
        // 显示表单即可，数据填充留待接后端
        const nameInput = document.getElementById('team-name-input');
        const descInput = document.getElementById('team-desc-input');
        if (nameInput) nameInput.value = this.teamInfo?.name || '';
        if (descInput) descInput.value = this.teamInfo?.desc || '';
        // 普通成员视角：隐藏保存按钮
        if (this.role !== 'owner' && this.role !== 'admin') {
            const saveBtn = document.getElementById('team-save-btn');
            if (saveBtn) saveBtn.style.display = 'none';
            const transferBtn = document.getElementById('team-transfer-btn');
            if (transferBtn) transferBtn.style.display = 'none';
        }
    }

    async renderInvites() {
        // 显示现有邀请链接
        try {
            const data = await this.api.teamInviteGet(this.currentTeamId);
            const link = (typeof data === 'string') ? data : (data.inviteLink || data.url || '');
            const span = document.getElementById('team-invite-created');
            if (span && link) span.textContent = `邀请链接：${link}`;
        } catch (_) {}
        // 普通成员：隐藏生成邀请按钮
        if (this.role !== 'owner' && this.role !== 'admin') {
            const btn = document.getElementById('team-create-invite-btn');
            if (btn) btn.style.display = 'none';
        }
    }
}


