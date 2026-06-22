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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2, Megaphone, CalendarDays, MapPin, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";
import { EventsCalendar } from "@/components/events-calendar";

export const Route = createFileRoute("/_authenticated/events")({
  component: EventsPage,
});

function EventsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Annonces & Événements"
        description="Communication interne et calendrier de l'école"
      />
      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Calendrier
          </TabsTrigger>
          <TabsTrigger value="announcements">
            <Megaphone className="h-4 w-4 mr-2" />
            Annonces
          </TabsTrigger>
          <TabsTrigger value="events">
            <CalendarDays className="h-4 w-4 mr-2" />
            Événements
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="mt-6">
          <CalendarView />
        </TabsContent>
        <TabsContent value="announcements" className="mt-6">
          <Announcements />
        </TabsContent>
        <TabsContent value="events" className="mt-6">
          <Events />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CalendarView() {
  const { data: events = [], isLoading: l1 } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
  const { data: announcements = [], isLoading: l2 } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  if (l1 || l2)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  return <EventsCalendar events={events as any} announcements={announcements as any} />;
}

function Announcements() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("École introuvable");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("announcements").insert({
      school_id: schoolId,
      author_id: u.user?.id,
      title: String(fd.get("title")),
      content: String(fd.get("content")),
      audience: String(fd.get("audience") || "all"),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Annonce publiée");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  async function onDelete(id: string) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimée");
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle annonce
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={onCreate} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Publier une annonce</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input name="title" required />
              </div>
              <div className="space-y-2">
                <Label>Contenu</Label>
                <Textarea name="content" rows={5} required />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Input
                  name="audience"
                  defaultValue="all"
                  placeholder="all, parents, enseignants…"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Publier
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune annonce
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-lg">{a.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{a.audience}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.published_at).toLocaleString("fr-FR")}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDelete(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{a.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Events() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("École introuvable");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("events").insert({
      school_id: schoolId,
      title: String(fd.get("title")),
      description: String(fd.get("description") || "") || null,
      location: String(fd.get("location") || "") || null,
      starts_at: new Date(String(fd.get("starts_at"))).toISOString(),
      ends_at: fd.get("ends_at") ? new Date(String(fd.get("ends_at"))).toISOString() : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Événement créé");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["events"] });
  }

  async function onDelete(id: string) {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé");
    qc.invalidateQueries({ queryKey: ["events"] });
  }

  const now = Date.now();
  const upcoming = items.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = items.filter((e) => new Date(e.starts_at).getTime() < now);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel événement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={onCreate} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Créer un événement</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input name="title" required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea name="description" rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Lieu</Label>
                <Input name="location" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Début</Label>
                  <Input name="starts_at" type="datetime-local" required />
                </div>
                <div className="space-y-2">
                  <Label>Fin</Label>
                  <Input name="ends_at" type="datetime-local" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <EventList title="À venir" items={upcoming} onDelete={onDelete} />
          <EventList title="Passés" items={past} onDelete={onDelete} muted />
        </div>
      )}
    </div>
  );
}

function EventList({
  title,
  items,
  onDelete,
  muted,
}: {
  title: string;
  items: any[];
  onDelete: (id: string) => void;
  muted?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-display font-semibold text-lg">{title}</h3>
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aucun événement
          </CardContent>
        </Card>
      ) : (
        items.map((ev) => (
          <Card key={ev.id} className={muted ? "opacity-70" : ""}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
              <CardTitle className="text-base">{ev.title}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => onDelete(ev.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {new Date(ev.starts_at).toLocaleString("fr-FR")}
                {ev.ends_at && <> → {new Date(ev.ends_at).toLocaleString("fr-FR")}</>}
              </div>
              {ev.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {ev.location}
                </div>
              )}
              {ev.description && <p className="whitespace-pre-wrap">{ev.description}</p>}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
