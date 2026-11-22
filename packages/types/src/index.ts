/**
 * ARJUN API MANAGER — Enterprise Shared Type Definitions
 */

export type Role = 'super_admin' | 'admin';

export type CustomerStatus = 'active' | 'suspended' | 'expired' | 'deleted';

export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export type ApiCatalogStatus = 'active' | 'disabled' | 'maintenance';

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled';

export type PaymentStatus = 'pending' | 'verified' | 'rejected' | 'refunded';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed';

export type WebhookStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

export type MaintenanceScope = 'global' | 'gateway' | 'customer_dashboard' | 'api';

export type WebhookEventType =
  | 'account.expiring_soon'
  | 'account.expired'
  | 'quota.daily_warning'
  | 'quota.daily_exceeded'
  | 'quota.monthly_warning'
  | 'quota.monthly_exceeded'
  | 'quota.lifetime_warning'
  | 'quota.lifetime_exceeded'
  | 'api.availability_change'
  | 'subscription.updated'
  | 'subscription.renewed'
  | 'account.suspended'
  | 'account.reactivated';

export interface IAdministrator {
  _id: string;
  username: string;
  passwordHash: string;
  role: Role;
  totpEnabled: boolean;
  totpSecretEncrypted?: string;
  isActive: boolean;
  activeSessionId?: string;
  currentLoginIp?: string;
  currentLoginUserAgent?: string;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  failedLoginAttempts: number;
  lockoutUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICustomer {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  status: CustomerStatus;
  subscriptionId?: string;
  planId?: string;
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
  lifetimeRequestLimit: number;
  maxConcurrentRequests: number;
  maxBandwidthBytes: number;
  allowedApis: string[]; // List of ApiCatalog _ids or '*' for all
  allowedIps: string[]; // List of CIDR / IPs
  boundIp?: string; // First-seen / strictly locked single IP address
  ipLockStrict?: boolean; // If true, only boundIp is permitted (prevents key sharing)
  autoBanOnKeySharing?: boolean; // If true, auto-suspends account and bans foreign IP immediately
  activeIps?: string[];
  lastSeenIp?: string;
  lastSeenAt?: Date;
  keySharingViolations?: number;
  activeSessionId?: string;
  passwordHash?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  totpEnabled?: boolean;
  totpSecretEncrypted?: string;
  backupCodes?: string[];
  accountSecurityScore?: number;
  riskScore?: number;
  maxKeys?: number;
  tags: string[];
  developerTag?: string;
  price?: number;
  currency?: string;
  expiresAt: Date;
  suspendedAt?: Date;
  deletedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IApiKey {
  _id: string;
  customerId: string;
  keyHash: string; // SHA-256 or HMAC hash
  keyPrefix: string; // arjun_live_xxxx...
  keyId?: string;
  name?: string;
  riskScore?: number;
  lastUsedIp?: string;
  lastUsedUserAgent?: string;
  allowedIps?: string[];
  boundIp?: string;
  status: ApiKeyStatus;
  createdAt: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  replacedBy?: string;
}

export interface IApiCatalog {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  version: string;
  gatewayPath: string; // e.g., /user/info (mounted under /v1)
  upstreamBaseUrl: string; // e.g., https://upstream.example.com
  upstreamPath: string; // e.g., /api/user/info
  allowedMethods: HttpMethod[];
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  timeoutMs: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  cachePolicy: {
    enabled: boolean;
    ttlSeconds: number;
  };
  authenticationRequired: boolean;
  allowedHeaders: string[];
  healthCheck: {
    enabled: boolean;
    endpointPath: string;
    intervalSeconds: number;
    lastStatus: 'healthy' | 'unhealthy' | 'unknown';
    lastLatencyMs?: number;
    lastCheckedAt?: Date;
    failureCount: number;
    uptimePercentage: number;
  };
  status: ApiCatalogStatus;
  allowedPlans: string[]; // Plan IDs or '*'
  authConfig?: ProviderAuthConfig;
  parameterDefinitions?: ParameterDefinition[];
  parameterMappings?: ParameterMapping[];
  requestBodyType?: 'none' | 'json' | 'form-urlencoded' | 'multipart' | 'text' | 'xml';
  responseEnvelope?: 'preserve' | 'wrap' | 'header_only';
  validationStatus?: 'PASS' | 'FAIL' | 'WARNING' | 'BLOCKED' | 'NOT_TESTED';
  lastValidationReport?: ApiValidationReport;
  originalCurl?: string;
  sampleRequest?: any;
  sampleResponse?: any;
  createdAt: Date;
  updatedAt: Date;
}

export type ParameterLocation = 'query' | 'header' | 'path' | 'body';
export type ParameterDataType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface ParameterDefinition {
  name: string;
  in: ParameterLocation;
  type: ParameterDataType;
  required: boolean;
  defaultValue?: any;
  description?: string;
  sampleValue?: any;
}

export interface ParameterMapping {
  clientName: string;
  clientIn: ParameterLocation;
  providerName: string;
  providerIn: ParameterLocation;
  isStatic?: boolean;
  staticValue?: any;
  isProviderCredential?: boolean;
  required?: boolean;
  defaultValue?: any;
  transform?: 'none' | 'trim' | 'lowercase' | 'uppercase';
}

export interface ProviderAuthConfig {
  type: 'none' | 'api_key_query' | 'api_key_header' | 'bearer_token' | 'basic_auth' | 'custom_header';
  paramName?: string; // e.g. "key", "api_key", "X-API-Key", "Authorization"
  encryptedCredential?: string; // AES-256-GCM encrypted secret
  credentialPrefix?: string; // e.g. "sk_live_...ab12" for display
  headerFormat?: string; // e.g. "Bearer {token}" or "{key}"
  basicUsername?: string;
}

export interface CachePolicyConfig {
  enabled: boolean;
  ttlSeconds: number;
  cacheMethods?: string[]; // default ['GET']
  varyByHeaders?: string[];
  respectUpstreamCacheControl?: boolean;
}

export interface ApiValidationReport {
  status: 'PASS' | 'FAIL' | 'WARNING' | 'BLOCKED' | 'NOT_TESTED';
  checkedAt: Date | string;
  durationMs: number;
  tests: {
    name: string;
    status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';
    message: string;
    details?: any;
  }[];
  statusCode?: number;
  targetUrl?: string;
  sampleResponseSnippet?: string;
}

export interface ClientDeliveryPackage {
  apiName: string;
  endpointUrl: string;
  gatewayPath: string;
  httpMethod: string;
  parameters: {
    name: string;
    in: ParameterLocation;
    type: ParameterDataType;
    required: boolean;
    defaultValue?: any;
    description?: string;
    sampleValue?: any;
  }[];
  authentication: {
    type: string;
    header: string;
    queryParam: string;
    note: string;
  };
  caching: {
    enabled: boolean;
    ttlSeconds: number;
    bypassHeader: string;
  };
  sampleRequests: {
    curl: string;
    javascriptFetch: string;
    nodejs: string;
    pythonRequests: string;
    phpCurl: string;
  };
  sampleResponse?: any;
}

export interface ICustomerApiPermission {
  _id: string;
  customerId: string;
  apiId: string;
  enabled: boolean;
  customDailyLimit?: number;
  customMonthlyLimit?: number;
  customLifetimeLimit?: number;
  customConcurrencyLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionPlan {
  _id: string;
  name: string;
  description: string;
  durationDays: number;
  dailyLimit: number;
  monthlyLimit: number;
  lifetimeLimit: number;
  bandwidthLimitBytes: number;
  concurrencyLimit: number;
  allowedApis: string[];
  price: number;
  currency: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscription {
  _id: string;
  customerId: string;
  planId: string;
  startAt: Date;
  expiresAt: Date;
  status: SubscriptionStatus;
  assignedBy: string;
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUsageDaily {
  _id: string;
  customerId: string;
  apiId: string;
  date: string; // YYYY-MM-DD
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  bandwidthBytes: number;
}

export interface IUsageMonthly {
  _id: string;
  customerId: string;
  apiId: string;
  month: string; // YYYY-MM
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  bandwidthBytes: number;
}

export interface IUsageEvent {
  _id: string;
  requestId: string;
  customerId: string;
  apiId: string;
  endpoint: string;
  timestamp: Date;
  statusCode: number;
  durationMs: number;
  bandwidthBytes: number;
  result: 'success' | 'quota_exceeded' | 'auth_failed' | 'upstream_error' | 'forbidden';
}

export interface IRequestLog {
  _id: string;
  requestId: string;
  customerId: string;
  apiId: string;
  method: HttpMethod;
  endpoint: string;
  sourceIp: string;
  statusCode: number;
  upstreamStatus?: number;
  durationMs: number;
  requestBytes: number;
  responseBytes: number;
  timestamp: Date;
  errorCode?: string;
  userAgent?: string;
}

export interface ICustomerIpAllowlist {
  _id: string;
  customerId: string;
  cidr: string;
  label: string;
  enabled: boolean;
  createdAt: Date;
}

export interface ICustomerWebhook {
  _id: string;
  customerId: string;
  url: string;
  encryptedSecret: string;
  events: WebhookEventType[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWebhookDelivery {
  _id: string;
  customerId: string;
  webhookId: string;
  event: WebhookEventType;
  payloadReference: Record<string, unknown>;
  status: WebhookStatus;
  attemptCount: number;
  nextAttemptAt?: Date;
  lastAttemptAt?: Date;
  responseStatus?: number;
  responseBodySnippet?: string;
  error?: string;
  createdAt: Date;
}

export interface ISupportTicketMessage {
  senderId: string;
  senderRole: 'customer' | 'admin';
  senderName: string;
  message: string;
  createdAt: Date;
}

export interface ISupportTicket {
  _id: string;
  customerId: string;
  customerUsername: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  messages: ISupportTicketMessage[];
  attachments: string[];
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IManualPayment {
  _id: string;
  customerId: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  reference: string;
  status: PaymentStatus;
  verifiedBy?: string;
  verifiedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAdminAuditLog {
  _id: string;
  administratorId: string;
  administratorUsername: string;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  sourceIp: string;
  userAgent?: string;
  result: 'success' | 'failure';
  errorMessage?: string;
  correlationId?: string;
  previousHash?: string;
  integrityHash?: string;
  createdAt: Date;
}

export interface ISystemSettings {
  _id: string;
  key: string;
  valueEncrypted: string;
  description: string;
  updatedBy: string;
  updatedAt: Date;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  code?: 'DAILY_QUOTA_EXCEEDED' | 'MONTHLY_QUOTA_EXCEEDED' | 'LIFETIME_QUOTA_EXCEEDED' | 'ENDPOINT_QUOTA_EXCEEDED' | 'CONCURRENCY_LIMIT_REACHED' | 'BANDWIDTH_LIMIT_EXCEEDED' | 'RATE_LIMIT_EXCEEDED' | 'IP_NOT_ALLOWED' | 'ACCOUNT_SUSPENDED' | 'ACCOUNT_EXPIRED' | 'API_ACCESS_DENIED';
  currentUsage?: {
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
    lifetimeUsed: number;
    lifetimeLimit: number;
    concurrencyCurrent: number;
    concurrencyLimit: number;
    bandwidthUsedBytes: number;
    bandwidthLimitBytes: number;
    remainingDaily: number;
  };
}

export interface DashboardSessionUser {
  customerId: string;
  username: string;
  fullName: string;
  email: string;
  status: CustomerStatus;
  expiresAt: string;
  keyPrefix: string;
}

export interface AdminSessionUser {
  adminId: string;
  username: string;
  role: Role;
  sessionId?: string;
}

export type SecurityIncidentType =
  | 'KEY_SHARING_VIOLATION'
  | 'BRUTE_FORCE_PROBE'
  | 'BLACKLISTED_IP_ATTEMPT'
  | 'UNAUTHORIZED_LOGIN'
  | 'CONCURRENT_LOGIN_TERMINATED'
  | 'SUSPICIOUS_UA'
  | 'SSRF_ATTEMPT';

export type SecuritySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ISecurityIncident {
  _id: string;
  incidentType: SecurityIncidentType;
  severity: SecuritySeverity;
  sourceIp: string;
  customerId?: string;
  customerUsername?: string;
  keyPrefix?: string;
  endpoint?: string;
  method?: string;
  details: Record<string, any>;
  actionTaken: string;
  createdAt: Date;
}

export interface IIpBlacklist {
  _id: string;
  ip: string;
  reason: string;
  blockedBy: string;
  expiresAt?: Date;
  isActive: boolean;
  incidentCount: number;
  lastTriggeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDevice {
  _id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  os: string;
  browser: string;
  ipAddress: string;
  isTrusted: boolean;
  firstLoginAt: Date;
  lastActiveAt: Date;
  status: 'active' | 'revoked';
}

export interface IUserSession {
  _id: string;
  userId: string;
  role: 'admin' | 'customer';
  sessionId: string;
  deviceId?: string;
  ipAddress: string;
  userAgent?: string;
  expiresAt: Date;
  isActive: boolean;
  lastActivityAt: Date;
}

export type HostingRuntime = 'nodejs' | 'python' | 'php' | 'custom';
export type HostingStatus = 'stopped' | 'running' | 'building' | 'failed';

export interface IHostingDeployment {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  runtime: HostingRuntime;
  version: string;
  port: number;
  domain?: string;
  subdomain?: string;
  gatewayPath: string;
  envVars: Record<string, string>;
  status: HostingStatus;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  restartPolicy: 'always' | 'on-failure' | 'never';
  memoryLimitMb: number;
  cpuLimitPercent: number;
  pid?: number;
  workingDir: string;
  entryPoint: string;
  errorLog?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISecurityAlertNotification {
  _id: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  severity: SecuritySeverity;
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface RiskAssessmentResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  action: 'MONITOR' | 'VERIFY' | 'THROTTLE' | 'SUSPEND_KEY';
  factors: string[];
}

export interface IDeveloperProfile {
  _id?: string;
  name: string;
  role: string;
  product: string;
  description: string;
  email: string;
  telegram: string;
  telegramUrl: string;
  instagram: string;
  instagramUrl: string;
  twitter: string;
  twitterUrl: string;
  portfolioUrl: string;
  youtubeName: string;
  youtubeUrl: string;
  avatarUrl?: string;
  footerCreditText: string;
  enabled: boolean;
  socialLinks: {
    email: boolean;
    telegram: boolean;
    instagram: boolean;
    twitter: boolean;
    portfolio: boolean;
    youtube: boolean;
  };
  updatedBy?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}


