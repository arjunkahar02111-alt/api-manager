// Centralized API client connecting to /api/v1/ and /v1/

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  tokenType?: 'admin' | 'customer' | 'none'
): Promise<{ success: boolean; data?: T; message?: string; error?: any; meta?: any }> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Auto-detect token type if not explicitly supplied
  let effectiveTokenType = tokenType;
  if (!effectiveTokenType) {
    if (endpoint.startsWith('/api/v1/admin')) {
      effectiveTokenType = 'admin';
    } else if (endpoint.startsWith('/api/v1/customer')) {
      effectiveTokenType = 'customer';
    } else {
      effectiveTokenType = 'none';
    }
  }

  // Attach token
  if (effectiveTokenType === 'admin') {
    const adminToken = localStorage.getItem('arjun_admin_token');
    if (adminToken) {
      headers.set('Authorization', `Bearer ${adminToken}`);
    }
  } else if (effectiveTokenType === 'customer') {
    const customerToken = localStorage.getItem('arjun_customer_token');
    if (customerToken) {
      headers.set('Authorization', `Bearer ${customerToken}`);
    }
  }

  try {
    const response = await fetch(endpoint, {
      credentials: 'include',
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // If unauthorized on admin endpoint, clear expired session and redirect to login
      if (response.status === 401 && (effectiveTokenType === 'admin' || endpoint.startsWith('/api/v1/admin'))) {
        localStorage.removeItem('arjun_admin_token');
        localStorage.removeItem('arjun_admin_user');
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }

      const errorMsg = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
      return {
        success: false,
        error: {
          code: data?.error?.code || 'REQUEST_FAILED',
          message: errorMsg,
          details: data?.error?.details || data?.usage,
        },
      };
    }

    return data || { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Network connection failed',
      },
    };
  }
}
