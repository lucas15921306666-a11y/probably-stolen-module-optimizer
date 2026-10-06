window.PS_OPT = (() => {
  const { BOARD, SHAPES, MODULES, EFFECTS, compatibleEffects } = window.PS_DATA;

  const trunc0 = x => x < 0 ? Math.ceil(x) : Math.floor(x);
  const cloneStats = s => ({p:s.p, e:s.e, q:s.q});
  const addStats = (a,b) => ({p:a.p+b.p, e:a.e+b.e, q:a.q+b.q});
  const scaleStats = (s,k) => ({p:s.p*k, e:s.e*k, q:s.q*k});
  const truncStats = s => ({p:trunc0(s.p), e:trunc0(s.e), q:trunc0(s.q)});

  function normalizeCells(cells) {
    const minX = Math.min(...cells.map(c => c[0]));
    const minY = Math.min(...cells.map(c => c[1]));
    return cells.map(([x,y]) => [x-minX,y-minY])
      .sort((a,b) => a[1]-b[1] || a[0]-b[0]);
  }

  function transformCells(cells, rot, flip) {
    let out = cells.map(([x,y]) => [x,y]);
    if (flip) out = out.map(([x,y]) => [-x,y]);
    for (let i=0; i<rot; i++) out = out.map(([x,y]) => [-y,x]);
    return normalizeCells(out);
  }

  function uniqueOrientations(shapeId) {
    const src = SHAPES[shapeId].cells;
    const seen = new Set();
    const out = [];

    // Game modules are directional pieces: rotate only, never mirror.
    // This is especially important for the reverse-L "横条形" and P-shape.
    for (let rot=0; rot<4; rot++) {
      const cells = transformCells(src,rot,false);
      const key = cells.map(c=>c.join(",")).join(";");
      if (seen.has(key)) continue;
      seen.add(key);
      const w = Math.max(...cells.map(c=>c[0]))+1;
      const h = Math.max(...cells.map(c=>c[1]))+1;
      out.push({cells,w,h,key});
    }
    return out;
  }

  const ORIENTATIONS = {};
  Object.keys(SHAPES).forEach(id => ORIENTATIONS[id] = uniqueOrientations(id));

  function effectCombos(enabled) {
    const ids = [...enabled];
    const combos = [[]];
    ids.forEach(a => combos.push([a]));
    for (let i=0; i<ids.length; i++) {
      for (let j=i+1; j<ids.length; j++) {
        const c = [ids[i], ids[j]];
        if (compatibleEffects(c)) combos.push(c);
      }
    }
    return combos;
  }

  function intrinsicStats(base, effects) {
    let s = cloneStats(base);
    let scalar = 1;
    if (effects.includes("premium")) scalar *= 1.2;
    if (effects.includes("inferior")) scalar *= 0.8;
    if (effects.includes("overcharged")) scalar *= 2;
    if (effects.includes("degrading")) scalar *= 2;
    if (effects.includes("negativeFeedback")) scalar *= 1.25;
    s = truncStats(scaleStats(s, scalar));

    if (effects.includes("learning")) {
      s = {
        p: s.p > 0 ? trunc0(s.p * 2) : s.p,
        e: s.e > 0 ? trunc0(s.e * 2) : s.e,
        q: s.q > 0 ? trunc0(s.q * 2) : s.q
      };
    }
    return s;
  }

  function generateCandidates(settings) {
    const combos = effectCombos(settings.enabledEffects);
    const out = [];
    let serial = 0;

    for (const typeId of settings.enabledModules) {
      const m = MODULES[typeId];
      if (!m) continue;

      for (const [shapeId, base] of m.variants) {
        if (m.kind === "node") {
          out.push({
            id: `c${serial++}`,
            typeId, shapeId, effects: ["supportNode"],
            base: cloneStats(base), intrinsic: cloneStats(base),
            kind: "node",
            area: SHAPES[shapeId].cells.length,
            orientations: ORIENTATIONS[shapeId]
          });
          continue;
        }

        for (const effects of combos) {
          out.push({
            id: `c${serial++}`,
            typeId, shapeId, effects: [...effects],
            base: cloneStats(base),
            intrinsic: intrinsicStats(base, effects),
            kind: "normal",
            area: SHAPES[shapeId].cells.length,
            orientations: ORIENTATIONS[shapeId]
          });
        }
      }
    }
    return out;
  }

  function powerEstimate(basePower, efficiency, rounding) {
    const raw = Math.max(0, basePower * (1 - efficiency / 100));
    if (rounding === "floor") return Math.floor(raw);
    if (rounding === "round") return Math.round(raw);
    return Math.ceil(raw);
  }

  function makeEmptyBoard() {
    return new Int16Array(BOARD.cols * BOARD.rows).fill(-1);
  }

  const idx = (x,y) => y*BOARD.cols+x;

  function rebuildBoard(modules) {
    const board = makeEmptyBoard();
    modules.forEach((m,mi) => m.cells.forEach(([x,y]) => board[idx(x,y)] = mi));
    return board;
  }

  function canPlace(board, cells) {
    for (const [x,y] of cells) {
      if (x<0 || y<0 || x>=BOARD.cols || y>=BOARD.rows) return false;
      if (board[idx(x,y)] !== -1) return false;
    }
    return true;
  }

  function randomPlacement(candidate, board, rng, attempts=12) {
    const ors = candidate.orientations;
    for (let a=0; a<attempts; a++) {
      const o = ors[Math.floor(rng()*ors.length)];
      const maxX = BOARD.cols - o.w;
      const maxY = BOARD.rows - o.h;
      if (maxX < 0 || maxY < 0) continue;
      const x0 = Math.floor(rng()*(maxX+1));
      const y0 = Math.floor(rng()*(maxY+1));
      const cells = o.cells.map(([x,y]) => [x+x0,y+y0]);
      if (canPlace(board,cells)) return {cells, orientation:o.key};
    }
    return null;
  }

  function adjacencyFromBoard(board, modules) {
    const sets = Array.from({length: modules.length}, () => new Set());
    for (let y=0; y<BOARD.rows; y++) {
      for (let x=0; x<BOARD.cols; x++) {
        const a = board[idx(x,y)];
        if (a < 0) continue;
        if (x+1<BOARD.cols) {
          const b = board[idx(x+1,y)];
          if (b>=0 && b!==a) { sets[a].add(b); sets[b].add(a); }
        }
        if (y+1<BOARD.rows) {
          const b = board[idx(x,y+1)];
          if (b>=0 && b!==a) { sets[a].add(b); sets[b].add(a); }
        }
      }
    }
    return sets;
  }

  function evaluateLayout(modules, settings) {
    const board = rebuildBoard(modules);
    const adj = adjacencyFromBoard(board, modules);
    const preNF = new Array(modules.length);

    // First pass: intrinsic + edge mounts + receiver.
    for (let i=0; i<modules.length; i++) {
      const m = modules[i];
      const c = m.candidate;
      if (c.kind === "node") {
        preNF[i] = {p:0,e:0,q:0};
        continue;
      }

      let mult = 1;
      if (c.effects.includes("topMount") && m.cells.some(([x,y]) => y===0)) mult *= 1.2;
      if (c.effects.includes("sideMount") && m.cells.some(([x,y]) => x===0)) mult *= 1.2;

      if (c.effects.includes("receiver")) {
        let nodes = 0;
        adj[i].forEach(j => { if (modules[j].candidate.kind === "node") nodes++; });
        mult *= (1 + 0.10 * nodes);
      }

      preNF[i] = truncStats(scaleStats(c.intrinsic, mult));
    }

    // Second pass: negative feedback absorbs 25% of adjacent negative attributes.
    const normalFinal = preNF.map(cloneStats);
    for (let i=0; i<modules.length; i++) {
      const c = modules[i].candidate;
      if (c.kind !== "normal" || !c.effects.includes("negativeFeedback")) continue;
      let delta = {p:0,e:0,q:0};
      adj[i].forEach(j => {
        const n = preNF[j];
        if (n.p < 0) delta.p += n.p * .25;
        if (n.e < 0) delta.e += n.e * .25;
        if (n.q < 0) delta.q += n.q * .25;
      });
      normalFinal[i] = truncStats(addStats(normalFinal[i], delta));
    }

    // Third pass: support nodes copy 20% of each adjacent normal module once.
    const finalStats = normalFinal.map(cloneStats);
    for (let i=0; i<modules.length; i++) {
      if (modules[i].candidate.kind !== "node") continue;
      let s = {p:0,e:0,q:0};
      adj[i].forEach(j => {
        if (modules[j].candidate.kind !== "normal") return;
        s = addStats(s, scaleStats(normalFinal[j], .20));
      });
      finalStats[i] = truncStats(s);
    }

    let total = {p:0,e:0,q:0};
    finalStats.forEach(s => total = addStats(total,s));

    const power = powerEstimate(settings.basePower, total.e, settings.powerRounding);

    let deficit = 0;
    let maxObjective = 0;
    let targetSurplus = 0;
    let constraintCount = 0;
    const metrics = ["p","e","q"];

    metrics.forEach(k => {
      const mode = settings.targets[k].mode;
      const target = Number(settings.targets[k].value) || 0;
      const val = total[k];
      const scale = Math.max(Math.abs(target), k==="q" ? 25 : 50, 1);

      if (mode === "min") {
        constraintCount++;
        if (val < target) {
          deficit += (target-val)/scale;
        } else {
          // Reward surplus only on axes the user actually selected.
          // Ignored axes remain completely absent from the objective.
          targetSurplus += (val-target)/scale;
        }
      } else if (mode === "max") {
        const defaultScale = k==="q" ? 50 : 100;
        maxObjective += val/defaultScale;
      }
    });

    if (settings.usePowerTarget) {
      constraintCount++;
      if (power > settings.powerTarget) {
        deficit += (power-settings.powerTarget)/Math.max(settings.powerTarget,1);
      }
    }

    const feasible = deficit <= 1e-9;
    const unstableCount = modules.filter(m =>
      m.candidate.effects.includes("overcharged") ||
      m.candidate.effects.includes("degrading")
    ).length;

    // Hard constraints always come first.
    // Optional lexicographic objective:
    //   1) satisfy all hard constraints,
    //   2) minimize module count,
    //   3) among equal-count solutions, maximize selected MAX metrics.
    const minimizeMode = !!settings.minimizeModules && constraintCount > 0;

    const score = feasible
      ? (minimizeMode
          // Strict practical lexicographic order:
          // 1) feasible,
          // 2) fewer modules by a huge margin,
          // 3) selected objectives only.
          //
          // Ignored axes are COMPLETELY absent here. A one-module solution
          // with E=-500 can beat a two-module solution with E=0 when E is ignored.
          ? 1e15 - modules.length*1e12 + maxObjective*1e6 + targetSurplus*1e5
          // Normal mode: selected MAX axes and surplus on selected MIN axes.
          // No ignored-axis term and no "toward zero" term.
          : 1e9 + maxObjective*1e5 + targetSurplus*1e4 - modules.length*0.01)
      : -deficit*1e8 + maxObjective*1e4 + targetSurplus*1e3 - modules.length*0.01;

    return {
      total, power, feasible, deficit, maxObjective, targetSurplus, score, minimizeMode,
      finalStats, adjacency: adj, board, unstableCount
    };
  }

  function staticUtility(candidate, settings) {
    if (candidate.kind === "node") return 0.015;

    let s = cloneStats(candidate.intrinsic);
    let optimistic = 1;
    if (candidate.effects.includes("topMount")) optimistic *= 1.2;
    if (candidate.effects.includes("sideMount")) optimistic *= 1.2;
    if (candidate.effects.includes("receiver")) optimistic *= 1.2;
    s = scaleStats(s, optimistic);

    // IMPORTANT: an ignored axis is a true free axis.
    // It contributes exactly 0 regardless of whether it is +500, 0, or -500.
    let u = 0;
    for (const k of ["p","e","q"]) {
      const t = settings.targets[k];
      if (t.mode === "ignore") continue;

      const scale = t.mode === "min"
        ? Math.max(Math.abs(Number(t.value)||0), k==="q"?25:50, 1)
        : (k==="q" ? 50 : 100);

      u += s[k] / scale;
    }

    // Efficiency only matters through power if the user explicitly enabled a power target.
    if (settings.usePowerTarget) u += s.e / 100;

    return u / Math.max(candidate.area,1);
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function cloneModules(mods) {
    return mods.map(m => ({
      candidate: m.candidate,
      cells: m.cells.map(c=>[c[0],c[1]]),
      orientation: m.orientation
    }));
  }

  function exactSignature(modules) {
    return modules.map(m => {
      const cells = m.cells.map(c=>c.join(",")).sort().join("|");
      return `${m.candidate.typeId}/${m.candidate.shapeId}/${m.candidate.effects.join("+")}@${cells}`;
    }).sort().join(";");
  }

  function compositionSignature(modules) {
    const count = new Map();
    modules.forEach(m => {
      const k = `${m.candidate.typeId}/${m.candidate.shapeId}/${m.candidate.effects.join("+")}`;
      count.set(k,(count.get(k)||0)+1);
    });
    return [...count].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${k}*${v}`).join(";");
  }

  function resultRecord(modules, settings) {
    const evaluation = evaluateLayout(modules, settings);
    return {
      modules: cloneModules(modules),
      evaluation,
      signature: exactSignature(modules),
      composition: compositionSignature(modules)
    };
  }

  function insertBest(best, record, limit) {
    if (best.some(r => r.signature === record.signature)) return;
    best.push(record);
    best.sort((a,b) => b.evaluation.score - a.evaluation.score);
    if (best.length > limit) best.length = limit;
  }

  function sampleCandidate(sortedCandidates, nodeCandidates, rng) {
    if (nodeCandidates.length && rng() < 0.12) {
      return nodeCandidates[Math.floor(rng()*nodeCandidates.length)];
    }
    // Squared random strongly prefers high static utility but never fully excludes the tail.
    const r = rng();
    const i = Math.min(sortedCandidates.length-1, Math.floor(r*r*sortedCandidates.length));
    return sortedCandidates[i];
  }

  function buildOne(sortedCandidates, nodeCandidates, settings, rng, cfg) {
    const modules = [];
    let board = makeEmptyBoard();
    let current = evaluateLayout(modules, settings);
    let rejectStreak = 0;

    for (let step=0; step<cfg.maxSteps; step++) {
      const proposals = [];

      for (let t=0; t<cfg.samplesPerStep; t++) {
        const cand = sampleCandidate(sortedCandidates,nodeCandidates,rng);
        const placement = randomPlacement(cand,board,rng,10);
        if (!placement) continue;

        const temp = {
          candidate: cand,
          cells: placement.cells,
          orientation: placement.orientation
        };

        modules.push(temp);
        const ev = evaluateLayout(modules,settings);
        modules.pop();

        proposals.push({temp,ev});
      }

      if (!proposals.length) break;
      proposals.sort((a,b)=>b.ev.score-a.ev.score);

      const topK = Math.min(5,proposals.length);
      const pickIndex = Math.floor(Math.pow(rng(),2.8)*topK);
      const pick = proposals[pickIndex];

      const delta = pick.ev.score - current.score;
      const exploratory = rng() < Math.max(.03, .14 - step*.006);

      if (delta > 0 || exploratory) {
        modules.push(pick.temp);
        pick.temp.cells.forEach(([x,y]) => board[idx(x,y)] = modules.length-1);
        current = evaluateLayout(modules,settings);
        rejectStreak = 0;
      } else {
        rejectStreak++;
      }

      const anyMax = ["p","e","q"].some(k => settings.targets[k].mode==="max");
      const shouldStopEarlyForMinCount =
        current.feasible && settings.minimizeModules && !anyMax && rejectStreak >= 3;

      if (shouldStopEarlyForMinCount) break;
      if (rejectStreak >= 7) break;
      if (modules.reduce((s,m)=>s+m.candidate.area,0) >= BOARD.cols*BOARD.rows) break;
    }

    // Small local-search phase: remove one module, then greedily refill.
    let bestLocal = resultRecord(modules,settings);
    for (let pass=0; pass<cfg.localPasses; pass++) {
      if (!modules.length) break;
      const trial = cloneModules(bestLocal.modules);
      trial.splice(Math.floor(rng()*trial.length),1);
      let trialBoard = rebuildBoard(trial);
      let trialEval = evaluateLayout(trial,settings);

      for (let add=0; add<3; add++) {
        let bestAdd = null;
        for (let t=0; t<Math.floor(cfg.samplesPerStep/2); t++) {
          const cand = sampleCandidate(sortedCandidates,nodeCandidates,rng);
          const placement = randomPlacement(cand,trialBoard,rng,8);
          if (!placement) continue;
          const temp = {candidate:cand,cells:placement.cells,orientation:placement.orientation};
          trial.push(temp);
          const ev = evaluateLayout(trial,settings);
          trial.pop();
          if (!bestAdd || ev.score > bestAdd.ev.score) bestAdd = {temp,ev};
        }
        if (!bestAdd || bestAdd.ev.score <= trialEval.score) break;
        trial.push(bestAdd.temp);
        trialBoard = rebuildBoard(trial);
        trialEval = bestAdd.ev;
      }

      const rec = resultRecord(trial,settings);
      if (rec.evaluation.score > bestLocal.evaluation.score) bestLocal = rec;
    }
    return bestLocal;
  }


  // ---------------------------------------------------------------------------
  // Beam search for hard-target problems
  // ---------------------------------------------------------------------------
  // The old random/greedy search is good for pure "maximize" requests, but hard
  // P/E/Q targets have strong trade-offs and adjacency synergies.  This search:
  //   - works level-by-level by module count,
  //   - enumerates every legal position/rotation for shortlisted candidates,
  //   - keeps several Pareto-like views of the frontier (P-heavy, E-heavy, etc.),
  //   - therefore preserves temporarily "bad" states such as Neural Core with
  //     negative E that can later be rescued by Eco / Node / Receiver.
  const PLACEMENT_CACHE = {};

  function allShapePlacements(shapeId) {
    if (PLACEMENT_CACHE[shapeId]) return PLACEMENT_CACHE[shapeId];

    const out = [];
    const seen = new Set();

    for (const o of ORIENTATIONS[shapeId]) {
      for (let y=0; y<=BOARD.rows-o.h; y++) {
        for (let x=0; x<=BOARD.cols-o.w; x++) {
          const cells = o.cells.map(([cx,cy]) => [cx+x,cy+y]);
          const key = cells.map(c=>c.join(",")).sort().join(";");
          if (seen.has(key)) continue;
          seen.add(key);

          let mask = 0n;
          for (const [px,py] of cells) {
            mask |= (1n << BigInt(idx(px,py)));
          }

          out.push({
            cells,
            mask,
            orientation: o.key,
            touchesTop: cells.some(([,py]) => py===0),
            touchesSide: cells.some(([px]) => px===0)
          });
        }
      }
    }

    PLACEMENT_CACHE[shapeId] = out;
    return out;
  }

  function optimisticCandidateStats(candidate) {
    if (candidate.kind === "node") return {p:0,e:0,q:0};

    let mult = 1;
    if (candidate.effects.includes("topMount")) mult *= 1.2;
    if (candidate.effects.includes("sideMount")) mult *= 1.2;

    // Receiver is layout-dependent.  Use a modest optimistic assumption here
    // only for shortlist generation; real scoring always uses evaluateLayout().
    if (candidate.effects.includes("receiver")) mult *= 1.2;

    return scaleStats(candidate.intrinsic,mult);
  }

  function hardMetricIds(settings) {
    const ids = [];
    for (const k of ["p","e","q"]) {
      if (settings.targets[k].mode !== "ignore") ids.push(k);
    }
    if (settings.usePowerTarget && !ids.includes("e")) ids.push("e");
    return ids;
  }

  function beamCandidatePool(candidates,settings,cfg) {
    const limit = cfg.candidateLimit;
    if (candidates.length <= limit) return [...candidates];

    const chosen = new Map();
    const add = c => chosen.set(c.id,c);
    const metrics = hardMetricIds(settings);

    // Nodes are rare and create Support Node / Receiver synergy, so never let
    // static ranking remove them.
    candidates.filter(c => c.kind==="node").forEach(add);

    // Keep the strongest candidates on every selected axis independently.
    // This is what preserves "P monster / E terrible" Neural candidates and
    // "E monster / P terrible" Eco candidates in the same frontier.
    const perAxis = Math.max(10,Math.floor(limit/5));
    for (const k of metrics) {
      [...candidates]
        .filter(c => c.kind!=="node")
        .sort((a,b) => optimisticCandidateStats(b)[k] - optimisticCandidateStats(a)[k])
        .slice(0,perAxis)
        .forEach(add);
    }

    // Keep the best few variants from every enabled module family so a module
    // type cannot disappear merely because its standalone trade-off is poor.
    const perType = Math.max(4,Math.floor(limit/18));
    for (const typeId of settings.enabledModules) {
      [...candidates]
        .filter(c => c.typeId===typeId)
        .sort((a,b) => b.staticUtility-a.staticUtility)
        .slice(0,perType)
        .forEach(add);
    }

    // Explicitly preserve adjacency/edge-effect variants.
    const synergy = [...candidates]
      .filter(c => c.kind==="normal" && c.effects.some(e =>
        ["receiver","topMount","sideMount","negativeFeedback"].includes(e)))
      .sort((a,b) => {
        const sa = optimisticCandidateStats(a), sb = optimisticCandidateStats(b);
        const va = metrics.reduce((s,k)=>s+Math.max(0,sa[k]),0);
        const vb = metrics.reduce((s,k)=>s+Math.max(0,sb[k]),0);
        return vb-va;
      })
      .slice(0,Math.max(12,Math.floor(limit/5)));
    synergy.forEach(add);

    // Fill remaining slots by the normal static heuristic.
    for (const c of [...candidates].sort((a,b)=>b.staticUtility-a.staticUtility)) {
      if (chosen.size >= limit) break;
      add(c);
    }

    // If preservation buckets exceeded the limit, rank the union while still
    // retaining at least one candidate from every selected module family.
    let pool = [...chosen.values()];
    if (pool.length > limit) {
      const must = new Map();
      pool.filter(c=>c.kind==="node").forEach(c=>must.set(c.id,c));

      for (const typeId of settings.enabledModules) {
        const best = pool
          .filter(c=>c.typeId===typeId)
          .sort((a,b)=>b.staticUtility-a.staticUtility)[0];
        if (best) must.set(best.id,best);
      }

      const rest = pool
        .filter(c=>!must.has(c.id))
        .sort((a,b)=>b.staticUtility-a.staticUtility);

      pool = [...must.values(), ...rest.slice(0,Math.max(0,limit-must.size))];
    }

    return pool;
  }

  function modulesMask(modules) {
    let mask = 0n;
    for (const m of modules) {
      for (const [x,y] of m.cells) mask |= (1n << BigInt(idx(x,y)));
    }
    return mask;
  }

  function stateSignatureFast(modules) {
    return exactSignature(modules);
  }

  function progressValue(ev,k,settings) {
    const t = settings.targets[k];
    const value = ev.total[k];

    if (t.mode === "max") {
      const scale = k==="q" ? 50 : 100;
      return value/scale;
    }

    if (t.mode === "min") {
      const target = Number(t.value)||0;
      const scale = Math.max(Math.abs(target),k==="q"?25:50,1);
      // Do NOT clamp negative values.  A P-heavy state and an E-heavy state are
      // intentionally kept in separate frontier buckets.
      return value/scale;
    }

    if (k==="e" && settings.usePowerTarget) {
      return -ev.power/Math.max(settings.powerTarget||1,1);
    }

    return 0;
  }

  function structuralValue(modules,ev) {
    let receiver = 0, nodes = 0, mounts = 0;
    for (const m of modules) {
      if (m.candidate.kind==="node") nodes++;
      if (m.candidate.effects.includes("receiver")) receiver++;
      if (m.candidate.effects.includes("topMount") ||
          m.candidate.effects.includes("sideMount")) mounts++;
    }

    let adjEdges = 0;
    ev.adjacency.forEach(s => adjEdges += s.size);
    adjEdges /= 2;

    return receiver*2 + nodes*2 + mounts*.25 + adjEdges*.08;
  }

  function pushTop(bucket,rec,value,cap) {
    bucket.push({rec,value});
    if (bucket.length > cap*2) {
      bucket.sort((a,b)=>b.value-a.value);
      bucket.length = cap;
    }
  }

  function finalizeBucket(bucket,cap) {
    bucket.sort((a,b)=>b.value-a.value);
    if (bucket.length > cap) bucket.length = cap;
    return bucket.map(x=>x.rec);
  }

  function selectBeam(records,settings,cfg) {
    if (records.length <= cfg.beamWidth) return records;

    const metrics = hardMetricIds(settings);
    const cap = Math.max(4,Math.ceil(cfg.beamWidth/2));
    const scalar = [], structural = [], areaEff = [];
    const metricBuckets = {};
    metrics.forEach(k => metricBuckets[k]=[]);

    for (const rec of records) {
      pushTop(scalar,rec,rec.evaluation.score,cap);
      pushTop(structural,rec,structuralValue(rec.modules,rec.evaluation),Math.max(3,Math.floor(cap/2)));

      // A second generic view: how much selected-target progress per occupied cell.
      const used = rec.modules.reduce((s,m)=>s+m.candidate.area,0) || 1;
      let prog = 0;
      metrics.forEach(k => prog += progressValue(rec.evaluation,k,settings));
      pushTop(areaEff,rec,prog/used,Math.max(3,Math.floor(cap/2)));

      for (const k of metrics) {
        pushTop(metricBuckets[k],rec,progressValue(rec.evaluation,k,settings),cap);
      }
    }

    const merged = [];
    const seen = new Set();

    function addMany(list) {
      for (const r of list) {
        const sig = r.signature;
        if (seen.has(sig)) continue;
        seen.add(sig);
        merged.push(r);
      }
    }

    addMany(finalizeBucket(scalar,cap));
    metrics.forEach(k => addMany(finalizeBucket(metricBuckets[k],cap)));
    addMany(finalizeBucket(structural,Math.max(3,Math.floor(cap/2))));
    addMany(finalizeBucket(areaEff,Math.max(3,Math.floor(cap/2))));

    // If diversity buckets produce more than beamWidth, retain a larger
    // frontier than the old single-score search.  This is deliberate.
    const maxFrontier = Math.max(cfg.beamWidth,Math.floor(cfg.beamWidth*1.5));
    if (merged.length <= maxFrontier) return merged;

    // Preserve the first half as diversity picks, use score for the rest.
    const preserve = merged.slice(0,Math.floor(maxFrontier*.55));
    const preserveSet = new Set(preserve.map(r=>r.signature));
    const rest = merged
      .filter(r=>!preserveSet.has(r.signature))
      .sort((a,b)=>b.evaluation.score-a.evaluation.score)
      .slice(0,maxFrontier-preserve.length);
    return [...preserve,...rest];
  }

  const BEAM_QUALITY = {
    fast:     { beamWidth: 10, candidateLimit: 48,  maxDepth: 11 },
    balanced: { beamWidth: 18, candidateLimit: 78,  maxDepth: 12 },
    deep:     { beamWidth: 30, candidateLimit: 120, maxDepth: 14 }
  };

  function beamConfig(settings) {
    const base = BEAM_QUALITY[settings.searchQuality] || BEAM_QUALITY.balanced;
    const count = Math.max(20,Math.min(10000,Number(settings.computeCount)||500));
    const factor = Math.max(.7,Math.min(2.0,Math.sqrt(count/500)));

    return {
      // Hard caps keep "very high" search budgets from freezing the browser.
      beamWidth: Math.min(44,Math.max(8,Math.round(base.beamWidth*factor))),
      candidateLimit: Math.min(160,Math.max(36,Math.round(base.candidateLimit*factor))),
      maxDepth: base.maxDepth
    };
  }

  async function beamOptimize(settings,candidates,onProgress=()=>{}) {
    candidates.forEach(c => c.staticUtility = staticUtility(c,settings));
    const cfg = beamConfig(settings);
    const pool = beamCandidatePool(candidates,settings,cfg);

    // Pre-warm the finite placement sets.  Every legal location/rotation is
    // considered; no random placement misses a one-cell-wide opportunity.
    pool.forEach(c => allShapePlacements(c.shapeId));

    const emptyModules = [];
    const emptyEval = evaluateLayout(emptyModules,settings);
    let beam = [{
      modules: emptyModules,
      mask: 0n,
      evaluation: emptyEval,
      signature: ""
    }];

    const bestAny = [];
    let firstFeasibleDepth = null;
    const feasibleAtFirstDepth = [];

    for (let depth=1; depth<=cfg.maxDepth; depth++) {
      const expanded = [];
      const seen = new Set();

      for (const state of beam) {
        for (const candidate of pool) {
          const placements = allShapePlacements(candidate.shapeId);

          for (const placement of placements) {
            if ((state.mask & placement.mask) !== 0n) continue;

            const modules = state.modules.concat([{
              candidate,
              cells: placement.cells,
              orientation: placement.orientation
            }]);

            const signature = stateSignatureFast(modules);
            if (seen.has(signature)) continue;
            seen.add(signature);

            const ev = evaluateLayout(modules,settings);
            const rec = {
              modules,
              mask: state.mask | placement.mask,
              evaluation: ev,
              signature,
              composition: compositionSignature(modules)
            };

            // Keep a small global fallback set even if no exact solution is found.
            insertBest(bestAny,rec,Math.max(settings.resultCount*8,48));

            if (ev.feasible) {
              if (firstFeasibleDepth === null) firstFeasibleDepth = depth;
              if (depth === firstFeasibleDepth) {
                insertBest(feasibleAtFirstDepth,rec,Math.max(settings.resultCount*12,64));
              }
            }

            expanded.push(rec);
          }
        }
      }

      onProgress(
        depth/cfg.maxDepth,
        feasibleAtFirstDepth[0] || bestAny[0] || null,
        {
          algorithm: "beam",
          depth,
          maxDepth: cfg.maxDepth,
          frontier: beam.length,
          candidatePool: pool.length,
          expanded: expanded.length
        }
      );

      // In minimum-module mode, stop at the first feasible depth found by the
      // retained beam frontier.  Beam pruning makes this a strong approximate
      // minimum, not a formal proof of global optimality.
      if (settings.minimizeModules && firstFeasibleDepth === depth) {
        break;
      }

      if (!expanded.length) break;

      beam = selectBeam(expanded,settings,cfg);

      // Yield so the browser can repaint progress.
      await new Promise(resolve => setTimeout(resolve,0));
    }

    let source = feasibleAtFirstDepth.length ? feasibleAtFirstDepth : bestAny;
    source = [...source].sort((a,b)=>b.evaluation.score-a.evaluation.score);

    const final = [];
    const seenComp = new Set();

    for (const r of source) {
      if (!seenComp.has(r.composition)) {
        final.push(r);
        seenComp.add(r.composition);
      }
      if (final.length >= settings.resultCount) break;
    }

    if (final.length < settings.resultCount) {
      for (const r of source) {
        if (!final.includes(r)) final.push(r);
        if (final.length >= settings.resultCount) break;
      }
    }

    return final;
  }

  const QUALITY = {
    fast:     { restarts: 60,  samplesPerStep: 45, maxSteps: 18, localPasses: 1 },
    balanced: { restarts: 180, samplesPerStep: 70, maxSteps: 22, localPasses: 2 },
    deep:     { restarts: 520, samplesPerStep: 95, maxSteps: 26, localPasses: 3 }
  };

  async function optimize(settings, onProgress=()=>{}) {
    const candidates = generateCandidates(settings);
    if (!candidates.length) return [];

    const hasHardConstraints =
      ["p","e","q"].some(k => settings.targets[k].mode==="min") ||
      !!settings.usePowerTarget;

    // Hard-target problems use beam search because they are dominated by
    // trade-offs and layout synergy. Pure maximize problems keep the stochastic
    // explorer, which is cheaper and works well for open-ended objectives.
    if (hasHardConstraints) {
      return beamOptimize(settings,candidates,onProgress);
    }

    candidates.forEach(c => c.staticUtility = staticUtility(c,settings));
    const sorted = [...candidates].sort((a,b)=>b.staticUtility-a.staticUtility);
    const nodes = sorted.filter(c=>c.kind==="node");

    const preset = QUALITY[settings.searchQuality] || QUALITY.balanced;
    const cfg = {
      ...preset,
      restarts: Math.max(20,Math.min(10000,Number(settings.computeCount)||preset.restarts))
    };
    const rng = mulberry32((Date.now() ^ (candidates.length<<8)) >>> 0);
    const keep = Math.max(settings.resultCount*6,30);
    const best = [];

    for (let r=0; r<cfg.restarts; r++) {
      const rec = buildOne(sorted,nodes,settings,rng,cfg);
      insertBest(best,rec,keep);

      if (r % 4 === 0 || r === cfg.restarts-1) {
        onProgress((r+1)/cfg.restarts,best[0] || null,{algorithm:"stochastic"});
        await new Promise(resolve => setTimeout(resolve,0));
      }
    }

    const final = [];
    const seenComp = new Set();

    for (const r of best) {
      if (!seenComp.has(r.composition)) {
        final.push(r);
        seenComp.add(r.composition);
      }
      if (final.length >= settings.resultCount) break;
    }

    if (final.length < settings.resultCount) {
      for (const r of best) {
        if (!final.includes(r)) final.push(r);
        if (final.length >= settings.resultCount) break;
      }
    }

    return final;
  }

  return {
    optimize,
    evaluateLayout,
    generateCandidates,
    powerEstimate,
    trunc0,
    ORIENTATIONS
  };
})();
