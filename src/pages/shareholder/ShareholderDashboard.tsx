import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Copy, Download, Link as LinkIcon, QrCode, RefreshCw, Users, Wallet, Percent, CheckCircle2, Clock } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { QRCodeCanvas } from "qrcode.react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useShareholder } from "@/hooks/useShareholder";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

// Types
type OwnerRow = {
  ownerId: string;
  businessName: string;
  email: string;
  createdAt: string;
  status: "Active" | "Trial" | "Churned";
  mrr: number;
  commission_rate?: number;
};

type Summary = {
  totalOwners: number;
  activeOwners: number;
  monthlyRefRevenue: number;
  pendingCommission: number;
  approvalRate: number;
};

type CommissionPoint = { date: string; commissionTHB: number };

// API Functions
async function fetchSummary(): Promise<Summary> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const response = await supabase.functions.invoke('shareholder-referral-stats', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.error) throw response.error;
  return response.data.data;
}

async function fetchOwners(status: "All" | "Active" | "Trial" | "Churned"): Promise<OwnerRow[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const response = await supabase.functions.invoke('shareholder-referral-tenants', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: { status },
  });

  if (response.error) throw response.error;
  return response.data.data;
}

async function fetchCommissionSeries(range: "3M" | "6M" | "12M"): Promise<CommissionPoint[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const response = await supabase.functions.invoke('shareholder-commission-chart', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: { range },
  });

  if (response.error) throw response.error;
  return response.data.data;
}

