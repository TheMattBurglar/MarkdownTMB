const Editor = toastui.Editor;

// Initialize globals before editor/plugins
window.dictionary = null;
window.customDictionary = new Set();
window.suggestionCache = new Map();
window.spellWorker = new Worker('spell-worker.js');
window.menuUpdateCallback = null;

window.spellWorker.onmessage = function (e) {
    const { type, payload } = e.data;
    if (type === 'suggestions') {
        const { word, suggestions, id } = payload;
        window.suggestionCache.set(word, suggestions);

        // If the context menu is waiting for this word, update it
        if (window.menuUpdateCallback && window.menuUpdateCallback.word === word) {
            window.menuUpdateCallback.fn(suggestions);
            window.menuUpdateCallback = null;
        }
    }
};

// ProseMirror Spell Check Plugin
function spellCheckPlugin(context) {
    console.log("Initializing spellCheckPlugin with context:", Object.keys(context));

    try {
        const { pmState, pmView } = context;
        if (!pmState || !pmView) {
            console.warn("ProseMirror context (pmState/pmView) missing. Spell check disabled.");
            return {};
        }

        const { Plugin, PluginKey } = pmState;
        const { Decoration, DecorationSet } = pmView;

        if (!Plugin || !PluginKey || !Decoration || !DecorationSet) {
            console.warn("ProseMirror classes missing from context. Spell check disabled.");
            return {};
        }

        const spellCheckKey = new PluginKey("spellCheck");
        window.spellCheckKey = spellCheckKey; // Expose for external triggers

        function getSpellCheckDecorations(doc) {
            if (!window.dictionary) return DecorationSet.empty;

            const decorations = [];
            try {
                // Collect unique errors for pre-fetching
                const uniqueErrors = new Set();

                doc.descendants((node, pos) => {
                    if (node.isText) {
                        const text = node.text;
                        // Match words with straight or smart quotes
                        const regex = /[a-zA-Z'\u2018\u2019]+/g;
                        let match;
                        while ((match = regex.exec(text)) !== null) {
                            const rawWord = match[0];
                            // Strip leading/trailing quotes/apostrophes for the check
                            const cleanWord = rawWord.replace(/^['\u2018\u2019]+|['\u2018\u2019]+$/g, '');

                            if (cleanWord.length < 2) continue;

                            // Check with straight quotes if smart quotes are used, as dictionary likely uses straight
                            const checkWord = cleanWord.replace(/[\u2018\u2019]/g, "'");

                            if (!window.dictionary.check(checkWord) && !window.customDictionary.has(checkWord)) {
                                const from = pos + match.index;
                                const to = from + rawWord.length;
                                decorations.push(Decoration.inline(from, to, { class: 'spell-error' }));
                                uniqueErrors.add(checkWord);
                            }
                        }
                    }
                });

                // Prefetch suggestions for found errors
                if (uniqueErrors.size > 0 && window.spellWorker) {
                    uniqueErrors.forEach(word => {
                        if (!window.suggestionCache.has(word)) {
                            // Send to worker. Worker can handle parallel requests.
                            window.spellWorker.postMessage({
                                type: 'suggest',
                                payload: { word: word, id: Date.now() }
                            });
                            // Mark as pending in cache to avoid spamming worker? 
                            // Or just rely on worker processing speed.
                            // Ideally set a placeholder to avoid duplicate requests.
                            window.suggestionCache.set(word, null); // Pending
                        }
                    });
                }

                return DecorationSet.create(doc, decorations);
            } catch (err) {
                console.error("Error generating decorations:", err);
                return DecorationSet.empty;
            }
        }

        const plugin = new Plugin({
            key: spellCheckKey,
            state: {
                init(_, { doc }) {
                    return getSpellCheckDecorations(doc);
                },
                apply(tr, old, oldState, newState) {
                    // Update decorations if doc changed or if we explicitly trigger it
                    if (tr.docChanged || tr.getMeta(spellCheckKey)) {
                        return getSpellCheckDecorations(newState.doc);
                    }
                    return old.map(tr.mapping, tr.doc);
                }
            },
            props: {
                decorations(state) {
                    return this.getState(state);
                }
            }
        });

        return {
            markdownPlugins: [() => plugin]
        };

    } catch (e) {
        console.error("Critical error in spellCheckPlugin setup:", e);
        return {};
    }
}

const editor = new Editor({
    el: document.querySelector('#editor'),
    height: '100%',
    initialEditType: 'markdown',
    previewStyle: 'tab', // Default to Edit mode (Source view)
    usageStatistics: false,
    autofocus: true,
    plugins: [spellCheckPlugin],
    toolbarItems: [
        ['strike'],
        ['quote', 'ul', 'ol', 'task'],
        ['table', 'image', 'link']
    ]
});

// Spell check initialization
const spellStatus = document.getElementById('spell-status');

async function loadDictionary() {
    try {
        const affData = await fetch('libs/en_US.aff').then(r => r.text());
        const dicData = await fetch('libs/en_US.dic').then(r => r.text());
        window.dictionary = new Typo("en_US", affData, dicData);

        // Initialize worker dictionary
        if (window.spellWorker) {
            window.spellWorker.postMessage({
                type: 'init',
                payload: { affData, dicData }
            });
        }

        spellStatus.textContent = "Spell check ready";

        console.log("Dictionary loaded, spell check active.");

    } catch (e) {
        console.error("Failed to load dictionary", e);
        spellStatus.textContent = "Dictionary failed";
    }
}

loadDictionary();

// Legacy checkSpelling function removed/simplified as it's now handled by the plugin
// We keep the status update logic if needed, or rely on the visual feedback.
function checkSpelling() {
    // This function is now largely redundant for visual highlighting,
    // but we can keep it for the status bar count if desired.
    // For now, let's leave it empty or minimal to avoid conflict/overhead.
    if (!window.dictionary) return;

    // Optional: Update status text with count
    // We would need to scan the doc again or expose the plugin state.
    // Let's just update the status to "Ready" or similar.
}

// Visual Highlighting - Handled by Plugin now
function highlightErrors(typos) {
    // Deprecated
}

// Mode Toggle
// Zoom Logic
let currentZoom = 20;
const editorEl = document.getElementById('editor');

// Default Dark Mode
document.body.classList.add('dark-mode');

// Ensure editor starts in source-only mode visually if needed, though 'tab' previewStyle handles most of it.
editorEl.classList.add('mode-source-only');

function setZoom(size) {
    currentZoom = size;
    editorEl.style.setProperty('--editor-font-size', `${size}px`);
    // ToastUI might need a refresh to recalculate layout if font size changes drastically, 
    // but usually CSS variable is enough for inner content.
    // However, we might need to trigger a refresh for cursor positioning etc.
    editor.height('100%'); // Trigger resize check
}



// Menu Button Logic
const btnMenu = document.getElementById('btn-menu');
const dropdownContent = document.getElementById('dropdown-content');

btnMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownContent.classList.toggle('show');
    // Close other dropdowns
    document.getElementById('dropdown-cheatsheet').classList.remove('show');
});

