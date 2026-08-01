import { Plugin, PluginKey } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Mark, Node as PMNode } from "prosemirror-model";

export const suggestionActionPluginKey = new PluginKey("suggestionAction");

class SuggestionActionView {
  popup: HTMLElement;
  view: EditorView;
  currentTarget: {
    type: "mark" | "block" | "note";
    mark?: Mark;
    from: number;
    to: number;
    node?: PMNode;
  } | null = null;

  constructor(view: EditorView) {
    this.view = view;
    this.popup = document.createElement("div");
    this.popup.className = "suggestion-action-popup";
    this.popup.style.display = "none";

    const acceptBtn = document.createElement("button");
    acceptBtn.className = "suggestion-action-btn accept";
    acceptBtn.title = "Принять предложение (Accept)";
    acceptBtn.innerHTML = "✓";
    acceptBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleAccept();
    };

    const rejectBtn = document.createElement("button");
    rejectBtn.className = "suggestion-action-btn reject";
    rejectBtn.title = "Отклонить предложение (Reject)";
    rejectBtn.innerHTML = "✗";
    rejectBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleReject();
    };

    this.popup.appendChild(acceptBtn);
    this.popup.appendChild(rejectBtn);

    if (view.dom.parentNode) {
      view.dom.parentNode.appendChild(this.popup);
    }
  }

  update(view: EditorView) {
    this.view = view;
    const { state } = view;
    const { selection } = state;
    const { $from } = selection;

    // 1. Check if cursor/selection is inside suggestion_insert or suggestion_delete mark
    let targetMark: Mark | null = null;
    let markType: "suggestion_insert" | "suggestion_delete" | null = null;

    $from.marks().forEach((m) => {
      if (m.type.name === "suggestion_insert" || m.type.name === "suggestion_delete") {
        targetMark = m;
        markType = m.type.name as any;
      }
    });

    if (targetMark && markType) {
      // Find mark boundaries
      let from = $from.pos;
      let to = $from.pos;

      state.doc.nodesBetween(
        Math.max(0, $from.pos - 500),
        Math.min(state.doc.content.size, $from.pos + 500),
        (node, pos) => {
          if (node.isText) {
            const hasMark = node.marks.some(
              (m) => m.type.name === markType && m.attrs.odId === targetMark!.attrs.odId
            );
            if (hasMark) {
              if (pos < from) from = pos;
              if (pos + node.nodeSize > to) to = pos + node.nodeSize;
            }
          }
        }
      );

      this.currentTarget = { type: "mark", mark: targetMark, from, to };
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
      this.showPopupAt($from.pos);
      return;
    }

    this.hidePopup();
  }

  showPopupAt(pos: number) {
    try {
      const coords = this.view.coordsAtPos(pos);
      const parentRect = (this.view.dom.parentNode as HTMLElement).getBoundingClientRect();

      this.popup.style.left = `${coords.left - parentRect.left}px`;
      this.popup.style.top = `${coords.top - parentRect.top - 36}px`;
      this.popup.style.display = "flex";
    } catch {
      this.hidePopup();
    }
  }

  hidePopup() {
    this.popup.style.display = "none";
    this.currentTarget = null;
  }

  handleAccept() {
    if (!this.currentTarget) return;
    const { type, mark, from, to, node } = this.currentTarget;
    const tr = this.view.state.tr;
    tr.setMeta("suggestionAction", true);

    if (type === "mark" && mark) {
      if (mark.type.name === "suggestion_insert") {
        // Accept insertion: remove suggestion_insert mark, text remains
        tr.removeMark(from, to, mark.type);
      } else if (mark.type.name === "suggestion_delete") {
        // Accept deletion: delete text range
        tr.delete(from, to);
      }
    } else if (type === "block" && node) {
      // Accept block deletion: delete block node
      tr.delete(from, to);
    }

    this.view.dispatch(tr);
    this.hidePopup();
  }

  handleReject() {
    if (!this.currentTarget) return;
    const { type, mark, from, to, node } = this.currentTarget;
    const tr = this.view.state.tr;
    tr.setMeta("suggestionAction", true);

    if (type === "mark" && mark) {
      if (mark.type.name === "suggestion_insert") {
        // Reject insertion: delete inserted text range
        tr.delete(from, to);
      } else if (mark.type.name === "suggestion_delete") {
        // Reject deletion: remove suggestion_delete mark, text stays intact
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
    if (this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
    }
  }
}

export function createSuggestionActionPlugin(): Plugin {
  return new Plugin({
    key: suggestionActionPluginKey,
    view(editorView) {
      return new SuggestionActionView(editorView);
    },
  });
}
