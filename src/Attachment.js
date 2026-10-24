import { Node } from "@tiptap/core";
export const CanvasSpacer = Node.create({
  name: "canvasSpacer",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      height: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-height")) || 0,
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="canvas-spacer"]' }];
  },
  renderHTML({ node }) {
    const height = Math.max(0, Math.min(10000, Number(node.attrs.height) || 0));
    return [
      "div",
      {
        "data-type": "canvas-spacer",
        "data-height": height,
        style: `height:${height}px`,
      },
    ];
  },
});
export const Attachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      filename: {
        default: "Attached file",
        rendered: false,
        parseHTML: (el) =>
          el.querySelector("a")?.getAttribute("download") || "Attached file",
      },
      base64: {
        default: "",
        rendered: false,
        parseHTML: (el) =>
          el.querySelector("a")?.getAttribute("href")?.split(",")[1] || "",
      },
      size: {
        default: 0,
        rendered: false,
        parseHTML: (el) => Number(el.getAttribute("data-size")) || 0,
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="file-attachment"]' }];
  },
  renderHTML({ node }) {
    return [
      "div",
      {
        "data-type": "file-attachment",
        "data-size": node.attrs.size,
        class: "attachment-node",
      },
      ["span", { class: "attachment-label" }, "ATTACHED REFERENCE FILE"],
      [
        "a",
        {
          download: node.attrs.filename,
          href: `data:application/octet-stream;base64,${node.attrs.base64}`,
        },
        node.attrs.filename,
      ],
      [
        "small",
        {},
        `${(node.attrs.size / 1024).toFixed(1)} KB · Click to save original · PDF includes the filename, not the file bytes`,
      ],
    ];
  },
});
