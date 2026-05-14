// -----------------------------
// STAGGERED NAVIGATION
// -----------------------------
(async () => {
    'use strict';

    function isContextValid() {
        try {
            return typeof chrome !== "undefined" && 
                   !!chrome.runtime && 
                   !!chrome.runtime.id && 
                   !!chrome.storage && 
                   !!chrome.storage.local;
        } catch (e) {
            return false;
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
                zIndex: 999999,
                maxWidth: '300px',
                fontSize: '14px',
                lineHeight: '1.3'
            });
            document.body.appendChild(container);
        }
        const note = document.createElement('div');
        Object.assign(note.style, {
            padding: '10px 15px',
            background: `rgba(0,0,0,0.85)`,
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

    function createForwardBtn() {
        if (!isContextValid()) return;
        const btn = document.createElement("button");
        btn.id = "stagger-forward-btn";
        btn.textContent = ">>";
        btn.title = "Progress to Next Link";
        btn.style.position = "fixed";
        btn.style.right = "20px";
        btn.style.top = "50%";
        btn.style.transform = "translateY(-50%)";
        btn.style.zIndex = "999999";
        btn.style.width = "50px";
        btn.style.height = "50px";
        btn.style.minWidth = "50px";
        btn.style.minHeight = "50px";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.fontSize = "20px";
        btn.style.background = "#000";
        btn.style.color = "#fff";
        btn.style.border = "2px solid #fff";
        btn.style.borderRadius = "50%";
        btn.style.boxSizing = "border-box";
        btn.style.cursor = "pointer";
        btn.style.opacity = "0.7";
        btn.style.transition = "opacity 0.2s, color 0.2s, border-color 0.2s";

        btn.onmouseover = () => btn.style.opacity = "1";
        btn.onmouseout = () => btn.style.opacity = "0.7";

        function updateState() {
            const selected = document.querySelectorAll(".tmk-custom-checkbox:checked");
            if (selected.length > 0) {
                btn.style.color = "yellow";
                btn.style.borderColor = "yellow";
                btn.title = "Add Link/s to List and Progress to Next Link";
            } else {
                btn.style.color = "#fff";
                btn.style.borderColor = "#fff";
                btn.title = "Progress to Next Link";
            }
        }

        // Poll for selection state since we can't easily listen to changes in another script's injected checkboxes
        const statePoll = setInterval(() => {
            if (!isContextValid()) {
                clearInterval(statePoll);
                return;
            }
            updateState();
        }, 500);

        btn.onclick = () => {
            if (!isContextValid()) return;
            const selected = document.querySelectorAll(".tmk-custom-checkbox:checked");
            if (selected.length > 0) {
                const urls = Array.from(selected).map(cb => {
                    const a = cb.closest('a') || cb.parentElement.querySelector('a');
                    return a ? a.href.split('?')[0] : null;
                }).filter(Boolean);

                if (urls.length > 0) {
                    try {
                        const CLIPBOARD_KEY = 'tmk_internal_clipboard';
                        const raw = localStorage.getItem(CLIPBOARD_KEY);
                        const currentItems = raw ? JSON.parse(raw) : [];
                        const newSet = new Set([...currentItems, ...urls]);
                        const merged = Array.from(newSet);
                        localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(merged));

                        navigator.clipboard.writeText(merged.join('\n')).catch(() => {});

                        const appendedCount = urls.length;
                        const totalCount = merged.length;
                        localStorage.setItem('stagger_append_notify', JSON.stringify({
                            appended: appendedCount,
                            total: totalCount
                        }));
                    } catch (e) {
                        console.error("Stagger Nav: Failed to append to clipboard", e);
                    }
                }
            }
            if (isContextValid()) {
                chrome.runtime.sendMessage({ type: "NEXT_STAGGERED" });
            }
        };

        document.body.appendChild(btn);

        // Pause/Play button
        const pauseBtn = document.createElement("button");
        pauseBtn.id = "stagger-pause-btn";
        pauseBtn.title = "Pause/Resume Automatic Link Progression";
        pauseBtn.style.position = "fixed";
        pauseBtn.style.right = "20px";
        pauseBtn.style.top = "calc(50% + 60px)";
        pauseBtn.style.transform = "translateY(-50%)";
        pauseBtn.style.zIndex = "999999";
        pauseBtn.style.width = "50px";
        pauseBtn.style.height = "50px";
        pauseBtn.style.minWidth = "50px";
        pauseBtn.style.minHeight = "50px";
        pauseBtn.style.display = "flex";
        pauseBtn.style.alignItems = "center";
        pauseBtn.style.justifyContent = "center";
        pauseBtn.style.fontSize = "20px";
        pauseBtn.style.background = "#000";
        pauseBtn.style.color = "#fff";
        pauseBtn.style.border = "2px solid #fff";
        pauseBtn.style.borderRadius = "50%";
        pauseBtn.style.boxSizing = "border-box";
        pauseBtn.style.cursor = "pointer";
        pauseBtn.style.opacity = "0.7";
        pauseBtn.style.transition = "opacity 0.2s";

        const updatePauseBtn = (enabled) => {
            pauseBtn.textContent = enabled ? "II" : "▶";
        };

        if (isContextValid()) {
            chrome.storage.local.get("automatic_load_enabled", (res) => {
                updatePauseBtn(res.automatic_load_enabled);
            });
        }

        pauseBtn.onclick = () => {
            if (isContextValid()) {
                chrome.storage.local.get("automatic_load_enabled", (res) => {
                    const newState = !res.automatic_load_enabled;
                    chrome.storage.local.set({ "automatic_load_enabled": newState });
                });
            }
        };

        if (isContextValid()) {
            chrome.storage.onChanged.addListener((changes) => {
                if (changes.automatic_load_enabled) {
                    updatePauseBtn(changes.automatic_load_enabled.newValue);
                }
            });
        }

        document.body.appendChild(pauseBtn);

        // Fast Mode toggle button
        const fastBtn = document.createElement("button");
        fastBtn.id = "stagger-fast-btn";
        fastBtn.title = "Toggle Fast Mode";
        fastBtn.style.position = "fixed";
        fastBtn.style.right = "20px";
        fastBtn.style.top = "calc(50% - 60px)";
        fastBtn.style.transform = "translateY(-50%)";
        fastBtn.style.zIndex = "999999";
        fastBtn.style.width = "50px";
        fastBtn.style.height = "50px";
        fastBtn.style.minWidth = "50px";
        fastBtn.style.minHeight = "50px";
        fastBtn.style.display = "flex";
        fastBtn.style.alignItems = "center";
        fastBtn.style.justifyContent = "center";
        fastBtn.style.fontSize = "20px";
        fastBtn.style.background = "#000";
        fastBtn.style.color = "#fff";
        fastBtn.style.border = "2px solid #fff";
        fastBtn.style.borderRadius = "50%";
        fastBtn.style.boxSizing = "border-box";
        fastBtn.style.cursor = "pointer";
        fastBtn.style.opacity = "0.7";
        fastBtn.style.transition = "opacity 0.2s, color 0.2s, border-color 0.2s";

        const updateFastBtn = (enabled) => {
            fastBtn.textContent = "F";
            if (enabled) {
                fastBtn.style.color = "#4ecdc4";
                fastBtn.style.borderColor = "#4ecdc4";
            } else {
                fastBtn.style.color = "#fff";
                fastBtn.style.borderColor = "#fff";
            }
        };

        if (isContextValid()) {
            chrome.storage.local.get("fast_mode_enabled", (res) => {
                updateFastBtn(res.fast_mode_enabled);
            });
        }

        fastBtn.onclick = () => {
            if (isContextValid()) {
                chrome.storage.local.get("fast_mode_enabled", (res) => {
                    const newState = !res.fast_mode_enabled;
                    chrome.storage.local.set({ "fast_mode_enabled": newState });
                });
            }
        };

        if (isContextValid()) {
            chrome.storage.onChanged.addListener((changes) => {
                if (changes.fast_mode_enabled) {
                    updateFastBtn(changes.fast_mode_enabled.newValue);
                }
            });
        }

        document.body.appendChild(fastBtn);

        // Second yellow >> button (only if new videos present)
        const hasNewVideos = async () => {
            if (!isContextValid()) return false;
            // 1. Check userscript element
            const newCountElement = document.getElementById('tt-thumb-meta__new-count');
            if (newCountElement && parseInt(newCountElement.textContent) > 0) return true;

            // 2. Check baselines directly (robust fallback)
            const res = await chrome.storage.local.get("staggered_scan_baselines");
            const baselines = res.staggered_scan_baselines || {};
            const handleMatch = location.pathname.match(/^\/(@[^/]+)/);
            const handle = handleMatch ? handleMatch[1] : null;
            const baseline = handle ? (baselines[`tiktok_last_post:${handle}`] || 0) : Infinity;

            const links = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
            for (const a of links) {
                const postIdMatch = a.href.match(/\/(?:video|photo)\/(\d{10,})/);
                if (postIdMatch) {
                    try {
                        const ts = Number(BigInt(postIdMatch[1]) >> 32n) * 1000;
                        if (ts > baseline) return true;
                    } catch(e) {}
                }
            }
            return false;
        };

        const createNewFwdBtn = () => {
            const btnNew = document.createElement("button");
            btnNew.id = "stagger-forward-new-btn";
            btnNew.textContent = ">>";
            btnNew.title = "Add Link/s of NEW Videos to List and Progress to Next Link";
            btnNew.style.position = "fixed";
            btnNew.style.right = "20px";
            btnNew.style.top = "calc(50% + 120px)";
            btnNew.style.transform = "translateY(-50%)";
            btnNew.style.zIndex = "999999";
            btnNew.style.width = "50px";
            btnNew.style.height = "50px";
            btnNew.style.minWidth = "50px";
            btnNew.style.minHeight = "50px";
            btnNew.style.display = "flex";
            btnNew.style.alignItems = "center";
            btnNew.style.justifyContent = "center";
            btnNew.style.fontSize = "20px";
            btnNew.style.background = "#000";
            btnNew.style.color = "yellow";
            btnNew.style.border = "2px solid yellow";
            btnNew.style.borderRadius = "50%";
            btnNew.style.boxSizing = "border-box";
            btnNew.style.cursor = "pointer";
            btnNew.style.opacity = "0.7";
            btnNew.style.transition = "opacity 0.2s";

            btnNew.onmouseover = () => btnNew.style.opacity = "1";
            btnNew.onmouseout = () => btnNew.style.opacity = "0.7";

            btnNew.onclick = () => {
                const newMetas = document.querySelectorAll('.tt-thumb-meta__meta--new');
                const urls = Array.from(newMetas).map(meta => {
                    const host = meta.closest('.tt-thumb-meta__host');
                    const a = host ? host.querySelector('a[href]') : null;
                    return a ? a.href.split('?')[0] : null;
                }).filter(Boolean);

                if (urls.length > 0) {
                    try {
                        if (!isContextValid()) return;
                        const CLIPBOARD_KEY = 'tmk_internal_clipboard';
                        const raw = localStorage.getItem(CLIPBOARD_KEY);
                        const currentItems = raw ? JSON.parse(raw) : [];
                        const newSet = new Set([...currentItems, ...urls]);
                        const merged = Array.from(newSet);
                        localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(merged));

                        navigator.clipboard.writeText(merged.join('\n')).catch(() => {});

                        localStorage.setItem('stagger_append_notify', JSON.stringify({
                            appended: urls.length,
                            total: merged.length
                        }));
                    } catch (e) {}
                }
                if (isContextValid()) {
                    chrome.runtime.sendMessage({ type: "NEXT_STAGGERED" });
                }
            };

            document.body.appendChild(btnNew);
        };

        const checkNew = setInterval(async () => {
            if (await hasNewVideos() && !document.getElementById('stagger-forward-new-btn')) {
                createNewFwdBtn();
                clearInterval(checkNew);
            }
        }, 1000);
        setTimeout(() => clearInterval(checkNew), 15000); // timeout after 15s
    }

    function createCounter(current, total) {
        if (document.getElementById("stagger-counter")) return;

        const counter = document.createElement("div");
        counter.id = "stagger-counter";
        counter.textContent = `${String(current).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
        counter.style.position = "fixed";
        counter.style.top = "20px";
        counter.style.right = "135px";
        counter.style.zIndex = "999999";
        counter.style.background = "rgba(0, 0, 0, 0.7)";
        counter.style.color = "#fff";
        counter.style.padding = "5px 10px";
        counter.style.borderRadius = "5px";
        counter.style.fontSize = "16px";
        counter.style.fontWeight = "bold";
        counter.style.fontFamily = "monospace";
        document.body.appendChild(counter);
    }

    // -----------------------------
    // STORY CONTROLS
    // -----------------------------
    function injectStoryOptions() {
        const existing = document.getElementById('tmk-story-options-v2');
        const isStoryViewer = !!document.querySelector('#stories-player > div.css-1dux0b3 > button');

        if (!isStoryViewer) {
            if (existing) existing.remove();
            return;
        }

        if (existing) return;

        const options = document.createElement('div');
        options.id = 'tmk-story-options-v2';
        Object.assign(options.style, {
            position: 'fixed',
            top: '4.5rem',
            right: '1rem',
            zIndex: 999999,
            display: 'flex',
            gap: '10px',
            alignItems: 'center'
        });

        const iconAppend = createClipboardIcon('tmk-story-append-icon');
        iconAppend.title = 'Add Current URL to List';
        iconAppend.onclick = (e) => {
            e.stopPropagation();
            const url = location.href.split('?')[0];
            const CLIPBOARD_KEY = 'tmk_internal_clipboard';
            const raw = localStorage.getItem(CLIPBOARD_KEY);
            const currentItems = raw ? JSON.parse(raw) : [];
            if (!currentItems.includes(url)) {
                const merged = [...currentItems, url];
                localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(merged));
                navigator.clipboard.writeText(merged.join('\n')).catch(() => {});
                showNotification(`Added current story to list.\nURL: ${url}\nTotal: ${merged.length}`, '#4ecdc4');
            } else {
                showNotification(`URL already in list.\nURL: ${url}\nTotal: ${currentItems.length}`, '#ff6b6b');
            }
        };

        const iconClear = createClipboardIcon('tmk-story-clear-icon');
        iconClear.title = 'Clear List & Copy Current URL';
        iconClear.style.color = '#ff4d4d';
        iconClear.onclick = (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to clear the current list and copy this URL?')) {
                const url = location.href.split('?')[0];
                const CLIPBOARD_KEY = 'tmk_internal_clipboard';
                localStorage.setItem(CLIPBOARD_KEY, JSON.stringify([url]));
                navigator.clipboard.writeText(url).catch(() => {});
                showNotification("Cleared list and copied current story.", "#4ecdc4");
            }
        };

        options.appendChild(iconAppend);
        options.appendChild(iconClear);
        document.body.appendChild(options);
    }

    // -----------------------------
    // VIDEO PAGE CLIPBOARD ICON
    // -----------------------------
    function createClipboardIcon(id) {
        const icon = document.createElement('div');
        icon.id = id;
        icon.title = 'Add Current URL to List';
        Object.assign(icon.style, {
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            opacity: '0.7',
            transition: 'opacity 0.2s'
        });

        icon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 10C14 8.89543 14.8954 8 16 8H32C33.1046 8 34 8.89543 34 10V12H14V10Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
                <path d="M40 20V41C40 42.1046 39.1046 43 38 43H10C8.89543 43 8 42.1046 8 41V14C8 12.8954 8.89543 12 10 12H14V16H34V12H38C39.1046 12 40 12.8954 40 14V17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 25H32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 33H32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;

        icon.onmouseover = () => icon.style.opacity = '1';
        icon.onmouseout = () => icon.style.opacity = '0.7';

        icon.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = location.href.split('?')[0];
            const CLIPBOARD_KEY = 'tmk_internal_clipboard';
            const raw = localStorage.getItem(CLIPBOARD_KEY);
            const currentItems = raw ? JSON.parse(raw) : [];
            if (!currentItems.includes(url)) {
                const merged = [...currentItems, url];
                localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(merged));
                navigator.clipboard.writeText(merged.join('\n')).catch(() => {});
                showNotification(`Added current video to list.\nTotal: ${merged.length}`, '#4ecdc4');
            } else {
                showNotification("URL already in list.", "#ff6b6b");
            }
        };
        return icon;
    }

    function injectVideoClipboardIcon() {
        if (!location.pathname.includes('/video/')) {
            const existing = document.getElementById('tmk-video-clipboard-icon-v2');
            if (existing) existing.remove();
            return;
        }

        const usernameTarget = document.querySelector('span[data-e2e="browse-username"]');
        const fallbackTargetSelector = '#one-column-item-0 > div > section[class*="SectionActionBarContainer"] > div[class*="DivAvatarActionItemContainer"]';
        const fallbackTarget = document.querySelector(fallbackTargetSelector);

        let icon = document.getElementById('tmk-video-clipboard-icon-v2');

        if (icon) {
            // Check if icon is in correct place
            if (usernameTarget && icon.previousElementSibling === usernameTarget) return;
            if (!usernameTarget && fallbackTarget && icon.nextElementSibling === fallbackTarget) return;
            // Otherwise, remove and re-inject
            icon.remove();
        }

        icon = createClipboardIcon('tmk-video-clipboard-icon-v2');
        icon.style.marginLeft = '8px';
        icon.style.display = 'inline-flex';
        icon.style.verticalAlign = 'middle';

        if (usernameTarget) {
            usernameTarget.insertAdjacentElement('afterend', icon);
        } else if (fallbackTarget) {
            icon.style.marginLeft = '0';
            icon.style.marginBottom = '12px';
            icon.style.display = 'flex';
            fallbackTarget.parentNode.insertBefore(icon, fallbackTarget);
        }
    }

    const appObserver = new MutationObserver(() => {
        injectStoryOptions();
        injectVideoClipboardIcon();
    });
    appObserver.observe(document.body, { childList: true, subtree: true });

    // Initial and periodic injection
    injectStoryOptions();
    injectVideoClipboardIcon();
    setInterval(() => {
        injectStoryOptions();
        injectVideoClipboardIcon();
    }, 1000);

    let response;
    if (isContextValid()) {
        try {
            response = await chrome.runtime.sendMessage({ type: "CHECK_STAGGERED" });
        } catch (e) {
            console.warn("Stagger Nav: Failed to send initial CHECK_STAGGERED message", e);
        }
    }
    
    if (response && response.isStaggered) {
        createForwardBtn();
        if (response.total) {
            createCounter(response.currentIndex, response.total);
        }

        // Check for pending notification
        try {
            const notify = localStorage.getItem('stagger_append_notify');
            if (notify) {
                const data = JSON.parse(notify);
                localStorage.removeItem('stagger_append_notify');
                showNotification(`Appended ${data.appended} link(s).\nTotal in memory: ${data.total}`, '#4ecdc4');
            }
        } catch (e) {}

        // -----------------------------
        // AUTOMATION LOGIC
        // -----------------------------
        let pollInterval = null;

        async function startPolling() {
            if (pollInterval) clearInterval(pollInterval);
            if (!isContextValid()) return;

            const res = await chrome.storage.local.get(["automatic_load_enabled", "fast_mode_enabled", "staggered_scan_baselines"]);
            if (!res.automatic_load_enabled) return;

            console.log("Staggered Navigation: Automatic Load is enabled.");
            
            const baselines = res.staggered_scan_baselines || {};
            const handleMatch = location.pathname.match(/^\/(@[^/]+)/);
            const handle = handleMatch ? handleMatch[1] : null;
            const baseline = handle ? (baselines[`tiktok_last_post:${handle}`] || 0) : Infinity;

            let pollCount = 0;
            const maxPolls = 10;

            pollInterval = setInterval(() => {
                if (!isContextValid()) {
                    clearInterval(pollInterval);
                    return;
                }
                pollCount++;
                
                // 1. Check for the userscript element as a primary signal
                const newCountElement = document.getElementById('tt-thumb-meta__new-count');
                if (newCountElement && parseInt(newCountElement.textContent) > 0) {
                    console.log("Staggered Navigation: New videos found via userscript signal! Stopping automation.");
                    clearInterval(pollInterval);
                    chrome.runtime.sendMessage({ type: "PLAY_SOUND", sound: "new_videos" });
                    return;
                }

                // 2. Direct scraping fallback to ensure robustness
                const links = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
                let foundNew = false;
                for (const a of links) {
                    const postIdMatch = a.href.match(/\/(?:video|photo)\/(\d{10,})/);
                    if (postIdMatch) {
                        try {
                            const ts = Number(BigInt(postIdMatch[1]) >> 32n) * 1000;
                            if (ts > baseline) {
                                foundNew = true;
                                break;
                            }
                        } catch(e) {}
                    }
                }

                if (foundNew) {
                    console.log("Staggered Navigation: New videos found via direct scraping! Stopping automation.");
                    clearInterval(pollInterval);
                    if (isContextValid()) {
                        chrome.runtime.sendMessage({ type: "PLAY_SOUND", sound: "new_videos" });
                    }
                    return;
                }

                // Continue polling if no videos yet or we haven't given the userscript long enough
                const pollThreshold = res.fast_mode_enabled ? 1 : 3;
                if (pollCount >= pollThreshold && document.querySelectorAll('[data-e2e="user-post-item"]').length > 0) {
                    console.log(`Staggered Navigation: No new content found after ${pollThreshold}s of active content. Advancing.`);
                    clearInterval(pollInterval);
                    const delay = res.fast_mode_enabled ? 200 : Math.floor(Math.random() * 2000) + 1000;
                    setTimeout(() => {
                        if (isContextValid()) {
                            chrome.runtime.sendMessage({ type: "NEXT_STAGGERED" });
                        }
                    }, delay);
                } else if (pollCount >= maxPolls) {
                    console.log("Staggered Navigation: No new content found after timeout. Advancing.");
                    clearInterval(pollInterval);
                    const delay = res.fast_mode_enabled ? 200 : Math.floor(Math.random() * 2000) + 1000;
                    setTimeout(() => {
                        if (isContextValid()) {
                            chrome.runtime.sendMessage({ type: "NEXT_STAGGERED" });
                        }
                    }, delay);
                }
            }, 1000);
        }

        startPolling();

        if (isContextValid()) {
            chrome.storage.onChanged.addListener((changes) => {
                if (changes.automatic_load_enabled || changes.fast_mode_enabled) {
                    if ((changes.automatic_load_enabled && changes.automatic_load_enabled.newValue) ||
                        (changes.fast_mode_enabled)) {
                        startPolling();
                    } else {
                        if (pollInterval) clearInterval(pollInterval);
                    }
                }
            });
        }
    }
})();
