import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import { RequireTenant } from '@/components/RequireTenant';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/lib/i18n';
import { 
  Book, 
  Download, 
  Code, 
  Terminal,
  FileCode,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const Docs = () => {
  const { t } = useI18n();
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);

  const { data: apiSpec, isLoading } = useQuery({
    queryKey: ['api-docs'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('api-docs');
      if (error) throw error;
      return data;
    },
  });

  const downloadPostman = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('api-docs', {
        body: {},
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'payment-platform-api.postman_collection.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Postman collection downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download Postman collection');
    }
  };

  const generateCodeSample = (path: string, method: string, spec: any) => {
    const baseUrl = apiSpec?.servers?.[0]?.url || '';
    const fullUrl = `${baseUrl}${path}`;

    const samples = {
      curl: `curl -X ${method.toUpperCase()} "${fullUrl}" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json"${spec.requestBody ? ` \\
  -d '${JSON.stringify(spec.requestBody.content['application/json'].schema.properties, null, 2)}'` : ''}`,

      typescript: `const response = await fetch('${fullUrl}', {
  method: '${method.toUpperCase()}',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
  },${spec.requestBody ? `
  body: JSON.stringify(${JSON.stringify(spec.requestBody.content['application/json'].schema.properties, null, 2)}),` : ''}
});

const data = await response.json();
console.log(data);`,

      python: `import requests

url = "${fullUrl}"
headers = {
    "Authorization": "Bearer YOUR_JWT_TOKEN",
    "Content-Type": "application/json"
}${spec.requestBody ? `
data = ${JSON.stringify(spec.requestBody.content['application/json'].schema.properties, null, 2)}

response = requests.${method}(url, headers=headers, json=data)` : `

response = requests.${method}(url, headers=headers)`}
print(response.json())`,
    };

    return samples;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <RequireTenant>
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/4"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        </RequireTenant>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Book className="w-8 h-8" />
                API Documentation
              </h1>
              <p className="text-muted-foreground">
                Complete reference for Payment Platform API v1.0.0
              </p>
            </div>
            <Button onClick={downloadPostman} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Download Postman Collection
            </Button>
          </div>

          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              This documentation is only accessible to users with owner or developer roles.
              API keys can be generated in Settings → API Keys.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Endpoints</CardTitle>
                <CardDescription>Available API endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {apiSpec?.paths && Object.entries(apiSpec.paths).map(([path, methods]: [string, any]) => (
                      <div key={path} className="space-y-1">
                        {Object.entries(methods).map(([method, spec]: [string, any]) => (
                          <button
                            key={`${path}-${method}`}
                            onClick={() => setSelectedEndpoint(`${path}-${method}`)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              selectedEndpoint === `${path}-${method}`
                                ? 'bg-primary/10 border-primary'
                                : 'border-border hover:bg-muted'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant={method === 'get' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {method.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate">
                                {spec.tags?.[0]}
                              </span>
                            </div>
                            <div className="text-sm font-mono truncate">{path}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {spec.summary}
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedEndpoint ? 'Endpoint Details' : 'Select an Endpoint'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedEndpoint ? (
                  <ScrollArea className="h-[600px]">
                    {(() => {
                      const [path, method] = selectedEndpoint.split('-');
                      const spec = apiSpec?.paths?.[path]?.[method];
                      const samples = generateCodeSample(path, method, spec);

                      return (
                        <div className="space-y-6">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={method === 'get' ? 'default' : 'secondary'}>
                                {method.toUpperCase()}
                              </Badge>
                              <code className="text-sm">{path}</code>
                            </div>
                            <h3 className="text-xl font-semibold">{spec.summary}</h3>
                            <p className="text-muted-foreground mt-1">{spec.description}</p>
                          </div>

                          <Separator />

                          {spec.requestBody && (
                            <div>
                              <h4 className="font-semibold mb-2">Request Body</h4>
                              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                                <code>
                                  {JSON.stringify(
                                    spec.requestBody.content['application/json'].schema,
                                    null,
                                    2
                                  )}
                                </code>
                              </pre>
                            </div>
                          )}

                          <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <Code className="w-4 h-4" />
                              Code Samples
                            </h4>
                            <Tabs defaultValue="curl">
                              <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="curl" className="gap-2">
                                  <Terminal className="w-4 h-4" />
                                  cURL
                                </TabsTrigger>
                                <TabsTrigger value="typescript" className="gap-2">
                                  <FileCode className="w-4 h-4" />
                                  TypeScript
                                </TabsTrigger>
                                <TabsTrigger value="python" className="gap-2">
                                  <FileCode className="w-4 h-4" />
                                  Python
                                </TabsTrigger>
                              </TabsList>
                              <TabsContent value="curl">
                                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                                  <code>{samples.curl}</code>
                                </pre>
                              </TabsContent>
                              <TabsContent value="typescript">
                                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                                  <code>{samples.typescript}</code>
                                </pre>
                              </TabsContent>
                              <TabsContent value="python">
                                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                                  <code>{samples.python}</code>
                                </pre>
                              </TabsContent>
                            </Tabs>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-2">Responses</h4>
                            <div className="space-y-2">
                              {Object.entries(spec.responses).map(([code, response]: [string, any]) => (
                                <div key={code} className="border border-border rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={code === '200' ? 'default' : 'destructive'}>
                                      {code}
                                    </Badge>
                                    <span className="text-sm">{response.description}</span>
                                  </div>
                                  {response.content && (
                                    <pre className="bg-muted p-2 rounded mt-2 text-xs overflow-x-auto">
                                      <code>
                                        {JSON.stringify(
                                          response.content['application/json']?.schema || {},
                                          null,
                                          2
                                        )}
                                      </code>
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </ScrollArea>
                ) : (
                  <div className="flex items-center justify-center h-[600px] text-muted-foreground">
                    <div className="text-center">
                      <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Select an endpoint to view documentation</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
};

export default Docs;
