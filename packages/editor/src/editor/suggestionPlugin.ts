import { Plugin, PluginKey, Transaction } from "prosemirror-state";

export const suggestionPluginKey = new PluginKey("suggestion");

export interface SuggestionPluginOptions {
  active: boolean;
  authorId: number;
  authorName: string;
  color: string;
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

    props: {
      handleDOMEvents: {
        beforeinput(view, event: InputEvent) {
          const pluginState: SuggestionPluginOptions | undefined = suggestionPluginKey.getState(view.state);
          if (!pluginState?.active) return false;

          const { inputType } = event;

          // ── Handle text deletions in Suggestion Mode ──
          if (inputType.startsWith("delete")) {
            event.preventDefault();

            let { from, to } = view.state.selection;

            // Single cursor position (backspace or delete key pressed without text selection)
            if (from === to) {
              if (inputType === "deleteContentBackward" || inputType === "deleteWordBackward") {
                if (from <= 1) return true;
                from = Math.max(1, from - 1);
              } else if (inputType === "deleteContentForward" || inputType === "deleteWordForward") {
                if (to >= view.state.doc.content.size - 1) return true;
                to = Math.min(view.state.doc.content.size - 1, to + 1);
              }
            }

            if (from >= to) return true;

            const tr = view.state.tr;
            let handledBlock = false;

            // Check if selection touches or contains a block element (image, table, code_block, math_block)
            view.state.doc.nodesBetween(from, to, (node, pos) => {
              if (node.isBlock && node.type.name !== "paragraph" && node.type.name !== "blockquote") {
                // Block element deletion (Option B): attach sugDelete metadata attribute
                if (node.type.name === "image") {
                  tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    sugDelete: JSON.stringify({
                      odId: crypto.randomUUID(),
                      sugAuthorId: pluginState.authorId,
                      sugAuthorName: pluginState.authorName,
                      sugColor: pluginState.color,
                      sugCreatedAt: new Date().toISOString(),
                    }),
                  });
                  handledBlock = true;
                }
              }
            });

            if (!handledBlock) {
              // Apply suggestion_delete mark over the inline range
              const deleteMark = view.state.schema.marks.suggestion_delete.create({
                odId: crypto.randomUUID(),
                sugAuthorId: pluginState.authorId,
                sugAuthorName: pluginState.authorName,
                sugColor: pluginState.color,
                sugCreatedAt: new Date().toISOString(),
              });
              tr.addMark(from, to, deleteMark);
            }

            view.dispatch(tr);
            return true;
          }

          return false;
        },
      },
    },

    appendTransaction(transactions, _oldState, newState) {
      const pluginState: SuggestionPluginOptions | undefined = suggestionPluginKey.getState(newState);
      if (!pluginState?.active) return null;

      // Check if any transaction inserted new text or steps
      const isUserTx = transactions.some(
        (tr) =>
          tr.docChanged &&
          !tr.getMeta("y-sync$") &&
          !tr.getMeta("suggestionAction")
      );

      if (!isUserTx) return null;

      let tr: Transaction | null = null;

      // Find newly inserted text ranges and apply suggestion_insert mark
      transactions.forEach((prevTr) => {
        if (!prevTr.docChanged || prevTr.getMeta("y-sync$") || prevTr.getMeta("suggestionAction")) return;

        prevTr.steps.forEach((step) => {
          step.getMap().forEach((_oldStart, _oldEnd, newStart, newEnd) => {
            if (newEnd > newStart) {
              // Range was inserted
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
