import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const STREAM_TIMEOUT_MS = 10_000;

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('S3_ENDPOINT');

    this.client = new S3Client({
      region: config.get<string>('AWS_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
      requestHandler: { requestTimeout: STREAM_TIMEOUT_MS } as any,
      ...(endpoint && { endpoint, forcePathStyle: true }),
    });

    this.bucket = config.get<string>('S3_BUCKET_NAME')!;
  }

  async uploadContent(key: string, content: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: 'text/plain; charset=utf-8',
      }),
    );
  }

  async downloadContent(key: string): Promise<string> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    const stream = response.Body as Readable;

    return Promise.race([
      new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        stream.on('error', reject);
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`S3 stream timed out after ${STREAM_TIMEOUT_MS}ms`)),
          STREAM_TIMEOUT_MS,
        ),
      ),
    ]);
  }

  async deleteContent(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
