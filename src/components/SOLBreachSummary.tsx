import { useState } from "react";
import { useSOLBreachAnalysis } from "@/hooks/useSOLBreachAnalysis";
import { Loader2, AlertTriangle, Gavel, Clock, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0 
  }).format(val);

export function SOLBreachSummary() {
  const { data, loading, error, exportToExcel } = useSOLBreachAnalysis();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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

  const hasDetails = data.breachedCount > 0 || data.approachingCount > 0;

  return (
    <Card className="border-destructive/50 bg-destructive/5 shadow-lg overflow-hidden">
      <CardHeader className="pb-3 px-3 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/20 rounded-lg shrink-0">
              <Gavel className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg font-bold text-destructive leading-tight">
                SOL BREACH ANALYSIS
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                Breached & Approaching (90 days)
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToExcel}
            className="gap-2 shrink-0 w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-3 sm:px-6">
        {/* Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg p-3 sm:p-4 border border-destructive/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Breached</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-destructive">{formatCurrency(data.breachedTotal)}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{data.breachedCount} claims</p>
          </div>
          
          <div className="bg-card rounded-lg p-3 sm:p-4 border border-warning/30">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-warning shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Approaching</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-warning">{formatCurrency(data.approachingTotal)}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{data.approachingCount} claims</p>
          </div>
          
          <div className="bg-destructive/10 rounded-lg p-3 sm:p-4 border-2 border-destructive/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive animate-pulse shrink-0" />
              <span className="text-xs font-bold text-destructive uppercase">Combined Risk</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-destructive">{formatCurrency(data.combinedTotal)}</p>
            <p className="text-xs sm:text-sm text-destructive/80 mt-1">
              {data.totalPendingCount} at risk
            </p>
          </div>
        </div>

        {/* Top Breaching States - Horizontal scroll on mobile */}
        {topStates.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-foreground mb-3">Top States by Reserves</h4>
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
              <div className="flex sm:grid sm:grid-cols-5 gap-2 min-w-max sm:min-w-0">
                {topStates.map(([state, info]) => (
                  <div key={state} className="bg-card rounded-md p-2 sm:p-3 border border-border text-center min-w-[80px] sm:min-w-0">
                    <Badge variant="outline" className="mb-1 sm:mb-2 text-xs">{state}</Badge>
                    <p className="text-xs sm:text-sm font-bold text-foreground">{formatCurrency(info.reserves)}</p>
                    <p className="text-xs text-muted-foreground">{info.count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Detail Tables */}
        {hasDetails && (
          <Collapsible open={isDetailOpen} onOpenChange={setIsDetailOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between hover:bg-muted/50 border border-border"
              >
                <span className="text-sm font-medium">
                  {isDetailOpen ? 'Hide' : 'Show'} Claim Details ({data.breachedCount + data.approachingCount} claims)
                </span>
                {isDetailOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-4 mt-4">
              {data.breachedCount > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-destructive mb-2">
                    Breached ({data.breachedCount})
                  </h4>
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border min-w-[600px] sm:min-w-0 mx-3 sm:mx-0">
                      <table className="w-full text-xs">
                        <thead className="bg-secondary sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">Claim #</th>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">State</th>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">Type</th>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">Category</th>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">Status</th>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">SOL</th>
                            <th className="text-right p-2 font-semibold whitespace-nowrap">Days</th>
                            <th className="text-right p-2 font-semibold whitespace-nowrap">Reserves</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.breachedClaims.slice(0, 50).map((claim, i) => (
                            <tr key={i} className="border-t border-border hover:bg-muted/50">
                              <td className="p-2 font-mono whitespace-nowrap">{claim.claimNumber}</td>
                              <td className="p-2 whitespace-nowrap">{claim.state}</td>
                              <td className="p-2 whitespace-nowrap">{claim.typeGroup}</td>
                              <td className="p-2 whitespace-nowrap">{claim.exposureCategory}</td>
                              <td className="p-2 whitespace-nowrap">{claim.biStatus}</td>
                              <td className="p-2 whitespace-nowrap">{claim.solYears}y</td>
                              <td className="p-2 text-right text-destructive font-medium whitespace-nowrap">{Math.abs(claim.daysUntilExpiry)}</td>
                              <td className="p-2 text-right font-medium whitespace-nowrap">{formatCurrency(claim.reserves)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {data.breachedCount > 50 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Showing 50 of {data.breachedCount}
                    </p>
                  )}
                </div>
              )}

              {data.approachingCount > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-warning mb-2">
                    Approaching ({data.approachingCount})
                  </h4>
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border min-w-[600px] sm:min-w-0 mx-3 sm:mx-0">
                      <table className="w-full text-xs">
                        <thead className="bg-secondary sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">Claim #</th>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">State</th>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">Type</th>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">Category</th>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">Status</th>
                            <th className="text-left p-2 font-semibold whitespace-nowrap">SOL</th>
                            <th className="text-right p-2 font-semibold whitespace-nowrap">Days</th>
                            <th className="text-right p-2 font-semibold whitespace-nowrap">Reserves</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.approachingClaims.slice(0, 50).map((claim, i) => (
                            <tr key={i} className="border-t border-border hover:bg-muted/50">
                              <td className="p-2 font-mono whitespace-nowrap">{claim.claimNumber}</td>
                              <td className="p-2 whitespace-nowrap">{claim.state}</td>
                              <td className="p-2 whitespace-nowrap">{claim.typeGroup}</td>
                              <td className="p-2 whitespace-nowrap">{claim.exposureCategory}</td>
                              <td className="p-2 whitespace-nowrap">{claim.biStatus}</td>
                              <td className="p-2 whitespace-nowrap">{claim.solYears}y</td>
                              <td className="p-2 text-right text-warning font-medium whitespace-nowrap">{claim.daysUntilExpiry}</td>
                              <td className="p-2 text-right font-medium whitespace-nowrap">{formatCurrency(claim.reserves)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {data.approachingCount > 50 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Showing 50 of {data.approachingCount}
                    </p>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {!hasDetails && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No SOL breaches or approaching deadlines found.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