// UI Components
function StatCard({ icon: Icon, title, value, help, gradient }: { icon: any; title: string; value: string; help?: string; gradient: string }) {
  return (
    <Card className={`border-l-4 ${gradient} shadow-md hover:shadow-glow transition-all duration-300`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="p-2 rounded-full bg-white/20">
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        <div className="text-3xl font-bold text-white">{value}</div>
        {help && <div className="text-xs text-white/80 mt-2">{help}</div>}
      </CardContent>
    </Card>
  );
}

function StatMini({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function PayoutRequestForm({ maxAmount, onSubmit }: { maxAmount: number; onSubmit: (amount: number) => Promise<void> }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (amount <= 0) return toast({ title: "กรอกจำนวนเงินให้ถูกต้อง" });
    if (amount > maxAmount) return toast({ title: "เกินวงเงินคงค้าง", description: `สูงสุด ${maxAmount.toLocaleString()} THB` });
    setLoading(true);
    await onSubmit(amount);
    setLoading(false);
    setAmount(0);
  };

  return (
    <div className="space-y-2">
      <Label>จำนวนเงิน (สูงสุด {maxAmount.toLocaleString()} THB)</Label>
      <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      <Button onClick={submit} disabled={loading} className="w-full">
        {loading ? "กำลังส่งคำขอ..." : "ขอรับเงิน"}
      </Button>
    </div>
  );
}

// Main Component
export default function ShareholderDashboard() {
  const { toast } = useToast();
  const { shareholder, isLoading: shareholderLoading } = useShareholder();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [status, setStatus] = useState<"All" | "Active" | "Trial" | "Churned">("All");
  const [range, setRange] = useState<"3M" | "6M" | "12M">("6M");
  const [series, setSeries] = useState<CommissionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareholderDetails, setShareholderDetails] = useState<{ referral_code: string } | null>(null);

  const refUrl = shareholderDetails?.referral_code 
    ? `${window.location.origin}/auth/sign-up?ref=${shareholderDetails.referral_code}` 
    : "";

  // Fetch shareholder details including referral_code
  useEffect(() => {
    if (!shareholder?.id) return;
    
    const fetchShareholderDetails = async () => {
      const { data, error } = await supabase
        .from('shareholders')
        .select('referral_code')
        .eq('id', shareholder.id)
        .single();
      
      if (!error && data) {
        setShareholderDetails(data);
      }
    };
    
    fetchShareholderDetails();
  }, [shareholder?.id]);

  useEffect(() => {
    if (!shareholder) return;
    
    (async () => {
      try {
        setLoading(true);
        const [s, o, p] = await Promise.all([
          fetchSummary(),
          fetchOwners(status),
          fetchCommissionSeries(range),
        ]);
        setSummary(s);
        setOwners(o);
        setSeries(p);
      } catch (error) {
        console.error('Error loading dashboard:', error);
        toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลได้", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [shareholder]);

  useEffect(() => {
    if (!shareholder) return;
    (async () => {
      try {
        const o = await fetchOwners(status);
        setOwners(o);
      } catch (error) {
        console.error('Error fetching owners:', error);
      }
    })();
  }, [status, shareholder]);

  useEffect(() => {
    if (!shareholder) return;
    (async () => {
      try {
        const s = await fetchCommissionSeries(range);
        setSeries(s);
      } catch (error) {
        console.error('Error fetching commission series:', error);
      }
    })();
  }, [range, shareholder]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(refUrl);
    toast({ title: "คัดลอกลิงก์แล้ว", description: refUrl });
  };

  const csv = useMemo(() => {
    const header = ["ownerId", "businessName", "email", "createdAt", "status", "mrrTHB"].join(",");
    const rows = owners.map((r) => [r.ownerId, r.businessName, r.email, r.createdAt, r.status, r.mrr].join(","));
    return [header, ...rows].join("\n");
  }, [owners]);

  const downloadCSV = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `owners_${shareholder?.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadQR = () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-referral.png";
    a.click();
  };

  if (shareholderLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!shareholder) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">ไม่พบข้อมูล Shareholder</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">💰 แดชบอร์ด</h1>
          <div className="flex flex-col md:flex-row md:items-center gap-2 mt-1">
            <p className="text-muted-foreground">
              {shareholder.full_name}
            </p>
            {shareholder.public_id && (
              <Badge variant="secondary" className="font-mono text-sm w-fit">
                ID: {shareholder.public_id}
              </Badge>
            )}
          </div>
          {shareholderDetails?.referral_code && (
            <div className="mt-2">
              <Badge variant="outline" className="font-mono text-base px-3 py-1">
                🏷️ {shareholderDetails.referral_code}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Users} 
          title="Owner ทั้งหมด" 
          value={summary ? `${summary.totalOwners}` : "-"}
          gradient="border-l-primary bg-gradient-users"
        />
        <StatCard 
          icon={CheckCircle2} 
          title="Active Owner" 
          value={summary ? `${summary.activeOwners}` : "-"} 
          help={`อัตราอนุมัติ ~${summary?.approvalRate ?? "-"}%`}
          gradient="border-l-success bg-gradient-success"
        />
        <StatCard 
          icon={Wallet} 
          title="รายได้จากคอมมิชชัน/เดือน" 
          value={summary ? `${summary.monthlyRefRevenue.toLocaleString()} THB` : "-"}
          gradient="border-l-accent bg-gradient-withdrawal"
        />
        <StatCard 
          icon={Percent} 
          title="คอมมิชชันรอจ่าย" 
          value={summary ? `${summary.pendingCommission.toLocaleString()} THB` : "-"}
          gradient="border-l-warning bg-gradient-balance"
        />
      </div>

      {/* Chart - ลบ Referral Tools ออกแล้ว */}
      <Card className="shadow-md hover:shadow-glow transition-all duration-300 border-t-4 border-t-purple-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-xl">
            <span>📈 แนวโน้มคอมมิชชัน</span>
            <Select value={range} onValueChange={(v: any) => setRange(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3M">3M</SelectItem>
                <SelectItem value="6M">6M</SelectItem>
                <SelectItem value="12M">12M</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `${v.toLocaleString()} THB`} />
                <Line type="monotone" dataKey="commissionTHB" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Owners Table with Commission Details */}
      <Card className="shadow-md hover:shadow-glow transition-all duration-300 border-t-4 border-t-indigo-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-xl">
            <span>👥 Owner ที่มาจากคุณ (พร้อมสัดส่วน Commission)</span>
            <div className="flex items-center gap-2">
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Trial">Trial</SelectItem>
                  <SelectItem value="Churned">Churned</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={downloadCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Owner ID</th>
                  <th className="py-2 pr-4 font-medium">Business</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium text-right">Commission %</th>
                  <th className="py-2 pr-0 font-medium text-right">MRR (THB)</th>
                </tr>
              </thead>
              <tbody>
                {owners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      ยังไม่มี Owner ที่มาจาก referral link ของคุณ
                    </td>
                  </tr>
                ) : (
                  owners.map((o) => (
                    <tr key={o.ownerId} className="border-t hover:bg-accent/50 transition-colors">
                      <td className="py-2 pr-4 font-mono text-xs">{o.ownerId}</td>
                      <td className="py-2 pr-4 font-medium">{o.businessName}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{o.email}</td>
                      <td className="py-2 pr-4">{new Date(o.createdAt).toLocaleDateString('th-TH')}</td>
                      <td className="py-2 pr-4">
                        <Badge 
                          variant={
                            o.status === "Active" ? "default" : 
                            o.status === "Trial" ? "secondary" : 
                            "outline"
                          }
                        >
                          {o.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <Badge variant="outline" className="font-semibold text-primary">
                          {o.commission_rate ? `${o.commission_rate}%` : '5%'}
                        </Badge>
                      </td>
                      <td className="py-2 pr-0 text-right font-semibold">
                        {o.mrr.toLocaleString()} 
                        <span className="text-xs text-muted-foreground ml-1">
                          (คุณได้ {((o.mrr * (o.commission_rate || 5)) / 100).toLocaleString()})
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payouts */}
      <Card className="shadow-md hover:shadow-glow transition-all duration-300 border-t-4 border-t-emerald-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-5 w-5" /> 💰 คอมมิชชัน & Payouts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">สรุปคอมมิชชันล่าสุด</h3>
                <Badge variant="secondary">อัปเดตอัตโนมัติทุกเที่ยงคืน</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatMini 
                  title="คอมมิชชันรอจ่าย" 
                  value={summary ? `${summary.pendingCommission.toLocaleString()} THB` : "-"} 
                />
                <StatMini 
                  title="คอมมิชชันเดือนนี้" 
                  value={summary ? `${summary.monthlyRefRevenue.toLocaleString()} THB` : "-"} 
                />
                <StatMini 
                  title="อัตราอนุมัติ" 
                  value={summary ? `${summary.approvalRate}%` : "-"} 
                />
              </div>
            </div>
            <div className="col-span-1">
              <h3 className="text-lg font-semibold mb-3">ขอรับเงินโอน</h3>
              <PayoutRequestForm
                maxAmount={summary?.pendingCommission ?? 0}
                onSubmit={async (amt) => {
                  try {
                    const { data: sessionData } = await supabase.auth.getSession();
                    const token = sessionData.session?.access_token;

                    await supabase.functions.invoke('shareholder-payout-request', {
                      headers: { Authorization: `Bearer ${token}` },
                      body: { amount: amt },
                    });

                    toast({ title: "ส่งคำขอเรียบร้อย", description: `ยอด ${amt.toLocaleString()} THB` });
                  } catch (error) {
                    toast({ 
                      title: "เกิดข้อผิดพลาด", 
                      description: "ไม่สามารถส่งคำขอได้", 
                      variant: "destructive" 
                    });
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer Helper */}
      <div className="text-xs text-muted-foreground text-center pt-2">
        ข้อเสนอแนะ: ใช้ลิงก์นี้ในโฆษณา, บทความ, โปรไฟล์ Line OA และแนบ QR ในโปสเตอร์ออฟไลน์ เพื่อให้ระบบผูก Owner กับ Shareholder อัตโนมัติ
      </div>
    </div>
  );
}
