import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { toDatetimeLocal } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type EventRow = Tables<"events">;

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: EventRow | null;
  onSaved: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const location = String(form.get("location") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const startsAt = String(form.get("starts_at") ?? "");
    const mayorPresent = form.get("mayor_present") === "on";

    if (!title || !location || !startsAt) {
      toast.error("Titre, lieu et date sont obligatoires.");
      return;
    }

    setSaving(true);
    try {
      let attachmentPath = event?.attachment_path ?? null;
      let attachmentName = event?.attachment_name ?? null;

      if (file) {
        if (file.size > 15 * 1024 * 1024) {
          throw new Error("La pièce jointe ne doit pas dépasser 15 Mo.");
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("ird-attachments")
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        attachmentPath = path;
        attachmentName = file.name;
      }

      const payload = {
        title,
        location,
        description: description || null,
        starts_at: new Date(startsAt).toISOString(),
        mayor_present: mayorPresent,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
      };

      if (event) {
        const { error } = await supabase.from("events").update(payload).eq("id", event.id);
        if (error) throw error;
        toast.success("IRD mis à jour.");
        onSaved(event.id);
      } else {
        const { data: user } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("events")
          .insert({ ...payload, created_by: user.user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        toast.success("IRD créé.");
        onSaved(data.id);
      }
      setFile(null);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {event ? "Modifier l'IRD" : "Nouvel IRD"}
          </DialogTitle>
          <DialogDescription>
            Renseignez les informations transmises aux élus dans l'invitation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" defaultValue={event?.title ?? ""} maxLength={160} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Lieu</Label>
            <Input
              id="location"
              name="location"
              defaultValue={event?.location ?? ""}
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="starts_at">Date et heure</Label>
            <Input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              defaultValue={event ? toDatetimeLocal(event.starts_at) : ""}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (facultative)</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={event?.description ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attachment">Pièce jointe</Label>
            <Input
              id="attachment"
              type="file"
              accept=".pdf,.doc,.docx,.odt,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {event?.attachment_name && !file && (
              <p className="text-xs text-muted-foreground">
                Fichier actuel : {event.attachment_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 rounded border bg-secondary/60 p-3">
            <Checkbox
              id="mayor_present"
              name="mayor_present"
              defaultChecked={event?.mayor_present ?? false}
            />
            <Label htmlFor="mayor_present" className="cursor-pointer font-normal">
              Le maire sera présent
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
