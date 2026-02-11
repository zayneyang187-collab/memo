// 获取页面上的关键元素
const taskInput = document.querySelector("#task-input");
const addButton = document.querySelector("#add-button");
const pendingList = document.querySelector("#pending-list");
const doneList = document.querySelector("#done-list");
const deletedList = document.querySelector("#deleted-list");
const totalCountEl = document.querySelector("#count-total");
const pendingCountEl = document.querySelector("#count-pending");
const doneCountEl = document.querySelector("#count-done");
const deletedCountEl = document.querySelector("#count-deleted");
const filterDateInput = document.querySelector("#filter-date");
const filterLeft = document.querySelector(".filter-left");
const filterClearButton = document.querySelector("#filter-clear");
const filterMenuButton = document.querySelector("#filter-menu-button");
const filterMenu = document.querySelector("#filter-menu");
const filterMenuItems = Array.from(
  document.querySelectorAll(".filter-menu-item")
);
const reportGenerateButton = document.querySelector("#report-generate");
const reportPanel = document.querySelector("#report-panel");
const reportContent = document.querySelector("#report-content");
const reportCopyButton = document.querySelector("#report-copy");
const reportCopyAiButton = document.querySelector("#report-copy-ai");
const toast = document.querySelector("#toast");
const toastCheck = toast.querySelector(".toast-check");
const STORAGE_KEY = "todo_tasks_v1";

let tasks = [];
let activeFilterDate = "";
let activeFilterMode = "none"; // none | date | last
let activeFilterDays = 0;
let latestReportText = "";
let latestAiPrompt = "";
let toastTimer = null;

const getToday = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return "未设置日期";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [y, m, d] = parts;
  return `${y}年${Number(m)}月${Number(d)}日`;
};

const getFilterRange = () => {
  if (activeFilterMode === "date" && activeFilterDate) {
    return { start: activeFilterDate, end: activeFilterDate };
  }

  if (activeFilterMode === "last" && activeFilterDays > 0) {
    const today = getToday();
    const start = new Date();
    start.setDate(start.getDate() - (activeFilterDays - 1));
    const startStr = start.toISOString().slice(0, 10);
    return { start: startStr, end: today };
  }

  return null;
};

const setActiveQuickFilter = (days) => {
  activeFilterMode = "last";
  activeFilterDays = days;
  activeFilterDate = "";
  filterDateInput.value = "";
  filterMenuButton.textContent = `最近 ${days} 天`;
  filterMenuItems.forEach((item) => {
    item.classList.toggle(
      "active",
      Number(item.dataset.days) === Number(days)
    );
  });
};

const resetQuickFilter = () => {
  activeFilterDays = 0;
  filterMenuButton.textContent = "快速筛选";
  filterMenuItems.forEach((item) => item.classList.remove("active"));
};

const updateReportButton = () => {
  const hasFilter = activeFilterMode !== "none";
  if (hasFilter) {
    if (activeFilterMode === "date") {
      reportGenerateButton.textContent = "生成当天总结";
    } else if (activeFilterMode === "last" && activeFilterDays) {
      if (activeFilterDays === 3) {
        reportGenerateButton.textContent = "生成 3天总结";
      } else if (activeFilterDays === 7) {
        reportGenerateButton.textContent = "生成 7天周报";
      } else if (activeFilterDays === 30) {
        reportGenerateButton.textContent = "生成 30天月报";
      } else {
        reportGenerateButton.textContent = `生成 ${activeFilterDays} 天总结`;
      }
    } else {
      reportGenerateButton.textContent = "生成周报";
    }
    reportGenerateButton.classList.remove("is-hidden");
  } else {
    reportGenerateButton.classList.add("is-hidden");
  }
};

// 根据窗口宽度缩放整体内容，缩小时也能完整看到
const updateScale = () => {
  const baseWidth = 1100;
  const horizontalPadding = 48; // body 左右 padding 24 * 2
  const available = Math.max(320, window.innerWidth - horizontalPadding);
  const scale = Math.min(1, Math.max(0.7, available / baseWidth));
  const fixed = scale.toFixed(3);
  document.documentElement.style.setProperty("--ui-scale", fixed);
  document.body.style.zoom = fixed;
};

// 轻提示：任务添加成功
const showToast = (message) => {
  toast.textContent = message;
  if (toastCheck) {
    toast.prepend(toastCheck);
  }
  toast.classList.add("show");

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1200);
};

// 更新统计数字（使用任务数据）
const updateStats = () => {
  const pendingCount = tasks.filter((t) => t.state === "pending").length;
  const doneCount = tasks.filter((t) => t.state === "done").length;
  const deletedCount = tasks.filter((t) => t.state === "deleted").length;
  const totalCount = pendingCount + doneCount + deletedCount;

  totalCountEl.textContent = totalCount;
  pendingCountEl.textContent = pendingCount;
  doneCountEl.textContent = doneCount;
  deletedCountEl.textContent = deletedCount;
};

