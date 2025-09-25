let unreadMessageCount = 0;		
let lastCheckedMessages = {};     
let currentChatUser = null;

let chatState = {
	currentMatchId: null,
	currentConversationId: null,
	aiSuggestionsLoaded: false,
	lastLoadedMessageCount: 0,
	messageInterval: null,
	isAI: false,        // Flag, ob Chat mit AI ist
	aiProfileId: null   // die AI-Profil-ID für diesen Chat
};
// ---------------------------
// AI Timer / Scheduler global + persistent via localStorage
// ---------------------------
window.aiReplyTimers = window.aiReplyTimers || {};

function persistTimerToStorage(convId, meta) {
  try {
	localStorage.setItem(`ai_timer_${convId}`, JSON.stringify(meta));
  } catch (e) {}
}
function removeTimerFromStorage(convId) {
  try { localStorage.removeItem(`ai_timer_${convId}`); } catch (e) {}
}

function restoreAiTimers() {
  try {
	Object.keys(localStorage).forEach(k => {
	  if (!k.startsWith('ai_timer_')) return;
	  const convId = k.replace('ai_timer_', '');
	  const meta = JSON.parse(localStorage.getItem(k) || '{}');
	  if (!meta || !meta.dueAt) {
		removeTimerFromStorage(convId);
		return;
	  }
	  const remaining = Math.max(meta.dueAt - Date.now(), 0);
	  if (window.aiReplyTimers[convId] && window.aiReplyTimers[convId].id) return;

	  window.aiReplyTimers[convId] = {
		pendingUserMessages: meta.pendingUserMessages || [],
		dueAt: meta.dueAt,
		id: setTimeout(() => triggerAiReply(convId), remaining)
	  };
	});
  } catch (e) { console.error('restoreAiTimers error', e); }
}

document.addEventListener('DOMContentLoaded', () => {
  restoreAiTimers();
});
// ---------- SHOW CHATS ----------
function showChats() {
    if (!currentUser) {
        showLogin();
        showNotification('🔒 Sie müssen sich anmelden, um Ihre Matches zu sehen!', 'error');
        return;
    }
    hideAllScreens();
    document.getElementById('chatContainer').style.display = 'block';
    showMatchesList();
}

