import type { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../services/security.service.js';

export interface WafRule {
  id: string;
  name: string;
  type: 'SQLI' | 'XSS' | 'PATH_TRAVERSAL' | 'RCE' | 'PROTOCOL_ABUSE';
  pattern: RegExp;
  targets: ('url' | 'query' | 'body' | 'headers')[];
}

export const WAF_RULES: WafRule[] = [
  // 1. SQL Injection (SQLi)
  {
    id: 'WAF_SQLI_UNION',
    name: 'SQL Injection: UNION SELECT Probe',
    type: 'SQLI',
    pattern: /\bunion(\s+all)?\s+select\b/i,
    targets: ['url', 'query', 'body'],
  },
  {
    id: 'WAF_SQLI_INJECTION',
    name: 'SQL Injection: Statement Injection / DROP / EXEC',
    type: 'SQLI',
    pattern: /\b(select\s+.+\s+from|insert\s+into\s+.+|delete\s+from\s+.+|drop\s+table\b|update\s+.+\s+set\b|exec(\s|\+)+(s|x)p\w+)/i,
    targets: ['url', 'query', 'body'],
  },
  {
    id: 'WAF_SQLI_BLIND',
    name: 'SQL Injection: Time-Based / Benchmark Delay Injection',
    type: 'SQLI',
    pattern: /\b(waitfor\s+delay|sleep\(\s*\d+\s*\)|benchmark\(\s*\d+\s*,)/i,
    targets: ['url', 'query', 'body'],
  },
  {
    id: 'WAF_SQLI_LOGIC',
    name: 'SQL Injection: Tautology / Boolean Bypass',
    type: 'SQLI',
    pattern: /['"]\s*(or|and)\s+['"]?[\w\d]+['"]?\s*=\s*['"]?[\w\d]+['"]?(\s*--|\s*#|\s*\/\*)?/i,
    targets: ['url', 'query'],
  },

  // 2. Cross-Site Scripting (XSS)
  {
    id: 'WAF_XSS_SCRIPT',
    name: 'Cross-Site Scripting: SCRIPT Tag Injection',
    type: 'XSS',
    pattern: /<script[\s\S]*?>[\s\S]*?<\/script>/i,
    targets: ['url', 'query', 'body'],
  },
  {
    id: 'WAF_XSS_EVENT',
    name: 'Cross-Site Scripting: Inline Event Handler Injection',
    type: 'XSS',
    pattern: /<[^>]+(on(error|load|click|mouseover|focus|blur|change|submit)\s*=)/i,
    targets: ['url', 'query', 'body'],
  },
  {
    id: 'WAF_XSS_JAVASCRIPT_URI',
    name: 'Cross-Site Scripting: JavaScript Pseudo-Protocol URI',
    type: 'XSS',
    pattern: /javascript\s*:\s*[^\s]/i,
    targets: ['url', 'query', 'body'],
  },
  {
    id: 'WAF_XSS_ELEMENTS',
    name: 'Cross-Site Scripting: Dangerous SVG / Iframe / Object Injection',
    type: 'XSS',
    pattern: /<(iframe|embed|object|svg[\s\S]*?onload)[^>]*>/i,
    targets: ['url', 'query', 'body'],
  },

  // 3. Path & Directory Traversal
  {
    id: 'WAF_TRAVERSAL_DOTDOT',
    name: 'Directory Traversal: Dot-Dot-Slash Sequence',
    type: 'PATH_TRAVERSAL',
    pattern: /(?:\.\.[\/\\]|\%2e\%2e[\/\\]|\%2e\%2e\%2f|\.\.%2f|\.\.%5c)/i,
    targets: ['url', 'query', 'body'],
  },
  {
    id: 'WAF_TRAVERSAL_SENSITIVE_FILES',
    name: 'Directory Traversal: System Sensitive File Access Probe',
    type: 'PATH_TRAVERSAL',
    pattern: /(?:etc[\/\\](?:passwd|shadow|hosts)|(?:boot|win)\.ini|system32)/i,
    targets: ['url', 'query', 'body'],
  },

  // 4. Remote Code Execution (RCE) & Command Injection
  {
    id: 'WAF_RCE_CMD_CHAIN',
    name: 'Command Injection: Shell Command Chaining Operator',
    type: 'RCE',
    pattern: /(?:(?:;|\||`|\$\()\s*(?:cat|whoami|uname|curl|wget|nc|sh|bash|powershell|cmd\.exe)\b)/i,
    targets: ['url', 'query', 'body'],
  },
  {
    id: 'WAF_RCE_EVAL',
    name: 'Remote Code Execution: PHP / Node Eval Function Call',
    type: 'RCE',
    pattern: /\b(eval\s*\(|system\s*\(|passthru\s*\(|shell_exec\s*\()/i,
    targets: ['url', 'query', 'body'],
  },

  // 5. Automated Vulnerability Scanners & Reconnaissance
  {
    id: 'WAF_SCANNER_UA',
    name: 'Automated Vulnerability Scanner User-Agent',
    type: 'PROTOCOL_ABUSE',
    pattern: /\b(sqlmap|nikto|acunetix|wpscan|masscan|zgrab|nmap|havij|netsparker|dirbuster)\b/i,
    targets: ['headers'],
  },
  {
    id: 'WAF_COMMON_EXPLOIT_PATHS',
    name: 'Probe of Common Attack Surfaces / Backdoors',
    type: 'PROTOCOL_ABUSE',
    pattern: /\b(wp-login\.php|phpmyadmin|\.env$|\.git\/(?:config|HEAD)|setup\.cgi|\.aws\/credentials)\b/i,
    targets: ['url'],
  },
];

/**
 * Recursively scans an object, array, or primitive for pattern matches.
 * Returns the first matched value and snippet if found.
 */
function scanValue(val: unknown, pattern: RegExp, skipKeys: string[] = []): string | null {
  if (val === null || val === undefined) return null;

  if (typeof val === 'string') {
    if (pattern.test(val)) {
      return val.substring(0, 100);
    }
    return null;
  }

  if (Array.isArray(val)) {
    for (const item of val) {
      const match = scanValue(item, pattern, skipKeys);
      if (match) return match;
    }
    return null;
  }

  if (typeof val === 'object') {
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (skipKeys.includes(k.toLowerCase())) continue;
      const match = scanValue(v, pattern, skipKeys);
      if (match) return match;
    }
  }

  return null;
}

/**
 * Enterprise Web Application Firewall (WAF) Middleware.
 * Defends against SQLi, XSS, Path Traversal, RCE, and reconnaissance attacks
 * while maintaining scoped exceptions for legitimate API traffic.
 */
export function wafMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const urlPath = req.path || req.url || '';
  const userAgent = (req.headers['user-agent'] as string) || '';

  // Scoped Exceptions:
  // 1. Skip analyzing request body for legitimate Universal Importer sample payloads when authenticated
  const isImporterEndpoint = urlPath.startsWith('/api/v1/admin/apis/import');

  // Keys to skip inside JSON bodies (e.g. passwords containing special symbols)
  const skipBodyKeys = ['password', 'currentpassword', 'newpassword', 'totpcode', 'code'];

  for (const rule of WAF_RULES) {
    let triggeredTarget: string | null = null;
    let snippet: string | null = null;

    // A. Target: URL / Path
    if (rule.targets.includes('url')) {
      if (rule.pattern.test(urlPath)) {
        triggeredTarget = 'url';
        snippet = urlPath.substring(0, 80);
      }
    }

    // B. Target: Query String Parameters
    if (!triggeredTarget && rule.targets.includes('query') && req.query) {
      snippet = scanValue(req.query, rule.pattern);
      if (snippet) triggeredTarget = 'query';
    }

    // C. Target: Request Body (JSON or Form)
    if (!triggeredTarget && rule.targets.includes('body') && req.body && !isImporterEndpoint) {
      snippet = scanValue(req.body, rule.pattern, skipBodyKeys);
      if (snippet) triggeredTarget = 'body';
    }

    // D. Target: Headers (User-Agent, etc.)
    if (!triggeredTarget && rule.targets.includes('headers')) {
      if (rule.pattern.test(userAgent)) {
        triggeredTarget = 'headers:user-agent';
        snippet = userAgent.substring(0, 80);
      }
    }

    // If an attack pattern is detected, log security incident and halt request immediately
    if (triggeredTarget) {
      console.warn(
        `[WAF_BLOCKED] 🚨 ${rule.id} triggered from IP ${clientIp} on ${req.method} ${urlPath} (Target: ${triggeredTarget})`
      );

      // Async incident recording (non-blocking for fast defense)
      SecurityService.recordIncident({
        incidentType: 'WAF_RULE_TRIGGERED',
        severity: 'HIGH',
        sourceIp: clientIp,
        endpoint: urlPath,
        method: req.method,
        actionTaken: 'BLOCKED_BY_WAF',
        details: {
          ruleId: rule.id,
          ruleName: rule.name,
          threatType: rule.type,
          triggeredTarget,
          snippet,
          userAgent,
        },
      }).catch((err) => console.error('[WAF] Failed to log incident:', err));

      return res.status(403).json({
        success: false,
        error: {
          code: 'WAF_BLOCKED',
          message: `Request blocked by Web Application Firewall: Security threat detected (${rule.name})`,
          ruleId: rule.id,
          threatType: rule.type,
        },
        meta: {
          timestamp: new Date().toISOString(),
          clientIp,
        },
      });
    }
  }

  next();
}
