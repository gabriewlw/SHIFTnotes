import React, { useState } from "react";
import { Node } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const GuideStep = Node.create({
  name: "guideStep",
  group: "block",
  content:
    "(heading | paragraph | bulletList | orderedList | blockquote | codeBlock | guideImage | fileAttachment | table)+",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("guide-step-numbers"),
        props: {
          decorations(state) {
            let number = 0;
            const decorations = [];
            state.doc.descendants((node, position) => {
              if (node.type.name === "guideStep")
                decorations.push(
                  Decoration.node(position, position + node.nodeSize, {
                    "data-step-number": String(++number).padStart(2, "0"),
                  }),
                );
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
  defining: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'section[data-type="guide-step"]' }];
  },
  renderHTML() {
    return ["section", { "data-type": "guide-step", class: "guide-step" }, 0];
  },
});

export const GuideImage = Node.create({
  name: "guideImage",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (el) => el.querySelector("img")?.getAttribute("src") || "",
      },
      caption: {
        default: "",
        parseHTML: (el) => el.querySelector("figcaption")?.textContent || "",
      },
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-type="guide-image"]' }];
  },
  renderHTML({ node }) {
    // Only embedded raster images are supported; workspace imports cannot load remote content.
    const src = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(
      node.attrs.src,
    )
      ? node.attrs.src
      : "";
    return [
      "figure",
      { "data-type": "guide-image", class: "guide-image" },
      ["img", { src, alt: node.attrs.caption || "Tutorial illustration" }],
      ["figcaption", {}, node.attrs.caption],
    ];
  },
});

export function TutorialStepForm({ onInsert }) {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <p className="modal-description">
        Build a numbered step with instructions, an image, or both. Text remains
        editable on the page. Add steps in order; numbering updates
        automatically.
      </p>
      <label className="field">
        Step title
        <input
          autoFocus
          aria-label="Step title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Configure the switch management IP"
        />
      </label>
      <label className="field">
        Instructions (optional)
        <textarea
          aria-label="Step instructions"
          rows={5}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Describe the action and what the reader should see…"
        />
      </label>
      <label className="field">
        Step image (optional)
        <input
          aria-label="Step image"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            if (
              !/^image\/(png|jpeg|gif|webp)$/.test(file.type) ||
              file.size > 5 * 1024 * 1024
            ) {
              setError("Choose a PNG, JPEG, GIF, or WebP image up to 5 MB.");
              return;
            }
            setBusy(true);
            try {
              const src = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              await new Promise((resolve, reject) => {
                const probe = new Image();
                probe.onload = resolve;
                probe.onerror = reject;
                probe.src = src;
              });
              setImage({ name: file.name, src });
            } catch {
              setError("This image could not be read.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {image && (
        <div className="step-image-preview">
          <img src={image.src} alt="Selected step illustration" />
          <button onClick={() => setImage(null)}>Remove step image</button>
        </div>
      )}
      {image && (
        <label className="field">
          Image caption
          <input
            aria-label="Step image caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Describe the screenshot or expected result"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button
          className="primary-button"
          disabled={busy || !title.trim() || (!instructions.trim() && !image)}
          onClick={() => {
            const content = [
              {
                type: "heading",
                attrs: { level: 3 },
                content: [{ type: "text", text: title.trim() }],
              },
            ];
            for (const line of instructions
              .split(/\n/)
              .filter((line) => line.trim()))
              content.push({
                type: "paragraph",
                content: [{ type: "text", text: line }],
              });
            if (image)
              content.push({
                type: "guideImage",
                attrs: { src: image.src, caption },
              });
            onInsert({ type: "guideStep", content });
          }}
        >
          Add step
        </button>
      </div>
    </>
  );
}
