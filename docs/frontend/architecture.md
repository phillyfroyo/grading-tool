# Frontend Architecture Guide

## 🎨 Overview

The frontend follows a **modular component-based architecture** built with vanilla JavaScript and enterprise-grade patterns. The system emphasizes modularity, reusability, and maintainability while providing modern development experience without complex build tools.

## 📁 Directory Structure

```
public/js/
├── core/                     # Core infrastructure modules
│   ├── ApiClient.js         # HTTP client with interceptors and caching
│   ├── ComponentSystem.js   # Reusable UI component framework
│   ├── ConfigManager.js     # Configuration management
│   ├── ErrorBoundary.js     # Global error handling
│   ├── eventBus.js          # Event communication system
│   ├── logger.js            # Structured logging system
│   ├── ModuleRegistry.js    # Module dependency injection
│   ├── StateManager.js      # Reactive state management
│   └── utils.js             # Utility functions
├── ui/                      # UI interaction modules
│   ├── tab-management.js    # Tab switching and navigation
│   ├── modal-management.js  # Modal dialog system
│   ├── form-handling.js     # Form submission and validation
│   ├── keyboard-shortcuts.js # Keyboard shortcuts system
│   ├── editing-functions.js # Inline editing functionality
│   ├── manual-grading.js    # Manual grading interface
│   └── ui-interactions-main.js # Main UI controller
├── essay/                   # Essay editing modules
│   ├── text-selection.js    # Text selection handling
│   ├── category-selection.js # Category button management
│   ├── highlighting.js      # Text highlighting functionality
│   ├── essay-formatter.js   # Text formatting utilities
│   └── essay-editing-main.js # Main essay editing controller
├── grading/                 # Grading display modules
│   ├── display-utils.js     # HTML generation utilities
│   ├── single-result.js     # Single essay result handling
│   ├── batch-processing.js  # Batch essay management
│   ├── manual.js            # Manual grading functions
│   └── grading-display-main.js # Main grading controller
└── profiles/                # Profile management modules
    ├── profile-management.js # Profile CRUD operations
    └── temperature-control.js # AI temperature configuration
```

## 🏗️ Architectural Patterns

### 1. **Module Registry Pattern**

**Purpose**: Centralized module management with dependency injection and lifecycle control

**Features**:
- Dependency injection and resolution
- Lazy loading and initialization
- Circular dependency detection
- Module lifecycle hooks
- Error handling and recovery

**Implementation**:
```javascript
// Module registration
const registry = new ModuleRegistry();

registry.register('apiClient', ApiClient, {
  dependencies: ['configManager'],
  singleton: true,
  priority: 10
});

registry.register('essayEditor', EssayEditor, {
  dependencies: ['apiClient', 'stateManager', 'eventBus'],
  singleton: true,
  priority: 5
});

// Initialize all modules
await registry.initializeAll();

// Get module instance
const essayEditor = registry.get('essayEditor');
```

**Module Definition Pattern**:
```javascript
// /public/js/essay/essay-editing-main.js
class EssayEditingModule {
  constructor(dependencies, config) {
    this.apiClient = dependencies.apiClient;
    this.stateManager = dependencies.stateManager;
    this.eventBus = dependencies.eventBus;
    this.config = config;
  }

  async initialize() {
    // Setup event listeners
    this.eventBus.on('essay.selected', this.handleEssaySelection.bind(this));

    // Initialize UI components
    await this.initializeComponents();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  async destroy() {
    // Cleanup event listeners
    this.eventBus.off('essay.selected', this.handleEssaySelection);

    // Destroy components
    await this.destroyComponents();
  }
}

// Export for module registry
window.EssayEditingModule = EssayEditingModule;
```

### 2. **Component System Pattern**

**Purpose**: Reusable, self-contained UI components with lifecycle management

**Features**:
- Template-based rendering
- State binding and reactivity
- Event handling
- Lifecycle hooks
- Child component management

