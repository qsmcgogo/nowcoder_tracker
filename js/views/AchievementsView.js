import { eventBus, EVENTS } from '../events/EventBus.js';

export class AchievementsView {
    constructor(elements, state, api) {
        this.elements = elements;
        this.state = state;
        this.api = api;

        this.sidebar = null;
        this.content = null;

        // 硬编码数据与模拟进度，后续由后端返回
        const { catalog, mockProgress, mockOverview } = getStaticAchievementsCatalog();
        this.catalog = catalog; // { checkin: { series: [...] }, ... }
        this.mockProgress = mockProgress; // { category: { seriesKey: current } }
        this.mockOverview = mockOverview; // { totalPoints, recent: [] }

        this.activeCategory = 'overview';
        this.activeSeries = '';
    }

    hide() {
        const section = document.getElementById('achievements');
        if (section) section.classList.remove('active');
    }

    render() {
        const section = document.getElementById('achievements');
        if (!section) return;
        section.classList.add('active');

        this.sidebar = section.querySelector('.achievements-sidebar');
        this.content = section.querySelector('.achievements-content');
        if (!this.sidebar || !this.content) return;

        this.renderSidebar();
        this.renderContent();
    }

    renderSidebar() {
        const categories = [{ key: 'overview', name: '总览' }, ...Object.entries(this.catalog).map(([key, val]) => ({ key, name: val.name }))];
        const frag = document.createDocumentFragment();
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'achv-cat-btn' + (this.activeCategory === cat.key ? ' active' : '');
            btn.textContent = cat.name;
            btn.addEventListener('click', () => {
                this.activeCategory = cat.key;
                // 切换类别后默认展示该类全部系列为纵向行
                if (cat.key === 'overview') {
                    this.activeSeries = '';
                } else {
                    const firstSeries = this.catalog[cat.key]?.series?.[0];
                    this.activeSeries = firstSeries?.key || '';
                }
                this.renderSidebar();
                this.renderContent();
            });
            frag.appendChild(btn);
        });

        this.sidebar.innerHTML = '';
        this.sidebar.appendChild(frag);
    }

    renderContent() {
        if (this.activeCategory === 'overview') {
            this.renderOverview();
            return;
        }
        const container = document.createElement('div');
        container.className = 'achv-grid achv-grid-vertical';
        const completedRows = [];
        const pendingRows = [];

        const cat = this.catalog[this.activeCategory];
        if (!cat) return;

        cat.series.forEach(series => {
            // 单次型（非系列）成就：每个里程碑单独成一行，不展示进度条与“尚未达成”
            if (series.type === 'single') {
                const singleProg = this.mockProgress?.[this.activeCategory]?.[series.key] || {};
                const achievedSet = new Set(singleProg.achieved || []);
                series.milestones.forEach(m => {
                    const isUnlocked = achievedSet.has(m.name) === true;
                    const card = document.createElement('div');
                    card.className = 'achv-card achv-row' + (isUnlocked ? ' unlocked' : '');

                    const icon = document.createElement('div');
                    icon.className = 'achv-icon';
                    icon.textContent = series.icon || '🏅';

                    const info = document.createElement('div');
                    info.className = 'achv-info';

                    const title = document.createElement('div');
                    title.className = 'achv-title';
                    title.textContent = m.name;

                    const requirementRow = document.createElement('div');
                    requirementRow.className = 'achv-target-row';
                    requirementRow.textContent = m.desc || '';

                    info.appendChild(title);
                    if (m.desc) info.appendChild(requirementRow);

                    // 成就点数
                    const pointsBadge = document.createElement('div');
                    pointsBadge.className = 'achv-points-badge';
                    pointsBadge.textContent = String(typeof m.points === 'number' ? m.points : 0);

                    card.appendChild(icon);
                    card.appendChild(info);
                    card.appendChild(pointsBadge);
                    (isUnlocked ? completedRows : pendingRows).push(card);
                });
                return; // 跳过阈值型渲染
            }

            const { achieved, next, current, nextProgressRatio } = this.computeSeriesProgress(this.activeCategory, series);

            const card = document.createElement('div');
            card.className = 'achv-card achv-row' + (!next ? ' unlocked' : '');

            const icon = document.createElement('div');
            icon.className = 'achv-icon';
            icon.textContent = series.icon || '🏅';

            const info = document.createElement('div');
            info.className = 'achv-info';

            // 标题：显示即将达成的成就名（或已满级时显示最后一级名）
            const title = document.createElement('div');
            title.className = 'achv-title';
            if (next) {
                title.textContent = next.name;
            } else {
                const last = series.milestones[series.milestones.length - 1];
                title.textContent = last?.name || '已满级';
            }

            // 第二行：成就需求（使用里程碑描述）- 移除“成就需求”前缀
            const requirementRow = document.createElement('div');
            requirementRow.className = 'achv-target-row';
            requirementRow.textContent = next ? `${next.desc}` : '';
            if (!next) requirementRow.style.display = 'none';

            // 第三行：进度条 current / next.threshold
            const progress = document.createElement('div');
            progress.className = 'achv-progress';
            const inner = document.createElement('div');
            inner.className = 'achv-progress-inner';
            inner.style.width = `${Math.round((next ? nextProgressRatio : 1) * 100)}%`;
            progress.appendChild(inner);

            // 进度条下方显示具体数值，如 25/50（满级时不显示）
            const progressValue = document.createElement('div');
            progressValue.className = 'achv-progress-value';
            if (next) {
                progressValue.textContent = `${current}/${next.threshold}`;
            } else {
                progressValue.style.display = 'none';
            }

            // 第四行：已达成徽标
            const achievedRow = document.createElement('div');
            achievedRow.className = 'achv-achieved-row';
            if (achieved.length > 0) {
                achieved.forEach(m => {
                    const chip = document.createElement('span');
                    chip.className = 'achv-chip';
                    chip.textContent = m.name; // 暂用文字替代图标
                    chip.title = m.desc ? `${m.desc}` : m.name; // 简易 tooltip
                    achievedRow.appendChild(chip);
                });
            } else {
                const chip = document.createElement('span');
                chip.className = 'achv-chip achv-chip-muted';
                chip.textContent = '尚未达成';
                achievedRow.appendChild(chip);
            }

            info.appendChild(title);
            info.appendChild(requirementRow);
            info.appendChild(progress);
            info.appendChild(progressValue);
            info.appendChild(achievedRow);

            // 成就点数徽章（右侧）
            const pointsBadge = document.createElement('div');
            pointsBadge.className = 'achv-points-badge';
            const showMilestone = next || series.milestones[series.milestones.length - 1];
            const showPoints = showMilestone && typeof showMilestone.points === 'number' ? showMilestone.points : 0;
            pointsBadge.textContent = String(showPoints);

            card.appendChild(icon);
            card.appendChild(info);
            card.appendChild(pointsBadge);
            (!next ? completedRows : pendingRows).push(card);
        });

        // Completed first, then pending
        completedRows.forEach(el => container.appendChild(el));
        pendingRows.forEach(el => container.appendChild(el));

        this.content.innerHTML = '';
        this.content.appendChild(container);
    }

    renderOverview() {
        const root = document.createElement('div');
        root.className = 'achv-overview';

        // Total points card
        const totalCard = document.createElement('div');
        totalCard.className = 'achv-overview-card';
        const totalTitle = document.createElement('div');
        totalTitle.className = 'achv-overview-title';
        totalTitle.textContent = '总成就点数';
        const totalValue = document.createElement('div');
        totalValue.className = 'achv-overview-value';
        totalValue.textContent = String(this.mockOverview.totalPoints || 0);
        totalCard.appendChild(totalTitle);
        totalCard.appendChild(totalValue);

        // Recent list rows - same style as category rows, no merging
        const recentTitle = document.createElement('div');
        recentTitle.className = 'achv-overview-title';
        recentTitle.textContent = '最近获得的成就';
        const rowsContainer = document.createElement('div');
        rowsContainer.className = 'achv-grid achv-grid-vertical';
        const recent = (this.mockOverview.recent || []).slice(0, 5);
        if (recent.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'achv-overview-card';
            empty.textContent = '暂无成就';
            rowsContainer.appendChild(empty);
        } else {
            recent.forEach(r => {
                // 尝试在目录中找到相应里程碑以获取图标与成就点
                let iconText = '🏅';
                let pointsVal = 0;
                Object.values(this.catalog).forEach(cat => {
                    cat.series.forEach(s => {
                        (s.milestones || []).forEach(m => {
                            if (m.name === r.name) {
                                iconText = s.icon || iconText;
                                if (typeof m.points === 'number') pointsVal = m.points;
                            }
                        });
                    });
                });

                const card = document.createElement('div');
                card.className = 'achv-card achv-row unlocked';

                const icon = document.createElement('div');
                icon.className = 'achv-icon';
                icon.textContent = iconText;

                const info = document.createElement('div');
                info.className = 'achv-info';

                const title = document.createElement('div');
                title.className = 'achv-title';
                title.textContent = r.name;

                const requirementRow = document.createElement('div');
                requirementRow.className = 'achv-target-row';
                requirementRow.textContent = r.desc || '';

                const timeMeta = document.createElement('div');
                timeMeta.className = 'achv-recent-time';
                timeMeta.textContent = r.time || '';

                info.appendChild(title);
                if (r.desc) info.appendChild(requirementRow);
                if (r.time) info.appendChild(timeMeta);

                const pointsBadge = document.createElement('div');
                pointsBadge.className = 'achv-points-badge';
                pointsBadge.textContent = String(pointsVal);

                card.appendChild(icon);
                card.appendChild(info);
                card.appendChild(pointsBadge);
                rowsContainer.appendChild(card);
            });
        }

        root.appendChild(totalCard);
        root.appendChild(recentTitle);
        root.appendChild(rowsContainer);
        this.content.innerHTML = '';
        this.content.appendChild(root);
    }

    computeSeriesProgress(categoryKey, series) {
        const current = this.mockProgress?.[categoryKey]?.[series.key] ?? 0;
        // milestones 应保证按 threshold 升序
        const achieved = series.milestones.filter(m => typeof m.threshold === 'number' && current >= m.threshold);
        const next = series.milestones.find(m => typeof m.threshold === 'number' && current < m.threshold) || null;
        const nextProgressRatio = next ? Math.max(0, Math.min(1, current / next.threshold)) : 1;
        return { achieved, next, current, nextProgressRatio };
    }
}

