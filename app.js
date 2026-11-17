import { moduleStatus, validProgress } from "./learning.mjs";
import { retrieve } from "./retrieval.mjs";
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const views = [
  ["dashboard", "学习总览", "Dashboard"],
  ["roadmap", "课程知识地图", "Course roadmap"],
  ["lectures", "逐讲学习", "Lectures"],
  ["assignments", "作业 · 题目与详解", "Assignments"],
  ["formulas", "公式手册", "Formula handbook"],
  ["practice", "分级练习", "Practice"],
  ["tutor", "课程助教", "Tutor"],
  ["wrong", "错题本", "Wrong answers"],
  ["exam", "模拟考试", "Mock examination"],
  ["progress", "学习进度", "Progress"],
  ["settings", "设置与资料", "Settings"],
];
const themes = {
  classic: ["#e72830", "#ffe349", "#fffef8", "#f3f0e7", "#16171a"],
  ocean: ["#0964b0", "#76e4e8", "#fff", "#edf7fa", "#102a3a"],
  dark: ["#c1a1ff", "#d6c6ff", "#23232c", "#15151e", "#f4f1ff"],
  forest: ["#1d6448", "#e6e0bd", "#fffdf3", "#ecf0e7", "#18372b"],
  minimal: ["#111111", "#eeeeee", "#ffffff", "#f6f6f6", "#111111"],
};
const themeNames = {
  classic: "Classic Comic",
  ocean: "Ocean Blue",
  dark: "Dark Academic",
  forest: "Forest Green",
  minimal: "Minimal White",
};
let state = {
  theme: "classic",
  colors: null,
  completed: [],
  attempts: [],
  wrong: {},
  notes: {},
  lastLecture: 1,
};
try {
  const saved = JSON.parse(localStorage.getItem("eee104-v1"));
  if (validProgress(saved)) state = { ...state, ...saved };
} catch {}
let lectures = [],
  questions = [],
  assignments = [],
  corpus = [],
  backend = { backend: false, llm: false },
  chat = [],
  exam = null;
const hints = {};
function save() {
  try {
    localStorage.setItem("eee104-v1", JSON.stringify(state));
  } catch {
    toast("浏览器存储空间不足，请导出进度。");
  }
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  setTimeout(() => ($("#toast").hidden = true), 3500);
}
function contrast(hex) {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#16171a" : "#ffffff";
}
function applyTheme() {
  const colors = [...(themes[state.theme] || themes.classic)];
  if (state.colors) {
    colors[0] = state.colors[0];
    colors[1] = state.colors[1];
  }
  ["primary", "secondary", "paper", "bg", "ink"].forEach((k, i) =>
    document.documentElement.style.setProperty("--" + k, colors[i]),
  );
  document.documentElement.style.setProperty(
    "--line",
    state.theme === "dark" ? "#bbb3d0" : "#16171a",
  );
  document.documentElement.style.setProperty(
    "--muted",
    state.theme === "dark" ? "#c5bed0" : "#666461",
  );
  document.documentElement.style.setProperty(
    "--onprimary",
    contrast(colors[0]),
  );
  document.documentElement.style.setProperty(
    "--onsecondary",
    contrast(colors[1]),
  );
}
function math() {
  if (window.renderMathInElement)
    window.renderMathInElement($("#app"), {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$$", right: "$$", display: true },
      ],
      throwOnError: false,
      trust: false,
    });
}
const source = (file, page = 1) =>
  `<a class="source" href="assets/sources/${encodeURIComponent(file.split("/").pop())}#page=${page}" target="_blank" rel="noopener">${escapeHtml(file.split("/").pop())} · PDF 第 ${page} 页 ↗</a>`;
const button = (text, action, data = "", className = "") =>
  `<button class="${className}" data-action="${action}" ${data}>${text}</button>`;
