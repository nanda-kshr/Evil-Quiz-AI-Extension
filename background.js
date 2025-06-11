class QuizExtensionBackground {
  constructor() {
    this.debugMode = true;
    this.apiBase = 'https://evil-quiz-ai-backend.vercel.app/api/v1';
    this.init();
  }

  init() {
    this.log('Evil Quiz AI Background script initialized');
    this.bindEvents();
    this.setupInitialContextMenu();
  }

  async setupInitialContextMenu() {
    try {
      await chrome.contextMenus.removeAll();
      this.log('Initial context menus cleared');
      // Create a test context menu that's always visible
      chrome.contextMenus.create({
        id: "testMenu",
        title: "⚡ Evil Quiz AI Test (Always Visible)",
        contexts: ["page", "selection"]
      });
      this.log('Test context menu created');
    } catch (error) {
      this.log('Error in initial setup:', error);
    }
  }

  bindEvents() {
    this.log('Binding evil background events');
    
    // Extension installation
    chrome.runtime.onInstalled.addListener(() => {
      this.log('Evil extension installed/updated');
      this.setupInitialContextMenu();
    });

    // Context menu clicks
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      this.log('Context menu clicked:', {
        menuItemId: info.menuItemId,
        hasSelection: !!info.selectionText,
        selectionText: info.selectionText?.substring(0, 50) + '...'
      });

      if (info.menuItemId === "getAnswer" && info.selectionText) {
        this.handleAnswerRequest(info.selectionText, tab.id);
      } else if (info.menuItemId === "testMenu") {
        this.log('Test menu clicked - creating AI answer menu');
        // Force create the AI answer menu
        await this.createAIAnswerMenu();
        this.showNotification('Evil AI Answer menu created! Select text and right-click again.', 'info');
      }
    });

    // Messages from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.log('Received message:', request);
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'test':
          sendResponse({ success: true, message: 'Evil background script is working' });
          break;
        case 'textSelected':
          await this.handleTextSelection(request.hasSelection, request.selectedText);
          sendResponse({ success: true });
          break;
        case 'manualTest':
          await this.createAIAnswerMenu();
          sendResponse({ success: true, message: 'Evil AI Answer menu created manually' });
          break;
        case 'openPopup':
          // Handle popup opening request
          this.log('Popup open requested');
          sendResponse({ success: true });
          break;
        case 'refreshCredits':
          // Handle credit refresh request
          await this.handleCreditRefresh();
          sendResponse({ success: true });
          break;
        default:
          this.log('Unknown action:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      this.log('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async createAIAnswerMenu() {
    try {
      await chrome.contextMenus.removeAll();
      // Create both menus
      chrome.contextMenus.create({
        id: "testMenu",
        title: "⚡ Evil Quiz AI Test (Always Visible)",
        contexts: ["page", "selection"]
      });
      chrome.contextMenus.create({
        id: "getAnswer",
        title: "🧠 Get Evil AI Answer",
        contexts: ["selection"]
      });
      this.log('✅ Both context menus created manually');
    } catch (error) {
      this.log('❌ Error creating menus manually:', error);
    }
  }

  async handleTextSelection(hasSelection, selectedText) {
    try {
      this.log('=== HANDLING TEXT SELECTION ===');
      this.log('Has selection:', hasSelection);
      this.log('Selected text length:', selectedText ? selectedText.length : 0);
      this.log('Selected text preview:', selectedText ? selectedText.substring(0, 100) + '...' : 'none');

      // Remove all existing menus first
      await chrome.contextMenus.removeAll();
      this.log('All context menus removed');

      // Always create test menu
      chrome.contextMenus.create({
        id: "testMenu",
        title: "⚡ Evil Quiz AI Test (Always Visible)",
        contexts: ["page", "selection"]
      });
      this.log('Test menu recreated');

      // Create answer menu if text is selected (regardless of auth status)
      if (hasSelection && selectedText && selectedText.trim().length > 0) {
        this.log('Selection detected, creating answer menu...');
        
        try {
          chrome.contextMenus.create({
            id: "getAnswer",
            title: "🧠 Get Evil AI Answer",
            contexts: ["selection"]
          });
          this.log('✅ Get Evil AI Answer menu created successfully!');
        } catch (createError) {
          this.log('❌ Error creating answer menu:', createError);
        }
      } else {
        this.log('❌ No valid selection detected');
      }
      
      this.log('=== END TEXT SELECTION HANDLING ===');
    } catch (error) {
      this.log('❌ Error handling text selection:', error);
    }
  }

  async handleAnswerRequest(selectedText, tabId) {
    try {
      this.log('🚀 Starting evil answer request...');
      
      const authData = await chrome.storage.sync.get(['accessToken', 'userInfo']);
      
      // Check if user is logged in
      if (!authData.accessToken) {
        await this.createLoginRequiredPopup(tabId);
        return;
      }

      if (!selectedText || selectedText.trim().length < 10) {
        await this.showNotification('Select more text to unleash the power (at least 10 characters)', 'error');
        return;
      }

      // Check credits before making request
      const userCredits = authData.userInfo?.credits || 0;
      if (userCredits <= 0) {
        await this.createNoCreditsPopup(tabId);
        return;
      }

      await this.showNotification('Summoning evil AI powers...', 'info');

      const response = await fetch(`${this.apiBase}/get-answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authData.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: selectedText.trim() }),
      });

      const data = await response.json();
      this.log('✅ API response received:', data);

      if (!response.ok) {
        if (response.status === 401) {
          await this.createLoginRequiredPopup(tabId);
          await chrome.storage.sync.clear();
        } else if (response.status === 403 || (data.error && data.error.includes('credit'))) {
          // Handle insufficient credits from API
          await this.createNoCreditsPopup(tabId);
        } else {
          throw new Error(data.error || 'Failed to get answer');
        }
        return;
      }

      let aiAnswer;
      try {
        aiAnswer = JSON.parse(data.answer);
      } catch (parseError) {
        aiAnswer = { answer: data.answer };
      }

      // Update user credits after successful request
      if (data.remaining_credits !== undefined) {
        const updatedUserInfo = { ...authData.userInfo, credits: data.remaining_credits };
        await chrome.storage.sync.set({ userInfo: updatedUserInfo });
      }

      await this.createAnswerPopup(tabId, aiAnswer, data.remaining_credits, selectedText);
    } catch (error) {
      this.log('❌ Answer request failed:', error);
      await this.showNotification(`Error: ${error.message}`, 'error');
    }
  }

  async createLoginRequiredPopup(tabId) {
    try {
      this.log('🔐 Creating login required popup...');
      
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // Remove existing popup
          const existing = document.getElementById('quiz-ai-popup');
          if (existing) existing.remove();

          // Create login required popup
          const popup = document.createElement('div');
          popup.id = 'quiz-ai-popup';
          popup.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            width: 350px !important;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%) !important;
            border: 2px solid #ff0066 !important;
            border-radius: 20px !important;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 0, 102, 0.3) !important;
            z-index: 999999 !important;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif !important;
            animation: evilSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) !important;
            backdrop-filter: blur(10px) !important;
            color: #e0e6ed !important;
          `;

          popup.innerHTML = `
            <div style="background: linear-gradient(135deg, #ff4757, #ff3742); color: white; padding: 18px; border-radius: 18px 18px 0 0; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden;">
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #ff4757, #ff6b7d, #ff4757); animation: gradientMove 3s linear infinite;"></div>
              <h3 style="margin: 0; font-size: 18px; font-weight: 700; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">🔐 Join the Dark Side</h3>
              <button id="closeBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 20px; cursor: pointer; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; backdrop-filter: blur(10px);">&times;</button>
            </div>
            <div style="padding: 25px; text-align: center; position: relative;">
              <div style="font-size: 48px; margin-bottom: 15px; animation: pulse 2s infinite;">😈</div>
              <div style="background: rgba(255, 71, 87, 0.2); padding: 20px; border-radius: 16px; border: 2px solid #ff4757; margin-bottom: 20px; position: relative; backdrop-filter: blur(10px);">
                <div style="font-size: 18px; font-weight: bold; color: #ff6b7d; margin-bottom: 10px;">Login Required!</div>
                <div style="font-size: 14px; color: #ff9aa2; line-height: 1.5;">You must join the dark side first to unleash the evil AI powers!</div>
              </div>
              <button id="loginBtn" style="background: linear-gradient(135deg, #ff0066, #8a2be2); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(255, 0, 102, 0.3); width: 100%;">
                🚪 Open Extension & Login
              </button>
              <div style="margin-top: 15px; font-size: 12px; color: #a0a6b8; font-style: italic;">
                Auto-closes in <span id="countdown" style="font-weight: bold; color: #ff0066;">5</span>s
              </div>
            </div>
          `;

          // Add styles if not exist
          if (!document.getElementById('evil-quiz-ai-styles')) {
            const style = document.createElement('style');
            style.id = 'evil-quiz-ai-styles';
            style.textContent = `
              @keyframes evilSlideIn {
                from { transform: translateX(100%) scale(0.8); opacity: 0; }
                to { transform: translateX(0) scale(1); opacity: 1; }
              }
              @keyframes gradientMove {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
              @keyframes pulse {
                0%, 100% { opacity: 0.8; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.1); }
              }
            `;
            document.head.appendChild(style);
          }

          document.body.appendChild(popup);

          // Close functionality
          const closeBtn = popup.querySelector('#closeBtn');
          closeBtn.addEventListener('click', () => {
            popup.style.animation = 'evilSlideIn 0.3s ease-out reverse';
            setTimeout(() => popup.remove(), 300);
          });

          // Login button functionality
          const loginBtn = popup.querySelector('#loginBtn');
          loginBtn.addEventListener('click', () => {
            // Try to open extension popup
            if (chrome.runtime && chrome.runtime.id) {
              chrome.runtime.sendMessage({ action: 'openPopup' });
            }
            popup.remove();
          });

          // Hover effects
          loginBtn.addEventListener('mouseenter', () => {
            loginBtn.style.transform = 'translateY(-2px)';
            loginBtn.style.boxShadow = '0 6px 20px rgba(255, 0, 102, 0.4)';
          });

          loginBtn.addEventListener('mouseleave', () => {
            loginBtn.style.transform = 'translateY(0)';
            loginBtn.style.boxShadow = '0 4px 15px rgba(255, 0, 102, 0.3)';
          });

          // Countdown and auto-close
          let countdown = 5;
          const countdownEl = popup.querySelector('#countdown');
          const interval = setInterval(() => {
            countdown--;
            if (countdownEl) {
              countdownEl.textContent = countdown;
              countdownEl.style.color = countdown <= 1 ? '#ff4757' : '#ff0066';
            }
            if (countdown <= 0) {
              clearInterval(interval);
              if (popup.parentNode) {
                popup.style.animation = 'evilSlideIn 0.3s ease-out reverse';
                setTimeout(() => popup.remove(), 300);
              }
            }
          }, 1000);

          console.log('✅ Login required popup created!');
        }
      });

      this.log('✅ Login required popup injected successfully');
    } catch (error) {
      this.log('❌ Failed to create login popup:', error);
      await this.showNotification('Login required! Open the extension to sign in.', 'error');
    }
  }

  async createNoCreditsPopup(tabId) {
    try {
      this.log('💰 Creating no credits popup...');
      
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // Remove existing popup
          const existing = document.getElementById('quiz-ai-popup');
          if (existing) existing.remove();

          // Create no credits popup
          const popup = document.createElement('div');
          popup.id = 'quiz-ai-popup';
          popup.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            width: 350px !important;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%) !important;
            border: 2px solid #ff9500 !important;
            border-radius: 20px !important;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 149, 0, 0.3) !important;
            z-index: 999999 !important;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif !important;
            animation: evilSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) !important;
            backdrop-filter: blur(10px) !important;
            color: #e0e6ed !important;
          `;

          popup.innerHTML = `
            <div style="background: linear-gradient(135deg, #ff9500, #ffad33); color: white; padding: 18px; border-radius: 18px 18px 0 0; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden;">
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #ff9500, #ffad33, #ff9500); animation: gradientMove 3s linear infinite;"></div>
              <h3 style="margin: 0; font-size: 18px; font-weight: 700; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">💰 No Evil Power Left</h3>
              <button id="closeBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 20px; cursor: pointer; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; backdrop-filter: blur(10px);">&times;</button>
            </div>
            <div style="padding: 25px; text-align: center; position: relative;">
              <div style="font-size: 48px; margin-bottom: 15px; animation: pulse 2s infinite;">⚡</div>
              <div style="background: rgba(255, 149, 0, 0.2); padding: 20px; border-radius: 16px; border: 2px solid #ff9500; margin-bottom: 20px; position: relative; backdrop-filter: blur(10px);">
                <div style="font-size: 24px; font-weight: bold; color: #ff9500; margin-bottom: 10px;">0 Credits Remaining</div>
                <div style="font-size: 14px; color: #ffad33; line-height: 1.5; margin-bottom: 15px;">Your evil powers have been depleted! Recharge to continue dominating quizzes.</div>
                <div style="background: rgba(255, 255, 255, 0.1); padding: 12px; border-radius: 8px; font-size: 12px; color: #ffd700;">
                  💡 <strong>Tip:</strong> Credits recharge automatically or contact support for more power!
                </div>
              </div>
              <button id="refreshBtn" style="background: linear-gradient(135deg, #ff9500, #ffad33); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(255, 149, 0, 0.3); width: 100%; margin-bottom: 10px;">
                🔄 Check Credits Again
              </button>
              <div style="margin-top: 15px; font-size: 12px; color: #a0a6b8; font-style: italic;">
                Auto-closes in <span id="countdown" style="font-weight: bold; color: #ff9500;">6</span>s
              </div>
            </div>
          `;

          // Add styles if not exist
          if (!document.getElementById('evil-quiz-ai-styles')) {
            const style = document.createElement('style');
            style.id = 'evil-quiz-ai-styles';
            style.textContent = `
              @keyframes evilSlideIn {
                from { transform: translateX(100%) scale(0.8); opacity: 0; }
                to { transform: translateX(0) scale(1); opacity: 1; }
              }
              @keyframes gradientMove {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
              @keyframes pulse {
                0%, 100% { opacity: 0.8; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.1); }
              }
            `;
            document.head.appendChild(style);
          }

          document.body.appendChild(popup);

          // Close functionality
          const closeBtn = popup.querySelector('#closeBtn');
          closeBtn.addEventListener('click', () => {
            popup.style.animation = 'evilSlideIn 0.3s ease-out reverse';
            setTimeout(() => popup.remove(), 300);
          });

          // Refresh button functionality
          const refreshBtn = popup.querySelector('#refreshBtn');
          refreshBtn.addEventListener('click', () => {
            // Send message to refresh credits
            if (chrome.runtime && chrome.runtime.id) {
              chrome.runtime.sendMessage({ action: 'refreshCredits' });
            }
            popup.remove();
          });

          // Hover effects
          refreshBtn.addEventListener('mouseenter', () => {
            refreshBtn.style.transform = 'translateY(-2px)';
            refreshBtn.style.boxShadow = '0 6px 20px rgba(255, 149, 0, 0.4)';
          });

          refreshBtn.addEventListener('mouseleave', () => {
            refreshBtn.style.transform = 'translateY(0)';
            refreshBtn.style.boxShadow = '0 4px 15px rgba(255, 149, 0, 0.3)';
          });

          // Countdown and auto-close
          let countdown = 6;
          const countdownEl = popup.querySelector('#countdown');
          const interval = setInterval(() => {
            countdown--;
            if (countdownEl) {
              countdownEl.textContent = countdown;
              countdownEl.style.color = countdown <= 1 ? '#ff4757' : '#ff9500';
            }
            if (countdown <= 0) {
              clearInterval(interval);
              if (popup.parentNode) {
                popup.style.animation = 'evilSlideIn 0.3s ease-out reverse';
                setTimeout(() => popup.remove(), 300);
              }
            }
          }, 1000);

          console.log('✅ No credits popup created!');
        }
      });

      this.log('✅ No credits popup injected successfully');
    } catch (error) {
      this.log('❌ Failed to create no credits popup:', error);
      await this.showNotification('No credits remaining! Open extension to check balance.', 'error');
    }
  }

  async createAnswerPopup(tabId, answer, credits, originalQuestion) {
    try {
      this.log('🎨 Creating evil answer popup...');
      // Inject the popup via scripting API
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (answer, credits) => {
          // Remove existing popup
          const existing = document.getElementById('quiz-ai-popup');
          if (existing) existing.remove();

          // Create popup with Evil Quiz AI styling
          const popup = document.createElement('div');
          popup.id = 'quiz-ai-popup';
          popup.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            width: 350px !important;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%) !important;
            border: 2px solid #ff0066 !important;
            border-radius: 20px !important;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 0, 102, 0.3) !important;
            z-index: 999999 !important;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif !important;
            animation: evilSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) !important;
            backdrop-filter: blur(10px) !important;
            color: #e0e6ed !important;
          `;

          const answerText = answer.correct_option && answer.correct_option !== 'ninte thantha'
            ? answer.correct_option.toUpperCase()
            : (answer.answer || 'No answer found');

          popup.innerHTML = `
            <div style="background: linear-gradient(135deg, #ff0066, #8a2be2); color: white; padding: 18px; border-radius: 18px 18px 0 0; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden;">
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #ff0066, #8a2be2, #ff4500); animation: gradientMove 3s linear infinite;"></div>
              <h3 style="margin: 0; font-size: 18px; font-weight: 700; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">🧠 Evil AI Answer ⚡</h3>
              <button id="closeBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 20px; cursor: pointer; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; backdrop-filter: blur(10px);">&times;</button>
            </div>
            <div style="padding: 25px; text-align: center; position: relative;">
              <div style="background: linear-gradient(135deg, rgba(52, 168, 83, 0.3), rgba(52, 168, 83, 0.1)); padding: 25px; border-radius: 16px; border: 2px solid #34a853; margin-bottom: 20px; position: relative; backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(52, 168, 83, 0.2);">
                <div style="font-size: 32px; font-weight: bold; color: #34a853; text-shadow: 0 2px 10px rgba(52, 168, 83, 0.3); margin-bottom: 8px;">${answerText}</div>
                <div style="font-size: 14px; color: #a0f0a0; font-weight: 500;">Correct Answer Revealed!</div>
                <div style="position: absolute; top: 15px; right: 15px; font-size: 24px; animation: pulse 2s infinite;">✅</div>
              </div>
              <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);">
                <div style="font-size: 13px; color: #a0a6b8; display: flex; justify-content: space-between; align-items: center;">
                  <span style="display: flex; align-items: center; gap: 5px;">
                    <span style="background: linear-gradient(135deg, #ff0066, #8a2be2); padding: 4px 8px; border-radius: 10px; color: white; font-weight: 600;">⚡ ${credits} Credits</span>
                  </span>
                  <span style="font-style: italic;">Auto-closes in <span id="countdown" style="font-weight: bold; color: #ff0066;">4</span>s</span>
                </div>
              </div>
            </div>
          `;

          // Add enhanced animation keyframes and styles
          if (!document.getElementById('evil-quiz-ai-styles')) {
            const style = document.createElement('style');
            style.id = 'evil-quiz-ai-styles';
            style.textContent = `
              @keyframes evilSlideIn {
                from { 
                  transform: translateX(100%) scale(0.8); 
                  opacity: 0; 
                }
                to { 
                  transform: translateX(0) scale(1); 
                  opacity: 1; 
                }
              }
              @keyframes gradientMove {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
              @keyframes pulse {
                0%, 100% { opacity: 0.8; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.1); }
              }
              #quiz-ai-popup #closeBtn:hover {
                background: rgba(255,255,255,0.3) !important;
                transform: rotate(90deg) !important;
              }
            `;
            document.head.appendChild(style);
          }

          document.body.appendChild(popup);

          // Enhanced close functionality
          const closeBtn = popup.querySelector('#closeBtn');
          closeBtn.addEventListener('click', () => {
            popup.style.animation = 'evilSlideIn 0.3s ease-out reverse';
            setTimeout(() => popup.remove(), 300);
          });

          closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.3)';
            closeBtn.style.transform = 'rotate(90deg)';
          });

          closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.2)';
            closeBtn.style.transform = 'rotate(0deg)';
          });

          // Enhanced countdown and auto-close
          let countdown = 4;
          const countdownEl = popup.querySelector('#countdown');
          const interval = setInterval(() => {
            countdown--;
            if (countdownEl) {
              countdownEl.textContent = countdown;
              countdownEl.style.color = countdown <= 1 ? '#ff4757' : '#ff0066';
            }
            if (countdown <= 0) {
              clearInterval(interval);
              if (popup.parentNode) {
                popup.style.animation = 'evilSlideIn 0.3s ease-out reverse';
                setTimeout(() => popup.remove(), 300);
              }
            }
          }, 1000);

          console.log('✅ Evil Quiz AI popup created successfully!');
        },
        args: [answer, credits]
      });
      this.log('✅ Evil popup injected successfully');
    } catch (error) {
      this.log('❌ Failed to create evil popup:', error);
      // Fallback to notification
      const answerText = answer.correct_option
        ? `Evil Answer: ${answer.correct_option.toUpperCase()}`
        : (answer.answer || 'Answer received from the dark side');
      await this.showNotification(answerText, 'success');
    }
  }

  async handleCreditRefresh() {
    try {
      const authData = await chrome.storage.sync.get(['accessToken']);
      if (!authData.accessToken) return;

      const response = await fetch(`${this.apiBase}/get-credits`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authData.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update stored user info
        const userInfo = await chrome.storage.sync.get(['userInfo']);
        if (userInfo.userInfo) {
          const updatedUserInfo = { ...userInfo.userInfo, credits: data.credits };
          await chrome.storage.sync.set({ userInfo: updatedUserInfo });
        }

        this.showNotification(`Credits refreshed: ${data.credits} remaining`, 'success');
      } else {
        this.showNotification('Failed to refresh credits', 'error');
      }
    } catch (error) {
      this.log('Failed to refresh credits:', error);
      this.showNotification('Failed to refresh credits', 'error');
    }
  }

  async getAuthStatus() {
    try {
      const result = await chrome.storage.sync.get(['accessToken']);
      return { isAuthenticated: !!result.accessToken };
    } catch (error) {
      this.log('Error getting auth status:', error);
      return { isAuthenticated: false };
    }
  }

  async showNotification(message, type = 'info') {
    try {
      const notificationId = `evil-quiz-ai-${Date.now()}`;
      await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '⚡ Evil Quiz AI',
        message: message
      });
      this.log('📢 Evil notification shown:', message);
      setTimeout(() => {
        chrome.notifications.clear(notificationId);
      }, 4000);
    } catch (error) {
      this.log('❌ Error showing notification:', error);
    }
  }

  log(message, data = null) {
    if (this.debugMode) {
      console.log(`[Evil Quiz AI Background]`, message, data || '');
    }
  }
}

// Initialize evil background script
new QuizExtensionBackground();