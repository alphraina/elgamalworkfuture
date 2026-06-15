import { useState } from "react";
import { useGetInventory, useCreateInventoryItem, useUpdateInventoryItem } from "@workspace/api-client-react";
import { Button, Input, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Modal, Label } from "@/components/ui";
import { PackagePlus, AlertOctagon, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FilterBar, matchesSearch, type FilterState } from "@/components/filter-bar";
import { useTranslation } from "react-i18next";

export default function Inventory() {
  const { t } = useTranslation();
  const { data: items, isLoading } = useGetInventory();
  const createMutation = useCreateInventoryItem();
  const updateMutation = useUpdateInventoryItem();
  const { toast } = useToast();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ date: "", shift: "", search: "", status: "" });
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const handleEditOpen = (item: any) => setEditTarget(item);
  const handleEditClose = () => setEditTarget(null);

  const handleEditSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await updateMutation.mutateAsync({
        id: editTarget.id,
        data: {
          partNumber: fd.get("partNumber") as string,
          partName: fd.get("partName") as string,
          category: fd.get("category") as string,
          quantity: Number(fd.get("quantity")),
          minQuantity: Number(fd.get("minQuantity")),
          unit: fd.get("unit") as string,
          location: fd.get("location") as string,
        },
      });
      toast({ title: t("common.success") });
      handleEditClose();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setEditBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        data: {
          partNumber: fd.get("partNumber") as string,
          partName: fd.get("partName") as string,
          category: fd.get("category") as string,
          quantity: Number(fd.get("quantity")),
          minQuantity: Number(fd.get("minQuantity")),
          unit: fd.get("unit") as string,
          location: fd.get("location") as string,
        }
      });
      setIsAddOpen(false);
      toast({ title: t("common.success") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const filtered = (items ?? []).filter((i) => {
    const isLow = i.quantity <= i.minQuantity;
    if (filters.status === "low" && !isLow) return false;
    if (filters.status === "ok" && isLow) return false;
    return matchesSearch([i.partName, i.partNumber, i.category, i.location], filters.search);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">{t("inventory.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("inventory.noItems")}</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 tech-border">
          <PackagePlus className="w-4 h-4" /> {t("inventory.addItem")}
        </Button>
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        showDate={false}
        showShift={false}
        showSearch={true}
        statusOptions={[
          { value: "ok", label: t("inventory.ok") },
          { value: "low", label: t("inventory.lowStock") },
        ]}
      />

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("inventory.partNumber")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("inventory.category")}</TableHead>
                <TableHead>{t("inventory.location")}</TableHead>
                <TableHead className="text-end">{t("inventory.quantity")}</TableHead>
                <TableHead className="text-end">{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("inventory.noItems")}</TableCell></TableRow>
              ) : (
                filtered.map(i => {
                  const isLow = i.quantity <= i.minQuantity;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-primary">{i.partNumber}</TableCell>
                      <TableCell className="font-semibold text-white">{i.partName}</TableCell>
                      <TableCell><Badge variant="secondary">{i.category || t("common.na")}</Badge></TableCell>
                      <TableCell>{i.location || '-'}</TableCell>
                      <TableCell className="text-end font-mono text-base">
                        {i.quantity} <span className="text-xs text-muted-foreground ms-1">{i.unit}</span>
                      </TableCell>
                      <TableCell className="text-end">
                        {isLow ? (
                          <Badge variant="destructive" className="gap-1"><AlertOctagon className="w-3 h-3"/> {t("inventory.lowStock")}</Badge>
                        ) : (
                          <Badge variant="success">{t("inventory.ok")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-white hover:bg-white/10 border border-white/10" onClick={() => handleEditOpen(i)}>
                          <Pencil className="w-3.5 h-3.5" />{t("common.edit")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Item Modal */}
      {editTarget && (
        <Modal isOpen onClose={handleEditClose} title={`${t("common.edit")} — ${editTarget.partName}`}>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("inventory.partNumber")}</Label>
                <Input name="partNumber" required defaultValue={editTarget.partNumber} />
              </div>
              <div className="space-y-2">
                <Label>{t("inventory.itemName")}</Label>
                <Input name="partName" required defaultValue={editTarget.partName} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("inventory.quantity")}</Label>
                <Input type="number" name="quantity" required min={0} defaultValue={editTarget.quantity} />
              </div>
              <div className="space-y-2">
                <Label>{t("inventory.minQuantity")}</Label>
                <Input type="number" name="minQuantity" required min={0} defaultValue={editTarget.minQuantity} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("inventory.category")}</Label>
                <Input name="category" defaultValue={editTarget.category ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>{t("inventory.unit")}</Label>
                <Input name="unit" defaultValue={editTarget.unit ?? "pcs"} />
              </div>
              <div className="space-y-2">
                <Label>{t("inventory.location")}</Label>
                <Input name="location" defaultValue={editTarget.location ?? ""} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={handleEditClose}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={editBusy}>{editBusy ? t("common.loading") : t("common.save")}</Button>
            </div>
          </form>
        </Modal>
      )}

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={t("inventory.addItem")}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("inventory.partNumber")}</Label>
              <Input name="partNumber" required placeholder="e.g. PN-1002" />
            </div>
            <div className="space-y-2">
              <Label>{t("inventory.itemName")}</Label>
              <Input name="partName" required placeholder="e.g. Conveyor Belt 5m" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("inventory.quantity")}</Label>
              <Input type="number" name="quantity" required defaultValue={0} min={0} />
            </div>
            <div className="space-y-2">
              <Label>{t("inventory.minQuantity")}</Label>
              <Input type="number" name="minQuantity" required defaultValue={5} min={0} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("inventory.category")}</Label>
              <Input name="category" placeholder="e.g. Motors" />
            </div>
            <div className="space-y-2">
              <Label>{t("inventory.unit")}</Label>
              <Input name="unit" placeholder="e.g. pcs, meters" defaultValue="pcs" />
            </div>
            <div className="space-y-2">
              <Label>{t("inventory.location")}</Label>
              <Input name="location" placeholder="e.g. A1-B2" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-white/10 mt-4">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={createMutation.isPending}>{t("inventory.addItem")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
