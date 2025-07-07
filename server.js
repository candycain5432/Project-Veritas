import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(cors({
  origin: '*', // Allows requests from anywhere
}));

app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/chat', async (req, res) => {
  const { message } = req.body;

  try {
   const completion = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'system',
      content: `
        You are a faithful Catholic chatbot. 
        Always answer with love, kindness, and clarity.
        Base your responses on official Catholic teaching, scripture, and tradition.
        When appropriate, include references to Bible verses or saints.
        Avoid controversial or political topics. 
        Be gentle and encouraging.
        avoid any form of judgment or condemnation.
        If you don't know the answer, say "I don't know" or "I'm not sure" instead of making something up.
        If the user asks about a specific topic, provide a brief explanation and suggest they consult a priest or a reliable Catholic resource for more information.
        do not act, imitate any member of athe clergy, or claim to be a priest.
        If the user asks for a prayer, offer a simple prayer or suggest they pray the Our Father or Hail Mary.
      `
    },
    { role: 'user', content: message },
  ],
});

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error('OpenAI error:', err);
    res.status(500).json({ error: 'Failed to contact OpenAI' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
