import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Users, TrendingUp, Wallet, Clock, Search, Filter, Plus, Download } from "lucide-react";
import { CreatePartnerDialog } from "@/components/admin/CreatePartnerDialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

export default function PlatformPartners() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [commissionTypeFilter, setCommissionTypeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-partners", page, pageSize, statusFilter, commissionTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (commissionTypeFilter !== "all") params.append("commissionType", commissionTypeFilter);

      const { data, error } = await invokeFunctionWithTenant("platform-partners-list", {
        body: Object.fromEntries(params)
      });

      if (error) throw error;
      return data;
    },
  });

  const kpis = data?.kpis || {};
  const partners = data?.partners || [];
  const pagination = data?.pagination || {};

  const filteredPartners = searchTerm
    ? partners.filter((p: any) => 
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : partners;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">จัดการพาร์ทเนอร์</h1>
          <p className="text-muted-foreground mt-2">
            ภาพรวมและจัดการพาร์ทเนอร์ (Shareholder) ทั้งหมดในระบบ
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            สร้างพาร์ทเนอร์
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            ส่งออก CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ฐานคำนวณเดือนนี้</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(kpis.monthly_base || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">คอมมิชชันจ่ายเดือนนี้</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(kpis.monthly_commission || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ยอดค้างจ่าย</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(kpis.total_pending || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Owner ที่ Active</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{kpis.active_clients || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>รายชื่อพาร์ทเนอร์</CardTitle>
          <CardDescription>จัดการและติดตามผลงานของพาร์ทเนอร์</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อหรืออีเมล..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                <SelectItem value="active">ใช้งาน</SelectItem>
                <SelectItem value="inactive">ไม่ใช้งาน</SelectItem>
              </SelectContent>
            </Select>
            <Select value={commissionTypeFilter} onValueChange={setCommissionTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ประเภททั้งหมด</SelectItem>
                <SelectItem value="revenue_share">Revenue Share</SelectItem>
                <SelectItem value="bounty">Bounty</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={pageSize.toString()} 
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1); // Reset to first page when changing page size
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 แถว</SelectItem>
                <SelectItem value="20">20 แถว</SelectItem>
                <SelectItem value="30">30 แถว</SelectItem>
                <SelectItem value="50">50 แถว</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredPartners.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>พาร์ทเนอร์</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>% เริ่มต้น</TableHead>
                    <TableHead>ฐานเดือนนี้</TableHead>
                    <TableHead>คอมมิชชันเดือนนี้</TableHead>
                    <TableHead>ค้างจ่าย</TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead>การดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPartners.map((partner: any) => (
                    <TableRow key={partner.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{partner.full_name}</div>
                          <div className="text-sm text-muted-foreground">{partner.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={partner.status === "active" ? "default" : "secondary"}>
                          {partner.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {partner.default_commission_type === "revenue_share" ? "Revenue Share" :
                           partner.default_commission_type === "bounty" ? "Bounty" : "Hybrid"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{partner.default_commission_value || 0}%</TableCell>
                      <TableCell>{formatCurrency(partner.monthly_base || 0)}</TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatCurrency(partner.monthly_commission || 0)}
                      </TableCell>
                      <TableCell className="text-orange-600">
                        {formatCurrency(partner.balance || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{partner.active_clients_count || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/platform/partners/${partner.id}`)}
                        >
                          เปิดดู
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    แสดง {((page - 1) * pageSize) + 1} ถึง {Math.min(page * pageSize, pagination.total)} จาก {pagination.total} รายการ
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => page > 1 && setPage(page - 1)}
                          className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {/* Show first page */}
                      {page > 2 && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(1)} className="cursor-pointer">
                            1
                          </PaginationLink>
                        </PaginationItem>
                      )}
                      
                      {/* Show ellipsis if needed */}
                      {page > 3 && (
                        <PaginationItem>
                          <span className="px-4">...</span>
                        </PaginationItem>
                      )}
                      
                      {/* Show previous page */}
                      {page > 1 && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(page - 1)} className="cursor-pointer">
                            {page - 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}
                      
                      {/* Current page */}
                      <PaginationItem>
                        <PaginationLink isActive>
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                      
                      {/* Show next page */}
                      {page < pagination.totalPages && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(page + 1)} className="cursor-pointer">
                            {page + 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}
                      
                      {/* Show ellipsis if needed */}
                      {page < pagination.totalPages - 2 && (
                        <PaginationItem>
                          <span className="px-4">...</span>
                        </PaginationItem>
                      )}
                      
                      {/* Show last page */}
                      {page < pagination.totalPages - 1 && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(pagination.totalPages)} className="cursor-pointer">
                            {pagination.totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => page < pagination.totalPages && setPage(page + 1)}
                          className={page === pagination.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              ไม่พบพาร์ทเนอร์
            </div>
          )}
        </CardContent>
      </Card>

      <CreatePartnerDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
