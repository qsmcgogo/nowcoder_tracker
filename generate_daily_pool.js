const fetch = require('node-fetch');
const fs = require('fs');

const API_BASE = 'https://www.nowcoder.com';
const PRACTICE_DATA_URL = `https://static.nowcoder.com/book/tracker/parsed_practice_problems.json?v=${new Date().getTime()}`;

let practiceDataCache = null;

async function fetchPracticeProblemsForDaily() {
    const targetCategories = ['algo-starter', 'algo-advanced', 'algo-peak'];
    
    try {
        if (!practiceDataCache) {
            console.log('Fetching practice problems data...');
            const res = await fetch(PRACTICE_DATA_URL);
            if (!res.ok) throw new Error('Failed to load practice JSON');
            practiceDataCache = await res.json();
            console.log('Successfully fetched practice problems data.');
        }

        let problems = [];
        targetCategories.forEach(cat => {
            const categoryData = practiceDataCache[cat];
            if (categoryData) {
                const items = categoryData.knowledge_points || [{ problems: categoryData.problems }];
                items.forEach(kp => {
                    (kp.problems || []).forEach(p => {
                        if (p && p.problemId) {
                            problems.push({
                                problemId: p.problemId
                            });
                        }
                    });
                });
            }
        });
        console.log(`Found ${problems.length} problems from practice categories.`);
        return problems;
    } catch (error) {
        console.error("Failed to fetch practice problems for daily:", error);
        return [];
    }
}

async function fetchContestProblemsForDaily() {
    const contestTypes = [19, 9]; // Weekly, Monthly
    let allProblems = [];

    console.log('Fetching contest problems data...');
    try {
        for (const type of contestTypes) {
            for (let page = 1; page < 100; page++) { // Limit to 100 pages
                const url = `${API_BASE}/problem/tracker/list?contestType=${type}&page=${page}&limit=100`;
                const response = await fetch(url);
                const data = await response.json();
                if (data.code !== 0 || !data.data || !data.data.papers || data.data.papers.length === 0) break;
                
                const contests = data.data.papers;
                contests.forEach(contest => {
                    (contest.questions || []).forEach(p => {
                        if (p && p.problemId && p.difficulty >= 800 && p.difficulty <= 2000) {
                            allProblems.push({
                                problemId: p.problemId
                            });
                        }
                    });
                });

                if (contests.length < 100) break; // Last page
                process.stdout.write(`  - Fetched page ${page} for contest type ${type}\r`);
            }
        }
        console.log(`\nFound ${allProblems.length} problems from contests.`);
        return allProblems;
    } catch (error) {
        console.error("Failed to fetch contest problems for daily:", error);
        return [];
    }
}

// Fisher-Yates (aka Knuth) Shuffle
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

async function generatePool() {
    console.log('Starting daily problem pool generation...');
    
    const [practiceProblems, contestProblems] = await Promise.all([
        fetchPracticeProblemsForDaily(),
        fetchContestProblemsForDaily()
    ]);

    const combinedPool = [...practiceProblems, ...contestProblems];
    console.log(`Total problems collected before deduplication: ${combinedPool.length}`);

    const uniqueProblemsMap = new Map();
    combinedPool.forEach(p => {
        uniqueProblemsMap.set(p.problemId, p);
    });

    const uniqueProblems = Array.from(uniqueProblemsMap.values());
    console.log(`Total unique problems: ${uniqueProblems.length}`);

    console.log('Shuffling problem IDs...');
    const shuffledProblems = shuffle(uniqueProblems);
    
    const problemIds = shuffledProblems.map(p => parseInt(p.problemId, 10));

    const outputPath = 'daily_problem_pool.json';
    fs.writeFileSync(outputPath, JSON.stringify(problemIds, null, 4));

    console.log(`\n✅ Successfully generated and shuffled problem pool.`);
    console.log(`   - ${problemIds.length} problem IDs have been saved to ${outputPath}`);
}

generatePool();
