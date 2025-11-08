import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type OwnerSummary = {
  ownerId: string;
  businessName: string;
  todayTotal: number;
  cumulativeTotal: number;
  transactionCount: number;
};

type ChartPoint = { date: string; amount: number };

export default function ShareholderReports() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [owners, setOwners] = useState<OwnerSummary[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [stats, setStats] = useState({
    totalOwners: 0,
    activeOwners: 0,
    todayTotal: 0,
    dailyAverage: 0,
  });

  useEffect(() => {
    fetchReportsData();
  }, [range]);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      
      // Fetch owners list with daily totals
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke('shareholder-referral-tenants', {
        headers: { Authorization: `Bearer ${token}` },
        body: { status: 'Active' },
      });

      if (response.error) throw response.error;

      // Mock transaction data (replace with real API later)
      const mockOwners: OwnerSummary[] = (response.data.data || []).map((o: any) => ({
        ownerId: o.ownerId,
        businessName: o.businessName,
        todayTotal: Math.floor(Math.random() * 50000) + 10000,
        cumulativeTotal: Math.floor(Math.random() * 500000) + 100000,
        transactionCount: Math.floor(Math.random() * 50) + 5,
      }));

      setOwners(mockOwners);

      // Calculate stats
      const todayTotal = mockOwners.reduce((sum, o) => sum + o.todayTotal, 0);
      setStats({
        totalOwners: mockOwners.length,
        activeOwners: mockOwners.length,
        todayTotal,
        dailyAverage: todayTotal / mockOwners.length || 0,
      });

      // Generate chart data
      const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      const mockChart: ChartPoint[] = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - i - 1));
        return {
          date: date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
          amount: Math.floor(Math.random() * 100000) + 50000,
        };
      });

      setChartData(mockChart);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดรายงานได้", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">รายงานธุรกรรม</h1>
        <p className="text-muted-foreground">สรุปยอดธุรกรรมรายวันของ Owner ทั้งหมด</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-glow transition-all duration-300 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Owner ทั้งหมด</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalOwners}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-glow transition-all duration-300 bg-gradient-to-br from-green-50/50 to-white dark:from-green-950/20 dark:to-background">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.activeOwners}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-md hover:shadow-glow transition-all duration-300 bg-gradient-to-br from-purple-50/50 to-white dark:from-purple-950/20 dark:to-background">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">ยอดวันนี้</p>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">฿{stats.todayTotal.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-md hover:shadow-glow transition-all duration-300 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/20 dark:to-background">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">เฉลี่ยต่อ Owner</p>
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">฿{Math.round(stats.dailyAverage).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="shadow-md hover:shadow-glow transition-all duration-300 border-t-4 border-t-indigo-500">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>แนวโน้มธุรกรรม</CardTitle>
          <Select value={range} onValueChange={(v: any) => setRange(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 วัน</SelectItem>
              <SelectItem value="30d">30 วัน</SelectItem>
              <SelectItem value="90d">90 วัน</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `฿${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Owners Table */}
      <Card className="shadow-md hover:shadow-glow transition-all duration-300 border-t-4 border-t-emerald-500">
        <CardHeader>
          <CardTitle>รายงานรายละเอียด</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Owner ID</th>
                  <th className="text-left p-3">ธุรกิจ</th>
                  <th className="text-right p-3">ยอดวันนี้</th>
                  <th className="text-right p-3">ยอดสะสม</th>
                  <th className="text-right p-3">รายการ</th>
                  <th className="text-right p-3"></th>
                </tr>
              </thead>
              <tbody>
                {owners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      ไม่มีข้อมูลธุรกรรม
                    </td>
                  </tr>
                ) : (
                  owners.map((owner) => (
                    <tr key={owner.ownerId} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-mono text-sm">{owner.ownerId.slice(0, 8)}</td>
                      <td className="p-3 font-medium">{owner.businessName}</td>
                      <td className="p-3 text-right">฿{owner.todayTotal.toLocaleString()}</td>
                      <td className="p-3 text-right text-muted-foreground">
                        ฿{owner.cumulativeTotal.toLocaleString()}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {owner.transactionCount}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/shareholder/reports/${owner.ownerId}`)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          ดูรายงาน
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
