#!/usr/bin/env node
/**
 * AeroHunter AI Bot v2.0 - Railway Production
 * Features: Real on-chain earnings, 6 Groq keys rotation, skills, free chat
 */

import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';

dotenv.config({ path: '../.env' });

// ============================================
// CONFIG
// ============================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.NOTIFICATION_CHAT_ID;

// Groq keys - rotate on rate limit
const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5,
  process.env.GROQ_API_KEY_6,
].filter(Boolean);

let groqKeyIndex = 0;
const conversations = new Map();

// Superfluid contracts (Base)
const SUBGRAPH_URL = 'https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1';
const DISTRIBUTOR_ADDRESS = '0x15dcC5564908a3A2C4C7b4659055d0B9e1489A70';
const SUP_TOKEN_ADDRESS = '0xa69f80524381275A7fFdb3AE01c54150644c8792';
const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

// Load agent info
let agentInfo;
try {
  agentInfo = JSON.parse(readFileSync('agent-registration.json', 'utf8'));
} catch {
  agentInfo = {
    agentId: process.env.AGENT_ID || '37153',
    owner: process.env.WALLET_ADDRESS || '0x9bd1Eb3B0d2dCB671AC3DC582edfaa8e8f4c7F75',
    registeredAt: '2026-03-26T06:41:15Z',
    network: 'base',
  };
}

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found'); process.exit(1);
}

// ============================================
// LLM - Groq with 6-key rotation
// ============================================
const SYSTEM_PROMPT = `Kamu adalah AeroHunter AI - asisten untuk Superfluid agent & airdrop hunting.

Agent: #${agentInfo.agentId} | Owner: ${agentInfo.owner} | Network: Base
Pool: Common (score 0-44, $0.14/bln) → Maestro (45-79, $1.68/bln) → Legend (80+, $15/bln)
Score naik dengan: feedback 95%+, uptime 24/7, metadata lengkap

Garapan: APoW mining (npx apow-cli), MineLoot (mineloot.app), Tempo (tempo.xyz), Superfluid ERC-8004
Free API: modal.com, agentrouter.org, bluesminds.com, openrouter.ai

Jawab singkat, padat, bahasa sama dengan user (Indonesia/English).`;

async function askLLM(userMessage, history = []) {
  if (GROQ_KEYS.length === 0) throw new Error('No Groq API keys configured');

  const { default: Groq } = await import('groq-sdk');
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage }
  ];

  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const key = GROQ_KEYS[groqKeyIndex % GROQ_KEYS.length];
    groqKeyIndex++;
    try {
      const groq = new Groq({ apiKey: key });
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 1024,
        temperature: 0.7
      });
      return res.choices[0].message.content;
    } catch (err) {
      if (err.status === 429 || err.status === 413) continue;
      throw err;
    }
  }
  throw new Error('All Groq keys rate limited');
}

