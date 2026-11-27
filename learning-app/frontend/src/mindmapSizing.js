const MAX_NODE_WIDTH = 440;
const LINE_HEIGHT = 16;
const LABEL_STYLES = {
  l1: { font: '700 12px system-ui', minWidth: 180, minHeight: 36, padding: 34 },
  l2: { font: '600 11.5px system-ui', minWidth: 148, minHeight: 30, padding: 32 },
  l3: { font: '500 11px system-ui', minWidth: 220, minHeight: 26, padding: 26 },
  root: { font: '400 11px system-ui', minWidth: 196, minHeight: 26, padding: 36 },
};

function wrapLabel(text, maxWidth, measure) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/u)) {
    const withWord = line ? `${line} ${word}` : word;
    if (measure(withWord) <= maxWidth) {
      line = withWord;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (measure(word) <= maxWidth) continue;

    line = '';
    const graphemes = new Intl.Segmenter().segment(word);
    for (const { segment } of graphemes) {
      if (line && measure(line + segment) > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += segment;
    }
  }
  return [...lines, line];
}

export function sizeMindmap(branches, rootLines, getLeafText) {
  const context = document.createElement('canvas').getContext('2d');
  const sizes = new Map();
  function sizeLabel(text, kind) {
    const key = `${kind}:${text}`;
    if (sizes.has(key)) return sizes.get(key);

    const { font, minWidth, minHeight, padding } = LABEL_STYLES[kind];
    context.font = font;
    const measure = value => context.measureText(value).width;
    const naturalWidth = Math.ceil(measure(text)) + padding;
    const lines = naturalWidth > MAX_NODE_WIDTH
      ? wrapLabel(text, MAX_NODE_WIDTH - padding, measure)
      : [text];
    const size = {
      label: lines.join('\n'),
      width: Math.max(minWidth, Math.min(MAX_NODE_WIDTH, naturalWidth)),
      height: minHeight + (lines.length - 1) * LINE_HEIGHT,
    };
    sizes.set(key, size);
    return size;
  }

  const root = rootLines.map(text => sizeLabel(text, 'root'));
  const rootWidth = Math.max(196, ...root.map(line => line.width));
  const rootHeight = 114 + root.reduce((extra, line) => extra + line.height - LABEL_STYLES.root.minHeight, 0);
  const columnWidths = { l1: 180, l2: 148, l3: 220 };
  for (const branch of branches) {
    columnWidths.l1 = Math.max(columnWidths.l1, sizeLabel(branch.label, 'l1').width);
    for (const group of branch.subGroups) {
      columnWidths.l2 = Math.max(columnWidths.l2, sizeLabel(group.label, 'l2').width);
      for (const leaf of group.leaves) {
        columnWidths.l3 = Math.max(columnWidths.l3, sizeLabel(getLeafText(leaf), 'l3').width);
      }
    }
  }

  const offsets = { l1: rootWidth / 2 + 82 };
  offsets.l2 = offsets.l1 + columnWidths.l1 + 58;
  offsets.l3 = offsets.l2 + columnWidths.l2 + 52;
  const centerX = Math.ceil(Math.max(940, offsets.l3 + columnWidths.l3 + 64));
  function nodeBox(text, kind, side) {
    const size = sizeLabel(text, kind);
    const x = side === 'left' ? centerX - offsets[kind] - size.width : centerX + offsets[kind];
    return { ...size, x };
  }

  return { nodeBox, centerX, rootWidth, rootHeight, rootLabels: root.map(line => line.label), canvasW: centerX * 2 };
}
