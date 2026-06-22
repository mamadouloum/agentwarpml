import { useMemo, useState } from "react";
import {
  addMonths, addWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, format, isSameMonth, isSameDay, isWithinInterval,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Megaphone, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type AnyEvent = { id: string; title: string; starts_at: string; ends_at?: string | null; location?: string | null };
type Announcement = { id: string; title: string; published_at: string; audience?: string };

interface Props {
  events: AnyEvent[];
  announcements: Announcement[];
}

export function EventsCalendar({ events, announcements }: Props) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date>(new Date());

  const items = useMemo(() => {
    const evs = events.map((e) => ({
      kind: "event" as const, id: e.id, title: e.title,
      start: new Date(e.starts_at), end: e.ends_at ? new Date(e.ends_at) : new Date(e.starts_at),
      location: e.location ?? null,
    }));
    const ann = announcements.map((a) => ({
      kind: "announcement" as const, id: a.id, title: a.title,
      start: new Date(a.published_at), end: new Date(a.published_at),
      audience: a.audience,
    }));
    return [...evs, ...ann];
  }, [events, announcements]);

  function itemsOn(day: Date) {
    return items.filter((it) =>
      isSameDay(it.start, day) ||
      isWithinInterval(day, { start: it.start, end: it.end >= it.start ? it.end : it.start })
    );
  }

  const days = useMemo(() => {
    if (mode === "month") {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
      const arr: Date[] = [];
      for (let d = start; d <= end; d = addDays(d, 1)) arr.push(d);
      return arr;
    }
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor, mode]);

  function shift(dir: -1 | 1) {
    setCursor((c) => (mode === "month" ? addMonths(c, dir) : addWeeks(c, dir)));
  }

  const title = mode === "month"
    ? format(cursor, "MMMM yyyy", { locale: fr })
    : `Sem. du ${format(startOfWeek(cursor, { weekStartsOn: 1 }), "d MMM", { locale: fr })}`;

  const selectedItems = itemsOn(selected);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-display font-semibold text-lg capitalize min-w-[180px] text-center">{title}</div>
          <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => { setCursor(new Date()); setSelected(new Date()); }}>Aujourd'hui</Button>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "month" | "week")}>
          <TabsList>
            <TabsTrigger value="month">Mois</TabsTrigger>
            <TabsTrigger value="week">Semaine</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="text-xs font-medium text-muted-foreground text-center py-1">{d}</div>
            ))}
          </div>
          <div className={cn("grid grid-cols-7 gap-1", mode === "week" && "auto-rows-fr")}>
            {days.map((day) => {
              const dayItems = itemsOn(day);
              const inMonth = mode === "week" || isSameMonth(day, cursor);
              const isToday = isSameDay(day, new Date());
              const isSel = isSameDay(day, selected);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelected(day)}
                  className={cn(
                    "min-h-[80px] rounded-md border p-1.5 text-left transition-colors hover:bg-accent",
                    !inMonth && "opacity-40",
                    isSel && "border-primary ring-1 ring-primary",
                    isToday && !isSel && "bg-accent/50",
                    mode === "week" && "min-h-[140px]",
                  )}
                >
                  <div className={cn("text-xs font-medium mb-1", isToday && "text-primary")}>{format(day, "d")}</div>
                  <div className="space-y-1">
                    {dayItems.slice(0, mode === "week" ? 6 : 3).map((it) => (
                      <div
                        key={it.kind + it.id}
                        className={cn(
                          "text-[10px] leading-tight rounded px-1 py-0.5 truncate flex items-center gap-1",
                          it.kind === "event" ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {it.kind === "event" ? <CalendarDays className="h-2.5 w-2.5 shrink-0" /> : <Megaphone className="h-2.5 w-2.5 shrink-0" />}
                        <span className="truncate">{it.title}</span>
                      </div>
                    ))}
                    {dayItems.length > (mode === "week" ? 6 : 3) && (
                      <div className="text-[10px] text-muted-foreground">+{dayItems.length - (mode === "week" ? 6 : 3)}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="font-display font-semibold capitalize">
          {format(selected, "EEEE d MMMM yyyy", { locale: fr })}
        </h3>
        {selectedItems.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Rien ce jour</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {selectedItems.map((it) => (
              <Card key={it.kind + it.id}>
                <CardContent className="py-3 flex items-start gap-3">
                  <Badge variant={it.kind === "event" ? "default" : "secondary"} className="mt-0.5">
                    {it.kind === "event" ? "Événement" : "Annonce"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{it.title}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-1">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {format(it.start, "HH:mm")}
                        {it.kind === "event" && it.end && !isSameDay(it.start, it.end) && ` → ${format(it.end, "d MMM HH:mm", { locale: fr })}`}
                      </span>
                      {it.kind === "event" && it.location && (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{it.location}</span>
                      )}
                      {it.kind === "announcement" && it.audience && (
                        <Badge variant="outline" className="text-[10px] py-0">{it.audience}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
