// Keep guide sections and illustrations intact when they fit on a PDF page.
export function paginateCanvas(totalHeight, pageHeight, blocks) {
  const pages = [];
  for (let start = 0; start < totalHeight;) {
    let end = Math.min(start + pageHeight, totalHeight);
    let crossing;
    do {
      crossing = blocks.find(
        (block) =>
          block.top > start &&
          block.top < end &&
          block.bottom > end &&
          block.bottom - block.top <= pageHeight,
      );
      if (crossing) end = crossing.top;
    } while (crossing);
    pages.push({ start, height: end - start });
    start = end;
  }
  return pages;
}
