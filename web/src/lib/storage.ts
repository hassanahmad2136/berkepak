import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { query } from "@/lib/db";

/**
 * Object storage, replacing Supabase Storage.
 *
 * S3-compatible so the same code runs against MinIO locally and S3/R2 in
 * production. Two buckets, matching the old setup:
 *   receipts       — private, read through short-lived signed URLs
 *   product-images — public, served directly
 */

export type Bucket = "receipts" | "product-images";

const client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  // MinIO serves buckets as path segments, not subdomains.
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "berkepak",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "berkepak_dev_secret",
  },
});

export async function putObject(
  bucket: Bucket,
  key: string,
  body: Buffer,
  contentType: string,
  opts: { ownerId?: string | null; isPublic?: boolean } = {},
): Promise<string> {
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );

  await query(
    `insert into files (bucket, object_key, mime_type, size_bytes, owner_id, is_public)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (bucket, object_key) do update
       set mime_type = excluded.mime_type, size_bytes = excluded.size_bytes`,
    [bucket, key, contentType, body.byteLength, opts.ownerId ?? null, opts.isPublic ?? false],
  );
  return key;
}

/** Time-limited URL for a private object. Default 10 minutes, as before. */
export function signedUrl(bucket: Bucket, key: string, expiresInSeconds = 600): Promise<string> {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

/** Stable URL for a public object (product images). */
export function publicUrl(bucket: Bucket, key: string): string {
  const base = (process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "http://localhost:9000")
    .replace(/\/$/, "");
  return `${base}/${bucket}/${key}`;
}

export async function deleteObject(bucket: Bucket, key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  await query(`delete from files where bucket = $1 and object_key = $2`, [bucket, key]);
}
