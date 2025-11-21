import { useState } from 'react';
import { format } from 'date-fns';
import { Shield, Trash2, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  blocked_at: string;
  blocked_until: string | null;
  is_permanent: boolean;
  violation_count: number;
  metadata: any;
}

interface BlockedIPsTableProps {
  blocks: BlockedIP[];
  onRefresh: () => void;
}

export function BlockedIPsTable({ blocks, onRefresh }: BlockedIPsTableProps) {
  const { toast } = useToast();
  const [selectedIP, setSelectedIP] = useState<string | null>(null);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const handleUnblock = async () => {
    if (!selectedIP) return;

    setIsUnblocking(true);
    try {
      const { error } = await supabase.functions.invoke('ip-blocks-manage', {
        body: { ipAddress: selectedIP },
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (error) throw error;

      toast({
        title: 'IP Unblocked',
        description: `IP address ${selectedIP} has been unblocked`,
      });

      onRefresh();
      setSelectedIP(null);
    } catch (error) {
      console.error('Error unblocking IP:', error);
      toast({
        title: 'Error',
        description: 'Failed to unblock IP address',
        variant: 'destructive',
      });
    } finally {
      setIsUnblocking(false);
    }
  };

  const isExpired = (blockedUntil: string | null, isPermanent: boolean) => {
    if (isPermanent || !blockedUntil) return false;
    return new Date(blockedUntil) < new Date();
  };

  // Pagination
  const totalPages = Math.ceil(blocks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBlocks = blocks.slice(startIndex, endIndex);

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>IP Address</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Violations</TableHead>
              <TableHead>Blocked At</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
            <TableBody>
              {paginatedBlocks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center py-8">
                      <Shield className="h-12 w-12 mb-2 opacity-50" />
                      <p>No blocked IPs</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBlocks.map((block) => (
                <TableRow key={block.id}>
                  <TableCell className="font-mono">{block.ip_address}</TableCell>
                  <TableCell>{block.reason}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{block.violation_count}</Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(block.blocked_at), 'MMM dd, HH:mm')}
                  </TableCell>
                  <TableCell>
                    {block.is_permanent ? (
                      <Badge variant="destructive">Permanent</Badge>
                    ) : isExpired(block.blocked_until, block.is_permanent) ? (
                      <Badge variant="secondary">Expired</Badge>
                    ) : (
                      <Badge variant="default">
                        Until {block.blocked_until ? format(new Date(block.blocked_until), 'MMM dd, HH:mm') : 'Forever'}
                      </Badge>
                    )}
                    {block.metadata?.auto_blocked && (
                      <Badge variant="outline" className="ml-2">Auto</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedIP(block.ip_address)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {blocks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">แสดง</Label>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => {
              setItemsPerPage(Number(value));
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">รายการ</span>
          </div>

          <div className="flex justify-center">
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ก่อนหน้า
                </Button>
                <div className="flex items-center gap-1 px-2">
                  <span className="text-sm">
                    {currentPage} / {totalPages}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  ถัดไป
                </Button>
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground text-right">
            แสดง {startIndex + 1}-{Math.min(endIndex, blocks.length)} จาก {blocks.length}
          </div>
        </div>
      )}
      </div>

      <AlertDialog open={!!selectedIP} onOpenChange={() => setSelectedIP(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock IP Address?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="flex items-start gap-2 mt-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  Are you sure you want to unblock <span className="font-mono font-semibold">{selectedIP}</span>? 
                  This will allow requests from this IP address again.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnblock} disabled={isUnblocking}>
              {isUnblocking ? 'Unblocking...' : 'Unblock'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
