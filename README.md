# ⚡ AeroHunter AI - Superfluid Monitor Bot

Telegram bot for monitoring Superfluid earnings in real-time.

## 🚀 Quick Deploy

### Railway (Recommended)

1. Fork/Upload this folder to GitHub
2. Go to [Railway.app](https://railway.app)
3. "New Project" → "Deploy from GitHub"
4. Select repository
5. Add environment variables (see below)
6. Deploy!

### Environment Variables

Add these in Railway dashboard:

```
TELEGRAM_BOT_TOKEN=your_bot_token
NOTIFICATION_CHAT_ID=your_chat_id
PRIVATE_KEY=your_private_key
WALLET_ADDRESS=your_wallet_address
AGENT_ID=your_agent_id
AGENT_URI=your_ipfs_uri
RPC_URL=https://mainnet.base.org
NETWORK=base
```

## 📱 Bot Commands

- `/start` - Welcome message
- `/status` - Agent status
- `/earnings` - Earnings report
- `/score` - Score & ranking
- `/pools` - Pool status
- `/help` - Help message

## 🔒 Security

- Never commit `.env` file
- Keep `PRIVATE_KEY` secret
- Use environment variables in production

## 📊 Features

- Real-time earnings monitoring
- Score tracking
- Pool status updates
- 24/7 automated alerts

## 🛠️ Tech Stack

- Node.js 18+
- ethers.js v6
- Telegram Bot API
- Superfluid Protocol

## 📄 License

MIT
