import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Play, Copy, Check, Terminal, Loader2, Code2 } from 'lucide-react';

export const CustomerPlayground: React.FC = () => {
  const [apis, setApis] = useState<any[]>([]);
  const [selectedApi, setSelectedApi] = useState<any | null>(null);
  const [method, setMethod] = useState('GET');
  const [customPath, setCustomPath] = useState('');
  const [requestHeaders, setRequestHeaders] = useState('{\n  "Accept": "application/json"\n}');
  const [requestBody, setRequestBody] = useState('{\n  "query": "test"\n}');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseResult, setResponseResult] = useState<any | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'response' | 'curl' | 'js' | 'python'>('response');

  useEffect(() => {
    fetchApis();
  }, []);

  const fetchApis = async () => {
    const res = await apiRequest('/api/v1/customer/apis', {}, 'customer');
    if (res.success && res.data?.length > 0) {
      setApis(res.data);
      selectApi(res.data[0]);
    }
  };

  const selectApi = (api: any) => {
    setSelectedApi(api);
    setMethod(api.allowedMethods[0] || 'GET');
    setCustomPath(api.gatewayPath);
  };

  const handleExecute = async () => {
    setLoading(true);
    setResponseResult(null);
    setActiveTab('response');

    const start = Date.now();
    try {
      let parsedHeaders: Record<string, string> = {};
      try {
        parsedHeaders = JSON.parse(requestHeaders);
      } catch {
        // Fallback
      }

      // Attach API key header
      if (apiKeyInput.trim()) {
        parsedHeaders['X-API-Key'] = apiKeyInput.trim();
      }

      const options: RequestInit = {
        method,
        headers: parsedHeaders,
      };

      if (method !== 'GET' && method !== 'HEAD' && requestBody.trim()) {
        options.body = requestBody;
        if (!parsedHeaders['Content-Type']) {
          parsedHeaders['Content-Type'] = 'application/json';
        }
      }

      const res = await fetch(customPath, options);
      const latencyMs = Date.now() - start;

      const headerObj: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        headerObj[key] = val;
      });

      const text = await res.text();
      let bodyData: any = text;
      try {
        bodyData = JSON.parse(text);
      } catch {}

      setResponseResult({
        status: res.status,
        statusText: res.statusText,
        latencyMs,
        headers: headerObj,
        data: bodyData,
      });
    } catch (err: any) {
      setResponseResult({
        status: 0,
        statusText: 'Client Error',
        latencyMs: Date.now() - start,
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(label);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const getSnippets = () => {
    const targetUrl = `https://api.karviontechnologies.in${customPath}`;
    const key = apiKeyInput || 'YOUR_API_KEY';

    return {
      curl: `curl -X ${method} "${targetUrl}" \\\n  -H "X-API-Key: ${key}"${
        method !== 'GET' ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${requestBody.replace(/\n/g, '')}'` : ''
      }`,
      js: `fetch("${targetUrl}", {\n  method: "${method}",\n  headers: {\n    "X-API-Key": "${key}",\n    "Content-Type": "application/json"\n  }${
        method !== 'GET' ? `,\n  body: JSON.stringify(${requestBody})` : ''
      }\n})\n  .then(res => res.json())\n  .then(data => console.log(data));`,
      python: `import requests\n\nheaders = {\n    "X-API-Key": "${key}",\n    "Content-Type": "application/json"\n}\n\nresponse = requests.${method.toLowerCase()}(\n    "${targetUrl}",\n    headers=headers${
        method !== 'GET' ? `,\n    json=${requestBody}` : ''
      }\n)\n\nprint(response.json())`,
    };
  };

  const snippets = getSnippets();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">API Documentation & Test Playground</h1>
        <p className="text-xs text-gray-400 mt-1">Live interactive console to verify real responses from the API Gateway</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* API Selector & Request Configurator */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Select Endpoint</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {apis.map((api) => (
                <div
                  key={api.id}
                  onClick={() => selectApi(api)}
                  className={`p-3 rounded-xl cursor-pointer border text-xs font-mono transition-colors ${
                    selectedApi?.id === api.id
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                      : 'bg-[#0B1020] border-[#1E2D4A] text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="font-semibold">{api.name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{api.gatewayPath}</div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">X-API-Key (Header)</label>
              <input
                type="password"
                placeholder="Paste your assigned karvion_live_... key"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-xs text-cyan-400 font-mono font-bold focus:outline-none"
              >
                {selectedApi?.allowedMethods?.map((m: string) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                className="flex-1 bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            {method !== 'GET' && method !== 'HEAD' && (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">JSON Request Body</label>
                <textarea
                  rows={4}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl p-3 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            )}

            <button
              onClick={handleExecute}
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              Send Real Request
            </button>
          </div>
        </div>

        {/* Live Playground Output & Code Generator */}
        <div className="lg:col-span-7 bg-[#111A2B] border border-[#1E2D4A] rounded-2xl p-5 flex flex-col">
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-[#1E2D4A] pb-3 mb-4">
            <button
              onClick={() => setActiveTab('response')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                activeTab === 'response' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              Live Response
            </button>
            <button
              onClick={() => setActiveTab('curl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                activeTab === 'curl' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              cURL
            </button>
            <button
              onClick={() => setActiveTab('js')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                activeTab === 'js' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              JavaScript
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                activeTab === 'python' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              Python
            </button>
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1 bg-[#0B1020] border border-[#1E2D4A] rounded-xl p-4 overflow-x-auto min-h-[350px]">
            {activeTab === 'response' ? (
              responseResult ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-xs font-mono pb-2 border-b border-[#1E2D4A]">
                    <span
                      className={`font-bold px-2 py-0.5 rounded ${
                        responseResult.status < 400
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      HTTP {responseResult.status} {responseResult.statusText}
                    </span>
                    <span className="text-gray-400">Latency: {responseResult.latencyMs} ms</span>
                  </div>

                  <pre className="text-xs font-mono text-cyan-300 whitespace-pre-wrap">
                    {typeof responseResult.data === 'object'
                      ? JSON.stringify(responseResult.data, null, 2)
                      : responseResult.data || responseResult.error}
                  </pre>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs font-mono py-16">
                  <Terminal className="w-8 h-8 mb-2 opacity-50" />
                  <span>Execute a request to view live Gateway response telemetry</span>
                </div>
              )
            ) : (
              <div className="relative">
                <button
                  onClick={() => copyCode(snippets[activeTab], activeTab)}
                  className="absolute right-0 top-0 p-1.5 bg-[#172338] text-gray-300 hover:text-white rounded-lg text-xs flex items-center gap-1 font-mono"
                >
                  {copiedSnippet === activeTab ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSnippet === activeTab ? 'Copied' : 'Copy'}
                </button>
                <pre className="text-xs font-mono text-cyan-300 whitespace-pre-wrap pr-16">
                  {snippets[activeTab]}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
