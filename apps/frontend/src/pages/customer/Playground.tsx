import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Play, Copy, Check, Terminal, Loader2, Code2, Eye, EyeOff, ShieldCheck, Server, AlertCircle } from 'lucide-react';

export const CustomerPlayground: React.FC = () => {
  const [apis, setApis] = useState<any[]>([]);
  const [selectedApi, setSelectedApi] = useState<any | null>(null);
  const [method, setMethod] = useState('GET');
  const [customPath, setCustomPath] = useState('');
  const [requestHeaders, setRequestHeaders] = useState('{\n  "Accept": "application/json"\n}');
  const [requestBody, setRequestBody] = useState('{\n  "query": "test"\n}');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [maskKeyInSnippets, setMaskKeyInSnippets] = useState(false);
  const [loading, setLoading] = useState(false);
  const [responseResult, setResponseResult] = useState<any | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'response' | 'headers' | 'curl' | 'js' | 'python'>('response');

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
    setMethod(api.allowedMethods?.[0] || 'GET');
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

      // Attach API key header if supplied
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
        statusText: res.statusText || (res.status === 200 ? 'OK' : 'Response Received'),
        latencyMs,
        headers: headerObj,
        data: bodyData,
      });
    } catch (err: any) {
      setResponseResult({
        status: 0,
        statusText: 'Client Network Error',
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
    let key = 'YOUR_API_KEY';
    if (apiKeyInput) {
      if (maskKeyInSnippets) {
        key = apiKeyInput.length > 12 
          ? `${apiKeyInput.slice(0, 8)}••••••••${apiKeyInput.slice(-4)}`
          : '••••••••••••••••';
      } else {
        key = apiKeyInput;
      }
    }

    return {
      curl: `curl -X ${method} "${targetUrl}" \\\n  -H "X-API-Key: ${key}"${
        method !== 'GET' ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${requestBody.replace(/\n/g, '')}'` : ''
      }`,
      js: `fetch("${targetUrl}", {\n  method: "${method}",\n  headers: {\n    "X-API-Key": "${key}",\n    "Content-Type": "application/json"\n  }${
        method !== 'GET' ? `,\n  body: JSON.stringify(${requestBody})` : ''
      }\n})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`,
      python: `import requests\n\nurl = "${targetUrl}"\nheaders = {\n    "X-API-Key": "${key}",\n    "Content-Type": "application/json"\n}\n\nresponse = requests.${method.toLowerCase()}(\n    url,\n    headers=headers${
        method !== 'GET' ? `,\n    json=${requestBody}` : ''
      }\n)\n\nprint(response.status_code)\nprint(response.json())`,
    };
  };

  const snippets = getSnippets();

  const getMethodBadgeClass = (m: string) => {
    switch (m.toUpperCase()) {
      case 'GET': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'POST': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'PUT': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'DELETE': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A1A4A] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#A020F0] rounded-none shadow-[0_0_8px_#A020F0]" />
            <h1 className="text-xl sm:text-2xl font-black text-[#F5F3FA] tracking-tight uppercase font-['Archivo_Black',sans-serif]">
              API Testing & Playground
            </h1>
          </div>
          <p className="text-xs text-[#A39BAD] mt-1 font-mono">
            Direct interactive gateway console to test live production endpoints at{' '}
            <span className="text-[#A020F0]">api.karviontechnologies.in</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#100D17] border border-[#2A1A4A] text-xs font-mono text-[#A39BAD]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>SSL / TLS 1.3 Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Endpoint Selection & Request Builder */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#100D17] border border-[#2A1A4A] p-5 space-y-5 shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-[#F5F3FA] uppercase tracking-wider font-mono">
                  Select Endpoint
                </label>
                <span className="text-[10px] text-[#A39BAD] font-mono">
                  {apis.length} Available
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {apis.map((api) => (
                  <button
                    key={api.id}
                    type="button"
                    onClick={() => selectApi(api)}
                    className={`w-full text-left p-3 border text-xs font-mono transition-colors ${
                      selectedApi?.id === api.id
                        ? 'bg-[#A020F0]/15 border-[#A020F0] text-[#F5F3FA]'
                        : 'bg-[#050508] border-[#2A1A4A] text-[#A39BAD] hover:border-[#A020F0]/50 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{api.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 border ${getMethodBadgeClass(api.allowedMethods?.[0] || 'GET')}`}>
                        {api.allowedMethods?.[0] || 'GET'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#A39BAD] mt-1 truncate">{api.gatewayPath}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* API Key Input with Visibility Masking */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#F5F3FA] uppercase tracking-wider font-mono">
                  X-API-Key (Credentials)
                </label>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="flex items-center gap-1 text-[11px] text-[#A020F0] hover:text-[#7B2FFF] font-mono"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showKey ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="Paste your assigned karvion_live_... key"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full bg-[#050508] border border-[#2A1A4A] px-3 py-2 text-xs text-[#F5F3FA] font-mono focus:outline-none focus:border-[#A020F0] transition-colors"
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px] text-[#A39BAD] font-mono">
                <span>Passes via X-API-Key header</span>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={maskKeyInSnippets}
                    onChange={(e) => setMaskKeyInSnippets(e.target.checked)}
                    className="accent-[#A020F0] w-3 h-3"
                  />
                  <span>Mask in snippets</span>
                </label>
              </div>
            </div>

            {/* HTTP Method and Path */}
            <div>
              <label className="block text-xs font-bold text-[#F5F3FA] uppercase tracking-wider font-mono mb-1.5">
                Method & Route
              </label>
              <div className="flex gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  aria-label="HTTP Method"
                  className="bg-[#050508] border border-[#2A1A4A] px-3 py-2 text-xs text-[#A020F0] font-mono font-bold focus:outline-none focus:border-[#A020F0]"
                >
                  {selectedApi?.allowedMethods?.map((m: string) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  )) || <option value="GET">GET</option>}
                </select>
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="/v1/vehicle2-n"
                  aria-label="Route Path"
                  className="flex-1 bg-[#050508] border border-[#2A1A4A] px-3 py-2 text-xs text-[#F5F3FA] font-mono focus:outline-none focus:border-[#A020F0]"
                />
              </div>
            </div>

            {/* Custom Headers */}
            <div>
              <label className="block text-xs font-bold text-[#F5F3FA] uppercase tracking-wider font-mono mb-1.5">
                Headers (JSON)
              </label>
              <textarea
                rows={2}
                value={requestHeaders}
                onChange={(e) => setRequestHeaders(e.target.value)}
                aria-label="Request Headers JSON"
                className="w-full bg-[#050508] border border-[#2A1A4A] p-2.5 text-xs text-[#F5F3FA] font-mono focus:outline-none focus:border-[#A020F0]"
              />
            </div>

            {/* JSON Request Body (for POST/PUT/PATCH) */}
            {method !== 'GET' && method !== 'HEAD' && (
              <div>
                <label className="block text-xs font-bold text-[#F5F3FA] uppercase tracking-wider font-mono mb-1.5">
                  Request Payload (JSON)
                </label>
                <textarea
                  rows={4}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  aria-label="Request Payload JSON"
                  className="w-full bg-[#050508] border border-[#2A1A4A] p-3 text-xs text-[#F5F3FA] font-mono focus:outline-none focus:border-[#A020F0]"
                />
              </div>
            )}

            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={loading}
              className="w-full bg-[#A020F0] hover:bg-[#7B2FFF] text-white font-bold py-3 text-xs uppercase tracking-wider font-mono transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(160,32,240,0.3)] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Transmitting...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Send Real Request</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Response Inspector & Code Snippets */}
        <div className="lg:col-span-7 bg-[#100D17] border border-[#2A1A4A] p-5 flex flex-col shadow-xl">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#2A1A4A] pb-3 mb-4">
            <button
              onClick={() => setActiveTab('response')}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors border ${
                activeTab === 'response'
                  ? 'bg-[#A020F0]/20 border-[#A020F0] text-[#F5F3FA]'
                  : 'border-transparent text-[#A39BAD] hover:text-white'
              }`}
            >
              Response Body
            </button>
            <button
              onClick={() => setActiveTab('headers')}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors border ${
                activeTab === 'headers'
                  ? 'bg-[#A020F0]/20 border-[#A020F0] text-[#F5F3FA]'
                  : 'border-transparent text-[#A39BAD] hover:text-white'
              }`}
            >
              Headers {responseResult?.headers ? `(${Object.keys(responseResult.headers).length})` : ''}
            </button>
            <button
              onClick={() => setActiveTab('curl')}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors border ${
                activeTab === 'curl'
                  ? 'bg-[#A020F0]/20 border-[#A020F0] text-[#F5F3FA]'
                  : 'border-transparent text-[#A39BAD] hover:text-white'
              }`}
            >
              cURL
            </button>
            <button
              onClick={() => setActiveTab('js')}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors border ${
                activeTab === 'js'
                  ? 'bg-[#A020F0]/20 border-[#A020F0] text-[#F5F3FA]'
                  : 'border-transparent text-[#A39BAD] hover:text-white'
              }`}
            >
              JavaScript
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors border ${
                activeTab === 'python'
                  ? 'bg-[#A020F0]/20 border-[#A020F0] text-[#F5F3FA]'
                  : 'border-transparent text-[#A39BAD] hover:text-white'
              }`}
            >
              Python
            </button>
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1 bg-[#050508] border border-[#2A1A4A] p-4 overflow-x-auto min-h-[380px] flex flex-col">
            {activeTab === 'response' && (
              responseResult ? (
                <div className="space-y-4">
                  {/* Status & Latency Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#2A1A4A] text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold px-2 py-0.5 border ${
                          responseResult.status >= 200 && responseResult.status < 300
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        }`}
                      >
                        HTTP {responseResult.status} {responseResult.statusText}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[#A39BAD]">
                      <span>Latency: <strong className="text-[#F5F3FA]">{responseResult.latencyMs} ms</strong></span>
                      {responseResult.headers?.['content-type'] && (
                        <span className="hidden sm:inline">Type: {responseResult.headers['content-type'].split(';')[0]}</span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <pre className="text-xs font-mono text-purple-200 whitespace-pre-wrap overflow-x-auto max-h-[500px]">
                    {typeof responseResult.data === 'object'
                      ? JSON.stringify(responseResult.data, null, 2)
                      : responseResult.data || responseResult.error}
                  </pre>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-[#A39BAD] text-xs font-mono py-16 text-center">
                  <Terminal className="w-10 h-10 mb-3 text-[#A020F0]/40" />
                  <p className="font-bold text-[#F5F3FA]">Live Gateway Response Waiting</p>
                  <p className="mt-1 text-[11px] max-w-sm">
                    Configure your parameters and click &quot;Send Real Request&quot; to probe the production API Gateway.
                  </p>
                </div>
              )
            )}

            {activeTab === 'headers' && (
              responseResult?.headers ? (
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold text-[#A39BAD] uppercase tracking-wider pb-2 border-b border-[#2A1A4A]">
                    HTTP Response Headers ({Object.keys(responseResult.headers).length})
                  </div>
                  <div className="space-y-1 font-mono text-xs max-h-[500px] overflow-y-auto">
                    {Object.entries(responseResult.headers).map(([key, val]) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-center py-1 border-b border-[#2A1A4A]/40 gap-1 sm:gap-3">
                        <span className="text-[#A020F0] font-semibold sm:w-48 shrink-0">{key}:</span>
                        <span className="text-[#F5F3FA] break-all">{val as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-[#A39BAD] text-xs font-mono py-16 text-center">
                  <Server className="w-10 h-10 mb-3 text-[#A020F0]/40" />
                  <p className="font-bold text-[#F5F3FA]">No Headers Available</p>
                  <p className="mt-1 text-[11px]">Execute a request first to inspect response headers.</p>
                </div>
              )
            )}

            {(activeTab === 'curl' || activeTab === 'js' || activeTab === 'python') && (
              <div className="relative flex-1">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2A1A4A]">
                  <span className="text-[11px] font-mono text-[#A39BAD] uppercase">
                    Code Snippet &bull; {activeTab.toUpperCase()}
                  </span>
                  <button
                    onClick={() => copyCode(snippets[activeTab], activeTab)}
                    className="p-1.5 bg-[#100D17] border border-[#2A1A4A] text-[#F5F3FA] hover:border-[#A020F0] text-xs flex items-center gap-1.5 font-mono transition-colors"
                  >
                    {copiedSnippet === activeTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSnippet === activeTab ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="text-xs font-mono text-purple-200 whitespace-pre-wrap overflow-x-auto leading-relaxed">
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
