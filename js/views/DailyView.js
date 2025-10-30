/**
 * 每日一题视图模块
 * 处理每日一题相关的UI和逻辑
 */

import { APP_CONFIG } from '../config.js';
import { ApiService } from '../services/ApiService.js';
import * as helpers from '../utils/helpers.js';
import { eventBus, EVENTS } from '../events/EventBus.js';

export class DailyView {
    constructor(elements, state, apiService) {
        this.elements = elements;
        this.state = state;
        this.apiService = apiService;
        this.todayInfoExtras = null;
        this.currentVideoEmbedSrc = '';
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.tooltip = document.getElementById('calendar-tooltip'); // 获取 tooltip 元素
        // 预先绑定内联视频按钮，避免数据加载失败时无法绑定
        this.setupInlineVideoControls();
        // 若已是管理员（例如从其他页切换过来），优先挂载工具栏
        if (this.state && this.state.isAdmin) {
            this.setupAdminSharelinkControls();
        }
    }
    
    bindEvents() {
        // 监听主标签切换事件
        eventBus.on(EVENTS.MAIN_TAB_CHANGED, (tab) => {
            if (tab === 'daily') {
                this.loadAndRenderDailyTab();
            }
        });
        
        // 监听用户登录事件
        eventBus.on(EVENTS.USER_LOGIN, (userData) => {
            // 不需要重复设置，因为已经在loadAndRenderDailyTab中设置了
            this.renderUserSummaryPanel(userData);
            if (this.state && this.state.isAdmin) {
                this.setupAdminSharelinkControls();
            }
        });
    }
    
    async loadAndRenderDailyTab() {
        this.renderDailyLoading();
        if (this.elements.userSummaryPanel) {
            this.elements.userSummaryPanel.innerHTML = '<div class="loading-spinner"></div>';
        }
        
        try {
            // 统一只请求一次 todayinfo，并在后续步骤中复用
            const data = await this.apiService.fetchDailyTodayInfo();
            
            if (data && data.code !== 0 && data.msg === "未登录") {
                this.state.setLoggedInUser(null, null);
                this.renderUserSummaryPanel(null);
                
                // 即使未登录，API也可能发送题目
                const problemData = data.data;
                const problem = problemData && problemData.questionId ? {
                    title: problemData.questionTitle,
                    url: problemData.questionUrl,
                    problemId: problemData.questionId,
                    source: '[每日一题]',
                    difficulty: 'N/A',
                    acCount: 0
                } : null;
                
                // 根据是否有可用视频地址，更新展开按钮状态（占位逻辑：无题或题目URL为空 → 视为无视频）
                this.currentVideoEmbedSrc = (problem && problem.url) ? '//player.bilibili.com/player.html?isOutside=true&aid=115432346357527&bvid=BV1ajsXzUEqj&cid=33371785303&p=1' : '';
                this.updateInlineVideoToggleState();
                
                if (problem) {
                    this.renderDailyProblem(problem, false, false);
                } else {
                    this.renderDailyError("今日暂无题目");
                }
                
                this.renderCalendar();
                // 初始化内联视频播放器的展开/收起
                this.setupInlineVideoControls();
                return;
            }
            
            if (data && data.code !== 0) {
                throw new Error(`API错误: ${data.msg}`);
            }
            
            // 处理登录用户的数据
            const responseData = data.data;
            const userId = responseData.uid && responseData.uid !== 0 ? String(responseData.uid) : null;
            this.state.setLoggedInUser(userId, responseData.user || null);
            // 保存今日统计，供“题目卡片标题上方”与右侧统计共用
            this.todayInfoExtras = {
                todayClockCount: Number(responseData.todayClockCount) || 0,
                todayClockRank: Number(responseData.todayClockRank) || 0,
                yesterdayClockCount: Number(responseData.yesterdayClockCount) || 0
            };
            
            // 触发用户登录事件
            if (userId) {
                eventBus.emit(EVENTS.USER_LOGIN, {
                    uid: userId,
                    user: responseData.user || null,
                    ...responseData
                });
            }
            
            const problem = responseData.questionId ? {
                title: responseData.questionTitle,
                url: responseData.questionUrl,
                problemId: responseData.questionId,
                source: responseData.source || '[每日一题]',
                difficulty: responseData.difficulty || 'N/A',
                acCount: responseData.acCount || 0
            } : null;
            
            this.state.setCurrentDailyProblem(problem);
            // 默认不预设视频地址，用户点击具体日期后再取 daylink
            this.currentVideoEmbedSrc = '';
            this.updateInlineVideoToggleState();
            // 默认不预设视频地址，用户点击具体日期后再取 daylink
            this.currentVideoEmbedSrc = '';
            this.updateInlineVideoToggleState();
            
            // 获取用户数据（兼容两种返回结构）
            let user = responseData.user || null;
            if (!user && responseData.uid && responseData.uid !== 0) {
                const fetched = await this.apiService.fetchUserData(responseData.uid);
                user = fetched && fetched.ranks ? (fetched.ranks[0] || null) : fetched;
            }
            
            this.state.setLoggedInUser(responseData.uid, user);
            this.renderUserSummaryPanel(user);
            
            // 显示调试面板（仅管理员）
            if (this.state.isAdmin) {
                const debugPanel = document.getElementById('debug-panel');
                if (debugPanel) debugPanel.style.display = 'block';
                this.setupAdminSharelinkControls();
            }
            
            // 渲染每日一题
            if (problem) {
                const isClockToday = responseData.isClockToday;
                const hasPassed = responseData.isAcBefore || false;
                this.renderDailyProblem(problem, isClockToday, hasPassed);
            } else {
                this.renderDailyError("今日暂无题目");
            }
            
            // 重新渲染日历（复用 todayinfo 的统计数据，避免再次请求）
            this.renderCalendarWithTodayInfo(responseData);
            
            eventBus.emit(EVENTS.DAILY_PROBLEM_LOADED, { problem, user });
            // 初始化内联视频播放器的展开/收起
            this.setupInlineVideoControls();
            if (this.state.isAdmin) {
                this.setupAdminSharelinkControls();
            }
        } catch (error) {
            console.error('Failed to load daily tab data:', error);
            this.renderDailyError(`加载失败: ${error.message}`);
            if (this.elements.userSummaryPanel) {
                this.elements.userSummaryPanel.innerHTML = `<p class="error">加载失败</p>`;
            }
            eventBus.emit(EVENTS.DATA_ERROR, { module: 'daily', error });
        }
    }

