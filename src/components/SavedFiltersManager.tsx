import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Filter, Star, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SavedFilter {
  id: string;
  name: string;
  filters: {
    statusFilter?: string;
    typeFilter?: string;
    verifiedFilter?: string;
    dateRange?: { from?: Date; to?: Date };
  };
  is_default: boolean;
  created_at: string;
}

interface SavedFiltersManagerProps {
  currentFilters: {
    statusFilter: string;
    typeFilter: string;
    verifiedFilter: string;
    dateRange: { from?: Date; to?: Date };
  };
  onApplyFilter: (filters: SavedFilter["filters"]) => void;
}

export const SavedFiltersManager = ({
  currentFilters,
  onApplyFilter,
}: SavedFiltersManagerProps) => {
  const { activeTenantId } = useTenantSwitcher();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null);

  // Fetch saved filters
  const { data: savedFilters, isLoading } = useQuery({
    queryKey: ["saved-filters", activeTenantId, user?.id],
    queryFn: async () => {
      if (!activeTenantId || !user?.id) return [];
      
      const { data, error } = await supabase
        .from("transaction_filters")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as SavedFilter[];
    },
    enabled: !!activeTenantId && !!user?.id,
  });

  // Save filter mutation
  const saveFilterMutation = useMutation({
    mutationFn: async ({ name, isDefault }: { name: string; isDefault: boolean }) => {
      if (!activeTenantId || !user?.id) throw new Error("Missing tenant or user");

      // Convert dates to ISO strings for JSON storage
      const filtersToSave = {
        statusFilter: currentFilters.statusFilter,
        typeFilter: currentFilters.typeFilter,
        verifiedFilter: currentFilters.verifiedFilter,
        dateRange: {
          from: currentFilters.dateRange.from?.toISOString(),
          to: currentFilters.dateRange.to?.toISOString(),
        },
      };

      const { data, error } = await supabase
        .from("transaction_filters")
        .insert([{
          user_id: user.id,
          tenant_id: activeTenantId,
          name,
          filters: filtersToSave,
          is_default: isDefault,
        }] as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters"] });
      toast.success("บันทึก Filter สำเร็จ");
      setIsDialogOpen(false);
      setFilterName("");
    },
    onError: (error: any) => {
      toast.error("ไม่สามารถบันทึก Filter: " + error.message);
    },
  });

  // Update filter mutation
  const updateFilterMutation = useMutation({
    mutationFn: async ({ id, name, isDefault }: { id: string; name: string; isDefault: boolean }) => {
      // Convert dates to ISO strings for JSON storage
      const filtersToSave = {
        statusFilter: currentFilters.statusFilter,
        typeFilter: currentFilters.typeFilter,
        verifiedFilter: currentFilters.verifiedFilter,
        dateRange: {
          from: currentFilters.dateRange.from?.toISOString(),
          to: currentFilters.dateRange.to?.toISOString(),
        },
      };

      const { data, error } = await supabase
        .from("transaction_filters")
        .update({
          name,
          filters: filtersToSave as any,
          is_default: isDefault,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters"] });
      toast.success("อัพเดท Filter สำเร็จ");
      setIsDialogOpen(false);
      setEditingFilter(null);
      setFilterName("");
    },
    onError: (error: any) => {
      toast.error("ไม่สามารถอัพเดท Filter: " + error.message);
    },
  });

  // Delete filter mutation
  const deleteFilterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transaction_filters")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters"] });
      toast.success("ลบ Filter สำเร็จ");
    },
    onError: (error: any) => {
      toast.error("ไม่สามารถลบ Filter: " + error.message);
    },
  });

  // Set as default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transaction_filters")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters"] });
      toast.success("ตั้งเป็น Default Filter สำเร็จ");
    },
    onError: (error: any) => {
      toast.error("ไม่สามารถตั้งเป็น Default: " + error.message);
    },
  });

  const handleSave = () => {
    if (!filterName.trim()) {
      toast.error("กรุณาใส่ชื่อ Filter");
      return;
    }

    if (editingFilter) {
      updateFilterMutation.mutate({
        id: editingFilter.id,
        name: filterName,
        isDefault: false,
      });
    } else {
      saveFilterMutation.mutate({
        name: filterName,
        isDefault: false,
      });
    }
  };

  const handleEdit = (filter: SavedFilter) => {
    setEditingFilter(filter);
    setFilterName(filter.name);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("คุณต้องการลบ Filter นี้หรือไม่?")) {
      deleteFilterMutation.mutate(id);
    }
  };

  const hasActiveFilters =
    currentFilters.statusFilter !== "all" ||
    currentFilters.typeFilter !== "all" ||
    currentFilters.verifiedFilter !== "all" ||
    currentFilters.dateRange.from ||
    currentFilters.dateRange.to;

  return (
    <div className="flex gap-2">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasActiveFilters}
            className="border-primary/20 hover:bg-primary/10"
            onClick={() => {
              setEditingFilter(null);
              setFilterName("");
            }}
          >
            <Save className="w-4 h-4 mr-2" />
            บันทึก Filter
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFilter ? "แก้ไข Filter" : "บันทึก Filter ใหม่"}
            </DialogTitle>
            <DialogDescription>
              ตั้งชื่อสำหรับ Filter เพื่อใช้งานในภายหลัง
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="filter-name">ชื่อ Filter</Label>
              <Input
                id="filter-name"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="เช่น: ธุรกรรมรอตรวจสอบ"
                className="mt-2"
              />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm font-medium">Filter ปัจจุบัน:</p>
              <div className="flex flex-wrap gap-2">
                {currentFilters.statusFilter !== "all" && (
                  <Badge variant="secondary">Status: {currentFilters.statusFilter}</Badge>
                )}
                {currentFilters.typeFilter !== "all" && (
                  <Badge variant="secondary">Type: {currentFilters.typeFilter}</Badge>
                )}
                {currentFilters.verifiedFilter !== "all" && (
                  <Badge variant="secondary">
                    Verified: {currentFilters.verifiedFilter}
                  </Badge>
                )}
                {(currentFilters.dateRange.from || currentFilters.dateRange.to) && (
                  <Badge variant="secondary">มีช่วงวันที่</Badge>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave}>
              {editingFilter ? "อัพเดท" : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="border-primary/20 hover:bg-primary/10">
            <Filter className="w-4 h-4 mr-2" />
            Saved Filters
            {savedFilters && savedFilters.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {savedFilters.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Saved Filters</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isLoading ? (
            <div className="p-2 text-sm text-muted-foreground">กำลังโหลด...</div>
          ) : savedFilters && savedFilters.length > 0 ? (
            savedFilters.map((filter) => (
              <div
                key={filter.id}
                className="group flex items-center justify-between px-2 py-2 hover:bg-accent rounded-md"
              >
                <button
                  onClick={() => onApplyFilter(filter.filters)}
                  className="flex items-center gap-2 flex-1 text-sm text-left"
                >
                  {filter.is_default && <Star className="w-3 h-3 text-warning fill-warning" />}
                  <span className={cn(filter.is_default && "font-semibold")}>
                    {filter.name}
                  </span>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!filter.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setDefaultMutation.mutate(filter.id)}
                    >
                      <Star className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleEdit(filter)}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:text-destructive"
                    onClick={() => handleDelete(filter.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-2 text-sm text-muted-foreground">ยังไม่มี Saved Filters</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
