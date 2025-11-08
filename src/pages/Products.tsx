import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import DashboardLayout from "@/components/DashboardLayout";
import ProductForm from "@/components/products/ProductForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Products() {
  const { activeTenantId } = useTenantSwitcher();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", activeTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, prices(*)")
        .eq("tenant_id", activeTenantId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId,
  });

  const createProduct = useMutation({
    mutationFn: async (values: any) => {
      if (!activeTenantId) throw new Error("No active tenant");

      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          tenant_id: activeTenantId,
          name: values.name,
          description: values.description,
          status: values.status,
        })
        .select()
        .single();

      if (productError) throw productError;

      const { error: priceError } = await supabase.from("prices").insert({
        product_id: product.id,
        amount: values.amount,
        currency: values.currency,
        recurring: values.recurring,
        recurring_interval: values.recurringInterval,
        recurring_interval_count: values.recurringIntervalCount,
        status: "active",
      });

      if (priceError) throw priceError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDialogOpen(false);
      toast.success("Product created successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to create product", {
        description: error.message,
      });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) => {
      const { error: productError } = await supabase
        .from("products")
        .update({
          name: values.name,
          description: values.description,
          status: values.status,
        })
        .eq("id", id);

      if (productError) throw productError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      toast.success("Product updated successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to update product", {
        description: error.message,
      });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to delete product", {
        description: error.message,
      });
    },
  });

  const handleSubmit = (values: any) => {
    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, values });
    } else {
      createProduct.mutate(values);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProduct.mutate(id);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8" />
              Products & Pricing
            </h1>
            <p className="text-muted-foreground">
              Manage your products and pricing plans
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Product
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Products</CardTitle>
            <CardDescription>View and manage your product catalog</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : products?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        No products found. Create your first product to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    products?.map((product) => {
                      const price = product.prices?.[0];
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {product.description || "-"}
                          </TableCell>
                          <TableCell>
                            {price
                              ? `${price.currency} ${(price.amount / 100).toLocaleString()}`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {price?.recurring ? (
                              <Badge variant="outline">
                                Recurring ({price.recurring_interval})
                              </Badge>
                            ) : (
                              <Badge variant="outline">One-time</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                product.status === "active" ? "default" : "secondary"
                              }
                            >
                              {product.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(product)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(product.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingProduct(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Edit Product" : "Create New Product"}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? "Update the product details below"
                  : "Add a new product to your catalog"}
              </DialogDescription>
            </DialogHeader>
            <ProductForm
              onSubmit={handleSubmit}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingProduct(null);
              }}
              defaultValues={
                editingProduct
                  ? {
                      name: editingProduct.name,
                      description: editingProduct.description,
                      status: editingProduct.status,
                      amount: editingProduct.prices?.[0]?.amount,
                      currency: editingProduct.prices?.[0]?.currency,
                      recurring: editingProduct.prices?.[0]?.recurring,
                      recurringInterval: editingProduct.prices?.[0]?.recurring_interval,
                      recurringIntervalCount:
                        editingProduct.prices?.[0]?.recurring_interval_count,
                    }
                  : undefined
              }
              isLoading={createProduct.isPending || updateProduct.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
