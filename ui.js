/* ui.js — small floating boxes: inline editor, confirm box and menu.
 *
 * These replace the browser's own prompt() / confirm() / alert() windows.
 * A box opens right next to whatever you clicked and closes when you
 * press Done / Cancel, hit Esc, or click anywhere else.
 */

const UI = (() => {
    let current = null;

    const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

    // Tiny element builder. Text always goes in through textContent, never innerHTML.
    function el(tag, attrs = {}, ...kids) {
        const node = document.createElement(tag);
        for (const [key, val] of Object.entries(attrs)) {
            if (val === false || val == null) continue;
            if (key === "text") node.textContent = val;
            else node.setAttribute(key, val === true ? "" : val);
        }
        kids.forEach(kid => { if (kid) node.append(kid); });
        return node;
    }

    // Put the box just under the clicked element (or above it if there's no room)
    function place(pop, anchor) {
        if (!document.contains(anchor)) return;
        const gap = 6;
        const margin = 8;
        const r = anchor.getBoundingClientRect();
        const w = pop.offsetWidth;
        const h = pop.offsetHeight;

        const left = Math.min(Math.max(margin, r.left), window.innerWidth - w - margin);
        let top = r.bottom + gap;
        if (top + h > window.innerHeight - margin && r.top - h - gap > margin) {
            top = r.top - h - gap;
        }
        pop.style.left = Math.max(margin, left) + "px";
        pop.style.top = Math.max(margin, top) + "px";
    }

    function close(reason) {
        if (!current) return;
        const c = current;
        current = null;
        c.teardown();
        c.pop.remove();

        // "done" and "menu" are normal exits; everything else counts as cancelling
        if (reason !== "done" && reason !== "menu" && c.onCancel) c.onCancel();

        // Esc / Cancel hands keyboard focus back to what was clicked
        if ((reason === "escape" || reason === "cancel") && document.contains(c.anchor) && c.anchor.focus) {
            c.anchor.focus();
        }
    }

    function open(anchor, cls, label, build, onCancel) {
        close("replaced");

        const pop = el("div", { class: "pop " + cls, role: "dialog", "aria-label": label });
        document.body.append(pop);
        const focus = build(pop);
        place(pop, anchor);

        const onOutside = e => { if (!pop.contains(e.target)) close("outside"); };
        const onKey = e => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close("escape");
            }
        };
        const onMove = () => place(pop, anchor);

        document.addEventListener("pointerdown", onOutside, true);
        document.addEventListener("keydown", onKey, true);
        window.addEventListener("resize", onMove);
        window.addEventListener("scroll", onMove, true);

        current = {
            pop,
            anchor,
            onCancel,
            teardown() {
                document.removeEventListener("pointerdown", onOutside, true);
                document.removeEventListener("keydown", onKey, true);
                window.removeEventListener("resize", onMove);
                window.removeEventListener("scroll", onMove, true);
            }
        };

        if (focus) focus();
    }

    /* Inline editor: a box with the current value selected, plus Done and Cancel.
     *   anchor      the element that was clicked
     *   label       small heading inside the box
     *   value       current value (shown selected, so typing replaces it)
     *   type        "text" | "number" | "date"
     *   options     array of strings -> shows a dropdown instead of an input
     *   validate    fn(raw) -> error text, or null when the value is fine
     *   onDone      fn(raw) called when Done is pressed with a valid value
     *   onCancel    fn() called when the edit is abandoned
     */
    function edit(opts) {
        const {
            anchor, label, value = "", type = "text", options = null,
            step, min, placeholder, doneLabel = "Done", validate, onDone, onCancel
        } = opts;

        open(anchor, "pop-edit", label, pop => {
            const input = options
                ? el("select", { class: "pop-input", "aria-label": label },
                    ...options.map(o => el("option", { value: o, text: cap(o) })))
                : el("input", { class: "pop-input", type, step, min, placeholder, autocomplete: "off", "aria-label": label });
            input.value = value ?? "";

            const error = el("div", { class: "pop-error", role: "alert", hidden: true });
            const cancelBtn = el("button", { type: "button", class: "btn ghost", text: "Cancel" });
            const doneBtn = el("button", { type: "submit", class: "btn primary", text: doneLabel });

            const form = el("form", { class: "pop-form", novalidate: true },
                el("div", { class: "pop-label", text: label }),
                input,
                error,
                el("div", { class: "pop-actions" }, cancelBtn, doneBtn));
            pop.append(form);

            cancelBtn.addEventListener("click", () => close("cancel"));

            input.addEventListener("input", () => {
                error.hidden = true;
                input.classList.remove("invalid");
            });

            form.addEventListener("submit", e => {
                e.preventDefault();
                const err = validate ? validate(input.value) : null;
                if (err) {
                    error.textContent = err;
                    error.hidden = false;
                    input.classList.add("invalid");
                    input.focus();
                    place(pop, anchor);
                    return;
                }
                const raw = input.value;
                close("done");
                onDone(raw);
            });

            return () => {
                input.focus();
                if (!options && typeof input.select === "function") input.select();
            };
        }, onCancel);
    }

    /* Confirm box (used before deleting a folder or list) */
    function confirmBox(opts) {
        const { anchor, message, okLabel = "Confirm", danger = false, onOk } = opts;

        open(anchor, "pop-confirm", message, pop => {
            const cancelBtn = el("button", { type: "button", class: "btn ghost", text: "Cancel" });
            const okBtn = el("button", { type: "button", class: "btn " + (danger ? "danger" : "primary"), text: okLabel });

            cancelBtn.addEventListener("click", () => close("cancel"));
            okBtn.addEventListener("click", () => {
                close("done");
                onOk();
            });

            pop.append(
                el("div", { class: "pop-message", text: message }),
                el("div", { class: "pop-actions" }, cancelBtn, okBtn)
            );
            return () => cancelBtn.focus();
        });
    }

    /* Small action menu: items = [{ label, icon (trusted svg string), danger, onClick }] */
    function menu(opts) {
        const { anchor, items } = opts;

        open(anchor, "pop-menu", "Menu", pop => {
            const buttons = items.map(item => {
                const b = el("button", { type: "button", class: "pop-item" + (item.danger ? " danger" : ""), role: "menuitem" });
                if (item.icon) b.insertAdjacentHTML("beforeend", item.icon);
                b.append(el("span", { text: item.label }));
                b.addEventListener("click", () => {
                    close("menu");
                    item.onClick();
                });
                return b;
            });
            pop.append(...buttons);

            pop.addEventListener("keydown", e => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                e.preventDefault();
                const i = buttons.indexOf(document.activeElement);
                const n = buttons.length;
                const next = e.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n;
                buttons[next].focus();
            });

            return () => buttons[0].focus();
        });
    }

    return { edit, confirm: confirmBox, menu, close };
})();
