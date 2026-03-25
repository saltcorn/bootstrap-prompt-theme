const {
  div,
  text,
  p,
  footer,
  section,
  a,
  style,
  h1,
  ul,
  img,
  li,
  form,
  input,
  nav,
  button,
  i,
  hr,
} = require("@saltcorn/markup/tags");
const {
  navbar,
  navbarSolidOnScroll,
  mobileBottomNavBar,
  activeChecker,
} = require("@saltcorn/markup/layout_utils");
const renderLayout = require("@saltcorn/markup/layout");
const db = require("@saltcorn/data/db");
const Form = require("@saltcorn/data/models/form");
const Workflow = require("@saltcorn/data/models/workflow");
const Plugin = require("@saltcorn/data/models/plugin");
const WorkflowRun = require("@saltcorn/data/models/workflow_run");
const { renderForm, link } = require("@saltcorn/markup");
const {
  alert,
  headersInHead,
  headersInBody,
} = require("@saltcorn/markup/layout_utils");
const { features, getState } = require("@saltcorn/data/db/state");
const {
  GenerateBootstrapThemeSkill,
  writeOverlayCSS,
  deleteOldOverlays,
} = require("./agent-skill");

// Layout defaults — will be replaced by tool-generated config in a future version
const DEFAULT_IN_CARD = false;
const DEFAULT_MENU_STYLE = "Top Navbar";
const DEFAULT_COLORSCHEME = "navbar-light bg-light";
const DEFAULT_FIXED_TOP = false;
const DEFAULT_TOP_PAD = 2;
const DEFAULT_FLUID = false;
const DEFAULT_MODE = "light";

const resetThemeRoute = async (req, res) => {
  if (!req.user) return res.status(403).json({ error: "Not authenticated" });
  try {
    let plugin = await Plugin.findOne({ name: "bootstrap-prompt-theme" });
    if (!plugin)
      plugin = await Plugin.findOne({
        name: "@saltcorn/bootstrap-prompt-theme",
      });
    if (plugin) {
      await deleteOldOverlays(null);
      plugin.configuration = {
        ...(plugin.configuration || {}),
        overlay_css: null,
        overlay_file: null,
        chat_run_id: null,
      };
      await plugin.upsert();
      getState().processSend({
        refresh_plugin_cfg: plugin.name,
        tenant: db.getTenantSchema(),
      });
    }
    res.json({ success: "ok" });
  } catch (err) {
    getState().log(
      2,
      `bootstrap-prompt-theme reset-theme error: ${err.message}`
    );
    res.json({ error: err.message });
  }
};

const chatRoute = async (req, res) => {
  if (!req.user) return res.status(403).json({ error: "Not authenticated" });
  try {
    const { userinput, run_id } = req.body;
    if (!userinput?.trim())
      return res.json({
        success: "ok",
        response: "",
        run_id: run_id || undefined,
      });

    let agentsLocation =
      getState().plugin_locations?.agents ||
      getState().plugin_locations?.["@saltcorn/agents"];
    if (!agentsLocation)
      return res.json({ error: "Agents plugin not available" });
    const { join } = require("path");
    const { process_interaction, addToContext, wrapSegment } = require(join(
      agentsLocation,
      "common.js"
    ));

    const agentConfig = {
      skills: [{ skill_type: "Generate Bootstrap Theme" }],
      sys_prompt: "",
    };

    let run;
    if (!run_id || run_id === "undefined" || run_id === "") {
      run = await WorkflowRun.create({
        status: "Running",
        started_by: req.user?.id,
        context: {
          interactions: [],
          html_interactions: [],
          funcalls: {},
        },
      });
      let plugin = await Plugin.findOne({ name: "bootstrap-prompt-theme" });
      if (!plugin)
        plugin = await Plugin.findOne({
          name: "@saltcorn/bootstrap-prompt-theme",
        });
      if (plugin) {
        plugin.configuration = {
          ...(plugin.configuration || {}),
          chat_run_id: run.id,
        };
        await plugin.upsert();
      }
    } else {
      run = await WorkflowRun.findOne({ id: +run_id });
    }

    const userMsg = wrapSegment(`<p>${userinput}</p>`, "You", true);
    await addToContext(run, {
      interactions: [
        ...(run.context.interactions || []),
        { role: "user", content: userinput },
      ],
      html_interactions: [userMsg],
    });

    const result = await process_interaction(
      run,
      agentConfig,
      req,
      "Theme Assistant",
      []
    );
    res.json(result?.json || { success: "ok", response: "", run_id: run.id });
  } catch (err) {
    getState().log(2, `bootstrap-prompt-theme chat error: ${err.message}`);
    res.json({ error: err.message });
  }
};

