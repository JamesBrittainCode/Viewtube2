'use client';

import * as tus from 'tus-js-client';

type ResumableUploadInput = {
  file: File;
  bucket: string;
  objectPath: string;
  accessToken: string;
  onProgress?: (percent: number) => void;
};

export async function uploadResumableToSupabase({
  file,
  bucket,
  objectPath,
  accessToken,
  onProgress,
}: ResumableUploadInput): Promise<void> {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!projectUrl || !anonKey) {
    throw new Error('Supabase URL/Anon key is missing in environment variables.');
  }

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${projectUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: bucket,
        objectName: objectPath,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        'x-upsert': 'false',
      },
      onError: (error) => reject(error),
      onProgress: (uploaded, total) => {
        if (!total) return;
        onProgress?.(Math.round((uploaded / total) * 100));
      },
      onSuccess: () => resolve(),
    });

    upload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      })
      .catch((error) => reject(error));
  });
}
