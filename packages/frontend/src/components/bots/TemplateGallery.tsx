import { useState } from 'react';
import { BOT_TEMPLATES, TEMPLATE_CATEGORIES, type BotTemplate } from '@/data/bot-templates';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (name: string, description: string, flowData: { nodes: any[]; edges: any[] }) => void;
}

export function TemplateGallery({ open, onOpenChange, onSelect }: TemplateGalleryProps) {
  const [selected, setSelected] = useState<BotTemplate | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});

  const handleBack = () => {
    setSelected(null);
    setConfig({});
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setSelected(null);
      setConfig({});
    }
    onOpenChange(v);
  };

  const handleSelectTemplate = (template: BotTemplate) => {
    setSelected(template);
    // Initialize default values
    const defaults: Record<string, string> = {};
    for (const field of template.configFields) {
      if (field.defaultValue) defaults[field.key] = field.defaultValue;
    }
    setConfig(defaults);
  };

  const handleCreate = () => {
    if (!selected) return;
    const flowData = selected.flowDataFactory(config);
    onSelect(selected.name, selected.description, flowData);
    handleClose(false);
  };

  const isValid = selected
    ? selected.configFields.filter(f => f.required).every(f => config[f.key]?.trim())
    : false;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl !grid-rows-none !block p-0 overflow-hidden">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected && (
                <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {selected ? `Configure: ${selected.name}` : 'Flow Templates'}
            </DialogTitle>
          </DialogHeader>
        </div>

        {!selected ? (
          <div className="overflow-y-auto max-h-[60vh] px-6">
            <div className="space-y-6 pb-4">
              {TEMPLATE_CATEGORIES.map((cat) => {
                const templates = BOT_TEMPLATES.filter(t => t.category === cat.id);
                if (templates.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <div className="mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">{cat.label}</p>
                      <p className="text-[10px] text-muted-foreground">{cat.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {templates.map((tpl) => {
                        const Icon = tpl.icon;
                        return (
                          <button
                            key={tpl.id}
                            className={cn(
                              'flex items-start gap-3 rounded-lg border border-border bg-card/50 p-3 text-left transition-colors',
                              'hover:border-primary/40 hover:bg-primary/5',
                            )}
                            onClick={() => handleSelectTemplate(tpl)}
                          >
                            <div className="mt-0.5 rounded-md bg-primary/10 p-1.5">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium">{tpl.name}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{tpl.description}</p>
                              {tpl.configFields.length > 0 && (
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                  {tpl.configFields.filter(f => f.required).map(f => (
                                    <Badge key={f.key} variant="secondary" className="text-[8px] px-1 py-0">{f.label}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto max-h-[60vh] px-6">
              <div className="space-y-4 pb-2">
                <p className="text-xs text-muted-foreground">{selected.description}</p>

                {selected.configFields.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">No configuration needed — ready to create.</p>
                ) : (
                  <div className="space-y-3">
                    {selected.configFields.map((field) => (
                      <div key={field.key}>
                        <Label className="text-[10px] text-muted-foreground">
                          {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        {field.type === 'select' ? (
                          <Select
                            value={config[field.key] || field.defaultValue || ''}
                            onValueChange={(v) => setConfig(prev => ({ ...prev, [field.key]: v }))}
                          >
                            <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {field.options?.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={field.type === 'number' ? 'number' : 'text'}
                            className="h-7 text-xs mt-1 font-mono-data"
                            placeholder={field.placeholder}
                            value={config[field.key] || ''}
                            onChange={(e) => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 pt-2">
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={handleBack}>Back</Button>
                <Button size="sm" onClick={handleCreate} disabled={selected.configFields.length > 0 && !isValid}>
                  Create Bot
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