const isNode = typeof window === "undefined";
let hasCapacitor = false;
try {
  hasCapacitor =
    require("@saltcorn/plugins-loader/stable_versioning").isEngineSatisfied(
      ">=1.1.0-beta.11"
    );
} catch {
  getState().log(5, "stable_versioning not available, assuming no Capacitor");
}

const _activeChecker = activeChecker
  ? activeChecker
  : (link, currentUrl) => new RegExp(`^${link}(\\/|\\?|#|$)`).test(currentUrl);

const blockDispatch = (config) => ({
  pageHeader: ({ title, blurb }) =>
    div(
      h1({ class: "h3 mb-0 mt-2 text-gray-800" }, title),
      blurb && p({ class: "mb-0 text-gray-800" }, blurb)
    ),
  footer: ({ contents }) =>
    div(
      { class: "container" },
      footer(
        { id: "footer" },
        div({ class: "row" }, div({ class: "col-sm-12" }, contents))
      )
    ),
  hero: ({ caption, blurb, cta, backgroundImage }) =>
    section(
      {
        class:
          "jumbotron text-center m-0 bg-info d-flex flex-column justify-content-center",
      },
      div(
        { class: "container" },
        h1({ class: "jumbotron-heading" }, caption),
        p({ class: "lead" }, blurb),
        cta
      ),
      backgroundImage &&
        style(`.jumbotron {
      background-image: url("${backgroundImage}");
      background-size: cover;
      min-height: 75vh !important;
    }`)
    ),
  noBackgroundAtTop: () => true,
  wrapTop: (segment, ix, s) =>
    ["hero", "footer"].includes(segment.type) || segment.noWrapTop
      ? s
      : section(
          {
            class: [
              "page-section",
              ix === 0 && `pt-${DEFAULT_TOP_PAD}`,
              ix === 0 && DEFAULT_FIXED_TOP && isNode && "mt-5",
              ix === 0 && DEFAULT_FIXED_TOP && !isNode && "mt-6",
              segment.class,
              segment.invertColor && "bg-primary",
            ],
            style: `${
              segment.bgType === "Color"
                ? `background-color: ${segment.bgColor};`
                : ""
            }`,
          },
          div(
            { class: [DEFAULT_FLUID ? "container-fluid" : "container"] },
            segment.textStyle && segment.textStyle === "h1" ? h1(s) : s
          )
        ),
});

const buildHints = (config = {}) => ({
  cardTitleClass: "m-0 fw-bold d-inline",
});

const renderBody = (title, body, alerts, config, role, req) =>
  renderLayout({
    blockDispatch: blockDispatch(config),
    role,
    req,
    layout:
      typeof body === "string" && DEFAULT_IN_CARD
        ? { type: "card", title, contents: body }
        : body,
    alerts,
    hints: buildHints(config),
  });

const safeSlash = () => (isNode ? "/" : "");

const linkPrefix = () =>
  isNode ? "/plugins" : hasCapacitor ? "sc_plugins" : "plugins";

const base_public_serve = `${linkPrefix()}/public/bootstrap-prompt-theme${
  features?.version_plugin_serve_path
    ? "@" + require("./package.json").version
    : ""
}`;

const wrapIt = (config, bodyAttr, headers, title, body) => {
  return `<!doctype html>
<html lang="en" data-bs-theme="${DEFAULT_MODE}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <link href="${base_public_serve}/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="${base_public_serve}/sidebar-3.css" />
    <link rel="stylesheet" href="${base_public_serve}/${
    config.overlay_file || "overlay.css"
  }" />
    ${headersInHead(headers, config?.mode === "dark")}
    <title>${text(title)}</title>
  </head>
  <body ${bodyAttr}>
    ${body}
    ${
      features && features.deep_public_plugin_serve
        ? `<link rel="stylesheet" href="${base_public_serve}/fontawesome/fontawesome.min.css" />`
        : '<script defer src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/js/all.min.js" integrity="sha512-F5QTlBqZlvuBEs9LQPqc1iZv2UMxcVXezbHzomzS6Df4MZMClge/8+gXrKw2fl5ysdk4rWjR0vKS7NNkfymaBQ==" crossorigin="anonymous"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/fontawesome.min.css" integrity="sha512-kJ30H6g4NGhWopgdseRb8wTsyllFUYIx3hiUwmGAkgA9B/JbzUBDQVr2VVlWGde6sdBVOG7oU8AL35ORDuMm8g==" crossorigin="anonymous" />'
    }
    <script src="${safeSlash()}static_assets/${
    db.connectObj.version_tag
  }/jquery-3.6.0.min.js"></script>
    <script src="${base_public_serve}/bootstrap.bundle.min.js"></script>
    ${headersInBody(headers)}
    ${DEFAULT_COLORSCHEME === "navbar-light" ? navbarSolidOnScroll : ""}
  </body>
</html>`;
};