// Cheatsheet Menu Logic
const btnCheatsheet = document.getElementById('btn-cheatsheet');
const dropdownCheatsheet = document.getElementById('dropdown-cheatsheet');

btnCheatsheet.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownCheatsheet.classList.toggle('show');
    // Close other dropdowns
    dropdownContent.classList.remove('show');
});


// Close dropdown when clicking outside
window.addEventListener('click', (e) => {
    if (!e.target.matches('.dropbtn')) {
        if (dropdownContent.classList.contains('show')) {
            dropdownContent.classList.remove('show');
        }
        if (dropdownCheatsheet.classList.contains('show')) {
            dropdownCheatsheet.classList.remove('show');
        }
    }
});

document.getElementById('menu-zoom-in').addEventListener('click', () => {
    setZoom(currentZoom + 2);
    // dropdownContent.classList.remove('show'); // Optional: close on click?
});

document.getElementById('menu-zoom-out').addEventListener('click', () => {
    if (currentZoom > 8) setZoom(currentZoom - 2);
});

// Mode Toggle
const modeToggle = document.getElementById('mode-toggle');
const modeLabel = document.getElementById('mode-label');

modeToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        // Switch to Split View (Preview)
        editor.changePreviewStyle('vertical');
        editorEl.classList.remove('mode-source-only');
        modeLabel.textContent = "Split View";
    } else {
        // Switch to Edit (Markdown / Source Only)
        editor.changePreviewStyle('tab');
        editorEl.classList.add('mode-source-only');
        modeLabel.textContent = "Edit";
    }
    // Force layout refresh 
    editor.eventManager.emit('refresh');
});

