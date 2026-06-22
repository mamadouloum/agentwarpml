import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2, BookMarked, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";

export const Route = createFileRoute("/_authenticated/homework")({
  component: HomeworkPage,
});

function HomeworkPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classFilter, setClassFilter] = useState<string>("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["homework", classFilter],
    queryFn: async () => {
      let q = supabase
        .from("homework")
        .select("*, classes(name), subjects(name)")
        .order("due_date", { ascending: true });
      if (classFilter !== "all") q = q.eq("class_id", classFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () =>
      (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-min"],
    queryFn: async () =>
      (await supabase.from("subjects").select("id,name").order("name")).data ?? [],
  });

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez d'abord votre école.");
    const { data: u } = await supabase.auth.getUser();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("homework").insert({
      school_id: schoolId,
      class_id: String(fd.get("class_id")),
      subject_id: (fd.get("subject_id") as string) || null,
      teacher_id: u.user?.id ?? null,
      title: String(fd.get("title")),
      description: (fd.get("description") as string) || null,
      assigned_date: (fd.get("assigned_date") as string) || new Date().toISOString().slice(0, 10),
      due_date: String(fd.get("due_date")),
      attachment_url: (fd.get("attachment_url") as string) || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Devoir enregistré");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["homework"] });
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce devoir ?")) return;
    const { error } = await supabase.from("homework").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["homework"] });
  }

  // Group by due date (cahier de texte chronologique)
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = items.filter((h: any) => h.due_date >= today);
  const past = items.filter((h: any) => h.due_date < today);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devoirs & Cahier de texte"
        description="Suivez les travaux donnés et leurs échéances par classe."
        action={
          <div className="flex gap-2">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classes.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau devoir
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouveau devoir</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div>
                    <Label>Titre</Label>
                    <Input name="title" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Classe</Label>
                      <Select name="class_id" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Matière</Label>
                      <Select name="subject_id">
                        <SelectTrigger>
                          <SelectValue placeholder="Optionnel" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Date d'attribution</Label>
                      <Input type="date" name="assigned_date" />
                    </div>
                    <div>
                      <Label>Date de remise</Label>
                      <Input type="date" name="due_date" required />
                    </div>
                  </div>
                  <div>
                    <Label>Description / Consignes</Label>
                    <Textarea name="description" rows={4} />
                  </div>
                  <div>
                    <Label>Pièce jointe (URL)</Label>
                    <Input name="attachment_url" type="url" placeholder="https://..." />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {isLoading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />À venir ({upcoming.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucun devoir à venir.
                </p>
              )}
              {upcoming.map((h: any) => (
                <HomeworkCard key={h.id} h={h} onDelete={remove} />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookMarked className="h-5 w-5" />
                Historique ({past.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {past.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucun devoir passé.
                </p>
              )}
              {past.slice(0, 30).map((h: any) => (
                <HomeworkCard key={h.id} h={h} onDelete={remove} muted />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function HomeworkCard({
  h,
  onDelete,
  muted,
}: {
  h: any;
  onDelete: (id: string) => void;
  muted?: boolean;
}) {
  const daysLeft = Math.ceil((new Date(h.due_date).getTime() - Date.now()) / 86400000);
  return (
    <div className={`rounded-lg border p-3 ${muted ? "opacity-60" : ""}`}>
      <div className="flex justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{h.title}</h3>
            <Badge variant="outline">{h.classes?.name}</Badge>
            {h.subjects?.name && <Badge variant="secondary">{h.subjects.name}</Badge>}
          </div>
          {h.description && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
              {h.description}
            </p>
          )}
          {h.attachment_url && (
            <a
              href={h.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline mt-1 inline-block"
            >
              Pièce jointe
            </a>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            À remettre le{" "}
            <span className="font-medium text-foreground">
              {new Date(h.due_date).toLocaleDateString("fr-FR")}
            </span>
            {!muted && daysLeft >= 0 && (
              <span className={`ml-2 ${daysLeft <= 2 ? "text-destructive font-medium" : ""}`}>
                ({daysLeft === 0 ? "aujourd'hui" : `dans ${daysLeft} j`})
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onDelete(h.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
