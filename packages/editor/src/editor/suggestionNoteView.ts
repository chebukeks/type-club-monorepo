import { NodeView, EditorView } from "prosemirror-view";
import { Node as PMNode } from "prosemirror-model";

const MESSAGE_CIRCLE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>`;

const TRASH_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

export class SuggestionNoteView implements NodeView {
  dom: HTMLElement;
  bubble: HTMLElement | null = null;
  node: PMNode;
  view?: EditorView;
  getPos?: () => number | undefined;
  hideTimer: number | null = null;

  constructor(node: PMNode, view?: EditorView, getPos?: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("span");
    this.dom.className = "suggestion-note-badge";
    this.dom.style.setProperty("--sug-color", node.attrs.sugColor || "#f59e0b");
    this.dom.setAttribute("data-note-id", node.attrs.noteId);
    this.dom.innerHTML = MESSAGE_CIRCLE_ICON;

    this.showBubble = this.showBubble.bind(this);
    this.scheduleHide = this.scheduleHide.bind(this);
    this.cancelHide = this.cancelHide.bind(this);

    this.dom.addEventListener("mouseenter", this.showBubble);
    this.dom.addEventListener("mouseleave", this.scheduleHide);
  }

  createBubble(): HTMLElement {
    const bubble = document.createElement("div");
    bubble.className = "suggestion-note-bubble";

    const header = document.createElement("div");
    header.className = "suggestion-note-header";

    const authorSpan = document.createElement("span");
    authorSpan.className = "suggestion-note-author";
    authorSpan.textContent = this.node.attrs.sugAuthorName || "Советчик";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "suggestion-note-delete-btn";
    deleteBtn.title = "Удалить примечание";
    deleteBtn.innerHTML = TRASH_ICON;
    deleteBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleDelete();
    };

    header.appendChild(authorSpan);
    header.appendChild(deleteBtn);

    const textDiv = document.createElement("div");
    textDiv.className = "suggestion-note-text";
    textDiv.textContent = this.node.attrs.noteText || "";

    bubble.appendChild(header);
    bubble.appendChild(textDiv);

    bubble.addEventListener("mouseenter", this.cancelHide);
    bubble.addEventListener("mouseleave", this.scheduleHide);

    return bubble;
  }

  showBubble() {
    this.cancelHide();
    if (!this.bubble) {
      this.bubble = this.createBubble();
      document.body.appendChild(this.bubble);
    } else {
      const authorSpan = this.bubble.querySelector(".suggestion-note-author");
      if (authorSpan) authorSpan.textContent = this.node.attrs.sugAuthorName || "Советчик";
      const textDiv = this.bubble.querySelector(".suggestion-note-text");
      if (textDiv) textDiv.textContent = this.node.attrs.noteText || "";
    }

    this.bubble.style.display = "block";

    const rect = this.dom.getBoundingClientRect();
    const bubbleWidth = this.bubble.offsetWidth || 220;
    const bubbleHeight = this.bubble.offsetHeight || 80;

    let left = rect.left + rect.width / 2 - bubbleWidth / 2;
    let top = rect.top - bubbleHeight - 10;

    if (top < 10) {
      top = rect.bottom + 10;
    }
    if (left + bubbleWidth > window.innerWidth - 12) {
      left = window.innerWidth - bubbleWidth - 12;
    }
    if (left < 12) left = 12;

    this.bubble.style.left = `${left}px`;
    this.bubble.style.top = `${top}px`;
  }

  scheduleHide() {
    this.cancelHide();
    this.hideTimer = window.setTimeout(() => {
      if (this.bubble) {
        this.bubble.style.display = "none";
      }
    }, 200);
  }

  cancelHide() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  handleDelete() {
    if (this.view && this.getPos) {
      const pos = this.getPos();
      if (typeof pos === "number") {
        const tr = this.view.state.tr.delete(pos, pos + this.node.nodeSize);
        tr.setMeta("suggestionAction", true);
        this.view.dispatch(tr);
      }
    }
    this.destroyBubble();
  }

  destroyBubble() {
    this.cancelHide();
    if (this.bubble) {
      this.bubble.removeEventListener("mouseenter", this.cancelHide);
      this.bubble.removeEventListener("mouseleave", this.scheduleHide);
      if (this.bubble.parentNode) {
        this.bubble.parentNode.removeChild(this.bubble);
      }
      this.bubble = null;
    }
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.dom.style.setProperty("--sug-color", node.attrs.sugColor || "#f59e0b");
    if (this.bubble) {
      const textDiv = this.bubble.querySelector(".suggestion-note-text");
      if (textDiv) textDiv.textContent = node.attrs.noteText || "";
    }
    return true;
  }

  destroy() {
    this.dom.removeEventListener("mouseenter", this.showBubble);
    this.dom.removeEventListener("mouseleave", this.scheduleHide);
    this.destroyBubble();
  }

  stopEvent() {
    return true;
  }

  ignoreMutation() {
    return true;
  }
}
