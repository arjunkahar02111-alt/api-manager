import { Router } from 'express';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../../middleware/customerAuth.js';
import { Customer, ApiCatalog } from '../../database/models/index.js';
import { sendSuccess, NotFoundError } from '@arjun/shared';

const router = Router();

router.use(requireCustomerAuth);

router.get('/', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customer = await Customer.findById(req.customer!.customerId).lean();
    if (!customer) throw new NotFoundError('Customer not found');

    const query: Record<string, unknown> = { status: 'active' };
    if (!customer.allowedApis.includes('*')) {
      query._id = { $in: customer.allowedApis };
    }

    const apis = await ApiCatalog.find(query).sort({ category: 1, name: 1 }).lean();

    const formattedApis = apis.map((api) => ({
      id: api._id,
      name: api.name,
      slug: api.slug,
      description: api.description,
      category: api.category,
      version: api.version,
      gatewayPath: `/v1${api.gatewayPath}`,
      allowedMethods: api.allowedMethods,
      requestSchema: api.requestSchema,
      responseSchema: api.responseSchema,
      headers: api.allowedHeaders,
      timeoutMs: api.timeoutMs,
      // Provide ready code examples
      examples: {
        curl: `curl -X ${api.allowedMethods[0] || 'GET'} "https://api.karviontechnologies.in/v1${api.gatewayPath}" \\\n  -H "X-API-Key: YOUR_API_KEY"`,
        fetch: `fetch("https://api.karviontechnologies.in/v1${api.gatewayPath}", {\n  method: "${api.allowedMethods[0] || 'GET'}",\n  headers: { "X-API-Key": "YOUR_API_KEY" }\n}).then(res => res.json()).then(console.log);`,
        axios: `const axios = require('axios');\n\nconst response = await axios.${(api.allowedMethods[0] || 'GET').toLowerCase()}("https://api.karviontechnologies.in/v1${api.gatewayPath}", {\n  headers: { 'X-API-Key': 'YOUR_API_KEY' }\n});\nconsole.log(response.data);`,
        python: `import requests\n\nheaders = {"X-API-Key": "YOUR_API_KEY"}\nresponse = requests.${(api.allowedMethods[0] || 'GET').toLowerCase()}("https://api.karviontechnologies.in/v1${api.gatewayPath}", headers=headers)\nprint(response.json())`,
      },
    }));

    return sendSuccess(res, formattedApis);
  } catch (err) {
    next(err);
  }
});

export default router;
