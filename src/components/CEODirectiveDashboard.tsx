import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  FileStack, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Flag,
  Users,
  Target,
  TrendingDown,
  Loader2,
  RefreshCw,
  X,
  Eye,
  MessageSquare
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type ClaimReview = Tables<"claim_reviews">;

interface ClaimCandidate {
  id: string;
  area: string;
  lossDescription: string;
  reserves: number;
  ageBucket: string;
  lowEval?: number;
  highEval?: number;
}

// Sample claims from the Texas Rear End data for demo
const SAMPLE_CLAIMS: ClaimCandidate[] = [
  { id: 'CLM-101-4523', area: '101 EL PASO', lossDescription: 'IV R/E CV', reserves: 13580, ageBucket: '365+ Days', lowEval: 3770, highEval: 4400 },
  { id: 'CLM-101-4891', area: '101 EL PASO', lossDescription: 'IV R/E CV', reserves: 14200, ageBucket: '365+ Days', lowEval: 3900, highEval: 4550 },
  { id: 'CLM-102-3124', area: '102 RIO GRANDE/VALL', lossDescription: 'IV R/E CV', reserves: 13200, ageBucket: '181-365 Days', lowEval: 3680, highEval: 4280 },
  { id: 'CLM-102-3567', area: '102 RIO GRANDE/VALL', lossDescription: 'IV R/E CV', reserves: 14700, ageBucket: '365+ Days', lowEval: 4100, highEval: 4780 },
  { id: 'CLM-103-2891', area: '103 LAREDO/DEL RIO', lossDescription: 'IV R/E CV', reserves: 14700, ageBucket: '365+ Days', lowEval: 4120, highEval: 4820 },
  { id: 'CLM-104-1567', area: '104 CORPUS', lossDescription: 'IV R/E CV', reserves: 14140, ageBucket: '181-365 Days', lowEval: 3940, highEval: 4600 },
  { id: 'CLM-105-4234', area: '105 SAN ANTONIO', lossDescription: 'IV R/E CV', reserves: 12660, ageBucket: '61-180 Days', lowEval: 3540, highEval: 4130 },
  { id: 'CLM-105-4567', area: '105 SAN ANTONIO', lossDescription: 'IV R/E CV', reserves: 12900, ageBucket: '61-180 Days', lowEval: 3600, highEval: 4200 },
  { id: 'CLM-106-1234', area: '106 WEST TEXAS', lossDescription: 'IV R/E CV', reserves: 13460, ageBucket: '365+ Days', lowEval: 3780, highEval: 4420 },
  { id: 'CLM-107-2345', area: '107 HOUSTON', lossDescription: 'IV R/E CV', reserves: 11760, ageBucket: 'Under 60 Days', lowEval: 3290, highEval: 3840 },
  { id: 'CLM-107-2789', area: '107 HOUSTON', lossDescription: 'IV R/E CV', reserves: 11500, ageBucket: 'Under 60 Days', lowEval: 3200, highEval: 3750 },
  { id: 'CLM-109-1890', area: '109 DALLAS', lossDescription: 'IV R/E CV', reserves: 14080, ageBucket: '181-365 Days', lowEval: 3940, highEval: 4580 },
  { id: 'CLM-110-0987', area: '110 AUSTIN', lossDescription: 'IV R/E CV', reserves: 15300, ageBucket: '365+ Days', lowEval: 4280, highEval: 5000 },
];

const REVIEWERS = ['M. Rodriguez', 'J. Smith', 'A. Garcia', 'T. Johnson', 'L. Martinez'];

