// nowcoder problems JavaScript 文件

document.addEventListener('DOMContentLoaded', function() {
    console.log('nowcoder problems 已加载');
    
    // 添加页面加载动画
    const container = document.querySelector('.container');
    container.style.opacity = '0';
    container.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        container.style.transition = 'all 0.8s ease';
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }, 100);
    
    // 添加标题点击效果
    const title = document.querySelector('h1');
    title.addEventListener('click', function() {
        this.style.transform = 'scale(1.05)';
        setTimeout(() => {
            this.style.transform = 'scale(1)';
        }, 200);
    });
    
    // 页签切换功能
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 移除所有活动状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // 添加活动状态
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // 加载对应标签页的数据
            loadTabData(targetTab);
        });
    });
    
    // 加载标签页数据
    function loadTabData(tabName) {
        switch(tabName) {
            case 'problems':
                loadProblems();
                break;
            case 'rankings':
                loadRankings();
                break;
            case 'submissions':
                loadSubmissions();
                break;
            case 'faq':
                // FAQ内容已经在HTML中，无需加载
                break;
        }
    }
    
    // 加载题目数据
    function loadProblems() {
        // 初始化比赛页签功能
        initContestTabs();
        
        // 初始化搜索功能
        initSearchFunction();
    }
    
    // 全局变量存储比赛数据
    let contestData = {
        all: { contests: [] },
        weekly: { contests: [] },
        monthly: { contests: [] },
        practice: { contests: [] },
        challenge: { contests: [] },
        campus: { contests: [] }
    };

    // 初始化比赛页签功能
    function initContestTabs() {
        const contestTabs = document.querySelectorAll('.contest-tab');
        
        // 首先尝试加载真实数据
        loadRealContestData().then(() => {
            // 如果真实数据加载失败，使用模拟数据
            if (contestData.all.contests.length === 0) {
                loadMockContestData();
            }
            
            // 初始化页签事件
            initContestTabEvents();
        });
    }

    // 加载真实比赛数据，以 clist.by 的数据为基础构建比赛列表
    async function loadRealContestData() {
        try {
            const response = await fetch('clist_nowcoder_problems.json');
            if (!response.ok) {
                console.log('无法加载 clist_nowcoder_problems.json，将使用模拟数据。');
                return false;
            }

            const clistData = await response.json();
            const clistProblems = clistData.items || [];

            if (clistProblems.length === 0) {
                console.log('clist_nowcoder_problems.json 中没有找到题目数据。');
                return false;
            }

            // 使用 clist 数据动态构建比赛结构
            const contestsMap = new Map();

            clistProblems.forEach(p => {
                if (!p.contest_name || !p.letter) return;

                // 标准化比赛名称，用于 Map 的 key
                const contestKey = (p.contest_name || '').replace(/\s+/g, ' ').trim();

                if (!contestsMap.has(contestKey)) {
                    contestsMap.set(contestKey, {
                        name: contestKey,
                        url: p.contest_url || '',
                        problems: []
                    });
                }

                const contest = contestsMap.get(contestKey);
                contest.problems.push({
                    letter: p.letter,
                    title: p.problem_name,
                    difficulty: p.rating || 1200, // 使用 clist 的 rating 作为 difficulty
                    url: p.problem_url
                });
            });
            
            // 将 Map 转换为数组并按题目号排序
            const allContests = Array.from(contestsMap.values());
            allContests.forEach(contest => {
                contest.problems.sort((a, b) => a.letter.localeCompare(b.letter));
            });
            
            // Helper to extract round number from contest name
            const getRoundNumber = (name) => {
                // Removes bracketed content like [IOI], then finds the number at the end of the string
                const cleanName = (name || '').replace(/\[.*?\]/g, '').trim();
                const match = cleanName.match(/(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            };

            // 按场次降序排序
            allContests.sort((a, b) => {
                const roundB = getRoundNumber(b.name);
                const roundA = getRoundNumber(a.name);

                // Primarily sort by round number descending
                if (roundA !== roundB) {
                    return roundB - roundA;
                }

                // If round numbers are the same (or both 0), fall back to name descending for stability
                return b.name.localeCompare(a.name);
            });

            const keywords = ['牛客周赛', '牛客小白月赛', '牛客练习赛', '牛客挑战赛'];
            const filteredContests = allContests.filter(contest => 
                keywords.some(keyword => contest.name.includes(keyword))
            );

            // 将构建好的数据分类
            contestData.all.contests = filteredContests;
            contestData.weekly.contests = filteredContests.filter(c => c.name.includes('牛客周赛'));
            contestData.monthly.contests = filteredContests.filter(c => c.name.includes('牛客小白月赛'));
            contestData.practice.contests = filteredContests.filter(c => c.name.includes('牛客练习赛'));
            contestData.challenge.contests = filteredContests.filter(c => c.name.includes('牛客挑战赛'));
            contestData.campus.contests = filteredContests.filter(c => c.name.includes('校招'));

            console.log('成功基于 clist 数据构建了比赛列表');
            return true;

        } catch (error) {
            console.error('基于 clist 数据构建比赛列表时出错:', error);
            return false;
        }
    }

    // 加载模拟比赛数据
    function loadMockContestData() {
        contestData = {
            all: {
                contests: [
                    {
                        name: '牛客周赛100',
                        problems: [
                            { letter: 'A', title: '小红的字符串', difficulty: 158 },
                            { letter: 'B', title: '小红的数组', difficulty: 1425 },
                            { letter: 'C', title: '小红的树', difficulty: 1600 },
                            { letter: 'D', title: '小红的图', difficulty: 2200 },
                            { letter: 'E', title: '小红的DP', difficulty: 2600 },
                            { letter: 'F', title: '小红的数学', difficulty: 3000 },
                            { letter: 'G', title: '小红的算法', difficulty: 3200 }
                        ]
                    },
                    {
                        name: '牛客周赛99',
                        problems: [
                            { letter: 'A', title: '字符串匹配', difficulty: 750 },
                            { letter: 'B', title: '数组排序', difficulty: 1150 },
                            { letter: 'C', title: '二叉树遍历', difficulty: 1550 },
                            { letter: 'D', title: '图论算法', difficulty: 2100 },
                            { letter: 'E', title: '动态规划', difficulty: 2500 },
                            { letter: 'F', title: '数论问题', difficulty: 2900 },
                            { letter: 'G', title: '高级算法', difficulty: 3100 }
                        ]
                    },
                    {
                        name: '牛客小白月赛50',
                        problems: [
                            { letter: 'A', title: '简单计算', difficulty: 600 },
                            { letter: 'B', title: '基础排序', difficulty: 900 },
                            { letter: 'C', title: '简单搜索', difficulty: 1300 },
                            { letter: 'D', title: '基础DP', difficulty: 1700 },
                            { letter: 'E', title: '数学问题', difficulty: 2100 },
                            { letter: 'F', title: '算法优化', difficulty: 2500 }
                        ]
                    },
                    {
                        name: '练习赛001',
                        problems: [
                            { letter: 'A', title: '入门题目', difficulty: 500 },
                            { letter: 'B', title: '基础算法', difficulty: 800 },
                            { letter: 'C', title: '数据结构', difficulty: 1200 },
                            { letter: 'D', title: '算法设计', difficulty: 1600 }
                        ]
                    },
                    {
                        name: '挑战赛001',
                        problems: [
                            { letter: 'A', title: '挑战题目A', difficulty: 1800 },
                            { letter: 'B', title: '挑战题目B', difficulty: 2200 },
                            { letter: 'C', title: '挑战题目C', difficulty: 2600 },
                            { letter: 'D', title: '挑战题目D', difficulty: 3000 },
                            { letter: 'E', title: '挑战题目E', difficulty: 3400 }
                        ]
                    }
                ]
            },
            weekly: {
                contests: [
                    {
                        name: '牛客周赛100',
                        problems: [
                            { letter: 'A', title: '小红的字符串', difficulty: 158 },
                            { letter: 'B', title: '小红的数组', difficulty: 1425 },
                            { letter: 'C', title: '小红的树', difficulty: 1600 },
                            { letter: 'D', title: '小红的图', difficulty: 2200 },
                            { letter: 'E', title: '小红的DP', difficulty: 2600 },
                            { letter: 'F', title: '小红的数学', difficulty: 3000 },
                            { letter: 'G', title: '小红的算法', difficulty: 3200 }
                        ]
                    },
                    {
                        name: '牛客周赛99',
                        problems: [
                            { letter: 'A', title: '字符串匹配', difficulty: 750 },
                            { letter: 'B', title: '数组排序', difficulty: 1150 },
                            { letter: 'C', title: '二叉树遍历', difficulty: 1550 },
                            { letter: 'D', title: '图论算法', difficulty: 2100 },
                            { letter: 'E', title: '动态规划', difficulty: 2500 },
                            { letter: 'F', title: '数论问题', difficulty: 2900 },
                            { letter: 'G', title: '高级算法', difficulty: 3100 }
                        ]
                    }
                ]
            },
            monthly: {
                contests: [
                    {
                        name: '牛客小白月赛50',
                        problems: [
                            { letter: 'A', title: '简单计算', difficulty: 600 },
                            { letter: 'B', title: '基础排序', difficulty: 900 },
                            { letter: 'C', title: '简单搜索', difficulty: 1300 },
                            { letter: 'D', title: '基础DP', difficulty: 1700 },
                            { letter: 'E', title: '数学问题', difficulty: 2100 },
                            { letter: 'F', title: '算法优化', difficulty: 2500 }
                        ]
                    }
                ]
            },
            practice: {
                contests: [
                    {
                        name: '练习赛001',
                        problems: [
                            { letter: 'A', title: '入门题目', difficulty: 500 },
                            { letter: 'B', title: '基础算法', difficulty: 800 },
                            { letter: 'C', title: '数据结构', difficulty: 1200 },
                            { letter: 'D', title: '算法设计', difficulty: 1600 }
                        ]
                    }
                ]
            },
            challenge: {
                contests: [
                    {
                        name: '挑战赛001',
                        problems: [
                            { letter: 'A', title: '挑战题目A', difficulty: 1800 },
                            { letter: 'B', title: '挑战题目B', difficulty: 2200 },
                            { letter: 'C', title: '挑战题目C', difficulty: 2600 },
                            { letter: 'D', title: '挑战题目D', difficulty: 3000 },
                            { letter: 'E', title: '挑战题目E', difficulty: 3400 }
                        ]
                    }
                ]
            }
        };
    }

    // 初始化页签事件
    function initContestTabEvents() {
        const contestTabs = document.querySelectorAll('.contest-tab');
        
        contestTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const contestType = this.getAttribute('data-contest');
                
                // 移除所有活动状态
                contestTabs.forEach(t => t.classList.remove('active'));
                
                // 添加活动状态
                this.classList.add('active');
                
                // 更新内容
                if (contestData[contestType] && contestData[contestType].contests.length > 0) {
                    updateProblemsTable(contestData[contestType].contests);
                } else {
                    // 如果没有数据，显示提示
                    const tbody = document.querySelector('.problems-table tbody');
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #666;">暂无数据</td></tr>';
                }
            });
        });
        
        // 默认显示全部比赛
        if (contestData.all.contests.length > 0) {
            updateProblemsTable(contestData.all.contests);
        }
    }
    
    // 更新题目表格
    function updateProblemsTable(contests) {
        const tbody = document.querySelector('.problems-table tbody');
        
        tbody.innerHTML = contests.map(contest => {
            const contestUrl = contest.url || '';
            const problems = Array.isArray(contest.problems) ? contest.problems : [];
            const problemCells = problems.map(problem => {
                const difficultyInfo = getDifficultyInfo(problem.difficulty);
                const circleStyle = getCircleStyle(difficultyInfo);
                const tooltipContent = generateTooltipContent(problem, difficultyInfo);
                const titleHtml = renderProblemTitle(problem, contestUrl);
                return `<td><div class="problem-cell"><span class="difficulty-circle ${difficultyInfo.class}" style="${circleStyle}" data-tooltip="${tooltipContent}"></span>${problem.letter}. ${titleHtml}</div></td>`;
            }).join('');
            
            const contestName = formatContestName(contest.name);
            const contestCell = contestUrl
                ? `<a class="contest-link" href="${contestUrl}" target="_blank" rel="noopener noreferrer">${contestName}</a>`
                : `${contestName}`;
            return `<tr><td>${contestCell}</td>${problemCells}</tr>`;
        }).join('');
        
        // 添加提示框事件监听器
        initTooltips();
    }

    // 将题目标题渲染为可点击链接（当提供 url 时）
    function renderProblemTitle(problem, contestUrl) {
        const text = problem.title || '';
        let url = problem.url || '';
        // 如果爬虫未提供题目链接，则用比赛链接 + /题号 生成
        if (!url && contestUrl && problem.letter) {
            const base = contestUrl.endsWith('/') ? contestUrl.slice(0, -1) : contestUrl;
            url = `${base}/${problem.letter}`;
        }
        if (url) {
            return `<a class="problem-link" href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        return text;
    }
    
    // 获取圆圈样式
    function getCircleStyle(difficultyInfo) {
        const colors = {
            easy: '#6c757d',
            medium: '#6f42c1',
            hard: '#007bff',
            expert: '#28a745',
            master: '#ffc107',
            grandmaster: '#fd7e14',
            legend: '#dc3545'
        };
        
        const color = colors[difficultyInfo.class];
        const percentage = difficultyInfo.percentage;
        
        if (difficultyInfo.fill === 'hollow') {
            return `background: transparent; border-color: ${color};`;
        } else if (difficultyInfo.fill === 'half') {
            // 计算半实心的角度，基于实际百分比
            const angle = 180 + (percentage - 0.1) / 0.4 * 180; // 从180度开始，到360度结束
            return `background: conic-gradient(${color} 180deg, ${color} ${angle}deg, transparent ${angle}deg, transparent 360deg); border-color: ${color};`;
        } else {
            // 计算实心的角度，基于实际百分比
            const angle = 180 + (percentage - 0.5) / 0.5 * 180; // 从180度开始，到360度结束
            return `background: conic-gradient(${color} 180deg, ${color} ${angle}deg, transparent ${angle}deg, transparent 360deg); border-color: ${color};`;
        }
    }
    
    // 根据难度分数获取难度信息
    function getDifficultyInfo(score) {
        let baseClass, fill;
        
        if (score <= 699) {
            baseClass = 'easy';
        } else if (score <= 1099) {
            baseClass = 'medium';
        } else if (score <= 1499) {
            baseClass = 'hard';
        } else if (score <= 1999) {
            baseClass = 'expert';
        } else if (score <= 2399) {
            baseClass = 'master';
        } else if (score <= 2799) {
            baseClass = 'grandmaster';
        } else {
            baseClass = 'legend';
        }
        
        // 计算实心程度 - 直接使用百分比
        const range = getScoreRange(baseClass);
        const minScore = range.min;
        const maxScore = range.max;
        const percentage = (score - minScore) / (maxScore - minScore);
        
        // 根据百分比确定填充类型
        if (percentage <= 0.1) {
            fill = 'hollow'; // 空心
        } else if (percentage <= 0.5) {
            fill = 'half'; // 半实心
        } else {
            fill = 'solid'; // 实心
        }
        
        return { class: baseClass, fill: fill, percentage: percentage };
    }
    
    // 获取分数范围
    function getScoreRange(difficultyClass) {
        const ranges = {
            easy: { min: 0, max: 699 },
            medium: { min: 700, max: 1099 },
            hard: { min: 1100, max: 1499 },
            expert: { min: 1500, max: 1999 },
            master: { min: 2000, max: 2399 },
            grandmaster: { min: 2400, max: 2799 },
            legend: { min: 2800, max: 3500 }
        };
        return ranges[difficultyClass];
    }
    
    // 获取rating对应的颜色
    function getRatingColor(ratingClass) {
        const colors = {
            easy: '#6c757d',      // 灰色
            medium: '#6f42c1',    // 紫色
            hard: '#007bff',      // 蓝色
            expert: '#28a745',    // 绿色
            master: '#ffc107',    // 黄色
            grandmaster: '#fd7e14', // 橙色
            legend: '#dc3545'     // 红色
        };
        return colors[ratingClass] || '#333';
    }
    
    // 生成提示框内容
    function generateTooltipContent(problem, difficultyInfo) {
        // 模拟数据 - 在实际应用中这些数据应该从API获取
        const mockData = {
            '小红的字符串': { submissions: 1250, ac: 890 },
            '小红的数组': { submissions: 980, ac: 456 },
            '小红的树': { submissions: 756, ac: 234 },
            '小红的图': { submissions: 432, ac: 89 },
            '小红的DP': { submissions: 298, ac: 45 },
            '小红的数学': { submissions: 156, ac: 23 },
            '小红的算法': { submissions: 89, ac: 12 },
            '字符串匹配': { submissions: 1100, ac: 750 },
            '数组排序': { submissions: 850, ac: 520 },
            '二叉树遍历': { submissions: 680, ac: 380 },
            '图论算法': { submissions: 420, ac: 120 },
            '动态规划': { submissions: 320, ac: 85 },
            '数论问题': { submissions: 180, ac: 35 },
            '高级算法': { submissions: 95, ac: 18 }
        };
        
        const data = mockData[problem.title] || { submissions: Math.floor(Math.random() * 1000) + 100, ac: Math.floor(Math.random() * 500) + 50 };
        const acRate = ((data.ac / data.submissions) * 100).toFixed(1);
        
        return `Difficulty: ${problem.difficulty}\nSubmissions: ${data.submissions}\nAC: ${data.ac} (${acRate}%)`;
    }

    // 规范化比赛名称：只显示 “牛客周赛 Round xxx”
    function formatContestName(name) {
        if (!name) return '';
        const raw = String(name).replace(/\s+/g, ' ').trim();
        // 1) 优先提取 “牛客周赛 Round xxx” 片段
        const m = raw.match(/牛客周赛\s*Round\s*\d+/i);
        if (m) {
            return m[0].replace(/\s+/g, ' ').trim();
        }
        // 2) 次优处理：去掉后续描述性的噪声词
        let cleaned = raw;
        const cutTokens = [' 原创', '¥', ' Rated', ' 比赛结束', ' 回顾比赛', ' 创建重现赛'];
        for (const token of cutTokens) {
            const idx = cleaned.indexOf(token);
            if (idx > 0) cleaned = cleaned.slice(0, idx);
        }
        return cleaned.replace(/\s+/g, ' ').trim();
    }
    
    // 初始化提示框功能
    function initTooltips() {
        const circles = document.querySelectorAll('.difficulty-circle');
        
        circles.forEach(circle => {
            circle.addEventListener('mouseenter', function(e) {
                const tooltipContent = this.getAttribute('data-tooltip');
                if (tooltipContent) {
                    showCustomTooltip(e, tooltipContent);
                }
            });
            
            circle.addEventListener('mouseleave', function() {
                hideCustomTooltip();
            });
        });
    }
    
    // 显示自定义提示框
    function showCustomTooltip(event, content) {
        // 移除已存在的提示框
        hideCustomTooltip();
        
        const tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.innerHTML = content.replace(/\n/g, '<br>');
        
        document.body.appendChild(tooltip);
        
        // 计算位置
        const rect = event.target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        let top = rect.top - tooltipRect.height - 10;
        
        // 确保提示框不超出视窗
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        if (top < 10) {
            top = rect.bottom + 10;
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        
        // 添加显示动画
        setTimeout(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0)';
        }, 10);
    }
    
    // 隐藏自定义提示框
    function hideCustomTooltip() {
        const existingTooltip = document.querySelector('.custom-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    }
    
    // 初始化rating圆圈提示框功能
    function initRatingTooltips() {
        const circles = document.querySelectorAll('.rating-circle');
        
        circles.forEach(circle => {
            circle.addEventListener('mouseenter', function(e) {
                const username = this.getAttribute('data-username');
                const ratingScore = this.getAttribute('data-rating');
                const tooltipContent = `User: ${username}\nRating: ${ratingScore}`;
                showCustomTooltip(e, tooltipContent);
            });
            
            circle.addEventListener('mouseleave', function() {
                hideCustomTooltip();
            });
        });
    }
    
    // 初始化排行榜搜索功能
    function initRankingsSearch() {
        const searchInput = document.getElementById('rankingsSearch');
        const searchBtn = document.querySelector('.rankings-search-btn');
        
        // 搜索按钮点击事件
        searchBtn.addEventListener('click', function() {
            performRankingsSearch();
        });
        
        // 回车键搜索事件
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performRankingsSearch();
            }
        });
    }
    
    // 执行排行榜搜索
    function performRankingsSearch() {
        const searchInput = document.getElementById('rankingsSearch');
        const searchTerm = searchInput.value.trim().toLowerCase();
        
        if (!searchTerm) {
            nowcoderTracker.showNotification('请输入要搜索的用户ID', 'warning');
            return;
        }
        
        // 移除之前的高亮
        const existingHighlighted = document.querySelector('.rankings-table tr.highlighted');
        if (existingHighlighted) {
            existingHighlighted.classList.remove('highlighted');
        }
        
        // 在所有数据中搜索
        const foundUser = allRankingsData.find(user => 
            user.username.toLowerCase().includes(searchTerm)
        );
        
        if (foundUser) {
            // 计算用户所在的页码
            const userIndex = allRankingsData.findIndex(user => user.username === foundUser.username);
            const targetPage = Math.floor(userIndex / pageSize) + 1;
            
            // 如果用户不在当前页，跳转到对应页面
            if (targetPage !== currentPage) {
                currentPage = targetPage;
                renderRankingsTable();
                renderPagination();
                initRatingTooltips();
            }
            
            // 等待DOM更新后添加高亮
            setTimeout(() => {
                const targetRow = document.querySelector(`tr[data-username="${foundUser.username}"]`);
                if (targetRow) {
                    // 添加高亮效果
                    targetRow.classList.add('highlighted');
                    
                    // 滚动到该行
                    targetRow.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                    
                    // 显示成功消息
                    nowcoderTracker.showNotification(`找到用户 ${foundUser.username}，排名第 ${foundUser.rank} 位`, 'success');
                    
                    // 3秒后移除高亮
                    setTimeout(() => {
                        targetRow.classList.remove('highlighted');
                    }, 3000);
                }
            }, 100);
        } else {
            nowcoderTracker.showNotification(`未找到用户ID包含 "${searchTerm}" 的用户`, 'error');
        }
    }
    
    // 初始化搜索功能
    function initSearchFunction() {
        const searchBtn = document.querySelector('.search-btn');
        const userIdInput = document.getElementById('userId');
        const rivalIdInput = document.getElementById('rivalId');
        
        searchBtn.addEventListener('click', function() {
            const userId = userIdInput.value.trim();
            const rivalId = rivalIdInput.value.trim();
            
            if (!userId && !rivalId) {
                nowcoderTracker.showNotification('请输入至少一个用户ID', 'warning');
                return;
            }
            
            // 模拟搜索
            nowcoderTracker.showNotification(`正在搜索用户: ${userId || 'N/A'} vs ${rivalId || 'N/A'}`, 'info');
            
            // 这里可以添加实际的搜索逻辑
            setTimeout(() => {
                nowcoderTracker.showNotification('搜索完成！', 'success');
            }, 2000);
        });
    }
    
    // 全局变量用于分页
    let allRankingsData = [];
    let currentPage = 1;
    let pageSize = 10;
    
    // 加载排行榜数据
    function loadRankings() {
        // 生成更多模拟数据用于分页测试
        allRankingsData = [];
        for (let i = 1; i <= 50; i++) {
            allRankingsData.push({
                username: `user${i.toString().padStart(3, '0')}`,
                rating: Math.floor(Math.random() * 3000) + 100,
                solved: Math.floor(Math.random() * 100) + 10
            });
        }
        
        // 按通过题目数量倒序排序
        allRankingsData.sort((a, b) => b.solved - a.solved);
        
        // 添加排名
        allRankingsData.forEach((user, index) => {
            user.rank = index + 1;
        });
        
        // 初始化分页
        currentPage = 1;
        pageSize = parseInt(document.getElementById('pageSize').value) || 10;
        
        // 渲染表格和分页
        renderRankingsTable();
        renderPagination();
        
        // 添加rating圆圈提示框
        initRatingTooltips();
        
        // 初始化排行榜搜索功能
        initRankingsSearch();
        
        // 初始化分页控制
        initPaginationControls();
    }
    
    // 渲染排行榜表格
    function renderRankingsTable() {
        const container = document.querySelector('.rankings-container');
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const currentPageData = allRankingsData.slice(startIndex, endIndex);
        
        // 查找表格容器
        const tableContainer = container.querySelector('.rankings-table-container');
        
        // 更新表格内容
        tableContainer.innerHTML = `
            <table class="rankings-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>ID</th>
                        <th>Problems</th>
                    </tr>
                </thead>
                <tbody>
                    ${currentPageData.map(user => {
                        const ratingInfo = getDifficultyInfo(user.rating);
                        const circleStyle = getCircleStyle(ratingInfo);
                        return `
                            <tr data-username="${user.username}">
                                <td>${user.rank}</td>
                                <td>
                                    <div class="user-cell">
                                        <span class="rating-circle ${ratingInfo.class}" style="${circleStyle}" data-username="${user.username}" data-rating="${user.rating}"></span>
                                        <span class="username" style="color: ${getRatingColor(ratingInfo.class)}">${user.username}</span>
                                    </div>
                                </td>
                                <td>${user.solved}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }
    
    // 渲染分页
    function renderPagination() {
        const totalItems = allRankingsData.length;
        const totalPages = Math.ceil(totalItems / pageSize);
        const startItem = (currentPage - 1) * pageSize + 1;
        const endItem = Math.min(currentPage * pageSize, totalItems);
        
        // 更新分页信息
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) {
            paginationInfo.textContent = `显示 ${startItem}-${endItem} 条，共 ${totalItems} 条`;
        }
        
        // 更新分页按钮状态
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (prevBtn) {
            prevBtn.disabled = currentPage === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = currentPage === totalPages;
        }
        
        // 生成页码按钮
        const pageNumbersContainer = document.getElementById('pageNumbers');
        if (pageNumbersContainer) {
            pageNumbersContainer.innerHTML = '';
            
            // 显示页码逻辑
            const maxVisiblePages = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
            
            // 添加第一页按钮
            if (startPage > 1) {
                pageNumbersContainer.innerHTML += `<span class="page-number" data-page="1">1</span>`;
                if (startPage > 2) {
                    pageNumbersContainer.innerHTML += `<span class="page-number disabled">...</span>`;
                }
            }
            
            // 添加中间页码
            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === currentPage ? 'active' : '';
                pageNumbersContainer.innerHTML += `<span class="page-number ${activeClass}" data-page="${i}">${i}</span>`;
            }
            
            // 添加最后一页按钮
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pageNumbersContainer.innerHTML += `<span class="page-number disabled">...</span>`;
                }
                pageNumbersContainer.innerHTML += `<span class="page-number" data-page="${totalPages}">${totalPages}</span>`;
            }
        }
    }
    
    // 初始化分页控制
    function initPaginationControls() {
        const pageSizeSelect = document.getElementById('pageSize');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageNumbersContainer = document.getElementById('pageNumbers');
        
        // 每页显示数量变化事件
        pageSizeSelect.addEventListener('change', function() {
            pageSize = parseInt(this.value);
            currentPage = 1; // 重置到第一页
            renderRankingsTable();
            renderPagination();
            initRatingTooltips();
        });
        
        // 上一页按钮
        prevBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                renderRankingsTable();
                renderPagination();
                initRatingTooltips();
            }
        });
        
        // 下一页按钮
        nextBtn.addEventListener('click', function() {
            const totalPages = Math.ceil(allRankingsData.length / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                renderRankingsTable();
                renderPagination();
                initRatingTooltips();
            }
        });
        
        // 页码点击事件
        pageNumbersContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('page-number') && !e.target.classList.contains('disabled')) {
                const page = parseInt(e.target.getAttribute('data-page'));
                if (page && page !== currentPage) {
                    currentPage = page;
                    renderRankingsTable();
                    renderPagination();
                    initRatingTooltips();
                }
            }
        });
    }
    
    // 加载提交记录数据
    function loadSubmissions() {
        const container = document.querySelector('.submissions-container');
        
        const mockSubmissions = [
            { id: 1, username: 'user001', problem: '两数之和', status: 'Accepted', time: '2分钟前' },
            { id: 2, username: 'user002', problem: '最长回文子串', status: 'Wrong Answer', time: '5分钟前' },
            { id: 3, username: 'user003', problem: '合并两个有序链表', status: 'Accepted', time: '8分钟前' },
            { id: 4, username: 'user004', problem: '二叉树的中序遍历', status: 'Time Limit Exceeded', time: '12分钟前' },
            { id: 5, username: 'user005', problem: '有效的括号', status: 'Accepted', time: '15分钟前' }
        ];
        
        container.innerHTML = mockSubmissions.map(submission => `
            <div class="submission-item">
                <div>
                    <strong>${submission.username}</strong> - ${submission.problem}
                </div>
                <div>
                    <span class="status ${submission.status.toLowerCase().replace(' ', '-')}">${submission.status}</span>
                    <span class="time">${submission.time}</span>
                </div>
            </div>
        `).join('');
    }
    
    // 初始化加载第一个标签页的数据
    loadProblems();
    
    // 显示当前时间
    function updateTime() {
        const now = new Date();
        const timeString = now.toLocaleString('zh-CN');
        
        // 如果页脚还没有时间显示，就添加一个
        const footer = document.querySelector('footer');
        if (!document.querySelector('.current-time')) {
            const timeElement = document.createElement('div');
            timeElement.className = 'current-time';
            timeElement.style.marginTop = '10px';
            timeElement.style.fontSize = '0.9rem';
            footer.appendChild(timeElement);
        }
        
        document.querySelector('.current-time').textContent = `当前时间: ${timeString}`;
    }
    
    updateTime();
    setInterval(updateTime, 1000);
});

// 全局函数
window.viewProblem = function(problemId) {
    nowcoderTracker.showNotification(`正在打开题目 ${problemId} 的详情页面...`, 'info');
    // 这里可以添加跳转到具体题目页面的逻辑
};

// 添加一些实用的工具函数
window.nowcoderTracker = {
    // 显示通知
    showNotification: function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        switch(type) {
            case 'success':
                notification.style.background = '#28a745';
                break;
            case 'error':
                notification.style.background = '#dc3545';
                break;
            case 'warning':
                notification.style.background = '#ffc107';
                notification.style.color = '#333';
                break;
            default:
                notification.style.background = '#17a2b8';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
};

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
