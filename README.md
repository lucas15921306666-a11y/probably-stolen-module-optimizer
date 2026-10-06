# Probably Stolen — 模组最优解计算器 v0.1

这是根据当前讨论规则制作的第一版浏览器计算器。

## 使用方法

直接双击 `index.html` 即可运行，不需要安装 Node.js，也不需要服务器。

如果浏览器限制本地脚本，可以在这个文件夹打开终端并运行：

```bash
python -m http.server 8000
```

然后打开 `http://localhost:8000/`。

## 当前功能

- 固定 Tier 3：7×5 网格
- P / E / Q：不考虑、至少、最大化
- 实验性耗电目标：基础耗电 × (1 - E/100)，可选 ceil / round / floor
- 模组候选勾选：未勾选即完全禁用
- 词条候选勾选
- Learning Algorithm 兼容性限制
- Premium / Inferior 互斥
- 0 / 1 / 2 词条枚举
- Top Mount / Side Mount / Receiver
- Small / Medium Support Node
- Negative Feedback 邻接负属性
- 7×5 布局预览
- 多个近似最优结果
- 点击结果查看逐模组属性与邻接关系

## 当前写入的数据

### 基础模组

- Performance: P +16；缺角 P +12
- Efficiency: E +16；缺角 E +12
- Quality: Q +8；缺角 Q +6
- Eco 方形: P -16 / E +32
- Eco P/U: P -20 / E +40
- Overclock 方形: P +36 / E -44
- Overclock P/U: P -10 / E -19 / Q +31
- Refinement 方形: P -8 / E -15 / Q +25
- Refinement P/U: P -10 / E -19 / Q +31
- Streamlining: P +8 / E +25 / Q -16
- Capped Neural Core: P +100 / E -100 / Q +50

### 词条

- Premium ×1.2
- Inferior ×0.8
- Overcharged ×2
- Degrading：当前按全新 ×2
- Learning Algorithm：当前按满级，正属性 ×2
- Negative Feedback：自身 ×1.25，并吸收相邻模组 25% 负属性
- Receiver：每个不同相邻 Node +10%
- Top Mount：碰顶部 ×1.2
- Side Mount：碰左侧 ×1.2
- Support Node：获取每个不同相邻普通模组 20% 属性

最终属性按 toward-zero（向 0 截断）。

## 搜索算法

这一问题同时包含不规则多格拼图、可旋转/翻转、边缘奖励、Node 邻接、Receiver 和 Negative Feedback，
属于复杂的二维组合优化问题。

v0.1 使用：

1. 完整生成合法的“模组类型 × 形态 × 词条”候选。
2. 根据用户目标计算候选静态效用。
3. 多起点随机构造有效布局。
4. 每一步从大量可放置候选里评估真实布局分数。
5. 允许少量探索性劣化步骤，避免被局部最优卡死。
6. 对每个构造结果做 remove-and-refill 局部搜索。
7. 保留高分且构成不同的多个方案。

它是启发式优化器：通常可以找到很强的解，但 v0.1 不声称“数学证明的全局最优”。

## 后续适合增加

- 精确确认 Efficiency → Power 的最终取整规则
- Degrading 的使用次数
- Learning Algorithm 的当前成长值，而非只算满级
- 专用模组 / 机器类型
- 精确求解模式（CP-SAT / MILP）
- 导入库存模式


## 保存结果

v0.2 新增浏览器本地保存模块：

- 保存当前选中的方案
- 可自定义方案名称
- 保存布局、模组/形态/词条、P/E/Q、耗电与保存时的目标设置
- 刷新页面或关闭浏览器后仍会保留
- 可重新载入旧方案，并恢复当时的目标/筛选设置
- 可删除单个方案或清空全部
- 最多保留最近 50 个方案

保存数据使用浏览器 `localStorage`，不会上传到服务器。


## 运算数量

v0.3 新增“运算数量（独立搜索次数）”：

- 可手动设置 20–10000 次
- 数值越大，找到更强近似最优解的概率越高
- 搜索强度仍控制单次搜索内部深度
- 快速 / 平衡 / 深度会自动给出建议值：
  - 快速：120
  - 平衡：500
  - 深度：1800
- 你仍可在选择预设后手动修改运算数量

浏览器会分批让出主线程，因此长时间计算时页面仍能更新进度。


## JSON 导入 / 导出

v0.4 新增：

- 导出当前浏览器内全部保存方案为 `.json`
- 导入 `.json` 保存文件
- 导入时自动合并现有保存，不覆盖不同 ID 的方案
- ID 冲突时自动生成新的 ID
- 仍最多保留最近 50 个方案

这样可以在不同浏览器或不同电脑之间转移保存结果。


## 手动调整词条

v0.5 开始加入“手动调整布局”功能，第一阶段只允许调整词条：

- 保持模组类型、形状和格子位置完全不变
- 从当前结果中选择一个普通模组
- 手动设置 0 / 1 / 2 个词条
- 自动检查 Learning Algorithm 兼容规则
- 自动检查 Premium / Inferior 互斥
- 应用后立即重新计算 P / E / Q、Receiver、Node、Negative Feedback、Top / Side Mount 与耗电
- Node 的 Support Node 是固有词条，不能手动改
- “恢复原词条”可回到计算器最初生成的词条组合
- 手调后的方案可以直接使用原有“保存当前方案”功能保存


## 手动布局编辑器 v0.6

在 v0.5 只改词条的基础上，v0.6 加入完整的第一版布局编辑：