export function CEODirectiveDashboard() {
  const [reviews, setReviews] = useState<ClaimReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<string>('');
  const [directive, setDirective] = useState<string>('');
  const [deploying, setDeploying] = useState(false);
  const [viewMode, setViewMode] = useState<'deploy' | 'track'>('deploy');

  // Fetch existing reviews
  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('claim_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to load reviews');
    } else {
      setReviews(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();

    // Set up realtime subscription
    const channel = supabase
      .channel('claim_reviews_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claim_reviews' },
        (payload) => {
          console.log('Realtime update:', payload);
          if (payload.eventType === 'INSERT') {
            setReviews(prev => [payload.new as ClaimReview, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setReviews(prev => prev.map(r => 
              r.id === (payload.new as ClaimReview).id ? payload.new as ClaimReview : r
            ));
          } else if (payload.eventType === 'DELETE') {
            setReviews(prev => prev.filter(r => r.id !== (payload.old as ClaimReview).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const pending = reviews.filter(r => r.status === 'pending').length;
    const assigned = reviews.filter(r => r.status === 'assigned').length;
    const inReview = reviews.filter(r => r.status === 'in_review').length;
    const completed = reviews.filter(r => r.status === 'completed').length;
    const flagged = reviews.filter(r => r.status === 'flagged').length;
    
    const totalReserves = reviews.reduce((sum, r) => sum + (Number(r.reserves) || 0), 0);
    
    return { pending, assigned, inReview, completed, flagged, total: reviews.length, totalReserves };
  }, [reviews]);

  // Available claims (not already in review)
  const availableClaims = useMemo(() => {
    const reviewedIds = new Set(reviews.map(r => r.claim_id));
    return SAMPLE_CLAIMS.filter(c => !reviewedIds.has(c.id));
  }, [reviews]);

  const toggleClaimSelection = (claimId: string) => {
    setSelectedClaims(prev => 
      prev.includes(claimId) 
        ? prev.filter(id => id !== claimId)
        : [...prev, claimId]
    );
  };

  const selectAllAvailable = () => {
    setSelectedClaims(availableClaims.map(c => c.id));
  };

  const clearSelection = () => {
    setSelectedClaims([]);
  };

  const deployDirective = async () => {
    if (selectedClaims.length === 0) {
      toast.error('Select at least one claim');
      return;
    }
    if (!selectedReviewer) {
      toast.error('Select a reviewer');
      return;
    }

    setDeploying(true);

    const claimsToAssign = SAMPLE_CLAIMS.filter(c => selectedClaims.includes(c.id));
    
    const inserts = claimsToAssign.map(claim => ({
      claim_id: claim.id,
      area: claim.area,
      loss_description: claim.lossDescription,
      reserves: claim.reserves,
      low_eval: claim.lowEval || null,
      high_eval: claim.highEval || null,
      age_bucket: claim.ageBucket,
      status: 'assigned' as const,
      assigned_to: selectedReviewer,
      assigned_at: new Date().toISOString(),
      notes: directive || null,
    }));

    const { error } = await supabase
      .from('claim_reviews')
      .insert(inserts);

    if (error) {
      console.error('Error deploying directive:', error);
      toast.error('Failed to deploy directive');
    } else {
      toast.success(`Deployed ${claimsToAssign.length} claims to ${selectedReviewer}`);
      setSelectedClaims([]);
      setDirective('');
      setViewMode('track');
    }

    setDeploying(false);
  };

  const updateReviewStatus = async (reviewId: string, newStatus: string) => {
    const updates: Partial<ClaimReview> = { status: newStatus };
    if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('claim_reviews')
      .update(updates)
      .eq('id', reviewId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`Status updated to ${newStatus}`);
    }
  };

  const formatCurrency = (val: number) => `$${val.toLocaleString()}`;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'assigned':
        return <Badge className="gap-1 bg-blue-500"><Users className="h-3 w-3" /> Assigned</Badge>;
      case 'in_review':
        return <Badge className="gap-1 bg-amber-500"><Eye className="h-3 w-3" /> In Review</Badge>;
      case 'completed':
        return <Badge className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>;
      case 'flagged':
        return <Badge className="gap-1 bg-red-500"><Flag className="h-3 w-3" /> Flagged</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading directive dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Target className="h-5 w-5" />
              CEO Directive Center
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Deploy review directives & track progress in real-time
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'deploy' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('deploy')}
            >
              <Send className="h-4 w-4 mr-1" />
              Deploy
            </Button>
            <Button
              variant={viewMode === 'track' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('track')}
            >
              <Eye className="h-4 w-4 mr-1" />
              Track ({stats.total})
            </Button>
          </div>
        </div>
      </div>

      {/* Real-time Stats */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Deployed</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-500">{stats.assigned}</p>
          <p className="text-xs text-muted-foreground">Assigned</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.inReview}</p>
          <p className="text-xs text-muted-foreground">In Review</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{stats.flagged}</p>
          <p className="text-xs text-muted-foreground">Flagged</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-primary">{formatCurrency(stats.totalReserves)}</p>
          <p className="text-xs text-muted-foreground">Total Reserves</p>
        </div>
      </div>

      {viewMode === 'deploy' ? (
        /* Deploy Mode */
        <div className="grid grid-cols-3 gap-6">
          {/* Claim Selection */}
          <div className="col-span-2 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Select Claims for Review</h3>
                <p className="text-xs text-muted-foreground">{availableClaims.length} claims available • {selectedClaims.length} selected</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllAvailable}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {availableClaims.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">All claims have been deployed</p>
              ) : (
                availableClaims.map(claim => (
                  <div
                    key={claim.id}
                    onClick={() => toggleClaimSelection(claim.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedClaims.includes(claim.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          selectedClaims.includes(claim.id)
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        }`}>
                          {selectedClaims.includes(claim.id) && (
                            <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-mono text-sm font-medium">{claim.id}</p>
                          <p className="text-xs text-muted-foreground">{claim.area} • {claim.lossDescription}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">{formatCurrency(claim.reserves)}</p>
                        <Badge variant="outline" className="text-xs">{claim.ageBucket}</Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Directive Panel */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Deploy Directive</h3>
            
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Assign To</label>
              <select
                value={selectedReviewer}
                onChange={(e) => setSelectedReviewer(e.target.value)}
                className="w-full p-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">Select reviewer...</option>
                {REVIEWERS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Directive Notes (Optional)</label>
              <Textarea
                value={directive}
                onChange={(e) => setDirective(e.target.value)}
                placeholder="Enter special instructions for this batch..."
                rows={4}
                className="text-sm"
              />
            </div>

            <div className="pt-4 border-t border-border">
              <div className="text-sm mb-3">
                <p><span className="text-muted-foreground">Selected:</span> <strong>{selectedClaims.length} claims</strong></p>
                <p><span className="text-muted-foreground">Total Reserves:</span> <strong className="text-primary">
                  {formatCurrency(SAMPLE_CLAIMS.filter(c => selectedClaims.includes(c.id)).reduce((s, c) => s + c.reserves, 0))}
                </strong></p>
              </div>

              <Button 
                onClick={deployDirective} 
                disabled={selectedClaims.length === 0 || !selectedReviewer || deploying}
                className="w-full"
              >
                {deploying ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Deploy {selectedClaims.length} Claims
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Track Mode */
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Review Progress</h3>
              <p className="text-xs text-muted-foreground">Real-time tracking • Updates automatically</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchReviews}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Claim ID</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Area</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Age</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Reserves</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Assigned To</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No directives deployed yet
                    </td>
                  </tr>
                ) : (
                  reviews.map(review => (
                    <tr key={review.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 font-mono font-medium">{review.claim_id}</td>
                      <td className="py-2 px-3">{review.area}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline">{review.age_bucket}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right text-primary font-semibold">
                        {formatCurrency(Number(review.reserves))}
                      </td>
                      <td className="py-2 px-3">{review.assigned_to || '—'}</td>
                      <td className="py-2 px-3">{getStatusBadge(review.status)}</td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          {review.status === 'assigned' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateReviewStatus(review.id, 'in_review')}
                              title="Start Review"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {review.status === 'in_review' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-500"
                                onClick={() => updateReviewStatus(review.id, 'completed')}
                                title="Complete"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500"
                                onClick={() => updateReviewStatus(review.id, 'flagged')}
                                title="Flag"
                              >
                                <Flag className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {review.notes && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title={review.notes}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
