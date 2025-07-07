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