// ============================================
// REAL ON-CHAIN: Superfluid earnings
// ============================================
async function getRealEarnings(walletAddress) {
  const query = `{
    accountTokenSnapshots(where: { account: "${walletAddress.toLowerCase()}", token: "${SUP_TOKEN_ADDRESS.toLowerCase()}" }) {
      totalNetFlowRate
      balanceUntilUpdatedAt
      updatedAtTimestamp
      token { symbol id }
    }
    poolMembers(where: { account: "${walletAddress.toLowerCase()}" }) {
      units
      totalAmountClaimed
      totalAmountReceivedUntilUpdatedAt
      updatedAtTimestamp
      pool {
        id
        flowRate
        totalUnits
        totalAmountDistributedUntilUpdatedAt
        token { symbol id }
      }
    }
  }`;

  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error(`Subgraph error: ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0]?.message);

  const snapshots = data?.data?.accountTokenSnapshots || [];
  const poolMembers = data?.data?.poolMembers || [];

  const supSnap = snapshots.find(s => s.token.id.toLowerCase() === SUP_TOKEN_ADDRESS.toLowerCase());
  const flowRate = supSnap ? Number(supSnap.totalNetFlowRate) / 1e18 : 0;
  const balBase = supSnap ? Number(supSnap.balanceUntilUpdatedAt) / 1e18 : 0;
  const updatedAt = supSnap ? Number(supSnap.updatedAtTimestamp) : 0;
  const elapsed = updatedAt ? Math.floor(Date.now() / 1000) - updatedAt : 0;
  const currentBal = Math.max(0, balBase + flowRate * elapsed);

  const pools = poolMembers.map(m => {
    const poolFlowMonth = Number(m.pool.flowRate) / 1e18 * 86400 * 30;
    const myUnits = Number(m.units);
    const totalUnits = Number(m.pool.totalUnits);
    const myShare = totalUnits > 0 ? myUnits / totalUnits : 0;
    return {
      poolId: m.pool.id,
      myUnits,
      totalUnits,
      mySharePct: (myShare * 100).toFixed(4),
      poolFlowMonth: poolFlowMonth.toFixed(4),
      myFlowMonth: (poolFlowMonth * myShare).toFixed(6),
      totalDistributed: (Number(m.pool.totalAmountDistributedUntilUpdatedAt) / 1e18).toFixed(2),
      totalClaimed: (Number(m.totalAmountClaimed) / 1e18).toFixed(6),
      totalReceived: (Number(m.totalAmountReceivedUntilUpdatedAt) / 1e18).toFixed(6),
      hasUnits: myUnits > 0,
    };
  });

  const diagnosis = pools.length === 0 ? 'Belum join pool'
    : pools.every(p => !p.hasUnits) ? 'Join pool ✅ tapi units=0 (score perlu naik)'
    : 'Aktif earning ✅';

  return {
    currentBalance: currentBal.toFixed(6),
    flowPerDay: (flowRate * 86400).toFixed(6),
    flowPerMonth: (flowRate * 86400 * 30).toFixed(4),
    pools,
    diagnosis,
    lastUpdated: updatedAt ? new Date(updatedAt * 1000).toLocaleString('id-ID') : 'N/A'
  };
}

async function getAgentStatus(agentId, ownerAddress) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://mainnet.base.org');
  const dist = new ethers.Contract(DISTRIBUTOR_ADDRESS, [
    'function hasJoined(uint256 agentId) view returns (bool)',
    'function joinFee() view returns (uint256)',
  ], provider);
  const reg = new ethers.Contract(REGISTRY_ADDRESS, [
    'function balanceOf(address owner) view returns (uint256)',
  ], provider);

  const [hasJoined, joinFee, agentCount] = await Promise.allSettled([
    dist.hasJoined(agentId),
    dist.joinFee(),
    reg.balanceOf(ownerAddress),
  ]);

  return {
    hasJoined: hasJoined.status === 'fulfilled' ? hasJoined.value : false,
    joinFee: joinFee.status === 'fulfilled' ? ethers.formatEther(joinFee.value) : '0.0001',
    totalAgents: agentCount.status === 'fulfilled' ? Number(agentCount.value) : 0,
  };
}

async function getCryptoPrice(symbol) {
  const idMap = { btc: 'bitcoin', eth: 'ethereum', sol: 'solana', matic: 'matic-network', pol: 'matic-network', bnb: 'binancecoin' };
  const id = idMap[symbol.toLowerCase()] || symbol.toLowerCase();
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`);
  if (!res.ok) throw new Error('Price fetch failed');
  const data = await res.json();
  if (!data[id]) throw new Error(`Symbol ${symbol} not found`);
  return { symbol: symbol.toUpperCase(), price: data[id].usd, change24h: data[id].usd_24h_change?.toFixed(2) };
}

async function getMineLootRound() {
  const res = await fetch('https://api.mineloot.app/api/round/current');
  if (!res.ok) throw new Error('MineLoot API error');
  const d = await res.json();
  const blocks = d.blocks || [];
  const leastCrowded = [...blocks].sort((a, b) => a.minerCount - b.minerCount).slice(0, 5).map(b => `#${b.id}(${b.minerCount})`);
  return { roundId: d.roundId, totalDeployed: d.totalDeployedFormatted, lootpot: d.lootpotPoolFormatted, leastCrowded };
}

// ============================================
// BOT SETUP
// ============================================
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

console.log('🤖 AeroHunter AI Bot v2.0 starting...');
console.log(`⚡ Groq keys: ${GROQ_KEYS.length}`);
console.log(`🤖 Agent ID: ${agentInfo.agentId}`);
console.log('✅ Bot ready!\n');

