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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useCurrentSchool } from "@/hooks/use-current-school";

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
});

function LibraryPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [openBook, setOpenBook] = useState(false);
  const [openLoan, setOpenLoan] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: books = [] } = useQuery({
    queryKey: ["library_books"],
    queryFn: async () => {
      const { data, error } = await supabase.from("library_books").select("*").order("title");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["library_loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_loans")
        .select("*, library_books(title), students(first_name,last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-min"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id,first_name,last_name").order("last_name");
      return data ?? [];
    },
  });

  async function createBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez d'abord votre école.");
    const fd = new FormData(e.currentTarget);
    const qty = Number(fd.get("total_qty")) || 1;
    setSaving(true);
    const { error } = await supabase.from("library_books").insert({
      school_id: schoolId,
      title: String(fd.get("title")),
      author: (fd.get("author") as string) || null,
      isbn: (fd.get("isbn") as string) || null,
      category: (fd.get("category") as string) || null,
      total_qty: qty,
      available_qty: qty,
      shelf: (fd.get("shelf") as string) || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Livre ajouté");
    setOpenBook(false);
    qc.invalidateQueries({ queryKey: ["library_books"] });
  }

  async function createLoan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez d'abord votre école.");
    const fd = new FormData(e.currentTarget);
    const bookId = String(fd.get("book_id"));
    const book = books.find((b: any) => b.id === bookId);
    if (!book || book.available_qty < 1) return toast.error("Livre indisponible");
    setSaving(true);
    const { error } = await supabase.from("library_loans").insert({
      school_id: schoolId,
      book_id: bookId,
      student_id: String(fd.get("student_id")),
      loan_date: (fd.get("loan_date") as string) || new Date().toISOString().slice(0, 10),
      due_date: String(fd.get("due_date")),
    });
    if (!error) {
      await supabase.from("library_books").update({ available_qty: book.available_qty - 1 }).eq("id", bookId);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Emprunt enregistré");
    setOpenLoan(false);
    qc.invalidateQueries({ queryKey: ["library_loans"] });
    qc.invalidateQueries({ queryKey: ["library_books"] });
  }

  async function returnLoan(loan: any) {
    const { error } = await supabase.from("library_loans").update({
      return_date: new Date().toISOString().slice(0, 10),
      status: "returned",
    }).eq("id", loan.id);
    if (error) return toast.error(error.message);
    const book = books.find((b: any) => b.id === loan.book_id);
    if (book) {
      await supabase.from("library_books").update({ available_qty: book.available_qty + 1 }).eq("id", book.id);
    }
    toast.success("Livre retourné");
    qc.invalidateQueries({ queryKey: ["library_loans"] });
    qc.invalidateQueries({ queryKey: ["library_books"] });
  }

  async function removeBook(id: string) {
    if (!confirm("Supprimer ce livre ?")) return;
    const { error } = await supabase.from("library_books").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["library_books"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Bibliothèque" description="Catalogue et emprunts" />
      <Tabs defaultValue="books">
        <TabsList>
          <TabsTrigger value="books">Livres</TabsTrigger>
          <TabsTrigger value="loans">Emprunts</TabsTrigger>
        </TabsList>

        <TabsContent value="books" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openBook} onOpenChange={setOpenBook}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Nouveau livre</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouveau livre</DialogTitle></DialogHeader>
                <form onSubmit={createBook} className="space-y-3">
                  <div><Label>Titre</Label><Input name="title" required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Auteur</Label><Input name="author" /></div>
                    <div><Label>ISBN</Label><Input name="isbn" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Catégorie</Label><Input name="category" /></div>
                    <div><Label>Quantité</Label><Input type="number" name="total_qty" defaultValue={1} required /></div>
                    <div><Label>Étagère</Label><Input name="shelf" /></div>
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
            <CardHeader><CardTitle>Catalogue</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead><TableHead>Auteur</TableHead>
                    <TableHead>Catégorie</TableHead><TableHead>Étagère</TableHead>
                    <TableHead>Stock</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {books.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.title}</TableCell>
                      <TableCell>{b.author}</TableCell>
                      <TableCell>{b.category}</TableCell>
                      <TableCell>{b.shelf}</TableCell>
                      <TableCell><Badge variant={b.available_qty > 0 ? "default" : "secondary"}>{b.available_qty}/{b.total_qty}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeBook(b.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {books.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun livre</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openLoan} onOpenChange={setOpenLoan}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Nouvel emprunt</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouvel emprunt</DialogTitle></DialogHeader>
                <form onSubmit={createLoan} className="space-y-3">
                  <div>
                    <Label>Livre</Label>
                    <Select name="book_id" required>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {books.filter((b: any) => b.available_qty > 0).map((b: any) => (
                          <SelectItem key={b.id} value={b.id}>{b.title} ({b.available_qty} dispo)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Élève</Label>
                    <Select name="student_id" required>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {students.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.last_name} {s.first_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date d'emprunt</Label><Input type="date" name="loan_date" /></div>
                    <div><Label>Date de retour prévue</Label><Input type="date" name="due_date" required /></div>
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
            <CardHeader><CardTitle>Emprunts</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Livre</TableHead><TableHead>Élève</TableHead>
                    <TableHead>Emprunté le</TableHead><TableHead>À rendre</TableHead>
                    <TableHead>Statut</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.library_books?.title}</TableCell>
                      <TableCell>{l.students?.last_name} {l.students?.first_name}</TableCell>
                      <TableCell>{l.loan_date}</TableCell>
                      <TableCell>{l.due_date}</TableCell>
                      <TableCell><Badge variant={l.status === "returned" ? "secondary" : "default"}>{l.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        {l.status !== "returned" && (
                          <Button variant="ghost" size="sm" onClick={() => returnLoan(l)}><Check className="h-4 w-4 mr-1" />Retour</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {loans.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun emprunt</TableCell></TableRow>
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
