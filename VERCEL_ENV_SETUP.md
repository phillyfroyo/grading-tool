# Vercel Environment Variable Setup

## Database URL Format

Your DATABASE_URL should look exactly like this:
```
postgresql://username:password@host/database?sslmode=require
```

## In Vercel Dashboard:

1. Go to your project settings
2. Click "Environment Variables"
3. Add a new variable:
   - **Name**: `DATABASE_URL`
   - **Value**: `postgresql://neondb_owner:npg_vBdPpK5rAO4D@ep-broad-salad-adwj3s6d-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`
   - **Environment**: Check all three boxes (Production, Preview, Development)

## Important Notes:

- ✅ **DO NOT** wrap the URL in quotes in Vercel
- ✅ **DO NOT** add extra spaces
- ✅ Make sure it starts with `postgresql://` (not `postgres://`)
- ✅ Include `?sslmode=require` at the end
- ✅ Check all three environment boxes

## Testing:

After setting the environment variable:
1. Redeploy your app (go to Deployments → click the three dots → Redeploy)
2. Check the function logs for connection success/failure messages

## If Still Failing:

The app will fallback to in-memory storage, so it will still work. The database connection is optional.