function heading(title, subtitle = "") {
  return `<div class="topline"><span>EEE104 / DIGITAL ELECTRONICS I</span><span class="tag">${state.completed.length} / ${lectures.length} 讲已完成</span></div><h1>${title}</h1>${subtitle ? `<p class="muted">${subtitle}</p>` : ""}`;
}
function mastery(module) {
  return moduleStatus(state.attempts, module);
}
function lectureCard(l) {
  return `<article class="card lecture-card"><div class="row"><span class="number">L${String(l.id).padStart(2, "0")}</span><span class="pill">${state.completed.includes(l.id) ? "已完成" : "继续探索"}</span></div><h3>${escapeHtml(l.title)}</h3><small>${l.modules.length} 个知识模块 · 有原文出处</small><a class="btn" href="#lecture/${l.id}">进入学习 ↗</a></article>`;
}
function recommendations() {
  const weak = lectures
    .flatMap((l) => l.modules.map((m) => ({ ...m, lecture: l.id })))
    .filter(
      (m) =>
        state.attempts.some((a) => a.module === m.id && !a.correct) &&
        mastery(m.id) !== "Mastered",
    )
    .slice(0, 3);
  if (!weak.length) return "";
  return `<section class="card"><h3>根据作答记录，建议再练习</h3>${weak.map((m) => `<p><a href="#practice/${m.lecture}/${m.id}">${escapeHtml(m.title)} →</a></p>`).join("")}<small>这些模块出现过错误，目前还没有达到多次独立作答的掌握条件。</small></section>`;
}
function dashboard() {
  const mastered = lectures
    .flatMap((l) => l.modules)
    .filter((m) => mastery(m.id) === "Mastered").length;
  const next =
    lectures.find((l) => !state.completed.includes(l.id)) || lectures[0];
  return `${heading("把数字电路，<br>一步步想明白。")}<section class="hero"><div class="hero-copy"><span class="tag">YOUR NEXT CHAPTER</span><h2>从逻辑，到会做题。</h2><p>跟随课程讲义建立知识框架，拆解电路，再用练习检验自己的理解。</p><div class="row"><a class="btn primary" href="#lecture/${next?.id || 1}">继续学习 →</a><a class="btn" href="#assignments">查看作业详解</a></div></div><div class="hero-art" aria-label="数字逻辑芯片插画"><div class="bubble">THINK IN BITS!</div><div class="logic-chip"><span>INPUT → LOGIC → OUTPUT</span><strong>0 &nbsp; 1</strong><span>EEE104 · LET'S CONNECT</span></div></div></section><div class="grid stats"><div class="card stat"><small>课程讲义</small><strong>${lectures.length}</strong></div><div class="card stat"><small>独立练习</small><strong>${questions.length}</strong></div><div class="card stat"><small>已掌握模块</small><strong>${mastered}</strong></div><div class="card stat"><small>待复习错题</small><strong>${Object.values(state.wrong).filter((w) => !w.resolved).length}</strong></div></div>${recommendations()}<div class="section-title"><h2>打开你的下一讲</h2><a href="#lectures">全部讲义 →</a></div><div class="grid">${lectures.slice(0, 6).map(lectureCard).join("")}</div><div class="note">当前导入 Lecture 1–10、13–19。Lecture 11、12 未提供当前版本。模拟题与作业解答由课程材料推导，不代表官方考试范围或标准答案。</div>`;
}
function roadmap() {
  return (
    heading(
      "课程知识地图",
      "按已有讲义的先后顺序连接知识。周次仅使用已核对的课程页面信息。",
    ) +
    `<div class="roadmap">${lectures.map((l, i) => `<article class="card"><small>${i ? `上一讲 → Lecture ${lectures[i - 1].id}` : "从这里开始"}</small><h2><a href="#lecture/${l.id}">L${l.id} · ${escapeHtml(l.title)}</a></h2><div>${l.modules.map((m) => `<a class="step-link" href="#lecture/${l.id}/${m.id}">${escapeHtml(m.title)} →</a>`).join("")}</div></article>`).join("")}</div>`
  );
}
function lectureView(id, moduleId) {
  const l = lectures.find((x) => x.id === Number(id));
  if (!l) return heading("未找到这一讲");
  state.lastLecture = l.id;
  save();
  return (
    heading(
      `Lecture ${l.id}`,
      `Week ${l.week || "—"} · ${escapeHtml(l.title)}`,
    ) +
    `<div class="toolbar">${source(l.source)}${button(state.completed.includes(l.id) ? "取消完成标记" : "标记本讲完成", "complete", `data-id="${l.id}"`)}<a class="btn" href="#practice/${l.id}">本讲练习 →</a></div><section class="card"><h2>学习目标</h2><ul>${l.objectives.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul><h3>知识框架</h3><div class="row">${l.modules.map((m) => `<a href="#lecture/${l.id}/${m.id}">${escapeHtml(m.title)}</a>`).join("<span>→</span>")}</div></section>${l.modules.map((m) => `<article class="card module" id="module-${escapeHtml(m.id)}"><span class="pill">${mastery(m.id)}</span><h3>${escapeHtml(m.title)}</h3>${(m.pages || [1]).map((p) => source(l.source, p)).join(" · ")}<div class="explanation">${m.explanation}</div>${m.formula ? `<div class="formula">\\[${m.formula}\\]</div><p><b>适用条件</b> ${escapeHtml(m.conditions)}</p>` : ""}<div class="note"><b>易错点</b><ul>${(m.misconceptions || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>${(m.examples || []).map((ex) => `<details><summary>${escapeHtml(ex.level)} · ${escapeHtml(ex.question)}</summary><div>${ex.solution}</div></details>`).join("")}<div class="toolbar"><a class="btn" href="#practice/${l.id}/${m.id}">检验这个知识点</a><a class="btn" href="#tutor/${l.id}/${m.id}">向助教提问</a></div><label>用自己的话记下理解<textarea data-note="${escapeHtml(m.id)}" placeholder="这个概念解决了什么问题？">${escapeHtml(state.notes[m.id] || "")}</textarea></label></article>`).join("")}<section class="card revision-sheet"><h2>Lecture ${l.id} · 一页式复习框架</h2><p>${escapeHtml(l.summary)}</p><ol>${l.modules.map((m) => `<li><b>${escapeHtml(m.title)}</b> · ${escapeHtml(m.conditions || "结合原文图示与例题复习")}</li>`).join("")}</ol><h3>必会公式与条件</h3>${l.modules
      .filter((m) => m.formula)
      .map(
        (m) =>
          `<div>\\[${m.formula}\\]</div><small>${escapeHtml(m.conditions)}</small>`,
      )
      .join("")}<h3>易错点清单</h3><ul>${l.modules
      .flatMap((m) => m.misconceptions || [])
      .map((x) => `<li>${escapeHtml(x)}</li>`)
      .join(
        "",
      )}</ul><h3>中英文术语</h3><ul class="term-list">${(l.glossary || []).map((t) => `<li><b>${escapeHtml(t[0])}</b> — ${escapeHtml(t[1])}</li>`).join("")}</ul><h3>题型与解题模板</h3><ul>${(l.templates || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul><h3>下一步</h3><p>先独立完成本讲基础题，再挑战应用题。遇到错误时，用错题本记录错误步骤，并在另一天重新练习。</p>${button("打印复习框架", "print")}</section>`
  );
}
function assignmentView(id) {
  const chosen = id
    ? assignments.filter((a) => String(a.id) === id)
    : assignments;
  return (
    heading(
      "Assignment 题目与详解",
      "独立推导解答。先尝试做题，再展开完整步骤。电路图与波形请结合原题页阅读。",
    ) +
    `<div class="toolbar">${assignments.map((a) => `<a class="btn" href="#assignments/${a.id}">${escapeHtml(a.title)}</a>`).join("")}<a class="btn" href="#assignments">全部</a></div>${chosen.map((a) => `<section><h2>${escapeHtml(a.title)}</h2>${source(a.source)}${a.questions.map((q) => `<article class="card question" id="assignment-${escapeHtml(q.id)}"><h3>${escapeHtml(q.title || q.id)}</h3>${source(a.source, q.page)}<div>${q.prompt}</div>${q.image ? `<img class="original-page" loading="lazy" src="${q.image}" alt="${escapeHtml(q.title)} 原题">` : ""}<details><summary>分层提示</summary><ol>${(q.hints || []).map((h) => `<li>${h}</li>`).join("")}</ol></details><details><summary>展开完整解答与推导</summary><div class="solution">${q.solution}</div></details></article>`).join("")}</section>`).join("")}`
  );
}
function formulaView() {
  return (
    heading("公式手册", "从公式回到条件、含义和原始讲义。") +
    `<div class="toolbar"><input id="formula-search" placeholder="搜索公式或知识点" aria-label="搜索公式"></div><div id="formula-list">${lectures.flatMap((l) => l.modules.filter((m) => m.formula).map((m) => `<article class="card formula-card"><h3>${escapeHtml(m.title)}</h3><div class="formula">\\[${m.formula}\\]</div><p>${escapeHtml(m.conditions)}</p>${source(l.source, m.pages?.[0] || 1)}<a class="btn" href="#lecture/${l.id}/${m.id}">查看推导 →</a></article>`)).join("")}</div>`
  );
}
function questionCard(q, examMode = false) {
  return `<article class="card question" data-question="${q.id}"><span class="pill">${escapeHtml(q.level)}</span><h3>${q.prompt}</h3><fieldset class="options"><legend class="muted">选择一个答案</legend>${q.options.map((o, i) => `<label><input type="radio" name="q-${q.id}" value="${i}" ${examMode && exam?.answers[q.id] === i ? "checked" : ""} ${examMode && exam?.finished ? "disabled" : ""}><span>${o}</span></label>`).join("")}</fieldset>${examMode ? "" : `<div class="row">${button("提交答案", "answer", `data-id="${q.id}"`, "primary")}${button("提示 · 逐层展开", "hint", `data-id="${q.id}"`)}${button("重新作答", "retry", `data-id="${q.id}" hidden`)}</div><div class="feedback" data-feedback="${q.id}" hidden></div>`}</article>`;
}
function practiceView(lecture, module) {
  let pool = questions.filter(
    (q) =>
      (!lecture || String(q.lecture) === lecture) &&
      (!module || q.module === module),
  );
  return (
    heading(
      "交互练习",
      "每次提交会保存作答。至少跨两天、做对多个不同题目，才会标为已掌握。",
    ) +
    `<div class="toolbar"><select id="practice-lecture" aria-label="练习讲义"><option value="">全部讲义</option>${lectures.map((l) => `<option value="${l.id}" ${String(l.id) === lecture ? "selected" : ""}>Lecture ${l.id}</option>`).join("")}</select><select id="practice-level" aria-label="练习难度"><option value="">全部难度</option><option value="basic">基础理解</option><option value="intermediate">中等应用</option><option value="challenge">挑战</option></select></div><div id="question-list">${pool.map((q) => questionCard(q)).join("") || "<p>这个模块的练习尚未收录。</p>"}</div>`
  );
}
function record(q, choice, assisted = false) {
  const correct = choice === q.answer;
  state.attempts.push({
    question: q.id,
    module: q.module,
    lecture: q.lecture,
    choice,
    correct,
    assisted,
    time: Date.now(),
  });
  if (!correct)
    state.wrong[q.id] = {
      ...state.wrong[q.id],
      question: q.id,
      reason: state.wrong[q.id]?.reason || "",
      resolved: false,
      last: Date.now(),
    };
  else if (state.wrong[q.id]) {
    state.wrong[q.id].resolved = !assisted;
    state.wrong[q.id].last = Date.now();
  }
  save();
  return correct;
}
function wrongView() {
  const entries = Object.values(state.wrong);
  return (
    heading(
      "错题本",
      "记录错误原因，再独立重做。重做正确会标记已复习，掌握状态由多次练习共同决定。",
    ) +
    (entries.length
      ? entries
          .map((w) => {
            const q = questions.find((q) => q.id === w.question);
            if (!q) return "";
            return `<section><span class="tag">${w.resolved ? "已复习" : "待复习"}</span>${questionCard(q)}<label>这次错误发生在哪里？<textarea data-reason="${q.id}" placeholder="例如：把 Q 与反相输出混淆了">${escapeHtml(w.reason)}</textarea></label></section>`;
          })
          .join("")
      : '<div class="card empty">还没有错题记录。<br><a href="#practice">开始一组练习 →</a></div>')
  );
}
function progressView() {
  return (
    heading(
      "学习进度",
      "完成讲义与掌握知识点分别记录。标记读完一讲不会自动将知识点标为掌握。",
    ) +
    `<div class="card"><h3>${state.completed.length} / ${lectures.length} 讲已完成</h3><progress value="${state.completed.length}" max="${lectures.length}"></progress><p>累计作答 ${state.attempts.length} 次 · 无提示正确 ${state.attempts.filter((a) => a.correct && !a.assisted).length} 次</p></div>${lectures.map((l) => `<div class="card"><h3><a href="#lecture/${l.id}">Lecture ${l.id} · ${escapeHtml(l.title)}</a></h3>${l.modules.map((m) => `<p>${escapeHtml(m.title)} <span class="pill">${mastery(m.id)}</span></p>`).join("")}</div>`).join("")}`
  );
}
function examView() {
  if (!exam)
    return (
      heading(
        "模拟考试",
        "从学习题库抽题，交卷后集中反馈。这是自主练习，不代表真实考试题量、时长或评分标准。",
      ) +
      `<div class="card"><label>练习题数 <select id="exam-count"><option>10</option><option>20</option><option>30</option></select></label> <label>时长（分钟） <input id="exam-minutes" type="number" value="20" min="1" max="180"></label><p>考试期间关闭答案反馈与提示。离开页面或刷新后可继续当前考试。</p>${button("开始模拟考试", "start-exam", "", "primary")}</div>`
    );
  return (
    heading(exam.finished ? "考试回顾" : "模拟考试进行中") +
    `<div class="note" id="timer"></div>${exam.questions
      .map((id) => {
        const q = questions.find((q) => q.id === id);
        if (!q) return "";
        return (
          questionCard(q, true) +
          (exam.finished
            ? `<div class="card"><b>${exam.answers[id] === q.answer ? "回答正确" : "需要复习"}</b><p>${q.explanation}</p>${source(q.source, q.page)}</div>`
            : "")
        );
      })
      .join(
        "",
      )}<div class="row">${exam.finished ? button("开始新的练习", "reset-exam") : button("交卷并查看解析", "submit-exam", "", "primary")}</div>`
  );
}
function tutorView(lecture, module) {
  const l = lectures.find((l) => String(l.id) === lecture);
  const m = l?.modules.find((m) => m.id === module);
  return (
    heading("课程助教", "先定位材料，再围绕你的理解展开学习。") +
    `<div class="note">${backend.llm ? "后端模型已连接。回答会检查引用编号，事实与公式仍需结合原文复核。" : backend.backend ? "本地检索 API 已连接。尚未配置 LLM，目前提供关键词检索与原文定位。" : "当前为预加载资料关键词检索。语言模型问答、服务端上传需启动本地后端。"}</div>${m ? `<div class="card">当前知识点 · ${escapeHtml(m.title)}${source(l.source, m.pages?.[0] || 1)}</div>` : ""}<div class="toolbar"><select id="tutor-mode" aria-label="教学模式"><option value="practice">Practice · 引导做题</option><option value="learning">Learning · 详细讲解</option><option value="exam">Exam · 考后讲解</option></select><select id="tutor-lecture" aria-label="检索范围"><option value="">全部材料</option>${lectures.map((l) => `<option value="${l.id}" ${String(l.id) === lecture ? "selected" : ""}>Lecture ${l.id}</option>`).join("")}</select></div><form id="tutor-form"><label for="question-input">你卡在哪一步？</label><textarea id="question-input" required maxlength="6000" placeholder="例如：为什么 JK 触发器在 J=K=1 时会翻转？"></textarea><div class="toolbar"><button class="primary" type="submit">${backend.llm ? "提问并检索" : "检索课程原文"} →</button></div></form><div id="chat">${chat.map(renderMessage).join("")}</div>`
  );
}
function renderMessage(message) {
  return `<div class="chat-message ${message.role}">${escapeHtml(message.text)}</div>${(message.sources || []).map((s, i) => `<details class="card"><summary>[S${i + 1}] ${escapeHtml(s.topic)} · PDF ${s.page}</summary>${s.uploaded ? `<a class="source" href="uploads/${encodeURIComponent(s.source)}#page=${s.page}" target="_blank" rel="noopener">${escapeHtml(s.source)} · 第 ${s.page} 页</a>` : source(s.source, s.page)}${s.needsReview ? '<p class="warning">图示、表格排版和公式符号可能需要对照原页核对。</p>' : ""}<div class="snippet">${escapeHtml(s.text)}</div></details>`).join("")}`;
}
function settingsView() {
  return (
    heading("设置与课程资料") +
    `<section class="card"><h2>选择你的学习配色</h2><div class="grid">${Object.keys(
      themes,
    )
      .map(
        (k) =>
          `<button data-action="theme" data-theme="${k}" style="border-left:15px solid ${themes[k][0]}">${themeNames[k]} ${state.theme === k ? "✓" : ""}</button>`,
      )
      .join(
        "",
      )}</div><div class="toolbar"><label>主色 <input type="color" id="primary-color" value="${state.colors?.[0] || themes[state.theme][0]}"></label><label>辅助色 <input type="color" id="secondary-color" value="${state.colors?.[1] || themes[state.theme][1]}"></label>${button("保存自定义配色", "colors")}</div></section><section class="card"><h2>学习数据</h2><p>记录保存在当前浏览器的 localStorage。可以导出备份并在其他设备导入。</p><div class="row">${button("导出学习记录", "export")}<label>导入备份 <input type="file" id="import-progress" accept=".json"></label></div></section><section class="card"><h2>课程资料库</h2><p>已索引 ${corpus.length} 个 PDF 页面。逐页保留文件名与实际 PDF 页码；周次未知时留空。</p><p>检索使用关键词与中英文课程词汇映射，尚未配置语义向量检索。没有标注相关文档全集时，不报告 Recall 或 Precision 数值。</p><label>上传 PDF / PPTX / PPT <input type="file" id="upload-document" accept=".pdf,.pptx,.ppt" ${backend.backend ? "" : "disabled"}></label><p class="muted">${backend.backend ? "文件在本地后端解析。PPT 需要安装 LibreOffice，公式与电路图需人工核对。" : "本地运行 npm start 后支持上传。PDF 解析需 Python + PyMuPDF，旧版 PPT 需 LibreOffice。"}</p><div id="upload-status" role="status"></div></section><section class="card"><h2>可信问答配置</h2><p>模型 Key 只由后端环境变量读取。通过 LLM_BASE_URL、LLM_MODEL、LLM_API_KEY 配置兼容 Chat Completions 的服务。未配置时使用免费的本地检索。</p><p>当前模型状态 · ${backend.llm ? "已配置" : "未配置"}。后端验证引用编号，并调用模型核验事实与公式。未通过时修正一次并重新核验。模型自检不能保证全部推理正确。</p></section>`
  );
}
function render() {
  for (const key of Object.keys(hints)) delete hints[key];
  const [route, id, module] = location.hash.slice(1).split("/");
  const view = route || "dashboard";
  $("#nav").innerHTML = views
    .map(
      ([key, zh, en]) =>
        `<a href="#${key}" class="${key === view || (view === "lecture" && key === "lectures") ? "active" : ""}" ${key === view ? 'aria-current="page"' : ""}>${zh}<small style="display:block;font-size:10px;font-weight:400">${en}</small></a>`,
    )
    .join("");
  const content = {
    dashboard,
    roadmap,
    lectures: () =>
      heading("逐讲学习", "按 PPT 顺序学习，每个知识模块都有来源与练习。") +
      `<div class="grid">${lectures.map(lectureCard).join("")}</div>`,
    lecture: () => lectureView(id, module),
    assignments: () => assignmentView(id),
    formulas: formulaView,
    practice: () => practiceView(id, module),
    wrong: wrongView,
    exam: examView,
    progress: progressView,
    tutor: () => tutorView(id, module),
    settings: settingsView,
  };
  $("#app").innerHTML = (content[view] || dashboard)();
  math();
  $("#sidebar").classList.remove("open");
  $("#menu").setAttribute("aria-expanded", "false");
  if (module && view === "lecture")
    document.getElementById("module-" + module)?.scrollIntoView();
  else window.scrollTo(0, 0);
  updateTimer();
}
async function answerTutor(event) {
  event.preventDefault();
  const question = $("#question-input").value.trim();
  if (!question) return;
  const moduleId = location.hash.split("/")[2];
  const currentModule = lectures
    .flatMap((l) => l.modules.map((m) => ({ ...m, lecture: l.id })))
    .find((m) => m.id === moduleId);
  const context = currentModule
    ? { lecture: currentModule.lecture, pages: currentModule.pages }
    : null;
  const mode = $("#tutor-mode").value,
    lecture = $("#tutor-lecture").value;
  const submit = event.target.querySelector("button");
  submit.disabled = true;
  chat.push({ role: "user", text: question });
  $("#chat").innerHTML = chat.map(renderMessage).join("");
  try {
    let result;
    if (backend.backend) {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          mode,
          lecture,
          history: chat.slice(-6),
          context,
        }),
      });
      result = await response.json();
      if (!response.ok) throw Error(result.error);
    } else {
      const sources =
        mode === "exam" ? [] : retrieve(question, corpus, { lecture, context });
      result = {
        sources,
        answer:
          mode === "exam"
            ? "考试模式在交卷后开放讲解。"
            : sources.length
              ? "请先阅读下方匹配原文，再检查：你能解释输入条件如何决定输出吗？当前显示的是检索结果，未调用语言模型。"
              : "当前材料中未找到足够相关的文字。请使用更具体的课程术语，或查看原始电路图。",
      };
    }
    chat.push({
      role: "assistant",
      text: result.answer + (result.note ? "\n" + result.note : ""),
      sources: result.sources,
    });
    $("#chat").innerHTML = chat.map(renderMessage).join("");
    math();
  } catch (error) {
    toast("问答失败：" + error.message);
  } finally {
    submit.disabled = false;
  }
}
function persistExam() {
  try {
    localStorage.setItem("eee104-exam", JSON.stringify(exam));
  } catch {
    toast("考试记录未能保存，请检查浏览器存储空间。");
  }
}
function updateTimer() {
  if (!exam || !$("#timer")) return;
  const seconds = Math.max(0, Math.ceil((exam.deadline - Date.now()) / 1000));
  $("#timer").textContent = exam.finished
    ? `已交卷 · ${exam.questions.filter((id) => exam.answers[id] === questions.find((q) => q.id === id)?.answer).length} / ${exam.questions.length} 题正确`
    : `剩余 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
  if (!seconds && !exam.finished) finishExam();
}
function finishExam() {
  if (!exam || exam.finished) return;
  exam.finished = true;
  exam.questions.forEach((id) => {
    const q = questions.find((q) => q.id === id);
    if (q) record(q, exam.answers[id] ?? -1);
  });
  persistExam();
  render();
}
document.addEventListener("click", async (event) => {
  const b = event.target.closest("[data-action]");
  if (!b) return;
  const { action, id } = b.dataset;
  if (action === "complete") {
    const n = Number(id);
    state.completed = state.completed.includes(n)
      ? state.completed.filter((x) => x !== n)
      : [...state.completed, n];
    save();
    render();
  }
  if (action === "theme") {
    state.theme = b.dataset.theme;
    state.colors = null;
    save();
    applyTheme();
    render();
  }
  if (action === "colors") {
    state.colors = [$("#primary-color").value, $("#secondary-color").value];
    save();
    applyTheme();
    toast("配色已保存");
  }
  if (action === "print") {
    document.body.classList.add("printing-summary");
    window.print();
    document.body.classList.remove("printing-summary");
  }
  if (action === "retry") {
    const card = b.closest("[data-question]");
    card.querySelectorAll("input").forEach((i) => {
      i.disabled = false;
      i.checked = false;
    });
    card.querySelector("[data-action=answer]").disabled = false;
    card.querySelector("[data-feedback]").hidden = true;
    b.hidden = true;
  }
  if (action === "answer" || action === "hint") {
    const q = questions.find((q) => q.id === id);
    const feedback = document.querySelector(`[data-feedback="${id}"]`);
    if (action === "answer") {
      const selected = document.querySelector(`input[name="q-${id}"]:checked`);
      if (!selected) return toast("请先选择答案");
      const correct = record(q, Number(selected.value), !!hints[id]);
      feedback.hidden = false;
      feedback.innerHTML = correct
        ? `<b class="success">回答正确</b><p>${q.explanation}</p>${source(q.source, q.page)}`
        : '<b class="error">还需要检查一下。展开第一级提示，再试一次。</b>';
      if (!correct)
        b
          .closest("[data-question]")
          .querySelector("[data-action=retry]").hidden = false;
      b.disabled = true;
      document
        .querySelectorAll(`input[name="q-${id}"]`)
        .forEach((input) => (input.disabled = true));
    } else {
      hints[id] = Math.min((hints[id] || 0) + 1, 4);
      feedback.hidden = false;
      feedback.innerHTML = `<b>Level ${hints[id]}</b><p>${q.hints[hints[id] - 1] || q.explanation}</p>`;
      if (hints[id] === 4) feedback.innerHTML += source(q.source, q.page);
    }
    math();
  }
  if (action === "start-exam") {
    const count = Math.min(Number($("#exam-count").value), questions.length);
    const minutes = Math.max(
      1,
      Math.min(180, Number($("#exam-minutes").value) || 20),
    );
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    exam = {
      questions: shuffled.slice(0, count).map((q) => q.id),
      answers: {},
      deadline: Date.now() + minutes * 60000,
      finished: false,
    };
    persistExam();
    render();
  }
  if (action === "submit-exam") finishExam();
  if (action === "reset-exam") {
    exam = null;
    persistExam();
    render();
  }
  if (action === "export") {
    const blob = new Blob([JSON.stringify({ version: 1, state }, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "EEE104-progress.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
});
document.addEventListener("submit", (event) => {
  if (event.target.id === "tutor-form") answerTutor(event);
});
document.addEventListener("input", (event) => {
  const e = event.target;
  if (e.dataset.note) {
    state.notes[e.dataset.note] = e.value;
    save();
  }
  if (e.dataset.reason) {
    state.wrong[e.dataset.reason].reason = e.value;
    save();
  }
  if (e.id === "formula-search")
    document
      .querySelectorAll(".formula-card")
      .forEach(
        (card) =>
          (card.hidden = !card.textContent
            .toLowerCase()
            .includes(e.value.toLowerCase())),
      );
});
document.addEventListener("change", async (event) => {
  const e = event.target;
  if (
    e.name?.startsWith("q-") &&
    location.hash.startsWith("#exam") &&
    exam &&
    !exam.finished
  ) {
    exam.answers[e.name.slice(2)] = Number(e.value);
    persistExam();
  }
  if (e.id === "practice-lecture") location.hash = "practice/" + e.value;
  if (e.id === "practice-level")
    document
      .querySelectorAll("[data-question]")
      .forEach(
        (card) =>
          (card.hidden =
            !!e.value &&
            questions.find((q) => q.id === card.dataset.question).level !==
              e.value),
      );
  if (e.id === "import-progress") {
    try {
      const value = JSON.parse(await e.files[0].text());
      if (value.version !== 1 || !validProgress(value.state))
        throw Error("不兼容的备份文件");
      state = { ...state, ...value.state };
      save();
      applyTheme();
      render();
      toast("学习记录已导入");
    } catch (err) {
      toast(err.message);
    }
  }
  if (e.id === "upload-document" && e.files[0]) {
    const file = e.files[0];
    $("#upload-status").textContent = "正在解析资料…";
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "X-Filename": encodeURIComponent(file.name) },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      $("#upload-status").textContent =
        `已添加 ${data.pages} 页。${data.warning}`;
    } catch (err) {
      $("#upload-status").textContent = err.message;
    }
  }
});
$("#menu").onclick = () => {
  const open = $("#sidebar").classList.toggle("open");
  $("#menu").setAttribute("aria-expanded", String(open));
};
window.addEventListener("hashchange", render);
setInterval(updateTimer, 1000);
applyTheme();
try {
  [lectures, questions, assignments, corpus] = await Promise.all(
    ["lectures", "questions", "assignments", "corpus"].map(async (name) => {
      const response = await fetch(`data/${name}.json`);
      if (!response.ok) throw Error(`${name} 数据尚未就绪`);
      return response.json();
    }),
  );
  try {
    const res = await fetch("/api/status");
    if (res.ok) backend = await res.json();
  } catch {}
  try {
    exam = JSON.parse(localStorage.getItem("eee104-exam"));
    if (exam && !Array.isArray(exam.questions)) exam = null;
  } catch {}
  render();
} catch (error) {
  $("#app").innerHTML =
    heading("课程数据正在准备") +
    `<p>${escapeHtml(error.message)}</p><p>请通过本地服务启动本站，避免浏览器对直接打开文件的读取限制。</p>`;
}
