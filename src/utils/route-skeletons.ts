import { z } from 'zod';

const RouteSchema = z.object({
  name: z.string(),
  path: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  params: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['string', 'number', 'boolean']),
      required: z.boolean(),
    })
  ),
  response: z.unknown(),
  version: z.string(),
  description: z.string(),
});

export type RouteSkeleton = z.infer<typeof RouteSchema>;

const ROUTE_PREFIXES = {
  wallet: '/api/v1/wallet',
  transaction: '/api/v1/transaction',
  account: '/api/v1/account',
  network: '/api/v1/network',
  auth: '/api/v1/auth',
  settings: '/api/v1/settings',
} as const;

export const ROUTE_SKELETONS: RouteSkeleton[] = [
  {
    name: 'Get Wallet',
    path: `${ROUTE_PREFIXES.wallet}/:id`,
    method: 'GET',
    params: [
      { name: 'id', type: 'string', required: true },
    ],
    response: { id: '', balance: 0, network: '' },
    version: '1.0.0',
    description: 'Retrieve wallet by ID',
  },
  {
    name: 'Create Transaction',
    path: `${ROUTE_PREFIXES.transaction}`,
    method: 'POST',
    params: [
      { name: 'from', type: 'string', required: true },
      { name: 'to', type: 'string', required: true },
      { name: 'amount', type: 'number', required: true },
      { name: 'network', type: 'string', required: true },
    ],
    response: { id: '', status: 'pending', hash: '' },
    version: '1.0.0',
    description: 'Create a new transaction',
  },
  {
    name: 'Get Transaction',
    path: `${ROUTE_PREFIXES.transaction}/:hash`,
    method: 'GET',
    params: [
      { name: 'hash', type: 'string', required: true },
    ],
    response: { hash: '', status: '', details: {} },
    version: '1.0.0',
    description: 'Retrieve transaction by hash',
  },
  {
    name: 'Get Account',
    path: `${ROUTE_PREFIXES.account}/:address`,
    method: 'GET',
    params: [
      { name: 'address', type: 'string', required: true },
    ],
    response: { address: '', sequence: 0, balance: 0 },
    version: '1.0.0',
    description: 'Retrieve account by address',
  },
  {
    name: 'List Networks',
    path: `${ROUTE_PREFIXES.network}`,
    method: 'GET',
    params: [],
    response: { networks: [] },
    version: '1.0.0',
    description: 'List available networks',
  },
  {
    name: 'Get Network Config',
    path: `${ROUTE_PREFIXES.network}/:id`,
    method: 'GET',
    params: [
      { name: 'id', type: 'string', required: true },
    ],
    response: { id: '', name: '', rpcUrl: '' },
    version: '1.0.0',
    description: 'Get network configuration',
  },
  {
    name: 'Authenticate',
    path: `${ROUTE_PREFIXES.auth}/login`,
    method: 'POST',
    params: [
      { name: 'wallet', type: 'string', required: true },
      { name: 'signature', type: 'string', required: true },
    ],
    response: { token: '', expiresAt: '' },
    version: '1.0.0',
    description: 'Authenticate with wallet signature',
  },
  {
    name: 'Get Settings',
    path: `${ROUTE_PREFIXES.settings}/:userId`,
    method: 'GET',
    params: [
      { name: 'userId', type: 'string', required: true },
    ],
    response: { userId: '', preferences: {}, notifications: {} },
    version: '1.0.0',
    description: 'Get user settings',
  },
];

export function findRoute(path: string, method: string): RouteSkeleton | undefined {
  return ROUTE_SKELETONS.find(
    (route) => route.path === path && route.method === method
  );
}

export function validateRouteConsistency(): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  const paths = ROUTE_SKELETONS.map((r) => r.path);
  const duplicates = paths.filter(
    (path, idx) => paths.indexOf(path) !== idx
  );

  if (duplicates.length > 0) {
    violations.push(`Duplicate routes found: ${duplicates.join(', ')}`);
  }

  const versions = new Set(ROUTE_SKELETONS.map((r) => r.version));
  if (versions.size > 1) {
    violations.push(`Inconsistent API versions: ${versions.join(', ')}`);
  }

  ROUTE_SKELETONS.forEach((route) => {
    if (!route.params.every((p) => ['string', 'number', 'boolean'].includes(p.type))) {
      violations.push(`Invalid param type in ${route.name}`);
    }
  });

  return {
    valid: violations.length === 0,
    violations,
  };
}

export function generateRouteDoc(): string {
  return `# API Route Skeletons

## Version: 1.0.0

### Base URLs
- Wallet: ${ROUTE_PREFIXES.wallet}
- Transaction: ${ROUTE_PREFIXES.transaction}
- Account: ${ROUTE_PREFIXES.account}
- Network: ${ROUTE_PREFIXES.network}
- Auth: ${ROUTE_PREFIXES.auth}
- Settings: ${ROUTE_PREFIXES.settings}

### Routes
${ROUTE_SKELETONS.map(
  (r) => `- \`${r.method}\` \`${r.path}\` - ${r.description} (v${r.version})`
).join('\n')}
`;
}