// ---------- LOAD MESSAGES ----------
async function loadMessages() {
    const container = document.getElementById('chatMessages');
    const suggestionsContainer = document.getElementById('aiSuggestionsContainer');
    if (!container || !chatState.currentMatchId || !suggestionsContainer) {
        console.error("❌ Missing required elements or no active chat");
        return;
    }

    if (chatState.isAI) {
        loadAIMessages();
        return;
    }

    try {
        const match_id = parseInt(chatState.currentMatchId);
        if (isNaN(match_id) || match_id <= 0) {
            console.error('❌ Invalid match ID for real chat:', chatState.currentMatchId);
            container.innerHTML = `<div class="text-center text-red-500 py-8"><p>Fehlerhafte Chat-ID</p></div>`;
            return;
        }

        const response = await fetch('/.netlify/functions/get_messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ match_id })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            const currentMessageCount = result.messages?.length || 0;
            const hasNewMessages = currentMessageCount > chatState.lastLoadedMessageCount;
            const isChatEmpty = currentMessageCount === 0;

            if (hasNewMessages || isChatEmpty) {
                container.innerHTML = '';
                if (result.messages?.length > 0) {
                    result.messages.forEach(message => {
                        const messageClass = message.sender_id === parseInt(currentUser.uid) ? 'sent' : 'received';
                        const messageBubble = document.createElement('div');
                        messageBubble.classList.add('message', messageClass);

                        const timestamp = new Date(message.sent_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

                        const bubbleDiv = document.createElement('div');
                        bubbleDiv.classList.add('message-bubble');
                        bubbleDiv.textContent = message.message_text;

                        const tsDiv = document.createElement('div');
                        tsDiv.className = 'text-xs opacity-50 mt-1';
                        tsDiv.textContent = timestamp;

                        messageBubble.appendChild(bubbleDiv);
                        messageBubble.appendChild(tsDiv);
                        container.appendChild(messageBubble);
                    });
                } else {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'text-center text-gray-500 py-8';
                    emptyDiv.innerHTML = `<div class="text-4xl mb-2">👋</div><p>Schreibt euch eure erste Nachricht!</p>`;
                    container.appendChild(emptyDiv);
                }
                container.scrollTop = container.scrollHeight;
            }

            const lastMessage = result.messages[result.messages.length - 1];
            const lastMessageIsFromPartner = lastMessage && lastMessage.sender_id !== parseInt(currentUser.uid);

            if ((isChatEmpty && !chatState.aiSuggestionsLoaded) || (hasNewMessages && lastMessageIsFromPartner)) {
                chatState.aiSuggestionsLoaded = true;
                updateSuggestions();
            } else if (!isChatEmpty && !lastMessageIsFromPartner && !hasNewMessages) {
                suggestionsContainer.classList.add('hidden');
            }

            chatState.lastLoadedMessageCount = currentMessageCount;
        } else {
            console.error('❌ Error loading messages:', result.error);
            if (!container.hasChildNodes()) {
                const errDiv = document.createElement('div');
                errDiv.className = 'text-center text-red-500 py-8';
                errDiv.innerHTML = `<p>Nachrichten konnten nicht geladen werden</p>`;
                const retryBtn = document.createElement('button');
                retryBtn.textContent = '🔄 Erneut versuchen';
                retryBtn.className = 'mt-2 px-4 py-2 bg-blue-500 text-white rounded';
                retryBtn.onclick = loadMessages;
                errDiv.appendChild(retryBtn);
                container.appendChild(errDiv);
            }
        }
    } catch (error) {
        console.error('❌ Network error loading messages:', error);
    }
}

// ---------- SEND MESSAGE ----------
async function sendMessage() {
	console.log("🔥 sendMessage called", {
    messageText,
    currentMatchId: chatState.currentMatchId,
    isAI: chatState.isAI,
    currentUser: currentUser?.uid
});
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();
    if (!messageText || !chatState.currentMatchId || !currentUser.uid) return;

    const isAIChat = chatState.isAI;

    // Optimistic update
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'sent');
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = messageText;
    messageElement.appendChild(bubbleDiv);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const originalValue = messageText;
    messageInput.value = '';
    messageInput.disabled = true;

    try {
        if (isAIChat) {
            sendAIMessage(originalValue);
        } else {
            const response = await fetch('/.netlify/functions/send_message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    match_id: parseInt(chatState.currentMatchId),
                    sender_id: parseInt(currentUser.uid),
                    message_text: originalValue
                })
            });
            const result = await response.json();
            if (response.ok && result.success) {
                chatState.aiSuggestionsLoaded = false;
                setTimeout(() => loadMessages(), 100);
            } else {
                chatMessages.removeChild(messageElement);
                messageInput.value = originalValue;
            }
        }
    } catch (error) {
        chatMessages.removeChild(messageElement);
        messageInput.value = originalValue;
    } finally {
        messageInput.disabled = false;
        messageInput.focus();
    }
}

// ---------- SETUP INPUT ----------
function setupMessageInput() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    messageInput.replaceWith(messageInput.cloneNode(true));
    const newInput = document.getElementById('messageInput');
    newInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
    newInput.focus();
}

