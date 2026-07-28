import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PHOTO_MAX = 2;
export const PHOTO_MAX_SIZE = 5 * 1024 * 1024;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const GENERIC_DELETE_ERROR = "La suppression de la photo a échoué. Réessayez.";

function formatSize(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
}

type ItemState = "uploading" | "ready" | "error" | "deleting";

interface Item {
  key: string;
  file: File;
  url: string;
  state: ItemState;
  /** Server id — only set once the upload is confirmed. */
  id: string | null;
  error: string | null;
}

export interface PhotoUploaderProps {
  requestType: "quote" | "appointment";
  uploadSessionId: string;
  onStatusChange?: (status: {
    uploading: boolean;
    uploaded: boolean;
    count: number;
    error: string | null;
  }) => void;
}

/**
 * Client-side photo picker. Each file is uploaded immediately to a temporary
 * server-side location; nothing is considered attached until the server
 * confirms it at form submission time.
 */
export function PhotoUploader({ uploadSessionId, onStatusChange }: PhotoUploaderProps) {
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const emit = useCallback(
    (list: Item[], err: string | null) => {
      const uploading = list.some((i) => i.state === "uploading" || i.state === "deleting");
      const readyCount = list.filter((i) => i.state === "ready").length;
      onStatusChange?.({
        uploading,
        uploaded: readyCount > 0 && !uploading,
        count: readyCount,
        error: err,
      });
    },
    [onStatusChange],
  );

  const update = useCallback(
    (updater: (prev: Item[]) => Item[], err?: string | null) => {
      setItems((prev) => {
        const next = updater(prev);
        emit(next, err === undefined ? null : err);
        return next;
      });
    },
    [emit],
  );

  const validate = (file: File): string | null => {
    if (file.size === 0) return "Ce fichier est vide.";
    if (file.size > PHOTO_MAX_SIZE) return `« ${file.name} » dépasse 5 Mo.`;
    if (!ALLOWED.has(file.type)) return "Format non supporté (JPEG, PNG ou WebP uniquement).";
    return null;
  };

  const uploadOne = useCallback(
    async (item: Item) => {
      try {
        const fd = new FormData();
        fd.append("upload_session_id", uploadSessionId);
        fd.append("files", item.file, item.file.name);
        const res = await fetch("/api/attachments/upload", { method: "POST", body: fd });
        const json = (await res.json().catch(() => null)) as
          | { error?: string; files?: Array<{ id: string }> }
          | null;
        if (!res.ok || !json?.files?.[0]?.id) {
          throw new Error(json?.error || "L'envoi de la photo a échoué.");
        }
        const id = json.files[0].id;
        update((prev) =>
          prev.map((i) => (i.key === item.key ? { ...i, state: "ready", id, error: null } : i)),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur d'envoi.";
        setError(msg);
        update(
          (prev) => prev.map((i) => (i.key === item.key ? { ...i, state: "error", error: msg } : i)),
          msg,
        );
      }
    },
    [update, uploadSessionId],
  );

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (list.length === 0) return;

    const live = itemsRef.current.filter((i) => i.state !== "error");
    if (live.length + list.length > PHOTO_MAX) {
      const msg = `${PHOTO_MAX} photos maximum.`;
      setError(msg);
      emit(itemsRef.current, msg);
      return;
    }
    for (const f of list) {
      const err = validate(f);
      if (err) {
        setError(err);
        emit(itemsRef.current, err);
        return;
      }
    }

    setError(null);
    const added: Item[] = list.map((f) => ({
      key: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      url: URL.createObjectURL(f),
      state: "uploading",
      id: null,
      error: null,
    }));
    update((prev) => [...prev, ...added]);
    for (const item of added) await uploadOne(item);
  };

  const retry = async (key: string) => {
    const item = itemsRef.current.find((i) => i.key === key);
    if (!item) return;
    setError(null);
    update((prev) =>
      prev.map((i) => (i.key === key ? { ...i, state: "uploading", error: null } : i)),
    );
    await uploadOne({ ...item, state: "uploading" });
  };

  const removeItem = async (key: string) => {
    const item = itemsRef.current.find((i) => i.key === key);
    if (!item || item.state === "deleting" || item.state === "uploading") return;
    setError(null);

    // Never uploaded (or failed): drop locally, nothing on the server.
    if (!item.id) {
      URL.revokeObjectURL(item.url);
      update((prev) => prev.filter((i) => i.key !== key));
      return;
    }

    update((prev) => prev.map((i) => (i.key === key ? { ...i, state: "deleting" } : i)));
    try {
      const res = await fetch("/api/attachments/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_session_id: uploadSessionId, file_id: item.id }),
      });
      if (!res.ok) throw new Error(GENERIC_DELETE_ERROR);
      URL.revokeObjectURL(item.url);
      update((prev) => prev.filter((i) => i.key !== key));
    } catch {
      // Keep the preview: the file is still there server-side.
      setError(GENERIC_DELETE_ERROR);
      update(
        (prev) => prev.map((i) => (i.key === key ? { ...i, state: "ready" } : i)),
        GENERIC_DELETE_ERROR,
      );
    }
  };

  const removeAll = async () => {
    for (const item of [...itemsRef.current]) {
      await removeItem(item.key);
    }
  };

  // Opportunistic cleanup when the visitor leaves. Best-effort only: the
  // scheduled server-side purge is the real guarantee.
  useEffect(() => {
    const onPageHide = () => {
      const hasTemp = itemsRef.current.some((i) => i.id);
      if (!hasTemp) return;
      try {
        fetch("/api/attachments/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upload_session_id: uploadSessionId }),
          keepalive: true,
        }).catch(() => undefined);
      } catch {
        // ignore — purge will reclaim the files
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [uploadSessionId]);

  const busy = items.some((i) => i.state === "uploading" || i.state === "deleting");
  const readyCount = items.filter((i) => i.state === "ready").length;

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
          disabled={busy}
          className="sr-only"
          aria-invalid={!!error}
        />
        {items.length === 0 ? (
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
              {items.map((item, i) => (
                <div
                  key={item.key}
                  className="relative overflow-hidden rounded-lg border border-border/60 bg-background"
                >
                  <img
                    src={item.url}
                    alt={`Aperçu photo ${i + 1} — ${item.file.name}`}
                    className="h-32 w-full object-cover"
                    loading="lazy"
                  />
                  <div className="border-t border-border/40 bg-card px-2 py-1.5">
                    <p className="truncate text-xs font-medium text-foreground">{item.file.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatSize(item.file.size)}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium">
                        {item.state === "uploading" && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Envoi…
                          </span>
                        )}
                        {item.state === "deleting" && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Suppression…
                          </span>
                        )}
                        {item.state === "ready" && <span className="text-green-700">✓ Prête</span>}
                        {item.state === "error" && (
                          <span className="text-destructive">Échec de l'envoi</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        {item.state === "error" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => retry(item.key)}
                            aria-label={`Réessayer l'envoi de ${item.file.name}`}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => removeItem(item.key)}
                          disabled={item.state === "uploading" || item.state === "deleting"}
                          aria-label={`Retirer ${item.file.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium">
                {busy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Traitement en cours…
                  </>
                ) : readyCount > 0 ? (
                  <span className="text-green-700">
                    ✓ {readyCount} photo{readyCount > 1 ? "s" : ""} prête
                    {readyCount > 1 ? "s" : ""} à être envoyée{readyCount > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">En attente</span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeAll}
                disabled={busy}
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