const active = (currentUrl, item, originalUrl) =>
  (item.link &&
    (_activeChecker(item.link, currentUrl) ||
      (originalUrl && _activeChecker(item.link, originalUrl)))) ||
  (item.altlinks &&
    item.altlinks.some(
      (l) =>
        _activeChecker(l, currentUrl) ||
        (originalUrl && _activeChecker(l, originalUrl))
    )) ||
  (item.subitems &&
    item.subitems.some(
      (si) =>
        si.link &&
        (_activeChecker(si.link, currentUrl) ||
          (originalUrl && _activeChecker(si.link, originalUrl)) ||
          (si.altlinks &&
            si.altlinks.some((l) => _activeChecker(l, currentUrl))))
    ));

const verticalMenu = ({ menu, currentUrl, originalUrl, brand }) => {
  const brandLogo = a(
    { class: "navbar-brand mt-1 ms-3 mb-2", href: "/" },
    brand.logo &&
      img({
        src: brand.logo,
        width: "30",
        height: "30",
        class: "me-2 d-inline-block align-top",
        alt: "Logo",
        loading: "lazy",
      }),
    brand.name
  );
  const vertNavSubItemsIterator = (subitem) =>
    subitem.type === "Separator"
      ? hr({ class: "mx-4 my-0" })
      : subitem?.subitems
      ? li(
          { class: ["nav-item"] },
          div(
            { class: "dropdown-item btn-group dropend" },
            a(
              {
                type: "button",
                class: "nav-link sublink dropdown-item dropdown-toggle",
                "data-bs-toggle": "dropdown",
                "aria-expanded": "false",
              },
              subitem.label
            ),
            ul(
              { class: "dropdown-menu" },
              subitem?.subitems.map((si1) => li(vertNavSubItemsIterator(si1)))
            )
          )
        )
      : li(
          {
            class: [
              "nav-item",
              active(currentUrl, subitem, originalUrl) && "active",
            ],
          },
          a(
            {
              class: "nav-link sublink",
              href: subitem.link,
              target: subitem.target_blank ? "_blank" : undefined,
            },
            subitem.icon ? i({ class: `fa-fw me-1 ${subitem.icon}` }) : "",
            subitem.label
          )
        );

  let items = [];
  menu.forEach((m, ix) => {
    if (m.items && m.items.length > 0) {
      m.items.forEach((item, ix1) => {
        if (item.location === "Mobile Bottom") return;
        if (item.subitems) {
          items.push(
            li(
              {
                class: [
                  "nav-item",
                  active(currentUrl, item, originalUrl) && "active",
                ],
              },
              a(
                {
                  href: `#menuCollapse${ix}_${ix1}`,
                  "aria-expanded": false,
                  class: "dropdown-toggle nav-link",
                  ...(features && features.bootstrap5
                    ? { "data-bs-toggle": "collapse" }
                    : { "data-toggle": "collapse" }),
                },
                item.icon ? i({ class: `fa-fw me-1 ${item.icon}` }) : "",
                item.label
              ),
              ul(
                {
                  class: [
                    active(currentUrl, item, originalUrl)
                      ? "collapse.show"
                      : "collapse",
                    "list-unstyled",
                  ],
                  id: `menuCollapse${ix}_${ix1}`,
                },
                item.subitems.map(vertNavSubItemsIterator)
              )
            )
          );
        } else if (item.link)
          items.push(
            li(
              {
                class: [
                  "nav-item",
                  active(currentUrl, item, originalUrl) && "active",
                ],
              },
              a(
                {
                  class: "nav-link",
                  href: item.link,
                  target: item.target_blank ? "_blank" : undefined,
                },
                item.icon ? i({ class: `fa-fw me-1 ${item.icon}` }) : "",
                item.label
              )
            )
          );
        else if (item.type === "Separator")
          items.push(hr({ class: "mx-4 my-0" }));
        else if (item.type === "Search")
          items.push(
            li(
              form(
                { action: "/search", class: "menusearch", method: "get" },
                div(
                  { class: "input-group search-bar" },
                  input({
                    type: "search",
                    class: "form-control search-bar ps-2 hasbl",
                    placeholder: item.label,
                    id: "inputq",
                    name: "q",
                    "aria-label": "Search",
                    "aria-describedby": "button-search-submit",
                  }),
                  button(
                    {
                      class: "btn btn-outline-secondary search-bar",
                      type: "submit",
                    },
                    i({ class: "fas fa-search" })
                  )
                )
              )
            )
          );
      });
    }
  });
  const toggler =
    hr({ class: "mx-4 my-0" }) +
    div(
      { class: "text-center" },
      button({
        class: "rounded-circle border-0",
        id: "sidebarToggle",
        "data-sidebar-toggler": true,
        onclick: "$('#wrapper').toggleClass('narrowed')",
      })
    );
  return (
    brandLogo +
    ul({ class: "navbar-nav list-unstyled components" }, items) +
    toggler
  );
};

