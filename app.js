/* app.js — dashboard controller */

const SPACES = [
    { kind: "inventory", label: "Inventory" },
    { kind: "tasks", label: "Tasks" }
];

const svg = (inner, extra = "") =>
    `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${inner}</svg>`;

const ICON = {
    chev: svg('<path d="M6 3.5l4.5 4.5L6 12.5"/>'),
    folder: svg('<path d="M2 4.5A1.5 1.5 0 013.5 3H6l1.5 1.7h5A1.5 1.5 0 0114 6.2v5.3a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5z"/>'),
    folderPlus: svg('<path d="M2 4.5A1.5 1.5 0 013.5 3H6l1.5 1.7h5A1.5 1.5 0 0114 6.2v5.3a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5z"/><path d="M8 7v4M6 9h4"/>'),
    list: svg('<path d="M6.5 4h7M6.5 8h7M6.5 12h7"/><path d="M2.6 4h.1M2.6 8h.1M2.6 12h.1" stroke-width="2.2"/>'),
    plus: svg('<path d="M8 3v10M3 8h10"/>'),
    dots: svg('<circle cx="3.5" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="12.5" cy="8" r="1" fill="currentColor" stroke="none"/>'),
    pencil: svg('<path d="M3 13l.7-3L10.6 3.1a1.4 1.4 0 012 2L5.7 12z"/>'),
    trash: svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.8 4.5l.5 8.5h5.4l.5-8.5"/>'),
    check: svg('<path d="M3.5 8.5l3 3 6-7"/>')
};

// What can be edited, and how each field is checked
const FIELDS = {
    inventory: {
        name:  { label: "Item name", type: "text", required: true },
        sku:   { label: "SKU", type: "text" },
        stock: { label: "Stock quantity", type: "number", min: 0, step: 1, integer: true },
        price: { label: "Price", type: "number", min: 0, step: "any" },
        lowAt: { label: "Reorder when stock is at or below", type: "number", min: 0, step: 1, integer: true }
    },
    tasks: {
        title:    { label: "Task name", type: "text", required: true },
        priority: { label: "Priority", type: "select", options: Tasks.PRIORITIES },
        status:   { label: "Status", type: "select", options: Tasks.STATUSES },
        due:      { label: "Due date", type: "date" }
    }
};

const STATUS_CLS = { open: "gray", "in progress": "info", done: "ok" };
const PRIORITY_CLS = { high: "bad", medium: "warn", low: "gray" };

let currentListId = null;
let currentView = "inventory"; // follows the kind of the open list

document.addEventListener("DOMContentLoaded", () => {
    Storage.seed();
    Tree.load();
    Inventory.load();
    Tasks.load();
    applySavedTheme();
    restoreList();
    bindEvents();
    renderAll();
});

function bindEvents() {
    const sideNav = document.getElementById("sideNav");
    sideNav.addEventListener("click", onSideClick);
    sideNav.addEventListener("keydown", onRowKey);

    const panel = document.getElementById("panel");
    panel.addEventListener("click", onPanelClick);
    panel.addEventListener("keydown", onEditableKey);

    document.getElementById("searchInput").addEventListener("input", e => renderList(e.target.value));
    document.getElementById("addBtn").addEventListener("click", e => addItem(e.currentTarget));
    document.getElementById("themeBtn").addEventListener("click", toggleTheme);

    // Click the list's name at the top to rename it
    const title = document.getElementById("panelTitle");
    title.addEventListener("click", () => renameNode(title, currentListId));
    title.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            renameNode(title, currentListId);
        }
    });

    // Sidebar drawer on small screens
    const shell = document.getElementById("shell");
    document.getElementById("menuBtn").addEventListener("click", () => shell.classList.toggle("side-open"));
    document.getElementById("scrim").addEventListener("click", () => shell.classList.remove("side-open"));
}

/* ---- Night / light mode ---- */
function applySavedTheme() {
    // The head script already set the class before first paint;
    // here we just sync the button icon with the current state.
    const night = document.documentElement.classList.contains("night");
    document.getElementById("themeBtn").textContent = night ? "☀️" : "🌙";
}

function toggleTheme() {
    const isNight = document.documentElement.classList.toggle("night");
    localStorage.setItem("flowstock_theme", isNight ? "night" : "light");
    document.getElementById("themeBtn").textContent = isNight ? "☀️" : "🌙";
}

