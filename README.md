# bootstrap-prompt-theme

A [Saltcorn](https://saltcorn.com/) layout plugin that uses a conversational AI chat to design and refine a CSS overlay on top of standard Bootstrap 5.3.

## Relation to any-bootstrap-theme

This plugin is derived from [@saltcorn/any-bootstrap-theme](https://github.com/saltcorn/any-bootstrap-theme). The original plugin offers a large set of configuration variables (colors, card styles, link colors, etc.) that are fed into a Sass build to produce a fully compiled Bootstrap CSS file per theme.

This variant generates a lightweight CSS overlay by chatting with an LLM. Bootstrap 5.3 exposes almost everything through CSS custom properties (`--bs-*`), so a well-written overlay can restyle the entire UI without recompiling Sass.

**Trade-offs:**
- Much simpler setup — no Sass toolchain, no build step
- Describe or refine your theme in plain language through a persistent chat
- The AI applies changes immediately without requiring a page save

## Requirements

- Saltcorn with the `@saltcorn/large-language-model` plugin installed and configured
- Saltcorn with the `@saltcorn/agents` plugin installed

> **Model recommendation:** Good results have been achieved with `@saltcorn/large-language-model` configured to use **GPT-5.4**.

## Usage

1. Go to **Plugins → bootstrap-prompt-theme → Configure**
2. Use the **AI Theme Chat** to describe the visual style you want
3. The AI generates and applies the CSS overlay immediately — no Save needed
4. Continue the conversation to refine colors, fonts, spacing, dark mode, or anything else
5. Use **Clear conversation** to start fresh with a new theme direction

The chat history is persisted across page reloads, so you can return to the configuration page and pick up where you left off.

### Example conversation

```
You:      A dark cyberpunk theme with neon green accents, deep charcoal
          backgrounds, monospace font, and glowing borders on cards.

AI:       [applies CSS overlay]

You:      Make the navbar background slightly lighter and increase the
          card border glow intensity.

AI:       [applies updated CSS overlay]
```

## How the overlay works

The generated file sets CSS custom properties in `:root` that Bootstrap 5.3 reads at runtime:

```css
:root {
  --bs-body-bg: #1a1a2e;
  --bs-body-color: #e0e0e0;
  --bs-primary: #00ff88;
  --bs-card-bg: #16213e;
  /* ... */
}

[data-bs-theme="dark"] {
  --bs-body-bg: #0d0d1a;
  /* ... */
}

.card { border: 1px solid #00ff88; box-shadow: 0 0 8px #00ff88; }
.navbar { background-color: #16213e; }
/* etc. */
```

## Licensing

MIT
