#!/usr/bin/env node

import * as https from 'https';
import * as http from 'http';

// ANSI colors
const c = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  bgRed: (s: string) => `\x1b[41m\x1b[37m${s}\x1b[0m`,
  bgGreen: (s: string) => `\x1b[42m\x1b[37m${s}\x1b[0m`,
  bgYellow: (s: string) => `\x1b[43m\x1b[30m${s}\x1b[0m`,
  bgBlue: (s: string) => `\x1b[44m\x1b[37m${s}\x1b[0m`,
  bgCyan: (s: string) => `\x1b[46m\x1b[30m${s}\x1b[0m`,
};

interface OgTags {
  // Open Graph
  'og:title'?: string;
  'og:description'?: string;
  'og:image'?: string;
  'og:image:width'?: string;
  'og:image:height'?: string;
  'og:image:alt'?: string;
  'og:url'?: string;
  'og:type'?: string;
  'og:site_name'?: string;
  'og:locale'?: string;

  // Twitter Card
  'twitter:card'?: string;
  'twitter:site'?: string;
  'twitter:creator'?: string;
  'twitter:title'?: string;
  'twitter:description'?: string;
  'twitter:image'?: string;
  'twitter:image:alt'?: string;

  // Standard HTML
  'title'?: string;
  'description'?: string;
  'canonical'?: string;
  'favicon'?: string;

  // Additional
  [key: string]: string | undefined;
}

