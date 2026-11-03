import { Image } from 'react-native';

const mockManipulate = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulate(...args),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('../services/api', () => ({
  API_BASE_URL: 'https://api.test/api',
  safeStorageGet: jest.fn().mockResolvedValue('tok-123'),
}));

import { OCR_MAX_IMAGE_WIDTH, scanReceiptWithOcr } from '../services/receiptOcr';

const okBody = {
  success: true,
  rawText: 'Big Bazaar Total 964.43',
  amount: 964.43,
  date: '2026-10-28',
  merchant: 'Big Bazaar',
  category: 'Groceries',
  confidence: 91,
};

function respond(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('scanReceiptWithOcr', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    jest.spyOn(Image, 'getSize').mockImplementation(((_uri: string, ok: (w: number, h: number) => void) => ok(4000, 3000)) as never);
    mockManipulate.mockResolvedValue({ uri: 'file:///cache/shrunk.jpg', width: OCR_MAX_IMAGE_WIDTH, height: 1200 });
  });

  it('uploads a shrunk JPEG with the auth token and returns the parsed receipt', async () => {
    fetchMock.mockResolvedValue(respond(200, okBody));

    const parsed = await scanReceiptWithOcr('file:///photo.heic', 'IMG_1.HEIC', 'image/heic');

    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///photo.heic',
      [{ resize: { width: OCR_MAX_IMAGE_WIDTH } }],
      expect.objectContaining({ compress: 0.8, format: 'jpeg' })
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/expenses/ocr');
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer tok-123' });
    expect(parsed.merchant).toBe('Big Bazaar');
    expect(parsed.amount).toBeCloseTo(964.43);
  });

  it('does not enlarge a photo that is already small', async () => {
    (Image.getSize as jest.Mock).mockImplementation((_u: string, ok: (w: number, h: number) => void) => ok(900, 1200));
    fetchMock.mockResolvedValue(respond(200, okBody));

    await scanReceiptWithOcr('file:///small.jpg', 'small.jpg', 'image/jpeg');

    expect(mockManipulate.mock.calls[0][1]).toEqual([]);
  });

  it('sends text files untouched', async () => {
    fetchMock.mockResolvedValue(respond(200, okBody));

    await scanReceiptWithOcr('file:///r.txt', 'r.txt', 'text/plain');

    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('uploads the original when the image cannot be processed', async () => {
    mockManipulate.mockRejectedValue(new Error('bad image'));
    fetchMock.mockResolvedValue(respond(200, okBody));

    await expect(scanReceiptWithOcr('file:///x.png', 'x.png', 'image/png')).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a network failure instead of returning a sample receipt', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(scanReceiptWithOcr('file:///x.jpg', 'x.jpg', 'image/jpeg')).rejects.toThrow(/reach the server/i);
  });

  it('reports a timeout', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    fetchMock.mockRejectedValue(abort);

    await expect(scanReceiptWithOcr('file:///x.jpg', 'x.jpg', 'image/jpeg')).rejects.toThrow(/too long/i);
  });

  it('tells the user to sign in again on 401', async () => {
    fetchMock.mockResolvedValue(respond(401, {}));

    await expect(scanReceiptWithOcr('file:///x.jpg', 'x.jpg', 'image/jpeg')).rejects.toThrow(/sign in again/i);
  });

  it('explains an oversized upload on 413', async () => {
    fetchMock.mockResolvedValue(respond(413, {}));

    await expect(scanReceiptWithOcr('file:///x.jpg', 'x.jpg', 'image/jpeg')).rejects.toThrow(/too large/i);
  });

  it("passes on the server's message when nothing readable was found", async () => {
    fetchMock.mockResolvedValue(respond(200, { success: false, message: 'Unable to extract readable text' }));

    await expect(scanReceiptWithOcr('file:///x.jpg', 'x.jpg', 'image/jpeg')).rejects.toThrow('Unable to extract readable text');
  });

  it('reports a server error with its status code', async () => {
    fetchMock.mockResolvedValue(respond(500, {}));

    await expect(scanReceiptWithOcr('file:///x.jpg', 'x.jpg', 'image/jpeg')).rejects.toThrow(/error 500/);
  });
});
