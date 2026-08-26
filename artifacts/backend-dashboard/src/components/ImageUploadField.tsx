import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, FileImage, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadImage, validateImageFile, type MediaUploadKind } from "@/lib/upload";

type ImageUploadFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  placeholder?: string;
  previewClassName?: string;
  inputId?: string;
  uploadKind?: MediaUploadKind;
};

/**
 * Reusable admin image field with URL fallback, local preview and upload feedback.
 * The selected file is validated before any network request is sent.
 */
export function ImageUploadField({
  label,
  value,
  onValueChange,
  onUploadingChange,
  placeholder = "https://… ou choisissez une image",
  previewClassName = "h-24 w-full",
  inputId,
  uploadKind = "image",
}: ImageUploadFieldProps) {
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
    const validationError = validateImageFile(file);
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
      const uploadedUrl = await uploadImage(file, uploadKind);
      onValueChange(uploadedUrl);
      clearLocalPreview();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "L'image n'a pas pu être téléversée.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium" htmlFor={inputId}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={value}
          onChange={(event) => {
            setError(null);
            clearLocalPreview();
            onValueChange(event.target.value);
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1"
        />
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Choisir une image depuis l’appareil"
            aria-label={`Choisir une image depuis l’appareil pour ${label}`}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileImage className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isUploading}
            title="Prendre une photo avec la caméra"
            aria-label={`Prendre une photo avec la caméra pour ${label}`}
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
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
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFileSelection(file);
        }}
      />
      {isUploading && <p className="text-xs text-muted-foreground">Téléversement de l’image en cours…</p>}
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Aperçu de l’image"
          className={`${previewClassName} rounded-lg border object-cover`}
          onError={() => setError("Cette image ne peut pas être affichée. Vérifiez son URL ou choisissez un autre fichier.")}
        />
      )}
    </div>
  );
}