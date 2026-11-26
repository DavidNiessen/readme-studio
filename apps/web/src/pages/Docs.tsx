import {
  ACTION_REF,
  CATEGORIES,
  DEFAULT_OUTPUT,
  DEFAULT_THEME,
  FONTS,
  PALETTE_KEYS,
  SCHEDULES,
  STUDIO_URL,
  deriveFromAccent,
  describeCron,
  familyName,
  fontFaceCss,
  loadFonts,
  mockData,
  normOptions,
  palettePresets,
  presetConfig,
  serializeConfig,
  widgetList,
  workflowYaml,
  type Field,
  type Palette,
  type WidgetDef,
} from "@readme-studio/core";
import { ArrowLeft, ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { REPO_URL, SitePage } from "../components/Site";
import { WidgetImage } from "../components/WidgetImage";
import { CodeBlock, ColorInput } from "../components/ui";
import { renderBlock, useFontsReady } from "../lib/render";
import { href, useRoute } from "../lib/router";

// ================================================================ navigation model

interface TocItem {
  id: string;
  label: string;
}

interface SectionDef {
  id: string;
  group: "Guide" | "Reference" | "Help";
  nav: string;
  title: string;
  lede: string;
  toc: TocItem[];
  Body: () => ReactNode;
}

const SectionCtx = createContext("");

function sectionHref(section: string, anchor?: string): string {
  return href(`/docs${section ? `/${section}` : ""}${anchor ? `?h=${anchor}` : ""}`);
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToId(id: string, smooth = true): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto", block: "start" });
  return true;
}

/** In-page jumps keep the hash route intact (`#/docs/action?h=inputs`) and never trigger a route change. */
function jump(e: MouseEvent, section: string, anchor: string): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  history.replaceState(null, "", sectionHref(section, anchor));
  scrollToId(anchor);
}

function DocLink({ to, anchor, children }: { to: string; anchor?: string; children: ReactNode }) {
  const current = useContext(SectionCtx);
  return (
    <a href={sectionHref(to, anchor)} onClick={anchor && to === current ? (e) => jump(e, to, anchor) : undefined}>
      {children}
    </a>
  );
}

function Ext({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a href={to} target="_blank" rel="noopener" className="ext">
      {children}
      <ArrowUpRight aria-hidden="true" />
    </a>
  );
}

function Heading({ id, level = 2, children }: { id: string; level?: 2 | 3; children: ReactNode }) {
  const section = useContext(SectionCtx);
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag id={id} className="docs-h" data-toc={level === 2 ? "" : undefined}>
      {children}
      <a className="docs-h__link" href={sectionHref(section, id)} onClick={(e) => jump(e, section, id)} aria-label="Link to this section">
        #
      </a>
    </Tag>
  );
}

// ================================================================ building blocks

function Table({ head, rows, className, caption }: { head: ReactNode[]; rows: ReactNode[][]; className?: string; caption?: string }) {
  return (
    <div className="dtable" role="region" aria-label={caption} tabIndex={0}>
      <table className={className}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ label = "Note", tone, children }: { label?: string; tone?: "warn"; children: ReactNode }) {
  return (
    <aside className={`d-note${tone ? ` d-note--${tone}` : ""}`}>
      <span className="d-note__label">{label}</span>
      <div>{children}</div>
    </aside>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="d-steps">{children}</ol>;
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="d-step">
      <h3 className="d-step__title">{title}</h3>
      <div className="d-step__body">{children}</div>
    </li>
  );
}

const SAMPLE = presetConfig("command-center");
const SAMPLE_WORKFLOW = workflowYaml(SAMPLE);
const SAMPLE_CONFIG = serializeConfig(SAMPLE);
const DEFAULT_SCHEDULE = describeCron(DEFAULT_OUTPUT.schedule);

// ================================================================ 1. getting started