// 折叠/展开列表
document.querySelectorAll(".btn-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.getAttribute("data-target");
    const listEl = document.getElementById(targetId);
    const headerEl = button.closest(".section-header");
    const statusEl = headerEl ? headerEl.querySelector(".toggle-status") : null;

    if (!listEl) {
      return;
    }

    listEl.classList.toggle("is-collapsed");
    button.classList.toggle("is-collapsed");

    // 点击后短暂显示当前状态
    if (headerEl && statusEl) {
      const isCollapsed = listEl.classList.contains("is-collapsed");
      statusEl.textContent = isCollapsed ? "已折叠" : "已展开";
      headerEl.classList.add("show-status");

      if (headerEl._statusTimer) {
        clearTimeout(headerEl._statusTimer);
      }

      headerEl._statusTimer = setTimeout(() => {
        headerEl.classList.remove("show-status");
      }, 1500);
    }
  });
});

// 根据任务状态，更新按钮文字与样式
const setActionsByState = (taskItem, state) => {
  const actionArea = taskItem.querySelector(".actions");
  actionArea.innerHTML = "";

  const createButton = (text, className) => {
    const btn = document.createElement("button");
    btn.className = `btn btn-small ${className}`;
    btn.textContent = text;
    return btn;
  };

  if (state === "pending") {
    actionArea.appendChild(createButton("完成", "btn-done"));
    actionArea.appendChild(createButton("删除", "btn-del"));
    taskItem.classList.remove("is-done");
    taskItem.classList.remove("is-deleted");
  }

  if (state === "done") {
    actionArea.appendChild(createButton("待完成", "btn-back"));
    actionArea.appendChild(createButton("删除", "btn-del"));
    taskItem.classList.add("is-done");
    taskItem.classList.remove("is-deleted");
  }

  if (state === "deleted") {
    actionArea.appendChild(createButton("待完成", "btn-back"));
    actionArea.appendChild(createButton("恢复到完成", "btn-restore"));
    taskItem.classList.remove("is-done");
    taskItem.classList.add("is-deleted");
  }
};

const normalizeTask = (raw, index) => {
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) return null;

  const state = ["pending", "done", "deleted"].includes(raw.state)
    ? raw.state
    : "pending";
  const date =
    typeof raw.date === "string" && raw.date ? raw.date : getToday();
  const id = raw.id
    ? String(raw.id)
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const createdAt =
    typeof raw.createdAt === "number" ? raw.createdAt : Date.now() + index;

  return { id, text, state, date, createdAt };
};

// 创建任务元素
const createTaskItem = (task) => {
  const taskItem = document.createElement("div");
  taskItem.className = "item";
  taskItem.dataset.id = task.id;

  const taskTitle = document.createElement("div");
  taskTitle.className = "item-title";
  taskTitle.textContent = task.text;

  const actionArea = document.createElement("div");
  actionArea.className = "actions";

  taskItem.appendChild(taskTitle);
  taskItem.appendChild(actionArea);
  setActionsByState(taskItem, task.state);

  return taskItem;
};

const renderList = (listEl, state) => {
  listEl.innerHTML = "";

  let items = tasks.filter((t) => t.state === state);
  if (activeFilterMode === "date" && activeFilterDate) {
    items = items.filter((t) => t.date === activeFilterDate);
  }

  if (activeFilterMode === "last" && activeFilterDays > 0) {
    const range = getFilterRange();
    items = items.filter((t) => t.date >= range.start && t.date <= range.end);
  }

  items.sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
  );

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-hint";
    empty.textContent = "暂无任务";
    listEl.appendChild(empty);
    return;
  }

  const groups = new Map();
  items.forEach((task) => {
    const key = task.date || "未设置日期";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(task);
  });

  Array.from(groups.entries()).forEach(([date, groupItems]) => {
    const groupEl = document.createElement("div");
    groupEl.className = "date-group";

    const titleEl = document.createElement("div");
    titleEl.className = "date-title";
    titleEl.textContent = formatDate(date);

    const itemsEl = document.createElement("div");
    itemsEl.className = "date-items";

    groupItems.forEach((task) => {
      itemsEl.appendChild(createTaskItem(task));
    });

    groupEl.appendChild(titleEl);
    groupEl.appendChild(itemsEl);
    listEl.appendChild(groupEl);
  });
};

const renderAll = () => {
  renderList(pendingList, "pending");
  renderList(doneList, "done");
  renderList(deletedList, "deleted");
  updateStats();
  updateReportButton();
};

// 保存任务到本地存储（刷新/重启也保留）
const saveTasks = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
};

