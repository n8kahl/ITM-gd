type SubscriptionRow = {
  id: string;
  endpoint: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
};

interface SetupResult {
  sendAutoJournalPushNotifications: (input: { userId: string; marketDate: string; createdCount: number }) => Promise<number>;
  fromMock: jest.Mock;
  updateMock: jest.Mock;
  updateEqMock: jest.Mock;
  setVapidDetailsMock: jest.Mock;
  sendNotificationMock: jest.Mock;
}

async function setupPushModule(
  subscriptions: SubscriptionRow[],
  sendNotificationImpl?: (subscription: unknown, payload: string) => Promise<void>,
): Promise<SetupResult> {
  const limitMock = jest.fn().mockResolvedValue({ data: subscriptions, error: null });
  const eqActiveMock = jest.fn().mockReturnValue({ limit: limitMock });
  const eqUserMock = jest.fn().mockReturnValue({ eq: eqActiveMock });
  const selectMock = jest.fn().mockReturnValue({ eq: eqUserMock });

  const updateEqMock = jest.fn().mockResolvedValue({ error: null });
  const updateMock = jest.fn().mockReturnValue({ eq: updateEqMock });

  const fromMock = jest.fn().mockReturnValue({
    select: selectMock,
    update: updateMock,
  });

  const setVapidDetailsMock = jest.fn();
  const sendNotificationMock = jest.fn(sendNotificationImpl || (() => Promise.resolve()));

  jest.doMock('../../../config/database', () => ({
    supabase: { from: fromMock },
  }));
  jest.doMock('../../../lib/logger', () => ({
    logger: { warn: jest.fn() },
  }));
  jest.doMock('web-push', () => ({
    __esModule: true,
    default: {
      setVapidDetails: setVapidDetailsMock,
      sendNotification: sendNotificationMock,
    },
  }));

  const pushModule = await import('../pushNotifications');

  return {
    sendAutoJournalPushNotifications: pushModule.sendAutoJournalPushNotifications,
    fromMock,
    updateMock,
    updateEqMock,
    setVapidDetailsMock,
    sendNotificationMock,
  };
}

describe('sendAutoJournalPushNotifications', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns zero when vapid env vars are missing', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    const module = await setupPushModule([{
      id: 'sub-1',
      endpoint: 'https://push.test/sub-1',
      subscription: {
        endpoint: 'https://push.test/sub-1',
        keys: { p256dh: 'abc', auth: 'def' },
      },
    }]);

    const sent = await module.sendAutoJournalPushNotifications({
      userId: 'user-1',
      marketDate: '2026-02-10',
      createdCount: 2,
    });

    expect(sent).toBe(0);
    expect(module.fromMock).not.toHaveBeenCalled();
    expect(module.setVapidDetailsMock).not.toHaveBeenCalled();
  });

  it('sends notifications to active subscriptions', async () => {
    process.env.VAPID_PUBLIC_KEY = 'public';
    process.env.VAPID_PRIVATE_KEY = 'private';

    const module = await setupPushModule([
      {
        id: 'sub-1',
        endpoint: 'https://push.test/sub-1',
        subscription: {
          endpoint: 'https://push.test/sub-1',
          keys: { p256dh: 'abc', auth: 'def' },
        },
      },
      {
        id: 'sub-2',
        endpoint: 'https://push.test/sub-2',
        subscription: {
          endpoint: 'https://push.test/sub-2',
          keys: { p256dh: 'ghi', auth: 'jkl' },
        },
      },
    ]);

    const sent = await module.sendAutoJournalPushNotifications({
      userId: 'user-1',
      marketDate: '2026-02-10',
      createdCount: 2,
    });

    expect(sent).toBe(2);
    expect(module.setVapidDetailsMock).toHaveBeenCalledTimes(1);
    expect(module.sendNotificationMock).toHaveBeenCalledTimes(2);
    expect(module.updateMock).toHaveBeenCalledTimes(2);
    expect(module.updateEqMock).toHaveBeenCalledTimes(2);
  });

  it('marks expired subscriptions inactive when delivery fails with 410', async () => {
    process.env.VAPID_PUBLIC_KEY = 'public';
    process.env.VAPID_PRIVATE_KEY = 'private';

    const module = await setupPushModule(
      [
        {
          id: 'sub-1',
          endpoint: 'https://push.test/sub-1',
          subscription: {
            endpoint: 'https://push.test/sub-1',
            keys: { p256dh: 'abc', auth: 'def' },
          },
        },
      ],
      async () => {
        throw { statusCode: 410, message: 'Gone' };
      },
    );

    const sent = await module.sendAutoJournalPushNotifications({
      userId: 'user-1',
      marketDate: '2026-02-10',
      createdCount: 1,
    });

    expect(sent).toBe(0);
    expect(module.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      is_active: false,
      last_error: 'Gone',
    }));
  });
});
