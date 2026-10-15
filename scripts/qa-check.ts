/**
 * QA checks for kavalo.top SSR + MySQL + admin upgrade.
 *
 * Pure function / config tests that DO NOT require a running MySQL instance:
 *   1. markdown.renderMarkdown — heading ids, github-slugger dedup, TOC
 *   2. auth — signSession / verifySession / verifyPassword
 *   3. db — reads configuration from process.env.DB_* (no real connection)
 *
 * Run:  node_modules/.bin/tsx scripts/qa-check.ts
 * Exit code 0 = all pass, 1 = at least one failure, 2 = harness error.
 */

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    pass++;
    console.log(`  \x1b[32mPASS\x1b[0m ${name}`);
  } else {
    fail++;
    const line = `${name}${detail ? ' — ' + detail : ''}`;
    failures.push(line);
    console.log(`  \x1b[31mFAIL\x1b[0m ${line}`);
  }
}

// ---------------------------------------------------------------------------
// 1. markdown.renderMarkdown
// ---------------------------------------------------------------------------
async function testMarkdown(): Promise<void> {
  console.log('\n[1] markdown.renderMarkdown');
  const { renderMarkdown } = await import('../src/lib/markdown.ts');

  const body = [
    '# Title',
    '## First',
    'Intro text.',
    '## Second',
    '### Sub A',
    'Body.',
    '## First',
    '### Sub A',
    'More body.',
  ].join('\n');

  const { html, toc } = renderMarkdown(body);

  // (a) every h2/h3 in the output HTML carries an id attribute
  const headingRe = /<h([23])([^>]*)>/g;
  let m: RegExpExecArray | null;
  let headingsChecked = 0;
  let allHaveId = true;
  while ((m = headingRe.exec(html)) !== null) {
    headingsChecked++;
    if (!/id="[^"]+"/.test(m[2])) allHaveId = false;
  }
  check('a1 html contains h2/h3', headingsChecked >= 5, `found ${headingsChecked}`);
  check('a2 all h2/h3 have id attribute', allHaveId);

  // (b) duplicate titles produce `first` and `first-1` (github-slugger dedup)
  check('b1 first h2 id present', html.includes('id="first"'));
  check('b2 duplicate h2 id present (first-1)', html.includes('id="first-1"'));
  check('b3 h3 sub-a present', html.includes('id="sub-a"'));
  check('b4 duplicate h3 sub-a-1 present', html.includes('id="sub-a-1"'));

  // (c) toc array: depth 2–3, slug matches a heading id, text non-empty
  const ids = new Set<string>();
  const idRe = /<h[23] id="([^"]+)"/g;
  while ((m = idRe.exec(html)) !== null) ids.add(m[1]);

  const depthsOk = toc.every((t) => t.depth === 2 || t.depth === 3);
  const slugsMatch = toc.every((t) => ids.has(t.slug));
  const textsOk = toc.every((t) => typeof t.text === 'string' && t.text.length > 0);
  check('c1 toc depth is 2..3 only', depthsOk, `depths=${toc.map((t) => t.depth)}`);
  check('c2 toc slugs match heading ids', slugsMatch, `slugs=${toc.map((t) => t.slug)}`);
  check('c3 toc text non-empty', textsOk);
  check('c4 toc length equals h2+h3 count', toc.length === 5, `len=${toc.length}`);

  // ensure the toc slugs are the github-slugger values, not plain text
  const first = toc.find((t) => t.slug === 'first');
  check('c5 toc first entry slug=first depth=2', !!first && first.depth === 2 && first.text === 'First');
}

