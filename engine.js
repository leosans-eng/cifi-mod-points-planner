/* Greedy mod planner matching Mod Tree Cultivator v1.2.0.11 (pre-Ouro). */
(function () {
  const DATA = window.MTC_DATA;
  const PRIORITY = { A02: true, A03: true, G22: true };
  const CR_WEIGHTS = [2.75, 0.45, 0.25, 0.2, 0.15, 0.1, 0.05, 0.01, 1, 2.375, 4.75, 3.25, 2.1, 2.5, 10];
  const OUTER_NAMES = [
    "Accumulative Level Growth Module Delta",
    "Cradle Rank Point Transmission",
    "Auxesia Rank Point Transmission",
    "Zagreus Rank Point Transmission",
    "Hephaestus Rank Point Transmission",
    "Demeter Rank Point Transmission",
    "Koios Rank Point Transmission",
    "Zeus Rank Point Transmission",
    "Technology Advancement: Generator MK4",
    "Technology Advancement: Generator MK5",
    "Technology Advancement: Generator MK6",
    "Technology Advancement: Generator MK7",
    "Technology Advancement: Generator MK8",
  ];
  const SUFFIXES = [
    ["d", 33], ["n", 30], ["o", 27], ["sp", 24], ["sx", 21], ["qu", 18],
    ["qa", 15], ["t", 12], ["b", 9], ["m", 6], ["k", 3],
  ];

  function clampMin1(x) {
    return x < 1 ? 1 : x;
  }

  function bigLog(raw) {
    const text = String(raw).trim();
    const sci = text.match(/^([+-]?\d+(?:\.\d+)?)[eE]([+-]?\d+)$/);
    if (sci) {
      const mantissa = Number(sci[1]);
      const exp = Number(sci[2]);
      if (mantissa === 0) return -Infinity;
      return Math.log10(Math.abs(mantissa)) + exp;
    }
    const value = Number(text);
    if (!Number.isFinite(value) || value <= 0) return NaN;
    return Math.log10(value);
  }

  function bigValue(raw) {
    const text = String(raw).trim();
    const sci = text.match(/^([+-]?\d+(?:\.\d+)?)[eE]([+-]?\d+)$/);
    if (sci) {
      const exp = Number(sci[2]);
      if (Math.abs(exp) > 308) return Infinity;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : Infinity;
  }

  function snapFloor(linear) {
    if (!Number.isFinite(linear) || linear <= 0) return NaN;
    const nearest = Math.round(linear);
    if (nearest > 0 && Math.abs(linear - nearest) <= Math.max(linear, 1) * 1e-9) return nearest;
    return Math.floor(linear + 1e-12);
  }

  function logCost(mod, level) {
    if (level >= mod.max) return null;
    const scLog = mod.scLog;
    const cgLog = mod.cgLog;
    const sb = mod.sb;
    const bg = mod.bg;
    const base = sb + level * bg;
    let analytic = NaN;
    if (Number.isFinite(scLog) && Number.isFinite(cgLog) && base > 0) {
      const growthTerm = level === 0 ? 0 : Math.log10(1 + level * Math.pow(10, cgLog - scLog));
      analytic = scLog + growthTerm + level * Math.log10(base);
    }
    if (mod.code === "IU3" && Number.isFinite(analytic)) {
      let result = analytic;
      if (level >= 20) return result;
      if (level >= 19) return result + 11 * (level + 4);
      if (level >= 18) return result + 11 * (level + 1);
      if (level >= 17) return result + 11 * (level - 2);
      if (level >= 16) return result + 11 * (level - 4);
      if (level >= 15) return result + 11 * (level - 6);
      if (level >= 14) return result + 11 * (level - 7);
      if (level >= 13) return result + 11 * (level - 8);
      if (level >= 10) return result + 11 * (level - 9);
      return result;
    }
    const sc = mod.sc;
    const cg = mod.cg;
    if (Number.isFinite(sc) && Number.isFinite(cg) && base > 0) {
      const linear = (sc + level * cg) * Math.pow(base, level);
      const floored = snapFloor(linear);
      if (Number.isFinite(floored) && floored > 0) return Math.log10(floored);
    }
    return Number.isFinite(analytic) ? analytic : null;
  }

  function subLog(logA, logB) {
    if (!Number.isFinite(logA) || !Number.isFinite(logB)) return null;
    if (logB > logA + 1e-9) return null;
    const diff = logB - logA;
    if (diff > -1e-12) return -Infinity;
    const inner = 1 - Math.pow(10, diff);
    if (inner <= 0) return -Infinity;
    return logA + Math.log10(inner);
  }

  function addLog(logA, logB) {
    if (!Number.isFinite(logA)) return logB;
    if (!Number.isFinite(logB)) return logA;
    const max = Math.max(logA, logB);
    const min = Math.min(logA, logB);
    return max + Math.log10(1 + Math.pow(10, min - max));
  }

  function formatLog(log) {
    if (log === -Infinity || !Number.isFinite(log)) return "0";
    if (log < 0) {
      const value = Math.pow(10, log);
      if (value >= 0.01) return value.toFixed(2);
      return value.toExponential(2).replace("e+", "e");
    }
    if (log < 36) {
      const exp = Math.floor(log / 3) * 3;
      const suffixes = { 0: "", 3: "k", 6: "m", 9: "b", 12: "t", 15: "qa", 18: "qu", 21: "sx", 24: "sp", 27: "o", 30: "n", 33: "d" };
      const mantissa = Math.pow(10, log - exp);
      return mantissa.toFixed(2) + (suffixes[exp] || "");
    }
    const mantissa = Math.pow(10, log - Math.floor(log));
    return mantissa.toFixed(2) + "e" + Math.floor(log);
  }

  function parseMp(text, asLog) {
    const clean = String(text).trim().toLowerCase().replace(/,/g, ".").replace(/\s+/g, "");
    if (!clean) return null;
    if (asLog) {
      const log = Number(clean);
      return Number.isFinite(log) ? log : null;
    }
    const sci = clean.match(/^([+-]?\d+(?:\.\d+)?)(?:e([+-]?\d+))?([a-z]*)$/);
    if (!sci) return null;
    const mantissa = Number(sci[1]);
    if (!Number.isFinite(mantissa) || mantissa < 0) return null;
    let log = mantissa === 0 ? -Infinity : Math.log10(mantissa);
    if (sci[2]) log += Number(sci[2]);
    const suffix = sci[3] || "";
    if (suffix) {
      const found = SUFFIXES.find((pair) => pair[0] === suffix);
      if (!found) return null;
      log += found[1];
    }
    return log;
  }

  function unformat(input) {
    if (typeof input === "number") return input;
    const text = String(input).trim().toLowerCase().replace(/,/g, ".");
    if (!text) return NaN;
    const sci = text.match(/^([+-]?\d+(?:\.\d+)?)(?:e([+-]?\d+))?([a-z]*)$/);
    if (!sci) return Number(text);
    let value = Number(sci[1]);
    if (sci[2]) value *= Math.pow(10, Number(sci[2]));
    if (sci[3]) {
      const found = SUFFIXES.find((pair) => pair[0] === sci[3]);
      if (!found) return NaN;
      value *= Math.pow(10, found[1]);
    }
    return value;
  }

  function subLogValues(start, decrease) {
    if (!Number.isFinite(start) || !Number.isFinite(decrease)) throw new Error("sublog");
    const max = Math.max(start, decrease);
    const min = Math.min(start, decrease);
    const inner = 1 - Math.pow(10, min - max);
    if (!(inner > 0)) throw new Error("sublog");
    return max + Math.log10(inner);
  }

  function compileFormula(src) {
    let i = 0;
    const s = src;
    function skip() {
      while (s[i] === " " || s[i] === "\n" || s[i] === "\t") i++;
    }
    function parseCmp() {
      let left = parseAdd();
      for (;;) {
        skip();
        const ops = [">=", "<=", "<>", ">", "<", "="];
        let op = null;
        for (const candidate of ops) {
          if (s.startsWith(candidate, i)) { op = candidate; break; }
        }
        if (!op) break;
        i += op.length;
        const right = parseAdd();
        const prev = left;
        left = (ctx) => {
          const a = prev(ctx);
          const b = right(ctx);
          let ok = false;
          if (op === "=") ok = a === b;
          else if (op === "<>") ok = a !== b;
          else if (op === ">") ok = a > b;
          else if (op === ">=") ok = a >= b;
          else if (op === "<") ok = a < b;
          else ok = a <= b;
          return ok ? 1 : 0;
        };
      }
      return left;
    }
    function parseAdd() {
      let left = parseMul();
      for (;;) {
        skip();
        const op = s[i];
        if (op !== "+" && op !== "-") break;
        i++;
        const right = parseMul();
        const prev = left;
        left = op === "+" ? (ctx) => prev(ctx) + right(ctx) : (ctx) => prev(ctx) - right(ctx);
      }
      return left;
    }
    function parseMul() {
      let left = parseUnary();
      for (;;) {
        skip();
        const op = s[i];
        if (op !== "*" && op !== "/") break;
        i++;
        const right = parseUnary();
        const prev = left;
        left = op === "*" ? (ctx) => prev(ctx) * right(ctx) : (ctx) => prev(ctx) / right(ctx);
      }
      return left;
    }
    function parseUnary() {
      skip();
      if (s[i] === "-") {
        i++;
        const inner = parseUnary();
        return (ctx) => -inner(ctx);
      }
      if (s[i] === "+") {
        i++;
        return parseUnary();
      }
      return parsePrimary();
    }
    function parsePrimary() {
      skip();
      if (s[i] === "(") {
        i++;
        const inner = parseCmp();
        skip();
        if (s[i] !== ")") throw new Error("missing ) in " + src);
        i++;
        return inner;
      }
      if (s[i] === '"') {
        i++;
        let text = "";
        while (i < s.length && s[i] !== '"') text += s[i++];
        if (s[i] !== '"') throw new Error("missing quote");
        i++;
        return () => text;
      }
      if (/[0-9.]/.test(s[i] || "")) {
        const start = i;
        while (/[0-9.]/.test(s[i] || "")) i++;
        if ((s[i] === "e" || s[i] === "E") && /[0-9+-]/.test(s[i + 1] || "")) {
          i++;
          if (s[i] === "+" || s[i] === "-") i++;
          while (/[0-9]/.test(s[i] || "")) i++;
        }
        const num = Number(s.slice(start, i));
        return () => num;
      }
      if (/[A-Za-z_]/.test(s[i] || "")) {
        const start = i;
        while (/[A-Za-z0-9_.]/.test(s[i] || "")) i++;
        const name = s.slice(start, i);
        skip();
        if (s[i] === "(") {
          i++;
          const args = [];
          skip();
          if (s[i] !== ")") {
            for (;;) {
              args.push(parseCmp());
              skip();
              if (s[i] === ",") { i++; continue; }
              break;
            }
          }
          skip();
          if (s[i] !== ")") throw new Error("missing ) after " + name);
          i++;
          return compileCall(name, args, src);
        }
        return (ctx) => {
          if (!Object.prototype.hasOwnProperty.call(ctx.vars, name)) {
            throw new Error("unknown " + name);
          }
          return ctx.vars[name];
        };
      }
      throw new Error("bad formula at " + i + ": " + src);
    }
    skip();
    const fn = parseCmp();
    skip();
    if (i < s.length) throw new Error("trailing " + s.slice(i) + " in " + src);
    return fn;
  }

  function compileCall(name, args, src) {
    const upper = name.toUpperCase();
    if (upper === "MAX") return (ctx) => Math.max(...args.map((arg) => arg(ctx)));
    if (upper === "POW") return (ctx) => Math.pow(args[0](ctx), args[1](ctx));
    if (upper === "LOG10") return (ctx) => Math.log10(args[0](ctx));
    if (upper === "SQRT") return (ctx) => Math.sqrt(args[0](ctx));
    if (upper === "VALUE") return (ctx) => Number(args[0](ctx));
    if (upper === "UNFORMAT_NF") return (ctx) => unformat(args[0](ctx));
    if (upper === "SUB_LOG_NF") return (ctx) => subLogValues(args[0](ctx), args[1](ctx));
    if (upper === "MOD_CODE_TO_LEVEL_NF") {
      return (ctx) => {
        const code = args[0](ctx);
        const mod = ctx.byCode[code];
        if (!mod) throw new Error("missing " + code);
        return mod.level;
      };
    }
    if (upper === "IF") {
      return (ctx) => (args[0](ctx) ? args[1](ctx) : args[2](ctx));
    }
    if (upper === "SUM") return (ctx) => args.reduce((total, arg) => total + Number(arg(ctx)), 0);
    if (upper === "IFERROR") {
      return (ctx) => {
        try {
          const value = args[0](ctx);
          if (typeof value === "number" && !Number.isFinite(value)) throw new Error("nonfinite");
          return value;
        } catch (err) {
          return args[1](ctx);
        }
      };
    }
    throw new Error("unknown call " + name + " in " + src);
  }

  function prepareMods() {
    const mods = DATA.mods.map((raw, index) => {
      const formulas = [];
      Object.keys(raw.f || {}).forEach((key) => {
        const src = raw.f[key];
        const codes = [];
        const re = /MOD_CODE_TO_LEVEL_NF\(\s*"([^"]+)"\s*\)/g;
        let match;
        while ((match = re.exec(src))) codes.push(match[1]);
        formulas.push({
          index: Number(key),
          src,
          fn: compileFormula(src),
          codes,
          usesTotal: src.indexOf("ModLevels_Total") !== -1,
        });
      });
      return {
        index,
        name: raw.name,
        shortName: raw.short,
        code: raw.code,
        unlock: raw.unlock || "",
        max: raw.max,
        sc: bigValue(raw.sc),
        cg: bigValue(raw.cg),
        sb: bigValue(raw.sb),
        bg: bigValue(raw.bg),
        scLog: bigLog(raw.sc),
        cgLog: bigLog(raw.cg),
        baseBonus: raw.b.slice(),
        formulas,
        level: 0,
        ignored: false,
        powerLog: -1e308,
        bonus: raw.b.slice(),
        p0: raw.p0,
        s0: raw.s0,
        c0: raw.c0,
      };
    });
    const byCode = {};
    const byName = {};
    mods.forEach((mod) => {
      byCode[mod.code] = mod;
      byName[mod.name] = mod;
      if (mod.shortName) byName[mod.shortName] = byName[mod.shortName] || mod;
    });
    const outer = new Set(OUTER_NAMES.map((name) => byName[name] && byName[name].code).filter(Boolean));
    const watchers = {};
    const totalWatchers = [];
    mods.forEach((mod) => {
      mod.formulas.forEach((formula) => {
        formula.codes.forEach((code) => {
          if (!watchers[code]) watchers[code] = new Set();
          watchers[code].add(mod.index);
        });
        if (formula.usesTotal) totalWatchers.push(mod.index);
      });
    });
    return { mods, byCode, byName, outer, watchers, totalWatchers };
  }

  const MANUAL_SUM = "SUM(ModValues_mk1,ModValues_mk2,ModValues_mk3,ModValues_mk4,ModValues_mk5,ModValues_mk6,ModValues_mk7,ModValues_mk8)";
  const MANUAL_RATES = { F04: "1.06", F10: "1.12", FU4: "1.11" };
  Object.keys(MANUAL_RATES).forEach((code) => {
    const mod = DATA.mods.find((item) => item.code === code);
    if (!mod) return;
    const rate = MANUAL_RATES[code];
    const grown = "(1 + (" + rate + "-1) * ";
    const level = 'MOD_CODE_TO_LEVEL_NF("' + code + '")';
    mod.f = mod.f || {};
    mod.f["0"] = "IFERROR(POW(" + grown + "(" + level + " + 1))," + MANUAL_SUM + ") / POW(" + grown + level + ")," + MANUAL_SUM + "), SUB_LOG_NF((LOG10(" + grown + "MAX(1, " + level + " + 1))) * " + MANUAL_SUM + "), (LOG10(" + grown + level + ")) * " + MANUAL_SUM + ")))";
  });

  const MODEL = prepareMods();

  function defaultProgress() {
    return {
      level: 0,
      loops: 0,
      resets: 0,
      ops: 0,
      studies: 0,
      tickspeed: 0,
      equipment: 0,
      levels: 0,
      researches: 0,
      swTech: 0,
      doubler: 0,
      manual: { mk1: 0, mk2: 0, mk3: 0, mk4: 0, mk5: 0, mk6: 0, mk7: 0, mk8: 0 },
      weights: { cells: 1, mp: 12, shards: 10, research: 8, ap: 24, mats: 72, cr: 6, rp: 1 },
      rank: { cra: 0, aux: 0, zag: 0, hep: 0, dem: 0, koi: 0, zeu: 0 },
      crew: { cra: 0, aux: 0, zag: 0, hep: 0, dem: 0, koi: 0, zeu: 0 },
      ci: 50,
      affordOnly: true,
      unlockedOnly: false,
    };
  }

  function manualCount(progress, key) {
    const manual = progress && progress.manual;
    const value = manual ? Number(manual[key]) : 0;
    return Number.isFinite(value) ? value : 0;
  }

  function formatCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    if (abs === 0) return "0";
    if (abs < 1000) {
      if (Math.abs(abs - Math.round(abs)) < 1e-6) return sign + String(Math.round(abs));
      return sign + abs.toFixed(2).replace(/\.?0+$/, "");
    }
    return sign + formatLog(Math.log10(abs));
  }

  function parseCount(text) {
    const value = unformat(String(text == null ? "" : text).trim());
    return Number.isFinite(value) ? value : null;
  }

  function modLevelsTotal() {
    let total = 0;
    for (const mod of MODEL.mods) total += mod.level;
    const a13 = MODEL.byCode.A13 ? MODEL.byCode.A13.level : 0;
    const iu4 = MODEL.byCode.IU4 ? MODEL.byCode.IU4.level : 0;
    return total - a13 - iu4;
  }

  function makeCtx(progress) {
    const vars = {
      ModLevels_Total: modLevelsTotal(),
      ModValues_Level: progress.level,
      ModValues_Loops: progress.loops,
      ModValues_Resets: progress.resets,
      ModValues_Ops: progress.ops,
      ModValues_Studies: progress.studies,
      ModValues_Tickspeed: progress.tickspeed,
      ModValues_Equipment: progress.equipment,
      ModValues_Levels: progress.levels,
      ModValues_Researches: progress.researches,
      ModValues_SWTech: progress.swTech,
      ModValues_mk1: manualCount(progress, "mk1"),
      ModValues_mk2: manualCount(progress, "mk2"),
      ModValues_mk3: manualCount(progress, "mk3"),
      ModValues_mk4: manualCount(progress, "mk4"),
      ModValues_mk5: manualCount(progress, "mk5"),
      ModValues_mk6: manualCount(progress, "mk6"),
      ModValues_mk7: manualCount(progress, "mk7"),
      ModValues_mk8: manualCount(progress, "mk8"),
      Weight_Cells: progress.weights.cells,
      Weight_AP: progress.weights.ap,
      Rank_Cra: progress.rank.cra,
      Rank_Aux: progress.rank.aux,
      Rank_Zag: progress.rank.zag,
      Rank_Hep: progress.rank.hep,
      Rank_Dem: progress.rank.dem,
      Rank_Koi: progress.rank.koi,
      Rank_Zeu: progress.rank.zeu,
      Crew_Cra: progress.crew.cra,
      Crew_Aux: progress.crew.aux,
      Crew_Zag: progress.crew.zag,
      Crew_Hep: progress.crew.hep,
      Crew_Dem: progress.crew.dem,
      Crew_Koi: progress.crew.koi,
      Crew_Zeu: progress.crew.zeu,
    };
    return { vars, byCode: MODEL.byCode, progress };
  }

  function evalBonuses(mod, ctx) {
    const bonus = mod.baseBonus.slice();
    for (const formula of mod.formulas) {
      try {
        const value = formula.fn(ctx);
        bonus[formula.index] = typeof value === "number" ? value : Number(value);
      } catch (err) {
        bonus[formula.index] = NaN;
      }
    }
    mod.bonus = bonus;
    return bonus;
  }

  function powerOf(mod, ctx) {
    if (!(mod.level < mod.max)) return 0;
    const bonus = mod.bonus;
    const w = ctx.progress.weights;
    let cell = 1;
    for (let i = 0; i < 9; i++) cell *= Math.pow(clampMin1(bonus[i]), w.cells);
    const resourceWeights = [w.mp, w.shards, w.research, w.ap, w.mats];
    let resource = 1;
    for (let i = 0; i < 5; i++) resource *= Math.pow(clampMin1(bonus[9 + i]), resourceWeights[i]);
    const levelOf = (name) => clampMin1(MODEL.byName[name] ? MODEL.byName[name].level : 0);
    const levelDelta = levelOf("Accumulative Level Growth Module Delta");
    const levelCra = levelOf("Cradle Rank Point Transmission");
    const levelAux = levelOf("Auxesia Rank Point Transmission");
    const levelZag = levelOf("Zagreus Rank Point Transmission");
    const levelHep = levelOf("Hephaestus Rank Point Transmission");
    const levelDem = levelOf("Demeter Rank Point Transmission");
    const levelKoi = levelOf("Koios Rank Point Transmission");
    const levelZeu = levelOf("Zeus Rank Point Transmission");
    const mk4 = levelOf("Technology Advancement: Generator MK4");
    const mk5 = levelOf("Technology Advancement: Generator MK5");
    const mk6 = levelOf("Technology Advancement: Generator MK6");
    const mk7 = levelOf("Technology Advancement: Generator MK7");
    const mk8 = levelOf("Technology Advancement: Generator MK8");
    const rank = ctx.progress.rank;
    const hepRank = clampMin1(rank.hep);
    let crSum = 0;
    for (let i = 0; i < 15; i++) crSum += clampMin1(bonus[25 + i]) * CR_WEIGHTS[i];
    const costReduction = Math.pow(1.05, crSum * w.cr);
    const lp = bonus[14];
    const doubler = ctx.progress.doubler;
    const hepDenom = Math.max(30 + hepRank + levelHep, Math.pow(30 + hepRank + levelHep, 2) / 45);
    return cell * resource
      * Math.pow(2, (Math.floor((doubler + lp) / 10) + (lp % 10) / 100) * (w.cells + w.mp + w.shards))
      * Math.pow(1 + w.rp / 5, bonus[15] * w.cells * 29 / (30 + rank.cra + levelCra + levelDelta * 3))
      * Math.pow(1 + w.rp / 2.5, bonus[16] * w.cells * (55 + 13 * (mk4 + mk5 + mk6 + mk7 + mk8)) / (30 + rank.aux + levelAux + levelDelta * 3))
      * Math.pow(1 + w.rp / 2, bonus[17] * (w.cells * 35 + w.mp * 6) / (30 + rank.zag + levelZag))
      * Math.pow(1 + w.rp / 8, bonus[18] * (w.cells * 85 + w.mp * 7) / hepDenom)
      * Math.pow(1 + w.rp / 4, bonus[19] * (w.cells * 27 + w.mp + w.shards * 9) / (30 + rank.dem + levelDem + levelDelta * 3))
      * Math.pow(1 + w.rp / 5, bonus[20] * (w.cells * 29 + w.mp * 7 + w.shards * 7 + w.research * 3) / (30 + rank.koi + levelKoi))
      * Math.pow(1 + w.rp / 10, bonus[21] * (w.cells * 15 + w.mp * 12 + w.shards * 8 + w.research * 8 + w.ap * 4 + w.mats * 2) / (30 + rank.zeu + levelZeu))
      * Math.pow(clampMin1(bonus[22]), w.cells + w.mp + mk5 * w.shards + mk6 * w.research + mk8)
      * Math.pow(1 + bonus[23] * Math.sqrt(ctx.progress.loops + 1) / 2000, w.mp)
      * Math.pow(1.1, bonus[24] * w.mp * w.mp / 10000)
      * costReduction;
  }

  function toPowerLog(power) {
    if (power === 0) return -1e308;
    const log = Math.log10(power);
    return Number.isFinite(log) ? log : 308;
  }

  function recompute(mod, ctx) {
    evalBonuses(mod, ctx);
    mod.powerLog = toPowerLog(powerOf(mod, ctx));
  }

  function recomputeAll(progress) {
    const ctx = makeCtx(progress);
    for (const mod of MODEL.mods) recompute(mod, ctx);
  }

  function isUnlocked(mod) {
    if (mod.code === "A01" || mod.code === "G22") return true;
    if (!mod.unlock) return false;
    const comma = mod.unlock.indexOf(",");
    const has = (code) => {
      const other = MODEL.byCode[code.trim()];
      return !!(other && other.level > 0);
    };
    if (comma === -1) return has(mod.unlock);
    return has(mod.unlock.slice(0, comma)) && has(mod.unlock.slice(comma + 1));
  }

  function scoreOf(mod, logMp, progress) {
    if (mod.ignored) return null;
    if (!(mod.level < mod.max)) return null;
    if (progress.unlockedOnly && !isUnlocked(mod)) return null;
    const cost = logCost(mod, mod.level);
    if (cost == null || !Number.isFinite(cost)) return null;
    if (progress.affordOnly && cost > logMp + 1e-8) return null;
    if (PRIORITY[mod.code]) return { mod, cost, score: 99999 };
    const ci = progress.ci / 100;
    const score = mod.powerLog * ci * (logMp - cost) + mod.powerLog * (1 - ci);
    if (!Number.isFinite(score)) return null;
    return { mod, cost, score };
  }

  function bestBuy(logMp, progress) {
    let best = null;
    for (const mod of MODEL.mods) {
      const scored = scoreOf(mod, logMp, progress);
      if (!scored) continue;
      if (!best || scored.score > best.score || (scored.score === best.score && mod.index < best.mod.index)) {
        best = scored;
      }
    }
    return best;
  }

  function invalidate(mod, ctx) {
    const dirty = new Set();
    dirty.add(mod.index);
    const watched = MODEL.watchers[mod.code];
    if (watched) watched.forEach((index) => dirty.add(index));
    if (MODEL.outer.has(mod.code)) {
      for (const other of MODEL.mods) dirty.add(other.index);
    } else {
      for (const index of MODEL.totalWatchers) dirty.add(index);
    }
    dirty.forEach((index) => recompute(MODEL.mods[index], ctx));
  }

  function applyLevels(levelMap) {
    for (const mod of MODEL.mods) {
      const value = levelMap[mod.code];
      mod.level = value ? Math.max(0, Math.min(mod.max, Math.floor(Number(value)))) : 0;
    }
  }

  function snapshotLevels() {
    const levels = {};
    for (const mod of MODEL.mods) {
      if (mod.level > 0) levels[mod.code] = mod.level;
    }
    return levels;
  }

  function plan(options) {
    const progress = Object.assign({}, options.progress, { affordOnly: true });
    const started = performance.now();
    applyLevels(options.levels || {});
    for (const mod of MODEL.mods) mod.ignored = !!(options.ignored && options.ignored[mod.code]);
    recomputeAll(progress);
    let logMp = options.logMp;
    const startLog = logMp;
    const groups = [];
    let steps = 0;
    const limit = options.limit || 20000;
    let stopped = false;
    while (steps < limit) {
      if (performance.now() - started > 2500) { stopped = true; break; }
      const best = bestBuy(logMp, progress);
      if (!best) break;
      const nextLog = subLog(logMp, best.cost);
      if (nextLog == null) break;
      const from = best.mod.level;
      const unlocked = isUnlocked(best.mod);
      logMp = nextLog;
      best.mod.level += 1;
      steps += 1;
      invalidate(best.mod, makeCtx(progress));
      const last = groups[groups.length - 1];
      if (last && last.code === best.mod.code && last.to === from) {
        last.to = best.mod.level;
        last.count += 1;
        last.costLog = addLog(last.costLog, best.cost);
        last.endLogMp = logMp;
      } else {
        groups.push({
          code: best.mod.code,
          name: best.mod.name,
          shortName: best.mod.shortName,
          from,
          to: best.mod.level,
          count: 1,
          costLog: best.cost,
          endLogMp: logMp,
          unlocked,
        });
      }
    }
    if (steps >= limit) stopped = true;
    let nextGoal = null;
    if (!stopped) {
      const scoreLog = Number.isFinite(logMp) ? logMp : 0;
      const goal = bestBuy(scoreLog, Object.assign({}, progress, { affordOnly: false }));
      if (goal && goal.cost > logMp + 1e-8) {
        nextGoal = {
          code: goal.mod.code,
          name: goal.mod.name,
          from: goal.mod.level,
          to: goal.mod.level + 1,
          costLog: goal.cost,
          shortLog: Number.isFinite(logMp) ? subLog(goal.cost, logMp) : goal.cost,
          unlocked: isUnlocked(goal.mod),
        };
      }
    }
    const summary = [];
    const summaryIndex = new Map();
    for (const group of groups) {
      let row = summaryIndex.get(group.code);
      if (!row) {
        row = {
          code: group.code,
          name: group.name,
          shortName: group.shortName,
          from: group.from,
          to: group.to,
          count: 0,
          costLog: -Infinity,
          unlocked: group.unlocked,
        };
        summaryIndex.set(group.code, row);
        summary.push(row);
      }
      row.to = group.to;
      row.count += group.count;
      row.costLog = addLog(row.costLog, group.costLog);
    }
    applyLevels(options.levels || {});
    return {
      groups,
      summary,
      steps,
      stopped,
      nextGoal,
      leftLog: logMp,
      startLog,
      ms: Math.round(performance.now() - started),
    };
  }

  function selfTest() {
    const progress = defaultProgress();
    applyLevels({});
    recomputeAll(progress);
    let powerMiss = 0;
    let scoreMiss = 0;
    let costMiss = 0;
    let firstPower = null;
    let firstScore = null;
    const logMp = 1;
    for (const mod of MODEL.mods) {
      if (mod.p0 != null && Math.abs(mod.powerLog - mod.p0) > 0.002) {
        powerMiss += 1;
        if (!firstPower) firstPower = mod.code + " got " + mod.powerLog + " expected " + mod.p0;
      }
      const cost = logCost(mod, 0);
      if (mod.c0 != null && cost != null && Math.abs(cost - mod.c0) > 0.002 && mod.c0 !== -999) {
        costMiss += 1;
      }
      const scored = scoreOf(mod, logMp, progress);
      const score = scored ? scored.score : null;
      if (mod.s0 != null && score != null && Math.abs(score - mod.s0) > 0.01) {
        scoreMiss += 1;
        if (!firstScore) firstScore = mod.code + " got " + score + " expected " + mod.s0;
      }
    }
    const sample = plan({
      logMp: parseMp("1000", false),
      levels: {},
      progress,
      limit: 500,
    });
    return {
      mods: MODEL.mods.length,
      powerMiss,
      scoreMiss,
      costMiss,
      firstPower,
      firstScore,
      sampleSteps: sample.steps,
      sampleMs: sample.ms,
      sampleFirst: sample.groups.slice(0, 8).map((group) => group.code + " x" + group.count),
    };
  }

  function parseLevelCell(text) {
    if (text == null) return null;
    const cleaned = String(text).trim().replace(/,/g, ".");
    if (!/^\d+(?:\.0+)?$/.test(cleaned)) return null;
    return Math.floor(Number(cleaned));
  }

  function levelBeside(cells, index) {
    const after = parseLevelCell(cells[index + 1]);
    if (after != null) return after;
    const before = parseLevelCell(cells[index - 1]);
    if (before != null) return before;
    return null;
  }

  function parseLevelPaste(text) {
    const byName = new Map();
    MODEL.mods.forEach((mod) => {
      byName.set(mod.name.toLowerCase(), mod);
      if (mod.shortName) byName.set(mod.shortName.toLowerCase(), mod);
    });
    const updates = [];
    const skipped = [];
    String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) return;
      const cells = line.includes("\t") ? line.split("\t").map((cell) => cell.trim()) : null;
      const parsed = cells ? pasteFromCells(cells, byName) : pasteFromLoose(line, byName);
      if (parsed === "header") return;
      if (!parsed) {
        skipped.push(line);
        return;
      }
      const level = Math.max(0, Math.min(parsed.mod.max, parsed.level));
      updates.push({ code: parsed.mod.code, level });
    });
    return { updates, skipped };
  }

  function pasteFromCells(cells, byName) {
    const labels = cells.map((cell) => cell.toLowerCase());
    if (labels.includes("code") && (labels.includes("level") || labels.includes("name"))) return "header";
    let mod = null;
    let index = -1;
    for (let i = 0; i < cells.length; i++) {
      const found = MODEL.byCode[cells[i]];
      if (found) {
        mod = found;
        index = i;
        break;
      }
    }
    if (!mod) {
      for (let i = 0; i < cells.length; i++) {
        const found = byName.get(cells[i].toLowerCase());
        if (found) {
          mod = found;
          index = i;
          break;
        }
      }
    }
    if (!mod) return null;
    const level = levelBeside(cells, index);
    if (level == null) return null;
    return { mod, level };
  }

  function pasteFromLoose(line, byName) {
    const codeMatch = line.match(/^([A-Za-z][A-Za-z0-9]*)\s*[,;]?\s+(\d+)\s*$/);
    if (codeMatch && MODEL.byCode[codeMatch[1]]) {
      return { mod: MODEL.byCode[codeMatch[1]], level: Number(codeMatch[2]) };
    }
    const tail = line.match(/^(.*?)[,;]?\s+(\d+)\s*$/);
    if (!tail) return null;
    const mod = byName.get(tail[1].trim().toLowerCase());
    if (!mod) return null;
    return { mod, level: Number(tail[2]) };
  }

  window.MTC = {
    DATA,
    MODEL,
    defaultProgress,
    parseMp,
    formatLog,
    formatCount,
    parseCount,
    plan,
    selfTest,
    snapshotLevels,
    applyLevels,
    logCost,
    isUnlocked,
    parseLevelPaste,
    mods: MODEL.mods,
  };
})();
