import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, FileVideo, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadVideo, validateVideoFile, type MediaUploadKind } from "@/lib/upload";

type VideoUploadFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  uploadKind?: Extract<MediaUploadKind, "short" | "splash">;
  disabled?: boolean;
};

function normalizeCandidate(url: string): string {
  const value = url.trim();
  return /^(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(value) ? `https://${value}` : value;
}

export function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(normalizeCandidate(url));
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "youtu.be" && host !== "youtube.com" && !host.endsWith(".youtube.com")) return null;
    let videoId = parsed.searchParams.get("v");
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (host === "youtu.be") videoId = segments[0] ?? null;
    if (["embed", "shorts", "live"].includes(segments[0]?.toLowerCase() ?? "")) videoId = segments[1] ?? null;
    return videoId && /^[\w-]{11}$/.test(videoId)
      ? `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`
      : null;
  } catch {
    return null;
  }
}

export function isValidVideoSource(url: string): boolean {
  const value = url.trim();
  if (!value) return true;
  if (getYouTubeEmbedUrl(value)) return true;
  if (/^(?:\/api\/storage\/objects\/|\/objects\/|uploads\/|\/uploads\/)/.test(value)) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidSplashVideoSource(url: string): boolean {
  const value = url.trim();
  if (!value) return true;
  if (/^\/api\/storage\/objects\/splash\/[a-zA-Z0-9_-]+(?:\.mp4)?(?:\?[^#]*)?$/.test(value)) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      && (/\.mp4$/i.test(parsed.pathname)
        || /^\/api\/storage\/objects\/splash\/[a-zA-Z0-9_-]+(?:\.mp4)?$/.test(parsed.pathname));
  } catch {
    return false;
  }
}

/** Local video picker with immediate playback preview for admin Shorts. */
export function VideoUploadField({
  label,
  value,
  onValueChange,
  onUploadingChange,
  uploadKind = "short",
  disabled = false,
}: VideoUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = localPreviewUrl ?? value;
  const isDisabled = disabled || isUploading;

  const clearLocalPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setLocalPreviewUrl(null);
  };

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const setUploading = (next: boolean) => {
    setIsUploading(next);
    onUploadingChange?.(next);
  };

  const handleFileSelection = async (file: File) => {
    if (disabled || isUploading) return;
    if (uploadKind === "splash" && file.type !== "video/mp4" && !/\.mp4$/i.test(file.name)) {
      setError("Choisissez une vidéo MP4 pour l’intro.");
      return;
    }
    const validationError = validateVideoFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    clearLocalPreview();
    const nextPreview = URL.createObjectURL(file);
    previewUrlRef.current = nextPreview;
    setLocalPreviewUrl(nextPreview);
    setError(null);
    setUploading(true);

    try {
      onValueChange(await uploadVideo(file, uploadKind));
      clearLocalPreview();
    } catch (uploadError) {
      clearLocalPreview();
      setError(uploadError instanceof Error ? uploadError.message : "La vidéo n'a pas pu être téléversée.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex gap-2">
        <Input
          disabled={isDisabled}
          value={value}
          onChange={(event) => {
            setError(null);
            clearLocalPreview();
            onValueChange(event.target.value);
          }}
          onBlur={(event) => {
            const isValid = uploadKind === "splash"
              ? isValidSplashVideoSource(event.target.value)
              : isValidVideoSource(event.target.value);
            if (!isValid) {
              setError(uploadKind === "splash"
                ? "Saisissez une URL HTTPS directe vers un MP4 ou un chemin App Storage de démarrage."
                : "Saisissez une URL YouTube valide ou un chemin vidéo App Storage.");
            }
          }}
          placeholder={uploadKind === "splash" ? "https://…/intro.mp4 ou choisissez un MP4" : "https://… ou choisissez une vidéo"}
          className="min-w-0 flex-1"
        />
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            title="Choisir une vidéo depuis l’appareil"
            aria-label={`Choisir une vidéo depuis l’appareil pour ${label}`}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileVideo className="h-4 w-4" />}
          </Button>
          {uploadKind !== "splash" && <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isDisabled}
            title="Filmer une vidéo avec la caméra"
            aria-label={`Filmer une vidéo avec la caméra pour ${label}`}
          >
            <Camera className="h-4 w-4" />
          </Button>}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        disabled={isDisabled}
        accept={uploadKind === "splash" ? "video/mp4,.mp4" : "video/*,.mp4,.webm,.mov,.m4v,.3gp,.3g2"}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFileSelection(file);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        disabled={isDisabled}
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFileSelection(file);
        }}
      />
      {isUploading && <p className="text-xs text-muted-foreground">Téléversement de la vidéo en cours…</p>}
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
      {previewUrl && (
        getYouTubeEmbedUrl(previewUrl) ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg border bg-black">
            <iframe
              src={getYouTubeEmbedUrl(previewUrl) ?? undefined}
              title="Aperçu de la vidéo YouTube"
              className="h-full w-full"
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <video
            key={previewUrl}
            className="h-44 w-full rounded-lg border bg-black object-cover"
            controls
            muted
            playsInline
            preload="metadata"
            onError={() => setError("Cette vidéo ne peut pas être lue. Vérifiez que le fichier est encore disponible dans App Storage.")}
          >
            <source src={previewUrl} />
            Votre navigateur ne peut pas lire cette vidéo.
          </video>
        )
      )}
    </div>
  );
}