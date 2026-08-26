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
  uploadKind?: Extract<MediaUploadKind, "short">;
};

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== "youtu.be" && host !== "youtube.com" && !host.endsWith(".youtube.com")) return null;
    let videoId = parsed.searchParams.get("v");
    if (parsed.hostname === "youtu.be") videoId = parsed.pathname.slice(1).split("/")[0] ?? null;
    if (parsed.pathname.startsWith("/embed/")) videoId = parsed.pathname.split("/")[2] ?? null;
    if (parsed.pathname.startsWith("/shorts/")) videoId = parsed.pathname.split("/")[2] ?? null;
    return videoId && /^[\w-]{6,}$/.test(videoId)
      ? `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`
      : null;
  } catch {
    return null;
  }
}

/** Local video picker with immediate playback preview for admin Shorts. */
export function VideoUploadField({
  label,
  value,
  onValueChange,
  onUploadingChange,
  uploadKind = "short",
}: VideoUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = localPreviewUrl ?? value;

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
          value={value}
          onChange={(event) => {
            setError(null);
            clearLocalPreview();
            onValueChange(event.target.value);
          }}
          placeholder="https://… ou choisissez une vidéo"
          className="min-w-0 flex-1"
        />
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Choisir une vidéo depuis l’appareil"
            aria-label={`Choisir une vidéo depuis l’appareil pour ${label}`}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileVideo className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isUploading}
            title="Filmer une vidéo avec la caméra"
            aria-label={`Filmer une vidéo avec la caméra pour ${label}`}
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.m4v,.3gp,.3g2"
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
          <video className="h-44 w-full rounded-lg border bg-black object-cover" controls muted playsInline preload="metadata">
            <source src={previewUrl} />
            Votre navigateur ne peut pas lire cette vidéo.
          </video>
        )
      )}
    </div>
  );
}