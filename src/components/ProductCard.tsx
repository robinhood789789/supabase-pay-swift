import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface ProductCardProps {
  title: string;
  price: string;
  period?: string;
  features: string[];
  popular?: boolean;
  onSelect: () => void;
}

const ProductCard = ({ title, price, period, features, popular, onSelect }: ProductCardProps) => {
  return (
    <Card className={`relative transition-all duration-300 hover:shadow-lg hover:scale-105 ${
      popular ? "border-primary shadow-glow" : ""
    }`}>
      {popular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary text-white">
          ยอดนิยม
        </Badge>
      )}
      
      <CardHeader className="text-center pb-4">
        <h3 className="text-2xl font-bold text-foreground">{title}</h3>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-foreground">{price}</span>
            {period && <span className="text-muted-foreground">/{period}</span>}
          </div>
        </div>

        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
              <span className="text-sm text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button 
          onClick={onSelect}
          variant={popular ? "gradient" : "outline"}
          className="w-full"
          size="lg"
        >
          เลือกแพ็กเกจนี้
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
