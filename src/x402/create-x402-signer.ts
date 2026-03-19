import { x402Client } from '@x402/core/client';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { createPublicClient, http, type LocalAccount } from 'viem';
import { base } from 'viem/chains';
import type { X402Signer } from './types';

export function createX402Signer(account: LocalAccount): X402Signer {
  const publicClient = createPublicClient({ chain: base, transport: http() });
  const signer = toClientEvmSigner(account, publicClient);
  const client = new x402Client().register('eip155:8453', new ExactEvmScheme(signer));

  return {
    createPaymentPayload: paymentRequired => client.createPaymentPayload(paymentRequired),
  };
}