const authBrand = (config, { name, logo }) =>
  logo
    ? `<img class="mb-4" src="${logo}" alt="Logo" width="72" height="72">`
    : "";

const menuWrap = ({
  brand,
  menu,
  config,
  currentUrl,
  originalUrl,
  body,
  req,
}) => {
  const colschm = DEFAULT_COLORSCHEME.split(" ");
  const navbarCol = colschm[0];
  const bg = colschm[1];
  const txt = (colschm[0] || "").includes("dark") ? "text-light" : "";

  const mobileNav = mobileBottomNavBar
    ? mobileBottomNavBar(currentUrl, menu, bg, txt)
    : "";
  const role = !req ? 1 : req.user ? req.user.role_id : 100;
  if ((DEFAULT_MENU_STYLE === "No Menu" && role > 1) || (!menu && !brand))
    return div({ id: "wrapper" }, div({ id: "page-inner-content" }, body));
  else if (DEFAULT_MENU_STYLE === "Side Navbar" && isNode) {
    return (
      navbar(brand, menu, currentUrl, {
        class: "d-md-none",
        colorscheme: DEFAULT_COLORSCHEME,
        fixedTop: DEFAULT_FIXED_TOP,
      }) +
      div(
        { id: "wrapper", class: "d-flex with-sidebar" },
        nav(
          {
            class: [
              "d-none d-md-flex flex-column align-center d-print-none",
              navbarCol,
              bg,
              txt,
            ],
            id: "sidebar",
          },
          verticalMenu({ brand, menu, currentUrl, originalUrl })
        ),
        div(
          { id: "content-wrapper", class: "d-flex flex-column" },
          div({ id: "content" }, div({ id: "page-inner-content" }, body))
        )
      ) +
      mobileNav
    );
  } else
    return (
      div(
        { id: "wrapper" },
        navbar(brand, menu, currentUrl, {
          colorscheme: DEFAULT_COLORSCHEME,
          fixedTop: DEFAULT_FIXED_TOP,
        }),
        div({ id: "page-inner-content" }, body)
      ) + mobileNav
    );
};

const layout = (config) => ({
  hints: buildHints(config),
  renderBody: ({ title, body, alerts, role, req }) =>
    renderBody(title, body, alerts, config, role, req),
  wrap: ({
    title,
    menu,
    brand,
    alerts,
    currentUrl,
    originalUrl,
    body,
    headers,
    role,
    req,
    bodyClass,
    requestFluidLayout,
  }) =>
    wrapIt(
      config,
      `id="page-top" class="${bodyClass || ""}"`,
      headers,
      title,
      menuWrap({
        brand,
        menu,
        config,
        currentUrl,
        originalUrl,
        body: renderBody(
          title,
          body,
          alerts,
          requestFluidLayout ? { fluid: true } : {},
          role,
          req
        ),
        req,
      })
    ),
  authWrap: ({
    title,
    alerts,
    form,
    afterForm,
    headers,
    brand,
    csrfToken,
    authLinks,
    bodyClass,
    req,
  }) =>
    wrapIt(
      config,
      `class="text-center ${bodyClass || ""}"`,
      headers,
      title,
      `
  <div class="form-signin">
    ${alerts.map((a) => alert(a.type, a.msg)).join("")}
    ${authBrand(config, brand)}
    <h3>${title}</h3>
    ${renderForm(formModify(form), csrfToken)}
    ${renderAuthLinks(authLinks, req)}
    ${afterForm}
    <style>
html, body { min-height: 100%; }
body {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 40px;
  padding-bottom: 40px;
  background-color: #f5f5f5;
}
.form-signin {
  width: 100%;
  max-width: 330px;
  padding: 15px;
  margin: 0 auto;
}
.form-signin .form-control {
  position: relative;
  box-sizing: border-box;
  height: auto;
  padding: 10px;
  font-size: 16px;
}
.form-signin .form-control:focus { z-index: 2; }
.form-signin input[type="email"] {
  margin-bottom: -1px;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}
.form-signin input[type="password"] {
  margin-bottom: 10px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
    </style>
  </div>
  `
    ),
});