/* ---- Which list is open ---- */
function restoreList() {
    const saved = Tree.get(Number(localStorage.getItem("flowstock_list")));
    const savedView = localStorage.getItem("flowstock_view");
    const node = (saved && saved.type === "list" ? saved : null)
        || (savedView ? Tree.firstList(savedView) : null)
        || Tree.firstList();
    setCurrent(node);
    if (node) Tree.openPath(node.id);
}

function setCurrent(node) {
    currentListId = node ? node.id : null;
    if (node) {
        currentView = node.kind;
        localStorage.setItem("flowstock_list", String(node.id));
        localStorage.setItem("flowstock_view", node.kind);
    }
}

function selectList(id) {
    const node = Tree.get(id);
    if (!node || node.type !== "list") return;
    setCurrent(node);
    Tree.openPath(id);
    document.getElementById("searchInput").value = "";
    document.getElementById("shell").classList.remove("side-open");
    renderAll();
}

/* ---- Rendering ---- */
function currentQuery() {
    return document.getElementById("searchInput").value;
}

function renderAll() {
    renderSidebar();
    renderHeader();
    renderStats();
    renderList(currentQuery());
}

function renderSidebar() {
    const nav = document.getElementById("sideNav");

    nav.innerHTML = SPACES.map(space => {
        const tree = Tree.children(space.kind, null).length
            ? renderNodes(space.kind, null, 0)
            : `<div class="tree-empty" style="--d:0">No folders yet. Click the folder icon above to create one.</div>`;

        return `
            <section class="side-section">
                <div class="side-head">
                    <span class="side-title">${space.label}</span>
                    <button class="icon-btn" data-act="new-folder" data-kind="${space.kind}"
                            title="Create folder" aria-label="Create folder in ${space.label}">${ICON.folderPlus}</button>
                </div>
                <div class="tree">${tree}</div>
            </section>
        `;
    }).join("");
}

function renderNodes(kind, parentId, depth) {
    return Tree.children(kind, parentId).map(node => {
        const name = escapeHtml(node.name);

        if (node.type === "folder") {
            const kids = Tree.children(kind, node.id);
            const inside = !node.open ? ""
                : kids.length ? renderNodes(kind, node.id, depth + 1)
                : `<div class="tree-empty" style="--d:${depth + 1}">Empty. Use + to add a folder or list.</div>`;

            return `
                <div class="node folder ${node.open ? "open" : ""}">
                    <div class="node-row" style="--d:${depth}" tabindex="0" data-act="toggle" data-id="${node.id}">
                        <span class="chev">${ICON.chev}</span>
                        <span class="node-icon">${ICON.folder}</span>
                        <span class="node-name">${name}</span>
                        <span class="node-actions">
                            <button class="icon-btn sm" data-act="add" data-id="${node.id}" title="Add folder or list" aria-label="Add to ${name}">${ICON.plus}</button>
                            <button class="icon-btn sm" data-act="menu" data-id="${node.id}" title="More" aria-label="More for ${name}">${ICON.dots}</button>
                        </span>
                    </div>
                    ${inside}
                </div>
            `;
        }

        const count = kind === "inventory" ? Inventory.countIn(node.id) : Tasks.countIn(node.id);
        const active = node.id === currentListId ? "active" : "";
        return `
            <div class="node">
                <div class="node-row list ${active}" style="--d:${depth}" tabindex="0" data-act="open" data-id="${node.id}">
                    <span class="chev spacer"></span>
                    <span class="node-icon">${ICON.list}</span>
                    <span class="node-name">${name}</span>
                    <span class="count">${count}</span>
                    <span class="node-actions">
                        <button class="icon-btn sm" data-act="menu" data-id="${node.id}" title="More" aria-label="More for ${name}">${ICON.dots}</button>
                    </span>
                </div>
            </div>
        `;
    }).join("");
}