async function reportChat(match) {
	// Wenn kein Match übergeben wird, automatisch das aktuelle Profil nehmen
	// Für AI-Matches z.B. das gerade angezeigte Profil im Swipe
	match = match || currentProfiles?.[currentIndex] || chatState.currentMatch;

	// AI-Match: nur Illusion, kein Zugriff auf IDs nötig
	if (match?.isAI) {
		if (!confirm('Sind Sie sicher, dass Sie diesen Chat melden möchten?')) return;
		alert('Chat mit AI gemeldet. Vielen Dank für Ihr Feedback.');
		closeChat();
		return;
	}

	// Echte Matches prüfen
	if (!match?.match_id || !currentUser?.uid) {
		alert('Fehler: Chat oder Benutzer nicht identifiziert.');
		return;
	}

	if (!confirm('Sind Sie sicher, dass Sie diesen Chat melden möchten?')) return;

	try {
		const response = await fetch('/.netlify/functions/report_chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				match_id: parseInt(match.match_id),
				reporter_id: currentUser.uid
			}),
		});

		const result = await response.json();
		if (response.ok && result.success) {
			alert('Chat erfolgreich gemeldet. Vielen Dank für Ihr Feedback.');
			closeChat();
		} else {
			alert('Fehler beim Melden des Chats: ' + (result.error || 'Unbekannter Fehler.'));
		}
	} catch (error) {
		console.error('❌ Error reporting chat:', error);
		alert('Ein Netzwerkfehler ist aufgetreten.');
	}
}
// ---------- OPEN MATCH CHAT ----------
async function openMatchChat(matchId, matchUserId, matchName, matchImage) {
    console.log('🔥 Opening chat - Match ID:', matchId, 'User ID:', matchUserId);
    closeChat();

    if (!matchId || matchUserId === undefined || !matchName) {
        showNotification('❌ Fehlerhafte Chat-Daten', 'error');
        return;
    }

    const isAIChat = Number(matchUserId) === 0;
    const numericMatchId = parseInt(matchId);
    if (isNaN(numericMatchId) || numericMatchId <= 0) {
        showNotification('❌ Fehlerhafte Match-ID', 'error');
        return;
    }

    chatState = {
        currentMatchId: numericMatchId,
        currentConversationId: numericMatchId,
        aiSuggestionsLoaded: false,
        lastLoadedMessageCount: 0,
        messageInterval: null,
        isAI: isAIChat,
		currentMatch: {        // <- HIER hinzufügen
			match_id: numericMatchId,
			user_id: matchUserId,
			name: matchName,
			image: matchImage,
			isAI: isAIChat
		}
    };

    const chatContainer = document.getElementById('chatContainer');
    const chatModal = document.getElementById('chatModal');
    chatModal.classList.remove('hidden');
    chatContainer.style.display = 'block';

    document.getElementById('chatUserName').textContent = matchName;
    const imgEl = document.getElementById('chatUserImage');
    imgEl.src = matchImage || '/default-avatar.png';
    imgEl.alt = matchName;
	document.getElementById('aiBadge').style.display = 'block';

    document.getElementById('reportChatBtn').onclick = () => reportChat();
    document.getElementById('closeChatBtn').onclick = () => closeChat();
    document.getElementById('sendMessageBtn').onclick = () => sendMessage();

    setupMessageInput();
    markMessagesAsRead(numericMatchId);

    if (isAIChat) {
        loadAIMessages();
    } else {
        loadMessages();
        chatState.messageInterval = setInterval(loadMessages, 3000);
    }
}
async function updateSuggestions() {
	if (!chatState.currentMatchId || !currentUser) {
		document.getElementById('aiSuggestionsContainer').classList.add('hidden');
		return;
	}

	const mainContainer = document.getElementById('aiSuggestionsContainer');
	const thinkingBubble = document.getElementById('aiThinkingBubble');
	const typingTextElement = document.getElementById('typingText');

	// Check if this is an AI chat - if so, don't show suggestions
	const isAIChat = typeof chatState.currentMatchId === 'string' && chatState.currentMatchId.toString().includes('ai_match_');
	if (isAIChat) {
		mainContainer.classList.add('hidden');
		return;
	}

	// Only show suggestions for real user chats
	mainContainer.classList.remove('hidden');
	thinkingBubble.classList.remove('hidden');
	typingTextElement.textContent = 'One-KI denkt nach...';
	
	// Remove old suggestion buttons
	const oldButtons = mainContainer.querySelectorAll('button');
	oldButtons.forEach(button => button.remove());

	try {
		// Make sure matchId is a number for real chats
		const matchId = parseInt(chatState.currentMatchId);
		if (isNaN(matchId)) {
			console.error('❌ Invalid match ID for suggestions:', chatState.currentMatchId);
			mainContainer.classList.add('hidden');
			return;
		}

		const response = await fetch('/.netlify/functions/get_chat_suggestions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ 
				matchId: matchId,  // Send as number
				currentUserId: currentUser.uid 
			}),
		});

		const result = await response.json();
		
		// Animation timeout
		setTimeout(() => {
			thinkingBubble.classList.add('hidden');

			if (result.success && result.suggestions.length > 0) {
				result.suggestions.forEach(suggestion => {
					const button = document.createElement('button');
					button.onclick = () => {
						document.getElementById('messageInput').value = suggestion;
						logSuggestionClick(suggestion);
					};

					const innerDiv = document.createElement('div');
					innerDiv.className = 'ki-beta-container';
					
					const innerSpan = document.createElement('span');
					innerSpan.className = 'ki-beta-branding';
					innerSpan.textContent = suggestion;

					innerDiv.appendChild(innerSpan);
					button.appendChild(innerDiv);
					mainContainer.appendChild(button);
				});
			} else {
				mainContainer.classList.add('hidden');
			}
		}, 2500);

	} catch (error) {
		console.error('❌ Error loading AI suggestions:', error);
		thinkingBubble.classList.add('hidden');
		mainContainer.classList.add('hidden');
	}
}


