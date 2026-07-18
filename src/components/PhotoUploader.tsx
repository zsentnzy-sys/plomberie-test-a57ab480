import { useCallback, useId, useRef, useState } from "react";
import { Camera, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PHOTO_MAX = 2;
export const PHOTO_MAX_SIZE = 5 * 1024 * 1024;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function formatSize(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
}

interface Preview {
  file: File;
  url: string;
}

export interface PhotoUploaderProps {
  requestType: "quote" | "appointment";
  uploadToken: string;
  onStatusChange?: (status: {
    uploading: boolean;
    uploaded: boolean;
    count: number;
    error: string | null;
  }) => void;
}

/** Client-side photo picker for request forms. Uploads on selection so the
 * submit path stays simple: form only needs to send the upload_token. */
export function PhotoUploader({ requestType, uploadToken, onStatusChange }: PhotoUploaderProps) {
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emit = useCallback(
    (next: { uploading: boolean; uploaded: boolean; count: number; error: string | null }) => {
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  const validate = (files: File[]): string | null => {
    if (files.length > PHOTO_MAX) return `${PHOTO_MAX} photos maximum.`;
    for (const f of files) {
      if (f.size === 0) return "Un fichier est vide.";
      if (f.size > PHOTO_MAX_SIZE) return `« ${f.name} » dépasse 5 Mo.`;
      if (!ALLOWED.has(f.type)) return `Format non supporté (JPEG, PNG ou WebP uniquement).`;
    }
    return null;
  };

  const upload = async (files: File[]) => {
    setError(null);
    setUploading(true);
    emit({ uploading: true, uploaded: false, count: files.length, error: null });
    try {
      const fd = new FormData();
      fd.append("upload_token", uploadToken);
      fd.append("request_type", requestType);
      for (const f of files) fd.append("files", f, f.name);
      const res = await fetch("/api/attachments/upload", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(json?.error || "L'envoi des photos a échoué.");
      }
      setUploaded(true);
      emit({ uploading: false, uploaded: true, count: files.length, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur d'envoi.";
      setError(msg);
      setUploaded(false);
      // Revoke previews on failure
      for (const p of previews) URL.revokeObjectURL(p.url);
      setPreviews([]);
      if (inputRef.current) inputRef.current.value = "";
      emit({ uploading: false, uploaded: false, count: 0, error: msg });
    } finally {
      setUploading(false);
    }
  };

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    if (list.length === 0) return;
    const err = validate(list);
    if (err) {
      setError(err);
      e.target.value = "";
      emit({ uploading: false, uploaded: false, count: 0, error: err });
      return;
    }
    // Revoke any previous previews
    for (const p of previews) URL.revokeObjectURL(p.url);
    const next = list.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setPreviews(next);
    await upload(list);
  };

  const removeAll = () => {
    for (const p of previews) URL.revokeObjectURL(p.url);
    setPreviews([]);
    setUploaded(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    emit({ uploading: false, uploaded: false, count: 0, error: null });
  };

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl border-2 border-dashed border-border/60 bg-muted/20 p-5 transition-colors hover:border-accent/50"
        aria-describedby={`${helpId} ${error ? errorId : ""}`.trim()}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={PHOTO_ACCEPT}
          multiple
          onChange={onChange}
          disabled={uploading}
          className="sr-only"
          aria-invalid={!!error}
        />
        {previews.length === 0 ? (
          <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 py-4 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
              <UploadCloud className="h-6 w-6" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Ajouter des photos (facultatif)
            </p>
            <p className="text-xs text-muted-foreground">
              Cliquez pour sélectionner depuis votre appareil ou votre galerie.
            </p>
          </label>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {previews.map((p, i) => (
                <div key={p.url} className="relative overflow-hidden rounded-lg border border-border/60 bg-background">
                  <img
                    src={p.url}
                    alt={`Aperçu photo ${i + 1} — ${p.file.name}`}
                    className="h-32 w-full object-cover"
                    loading="lazy"
                  />
                  <div className="border-t border-border/40 bg-card px-2 py-1.5">
                    <p className="truncate text-xs font-medium text-foreground">{p.file.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatSize(p.file.size)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium">
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Envoi en cours…
                  </>
                ) : uploaded ? (
                  <span className="text-green-700">✓ Photos prêtes à être envoyées</span>
                ) : (
                  <span className="text-muted-foreground">En attente</span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeAll}
                disabled={uploading}
                aria-label="Supprimer les photos sélectionnées"
              >
                <Trash2 className="mr-1 h-4 w-4" /> Tout retirer
              </Button>
            </div>
          </div>
        )}
      </div>
      <p id={helpId} className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          2 photos maximum · 5 Mo par photo · JPEG, PNG ou WebP. N'incluez pas de document
          d'identité ou d'information sensible.
        </span>
      </p>
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}