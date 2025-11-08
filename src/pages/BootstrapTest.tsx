import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle, AlertCircle } from "lucide-react";

interface TestAccount {
  userId: string;
  fullName: string;
  password: string;
  role?: string;
  tenantId?: string;
}

const BootstrapTest = () => {
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<TestAccount[]>([]);
  const [error, setError] = useState("");

  const handleBootstrap = async () => {
    if (!secretKey) {
      setError("กรุณากรอก Secret Key");
      return;
    }

    setLoading(true);
    setError("");
    setAccounts([]);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'bootstrap-test-accounts',
        {
          body: { secret_key: secretKey },
        }
      );

      if (functionError) throw functionError;

      if (data.error) {
        throw new Error(data.error);
      }

      setAccounts(data.accounts);
      toast.success("สร้างบัญชีทดสอบสำเร็จ");
    } catch (err: any) {
      console.error("Bootstrap error:", err);
      setError(err.message || "เกิดข้อผิดพลาดในการสร้างบัญชีทดสอบ");
      toast.error(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("คัดลอกแล้ว");
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>Bootstrap Test Accounts</CardTitle>
          <CardDescription>
            สร้างบัญชีทดสอบทั้งหมดในคำสั่งเดียว (Super Admin, Shareholder, Owner, และ Admin Users)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>คำเตือน:</strong> ฟังก์ชันนี้ใช้สำหรับการทดสอบเท่านั้น อย่าใช้ในระบบจริง
            </AlertDescription>
          </Alert>

          {!accounts.length && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="secretKey" className="text-sm font-medium">
                  Secret Key
                </label>
                <Input
                  id="secretKey"
                  type="password"
                  placeholder="Enter bootstrap secret key"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Default: bootstrap-test-2024
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button onClick={handleBootstrap} disabled={loading} className="w-full">
                {loading ? "กำลังสร้างบัญชี..." : "สร้างบัญชีทดสอบทั้งหมด"}
              </Button>
            </div>
          )}

          {accounts.length > 0 && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  สร้างบัญชีทดสอบสำเร็จ! ใช้ข้อมูลด้านล่างเพื่อเข้าสู่ระบบ
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertDescription>
                  <strong>ขั้นตอนการใช้งาน:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>เข้าสู่ระบบด้วย User ID และรหัสผ่านชั่วคราว</li>
                    <li>สแกน QR Code เข้า Google Authenticator</li>
                    <li>กรอกรหัส 6 หลักจาก Authenticator เพื่อยืนยัน</li>
                    <li>เปลี่ยนรหัสผ่านเป็นรหัสผ่านใหม่</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>ชื่อ</TableHead>
                      <TableHead>บทบาท</TableHead>
                      <TableHead>องค์กร</TableHead>
                      <TableHead>รหัสผ่านชั่วคราว</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.userId}>
                        <TableCell className="font-mono font-semibold">
                          {account.userId}
                        </TableCell>
                        <TableCell>{account.fullName}</TableCell>
                        <TableCell>
                          <Badge variant={account.role === 'Super Admin' ? 'destructive' : 'default'}>
                            {account.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {account.tenantId || '-'}
                        </TableCell>
                        <TableCell className="font-mono">
                          {account.password}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${account.userId}\n${account.password}`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setAccounts([]);
                  setSecretKey("");
                }}
                className="w-full"
              >
                สร้างบัญชีใหม่อีกครั้ง
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BootstrapTest;
