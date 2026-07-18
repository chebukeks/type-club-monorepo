const { Schema, Fragment, Slice } = require('prosemirror-model');
const { tableNodes } = require('prosemirror-tables');
const { bulletList, orderedList, listItem } = require('prosemirror-schema-list');
const { EditorState, TextSelection } = require('prosemirror-state');

const tableNodeSpecs = tableNodes({
  tableGroup: 'block', cellContent: 'block+',
  cellAttributes: { alignment: { default: null, getFromDOM() { return null }, setDOMAttr() {} } },
});

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', parseDOM: [{ tag: 'p' }], toDOM() { return ['p', 0] } },
    heading: { attrs: { level: { default: 1 } }, content: 'inline*', group: 'block', defining: true, parseDOM: [{ tag: 'h1' }], toDOM() { return ['h1', 0] } },
    code_block: { content: 'text*', marks: '', group: 'block', code: true, defining: true, attrs: { params: { default: '' } }, parseDOM: [{ tag: 'pre' }], toDOM() { return ['pre', ['code', 0]] } },
    horizontal_rule: { group: 'block', parseDOM: [{ tag: 'hr' }], toDOM() { return ['hr'] } },
    ...tableNodeSpecs,
    bullet_list: { ...bulletList, content: 'list_item+', group: 'block' },
    ordered_list: { ...orderedList, content: 'list_item+', group: 'block' },
    list_item: { ...listItem, content: 'paragraph block*', attrs: { checked: { default: null } }, parseDOM: [{ tag: 'li' }], toDOM() { return ['li', 0] } },
    image: { attrs: { src: {} }, group: 'block', draggable: true, parseDOM: [{ tag: 'figure' }], toDOM(n) { return ['figure', ['img', { src: n.attrs.src }]] } },
    math_inline: { inline: true, content: 'text*', group: 'inline' },
    math_block: { content: 'text*', group: 'block', code: true, defining: true },
    text: { group: 'inline' },
    hard_break: { inline: true, group: 'inline', selectable: false },
  },
  marks: {
    strong: { parseDOM: [{ tag: 'b' }], toDOM() { return ['strong', 0] } },
    em: { parseDOM: [{ tag: 'i' }], toDOM() { return ['em', 0] } },
    code: { parseDOM: [{ tag: 'code' }], toDOM() { return ['code', 0] } },
  },
});

// ===== pastePlugin logic =====
const BLOCK_PASTE_NODES = new Set(['table', 'image', 'code_block', 'math_block', 'horizontal_rule']);
function all(pred) {
  let ok = true;
  this.forEach(n => { if (!pred(n)) ok = false; });
  return ok;
}
const isBlockSlice = s => s.openStart === 0 && s.openEnd === 0 && s.content.childCount > 0 && all.call(s.content, c => BLOCK_PASTE_NODES.has(c.type.name));
const isClosedTextSlice = s => s.openStart === 0 && s.openEnd === 0 && s.content.childCount > 0 && all.call(s.content, c => c.isTextblock && !BLOCK_PASTE_NODES.has(c.type.name));
const transform = s => isClosedTextSlice(s) ? Slice.maxOpen(s.content) : s;

// Текст параграфа начинается с doc позиции 1 (para open at 0, text at 1)
const textPos = charOffset => 1 + charOffset;
const makeDoc = text => schema.node('doc', null, [schema.node('paragraph', null, text ? [schema.text(text)] : [])]);

let ok = 0, total = 0;
function check(label, result, expected) {
  total++;
  const pass = result === expected;
  if (pass) { ok++; console.log('  ✓', label); }
  else console.log('  ❌', label, '→', JSON.stringify(result), `(expected ${JSON.stringify(expected)})`);
  return pass;
}

// === Test helpers ===
function cutPaste(text, selS, selE) {
  let s = EditorState.create({ doc: makeDoc(text), schema });
  const from = textPos(selS), to = textPos(selE);
  const cut = TextSelection.create(s.doc, from, to).content();
  s = s.apply(s.tr.delete(from, to));
  s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, from)));
  return s.apply(s.tr.replaceSelection(transform(cut))).doc.textContent;
}

function pasteClosed(text, selS, selE, pasteSlice) {
  let s = EditorState.create({ doc: makeDoc(text), schema });
  const from = textPos(selS), to = textPos(selE);
  s = s.apply(s.tr.delete(from, to));
  s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, from)));
  return s.apply(s.tr.replaceSelection(transform(pasteSlice))).doc.textContent;
}

function blockInsert(text, selS, selE, blockNode) {
  let s = EditorState.create({ doc: makeDoc(text), schema });
  const from = textPos(selS), to = textPos(selE);
  s = s.apply(s.tr.delete(from, to));
  s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, from)));

  const {$head} = s.selection;
  let d = -1;
  for (let i = $head.depth; i >= 1; i--) {
    if (['paragraph','heading','code_block','math_block'].includes($head.node(i).type.name)) { d = i; break; }
  }
  if (d === -1) return { error: 'no depth' };
  const start = $head.before(d), end = $head.after(d);
  const isEmpty = $head.node(d).textContent.trim() === '';
  const slice = new Slice(Fragment.from(blockNode), 0, 0);
  if (!isBlockSlice(slice)) return { error: 'not block' };
  s = s.apply(isEmpty ? s.tr.replaceWith(start, end, slice.content) : s.tr.insert(end, slice.content));
  return s.doc.textContent;
}

