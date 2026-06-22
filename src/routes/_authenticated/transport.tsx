import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";

export const Route = createFileRoute("/_authenticated/transport")({
  component: TransportPage,
});

function TransportPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [openRoute, setOpenRoute] = useState(false);
  const [openSub, setOpenSub] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: routes = [] } = useQuery({
    queryKey: ["transport_routes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transport_routes").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["transport_subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_subscriptions")
        .select("*, students(first_name,last_name), transport_routes(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id,first_name,last_name")
        .order("last_name");
      return data ?? [];
    },
  });

  async function createRoute(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez d'abord votre école.");
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("transport_routes").insert({
      school_id: schoolId,
      name: String(fd.get("name")),
      driver_name: (fd.get("driver_name") as string) || null,
      driver_phone: (fd.get("driver_phone") as string) || null,
      vehicle_plate: (fd.get("vehicle_plate") as string) || null,
      capacity: Number(fd.get("capacity")) || 0,
      monthly_fee: Number(fd.get("monthly_fee")) || 0,
      description: (fd.get("description") as string) || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Ligne créée");
    setOpenRoute(false);
    qc.invalidateQueries({ queryKey: ["transport_routes"] });
  }

  async function createSub(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez d'abord votre école.");
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("transport_subscriptions").insert({
      school_id: schoolId,
      student_id: String(fd.get("student_id")),
      route_id: String(fd.get("route_id")),
      monthly_amount: Number(fd.get("monthly_amount")) || 0,
      pickup_point: (fd.get("pickup_point") as string) || null,
      start_date: (fd.get("start_date") as string) || new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Abonnement créé");
    setOpenSub(false);
    qc.invalidateQueries({ queryKey: ["transport_subs"] });
  }

  async function removeRoute(id: string) {
    if (!confirm("Supprimer cette ligne ?")) return;
    const { error } = await supabase.from("transport_routes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["transport_routes"] });
  }

  async function removeSub(id: string) {
    if (!confirm("Supprimer cet abonnement ?")) return;
    const { error } = await supabase.from("transport_subscriptions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["transport_subs"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Transport" description="Lignes de bus et abonnements élèves" />
      <Tabs defaultValue="routes">
        <TabsList>
          <TabsTrigger value="routes">Lignes</TabsTrigger>
          <TabsTrigger value="subs">Abonnements</TabsTrigger>
        </TabsList>

        <TabsContent value="routes" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openRoute} onOpenChange={setOpenRoute}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle ligne
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvelle ligne de transport</DialogTitle>
                </DialogHeader>
                <form onSubmit={createRoute} className="space-y-3">
                  <div>
                    <Label>Nom</Label>
                    <Input name="name" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Chauffeur</Label>
                      <Input name="driver_name" />
                    </div>
                    <div>
                      <Label>Téléphone</Label>
                      <Input name="driver_phone" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Immatriculation</Label>
                      <Input name="vehicle_plate" />
                    </div>
                    <div>
                      <Label>Capacité</Label>
                      <Input type="number" name="capacity" />
                    </div>
                  </div>
                  <div>
                    <Label>Tarif mensuel</Label>
                    <Input type="number" step="0.01" name="monthly_fee" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input name="description" />
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
          <Card>
            <CardHeader>
              <CardTitle>Lignes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Chauffeur</TableHead>
                    <TableHead>Véhicule</TableHead>
                    <TableHead>Capacité</TableHead>
                    <TableHead>Tarif</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        {r.driver_name} {r.driver_phone && `· ${r.driver_phone}`}
                      </TableCell>
                      <TableCell>{r.vehicle_plate}</TableCell>
                      <TableCell>{r.capacity}</TableCell>
                      <TableCell>{Number(r.monthly_fee).toLocaleString()} F</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeRoute(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {routes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucune ligne
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subs" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openSub} onOpenChange={setOpenSub}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvel abonnement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Abonnement transport</DialogTitle>
                </DialogHeader>
                <form onSubmit={createSub} className="space-y-3">
                  <div>
                    <Label>Élève</Label>
                    <Select name="student_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.last_name} {s.first_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ligne</Label>
                    <Select name="route_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {routes.map((r: any) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Montant mensuel</Label>
                      <Input type="number" step="0.01" name="monthly_amount" required />
                    </div>
                    <div>
                      <Label>Début</Label>
                      <Input type="date" name="start_date" />
                    </div>
                  </div>
                  <div>
                    <Label>Point d'embarquement</Label>
                    <Input name="pickup_point" />
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
          <Card>
            <CardHeader>
              <CardTitle>Abonnements</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Ligne</TableHead>
                    <TableHead>Point</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Début</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        {s.students?.last_name} {s.students?.first_name}
                      </TableCell>
                      <TableCell>{s.transport_routes?.name}</TableCell>
                      <TableCell>{s.pickup_point}</TableCell>
                      <TableCell>{Number(s.monthly_amount).toLocaleString()} F</TableCell>
                      <TableCell>{s.start_date}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeSub(s.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {subs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucun abonnement
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
