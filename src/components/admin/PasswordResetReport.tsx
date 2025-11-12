import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { KeyRound, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { useTenantSwitcher } from '@/hooks/useTenantSwitcher';

interface MonthlyResetData {
  month: string;
  count: number;
  users: Set<string>;
}

export function PasswordResetReport() {
  const { activeTenantId } = useTenantSwitcher();

  const { data: resetLogs, isLoading } = useQuery({
    queryKey: ['password-reset-logs', activeTenantId],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'password_reset')
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      if (activeTenantId) {
        query = query.eq('tenant_id', activeTenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeTenantId,
  });

  // Process data by month
  const monthlyData = resetLogs?.reduce((acc: Record<string, MonthlyResetData>, log) => {
    const date = new Date(log.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short' });
    
    if (!acc[monthKey]) {
      acc[monthKey] = {
        month: monthLabel,
        count: 0,
        users: new Set(),
      };
    }
    
    acc[monthKey].count++;
    if (log.actor_user_id) {
      acc[monthKey].users.add(log.actor_user_id);
    }
    
    return acc;
  }, {});

  const chartData = monthlyData 
    ? Object.values(monthlyData).map(d => ({
        month: d.month,
        จำนวนครั้ง: d.count,
        จำนวนผู้ดำเนินการ: d.users.size,
      }))
    : [];

  // Calculate statistics
  const totalResets = resetLogs?.length || 0;
  const uniqueActors = new Set(resetLogs?.map(log => log.actor_user_id).filter(Boolean)).size;
  const avgPerMonth = chartData.length > 0 ? (totalResets / chartData.length).toFixed(1) : '0';
  
  // Calculate trend (compare last 2 months)
  const getTrend = () => {
    if (chartData.length < 2) return { direction: 'stable', percentage: 0 };
    
    const lastMonth = chartData[chartData.length - 1].จำนวนครั้ง;
    const previousMonth = chartData[chartData.length - 2].จำนวนครั้ง;
    
    if (previousMonth === 0) return { direction: 'stable', percentage: 0 };
    
    const change = ((lastMonth - previousMonth) / previousMonth) * 100;
    
    if (change > 10) return { direction: 'up', percentage: change };
    if (change < -10) return { direction: 'down', percentage: Math.abs(change) };
    return { direction: 'stable', percentage: Math.abs(change) };
  };

  const trend = getTrend();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5" />
          รายงานการรีเซ็ตรหัสผ่าน
        </CardTitle>
        <CardDescription>
          สรุปและแนวโน้มการรีเซ็ตรหัสผ่าน 6 เดือนที่ผ่านมา
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border bg-card">
            <div className="text-sm text-muted-foreground mb-1">จำนวนครั้งทั้งหมด</div>
            <div className="text-2xl font-bold">{totalResets}</div>
          </div>
          
          <div className="p-4 rounded-lg border bg-card">
            <div className="text-sm text-muted-foreground mb-1">ค่าเฉลี่ยต่อเดือน</div>
            <div className="text-2xl font-bold">{avgPerMonth}</div>
          </div>
          
          <div className="p-4 rounded-lg border bg-card">
            <div className="text-sm text-muted-foreground mb-1">ผู้ดำเนินการ</div>
            <div className="text-2xl font-bold">{uniqueActors}</div>
          </div>
          
          <div className="p-4 rounded-lg border bg-card">
            <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
              แนวโน้ม
              {trend.direction === 'up' && <TrendingUp className="w-4 h-4 text-destructive" />}
              {trend.direction === 'down' && <TrendingDown className="w-4 h-4 text-green-500" />}
              {trend.direction === 'stable' && <Minus className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {trend.percentage.toFixed(0)}%
              </div>
              <Badge 
                variant={trend.direction === 'up' ? 'destructive' : trend.direction === 'down' ? 'default' : 'outline'}
              >
                {trend.direction === 'up' && '↑ เพิ่มขึ้น'}
                {trend.direction === 'down' && '↓ ลดลง'}
                {trend.direction === 'stable' && '→ คงที่'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Line Chart */}
        {chartData.length > 0 ? (
          <>
            <div>
              <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                แนวโน้มการรีเซ็ตรหัสผ่านรายเดือน
              </h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="จำนวนครั้ง" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--destructive))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div>
              <h4 className="text-sm font-semibold mb-4">เปรียบเทียบจำนวนครั้งกับผู้ดำเนินการ</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="จำนวนครั้ง" 
                    fill="hsl(var(--destructive))" 
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar 
                    dataKey="จำนวนผู้ดำเนินการ" 
                    fill="hsl(var(--primary))" 
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <KeyRound className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">ไม่มีข้อมูลการรีเซ็ตรหัสผ่าน</p>
            <p className="text-sm mt-1">ยังไม่มีประวัติการรีเซ็ตรหัสผ่านใน 6 เดือนที่ผ่านมา</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}