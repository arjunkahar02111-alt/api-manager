import { z } from 'zod';

export const AdminLoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
  totpCode: z.string().length(6).optional(),
});

export const CustomerLoginSchema = z.object({
  apiKey: z
    .string()
    .min(10)
    .max(128)
    .regex(/^arjun_live_[a-zA-Z0-9_-]+$/, 'Invalid API key format. Must start with arjun_live_'),
});

export const CreateCustomerSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-zA-Z0-9_\s-]+$/, 'Name must be alphanumeric with spaces, dashes or underscores'),
  fullName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  company: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  planId: z.string().optional(),
  validityDays: z.number().min(1).max(36500).default(30),
  dailyRequestLimit: z.number().min(0).default(1000),
  monthlyRequestLimit: z.number().min(0).default(30000),
  lifetimeRequestLimit: z.number().min(0).default(100000),
  maxConcurrentRequests: z.number().min(1).max(10000).default(10),
  maxBandwidthBytes: z.number().min(0).default(10737418240), // 10 GB default
  allowedApis: z.array(z.string()).default(['*']),
  allowedIps: z.array(z.string()).default([]),
  boundIp: z.string().optional(),
  ipLockStrict: z.boolean().default(true).optional(),
  autoBanOnKeySharing: z.boolean().default(true).optional(),
  tags: z.array(z.string()).default([]),
  developerTag: z.string().max(50).default('arjunkahar').optional(),
  price: z.number().min(0).default(0).optional(),
  currency: z.string().default('USD').optional(),
});

export const UpdateCustomerSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  company: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  planId: z.string().optional(),
  dailyRequestLimit: z.number().int().min(0).optional(),
  monthlyRequestLimit: z.number().int().min(0).optional(),
  lifetimeRequestLimit: z.number().int().min(0).optional(),
  maxConcurrentRequests: z.number().int().min(1).max(1000).optional(),
  maxBandwidthBytes: z.number().int().min(0).optional(),
  allowedApis: z.array(z.string()).optional(),
  allowedIps: z.array(z.string()).optional(),
  boundIp: z.string().nullable().optional(),
  ipLockStrict: z.boolean().optional(),
  autoBanOnKeySharing: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  developerTag: z.string().max(50).optional(),
  status: z.enum(['active', 'suspended', 'expired']).optional(),
});

export const ExtendCustomerValiditySchema = z.object({
  additionalDays: z.number().int().min(1).max(3650),
});

export const CreateApiCatalogSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(1000).default(''),
  category: z.string().min(2).max(50).default('General'),
  version: z.string().default('v1'),
  gatewayPath: z
    .string()
    .min(1)
    .regex(/^\/[a-zA-Z0-9_\-\/]+$/, 'Gateway path must start with / and contain valid path characters'),
  upstreamBaseUrl: z
    .string()
    .url()
    .regex(/^https?:\/\//, 'Upstream must be a valid HTTP or HTTPS URL'),
  upstreamPath: z.string().default(''),
  allowedMethods: z
    .array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']))
    .min(1),
  requestSchema: z.record(z.unknown()).optional(),
  responseSchema: z.record(z.unknown()).optional(),
  timeoutMs: z.number().int().min(500).max(60000).default(15000),
  maxRequestBytes: z.number().int().min(1024).max(52428800).default(10485760), // 10MB
  maxResponseBytes: z.number().int().min(1024).max(52428800).default(10485760),
  cachePolicy: z
    .object({
      enabled: z.boolean().default(false),
      ttlSeconds: z.number().int().min(1).max(86400).default(60),
    })
    .default({ enabled: false, ttlSeconds: 60 }),
  authenticationRequired: z.boolean().default(true),
  allowedHeaders: z.array(z.string()).default(['Content-Type', 'Accept', 'User-Agent']),
  healthCheck: z
    .object({
      enabled: z.boolean().default(true),
      endpointPath: z.string().default('/health'),
      intervalSeconds: z.number().int().min(10).max(3600).default(60),
    })
    .default({ enabled: true, endpointPath: '/health', intervalSeconds: 60 }),
  status: z.enum(['active', 'disabled', 'maintenance']).default('active'),
  allowedPlans: z.array(z.string()).default(['*']),
});

export const CreateSubscriptionPlanSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).default(''),
  durationDays: z.number().int().min(1).max(3650).default(30),
  dailyLimit: z.number().int().min(0).default(1000),
  monthlyLimit: z.number().int().min(0).default(30000),
  lifetimeLimit: z.number().int().min(0).default(100000),
  bandwidthLimitBytes: z.number().int().min(0).default(10737418240), // 10 GB
  concurrencyLimit: z.number().int().min(1).max(500).default(10),
  allowedApis: z.array(z.string()).default(['*']),
  price: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD'),
});

