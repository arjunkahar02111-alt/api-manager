import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import {
  Share2,
  Copy,
  Check,
  Download,
  Key,
  Layers,
  User,
  Shield,
  Clock,
  Terminal,
  FileText,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

export const AdminDistribution: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [apis, setApis] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'curl' | 'js' | 'python' | 'php'>('curl');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [custRes, apiRes] = await Promise.all([
        apiRequest('/api/v1/admin/customers', {}, 'admin'),
        apiRequest('/api/v1/admin/apis', {}, 'admin'),
      ]);

      if (custRes.success && custRes.data?.length > 0) {
        setCustomers(custRes.data);
        setSelectedCustomerId(custRes.data[0]._id || custRes.data[0].id);
      }

      if (apiRes.success && apiRes.data?.length > 0) {
        setApis(apiRes.data);
        setSelectedApiId(apiRes.data[0]._id || apiRes.data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectedCustomer = customers.find(
    (c) => (c._id || c.id) === selectedCustomerId
  );
  const selectedApi = apis.find((a) => (a._id || a.id) === selectedApiId);

  const baseUrl = 'https://api.karviontechnologies.in';
  const apiKey = selectedCustomer?.apiKey || 'arjun_live_your_assigned_api_key_here';
  const displayKey = showKey ? apiKey : `${apiKey.slice(0, 10)}••••••••••••••••••••••••••••`;
  const endpointPath = selectedApi?.gatewayPath || '/v1/vehicle2-n';
  const fullEndpointUrl = `${baseUrl}${endpointPath}`;

  const generateDeliveryMarkdown = () => {
    if (!selectedCustomer || !selectedApi) return '';

    return `# 🛡️ KARVION TECHNOLOGIES — OFFICIAL CLIENT API DELIVERY PACKAGE
**Document Classification:** Confidential &bull; Client Delivery
**Platform Base URL:** \`${baseUrl}\`
**Issued On:** ${new Date().toISOString().split('T')[0]}

---

## 1. CLIENT ACCOUNT & LICENSING
- **Licensed Entity / Client:** ${selectedCustomer.fullName || selectedCustomer.username}
- **Username / Identifier:** \`${selectedCustomer.username}\`
- **Assigned API Key:** \`${apiKey}\`
- **Authentication Method:** Header \`X-API-Key\` OR Query Parameter \`?key=\`
- **Account Status:** Active (Monitored)
- **License Expiration Date:** ${new Date(selectedCustomer.expiresAt || '2099-12-31').toLocaleDateString()}
- **Daily Quota Limit:** ${selectedCustomer.dailyRequestLimit?.toLocaleString() || '5,000'} Requests / Day
- **Concurrent Concurrency:** ${selectedCustomer.maxConcurrentRequests || 5} Simultaneous Requests
- **IP Restrictions:** ${selectedCustomer.allowedIps?.includes('*') ? 'All IPs Permitted' : selectedCustomer.allowedIps?.join(', ')}

---

## 2. API SPECIFICATIONS & ENDPOINTS
- **API Name:** ${selectedApi.name}
- **API Category:** ${selectedApi.category || 'General'}
- **API Version:** ${selectedApi.version || 'v1'}
- **Production Endpoint:** \`${fullEndpointUrl}\`
- **Supported HTTP Methods:** ${selectedApi.allowedMethods?.join(', ') || 'GET, POST'}
- **Content Type:** \`application/json\`

### Live Query Example:
\`\`\`http
GET ${fullEndpointUrl}?key=${apiKey}&query=YOUR_SEARCH_PARAM HTTP/1.1
Host: api.karviontechnologies.in
Accept: application/json
\`\`\`

---

## 3. READY-TO-USE CODE EXAMPLES

### cURL
\`\`\`bash
curl -X GET "${fullEndpointUrl}?query=DL01AB1234" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Accept: application/json"
\`\`\`

### Node.js (Fetch)
\`\`\`javascript
const response = await fetch("${fullEndpointUrl}?query=DL01AB1234", {
  method: "GET",
  headers: {
    "X-API-Key": "${apiKey}",
    "Accept": "application/json"
  }
});
const data = await response.json();
console.log(data);
\`\`\`

### Python (Requests)
\`\`\`python
import requests

url = "${fullEndpointUrl}"
headers = {
    "X-API-Key": "${apiKey}",
    "Accept": "application/json"
}
params = {
    "query": "DL01AB1234"
}

response = requests.get(url, headers=headers, params=params)
print(response.json())
\`\`\`

### PHP (cURL)
\`\`\`php
<?php
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "${fullEndpointUrl}?query=DL01AB1234");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-API-Key: ${apiKey}",
    "Accept: application/json"
]);
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>
\`\`\`

---

## 4. DYNAMIC ANNOUNCEMENT INTEGRATION
Every API response returned from \`api.karviontechnologies.in\` may include an optional \`announcement\` object when maintenance, updates, or notices are active:

\`\`\`json
{
  "success": true,
  "developer": "arjunkahar",
  "announcement": {
    "id": "ANN-1001",
    "active": true,
    "type": "maintenance",
    "severity": "warning",
    "title": "Scheduled Maintenance Notice",
    "message": "Upgrades scheduled at 10 PM. No downtime expected.",
    "acknowledgment_required": false
  },
  "data": { ... }
}
\`\`\`

---

## 5. TECHNICAL SUPPORT & INCIDENT ESCALATION
For assistance, quota adjustments, or inquiries, reach out to your designated account contact:
- **Support Portal:** \`https://api.karviontechnologies.in\`
- **Emergency Escalation:** Available 24/7 for Enterprise Tier
`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateDeliveryMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdownFile = () => {
    const md = generateDeliveryMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Karvion_API_Delivery_${selectedCustomer?.username || 'Client'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-mono select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A1A4A] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#A020F0] rounded-none shadow-[0_0_8px_#A020F0]" />
            <h1 className="text-xl sm:text-2xl font-black text-[#F5F3FA] tracking-tight uppercase font-['Archivo_Black',sans-serif]">
              API Sales & Client Delivery
            </h1>
          </div>
          <p className="text-xs text-[#A39BAD] mt-1">
            Generate, preview and export professional integration packages for direct delivery to clients
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="px-4 py-2.5 bg-[#100D17] border border-[#2A1A4A] hover:border-[#A020F0] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy Package (MD)'}</span>
          </button>
          <button
            onClick={downloadMarkdownFile}
            className="px-4 py-2.5 bg-[#A020F0] hover:bg-[#7B2FFF] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(160,32,240,0.3)] transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download .MD</span>
          </button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#100D17] border border-[#2A1A4A] p-4">
        <div>
          <label className="block text-xs font-bold text-[#F5F3FA] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#A020F0]" />
            <span>Select Target Client</span>
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-[#050508] border border-[#2A1A4A] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A020F0]"
          >
            {customers.map((c) => (
              <option key={c._id || c.id} value={c._id || c.id}>
                {c.fullName || c.username} ({c.username}) &bull; {c.status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#F5F3FA] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#A020F0]" />
            <span>Select API Endpoint</span>
          </label>
          <select
            value={selectedApiId}
            onChange={(e) => setSelectedApiId(e.target.value)}
            className="w-full bg-[#050508] border border-[#2A1A4A] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A020F0]"
          >
            {apis.map((a) => (
              <option key={a._id || a.id} value={a._id || a.id}>
                {a.name} ({a.gatewayPath})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Package Summary Card */}
      {selectedCustomer && selectedApi && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Metadata Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#100D17] border border-[#2A1A4A] p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#2A1A4A] pb-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#A020F0]" />
                  <span>Client Credentials</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase">Ready for Dispatch</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[#A39BAD] uppercase">Assigned API Key</span>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-[10px] text-[#A020F0] hover:text-[#7B2FFF] flex items-center gap-1"
                  >
                    {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showKey ? 'Mask' : 'Reveal'}</span>
                  </button>
                </div>
                <div className="bg-[#050508] border border-[#2A1A4A] p-2 text-xs font-mono text-[#F5F3FA] break-all">
                  {displayKey}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#050508] border border-[#2A1A4A] p-2.5">
                  <span className="text-[10px] text-[#A39BAD] uppercase block">Daily Limit</span>
                  <strong className="text-white text-sm">
                    {selectedCustomer.dailyRequestLimit?.toLocaleString() || '5,000'}
                  </strong>
                </div>
                <div className="bg-[#050508] border border-[#2A1A4A] p-2.5">
                  <span className="text-[10px] text-[#A39BAD] uppercase block">Concurrency</span>
                  <strong className="text-white text-sm">
                    {selectedCustomer.maxConcurrentRequests || 5} reqs
                  </strong>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-[#A39BAD] uppercase block mb-1">Target Endpoint URL</span>
                <div className="bg-[#050508] border border-[#2A1A4A] p-2 text-xs text-[#A020F0] font-mono break-all font-bold">
                  {fullEndpointUrl}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-[#A39BAD] uppercase block mb-1">Expiration Invariant</span>
                <div className="text-xs text-[#F5F3FA] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{new Date(selectedCustomer.expiresAt || '2099-12-31').toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Preview Column */}
          <div className="lg:col-span-7 bg-[#100D17] border border-[#2A1A4A] p-5 flex flex-col shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A1A4A] pb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#A020F0]" />
                <span>Generated Integration Code Snippets</span>
              </span>
              <div className="flex gap-1">
                {(['curl', 'js', 'python', 'php'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`px-2.5 py-1 text-[11px] uppercase font-bold border ${
                      activeTab === t
                        ? 'bg-[#A020F0]/20 border-[#A020F0] text-white'
                        : 'border-transparent text-[#A39BAD] hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 bg-[#050508] border border-[#2A1A4A] p-4 text-xs font-mono text-purple-200 overflow-x-auto min-h-[300px]">
              {activeTab === 'curl' && (
                <pre className="whitespace-pre-wrap">{`curl -X GET "${fullEndpointUrl}?query=YOUR_QUERY" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Accept: application/json"`}</pre>
              )}
              {activeTab === 'js' && (
                <pre className="whitespace-pre-wrap">{`fetch("${fullEndpointUrl}?query=YOUR_QUERY", {
  method: "GET",
  headers: {
    "X-API-Key": "${apiKey}",
    "Accept": "application/json"
  }
})
  .then(res => res.json())
  .then(data => console.log(data));`}</pre>
              )}
              {activeTab === 'python' && (
                <pre className="whitespace-pre-wrap">{`import requests

url = "${fullEndpointUrl}"
headers = {
    "X-API-Key": "${apiKey}",
    "Accept": "application/json"
}
params = {"query": "YOUR_QUERY"}

response = requests.get(url, headers=headers, params=params)
print(response.json())`}</pre>
              )}
              {activeTab === 'php' && (
                <pre className="whitespace-pre-wrap">{`<?php
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "${fullEndpointUrl}?query=YOUR_QUERY");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-API-Key: ${apiKey}",
    "Accept: application/json"
]);
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`}</pre>
              )}
            </div>

            <div className="p-3 bg-[#050508] border border-[#2A1A4A] text-[11px] text-[#A39BAD] flex items-center justify-between">
              <span>Ready for dispatch via Telegram, WhatsApp, Email or Documentation</span>
              <span className="text-[#A020F0] font-bold">100% Admin Controlled</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