function FlowDiagram() {
  const nodes: { k: string; title: string; sub: string; text: string }[] = [
    { k: "01", title: "Studio", sub: "your browser", text: "Pick widgets, a palette and a layout. Nothing is uploaded." },
    { k: "02", title: "Config", sub: "readme.config.json", text: "One JSON file in your repository describes the whole design." },
    { k: "03", title: "Action", sub: "GitHub Actions", text: "Fetches your latest numbers and renders every block." },
    { k: "04", title: "Assets", sub: `${DEFAULT_OUTPUT.branch} branch`, text: "Animated SVG and GIF files, one per block and colour scheme." },
    { k: "05", title: "README", sub: "your profile", text: "Plain <picture> tags that point at the files on that branch." },
  ];
  const edges = ["export", "on a schedule", "force-push", "raw URLs"];
  return (
    <figure className="d-flow">
      <ol className="d-flow__track">
        {nodes.map((n, i) => (
          <li key={n.k} className="d-flow__step">
            <div className="d-flow__node">
              <span className="d-flow__k">{n.k}</span>
              <strong className="d-flow__title">{n.title}</strong>
              <span className="d-flow__sub">
                {n.sub.split(".").map((part, j) => (
                  <span key={j}>
                    {j > 0 && "."}
                    {j > 0 && <wbr />}
                    {part}
                  </span>
                ))}
              </span>
              <span className="d-flow__text">{n.text}</span>
            </div>
            {i < edges.length && (
              <span className="d-flow__edge" aria-hidden="true">
                <span>{edges[i]}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      <figcaption>
        The studio only produces files. Everything after that runs in your own repository, on GitHub&rsquo;s infrastructure, with your own token.
      </figcaption>
    </figure>
  );
}

const PICTURE_SNIPPET = `<picture>
  <source media="(prefers-color-scheme: dark)"
          srcset="https://raw.githubusercontent.com/<login>/<login>/${DEFAULT_OUTPUT.branch}/hero-dark.svg">
  <source media="(prefers-color-scheme: light)"
          srcset="https://raw.githubusercontent.com/<login>/<login>/${DEFAULT_OUTPUT.branch}/hero-light.svg">
  <img alt="Mona Octocat: Software Engineer"
       src="https://raw.githubusercontent.com/<login>/<login>/${DEFAULT_OUTPUT.branch}/hero-dark.svg" width="100%">
</picture>`;

const PUSH_SNIPPET = `git clone https://github.com/<login>/<login>.git
cd <login>
# copy readme.config.json, README.md and .github/workflows/readme.yml here
git add readme.config.json README.md .github/workflows/readme.yml
git commit -m "feat: animated profile readme"
git push`;

function GettingStarted() {
  return (
    <>
      <p>
        Readme Studio turns your GitHub profile README into a set of animated, self-updating images. You design the layout in the studio, a GitHub Action in your own repository
        renders it with fresh data on a schedule, and GitHub serves the result. There is no server, no account and nothing to host.
      </p>

      <Heading id="how-it-works">How it works</Heading>
      <p>
        The design and the data are deliberately separate. The studio writes a config file; the action reads that config, fetches your current stats from GitHub and renders
        each block into a standalone SVG (or GIF). Those images live on a dedicated branch, and your README references them by URL. When the numbers change, only the images change.
      </p>
      <FlowDiagram />

      <Heading id="setup">Set up in four steps</Heading>
      <Steps>
        <Step title="Design it in the studio">
          <p>
            Start from a <a href={href("/presets")}>preset</a> or a blank canvas, add widgets, choose a palette and fonts, and fill in your profile. Every preview is rendered with the
            same code the action uses, so what you see is what ships. Your work is saved in this browser as you go.
          </p>
        </Step>
        <Step title="Export the project">
          <p>
            Click <strong>Export</strong> and download the zip. It contains your config, the workflow, a first README and a <code>SETUP.md</code> with these instructions filled in
            for your username.
          </p>
        </Step>
        <Step title="Push it to your profile repository">
          <p>
            GitHub shows the README of the public repository that has exactly your username as its name, <code>&lt;login&gt;/&lt;login&gt;</code>. Create it if it does not exist,
            then add the files, keeping the <code>.github/workflows</code> folder structure.
          </p>
          <CodeBlock code={PUSH_SNIPPET} />
        </Step>
        <Step title="Allow the workflow to push, then run it once">
          <p>
            In the repository, open <strong>Settings &rarr; Actions &rarr; General &rarr; Workflow permissions</strong> and select <strong>Read and write permissions</strong>. Then
            open the <strong>Actions</strong> tab, choose <strong>readme</strong> and click <strong>Run workflow</strong>. About a minute later your profile shows the animated README.
          </p>
        </Step>
      </Steps>

      <Heading id="files">What gets created</Heading>
      <p>The export adds three files to your default branch. The first run of the action creates the asset branch.</p>
      <Table
        caption="Files created by Readme Studio"
        className="t-files"
        head={["File", "Branch", "Purpose"]}
        rows={[
          [<code>readme.config.json</code>, <span className="d-tag">main</span>, "Your design: profile, theme, layout and widget options. Import it in the studio to keep editing."],
          [<code>.github/workflows/readme.yml</code>, <span className="d-tag">main</span>, `Runs the action ${DEFAULT_SCHEDULE}, on manual dispatch and whenever the config or workflow changes.`],
          [<code>README.md</code>, <span className="d-tag">main</span>, "The generated layout. It contains only <picture> and <img> tags (and any Markdown blocks), so it stays small and readable."],
          [<code>SETUP.md</code>, <span className="d-tag">zip only</span>, "Setup instructions for your account. Optional; you do not need to commit it."],
          [<code>&lt;id&gt;-dark.svg</code>, <span className="d-tag">{DEFAULT_OUTPUT.branch}</span>, "One image per block and colour scheme. The block id from the config is the file name, so links stay stable."],
          [<code>&lt;id&gt;-dark.gif</code>, <span className="d-tag">{DEFAULT_OUTPUT.branch}</span>, "Raster animations, for the few widgets that GitHub could not animate as SVG."],
          [<code>socials-1-github-dark.svg</code>, <span className="d-tag">{DEFAULT_OUTPUT.branch}</span>, "Widgets with several items, such as social links, emit one small image per item."],
          [<code>data.json</code>, <span className="d-tag">{DEFAULT_OUTPUT.branch}</span>, "The data snapshot the run used. Handy for debugging a surprising number."],
          [<code>preview.html</code>, <span className="d-tag">{DEFAULT_OUTPUT.branch}</span>, "Download and open locally to see the whole layout in both schemes."],
        ]}
      />

      <Heading id="branch">The asset branch and dark mode</Heading>
      <p>
        Rendered files are pushed to a separate branch, <code>{DEFAULT_OUTPUT.branch}</code> by default, as a single commit that replaces the previous one. Your default branch never
        collects a binary-heavy history, and the asset branch never grows: it always holds exactly one snapshot.
      </p>
      <p>
        Every block is rendered twice, once per colour scheme. The README wraps each pair in a <code>&lt;picture&gt;</code> element, so GitHub picks the variant that matches the
        viewer&rsquo;s theme. If you render only one scheme (see <DocLink to="config" anchor="output">output.modes</DocLink>), the <code>&lt;source&gt;</code> tags are omitted.
      </p>
      <CodeBlock code={PICTURE_SNIPPET} />

      <Heading id="updates">How often it updates</Heading>
      <p>
        The generated workflow runs {DEFAULT_SCHEDULE} by default, on every push that changes the config or the workflow, and whenever you start it by hand. You can choose a
        different schedule in the studio&rsquo;s export dialog or edit the cron line in the workflow yourself.
      </p>
      <Table
        caption="Schedule presets"
        head={["Preset", "Cron", "Runs"]}
        rows={SCHEDULES.map((s) => [s.label, <code>{s.value}</code>, describeCron(s.value)])}
      />
      <p>
        GitHub may start scheduled runs a few minutes late during busy periods, and images are cached by GitHub&rsquo;s image proxy for a few minutes. Widgets that show a clock or a
        greeting are rendered for the moment the workflow ran, so an hourly schedule keeps them close to real time.
      </p>

      <aside className="d-cta">
        <div>
          <h2 className="d-cta__title">Edit this design in the studio</h2>
          <p>Already have a config? Open the studio and use Import to pick up exactly where you left off.</p>
        </div>
        <div className="d-cta__actions">
          <a className="btn btn--accent btn--lg" href={href("/studio")}>
            Open studio <ArrowRight />
          </a>
          <a className="btn btn--lg" href={href("/presets")}>
            Browse presets
          </a>
        </div>
      </aside>
    </>
  );
}

// ================================================================ 2. action reference

const INPUTS: [string, string, ReactNode][] = [
  ["config", "readme.config.json", "Path to the config exported from the studio, relative to the repository root."],
  ["token", "${{ github.token }}", "Token used to push the assets and the README. It needs contents: write. Also used for data when no profile-token is given."],
  [
    "profile-token",
    '""',
    <>
      Optional personal access token used for data instead of <code>token</code>. Adds private contribution counts and exact totals. See <DocLink to="action" anchor="profile-token">PROFILE_TOKEN</DocLink>.
    </>,
  ],
  ["asset-branch", '""', <>Branch the rendered files are force-pushed to. Empty uses <code>output.branch</code> from the config.</>],
  ["commit-readme", "true", "Commit README.md when the generated layout differs from the file in the repository."],
  ["readme-path", "README.md", "Where to write the README inside the repository."],
  ["output-dir", '""', "Keep the rendered files in this directory, for example to upload them as an artifact. Defaults to a temporary folder."],
  ["mock", "false", "Use deterministic sample data instead of calling GitHub. Useful for testing a design or a fork."],
  ["dry-run", "false", "Render only and publish nothing. Pull request runs are always dry."],
];

const OUTPUTS: [string, string][] = [
  ["assets-dir", "Absolute path of the directory with the rendered files."],
  ["readme-changed", "true when README.md was updated and pushed, otherwise false."],
  ["data-source", "Where the data came from: graphql, rest, scrape or mock."],
];

const CLI_FLAGS: [string, string, string][] = [
  ["--config <path>", "all", "Config file. Default readme.config.json."],
  ["--out <dir>", "build", "Output directory. Default dist; it is emptied first."],
  ["--mock", "build", "Use deterministic sample data, no network."],
  ["--only=a,b", "build", "Render only these block ids, leaving other files in place."],
  ["--now=<ISO date>", "build", "Render as if it were this moment, for clocks and streaks."],
  ["--login <user>", "init", "GitHub login written into the starter config."],
  ["--preset <id>", "init", "Layout preset for the starter config. See the presets command."],
  ["--force", "init", "Overwrite an existing config."],
];

const CLI_SNIPPET = `git clone ${REPO_URL}.git
cd readme-studio && npm install

# render a config with real data (set PROFILE_TOKEN for GraphQL)
npx tsx packages/engine/src/cli.ts build --config ~/me/readme.config.json --out out

# or use the bundled build, no TypeScript toolchain needed
node packages/engine/dist/cli.mjs build --mock --out out
open out/preview.html`;

const PR_SNIPPET = `on:
  pull_request:
    paths: [readme.config.json]`;

function ActionReference() {
  return (
    <>
      <p>
        The action lives in the Readme Studio repository and is referenced as <code>{ACTION_REF}</code>. It runs on Node 24 with no Docker image, so a typical run takes well under a
        minute.
      </p>

      <Heading id="usage">Usage</Heading>
      <p>
        This is the workflow the studio exports. Apart from the cron line and the asset branch it is the same for everyone, so you can also write it by hand. Save it as{" "}
        <code>.github/workflows/readme.yml</code>.
      </p>
      <CodeBlock code={SAMPLE_WORKFLOW} maxHeight={560} />
      <p>
        The <code>push</code> trigger re-renders as soon as you commit a new config, and <code>concurrency</code> cancels a run that is superseded by a newer one.
      </p>

      <Heading id="inputs">Inputs</Heading>
      <p>All inputs are optional.</p>
      <Table caption="Action inputs" className="t-ref" head={["Input", "Default", "Description"]} rows={INPUTS.map(([n, d, t]) => [<code>{n}</code>, <code className="dim">{d}</code>, t])} />

      <Heading id="outputs">Outputs</Heading>
      <Table caption="Action outputs" className="t-ref" head={["Output", "Description"]} rows={OUTPUTS.map(([n, t]) => [<code>{n}</code>, t])} />

      <Heading id="publishing">What a run does</Heading>
      <ol className="d-list">
        <li>Reads and normalises the config. Problems are reported as warnings annotated on the config file; the run continues with repaired values.</li>
        <li>Fetches only the data the visible widgets need, for example weather only when a widget shows it.</li>
        <li>Renders every block for every colour scheme, plus README.md, data.json and preview.html.</li>
        <li>
          Force-pushes the files to the asset branch as one orphan commit by <code>github-actions[bot]</code>.
        </li>
        <li>
          Commits README.md only if it changed, with the message <code>chore(readme): update generated layout [skip ci]</code>. Changing a number never touches your default branch;
          changing the layout does.
        </li>
      </ol>

      <Heading id="permissions">Permissions</Heading>
      <p>
        The workflow declares <code>permissions: contents: write</code>, which is all it needs. GitHub also has a repository-wide switch that caps what any workflow may do: under{" "}
        <strong>Settings &rarr; Actions &rarr; General &rarr; Workflow permissions</strong>, choose <strong>Read and write permissions</strong>. Without it the push fails with a 403. For
        repositories owned by an organisation, the organisation&rsquo;s Actions policy has to allow it too.
      </p>

      <Heading id="pull-requests">Pull requests</Heading>
      <p>
        On <code>pull_request</code> events the action always runs dry: it renders everything, writes the job summary and fails if a widget breaks, but pushes nothing. Add the trigger
        if you want config changes checked before they land.
      </p>
      <CodeBlock code={PR_SNIPPET} />

      <Heading id="summary">Job summary</Heading>
      <p>
        Each run writes a summary to the workflow run page: the number of assets, their total size, the data source and a table of every file with its size and render time. Render
        errors are listed as annotations and fail the job, so a broken widget never replaces a working image.
      </p>

      <Heading id="profile-token">PROFILE_TOKEN</Heading>
      <p>
        The default <code>GITHUB_TOKEN</code> belongs to the workflow, not to you, so GitHub only shows it your public activity. A personal token lets the action see your profile the
        way you do: private contribution counts, exact all-time totals and more reliable GraphQL data. It is optional and only ever read.
      </p>
      <Steps>
        <Step title="Create a fine-grained token">
          <p>
            Open <Ext to="https://github.com/settings/personal-access-tokens/new">Settings &rarr; Developer settings &rarr; Fine-grained tokens</Ext>. Name it, set an expiry, choose
            your own account as the resource owner and <strong>Public repositories (read-only)</strong> as repository access. No extra permissions are required.
          </p>
        </Step>
        <Step title="Save it as a repository secret">
          <p>
            In your profile repository, go to <strong>Settings &rarr; Secrets and variables &rarr; Actions</strong>, click <strong>New repository secret</strong> and save the token
            as <code>PROFILE_TOKEN</code>.
          </p>
        </Step>
        <Step title="Keep the profile-token line">
          <p>
            The exported workflow already passes <code>{"${{ secrets.PROFILE_TOKEN }}"}</code>. When the secret does not exist the value is empty and the action falls back to{" "}
            <code>GITHUB_TOKEN</code>, so the line is safe to keep either way.
          </p>
        </Step>
      </Steps>
      <Note>Both tokens are masked in the logs. The profile token is used only for reading data; pushing always uses <code>token</code>.</Note>

      <Heading id="data">Data sources and fallbacks</Heading>
      <p>The action tries the richest source first and degrades gracefully. The job summary and the <code>data-source</code> output show which one was used.</p>
      <Table
        caption="Data sources"
        className="t-ref"
        head={["Source", "When", "What you get"]}
        rows={[
          [<code>graphql</code>, "A token is available: profile-token, otherwise the workflow token.", "Contribution calendar, per-year totals, pinned repositories, languages, stars, PRs, issues and reviews."],
          [<code>scrape</code>, "GraphQL failed. Uses the REST API plus your public contributions calendar.", "Public repositories and stats from REST; the calendar read from your public profile page."],
          [<code>rest</code>, "GraphQL and the calendar page both failed.", "REST data only. Activity widgets show an empty graph rather than failing."],
          [<code>mock</code>, "mock: true, or --mock on the CLI.", "Deterministic sample data, identical on every run."],
        ]}
      />
      <p>
        Some widgets read extra sources: recent events and commit hours from the REST API, current weather from <Ext to="https://open-meteo.com">Open-Meteo</Ext> using the
        coordinates in your profile, and RSS or Atom feeds for the posts widget. Each of these is optional; if one fails, the widget shows its empty state and the run carries on.
      </p>

      <Heading id="limits">Size limits</Heading>
      <p>
        Every file is checked after rendering. An SVG may be at most <strong>1.5 MB</strong> and a GIF at most <strong>5 MB</strong>; larger files fail the run before anything is
        published. In practice a typical SVG is 60 to 150 KB, most of which is the embedded font. GitHub&rsquo;s image proxy refuses very large images, so these limits keep you well
        inside what it will serve.
      </p>

      <Heading id="cli">Command line</Heading>
      <p>
        The same engine runs locally. Clone the repository, install dependencies, and run the CLI through <code>tsx</code>, or use the pre-built bundle in{" "}
        <code>packages/engine/dist</code>.
      </p>
      <CodeBlock code={CLI_SNIPPET} />
      <Table
        caption="CLI commands"
        className="t-ref"
        head={["Command", "Description"]}
        rows={[
          [<code>build</code>, "Render all assets, README.md, data.json and preview.html into --out."],
          [<code>validate</code>, "Normalise a config and print warnings. Exits with 2 when there are warnings, so it works in CI."],
          [<code>init</code>, "Write a starter readme.config.json and print a matching workflow."],
          [<code>presets</code>, "List the built-in layout presets."],
        ]}
      />
      <Table caption="CLI flags" className="t-ref" head={["Flag", "Command", "Description"]} rows={CLI_FLAGS.map(([f, c, d]) => [<code>{f}</code>, <span className="d-tag">{c}</span>, d])} />
      <p>
        Set <code>PROFILE_TOKEN</code> or <code>GITHUB_TOKEN</code> in the environment to use GraphQL. Without a token the CLI uses the unauthenticated REST API, which GitHub limits to
        60 requests per hour.
      </p>
    </>
  );
}

// ================================================================ 3. config reference

const KEYS: [string, string][] = [
  ["$schema", "JSON schema URL, for editor autocompletion. Rewritten on save."],
  ["version", "Config format version. Currently 1."],
  ["profile", "Who you are: login, name, roles, location and links."],
  ["theme", "Palette, fonts, shape, texture and motion."],
  ["layout", "Rows of blocks, top to bottom. Each block is one widget instance."],
  ["output", "Asset branch, colour schemes, hosting repository and schedule."],
];

const TOKENS: [string, string][] = [
  ["{name}", "Display name, or the login when empty"],
  ["{login}", "GitHub username"],
  ["{city}", "profile.location.city"],
  ["{company}", "profile.company"],
  ["{role}", "First entry of profile.roles"],
  ["{year}", "Current year in your time zone"],
  ["{followers}", "Follower count"],
  ["{stars}", "Stars across your public repositories"],
  ["{repos}", "Public repository count"],
  ["{streak}", "Current contribution streak, in days"],
  ["{contributions}", "Contributions this calendar year"],
];

/** Text options whose help mentions placeholders, straight from the registry. */
function placeholderFields(): { widget: WidgetDef; label: string }[] {
  const out: { widget: WidgetDef; label: string }[] = [];
  const walk = (w: WidgetDef, fields: Field[], prefix = "") => {
    for (const f of fields) {
      if (f.type === "list") walk(w, f.item, `${f.label} › `);
      else if (f.help?.includes("Placeholders")) out.push({ widget: w, label: prefix + f.label });
    }
  };
  for (const w of widgetList) if (w.type !== "terminal") walk(w, w.fields);
  return out;
}

function ConfigReference() {
  const supported = useMemo(placeholderFields, []);
  const t = DEFAULT_THEME;
  return (
    <>
      <p>
        A config is a single JSON document. The studio writes it for you, but it is designed to be readable and safe to edit by hand: the action repairs anything it does not
        understand instead of failing.
      </p>

      <Heading id="example">Full example</Heading>
      <p>
        This is the <a href={href("/presets")}>Command Center</a> preset, exactly as the studio exports it.
      </p>
      <dl className="d-keys">
        {KEYS.map(([k, d]) => (
          <div key={k}>
            <dt>
              <code>{k}</code>
            </dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
      <CodeBlock code={SAMPLE_CONFIG} maxHeight={520} />

      <Heading id="normalisation">Validation and repair</Heading>
      <p>Configs pass through the same normaliser in the studio, the CLI and the action. It never throws; instead it:</p>
      <ul className="d-list">
        <li>fills missing fields from the defaults, including every widget option you leave out;</li>
        <li>clamps numbers into range and replaces values of the wrong type with the widget default;</li>
        <li>skips blocks with an unknown widget type and drops rows that end up empty, with a warning for each;</li>
        <li>turns block ids into file-name-safe slugs and de-duplicates them (<code>stats</code>, <code>stats-2</code>);</li>
        <li>falls back to UTC for an unknown time zone, with a warning.</li>
      </ul>
      <p>
        Run <code>validate</code> from the <DocLink to="action" anchor="cli">CLI</DocLink> to see the warnings without rendering.
      </p>

      <Heading id="profile">profile</Heading>
      <Table
        caption="profile fields"
        className="t-ref"
        head={["Field", "Type", "Description"]}
        rows={[
          [<code>login</code>, "string", "GitHub username the data is fetched for. Invalid logins fall back to octocat."],
          [<code>name</code>, "string ≤ 80", "Display name used by headers and alt text."],
          [<code>roles</code>, "string[] ≤ 12", "Taglines. Headers rotate through them; {role} is the first."],
          [<code>bio</code>, "string ≤ 400", "Short introduction for the about widget."],
          [<code>company</code>, "string", "Shown by identity widgets and available as {company}."],
          [<code>pronouns</code>, "string", "Optional, shown by the about and terminal widgets."],
          [<code>birthday</code>, "YYYY-MM-DD", "Optional. Used by the terminal’s uptime line; never shown as a date."],
          [<code>location.city</code>, "string", "City name, available as {city}."],
          [<code>location.latitude</code>, "number", "−90 to 90. Used for weather and daylight."],
          [<code>location.longitude</code>, "number", "−180 to 180."],
          [<code>location.timezone</code>, "IANA zone", "For example Europe/Berlin. Clocks, greetings and streak days use it."],
          [<code>links[]</code>, "object[] ≤ 16", "icon, label, url and handle for each link. Social widgets render one image per link."],
        ]}
      />

      <Heading id="theme">theme</Heading>
      <Table
        caption="theme fields"
        className="t-ref"
        head={["Field", "Default", "Description"]}
        rows={[
          [
            <code>preset</code>,
            <code className="dim">"{t.preset}"</code>,
            <>
              Palette id: <TokenList items={palettePresets.map((p) => p.id)} />. <DocLink to="themes" anchor="palettes">See all palettes</DocLink>.
            </>,
          ],
          [<code>accent</code>, <code className="dim">unset</code>, <>Hex colour. When set, both palettes are generated from it and <code>preset</code> is ignored.</>],
          [<code>overrides</code>, <code className="dim">{"{}"}</code>, <>Per-scheme token overrides: <code>{'{ "dark": { "accent": "#ff5a36" } }'}</code>. See <DocLink to="themes" anchor="overrides">tokens</DocLink>.</>],
          [<code>font</code>, <code className="dim">"{t.font}"</code>, <>Body font id: <TokenList items={FONTS.map((f) => f.id)} />.</>],
          [<code>headingFont</code>, <code className="dim">"{t.headingFont}"</code>, "Display font id. Defaults to the body font."],
          [<code>radius</code>, <code className="dim">{t.radius}</code>, "Card corner radius in px, 0 to 32."],
          [<code>border</code>, <code className="dim">{t.border}</code>, "Card border width in px, 0 to 4. 0 draws borderless cards."],
          [<code>texture</code>, <code className="dim">"{t.texture}"</code>, <TokenList items={["dots", "grid", "lines", "none"]} />],
          [<code>motion</code>, <code className="dim">"{t.motion}"</code>, <><TokenList items={["full", "subtle", "off"]} />. <DocLink to="themes" anchor="motion">Motion levels</DocLink>.</>],
          [<code>surface</code>, <code className="dim">{String(t.surface)}</code>, "false draws transparent cards that blend into GitHub’s page."],
        ]}
      />

      <Heading id="layout">layout</Heading>
      <p>
        <code>layout</code> is an array of rows. A row holds one or more blocks side by side; half and third width widgets share a row, full width widgets usually get their own.
      </p>
      <Table
        caption="row fields"
        className="t-ref"
        head={["Row field", "Type", "Description"]}
        rows={[
          [<code>id</code>, "string", "Any stable id. Generated when missing."],
          [<code>align</code>, <TokenList items={["center", "left", "right"]} />, "Horizontal alignment of the row in the README."],
          [<code>blocks</code>, "Block[]", "The widgets in this row, left to right."],
        ]}
      />
      <Table
        caption="block fields"
        className="t-ref"
        head={["Block field", "Type", "Description"]}
        rows={[
          [<code>id</code>, "slug ≤ 40", <>Unique id and file name prefix: block <code>stats</code> renders to <code>stats-dark.svg</code>. Keep it stable to keep URLs stable.</>],
          [<code>type</code>, "widget type", <>One of the {widgetList.length} <DocLink to="widgets">widget types</DocLink>.</>],
          [<code>options</code>, "object", "Widget options. Anything missing takes the widget default."],
          [<code>hidden</code>, "boolean", "Keep the block in the config but leave it out of the README."],
          [<code>link</code>, "string", "Overrides where the image links to. An empty string removes the link."],
        ]}
      />

      <Heading id="output">output</Heading>
      <Table
        caption="output fields"
        className="t-ref"
        head={["Field", "Default", "Description"]}
        rows={[
          [<code>branch</code>, <code className="dim">"{DEFAULT_OUTPUT.branch}"</code>, "Branch the assets are pushed to. The asset-branch input overrides it."],
          [<code>modes</code>, <code className="dim">{JSON.stringify(DEFAULT_OUTPUT.modes)}</code>, "Colour schemes to render. One mode halves the file count but ignores the viewer’s theme."],
          [<code>repository</code>, <code className="dim">""</code>, <>owner/repo hosting the assets, used for README links. Empty means <code>&lt;login&gt;/&lt;login&gt;</code>.</>],
          [<code>schedule</code>, <code className="dim">"{DEFAULT_OUTPUT.schedule}"</code>, "Five-field cron expression written into the exported workflow, in UTC."],
        ]}
      />
      <p>Common schedules:</p>
      <Table caption="Schedule examples" head={["Cron", "Runs"]} rows={SCHEDULES.map((s) => [<code>{s.value}</code>, describeCron(s.value)])} />
      <Note>
        The schedule in the config only shapes the exported workflow. Once the workflow is in your repository, its <code>cron</code> line is what GitHub actually uses.
      </Note>

      <Heading id="placeholders">Placeholders</Heading>
      <p>
        Free-text options can include placeholders that are filled in at render time. They are case-insensitive, tolerate inner spaces (<code>{"{ Name }"}</code>), and unknown
        tokens are left exactly as typed.
      </p>
      <Table caption="Placeholders" className="t-ref" head={["Token", "Value"]} rows={TOKENS.map(([k, v]) => [<code>{k}</code>, v])} />
      <p className="d-small">
        Supported in:{" "}
        {supported.map((s, i) => (
          <span key={`${s.widget.type}-${s.label}`}>
            {i > 0 && ", "}
            <DocLink to="widgets" anchor={`w-${s.widget.type}`}>
              {s.widget.title}
            </DocLink>{" "}
            <span className="muted">({s.label.toLowerCase()})</span>
          </span>
        ))}
        .
      </p>
      <h3 className="docs-h3" id="terminal-tokens">
        Terminal extras
      </h3>
      <p>
        The <DocLink to="widgets" anchor="w-terminal">terminal</DocLink> widget understands a richer set. Besides the tokens above it adds <TokenList items={["{age}", "{days_alive}", "{account_age}", "{year_pct}", "{stack}", "{pronouns}"]} />, and
        its status bar adds <TokenList items={["{clock}", "{time}", "{date}", "{tz}"]} />. Filters such as <code>{"{name|lower}"}</code> change case.
      </p>
      <p>
        Colour codes switch the ink for the rest of the line: <code>{"{a}"}</code> accent, <code>{"{m}"}</code> muted, <code>{"{s}"}</code> string, <code>{"{n}"}</code> number,{" "}
        <code>{"{t}"}</code> text, <code>{"{b}"}</code> bold and <code>{"{/}"}</code> reset. Wrap a fragment in <code>{"{? … ?}"}</code> to drop it when a placeholder inside is
        empty.
      </p>
      <CodeBlock code={`{b}{name|lower}{/}{?{m} — {role|lower}?}{?{m} @ {a}{b}{company}?}`} />
    </>
  );
}

function TokenList({ items }: { items: string[] }) {
  return (
    <span className="d-tokens">
      {items.map((x) => (
        <code key={x}>{x}</code>
      ))}
    </span>
  );
}

// ================================================================ 4. widget reference

const DEMO_DATE = new Date();
let demo: { config: ReturnType<typeof presetConfig>; data: ReturnType<typeof mockData> } | null = null;
function demoSetup() {
  if (!demo) {
    const config = presetConfig("command-center");
    demo = { config, data: mockData(DEMO_DATE, config.profile.login, config.profile.name, config.profile.location.timezone) };
  }
  return demo;
}

function useInView<T extends Element>(margin = "400px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen];
}

function WidgetThumb({ def }: { def: WidgetDef }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const { config, data } = demoSetup();
  const ready = useFontsReady([config.theme.font, config.theme.headingFont]);
  const parts = useMemo(() => {
    if (!seen || !ready) return null;
    try {
      return renderBlock({ id: def.type, type: def.type, options: normOptions(def.type, {}) }, config, data, "dark", DEMO_DATE);
    } catch {
      return [];
    }
  }, [seen, ready, def.type, config, data]);
  const fixed = parts?.length && parts.every((p) => p.meta.fixedHeight);
  return (
    <div ref={ref} className={`d-thumb${parts ? " is-ready" : ""}`} aria-hidden="true">
      {!parts && <div className="d-thumb__ph" />}
      {parts && def.kind === "markdown" && <pre className="d-thumb__md">{parts[0]?.markdown}</pre>}
      {parts && def.kind !== "markdown" && (
        <div className={fixed ? "d-thumb__pills" : "d-thumb__row"}>
          {parts
            .filter((p) => p.meta.kind !== "markdown")
            .slice(0, fixed ? 6 : 1)
            .map((p) => (
              <WidgetImage
                key={p.meta.name}
                part={p}
                style={fixed ? { height: Math.round((p.height || 40) * 0.8), width: "auto" } : { width: `${Math.min(100, (p.width / 840) * 100)}%`, height: "auto" }}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function fmtDefault(v: unknown): string {
  if (v === undefined) return "–";
  if (v === null) return "null";
  if (typeof v === "string") return v === "" ? '""' : JSON.stringify(v.length > 28 ? `${v.slice(0, 27)}…` : v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    if (v.every((x) => typeof x === "string" || typeof x === "number")) {
      const s = JSON.stringify(v);
      if (s.length <= 32) return s;
    }
    return `${v.length} item${v.length === 1 ? "" : "s"}`;
  }
  return "{…}";
}

function FieldType({ f }: { f: Field }) {
  switch (f.type) {
    case "text":
      return (
        <>
          {f.multiline ? "text, multi-line" : "text"}
          {f.max ? <span className="muted"> ≤ {f.max}</span> : null}
        </>
      );
    case "number":
      return (
        <>
          number{" "}
          <span className="muted">
            {f.min}–{f.max}
            {f.unit ? ` ${f.unit}` : ""}
          </span>
        </>
      );
    case "toggle":
      return <>boolean</>;
    case "select":
    case "segmented":
      return <TokenList items={f.options.map((o) => o.value)} />;
    case "checklist":
      return (
        <>
          any of <TokenList items={f.options.map((o) => o.value)} />
        </>
      );
    case "color":
      return <>{f.allowTheme ? "hex or empty" : "hex colour"}</>;
    case "icon":
      return <>icon id</>;
    case "tags":
      return (
        <>
          string[]{f.max ? <span className="muted"> ≤ {f.max}</span> : null}
        </>
      );
    case "list":
      return (
        <>
          {f.itemLabel.toLowerCase()}[]{f.max ? <span className="muted"> ≤ {f.max}</span> : null}
        </>
      );
  }
}

function fieldHelp(f: Field): ReactNode {
  const when = f.when ? (
    <span className="d-when">
      when <code>{f.when.key}</code> is {f.when.is.map((x) => JSON.stringify(x)).join(" or ")}
    </span>
  ) : null;
  return (
    <>
      {f.help}
      {when && (f.help ? " " : null)}
      {when}
    </>
  );
}

function OptionRows({ fields, defaults, prefix = "" }: { fields: Field[]; defaults: Record<string, unknown>; prefix?: string }) {
  return (
    <>
      {fields.map((f) => (
        <FieldRows key={prefix + f.key} f={f} def={defaults?.[f.key]} prefix={prefix} />
      ))}
    </>
  );
}

function FieldRows({ f, def, prefix }: { f: Field; def: unknown; prefix: string }) {
  return (
    <>
      <tr className={prefix ? "is-sub" : undefined}>
        <td>
          <code className="opt-key">
            {prefix && <span className="muted">{prefix}</span>}
            {f.key}
          </code>
          <span className="opt-label">{f.label}</span>
        </td>
        <td className="opt-type">
          <FieldType f={f} />
        </td>
        <td>
          <code className="dim">{fmtDefault(def)}</code>
        </td>
        <td className="opt-help">{fieldHelp(f)}</td>
      </tr>
      {f.type === "list" && <OptionRows fields={f.item} defaults={f.newItem} prefix={`${prefix}${f.key}[].`} />}
    </>
  );
}

function WidgetEntry({ w }: { w: WidgetDef }) {
  return (
    <article className="d-widget" id={`w-${w.type}`}>
      <header className="d-widget__head">
        <h3 className="d-widget__title">{w.title}</h3>
        <code className="d-widget__type">{w.type}</code>
        <span className="d-widget__badges">
          <span className={`badge${w.kind !== "svg" ? " badge--accent" : ""}`}>{w.kind}</span>
          <span className="badge">{w.width}</span>
        </span>
      </header>
      <p className="d-widget__desc">{w.description}</p>
      {w.needs?.length ? (
        <p className="d-widget__needs">
          <span>Reads</span> {w.needs.join(", ")}
        </p>
      ) : null}
      <WidgetThumb def={w} />
      {w.fields.length > 0 && (
        <div className="dtable dtable--opts" role="region" aria-label={`${w.title} options`} tabIndex={0}>
          <table className="t-opts">
            <thead>
              <tr>
                <th scope="col">Option</th>
                <th scope="col">Type</th>
                <th scope="col">Default</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              <OptionRows fields={w.fields} defaults={w.defaults} />
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

const catId = (c: string) => `cat-${c.toLowerCase()}`;

function WidgetReference() {
  const groups = CATEGORIES.map((c) => ({ ...c, widgets: widgetList.filter((w) => w.category === c.id) })).filter((g) => g.widgets.length);
  const section = useContext(SectionCtx);
  return (
    <>
      <p>
        Every widget below is generated from the same registry the studio and the action use, so the options, types and defaults are always current. Previews use sample data and
        the default dark palette. Options are written into <code>options</code> on a <DocLink to="config" anchor="layout">block</DocLink>; anything you leave out takes the default.
      </p>
      <div className="w-index">
        {groups.map((g) => (
          <div key={g.id} className="w-index__group">
            <a className="w-index__cat" href={sectionHref(section, catId(g.id))} onClick={(e) => jump(e, section, catId(g.id))}>
              {g.id} <span className="muted">{g.widgets.length}</span>
            </a>
            <div className="w-index__list">
              {g.widgets.map((w) => (
                <a key={w.type} href={sectionHref(section, `w-${w.type}`)} onClick={(e) => jump(e, section, `w-${w.type}`)}>
                  {w.title}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <dl className="d-keys d-keys--legend">
        <div>
          <dt>
            <span className="badge">svg</span>
          </dt>
          <dd>Animated SVG, served as an image.</dd>
        </div>
        <div>
          <dt>
            <span className="badge badge--accent">gif</span>
          </dt>
          <dd>Rasterised animation, for effects GitHub cannot play as SVG.</dd>
        </div>
        <div>
          <dt>
            <span className="badge badge--accent">markdown</span>
          </dt>
          <dd>Written into the README as real Markdown.</dd>
        </div>
        <div>
          <dt>
            <span className="badge">full · half · third</span>
          </dt>
          <dd>Suggested width in a row.</dd>
        </div>
      </dl>
      {groups.map((g) => (
        <section key={g.id} className="w-group" aria-labelledby={catId(g.id)}>
          <Heading id={catId(g.id)}>{g.id}</Heading>
          <p className="w-group__blurb">{g.blurb}.</p>
          {g.widgets.map((w) => (
            <WidgetEntry key={w.type} w={w} />
          ))}
        </section>
      ))}
    </>
  );
}

// ================================================================ 5. themes & typography

const TOKEN_HELP: Record<string, string> = {
  bg: "Page background around the cards",
  card: "Card surface",
  raised: "Raised elements on a card: chips, tracks, tiles",
  border: "Card and divider lines",
  text: "Primary text",
  muted: "Secondary text and labels",
  subtle: "Faint marks: grid dots, empty states",
  accent: "Main accent colour",
  glow: "Brighter accent for highlights and glows",
  accent2: "Secondary accent for charts and contrast details",
  heat: "Five-step contribution scale, empty to busiest",
};

function Strip({ p, label }: { p: Palette; label: string }) {
  return (
    <div className="d-strip">
      <span className="d-strip__label">{label}</span>
      <div className="d-strip__cells">
        {PALETTE_KEYS.map((k) => (
          <span key={k} className="d-strip__cell" style={{ background: p[k] }} title={`${k} ${p[k]}`} />
        ))}
      </div>
      <div className="d-strip__heat">
        {p.heat.map((c, i) => (
          <span key={i} className="d-strip__cell" style={{ background: c }} title={`heat ${i} ${c}`} />
        ))}
      </div>
    </div>
  );
}

function PaletteRow({ id, name, description, dark, light }: { id: string; name: string; description: string; dark: Palette; light: Palette }) {
  return (
    <div className="d-pal">
      <div className="d-pal__meta">
        <strong>{name}</strong>
        <code>{id}</code>
        <p>{description}</p>
      </div>
      <div className="d-pal__strips">
        <Strip p={dark} label="dark" />
        <Strip p={light} label="light" />
      </div>
    </div>
  );
}

function AccentPlayground() {
  const [accent, setAccent] = useState("#e5532d");
  const dark = useMemo(() => deriveFromAccent(accent, "dark"), [accent]);
  const light = useMemo(() => deriveFromAccent(accent, "light"), [accent]);
  return (
    <div className="d-playground">
      <div className="d-playground__ctl">
        <span className="eyebrow">Try an accent</span>
        <ColorInput value={accent} onChange={setAccent} label="Accent colour" />
      </div>
      <div className="d-pal__strips">
        <Strip p={dark} label="dark" />
        <Strip p={light} label="light" />
      </div>
      <code className="d-playground__json">{`"theme": { "accent": "${accent}" }`}</code>
    </div>
  );
}

let fontStyleEl: HTMLStyleElement | null = null;
/** Registers every bundled font as a page font (family `rs-<id>`), once `enabled` turns true. */
function useSpecimenFonts(enabled: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const ids = FONTS.map((f) => f.id);
    loadFonts(ids).then(() => {
      if (!alive) return;
      if (!fontStyleEl) {
        fontStyleEl = document.createElement("style");
        fontStyleEl.dataset.docs = "fonts";
        fontStyleEl.textContent = fontFaceCss(ids);
        document.head.appendChild(fontStyleEl);
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return ready;
}

function FontSpecimens() {
  const [ref, seen] = useInView<HTMLDivElement>("200px");
  const ready = useSpecimenFonts(seen);
  const cats: { id: "mono" | "sans" | "serif"; label: string }[] = [
    { id: "mono", label: "Monospace" },
    { id: "sans", label: "Sans serif" },
    { id: "serif", label: "Serif" },
  ];
  return (
    <div ref={ref} className={`d-fonts${ready ? " is-ready" : ""}`}>
      {cats.map((c) => (
        <div key={c.id} className="d-fonts__group">
          <span className="eyebrow">{c.label}</span>
          {FONTS.filter((f) => f.category === c.id).map((f) => (
            <div key={f.id} className="d-font">
              <span className="d-font__name" style={ready ? { fontFamily: `${familyName(f.id)}, ${f.fallback}` } : undefined}>
                {f.name}
              </span>
              <span className="d-font__sample" style={ready ? { fontFamily: `${familyName(f.id)}, ${f.fallback}` } : undefined}>
                1,284 contributions · <b>27 day streak</b>
              </span>
              <code className="d-font__id">{f.id}</code>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Themes() {
  return (
    <>
      <p>
        A theme is a palette for each colour scheme plus a handful of shape and motion settings. Every widget draws with the same tokens, so a theme change restyles the whole README
        at once.
      </p>

      <Heading id="palettes">Palettes</Heading>
      <p>
        {palettePresets.length} presets, each with a dark and a light variant. The strips show the ten colour tokens in order, followed by the contribution heat scale. Hover a swatch
        for its token and value.
      </p>
      <div className="d-pals">
        {palettePresets.map((p) => (
          <PaletteRow key={p.id} {...p} />
        ))}
      </div>

      <Heading id="accent">Custom accent</Heading>
      <p>
        Set <code>theme.accent</code> and both palettes are generated from that one colour. Neutrals take a faint tint of its hue, the glow is a brighter step of it, the secondary
        accent sits 40° around the colour wheel, and the heat scale blends from the card colour to the accent. The result replaces the preset.
      </p>
      <AccentPlayground />

      <Heading id="overrides">Token overrides</Heading>
      <p>
        For finer control, <code>theme.overrides</code> replaces individual tokens per scheme on top of the preset or the generated palette. Values must be six-digit hex colours;{" "}
        <code>heat</code> takes an array of exactly five.
      </p>
      <Table caption="Palette tokens" className="t-ref" head={["Token", "Used for"]} rows={[...PALETTE_KEYS, "heat"].map((k) => [<code>{k}</code>, TOKEN_HELP[k]])} />
      <CodeBlock code={`"theme": {\n  "preset": "nord",\n  "overrides": {\n    "dark": { "accent": "#88c0d0", "bg": "#0d1117" },\n    "light": { "heat": ["#ebedf0", "#cfe3ea", "#9cc6d4", "#5e9db3", "#3b6f82"] }\n  }\n}`} />

      <Heading id="fonts">Typography</Heading>
      <p>
        Twelve open-source families are bundled. The action embeds a Latin subset of the regular and bold weights inside every SVG, because images on GitHub cannot load web fonts.
        Use <code>font</code> for body text and <code>headingFont</code> for display lines; using the same family for both keeps files smaller.
      </p>
      <FontSpecimens />

      <Heading id="shape">Shape and texture</Heading>
      <p>
        <code>radius</code> rounds card corners from 0 to 32 px, and <code>border</code> sets the hairline from 0 to 4 px. <code>texture</code> adds a quiet pattern to card surfaces:{" "}
        <code>dots</code>, <code>grid</code>, <code>lines</code> or <code>none</code>.
      </p>

      <Heading id="motion">Motion</Heading>
      <Table
        caption="Motion levels"
        className="t-ref"
        head={["Level", "Behaviour"]}
        rows={[
          [<code>full</code>, "Entrance animations plus looping details: typewriters, pulses, scanning beams, rotating text."],
          [<code>subtle</code>, "Entrance animations only. Loops are switched off and loop-only decorations are hidden."],
          [<code>off</code>, "Static. Everything renders in its final state immediately."],
        ]}
      />
      <p>
        Every SVG also contains a <code>prefers-reduced-motion</code> rule. Viewers who ask their system for less motion see the final frame without loops, whatever level you choose.
        GIF widgets cannot respond to that setting, which is one reason only a few widgets use them.
      </p>

      <Heading id="surface">Transparent surfaces</Heading>
      <p>
        With <code>surface: false</code> cards are drawn without a background, so text and charts sit directly on GitHub&rsquo;s page. Combined with both colour schemes this gives a
        native look in dark and light mode. Keep <code>border</code> above 0 if you still want visible card edges.
      </p>
    </>
  );
}

// ================================================================ 6. FAQ

interface Faq {
  id: string;
  q: string;
  a: ReactNode;
}

const FAQ_GENERAL: Faq[] = [
  {
    id: "free",
    q: "Is it free? Is there a server somewhere?",
    a: (
      <p>
        Yes, and no. The studio is a static site on GitHub Pages and keeps your work in your browser. Rendering happens in GitHub Actions in your own repository, which is free for
        public repositories. Nothing passes through a Readme Studio server, because there is none.
      </p>
    ),
  },
  {
    id: "change-design",
    q: "How do I change the design later?",
    a: (
      <p>
        Open the <a href={href("/studio")}>studio</a>, choose <strong>Import</strong> and pick your <code>readme.config.json</code> (or paste its contents). Edit, export again and
        replace the file in your repository. The push triggers a new render straight away.
      </p>
    ),
  },
  {
    id: "private",
    q: "Can it count my private contributions?",
    a: (
      <p>
        Yes, with a <DocLink to="action" anchor="profile-token">PROFILE_TOKEN</DocLink>. The workflow&rsquo;s own token cannot see private activity; a fine-grained personal token with
        read-only access can. Repository details stay private: only counts are used.
      </p>
    ),
  },
  {
    id: "rate-limits",
    q: "Will I hit API rate limits?",
    a: (
      <p>
        No. A run makes a handful of requests: one main GraphQL query, one for yearly totals and a few REST calls for widgets that need them. The workflow token allows 1,000 requests per
        hour per repository, so even an hourly schedule uses a tiny fraction. Only unauthenticated local CLI runs, at 60 requests per hour, can run short.
      </p>
    ),
  },
  {
    id: "animated-svg",
    q: "Does GitHub really allow animated SVG?",
    a: (
      <p>
        Yes. SVGs referenced from <code>&lt;img&gt;</code> tags are rendered in a sandbox: no scripts and no external requests, but CSS and SMIL animations play. Every file is
        self-contained, fonts included, for exactly that reason. GitHub proxies images through its camo cache, so a new render can take a few minutes to appear.
      </p>
    ),
  },
  {
    id: "other-repos",
    q: "Can I use it outside my profile repository?",
    a: (
      <p>
        Yes. The action works in any repository: it publishes to, and links, the repository it runs in. Set <code>output.repository</code> to <code>owner/repo</code> so the README
        you export from the studio points there too. The repository must be public, since images from private repositories cannot be shown to visitors.
      </p>
    ),
  },
  {
    id: "reduced-motion",
    q: "What about people who prefer reduced motion?",
    a: (
      <p>
        Their preference is respected automatically: every SVG stops looping and shows its final state. You can also tone things down for everyone with{" "}
        <DocLink to="themes" anchor="motion">motion</DocLink> set to <code>subtle</code> or <code>off</code>.
      </p>
    ),
  },
  {
    id: "fonts",
    q: "Can I use my own font?",
    a: (
      <p>
        Not yet. Twelve families are bundled, covering mono, sans and serif; see <DocLink to="themes" anchor="fonts">Typography</DocLink>. Because images on GitHub cannot load web fonts,
        each one is subset and embedded inside the SVG, which needs font files the action ships with.
      </p>
    ),
  },
  {
    id: "size",
    q: "How big are the files?",
    a: (
      <p>
        Typically 60 to 150 KB per SVG, most of it embedded font data. A layout of eight blocks in two schemes comes to around 1 to 2 MB on the asset branch, and since that branch is
        replaced on every run, it never grows. Hard limits are 1.5 MB per SVG and 5 MB per GIF.
      </p>
    ),
  },
];

const FAQ_TROUBLE: Faq[] = [
  {
    id: "broken-images",
    q: "My README shows broken images",
    a: (
      <p>
        The README points at files on the asset branch, which only exists after the first run. Open the <strong>Actions</strong> tab, run the <strong>readme</strong> workflow once,
        and reload your profile when it finishes. If the run failed, its log says why; the most common cause is the permission setting below.
      </p>
    ),
  },
  {
    id: "permission-denied",
    q: "The run fails with 403 or “Permission denied” on push",
    a: (
      <p>
        The workflow is not allowed to write. In <strong>Settings &rarr; Actions &rarr; General &rarr; Workflow permissions</strong>, select <strong>Read and write permissions</strong>{" "}
        and re-run the job. Make sure the workflow file still contains <code>permissions: contents: write</code>.
      </p>
    ),
  },
  {
    id: "not-updating",
    q: "The images are not updating",
    a: (
      <>
        <p>
          Check the latest run in the Actions tab first. If it succeeded, the new files are already on the asset branch and you are looking at a cached copy: GitHub&rsquo;s image proxy
          and your browser both cache images for a few minutes. Wait briefly, then hard-refresh with <kbd className="kbd">Shift</kbd> + reload.
        </p>
        <p>If numbers look wrong rather than stale, open data.json on the asset branch to see exactly what the run received.</p>
      </>
    ),
  },
  {
    id: "schedule-stopped",
    q: "The schedule stopped running",
    a: (
      <p>
        GitHub disables scheduled workflows in public repositories after 60 days without repository activity, and sends you an email when it does. Open the Actions tab, select the{" "}
        <strong>readme</strong> workflow and click <strong>Enable workflow</strong>. Any commit to the repository also resets the clock.
      </p>
    ),
  },
  {
    id: "warnings",
    q: "The run shows warnings about my config",
    a: (
      <p>
        The config was repaired on the fly, for example an unknown widget type was skipped or a time zone was not recognised. The run still publishes. Import the config into the studio
        and export it again to save the repaired version, or fix it by hand using the <DocLink to="config" anchor="normalisation">config reference</DocLink>.
      </p>
    ),
  },
];

function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="d-faq">
      {items.map((f) => (
        <details key={f.id} id={f.id} className="d-faq__item">
          <summary>
            <span>{f.q}</span>
            <Plus aria-hidden="true" />
          </summary>
          <div className="d-faq__a">{f.a}</div>
        </details>
      ))}
    </div>
  );
}

function FaqPage() {
  return (
    <>
      <Heading id="general">General</Heading>
      <FaqList items={FAQ_GENERAL} />
      <Heading id="troubleshooting">Troubleshooting</Heading>
      <FaqList items={FAQ_TROUBLE} />
      <Note label="Still stuck?">
        Search or open an issue on <Ext to={`${REPO_URL}/issues`}>GitHub</Ext>. Including the job summary and your config makes it much quicker to help.
      </Note>
    </>
  );
}

// ================================================================ sections

const SECTIONS: SectionDef[] = [
  {
    id: "",
    group: "Guide",
    nav: "Getting started",
    title: "Getting started",
    lede: "From a blank canvas to a profile that redraws itself every night, in about ten minutes.",
    toc: [
      { id: "how-it-works", label: "How it works" },
      { id: "setup", label: "Set up in four steps" },
      { id: "files", label: "What gets created" },
      { id: "branch", label: "Asset branch and dark mode" },
      { id: "updates", label: "How often it updates" },
    ],
    Body: GettingStarted,
  },
  {
    id: "action",
    group: "Reference",
    nav: "Action",
    title: "Action reference",
    lede: "Inputs, outputs, permissions and everything the action does on each run, plus the command line that shares its engine.",
    toc: [
      { id: "usage", label: "Usage" },
      { id: "inputs", label: "Inputs" },
      { id: "outputs", label: "Outputs" },
      { id: "publishing", label: "What a run does" },
      { id: "permissions", label: "Permissions" },
      { id: "pull-requests", label: "Pull requests" },
      { id: "summary", label: "Job summary" },
      { id: "profile-token", label: "PROFILE_TOKEN" },
      { id: "data", label: "Data sources" },
      { id: "limits", label: "Size limits" },
      { id: "cli", label: "Command line" },
    ],
    Body: ActionReference,
  },
  {
    id: "config",
    group: "Reference",
    nav: "Config",
    title: "Config reference",
    lede: "Every field of readme.config.json, what it accepts and what happens when it is missing or wrong.",
    toc: [
      { id: "example", label: "Full example" },
      { id: "normalisation", label: "Validation and repair" },
      { id: "profile", label: "profile" },
      { id: "theme", label: "theme" },
      { id: "layout", label: "layout" },
      { id: "output", label: "output" },
      { id: "placeholders", label: "Placeholders" },
    ],
    Body: ConfigReference,
  },
  {
    id: "widgets",
    group: "Reference",
    nav: "Widgets",
    title: "Widgets",
    lede: `All ${widgetList.length} widgets with their options, types and defaults, generated from the registry the action renders with.`,
    toc: CATEGORIES.filter((c) => widgetList.some((w) => w.category === c.id)).map((c) => ({ id: catId(c.id), label: c.id })),
    Body: WidgetReference,
  },
  {
    id: "themes",
    group: "Reference",
    nav: "Themes & type",
    title: "Themes and typography",
    lede: "Palettes for dark and light, accent-generated themes, bundled fonts and how motion is handled.",
    toc: [
      { id: "palettes", label: "Palettes" },
      { id: "accent", label: "Custom accent" },
      { id: "overrides", label: "Token overrides" },
      { id: "fonts", label: "Typography" },
      { id: "shape", label: "Shape and texture" },
      { id: "motion", label: "Motion" },
      { id: "surface", label: "Transparent surfaces" },
    ],
    Body: Themes,
  },
  {
    id: "faq",
    group: "Help",
    nav: "FAQ",
    title: "Questions and fixes",
    lede: "Short answers to what people ask most, and the usual fixes when a run does not do what you expect.",
    toc: [
      { id: "general", label: "General" },
      { id: "troubleshooting", label: "Troubleshooting" },
    ],
    Body: FaqPage,
  },
];

const GROUPS: SectionDef["group"][] = ["Guide", "Reference", "Help"];

function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? "");
  const key = ids.join("|");
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      let cur = ids[0] ?? "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) cur = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        // at the very bottom, the last heading wins only if it is visible
        const last = document.getElementById(ids[ids.length - 1]);
        if (last && last.getBoundingClientRect().top < window.innerHeight) cur = ids[ids.length - 1];
      }
      setActive(cur);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

function Sidebar({ current, active }: { current: SectionDef; active: string }) {
  return (
    <nav className="docs-side" aria-label="Documentation">
      {GROUPS.map((g) => (
        <div key={g} className="docs-side__group">
          <span className="docs-side__label">{g}</span>
          <ul>
            {SECTIONS.filter((s) => s.group === g).map((s) => {
              const on = s.id === current.id;
              return (
                <li key={s.id || "start"}>
                  <a className="docs-side__link" href={sectionHref(s.id)} aria-current={on ? "page" : undefined}>
                    {s.nav}
                  </a>
                  {on && s.toc.length > 0 && (
                    <ul className="docs-side__sub">
                      {s.toc.map((t) => (
                        <li key={t.id}>
                          <a href={sectionHref(s.id, t.id)} className={active === t.id ? "is-active" : undefined} onClick={(e) => jump(e, s.id, t.id)}>
                            {t.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="docs-side__foot">
        <a href={href("/studio")}>
          Open studio <ArrowRight />
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener">
          Source on GitHub <ArrowUpRight />
        </a>
      </div>
    </nav>
  );
}

function MobileSwitch({ current }: { current: SectionDef }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && ref.current) ref.current.scrollLeft = el.offsetLeft - 16;
  }, [current.id]);
  return (
    <nav className="docs-switch" aria-label="Documentation sections">
      <div ref={ref} className="docs-switch__track">
        {SECTIONS.map((s) => (
          <a key={s.id || "start"} href={sectionHref(s.id)} aria-current={s.id === current.id ? "page" : undefined}>
            {s.nav}
          </a>
        ))}
      </div>
    </nav>
  );
}

function OnThisPage({ current, active }: { current: SectionDef; active: string }) {
  if (!current.toc.length) return <div />;
  return (
    <nav className="docs-toc" aria-label="On this page">
      <span className="docs-side__label">On this page</span>
      <ul>
        {current.toc.map((t) => (
          <li key={t.id}>
            <a href={sectionHref(current.id, t.id)} className={active === t.id ? "is-active" : undefined} onClick={(e) => jump(e, current.id, t.id)}>
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Pager({ index }: { index: number }) {
  const prev = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];
  return (
    <nav className="d-pager" aria-label="Previous and next">
      {prev ? (
        <a className="d-pager__link" href={sectionHref(prev.id)}>
          <span className="d-pager__dir">
            <ArrowLeft /> Previous
          </span>
          <span className="d-pager__title">{prev.title}</span>
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a className="d-pager__link d-pager__link--next" href={sectionHref(next.id)}>
          <span className="d-pager__dir">
            Next <ArrowRight />
          </span>
          <span className="d-pager__title">{next.title}</span>
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}

export default function Docs({ section }: { section: string }) {
  const route = useRoute();
  const index = Math.max(
    0,
    SECTIONS.findIndex((s) => s.id === section),
  );
  const current = SECTIONS[index];
  const target = route.params.get("h") ?? "";
  const active = useScrollSpy(current.toc.map((t) => t.id));

  useEffect(() => {
    if (!target) {
      window.scrollTo({ top: 0 });
      return;
    }
    // wait for the section to paint before jumping, then correct once web fonts have settled the layout
    let alive = true;
    const r = requestAnimationFrame(() => scrollToId(target, false));
    document.fonts?.ready.then(() => alive && scrollToId(target, false));
    return () => {
      alive = false;
      cancelAnimationFrame(r);
    };
  }, [current.id, target]);

  const Body = current.Body;
  const number = String(index + 1).padStart(2, "0");
  return (
    <SitePage current="docs">
      <SectionCtx.Provider value={current.id}>
        <MobileSwitch current={current} />
        <div className="docs">
          <Sidebar current={current} active={active} />
          <article className="docs-main" aria-labelledby="docs-title">
            <header className="docs-head">
              <span className="eyebrow">
                Docs <span className="docs-head__sep">/</span> {number} {current.group}
              </span>
              <h1 id="docs-title">{current.title}</h1>
              <p className="docs-head__lede">{current.lede}</p>
            </header>
            <div className="prose">
              <Body />
            </div>
            <Pager index={index} />
            <p className="docs-meta">
              Studio <a href={STUDIO_URL}>{STUDIO_URL.replace(/^https:\/\//, "").replace(/\/$/, "")}</a> <span aria-hidden="true">·</span> Action <code>{ACTION_REF}</code>
            </p>
          </article>
          <OnThisPage current={current} active={active} />
        </div>
      </SectionCtx.Provider>
    </SitePage>
  );
}

