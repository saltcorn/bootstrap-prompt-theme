const Plugin = require("@saltcorn/data/models/plugin");
const { pre, code, div } = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
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
- Never set overflow:hidden or overflow:clip on ANY element — not on .navbar, .card, .card-body, .card-header, .card-footer, section, #wrapper, #page-inner-content, #content-wrapper, .container, .page-section, or any other element. Bootstrap's Popper.js positions dropdowns with position:absolute outside their parent bounds; overflow:hidden on any ancestor will clip them.
- Always set .navbar { position: relative; z-index: 1030; } to ensure navbar dropdowns render above all page content.
- Never apply transform, filter, backdrop-filter, will-change, or perspective to .card, .card-body, .card-header, .card-footer, .container, .page-section, section, #wrapper, or any page-level container. These CSS properties create a new stacking context that can rise above the navbar and obscure its open dropdowns.
- Never set z-index on .card or page content elements — stacking context on page content is what causes navbar dropdowns to be obscured.
- Do not override --bs-zindex-dropdown, --bs-zindex-fixed, or .dropdown-menu z-index.
- Dropdowns must always be fully visible and on top of all other page content, including cards, sections, and containers.

IMAGES: The user may attach images to the conversation. Use them as design inspiration — extract colors, typography style, spacing feel, or overall mood and translate that into the CSS overlay. If the user attaches an image without further instruction, derive a theme from it. If they describe what they want alongside the image, use the image to inform the details.

WORKFLOW:
1. Call apply_css_overlay with the complete CSS — this is the only way to deliver CSS.
2. After the tool call, reply with one short sentence confirming what changed (e.g. "Applied a red rounded theme."). Never include CSS in your text reply.`;

class GenerateBootstrapThemeSkill {
  static skill_name = "Generate Bootstrap Theme";

  get skill_label() {
    return "Bootstrap Theme";
  }

  constructor(cfg) {
    Object.assign(this, cfg);
  }

  static async configFields() {
    return [];
  }

  systemPrompt() {
    return SYSTEM_PROMPT;
  }

  provideTools() {
    return [
      {
        type: "function",
        renderToolCall({ css }) {
          return pre(
            code(css.slice(0, 300) + (css.length > 300 ? "\n..." : ""))
          );
        },
        process: async ({ css }) => {
          const filename = await writeOverlayCSS(css);
          let plugin = await Plugin.findOne({ name: "bootstrap-prompt-theme" });
          if (!plugin)
            plugin = await Plugin.findOne({
              name: "@saltcorn/bootstrap-prompt-theme",
            });
          if (plugin) {
            plugin.configuration = {
              ...(plugin.configuration || {}),
              overlay_css: css,
              overlay_file: filename,
            };
            await plugin.upsert();
            getState().processSend({
              refresh_plugin_cfg: plugin.name,
              tenant: db.getTenantSchema(),
            });
            await deleteOldOverlays(filename);
          }
          return { filename };
        },
        renderToolResponse: async ({ filename }) => {
          return div(
            { class: "text-success" },
            `CSS overlay applied: ${filename}`
          );
        },
        function: {
          name: "apply_css_overlay",
          description:
            "Apply a CSS overlay on top of Bootstrap 5.3 to restyle the Saltcorn UI. Call this only when you have CSS ready to apply — not for questions or clarifications.",
          parameters: {
            type: "object",
            required: ["css"],
            properties: {
              css: {
                type: "string",
                description:
                  "Complete valid CSS to write as the overlay. Must start with :root { or a comment. No markdown, no code fences.",
              },
            },
          },
        },
      },
    ];
  }
}

module.exports = {
  GenerateBootstrapThemeSkill,
  writeOverlayCSS,
  deleteOldOverlays,
};
