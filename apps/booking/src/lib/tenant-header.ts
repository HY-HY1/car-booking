// The request header the proxy uses to tell pages which business a request
// is for. Kept apart from tenant.ts so the proxy doesn't load page code.
export const TENANT_HEADER = "x-tenant-slug";
