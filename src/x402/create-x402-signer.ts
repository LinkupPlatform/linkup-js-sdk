import { x402Client } from '@x402/core/client';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import type { X402Signer } from './types';

export function createX402Signer(opts: { privateKey: `0x${string}` }): X402Signer {
  const account = privateKeyToAccount(opts.privateKey);
  const publicClient = createPublicClient({ chain: base, transport: http() });
  const signer = toClientEvmSigner(account, publicClient);
  const client = new x402Client().register('eip155:8453', new ExactEvmScheme(signer));

  return {
    createPaymentPayload: paymentRequired => client.createPaymentPayload(paymentRequired),
  };
}
