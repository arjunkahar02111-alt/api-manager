import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { apiRequest } from '../services/api';
import { Copy, Check, Loader2, Code2, Globe, Shield } from 'lucide-react';

interface ClientPackageModalProps {
  apiId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ClientPackageModal: React.FC<ClientPackageModalProps> = ({
  apiId,
  isOpen,
  onClose,
}) => {
  const [pkg, setPkg] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<'curl' | 'javascriptFetch' | 'pythonRequests' | 'nodejs' | 'phpCurl'>('curl');

  useEffect(() => {
    if (apiId && isOpen) {
      loadPackage(apiId);
    }
  }, [apiId, isOpen]);

  const loadPackage = async (id: string) => {
    setLoading(true);
    setPkg(null);
    try {
      const res = await apiRequest(`/api/v1/admin/apis/${id}/package`, {}, 'admin');
      if (res.success) {
        setPkg(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Client Distribution Package">
      <div className="space-y-6 font-mono text-xs">
        {loading ? (
          <div className="py-12 text-center text-[#A3A3A3]">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-white" />
            <span>Generating client delivery package...</span>
          </div>
        ) : pkg ? (
          <div className="space-y-5">
            {/* API Overview */}
            <div className="p-4 bg-[#0A0A0A] border border-[#262626] space-y-2">
              <div className="text-[10px] text-[#A3A3A3] uppercase">Personal Client Endpoint</div>
              <div className="flex items-center justify-between gap-3 bg-[#121212] p-3 border border-[#333333]">
                <code className="text-white font-bold text-xs truncate">{pkg.endpointUrl}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(pkg.endpointUrl, 'url')}
                  className="px-3 py-1 bg-white text-black hover:bg-[#EF4444] hover:text-white text-xs font-bold uppercase flex items-center gap-1"
                >
                  {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'url' ? 'COPIED' : 'COPY'}</span>
                </button>
              </div>
            </div>

            {/* Parameters Table */}
            <div>
              <div className="text-[11px] font-bold text-white uppercase tracking-wider mb-2">
                Accepted Client Parameters
              </div>
              <div className="border border-[#262626] overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[#0A0A0A] text-[#737373] border-b border-[#262626] uppercase">
                    <tr>
                      <th className="px-3 py-2">Parameter</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262626]">
                    <tr className="bg-[#0A0A0A]">
                      <td className="px-3 py-2 font-bold text-[#22C55E]">key / X-API-Key</td>
                      <td className="px-3 py-2 text-[#A3A3A3]">query / header</td>
                      <td className="px-3 py-2 text-cyan-400">string</td>
                      <td className="px-3 py-2 text-[#EF4444] font-bold">REQUIRED</td>
                    </tr>
                    {pkg.parameters?.map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#181818]">
                        <td className="px-3 py-2 font-bold text-white">{p.name}</td>
                        <td className="px-3 py-2 text-[#A3A3A3] uppercase">{p.in}</td>
                        <td className="px-3 py-2 text-cyan-400">{p.type}</td>
                        <td className="px-3 py-2">
                          {p.required ? (
                            <span className="text-[#EF4444] font-bold">YES</span>
                          ) : (
                            <span className="text-[#737373]">OPTIONAL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Code Snippets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                  Ready-to-Share Client Code Snippets
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
                  {pkg.sampleRequests?.[codeTab] || 'No snippet available.'}
                </pre>
                <button
                  type="button"
                  onClick={() => copyToClipboard(pkg.sampleRequests?.[codeTab], 'code')}
                  className="absolute right-3 top-3 px-2.5 py-1 bg-white text-black hover:bg-[#EF4444] hover:text-white text-[10px] font-bold uppercase flex items-center gap-1"
                >
                  {copiedKey === 'code' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'code' ? 'COPIED' : 'COPY SNIPPET'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#262626]">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-white text-black hover:bg-[#EF4444] hover:text-white font-bold uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-[#737373]">Could not load package.</div>
        )}
      </div>
    </Modal>
  );
};