// Dark Mode Toggle
const darkModeToggle = document.getElementById('dark-mode-toggle');
// Ensure toggle state matches default (checked by default in HTML, but good to ensure sync)
if (document.body.classList.contains('dark-mode')) {
    darkModeToggle.checked = true;
}

darkModeToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    // Optional: Save preference
    // localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
});


// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedCheck = debounce(checkSpelling, 1000);

editor.on('change', debouncedCheck);

// Status element
const statusEl = document.createElement('div');
statusEl.style.position = 'fixed';
statusEl.style.bottom = '10px';
statusEl.style.right = '10px';
statusEl.style.background = 'rgba(0,0,0,0.7)';
statusEl.style.color = 'white';
statusEl.style.padding = '5px 10px';
statusEl.style.borderRadius = '5px';
statusEl.style.display = 'none';
statusEl.style.zIndex = '1000';
document.body.appendChild(statusEl);

function showStatus(msg, duration = 2000) {
    statusEl.textContent = msg;
    statusEl.style.display = 'block';
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, duration);
}

let currentFile = "untitled.md";
const filenameEl = document.getElementById('filename');

function updateFilename(name) {
    currentFile = name;
    // Show only the basename in the UI
    const basename = name.split(/[\\/]/).pop();
    filenameEl.textContent = basename;
}

// Save function
async function saveDocument() {
    const content = editor.getMarkdown();
    try {
        let fileToSave = currentFile;
        if (currentFile === "untitled.md") {
            // Request save path from backend
            const path = await window.saveFileDialog();
            if (!path) return; // Cancelled
            fileToSave = path;
            updateFilename(path);
        }

        // window.saveFile is bound from Go
        await window.saveFile(fileToSave, content);
        showStatus(`Saved to ${fileToSave}`);
    } catch (err) {
        showStatus(`Error saving: ${err}`);
        console.error(err);
    }
}

// Open function
async function openDocument() {
    try {
        const path = await window.openFileDialog();
        if (!path) return; // Cancelled

        const content = await window.readFile(path);
        editor.setMarkdown(content);
        updateFilename(path);
        showStatus(`Opened ${path}`);
    } catch (err) {
        showStatus(`Error opening: ${err}`);
        console.error(err);
    }
}

// Button listeners
// Button listeners
document.getElementById('menu-save').addEventListener('click', (e) => {
    e.preventDefault(); // Prevent link default
    saveDocument();
    dropdownContent.classList.remove('show');
});
document.getElementById('menu-open').addEventListener('click', (e) => {
    e.preventDefault();
    openDocument();
    dropdownContent.classList.remove('show');
});

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        saveDocument();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openDocument();
    }
    // Zoom shortcuts
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(currentZoom + 2);
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === '-')) {
        e.preventDefault();
        if (currentZoom > 8) setZoom(currentZoom - 2);
    }
}, { capture: true });

