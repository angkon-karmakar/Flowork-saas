/* tasks.js — task logic */

const Tasks = {
    tasks: [],

    load() {
        this.tasks = Storage.load("flowstock_tasks");
    },

    save() {
        Storage.save("flowstock_tasks", this.tasks);
    },

    add(task) {
        task.id = Date.now();
        task.status = task.status || "open";
        task.priority = task.priority || "medium";
        this.tasks.unshift(task);
        this.save();
    },

    remove(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.save();
    },

    // ClickUp-style limited status flow: open -> in progress -> done
    advance(id) {
        const t = this.tasks.find(t => t.id === id);
        if (!t) return;
        const flow = ["open", "in progress", "done"];
        const next = flow.indexOf(t.status) + 1;
        if (next < flow.length) t.status = flow[next];
        this.save();
    },

    openCount() {
        return this.tasks.filter(t => t.status !== "done").length;
    },

    highCount() {
        return this.tasks.filter(t => t.priority === "high" && t.status !== "done").length;
    },

    search(query) {
        if (!query) return this.tasks;
        const q = query.toLowerCase();
        return this.tasks.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.status.toLowerCase().includes(q)
        );
    }
};
