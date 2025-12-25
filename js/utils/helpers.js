// 工具函数集合
import { APP_CONFIG } from '../config.js';

/**
 * 判断是否为有效的题目ID（“正常题目”口径：正整数）
 * @param {any} value
 * @returns {boolean}
 */
export function isValidProblemId(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0;
}

/**
 * 构建带有channelPut参数的URL
 * @param {string} baseUrl - 基础URL
 * @param {string} channelPut - 渠道参数
 * @returns {string} 完整URL
 */
export function buildUrlWithChannelPut(baseUrl, channelPut = 'tracker1') {
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
 * 获取对战等级分对应的段位信息
 * @param {number} rating - 等级分
 * @returns {object} 段位信息对象 {name: '青铜', color: '#cd7f32', gradient: '...', bgColor: '#faf5f0', textColor: '#5c4033', key: 'bronze'}
 */
export function getBattleRank(rating) {
    const ranks = APP_CONFIG.BATTLE_RANKS;
    const r = Number(rating);
    
    // 如果rating无效或为负数，默认返回黑铁段位
    if (isNaN(r) || r < 0) {
        const iron = ranks.iron;
        return {
            name: iron.name,
            color: iron.color,
            gradient: iron.gradient,
            bgColor: iron.bgColor,
            textColor: iron.textColor,
            key: 'iron'
        };
    }
    
    for (const [key, rank] of Object.entries(ranks)) {
        if (r >= rank.min && r <= rank.max) {
            return {
                name: rank.name,
                color: rank.color,
                gradient: rank.gradient,
                bgColor: rank.bgColor,
                textColor: rank.textColor,
                key: key
            };
        }
    }
    
    // 默认返回王者段位
    const legend = ranks.legend;
    return {
        name: legend.name,
        color: legend.color,
        gradient: legend.gradient,
        bgColor: legend.bgColor,
        textColor: legend.textColor,
        key: 'legend'
    };
}

/**
 * 将十六进制颜色转换为rgba格式
 * @param {string} hex - 十六进制颜色值（如 '#ff0000'）
 * @param {number} alpha - 透明度（0-1）
 * @returns {string} rgba颜色值
 */
export function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 获取对战等级分对应的颜色（使用段位颜色）
 * @param {number} rating - 等级分
 * @returns {string} 颜色值
 */
export function getRatingColor(rating) {
    const rank = getBattleRank(rating);
    return rank.color;
}

/**
 * 根据对战等级获取成就颜色（与成就分颜色映射保持一致）
 * @param {number} level - 对战等级
 * @returns {object} 包含主色和渐变色对象
 */
export function getBattleLevelColor(level) {
    const l = Number(level) || 1;
    
    // 根据等级映射成就分，然后使用成就分的颜色规则
    // 等级越高，对应的成就分越高
    // 假设等级 * 某个系数 = 成就分
    const estimatedPoints = l * 10; // 每个等级约等于10成就分
    
    // 成就分颜色映射规则（与AchievementsView.js中的pickRarityClass保持一致）
    if (estimatedPoints >= 200 || l >= 200) {
        return {
            primary: '#dc3545', // red
            gradient: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'
        };
    }
    if (estimatedPoints >= 100 || l >= 100) {
        return {
            primary: '#b8860b', // gold
            gradient: 'linear-gradient(135deg, #b8860b 0%, #daa520 100%)'
        };
    }
    if (estimatedPoints >= 50 || l >= 50) {
        return {
            primary: '#fd7e14', // orange
            gradient: 'linear-gradient(135deg, #fd7e14 0%, #e85d04 100%)'
        };
    }
    if (estimatedPoints >= 30 || l >= 30) {
        return {
            primary: '#6f42c1', // purple
            gradient: 'linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%)'
        };
    }
    if (estimatedPoints >= 20 || l >= 20) {
        return {
            primary: '#0d6efd', // blue
            gradient: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)'
        };
    }
    if (estimatedPoints >= 10 || l >= 10) {
        return {
            primary: '#28a745', // green
            gradient: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)'
        };
    }
    // 默认灰色
    return {
        primary: '#6c757d', // gray
        gradient: 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)'
    };
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

/**
 * 显示自定义提示框（用于替代原生 title 的视觉展示）
 * @param {HTMLElement} el - 触发元素
 * @param {string} text - 提示文本
 */
export function showCustomTooltip(el, text) {
    hideCustomTooltip();
    if (!el || text == null) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';

    // 轻量转义，避免 title 中的特殊字符导致注入；同时支持换行
    const safe = String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, '<br>');
    tooltip.innerHTML = safe;

    document.body.appendChild(tooltip);

    const rect = el.getBoundingClientRect();
    // 默认显示在元素上方；若空间不足，尽量贴近顶部
    const top = rect.top + window.scrollY - tooltip.offsetHeight - 6;
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${Math.max(0, top)}px`;
    tooltip.style.opacity = '1';
}

