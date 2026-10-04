import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3'

const BUCKET = process.env.STORAGE_BUCKET ?? "recordings"

const s3 = new S3Client({
  endpoint: process.env.STORAGE_ENDPOINT ?? "http://localhost:9000",
  region: process.env.STORAGE_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? 'harbor',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? "harbor-local-dev"
  }
})

let bucketEnsured = false

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return

  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }))
  }

  bucketEnsured = true
}

export async function uploadChunk(
  sessionId: string,
  index: number,
  blob: Blob
): Promise<{ key: string }> {
  await ensureBucket()

  const key = `${sessionId}/${String(index).padStart(6, "0")}.webm`
  const body = new Uint8Array(await blob.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "video/webm"
    })
  )

  return { key }
}
