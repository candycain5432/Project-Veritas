import { useState } from 'react';
import axios from 'axios';

function ChatBox() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    const userMsg = { sender: 'user', text: input };
    setMessages([...messages, userMsg]);
    const res = await axios.post('http://localhost:5000/api/chat', { message: input });
    const botMsg = { sender: 'bot', text: res.data.reply };
    setMessages((prev) => [...prev, botMsg]);
    setInput('');
  };

  return (
    <div className="mt-6">
      <div className="border rounded p-4 h-64 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={msg.sender === 'user' ? 'text-right' : 'text-left'}>
            <p><strong>{msg.sender === 'user' ? 'You' : 'Veritas'}:</strong> {msg.text}</p>
          </div>
        ))}
      </div>
      <div className="flex mt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-grow border rounded p-2"
        />
        <button onClick={sendMessage} className="ml-2 px-4 py-2 bg-blue-600 text-white rounded">
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatBox;
