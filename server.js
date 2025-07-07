import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();

// Basic CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app.options('*', (req, res) => res.sendStatus(200));
app.use(express.json());

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sessions = {};     // In-memory context for each session
const chatLogs = {};     // In-memory full log per session (used for /chat-log route)

const SYSTEM_PROMPT = {
  role: 'system',
  content: `
    You are a faithful Catholic chatbot...
    (same long system prompt as before)
  `
};

// Save a line to session file
function appendToLogFile(sessionId, entry) {
  const filePath = path.join(logsDir, `${sessionId}.txt`);
  fs.appendFileSync(filePath, entry + '\n', 'utf8');
}

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: 'Message and sessionId are required.' });
  }

  // Init session if needed
  if (!sessions[sessionId]) {
    sessions[sessionId] = [SYSTEM_PROMPT];
  }
  if (!chatLogs[sessionId]) {
    chatLogs[sessionId] = [];
  }

  const timestamp = new Date().toISOString();
  sessions[sessionId].push({ role: 'user', content: message });
  chatLogs[sessionId].push({ role: 'user', content: message, timestamp });
  appendToLogFile(sessionId, `[${timestamp}] You: ${message}`);

  const context = [SYSTEM_PROMPT, ...sessions[sessionId].slice(-20)];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: context,
    });

    const reply = completion.choices[0].message.content;

    const botTimestamp = new Date().toISOString();
    sessions[sessionId].push({ role: 'assistant', content: reply });
    chatLogs[sessionId].push({ role: 'bot', content: reply, timestamp: botTimestamp });
    appendToLogFile(sessionId, `[${botTimestamp}] Bot: ${reply}`);

    res.json({ reply });
  } catch (err) {
    console.error('OpenAI error:', err);
    res.status(500).json({ error: 'Failed to contact OpenAI' });
  }
});

// View chat log (in-memory version)
app.get('/chat-log/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  res.json(chatLogs[sessionId] || []);
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