**Base Component**:
```javascript
// /public/js/core/ComponentSystem.js
class Component {
  constructor(element, props = {}) {
    this.element = typeof element === 'string'
      ? document.querySelector(element)
      : element;
    this.props = props;
    this.state = {};
    this.children = new Map();
    this.eventListeners = new Map();
    this.isDestroyed = false;
  }

  // Lifecycle methods
  async mount() {
    await this.beforeMount();
    this.render();
    await this.afterMount();
  }

  async unmount() {
    await this.beforeUnmount();
    this.cleanup();
    await this.afterUnmount();
  }

  // State management
  setState(newState) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };
    this.onStateChange(newState, oldState);
    this.render();
  }

  // Event handling
  on(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(handler);
  }

  emit(event, data) {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  // Template rendering
  render() {
    if (this.template && !this.isDestroyed) {
      this.element.innerHTML = this.template();
      this.bindEvents();
    }
  }
}
```

**Component Example**:
```javascript
// Essay Editor Component
class EssayEditor extends Component {
  constructor(element, props) {
    super(element, props);
    this.state = {
      text: props.initialText || '',
      isEditing: false,
      selectedText: '',
      categories: []
    };
  }

  template() {
    return `
      <div class="essay-editor">
        <div class="editor-toolbar">
          <button class="btn-edit ${this.state.isEditing ? 'active' : ''}">
            ${this.state.isEditing ? 'Stop Editing' : 'Edit Essay'}
          </button>
          <button class="btn-highlight" ${!this.state.selectedText ? 'disabled' : ''}>
            Highlight Selected
          </button>
        </div>
        <div class="editor-content" ${this.state.isEditing ? 'contenteditable="true"' : ''}>
          ${this.state.text}
        </div>
        <div class="category-panel">
          ${this.renderCategories()}
        </div>
      </div>
    `;
  }

  renderCategories() {
    return this.state.categories.map(category => `
      <button class="category-btn" data-category="${category.id}">
        ${category.name}
      </button>
    `).join('');
  }

  bindEvents() {
    // Edit button
    this.element.querySelector('.btn-edit')?.addEventListener('click', () => {
      this.toggleEditing();
    });

    // Text selection
    this.element.querySelector('.editor-content')?.addEventListener('mouseup', () => {
      this.handleTextSelection();
    });

    // Category buttons
    this.element.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.applyCategory(e.target.dataset.category);
      });
    });
  }

  toggleEditing() {
    this.setState({ isEditing: !this.state.isEditing });
    this.emit('editingStateChanged', this.state.isEditing);
  }

  handleTextSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    this.setState({ selectedText });
  }

  applyCategory(categoryId) {
    if (!this.state.selectedText) return;

    const category = this.state.categories.find(c => c.id === categoryId);
    this.emit('categoryApplied', {
      text: this.state.selectedText,
      category
    });
  }
}

// Register component
window.EssayEditor = EssayEditor;
```

### 3. **State Management Pattern**

**Purpose**: Reactive state management with middleware, validation, and persistence

**Features**:
- Reactive state updates
- Nested state path support
- Validation and middleware
- Time-travel debugging
- State persistence
- Subscription system

**Store Configuration**:
```javascript
// Application state store
const store = new StateStore({
  // User state
  user: {
    preferences: {
      theme: 'light',
      autoSave: true,
      shortcuts: true
    }
  },

  // Essay state
  currentEssay: {
    id: null,
    text: '',
    grade: null,
    feedback: '',
    highlights: []
  },

  // UI state
  ui: {
    activeTab: 'grading',
    isLoading: false,
    modals: {
      profileEditor: false,
      batchProcessor: false
    }
  },

  // Application data
  profiles: [],
  gradingResults: [],
  recentEssays: []
}, {
  enableTimeTravel: true,
  enablePersistence: true,
  persistenceKey: 'gradingTool',
  enableLogging: true
});

// Add validation middleware
store.addValidator('currentEssay.text', (value) => {
  if (typeof value !== 'string') return 'Essay text must be a string';
  if (value.length > 50000) return 'Essay text too long (max 50,000 characters)';
  return true;
});

// Add logging middleware
store.addMiddleware((mutation, next, store) => {
  console.log('State mutation:', mutation);
  const result = next();
  console.log('New state:', store.getState());
  return result;
});
```

**State Usage Patterns**:
```javascript
// Subscribe to state changes
store.subscribe('currentEssay', (newEssay, oldEssay) => {
  if (newEssay.id !== oldEssay.id) {
    // Essay changed, update UI
    essayEditor.loadEssay(newEssay);
  }
});

// Update state
await store.setState('currentEssay.text', updatedText);
await store.setState('ui.isLoading', true);

// Get state
const currentEssay = store.getState('currentEssay');
const userPreferences = store.getState('user.preferences');

// Batch updates
await store.batchUpdate([
  { path: 'currentEssay.grade', value: 85 },
  { path: 'currentEssay.feedback', value: 'Excellent work!' },
  { path: 'ui.isLoading', value: false }
]);
```

