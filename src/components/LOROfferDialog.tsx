import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface LOROfferDialogProps {
  onOfferAdded: () => void;
}

const BI_PHASES = [
  'Pending Demand',
  'Active Negotiation',
  'Impasse',
  'Policy Limits Demand',
  'Litigation Filed',
  'Pre-Suit',
];

export function LOROfferDialog({ onOfferAdded }: LOROfferDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [claimFound, setClaimFound] = useState(false);
  const [formData, setFormData] = useState({
    claimNumber: '',
    accidentDescription: '',
    area: '',
    offerAmount: '7500',
    extendedDate: new Date().toISOString().split('T')[0],
    biPhase: 'Pending Demand',
    settlementStatus: 'in_progress',
    highEval: '',
    lowEval: '',
    reserves: '',
    daysOld: '',
  });

  const calculateExpiresDate = (extendedDate: string) => {
    const date = new Date(extendedDate);
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  };

  const lookupClaim = async () => {
    const claimNumber = formData.claimNumber.trim();
    if (!claimNumber) {
      toast({ title: 'Enter claim number', description: 'Enter a claim number to look up', variant: 'destructive' });
      return;
    }

    setLookupLoading(true);
    setClaimFound(false);

    // Look up in claim_reviews table
    const { data, error } = await supabase
      .from('claim_reviews')
      .select('claim_id, loss_description, area, age_bucket, reserves, low_eval, high_eval')
      .eq('claim_id', claimNumber)
      .maybeSingle();

    setLookupLoading(false);

    if (error) {
      console.error('Lookup error:', error);
      toast({ title: 'Lookup failed', description: 'Could not search claim database', variant: 'destructive' });
      return;
    }

    if (!data) {
      toast({ title: 'Claim not found', description: `No claim found with ID ${claimNumber}`, variant: 'destructive' });
      return;
    }

    // Parse age bucket to estimate days old
    let daysOld = 0;
    const ageBucket = data.age_bucket || '';
    if (ageBucket.includes('365+') || ageBucket.includes('365 plus')) {
      daysOld = 400; // Average for 365+ claims
    } else if (ageBucket.includes('181') || ageBucket.includes('180')) {
      daysOld = 270; // Average for 181-365 days
    } else if (ageBucket.includes('61') || ageBucket.includes('60')) {
      daysOld = 120; // Average for 61-180 days
    } else if (ageBucket.includes('Under') || ageBucket.includes('under') || ageBucket.includes('<60')) {
      daysOld = 30; // Average for <60 days
    }

    setFormData(prev => ({
      ...prev,
      accidentDescription: data.loss_description || '',
      area: data.area || '',
      reserves: data.reserves?.toString() || '',
      lowEval: data.low_eval?.toString() || '',
      highEval: data.high_eval?.toString() || '',
      daysOld: daysOld.toString(),
    }));

    setClaimFound(true);
    toast({ 
      title: 'Claim found', 
      description: `Populated data from ${claimNumber} - ${data.age_bucket}` 
    });
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
      area: formData.area || null,
      offer_amount: parseFloat(formData.offerAmount),
      extended_date: formData.extendedDate,
      expires_date: expiresDate,
      status: 'pending',
      bi_phase: formData.biPhase,
      settlement_status: formData.settlementStatus,
      high_eval: formData.highEval ? parseFloat(formData.highEval) : 0,
      low_eval: formData.lowEval ? parseFloat(formData.lowEval) : 0,
      reserves: formData.reserves ? parseFloat(formData.reserves) : 0,
      days_old: formData.daysOld ? parseInt(formData.daysOld) : null,
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
      area: '',
      offerAmount: '7500',
      extendedDate: new Date().toISOString().split('T')[0],
      biPhase: 'Pending Demand',
      settlementStatus: 'in_progress',
      highEval: '',
      lowEval: '',
      reserves: '',
      daysOld: '',
    });
    setClaimFound(false);
    setOpen(false);
    onOfferAdded();
  };

  const handleClaimNumberChange = (value: string) => {
    setFormData(prev => ({ ...prev, claimNumber: value }));
    setClaimFound(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1">
          <Plus className="h-3 w-3" />
          Add Offer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add LOR Intervention Offer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="claimNumber">Claim Number *</Label>
            <div className="flex gap-2">
              <Input
                id="claimNumber"
                placeholder="65-0000558113"
                value={formData.claimNumber}
                onChange={(e) => handleClaimNumberChange(e.target.value)}
                className={`font-mono flex-1 ${claimFound ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}`}
              />
              <Button 
                type="button" 
                variant="secondary" 
                size="sm"
                onClick={lookupClaim}
                disabled={lookupLoading || !formData.claimNumber.trim()}
                className="shrink-0"
              >
                {lookupLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><Search className="h-4 w-4 mr-1" /> Look Up</>
                )}
              </Button>
            </div>
            {claimFound && (
              <p className="text-[10px] text-green-600">✓ Claim data populated from inventory</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accidentDescription">Accident Description</Label>
              <Input
                id="accidentDescription"
                placeholder="Lane Change / Side Swipe"
                value={formData.accidentDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, accidentDescription: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Area</Label>
              <Input
                id="area"
                placeholder="Houston"
                value={formData.area}
                onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daysOld">Days Old</Label>
              <Input
                id="daysOld"
                type="number"
                placeholder="120"
                value={formData.daysOld}
                onChange={(e) => setFormData(prev => ({ ...prev, daysOld: e.target.value }))}
                className={claimFound && formData.daysOld ? 'border-green-500' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="biPhase">BI Phase</Label>
              <Select 
                value={formData.biPhase} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, biPhase: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BI_PHASES.map(phase => (
                    <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settlementStatus">Status</Label>
              <Select 
                value={formData.settlementStatus} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, settlementStatus: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="settled">Settled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lowEval">Low Eval</Label>
              <Input
                id="lowEval"
                type="number"
                placeholder="5000"
                value={formData.lowEval}
                onChange={(e) => setFormData(prev => ({ ...prev, lowEval: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="highEval">High Eval</Label>
              <Input
                id="highEval"
                type="number"
                placeholder="15000"
                value={formData.highEval}
                onChange={(e) => setFormData(prev => ({ ...prev, highEval: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reserves">Reserves</Label>
              <Input
                id="reserves"
                type="number"
                placeholder="10000"
                value={formData.reserves}
                onChange={(e) => setFormData(prev => ({ ...prev, reserves: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="extendedDate">Extended Date</Label>
              <Input
                id="extendedDate"
                type="date"
                value={formData.extendedDate}
                onChange={(e) => setFormData(prev => ({ ...prev, extendedDate: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">
                Expires: {calculateExpiresDate(formData.extendedDate)} (14-day)
              </p>
            </div>
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
