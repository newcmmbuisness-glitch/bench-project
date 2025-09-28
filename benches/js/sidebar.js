let sidebarOpen = false;

// Variablen deklarieren, aber erst später initialisieren
let sidebar, overlay, mainLogo;

function toggleSidebar() {
    if (sidebar.classList.contains('open')) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

function openSidebar() {
    sidebarOpen = true;
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
    if (mainLogo) mainLogo.classList.add('sidebar-open');
}

function closeSidebar() {
    sidebarOpen = false;
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    if (mainLogo) mainLogo.classList.remove('sidebar-open');
}

function updateAuthButtons(currentUser) {
    const userEmailDisplay = document.getElementById('user-email-display');
    const loginBtn = document.getElementById('loginSidebarBtn');
    const logoutBtn = document.getElementById('logoutSidebarBtn');

    if (!loginBtn || !logoutBtn) return;

    if (currentUser) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'flex';
        if (userEmailDisplay) {
            userEmailDisplay.innerHTML = `
                <span class="block text-white text-sm text-center px-4 py-2 rounded-xl bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 shadow-sm">
                    👤 ${currentUser.email}
                </span>
            `;

        }
    } else {
        loginBtn.style.display = 'flex';
        logoutBtn.style.display = 'none';
        if (userEmailDisplay) userEmailDisplay.innerHTML = '';
    }
}

function addUserPlusToSidebar(isUserPlus, isAdmin) {
    if (!sidebar) return;

    const userPlusItem = document.createElement('a');
    userPlusItem.href = '#';
    userPlusItem.onclick = () => {
        if (isUserPlus || isAdmin) {
            showNotification('Du hast bereits UserPlus! 🎉', 'success');
        } else {
            showUserPlusPurchase();
        }
        closeSidebar();
    };

        userPlusItem.innerHTML = `
            <div class="flex items-center space-x-3 p-3 rounded-xl transition-all duration-300 group hover:shadow-xl hover:scale-105 relative overflow-hidden bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600/50 userplus-ui">
                
                <!-- Shimmer Overlay -->
                <div class="absolute inset-0 bg-gradient-to-r from-white/20 via-white/50 to-white/20 rounded-xl opacity-70 pointer-events-none userplus-shimmer"></div>
                
                <!-- Icon -->
                <div class="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg userplus-icon">
                    <span class="text-white text-lg userplus-glow">⭐</span>
                </div>
        
                <!-- Text -->
                <div class="flex-1">
                    <div class="font-semibold text-white">
                        ${isUserPlus || isAdmin ? 'UserPlus Aktiv' : 'UserPlus kaufen'}
                    </div>
                    <div class="text-xs text-gray-300">
                        ${isUserPlus || isAdmin ? 'Premium Features aktiv' : '€4,99 - Swipe Back & InstaMatch'}
                    </div>
                </div>
        
                <!-- Status -->
                <div>
                    ${isUserPlus || isAdmin 
                        ? '<span class="text-green-400 font-bold">✓</span>' 
                        : '<span class="text-purple-400 font-semibold">€4,99</span>'
                    }
                </div>
            </div>
        `;

    const profileLink = sidebar.querySelector('a[onclick*="showProfilePopup"]');
    if (profileLink && profileLink.parentNode) {
        profileLink.parentNode.insertBefore(userPlusItem, profileLink.nextSibling);
    } else {
        sidebar.appendChild(userPlusItem);
    }
}

function showAbout() {
    showNotification('ℹ️ One-T-Meet: Finde die Liebe auf den schönsten Bänken der Welt! 💕🪑', 'success');
    closeSidebar();
}

// Globale Verfügbarkeit
window.toggleSidebar = toggleSidebar;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.updateAuthButtons = updateAuthButtons;
window.addUserPlusToSidebar = addUserPlusToSidebar;
window.showAbout = showAbout;

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing event listeners.");

    // Elemente initialisieren
    sidebar = document.getElementById('sidebar');
    overlay = document.getElementById('sidebarOverlay');
    mainLogo = document.getElementById('mainLogo');

    // Event-Listener
    if (overlay) overlay.addEventListener('click', closeSidebar);
    if (mainLogo) mainLogo.addEventListener('click', toggleSidebar);

    const loginBtn = document.getElementById('loginSidebarBtn');
    const logoutBtn = document.getElementById('logoutSidebarBtn');

    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeSidebar();
            // Login-Modal öffnen
            if (window.showLogin) {
                window.showLogin();
            } else {
                const modal = document.getElementById('loginModal');
                if (modal) modal.style.display = 'block';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (window.logout) window.logout();
            closeSidebar();
        });
    }
});
