import React from "react";
import {
  Type,
  Table2,
  Plus,
  Trash2,
  Columns3,
  Rows3,
  Merge,
  Split,
} from "lucide-react";
import { FONT_FAMILIES } from "./fonts";
export default function TypographyToolbar({ editor, data, onInsertTable }) {
  if (!editor) return null;
  return (
    <div className="typography-toolbar" aria-label="Typography and tables">
      <Type size={14} />
      <select
        aria-label="Font family"
        value={data?.fontFamily || ""}
        onChange={(e) =>
          e.target.value
            ? editor.chain().focus().setFontFamily(e.target.value).run()
            : editor.chain().focus().unsetFontFamily().run()
        }
      >
        <option value="">Document font</option>
        {FONT_FAMILIES.map((font) => (
          <option key={font} value={font} style={{ fontFamily: font }}>
            {font}
          </option>
        ))}
      </select>
      <select
        aria-label="Font size"
        value={data?.fontSize || ""}
        onChange={(e) =>
          e.target.value
            ? editor.chain().focus().setFontSize(e.target.value).run()
            : editor.chain().focus().unsetFontSize().run()
        }
      >
        <option value="">Auto size</option>
        {[9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map((size) => (
          <option key={size} value={`${size}pt`}>
            {size} pt
          </option>
        ))}
      </select>
      <span className="tool-divider" />
      <button className="table-insert" onClick={onInsertTable}>
        <Table2 size={14} />
        Insert table
      </button>
      {data?.inTable && (
        <div className="table-tools">
          <button
            title="Add row below"
            aria-label="Add row below"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <Rows3 size={14} />
            <Plus size={10} />
          </button>
          <button
            title="Add column after"
            aria-label="Add column after"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <Columns3 size={14} />
            <Plus size={10} />
          </button>
          <select
            aria-label="Table actions"
            value=""
            onChange={(e) => {
              if (e.target.value)
                editor.chain().focus()[e.target.value]().run();
            }}
          >
            <option value="">Table actions…</option>
            <option value="toggleHeaderRow">Toggle header row</option>
            <option value="addRowBefore">Add row above</option>
            <option value="addColumnBefore">Add column before</option>
            <option value="mergeCells">Merge selected cells</option>
            <option value="splitCell">Split cell</option>
            <option value="deleteRow">Delete row</option>
            <option value="deleteColumn">Delete column</option>
            <option value="deleteTable">Delete table</option>
          </select>
        </div>
      )}
    </div>
  );
}
