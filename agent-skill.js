const Plugin = require("@saltcorn/data/models/plugin");
const { pre, code, div } = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const { writeFile, readdir, unlink } = require("fs").promises;
const { join } = require("path");

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
- Always pair background and foreground colors: whenever you set a background color on any element — form controls (.form-control, .form-select), dropdowns (.dropdown-menu, .dropdown-item), navbar (.navbar, .nav-link), cards, or any container — you must also explicitly set a readable text/foreground color on that element and its direct text children. Bootstrap does not reliably propagate text color into all components, especially in dark mode. Common failure cases: dark .dropdown-menu background with light-mode .dropdown-item text color (text disappears); dark .form-control background with inherited body text color (typed text invisible); dark navbar with unset .nav-link color. Always set both background and text color together. When in doubt, also set the matching --bs-* token pair (e.g. --bs-dropdown-bg with --bs-dropdown-link-color, --bs-body-bg with --bs-body-color).

IMAGES: The user may attach images to the conversation. Use them as design inspiration — extract colors, typography style, spacing feel, or overall mood and translate that into the CSS overlay. If the user attaches an image without further instruction, derive a theme from it. If they describe what they want alongside the image, use the image to inform the details.

LAYOUT CONFIG: Besides CSS, you can control structural layout options via set_layout_config:
- mode: "light" | "dark" — Bootstrap color mode applied to <html data-bs-theme>. IMPORTANT: whenever the user asks for a dark theme or dark mode, you MUST call set_layout_config with mode: "dark". Do not only adjust CSS colors — without mode: "dark" Bootstrap's own dark-mode component styles will not activate and the result will look wrong.
- menu_style: "Top Navbar" | "Side Navbar" | "No Menu"
- colorscheme: navbar color class pair, e.g. "navbar-dark bg-dark", "navbar-light bg-light", "navbar-dark bg-primary"
- fixed_top: true | false — fix navbar to top of viewport
- fluid: true | false — full-width container vs fixed-width
- top_pad: 0–5 — Bootstrap spacing scale for top padding on page sections
- in_card: true | false — wrap page body in a Bootstrap card
Only call set_layout_config when you want to change structural layout, separate from CSS. Call both tools when a request requires both structural and CSS changes.
When you change menu_style, the tool response will include a page_structure field with rendered HTML of the new layout. Read it to understand the actual element hierarchy and CSS selectors before writing any CSS for that layout.

{{PAGE_STRUCTURE}}

WORKFLOW:
1. Call apply_css_overlay with the complete CSS — this is the only way to deliver CSS.
2. Optionally call set_layout_config for structural layout changes.
3. After apply_css_overlay completes, the tool result JSON may contain a "screenshot" field — a base64-encoded PNG of the live page captured after the CSS was applied. Screenshots are only available when a reference page has been configured (via the "route" parameter) and the environment supports it; if the field is absent or null, skip to step 4 immediately. To read the image, interpret the "screenshot" value as a base64 PNG: decode it visually and assess the rendered page. The "route" parameter only needs to be passed the first time or when the user changes the reference page — the value is stored and reused automatically.
4. If a screenshot is present, review it: check that colors, fonts, spacing, and contrast match the intended design. If there is a clear problem, call apply_css_overlay with a targeted correction and review the next screenshot. Repeat only while there are clear remaining issues — stop as soon as the result looks good or after at most 3 correction passes, whichever comes first.
5. Once done, reply with one short sentence confirming what changed. Then report on the screenshot status — be specific, not generic:
   - If a screenshot was received and used for refinement: say which page was used and that visual feedback was applied.
   - If a route was configured but the screenshot field was absent or null: say that the screenshot for that page failed or returned no data.
   - If no route was configured at all: add a short note that the user can specify a page name via the "route" parameter in their next request to enable visual feedback.
   Never include CSS in your text reply.`;

const capturePageScreenshot = async (req) => {
  const plugin = await findPlugin();
  const pageName = plugin?.configuration?.screenshot_page;
  if (!pageName) return null;
  const action = getState().actions?.page_to_pdf;
  if (!action) {
    getState().log(
      5,
      "bootstrap-prompt-theme: page_to_pdf action not available, skipping screenshot"
    );
    return null;
  }
  try {
    const base =
      req?.protocol && req?.get?.("host")
        ? `${req.protocol}://${req.get("host")}`
        : getState().getConfig("base_url", "").replace(/\/$/, "");
    const result = await action.run({
      req,
      referrer: base + "/",
      configuration: {
        entity_type: "URL",
        url: `${base}/page/${pageName}`,
        format: "PNG",
      },
    });
    return result?.download?.blob || null;
  } catch (e) {
    getState().log(
      4,
      `bootstrap-prompt-theme: screenshot failed: ${e.message}`
    );
    return null;
  }
};