- 直接拖动预览中的模组，按格吸附
- 用方向键按钮每次移动 1 格
- 旋转 90°
- 水平翻转
- 删除模组
- 手动添加模组
  - 选择模组类型
  - 选择该模组允许的形状
  - 选择 0 / 1 / 2 个合法词条
  - 自动放到第一个可用位置
- Node 可以移动 / 旋转 / 删除 / 添加，但 Support Node 仍是固有词条
- 所有移动、旋转、翻转都会检查 7×5 边界和重叠
- 每次编辑后实时重算：
  - Performance / Efficiency / Quality
  - Top Mount / Side Mount
  - Receiver
  - Support Node
  - Negative Feedback
  - 耗电估算
- “恢复原布局”可回到计算器最初生成的完整方案
- 手调后的结果可继续保存和导出 JSON


## 方向 / 手性修正 v0.7

- 缺角形明确按“反L”基础方向处理。
- 横条形明确按“反L”基础方向处理。
- 优化器不再生成镜像形状，只生成 0° / 90° / 180° / 270° 旋转。
- 手动布局编辑器移除“水平翻转”。
- 这也会让 P 形保持固定手性，不再出现游戏里不存在的镜像 P。
- 对缺角三格来说，镜像在占格几何上与某个旋转等价，因此搜索结果不会损失合法布局；横条反L和 P 形则会真正排除非法镜像。


## 尽量少使用模组 v0.8

搜索设置新增“尽量少使用模组”：

- 需要至少一个硬目标才会进入最少模组模式：
  - P / E / Q 的“至少”
  - 或“目标耗电 ≤ X”
- 搜索优先级为：
  1. 先满足全部硬目标
  2. 再优先使用更少的模组
  3. 模组数量相同时，再比较用户设置的“最大化”目标
- 如果只有“最大化”目标、没有任何硬目标，则不会为了少模组而返回空布局，仍按最大化逻辑搜索。
- 保存方案时会一并保存这个选项。


## “不考虑”语义修正 v0.9

“不考虑”现在是严格意义上的 free axis：

- 不设下限
- 不设上限
- 不奖励接近 0
- 不惩罚负数
- 如果某个模组让被忽略的属性大幅变负，但能改善用户真正选择的目标，算法允许并会选择它
- 只有当 Efficiency 被选为目标，或者启用了“耗电 ≤ X”，Efficiency 才会参与评分
- 普通模式在满足“至少”目标后，会继续奖励这些已选择目标的超额值，而不是为了让被忽略属性保持接近 0 而提前停止
- “尽量少使用模组”开启时，仍然优先满足硬目标并减少模组数量


## 最少模组严格优先 v1.0

开启“尽量少使用模组”以后：

1. 必须先满足所有硬目标。
2. 然后严格优先更少的模组数量。
3. 被设为“不考虑”的属性完全不参与比较，可以为了减少模组数量变得更负。
4. 只有模组数量相同时，才继续比较用户选中的最大化目标 / 至少目标的超额值。

例子：

- 目标：P ≥ 90
- E：不考虑
- Q：不考虑

那么 1 个 `Capped Neural Core`（P +100 / E -100 / Q +50）
会优先于多个普通 Performance 模组，即使普通方案的 E 更接近 0。


## 组合搜索升级 v1.1

针对“明明存在可行布局，但旧算法找不到”的问题，硬目标搜索已重写：

- 有 P/E/Q“至少”目标或耗电硬目标时，自动使用 Beam Search。
- 搜索按模组数量逐层扩展，因此“尽量少使用模组”从搜索第一层就参与。
- 不再只保留一个当前最优方向，而是同时保留：
  - 综合缺口较好的路线
  - P 偏高路线
  - E 偏高路线
  - Q 偏高路线
  - Node / Receiver / 边缘词条等结构性路线
- 候选筛选会主动保留每种模组家族以及 P/E/Q 单项极强的模组，避免 Neural Core 因单独负 E 被提前淘汰。
- 每个进入搜索池的形状会枚举全部合法旋转和位置，不再随机只试约 10 个位置。
- 被“不考虑”的属性仍完全自由，不参与评分。
- 纯“最大化”任务继续使用旧的多起点随机 + 局部搜索，以保持速度。
- Beam Search 仍有前沿剪枝，因此是高质量近似优化，不是数学证明的全局精确求解。


## v1.2 — Progress + English UI

- Fixed Beam Search progress display:
  - Beam Search may stop early when “Minimize module count” finds the first feasible module-count depth.
  - The progress bar now always finishes at 100% once computation is actually complete.
  - Early completion explicitly reports the module-count depth where a feasible solution was found.
- Added a language selector at the very top of the page.
- Added a complete English UI at `index-en.html`.
- Chinese and English pages share the same optimizer, browser localStorage saves, JSON import/export, and manual layout editor.
- Dynamic content is localized too: module names, shapes, effects, status messages, result cards, saved solutions, manual editing, and rules.


## v1.3 — Same-depth global refinement

Hard-target search now has three phases:

1. **Discovery Beam Search**
   - Finds the first feasible module-count depth.

2. **Widened same-depth Beam Search**
   - Re-runs the search globally from the empty board to that same module count.
   - Uses a wider frontier and a broader candidate pool.
   - Revisits branches that the discovery beam may have pruned.

3. **Fixed-count refinement**
   - Keeps the module count unchanged.
   - For several strong/diverse seeds, removes one module at a time and exhaustively tries every candidate in the refinement pool at every legal rotation and position.
   - Repeats for multiple rounds depending on search intensity / compute budget.

This greatly improves the chance of finding a stronger layout at the same module count. It is still not a mathematical proof of the global optimum because Beam Search and the candidate pool are pruned. An exact proof would require a full exact solver / branch-and-bound / CP-SAT mode.