const renderAuthLinks = (authLinks, req) => {
  var links = [];
  const __ = req?.__ || ((s) => s);
  if (authLinks.login)
    links.push(link(authLinks.login, __("Already have an account? Login!")));
  if (authLinks.forgot)
    links.push(link(authLinks.forgot, __("Forgot password?")));
  if (authLinks.signup)
    links.push(link(authLinks.signup, __("Create an account!")));
  const meth_links = (authLinks.methods || [])
    .map(({ url, icon, label }) =>
      a(
        { href: url, class: "btn btn-secondary btn-user btn-block" },
        icon || "",
        `&nbsp;Login with ${label}`
      )
    )
    .join("");
  return (
    meth_links + links.map((l) => div({ class: "text-center" }, l)).join("")
  );
};

const formModify = (form) => {
  form.formStyle = "vert";
  form.submitButtonClass = "btn-primary btn-user btn-block";
  return form;
};

const configuration_workflow = () =>
  new Workflow({
    onDone: async (context) => {
      return {
        context,
        cleanup: async () => {
          if (context.overlay_file)
            await deleteOldOverlays(context.overlay_file);
        },
      };
    },
    steps: [
      {
        name: "Theme",
        form: async (ctx) => {
          let chatRunId = "";
          let existingInteractions = "";
          let plugin = await Plugin.findOne({ name: "bootstrap-prompt-theme" });
          if (!plugin)
            plugin = await Plugin.findOne({
              name: "@saltcorn/bootstrap-prompt-theme",
            });
          if (plugin?.configuration?.chat_run_id) {
            const run = await WorkflowRun.findOne({
              id: plugin.configuration.chat_run_id,
            });
            if (run?.context?.html_interactions?.length) {
              chatRunId = String(run.id);
              existingInteractions = run.context.html_interactions.join("");
            }
          }
          return new Form({
            additionalHeaders: [
              {
                headerTag: `<script>
async function bptResetTheme() {
  if (!confirm('Reset theme? This will remove the current CSS overlay and conversation.')) return;
  await fetch('/bootstrap-prompt-theme/reset-theme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CSRF-Token': _sc_globalCsrf },
  });
  document.getElementById('bpt-interactions').innerHTML = '';
  document.getElementById('bpt-run-id').value = '';
}
async function bptSend() {
  const input = document.getElementById('bpt-input');
  const interactions = document.getElementById('bpt-interactions');
  const runIdInput = document.getElementById('bpt-run-id');
  const sendBtn = document.getElementById('bpt-send-btn');
  const sendIcon = document.getElementById('bpt-send-icon');
  const msg = input.value.trim();
  if (!msg || sendBtn.disabled) return;
  interactions.innerHTML += '<div class="interaction-segment to-right"><div><div class="badgewrap"><span class="badge bg-secondary">You</span></div><p>' + msg.replace(/</g, '&lt;') + '</p></div></div>';
  interactions.scrollTop = interactions.scrollHeight;
  input.value = '';
  sendBtn.disabled = true;
  sendIcon.className = 'fas fa-spinner fa-spin';
  try {
    const resp = await fetch('/bootstrap-prompt-theme/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': _sc_globalCsrf },
      body: JSON.stringify({ userinput: msg, run_id: runIdInput.value })
    });
    const data = await resp.json();
    if (data.run_id) runIdInput.value = data.run_id;
    if (data.response) { interactions.innerHTML += data.response; interactions.scrollTop = interactions.scrollHeight; }
    if (data.error) interactions.innerHTML += '<div class="alert alert-danger mt-2">' + data.error + '</div>';
  } catch (e) {
    interactions.innerHTML += '<div class="alert alert-danger mt-2">Error: ' + e.message + '</div>';
  }
  sendBtn.disabled = false;
  sendIcon.className = 'far fa-paper-plane';
}
document.addEventListener('DOMContentLoaded', () => {
  const el = document.createElement('div');
  el.innerHTML = [
    '<div class="card mb-4">',
    '  <div class="card-header fw-bold"><i class="fas fa-robot me-2"></i>AI Theme Chat</div>',
    '  <div class="card-body">',
    '    <p class="text-muted small mb-2">Chat with the AI to build your Bootstrap theme. New themes are visible after page reload or when you click Finish.</p>',
    '    <div id="bpt-interactions" style="min-height:80px;max-height:320px;overflow-y:auto;border:1px solid var(--bs-border-color,#dee2e6);padding:10px;margin-bottom:10px;border-radius:4px;background:var(--bs-body-bg,#fff);"></div>',
    '    <div class="d-flex gap-2 align-items-end">',
    '      <textarea id="bpt-input" class="form-control" rows="2" placeholder="Describe the theme changes you want..."></textarea>',
    '      <button type="button" id="bpt-send-btn" class="btn btn-primary" onclick="bptSend()">',
    '        <i id="bpt-send-icon" class="far fa-paper-plane"></i>',
    '      </button>',
    '    </div>',
    '    <input type="hidden" id="bpt-run-id" value="">',
    '  </div>',
    '</div>',
  ].join('');
  const form = document.querySelector('form.form-namespace');
  if (form) form.parentNode.insertBefore(el, form);
  document.getElementById('bpt-run-id').value = ${JSON.stringify(chatRunId)};
  const interactionsEl = document.getElementById('bpt-interactions');
  interactionsEl.innerHTML = ${JSON.stringify(existingInteractions)};
  interactionsEl.scrollTop = interactionsEl.scrollHeight;
  const inp = document.getElementById('bpt-input');
  inp?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); bptSend(); }
  });
  const submitBtn = form?.querySelector('[type="submit"]');
  const origSubmitHTML = submitBtn ? submitBtn.innerHTML : null;
  if (form) form.addEventListener('submit', (e) => {
    const draft = document.getElementById('bpt-input')?.value?.trim();
    if (draft && !confirm('You have an unsent message. Finish without sending it?')) {
      e.preventDefault();
      if (submitBtn && origSubmitHTML !== null) {
        setTimeout(() => {
          submitBtn.innerHTML = origSubmitHTML;
          submitBtn.disabled = false;
          submitBtn.removeAttribute('disabled');
        }, 100);
      }
    }
  });
});
</script>`,
              },
            ],
            additionalButtons: [
              {
                label: "Reset theme",
                id: "bpt-reset-btn",
                class: "btn btn-outline-danger",
                onclick: "bptResetTheme()",
              },
            ],
            fields: [],
          });
        },
      },
    ],
  });

