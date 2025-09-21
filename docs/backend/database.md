# Database Architecture Guide

## 🗄️ Overview

The ESL Grading Tool uses **SQLite** with **Prisma ORM** for data persistence. This combination provides type safety, automatic migrations, and excellent developer experience while maintaining simplicity for deployment and development.

## 🏗️ Database Architecture

### **Technology Stack**
- **Database Engine**: SQLite 3.x
- **ORM**: Prisma 6.x
- **Migration Tool**: Prisma Migrate
- **Query Builder**: Prisma Client
- **Schema Language**: Prisma Schema Language (PSL)

### **Key Benefits**
- **Type Safety**: Generated TypeScript types
- **Zero-Config**: No database server setup required
- **ACID Compliance**: Full transaction support
- **Backup Simplicity**: Single file database
- **Development Speed**: Instant setup and seeding

## 📊 Schema Design

### **Core Entities**

#### **GradingResult**
Primary entity storing essay grading information.

```prisma
model GradingResult {
  id              String   @id @default(cuid())

  // Essay content and metadata
  essayText       String
  studentId       String?
  studentName     String?

  // Grading results
  grade           Float
  feedback        String
  breakdown       Json?    // Detailed scoring breakdown

  // Rubric and configuration
  rubricData      Json     // Rubric used for grading
  profileId       String?

  // AI processing metadata
  aiModel         String   @default("gpt-4")
  temperature     Float    @default(0.7)
  processingTime  Int?     // Processing time in milliseconds

  // Audit fields
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relationships
  profile         ClassProfile? @relation(fields: [profileId], references: [id])

  // Indexes for performance
  @@index([studentId])
  @@index([profileId])
  @@index([createdAt])
  @@index([grade])

  @@map("grading_results")
}
```

#### **ClassProfile**
Configuration profiles for different class types and grading criteria.

```prisma
model ClassProfile {
  id              String   @id @default(cuid())

  // Profile information
  name            String   @unique
  description     String

  // AI configuration
  temperature     Float    @default(0.7)
  model           String   @default("gpt-4")

  // Status and metadata
  isActive        Boolean  @default(true)
  isDefault       Boolean  @default(false)

  // Usage statistics
  essayCount      Int      @default(0)
  lastUsed        DateTime?

  // Audit fields
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relationships
  gradingResults  GradingResult[]

  // Indexes
  @@index([isActive])
  @@index([name])

  @@map("class_profiles")
}
```

#### **BatchJob** (Future Enhancement)
For tracking batch grading operations.

```prisma
model BatchJob {
  id              String   @id @default(cuid())

  // Job metadata
  status          BatchStatus @default(PENDING)
  totalEssays     Int
  processedEssays Int      @default(0)
  failedEssays    Int      @default(0)

  // Configuration
  profileId       String?
  rubricData      Json

  // Progress tracking
  startedAt       DateTime?
  completedAt     DateTime?
  estimatedTime   Int?     // Estimated completion time in ms

  // Error handling
  errors          Json?    // Array of error details

  // Audit fields
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relationships
  profile         ClassProfile? @relation(fields: [profileId], references: [id])
  results         GradingResult[]

  @@index([status])
  @@index([createdAt])

  @@map("batch_jobs")
}

enum BatchStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}
```

### **JSON Schema Definitions**

#### **Rubric Data Structure**
```typescript
interface RubricData {
  criteria: RubricCriterion[];
  maxScore: number;
  gradingInstructions?: string;
  focusAreas?: string[];
}

interface RubricCriterion {
  name: string;
  weight: number;
  description: string;
  levels?: RubricLevel[];
}

interface RubricLevel {
  score: number;
  description: string;
  indicators: string[];
}
```

#### **Breakdown Data Structure**
```typescript
interface GradingBreakdown {
  [criterionName: string]: {
    score: number;
    maxScore: number;
    percentage: number;
    feedback: string;
    strengths?: string[];
    improvements?: string[];
  };
}
```

## 🔍 Repository Pattern Implementation

