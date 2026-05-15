(async () => {
    'use strict';

    let selectedLinks = new Set();
    const CLIPBOARD_KEY = 'tmk_internal_clipboard';
    let lastHandle = '';

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

    function readClipboard() {
        try {
            const raw = localStorage.getItem(CLIPBOARD_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function appendToClipboard(items) {
        const currentItems = readClipboard();
        const newSet = new Set([...currentItems, ...items]);
        const merged = Array.from(newSet);
        try {
            localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(merged));
            return merged;
        } catch (e) {
            console.error("Failed to save to clipboard:", e);
            return currentItems;
        }
    }

    function clearClipboard() {
        try {
            localStorage.removeItem(CLIPBOARD_KEY);
        } catch (e) {
            console.error("Failed to clear clipboard:", e);
        }
    }

    function showNotification(msg, color = '#fff', duration = 3000) {
        let container = document.getElementById('tmk-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'tmk-notification-container';
            Object.assign(container.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: 1000000,
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
        try {
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
                a.onclick = (e) => {
                    e.preventDefault();
                    onClick();
                };
                return a;
            };

            box.appendChild(createLink('Copy Selected (Clear Memory First)', '#0ff', () => {
                if (!confirm('Are you sure you want to clear memory and copy selected?')) return;
                const arr = Array.from(selectedLinks);
                clearClipboard();
                const updated = appendToClipboard(arr);
                navigator.clipboard.writeText(updated.join('\n')).catch(() => {});
                showNotification(`Copied ${arr.length} selected link(s)!\n(Memory cleared first)`, '#4ecdc4');
            }));

            box.appendChild(createLink('Copy Selected (Append)', '#ff0', () => {
                const arr = Array.from(selectedLinks);
                const updated = appendToClipboard(arr);
                navigator.clipboard.writeText(updated.join('\n')).catch(() => {});
                showNotification(`Appended ${arr.length} link(s).\nTotal in memory: ${updated.length}`, '#4ecdc4');
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
                clearClipboard();
                showNotification('Internal clipboard cleared!', '#95e1d3');
            }));

            const info = document.createElement('span');
            info.style.fontSize = '12px';
            info.textContent = `Selected: ${selectedLinks.size}`;
            box.appendChild(info);
        } catch (e) {
            console.error("Tiktok UI: refreshMultiSelectUI failed", e);
        }
    }

    function injectCheckboxes() {
        try {
            const handle = getProfileHandle();
            if (handle !== lastHandle) {
                lastHandle = handle;
                selectedLinks.clear();
                refreshMultiSelectUI();
            }

            if (!isProfilePage()) {
                document.querySelectorAll('.tmk-custom-checkbox, .tmk-row-select-checkbox').forEach(el => el.remove());
                if (selectedLinks.size > 0) {
                    selectedLinks.clear();
                    refreshMultiSelectUI();
                }
                return;
            }

            const links = Array.from(document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]'));

            links.forEach(a => {
                const href = a.href.split('?')[0];
                let cb = a.querySelector('.tmk-custom-checkbox');
                let rowCb = a.querySelector('.tmk-row-select-checkbox');

                if (cb) {
                    const shouldBeChecked = selectedLinks.has(href);
                    if (cb.checked !== shouldBeChecked) cb.checked = shouldBeChecked;
                }

                if (getComputedStyle(a).position === 'static') {
                    a.style.position = 'relative';
                }

                if (!cb) {
                    const leftWrapper = document.createElement('div');
                    Object.assign(leftWrapper.style, {
                        position: 'absolute',
                        top: '5px',
                        left: '5px',
                        zIndex: '10000',
                        pointerEvents: 'auto'
                    });
                    cb = document.createElement('input');
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
                }

                if (!rowCb) {
                    const rightWrapper = document.createElement('div');
                    Object.assign(rightWrapper.style, {
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        zIndex: '10000',
                        pointerEvents: 'auto'
                    });
                    rowCb = document.createElement('input');
                    rowCb.type = 'checkbox';
                    rowCb.className = 'tmk-row-select-checkbox';
                    rowCb.style.cssText = 'transform: scale(2) !important; cursor: pointer !important; width: 16px !important; height: 16px !important; margin: 0 !important;';

                    ['click','mousedown','mouseup'].forEach(evt => rowCb.addEventListener(evt, e => e.stopPropagation(), { capture: true }));
                    rowCb.addEventListener('change', () => {
                        const currentRect = a.getBoundingClientRect();
                        const currentTop = currentRect.top + window.scrollY;

                        const allLinks = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
                        allLinks.forEach(otherA => {
                            const otherRect = otherA.getBoundingClientRect();
                            const otherTop = otherRect.top + window.scrollY;

                            if (Math.abs(otherTop - currentTop) < 15) {
                                const otherCb = otherA.querySelector('.tmk-custom-checkbox');
                                if (otherCb) {
                                    const otherHref = otherA.href.split('?')[0];
                                    otherCb.checked = rowCb.checked;
                                    if (rowCb.checked) selectedLinks.add(otherHref);
                                    else selectedLinks.delete(otherHref);
                                }
                                const otherRowCb = otherA.querySelector('.tmk-row-select-checkbox');
                                if (otherRowCb) otherRowCb.checked = rowCb.checked;
                            }
                        });
                        refreshMultiSelectUI();
                    });
                    rightWrapper.appendChild(rowCb);
                    a.appendChild(rightWrapper);
                }

                // Sync row checkbox state based on selection
                const currentTop = a.getBoundingClientRect().top + window.scrollY;
                const rowLinks = links.filter(l => Math.abs((l.getBoundingClientRect().top + window.scrollY) - currentTop) < 15);
                const allSelected = rowLinks.length > 0 && rowLinks.every(l => selectedLinks.has(l.href.split('?')[0]));
                if (rowCb.checked !== allSelected) rowCb.checked = allSelected;

                if (!a._tmk_click_listener_added) {
                    a._tmk_click_listener_added = true;
                    a.addEventListener('click', e => {
                        if (isProfilePage() && selectedLinks.size > 0) {
                            const targetCb = a.querySelector('.tmk-custom-checkbox');
                            if (targetCb && e.target !== targetCb && !targetCb.contains(e.target)) {
                                e.preventDefault();
                                e.stopPropagation();
                                targetCb.checked = !targetCb.checked;
                                targetCb.dispatchEvent(new Event('change'));
                            }
                        }
                    }, { capture: true });
                }
            });
        } catch (e) {
            console.error("Tiktok UI: injectCheckboxes failed", e);
        }
    }

    function init() {
        if (!document.body) {
            setTimeout(init, 100);
            return;
        }

        window.addEventListener('click', e => {
            const anchor = e.target.closest('a');
            if (anchor && isProfilePage() && selectedLinks.size > 0) {
                const href = anchor.getAttribute('href');
                if (!href || href === '#' || href.startsWith('javascript:')) return;
                if (anchor.closest('#tmk-multi-select-ui')) return;
                if (e.target.closest('.tmk-custom-checkbox, .tmk-row-select-checkbox')) return;

                if (!confirm('You have videos selected. Are you sure you want to leave this page?')) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }
        }, true);

        const observer = new MutationObserver(() => {
            injectCheckboxes();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setInterval(injectCheckboxes, 1000);
        injectCheckboxes();
    }

    init();
})();
