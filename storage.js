/* storage.js — localStorage helpers */

const Storage = {
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
    }
};