// 从本地存储读取任务
const loadTasks = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        tasks = parsed
          .map((task, index) => normalizeTask(task, index))
          .filter(Boolean);
        return;
      }
    } catch {
      // 解析失败时不影响页面使用
    }
  }

  // 第一次访问：从示例任务中初始化
  const seed = [];
  const collect = (listEl, state) => {
    listEl.querySelectorAll(".item .item-title").forEach((titleEl) => {
      const task = normalizeTask(
        { text: titleEl.textContent, state, date: getToday() },
        seed.length
      );
      if (task) seed.push(task);
    });
  };

  collect(pendingList, "pending");
  collect(doneList, "done");
  collect(deletedList, "deleted");

  tasks = seed;
  saveTasks();
};

// 点击按钮时，更新任务状态
document.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const taskItem = target.closest(".item");
  if (!taskItem) {
    return;
  }

  const taskId = taskItem.dataset.id;
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return;
  }

  if (target.classList.contains("btn-done")) {
    task.state = "done";
  }

  if (target.classList.contains("btn-del")) {
    task.state = "deleted";
  }

  if (target.classList.contains("btn-back")) {
    task.state = "pending";
  }

  if (target.classList.contains("btn-restore")) {
    task.state = "done";
  }

  saveTasks();
  renderAll();
});

// 点击“添加”按钮时，创建新的任务
const addTask = () => {
  const taskText = taskInput.value.trim();
  if (taskText === "") {
    return;
  }

  const date = getToday();
  const newTask = normalizeTask(
    {
      text: taskText,
      state: "pending",
      date,
      createdAt: Date.now(),
    },
    tasks.length
  );

  if (!newTask) {
    return;
  }

  tasks.unshift(newTask);
  saveTasks();
  renderAll();

  taskInput.value = "";
  taskInput.focus();

  showToast("任务添加成功");
  addButton.classList.remove("bounce");
  void addButton.offsetWidth;
  addButton.classList.add("bounce");
};

addButton.addEventListener("click", addTask);

taskInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addTask();
  }
});

const openFilterPicker = () => {
  filterDateInput.focus();
  if (typeof filterDateInput.showPicker === "function") {
    filterDateInput.showPicker();
  }
};

// 点击筛选区域任意位置，都打开日期选择框
filterLeft.addEventListener("click", (event) => {
  if (event.target.closest("button") || event.target.closest(".filter-menu")) {
    return;
  }
  openFilterPicker();
});

filterDateInput.addEventListener("click", openFilterPicker);

// 按日期筛选
filterDateInput.addEventListener("change", () => {
  activeFilterDate = filterDateInput.value;
  activeFilterMode = activeFilterDate ? "date" : "none";
  resetQuickFilter();
  updateReportButton();
  renderAll();
});

const closeFilterMenu = () => {
  filterMenu.classList.add("is-hidden");
};

const toggleFilterMenu = () => {
  filterMenu.classList.toggle("is-hidden");
};

filterMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleFilterMenu();
});

filterMenuItems.forEach((item) => {
  item.addEventListener("click", () => {
    const days = Number(item.dataset.days);
    setActiveQuickFilter(days);
    updateReportButton();
    renderAll();
    closeFilterMenu();
  });
});

document.addEventListener("click", (event) => {
  if (
    !event.target.closest(".filter-menu-wrap") &&
    !filterMenu.classList.contains("is-hidden")
  ) {
    closeFilterMenu();
  }
});

filterClearButton.addEventListener("click", () => {
  filterDateInput.value = "";
  activeFilterDate = "";
  activeFilterMode = "none";
  resetQuickFilter();
  updateReportButton();
  renderAll();
});

const escapeHTML = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

