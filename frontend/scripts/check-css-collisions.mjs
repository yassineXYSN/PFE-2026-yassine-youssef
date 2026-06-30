import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const baselinePath = path.join(__dirname, 'css-collision-baseline.json');
const shouldUpdateBaseline = process.argv.includes('--update-baseline');

function walkCssFiles(dirPath, acc = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkCssFiles(fullPath, acc);
    } else if (entry.isFile() && entry.name.endsWith('.css')) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function extractClasses(cssContent) {
  const classes = new Set();
  const regex = /^\s*\.([A-Za-z][A-Za-z0-9_-]*)\s*\{/gm;
  let match;
  while ((match = regex.exec(cssContent)) !== null) {
    classes.add(match[1]);
  }
  return classes;
}

function getDuplicateMap() {
  const classMap = new Map();
  const cssFiles = walkCssFiles(srcDir).sort();

  for (const filePath of cssFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const classNames = extractClasses(content);
    const relPath = path.relative(projectRoot, filePath).replaceAll(path.sep, '/');

    for (const className of classNames) {
      if (!classMap.has(className)) classMap.set(className, new Set());
      classMap.get(className).add(relPath);
    }
  }

  const duplicates = {};
  const sortedClasses = [...classMap.keys()].sort((a, b) => a.localeCompare(b));
  for (const className of sortedClasses) {
    const files = [...classMap.get(className)].sort();
    if (files.length > 1) {
      duplicates[className] = files;
    }
  }

  return duplicates;
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return {};
  const raw = fs.readFileSync(baselinePath, 'utf8');
  return JSON.parse(raw);
}

function writeBaseline(data) {
  fs.writeFileSync(baselinePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function compareWithBaseline(current, baseline) {
  const violations = [];

  for (const [className, currentFiles] of Object.entries(current)) {
    if (!baseline[className]) {
      violations.push({
        type: 'new-class-collision',
        className,
        files: currentFiles,
      });
      continue;
    }

    const baselineSet = new Set(baseline[className]);
    const newFiles = currentFiles.filter((f) => !baselineSet.has(f));
    if (newFiles.length > 0) {
      violations.push({
        type: 'new-file-collision',
        className,
        files: newFiles,
      });
    }
  }

  return violations;
}

const currentDuplicates = getDuplicateMap();

if (shouldUpdateBaseline) {
  writeBaseline(currentDuplicates);
  console.log(`Updated baseline: ${path.relative(projectRoot, baselinePath).replaceAll(path.sep, '/')}`);
  console.log(`Tracked duplicated selectors: ${Object.keys(currentDuplicates).length}`);
  process.exit(0);
}

const baseline = readBaseline();
const violations = compareWithBaseline(currentDuplicates, baseline);

if (violations.length === 0) {
  console.log('CSS collision check passed. No new duplicate selectors beyond baseline.');
  process.exit(0);
}

console.error('CSS collision check failed: new duplicate selectors detected.');
for (const violation of violations) {
  if (violation.type === 'new-class-collision') {
    console.error(`- New duplicate class ".${violation.className}" in:`);
    for (const file of violation.files) {
      console.error(`  - ${file}`);
    }
    continue;
  }

  console.error(`- Existing duplicate class ".${violation.className}" has new file(s):`);
  for (const file of violation.files) {
    console.error(`  - ${file}`);
  }
}

console.error('\nIf intentional, run: npm run check:css-collisions:update');
process.exit(1);