// /start
bot.onText(/\/start/, (msg) => {
  const name = msg.from?.first_name || 'bro';
  bot.sendMessage(msg.chat.id, `👋 Halo ${name}!\n\n🤖 *AeroHunter AI Bot v2.0*\n\nCommands:\n/earnings — Real SUP earnings\n/status — Agent status\n/score — Score & rank\n/pools — Pool membership\n/price <symbol> — Harga crypto\n/mineloot — MineLoot status\n/help — Semua commands\n\nAtau kirim pesan biasa untuk chat dengan AI 🧠`, { parse_mode: 'Markdown' });
});

// /help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `📚 *Commands*\n\n*Superfluid:*\n/earnings — Real on-chain earnings\n/status — Agent status\n/score — Score & rank\n/pools — Pool membership\n\n*Tools:*\n/price <symbol> — Harga crypto (btc/eth/sol)\n/mineloot — MineLoot grid\n/gas — Gas price Base\n/reset — Reset chat history\n\n*AI:*\nKirim pesan biasa → dijawab AI\n/ask <pertanyaan> — Tanya AI\n\nGroq keys: ${GROQ_KEYS.length} 🔑`, { parse_mode: 'Markdown' });
});

// /reset
bot.onText(/\/reset/, (msg) => {
  conversations.delete(msg.from.id);
  bot.sendMessage(msg.chat.id, '🔄 Chat history direset!');
});

// /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, 'typing');
  try {
    const status = await getAgentStatus(agentInfo.agentId, agentInfo.owner);
    let text = `✅ *Agent #${agentInfo.agentId}*\n\n`;
    text += `Owner: \`${agentInfo.owner.slice(0, 12)}...\`\n`;
    text += `Network: Base\n`;
    text += `Pool Joined: ${status.hasJoined ? '✅' : '❌'}\n`;
    text += `Total Agents: ${status.totalAgents}\n\n`;
    text += `[Profile](https://8004scan.io/agents/base/${agentInfo.agentId}) | [Score](https://8004classifier.pilou.work/)`;
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

// /earnings
bot.onText(/\/earnings/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, '⏳ Fetching real on-chain data...');
  await bot.sendChatAction(chatId, 'typing');
  try {
    const [earnings, agentStatus] = await Promise.allSettled([
      getRealEarnings(agentInfo.owner),
      getAgentStatus(agentInfo.agentId, agentInfo.owner)
    ]);

    const e = earnings.status === 'fulfilled' ? earnings.value : null;
    const a = agentStatus.status === 'fulfilled' ? agentStatus.value : null;

    let text = `💰 *EARNINGS (REAL ON-CHAIN)*\n\n`;
    if (e) {
      text += `Status: ${e.diagnosis}\n`;
      text += `SUP Balance: ${e.currentBalance} SUP\n`;
      if (e.flowPerMonth !== '0.0000') {
        text += `Flow/month: ${e.flowPerMonth} SUP\n`;
      }
      text += `\n`;
      for (const p of e.pools) {
        const icon = p.hasUnits ? '🟢' : '🔴';
        text += `${icon} Pool \`${p.poolId.slice(0, 10)}...\`\n`;
        text += `  Units: ${p.myUnits}/${p.totalUnits} (${p.mySharePct}%)\n`;
        text += `  Total distributed: ${p.totalDistributed} SUP\n`;
        text += `  My received: ${p.totalReceived} SUP\n\n`;
      }
    }
    if (a) {
      text += `Pool joined: ${a.hasJoined ? '✅' : '❌'}\n`;
    }
    text += `\n[Dashboard](https://app.superfluid.org/) | [Profile](https://8004scan.io/agents/base/${agentInfo.agentId})`;
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

// /score
bot.onText(/\/score/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, 'typing');
  try {
    let scoreData = null;
    try {
      const res = await fetch(`https://8004scan.io/api/agents/${agentInfo.agentId}`, { headers: { Accept: 'application/json' } });
      if (res.ok) scoreData = await res.json();
    } catch {}
    const score = scoreData?.overallScore ?? scoreData?.score ?? 'N/A';
    const rank = scoreData?.rank ?? 'N/A';
    const feedback = scoreData?.feedbackCount ?? scoreData?.totalFeedback ?? 'N/A';
    let tier = score >= 80 ? '🏆 Legend' : score >= 45 ? '⭐ Maestro' : '🟡 Common';
    let text = `📈 *SCORE (REAL)*\n\nAgent #${agentInfo.agentId}\nScore: ${score}\nRank: #${rank}\nFeedback: ${feedback}\nTier: ${tier}\n\n`;
    text += `Common (0-44): $0.14/bln\nMaestro (45-79): $1.68/bln\nLegend (80+): $15/bln\n\n`;
    text += `[Check Score](https://8004classifier.pilou.work/) | [Profile](https://8004scan.io/agents/base/${agentInfo.agentId})`;
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) { bot.sendMessage(chatId, `❌ ${err.message}`); }
});

