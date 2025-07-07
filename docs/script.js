const chatHistory = [];

async function sendMessage() {
  const inputEl = document.getElementById('input');
  const output = document.getElementById('response');
  const message = inputEl.value.trim();
  if (!message) return;

  chatHistory.push(`You: ${message}`);
  updateChat();

  chatHistory.push('Thinking...');
  updateChat();

  try {
    const res = await fetch('https://project-veritas-backend.onrender.com/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();
    chatHistory.pop(); // remove "Thinking..."
    chatHistory.push(`Bot: ${data.reply || 'Error: No reply'}`);
    updateChat();
    inputEl.value = '';
    output.scrollTop = output.scrollHeight;
  } catch (err) {
    chatHistory.pop();
    chatHistory.push('Error contacting server.');
    updateChat();
  }
}

function updateChat() {
  document.getElementById('response').textContent = chatHistory.join('\n\n');
}

const chatContainer = document.getElementById('response');
const input = document.getElementById('input');

function appendMessage(role, text) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');

  const labelSpan = document.createElement('span');
  labelSpan.textContent = role === 'user' ? 'You: ' : 'Bot: ';
  labelSpan.classList.add(role === 'user' ? 'user-label' : 'bot-label');

  const contentSpan = document.createElement('span');
  contentSpan.textContent = text;

  messageDiv.appendChild(labelSpan);
  messageDiv.appendChild(contentSpan);

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  appendMessage('user', message);
  input.value = '';

  appendMessage('bot', 'Thinking...');

  try {
    const res = await fetch('https://project-veritas-backend.onrender.com/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    // Remove last "Thinking..." message
    const lastMsg = chatContainer.lastChild;
    if (lastMsg && lastMsg.textContent === 'Bot: Thinking...') {
      chatContainer.removeChild(lastMsg);
    }

    appendMessage('bot', data.reply || 'Error: No response');

  } catch (err) {
    const lastMsg = chatContainer.lastChild;
    if (lastMsg && lastMsg.textContent === 'Bot: Thinking...') {
      chatContainer.removeChild(lastMsg);
    }
    appendMessage('bot', 'Error contacting server.');
  }
}
