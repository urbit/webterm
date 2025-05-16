import React, { useEffect, useState } from 'react';
import { useDark } from './lib/useDark';

export const SpinInfoBar = () => {
  const [spinStack, setSpinStack] = useState<string[]>([]);
  const dark = useDark();

  useEffect(() => {
    console.log('spin: setting up...');
    let available = false;
    const spin = new EventSource('/~_~/spin', { withCredentials: true });

    spin.onopen = () => {
      console.log('spin: opened stream');
      available = true;
    };

    spin.onmessage = (e) => {
      // The data is expected to be a path like /stack3/stack2/stack1/stack0
      // We need to parse it into an array of stack names
      if (e.data && typeof e.data === 'string') {
        // Remove leading slash if present and split by slash
        const stackPath = e.data.substring(1);
        const stackArray = stackPath.split('/');
        setSpinStack(stackArray);
      }
    };

    spin.onerror = (e) => {
      console.error('spin: eventsource error:', e);
    };

    return () => {
      spin.close();
    };
  }, []);

  if (spinStack.length === 0) {
    return null;
  }

  return (
    <div className="spin-info-bar" style={{
      backgroundColor: dark ? 'rgb(42, 42, 42)' : '#f0f0f0',
      color: dark ? 'rgba(255, 255, 255, 0.9)' : 'black',
      padding: '4px 10px',
      fontSize: '12px',
      fontFamily: 'monospace',
      borderBottom: `1px solid ${dark ? 'rgba(255, 255, 255, 0.2)' : '#ccc'}`,
      display: 'flex',
      alignItems: 'center',
      height: '24px',
    }}>
      <span style={{ marginRight: '5px', fontWeight: 'bold' }}>Spin Stack:</span>
      {spinStack.map((stack, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span style={{ margin: '0 5px' }}>&gt;</span>}
          <span style={{
            padding: '2px 6px',
            backgroundColor: dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            borderRadius: '3px',
          }}>
            {stack}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};
