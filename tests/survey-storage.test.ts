import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getImageStorage,
  isImageStorageConfigured,
} from "../src/lib/image-storage";
const { send, construct } = vi.hoisted(() => ({
  send: vi.fn(),
  construct: vi.fn(),
}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor(options: unknown) {
      construct(options);
    }
    send = send;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  for (const [name, value] of Object.entries({
    S3_ENDPOINT: "https://storage.example.com",
    S3_BUCKET: "unit-test-bucket",
    S3_REGION: "auto",
    S3_ACCESS_KEY_ID: "unit-test-id",
    S3_SECRET_ACCESS_KEY: "unit-test-secret",
  }))
    vi.stubEnv(name, value);
});
afterEach(() => vi.unstubAllEnvs());
describe("private S3 storage adapter", () => {
  it("uploads bytes with the verified MIME type, virtual-hosted addressing, and no public ACL", async () => {
    send.mockResolvedValue({ VersionId: "version-1" });
    const storage = getImageStorage();
    expect(
      await storage.put("pending/example.png", {
        bytes: new Uint8Array([1, 2]),
        contentType: "image/png",
        extension: "png",
      }),
    ).toBe("version-1");
    const command = send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "unit-test-bucket",
      Key: "pending/example.png",
      ContentType: "image/png",
      ContentLength: 2,
    });
    expect(command.input).not.toHaveProperty("ACL");
    expect(construct).toHaveBeenCalledWith(
      expect.objectContaining({ forcePathStyle: false }),
    );
    await storage.remove("pending/example.png", "version-1");
    expect(send.mock.calls[1][0].input).toMatchObject({
      Key: "pending/example.png",
      VersionId: "version-1",
    });
  });
  it("fails closed on missing configuration or insecure remote endpoints", () => {
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "");
    expect(isImageStorageConfigured()).toBe(false);
    expect(() => getImageStorage()).toThrow();
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "unit-test-secret");
    vi.stubEnv("S3_ENDPOINT", "http://storage.example.com");
    expect(isImageStorageConfigured()).toBe(false);
  });
});
