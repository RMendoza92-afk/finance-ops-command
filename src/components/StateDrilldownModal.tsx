import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, FileText, X, Activity, Target, Scale } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useSharedOpenExposureRows } from '@/contexts/OpenExposureContext';

interface StateData {
  state: string;
  stateCode: string;
  policies: number;
  policyChange: number;
  claims: number;
  frequency: number;
  overspend: number;
  action: string;
}

interface OverLimitClaim {
  id: string;
  claim_number: string;
  payment_date: string;
  payment_amount: number;
  over_limit_amount: number;
  policy_limit: number;
  root_cause: string | null;
  coverage: string | null;
  classification: string | null;
}

interface OpenExposureClaim {
  claimNumber: string;
  claimant: string;
  status: string;
  daysOpen: number;
  ageBucket: string;
  reserves: number;
  lowEval: number;
  highEval: number;
  inLitigation: boolean;
  typeGroup: string;
  team: string;
  adjuster: string;
  injurySeverity: string;
  biStatus: string;
  state: string;
  city: string;
}

interface StateDrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stateData: StateData | null;
}

export function StateDrilldownModal({ open, onOpenChange, stateData }: StateDrilldownModalProps) {
  const [overLimitClaims, setOverLimitClaims] = useState<OverLimitClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { rawRows } = useSharedOpenExposureRows();

  // Process claims from shared context instead of fetching
  const { openExposureClaims, litigationClaims } = useMemo(() => {
    if (!stateData || !rawRows.length) {
      return { openExposureClaims: [], litigationClaims: [] };
    }
    
    const stateName = stateData.state.toUpperCase();
    const stateCode = stateData.stateCode.toUpperCase();
    
    const allClaims: OpenExposureClaim[] = rawRows
      .filter((row: any) => {
        const claimState = (row['Accident Location State'] || '').toUpperCase();
        return claimState.includes(stateName) || claimState === stateCode;
      })
      .map((row: any) => ({
        claimNumber: row['Claim#'] || '',
        claimant: row['Claimant'] || '',
        status: row['Status'] || '',
        daysOpen: parseInt(row['Open/Closed Days'] || '0', 10),
        ageBucket: row['Age'] || '',
        reserves: parseFloat((row['Open Reserves'] || '0').replace(/,/g, '')) || 0,
        lowEval: parseFloat((row['Low'] || '0').replace(/,/g, '')) || 0,
        highEval: parseFloat((row['High'] || '0').replace(/,/g, '')) || 0,
        inLitigation: (row['In Litigation Indicator'] || '').toLowerCase().includes('litigation'),
        typeGroup: row['Type Group'] || '',
        team: row['Team Group'] || '',
        adjuster: row['Adjuster Assigned'] || '',
        injurySeverity: row['Injury Severity'] || '',
        biStatus: row['BI Status'] || '',
        state: row['Accident Location State'] || '',
        city: row['Accident Location City'] || '',
      }));

    const openClaims = allClaims.filter(c => c.status === 'Open');
    const litClaims = openClaims.filter(c => c.inLitigation);
    
    return { openExposureClaims: openClaims, litigationClaims: litClaims };
  }, [rawRows, stateData]);

  useEffect(() => {
    if (open && stateData) {
      fetchOverLimitClaims(stateData.state);
    }
  }, [open, stateData]);

  const fetchOverLimitClaims = async (stateName: string) => {
    setLoading(true);
    try {
      // Fetch over-limit claims from database (only DB calls, no CSV fetch)
      const { data: olClaims } = await supabase
        .from('over_limit_payments')
        .select('*')
        .ilike('state', `%${stateName.toUpperCase()}%`)
        .order('payment_date', { ascending: false })
        .limit(50);

      if (olClaims) setOverLimitClaims(olClaims);
    } catch (error) {
      console.error('Error fetching state data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '$0';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!stateData) return null;

  const getActionColor = (action: string) => {
    if (action.includes('8-10%') || action.includes('Critical')) return 'bg-red-500/20 text-red-600 border-red-500/30';
    if (action.includes('6-8%') || action.includes('5-7%')) return 'bg-amber-500/20 text-amber-600 border-amber-500/30';
    if (action.includes('UW') || action.includes('Review')) return 'bg-orange-500/20 text-orange-600 border-orange-500/30';
    if (action.includes('Monitor')) return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
    return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30';
  };

  const totalOverLimitAmount = overLimitClaims.reduce((sum, c) => sum + (c.over_limit_amount || 0), 0);
  const totalLitigationExposure = litigationClaims.reduce((sum, c) => sum + (c.reserves || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">{stateData.stateCode}</span>
              </div>
              <div>
                <DialogTitle className="text-xl">{stateData.state} Territory Analysis</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">Detailed claim and performance data</p>
              </div>
            </div>
            <Badge className={cn("text-sm px-3 py-1", getActionColor(stateData.action))}>
              {stateData.action}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="overlimit">Over-Limit Claims ({overLimitClaims.length})</TabsTrigger>
            <TabsTrigger value="litigation">In Litigation ({litigationClaims.length})</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            <TabsContent value="overview" className="space-y-4 pr-4">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Policies</span>
                    </div>
                    <div className="text-2xl font-bold mt-1">{(stateData.policies / 1000).toFixed(0)}K</div>
                    <div className={cn("text-xs mt-1 flex items-center gap-1", stateData.policyChange >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {stateData.policyChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {stateData.policyChange >= 0 ? '+' : ''}{stateData.policyChange.toFixed(1)}% YoY
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Frequency</span>
                    </div>
                    <div className={cn("text-2xl font-bold mt-1", stateData.frequency >= 25 ? "text-red-600" : stateData.frequency >= 20 ? "text-amber-600" : "")}>
                      {stateData.frequency.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">per 1,000 policies</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">YTD Overspend</span>
                    </div>
                    <div className={cn("text-2xl font-bold mt-1", stateData.overspend > 2000000 ? "text-red-600" : stateData.overspend > 500000 ? "text-amber-600" : "text-emerald-600")}>
                      {formatCurrency(stateData.overspend)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{overLimitClaims.length} claims</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Open Litigation</span>
                    </div>
                    <div className="text-2xl font-bold mt-1">{formatCurrency(totalLitigationExposure)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{litigationClaims.length} matters</div>
                  </CardContent>
                </Card>
              </div>

              {/* Key Insights */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Territory Insights & Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stateData.overspend > 2000000 && (
                      <div className="flex gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>
                        <div>
                          <div className="text-sm font-medium">Critical Overspend Alert</div>
                          <p className="text-xs text-muted-foreground">{formatCurrency(stateData.overspend)} in over-limit payments YTD. Immediate rate action required. Consider 8-10% rate increase filing.</p>
                        </div>
                      </div>
                    )}
                    
                    {stateData.frequency >= 25 && (
                      <div className="flex gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                        <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0"></div>
                        <div>
                          <div className="text-sm font-medium">High Claim Frequency</div>
                          <p className="text-xs text-muted-foreground">Frequency at {stateData.frequency.toFixed(1)}/1K is significantly above target. Review underwriting guidelines and implement tightening measures.</p>
                        </div>
                      </div>
                    )}

                    {stateData.policyChange < -10 && (
                      <div className="flex gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0"></div>
                        <div>
                          <div className="text-sm font-medium">Significant Policy Decline</div>
                          <p className="text-xs text-muted-foreground">{Math.abs(stateData.policyChange).toFixed(1)}% YoY decline. Review if underwriting is over-tightened or competitive pressures are impacting retention.</p>
                        </div>
                      </div>
                    )}

                    {stateData.policyChange > 5 && (
                      <div className="flex gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                        <div>
                          <div className="text-sm font-medium">Growth Territory</div>
                          <p className="text-xs text-muted-foreground">+{stateData.policyChange.toFixed(1)}% YoY growth. Monitor loss development closely to ensure profitability as book matures.</p>
                        </div>
                      </div>
                    )}

                    {stateData.overspend === 0 && stateData.frequency < 20 && stateData.policyChange >= -5 && (
                      <div className="flex gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></div>
                        <div>
                          <div className="text-sm font-medium">Healthy Territory</div>
                          <p className="text-xs text-muted-foreground">Territory performing well with no overspend and controlled frequency. Maintain current strategy.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="overlimit" className="pr-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : overLimitClaims.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No over-limit claims found for {stateData.state}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-muted-foreground">Total Over-Limit: <span className="font-semibold text-foreground">{formatCurrency(totalOverLimitAmount)}</span></p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-muted-foreground">Claim #</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Payment</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Over Limit</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Coverage</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Root Cause</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overLimitClaims.map((claim) => (
                        <tr key={claim.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 font-mono text-xs">{claim.claim_number}</td>
                          <td className="py-2 text-muted-foreground">{formatDate(claim.payment_date)}</td>
                          <td className="py-2 text-right font-mono">{formatCurrency(claim.payment_amount)}</td>
                          <td className="py-2 text-right font-mono text-red-600">{formatCurrency(claim.over_limit_amount)}</td>
                          <td className="py-2">
                            <Badge variant="outline" className="text-xs">{claim.coverage || 'BI'}</Badge>
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{claim.root_cause || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="litigation" className="pr-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : litigationClaims.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Scale className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No litigation claims found for {stateData.state}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-muted-foreground">Total Reserves: <span className="font-semibold text-foreground">{formatCurrency(totalLitigationExposure)}</span></p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-muted-foreground">Claim #</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Claimant</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Type</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Days Open</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Reserves</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {litigationClaims.slice(0, 50).map((claim, idx) => (
                        <tr key={`${claim.claimNumber}-${idx}`} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 font-mono text-xs">{claim.claimNumber}</td>
                          <td className="py-2">{claim.claimant || '-'}</td>
                          <td className="py-2">
                            <Badge variant="outline" className="text-xs">{claim.typeGroup || 'LIT'}</Badge>
                          </td>
                          <td className={cn("py-2 text-right font-mono", claim.daysOpen > 365 ? "text-red-600" : claim.daysOpen > 180 ? "text-amber-600" : "")}>
                            {claim.daysOpen}
                          </td>
                          <td className="py-2 text-right font-mono">{formatCurrency(claim.reserves)}</td>
                          <td className="py-2">
                            <Badge variant="outline" className="text-xs bg-purple-500/20 text-purple-600 border-purple-500/30">
                              {claim.biStatus || 'In Litigation'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default StateDrilldownModal;
