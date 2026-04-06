# 🔧 SpreadFast Deployment - Comprehensive Troubleshooting Guide

Everything that can go wrong during deployment and how to fix it.

---

## TABLE OF CONTENTS
1. [Before Deployment Issues](#before-deployment)
2. [Git & GitHub Issues](#git--github)
3. [Railway Backend Issues](#railway-backend)
4. [Vercel Frontend Issues](#vercel-frontend)
5. [Connection Issues](#connection-issues)
6. [Feature Not Working Issues](#feature-not-working)
7. [Performance Issues](#performance-issues)
8. [Emergency Fixes](#emergency-fixes)

---

# BEFORE DEPLOYMENT

## Issue: "Cannot find file" or "File not found"

**Error Message:**
```
No such file or directory c:\Users\DELL E7440\Desktop\spreadfast\index.html
```

**Cause:** Old files still exist

**Solution:**
```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast
dir
```

Verify you see:
```
client/
server/
.gitignore
package.json
*.md files
```

You should NOT see:
```
index.html
styles.css
```

If they exist, delete them:
```powershell
rm index.html
rm styles.css
```

---

## Issue: "No package.json in root"

**Error Message:**
```
error: pathspec 'package.json' did not match any files
```

**Cause:** You're in the wrong directory

**Solution:**
```powershell
# Check current directory
Get-Location

# Should be: C:\Users\DELL E7440\Desktop\spreadfast
# If not, navigate there
cd c:\Users\DELL E7440\Desktop\spreadfast
```

---

# GIT & GITHUB

## Issue: "fatal: not a git repository"

**Error Message:**
```
fatal: not a git repository (or any of the parent directories): .git
```

**Cause:** Haven't initialized git yet

**Solution:**
```powershell
git init
```

---

## Issue: "fatal: could not read commit message"

**Error Message:**
```
error: pathspec 'commit message' did not match any files
```

**Cause:** Wrong git command syntax

**Solution:**
Make sure quotes are correct:
```powershell
# ✅ CORRECT
git commit -m "Initial commit"

# ❌ WRONG (these will fail)
git commit -m Initial commit
git commit -m 'Initial commit
```

---

## Issue: "fatal: remote origin already exists"

**Error Message:**
```
fatal: remote origin already exists.
```

**Cause:** You already added the remote

**Solution:**

Check what remotes exist:
```powershell
git remote -v
```

Remove the old one:
```powershell
git remote remove origin
```

Then add the correct one:
```powershell
git remote add origin https://github.com/fatihu45/spreadfast.git
```

---

## Issue: "Permission denied (publickey)"

**Error Message:**
```
Permission denied (publickey).
fatal: Could not read from remote repository.
```

**Cause:** GitHub authentication failed

**Solution:**

Use Personal Access Token instead of password:

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: `SpreadFast`
4. Check: `repo` checkbox
5. Click "Generate token"
6. **Copy the token** (shown once!)
7. Try pushing again:
   ```powershell
   git push -u origin main
   ```
8. When asked for password, paste the token

**OR** use HTTPS instead of SSH:

```powershell
# Remove old remote
git remote remove origin

# Add HTTPS remote
git remote add origin https://github.com/fatihu45/spreadfast.git

# Push
git push -u origin main
```

---

## Issue: "Nothing to commit"

**Error Message:**
```
nothing to commit, working tree clean
```

**Cause:** No changes to commit

**Solution:**

Check what changed:
```powershell
git status
```

If no changes shown, files are already committed.

If you made changes they're not showing:
```powershell
git add .
git status
```

Then commit:
```powershell
git commit -m "Your message"
```

---

## Issue: "Files not showing up on GitHub"

**Error Message:** No error, but files missing on GitHub

**Cause:** Push failed silently

**Solution:**

Check branch:
```powershell
git branch
```

Current branch should have `*` next to it.

If on wrong branch:
```powershell
git checkout main
git push origin main
```

If branch doesn't exist:
```powershell
git branch -M main
git push -u origin main
```

---

# RAILWAY BACKEND

## Issue: "Deployment failed"

**What You'll See:** Red error in Railway dashboard

**Cause:** Many possibilities

**Solution:**

1. Click the failed deployment
2. Scroll to **"Logs"** section
3. Look for red error messages
4. Common errors below:

---

## Issue: "Cannot find module 'express'"

**Error in Railway Logs:**
```
Error: Cannot find module 'express'
```

**Cause:** Dependencies not installed

**Solution:**

1. Go to Railway settings
2. Verify you have **Root Directory:** `server`
3. Verify **Start Command:** `npm start`
4. Try redeploying:
   - Click **"Redeploy"** button
   - Railway reinstalls dependencies

If still fails:
```powershell
# Locally, in server folder
cd server
npm install
git add .
git commit -m "Update dependencies"
git push
```

---

## Issue: "EADDRINUSE: address already in use :::5000"

**Error in Railway Logs:**
```
EADDRINUSE: address already in use :::5000
```

**Cause:** Port 5000 already in use locally (not a Railway issue)

**Solution:**

This is only a problem on YOUR computer:
```powershell
# Check what's using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID with the number)
taskkill /PID [PID] /F

# Try starting again
npm start
```

---

## Issue: "Cannot read property 'MONGODB_URI' of undefined"

**Error in Railway Logs:**
```
TypeError: Cannot read property 'MONGODB_URI' of undefined
```

**Cause:** Environment variable not set

**Solution:**

1. Go to Railway dashboard
2. Click your service
3. Click **"Variables"**
4. Add the missing variable (if you're using MongoDB):

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
```

5. Click **"Save"**
6. Red deploy icon appears (Railway auto-restarts)

---

## Issue: "Port 5000 not working"

**What I'll See:** 
- Build succeeds
- But `curl https://backend-url/api/health` shows connection error

**Cause:** Server isn't listening on port 5000

**Solution:**

1. Check server.js:
```powershell
# See what port it's using
grep "PORT" server/server.js
```

Should see:
```javascript
const PORT = process.env.PORT || 5000;
```

2. Set PORT in Railway variables:
   - Go to Railway dashboard
   - Click Variables
   - Add: `PORT=5000`
   - Save and restart

---

## Issue: "CORS error on frontend"

**Error in Browser Console:**
```
Access to XMLHttpRequest at 'https://backend-url/api/campaigns' 
from origin 'https://spreadfast.vercel.app' has been blocked by CORS policy
```

**Cause:** CORS_ORIGIN not set correctly

**Solution:**

1. Go to Railway backend service
2. Click **"Variables"**
3. Find `CORS_ORIGIN`
4. Should be exactly: `https://spreadfast.vercel.app`
5. NOT: `spreadfast.vercel.app` (missing https://)
6. NOT: `https://spreadfast.vercel.app/` (extra slash)
7. Click **"Save"**
8. Wait 1 minute for restart
9. Refresh browser (Ctrl+Shift+R for hard refresh)

---

## Issue: "'Server not found' error"

**In Browser:**
```
Failed to fetch
TypeError: Failed to fetch
```

**Cause:** Backend URL wrong or server not running

**Solution:**

1. Test backend is running:
```powershell
# Replace with your actual URL
curl https://your-backend-url/api/health
```

Should return:
```json
{"status": "Server is running"}
```

If doesn't work:
- Go to Railway dashboard
- Check "Deployments" tab
- Should see green checkmark
- If red, click to see error logs

2. Check REACT_APP_API_URL in Vercel:
   - Go to Vercel dashboard
   - Go to project Settings
   - Check Environment Variables
   - `REACT_APP_API_URL` should be your backend URL + `/api`
   - Example: `https://my-backend.up.railway.app/api`

---

# VERCEL FRONTEND

## Issue: "Build failed"

**What You'll See:** Red error in Vercel dashboard

**Solution:**

1. Click the failed deployment
2. Scroll to **"Build Logs"** section
3. Look for red error messages

**Common build errors:**

### "Cannot find module 'react'"
```
Module not found: Can't resolve 'react'
```

**Solution:**
1. Check Root Directory: should be `client`
2. Check Build Command: should be `npm run build`
3. Redeploy

### "npm ERR! Missing script: build"
```
npm ERR! missing script: build
```

**Cause:** package.json missing build script

**Solution:**
1. Check if `client/package.json` has `"build"` script
2. Usually it does by default:
```json
"scripts": {
  "build": "react-scripts build"
}
```

If missing, add it and push to GitHub:
```powershell
cd client
# Check package.json
cat package.json | grep -A5 scripts
```

If missing scripts:
```powershell
npm install react-scripts
git add .
git commit -m "Fix: Add react-scripts"
git push
```

---

## Issue: "Page shows blank"

**What You'll See:** Website loads but page is empty

**Cause:** Frontend built but not running correctly

**Solution:**

1. Check browser console (F12 → Console)
2. Look for errors in red
3. Common error: "Cannot reach backend"
   - Check REACT_APP_API_URL variable
   - Vercel dashboard → Settings → Environment Variables
   - Should be your backend URL

4. If no API errors:
   - Hard refresh: Ctrl+Shift+R
   - Clear browser cache:
     - F12 → Application → Clear storage
     - Hard refresh again

---

## Issue: "Changes not showing up"

**What You'll See:** Push to GitHub but Vercel still shows old version

**Cause:** Vercel caching

**Solution:**

1. Go to Vercel dashboard
2. Click your project
3. Click "Deployments"
4. Find the latest deployment
5. Click "..." menu
6. Click "Redeploy"

Or trigger new deploy by pushing:
```powershell
git add .
git commit -m "Trigger redeploy"
git push
```

---

## Issue: "Environment variables not working"

**What You'll See:** Code uses process.env.REACT_APP_API_URL but it's undefined

**Cause:** Variable not prefixed with REACT_APP_

**Solution:**

All frontend env vars MUST start with `REACT_APP_`

**Wrong:**
```
API_URL=https://...
```

**Correct:**
```
REACT_APP_API_URL=https://...
```

In code:
```javascript
const apiUrl = process.env.REACT_APP_API_URL;
```

---

## Issue: "CSS not loading / Page looks ugly"

**What You'll See:** No styling, default browser look

**Cause:** TailwindCSS build failed

**Solution:**

1. Check `client/package.json` has:
   - `tailwindcss`
   - `postcss`
   - `autoprefixer`

2. Check `client/postcss.config.js` exists

3. Check `client/src/index.css` has:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

4. If missing, add and push:
```powershell
git add client/
git commit -m "Fix: TailwindCSS configuration"
git push
```

Then redeploy in Vercel.

---

# CONNECTION ISSUES

## Issue: "Frontend connects but shows errors when using features"

**What You'll See:** Page loads fine, but clicking buttons causes errors

**Cause:** Backend connection failed

**Solution:**

1. Open browser console (F12)
2. Look for error messages
3. Check if it's a CORS error
4. Check if it's a network error (404, 500, etc.)

**For CORS Error:**
```
Access to XMLHttpRequest ... has been blocked by CORS policy
```

Fix:
1. Go to Railway backend
2. Check CORS_ORIGIN matches frontend URL exactly
3. Save and wait 1 minute
4. Hard refresh browser

**For 404 Error:**
```
Failed to load resource: the server responded with a status of 404
```

Fix:
1. Check API endpoint exists in server.js
2. Check URL format in api.js is correct
3. Example: `https://backend-url/api/campaigns` (NOT `/api/api/campaigns`)

**For 500 Error:**
```
Failed to load resource: the server responded with a status of 500
```

Fix:
1. Go to Railway logs
2. Look for error message
3. Check if required field missing
4. Check if database connection error

---

## Issue: "Intermittent connection failures"

**What You'll See:** Sometimes works, sometimes "Connection failed"

**Cause:** Railway server waking up from sleep (free tier)

**Solution:**

Railway free tier stops server after inactivity. Solutions:

1. **Upgrade Railway tier** (paid)
   - Go to Railway settings
   - Click "Upgrade"
   - Choose paid plan

2. **Keep-alive script** (free but complex)
   - Ping server every 5 minutes
   - (advanced - ask for help)

3. **Accept occasional delays**
   - For MVP, this is normal
   - Upgrade after getting users/funding

---

# FEATURE NOT WORKING

## Issue: "Can't create campaign"

**Symptom:** Click "Create Campaign" → no response or error

**Debugging Steps:**

1. **Check form validation:**
   - Fill ALL fields
   - Check browser console for client-side errors

2. **Check API call:**
   - Open browser DevTools (F12)
   - Go to "Network" tab
   - Click "Create Campaign"
   - Look for request to `/api/campaigns`
   - Click it to see request/response

3. **Common errors:**

**"Required field missing"**
- Solution: Fill all required fields

**"Network error"**
- Solution: Check if backend URL is correct in REACT_APP_API_URL

**"CORS error"**
- Solution: Update CORS_ORIGIN in Railway to match frontend URL

**"500 Server Error"**
- Solution: Check Railway logs for what went wrong

---

## Issue: "Can't register user"

**Symptom:** Click "Join as Promoter" → no response or error

**Debugging:**

Same as "Can't create campaign" above.

Also check:
- Email must be unique
- If you registered same email twice, you'll get error
- Try with different email

---

## Issue: "Can't submit proof"

**Symptom:** Click "Submit Proof" → no response

**Debugging:**

1. Check campaign ID is selected
   - URL should be: `/submit?campaignId=xxx`
   - If not, go back to Campaigns page
   - Click "Participate" on a campaign
   - Should auto-fill campaign ID

2. Check all fields filled

3. Look in browser Network tab for requests

---

## Issue: "Can't approve submission in admin"

**Symptom:** Admin dashboard loads but buttons don't work

**Debugging:**

1. Check you can see submissions
   - If not, no data submitted yet
   - Go submit something first

2. Check browser console for errors
   - F12 → Console → Look for red errors

3. Check backend is running
   - Open: `https://backend-url/api/submissions`
   - Should see JSON array

---

# PERFORMANCE ISSUES

## Issue: "Page loads slowly"

**Cause:** Many reasons

**Solutions:**

1. **Upgrade Railway tier**
   - Free tier is slow
   - Paid tier starts at $5/month

2. **Optimize images**
   - Use smaller image files
   - Compress JPGs/PNGs

3. **Enable Vercel caching**
   - Usually automatic
   - Frontend should be fast (CDN served)

4. **Check backend logs**
   - Is backend responding slowly?
   - Railway dashboard → Logs

---

## Issue: "Form submission takes forever"

**Cause:** Backend slow or timeout

**Solutions:**

1. Check Railway logs:
   - Go to Railway Deployments
   - Look for slow queries

2. Check network requests:
   - F12 → Network → Create campaign
   - Look at "Time" column
   - If >5 seconds, something is slow

3. Try with smaller data:
   - Shorter descriptions
   - Smaller numbers

---

# EMERGENCY FIXES

## Fix: "Everything is broken, need to restart"

**Option 1: Clear and restart frontend**

In Vercel:
1. Go to Deployments
2. Find the last working deployment
3. Click "Redeploy"

**Option 2: Clear and restart backend**

In Railway:
1. Go to your service
2. Click "..." menu
3. Click "Restart"

**Option 3: Full reset**

```powershell
# Locally, clean install
cd client
rm -r node_modules package-lock.json
npm install
npm start

# In another terminal
cd server
rm -r node_modules package-lock.json
npm install
npm start
```

---

## Fix: "Need to check old version of code"

```powershell
# See previous commits
git log

# Go back to specific commit
git checkout [commit-hash]

# Come back to latest
git checkout main
```

---

## Fix: "Accidentally deleted important file"

```powershell
# See what you deleted
git status

# Restore from git
git restore [filename]

# Or from specific commit
git checkout [commit-hash] -- [filename]
```

---

## Fix: "Pushed wrong code to GitHub"

```powershell
# See last commits
git log

# Reset to previous commit (keeps changes locally)
git reset --soft HEAD~1

# OR reset completely (loses changes)
git reset --hard HEAD~1

# Then push
git push origin main --force

# CAREFUL: --force is dangerous!
```

---

## Fix: "Can't remember my GitHub token"

Create a new one:

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token"
3. Copy and use it

Old token is gone - that's fine, use the new one.

---

## Fix: "Railway free tier ran out"

Railway free tier has usage limits.

**Solutions:**

1. **Upgrade to paid**
   - Railway dashboard → Billing
   - Starts at $5/month

2. **Use different service**
   - Heroku (older but reliable)
   - Render.com (free tier available)
   - AWS (pay per use)

3. **Wait for monthly reset**
   - Free tier resets each month
   - But limited usage

---

## Fix: "Vercel deployment keeps failing"

1. Check build logs carefully
2. Try local build:
```powershell
cd client
npm run build
```

If local build fails, fix it first.

Then push to GitHub and Vercel will build it correctly.

---

# FINAL CHECKLIST: Before Declaring "Working"

- [ ] Backend health check passes: `curl https://backend-url/api/health`
- [ ] Frontend loads in browser
- [ ] Can create a campaign
- [ ] Campaign appears in marketplace
- [ ] Can register as user
- [ ] Can submit proof
- [ ] Can approve in admin
- [ ] No errors in browser console (F12)
- [ ] No errors in Railway logs
- [ ] Data persists after page refresh
- [ ] Data persists after server restart

**If all checked:** Everything is working! 🎉

---

## Need Help?

**If stuck:**

1. Check this guide for your error
2. Check Railway/Vercel logs
3. Check browser console (F12)
4. Search for error message on Google
5. Read the main deployment guides again

**Most issues are:**
- Wrong URL format
- CORS misconfiguration
- Missing environment variables
- Wrong directory structure

**Double-check these first!**
