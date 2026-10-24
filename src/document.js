import ipaddr from "ipaddr.js";
export const DEFAULT_BRAND = {
  name: "SHIFTnotes",
  primary: "#173f3d",
  accent: "#d6a566",
};
const network = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="260" viewBox="0 0 1100 260"><rect width="1100" height="260" rx="18" fill="#f5f8f7"/><path d="M240 110H470M630 110H860" stroke="#9bb4ad" stroke-width="3" stroke-dasharray="7 7"/><g font-family="Arial" text-anchor="middle"><rect x="45" y="58" width="220" height="105" rx="12" fill="white" stroke="#d3dfda"/><rect x="440" y="58" width="220" height="105" rx="12" fill="#173f3d"/><rect x="835" y="58" width="220" height="105" rx="12" fill="white" stroke="#d3dfda"/><text x="155" y="102" fill="#173f3d" font-size="21" font-weight="bold">Studio A</text><text x="155" y="135" fill="#75857f" font-size="17">192.168.10.21</text><text x="550" y="102" fill="white" font-size="21" font-weight="bold">Core switch</text><text x="550" y="135" fill="#a9c9bf" font-size="17">10.20.0.1</text><text x="945" y="102" fill="#173f3d" font-size="21" font-weight="bold">Playout</text><text x="945" y="135" fill="#75857f" font-size="17">192.168.20.10</text><text x="550" y="220" fill="#75857f" font-size="16">STUDIO NETWORK · SIGNAL FLOW</text></g></svg>`;
export const initialDocs = [
  {
    id: "studio-network",
    title: "Studio network setup",
    folder: "Engineering",
    tag: "NETWORK GUIDE",
    updated: Date.now(),
    pinned: true,
    content: `<p>A practical guide to configuring the studio network, connecting devices, and getting signals where they need to go.</p><h2>Overview</h2><p>This document covers the network configuration for Studio A. Keep control traffic isolated from media streams, and verify every endpoint before going on air.</p><blockquote><p><strong>Before you begin</strong><br>Confirm that all devices are on the correct VLAN and that the core switch is reachable at 10.20.0.1.</p></blockquote><h2>Device configuration</h2><p>Assign a static address to each device. Studio A uses <code>192.168.10.0/24</code> for control, with the gateway at 192.168.10.1.</p><pre><code class="language-xml">&lt;device name="studio-a-encoder"&gt;\n  &lt;network&gt;\n    &lt;address&gt;192.168.10.21&lt;/address&gt;\n    &lt;gateway&gt;192.168.10.1&lt;/gateway&gt;\n    &lt;vlan&gt;110&lt;/vlan&gt;\n  &lt;/network&gt;\n&lt;/device&gt;</code></pre><h2>Signal flow</h2><p>The core switch routes traffic between Studio A and playout. Use the diagram below as a quick reference when tracing a connection.</p>`,
    images: [
      {
        id: "network-image",
        src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(network),
        x: 54,
        y: 855,
        width: 570,
        aspect: 260 / 1100,
        caption: "Figure 1. Studio A network topology",
      },
    ],
    summary: "",
  },
  {
    id: "handover",
    title: "Engineering handover",
    folder: "Engineering",
    tag: "HANDOVER",
    updated: Date.now() - 86400000,
    pinned: false,
    images: [],
    summary: "",
    content:
      "<p>Everything the next shift needs to know.</p><h2>Shift overview</h2><p>All primary systems are operational. Review the maintenance window before making changes.</p><h2>Open items</h2><ul><li><p>Check the backup encoder signal.</p></li><li><p>Review the switch configuration backup.</p></li></ul><h2>Next steps</h2><p>Record changes, owners, and completion times here.</p>",
  },
  {
    id: "playout",
    title: "Playout checklist",
    folder: "Operations",
    tag: "CHECKLIST",
    updated: Date.now() - 172800000,
    pinned: false,
    images: [],
    summary: "",
    content:
      "<h2>Before going live</h2><ul><li><p>Verify the primary and backup outputs.</p></li><li><p>Confirm audio levels and channel mapping.</p></li><li><p>Check the upcoming playlist and timing.</p></li></ul>",
  },
];
export function makeDocument(folder = "Engineering", template = "blank") {
  return {
    id: crypto.randomUUID(),
    title: template === "handover" ? "Untitled handover" : "Untitled document",
    folder,
    tag: template === "handover" ? "HANDOVER" : "TECHNICAL NOTE",
    updated: Date.now(),
    images: [],
    summary: "",
    pinned: false,
    content:
      template === "handover"
        ? "<h2>Shift overview</h2><p></p><h2>Changes made</h2><p></p><h2>Open issues</h2><p></p><h2>Next steps</h2><p></p>"
        : "<p></p>",
  };
}
export function findIPMatches(text) {
  const pattern =
    /(?<![\w:])(?:(?:\d{1,3}\.){3}\d{1,3}|(?:[a-fA-F0-9]{0,4}:){2,}[a-fA-F0-9:.]*)(?:\/\d{1,3})?(?![\w:])/g;
  return [...text.matchAll(pattern)].filter((match) => {
    const [host, prefix] = match[0].split("/");
    if (!ipaddr.isValid(host)) return false;
    const address = ipaddr.parse(host);
    if (address.kind() === "ipv4" && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host))
      return false;
    return (
      prefix === undefined ||
      Number(prefix) <= (address.kind() === "ipv4" ? 32 : 128)
    );
  });
}
export function validIPs(text) {
  return [...new Set(findIPMatches(text).map((match) => match[0]))];
}
export function summarize(text) {
  const lines = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const sentences = lines
    .flatMap((s) => s.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .filter(
      (s) => s.length > 35 && !s.startsWith("<") && !s.startsWith("Figure "),
    );
  const ranked = sentences
    .map((s, i) => ({
      s,
      i,
      score:
        (
          s.match(
            /network|verify|confirm|must|should|configure|address|gateway|important|backup|before|review|issue|connect/gi,
          ) || []
        ).length + Math.min(s.length / 120, 1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .sort((a, b) => a.i - b.i);
  return (
    ranked.map((x) => x.s).join("\n\n") ||
    (text.trim() ? text.trim().slice(0, 600) : "")
  );
}
