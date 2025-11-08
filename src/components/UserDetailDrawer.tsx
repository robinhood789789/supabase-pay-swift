import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Activity,
  MapPin,
  Monitor
} from "lucide-react";
import { format } from "date-fns";

interface UserDetailDrawerProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserDetailDrawer = ({ userId, open, onOpenChange }: UserDetailDrawerProps) => {
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId && open,
  });

  const { data: membership } = useQuery({
    queryKey: ["user-membership", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("*, roles(name, description), tenants(name)")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId && open,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["user-activities", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("actor_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!userId && open,
  });

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('create')) return 'default';
    if (action.includes('update')) return 'secondary';
    if (action.includes('delete') || action.includes('revoke')) return 'destructive';
    return 'outline';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>User Details</SheetTitle>
          <SheetDescription>
            Detailed information and activity history for this user
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          {profileLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-6">
              {/* Profile Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{profile?.full_name || "Not set"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{profile?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Public ID</p>
                      <p className="font-medium font-mono text-xs">{profile?.public_id || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Role</p>
                      <Badge variant="secondary">
                        {membership?.roles?.name || "No Role"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">2FA Status</p>
                      {profile?.totp_enabled ? (
                        <Badge variant="default">Enabled</Badge>
                      ) : (
                        <Badge variant="outline">Disabled</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Joined</p>
                      <p className="font-medium">
                        {format(new Date(profile?.created_at), "PPP")}
                      </p>
                    </div>
                  </div>
                  {profile?.mfa_last_verified_at && (
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Last 2FA Verification</p>
                        <p className="font-medium">
                          {format(new Date(profile.mfa_last_verified_at), "PPp")}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity Feed */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activitiesLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading activities...
                    </div>
                  ) : activities && activities.length > 0 ? (
                    <div className="space-y-4">
                      {activities.map((activity) => (
                        <div key={activity.id} className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={getActionBadgeVariant(activity.action)}>
                                  {activity.action}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(activity.created_at), "PPp")}
                                </span>
                              </div>
                              {activity.target && (
                                <p className="text-sm text-muted-foreground font-mono">
                                  Target: {activity.target}
                                </p>
                              )}
                              {activity.ip && (
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <MapPin className="w-3 h-3" />
                                  {activity.ip}
                                </div>
                              )}
                              {activity.user_agent && (
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <Monitor className="w-3 h-3" />
                                  <span className="truncate max-w-sm">
                                    {activity.user_agent}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <Separator />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No recent activity</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
