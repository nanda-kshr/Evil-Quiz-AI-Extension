class QuizExtensionPopup {
  constructor() {
    this.apiBase = 'https://evil-quiz-ai-backend.vercel.app/api/v1';
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.checkAuthStatus();
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

    // Auth buttons
    document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
    document.getElementById('registerBtn').addEventListener('click', () => this.handleRegister());

    // Main screen buttons
    document.getElementById('refreshCreditsBtn').addEventListener('click', () => this.refreshCredits());
    document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

    // Enter key handling
    document.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const activeForm = document.querySelector('.form.active');
        if (activeForm && activeForm.id === 'loginForm') {
          this.handleLogin();
        } else if (activeForm && activeForm.id === 'registerForm') {
          this.handleRegister();
        }
      }
    });
  }

  async checkAuthStatus() {
    try {
      const result = await chrome.storage.sync.get(['accessToken', 'userInfo']);
      
      if (result.accessToken && result.userInfo) {
        await this.showMainScreen(result.userInfo);
        await this.refreshCredits();
      } else {
        this.showAuthScreen();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.showAuthScreen();
    }
  }

  showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('mainScreen').classList.add('hidden');
  }

  showMainScreen(userInfo) {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    
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

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join the evil alliance');
      }

      // Show success and switch to login
      this.showError('authError', 'Welcome to the dark side! Please login to begin.');
      this.clearForms();
      this.showLoginForm();

    } catch (error) {
      console.error('Registration error:', error);
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

  async handleLogout() {
    await chrome.storage.sync.clear();
    this.showAuthScreen();
    this.clearForms();
  }

  showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
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
}

// Initialize evil popup
document.addEventListener('DOMContentLoaded', () => {
  new QuizExtensionPopup();
});