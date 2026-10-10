/* storage.js — localStorage helpers */

const Storage = {
    _lastId: 0,

    // Unique, always-increasing ids (Date.now() alone can repeat when adding quickly)
    uid() {
        this._lastId = Math.max(Date.now(), this._lastId + 1);
        return this._lastId;
    },

    load(key) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    },

    save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    seed() {
        if (!localStorage.getItem("flowstock_inventory")) {
            this.save("flowstock_inventory", [
                { id: 1, name: "Parker Jotter Ball Pen", sku: "PEN-BLK-001", stock: 12, price: 270, lowAt: 10 },
                { id: 2, name: "A4 Notebook (200 pg)", sku: "NBK-A4-200", stock: 4, price: 150, lowAt: 10 },
                { id: 3, name: "Highlighter Set (6)", sku: "HLP-SET-6", stock: 35, price: 210, lowAt: 15 }
            ]);
        }
        if (!localStorage.getItem("flowstock_tasks")) {
            this.save("flowstock_tasks", [
                { id: 1, title: "Restock A4 notebooks", priority: "high", status: "open", due: "2026-10-12" },
                { id: 2, title: "Count warehouse shelf B", priority: "medium", status: "in progress", due: "2026-10-11" },
                { id: 3, title: "Supplier price review", priority: "low", status: "done", due: "2026-10-09" }
            ]);
        }
        this.migrate();
    },

    // Folders/lists were added later. On first run (or for data saved by the
    // old version) create one starter folder + list per space and move any
    // existing items/tasks into it, so nothing is lost.
    migrate() {
        let tree = this.load("flowstock_tree");

        if (!tree.length) {
            const invFolder = { id: this.uid(), kind: "inventory", type: "folder", name: "Main Warehouse", parentId: null, open: true };
            const invList = { id: this.uid(), kind: "inventory", type: "list", name: "All Items", parentId: invFolder.id, open: true };
            const taskFolder = { id: this.uid(), kind: "tasks", type: "folder", name: "Operations", parentId: null, open: true };
            const taskList = { id: this.uid(), kind: "tasks", type: "list", name: "To-do", parentId: taskFolder.id, open: true };
            tree = [invFolder, invList, taskFolder, taskList];
            this.save("flowstock_tree", tree);
        }

        ["inventory", "tasks"].forEach(kind => {
            const firstList = tree.find(n => n.kind === kind && n.type === "list");
            if (!firstList) return;

            const key = "flowstock_" + kind;
            const rows = this.load(key);
            let changed = false;
            rows.forEach(row => {
                if (row.listId == null) {
                    row.listId = firstList.id;
                    changed = true;
                }
            });
            if (changed) this.save(key, rows);
        });
    }
};
