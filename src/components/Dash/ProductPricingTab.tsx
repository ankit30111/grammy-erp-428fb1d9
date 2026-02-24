import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator } from "lucide-react";

interface ProductPricingTabProps {
  form: Record<string, any>;
  setForm: (f: Record<string, any>) => void;
}

export default function ProductPricingTab({ form, setForm }: ProductPricingTabProps) {
  const purchasePrice = Number(form.purchase_price) || 0;
  const gstPercent = Number(form.gst_percent) || 18;
  const nlc = Math.round((purchasePrice * 1.10) * (1 + gstPercent / 100) * 100) / 100;
  const dp = Math.round((nlc * 1.10) * (1 + gstPercent / 100) * 100) / 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Purchase Price (Base Price without GST) *</Label>
          <Input
            type="number"
            value={form.purchase_price || ""}
            onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })}
            placeholder="Enter base price..."
          />
        </div>

        <div className="space-y-2">
          <Label>GST %</Label>
          <Input
            type="number"
            value={form.gst_percent ?? 18}
            onChange={(e) => setForm({ ...form, gst_percent: Number(e.target.value) })}
          />
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Calculator className="h-4 w-4" />
            Auto-Calculated Pricing
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <Label>NLC (Net Landing Cost)</Label>
              <Input value={`₹ ${nlc.toLocaleString("en-IN")}`} readOnly className="bg-muted font-semibold" />
              <p className="text-xs text-muted-foreground">
                = (Purchase Price × 1.10) × (1 + GST%/100)
              </p>
              <p className="text-xs text-muted-foreground">
                = ({purchasePrice} × 1.10) × (1 + {gstPercent}/100) = ₹{nlc}
              </p>
            </div>

            <div className="space-y-1">
              <Label>DP (Dealer Price)</Label>
              <Input value={`₹ ${dp.toLocaleString("en-IN")}`} readOnly className="bg-muted font-semibold" />
              <p className="text-xs text-muted-foreground">
                = (NLC × 1.10) × (1 + GST%/100)
              </p>
              <p className="text-xs text-muted-foreground">
                = ({nlc} × 1.10) × (1 + {gstPercent}/100) = ₹{dp}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Purchase Price</p>
              <p className="text-lg font-bold">₹{purchasePrice.toLocaleString("en-IN")}</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">NLC</p>
              <p className="text-lg font-bold">₹{nlc.toLocaleString("en-IN")}</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">DP</p>
              <p className="text-lg font-bold">₹{dp.toLocaleString("en-IN")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>MRP (₹)</Label>
              <Input value={`₹ ${(Number(form.mrp) || 0).toLocaleString("en-IN")}`} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Dealer Price (Legacy)</Label>
              <Input
                type="number"
                value={form.dealer_price || 0}
                onChange={(e) => setForm({ ...form, dealer_price: Number(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