### 4. **Event Bus Pattern**

**Purpose**: Decoupled communication between modules and components

**Features**:
- Publish/subscribe messaging
- Event namespacing
- Async/sync handlers
- Event filtering
- Error handling

**Event System Usage**:
```javascript
// Event registration
eventBus.on('essay.selected', async (essayData) => {
  await store.setState('currentEssay', essayData);
  await essayEditor.loadEssay(essayData);
});

eventBus.on('grading.completed', (gradingResult) => {
  gradingDisplay.showResult(gradingResult);
  store.setState('gradingResults', (current) => [...current, gradingResult]);
});

// Event emission
eventBus.emit('essay.textChanged', {
  essayId: currentEssay.id,
  text: newText,
  timestamp: new Date()
});

// Async event handling
await eventBus.emitAsync('essay.save', {
  id: essay.id,
  text: essay.text
});

// Event filtering
eventBus.on('ui.*', (event, data) => {
  // Handle all UI events
  logger.log('UI Event:', event, data);
});
```

## 🔌 API Integration Pattern

### **ApiClient Implementation**

**Purpose**: Centralized HTTP client with interceptors, caching, and error handling

**Features**:
- Request/response interceptors
- Automatic retry logic
- Response caching
- Error handling
- Request queuing

```javascript
// /public/js/core/ApiClient.js
class ApiClient {
  constructor(baseURL = '/api', options = {}) {
    this.baseURL = baseURL;
    this.options = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      enableCache: true,
      cacheExpiry: 300000, // 5 minutes
      ...options
    };

    this.interceptors = {
      request: [],
      response: []
    };

    this.cache = new Map();
    this.pendingRequests = new Map();
  }

  async request(url, options = {}) {
    const config = this.mergeConfig(url, options);

    // Check cache for GET requests
    if (config.method === 'GET' && this.options.enableCache) {
      const cached = this.getFromCache(config.cacheKey);
      if (cached) return cached;
    }

    // Check for pending identical requests
    const requestKey = this.getRequestKey(config);
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey);
    }

    // Create request promise
    const requestPromise = this.executeRequest(config);
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const response = await requestPromise;

      // Cache successful GET responses
      if (config.method === 'GET' && this.options.enableCache) {
        this.setCache(config.cacheKey, response);
      }

      return response;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  // HTTP method shortcuts
  get(url, config = {}) {
    return this.request(url, { ...config, method: 'GET' });
  }

  post(url, data, config = {}) {
    return this.request(url, { ...config, method: 'POST', data });
  }

  put(url, data, config = {}) {
    return this.request(url, { ...config, method: 'PUT', data });
  }

  delete(url, config = {}) {
    return this.request(url, { ...config, method: 'DELETE' });
  }
}

// Usage example
const apiClient = new ApiClient('/api', {
  enableCache: true,
  retries: 3
});

// Add request interceptor for authentication
apiClient.addRequestInterceptor((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
apiClient.addResponseInterceptor(
  (response) => response,
  (error) => {
    if (error.status === 401) {
      // Handle authentication error
      window.location.href = '/login';
    }
    throw error;
  }
);
```

### **Service Layer Pattern**

**Purpose**: Abstract API calls into business logic services

