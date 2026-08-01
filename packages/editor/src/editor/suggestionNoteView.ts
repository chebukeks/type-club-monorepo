import { NodeView } from "prosemirror-view";
import { Node as PMNode } from "prosemirror-model";

export class SuggestionNoteView implements NodeView {
  dom: HTMLElement;
  node: PMNode;

  constructor(node: PMNode) {
    this.node = node;
    this.dom = document.createElement("span");
    this.dom.className = "suggestion-note";
    this.dom.style.setProperty("--sug-color", node.attrs.sugColor || "#f59e0b");
    this.dom.setAttribute("data-note-id", node.attrs.noteId);
    this.dom.setAttribute("data-sug-author-name", node.attrs.sugAuthorName);
    this.dom.setAttribute("data-note-text", node.attrs.noteText);
    this.dom.title = `${node.attrs.sugAuthorName || "Советчик"}: ${node.attrs.noteText}`;
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.dom.style.setProperty("--sug-color", node.attrs.sugColor || "#f59e0b");
    this.dom.setAttribute("data-note-text", node.attrs.noteText);
    this.dom.title = `${node.attrs.sugAuthorName || "Советчик"}: ${node.attrs.noteText}`;
    return true;
  }

  stopEvent() {
    return true;
  }

  ignoreMutation() {
    return true;
  }
}
