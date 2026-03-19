declare module '@x402/core/http' {
  export function decodePaymentRequiredHeader(header: string): unknown;
  export function encodePaymentSignatureHeader(payload: unknown): string;
}

declare module '@x402/core/client' {
  export class x402Client {
    register(chainId: string, scheme: unknown): this;
    createPaymentPayload(paymentRequired: unknown): Promise<unknown>;
  }
}
