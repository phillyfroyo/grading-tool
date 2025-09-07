# Database Setup for Class Profiles

## Quick Setup with Neon (Recommended)

1. **Create Neon Account**
   - Go to https://neon.tech
   - Sign up with GitHub or email
   - Create a new project (choose a region close to you)

2. **Get Database URL**
   - In your Neon dashboard, go to "Connection Details"
   - Copy the connection string that looks like:
   ```
   postgresql://username:password@host.neon.tech/dbname?sslmode=require
   ```

3. **Update Environment Variables**
   - Open your `.env` file
   - Replace the existing `DATABASE_URL` with your Neon URL:
   ```env
   DATABASE_URL="postgresql://your-neon-connection-string"
   OPENAI_API_KEY=your-existing-key
   ```

4. **Run Database Setup**
   ```bash
   npm run db:setup
   ```

## Alternative: Railway

1. Go to https://railway.app
2. Connect with GitHub
3. Create new project → Add PostgreSQL
4. Copy the `DATABASE_URL` from the Variables tab
5. Update your `.env` file
6. Run `npm run db:setup`

## What This Sets Up

- ✅ Persistent class profile storage
- ✅ Shared profiles across all users
- ✅ Profile changes persist between deployments
- ✅ Full CRUD operations (Create, Read, Update, Delete)

## Commands

- `npm run db:setup` - Create tables and migrate existing profiles
- `npm run db:reset` - Reset database (careful!)
- `npm run db:studio` - Open database browser