// Context Menu Logic
document.addEventListener('contextmenu', function (e) {
    if (!window.dictionary) return;

    // Remove existing menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) existingMenu.remove();

    // Get the word under the cursor
    let range;
    if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
    }

    if (!range) return;

    // Expand range to get the word
    const node = range.startContainer;
    const offset = range.startOffset;

    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent;
    let start = offset;
    let end = offset;

    // Include smart quotes in word boundary check
    while (start > 0 && /[a-zA-Z'\u2018\u2019]/.test(text[start - 1])) {
        start--;
    }
    while (end < text.length && /[a-zA-Z'\u2018\u2019]/.test(text[end])) {
        end++;
    }

    const rawWord = text.substring(start, end);
    // Strip leading/trailing quotes for the check
    const cleanWord = rawWord.replace(/^['\u2018\u2019]+|['\u2018\u2019]+$/g, '');

    if (!cleanWord || cleanWord.length < 2) return;

    const checkWord = cleanWord.replace(/[\u2018\u2019]/g, "'");

    // Only show menu if word is misspelled
    if (!window.dictionary.check(checkWord) && !window.customDictionary.has(checkWord)) {
        e.preventDefault(); // Prevent default browser menu

        // 1. Create and show menu IMMEDIATELY
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.visibility = 'hidden'; // Hide initially to calculate position
        document.body.appendChild(menu);

        // Header for status
        const statusItem = document.createElement('div');
        statusItem.className = 'context-menu-header';
        statusItem.textContent = 'Loading...';
        menu.appendChild(statusItem);

        // Calculate position immediately
        const menuRect = menu.getBoundingClientRect(); // will be small initially
        const windowHeight = window.innerHeight;
        let top = e.clientY;
        let left = e.clientX;

        // Simple check, might need readjustment after loading suggestions
        if (top + 150 > windowHeight) { // Assume max height 150px
            top = top - 150;
        }

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.visibility = 'visible';

        // Update logic for suggestions rendering
        const renderSuggestions = (suggestions) => {
            menu.innerHTML = '';
            if (suggestions && suggestions.length > 0) {
                suggestions.forEach(suggestion => {
                    const item = document.createElement('div');
                    item.className = 'context-menu-item';
                    item.textContent = suggestion;
                    item.onclick = () => {
                        const newRange = document.createRange();
                        newRange.setStart(node, start);
                        newRange.setEnd(node, end);

                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(newRange);

                        document.execCommand('insertText', false, suggestion);
                        menu.remove();
                    };
                    menu.appendChild(item);
                });
            } else {
                const item = document.createElement('div');
                item.className = 'context-menu-header';
                item.textContent = 'No suggestions';
                menu.appendChild(item);
            }

            const separator = document.createElement('div');
            separator.className = 'context-menu-separator';
            menu.appendChild(separator);

            const ignoreItem = document.createElement('div');
            ignoreItem.className = 'context-menu-item';
            ignoreItem.textContent = 'Add to Dictionary';
            ignoreItem.onclick = () => {
                window.customDictionary.add(checkWord);
                menu.remove();
                if (window.spellCheckKey) {
                    const tr = editor.getEditorElements().mdEditor.view.state.tr;
                    tr.setMeta(window.spellCheckKey, true);
                    editor.getEditorElements().mdEditor.view.dispatch(tr);
                }
            };
            menu.appendChild(ignoreItem);
        };

        // Close menu on click elsewhere
        const closeMenu = () => {
            menu.remove();
            document.removeEventListener('click', closeMenu);
            // Clear pending callback if any
            if (window.menuUpdateCallback && window.menuUpdateCallback.word === checkWord) {
                window.menuUpdateCallback = null;
            }
        };
        // Delay adding click listener slightly to avoid immediate close
        setTimeout(() => document.addEventListener('click', closeMenu), 50);

        // Check cache
        const cached = window.suggestionCache.get(checkWord);
        if (cached && Array.isArray(cached)) {
            // Already computed
            renderSuggestions(cached);
        } else {
            // Not computed or pending
            // Register callback for when it arrives
            window.menuUpdateCallback = {
                word: checkWord,
                fn: renderSuggestions
            };

            // If strictly null (pending), it is already being fetched.
            // If undefined (not in map), request it.
            if (cached === undefined) {
                window.spellWorker.postMessage({
                    type: 'suggest',
                    payload: { word: checkWord, id: Date.now() }
                });
                window.suggestionCache.set(checkWord, null); // Mark pending
            }
        }
    }
});

// Intercept links in Preview
document.body.addEventListener('click', (e) => {
    // Check if clicked element is a link or inside a link
    const link = e.target.closest('a');
    if (link && link.closest('.toastui-editor-contents')) {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href) {
            // Check if backend binding exists
            if (window.openExternalLink) {
                window.openExternalLink(href).catch(console.error);
            } else {
                console.warn("openExternalLink binding not found, referencing: " + href);
                // Fallback attempt (likely blocked by webview but worth a try if binding fails)
                // window.open(href, '_blank'); 
            }
        }
    }
});
