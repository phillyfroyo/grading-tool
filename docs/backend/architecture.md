# Backend Architecture Guide

## 🏗️ Overview

The backend follows a **layered enterprise architecture** with clear separation of concerns, dependency injection, and modern Node.js patterns. The architecture is designed for scalability, maintainability, and testability.

## 📁 Directory Structure

```
src/
├── config/                   # Configuration management
│   ├── database.js          # Database connection setup
│   └── index.js             # Centralized configuration
├── controllers/             # HTTP request handlers
│   ├── gradingController.js # Grading endpoint handlers
│   └── profileController.js # Profile management handlers
├── core/                    # Enterprise patterns and utilities
│   ├── Container.js         # Dependency injection container
│   ├── DTOs.js             # Data transfer objects
│   ├── EventSystem.js      # Event-driven communication
│   ├── Repository.js       # Data access abstraction
│   ├── ResponseFormatter.js # Standardized API responses
│   └── Validation.js       # Input validation framework
├── middleware/              # Express middleware
│   └── errorHandler.js     # Global error handling
├── routes/                  # API route definitions
│   ├── grading.js          # Grading endpoints
│   ├── index.js            # Route aggregator
│   ├── profiles.js         # Profile endpoints
│   └── static.js           # Static file serving
└── services/                # Business logic layer
    ├── gradingService.js    # Grading business logic
    ├── profileService.js    # Profile management logic
    └── temperatureService.js # AI temperature control
```

## 🏛️ Architectural Layers

### 1. **Presentation Layer** (Routes & Controllers)

**Responsibility**: Handle HTTP requests/responses, route management, input parsing

**Components**:
- **Routes**: Define API endpoints and map them to controllers
- **Controllers**: Parse requests, call services, format responses
- **Middleware**: Cross-cutting concerns (authentication, validation, logging)

**Example Route Structure**:
```javascript
// /src/routes/grading.js
import express from 'express';
import { gradingController } from '../controllers/gradingController.js';

const router = express.Router();

router.post('/grade-essay', gradingController.gradeEssay);
router.get('/grading-results/:id', gradingController.getResults);
router.post('/batch-grade', gradingController.batchGrade);

export default router;
```

**Controller Pattern**:
```javascript
// /src/controllers/gradingController.js
class GradingController {
  constructor(gradingService, responseFormatter) {
    this.gradingService = gradingService;
    this.responseFormatter = responseFormatter;
  }

  async gradeEssay(req, res, next) {
    try {
      const { essayText, rubric } = req.body;
      const result = await this.gradingService.gradeEssay(essayText, rubric);

      res.json(this.responseFormatter.success(result));
    } catch (error) {
      next(error);
    }
  }
}
```

### 2. **Business Logic Layer** (Services)

**Responsibility**: Implement core business rules, orchestrate operations, handle complex workflows

**Components**:
- **GradingService**: AI grading logic, rubric processing
- **ProfileService**: Class profile management, student data
- **TemperatureService**: AI model configuration

**Service Pattern**:
```javascript
// /src/services/gradingService.js
class GradingService {
  constructor(gradingRepository, aiClient, eventSystem) {
    this.repository = gradingRepository;
    this.aiClient = aiClient;
    this.events = eventSystem;
  }

  async gradeEssay(essayText, rubric) {
    // Validate input
    await this.validateEssayInput(essayText, rubric);

    // Process with AI
    const gradeResult = await this.aiClient.grade(essayText, rubric);

    // Save to database
    const savedResult = await this.repository.save(gradeResult);

    // Emit event
    this.events.emit('essay.graded', savedResult);

    return savedResult;
  }
}
```

### 3. **Data Access Layer** (Repositories)

**Responsibility**: Abstract database operations, provide caching, handle data transformations

**Repository Base Class**:
```javascript
// /src/core/Repository.js
class Repository {
  constructor(model, cache = null) {
    this.model = model;
    this.cache = cache;
  }

  async findById(id) {
    // Check cache first
    const cached = await this.cache?.get(`${this.model.name}:${id}`);
    if (cached) return cached;

    // Query database
    const result = await this.model.findUnique({ where: { id } });

    // Cache result
    if (result) {
      await this.cache?.set(`${this.model.name}:${id}`, result, 300);
    }

    return result;
  }
}
```

### 4. **Infrastructure Layer** (Core Patterns)

**Responsibility**: Provide enterprise patterns, cross-cutting concerns, foundational services

## 🔧 Core Enterprise Patterns

### 1. **Dependency Injection Container**

**Purpose**: Manage service lifecycles, resolve dependencies, enable testability

**Features**:
- Singleton and transient lifetimes
- Automatic dependency resolution
- Circular dependency detection
- Factory function support

