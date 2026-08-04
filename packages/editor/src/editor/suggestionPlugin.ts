import { Plugin, PluginKey, Transaction, TextSelection } from "prosemirror-state";
import { Fragment, Slice, Node as PMNode, Schema } from "prosemirror-model";

export const suggestionPluginKey = new PluginKey("suggestion");

export interface SuggestionPluginOptions {
  active: boolean;
  authorId: number;
  authorName: string;
  color: string;
}

function getAdjacentDeleteMarkInfo(
  doc: PMNode,
  from: number,
  to: number,
  authorId: number
): { odId: string; sugCreatedAt: string } | null {
  // Check immediately before 'from'
  if (from > 1) {
    const $from = doc.resolve(from);
    const markBefore = $from.nodeBefore?.marks.find(
      (m) => m.type.name === "suggestion_delete" && Number(m.attrs.sugAuthorId) === authorId
    );
    if (markBefore?.attrs.odId) {
      return { odId: markBefore.attrs.odId, sugCreatedAt: markBefore.attrs.sugCreatedAt || "" };
    }
  }
  // Check immediately after 'to'
  if (to < doc.content.size - 1) {
    const $to = doc.resolve(to);
    const markAfter = $to.nodeAfter?.marks.find(
      (m) => m.type.name === "suggestion_delete" && Number(m.attrs.sugAuthorId) === authorId
    );
    if (markAfter?.attrs.odId) {
      return { odId: markAfter.attrs.odId, sugCreatedAt: markAfter.attrs.sugCreatedAt || "" };
    }
  }
  return null;
}

function getAdjacentInsertMarkInfo(
  doc: PMNode,
  pos: number,
  authorId: number
): { odId: string; sugCreatedAt: string } | null {
  if (pos > 1) {
    const $pos = doc.resolve(pos);
    const markBefore = $pos.nodeBefore?.marks.find(
      (m) => m.type.name === "suggestion_insert" && Number(m.attrs.sugAuthorId) === authorId
    );
    if (markBefore?.attrs.odId) {
      return { odId: markBefore.attrs.odId, sugCreatedAt: markBefore.attrs.sugCreatedAt || "" };
    }
  }
  return null;
}

function findWordStartBackward(doc: PMNode, pos: number): number {
  if (pos <= 1) return 1;
  const $pos = doc.resolve(pos);
  const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, null, "\n");
  if (!textBefore) return Math.max(1, pos - 1);

  let idx = textBefore.length;
  // 1. Skip trailing whitespace
  while (idx > 0 && /\s/.test(textBefore[idx - 1])) {
    idx--;
  }
  // 2. Skip word characters or punctuation
  if (idx > 0) {
    const isWord = /[\p{L}\p{N}_]/u.test(textBefore[idx - 1]);
    while (idx > 0) {
      const char = textBefore[idx - 1];
      if (/\s/.test(char)) break;
      const charIsWord = /[\p{L}\p{N}_]/u.test(char);
      if (charIsWord !== isWord) break;
      idx--;
    }
  }
  const diff = textBefore.length - idx;
  return Math.max(1, pos - diff);
}

function findWordEndForward(doc: PMNode, pos: number): number {
  const maxPos = doc.content.size - 1;
  if (pos >= maxPos) return maxPos;
  const $pos = doc.resolve(pos);
  const textAfter = $pos.parent.textBetween($pos.parentOffset, $pos.parent.content.size, null, "\n");
  if (!textAfter) return Math.min(maxPos, pos + 1);

  let idx = 0;
  // 1. Skip leading whitespace
  while (idx < textAfter.length && /\s/.test(textAfter[idx])) {
    idx++;
  }
  // 2. Skip word characters or punctuation
  if (idx < textAfter.length) {
    const isWord = /[\p{L}\p{N}_]/u.test(textAfter[idx]);
    while (idx < textAfter.length) {
      const char = textAfter[idx];
      if (/\s/.test(char)) break;
      const charIsWord = /[\p{L}\p{N}_]/u.test(char);
      if (charIsWord !== isWord) break;
      idx++;
    }
  }
  return Math.min(maxPos, pos + idx);
}

function applySuggestionDelete(
  tr: Transaction,
  schema: Schema,
  from: number,
  to: number,
  pluginState: SuggestionPluginOptions
) {
  if (from >= to) return;

  const adj = getAdjacentDeleteMarkInfo(tr.doc, from, to, pluginState.authorId);
  const odId = adj?.odId || crypto.randomUUID();
  const sugCreatedAt = adj?.sugCreatedAt || new Date().toISOString();

  const deleteMark = schema.marks.suggestion_delete.create({
    odId,
    sugAuthorId: pluginState.authorId,
    sugAuthorName: pluginState.authorName,
    sugColor: pluginState.color,
    sugCreatedAt,
  });

  const ownInsertRanges: { from: number; to: number }[] = [];

  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isText) {
      const start = Math.max(from, pos);
      const end = Math.min(to, pos + node.nodeSize);
      if (start < end) {
        const isOwnInsert = node.marks.some(
          (m) =>
            m.type.name === "suggestion_insert" &&
            Number(m.attrs.sugAuthorId) === pluginState.authorId
        );
        if (isOwnInsert) {
          ownInsertRanges.push({ from: start, to: end });
        } else {
          tr.addMark(start, end, deleteMark);
        }
      }
    } else if (node.isBlock && node.type.name === "image") {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        sugDelete: JSON.stringify({
          odId,
          sugAuthorId: pluginState.authorId,
          sugAuthorName: pluginState.authorName,
          sugColor: pluginState.color,
          sugCreatedAt,
        }),
      });
    }
  });

  // Delete own inserted text ranges in reverse order
  for (let i = ownInsertRanges.length - 1; i >= 0; i--) {
    tr.delete(ownInsertRanges[i].from, ownInsertRanges[i].to);
  }
}

