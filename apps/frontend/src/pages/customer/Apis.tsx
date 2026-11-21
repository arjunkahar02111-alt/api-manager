import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Key, ExternalLink, Code } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CustomerApis: React.FC = () => {
  const [apis, setApis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApis();
  }, []);

  const fetchApis = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/customer/apis', {}, 'customer');
    if (res.success) setApis(res.data || []);
    setLoading(false);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My API Access</h1>
          <p className="text-xs text-gray-400 mt-1">Endpoints assigned to your account on api.karviontechnologies.in</p>
        </div>
        <Link
          to="/customer/playground"
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
        >
          <Code className="w-4 h-4" />
          Test in Playground
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <p className="text-xs font-mono text-gray-500 py-8 col-span-2 text-center">Loading assigned APIs...</p>
        ) : apis.length === 0 ? (
          <p className="text-xs font-mono text-gray-500 py-8 col-span-2 text-center">No APIs assigned to your account.</p>
        ) : (
          apis.map((api) => (
            <div
              key={api.id}
              className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl p-6 space-y-4 hover:border-cyan-500/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">{api.name}</h3>
                  <span className="text-[11px] font-mono text-gray-400">{api.category}</span>
                </div>
                <div className="flex gap-1">
                  {api.allowedMethods?.map((m: string) => (
                    <span key={m} className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-400">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-[#0B1020] border border-[#1E2D4A] rounded-xl font-mono text-xs text-cyan-300">
                https://api.karviontechnologies.in{api.gatewayPath}
              </div>

              <p className="text-xs text-gray-400">{api.description || 'Enterprise API endpoint'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
