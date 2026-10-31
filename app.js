(function () {
  const STORAGE_KEY = "cifi-mtc-planner-v1";
  const SYNC_KEY = "cifi-mtc-sync-v1";
  // Address of the Cloudflare Worker in cloud/worker.js. Sync stays hidden while this is empty.
  const SYNC_URL = "https://cifi-sync.leosantos2127.workers.dev";
  const SYNC_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const app = document.getElementById("app");
  const tabs = document.querySelectorAll(".tab");

  let sync = readSync();
  let syncTimer = null;
  let syncBusy = false;
  let syncStatus = "";
  let syncPhase = "idle";
  const state = loadState();
  let revealNext = false;
  applyTheme();
  applyCostStyle();
  applyDensity();
  applyMiniMap();
  applyEffects();
  applyIcons();
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
      levelsAtPlan: null,
      orderMode: "order",
      orderQuery: "",
      orderBlock: "",
      levelQuery: "",
      ownedOnly: false,
      mapQuery: "",
      mapZoom: 1.5,
      planMapZoom: 1,
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
      showIconOrder: true,
      showIconLevels: true,
      showIconMap: true,
      showMapBlocks: true,
      showMapCodes: false,
      syncInviteDismissed: false,
      planBought: {},
    };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return blank;
      const next = Object.assign(blank, saved, { progress: mergeProgress(saved.progress) });
      if (!saved.planBought) next.planBought = boughtFromChecks(saved.plan, saved.checked, saved.levelsAtPlan);
      delete next.checked;
      return next;
    } catch (err) {
      return blank;
    }
  }

  function boughtFromChecks(plan, checked, base) {
    const bought = {};
    if (!plan || !Array.isArray(plan.groups) || !Array.isArray(checked)) return bought;
    plan.groups.forEach((group, i) => {
      if (!checked[i]) return;
      const start = (base && base[group.code]) || 0;
      if (group.to > Math.max(start, bought[group.code] || 0)) bought[group.code] = group.to;
    });
    return bought;
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
      planBought: state.planBought,
      levelsAtPlan: state.levelsAtPlan,
      orderMode: state.orderMode,
      orderQuery: state.orderQuery,
      orderBlock: state.orderBlock,
      levelQuery: state.levelQuery,
      ownedOnly: state.ownedOnly,
      mapQuery: state.mapQuery,
      mapZoom: state.mapZoom,
      planMapZoom: state.planMapZoom,
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
      showIconOrder: state.showIconOrder,
      showIconLevels: state.showIconLevels,
      showIconMap: state.showIconMap,
      showMapBlocks: state.showMapBlocks,
      showMapCodes: state.showMapCodes,
      syncInviteDismissed: state.syncInviteDismissed,
    };
    const json = JSON.stringify(copy);
    localStorage.setItem(STORAGE_KEY, json);
    queueSync(json);
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

  function iconPlaceOn(place) {
    if (place === "order") return state.showIconOrder !== false;
    if (place === "levels") return state.showIconLevels !== false;
    return state.showIconMap !== false;
  }

  function applyIcons() {
    state.showIconOrder = state.showIconOrder !== false;
    state.showIconLevels = state.showIconLevels !== false;
    state.showIconMap = state.showIconMap !== false;
    const order = document.getElementById("icons-order");
    const levels = document.getElementById("icons-levels");
    const map = document.getElementById("icons-map");
    if (order) order.checked = state.showIconOrder;
    if (levels) levels.checked = state.showIconLevels;
    if (map) map.checked = state.showIconMap;
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

  function bindIconToggle(id, place, refresh) {
    const box = document.getElementById(id);
    if (!box) return;
    box.addEventListener("change", () => {
      if (place === "order") state.showIconOrder = box.checked;
      else if (place === "levels") state.showIconLevels = box.checked;
      else state.showIconMap = box.checked;
      applyIcons();
      saveState();
      refresh();
    });
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
      if (event.target.id === "icons-order" || event.target.id === "icons-levels" || event.target.id === "icons-map") {
        state.showIconOrder = document.getElementById("icons-order").checked;
        state.showIconLevels = document.getElementById("icons-levels").checked;
        state.showIconMap = document.getElementById("icons-map").checked;
        applyIcons();
        saveState();
        const place = event.target.id === "icons-order" ? "plan" : event.target.id === "icons-levels" ? "levels" : "map";
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
      if (!event.target.closest(".info-btn") && !event.target.closest(".info-box")) closeInfoBoxes();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const menu = document.getElementById("config-menu");
      if (menu && !menu.hidden) {
        setConfigOpen(false);
        return;
      }
      if (closeInfoBoxes()) return;
      if (state.tab === "map" && state.mapQuery) clearMapSelection();
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
    const checked = plan ? planDoneFlags(plan).filter(Boolean).length : 0;
    const planLine = plan && plan.groups.length
      ? `${checked} of ${plan.groups.length} rows checked`
      : "No buy order yet";
    app.innerHTML = `
      ${showSyncInvite() ? syncInviteHtml() : ""}
      <div class="home">
        <section class="home-intro">
          <p class="kicker">A Fan-made tool · Pre-Ouro only</p>
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
              <li>All game art belongs to Octocube Games. That includes the mod points icon and the loop mod icons beside each mod.</li>
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
            <h2 class="card-title">Saves</h2>
            <div class="save-part">
              <h3 class="save-head">This device <span class="save-tag is-on">Always on</span></h3>
              <p class="note small">Levels, settings, and run history save automatically in this browser. A backup is a file you keep yourself.</p>
              <div class="btn-pair">
                <button type="button" class="btn ghost" id="backup-save">Download backup</button>
                <button type="button" class="btn ghost" id="backup-load">Load backup</button>
              </div>
              <button type="button" class="btn ghost danger wide" id="backup-delete">Delete data on this device</button>
              <p class="note small" id="backup-msg"></p>
            </div>
            ${SYNC_URL ? `<div class="save-part" id="home-sync">${syncControlsHtml(true)}</div>` : ""}
          </section>
          <section class="card">
            <h2 class="card-title">Run history</h2>
            <div id="run-history"></div>
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
      if (sync) {
        sync.dirty = true;
        writeSync();
      }
      location.reload();
    };
    reader.readAsText(file);
  }

  function deleteAllData() {
    const cloudNote = syncOn() ? "\n\nThe cloud save is not deleted. This device just stops syncing." : "";
    if (!confirm(`Delete every level, setting, and run saved on this device?${cloudNote}`)) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SYNC_KEY);
    location.reload();
  }

  function readSync() {
    try {
      const saved = JSON.parse(localStorage.getItem(SYNC_KEY) || "null");
      return saved && typeof saved.code === "string" ? saved : null;
    } catch (err) {
      return null;
    }
  }

  function writeSync() {
    if (sync) localStorage.setItem(SYNC_KEY, JSON.stringify(sync));
    else localStorage.removeItem(SYNC_KEY);
  }

  function syncOn() {
    return !!(SYNC_URL && sync && sync.code);
  }

  function hashText(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36) + ":" + text.length;
  }

  function cleanSyncCode(raw) {
    const code = String(raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (code.length !== 12) return null;
    return [...code].every((ch) => SYNC_ALPHABET.includes(ch)) ? code : null;
  }

  function shownSyncCode(code) {
    return code.match(/.{1,4}/g).join("-");
  }

  function syncLink(code) {
    return `${location.origin}${location.pathname}?sync=${code}`;
  }

  async function syncRequest(method, path, body, keepalive) {
    const res = await fetch(SYNC_URL.replace(/\/+$/, "") + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
      keepalive: !!keepalive,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }
    return { status: res.status, ok: res.ok, data: data || {} };
  }

  function setSyncStatus(text, phase) {
    syncStatus = text;
    if (phase) syncPhase = phase;
    document.querySelectorAll("[data-sync-status]").forEach((el) => { el.textContent = text; });
    paintSyncChip();
  }

  function syncedLine() {
    if (!sync || !sync.updatedAt) return "";
    const when = new Date(sync.updatedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
    return `Last synced ${when}.`;
  }

  function syncMode() {
    if (!syncOn()) return "off";
    if (syncPhase === "saving" || syncPhase === "offline" || syncPhase === "error") return syncPhase;
    return "on";
  }

  function cloudIcon(mode) {
    const marks = {
      on: `<path d="M9.3 13.6l2 2 3.6-3.6"></path>`,
      saving: `<path d="M12 16.5v-5M9.6 13.6L12 11.2l2.4 2.4"></path>`,
      offline: `<path d="M4 4l16 16"></path>`,
      error: `<path d="M12 10.6v3.2M12 16.2v.2"></path>`,
      off: "",
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 18.5h10.4a4.1 4.1 0 0 0 .5-8.17A6 6 0 0 0 6.3 9.2 4.7 4.7 0 0 0 7 18.5z"></path>${marks[mode]}
    </svg>`;
  }

  function paintSyncChip() {
    const chip = document.getElementById("sync-chip");
    if (!chip) return;
    chip.hidden = !SYNC_URL;
    if (!SYNC_URL) return;
    const mode = syncMode();
    const labels = { off: "Cloud save", on: "Synced", saving: "Saving…", offline: "Offline", error: "Not synced" };
    const title = mode === "off"
      ? "Cloud save is off. Click to turn it on."
      : syncStatus || syncedLine() || "Cloud save is on.";
    chip.className = `sync-chip is-${mode}`;
    chip.innerHTML = `${cloudIcon(mode)}<span class="sync-chip-label">${labels[mode]}</span>`;
    chip.title = title;
    chip.setAttribute("aria-label", `${labels[mode]}. ${title}`);
  }

  function showSyncInvite() {
    return !!SYNC_URL && !syncOn() && !state.syncInviteDismissed && Object.keys(state.levels).length > 0;
  }

  function syncInviteHtml() {
    return `<section class="card sync-invite" id="sync-invite">
      <div class="sync-invite-text">
        <b>Use this on more than one device?</b>
        <span>Turn on cloud save. No account or email needed. You'll get a code to type on your other device.</span>
      </div>
      <div class="sync-invite-actions">
        <button type="button" class="btn" data-sync="start">Turn on cloud save</button>
        <button type="button" class="btn ghost" data-sync="have-code">I have a code</button>
        <button type="button" class="btn ghost" data-sync="dismiss">Not now</button>
      </div>
    </section>`;
  }

  function syncControlsHtml(withHead) {
    const on = syncOn();
    const head = withHead
      ? `<h3 class="save-head">Cloud save <span class="save-tag${on ? " is-on" : ""}">${on ? "On" : "Off"}</span></h3>`
      : "";
    if (!on) {
      return `<div class="sync-box">
        ${head}
        <p class="note small">Use the same progress on another device. No account or email needed: you get a code to type on your other device.</p>
        <button type="button" class="btn ghost wide" data-sync="start">Turn on cloud save</button>
        <div class="sync-join">
          <input type="text" data-sync-input placeholder="Code from another device" autocomplete="off" spellcheck="false" aria-label="Code from another device">
          <button type="button" class="btn ghost" data-sync="join">Connect</button>
        </div>
        <p class="note small" data-sync-status>${esc(syncStatus)}</p>
      </div>`;
    }
    return `<div class="sync-box">
      ${head}
      <p class="sync-code">${esc(shownSyncCode(sync.code))}</p>
      <p class="note small">This code is your cloud save. Copy it somewhere safe. Anyone with it can see and change your save. If you lose it, your progress stays on this device, and you can turn cloud save on again for a new code.</p>
      <div class="btn-pair">
        <button type="button" class="btn ghost" data-sync="copy-code">Copy code</button>
        <button type="button" class="btn ghost" data-sync="copy-link">Copy link</button>
      </div>
      <p class="note small" data-sync-status>${esc(syncStatus || syncedLine())}</p>
      <div class="btn-pair">
        <button type="button" class="btn ghost" data-sync="off">Turn off here</button>
        <button type="button" class="btn ghost danger" data-sync="delete">Delete cloud save</button>
      </div>
    </div>`;
  }

  function configSyncHtml() {
    const on = syncOn();
    const label = `<p class="config-label">Cloud save <span class="save-tag${on ? " is-on" : ""}">${on ? "On" : "Off"}</span></p>`;
    if (!on) {
      return `${label}
        <p class="config-hint">Use your progress on other devices. No account or email needed.</p>
        <div class="config-sync-row">
          <button type="button" class="btn ghost small-btn" data-sync="start">Turn on cloud save</button>
          <span class="config-or">or</span>
          <input type="text" data-sync-input placeholder="Code from another device" autocomplete="off" spellcheck="false" aria-label="Code from another device">
          <button type="button" class="btn ghost small-btn" data-sync="join">Connect</button>
        </div>
        <p class="config-hint" data-sync-status>${esc(syncStatus)}</p>`;
    }
    return `${label}
      <p class="config-hint">Anyone with this code can see and change your save. Keep it somewhere safe.</p>
      <div class="config-actions">
        <span class="sync-code">${esc(shownSyncCode(sync.code))}</span>
        <button type="button" class="btn ghost small-btn" data-sync="copy-code">Copy code</button>
        <button type="button" class="btn ghost small-btn" data-sync="copy-link">Copy link</button>
        <button type="button" class="btn ghost small-btn" data-sync="off">Turn off here</button>
        <button type="button" class="btn ghost danger small-btn" data-sync="delete">Delete cloud save</button>
      </div>
      <p class="config-hint" data-sync-status>${esc(syncStatus || syncedLine())}</p>`;
  }

  function paintSyncViews() {
    paintSyncChip();
    const config = document.getElementById("config-sync");
    if (config) config.innerHTML = SYNC_URL ? configSyncHtml() : "";
    const home = document.getElementById("home-sync");
    if (home) home.innerHTML = syncControlsHtml(true);
    const invite = document.getElementById("sync-invite");
    if (invite && !showSyncInvite()) invite.remove();
  }

  function queueSync(json) {
    if (!syncOn()) return;
    if (!sync.dirty && hashText(json) === sync.hash) return;
    sync.dirty = true;
    writeSync();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => pushSync(false), 2500);
    setSyncStatus("Waiting to save to the cloud…", "saving");
  }

  async function pushSync(keepalive) {
    if (!syncOn()) return;
    clearTimeout(syncTimer);
    syncTimer = null;
    if (syncBusy) {
      syncTimer = setTimeout(() => pushSync(false), 1000);
      return;
    }
    const json = localStorage.getItem(STORAGE_KEY) || "{}";
    const hash = hashText(json);
    const body = `{"base":${Number(sync.updatedAt) || 0},"state":${json}}`;
    syncBusy = true;
    setSyncStatus("Saving to the cloud…", "saving");
    try {
      const res = await syncRequest("PUT", `/saves/${sync.code}`, body, keepalive && body.length < 60000);
      syncBusy = false;
      if (!syncOn()) return;
      if (res.ok) {
        sync.updatedAt = res.data.updatedAt;
        sync.hash = hash;
        sync.dirty = hashText(localStorage.getItem(STORAGE_KEY) || "{}") !== hash;
        writeSync();
        if (sync.dirty) {
          setSyncStatus("Waiting to save to the cloud…", "saving");
          syncTimer = setTimeout(() => pushSync(false), 2500);
        } else {
          setSyncStatus(syncedLine(), "idle");
        }
      } else if (res.status === 409) {
        resolveSyncConflict(res.data);
      } else if (res.status === 404) {
        stopSync("This cloud save no longer exists, so cloud save is off on this device.");
      } else if (res.data.error === "too-big") {
        setSyncStatus("This save is too large for cloud save. It's still saved on this device.", "error");
      } else {
        setSyncStatus("Couldn't save to the cloud. Trying again soon.", "error");
        syncTimer = setTimeout(() => pushSync(false), 30000);
      }
    } catch (err) {
      syncBusy = false;
      setSyncStatus("Offline. Progress is saved on this device and will sync when you're back online.", "offline");
      syncTimer = setTimeout(() => pushSync(false), 30000);
    }
  }

  async function pullSync() {
    if (!syncOn() || syncBusy) return;
    try {
      const res = await syncRequest("GET", `/saves/${sync.code}`);
      if (!syncOn()) return;
      if (res.status === 404) {
        stopSync("This cloud save no longer exists, so cloud save is off on this device.");
        return;
      }
      if (!res.ok) {
        setSyncStatus("Couldn't reach the cloud save. Progress is still saved on this device.", "error");
        return;
      }
      if (res.data.updatedAt > (Number(sync.updatedAt) || 0)) {
        if (sync.dirty) resolveSyncConflict(res.data);
        else applyCloudSave(res.data);
      } else if (sync.dirty) {
        pushSync(false);
      } else {
        setSyncStatus(syncedLine(), "idle");
      }
    } catch (err) {
      setSyncStatus("Offline. Progress is saved on this device and will sync when you're back online.", "offline");
    }
  }

  function resolveSyncConflict(remote) {
    const useCloud = confirm("Another device saved newer progress to the cloud.\n\nOK: load the cloud save on this device.\nCancel: keep this device's progress and replace the cloud save with it.");
    if (useCloud) {
      applyCloudSave(remote);
      return;
    }
    sync.updatedAt = remote.updatedAt;
    sync.dirty = true;
    writeSync();
    pushSync(false);
  }

  function applyCloudSave(remote) {
    const json = JSON.stringify(Object.assign({}, remote.state, { tab: state.tab }));
    localStorage.setItem(STORAGE_KEY, json);
    sync.updatedAt = remote.updatedAt;
    sync.hash = hashText(json);
    sync.dirty = false;
    writeSync();
    location.reload();
  }

  function stopSync(message) {
    clearTimeout(syncTimer);
    syncTimer = null;
    sync = null;
    writeSync();
    syncStatus = message || "";
    syncPhase = "idle";
    paintSyncViews();
  }

  async function startCloudSync(fromInvite) {
    saveState();
    const json = localStorage.getItem(STORAGE_KEY) || "{}";
    setSyncStatus("Turning on cloud save…");
    try {
      const res = await syncRequest("POST", "/saves", `{"state":${json}}`);
      if (!res.ok) {
        setSyncStatus(res.data.error === "too-big" ? "This save is too large for cloud save." : "Couldn't reach the cloud save server. Try again in a moment.");
        return;
      }
      sync = { code: res.data.code, updatedAt: res.data.updatedAt, hash: hashText(json), dirty: false };
      writeSync();
      syncStatus = "";
      syncPhase = "idle";
      paintSyncViews();
      const home = document.getElementById("home-sync");
      if (fromInvite && home) home.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (err) {
      setSyncStatus("Couldn't reach the cloud save server. Check your connection and try again.");
    }
  }

  async function joinCloudSync(raw) {
    const code = cleanSyncCode(raw);
    if (!code) {
      setSyncStatus("That code doesn't look right. It has 12 letters and numbers.");
      return;
    }
    setSyncStatus("Connecting…");
    try {
      const res = await syncRequest("GET", `/saves/${code}`);
      if (res.status === 404) {
        setSyncStatus("No cloud save was found for that code.");
        return;
      }
      if (!res.ok) {
        setSyncStatus("Couldn't reach the cloud save server. Try again in a moment.");
        return;
      }
      const hasProgress = Object.keys(state.levels).length > 0 || (state.runs || []).length > 0;
      if (hasProgress && !confirm("Replace the progress on this device with the cloud save?\n\nTip: Download a backup first if you want to keep this device's progress.")) {
        setSyncStatus("");
        return;
      }
      sync = { code, updatedAt: 0, hash: "", dirty: false };
      applyCloudSave(res.data);
    } catch (err) {
      setSyncStatus("Couldn't reach the cloud save server. Check your connection and try again.");
    }
  }

  async function deleteCloudSave() {
    if (!syncOn()) return;
    if (!confirm("Delete the cloud save for this code? Other devices using it will stop syncing. The progress saved in each browser stays.")) return;
    try {
      const res = await syncRequest("DELETE", `/saves/${sync.code}`);
      if (!res.ok) {
        setSyncStatus("Couldn't delete the cloud save. Try again in a moment.");
        return;
      }
      stopSync("Cloud save deleted. Sync is off on this device.");
    } catch (err) {
      setSyncStatus("Couldn't reach the sync server. Check your connection and try again.");
    }
  }

  function copyToButton(button, text) {
    const label = button.textContent;
    navigator.clipboard.writeText(text).then(() => {
      button.textContent = "Copied";
    }).catch(() => {
      button.textContent = "Copy failed";
    }).finally(() => {
      setTimeout(() => { button.textContent = label; }, 1500);
    });
  }

  function runSyncAction(button) {
    const action = button.dataset.sync;
    if (action === "start") {
      startCloudSync(!!button.closest("#sync-invite"));
    } else if (action === "join") {
      const input = button.parentElement.querySelector("[data-sync-input]");
      joinCloudSync(input ? input.value : "");
    } else if (action === "copy-code") {
      copyToButton(button, shownSyncCode(sync.code));
    } else if (action === "copy-link") {
      copyToButton(button, syncLink(sync.code));
    } else if (action === "off") {
      if (!confirm("Stop cloud save on this device? Your progress stays here, and the cloud save stays for your other devices.")) return;
      stopSync("Cloud save is off on this device.");
    } else if (action === "delete") {
      deleteCloudSave();
    } else if (action === "have-code") {
      const input = document.querySelector("#home-sync [data-sync-input]");
      if (!input) return;
      input.scrollIntoView({ block: "center", behavior: "smooth" });
      input.focus({ preventScroll: true });
    } else if (action === "dismiss") {
      state.syncInviteDismissed = true;
      saveState();
      const invite = document.getElementById("sync-invite");
      if (invite) invite.remove();
    }
  }

  function bootSync() {
    const params = new URLSearchParams(location.search);
    const linked = params.get("sync");
    if (linked !== null) {
      params.delete("sync");
      const rest = params.toString();
      history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);
    }
    paintSyncViews();
    if (!SYNC_URL) return;
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sync]");
      if (button) runSyncAction(button);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || !event.target.matches("[data-sync-input]")) return;
      joinCloudSync(event.target.value);
    });
    const chip = document.getElementById("sync-chip");
    if (chip) chip.addEventListener("click", () => {
      const menu = document.getElementById("config-menu");
      const opening = !menu || menu.hidden;
      setConfigOpen(opening);
      const section = document.getElementById("config-sync");
      if (opening && section) section.scrollIntoView({ block: "nearest" });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") pullSync();
      else if (sync && sync.dirty) pushSync(true);
    });
    const code = cleanSyncCode(linked);
    if (code && (!sync || sync.code !== code)) {
      joinCloudSync(code);
      return;
    }
    pullSync();
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
            <label><input id="icons-order-side" type="checkbox" ${state.showIconOrder !== false ? "checked" : ""}> Show icons</label>
          </div>
          ${owned === 0 ? `<hr><p class="warn small">Every mod is still level 0. Open <a href="#" data-go="levels">Owned levels</a> and enter what you already bought, or this list starts from a fresh tree.</p>` : ""}
          <div id="plan-minimap" class="plan-minimap" hidden></div>
          <div class="plan-map-list" id="plan-map-list" hidden></div>
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
    bindIconToggle("icons-order-side", "order", paintResults);
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
    state.planBought = {};
    saveState();
    glowPlanMap = true;
    paintResults();
  }

  function paintResults() {
    const results = document.getElementById("results");
    if (!results) return;
    const plan = state.plan;
    const sideList = document.getElementById("plan-map-list");
    const listOn = !!(plan && plan.groups.length && state.orderMode === "map");
    if (sideList) {
      sideList.hidden = !listOn;
      if (!listOn) sideList.innerHTML = "";
      const side = sideList.closest(".side");
      if (side) side.classList.toggle("has-plan-list", listOn);
    }
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
      </div>`;
      paintSideMiniMap(null);
      return;
    }
    const done = planDoneFlags(plan);
    const bought = done.filter(Boolean).length;
    const nextIndex = done.findIndex((flag) => !flag);
    const next = nextIndex === -1 ? null : plan.groups[nextIndex];
    const leftLog = planLeftLog(plan, done);
    const levelsLeft = plan.groups.reduce((sum, group, i) => sum + (done[i] ? 0 : group.count), 0);
    const modsLeft = plan.summary.filter((row) => !groupDone(row)).length;
    const mode = state.orderMode === "totals" || state.orderMode === "map" ? state.orderMode : "order";
    const mapInCard = !!(next && mode !== "map" && miniMapEnabled() && state.miniMapPlace !== "side");
    const oldMap = document.getElementById("plan-map-scroll");
    const keepMap = mode === "map" && oldMap ? [oldMap.scrollLeft, oldMap.scrollTop, sideList ? sideList.scrollTop : 0] : null;
    const modeButton = (id, value, label) => `<button class="btn ghost${mode === value ? " is-on" : ""}" type="button" id="${id}" aria-pressed="${mode === value ? "true" : "false"}">${label}</button>`;
    const body = mode === "map"
      ? `<div class="plan-map">
          <div class="plan-map-scroll" id="plan-map-scroll">
            <div class="plan-map-stage" id="plan-map-stage">
              <img src="${MAP_IMAGE}" alt="Loop mod tree with the mods in this order marked." draggable="false">
              <svg class="map-mods" id="plan-map-svg" viewBox="0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}" preserveAspectRatio="none" aria-hidden="true"></svg>
              <div id="plan-map-pop" class="plan-map-pop" hidden>
                <button type="button" id="plan-map-buy"></button>
              </div>
            </div>
          </div>
          <div class="map-tip" id="plan-map-tip" hidden></div>
        </div>`
      : `${buyListHead()}
        <div class="list" id="buy-list"></div>
        <p class="note small">Checking a row marks that step and everything above it as bought, and saves those levels in this browser. Unchecking a row undoes that mod back to where the step started. Clear checks puts levels back to how they were when you built the order.</p>`;
    results.innerHTML = `
      <div class="stats">
        <div class="stat"><b>${levelsLeft.toLocaleString()}</b><span>levels to buy</span></div>
        <div class="stat"><b>${modsLeft.toLocaleString()}</b><span>different mods</span></div>
        <div class="stat"><b>${mpAmount(leftLog)}</b><span>Still unspent${bought ? " after checked rows" : ""}</span></div>
        <div class="stat"><b>${plan.ms} ms</b><span>to calculate</span></div>
      </div>
      ${plan.stopped ? `<p class="warn">Stopped early so the page stayed responsive. Plan again after marking some of these bought, or with a smaller MP.</p>` : ""}
      <article class="next">
        <div class="next-copy">
          <p class="meta">Next purchase</p>
          ${next ? `<div class="title-line">
            ${modGlyph(next.code, "order")}
            <span class="title-text">
              <h2>${esc(next.name)}</h2>
              ${effectHtml(next.code, "order")}
              <p>${codeButton(next.code)} · ${levelRange(next.from, next.to)} · ${mpAmount(next.costLog)}</p>
            </span>
          </div>` : `<h2>List complete</h2><p>Every row in this order is checked.</p>`}
        </div>
        <div class="next-side">
          ${mapInCard ? miniMapHtml(next.code) : ""}
          <button class="btn" id="mark-next" type="button" ${next ? "" : "disabled"}>Mark bought</button>
        </div>
      </article>
      <div class="toolbar">
        ${modeButton("mode-order", "order", "Buy order")}
        ${modeButton("mode-totals", "totals", "Totals per mod")}
        ${modeButton("mode-map", "map", `<img class="btn-icon" src="icons/LoopModMenu-256.png" alt="">Plan map`)}
        <button class="btn ghost" type="button" id="copy-list">Copy list</button>
        <button class="btn ghost" type="button" id="clear-checks">Clear checks</button>
      </div>
      ${body}`;
    document.getElementById("mark-next").addEventListener("click", () => {
      if (nextIndex < 0) return;
      if (mode === "map") panToNextMod = true;
      setBoughtThrough(nextIndex);
    });
    [["mode-order", "order"], ["mode-totals", "totals"], ["mode-map", "map"]].forEach(([id, value]) => {
      document.getElementById(id).addEventListener("click", () => {
        state.orderMode = value;
        saveState();
        paintResults();
      });
    });
    const buySearch = document.getElementById("buy-search");
    if (buySearch) buySearch.addEventListener("input", () => {
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
      state.planBought = {};
      state.levels = Object.assign({}, state.levelsAtPlan || {});
      saveState();
      paintResults();
    });
    if (mode === "map") {
      paintPlanMap(!keepMap);
      const scroller = document.getElementById("plan-map-scroll");
      if (keepMap && scroller) [scroller.scrollLeft, scroller.scrollTop] = keepMap;
      if (keepMap && sideList) sideList.scrollTop = keepMap[2];
      if (panToNextMod && next) {
        planMapPick = "";
        pickPlanMod(next.code, false);
        panPlanMapTo(next.code);
      }
    } else {
      paintBuyList();
    }
    panToNextMod = false;
    if (glowPlanMap) {
      const button = document.getElementById("mode-map");
      if (button && mode !== "map") {
        button.classList.add("is-glow");
        button.addEventListener("animationend", () => button.classList.remove("is-glow"), { once: true });
      }
      glowPlanMap = false;
    }
    paintCompletion();
    paintSideMiniMap(next && mode !== "map" && miniMapEnabled() && state.miniMapPlace === "side" ? next.code : null);
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
    const done = planDoneFlags(plan);
    const nextIndex = done.findIndex((flag) => !flag);
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
        done: groupDone(row),
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
      done: done[index],
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

  function rowHtml(row) {
    return `<label class="buy${row.checkable ? " is-check" : ""}${row.done ? " is-done" : ""}${row.next ? " is-next" : ""}">
      <span class="buy-n">${row.index + 1}</span>
      ${row.checkable ? `<input type="checkbox" data-i="${row.index}" ${row.done ? "checked" : ""}>` : ""}
      <span class="buy-copy">
        <span class="title-line">
          ${modGlyph(row.code, "order")}
          <span class="title-text">
            <strong>${esc(row.title)}</strong>
            ${effectHtml(row.code, "order")}
            <span class="meta">${row.detailHtml}${row.unlocked ? "" : ` · ${lockNote(requirementCodes(row.code))}`}</span>
          </span>
        </span>
      </span>
      <span class="cost"><b>${mpAmount(row.cost)}</b><span class="meta">${row.extraHtml}</span></span>
    </label>`;
  }

  function setBoughtThrough(index, on) {
    const plan = state.plan;
    if (!plan || !plan.groups[index]) return;
    if (on !== false) {
      for (let i = 0; i <= index; i++) {
        const group = plan.groups[i];
        if (planLevel(group.code) < group.to) setPlanLevel(group.code, group.to);
      }
    } else {
      const group = plan.groups[index];
      setPlanLevel(group.code, group.from);
    }
    applyPlanBought();
    revealNext = true;
    paintResults();
  }

  function planBase(code) {
    return (state.levelsAtPlan && state.levelsAtPlan[code]) || 0;
  }

  function planLevel(code) {
    const bought = state.planBought && state.planBought[code];
    return Math.max(planBase(code), bought || 0);
  }

  function setPlanLevel(code, level) {
    if (!state.planBought) state.planBought = {};
    if (level <= planBase(code)) delete state.planBought[code];
    else state.planBought[code] = level;
  }

  function groupDone(group) {
    return planLevel(group.code) >= group.to;
  }

  function planDoneFlags(plan) {
    return plan.groups.map(groupDone);
  }

  function planLeftLog(plan, done) {
    if (done.every(Boolean)) return plan.leftLog;
    let spent = null;
    plan.groups.forEach((group, i) => {
      if (done[i]) spent = spent === null ? group.costLog : MTC.addLog(spent, group.costLog);
    });
    if (spent === null) return plan.startLog;
    const left = MTC.subLog(plan.startLog, spent);
    return left === null ? plan.leftLog : left;
  }

  function applyPlanBought() {
    const levels = Object.assign({}, state.levelsAtPlan || {});
    Object.keys(state.planBought || {}).forEach((code) => {
      levels[code] = Math.max(levels[code] || 0, state.planBought[code]);
    });
    state.levels = levels;
    saveState();
  }

  function setModBought(code, on) {
    const plan = state.plan;
    const row = plan && plan.summary.find((item) => item.code === code);
    if (!row) return;
    setPlanLevel(code, on ? row.to : row.from);
    applyPlanBought();
    paintResults();
  }

  let planMapPick = "";
  let panToNextMod = false;
  let glowPlanMap = false;

  function paintPlanMap(center) {
    const list = document.getElementById("plan-map-list");
    const svg = document.getElementById("plan-map-svg");
    const plan = state.plan;
    if (!list || !svg || !plan) return;
    if (planMapPick && !plan.summary.some((row) => row.code === planMapPick)) planMapPick = "";
    const left = plan.summary.filter((row) => !groupDone(row));
    const done = plan.summary.filter(groupDone);
    const rowHtml = (row) => {
      const isDone = groupDone(row);
      const now = planLevel(row.code);
      const from = isDone ? row.from : Math.max(row.from, now);
      const range = isDone ? `${levelRange(row.from, row.to)} · bought` : `${levelRange(from, row.to)} · ${row.to - from} left`;
      return `<div class="buy is-check plan-row${isDone ? " is-done" : ""}${row.code === planMapPick ? " is-picked" : ""}" data-plan-code="${esc(row.code)}">
        <input type="checkbox" data-plan-check="${esc(row.code)}" ${isDone ? "checked" : ""} aria-label="Mark ${esc(row.name)} bought">
        <span class="buy-copy">
          <span class="title-line">
            ${modGlyph(row.code, "order")}
            <span class="title-text">
              <strong>${esc(row.name)}</strong>
              <span class="meta">${esc(row.code)} · ${range}</span>
              <span class="meta">${mpAmount(row.costLog)}</span>
            </span>
          </span>
        </span>
      </div>`;
    };
    list.innerHTML = `
      <p class="meta plan-map-count">${left.length} to buy · ${done.length} bought</p>
      ${left.map(rowHtml).join("")}
      ${done.length ? `<p class="meta plan-map-count">Bought</p>${done.map(rowHtml).join("")}` : ""}`;
    list.querySelectorAll("[data-plan-check]").forEach((input) => {
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("change", () => {
        planMapPick = input.dataset.planCheck;
        setModBought(input.dataset.planCheck, input.checked);
      });
    });
    list.querySelectorAll("[data-plan-code]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("[data-code], [data-map]")) return;
        pickPlanMod(row.dataset.planCode, true);
      });
    });
    const codes = plan.summary.map((row) => row.code).filter((code) => MAP_NODES[code]);
    svg.innerHTML = mapNodesSvg(Object.keys(MAP_NODES)) + codes.map(planMapMarkSvg).join("");
    const stage = document.getElementById("plan-map-stage");
    stage.style.width = Math.round(MAP_SIZE.w * state.planMapZoom) + "px";
    stage.style.height = Math.round(MAP_SIZE.h * state.planMapZoom) + "px";
    bindPlanMapPointer();
    bindPlanMapPop();
    placePlanMapPop();
    if (center) {
      const focus = planMapPick || (left.find((row) => MAP_NODES[row.code]) || {}).code || codes[0];
      if (focus) scrollPlanMapTo(focus);
    }
  }

  function planMapPickRow() {
    const plan = state.plan;
    if (!plan || !planMapPick) return null;
    return plan.summary.find((row) => row.code === planMapPick) || null;
  }

  function bindPlanMapPop() {
    const pop = document.getElementById("plan-map-pop");
    if (!pop || pop.dataset.bound) return;
    pop.dataset.bound = "1";
    ["pointerdown", "pointerup", "pointermove"].forEach((type) => {
      pop.addEventListener(type, (event) => event.stopPropagation());
    });
    pop.querySelector("button").addEventListener("click", () => {
      const row = planMapPickRow();
      if (!row) return;
      setModBought(row.code, !groupDone(row));
    });
  }

  function placePlanMapPop() {
    const pop = document.getElementById("plan-map-pop");
    if (!pop) return;
    const row = planMapPickRow();
    const node = row && MAP_NODES[row.code];
    if (!node) {
      pop.hidden = true;
      return;
    }
    const done = groupDone(row);
    const half = (MAP_BIG_NODES.has(row.code) ? 25.5 : 16.5) + 3;
    pop.style.left = ((node.x + half + 6) * state.planMapZoom) + "px";
    pop.style.top = (node.y * state.planMapZoom) + "px";
    const button = pop.querySelector("button");
    button.textContent = done ? "Undo" : "Mark bought";
    button.classList.toggle("is-done", done);
    button.setAttribute("aria-label", done ? `Mark ${row.name} as not bought` : `Mark ${row.name} bought`);
    pop.hidden = false;
  }

  function planMapMarkSvg(code) {
    const node = MAP_NODES[code];
    const row = state.plan.summary.find((item) => item.code === code);
    const big = MAP_BIG_NODES.has(code);
    const isDone = groupDone(row);
    const { x, y } = node;
    const half = (big ? 25.5 : 16.5) + 3;
    const badgeTop = y + (big ? 21 : 11);
    const text = isDone ? `✓ ${shortLevel(row.to)}` : `${shortLevel(state.levels[code] || 0)}→${shortLevel(row.to)}`;
    const badgeW = Math.min(big ? 34 : 27, Math.max(big ? 27 : 21, text.length * 2.9 + 5));
    const fit = text.length * 5.8 > badgeW * 2 - 6 ? ` textLength="${badgeW * 2 - 6}" lengthAdjust="spacingAndGlyphs"` : "";
    const kind = `${isDone ? "is-done" : "is-left"}${code === planMapPick ? " is-picked" : ""}`;
    return `<g class="plan-mark ${kind}" data-code="${esc(code)}">
      <polygon class="plan-outline" points="${chamferRect(x - half, y - half, x + half, y + half, big ? 8 : 6)}"></polygon>
      <polygon class="plan-badge" points="${chamferRect(x - badgeW, badgeTop, x + badgeW, badgeTop + 15, 4)}"></polygon>
      <text x="${x}" y="${badgeTop + 11}"${fit}>${esc(text)}</text>
    </g>`;
  }

  function pickPlanMod(code, scrollMap) {
    planMapPick = planMapPick === code && !scrollMap ? "" : code;
    const list = document.getElementById("plan-map-list");
    if (list) {
      list.querySelectorAll("[data-plan-code]").forEach((row) => row.classList.toggle("is-picked", row.dataset.planCode === planMapPick));
      const picked = list.querySelector(".is-picked");
      if (picked && !scrollMap) picked.scrollIntoView({ block: "nearest" });
    }
    const svg = document.getElementById("plan-map-svg");
    if (svg) svg.querySelectorAll(".plan-mark").forEach((mark) => mark.classList.toggle("is-picked", mark.dataset.code === planMapPick));
    placePlanMapPop();
    if (scrollMap && planMapPick) scrollPlanMapTo(planMapPick);
  }

  function scrollPlanMapTo(code) {
    const node = MAP_NODES[code];
    if (!node) return;
    const go = (tries) => {
      const scroller = document.getElementById("plan-map-scroll");
      if (!scroller) return;
      if (!scroller.clientWidth && tries > 0) {
        requestAnimationFrame(() => go(tries - 1));
        return;
      }
      scroller.scrollLeft = node.x * state.planMapZoom - scroller.clientWidth / 2;
      scroller.scrollTop = node.y * state.planMapZoom - scroller.clientHeight / 2;
    };
    go(10);
    afterStyles(() => go(0));
  }

  function panPlanMapTo(code) {
    const node = MAP_NODES[code];
    const scroller = document.getElementById("plan-map-scroll");
    if (!node || !scroller) return;
    scroller.scrollTo({
      left: node.x * state.planMapZoom - scroller.clientWidth / 2,
      top: node.y * state.planMapZoom - scroller.clientHeight / 2,
      behavior: "smooth",
    });
  }

  function planMapNodeAt(clientX, clientY, anyMod) {
    const stage = document.getElementById("plan-map-stage");
    const plan = state.plan;
    if (!stage || !plan) return null;
    const rect = stage.getBoundingClientRect();
    const x = (clientX - rect.left) / state.planMapZoom;
    const y = (clientY - rect.top) / state.planMapZoom;
    const codes = anyMod ? Object.keys(MAP_NODES) : plan.summary.map((row) => row.code);
    let best = null;
    let bestDist = Infinity;
    codes.forEach((code) => {
      const node = MAP_NODES[code];
      if (!node) return;
      const reach = anyMod ? (MAP_BIG_NODES.has(code) ? 30 : 22) : (MAP_BIG_NODES.has(code) ? 38 : 27);
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist <= reach && dist < bestDist) {
        best = code;
        bestDist = dist;
      }
    });
    return best;
  }

  function paintPlanMapTip(code, clientX, clientY) {
    const tip = document.getElementById("plan-map-tip");
    if (!tip) return;
    const mod = code && effectPlaceOn("order") && MTC.MODEL.byCode[code];
    if (!mod) {
      tip.hidden = true;
      return;
    }
    const row = state.plan && state.plan.summary.find((item) => item.code === code);
    const level = state.levels[code] || 0;
    const planLine = row ? `<span>Buy order: <span class="lv">${row.from}</span> → <span class="lv">${row.to}</span>${groupDone(row) ? " · bought" : ""}</span>` : "";
    tip.innerHTML = `<span class="tip-title"><b>${esc(mod.code)}</b><span>${esc(mod.name)}</span></span>${effectHtml(code, "order")}<span>Level <span class="lv">${level}</span> / ${capLabel(mod)}</span>${planLine}`;
    tip.hidden = false;
    const width = tip.offsetWidth;
    const left = clientX + 16 + width > window.innerWidth ? clientX - 16 - width : clientX + 16;
    tip.style.left = Math.max(8, left) + "px";
    tip.style.top = (clientY + 16) + "px";
  }

  function zoomPlanMapAt(nextZoom, anchorX, anchorY) {
    const scroller = document.getElementById("plan-map-scroll");
    const stage = document.getElementById("plan-map-stage");
    const oldZoom = state.planMapZoom || 1;
    const next = Math.min(3, Math.max(0.4, nextZoom));
    if (!scroller || !stage || next === oldZoom) return;
    const ratio = next / oldZoom;
    state.planMapZoom = next;
    stage.style.width = Math.round(MAP_SIZE.w * next) + "px";
    stage.style.height = Math.round(MAP_SIZE.h * next) + "px";
    placePlanMapPop();
    scroller.scrollLeft = anchorX * ratio - (anchorX - scroller.scrollLeft);
    scroller.scrollTop = anchorY * ratio - (anchorY - scroller.scrollTop);
    saveState();
  }

  function bindPlanMapPointer() {
    const scroller = document.getElementById("plan-map-scroll");
    if (!scroller || scroller.dataset.bound) return;
    scroller.dataset.bound = "1";
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
        scroller.classList.toggle("is-over-node", !!planMapNodeAt(event.clientX, event.clientY));
        paintPlanMapTip(planMapNodeAt(event.clientX, event.clientY, true), event.clientX, event.clientY);
        return;
      }
      if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 4) drag.moved = true;
      paintPlanMapTip(null);
      scroller.scrollLeft = drag.left - (event.clientX - drag.x);
      scroller.scrollTop = drag.top - (event.clientY - drag.y);
    });
    scroller.addEventListener("pointerup", (event) => {
      const wasClick = drag && !drag.moved;
      drag = null;
      scroller.classList.remove("is-dragging");
      if (!wasClick) return;
      const code = planMapNodeAt(event.clientX, event.clientY);
      if (code) pickPlanMod(code, false);
      else if (planMapPick) pickPlanMod("", false);
    });
    scroller.addEventListener("pointercancel", () => {
      drag = null;
      scroller.classList.remove("is-dragging");
    });
    scroller.addEventListener("pointerleave", () => paintPlanMapTip(null));
    scroller.addEventListener("wheel", (event) => {
      event.preventDefault();
      paintPlanMapTip(null);
      const rect = scroller.getBoundingClientRect();
      let delta = event.deltaY;
      if (event.deltaMode === 1) delta *= 16;
      if (event.deltaMode === 2) delta *= scroller.clientHeight;
      zoomPlanMapAt(state.planMapZoom - delta * 0.0012, event.clientX - rect.left + scroller.scrollLeft, event.clientY - rect.top + scroller.scrollTop);
    }, { passive: false });
  }

  function copyList() {
    const plan = state.plan;
    if (!plan) return;
    const lines = ["CIFI mod buy order"];
    if (state.orderMode === "totals" || state.orderMode === "map") {
      plan.summary.forEach((row, index) => {
        const mark = state.orderMode === "map" ? (groupDone(row) ? "[x] " : "[ ] ") : "";
        lines.push(`${mark}${index + 1}. ${row.name} ${row.from} -> ${row.to} (${row.count}) for ${formatCost(row.costLog)} MP`);
      });
    } else {
      plan.groups.forEach((row, index) => {
        const mark = groupDone(row) ? "[x]" : "[ ]";
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
            <label><input id="icons-levels-side" type="checkbox" ${state.showIconLevels !== false ? "checked" : ""}> Show icons</label>
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
    bindIconToggle("icons-levels-side", "levels", paintLevelList);
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
      state.planBought = {};
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
          <span class="title-line">
            ${modGlyph(mod.code, "levels")}
            <span class="title-text">
              <span class="title-name"><strong>${esc(mod.name)}</strong>${maxed ? `<span class="badge">MAXED</span>` : ""}</span>
              ${effectHtml(mod.code, "levels")}
              <span class="meta" data-meta>${levelMeta(mod, owned)}</span>
            </span>
          </span>
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
    state.planBought = {};
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

  const MAP_IMAGE = "UpdatedModMap.png";
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
    "C8cb:325,237 C7cb:372,237 C6cb:420,237 C5cb:468,237 C4cb:515,237 C3cb:563,237 C2cb:611,237 C1cb:658,237 C8b:325,285 C7b:372,285 C6b:420,285 C5b:468,285 C4b:516,285 C3b:563,285 C2b:611,285 C1b:658,285 C09:706,285 C8ob:325,333 C7ob:373,333 C6ob:420,333 C5ob:468,333 C4ob:516,333 C3ob:563,333 C2ob:611,333 C1ob:659,333 C8o:659,634 C8u:707,634 C8c:755,634 C7o:659,682 C7u:707,682 C7c:755,682 C6o:659,729 C6u:707,729 C6c:755,729 C5o:658,777 C5u:706,777 C5c:754,777 C4o:658,824 C4u:706,824 C4c:754,824 C3o:361,872 C2o:409,872 C1o:457,872 C3c:361,921 C2c:409,920 C1c:457,920",
    "DU3:1355,455 DGS:1069,499 DU2:1300,511 DU1:1356,514 DGC:1069,547 D1g:1022,615 D2g:1069,615 D3g:1116,615 D4g:1165,615 D5g:1213,615 D6g:1260,614 D7g:1308,614 D8g:1356,614 D1c:1022,662 D2c:1069,662 D3c:1116,662 D4c:1165,662 D5c:1213,662 D6c:1260,661 D7c:1308,661 D8c:1356,661 D1L:1022,710 D2L:1069,710 D3L:1117,710 D4L:1165,710 D5L:1213,710 D6L:1260,709 D7L:1308,709 D8L:1356,709 D1v:1022,757 D2v:1069,757 D3v:1116,757 D4v:1165,757 D5v:1213,757 D6v:1260,757 D7v:1308,757 D8v:1356,757",
    "E31:218,424 E30:409,424 E29:218,471 E28:266,471 E27:314,471 E26:410,471 EA7:458,471 EB7:505,471 E25:218,519 E24:266,519 E23:314,519 E22:409,519 EA6:457,519 EB6:505,519 E21:218,567 E20:266,567 E19:314,567 E18:409,567 EA5:457,566 EB5:505,566 E17:218,615 E16:266,615 E15:314,615 E14:409,615 EA4:457,614 EB4:505,614 E13:218,662 E12:266,662 E11:314,662 E10:409,662 EA3:457,662 EB3:505,662 E09:217,710 E08:266,710 E07:314,710 E06:409,710 EA2:457,710 EB2:505,710 EU2:66,760 EU1:122,757 E05:218,757 E04:266,757 E03:314,757 E02:361,757 E01:409,757 EA1:457,757 EB1:505,757",
    "FU3:956,54 FU2:899,111 FU1:956,111 FU4:1013,110 F18:908,213 F17:956,213 F15:956,261 F16:1004,261 F14:908,308 F13:956,308 F11:956,356 F12:1004,356 F10:908,404 F09:956,404 F07:956,451 F08:1004,451 F06:908,499 F05:956,499 F03:956,547 F04:1004,547 F02:956,662 F01:956,757",
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

  const SCALE = 4;
  const MIN_JOIN = 12;
  const CELL = 4;
  
  function nodeBox(code) {
    const n = MAP_NODES[code];
    const m = 8;
    if (MAP_BIG_NODES.has(code)) return [n.x - 35, n.y - 34, n.x + 35, n.y + 44];
    return [n.x - 21 - m, n.y - 17 - m, n.x + 21 + m, n.y + 26 + m];
  }
  
  function components(grid, w, h) {
    const seen = new Uint8Array(grid.length);
    const comps = [];
    for (let i = 0; i < grid.length; i++) {
      if (!grid[i] || seen[i]) continue;
      const stack = [i];
      seen[i] = 1;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    while (stack.length) {
      const cur = stack.pop();
        const x = cur % w;
        const y = (cur / w) | 0;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
        if (x > 0 && grid[cur - 1] && !seen[cur - 1]) { seen[cur - 1] = 1; stack.push(cur - 1); }
        if (x + 1 < w && grid[cur + 1] && !seen[cur + 1]) { seen[cur + 1] = 1; stack.push(cur + 1); }
        if (y > 0 && grid[cur - w] && !seen[cur - w]) { seen[cur - w] = 1; stack.push(cur - w); }
        if (y + 1 < h && grid[cur + w] && !seen[cur + w]) { seen[cur + w] = 1; stack.push(cur + w); }
      }
      comps.push({ x0, y0, x1, y1 });
    }
    return comps;
  }
  
  function fillRect(grid, w, h, x0, y0, x1, y1) {
    const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
    const xb = Math.min(w - 1, Math.ceil(Math.max(x0, x1)));
    const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
    const yb = Math.min(h - 1, Math.ceil(Math.max(y0, y1)));
    for (let y = ya; y <= yb; y++) grid.fill(1, y * w + xa, y * w + xb + 1);
  }
  
  function dilate(grid, w, h, r) {
    const tmp = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const pref = new Int32Array(w + 1);
      for (let x = 0; x < w; x++) pref[x + 1] = pref[x] + grid[y * w + x];
      for (let x = 0; x < w; x++) {
        const a = Math.max(0, x - r);
        const b = Math.min(w - 1, x + r);
        if (pref[b + 1] - pref[a]) tmp[y * w + x] = 1;
      }
    }
    grid.fill(0);
    for (let x = 0; x < w; x++) {
      const pref = new Int32Array(h + 1);
      for (let y = 0; y < h; y++) pref[y + 1] = pref[y] + tmp[y * w + x];
      for (let y = 0; y < h; y++) {
        const a = Math.max(0, y - r);
        const b = Math.min(h - 1, y + r);
        if (pref[b + 1] - pref[a]) grid[y * w + x] = 1;
      }
    }
  }
  
  function erode(grid, w, h, r) {
    const tmp = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const pref = new Int32Array(w + 1);
      for (let x = 0; x < w; x++) pref[x + 1] = pref[x] + grid[y * w + x];
      for (let x = 0; x < w; x++) {
        const a = Math.max(0, x - r);
        const b = Math.min(w - 1, x + r);
        if (pref[b + 1] - pref[a] === b - a + 1) tmp[y * w + x] = 1;
      }
    }
    grid.fill(0);
    for (let x = 0; x < w; x++) {
      const pref = new Int32Array(h + 1);
      for (let y = 0; y < h; y++) pref[y + 1] = pref[y] + tmp[y * w + x];
      for (let y = 0; y < h; y++) {
        const a = Math.max(0, y - r);
        const b = Math.min(h - 1, y + r);
        if (pref[b + 1] - pref[a] === b - a + 1) grid[y * w + x] = 1;
      }
    }
  }
  
  function foreignHits(rect, foreign) {
    const [x0, y0, x1, y1] = rect;
    return foreign.filter((n) => n.x >= x0 - 7 && n.x <= x1 + 7 && n.y >= y0 - 7 && n.y <= y1 + 7).length;
  }
  
  function widestClear(start, end, cross0, cross1, horizontal, foreign) {
    let best = null;
    const limit = Math.max(start, end - 4);
    for (let a = start; a <= limit; a += 2) {
      for (let b = end; b >= a + MIN_JOIN; b -= 2) {
        const rect = horizontal ? [cross0, a, cross1, b] : [a, cross0, b, cross1];
        if (foreignHits(rect, foreign)) continue;
        const span = b - a;
        if (!best || span > best.span) best = { a, b, span };
        break;
      }
    }
    return best;
  }
  
  function placeJoin(a, b, foreign) {
    const x0 = Math.max(a.x0, b.x0);
    const x1 = Math.min(a.x1, b.x1);
    const y0 = Math.max(a.y0, b.y0);
    const y1 = Math.min(a.y1, b.y1);
    const verticalGap = a.y1 < b.y0 || b.y1 < a.y0;
    const horizontalGap = a.x1 < b.x0 || b.x1 < a.x0;
    if (x1 >= x0 && verticalGap) {
      const gap0 = Math.min(a.y1, b.y1);
      const gap1 = Math.max(a.y0, b.y0);
      const clear = widestClear(x0, x1, gap0, gap1, false, foreign);
      if (clear) return [clear.a, gap0, clear.b, gap1];
      const mid = (x0 + x1) / 2;
      return [mid - MIN_JOIN / 2, gap0, mid + MIN_JOIN / 2, gap1];
    }
    if (y1 >= y0 && horizontalGap) {
      const gap0 = Math.min(a.x1, b.x1);
      const gap1 = Math.max(a.x0, b.x0);
      const clear = widestClear(y0, y1, gap0, gap1, true, foreign);
      if (clear) return [gap0, clear.a, gap1, clear.b];
      const mid = (y0 + y1) / 2;
      return [gap0, mid - MIN_JOIN / 2, gap1, mid + MIN_JOIN / 2];
    }
    const ax = (a.x0 + a.x1) / 2;
    const ay = (a.y0 + a.y1) / 2;
    const bx = (b.x0 + b.x1) / 2;
    const by = (b.y0 + b.y1) / 2;
    return { l: true, ax, ay, bx, by };
  }
  
  function edgePixels(grid, w, h, fixed, start, end, vertical) {
    let lo = Infinity;
    let hi = -1;
    const a0 = Math.max(0, fixed - 3);
    const a1 = Math.min((vertical ? h : w) - 1, fixed + 3);
    const b0 = Math.max(0, start);
    const b1 = Math.min((vertical ? w : h) - 1, end);
    for (let a = a0; a <= a1; a++) {
      for (let b = b0; b <= b1; b++) {
        const idx = vertical ? a * w + b : b * w + a;
        if (!grid[idx]) continue;
        if (b < lo) lo = b;
        if (b > hi) hi = b;
      }
    }
    return lo <= hi ? [lo, hi] : [start, end];
  }

  function tightenJoin(grid, w, h, placed, a, b) {
    if (placed.l) return placed;
    const [x0, y0, x1, y1] = placed;
    const tall = y1 - y0 >= 45 && y1 - y0 > x1 - x0;
    const wide = x1 - x0 >= 45 && x1 - x0 > y1 - y0;
    if (!tall && !wide) return placed;
    const upper = a.y1 <= b.y1 ? a : b;
    const lower = upper === a ? b : a;
    const left = a.x1 <= b.x1 ? a : b;
    const right = left === a ? b : a;
    const span = tall
      ? overlapSpan(edgePixels(grid, w, h, upper.y1, upper.x0, upper.x1, true), edgePixels(grid, w, h, lower.y0, lower.x0, lower.x1, true))
      : overlapSpan(edgePixels(grid, w, h, left.x1, left.y0, left.y1, false), edgePixels(grid, w, h, right.x0, right.y0, right.y1, false));
    const width = span[1] - span[0];
    const capped = width <= 24 ? span : [Math.round((span[0] + span[1]) / 2 - 12), Math.round((span[0] + span[1]) / 2 + 12)];
    return tall ? [capped[0], y0, capped[1], y1] : [x0, capped[0], x1, capped[1]];
  }

  function overlapSpan(p, q) {
    const start = Math.max(p[0], q[0]);
    const end = Math.min(p[1], q[1]);
    if (end >= start) return [start, end];
    return p[1] < q[0] ? [p[1] - 6, q[0] + 6] : [q[1] - 6, p[0] + 6];
  }

  function linkAll(grid, w, h, ox, oy, foreign) {
    for (let guard = 0; guard < 16; guard++) {
      const comps = components(grid, w, h);
      if (comps.length < 2) return comps.length;
      let best = null;
      for (let i = 0; i < comps.length; i++) {
        for (let j = i + 1; j < comps.length; j++) {
          const a = comps[i], b = comps[j];
          const dx = a.x1 < b.x0 ? b.x0 - a.x1 : b.x1 < a.x0 ? a.x0 - b.x1 : 0;
          const dy = a.y1 < b.y0 ? b.y0 - a.y1 : b.y1 < a.y0 ? a.y0 - b.y1 : 0;
          const dist = dx + dy;
          if (!best || dist < best.dist) best = { dist, a, b };
        }
      }
      const placed = tightenJoin(grid, w, h, placeJoin(best.a, best.b, foreign.map((n) => ({ x: n.x - ox, y: n.y - oy }))), best.a, best.b);
      if (placed.l) {
        fillRect(grid, w, h, placed.ax - MIN_JOIN / 2, placed.ay - MIN_JOIN / 2, placed.bx + MIN_JOIN / 2, placed.ay + MIN_JOIN / 2);
        fillRect(grid, w, h, placed.bx - MIN_JOIN / 2, placed.ay - MIN_JOIN / 2, placed.bx + MIN_JOIN / 2, placed.by + MIN_JOIN / 2);
      } else {
        fillRect(grid, w, h, placed[0], placed[1], placed[2], placed[3]);
      }
    }
    return components(grid, w, h).length;
  }
  
  function trace(grid, w, h) {
    const next = new Map();
    const add = (x0, y0, x1, y1) => next.set(x0 + "," + y0, x1 + "," + y1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!grid[y * w + x]) continue;
        if (x === 0 || !grid[y * w + x - 1]) add(x, y + 1, x, y);
        if (y === 0 || !grid[(y - 1) * w + x]) add(x, y, x + 1, y);
        if (x + 1 === w || !grid[y * w + x + 1]) add(x + 1, y, x + 1, y + 1);
        if (y + 1 === h || !grid[(y + 1) * w + x]) add(x + 1, y + 1, x, y + 1);
      }
    }
    const used = new Set();
    const loops = [];
    next.forEach((_, from) => {
      if (used.has(from)) return;
      const loop = [];
      let cur = from;
      while (!used.has(cur)) {
        used.add(cur);
        loop.push(cur.split(",").map(Number));
        const nxt = next.get(cur);
        if (!nxt || nxt === from) break;
        cur = nxt;
      }
      if (next.get(cur) === from || next.get(loop.length ? loop[loop.length - 1].join(",") : "") === from) loops.push(loop);
    });
    const closed = [];
    next.forEach((_, from) => {
      if (used.has(from)) return;
    });
    // Rebuild closed loops properly.
    used.clear();
    next.forEach((_, from) => {
      if (used.has(from)) return;
      const loop = [];
      let cur = from;
      let closedLoop = false;
      for (let n = 0; n <= next.size; n++) {
        if (used.has(cur)) break;
        used.add(cur);
        loop.push(cur.split(",").map(Number));
        const nxt = next.get(cur);
        if (!nxt) break;
        if (nxt === from) { closedLoop = true; break; }
        cur = nxt;
      }
      if (closedLoop && loop.length > 2) loops.push(loop);
    });
    let best = [];
    let bestArea = 0;
    loops.forEach((loop) => {
      let area = 0;
      for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) area += loop[j][0] * loop[i][1] - loop[i][0] * loop[j][1];
      area = Math.abs(area) / 2;
      if (area > bestArea) { bestArea = area; best = loop; }
    });
    const simple = [];
    best.forEach((p, i) => {
      const prev = best[(i + best.length - 1) % best.length];
      const nxt = best[(i + 1) % best.length];
      if ((prev[0] === p[0] && p[0] === nxt[0]) || (prev[1] === p[1] && p[1] === nxt[1])) return;
      simple.push(p);
    });
    return simple;
  }
  
  function snapPath(poly) {
    const pts = [];
    poly.forEach(([x, y]) => {
      const p = [Math.round(x / CELL) * CELL, Math.round(y / CELL) * CELL];
      const prev = pts[pts.length - 1];
      if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) pts.push(p);
    });
    const simple = [];
    pts.forEach((p, i) => {
      const a = pts[(i + pts.length - 1) % pts.length];
      const c = pts[(i + 1) % pts.length];
      if ((a[0] === p[0] && p[0] === c[0]) || (a[1] === p[1] && p[1] === c[1])) return;
      simple.push(p);
    });
    return simple.length >= 4 ? simple : poly;
  }
  function sectionShape(letter) {
    const codes = Object.keys(MAP_NODES).filter((code) => code.charAt(0) === letter);
    if (!codes.length) return [];
    const foreign = Object.keys(MAP_NODES).filter((code) => code.charAt(0) !== letter).map((code) => ({ x: MAP_NODES[code].x / SCALE, y: MAP_NODES[code].y / SCALE }));
    const boxes = codes.map((code) => nodeBox(code).map((n) => n / SCALE));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    boxes.forEach(([x0, y0, x1, y1]) => {
      minX = Math.min(minX, x0); minY = Math.min(minY, y0); maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1);
    });
    const pad = 20;
    const ox = Math.max(0, Math.floor(minX) - pad);
    const oy = Math.max(0, Math.floor(minY) - pad);
    const xMax = Math.min(Math.floor((MAP_SIZE.w - 1) / SCALE), Math.ceil(maxX) + pad);
    const yMax = Math.min(Math.floor((MAP_SIZE.h - 1) / SCALE), Math.ceil(maxY) + pad);
    const w = xMax - ox + 1;
    const h = yMax - oy + 1;
    const grid = new Uint8Array(w * h);
    boxes.forEach(([x0, y0, x1, y1]) => fillRect(grid, w, h, x0 - ox, y0 - oy, x1 - ox, y1 - oy));
    dilate(grid, w, h, 6);
    erode(grid, w, h, 6);
    linkAll(grid, w, h, ox, oy, foreign);
    let poly = snapPath(trace(grid, w, h).map(([x, y]) => [(x + ox) * SCALE, (y + oy) * SCALE]));
    if (letter === "A" || letter === "C" || letter === "H" || letter === "I") {
      const others = Object.keys(MAP_NODES).filter((code) => code.charAt(0) !== letter).map((code) => MAP_NODES[code]);
      poly = fillBays(poly, others);
      poly = squareSteps(poly, others);
      if (letter === "I") poly = fillBlockedGap(poly, others);
    }
    return poly;
  }

  function pointInside(poly, x, y) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][1];
      const yj = poly[j][1];
      const xi = poly[i][0];
      const xj = poly[j][0];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }

  function fillBays(poly, foreign) {
    const pts = poly.map((p) => p.slice());
    for (let guard = 0; guard < 40; guard++) {
      let removed = false;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const c = pts[(i + 2) % pts.length];
        const d = pts[(i + 3) % pts.length];
        const abx = b[0] - a[0];
        const aby = b[1] - a[1];
        const bcx = c[0] - b[0];
        const bcy = c[1] - b[1];
        const cdx = d[0] - c[0];
        const cdy = d[1] - c[1];
        const depth = Math.abs(abx) + Math.abs(aby);
        const span = Math.abs(bcx) + Math.abs(bcy);
        const opposite = abx === -cdx && aby === -cdy;
        const perpendicular = (abx === 0 && bcy === 0) || (aby === 0 && bcx === 0);
        if (!opposite || !perpendicular || depth < 4 || depth > 100 || span > 200 || span < 4) continue;
        const x0 = Math.min(a[0], b[0], c[0]);
        const x1 = Math.max(a[0], b[0], c[0]);
        const y0 = Math.min(a[1], b[1], c[1]);
        const y1 = Math.max(a[1], b[1], c[1]);
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const inside = pointInside(pts, cx, cy);
        if (inside && depth > 8) continue;
        if (!inside && foreign.some((n) => n.x > x0 && n.x < x1 && n.y > y0 && n.y < y1)) continue;
        const drop = [(i + 1) % pts.length, (i + 2) % pts.length].sort((p, q) => q - p);
        drop.forEach((idx) => pts.splice(idx, 1));
        removed = true;
        break;
      }
      if (!removed) break;
    }
    return pts.length >= 4 ? pts : poly;
  }

  function squareSteps(poly, foreign) {
    const pts = poly.map((p) => p.slice());
    const n = pts.length;
    const jobs = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const c = pts[(i + 2) % n];
      const d = pts[(i + 3) % n];
      const abx = b[0] - a[0];
      const aby = b[1] - a[1];
      const bcx = c[0] - b[0];
      const bcy = c[1] - b[1];
      const cdx = d[0] - c[0];
      const cdy = d[1] - c[1];
      const jog = Math.abs(bcx) + Math.abs(bcy);
      const span = Math.abs(cdx) + Math.abs(cdy);
      const spanCap = jog <= 16 ? 160 : 120;
      if (jog < 4 || jog > 56 || span < 4 || span > spanCap) continue;
      if (!((abx === 0 && cdx === 0) || (aby === 0 && cdy === 0))) continue;
      if (abx * cdx + aby * cdy <= 0) continue;
      if (!((abx === 0 && bcy === 0) || (aby === 0 && bcx === 0))) continue;
      const forward = { px: aby === 0 ? d[0] : a[0], py: aby === 0 ? a[1] : d[1] };
      const back = jog <= 16 ? { px: aby === 0 ? a[0] : d[0], py: aby === 0 ? d[1] : a[1] } : null;
      const choices = [forward, back].filter(Boolean);
      for (let k = 0; k < choices.length; k++) {
        const choice = choices[k];
        const x0 = Math.min(b[0], c[0], choice.px);
        const x1 = Math.max(b[0], c[0], choice.px);
        const y0 = Math.min(b[1], c[1], choice.py);
        const y1 = Math.max(b[1], c[1], choice.py);
        if (x1 - x0 < 4 || y1 - y0 < 4) continue;
        if (pointInside(pts, (x0 + x1) / 2, (y0 + y1) / 2)) continue;
        if (foreign.some((node) => node.x > x0 && node.x < x1 && node.y > y0 && node.y < y1)) continue;
        const area = (x1 - x0) * (y1 - y0);
        jobs.push({ a: i, b: (i + 1) % n, c: (i + 2) % n, d: (i + 3) % n, px: choice.px, py: choice.py, area });
        break;
      }
    }
    const drop = new Set();
    const used = new Set();
    jobs.sort((p, q) => q.area - p.area || q.b - p.b);
    jobs.forEach((job) => {
      const idxs = [job.a, job.b, job.c, job.d];
      if (idxs.some((idx) => used.has(idx))) return;
      const next = pts[job.d];
      const prev = pts[job.a];
      const meetsPrev = job.px === prev[0] || job.py === prev[1];
      const meetsNext = job.px === next[0] || job.py === next[1];
      if (meetsPrev && meetsNext) {
        pts[job.b] = [job.px, job.py];
        drop.add(job.c);
        idxs.forEach((idx) => used.add(idx));
      }
    });
    const clean = [];
    pts.forEach((p, idx) => {
      if (drop.has(idx)) return;
      const prev = clean[clean.length - 1];
      if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) clean.push(p);
    });
    return clean.filter((p, i) => {
      const prev = clean[(i + clean.length - 1) % clean.length];
      const next = clean[(i + 1) % clean.length];
      return !((prev[0] === p[0] && p[0] === next[0]) || (prev[1] === p[1] && p[1] === next[1]));
    });
  }

  function fillBlockedGap(poly, foreign) {
    const pts = poly.map((p) => p.slice());
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i + pts.length - 1) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      const next = pts[(i + 2) % pts.length];
      if (b[0] !== c[0] || b[1] <= c[1]) continue;
      if (prev[1] !== b[1] || prev[0] <= b[0] || next[1] !== c[1] || next[0] >= c[0]) continue;
      const height = b[1] - c[1];
      const width = c[0] - next[0];
      if (height < 40 || width < 80) continue;
      const blocked = foreign.filter((node) => node.y > c[1] && node.y < b[1] && node.x > next[0] && node.x < b[0]);
      if (!blocked.length) continue;
      const limit = Math.ceil((Math.max(...blocked.map((node) => node.x)) + 44) / 4) * 4;
      if (limit >= b[0] - 24 || limit <= next[0] + 24) continue;
      if (pointInside(pts, (limit + b[0]) / 2, (c[1] + b[1]) / 2)) continue;
      if (foreign.some((node) => node.x > limit && node.x < b[0] && node.y > c[1] && node.y < b[1])) continue;
      b[0] = limit;
      c[0] = limit;
    }
    return pts;
  }

  const sectionOutlineCache = {};

  function sectionOutline(letter) {
    if (sectionOutlineCache[letter]) return sectionOutlineCache[letter];
    const loops = MAP_BLOCKS[letter] || [];
    const fallback = loops.map((loop) => "M" + loop.map((p) => p.join(",")).join("L") + "Z").join("");
    const poly = sectionShape(letter);
    const path = poly.length >= 4 ? "M" + poly.map((p) => p.join(",")).join("L") + "Z" : fallback;
    sectionOutlineCache[letter] = path;
    return path;
  }

  function blockPath(letter) {
    return '<path class="map-block" d="' + sectionOutline(letter) + '"></path>';
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

  function mapNodeSvg(code, showCode) {
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
    const codeFit = code.length > 3 ? ` textLength="${big ? 44 : 28}" lengthAdjust="spacingAndGlyphs"` : "";
    const codeMark = showCode ? `<text class="map-code" x="${x}" y="${big ? y + 2 : y + 1}"${codeFit}>${esc(code)}</text>` : "";
    return `<g class="map-mod ${kind}${big ? " is-big" : ""}">
      <polygon class="map-tile" points="${chamferRect(x - half, y - half, x + half, y + half, big ? 7 : 5)}"></polygon>
      ${codeMark}
      <polygon class="map-badge" points="${chamferRect(x - badgeW, badgeTop, x + badgeW, badgeTop + 15, 4)}"></polygon>
      <text class="map-level" x="${x}" y="${badgeTop + 11}"${fit}>${esc(text)}</text>
      ${maxed && !big ? `<text class="map-max" x="${x}" y="${y - 14}">MAX</text>` : ""}
    </g>`;
  }

  function mapNodesSvg(codes, showCode) {
    return codes.map((code) => mapNodeSvg(code, showCode)).join("");
  }

  // WIP icon map. Did a bit of it but got really tired. It was an attempt of a high resolution map built from zero.
  // Not used. Swap the scan for wipMapPictureSvg when this is ready:
  // each tile is the module icon, and a line runs to the module that unlocks it.
  function wipMapNodeSvg(code) {
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
    const icon = big ? 34 : 20;
    return `<g class="map-mod ${kind}${big ? " is-big" : ""}">
      <polygon class="map-tile" points="${chamferRect(x - half, y - half, x + half, y + half, big ? 7 : 5)}"></polygon>
      <image class="map-icon" href="${esc(modIconSrc(code))}" x="${x - icon / 2}" y="${y - half + (big ? 4 : 3)}" width="${icon}" height="${icon}" preserveAspectRatio="xMidYMid meet"></image>
      <polygon class="map-badge" points="${chamferRect(x - badgeW, badgeTop, x + badgeW, badgeTop + 15, 4)}"></polygon>
      <text class="map-level" x="${x}" y="${badgeTop + 11}"${fit}>${esc(text)}</text>
      ${maxed && !big ? `<text class="map-max" x="${x}" y="${y - 14}">MAX</text>` : ""}
    </g>`;
  }

  function wipMapLinksSvg(limit) {
    const lines = [];
    MTC.mods.forEach((mod) => {
      if (limit && !limit.has(mod.code)) return;
      const child = MAP_NODES[mod.code];
      if (!child || !mod.unlock) return;
      mod.unlock.split(",").forEach((raw) => {
        const code = raw.trim();
        if (limit && !limit.has(code)) return;
        const parent = MAP_NODES[code];
        if (!parent) return;
        lines.push(`<line x1="${parent.x}" y1="${parent.y}" x2="${child.x}" y2="${child.y}"></line>`);
      });
    });
    return `<g class="map-links">${lines.join("")}</g>`;
  }

  function wipMapPictureSvg(codes) {
    return wipMapLinksSvg(new Set(codes)) + codes.map(wipMapNodeSvg).join("");
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
          ${blockPath(letter)}
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

  let mapPick = "";

  function findModByCode(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return null;
    if (MTC.MODEL.byCode[trimmed]) return MTC.MODEL.byCode[trimmed];
    const lower = trimmed.toLowerCase();
    return MTC.mods.find((mod) => mod.code.toLowerCase() === lower) || null;
  }

  function mapLookup(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return { kind: "empty" };
    if (/^[A-I]$/i.test(trimmed)) return { kind: "block", letter: trimmed.toUpperCase() };
    const exact = findModByCode(trimmed);
    if (exact) return { kind: "mod", mod: exact };
    const query = trimmed.toLowerCase();
    const mods = MTC.mods.filter((mod) => {
      const name = mod.name.toLowerCase();
      const shortName = String(mod.shortName || "").toLowerCase();
      return name.includes(query) || shortName.includes(query) || mod.code.toLowerCase().includes(query);
    }).sort((a, b) => a.code.localeCompare(b.code));
    if (mods.length === 1) return { kind: "mod", mod: mods[0] };
    if (mods.length > 1) return { kind: "list", mods };
    return { kind: "none" };
  }

  function selectedMapMod() {
    const found = mapLookup(state.mapQuery);
    if (found.kind === "mod") return found.mod;
    if (found.kind !== "list" || !mapPick) return null;
    return found.mods.find((mod) => mod.code === mapPick) || null;
  }

  function renderMap() {
    const letters = Object.keys(MAP_BLOCKS).sort();
    app.innerHTML = `
      <div class="map-layout">
        <aside class="panel side">
          <label class="field">
            <span>Find a mod</span>
            <input id="map-query" type="text" placeholder="F03, Fast-Loop, Cradle" value="${esc(state.mapQuery)}">
          </label>
          <div class="map-hit" id="map-hit"></div>
          <div class="checks stack">
            <label><input id="effects-map-side" type="checkbox" ${state.showEffectMap !== false ? "checked" : ""}> Show what each mod does</label>
            <label><input id="icons-map-side" type="checkbox" ${state.showIconMap !== false ? "checked" : ""}> Show icons</label>
            <label><input id="show-map-blocks" type="checkbox" ${state.showMapBlocks !== false ? "checked" : ""}> Show blocks when clicked</label>
            <label><input id="show-map-codes" type="checkbox" ${state.showMapCodes ? "checked" : ""}> Show codes</label>
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
          <p class="note small">Drag to move, scroll to zoom. (PC only)</p>
        </aside>
        <div class="map-scroll" id="map-scroll">
          <div class="map-stage" id="map-stage">
            <img src="${MAP_IMAGE}" alt="Loop mod tree from the game, blocks A through I, showing your level on each mod." draggable="false">
            <svg class="map-mods" id="map-progress" viewBox="0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}" preserveAspectRatio="none" aria-hidden="true"></svg>
            <div id="map-boxes"></div>
            <div id="map-level-pop" class="map-level-pop" hidden>
              <button type="button" data-map-step="-1" aria-label="Remove one level">−</button>
              <button type="button" data-map-step="1" aria-label="Add one level">+</button>
            </div>
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
    bindIconToggle("icons-map-side", "map", () => {
      const tip = document.getElementById("map-tip");
      if (tip) tip.hidden = true;
      paintMapHit(false);
    });
    document.getElementById("show-map-blocks").addEventListener("change", (event) => {
      state.showMapBlocks = event.target.checked;
      saveState();
      paintMapHit(false);
    });
    document.getElementById("show-map-codes").addEventListener("change", (event) => {
      state.showMapCodes = event.target.checked;
      saveState();
      paintMapProgress();
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
    const levelPop = document.getElementById("map-level-pop");
    levelPop.addEventListener("pointerdown", (event) => event.stopPropagation());
    levelPop.addEventListener("pointerup", (event) => event.stopPropagation());
    levelPop.addEventListener("animationend", (event) => {
      if (event.target !== levelPop) return;
      if (event.animationName === "map-level-in" && levelPop.classList.contains("is-in")) {
        levelPop.classList.remove("is-in");
        levelPop.classList.add("is-shown");
      }
      if (event.animationName === "map-level-out" && levelPop.classList.contains("is-leaving")) {
        levelPop.classList.remove("is-leaving");
        if (!levelPop.dataset.code) levelPop.hidden = true;
      }
    });
    levelPop.addEventListener("click", (event) => {
      const button = event.target.closest("[data-map-step]");
      if (!button || button.disabled) return;
      const mod = selectedMapMod();
      if (!mod) return;
      setMapLevel(mod, (state.levels[mod.code] || 0) + Number(button.dataset.mapStep));
    });
    applyMapZoom();
    paintMapProgress();
    bindMapPointer();
    paintMapHit(true);
  }

  function paintMapProgress() {
    const layer = document.getElementById("map-progress");
    if (!layer) return;
    layer.innerHTML = mapNodesSvg(Object.keys(MAP_NODES), state.showMapCodes);
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

  function nextLevelCostHtml(mod, level) {
    if (level >= mod.max) return `<span>At max</span>`;
    const cost = MTC.logCost(mod, level);
    if (cost == null || Number.isNaN(cost)) return "";
    return `<span>Next level ${mpAmount(cost)}</span>`;
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
    tip.innerHTML = `<span class="tip-title"><b>${esc(mod.code)}</b>${modGlyph(code, "map")}<span>${esc(mod.name)}</span></span>${effectHtml(code, "map")}<span>Level <span class="lv">${level}</span> / ${capLabel(mod)}</span>${nextLevelCostHtml(mod, level)}`;
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
    placeMapLevelPop();
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
      const query = document.getElementById("map-query");
      if (!code) {
        clearMapSelection();
        return;
      }
      state.mapQuery = code;
      saveState();
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

  function clearMapSelection() {
    if (!state.mapQuery) return;
    state.mapQuery = "";
    saveState();
    const query = document.getElementById("map-query");
    if (query) query.value = "";
    paintMapHit(false);
  }

  function mapLevelNotes(mod, level, node) {
    const letter = mod.code.charAt(0).toUpperCase();
    const missing = level > 0 ? [] : missingRequirements(mod.code);
    return `<span class="hit-status">Block ${letter} · level <span class="lv">${level}</span> / ${capLabel(mod)}</span>
      ${missing.length ? `<span class="hit-status">${lockNote(missing)}</span>` : ""}
      ${node ? "" : `<span class="hit-status warn">This map image doesn't show this node, so only its block is outlined.</span>`}`;
  }

  function setMapLevel(mod, raw) {
    let value = Math.floor(Number(String(raw).replace(/,/g, ".")));
    if (!Number.isFinite(value) || value < 0) value = 0;
    if (value > mod.max) value = mod.max;
    if (value === 0) delete state.levels[mod.code];
    else state.levels[mod.code] = value;
    state.plan = null;
    state.planBought = {};
    saveState();
    const input = document.getElementById("map-level");
    if (input) input.value = String(value);
    const notes = document.getElementById("map-level-notes");
    if (notes) notes.innerHTML = mapLevelNotes(mod, value, MAP_NODES[mod.code]);
    paintMapProgress();
    placeMapLevelPop();
  }

  function placeMapLevelPop() {
    const pop = document.getElementById("map-level-pop");
    if (!pop) return;
    const mod = selectedMapMod();
    const node = mod && MAP_NODES[mod.code];
    if (!mod || !node) {
      dismissMapLevelPop(pop);
      return;
    }
    const level = state.levels[mod.code] || 0;
    const big = MAP_BIG_NODES.has(mod.code);
    const badgeTop = big ? 21 : 11;
    const below = big ? 42 : 32;
    pop.style.left = (node.x * state.mapZoom) + "px";
    pop.style.top = ((node.y + below) * state.mapZoom) + "px";
    pop.style.setProperty("--from", ((badgeTop - below) * state.mapZoom) + "px");
    pop.querySelector("[data-map-step='-1']").disabled = level <= 0;
    pop.querySelector("[data-map-step='1']").disabled = level >= mod.max;
    const settled = pop.dataset.code === mod.code && (pop.classList.contains("is-shown") || pop.classList.contains("is-in"));
    if (settled) return;
    pop.dataset.code = mod.code;
    revealMapLevelPop(pop);
  }

  function revealMapLevelPop(pop) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pop.hidden = false;
    pop.classList.remove("is-leaving");
    if (reduce) {
      pop.classList.remove("is-in");
      pop.classList.add("is-shown");
      return;
    }
    const restart = pop.classList.contains("is-in");
    pop.classList.remove("is-shown");
    if (restart) pop.classList.remove("is-in");
    if (restart) void pop.offsetWidth;
    pop.classList.add("is-in");
  }

  function dismissMapLevelPop(pop) {
    if (pop.hidden || pop.classList.contains("is-leaving")) {
      pop.dataset.code = "";
      return;
    }
    pop.dataset.code = "";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const visible = pop.classList.contains("is-shown") || pop.classList.contains("is-in");
    if (reduce || !visible) {
      pop.classList.remove("is-in", "is-shown", "is-leaving");
      pop.hidden = true;
      return;
    }
    pop.classList.add("is-leaving");
    pop.classList.remove("is-in", "is-shown");
  }

  function mapNodeMark(code, className) {
    const node = MAP_NODES[code];
    if (!node) return "";
    const radius = MAP_BIG_NODES.has(code) ? 38 : 27;
    return `<circle class="${className}" cx="${node.x}" cy="${node.y}" r="${radius}"></circle>`;
  }

  function mapFocus(mod) {
    const node = MAP_NODES[mod.code];
    if (node) return node;
    const loops = MAP_BLOCKS[mod.code.charAt(0).toUpperCase()];
    return loops ? blockBounds(loops) : null;
  }

  function mapOutline(parts) {
    const body = parts.filter(Boolean).join("");
    if (!body) return "";
    return `<svg class="map-outline" viewBox="0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}" preserveAspectRatio="none">${body}</svg>`;
  }

  function mapModPanel(mod) {
    const level = state.levels[mod.code] || 0;
    const node = MAP_NODES[mod.code];
    return `<b class="hit-code">${esc(mod.code)}</b>
      <span class="hit-name">${modGlyph(mod.code, "map")}<span>${esc(mod.name)}</span></span>
      <label class="field map-level">
        <span>Level</span>
        <span class="stepper">
          <input id="map-level" type="text" inputmode="numeric" value="${level}" aria-label="${esc(mod.code)} level">
          <span class="stepper-btns">
            <button type="button" data-step="1" aria-label="Increase ${esc(mod.code)} level">▲</button>
            <button type="button" data-step="-1" aria-label="Decrease ${esc(mod.code)} level">▼</button>
          </span>
        </span>
      </label>
      <div id="map-level-notes">${mapLevelNotes(mod, level, node)}</div>`;
  }

  function bindMapModPanel(root, mod) {
    const levelInput = root.querySelector("#map-level");
    if (!levelInput) return;
    dotsForCommas(levelInput);
    bindSteppers(root);
    levelInput.addEventListener("change", () => setMapLevel(mod, levelInput.value));
  }

  function scrollMapResult(root) {
    const button = root.querySelector(".map-result.is-on");
    const list = button && button.closest(".map-results");
    if (!button || !list) return;
    const listRect = list.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    if (buttonRect.top < listRect.top) list.scrollTop -= listRect.top - buttonRect.top;
    else if (buttonRect.bottom > listRect.bottom) list.scrollTop += buttonRect.bottom - listRect.bottom;
  }

  function paintMapHit(shouldScroll) {
    const hit = document.getElementById("map-hit");
    const boxes = document.getElementById("map-boxes");
    if (!hit || !boxes) return;
    const found = mapLookup(state.mapQuery);
    if (found.kind === "list") {
      if (mapPick && !found.mods.some((mod) => mod.code === mapPick)) mapPick = "";
    } else {
      mapPick = "";
    }
    const selected = found.kind === "mod"
      ? found.mod
      : found.kind === "list" && mapPick
        ? found.mods.find((mod) => mod.code === mapPick)
        : null;
    const activeLetter = found.kind === "block" ? found.letter : found.kind === "mod" ? found.mod.code.charAt(0).toUpperCase() : "";
    document.querySelectorAll("[data-block]").forEach((button) => {
      button.classList.toggle("is-on", !!activeLetter && button.dataset.block === activeLetter);
    });
    const showBlock = state.showMapBlocks !== false;
    let focus = null;
    if (found.kind === "empty") {
      boxes.innerHTML = "";
      hit.innerHTML = "";
      placeMapLevelPop();
      if (shouldScroll && MAP_NODES.A01) scrollMapTo(MAP_NODES.A01.x, MAP_NODES.A01.y);
      return;
    }
    if (found.kind === "none") {
      boxes.innerHTML = "";
      hit.innerHTML = `<span class="hit-status">No mods match this search.</span>`;
      placeMapLevelPop();
      return;
    }
    if (found.kind === "block") {
      const loops = MAP_BLOCKS[found.letter];
      boxes.innerHTML = mapOutline([showBlock ? blockPath(found.letter) : ""]);
      hit.innerHTML = `<b class="hit-code">Block ${found.letter}</b><span class="hit-status">${showBlock ? "Outlined on the map." : "Block outline is off."}</span>`;
      focus = blockBounds(loops);
    } else if (found.kind === "mod") {
      const letter = found.mod.code.charAt(0).toUpperCase();
      boxes.innerHTML = mapOutline([
        showBlock && MAP_BLOCKS[letter] ? blockPath(letter) : "",
        mapNodeMark(found.mod.code, "map-node"),
      ]);
      hit.innerHTML = mapModPanel(found.mod);
      bindMapModPanel(hit, found.mod);
      focus = mapFocus(found.mod);
    } else {
      const marks = found.mods.map((mod) => mod.code === mapPick ? "" : mapNodeMark(mod.code, "map-match"));
      if (selected && MAP_NODES[selected.code]) marks.push(mapNodeMark(selected.code, "map-node"));
      else if (selected && showBlock && MAP_BLOCKS[selected.code.charAt(0).toUpperCase()]) marks.push(blockPath(selected.code.charAt(0).toUpperCase()));
      boxes.innerHTML = mapOutline(marks);
      const count = `${found.mods.length} mods`;
      hit.innerHTML = `${selected ? mapModPanel(selected) : ""}<span class="hit-status">${count}</span><div class="map-results">${found.mods.map((mod) => `<button type="button" class="map-result${mod.code === mapPick ? " is-on" : ""}" data-map-pick="${esc(mod.code)}"><b>${esc(mod.code)}</b><span>${esc(mod.name)}</span></button>`).join("")}</div>`;
      if (selected) bindMapModPanel(hit, selected);
      hit.querySelectorAll("[data-map-pick]").forEach((button) => {
        button.addEventListener("click", () => {
          mapPick = button.dataset.mapPick;
          paintMapHit(true);
        });
      });
      scrollMapResult(hit);
      if (selected) focus = mapFocus(selected);
    }
    placeMapLevelPop();
    if (shouldScroll && focus) scrollMapTo(focus.x, focus.y);
  }

  function scrollMapTo(x, y) {
    const scroller = document.getElementById("map-scroll");
    if (!scroller) return;
    const place = () => {
      scroller.scrollLeft = x * state.mapZoom - scroller.clientWidth / 2;
      scroller.scrollTop = y * state.mapZoom - scroller.clientHeight / 2;
    };
    place();
    if (!scroller.clientWidth) requestAnimationFrame(place);
    afterStyles(place);
  }

  function afterStyles(fn) {
    if (window.__cssReady) window.__cssReady.then(() => requestAnimationFrame(fn));
  }

  function infoButton(id) {
    return `<button type="button" class="info-btn" aria-expanded="false" aria-controls="${id}" aria-label="How this is used">?</button>`;
  }

  function infoBox(id, html) {
    return `<div class="info-box" id="${id}" hidden>${html}</div>`;
  }

  function closeInfoBoxes() {
    let wasOpen = false;
    document.querySelectorAll(".info-box").forEach((box) => {
      if (!box.hidden) wasOpen = true;
      box.hidden = true;
    });
    document.querySelectorAll(".info-btn").forEach((button) => {
      button.classList.remove("is-on");
      button.setAttribute("aria-expanded", "false");
    });
    return wasOpen;
  }

  function bindInfoBoxes(root) {
    root.querySelectorAll(".info-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const box = document.getElementById(button.getAttribute("aria-controls"));
        const willOpen = box.hidden;
        closeInfoBoxes();
        if (!willOpen) return;
        box.hidden = false;
        button.classList.add("is-on");
        button.setAttribute("aria-expanded", "true");
      });
    });
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
          <h3>Weights ${infoButton("info-weights")}</h3>
          ${infoBox("info-weights", `
            <p>Each weight is an exponent on that kind of bonus. Power multiplies a mod's nine cell bonuses, each raised to Cells, then mod points, shards, research, academy points, and materials raised to their own weights. The combined bonus, from Time Dilation and Rule of Time Management, is raised to Cells + Mod points + (Generator MK5 × Shards) + (Generator MK6 × Research) + the Generator MK8 level. Cost reduction is separate: fifteen cost-reduction bonuses are scaled by fixed factors, that sum is multiplied by the Cost reduction weight, and the result is the exponent of 1.05.</p>
            <p>Rank points sets the base of the seven ship terms: 1 + Rank points divided by 5, 2.5, 2, 8, 4, 5, and 10, for Cradle through Zeus. Cells is in every numerator. Mod points joins from Zagreus on, shards from Demeter, research from Koios, and academy points and materials on Zeus. Cells, mod points, and shards also scale the loop-point term, as the exponent of 2. A loop bonus is multiplied by the square root of loops filled + 1, divided by 2000, and raised to the Mod points weight. A second term raises 1.1 to a bonus times the Mod points weight squared, divided by 10000.</p>
            <p>A Cells weight of exactly 1 turns the cell bonus of Looper-Cell MK1 and MK2 off. An Academy weight of exactly 1 does the same for Helion's academy bonus and Rule of Productivity. A higher weight makes that bonus move the buy order more. The defaults are the sheet's recommended values.</p>
          `)}
          <div class="dense" id="weights"></div>
          <h3>Run stats ${infoButton("info-stats")}</h3>
          ${infoBox("info-stats", `
            <p>These numbers scale the next level of particular mods. Where a stat is an exponent or a multiplied growth, 0 makes that bonus 1, so the planner treats the mod as having nothing to add.</p>
            <p>Player level is the exponent on Alpha, Ceti, Epsilon, Fenix, Gamma, Helion, Rule of Destruction, Rule of Perseverance, Rule of the Swarm, and Rule of Productivity. It multiplies Level Enhancement MK1 through MK8. Beta feeds max(1, level − 42) into the loop terms, and Helion multiplies those terms by player level and by Helion's own level.</p>
            <p>Loops filled multiplies the MK1–MK8 Looper modules, and it is the exponent of Rule of Looping. It is also the exponent of Looper-Cell MK1 and MK2 while Cells is anything other than exactly 1. Beta's and Helion's loop bonuses are then multiplied by the square root of loops filled + 1 and raised to the Mod points weight. Loop resets is the exponent of the MK1–MK8 Loop Reset Growth modules, Print-Efficiency Accumulator A, and Morag's Thesis on Looping.</p>
            <p>Operations done multiplies the Cell and Shard Efficiency Operation modules. Studies done multiplies The Rule of Persistence. Equipment bought is the exponent of Equipment Analysis, whose base is (1.14 + 0.04 × its level) / (1.1 + 0.04 × its level). Total research levels is the exponent of Gaiden's Law of Growth. Completed researches is the exponent of Research Progression. Software tech multiplies Tech Software Scaling MK1.</p>
            <p>Shard tickspeed is shared inside each Time Dilation pair of formulas. Modules 1–4 divide (8 − tickspeed − their levels / 10) by that same amount minus 0.1. Modules 5–8 divide (3 − tickspeed − their levels / 100) by that same amount minus 0.01. A higher tickspeed makes the next level a larger multiplier. The LP doubler bar is added to a mod's own loop points. Full bars are floor((bar + points) / 10), and the remainder of the mod's own points is added after dividing it by 100. That count, times Cells + Mod points + Shards, is the exponent of 2.</p>
          `)}
          <div class="dense" id="scalars"></div>
          <h3>Manual generators ${infoButton("info-manuals")}</h3>
          ${infoBox("info-manuals", `
            <p>MK1 through MK8 are added into one total. That total is the exponent on the cell bonus of the next level of Accumulative Level Growth Alpha (each level grows by 1.06), Delta (1.12), and Rule of the Swarm (1.11). At 0, that cell bonus stays 1. Alpha and Rule of the Swarm still raise their other bonuses with player level. Delta's calculated bonus is this cell term.</p>
          `)}
          <div class="dense" id="manuals"></div>
        </section>
        <div class="settings-side">
          <section class="panel">
            <h3 class="first">Ship rank and crew ${infoButton("info-ships")}</h3>
            ${infoBox("info-ships", `
              <p>Rank is the exponent of that ship's Rank Benefits module for Cradle, Auxesia, Hephaestus, Demeter, Koios, and Zeus, so a higher rank makes the next level much stronger. Cradle rank is also the exponent of Rule of the Cradle. Zagreus Rank Benefits has no rank exponent, so Zagreus rank is used in the denominator that follows. Every ship's rank sits in the denominator of that ship's rank-point term on every mod: 30 + rank + the ship's Rank Point Transmission level. Cradle, Auxesia, and Demeter add 3 × Accumulative Level Growth Delta. A higher rank makes each rank-point gain smaller. Hephaestus uses the larger of that denominator and its square divided by 45, and a Hephaestus rank below 1 counts as 1.</p>
              <p>Crew is the exponent of that ship's Crew Motivation module, in ship order: Cradle, Auxesia, Zagreus, Hephaestus, Demeter, Koios, and Zeus.</p>
            `)}
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
    bindInfoBoxes(app);
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
        <button type="button" tabindex="-1" data-step="1" aria-label="Increase ${esc(label)}">▲</button>
        <button type="button" tabindex="-1" data-step="-1" aria-label="Decrease ${esc(label)}">▼</button>
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
    const title = row.querySelector(".title-name");
    const badge = title.querySelector(".badge");
    if (maxed && !badge) title.insertAdjacentHTML("beforeend", `<span class="badge">MAXED</span>`);
    if (!maxed && badge) badge.remove();
    const meta = row.querySelector("[data-meta]");
    if (meta) meta.innerHTML = levelMeta(mod, level);
    const fill = row.querySelector("[data-fill]");
    if (fill) fill.style.width = `${levelFill(mod, level)}%`;
  }

  function modIconFile(code, name) {
    if (code === "A01" || code === "A04" || code === "A05" || code === "A06" || code === "A09") return "LM-LoopMods-128.png";
    if (code === "A02") return "DailyReward-128.png";
    if (code === "A03") return "Arcade-128.png";
    if (code === "A07" || code === "A10") return "LM-LoopModSGained-128.png";
    if (code === "A08") return "LM-Ruleof7-128.png";
    if (code === "A11") return "LM-LoopModSpecial1-128.png";
    if (code === "A12") return "Arcade-Upgrade-Sabotage-128.png";
    if (code === "A13") return "snail.png";
    if (code === "B02" || code === "B10") return "LevelPoints-128.png";
    if (code === "B11") return "RegularPresetsIcons_1.png";
    if (code === "DGC" || code === "DGS") return "RegularPresetsIcons_6.png";
    if (code === "DU1") return "45.png";
    if (code === "DU2") return "07.png";
    if (code === "DU3") return "78.png";
    if (code === "FU1") return "94.png";
    if (code === "FU2") return "42.png";
    if (code === "FU3") return "97-2.png";
    if (code === "FU4") return "76.png";
    if (/^D\dL$/.test(code) || code === "H09" || code === "H30") return "LM-CellsPerTick.png";
    if (/^D\dv$/.test(code)) return "mozy.png";
    if (code === "F02") return "LM-LoopModGoalGrowth-128.png";
    if (/^F(04|06|08|10|12|14|16|18)$/.test(code)) return "LM-LoopModsGrowth.png";
    if (/^F(03|05|07|09|11|13|15|17)$/.test(code)) return "LM-Special2-128.png";
    if (code === "EU1") return "87.png";
    if (code === "EU2") return "09.png";
    if (/^EB\d$/.test(code)) return "Automation-Plus.png";
    if (/^EA\d$/.test(code)) return "Automation-RankPoints.png";
    if (/^E(01|06|10|14|18|22|26|30)$/.test(code)) return "RankPoints-128.png";
    if (/^E(03|07|11|15|19|23|27)$/.test(code)) return "LM-ShipRankBonus-128.png";
    if (code === "E04") return "Crew-TheCradle-256.png";
    if (code === "E08") return "Crew-TheAuxesia-256.png";
    if (code === "E12") return "Crew-TheZagreus-256.png";
    if (code === "E16") return "Crew-TheHephaestus-256.png";
    if (code === "E20") return "Crew-TheDemeter-256.png";
    if (code === "E24") return "Crew-TheKoios-256.png";
    if (code === "E28") return "Crew-TheAres-256.png";
    if (code === "G08") return "PhaseOne-128.png";
    if (code === "G09") return "PhaseTwo-128.png";
    if (code === "G10") return "PhaseThree-128.png";
    if (code === "G11") return "PhaseFour-128.png";
    if (code === "G12") return "PhaseFive-128.png";
    if (code === "G13") return "PhaseSix-128.png";
    if (code === "G22") return "LM-ResearchPointsPerOperation-128.png";
    if (code === "G24") return "minotaur (2).png";
    if (code === "G25") return "robot (5).png";
    if (code === "G26") return "alien (3).png";
    if (code === "G27") return "Icon_Jump1.png";
    if (code === "GU1") return "54.png";
    if (code === "H10" || code === "H16" || code === "H19") return "qualitative-research.png";
    if (code === "H11" || code === "H12") return "BioScientist-128.png";
    if (code === "H13") return "research 1.png";
    if (code === "H14") return "neural.png";
    if (code === "H15") return "analysis.png";
    if (code === "H17") return "idea.png";
    if (code === "H18") return "genetics.png";
    if (code === "H20") return "qualitative-research (2).png";
    if (code === "H21") return "LM-Special1128.png";
    if (code === "I02") return "AcademyPoints-128.png";
    if (code === "I04") return "icon_Score.png";
    if (code === "I06") return "Materials.png";
    if (code === "IU1") return "62.png";
    if (code === "IU2") return "64.png";
    if (code === "IU3") return "26.png";
    if (code === "I18" || code === "I32") return "LevelPoints-128.png";
    if (/^I(08|09|10|11|12)$/.test(code)) return "RegularPresetsIcons_9.png";
    if (/^I(13|14|15|16|17)$/.test(code)) return "personal-data.png";
    if (/^I(19|20|21|22|23|24)$/.test(code)) return "Icon_Rank.png";
    if (code === "I25") return "Acadimmeh-128.png";
    if (code === "I26") return "shape-design-90.png";
    if (code === "I27") return "AdTokens-128.png";
    if (/^I(28|29|30|31)$/.test(code)) return "supplier.png";
    if (code === "IU4") return "52.png";
    if (code === "IC1") return "planet-P1.png";
    if (code === "IC2") return "planet-P2.png";
    if (code === "IC3") return "planet-P3.png";
    if (code === "IC4") return "planet-P4.png";
    if (/Time Dilation/i.test(name)) return "LM-TickTime-128.png";
    if (/Duo Output/i.test(name)) return "LM-DuoOutput-128.png";
    if (/Quad Output/i.test(name)) return "LM-QuadOutput-128.png";
    if (/Production Cost/i.test(name)) return "LM-GeneratorCost-128.png";
    if (/Bulk Construction/i.test(name)) return "LM-GeneratorAmount-128.png";
    if (/Generator MK/i.test(name)) return "LM-NewGenerator-128.png";
    if (/Gen Enhancement/i.test(name)) return "LM-GeneratorOutput-128.png";
    if (/MP Connection/i.test(name)) return "LM-MPConnection-128.png";
    if (/Loop Reset Growth/i.test(name)) return "LM-ResetGrowth.png";
    if (/Looper-Cell/i.test(name)) return "LM-CellLoopExponent-128.png";
    if (/Looper Module/i.test(name)) return "LM-LoopMods-128.png";
    if (/Venture Module/i.test(name)) return "LM-GeneratorOutput-128.png";
    if (/Algorithm: Cells/i.test(name)) return "LM-LoopModsGrowth.png";
    if (/Algorithm: Shards/i.test(name)) return "LM-LoopModSGained-128.png";
    if (/Rank Point/i.test(name)) return "LM-ShipRankPoint-256.png";
    if (/Rank Benefits/i.test(name)) return "ICON_Trophy.png";
    if (/Crew Motivation/i.test(name)) return "person.png";
    if (/Bulk .*Automation/i.test(name)) return "ICON_Plus.png";
    if (/Bio-Scientists Cost/i.test(name)) return "LM-GeneratorCost-128.png";
    if (/Bio-Scientist/i.test(name)) return "LM-ResearchPointsPerOperation-128.png";
    if (/Cost Modification/i.test(name)) return "LM-MultipleGeneratorCost-128.png";
    if (/Automation/i.test(name)) return "LM-TechSoftwareScaler-128.png";
    if (/Fast-Loop/i.test(name)) return "LM-CellGain-128.png";
    if (/Mod Point Optimization/i.test(name)) return "ModPoints.png";
    if (/G-Corp/i.test(name)) return "LM-CellGain-128.png";
    if (/Print-Efficiency/i.test(name)) return "LM-ResetGrowth.png";
    if (/Unlock Modification/i.test(name)) return "LM-NewGenerator-128.png";
    if (/Instant Diamond/i.test(name)) return "ResourceDiamond-128.png";
    if (/Instant (LP|Innovation)/i.test(name)) return "LM-Special1128.png";
    if (/Cell Loop/i.test(name)) return "LM-CellLoopExponent-128.png";
    if (/Trinity/i.test(name)) return "LM-Special2-128.png";
    if (/Level Growth|Level Enhancement/i.test(name)) return "LM-OutputPerPlayerLevel-128.png";
    if (/Software Scaling/i.test(name)) return "LM-TechSoftwareScaler-128.png";
    if (/Mining Headquarters/i.test(name)) return "LM-MiningHeadquarters-128.png";
    if (/Fabrication Improvement/i.test(name)) return "LM-RobotAmountMultiplicative-128.png";
    if (/Fabrication/i.test(name)) return "LM-RobotAmount-128.png";
    if (/Robotic Miners/i.test(name)) return "LM-RoboticMiner-128.png";
    if (/Shard Mining/i.test(name)) return "LM-ShardGain-128.png";
    if (/Completion Efficiency/i.test(name)) return "LM-LoopModGoalGrowth-128.png";
    if (/Cell Efficiency Operation/i.test(name)) return "LM-CellsPerOperation-256.png";
    if (/Shard Efficiency Operation/i.test(name)) return "LM-ShardsPerOperation-128.png";
    if (/Cell Multiplication/i.test(name)) return "LM-CellGain-128.png";
    if (/Quick-Study|Research Progression|Multi-Tasking|Gaiden|Printable Genetics|Rule of Persistence/i.test(name)) return "LM-ResearchPointsPerOperation-128.png";
    if (/Morag/i.test(name)) return "LM-ResetGrowth.png";
    if (/Equipment Analysis|Mutual Mining/i.test(name)) return "LM-ShardGain-128.png";
    if (/Secret to Everybody/i.test(name)) return "LM-Special1128.png";
    if (/Ahead of the Curve/i.test(name)) return "LM-Special2-128.png";
    if (/Ultima Loop/i.test(name)) return "LM-LoopModSpecial1-128.png";
    return "LM-LoopMods-128.png";
  }

  function modIconSrc(code) {
    const mod = MTC.MODEL.byCode[code];
    const file = modIconFile(code, mod ? mod.name : "");
    return file === "ModPoints.png" ? "ModPoints.png" : "icons/" + encodeURI(file);
  }

  function modGlyph(code, place) {
    if (place && !iconPlaceOn(place)) return "";
    return `<span class="mod-glyph"><img src="${modIconSrc(code)}" alt=""></span>`;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  paintTabs();
  render();
  bootSync();
})();