**Registration Example**:
```javascript
import { Container } from './src/core/Container.js';

const container = new Container();

// Register repositories
container.registerSingleton('gradingRepository', GradingRepository, ['database']);
container.registerSingleton('profileRepository', ProfileRepository, ['database']);

// Register services
container.registerSingleton('gradingService', GradingService, [
  'gradingRepository',
  'aiClient',
  'eventSystem'
]);

// Register controllers
container.registerTransient('gradingController', GradingController, [
  'gradingService',
  'responseFormatter'
]);

await container.build();
```

**Usage in Routes**:
```javascript
import { resolve } from './src/core/Container.js';

const router = express.Router();
const gradingController = resolve('gradingController');

router.post('/grade-essay', (req, res, next) =>
  gradingController.gradeEssay(req, res, next)
);
```

### 2. **Repository Pattern**

**Purpose**: Abstract data access, provide caching, enable testing with mocks

**Base Repository Features**:
- Generic CRUD operations
- Query building
- Caching integration
- Transaction support
- Result transformation

**Implementation Example**:
```javascript
class GradingRepository extends Repository {
  constructor(prisma, cache) {
    super(prisma.gradingResult, cache);
  }

  async findByStudentId(studentId, limit = 10) {
    return this.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async createGradingResult(data) {
    const result = await this.create(data);

    // Invalidate related caches
    await this.cache?.delete(`student:${data.studentId}:grades`);

    return result;
  }
}
```

### 3. **Event System**

**Purpose**: Enable decoupled communication, implement event-driven architecture

**Features**:
- Publish/subscribe messaging
- Async/sync event handlers
- Event filtering and middleware
- Error recovery and dead letter queues

**Event Registration**:
```javascript
// Service registration
eventSystem.on('essay.graded', async (gradingResult) => {
  await notificationService.sendGradeNotification(gradingResult);
});

eventSystem.on('essay.graded', async (gradingResult) => {
  await analyticsService.trackGradingEvent(gradingResult);
});

// Event emission
eventSystem.emit('essay.graded', {
  id: result.id,
  studentId: result.studentId,
  grade: result.grade,
  timestamp: new Date()
});
```

### 4. **Validation Framework**

**Purpose**: Ensure data integrity, provide type safety, validate business rules

**Schema Definition**:
```javascript
const essayGradingSchema = {
  essayText: {
    type: 'string',
    required: true,
    minLength: 50,
    maxLength: 10000,
    sanitize: true
  },
  rubric: {
    type: 'object',
    required: true,
    properties: {
      criteria: { type: 'array', minItems: 1 },
      maxScore: { type: 'number', min: 1, max: 100 }
    }
  },
  studentId: {
    type: 'string',
    required: false,
    format: 'uuid'
  }
};

// Usage in controller
const validatedData = await validator.validate(req.body, essayGradingSchema);
```

### 5. **Response Formatting**

**Purpose**: Standardize API responses, provide consistent error handling

**Response Structure**:
```javascript
// Success response
{
  "success": true,
  "data": {
    "id": "uuid",
    "grade": 85,
    "feedback": "Excellent work..."
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-123"
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Essay text is required",
    "details": {
      "field": "essayText",
      "value": null
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-123"
  }
}
```

## 🗄️ Database Architecture

### **ORM**: Prisma
- Type-safe database client
- Automatic migration generation
- Query optimization
- Connection pooling

### **Database**: SQLite
- Lightweight, file-based database
- Perfect for development and small deployments
- Easy backup and migration

### **Schema Design**:
```prisma
model GradingResult {
  id          String   @id @default(cuid())
  essayText   String
  grade       Float
  feedback    String
  rubricId    String
  studentId   String?
  profileId   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("grading_results")
}

model ClassProfile {
  id          String   @id @default(cuid())
  name        String
  description String
  temperature Float    @default(0.7)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("class_profiles")
}
```

## 🔌 API Design Patterns

### **RESTful Endpoints**

```
GET    /api/grading-results      # List grading results
POST   /api/grading-results      # Create new grading
GET    /api/grading-results/:id  # Get specific result
PUT    /api/grading-results/:id  # Update result
DELETE /api/grading-results/:id  # Delete result

GET    /api/profiles             # List class profiles
POST   /api/profiles             # Create profile
GET    /api/profiles/:id         # Get specific profile
PUT    /api/profiles/:id         # Update profile
DELETE /api/profiles/:id         # Delete profile
```

### **Request/Response DTOs**

**Request DTO**:
```javascript
class GradeEssayDTO {
  constructor(data) {
    this.essayText = data.essayText;
    this.rubric = data.rubric;
    this.studentId = data.studentId;
    this.profileId = data.profileId;
  }

  validate() {
    const errors = [];

    if (!this.essayText || this.essayText.length < 50) {
      errors.push('Essay text must be at least 50 characters');
    }

    if (!this.rubric || !this.rubric.criteria) {
      errors.push('Rubric with criteria is required');
    }

    return errors;
  }
}
```

