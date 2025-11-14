/**
 * 活动页面视图模块
 * 处理活动相关的UI和逻辑
 */
import { eventBus, EVENTS } from '../events/EventBus.js';

export class ActivityView {
    constructor(elements, state, api) {
        this.elements = elements;
        this.state = state;
        this.api = api;
        this.container = this.elements.activityContainer;
        this.activitySubTab = 'intro';
        this.activityRankPage = 1;
        this.activityRankLimit = 20;
        this.activityRankTotal = 0;
    }

    render() {
        if (!this.container) return;
        
        this.renderActivity();
    }

    async renderActivity() {
        const box = document.getElementById('activity-content');
        if (!box) return;
        
        // 初始化默认子标签
        if (!this.activitySubTab) this.activitySubTab = 'intro';
        
        // 绑定子标签点击
        const subTabs = document.querySelectorAll('#activity-subtabs .activity-tab');
        subTabs.forEach(btn => {
            if (btn._bound) return; 
            btn._bound = true;
            btn.addEventListener('click', () => {
                subTabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activitySubTab = btn.getAttribute('data-activity') || 'intro';
                this.renderActivityPanel();
            });
        });
        
        // 首次渲染面板
        this.renderActivityPanel();
    }

    async renderActivityPanel() {
        const box = document.getElementById('activity-content');
        if (!box) return;
        const tab = this.activitySubTab || 'intro';
        
        // 活动说明（静态文案）
        const infoHtml = `
            <div>
                组织 <strong>校内</strong> 同学刷题，可领取牛客娘周边奖励。
            </div>
            <div><br /></div>
            <div>
                活动时间：2025年11月1日-2026年2月28日。
            </div>
            <div><br /></div>
            <div>
                <strong>负责人奖励：</strong>活动期内，团队"每日一题"累计打卡 ≥ 500 人次，每人次负责人可获得 2 牛币奖励。
            </div>
            <div><br /></div>
            <div>
                <strong>刷题学生奖励：</strong> 
                <div>
                    <p>【每日一题】</p>
                    <p>每日一题累计打卡 ≥ 30 天的同学，可获得牛客娘贴纸一张。</p>
                    <p>每日一题累计打卡 ≥ 60 天的同学，可获得牛客娘吧唧一个。</p>
                    <p>每日一题累计打卡 ≥ 100 天的同学，可获得牛客娘马克杯一个。</p>
                    <p>*以上奖励可叠加。</p>
                </div>
                <div>
                    <p>【题库题单】</p>
                    <p>完成新手入门 130、算法入门、算法进阶、算法登峰的同学，每组题单分别可获得牛客娘吧唧一个。</p>
                </div>
                <div>
                    <p>【技能树】</p>
                    <p>完成技能树第一章、第二章全部题目的同学，每章可获得牛客娘鼠标垫一个。</p>
                    <div>完成技能树间章全部题目的同学，可获得牛客娘贴纸一张。</div>
                </div>
            </div>
            <div><br /></div>
            <div>
                <a href="https://ac.nowcoder.com/discuss/1581941" target="_blank" style="color:#1890ff;text-decoration:none;font-weight:600;">点击报名</a>
            </div>
        `;
        
        if (tab === 'intro') {
            box.innerHTML = infoHtml;
            return;
        }
        
        if (tab === 'rank') {
            try {
                const { list = [], total = 0 } = await this.api.teamActivityTeamsLeaderboard(this.activityRankPage || 1, this.activityRankLimit || 20);
                this.activityRankTotal = total;
                const totalPages = Math.max(1, Math.ceil(total / (this.activityRankLimit || 20)));
                box.innerHTML = `
                    <div style="font-weight:700;margin-bottom:6px;">卷王团队一览</div>
                    <div style="color:#888;margin-bottom:6px;">这里展示的团队并非全部是参与活动的团队，具体参与活动请以学校为单位，按"活动说明"报名。</div>
                    <table class="rankings-table">
                        <thead>
                            <tr>
                                <th>团队</th>
                                <th>成员数</th>
                                <th>活动打卡总人次</th>
                                <th>≥30</th>
                                <th>≥60</th>
                                <th>≥100</th>
                                <th>130制霸</th>
                                <th>入门制霸</th>
                                <th>进阶制霸</th>
                                <th>登峰制霸</th>
                                <th>第一章</th>
                                <th>间章</th>
                                <th>第二章</th>
                            </tr>
                        </thead>
                        <tbody id="activity-rank-tbody">${Array.isArray(list) && list.length ? list.map(r => {
                            const team = r.teamName || r.teamId || '-';
                            const members = r.memberCount != null ? r.memberCount : '-';
                            const clock = r.clockTotalTimes != null ? r.clockTotalTimes : '-';
                            const newbie = (r.topicFinished && typeof r.topicFinished.newbie130?.count === 'number') ? r.topicFinished.newbie130.count : '-';
                            const intro = (r.topicFinished && typeof r.topicFinished.intro?.count === 'number') ? r.topicFinished.intro.count : '-';
                            const advanced = (r.topicFinished && typeof r.topicFinished.advanced?.count === 'number') ? r.topicFinished.advanced.count : '-';
                            const peak = (r.topicFinished && typeof r.topicFinished.peak?.count === 'number') ? r.topicFinished.peak.count : '-';
                            const ge30 = r.ge30Count != null ? r.ge30Count : '-';
                            const ge60 = r.ge60Count != null ? r.ge60Count : '-';
                            const ge100 = r.ge100Count != null ? r.ge100Count : '-';
                            const ch1 = (r.skillFinished && typeof r.skillFinished.chapter1?.count === 'number') ? r.skillFinished.chapter1.count : '-';
                            const inter = (r.skillFinished && typeof r.skillFinished.interlude?.count === 'number') ? r.skillFinished.interlude.count : '-';
                            const ch2 = (r.skillFinished && typeof r.skillFinished.chapter2?.count === 'number') ? r.skillFinished.chapter2.count : '-';
                            return `<tr>
                                <td>${team}</td>
                                <td>${members}</td>
                                <td>${clock}</td>
                                <td>${ge30}</td>
                                <td>${ge60}</td>
                                <td>${ge100}</td>
                                <td>${newbie}</td>
                                <td>${intro}</td>
                                <td>${advanced}</td>
                                <td>${peak}</td>
                                <td>${ch1}</td>
                                <td>${inter}</td>
                                <td>${ch2}</td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="13">暂无数据</td></tr>`}</tbody>
                    </table>
                    <div id="activity-rank-pagination" class="pagination" style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span>每页</span>
                            <select id="activityRankPageSize" class="pagination-select" style="padding:4px 6px;">
                                <option value="10" ${(this.activityRankLimit || 20) === 10 ? 'selected' : ''}>10</option>
                                <option value="20" ${(this.activityRankLimit || 20) === 20 ? 'selected' : ''}>20</option>
                                <option value="50" ${(this.activityRankLimit || 20) === 50 ? 'selected' : ''}>50</option>
                                <option value="100" ${(this.activityRankLimit || 20) === 100 ? 'selected' : ''}>100</option>
                            </select>
                            <span>条</span>
                            <div id="activityRankPaginationInfo" class="pagination-info">共 ${total} 支团队，第 ${this.activityRankPage || 1} / ${totalPages} 页</div>
                        </div>
                        <div class="pagination-controls" style="display:flex;align-items:center;gap:8px;">
                            <button id="activityRankPrev" class="pagination-btn" ${(this.activityRankPage || 1) <= 1 ? 'disabled' : ''}>上一页</button>
                            <span style="margin:0 4px;">第</span>
                            <input type="number" id="activityRankPageInput" min="1" max="${totalPages}" value="${this.activityRankPage || 1}" style="width:60px;padding:4px 6px;text-align:center;border:1px solid #ddd;border-radius:4px;" />
                            <span style="margin:0 4px;">/ ${totalPages} 页</span>
                            <button id="activityRankJump" class="pagination-btn" style="margin-left:4px;">跳转</button>
                            <button id="activityRankNext" class="pagination-btn" ${(this.activityRankPage || 1) >= totalPages ? 'disabled' : ''}>下一页</button>
                        </div>
                    </div>
                `;
                // 绑定分页事件
                this.bindActivityRankPagination();
            } catch (e) {
                box.innerHTML = `<div style="color:#888;">加载榜单失败：${e.message || '请稍后重试'}</div>`;
            }
            return;
        }
    }

