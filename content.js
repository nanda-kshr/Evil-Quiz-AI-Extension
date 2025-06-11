class QuizExtensionContent {
  constructor() {
    this.lastSelection = '';
    this.debugMode = true;
    this.init();
  }

  init() {
    this.log('🚀 Evil Quiz AI Content script initialized');
    
    if (!this.isExtensionContextValid()) {
      this.log('❌ Extension context is invalid');
      return;
    }
    
    this.bindEvents();
    
    // Force initial check
    setTimeout(() => {
      this.forceSelectionCheck();
    }, 1000);
  }

  isExtensionContextValid() {
    try {
      return chrome.runtime && chrome.runtime.id;
    } catch (error) {
      return false;
    }
  }

  bindEvents() {
    this.log('🎯 Binding evil events');
    
    // Multiple selection detection methods
    document.addEventListener('mouseup', () => {
      this.log('👆 Mouse up detected');
      setTimeout(() => this.checkSelection(), 100);
    });
    
    document.addEventListener('keyup', () => {
      this.log('⌨️ Key up detected');
      setTimeout(() => this.checkSelection(), 100);
    });
    
    document.addEventListener('selectionchange', () => {
      this.log('📝 Selection change detected');
      setTimeout(() => this.checkSelection(), 100);
    });

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.log('📨 Evil message received:', request);
      if (request.action === 'showAnswer') {
        this.log('✅ Showing evil answer popup');
        sendResponse({ success: true });
      }
      return true;
    });

    // Test connection
    this.testConnection();
  }

  async testConnection() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'test' });
      this.log('🔗 Evil connection test successful:', response);
    } catch (error) {
      this.log('❌ Evil connection test failed:', error);
    }
  }

  forceSelectionCheck() {
    this.log('🔍 Force checking evil selection...');
    this.checkSelection();
  }

  checkSelection() {
    try {
      if (!this.isExtensionContextValid()) {
        this.log('❌ Extension context invalid during selection check');
        return;
      }

      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      this.log('📋 Evil selection details:', {
        text: selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''),
        length: selectedText.length,
        rangeCount: selection.rangeCount,
        isCollapsed: selection.isCollapsed
      });

      // Only proceed if selection changed
      if (selectedText !== this.lastSelection) {
        this.lastSelection = selectedText;
        this.notifyBackgroundScript(selectedText);
      }
      
    } catch (error) {
      this.log('❌ Error checking evil selection:', error);
    }
  }

  async notifyBackgroundScript(selectedText) {
    try {
      this.log('📤 Notifying evil background script:', {
        hasSelection: selectedText.length > 0,
        textLength: selectedText.length
      });

      const response = await chrome.runtime.sendMessage({
        action: 'textSelected',
        hasSelection: selectedText.length > 0,
        selectedText: selectedText
      });

      this.log('✅ Evil background response:', response);

    } catch (error) {
      this.log('❌ Failed to notify evil background:', error);
      
      if (error.message.includes('context invalidated')) {
        this.log('🔄 Evil extension context invalidated - stopping operations');
        return;
      }
    }
  }

  log(message, data = null) {
    if (this.debugMode) {
      console.log(`[Evil Quiz AI Content]`, message, data || '');
    }
  }
}

// Initialize evil content script with error handling
try {
  new QuizExtensionContent();
} catch (error) {
  console.log('[Evil Quiz AI Content] ❌ Failed to initialize:', error);
}