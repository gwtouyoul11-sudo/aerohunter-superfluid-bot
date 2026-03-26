# 🚂 RAILWAY DEPLOYMENT SETUP

## 🔧 FIX: Bot Crashed - agent-registration.json not found

### ❌ Problem:
File `agent-registration.json` is in `.gitignore`, so Railway doesn't have it!

### ✅ Solution:
Use environment variables instead (more secure!)

---

## 📋 RAILWAY ENVIRONMENT VARIABLES

Go to Railway dashboard → Settings → Variables

Add these variables:

```env
# Telegram Bot (Required)
TELEGRAM_BOT_TOKEN=8756183721:AAHDqSQ1WQIQ8qLJ18CX41T8_q0iF8zRUOs
NOTIFICATION_CHAT_ID=1756474927

# Agent Info (Required)
AGENT_ID=37153
WALLET_ADDRESS=0x9bd1Eb3B0d2dCB671AC3DC582edfaa8e8f4c7F75
AGENT_URI=ipfs://QmbPVN74hTXEJYLC6Bhj7ZZoyzQzRKtWT3KWY6JgVPUKiU

# Wallet Private Key (Optional - only if bot needs to send transactions)
PRIVATE_KEY=0xef726626aa9241d4fccf7d353710718e007d0efad7086887cf403d992a2f372d

# Network (Optional - has defaults)
RPC_URL=https://mainnet.base.org
NETWORK=base
```

---

## 🚀 DEPLOYMENT STEPS

### 1. Push Updated Code

```bash
cd superfluid-bot-deploy
git add bot.js
git commit -m "Add env variable fallback for agent info"
git push origin main
```

Railway will auto-deploy!

### 2. Add Environment Variables

1. Go to: https://railway.app/project/b394c0f3-220e-4e5b-8e2f-c8b9b77e8620
2. Click your service
3. Go to "Variables" tab
4. Click "New Variable"
5. Add all variables from above
6. Click "Deploy"

### 3. Verify Deployment

Check logs for:
```
✅ Loaded agent info from environment

✅ Bot started successfully!

Agent ID: 37153
Owner: 0x9bd1...7f75

📱 Available Commands:
/start - Start bot
...

Waiting for commands...
```

### 4. Test Bot

1. Open Telegram
2. Find: @kuliduit_superfluid_bot
3. Send: `/start`
4. Should get welcome message!

---

## 🔒 SECURITY NOTES

### ✅ GOOD (Current Setup):
- `.env` in `.gitignore` ✅
- `agent-registration.json` in `.gitignore` ✅
- Private keys NOT in GitHub ✅
- Use Railway environment variables ✅

### ❌ BAD (Don't Do This):
- Commit `.env` to GitHub ❌
- Commit private keys ❌
- Share tokens publicly ❌

---

## 🐛 TROUBLESHOOTING

### Bot Still Crashes?

**Check logs for specific error:**

1. **"TELEGRAM_BOT_TOKEN not found"**
   - Add `TELEGRAM_BOT_TOKEN` to Railway variables

2. **"No agent info found"**
   - Add `AGENT_ID` and `WALLET_ADDRESS` to Railway variables

3. **"Polling error"**
   - Check bot token is valid
   - Check bot is not running elsewhere

4. **"Module not found"**
   - Railway should auto-install dependencies
   - Check `package.json` is correct

### How to View Logs:

1. Go to Railway dashboard
2. Click your service
3. Click "Deployments" tab
4. Click latest deployment
5. View "Deploy Logs"

---

## 📊 MONITORING

### Check Bot Status:

**Railway Dashboard:**
- Status: Should show "Active" (green)
- CPU: Should be low (~1-5%)
- Memory: Should be ~50-100 MB

**Telegram:**
- Send `/status` to bot
- Should respond immediately

**8004scan:**
- Check: https://8004scan.io/agents/base/37153
- Score should recover to 60-70+ after bot is running

---

## 🔄 UPDATE BOT

### To update bot code:

```bash
cd superfluid-bot-deploy
# Make changes to bot.js
git add .
git commit -m "Update bot"
git push origin main
```

Railway auto-deploys on push!

### To update environment variables:

1. Go to Railway dashboard
2. Variables tab
3. Edit variable
4. Click "Deploy" to restart with new values

---

## 💰 COST

**Railway Free Tier:**
- $5 credit/month
- ~500 hours runtime
- Enough for 24/7 bot!

**If you need more:**
- Upgrade to Hobby plan ($5/month)
- Or use alternative: Render, Fly.io, etc.

---

## 🎯 EXPECTED RESULT

After setup:
1. ✅ Bot running 24/7 on Railway
2. ✅ Responds to Telegram commands
3. ✅ 8004scan health checks PASS
4. ✅ Score recovers to 60-70+
5. ✅ Services show "Online" on 8004scan

---

**Status:** Ready to deploy! 🚀

**Next:** Add environment variables to Railway and redeploy!
