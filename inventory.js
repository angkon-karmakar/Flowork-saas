/* inventory.js — inventory logic */

const Inventory = {
    items: [],

    load() {
        this.items = Storage.load("flowstock_inventory");
    },

    save() {
        Storage.save("flowstock_inventory", this.items);
    },

    // Items that belong to one list
    inList(listId) {
        return this.items.filter(i => i.listId === listId);
    },

    countIn(listId) {
        return this.inList(listId).length;
    },

    add(item) {
        item.id = Storage.uid();
        item.lowAt = item.lowAt ?? 10;
        this.items.unshift(item);
        this.save();
    },

    // Change one field (name, sku, stock, price or lowAt) of one item
    update(id, field, value) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;
        item[field] = value;
        this.save();
    },

    remove(id) {
        this.items = this.items.filter(i => i.id !== id);
        this.save();
    },

    // Used when a folder or list is deleted from the sidebar
    removeInLists(listIds) {
        this.items = this.items.filter(i => !listIds.includes(i.listId));
        this.save();
    },

    statusOf(item) {
        const stock = Number(item.stock);
        if (stock === 0) return { label: "Out of stock", cls: "bad" };
        if (stock <= Number(item.lowAt)) return { label: "Low stock", cls: "warn" };
        return { label: "In stock", cls: "ok" };
    },

    totalValue(listId) {
        return this.inList(listId).reduce((sum, i) => sum + Number(i.stock) * Number(i.price), 0);
    },

    lowCount(listId) {
        return this.inList(listId).filter(i => Number(i.stock) <= Number(i.lowAt)).length;
    },

    search(listId, query) {
        const items = this.inList(listId);
        if (!query) return items;
        const q = query.toLowerCase();
        return items.filter(i =>
            String(i.name || "").toLowerCase().includes(q) ||
            String(i.sku || "").toLowerCase().includes(q)
        );
    }
};