function renderHeader() {
    const list = Tree.get(currentListId);
    const hasList = !!list;

    const title = document.getElementById("panelTitle");
    title.textContent = hasList ? list.name : "Welcome";
    title.classList.toggle("editable-title", hasList);
    if (hasList) {
        title.setAttribute("tabindex", "0");
        title.setAttribute("role", "button");
        title.setAttribute("title", "Click to rename");
    } else {
        title.removeAttribute("tabindex");
        title.removeAttribute("role");
        title.removeAttribute("title");
    }

    const crumbs = document.getElementById("crumbs");
    if (hasList) {
        const space = SPACES.find(s => s.kind === list.kind);
        const parts = [space.label, ...Tree.path(list.id).map(n => n.name)];
        crumbs.innerHTML = parts
            .map((p, i) => `<span class="${i === parts.length - 1 ? "crumb-last" : ""}">${escapeHtml(p)}</span>`)
            .join(`<span class="crumb-sep">/</span>`);
    } else {
        crumbs.innerHTML = `<span class="crumb-last">FlowStock</span>`;
    }

    const addBtn = document.getElementById("addBtn");
    addBtn.hidden = !hasList;
    addBtn.textContent = currentView === "inventory" ? "+ Add item" : "+ Add task";
    document.getElementById("searchInput").hidden = !hasList;

    document.getElementById("stats").hidden = !hasList;
    document.getElementById("panel").hidden = !hasList;
    document.getElementById("emptyState").hidden = hasList;

    document.getElementById("inventoryView").classList.toggle("active", hasList && currentView === "inventory");
    document.getElementById("tasksView").classList.toggle("active", hasList && currentView === "tasks");
}

function renderStats() {
    const el = document.getElementById("stats");
    if (currentListId == null) {
        el.innerHTML = "";
        return;
    }

    if (currentView === "inventory") {
        el.innerHTML = `
            <div class="stat">
                <div class="stat-label">Total items</div>
                <div class="stat-value">${Inventory.countIn(currentListId)}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Stock value</div>
                <div class="stat-value">$${Inventory.totalValue(currentListId).toLocaleString()}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Low / out of stock</div>
                <div class="stat-value">${Inventory.lowCount(currentListId)}</div>
                <div class="stat-sub">needs reordering</div>
            </div>
        `;
    } else {
        el.innerHTML = `
            <div class="stat">
                <div class="stat-label">Open tasks</div>
                <div class="stat-value">${Tasks.openCount(currentListId)}</div>
            </div>
            <div class="stat">
                <div class="stat-label">High priority</div>
                <div class="stat-value">${Tasks.highCount(currentListId)}</div>
                <div class="stat-sub">not done</div>
            </div>
            <div class="stat">
                <div class="stat-label">Completed</div>
                <div class="stat-value">${Tasks.doneCount(currentListId)}</div>
            </div>
        `;
    }
}

function renderList(query) {
    if (currentListId == null) return;
    if (currentView === "inventory") {
        renderInventory(Inventory.search(currentListId, query));
    } else {
        renderTasks(Tasks.search(currentListId, query));
    }
}

// A value you can click to edit
function editable(field, id, html, extraClass = "") {
    return `<span class="editable ${extraClass}" data-edit="${field}" data-id="${id}" tabindex="0" role="button" title="Click to edit">${html}</span>`;
}

function renderInventory(list) {
    const body = document.getElementById("inventoryBody");

    const rows = list.map(item => {
        const st = Inventory.statusOf(item);
        return `
            <tr>
                <td>${editable("name", item.id, escapeHtml(item.name), "strong")}</td>
                <td>${editable("sku", item.id, escapeHtml(item.sku || "—"), item.sku ? "" : "placeholder")}</td>
                <td>${editable("stock", item.id, escapeHtml(item.stock))}</td>
                <td>${editable("price", item.id, "$" + Number(item.price).toLocaleString())}</td>
                <td>${editable("lowAt", item.id, escapeHtml(item.lowAt ?? 10))}</td>
                <td><span class="pill dot ${st.cls}">${st.label}</span></td>
                <td class="row-actions">
                    <button data-action="delete-inv" data-id="${item.id}" title="Delete item" aria-label="Delete item">${ICON.trash}</button>
                </td>
            </tr>
        `;
    }).join("");

    const empty = list.length ? "" : `<tr class="empty-row"><td colspan="7">No inventory items found.</td></tr>`;
    const add = `<tr class="add-row"><td colspan="7"><button class="add-row-btn" data-action="add-row">${ICON.plus} Add item</button></td></tr>`;
    body.innerHTML = rows + empty + add;
}