**Response DTO**:
```javascript
class GradingResultDTO {
  constructor(gradingResult) {
    this.id = gradingResult.id;
    this.grade = gradingResult.grade;
    this.feedback = gradingResult.feedback;
    this.createdAt = gradingResult.createdAt;
    this.meta = {
      processingTime: gradingResult.processingTime,
      aiModel: gradingResult.aiModel
    };
  }
}
```

## 🛡️ Error Handling Strategy

### **Error Types**
1. **Validation Errors**: Input validation failures
2. **Business Logic Errors**: Domain rule violations
3. **Infrastructure Errors**: Database, external API failures
4. **System Errors**: Unexpected runtime errors

### **Error Handler Middleware**:
```javascript
export function errorHandler(error, req, res, next) {
  const requestId = req.headers['x-request-id'] || generateId();

  // Log error
  logger.error('Request error', {
    requestId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  // Determine error type and response
  if (error instanceof ValidationError) {
    return res.status(400).json(
      responseFormatter.error(error.message, 'VALIDATION_ERROR', {
        fields: error.fields,
        requestId
      })
    );
  }

  if (error instanceof BusinessLogicError) {
    return res.status(422).json(
      responseFormatter.error(error.message, 'BUSINESS_LOGIC_ERROR', {
        requestId
      })
    );
  }

  // Default to 500 for unknown errors
  res.status(500).json(
    responseFormatter.error(
      'Internal server error',
      'INTERNAL_ERROR',
      { requestId }
    )
  );
}
```

## ⚡ Performance Optimizations

### **Caching Strategy**
- **Repository-level caching**: Database query results
- **Service-level caching**: Business logic outputs
- **HTTP caching**: API response caching

### **Connection Pooling**
```javascript
// Prisma connection configuration
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")

  // Connection pooling settings
  connection_limit = 10
  pool_timeout     = 30
}
```

### **Query Optimization**
- Use `select` to fetch only needed fields
- Implement proper indexing
- Use `include` instead of separate queries
- Implement cursor-based pagination

```javascript
// Optimized query example
async findGradingResultsOptimized(studentId, limit = 10) {
  return this.model.findMany({
    where: { studentId },
    select: {
      id: true,
      grade: true,
      createdAt: true,
      // Exclude large text fields for list views
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}
```

## 🔧 Configuration Management

### **Environment Configuration**
```javascript
// /src/config/index.js
export const config = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
    logging: process.env.DB_LOGGING === 'true'
  },
  ai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableMorgan: process.env.ENABLE_MORGAN !== 'false'
  }
};
```

### **Configuration Validation**
```javascript
export function validateConfig() {
  const requiredVars = ['OPENAI_API_KEY'];
  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

## 🧪 Testing Strategy

### **Unit Testing**
- Test services in isolation using mocked dependencies
- Test repositories with in-memory database
- Test validation logic with various inputs

### **Integration Testing**
- Test API endpoints end-to-end
- Test database operations with real database
- Test external service integrations

### **Test Example**:
```javascript
describe('GradingService', () => {
  let gradingService;
  let mockRepository;
  let mockAiClient;

  beforeEach(() => {
    mockRepository = createMock('GradingRepository');
    mockAiClient = createMock('AiClient');

    gradingService = new GradingService(mockRepository, mockAiClient);
  });

  test('should grade essay successfully', async () => {
    // Arrange
    const essayText = 'Sample essay text...';
    const rubric = { criteria: ['grammar', 'content'] };
    const expectedResult = { grade: 85, feedback: 'Good work' };

    mockAiClient.grade.mockResolvedValue(expectedResult);
    mockRepository.save.mockResolvedValue({ id: '123', ...expectedResult });

    // Act
    const result = await gradingService.gradeEssay(essayText, rubric);

    // Assert
    expect(result.grade).toBe(85);
    expect(mockRepository.save).toHaveBeenCalledWith(expectedResult);
  });
});
```

## 🚀 Deployment Considerations

### **Environment Preparation**
1. Set environment variables
2. Run database migrations
3. Build and optimize application
4. Configure monitoring and logging

### **Health Checks**
```javascript
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check external services
    const aiStatus = await aiClient.healthCheck();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        ai: aiStatus ? 'up' : 'down'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

## 📊 Monitoring and Observability

### **Logging Strategy**
- Structured logging with JSON format
- Request/response logging
- Error logging with stack traces
- Performance metrics logging

### **Metrics Collection**
- Request duration and count
- Database query performance
- Error rates by endpoint
- AI API usage statistics

### **Example Logging**:
```javascript
logger.info('Essay graded successfully', {
  requestId: req.id,
  studentId: result.studentId,
  grade: result.grade,
  processingTimeMs: Date.now() - startTime,
  aiModel: config.ai.model
});
```

---

This backend architecture provides a solid foundation for scalable, maintainable, and testable application development. The enterprise patterns ensure the codebase can grow with business requirements while maintaining code quality and developer productivity.