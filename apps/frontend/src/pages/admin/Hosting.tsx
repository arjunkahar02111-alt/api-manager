import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { DeploymentTimeline } from '../../components/DeploymentTimeline';
import {
  Server,
  Play,
  Square,
  RotateCw,
  Trash2,
  Terminal,
  Upload,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Globe,
  ExternalLink,
  Layers,
  X,
  FileCode,
} from 'lucide-react';

interface Deployment {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  runtime: 'nodejs' | 'python' | 'php';
  port: number;
  gatewayPath: string;
  entryPoint: string;
  envVars?: Record<string, string>;
  status: 'deploying' | 'running' | 'stopped' | 'failed' | 'deleted';
  pid?: number;
  memoryUsageMb?: number;
  cpuPercent?: number;
  uptimeSeconds?: number;
  restartCount?: number;
  lastStartedAt?: string;
  lastError?: string;
  createdAt: string;
}

export const AdminHosting: React.FC = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Deploy Modal
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployForm, setDeployForm] = useState({
    name: '',
    slug: '',
    description: '',
    runtime: 'nodejs',
    port: '4000',
    gatewayPath: '',
    entryPoint: 'index.js',
    envVars: '{\n  "NODE_ENV": "production"\n}',
  });
  const [zipFile, setZipFile] = useState<File | null>(null);

  // Log Viewer Modal
  const [activeLogDeployment, setActiveLogDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState<{ stdout: string; stderr: string }>({ stdout: '', stderr: '' });
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    fetchDeployments();
    const interval = setInterval(fetchDeployments, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDeployments = async () => {
    try {
      const res = await apiRequest('/api/v1/admin/hosting', {}, 'admin');
      if (res.success && Array.isArray(res.data)) {
        setDeployments(res.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch hosting deployments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: string) => {
    setError(null);
    const res = await apiRequest(`/api/v1/admin/hosting/${id}/start`, { method: 'POST' }, 'admin');
    if (!res.success) {
      setError(res.error?.message || 'Failed to start micro-app');
    } else {
      setSuccessMsg('Micro-app started successfully');
      fetchDeployments();
    }
  };

  const handleStop = async (id: string) => {
    setError(null);
    const res = await apiRequest(`/api/v1/admin/hosting/${id}/stop`, { method: 'POST' }, 'admin');
    if (!res.success) {
      setError(res.error?.message || 'Failed to stop micro-app');
    } else {
      setSuccessMsg('Micro-app process stopped');
      fetchDeployments();
    }
  };

  const handleRestart = async (id: string) => {
    setError(null);
    const res = await apiRequest(`/api/v1/admin/hosting/${id}/restart`, { method: 'POST' }, 'admin');
    if (!res.success) {
      setError(res.error?.message || 'Failed to restart micro-app');
    } else {
      setSuccessMsg('Micro-app restarted successfully');
      fetchDeployments();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete deployment "${name}"?`)) return;
    setError(null);
    const res = await apiRequest(`/api/v1/admin/hosting/${id}`, { method: 'DELETE' }, 'admin');
    if (!res.success) {
      setError(res.error?.message || 'Failed to delete deployment');
    } else {
      setSuccessMsg(`Deployment "${name}" deleted`);
      fetchDeployments();
    }
  };

  const handleOpenLogs = async (dep: Deployment) => {
    setActiveLogDeployment(dep);
    setLoadingLogs(true);
    try {
      const res = await apiRequest(`/api/v1/admin/hosting/${dep._id}/logs`, {}, 'admin');
      if (res.success) {
        setLogs(res.data || { stdout: '', stderr: '' });
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleDeploySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeploying(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', deployForm.name);
      formData.append('slug', deployForm.slug.toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
      formData.append('description', deployForm.description);
      formData.append('runtime', deployForm.runtime);
      formData.append('port', deployForm.port);
      formData.append('entryPoint', deployForm.entryPoint);
      formData.append(
        'gatewayPath',
        deployForm.gatewayPath.startsWith('/') ? deployForm.gatewayPath : `/${deployForm.gatewayPath}`
      );
      formData.append('envVars', deployForm.envVars);

      if (zipFile) {
        formData.append('projectZip', zipFile);
      }

      const res = await apiRequest(
        '/api/v1/admin/hosting/deploy',
        {
          method: 'POST',
          body: formData,
        },
        'admin'
      );

      if (!res.success) {
        setError(res.error?.message || 'Failed to deploy application');
      } else {
        setSuccessMsg(`Micro-app "${deployForm.name}" deployed successfully!`);
        setIsDeployModalOpen(false);
        setDeployForm({
          name: '',
          slug: '',
          description: '',
          runtime: 'nodejs',
          port: '4000',
          gatewayPath: '',
          entryPoint: 'index.js',
          envVars: '{\n  "NODE_ENV": "production"\n}',
        });
        setZipFile(null);
        fetchDeployments();
      }
    } catch (err: any) {
      setError(err.message || 'Deployment error');
    } finally {
      setDeploying(false);
    }
  };

  const formatUptime = (secs?: number) => {
    if (!secs || secs <= 0) return '0s';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="p-8 space-y-8 bg-[#050508] min-h-screen text-[#F5F3FA] font-sans selection:bg-[#A020F0] selection:text-white">
      {/* Editorial Header */}
      <div className="border-b-2 border-[#1F1930] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#C77DFF] uppercase tracking-[0.16em] mb-1">
            <span className="w-2 h-2 bg-[#A020F0] shadow-[0_0_8px_#A020F0]" />
            Application Orchestration // Process Supervisor
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white font-mono">
            Micro-App Hosting & Deployment
          </h1>
          <p className="text-xs text-[#A39BAD] mt-1 font-mono uppercase tracking-wider">
            Host isolated Node.js, Express, Python (FastAPI/Flask), & PHP micro-services with gateway proxying
          </p>
        </div>

        <button
          onClick={() => setIsDeployModalOpen(true)}
          className="bg-[#A020F0] text-white hover:bg-[#7B2FFF] border-2 border-[#A020F0] hover:border-[#7B2FFF] px-5 py-3 font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors shrink-0 shadow-[0_0_15px_rgba(160,32,240,0.35)]"
        >
          <Plus className="w-4 h-4" />
          Deploy Micro-App
        </button>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="p-4 bg-[#260A0A] border-2 border-[#EF4444] flex items-center justify-between text-xs font-mono text-[#EF4444]">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-bold uppercase tracking-wider">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-[#0A2614] border-2 border-[#10B981] flex items-center justify-between text-xs font-mono text-[#10B981]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-bold uppercase tracking-wider">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Deployments Grid */}
      {loading ? (
        <div className="p-16 border-2 border-[#262626] bg-[#121212] flex flex-col items-center justify-center space-y-3 font-mono">
          <RotateCw className="w-6 h-6 animate-spin text-[#EF4444]" />
          <span className="text-xs uppercase tracking-wider text-[#737373]">
            Polling Micro-App Runtime Telemetry...
          </span>
        </div>
      ) : deployments.length === 0 ? (
        <div className="p-16 border-2 border-[#262626] bg-[#121212] text-center font-mono space-y-4">
          <Server className="w-12 h-12 text-[#525252] mx-auto" />
          <h2 className="text-base font-bold uppercase tracking-wider text-white">
            No Micro-Applications Deployed Yet
          </h2>
          <p className="text-xs text-[#737373] max-w-md mx-auto">
            Package your Node.js, Python, or PHP micro-service into a ZIP archive and deploy it here. It will run
            isolated and automatically mount to the API Gateway.
          </p>
          <button
            onClick={() => setIsDeployModalOpen(true)}
            className="bg-white text-[#0A0A0A] hover:bg-[#EF4444] hover:text-white border-2 border-white hover:border-[#EF4444] px-5 py-2.5 font-bold text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Deploy First Application
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deployments.map((dep) => {
            const isRunning = dep.status === 'running';
            const isStopped = dep.status === 'stopped';
            const isDeploying = dep.status === 'deploying';
            const isError = dep.status === 'failed';

            return (
              <div
                key={dep._id}
                className="bg-[#121212] border-2 border-[#262626] hover:border-[#525252] transition-colors flex flex-col justify-between"
              >
                {/* Card Top */}
                <div className="p-5 border-b-2 border-[#262626] space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isRunning
                              ? 'bg-[#10B981] animate-pulse'
                              : isDeploying
                              ? 'bg-[#F59E0B]'
                              : isError
                              ? 'bg-[#EF4444]'
                              : 'bg-[#525252]'
                          }`}
                        />
                        <h3 className="font-mono font-bold text-sm text-white uppercase tracking-wider">
                          {dep.name}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-[#737373] uppercase tracking-widest pl-4">
                        SLUG: {dep.slug}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border ${
                        dep.runtime === 'nodejs'
                          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20'
                          : dep.runtime === 'python'
                          ? 'border-blue-500/40 text-blue-400 bg-blue-950/20'
                          : 'border-purple-500/40 text-purple-400 bg-purple-950/20'
                      }`}
                    >
                      {dep.runtime}
                    </span>
                  </div>

                  {dep.description && (
                    <p className="text-xs text-[#A3A3A3] line-clamp-2">{dep.description}</p>
                  )}

                  {/* Gateway Proxy Route */}
                  <div className="bg-[#0A0A0A] p-2.5 border border-[#262626] font-mono text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#737373] uppercase">
                      <span>Gateway Route</span>
                      <span>Port {dep.port}</span>
                    </div>
                    <div className="text-[#38BDF8] truncate flex items-center gap-1.5 font-bold">
                      <Globe className="w-3.5 h-3.5 shrink-0 text-[#737373]" />
                      <span>{dep.gatewayPath}</span>
                    </div>
                  </div>
                </div>

                {/* Card Middle: Telemetry */}
                <div className="p-4 bg-[#0F0F0F] grid grid-cols-3 gap-2 border-b-2 border-[#262626] text-center font-mono">
                  <div>
                    <span className="text-[9px] text-[#737373] uppercase block">PID</span>
                    <span className="text-xs font-bold text-white">{dep.pid || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#737373] uppercase block">Memory</span>
                    <span className="text-xs font-bold text-white">
                      {dep.memoryUsageMb ? `${dep.memoryUsageMb} MB` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#737373] uppercase block">Uptime</span>
                    <span className="text-xs font-bold text-white">{formatUptime(dep.uptimeSeconds)}</span>
                  </div>
                </div>

                {/* Deployment Lifecycle Timeline */}
                <div className="p-2.5 bg-[#08060D] border-b-2 border-[#262626]">
                  <DeploymentTimeline
                    status={dep.status}
                    error={dep.lastError}
                    uptimeSeconds={dep.uptimeSeconds}
                  />
                </div>

                {/* Card Error if any */}
                {dep.lastError && (
                  <div className="p-3 bg-[#260A0A] border-b-2 border-[#EF4444] text-[11px] font-mono text-[#EF4444] truncate">
                    ERR: {dep.lastError}
                  </div>
                )}

                {/* Card Bottom: Action Toolbar */}
                <div className="p-3 bg-[#0A0A0A] flex items-center justify-between gap-1 font-mono">
                  <div className="flex items-center gap-1">
                    {isRunning ? (
                      <button
                        onClick={() => handleStop(dep._id)}
                        title="Stop Application"
                        className="p-2 border border-[#333333] hover:border-amber-500 hover:text-amber-400 text-[#A3A3A3] transition-colors"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStart(dep._id)}
                        title="Start Application"
                        className="p-2 border border-[#333333] hover:border-emerald-500 hover:text-emerald-400 text-[#A3A3A3] transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleRestart(dep._id)}
                      title="Restart Application"
                      className="p-2 border border-[#333333] hover:border-blue-500 hover:text-blue-400 text-[#A3A3A3] transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleOpenLogs(dep)}
                      title="View Live Logs"
                      className="p-2 border border-[#333333] hover:border-white hover:text-white text-[#A3A3A3] transition-colors flex items-center gap-1.5 text-xs px-2.5"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-bold">Logs</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleDelete(dep._id, dep.name)}
                    title="Delete Application"
                    className="p-2 border border-[#333333] hover:border-[#EF4444] hover:text-[#EF4444] text-[#737373] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deploy Modal */}
      {isDeployModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border-2 border-white w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 font-mono text-[#E5E7EB]">
            <div className="flex items-center justify-between border-b-2 border-[#262626] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#EF4444]" />
                <h2 className="text-lg font-black uppercase tracking-tight text-white">
                  Deploy New Micro-Application
                </h2>
              </div>
              <button
                onClick={() => setIsDeployModalOpen(false)}
                className="text-[#737373] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeploySubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white mb-1.5">
                    Application Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Payment Processor"
                    value={deployForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                      setDeployForm({
                        ...deployForm,
                        name,
                        slug: deployForm.slug ? deployForm.slug : slug,
                        gatewayPath: deployForm.gatewayPath ? deployForm.gatewayPath : `/v1/${slug}`,
                      });
                    }}
                    className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white mb-1.5">
                    Identifier Slug *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. payment-proc"
                    value={deployForm.slug}
                    onChange={(e) =>
                      setDeployForm({
                        ...deployForm,
                        slug: e.target.value,
                        gatewayPath: `/v1/${e.target.value}`,
                      })
                    }
                    className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white mb-1.5">
                    Runtime Language *
                  </label>
                  <select
                    value={deployForm.runtime}
                    onChange={(e) => {
                      const rt = e.target.value;
                      let ep = 'index.js';
                      if (rt === 'python') ep = 'main.py';
                      if (rt === 'php') ep = 'index.php';
                      setDeployForm({ ...deployForm, runtime: rt, entryPoint: ep });
                    }}
                    className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none p-2.5 text-xs text-white"
                  >
                    <option value="nodejs">Node.js 22 / Express</option>
                    <option value="python">Python / FastAPI / Flask</option>
                    <option value="php">PHP Micro-App</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white mb-1.5">
                    Internal Port *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="4000"
                    value={deployForm.port}
                    onChange={(e) => setDeployForm({ ...deployForm, port: e.target.value })}
                    className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white mb-1.5">
                    Entrypoint Script *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="index.js"
                    value={deployForm.entryPoint}
                    onChange={(e) => setDeployForm({ ...deployForm, entryPoint: e.target.value })}
                    className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white mb-1.5">
                  Gateway Mount Path *
                </label>
                <input
                  type="text"
                  required
                  placeholder="/v1/my-service"
                  value={deployForm.gatewayPath}
                  onChange={(e) => setDeployForm({ ...deployForm, gatewayPath: e.target.value })}
                  className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none p-2.5 text-xs text-white"
                />
                <span className="text-[10px] text-[#737373] mt-1 block">
                  All requests hitting this gateway path will proxy to http://localhost:{deployForm.port}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white mb-1.5">
                  Project Archive (.ZIP)
                </label>
                <div className="border-2 border-dashed border-[#333333] hover:border-white p-4 text-center cursor-pointer bg-[#0A0A0A]">
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-[#A3A3A3] file:mr-4 file:py-1 file:px-3 file:border-0 file:text-xs file:font-mono file:bg-white file:text-black cursor-pointer"
                  />
                </div>
                <span className="text-[10px] text-[#737373] mt-1 block">
                  Leave empty to deploy an empty starter template or upload your zipped application.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white mb-1.5">
                  Environment Variables (JSON)
                </label>
                <textarea
                  rows={4}
                  value={deployForm.envVars}
                  onChange={(e) => setDeployForm({ ...deployForm, envVars: e.target.value })}
                  className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none p-2.5 text-xs text-[#10B981] font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsDeployModalOpen(false)}
                  className="px-5 py-2.5 border-2 border-[#333333] hover:border-white text-xs font-bold uppercase transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deploying}
                  className="bg-white text-[#0A0A0A] hover:bg-[#EF4444] hover:text-white border-2 border-white hover:border-[#EF4444] px-6 py-2.5 font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deploying ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    'Deploy Application'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Viewer Modal */}
      {activeLogDeployment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border-2 border-white w-full max-w-4xl max-h-[85vh] flex flex-col font-mono text-[#E5E7EB]">
            <div className="p-4 border-b-2 border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#EF4444]" />
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                  Live Process Logs: {activeLogDeployment.name}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleOpenLogs(activeLogDeployment)}
                  className="text-xs text-[#A3A3A3] hover:text-white flex items-center gap-1 uppercase"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => setActiveLogDeployment(null)}
                  className="text-[#737373] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#0A0A0A]">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">
                  STDOUT (Standard Output):
                </span>
                <pre className="bg-[#141414] p-3 text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap border border-[#262626] min-h-[120px] max-h-[220px]">
                  {logs.stdout || '(No standard output yet)'}
                </pre>
              </div>

              <div>
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block mb-1">
                  STDERR (Standard Error / Trace):
                </span>
                <pre className="bg-[#141414] p-3 text-xs text-rose-300 font-mono overflow-x-auto whitespace-pre-wrap border border-[#262626] min-h-[120px] max-h-[220px]">
                  {logs.stderr || '(No error output reported)'}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t-2 border-[#262626] bg-[#0F0F0F] flex items-center justify-between text-[11px] text-[#737373]">
              <span>Mount: {activeLogDeployment.gatewayPath}</span>
              <span>Process Status: {activeLogDeployment.status.toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
