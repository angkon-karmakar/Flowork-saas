/* tasks.js — task logic */

const Tasks = {
    tasks: [],

    // ClickUp-style limited status flow: open -> in progress -> done
    STATUSES: ["open", "in progress", "done"],
    PRIORITIES: ["high", "medium", "low"],

    load() {
        this.tasks = Storage.load("flowstock_tasks");
    },

    save() {
        Storage.save("flowstock_tasks", this.tasks);
    },

    // Tasks that belong to one list
    inList(listId) {
        return this.tasks.filter(t => t.listId === listId);
    },

    countIn(listId) {
        return this.inList(listId).length;
    },

    add(task) {
        task.id = Storage.uid();
        task.status = task.status || "open";
        task.priority = task.priority || "medium";
        this.tasks.unshift(task);
        this.save();
    },

    // Change one field (title, priority, status or due) of one task
    update(id, field, value) {
        const t = this.tasks.find(t => t.id === id);
        if (!t) return;
        t[field] = value;
        this.save();
    },

    remove(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.save();
    },

    // Used when a folder or list is deleted from the sidebar
    removeInLists(listIds) {
        this.tasks = this.tasks.filter(t => !listIds.includes(t.listId));
        this.save();
    },

    advance(id) {
        const t = this.tasks.find(t => t.id === id);
        if (!t) return;
        const next = this.STATUSES.indexOf(t.status) + 1;
        if (next < this.STATUSES.length) t.status = this.STATUSES[next];
        this.save();
    },

    // The round checkbox: done <-> open
    toggleDone(id) {
        const t = this.tasks.find(t => t.id === id);
        if (!t) return;
        t.status = t.status === "done" ? "open" : "done";
        this.save();
    },

    openCount(listId) {
        return this.inList(listId).filter(t => t.status !== "done").length;
    },

    highCount(listId) {
        return this.inList(listId).filter(t => t.priority === "high" && t.status !== "done").length;
    },

    doneCount(listId) {
        return this.inList(listId).filter(t => t.status === "done").length;
    },

    search(listId, query) {
        const tasks = this.inList(listId);
        if (!query) return tasks;
        const q = query.toLowerCase();
        return tasks.filter(t =>
            String(t.title || "").toLowerCase().includes(q) ||
            String(t.status || "").toLowerCase().includes(q)
        );
    }
};
