let lastMatchesHash = null;
let matchesRefreshInterval = null;

async function showMatches() {
    if (!currentUser) {
        showLogin();
        showNotification('🔒 Bitte melden Sie sich an!', 'error');
        return;
    }

    hideAllScreens();
    document.getElementById('matchesContainer').style.display = 'block';
    updateFloatingButtons();

    await loadUserMatches(true);
    startMatchesAutoRefresh();

    // Mark all messages as read
    setTimeout(() => {
        const allMatches = JSON.parse(localStorage.getItem('userMatches') || '[]');
        const now = Date.now();
        allMatches.forEach(match => {
            lastCheckedMessages[match.match_id] = now;
        });
        localStorage.setItem('lastCheckedMessages', JSON.stringify(lastCheckedMessages));
        unreadMessageCount = 0;
        updateChatButtonBadge();
    }, 500);
}

async function loadUserMatches(forceRefresh = false) {
    const loading = document.getElementById('matchesLoading');
    const list = document.getElementById('matchesList');
    const template = document.getElementById('matchTemplate');
    const noMatches = document.getElementById('noMatches');
    const backToSwipe = document.getElementById('backToSwipe');
    const errorDiv = document.getElementById('matchesError');

    // Reset alle Zustände
    loading.classList.add('hidden');
    noMatches.classList.add('hidden');
    backToSwipe.classList.add('hidden');
    errorDiv.classList.add('hidden');
    list.querySelectorAll('.match-item:not(#matchTemplate)').forEach(e => e.remove());

    loading.classList.remove('hidden');

    try {
        const response = await fetch('/.netlify/functions/get_matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.uid })
        });

        let allMatches = [];
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.matches) {
                allMatches = result.matches.map(match => {
                    const isAIMatch = match.matched_user_id === 0 || match.matched_user_id === "0";
                    if (isAIMatch) {
                        const localMatches = JSON.parse(localStorage.getItem('userMatches') || '[]');
                        const localAIMatch = localMatches.find(lm => lm.match_id === match.match_id);
                        if (localAIMatch) {
                            return { ...match, isAI: true, ...localAIMatch };
                        }
                    }
                    return match;
                });
            }
        }

        const currentHash = JSON.stringify(allMatches.map(m => ({
            id: m.match_id,
            lastMsg: m.last_message?.text || null,
            lastMsgTime: m.last_message?.sent_at || null
        })));

        if (currentHash === lastMatchesHash && !forceRefresh) return;
        lastMatchesHash = currentHash;

        loading.classList.add('hidden');

        if (allMatches.length === 0) {
            noMatches.classList.remove('hidden');
            return;
        }

        backToSwipe.classList.remove('hidden');

        allMatches.forEach(match => {
            const clone = template.cloneNode(true);
            clone.id = '';
            clone.classList.remove('hidden');

            clone.querySelector('.match-name').textContent = `${match.profile_name}, ${match.age || '?'}`;
            clone.querySelector('.match-lastmsg').textContent = match.last_message?.text
                ? (match.last_message.sender_id == currentUser.uid
                    ? `Du: ${match.last_message.text}`
                    : `${match.profile_name}: ${match.last_message.text}`)
                : 'Noch keine Nachrichten';
            clone.querySelector('.match-image').src = match.profile_image;
            clone.querySelector('.match-image').alt = match.profile_name;
            clone.querySelector('.match-badge').textContent = match.isAI ? '💕 Match' : '💕 Match';

            clone.onclick = () => openMatchChat(match.match_id, match.matched_user_id, match.profile_name, match.profile_image);

            list.appendChild(clone);
        });

    } catch (err) {
        console.error(err);
        loading.classList.add('hidden');
        errorDiv.classList.remove('hidden');
    }
}

// Auto-Refresh
function startMatchesAutoRefresh() {
    if (matchesRefreshInterval) clearInterval(matchesRefreshInterval);

    const matchesList = document.getElementById('matchesList');
    if (matchesList && matchesList.offsetParent !== null) {
        matchesRefreshInterval = setInterval(() => {
            if (matchesList.offsetParent !== null) loadUserMatches(false);
            else {
                clearInterval(matchesRefreshInterval);
                matchesRefreshInterval = null;
                lastMatchesHash = null;
            }
        }, 15000);
    }
}

function stopMatchesAutoRefresh() {
    if (matchesRefreshInterval) {
        clearInterval(matchesRefreshInterval);
        matchesRefreshInterval = null;
    }
}

// API Call Safe Wrapper
async function safeApiCall(url, options, fallbackMessage) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();
        return { success: true, data: result };
    } catch (error) {
        console.error('API Call failed:', error);
        showNotification(fallbackMessage || 'Ein Fehler ist aufgetreten', 'error');
        return { success: false, error: error.message };
    }
}

// Chat schließen
function closeChat() {
    const chatModal = document.querySelector('[data-chat-modal]');
    if (chatModal) chatModal.remove();

    if (chatState.messageInterval) clearInterval(chatState.messageInterval);

    chatState = {
        currentMatchId: null,
        currentConversationId: null,
        aiSuggestionsLoaded: false,
        lastLoadedMessageCount: 0,
        messageInterval: null
    };

    const matchesList = document.getElementById('matchesList');
    if (matchesList && matchesList.offsetParent !== null) loadUserMatches(true);
}

// Retry Button
document.getElementById('retryLoadMatches')?.addEventListener('click', () => loadUserMatches(true));

window.showMatches = showMatches;
window.loadUserMatches = loadUserMatches;
window.startMatchesAutoRefresh = startMatchesAutoRefresh;
window.stopMatchesAutoRefresh = stopMatchesAutoRefresh;
window.safeApiCall = safeApiCall;
window.closeChat = closeChat;