function getStaticAchievementsCatalog() {
    const catalog = {
        checkin: {
            name: '打卡',
            series: [
                {
                    key: 'checkin_total',
                    name: '累计打卡系列',
                    icon: '🟢',
                    milestones: [
                        { name: '新人报道', desc: '第一次打卡', threshold: 1, points: 5 },
                        { name: '三日之约', desc: '累计打卡3天', threshold: 3, points: 5 },
                        { name: '十日练习', desc: '累计打卡10天', threshold: 10, points: 10 },
                        { name: '二十日进阶', desc: '累计打卡20天', threshold: 20, points: 10 },
                        { name: '五十日恒心', desc: '累计打卡50天', threshold: 50, points: 20 },
                        { name: '百日成钢', desc: '累计打卡100天', threshold: 100, points: 20 },
                        { name: '两百日淬金', desc: '累计打卡200天', threshold: 200, points: 50 },
                        { name: '五百日传说', desc: '累计打卡500天', threshold: 500, points: 100 }
                    ]
                },
                {
                    key: 'checkin_streak',
                    name: '连续打卡系列',
                    icon: '🔥',
                    milestones: [
                        { name: '热身连击', desc: '连续打卡3天', threshold: 3, points: 10 },
                        { name: '一周不落', desc: '连续打卡7天', threshold: 7, points: 10 },
                        { name: '月度全勤', desc: '连续打卡30天', threshold: 30, points: 30 },
                        { name: '坚韧不倦', desc: '连续打卡60天', threshold: 60, points: 50 },
                        { name: '半载坚守', desc: '连续打卡180天', threshold: 180, points: 100 },
                        { name: '年度全勤王', desc: '连续打卡365天', threshold: 365, points: 200 }
                    ]
                },
                {
                    key: 'checkin_time',
                    name: '时间段打卡',
                    icon: '⏰',
                    type: 'single',
                    milestones: [
                        { name: '夜猫子', desc: '23:00~03:00 打卡', points: 10 },
                        { name: '早鸟', desc: '05:00~09:00 打卡', points: 10 },
                        { name: '效率为王', desc: '23:45后打卡后，0:15前打第二天的卡', points: 50 }
                    ]
                }
            ]
        },
        solve: {
            name: '过题',
            series: [
                {
                    key: 'solve_total',
                    name: '累计过题系列',
                    icon: '✅',
                    milestones: [
                        { name: '开门红', desc: '通过一道题', threshold: 1, points: 5 },
                        { name: '五题起步', desc: '累计通过5题', threshold: 5, points: 10 },
                        { name: '十题小成', desc: '累计通过10题', threshold: 10, points: 10 },
                        { name: '二十进阶', desc: '累计通过20题', threshold: 20, points: 10 },
                        { name: '三十熟练', desc: '累计通过30题', threshold: 30, points: 10 },
                        { name: '五十老将', desc: '累计通过50题', threshold: 50, points: 10 },
                        { name: '百题斩', desc: '累计通过100题', threshold: 100, points: 20 },
                        { name: '百五精进', desc: '累计通过150题', threshold: 150, points: 20 },
                        { name: '两百精通', desc: '累计通过200题', threshold: 200, points: 20 },
                        { name: '三百里程', desc: '累计通过300题', threshold: 300, points: 20 },
                        { name: '五百强者', desc: '累计通过500题', threshold: 500, points: 20 },
                        { name: '千题破阵', desc: '累计通过1000题', threshold: 1000, points: 50 },
                        { name: '两千问道', desc: '累计通过2000题', threshold: 2000, points: 50 },
                        { name: '三千登峰', desc: '累计通过3000题', threshold: 3000, points: 50 },
                        { name: '五千传说', desc: '累计通过5000题', threshold: 5000, points: 100 }
                    ]
                },
                {
                    key: 'contest_weekly',
                    name: '周赛全AK系列',
                    icon: '🏆',
                    milestones: [
                        { name: '周赛首冠·全AK', desc: '1场周赛全AK', threshold: 1, points: 10 },
                        { name: '周赛双冠·全AK', desc: '2场周赛全AK', threshold: 2, points: 10 },
                        { name: '周赛三冠·全AK', desc: '3场周赛全AK', threshold: 3, points: 10 },
                        { name: '周赛五冠·全AK', desc: '5场周赛全AK', threshold: 5, points: 10 },
                        { name: '周赛十冠·全AK', desc: '10场周赛全AK', threshold: 10, points: 20 },
                        { name: '周赛二十冠·全AK', desc: '20场周赛全AK', threshold: 20, points: 20 },
                        { name: '周赛五十冠·全AK', desc: '50场周赛全AK', threshold: 50, points: 50 },
                        { name: '周赛百冠·全AK', desc: '100场周赛全AK', threshold: 100, points: 100 }
                    ]
                }
            ]
        },
        skill: {
            name: '技能树',
            series: [
                {
                    key: 'skill_progress',
                    name: '进度达标',
                    icon: '🌳',
                    milestones: [
                        { name: '初窥门径', desc: '单知识点进度达到60%', threshold: 60, points: 10 },
                        { name: '晨曦初醒', desc: '晨曦微光通关率达到70%', threshold: 70, points: 20 },
                        { name: '拂晓圆满', desc: '晨曦微光通关率达到100%', threshold: 100, points: 50 }
                    ]
                }
            ]
        }
    };

    // 模拟当前进度（无后端时用于展示）
    const mockProgress = {
        checkin: {
            checkin_total: 25,
            checkin_streak: 4,
            // 单次型成就的进度用命名集合标记完成项
            checkin_time: { achieved: ['早鸟'] }
        },
        solve: { solve_total: 68, contest_weekly: 0 },
        skill: { skill_progress: 68 }
    };

    const mockOverview = {
        totalPoints: 235,
        recent: [
            { name: '三日之约', desc: '累计打卡3天', time: '10-20 08:12' },
            { name: '开门红', desc: '通过一道题', time: '10-19 20:45' },
            { name: '热身连击', desc: '连续打卡3天', time: '10-18 08:07' },
            { name: '十日练习', desc: '累计打卡10天', time: '10-10 09:10' },
            { name: '五十老将', desc: '累计通过50题', time: '10-05 22:31' }
        ]
    };

    return { catalog, mockProgress, mockOverview };
}