```javascript
// /public/js/services/GradingService.js
class GradingService {
  constructor(apiClient, stateManager, eventBus) {
    this.api = apiClient;
    this.state = stateManager;
    this.events = eventBus;
  }

  async gradeEssay(essayText, rubric, profileId) {
    try {
      this.state.setState('ui.isLoading', true);
      this.events.emit('grading.started', { essayText });

      const response = await this.api.post('/grade-essay', {
        essayText,
        rubric,
        profileId
      });

      const gradingResult = response.data;

      // Update state
      await this.state.setState('currentEssay.grade', gradingResult.grade);
      await this.state.setState('currentEssay.feedback', gradingResult.feedback);

      // Emit events
      this.events.emit('grading.completed', gradingResult);

      return gradingResult;
    } catch (error) {
      this.events.emit('grading.failed', error);
      throw error;
    } finally {
      this.state.setState('ui.isLoading', false);
    }
  }

  async batchGradeEssays(essays, rubric, profileId) {
    const batchResponse = await this.api.post('/batch-grade', {
      essays,
      rubric,
      profileId
    });

    const batchId = batchResponse.data.batchId;

    // Poll for batch completion
    return this.pollBatchStatus(batchId);
  }

  async pollBatchStatus(batchId) {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const response = await this.api.get(`/batch-status/${batchId}`);
          const status = response.data;

          this.events.emit('batch.progress', status);

          if (status.status === 'completed') {
            resolve(status.results);
          } else if (status.status === 'failed') {
            reject(new Error(status.error));
          } else {
            // Continue polling
            setTimeout(checkStatus, 2000);
          }
        } catch (error) {
          reject(error);
        }
      };

      checkStatus();
    });
  }
}
```

## 🎨 UI Patterns and Components

### **Tab Management System**

```javascript
// /public/js/ui/tab-management.js
class TabManager {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      activeClass: 'active',
      enableKeyboard: true,
      enableHistory: true,
      ...options
    };

    this.tabs = new Map();
    this.activeTab = null;
    this.init();
  }

  init() {
    this.container.addEventListener('click', this.handleTabClick.bind(this));

    if (this.options.enableKeyboard) {
      this.setupKeyboardNavigation();
    }

    if (this.options.enableHistory) {
      this.setupHistoryNavigation();
    }
  }

  addTab(id, label, content, options = {}) {
    const tab = {
      id,
      label,
      content,
      enabled: options.enabled !== false,
      closable: options.closable || false,
      icon: options.icon,
      onActivate: options.onActivate,
      onDeactivate: options.onDeactivate
    };

    this.tabs.set(id, tab);
    this.renderTab(tab);

    if (!this.activeTab || options.activate) {
      this.activateTab(id);
    }
  }

  activateTab(id) {
    const tab = this.tabs.get(id);
    if (!tab || !tab.enabled) return;

    // Deactivate current tab
    if (this.activeTab) {
      const currentTab = this.tabs.get(this.activeTab);
      if (currentTab.onDeactivate) {
        currentTab.onDeactivate(currentTab);
      }
      this.deactivateTabElement(this.activeTab);
    }

    // Activate new tab
    this.activeTab = id;
    this.activateTabElement(id);

    if (tab.onActivate) {
      tab.onActivate(tab);
    }

    // Update URL if history is enabled
    if (this.options.enableHistory) {
      history.pushState({ tab: id }, '', `#${id}`);
    }

    // Emit event
    eventBus.emit('tab.activated', { tabId: id, tab });
  }
}
```

### **Modal Management System**

```javascript
// /public/js/ui/modal-management.js
class ModalManager {
  constructor() {
    this.modals = new Map();
    this.activeModals = [];
    this.init();
  }

  init() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('click', this.handleBackdropClick.bind(this));
  }

  createModal(id, options = {}) {
    const modal = {
      id,
      title: options.title || '',
      content: options.content || '',
      size: options.size || 'medium',
      closable: options.closable !== false,
      backdrop: options.backdrop !== false,
      keyboard: options.keyboard !== false,
      onShow: options.onShow,
      onHide: options.onHide,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel
    };

    this.modals.set(id, modal);
    this.renderModal(modal);

    return modal;
  }

  showModal(id, data = {}) {
    const modal = this.modals.get(id);
    if (!modal) throw new Error(`Modal '${id}' not found`);

    modal.data = data;
    this.activeModals.push(id);

    const element = document.getElementById(modal.id);
    element.style.display = 'block';
    element.classList.add('show');

    // Focus management
    this.trapFocus(element);

    if (modal.onShow) {
      modal.onShow(modal, data);
    }

    eventBus.emit('modal.shown', { modalId: id, modal, data });
  }

  hideModal(id) {
    const modal = this.modals.get(id);
    if (!modal) return;

    const index = this.activeModals.indexOf(id);
    if (index > -1) {
      this.activeModals.splice(index, 1);
    }

    const element = document.getElementById(modal.id);
    element.classList.remove('show');
    setTimeout(() => {
      element.style.display = 'none';
    }, 300);

    if (modal.onHide) {
      modal.onHide(modal);
    }

    eventBus.emit('modal.hidden', { modalId: id, modal });
  }
}
```

## 🔧 Configuration Management

### **ConfigManager Implementation**

```javascript
// /public/js/core/ConfigManager.js
class ConfigManager {
  constructor(options = {}) {
    this.config = {};
    this.providers = new Map();
    this.watchers = new Map();
    this.options = {
      enableValidation: options.enableValidation !== false,
      enablePersistence: options.enablePersistence || false,
      persistenceKey: options.persistenceKey || 'appConfig',
      ...options
    };

    this.init();
  }

