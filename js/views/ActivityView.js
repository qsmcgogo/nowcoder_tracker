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
                    <p>每日一题累计打卡 ≥ 90 天的同学，可获得牛客娘马克杯一个。</p>
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
            // 只显示活动说明
            box.innerHTML = infoHtml;
            return;
        }
        
        if (tab === 'result') {
            box.innerHTML = `
                <div style="font-weight:700;margin-bottom:6px;">活动结果展示</div>
                <div style="color:#666;padding:24px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:16px;">⏳</div>
                    <div style="font-size:16px;">活动已结束，结果正在统计中，敬请期待...</div>
                </div>
            `;
            return;
        }
        
    }


    hide() {
        const section = document.getElementById('activity');
        if (section) section.classList.remove('active');
    }
}