interface OgIssue {
  tag: string;
  problem: string;
  fix: string;
  severity: 'error' | 'warning' | 'info';
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        args[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        args[arg.slice(2)] = argv[i + 1];
        i++;
      } else {
        args[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  if (positional.length > 0) args['_url'] = positional[0];
  return args;
}

function showHelp(): void {
  console.log(`
${c.bold(c.cyan('og-check'))} - Validate Open Graph tags and preview social sharing

${c.bold('USAGE')}
  ${c.green('npx @lxgicstudios/og-check')} <url> [options]

${c.bold('EXAMPLES')}
  ${c.dim('# Check a URL')}
  ${c.green('og-check https://example.com')}

  ${c.dim('# JSON output for CI')}
  ${c.green('og-check https://example.com --json')}

  ${c.dim('# Check multiple URLs')}
  ${c.green('og-check https://example.com https://another.com')}

${c.bold('OPTIONS')}
  ${c.yellow('--json')}            Output results as JSON
  ${c.yellow('--ci')}              Exit with code 1 on missing required tags
  ${c.yellow('--timeout')}         Request timeout in ms (default: 10000)
  ${c.yellow('--help')}            Show this help message

${c.bold('CHECKED TAGS')}
  ${c.cyan('og:title')}          Page title for social sharing
  ${c.cyan('og:description')}    Page description snippet
  ${c.cyan('og:image')}          Preview image URL
  ${c.cyan('og:url')}            Canonical URL
  ${c.cyan('og:type')}           Content type (website, article, etc.)
  ${c.cyan('twitter:card')}      Twitter card type
  ${c.cyan('twitter:title')}     Twitter-specific title
  ${c.cyan('twitter:image')}     Twitter-specific image

${c.bold('PREVIEWS')}
  Shows how your link will look when shared on:
  - Twitter/X
  - Facebook
  - LinkedIn
  - Slack

${c.dim('Built by LXGIC Studios - https://github.com/lxgicstudios/og-check')}
`);
}

function fetchUrl(targetUrl: string, timeout: number): Promise<{ statusCode: number; headers: Record<string, string>; body: string; finalUrl: string }> {
  return new Promise((resolve, reject) => {
    const doFetch = (fetchUrl: string, redirects: number) => {
      if (redirects > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      const parsed = new URL(fetchUrl);
      const mod = parsed.protocol === 'https:' ? https : http;

      const options: http.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'og-check/1.0.0 (Open Graph Validator)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout,
      };

      const req = mod.request(options, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const location = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, fetchUrl).toString();
          doFetch(location, redirects + 1);
          return;
        }

        let body = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk: string) => { body += chunk; });
        res.on('end', () => {
          const responseHeaders: Record<string, string> = {};
          for (const [key, val] of Object.entries(res.headers)) {
            responseHeaders[key.toLowerCase()] = Array.isArray(val) ? val.join(', ') : (val || '');
          }
          resolve({
            statusCode: res.statusCode || 0,
            headers: responseHeaders,
            body,
            finalUrl: fetchUrl,
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.end();
    };

    doFetch(targetUrl, 0);
  });
}

function parseHtml(html: string): OgTags {
  const tags: OgTags = {};

  // Parse <title>
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    tags['title'] = decodeHtmlEntities(titleMatch[1].trim());
  }

  // Parse meta tags
  const metaRegex = /<meta\s+([^>]+?)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = match[1];

    // Get property or name
    let key = '';
    const propMatch = attrs.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
    if (propMatch) {
      key = propMatch[1].toLowerCase();
    }

    // Get content
    const contentMatch = attrs.match(/content\s*=\s*["']([^"']*)["']/i);
    if (contentMatch && key) {
      tags[key] = decodeHtmlEntities(contentMatch[1]);
    }
  }

  // Parse meta description
  const descMatch = html.match(/<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*\/?>/i)
    || html.match(/<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i);
  if (descMatch) {
    tags['description'] = decodeHtmlEntities(descMatch[1]);
  }

  // Parse canonical
  const canonicalMatch = html.match(/<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']*)["'][^>]*\/?>/i)
    || html.match(/<link\s+[^>]*href\s*=\s*["']([^"']*)["'][^>]*rel\s*=\s*["']canonical["'][^>]*\/?>/i);
  if (canonicalMatch) {
    tags['canonical'] = canonicalMatch[1];
  }

  // Parse favicon
  const faviconMatch = html.match(/<link\s+[^>]*rel\s*=\s*["'](?:icon|shortcut icon)["'][^>]*href\s*=\s*["']([^"']*)["'][^>]*\/?>/i);
  if (faviconMatch) {
    tags['favicon'] = faviconMatch[1];
  }

  return tags;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

function validateTags(tags: OgTags, url: string): OgIssue[] {
  const issues: OgIssue[] = [];

  // Required OG tags
  if (!tags['og:title']) {
    issues.push({
      tag: 'og:title',
      problem: 'Missing og:title. Social platforms won\'t show a proper title for your link.',
      fix: `<meta property="og:title" content="${tags['title'] || 'Your Page Title'}" />`,
      severity: 'error',
    });
  } else if (tags['og:title'].length > 95) {
    issues.push({
      tag: 'og:title',
      problem: `og:title is ${tags['og:title'].length} chars. It'll get truncated on most platforms (keep under 60-95 chars).`,
      fix: 'Shorten your og:title to under 60 characters for best display.',
      severity: 'warning',
    });
  }

  if (!tags['og:description']) {
    issues.push({
      tag: 'og:description',
      problem: 'Missing og:description. Your link preview won\'t have a description snippet.',
      fix: `<meta property="og:description" content="${tags['description'] || 'A brief description of your page'}" />`,
      severity: 'error',
    });
  } else if (tags['og:description'].length > 300) {
    issues.push({
      tag: 'og:description',
      problem: `og:description is ${tags['og:description'].length} chars. Keep it under 200 for best display.`,
      fix: 'Shorten your og:description to under 200 characters.',
      severity: 'warning',
    });
  }

  if (!tags['og:image']) {
    issues.push({
      tag: 'og:image',
      problem: 'Missing og:image. Your link will have no preview image on any platform.',
      fix: '<meta property="og:image" content="https://yoursite.com/og-image.png" />',
      severity: 'error',
    });
  } else {
    // Check if image URL is absolute
    if (!tags['og:image'].startsWith('http')) {
      issues.push({
        tag: 'og:image',
        problem: 'og:image should be an absolute URL (starting with https://). Relative URLs won\'t work.',
        fix: `<meta property="og:image" content="${new URL(tags['og:image'], url).toString()}" />`,
        severity: 'error',
      });
    }

    // Check image dimensions
    if (!tags['og:image:width'] || !tags['og:image:height']) {
      issues.push({
        tag: 'og:image:width/height',
        problem: 'Missing og:image:width and og:image:height. Some platforms won\'t show the image without dimensions.',
        fix: '<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />',
        severity: 'warning',
      });
    } else {
      const w = parseInt(tags['og:image:width']);
      const h = parseInt(tags['og:image:height']);
      if (w < 200 || h < 200) {
        issues.push({
          tag: 'og:image',
          problem: `Image is ${w}x${h}px. Most platforms need at least 200x200px. Facebook recommends 1200x630px.`,
          fix: 'Use an image that\'s at least 1200x630px for best results.',
          severity: 'warning',
        });
      }
    }

    // Check alt text
    if (!tags['og:image:alt']) {
      issues.push({
        tag: 'og:image:alt',
        problem: 'Missing og:image:alt. Add alt text for accessibility.',
        fix: '<meta property="og:image:alt" content="Description of the image" />',
        severity: 'info',
      });
    }
  }

  if (!tags['og:url']) {
    issues.push({
      tag: 'og:url',
      problem: 'Missing og:url. Platforms won\'t know the canonical URL for your page.',
      fix: `<meta property="og:url" content="${url}" />`,
      severity: 'warning',
    });
  }

  if (!tags['og:type']) {
    issues.push({
      tag: 'og:type',
      problem: 'Missing og:type. Defaults to "website" but it\'s better to be explicit.',
      fix: '<meta property="og:type" content="website" />',
      severity: 'info',
    });
  }

  // Twitter Card
  if (!tags['twitter:card']) {
    issues.push({
      tag: 'twitter:card',
      problem: 'Missing twitter:card. Twitter won\'t show a rich preview without it.',
      fix: '<meta name="twitter:card" content="summary_large_image" />',
      severity: 'warning',
    });
  }

  if (!tags['twitter:title'] && !tags['og:title']) {
    issues.push({
      tag: 'twitter:title',
      problem: 'No twitter:title or og:title. Twitter won\'t display a title.',
      fix: '<meta name="twitter:title" content="Your Page Title" />',
      severity: 'error',
    });
  }

  if (!tags['twitter:image'] && !tags['og:image']) {
    issues.push({
      tag: 'twitter:image',
      problem: 'No twitter:image or og:image. Twitter preview will have no image.',
      fix: '<meta name="twitter:image" content="https://yoursite.com/twitter-image.png" />',
      severity: 'warning',
    });
  }

  // General HTML
  if (!tags['title']) {
    issues.push({
      tag: 'title',
      problem: 'Missing <title> tag. This affects SEO and browser tab display.',
      fix: '<title>Your Page Title</title>',
      severity: 'warning',
    });
  }

  if (!tags['description']) {
    issues.push({
      tag: 'description',
      problem: 'Missing meta description. Search engines use this for search result snippets.',
      fix: '<meta name="description" content="A brief description" />',
      severity: 'info',
    });
  }

  if (!tags['canonical']) {
    issues.push({
      tag: 'canonical',
      problem: 'Missing canonical URL. This helps prevent duplicate content issues.',
      fix: `<link rel="canonical" href="${url}" />`,
      severity: 'info',
    });
  }

  return issues;
}

function truncate(str: string, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

function renderPreviews(tags: OgTags, url: string): void {
  const title = tags['og:title'] || tags['twitter:title'] || tags['title'] || 'No title';
  const desc = tags['og:description'] || tags['twitter:description'] || tags['description'] || 'No description';
  const image = tags['og:image'] || tags['twitter:image'] || null;
  const siteName = tags['og:site_name'] || new URL(url).hostname;

  // Twitter/X Preview
  console.log(c.bold('  Twitter/X Preview'));
  console.log(c.dim('  +' + '-'.repeat(50) + '+'));
  if (image) {
    console.log(c.dim('  |') + c.cyan(` [Image: ${truncate(image, 44)}]`.padEnd(50)) + c.dim('|'));
  }
  console.log(c.dim('  |') + c.bold(` ${truncate(title, 48)}`).padEnd(59) + c.dim('|'));
  console.log(c.dim('  |') + ` ${truncate(desc, 48)}`.padEnd(50) + c.dim('|'));
  console.log(c.dim('  |') + c.dim(` ${truncate(siteName, 48)}`.padEnd(50)) + c.dim('|'));
  console.log(c.dim('  +' + '-'.repeat(50) + '+'));
  console.log('');

  // Facebook Preview
  console.log(c.bold('  Facebook Preview'));
  console.log(c.dim('  +' + '-'.repeat(50) + '+'));
  if (image) {
    console.log(c.dim('  |') + c.blue(` [Image: ${truncate(image, 44)}]`.padEnd(50)) + c.dim('|'));
  }
  console.log(c.dim('  |') + c.dim(` ${siteName}`.padEnd(50)) + c.dim('|'));
  console.log(c.dim('  |') + c.bold(` ${truncate(title, 48)}`).padEnd(59) + c.dim('|'));
  console.log(c.dim('  |') + ` ${truncate(desc, 48)}`.padEnd(50) + c.dim('|'));
  console.log(c.dim('  +' + '-'.repeat(50) + '+'));
  console.log('');

  // LinkedIn Preview
  console.log(c.bold('  LinkedIn Preview'));
  console.log(c.dim('  +' + '-'.repeat(50) + '+'));
  if (image) {
    console.log(c.dim('  |') + c.blue(` [Image: ${truncate(image, 44)}]`.padEnd(50)) + c.dim('|'));
  }
  console.log(c.dim('  |') + c.bold(` ${truncate(title, 48)}`).padEnd(59) + c.dim('|'));
  console.log(c.dim('  |') + c.dim(` ${siteName}`.padEnd(50)) + c.dim('|'));
  console.log(c.dim('  +' + '-'.repeat(50) + '+'));
  console.log('');

  // Slack Preview
  console.log(c.bold('  Slack Preview'));
  console.log(c.dim('  |') + c.green(' |') + c.bold(` ${truncate(title, 45)}`).padEnd(56));
  console.log(c.dim('  |') + c.green(' |') + ` ${truncate(desc, 45)}`.padEnd(47));
  if (image) {
    console.log(c.dim('  |') + c.green(' |') + c.cyan(` [Image: ${truncate(image, 38)}]`).padEnd(47));
  }
  console.log('');
}

function renderTagTable(tags: OgTags): void {
  console.log(c.bold('  All Meta Tags Found'));
  console.log('');

  const ogTags = Object.entries(tags).filter(([k]) => k.startsWith('og:'));
  const twitterTags = Object.entries(tags).filter(([k]) => k.startsWith('twitter:'));
  const otherTags = Object.entries(tags).filter(([k]) => !k.startsWith('og:') && !k.startsWith('twitter:'));

  if (ogTags.length > 0) {
    console.log(c.cyan('  Open Graph'));
    for (const [key, val] of ogTags) {
      console.log(`    ${c.dim(key.padEnd(25))} ${truncate(val || '', 60)}`);
    }
    console.log('');
  }

  if (twitterTags.length > 0) {
    console.log(c.cyan('  Twitter Card'));
    for (const [key, val] of twitterTags) {
      console.log(`    ${c.dim(key.padEnd(25))} ${truncate(val || '', 60)}`);
    }
    console.log('');
  }

  if (otherTags.length > 0) {
    console.log(c.cyan('  Standard HTML'));
    for (const [key, val] of otherTags) {
      console.log(`    ${c.dim(key.padEnd(25))} ${truncate(val || '', 60)}`);
    }
    console.log('');
  }
}

async function checkUrl(targetUrl: string, timeout: number, jsonOutput: boolean, ciMode: boolean): Promise<{ tags: OgTags; issues: OgIssue[]; url: string }> {
  const response = await fetchUrl(targetUrl, timeout);
  const tags = parseHtml(response.body);
  const issues = validateTags(tags, response.finalUrl);
  return { tags, issues, url: response.finalUrl };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args['help']) {
    showHelp();
    process.exit(0);
  }

  const targetUrl = args['_url'] as string;
  if (!targetUrl) {
    console.error(c.red('Error: URL is required.'));
    console.error(c.dim('Usage: og-check <url> [options]'));
    console.error(c.dim('Run og-check --help for more info.'));
    process.exit(1);
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
  } catch {
    console.error(c.red(`Error: Invalid URL: ${targetUrl}`));
    process.exit(1);
  }

  const fullUrl = parsedUrl.toString();
  const jsonOutput = !!args['json'];
  const ciMode = !!args['ci'];
  const timeout = parseInt((args['timeout'] as string) || '10000');

  try {
    if (!jsonOutput) {
      console.log('');
      console.log(c.bold(c.cyan('  og-check')) + c.dim(' v1.0.0'));
      console.log(c.dim(`  Fetching ${fullUrl}...`));
      console.log('');
    }

    const result = await checkUrl(fullUrl, timeout, jsonOutput, ciMode);

    if (jsonOutput) {
      const errors = result.issues.filter(i => i.severity === 'error').length;
      console.log(JSON.stringify({
        url: result.url,
        valid: errors === 0,
        tags: result.tags,
        issues: result.issues,
        summary: {
          errors: result.issues.filter(i => i.severity === 'error').length,
          warnings: result.issues.filter(i => i.severity === 'warning').length,
          info: result.issues.filter(i => i.severity === 'info').length,
        },
      }, null, 2));
    } else {
      // Show tag table
      renderTagTable(result.tags);

      // Show previews
      renderPreviews(result.tags, result.url);

      // Show issues
      if (result.issues.length > 0) {
        console.log(c.bold('  Issues'));
        for (const issue of result.issues) {
          const icon = issue.severity === 'error'
            ? c.red('x')
            : issue.severity === 'warning'
              ? c.yellow('!')
              : c.cyan('i');
          console.log(`  ${icon} ${c.bold(issue.tag)}: ${issue.problem}`);
          console.log(c.dim(`    Fix: ${issue.fix}`));
          console.log('');
        }

        const errors = result.issues.filter(i => i.severity === 'error').length;
        const warnings = result.issues.filter(i => i.severity === 'warning').length;
        const infos = result.issues.filter(i => i.severity === 'info').length;
        console.log(`  ${c.red(`${errors} errors`)}  ${c.yellow(`${warnings} warnings`)}  ${c.cyan(`${infos} suggestions`)}`);
      } else {
        console.log(c.bgGreen(' ALL GOOD ') + ' Your OG tags look great!');
      }
      console.log('');
    }

    if (ciMode && result.issues.some(i => i.severity === 'error')) {
      process.exit(1);
    }
  } catch (err: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: err.message }, null, 2));
    } else {
      console.error('');
      console.error(c.red(`  Error: ${err.message}`));
      if (err.code === 'ENOTFOUND') {
        console.error(c.dim('  Could not resolve hostname. Check the URL and try again.'));
      }
      console.error('');
    }
    process.exit(1);
  }
}

main();
