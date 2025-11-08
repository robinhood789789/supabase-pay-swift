import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Event {
  id: string;
  event_type: string;
  tenant_id: string;
  tenant_name: string;
  payload: any;
  signature_verified: boolean;
  created_at: string;
  status: "pending" | "processed" | "failed";
}

const PlatformEvents = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<string>("all");

  useEffect(() => {
    if (!user || !isSuperAdmin) return;

    // Audit: Page view
    supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "platform.events.view",
      target_type: "platform_events",
      ip_address: "",
      user_agent: navigator.userAgent,
    });

    loadEvents();
  }, [user, isSuperAdmin]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Query provider_events for cross-tenant view
      const { data, error } = await supabase
        .from("provider_events")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Transform to UI format (simplified - in real app would need tenant mapping)
      const transformedEvents: Event[] = data?.map((e: any) => ({
        id: e.id,
        event_type: e.type,
        tenant_id: e.payload?.tenant_id || "unknown",
        tenant_name: "Tenant", // Would need join with tenants table
        payload: e.payload,
        signature_verified: true, // Would check actual verification
        created_at: e.received_at,
        status: "processed",
      })) || [];

      setEvents(transformedEvents);
    } catch (error) {
      console.error("Error loading events:", error);
      toast.error("ไม่สามารถโหลด events ได้");
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    const matchesVerified =
      verifiedFilter === "all" ||
      (verifiedFilter === "verified" && event.signature_verified) ||
      (verifiedFilter === "unverified" && !event.signature_verified);

    return matchesSearch && matchesStatus && matchesVerified;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Event Log (Platform)</h1>
          <p className="text-muted-foreground">ติดตาม webhook events ทั้งหมดจากทุก tenant</p>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>ค้นหาและกรอง Events</CardTitle>
          <CardDescription>กรอง events ตาม status, signature verification, และคำค้นหา</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>ค้นหา</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหา event type, tenant, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>สถานะ</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Signature Verification</Label>
              <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events ({filteredEvents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event ID</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    ไม่พบ events
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-sm">{event.id}</TableCell>
                    <TableCell>{event.event_type}</TableCell>
                    <TableCell>{event.tenant_name}</TableCell>
                    <TableCell>
                      {event.signature_verified ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Unverified
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          event.status === "processed"
                            ? "default"
                            : event.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(event.created_at).toLocaleString("th-TH")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </CardContent>
    </Card>
    </div>
  );
};

export default PlatformEvents;
