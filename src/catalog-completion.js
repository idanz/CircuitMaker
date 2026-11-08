/** Catalog-only completion UI. The same renderer and icon manifest serve both
 * languages; Pyright/TypeScript continue to own all other completion contexts.
 */
export function attachCatalogCompletion(monaco, editor, language, catalog) {
  const node = document.createElement('div'); node.className = 'signal-suggestions'; node.hidden = true;
  node.setAttribute('role', 'listbox'); node.setAttribute('aria-label', 'Signal suggestions');
  let context = null, choices = [], active = 0, open = false;
  const widget = {
    getId: () => `circuitmaker-catalog-${language}`,
    getDomNode: () => node,
    getPosition: () => open ? { position: editor.getPosition(), preference: [monaco.editor.ContentWidgetPositionPreference.BELOW, monaco.editor.ContentWidgetPositionPreference.ABOVE] } : null,
    allowEditorOverflow: true,
    suppressMouseDown: true,
  };
  editor.addContentWidget(widget);
  const close = () => {
    if (!open) return;
    open = false; node.hidden = true; editor.layoutContentWidget(widget);
    editor.updateOptions({ quickSuggestions: { other: true, comments: false, strings: false }, suggestOnTriggerCharacters: true });
  };
  const currentContext = () => {
    if (editor.getOption(monaco.editor.EditorOption.readOnly)) return null;
    const p = editor.getPosition(); if (!p) return null;
    const text = editor.getModel().getLineContent(p.lineNumber).slice(0, p.column - 1);
    if (/^\s*(#|\/\/)/.test(text)) return null;
    const match = /\b(Items|Fluids|Virtual|Entities|Recipes|SpaceLocations|AsteroidChunks|Qualities)\.([\w]*)$/.exec(text);
    return match ? { group: match[1], prefix: match[2], position: p } : null;
  };
  const choose = index => {
    const c = currentContext(), item = choices[index]; if (!c || !item) return;
    editor.executeEdits('signal-catalog', [{ range: { startLineNumber: c.position.lineNumber, endLineNumber: c.position.lineNumber, startColumn: c.position.column - c.prefix.length, endColumn: c.position.column }, text: item[language], forceMoveMarkers: true }]);
    close(); editor.focus();
  };
  function render() {
    node.replaceChildren();
    const heading = document.createElement('div'); heading.className = 'signal-suggestions-heading'; heading.textContent = `${context.group} · ${choices.length}${choices.length === 60 ? '+' : ''} signals`; node.append(heading);
    const list = document.createElement('div'); list.className = 'signal-suggestions-list';
    choices.forEach((item, index) => {
      const row = document.createElement('div'); row.className = `signal-suggestion${index === active ? ' selected' : ''}`;
      row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(index === active));
      row.title = `${item.name} (${item.type})`;
      const icon = document.createElement('span'); icon.className = 'signal-thumbnail'; icon.setAttribute('aria-hidden', 'true');
      if (!item.icons.length) { icon.textContent = '◇'; icon.classList.add('missing'); }
      for (const layer of item.icons) {
        const image = document.createElement('span');
        const scale = (layer.scale ?? 32 / layer.size) * 24 / 32;
        image.style.cssText = `width:${layer.size * scale}px;height:${layer.size * scale}px;background-image:url("${layer.src}");background-size:${layer.width * scale}px ${layer.height * scale}px;left:calc(50% + ${(layer.shift[0] ?? 0) * .75}px);top:calc(50% + ${(layer.shift[1] ?? 0) * .75}px)`;
        icon.append(image);
      }
      const name = document.createElement('span'); name.className = 'signal-suggestion-name'; name.textContent = item[language];
      const kind = document.createElement('span'); kind.className = 'signal-suggestion-type'; kind.textContent = item.type;
      row.append(icon, name, kind);
      row.addEventListener('mousedown', event => { event.preventDefault(); choose(index); });
      list.append(row);
    });
    node.append(list);
    const hint = document.createElement('div'); hint.className = 'signal-suggestions-hint'; hint.textContent = '↑ ↓ to explore   ↵ to insert   Esc to close'; node.append(hint);
    list.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
    node.hidden = false; editor.layoutContentWidget(widget);
  }
  function update(force = false) {
    if (!editor.hasTextFocus() && !force) { close(); return; }
    const c = currentContext(); if (!c) { close(); return; }
    context = c;
    const needle = c.prefix.toLowerCase();
    choices = catalog[c.group].filter(item => item[language].toLowerCase().includes(needle)).sort((a, b) => Number(!a[language].toLowerCase().startsWith(needle)) - Number(!b[language].toLowerCase().startsWith(needle)) || a[language].localeCompare(b[language])).slice(0, 60);
    if (!choices.length) { close(); return; }
    active = Math.min(active, choices.length - 1); open = true;
    editor.updateOptions({ quickSuggestions: false, suggestOnTriggerCharacters: false });
    editor.trigger('signal-catalog', 'hideSuggestWidget');
    render();
  }
  editor.onDidChangeModelContent(() => { active = 0; update(); });
  editor.onDidChangeCursorPosition(() => update());
  editor.onDidBlurEditorWidget(close);
  const keydown = event => {
    if (!editor.hasTextFocus()) return;
    if ((event.ctrlKey || event.metaKey) && event.code === 'Space' && currentContext()) {
      event.preventDefault(); event.stopImmediatePropagation(); update(true); return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); event.stopImmediatePropagation();
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length; render();
    } else if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); event.stopImmediatePropagation(); choose(active); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
  };
  editor.getDomNode().addEventListener('keydown', keydown, true);
  return { dispose() { editor.getDomNode()?.removeEventListener('keydown', keydown, true); editor.removeContentWidget(widget); node.remove(); } };
}
