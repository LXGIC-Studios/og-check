# @lxgicstudios/og-check

[![npm version](https://img.shields.io/npm/v/@lxgicstudios/og-check)](https://www.npmjs.com/package/@lxgicstudios/og-check)
[![license](https://img.shields.io/npm/l/@lxgicstudios/og-check)](https://github.com/lxgicstudios/og-check/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@lxgicstudios/og-check)](https://nodejs.org)
[![zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/@lxgicstudios/og-check)

Validate Open Graph meta tags for any URL. Preview how your links look on Twitter, Facebook, LinkedIn, and Slack. Flag missing og:title, og:description, og:image. Check image dimensions and get actionable fix suggestions.

**Zero dependencies.** Uses Node.js built-ins only.

## Install

```bash
# Run directly
npx @lxgicstudios/og-check https://example.com

# Or install globally
npm i -g @lxgicstudios/og-check
```

## Usage

```bash
# Check any URL
og-check https://example.com

# JSON output for CI/CD pipelines
og-check https://example.com --json

# Fail CI if required tags are missing
og-check https://example.com --ci

# Custom timeout
og-check https://slow-site.com --timeout 15000
```

## What It Checks

### Open Graph Tags
- `og:title` - Page title for social sharing
- `og:description` - Description snippet
- `og:image` - Preview image URL
- `og:image:width` / `og:image:height` - Image dimensions
- `og:image:alt` - Image accessibility text
- `og:url` - Canonical URL
- `og:type` - Content type (website, article)
- `og:site_name` - Site name

### Twitter Card Tags
- `twitter:card` - Card type (summary, summary_large_image)
- `twitter:title` - Twitter-specific title
- `twitter:description` - Twitter-specific description
- `twitter:image` - Twitter-specific image
- `twitter:site` - @username of the site
- `twitter:creator` - @username of content creator

### Standard HTML
- `<title>` - Browser tab title
- `meta description` - Search engine snippet
- `canonical` - Canonical URL
- `favicon` - Site icon

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--json` | Output results as JSON | `false` |
| `--ci` | Exit code 1 if required tags missing | `false` |
| `--timeout` | Request timeout in milliseconds | `10000` |
| `--help` | Show help message | |

## Social Platform Previews

The tool shows ASCII previews of how your link will appear when shared on:

- **Twitter/X** - Shows image, title, description, site name
- **Facebook** - Shows image, site, title, description
- **LinkedIn** - Shows image, title, site name
- **Slack** - Shows title, description, image

## Issue Severity

| Level | Meaning |
|-------|---------|
| Error | Missing required tags. Link previews will be broken. |
| Warning | Missing recommended tags. Previews may not look optimal. |
| Info | Suggestions for best practices. |

## Example Output

```
  og-check v1.0.0
  Fetching https://example.com...

  All Meta Tags Found

  Open Graph
    og:title                  Example Domain
    og:description            This domain is for examples.
    og:image                  https://example.com/image.png

  Twitter/X Preview
  +--------------------------------------------------+
  | [Image: https://example.com/image.png]           |
  | Example Domain                                   |
  | This domain is for examples.                     |
  | example.com                                      |
  +--------------------------------------------------+

  Issues
  ! og:image:width/height: Missing dimensions...
    Fix: <meta property="og:image:width" content="1200" />

  0 errors  1 warnings  2 suggestions
```

## JSON Output

```json
{
  "url": "https://example.com",
  "valid": true,
  "tags": {
    "og:title": "Example Domain",
    "og:description": "This domain is for examples.",
    "og:image": "https://example.com/image.png"
  },
  "issues": [...],
  "summary": {
    "errors": 0,
    "warnings": 1,
    "info": 2
  }
}
```

## CI Integration

Use in GitHub Actions or other CI pipelines:

```yaml
- name: Check OG tags
  run: npx @lxgicstudios/og-check https://yoursite.com --ci
```

The `--ci` flag exits with code 1 if any required tags are missing.

## License

MIT - [LXGIC Studios](https://lxgicstudios.com)
