(function () {
  const STORAGE_KEY = "cifi-mtc-planner-v1";
  const app = document.getElementById("app");
  const tabs = document.querySelectorAll(".tab");

  const state = loadState();
  let revealNext = false;
  applyTheme();
  applyCostStyle();
  applyDensity();
  applyMiniMap();
  applyEffects();
  selectEditableOnClick();
  bindConfig();
  bindDataActions();

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
    if (el.id === "paste") return false;
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
      orderQuery: "",
      orderBlock: "",
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
      miniMap: true,
      miniMapPlace: "side",
      showEffectOrder: false,
      showEffectLevels: false,
      showEffectMap: true,
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
      orderQuery: state.orderQuery,
      orderBlock: state.orderBlock,
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
      miniMap: state.miniMap,
      miniMapPlace: state.miniMapPlace,
      showEffectOrder: state.showEffectOrder,
      showEffectLevels: state.showEffectLevels,
      showEffectMap: state.showEffectMap,
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

  function miniMapEnabled() {
    return state.miniMap !== false;
  }

  function applyMiniMap() {
    state.miniMap = state.miniMap !== false;
    state.miniMapPlace = state.miniMapPlace === "side" ? "side" : "card";
    const box = document.getElementById("show-minimap");
    if (box) box.checked = state.miniMap;
    const group = document.getElementById("minimap-place");
    if (group) {
      group.classList.toggle("is-off", !state.miniMap);
      group.setAttribute("aria-disabled", state.miniMap ? "false" : "true");
    }
    document.querySelectorAll("[data-map-place]").forEach((button) => {
      const on = button.dataset.mapPlace === state.miniMapPlace;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-checked", on ? "true" : "false");
    });
    document.body.dataset.minimap = state.miniMap ? state.miniMapPlace : "off";
  }

  function effectPlaceOn(place) {
    if (place === "order") return !!state.showEffectOrder;
    if (place === "levels") return !!state.showEffectLevels;
    return state.showEffectMap !== false;
  }

  function applyEffects() {
    state.showEffectOrder = !!state.showEffectOrder;
    state.showEffectLevels = !!state.showEffectLevels;
    state.showEffectMap = state.showEffectMap !== false;
    const order = document.getElementById("effects-order");
    const levels = document.getElementById("effects-levels");
    const map = document.getElementById("effects-map");
    if (order) order.checked = state.showEffectOrder;
    if (levels) levels.checked = state.showEffectLevels;
    if (map) map.checked = state.showEffectMap;
  }

  function modEffect(code) {
    const text = window.MTC_EFFECTS && MTC_EFFECTS[code];
    return text || "";
  }

  function effectHtml(code, place) {
    if (!effectPlaceOn(place)) return "";
    const text = modEffect(code);
    if (!text) return "";
    return `<span class="effect" title="${esc(text)}">${esc(text)}</span>`;
  }

  function bindEffectToggle(id, place, refresh) {
    const box = document.getElementById(id);
    if (!box) return;
    box.addEventListener("change", () => {
      if (place === "order") state.showEffectOrder = box.checked;
      else if (place === "levels") state.showEffectLevels = box.checked;
      else state.showEffectMap = box.checked;
      applyEffects();
      saveState();
      refresh();
    });
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
      if (cost) {
        state.costStyle = cost.dataset.costPick;
        applyCostStyle();
        saveState();
        render();
        return;
      }
      const place = event.target.closest("[data-map-place]");
      if (!place || !miniMapEnabled()) return;
      state.miniMapPlace = place.dataset.mapPlace === "side" ? "side" : "card";
      applyMiniMap();
      saveState();
      if (state.tab === "plan") paintResults();
    });
    menu.addEventListener("change", (event) => {
      if (event.target.id === "compact-lists") {
        state.compact = event.target.checked;
        applyDensity();
        saveState();
        return;
      }
      if (event.target.id === "effects-order" || event.target.id === "effects-levels" || event.target.id === "effects-map") {
        state.showEffectOrder = document.getElementById("effects-order").checked;
        state.showEffectLevels = document.getElementById("effects-levels").checked;
        state.showEffectMap = document.getElementById("effects-map").checked;
        applyEffects();
        saveState();
        const place = event.target.id === "effects-order" ? "plan" : event.target.id === "effects-levels" ? "levels" : "map";
        if (state.tab === place) render();
        return;
      }
      if (event.target.id !== "show-minimap") return;
      state.miniMap = event.target.checked;
      applyMiniMap();
      saveState();
      if (state.tab === "plan") paintResults();
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".config")) setConfigOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setConfigOpen(false);
    });
  }

  function bindDataActions() {
    const file = document.getElementById("backup-file");
    if (file) {
      file.addEventListener("change", (event) => {
        const chosen = event.target.files && event.target.files[0];
        if (chosen) loadBackup(chosen);
        event.target.value = "";
      });
    }
    const save = document.getElementById("config-backup-save");
    const load = document.getElementById("config-backup-load");
    const wipe = document.getElementById("config-delete-data");
    if (save) save.addEventListener("click", downloadBackup);
    if (load) load.addEventListener("click", () => file && file.click());
    if (wipe) wipe.addEventListener("click", deleteAllData);
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
          <p class="kicker">A Fan-made tool for efficient progression · Pre-Ouro only</p>
          <h1>Mod Points Planner</h1>
          <span>Based on the <a href="${esc(MTC.DATA.source)}" target="_blank" rel="noopener">original Mod Tree Cultivator</a> sheet by TSoD and SomeGaiden. TSoD currently maintains it. It scores loop mods the same way the sheet's [Buy Now!] checkbox does, but turns the MP from one loop reset into a full buy order at once.<br><br>All the good stuff, like the calculations logic and the loop mod map, belongs to the sheet's authors and contributors. So any bugs might be my fault, not theirs.</span>
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
              <li>"Export to clipboard" copies Code and Level. I'm still working on a way to sync back to the sheet.</li>
              <li>Loop mod map by TSoD, from the original sheet.</li>
              <li>What a mod does is summarized from the <a href="https://cifi.fandom.com/wiki/Loop_Modifications" target="_blank" rel="noopener">CIFI wiki</a>, with a few being hand-written as the wiki is missing updates.</li>
              <li>This is a fan-made tool and not affiliated with CIFI, Octocube Games, or the developers of the sheet. Made by <a href="https://github.com/leosans-eng" target="_blank" rel="noopener">leosans-eng</a>.</li>
              <li>You can report bugs or suggest features <a href="https://github.com/leosans-eng/cifi-mod-points-planner/issues" target="_blank" rel="noopener">here</a> or send it to me on Discord (LeoSans).</li>
              <li>The sheet was made by <span class="credit-name">TSoD</span> (tsod76) and <span class="credit-name">SomeGaiden</span> (SomeGaiden#3989), along with its other contributors. <span class="credit-name">TSoD</span> is the current maintainer.</li>
              <li>Amazing people that helped create the sheet with Testing, Data and Advice: <span class="credit-names">Chrysto, AXZIOM, Beef, CFlare, Feii, PurpleVortex, Theorizon, TSoD76, Vyrock, Ylith, and InsaneChemist#2382.</span></li>
            </ul>
          </section>
        </section>

        <aside class="home-side">
          <section class="card">
            <h2 class="card-title">Your progress</h2>
            ${completionHtml()}
            <dl class="facts">
              <div><dt>Total mod level</dt><dd>${totalModLevel()}</dd></div>
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
            <button type="button" class="btn ghost danger wide" id="backup-delete">Delete all data</button>
            <p class="note small" id="backup-msg"></p>
          </section>
        </aside>
      </div>`;
    paintRunHistory();
    document.getElementById("backup-save").addEventListener("click", downloadBackup);
    document.getElementById("backup-load").addEventListener("click", () => document.getElementById("backup-file").click());
    document.getElementById("backup-delete").addEventListener("click", deleteAllData);
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

  function deleteAllData() {
    if (!confirm("Delete every level, setting, and run saved in this browser?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
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
            <label><input id="effects-order-side" type="checkbox" ${state.showEffectOrder ? "checked" : ""}> Show what each mod does</label>
          </div>
          <hr>
          ${owned === 0 ? `<p class="warn small">Every mod is still level 0. Open <a href="#" data-go="levels">Owned levels</a> and enter what you already bought, or this list starts from a fresh tree.</p>` : `<p class="note small">${owned} mods have a saved level. The order starts from those.</p>`}
          ${completionHtml()}
          <div id="plan-minimap" class="plan-minimap" hidden></div>
        </aside>
        <section class="panel main" id="results"></section>
      </div>`;
    const mpInput = document.getElementById("mp");
    dotsForCommas(mpInput);
    mpInput.addEventListener("input", (event) => {
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
    bindEffectToggle("effects-order-side", "order", paintResults);
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
      paintSideMiniMap(null);
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
      paintSideMiniMap(null);
      return;
    }
    if (!plan.groups.length) {
      results.innerHTML = `<div class="empty">
        <h2>Nothing to buy</h2>
        <p>This MP can't afford any eligible level. Raise the amount, check your owned levels, or turn off “Only unlocked mods”.</p>
      </div>${nextGoalHtml(plan.nextGoal)}`;
      paintSideMiniMap(null);
      return;
    }
    const bought = state.checked.filter(Boolean).length;
    const nextIndex = state.checked.findIndex((flag) => !flag);
    const next = nextIndex === -1 ? null : plan.groups[nextIndex];
    const spentThrough = nextIndex === 0 ? null : plan.groups[Math.max(0, (nextIndex === -1 ? plan.groups.length : nextIndex) - 1)];
    const leftLog = spentThrough ? spentThrough.endLogMp : plan.startLog;
    const mapInCard = !!(next && miniMapEnabled() && state.miniMapPlace !== "side");
    results.innerHTML = `
      <div class="stats">
        <div class="stat"><b>${plan.steps.toLocaleString()}</b><span>levels to buy</span></div>
        <div class="stat"><b>${plan.summary.length}</b><span>different mods</span></div>
        <div class="stat"><b>${mpAmount(leftLog)}</b><span>Still unspent${bought ? " after checked rows" : ""}</span></div>
        <div class="stat"><b>${plan.ms} ms</b><span>to calculate</span></div>
      </div>
      ${plan.stopped ? `<p class="warn">Stopped early so the page stayed responsive. Plan again after marking some of these bought, or with a smaller MP.</p>` : ""}
      <article class="next">
        <div class="next-copy">
          <p class="meta">Next purchase</p>
          <h2>${next ? esc(next.name) : "List complete"}</h2>
          ${next ? effectHtml(next.code, "order") : ""}
          <p>${next ? `${codeButton(next.code)} · ${levelRange(next.from, next.to)} · ${mpAmount(next.costLog)}` : "Every row in this order is checked."}</p>
        </div>
        <div class="next-side">
          ${mapInCard ? miniMapHtml(next.code) : ""}
          <button class="btn" id="mark-next" type="button" ${next ? "" : "disabled"}>Mark bought</button>
        </div>
      </article>
      <div class="toolbar">
        <button class="btn ghost${state.orderMode === "totals" ? "" : " is-on"}" type="button" id="mode-order" aria-pressed="${state.orderMode === "totals" ? "false" : "true"}">Buy order</button>
        <button class="btn ghost${state.orderMode === "totals" ? " is-on" : ""}" type="button" id="mode-totals" aria-pressed="${state.orderMode === "totals" ? "true" : "false"}">Totals per mod</button>
        <button class="btn ghost" type="button" id="copy-list">Copy list</button>
        <button class="btn ghost" type="button" id="clear-checks">Clear checks</button>
      </div>
      ${buyListHead()}
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
    const buySearch = document.getElementById("buy-search");
    buySearch.addEventListener("input", () => {
      state.orderQuery = buySearch.value;
      saveState();
      paintBuyList();
    });
    document.querySelectorAll("[data-buy-block]").forEach((button) => {
      button.addEventListener("click", () => {
        state.orderBlock = button.dataset.buyBlock;
        saveState();
        document.querySelectorAll("[data-buy-block]").forEach((other) => other.classList.toggle("is-on", other === button));
        paintBuyList();
      });
    });
    document.getElementById("copy-list").addEventListener("click", copyList);
    document.getElementById("clear-checks").addEventListener("click", () => {
      if (!confirm("Clear every check and put levels back to how they were when you built this order?")) return;
      state.checked = plan.groups.map(() => false);
      state.levels = Object.assign({}, state.levelsAtPlan || {});
      saveState();
      paintResults();
    });
    paintBuyList();
    paintCompletion();
    paintSideMiniMap(next && miniMapEnabled() && state.miniMapPlace === "side" ? next.code : null);
  }

  function buyListHead() {
    const letters = ["", "A", "B", "C", "D", "E", "F", "G", "H", "I"];
    const block = state.orderBlock || "";
    return `<div class="list-head">
      <input id="buy-search" type="text" placeholder="Search name, code, or effect" value="${esc(state.orderQuery || "")}">
      <div class="seg" role="group" aria-label="Block">
        ${letters.map((letter) => `<button type="button" data-buy-block="${letter}" class="${block === letter ? "is-on" : ""}">${letter || "All"}</button>`).join("")}
      </div>
    </div>
    <p class="note small" id="buy-count" hidden></p>`;
  }

  function buyRowMatches(row) {
    const block = state.orderBlock || "";
    if (block && String(row.code || "").charAt(0).toUpperCase() !== block) return false;
    const query = String(state.orderQuery || "").trim().toLowerCase();
    if (!query) return true;
    const name = String(row.name || "").toLowerCase();
    const shortName = String(row.shortName || "").toLowerCase();
    const code = String(row.code || "").toLowerCase();
    const effect = modEffect(row.code).toLowerCase();
    return name.includes(query) || shortName.includes(query) || code.includes(query) || effect.includes(query);
  }

  function paintBuyList() {
    const list = document.getElementById("buy-list");
    const plan = state.plan;
    if (!list || !plan) return;
    const nextIndex = state.checked.findIndex((flag) => !flag);
    const source = state.orderMode === "totals" ? plan.summary : plan.groups;
    const rows = source.map((row, index) => ({ row, index })).filter(({ row }) => buyRowMatches(row));
    const count = document.getElementById("buy-count");
    if (count) {
      const filtered = !!(String(state.orderQuery || "").trim() || state.orderBlock);
      count.hidden = !filtered;
      count.textContent = filtered ? `Showing ${rows.length} of ${source.length} rows` : "";
    }
    if (!rows.length) {
      list.innerHTML = `<p class="note small">No rows match this search.</p>`;
      return;
    }
    if (state.orderMode === "totals") {
      list.innerHTML = rows.map(({ row, index }) => rowHtml({
        index,
        code: row.code,
        title: row.name,
        detailHtml: `${levelRange(row.from, row.to)} · ${row.count} levels · ${codeButton(row.code)}`,
        cost: row.costLog,
        extraHtml: "",
        unlocked: row.unlocked,
        done: false,
        next: false,
        checkable: false,
      })).join("");
      return;
    }
    list.innerHTML = rows.map(({ row, index }) => rowHtml({
      index,
      code: row.code,
      title: row.name,
      detailHtml: `${levelRange(row.from, row.to)}${row.count > 1 ? ` · ${row.count} in a row` : ""} · ${codeButton(row.code)}`,
      cost: row.costLog,
      extraHtml: `left ${mpAmount(row.endLogMp)}`,
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

  function paintSideMiniMap(code) {
    const slot = document.getElementById("plan-minimap");
    if (!slot) return;
    const side = slot.closest(".side");
    if (!code) {
      slot.hidden = true;
      slot.innerHTML = "";
      if (side) side.classList.remove("has-minimap");
      return;
    }
    slot.hidden = false;
    slot.innerHTML = miniMapHtml(code);
    if (side) side.classList.add("has-minimap");
  }

  function nextGoalHtml(goal) {
    if (!goal) return "";
    return `<article class="goal">
      <p class="meta">Next upgrade after MP runs out</p>
      <strong>${esc(goal.name)}</strong>
      ${effectHtml(goal.code, "order")}
      <span class="meta">${codeButton(goal.code)} · ${levelRange(goal.from, goal.to)} · costs ${mpAmount(goal.costLog)}${goal.shortLog != null ? ` · about ${mpAmount(goal.shortLog)} more than you have left` : ""}${goal.unlocked ? "" : ` · ${lockNote(requirementCodes(goal.code))}`}</span>
      ${goalEstimate(goal)}
    </article>`;
  }

  function rowHtml(row) {
    return `<label class="buy${row.checkable ? " is-check" : ""}${row.done ? " is-done" : ""}${row.next ? " is-next" : ""}">
      <span class="buy-n">${row.index + 1}</span>
      ${row.checkable ? `<input type="checkbox" data-i="${row.index}" ${row.done ? "checked" : ""}>` : ""}
      <span>
        <strong>${esc(row.title)}</strong>
        ${effectHtml(row.code, "order")}
        <span class="meta">${row.detailHtml}${row.unlocked ? "" : ` · ${lockNote(requirementCodes(row.code))}`}</span>
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
          <div class="checks stack">
            <label><input id="effects-levels-side" type="checkbox" ${state.showEffectLevels ? "checked" : ""}> Show what each mod does</label>
          </div>
          <hr>
          ${completionHtml()}
          <button class="btn ghost danger wide" id="reset-levels" type="button">Reset all levels</button>
        </aside>
        <section class="panel main">
          <div class="list-head">
            <input id="level-search" type="text" placeholder="Search name, code, or effect" value="${esc(state.levelQuery)}">
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
    bindEffectToggle("effects-levels-side", "levels", paintLevelList);
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
      return mod.name.toLowerCase().includes(query) || mod.shortName.toLowerCase().includes(query) || mod.code.toLowerCase().includes(query) || modEffect(mod.code).toLowerCase().includes(query);
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
          ${effectHtml(mod.code, "levels")}
          <span class="meta" data-meta>${levelMeta(mod, owned)}</span>
          ${isCapped(mod) ? `<span class="meter" aria-hidden="true"><span data-fill style="width:${levelFill(mod, owned)}%"></span></span>` : ""}
        </span>
        <input type="text" inputmode="numeric" data-level="${esc(mod.code)}" value="${owned}" aria-label="${esc(mod.code)} level">
      </div>`;
    }).join("");
    list.querySelectorAll("[data-level]").forEach((input) => {
      dotsForCommas(input);
      input.addEventListener("change", () => {
        const code = input.dataset.level;
        const mod = MTC.MODEL.byCode[code];
        let value = Math.floor(Number(String(input.value).replace(/,/g, ".")));
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

  const MAP_IMAGE = "UpdatedGameMap.png";
  const MAP_SIZE = { w: 1840, h: 1614 };
  const MAP_BLOCKS = {
    A: [[[676,999],[736,999],[736,1094],[832,1094],[832,1154],[784,1154],[784,1250],[676,1250],[676,1202],[628,1202],[628,1142],[676,1142]], [[682,852],[731,852],[731,853],[732,853],[732,854],[733,854],[733,855],[734,855],[734,856],[735,856],[735,857],[736,857],[736,880],[843,880],[843,940],[734,940],[734,906],[676,906],[676,858],[677,858],[677,857],[678,857],[678,856],[679,856],[679,855],[680,855],[680,854],[681,854],[681,853],[682,853]]],
    B: [[[878,846],[1274,846],[1274,906],[878,906]], [[1069,911],[1178,911],[1178,971],[1129,971],[1129,970],[1128,970],[1128,969],[1127,969],[1127,968],[1126,968],[1126,967],[1124,967],[1124,966],[1100,966],[1100,967],[1076,967],[1076,966],[1075,966],[1075,965],[1074,965],[1074,964],[1073,964],[1073,963],[1072,963],[1072,962],[1071,962],[1071,961],[1069,961]], [[878,911],[938,911],[938,971],[878,971]]],
    C: [[[295,211],[688,211],[688,259],[736,259],[736,319],[689,319],[689,367],[295,367]], [[629,608],[785,608],[785,763],[784,763],[784,858],[736,858],[736,857],[735,857],[735,856],[734,856],[734,855],[733,855],[733,854],[732,854],[732,853],[731,853],[731,852],[682,852],[682,853],[681,853],[681,854],[680,854],[680,855],[679,855],[679,856],[678,856],[678,857],[677,857],[677,858],[628,858],[628,751],[629,751]], [[331,846],[487,846],[487,954],[338,954],[338,906],[331,906]]],
    D: [[[1230,588],[1386,588],[1386,791],[992,791],[992,589],[1230,589]], [[1325,429],[1385,429],[1385,480],[1392,480],[1392,556],[1320,556],[1320,545],[1270,545],[1270,485],[1320,485],[1320,480],[1325,480]], [[1039,473],[1099,473],[1099,581],[1039,581]]],
    E: [[[188,398],[248,398],[248,445],[344,445],[344,731],[379,731],[379,493],[380,493],[380,458],[379,458],[379,398],[439,398],[439,445],[535,445],[535,791],[188,791],[188,744],[187,744],[187,684],[188,684]], [[30,726],[102,726],[102,731],[152,731],[152,791],[102,791],[102,802],[30,802]]],
    F: [[[878,187],[986,187],[986,235],[1034,235],[1034,295],[986,295],[986,330],[1034,330],[1034,390],[986,390],[986,425],[1034,425],[1034,485],[986,485],[986,521],[1034,521],[1034,581],[926,581],[926,533],[878,533],[878,473],[926,473],[926,438],[878,438],[878,378],[926,378],[926,342],[878,342],[878,282],[926,282],[926,247],[878,247]], [[926,28],[986,28],[986,77],[992,77],[992,84],[1043,84],[1043,144],[992,144],[992,153],[920,153],[920,144],[877,144],[877,84],[920,84],[920,77],[926,77]], [[926,731],[986,731],[986,791],[926,791]], [[926,636],[986,636],[986,696],[926,696]]],
    G: [[[376,1043],[436,1043],[436,1198],[389,1198],[389,1246],[341,1246],[341,1294],[281,1294],[281,1091],[376,1091]], [[169,1206],[276,1206],[276,1361],[169,1361]], [[169,1043],[229,1043],[229,1091],[276,1091],[276,1151],[229,1151],[229,1198],[169,1198],[169,1151],[121,1151],[121,1091],[169,1091]], [[281,1301],[436,1301],[436,1361],[281,1361]], [[121,846],[276,846],[276,906],[121,906]], [[54,1254],[114,1254],[114,1314],[54,1314]]],
    H: [[[974,1164],[1130,1164],[1130,1368],[974,1368]], [[1327,1212],[1387,1212],[1387,1272],[1386,1272],[1386,1368],[1290,1368],[1290,1369],[1230,1369],[1230,1213],[1327,1213]], [[974,961],[1071,961],[1071,962],[1072,962],[1072,963],[1073,963],[1073,964],[1074,964],[1074,965],[1075,965],[1075,966],[1076,966],[1076,967],[1100,967],[1100,966],[1124,966],[1124,967],[1126,967],[1126,968],[1127,968],[1127,969],[1128,969],[1128,970],[1129,970],[1129,971],[1130,971],[1130,1117],[974,1117]]],
    I: [[[1347,911],[1701,911],[1701,971],[1652,971],[1652,1122],[1592,1122],[1592,1022],[1554,1022],[1554,1272],[1494,1272],[1494,971],[1456,971],[1456,1172],[1347,1172]], [[1396,846],[1505,846],[1505,847],[1701,847],[1701,907],[1494,907],[1494,906],[1406,906],[1406,907],[1346,907],[1346,847],[1396,847]], [[1544,426],[1795,426],[1795,486],[1544,486]], [[1592,689],[1652,689],[1652,731],[1658,731],[1658,744],[1709,744],[1709,804],[1658,804],[1658,807],[1586,807],[1586,731],[1592,731]]],
  };

  const MAP_NODES = [
    "A01:706,872 A02:764,906 A03:813,906 A04:706,1025 A05:706,1072 A06:706,1121 A07:754,1120 A08:802,1120 A11:658,1168 A09:706,1168 A10:754,1168 A12:706,1216 A13:754,1216",
    "B01:908,872 B03:956,872 B04:1004,872 B05:1052,872 B06:1099,872 B07:1148,872 B08:1196,872 B09:1244,872 B02:908,937 B10:1099,937 B11:1148,937",
    "C8cb:325,237 C7cb:372,237 C6cb:420,237 C5cb:468,237 C4cb:515,237 C3cb:563,237 C2cb:611,237 C1cb:658,237 C8b:325,285 C7b:372,285 C6b:420,285 C5b:468,285 C4b:516,285 C3b:563,285 C2b:611,285 C1b:658,285 C09:706,285 C8ob:325,333 C7ob:373,333 C6ob:420,333 C5ob:468,333 C4ob:516,333 C3ob:563,333 C2ob:611,333 C1ob:659,333 C8o:659,634 C8u:707,634 C8c:755,634 C7o:659,682 C7u:707,682 C7c:755,682 C6o:659,729 C6u:707,729 C6c:755,729 C5o:658,777 C5u:706,777 C5c:754,777 C4o:658,824 C4u:706,824 C4c:754,824 C3o:361,872 C2o:409,872 C1o:457,872 C3c:368,920 C2c:409,920 C1c:457,920",
    "DU3:1355,455 DGS:1069,499 DU2:1300,511 DU1:1356,514 DGC:1069,547 D1g:1022,615 D2g:1069,615 D3g:1116,615 D4g:1165,615 D5g:1213,615 D6g:1260,614 D7g:1308,614 D8g:1356,614 D1c:1022,662 D2c:1069,662 D3c:1116,662 D4c:1165,662 D5c:1213,662 D6c:1260,661 D7c:1308,661 D8c:1356,661 D1L:1022,710 D2L:1069,710 D3L:1117,710 D4L:1165,710 D5L:1213,710 D6L:1260,709 D7L:1308,709 D8L:1356,709 D1v:1022,757 D2v:1069,757 D3v:1116,757 D4v:1165,757 D5v:1213,757 D6v:1260,757 D7v:1308,757 D8v:1356,757",
    "E31:218,424 E30:409,424 E29:218,471 E28:266,471 E27:314,471 E26:410,471 EA7:458,471 EB7:505,471 E25:218,519 E24:266,519 E23:314,519 E22:409,519 EA6:457,519 EB6:505,519 E21:218,567 E20:266,567 E19:314,567 E18:409,567 EA5:457,566 EB5:505,566 E17:218,615 E16:266,615 E15:314,615 E14:409,615 EA4:457,614 EB4:505,614 E13:218,662 E12:266,662 E11:314,662 E10:409,662 EA3:457,662 EB3:505,662 E09:217,710 E08:266,710 E07:314,710 E06:409,710 EA2:457,710 EB2:505,710 EU2:66,760 EU1:122,757 E05:218,757 E04:266,757 E03:314,757 E02:361,757 E01:409,757 EA1:457,757 EB1:505,757",
    "FU3:956,54 FU2:907,110 FU1:956,111 FU4:1013,110 F18:908,213 F17:956,213 F15:956,261 F16:1004,261 F14:908,308 F13:956,308 F11:956,356 F12:1004,356 F10:908,404 F09:956,404 F07:956,451 F08:1004,451 F06:908,499 F05:956,499 F03:956,547 F04:1004,547 F02:956,662 F01:956,757",
    "G02:198,872 G01:246,872 G05:199,1069 G23:406,1069 G06:151,1117 G04:199,1117 G03:246,1117 G14:311,1117 G18:359,1117 G21:406,1117 G07:199,1164 G15:311,1165 G19:359,1164 G22:406,1164 G16:311,1212 G20:359,1212 G11:199,1232 G08:246,1232 G17:311,1260 GU1:84,1280 G12:199,1280 G09:246,1280 G13:199,1327 G10:246,1327 G24:311,1327 G25:359,1327 G26:406,1327 G27:151,872",
    "H02:1004,987 H01:1052,987 H03:1100,987 H04:1004,1035 H09:1052,1035 H05:1100,1035 H06:1004,1083 H08:1052,1083 H07:1100,1083 H11:1004,1190 H10:1052,1190 H12:1100,1190 H14:1004,1238 H13:1052,1238 H15:1100,1238 H23:1260,1239 H25:1308,1239 H27:1357,1238 H17:1004,1286 H16:1052,1286 H18:1100,1286 H22:1260,1287 H30:1308,1286 H29:1356,1286 H20:1004,1334 H19:1052,1334 H21:1100,1334 H24:1260,1335 H26:1308,1334 H28:1356,1334",
    "IU2:1622,715 IU1:1622,765 IU3:1679,770 I01:1376,873 I02:1426,872 I03:1475,872 I04:1524,873 I05:1573,873 I06:1622,873 I07:1671,873 I08:1377,937 I13:1426,937 I18:1475,937 I19:1524,937 I26:1573,937 I28:1622,937 I32:1671,937 I09:1377,988 I14:1426,988 I20:1524,988 I27:1573,988 I29:1622,988 I10:1377,1038 I15:1426,1038 I21:1524,1038 I30:1622,1038 I11:1377,1088 I16:1426,1088 I22:1524,1088 I31:1622,1088 I12:1377,1138 I17:1426,1138 I23:1524,1138 I24:1524,1188 I25:1524,1238 IU4:1622,452 IC4:1574,452 IC1:1670,452 IC2:1717,452 IC3:1765,452",
  ].join(" ").split(" ").reduce((nodes, entry) => {
    const [code, xy] = entry.split(":");
    const [x, y] = xy.split(",").map(Number);
    nodes[code] = { x, y };
    return nodes;
  }, {});
  const MAP_BIG_NODES = new Set(["DU1", "EU2", "FU1", "IU1"]);

  function blockPath(loops) {
    return `<path class="map-block" fill-rule="evenodd" d="${loops.map((loop) => "M" + loop.map((p) => p.join(",")).join("L") + "Z").join("")}"></path>`;
  }

  function blockBounds(loops) {
    const points = loops.flat();
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }

  function chamferRect(left, top, right, bottom, cut) {
    return [
      [left + cut, top], [right - cut, top], [right, top + cut], [right, bottom - cut],
      [right - cut, bottom], [left + cut, bottom], [left, bottom - cut], [left, top + cut],
    ].map((p) => p.map((n) => +n.toFixed(1)).join(",")).join(" ");
  }

  function shortLevel(level) {
    if (level < 1000) return String(level);
    const units = ["k", "M", "B"];
    let value = level;
    let unit = -1;
    while (value >= 1000 && unit < units.length - 1) {
      value /= 1000;
      unit += 1;
    }
    return (value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)) + units[unit];
  }

  function mapNodeSvg(code) {
    const node = MAP_NODES[code];
    const mod = MTC.MODEL.byCode[code];
    if (!node || !mod) return "";
    const level = state.levels[code] || 0;
    const big = MAP_BIG_NODES.has(code);
    const maxed = isMaxed(mod, level);
    const { x, y } = node;
    const text = isCapped(mod) ? `${level}/${mod.max}` : big ? `LV. ${shortLevel(level)}` : shortLevel(level);
    const half = big ? 25.5 : 16.5;
    const badgeW = big ? 27 : 21;
    const badgeTop = y + (big ? 21 : 11);
    const fit = text.length > (big ? 7 : 5) ? ` textLength="${badgeW * 2 - 6}" lengthAdjust="spacingAndGlyphs"` : "";
    const kind = maxed ? "is-maxed" : level > 0 ? "is-owned" : "is-new";
    return `<g class="map-mod ${kind}${big ? " is-big" : ""}">
      <polygon class="map-tile" points="${chamferRect(x - half, y - half, x + half, y + half, big ? 7 : 5)}"></polygon>
      <polygon class="map-badge" points="${chamferRect(x - badgeW, badgeTop, x + badgeW, badgeTop + 15, 4)}"></polygon>
      <text class="map-level" x="${x}" y="${badgeTop + 11}"${fit}>${esc(text)}</text>
      ${maxed && !big ? `<text class="map-max" x="${x}" y="${y - 14}">MAX</text>` : ""}
    </g>`;
  }

  function mapNodesSvg(codes) {
    return codes.map(mapNodeSvg).join("");
  }

  function miniMapHtml(code) {
    const node = MAP_NODES[code];
    const letter = String(code || "").charAt(0).toUpperCase();
    const loops = MAP_BLOCKS[letter];
    const label = `Show ${code} on the map`;
    if (!node && !loops) return "";
    if (!node) {
      return `<button type="button" class="mini-map mini-map-block" data-map="${esc(code)}" aria-label="${esc(label)}" title="Open the map">
        <img src="${MAP_IMAGE}" alt="">
        <svg viewBox="0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}" preserveAspectRatio="none" aria-hidden="true">
          ${blockPath(loops)}
        </svg>
      </button>`;
    }
    const viewW = 168;
    const viewH = 126;
    const scale = viewW / 290;
    const imgW = MAP_SIZE.w * scale;
    const imgH = MAP_SIZE.h * scale;
    let left = viewW / 2 - node.x * scale;
    let top = viewH / 2 - node.y * scale;
    left = Math.min(0, Math.max(viewW - imgW, left));
    top = Math.min(0, Math.max(viewH - imgH, top));
    const pinX = (node.x * scale + left) / viewW * 100;
    const pinY = (node.y * scale + top) / viewH * 100;
    const pin = MAP_BIG_NODES.has(code) ? 30 : 22;
    const seenX = [-left / scale - 40, (viewW - left) / scale + 40];
    const seenY = [-top / scale - 40, (viewH - top) / scale + 40];
    const nearby = Object.keys(MAP_NODES).filter((other) => {
      const at = MAP_NODES[other];
      return at.x >= seenX[0] && at.x <= seenX[1] && at.y >= seenY[0] && at.y <= seenY[1];
    });
    return `<button type="button" class="mini-map" data-map="${esc(code)}" aria-label="${esc(label)}" title="Open the map">
      <span class="mini-map-sheet" style="width:${(imgW / viewW * 100).toFixed(2)}%;height:${(imgH / viewH * 100).toFixed(2)}%;left:${(left / viewW * 100).toFixed(2)}%;top:${(top / viewH * 100).toFixed(2)}%">
        <img src="${MAP_IMAGE}" alt="">
        <svg class="map-mods" viewBox="0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}" preserveAspectRatio="none" aria-hidden="true">${mapNodesSvg(nearby)}</svg>
      </span>
      <span class="mini-map-pin" style="left:${pinX.toFixed(2)}%;top:${pinY.toFixed(2)}%;width:${pin}%"></span>
    </button>`;
  }

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
          <div class="checks stack">
            <label><input id="effects-map-side" type="checkbox" ${state.showEffectMap !== false ? "checked" : ""}> Show what each mod does</label>
          </div>
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
            <span><i class="key key-max"></i>Maxed</span>
            <span><i class="key key-owned"></i>Bought</span>
            <span><i class="key key-new"></i>Not bought</span>
          </div>
          <p class="note small">Drag to move, scroll to zoom, and click a node to select it.</p>
        </aside>
        <div class="map-scroll" id="map-scroll">
          <div class="map-stage" id="map-stage">
            <img src="${MAP_IMAGE}" alt="Loop mod tree from the game, blocks A through I, showing your level on each mod." draggable="false">
            <svg class="map-mods" id="map-progress" viewBox="0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}" preserveAspectRatio="none" aria-hidden="true"></svg>
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
    bindEffectToggle("effects-map-side", "map", () => {
      const tip = document.getElementById("map-tip");
      if (tip) tip.hidden = true;
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
    layer.innerHTML = mapNodesSvg(Object.keys(MAP_NODES));
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
      const reach = MAP_BIG_NODES.has(code) ? 30 : 22;
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
    tip.innerHTML = `<b>${esc(mod.code)}</b> ${esc(mod.name)}${effectHtml(code, "map")}<span>Level <span class="lv">${level}</span> / ${capLabel(mod)}</span>`;
    tip.hidden = false;
    const width = tip.offsetWidth;
    const left = clientX + 16 + width > window.innerWidth ? clientX - 16 - width : clientX + 16;
    tip.style.left = Math.max(8, left) + "px";
    tip.style.top = (clientY + 16) + "px";
  }

  function applyMapZoom() {
    const stage = document.getElementById("map-stage");
    if (!stage) return;
    stage.style.width = Math.round(MAP_SIZE.w * state.mapZoom) + "px";
    stage.style.height = Math.round(MAP_SIZE.h * state.mapZoom) + "px";
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
    const loops = MAP_BLOCKS[letter];
    document.querySelectorAll("[data-block]").forEach((button) => {
      button.classList.toggle("is-on", !!loops && button.dataset.block === letter);
    });
    if (!text || !loops) {
      boxes.innerHTML = "";
      hit.innerHTML = text
        ? `<span class="hit-status">Codes start with a block letter from A to I.</span>`
        : `<span class="hit-status">Type a code, or pick a block below.</span>`;
      return;
    }
    const node = mod && MAP_NODES[mod.code];
    const focus = node || blockBounds(loops);
    const focusX = focus.x;
    const focusY = focus.y;
    const radius = node && MAP_BIG_NODES.has(mod.code) ? 38 : 27;
    boxes.innerHTML = `<svg class="map-outline" viewBox="0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}" preserveAspectRatio="none">
        ${blockPath(loops)}
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
        <div class="settings-side">
          <section class="panel">
            <h3 class="first">Ship rank and crew</h3>
            <div class="ship-grid" id="ships"></div>
          </section>
          <div class="settings-resets">
            <button class="btn ghost" type="button" data-reset="weights">Reset weights</button>
            <button class="btn ghost" type="button" data-reset="stats">Reset run stats</button>
            <button class="btn ghost" type="button" data-reset="manuals">Reset manual generators</button>
            <button class="btn ghost" type="button" data-reset="ships">Reset ship rank and crew</button>
          </div>
        </div>
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
        ${stepperInput(`r-${key}`, p.rank[key], `${label} rank`)}
        ${stepperInput(`c-${key}`, p.crew[key], `${label} crew`)}
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
    bindSteppers(document.getElementById("ships"));
    document.querySelectorAll("[data-reset]").forEach((button) => {
      button.addEventListener("click", () => resetProgressPart(button.dataset.reset, p));
    });
  }

  function resetProgressPart(kind, progress) {
    const defaults = MTC.defaultProgress();
    const prompts = {
      weights: "Reset weights back to the sheet's recommended values?",
      stats: "Reset run stats back to 0?",
      manuals: "Reset manual generators back to 0?",
      ships: "Reset ship ranks and crew back to 0?",
    };
    if (!prompts[kind] || !confirm(prompts[kind])) return;
    if (kind === "weights") progress.weights = Object.assign({}, defaults.weights);
    if (kind === "stats") {
      ["level", "loops", "resets", "ops", "studies", "tickspeed", "equipment", "levels", "researches", "swTech", "doubler"].forEach((key) => {
        progress[key] = defaults[key];
      });
    }
    if (kind === "manuals") progress.manual = Object.assign({}, defaults.manual);
    if (kind === "ships") {
      progress.rank = Object.assign({}, defaults.rank);
      progress.crew = Object.assign({}, defaults.crew);
    }
    state.plan = null;
    saveState();
    renderSettings();
  }

  function field(label, id, value) {
    return `<label class="field" title="${esc(label)}"><span>${esc(label)}</span><input id="${id}" type="text" inputmode="decimal" value="${esc(value)}"></label>`;
  }

  function statField(label, id, value) {
    return `<label class="field" title="${esc(label)}"><span>${esc(label)}</span><input id="${id}" type="text" inputmode="decimal" value="${esc(MTC.formatCount(value))}"></label>`;
  }

  function stepperInput(id, value, label) {
    return `<span class="stepper">
      <input id="${id}" type="text" inputmode="decimal" value="${esc(value)}" aria-label="${esc(label)}">
      <span class="stepper-btns">
        <button type="button" data-step="1" aria-label="Increase ${esc(label)}">▲</button>
        <button type="button" data-step="-1" aria-label="Decrease ${esc(label)}">▼</button>
      </span>
    </span>`;
  }

  function bindSteppers(root) {
    if (!root) return;
    root.querySelectorAll(".stepper-btns button").forEach((button) => {
      button.addEventListener("click", () => {
        const input = button.closest(".stepper").querySelector("input");
        const current = Number(String(input.value).replace(/,/g, "."));
        const base = Number.isFinite(current) ? current : 0;
        const next = Math.max(0, base + Number(button.dataset.step));
        input.value = String(next);
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  function doublerField(value) {
    return `<label class="field doubler" title="LP doubler bar"><span>LP doubler bar</span><span class="doubler-val"><input id="s-doubler" type="text" inputmode="decimal" value="${esc(MTC.formatCount(value))}"><span class="doubler-max">/10</span></span></label>`;
  }

  function dotsForCommas(input) {
    input.addEventListener("input", () => {
      if (!input.value.includes(",")) return;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.replace(/,/g, ".");
      if (start != null && end != null) input.setSelectionRange(start, end);
    });
  }

  function bindCounts(prefix, assign) {
    document.querySelectorAll(`[id^="${prefix}"]`).forEach((input) => {
      dotsForCommas(input);
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
      dotsForCommas(input);
      input.addEventListener("change", () => {
        const key = input.id.slice(prefix.length);
        const value = Number(String(input.value).replace(/,/g, "."));
        const next = Number.isFinite(value) ? value : 0;
        assign(key, next);
        input.value = String(next);
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

  function totalModLevel() {
    return MTC.mods.reduce((sum, mod) => sum + (Number(state.levels[mod.code]) || 0), 0);
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
