import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export const MyActivityPanel = () => {
  const { user } = useAuth();
  const { activeTenantId } = useTenantSwitcher();

  const { data: todayActivities, isLoading } = useQuery({
    queryKey: ["my-activity", user?.id, activeTenantId],
    queryFn: async () => {
      if (!user?.id || !activeTenantId) return [];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("actor_user_id", user.id)
        .eq("tenant_id", activeTenantId)
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!activeTenantId,
  });

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('create')) return 'default';
    if (action.includes('update')) return 'secondary';
    if (action.includes('delete') || action.includes('revoke')) return 'destructive';
    return 'outline';
  };

  const actionCounts = todayActivities?.reduce((acc, activity) => {
    const actionType = activity.action.split(':')[0];
    acc[actionType] = (acc[actionType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          My Activity Today
        </CardTitle>
        <CardDescription>
          Your actions and remaining limits for today
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Activity Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Total Actions</span>
                </div>
                <p className="text-2xl font-bold">{todayActivities?.length || 0}</p>
              </div>
              {actionCounts && Object.entries(actionCounts).slice(0, 1).map(([type, count]) => (
                <div key={type} className="p-4 bg-secondary/5 rounded-lg">
                  <span className="text-sm text-muted-foreground capitalize">{type}s</span>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              ))}
            </div>

            {/* Recent Actions */}
            <div>
              <h4 className="text-sm font-medium mb-3">Recent Actions</h4>
              <ScrollArea className="h-[400px]">
                {todayActivities && todayActivities.length > 0 ? (
                  <div className="space-y-3">
                    {todayActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Badge
                              variant={getActionBadgeVariant(activity.action)}
                              className="mb-2"
                            >
                              {activity.action}
                            </Badge>
                            {activity.target && (
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                {activity.target}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(activity.created_at), "HH:mm:ss")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No activity today</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
