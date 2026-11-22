import React, { useState } from 'react';
import { Modal } from './Modal';
import { apiRequest } from '../services/api';
import {
  Zap,
  Play,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Shield,
  Clock,
  Code2,
  Lock,
  Eye,
  EyeOff,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface UniversalApiImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UniversalApiImporterModal: React.FC<UniversalApiImporterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [inputTab, setInputTab] = useState<'curl' | 'openapi' | 'postman' | 'url'>('curl');
  const [rawInput, setRawInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Analyzed Configuration
  const [apiConfig, setApiConfig] = useState<any>(null);
  const [credentialValue, setCredentialValue] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Validation State
  const [validating, setValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<any>(null);

  // Publish State
  const [publishing, setPublishing] = useState(false);
  const [publishedResult, setPublishedResult] = useState<any>(null);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<'curl' | 'javascriptFetch' | 'pythonRequests' | 'nodejs' | 'phpCurl'>('curl');

  const getPlaceholder = () => {
    if (inputTab === 'curl') {
      return `curl -X GET "https://api.example.com/v1/search?query=tesla&api_key=SECRET_123" \\\n  -H "Accept: application/json"`;
    }
    if (inputTab === 'openapi') {
      return `{\n  "openapi": "3.0.0",\n  "info": { "title": "Weather API", "version": "1.0" },\n  "servers": [{ "url": "https://api.weather.com" }],\n  "paths": {\n    "/current": {\n      "get": {\n        "parameters": [{ "name": "city", "in": "query", "required": true }]\n      }\n    }\n  }\n}`;
    }
    if (inputTab === 'postman') {
      return `{\n  "info": { "name": "Postman Sample" },\n  "item": [{\n    "name": "Search",\n    "request": {\n      "method": "GET",\n      "url": "https://api.example.com/search?q=test"\n    }\n  }]\n}`;
    }
    return '';
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawInput.trim()) return;

    setAnalyzing(true);
    setAnalyzeError(null);

    try {
      const res = await apiRequest('/api/v1/admin/apis/import/analyze', {
        method: 'POST',
        body: JSON.stringify({
          rawInput: rawInput.trim(),
          inputType: inputTab,
        }),
      }, 'admin');

      if (!res.success) {
        setAnalyzeError(res.error?.message || 'Failed to analyze API structure.');
        setAnalyzing(false);
        return;
      }

      setApiConfig(res.data);
      if (res.data.authConfig?.type !== 'none') {
        // Pre-fill credential value if static found
        const secretMapping = res.data.parameterMappings?.find((m: any) => m.isProviderCredential);
        if (secretMapping && secretMapping.staticValue) {
          setCredentialValue(secretMapping.staticValue);
        }
      }
      setStep(2);
    } catch (err: any) {
      setAnalyzeError(err.message || 'Analysis error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRunValidation = async () => {
    if (!apiConfig) return;
    setValidating(true);
    setValidationReport(null);

    try {
      const payload = {
        name: apiConfig.name,
        upstreamBaseUrl: apiConfig.upstreamBaseUrl,
        upstreamPath: apiConfig.upstreamPath,
        method: apiConfig.method,
        authConfig: {
          ...apiConfig.authConfig,
          credentialValue: credentialValue.trim() || undefined,
        },
        parameterMappings: apiConfig.parameterMappings,
        requestBodyType: apiConfig.requestBodyType,
        sampleBody: apiConfig.sampleBody,
        sampleQueryParams: apiConfig.sampleQueryParams,
        sampleHeaders: apiConfig.sampleHeaders,
        timeoutMs: 15000,
      };

      const res = await apiRequest('/api/v1/admin/apis/import/validate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, 'admin');

      if (res.success) {
        setValidationReport(res.data);
      } else {
        setValidationReport({
          status: 'FAIL',
          tests: [{ name: 'Connectivity', status: 'FAIL', message: res.error?.message || 'Validation request failed' }],
        });
      }
    } catch (err: any) {
      setValidationReport({
        status: 'FAIL',
        tests: [{ name: 'Connectivity', status: 'FAIL', message: err.message }],
      });
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async () => {
    if (!apiConfig) return;
    setPublishing(true);

    try {
      const payload = {
        name: apiConfig.name,
        slug: apiConfig.slug,
        description: `Universal Automated Gateway for ${apiConfig.name}`,
        category: 'Imported APIs',
        version: 'v1',
        gatewayPath: apiConfig.gatewayPath,
        upstreamBaseUrl: apiConfig.upstreamBaseUrl,
        upstreamPath: apiConfig.upstreamPath,
        allowedMethods: [apiConfig.method],
        authConfig: {
          ...apiConfig.authConfig,
          credentialValue: credentialValue.trim() || undefined,
        },
        parameterDefinitions: apiConfig.parameterDefinitions || [],
        parameterMappings: apiConfig.parameterMappings || [],
        requestBodyType: apiConfig.requestBodyType || 'none',
        responseEnvelope: apiConfig.responseEnvelope || 'preserve',
        cachePolicy: apiConfig.cachePolicy || { enabled: true, ttlSeconds: 60 },
        timeoutMs: 30000,
        originalCurl: inputTab === 'curl' ? rawInput : undefined,
        sampleRequest: apiConfig.sampleBody,
        sampleResponse: validationReport?.sampleResponseSnippet,
      };

      const res = await apiRequest('/api/v1/admin/apis/import/publish', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, 'admin');

      if (!res.success) {
        alert(res.error?.message || 'Failed to publish API');
        setPublishing(false);
        return;
      }

      setPublishedResult(res.data);
      setStep(4);
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Publish error');
    } finally {
      setPublishing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(id);
    setTimeout(() => setCopiedTab(null), 2500);
  };

  const resetAll = () => {
    setStep(1);
    setRawInput('');
    setApiConfig(null);
    setCredentialValue('');
    setValidationReport(null);
    setPublishedResult(null);
    setAnalyzeError(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetAll();
        onClose();
      }}
      title="Universal Automated API Importer & Proxy Engine"
    >
      <div className="space-y-6 font-mono text-xs">
        {/* Step Indicator Header */}
        <div className="grid grid-cols-4 gap-2 border-b-2 border-[#262626] pb-4">
          <div
            className={`p-2 border text-center font-bold uppercase transition-colors ${
              step === 1 ? 'border-[#EF4444] bg-[#260A0A] text-[#EF4444]' : 'border-[#262626] text-[#737373]'
            }`}
          >
            1. Input & Analyze
          </div>
          <div
            className={`p-2 border text-center font-bold uppercase transition-colors ${
              step === 2 ? 'border-[#EF4444] bg-[#260A0A] text-[#EF4444]' : 'border-[#262626] text-[#737373]'
            }`}
          >
            2. Vault & Mappings
          </div>
          <div
            className={`p-2 border text-center font-bold uppercase transition-colors ${
              step === 3 ? 'border-[#EF4444] bg-[#260A0A] text-[#EF4444]' : 'border-[#262626] text-[#737373]'
            }`}
          >
            3. Pre-Flight Test
          </div>
          <div
            className={`p-2 border text-center font-bold uppercase transition-colors ${
              step === 4 ? 'border-[#22C55E] bg-[#052E16] text-[#22C55E]' : 'border-[#262626] text-[#737373]'
            }`}
          >
            4. Personal Client API
          </div>
        </div>

        {/* STEP 1: INPUT & ANALYZE */}
        {step === 1 && (
          <form onSubmit={handleAnalyze} className="space-y-5">
            <div className="flex gap-2 border-b border-[#262626] pb-3">
              {(['curl', 'url', 'openapi', 'postman'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInputTab(tab)}
                  className={`px-3 py-1.5 uppercase font-bold text-[11px] tracking-wider transition-colors ${
                    inputTab === tab
                      ? 'bg-white text-black'
                      : 'bg-[#121212] text-[#A3A3A3] border border-[#262626] hover:text-white'
                  }`}
                >
                  {tab === 'curl' && 'cURL Command'}
                  {tab === 'url' && 'Direct URL'}
                  {tab === 'openapi' && 'OpenAPI JSON'}
                  {tab === 'postman' && 'Postman JSON'}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-2">
                Paste Original Provider API Definition or Command:
              </label>
              <textarea
                required
                rows={7}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={getPlaceholder()}
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white p-3 font-mono text-xs text-white placeholder-[#525252] focus:outline-none rounded-none"
              />
            </div>

            {analyzeError && (
              <div className="p-3 bg-[#260A0A] border-2 border-[#EF4444] text-[#EF4444] font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{analyzeError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={analyzing || !rawInput.trim()}
                className="px-6 py-2.5 bg-white text-black hover:bg-[#EF4444] hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors disabled:opacity-40"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>ANALYZING ORIGINAL API...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>ANALYZE & EXTRACT PARAMETERS</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: REVIEW MAPPINGS & CREDENTIAL VAULT */}
        {step === 2 && apiConfig && (
          <div className="space-y-6">
            <div className="bg-[#0A0A0A] p-4 border border-[#262626] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#262626] pb-2">
                <div>
                  <span className="text-[10px] text-[#A3A3A3] uppercase">Detected Method & Target</span>
                  <div className="text-white font-bold flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#EF4444] text-white text-[10px]">
                      {apiConfig.method}
                    </span>
                    <span className="truncate max-w-md">{apiConfig.upstreamBaseUrl}{apiConfig.upstreamPath}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-[#A3A3A3] uppercase">Proposed Personal Slug</span>
                  <div className="text-white font-bold font-mono">/v1{apiConfig.gatewayPath}</div>
                </div>
              </div>

              {/* Editable Name & Slug */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] text-[#A3A3A3] uppercase mb-1">API Name</label>
                  <input
                    type="text"
                    value={apiConfig.name}
                    onChange={(e) => setApiConfig({ ...apiConfig, name: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333333] px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#A3A3A3] uppercase mb-1">Gateway Slug</label>
                  <input
                    type="text"
                    value={apiConfig.slug}
                    onChange={(e) =>
                      setApiConfig({
                        ...apiConfig,
                        slug: e.target.value.toLowerCase(),
                        gatewayPath: `/${e.target.value.toLowerCase()}`,
                      })
                    }
                    className="w-full bg-[#121212] border border-[#333333] px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Provider Credential Vault */}
            <div className="p-4 bg-[#121212] border-2 border-amber-600 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-500 font-bold uppercase tracking-wider text-xs">
                  <Lock className="w-4 h-4" />
                  <span>Backend Provider Credential Vault</span>
                </div>
                <span className="text-[10px] bg-amber-950 text-amber-400 border border-amber-700 px-2 py-0.5">
                  🔒 AES-256-GCM PROTECTED
                </span>
              </div>
              <p className="text-[11px] text-[#A3A3A3]">
                The original provider API key or secret token will be encrypted at rest and injected exclusively on outbound backend requests. Clients will never see this key.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-[10px] text-[#A3A3A3] uppercase mb-1">Credential Type</label>
                  <select
                    value={apiConfig.authConfig?.type || 'none'}
                    onChange={(e) =>
                      setApiConfig({
                        ...apiConfig,
                        authConfig: { ...apiConfig.authConfig, type: e.target.value },
                      })
                    }
                    className="w-full bg-[#0A0A0A] border border-[#333333] px-2.5 py-1.5 text-white"
                  >
                    <option value="none">No Provider Credential</option>
                    <option value="api_key_query">Query Parameter Key</option>
                    <option value="api_key_header">Header API Key</option>
                    <option value="bearer_token">Bearer Token Header</option>
                    <option value="basic_auth">Basic Auth Header</option>
                    <option value="custom_header">Custom Header</option>
                  </select>
                </div>
                <div className="sm:col-span-8">
                  <label className="block text-[10px] text-[#A3A3A3] uppercase mb-1">
                    Provider Secret Key Value
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={credentialValue}
                      onChange={(e) => setCredentialValue(e.target.value)}
                      placeholder="Enter provider API key (e.g. sk_live_...)"
                      className="w-full bg-[#0A0A0A] border border-[#333333] px-2.5 py-1.5 text-white pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2.5 top-2 text-[#737373] hover:text-white"
                    >
                      {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Parameter Definitions Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                  Client-Facing Parameter Matrix ({apiConfig.parameterDefinitions?.length || 0})
                </span>
                <span className="text-[10px] text-[#A3A3A3]">
                  All parameters will be mapped and forwarded to upstream automatically.
                </span>
              </div>
              <div className="border border-[#262626] overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[#0A0A0A] text-[#737373] border-b border-[#262626] uppercase">
                    <tr>
                      <th className="px-3 py-2">Client Param</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Required</th>
                      <th className="px-3 py-2">Sample Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262626]">
                    {apiConfig.parameterDefinitions?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-[#737373]">
                          No dynamic parameters detected (Parameter-free endpoint).
                        </td>
                      </tr>
                    ) : (
                      apiConfig.parameterDefinitions?.map((param: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#181818]">
                          <td className="px-3 py-2 font-bold text-white">{param.name}</td>
                          <td className="px-3 py-2 uppercase text-[#A3A3A3]">{param.in}</td>
                          <td className="px-3 py-2 text-cyan-400">{param.type}</td>
                          <td className="px-3 py-2">
                            {param.required ? (
                              <span className="text-[#EF4444] font-bold">YES</span>
                            ) : (
                              <span className="text-[#737373]">OPTIONAL</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[#A3A3A3] truncate max-w-xs">
                            {String(param.sampleValue ?? 'None')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cache Policy & Response Envelope Options */}
            <div className="grid grid-cols-2 gap-4 bg-[#0A0A0A] p-4 border border-[#262626]">
              <div>
                <label className="block text-[10px] text-[#A3A3A3] uppercase mb-1">
                  Response Envelope Format
                </label>
                <select
                  value={apiConfig.responseEnvelope || 'preserve'}
                  onChange={(e) => setApiConfig({ ...apiConfig, responseEnvelope: e.target.value })}
                  className="w-full bg-[#121212] border border-[#333333] px-2.5 py-1.5 text-white"
                >
                  <option value="preserve">Preserve Original Response (Exact Match)</option>
                  <option value="wrap">Wrap in Karvion JSON Envelope</option>
                </select>
                <p className="text-[10px] text-[#737373] mt-1">
                  Preserve keeps upstream response keys 100% untouched. Metadata is placed in HTTP response headers.
                </p>
              </div>

              <div>
                <label className="block text-[10px] text-[#A3A3A3] uppercase mb-1">
                  Response Caching Policy
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-white">
                    <input
                      type="checkbox"
                      checked={apiConfig.cachePolicy?.enabled}
                      onChange={(e) =>
                        setApiConfig({
                          ...apiConfig,
                          cachePolicy: { ...apiConfig.cachePolicy, enabled: e.target.checked },
                        })
                      }
                    />
                    <span>Enable Cache</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[#737373]">TTL:</span>
                    <input
                      type="number"
                      value={apiConfig.cachePolicy?.ttlSeconds || 60}
                      onChange={(e) =>
                        setApiConfig({
                          ...apiConfig,
                          cachePolicy: {
                            ...apiConfig.cachePolicy,
                            ttlSeconds: Number(e.target.value),
                          },
                        })
                      }
                      className="w-16 bg-[#121212] border border-[#333333] px-2 py-1 text-white text-center"
                    />
                    <span className="text-[#737373]">sec</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2 border-t border-[#262626]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-[#333333] text-[#A3A3A3] hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(3);
                  handleRunValidation();
                }}
                className="px-6 py-2 bg-white text-black hover:bg-[#EF4444] hover:text-white font-bold uppercase tracking-wider flex items-center gap-2"
              >
                <span>PROCEED TO PRE-FLIGHT TEST</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PRE-FLIGHT TEST & VALIDATION */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="border border-[#262626] p-4 bg-[#0A0A0A] space-y-4">
              <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white uppercase">Automated Pre-Flight Verification</span>
                  {validating && <Loader2 className="w-4 h-4 animate-spin text-[#EF4444]" />}
                </div>
                <button
                  type="button"
                  onClick={handleRunValidation}
                  disabled={validating}
                  className="px-3 py-1 bg-[#121212] border border-white hover:bg-white hover:text-black text-white text-[11px] font-bold uppercase flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3" />
                  <span>Re-Run Test</span>
                </button>
              </div>

              {validationReport ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    {validationReport.tests?.map((t: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-2.5 border flex items-center justify-between ${
                          t.status === 'PASS'
                            ? 'bg-[#052E16] border-[#16A34A] text-white'
                            : t.status === 'WARNING'
                            ? 'bg-[#2D1D03] border-amber-500 text-amber-200'
                            : 'bg-[#260A0A] border-[#EF4444] text-[#EF4444]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {t.status === 'PASS' ? (
                            <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                          ) : (
                            <AlertCircle className="w-4 h-4" />
                          )}
                          <span className="font-bold">{t.name}:</span>
                          <span className="opacity-90">{t.message}</span>
                        </div>
                        <span className="font-bold text-[10px] uppercase border px-1.5 py-0.5 border-current">
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  {validationReport.sampleResponseSnippet && (
                    <div className="mt-4">
                      <span className="block text-[10px] text-[#A3A3A3] uppercase mb-1">
                        Live Response Preview Snippet:
                      </span>
                      <pre className="bg-[#121212] border border-[#262626] p-3 text-[11px] text-[#22C55E] overflow-x-auto max-h-48">
                        {validationReport.sampleResponseSnippet}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-[#737373]">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#EF4444]" />
                  <span>Executing provider connectivity and security verification...</span>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2 border-t border-[#262626]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-[#333333] text-[#A3A3A3] hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing || validationReport?.status === 'BLOCKED'}
                className="px-6 py-2.5 bg-[#EF4444] text-white hover:bg-[#DC2626] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-40"
              >
                {publishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>PUBLISHING TO GATEWAY...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>PUBLISH PERSONAL API</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: PUBLISHED & PERSONAL CLIENT API PACKAGE */}
        {step === 4 && publishedResult && (
          <div className="space-y-5">
            <div className="p-4 bg-[#052E16] border-2 border-[#16A34A] space-y-2">
              <div className="flex items-center gap-2 text-[#22C55E] font-bold uppercase tracking-wider text-xs">
                <CheckCircle className="w-4 h-4" />
                <span>PERSONAL API ENDPOINT GENERATED SUCCESSFULLY</span>
              </div>
              <p className="text-[11px] text-white opacity-90">
                Your new personal endpoint is fully active on the Karvion API Gateway with automated parameter mapping, backend secret injection, and response caching.
              </p>
            </div>

            <div className="bg-[#0A0A0A] p-4 border border-[#262626] space-y-3">
              <div className="text-[10px] text-[#A3A3A3] uppercase">Personal Gateway Endpoint URL</div>
              <div className="flex items-center justify-between gap-3 bg-[#121212] p-3 border border-[#333333]">
                <code className="text-white font-bold text-xs truncate">
                  {publishedResult.clientPackage?.endpointUrl}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(publishedResult.clientPackage?.endpointUrl, 'endpoint_url')
                  }
                  className="px-3 py-1.5 bg-white text-black hover:bg-[#EF4444] hover:text-white text-xs font-bold uppercase flex items-center gap-1"
                >
                  {copiedTab === 'endpoint_url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTab === 'endpoint_url' ? 'COPIED' : 'COPY URL'}</span>
                </button>
              </div>
            </div>

            {/* Code Generators */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                  Client Integration Code Snippet
                </span>
                <div className="flex gap-1">
                  {(['curl', 'javascriptFetch', 'pythonRequests', 'nodejs', 'phpCurl'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setCodeTab(tab)}
                      className={`px-2 py-1 uppercase text-[10px] font-bold ${
                        codeTab === tab ? 'bg-white text-black' : 'bg-[#121212] text-[#A3A3A3] border border-[#262626]'
                      }`}
                    >
                      {tab === 'curl' && 'cURL'}
                      {tab === 'javascriptFetch' && 'JS Fetch'}
                      {tab === 'pythonRequests' && 'Python'}
                      {tab === 'nodejs' && 'Node.js'}
                      {tab === 'phpCurl' && 'PHP'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <pre className="bg-[#0A0A0A] border border-[#333333] p-4 text-[11px] text-white overflow-x-auto max-h-56">
                  {publishedResult.clientPackage?.sampleRequests?.[codeTab] || 'Code snippet generated.'}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      publishedResult.clientPackage?.sampleRequests?.[codeTab],
                      'code_snippet'
                    )
                  }
                  className="absolute right-3 top-3 px-2.5 py-1 bg-white text-black hover:bg-[#EF4444] hover:text-white text-[10px] font-bold uppercase flex items-center gap-1"
                >
                  {copiedTab === 'code_snippet' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedTab === 'code_snippet' ? 'COPIED' : 'COPY CODE'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#262626]">
              <button
                type="button"
                onClick={() => {
                  resetAll();
                  onClose();
                }}
                className="px-6 py-2.5 bg-white text-black hover:bg-[#22C55E] hover:text-white font-bold uppercase tracking-wider"
              >
                DONE & CLOSE
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
