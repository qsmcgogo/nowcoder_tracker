// Clist.by Nowcoder Problems Crawler
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

class ClistNowcoderCrawler {
	constructor() {
		this.baseUrl = 'https://clist.by/problems/?resource=166&sort_order=desc&sort=date';
		this.headers = {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0 Safari/537.36',
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
			'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
			'Connection': 'keep-alive',
			'Upgrade-Insecure-Requests': '1',
			'Referer': 'https://clist.by/'
		};
		this.maxPages = parseInt(process.env.CLIST_MAX_PAGES || '50', 10);
		this.delayMs = parseInt(process.env.CLIST_DELAY_MS || '500', 10);
	}

	buildPageUrl(page = 1) {
		if (page <= 1) return this.baseUrl;
		return `${this.baseUrl}&problems_paging=${page}`;
	}

	async fetchPage(page = 1) {
		const url = this.buildPageUrl(page);
		console.log(`获取 Clist Nowcoder 题目列表：第 ${page} 页 -> ${url}`);
		const resp = await axios.get(url, { headers: this.headers });
		return resp.data;
	}

	parseProblemsFromHtml(html) {
		const $ = cheerio.load(html);
		const rows = $('table tbody tr');
		const items = [];

		rows.each((_, tr) => {
			const $tr = $(tr);
			const tds = $tr.find('td');
			if (!tds || tds.length === 0) return;

			const textAt = (idx) => (tds.eq(idx).text() || '').replace(/\s+/g, ' ').trim();

			// 可能的列顺序：Date | Rating | Stats | Name Contest | Tags
			const dateText = textAt(0);
			let rating = parseInt(textAt(1), 10);
			if (Number.isNaN(rating)) {
				// 兜底：在行内查找第一个看起来像 rating 的数字
				const m = ($tr.text() || '').match(/\b(\d{2,4})\b/);
				rating = m ? parseInt(m[1], 10) : null;
			}

			// 题目与比赛信息
			const problemAnchor = $tr.find('a[href*="ac.nowcoder.com/acm/contest/"]').first();
			if (!problemAnchor || problemAnchor.length === 0) return;
			const problemUrl = problemAnchor.attr('href');
			const problemName = (problemAnchor.text() || '').replace(/\s+/g, ' ').trim();

			// 比赛（standings）链接与名称
			const contestAnchor = $tr.find('a[href*="/standings/"]').first();
			const contestStandingsUrl = contestAnchor && contestAnchor.attr('href') ? contestAnchor.attr('href') : '';
			const contestName = contestAnchor ? (contestAnchor.text() || '').replace(/\s+/g, ' ').trim() : '';

			// 从题目 URL 提取 contestId 与题号字母
			let contestId = '';
			let letter = '';
			try {
				const m = (problemUrl || '').match(/contest\/(\d+)\/(\w+)/);
				if (m) {
					contestId = m[1];
					letter = m[2];
				}
			} catch (_) {}
			const contestUrl = contestId ? `https://ac.nowcoder.com/acm/contest/${contestId}` : '';

			items.push({
				date: dateText,
				rating: rating,
				problem_name: problemName,
				problem_url: problemUrl,
				letter: letter || null,
				contest_name: contestName || null,
				contest_url: contestUrl || null,
				contest_standings_url: contestStandingsUrl || null
			});
		});

		return items;
	}

	async crawlAll() {
		const all = [];
		for (let p = 1; p <= this.maxPages; p++) {
			try {
				const html = await this.fetchPage(p);
				const pageItems = this.parseProblemsFromHtml(html);
				console.log(`第 ${p} 页解析到 ${pageItems.length} 条`);
				if (pageItems.length === 0 && p > 1) {
					break; // 没有更多数据
				}
				all.push(...pageItems);
				await this.delay(this.delayMs);
			} catch (e) {
				console.log(`第 ${p} 页抓取失败: ${e.message}`);
				if (p === 1) throw e;
				break;
			}
		}

		// 去重（按 problem_url）
		const map = new Map();
		for (const it of all) {
			const key = it.problem_url || `${it.contest_url}|${it.letter}|${it.problem_name}`;
			if (key && !map.has(key)) map.set(key, it);
		}
		return Array.from(map.values());
	}

	saveToFile(items, filename = 'clist_nowcoder_problems.json') {
		const payload = {
			meta: {
				source: 'https://clist.by/problems/?resource=166&sort_order=desc&sort=date',
				resource: 166,
				generated_at: new Date().toISOString(),
				pages: this.maxPages
			},
			items
		};
		fs.writeFileSync(filename, JSON.stringify(payload, null, 2), 'utf8');
		console.log(`已保存 ${items.length} 条到 ${filename}`);
	}

	delay(ms) {
		return new Promise(r => setTimeout(r, ms));
	}
}