const findPlugin = async () => {
  return (
    (await Plugin.findOne({ name: "bootstrap-prompt-theme" })) ||
    (await Plugin.findOne({ name: "@saltcorn/bootstrap-prompt-theme" }))
  );
};

const savePluginConfig = async (plugin, patch) => {
  plugin.configuration = { ...(plugin.configuration || {}), ...patch };
  await plugin.upsert();
  getState().processSend({
    refresh_plugin_cfg: plugin.name,
    tenant: db.getTenantSchema(),
  });
};

const renderStructureSkeleton = (config) => {
  try {
    return require(join(__dirname, "index.js")).renderStructureSkeleton(config);
  } catch (e) {
    getState().log(
      4,
      `bootstrap-prompt-theme: renderStructureSkeleton failed: ${e.message}`
    );
    return null;
  }
};

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

  async systemPrompt() {
    const plugin = await findPlugin();
    const config = plugin?.configuration || {};
    let pageStructure =
      "PAGE STRUCTURE: (unavailable — could not render current layout)";
    try {
      const { renderPageSkeleton } = require(join(__dirname, "index.js"));
      const html = renderPageSkeleton(config);
      if (html)
        pageStructure =
          "PAGE STRUCTURE: The current page renders like this (with a sample list view, based on the active layout config). Use it to understand element hierarchy, class names, and selectors when writing CSS:\n```html\n" +
          html +
          "\n```";
    } catch (e) {
      getState().log(
        4,
        `bootstrap-prompt-theme: systemPrompt renderPageSkeleton failed: ${e.message}`
      );
    }
    return SYSTEM_PROMPT.replace("{{PAGE_STRUCTURE}}", pageStructure);
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
        process: async ({ css, route }, { req }) => {
          const filename = await writeOverlayCSS(css);
          const plugin = await findPlugin();
          if (plugin) {
            const patch = { overlay_css: css, overlay_file: filename };
            if (route) patch.screenshot_page = route;
            await savePluginConfig(plugin, patch);
            await deleteOldOverlays(filename);
          }
          const screenshot = await capturePageScreenshot(req);
          return { filename, screenshot };
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
              route: {
                type: "string",
                description:
                  "Saltcorn page name to use for visual feedback screenshots. Only pass this when the user has explicitly named a page. Do not guess or default to any page name. Once set, the value is remembered — only pass it again when the user specifies a different page.",
              },
            },
          },
        },
      },
      {
        type: "function",
        renderToolCall(params) {
          const entries = Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
          return pre(code(entries));
        },
        process: async (params) => {
          const allowed = [
            "mode",
            "menu_style",
            "colorscheme",
            "fixed_top",
            "fluid",
            "top_pad",
            "in_card",
          ];
          const patch = Object.fromEntries(
            Object.entries(params).filter(([k]) => allowed.includes(k))
          );
          const plugin = await findPlugin();
          if (plugin) {
            await savePluginConfig(plugin, patch);
          }
          const result = { success: true };
          if (params.menu_style) {
            const mergedConfig = { ...(plugin?.configuration || {}), ...patch };
            result.page_structure = renderStructureSkeleton(mergedConfig);
          }
          return result;
        },
        renderToolResponse: async ({ page_structure }) =>
          div(
            { class: "text-success" },
            "Layout configuration updated.",
            page_structure
              ? pre({ class: "mt-2 small" }, code(page_structure))
              : ""
          ),
        function: {
          name: "set_layout_config",
          description:
            "Set structural layout configuration for the Saltcorn UI. Only pass the parameters you want to change. When menu_style is set, the tool response includes a page_structure field containing rendered HTML of the new layout — use it to understand the correct selectors before writing CSS.",
          parameters: {
            type: "object",
            properties: {
              mode: {
                type: "string",
                enum: ["light", "dark"],
                description:
                  "Bootstrap color mode applied to <html data-bs-theme>",
              },
              menu_style: {
                type: "string",
                enum: ["Top Navbar", "Side Navbar", "No Menu"],
                description: "Navigation menu style",
              },
              colorscheme: {
                type: "string",
                description:
                  "Navbar color class pair, e.g. 'navbar-dark bg-dark', 'navbar-light bg-light', 'navbar-dark bg-primary'",
              },
              fixed_top: {
                type: "boolean",
                description: "Fix the navbar to the top of the viewport",
              },
              fluid: {
                type: "boolean",
                description:
                  "Use a full-width container instead of fixed-width",
              },
              top_pad: {
                type: "integer",
                minimum: 0,
                maximum: 5,
                description:
                  "Top padding for page sections (Bootstrap spacing scale 0–5)",
              },
              in_card: {
                type: "boolean",
                description: "Wrap page body content in a Bootstrap card",
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
