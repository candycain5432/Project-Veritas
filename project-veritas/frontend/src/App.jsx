import ChatBox from './components/ChatBox';
import DailyFeed from './components/DailyFeed';

function App() {
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-4">✝️ Project Veritas</h1>
      <DailyFeed />
      <ChatBox />
    </div>
  );
}

export default App;
