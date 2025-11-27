// 应用配置常量
export const APP_CONFIG = {
    // API配置
    NOWCODER_UI_BASE: 'https://www.nowcoder.com',
    API_BASE: window.location.origin, // 使用当前域名，避免CORS问题
    
    // 分页配置
    CONTESTS_PAGE_SIZE: 30,
    PRACTICE_PAGE_SIZE: 100,
    RANKINGS_PAGE_SIZE: 20,
    INTERVIEW_PAGE_SIZE: 20,
    
    // 难度分数映射
    DIFFICULTY_SCORE_MAP: {
        1: 800,
        2: 1200,
        3: 1600,
        4: 2000,
        5: 2400,
        6: 2800,
        7: 3000,
        8: 3200,
        9: 3400,
        10: 3500
    },
    
    // 比赛类型映射
    CONTEST_TYPE_MAP: {
        'all': 0,
        'weekly': 19,
        'monthly': 9,
        'practice': 6,
        'challenge': 2,
        'xcpc': 22
    },
    
    // 难度颜色配置
    DIFFICULTY_COLORS: {
        easy: '#6c757d',
        medium: '#6f42c1',
        hard: '#007bff',
        expert: '#28a745',
        master: '#ffc107',
        grandmaster: '#fd7e14',
        legend: '#dc3545'
    },
    
    // 难度范围配置
    DIFFICULTY_RANGES: {
        easy: { min: 0, max: 699, text: 'Easy', color: '#52c41a' },
        medium: { min: 700, max: 1099, text: 'Medium', color: '#faad14' },
        hard: { min: 1100, max: 1499, text: 'Hard', color: '#ff4d4f' },
        expert: { min: 1500, max: 1999, text: 'Expert', color: '#722ed1' },
        master: { min: 2000, max: 2399, text: 'Master', color: '#eb2f96' },
        grandmaster: { min: 2400, max: 2799, text: 'Grandmaster', color: '#f5222d' },
        legend: { min: 2800, max: 3500, text: 'Legend', color: '#000000' }
    },
    
    // 牛客娘图片URL
    NIUKENIANG_IMAGES: {
        default: 'https://uploadfiles.nowcoder.com/images/20250930/8582211_1759202242068/03A36C11AC533C18438C8FB323B1AAAB',
        checked: 'https://uploadfiles.nowcoder.com/images/20250930/8582211_1759225952801/F83002401CD126D301FB79B1EB6C3B57'
    },
    
    // 打卡奖励配置
    CHECK_IN_REWARDS: {
        daily: 2,           // 每日基础奖励
        weekly_bonus: 20,   // 每7天奖励
        bonus_interval: 7   // 奖励间隔天数
    },
    
    // 对战域名配置（动态获取）
    BATTLE_DOMAIN: null, // 将在初始化时从服务器获取
    
    // 对战段位配置
    BATTLE_RANKS: {
        iron: { min: 0, max: 799, name: '黑铁', color: '#4a4a4a', gradient: 'linear-gradient(135deg, #4a4a4a 0%, #2d2d2d 100%)', bgColor: '#f5f5f5', textColor: '#333333' },
        bronze: { min: 800, max: 999, name: '青铜', color: '#cd7f32', gradient: 'linear-gradient(135deg, #cd7f32 0%, #b87333 100%)', bgColor: '#faf5f0', textColor: '#5c4033' },
        silver: { min: 1000, max: 1199, name: '白银', color: '#c0c0c0', gradient: 'linear-gradient(135deg, #c0c0c0 0%, #a8a8a8 100%)', bgColor: '#6c757d', textColor: '#ffffff' },
        gold: { min: 1200, max: 1399, name: '黄金', color: '#ffd700', gradient: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)', bgColor: '#fff9e6', textColor: '#856404' },
        platinum: { min: 1400, max: 1599, name: '白金', color: '#e5e4e2', gradient: 'linear-gradient(135deg, #e5e4e2 0%, #d3d3d3 100%)', bgColor: '#4a5568', textColor: '#ffffff' },
        diamond: { min: 1600, max: 1799, name: '钻石', color: '#b9f2ff', gradient: 'linear-gradient(135deg, #b9f2ff 0%, #87ceeb 100%)', bgColor: '#e6f7ff', textColor: '#0050b3' },
        master: { min: 1800, max: 1999, name: '大师', color: '#9b59b6', gradient: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)', bgColor: '#f3e5f5', textColor: '#6a1b9a' },
        grandmaster: { min: 2000, max: 2199, name: '宗师', color: '#e74c3c', gradient: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', bgColor: '#ffebee', textColor: '#c62828' },
        legend: { min: 2200, max: 9999, name: '王者', color: '#000000', gradient: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)', bgColor: '#1a1a1a', textColor: '#ffffff' }
    }
};

// 根据域名推断环境（仅作为最后的兜底方案）
function inferEnvironmentFromDomain() {
    const hostname = window.location.hostname;
    
    // 如果域名包含 dac 或 d.nowcoder，是开发环境
    if (hostname.includes('dac') || hostname.includes('d.nowcoder')) {
        return { env: 'd', battleDomain: 'dac.nowcoder.com' };
    }
    
    // 如果域名包含 preac 或 pre.nowcoder，是预发布环境
    if (hostname.includes('preac') || hostname.includes('pre.nowcoder')) {
        return { env: 'pre', battleDomain: 'preac.nowcoder.com' };
    }
    
    // 如果域名是 ac.nowcoder.com 或 www.nowcoder.com，是生产环境
    if (hostname.includes('ac.nowcoder.com') || hostname.includes('www.nowcoder.com')) {
        return { env: 'www', battleDomain: 'ac.nowcoder.com' };
    }
    
    // 默认返回生产环境（正式环境没有 proxy，直接使用 ac.nowcoder.com）
    return { env: 'www', battleDomain: 'ac.nowcoder.com' };
}

// 初始化对战域名配置
let battleDomainInitialized = false;
export async function initBattleDomain(forceRefresh = false) {
    // 如果强制刷新，清除缓存和旧值
    if (forceRefresh) {
        battleDomainInitialized = false;
        APP_CONFIG.BATTLE_DOMAIN = null; // 清除旧值
        localStorage.removeItem('battle_domain'); // 清除 localStorage 中的旧值
    }
    if (battleDomainInitialized && APP_CONFIG.BATTLE_DOMAIN) {
        return APP_CONFIG.BATTLE_DOMAIN;
    }
    
    // 首先尝试从配置文件读取（env-config.json）
    try {
        const configResponse = await fetch('/env-config.json?t=' + Date.now(), {
            cache: 'no-store'
        });
        if (configResponse.ok) {
            const configData = await configResponse.json();
            APP_CONFIG.BATTLE_DOMAIN = configData.battleDomain || 'ac.nowcoder.com';
            battleDomainInitialized = true;
            localStorage.setItem('battle_domain', APP_CONFIG.BATTLE_DOMAIN);
            console.log('Battle domain initialized from config file:', APP_CONFIG.BATTLE_DOMAIN, 'from env:', configData.env);
            return APP_CONFIG.BATTLE_DOMAIN;
        }
    } catch (error) {
        console.warn('Failed to fetch battle domain config from file, trying API:', error);
    }
    
    // 如果配置文件读取失败，尝试从 API 获取配置
    try {
        // 添加时间戳防止缓存，使用 Promise.race 实现超时
        const fetchPromise = fetch(`/api/env-config?t=${Date.now()}`, {
            cache: 'no-store' // 禁用缓存
        });
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 3000)
        );
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        if (response.ok) {
            const data = await response.json();
            APP_CONFIG.BATTLE_DOMAIN = data.battleDomain || 'ac.nowcoder.com';
            battleDomainInitialized = true;
            // 保存到 localStorage 以便后续使用
            localStorage.setItem('battle_domain', APP_CONFIG.BATTLE_DOMAIN);
            console.log('Battle domain initialized from API:', APP_CONFIG.BATTLE_DOMAIN, 'from env:', data.env);
            return APP_CONFIG.BATTLE_DOMAIN;
        }
    } catch (error) {
        console.warn('Failed to fetch battle domain config from API, trying fallback:', error);
    }
    
    // API 失败时，尝试从 localStorage 获取
    const savedDomain = localStorage.getItem('battle_domain');
    if (savedDomain) {
        APP_CONFIG.BATTLE_DOMAIN = savedDomain;
        battleDomainInitialized = true;
        console.log('Battle domain initialized from localStorage:', APP_CONFIG.BATTLE_DOMAIN);
        return APP_CONFIG.BATTLE_DOMAIN;
    }
    
    // 如果都失败，根据域名推断环境
    const inferred = inferEnvironmentFromDomain();
    APP_CONFIG.BATTLE_DOMAIN = inferred.battleDomain;
    battleDomainInitialized = true;
    localStorage.setItem('battle_domain', APP_CONFIG.BATTLE_DOMAIN);
    console.log('Battle domain inferred from domain:', APP_CONFIG.BATTLE_DOMAIN, 'from env:', inferred.env, 'hostname:', window.location.hostname);
    return APP_CONFIG.BATTLE_DOMAIN;
}

// 获取对战URL的辅助函数
export function getBattleUrl(roomId, battleType) {
    // 确保使用最新的域名配置
    let domain = APP_CONFIG.BATTLE_DOMAIN;
    
    // 如果域名未初始化，尝试从 localStorage 获取（如果之前保存过）
    if (!domain) {
        const savedDomain = localStorage.getItem('battle_domain');
        if (savedDomain) {
            domain = savedDomain;
            APP_CONFIG.BATTLE_DOMAIN = savedDomain;
        } else {
            // 默认使用生产环境（正式环境没有 proxy，直接使用 ac.nowcoder.com）
            domain = 'ac.nowcoder.com';
            APP_CONFIG.BATTLE_DOMAIN = domain;
        }
    }
    
    console.log('getBattleUrl called with domain:', domain, 'roomId:', roomId, 'battleType:', battleType, 'initialized:', battleDomainInitialized);
    return `https://${domain}/acm/battle/fight/${roomId}?battleType=${battleType}`;
}