async function generateXlsTable() {
    const inputFile = 'clist_nowcoder_problems.json';
    const outputFile = '牛客竞赛题目汇总.xlsx';
    const keywords = ['牛客周赛', '牛客小白月赛', '牛客练习赛', '牛客挑战赛'];

    console.log(`正在从 ${inputFile} 生成筛选后的 Excel 表格...`);

    if (!fs.existsSync(inputFile)) {
        console.error(`错误: 输入文件 ${inputFile} 不存在。请先运行爬虫。`);
        return;
    }

    const xlsx = require('xlsx');
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const data = JSON.parse(rawData);
    const items = data.items || [];

    const filteredItems = items.filter(item =>
        keywords.some(keyword => (item.contest_name || '').includes(keyword))
    );

    if (filteredItems.length === 0) {
        console.log('没有找到符合条件的题目数据。');
        return;
    }

    const worksheetData = filteredItems.map(item => ({
        '题目名称': item.problem_name,
        '题目链接': item.problem_url,
        '所属比赛': item.contest_name
    }));

    const worksheet = xlsx.utils.json_to_sheet(worksheetData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '题目列表');

    // Adjust column widths
    worksheet['!cols'] = [
        { wch: 50 }, // "题目名称" width
        { wch: 60 }, // "题目链接" width
        { wch: 40 }  // "所属比赛" width
    ];

    xlsx.writeFile(workbook, outputFile);
    console.log(`成功生成表格，共 ${filteredItems.length} 条数据，已保存到 ${outputFile}`);
}

async function generateMarkdownTable() {
    const inputFile = 'clist_nowcoder_problems.json';
    const outputFile = '题目链接汇总.md';
    
    console.log(`正在从 ${inputFile} 生成 Markdown 表格...`);
    
    if (!fs.existsSync(inputFile)) {
        console.error(`错误: 输入文件 ${inputFile} 不存在。请先运行爬虫。`);
        return;
    }
    
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const data = JSON.parse(rawData);
    const items = data.items || [];
    
    if (items.length === 0) {
        console.log('文件中没有找到题目数据。');
        return;
    }
    
    let markdownContent = '# 题目链接汇总\n\n';
    markdownContent += '| 题目名称 | 题目链接 |\n';
    markdownContent += '| :--- | :--- |\n';
    
    items.forEach(item => {
        const name = item.problem_name || 'N/A';
        const url = item.problem_url || '#';
        markdownContent += `| ${name} | [${url}](${url}) |\n`;
    });
    
    fs.writeFileSync(outputFile, markdownContent, 'utf8');
    console.log(`成功生成表格，并已保存到 ${outputFile}`);
}

async function parsePracticeMdToJson() {
    const inputFile = '主站练习题目.md';
    const outputFile = 'parsed_practice_problems.json';
    console.log(`正在从 ${inputFile} 解析数据并生成 JSON...`);

    if (!fs.existsSync(inputFile)) {
        console.error(`错误: 输入文件 ${inputFile} 不存在。`);
        return;
    }

    const text = fs.readFileSync(inputFile, 'utf8');
    const parsedData = {};
    const lines = text.split('\n');
    let currentCategory = null;
    let currentKnowledgePoint = null;

    const categoryMap = {
        '新手入门130': 'newbie130',
        '算法入门': 'algo-starter',
        '算法进阶': 'algo-advanced',
        '算法登峰': 'algo-peak',
        '牛客题霸-模板速刷TOP101': 'interview-top101',
        '笔试模板必刷': 'templates',
        '输入输出练习': 'io-practice',
        '面试高频题目': 'interview-high-freq'
    };
    
    // Regex to match a problem line, more robust to handle spaces around separators
    const problemRegex = /-\s*\[(.+?)\]\((.+?)\)\s*\|\s*难度:\s*(\d+)\s*\|\s*通过:\s*([\d,]+)/;

    // First line might be headers, so we can check it
    const headers = lines[0].split('\t').map(h => h.trim());

    for (const line of lines.slice(1)) { // Start from the second line
        const parts = line.split('\t').map(p => p.trim());
        if (parts.length < 4) continue;

        const [title, url, categoryTitle, knowledgePoint] = parts;

        const category = categoryMap[categoryTitle];
        if (!category) continue;
        
        if (!parsedData[category]) {
            parsedData[category] = { knowledge_points: [], problems: [] };
        }
        
        // This format doesn't have difficulty/ac_count, so we'll add placeholders.
        // In a real scenario, you'd need to decide how to source this data.
        const problem = {
            title: title,
            url: url,
            difficulty: 1000, // Placeholder
            ac_count: 0 // Placeholder
        };

        if (knowledgePoint && knowledgePoint !== '') {
            let kp = parsedData[category].knowledge_points.find(k => k.category === knowledgePoint);
            if (!kp) {
                kp = { category: knowledgePoint, problems: [] };
                parsedData[category].knowledge_points.push(kp);
            }
            kp.problems.push(problem);
        } else {
             // For items like "面试高频题" that have no knowledge point
            parsedData[category].problems.push(problem);
        }
    }

    fs.writeFileSync(outputFile, JSON.stringify(parsedData, null, 2), 'utf8');
    console.log(`成功解析数据，并已保存到 ${outputFile}`);
}


async function main() {
	const crawler = new ClistNowcoderCrawler();
	const items = await crawler.crawlAll();
	crawler.saveToFile(items);
	console.log('抓取完成');
}

if (require.main === module) {
    // Check for command line argument to decide what to do
    const args = process.argv.slice(2);
    if (args.includes('--generate-table')) {
        generateMarkdownTable().catch(err => {
            console.error('生成表格失败:', err);
            process.exit(1);
        });
    } else if (args.includes('--generate-xls')) {
        generateXlsTable().catch(err => {
            console.error('生成 Excel 失败:', err);
            process.exit(1);
        });
    } else if (args.includes('--parse-md')) {
        parsePracticeMdToJson().catch(err => {
            console.error('解析 MD 失败:', err);
            process.exit(1);
        });
    } else {
        main().catch(err => {
            console.error('抓取失败:', err);
            process.exit(1);
        });
    }
}

module.exports = ClistNowcoderCrawler;




