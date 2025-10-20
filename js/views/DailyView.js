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
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.tooltip = document.getElementById('calendar-tooltip'); // 获取 tooltip 元素
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
        });
    }
    
    async loadAndRenderDailyTab() {
        this.renderDailyLoading();
        if (this.elements.userSummaryPanel) {
            this.elements.userSummaryPanel.innerHTML = '<div class="loading-spinner"></div>';
        }
        
        try {
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
                
                if (problem) {
                    this.renderDailyProblem(problem, false, false);
                } else {
                    this.renderDailyError("今日暂无题目");
                }
                
                this.renderCalendar();
                return;
            }
            
            if (data && data.code !== 0) {
                throw new Error(`API错误: ${data.msg}`);
            }
            
            // 处理登录用户的数据
            const responseData = data.data;
            const userId = responseData.uid && responseData.uid !== 0 ? String(responseData.uid) : null;
            this.state.setLoggedInUser(userId, responseData.user || null);
            
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
            
            // 获取用户数据
            let user = responseData.user || null;
            if (!user && responseData.uid && responseData.uid !== 0) {
                user = await this.apiService.fetchUserData(responseData.uid);
            }
            
            this.state.setLoggedInUser(responseData.uid, user);
            this.renderUserSummaryPanel(user);
            
            // 显示调试面板（仅管理员）
            if (this.state.loggedInUserId === '919247') {
                const debugPanel = document.getElementById('debug-panel');
                if (debugPanel) debugPanel.style.display = 'block';
            }
            
            // 渲染每日一题
            if (problem) {
                const isClockToday = responseData.isClockToday;
                const hasPassed = responseData.isAcBefore || false;
                this.renderDailyProblem(problem, isClockToday, hasPassed);
            } else {
                this.renderDailyError("今日暂无题目");
            }
            
            // 重新渲染日历
            this.renderCalendar();
            
            eventBus.emit(EVENTS.DAILY_PROBLEM_LOADED, { problem, user });
        } catch (error) {
            console.error('Failed to load daily tab data:', error);
            this.renderDailyError(`加载失败: ${error.message}`);
            if (this.elements.userSummaryPanel) {
                this.elements.userSummaryPanel.innerHTML = `<p class="error">加载失败</p>`;
            }
            eventBus.emit(EVENTS.DATA_ERROR, { module: 'daily', error });
        }
    }
    
    renderDailyProblem(problem, isClockToday, hasPassedPreviously = false) {
        const problemUrl = this.buildUrlWithChannelPut(problem.url);
        let buttonHtml;
        let preButtonText = '';
        
        // ---- 调试信息 ----
        console.log('--- 渲染“每日一题”按钮调试信息 ---');
        console.log(`是否管理员 (this.state.isAdmin):`, this.state.isAdmin);
        console.log(`今日是否已打卡 (isClockToday):`, isClockToday);
        console.log(`以前是否做过此题 (hasPassedPreviously):`, hasPassedPreviously);
        console.log('------------------------------------');

        if (isClockToday) {
            preButtonText = ''; // Removed: <p class="ac-status-note">今日已获得<span class="stats-highlight" style="color: #ffd700;">${this.state.todayCoinReward}</span>牛币</p>
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
        // 实现分享功能
        const shareText = `我在牛客网完成了每日一题：${problem.title}！`;
        const shareUrl = window.location.href;
        
        if (navigator.share) {
            navigator.share({
                title: '每日一题打卡',
                text: shareText,
                url: shareUrl
            });
        } else {
            // 复制到剪贴板
            navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => {
                alert('分享链接已复制到剪贴板！');
            }).catch(() => {
                alert('分享功能暂不可用');
            });
        }
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
        try {
            // 并行获取打卡记录和当月题目信息
            const [checkedInData, monthInfoData] = await Promise.all([
                this.apiService.fetchCheckInList(year, month),
                this.apiService.fetchMonthInfo(year, month)
            ]);
            checkedInDays = checkedInData;
            monthInfo = monthInfoData;
            
            // ---- 调试信息 ----
            console.log('[Calendar Debug] Fetched month info data:', monthInfoData);
            if (monthInfoData && monthInfoData.length > 0) {
                console.log('[Calendar Debug] Structure of the first item:', monthInfoData[0]);
            }

        } catch (error) {
            console.error("Error fetching calendar data:", error);
        }

        // 将 monthInfo 转换为 Map，方便快速查找
        // 使用 createTime 并将其转换为 YYYY-MM-DD 格式作为 key
        const monthInfoMap = new Map(monthInfo.map(day => {
            const date = new Date(day.createTime);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return [dateStr, day];
        }));
        
        // 合并模拟打卡数据
        this.state.simulatedCheckIns.forEach(day => checkedInDays.add(day));
        
        // 使用新的、更准确的 API 方法获取统计数据
        try {
            const stats = await this.apiService.fetchCheckInStats();
            if (stats) {
                this.renderCalendarStats(stats, checkedInDays);
            } else {
                // 作为回退，如果快速方法失败，可以显示基本信息
                this.renderCalendarStats({ consecutiveDays: 0, totalDays: checkedInDays.size }, checkedInDays);
            }
        } catch (e) {
            console.error("Error fetching check-in stats:", e);
        }
        
        // 渲染日历网格
        this.renderCalendarGrid(year, month, checkedInDays, monthInfoMap);
    }
    
    renderCalendarGrid(year, month, checkedInDays, monthInfoMap) {
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

                // 假设 monthInfoMap 中的条目会有一个 is_supplement 字段
                if (dayInfo && dayInfo.is_supplement) {
                    classes.push('supplement-check-in');
                }
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
        const isSupplement = dayDiv.classList.contains('supplement-check-in');

        let status;
        if (isSupplement) {
            status = '<span class="status-checked-in">✔ 已补卡</span>';
        } else if (isCheckedIn) {
            status = '<span class="status-checked-in">✔ 已打卡</span>';
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
    
    renderCalendarStats(stats, checkedInDays = new Set()) {
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
        
        // Build the stats text
        let statsHtml = `
            <p class="stats-text">
                已连续打卡 <span class="stats-highlight">${stats.consecutiveDays}</span> 天，
                共打卡 <span class="stats-highlight">${stats.totalDays}</span> 天`;
        
        // Add coin reward text if checked in today
        if (isTodayCheckedIn && todayCoins > 0) {
            statsHtml += `，今日已获得 <span class="stats-highlight" style="color: #ffd700;">${todayCoins}</span> 牛币`;
        }
        
        statsHtml += `
            </p>
        `;
        
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
                    <a href="#" id="summary-rank-link" class="rank-link">${displayRank}</a>
                </div>
            </div>
        `;
        this.elements.userSummaryPanel.innerHTML = html;
        this.initUserSummaryActions(); // Re-bind actions after rendering
    }
    
    buildUrlWithChannelPut(baseUrl, channelPut = APP_CONFIG.DEFAULT_CHANNEL_PUT) {
        if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
            return '';
        }
        try {
            const fullUrl = new URL(baseUrl, APP_CONFIG.NOWCODER_UI_BASE);
            fullUrl.searchParams.set('channelPut', channelPut);
            return fullUrl.href;
        } catch (e) {
            console.error(`Failed to construct URL for: "${baseUrl}"`, e);
            return '';
        }
    }
    
    initUserSummaryActions() {
        // 这里可以添加用户摘要面板的事件监听器
        // 比如点击排名链接等
    }
}
