(() => {
  const { MODULES, EFFECTS, SHAPES, BOARD, compatibleEffects } = window.PS_DATA;
  const { optimize } = window.PS_OPT;

  const $ = id => document.getElementById(id);
  const moduleChecks = $("moduleChecks");
  const effectChecks = $("effectChecks");
  const resultsList = $("resultsList");
  const boardEl = $("board");
  const moduleDetail = $("moduleDetail");
  const solutionSummary = $("solutionSummary");
  const previewTitle = $("previewTitle");
  const savedList = $("savedList");
  const saveCurrentBtn = $("saveCurrentBtn");
  const exportSavedBtn = $("exportSavedBtn");
  const importSavedFile = $("importSavedFile");
  const clearSavedBtn = $("clearSavedBtn");
  const saveNameInput = $("saveName");
  const manualModuleSelect = $("manualModuleSelect");
  const manualEffect1 = $("manualEffect1");
  const manualEffect2 = $("manualEffect2");
  const applyManualEffectsBtn = $("applyManualEffectsBtn");
  const restoreManualBtn = $("restoreManualBtn");
  const restoreLayoutBtn = $("restoreLayoutBtn");
  const moveUpBtn = $("moveUpBtn");
  const moveDownBtn = $("moveDownBtn");
  const moveLeftBtn = $("moveLeftBtn");
  const moveRightBtn = $("moveRightBtn");
  const rotateBtn = $("rotateBtn");
  const deleteModuleBtn = $("deleteModuleBtn");
  const addModuleType = $("addModuleType");
  const addModuleShape = $("addModuleShape");
  const addEffect1 = $("addEffect1");
  const addEffect2 = $("addEffect2");
  const addModuleBtn = $("addModuleBtn");
  const manualEditorHint = $("manualEditorHint");
  const SAVED_KEY = "probablyStolenOptimizer.savedSolutions.v1";
  let lastResults = [];
  let selectedIndex = -1;
  let allCandidateMap = null;

  function fmtSigned(v) {
    return `${v >= 0 ? "+" : ""}${v}`;
  }

  function effectKey(effects) {
    return [...(effects || [])].sort().join("+");
  }

  function candidateKey(typeId, shapeId, effects) {
    return `${typeId}|${shapeId}|${effectKey(effects)}`;
  }

  function getAllCandidateMap() {
    if (allCandidateMap) return allCandidateMap;
    const candidates = window.PS_OPT.generateCandidates({
      enabledModules: Object.keys(MODULES),
      enabledEffects: Object.keys(EFFECTS)
    });
    allCandidateMap = new Map(
      candidates.map(c => [candidateKey(c.typeId,c.shapeId,c.effects), c])
    );
    return allCandidateMap;
  }

  function fullCandidateFor(typeId, shapeId, effects) {
    return getAllCandidateMap().get(candidateKey(typeId,shapeId,effects)) || null;
  }

  function hydrateResultCandidates(result) {
    result.modules.forEach(m => {
      const c = m.candidate;
      const full = fullCandidateFor(c.typeId,c.shapeId,c.effects || []);
      if (full) m.candidate = full;
    });
    return result;
  }

  function renderModuleChecks() {
    moduleChecks.innerHTML = "";
    Object.entries(MODULES).forEach(([id,m]) => {
      const label = document.createElement("label");
      label.className = "check-row";
      label.innerHTML = `
        <input type="checkbox" data-module="${id}" checked>
        <span>
          ${m.name}
          <small class="check-meta">${m.kind === "node" ? "Support Node 固有词条" : m.variants.length + " 种形态"}</small>
        </span>`;
      moduleChecks.appendChild(label);
    });
  }

  function renderEffectChecks() {
    effectChecks.innerHTML = "";
    Object.entries(EFFECTS).forEach(([id,e]) => {
      const label = document.createElement("label");
      label.className = "check-row";
      label.innerHTML = `
        <input type="checkbox" data-effect="${id}" checked>
        <span>
          ${e.name}
          <small class="check-meta">${e.note}</small>
        </span>`;
      effectChecks.appendChild(label);
    });
  }

  function syncTargetInput(modeId,targetId) {
    const mode = $(modeId);
    const input = $(targetId);
    const update = () => input.disabled = mode.value !== "min";
    mode.addEventListener("change",update);
    update();
  }

  function selectedData(attr) {
    return [...document.querySelectorAll(`input[data-${attr}]:checked`)]
      .map(el => el.dataset[attr]);
  }

  function readSettings() {
    return {
      targets: {
        p: {mode:$("pMode").value, value:Number($("pTarget").value)||0},
        e: {mode:$("eMode").value, value:Number($("eTarget").value)||0},
        q: {mode:$("qMode").value, value:Number($("qTarget").value)||0}
      },
      enabledModules: selectedData("module"),
      enabledEffects: selectedData("effect"),
      usePowerTarget: $("usePowerTarget").checked,
      basePower: Number($("basePower").value)||0,
      powerTarget: Number($("powerTarget").value)||0,
      powerRounding: $("powerRounding").value,
      searchQuality: $("searchQuality").value,
      computeCount: Math.max(20,Math.min(10000,Number($("computeCount").value)||500)),
      minimizeModules: $("minimizeModules").checked,
      resultCount: Math.max(1,Math.min(20,Number($("resultCount").value)||8))
    };
  }

  function validate(settings) {
    if (!settings.enabledModules.length) return "至少启用一种模组。";
    const hasGoal =
      ["p","e","q"].some(k => settings.targets[k].mode !== "ignore") ||
      settings.usePowerTarget;
    if (!hasGoal) return "至少设置一个目标（P / E / Q / 耗电）。";
    return "";
  }

  function renderResults(results,settings) {
    lastResults = results;
    selectedIndex = -1;

    if (!results.length) {
      resultsList.className = "results-list empty-state";
      resultsList.textContent = "没有找到可用方案。尝试启用更多模组或降低约束。";
      clearPreview();
      return;
    }

    resultsList.className = "results-list";
    resultsList.innerHTML = "";

    results.forEach((r,i) => {
      const ev = r.evaluation;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "result-card";
      const occupied = r.modules.reduce((s,m)=>s+m.candidate.area,0);
      card.innerHTML = `
        <div class="result-top">
          <span class="result-rank">方案 ${i+1}</span>
          <span class="${ev.feasible ? "feasible" : "infeasible"}">
            ${ev.feasible ? "✓ 满足硬目标" : "△ 最接近目标"}
          </span>
        </div>
        <div class="stat-row">
          <div class="stat-chip"><span>P</span><strong>${fmtSigned(ev.total.p)}</strong></div>
          <div class="stat-chip"><span>E</span><strong>${fmtSigned(ev.total.e)}</strong></div>
          <div class="stat-chip"><span>Q</span><strong>${fmtSigned(ev.total.q)}</strong></div>
          <div class="stat-chip"><span>POWER</span><strong>${ev.power}</strong></div>
        </div>
        <div class="result-foot">
          <span>${r.modules.length} 个模组</span>
          <span>${occupied}/35 格</span>
          ${ev.unstableCount ? `<span>⚠ ${ev.unstableCount} 个不稳定词条模组</span>` : ""}
        </div>`;
      card.addEventListener("click",()=>selectResult(i,settings));
      resultsList.appendChild(card);
    });

    selectResult(0,settings);
  }

  function clearPreview() {
    boardEl.innerHTML = "";
    solutionSummary.textContent = "选择一个结果后显示详细数值。";
    moduleDetail.innerHTML = "";
    previewTitle.textContent = "未选择方案";
    manualModuleSelect.innerHTML = '<option value="">请先选择方案</option>';
    manualModuleSelect.disabled = true;
    manualEffect1.innerHTML = '<option value="">无</option>';
    manualEffect2.innerHTML = '<option value="">无</option>';
    manualEffect1.disabled = true;
    manualEffect2.disabled = true;
    applyManualEffectsBtn.disabled = true;
    restoreManualBtn.disabled = true;
    restoreLayoutBtn.disabled = true;
    setLayoutButtonsDisabled(true);
    addModuleBtn.disabled = true;
    manualEditorHint.textContent = "先选择一个方案。Node 只有 Support Node 固有词条，不能手动修改随机词条。";
  }

  function selectResult(i,settings) {
    selectedIndex = i;
    [...resultsList.querySelectorAll(".result-card")].forEach((c,idx)=>
      c.classList.toggle("active",idx===i)
    );
    renderPreview(lastResults[i],i,settings);
  }

  function moduleLabel(c) {
    return MODULES[c.typeId]?.short || c.typeId;
  }

  function renderPreview(result,index,settings) {
    const ev = result.evaluation;
    boardEl.innerHTML = "";
    previewTitle.textContent = `方案 ${index+1}`;

    result.modules.forEach((m,mi) => {
      const wrap = document.createElement("div");
      wrap.className = `module-piece module-${m.candidate.typeId}`;
      wrap.dataset.moduleIndex = String(mi);
      if (Number(manualModuleSelect.value) === mi) wrap.classList.add("selected");
      const eff = m.candidate.effects
        .filter(x=>x!=="supportNode")
        .map(x=>EFFECTS[x]?.short || "")
        .join("");
      m.cells.forEach(([x,y]) => {
        const cell = document.createElement("div");
        cell.className = "module-cell";
        cell.style.left = `calc(var(--cell) * ${x})`;
        cell.style.top = `calc(var(--cell) * ${y})`;
        cell.innerHTML = `${moduleLabel(m.candidate)}<small>#${mi+1}${eff ? " · "+eff : ""}</small>`;
        cell.addEventListener("pointerdown", ev => startBoardDrag(ev,mi,result,index,settings));
        wrap.appendChild(cell);
      });
      boardEl.appendChild(wrap);
    });

    const occupied = result.modules.reduce((s,m)=>s+m.candidate.area,0);
    solutionSummary.innerHTML = `
      <div class="big-stats">
        <div class="big-stat"><span>Performance</span><strong>${fmtSigned(ev.total.p)}</strong></div>
        <div class="big-stat"><span>Efficiency</span><strong>${fmtSigned(ev.total.e)}</strong></div>
        <div class="big-stat"><span>Quality</span><strong>${fmtSigned(ev.total.q)}</strong></div>
      </div>
      <div class="summary-list">
        <div class="summary-line"><span>估算耗电</span><strong>${ev.power}</strong></div>
        <div class="summary-line"><span>硬目标</span><strong>${ev.feasible ? "满足" : "未完全满足"}</strong></div>
        <div class="summary-line"><span>模组数量</span><strong>${result.modules.length}</strong></div>
        <div class="summary-line"><span>占用格数</span><strong>${occupied} / 35</strong></div>
        <div class="summary-line"><span>过载 / 退化模组</span><strong>${ev.unstableCount}</strong></div>
      </div>`;

    const rows = result.modules.map((m,mi) => {
      const c = m.candidate;
      const s = ev.finalStats[mi];
      const effects = c.kind==="node"
        ? `<span class="effect-tag">Support Node</span>`
        : (c.effects.length ? c.effects.map(e=>`<span class="effect-tag">${EFFECTS[e].name.split(" / ")[0]}</span>`).join("") : "—");
      const adj = [...ev.adjacency[mi]].map(j=>"#"+(j+1)).join(", ") || "—";
      const top = m.cells.some(([x,y])=>y===0);
      const side = m.cells.some(([x,y])=>x===0);
      return `
        <tr>
          <td>#${mi+1}</td>
          <td>${MODULES[c.typeId].name}</td>
          <td>${SHAPES[c.shapeId].name}</td>
          <td>${effects}</td>
          <td>${fmtSigned(s.p)}</td>
          <td>${fmtSigned(s.e)}</td>
          <td>${fmtSigned(s.q)}</td>
          <td>${adj}</td>
          <td>${top ? "Top " : ""}${side ? "Side" : ""}</td>
        </tr>`;
    }).join("");

    moduleDetail.innerHTML = `
      <table class="module-table">
        <thead>
          <tr>
            <th>#</th><th>模组</th><th>形状</th><th>词条</th>
            <th>P</th><th>E</th><th>Q</th><th>相邻</th><th>边缘</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

    refreshManualEditor(result);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function getSavedSolutions() {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn("Saved solutions could not be read.", e);
      return [];
    }
  }

  function setSavedSolutions(items) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items));
  }

  function currentSnapshot() {
    if (selectedIndex < 0 || !lastResults[selectedIndex]) return null;
    const r = lastResults[selectedIndex];
    const ev = r.evaluation;

    return {
      id: `saved-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      name: saveNameInput.value.trim() || `方案 ${new Date().toLocaleString()}`,
      savedAt: new Date().toISOString(),
      settings: readSettings(),
      evaluation: {
        total: {...ev.total},
        power: ev.power,
        feasible: ev.feasible,
        deficit: ev.deficit,
        maxObjective: ev.maxObjective,
        score: ev.score,
        unstableCount: ev.unstableCount,
        finalStats: ev.finalStats.map(s => ({...s})),
        adjacency: ev.adjacency.map(s => [...s])
      },
      modules: r.modules.map(m => ({
        candidate: {
          typeId: m.candidate.typeId,
          shapeId: m.candidate.shapeId,
          effects: [...m.candidate.effects],
          kind: m.candidate.kind,
          area: m.candidate.area
        },
        cells: m.cells.map(([x,y]) => [x,y]),
        orientation: m.orientation || ""
      }))
    };
  }

  function snapshotToResult(item) {
    const result = {
      modules: (item.modules || []).map(m => {
        const stored = m.candidate || {};
        const full = fullCandidateFor(stored.typeId, stored.shapeId, stored.effects || []);
        return {
          candidate: full || {...stored, effects:[...(stored.effects || [])]},
          cells: (m.cells || []).map(([x,y]) => [x,y]),
          orientation: m.orientation || ""
        };
      }),
      evaluation: {
        ...item.evaluation,
        total: {...item.evaluation.total},
        finalStats: (item.evaluation.finalStats || []).map(s => ({...s})),
        adjacency: (item.evaluation.adjacency || []).map(a => new Set(a))
      },
      signature: `saved:${item.id}`,
      composition: `saved:${item.id}`
    };
    return hydrateResultCandidates(result);
  }

  function applySavedSettings(settings) {
    if (!settings) return;

    for (const k of ["p","e","q"]) {
      const modeEl = $(`${k}Mode`);
      const targetEl = $(`${k}Target`);
      if (settings.targets && settings.targets[k]) {
        modeEl.value = settings.targets[k].mode;
        targetEl.value = settings.targets[k].value;
        targetEl.disabled = modeEl.value !== "min";
      }
    }

    document.querySelectorAll("[data-module]").forEach(el => {
      el.checked = (settings.enabledModules || []).includes(el.dataset.module);
    });
    document.querySelectorAll("[data-effect]").forEach(el => {
      el.checked = (settings.enabledEffects || []).includes(el.dataset.effect);
    });

    $("usePowerTarget").checked = !!settings.usePowerTarget;
    if (settings.basePower !== undefined) $("basePower").value = settings.basePower;
    if (settings.powerTarget !== undefined) $("powerTarget").value = settings.powerTarget;
    if (settings.powerRounding) $("powerRounding").value = settings.powerRounding;
    if (settings.searchQuality) $("searchQuality").value = settings.searchQuality;
    if (settings.computeCount) $("computeCount").value = settings.computeCount;
    $("minimizeModules").checked = !!settings.minimizeModules;
    if (settings.resultCount) $("resultCount").value = settings.resultCount;
  }

  function exportSavedSolutions() {
    const items = getSavedSolutions();
    if (!items.length) {
      $("statusText").textContent = "没有可导出的保存方案。";
      return;
    }

    const payload = {
      format: "probably-stolen-module-optimizer-saves",
      version: 1,
      exportedAt: new Date().toISOString(),
      count: items.length,
      solutions: items
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g,"-");
    a.href = url;
    a.download = `probably-stolen-solutions-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    $("statusText").textContent = `已导出 ${items.length} 个保存方案。`;
  }

  function normalizeImportedSolutions(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && parsed.format === "probably-stolen-module-optimizer-saves" &&
        Array.isArray(parsed.solutions)) return parsed.solutions;
    if (parsed && Array.isArray(parsed.solutions)) return parsed.solutions;
    throw new Error("这不是有效的 Probably Stolen 优化器保存文件。");
  }

  async function importSavedSolutions(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = normalizeImportedSolutions(parsed);

      const current = getSavedSolutions();
      const byId = new Map(current.map(x => [x.id, x]));

      let added = 0;
      for (const item of incoming) {
        if (!item || !Array.isArray(item.modules) || !item.evaluation) continue;

        let id = item.id || `imported-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        if (byId.has(id)) {
          id = `imported-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        }

        const copy = {
          ...item,
          id,
          name: item.name || "导入方案",
          savedAt: item.savedAt || new Date().toISOString()
        };
        byId.set(id, copy);
        added++;
      }

      const merged = [...byId.values()]
        .sort((a,b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
        .slice(0,50);

      setSavedSolutions(merged);
      renderSavedSolutions();
      $("statusText").textContent = `已导入 ${added} 个方案；当前共保存 ${merged.length} 个。`;
    } catch (e) {
      console.error(e);
      $("statusText").textContent = "导入失败：" + e.message;
    } finally {
      importSavedFile.value = "";
    }
  }

  function renderSavedSolutions() {
    const items = getSavedSolutions();

    if (!items.length) {
      savedList.className = "saved-list empty-state";
      savedList.textContent = "还没有保存的方案。";
      return;
    }

    savedList.className = "saved-list";
    savedList.innerHTML = "";

    items.forEach((item,index) => {
      const ev = item.evaluation || {};
      const total = ev.total || {p:0,e:0,q:0};
      const when = item.savedAt ? new Date(item.savedAt).toLocaleString() : "";
      const card = document.createElement("div");
      card.className = "saved-card";
      card.innerHTML = `
        <div>
          <div class="saved-title">${escapeHtml(item.name || `保存方案 ${index+1}`)}</div>
          <div class="saved-meta">${when} · ${(item.modules || []).length} 个模组</div>
        </div>
        <div class="saved-stats">
          <div class="saved-stat"><span>P</span><strong>${fmtSigned(total.p || 0)}</strong></div>
          <div class="saved-stat"><span>E</span><strong>${fmtSigned(total.e || 0)}</strong></div>
          <div class="saved-stat"><span>Q</span><strong>${fmtSigned(total.q || 0)}</strong></div>
          <div class="saved-stat"><span>POWER</span><strong>${ev.power ?? "—"}</strong></div>
        </div>
        <div class="saved-actions">
          <button type="button" class="mini-button" data-load-saved="${item.id}">载入</button>
          <button type="button" class="mini-button danger" data-delete-saved="${item.id}">删除</button>
        </div>`;
      savedList.appendChild(card);
    });

    savedList.querySelectorAll("[data-load-saved]").forEach(btn => {
      btn.addEventListener("click", () => loadSavedSolution(btn.dataset.loadSaved));
    });
    savedList.querySelectorAll("[data-delete-saved]").forEach(btn => {
      btn.addEventListener("click", () => deleteSavedSolution(btn.dataset.deleteSaved));
    });
  }

  function saveCurrentSolution() {
    const snap = currentSnapshot();
    if (!snap) {
      $("statusText").textContent = "请先计算并选择一个结果，再保存。";
      return;
    }

    const items = getSavedSolutions();
    items.unshift(snap);
    setSavedSolutions(items.slice(0,50));
    saveNameInput.value = "";
    renderSavedSolutions();
    $("statusText").textContent = `已保存：${snap.name}`;
  }

  function loadSavedSolution(id) {
    const item = getSavedSolutions().find(x => x.id === id);
    if (!item) return;

    applySavedSettings(item.settings);
    const result = snapshotToResult(item);

    lastResults = [result];
    selectedIndex = 0;
    renderPreview(result,0,item.settings || readSettings());
    previewTitle.textContent = `已保存 · ${item.name}`;
    $("statusText").textContent = `已载入保存方案：${item.name}`;

    document.querySelector(".preview-panel")
      .scrollIntoView({behavior:"smooth",block:"start"});
  }

  function deleteSavedSolution(id) {
    setSavedSolutions(getSavedSolutions().filter(x => x.id !== id));
    renderSavedSolutions();
  }

  function cloneLayoutModules(modules) {
    return modules.map(m => ({
      candidate: m.candidate,
      cells: m.cells.map(([x,y]) => [x,y]),
      orientation: m.orientation || ""
    }));
  }

  function ensureManualBackup(result) {
    if (!result._originalEffects) {
      result._originalEffects = result.modules.map(m => [...(m.candidate.effects || [])]);
    }
  }

  function ensureLayoutBackup(result) {
    if (!result._originalLayout) {
      result._originalLayout = cloneLayoutModules(result.modules);
    }
  }

  function setLayoutButtonsDisabled(disabled) {
    [moveUpBtn,moveDownBtn,moveLeftBtn,moveRightBtn,rotateBtn,deleteModuleBtn]
      .forEach(btn => btn.disabled = disabled);
  }

  function setEffectOptions(select, selectedValue, partnerValue) {
    const options = [{id:"", name:"无"}];
    Object.entries(EFFECTS).forEach(([id,e]) => options.push({id,name:e.name}));

    select.innerHTML = "";
    for (const opt of options) {
      const el = document.createElement("option");
      el.value = opt.id;
      el.textContent = opt.name;

      if (opt.id && partnerValue) {
        const list = [opt.id, partnerValue];
        const duplicate = opt.id === partnerValue;
        if (duplicate || !compatibleEffects(list)) el.disabled = true;
      }

      select.appendChild(el);
    }
    select.value = selectedValue || "";
    if (select.value !== (selectedValue || "")) select.value = "";
  }

  function syncManualEffectOptions() {
    const first = manualEffect1.value;
    const second = manualEffect2.value;
    setEffectOptions(manualEffect1, first, second);
    setEffectOptions(manualEffect2, second, first);
  }

  function syncAddEffectOptions() {
    const m = MODULES[addModuleType.value];
    if (!m || m.kind === "node") {
      addEffect1.innerHTML = '<option value="">Support Node（固有）</option>';
      addEffect2.innerHTML = '<option value="">—</option>';
      addEffect1.disabled = true;
      addEffect2.disabled = true;
      return;
    }
    addEffect1.disabled = false;
    addEffect2.disabled = false;
    const first = addEffect1.value;
    const second = addEffect2.value;
    setEffectOptions(addEffect1, first, second);
    setEffectOptions(addEffect2, second, first);
  }

  function refreshAddShapeOptions() {
    const m = MODULES[addModuleType.value];
    addModuleShape.innerHTML = "";
    if (!m) return;
    m.variants.forEach(([shapeId]) => {
      const opt = document.createElement("option");
      opt.value = shapeId;
      opt.textContent = SHAPES[shapeId].name;
      addModuleShape.appendChild(opt);
    });
    syncAddEffectOptions();
  }

  function initAddModuleControls() {
    addModuleType.innerHTML = "";
    Object.entries(MODULES).forEach(([id,m]) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = m.name;
      addModuleType.appendChild(opt);
    });
    refreshAddShapeOptions();
  }

  function refreshManualEditor(result) {
    addModuleBtn.disabled = false;
    const prev = manualModuleSelect.value;
    manualModuleSelect.innerHTML = "";

    if (!result.modules.length) {
      const opt = document.createElement("option");
      opt.textContent = "当前布局没有模组";
      opt.value = "";
      manualModuleSelect.appendChild(opt);
      manualModuleSelect.disabled = true;
      manualEffect1.disabled = true;
      manualEffect2.disabled = true;
      applyManualEffectsBtn.disabled = true;
      setLayoutButtonsDisabled(true);
      restoreManualBtn.disabled = !result._originalEffects;
      restoreLayoutBtn.disabled = !result._originalLayout;
      return;
    }

    result.modules.forEach((m,i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      const kind = m.candidate.kind === "node" ? "Node" : MODULES[m.candidate.typeId].name;
      opt.textContent = `#${i+1} · ${kind} · ${SHAPES[m.candidate.shapeId].name}`;
      manualModuleSelect.appendChild(opt);
    });

    manualModuleSelect.disabled = false;
    setLayoutButtonsDisabled(false);
    restoreManualBtn.disabled = !result._originalEffects;
    restoreLayoutBtn.disabled = !result._originalLayout;

    if ([...manualModuleSelect.options].some(o => o.value === prev)) {
      manualModuleSelect.value = prev;
    } else {
      manualModuleSelect.value = "0";
    }

    loadSelectedModuleEffects();
  }

  function highlightSelectedModule() {
    const mi = Number(manualModuleSelect.value);
    boardEl.querySelectorAll(".module-piece").forEach(el => {
      el.classList.toggle("selected", Number(el.dataset.moduleIndex) === mi);
    });
  }

  function loadSelectedModuleEffects() {
    if (selectedIndex < 0 || !lastResults[selectedIndex]) return;
    const result = lastResults[selectedIndex];
    const mi = Number(manualModuleSelect.value);
    if (!Number.isInteger(mi) || !result.modules[mi]) return;

    const m = result.modules[mi];
    const c = m.candidate;
    highlightSelectedModule();

    if (c.kind === "node") {
      manualEffect1.innerHTML = '<option value="">Support Node（固有）</option>';
      manualEffect2.innerHTML = '<option value="">—</option>';
      manualEffect1.disabled = true;
      manualEffect2.disabled = true;
      applyManualEffectsBtn.disabled = true;
      manualEditorHint.textContent =
        `当前 #${mi+1}：${MODULES[c.typeId].name} / ${SHAPES[c.shapeId].name}。Node 可移动、旋转、删除，但不能改随机词条。`;
      return;
    }

    const effects = (c.effects || []).filter(e => e !== "supportNode");
    manualEffect1.disabled = false;
    manualEffect2.disabled = false;
    applyManualEffectsBtn.disabled = false;
    setEffectOptions(manualEffect1, effects[0] || "", effects[1] || "");
    setEffectOptions(manualEffect2, effects[1] || "", effects[0] || "");

    manualEditorHint.textContent =
      `当前 #${mi+1}：${MODULES[c.typeId].name} / ${SHAPES[c.shapeId].name}。可改词条，也可拖动/移动/旋转；不能镜像翻转。`;
  }

  function resultSettings() {
    return readSettings();
  }

  function refreshAfterManualEdit(result, index, settings) {
    result.evaluation = window.PS_OPT.evaluateLayout(result.modules, settings);
    renderPreview(result,index,settings);

    const cards = [...resultsList.querySelectorAll(".result-card")];
    if (cards[index]) {
      const ev = result.evaluation;
      const occupied = result.modules.reduce((s,m)=>s+m.candidate.area,0);
      cards[index].innerHTML = `
        <div class="result-top">
          <span class="result-rank">方案 ${index+1} · 手调</span>
          <span class="${ev.feasible ? "feasible" : "infeasible"}">
            ${ev.feasible ? "✓ 满足硬目标" : "△ 最接近目标"}
          </span>
        </div>
        <div class="stat-row">
          <div class="stat-chip"><span>P</span><strong>${fmtSigned(ev.total.p)}</strong></div>
          <div class="stat-chip"><span>E</span><strong>${fmtSigned(ev.total.e)}</strong></div>
          <div class="stat-chip"><span>Q</span><strong>${fmtSigned(ev.total.q)}</strong></div>
          <div class="stat-chip"><span>POWER</span><strong>${ev.power}</strong></div>
        </div>
        <div class="result-foot">
          <span>${result.modules.length} 个模组</span>
          <span>${occupied}/35 格</span>
          ${ev.unstableCount ? `<span>⚠ ${ev.unstableCount} 个不稳定词条模组</span>` : ""}
        </div>`;
    }
  }

  function applyManualEffects() {
    if (selectedIndex < 0 || !lastResults[selectedIndex]) {
      $("statusText").textContent = "请先选择一个方案。";
      return;
    }

    const result = hydrateResultCandidates(lastResults[selectedIndex]);
    const mi = Number(manualModuleSelect.value);
    if (!Number.isInteger(mi) || !result.modules[mi]) return;
    if (result.modules[mi].candidate.kind === "node") return;

    const effects = [manualEffect1.value, manualEffect2.value].filter(Boolean);
    if (new Set(effects).size !== effects.length) {
      manualEditorHint.textContent = "同一个词条不能重复选择。";
      return;
    }
    if (!compatibleEffects(effects)) {
      manualEditorHint.textContent =
        "这个词条组合不合法：Learning Algorithm 只能与 Top/Side/Receiver 共存；Premium 与 Inferior 互斥。";
      return;
    }

    const m = result.modules[mi];
    const candidate = fullCandidateFor(m.candidate.typeId,m.candidate.shapeId,effects);
    if (!candidate) {
      manualEditorHint.textContent = "没有找到这个合法的模组词条组合。";
      return;
    }

    ensureManualBackup(result);
    ensureLayoutBackup(result);
    m.candidate = candidate;

    refreshAfterManualEdit(result,selectedIndex,resultSettings());
    $("statusText").textContent =
      `已修改方案 ${selectedIndex+1} 的 #${mi+1} 词条，并重新计算。`;
  }

  function restoreManualEffects() {
    if (selectedIndex < 0 || !lastResults[selectedIndex]) return;
    const result = lastResults[selectedIndex];
    if (!result._originalEffects) return;

    result.modules.forEach((m,i) => {
      if (m.candidate.kind !== "normal") return;
      const effects = result._originalEffects[i];
      if (!effects) return;
      const candidate = fullCandidateFor(m.candidate.typeId,m.candidate.shapeId,effects);
      if (candidate) m.candidate = candidate;
    });

    delete result._originalEffects;
    refreshAfterManualEdit(result,selectedIndex,resultSettings());
    $("statusText").textContent = `方案 ${selectedIndex+1} 已恢复原词条（现有模组）。`;
  }

  function occupiedSet(result, ignoreIndex=-1) {
    const set = new Set();
    result.modules.forEach((m,i) => {
      if (i === ignoreIndex) return;
      m.cells.forEach(([x,y]) => set.add(`${x},${y}`));
    });
    return set;
  }

  function cellsValid(result, moduleIndex, cells) {
    const occupied = occupiedSet(result,moduleIndex);
    for (const [x,y] of cells) {
      if (x < 0 || y < 0 || x >= BOARD.cols || y >= BOARD.rows) return false;
      if (occupied.has(`${x},${y}`)) return false;
    }
    return true;
  }

  function selectedModuleIndex() {
    const mi = Number(manualModuleSelect.value);
    return Number.isInteger(mi) ? mi : -1;
  }

  function moveSelectedModule(dx,dy, source="按钮") {
    if (selectedIndex < 0 || !lastResults[selectedIndex]) return false;
    const result = lastResults[selectedIndex];
    const mi = selectedModuleIndex();
    if (mi < 0 || !result.modules[mi]) return false;

    const m = result.modules[mi];
    const next = m.cells.map(([x,y]) => [x+dx,y+dy]);
    if (!cellsValid(result,mi,next)) {
      manualEditorHint.textContent = "移动失败：目标位置越界或与其他模组重叠。";
      return false;
    }

    ensureLayoutBackup(result);
    m.cells = next;
    refreshAfterManualEdit(result,selectedIndex,resultSettings());
    $("statusText").textContent = `已通过${source}移动 #${mi+1}。`;
    return true;
  }

  function rotateSelected() {
    if (selectedIndex < 0 || !lastResults[selectedIndex]) return;
    const result = lastResults[selectedIndex];
    const mi = selectedModuleIndex();
    if (mi < 0 || !result.modules[mi]) return;
    const m = result.modules[mi];

    const minX = Math.min(...m.cells.map(c=>c[0]));
    const minY = Math.min(...m.cells.map(c=>c[1]));
    const rel = m.cells.map(([x,y]) => [x-minX,y-minY]);
    const h = Math.max(...rel.map(c=>c[1])) + 1;

    // Rotate clockwise only. Never mirror, so directional/reverse-L pieces
    // keep their handedness exactly like the game.
    const transformed = rel.map(([x,y]) => [h-1-y,x]);
    const next = transformed.map(([x,y]) => [x+minX,y+minY]);

    if (!cellsValid(result,mi,next)) {
      manualEditorHint.textContent =
        "旋转失败：新形状越界或与其他模组重叠。";
      return;
    }

    ensureLayoutBackup(result);
    m.cells = next;
    refreshAfterManualEdit(result,selectedIndex,resultSettings());
    $("statusText").textContent = `已旋转 #${mi+1} 并重新计算。`;
  }

  function deleteSelectedModule() {
    if (selectedIndex < 0 || !lastResults[selectedIndex]) return;
    const result = lastResults[selectedIndex];
    const mi = selectedModuleIndex();
    if (mi < 0 || !result.modules[mi]) return;

    ensureLayoutBackup(result);
    const label = MODULES[result.modules[mi].candidate.typeId].name;
    result.modules.splice(mi,1);
    refreshAfterManualEdit(result,selectedIndex,resultSettings());
    $("statusText").textContent = `已删除 #${mi+1} ${label}。`;
  }

  function firstFreePlacement(result,candidate) {
    const occupied = occupiedSet(result,-1);
    for (const o of candidate.orientations || []) {
      for (let y=0; y<=BOARD.rows-o.h; y++) {
        for (let x=0; x<=BOARD.cols-o.w; x++) {
          const cells = o.cells.map(([cx,cy]) => [cx+x,cy+y]);
          if (cells.every(([px,py]) => !occupied.has(`${px},${py}`))) {
            return {cells, orientation:o.key};
          }
        }
      }
    }
    return null;
  }

  function addManualModule() {
    if (selectedIndex < 0 || !lastResults[selectedIndex]) {
      $("statusText").textContent = "请先选择一个方案，再添加模组。";
      return;
    }

    const result = lastResults[selectedIndex];
    const typeId = addModuleType.value;
    const shapeId = addModuleShape.value;
    const mod = MODULES[typeId];
    if (!mod) return;

    let effects;
    if (mod.kind === "node") {
      effects = ["supportNode"];
    } else {
      effects = [addEffect1.value,addEffect2.value].filter(Boolean);
      if (new Set(effects).size !== effects.length || !compatibleEffects(effects)) {
        manualEditorHint.textContent = "添加失败：词条组合不合法或重复。";
        return;
      }
    }

    const candidate = fullCandidateFor(typeId,shapeId,effects);
    if (!candidate) {
      manualEditorHint.textContent = "添加失败：找不到这个模组/形状/词条组合。";
      return;
    }

    const placement = firstFreePlacement(result,candidate);
    if (!placement) {
      manualEditorHint.textContent = "添加失败：当前 7×5 网格没有能放下该模组的位置。";
      return;
    }

    ensureLayoutBackup(result);
    result.modules.push({
      candidate,
      cells: placement.cells,
      orientation: placement.orientation
    });

    manualModuleSelect.value = String(result.modules.length-1);
    refreshAfterManualEdit(result,selectedIndex,resultSettings());
    manualModuleSelect.value = String(result.modules.length-1);
    loadSelectedModuleEffects();
    $("statusText").textContent = `已添加 ${MODULES[typeId].name} 到第一个可用位置。`;
  }

  function restoreOriginalLayout() {
    if (selectedIndex < 0 || !lastResults[selectedIndex]) return;
    const result = lastResults[selectedIndex];
    if (!result._originalLayout) return;

    result.modules = cloneLayoutModules(result._originalLayout);
    delete result._originalLayout;
    delete result._originalEffects;
    refreshAfterManualEdit(result,selectedIndex,resultSettings());
    $("statusText").textContent = `方案 ${selectedIndex+1} 已恢复为最初计算结果。`;
  }

  function startBoardDrag(event,moduleIndex,result,index,settings) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();

    manualModuleSelect.value = String(moduleIndex);
    loadSelectedModuleEffects();

    const startX = event.clientX;
    const startY = event.clientY;
    const cellSize = boardEl.getBoundingClientRect().width / BOARD.cols;
    const piece = boardEl.querySelector(`.module-piece[data-module-index="${moduleIndex}"]`);
    if (!piece) return;

    boardEl.classList.add("dragging");
    piece.classList.add("selected");

    const onMove = ev => {
      const dxPx = ev.clientX-startX;
      const dyPx = ev.clientY-startY;
      piece.style.transform = `translate(${dxPx}px, ${dyPx}px)`;
    };

    const onUp = ev => {
      window.removeEventListener("pointermove",onMove);
      window.removeEventListener("pointerup",onUp);
      boardEl.classList.remove("dragging");
      piece.style.transform = "";

      const dx = Math.round((ev.clientX-startX)/cellSize);
      const dy = Math.round((ev.clientY-startY)/cellSize);
      if (dx || dy) moveSelectedModule(dx,dy,"拖动");
    };

    window.addEventListener("pointermove",onMove);
    window.addEventListener("pointerup",onUp,{once:true});
  }

  function rulesDump() {
    const rows = [];
    Object.entries(MODULES).forEach(([id,m]) => {
      m.variants.forEach(([shape,stats]) => {
        rows.push(`<tr>
          <td>${m.name}</td><td>${SHAPES[shape].name}</td>
          <td>${fmtSigned(stats.p)}</td><td>${fmtSigned(stats.e)}</td><td>${fmtSigned(stats.q)}</td>
        </tr>`);
      });
    });

    $("rulesDump").innerHTML = `
      <p>
        Tier 3 固定为 7×5。普通模组有 0 / 1 / 2 个随机词条；节点只有 Support Node 固有词条。
        Premium ×1.2；Inferior ×0.8；Overcharged ×2；Negative Feedback 自身 ×1.25；
        Degrading 当前按全新 ×2；Learning 当前按满级“正属性 ×2”。
        Top / Side 各 ×1.2；Receiver 每相邻一个不同 Node +10%；Support Node 获取每个不同相邻普通模组 20% 属性。
        相邻按“模组实体”去重，角接触不算。
      </p>
      <p>
        整数化采用 toward-zero（向 0 截断）。Negative Feedback 的邻居负属性与 Support Node
        使用布局计算阶段的模组属性；如果后续实测发现游戏版本有不同顺序，可直接在 optimizer.js 中局部修改。
      </p>
      <table>
        <thead><tr><th>模组</th><th>形态</th><th>P</th><th>E</th><th>Q</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>`;
  }

  $("allModules").addEventListener("click",()=>document.querySelectorAll("[data-module]").forEach(x=>x.checked=true));
  $("noModules").addEventListener("click",()=>document.querySelectorAll("[data-module]").forEach(x=>x.checked=false));
  $("allEffects").addEventListener("click",()=>document.querySelectorAll("[data-effect]").forEach(x=>x.checked=true));
  $("safeEffects").addEventListener("click",()=>{
    document.querySelectorAll("[data-effect]").forEach(x=>x.checked=true);
    ["overcharged","degrading"].forEach(id=>{
      const el = document.querySelector(`[data-effect="${id}"]`);
      if (el) el.checked=false;
    });
  });

  $("optimizeBtn").addEventListener("click", async () => {
    const settings = readSettings();
    const err = validate(settings);
    if (err) {
      $("statusText").textContent = err;
      return;
    }

    const btn = $("optimizeBtn");
    btn.disabled = true;
    btn.textContent = "正在计算…";
    $("progressWrap").classList.remove("hidden");
    $("progressBar").style.width = "0%";
    $("progressPct").textContent = "0%";
    $("progressLabel").textContent = "生成候选并开始搜索…";
    $("statusText").textContent = "";

    try {
      const results = await optimize(settings,(fraction,best,meta={})=>{
        const pct = Math.round(fraction*100);
        $("progressBar").style.width = pct+"%";
        $("progressPct").textContent = pct+"%";

        if (meta.algorithm === "beam" && meta.depth) {
          const bestText = best
            ? ` · 当前最好 P ${fmtSigned(best.evaluation.total.p)} / E ${fmtSigned(best.evaluation.total.e)} / Q ${fmtSigned(best.evaluation.total.q)}`
            : "";
          $("progressLabel").textContent =
            `组合搜索 第 ${meta.depth}/${meta.maxDepth} 层 · 前沿 ${meta.frontier} · 候选 ${meta.candidatePool}${bestText}`;
        } else {
          $("progressLabel").textContent = best
            ? `搜索中 · 当前最好 P ${fmtSigned(best.evaluation.total.p)} / E ${fmtSigned(best.evaluation.total.e)} / Q ${fmtSigned(best.evaluation.total.q)}`
            : "搜索中…";
        }
      });

      renderResults(results,settings);
      const feasible = results.filter(r=>r.evaluation.feasible).length;
      const hasHardTargets =
        ["p","e","q"].some(k => settings.targets[k].mode === "min") ||
        settings.usePowerTarget;
      const minMode = settings.minimizeModules
        ? " 已启用“尽量少使用模组”：满足硬目标后优先减少模组数量。"
        : "";
      const algoText = hasHardTargets
        ? " 本次使用组合 Beam Search：保留多条 P/E/Q 权衡路径并枚举合法摆位。"
        : " 本次使用多起点随机 + 局部搜索。";
      $("statusText").textContent =
        `完成：输出 ${results.length} 个方案，其中 ${feasible} 个满足全部硬目标。` +
        minMode + algoText +
        ` 结果仍属于高质量近似最优解，不声称数学上证明全局最优。`;
    } catch (e) {
      console.error(e);
      $("statusText").textContent = "计算出现错误：" + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "开始计算";
    }
  });

  manualModuleSelect.addEventListener("change", loadSelectedModuleEffects);
  manualEffect1.addEventListener("change", syncManualEffectOptions);
  manualEffect2.addEventListener("change", syncManualEffectOptions);
  applyManualEffectsBtn.addEventListener("click", applyManualEffects);
  restoreManualBtn.addEventListener("click", restoreManualEffects);
  restoreLayoutBtn.addEventListener("click", restoreOriginalLayout);

  moveUpBtn.addEventListener("click", () => moveSelectedModule(0,-1));
  moveDownBtn.addEventListener("click", () => moveSelectedModule(0,1));
  moveLeftBtn.addEventListener("click", () => moveSelectedModule(-1,0));
  moveRightBtn.addEventListener("click", () => moveSelectedModule(1,0));
  rotateBtn.addEventListener("click", rotateSelected);
  deleteModuleBtn.addEventListener("click", deleteSelectedModule);

  addModuleType.addEventListener("change", refreshAddShapeOptions);
  addEffect1.addEventListener("change", syncAddEffectOptions);
  addEffect2.addEventListener("change", syncAddEffectOptions);
  addModuleBtn.addEventListener("click", addManualModule);

  $("searchQuality").addEventListener("change", () => {
    const presets = { fast: 120, balanced: 500, deep: 1800 };
    const v = presets[$("searchQuality").value];
    if (v) $("computeCount").value = v;
  });

  saveCurrentBtn.addEventListener("click", saveCurrentSolution);
  exportSavedBtn.addEventListener("click", exportSavedSolutions);
  importSavedFile.addEventListener("change", () => {
    importSavedSolutions(importSavedFile.files && importSavedFile.files[0]);
  });

  clearSavedBtn.addEventListener("click", () => {
    const items = getSavedSolutions();
    if (!items.length) return;
    if (!confirm(`确定删除全部 ${items.length} 个已保存方案吗？`)) return;
    localStorage.removeItem(SAVED_KEY);
    renderSavedSolutions();
  });

  renderModuleChecks();
  renderEffectChecks();
  initAddModuleControls();
  addModuleBtn.disabled = true;
  syncTargetInput("pMode","pTarget");
  syncTargetInput("eMode","eTarget");
  syncTargetInput("qMode","qTarget");
  rulesDump();
  renderSavedSolutions();
  clearPreview();
})();