export const RecordManualPaymentSchema = z.object({
  customerId: z.string().min(1),
  subscriptionId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  paymentMethod: z.string().min(2).max(50),
  reference: z.string().min(2).max(100),
  notes: z.string().max(500).optional(),
});

export const VerifyPaymentSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  notes: z.string().max(500).optional(),
  extendCustomerDays: z.number().int().min(0).optional(),
});

export const CreateIpAllowlistSchema = z.object({
  cidr: z.string().min(7).max(50),
  label: z.string().max(100).default(''),
});

export const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z
    .array(
      z.enum([
        'account.expiring_soon',
        'account.expired',
        'quota.daily_warning',
        'quota.daily_exceeded',
        'quota.monthly_warning',
        'quota.monthly_exceeded',
        'quota.lifetime_warning',
        'quota.lifetime_exceeded',
        'api.availability_change',
        'subscription.updated',
        'subscription.renewed',
        'account.suspended',
        'account.reactivated',
      ])
    )
    .min(1),
  enabled: z.boolean().default(true),
});

export const CreateSupportTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  category: z.string().min(2).max(50),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  message: z.string().min(10).max(5000),
});

export const ReplySupportTicketSchema = z.object({
  message: z.string().min(2).max(5000),
});

export const UpdateTicketStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  internalNotes: z.string().max(2000).optional(),
});

export const MaintenanceModeSchema = z.object({
  scope: z.enum(['global', 'gateway', 'customer_dashboard', 'api']),
  targetId: z.string().optional(), // ApiCatalog ID if scope is 'api'
  enabled: z.boolean(),
  message: z.string().max(500).default('Service is currently undergoing scheduled maintenance. Please try again shortly.'),
});

export const BlacklistIpSchema = z.object({
  ip: z.string().min(1).max(64),
  reason: z.string().min(2).max(500),
  expiresInHours: z.number().int().min(1).max(87600).optional(),
});

export const SecurityIncidentFilterSchema = z.object({
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  incidentType: z.string().optional(),
  sourceIp: z.string().optional(),
  customerId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const ResetBoundIpSchema = z.object({
  newIp: z.string().optional(), // If omitted, unlocks IP so next request becomes the new bound IP
});

export const CustomerPasswordLoginSchema = z.object({
  identifier: z.string().min(3).max(100), // username or email
  password: z.string().min(6).max(100),
  totpCode: z.string().length(6).optional(),
});

export const CustomerRegisterSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username must be alphanumeric'),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  fullName: z.string().min(2).max(100),
  phone: z.string().optional(),
});

export const TotpVerifySchema = z.object({
  token: z.string().length(6),
});

export const CreateHostingDeploymentSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  runtime: z.enum(['nodejs', 'python', 'php', 'custom']).default('nodejs'),
  version: z.string().default('latest'),
  port: z.number().int().min(1024).max(65535),
  gatewayPath: z.string().regex(/^\/[a-zA-Z0-9_\-\/]+$/, 'Must start with /'),
  envVars: z.record(z.string()).default({}),
  restartPolicy: z.enum(['always', 'on-failure', 'never']).default('always'),
  memoryLimitMb: z.number().int().min(64).max(4096).default(512),
  cpuLimitPercent: z.number().int().min(5).max(100).default(50),
  entryPoint: z.string().default('index.js'),
});

export const UpdateHostingDeploymentSchema = z.object({
  description: z.string().max(500).optional(),
  envVars: z.record(z.string()).optional(),
  restartPolicy: z.enum(['always', 'on-failure', 'never']).optional(),
  memoryLimitMb: z.number().int().min(64).max(4096).optional(),
  cpuLimitPercent: z.number().int().min(5).max(100).optional(),
  entryPoint: z.string().optional(),
});

export const AnalyzeApiInputSchema = z.object({
  rawInput: z.string().min(1, 'Please provide a cURL command, URL, OpenAPI JSON, or Postman JSON'),
  inputType: z.enum(['curl', 'openapi', 'postman', 'url', 'auto']).default('auto'),
  sampleRequest: z.record(z.unknown()).optional(),
});

export const ParameterDefinitionSchema = z.object({
  name: z.string().min(1),
  in: z.enum(['query', 'header', 'path', 'body']),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']).default('string'),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  description: z.string().optional(),
  sampleValue: z.unknown().optional(),
});