// ---------------------------------------------------------------------------
// 2. auth
// ---------------------------------------------------------------------------
async function testAuth(): Promise<void> {
  console.log('\n[2] auth (sign/verify/password)');
  process.env.ADMIN_PASSWORD = 'qa-admin-pass-123';
  process.env.SESSION_SECRET = 'qa-secret-needs-to-be-long-enough-xxxx';

  const { signSession, verifySession, verifyPassword } = await import('../src/lib/auth.ts');

  const token = signSession();
  check('a1 signSession returns string token with dot', typeof token === 'string' && token.includes('.'));

  check('a2 verifySession valid token = true', verifySession(token) === true);

  // tamper: flip last char of signature, keep length identical
  const [payload, sig] = token.split('.');
  const last = sig.slice(-1);
  const alt = last === 'A' ? 'B' : 'A';
  const tampered = `${payload}.${sig.slice(0, -1)}${alt}`;
  check('a3 verifySession tampered token = false', verifySession(tampered) === false);

  check('a4 verifySession empty/undefined = false', verifySession('') === false && verifySession(undefined) === false);

  // verifyPassword
  let threw = false;
  let good = false;
  let bad = false;
  try {
    good = verifyPassword('qa-admin-pass-123');
    bad = verifyPassword('definitely-wrong');
    verifyPassword(''); // must not throw
  } catch (e) {
    threw = true;
  }
  check('b1 verifyPassword correct = true', good === true);
  check('b2 verifyPassword wrong = false', bad === false);
  check('b3 verifyPassword wrong does not throw', threw === false);
}

// ---------------------------------------------------------------------------
// 3. db — reads process.env.DB_* (no real connection)
// ---------------------------------------------------------------------------
function resolvePoolConfig(pool: any): any {
  const candidates = [
    pool?.pool?.config?.connectionConfig,
    pool?.config?.connectionConfig,
    pool?.config?.config?.connectionConfig,
  ];
  for (const c of candidates) {
    if (c && typeof c.host === 'string' && typeof c.database === 'string') return c;
  }
  // fallback: depth-first search for an object exposing host+database
  let found: any = null;
  const seen = new WeakSet();
  const walk = (o: any): void => {
    if (!o || typeof o !== 'object' || seen.has(o) || found) return;
    seen.add(o);
    if (typeof o.host === 'string' && typeof o.database === 'string' && typeof o.port !== 'undefined') {
      found = o;
      return;
    }
    for (const k of Object.keys(o)) walk(o[k]);
  };
  walk(pool);
  return found;
}

async function testDb(): Promise<void> {
  console.log('\n[3] db config (env-driven, no connect)');
  process.env.DB_HOST = 'qa-db-host';
  process.env.DB_PORT = '3309';
  process.env.DB_USER = 'qa-db-user';
  process.env.DB_PASSWORD = 'qa-db-pass';
  process.env.DB_NAME = 'qa_kavalo';

  const db = await import('../src/lib/db.ts');
  const cfg = resolvePoolConfig(db.pool);

  check('a1 pool config resolved', !!cfg);
  check('a2 host from DB_HOST', cfg?.host === 'qa-db-host', `got ${cfg?.host}`);
  check('a3 port from DB_PORT (number)', cfg?.port === 3309, `got ${cfg?.port}`);
  check('a4 user from DB_USER', cfg?.user === 'qa-db-user', `got ${cfg?.user}`);
  check('a5 password from DB_PASSWORD', cfg?.password === 'qa-db-pass', `got ${cfg?.password}`);
  check('a6 database from DB_NAME', cfg?.database === 'qa_kavalo', `got ${cfg?.database}`);
  check('a7 query/execute exported', typeof db.query === 'function' && typeof db.execute === 'function');
}

// ---------------------------------------------------------------------------
async function run(): Promise<void> {
  await testMarkdown();
  await testAuth();
  await testDb();

  console.log('\n========================================');
  console.log(`QA CHECK SUMMARY  PASS=${pass}  FAIL=${fail}`);
  console.log('========================================');
  if (fail > 0) {
    console.log('Failures:');
    for (const f of failures) console.log('  - ' + f);
  }
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Harness error:', e);
  process.exit(2);
});
