import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings, Plus, Pencil, Trash2, Loader2, Users, Phone, Mail } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

interface Reviewer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

const reviewerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters")
    .regex(/^(\+?[\d\s\-()]*)?$/, "Invalid phone format").optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters").optional().or(z.literal("")),
});

export function ReviewerSettings() {
  const [open, setOpen] = useState(false);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  
  // Form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReviewer, setEditingReviewer] = useState<Reviewer | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  const fetchReviewers = async () => {
    setLoading(true);
    try {
      let query = supabase.from('reviewers').select('*').order('name');
      if (!showInactive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (error) throw error;
      setReviewers(data || []);
    } catch (err) {
      console.error('Error fetching reviewers:', err);
      toast.error('Failed to load reviewers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchReviewers();
    }
  }, [open, showInactive]);

  const openAddDialog = () => {
    setEditingReviewer(null);
    setFormData({ name: "", phone: "", email: "" });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEditDialog = (reviewer: Reviewer) => {
    setEditingReviewer(reviewer);
    setFormData({
      name: reviewer.name,
      phone: reviewer.phone || "",
      email: reviewer.email || "",
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const validateForm = () => {
    const result = reviewerSchema.safeParse(formData);
    if (!result.success) {
      const errors: { name?: string; phone?: string; email?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof typeof errors;
        errors[field] = err.message;
      });
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
      };

      if (editingReviewer) {
        const { error } = await supabase
          .from('reviewers')
          .update(payload)
          .eq('id', editingReviewer.id);
        if (error) throw error;
        toast.success('Reviewer updated');
      } else {
        const { error } = await supabase
          .from('reviewers')
          .insert({ ...payload, is_active: true });
        if (error) throw error;
        toast.success('Reviewer added');
      }

      setDialogOpen(false);
      fetchReviewers();
    } catch (err: any) {
      console.error('Error saving reviewer:', err);
      if (err?.code === '23505') {
        toast.error('A reviewer with this name already exists');
      } else {
        toast.error('Failed to save reviewer');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (reviewer: Reviewer) => {
    try {
      const { error } = await supabase
        .from('reviewers')
        .update({ is_active: !reviewer.is_active })
        .eq('id', reviewer.id);
      if (error) throw error;
      toast.success(reviewer.is_active ? 'Reviewer deactivated' : 'Reviewer activated');
      fetchReviewers();
    } catch (err) {
      console.error('Error toggling reviewer status:', err);
      toast.error('Failed to update reviewer status');
    }
  };

  const deleteReviewer = async (reviewer: Reviewer) => {
    if (!confirm(`Delete "${reviewer.name}"? This cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('reviewers')
        .delete()
        .eq('id', reviewer.id);
      if (error) throw error;
      toast.success('Reviewer deleted');
      fetchReviewers();
    } catch (err) {
      console.error('Error deleting reviewer:', err);
      toast.error('Failed to delete reviewer');
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reviewers</span>
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage Reviewers
            </SheetTitle>
            <SheetDescription>
              Add, edit, or deactivate reviewers and their contact information.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <Button onClick={openAddDialog} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Reviewer
              </Button>
              <div className="flex items-center gap-2">
                <Label htmlFor="show-inactive" className="text-xs text-muted-foreground">
                  Show inactive
                </Label>
                <Switch
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reviewers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No reviewers found. Add one to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewers.map((reviewer) => (
                    <TableRow key={reviewer.id} className={!reviewer.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{reviewer.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          {reviewer.phone && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {reviewer.phone}
                            </span>
                          )}
                          {reviewer.email && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {reviewer.email}
                            </span>
                          )}
                          {!reviewer.phone && !reviewer.email && (
                            <span className="text-muted-foreground italic">No contact info</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={reviewer.is_active ? "default" : "secondary"}>
                          {reviewer.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(reviewer)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleActive(reviewer)}
                          >
                            <Switch checked={reviewer.is_active} className="scale-75" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteReviewer(reviewer)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingReviewer ? "Edit Reviewer" : "Add Reviewer"}
            </DialogTitle>
            <DialogDescription>
              {editingReviewer
                ? "Update the reviewer's information."
                : "Enter the new reviewer's details."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Smith"
                maxLength={100}
              />
              {formErrors.name && (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 555 123 4567"
                maxLength={20}
              />
              {formErrors.phone && (
                <p className="text-xs text-destructive">{formErrors.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john.smith@company.com"
                maxLength={255}
              />
              {formErrors.email && (
                <p className="text-xs text-destructive">{formErrors.email}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingReviewer ? "Save Changes" : "Add Reviewer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