async function logSuggestionClick(suggestionText) {
	try {
		await fetch('/.netlify/functions/log_suggestion_click', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userId: currentUser.uid,
				clickedSuggestion: suggestionText
			}),
		});
	} catch (error) {
		console.error('❌ Error logging suggestion click:', error);
	}
}
// ---------- AI MESSAGE HANDLING ----------
function loadAIMessages() {
    const container = document.getElementById('chatMessages');
    if (!container || !chatState.currentMatchId) return;

    let aiMessages = JSON.parse(localStorage.getItem(`ai_chat_${chatState.currentMatchId}`) || '[]');
    container.innerHTML = '';

    if (aiMessages.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-center text-gray-500 py-8';
        emptyDiv.innerHTML = `<div class="text-4xl mb-2">👋</div><p>Schreibt euch eure erste Nachricht!</p>`;
        container.appendChild(emptyDiv);
        return;
    }

    aiMessages.forEach(msg => {
        const messageClass = msg.sender === 'user' ? 'sent' : 'received';
        const bubble = document.createElement('div');
        bubble.classList.add('message', messageClass);
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        bubbleDiv.textContent = msg.text;
        const tsDiv = document.createElement('div');
        tsDiv.className = 'text-xs opacity-50 mt-1';
        tsDiv.textContent = new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        bubble.appendChild(bubbleDiv);
        bubble.appendChild(tsDiv);
        container.appendChild(bubble);
    });
    container.scrollTop = container.scrollHeight;
}

async function saveAIMessage(sender, text) {
    const matchId = chatState.currentMatchId;
    if (!matchId) return;
    let aiMessages = JSON.parse(localStorage.getItem(`ai_chat_${matchId}`) || '[]');
    aiMessages.push({ sender, text, timestamp: new Date().toISOString() });
    localStorage.setItem(`ai_chat_${matchId}`, JSON.stringify(aiMessages));

    const dbSenderId = sender === 'user' ? parseInt(currentUser.uid) : 0;
    try {
        await fetch('/.netlify/functions/send_message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                match_id: matchId,
                sender_id: dbSenderId,
                message_text: text,
                is_ai: sender === 'ai'
            })
        });
    } catch (err) {
        console.error('❌ Fehler beim Speichern der AI-Nachricht in DB', err);
    }
}

async function sendAIMessage(messageText) {
	console.log("🤖 sendAIMessage called", {
	    messageText,
	    convId: chatState.currentMatchId
	});
    if (!chatState.currentMatchId || !messageText) return;
    await saveAIMessage('user', messageText);
    loadAIMessages();

    const convId = chatState.currentMatchId;
    if (!window.aiReplyTimers) window.aiReplyTimers = {};
    if (!window.aiReplyTimers[convId]) window.aiReplyTimers[convId] = { pendingUserMessages: [] };
    window.aiReplyTimers[convId].pendingUserMessages.push({ text: messageText, ts: Date.now() });

    const delay = Math.floor(Math.random() * (60_000 - 8_000)) + 8_000;
    window.aiReplyTimers[convId].dueAt = Date.now() + delay;
    window.aiReplyTimers[convId].id = setTimeout(() => triggerAiReply(convId), delay);
}

