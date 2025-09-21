// 牛客周赛爬虫脚本
const axios = require('axios');
const cheerio = require('cheerio');
let puppeteer; // 延迟引入，避免用户未安装时报错

class NowcoderCrawler {
    constructor() {
        this.baseUrl = 'https://ac.nowcoder.com';
        this.contestListUrl = 'https://ac.nowcoder.com/acm/contest/vip-end-index?rankTypeFilter=-1&onlyCreateFilter=false&topCategoryFilter=13&categoryFilter=19&signUpFilter=&orderType=NO';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };

        this.browser = null;
        this.totalPages = parseInt(process.env.NOWCODER_TOTAL_PAGES || '4', 10);

        // 可选：通过环境变量注入登录态 Cookie 与 token
        // PowerShell 示例：
        //   $env:NOWCODER_COOKIE="nowcoderU=...; NOWCODERCLINETID=...; ..."
        //   $env:NOWCODER_TOKEN=""
        this.cookie = process.env.NOWCODER_COOKIE || '';
        this.apiToken = process.env.NOWCODER_TOKEN || '';
    }

    // 获取比赛列表
    buildContestListUrl(page = 1) {
        return `${this.contestListUrl}&page=${page}`;
    }

    parseContestListFromHtml($) {
        const contests = [];
        const pushContest = (title, href) => {
            if (!title || !href) return;
            if (!/牛客周赛\s*Round\s*\d+/i.test(title)) return;
            const roundMatch = title.match(/Round\s*(\d+)/i);
            const fullLink = href.startsWith('http') ? href : (this.baseUrl + href);
            contests.push({
                title: title.trim(),
                round: roundMatch ? parseInt(roundMatch[1]) : 0,
                link: href,
                fullLink
            });
        };

        // 方法1：以 h4 为锚点，向后查找链接
        $('h4').each((_, h4) => {
            const title = ($(h4).text() || '').trim();
            if (!/牛客周赛\s*Round\s*\d+/i.test(title)) return;
            let href = $(h4).find('a[href*="/acm/contest/"]').attr('href');
            if (!href) href = $(h4).nextAll('a[href*="/acm/contest/"]').first().attr('href');
            if (!href) href = $(h4).parent().find('a[href*="/acm/contest/"]').first().attr('href');
            pushContest(title, href);
        });

        // 方法2：“回顾比赛”按钮，向上找到其所属标题
        $('a').filter((_, a) => /回顾比赛/.test($(a).text())).each((_, a) => {
            const href = $(a).attr('href') || '';
            // 在其上方最近的 h4 中取标题
            const wrapper = $(a).closest('div');
            let title = '';
            if (wrapper && wrapper.length) {
                const prevH4 = wrapper.prevAll('h4').first();
                if (prevH4 && prevH4.length) {
                    title = prevH4.text().trim();
                }
            }
            if (title && href && /\/acm\/contest\//.test(href)) {
                pushContest(title, href);
            }
        });

        // 去重（按 contestId）
        const seen = new Set();
        const uniq = [];
        for (const c of contests) {
            const idMatch = c.fullLink.match(/contest\/(\d+)/);
            const key = idMatch ? idMatch[1] : c.fullLink;
            if (!seen.has(key)) { seen.add(key); uniq.push(c); }
        }
        return uniq;
    }

    async getContestListByPage(page = 1) {
        try {
            const listUrl = this.buildContestListUrl(page);
            console.log(`正在获取牛客周赛列表，第 ${page} 页: ${listUrl}`);
            const response = await axios.get(listUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);
            const contests = this.parseContestListFromHtml($);
            console.log(`成功获取 ${contests.length} 场比赛信息`);
            return contests;
        } catch (error) {
            console.error('获取比赛列表失败:', error.message);
            return [];
        }
    }

    // 提取轮次号
    extractRoundNumber(title) {
        const match = title.match(/Round (\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    // 获取单个比赛的题目信息
    async getContestProblems(contestUrl) {
        try {
            console.log(`正在获取比赛题目: ${contestUrl}`);
            const response = await axios.get(contestUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);
            
            const problems = [];
            const contestId = this.getContestIdFromUrl(contestUrl);
            
            // 策略0：表格中左对齐单元格里的绿色链接（你提供的结构）
            $('td[style*="text-align: left"] a.link-green[href*="/acm/contest/"]').each((_, a) => {
                const href = $(a).attr('href') || '';
                const name = ($(a).text() || '').trim();
                const m = href.match(/\/acm\/contest\/\d+\/([A-Z])(?:\b|$)/);
                if (m && name) {
                    const fullUrl = href.startsWith('http') ? href : (this.baseUrl + href);
                    problems.push({ letter: m[1], title: name, difficulty: this.estimateDifficulty(name), url: fullUrl });
                }
            });

            // 策略0b：直接根据锚点 href 结构 /acm/contest/<id>/<LETTER> 提取
            $('a[href*="/acm/contest/"]').each((_, a) => {
                const href = $(a).attr('href') || '';
                const text = ($(a).text() || '').trim();
                const m = href.match(/\/acm\/contest\/\d+\/([A-Z])(?:\b|$)/);
                if (m && text) {
                    const fullUrl = href.startsWith('http') ? href : (this.baseUrl + href);
                    problems.push({ letter: m[1], title: text, difficulty: this.estimateDifficulty(text), url: fullUrl });
                }
            });

            // 策略1：页面块状结构中的标题与索引
            $('.problem-item, .contest-problem-item').each((index, element) => {
                const problemTitle = $(element).find('.problem-title, .title').text().trim();
                const problemLetter = $(element).find('.problem-index, .index').text().trim();
                const difficulty = this.extractDifficulty($(element));
                if (problemTitle && problemLetter) {
                    problems.push({ letter: problemLetter, title: problemTitle, difficulty });
                }
            });
            
            // 如果没有找到题目，尝试其他选择器（表格两列：第一列题号，第二列链接）
            if (problems.length === 0) {
                $('tr').each((index, element) => {
                    const cells = $(element).find('td');
                    if (cells.length >= 2) {
                        const letter = $(cells[0]).text().trim();
                        const anchor = $(cells[1]).find('a');
                        const title = anchor.text().trim() || $(cells[1]).text().trim();
                        const href = anchor.attr('href') || '';
                        
                        if (letter && title && /^[A-Z]$/.test(letter)) {
                            const fullUrl = href
                                ? (href.startsWith('http') ? href : (this.baseUrl + href))
                                : (contestId ? `${this.baseUrl}/acm/contest/${contestId}/${letter}` : '');
                            problems.push({
                                letter: letter,
                                title: title,
                                difficulty: this.estimateDifficulty(title),
                                url: fullUrl
                            });
                        }
                    }
                });
            }

            // 策略2：文本形式 "A. 标题"
            if (problems.length === 0) {
                $('a, span, div, li').each((_, el) => {
                    const txt = ($(el).text() || '').trim();
                    const m = txt.match(/^([A-Z])\.\s*(.+)$/);
                    if (m) {
                        const letter = m[1];
                        const title = m[2];
                        const url = contestId ? `${this.baseUrl}/acm/contest/${contestId}/${letter}` : '';
                        problems.push({ letter, title, difficulty: this.estimateDifficulty(title), url });
                    }
                });
            }

            // 去重
            const uniq = new Map();
            for (const p of problems) {
                const key = `${p.letter}|${p.title}`;
                if (!uniq.has(key)) uniq.set(key, p);
            }
            let finalProblems = Array.from(uniq.values());
            // 排序按题号A..Z
            finalProblems.sort((a, b) => a.letter.localeCompare(b.letter));
            
            console.log(`获取到 ${finalProblems.length} 道题目`);
            return finalProblems;
        } catch (error) {
            console.error(`获取比赛题目失败: ${contestUrl}`, error.message);
            return [];
        }
    }

    // ============ 官方 API 方案（需登录 Cookie） ============
    getContestIdFromUrl(url) {
        const m = (url || '').match(/contest\/(\d+)/);
        return m ? m[1] : '';
    }

    async getContestProblemsApi(contestId) {
        if (!this.cookie) {
            return [];
        }
        const apiUrl = `${this.baseUrl}/acm/contest/problem-list?token=${encodeURIComponent(this.apiToken)}&id=${contestId}`;
        try {
            console.log(`通过官方API获取题目: contestId=${contestId}`);
            const resp = await axios.get(apiUrl, {
                headers: {
                    ...this.headers,
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': `${this.baseUrl}/acm/contest/${contestId}`,
                    'Cookie': this.cookie,
                },
                withCredentials: true,
            });
            const body = resp.data;
            if (body && body.code === 0 && body.data && Array.isArray(body.data.data)) {
                const problems = body.data.data.map(item => ({
                    letter: item.index,
                    title: item.title,
                    difficulty: this.estimateDifficulty(item.title),
                }));
                // A..Z 排序
                problems.sort((a, b) => a.letter.localeCompare(b.letter));
                console.log(`(API) 获取到 ${problems.length} 道题目`);
                return problems;
            }
            console.log('(API) 返回数据不符合预期');
            return [];
        } catch (e) {
            console.log('(API) 获取题目失败:', e.message);
            return [];
        }
    }

    // ============ 使用无头浏览器（Puppeteer）兜底方案 ============
    async ensureBrowser() {
        if (!puppeteer) {
            try {
                puppeteer = require('puppeteer');
            } catch (err) {
                console.log('未安装 puppeteer，尝试使用 axios/cheerio 方式。要提升成功率，请执行: npm i puppeteer');
                return false;
            }
        }
        if (!this.browser) {
            const fs = require('fs');
            const candidatePaths = [];
            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                candidatePaths.push(process.env.PUPPETEER_EXECUTABLE_PATH);
            }
            // 常见 Windows 浏览器路径（用户可通过环境变量覆盖）
            candidatePaths.push(
                'C://Program Files//Google//Chrome//Application//chrome.exe',
                'C://Program Files (x86)//Google//Chrome//Application//chrome.exe',
                'C://Program Files//Microsoft//Edge//Application//msedge.exe',
                'C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe'
            );
            let executablePath = candidatePaths.find(p => {
                try { return fs.existsSync(p); } catch (_) { return false; }
            });

            const launchOptions = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                ],
            };
            if (executablePath) {
                launchOptions.executablePath = executablePath;
            }
            this.browser = await puppeteer.launch(launchOptions);
        }
        return true;
    }

    async getContestListBrowserByPage(pageNum = 1) {
        const ok = await this.ensureBrowser();
        if (!ok) return [];

        const page = await this.browser.newPage();
        await page.setUserAgent(this.headers['User-Agent']);
        const listUrl = this.buildContestListUrl(pageNum);
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 等待页面主要内容渲染（存在大量前端渲染时生效）
        await page.waitForTimeout(1500);

        const contests = await page.evaluate((baseUrl) => {
            const result = [];
            // 以 h4 为锚点，提取“牛客周赛 Round xxx”对应块，优先拿“回顾比赛”链接
            const headers = Array.from(document.querySelectorAll('h4'));
            for (const h4 of headers) {
                const title = h4.textContent.trim();
                if (!/牛客周赛\s*Round\s*\d+/i.test(title)) continue;

                // 在 h4 所在卡片（父级或后续兄弟）里查找“回顾比赛”按钮链接
                let card = h4.closest('div') || h4.parentElement;
                let linkEl = null;
                if (card) {
                    linkEl = card.querySelector('a[href*="/acm/contest/"]');
                }
                if (!linkEl) {
                    // 退而求其次，在 h4 的后续区域里找
                    linkEl = h4.parentElement && h4.parentElement.querySelector('a[href*="/acm/contest/"]');
                }

                const href = linkEl && linkEl.getAttribute('href');
                if (href) {
                    const roundMatch = title.match(/Round\s*(\d+)/i);
                    result.push({
                        title,
                        round: roundMatch ? parseInt(roundMatch[1]) : 0,
                        link: href,
                        fullLink: href.startsWith('http') ? href : (baseUrl + href)
                    });
                }
            }
            return result;
        }, this.baseUrl);

        await page.close();
        console.log(`(Puppeteer) 第 ${pageNum} 页获取 ${contests.length} 场`);
        return contests;
    }

    // 汇总多页的比赛（默认4页）
    async getAllContestsByPages(totalPages = 4) {
        const all = [];
        for (let p = 1; p <= totalPages; p++) {
            // 先静态解析
            let list = await this.getContestListByPage(p);
            if (!list || list.length === 0) {
                // 回退 Puppeteer 渲染
                list = await this.getContestListBrowserByPage(p);
            }
            all.push(...list);
            // 小憩避免过快
            await this.delay(500);
        }
        // 去重（按 contestId）
        const seen = new Set();
        const uniq = [];
        for (const c of all) {
            const idMatch = (c.fullLink || '').match(/contest\/(\d+)/);
            const key = idMatch ? idMatch[1] : c.fullLink;
            if (!seen.has(key)) { seen.add(key); uniq.push(c); }
        }
        console.log(`合计收集比赛 ${uniq.length} 场（跨 ${totalPages} 页）`);
        return uniq;
    }

    async getContestProblemsBrowser(contestUrl) {
        const ok = await this.ensureBrowser();
        if (!ok) return [];
        const page = await this.browser.newPage();
        await page.setUserAgent(this.headers['User-Agent']);
        await page.goto(contestUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        // 等待可能的题目表格或链接渲染完成
        try {
            await page.waitForSelector('td a.link-green, a[href*="/acm/contest/"]', { timeout: 5000 });
        } catch (_) {}

        const problems = await page.evaluate((baseUrl) => {
            const res = [];
            const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

            // 优先：表格内的绿色链接（左对齐单元格）
            const greenLinks = Array.from(document.querySelectorAll('td[style*="text-align: left"] a.link-green[href*="/acm/contest/"]'));
            for (const a of greenLinks) {
                const href = a.getAttribute('href') || '';
                const m = href.match(/\/acm\/contest\/\d+\/([A-Z])(?:\b|$)/);
                if (m) {
                    const title = norm(a.textContent);
                    const fullUrl = href.startsWith('http') ? href : (baseUrl + href);
                    if (title) res.push({ letter: m[1], title, difficulty: 1200, url: fullUrl });
                }
            }

            // 优先：根据 href /acm/contest/<id>/<LETTER> 提取 letter & title
            const aList = Array.from(document.querySelectorAll('a[href*="/acm/contest/"]'));
            for (const a of aList) {
                const href = a.getAttribute('href') || '';
                const m = href.match(/\/acm\/contest\/\d+\/([A-Z])(?:\b|$)/);
                if (m) {
                    const title = norm(a.textContent);
                    const fullUrl = href.startsWith('http') ? href : (baseUrl + href);
                    if (title) res.push({ letter: m[1], title, difficulty: 1200, url: fullUrl });
                }
            }

            // 策略1：捕捉“X. 标题”形式的链接
            const anchors = Array.from(document.querySelectorAll('a'));
            for (const a of anchors) {
                const text = norm(a.textContent);
                const m = text.match(/^([A-Z])\.\s*(.+)$/);
                if (m) {
                    res.push({ letter: m[1], title: m[2], difficulty: 1200 });
                }
            }

            // 策略2：表格两列形式（第一列为字母，第二列为标题）
            if (res.length === 0) {
                const rows = Array.from(document.querySelectorAll('table tr'));
                for (const tr of rows) {
                    const tds = tr.querySelectorAll('td');
                    if (tds.length >= 2) {
                        const letter = norm(tds[0].textContent);
                        const title = norm(tds[1].textContent);
                        if (/^[A-Z]$/.test(letter) && title) {
                            res.push({ letter, title, difficulty: 1200 });
                        }
                    }
                }
            }

            // 去重（同一题可能被匹配多次）
            const map = new Map();
            for (const p of res) {
                const key = p.letter + '|' + p.title;
                if (!map.has(key)) map.set(key, p);
            }
            const arr = Array.from(map.values());
            arr.sort((a, b) => a.letter.localeCompare(b.letter));
            return arr;
        }, this.baseUrl);

        await page.close();
        console.log(`(Puppeteer) 获取到 ${problems.length} 道题目`);
        return problems;
    }

    // 提取难度信息
    extractDifficulty(element) {
        const difficultyText = element.find('.difficulty, .level').text().trim();
        if (difficultyText.includes('简单') || difficultyText.includes('Easy')) return 600;
        if (difficultyText.includes('中等') || difficultyText.includes('Medium')) return 1200;
        if (difficultyText.includes('困难') || difficultyText.includes('Hard')) return 1800;
        return 1000; // 默认难度
    }

    // 根据题目名称估算难度
    estimateDifficulty(title) {
        const easyKeywords = ['入门', '基础', '简单', 'Easy', 'Basic'];
        const hardKeywords = ['困难', '复杂', 'Hard', 'Advanced', 'DP', '图论', '数学'];
        
        for (const keyword of easyKeywords) {
            if (title.includes(keyword)) return 600;
        }
        
        for (const keyword of hardKeywords) {
            if (title.includes(keyword)) return 1800;
        }
        
        return 1200; // 默认中等难度
    }

    // 获取所有比赛和题目信息
    async getAllContestData(maxContests = Infinity) {
        // 遍历多页（默认 this.totalPages 页，可通过环境变量 NOWCODER_TOTAL_PAGES 调整）
        let contests = await this.getAllContestsByPages(this.totalPages);
        const result = {
            contests: []
        };
        
        // 限制获取的比赛数量（若指定且为有限值）
        const limitedContests = (Number.isFinite(maxContests))
            ? contests.slice(0, maxContests)
            : contests;
        
        for (const contest of limitedContests) {
            if (contest.fullLink) {
                const contestId = this.getContestIdFromUrl(contest.fullLink);
                let problems = [];

                // 优先尝试官方 API（需要 Cookie）
                if (contestId) {
                    problems = await this.getContestProblemsApi(contestId);
                }

                // API 失败则回退静态解析
                if (!problems || problems.length === 0) {
                    problems = await this.getContestProblems(contest.fullLink);
                }

                // 再回退到无头浏览器
                if (!problems || problems.length === 0) {
                    console.log('静态解析题目为空，尝试使用 Puppeteer 解析题目...');
                    problems = await this.getContestProblemsBrowser(contest.fullLink);
                }
                if (problems.length > 0) {
                    result.contests.push({
                        name: contest.title,
                        round: contest.round,
                        url: contest.fullLink,
                        problems: problems
                    });
                }
                
                // 添加延迟避免请求过快
                await this.delay(1000);
            }
        }
        
        // 关闭浏览器
        if (this.browser) {
            await this.browser.close();
        }
        
        return result;
    }

    // 延迟函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 保存数据到文件
    saveToFile(data, filename = 'contest_data.json') {
        const fs = require('fs');
        fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
        console.log(`数据已保存到 ${filename}`);
    }
}

// 使用示例
async function main() {
    const crawler = new NowcoderCrawler();
    
    try {
        // 获取全部比赛（覆盖 totalPages 页），不限制数量
        const data = await crawler.getAllContestData();
        
        // 保存到文件
        crawler.saveToFile(data, 'nowcoder_weekly_contests.json');
        
        console.log('爬取完成！');
        console.log(`共获取 ${data.contests.length} 场比赛的数据`);
        
        // 显示统计信息
        data.contests.forEach(contest => {
            console.log(`${contest.name}: ${contest.problems.length} 道题目`);
        });
        
    } catch (error) {
        console.error('爬取过程中出现错误:', error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = NowcoderCrawler;

