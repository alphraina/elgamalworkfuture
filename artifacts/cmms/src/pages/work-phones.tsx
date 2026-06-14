import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Smartphone, Edit2, Trash2, Scan, Palette, Download, Upload, FileSpreadsheet } from "lucide-react";
import { Button, Input, Label, Badge } from "@/components/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { QRScanner } from "@/components/qr-scanner";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { WorkPhone } from "@workspace/api-client-react";
import * as XLSX from "xlsx";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PHONE_COLORS = [
  { value: "black", label: "Black", class: "bg-gray-900" },
  { value: "white", label: "White", class: "bg-gray-100 border border-gray-300" },
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "green", label: "Green", class: "bg-green-500" },
  { value: "red", label: "Red", class: "bg-red-500" },
  { value: "gold", label: "Gold", class: "bg-yellow-400" },
  { value: "silver", label: "Silver", class: "bg-gray-400" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "pink", label: "Pink", class: "bg-pink-400" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "brown", label: "Brown", class: "bg-amber-800" },
];

function getColorClass(color?: string | null) {
  return PHONE_COLORS.find(c => c.value === color)?.class ?? "bg-gray-500";
}

const emptyForm = { workId: "", name: "", phoneColor: "", phoneNumber: "", pcbaNumber: "" };

function exportToExcel(phones: WorkPhone[], filename: string) {
  const data = phones.map(p => ({
    "Work ID": p.workId,
    "Name": p.name,
    "Phone Color": p.phoneColor ?? "",
    "Phone Number": p.phoneNumber ?? "",
    "PCBA Number": p.pcbaNumber ?? "",
    "Added By": p.createdByName ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Work Phones");
  XLSX.writeFile(wb, filename);
}

function downloadTemplate() {
  const data = [
    { "Work ID": "WP-001", "Name": "John Smith", "Phone Color": "black", "Phone Number": "SN123456", "PCBA Number": "PCBA-ABC123" },
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Work Phones");
  XLSX.writeFile(wb, "work_phones_template.xlsx");
}

export default function WorkPhones() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isAdmin, isManager, isTeamLeader, isInventory } = useAuth();

  const canManage = isAdmin || isManager || isTeamLeader || isInventory;
  const canDelete = isAdmin || isManager;

  const [phones, setPhones] = useState<WorkPhone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterColor, setFilterColor] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<null | { rows: { workId: string; name: string; phoneColor: string; phoneNumber: string; pcbaNumber: string }[]; filename: string }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/work-phones`, { credentials: "include" });
      if (r.ok) setPhones(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = phones;
    if (filterColor) list = list.filter(p => p.phoneColor === filterColor);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.workId.toLowerCase().includes(q) ||
        (p.phoneNumber ?? "").toLowerCase().includes(q) ||
        (p.pcbaNumber ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [phones, search, filterColor]);

  function openAdd() {
    setEditId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  }

  function openEdit(p: WorkPhone) {
    setEditId(p.id);
    setForm({
      workId: p.workId,
      name: p.name,
      phoneColor: p.phoneColor ?? "",
      phoneNumber: p.phoneNumber ?? "",
      pcbaNumber: p.pcbaNumber ?? "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.workId.trim() || !form.name.trim()) {
      toast({ title: t("workPhones.errorRequired"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = editId ? `${BASE}/api/work-phones/${editId}` : `${BASE}/api/work-phones`;
      const r = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const e = await r.json();
        toast({ title: e.error ?? t("common.error"), variant: "destructive" });
        return;
      }
      toast({ title: editId ? t("workPhones.updated") : t("workPhones.added") });
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!deleteId) return;
    const r = await fetch(`${BASE}/api/work-phones/${deleteId}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      toast({ title: t("workPhones.deleted") });
      setDeleteId(null);
      await load();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        const parsed = rawRows.map(row => ({
          workId: String(row["Work ID"] ?? row["workId"] ?? row["work_id"] ?? "").trim(),
          name: String(row["Name"] ?? row["name"] ?? "").trim(),
          phoneColor: String(row["Phone Color"] ?? row["phoneColor"] ?? row["phone_color"] ?? "").trim().toLowerCase(),
          phoneNumber: String(row["Phone Number"] ?? row["phoneNumber"] ?? row["phone_number"] ?? "").trim(),
          pcbaNumber: String(row["PCBA Number"] ?? row["pcbaNumber"] ?? row["pcba_number"] ?? "").trim(),
        }));
        setImportPreview({ rows: parsed, filename: file.name });
      } catch {
        toast({ title: t("workPhones.importParseError"), variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  async function confirmImport() {
    if (!importPreview) return;
    setImporting(true);
    try {
      const r = await fetch(`${BASE}/api/work-phones/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(importPreview.rows),
      });
      const result = await r.json();
      if (!r.ok) {
        toast({ title: result.error ?? t("common.error"), variant: "destructive" });
        return;
      }
      toast({
        title: t("workPhones.importSuccess", { inserted: result.inserted, skipped: result.skipped }),
      });
      setImportPreview(null);
      await load();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-primary" />
            {t("workPhones.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("workPhones.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => exportToExcel(filtered, `work_phones_${new Date().toISOString().slice(0, 10)}.xlsx`)}
          >
            <Download className="w-4 h-4" />
            {t("workPhones.export")}
          </Button>

          {/* Template */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={downloadTemplate}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t("workPhones.template")}
          </Button>

          {/* Import */}
          {canManage && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                {t("workPhones.import")}
              </Button>
            </>
          )}

          {/* Add */}
          {canManage && (
            <Button onClick={openAdd} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              {t("workPhones.add")}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("workPhones.searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Palette className="w-3.5 h-3.5" />{t("workPhones.filterColor")}:</span>
          <button
            onClick={() => setFilterColor("")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${!filterColor ? "bg-primary text-primary-foreground border-primary" : "border-white/20 text-muted-foreground hover:border-white/40"}`}
          >
            {t("common.all")}
          </button>
          {PHONE_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setFilterColor(filterColor === c.value ? "" : c.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterColor === c.value ? "bg-primary/20 border-primary text-primary" : "border-white/20 text-muted-foreground hover:border-white/40"}`}
            >
              <span className={`w-3 h-3 rounded-full inline-block ${c.class}`} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card/60 border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-primary">{phones.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("workPhones.totalRecords")}</p>
        </div>
        <div className="bg-card/60 border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{filtered.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("workPhones.filteredRecords")}</p>
        </div>
        <div className="bg-card/60 border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">
            {new Set(phones.map(p => p.phoneNumber).filter(Boolean)).size}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("workPhones.uniquePhones")}</p>
        </div>
        <div className="bg-card/60 border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">
            {new Set(phones.map(p => p.pcbaNumber).filter(Boolean)).size}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("workPhones.uniquePCBA")}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-card/80 hover:bg-card/80">
                <TableHead>{t("workPhones.workId")}</TableHead>
                <TableHead>{t("workPhones.name")}</TableHead>
                <TableHead>{t("workPhones.phoneColor")}</TableHead>
                <TableHead>{t("workPhones.phoneNumber")}</TableHead>
                <TableHead>{t("workPhones.pcbaNumber")}</TableHead>
                <TableHead>{t("workPhones.addedBy")}</TableHead>
                {canManage && <TableHead className="text-end">{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="text-center py-12 text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="text-center py-12 text-muted-foreground">
                    <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id} className="hover:bg-white/[0.02]">
                  <TableCell>
                    <span className="font-mono text-primary font-semibold">{p.workId}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-white">{p.name}</span>
                  </TableCell>
                  <TableCell>
                    {p.phoneColor ? (
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full inline-block ${getColorClass(p.phoneColor)}`} />
                        <span className="text-sm capitalize">{p.phoneColor}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{p.phoneNumber ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    {p.pcbaNumber ? (
                      <Badge variant="outline" className="font-mono text-xs text-amber-400 border-amber-400/40 bg-amber-400/10">
                        {p.pcbaNumber}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{p.createdByName ?? "—"}</span>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        {canDelete && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => setDeleteId(p.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              {editId ? t("workPhones.editTitle") : t("workPhones.addTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("workPhones.workId")} *</Label>
              <Input
                value={form.workId}
                onChange={e => setForm(f => ({ ...f, workId: e.target.value }))}
                placeholder={t("workPhones.workIdPlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("workPhones.name")} *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t("workPhones.namePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("workPhones.phoneColor")}</Label>
              <div className="flex flex-wrap gap-2">
                {PHONE_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, phoneColor: f.phoneColor === c.value ? "" : c.value }))}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${form.phoneColor === c.value ? "border-primary bg-primary/20 text-primary" : "border-white/15 text-muted-foreground hover:border-white/30"}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${c.class}`} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("workPhones.phoneNumber")}</Label>
              <Input
                value={form.phoneNumber}
                onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                placeholder={t("workPhones.phoneNumberPlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("workPhones.pcbaNumber")}</Label>
              <div className="flex gap-2">
                <Input
                  value={form.pcbaNumber}
                  onChange={e => setForm(f => ({ ...f, pcbaNumber: e.target.value }))}
                  placeholder={t("workPhones.pcbaPlaceholder")}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setScannerOpen(true)}
                  title={t("workPhones.scanPCBA")}
                >
                  <Scan className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("workPhones.pcbaHint")}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Modal */}
      <Dialog open={!!importPreview} onOpenChange={() => setImportPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-400" />
              {t("workPhones.importPreviewTitle")}
            </DialogTitle>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{t("workPhones.importFile")}:</span>
                <span className="text-white font-medium">{importPreview.filename}</span>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {importPreview.rows.length} {t("workPhones.importRows")}
                </Badge>
              </div>
              <div className="rounded-lg border border-white/10 overflow-hidden max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-card/80 hover:bg-card/80">
                      <TableHead className="text-xs">{t("workPhones.workId")}</TableHead>
                      <TableHead className="text-xs">{t("workPhones.name")}</TableHead>
                      <TableHead className="text-xs">{t("workPhones.phoneColor")}</TableHead>
                      <TableHead className="text-xs">{t("workPhones.phoneNumber")}</TableHead>
                      <TableHead className="text-xs">{t("workPhones.pcbaNumber")}</TableHead>
                      <TableHead className="text-xs">{t("common.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.rows.map((row, i) => {
                      const valid = !!row.workId && !!row.name;
                      return (
                        <TableRow key={i} className={valid ? "" : "bg-red-500/5"}>
                          <TableCell className="text-xs font-mono">{row.workId || <span className="text-red-400">—</span>}</TableCell>
                          <TableCell className="text-xs">{row.name || <span className="text-red-400">—</span>}</TableCell>
                          <TableCell className="text-xs capitalize">{row.phoneColor || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{row.phoneNumber || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{row.pcbaNumber || "—"}</TableCell>
                          <TableCell>
                            {valid
                              ? <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{t("workPhones.importValid")}</Badge>
                              : <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">{t("workPhones.importSkip")}</Badge>
                            }
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">{t("workPhones.importNote")}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreview(null)} disabled={importing}>
              {t("common.cancel")}
            </Button>
            <Button onClick={confirmImport} disabled={importing} className="bg-emerald-600 hover:bg-emerald-700">
              {importing ? t("common.loading") : t("workPhones.importConfirm", { count: importPreview?.rows.filter(r => r.workId && r.name).length ?? 0 })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Scanner */}
      {scannerOpen && (
        <QRScanner
          label={t("workPhones.scanPCBA")}
          onScan={code => {
            setForm(f => ({ ...f, pcbaNumber: code }));
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400">{t("workPhones.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("workPhones.deleteConfirm")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={del}>{t("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
