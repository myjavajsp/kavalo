// One-off, idempotent: ensure every seed blog post carries the R1 frontmatter
// flags (ai_assisted / ai_provider / affiliate). Skips files that already have
// all three so re-running is safe. Run from project root:
//   node scripts/add-ai-flags.mjs
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const dir = path.resolve('src/content/blog');
const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md'));

let changed = 0;
let skipped = 0;
for (const file of files) {
  const p = path.join(dir, file);
  const raw = fs.readFileSync(p, 'utf8');
  const { data, content } = matter(raw);
  let modified = false;

  if (data.ai_assisted === undefined) {
    data.ai_assisted = true; // kavalo is an AI-assisted editorial site
    modified = true;
  }
  if (data.ai_provider === undefined) {
    data.ai_provider = 'WorkBuddy (agnes-2.0-flash)';
    modified = true;
  }
  if (data.affiliate === undefined) {
    data.affiliate = true; // review/affiliate site; over-disclose is safer than under
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(p, matter.stringify(content, data), 'utf8');
    changed += 1;
    console.log('✓', file);
  } else {
    skipped += 1;
    console.log('•', file, '(already flagged)');
  }
}
console.log(`\nChanged ${changed}, skipped ${skipped}.`);
