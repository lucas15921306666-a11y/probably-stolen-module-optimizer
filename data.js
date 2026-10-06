/* Probably Stolen module optimizer — project data agreed in chat */
window.PS_DATA = (() => {
  const BOARD = { cols: 7, rows: 5 };

  const SHAPES = {
    square4: {
      name: "方形",
      cells: [[0,0],[1,0],[0,1],[1,1]]
    },
    l3: {
      name: "缺角形（反L）",
      cells: [[0,0],[1,0],[1,1]]
    },
    t4: {
      name: "竖条形",
      cells: [[1,0],[0,1],[1,1],[1,2]]
    },
    l4: {
      name: "横条形（反L）",
      cells: [[0,0],[1,0],[2,0],[2,1]]
    },
    p5: {
      name: "P形",
      cells: [[0,0],[1,0],[0,1],[1,1],[1,2]]
    },
    u5: {
      name: "U形",
      cells: [[0,0],[1,0],[1,1],[0,2],[1,2]]
    },
    node1: {
      name: "小节点",
      cells: [[0,0]]
    },
    node2: {
      name: "中节点",
      cells: [[0,0],[0,1]]
    }
  };

  const MODULES = {
    performance: {
      name: "性能模组",
      short: "P",
      kind: "normal",
      variants: [
        ["square4", {p:16,e:0,q:0}],
        ["l3",      {p:12,e:0,q:0}],
        ["t4",      {p:16,e:0,q:0}],
        ["l4",      {p:16,e:0,q:0}]
      ]
    },
    efficiency: {
      name: "效率模组",
      short: "E",
      kind: "normal",
      variants: [
        ["square4", {p:0,e:16,q:0}],
        ["l3",      {p:0,e:12,q:0}],
        ["t4",      {p:0,e:16,q:0}],
        ["l4",      {p:0,e:16,q:0}]
      ]
    },
    quality: {
      name: "质量模组",
      short: "Q",
      kind: "normal",
      variants: [
        ["square4", {p:0,e:0,q:8}],
        ["l3",      {p:0,e:0,q:6}],
        ["t4",      {p:0,e:0,q:8}],
        ["l4",      {p:0,e:0,q:8}]
      ]
    },
    overclock: {
      name: "超频模组",
      short: "OC",
      kind: "normal",
      variants: [
        ["square4", {p:36,e:-44,q:0}],
        ["p5",      {p:-10,e:-19,q:31}],
        ["u5",      {p:-10,e:-19,q:31}]
      ]
    },
    eco: {
      name: "环保模组",
      short: "ECO",
      kind: "normal",
      variants: [
        ["square4", {p:-16,e:32,q:0}],
        ["p5",      {p:-20,e:40,q:0}],
        ["u5",      {p:-20,e:40,q:0}]
      ]
    },
    refinement: {
      name: "精炼模组",
      short: "RF",
      kind: "normal",
      variants: [
        ["square4", {p:-8,e:-15,q:25}],
        ["p5",      {p:-10,e:-19,q:31}],
        ["u5",      {p:-10,e:-19,q:31}]
      ]
    },
    streamlining: {
      name: "优化模组",
      short: "ST",
      kind: "normal",
      variants: [
        ["square4", {p:8,e:25,q:-16}]
      ]
    },
    neural: {
      name: "Capped Neural Core",
      short: "NC",
      kind: "normal",
      variants: [
        ["square4", {p:100,e:-100,q:50}]
      ]
    },
    nodeSmall: {
      name: "Small Node",
      short: "NS",
      kind: "node",
      variants: [["node1", {p:0,e:0,q:0}]]
    },
    nodeMedium: {
      name: "Medium Node",
      short: "NM",
      kind: "node",
      variants: [["node2", {p:0,e:0,q:0}]]
    }
  };

  const EFFECTS = {
    premium: {
      name: "优质 / Premium",
      short: "优",
      note: "基础属性 ×1.2"
    },
    inferior: {
      name: "劣质 / Inferior",
      short: "劣",
      note: "基础属性 ×0.8"
    },
    overcharged: {
      name: "过载 / Overcharged",
      short: "过",
      note: "基础属性 ×2；有永久损坏风险",
      unstable: true
    },
    degrading: {
      name: "退化 / Degrading",
      short: "退",
      note: "当前按“全新状态 ×2”计算",
      unstable: true
    },
    learning: {
      name: "自学习 / Learning Algorithm",
      short: "学",
      note: "当前按满级计算：正属性 ×2"
    },
    negativeFeedback: {
      name: "负反馈 / Negative Feedback",
      short: "负",
      note: "自身 ×1.25；吸收相邻模组 25% 负属性"
    },
    receiver: {
      name: "接收器 / Receiver",
      short: "收",
      note: "每相邻 1 个 Node，自身 +10%"
    },
    topMount: {
      name: "顶部挂载 / Top Mount",
      short: "顶",
      note: "接触顶部时自身 ×1.2"
    },
    sideMount: {
      name: "侧边挂载 / Side Mount",
      short: "侧",
      note: "接触左侧时自身 ×1.2"
    }
  };

  function compatibleEffects(list) {
    if (list.includes("premium") && list.includes("inferior")) return false;
    if (list.includes("learning") && list.length > 1) {
      const partner = list.find(x => x !== "learning");
      if (!["topMount","sideMount","receiver"].includes(partner)) return false;
    }
    return true;
  }

  return { BOARD, SHAPES, MODULES, EFFECTS, compatibleEffects };
})();
