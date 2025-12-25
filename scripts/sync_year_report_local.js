const fs = require('fs');

function mustFind(haystack, needle, name) {
  const idx = haystack.indexOf(needle);
  if (idx < 0) throw new Error(`Cannot find ${name}: ${needle}`);
  return idx;
}

function extractMockBlock(localHtml) {
  // Extract from marker line to just before SHARE_URL definition
  const marker = '// 这里是本地写死数据';
  const start = mustFind(localHtml, marker, 'mock marker');

  // Find the first "var SHARE_URL" after marker
  const shareKey = '\n  var SHARE_URL';
  const shareIdx = localHtml.indexOf(shareKey, start);
  if (shareIdx < 0) throw new Error('Cannot find "var SHARE_URL" after mock marker');

  // Keep indentation as-is (2 spaces)
  return localHtml.slice(start, shareIdx).trimEnd();
}

function replaceFirstDataScript(vmHtml, mockBlock) {
  const dataMarker = '// --- 1. 数据获取 ---';
  const markerIdx = mustFind(vmHtml, dataMarker, 'vm data marker');

  const scriptOpenIdx = vmHtml.lastIndexOf('<script', markerIdx);
  if (scriptOpenIdx < 0) throw new Error('Cannot find <script before data marker');
  const scriptOpenEnd = vmHtml.indexOf('>', scriptOpenIdx);
  if (scriptOpenEnd < 0) throw new Error('Bad <script tag');

  const scriptCloseIdx = vmHtml.indexOf('</script>', markerIdx);
  if (scriptCloseIdx < 0) throw new Error('Cannot find </script> after data marker');
  const scriptCloseEnd = scriptCloseIdx + '</script>'.length;

  const replacement =
    `<script>\n` +
    `  // --- 1. 数据获取（本地静态预览：mock） ---\n` +
    `  ${mockBlock.replace(/\n/g, '\n  ')}\n` +
    `\n` +
    `  // 模拟空数据保护（与线上一致）\n` +
    `  if (!serverData.overview) serverData.overview = {};\n` +
    `  if (!serverData.timeseries) serverData.timeseries = {};\n` +
    `  if (!serverData.tags) serverData.tags = {};\n` +
    `  if (!serverData.difficulty) serverData.difficulty = {};\n` +
    `  if (!serverData.habits) serverData.habits = {};\n` +
    `  if (!serverData.quality) serverData.quality = {};\n` +
    `  if (!serverData.highlights) serverData.highlights = {};\n` +
    `  if (!serverData.user) serverData.user = {};\n` +
    `</script>`;

  return vmHtml.slice(0, scriptOpenIdx) + replacement + vmHtml.slice(scriptCloseEnd);
}

function replaceTitle(html, newTitle) {
  return html.replace(/<title>[^<]*<\/title>/, `<title>${newTitle}</title>`);
}

function main() {
  const vmPath = 'backend/vm/my_2025_year_report.vm';
  const localPath = 'backend/vm/my_2025_year_report_local.html';

  const vmHtml = fs.readFileSync(vmPath, 'utf8');
  const localHtml = fs.readFileSync(localPath, 'utf8');

  const mockBlock = extractMockBlock(localHtml);
  let out = replaceFirstDataScript(vmHtml, mockBlock);
  out = replaceTitle(out, '你的2025 Tracker年度报告（本地静态预览）');

  // For local preview, ensure no Velocity directives remain (best-effort)
  out = out.replace(/^\s*#(if|end)\b.*$/gm, '');

  fs.writeFileSync(localPath, out, 'utf8');
  console.log('Synced local HTML from VM with preserved mock data.');
}

main();

