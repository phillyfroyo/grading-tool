# ESL Grading Tool - Architecture Documentation

## 🏗️ System Architecture Overview

The ESL Grading Tool is built on a **modern, enterprise-grade modular architecture** that separates concerns, promotes maintainability, and enables scalability. The system follows proven architectural patterns and implements advanced enterprise features for production readiness.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   Web Browser   │ │   Mobile View   │ │   Admin Panel   │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                        HTTP/HTTPS │
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ Static Assets   │ │ Frontend Core   │ │ Module System   │   │
│  │   CSS/HTML      │ │   Components    │ │   Registry      │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                        API Calls │
                                │
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   Controllers   │ │   Middleware    │ │      Routes     │   │
│  │   API Logic     │ │   Validation    │ │   Endpoints     │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                        Service │ Calls
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      BUSINESS LAYER                            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │    Services     │ │  Event System   │ │  Dependency     │   │
│  │  Core Logic     │ │   Messaging     │ │   Container     │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                        Data │ Access
                                │
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                               │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   Repository    │ │     Prisma      │ │    Database     │   │
│  │    Pattern      │ │      ORM        │ │    SQLite       │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Technology Stack

### Backend Technologies
- **Runtime**: Node.js 18+ with ES Modules
- **Framework**: Express.js 5.x
- **Database**: SQLite with Prisma ORM
- **Authentication**: Built-in session management
- **Validation**: Custom validation framework
- **Architecture**: Dependency Injection, Repository Pattern, Event-Driven

### Frontend Technologies
- **Core**: Vanilla JavaScript (ES6+)
- **Architecture**: Modular Component System
- **State Management**: Reactive State Store
- **Communication**: Event Bus Pattern
- **Build**: No build step - direct browser modules
- **Styling**: Modern CSS with component-scoped styles

### External Services
- **AI Processing**: OpenAI GPT-4 API
- **Deployment**: Vercel Serverless Functions
- **Monitoring**: Built-in logging and metrics

## 🎯 Design Principles

### 1. **Separation of Concerns**
Each layer has a single, well-defined responsibility:
- **Controllers**: Handle HTTP requests/responses
- **Services**: Implement business logic
- **Repositories**: Manage data access
- **Components**: Handle UI presentation

### 2. **Dependency Inversion**
High-level modules don't depend on low-level modules. Both depend on abstractions:
```javascript
// Good: Service depends on repository interface
class GradingService {
  constructor(gradingRepository) {
    this.repository = gradingRepository;
  }
}

// Bad: Service depends on concrete implementation
class GradingService {
  constructor() {
    this.repository = new DatabaseGradingRepository();
  }
}
```

### 3. **Single Responsibility**
Each module, class, and function has one reason to change:
- **GradingService**: Only grading business logic
- **ProfileService**: Only profile management
- **ValidationService**: Only data validation

### 4. **Open/Closed Principle**
Open for extension, closed for modification:
- New grading algorithms can be added without changing existing code
- New UI components can be created using existing patterns
- New validation rules can be added via configuration

## 🏛️ Architectural Patterns

### Backend Patterns

#### 1. **Dependency Injection Container**
```javascript
// Service registration
container.registerSingleton('gradingService', GradingService, ['gradingRepository']);
container.registerTransient('gradingRepository', GradingRepository, ['database']);

// Service resolution
const gradingService = container.resolve('gradingService');
```

#### 2. **Repository Pattern**
```javascript
class GradingRepository extends Repository {
  async findByStudentId(studentId) {
    return this.findMany({ where: { studentId } });
  }

  async createGradingResult(data) {
    return this.create(data);
  }
}
```

#### 3. **Event-Driven Architecture**
```javascript
// Event emission
eventSystem.emit('grading.completed', { essayId, grade });

// Event handling
eventSystem.on('grading.completed', async (data) => {
  await notificationService.sendGradeNotification(data);
});
```

### Frontend Patterns

#### 1. **Module Registry**
```javascript
// Module registration
registry.register('gradingDisplay', GradingDisplayModule, {
  dependencies: ['apiClient', 'stateManager'],
  priority: 10
});
```

#### 2. **Component System**
```javascript
// Component definition
class EssayEditor extends Component {
  constructor(element, props) {
    super(element, props);
    this.state = { text: '', isEditing: false };
  }

  render() {
    return `<div class="essay-editor">${this.state.text}</div>`;
  }
}
```

#### 3. **State Management**
```javascript
// State updates
await stateManager.setState('currentEssay', essayData);

// State subscription
stateManager.subscribe('currentEssay', (newEssay) => {
  this.updateDisplay(newEssay);
});
```

## 📁 Project Structure

