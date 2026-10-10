/* files.js — file adding / deleting (stored in localStorage) */

const Files = {
    files: [],

    load() {
        this.files = Storage.load("flowstock_files");
    },

    save() {
        Storage.save("flowstock_files", this.files);
    },

    // Max size localStorage can reliably hold per entry (~2 MB to stay safe)
    MAX_BYTES: 2 * 1024 * 1024,

    add(file) {
        const meta = {
            id: Date.now() + "-" + Math.floor(Math.random() * 1e6),
            name: file.name || "untitled",
            type: file.type || this.guessType(file.name),
            size: file.size,
            added: new Date().toISOString(),
            data: null
        };

        if (file.size > this.MAX_BYTES) {
            throw new Error(`"${file.name}" is ${this.formatSize(file.size)} — the limit is ${this.formatSize(this.MAX_BYTES)}.`);
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                meta.data = reader.result;
                try {
                    this.files.unshift(meta);
                    this.save();
                    resolve(meta);
                } catch (e) {
                    reject(new Error("Could not store \"" + file.name + "\" — storage is full."));
                }
            };
            reader.onerror = () => reject(new Error("Could not read \"" + file.name + "\"."));
            reader.readAsDataURL(file);
        });
    },

    remove(id) {
        this.files = this.files.filter(f => f.id !== id);
        this.save();
    },

    removeMany(ids) {
        this.files = this.files.filter(f => !ids.includes(f.id));
        this.save();
    },

    totalSize() {
        return this.files.reduce((sum, f) => sum + Number(f.size || 0), 0);
    },

    count() {
        return this.files.length;
    },

    search(query) {
        if (!query) return this.files;
        const q = query.toLowerCase();
        return this.files.filter(f =>
            f.name.toLowerCase().includes(q) ||
            (f.type || "").toLowerCase().includes(q)
        );
    },

    guessType(name) {
        const ext = (name.split(".").pop() || "").toLowerCase();
        const map = {
            pdf: "application/pdf",
            txt: "text/plain",
            md: "text/markdown",
            json: "application/json",
            csv: "text/csv",
            jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
            gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
            zip: "application/zip", doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        };
        return map[ext] || ext || "file";
    },

    // Short human label for a mime type / extension
    kindOf(file) {
        const t = (file.type || "").toLowerCase();
        if (t.startsWith("image/")) return "Image";
        if (t.startsWith("video/")) return "Video";
        if (t.startsWith("audio/")) return "Audio";
        if (t.startsWith("text/")) return "Text";
        if (t.includes("pdf")) return "PDF";
        if (t.includes("zip") || t.includes("compressed")) return "Archive";
        if (t.includes("word")) return "Document";
        if (t.includes("sheet") || t.includes("excel")) return "Spreadsheet";
        if (t.includes("json")) return "JSON";
        const ext = (file.name.split(".").pop() || "").toUpperCase();
        return ext || "File";
    },

    iconFor(file) {
        const kind = this.kindOf(file).toLowerCase();
        if (kind === "image") return "🖼️";
        if (kind === "video") return "🎬";
        if (kind === "audio") return "🎵";
        if (kind === "pdf") return "📕";
        if (kind === "text" || kind === "json") return "📄";
        if (kind === "archive") return "🗜️";
        if (kind === "document") return "📘";
        if (kind === "spreadsheet") return "📊";
        return "📁";
    },

    formatSize(bytes) {
        const n = Number(bytes || 0);
        if (n < 1024) return n + " B";
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
        return (n / (1024 * 1024)).toFixed(2) + " MB";
    },

    formatDate(iso) {
        const d = new Date(iso);
        if (isNaN(d)) return "—";
        return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }
};