  init() {
    // Load from localStorage if persistence is enabled
    if (this.options.enablePersistence) {
      this.loadFromStorage();
    }

    // Set up default providers
    this.addProvider('environment', new EnvironmentProvider());
    this.addProvider('localStorage', new LocalStorageProvider());
  }

  set(key, value, options = {}) {
    const oldValue = this.get(key);

    // Validate if validation is enabled
    if (this.options.enableValidation && options.validate !== false) {
      this.validate(key, value);
    }

    // Set value
    this.setNestedValue(this.config, key, value);

    // Persist if enabled
    if (this.options.enablePersistence) {
      this.saveToStorage();
    }

    // Notify watchers
    this.notifyWatchers(key, value, oldValue);

    return this;
  }

  get(key, defaultValue = undefined) {
    const value = this.getNestedValue(this.config, key);
    return value !== undefined ? value : defaultValue;
  }

  watch(key, callback) {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }
    this.watchers.get(key).add(callback);

    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(key);
      if (watchers) {
        watchers.delete(callback);
      }
    };
  }
}

// Default configuration
const defaultConfig = {
  api: {
    baseURL: '/api',
    timeout: 30000,
    retries: 3
  },

  ui: {
    theme: 'light',
    language: 'en',
    autoSave: true,
    autoSaveInterval: 30000
  },

  grading: {
    defaultModel: 'gpt-4',
    defaultTemperature: 0.7,
    maxEssayLength: 50000
  },

  features: {
    batchGrading: true,
    profileManagement: true,
    advancedRubrics: true
  }
};

// Initialize configuration
const configManager = new ConfigManager({
  enablePersistence: true,
  enableValidation: true
});

configManager.setMany(defaultConfig);
```

## 📦 Build and Module Loading

### **Module Loading Strategy**

**HTML Structure**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESL Grading Tool</title>
  <link rel="stylesheet" href="/css/main.css">
</head>
<body>
  <!-- Application Shell -->
  <div id="app">
    <div id="loading" class="loading-screen">
      <div class="loader"></div>
      <p>Loading ESL Grading Tool...</p>
    </div>
  </div>

  <!-- Core Infrastructure (Load First) -->
  <script src="/js/core/utils.js"></script>
  <script src="/js/core/logger.js"></script>
  <script src="/js/core/eventBus.js"></script>
  <script src="/js/core/ConfigManager.js"></script>
  <script src="/js/core/StateManager.js"></script>
  <script src="/js/core/ModuleRegistry.js"></script>
  <script src="/js/core/ComponentSystem.js"></script>
  <script src="/js/core/ApiClient.js"></script>
  <script src="/js/core/ErrorBoundary.js"></script>

  <!-- Feature Modules (Load in Dependency Order) -->
  <script src="/js/ui/tab-management.js"></script>
  <script src="/js/ui/modal-management.js"></script>
  <script src="/js/ui/form-handling.js"></script>
  <script src="/js/ui/keyboard-shortcuts.js"></script>
  <script src="/js/ui/editing-functions.js"></script>
  <script src="/js/ui/manual-grading.js"></script>
  <script src="/js/ui/ui-interactions-main.js"></script>

  <script src="/js/essay/text-selection.js"></script>
  <script src="/js/essay/category-selection.js"></script>
  <script src="/js/essay/highlighting.js"></script>
  <script src="/js/essay/essay-formatter.js"></script>
  <script src="/js/essay/essay-editing-main.js"></script>

  <script src="/js/grading/display-utils.js"></script>
  <script src="/js/grading/single-result.js"></script>
  <script src="/js/grading/batch-processing.js"></script>
  <script src="/js/grading/manual.js"></script>
  <script src="/js/grading/grading-display-main.js"></script>

  <script src="/js/profiles/profile-management.js"></script>
  <script src="/js/profiles/temperature-control.js"></script>

  <!-- Application Initialization -->
  <script src="/js/app.js"></script>
</body>
</html>
```

