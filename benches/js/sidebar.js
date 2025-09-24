document.addEventListener('DOMContentLoaded', () => {
    let sidebarOpen = false;

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const mainLogo = document.getElementById('mainLogo');

    function toggleSidebar() {
        sidebarOpen ? closeSidebar() : openSidebar();
    }

    function openSidebar() {
        sidebarOpen = true;
        sidebar.classList.add('active');
        overlay.classList.add('active');
        mainLogo.classList.add('sidebar-open');
    }

    function closeSidebar() {
        sidebarOpen = false;
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        mainLogo.classList.remove('sidebar-open');
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
                    <span style="color: #333; background: rgba(76,175,80,0.1); padding: 8px 12px; border-radius: 5px; display: block; text-align: center;">
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
            <div class="flex items-center space-x-3 p-3 hover:bg-gray-100 rounded-lg transition-colors">
                <div class="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span class="text-white text-lg">⭐</span>
                </div>
                <div class="flex-1">
                    <div class="font-semibold text-gray-800">${isUserPlus || isAdmin ? 'UserPlus Aktiv' : 'UserPlus kaufen'}</div>
                    <div class="text-xs text-gray-500">${isUserPlus || isAdmin ? 'Premium Features aktiv' : '€4,99 - Swipe Back & InstaMatch'}</div>
                </div>
                ${isUserPlus || isAdmin ? '<span class="text-green-500">✓</span>' : '<span class="text-purple-500">€4,99</span>'}
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

    // EventListener
    overlay.addEventListener('click', closeSidebar);
    mainLogo.addEventListener('click', toggleSidebar);

    // **Globale Verfügbarkeit für meet.html**
    window.toggleSidebar = toggleSidebar;
    window.openSidebar = openSidebar;
    window.closeSidebar = closeSidebar;
    window.updateAuthButtons = updateAuthButtons;
    window.addUserPlusToSidebar = addUserPlusToSidebar;
    window.showAbout = showAbout;
});