```
grading-tool/
├── src/                          # Backend source code
│   ├── config/                   # Configuration management
│   ├── controllers/              # HTTP request handlers
│   ├── core/                     # Enterprise patterns (DI, Repository, etc.)
│   ├── middleware/               # Express middleware
│   ├── routes/                   # API route definitions
│   └── services/                 # Business logic layer
├── public/                       # Frontend static assets
│   ├── css/                      # Stylesheets
│   ├── js/                       # Frontend modules
│   │   ├── core/                 # Core frontend infrastructure
│   │   ├── ui/                   # UI interaction modules
│   │   ├── essay/                # Essay editing modules
│   │   ├── grading/              # Grading display modules
│   │   └── profiles/             # Profile management modules
│   └── index.html                # Main application entry point
├── docs/                         # Architecture documentation
├── prisma/                       # Database schema and migrations
├── grader/                       # Legacy grading engine
└── lib/                          # Shared utilities
```

## 🔄 Data Flow

### Request Processing Flow
1. **HTTP Request** → Express Router
2. **Route Handler** → Controller Method
3. **Controller** → Service (via DI Container)
4. **Service** → Repository (for data)
5. **Repository** → Database (via Prisma)
6. **Response** ← Formatted via ResponseFormatter

### Frontend Module Flow
1. **User Interaction** → Event Listener
2. **Event Handler** → Component Method
3. **Component** → State Manager (for state changes)
4. **State Manager** → API Client (for server communication)
5. **API Response** → Component Update
6. **Component** → DOM Manipulation

## 🔧 Core Features

### Enterprise Capabilities
- **Dependency Injection**: Centralized service management
- **Event System**: Decoupled inter-service communication
- **Repository Pattern**: Data access abstraction
- **Validation Framework**: Type-safe data validation
- **Error Handling**: Comprehensive error recovery
- **Caching**: Multi-level caching strategy
- **Logging**: Structured logging across all layers

### Performance Features
- **Lazy Loading**: Frontend modules loaded on demand
- **Caching**: API responses, database queries, static assets
- **Optimization**: Efficient state updates and DOM manipulation
- **Monitoring**: Built-in performance metrics

### Developer Experience
- **Hot Reloading**: Development server with automatic restart
- **Type Safety**: JSDoc typing throughout codebase
- **Error Boundaries**: Graceful error handling
- **Debugging Tools**: Comprehensive logging and error tracking

## 📖 Documentation Structure

This documentation is organized into focused guides:

### 🔧 [Backend Architecture](./backend/architecture.md)
- Service layer design
- Database architecture
- API patterns and conventions
- Enterprise pattern implementation

### 🎨 [Frontend Architecture](./frontend/architecture.md)
- Module system organization
- Component architecture
- State management patterns
- Event communication

### 👨‍💻 [Development Guidelines](./development/guidelines.md)
- Code style and conventions
- File organization rules
- Testing standards
- Best practices

### 🚀 [Deployment Guide](./development/deployment.md)
- Build and deployment process
- Environment configuration
- Performance monitoring
- Maintenance procedures

### 🔄 [Migration Guide](./migration/legacy-to-modular.md)
- Legacy to modular transition
- Breaking changes documentation
- Upgrade procedures

## 🚀 Quick Start

### For New Developers
1. Read this overview document
2. Follow the [Development Guidelines](./development/guidelines.md)
3. Explore the [Backend Architecture](./backend/architecture.md)
4. Study the [Frontend Architecture](./frontend/architecture.md)
5. Check the [Migration Guide](./migration/legacy-to-modular.md) for context

### For System Administration
1. Review [Deployment Guide](./development/deployment.md)
2. Set up monitoring and logging
3. Configure environment variables
4. Test backup and recovery procedures

### For Feature Development
1. Understand the module you're working in
2. Follow established patterns
3. Use dependency injection for services
4. Implement proper error handling
5. Add appropriate tests

## 🎯 Architecture Goals Achieved

### ✅ Maintainability
- **Modular Design**: 35+ focused frontend modules
- **Clear Separation**: Distinct layers with single responsibilities
- **Consistent Patterns**: Standardized approaches across all features

### ✅ Scalability
- **Horizontal Scaling**: Event-driven, loosely coupled services
- **Vertical Scaling**: Optimized database queries and caching
- **Module Scaling**: New features as independent modules

### ✅ Testability
- **Dependency Injection**: Easy mocking and testing
- **Pure Functions**: Stateless business logic
- **Isolated Components**: Independent frontend modules

### ✅ Performance
- **Efficient Queries**: Repository pattern with caching
- **Optimized Frontend**: Lazy loading and state management
- **Resource Management**: Memory and connection pooling

### ✅ Developer Experience
- **Clear Architecture**: Well-documented patterns and conventions
- **Debugging Tools**: Comprehensive logging and error tracking
- **Development Speed**: Hot reloading and efficient workflows

---

**Next Steps**: Choose a specific guide from the documentation structure above based on your role and immediate needs.