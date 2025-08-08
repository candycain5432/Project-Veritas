const chatContainer = document.getElementById('response');
const input = document.getElementById('input');

// Append a message to the chat with styled bubbles
function appendMessage(role, text) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add(role === 'user' ? 'user-message' : 'bot-message');

  if (role === 'user') {
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  } else {
    // For bot messages, append empty div for typing effect and return it
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageDiv;
  }
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

window.addEventListener('DOMContentLoaded', () => {
  const prompt = localStorage.getItem('initialPrompt');
  if (prompt) {
    localStorage.removeItem('initialPrompt');
    input.value = prompt;
    sendMessage();  // submit initial prompt if any
  }
});

// Typing effect function
function typeText(element, text, delay = 0.1, callback) {
  let i = 0;
  element.textContent = "";

  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      chatContainer.scrollTop = chatContainer.scrollHeight;  // keep scrolled down while typing
      setTimeout(type, delay);
    } else if (callback) {
      callback();
    }
  }

  type();
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
  thinkingDiv.textContent = 'Bot is Thinking...';
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

    // Append bot message with typing effect
const botDiv = appendMessage('bot');
typeText(botDiv, data.reply || 'Error: No response', 1);  // 5 ms delay per character

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

// Terms of Service Modal display on load
window.addEventListener('DOMContentLoaded', () => {
  const accepted = localStorage.getItem('acceptedTerms');
  const modal = document.getElementById('termsModal');
  if (!accepted) {
    modal.style.display = 'flex';
  } else {
    modal.style.display = 'none';
  }
});

// Accept terms function
function acceptTerms() {
  localStorage.setItem('acceptedTerms', 'true');
  document.getElementById('termsModal').style.display = 'none';
}

// Show terms modal function
function showTerms() {
  document.getElementById('termsModal').style.display = 'flex';
}
