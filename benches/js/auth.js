let loginCaptcha = null, registerCaptcha = null;
window.currentUser = null;

        // Auth Functions
        function showLogin() {
            document.getElementById('loginModal').style.display = 'flex';
			generateCaptchas();

			document.getElementById('loginTab').classList.add('active');
   		    document.getElementById('loginTabBtn').classList.add('active');
        }
        
        function closeLogin() {
            document.getElementById('loginModal').style.display = 'none';
        }
        
        function showTab(tab, event) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));

            document.getElementById(tab + 'Tab').classList.add('active');
            
            if (event && event.target) {
                event.target.classList.add('active');
            }
        }
		
        function generateCaptchas() {
            loginCaptcha = generateCaptcha();
            registerCaptcha = generateCaptcha();
            document.getElementById('loginCaptcha').textContent = `🤖 Sind Sie ein Roboter? ${loginCaptcha.question}`;
            document.getElementById('registerCaptcha').textContent = `🤖 Sind Sie ein Roboter? ${registerCaptcha.question}`;
        }
        
        function generateCaptcha() {
            const operations = [
                () => {
                    const a = Math.floor(Math.random() * 10) + 1;
                    const b = Math.floor(Math.random() * 10) + 1;
                    return { question: `${a} + ${b} = ?`, answer: a + b };
                },
                () => {
                    const a = Math.floor(Math.random() * 10) + 5;
                    const b = Math.floor(Math.random() * 5) + 1;
                    return { question: `${a} - ${b} = ?`, answer: a - b };
                },
                () => {
                    const a = Math.floor(Math.random() * 5) + 2;
                    const b = Math.floor(Math.random() * 5) + 2;
                    return { question: `${a} × ${b} = ?`, answer: a * b };
                }
            ];
            return operations[Math.floor(Math.random() * operations.length)]();
        }		

		async function register(event) {
			event.preventDefault();
			const email = document.getElementById('registerEmail').value;
			const password = document.getElementById('registerPassword').value;
			const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
			const captchaAnswer = parseInt(document.getElementById('registerCaptchaAnswer').value);

			if (password !== passwordConfirm) {
				showNotification('Passwörter stimmen nicht überein!', 'error');
				return;
			}

			if (password.length < 6) {
				showNotification('Passwort muss mindestens 6 Zeichen lang sein!', 'error');
				return;
			}
			
            if (captchaAnswer !== registerCaptcha.answer) {
                showNotification('Falsche CAPTCHA-Antwort! Bitte versuchen Sie es erneut.', 'error');
                generateCaptchas();
                document.getElementById('registerCaptchaAnswer').value = '';
                return;
            }

			try {
				// Verwende deine bestehende auth.js Funktion (gleich wie index.html)
				const response = await fetch('/.netlify/functions/auth', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ 
						action: 'register', 
						email: email, 
						password: password 
					})
				});

				const result = await response.json();

				if (result.success) {
				  currentUser = { 
				    uid: result.userId,
				    email: result.email,
				    isAdmin: result.isAdmin || false 
				  };
				
				  localStorage.setItem('currentUser', JSON.stringify(currentUser));
				
				  closeLogin();
				  updateAuthButtons(currentUser);
				  showNotification(`🎉 Willkommen ${currentUser.email}!`, 'success');
				
				  updateFloatingButtons();
				  checkAndRenderUI();
					
				} else {
					showNotification('❌ ' + result.error, 'error');
				}
			} catch (error) {
				console.error('Registration error:', error);
				showNotification('❌ Verbindungsfehler bei der Registrierung', 'error');
			}
		}

		async function login(event) {
			event.preventDefault();

			const email = document.getElementById('loginEmail').value;
			const password = document.getElementById('loginPassword').value;
            const captchaAnswer = parseInt(document.getElementById('loginCaptchaAnswer').value);
			
            if (captchaAnswer !== loginCaptcha.answer) {
                showNotification('Falsche CAPTCHA-Antwort! Bitte versuchen Sie es erneut.', 'error');
                generateCaptchas();
                document.getElementById('loginCaptchaAnswer').value = '';
                return;			
			}

			try {
				const response = await fetch('/.netlify/functions/auth', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ 
						action: 'login', 
						email: email, 
						password: password 
					})
				});

				const result = await response.json();

				if (result.success) {
					currentUser = { 
						uid: result.userId,  // ← Jetzt kommt die echte DB-ID
						email: result.email, 
						isAdmin: result.isAdmin || false 
					};
					
					localStorage.setItem('currentUser', JSON.stringify(currentUser));
					
					closeLogin();
					updateAuthButtons(currentUser);
					showNotification(`🎉 Willkommen ${currentUser.email}!`, 'success');
					
					document.getElementById('loginEmail').value = '';
					document.getElementById('loginPassword').value = '';
                    document.getElementById('loginCaptchaAnswer').value = '';					
					updateFloatingButtons(); // <-- Diese Zeile hinzufügen
					
				  	checkAndRenderUI();
					
				} else {
					showNotification('❌ ' + result.error, 'error');
				}
			} catch (error) {
				console.error('Login error:', error);
				showNotification('❌ Verbindungsfehler beim Anmelden', 'error');
			}
		}		
        function logout() {
            currentUser = null;
            localStorage.removeItem('currentUser');
            updateAuthButtons(currentUser);
            showNotification('👋 Erfolgreich abgemeldet!', 'success');
            showWelcome();
			window.location.reload(); 
        }
		function showPasswordResetForm() {
		  document.getElementById("loginTab").style.display = "none";
		  document.getElementById("registerTab").style.display = "none";
		  document.getElementById("authTabsContainer").style.display = "none";
		  document.getElementById("passwordResetDiv").style.display = "block";
		}
		
		function hidePasswordResetForm() {
		  document.getElementById("passwordResetDiv").style.display = "none";
		  document.getElementById("loginTab").style.display = "block"; // zurück zu Login
		  document.getElementById("authTabsContainer").style.display = "flex"; 
		}
		
		async function requestPasswordReset() {
		  const email = document.getElementById("resetEmail").value;
		  if (!email) {
		    showNotification("❌ Bitte E-Mail eingeben.", "error");
		    return;
		  }
		
		  try {
		    const response = await fetch("/.netlify/functions/auth", {
		      method: "POST",
		      headers: { "Content-Type": "application/json" },
		      body: JSON.stringify({ action: "resetPassword", email })
		    });
		
		    const result = await response.json();
		    if (result.success) {
		      showNotification("📧 " + result.message, "success");
		      hidePasswordResetForm();
		    } else {
		      showNotification("❌ " + result.error, "error");
		    }
		  } catch (error) {
		    console.error("Reset error:", error);
		    showNotification("❌ Verbindungsfehler beim Zurücksetzen", "error");
		  }
		}


window.showLogin = showLogin;
window.closeLogin = closeLogin;
window.login = login;
window.logout = logout;
window.register = register;
window.showTab = showTab;
window.showPasswordResetForm = showPasswordResetForm;
window.hidePasswordResetForm = hidePasswordResetForm;
window.requestPasswordReset = requestPasswordReset;



document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginCloseBtn").addEventListener("click", closeLogin);
  document.getElementById("loginTabBtn").addEventListener("click", (e) => showTab("login", e));
  document.getElementById("registerTabBtn").addEventListener("click", (e) => showTab("register", e));
  document.getElementById("loginForm").addEventListener("submit", login);
  document.getElementById("registerForm").addEventListener("submit", register);
  document.getElementById("passwordResetForm").addEventListener("submit", (e) => {
    e.preventDefault();
    requestPasswordReset();
  });
  document.getElementById("passwordResetCancelBtn").addEventListener("click", hidePasswordResetForm);
  document.getElementById("passwordResetLink").addEventListener("click", (e) => {
    e.preventDefault();
    showPasswordResetForm();
  });
});