function isProtectedNodeSelection(selection: import("prosemirror-state").Selection): boolean {
  const { $from, $to } = selection;
  for (let d = $from.depth; d >= 0; d--) {
    const name = $from.node(d)?.type.name;
    if (name === "code_block" || name === "math_block" || name === "math_inline") return true;
  }
  for (let d = $to.depth; d >= 0; d--) {
    const name = $to.node(d)?.type.name;
    if (name === "code_block" || name === "math_block" || name === "math_inline") return true;
  }
  return false;
}

export function createSuggestionPlugin(options: SuggestionPluginOptions): Plugin {
  return new Plugin({
    key: suggestionPluginKey,

    state: {
      init: () => options,
      apply: (tr, prev) => {
        const meta = tr.getMeta(suggestionPluginKey);
        if (meta) return { ...prev, ...meta };
        return prev;
      },
    },

    filterTransaction(tr, state) {
      // Allow transactions that don't change the document (selections, meta-only)
      if (!tr.docChanged) return true;
      const pluginState: SuggestionPluginOptions | undefined = suggestionPluginKey.getState(state);
      if (!pluginState?.active) return true;

      // Block any changes inside code_block, math_block, or math_inline
      if (isProtectedNodeSelection(tr.selection)) return false;

      // Allow collab-sync transactions from y-prosemirror
      if (tr.getMeta("y-sync$")) return true;
      // Allow our own suggestion-aware transactions
      if (tr.getMeta("suggestionAction")) return true;
      // Allow history undo/redo
      if (tr.getMeta("history$")) return true;
      // Allow addToHistory meta (used by some prosemirror internals)
      if (tr.getMeta("addToHistory") === false) return true;

      // Block everything else — prevents tables, images, math, checkboxes,
      // and any other structural change from bypassing suggestion mode
      return false;
    },


    props: {
      handleDOMEvents: {
        cut(view, event) {
          const pluginState: SuggestionPluginOptions | undefined = suggestionPluginKey.getState(view.state);
          if (!pluginState?.active) return false;
          if (isProtectedNodeSelection(view.state.selection)) {
            event.preventDefault();
            return true;
          }

          const { from, to } = view.state.selection;
          if (from === to) return false;

          const text = view.state.doc.textBetween(from, to, "\n");
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(() => {});
          }

          event.preventDefault();
          const tr = view.state.tr;
          applySuggestionDelete(tr, view.state.schema, from, to, pluginState);
          tr.setSelection(TextSelection.create(tr.doc, to));
          tr.setMeta("suggestionAction", true);
          view.dispatch(tr);
          return true;
        },
      },

      handleKeyDown(view, event) {
        const pluginState: SuggestionPluginOptions | undefined = suggestionPluginKey.getState(view.state);
        if (!pluginState?.active) return false;
        if (isProtectedNodeSelection(view.state.selection)) {
          return true;
        }

        const { key } = event;

        if (key === "Backspace") {
          event.preventDefault();
          const { from, to } = view.state.selection;

          if (from !== to) {
            const tr = view.state.tr;
            applySuggestionDelete(tr, view.state.schema, from, to, pluginState);
            tr.setSelection(TextSelection.create(tr.doc, to));
            tr.setMeta("suggestionAction", true);
            view.dispatch(tr);
            return true;
          }

          if (from <= 1) return true;

          const isWordDelete = event.ctrlKey || event.altKey;
          const prevPos = isWordDelete
            ? findWordStartBackward(view.state.doc, from)
            : Math.max(1, from - 1);

          if (prevPos >= from) return true;

          const tr = view.state.tr;
          applySuggestionDelete(tr, view.state.schema, prevPos, from, pluginState);
          tr.setSelection(TextSelection.create(tr.doc, prevPos));
          tr.setMeta("suggestionAction", true);
          view.dispatch(tr);
          return true;
        }

        if (key === "Delete") {
          event.preventDefault();
          const { from, to } = view.state.selection;

          if (from !== to) {
            const tr = view.state.tr;
            applySuggestionDelete(tr, view.state.schema, from, to, pluginState);
            tr.setSelection(TextSelection.create(tr.doc, to));
            tr.setMeta("suggestionAction", true);
            view.dispatch(tr);
            return true;
          }

          const maxPos = view.state.doc.content.size - 1;
          if (to >= maxPos) return true;

          const isWordDelete = event.ctrlKey || event.altKey;
          const nextPos = isWordDelete
            ? findWordEndForward(view.state.doc, to)
            : Math.min(maxPos, to + 1);

          if (nextPos <= to) return true;

          const tr = view.state.tr;
          applySuggestionDelete(tr, view.state.schema, to, nextPos, pluginState);
          tr.setSelection(TextSelection.create(tr.doc, nextPos));
          tr.setMeta("suggestionAction", true);
          view.dispatch(tr);
          return true;
        }

        return false;
      },

      handleTextInput(view, from, to, text) {
        const pluginState: SuggestionPluginOptions | undefined = suggestionPluginKey.getState(view.state);
        if (!pluginState?.active) return false;
        if (isProtectedNodeSelection(view.state.selection)) {
          return true;
        }

        const tr = view.state.tr;

        // If text was selected, mark the old text with suggestion_delete
        if (from !== to) {
          applySuggestionDelete(tr, view.state.schema, from, to, pluginState);
        }

        // Map the insert position through any steps already applied
        // (applySuggestionDelete may have deleted own-insert ranges, shifting positions)
        const mappedTo = tr.mapping.map(to);

        // Check if adjacent insert mark exists to group typing into a contiguous suggestion
        const adj = getAdjacentInsertMarkInfo(tr.doc, mappedTo, pluginState.authorId);
        const odId = adj?.odId || crypto.randomUUID();
        const sugCreatedAt = adj?.sugCreatedAt || new Date().toISOString();

        const insertMark = view.state.schema.marks.suggestion_insert.create({
          odId,
          sugAuthorId: pluginState.authorId,
          sugAuthorName: pluginState.authorName,
          sugColor: pluginState.color,
          sugCreatedAt,
        });

        const textNode = view.state.schema.text(text, [insertMark]);
        tr.insert(mappedTo, textNode);
        tr.setSelection(TextSelection.create(tr.doc, mappedTo + text.length));
        tr.setMeta("suggestionAction", true);
        view.dispatch(tr);
        return true;
      },

      handlePaste(view, _event, slice) {
        const pluginState: SuggestionPluginOptions | undefined = suggestionPluginKey.getState(view.state);
        if (!pluginState?.active) return false;
        if (isProtectedNodeSelection(view.state.selection)) {
          return true;
        }

        const { from, to } = view.state.selection;
        const tr = view.state.tr;

        if (from !== to) {
          applySuggestionDelete(tr, view.state.schema, from, to, pluginState);
        }

        const odId = crypto.randomUUID();
        const sugCreatedAt = new Date().toISOString();

        const insertMark = view.state.schema.marks.suggestion_insert.create({
          odId,
          sugAuthorId: pluginState.authorId,
          sugAuthorName: pluginState.authorName,
          sugColor: pluginState.color,
          sugCreatedAt,
        });

        function markSlice(node: PMNode): PMNode {
          if (node.isText) {
            return node.mark([...node.marks, insertMark]);
          }
          if (node.content) {
            const newContent: PMNode[] = [];
            node.content.forEach((child) => newContent.push(markSlice(child)));
            return node.copy(Fragment.from(newContent));
          }
          return node;
        }

        const newContent: PMNode[] = [];
        slice.content.forEach((child) => newContent.push(markSlice(child)));
        const transformedSlice = new Slice(Fragment.from(newContent), slice.openStart, slice.openEnd);

        tr.replace(to, to, transformedSlice);
        tr.setMeta("suggestionAction", true);
        view.dispatch(tr);
        return true;
      },
    },

    appendTransaction(transactions, _oldState, newState) {
      const pluginState: SuggestionPluginOptions | undefined = suggestionPluginKey.getState(newState);
      if (!pluginState?.active) return null;

      // Check if any transaction inserted new text or steps without suggestion mark
      const isUserTx = transactions.some(
        (tr) =>
          tr.docChanged &&
          !tr.getMeta("y-sync$") &&
          !tr.getMeta("suggestionAction")
      );

      if (!isUserTx) return null;

      let tr: Transaction | null = null;

      transactions.forEach((prevTr) => {
        if (!prevTr.docChanged || prevTr.getMeta("y-sync$") || prevTr.getMeta("suggestionAction")) return;

        prevTr.steps.forEach((step) => {
          step.getMap().forEach((_oldStart, _oldEnd, newStart, newEnd) => {
            if (newEnd > newStart) {
              if (!tr) tr = newState.tr;

              const insertMark = newState.schema.marks.suggestion_insert.create({
                odId: crypto.randomUUID(),
                sugAuthorId: pluginState.authorId,
                sugAuthorName: pluginState.authorName,
                sugColor: pluginState.color,
                sugCreatedAt: new Date().toISOString(),
              });

              tr.addMark(newStart, newEnd, insertMark);
              tr.setMeta("suggestionAction", true);
            }
          });
        });
      });

      return tr;
    },
  });
}
