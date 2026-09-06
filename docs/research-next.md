# 后续科学动画参考

检索完成：2026-09-07（Asia/Shanghai）。范围：最多 5 次 Exa 定向检索，再读取命中的原作者、项目或论文页面。本文是调研与实施建议，不表示下述机制已经实现、测试或经过生物实验验证。

## 身份核查：仍未定位

目前不能确认用户说的“最近一个生物学家用 AI 做出的动画”是谁。缺少原视频、截图、作者名或发布平台，不能把相似效果当作同一作品。

| 线索 | 本次实际读到的证据 | 可以支持的结论 | 仍不支持的结论 |
| --- | --- | --- | --- |
| Richard Dawkins / Watchmaker Suite | [项目保存的 Dawkins 访谈摘录](https://watchmakersuite.sourceforge.net/thisismyvisionoflife.html)中，Dawkins 回忆自己为 Macintosh 编写树状发育算法、用数字基因和人工选择繁育 biomorph，并把旧 Pascal 代码交给 Alan Canon 复兴。 | Dawkins 是早期 biomorph 程序的作者；这是历史人工生命项目。 | 不能证明他最近利用生成式 AI 编码制作了某个动画。该页面未提供可核实的近期 AI 制作过程。 |
| Biomorph Builder | 已读[首页](https://biomorphbuilder.com/)、[重建过程](https://biomorphbuilder.com/how-we-built-this.html)与[并行开发记录](https://biomorphbuilder.com/building-parallel.html)。后一篇署期 February 2026，第一人称明确说在仓库运行两个 Claude Code 实例，分别实现游戏等级与缩放功能；首页链接到 [davidkedmey/davidkedmey.github.io](https://github.com/davidkedmey/davidkedmey.github.io)。 | 这是一个基于 Dawkins 1988 年工作的交互重实现，开发者公开报告使用 Claude Code。 | 不能把项目开发者等同于 Dawkins；本次未核实开发者的生物学家身份，也没有确认它就是用户看到的动画。项目文章中的算法吻合度和性能结果属于作者自述，本次没有独立复验。 |
| Tom Van Cutsem 的 Boids | 已读原作者[2026-03-18 文章](https://tvcutsem.github.io/vibe-coding-boids)：公开说明用 GitHub Copilot 起步、Gemini CLI 迭代，制成带交互、解释与提示词记录的 Boids 演示；正文说明其目的与计算机科学教学有关。 | 一个具有公开 AI 编程过程的近期群体动画案例。 | 不能因此称作者为生物学家，也不能据此定位用户所指作品。 |

Biomorph Builder 页面展示的“人工生命”应与“用 AI 编程”分开：前者是模拟对象和算法类型，后者是软件的制作方式。没有证据表明该项目的生物形态经过真实生物数据校准。

以下检索串构成本轮完整检索范围；搜索结果只作线索，正文证据以以上实际读取的页面为准：

1. `biologist Richard Dawkins Claude AI coding biomorph animation Watchmaker 2026`
2. `biologist created animation with AI coding Claude evolution simulation 2025 2026`
3. `生物学家 AI 编程 动画 理查德 道金斯 仿生形态 2026`
4. `biologist "vibe coding" animation simulation Claude`
5. `Jeff Jones 2010 Characteristics of Pattern Formation and Evolution in Approximations of Physarum Transport Networks sensor angle`

## 下一轮首选：Physarum 启发的趋化网络

建议增加“黏菌网络”交互模式：粒子感受前方局部浓度，转向更强的方向，并沿途留下会扩散、衰减的轨迹。粒子改变环境，环境又改变后续运动；由此观察支路、通道和网状结构如何形成。它能提供与现有 Gray–Scott 连续浓度场明显不同的交互体验，同时复用现有粒子数据、画布和录制能力。

### 原始科学参考与阅读边界

Jeff Jones (2010), *Characteristics of Pattern Formation and Evolution in Approximations of Physarum Transport Networks*, **Artificial Life 16(2), 127–153**, DOI：[10.1162/artl.2010.16.2.16202](https://doi.org/10.1162/artl.2010.16.2.16202)。

- 已读 [PubMed 收录的作者摘要](https://pubmed.ncbi.nlm.nih.gov/20067403/)，经 Jina Reader 提取。摘要明确研究基于简单局部趋化行为的粒子群，报告动态运输网络、网孔收缩、路径分叉，以及部分设置下的损伤修复等模拟现象。
- [UWE 机构条目](https://uwe-repository.worktribe.com/output/980579)与[机构 PDF](https://uwe-repository.worktribe.com/preview/980585/artl.2010.16.2.pdf)被访问验证拦截；出版社页面也未获得正文，CORE 备用阅读页没有返回可用正文。
- **本次未读到完整方法与参数表。** 下列算法细化、参数范围及更新顺序是可实施的工程提案，不冒充 Jones 原文的逐项复现；正式标为“论文复现”前，需要取得方法正文并逐项核对。

### 最小实现与可控参数

使用二维浓度网格和粒子数组。每步先读取上一时刻的浓度场，在粒子前、左前、右前三处采样；转向较强信号后移动，把沉积累计到独立缓冲区；最后扩散、衰减并交换场缓冲。随机平局使用显式种子。边界条件必须显示并固定，不能把环绕画面当作真实培养皿。

| 控制项 | 工程起点 / 试调范围 | 可观察问题 |
| --- | --- | --- |
| 感知距离 | 9 网格 / 2–24 网格 | 只看近处和看较远处，通道尺度怎样变化？ |
| 感知夹角 | 45° / 10–90°，相对正前方 | 较窄与较宽的方向感知怎样影响分支？ |
| 每步转角 | 45° / 5–90° | 转弯能力怎样影响曲线、聚集和振荡？ |
| 轨迹保留率 | 每步 0.95 / 0.85–0.999 | 旧路线保留多久，结构能否持续改变？ |
| 粒子数 | 5,000 / 1,000–12,000 | 密度对结构和设备负荷的影响是什么？ |

先固定移动距离为每步 1 网格、沉积量为任意单位 1、扩散为 3×3 均值混合，减少同时变化的因素。这里的数值不是生物实测参数，起点也尚未经过本项目视觉调优。扩散强度可作为后续高级项，不必一开始暴露全部设置。

建议保留三种必要交互：暂停/单步；涂抹少量吸引物；清除一段轨迹后观察后续变化。若加入持续吸引源，需与粒子自己的轨迹分开存储，以免扩散步骤无意抹去输入。可以清除轨迹观察网络重组，但不要提前把按钮命名为“自动修复”或“寻找最短路”。

### 浏览器实现复杂度与验收

工程判断：中等复杂度。Canvas 2D + TypeScript + TypedArray 可以先做原型，不需要新增依赖或服务端。每步约为 `O(N + W×H)`：每个粒子固定三次采样，网格固定邻域扩散；避免粒子两两比较。可从现有 `256×160` 网格起步，速度以实机测量决定，不预先承诺手机帧率。CPU 版本稳定后，再依据性能证据判断是否需要 GPU。

须显式说明与论文可能不同的地方：同步读取场、粒子重叠是否允许、移动更新顺序、边界、浓度截断和随机规则都可能改变形态。尤其不能在未核实原文时，把省略排他占位规则的粒子模型称为精确复现。

最低验收证据：

- 人工构造左强、右强、前强三种场，核对粒子转向；均匀场时不出现数组顺序造成的固定方向偏差。
- 关闭沉积且保留衰减后，浓度应按规则消退；扩散算子对均匀场的行为正确；周期边缘采样与内部一致。
- 相同种子、参数、步数且无交互时复现结果；明确分享链接是否仅保存初态，不能把参数链接写成当前场的存档。
- 给至少两个预设记录固定步数截图与设备表现，确认模式切换、暂停、单步、导出在桌面和移动布局可操作。出现分支或重组属于实际观察结果，不能预填“必然修复”。

### 科学边界

这是受黏菌行为启发的人工生命模型。粒子不是黏菌细胞，屏幕轨迹不是实测原生质管网；漂亮的网状图案不证明生命、智能、最优路径或真实生物预测能力。摘要所述修复、张力样行为等结论有其原模型和实验设置，不能直接转移到简化网页版本。

本轮只形成来源核查和下一步实现提案。现有 Gray–Scott 模式的依据及边界继续见 [references.md](references.md)。
