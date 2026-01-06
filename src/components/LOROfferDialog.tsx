import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface LOROfferDialogProps {
  onOfferAdded: () => void;
}

export function LOROfferDialog({ onOfferAdded }: LOROfferDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    claimNumber: '',
    accidentDescription: '',
    area: 'Houston',
    offerAmount: '7500',
    extendedDate: new Date().toISOString().split('T')[0]
  });

  const calculateExpiresDate = (extendedDate: string) => {
    const date = new Date(extendedDate);
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.claimNumber.trim()) {
      toast({ title: 'Error', description: 'Claim number is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    
    const expiresDate = calculateExpiresDate(formData.extendedDate);
    
    const { error } = await supabase.from('lor_offers').insert({
      claim_number: formData.claimNumber.trim(),
      accident_description: formData.accidentDescription.trim() || null,
      area: formData.area,
      offer_amount: parseFloat(formData.offerAmount),
      extended_date: formData.extendedDate,
      expires_date: expiresDate,
      status: 'pending'
    });

    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: 'Failed to add offer', variant: 'destructive' });
      console.error('Insert error:', error);
      return;
    }

    toast({ title: 'Success', description: `LOR offer added for ${formData.claimNumber}` });
    setFormData({
      claimNumber: '',
      accidentDescription: '',
      area: 'Houston',
      offerAmount: '7500',
      extendedDate: new Date().toISOString().split('T')[0]
    });
    setOpen(false);
    onOfferAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1">
          <Plus className="h-3 w-3" />
          Add Offer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add LOR Intervention Offer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="claimNumber">Claim Number *</Label>
            <Input
              id="claimNumber"
              placeholder="65-0000558113"
              value={formData.claimNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, claimNumber: e.target.value }))}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accidentDescription">Accident Description</Label>
            <Input
              id="accidentDescription"
              placeholder="Lane Change / Side Swipe"
              value={formData.accidentDescription}
              onChange={(e) => setFormData(prev => ({ ...prev, accidentDescription: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="area">Area</Label>
              <Input
                id="area"
                placeholder="Houston"
                value={formData.area}
                onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="offerAmount">Offer Amount</Label>
              <Select 
                value={formData.offerAmount} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, offerAmount: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5000">$5,000</SelectItem>
                  <SelectItem value="6000">$6,000</SelectItem>
                  <SelectItem value="7500">$7,500</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="extendedDate">Extended Date</Label>
            <Input
              id="extendedDate"
              type="date"
              value={formData.extendedDate}
              onChange={(e) => setFormData(prev => ({ ...prev, extendedDate: e.target.value }))}
            />
            <p className="text-[10px] text-muted-foreground">
              Expires: {calculateExpiresDate(formData.extendedDate)} (14-day deadline)
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Offer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
