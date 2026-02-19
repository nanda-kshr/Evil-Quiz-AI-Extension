class QuizExtensionPopup {
  constructor() {
    this.apiBase = 'https://evil-quiz-ai-backend.vercel.app/api/v1';
    this.timerInterval = null;
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.checkAuthStatus();
    await this.checkExistingTimer();
    await this.loadShortcut();
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateRateLimitTimer') {
        this.startRateLimitTimer(request.timeLeft);
      }
      return true;
    });
  }

  async checkExistingTimer() {
    const result = await chrome.storage.local.get(['rateLimitEndTime']);
    if (result.rateLimitEndTime) {
      const endTime = result.rateLimitEndTime;
      const now = Date.now();

      if (endTime > now) {
        // Timer is still active
        const timeLeft = Math.ceil((endTime - now) / 1000);
        this.startRateLimitTimer(timeLeft);
      } else {
        // Timer has expired
        await chrome.storage.local.remove(['rateLimitEndTime']);
      }
    }
  }

  bindEvents() {
    // Auth form toggles
    document.getElementById('showRegister').addEventListener('click', (e) => {
      e.preventDefault();
      this.showRegisterForm();
    });

    document.getElementById('showLogin').addEventListener('click', (e) => {
      e.preventDefault();
      this.showLoginForm();
    });

    document.getElementById('backToRegister').addEventListener('click', (e) => {
      e.preventDefault();
      this.showRegisterForm();
    });

    // Auth buttons
    document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
    document.getElementById('registerBtn').addEventListener('click', () => this.handleRegister());
    document.getElementById('verifyOtpBtn').addEventListener('click', () => this.handleOtpVerification());

    // Main screen buttons
    document.getElementById('refreshCreditsBtn').addEventListener('click', () => this.refreshCredits());
    document.getElementById('buyCreditsBtn').addEventListener('click', () => this.handleBuyCredits());
    document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

    // Shortcut buttons
    const recordBtn = document.getElementById('recordShortcutBtn');
    const clearBtn = document.getElementById('clearShortcutBtn');

    if (recordBtn) {
      recordBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent default focus/action
        this.startShortcutRecording();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearShortcut();
      });
    }

    // Enter key handling
    document.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const activeForm = document.querySelector('.form.active');
        if (activeForm && activeForm.id === 'loginForm') {
          this.handleLogin();
        } else if (activeForm && activeForm.id === 'registerForm') {
          this.handleRegister();
        } else if (activeForm && activeForm.id === 'otpForm') {
          this.handleOtpVerification();
        }
      }
    });
  }

  async checkAuthStatus() {
    try {
      const result = await chrome.storage.sync.get(['accessToken', 'userInfo']);

      if (result.accessToken && result.userInfo) {
        // User is logged in, hide entire auth section and show main screen
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('mainScreen').style.display = 'block';

        await this.showMainScreen(result.userInfo);
        await this.refreshCredits();
      } else {
        // User is not logged in, show auth section
        this.showAuthScreen();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.showAuthScreen();
    }
  }

  showAuthScreen() {
    document.getElementById('authScreen').style.display = 'block';
    document.getElementById('mainScreen').style.display = 'none';
    // Reset all forms to initial state
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('otpForm').classList.remove('active');
    this.clearForms();
    this.clearErrors();
  }

  showMainScreen(userInfo) {
    const authScreen = document.getElementById('authScreen');
    const mainScreen = document.getElementById('mainScreen');

    authScreen.style.display = 'none';
    mainScreen.style.display = 'block';
    mainScreen.style.visibility = 'visible';

    document.getElementById('userName').textContent = userInfo.name;
    document.getElementById('userCredits').textContent = `${userInfo.credits} credits`;
  }

  showLoginForm() {
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('registerForm').classList.remove('active');
    this.clearErrors();
  }

  showRegisterForm() {
    document.getElementById('registerForm').classList.add('active');
    document.getElementById('loginForm').classList.remove('active');
    this.clearErrors();
  }

  showOtpForm(email) {
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('otpForm').classList.add('active');
    document.getElementById('otpEmail').value = email;
    this.clearErrors();
  }

  async handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      this.showError('authError', 'Please fill in all fields to join the dark side');
      return;
    }

    this.showLoading('authLoading', true);
    this.clearErrors();

    try {
      const response = await fetch(`${this.apiBase}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.status === 429) {
        throw new Error('Try after 1 minute');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enter the dark side');
      }

      // Save auth data
      await chrome.storage.sync.set({
        accessToken: data.access_token,
        userInfo: data.user
      });

      await this.showMainScreen(data.user);
      this.clearForms();

    } catch (error) {
      console.error('Login error:', error);
      this.showError('authError', error.message);
    } finally {
      this.showLoading('authLoading', false);
    }
  }

  async handleRegister() {
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;

    if (!name || !email || !password) {
      this.showError('authError', 'Please fill in all fields to begin your evil journey');
      return;
    }

    if (password.length < 6) {
      this.showError('authError', 'Your secret password must be at least 6 characters');
      return;
    }

    this.showLoading('authLoading', true);
    this.clearErrors();

    try {
      const response = await fetch(`${this.apiBase}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.status === 429) {
        throw new Error('Try after 1 minute');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join the evil alliance');
      }

      // Show OTP form
      this.showOtpForm(email);

    } catch (error) {
      console.error('Registration error:', error);
      this.showError('authError', error.message);
    } finally {
      this.showLoading('authLoading', false);
    }
  }

  async handleOtpVerification() {
    const email = document.getElementById('otpEmail').value.trim();
    const otp = document.getElementById('otpCode').value.trim();

    if (!otp) {
      this.showError('authError', 'Please enter the OTP code');
      return;
    }

    this.showLoading('authLoading', true);
    this.clearErrors();

    try {
      const response = await fetch(`${this.apiBase}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.status === 429) {
        throw new Error('Try after 1 minute');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify OTP');
      }

      // Save auth data
      await chrome.storage.sync.set({
        accessToken: data.access_token,
        userInfo: data.user
      });

      await this.showMainScreen(data.user);
      this.clearForms();

    } catch (error) {
      console.error('OTP verification error:', error);
      this.showError('authError', error.message);
    } finally {
      this.showLoading('authLoading', false);
    }
  }

  async refreshCredits() {
    try {
      const result = await chrome.storage.sync.get(['accessToken']);

      if (!result.accessToken) return;

      const response = await fetch(`${this.apiBase}/get-credits`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${result.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 429) {
        // Set rate limit end time (1 minute from now)
        const endTime = Date.now() + 60000;
        await chrome.storage.local.set({ rateLimitEndTime: endTime });
        this.startRateLimitTimer(60);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        document.getElementById('userCredits').textContent = `${data.credits} credits`;

        // Update stored user info
        const userInfo = await chrome.storage.sync.get(['userInfo']);
        if (userInfo.userInfo) {
          userInfo.userInfo.credits = data.credits;
          await chrome.storage.sync.set({ userInfo: userInfo.userInfo });
        }
      } else if (response.status === 401) {
        await this.handleLogout();
        this.showError('authError', 'Your dark powers have expired. Please login again.');
      }
    } catch (error) {
      console.error('Failed to refresh evil powers:', error);
    }
  }

  startRateLimitTimer(initialTime = 60) {
    // Clear any existing timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Show timer element
    const timerElement = document.getElementById('rateLimitTimer');
    const timerCount = document.getElementById('timerCount');

    // Ensure the timer is visible
    timerElement.style.display = 'block';
    timerElement.style.visibility = 'visible';
    timerElement.classList.remove('hidden');

    // Start with provided time
    let timeLeft = initialTime;
    timerCount.textContent = timeLeft;

    // Update timer every second
    this.timerInterval = setInterval(async () => {
      timeLeft--;
      timerCount.textContent = timeLeft;

      if (timeLeft <= 0) {
        clearInterval(this.timerInterval);
        timerElement.style.display = 'none';
        timerElement.style.visibility = 'hidden';
        timerElement.classList.add('hidden');
        this.timerInterval = null;
        // Clear the stored end time
        await chrome.storage.local.remove(['rateLimitEndTime']);
      }
    }, 1000);
  }

  handleBuyCredits() {
    try {
      const telegramUsername = 'elbeastz';
      const message = encodeURIComponent('Hey I would like to get more credits on evil quiz ai');
      const telegramUrl = `https://t.me/${telegramUsername}?text=${message}`;

      chrome.tabs.create({ url: telegramUrl });

    } catch (error) {
      console.error('Failed to open Telegram:', error);
      this.showError('mainError', 'Failed to open Telegram. Please visit @elbeastz manually.');
    }
  }

  async handleLogout() {
    await chrome.storage.sync.clear();
    this.showAuthScreen();
    this.clearForms();
  }

  showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');

    // Make sure the error is visible for at least 3 seconds
    setTimeout(() => {
      errorEl.classList.add('hidden');
    }, 10000);
  }

  clearErrors() {
    document.querySelectorAll('.error').forEach(el => {
      el.classList.add('hidden');
      el.textContent = '';
    });
  }

  showLoading(elementId, show) {
    const loadingEl = document.getElementById(elementId);
    if (show) {
      loadingEl.classList.remove('hidden');
    } else {
      loadingEl.classList.add('hidden');
    }
  }

  clearForms() {
    document.querySelectorAll('input').forEach(input => input.value = '');
  }

  async loadShortcut() {
    try {
      const data = await chrome.storage.sync.get(['evilShortcut']);
      const btn = document.getElementById('recordShortcutBtn');
      const clearBtn = document.getElementById('clearShortcutBtn');

      if (data.evilShortcut && btn && clearBtn) {
        btn.textContent = data.evilShortcut.display;
        btn.style.borderColor = '#ff0066';
        btn.style.color = '#ff0066';
        clearBtn.style.display = 'block';
      }
    } catch (error) {
      console.error('Failed to load shortcut:', error);
    }
  }

  startShortcutRecording() {
    const btn = document.getElementById('recordShortcutBtn');
    if (!btn) return;

    const originalText = btn.textContent;
    btn.textContent = 'Press any key combo...';
    btn.style.borderColor = '#ff0066';
    btn.style.background = 'rgba(255, 0, 102, 0.1)';

    const recordHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore isolated modifier keys
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

      const modifiers = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.metaKey) modifiers.push('Command');

      const key = e.key.toUpperCase();

      // If no modifiers and a simple key, might be risky but let's allow it for now or enforce at least one modifier?
      // For safety, let's enforce at least one modifier if it's a common key, but let's keep it simple.
      // Actually, best practice is to require at least one modifier or Function key.

      const shortcut = {
        modifiers: modifiers,
        key: key,
        display: [...modifiers, key].join(' + ')
      };

      // Save shortcut
      await chrome.storage.sync.set({ evilShortcut: shortcut });

      // Update UI
      btn.textContent = shortcut.display;
      btn.style.color = '#ff0066';

      const clearBtn = document.getElementById('clearShortcutBtn');
      if (clearBtn) clearBtn.style.display = 'block';

      // Cleanup
      document.removeEventListener('keydown', recordHandler);
      btn.style.background = 'rgba(0, 0, 0, 0.2)';
    };

    document.addEventListener('keydown', recordHandler);

    // Cancel on blur or click away (optional, but good UX)
    const cancelHandler = (e) => {
      if (e.target !== btn) {
        document.removeEventListener('keydown', recordHandler);
        document.removeEventListener('click', cancelHandler);
        // Only reset if we didn't just save a new one (simple check: if text is still prompt)
        if (btn.textContent === 'Press any key combo...') {
          this.loadShortcut().then(() => {
            if (btn.textContent === 'Press any key combo...') {
              btn.textContent = 'Click to set shortcut';
              btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              btn.style.background = 'rgba(0, 0, 0, 0.2)';
            }
          });
        }
      }
    };

    // Slight delay to avoid registering the click that opened this
    setTimeout(() => {
      document.addEventListener('click', cancelHandler);
    }, 100);
  }

  async clearShortcut() {
    await chrome.storage.sync.remove(['evilShortcut']);

    const btn = document.getElementById('recordShortcutBtn');
    const clearBtn = document.getElementById('clearShortcutBtn');

    if (btn) {
      btn.textContent = 'Click to set shortcut';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      btn.style.color = '#a0a6b8';
      btn.style.background = 'rgba(0, 0, 0, 0.2)';
    }

    if (clearBtn) {
      clearBtn.style.display = 'none';
    }
  }
}

// Initialize evil popup
document.addEventListener('DOMContentLoaded', () => {
  new QuizExtensionPopup();
});