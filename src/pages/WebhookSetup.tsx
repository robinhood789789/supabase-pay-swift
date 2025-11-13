import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Webhook, Server, Code, ArrowRight } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const formSchema = z.object({
  url: z.string().url({ message: "กรุณากรอก URL ที่ถูกต้อง" }),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "กรุณายอมรับข้อกำหนดการใช้บริการ",
  }),
});

type FormData = z.infer<typeof formSchema>;

export default function WebhookSetup() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ไม่พบข้อมูลผู้ใช้");

      // Get tenant_id from memberships
      const { data: membership } = await supabase
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) throw new Error("ไม่พบข้อมูล tenant");

      // Insert webhook configuration  
      const { error } = await supabase.from("webhooks").insert([{
        tenant_id: membership.tenant_id,
        url: data.url,
        secret: crypto.randomUUID(), // Generate a secret for signature verification
        description: "Webhook สำหรับแจ้งการรับเงิน",
        events: ["payment.completed", "payment.failed", "deposit.completed"],
        enabled: true,
      }]);

      if (error) throw error;

      toast.success("บันทึกการตั้งค่า Webhook สำเร็จ");
      form.reset();
    } catch (error: any) {
      console.error("Error setting up webhook:", error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card className="overflow-hidden">
          {/* Hero Section */}
          <div className="relative bg-gradient-to-r from-primary via-primary/90 to-primary/80 p-8 md:p-12">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="p-3 bg-white/10 backdrop-blur-sm rounded-lg">
                  <Webhook className="w-8 h-8 text-primary-foreground" />
                </div>
                <ArrowRight className="w-6 h-6 text-primary-foreground/80" />
                <div className="p-3 bg-white/10 backdrop-blur-sm rounded-lg">
                  <Code className="w-8 h-8 text-primary-foreground" />
                </div>
                <ArrowRight className="w-6 h-6 text-primary-foreground/80" />
                <div className="p-3 bg-white/10 backdrop-blur-sm rounded-lg">
                  <Server className="w-8 h-8 text-primary-foreground" />
                </div>
              </div>
              
              <h1 className="text-2xl md:text-3xl font-bold text-primary-foreground text-center mb-2">
                บริการแจ้งการรับเงินผ่าน Webhook API
              </h1>
              <p className="text-primary-foreground/90 text-center text-sm md:text-base">
                PayX Payment Gateway
              </p>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-6 md:p-8">
            <div className="mb-6">
              <p className="text-muted-foreground leading-relaxed">
                เมื่อมีรายการรับเงินโอนจากบัญชีวอลเล็ทอื่น หรือเติมเงินผ่านธนาคาร/ช่องทางต่างๆ 
                ระบบจะยิง API (Webhook) แจ้งการรับเงิน/เติมเงิน ไปยัง URL ปลายทางของผู้ใช้งานทันที
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">
                        Endpoint URL ที่จะยิงแจ้ง:
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="กรอกลิงก์ URL"
                          {...field}
                          className="h-12"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm text-muted-foreground font-normal leading-relaxed">
                          ยอมรับข้อกำหนดการใช้บริการนี้ โดยตะใช้ต้อง API ให้กับ URL 
                          ปลายทางที่กรอกไว้ ให้ตัวเจ้าของทำนั้น โดยอนุญาตให้มีเพื่อส่งผ่าน 
                          ความละเอียดในการตรวจสอบการรับเงินมาทันทีเท่านั้น โดยทาง ส่งข้อมูลสิทธิณะ 
                          webhook นี้ อาจจะความครบถ้วน หรือช้าให้ได้ ฉบับนี้ ผู้ใช้งานควรตัดความ 
                          ถูกต้องของรับการ รับเงิน จากหน้า{" "}
                          <a href="#" className="text-primary hover:underline">
                            ประวัติการทำรายการ
                          </a>{" "}
                          เท่านั้น
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  ส่งข้อมูล
                </Button>
              </form>
            </Form>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
