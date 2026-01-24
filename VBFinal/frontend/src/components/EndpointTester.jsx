import React, { useState } from 'react';
import ApiService from '../services/api';

const EndpointTester = () => {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  const endpoints = [
    { name: 'Complaints', method: 'getComplaints', description: 'Get all complaints' },
    { name: 'Institutions', method: 'getInstitutions', description: 'Get all institutions' },
    { name: 'Categories', method: 'getCategories', description: 'Get all categories' },
    { name: 'Resolver Levels', method: 'getResolverLevels', description: 'Get resolver levels' },
    { name: 'Category Resolvers', method: 'getCategoryResolvers', description: 'Get category resolvers' },
    { name: 'Users', method: 'getUsers', description: 'Get all users' },
  ];

  const testEndpoint = async (endpoint) => {
    setLoading(true);
    try {
      const result = await ApiService[endpoint.method]();
      setResults(prev => ({
        ...prev,
        [endpoint.name]: {
          status: 'success',
          data: result,
          error: null,
          timestamp: new Date().toLocaleTimeString()
        }
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [endpoint.name]: {
          status: 'error',
          data: null,
          error: error.message,
          timestamp: new Date().toLocaleTimeString()
        }
      }));
    }
    setLoading(false);
  };

  const testAllEndpoints = async () => {
    setLoading(true);
    for (const endpoint of endpoints) {
      await testEndpoint(endpoint);
    }
    setLoading(false);
  };

  const clearResults = () => {
    setResults({});
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">API Endpoint Tester</h2>
      
      <div className="mb-6 flex gap-4">
        <button
          onClick={testAllEndpoints}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test All Endpoints'}
        </button>
        <button
          onClick={clearResults}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Clear Results
        </button>
      </div>

      <div className="grid gap-4">
        {endpoints.map((endpoint) => (
          <div key={endpoint.name} className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="font-semibold text-lg">{endpoint.name}</h3>
                <p className="text-gray-600 text-sm">{endpoint.description}</p>
              </div>
              <button
                onClick={() => testEndpoint(endpoint)}
                disabled={loading}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
              >
                Test
              </button>
            </div>

            {results[endpoint.name] && (
              <div className="mt-3 p-3 bg-gray-50 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-block w-3 h-3 rounded-full ${
                    results[endpoint.name].status === 'success' ? 'bg-green-500' : 'bg-red-500'
                  }`}></span>
                  <span className="font-medium">
                    {results[endpoint.name].status === 'success' ? 'Success' : 'Error'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {results[endpoint.name].timestamp}
                  </span>
                </div>

                {results[endpoint.name].status === 'success' ? (
                  <div>
                    <p className="text-sm text-green-700 mb-2">
                      Response received: {Array.isArray(results[endpoint.name].data) 
                        ? `${results[endpoint.name].data.length} items` 
                        : 'Object'}
                    </p>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-blue-600">View Response</summary>
                      <pre className="mt-2 p-2 bg-white border rounded overflow-auto max-h-40">
                        {JSON.stringify(results[endpoint.name].data, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-red-700">
                      Error: {results[endpoint.name].error}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">Current API Configuration:</h3>
        <p className="text-sm text-gray-700">Base URL: {ApiService.constructor.name === 'ApiService' ? 'http://localhost:8000/api' : 'Unknown'}</p>
        <p className="text-sm text-gray-700">Authentication: {localStorage.getItem('token') ? 'Token present' : 'No token'}</p>
      </div>
    </div>
  );
};

export default EndpointTester;