### **Base Repository**
```typescript
// /src/core/Repository.ts
abstract class Repository<T> {
  constructor(
    protected model: any, // Prisma model
    protected cache?: CacheService
  ) {}

  async findById(id: string): Promise<T | null> {
    const cacheKey = `${this.model.name}:${id}`;

    // Check cache first
    const cached = await this.cache?.get(cacheKey);
    if (cached) return cached;

    // Query database
    const result = await this.model.findUnique({
      where: { id }
    });

    // Cache result
    if (result) {
      await this.cache?.set(cacheKey, result, 300); // 5 minutes
    }

    return result;
  }

  async findMany(options: any): Promise<T[]> {
    return this.model.findMany(options);
  }

  async create(data: any): Promise<T> {
    const result = await this.model.create({ data });

    // Invalidate related caches
    await this.invalidateCache(result);

    return result;
  }

  async update(id: string, data: any): Promise<T> {
    const result = await this.model.update({
      where: { id },
      data
    });

    // Invalidate caches
    await this.invalidateCache(result);

    return result;
  }

  async delete(id: string): Promise<void> {
    await this.model.delete({ where: { id } });

    // Invalidate caches
    await this.cache?.delete(`${this.model.name}:${id}`);
  }

  protected async invalidateCache(entity: any): Promise<void> {
    // Override in specific repositories
  }
}
```

### **GradingResultRepository**
```typescript
class GradingResultRepository extends Repository<GradingResult> {
  constructor(prisma: PrismaClient, cache: CacheService) {
    super(prisma.gradingResult, cache);
  }

  async findByStudentId(
    studentId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<GradingResult>> {
    const { page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = options;

    const [results, total] = await Promise.all([
      this.model.findMany({
        where: { studentId },
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          profile: true
        }
      }),
      this.model.count({ where: { studentId } })
    ]);

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  async findByGradeRange(
    minGrade: number,
    maxGrade: number
  ): Promise<GradingResult[]> {
    return this.model.findMany({
      where: {
        grade: {
          gte: minGrade,
          lte: maxGrade
        }
      },
      orderBy: { grade: 'desc' }
    });
  }

  async getGradingStatistics(
    filters: StatisticsFilters = {}
  ): Promise<GradingStatistics> {
    const whereClause = this.buildWhereClause(filters);

    const [
      totalEssays,
      averageGrade,
      gradeDistribution
    ] = await Promise.all([
      this.model.count({ where: whereClause }),

      this.model.aggregate({
        where: whereClause,
        _avg: { grade: true },
        _min: { grade: true },
        _max: { grade: true }
      }),

      this.model.groupBy({
        by: ['grade'],
        where: whereClause,
        _count: true
      })
    ]);

    return {
      totalEssays,
      averageGrade: averageGrade._avg.grade || 0,
      minGrade: averageGrade._min.grade || 0,
      maxGrade: averageGrade._max.grade || 0,
      gradeDistribution: this.processGradeDistribution(gradeDistribution)
    };
  }

  private buildWhereClause(filters: StatisticsFilters): any {
    const where: any = {};

    if (filters.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters.profileId) {
      where.profileId = filters.profileId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    return where;
  }

  protected async invalidateCache(entity: GradingResult): Promise<void> {
    // Invalidate student-specific caches
    if (entity.studentId) {
      await this.cache?.delete(`student:${entity.studentId}:grades`);
      await this.cache?.delete(`student:${entity.studentId}:stats`);
    }

    // Invalidate profile-specific caches
    if (entity.profileId) {
      await this.cache?.delete(`profile:${entity.profileId}:grades`);
    }

    // Invalidate global statistics
    await this.cache?.delete('global:grading:stats');
  }
}
```

