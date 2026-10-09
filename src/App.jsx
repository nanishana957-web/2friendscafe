import React, { useEffect, useState } from 'react';
import './index.css';
import { initLogic } from './logic';
import htmlTemplate from './template.html?raw';
import Kiosk from './Kiosk';

function App() {
  const [ready, setReady] = useState(false);
  const isKiosk = new URLSearchParams(window.location.search).has('kiosk');

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && !isKiosk) {
      initLogic();
    }
  }, [ready, isKiosk]);

  if (isKiosk) {
    return <Kiosk />;
  }

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlTemplate }} />
  );
}

export default App;
