import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { cn } from "@/lib/utils";

export const TenantSwitcher = () => {
  const [open, setOpen] = useState(false);
  const { memberships, activeTenantId, activeTenant, switchTenant, hasMultipleTenants } = useTenantSwitcher();

  if (!activeTenant || !activeTenant.tenants) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{activeTenant.tenants.name}</span>
          </div>
          {hasMultipleTenants && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      {hasMultipleTenants && (
        <PopoverContent className="w-[200px] p-0 bg-background border-border z-50">
          <Command className="bg-background">
            <CommandInput placeholder="Search workspace..." className="h-9" />
            <CommandEmpty>No workspace found.</CommandEmpty>
            <CommandGroup className="bg-background">
              {memberships.filter(m => m.tenants && m.roles).map((membership) => (
                <CommandItem
                  key={membership.tenant_id}
                  value={membership.tenants.name}
                  onSelect={() => {
                    switchTenant(membership.tenant_id);
                    setOpen(false);
                  }}
                  className="cursor-pointer hover:bg-accent"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Building2 className="h-4 w-4" />
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-medium">
                        {membership.tenants.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {membership.roles.name}
                      </span>
                    </div>
                  </div>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4",
                      activeTenantId === membership.tenant_id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
};
