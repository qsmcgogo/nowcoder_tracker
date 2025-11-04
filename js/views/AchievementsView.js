import { eventBus, EVENTS } from '../events/EventBus.js';

export class AchievementsView {
    constructor(elements, state, api) {
        this.elements = elements;
        this.state = state;
        this.api = api;

        this.sidebar = null;
        this.content = null;

        // 硬编码数据与模拟进度（后端未开或失败时回退）
        const { catalog, mockProgress, mockOverview } = getStaticAchievementsCatalog();
        this.catalog = catalog; // { checkin: { series: [...] }, ... }
        this.mockProgress = mockProgress; // { category: { seriesKey: current } }
        this.mockOverview = mockOverview; // { totalPoints, recent: [] }

        this.activeCategory = 'overview';
        // 是否将相似成就合并为系列视图（默认不合并）
        this.mergeSeries = false;
        this.activeSeries = '';

        // 动态数据（来自后端徽章接口），按类别缓存
        // 结构：
        // this.dynamicCatalog = {
        //   checkin: { series: [...], progress: { countDay, continueDay } },
        //   solve:   { series: [...] },
        //   skill:   { series: [...] }
        // }
        this.dynamicCatalog = {};
        this.isLoadingCategory = { checkin: false, solve: false, skill: false };
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
        // 未登录统一提示
        if (!this.state || !this.state.isLoggedIn || !this.state.isLoggedIn()) {
            if (this.content) {
                this.content.innerHTML = '<div class="achv-overview-card">请用户登录查看成就</div>';
            }
            return;
        }
        if (this.activeCategory === 'overview') {
            this.renderOverview();
            return;
        }
        // 所有分类均可渲染；checkin/solve/skill 按动态数据决定展示细节
        const container = document.createElement('div');
        container.className = 'achv-grid achv-grid-vertical';
        const completedRows = [];
        const pendingRows = [];

        // 若该分类的动态数据未加载，则触发加载并先显示占位
        if (!this.dynamicCatalog[this.activeCategory] && !this.isLoadingCategory[this.activeCategory]) {
            this.loadCategoryBadges(this.activeCategory);
        }

        const dynamicCat = this.dynamicCatalog[this.activeCategory];
        const useRaw = !!dynamicCat && Array.isArray(dynamicCat.rawList) && dynamicCat.rawList.length > 0;
        const useDynamic = !!dynamicCat && Array.isArray(dynamicCat.series) && dynamicCat.series.length > 0;
        // 若已加载到动态分类但数据为空，不再回退到本地缺省，直接提示“待更新”
        if (!!dynamicCat && !useRaw && !useDynamic) {
            this.content.innerHTML = '<div class="achv-overview-card">待更新</div>';
            return;
        }
        const cat = (useDynamic || useRaw) ? dynamicCat : this.catalog[this.activeCategory];
        if (!cat) return;

        // 是否使用“系列合并”视图：受 mergeSeries 开关控制
        // checkin：累计/连续系列可合并；solve：累计过题可合并
        const preferSeriesForCheckin = this.mergeSeries && this.activeCategory === 'checkin' && useDynamic;
        const preferSeriesForSolve = this.mergeSeries && this.activeCategory === 'solve' && useDynamic;
        const preferSeries = preferSeriesForCheckin || preferSeriesForSolve;

        // 直出模式（不合并）
        if (useRaw && !preferSeries) {
            const list = dynamicCat.rawList.slice();
            // 排序：已获得优先，其次按成就点从高到低
            list.sort((a, b) =>
                (Number(b.status === 1) - Number(a.status === 1)) ||
                ((Number(a.score) || 0) - (Number(b.score) || 0))
            );
            list.forEach(b => {
                const isUnlocked = Number(b.status) === 1;
                const card = document.createElement('div');
                card.className = 'achv-card achv-row' + (isUnlocked ? ' unlocked' : '');

                const info = document.createElement('div');
                info.className = 'achv-info';
                const title = document.createElement('div');
                title.className = 'achv-title';
                const span = document.createElement('span');
                span.className = `achv-frame ${this.pickRarityClass(Number(b.score) || 0)}`;
                span.textContent = b.name || '';
                // 显示完成时间（未合并模式下也展示）
                if (isUnlocked && b.finishedTime) {
                    const header = document.createElement('div');
                    header.className = 'achv-header';
                    const left = document.createElement('div');
                    left.appendChild(span);
                    header.appendChild(left);
                    const t = document.createElement('span');
                    t.className = 'achv-finish-time';
                    t.textContent = `完成于 ${this.formatTime(b.finishedTime)}`;
                    header.appendChild(t);
                    title.appendChild(header);
                } else {
                    title.appendChild(span);
                }
                const requirementRow = document.createElement('div');
                requirementRow.className = 'achv-target-row';
                requirementRow.textContent = b.detail || '';
                info.appendChild(title);
                if (b.detail) info.appendChild(requirementRow);

                // 未合并模式下：对累计/连续/累计过题(401~415)显示进度条；
                // 四个“题单制霸”（451~454）不显示进度条
                if (!isUnlocked) {
                    const t = Number(b.type);
                    const id = Number(b.id);
                    const threshold = Number(b.acquirement) || 0;
                    let current = 0;
                    let shouldShow = false;
                    if (this.activeCategory === 'checkin') {
                        if (t === 1) { current = Number((dynamicCat.progress && dynamicCat.progress.countDay) || 0); shouldShow = true; }
                        if (t === 2) { current = Number((dynamicCat.progress && dynamicCat.progress.continueDay) || 0); shouldShow = true; }
                    } else if (this.activeCategory === 'solve') {
                        if (t === 4) {
                            // 仅对累计过题系列(401~415)展示进度；题单制霸(451~454)不展示
                            const isPlaylist = id >= 451 && id <= 454;
                            const isCumulative = id >= 401 && id <= 415;
                            if (!isPlaylist && isCumulative) {
                                current = Number((dynamicCat.progress && dynamicCat.progress.solveCount) || 0);
                                shouldShow = true;
                            }
                        }
                    }
                    if (shouldShow && threshold > 0 && current >= 0) {
                        const progress = document.createElement('div');
                        progress.className = 'achv-progress';
                        const inner = document.createElement('div');
                        inner.className = 'achv-progress-inner';
                        const ratio = Math.max(0, Math.min(1, current / threshold));
                        inner.style.width = `${Math.round(ratio * 100)}%`;
                        progress.appendChild(inner);
                        const progressValue = document.createElement('div');
                        progressValue.className = 'achv-progress-value';
                        progressValue.textContent = `${current}/${threshold}`;
                        info.appendChild(progress);
                        info.appendChild(progressValue);
                    }
                }

                const pointsBadge = document.createElement('div');
                pointsBadge.className = 'achv-points-badge';
                pointsBadge.textContent = String(Number(b.score) || 0);

                card.appendChild(info);
                card.appendChild(pointsBadge);
                (isUnlocked ? completedRows : pendingRows).push(card);
            });

            // Completed first, then pending
            completedRows.forEach(el => container.appendChild(el));
            pendingRows.forEach(el => container.appendChild(el));

            this.content.innerHTML = '';
            this.content.appendChild(this.buildToolbar());
            const header = this.buildListHeader();
            this.content.appendChild(header);
            this.content.appendChild(container);
            return;
        }

        // 如果是打卡分类，优先把一次性(type=3)成就用“原子项直出”方式渲染，保证使用后端图片
        if (preferSeriesForCheckin && useRaw) {
            const rawSingles = (dynamicCat.rawList || []).filter(b => Number(b.type) === 3);
            rawSingles.sort((a, b) => Number(b.status === 1) - Number(a.status === 1));
            rawSingles.forEach(b => {
                const isUnlocked = Number(b.status) === 1;
                const card = document.createElement('div');
                card.className = 'achv-card achv-row' + (isUnlocked ? ' unlocked' : '');

                const info = document.createElement('div');
                info.className = 'achv-info';
                const title = document.createElement('div');
                title.className = 'achv-title';
                const span = document.createElement('span');
                span.className = `achv-frame ${this.pickRarityClass(Number(b.score) || 0)}`;
                span.textContent = b.name || '';
                // 标题与右侧完成时间并排
                const header = document.createElement('div');
                header.className = 'achv-header';
                const left = document.createElement('div');
                left.appendChild(span);
                header.appendChild(left);
                if (isUnlocked && b.finishedTime) {
                    const t = document.createElement('span');
                    t.className = 'achv-finish-time';
                    t.textContent = `完成于 ${this.formatTime(b.finishedTime)}`;
                    header.appendChild(t);
                }
                title.appendChild(header);
                title.appendChild(span);
                const requirementRow = document.createElement('div');
                requirementRow.className = 'achv-target-row';
                requirementRow.textContent = b.detail || '';
                info.appendChild(title);
                if (b.detail) info.appendChild(requirementRow);

                const pointsBadge = document.createElement('div');
                pointsBadge.className = 'achv-points-badge';
                pointsBadge.textContent = String(Number(b.score) || 0);

                card.appendChild(info);
                card.appendChild(pointsBadge);
                (isUnlocked ? completedRows : pendingRows).push(card);
            });
        }

        // 动态（已合并）与静态两种渲染路径复用相同 UI，仅在进度来源与达成判断上有差异
        cat.series.forEach(series => {
            // 在打卡合并视图下，跳过 type=3（已用原子渲染）
            if (preferSeriesForCheckin && series.type === 'single') return;
            // 单次型（非系列）成就：每个里程碑单独成一行，不展示进度条与“尚未达成”
            if (series.type === 'single') {
                const singleProg = useDynamic ? null : (this.mockProgress?.[this.activeCategory]?.[series.key] || {});
                const achievedSet = useDynamic ? null : new Set(singleProg.achieved || []);
                series.milestones.forEach(m => {
                    const isUnlocked = useDynamic ? (m.status === 1) : (achievedSet.has(m.name) === true);
                    const card = document.createElement('div');
                    card.className = 'achv-card achv-row' + (isUnlocked ? ' unlocked' : '');

                    const info = document.createElement('div');
                    info.className = 'achv-info';

                    const title = document.createElement('div');
                    title.className = 'achv-title';
                    const span = document.createElement('span');
                    span.className = `achv-frame ${this.pickRarityClass(Number(m.points) || 0)}`;
                    span.textContent = m.name;
                    if (isUnlocked && m.finishedTime) {
                        span.classList.add('achv-tip');
                        span.setAttribute('data-tip', `完成于 ${this.formatTime(m.finishedTime)}`);
                    }
                    title.appendChild(span);

                    const requirementRow = document.createElement('div');
                    requirementRow.className = 'achv-target-row';
                    requirementRow.textContent = m.desc || '';

                    info.appendChild(title);
                    if (m.desc) info.appendChild(requirementRow);

                    const pointsBadge = document.createElement('div');
                    pointsBadge.className = 'achv-points-badge';
                    pointsBadge.textContent = String(typeof m.points === 'number' ? m.points : 0);

                    card.appendChild(info);
                    card.appendChild(pointsBadge);
                    (isUnlocked ? completedRows : pendingRows).push(card);
                });
                return; // 跳过阈值型渲染
            }

            // 阈值型：动态与静态两种计算
            let achieved = [];
            let next = null;
            let current = 0;
            let nextProgressRatio = 0;

            if (useDynamic) {
                const milestones = [...(series.milestones || [])].sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
                achieved = milestones.filter(m => m.status === 1);
                next = milestones.find(m => m.status !== 1) || null;

                // 在打卡合并视图下（累计/连续），展示真实进度；solve 的累计过题系列也展示进度
                if (this.activeCategory === 'checkin') {
                    if (series.key === 'checkin_total') current = Number(dynamicCat.progress?.countDay || 0);
                    if (series.key === 'checkin_streak') current = Number(dynamicCat.progress?.continueDay || 0);
                } else if (this.activeCategory === 'solve') {
                    if (series.key === 'solve_total') current = Number(dynamicCat.progress?.solveCount || 0);
                }
                nextProgressRatio = next ? Math.max(0, Math.min(1, (current || 0) / (next.threshold || 1))) : 1;
            } else {
                const result = this.computeSeriesProgress(this.activeCategory, series);
                achieved = result.achieved; next = result.next; current = result.current; nextProgressRatio = result.nextProgressRatio;
            }

            const card = document.createElement('div');
            card.className = 'achv-card achv-row' + (!next ? ' unlocked' : '');

            const icon = document.createElement('div');
            icon.className = 'achv-icon';
            // 使用“即将达成”的里程碑图片；满级时使用最后一级图片
            const milestoneForIcon = next || series.milestones[series.milestones.length - 1] || {};
            const img = document.createElement('img');
            const colorUrl = milestoneForIcon.colorUrl || milestoneForIcon.colorUrl1 || '';
            const done = Number(milestoneForIcon.status) === 1 || !next; // 满级或里程碑已完成显示彩色
            img.src = colorUrl || '';
            if (!done) img.classList.add('is-gray');
            img.alt = milestoneForIcon.name || '';
            img.referrerPolicy = 'no-referrer';
            icon.appendChild(img);

            const info = document.createElement('div');
            info.className = 'achv-info';

            // 标题：显示即将达成的成就名（或已满级时显示最后一级名）
            const title = document.createElement('div');
            title.className = 'achv-title';
            if (next) {
                const header = document.createElement('div');
                header.className = 'achv-header';
                const span = document.createElement('span');
                span.className = `achv-frame ${this.pickRarityClass(next.points || 0)}`;
                span.textContent = next.name;
                header.appendChild(span);
                if (!next) {
                    // no-op
                }
                title.appendChild(header);
            } else {
                const last = series.milestones[series.milestones.length - 1];
                const header = document.createElement('div');
                header.className = 'achv-header';
                const span = document.createElement('span');
                span.className = `achv-frame ${this.pickRarityClass((last && last.points) || 0)}`;
                span.textContent = last?.name || '已满级';
                // 右侧若存在最后一级完成时间，显示
                if (last && last.finishedTime) {
                    const t = document.createElement('span');
                    t.className = 'achv-finish-time';
                    t.textContent = `完成于 ${this.formatTime(last.finishedTime)}`;
                    header.appendChild(t);
                }
                header.appendChild(span);
                title.appendChild(header);
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
                const canShowProgress = (useDynamic && (this.activeCategory === 'checkin' || (this.activeCategory === 'solve' && series.key === 'solve_total')));
                if (!canShowProgress) {
                    progress.style.display = 'none';
                    progressValue.style.display = 'none';
                } else {
                    progressValue.textContent = `${current}/${next.threshold}`;
                }
            } else {
                progressValue.style.display = 'none';
            }

            // 第四行：已达成徽标（小框文字 + 悬浮说明）
            if (achieved.length > 0) {
                const achievedRow = document.createElement('div');
                achievedRow.className = 'achv-achieved-row';
                const list = document.createElement('div');
                list.className = 'achv-badge-list';
                achieved.forEach(m => {
                    const tag = document.createElement('span');
                    tag.className = `achv-frame achv-frame--sm ${this.pickRarityClass(Number(m.points) || 0)} achv-tip`;
                    tag.textContent = m.name;
                    const tipParts = [];
                    if (m.desc) tipParts.push(m.desc);
                    if (m.finishedTime) tipParts.push(`完成于 ${this.formatTime(m.finishedTime)}`);
                    if (tipParts.length > 0) tag.setAttribute('data-tip', tipParts.join('\n'));
                    list.appendChild(tag);
                });
                achievedRow.appendChild(list);
                info.appendChild(achievedRow);
            }

            info.appendChild(title);
            info.appendChild(requirementRow);
            info.appendChild(progress);
            info.appendChild(progressValue);
            // 无已达成时不展示“尚未达成”提示，保持界面简洁

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

        // 加载中占位
        if (!useDynamic && this.isLoadingCategory[this.activeCategory]) {
            this.content.textContent = '加载中...';
        } else {
            this.content.innerHTML = '';
            this.content.appendChild(this.buildToolbar());
            const header = this.buildListHeader();
            this.content.appendChild(header);
            this.content.appendChild(container);
        }
    }

    // 构建列表头部：“成就名 | 成就点”
    buildListHeader() {
        const header = document.createElement('div');
        header.className = 'achv-list-header';
        const left = document.createElement('span');
        left.className = 'achv-list-header__left';
        left.textContent = '成就名';
        const right = document.createElement('span');
        right.className = 'achv-list-header__right';
        right.textContent = '成就点';
        header.appendChild(left);
        header.appendChild(right);
        return header;
    }

    // 顶部工具栏：合并/取消合并 按钮
    buildToolbar() {
        const bar = document.createElement('div');
        bar.className = 'achv-toolbar';
        const btn = document.createElement('button');
        btn.className = 'achv-merge-toggle';
        btn.textContent = this.mergeSeries ? '取消合并' : '合并成就';
        btn.addEventListener('click', () => {
            this.mergeSeries = !this.mergeSeries;
            this.renderContent();
        });
        bar.appendChild(btn);
        return bar;
    }

    async renderOverview() {
        // 未登录直接提示
        if (!this.state || !this.state.isLoggedIn || !this.state.isLoggedIn()) {
            if (this.content) {
                this.content.innerHTML = '<div class="achv-overview-card">请用户登录查看成就</div>';
            }
            return;
        }
        const root = document.createElement('div');
        root.className = 'achv-overview';

        // Total points card (loading state first)
        const totalCard = document.createElement('div');
        totalCard.className = 'achv-overview-card';
        const totalTitle = document.createElement('div');
        totalTitle.className = 'achv-overview-title';
        totalTitle.textContent = '总成就点数';
        const totalValue = document.createElement('div');
        totalValue.className = 'achv-overview-value';
        totalValue.textContent = '加载中...';
        totalCard.appendChild(totalTitle);
        totalCard.appendChild(totalValue);

        const recentTitle = document.createElement('div');
        recentTitle.className = 'achv-overview-title';
        recentTitle.textContent = '最近获得的成就';
        const rowsContainer = document.createElement('div');
        rowsContainer.className = 'achv-grid achv-grid-vertical';

        // mount loading skeleton
        this.content.innerHTML = '';
        root.appendChild(totalCard);
        root.appendChild(recentTitle);
        root.appendChild(rowsContainer);
        this.content.appendChild(root);

        // fetch data
        let userInfo = null;
        try {
            userInfo = await this.api.fetchBadgeUserInfo();
        } catch (_) {}

        const totalPoints = (userInfo && (userInfo.totalPoints != null)) ? userInfo.totalPoints : (this.mockOverview.totalPoints || 0);
        totalValue.textContent = String(totalPoints);

        // 使用后端返回。若后端为空则展示“暂无成就”，不再使用本地mock回退
        const recent = (Array.isArray(userInfo?.recent) ? userInfo.recent : []).slice(0, 5);
        rowsContainer.innerHTML = '';
        if (recent.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'achv-overview-card';
            empty.textContent = '暂无成就';
            rowsContainer.appendChild(empty);
        } else {
            recent.forEach(r => {
                const card = document.createElement('div');
                card.className = 'achv-card achv-row unlocked';

                const info = document.createElement('div');
                info.className = 'achv-info';

                const title = document.createElement('div');
                title.className = 'achv-title';
                const span = document.createElement('span');
                span.className = `achv-frame ${this.pickRarityClass(Number(r.score || r.points || 0))}`;
                span.textContent = r.name || r.title || '';
                title.appendChild(span);

                const requirementRow = document.createElement('div');
                requirementRow.className = 'achv-target-row';
                requirementRow.textContent = r.desc || r.detail || '';

                const timeMeta = document.createElement('div');
                timeMeta.className = 'achv-recent-time';
                timeMeta.textContent = r.time || r.createTime || '';

                info.appendChild(title);
                if (requirementRow.textContent) info.appendChild(requirementRow);
                if (timeMeta.textContent) info.appendChild(timeMeta);

                const pointsBadge = document.createElement('div');
                pointsBadge.className = 'achv-points-badge';
                pointsBadge.textContent = String(Number(r.score || r.points || 0));

                card.appendChild(info);
                card.appendChild(pointsBadge);
                rowsContainer.appendChild(card);
            });
        }
    }

    computeSeriesProgress(categoryKey, series) {
        const current = this.mockProgress?.[categoryKey]?.[series.key] ?? 0;
        // milestones 应保证按 threshold 升序
        const achieved = series.milestones.filter(m => typeof m.threshold === 'number' && current >= m.threshold);
        const next = series.milestones.find(m => typeof m.threshold === 'number' && current < m.threshold) || null;
        const nextProgressRatio = next ? Math.max(0, Math.min(1, current / next.threshold)) : 1;
        return { achieved, next, current, nextProgressRatio };
    }

    // 根据分值粗略映射稀有度边框颜色
    pickRarityClass(points) {
        const p = Number(points) || 0;
        if (p >= 200) return 'achv-frame--red';
        if (p >= 100) return 'achv-frame--gold';
        if (p >= 50) return 'achv-frame--orange';
        if (p >= 30) return 'achv-frame--purple';
        if (p >= 20) return 'achv-frame--blue';
        if (p >= 10) return 'achv-frame--green';
        return 'achv-frame--gray';
    }
    // 时间格式化：毫秒时间戳 -> MM-DD HH:mm
    formatTime(ts) {
        const v = Number(ts);
        if (!v) return '';
        const d = new Date(v);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${mm}-${dd} ${hh}:${mi}`;
    }

    // 动态加载某个分类（checkin/solve/skill）的徽章数据
    async loadCategoryBadges(categoryKey) {
        const map = { checkin: [1, 2, 3], solve: [4, 5], skill: [6] };
        const icons = {
            checkin_total: '🟢',
            checkin_streak: '🔥',
            checkin_time: '⏰',
            solve_total: '✅',
            solve_playlist: '📚',
            contest_weekly: '🏆',
            skill_progress: '🌳'
        };

        const buildSeriesFromBadges = (badges) => {
            // badges: Array<{ id, name, score, acquirement, detail, type, status }>
            const byType = new Map();
            badges.forEach(b => {
                const t = Number(b.type);
                if (!byType.has(t)) byType.set(t, []);
                byType.get(t).push(b);
            });

            const series = [];

            // checkin types
            if (byType.has(1)) {
                const milestones = byType.get(1)
                    .sort((a, b) => (a.acquirement || 0) - (b.acquirement || 0))
                    .map(m => ({
                        name: m.name,
                        desc: m.detail,
                        threshold: Number(m.acquirement) || 0,
                        points: Number(m.score) || 0,
                        status: Number(m.status) || 0,
                        finishedTime: m.finishedTime || null,
                        colorUrl: m.colorUrl || '',
                        grayUrl: m.grayUrl || ''
                    }));
                series.push({ key: 'checkin_total', name: '累计打卡系列', icon: icons.checkin_total, milestones });
            }
            if (byType.has(2)) {
                const milestones = byType.get(2)
                    .sort((a, b) => (a.acquirement || 0) - (b.acquirement || 0))
                    .map(m => ({
                        name: m.name,
                        desc: m.detail,
                        threshold: Number(m.acquirement) || 0,
                        points: Number(m.score) || 0,
                        status: Number(m.status) || 0,
                        finishedTime: m.finishedTime || null,
                        colorUrl: m.colorUrl || '',
                        grayUrl: m.grayUrl || ''
                    }));
                series.push({ key: 'checkin_streak', name: '连续打卡系列', icon: icons.checkin_streak, milestones });
            }
            if (byType.has(3)) {
                const milestones = byType.get(3)
                    .sort((a, b) => (a.acquirement || 0) - (b.acquirement || 0))
                    .map(m => ({
                        name: m.name,
                        desc: m.detail,
                        points: Number(m.score) || 0,
                        status: Number(m.status) || 0,
                        finishedTime: m.finishedTime || null,
                        colorUrl: m.colorUrl || '',
                        grayUrl: m.grayUrl || ''
                    }));
                series.push({ key: 'checkin_time', name: '时间段打卡', icon: icons.checkin_time, type: 'single', milestones });
            }

            // solve types（4）：拆分合并系列与题单制霸
            if (byType.has(4)) {
                const all = byType.get(4) || [];
                const toNum = (v, d=0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
                const isCumulative = (b) => {
                    const id = toNum(b.id, 0);
                    return id >= 401 && id <= 415; // 401~415：累计过题
                };
                const isPlaylist = (b) => {
                    const id = toNum(b.id, 0);
                    return id >= 451 && id <= 454; // 451~454：题单制霸
                };

                const cumMilestones = all.filter(isCumulative)
                    .sort((a, b) => (a.acquirement || 0) - (b.acquirement || 0))
                    .map(m => ({
                        name: m.name,
                        desc: m.detail,
                        threshold: Number(m.acquirement) || 0,
                        points: Number(m.score) || 0,
                        status: Number(m.status) || 0,
                        finishedTime: m.finishedTime || null,
                        colorUrl: m.colorUrl || '',
                        grayUrl: m.grayUrl || ''
                    }));
                if (cumMilestones.length) series.push({ key: 'solve_total', name: '累计过题系列', icon: icons.solve_total, milestones: cumMilestones });

                const playlistMilestones = all.filter(isPlaylist)
                    .sort((a, b) => (a.id || 0) - (b.id || 0))
                    .map(m => ({
                        name: m.name,
                        desc: m.detail,
                        points: Number(m.score) || 0,
                        status: Number(m.status) || 0,
                        finishedTime: m.finishedTime || null,
                        colorUrl: m.colorUrl || '',
                        grayUrl: m.grayUrl || ''
                    }));
                if (playlistMilestones.length) series.push({ key: 'solve_playlist', name: '题单制霸', icon: icons.solve_playlist, type: 'single', milestones: playlistMilestones });
            }
            if (byType.has(5)) {
                const milestones = byType.get(5)
                    .sort((a, b) => (a.acquirement || 0) - (b.acquirement || 0))
                    .map(m => ({
                        name: m.name,
                        desc: m.detail,
                        threshold: Number(m.acquirement) || 0,
                        points: Number(m.score) || 0,
                        status: Number(m.status) || 0,
                        finishedTime: m.finishedTime || null,
                        colorUrl: m.colorUrl || '',
                        grayUrl: m.grayUrl || ''
                    }));
                series.push({ key: 'contest_weekly', name: '周赛全AK系列', icon: icons.contest_weekly, milestones });
            }

            // skill types
            if (byType.has(6)) {
                const milestones = byType.get(6)
                    .sort((a, b) => (a.acquirement || 0) - (b.acquirement || 0))
                    .map(m => ({
                        name: m.name,
                        desc: m.detail,
                        threshold: Number(m.acquirement) || 0,
                        points: Number(m.score) || 0,
                        status: Number(m.status) || 0,
                        finishedTime: m.finishedTime || null,
                        colorUrl: m.colorUrl || '',
                        grayUrl: m.grayUrl || ''
                    }));
                series.push({ key: 'skill_progress', name: '技能树进度', icon: icons.skill_progress, milestones });
            }

            return series;
        };

        try {
            this.isLoadingCategory[categoryKey] = true;
            this.content && (this.content.textContent = '加载中...');

            const types = map[categoryKey] || [];
            const badgePromise = this.api.fetchBadgeList(types);
            let todayPromise = Promise.resolve(null);
            if (categoryKey === 'checkin') {
                todayPromise = this.api.fetchDailyTodayInfo().catch(() => null);
            }
            let solveProgressPromise = Promise.resolve(null);
            if (categoryKey === 'solve') {
                const uid = this.state && this.state.loggedInUserId;
                if (uid) solveProgressPromise = this.api.fetchRankings('problem', 1, uid, 1).catch(() => null);
            }
            const [badgeData, todayData, solveRankData] = await Promise.all([badgePromise, todayPromise, solveProgressPromise]);

            let list = Array.isArray(badgeData)
                ? badgeData
                : (badgeData && typeof badgeData === 'object' ? (Array.isArray(badgeData.data) ? badgeData.data : Object.values(badgeData.data || {})) : []);

            // 有些实现返回 { code, data: { id: {...}, id: {...} } } 的对象形式，再次展开一层
            if (list.length && typeof list[0] === 'object' && list[0].id == null && badgeData && badgeData.data && !Array.isArray(badgeData.data)) {
                list = Object.values(badgeData.data);
            }

            const series = buildSeriesFromBadges(list);
            const dynamic = { series, rawList: list };

            if (categoryKey === 'checkin') {
                const d = todayData && todayData.data ? todayData.data : {};
                const continueDay = Number(d.continueDay) || 0;
                const countDay = Number(d.countDay) || 0;
                dynamic.progress = { continueDay, countDay };
            } else if (categoryKey === 'solve') {
                const u = (solveRankData && solveRankData.ranks && solveRankData.ranks[0]) || {};
                const solveCount = Number(u.count) || 0;
                dynamic.progress = { solveCount };
            }

            this.dynamicCatalog[categoryKey] = dynamic;
        } catch (e) {
            console.warn('loadCategoryBadges failed:', e);
        } finally {
            this.isLoadingCategory[categoryKey] = false;
            this.renderContent();
        }
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


