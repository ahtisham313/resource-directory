import "server-only";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import type { ValidatedImage } from "@/modules/surveys/validate-image";

const storageConfigSchema = z.object({
  endpoint: z.url().refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    );
  }),
  bucket: z.string().min(1),
  region: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
});

function readStorageConfig() {
  return storageConfigSchema.safeParse({
    endpoint: process.env.S3_ENDPOINT,
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  });
}

export function isImageStorageConfigured(): boolean {
  return readStorageConfig().success;
}
export function createImageKey(extension: ValidatedImage["extension"]): string {
  return `pending/${randomUUID()}.${extension}`;
}

export interface ImageStorage {
  put(key: string, image: ValidatedImage): Promise<string | undefined>;
  remove(key: string, versionId?: string): Promise<void>;
}

function storageConnection() {
  const parsed = readStorageConfig();
  if (!parsed.success) throw new Error("Image storage is not configured.");
  const { endpoint, bucket, region, accessKeyId, secretAccessKey } =
    parsed.data;
  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
    maxAttempts: 2,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
  });
  return { client, bucket };
}

export function getImageStorage(): ImageStorage {
  const { client, bucket } = storageConnection();
  return {
    async put(key, image) {
      // The bucket remains private; pending images have no public route or public-read ACL.
      const result = await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: image.bytes,
          ContentLength: image.bytes.length,
          ContentType: image.contentType,
          IfNoneMatch: "*",
        }),
      );
      return result.VersionId;
    },
    async remove(key, versionId) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
          VersionId: versionId,
        }),
      );
    },
  };
}

export async function readPrivateImage(key: string) {
  const { client, bucket } = storageConnection();
  const object = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: "bytes=0-2097152",
    }),
  );
  if (
    !object.Body ||
    !["image/png", "image/jpeg", "image/webp"].includes(
      object.ContentType ?? "",
    ) ||
    (object.ContentLength ?? 0) > 2097152
  )
    throw new Error("Image is unavailable.");
  const bytes = await object.Body.transformToByteArray();
  if (!bytes.length || bytes.length > 2097152)
    throw new Error("Image is unavailable.");
  return { bytes, contentType: object.ContentType! };
}
