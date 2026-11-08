const palettes = {
  dark: {
    base: 'vs-dark', page: '#15171b', background: '#1c1f25', foreground: '#dce1e9',
    comment: '8793A5', keyword: 'BCA9E3', string: 'D7BC92', number: 'D6A090', type: '9CBDE6', delimiter: 'ADB4C1',
    line: '#8290a4', activeLine: '#c3cee0', highlight: '#252a34', cursor: '#a6bced', selection: '#364866', inactive: '#2c3545',
    guide: '#313843', activeGuide: '#59677d', widget: '#252a34', border: '#4a5260', selected: '#354764', scrollbar: '#8794a333',
  },
  light: {
    base: 'vs', page: '#f2f4f7', background: '#ffffff', foreground: '#263140',
    comment: '657084', keyword: '7A3E9D', string: '8F531A', number: '8B4D24', type: '235F8D', delimiter: '576477',
    line: '#758298', activeLine: '#334d72', highlight: '#f0f4f9', cursor: '#345f9f', selection: '#d1e1f8', inactive: '#e8edf5',
    guide: '#e2e7ef', activeGuide: '#a5b7d2', widget: '#f8fafc', border: '#b2bfd0', selected: '#dce6f5', scrollbar: '#64748b33',
  },
  forest: {
    base: 'vs-dark', page: '#151817', background: '#191e1b', foreground: '#cbd2c2',
    comment: '84977D', keyword: 'C3D699', string: 'CDB789', number: 'C49B83', type: 'A0C9B6', delimiter: '9AA892',
    line: '#7b8e70', activeLine: '#a9be91', highlight: '#232c22', cursor: '#c2da81', selection: '#3c5031', inactive: '#2d3d28',
    guide: '#2b372a', activeGuide: '#4a5c40', widget: '#232b23', border: '#49583d', selected: '#3b4d30', scrollbar: '#65775633',
  },
};

export function initializeThemes(monaco) {
  for (const [name, p] of Object.entries(palettes)) monaco.editor.defineTheme(`circuitmaker-${name}`, {
    base: p.base, inherit: true,
    rules: [
      {token:'comment',foreground:p.comment}, {token:'keyword',foreground:p.keyword},
      {token:'string',foreground:p.string}, {token:'number',foreground:p.number},
      {token:'type.identifier',foreground:p.type}, {token:'delimiter',foreground:p.delimiter},
    ],
    colors: {
      'editor.background':p.background, 'editor.foreground':p.foreground,
      'editorLineNumber.foreground':p.line, 'editorLineNumber.activeForeground':p.activeLine,
      'editor.lineHighlightBackground':p.highlight, 'editorCursor.foreground':p.cursor,
      'editor.selectionBackground':p.selection, 'editor.inactiveSelectionBackground':p.inactive,
      'editorIndentGuide.background1':p.guide, 'editorIndentGuide.activeBackground1':p.activeGuide,
      'editorWidget.background':p.widget, 'editorWidget.border':p.border,
      'editorSuggestWidget.background':p.widget, 'editorSuggestWidget.border':p.border,
      'editorSuggestWidget.selectedBackground':p.selected, 'editorSuggestWidget.foreground':p.foreground,
      'editorHoverWidget.background':p.widget, 'editorHoverWidget.border':p.border,
      'scrollbarSlider.background':p.scrollbar, 'scrollbarSlider.hoverBackground':p.scrollbar,
    },
  });
  const picker = document.querySelector('#theme-select');
  const apply = (name, save = false) => {
    if (!Object.hasOwn(palettes, name)) name = 'dark';
    document.documentElement.dataset.theme = name;
    document.querySelector('meta[name="theme-color"]').content = palettes[name].page;
    picker.value = name;
    monaco.editor.setTheme(`circuitmaker-${name}`);
    if (save) {
      try { localStorage.setItem('circuitmaker-theme:v1', name); }
      catch { /* Theme changes still apply for this session. */ }
    }
    return `circuitmaker-${name}`;
  };
  picker.addEventListener('change', () => apply(picker.value, true));
  addEventListener('storage', event => {
    if (event.key === 'circuitmaker-theme:v1') apply(event.newValue);
  });
  return apply(document.documentElement.dataset.theme);
}
