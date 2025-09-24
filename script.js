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

    let practiceData = null; // To store parsed practice data from JSON file
    let contestsCurrentPage = 1;
    const contestsPageSize = 30;
    let totalContests = 0; // To store total contest count from API
    const apiBaseUrl = '/problem/tracker/list'; // Use relative path to proxy
    
    // Mapping from data-contest attribute to API contestType
    const contestTypeMap = {
        'all': 0,
        'weekly': 19,
        'monthly': 9,
        'practice': 6,
        'challenge': 2
        // 'campus' is not supported by this API, will be handled separately
    };

    async function loadPracticeProblems(practiceType) {
        const tbody = document.querySelector('.practice-table tbody');
        
        if (!practiceData) {
            tbody.innerHTML = `<tr><td colspan="2" class="loading">正在加载题目数据...</td></tr>`;
            try {
                const response = await fetch('parsed_practice_problems.json');
                if (!response.ok) throw new Error('Network response was not ok');
                practiceData = await response.json();
                console.log('Successfully loaded practice problems from JSON.');
            } catch (error) {
                console.error('Failed to load practice problems JSON:', error);
                tbody.innerHTML = `<tr><td colspan="2" class="loading">题目数据加载失败。</td></tr>`;
                return;
            }
        }
        
        const categoryData = practiceData[practiceType];

        if (!categoryData || (categoryData.knowledge_points.length === 0 && categoryData.problems.length === 0)) {
            tbody.innerHTML = `<tr><td colspan="2" class="loading">暂无此分类的题目数据。</td></tr>`;
            return;
        }

        let knowledgePointsToRender = [];
        if (categoryData.knowledge_points.length > 0) {
            knowledgePointsToRender = categoryData.knowledge_points;
        } else if (categoryData.problems.length > 0) {
            const categoryTitle = document.querySelector(`.contest-tab[data-practice-type="${practiceType}"]`).textContent;
            knowledgePointsToRender = [{
                category: categoryTitle,
                problems: categoryData.problems
            }];
        }

        const rowsHtml = knowledgePointsToRender.map(kp => {
            if (!kp.problems || kp.problems.length === 0) return '';
            const problemsHtml = (kp.problems || []).map(p => {
                const difficultyInfo = getDifficultyInfo(p.difficulty);
                const circleStyle = getCircleStyle(difficultyInfo);
                const tooltip = `难度: ${p.difficulty}\n通过人数: ${(p.ac_count || 0).toLocaleString()}`;
                const titleHtml = `<a href="${p.url}" target="_blank" rel="noopener noreferrer" class="problem-link" title="${(p.title || '').replace(/"/g, '&quot;')}">${p.title}</a>`;

                return `
                    <div class="practice-problem-item">
                        <span class="difficulty-circle" style="${circleStyle}" data-tooltip="${tooltip}"></span>
                        ${titleHtml}
                    </div>
                `;
            }).join('');

            return `
                <tr>
                    <td class="knowledge-point-cell">${kp.category}</td>
                    <td class="problems-cell">
                        <div class="problems-cell-container">
                            ${problemsHtml}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml || `<tr><td colspan="2" class="loading">暂无题目。</td></tr>`;
        initTooltips(); // Re-initialize tooltips for the new elements
    }

    let currentCompanyFilter = 'all'; // Default company filter

    // 初始化比赛页签功能
    function initContestTabs() {
        const contestTabs = document.querySelectorAll('.contest-tab:not(.sub-tabs .contest-tab)');
        const campusSubTabs = document.getElementById('campus-sub-tabs');
        const viewTypeTabs = document.querySelectorAll('.view-type-tab');
        const contestsView = document.getElementById('contests-view');
        const practiceView = document.getElementById('practice-view');

        // Main view switcher (竞赛/笔试 vs 练习)
        viewTypeTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const view = this.getAttribute('data-view');
                viewTypeTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');

                if (view === 'contests') {
                    contestsView.style.display = 'block';
                    practiceView.style.display = 'none';
                    // Re-fetch data if needed, or just show
                    const activeContestTab = document.querySelector('#contests-view .contest-tabs .contest-tab.active');
                    if (activeContestTab) {
                        updateContestView();
                    }
                } else {
                    contestsView.style.display = 'none';
                    practiceView.style.display = 'block';
                }
            });
        });


        contestTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const contestType = this.getAttribute('data-contest');
                
                // Toggle visibility of sub-tabs
                if (contestType === 'campus') {
                    campusSubTabs.style.display = 'flex';
                } else {
                    campusSubTabs.style.display = 'none';
                }
                
                // Handle main tab activation
                contestTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                contestsCurrentPage = 1;
                // Update content based on both main tab and sub-tab selection
                updateContestView();
            });
        });

        // Initialize sub-tabs for campus
        const companyTabs = document.querySelectorAll('#campus-sub-tabs .contest-tab');
        companyTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                currentCompanyFilter = this.getAttribute('data-company');
                companyTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                updateContestView();
            });
        });
        
        // Initialize sub-tabs for practice view
        const practiceSubTabs = document.querySelectorAll('#practice-view .sub-tabs .contest-tab');
        
        practiceSubTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const practiceType = this.getAttribute('data-practice-type');
                practiceSubTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                loadPracticeProblems(practiceType); 
            });
        });

        // Trigger initial load for the default active tab when practice view is first shown
        const practiceViewTab = document.querySelector('.view-type-tab[data-view="practice"]');
        practiceViewTab.addEventListener('click', () => {
            // Check if the practice view is already populated by checking for element children
            const practiceTbody = document.querySelector('.practice-table tbody');
            if (practiceTbody.children.length === 0 || practiceTbody.querySelector('.loading')) {
                // Find the default active sub-tab and trigger its data load
                const activePracticeTab = document.querySelector('#practice-view .sub-tabs .contest-tab.active');
                if (activePracticeTab) {
                    loadPracticeProblems(activePracticeTab.getAttribute('data-practice-type'));
                }
            }
        });
        
        // Initial data load for contests
        updateContestView();
        initContestsPaginationControls();
    }

    let mainSiteUrlMap = new Map();

    // `loadUrlMapFromMd` can be removed if URLs from the new API are sufficient.
    // For now, it is kept for potential edge cases.
    async function loadUrlMapFromMd() {
        // This function might be obsolete if the new API provides all necessary links.
        // Keeping it for now in case it's still needed for some URL transformations.
        try {
            const response = await fetch('list.md');
            if (!response.ok) {
                console.warn('Could not fetch list.md, using default URLs.');
                return;
            }
            const text = await response.text();
            const lines = text.split('\n');

            lines.forEach(line => {
                const parts = line.split(/[\t,]/).map(part => part.trim()); // Split by tab or comma
                if (parts.length >= 4) {
                    const problemName = parts[0];
                    const problemLink = parts[1];
                    const mainSiteLink = parts[3];
                    if (problemLink && mainSiteLink && problemLink.startsWith('http')) {
                        mainSiteUrlMap.set(problemLink, mainSiteLink);
                    }
                }
            });
            console.log(`Successfully loaded ${mainSiteUrlMap.size} URL mappings from list.md`);

        } catch (error) {
            console.error('Error loading or parsing list.md:', error);
        }
    }

    async function fetchContestsFromServer(contestType, page) {
        const tbody = document.querySelector('.problems-table tbody');
        tbody.innerHTML = `<tr><td colspan="8" class="loading">正在加载比赛数据...</td></tr>`;

        const apiContestType = contestTypeMap[contestType];
        if (apiContestType === undefined) {
            if (contestType === 'campus') {
                tbody.innerHTML = `<tr><td colspan="8" class="loading">校招数据请在公司官网查看。</td></tr>`;
            } else {
                tbody.innerHTML = `<tr><td colspan="8" class="loading">暂不支持此比赛类型。</td></tr>`;
            }
            totalContests = 0;
            renderContestsPagination(totalContests);
            return null;
        }

        try {
            const url = `${apiBaseUrl}?contestType=${apiContestType}&page=${page}&limit=${contestsPageSize}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.code !== 0) {
                throw new Error(`API error: ${data.msg}`);
            }
            return data.data;
        } catch (error) {
            console.error('Failed to fetch contest data:', error);
            tbody.innerHTML = `<tr><td colspan="8" class="loading">比赛数据加载失败。</td></tr>`;
            totalContests = 0;
            renderContestsPagination(totalContests);
            return null;
        }
    }

    function transformApiData(apiData) {
        if (!apiData || !apiData.papers) {
            return [];
        }

        // Mapping from API difficulty enum to an estimated score
        const difficultyScoreMap = {
            1: 800,
            2: 1200,
            3: 1600,
            4: 2000,
            5: 2400
        };

        return apiData.papers.map(contest => {
            return {
                name: contest.contestName,
                url: contest.contestUrl,
                beginTime: contest.beginTime,
                problems: contest.questions.map((p, index) => {
                    return {
                        letter: String.fromCharCode(65 + index), // Generate letter 'A', 'B', 'C'...
                        title: p.title,
                        difficulty: difficultyScoreMap[p.difficulty] || 1200, // Map enum to score
                        url: p.questionUrl,
                        acCount: p.acCount,
                        submissionCount: p.submissionCount,
                        problemId: p.problemId
                    };
                }).sort((a, b) => a.letter.localeCompare(b.letter)) // Ensure problems are sorted by letter
            };
        });
    }

    async function updateContestView() {
        const activeMainTab = document.querySelector('.contest-tab:not(.sub-tabs .contest-tab).active');
        const contestType = activeMainTab ? activeMainTab.getAttribute('data-contest') : 'all';

        const apiData = await fetchContestsFromServer(contestType, contestsCurrentPage);
        
        if (apiData) {
            const contestsToDisplay = transformApiData(apiData);
            totalContests = apiData.totalCount;
            
            if (contestsToDisplay.length > 0) {
                updateProblemsTable(contestsToDisplay);
            } else {
                const tbody = document.querySelector('.problems-table tbody');
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #666;">暂无数据</td></tr>';
            }
        } else {
            // Error case is handled inside fetchContestsFromServer
            totalContests = 0;
        }

        renderContestsPagination(totalContests);

        // If a user ID is already in the search box, automatically re-run the search for the new page.
        const userIdInput = document.getElementById('userId');
        if (userIdInput.value.trim()) {
            // Use a small timeout to ensure the DOM has been fully updated by the browser
            // before we try to query it for problem IDs.
            setTimeout(handleUserStatusSearch, 100); 
        }
    }
    
    // 全局变量存储比赛数据 - This is now just a cache for the current view
    // The structure is kept for compatibility with any remaining functions that might use it,
    // but it's no longer pre-populated with all contest data.
    let contestData = {
        all: { contests: [] },
        weekly: { contests: [] },
        monthly: { contests: [] },
        practice: { contests: [] },
        challenge: { contests: [] },
        campus: { contests: [] }
    };

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
        
        const rows = contests.flatMap(contest => {
            const contestUrl = contest.url || '';
            const problems = Array.isArray(contest.problems) ? contest.problems : [];
            const contestName = formatContestName(contest.name);
            const contestCell = contestUrl
                ? `<a class="contest-link" href="${contestUrl}" target="_blank" rel="noopener noreferrer">${contestName}</a>`
                : `${contestName}`;
            
            if (contest.name.includes('牛客小白月赛') && problems.length > 7) {
                const chunks = [];
                for (let i = 0; i < problems.length; i += 7) {
                    chunks.push(problems.slice(i, i + 7));
                }
                
                return chunks.map((chunk, index) => {
                    const problemCells = chunk.map(problem => {
                        const difficultyInfo = getDifficultyInfo(problem.difficulty);
                        const circleStyle = getCircleStyle(difficultyInfo);
                        const tooltipContent = generateTooltipContent(problem, difficultyInfo);
                        const titleHtml = renderProblemTitle(problem, contestUrl);
                        return `<td data-problem-id="${problem.problemId}"><div class="problem-cell"><span class="difficulty-circle ${difficultyInfo.class}" style="${circleStyle}" data-tooltip="${tooltipContent}"></span>${problem.letter}. ${titleHtml}</div></td>`;
                    }).join('');
                    
                    return `<tr>
                                <td>${index === 0 ? contestCell : ''}</td>
                                ${problemCells}
                            </tr>`;
                });
            } else {
                const problemCells = problems.map(problem => {
                    const difficultyInfo = getDifficultyInfo(problem.difficulty);
                    const circleStyle = getCircleStyle(difficultyInfo);
                    const tooltipContent = generateTooltipContent(problem, difficultyInfo);
                    const titleHtml = renderProblemTitle(problem, contestUrl);
                    return `<td data-problem-id="${problem.problemId}"><div class="problem-cell"><span class="difficulty-circle ${difficultyInfo.class}" style="${circleStyle}" data-tooltip="${tooltipContent}"></span>${problem.letter}. ${titleHtml}</div></td>`;
                }).join('');
                
                return `<tr><td>${contestCell}</td>${problemCells}</tr>`;
            }
        });
        
        tbody.innerHTML = rows.join('');
        
        // 添加提示框事件监听器
        initTooltips();
    }

    // 将题目标题渲染为可点击链接（当提供 url 时）
    function renderProblemTitle(problem, contestUrl) {
        const text = problem.title || '';
        const safeText = text.replace(/"/g, '&quot;'); // Sanitize for attribute
        let originalUrl = problem.url || '';
        // 如果爬虫未提供题目链接，则用比赛链接 + /题号 生成
        if (!originalUrl && contestUrl && problem.letter) {
            const base = contestUrl.endsWith('/') ? contestUrl.slice(0, -1) : contestUrl;
            originalUrl = `${base}/${problem.letter}`;
        }

        const finalUrl = mainSiteUrlMap.get(originalUrl) || originalUrl;

        if (originalUrl) { // Only create a link if there was a URL to begin with
            return `<a class="problem-link" href="${finalUrl}" target="_blank" rel="noopener noreferrer" title="${safeText}">${text}</a>`;
        }
        return `<span class="problem-title-text" title="${safeText}">${text}</span>`;
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
        
        // If the score is in the bottom 10% of its tier, show a hollow circle.
        if (percentage <= 0.1) {
            return `background: transparent; border-color: ${color};`;
        }

        // For scores > 10%, scale the percentage from [0.1, 1.0] to [0, 1.0] for the angle calculation.
        const scaledPercentage = (percentage - 0.1) / 0.9;
        const angle = scaledPercentage * 360;

        // Use a conic gradient to show progress, starting from the top (12 o'clock).
        return `background: conic-gradient(from 0deg, ${color} ${angle}deg, transparent ${angle}deg); border-color: ${color};`;
    }
    
    // 根据难度分数获取难度信息
    function getDifficultyInfo(score) {
        let baseClass;
        
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
        const percentage = Math.max(0, Math.min(1, (score - minScore) / (maxScore - minScore)));
        
        return { class: baseClass, percentage: percentage };
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
        const acRate = problem.submissionCount > 0 ? ((problem.acCount / problem.submissionCount) * 100).toFixed(1) : 0;
        
        return `Difficulty: ${problem.difficulty}\nSubmissions: ${problem.submissionCount.toLocaleString()}\nAC: ${problem.acCount.toLocaleString()} (${acRate}%)`;
    }

    // 规范化比赛名称：只显示 “牛客周赛 Round xxx”
    function formatContestName(name) {
        if (!name) return '';
        const raw = String(name).replace(/ \[ACM\]/g, '').replace(/\s+/g, ' ').trim();
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
        
        searchBtn.addEventListener('click', handleUserStatusSearch);
    }

    async function handleUserStatusSearch() {
        const userIdInput = document.getElementById('userId');
        const rivalIdInput = document.getElementById('rivalId');
        const userId1 = userIdInput.value.trim();
        const userId2 = rivalIdInput.value.trim();

        if (!userId1) {
            nowcoderTracker.showNotification('请输入您的用户ID', 'warning');
            return;
        }

        // 1. Collect all visible problem IDs
        const problemCells = document.querySelectorAll('.problems-table-container [data-problem-id]');
        if (problemCells.length === 0) {
            nowcoderTracker.showNotification('当前页面没有题目可供查询', 'info');
            return;
        }

        const qids = Array.from(problemCells).map(cell => cell.getAttribute('data-problem-id')).join(',');

        // 2. Prepare request data with correct parameter names
        const requestData = new URLSearchParams();
        requestData.append('userId1', userId1); // Corrected from 'userId'
        requestData.append('qids', qids);

        if (userId2) {
            requestData.append('userId2', userId2); // Corrected from 'rivalId'
        }

        nowcoderTracker.showNotification('正在查询用户题目通过状态...', 'info');

        try {
            // 3. Send POST request to the proxy, with parameters in the URL
            let queryString = requestData.toString();
            // The Nowcoder API expects literal commas, but URLSearchParams encodes them.
            // We need to decode them back.
            queryString = queryString.replace(/%2C/g, ',');

            const urlWithParams = `/problem/tracker/diff?${queryString}`;

            const response = await fetch(urlWithParams, {
                method: 'POST',
                headers: {
                    // No Content-Type needed for an empty body POST that acts like GET
                },
                body: null // Body is empty
            });

            if (!response.ok) {
                throw new Error(`网络错误: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.code !== 0) {
                throw new Error(`API 错误: ${result.msg}`);
            }

            // 4. Apply highlighting based on the result
            applyProblemHighlighting(result.data, !!userId2);
            nowcoderTracker.showNotification('查询完成！', 'success');

        } catch (error) {
            console.error('查询用户状态时出错:', error);
            nowcoderTracker.showNotification(`查询失败: ${error.message}`, 'error');
        }
    }

    function applyProblemHighlighting(data, hasRival) {
        const { ac1Qids = [], ac2Qids = [] } = data;
        const ac1Set = new Set(ac1Qids.map(id => String(id))); // Ensure IDs are strings for comparison
        const ac2Set = new Set(ac2Qids.map(id => String(id))); // Ensure IDs are strings for comparison

        const problemCells = document.querySelectorAll('.problems-table-container [data-problem-id]');
        
        problemCells.forEach(cell => {
            const problemId = cell.getAttribute('data-problem-id');
            // Reset classes first
            cell.classList.remove('status-ac', 'status-rival-ac', 'status-none');

            if (ac1Set.has(problemId)) {
                cell.classList.add('status-ac');
            } else if (hasRival && ac2Set.has(problemId)) {
                cell.classList.add('status-rival-ac');
            } else {
                cell.classList.add('status-none');
            }
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
    
    function initContestsPaginationControls() {
       const contestPaginationContainer = document.querySelector('#contests-view .pagination-controls');

       if (contestPaginationContainer) {
           contestPaginationContainer.addEventListener('click', (e) => {
               const target = e.target;
               const activeMainTab = document.querySelector('.contest-tab:not(.sub-tabs .contest-tab).active');
               const contestType = activeMainTab ? activeMainTab.getAttribute('data-contest') : 'all';
               const totalItems = totalContests; // Use the total count from the API
               const totalPages = Math.ceil(totalItems / contestsPageSize);

               if (target.id === 'contestsPrevPage' && contestsCurrentPage > 1) {
                   contestsCurrentPage--;
                   updateContestView();
               } else if (target.id === 'contestsNextPage' && contestsCurrentPage < totalPages) {
                   contestsCurrentPage++;
                   updateContestView();
               } else if (target.classList.contains('page-number') && !target.classList.contains('disabled')) {
                   const page = parseInt(target.getAttribute('data-page'));
                   if (page && page !== contestsCurrentPage) {
                       contestsCurrentPage = page;
                       updateContestView();
                   }
               }
           });
       }
   }

     function renderContestsPagination(totalItems) {
         const totalPages = Math.ceil(totalItems / contestsPageSize);
         const startItem = (contestsCurrentPage - 1) * contestsPageSize + 1;
         const endItem = Math.min(contestsCurrentPage * contestsPageSize, totalItems);

         const paginationInfo = document.getElementById('contestsPaginationInfo');
         if (paginationInfo) {
             paginationInfo.textContent = totalItems > 0 ? `显示 ${startItem}-${endItem} 条，共 ${totalItems} 条` : '共 0 条';
         }

         const prevBtn = document.getElementById('contestsPrevPage');
         const nextBtn = document.getElementById('contestsNextPage');
         if (prevBtn) prevBtn.disabled = contestsCurrentPage === 1;
         if (nextBtn) nextBtn.disabled = contestsCurrentPage === totalPages || totalItems === 0;

         const pageNumbersContainer = document.getElementById('contestsPageNumbers');
         if (pageNumbersContainer) {
             pageNumbersContainer.innerHTML = '';
             const maxVisiblePages = 5;
             let startPage = Math.max(1, contestsCurrentPage - Math.floor(maxVisiblePages / 2));
             let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

             if (endPage - startPage + 1 < maxVisiblePages) {
                 startPage = Math.max(1, endPage - maxVisiblePages + 1);
             }

             if (startPage > 1) {
                 pageNumbersContainer.innerHTML += `<span class="page-number" data-page="1">1</span>`;
                 if (startPage > 2) {
                     pageNumbersContainer.innerHTML += `<span class="page-number disabled">...</span>`;
                 }
             }

             for (let i = startPage; i <= endPage; i++) {
                 const activeClass = i === contestsCurrentPage ? 'active' : '';
                 pageNumbersContainer.innerHTML += `<span class="page-number ${activeClass}" data-page="${i}">${i}</span>`;
             }

             if (endPage < totalPages) {
                 if (endPage < totalPages - 1) {
                     pageNumbersContainer.innerHTML += `<span class="page-number disabled">...</span>`;
                 }
                 pageNumbersContainer.innerHTML += `<span class="page-number" data-page="${totalPages}">${totalPages}</span>`;
             }
         }
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
