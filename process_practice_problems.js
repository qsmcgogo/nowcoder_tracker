const fs = require('fs');
const path = require('path');

async function processProblems() {
    try {
        const qidToProblemIdMap = new Map();
        const checkMdPath = path.join(__dirname, 'check.md');
        const practiceJsonPath = path.join(__dirname, 'parsed_practice_problems.json');

        console.log('Reading check.md...');
        const checkMdContent = fs.readFileSync(checkMdPath, 'utf-8');
        const lines = checkMdContent.split(/\r?\n/).slice(1); // Handle both LF and CRLF line endings

        for (const line of lines) {
            const parts = line.split(/[\t\s]+/).filter(Boolean); // Robust split for tabs or spaces
            if (parts.length >= 2) {
                const problemId = parts[0].trim();
                const qid = parts[1].trim();
                if (problemId && qid) {
                    qidToProblemIdMap.set(qid, problemId);
                }
            }
        }
        console.log(`Loaded ${qidToProblemIdMap.size} mappings from check.md`);

        if (qidToProblemIdMap.size === 0) {
            console.error('No mappings loaded. Please check the format of check.md.');
            return;
        }

        console.log('Reading parsed_practice_problems.json...');
        const practiceProblemsContent = fs.readFileSync(practiceJsonPath, 'utf-8');
        const practiceProblemsData = JSON.parse(practiceProblemsContent);

        let problemsUpdated = 0;
        let problemsMissed = 0;

        const processProblemList = (list) => {
            if (!list) return;
            for (const problem of list) {
                if (problem.url) {
                    try {
                        // Correctly extract qid from URL (tqId parameter)
                        const url = new URL(problem.url, 'https://www.nowcoder.com');
                        const qid = url.searchParams.get('tqId');

                        if (qid) {
                            if (qidToProblemIdMap.has(qid)) {
                                problem.problemId = qidToProblemIdMap.get(qid);
                                problemsUpdated++;
                            } else {
                                problemsMissed++;
                            }
                        }
                    } catch (e) {
                        console.warn(`Could not parse URL or find tqId in: ${problem.url}`);
                    }
                }
            }
        };
        
        for (const categoryKey in practiceProblemsData) {
            const category = practiceProblemsData[categoryKey];
            processProblemList(category.problems);
            if (category.knowledge_points) {
                for (const kp of category.knowledge_points) {
                    processProblemList(kp.problems);
                }
            }
        }

        console.log(`Updated ${problemsUpdated} problems with their problemId.`);
        if (problemsMissed > 0) {
            console.warn(`${problemsMissed} problems had a qid but no matching problemId in check.md.`);
        }
        
        fs.writeFileSync(practiceJsonPath, JSON.stringify(practiceProblemsData, null, 2));
        console.log('Successfully updated parsed_practice_problems.json');

    } catch (error) {
        console.error('An error occurred during processing:', error);
    }
}

processProblems();