module.exports = {
  sc_plugin_api_version: 1,
  plugin_name: "bootstrap-prompt-theme",
  exchange: () => ({ agent_skills: [GenerateBootstrapThemeSkill] }),
  dependencies: ["@saltcorn/large-language-model"],
  routes: () => [
    {
      url: "/bootstrap-prompt-theme/chat",
      method: "post",
      callback: chatRoute,
    },
    {
      url: "/bootstrap-prompt-theme/reset-theme",
      method: "post",
      callback: resetThemeRoute,
    },
  ],
  layout,
  configuration_workflow,
  onLoad: async (configuration) => {
    if (!configuration?.overlay_css) {
      getState().log(
        5,
        "bootstrap-prompt-theme onLoad: no overlay_css in configuration"
      );
      return;
    }
    if (!configuration?.overlay_file) {
      getState().log(
        5,
        "bootstrap-prompt-theme onLoad: no overlay_file in configuration"
      );
      return;
    }
    try {
      const { access } = require("fs").promises;
      const { join } = require("path");
      const dest = join(__dirname, "public", configuration.overlay_file);
      try {
        await access(dest);
      } catch {
        await writeOverlayCSS(
          configuration.overlay_css,
          configuration.overlay_file
        );
      }
    } catch (error) {
      const msg = error.message || "Failed to write overlay CSS";
      getState().log(2, `bootstrap-prompt-theme onLoad failed: ${msg}`);
    }
  },
  ready_for_mobile: true,
};
