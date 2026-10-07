import React, { useEffect, useState } from 'react';
import './index.css';
import { initLogic } from './logic';
import htmlTemplate from './template.html?raw';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      initLogic();
    }
  }, [ready]);

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlTemplate }} />
  );
}

export default App;
