/* app.js — dashboard controller */

let currentView = "inventory";

document.addEventListener("DOMContentLoaded", () => {
    Storage.seed();
    Inventory.load();
    Tasks.load();
    applySavedTheme();
    applySavedView();
    bindEvents();
    render();
});

function bindEvents() {
    // View toggle
    document.querySelectorAll(".toggle-btn").forEach(btn => {
        btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    // Search
    document.getElementById("searchInput").addEventListener("input", e => {
        renderList(e.target.value);
    });

    // New button
    document.getElementById("addBtn").addEventListener("click", addItem);

    // Theme toggle
    document.getElementById("themeBtn").addEventListener("click", toggleTheme);
}

/* ---- Night / light mode ---- */
function applySavedTheme() {
    // The head script already set the class before first paint;
    // here we just sync the button icon with the current state.
    const night = document.documentElement.classList.contains("night");
    document.getElementById("themeBtn").textContent = night ? "☀️" : "🌙";
}

/* ---- Remember which view (inventory / tasks) was open ---- */
function applySavedView() {
    const saved = localStorage.getItem("flowstock_view");
    if (saved === "tasks" || saved === "inventory") {
        currentView = saved;
        document.querySelectorAll(".toggle-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.view === saved);
        });
        document.getElementById("inventoryView").classList.toggle("active", saved === "inventory");
        document.getElementById("tasksView").classList.toggle("active", saved === "tasks");
        document.getElementById("panelTitle").textContent = saved === "inventory" ? "Inventory" : "Tasks";
    }
}

function toggleTheme() {
    const isNight = document.documentElement.classList.toggle("night");
    localStorage.setItem("flowstock_theme", isNight ? "night" : "light");
    document.getElementById("themeBtn").textContent = isNight ? "☀️" : "🌙";
}

function switchView(view) {
    currentView = view;
    localStorage.setItem("flowstock_view", view);

    document.querySelectorAll(".toggle-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.view === view);
    });

    document.getElementById("inventoryView").classList.toggle("active", view === "inventory");
    document.getElementById("tasksView").classList.toggle("active", view === "tasks");

    document.getElementById("panelTitle").textContent = view === "inventory" ? "Inventory" : "Tasks";
    document.getElementById("searchInput").value = "";

    render();
}

function render() {
    renderStats();
    renderList("");
}

function renderStats() {
    const el = document.getElementById("stats");

    if (currentView === "inventory") {
        el.innerHTML = `
            <div class="stat">
                <div class="stat-label">Total items</div>
                <div class="stat-value">${Inventory.items.length}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Stock value</div>
                <div class="stat-value">$${Inventory.totalValue().toLocaleString()}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Low / out of stock</div>
                <div class="stat-value">${Inventory.lowCount()}</div>
                <div class="stat-sub">needs reordering</div>
            </div>
        `;
    } else {
        el.innerHTML = `
            <div class="stat">
                <div class="stat-label">Open tasks</div>
                <div class="stat-value">${Tasks.openCount()}</div>
            </div>
            <div class="stat">
                <div class="stat-label">High priority</div>
                <div class="stat-value">${Tasks.highCount()}</div>
                <div class="stat-sub">not done</div>
            </div>
            <div class="stat">
                <div class="stat-label">Completed</div>
                <div class="stat-value">${Tasks.tasks.filter(t => t.status === "done").length}</div>
            </div>
        `;
    }
}

function renderList(query) {
    if (currentView === "inventory") {
        renderInventory(Inventory.search(query));
    } else {
        renderTasks(Tasks.search(query));
    }
}

function renderInventory(list) {
    const body = document.getElementById("inventoryBody");

    if (!list.length) {
        body.innerHTML = `<tr class="empty-row"><td colspan="6">No inventory items found.</td></tr>`;
        return;
    }

    body.innerHTML = list.map(item => {
        const st = Inventory.statusOf(item);
        return `
            <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.sku || "—")}</td>
                <td>${item.stock}</td>
                <td>$${Number(item.price).toLocaleString()}</td>
                <td><span class="pill ${st.cls}">${st.label}</span></td>
                <td class="row-actions">
                    <button data-action="delete-inv" data-id="${item.id}">Delete</button>
                </td>
            </tr>
        `;
    }).join("");

    body.querySelectorAll('[data-action="delete-inv"]').forEach(btn => {
        btn.addEventListener("click", () => {
            Inventory.remove(Number(btn.dataset.id));
            render();
        });
    });
}

function renderTasks(list) {
    const body = document.getElementById("tasksBody");

    if (!list.length) {
        body.innerHTML = `<tr class="empty-row"><td colspan="5">No tasks found.</td></tr>`;
        return;
    }

    const priorityPill = p => {
        const map = { high: "bad", medium: "warn", low: "gray" };
        return `<span class="pill ${map[p] || "gray"}">${p}</span>`;
    };

    const statusPill = s => {
        const map = { open: "info", "in progress": "warn", done: "ok" };
        return `<span class="pill ${map[s] || "gray"}">${s}</span>`;
    };

    body.innerHTML = list.map(task => `
        <tr>
            <td>${escapeHtml(task.title)}</td>
            <td>${priorityPill(task.priority)}</td>
            <td>${statusPill(task.status)}</td>
            <td>${escapeHtml(task.due || "—")}</td>
            <td class="row-actions">
                <button data-action="advance" data-id="${task.id}">Advance</button>
                <button data-action="delete-task" data-id="${task.id}">Delete</button>
            </td>
        </tr>
    `).join("");

    body.querySelectorAll('[data-action="advance"]').forEach(btn => {
        btn.addEventListener("click", () => {
            Tasks.advance(Number(btn.dataset.id));
            render();
        });
    });

    body.querySelectorAll('[data-action="delete-task"]').forEach(btn => {
        btn.addEventListener("click", () => {
            Tasks.remove(Number(btn.dataset.id));
            render();
        });
    });
}

function addItem() {
    if (currentView === "inventory") {
        const name = prompt("Item name:");
        if (!name) return;
        Inventory.add({
            name,
            sku: prompt("SKU:", "SKU-000"),
            stock: Number(prompt("Stock quantity:", "0")) || 0,
            price: Number(prompt("Price:", "0")) || 0,
            lowAt: Number(prompt("Low-stock threshold:", "10")) || 10
        });
    } else {
        const title = prompt("Task title:");
        if (!title) return;
        Tasks.add({
            title,
            priority: prompt("Priority (high / medium / low):", "medium"),
            due: prompt("Due date (YYYY-MM-DD):", "")
        });
    }
    render();
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}
