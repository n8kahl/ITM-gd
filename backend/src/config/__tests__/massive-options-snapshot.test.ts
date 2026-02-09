const mockGet = jest.fn();
const mockRequestInterceptorUse = jest.fn();
const mockResponseInterceptorUse = jest.fn();
const mockCreate = jest.fn(() => ({
  get: mockGet,
  interceptors: {
    request: { use: mockRequestInterceptorUse },
    response: { use: mockResponseInterceptorUse },
  },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: mockCreate,
  },
  create: mockCreate,
}));

describe('massive options snapshot ticker mapping', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGet.mockReset();
    mockCreate.mockClear();
    process.env.MASSIVE_API_KEY = 'test-api-key';
  });

  it('uses I: prefix for index snapshots', async () => {
    mockGet.mockResolvedValue({
      data: {
        status: 'OK',
        results: [],
      },
    });

    const { getOptionsSnapshot } = require('../massive');
    await getOptionsSnapshot('SPX', 'O:SPXW260220C06970000');

    expect(mockGet).toHaveBeenCalledWith(
      '/v3/snapshot/options/I:SPX/O:SPXW260220C06970000',
      undefined,
    );
  });

  it('keeps equity symbols unprefixed for snapshots', async () => {
    mockGet.mockResolvedValue({
      data: {
        status: 'OK',
        results: [],
      },
    });

    const { getOptionsSnapshot } = require('../massive');
    await getOptionsSnapshot('SPY', 'O:SPY260220C00570000');

    expect(mockGet).toHaveBeenCalledWith(
      '/v3/snapshot/options/SPY/O:SPY260220C00570000',
      undefined,
    );
  });

  it('normalizes already-prefixed index symbols', async () => {
    mockGet.mockResolvedValue({
      data: {
        status: 'OK',
        results: [],
      },
    });

    const { getOptionsSnapshot } = require('../massive');
    await getOptionsSnapshot('I:NDX');

    expect(mockGet).toHaveBeenCalledWith(
      '/v3/snapshot/options/I:NDX',
      { params: { limit: 250 } },
    );
  });
});
