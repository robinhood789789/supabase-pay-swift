import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";

const StyleGuide = () => {
  const colors = [
    { name: "Primary", var: "--primary", class: "bg-primary text-primary-foreground" },
    { name: "Secondary", var: "--secondary", class: "bg-secondary text-secondary-foreground" },
    { name: "Accent", var: "--accent", class: "bg-accent text-accent-foreground" },
    { name: "Muted", var: "--muted", class: "bg-muted text-muted-foreground" },
    { name: "Success", var: "--success", class: "bg-success text-success-foreground" },
    { name: "Warning", var: "--warning", class: "bg-warning text-warning-foreground" },
    { name: "Destructive", var: "--destructive", class: "bg-destructive text-destructive-foreground" },
    { name: "Card", var: "--card", class: "bg-card text-card-foreground border" },
  ];

  const gradients = [
    { name: "Primary", class: "bg-gradient-primary" },
    { name: "Success", class: "bg-gradient-success" },
    { name: "Deposit", class: "bg-gradient-deposit" },
    { name: "Withdrawal", class: "bg-gradient-withdrawal" },
    { name: "Balance", class: "bg-gradient-balance" },
    { name: "Activity", class: "bg-gradient-activity" },
    { name: "Neon", class: "bg-gradient-neon" },
    { name: "Aurora", class: "bg-gradient-aurora" },
  ];

  const shadows = [
    { name: "Small", class: "shadow-sm" },
    { name: "Medium", class: "shadow-md" },
    { name: "Large", class: "shadow-lg" },
    { name: "Glow", class: "shadow-glow" },
    { name: "Elegant", class: "shadow-elegant" },
    { name: "Neon", class: "shadow-neon" },
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Design System Style Guide
        </h1>
        <p className="text-muted-foreground">
          คู่มือการใช้งาน design system สำหรับระบบ Payment Gateway
        </p>
      </div>

      <Separator />

      {/* Colors Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Color Palette</h2>
          <p className="text-muted-foreground">สีพื้นฐานที่ใช้ในระบบ</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {colors.map((color) => (
            <Card key={color.name} className="overflow-hidden">
              <div className={`h-24 ${color.class} flex items-center justify-center font-semibold`}>
                {color.name}
              </div>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground font-mono">{color.var}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Gradients Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Gradient Effects</h2>
          <p className="text-muted-foreground">Gradients สำหรับสร้าง visual effects</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {gradients.map((gradient) => (
            <Card key={gradient.name} className="overflow-hidden">
              <div className={`h-24 ${gradient.class} flex items-center justify-center font-semibold text-white`}>
                {gradient.name}
              </div>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{gradient.class}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Shadows Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Shadow Effects</h2>
          <p className="text-muted-foreground">Shadow และ glow effects</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {shadows.map((shadow) => (
            <Card key={shadow.name}>
              <CardContent className="p-6">
                <div className={`h-20 bg-card rounded-lg ${shadow.class} flex items-center justify-center font-semibold`}>
                  {shadow.name}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Typography Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Typography</h2>
          <p className="text-muted-foreground">ขนาดและน้ำหนักของตัวอักษร</p>
        </div>
        
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h1 className="text-4xl font-bold">Heading 1</h1>
              <p className="text-xs text-muted-foreground">text-4xl font-bold</p>
            </div>
            <div>
              <h2 className="text-3xl font-semibold">Heading 2</h2>
              <p className="text-xs text-muted-foreground">text-3xl font-semibold</p>
            </div>
            <div>
              <h3 className="text-2xl font-semibold">Heading 3</h3>
              <p className="text-xs text-muted-foreground">text-2xl font-semibold</p>
            </div>
            <div>
              <h4 className="text-xl font-medium">Heading 4</h4>
              <p className="text-xs text-muted-foreground">text-xl font-medium</p>
            </div>
            <div>
              <p className="text-base">Body Text - Lorem ipsum dolor sit amet</p>
              <p className="text-xs text-muted-foreground">text-base</p>
            </div>
            <div>
              <p className="text-sm">Small Text - Lorem ipsum dolor sit amet</p>
              <p className="text-xs text-muted-foreground">text-sm</p>
            </div>
            <div>
              <p className="text-xs">Extra Small Text - Lorem ipsum dolor sit amet</p>
              <p className="text-xs text-muted-foreground">text-xs</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Buttons Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Buttons</h2>
          <p className="text-muted-foreground">ปุ่มต่างๆ ในระบบ</p>
        </div>
        
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium">Default Variants</p>
              <div className="flex flex-wrap gap-2">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Sizes</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon">
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />
            
            <div className="space-y-2">
              <p className="text-sm font-medium">States</p>
              <div className="flex flex-wrap gap-2">
                <Button>Normal</Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Badges Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Badges</h2>
          <p className="text-muted-foreground">สถานะและ labels</p>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Alerts Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Alerts</h2>
          <p className="text-muted-foreground">การแจ้งเตือนและข้อความสำคัญ</p>
        </div>
        
        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>
              ข้อมูลทั่วไปหรือข้อแนะนำสำหรับผู้ใช้
            </AlertDescription>
          </Alert>

          <Alert className="border-success text-success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              การดำเนินการสำเร็จแล้ว
            </AlertDescription>
          </Alert>

          <Alert className="border-warning text-warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              คำเตือนหรือข้อควรระวัง
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              เกิดข้อผิดพลาดในระบบ
            </AlertDescription>
          </Alert>
        </div>
      </section>

      <Separator />

      {/* Form Elements Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Form Elements</h2>
          <p className="text-muted-foreground">ฟอร์มและ input fields</p>
        </div>
        
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Input</label>
              <Input placeholder="Enter text here..." />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Disabled Input</label>
              <Input placeholder="Disabled" disabled />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Input with Icon</label>
              <div className="relative">
                <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="With icon" className="pl-10" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Cards Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Cards</h2>
          <p className="text-muted-foreground">Container components</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>Card description text</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Card content goes here</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-primary text-white">
            <CardHeader>
              <CardTitle>Gradient Card</CardTitle>
              <CardDescription className="text-white/80">
                Card with gradient background
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Gradient card content</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* Usage Guidelines */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Usage Guidelines</h2>
          <p className="text-muted-foreground">แนวทางการใช้งาน design system</p>
        </div>
        
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. ใช้ Semantic Tokens</h3>
              <p className="text-sm text-muted-foreground">
                ใช้สีจาก design system เช่น <code className="bg-muted px-1 rounded">bg-primary</code>, 
                <code className="bg-muted px-1 rounded ml-1">text-foreground</code> แทนการใช้สีโดยตรง
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">2. รักษา Consistency</h3>
              <p className="text-sm text-muted-foreground">
                ใช้ components และ styles ที่กำหนดไว้เพื่อความสม่ำเสมอทั้งระบบ
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">3. Responsive Design</h3>
              <p className="text-sm text-muted-foreground">
                ใช้ Tailwind breakpoints <code className="bg-muted px-1 rounded">md:</code>, 
                <code className="bg-muted px-1 rounded ml-1">lg:</code> เพื่อรองรับทุกขนาดหน้าจอ
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">4. Accessibility</h3>
              <p className="text-sm text-muted-foreground">
                ใช้ contrast ratio ที่เหมาะสม และเพิ่ม aria labels สำหรับ screen readers
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default StyleGuide;