**Application Bootstrap**:
```javascript
// /public/js/app.js
class Application {
  constructor() {
    this.registry = new ModuleRegistry({
      enableLogging: true,
      enableProfiling: true
    });

    this.isInitialized = false;
    this.startTime = Date.now();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing ESL Grading Tool...');

      // Register core modules
      this.registerCoreModules();

      // Register feature modules
      this.registerFeatureModules();

      // Initialize all modules
      await this.registry.initializeAll();

      // Setup global error handling
      this.setupErrorHandling();

      // Initialize routing
      this.initializeRouting();

      // Hide loading screen
      this.hideLoadingScreen();

      this.isInitialized = true;
      const loadTime = Date.now() - this.startTime;

      console.log(`✅ Application initialized in ${loadTime}ms`);
      eventBus.emit('app.initialized', { loadTime });

    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      this.showErrorScreen(error);
    }
  }

  registerCoreModules() {
    // Configuration
    this.registry.registerSingleton('config', ConfigManager);

    // State management
    this.registry.registerSingleton('stateManager', StateManager, ['config']);

    // API client
    this.registry.registerSingleton('apiClient', ApiClient, ['config']);

    // Event system (already global, register instance)
    this.registry.registerInstance('eventBus', eventBus);

    // Error boundary
    this.registry.registerSingleton('errorBoundary', ErrorBoundary, ['eventBus']);
  }

  registerFeatureModules() {
    // UI modules
    this.registry.register('tabManager', TabManager, {
      dependencies: ['eventBus'],
      priority: 10
    });

    this.registry.register('modalManager', ModalManager, {
      dependencies: ['eventBus'],
      priority: 10
    });

    // Essay modules
    this.registry.register('essayEditor', EssayEditingModule, {
      dependencies: ['apiClient', 'stateManager', 'eventBus'],
      priority: 5
    });

    // Grading modules
    this.registry.register('gradingDisplay', GradingDisplayModule, {
      dependencies: ['apiClient', 'stateManager', 'eventBus'],
      priority: 5
    });

    // Profile modules
    this.registry.register('profileManager', ProfileManagementModule, {
      dependencies: ['apiClient', 'stateManager', 'eventBus'],
      priority: 5
    });
  }

  setupErrorHandling() {
    const errorBoundary = this.registry.get('errorBoundary');

    window.addEventListener('error', (event) => {
      errorBoundary.handleError(event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      errorBoundary.handleError(event.reason);
    });
  }

  hideLoadingScreen() {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.opacity = '0';
      setTimeout(() => {
        loading.style.display = 'none';
      }, 300);
    }
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new Application();
  await app.initialize();

  // Make app globally available for debugging
  window.app = app;
});
```

## 🔧 Performance Optimizations

### **Lazy Loading Pattern**
```javascript
// Lazy load heavy modules
class LazyLoader {
  static async loadModule(moduleName) {
    if (window[moduleName]) {
      return window[moduleName];
    }

    const script = document.createElement('script');
    script.src = `/js/modules/${moduleName}.js`;

    return new Promise((resolve, reject) => {
      script.onload = () => resolve(window[moduleName]);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}

// Usage
const heavyModule = await LazyLoader.loadModule('AdvancedAnalytics');
```

### **Virtual Scrolling for Large Lists**
```javascript
class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 50;
    this.bufferSize = options.bufferSize || 10;
    this.items = [];
    this.visibleItems = [];
    this.scrollTop = 0;

    this.init();
  }

  setItems(items) {
    this.items = items;
    this.updateVirtualHeight();
    this.renderVisibleItems();
  }

  updateVirtualHeight() {
    const totalHeight = this.items.length * this.itemHeight;
    this.container.style.height = `${totalHeight}px`;
  }

  renderVisibleItems() {
    const containerHeight = this.container.clientHeight;
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / this.itemHeight) + this.bufferSize,
      this.items.length
    );

    this.visibleItems = this.items.slice(startIndex, endIndex);
    this.renderItems(startIndex);
  }
}
```

This frontend architecture provides a robust, scalable, and maintainable foundation for the ESL Grading Tool while maintaining excellent developer experience and performance.