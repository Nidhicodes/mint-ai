/**
 * E2E test: calls DeepSeek API, generates an app, validates output.
 * Usage: node scripts/e2e-test.mjs
 */

const API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-564bc059a4eb43a89c9ce8882293d9a9';
const BASE_URL = 'https://api.deepseek.com';
const MODEL = 'deepseek-chat';

const SYSTEM_PROMPT = `You are Mint AI, an expert at generating self-contained web applications as single HTML files.
Return ONLY a single \`\`\`html code block. No explanations.
Rules: EVERYTHING in ONE file. MUST include <!DOCTYPE html>, viewport meta, <title>. NO external dependencies.
Design: Mobile-first, CSS custom properties, dark mode default, system font stack, smooth transitions.`;

const TEST_PROMPT = 'A pomodoro timer with a 25/5 minute cycle, start/pause/reset buttons, and a session counter';

async function main() {
  console.log('🌿 Mint AI E2E Test');
  console.log(`   Provider: DeepSeek (${MODEL})`);
  console.log(`   Prompt: "${TEST_PROMPT}"`);
  console.log('   Generating...\n');

  const start = Date.now();

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: TEST_PROMPT },
      ],
      max_tokens: 8192,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ API error ${res.status}: ${err}`);
    process.exit(1);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`   ✅ Response received in ${elapsed}s`);
  console.log(`   Tokens: ${data.usage?.total_tokens ?? '?'} (prompt: ${data.usage?.prompt_tokens}, completion: ${data.usage?.completion_tokens})`);

  // Extract HTML
  const match = raw.match(/```html\s*\n([\s\S]*?)```/);
  if (!match) {
    console.error('❌ No HTML code block found in response');
    console.log('Raw response (first 500 chars):', raw.slice(0, 500));
    process.exit(1);
  }

  const html = match[1].trim();
  console.log(`   HTML size: ${html.length} bytes`);

  // Validate
  const checks = [
    ['Has <!DOCTYPE html>', html.includes('<!DOCTYPE html') || html.includes('<!doctype html')],
    ['Has <title>', /<title>.+<\/title>/i.test(html)],
    ['Has viewport meta', html.includes('viewport')],
    ['Has <style>', html.includes('<style')],
    ['Has <script>', html.includes('<script')],
    ['No external CDN', !html.includes('cdn.') && !html.includes('unpkg.com')],
    ['Has start/pause button', /start|pause/i.test(html)],
    ['Has reset button', /reset/i.test(html)],
  ];

  let passed = 0;
  for (const [name, ok] of checks) {
    console.log(`   ${ok ? '✅' : '❌'} ${name}`);
    if (ok) passed++;
  }

  console.log(`\n   Result: ${passed}/${checks.length} checks passed`);

  // Save the generated app
  const fs = await import('fs');
  const outPath = new URL('../public/demo-apps/pomodoro-timer.html', import.meta.url).pathname;
  fs.mkdirSync(new URL('../public/demo-apps', import.meta.url).pathname, { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`   💾 Saved to ${outPath}`);

  if (passed < checks.length - 1) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
