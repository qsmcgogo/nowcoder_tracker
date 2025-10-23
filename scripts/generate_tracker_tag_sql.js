/*
  One-off generator: Read 技能树相关/第一章/题目id.txt (TSV) and emit SQL
  updates for tracker_tag.tag_questionstrs. We only keep dependencies that
  map to existing knowledge-point tagIds; ignore big-chapter deps and unknowns.
*/

const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.resolve(__dirname, '..', '技能树相关', '第一章', '题目id.txt');

// Map knowledge point name -> tagId (must match backend)
const nameToTagId = new Map([
  ['基础输出', 1001],
  ['整数', 1002],
  ['浮点数', 1003],
  ['单个字符', 1004],
  ['混合输入', 1005],
  ['加减法', 1006],
  ['乘法', 1007],
  ['除法与取余', 1009],
  ['位移', 1010],
  ['混合运算', 1011],
  ['分支控制与逻辑运算', 1012], // 文件里的节名
  ['分支控制', 1012], // 代码里的显示名
  ['单层循环控制', 1013],
  ['多重循环控制', 1014],
  ['混合控制', 1015],
  ['一维数组', 1016],
  ['字符串', 1017],
]);

// Split helpers for dependency cells
const splitDeps = (raw) => {
  if (!raw || raw === '无') return [];
  return String(raw)
    .split(/[,，;；、\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
};

// Read TSV
const buf = fs.readFileSync(INPUT_PATH, 'utf8');
const lines = buf.split(/\r?\n/).filter(l => l.trim().length > 0);
if (lines.length === 0) {
  console.error('Empty input file');
  process.exit(1);
}

// Header columns (expected): 章, 节, 题目ID, problemId, uuid, 题目名称, 难度, 额外依赖知识点, 大章依赖知识点
const header = lines[0].split('\t');
const colIndex = {
  section: header.indexOf('章'),
  nodeName: header.indexOf('节'),
  qid: header.indexOf('题目ID'),
  problemId: header.indexOf('problemId'),
  uuid: header.indexOf('uuid'),
  title: header.indexOf('题目名称'),
  score: header.indexOf('难度'),
  extraDeps: header.indexOf('额外依赖知识点'),
  chapterDeps: header.indexOf('大章依赖知识点'),
};

// Validate minimal columns
['nodeName','qid','problemId','uuid','title','score','extraDeps'].forEach(k => {
  if (colIndex[k] === -1) {
    console.error(`Missing column: ${k}`);
    process.exit(1);
  }
});

// Aggregate problems by knowledge-point tagId
const tagIdToProblems = new Map();
let lastNodeName = '';

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t');
  // Skip empty lines
  if (cols.length < 7) continue;

  let nodeName = (cols[colIndex.nodeName] || '').trim();
  if (!nodeName) nodeName = lastNodeName; // continue previous node when cell is empty
  if (!nodeName) continue; // still empty, skip
  lastNodeName = nodeName;

  const tagId = nameToTagId.get(nodeName);
  if (!tagId) {
    // Unrecognized node name—skip this row but continue
    continue;
  }

  const qid = (cols[colIndex.qid] || '').trim();
  const problemId = (cols[colIndex.problemId] || '').trim();
  const uuid = (cols[colIndex.uuid] || '').trim();
  const title = (cols[colIndex.title] || '').trim();
  const scoreRaw = (cols[colIndex.score] || '').trim();
  const score = Number(scoreRaw) || 0;
  const extraDepsRaw = (cols[colIndex.extraDeps] || '').trim();

  // Skip rows lacking essential identifiers
  if (!uuid || !problemId || !qid) continue;

  // Map dependency names -> tagIds and keep only known ones
  const depNames = splitDeps(extraDepsRaw);
  const depTagIds = depNames
    .map(n => nameToTagId.get(n))
    .filter(Boolean)
    .map(String);

  const problems = tagIdToProblems.get(tagId) || [];
  problems.push({
    qid,
    problemId,
    uuid,
    name: title,
    score,
    // Use both keys for forward compatibility
    dependencies: depTagIds,
    yilai: depTagIds,
  });
  tagIdToProblems.set(tagId, problems);
}

// Emit SQL updates to UTF-8 file (deterministic order by tagId)
const outPath = path.resolve(__dirname, '..', 'out_tracker_tag_updates.sql');
const linesOut = [];
Array.from(tagIdToProblems.entries())
  .sort((a, b) => a[0] - b[0])
  .forEach(([tagId, problems]) => {
    const json = JSON.stringify(problems, null, 0);
    const sql = `UPDATE tracker_tag SET tag_questionstrs='${json.replace(/'/g, "''")}' WHERE tag_id=${tagId};`;
    linesOut.push(sql);
  });
fs.writeFileSync(outPath, linesOut.join('\n'), 'utf8');
console.log(`Wrote ${linesOut.length} UPDATE statements to ${outPath}`);


