// Web Worker for Spell Check Suggestions
importScripts('libs/typo.js');

let dictionary = null;

// Initialize
// We need to fetch the dictionary files. 
// Since we are in a worker, we can use fetch or XMLHttpRequest.
// However, the main thread already loads them for the synchronous check.
// We can either fetch them again or have the main thread pass the content.
// Passing content is cleaner to avoid double network requests (though they might be cached).
// Let's support an 'init' message.

self.onmessage = function (e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':
            try {
                const { affData, dicData } = payload;
                dictionary = new Typo("en_US", affData, dicData);
                self.postMessage({ type: 'ready' });
            } catch (err) {
                console.error("Worker dictionary init failed", err);
            }
            break;

        case 'suggest':
            if (!dictionary) return;
            const { word, id } = payload;
            // suggest is the slow sync operation
            const suggestions = dictionary.suggest(word, 3);
            self.postMessage({ type: 'suggestions', payload: { word, suggestions, id } });
            break;
    }
};
