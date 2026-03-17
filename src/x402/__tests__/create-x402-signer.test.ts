const mockAccount = { address: '0xmockAccount' };
const mockPublicClient = { chain: { id: 8453 } };
const mockHttpTransport = { type: 'http' };
const mockEvmSigner = { sign: 'mockEvmSigner' };
const mockExactEvmScheme = { scheme: 'mockExactEvmScheme' };
const mockClientInstance = {
  createPaymentPayload: jest.fn(),
  register: jest.fn(),
};
mockClientInstance.register.mockReturnValue(mockClientInstance);

jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => mockPublicClient),
  http: jest.fn(() => mockHttpTransport),
}));

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(() => mockAccount),
}));

jest.mock('viem/chains', () => ({
  base: { id: 8453, name: 'Base' },
}));

jest.mock('@x402/evm', () => ({
  ExactEvmScheme: jest.fn(() => mockExactEvmScheme),
  toClientEvmSigner: jest.fn(() => mockEvmSigner),
}));

jest.mock('@x402/core/client', () => ({
  x402Client: jest.fn(() => mockClientInstance),
}));

import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createX402Signer } from '../create-x402-signer';

const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('createX402Signer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientInstance.register.mockReturnValue(mockClientInstance);
  });

  it('should create an account from the private key', () => {
    createX402Signer({ privateKey: PRIVATE_KEY });

    expect(privateKeyToAccount).toHaveBeenCalledWith(PRIVATE_KEY);
  });

  it('should create a public client with Base chain and http transport', () => {
    createX402Signer({ privateKey: PRIVATE_KEY });

    expect(http).toHaveBeenCalled();
    expect(createPublicClient).toHaveBeenCalledWith({
      chain: { id: 8453, name: 'Base' },
      transport: mockHttpTransport,
    });
  });

  it('should create an EVM signer', () => {
    createX402Signer({ privateKey: PRIVATE_KEY });

    expect(toClientEvmSigner).toHaveBeenCalledWith(mockAccount, mockPublicClient);
  });

  it('should create an ExactEvmScheme', () => {
    createX402Signer({ privateKey: PRIVATE_KEY });

    expect(ExactEvmScheme).toHaveBeenCalledWith(mockEvmSigner);
  });

  it('should register with the correct chain ID', () => {
    createX402Signer({ privateKey: PRIVATE_KEY });

    expect(mockClientInstance.register).toHaveBeenCalledWith('eip155:8453', mockExactEvmScheme);
  });

  it('should delegate createPaymentPayload to x402Client', async () => {
    const mockPayload = { signed: true };
    mockClientInstance.createPaymentPayload.mockResolvedValueOnce(mockPayload);

    const signer = createX402Signer({ privateKey: PRIVATE_KEY });
    const result = await signer.createPaymentPayload({ amount: 100 });

    expect(mockClientInstance.createPaymentPayload).toHaveBeenCalledWith({ amount: 100 });
    expect(result).toEqual(mockPayload);
  });

  it('should propagate errors from createPaymentPayload', async () => {
    const error = new Error('payment failed');
    mockClientInstance.createPaymentPayload.mockRejectedValueOnce(error);

    const signer = createX402Signer({ privateKey: PRIVATE_KEY });

    await expect(signer.createPaymentPayload({ amount: 100 })).rejects.toThrow('payment failed');
  });
});