### **ClassProfileRepository**
```typescript
class ClassProfileRepository extends Repository<ClassProfile> {
  constructor(prisma: PrismaClient, cache: CacheService) {
    super(prisma.classProfile, cache);
  }

  async findActive(): Promise<ClassProfile[]> {
    const cacheKey = 'profiles:active';

    const cached = await this.cache?.get(cacheKey);
    if (cached) return cached;

    const profiles = await this.model.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    await this.cache?.set(cacheKey, profiles, 600); // 10 minutes
    return profiles;
  }

  async findDefault(): Promise<ClassProfile | null> {
    return this.model.findFirst({
      where: { isDefault: true, isActive: true }
    });
  }

  async incrementEssayCount(id: string): Promise<void> {
    await this.model.update({
      where: { id },
      data: {
        essayCount: { increment: 1 },
        lastUsed: new Date()
      }
    });

    // Invalidate caches
    await this.cache?.delete(`profile:${id}`);
    await this.cache?.delete('profiles:active');
  }

  async getProfileUsageStats(): Promise<ProfileUsageStats[]> {
    return this.model.findMany({
      select: {
        id: true,
        name: true,
        essayCount: true,
        lastUsed: true,
        _count: {
          select: {
            gradingResults: true
          }
        }
      },
      orderBy: { essayCount: 'desc' }
    });
  }
}
```

## 🚀 Query Optimization

### **Indexing Strategy**

#### **Performance-Critical Indexes**
```sql
-- Student-based queries (most common)
CREATE INDEX idx_grading_results_student_id ON grading_results(student_id);
CREATE INDEX idx_grading_results_student_created ON grading_results(student_id, created_at DESC);

-- Grade-based filtering and sorting
CREATE INDEX idx_grading_results_grade ON grading_results(grade);
CREATE INDEX idx_grading_results_grade_created ON grading_results(grade, created_at DESC);

-- Profile-based queries
CREATE INDEX idx_grading_results_profile_id ON grading_results(profile_id);

-- Time-based queries
CREATE INDEX idx_grading_results_created_at ON grading_results(created_at DESC);

-- Composite indexes for common filters
CREATE INDEX idx_grading_results_student_profile_created
  ON grading_results(student_id, profile_id, created_at DESC);
```

#### **Profile Table Indexes**
```sql
-- Active profile lookup
CREATE INDEX idx_class_profiles_active ON class_profiles(is_active);

-- Profile search
CREATE INDEX idx_class_profiles_name ON class_profiles(name);

-- Usage statistics
CREATE INDEX idx_class_profiles_essay_count ON class_profiles(essay_count DESC);
```

### **Query Patterns**

#### **Efficient Pagination**
```typescript
// Cursor-based pagination for large datasets
async findGradingResultsCursor(
  cursor?: string,
  limit: number = 20
): Promise<CursorPaginatedResult<GradingResult>> {
  const results = await this.model.findMany({
    take: limit + 1, // Fetch one extra to check if there are more
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1 // Skip the cursor item
    }),
    orderBy: { createdAt: 'desc' },
    include: {
      profile: {
        select: { id: true, name: true }
      }
    }
  });

  const hasNextPage = results.length > limit;
  const items = hasNextPage ? results.slice(0, -1) : results;

  return {
    data: items,
    hasNextPage,
    nextCursor: items.length > 0 ? items[items.length - 1].id : null
  };
}
```

#### **Optimized Aggregations**
```typescript
// Efficient statistics calculation
async getOptimizedStatistics(): Promise<GradingStatistics> {
  // Use raw SQL for complex aggregations
  const result = await this.prisma.$queryRaw<StatisticsResult[]>`
    SELECT
      COUNT(*) as total_essays,
      AVG(grade) as average_grade,
      MIN(grade) as min_grade,
      MAX(grade) as max_grade,
      COUNT(CASE WHEN grade >= 90 THEN 1 END) as grade_a,
      COUNT(CASE WHEN grade >= 80 AND grade < 90 THEN 1 END) as grade_b,
      COUNT(CASE WHEN grade >= 70 AND grade < 80 THEN 1 END) as grade_c,
      COUNT(CASE WHEN grade < 70 THEN 1 END) as grade_below_c
    FROM grading_results
    WHERE created_at >= datetime('now', '-30 days')
  `;

  return this.transformStatisticsResult(result[0]);
}
```

## 🔧 Migration Management