    bindActivityRankPagination() {
        const prevBtn = document.getElementById('activityRankPrev');
        const nextBtn = document.getElementById('activityRankNext');
        const sizeSel = document.getElementById('activityRankPageSize');
        const pageInput = document.getElementById('activityRankPageInput');
        const jumpBtn = document.getElementById('activityRankJump');
        
        if (prevBtn && !prevBtn._bound) {
            prevBtn._bound = true;
            prevBtn.addEventListener('click', () => {
                if ((this.activityRankPage || 1) > 1) {
                    this.activityRankPage = (this.activityRankPage || 1) - 1;
                    this.renderActivityPanel();
                }
            });
        }
        
        if (nextBtn && !nextBtn._bound) {
            nextBtn._bound = true;
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.max(1, Math.ceil((this.activityRankTotal || 0) / (this.activityRankLimit || 20)));
                if ((this.activityRankPage || 1) < totalPages) {
                    this.activityRankPage = (this.activityRankPage || 1) + 1;
                    this.renderActivityPanel();
                }
            });
        }
        
        if (sizeSel && !sizeSel._bound) {
            sizeSel._bound = true;
            sizeSel.value = String(this.activityRankLimit || 20);
            sizeSel.addEventListener('change', () => {
                const v = Number(sizeSel.value) || 20;
                this.activityRankLimit = Math.max(1, v);
                this.activityRankPage = 1;
                this.renderActivityPanel();
            });
        }
        
        // 页码输入框和跳转按钮
        const handleJump = () => {
            if (!pageInput) return;
            const totalPages = Math.max(1, Math.ceil((this.activityRankTotal || 0) / (this.activityRankLimit || 20)));
            let targetPage = Number(pageInput.value) || 1;
            // 限制在有效范围内
            targetPage = Math.max(1, Math.min(targetPage, totalPages));
            if (targetPage !== (this.activityRankPage || 1)) {
                this.activityRankPage = targetPage;
                this.renderActivityPanel();
            } else {
                // 即使页码相同，也更新输入框的值（防止输入了无效值）
                pageInput.value = targetPage;
            }
        };
        
        if (jumpBtn && !jumpBtn._bound) {
            jumpBtn._bound = true;
            jumpBtn.addEventListener('click', handleJump);
        }
        
        if (pageInput && !pageInput._bound) {
            pageInput._bound = true;
            // 按 Enter 键跳转
            pageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleJump();
                }
            });
            // 当页码改变时，同步更新输入框的值
            pageInput.addEventListener('blur', () => {
                const totalPages = Math.max(1, Math.ceil((this.activityRankTotal || 0) / (this.activityRankLimit || 20)));
                let val = Number(pageInput.value) || 1;
                val = Math.max(1, Math.min(val, totalPages));
                pageInput.value = val;
            });
        }
    }

    hide() {
        const section = document.getElementById('activity');
        if (section) section.classList.remove('active');
    }
}