function blockReplace(blockNode) {
  let s = EditorState.create({ doc: schema.node('doc', null, [schema.node('paragraph')]), schema });
  const {$head} = s.selection;
  let d = -1;
  for (let i = $head.depth; i >= 1; i--) {
    if (['paragraph','heading','code_block','math_block'].includes($head.node(i).type.name)) { d = i; break; }
  }
  const start = $head.before(d), end = $head.after(d);
  s = s.apply(s.tr.replaceWith(start, end, new Slice(Fragment.from(blockNode), 0, 0).content));
  return s.doc.textContent;
}

function makeTable() {
  const h1 = schema.nodes.table_header.create(null, schema.node('paragraph', null, [schema.text('A')]));
  const h2 = schema.nodes.table_header.create(null, schema.node('paragraph', null, [schema.text('B')]));
  const c1 = schema.nodes.table_cell.create(null, schema.node('paragraph', null, [schema.text('C')]));
  const c2 = schema.nodes.table_cell.create(null, schema.node('paragraph', null, [schema.text('D')]));
  return schema.nodes.table.create(null, [
    schema.nodes.table_row.create(null, [h1, h2]),
    schema.nodes.table_row.create(null, [c1, c2]),
  ]);
}

const table = makeTable();
const img = schema.node('image', { src: 'test.png' });
const cb = schema.node('code_block', { params: 'js' }, [schema.text("log('hi')")]);
const mb = schema.node('math_block', null, [schema.text('E=mc^2')]);
const hr = schema.node('horizontal_rule');

// ====================================
console.log('=== 1. Inline cut+paste ===');
check('1a: middle',     cutPaste('textbartext', 4, 7), 'textbartext');
check('1b: from start', cutPaste('abcdef', 0, 3), 'abcdef');
check('1c: from end',   cutPaste('abcdef', 3, 6), 'abcdef');
check('1d: select all', cutPaste('hello', 0, 5), 'hello');
check('1e: spaces',     cutPaste('hello world ok', 6, 11), 'hello world ok');

console.log('\n=== 2. Closed paragraph (triple click) → maxOpen → inline ===');
const closedPara = (t) => new Slice(Fragment.from(schema.node('paragraph', null, [schema.text(t)])), 0, 0);
// 2a: из "abcdef" удаляем "cd" (selS=2, selE=4) → "abef", вставляем "HI" → "abHIef"
check('2a: triple para middle', pasteClosed('abcdef', 2, 4, closedPara('HI')), 'abHIef');
check('2b: triple para cursor', pasteClosed('startend', 5, 5, closedPara('MID')), 'startMIDend');
check('2c: triple para texttext', pasteClosed('texttext', 4, 4, closedPara('FOO')), 'textFOOtext');

console.log('\n=== 3. Closed heading → maxOpen → as text ===');
const closedH = (t) => new Slice(Fragment.from(schema.node('heading', { level: 1 }, [schema.text(t)])), 0, 0);
// 3a: из "ABC" удаляем "B" (selS=1, selE=2) → "AC", вставляем "Title" → "ATitleC"
check('3a: heading merge', pasteClosed('ABC', 1, 2, closedH('Title')), 'ATitleC');
// 3b: из "beforeafter" удаляем selS=6, selE=6 (ничего, курсор) → вставляем "T" → "beforeTafter"
check('3b: heading cursor', pasteClosed('beforeafter', 6, 6, closedH('T')), 'beforeTafter');

console.log('\n=== 4. Block paste (insert after paragraph) ===');
check('4a: table after para', blockInsert('hellook', 5, 5, table), 'hellookABCD');
check('4b: table after para 2', blockInsert('abc', 1, 1, table), 'abcABCD');
check('4c: image after para', blockInsert('XY', 1, 1, img), 'XY');
check('4d: code after para', blockInsert('ab', 1, 1, cb), "ablog('hi')");
check('4e: math after para', blockInsert('x', 0, 0, mb), 'xE=mc^2');
check('4f: hr after para', blockInsert('test', 2, 2, hr), 'test');

console.log('\n=== 5. Block paste → empty paragraph → replace ===');
check('5a: table', blockReplace(table), 'ABCD');
check('5b: image', blockReplace(img), '');
check('5c: code',  blockReplace(cb), "log('hi')");
check('5d: math',  blockReplace(mb), 'E=mc^2');
check('5e: hr',    blockReplace(hr), '');

console.log('\n=== 6. Plain text (external) → default merge ===');
// 6a: из "abc" удаляем "b" (selS=1, selE=2) → "ac", вставляем "X" → "aXc"
check('6a: plain merge', pasteClosed('abc', 1, 2, closedPara('X')), 'aXc');

console.log(`\n=== Results: ${ok}/${total} passed ===`);
if (ok < total) process.exit(1);
