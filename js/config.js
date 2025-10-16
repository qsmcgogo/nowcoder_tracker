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
        5: 2400
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
    }
};

