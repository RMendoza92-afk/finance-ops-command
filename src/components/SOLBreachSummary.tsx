import { useSOLBreachAnalysis } from "@/hooks/useSOLBreachAnalysis";
import { Loader2, AlertTriangle, Gavel, Clock, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0 
  }).format(val);

export function SOLBreachSummary() {
  const { data, loading, error, exportToExcel } = useSOLBreachAnalysis();

  if (loading) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-destructive" />
          <span className="ml-2 text-sm">Analyzing SOL breaches...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="py-4">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Sort states by reserves desc
  const topStates = Object.entries(data.byState)
    .sort((a, b) => b[1].reserves - a[1].reserves)
    .slice(0, 10);

  return (
    <Card className="border-destructive/50 bg-destructive/5 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/20 rounded-lg">
              <Gavel className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-destructive">
                STATUTE OF LIMITATIONS BREACH ANALYSIS
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                "In Progress" & "Settled" claims - Breached & Approaching (90 days)
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToExcel}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Review
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg p-4 border border-destructive/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Breached (Past SOL)</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(data.breachedTotal)}</p>
            <p className="text-sm text-muted-foreground mt-1">{data.breachedCount} claims</p>
          </div>
          
          <div className="bg-card rounded-lg p-4 border border-warning/30">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-warning" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Approaching (90 Days)</span>
            </div>
            <p className="text-2xl font-bold text-warning">{formatCurrency(data.approachingTotal)}</p>
            <p className="text-sm text-muted-foreground mt-1">{data.approachingCount} claims</p>
          </div>
          
          <div className="bg-destructive/10 rounded-lg p-4 border-2 border-destructive/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />
              <span className="text-xs font-bold text-destructive uppercase">Combined SOL Risk</span>
            </div>
            <p className="text-3xl font-bold text-destructive">{formatCurrency(data.combinedTotal)}</p>
            <p className="text-sm text-destructive/80 mt-1">
              {data.totalPendingCount} claims at risk
            </p>
          </div>
        </div>

        {/* Top Breaching States */}
        {topStates.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-foreground mb-3">Top Breaching States by Reserves</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {topStates.map(([state, info]) => (
                <div key={state} className="bg-card rounded-md p-3 border border-border text-center">
                  <Badge variant="outline" className="mb-2 text-xs">{state}</Badge>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(info.reserves)}</p>
                  <p className="text-xs text-muted-foreground">{info.count} claims</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detail Tables */}
        {data.breachedCount > 0 && (
          <div>
            <h4 className="text-sm font-bold text-destructive mb-2">
              Breached Claims - Past SOL Deadline ({data.breachedCount})
            </h4>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-secondary sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-semibold">Claim #</th>
                    <th className="text-left p-2 font-semibold">State</th>
                    <th className="text-left p-2 font-semibold">Type Group</th>
                    <th className="text-left p-2 font-semibold">Exp. Category</th>
                    <th className="text-left p-2 font-semibold">BI Status</th>
                    <th className="text-left p-2 font-semibold">SOL (Yrs)</th>
                    <th className="text-right p-2 font-semibold">Days Past</th>
                    <th className="text-right p-2 font-semibold">Reserves</th>
                  </tr>
                </thead>
                <tbody>
                  {data.breachedClaims.slice(0, 50).map((claim, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                      <td className="p-2 font-mono">{claim.claimNumber}</td>
                      <td className="p-2">{claim.state}</td>
                      <td className="p-2">{claim.typeGroup}</td>
                      <td className="p-2">{claim.exposureCategory}</td>
                      <td className="p-2">{claim.biStatus}</td>
                      <td className="p-2">{claim.solYears}</td>
                      <td className="p-2 text-right text-destructive font-medium">{Math.abs(claim.daysUntilExpiry)}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(claim.reserves)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.breachedCount > 50 && (
              <p className="text-xs text-muted-foreground mt-1">
                Showing 50 of {data.breachedCount} claims
              </p>
            )}
          </div>
        )}

        {data.approachingCount > 0 && (
          <div>
            <h4 className="text-sm font-bold text-warning mb-2">
              Approaching SOL - Within 90 Days ({data.approachingCount})
            </h4>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-secondary sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-semibold">Claim #</th>
                    <th className="text-left p-2 font-semibold">State</th>
                    <th className="text-left p-2 font-semibold">Type Group</th>
                    <th className="text-left p-2 font-semibold">Exp. Category</th>
                    <th className="text-left p-2 font-semibold">BI Status</th>
                    <th className="text-left p-2 font-semibold">SOL (Yrs)</th>
                    <th className="text-right p-2 font-semibold">Days Left</th>
                    <th className="text-right p-2 font-semibold">Reserves</th>
                  </tr>
                </thead>
                <tbody>
                  {data.approachingClaims.slice(0, 50).map((claim, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                      <td className="p-2 font-mono">{claim.claimNumber}</td>
                      <td className="p-2">{claim.state}</td>
                      <td className="p-2">{claim.typeGroup}</td>
                      <td className="p-2">{claim.exposureCategory}</td>
                      <td className="p-2">{claim.biStatus}</td>
                      <td className="p-2">{claim.solYears}</td>
                      <td className="p-2 text-right text-warning font-medium">{claim.daysUntilExpiry}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(claim.reserves)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.approachingCount > 50 && (
              <p className="text-xs text-muted-foreground mt-1">
                Showing 50 of {data.approachingCount} claims
              </p>
            )}
          </div>
        )}

        {data.breachedCount === 0 && data.approachingCount === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No SOL breaches or approaching deadlines found.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
