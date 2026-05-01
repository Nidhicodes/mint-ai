import type { App, GenerationResult, Message, ProviderConfig } from '../types';
import { buildSystemPrompt, MODIFY_PREFIX, META_PROMPT } from './prompts';
import { streamChat } from '../providers/stream';

/** Extract HTML from markdown code block or raw response */
function extractHtml(raw: string): string {
  const match = raw.match(/```html\s*\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  // Fallback: if response starts with <!DOCTYPE or <html, use as-is
  const trimmed = raw.trim();
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) return trimmed;
  throw new Error('No HTML found in response');
}

/** Ensure generated HTML has required elements */
function fixHtml(html: string): string {
  let fixed = html;
  if (!fixed.includes('<!DOCTYPE')) fixed = '<!DOCTYPE html>\n' + fixed;
  if (!fixed.includes('viewport'))
    fixed = fixed.replace('<head>', '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  if (!fixed.includes('<meta charset'))
    fixed = fixed.replace('<head>', '<head>\n<meta charset="UTF-8">');
  return fixed;
}

/** Extract metadata from generated HTML using the LLM */
async function extractMeta(
  config: ProviderConfig,
  html: string,
): Promise<{ title: string; description: string; tags: string[] }> {
  // Try to get title from HTML first
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const fallbackTitle = titleMatch?.[1] || 'Untitled App';

  try {
    const messages: Message[] = [
      { role: 'user', content: `${META_PROMPT}\n\n${html.slice(0, 2000)}` },
    ];
    let result = '';
    for await (const chunk of streamChat(config, messages)) {
      result += chunk;
    }
    const cleaned = result.replace(/```json\s*\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || fallbackTitle,
      description: parsed.description || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return { title: fallbackTitle, description: '', tags: [] };
  }
}

/** Main generation pipeline */
export async function generate(
  config: ProviderConfig,
  prompt: string,
  existingApp: App | null,
  onStream: (chunk: string) => void,
  themeId?: string,
): Promise<GenerationResult> {
  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt(themeId) },
  ];

  if (existingApp) {
    // Put existing HTML in the user message so the LLM sees it prominently
    messages.push({
      role: 'user',
      content: MODIFY_PREFIX + '```html\n' + existingApp.html + '\n```\n\nModification requested: ' + prompt,
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  let raw = '';
  for await (const chunk of streamChat(config, messages)) {
    raw += chunk;
    onStream(chunk);
  }

  const html = fixHtml(extractHtml(raw));
  const meta = await extractMeta(config, html);

  return { html, ...meta };
}