function renderTasks(list) {
    const body = document.getElementById("tasksBody");

    // Group by status like ClickUp: Open, In progress, Done
    const groupOf = t => (Tasks.STATUSES.includes(t.status) ? t.status : "open");
    const groups = Tasks.STATUSES
        .map(status => ({ status, tasks: list.filter(t => groupOf(t) === status) }))
        .filter(g => g.tasks.length);

    const rows = groups.map(g => {
        const head = `
            <tr class="group-row">
                <td colspan="5">
                    <span class="pill dot ${STATUS_CLS[g.status]}">${g.status}</span>
                    <span class="group-count">${g.tasks.length}</span>
                </td>
            </tr>
        `;
        return head + g.tasks.map(taskRow).join("");
    }).join("");

    const empty = list.length ? "" : `<tr class="empty-row"><td colspan="5">No tasks found.</td></tr>`;
    const add = `<tr class="add-row"><td colspan="5"><button class="add-row-btn" data-action="add-row">${ICON.plus} Add task</button></td></tr>`;
    body.innerHTML = rows + empty + add;
}

function taskRow(task) {
    const done = task.status === "done";
    const due = formatDue(task.due);
    const dueClass = (isOverdue(task) ? "overdue " : "") + (due ? "" : "placeholder");

    return `
        <tr class="${done ? "is-done" : ""}">
            <td class="title-cell">
                <button class="check ${done ? "checked" : ""}" data-action="toggle-done" data-id="${task.id}"
                        title="${done ? "Mark as open" : "Mark as done"}" aria-label="${done ? "Mark as open" : "Mark as done"}">${ICON.check}</button>
                ${editable("title", task.id, escapeHtml(task.title), "strong")}
            </td>
            <td>${editable("priority", task.id, `<span class="pill ${PRIORITY_CLS[task.priority] || "gray"}">${escapeHtml(task.priority)}</span>`)}</td>
            <td>${editable("status", task.id, `<span class="pill dot ${STATUS_CLS[task.status] || "gray"}">${escapeHtml(task.status)}</span>`)}</td>
            <td>${editable("due", task.id, escapeHtml(due || "—"), dueClass)}</td>
            <td class="row-actions">
                <button data-action="advance" data-id="${task.id}" title="Move to the next status">Advance</button>
                <button data-action="delete-task" data-id="${task.id}" title="Delete task" aria-label="Delete task">${ICON.trash}</button>
            </td>
        </tr>
    `;
}

function formatDue(due) {
    if (!due) return "";
    const d = new Date(due + "T00:00:00");
    if (isNaN(d)) return due;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(task) {
    if (!task.due || task.status === "done") return false;
    const d = new Date(task.due + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return !isNaN(d) && d < today;
}

/* ---- Clicks inside the table ---- */
function onPanelClick(e) {
    const field = e.target.closest(".editable");
    if (field) {
        openFieldEditor(field);
        return;
    }

    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);

    switch (btn.dataset.action) {
        case "delete-inv":
            Inventory.remove(id);
            break;
        case "delete-task":
            Tasks.remove(id);
            break;
        case "advance":
            Tasks.advance(id);
            break;
        case "toggle-done":
            Tasks.toggleDone(id);
            break;
        case "add-row":
            addItem(btn);
            return;
    }
    renderAll();
}

// Enter / Space opens the editor when a value has keyboard focus
function onEditableKey(e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("editable")) {
        e.preventDefault();
        openFieldEditor(e.target);
    }
}

function validateField(cfg, raw) {
    const v = String(raw).trim();

    if (cfg.type === "number") {
        if (v === "") return "Enter a number";
        const n = Number(v);
        if (!Number.isFinite(n)) return "Enter a valid number";
        if (cfg.min != null && n < cfg.min) return `Must be ${cfg.min} or more`;
        if (cfg.integer && !Number.isInteger(n)) return "Use a whole number";
        return null;
    }

    if (cfg.required && !v) return "This can't be empty";
    return null;
}

function coerce(cfg, raw) {
    if (cfg.type === "number") return Number(String(raw).trim());
    if (cfg.type === "text") return String(raw).trim();
    return raw;
}

// Open the small edit box right where the value was clicked
function openFieldEditor(target) {
    const id = Number(target.dataset.id);
    const field = target.dataset.edit;
    const inventory = currentView === "inventory";

    const record = (inventory ? Inventory.items : Tasks.tasks).find(r => r.id === id);
    const cfg = FIELDS[currentView][field];
    if (!record || !cfg) return;

    UI.edit({
        anchor: target,
        label: cfg.label,
        type: cfg.type,
        options: cfg.options,
        step: cfg.step,
        min: cfg.min,
        value: record[field] ?? "",
        validate: raw => validateField(cfg, raw),
        onDone: raw => {
            (inventory ? Inventory : Tasks).update(id, field, coerce(cfg, raw));
            renderAll();
        }
    });
}

