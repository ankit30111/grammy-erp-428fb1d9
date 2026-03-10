import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Loader2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useDashProductSpecs, useDashProductSpecsMutations, useDashProductQCChecklist, useDashProductQCChecklistMutations } from "@/hooks/useDashProducts";

const QC_CATEGORIES = ["audio", "electrical", "mechanical", "packaging", "compliance", "software"];

interface ProductSpecsTabProps {
  form: Record<string, any>;
  setForm: (f: Record<string, any>) => void;
  productId?: string;
}

export default function ProductSpecsTab({ form, setForm, productId }: ProductSpecsTabProps) {
  const { data: specs } = useDashProductSpecs(productId);
  const { upsertSpecs } = useDashProductSpecsMutations();
  const { data: qcItems } = useDashProductQCChecklist(productId);
  const { addItem: addQCItem, deleteItem: deleteQCItem } = useDashProductQCChecklistMutations();

  const [specsForm, setSpecsForm] = useState({
    power_output: "",
    frequency_response: "",
    connectivity: [] as string[],
    dimensions_l: "",
    dimensions_w: "",
    dimensions_h: "",
    weight_kg: "",
    color_variants: [] as string[],
    box_contents: [] as string[],
    country_of_origin: "India",
    custom_specs: {} as Record<string, string>,
  });

  const [newConnectivity, setNewConnectivity] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newBoxItem, setNewBoxItem] = useState("");
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");
  const [newQCParam, setNewQCParam] = useState("");
  const [newQCCategory, setNewQCCategory] = useState("audio");
  const [newQCExpected, setNewQCExpected] = useState("");

  useEffect(() => {
    if (specs) {
      setSpecsForm({
        power_output: specs.power_output || "",
        frequency_response: specs.frequency_response || "",
        connectivity: (specs.connectivity as string[]) || [],
        dimensions_l: specs.dimensions_l?.toString() || "",
        dimensions_w: specs.dimensions_w?.toString() || "",
        dimensions_h: specs.dimensions_h?.toString() || "",
        weight_kg: specs.weight_kg?.toString() || "",
        color_variants: (specs.color_variants as string[]) || [],
        box_contents: (specs.box_contents as string[]) || [],
        country_of_origin: specs.country_of_origin || "India",
        custom_specs: (specs.custom_specs as Record<string, string>) || {},
      });
    }
  }, [specs]);

  const handleSaveSpecs = () => {
    if (!productId) return;
    upsertSpecs.mutate({
      product_id: productId,
      power_output: specsForm.power_output || null,
      frequency_response: specsForm.frequency_response || null,
      connectivity: specsForm.connectivity,
      dimensions_l: specsForm.dimensions_l ? Number(specsForm.dimensions_l) : null,
      dimensions_w: specsForm.dimensions_w ? Number(specsForm.dimensions_w) : null,
      dimensions_h: specsForm.dimensions_h ? Number(specsForm.dimensions_h) : null,
      weight_kg: specsForm.weight_kg ? Number(specsForm.weight_kg) : null,
      color_variants: specsForm.color_variants,
      box_contents: specsForm.box_contents,
      country_of_origin: specsForm.country_of_origin,
      custom_specs: specsForm.custom_specs,
    });
  };

  const addTag = (field: "connectivity" | "color_variants" | "box_contents", value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    setSpecsForm({ ...specsForm, [field]: [...specsForm[field], value.trim()] });
    setter("");
  };

  const removeTag = (field: "connectivity" | "color_variants" | "box_contents", index: number) => {
    setSpecsForm({ ...specsForm, [field]: specsForm[field].filter((_, i) => i !== index) });
  };

  const addCustomSpec = () => {
    if (!newSpecKey.trim()) return;
    setSpecsForm({ ...specsForm, custom_specs: { ...specsForm.custom_specs, [newSpecKey.trim()]: newSpecValue.trim() } });
    setNewSpecKey("");
    setNewSpecValue("");
  };

  const removeCustomSpec = (key: string) => {
    const { [key]: _, ...rest } = specsForm.custom_specs;
    setSpecsForm({ ...specsForm, custom_specs: rest });
  };

  const handleAddQCItem = () => {
    if (!newQCParam.trim() || !productId) return;
    addQCItem.mutate({
      product_id: productId,
      parameter_name: newQCParam.trim(),
      parameter_category: newQCCategory,
      expected_value: newQCExpected.trim() || null,
    });
    setNewQCParam("");
    setNewQCExpected("");
  };

  if (!productId) {
    return <p className="text-muted-foreground text-center py-8">Save the product first to manage specs.</p>;
  }

  const TagInput = ({ label, items, newValue, setNewValue, field }: {
    label: string; items: string[]; newValue: string; setNewValue: (v: string) => void;
    field: "connectivity" | "color_variants" | "box_contents";
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={`Add ${label.toLowerCase()}...`}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(field, newValue, setNewValue))}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => addTag(field, newValue, setNewValue)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((item, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {item}
              <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(field, i)} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Audio & Connectivity */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Audio & Connectivity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Power Output</Label>
            <Input value={specsForm.power_output} onChange={(e) => setSpecsForm({ ...specsForm, power_output: e.target.value })} placeholder="e.g. 120W RMS" />
          </div>
          <div className="space-y-2">
            <Label>Frequency Response</Label>
            <Input value={specsForm.frequency_response} onChange={(e) => setSpecsForm({ ...specsForm, frequency_response: e.target.value })} placeholder="e.g. 50Hz – 20kHz" />
          </div>
        </div>
        <TagInput label="Connectivity" items={specsForm.connectivity} newValue={newConnectivity} setNewValue={setNewConnectivity} field="connectivity" />
      </div>

      {/* Physical */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Physical Dimensions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Length (cm)</Label>
            <Input type="number" step="0.1" value={specsForm.dimensions_l} onChange={(e) => setSpecsForm({ ...specsForm, dimensions_l: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Width (cm)</Label>
            <Input type="number" step="0.1" value={specsForm.dimensions_w} onChange={(e) => setSpecsForm({ ...specsForm, dimensions_w: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Height (cm)</Label>
            <Input type="number" step="0.1" value={specsForm.dimensions_h} onChange={(e) => setSpecsForm({ ...specsForm, dimensions_h: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Weight (kg)</Label>
            <Input type="number" step="0.01" value={specsForm.weight_kg} onChange={(e) => setSpecsForm({ ...specsForm, weight_kg: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Variants & Box Contents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TagInput label="Color Variants" items={specsForm.color_variants} newValue={newColor} setNewValue={setNewColor} field="color_variants" />
        <TagInput label="Box Contents" items={specsForm.box_contents} newValue={newBoxItem} setNewValue={setNewBoxItem} field="box_contents" />
      </div>

      <div className="space-y-2">
        <Label>Country of Origin</Label>
        <Input value={specsForm.country_of_origin} onChange={(e) => setSpecsForm({ ...specsForm, country_of_origin: e.target.value })} />
      </div>

      {/* Custom Specs */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Custom Specifications</h3>
        <div className="flex gap-2">
          <Input value={newSpecKey} onChange={(e) => setNewSpecKey(e.target.value)} placeholder="Spec name..." className="flex-1" />
          <Input value={newSpecValue} onChange={(e) => setNewSpecValue(e.target.value)} placeholder="Value..." className="flex-1" />
          <Button type="button" variant="outline" size="icon" onClick={addCustomSpec}><Plus className="h-4 w-4" /></Button>
        </div>
        {Object.keys(specsForm.custom_specs).length > 0 && (
          <div className="space-y-1 border rounded-md p-3">
            {Object.entries(specsForm.custom_specs).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded">
                <span className="text-sm"><span className="font-medium">{key}:</span> {value}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCustomSpec(key)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleSaveSpecs} disabled={upsertSpecs.isPending}>
        {upsertSpecs.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save Specs
      </Button>

      {/* QC Checklist */}
      <div className="space-y-3 border-t pt-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">QC Checklist</h3>
        <div className="flex gap-2">
          <Input value={newQCParam} onChange={(e) => setNewQCParam(e.target.value)} placeholder="Parameter name..." className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddQCItem())} />
          <Select value={newQCCategory} onValueChange={setNewQCCategory}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={newQCExpected} onChange={(e) => setNewQCExpected(e.target.value)} placeholder="Expected value..." className="w-[180px]" />
          <Button type="button" variant="outline" size="icon" onClick={handleAddQCItem}><Plus className="h-4 w-4" /></Button>
        </div>
        {qcItems && qcItems.length > 0 && (
          <div className="space-y-1 border rounded-md p-3">
            {qcItems.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{item.parameter_category}</Badge>
                  <span className="text-sm">{item.parameter_name}</span>
                  {item.expected_value && <span className="text-xs text-muted-foreground">→ {item.expected_value}</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteQCItem.mutate(item.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
