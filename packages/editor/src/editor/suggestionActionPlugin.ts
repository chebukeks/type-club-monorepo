import { Plugin, PluginKey } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Mark, Node as PMNode } from "prosemirror-model";

export const suggestionActionPluginKey = new PluginKey("suggestionAction");

export interface SuggestionActionPluginOptions {
  userRole?: "author" | "co_author" | "editor" | null;
}

class SuggestionActionView {
  popup: HTMLElement;
  infoLabel: HTMLElement;
  acceptBtn: HTMLButtonElement;
  rejectBtn: HTMLButtonElement;
  view: EditorView;
  userRole?: "author" | "co_author" | "editor" | null;
  currentTarget: {
    type: "mark" | "block";
    mark?: Mark;
    from: number;
    to: number;
    node?: PMNode;
  } | null = null;

  constructor(view: EditorView, userRole?: "author" | "co_author" | "editor" | null) {
    this.view = view;
    this.userRole = userRole;

    this.popup = document.createElement("div");
    this.popup.className = "suggestion-action-popup";
    this.popup.style.display = "none";
    this.popup.style.position = "fixed";
    this.popup.style.zIndex = "99999";

    this.infoLabel = document.createElement("span");
    this.infoLabel.className = "suggestion-action-info";

    const checkIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    const xIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    this.acceptBtn = document.createElement("button");
    this.acceptBtn.className = "suggestion-action-btn accept";
    this.acceptBtn.title = "Принять предложение (Accept)";
    this.acceptBtn.innerHTML = `${checkIcon} <span>Принять</span>`;
    this.acceptBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    this.acceptBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleAccept();
    };

