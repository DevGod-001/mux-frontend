import { useMemo } from 'react';

interface NetworkConfig {
  chainId: string;
  name: string;
  explorerUrl: string;
  rpcUrl: string;
  currency: string;
  isTestnet: boolean;
}

const NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    chainId: '101',
    name: 'Stellar Mainnet',
    explorerUrl: 'https://stellar.explorer.mux.io',
    rpcUrl: 'https://rpc.mux.io',
    currency: 'XLM',
    isTestnet: false,
  },
  testnet: {
    chainId: '102',
    name: 'Stellar Testnet',
    explorerUrl: 'https://testnet.explorer.mux.io',
    rpcUrl: 'https://rpc.testnet.mux.io',
    currency: 'XLM',
    isTestnet: true,
  },
  futurenet: {
    chainId: '103',
    name: 'Stellar Futurenet',
    explorerUrl: 'https://futurenet.explorer.mux.io',
    rpcUrl: 'https://rpc.futurenet.mux.io',
    currency: 'XLM',
    isTestnet: true,
  },
};

export function getExplorerLink(
  txHash: string,
  network: string = 'mainnet',
  type: 'transaction' | 'account' | 'asset' = 'transaction'
): string {
  const config = NETWORKS[network];
  if (!config) {
    throw new Error(`Unknown network: ${network}`);
  }

  const baseUrl = config.explorerUrl;
  const path = type === 'transaction' ? 'tx' : type === 'account' ? 'account' : 'asset';

  return `${baseUrl}/${path}/${txHash}`;
}

export function isValidNetwork(network: string): boolean {
  return network in NETWORKS;
}

export function getNetworkConfig(network: string): NetworkConfig | null {
  return NETWORKS[network] || null;
}

export function ensureCorrectNetwork(
  currentNetwork: string,
  expectedNetwork: string
): { valid: boolean; network: string; redirectUrl?: string } {
  if (currentNetwork !== expectedNetwork) {
    const config = NETWORKS[expectedNetwork];
    return {
      valid: false,
      network: expectedNetwork,
      redirectUrl: config?.explorerUrl,
    };
  }

  return { valid: true, network: currentNetwork };
}

export function buildExplorerUrlWithNetwork(
  baseUrl: string,
  path: string,
  network: string
): string {
  const config = NETWORKS[network];
  if (!config) {
    throw new Error(`Unknown network: ${network}`);
  }

  return `${config.explorerUrl}/${path}/${baseUrl}`;
}

export function useNetworkAwareLinks() {
  const currentNetwork = 'mainnet';

  const links = useMemo(() => {
    return {
      explorer: (txHash: string, type: string) =>
        getExplorerLink(txHash, currentNetwork, type as any),
      getNetworkConfig: () => NETWORKS[currentNetwork],
    };
  }, [currentNetwork]);

  return links;
}

export class NetworkGuard {
  private currentNetwork: string;
  private allowedNetworks: Set<string>;

  constructor(currentNetwork: string, allowedNetworks: string[] = ['mainnet', 'testnet']) {
    this.currentNetwork = currentNetwork;
    this.allowedNetworks = new Set(allowedNetworks);
  }

  guardTransaction(tx: { network?: string; hash: string }): {
    safe: boolean;
    reason?: string;
    redirectUrl?: string;
  } {
    const network = tx.network || this.currentNetwork;
    if (!this.allowedNetworks.has(network)) {
      return {
        safe: false,
        reason: `Network ${network} not allowed`,
        redirectUrl: NETWORKS[network]?.explorerUrl,
      };
    }

    return { safe: true };
  }
}