### **Schema Evolution**
```prisma
// Migration example: Adding new fields
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// Migration: Add essay categories
model GradingResult {
  // ... existing fields

  // New fields (added in migration)
  category        String?   // Essay type/category
  difficulty      String?   // Difficulty level
  wordCount       Int?      // Essay word count
  tags            Json?     // Flexible tagging system

  // Migration: Add soft delete
  deletedAt       DateTime?

  @@map("grading_results")
}
```

### **Data Migration Scripts**
```typescript
// /scripts/migrations/add-word-count.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addWordCountToExistingEssays() {
  const essays = await prisma.gradingResult.findMany({
    where: { wordCount: null },
    select: { id: true, essayText: true }
  });

  console.log(`Processing ${essays.length} essays...`);

  for (const essay of essays) {
    const wordCount = essay.essayText.split(/\s+/).length;

    await prisma.gradingResult.update({
      where: { id: essay.id },
      data: { wordCount }
    });
  }

  console.log('Word count migration completed');
}

addWordCountToExistingEssays()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## 🔄 Backup and Recovery

### **Backup Strategy**
```bash
#!/bin/bash
# backup-database.sh

DB_PATH="./prisma/dev.db"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/grading_tool_${TIMESTAMP}.db"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
cp $DB_PATH $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Clean old backups (keep last 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup created: ${BACKUP_FILE}.gz"
```

### **Recovery Procedures**
```bash
#!/bin/bash
# restore-database.sh

BACKUP_FILE=$1
DB_PATH="./prisma/dev.db"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.gz>"
  exit 1
fi

# Stop application
echo "Stopping application..."
pkill -f "node server.js"

# Backup current database
cp $DB_PATH "${DB_PATH}.backup.$(date +%Y%m%d_%H%M%S)"

# Restore from backup
gunzip -c $BACKUP_FILE > $DB_PATH

# Verify database integrity
sqlite3 $DB_PATH "PRAGMA integrity_check;"

echo "Database restored from $BACKUP_FILE"
echo "Please restart the application"
```

## 📊 Performance Monitoring

### **Query Performance Logging**
```typescript
// /src/middleware/queryLogger.ts
export function createQueryLogger() {
  return prisma.$extends({
    query: {
      $allOperations({ operation, model, args, query }) {
        const start = Date.now();

        return query(args).then((result) => {
          const duration = Date.now() - start;

          // Log slow queries (> 100ms)
          if (duration > 100) {
            console.warn('Slow query detected', {
              model,
              operation,
              duration,
              args: JSON.stringify(args)
            });
          }

          // Track query metrics
          queryMetrics.record({
            model,
            operation,
            duration,
            timestamp: new Date()
          });

          return result;
        });
      }
    }
  });
}
```

### **Database Health Monitoring**
```typescript
// /src/services/databaseHealthService.ts
export class DatabaseHealthService {
  async checkHealth(): Promise<DatabaseHealth> {
    try {
      // Test basic connectivity
      await prisma.$queryRaw`SELECT 1`;

      // Check database size
      const sizeResult = await prisma.$queryRaw<[{ size: number }]>`
        SELECT page_count * page_size as size
        FROM pragma_page_count(), pragma_page_size()
      `;

      // Check table counts
      const tableCounts = await Promise.all([
        prisma.gradingResult.count(),
        prisma.classProfile.count()
      ]);

      return {
        status: 'healthy',
        size: sizeResult[0].size,
        tables: {
          gradingResults: tableCounts[0],
          classProfiles: tableCounts[1]
        },
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date()
      };
    }
  }
}
```

## 🔐 Security Considerations

### **Data Sanitization**
```typescript
// Input sanitization for essay text
function sanitizeEssayText(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .trim()
    .substring(0, 50000); // Enforce length limit
}
```

### **SQL Injection Prevention**
- Use Prisma's query builder exclusively
- Avoid raw SQL queries when possible
- Parameterize all raw queries
- Validate all input parameters

### **Data Privacy**
- Implement data retention policies
- Add anonymization capabilities
- Encrypt sensitive data at rest
- Audit data access patterns

---

This database architecture provides a solid foundation for the ESL Grading Tool with excellent performance, maintainability, and scalability characteristics while maintaining simplicity and reliability.