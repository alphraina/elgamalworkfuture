import { useState } from "react";
import { useGetSparepartOrders, useCreateSparepartOrder, useUpdateSparepartOrder, useGetInventory, type UpdateSparepartOrderRequestStatus } from "@workspace/api-client-react";
import { Button, Input, Select, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Modal, Label } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { FilterBar, matchesDateFilter, matchesSearch, type FilterState } from "@/components/filter-bar";
import { useTranslation } from "react-i18next";

export default function Orders() {
  const { t } = useTranslation();
  const { isAdmin, isInventory } = useAuth();
  const { data: orders, isLoading } = useGetSparepartOrders();
  const { data: inventory } = useGetInventory();
  const createMutation = useCreateSparepartOrder();
  const updateMutation = useUpdateSparepartOrder();
  const { toast } = useToast();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ date: "", shift: "", search: "", status: "" });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        data: {
          inventoryItemId: Number(fd.get("inventoryItemId")),
          quantity: Number(fd.get("quantity")),
          reason: fd.get("reason") as string,
        }
      });
      setIsAddOpen(false);
      toast({ title: t("common.success") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const handleStatusUpdate = async (id: number, status: UpdateSparepartOrderRequestStatus) => {
    try {
      await updateMutation.mutateAsync({ id, data: { status } });
      toast({ title: t("common.success") });
    } catch (err: any) {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const statusColors: Record<string, any> = {
    pending: "warning",
    approved: "primary",
    fulfilled: "success",
    rejected: "destructive"
  };

  const filtered = (orders ?? []).filter((o) => {
    if (!matchesDateFilter(o.createdAt ?? undefined, filters.date)) return false;
    if (filters.status && o.status !== filters.status) return false;
    return matchesSearch([o.partName, o.partNumber, o.orderedByName], filters.search);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">{t("orders.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("orders.orderDetails")}</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 tech-border">
          <ShoppingCart className="w-4 h-4" /> {t("orders.addOrder")}
        </Button>
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        showShift={false}
        showSearch
        statusOptions={[
          { value: "pending", label: t("orders.status_pending") },
          { value: "approved", label: t("orders.status_approved") },
          { value: "fulfilled", label: t("orders.status_delivered") },
          { value: "rejected", label: t("orders.status_rejected") },
        ]}
      />

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>{t("orders.itemName")}</TableHead>
                <TableHead>{t("orders.requestedBy")}</TableHead>
                <TableHead>{t("orders.quantity")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                {(isAdmin || isInventory) && <TableHead className="text-end">{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("orders.noOrders")}</TableCell></TableRow>
              ) : (
                filtered.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-muted-foreground">#{o.id}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-white">{o.partName}</div>
                      <div className="text-xs text-muted-foreground">{o.partNumber}</div>
                    </TableCell>
                    <TableCell>{o.orderedByName}</TableCell>
                    <TableCell className="font-mono text-base">{o.quantity}</TableCell>
                    <TableCell>{formatDate(o.createdAt)}</TableCell>
                    <TableCell><Badge variant={statusColors[o.status] || "default"} className="uppercase text-[10px]">{o.status}</Badge></TableCell>
                    {(isAdmin || isInventory) && (
                      <TableCell className="text-end space-x-2">
                        {o.status === 'pending' && (
                          <>
                            <Button size="sm" variant="outline" className="border-success text-success hover:bg-success hover:text-white" onClick={() => handleStatusUpdate(o.id, 'approved')}>{t("vacation.approve")}</Button>
                            <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-white" onClick={() => handleStatusUpdate(o.id, 'rejected')}>{t("vacation.reject")}</Button>
                          </>
                        )}
                        {o.status === 'approved' && (
                          <Button size="sm" onClick={() => handleStatusUpdate(o.id, 'fulfilled')}>{t("orders.status_delivered")}</Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={t("orders.addOrder")}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("orders.itemName")}</Label>
            <Select name="inventoryItemId" required>
              <option value="">-- {t("common.all")} --</option>
              {inventory?.map(i => (
                <option key={i.id} value={i.id}>{i.partNumber} - {i.partName} ({i.quantity})</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("orders.quantity")}</Label>
            <Input type="number" name="quantity" required min={1} defaultValue={1} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.notes")}</Label>
            <Input name="reason" required placeholder="e.g. Routine maintenance on Line 3" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-white/10 mt-4">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={createMutation.isPending}>{t("common.submit")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
