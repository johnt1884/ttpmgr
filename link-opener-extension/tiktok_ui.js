(async () => {
    'use strict';

    // --- High Stability Controller Layer ---
    const selectedLinks = new Set();
    const processedNodes = new WeakSet();
    const CLIPBOARD_KEY = 'tmk_internal_clipboard';
    let lastHandle = '';

    // --- State Management ---
    function getProfileHandle() {
        const match = location.pathname.match(/^\/(@[^/]+)/);
        return match ? match[1] : null;
    }

    function isProfilePage() {
        return location.pathname.startsWith('/@') &&
               !location.pathname.includes('/video/') &&
               !location.pathname.includes('/photo/') &&
               !location.pathname.includes('/live');
    }

    function syncStateOnNavigation() {
        const handle = getProfileHandle();
        if (handle !== lastHandle) {
            lastHandle = handle;
            selectedLinks.clear();
            refreshMultiSelectUI();
        }
    }

    // --- Centralized UI Management ---
    function showNotification(msg, color = '#fff', duration = 3000) {
        let container = document.getElementById('tmk-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'tmk-notification-container';
            Object.assign(container.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: 2000000,
                maxWidth: '300px',
                fontSize: '14px',
                lineHeight: '1.3'
            });
            document.body.appendChild(container);
        }
        const note = document.createElement('div');
        Object.assign(note.style, {
            padding: '10px 15px',
            background: 'rgba(0,0,0,0.85)',
            color: color,
            borderRadius: '6px',
            marginBottom: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            opacity: '0',
            transform: 'translateY(20px)',
            transition: 'opacity 0.3s ease, transform 0.3s ease'
        });
        note.textContent = msg;
        container.appendChild(note);
        requestAnimationFrame(() => {
            note.style.opacity = '1';
            note.style.transform = 'translateY(0)';
        });
        setTimeout(() => {
            note.style.opacity = '0';
            note.style.transform = 'translateY(20px)';
            setTimeout(() => note.remove(), 300);
        }, duration);
    }

    function refreshMultiSelectUI() {
        let box = document.getElementById('tmk-multi-select-ui');
        if (selectedLinks.size === 0 || !isProfilePage()) {
            if (box) box.remove();
            return;
        }

        if (!box) {
            box = document.createElement('div');
            box.id = 'tmk-multi-select-ui';
            Object.assign(box.style, {
                position: 'fixed',
                top: '160px',
                right: '20px',
                padding: '10px 20px',
                background: 'rgba(0,0,0,0.75)',
                color: '#fff',
                fontSize: '14px',
                zIndex: 99999,
                borderRadius: '8px',
                boxShadow: '0 0 12px rgba(0,0,0,0.6)',
                maxWidth: '300px',
                lineHeight: '1.3',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
            });
            document.body.appendChild(box);
        }

        box.innerHTML = '';
        const createLink = (text, color, onClick) => {
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = text;
            a.style.color = color;
            a.style.textDecoration = 'none';
            a.onclick = (e) => { e.preventDefault(); onClick(); };
            return a;
        };

        const updateSystemClipboard = (arr) => {
            try {
                localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(arr));
                navigator.clipboard.writeText(arr.join('\n')).catch(() => {});
            } catch (e) { console.error("Clipboard sync failed", e); }
        };

        box.appendChild(createLink('Copy Selected (Clear Memory First)', '#0ff', () => {
            if (!confirm('Are you sure you want to clear memory and copy selected?')) return;
            const arr = Array.from(selectedLinks);
            updateSystemClipboard(arr);
            showNotification(`Copied ${arr.length} selected link(s)!\n(Memory cleared first)`, '#4ecdc4');
        }));

        box.appendChild(createLink('Copy Selected (Append)', '#ff0', () => {
            const current = JSON.parse(localStorage.getItem(CLIPBOARD_KEY) || '[]');
            const merged = Array.from(new Set([...current, ...selectedLinks]));
            updateSystemClipboard(merged);
            showNotification(`Appended ${selectedLinks.size} link(s).\nTotal in memory: ${merged.length}`, '#4ecdc4');
        }));

        box.appendChild(createLink('Clear Selection', '#f80', () => {
            selectedLinks.clear();
            document.querySelectorAll('.tmk-custom-checkbox').forEach(cb => cb.checked = false);
            document.querySelectorAll('.tmk-row-select-checkbox').forEach(cb => cb.checked = false);
            refreshMultiSelectUI();
            showNotification('Selection cleared!', '#95e1d3');
        }));

        box.appendChild(createLink('Clear Memory', '#f44', () => {
            if (!confirm('Are you sure you want to clear memory?')) return;
            localStorage.removeItem(CLIPBOARD_KEY);
            showNotification('Internal clipboard cleared!', '#95e1d3');
        }));

        const info = document.createElement('span');
        info.style.fontSize = '12px';
        info.textContent = `Selected: ${selectedLinks.size}`;
        box.appendChild(info);
    }

    // --- Injection Logic ---
    function injectIntoVideoCard(card) {
        if (processedNodes.has(card)) {
            // Re-sync visual state in case of React reuse
            const a = card.querySelector('a[href*="/video/"], a[href*="/photo/"]');
            if (a) {
                const href = a.href.split('?')[0];
                const cb = card.querySelector('.tmk-custom-checkbox');
                if (cb) cb.checked = selectedLinks.has(href);
            }
            return;
        }
        processedNodes.add(card);

        const a = card.querySelector('a[href*="/video/"], a[href*="/photo/"]');
        if (!a) return;

        const href = a.href.split('?')[0];
        if (getComputedStyle(a).position === 'static') a.style.position = 'relative';

        // Individual Checkbox
        const leftWrapper = document.createElement('div');
        Object.assign(leftWrapper.style, { position: 'absolute', top: '5px', left: '5px', zIndex: '10000' });
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'tmk-custom-checkbox';
        cb.style.cssText = 'transform: scale(2) !important; cursor: pointer !important; width: 16px !important; height: 16px !important; margin: 0 !important;';
        cb.checked = selectedLinks.has(href);
        ['click','mousedown','mouseup'].forEach(evt => cb.addEventListener(evt, e => e.stopPropagation(), { capture: true }));
        cb.addEventListener('change', () => {
            if (cb.checked) selectedLinks.add(href);
            else selectedLinks.delete(href);
            refreshMultiSelectUI();
        });
        leftWrapper.appendChild(cb);
        a.appendChild(leftWrapper);

        // Row Selection Checkbox
        const rightWrapper = document.createElement('div');
        Object.assign(rightWrapper.style, { position: 'absolute', top: '5px', right: '5px', zIndex: '10000' });
        const rowCb = document.createElement('input');
        rowCb.type = 'checkbox';
        rowCb.className = 'tmk-row-select-checkbox';
        rowCb.style.cssText = 'transform: scale(2) !important; cursor: pointer !important; width: 16px !important; height: 16px !important; margin: 0 !important;';
        ['click','mousedown','mouseup'].forEach(evt => rowCb.addEventListener(evt, e => e.stopPropagation(), { capture: true }));
        rowCb.addEventListener('change', () => {
            // Find sibling items in the same grid row using offsetTop (robust layout primitive)
            const myTop = card.offsetTop;
            const container = card.closest('[class*="DivItemContainer"], [data-e2e="user-post-item-list"]') || document;
            const siblings = container.querySelectorAll('[class*="DivItemContainerV2"], [data-e2e="user-post-item"]');

            siblings.forEach(sib => {
                if (Math.abs(sib.offsetTop - myTop) < 10) {
                    const sibA = sib.querySelector('a[href*="/video/"], a[href*="/photo/"]');
                    const sibCb = sib.querySelector('.tmk-custom-checkbox');
                    const sibRowCb = sib.querySelector('.tmk-row-select-checkbox');
                    if (sibA && sibCb) {
                        const sibHref = sibA.href.split('?')[0];
                        sibCb.checked = rowCb.checked;
                        if (rowCb.checked) selectedLinks.add(sibHref);
                        else selectedLinks.delete(sibHref);
                    }
                    if (sibRowCb) sibRowCb.checked = rowCb.checked;
                }
            });
            refreshMultiSelectUI();
        });
        rightWrapper.appendChild(rowCb);
        a.appendChild(rightWrapper);
    }

    // --- Initialization & Observation ---
    function init() {
        if (!document.body) { setTimeout(init, 50); return; }

        // Event Delegation for card clicks (toggling checkbox)
        document.body.addEventListener('click', (e) => {
            if (!isProfilePage() || selectedLinks.size === 0) return;
            const card = e.target.closest('[class*="DivItemContainerV2"], [data-e2e="user-post-item"]');
            if (!card || e.target.closest('.tmk-custom-checkbox, .tmk-row-select-checkbox, #tmk-multi-select-ui')) return;

            const cb = card.querySelector('.tmk-custom-checkbox');
            if (cb) {
                e.preventDefault();
                e.stopPropagation();
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change'));
            }
        }, { capture: true });

        // Mutation Observer for newly added cards
        const observer = new MutationObserver((mutations) => {
            syncStateOnNavigation();
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    // Check if node is a card or contains cards
                    if (node.matches('[class*="DivItemContainerV2"], [data-e2e="user-post-item"]')) {
                        injectIntoVideoCard(node);
                    } else {
                        node.querySelectorAll('[class*="DivItemContainerV2"], [data-e2e="user-post-item"]').forEach(injectIntoVideoCard);
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Initial scan (only once)
        document.querySelectorAll('[class*="DivItemContainerV2"], [data-e2e="user-post-item"]').forEach(injectIntoVideoCard);

        // Background interval only for re-syncing handle state (inexpensive)
        setInterval(syncStateOnNavigation, 1000);
    }

    init();
})();
