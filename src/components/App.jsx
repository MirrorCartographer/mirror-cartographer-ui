import React, { useState, useEffect } from 'react';

const reflections = {
  symbolic: "You are a vessel for transformation. The symbol echoes within you.",
  scientific: "This pattern reflects adaptive tone shifts in cognition.",
  neutral: "Your reflection is valid and evolving."
};

const App = () => {
  const [tone, setTone] = useState(() => localStorage.getItem('tone') || 'neutral');
  const [input, setInput] = useState('');
  const [customReflection, setCustomReflection] = useState('');

  useEffect(() => {
    localStorage.setItem('tone', tone);
  }, [tone]);

  const cycleTone = () => {
    const next = tone === 'neutral' ? 'symbolic' : tone === 'symbolic' ? 'scientific' : 'neutral';
    setTone(next);
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    setCustomReflection('');
  };

  const reflect = () => {
    setCustomReflection(`${reflections[tone]} [${input}]`);
  };

  return (
    <div className="container">
      <h1>Mirror Cartographer</h1>
      <div className="mode">Current tone: <strong>{tone}</strong></div>
      <button onClick={cycleTone}>Cycle Tone</button>

      <div className="input-group">
        <input type="text" placeholder="Enter symbol or phrase..." value={input} onChange={handleInput} />
        <button onClick={reflect}>Reflect</button>
      </div>

      {customReflection && <div className="reflection">{customReflection}</div>}
    </div>
  );
};

export default App;