export const ParameterMappingSchema = z.object({
  clientName: z.string().min(1),
  clientIn: z.enum(['query', 'header', 'path', 'body']),
  providerName: z.string().min(1),
  providerIn: z.enum(['query', 'header', 'path', 'body']),
  isStatic: z.boolean().default(false).optional(),
  staticValue: z.unknown().optional(),
  isProviderCredential: z.boolean().default(false).optional(),
  required: z.boolean().default(false).optional(),
  defaultValue: z.unknown().optional(),
  transform: z.enum(['none', 'trim', 'lowercase', 'uppercase']).default('none').optional(),
});

export const ProviderAuthConfigSchema = z.object({
  type: z.enum(['none', 'api_key_query', 'api_key_header', 'bearer_token', 'basic_auth', 'custom_header']).default('none'),
  paramName: z.string().optional(),
  credentialValue: z.string().optional(), // Raw value from admin UI to be encrypted
  encryptedCredential: z.string().optional(),
  credentialPrefix: z.string().optional(),
  headerFormat: z.string().optional(),
  basicUsername: z.string().optional(),
});

export const ValidateApiInputSchema = z.object({
  name: z.string().min(1).default('Sample API'),
  upstreamBaseUrl: z.string().url(),
  upstreamPath: z.string().default(''),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']).default('GET'),
  authConfig: ProviderAuthConfigSchema.optional(),
  parameterMappings: z.array(ParameterMappingSchema).default([]),
  requestBodyType: z.enum(['none', 'json', 'form-urlencoded', 'multipart', 'text', 'xml']).default('none').optional(),
  sampleBody: z.unknown().optional(),
  sampleQueryParams: z.record(z.unknown()).optional(),
  sampleHeaders: z.record(z.string()).optional(),
  timeoutMs: z.number().int().min(500).max(60000).default(15000),
});

export const PublishImportedApiSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(1000).default(''),
  category: z.string().min(2).max(50).default('Imported APIs'),
  version: z.string().default('v1'),
  gatewayPath: z.string().regex(/^\/[a-zA-Z0-9_\-\/]+$/, 'Must start with /'),
  upstreamBaseUrl: z.string().url(),
  upstreamPath: z.string().default(''),
  allowedMethods: z.array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])).min(1),
  authConfig: ProviderAuthConfigSchema.optional(),
  parameterDefinitions: z.array(ParameterDefinitionSchema).default([]),
  parameterMappings: z.array(ParameterMappingSchema).default([]),
  requestBodyType: z.enum(['none', 'json', 'form-urlencoded', 'multipart', 'text', 'xml']).default('none'),
  responseEnvelope: z.enum(['preserve', 'wrap', 'header_only']).default('preserve'),
  cachePolicy: z.object({
    enabled: z.boolean().default(true),
    ttlSeconds: z.number().int().min(1).max(86400).default(60),
    cacheMethods: z.array(z.string()).default(['GET']).optional(),
    respectUpstreamCacheControl: z.boolean().default(true).optional(),
  }).default({ enabled: true, ttlSeconds: 60 }),
  timeoutMs: z.number().int().min(500).max(60000).default(30000),
  originalCurl: z.string().optional(),
  sampleRequest: z.unknown().optional(),
  sampleResponse: z.unknown().optional(),
  allowedPlans: z.array(z.string()).default(['*']),
});

export const UpdateDeveloperProfileSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  product: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  email: z.string().email(),
  telegram: z.string().min(1).max(100),
  telegramUrl: z.string().url(),
  instagram: z.string().min(1).max(100),
  instagramUrl: z.string().url(),
  twitter: z.string().min(1).max(100),
  twitterUrl: z.string().url(),
  portfolioUrl: z.string().url(),
  youtubeName: z.string().min(1).max(100),
  youtubeUrl: z.string().url(),
  avatarUrl: z.string().optional().default(''),
  footerCreditText: z.string().min(1).max(200),
  enabled: z.boolean().default(true),
  socialLinks: z
    .object({
      email: z.boolean().default(true),
      telegram: z.boolean().default(true),
      instagram: z.boolean().default(true),
      twitter: z.boolean().default(true),
      portfolio: z.boolean().default(true),
      youtube: z.boolean().default(true),
    })
    .default({
      email: true,
      telegram: true,
      instagram: true,
      twitter: true,
      portfolio: true,
      youtube: true,
    }),
});