    this.rejectBtn = document.createElement("button");
    this.rejectBtn.className = "suggestion-action-btn reject";
    this.rejectBtn.title = "Отклонить предложение (Reject)";
    this.rejectBtn.innerHTML = `${xIcon} <span>Отклонить</span>`;
    this.rejectBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    this.rejectBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleReject();
    };

    this.popup.appendChild(this.infoLabel);
    this.popup.appendChild(this.acceptBtn);
    this.popup.appendChild(this.rejectBtn);

    document.body.appendChild(this.popup);

    // Click handler on editor to ensure clicking on suggestion activates it
    this.handleClick = this.handleClick.bind(this);
    view.dom.addEventListener("click", this.handleClick);
  }

  handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (target.closest(".suggestion-insert") || target.closest(".suggestion-delete") || target.closest("[data-sug-delete]")) {
      setTimeout(() => this.update(this.view), 10);
    }
  }

  update(view: EditorView) {
    this.view = view;
    if (!document.body.contains(this.popup)) {
      document.body.appendChild(this.popup);
    }

    // Only authors and co-authors can accept or reject suggestions
    const canAcceptOrReject = this.userRole !== "editor";
    if (canAcceptOrReject) {
      this.acceptBtn.style.display = "inline-flex";
      this.rejectBtn.style.display = "inline-flex";
    } else {
      this.acceptBtn.style.display = "none";
      this.rejectBtn.style.display = "none";
    }

    const { state } = view;
    const { selection } = state;
    const { $from } = selection;

    // 1. Check if cursor/selection is inside or adjacent to suggestion_insert or suggestion_delete mark
    let targetMark: Mark | null = null;
    let markType: "suggestion_insert" | "suggestion_delete" | null = null;

    const candidateMarks = [
      ...$from.marks(),
      ...($from.nodeAfter?.marks || []),
      ...($from.nodeBefore?.marks || []),
    ];

    for (const m of candidateMarks) {
      if (m.type.name === "suggestion_insert" || m.type.name === "suggestion_delete") {
        targetMark = m;
        markType = m.type.name as any;
        break;
      }
    }

    if (targetMark && markType) {
      // Find full boundaries of this specific suggestion mark
      let from = $from.pos;
      let to = $from.pos;
      const odId = targetMark.attrs.odId;

      state.doc.nodesBetween(
        Math.max(0, $from.pos - 500),
        Math.min(state.doc.content.size, $from.pos + 500),
        (node, pos) => {
          if (node.isText) {
            const hasMark = node.marks.some(
              (m) => m.type.name === markType && (odId ? m.attrs.odId === odId : true)
            );
            if (hasMark) {
              if (pos < from) from = pos;
              if (pos + node.nodeSize > to) to = pos + node.nodeSize;
            }
          }
        }
      );

      this.currentTarget = { type: "mark", mark: targetMark, from, to };
      const author = targetMark.attrs.sugAuthorName || "Советчик";
      const actionText = markType === "suggestion_insert" ? "Вставка" : "Удаление";
      this.infoLabel.textContent = `${author}: ${actionText}`;

      this.showPopupAt(from);
      return;
    }

    // 2. Check if cursor is on a block node with sugDelete attribute (e.g. image)
    const node = state.doc.nodeAt($from.pos);
    if (node && node.attrs.sugDelete) {
      this.currentTarget = {
        type: "block",
        node,
        from: $from.pos,
        to: $from.pos + node.nodeSize,
      };
      this.infoLabel.textContent = "Удаление блока";
      this.showPopupAt($from.pos);
      return;
    }

    this.hidePopup();
  }

  showPopupAt(pos: number) {
    try {
      const coords = this.view.coordsAtPos(pos);
      this.popup.style.display = "flex";

      const popupWidth = this.popup.offsetWidth || 180;
      const popupHeight = this.popup.offsetHeight || 34;

      let left = coords.left;
      let top = coords.top - popupHeight - 8;

      if (top < 10) {
        top = coords.bottom + 8;
      }
      if (left + popupWidth > window.innerWidth - 12) {
        left = window.innerWidth - popupWidth - 12;
      }
      if (left < 12) left = 12;

      this.popup.style.left = `${left}px`;
      this.popup.style.top = `${top}px`;
    } catch {
      this.hidePopup();
    }
  }

  hidePopup() {
    this.popup.style.display = "none";
    this.currentTarget = null;
  }

  handleAccept() {
    if (!this.currentTarget || this.userRole === "editor") return;
    const { type, mark, from, to } = this.currentTarget;
    const tr = this.view.state.tr;
    tr.setMeta("suggestionAction", true);

    if (type === "mark" && mark) {
      if (mark.type.name === "suggestion_insert") {
        // Accept insertion: remove suggestion_insert mark, text remains as normal document text
        tr.removeMark(from, to, mark.type);
      } else if (mark.type.name === "suggestion_delete") {
        // Accept deletion: delete text range from document
        tr.delete(from, to);
      }
    } else if (type === "block") {
      // Accept block deletion: delete block node
      tr.delete(from, to);
    }

    this.view.dispatch(tr);
    this.hidePopup();
  }

  handleReject() {
    if (!this.currentTarget || this.userRole === "editor") return;
    const { type, mark, from, to, node } = this.currentTarget;
    const tr = this.view.state.tr;
    tr.setMeta("suggestionAction", true);

    if (type === "mark" && mark) {
      if (mark.type.name === "suggestion_insert") {
        // Reject insertion: delete inserted text range from document
        tr.delete(from, to);
      } else if (mark.type.name === "suggestion_delete") {
        // Reject deletion: remove suggestion_delete mark, original text stays intact
        tr.removeMark(from, to, mark.type);
      }
    } else if (type === "block" && node) {
      // Reject block deletion: clear sugDelete attribute
      tr.setNodeMarkup(from, undefined, { ...node.attrs, sugDelete: null });
    }

    this.view.dispatch(tr);
    this.hidePopup();
  }

  destroy() {
    this.view.dom.removeEventListener("click", this.handleClick);
    if (this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
    }
  }
}

export function createSuggestionActionPlugin(options?: SuggestionActionPluginOptions): Plugin {
  return new Plugin({
    key: suggestionActionPluginKey,
    view(editorView) {
      return new SuggestionActionView(editorView, options?.userRole);
    },
  });
}
