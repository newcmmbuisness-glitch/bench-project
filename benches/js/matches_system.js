let lastMatchesHash = null;
let matchesRefreshInterval = null;

async function showMatches() {
    if (!currentUser) {
        showLogin();
        showNotification('🔒 Bitte melden Sie sich an!', 'error');
        return;
    }

    hideAllScreens();

    const container = document.getElementById('matchesContainer');
    container.style.display = 'flex';

    updateFloatingButtons();

    await loadUserMatches(true); // force refresh
    startMatchesAutoRefresh();

    // Alle Nachrichten als gelesen markieren
    setTimeout(() => {
        const allMatches = JSON.parse(localStorage.getItem('userMatches') || '[]');
        const now = Date.now();
        allMatches.forEach(match => lastCheckedMessages[match.match_id] = now);
        localStorage.setItem('lastCheckedMessages', JSON.stringify(lastCheckedMessages));
        unreadMessageCount = 0;
        updateChatButtonBadge();
    }, 500);
}

async function loadUserMatches(forceRefresh = false) {
    const matchesList = document.getElementById('matchesList');
    const noMatchesDiv = document.getElementById('noMatches');
    const backButton = document.getElementById('backToSwipe');
    const template = document.getElementById('matchTemplate');

    if (!matchesList || !template) {
        console.error('Matches Elemente nicht gefunden');
        return;
    }

    matchesList.innerHTML = '';
    noMatchesDiv.classList.add('hidden');
    backButton.classList.add('hidden');

    // Loading anzeigen
    if (!lastMatchesHash || forceRefresh) {
        matchesList.innerHTML = '<div class="text-center p-4">Lade Matches... 🔄</div>';
    }

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
                    // AI Check
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

        // Hash für Vergleich
        const currentHash = JSON.stringify(allMatches.map(m => ({
            id: m.match_id,
            lastMsg: m.last_message?.text || null,
            lastMsgTime: m.last_message?.sent_at || null
        })));

        if (currentHash !== lastMatchesHash || forceRefresh) {
            lastMatchesHash = currentHash;
            matchesList.innerHTML = '';

            if (allMatches.length > 0) {
                // Zuerst alle fehlenden Koordinaten berechnen (PLZ → Lat/Lng)
                await Promise.all(allMatches.map(async (match) => {
                    if (!match.latitude && !match.longitude && match.postal_code) {
                        try {
                            const coords = await getCoordinatesFromPostalCode(match.postal_code);
                            match.latitude = coords.lat;
                            match.longitude = coords.lng;
                        } catch (e) {
                            console.warn("PLZ konnte nicht geocoded werden:", match.postal_code);
                        }
                    }
                }));
                
                allMatches.forEach(match => {
                    const clone = template.cloneNode(true);
                    clone.classList.remove('hidden');

                    clone.querySelector('img').src = match.profile_image;
                    clone.querySelector('img').alt = match.profile_name;
                    clone.querySelector('h4').textContent = `${match.profile_name}, ${match.age || '?'}`;

                    // Entfernung berechnen (jetzt synchron möglich)
                    let distanceText = "-";
                    if (match.latitude && match.longitude) {
                        distanceText = calculateDistance(
                            currentUser.latitude, currentUser.longitude,
                            match.latitude, match.longitude
                        ) + " km";
                    }
            
                    clone.querySelector(".match-distance").textContent = distanceText;

                    const lastMsg = match.last_message
                        ? (match.last_message.sender_id == currentUser.uid
                            ? `Du: ${match.last_message.text}`
                            : `${match.profile_name}: ${match.last_message.text}`)
                        : 'Noch keine Nachrichten';
                    clone.querySelector('p').textContent = lastMsg;

                    clone.querySelector('span').textContent = match.isAI ? '💕 Match' : '💕 Match';

                    clone.onclick = () => openMatchChat(match.match_id, match.matched_user_id, match.profile_name, match.profile_image);

                    matchesList.appendChild(clone);
                });

                backButton.classList.remove('hidden');

            } else {
                noMatchesDiv.classList.remove('hidden');
            }
        }

    } catch (error) {
        console.error('Fehler beim Laden der Matches:', error);
        noMatchesDiv.innerHTML = `
            <div class="text-center py-16">
                <div class="text-6xl mb-4">⚠️</div>
                <h3 class="text-xl font-semibold text-gray-700 mb-2">Verbindungsfehler</h3>
                <p class="text-gray-500 mb-6">Matches konnten nicht geladen werden</p>
                <button onclick="loadUserMatches(true)" class="bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-blue-600 transition-colors">
                    🔄 Erneut versuchen
                </button>
            </div>
        `;
        noMatchesDiv.classList.remove('hidden');
    }
}

// Auto-Refresh
function startMatchesAutoRefresh() {
    if (matchesRefreshInterval) clearInterval(matchesRefreshInterval);
    matchesRefreshInterval = setInterval(() => {
        const container = document.getElementById('matchesContainer');
        if (container && container.offsetParent !== null) loadUserMatches(false);
        else stopMatchesAutoRefresh();
    }, 15000);
}

function stopMatchesAutoRefresh() {
    if (matchesRefreshInterval) clearInterval(matchesRefreshInterval);
    matchesRefreshInterval = null;
}

// Safe API Call
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

// Close Chat
function closeChat() {
    const chatModal = document.querySelector('[data-chat-modal]');
    if (chatModal) chatModal.remove();
    if (chatState.messageInterval) clearInterval(chatState.messageInterval);

    chatState = { currentMatchId: null, currentConversationId: null, aiSuggestionsLoaded: false, lastLoadedMessageCount: 0, messageInterval: null };

    const container = document.getElementById('matchesContainer');
    if (container && container.offsetParent !== null) loadUserMatches(true);
}

window.showMatches = showMatches;
window.loadUserMatches = loadUserMatches;
window.startMatchesAutoRefresh = startMatchesAutoRefresh;
window.safeApiCall = safeApiCall;
window.closeChat = closeChat;
