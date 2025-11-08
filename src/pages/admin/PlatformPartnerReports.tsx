import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CalendarIcon, Download, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { toast } from "sonner";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import DashboardLayout from "@/components/DashboardLayout";

export default function PlatformPartnerReports() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [groupBy, setGroupBy] = useState<"day" | "month" | "partner">("day");
  const [partnerId, setPartnerId] = useState<string>("all");

  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ["platform-partner-reports", dateRange, groupBy, partnerId],
    queryFn: async () => {
      const params = new URLSearchParams({
        start_date: format(dateRange.from, "yyyy-MM-dd"),
        end_date: format(dateRange.to, "yyyy-MM-dd"),
        group_by: groupBy,
      });
      if (partnerId && partnerId !== "all") params.append("partner_id", partnerId);

      const { data, error } = await invokeFunctionWithTenant("platform-partner-reports-get", {
        body: {},
        headers: { "Content-Type": "application/json" },
      });

      if (error) throw error;
      return data;
    },
  });

  const { data: partnersList } = useQuery({
    queryKey: ["platform-partners-list-simple"],
    queryFn: async () => {
      const { data, error } = await invokeFunctionWithTenant("platform-partners-list", {
        body: {},
      });
      if (error) throw error;
      return data;
    },
  });

  const handleExport = async () => {
    await checkAndChallenge(async () => {
      try {
        const params = new URLSearchParams({
          start_date: format(dateRange.from, "yyyy-MM-dd"),
          end_date: format(dateRange.to, "yyyy-MM-dd"),
        });
        if (partnerId && partnerId !== "all") params.append("partner_id", partnerId);

        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-partner-reports-export?${params}`,
          {
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          }
        );

        if (!response.ok) throw new Error("Export failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `partner-reports-${Date.now()}.csv`;
        a.click();

        const checksum = response.headers.get("X-Checksum");
        toast.success(`ส่งออกสำเร็จ | Checksum: ${checksum?.slice(0, 8)}...`);
      } catch (error) {
        console.error("Export error:", error);
        toast.error("ส่งออกล้มเหลว");
      }
    });
  };

  const summary = reportData?.summary || {};
  const chartData = reportData?.grouped_data || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">รายงานพาร์ทเนอร์</h1>
          <Button onClick={handleExport} disabled={isLoading}>
            <Download className="w-4 h-4 mr-2" />
            ส่งออก CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>ตัวกรอง</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 w-4 h-4" />
                  {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range: any) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                />
              </PopoverContent>
            </Popover>

            <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">รายวัน</SelectItem>
                <SelectItem value="month">รายเดือน</SelectItem>
                <SelectItem value="partner">รายพาร์ทเนอร์</SelectItem>
              </SelectContent>
            </Select>

            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="ทุกพาร์ทเนอร์" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกพาร์ทเนอร์</SelectItem>
                {partnersList?.partners?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => refetch()}>รีเฟรช</Button>
          </CardContent>
        </Card>

        {/* KPI Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">รายได้รวม (Base)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ฿{(summary.total_base_value || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">คอมมิชันจ่าย</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                ฿{(summary.total_commission || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">สุทธิแพลตฟอร์ม</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                ฿{(summary.net_to_platform || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ค้างจ่าย</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                ฿{(summary.total_pending || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="line" className="space-y-4">
          <TabsList>
            <TabsTrigger value="line">กราฟเส้น</TabsTrigger>
            <TabsTrigger value="bar">กราฟแท่ง</TabsTrigger>
          </TabsList>

          <TabsContent value="line" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>รายได้ vs คอมมิชัน</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={groupBy === "partner" ? "partner_name" : "date"} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="base_value" stroke="hsl(var(--primary))" name="รายได้ Base" />
                    <Line type="monotone" dataKey="commission" stroke="hsl(var(--destructive))" name="คอมมิชัน" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>เปรียบเทียบรายได้</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={groupBy === "partner" ? "partner_name" : "date"} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="base_value" fill="hsl(var(--primary))" name="รายได้ Base" />
                    <Bar dataKey="commission" fill="hsl(var(--destructive))" name="คอมมิชัน" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
    </DashboardLayout>
  );
}
