import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

if (!process.env.AWS_REGION || 
    !process.env.AWS_ACCESS_KEY_ID || 
    !process.env.AWS_SECRET_ACCESS_KEY || 
    !process.env.AWS_BUCKET_NAME) {
  throw new Error("Missing required AWS environment variables");
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const bucketName = process.env.AWS_BUCKET_NAME;

export const uploadToS3 = async (originalFileName: string, fileBuffer: Buffer) => {
  // Generate unique file name to prevent overwriting
  const uniqueKey = `${randomUUID()}-${originalFileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: uniqueKey,
    Body: fileBuffer,
    ContentType: "application/octet-stream"
  });

  await s3.send(command);

  return {
    key: uniqueKey,
    url: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueKey}`
  };
};

export const deleteFromS3 = async (key: string) => {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  await s3.send(command);
};