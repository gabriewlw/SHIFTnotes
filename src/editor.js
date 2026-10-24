import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findIPMatches } from "./document";
export const IPHighlight = Extension.create({
  name: "ipHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("ip-highlight"),
        props: {
          decorations(state) {
            const result = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText) return;
              for (const match of findIPMatches(node.text))
                result.push(
                  Decoration.inline(
                    pos + match.index,
                    pos + match.index + match[0].length,
                    { class: "ip-address", title: "IP address" },
                  ),
                );
            });
            return DecorationSet.create(state.doc, result);
          },
        },
      }),
    ];
  },
});
