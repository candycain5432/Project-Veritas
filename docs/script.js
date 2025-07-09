const chatContainer = document.getElementById('response');
const input = document.getElementById('input');

// Append a message to the chat with styled bubbles
function appendMessage(role, text) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add(role === 'user' ? 'user-message' : 'bot-message');
  messageDiv.textContent = text;
  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Get or create sessionId and store in localStorage
function getSessionId() {
  let sessionId = localStorage.getItem('chatSessionId');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('chatSessionId', sessionId);
  }
  return sessionId;
}

// Send the message to the server
async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  appendMessage('user', message);
  input.value = '';

  // Show typing indicator
  const thinkingDiv = document.createElement('div');
  thinkingDiv.classList.add('bot-message');
  thinkingDiv.id = 'typing-indicator';
  thinkingDiv.textContent = 'Bot is typing...';
  chatContainer.appendChild(thinkingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try {
    const sessionId = getSessionId();

    const res = await fetch('https://project-veritas-backend.onrender.com/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId }),
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

// Allow pressing Enter to send message (Shift+Enter adds newline)
input.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Terms of Service Modal
window.addEventListener('DOMContentLoaded', () => {
  const accepted = localStorage.getItem('acceptedTerms');
  const modal = document.getElementById('termsModal');
  if (!accepted) {
    modal.style.display = 'flex';
  } else {
    modal.style.display = 'none';
  }
});

const timeSpan = document.createElement('div');
timeSpan.className = 'timestamp';
timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
messageDiv.appendChild(timeSpan);


function acceptTerms() {
  localStorage.setItem('acceptedTerms', 'true');
  document.getElementById('termsModal').style.display = 'none';
}

function showTerms() {
  document.getElementById('termsModal').style.display = 'flex';
}
