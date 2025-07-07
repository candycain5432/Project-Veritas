const chatContainer = document.getElementById('response');
const input = document.getElementById('input');

// Append a message to the chat
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

// Send the message to the server
async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  appendMessage('user', message);
  input.value = '';

  // Typing indicator
  const thinkingDiv = document.createElement('div');
  thinkingDiv.classList.add('message');
  thinkingDiv.innerHTML = `<span class="bot-label">Bot is typing...</span>`;
  thinkingDiv.id = 'typing-indicator';
  chatContainer.appendChild(thinkingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try {
    const res = await fetch('https://project-veritas-backend.onrender.com/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    // Remove typing indicator
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();

    appendMessage('bot', data.reply || 'Error: No response');
  } catch (err) {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
    appendMessage('bot', 'Error contacting server.');
  }
}

// Enter key sends message
input.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
