(function () {
  const STORAGE_KEY = "cifi-mtc-planner-v1";
  const app = document.getElementById("app");
  const tabs = document.querySelectorAll(".tab");

  const state = loadState();
  let revealNext = false;
  applyTheme();
  applyCostStyle();
  applyDensity();
  selectEditableOnClick();
  bindConfig();

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => goTo(tab.dataset.tab));
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-go]");
    if (!link) return;
    event.preventDefault();
    goTo(link.dataset.go);
  });

  function goTo(tab) {
    state.tab = tab;
    saveState();
    paintTabs();
    render();
    window.scrollTo(0, 0);
  }

  function isEditableText(el) {
    if (!el || !el.matches) return false;
    if (el.matches("textarea")) return true;
    if (!el.matches("input")) return false;
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return type === "text" || type === "number" || type === "search";
  }

  function selectEditableOnClick() {
    document.addEventListener("focusin", (event) => {
      if (!isEditableText(event.target)) return;
      const el = event.target;
      setTimeout(() => {
        if (document.activeElement === el) el.select();
      }, 0);
    });
    document.addEventListener("mouseup", (event) => {
      if (!isEditableText(event.target)) return;
      event.preventDefault();
      event.target.select();
    });
  }

  function loadState() {
    const blank = {
      tab: "home",
      mp: "",
      oom: false,
      levels: {},
      ignored: {},
      progress: Object.assign(MTC.defaultProgress(), { unlockedOnly: true }),
      plan: null,
      checked: [],
      levelsAtPlan: null,
      orderMode: "order",
      levelQuery: "",
      ownedOnly: false,
      mapQuery: "",
      mapZoom: 1.5,
      runs: [],
      levelBlock: "",
      hideMaxed: false,
      theme: "red",
      costStyle: "suffix",
      compact: false,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return blank;
      saved.progress = mergeProgress(saved.progress);
      return Object.assign(blank, saved, { progress: mergeProgress(saved.progress) });
    } catch (err) {
      return blank;
    }
  }

  function mergeProgress(saved) {
    const base = MTC.defaultProgress();
    if (!saved) return base;
    return Object.assign(base, saved, {
      weights: Object.assign(base.weights, saved.weights || {}),
      rank: Object.assign(base.rank, saved.rank || {}),
      crew: Object.assign(base.crew, saved.crew || {}),
      manual: Object.assign(base.manual, saved.manual || {}),
    });
  }

  function saveState() {
    const copy = {
      tab: state.tab,
      mp: state.mp,
      oom: state.oom,
      levels: state.levels,
      ignored: state.ignored,
      progress: state.progress,
      plan: state.plan,
      checked: state.checked,
      levelsAtPlan: state.levelsAtPlan,
      orderMode: state.orderMode,
      levelQuery: state.levelQuery,
      ownedOnly: state.ownedOnly,
      mapQuery: state.mapQuery,
      mapZoom: state.mapZoom,
      runs: state.runs,
      levelBlock: state.levelBlock,
      hideMaxed: state.hideMaxed,
      theme: state.theme,
      costStyle: state.costStyle,
      compact: state.compact,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
  }

  function paintTabs() {
    tabs.forEach((tab) => tab.classList.toggle("is-on", tab.dataset.tab === state.tab));
  }

  function applyTheme() {
    const theme = state.theme === "green" || state.theme === "light" || state.theme === "charcoal" ? state.theme : "red";
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll("[data-theme-pick]").forEach((button) => {
      const on = button.dataset.themePick === theme;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function applyCostStyle() {
    const style = state.costStyle === "sci" ? "sci" : "suffix";
    state.costStyle = style;
    document.querySelectorAll("[data-cost-pick]").forEach((button) => {
      const on = button.dataset.costPick === style;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function applyDensity() {
    state.compact = !!state.compact;
    document.body.dataset.density = state.compact ? "compact" : "";
    const box = document.getElementById("compact-lists");
    if (box) box.checked = state.compact;
  }

  function setConfigOpen(open) {
    const menu = document.getElementById("config-menu");
    const button = document.getElementById("config-btn");
    if (!menu || !button) return;
    menu.hidden = !open;
    button.classList.toggle("is-on", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function bindConfig() {
    const button = document.getElementById("config-btn");
    const menu = document.getElementById("config-menu");
    if (!button || !menu) return;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setConfigOpen(menu.hidden);
    });
    menu.addEventListener("click", (event) => {
      const pick = event.target.closest("[data-theme-pick]");
      if (pick) {
        state.theme = pick.dataset.themePick;
        applyTheme();
        saveState();
        return;
      }
      const cost = event.target.closest("[data-cost-pick]");
      if (!cost) return;
      state.costStyle = cost.dataset.costPick;
      applyCostStyle();
      saveState();
      render();
    });
    menu.addEventListener("change", (event) => {
      if (event.target.id !== "compact-lists") return;
      state.compact = event.target.checked;
      applyDensity();
      saveState();
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".config")) setConfigOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setConfigOpen(false);
    });
  }

  function render() {
    if (state.tab === "levels") renderLevels();
    else if (state.tab === "settings") renderSettings();
    else if (state.tab === "map") renderMap();
    else if (state.tab === "plan") renderPlan();
    else renderHome();
    document.body.dataset.tab = state.tab;
  }

  function renderHome() {
    const stats = completionStats();
    const owned = Object.keys(state.levels).length;
    const plan = state.plan;
    const checked = state.checked.filter(Boolean).length;
    const planLine = plan && plan.groups.length
      ? `${checked} of ${plan.groups.length} rows checked`
      : "No buy order yet";
    app.innerHTML = `
      <div class="home">
        <section class="home-intro">
          <p class="kicker">Fan-made tool · Pre-Ouro only</p>
          <h1>Mod Points Planner - A more efficient Loop Reset</h1>
          <span>Based on the <a href="${esc(MTC.DATA.source)}" target="_blank" rel="noopener">original Mod Tree Cultivator</a> sheet, which currently maintained by TSoD. It scores loop mods the same way the sheet's [Buy Now!] checkbox does, but turns the MP from one loop reset into a full buy order at once.<br><br>All the good stuff, like the calculations logic and the loop mod map, belongs to the sheet's authors and contributors. So any bugs might be my fault, not theirs.</span>
          <div class="home-actions">
            <button type="button" class="btn" data-go="plan">Build a buy order</button>
            <button type="button" class="btn ghost" data-go="levels">Enter owned levels</button>
          </div>

          <h2 class="section-title">How to use it</h2>
          <ol class="steps">
            <li>
              <b>Load your levels.</b>
              <span>Copy the Name, Code, and Level columns from the sheet's Mods tab and paste them in <a href="#" data-go="levels">Owned levels</a>. You can also type levels by hand.</span>
            </li>
            <li>
              <b>Match your progress.</b>
              <span>In <a href="#" data-go="settings">Weights and progress</a>, fill in ship ranks, run stats, and manual generators. Leaving them at 0 still gives a sensible order.</span>
            </li>
            <li>
              <b>Enter this reset's MP.</b>
              <span>On <a href="#" data-go="plan">Buy order</a>, type the MP you earned, such as 2.5m or 1.2e9, and build the list.</span>
            </li>
            <li>
              <b>Check rows off as you buy.</b>
              <span>Checking a row saves those levels. Click any code to find it on the <a href="#" data-go="map">Map</a>.</span>
            </li>
          </ol>
          <section class="card home-notes">
            <h2 class="card-title">Information and credits</h2>
            <ul class="plain">
              <li>Data matches sheet version 1.2.0.11. It does not cover Ouro mods.</li>
              <li>Nothing is read from the game. Levels only change when you enter them or check rows off.</li>
              <li>"Export to clipboard" copies Code and Level. Paste it into cell C30 of the sheet to sync back. (WIP but I don't know if it'll work in any way yet because the sheet doesn't accept multiple cells being altered at once)</li>
              <li>Loop mod map by TSoD, from the original sheet.</li>
              <li>This is a fan-made tool and not affiliated with CIFI or its developers. Made by <a href="https://github.com/leosans-eng" target="_blank" rel="noopener">leosans-eng</a>.</li>
              <li>You can report bugs or suggest features <a href="https://github.com/leosans-eng/cifi-mod-points-planner/issues" target="_blank" rel="noopener">here</a> or send it to me on Discord (LeoSans).</li>
              <li>The credits for all good stuff go to the original sheet's authors and contributors.</li>
            </ul>
          </section>
        </section>

        <aside class="home-side">
          <section class="card">
            <h2 class="card-title">Your progress</h2>
            ${completionHtml()}
            <dl class="facts">
              <div><dt>Mods at max level</dt><dd>${stats.maxed} / ${stats.total}</dd></div>
              <div><dt>Mods with a saved level</dt><dd>${owned}</dd></div>
              <div><dt>Current buy order</dt><dd>${planLine}</dd></div>
            </dl>
          </section>
          <section class="card">
            <h2 class="card-title">Run history</h2>
            <div id="run-history"></div>
          </section>
          <section class="card">
            <h2 class="card-title">Your data</h2>
            <p class="note small">Everything is saved in this browser only. Download a backup to keep a copy, or to move your levels, settings, and run history to another browser.</p>
            <div class="btn-pair">
              <button type="button" class="btn ghost" id="backup-save">Download backup</button>
              <button type="button" class="btn ghost" id="backup-load">Load backup</button>
            </div>
            <input type="file" id="backup-file" accept=".json,application/json" hidden>
            <p class="note small" id="backup-msg"></p>
          </section>
        </aside>
      </div>`;
    paintRunHistory();
    document.getElementById("backup-save").addEventListener("click", downloadBackup);
    document.getElementById("backup-load").addEventListener("click", () => document.getElementById("backup-file").click());
    document.getElementById("backup-file").addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) loadBackup(file);
      event.target.value = "";
    });
  }

  function runGains() {
    const gains = [];
    for (let i = 1; i < state.runs.length; i++) {
      const delta = state.runs[i].log - state.runs[i - 1].log;
      if (delta > 0.01) gains.push(delta);
    }
    return gains;
  }

  function typicalGain() {
    const gains = runGains().slice(-8);
    if (!gains.length) return null;
    const sorted = gains.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function formatOom(delta) {
    const sign = delta > 0 ? "+" : "";
    return sign + delta.toFixed(2) + " OoM";
  }

  function recordRun(log) {
    const last = state.runs[state.runs.length - 1];
    if (last && Math.abs(last.log - log) < 1e-9) {
      last.t = Date.now();
    } else {
      state.runs.push({ t: Date.now(), log });
      if (state.runs.length > 100) state.runs = state.runs.slice(-100);
    }
  }

  function paintRunHistory() {
    const root = document.getElementById("run-history");
    if (!root) return;
    if (!state.runs.length) {
      root.innerHTML = `<p class="note small">Each time you build a buy order, the MP you entered is saved here as one loop reset. After two resets, the gain between them is shown in orders of magnitude.</p>`;
      return;
    }
    const recent = state.runs.slice(-8).reverse();
    const offset = state.runs.length - 1;
    const lastDelta = state.runs.length > 1 ? state.runs[state.runs.length - 1].log - state.runs[state.runs.length - 2].log : null;
    const typical = typicalGain();
    root.innerHTML = `
      <dl class="facts">
        <div><dt>Resets logged</dt><dd>${state.runs.length}</dd></div>
        ${lastDelta == null ? "" : `<div><dt>Gain since the previous reset</dt><dd>${formatOom(lastDelta)}</dd></div>`}
        ${typical == null || runGains().length < 2 ? "" : `<div><dt>Typical gain</dt><dd>${formatOom(typical)}</dd></div>`}
      </dl>
      <ul class="runs">
        ${recent.map((run, i) => `<li>
          <span class="run-date">${esc(new Date(run.t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }))}</span>
          ${mpAmount(run.log)}
          <button type="button" class="icon-btn" data-run="${offset - i}" aria-label="Remove this reset" title="Remove this reset">×</button>
        </li>`).join("")}
      </ul>
      <button type="button" class="btn ghost danger small-btn" id="runs-clear">Clear history</button>`;
    root.querySelectorAll("[data-run]").forEach((button) => {
      button.addEventListener("click", () => {
        state.runs.splice(Number(button.dataset.run), 1);
        saveState();
        paintRunHistory();
      });
    });
    document.getElementById("runs-clear").addEventListener("click", () => {
      if (!confirm("Remove every logged loop reset?")) return;
      state.runs = [];
      saveState();
      paintRunHistory();
    });
  }

  function goalEstimate(goal) {
    const gain = typicalGain();
    if (goal.shortLog == null || !gain) return "";
    const resets = Math.max(1, Math.ceil(goal.shortLog / gain - 1e-9));
    if (resets > 100000) return "";
    return `<span class="meta">About ${resets.toLocaleString()} more ${resets === 1 ? "reset" : "resets"} if each one adds ${formatOom(gain)}, like your recent ones.</span>`;
  }

  function downloadBackup() {
    saveState();
    const payload = {
      app: "cifi-mod-points-planner",
      version: 1,
      dataVersion: MTC.DATA.version,
      savedAt: new Date().toISOString(),
      state: JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cifi-mp-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    const message = document.getElementById("backup-msg");
    if (message) message.textContent = "Backup downloaded.";
  }

  function loadBackup(file) {
    const message = document.getElementById("backup-msg");
    const reader = new FileReader();
    reader.onload = () => {
      let saved = null;
      try {
        const parsed = JSON.parse(String(reader.result));
        saved = parsed && parsed.app === "cifi-mod-points-planner" ? parsed.state : null;
      } catch (err) {
        saved = null;
      }
      if (!saved || typeof saved !== "object" || typeof saved.levels !== "object") {
        if (message) message.textContent = "That file isn't a backup from this planner.";
        return;
      }
      if (!confirm("Replace everything saved in this browser with this backup?")) return;
      saved.tab = "home";
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      location.reload();
    };
    reader.readAsText(file);
  }

  app.addEventListener("click", (event) => {
    const button = event.target.closest("[data-map]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    openMap(button.dataset.map);
  });

  function renderPlan() {
    const owned = Object.keys(state.levels).length;
    app.innerHTML = `
      <div class="split">
        <aside class="panel side">
          <label class="field">
            <span>MP this loop reset</span>
            <input id="mp" type="text" inputmode="decimal" placeholder="1500, 1.5e6, 250k" value="${esc(state.mp)}">
          </label>
          <p class="note small" id="mp-readout"></p>
          <button class="btn wide" id="plan-btn" type="button">Build buy order</button>
          <div class="checks stack">
            <label><input id="oom" type="checkbox" ${state.oom ? "checked" : ""}> Number is orders of magnitude (log10)</label>
            <label><input id="unlocked" type="checkbox" ${state.progress.unlockedOnly ? "checked" : ""}> Only unlocked mods</label>
          </div>
          <hr>
          ${owned === 0 ? `<p class="warn small">Every mod is still level 0. Open <a href="#" data-go="levels">Owned levels</a> and enter what you already bought, or this list starts from a fresh tree.</p>` : `<p class="note small">${owned} mods have a saved level. The order starts from those.</p>`}
          ${completionHtml()}
        </aside>
        <section class="panel main" id="results"></section>
      </div>`;
    document.getElementById("mp").addEventListener("input", (event) => {
      state.mp = event.target.value;
      saveState();
      updateReadout();
    });
    document.getElementById("mp").addEventListener("keydown", (event) => {
      if (event.key === "Enter") buildPlan();
    });
    document.getElementById("oom").addEventListener("change", (event) => {
      state.oom = event.target.checked;
      saveState();
      updateReadout();
    });
    document.getElementById("unlocked").addEventListener("change", (event) => {
      state.progress.unlockedOnly = event.target.checked;
      saveState();
    });
    document.getElementById("plan-btn").addEventListener("click", buildPlan);
    updateReadout();
    paintResults();
  }

  function updateReadout() {
    const node = document.getElementById("mp-readout");
    if (!node) return;
    const log = MTC.parseMp(state.mp, state.oom);
    if (log == null) {
      node.textContent = "Use a number the game would show, such as 1.25e6 or 3.4b.";
      return;
    }
    node.innerHTML = state.oom
      ? `That is ${mpAmount(log)}.`
      : `That is ${mpAmount(log)}, log ${log.toFixed(2)}.`;
  }

  function buildPlan() {
    const log = MTC.parseMp(state.mp, state.oom);
    const results = document.getElementById("results");
    if (log == null) {
      results.innerHTML = `<p class="warn">That MP value could not be read.</p>`;
      return;
    }
    recordRun(log);
    state.levelsAtPlan = Object.assign({}, state.levels);
    const plan = MTC.plan({
      logMp: log,
      levels: state.levels,
      ignored: state.ignored,
      progress: state.progress,
    });
    state.plan = plan;
    state.checked = plan.groups.map(() => false);
    saveState();
    paintResults();
  }

  function paintResults() {
    const results = document.getElementById("results");
    if (!results) return;
    const plan = state.plan;
    if (!plan) {
      results.innerHTML = `<div class="empty">
        <h2>No buy order yet</h2>
        <p>Enter this reset's MP, then press Build buy order.</p>
      </div>`;
      return;
    }
    if (!plan.groups.length) {
      results.innerHTML = `<div class="empty">
        <h2>Nothing to buy</h2>
        <p>This MP can't afford any eligible level. Raise the amount, check your owned levels, or turn off “Only unlocked mods”.</p>
      </div>${nextGoalHtml(plan.nextGoal)}`;
      return;
    }
    const bought = state.checked.filter(Boolean).length;
    const nextIndex = state.checked.findIndex((flag) => !flag);
    const next = nextIndex === -1 ? null : plan.groups[nextIndex];
    const spentThrough = nextIndex === 0 ? null : plan.groups[Math.max(0, (nextIndex === -1 ? plan.groups.length : nextIndex) - 1)];
    const leftLog = spentThrough ? spentThrough.endLogMp : plan.startLog;
    results.innerHTML = `
      <div class="stats">
        <div class="stat"><b>${plan.steps.toLocaleString()}</b><span>levels to buy</span></div>
        <div class="stat"><b>${plan.summary.length}</b><span>different mods</span></div>
        <div class="stat"><b>${mpAmount(leftLog)}</b><span>Still unspent${bought ? " after checked rows" : ""}</span></div>
        <div class="stat"><b>${plan.ms} ms</b><span>to calculate</span></div>
      </div>
      ${plan.stopped ? `<p class="warn">Stopped early so the page stayed responsive. Plan again after marking some of these bought, or with a smaller MP.</p>` : ""}
      <article class="next">
        <div>
          <p class="meta">Next purchase</p>
          <h2>${next ? esc(next.name) : "List complete"}</h2>
          <p>${next ? `${codeButton(next.code)} · ${levelRange(next.from, next.to)} · ${mpAmount(next.costLog)}` : "Every row in this order is checked."}</p>
        </div>
        <button class="btn" id="mark-next" type="button" ${next ? "" : "disabled"}>Mark bought</button>
      </article>
      <div class="toolbar">
        <button class="btn ghost" type="button" id="mode-order">Buy order</button>
        <button class="btn ghost" type="button" id="mode-totals">Totals per mod</button>
        <button class="btn ghost" type="button" id="copy-list">Copy list</button>
        <button class="btn ghost" type="button" id="clear-checks">Clear checks</button>
      </div>
      <div class="list" id="buy-list"></div>
      ${nextGoalHtml(plan.nextGoal)}
      <p class="note small">Checking a row marks that step and everything above it as bought, and saves those levels in this browser. Clear checks puts levels back to how they were when you built the order.</p>`;
    document.getElementById("mark-next").addEventListener("click", () => {
      if (nextIndex >= 0) setBoughtThrough(nextIndex);
    });
    document.getElementById("mode-order").addEventListener("click", () => {
      state.orderMode = "order";
      saveState();
      paintResults();
    });
    document.getElementById("mode-totals").addEventListener("click", () => {
      state.orderMode = "totals";
      saveState();
      paintResults();
    });
    document.getElementById("copy-list").addEventListener("click", copyList);
    document.getElementById("clear-checks").addEventListener("click", () => {
      if (!confirm("Clear every check and put levels back to how they were when you built this order?")) return;
      state.checked = plan.groups.map(() => false);
      state.levels = Object.assign({}, state.levelsAtPlan || {});
      saveState();
      paintResults();
    });
    const list = document.getElementById("buy-list");
    if (state.orderMode === "totals") {
      list.innerHTML = plan.summary.map((row, index) => rowHtml({
        index,
        code: row.code,
        title: row.name,
        detailHtml: `${levelRange(row.from, row.to)} · ${row.count} levels · ${codeButton(row.code)}`,
        cost: row.costLog,
        extraHtml: "",
        tags: row.tags,
        unlocked: row.unlocked,
        done: false,
        next: false,
        checkable: false,
      })).join("");
    } else {
      list.innerHTML = plan.groups.map((row, index) => rowHtml({
        index,
        code: row.code,
        title: row.name,
        detailHtml: `${levelRange(row.from, row.to)}${row.count > 1 ? ` · ${row.count} in a row` : ""} · ${codeButton(row.code)}`,
        cost: row.costLog,
        extraHtml: `left ${mpAmount(row.endLogMp)}`,
        tags: row.tags,
        unlocked: row.unlocked,
        done: !!state.checked[index],
        next: index === nextIndex,
        checkable: true,
      })).join("");
      list.querySelectorAll("input[data-i]").forEach((input) => {
        input.addEventListener("change", () => {
          const index = Number(input.dataset.i);
          if (input.checked) setBoughtThrough(index);
          else setBoughtThrough(index, false);
        });
      });
      const current = list.querySelector(".is-next");
      if (current && revealNext) current.scrollIntoView({ block: "nearest" });
      revealNext = false;
    }
    paintCompletion();
  }

  function nextGoalHtml(goal) {
    if (!goal) return "";
    return `<article class="goal">
      <p class="meta">Next upgrade after MP runs out</p>
      <strong>${esc(goal.name)}</strong>
      <span class="meta">${codeButton(goal.code)} · ${levelRange(goal.from, goal.to)} · costs ${mpAmount(goal.costLog)}${goal.shortLog != null ? ` · about ${mpAmount(goal.shortLog)} more than you have left` : ""}${goal.unlocked ? "" : ` · ${lockNote(requirementCodes(goal.code))}`}</span>
      ${goalEstimate(goal)}
    </article>`;
  }

  function rowHtml(row) {
    return `<label class="buy${row.done ? " is-done" : ""}${row.next ? " is-next" : ""}">
      ${row.checkable ? `<input type="checkbox" data-i="${row.index}" ${row.done ? "checked" : ""}>` : `<span class="meta">${row.index + 1}</span>`}
      <span>
        <strong>${esc(row.title)}</strong>
        <span class="meta">${row.detailHtml}${row.unlocked ? "" : ` · ${lockNote(requirementCodes(row.code))}`}</span>
        ${row.tags && row.tags.length ? `<span class="tags">${row.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</span>` : ""}
      </span>
      <span class="cost"><b>${mpAmount(row.cost)}</b><span class="meta">${row.extraHtml}</span></span>
    </label>`;
  }

  function setBoughtThrough(index, on) {
    const plan = state.plan;
    if (!plan) return;
    const enable = on !== false;
    if (enable) {
      for (let i = 0; i <= index; i++) state.checked[i] = true;
    } else {
      for (let i = index; i < state.checked.length; i++) state.checked[i] = false;
    }
    const levels = Object.assign({}, state.levelsAtPlan || {});
    plan.groups.forEach((group, i) => {
      if (state.checked[i]) levels[group.code] = group.to;
    });
    state.levels = levels;
    saveState();
    revealNext = true;
    paintResults();
  }

  function copyList() {
    const plan = state.plan;
    if (!plan) return;
    const lines = ["CIFI mod buy order"];
    if (state.orderMode === "totals") {
      plan.summary.forEach((row, index) => {
        lines.push(`${index + 1}. ${row.name} ${row.from} -> ${row.to} (${row.count}) for ${formatCost(row.costLog)} MP`);
      });
    } else {
      plan.groups.forEach((row, index) => {
        const mark = state.checked[index] ? "[x]" : "[ ]";
        lines.push(`${mark} ${index + 1}. ${row.name} ${row.from} -> ${row.to} for ${formatCost(row.costLog)} MP`);
      });
    }
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      const button = document.getElementById("copy-list");
      if (button) button.textContent = "Copied";
    }).catch(() => {
      const button = document.getElementById("copy-list");
      if (button) button.textContent = "Copy failed";
    });
  }

  function renderLevels() {
    app.innerHTML = `
      <div class="split">
        <aside class="panel side">
          <h2 class="card-title">Import from the sheet</h2>
          <p class="note small">Copy the Name, Code, and Level columns on the Mods tab, header included, and paste them here. A short line like <code>A01 12</code> also works.</p>
          <textarea id="paste" rows="7" placeholder="Name&#9;Code&#9;Level&#10;Fast-Loop Modification Module MK1&#9;A01&#9;5&#10;Unlock Modification: Daily Rewards&#9;A02&#9;1"></textarea>
          <button class="btn wide" id="apply-paste" type="button">Apply paste</button>
          <p class="note small" id="paste-msg"></p>
          <button class="btn ghost wide" id="copy-levels" type="button">Export to clipboard</button>
          <hr>
          ${completionHtml()}
          <button class="btn ghost danger wide" id="reset-levels" type="button">Reset all levels</button>
        </aside>
        <section class="panel main">
          <div class="list-head">
            <input id="level-search" type="text" placeholder="Search name or code" value="${esc(state.levelQuery)}">
            <div class="seg" role="group" aria-label="Block">
              ${["", "A", "B", "C", "D", "E", "F", "G", "H", "I"].map((letter) => `<button type="button" data-level-block="${letter}" class="${state.levelBlock === letter ? "is-on" : ""}">${letter || "All"}</button>`).join("")}
            </div>
            <label class="inline-check"><input id="owned-only" type="checkbox" ${state.ownedOnly ? "checked" : ""}> Owned only</label>
            <label class="inline-check"><input id="hide-maxed" type="checkbox" ${state.hideMaxed ? "checked" : ""}> Hide maxed</label>
          </div>
          <p class="note small" id="level-count"></p>
          <div class="level-list" id="level-list"></div>
        </section>
      </div>`;
    const search = document.getElementById("level-search");
    search.addEventListener("input", () => {
      state.levelQuery = search.value;
      saveState();
      paintLevelList();
    });
    document.getElementById("owned-only").addEventListener("change", (event) => {
      state.ownedOnly = event.target.checked;
      saveState();
      paintLevelList();
    });
    document.getElementById("hide-maxed").addEventListener("change", (event) => {
      state.hideMaxed = event.target.checked;
      saveState();
      paintLevelList();
    });
    document.querySelectorAll("[data-level-block]").forEach((button) => {
      button.addEventListener("click", () => {
        state.levelBlock = button.dataset.levelBlock;
        saveState();
        document.querySelectorAll("[data-level-block]").forEach((other) => other.classList.toggle("is-on", other === button));
        paintLevelList();
      });
    });
    document.getElementById("paste").addEventListener("paste", (event) => {
      const text = event.clipboardData && event.clipboardData.getData("text");
      if (!text || !text.trim()) return;
      event.preventDefault();
      event.target.value = text;
      finishPaste(text);
    });
    document.getElementById("apply-paste").addEventListener("click", () => {
      finishPaste(document.getElementById("paste").value);
    });
    document.getElementById("copy-levels").addEventListener("click", copyLevelsForSheet);
    document.getElementById("reset-levels").addEventListener("click", () => {
      if (!confirm("Set every owned level back to 0?")) return;
      state.levels = {};
      state.plan = null;
      state.checked = [];
      saveState();
      paintLevelList();
    });
    paintLevelList();
  }

  function paintLevelList() {
    const query = state.levelQuery.trim().toLowerCase();
    const rows = MTC.mods.filter((mod) => {
      const owned = state.levels[mod.code] || 0;
      if (state.ownedOnly && owned <= 0 && !state.ignored[mod.code]) return false;
      if (state.levelBlock && mod.code.charAt(0) !== state.levelBlock) return false;
      if (state.hideMaxed && isMaxed(mod, owned)) return false;
      if (!query) return true;
      return mod.name.toLowerCase().includes(query) || mod.shortName.toLowerCase().includes(query) || mod.code.toLowerCase().includes(query);
    });
    const list = document.getElementById("level-list");
    list.innerHTML = rows.map((mod) => {
      const owned = state.levels[mod.code] || 0;
      const maxed = isMaxed(mod, owned);
      const cap = capLabel(mod);
      return `<div class="mod-row${maxed ? " is-maxed" : ""}" data-row="${esc(mod.code)}">
        <label class="meta"><input type="checkbox" data-ignore="${esc(mod.code)}" ${state.ignored[mod.code] ? "checked" : ""}> skip</label>
        <span class="mod-main">
          <span class="title-line"><strong>${esc(mod.name)}</strong>${maxed ? `<span class="badge">MAXED</span>` : ""}</span>
          <span class="meta" data-meta>${levelMeta(mod, owned)}</span>
          ${isCapped(mod) ? `<span class="meter" aria-hidden="true"><span data-fill style="width:${levelFill(mod, owned)}%"></span></span>` : ""}
        </span>
        <input type="number" min="0" max="${mod.max}" step="1" data-level="${esc(mod.code)}" value="${owned}">
      </div>`;
    }).join("");
    list.querySelectorAll("[data-level]").forEach((input) => {
      input.addEventListener("change", () => {
        const code = input.dataset.level;
        const mod = MTC.MODEL.byCode[code];
        let value = Math.floor(Number(input.value));
        if (!Number.isFinite(value) || value < 0) value = 0;
        if (value > mod.max) value = mod.max;
        input.value = String(value);
        if (value === 0) delete state.levels[code];
        else state.levels[code] = value;
        state.plan = null;
        saveState();
        if ((state.ownedOnly && value === 0) || (state.hideMaxed && isMaxed(mod, value))) paintLevelList();
        else {
          paintModRow(input.closest(".mod-row"), mod, value);
          list.querySelectorAll(".mod-row").forEach((row) => {
            const other = MTC.MODEL.byCode[row.dataset.row];
            if (other && requirementCodes(other.code).includes(code)) paintModRow(row, other, state.levels[other.code] || 0);
          });
          paintCompletion();
          paintLevelCount();
        }
      });
    });
    list.querySelectorAll("[data-ignore]").forEach((input) => {
      input.addEventListener("change", () => {
        const code = input.dataset.ignore;
        if (input.checked) state.ignored[code] = true;
        else delete state.ignored[code];
        state.plan = null;
        saveState();
      });
    });
    paintCompletion();
    paintLevelCount(rows.length);
  }

  function totalModLevel() {
    let total = 0;
    Object.keys(state.levels).forEach((code) => {
      if (code !== "A13" && code !== "IU4") total += state.levels[code] || 0;
    });
    return total;
  }

  function paintLevelCount(shown) {
    const node = document.getElementById("level-count");
    if (!node) return;
    if (shown != null) node.dataset.shown = shown;
    const count = Number(node.dataset.shown || 0);
    node.innerHTML = `Showing ${count} of ${MTC.mods.length} mods · total mod level <span class="lv">${totalModLevel().toLocaleString()}</span>`;
  }

  function levelMeta(mod, level) {
    const missing = level > 0 ? [] : missingRequirements(mod.code);
    return `${codeButton(mod.code)} · ${levelReadout(level, capLabel(mod))}${missing.length ? ` · ${lockNote(missing)}` : ""}`;
  }

  function finishPaste(text) {
    const parsed = applyPaste(text);
    const message = document.getElementById("paste-msg");
    const ownedBox = document.getElementById("owned-only");
    if (ownedBox) ownedBox.checked = state.ownedOnly;
    if (message) message.textContent = pasteMessage(parsed);
    paintLevelList();
  }

  function pasteMessage(parsed) {
    if (!parsed.updates.length) {
      return "No rows matched. Copy the Name, Code, and Level columns, including the header.";
    }
    const owned = parsed.updates.filter((row) => row.level > 0).length;
    const skipped = parsed.skipped.length ? ` Skipped ${parsed.skipped.length} unmatched rows.` : "";
    return `Loaded ${parsed.updates.length} mods from the sheet. ${owned} are above level 0.${skipped}`;
  }

  function applyPaste(text) {
    const parsed = MTC.parseLevelPaste(text);
    if (!parsed.updates.length) return parsed;
    parsed.updates.forEach((row) => {
      if (row.level <= 0) delete state.levels[row.code];
      else state.levels[row.code] = row.level;
    });
    state.plan = null;
    state.checked = [];
    state.ownedOnly = true;
    saveState();
    return parsed;
  }

  function copyLevelsForSheet() {
    const lines = MTC.mods.map((mod) => mod.code + "\t" + (state.levels[mod.code] || 0));
    const button = document.getElementById("copy-levels");
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      if (button) button.textContent = "Copied";
    }).catch(() => {
      if (button) button.textContent = "Export failed";
    });
  }

  const MAP_SIZE = { w: 1212, h: 1106 };
  const MAP_BLOCKS = {
    A: [[412, 682], [548, 682], [548, 808], [607, 808], [607, 1104], [412, 1104]],
    B: [[548, 673], [893, 673], [893, 776], [607, 776], [607, 808], [548, 808]],
    C: [[136, 134], [547, 134], [547, 682], [412, 682], [412, 792], [204, 792], [204, 673],
      [364, 673], [364, 634], [412, 634], [412, 295], [136, 295]],
    D: [[680, 272], [1051, 272], [1051, 673], [639, 673], [639, 460], [680, 460]],
    E: [[2, 295], [412, 295], [412, 634], [364, 634], [364, 673], [2, 673]],
    F: [[136, 2], [680, 2], [680, 460], [639, 460], [639, 673], [547, 673], [547, 134], [136, 134]],
    G: [[2, 673], [204, 673], [204, 792], [412, 792], [412, 1104], [2, 1104]],
    H: [[607, 776], [783, 776], [783, 977], [1003, 977], [1003, 1104], [607, 1104]],
    I: [[1051, 272], [1210, 272], [1210, 1104], [1003, 1104], [1003, 977], [783, 977],
      [783, 776], [893, 776], [893, 673], [1051, 673]],
  };

  const MAP_NODES = [
    "A01:478,697 A02:431,723 A03:526,723 A04:478,749 A05:478,788 A06:478,828 A07:517,828 A08:557,828 A11:439,867 A09:478,867 A10:517,867 A12:478,906",
    "B01:573,696 B03:612,696 B04:652,696 B05:691,696 B06:730,696 B07:769,696 B08:809,696 B09:848,696 B02:573,749 B10:731,749 B11:770,749",
    "C8cb:165,173 C7cb:204,173 C6cb:243,173 C5cb:282,173 C4cb:321,173 C3cb:361,173 C2cb:400,173 C1cb:439,173 C8b:165,213 C7b:204,213 C6b:243,213 C5b:282,213 C4b:322,213 C3b:361,212 C2b:400,212 C1b:439,212 C09:478,212 C8ob:165,252 C7ob:204,252 C6ob:243,252 C5ob:282,252 C4ob:322,252 C3ob:361,251 C2ob:400,251 C1ob:440,252 C8o:439,499 C8u:478,499 C8c:517,499 C7o:439,539 C7u:478,539 C7c:517,539 C6o:439,578 C6u:478,578 C6c:517,578 C5o:439,617 C5u:478,617 C5c:517,617 C4o:439,657 C4u:478,657 C4c:517,656 C3o:268,696 C2o:308,696 C1o:347,696 C3c:269,735 C2c:308,735 C1c:347,735",
    "DU3:941,352 DGS:706,390 DU2:895,398 DU1:942,399 DGC:705,428 D1g:666,483 D2g:705,483 D3g:744,483 D4g:784,483 D5g:824,483 D6g:863,483 D7g:902,483 D8g:941,483 D1c:666,523 D2c:705,523 D3c:744,523 D4c:784,522 D5c:824,523 D6c:863,522 D7c:902,522 D8c:941,522 D1L:666,562 D2L:705,562 D3L:745,562 D4L:784,562 D5L:824,562 D6L:863,561 D7L:902,561 D8L:941,561 D1v:666,601 D2v:705,601 D3v:745,601 D4v:784,601 D5v:824,601 D6v:862,601 D7v:902,601 D8v:941,601",
    "E31:151,328 E30:308,327 E29:151,365 E28:190,365 E27:230,365 E26:308,365 EA7:348,365 EB7:387,365 E25:151,405 E24:190,405 E23:229,405 E22:308,405 EA6:348,404 EB6:387,405 E21:151,444 E20:190,444 E19:229,444 E18:308,444 EA5:347,443 EB5:387,443 E17:151,483 E16:190,483 E15:229,483 E14:308,483 EA4:348,484 EB4:387,484 E13:151,522 E12:190,522 E11:229,522 E10:308,522 EA3:347,522 EB3:387,522 E09:150,562 E08:190,562 E07:229,562 E06:308,562 EA2:347,562 EB2:387,562 EU2:25,601 EU1:72,601 E05:151,601 E04:190,601 E03:229,601 E02:269,601 E01:308,601 EA1:347,601 EB1:387,601",
    "FU3:613,22 FU2:566,70 FU1:612,70 FU4:659,68 F18:573,153 F17:612,153 F15:612,192 F16:651,192 F14:573,231 F13:612,231 F11:612,270 F12:652,270 F10:573,309 F09:612,309 F07:612,349 F08:651,349 F06:574,390 F05:613,390 F03:613,428 F04:652,428 F02:613,523 F01:613,601",
    "G02:135,696 G01:173,696 G05:135,821 G23:306,821 G06:95,860 G04:135,860 G03:174,860 G14:227,860 G18:266,860 G21:306,860 G07:135,900 G15:227,900 G19:267,900 G22:306,900 G16:227,939 G20:267,939 G11:135,955 G08:174,955 G17:227,978 GU1:40,995 G12:135,994 G09:174,994 G13:135,1034 G10:174,1034 G24:227,1034 G25:267,1034 G26:306,1034",
    "H02:652,791 H01:691,791 H03:730,791 H04:652,830 H09:691,830 H05:731,830 H06:652,869 H08:691,869 H07:730,869 H11:652,957 H10:691,957 H12:730,957 H14:652,997 H13:691,996 H15:730,996 H23:863,997 H25:902,997 H27:941,997 H17:652,1036 H16:691,1036 H18:730,1036 H22:862,1036 H30:902,1036 H29:941,1036 H20:652,1075 H19:691,1075 H21:730,1075 H24:863,1076 H26:901,1075 H28:941,1075",
    "IU2:1144,566 IU1:1144,613 IU3:1190,612 I01:941,697 I02:981,696 I03:1022,696 I04:1062,696 I05:1103,696 I06:1144,696 I07:1184,696 I08:942,749 I13:982,749 I18:1023,749 I19:1063,749 I26:1103,749 I28:1144,749 I32:1184,749 I09:942,790 I14:982,791 I20:1063,792 I27:1103,791 I29:1144,792 I10:942,831 I15:982,831 I21:1063,832 I30:1144,832 I11:942,873 I16:982,873 I22:1063,873 I31:1144,873 I12:942,914 I17:982,914 I23:1063,914 I24:1063,955 I25:1063,996",
  ].join(" ").split(" ").reduce((nodes, entry) => {
    const [code, xy] = entry.split(":");
    const [x, y] = xy.split(",").map(Number);
    nodes[code] = { x, y };
    return nodes;
  }, {});
  const MAP_BIG_NODES = new Set(["DU1", "EU2", "FU1", "IU1"]);

  function openMap(code) {
    state.tab = "map";
    state.mapQuery = code || state.mapQuery || "";
    saveState();
    paintTabs();
    render();
  }

  function findModByCode(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return null;
    if (MTC.MODEL.byCode[trimmed]) return MTC.MODEL.byCode[trimmed];
    const lower = trimmed.toLowerCase();
    return MTC.mods.find((mod) => mod.code.toLowerCase() === lower) || null;
  }

  function renderMap() {
    const letters = Object.keys(MAP_BLOCKS).sort();
    app.innerHTML = `
      <div class="map-layout">
        <aside class="panel side">
          <label class="field">
            <span>Find a code</span>
            <input id="map-query" type="text" placeholder="F03, C5u, D1L" value="${esc(state.mapQuery)}">
          </label>
          <p class="map-hit" id="map-hit"></p>
          <hr>
          <span class="label">Blocks</span>
          <div class="map-letters">
            ${letters.map((letter) => `<button type="button" class="block-btn" data-block="${letter}">${letter}</button>`).join("")}
          </div>
          <span class="label">Zoom</span>
          <div class="map-zoom">
            <button class="btn ghost" type="button" id="map-out" aria-label="Zoom out">−</button>
            <button class="btn ghost" type="button" id="map-in" aria-label="Zoom in">+</button>
          </div>
          <hr>
          <div class="map-legend">
            <span><i class="dot dot-max"></i>Maxed</span>
            <span><i class="dot dot-part"></i>Partly bought</span>
          </div>
          <p class="note small">Drag to move, scroll to zoom, and click a node to select it.</p>
        </aside>
        <div class="map-scroll" id="map-scroll">
          <div class="map-stage" id="map-stage">
            <img src="LoopModMap.png" alt="Loop mod map. Blocks A through I, with each node labeled by its code." draggable="false">
            <svg class="map-progress" id="map-progress" viewBox="0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}" preserveAspectRatio="none" aria-hidden="true"></svg>
            <div id="map-boxes"></div>
          </div>
        </div>
        <div class="map-tip" id="map-tip" hidden></div>
      </div>`;
    const query = document.getElementById("map-query");
    query.addEventListener("input", () => {
      state.mapQuery = query.value;
      saveState();
      paintMapHit(true);
    });
    document.getElementById("map-in").addEventListener("click", () => zoomMapBy(0.25));
    document.getElementById("map-out").addEventListener("click", () => zoomMapBy(-0.25));
    document.querySelectorAll("[data-block]").forEach((button) => {
      button.addEventListener("click", () => {
        state.mapQuery = button.dataset.block;
        query.value = state.mapQuery;
        saveState();
        paintMapHit(true);
      });
    });
    applyMapZoom();
    paintMapProgress();
    bindMapPointer();
    paintMapHit(true);
  }

  function paintMapProgress() {
    const layer = document.getElementById("map-progress");
    if (!layer) return;
    layer.innerHTML = Object.keys(MAP_NODES).map((code) => {
      const mod = MTC.MODEL.byCode[code];
      const level = state.levels[code] || 0;
      if (!mod || level <= 0) return "";
      const node = MAP_NODES[code];
      const big = MAP_BIG_NODES.has(code);
      const kind = isMaxed(mod, level) ? "max" : "part";
      return `<circle class="dot-${kind}" cx="${node.x + (big ? 18 : 12)}" cy="${node.y - (big ? 16 : 10)}" r="${big ? 6 : 5}"></circle>`;
    }).join("");
  }

  function mapNodeAt(clientX, clientY) {
    const stage = document.getElementById("map-stage");
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    const x = (clientX - rect.left) / state.mapZoom;
    const y = (clientY - rect.top) / state.mapZoom;
    let best = null;
    let bestDist = Infinity;
    Object.keys(MAP_NODES).forEach((code) => {
      const node = MAP_NODES[code];
      const reach = MAP_BIG_NODES.has(code) ? 24 : 17;
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist <= reach && dist < bestDist) {
        best = code;
        bestDist = dist;
      }
    });
    return best;
  }

  function paintMapTip(code, clientX, clientY) {
    const tip = document.getElementById("map-tip");
    if (!tip) return;
    const mod = code && MTC.MODEL.byCode[code];
    if (!mod) {
      tip.hidden = true;
      return;
    }
    const level = state.levels[code] || 0;
    tip.innerHTML = `<b>${esc(mod.code)}</b> ${esc(mod.name)}<span>Level <span class="lv">${level}</span> / ${capLabel(mod)}</span>`;
    tip.hidden = false;
    const width = tip.offsetWidth;
    const left = clientX + 16 + width > window.innerWidth ? clientX - 16 - width : clientX + 16;
    tip.style.left = Math.max(8, left) + "px";
    tip.style.top = (clientY + 16) + "px";
  }

  function applyMapZoom() {
    const stage = document.getElementById("map-stage");
    if (!stage) return;
    stage.style.width = Math.round(1212 * state.mapZoom) + "px";
    stage.style.height = Math.round(1106 * state.mapZoom) + "px";
  }

  function zoomMapBy(delta) {
    const scroller = document.getElementById("map-scroll");
    zoomMapAt(state.mapZoom + delta, scroller.scrollLeft + scroller.clientWidth / 2, scroller.scrollTop + scroller.clientHeight / 2);
  }

  function zoomMapAt(nextZoom, anchorX, anchorY) {
    const scroller = document.getElementById("map-scroll");
    const oldZoom = state.mapZoom || 1;
    const next = Math.min(3, Math.max(0.6, nextZoom));
    if (!scroller || next === oldZoom) {
      state.mapZoom = next;
      return;
    }
    const ratio = next / oldZoom;
    state.mapZoom = next;
    applyMapZoom();
    scroller.scrollLeft = anchorX * ratio - (anchorX - scroller.scrollLeft);
    scroller.scrollTop = anchorY * ratio - (anchorY - scroller.scrollTop);
    saveState();
  }

  function bindMapPointer() {
    const scroller = document.getElementById("map-scroll");
    let drag = null;
    scroller.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
      scroller.classList.add("is-dragging");
      try { scroller.setPointerCapture(event.pointerId); } catch (err) { /* pointer already released */ }
      event.preventDefault();
    });
    scroller.addEventListener("pointermove", (event) => {
      if (!drag) {
        const code = mapNodeAt(event.clientX, event.clientY);
        scroller.classList.toggle("is-over-node", !!code);
        paintMapTip(code, event.clientX, event.clientY);
        return;
      }
      if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 4) drag.moved = true;
      paintMapTip(null);
      scroller.scrollLeft = drag.left - (event.clientX - drag.x);
      scroller.scrollTop = drag.top - (event.clientY - drag.y);
    });
    scroller.addEventListener("pointerleave", () => paintMapTip(null));
    scroller.addEventListener("pointerup", (event) => {
      const wasClick = drag && !drag.moved;
      drag = null;
      scroller.classList.remove("is-dragging");
      if (!wasClick) return;
      const code = mapNodeAt(event.clientX, event.clientY);
      if (!code) return;
      state.mapQuery = code;
      saveState();
      const query = document.getElementById("map-query");
      if (query) query.value = code;
      paintMapHit(false);
    });
    scroller.addEventListener("pointercancel", () => {
      drag = null;
      scroller.classList.remove("is-dragging");
    });
    scroller.addEventListener("wheel", (event) => {
      event.preventDefault();
      paintMapTip(null);
      const rect = scroller.getBoundingClientRect();
      const anchorX = event.clientX - rect.left + scroller.scrollLeft;
      const anchorY = event.clientY - rect.top + scroller.scrollTop;
      let delta = event.deltaY;
      if (event.deltaMode === 1) delta *= 16;
      if (event.deltaMode === 2) delta *= scroller.clientHeight;
      zoomMapAt(state.mapZoom - delta * 0.0012, anchorX, anchorY);
    }, { passive: false });
  }

  function paintMapHit(shouldScroll) {
    const hit = document.getElementById("map-hit");
    const boxes = document.getElementById("map-boxes");
    if (!hit || !boxes) return;
    const text = state.mapQuery.trim();
    const mod = findModByCode(text);
    const letter = ((mod && mod.code) || text).charAt(0).toUpperCase();
    const points = MAP_BLOCKS[letter];
    document.querySelectorAll("[data-block]").forEach((button) => {
      button.classList.toggle("is-on", !!points && button.dataset.block === letter);
    });
    if (!text || !points) {
      boxes.innerHTML = "";
      hit.innerHTML = text
        ? `<span class="hit-status">Codes start with a block letter from A to I.</span>`
        : `<span class="hit-status">Type a code, or pick a block below.</span>`;
      return;
    }
    const node = mod && MAP_NODES[mod.code];
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const focusX = node ? node.x : (Math.min(...xs) + Math.max(...xs)) / 2;
    const focusY = node ? node.y : (Math.min(...ys) + Math.max(...ys)) / 2;
    const radius = node && MAP_BIG_NODES.has(mod.code) ? 30 : 22;
    boxes.innerHTML = `<svg class="map-outline" viewBox="0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}" preserveAspectRatio="none">
        <polygon points="${points.map((p) => p.join(",")).join(" ")}"></polygon>
        ${node ? `<circle class="map-node" cx="${node.x}" cy="${node.y}" r="${radius}"></circle>` : ""}
      </svg>`;
    if (!mod) {
      hit.innerHTML = `<b class="hit-code">Block ${letter}</b><span class="hit-status">Outlined on the map.</span>`;
    } else {
      const level = state.levels[mod.code] || 0;
      hit.innerHTML = `<b class="hit-code">${esc(mod.code)}</b>
        <span class="hit-name">${esc(mod.name)}</span>
        <span class="hit-status">Block ${letter} · level <span class="lv">${level}</span> / ${capLabel(mod)}</span>
        ${level > 0 ? "" : (missing => missing.length ? `<span class="hit-status">${lockNote(missing)}</span>` : "")(missingRequirements(mod.code))}
        ${node ? "" : `<span class="hit-status warn">This map image doesn't show this node, so only its block is outlined.</span>`}`;
    }
    if (shouldScroll) {
      const scroller = document.getElementById("map-scroll");
      scroller.scrollLeft = focusX * state.mapZoom - scroller.clientWidth / 2;
      scroller.scrollTop = focusY * state.mapZoom - scroller.clientHeight / 2;
    }
  }

  function renderSettings() {
    const p = state.progress;
    const weightFields = [
      ["cells", "Cells"], ["mp", "Mod points"], ["shards", "Shards"], ["research", "Research"],
      ["ap", "Academy"], ["mats", "Materials"], ["cr", "Cost reduction"], ["rp", "Rank points"],
    ];
    const ships = [
      ["cra", "Cradle"], ["aux", "Auxesia"], ["zag", "Zagreus"], ["hep", "Hephaestus"],
      ["dem", "Demeter"], ["koi", "Koios"], ["zeu", "Zeus"],
    ];
    const scalars = [
      ["level", "Player level"], ["loops", "Loops filled"], ["resets", "Loop resets"],
      ["ops", "Operations done"], ["studies", "Studies done"], ["tickspeed", "Shard tickspeed"],
      ["equipment", "Equipment bought"], ["levels", "Total research levels"],
      ["researches", "Completed researches"], ["swTech", "Software tech"],
    ];
    const manuals = [
      ["mk1", "Manual MK1"], ["mk2", "Manual MK2"], ["mk3", "Manual MK3"], ["mk4", "Manual MK4"],
      ["mk5", "Manual MK5"], ["mk6", "Manual MK6"], ["mk7", "Manual MK7"], ["mk8", "Manual MK8"],
    ];
    app.innerHTML = `
      <div class="settings-layout settings">
        <section class="panel">
          <p class="note">These match the ModValues tab of the sheet. The default weights are the sheet's recommended values. Leaving run stats at 0 still gives a sensible order.</p>
          <div class="ci-row">
            <span>Cost importance <b id="ci-label">${p.ci}</b></span>
            <input id="ci" class="slider" type="range" min="0" max="100" value="${p.ci}">
          </div>
          <p class="note">Higher cost importance favors cheaper mods when two bonuses are close.</p>
          <h3>Weights</h3>
          <div class="dense" id="weights"></div>
          <h3>Run stats</h3>
          <div class="dense" id="scalars"></div>
          <h3>Manual generators</h3>
          <p class="note">These eight counts are added together. That total raises the cell bonus of Accumulative Level Growth Alpha, Delta, and Rule of the Swarm.</p>
          <div class="dense" id="manuals"></div>
        </section>
        <section class="panel">
          <h3 class="first">Ship rank and crew</h3>
          <div class="ship-grid" id="ships"></div>
          <div class="toolbar">
            <button class="btn ghost" id="reset-progress" type="button">Reset these inputs</button>
          </div>
        </section>
      </div>`;
    document.getElementById("weights").innerHTML = weightFields.map(([key, label]) => field(label, `w-${key}`, p.weights[key])).join("");
    document.getElementById("scalars").innerHTML = scalars.map(([key, label]) => statField(label, `s-${key}`, p[key])).join("")
      + doublerField(p.doubler);
    document.getElementById("manuals").innerHTML = manuals.map(([key, label]) => statField(label, `m-${key}`, p.manual[key])).join("");
    document.getElementById("ships").innerHTML = `
      <div class="ship-head"><span></span><span>Rank</span><span>Crew</span></div>
    ` + ships.map(([key, label]) => `
      <div class="ship ship-${key}">
        <span>${esc(label)}</span>
        <input id="r-${key}" type="number" step="any" value="${esc(p.rank[key])}" aria-label="${esc(label)} rank">
        <input id="c-${key}" type="number" step="any" value="${esc(p.crew[key])}" aria-label="${esc(label)} crew">
      </div>`).join("");
    document.getElementById("ci").addEventListener("input", (event) => {
      p.ci = Number(event.target.value);
      document.getElementById("ci-label").textContent = String(p.ci);
      state.plan = null;
      saveState();
    });
    bindNumbers("w-", (key, value) => { p.weights[key] = value; });
    bindCounts("s-", (key, value) => { p[key] = value; });
    bindCounts("m-", (key, value) => { p.manual[key] = value; });
    bindNumbers("r-", (key, value) => { p.rank[key] = value; });
    bindNumbers("c-", (key, value) => { p.crew[key] = value; });
    document.getElementById("reset-progress").addEventListener("click", () => {
      const keep = { affordOnly: p.affordOnly, unlockedOnly: p.unlockedOnly };
      state.progress = Object.assign(MTC.defaultProgress(), keep);
      state.plan = null;
      saveState();
      renderSettings();
    });
  }

  function field(label, id, value) {
    return `<label class="field" title="${esc(label)}"><span>${esc(label)}</span><input id="${id}" type="number" step="any" value="${esc(value)}"></label>`;
  }

  function statField(label, id, value) {
    return `<label class="field" title="${esc(label)}"><span>${esc(label)}</span><input id="${id}" type="text" inputmode="decimal" value="${esc(MTC.formatCount(value))}"></label>`;
  }

  function doublerField(value) {
    return `<label class="field doubler" title="LP doubler bar"><span>LP doubler bar</span><span class="doubler-val"><input id="s-doubler" type="text" inputmode="decimal" value="${esc(MTC.formatCount(value))}"><span class="doubler-max">/10</span></span></label>`;
  }

  function bindCounts(prefix, assign) {
    document.querySelectorAll(`[id^="${prefix}"]`).forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.id.slice(prefix.length);
        const raw = key === "doubler" ? String(input.value).split("/")[0] : input.value;
        const value = MTC.parseCount(raw);
        if (value == null) {
          const current = prefix === "m-" ? state.progress.manual[key] : state.progress[key];
          input.value = MTC.formatCount(current || 0);
          return;
        }
        assign(key, value);
        input.value = MTC.formatCount(value);
        state.plan = null;
        saveState();
      });
    });
  }

  function bindNumbers(prefix, assign) {
    document.querySelectorAll(`[id^="${prefix}"]`).forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.id.slice(prefix.length);
        const value = Number(input.value);
        assign(key, Number.isFinite(value) ? value : 0);
        state.plan = null;
        saveState();
      });
    });
  }

  function requirementCodes(code) {
    const mod = MTC.MODEL.byCode[code];
    if (!mod || !mod.unlock) return [];
    return mod.unlock.split(",").map((part) => part.trim()).filter(Boolean);
  }

  function missingRequirements(code) {
    return requirementCodes(code).filter((req) => !(state.levels[req] > 0));
  }

  function lockNote(codes) {
    if (!codes.length) return "";
    return `<span class="lock">needs ${codes.map(codeButton).join(" and ")}</span>`;
  }

  function formatCost(log) {
    if (state.costStyle !== "sci") return MTC.formatLog(log);
    if (log === -Infinity || !Number.isFinite(log)) return "0";
    if (log < 0) {
      const value = Math.pow(10, log);
      if (value >= 0.01) return value.toFixed(2);
      return value.toExponential(2).replace("e+", "e");
    }
    let exp = Math.floor(log);
    let mantissa = Math.pow(10, log - exp);
    if (mantissa >= 9.995) {
      mantissa = 1;
      exp += 1;
    }
    return mantissa.toFixed(2) + "e" + exp;
  }

  function mpAmount(log) {
    return `<span class="mp"><img src="ModPoints.png" alt="MP" title="Mod points">${esc(formatCost(log))}</span>`;
  }

  function codeButton(code) {
    return `<button type="button" class="code-link" data-map="${esc(code)}">${esc(code)}</button>`;
  }

  function levelRange(from, to) {
    return `<span class="lv"><b>${from}</b> → <b>${to}</b></span>`;
  }

  function levelReadout(level, cap) {
    return `<span class="lv"><b>${level}</b> / ${esc(cap)}</span>`;
  }

  function isCapped(mod) {
    return mod.max < 99999;
  }

  function isMaxed(mod, level) {
    return isCapped(mod) && level >= mod.max;
  }

  function capLabel(mod) {
    return isCapped(mod) ? String(mod.max) : "No limit";
  }

  function levelFill(mod, level) {
    if (!isCapped(mod) || mod.max <= 0) return 0;
    return Math.max(0, Math.min(100, (level / mod.max) * 100));
  }

  function completionStats() {
    const total = MTC.mods.length;
    let maxed = 0;
    MTC.mods.forEach((mod) => {
      if (isMaxed(mod, state.levels[mod.code] || 0)) maxed += 1;
    });
    return { total, maxed, notMaxed: total - maxed, pct: total ? (maxed / total) * 100 : 0 };
  }

  function completionHtml() {
    const stats = completionStats();
    return `<div class="completion" id="completion">
      <div class="completion-top">
        <strong data-not>${stats.notMaxed} out of ${stats.total} not maxed</strong>
        <span data-done>${stats.pct.toFixed(1)}% complete</span>
      </div>
      <div class="completion-track" role="meter" aria-label="Mods at max level" aria-valuemin="0" aria-valuemax="${stats.total}" aria-valuenow="${stats.maxed}">
        <div class="completion-fill" style="width:${stats.pct}%"></div>
      </div>
    </div>`;
  }

  function paintCompletion() {
    const root = document.getElementById("completion");
    if (!root) return;
    const stats = completionStats();
    root.querySelector("[data-not]").textContent = `${stats.notMaxed} out of ${stats.total} not maxed`;
    root.querySelector("[data-done]").textContent = `${stats.pct.toFixed(1)}% complete`;
    root.querySelector(".completion-fill").style.width = `${stats.pct}%`;
    const track = root.querySelector(".completion-track");
    track.setAttribute("aria-valuenow", String(stats.maxed));
    track.setAttribute("aria-valuemax", String(stats.total));
  }

  function paintModRow(row, mod, level) {
    if (!row) return;
    const maxed = isMaxed(mod, level);
    row.classList.toggle("is-maxed", maxed);
    const title = row.querySelector(".title-line");
    const badge = title.querySelector(".badge");
    if (maxed && !badge) title.insertAdjacentHTML("beforeend", `<span class="badge">MAXED</span>`);
    if (!maxed && badge) badge.remove();
    const meta = row.querySelector("[data-meta]");
    if (meta) meta.innerHTML = levelMeta(mod, level);
    const fill = row.querySelector("[data-fill]");
    if (fill) fill.style.width = `${levelFill(mod, level)}%`;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  paintTabs();
  render();
})();
