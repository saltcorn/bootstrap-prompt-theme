const { getState } = require("@saltcorn/data/db/state");
const { join } = require("path");
const { writeFile, readdir, unlink } = require("fs").promises;

const writeOverlayCSS = async (css, filename = `overlay.${Date.now()}.css`) => {
  const dest = join(__dirname, "public", filename);
  await writeFile(dest, css);
  return filename;
};

const deleteOldOverlays = async (keepFile) => {
  const publicDir = join(__dirname, "public");
  const files = await readdir(publicDir);
  for (const file of files) {
    if (/^overlay\.\d+\.css$/.test(file) && file !== keepFile)
      await unlink(join(publicDir, file));
  }
};

const SYSTEM_PROMPT = `You are an expert CSS theme designer for Bootstrap 5.3.
Your task is to generate a complete CSS overlay file that reskins a standard Bootstrap 5.3 app.

APPROACH:
1. Define theme-specific custom properties in :root (colors, fonts, shadows, etc.)
2. Override Bootstrap 5.3 CSS variables in :root using --bs-* tokens for light mode
3. Add component-level CSS rules for deeper customisation (navbar, cards, buttons, forms, tables, alerts, badges, modals, pagination, tabs, accordions, etc.)
4. Add a dark mode section scoped to [data-bs-theme="dark"] that overrides :root custom properties and --bs-* tokens for dark mode. Component-level rules that depend only on CSS variables will automatically adapt — only add extra component rules under [data-bs-theme="dark"] where variables alone are not sufficient.

BOOTSTRAP 5.3 CSS VARIABLES to consider overriding in :root and [data-bs-theme="dark"]:
--bs-body-bg, --bs-body-color, --bs-secondary-bg, --bs-tertiary-bg,
--bs-border-color, --bs-primary, --bs-link-color, --bs-link-hover-color,
--bs-card-bg, --bs-card-border-color, --bs-card-cap-bg,
--bs-dropdown-bg, --bs-dropdown-border-color, --bs-dropdown-link-color,
--bs-dropdown-link-hover-bg, --bs-dropdown-link-active-bg,
--bs-table-color, --bs-table-bg, --bs-table-border-color, --bs-table-hover-bg,
--bs-modal-bg, --bs-modal-border-color,
--bs-tooltip-bg, --bs-tooltip-color,
--bs-body-font-family, --bs-body-font-size

COMPONENTS to style: body, navbar (.navbar, .navbar-brand, .nav-link), cards (.card, .card-header, .card-footer, .card-title), buttons (.btn, .btn-primary, .btn-secondary, .btn-danger, .btn-success), forms (.form-control, .form-select, .form-label, .form-check-input), tables (.table, .table th, .table td), alerts (.alert-*), badges (.badge), modals (.modal-content, .modal-header), pagination (.page-link), tabs (.nav-tabs), links (a), headings (h1-h6), code/pre, hr, scrollbar.

DARK MODE STRUCTURE:
:root { /* light mode theme variables and --bs-* overrides */ }
/* component rules */
[data-bs-theme="dark"] { /* dark mode theme variables and --bs-* overrides */ }
/* any extra component rules needed only in dark mode, prefixed with [data-bs-theme="dark"] */

CRITICAL RULES — never break these:
- Never set overflow:hidden on .navbar, .navbar-collapse, or any nav container — this clips dropdown menus
- Never set a z-index lower than 1000 on .navbar or its children — dropdowns must appear above page content
- Never create a new stacking context (transform, filter, will-change, isolation) on .navbar or its direct parents — this traps dropdowns inside it
- Do not override --bs-zindex-dropdown or .dropdown-menu z-index
- Navbar dropdowns must always be fully visible and appear above all other page content

OUTPUT: Only valid CSS. No explanations. No markdown. No code fences. Start directly with /* theme comment */ or :root {`;

const generateThemeCSS = async (prompt) => {
  const state = getState();
  if (!state.functions?.llm_generate) {
    console.log(
      "bootstrap-prompt-theme: llm_generate not available, is large-language-model installed?"
    );
    return null;
  }
  console.log("bootstrap-prompt-theme: generating theme from prompt...");
  const result = await state.functions.llm_generate.run(prompt, {
    systemPrompt: SYSTEM_PROMPT,
  });
  console.log("bootstrap-prompt-theme: LLM result:", result);
  return result || null;
};
 
module.exports = { generateThemeCSS, writeOverlayCSS, deleteOldOverlays };
