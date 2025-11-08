import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <div className="flex gap-1">
        <Button
          variant={locale === 'th' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setLocale('th')}
          className="h-8 px-3"
        >
          ไทย
        </Button>
        <Button
          variant={locale === 'en' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setLocale('en')}
          className="h-8 px-3"
        >
          EN
        </Button>
      </div>
    </div>
  );
}