async function triggerAiReply(convId) {
    const t = window.aiReplyTimers[convId];
    if (!t) return;
    const combinedUserText = (t.pendingUserMessages || []).map(m => m.text).join("\n");
    t.pendingUserMessages = [];

    try {
        const localMatches = JSON.parse(localStorage.getItem('userMatches') || '[]');
        const currentMatch = localMatches.find(m => m.match_id === convId);
        const aiProfileId = currentMatch?.ai_profile_id || 1;

        const response = await fetch('/.netlify/functions/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                aiProfileId,
                userMessage: combinedUserText,
                userProfile: { id: currentUser?.uid || "guest", name: currentUser?.email || null },
                conversationId: convId
            })
        });
        const result = await response.json();
        const aiText = result.success ? result.response : "Entschuldige, gerade nicht verfügbar.";

        await saveAIMessage('ai', aiText);
        if (chatState.currentMatchId === convId) loadAIMessages();
    } catch (err) {
        console.error('AI reply failed', err);
        await saveAIMessage('ai', "Ups, da ist etwas schiefgelaufen!");
        if (chatState.currentMatchId === convId) loadAIMessages();
    } finally {
        if (window.aiReplyTimers[convId]?.id) clearTimeout(window.aiReplyTimers[convId].id);
        delete window.aiReplyTimers[convId];
    }
}
// Function to mark messages as read for a specific chat
function markMessagesAsRead(matchId) {
	lastCheckedMessages[matchId] = Date.now();
	localStorage.setItem('lastCheckedMessages', JSON.stringify(lastCheckedMessages));
	
	// Recheck total unread count
	setTimeout(checkForNewMessages, 100);
}
		
function initializeNotificationSystem() {
	// Load last checked messages from localStorage
	const stored = localStorage.getItem('lastCheckedMessages');
	if (stored) {
		lastCheckedMessages = JSON.parse(stored);
	}
	
	// Check for messages immediately
	if (currentUser && currentUser.uid) {
		checkForNewMessages();
		
		// Set up periodic checking (every 30 seconds)
		setInterval(checkForNewMessages, 30000);
	}
}		

// Close Chat
function closeChat() {
    const chatModal = document.getElementById('chatModal');
    if (chatModal) chatModal.classList.add('hidden'); // nur verstecken, nicht löschen!
    if (chatState.messageInterval) clearInterval(chatState.messageInterval);

    chatState = { currentMatchId: null, currentConversationId: null, aiSuggestionsLoaded: false, lastLoadedMessageCount: 0, messageInterval: null };

    const container = document.getElementById('matchesContainer');
    if (container && container.offsetParent !== null) loadUserMatches(true);
}


// ---------- DOM EVENT BINDINGS ----------
document.addEventListener("DOMContentLoaded", () => {
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    const closeBtn = document.getElementById('closeChatBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeChat);

    const reportBtn = document.getElementById('reportChatBtn');
    if (reportBtn) reportBtn.addEventListener('click', () => window.reportChat());

    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }

	// ---------- WINDOW BINDINGS ----------
window.showChats = showChats;
window.loadMessages = loadMessages;
window.sendMessage = sendMessage;
window.setupMessageInput = setupMessageInput;
window.openMatchChat = openMatchChat;
window.loadAIMessages = loadAIMessages;
window.saveAIMessage = saveAIMessage;
window.sendAIMessage = sendAIMessage;
window.triggerAiReply = triggerAiReply;
window.reportChat = reportChat;
window.markMessagesAsRead = markMessagesAsRead;
window.initializeNotificationSystem = initializeNotificationSystem;
window.updateSuggestions = updateSuggestions;
window.logSuggestionClick = logSuggestionClick;
window.closeChat = closeChat;
    // Optional: load user from localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        window.currentUser = JSON.parse(storedUser);
    }
});
