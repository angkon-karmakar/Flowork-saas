/* tree.js — sidebar folders and lists
 *
 * Every node is { id, kind, type, name, parentId, open }
 *   kind: "inventory" | "tasks"   (which section of the sidebar it lives in)
 *   type: "folder" | "list"       (folders hold folders and lists; lists hold items/tasks)
 */

const Tree = {
    nodes: [],

    load() {
        this.nodes = Storage.load("flowstock_tree");
    },

    save() {
        Storage.save("flowstock_tree", this.nodes);
    },

    get(id) {
        return this.nodes.find(n => n.id === id);
    },

    // Folders first, then lists; otherwise in the order they were created
    children(kind, parentId) {
        return this.nodes
            .filter(n => n.kind === kind && n.parentId === parentId)
            .sort((a, b) => (a.type === b.type ? 0 : a.type === "folder" ? -1 : 1));
    },

    addFolder(kind, parentId, name) {
        return this._add(kind, parentId, "folder", name);
    },

    addList(kind, parentId, name) {
        return this._add(kind, parentId, "list", name);
    },

    _add(kind, parentId, type, name) {
        const node = {
            id: Storage.uid(),
            kind,
            type,
            name: String(name).trim(),
            parentId: parentId == null ? null : parentId,
            open: true
        };
        this.nodes.push(node);

        const parent = parentId == null ? null : this.get(parentId);
        if (parent) parent.open = true;

        this.save();
        return node;
    },

    rename(id, name) {
        const node = this.get(id);
        if (!node) return;
        node.name = String(name).trim();
        this.save();
    },

    toggle(id) {
        const node = this.get(id);
        if (!node) return;
        node.open = !node.open;
        this.save();
    },

    // Make sure every folder above a node is expanded so the node is visible
    openPath(id) {
        this.path(id).forEach(n => { if (n.type === "folder") n.open = true; });
        this.save();
    },

    // Nodes from the top-level folder down to this node
    path(id) {
        const out = [];
        let node = this.get(id);
        while (node) {
            out.unshift(node);
            node = node.parentId == null ? null : this.get(node.parentId);
        }
        return out;
    },

    // Ids of every list at or below a node
    listIdsUnder(id) {
        const node = this.get(id);
        if (!node) return [];
        if (node.type === "list") return [node.id];
        return this.nodes
            .filter(n => n.parentId === id)
            .flatMap(n => this.listIdsUnder(n.id));
    },

    // Remove a node and everything inside it. Returns the ids of the lists removed
    // so the caller can delete the items/tasks that lived in them.
    removeNode(id) {
        const listIds = this.listIdsUnder(id);
        const doomed = new Set();
        const collect = nodeId => {
            doomed.add(nodeId);
            this.nodes.filter(n => n.parentId === nodeId).forEach(n => collect(n.id));
        };
        collect(id);
        this.nodes = this.nodes.filter(n => !doomed.has(n.id));
        this.save();
        return listIds;
    },

    // First list in sidebar order (depth-first), optionally limited to one kind
    firstList(kind) {
        const walk = (k, parentId) => {
            for (const n of this.children(k, parentId)) {
                if (n.type === "list") return n;
                const found = walk(k, n.id);
                if (found) return found;
            }
            return null;
        };
        if (kind) return walk(kind, null);
        return walk("inventory", null) || walk("tasks", null);
    }
};
