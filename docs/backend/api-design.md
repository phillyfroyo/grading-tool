# API Design Guide

## 🌐 Overview

This guide outlines the API design principles, conventions, and patterns used in the ESL Grading Tool. The API follows RESTful principles with consistent response formatting, comprehensive error handling, and clear documentation.

## 🎯 Design Principles

### 1. **RESTful Architecture**
- Use HTTP verbs appropriately (GET, POST, PUT, DELETE)
- Resource-based URLs with consistent naming
- Stateless requests with proper status codes
- Consistent response structure across all endpoints

### 2. **Consistency**
- Standardized naming conventions
- Uniform error handling and response formats
- Consistent authentication and authorization patterns
- Predictable behavior across all endpoints

### 3. **Developer Experience**
- Clear, descriptive endpoint names
- Comprehensive error messages
- Detailed API documentation
- Examples for all requests and responses

### 4. **Performance**
- Efficient data transfer with minimal payloads
- Proper caching headers and strategies
- Pagination for large datasets
- Optional field selection

## 📋 API Conventions

### **Base URL Structure**
```
Production:  https://grading-tool.vercel.app/api
Development: http://localhost:3000/api
```

### **Endpoint Naming**
- Use nouns for resources, not verbs
- Use kebab-case for multi-word endpoints
- Use plural nouns for collections
- Use singular nouns for single resources

```
✅ Good:
GET /api/grading-results
POST /api/grading-results
GET /api/grading-results/123
PUT /api/grading-results/123

❌ Bad:
GET /api/getGradingResults
POST /api/create-grading-result
GET /api/gradingResult/123
```

### **HTTP Methods**
- **GET**: Retrieve data (safe, idempotent)
- **POST**: Create new resources
- **PUT**: Update entire resources (idempotent)
- **PATCH**: Partial updates
- **DELETE**: Remove resources (idempotent)

### **Status Codes**
```
200 OK              - Successful GET, PUT, PATCH
201 Created         - Successful POST
204 No Content      - Successful DELETE
400 Bad Request     - Invalid request syntax/parameters
401 Unauthorized    - Authentication required
403 Forbidden       - Insufficient permissions
404 Not Found       - Resource doesn't exist
409 Conflict        - Resource conflict (duplicate)
422 Unprocessable   - Validation errors
429 Too Many Req    - Rate limiting
500 Internal Error  - Server error
503 Service Unavail - Service temporarily down
```

## 📄 Response Format

### **Success Response Structure**
```javascript
{
  "success": true,
  "data": {
    // Response payload
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123",
    "version": "1.0.0"
  }
}
```

### **Error Response Structure**
```javascript
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error context
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123",
    "version": "1.0.0"
  }
}
```

### **Collection Response Structure**
```javascript
{
  "success": true,
  "data": [
    // Array of resources
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123",
    "version": "1.0.0"
  }
}
```

## 🔍 API Endpoints

### **Grading Endpoints**

#### **Grade Single Essay**
```http
POST /api/grade-essay
Content-Type: application/json

{
  "essayText": "The essay content goes here...",
  "rubric": {
    "criteria": [
      {
        "name": "Grammar",
        "weight": 30,
        "description": "Proper grammar usage"
      },
      {
        "name": "Content",
        "weight": 40,
        "description": "Relevance and depth of content"
      },
      {
        "name": "Structure",
        "weight": 30,
        "description": "Essay organization and flow"
      }
    ],
    "maxScore": 100
  },
  "studentId": "student_123",
  "profileId": "profile_456"
}
```

**Response (201 Created)**:
```javascript
{
  "success": true,
  "data": {
    "id": "grade_789",
    "grade": 85.5,
    "feedback": "Excellent work! Your essay demonstrates...",
    "breakdown": {
      "Grammar": { "score": 28, "feedback": "Minor errors..." },
      "Content": { "score": 36, "feedback": "Well researched..." },
      "Structure": { "score": 21.5, "feedback": "Good flow..." }
    },
    "aiModel": "gpt-4",
    "processingTime": 3421,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

#### **Batch Grade Essays**
```http
POST /api/batch-grade
Content-Type: application/json

