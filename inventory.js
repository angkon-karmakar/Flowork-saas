/* inventory.js — inventory logic */

const Inventory = {
    items: [],

    load() {
        this.items = Storage.load("flowstock_inventory");
    },

    save() {
        Storage.save("flowstock_inventory", this.items);
    },

    add(item) {
        item.id = Date.now();
        item.lowAt = item.lowAt || 10;
        this.items.unshift(item);
        this.save();
    },

    remove(id) {
        this.items = this.items.filter(i => i.id !== id);
        this.save();
    },

    statusOf(item) {
        if (item.stock === 0) return { label: "Out of stock", cls: "bad" };
        if (item.stock <= item.lowAt) return { label: "Low stock", cls: "warn" };
        return { label: "In stock", cls: "ok" };
    },

    totalValue() {
        return this.items.reduce((sum, i) => sum + Number(i.stock) * Number(i.price), 0);
    },

    lowCount() {
        return this.items.filter(i => i.stock <= i.lowAt).length;
    },

    search(query) {
        if (!query) return this.items;
        const q = query.toLowerCase();
        return this.items.filter(i =>
            i.name.toLowerCase().includes(q) ||
            (i.sku || "").toLowerCase().includes(q)
        );
    }
};
