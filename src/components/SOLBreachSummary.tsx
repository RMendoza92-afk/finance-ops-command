import { useSOLBreachAnalysis } from "@/hooks/useSOLBreachAnalysis";
import { Loader2, AlertTriangle, Gavel } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0 
  }).format(val);

export function SOLBreachSummary() {
  const { data, loading, error } = useSOLBreachAnalysis();

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
        <div className="flex items-center gap-3">
          <div className="p-2 bg-destructive/20 rounded-lg">
            <Gavel className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-destructive">
              STATUTE OF LIMITATIONS BREACH ANALYSIS
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              "Decisions Pending" claims past SOL deadline (Exp. Create Date + State SOL)
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-destructive/10 rounded-lg p-4 border-2 border-destructive/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />
              <span className="text-xs font-bold text-destructive uppercase">Total SOL Breach Exposure</span>
            </div>
            <p className="text-3xl font-bold text-destructive">{formatCurrency(data.totalReserves)}</p>
            <p className="text-sm text-destructive/80 mt-1">
              {data.count} claims at risk
            </p>
          </div>
          
          <div className="bg-card rounded-lg p-4 border border-destructive/30">
            <div className="flex items-center gap-2 mb-2">
              <Gavel className="h-4 w-4 text-destructive" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Decisions Pending Breaches</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{data.count}</p>
            <p className="text-sm text-muted-foreground mt-1">Claims past SOL deadline</p>
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

        {/* Detail Table */}
        {data.count > 0 && (
          <div>
            <h4 className="text-sm font-bold text-destructive mb-2">
              Decisions Pending Claims Breaching SOL ({data.count})
            </h4>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-secondary sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-semibold">Claim #</th>
                    <th className="text-left p-2 font-semibold">State</th>
                    <th className="text-left p-2 font-semibold">Create Date</th>
                    <th className="text-left p-2 font-semibold">SOL (Yrs)</th>
                    <th className="text-right p-2 font-semibold">Reserves</th>
                  </tr>
                </thead>
                <tbody>
                  {data.breaches.slice(0, 50).map((claim, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                      <td className="p-2 font-mono">{claim.claimNumber}</td>
                      <td className="p-2">{claim.state}</td>
                      <td className="p-2">{claim.expCreateDate}</td>
                      <td className="p-2">{claim.solYears}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(claim.reserves)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.count > 50 && (
              <p className="text-xs text-muted-foreground mt-1">
                Showing 50 of {data.count} claims
              </p>
            )}
          </div>
        )}

        {data.count === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No SOL breaches found for "Decisions Pending" claims.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
