import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, MessageSquare, Phone, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [open, setOpen] = useState(false);
  const [broadcast, setBroadcast] = useState("");
  const [search, setSearch] = useState("");

  const { data: messages = [] } = useQuery({
    queryKey: ["messages"],
    queryFn: async () => (await supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-school"],
    queryFn: async () => (await supabase.from("profiles").select("id,first_name,last_name")).data ?? [],
  });
  const { data: students = [] } = useQuery({
    queryKey: ["students-contacts"],
    queryFn: async () => (await supabase.from("students").select("id,first_name,last_name,matricule,parent_name,parent_phone,parent_email,classes(name)").order("last_name")).data ?? [],
  });

  useEffect(() => {
    const channel = supabase
      .channel("messages-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["messages"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez votre école.");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("messages").insert({
      school_id: schoolId,
      sender_id: u.user.id,
      recipient_id: String(fd.get("recipient_id")),
      subject: String(fd.get("subject") || ""),
      body: String(fd.get("body")),
    });
    if (error) return toast.error(error.message);
    toast.success("Message envoyé");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["messages"] });
  }

  function normalizePhone(p: string) {
    return p.replace(/[^0-9+]/g, "").replace(/^\+/, "");
  }

  function whatsappLink(phone?: string | null, text = "") {
    if (!phone) return "#";
    return `https://wa.me/${normalizePhone(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  }

  function broadcastWhatsApp() {
    const list = filtered.filter((s) => s.parent_phone);
    if (!list.length) return toast.error("Aucun parent avec téléphone");
    if (!broadcast) return toast.error("Saisissez un message");
    // Open first; afterwards, copy list of links to clipboard
    const links = list.map((s) => whatsappLink(s.parent_phone, broadcast));
    window.open(links[0], "_blank");
    navigator.clipboard?.writeText(links.join("\n")).catch(() => {});
    toast.success(`${list.length} lien(s) WhatsApp copiés. Premier ouvert.`);
  }

  function broadcastEmail() {
    const emails = filtered.filter((s) => s.parent_email).map((s) => s.parent_email);
    if (!emails.length) return toast.error("Aucun parent avec email");
    const subject = "Information de l'école";
    window.location.href = `mailto:?bcc=${emails.join(",")}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(broadcast)}`;
  }

  const filtered = students.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.first_name?.toLowerCase().includes(q) ||
      s.last_name?.toLowerCase().includes(q) ||
      s.classes?.name?.toLowerCase().includes(q) ||
      s.parent_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messagerie"
        description="Communiquez par message interne, WhatsApp, SMS ou Email."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Message interne</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Envoyer un message</DialogTitle></DialogHeader>
              <form onSubmit={send} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Destinataire</Label>
                  <Select name="recipient_id" required>
                    <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>{profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Objet</Label><Input name="subject" /></div>
                <div className="space-y-1.5"><Label>Message</Label><Textarea name="body" rows={5} required /></div>
                <DialogFooter><Button type="submit">Envoyer</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="parents">
        <TabsList>
          <TabsTrigger value="parents">Parents</TabsTrigger>
          <TabsTrigger value="internal">Messages internes</TabsTrigger>
        </TabsList>

        <TabsContent value="parents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Diffusion rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Tapez votre message à diffuser aux parents..."
                value={broadcast}
                onChange={(e) => setBroadcast(e.target.value)}
                rows={3}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={broadcastWhatsApp} className="bg-[#25D366] hover:bg-[#1ebe5a] text-white">
                  <Send className="h-4 w-4 mr-2" /> Envoyer via WhatsApp
                </Button>
                <Button variant="outline" onClick={broadcastEmail}>
                  <Mail className="h-4 w-4 mr-2" /> Envoyer par Email
                </Button>
                <Input
                  placeholder="Filtrer parents/classes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs ml-auto"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                WhatsApp : ouvre le premier contact et copie tous les liens dans le presse-papier. Email : ouvre votre client mail avec tous les parents en BCC.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contacts parents ({filtered.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.last_name} {s.first_name}</TableCell>
                      <TableCell>{s.classes?.name || "—"}</TableCell>
                      <TableCell>{s.parent_name || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.parent_phone && <div>{s.parent_phone}</div>}
                        {s.parent_email && <div>{s.parent_email}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {s.parent_phone && (
                            <>
                              <Button asChild variant="ghost" size="icon" title="WhatsApp">
                                <a href={whatsappLink(s.parent_phone, broadcast)} target="_blank" rel="noreferrer">
                                  <Send className="h-4 w-4 text-[#25D366]" />
                                </a>
                              </Button>
                              <Button asChild variant="ghost" size="icon" title="SMS">
                                <a href={`sms:${s.parent_phone}${broadcast ? `?body=${encodeURIComponent(broadcast)}` : ""}`}>
                                  <Phone className="h-4 w-4" />
                                </a>
                              </Button>
                            </>
                          )}
                          {s.parent_email && (
                            <Button asChild variant="ghost" size="icon" title="Email">
                              <a href={`mailto:${s.parent_email}?body=${encodeURIComponent(broadcast)}`}>
                                <Mail className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun contact</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="internal">
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-4 divide-y divide-border">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-3">
                  <MessageSquare className="h-8 w-8 opacity-40" />
                  Aucun message pour le moment.
                </div>
              ) : messages.map((m: any) => (
                <div key={m.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-semibold">{m.subject || "(sans objet)"}</div>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{m.body}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(m.created_at).toLocaleString("fr-FR")}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
