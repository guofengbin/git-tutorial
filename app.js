const STORAGE_KEY = "todo_app_v1";

/** @typedef {{id:string,text:string,done:boolean,createdAt:number,updatedAt:number}} Todo */

/** @returns {Todo[]} */
function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t.id === "string" && typeof t.text === "string")
      .map((t) => ({
        id: t.id,
        text: String(t.text).trim(),
        done: Boolean(t.done),
        createdAt: Number(t.createdAt) || Date.now(),
        updatedAt: Number(t.updatedAt) || Number(t.createdAt) || Date.now(),
      }))
      .filter((t) => t.text.length > 0);
  } catch {
    return [];
  }
}

/** @param {Todo[]} todos */
function saveTodos(todos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function fmtTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const els = {
  form: document.getElementById("todoForm"),
  input: document.getElementById("todoInput"),
  list: document.getElementById("todoList"),
  empty: document.getElementById("emptyState"),
  stats: document.getElementById("stats"),
  clearDone: document.getElementById("clearDone"),
  clearAll: document.getElementById("clearAll"),
  filterButtons: Array.from(document.querySelectorAll("[data-filter]")),
};

/** @type {Todo[]} */
let todos = loadTodos();
/** @type {"all"|"active"|"done"} */
let filter = "all";

function setFilter(next) {
  filter = next;
  for (const btn of els.filterButtons) {
    const selected = btn.dataset.filter === filter;
    btn.setAttribute("aria-selected", selected ? "true" : "false");
  }
  render();
}

function getVisibleTodos() {
  if (filter === "active") return todos.filter((t) => !t.done);
  if (filter === "done") return todos.filter((t) => t.done);
  return todos;
}

function updateStats() {
  const total = todos.length;
  const done = todos.filter((t) => t.done).length;
  const active = total - done;
  els.stats.textContent = `${active} 未完成 · ${done} 已完成 · 共 ${total} 条`;
}

function render() {
  const visible = getVisibleTodos();
  els.list.innerHTML = "";

  if (todos.length === 0) {
    els.empty.hidden = false;
  } else {
    els.empty.hidden = visible.length !== 0;
  }

  for (const t of visible) {
    els.list.appendChild(renderItem(t));
  }

  updateStats();
  saveTodos(todos);
}

function renderItem(todo) {
  const li = document.createElement("li");
  li.className = `todo${todo.done ? " done" : ""}`;
  li.dataset.id = todo.id;

  const check = document.createElement("button");
  check.className = "check";
  check.type = "button";
  check.title = todo.done ? "标记为未完成" : "标记为已完成";
  check.setAttribute("aria-label", check.title);
  check.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  check.addEventListener("click", () => toggleDone(todo.id));

  const content = document.createElement("div");
  content.className = "content";

  const text = document.createElement("div");
  text.className = "text";
  text.textContent = todo.text;
  text.title = "双击编辑";
  text.addEventListener("dblclick", () => startEdit(todo.id));

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `创建：${fmtTime(todo.createdAt)}${todo.updatedAt !== todo.createdAt ? ` · 更新：${fmtTime(todo.updatedAt)}` : ""}`;

  content.appendChild(text);
  content.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "rowActions";

  const editBtn = document.createElement("button");
  editBtn.className = "iconBtn";
  editBtn.type = "button";
  editBtn.textContent = "编辑";
  editBtn.addEventListener("click", () => startEdit(todo.id));

  const delBtn = document.createElement("button");
  delBtn.className = "iconBtn danger";
  delBtn.type = "button";
  delBtn.textContent = "删除";
  delBtn.addEventListener("click", () => removeTodo(todo.id));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  li.appendChild(check);
  li.appendChild(content);
  li.appendChild(actions);
  return li;
}

function addTodo(text) {
  const value = String(text || "").trim();
  if (!value) return;
  const now = Date.now();
  todos.unshift({ id: uid(), text: value, done: false, createdAt: now, updatedAt: now });
  render();
}

function toggleDone(id) {
  const t = todos.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  t.updatedAt = Date.now();
  render();
}

function removeTodo(id) {
  const idx = todos.findIndex((x) => x.id === id);
  if (idx < 0) return;
  todos.splice(idx, 1);
  render();
}

function clearDone() {
  const before = todos.length;
  todos = todos.filter((t) => !t.done);
  if (todos.length !== before) render();
}

function clearAll() {
  todos = [];
  render();
}

function startEdit(id) {
  const li = els.list.querySelector(`li.todo[data-id="${CSS.escape(id)}"]`);
  if (!li) return;
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  cancelAnyEdit();

  li.dataset.editing = "true";
  const content = li.querySelector(".content");
  if (!content) return;

  const input = document.createElement("input");
  input.className = "editInput";
  input.type = "text";
  input.value = todo.text;
  input.maxLength = 120;
  input.setAttribute("aria-label", "编辑待办内容");

  const meta = content.querySelector(".meta");
  const text = content.querySelector(".text");
  if (!text) return;

  const original = todo.text;
  text.replaceWith(input);

  function commit() {
    const next = input.value.trim();
    if (!next) {
      todo.text = original;
    } else {
      todo.text = next;
      todo.updatedAt = Date.now();
    }
    render();
  }

  function cancel() {
    render();
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  });
  input.addEventListener("blur", commit, { once: true });

  if (meta) meta.textContent = "编辑中…（Enter 保存 / Esc 取消）";
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function cancelAnyEdit() {
  const editing = els.list.querySelector('li.todo[data-editing="true"]');
  if (editing) render();
}

// events
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodo(els.input.value);
  els.input.value = "";
  els.input.focus();
});

for (const btn of els.filterButtons) {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
}

els.clearDone.addEventListener("click", clearDone);
els.clearAll.addEventListener("click", clearAll);

// initial render
render();
