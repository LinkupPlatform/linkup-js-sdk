export interface X402Signer {
  createPaymentPayload(paymentRequired: unknown): Promise<unknown>;
}