const buildReport = () => {
  const range = getFilterRange();
  if (!range) {
    const emptyText = "请先选择日期或最近 7 天筛选，再生成周报。";
    return {
      text: emptyText,
      prompt: emptyText,
      html: `<div class="report-empty">${escapeHTML(emptyText)}</div>`,
    };
  }

  const rangeText =
    range.start === range.end
      ? formatDate(range.start)
      : `${formatDate(range.start)} ~ ${formatDate(range.end)}`;

  const filtered = tasks.filter((task) => {
    if (task.state === "deleted") return false;
    if (activeFilterMode === "date") {
      return task.date === range.start;
    }
    if (activeFilterMode === "last") {
      return task.date >= range.start && task.date <= range.end;
    }
    return false;
  });

  const doneTasks = filtered.filter((t) => t.state === "done");
  const pendingTasks = filtered.filter((t) => t.state === "pending");

  const lines = [];
  lines.push(`周报（${rangeText}）`);
  lines.push("");
  lines.push(`完成任务（${doneTasks.length}）`);
  if (doneTasks.length === 0) {
    lines.push("- 暂无");
  } else {
    doneTasks.forEach((t, idx) => lines.push(` ${idx + 1}. ${t.text}`));
  }

  lines.push("");
  lines.push(`待完成任务（${pendingTasks.length}）`);
  if (pendingTasks.length === 0) {
    lines.push("- 暂无");
  } else {
    pendingTasks.forEach((t, idx) => lines.push(` ${idx + 1}. ${t.text}`));
  }

  const reportText = lines.join("\n");

  const prompt = [
    "你是一名UVM验证领域的专业写作助手，请将下面的验证周报润色得更专业、简洁、有条理。",
    "要求：",
    "1. 保持原意，不遗漏任务信息。",
    "2. 语气自然、清晰、结构分明。",
    "3. 适合直接发送给团队。",
    "",
    `范围：${rangeText}`,
    `完成任务：${doneTasks.length} 项`,
    `待完成任务：${pendingTasks.length} 项`,
    "",
    "【原始周报】",
    reportText,
  ].join("\n");

  const buildList = (items) => {
    if (items.length === 0) {
      return `<div class="report-empty">暂无</div>`;
    }

    const listItems = items
      .map((item) => `<li>${escapeHTML(item.text)}</li>`)
      .join("");

    return `<ul class="report-list">${listItems}</ul>`;
  };

  const reportTitle =
    activeFilterMode === "date"
      ? "当天总结"
      : activeFilterDays === 3
        ? "3天总结"
        : activeFilterDays === 7
          ? "周报"
          : activeFilterDays === 30
            ? "月报"
            : "任务总结";

  const rangeStart = new Date(range.start);
  const rangeEnd = new Date(range.end);
  const rangeDays = Math.max(
    1,
    Math.round((rangeEnd - rangeStart) / 86400000) + 1
  );
  const totalCount = doneTasks.length + pendingTasks.length;
  const completionRate = totalCount
    ? Math.round((doneTasks.length / totalCount) * 100)
    : 0;
  const avgDone = totalCount ? (doneTasks.length / rangeDays).toFixed(1) : "0.0";

  let insightText = "继续保持记录习惯，让节奏更稳定。";
  if (totalCount === 0) {
    insightText = "本期暂无任务记录，可以先设定 1-2 个小目标。";
  } else if (doneTasks.length === 0) {
    insightText = "已记录任务但尚未完成，建议从最重要的一项开始。";
  } else if (pendingTasks.length === 0) {
    insightText = "本期任务全部完成，节奏非常好，继续保持。";
  } else {
    insightText = `已完成 ${doneTasks.length} 项，剩余 ${pendingTasks.length} 项建议优先处理。`;
  }

  const html = [
    `<div class="report-header">`,
    `<div class="report-title-main">${escapeHTML(reportTitle)}</div>`,
    `<div class="report-range">${escapeHTML(rangeText)}</div>`,
    `</div>`,
    `<div class="report-stats">`,
    `<span>完成 ${doneTasks.length}</span>`,
    `<span class="report-divider"></span>`,
    `<span>待完成 ${pendingTasks.length}</span>`,
    `<span class="report-divider"></span>`,
    `<span>合计 ${totalCount}</span>`,
    `</div>`,
    `<div class="report-summary">`,
    `<div class="summary-item"><span class="summary-label">完成率</span><span class="summary-value">${completionRate}%</span></div>`,
    `<div class="summary-item"><span class="summary-label">周期</span><span class="summary-value">${rangeDays} 天</span></div>`,
    `<div class="summary-item"><span class="summary-label">日均完成</span><span class="summary-value">${avgDone}</span></div>`,
    `</div>`,
    `<div class="report-progress"><div class="report-progress-fill" style="width:${completionRate}%"></div></div>`,
    `<div class="report-insight">${escapeHTML(insightText)}</div>`,
    `<div class="report-section">`,
    `<div class="report-section-title">完成任务</div>`,
    buildList(doneTasks),
    `</div>`,
    `<div class="report-section">`,
    `<div class="report-section-title">待完成任务</div>`,
    buildList(pendingTasks),
    `</div>`,
  ].join("");

  return { text: reportText, prompt, html };
};

reportGenerateButton.addEventListener("click", () => {
  const report = buildReport();
  latestReportText = report.text;
  latestAiPrompt = report.prompt;
  reportContent.innerHTML = report.html;
  reportPanel.classList.remove("is-hidden");
});

const copyText = async (text) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
};

const ensureReport = () => {
  if (!latestReportText) {
    const report = buildReport();
    latestReportText = report.text;
    latestAiPrompt = report.prompt;
  }
};

reportCopyButton.addEventListener("click", () => {
  ensureReport();
  copyText(latestReportText);
});

reportCopyAiButton.addEventListener("click", () => {
  ensureReport();
  copyText(latestAiPrompt);
});

// 初始化
loadTasks();
renderAll();
updateScale();
window.addEventListener("resize", updateScale);

// 注册 Service Worker，让页面可离线使用
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
