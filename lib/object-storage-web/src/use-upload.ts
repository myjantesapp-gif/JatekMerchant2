import { useState, useCallback } from "react";

interface UploadResponse {
  url: string;
  contentType: string;
}

interface UseUploadOptions {
  basePath?: string;
  mediaKind?: "image" | "logo" | "banner" | "media" | "short";
  getRequestHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

export function useUpload(options: UseUploadOptions = {}) {
  const basePath = options.basePath ?? "/api/storage";
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        const extraHeaders = options.getRequestHeaders
          ? await options.getRequestHeaders()
          : {};

        if (
          !file.type.startsWith("image/") &&
          file.type !== "" &&
          file.type !== "application/octet-stream"
        ) {
          throw new Error("Only image files can be uploaded.");
        }

        setProgress(10);
        const uploadRes = await fetch(`${basePath}/uploads/image`, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            ...(options.mediaKind ? { "X-Jatek-Media-Kind": options.mediaKind } : {}),
            ...extraHeaders,
          },
          body: file,
        });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to upload image");
        }
        const upload: UploadResponse = await uploadRes.json();

        setProgress(100);
        options.onSuccess?.(upload);
        return upload;
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Upload failed");
        setError(e);
        options.onError?.(e);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [basePath, options]
  );

  return { uploadFile, isUploading, error, progress };
}