    // 内联视频播放器（使用写死的B站嵌入地址）
    setupInlineVideoControls() {
        const toggleBtn = document.getElementById('inline-video-toggle');
        const layout = document.getElementById('inline-video-layout');
        const container = document.getElementById('inline-video-container');
        const sidebar = document.getElementById('inline-video-sidebar');
        if (!toggleBtn || !layout || !container || !sidebar) return;

        if (toggleBtn.dataset.bound) return;
        toggleBtn.dataset.bound = '1';

        const createSafeIframe = () => {
            const raw = this.currentVideoEmbedSrc || '';
            if (!raw) return null;
            let url = raw.startsWith('//') ? `https:${raw}` : raw;
            // 追加时间戳避免播放器缓存
            url += (url.includes('?') ? '&' : '?') + `_ts=${Date.now()}`;
            try {
                const u = new URL(url);
                const allowedHosts = new Set(['player.bilibili.com']);
                if (!allowedHosts.has(u.hostname)) return null;
            } catch (_) { return null; }

            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('loading', 'lazy');
            iframe.setAttribute('referrerpolicy', 'no-referrer');
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
            iframe.setAttribute('allow', 'fullscreen; picture-in-picture');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = '0';
            return iframe;
        };

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = layout.style.display !== 'none';
            if (isOpen) {
                layout.style.display = 'none';
                container.innerHTML = '';
                toggleBtn.textContent = '展开播放';
                return;
            }
            container.innerHTML = '';
            layout.style.display = 'flex';
            toggleBtn.textContent = '收起';

            // 渲染右侧年月-日列表
            this.renderInlineVideoSidebar(sidebar, (dateStr) => {
                // 点击日播放视频：每次重建 iframe 以应用对应日期的地址
                container.innerHTML = '';
                const ifr = createSafeIframe();
                if (ifr) container.appendChild(ifr);
                // 高亮选择
                sidebar.querySelectorAll('.video-day').forEach(el => el.classList.remove('is-selected'));
                const dayEl = sidebar.querySelector(`[data-date="${dateStr}"]`);
                if (dayEl) dayEl.classList.add('is-selected');
                // 滚动到播放器顶部
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    // 根据是否有有效视频地址更新按钮可用状态（允许无地址也能展开侧栏）
    updateInlineVideoToggleState() {
        const toggleBtn = document.getElementById('inline-video-toggle');
        const layout = document.getElementById('inline-video-layout');
        if (!toggleBtn || !layout) return;
        // 不再禁用按钮；仅在需要时复位布局与容器
        const container = document.getElementById('inline-video-container');
        if (layout.style.display === 'none' && container) container.innerHTML = '';
        toggleBtn.classList.remove('is-disabled');
        toggleBtn.removeAttribute('aria-disabled');
    }

    // --- 管理员：设置某日分享链接 ---
    setupAdminSharelinkControls() {
        if (!this.state.isAdmin) return;
        const banner = document.getElementById('daily-video-banner');
        if (!banner) return;
        // 工具栏：放在“视频讲解”横幅的上方
        const parent = banner.parentElement;
        let toolbar = document.getElementById('admin-sharelink-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = 'admin-sharelink-toolbar';
            toolbar.className = 'admin-toolbar';
            parent.insertBefore(toolbar, banner);
        }

        // 触发按钮
        let trigger = document.getElementById('admin-sharelink-trigger');
        if (!trigger) {
            trigger = document.createElement('button');
            trigger.id = 'admin-sharelink-trigger';
            trigger.className = 'admin-btn';
            trigger.textContent = '🛠 设置分享链接';
            toolbar.appendChild(trigger);
        }

        // 面板容器（紧跟视频横幅后）
        let panel = document.getElementById('admin-sharelink-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'admin-sharelink-panel';
            panel.className = 'admin-sharelink-panel';
            panel.style.display = 'none';
            banner.insertAdjacentElement('afterend', panel);
            panel.innerHTML = this.buildAdminSharelinkPanelHtml();
            this.bindAdminSharelinkPanelEvents(panel);
        }

        trigger.onclick = () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        };
    }

    buildAdminSharelinkPanelHtml() {
        const today = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
        return `
            <div class="row">
                <label for="admin-share-date">日期</label>
                <input id="admin-share-date" type="date" value="${todayStr}">
            </div>
            <div class="row">
                <label for="admin-share-link">嵌入代码</label>
                <input id="admin-share-link" type="text" placeholder="粘贴B站iframe嵌入代码或src">
            </div>
            <div class="admin-sharelink-actions">
                <button id="admin-share-save" class="admin-btn">保存</button>
                <button id="admin-share-cancel" class="admin-btn" style="background:#f5f5f5;color:#333;">取消</button>
            </div>
        `;
    }

    bindAdminSharelinkPanelEvents(panel) {
        const saveBtn = panel.querySelector('#admin-share-save');
        const cancelBtn = panel.querySelector('#admin-share-cancel');
        const dateInput = panel.querySelector('#admin-share-date');
        const linkInput = panel.querySelector('#admin-share-link');

        cancelBtn.onclick = () => { panel.style.display = 'none'; };

        saveBtn.onclick = async () => {
            const dateStr = dateInput.value;
            const link = linkInput.value.trim();
            if (!dateStr || !link) {
                alert('请填写日期与嵌入代码');
                return;
            }
            try {
                // 先调用后端接口
                await this.apiService.setDailyShareLink(dateStr, link);

                // 同步写本地缓存，便于后续读取
                const cacheKey = 'admin.daily.sharelinks';
                const map = JSON.parse(localStorage.getItem(cacheKey) || '{}');
                map[dateStr] = link;
                localStorage.setItem(cacheKey, JSON.stringify(map));

                alert('已保存');
                panel.style.display = 'none';
            } catch (e) {
                console.error('保存分享链接失败:', e);
                alert('保存失败：' + e.message);
            }
        };
    }

    renderInlineVideoSidebar(sidebar, onSelectDate) {
        // 生成从 2025-09 起到本月的年月列表；默认展开当月
        const now = new Date();
        const earliest = new Date(2025, 8, 1); // 最早月份：2025-09
        const ymList = [];
        let cursor = new Date(now.getFullYear(), now.getMonth(), 1);
        // 以“年-月”维度比较，确保 2025-09 能被包含进来
        while (
            cursor.getFullYear() > earliest.getFullYear() ||
            (cursor.getFullYear() === earliest.getFullYear() && cursor.getMonth() >= earliest.getMonth())
        ) {
            ymList.push({ y: cursor.getFullYear(), m: cursor.getMonth() + 1 });
            cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
        }

        const getDaysInMonth = (y, m) => new Date(y, m, 0).getDate();
        const pad = (n) => String(n).padStart(2, '0');
        // 提取嵌入 src 的工具
        const extractEmbedSrc = (raw) => {
            if (!raw) return '';
            const text = String(raw);
            const m1 = text.match(/src\s*=\s*"([^"]+)"/i);
            const m2 = text.match(/src\s*=\s*'([^']+)'/i);
            const fromAttr = (m1 && m1[1]) || (m2 && m2[1]);
            if (fromAttr) return fromAttr.trim();
            if (/^(https?:)?\/\//i.test(text)) return text.trim();
            return '';
        };

        sidebar.innerHTML = ymList.map(({ y, m }) => {
            const isCurrent = y === now.getFullYear() && m === (now.getMonth() + 1);
            const days = getDaysInMonth(y, m);
            // 2025-09 从 27 日开始，其它月份从 1 日开始
            const startDay = (y === 2025 && m === 9) ? 27 : 1;
            const endDay = isCurrent ? now.getDate() : days;
            const list = [];
            for (let day = startDay; day <= endDay; day++) {
                const dateStr = `${y}-${pad(m)}-${pad(day)}`;
                const isToday = isCurrent && day === now.getDate();
                list.push(`<div class="video-day${isToday ? ' is-today' : ''}" data-date="${dateStr}" data-disabled="0"></div>`);
            }
            const daysHtml = list.join('');
            return `
                <div class="video-ym${isCurrent ? ' open' : ''}" data-ym="${y}-${pad(m)}">
                    <div class="video-ym__header">${y}年${pad(m)}月 <span>${isCurrent ? '▾' : '▸'}</span></div>
                    <div class="video-ym__days">${daysHtml}</div>
                </div>
            `;
        }).join('');

        // 绑定折叠
        sidebar.querySelectorAll('.video-ym').forEach(section => {
            const header = section.querySelector('.video-ym__header');
            const daysEl = section.querySelector('.video-ym__days');
            header.addEventListener('click', () => {
                const isOpen = section.classList.toggle('open');
                header.querySelector('span').textContent = isOpen ? '▾' : '▸';
                if (isOpen) {
                    daysEl.style.display = 'grid';
                    // 首次展开时加载该月的 shareLink 并标记禁用态
                    if (section.dataset.loaded !== '1') {
                        section.dataset.loaded = '1';
                        const ym = section.getAttribute('data-ym');
                        const [yy, mm] = ym.split('-').map(n => parseInt(n, 10));
                        this.apiService.fetchMonthInfo(yy, mm).then(arr => {
                            const map = new Map();
                            (arr || []).forEach(d => {
                                // 后端字段：createTime 和 shareLink
                                let date = new Date(d.createTime);
                                const ds = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
                                map.set(ds, d.shareLink || '');
                            });
                            daysEl.querySelectorAll('.video-day').forEach(dayEl => {
                                const ds = dayEl.getAttribute('data-date');
                                const raw = map.get(ds) || '';
                                const src = extractEmbedSrc(raw);
                                if (src) {
                                    dayEl.dataset.embedSrc = src;
                                    dayEl.dataset.disabled = '0';
                                } else if (raw && String(raw).trim()) {
                                    dayEl.dataset.embedRaw = String(raw).trim();
                                    dayEl.dataset.disabled = '0';
                                } else {
                                    dayEl.classList.add('is-disabled');
                                    dayEl.dataset.disabled = '1';
                                }
                                // 渲染日号文本
                                if (!dayEl.textContent) {
                                    dayEl.textContent = String(parseInt(ds.split('-')[2], 10));
                                }
                            });
                        }).catch(() => {});
                    }
                } else {
                    daysEl.style.display = 'none';
                }
            });
        });

        // 绑定日点击（优先使用 monthinfo 预加载的 shareLink；若只有占位raw则回退请求 daylink 解析）
        sidebar.querySelectorAll('.video-day').forEach(dayEl => {
            dayEl.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dateStr = dayEl.dataset.date;
                // 禁用项不可点击
                if (dayEl.dataset.disabled === '1') return;
                try {
                    let src = dayEl.dataset.embedSrc || '';
                    if (!src && dayEl.dataset.embedRaw) {
                        const r = await this.apiService.fetchDailyDayLink(dateStr);
                        src = r.src || '';
                        if (src) dayEl.dataset.embedSrc = src;
                    }
                    this.currentVideoEmbedSrc = src || '';
                    // 若为空，则将该日置为禁用并清空播放器
                    if (!this.currentVideoEmbedSrc) {
                        dayEl.classList.add('is-disabled');
                        dayEl.dataset.disabled = '1';
                        const container = document.getElementById('inline-video-container');
                        if (container) container.innerHTML = '';
                    }
                } catch (_) {
                    this.currentVideoEmbedSrc = '';
                }
                if (onSelectDate) onSelectDate(dateStr);
            });
        });