{
  "essays": [
    {
      "id": "essay_1",
      "text": "First essay content...",
      "studentId": "student_1"
    },
    {
      "id": "essay_2",
      "text": "Second essay content...",
      "studentId": "student_2"
    }
  ],
  "rubric": {
    "criteria": [...],
    "maxScore": 100
  },
  "profileId": "profile_456"
}
```

**Response (202 Accepted)**:
```javascript
{
  "success": true,
  "data": {
    "batchId": "batch_789",
    "status": "processing",
    "totalEssays": 2,
    "estimatedTime": 8000,
    "statusUrl": "/api/batch-status/batch_789"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

#### **Get Grading Results**
```http
GET /api/grading-results?student_id=student_123&limit=20&page=1&sort=created_at&order=desc
```

**Response (200 OK)**:
```javascript
{
  "success": true,
  "data": [
    {
      "id": "grade_789",
      "grade": 85.5,
      "studentId": "student_123",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "feedback": "Excellent work..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

#### **Get Single Grading Result**
```http
GET /api/grading-results/grade_789
```

**Response (200 OK)**:
```javascript
{
  "success": true,
  "data": {
    "id": "grade_789",
    "grade": 85.5,
    "feedback": "Excellent work! Your essay demonstrates...",
    "breakdown": {
      "Grammar": { "score": 28, "feedback": "Minor errors..." },
      "Content": { "score": 36, "feedback": "Well researched..." },
      "Structure": { "score": 21.5, "feedback": "Good flow..." }
    },
    "essayText": "The essay content...",
    "studentId": "student_123",
    "profileId": "profile_456",
    "aiModel": "gpt-4",
    "processingTime": 3421,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

### **Profile Management Endpoints**

#### **Get Class Profiles**
```http
GET /api/profiles?active=true&limit=50
```

**Response (200 OK)**:
```javascript
{
  "success": true,
  "data": [
    {
      "id": "profile_456",
      "name": "Advanced ESL Writing",
      "description": "Profile for advanced ESL students",
      "temperature": 0.7,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "essayCount": 245
    }
  ],
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

#### **Create Class Profile**
```http
POST /api/profiles
Content-Type: application/json

{
  "name": "Beginner ESL Writing",
  "description": "Profile for beginner ESL students with simplified rubrics",
  "temperature": 0.5,
  "isActive": true
}
```

**Response (201 Created)**:
```javascript
{
  "success": true,
  "data": {
    "id": "profile_789",
    "name": "Beginner ESL Writing",
    "description": "Profile for beginner ESL students with simplified rubrics",
    "temperature": 0.5,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

#### **Update Class Profile**
```http
PUT /api/profiles/profile_456
Content-Type: application/json

{
  "name": "Advanced ESL Writing (Updated)",
  "description": "Updated description for advanced ESL students",
  "temperature": 0.8,
  "isActive": true
}
```

**Response (200 OK)**:
```javascript
{
  "success": true,
  "data": {
    "id": "profile_456",
    "name": "Advanced ESL Writing (Updated)",
    "description": "Updated description for advanced ESL students",
    "temperature": 0.8,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:10:00.000Z"
  },
  "meta": {
    "timestamp": "2024-01-01T00:10:00.000Z",
    "requestId": "req_def456"
  }
}
```

#### **Delete Class Profile**
```http
DELETE /api/profiles/profile_456
```

**Response (204 No Content)**

## ❌ Error Handling

### **Error Types and Codes**

#### **Validation Errors (400 Bad Request)**
```javascript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": {
        "essayText": ["Essay text is required", "Essay text must be at least 50 characters"],
        "rubric.criteria": ["At least one criteria is required"]
      }
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

#### **Resource Not Found (404 Not Found)**
```javascript
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Grading result not found",
    "details": {
      "resource": "gradingResult",
      "id": "grade_nonexistent"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

#### **Rate Limiting (429 Too Many Requests)**
```javascript
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "limit": 100,
      "windowMs": 900000,
      "retryAfter": 645
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

#### **Server Error (500 Internal Server Error)**
```javascript
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "errorId": "err_abc123"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

### **Error Code Reference**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTHENTICATION_REQUIRED` | 401 | Authentication required |
| `INSUFFICIENT_PERMISSIONS` | 403 | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource not found |
| `DUPLICATE_RESOURCE` | 409 | Resource already exists |
| `BUSINESS_LOGIC_ERROR` | 422 | Business rule validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `EXTERNAL_SERVICE_ERROR` | 502 | External service unavailable |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

## 🔍 Query Parameters

### **Common Query Parameters**

#### **Pagination**
```
?page=1&limit=20          # Page-based pagination
?cursor=abc123&limit=20   # Cursor-based pagination
```

#### **Sorting**
```
?sort=created_at&order=desc    # Sort by field
?sort=grade,created_at         # Multi-field sorting
```

#### **Filtering**
```
?student_id=123           # Filter by student
?grade_min=80&grade_max=95 # Range filtering
?created_after=2024-01-01 # Date filtering
?active=true              # Boolean filtering
```

#### **Field Selection**
```
?fields=id,grade,created_at    # Select specific fields
?exclude=essay_text,feedback   # Exclude heavy fields
```

#### **Search**
```
?search=excellent writing      # Full-text search
?q=grammar                    # Simple query
```

## 🚀 Performance Considerations

### **Caching Headers**
```http
Cache-Control: public, max-age=300     # 5 minutes for dynamic content
Cache-Control: public, max-age=86400   # 24 hours for static content
ETag: "abc123"                         # Entity tagging
Last-Modified: Wed, 21 Oct 2015 07:28:00 GMT
```

### **Compression**
```http
Accept-Encoding: gzip, deflate, br
Content-Encoding: gzip
```

### **Request Size Limits**
- Maximum request body: 10MB
- Maximum essay text: 50,000 characters
- Maximum batch size: 100 essays

### **Rate Limiting**
- Standard rate limit: 100 requests per 15 minutes per IP
- Grading endpoint: 20 requests per minute per IP
- Batch grading: 5 requests per hour per IP

## 📝 Request/Response Examples

### **Full Grading Workflow Example**

1. **Create a class profile**:
```bash
curl -X POST http://localhost:3000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Profile",
    "description": "Testing profile",
    "temperature": 0.7
  }'
```

2. **Grade an essay**:
```bash
curl -X POST http://localhost:3000/api/grade-essay \
  -H "Content-Type: application/json" \
  -d '{
    "essayText": "This is a sample essay for testing...",
    "rubric": {
      "criteria": [
        {"name": "Grammar", "weight": 40},
        {"name": "Content", "weight": 60}
      ],
      "maxScore": 100
    },
    "profileId": "profile_123"
  }'
```

3. **Get grading results**:
```bash
curl "http://localhost:3000/api/grading-results?limit=10&sort=created_at&order=desc"
```

## 🔐 Security Considerations

### **Input Validation**
- Validate all input parameters
- Sanitize text content to prevent XSS
- Enforce length limits on all text fields
- Validate data types and formats

### **Rate Limiting**
- Implement per-IP rate limiting
- Use sliding window algorithm
- Provide clear rate limit headers

### **Error Information**
- Don't expose internal system details
- Use generic error messages for production
- Log detailed errors server-side only

### **CORS Configuration**
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
}));
```

## 📚 API Documentation

### **OpenAPI/Swagger Specification**
- Maintain up-to-date OpenAPI specification
- Include request/response examples
- Document all error scenarios
- Provide interactive API explorer

### **Versioning Strategy**
- Use semantic versioning (v1, v2, etc.)
- Maintain backward compatibility when possible
- Provide migration guides for breaking changes
- Deprecation notices with timeline

---

This API design ensures consistency, developer-friendly experience, and maintainable codebase while following industry best practices and RESTful principles.