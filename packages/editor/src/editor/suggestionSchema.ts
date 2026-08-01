import { MarkSpec, NodeSpec } from "prosemirror-model";

/**
 * Mark: suggestion_insert
 * Text added by an editor (suggestor).
 * Rendered with the author's suggestion color and underline.
 */
export const suggestionInsertMark: MarkSpec = {
  attrs: {
    odId: { default: "" },
    sugAuthorId: { default: 0 },
    sugAuthorName: { default: "" },
    sugColor: { default: "#3b82f6" },
    sugCreatedAt: { default: "" },
  },
  inclusive: true,
  parseDOM: [
    {
      tag: "span.suggestion-insert",
      getAttrs(dom: HTMLElement) {
        return {
          odId: dom.getAttribute("data-od-id") || "",
          sugAuthorId: Number(dom.getAttribute("data-sug-author-id")) || 0,
          sugAuthorName: dom.getAttribute("data-sug-author-name") || "",
          sugColor: dom.style.getPropertyValue("--sug-color") || "#3b82f6",
          sugCreatedAt: dom.getAttribute("data-sug-created-at") || "",
        };
      },
    },
  ],
  toDOM(mark) {
    return [
      "span",
      {
        class: "suggestion-insert",
        "data-od-id": mark.attrs.odId,
        "data-sug-author-id": String(mark.attrs.sugAuthorId),
        "data-sug-author-name": mark.attrs.sugAuthorName,
        "data-sug-created-at": mark.attrs.sugCreatedAt,
        style: `--sug-color: ${mark.attrs.sugColor}`,
      },
      0,
    ];
  },
};

/**
 * Mark: suggestion_delete
 * Text proposed to be deleted by an editor (suggestor).
 * Rendered with strikethrough in the author's suggestion color.
 */
export const suggestionDeleteMark: MarkSpec = {
  attrs: {
    odId: { default: "" },
    sugAuthorId: { default: 0 },
    sugAuthorName: { default: "" },
    sugColor: { default: "#ef4444" },
    sugCreatedAt: { default: "" },
  },
  inclusive: false,
  excludes: "suggestion_insert",
  parseDOM: [
    {
      tag: "span.suggestion-delete",
      getAttrs(dom: HTMLElement) {
        return {
          odId: dom.getAttribute("data-od-id") || "",
          sugAuthorId: Number(dom.getAttribute("data-sug-author-id")) || 0,
          sugAuthorName: dom.getAttribute("data-sug-author-name") || "",
          sugColor: dom.style.getPropertyValue("--sug-color") || "#ef4444",
          sugCreatedAt: dom.getAttribute("data-sug-created-at") || "",
        };
      },
    },
  ],
  toDOM(mark) {
    return [
      "span",
      {
        class: "suggestion-delete",
        "data-od-id": mark.attrs.odId,
        "data-sug-author-id": String(mark.attrs.sugAuthorId),
        "data-sug-author-name": mark.attrs.sugAuthorName,
        "data-sug-created-at": mark.attrs.sugCreatedAt,
        style: `--sug-color: ${mark.attrs.sugColor}`,
      },
      0,
    ];
  },
};

/**
 * Node: suggestion_note
 * Inline atom node representing a comment/note placed at a specific position.
 */
export const suggestionNoteNode: NodeSpec = {
  group: "inline",
  inline: true,
  atom: true,
  attrs: {
    noteId: { default: "" },
    sugAuthorId: { default: 0 },
    sugAuthorName: { default: "" },
    sugColor: { default: "#f59e0b" },
    noteText: { default: "" },
    sugCreatedAt: { default: "" },
  },
  parseDOM: [
    {
      tag: "span.suggestion-note",
      getAttrs(dom: HTMLElement) {
        return {
          noteId: dom.getAttribute("data-note-id") || "",
          sugAuthorId: Number(dom.getAttribute("data-sug-author-id")) || 0,
          sugAuthorName: dom.getAttribute("data-sug-author-name") || "",
          sugColor: dom.style.getPropertyValue("--sug-color") || "#f59e0b",
          noteText: dom.getAttribute("data-note-text") || "",
          sugCreatedAt: dom.getAttribute("data-sug-created-at") || "",
        };
      },
    },
  ],
  toDOM(node) {
    return [
      "span",
      {
        class: "suggestion-note",
        "data-note-id": node.attrs.noteId,
        "data-sug-author-id": String(node.attrs.sugAuthorId),
        "data-sug-author-name": node.attrs.sugAuthorName,
        "data-sug-created-at": node.attrs.sugCreatedAt,
        "data-note-text": node.attrs.noteText,
        style: `--sug-color: ${node.attrs.sugColor}`,
        title: `${node.attrs.sugAuthorName}: ${node.attrs.noteText}`,
      },
      "💬",
    ];
  },
};
