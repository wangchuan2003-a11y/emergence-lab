export type Language = "zh" | "en";

// Keep the Chinese source in data attributes so switching languages is reversible.
export const translations: Record<string, string> = {
  场景配方: "Scene recipes",
  从一个图案开始: "Start from a pattern",
  "预览来自真实模型。按标注步数预演后，你可以继续改变它。":
    "Previews come from the actual models. Prepare the shown number of steps, then make the pattern your own.",
  场景准备进度: "Scene preparation progress",
  取消准备: "Cancel preparation",
  "浏览场景配方 ↓": "Explore scene recipes ↓",
  "预演 {step} 步": "Prepared at step {step}",
  "正在准备 {name}…": "Preparing {name}…",
  正在准备: "Preparing",
  "已载入 {name}，从第 {step} 步继续。":
    "Loaded {name} at step {step}. Continue exploring.",
  "场景准备失败，请重试。": "Scene preparation failed. Please try again.",
  "已取消准备，原实验保持不变。":
    "Preparation cancelled. Your original experiment is unchanged.",
  撤销编辑: "Undo edit",
  重做编辑: "Redo edit",
  恢复上次画笔或中心扰动前的完整状态并暂停:
    "Restore the full state before the last brush stroke or center pulse, then pause",
  "已撤销并回到编辑前的状态。": "Undone. Restored the state before the edit.",
  "已重做编辑，实验保持暂停。": "Edit restored. The simulation remains paused.",
  "画笔与中心扰动支持 8 步撤销；更换参数或场景会清空历史。":
    "Undo up to 8 brush strokes or center pulses. Changing settings or scenes clears this history.",
  浏览器本地计算: "Runs in your browser",
  离线副本已就绪: "Offline copy ready",
  "改变简单规则，亲手创造复杂秩序。一个开源、可复现的交互式粒子涌现实验室。":
    "Change simple rules and create complex patterns. An open-source, reproducible lab for exploring emergent systems.",
  "Emergence Lab · 涌现实验室": "Emergence Lab · Interactive Simulations",
  跳到实验画布: "Skip to the simulation",
  "Emergence Lab 首页": "Emergence Lab home",
  "形态 · 生长 · 涌现": "FORM · GROWTH · EMERGENCE",
  看见生命的: "See the patterns",
  "纹理。": "of life.",
  "看见生命的纹理。": "See the patterns of life.",
  "从鸟群到珊瑚，从局部规则到复杂形态。":
    "From flocks to coral, from local rules to complex forms.",
  "亲手播种一个世界，观察它如何生长。": "Seed a world and watch it grow.",
  "从鸟群到珊瑚，从局部规则到复杂形态。亲手播种一个世界，观察它如何生长。":
    "From flocks to coral, from local rules to complex forms. Seed a world and watch it grow.",
  交互实验室: "Interactive simulation lab",
  "交互模拟画布；粒子模式移动吸引、按住排斥；生长模式按住播种、Shift 按住擦除。键盘可通过中心扰动与单步按钮操作。":
    "Interactive simulation canvas. In particle modes, move to attract and hold to repel. In growth modes, hold to seed and Shift-hold to erase. Keyboard users can use the Center pulse and Step buttons.",
  运行中: "Running",
  已暂停: "Paused",
  "路径，记住了来者": "Trails that remember",
  "粒子留下轨迹，轨迹引导粒子。网络从局部反馈中形成。":
    "Particles leave trails; trails guide particles. A network emerges from local feedback.",
  群体的直觉: "The instinct of a flock",
  "每个个体只看邻居，群体却形成了方向。":
    "Each individual follows its neighbors. Together, they find a direction.",
  围绕一个未知: "Around an unknown center",
  "向心力与切向运动，共同维持流动的环。":
    "Inward attraction and sideways motion sustain a flowing ring.",
  看不见的河流: "Invisible currents",
  "同一片流场，把独立个体编织成纹理。":
    "A shared flow field weaves independent particles into patterns.",
  让一片珊瑚生长: "Let a coral grow",
  "两种虚拟物质，生成持续演变的分枝与迷宫。":
    "Two simulated chemicals create ever-changing branches and mazes.",
  "一个，变成很多个": "One becomes many",
  "斑点生长、拉伸与分裂：化学模式中的细胞幻象。":
    "Spots grow, stretch, and divide: chemical patterns that resemble cells.",
  "移动吸引 · 按住排斥": "Move to attract · Hold to repel",
  "按住播种 · Shift 按住擦除": "Hold to seed · Shift-hold to erase",
  暂停或继续实验: "Pause or resume the simulation",
  暂停: "Pause",
  继续: "Resume",
  中心扰动: "Center pulse",
  全屏: "Fullscreen",
  形态实验室: "Pattern lab",
  选择一个世界: "Choose a world",
  黏菌网络: "Trail network",
  珊瑚生长: "Coral growth",
  细胞幻象: "Cell-like patterns",
  鸟群: "Flocking",
  环流: "Orbit",
  流场: "Flow field",
  粒子数量: "Particle count",
  运动速度: "Speed",
  聚合倾向: "Cohesion",
  安全距离: "Separation",
  "补给率 F": "Feed rate F",
  "消耗率 K": "Kill rate K",
  演化速度: "Evolution speed",
  画笔: "Brush",
  播种: "Seed",
  擦除: "Erase",
  大小: "Size",
  "Gray–Scott 化学模式。不是生物细胞。":
    "Gray–Scott chemical patterns, not biological cells.",
  "初始状态预生长 240 步；参数可能使图案消失。":
    "Starts after 240 warm-up steps. Some settings may erase the pattern.",
  "Gray–Scott 化学模式。不是生物细胞。初始状态预生长 240 步；参数可能使图案消失。":
    "Gray–Scott chemical patterns, not biological cells. Starts after 240 warm-up steps. Some settings may erase the pattern.",
  粒子密度: "Agent count",
  感知距离: "Sensor distance",
  感知夹角: "Sensor angle",
  转向幅度: "Turn angle",
  轨迹保留率: "Trail retention",
  显示真实粒子位置: "Show actual agent positions",
  "粒子读取浓度、留下轨迹，轨迹再引导粒子。":
    "Agents sense the field and leave trails that guide other agents.",
  "周期边界的工程模型；不表示真实黏菌或最短路径。":
    "A model with wrapping boundaries; it does not represent real slime mold or find shortest paths.",
  "粒子读取浓度、留下轨迹，轨迹再引导粒子。周期边界的工程模型；不表示真实黏菌或最短路径。":
    "Agents sense the field and leave trails that guide other agents. A model with wrapping boundaries; it does not represent real slime mold or find shortest paths.",
  影调: "Palette",
  深海荧光: "Lagoon",
  琥珀熔岩: "Ember",
  冷光银盐: "Silver",
  步: "Step",
  暂停实验: "Pause simulation",
  继续实验: "Resume simulation",
  重新开始: "Restart",
  单步: "Step",
  "录制 8 秒": "Record 8 seconds",
  停止并保存: "Stop and save",
  "正在保存…": "Saving…",
  "{seconds}s": "{seconds}s",
  PNG: "PNG",
  屏幕原样: "As displayed",
  "保存画面 ↗": "Save image ↗",
  "分享参数 ↗": "Share settings ↗",
  复制参数链接: "Copy settings link",
  随机种子: "Random seed",
  换一个随机种子: "Choose another random seed",
  换一组: "Randomize",
  保存与恢复实验: "Save and resume",
  "保存当前状态，稍后接着演化": "Save this state and continue later",
  "已恢复快照 · 暂停后继续": "Snapshot restored · Resume when ready",
  "已恢复快照，可继续演化": "Snapshot restored · Ready to continue",
  保存快照: "Save snapshot",
  打开快照: "Open snapshot",
  "JSON 文件包含模拟状态与参数，完全在本机读取。导入失败会保留当前实验。":
    "The JSON file contains simulation state and settings. It is read locally on your device. If import fails, your current simulation is preserved.",
  "高清 PNG 保持模型比例、去除留边；输出像素增加，不提高模拟网格精度。":
    "High-resolution PNGs preserve the model's proportions and remove margins. More image pixels do not increase the simulation grid resolution.",
  "聚焦画布后：空格暂停，右方向键单步。":
    "With the canvas focused: Space pauses or resumes; Right Arrow advances one step.",
  "触屏可在画布绘制，在画布外滚动页面。":
    "On touchscreens, draw on the canvas and scroll outside it.",
  "聚焦画布后：空格暂停，右方向键单步。触屏可在画布绘制，在画布外滚动页面。":
    "With the canvas focused: Space pauses or resumes; Right Arrow advances one step. On touchscreens, draw on the canvas and scroll outside it.",
  "参数链接保存初始条件，不保存当前笔触。":
    "Settings links save initial conditions, not your current brush strokes.",
  "所有计算都在你的浏览器中完成。": "All calculations run in your browser.",
  "参数链接保存初始条件，不保存当前笔触。所有计算都在你的浏览器中完成。":
    "Settings links save initial conditions, not your current brush strokes. All calculations run in your browser.",
  "简单规则。": "Simple rules.",
  "生长的可能。": "Room to grow.",
  "简单规则。生长的可能。": "Simple rules. Room to grow.",
  "两种物质，无限纹理。": "Two chemicals. Endless patterns.",
  "反应扩散模式中，A 持续补给，B 被消耗，两者以不同速度扩散。微小扰动会长成斑点、分枝与迷宫。立体明暗只是浓度场的视觉映射。":
    "In reaction–diffusion modes, A is replenished while B is removed, and each diffuses at a different rate. Small disturbances grow into spots, branches, and mazes. The apparent depth is a visual mapping of chemical concentrations.",
  "参考可追溯，结果可探索。": "Grounded in research. Open to exploration.",
  "反应扩散参照 Karl Sims 的 Gray–Scott 教程；鸟群参照 Craig Reynolds 的 Boids。黏菌网络参考趋化研究的局部反馈思路。这里是探索性模型与艺术表达，不用于预测真实生物过程。":
    "Reaction–diffusion follows Karl Sims's Gray–Scott tutorial; flocking follows Craig Reynolds's Boids. The trail network draws on local feedback in chemotaxis research. These are exploratory models and artistic interpretations, not predictions of biological processes.",
  "阅读 Karl Sims 的模型说明 ↗": "Read Karl Sims's model guide ↗",
  "一个关于简单与复杂的开源实验。":
    "An open-source experiment in simplicity and complexity.",
  "探索源代码 ↗": "Explore the source ↗",
  "已重置；从 120 步网络状态开始。":
    "Reset to a network state after 120 warm-up steps.",
  "已重置；从 240 步预生长状态开始。":
    "Reset to a pattern after 240 warm-up steps.",
  "已用当前种子重新开始。": "Restarted with the current seed.",
  "已擦除中心的反应物。": "Cleared the material at the center.",
  "已在中心播种；继续运行可观察扩散。":
    "Seeded the center. Resume to watch it spread.",
  "此浏览器不支持全屏，请使用浏览器缩放。":
    "This browser does not support fullscreen. Try the browser's zoom controls.",
  "无法创建导出画布。": "Could not create a canvas for export.",
  "已导出宽 {width} 像素的 PNG。": "Exported a PNG at {width} pixels wide.",
  "当前画布已导出 PNG。": "Exported the current canvas as a PNG.",
  "导出失败，请重试。": "Export failed. Please try again.",
  "快照已保存，包含当前状态与笔触；不包含屏幕拖尾。":
    "Snapshot saved with the current state and brush strokes. Display trails are not included.",
  "保存失败。": "Save failed.",
  "文件超过 3 MB，请选择本实验室导出的快照。":
    "This file exceeds 3 MB. Choose a snapshot exported by this lab.",
  "正在录制，请保存录像后再打开快照。":
    "Recording is in progress. Save the recording before opening a snapshot.",
  "已恢复第 {step} 步并暂停。点击继续实验即可接着演化。":
    "Restored step {step} and paused. Select Resume simulation to continue.",
  "快照读取失败；当前实验未改变。":
    "Could not read the snapshot. Your current simulation is unchanged.",
  "参数链接已复制；恢复初始条件，不保存当前图案或笔触。":
    "Settings link copied. It restores initial conditions, not the current pattern or brush strokes.",
  "参数已写入地址栏，请复制浏览器地址分享。":
    "Settings are in the address bar. Copy the URL to share them.",
  "模拟遇到无效状态，已暂停。可以重新开始或打开有效快照。":
    "The simulation reached an invalid state and was paused. Restart or open a valid snapshot.",
  "录像没有有效数据，请重试或保存 PNG。":
    "The recording contains no usable data. Try again or save a PNG.",
  "录像已导出。": "Recording exported.",
  "录制失败，请重试或保存 PNG。": "Recording failed. Try again or save a PNG.",
  "此浏览器不支持录制，请使用保存画面。":
    "This browser does not support recording. Use Save image instead.",
  "没有可用的视频编码器，请使用保存画面。":
    "No supported video encoder is available. Use Save image instead.",
  "正在录制画布，可随时停止并保存。":
    "Recording the canvas. You can stop and save at any time.",
  "无法开始录制，请使用保存画面。":
    "Could not start recording. Use Save image instead.",
  "快照超过 3 MB，请选择本实验室导出的 JSON 文件。":
    "The snapshot exceeds 3 MB. Choose a JSON file exported by this lab.",
  "文件不是有效的 JSON 快照。": "This file is not a valid JSON snapshot.",
  "不支持此快照格式或版本。":
    "This snapshot format or version is not supported.",
  "快照参数不完整或超出支持范围。":
    "Snapshot settings are incomplete or outside the supported range.",
  "快照影调或时间无效。": "The snapshot palette or step count is invalid.",
  "快照粒子显示设置无效。":
    "The snapshot's agent visibility setting is invalid.",
  "网络参数或尺寸无效。": "Network settings or dimensions are invalid.",
  "网络浓度或粒子数据损坏。": "The network's field or agent data is corrupted.",
  "反应场数据损坏、尺寸错误或参数无效。":
    "The reaction field is corrupted, its dimensions are incorrect, or its settings are invalid.",
  "粒子数据损坏、数量不一致或位置超出范围。":
    "Particle data is corrupted, the count is inconsistent, or positions are out of range.",
  "未知的模拟类型。": "Unknown simulation type.",
};

export function translate(
  text: string,
  language: Language,
  values: Record<string, string | number> = {},
): string {
  const key = text.replace(/\s+/g, " ").trim();
  const template =
    language === "en" && Object.hasOwn(translations, key)
      ? translations[key]
      : text;
  return template.replace(/\{([^{}]+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}

export function applyTranslations(root: ParentNode, language: Language): void {
  for (const element of root.querySelectorAll("[data-i18n]")) {
    element.textContent = translate(
      element.getAttribute("data-i18n")!,
      language,
    );
  }
  for (const [source, target] of [
    ["data-i18n-aria", "aria-label"],
    ["data-i18n-title", "title"],
  ] as const) {
    for (const element of root.querySelectorAll(`[${source}]`)) {
      element.setAttribute(
        target,
        translate(element.getAttribute(source)!, language),
      );
    }
  }
}
