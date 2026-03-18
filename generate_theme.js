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
2. Override Bootstrap 5.3 CSS variables in :root using --bs-* tokens (these change Bootstrap component colors without recompiling Sass)
3. Add component-level CSS rules for deeper customisation (navbar, cards, buttons, forms, tables, alerts, badges, modals, pagination, tabs, accordions, etc.)

BOOTSTRAP 5.3 CSS VARIABLES to consider overriding in :root:
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