        // 预加载当前打开月份的数据后再进行默认选中
        const openSection = sidebar.querySelector('.video-ym.open');
        if (openSection) {
            const [yy, mm] = openSection.getAttribute('data-ym').split('-').map(n => parseInt(n, 10));
            this.apiService.fetchMonthInfo(yy, mm).then(arr => {
                const map = new Map();
                (arr || []).forEach(d => {
                    let date = new Date(d.createTime);
                    const ds = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
                    map.set(ds, d.shareLink || '');
                });
                const daysEl = openSection.querySelector('.video-ym__days');
                daysEl.querySelectorAll('.video-day').forEach(dayEl => {
                    const ds = dayEl.getAttribute('data-date');
                    const raw = map.get(ds) || '';
                    const src = extractEmbedSrc(raw);
                    if (src) {
                        dayEl.dataset.embedSrc = src;
                        dayEl.dataset.disabled = '0';
                    } else if (raw && String(raw).trim()) {
                        dayEl.dataset.embedRaw = String(raw).trim();
                        dayEl.dataset.disabled = '0';
                    } else {
                        dayEl.classList.add('is-disabled');
                        dayEl.dataset.disabled = '1';
                    }
                    if (!dayEl.textContent) {
                        dayEl.textContent = String(parseInt(ds.split('-')[2], 10));
                    }
                });
                // 默认选中：优先今天且未禁用，否则选中当月第一个未禁用的日
                let defaultEl = openSection.querySelector('.video-day.is-today:not(.is-disabled)');
                if (!defaultEl) defaultEl = openSection.querySelector('.video-day:not(.is-disabled)');
                if (defaultEl) defaultEl.click();
            }).catch(() => {
                // 即使失败也尝试点击一个日
                let defaultEl = openSection.querySelector('.video-day');
                if (defaultEl) defaultEl.click();
            });
        }
    }
    
    renderDailyProblem(problem, isClockToday, hasPassedPreviously = false) {
        const problemUrl = this.buildUrlWithChannelPut(problem.url);
        let buttonHtml;
        let preButtonText = '';
        // 顶部统计（题目标题上方）
        let topStatsHtml = '';

        if (this.todayInfoExtras) {
            const cnt = this.todayInfoExtras.todayClockCount || 0;
            const rank = this.todayInfoExtras.todayClockRank || 0;
            const rankText = rank > 0 ? `您是第 <span class="stats-highlight">${rank}</span> 个打卡` : '您还未打卡';
            topStatsHtml = `
                <div class="daily-top-stats">今日共 <span class="stats-highlight">${cnt}</span> 人打卡，${rankText}</div>
            `;
        }
        
        // ---- 调试信息 ----
        console.log('--- 渲染“每日一题”按钮调试信息 ---');
        console.log(`是否管理员 (this.state.isAdmin):`, this.state.isAdmin);
        console.log(`今日是否已打卡 (isClockToday):`, isClockToday);
        console.log(`以前是否做过此题 (hasPassedPreviously):`, hasPassedPreviously);
        console.log('------------------------------------');

        if (isClockToday) {
            // ------------------ 暗门/彩蛋逻辑开始 ------------------
            const now = new Date();
            // 定义北京时间 2025-10-24 19:00 到 21:00 的时间窗口
            // 使用 ISO 8601 格式并指定 +08:00 时区，确保不依赖用户本地时间
            const startTime = new Date('2025-10-24T19:00:00+08:00');
            const endTime = new Date('2025-10-24T23:59:59+08:00');

            //测试用时间
            // const startTime = new Date('2025-10-21T14:00:00+08:00');
            // const endTime = new Date('2025-10-21T15:00:00+08:00');

            let successMessage = ``; // 默认不显示牛币信息，保持UI简洁

            // 检查当前时间是否在指定的时间窗口内
            if (now.getTime() >= startTime.getTime() && now.getTime() < endTime.getTime()) {
                // 在特定时间段显示特殊文案
                successMessage = '1024神秘代码：<span class="stats-highlight easter-egg">c58940c92d804f5fa1f04159ffa3ed3a</span>';
            }
            // ------------------ 暗门/彩蛋逻辑结束 ------------------

            preButtonText = `<p class="ac-status-note">${successMessage}</p>`;
            buttonHtml = `
                <div class="checked-in-actions">
                    <span class="check-in-status">已打卡 ✔</span>
                    <button id="daily-share-btn" class="share-btn">分享</button>
                </div>
            `;
        } else if (hasPassedPreviously) {
            preButtonText = `<p class="ac-status-note">检测到该题你已通过</p>`;
            buttonHtml = `
                <div class="checked-in-actions">
                    <button id="daily-check-in-btn" class="go-to-problem-btn check-in-prompt">打卡</button>
                    ${this.state.isAdmin ? '<button id="admin-check-in-btn" class="go-to-problem-btn check-in-prompt" style="background-color: #ff5722;">一键打卡</button>' : ''}
                    <button id="daily-share-btn" class="share-btn">分享</button>
                </div>
            `;
        } else {
            buttonHtml = `
                <div class="checked-in-actions">
                    <button id="daily-problem-btn" class="go-to-problem-btn" data-url="${problemUrl}">做题</button>
                    ${this.state.isAdmin ? '<button id="admin-check-in-btn" class="go-to-problem-btn check-in-prompt" style="background-color: #ff5722;">一键打卡</button>' : ''}
                    <button id="daily-share-btn" class="share-btn">分享</button>
                </div>
            `;
        }

        // Generate difficulty display
        let difficultyHtml = '';
        if (problem.difficultyScore) {
            const difficultyInfo = helpers.getDifficultyInfo(problem.difficultyScore);
            const difficultyText = helpers.getDifficultyText(difficultyInfo.class, problem.difficultyScore);
            difficultyHtml = `<div class="daily-difficulty">${difficultyText}</div>`;
        }

        const html = `
            <div class="daily-problem-card">
                <h3><a href="${problemUrl}" class="problem-title-link" target="_blank" rel="noopener noreferrer" title="${problem.title}">${problem.title}</a></h3>
                ${difficultyHtml}
                <div class="daily-action-container">
                    ${preButtonText}
                    ${buttonHtml}
                </div>
                ${topStatsHtml}
            </div>
        `;
        this.elements.dailyProblemContainer.innerHTML = html;
        
        // 更新牛客娘图片
        const niukeniangImg = document.querySelector('.niukeniang-large-img');
        if (niukeniangImg) {
            const niukeniangImageUrl = isClockToday 
                ? 'https://uploadfiles.nowcoder.com/images/20250930/8582211_1759225952801/F83002401CD126D301FB79B1EB6C3B57'
                : 'https://uploadfiles.nowcoder.com/images/20250930/8582211_1759202242068/03A36C11AC533C18438C8FB323B1AAAB';
            niukeniangImg.src = niukeniangImageUrl;
        }
        
        // 绑定事件监听器
        this.bindDailyEvents(problem, isClockToday, hasPassedPreviously);
    }
    
    bindDailyEvents(problem, isClockToday, hasPassedPreviously) {
        const checkInButton = document.getElementById('daily-check-in-btn');
        if (checkInButton) {
            checkInButton.addEventListener('click', () => this.handleCheckIn());
        }

        const adminCheckInButton = document.getElementById('admin-check-in-btn');
        if (adminCheckInButton) {
            adminCheckInButton.addEventListener('click', () => this.handleAdminCheckInBypass());
        }
        
        const problemButton = document.getElementById('daily-problem-btn');
        if (problemButton) {
            problemButton.addEventListener('click', () => {
                const url = problemButton.getAttribute('data-url');
                if (url) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            });
        }
        
        const shareButton = document.getElementById('daily-share-btn');
        if (shareButton) {
            shareButton.addEventListener('click', () => this.handleShare(problem, isClockToday, hasPassedPreviously));
        }
    }
    
    async handleCheckIn() {
        try {
            if (!this.state.currentDailyProblem || !this.state.currentDailyProblem.problemId) {
                throw new Error('今日暂无题目可以打卡');
            }
            
            const result = await this.apiService.checkInDailyProblem(this.state.currentDailyProblem.problemId);
            
            if (result.code !== 0) {
                throw new Error(result.msg || '打卡失败');
            }
            
            // 刷新整个每日一题视图以显示更新后的状态
            await this.loadAndRenderDailyTab();
            
            eventBus.emit(EVENTS.CHECK_IN_SUCCESS, { problem: this.state.currentDailyProblem });
        } catch (error) {
            console.error('Check-in failed:', error);
            alert(`打卡失败: ${error.message}`);
            eventBus.emit(EVENTS.DATA_ERROR, { module: 'daily', error });
        }
    }
    
    async handleAdminCheckInBypass() {
        try {
            if (!this.state.currentDailyProblem || !this.state.currentDailyProblem.problemId) {
                throw new Error('今日暂无题目可以打卡');
            }
            
            // 仍然执行实际的打卡操作
            const result = await this.apiService.checkInDailyProblem(this.state.currentDailyProblem.problemId);
            
            if (result.code !== 0) {
                throw new Error(result.msg || '打卡失败');
            }
            
            // 打卡成功后，手动将UI渲染成“已通过但未打卡”的状态，而不是完全刷新
            // 用户需要再点一次“打卡”来看到最终的“已打卡”状态
            this.renderDailyProblem(this.state.currentDailyProblem, false, true);
            
            // 在后台更新日历
            this.renderCalendar();
            
            eventBus.emit(EVENTS.CHECK_IN_SUCCESS, { problem: this.state.currentDailyProblem });
        } catch (error) {
            console.error('Admin Check-in Bypass failed:', error);
            alert(`管理员操作失败: ${error.message}`);
            eventBus.emit(EVENTS.DATA_ERROR, { module: 'daily', error });
        }
    }
    
    handleShare(problem, isClockToday, hasPassedPreviously) {
        // 优先复制文本到剪贴板，其次降级到系统分享/手动复制
        let shareText;
        if (!isClockToday && !hasPassedPreviously) {
            shareText = `我做不出今天的每日一题：${problem.title}，我猜你也做不出来！`;
        } else {
            shareText = `我在牛客网完成了每日一题：${problem.title}！`;
        }
        const shareUrl = window.location.href;
        const content = `${shareText}\n${shareUrl}`;

        const copyByTextarea = (text) => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.top = '-9999px';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (ok) return Promise.resolve();
                return Promise.reject(new Error('execCommand copy failed'));
            } catch (e) {
                return Promise.reject(e);
            }
        };

        const tryClipboard = async () => {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(content);
                return true;
            }
            await copyByTextarea(content);
            return true;
        };

        tryClipboard()
            .then(() => {
                alert('分享文案已复制到剪贴板！');
            })
            .catch(async () => {
        if (navigator.share) {
                    try {
                        await navigator.share({ title: '每日一题打卡', text: shareText, url: shareUrl });
                    } catch (_) {
                        alert('无法复制或分享，请手动复制：\n' + content);
                    }
        } else {
                    alert('无法复制或分享，请手动复制：\n' + content);
                }
            });
    }
    
    renderDailyLoading(message = "") {
        const messageHtml = message ? `<p class="loading-message">${message}</p>` : '';
        this.elements.dailyProblemContainer.innerHTML = `<div class="loading-spinner"></div>${messageHtml}`;
    }
    
    renderDailyError(message) {
        this.elements.dailyProblemContainer.innerHTML = `<p class="error">${message}</p>`;
    }
    
    async renderCalendar() {
        if (!this.elements.calendarGrid) return;
        
        const year = this.state.calendarDate.getFullYear();
        const month = this.state.calendarDate.getMonth() + 1; // API expects 1-12
        
        let checkedInDays = new Set();
        let monthInfo = [];
        let solvedDailyQids = new Set(); // 新增：用于存储当月已通过的每日一题ID

        try {
            // Step 1: 先获取当月的所有每日一题
            monthInfo = await this.apiService.fetchMonthInfo(year, month);
            
            // 如果用户已登录并且当月有题目，则继续获取打卡和AC状态
            if (this.state.isLoggedIn() && monthInfo.length > 0) {
                const qids = monthInfo.map(day => day.problemId).filter(Boolean).map(String);
                
                // Step 2: 并行获取打卡记录和当月题目的AC状态
                const [checkedInData, diffData] = await Promise.all([
                    this.apiService.fetchCheckInList(year, month),
                    this.apiService.fetchUserProblemDiff(this.state.loggedInUserId, qids.join(','))
                ]);
                
                checkedInDays = checkedInData;
                
                // 从diff结果中提取已解决的题目ID
                // API返回的字段是ac1Qids
                if (diffData && diffData.ac1Qids) {
                    solvedDailyQids = new Set(diffData.ac1Qids.map(String));
                }
            } else if (this.state.isLoggedIn()) {
                 // 即使没有题目，也可能需要获取打卡记录（例如空月份）
            checkedInDays = await this.apiService.fetchCheckInList(year, month);
            }
            // [Old Promise.all removed]

            // ---- 调试信息 ----
            console.log('[Calendar Debug] Fetched month info data:', monthInfo);
            if (monthInfo && monthInfo.length > 0) {
                console.log('[Calendar Debug] Structure of the first item:', monthInfo[0]);
            }

        } catch (error) {
            console.error("Error fetching calendar data:", error);
        }

        // 将 monthInfo 转换为 Map，方便快速查找
        // 使用 createTime 并将其转换为 YYYY-MM-DD 格式作为 key
        const monthInfoMap = new Map(monthInfo.map(day => {
            const date = new Date(day.createTime);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return [dateStr, { ...day, problemId: String(day.problemId) }]; // 确保 problemId 是字符串
        }));
        
        // 合并模拟打卡数据
        this.state.simulatedCheckIns.forEach(day => checkedInDays.add(day));
        
        // 不在这里调用 todayinfo；统计在 loadAndRenderDailyTab 中已获取
        
        // 渲染日历网格
        this.renderCalendarGrid(year, month, checkedInDays, monthInfoMap, solvedDailyQids);
    }

    // 基于 todayinfo 直接渲染日历与统计，避免再次请求 todayinfo
    async renderCalendarWithTodayInfo(responseData) {
        if (!this.elements.calendarGrid) return;
        const year = this.state.calendarDate.getFullYear();
        const month = this.state.calendarDate.getMonth() + 1;

        let checkedInDays = new Set();
        let monthInfo = [];
        let solvedDailyQids = new Set();

        try {
            monthInfo = await this.apiService.fetchMonthInfo(year, month);
            if (this.state.isLoggedIn() && monthInfo.length > 0) {
                const qids = monthInfo.map(day => day.problemId).filter(Boolean).map(String);
                const [checkedInData, diffData] = await Promise.all([
                    this.apiService.fetchCheckInList(year, month),
                    this.apiService.fetchUserProblemDiff(this.state.loggedInUserId, qids.join(','))
                ]);
                checkedInDays = checkedInData;
                if (diffData && diffData.ac1Qids) {
                    solvedDailyQids = new Set(diffData.ac1Qids.map(String));
                }
            } else if (this.state.isLoggedIn()) {
                checkedInDays = await this.apiService.fetchCheckInList(year, month);
            }
        } catch (e) {
            console.error('Error fetching calendar data:', e);
        }

        // 直接从 todayinfo 的 responseData 中解析统计
        // 连续天数：若 todayClockRank=0 且 yesterdayClockCount=0，则强制视为0
        const todayRank = Number(this.todayInfoExtras?.todayClockRank) || 0;
        const yCnt = Number(this.todayInfoExtras?.yesterdayClockCount) || 0;
        let continueDay = Number(responseData.continueDay) || 0;
        if (todayRank === 0 && yCnt === 0) {
            continueDay = 0;
        }
        const countDay = Number(responseData.countDay) || 0;
        this.renderCalendarStats(
            { consecutiveDays: continueDay, totalDays: countDay },
            checkedInDays,
            {
                todayClockCount: Number(responseData.todayClockCount) || 0,
                todayClockRank: todayRank,
                yesterdayClockCount: yCnt
            }
        );

        const monthInfoMap = new Map(monthInfo.map(day => {
            const date = new Date(day.createTime);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return [dateStr, { ...day, problemId: String(day.problemId) }];
        }));

        this.state.simulatedCheckIns.forEach(day => checkedInDays.add(day));
        this.renderCalendarGrid(year, month, checkedInDays, monthInfoMap, solvedDailyQids);
    }
    
    renderCalendarGrid(year, month, checkedInDays, monthInfoMap, solvedDailyQids) {
        // 清除现有日期元素
        const dayElements = this.elements.calendarGrid.querySelectorAll('.calendar-day');
        dayElements.forEach(day => day.remove());
        
        this.elements.calendarMonthYear.textContent = `${year}年${month}月`;
        
        const firstDayOfMonth = new Date(year, month - 1, 1);
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDayOfWeek = firstDayOfMonth.getDay();
        
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
        
        // 渲染日历网格
        for (let i = 0; i < startDayOfWeek; i++) {
            this.elements.calendarGrid.appendChild(this.createCalendarDay(null, ['other-month'], null));
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const classes = [];
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            let dayInfo = monthInfoMap.get(dateStr);
            const isToday = isCurrentMonth && day === today.getDate();
            
            // If it's today and there's no specific info from monthInfo,
            // use the current daily problem from the state.
            if (isToday && !dayInfo && this.state.currentDailyProblem) {
                dayInfo = {
                    questionTitle: this.state.currentDailyProblem.title,
                    questionUrl: this.state.currentDailyProblem.url,
                    //... add any other relevant properties if needed
                };
            }
            
            if (isToday) {
                classes.push('today');
            }
            if (checkedInDays.has(dateStr)) {
                classes.push('checked-in');
            } else if (dayInfo && dayInfo.problemId && solvedDailyQids.has(dayInfo.problemId)) {
                // 如果未打卡，但题目已通过，则标记为“可补卡”
                classes.push('retro-checkin');
            }

            // 如果当天有题目，添加可点击样式和 data 属性
            if (dayInfo) {
                classes.push('has-problem');
            }

            const dayDiv = this.createCalendarDay(day, classes, dateStr, dayInfo);
            this.elements.calendarGrid.appendChild(dayDiv);
        }
        
        // 添加月末空白日期
        const totalCells = this.elements.calendarGrid.children.length - 7;
        const remainingCells = (7 - (totalCells % 7)) % 7;
        for (let i = 1; i <= remainingCells; i++) {
            this.elements.calendarGrid.appendChild(this.createCalendarDay(null, ['other-month'], null));
        }
    }
    
    createCalendarDay(day, classes, dateStr, dayInfo) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        if (classes.length > 0) {
            dayDiv.classList.add(...classes);
        }
        
        // If there's problem info for this day, add hover effects and click event
        // This should be independent of other classes like 'today'
        if (dayInfo) {
            dayDiv.classList.add('has-problem');
            dayDiv.dataset.problemTitle = dayInfo.questionTitle;
            dayDiv.dataset.problemUrl = dayInfo.questionUrl;

            dayDiv.addEventListener('mouseover', (e) => this.showTooltip(e));
            dayDiv.addEventListener('mousemove', (e) => this.moveTooltip(e));
            dayDiv.addEventListener('mouseout', () => this.hideTooltip());
            dayDiv.addEventListener('click', (e) => this.handleDayClick(e));
        }
        
        // Add a span inside for better control over the number's position
        if (day) {
            const numberSpan = document.createElement('span');
            numberSpan.className = 'calendar-day-number';
            numberSpan.textContent = day;
            dayDiv.appendChild(numberSpan);
        }

        if (dateStr) {
            dayDiv.dataset.date = dateStr;
        }
        
        return dayDiv;
    }
    
    // --- 新增 Tooltip 和点击处理方法 ---

    showTooltip(event) {
        const dayDiv = event.currentTarget;
        const title = dayDiv.dataset.problemTitle;
        const isCheckedIn = dayDiv.classList.contains('checked-in');
        const isRetro = dayDiv.classList.contains('retro-checkin');

        let status;
        if (isCheckedIn) {
            status = '<span class="status-checked-in">✔ 已打卡</span>';
        } else if (isRetro) {
            status = '<span class="status-retro-checkin">✔ 已补卡</span>';
        } else {
            status = '❌ 未打卡';
        }

        this.tooltip.innerHTML = `<strong>${title}</strong><br>${status}`;
        this.tooltip.style.display = 'block';
        this.moveTooltip(event);
    }

    moveTooltip(event) {
        this.tooltip.style.left = `${event.pageX + 10}px`;
        this.tooltip.style.top = `${event.pageY + 10}px`;
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }
    
    handleDayClick(event) {
        const dayDiv = event.currentTarget;
        const url = dayDiv.dataset.problemUrl;
        if (url) {
            window.open(this.buildUrlWithChannelPut(url), '_blank', 'noopener,noreferrer');
        }
    }
    
    renderCalendarStats(stats, checkedInDays = new Set(), todayInfoExtras = null) {
        const statsContainer = document.getElementById('calendar-stats');
        if (!statsContainer) return;
        
        // Check if today is checked in
        const today = new Date();
        const todayStr = this.formatDate(today);
        const isTodayCheckedIn = checkedInDays.has(todayStr);
        
        // Calculate today's coin reward
        let todayCoins = 0;
        if (isTodayCheckedIn) {
            // Base reward: 2 coins
            todayCoins = 2;
            
            // Bonus reward: 20 coins for every 7 consecutive days (day 7, 14, 21, etc.)
            if (stats.consecutiveDays > 0 && stats.consecutiveDays % 7 === 0) {
                todayCoins += 20;
            }
        }
        
        // Build the stats text（第一行：累计与连续）
        let statsHtml = `
            <p class="stats-text">
                已连续打卡 <span class="stats-highlight">${stats.consecutiveDays}</span> 天，
                共打卡 <span class="stats-highlight">${stats.totalDays}</span> 天`;
        
        // Add coin reward text if checked in today
        if (isTodayCheckedIn && todayCoins > 0) {
            statsHtml += `，今日已获得 <span class="stats-highlight" style="color: #ffd700;">${todayCoins}</span> 牛币`;
        }
        
        statsHtml += `</p>`;

        // 不再在右侧重复显示“今日共X人打卡...”，该信息已移动到卡片内部
        
        // Add coin exchange link
        statsHtml += `
            <p class="coin-exchange-link-container">
                <a href="https://www.nowcoder.com/coin/index" target="_blank" class="coin-exchange-link">
                    🛒 牛币兑换中心 →
                </a>
            </p>
        `;
        
        statsContainer.innerHTML = statsHtml;
    }
    
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    renderUserSummaryPanel(userData) {
        if (!this.elements.userSummaryPanel) return;

        // If user is not logged in, show a login prompt.
        if (!userData) {
            const loginUrl = 'https://ac.nowcoder.com/login?callBack=/';
            const html = `
                <div class="login-prompt">
                    <p class="prompt-title">登录后即可参与打卡</p>
                    <a href="${this.buildUrlWithChannelPut(loginUrl)}" target="_blank" rel="noopener noreferrer" class="login-btn">前往登录</a>
                    <p class="refresh-note">登录成功后，请手动刷新页面</p>
                </div>
            `;
            this.elements.userSummaryPanel.innerHTML = html;
            return;
        }

        const avatarUrl = userData.headUrl && userData.headUrl.startsWith('http') 
            ? userData.headUrl 
            : `${APP_CONFIG.NOWCODER_UI_BASE}${userData.headUrl || ''}`;
        const displayRank = userData.place === 0 ? '1w+' : userData.place;

        const html = `
            <div class="summary-header">
                <img src="${avatarUrl}" alt="${userData.name}'s avatar" class="summary-avatar">
                <span class="summary-nickname">${userData.name}</span>
            </div>
            <div class="summary-stats">
                <div class="stat-item">
                    <span class="label">过题数:</span>
                    <span class="value">${userData.count}</span>
                </div>
                <div class="stat-item">
                    <span class="label">全站排名:</span>
                    <span class="value">${displayRank}</span>
                </div>
            </div>
        `;
        this.elements.userSummaryPanel.innerHTML = html;
        this.initUserSummaryActions(); // Re-bind actions after rendering
    }
    
    buildUrlWithChannelPut(baseUrl, channelPut) {
        const effectiveChannelPut = channelPut || (this.state && this.state.channelPut) || 'w251acm';
        return helpers.buildUrlWithChannelPut(baseUrl, effectiveChannelPut);
    }
    
    initUserSummaryActions() {
        // 这里可以添加用户摘要面板的事件监听器
        // 比如点击排名链接等
    }
}
