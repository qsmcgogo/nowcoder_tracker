// 工具函数集合
import { APP_CONFIG } from '../config.js';

/**
 * 构建带有channelPut参数的URL
 * @param {string} baseUrl - 基础URL
 * @param {string} channelPut - 渠道参数
 * @returns {string} 完整URL
 */
export function buildUrlWithChannelPut(baseUrl, channelPut = 'w251acm') {
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

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 加载图片（Promise封装）
 * @param {string} src - 图片URL
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
    });
}

/**
 * 获取难度信息
 * @param {number} score - 难度分数
 * @returns {object} 难度类别和百分比
 */
export function getDifficultyInfo(score) {
    const ranges = APP_CONFIG.DIFFICULTY_RANGES;
    
    for (const [key, range] of Object.entries(ranges)) {
        if (score >= range.min && score <= range.max) {
            const percentage = Math.max(0, Math.min(1, (score - range.min) / (range.max - range.min)));
            return { 
                class: key, 
                percentage: percentage,
                range: range
            };
        }
    }
    
    // 默认返回legend
    return { 
        class: 'legend', 
        percentage: 1,
        range: ranges.legend
    };
}

/**
 * 获取难度圆圈样式
 * @param {object} difficultyInfo - 难度信息对象
 * @returns {string} CSS样式字符串
 */
export function getCircleStyle(difficultyInfo) {
    const color = APP_CONFIG.DIFFICULTY_COLORS[difficultyInfo.class];
    
    // Round the base percentage (0.0 to 1.0) to one decimal place
    const roundedBasePercentage = Math.round(difficultyInfo.percentage * 10) / 10;
    const fillPercentage = roundedBasePercentage * 100;

    // Use linear-gradient for a smooth, horizontal fill from bottom to top
    return `background: linear-gradient(to top, ${color} ${fillPercentage}%, transparent ${fillPercentage}%); border-color: ${color};`;
}

/**
 * 获取难度文本（带颜色）
 * @param {string} difficultyClass - 难度类别
 * @param {number} score - 难度分数
 * @returns {string} HTML字符串
 */
export function getDifficultyText(difficultyClass, score) {
    const range = APP_CONFIG.DIFFICULTY_RANGES[difficultyClass];
    if (!range) {
        return `<span style="color: #666666; font-weight: bold;">${score} (Unknown)</span>`;
    }
    
    return `<span style="color: ${range.color}; font-weight: bold;">${score} (${range.text})</span>`;
}

/**
 * 生成提示框内容
 * @param {object} problem - 题目对象
 * @param {boolean} isXCPC - 是否为XCPC比赛
 * @returns {string} 提示框内容
 */
export function generateTooltipContent(problem, isXCPC = false) {
    const acRate = problem.submissionCount > 0 
        ? ((problem.acCount / problem.submissionCount) * 100).toFixed(1) 
        : 'N/A';
    
    if (isXCPC) {
        return `Title: ${problem.title || 'N/A'}\nDifficulty: ${problem.difficultyScore || 'N/A'}\nSubmissions: ${(problem.submissionCount || 0).toLocaleString()}\nAC: ${(problem.acCount || 0).toLocaleString()} (${acRate}%)`;
    } else {
        return `Difficulty: ${problem.difficultyScore || 'N/A'}\nSubmissions: ${(problem.submissionCount || 0).toLocaleString()}\nAC: ${(problem.acCount || 0).toLocaleString()} (${acRate}%)`;
    }
}

/**
 * 创建分页链接元素
 * @param {number} page - 页码
 * @param {Function} handler - 点击处理函数
 * @param {boolean} isActive - 是否为当前页
 * @returns {HTMLElement} 分页链接元素
 */
export function createPageLink(page, handler, isActive = false) {
    const pageLink = document.createElement('a');
    pageLink.href = '#';
    pageLink.textContent = page;
    pageLink.className = `page-number ${isActive ? 'active' : ''}`;
    pageLink.dataset.page = page;
    pageLink.onclick = (e) => { 
        e.preventDefault(); 
        handler(page); 
    };
    return pageLink;
}

/**
 * 隐藏自定义提示框
 */
export function hideCustomTooltip() {
    const existingTooltip = document.querySelector('.custom-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
}

