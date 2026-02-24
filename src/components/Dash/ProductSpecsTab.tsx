import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface ProductSpecsTabProps {
  form: Record<string, any>;
  setForm: (f: Record<string, any>) => void;
}

export default function ProductSpecsTab({ form, setForm }: ProductSpecsTabProps) {
  const [newCheckItem, setNewCheckItem] = useState("");

  const qaChecklist: string[] = form.qa_checklist || [];

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setForm({ ...form, qa_checklist: [...qaChecklist, newCheckItem.trim()] });
    setNewCheckItem("");
  };

  const removeCheckItem = (index: number) => {
    setForm({ ...form, qa_checklist: qaChecklist.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Technical Specifications</Label>
        <Textarea
          value={typeof form.technical_specs === "string" ? form.technical_specs : JSON.stringify(form.technical_specs || "", null, 2)}
          onChange={(e) => setForm({ ...form, technical_specs: e.target.value })}
          rows={6}
          placeholder="Enter technical specifications..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Gross Weight (kg)</Label>
          <Input type="number" step="0.01" value={form.gross_weight || ""} onChange={(e) => setForm({ ...form, gross_weight: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Net Weight (kg)</Label>
          <Input type="number" step="0.01" value={form.net_weight || ""} onChange={(e) => setForm({ ...form, net_weight: Number(e.target.value) })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Software & Button Details</Label>
        <Textarea
          value={form.software_button_details || ""}
          onChange={(e) => setForm({ ...form, software_button_details: e.target.value })}
          rows={4}
          placeholder="Describe software features, button layout..."
        />
      </div>

      <div className="space-y-2">
        <Label>Branding Positioning & Size</Label>
        <Textarea
          value={form.branding_info || ""}
          onChange={(e) => setForm({ ...form, branding_info: e.target.value })}
          rows={3}
          placeholder="Logo placement, branding dimensions..."
        />
      </div>

      <div className="space-y-3">
        <Label>QA Checklist</Label>
        <div className="flex gap-2">
          <Input
            value={newCheckItem}
            onChange={(e) => setNewCheckItem(e.target.value)}
            placeholder="Add checklist item..."
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCheckItem())}
          />
          <Button type="button" variant="outline" size="icon" onClick={addCheckItem}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {qaChecklist.length > 0 && (
          <div className="space-y-1 border rounded-md p-3">
            {qaChecklist.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded">
                <span className="text-sm">{i + 1}. {item}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCheckItem(i)}>
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