// /pools
bot.onText(/\/pools/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, 'typing');
  try {
    const e = await getRealEarnings(agentInfo.owner);
    let text = `🏊 *POOL STATUS (REAL)*\n\n${e.diagnosis}\n\n`;
    for (const p of e.pools) {
      text += `${p.hasUnits ? '🟢' : '🔴'} \`${p.poolId.slice(0, 14)}...\`\n`;
      text += `Units: ${p.myUnits}/${p.totalUnits} | Share: ${p.mySharePct}%\n`;
      text += `Pool flow/month: ${p.poolFlowMonth} SUP\n`;
      text += `Total distributed: ${p.totalDistributed} SUP\n`;
      text += `My received: ${p.totalReceived} SUP\n\n`;
    }
    if (e.pools.every(p => !p.hasUnits)) {
      text += `⚠️ Units=0 → score perlu naik agar dapat distribusi\n`;
    }
    text += `[Dashboard](https://app.superfluid.org/)`;
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) { bot.sendMessage(chatId, `❌ ${err.message}`); }
});

// /price
bot.onText(/\/price (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, 'typing');
  try {
    const p = await getCryptoPrice(match[1].trim());
    const emoji = parseFloat(p.change24h) >= 0 ? '📈' : '📉';
    bot.sendMessage(chatId, `${emoji} *${p.symbol}*\n$${p.price}\n24h: ${p.change24h}%`, { parse_mode: 'Markdown' });
  } catch (err) { bot.sendMessage(chatId, `❌ ${err.message}`); }
});

// /mineloot
bot.onText(/\/mineloot/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, 'typing');
  try {
    const d = await getMineLootRound();
    let text = `🎰 *MineLoot Round #${d.roundId}*\n\nPool: ${d.totalDeployed} ETH\nLootpot: ${d.lootpot} LOOT\nLeast crowded: ${d.leastCrowded.join(', ')}\n\n[Play](https://mineloot.app)`;
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) { bot.sendMessage(chatId, `❌ ${err.message}`); }
});

// /gas
bot.onText(/\/gas/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, 'typing');
  try {
    const res = await fetch('https://mainnet.base.org', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 })
    });
    const d = await res.json();
    const gwei = (parseInt(d.result, 16) / 1e9).toFixed(4);
    bot.sendMessage(chatId, `⛽ *Base Gas*\n${gwei} Gwei`, { parse_mode: 'Markdown' });
  } catch (err) { bot.sendMessage(chatId, `❌ ${err.message}`); }
});

// /ask
bot.onText(/\/ask (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, 'typing');
  try {
    const answer = await askLLM(match[1]);
    bot.sendMessage(chatId, answer, { parse_mode: 'Markdown' });
  } catch (err) { bot.sendMessage(chatId, `❌ ${err.message}`); }
});

// Free chat
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!conversations.has(userId)) conversations.set(userId, []);
  const history = conversations.get(userId);
  history.push({ role: 'user', content: msg.text });
  if (history.length > 20) history.splice(0, 2);

  await bot.sendChatAction(chatId, 'typing');
  try {
    const answer = await askLLM(msg.text, history.slice(0, -1));
    history.push({ role: 'assistant', content: answer });
    bot.sendMessage(chatId, answer, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) {
    console.error('LLM error:', err.message);
    bot.sendMessage(chatId, `❌ ${err.message}`);
  }
});

bot.on('polling_error', (err) => console.error('Polling error:', err.message));

process.on('SIGINT', () => { bot.stopPolling(); process.exit(0); });
process.on('SIGTERM', () => { bot.stopPolling(); process.exit(0); });