// "+ Add item" / "+ Add task": type a name, press Add, then click any value to fill in the rest
function addItem(anchor) {
    if (currentListId == null) return;
    const listId = currentListId;
    const inventory = currentView === "inventory";

    UI.edit({
        anchor,
        label: inventory ? "Item name" : "Task name",
        placeholder: inventory ? "e.g. Blue gel pen" : "e.g. Reorder printer paper",
        doneLabel: "Add",
        validate: nameRequired,
        onDone: raw => {
            if (inventory) {
                Inventory.add({ listId, name: raw.trim(), sku: "", stock: 0, price: 0, lowAt: 10 });
            } else {
                Tasks.add({ listId, title: raw.trim(), priority: "medium", status: "open", due: "" });
            }
            renderAll();
        }
    });
}

const nameRequired = raw => (String(raw).trim() ? null : "Name can't be empty");

/* ---- Sidebar actions ---- */
function onSideClick(e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;

    const act = el.dataset.act;
    const id = Number(el.dataset.id);
    const row = el.closest(".node-row") || el;

    switch (act) {
        case "new-folder":
            createNode(el, el.dataset.kind, null, "folder");
            break;
        case "toggle":
            Tree.toggle(id);
            renderSidebar();
            break;
        case "open":
            selectList(id);
            break;
        case "add":
            UI.menu({
                anchor: el,
                items: [
                    { label: "New folder", icon: ICON.folder, onClick: () => createNode(row, Tree.get(id).kind, id, "folder") },
                    { label: "New list", icon: ICON.list, onClick: () => createNode(row, Tree.get(id).kind, id, "list") }
                ]
            });
            break;
        case "menu":
            UI.menu({
                anchor: el,
                items: [
                    { label: "Rename", icon: ICON.pencil, onClick: () => renameNode(row, id) },
                    { label: "Delete", icon: ICON.trash, danger: true, onClick: () => deleteNode(row, id) }
                ]
            });
            break;
    }
}

// Enter / Space on a focused folder or list row
function onRowKey(e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("node-row")) {
        e.preventDefault();
        e.target.click();
    }
}

function createNode(anchor, kind, parentId, type) {
    const what = type === "folder" ? "Folder" : "List";

    UI.edit({
        anchor,
        label: `${what} name`,
        placeholder: type === "folder" ? "e.g. Stationery" : "e.g. Shelf A",
        doneLabel: "Create",
        validate: nameRequired,
        onDone: raw => {
            if (type === "folder") {
                Tree.addFolder(kind, parentId, raw);
                renderAll();
            } else {
                const list = Tree.addList(kind, parentId, raw);
                selectList(list.id);
            }
        }
    });
}

function renameNode(anchor, id) {
    const node = Tree.get(id);
    if (!node) return;

    UI.edit({
        anchor,
        label: `Rename ${node.type}`,
        value: node.name,
        validate: nameRequired,
        onDone: raw => {
            Tree.rename(id, raw);
            renderAll();
        }
    });
}

function deleteNode(anchor, id) {
    const node = Tree.get(id);
    if (!node) return;

    const listIds = Tree.listIdsUnder(id);
    const count = listIds.reduce(
        (sum, lid) => sum + (node.kind === "inventory" ? Inventory.countIn(lid) : Tasks.countIn(lid)),
        0
    );
    const noun = node.kind === "inventory" ? "item" : "task";
    const extra = count ? ` and its ${count} ${noun}${count === 1 ? "" : "s"}` : "";

    UI.confirm({
        anchor,
        message: `Delete "${node.name}"${extra}?`,
        okLabel: "Delete",
        danger: true,
        onOk: () => {
            const removed = Tree.removeNode(id);
            Inventory.removeInLists(removed);
            Tasks.removeInLists(removed);

            // If the open list was inside what we deleted, move to another one
            if (!Tree.get(currentListId)) {
                setCurrent(Tree.firstList(node.kind) || Tree.firstList());
            }
            renderAll();
        }
    });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}
