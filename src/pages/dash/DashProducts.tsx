import { useState } from "react";
import { DashLayout } from "@/components/Layout/DashLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useDashProducts, useDashProductMutations } from "@/hooks/useDashProducts";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import ProductListView from "@/components/Dash/ProductListView";
import ProductBasicInfoTab from "@/components/Dash/ProductBasicInfoTab";
import ProductPricingTab from "@/components/Dash/ProductPricingTab";
import ProductSpecsTab from "@/components/Dash/ProductSpecsTab";
import ProductSparesTab from "@/components/Dash/ProductSparesTab";
import ProductDocumentsTab from "@/components/Dash/ProductDocumentsTab";
import ProductComplianceTab from "@/components/Dash/ProductComplianceTab";

const defaultForm = (): Record<string, any> => ({
  product_name: "", model_number: "", category: "Other",
  description: "", mrp: 0, dealer_price: 0, distributor_price: 0,
  barcode_ean: "", warranty_period_months: 12, status: "Development",
  hsn_code: "", purchase_price: 0, gst_percent: 18,
  serial_prefix: "", serial_next_number: 1,
  gross_weight: null, net_weight: null,
  software_button_details: "", branding_info: "",
  qa_checklist: [], technical_specs: "",
});

export default function DashProducts() {
  const { data: products, isLoading } = useDashProducts();
  const { addProduct, updateProduct } = useDashProductMutations();
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>(defaultForm());
  const [activeTab, setActiveTab] = useState("basic");

  const openAdd = () => {
    setSelectedProduct(null);
    setForm(defaultForm());
    setActiveTab("basic");
    setView("detail");
  };

  const openEdit = (product: any) => {
    setSelectedProduct(product);
    setForm({
      product_name: product.product_name || "",
      model_number: product.model_number || "",
      category: product.category || "Other",
      description: product.description || "",
      mrp: product.mrp || 0,
      dealer_price: product.dealer_price || 0,
      distributor_price: product.distributor_price || 0,
      barcode_ean: product.barcode_ean || "",
      warranty_period_months: product.warranty_period_months || 12,
      status: product.status || "Active",
      hsn_code: product.hsn_code || "",
      purchase_price: product.purchase_price || 0,
      gst_percent: product.gst_percent ?? 18,
      serial_prefix: product.serial_prefix || "",
      serial_next_number: product.serial_next_number || 1,
      gross_weight: product.gross_weight,
      net_weight: product.net_weight,
      software_button_details: product.software_button_details || "",
      branding_info: product.branding_info || "",
      qa_checklist: product.qa_checklist || [],
      technical_specs: product.technical_specs || "",
    });
    setActiveTab("basic");
    setView("detail");
  };

  const handleSave = () => {
    const modelNumber = form.model_number === "__new__" ? form.new_model_number : form.model_number;
    const payload: any = { ...form, model_number: modelNumber };
    delete payload.new_model_number;

    // Parse technical_specs if string
    if (typeof payload.technical_specs === "string" && payload.technical_specs.trim()) {
      try { payload.technical_specs = JSON.parse(payload.technical_specs); } catch { /* keep as string in jsonb */ }
    }

    if (selectedProduct) {
      updateProduct.mutate({ id: selectedProduct.id, ...payload }, {
        onSuccess: (data) => {
          setSelectedProduct(data);
        },
      });
    } else {
      addProduct.mutate(payload, {
        onSuccess: (data) => {
          setSelectedProduct(data);
        },
      });
    }
  };

  return (
    <DashLayout>
      <div className="space-y-6">
        {view === "list" ? (
          <>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Product Master</h1>
              <p className="text-muted-foreground">DASH SKU catalog — pricing, specs, compliance & documents</p>
            </div>
            <ProductListView
              products={products}
              isLoading={isLoading}
              onAddNew={openAdd}
              onSelect={openEdit}
            />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setView("list")}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {selectedProduct ? `Edit: ${selectedProduct.product_name}` : "New Product"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {selectedProduct ? selectedProduct.model_number : "Fill in product details across all tabs"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setView("list")}>Cancel</Button>
                <Button
                  onClick={handleSave}
                  disabled={!form.product_name || (!form.model_number || (form.model_number === "__new__" && !form.new_model_number)) || addProduct.isPending || updateProduct.isPending}
                >
                  {(addProduct.isPending || updateProduct.isPending) ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {selectedProduct ? "Update" : "Save as Draft"}
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-6 flex-wrap h-auto gap-1">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="pricing">Pricing</TabsTrigger>
                    <TabsTrigger value="specs">Specs</TabsTrigger>
                    <TabsTrigger value="spares">Spares</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="compliance">Compliance</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic">
                    <ProductBasicInfoTab form={form} setForm={setForm} isEditing={!!selectedProduct} />
                  </TabsContent>
                  <TabsContent value="pricing">
                    <ProductPricingTab form={form} setForm={setForm} />
                  </TabsContent>
                  <TabsContent value="specs">
                    <ProductSpecsTab form={form} setForm={setForm} />
                  </TabsContent>
                  <TabsContent value="spares">
                    <ProductSparesTab productId={selectedProduct?.id} />
                  </TabsContent>
                  <TabsContent value="documents">
                    <ProductDocumentsTab productId={selectedProduct?.id} />
                  </TabsContent>
                  <TabsContent value="compliance">
                    <ProductComplianceTab productId={selectedProduct?.id} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashLayout>
  );
}
