import React, { useState, useEffect } from 'react';

const ApiTest = () => {
  const [status, setStatus] = useState('Testing...');
  const [data, setData] = useState(null);

  useEffect(() => {
    testApi();
  }, []);

  const testApi = async () => {
    try {
      // Test basic connection
      const response = await fetch('http://localhost:8000/api/complaints', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setStatus('✅ API Connection Successful');
        setData(result);
      } else {
        setStatus(`❌ API Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      setStatus(`❌ Connection Error: ${error.message}`);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">API Connection Test</h3>
      <p className="mb-2">{status}</p>
      {data && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">Data received:</p>
          <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
      <button 
        onClick={testApi}
        className="mt-4 bg-primary text-white px-4 py-2 rounded hover:bg-blue-800"
      >
        Test Again
      </button>
    </div>
  );
};

export default ApiTest;
