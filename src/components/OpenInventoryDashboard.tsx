import React, { useMemo, useState, useEffect, useCallback } from "react"; // Updated
import { useOpenExposureData, OpenExposurePhase, TypeGroupSummary, CP1Data, TexasRearEndData, MultiPackSummary, MultiPackGroup } from "@/hooks/useOpenExposureData";
import { useCP1AnalysisCsv } from "@/hooks/useCP1AnalysisCsv";
import { useExportData, ExportableData, ManagerTracking, RawClaimData, DashboardVisual, PDFChart } from "@/hooks/useExportData";
import { KPICard } from "@/components/KPICard";
import { getCurrentMonthlySpend } from "@/data/monthlySpendData";
import { CP1DrilldownModal } from "@/components/CP1DrilldownModal";
import { ReviewerSettings } from "@/components/ReviewerSettings";
import { SimpleDashboardV2 } from "@/components/dashboard/SimpleDashboardV2";
import { ExecutiveCommandDashboard } from "@/components/dashboard/ExecutiveCommandDashboard";
import { DashboardLayoutToggle, DashboardVersion } from "@/components/dashboard/DashboardLayoutToggle";
import { Loader2, FileStack, Clock, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Wallet, Car, MapPin, MessageSquare, Send, CheckCircle2, Target, Users, Flag, Eye, RefreshCw, Calendar, Sparkles, TestTube, Download, FileSpreadsheet, XCircle, CircleDot, ArrowUpRight, ArrowDownRight, Activity, ChevronDown, ChevronUp, Gavel, User, ExternalLink, Filter, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import { format, addDays } from "date-fns";
import { 
  generateExecutiveReport, 
  auditReportQuality, 
  getReportContext,
  ExecutiveReportConfig,
  ExecutiveMetric,
  ExecutiveInsight,
  ExecutiveTable,
  EXECUTIVE_COLORS,
  formatCurrency as formatExecCurrency,
  formatPercent,
  getDeltaDirection,
  QuarterlyData,
  AppendixSection
} from "@/lib/executivePDFFramework";
import { generateBoardReadyPackage, ExecutivePackageConfig } from "@/lib/boardReadyPDFGenerator";

// 6 Quarters of Expert Spend Data (Q2 2024 - Q4 2025)
const EXPERT_QUARTERLY_DATA: QuarterlyData[] = [
  { quarter: 'Q2 2024', paid: 1287450, paidMonthly: 429150, approved: 1412300, approvedMonthly: 470767, variance: -124850 },
  { quarter: 'Q3 2024', paid: 1445820, paidMonthly: 481940, approved: 1523100, approvedMonthly: 507700, variance: -77280 },
  { quarter: 'Q4 2024', paid: 1612340, paidMonthly: 537447, approved: 1698500, approvedMonthly: 566167, variance: -86160 },
  { quarter: 'Q1 2025', paid: 1553080, paidMonthly: 517693, approved: 2141536, approvedMonthly: 713845, variance: -588456 },
  { quarter: 'Q2 2025', paid: 1727599, paidMonthly: 575866, approved: 1680352, approvedMonthly: 560117, variance: 47247 },
  { quarter: 'Q3 2025', paid: 1383717, paidMonthly: 461239, approved: 1449627, approvedMonthly: 483209, variance: -65910 },
  { quarter: 'Q4 2025', paid: 1016756, paidMonthly: 508378, approved: 909651, approvedMonthly: 454826, variance: 107105 },
];

type ClaimReview = Tables<"claim_reviews">;

interface Reviewer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

import { GlobalFilters } from "@/components/GlobalFilters";
import { SOLBreachSummary } from "@/components/SOLBreachSummary";
import { useSOLBreachAnalysis } from "@/hooks/useSOLBreachAnalysis";
import { useDecisionsPending } from "@/hooks/useDecisionsPending";
import { useLOROffers, LOROfferDB } from "@/hooks/useLOROffers";
import { LOROfferDialog } from "@/components/LOROfferDialog";

interface OpenInventoryDashboardProps {
  filters: GlobalFilters;
  defaultView?: 'operations' | 'executive';
}

export function OpenInventoryDashboard({ filters, defaultView = 'operations' }: OpenInventoryDashboardProps) {
  const { data: rawData, loading, error } = useOpenExposureData();
  // CP1 Analysis "box" uses ONLY the dedicated CP1 CSV (public/data/cp1-analysis.csv)
  const { data: cp1BoxData, loading: cp1BoxLoading, error: cp1BoxError } = useCP1AnalysisCsv();
  const { data: solData } = useSOLBreachAnalysis();
  const { data: decisionsData } = useDecisionsPending();
  const { offers: lorOffers, stats: lorStats, refetch: refetchLOR } = useLOROffers();
  const { exportBoth, generateFullExcel, generateExecutivePDF, generateExecutivePackage } = useExportData();
  const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');

  // Operations report (01-JAN-2026) spend figures - TOTAL across all coverages
  const monthlySpend = getCurrentMonthlySpend();
  const totalIndemnityJan2026 = monthlySpend.indemnities.total; // $9,835,934.96
  const totalExpenseJan2026 = monthlySpend.expenses.total;       // $268,869.38
  const totalLitigationSpendJan2026 = totalIndemnityJan2026 + totalExpenseJan2026; // $10,104,804.34
  const data = useMemo(() => {
    if (!rawData) return null;
    
    const hasFilters = filters.team !== 'all' || filters.adjuster !== 'all' || filters.searchText.trim() !== '';
    
    if (!hasFilters) {
      return rawData; // No filters, use original data
    }
    
    // Filter raw claims based on filters
    const filteredClaims = rawData.rawClaims.filter(claim => {
      // Team filter - match against teamGroup (e.g., "TEAM 29", "TEAM 57")
      if (filters.team !== 'all') {
        const teamMatch = claim.teamGroup.toLowerCase().includes(filters.team.toLowerCase());
        if (!teamMatch) return false;
      }
      
      // Adjuster filter
      if (filters.adjuster !== 'all') {
        const adjMatch = claim.adjuster.toLowerCase().includes(filters.adjuster.toLowerCase());
        if (!adjMatch) return false;
      }
      
      // Search text - search across multiple fields
      if (filters.searchText.trim()) {
        const searchLower = filters.searchText.toLowerCase();
        const searchFields = [
          claim.claimNumber,
          claim.claimant,
          claim.adjuster,
          claim.teamGroup,
          claim.typeGroup,
          claim.coverage,
          claim.lossDescription,
        ].map(f => (f || '').toLowerCase());
        
        if (!searchFields.some(field => field.includes(searchLower))) {
          return false;
        }
      }
      
      return true;
    });
    
    // Recalculate all aggregated metrics from filtered claims
    const getAgeBucket = (days: number): 'age365Plus' | 'age181To365' | 'age61To180' | 'ageUnder60' => {
      if (days >= 365) return 'age365Plus';
      if (days >= 181) return 'age181To365';
      if (days >= 61) return 'age61To180';
      return 'ageUnder60';
    };
    
    const getAgeBucketLabel = (bucket: string): string => {
      switch (bucket) {
        case 'age365Plus': return '365+ Days';
        case 'age181To365': return '181-365 Days';
        case 'age61To180': return '61-180 Days';
        case 'ageUnder60': return 'Under 60 Days';
        default: return bucket;
      }
    };
    
    // Initialize aggregation structures
    const typeGroupMap = new Map<string, { 
      age365Plus: number; age181To365: number; age61To180: number; ageUnder60: number; 
      grandTotal: number; reserves: number; lowEval: number; highEval: number 
    }>();
    const typeGroupUniqueClaims = new Map<string, Set<string>>();
    const ageFinancials = {
      age365Plus: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
      age181To365: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
      age61To180: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
      ageUnder60: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    };
    let grandTotals = { age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0, grandTotal: 0 };
    let financialTotals = { totalOpenReserves: 0, totalLowEval: 0, totalHighEval: 0, noEvalCount: 0, noEvalReserves: 0 };
    let cp1Totals = { yes: 0, noCP: 0 };
    
    // Process filtered claims
    for (const claim of filteredClaims) {
      const ageBucket = getAgeBucket(claim.days);
      const isCP1 = claim.cp1Flag === 'Yes';
      
      // Grand totals
      grandTotals[ageBucket]++;
      grandTotals.grandTotal++;
      
      // Financial totals
      financialTotals.totalOpenReserves += claim.openReserves;
      financialTotals.totalLowEval += claim.lowEval;
      financialTotals.totalHighEval += claim.highEval;
      if (claim.lowEval === 0 && claim.highEval === 0) {
        financialTotals.noEvalCount++;
        financialTotals.noEvalReserves += claim.openReserves;
      }
      
      // Age financials
      ageFinancials[ageBucket].claims++;
      ageFinancials[ageBucket].reserves += claim.openReserves;
      ageFinancials[ageBucket].lowEval += claim.lowEval;
      ageFinancials[ageBucket].highEval += claim.highEval;
      
      // Type group summaries
      if (!typeGroupMap.has(claim.typeGroup)) {
        typeGroupMap.set(claim.typeGroup, { 
          age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0, 
          grandTotal: 0, reserves: 0, lowEval: 0, highEval: 0 
        });
      }
      const tg = typeGroupMap.get(claim.typeGroup)!;
      tg[ageBucket]++;
      tg.grandTotal++;
      tg.reserves += claim.openReserves;
      tg.lowEval += claim.lowEval;
      tg.highEval += claim.highEval;
      
      // Unique claims per type group
      if (!typeGroupUniqueClaims.has(claim.typeGroup)) {
        typeGroupUniqueClaims.set(claim.typeGroup, new Set());
      }
      typeGroupUniqueClaims.get(claim.typeGroup)!.add(claim.claimNumber);
      
      // CP1 totals
      if (isCP1) {
        cp1Totals.yes++;
      } else {
        cp1Totals.noCP++;
      }
    }
    
    // Build type group summaries array
    const typeGroupSummaries = Array.from(typeGroupMap.entries()).map(([typeGroup, counts]) => ({
      typeGroup,
      ...counts,
      uniqueClaims: typeGroupUniqueClaims.get(typeGroup)?.size || 0,
    })).sort((a, b) => b.uniqueClaims - a.uniqueClaims);
    
    // Build financials by age
    const financialsByAge = [
      { age: '365+ Days', claims: ageFinancials.age365Plus.claims, openReserves: ageFinancials.age365Plus.reserves, lowEval: ageFinancials.age365Plus.lowEval, highEval: ageFinancials.age365Plus.highEval },
      { age: '181-365 Days', claims: ageFinancials.age181To365.claims, openReserves: ageFinancials.age181To365.reserves, lowEval: ageFinancials.age181To365.lowEval, highEval: ageFinancials.age181To365.highEval },
      { age: '61-180 Days', claims: ageFinancials.age61To180.claims, openReserves: ageFinancials.age61To180.reserves, lowEval: ageFinancials.age61To180.lowEval, highEval: ageFinancials.age61To180.highEval },
      { age: 'Under 60 Days', claims: ageFinancials.ageUnder60.claims, openReserves: ageFinancials.ageUnder60.reserves, lowEval: ageFinancials.ageUnder60.lowEval, highEval: ageFinancials.ageUnder60.highEval },
    ];
    
    // Calculate CP1 rate
    const totalClaims = cp1Totals.yes + cp1Totals.noCP;
    const cp1Rate = totalClaims > 0 ? ((cp1Totals.yes / totalClaims) * 100).toFixed(1) : '0.0';
    
    // Return recalculated data structure (preserving original structure shape)
    return {
      ...rawData,
      totals: grandTotals,
      typeGroupSummaries,
      financials: {
        ...rawData.financials,
        totalOpenReserves: financialTotals.totalOpenReserves,
        totalLowEval: financialTotals.totalLowEval,
        totalHighEval: financialTotals.totalHighEval,
        noEvalCount: financialTotals.noEvalCount,
        noEvalReserves: financialTotals.noEvalReserves,
        byAge: financialsByAge,
      },
      cp1Data: {
        ...rawData.cp1Data,
        totals: { ...rawData.cp1Data.totals, yes: cp1Totals.yes, noCP: cp1Totals.noCP, grandTotal: totalClaims },
        cp1Rate,
      },
      rawClaims: filteredClaims,
    };
  }, [rawData, filters.team, filters.adjuster, filters.searchText]);

  const [selectedClaimFilter, setSelectedClaimFilter] = useState<string>('');
  const [selectedReviewer, setSelectedReviewer] = useState<string>('');
  const [directive, setDirective] = useState<string>('');
  const [deploying, setDeploying] = useState(false);
  const [reviews, setReviews] = useState<ClaimReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [deadline, setDeadline] = useState<string>(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
  const [aiSummary, setAiSummary] = useState<string>('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [testMode, setTestMode] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [executiveExpanded, setExecutiveExpanded] = useState(true);
  const [showDecisionsDrawer, setShowDecisionsDrawer] = useState(false);
  const [pendingDecisions, setPendingDecisions] = useState<PendingDecision[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState(false);
  const [generatingDecisionsPDF, setGeneratingDecisionsPDF] = useState(false);
  const [showBudgetDrawer, setShowBudgetDrawer] = useState(false);
  const [generatingBudgetPDF, setGeneratingBudgetPDF] = useState(false);
  const [showCP1Drawer, setShowCP1Drawer] = useState(false);
  const [generatingCP1PDF, setGeneratingCP1PDF] = useState(false);
  const [generatingCP1Excel, setGeneratingCP1Excel] = useState(false);
  const [generatingBoardPackage, setGeneratingBoardPackage] = useState(false);
  const [cp1DrilldownCoverage, setCp1DrilldownCoverage] = useState<string | null>(null);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loadingReviewers, setLoadingReviewers] = useState(true);
  const [showMultiPackDrawer, setShowMultiPackDrawer] = useState(false);
  const [selectedPackSize, setSelectedPackSize] = useState<number | null>(null);
  const [dashboardVersion, setDashboardVersion] = useState<DashboardVersion>(() => 
    defaultView === 'executive' ? 'v3' : 'v1'
  );
  const [showChatFromV2V3, setShowChatFromV2V3] = useState(false);

  // Fetch reviewers from database
  useEffect(() => {
    const fetchReviewers = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('reviewers')
          .select('*')
          .eq('is_active', true)
          .order('name');
        
        if (fetchError) {
          console.error('Error fetching reviewers:', fetchError);
          return;
        }
        setReviewers(data || []);
      } catch (err) {
        console.error('Error fetching reviewers:', err);
      } finally {
        setLoadingReviewers(false);
      }
    };
    fetchReviewers();
  }, []);

  // Get selected reviewer's contact info
  const selectedReviewerData = useMemo(() => {
    return reviewers.find(r => r.name === selectedReviewer);
  }, [reviewers, selectedReviewer]);
  
  // Pending Decisions - matters requiring executive attention
  // Criteria: High severity + $500K+ OR aging 180+ days
  interface PendingDecision {
    matterId: string;
    claimant: string;
    amount: number;
    daysOpen: number;
    lead: string;
    reason: string;
    deadline: string;
    recommendedAction: string;
    severity: 'critical' | 'high' | 'medium';
    department: string;
    type: string;
    location: string;
  }

  // Fetch pending decisions from database
  const fetchPendingDecisions = useCallback(async () => {
    setLoadingDecisions(true);
    try {
      // Query matters that need executive attention:
      // - total_amount >= 500000 OR days_open >= 180
      // - status = 'Open'
      const { data: matters, error: fetchError } = await supabase
        .from('litigation_matters')
        .select('*')
        .eq('status', 'Open')
        .or('total_amount.gte.500000,days_open.gte.180')
        .order('total_amount', { ascending: false })
        .limit(50);

      if (fetchError) {
        console.error('Error fetching pending decisions:', fetchError);
        return;
      }

      const decisions: PendingDecision[] = (matters || []).map((m) => {
        // Determine severity based on criteria
        const isHighValue = (Number(m.total_amount) || 0) >= 500000;
        const isAged = (m.days_open || 0) >= 365;
        const isAging = (m.days_open || 0) >= 180;
        const isCriticalSeverity = m.severity?.toLowerCase() === 'critical' || m.severity?.toLowerCase() === 'high';
        
        let severity: 'critical' | 'high' | 'medium' = 'medium';
        if ((isHighValue && isAged) || (isCriticalSeverity && isAged)) {
          severity = 'critical';
        } else if (isHighValue || isAged || isCriticalSeverity) {
          severity = 'high';
        }

        // Generate reason based on criteria
        const reasons: string[] = [];
        if (isAged) reasons.push('Aged 365+ days');
        else if (isAging) reasons.push('Aged 180+ days');
        if (isHighValue) reasons.push(`Exceeds $500K (${formatCurrencyFullValue(Number(m.total_amount) || 0)})`);
        if (isCriticalSeverity) reasons.push(`${m.severity} severity`);
        
        // Generate recommended action based on situation
        let recommendedAction = 'Review and determine resolution strategy';
        if (isAged && isHighValue) {
          recommendedAction = 'Urgent: Authorize settlement or trial preparation';
        } else if (isAged) {
          recommendedAction = 'Expedite resolution - consider mediation';
        } else if (isHighValue) {
          recommendedAction = 'Review settlement authority and excess carrier notification';
        }

        // Calculate estimated deadline (30 days from now for review, sooner if aged)
        const daysUntilDeadline = isAged ? 7 : isAging ? 14 : 30;
        const deadline = format(addDays(new Date(), daysUntilDeadline), 'yyyy-MM-dd');

        return {
          matterId: m.matter_id,
          claimant: m.claimant || 'Unknown Claimant',
          amount: Number(m.total_amount) || 0,
          daysOpen: m.days_open || 0,
          lead: m.matter_lead || 'Unassigned',
          reason: reasons.join(', ') || 'Meets executive review threshold',
          deadline,
          recommendedAction,
          severity,
          department: m.department || '',
          type: m.type || '',
          location: m.location || '',
        };
      });

      setPendingDecisions(decisions);
    } catch (err) {
      console.error('Error in fetchPendingDecisions:', err);
    } finally {
      setLoadingDecisions(false);
    }
  }, []);

  // Fetch pending decisions when drawer opens
  useEffect(() => {
    if (showDecisionsDrawer) {
      fetchPendingDecisions();
    }
  }, [showDecisionsDrawer, fetchPendingDecisions]);

  // Generate Board-Ready Executive PDF for Pending Decisions
  const generateDecisionsPDF = useCallback(async () => {
    setGeneratingDecisionsPDF(true);
    try {
      const stats = {
        total: pendingDecisions.length,
        critical: pendingDecisions.filter(d => d.severity === 'critical').length,
        thisWeek: pendingDecisions.filter(d => {
          const deadline = new Date(d.deadline);
          const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          return deadline <= weekFromNow;
        }).length,
        statuteDeadlines: pendingDecisions.filter(d => d.daysOpen > 350).length,
        totalExposure: pendingDecisions.reduce((sum, d) => sum + d.amount, 0)
      };
      
      const ctx = getReportContext();
      
      // Build executive report configuration with quality gates
      const reportConfig: ExecutiveReportConfig = {
        title: 'Pending Executive Decisions',
        subtitle: `${stats.critical} Critical Items Require Immediate Action`,
        reportType: 'DECISION',
        classification: 'RESTRICTED',
        
        executiveSummary: {
          keyTakeaway: `${stats.total} matters require executive decision totaling ${formatExecCurrency(stats.totalExposure, true)} exposure. ${stats.critical} are CRITICAL priority. ${stats.thisWeek} due within 7 days. ${stats.statuteDeadlines} approaching statute deadlines (350+ days open).`,
          
          metrics: [
            {
              label: 'Total Decisions Required',
              value: stats.total,
              context: 'Pending Executive Action'
            },
            {
              label: 'Critical Priority',
              value: stats.critical,
              context: stats.critical > 0 ? 'IMMEDIATE ACTION' : 'None pending',
              deltaDirection: stats.critical > 0 ? 'negative' : 'neutral'
            },
            {
              label: 'Due This Week',
              value: stats.thisWeek,
              context: 'Next 7 days',
              deltaDirection: stats.thisWeek > 3 ? 'negative' : 'neutral'
            },
            {
              label: 'Total Exposure',
              value: formatExecCurrency(stats.totalExposure, true),
              context: 'Combined reserves at risk'
            }
          ],
          
          insights: pendingDecisions.slice(0, 4).map(d => ({
            priority: d.severity === 'critical' ? 'critical' as const : 
                     d.severity === 'high' ? 'high' as const : 'medium' as const,
            headline: `${d.matterId}: ${d.claimant} - ${formatExecCurrency(d.amount, true)}`,
            action: d.recommendedAction
          })),
          
          bottomLine: stats.critical > 0 
            ? `${stats.critical} critical decisions require immediate C-suite attention. Combined exposure of ${formatExecCurrency(stats.totalExposure, true)} at risk. ${stats.statuteDeadlines} matters approaching statute limits require priority resolution.`
            : `All ${stats.total} pending decisions are within normal priority range. Total exposure: ${formatExecCurrency(stats.totalExposure, true)}. No immediate escalation required.`
        },
        
        tables: [
          {
            title: 'Pending Decision Queue by Priority',
            headers: ['Matter ID', 'Claimant', 'Lead', 'Days Open', 'Exposure', 'Priority'],
            rows: pendingDecisions.slice(0, 20).map(d => ({
              cells: [
                d.matterId,
                d.claimant.substring(0, 25) + (d.claimant.length > 25 ? '...' : ''),
                d.lead,
                d.daysOpen,
                formatExecCurrency(d.amount, true),
                d.severity.toUpperCase()
              ],
              highlight: d.severity === 'critical' ? 'risk' as const : 
                        d.severity === 'high' ? 'warning' as const : undefined
            })),
            footnote: pendingDecisions.length > 20 ? `Showing 20 of ${pendingDecisions.length} pending decisions` : undefined
          }
        ],
        
        // Appendix with detailed breakdowns
        appendix: [
          {
            title: 'Decisions by Department',
            content: `Pending decisions span ${new Set(pendingDecisions.map(d => d.department)).size} departments. The largest concentration is in litigation matters with ${pendingDecisions.filter(d => d.type === 'Litigation').length} pending items.`,
            table: {
              title: 'Department Distribution',
              headers: ['Department', 'Count', 'Total Exposure', 'Avg Exposure'],
              rows: (() => {
                const deptMap = new Map<string, { count: number; exposure: number }>();
                pendingDecisions.forEach(d => {
                  const dept = d.department || 'Unassigned';
                  const existing = deptMap.get(dept) || { count: 0, exposure: 0 };
                  deptMap.set(dept, { count: existing.count + 1, exposure: existing.exposure + d.amount });
                });
                return Array.from(deptMap.entries())
                  .sort((a, b) => b[1].exposure - a[1].exposure)
                  .slice(0, 8)
                  .map(([dept, data]) => ({
                    cells: [dept, data.count, formatExecCurrency(data.exposure, true), formatExecCurrency(data.exposure / data.count, true)],
                    highlight: data.exposure > 5000000 ? 'warning' as const : undefined
                  }));
              })()
            }
          },
          {
            title: 'Aging Analysis',
            content: `${pendingDecisions.filter(d => d.daysOpen > 365).length} matters exceed 1 year open. ${pendingDecisions.filter(d => d.daysOpen > 540).length} matters exceed 18 months, representing highest statute risk.`,
            chart: {
              type: 'horizontalBar' as const,
              title: 'Decisions by Age Bucket (Count)',
              data: [
                { label: '500+ Days', value: pendingDecisions.filter(d => d.daysOpen > 500).length },
                { label: '365-500 Days', value: pendingDecisions.filter(d => d.daysOpen > 365 && d.daysOpen <= 500).length },
                { label: '180-365 Days', value: pendingDecisions.filter(d => d.daysOpen > 180 && d.daysOpen <= 365).length },
                { label: 'Under 180 Days', value: pendingDecisions.filter(d => d.daysOpen <= 180).length },
              ]
            }
          },
          {
            title: 'Full Decision Queue',
            table: {
              title: 'All Pending Decisions (Complete List)',
              headers: ['Matter ID', 'Claimant', 'Lead', 'Days', 'Exposure', 'Type', 'Priority'],
              rows: pendingDecisions.map(d => ({
                cells: [
                  d.matterId,
                  d.claimant.substring(0, 20) + (d.claimant.length > 20 ? '...' : ''),
                  d.lead.substring(0, 15) + (d.lead.length > 15 ? '...' : ''),
                  d.daysOpen,
                  formatExecCurrency(d.amount, true),
                  d.type.substring(0, 10),
                  d.severity.toUpperCase()
                ],
                highlight: d.severity === 'critical' ? 'risk' as const : 
                          d.severity === 'high' ? 'warning' as const : undefined
              }))
            }
          }
        ],
        
        includeAllContent: true
      };
      
      // === QUALITY GATE CHECK ===
      const qualityScore = auditReportQuality(reportConfig);
      
      if (!qualityScore.passed) {
        console.warn('Quality Gate Warning:', qualityScore.issues);
      }
      
      // Generate the report
      const result = await generateExecutiveReport(reportConfig);
      
      if (result.success) {
        toast.success(`Board-ready Decisions report generated (Quality: ${result.qualityScore.overall.toFixed(1)}/10)`);
      } else {
        throw new Error('Report generation failed');
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingDecisionsPDF(false);
    }
  }, [pendingDecisions]);

  // Generate PDF for Decisions Pending (CSV-based data from useDecisionsPending)
  const generateDecisionsPendingPDF = useCallback(async () => {
    if (!decisionsData || decisionsData.claims.length === 0) {
      toast.error('No decisions pending data to export');
      return;
    }
    
    setGeneratingDecisionsPDF(true);
    try {
      const ctx = getReportContext();
      const claims = decisionsData.claims;
      const byPainLevel = decisionsData.byPainLevel;
      
      // Build summary stats
      const highPainCount = claims.filter(c => c.painLevel.includes('5+') || c.painLevel === 'Limits').length;
      const pendingPainCount = claims.filter(c => c.painLevel === 'Pending' || c.painLevel === 'Blank').length;
      const criticalCount = claims.filter(c => c.reserves >= 100000).length;
      
      const reportConfig: ExecutiveReportConfig = {
        title: 'Decisions Pending Report',
        subtitle: `${claims.length} Claims Requiring Evaluation Decisions`,
        reportType: 'DECISION',
        classification: 'CONFIDENTIAL',
        
        executiveSummary: {
          keyTakeaway: `${claims.length} claims with high reserves (≥$15K) have no evaluation set, totaling ${formatExecCurrency(decisionsData.totalReserves, true)} in open reserves. ${highPainCount} have high pain levels (5+), ${pendingPainCount} have pending pain assessments. Immediate evaluation decisions required.`,
          
          metrics: [
            {
              label: 'Total Claims',
              value: claims.length,
              context: 'Requiring Decisions'
            },
            {
              label: 'Total Reserves',
              value: formatExecCurrency(decisionsData.totalReserves, true),
              context: 'At risk without evaluation'
            },
            {
              label: 'High Pain (5+)',
              value: highPainCount,
              context: 'Elevated injury severity',
              deltaDirection: highPainCount > 10 ? 'negative' : 'neutral'
            },
            {
              label: 'Critical (≥$100K)',
              value: criticalCount,
              context: 'Highest priority',
              deltaDirection: criticalCount > 5 ? 'negative' : 'neutral'
            }
          ],
          
          insights: claims.slice(0, 4).map(c => ({
            priority: c.reserves >= 100000 ? 'critical' as const : 
                     c.painLevel.includes('5+') ? 'high' as const : 'medium' as const,
            headline: `${c.claimNumber}: ${c.state} - ${formatExecCurrency(c.reserves, true)}`,
            action: `Set evaluation for ${c.painLevel} pain level claim`
          })),
          
          bottomLine: criticalCount > 0 
            ? `${criticalCount} claims with reserves ≥$100K require immediate evaluation decisions. Combined exposure of ${formatExecCurrency(decisionsData.totalReserves, true)} at risk. Focus on ${highPainCount} high pain level claims first.`
            : `All ${claims.length} pending decisions are routine priority. Total exposure: ${formatExecCurrency(decisionsData.totalReserves, true)}. Recommend batch evaluation review.`
        },
        
        tables: [
          {
            title: 'Decisions Pending - Claims Without Evaluation',
            headers: ['Claim #', 'State', 'Pain Level', 'Reserves', 'BI Status', 'Team', 'Reason'],
            rows: claims.slice(0, 30).map(c => ({
              cells: [
                c.claimNumber,
                c.state,
                c.painLevel,
                formatExecCurrency(c.reserves, true),
                c.biStatus,
                c.team,
                c.reason.substring(0, 25)
              ],
              highlight: c.reserves >= 100000 ? 'risk' as const : 
                        c.painLevel.includes('5+') ? 'warning' as const : undefined
            })),
            footnote: claims.length > 30 ? `Showing 30 of ${claims.length} claims` : undefined
          }
        ],
        
        appendix: [
          {
            title: 'By Pain Level Category',
            content: `Claims grouped by pain severity level.`,
            table: {
              title: 'Pain Level Distribution',
              headers: ['Pain Category', 'Count', 'Total Reserves', 'Avg Reserve'],
              rows: Object.entries(byPainLevel).map(([category, data]) => ({
                cells: [
                  category,
                  data.count,
                  formatExecCurrency(data.reserves, true),
                  formatExecCurrency(data.reserves / data.count, true)
                ],
                highlight: category.includes('High') || category === 'Limits' ? 'warning' as const : undefined
              }))
            }
          },
          {
            title: 'Full Claims List',
            table: {
              title: 'All Pending Decisions',
              headers: ['Claim #', 'State', 'Pain Level', 'Reserves', 'BI Status', 'Team'],
              rows: claims.map(c => ({
                cells: [
                  c.claimNumber,
                  c.state,
                  c.painLevel,
                  formatExecCurrency(c.reserves, true),
                  c.biStatus,
                  c.team
                ],
                highlight: c.reserves >= 100000 ? 'risk' as const : undefined
              }))
            }
          }
        ],
        
        includeAllContent: true
      };
      
      const result = await generateExecutiveReport(reportConfig);
      
      if (result.success) {
        toast.success(`Decisions Pending PDF generated (${claims.length} claims)`);
      } else {
        throw new Error('Report generation failed');
      }
    } catch (err) {
      console.error('Error generating Decisions Pending PDF:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingDecisionsPDF(false);
    }
  }, [decisionsData]);

  // Generate Excel for Decisions Pending (CSV-based data)
  const generateDecisionsPendingExcel = useCallback(async () => {
    if (!decisionsData || decisionsData.claims.length === 0) {
      toast.error('No decisions pending data to export');
      return;
    }
    
    try {
      const XLSX = await import('xlsx');
      const claims = decisionsData.claims;
      const byPainLevel = decisionsData.byPainLevel;
      
      // Summary sheet
      const summaryData = [
        ['Decisions Pending Report'],
        ['Generated:', format(new Date(), 'MMMM d, yyyy h:mm a')],
        [''],
        ['Summary'],
        ['Total Claims:', claims.length],
        ['Total Reserves:', `$${decisionsData.totalReserves.toLocaleString()}`],
        [''],
        ['By Pain Level Category'],
        ['Category', 'Count', 'Total Reserves', 'Avg Reserve'],
        ...Object.entries(byPainLevel).map(([category, data]) => [
          category,
          data.count,
          `$${data.reserves.toLocaleString()}`,
          `$${Math.round(data.reserves / data.count).toLocaleString()}`
        ])
      ];
      
      // Claims detail sheet
      const claimsData = [
        ['Claim #', 'State', 'Pain Level', 'Reserves', 'BI Status', 'Team', 'Reason'],
        ...claims.map(c => [
          c.claimNumber,
          c.state,
          c.painLevel,
          c.reserves,
          c.biStatus,
          c.team,
          c.reason
        ])
      ];
      
      const wb = XLSX.utils.book_new();
      
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
      
      const claimsWs = XLSX.utils.aoa_to_sheet(claimsData);
      XLSX.utils.book_append_sheet(wb, claimsWs, 'Claims Detail');
      
      XLSX.writeFile(wb, `Decisions_Pending_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      
      toast.success(`Decisions Pending Excel exported (${claims.length} claims)`);
    } catch (err) {
      console.error('Error generating Decisions Pending Excel:', err);
      toast.error('Failed to generate Excel');
    }
  }, [decisionsData]);

  const pendingDecisionsStats = useMemo(() => {
    // If we have Supabase-based pendingDecisions, use them
    if (pendingDecisions.length > 0) {
      const critical = pendingDecisions.filter(d => d.severity === 'critical').length;
      const thisWeek = pendingDecisions.filter(d => {
        const deadline = new Date(d.deadline);
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return deadline <= weekFromNow;
      }).length;
      const statuteDeadlines = pendingDecisions.filter(d => d.daysOpen > 350).length;
      const totalExposure = pendingDecisions.reduce((sum, d) => sum + d.amount, 0);
      
      return { total: pendingDecisions.length, critical, thisWeek, statuteDeadlines, totalExposure };
    }
    
    // Fall back to CSV-based decisionsData from useDecisionsPending hook
    if (decisionsData) {
      // Estimate critical as claims with reserves > $100K
      const criticalClaims = decisionsData.claims.filter(c => c.reserves >= 100000);
      const critical = criticalClaims.length;
      const thisWeek = Math.min(decisionsData.totalCount, 5); // Estimate
      const statuteDeadlines = Math.round(decisionsData.totalCount * 0.1); // Estimate 10%
      
      return { 
        total: decisionsData.totalCount, 
        critical, 
        thisWeek, 
        statuteDeadlines, 
        totalExposure: decisionsData.totalReserves 
      };
    }
    
    return { total: 0, critical: 0, thisWeek: 0, statuteDeadlines: 0, totalExposure: 0 };
  }, [pendingDecisions, decisionsData]);

  // Budget Burn Rate calculation - based on actual Loya Insurance Group claims data
  // Source: 01-JAN-2026 Monthly Claim Indemnity & Expenses Report
  const budgetMetrics = useMemo(() => {
    // 2025 Actuals (full year final) - YTD December 31, 2025
    const bi2025Full = 344631765;  // BI Total: $344,631,765 (37,700 claims, avg $9,141)
    const um2025Full = 83565242;   // UM Total: $83,565,242 (10,998 claims, avg $7,598)
    const ui2025Full = 23226040;   // UI Total: $23,226,040 (3,109 claims, avg $7,471)
    const total2025 = bi2025Full + um2025Full + ui2025Full; // $451,423,047
    
    // 2026 YTD (01-JAN-2026) - From Monthly Claim Indemnity & Expenses Report
    // Indemnities: $9,835,934.96 (2,214 checks), Expenses: $268,869.38 (222 checks)
    const biIndemnity2026 = monthlySpend.indemnities.byCoverage.find(c => c.coverage === 'BI')?.costs ?? 0; // $5,421,500.48
    const biExpense2026 = monthlySpend.expenses.byCoverage.find(c => c.coverage === 'BI')?.costs ?? 0;     // $213,683.75
    const bi2026 = biIndemnity2026 + biExpense2026; // $5,635,184.23
    
    const umIndemnity2026 = monthlySpend.indemnities.byCoverage.find(c => c.coverage === 'UM')?.costs ?? 0; // $85,220.00
    const umExpense2026 = monthlySpend.expenses.byCoverage.find(c => c.coverage === 'UM')?.costs ?? 0;     // $472.90
    const um2026 = umIndemnity2026 + umExpense2026; // $85,692.90
    
    const uiIndemnity2026 = monthlySpend.indemnities.byCoverage.find(c => c.coverage === 'UI')?.costs ?? 0; // $30,000.00
    const ui2026 = uiIndemnity2026; // $30,000.00 (no UI expenses in report)
    
    // Total indemnities + expenses from report
    const totalIndemnities2026 = monthlySpend.indemnities.total; // $9,835,934.96
    const totalExpenses2026 = monthlySpend.expenses.total;        // $268,869.38
    const ytdPaid = totalIndemnities2026 + totalExpenses2026;     // $10,104,804.34
    
    // BI/UM/UI subset for litigation-focused view
    const ytdBiUmUi = bi2026 + um2026 + ui2026; // $5,750,877.13
    
    // Annual budget based on 2025 actuals + 5% growth allowance
    const annualBudget = Math.round(total2025 * 1.05); // ~$474M
    
    const burnRate = (ytdPaid / annualBudget) * 100;
    const remaining = annualBudget - ytdPaid;
    const monthsElapsed = 0.23; // Through 1/7/26 (7 days / 30 days)
    const monthsRemaining = 12 - monthsElapsed;
    const projectedBurn = (ytdPaid / monthsElapsed) * 12;
    const projectedVariance = annualBudget - projectedBurn;
    
    // Monthly breakdown (estimated from YTD / months elapsed)
    const avgMonthlyBudget = annualBudget / 12;
    
    const monthlyData = [
      { month: 'Jan', budget: avgMonthlyBudget, actual: ytdPaid, variance: avgMonthlyBudget - ytdPaid },
      { month: 'Feb', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
      { month: 'Mar', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
      { month: 'Apr', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
      { month: 'May', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
      { month: 'Jun', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
      { month: 'Jul', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
      { month: 'Aug', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
      { month: 'Sep', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
      { month: 'Oct', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
      { month: 'Nov', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
      { month: 'Dec', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
    ];

    // Coverage breakdown for drilldown (BI, UM, UI) - now using monthlySpendData
    const biCheckCount = (monthlySpend.indemnities.byCoverage.find(c => c.coverage === 'BI')?.checkCount ?? 0) +
                         (monthlySpend.expenses.byCoverage.find(c => c.coverage === 'BI')?.checkCount ?? 0);
    const umCheckCount = (monthlySpend.indemnities.byCoverage.find(c => c.coverage === 'UM')?.checkCount ?? 0) +
                         (monthlySpend.expenses.byCoverage.find(c => c.coverage === 'UM')?.checkCount ?? 0);
    const uiCheckCount = monthlySpend.indemnities.byCoverage.find(c => c.coverage === 'UI')?.checkCount ?? 0;
    
    const coverageBreakdown = {
      bi: { 
        name: 'Bodily Injury', 
        ytd2026: bi2026, 
        ytd2025: bi2025Full, 
        change: bi2026 - bi2025Full,
        claimCount2026: biCheckCount, // 779 indemnity + 144 expense = 923
        claimCount2025: 37700,
        avgPerClaim2026: biCheckCount > 0 ? Math.round(bi2026 / biCheckCount) : 0,
        avgPerClaim2025: 9141,
      },
      cl: { 
        name: 'Underinsured Motorist', 
        ytd2026: um2026, 
        ytd2025: um2025Full, 
        change: um2026 - um2025Full,
        claimCount2026: umCheckCount, // 8 indemnity + 2 expense = 10
        claimCount2025: 10998,
        avgPerClaim2026: umCheckCount > 0 ? Math.round(um2026 / umCheckCount) : 0,
        avgPerClaim2025: 7598,
      },
      oc: { 
        name: 'Uninsured (UI)', 
        ytd2026: ui2026, 
        ytd2025: ui2025Full, 
        change: ui2026 - ui2025Full,
        claimCount2026: uiCheckCount, // 1 check
        claimCount2025: 3109,
        avgPerClaim2026: uiCheckCount > 0 ? Math.round(ui2026 / uiCheckCount) : 0,
        avgPerClaim2025: 7471,
      },
    };

    return {
      annualBudget,
      ytdPaid,
      ytdBiUmUi,
      totalIndemnities2026,
      totalExpenses2026,
      burnRate: Math.round(burnRate * 1000) / 1000,
      remaining,
      monthsRemaining,
      projectedBurn,
      projectedVariance,
      monthlyData,
      onTrack: projectedBurn <= annualBudget,
      coverageBreakdown,
      total2025,
    };
  }, [monthlySpend]);


  // Generate Board-Ready Executive PDF for Budget Burn Rate
  const generateBudgetPDF = useCallback(async () => {
    setGeneratingBudgetPDF(true);
    try {
      const ctx = getReportContext();
      const yoyChange = budgetMetrics.ytdPaid - budgetMetrics.total2025;
      const yoyChangePercent = (yoyChange / budgetMetrics.total2025) * 100;
      
      // Build executive report configuration with quality gates
      const reportConfig: ExecutiveReportConfig = {
        title: 'Budget Burn Rate Analysis',
        subtitle: `FY${ctx.fiscalYear} Claims Payment Tracking`,
        reportType: 'FORECAST',
        classification: 'CONFIDENTIAL',
        
        executiveSummary: {
          keyTakeaway: `YTD claims spend of ${formatExecCurrency(budgetMetrics.ytdPaid, true)} represents ${budgetMetrics.burnRate}% of annual budget. ${budgetMetrics.onTrack ? 'ON TRACK' : 'OVER BUDGET'} with ${formatExecCurrency(budgetMetrics.remaining, true)} remaining. BI exposure up ${formatExecCurrency(budgetMetrics.coverageBreakdown.bi.change, true)} YoY driving majority of variance.`,
          
          metrics: [
            {
              label: 'Annual Budget',
              value: formatExecCurrency(budgetMetrics.annualBudget, true),
              context: `FY${ctx.fiscalYear} Approved`
            },
            {
              label: 'YTD Payments',
              value: formatExecCurrency(budgetMetrics.ytdPaid, true),
              delta: yoyChangePercent,
              deltaLabel: 'YoY',
              deltaDirection: yoyChangePercent > 5 ? 'negative' : yoyChangePercent < -5 ? 'positive' : 'neutral'
            },
            {
              label: 'Burn Rate',
              value: `${budgetMetrics.burnRate}%`,
              context: `${budgetMetrics.monthsRemaining} months remaining`,
              deltaDirection: budgetMetrics.burnRate > 91 ? 'negative' : 'neutral'
            },
            {
              label: 'Budget Status',
              value: budgetMetrics.onTrack ? 'ON TRACK' : 'OVER',
              context: formatExecCurrency(budgetMetrics.remaining, true) + ' remaining',
              deltaDirection: budgetMetrics.onTrack ? 'positive' : 'negative'
            }
          ],
          
          insights: [
            {
              priority: budgetMetrics.coverageBreakdown.bi.change > 30000000 ? 'critical' : 'high',
              headline: `BI claims ${budgetMetrics.coverageBreakdown.bi.change >= 0 ? 'up' : 'down'} ${formatExecCurrency(Math.abs(budgetMetrics.coverageBreakdown.bi.change), true)} YoY`,
              action: 'Review BI severity trends and litigation exposure'
            },
            {
              priority: 'medium',
              headline: `Collision claims down ${formatExecCurrency(Math.abs(budgetMetrics.coverageBreakdown.cl.change), true)} YoY`,
              action: 'Maintain current claims handling efficiency'
            },
            {
              priority: 'info',
              headline: `Projected year-end: ${formatExecCurrency(budgetMetrics.projectedBurn, true)}`,
              action: budgetMetrics.projectedVariance >= 0 
                ? `${formatExecCurrency(budgetMetrics.projectedVariance, true)} under budget expected`
                : `${formatExecCurrency(Math.abs(budgetMetrics.projectedVariance), true)} over budget - escalate`
            },
            {
              priority: 'info',
              headline: `Average cost per claim: $${Math.round(budgetMetrics.ytdPaid / 345).toLocaleString()}`,
              action: 'Monitor severity trends for leading indicators'
            }
          ],
          
          bottomLine: budgetMetrics.onTrack 
            ? `Claims payments are tracking well within budget parameters. YTD 2026 spend of ${formatExecCurrency(budgetMetrics.ytdPaid, true)} represents minimal budget utilization with ${formatExecCurrency(budgetMetrics.remaining, true)} remaining.`
            : `ALERT: Claims payments exceeding budget trajectory. Projected overage of ${formatExecCurrency(Math.abs(budgetMetrics.projectedVariance), true)} requires immediate CFO review.`
        },
        
        tables: [
          {
            title: 'Coverage Breakdown - YoY Comparison',
            headers: ['Coverage', '2025 Full Year', '2026 YTD', 'Change', 'Claims', 'Avg/Claim'],
            rows: [
              ...Object.values(budgetMetrics.coverageBreakdown).map(cov => ({
                cells: [
                  cov.name,
                  formatExecCurrency(cov.ytd2025, true),
                  formatExecCurrency(cov.ytd2026, true),
                  `${cov.change >= 0 ? '+' : ''}${formatExecCurrency(cov.change, true)}`,
                  cov.claimCount2026.toLocaleString(),
                  `$${cov.avgPerClaim2026.toLocaleString()}`
                ],
                highlight: cov.change > 20000000 ? 'risk' as const : 
                          cov.change < -5000000 ? 'success' as const : undefined
              })),
              {
                cells: ['TOTAL', formatExecCurrency(budgetMetrics.total2025, true), formatExecCurrency(budgetMetrics.ytdPaid, true), 
                        `${yoyChange >= 0 ? '+' : ''}${formatExecCurrency(yoyChange, true)}`, '345', `$${Math.round(budgetMetrics.ytdPaid / 345).toLocaleString()}`],
                highlight: 'total' as const
              }
            ],
            footnote: 'Source: Loya Insurance Group - BI/UM/UI Payments 1/1/26 - 1/7/26'
          },
          {
            title: 'Monthly Budget Tracking',
            headers: ['Month', 'Budget', 'Actual', 'Variance', 'Status'],
            rows: budgetMetrics.monthlyData.slice(0, 11).map(month => ({
              cells: [
                month.month,
                formatExecCurrency(month.budget, true),
                month.actual > 0 ? formatExecCurrency(month.actual, true) : '-',
                month.actual > 0 ? formatExecCurrency(Math.abs(month.variance), true) : '-',
                month.actual > 0 ? (month.variance >= 0 ? 'Under' : 'Over') : 'Pending'
              ],
              highlight: month.actual > 0 && month.variance < 0 ? 'warning' as const : undefined
            }))
          }
        ],
        
        // 6 Quarters of Expert Data
        quarterlyData: EXPERT_QUARTERLY_DATA,
        
        // Appendix with detailed analysis
        appendix: [
          {
            title: 'Expert Spend Trend Analysis',
            content: `Over the past 6 quarters, expert spend has averaged $${Math.round(EXPERT_QUARTERLY_DATA.reduce((s, q) => s + q.paidMonthly, 0) / EXPERT_QUARTERLY_DATA.length / 1000)}K per month. Q1 2025 showed the largest variance (-$588K) due to accelerated expert retention for complex BI cases. Q4 2025 shows recovery with +$107K favorable variance.`,
            chart: {
              type: 'horizontalBar' as const,
              title: 'Quarterly Expert Spend (Paid)',
              data: EXPERT_QUARTERLY_DATA.map(q => ({
                label: q.quarter,
                value: q.paid / 1000
              }))
            }
          },
          {
            title: 'Coverage Mix Impact on Budget',
            content: `BI/UM/UI claims YTD spend totals $6.04M (1/1/26 - 1/7/26). 345 claims paid - BI: $5.85M (335), UM: $101.9K (7), UI: $90K (3). Tracking against annual budget of $402.8M.`,
            table: {
              title: 'Average Cost Per Claim by Coverage',
              headers: ['Coverage', '2025 Avg', '2026 Avg', 'Change', 'Trend'],
              rows: Object.values(budgetMetrics.coverageBreakdown).map(cov => ({
                cells: [
                  cov.name,
                  `$${cov.avgPerClaim2025.toLocaleString()}`,
                  `$${cov.avgPerClaim2026.toLocaleString()}`,
                  `${cov.avgPerClaim2026 > cov.avgPerClaim2025 ? '+' : ''}$${(cov.avgPerClaim2026 - cov.avgPerClaim2025).toLocaleString()}`,
                  cov.avgPerClaim2026 > cov.avgPerClaim2025 ? '↑ Increasing' : '↓ Decreasing'
                ],
                highlight: cov.avgPerClaim2026 > cov.avgPerClaim2025 * 1.1 ? 'warning' as const : 
                          cov.avgPerClaim2026 < cov.avgPerClaim2025 * 0.9 ? 'success' as const : undefined
              }))
            }
          }
        ],
        
        includeAllContent: true
      };
      
      // === QUALITY GATE CHECK ===
      const qualityScore = auditReportQuality(reportConfig);
      
      if (!qualityScore.passed) {
        console.warn('Quality Gate Warning:', qualityScore.issues);
      }
      
      // Generate the report
      const result = await generateExecutiveReport(reportConfig);
      
      if (result.success) {
        toast.success(`Board-ready Budget report generated (Quality: ${result.qualityScore.overall.toFixed(1)}/10)`);
      } else {
        throw new Error('Report generation failed');
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingBudgetPDF(false);
    }
  }, [budgetMetrics]);

  // Historical metrics for comparisons (would come from DB in production)
  const historicalMetrics = useMemo(() => ({
    lastWeek: { cp1Rate: 25.8, totalClaims: 26542, cp1Claims: 6848 },
    lastMonth: { cp1Rate: 25.2, totalClaims: 25890, cp1Claims: 6524 },
    lastYear: { cp1Rate: 23.4, totalClaims: 24150, cp1Claims: 5651 },
  }), []);

  // Generate Board-Ready Executive PDF for CP1 Analysis - Dark Theme with Logo (THIS CSV ONLY)
  const generateCP1PDF = useCallback(async () => {
    setGeneratingCP1PDF(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { default: loyaLogo } = await import('@/assets/fli_logo.jpg');
      const { getReportContext } = await import('@/lib/executivePDFFramework');
      
      const doc = new jsPDF({ orientation: 'portrait' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const ctx = getReportContext();
      const m = { l: 10, r: 10, t: 10 };
      const cw = pw - m.l - m.r;
      
      // COLORS - EXECUTIVE DARK THEME
      const C = {
        bg: [12, 12, 12] as [number, number, number],
        headerBg: [22, 22, 22] as [number, number, number],
        rowDark: [18, 18, 18] as [number, number, number],
        rowLight: [24, 24, 24] as [number, number, number],
        border: [45, 45, 45] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
        offWhite: [240, 240, 240] as [number, number, number],
        muted: [140, 140, 140] as [number, number, number],
        green: [16, 185, 129] as [number, number, number],
        red: [220, 38, 38] as [number, number, number],
        amber: [245, 158, 11] as [number, number, number],
        gold: [212, 175, 55] as [number, number, number],
      };

      // Use CP1 data from the CP1 CSV ONLY
      const CP1_DATA = cp1BoxData?.cp1Data || {
        biByAge: [],
        biTotal: { noCP: 0, yes: 0, total: 0 },
        byCoverage: [],
        totals: { noCP: 0, yes: 0, grandTotal: 0 },
        cp1Rate: '0.0',
        byStatus: { inProgress: 0, settled: 0, inProgressPct: '0.0', settledPct: '0.0' },
      };

      // CALCULATIONS (CSV baseline)
      const cp1ClaimCount = CP1_DATA.totals?.yes ?? 0;
      const denom = CP1_DATA.totals?.grandTotal ?? 0;
      const cp1RateOfInventory = denom > 0 ? ((cp1ClaimCount / denom) * 100).toFixed(1) : CP1_DATA.cp1Rate;

      const currentCP1Rate = parseFloat(cp1RateOfInventory);
      const status = currentCP1Rate > 30 ? 'CRITICAL' : currentCP1Rate > 27 ? 'ELEVATED' : 'STABLE';
      
      // Note: These are claim counts, not dollar exposure (we don't have per-claim financials)
      const agedBIClaimCount = CP1_DATA.biByAge?.[0]?.yes ?? 0;

      // BACKGROUND
      doc.setFillColor(...C.bg);
      doc.rect(0, 0, pw, ph, 'F');
      let y = m.t;

      // HEADER WITH LOGO
      doc.setFillColor(...C.headerBg);
      doc.rect(0, 0, pw, 24, 'F');
      doc.setFillColor(...C.gold);
      doc.rect(0, 24, pw, 0.5, 'F');

      try {
        doc.addImage(loyaLogo, 'JPEG', m.l + 2, 4, 14, 14);
      } catch (e) { /* Logo failed */ }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...C.white);
      doc.text('CP1 ANALYSIS', m.l + 20, 10);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text('Policy Limits Risk Assessment', m.l + 20, 16);

      doc.setFontSize(7);
      doc.text(`${ctx.reportPeriod}  |  Q${ctx.quarter} FY${ctx.fiscalYear}`, pw - m.r, 13, { align: 'right' });
      y = 28;

      // STATUS BANNER
      const bannerColor = status === 'CRITICAL' ? C.red : status === 'ELEVATED' ? C.amber : C.green;
      doc.setFillColor(...bannerColor);
      doc.roundedRect(m.l, y, cw, 10, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.white);
      doc.text(`STATUS: ${status}  |  ${cp1ClaimCount.toLocaleString()} CLAIMS AT LIMITS  |  ${cp1RateOfInventory}% CP1 RATE`, pw / 2, y + 7, { align: 'center' });
      y += 14;

      // KEY METRICS ROW
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.gold);
      doc.text('KEY METRICS', m.l, y + 3);
      y += 6;

      const metricBoxW = cw / 4 - 2;
      const biRate = CP1_DATA.biTotal?.total > 0
        ? ((CP1_DATA.biTotal.yes / CP1_DATA.biTotal.total) * 100).toFixed(1)
        : '0.0';
      const agedBIPct = cp1ClaimCount > 0 ? ((agedBIClaimCount / cp1ClaimCount) * 100).toFixed(0) : '0';
      const metrics = [
        { label: 'CP1 CLAIMS', value: cp1ClaimCount.toLocaleString(), sub: 'At Policy Limits' },
        { label: 'CP1 RATE', value: cp1RateOfInventory + '%', sub: 'of Total Inventory' },
        { label: 'BI CP1 RATE', value: biRate + '%', sub: 'Highest by Coverage' },
        { label: 'AGED BI', value: agedBIClaimCount.toLocaleString(), sub: `${agedBIPct}% of CP1 (365+)` },
      ];

      metrics.forEach((met, i) => {
        const x = m.l + i * (metricBoxW + 2);
        doc.setFillColor(...C.rowDark);
        doc.roundedRect(x, y, metricBoxW, 18, 1, 1, 'F');
        doc.setFontSize(6);
        doc.setTextColor(...C.muted);
        doc.text(met.label, x + 3, y + 5);
        doc.setFontSize(11);
        doc.setTextColor(...C.white);
        doc.setFont('helvetica', 'bold');
        doc.text(met.value, x + 3, y + 12);
        doc.setFontSize(5);
        doc.setTextColor(...C.muted);
        doc.setFont('helvetica', 'normal');
        doc.text(met.sub, x + 3, y + 16);
      });
      y += 22;

      // EXECUTIVE SUMMARY BOX
      doc.setFillColor(...C.rowDark);
      doc.roundedRect(m.l, y, cw, 22, 1, 1, 'F');
      doc.setFillColor(...C.gold);
      doc.rect(m.l, y, 1.5, 22, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.gold);
      doc.text('EXECUTIVE SUMMARY', m.l + 5, y + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.offWhite);
      const bottomLine = `${cp1ClaimCount.toLocaleString()} claims (${CP1_DATA.cp1Rate}%) at policy limits. BI drives ${biRate}% CP1 rate. Aged BI (365+ days) = ${agedBIClaimCount.toLocaleString()} claims (${agedBIPct}% of all CP1). ${status === 'CRITICAL' ? 'INTERVENTION REQUIRED.' : status === 'ELEVATED' ? 'CLOSE MONITORING NEEDED.' : 'MAINTAIN CURRENT PROTOCOLS.'}`;
      const lines = doc.splitTextToSize(bottomLine, cw - 12);
      doc.text(lines, m.l + 5, y + 11);
      y += 26;

      // CP1 BY COVERAGE TABLE
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.gold);
      doc.text('CP1 BY LINE OF BUSINESS', m.l, y + 3);
      y += 6;

      const covColW = [45, 35, 35, 25, cw - 140];
      const rowH = 8;

      // Header
      doc.setFillColor(...C.headerBg);
      doc.rect(m.l, y, cw, rowH, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      const covHeaders = ['COVERAGE', 'CP1 CLAIMS', 'TOTAL', 'RATE', 'STATUS'];
      let xPos = m.l + 3;
      covHeaders.forEach((h, i) => {
        doc.text(h, xPos, y + 5.5);
        xPos += covColW[i];
      });
      y += rowH;

      // Data rows
      doc.setFontSize(6.5);
      CP1_DATA.byCoverage.forEach((row, i) => {
        const rowStatus = row.cp1Rate > 40 ? 'CRITICAL' : row.cp1Rate > 30 ? 'ELEVATED' : 'STABLE';
        const statusColor = rowStatus === 'CRITICAL' ? C.red : rowStatus === 'ELEVATED' ? C.amber : C.green;
        
        doc.setFillColor(...(i % 2 === 0 ? C.rowDark : C.rowLight));
        doc.rect(m.l, y, cw, rowH, 'F');
        
        xPos = m.l + 3;
        doc.setTextColor(...C.offWhite);
        doc.setFont('helvetica', 'bold');
        doc.text(row.coverage, xPos, y + 5.5);
        xPos += covColW[0];
        
        doc.setFont('helvetica', 'normal');
        doc.text(row.yes.toLocaleString(), xPos, y + 5.5);
        xPos += covColW[1];
        doc.text(row.total.toLocaleString(), xPos, y + 5.5);
        xPos += covColW[2];
        doc.text(`${row.cp1Rate}%`, xPos, y + 5.5);
        xPos += covColW[3];
        doc.setTextColor(...statusColor);
        doc.setFont('helvetica', 'bold');
        doc.text(rowStatus, xPos, y + 5.5);
        
        y += rowH;
      });

      // Total row
      doc.setFillColor(...C.headerBg);
      doc.rect(m.l, y, cw, rowH, 'F');
      xPos = m.l + 3;
      doc.setTextColor(...C.gold);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL', xPos, y + 5.5);
      xPos += covColW[0];
      doc.setTextColor(...C.white);
      doc.text(CP1_DATA.totals.yes.toLocaleString(), xPos, y + 5.5);
      xPos += covColW[1];
      doc.text(CP1_DATA.totals.grandTotal.toLocaleString(), xPos, y + 5.5);
      xPos += covColW[2];
      doc.text(CP1_DATA.cp1Rate + '%', xPos, y + 5.5);
      y += rowH + 6;

      // BI AGING TABLE
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.gold);
      doc.text('BI AGING RISK (365+ DAYS = HIGHEST PRIORITY)', m.l, y + 3);
      y += 6;

      // Header
      doc.setFillColor(...C.headerBg);
      doc.rect(m.l, y, cw, rowH, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      const ageHeaders = ['AGE BUCKET', 'CP1 CLAIMS', 'TOTAL', 'CP1 RATE', 'PRIORITY'];
      xPos = m.l + 3;
      ageHeaders.forEach((h, i) => {
        doc.text(h, xPos, y + 5.5);
        xPos += covColW[i];
      });
      y += rowH;

      // Age rows
      doc.setFontSize(6.5);
      CP1_DATA.biByAge.forEach((row, i) => {
        const rate = ((row.yes / row.total) * 100).toFixed(0);
        const priority = i === 0 ? 'URGENT' : i === 1 ? 'HIGH' : 'NORMAL';
        const priorityColor = i === 0 ? C.red : i === 1 ? C.amber : C.green;
        
        doc.setFillColor(...(i % 2 === 0 ? C.rowDark : C.rowLight));
        doc.rect(m.l, y, cw, rowH, 'F');
        
        xPos = m.l + 3;
        doc.setTextColor(...C.offWhite);
        doc.setFont('helvetica', 'bold');
        doc.text(row.age, xPos, y + 5.5);
        xPos += covColW[0];
        
        doc.setFont('helvetica', 'normal');
        doc.text(row.yes.toLocaleString(), xPos, y + 5.5);
        xPos += covColW[1];
        doc.text(row.total.toLocaleString(), xPos, y + 5.5);
        xPos += covColW[2];
        doc.text(`${rate}%`, xPos, y + 5.5);
        xPos += covColW[3];
        doc.setTextColor(...priorityColor);
        doc.setFont('helvetica', 'bold');
        doc.text(priority, xPos, y + 5.5);
        
        y += rowH;
      });
      y += 6;

      // ACTION ITEMS
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.gold);
      doc.text('EXECUTIVE ACTIONS', m.l, y + 3);
      y += 6;

      const actions = [
        { priority: 'IMMEDIATE', action: `Prioritize resolution of ${agedBIClaimCount.toLocaleString()} aged BI claims (365+ days)` },
        { priority: 'STRATEGIC', action: 'Implement early limits evaluation at 60-day mark' },
        { priority: 'PROCESS', action: 'Review BI settlement authority and escalation thresholds' },
      ];

      actions.forEach((a, i) => {
        const priorityColor = i === 0 ? C.red : i === 1 ? C.amber : C.muted;
        doc.setFillColor(...(i % 2 === 0 ? C.rowDark : C.rowLight));
        doc.rect(m.l, y, cw, 8, 'F');
        doc.setFillColor(...priorityColor);
        doc.rect(m.l, y, 2, 8, 'F');
        
        doc.setFontSize(6);
        doc.setTextColor(...priorityColor);
        doc.setFont('helvetica', 'bold');
        doc.text(a.priority, m.l + 5, y + 5.5);
        
        doc.setTextColor(...C.offWhite);
        doc.setFont('helvetica', 'normal');
        doc.text(a.action, m.l + 28, y + 5.5);
        y += 8;
      });

      // FOOTER
      doc.setFillColor(...C.headerBg);
      doc.rect(0, ph - 10, pw, 10, 'F');
      doc.setFillColor(...C.gold);
      doc.rect(0, ph - 10, pw, 0.3, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text('CONFIDENTIAL', m.l, ph - 3);
      doc.text('Fred Loya Insurance', pw / 2, ph - 3, { align: 'center' });
      doc.text('Page 1 of 1', pw - m.r, ph - 3, { align: 'right' });

      // SAVE
      const filename = `CP1_Analysis_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);
      toast.success('CP1 Analysis report generated');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingCP1PDF(false);
    }
  }, [historicalMetrics, cp1BoxData]);

  // Generate Excel for CP1 Analysis (THIS CSV ONLY)
  const generateCP1Excel = useCallback(async () => {
    setGeneratingCP1Excel(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      // IMPORTANT: CP1 Excel must use ONLY the CP1 CSV data source.
      // Shadow the outer CP1_DATA to avoid "used before declaration" and prevent accidental mixing.
      const CP1_DATA = cp1BoxData?.cp1Data || {
        biByAge: [],
        biTotal: { noCP: 0, yes: 0, total: 0 },
        byCoverage: [],
        totals: { noCP: 0, yes: 0, grandTotal: 0 },
        cp1Rate: '0.0',
        byStatus: { inProgress: 0, settled: 0, inProgressPct: '0.0', settledPct: '0.0' },
      };

      const summaryData = [
        ['CP1 ANALYSIS (CSV ONLY)'],
        [`Source: public/data/cp1-analysis.csv`],
        [`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`],
        [],
        ['EXECUTIVE SUMMARY'],
        ['Metric', 'Value'],
        ['Total Claims', CP1_DATA.totals.grandTotal],
        ['CP1', CP1_DATA.totals.yes],
        ['No CP', CP1_DATA.totals.noCP],
        ['CP1 Rate', `${CP1_DATA.cp1Rate}%`],
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryData), 'Executive Summary');

      // Sheet 2: BI Age Breakdown
      const biAgeData = [
        ['BODILY INJURY - CP1 BY AGE'],
        [],
        ['Age Bucket', 'No CP', 'CP1 Yes', 'Total', 'CP1 Rate'],
        ...CP1_DATA.biByAge.map(row => [
          row.age,
          row.noCP,
          row.yes,
          row.total,
          row.total > 0 ? `${((row.yes / row.total) * 100).toFixed(1)}%` : '0.0%'
        ]),
        ['BI Total', CP1_DATA.biTotal.noCP, CP1_DATA.biTotal.yes, CP1_DATA.biTotal.total, CP1_DATA.biTotal.total > 0 ? `${((CP1_DATA.biTotal.yes / CP1_DATA.biTotal.total) * 100).toFixed(1)}%` : '0.0%'],
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(biAgeData), 'BI Age Breakdown');

      // Sheet 3: Coverage Summary
      const coverageData = [
        ['CP1 BY COVERAGE TYPE'],
        [],
        ['Coverage', 'No CP', 'CP1 Yes', 'Total', 'CP1 Rate'],
        ...CP1_DATA.byCoverage.map(row => [
          row.coverage,
          row.noCP,
          row.yes,
          row.total,
          `${row.cp1Rate}%`
        ]),
        ['GRAND TOTAL', CP1_DATA.totals.noCP, CP1_DATA.totals.yes, CP1_DATA.totals.grandTotal, `${CP1_DATA.cp1Rate}%`],
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(coverageData), 'Coverage Summary');

      // Sheet 4: CP1 Trigger Flags Summary (CSV only)
      const fs = cp1BoxData?.fatalitySummary;
      const triggerFlagsData = [
        ['CP1 TRIGGER FLAGS SUMMARY (CSV ONLY)'],
        [`Data Date: ${cp1BoxData?.dataDate || ''}`],
        [],
        ['Flag', 'Count'],
        ['Fatality', fs?.fatalityCount || 0],
        ['Surgery', fs?.surgeryCount || 0],
        ['Meds > Limits', fs?.medsVsLimitsCount || 0],
        ['Hospitalization', fs?.hospitalizationCount || 0],
        ['Loss of Consciousness', fs?.lossOfConsciousnessCount || 0],
        ['Lacerations', fs?.lacerationsCount || 0],
        ['Ped/Moto/Bicyclist', fs?.pedestrianMotorcyclistCount || 0],
        ['DUI/DWI/Hit & Run', fs?.duiDwiHitRunCount || 0],
        ['Life Care Planner', fs?.lifeCarePlannerCount || 0],
        ['Confirmed Fractures', fs?.confirmedFracturesCount || 0],
        ['Agg Factors DUI', fs?.aggFactorsDuiCount || 0],
        ['Fled Scene', fs?.fledSceneCount || 0],
        ['Prior Surgery', fs?.priorSurgeryCount || 0],
        ['Pregnancy', fs?.pregnancyCount || 0],
        ['Ambulance Used', fs?.ambulanceUsedCount || 0],
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(triggerFlagsData), 'Trigger Flags');

      // Sheet 5: Raw Claims Data (THIS CSV ONLY) - In Progress ONLY
      const raw = cp1BoxData?.rawClaims || [];
      const inProgress = raw.filter((c) => String(c.biStatus || '').trim().toLowerCase() === 'in progress');

      const rawRows = inProgress.map((c) => ({
        claimNumber: c.claimNumber,
        claimant: c.claimant,
        coverage: c.coverage,
        days: c.days,
        ageBucket: c.ageBucket,
        typeGroup: c.typeGroup,
        teamGroup: c.teamGroup,
        openReserves: c.openReserves,
        cp1ClaimFlag: c.cp1Flag,
        overallCP1: c.overallCP1,
        biStatus: c.biStatus,
        fatality: c.fatality ? 'YES' : '',
        surgery: c.surgery ? 'YES' : '',
        medsVsLimits: c.medsVsLimits ? 'YES' : '',
        hospitalization: c.hospitalization ? 'YES' : '',
        lossOfConsciousness: c.lossOfConsciousness ? 'YES' : '',
        lacerations: c.lacerations ? 'YES' : '',
        pedestrianMotorcyclist: c.pedestrianMotorcyclist ? 'YES' : '',
        duiDwiHitRun: c.duiDwiHitRun ? 'YES' : '',
        lifeCarePlanner: c.lifeCarePlanner ? 'YES' : '',
        confirmedFractures: c.confirmedFractures ? 'YES' : '',
        aggFactorsDui: c.aggFactorsDui ? 'YES' : '',
        fledScene: c.fledScene ? 'YES' : '',
        priorSurgery: c.priorSurgery ? 'YES' : '',
        pregnancy: c.pregnancy ? 'YES' : '',
        ambulanceUsed: c.ambulanceUsed ? 'YES' : '',
      }));

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rawRows), 'Raw (In Progress Only)');

      XLSX.writeFile(workbook, `CP1-Analysis-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('CP1 Analysis Excel generated (CSV only)');
    } catch (err) {
      console.error('Error generating Excel:', err);
      toast.error('Failed to generate Excel');
    } finally {
      setGeneratingCP1Excel(false);
    }
  }, [cp1BoxData]);

  // Generate Combined Board-Ready Executive Package (Budget + Decisions + CP1)
  const generateCombinedBoardPackage = useCallback(async () => {
    setGeneratingBoardPackage(true);
    try {
      // Ensure CSV data is loaded first
      if (!data?.cp1Data || data.cp1Data.totals.grandTotal === 0) {
        toast.error('Claims data not loaded. Please wait for data to load and try again.');
        setGeneratingBoardPackage(false);
        return;
      }
      
      // Ensure we have pending decisions loaded
      if (pendingDecisions.length === 0) {
        await fetchPendingDecisions();
      }
      
      const yoyChange = budgetMetrics.ytdPaid - budgetMetrics.total2025;
      const yoyChangePercent = (yoyChange / budgetMetrics.total2025) * 100;
      
      const packageConfig: ExecutivePackageConfig = {
        sections: [
          {
            id: 'budget',
            title: 'BUDGET BURN RATE',
            financialImpact: formatExecCurrency(budgetMetrics.ytdPaid, true),
            riskLevel: budgetMetrics.onTrack ? 'stable' : 'elevated',
            keyMetric: { label: 'Burn Rate', value: `${budgetMetrics.burnRate}%` },
            actionRequired: budgetMetrics.onTrack ? 'Monitor' : 'Review BI spend'
          },
          {
            id: 'decisions',
            title: 'PENDING DECISIONS',
            financialImpact: formatExecCurrency(pendingDecisionsStats.totalExposure, true),
            riskLevel: pendingDecisionsStats.critical > 0 ? 'critical' : 'stable',
            keyMetric: { label: 'Critical', value: pendingDecisionsStats.critical.toString() },
            actionRequired: pendingDecisionsStats.critical > 0 ? 'Immediate review' : 'Standard process'
          },
          {
            id: 'cp1',
            title: 'CP1 LIMITS',
            financialImpact: `${CP1_DATA.totals.yes.toLocaleString()} claims`,
            riskLevel: parseFloat(CP1_DATA.cp1Rate) > 28 ? 'elevated' : 'stable',
            keyMetric: { label: 'CP1 Rate', value: `${CP1_DATA.cp1Rate}%` },
            actionRequired: 'Review aged BI'
          }
        ],
        budgetData: {
          annualBudget: budgetMetrics.annualBudget,
          ytdPaid: budgetMetrics.ytdPaid,
          burnRate: budgetMetrics.burnRate,
          remaining: budgetMetrics.remaining,
          projectedBurn: budgetMetrics.projectedBurn,
          projectedVariance: budgetMetrics.projectedVariance,
          onTrack: budgetMetrics.onTrack,
          yoyChange,
          yoyChangePercent,
          coverageBreakdown: budgetMetrics.coverageBreakdown,
          monthlyData: budgetMetrics.monthlyData
        },
        decisionsData: {
          total: pendingDecisionsStats.total,
          critical: pendingDecisionsStats.critical,
          thisWeek: pendingDecisionsStats.thisWeek,
          statuteDeadlines: pendingDecisionsStats.statuteDeadlines,
          totalExposure: pendingDecisionsStats.totalExposure,
          decisions: pendingDecisions.length > 0 
            ? pendingDecisions.map(d => ({
                matterId: d.matterId,
                claimant: d.claimant,
                amount: d.amount,
                daysOpen: d.daysOpen,
                lead: d.lead,
                severity: d.severity,
                recommendedAction: d.recommendedAction,
                department: d.department,
                type: d.type
              }))
            : (decisionsData?.claims || []).slice(0, 20).map(c => ({
                matterId: c.claimNumber,
                claimant: c.state,
                amount: c.reserves,
                daysOpen: 0,
                lead: c.team,
                severity: c.reserves >= 100000 ? 'critical' as const : c.reserves >= 50000 ? 'high' as const : 'medium' as const,
                recommendedAction: c.reason,
                department: 'Claims',
                type: c.painLevel
              }))
        },
        cp1Data: {
          totalClaims: CP1_DATA.totals.grandTotal,
          cp1Count: CP1_DATA.totals.yes,
          cp1Rate: `${CP1_DATA.cp1Rate}%`,
          biCP1Rate: '34.2%',
          byCoverage: CP1_DATA.byCoverage,
          biByAge: CP1_DATA.biByAge,
          biTotal: CP1_DATA.biTotal,
          totals: CP1_DATA.totals
        },
        quarterlyExpertData: EXPERT_QUARTERLY_DATA
      };
      
      const result = await generateBoardReadyPackage(packageConfig);
      
      if (result.success) {
        toast.success(`Board Package generated: ${result.pageCount} pages`);
      } else {
        throw new Error('Package generation failed');
      }
    } catch (err) {
      console.error('Error generating board package:', err);
      toast.error('Failed to generate board package');
    } finally {
      setGeneratingBoardPackage(false);
    }
  }, [pendingDecisions, pendingDecisionsStats, budgetMetrics, fetchPendingDecisions, data, decisionsData]);
  
  const formatNumber = (val: number) => val.toLocaleString();
  const formatCurrency = (val: number) => `$${(val / 1000000).toFixed(1)}M`;
  const formatCurrencyK = (val: number) => `$${(val / 1000).toFixed(0)}K`;
  const formatCurrencyFull = (val: number) => `$${val.toLocaleString()}`;
  const formatCurrencyFullValue = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  // Fetch existing reviews
  const fetchReviews = async () => {
    const { data: reviewData, error: reviewError } = await supabase
      .from('claim_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (!reviewError && reviewData) {
      setReviews(reviewData);
    }
    setLoadingReviews(false);
  };

  useEffect(() => {
    fetchReviews();

    // Set up realtime subscription
    const channel = supabase
      .channel('claim_reviews_realtime')
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

  // Calculate review stats
  const reviewStats = useMemo(() => {
    const assigned = reviews.filter(r => r.status === 'assigned').length;
    const inReview = reviews.filter(r => r.status === 'in_review').length;
    const completed = reviews.filter(r => r.status === 'completed').length;
    const flagged = reviews.filter(r => r.status === 'flagged').length;
    const totalReserves = reviews.reduce((sum, r) => sum + (Number(r.reserves) || 0), 0);
    
    return { total: reviews.length, assigned, inReview, completed, flagged, totalReserves };
  }, [reviews]);

  // Dynamic totals from CSV - single source of truth
  const KNOWN_TOTALS = useMemo(() => data?.knownTotals || {
    totalOpenClaims: 0,
    totalOpenExposures: 0,
    atr: { claims: 0, exposures: 0 },
    lit: { claims: 0, exposures: 0 },
    bi3: { claims: 0, exposures: 0 },
    earlyBI: { claims: 0, exposures: 0 },
    flagged: 0,
    newClaims: 0,
    closed: 0,
  }, [data]);

  // Dynamic CP1 data for the CP1 Analysis "box" — MUST come ONLY from the dedicated CP1 CSV
  const CP1_DATA = useMemo(() => cp1BoxData?.cp1Data || {
    biByAge: [],
    biTotal: { noCP: 0, yes: 0, total: 0 },
    byCoverage: [],
    totals: { noCP: 0, yes: 0, grandTotal: 0 },
    cp1Rate: '0.0',
    byStatus: { inProgress: 0, settled: 0, inProgressPct: '0.0', settledPct: '0.0' },
  }, [cp1BoxData]);

  // CP1 rate should be comparable to the same baseline used in the original build (~27k open exposures).
  // We use the historical baseline total until a full-inventory raw feed is available.
  const CP1_RATE_OF_OPEN_INVENTORY = useMemo(() => {
    const cp1Count = CP1_DATA.totals?.yes ?? 0;
    const baselineTotal = historicalMetrics.lastWeek.totalClaims || 0;
    const denom = baselineTotal > 0 ? baselineTotal : (CP1_DATA.totals?.grandTotal ?? 0);
    return denom > 0 ? ((cp1Count / denom) * 100).toFixed(1) : '0.0';
  }, [CP1_DATA.totals, historicalMetrics]);
  // EXECUTIVE METRICS - Dynamic from CSV data
  const EXECUTIVE_METRICS = useMemo(() => {
    if (!data) return {
      trends: { reservesMoM: 0, reservesYoY: 0, claimsMoM: 0, claimsYoY: 0, closureRateMoM: 0 },
      aging: { over365Days: 0, over365Reserves: 0, over365Pct: 0, criticalAging: 0, avgAge: 0 },
    };
    
    // Dynamic aging from actual CSV data
    const over365Days = data.totals.age365Plus;
    const totalClaims = data.totals.grandTotal;
    const over365Pct = totalClaims > 0 ? ((over365Days / totalClaims) * 100) : 0;
    
    // Get reserves for 365+ from financials.byAge
    const aged365Financial = data.financials.byAge.find(a => a.age === '365+ Days');
    const over365Reserves = aged365Financial?.openReserves || 0;
    
    return {
      // Month-over-month trends (static for now - would come from historical data comparison)
      trends: {
        reservesMoM: data.delta?.reservesChangePercent || 0,
        reservesYoY: -5.1,          // Would need YoY data
        claimsMoM: data.delta?.changePercent || 0,
        claimsYoY: -8.4,            // Would need YoY data
        closureRateMoM: 0,          // N/A for open inventory
      },
      // Aging alerts - DYNAMIC from CSV
      aging: {
        over365Days,
        over365Reserves,
        over365Pct: parseFloat(over365Pct.toFixed(1)),
        criticalAging: 0,           // Would need 2yr+ bucket
        avgAge: 287,                // Would need to calculate
      },
    };
  }, [data]);

  // Dynamic financial data from CSV - single source of truth
  const FINANCIAL_DATA = useMemo(() => {
    if (!data?.financials) {
      return {
        byAge: [],
        byQueue: [],
        byTypeGroup: [],
        totals: { totalOpenReserves: 0, totalLowEval: 0, totalHighEval: 0, noEvalReserves: 0, noEvalCount: 0 }
      };
    }
    return {
      byAge: data.financials.byAge,
      byQueue: data.financials.byQueue, // Now populated from CSV Type Group data
      byTypeGroup: data.financials.byTypeGroup,
      totals: {
        totalOpenReserves: data.financials.totalOpenReserves,
        totalLowEval: data.financials.totalLowEval,
        totalHighEval: data.financials.totalHighEval,
        noEvalReserves: data.financials.noEvalReserves,
        noEvalCount: data.financials.noEvalCount,
      }
    };
  }, [data]);

  // Historical CP1 trend data (static - for trend charts)
  // Jan 26 rate uses the same ~27k baseline as previous months for comparability
  const jan26BaselineTotal = historicalMetrics.lastWeek.totalClaims || 26709;
  const jan26CP1Rate = jan26BaselineTotal > 0 
    ? parseFloat(((CP1_DATA.totals.yes / jan26BaselineTotal) * 100).toFixed(1))
    : parseFloat(CP1_DATA.cp1Rate);
  
  const CP1_MONTHLY_TREND = [
    { month: 'Feb 25', cp1Rate: 24.2, cp1Count: 6420, totalClaims: 26528 },
    { month: 'Mar 25', cp1Rate: 24.8, cp1Count: 6580, totalClaims: 26532 },
    { month: 'Apr 25', cp1Rate: 25.1, cp1Count: 6690, totalClaims: 26653 },
    { month: 'May 25', cp1Rate: 25.4, cp1Count: 6755, totalClaims: 26594 },
    { month: 'Jun 25', cp1Rate: 25.8, cp1Count: 6845, totalClaims: 26531 },
    { month: 'Jul 25', cp1Rate: 26.0, cp1Count: 6912, totalClaims: 26585 },
    { month: 'Aug 25', cp1Rate: 26.2, cp1Count: 6975, totalClaims: 26622 },
    { month: 'Sep 25', cp1Rate: 26.1, cp1Count: 6948, totalClaims: 26620 },
    { month: 'Oct 25', cp1Rate: 26.3, cp1Count: 7010, totalClaims: 26654 },
    { month: 'Nov 25', cp1Rate: 26.4, cp1Count: 7048, totalClaims: 26697 },
    { month: 'Dec 25', cp1Rate: 26.5, cp1Count: 7078, totalClaims: 26709 },
    { month: 'Jan 26', cp1Rate: jan26CP1Rate, cp1Count: CP1_DATA.totals.yes, totalClaims: jan26BaselineTotal },
  ];

  // Rear Ends - Texas Areas 101-110 | Loss Desc: IV R/E CV only
  // Now using dynamic data from CSV via useOpenExposureData hook
  const TEXAS_REAR_END_DATA = useMemo(() => {
    if (!data?.texasRearEnd) {
      // Fallback to empty data if not loaded yet
      return {
        lossDescription: 'IV R/E CV',
        summary: { totalClaims: 0, totalReserves: 0, lowEval: 0, highEval: 0 },
        byArea: [],
        byAge: [
          { age: '365+ Days', claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
          { age: '181-365 Days', claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
          { age: '61-180 Days', claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
          { age: 'Under 60 Days', claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
        ],
      };
    }
    return data.texasRearEnd;
  }, [data?.texasRearEnd]);

  // Calculate derived metrics - now uses dynamic financials from CSV
  const metrics = useMemo(() => {
    if (!data) return null;

    const litTotal = data.typeGroupSummaries.find(t => t.typeGroup === 'LIT')?.grandTotal || KNOWN_TOTALS.lit.claims;
    const aged365Plus = data.totals.age365Plus;
    const totalClaims = data.totals.grandTotal || KNOWN_TOTALS.totalOpenClaims;
    const agedPct = totalClaims > 0 
      ? ((aged365Plus / totalClaims) * 100).toFixed(1)
      : '0';

    // Top 5 phases by count
    const topPhases = [...data.litPhases]
      .sort((a, b) => b.grandTotal - a.grandTotal)
      .slice(0, 8);

    // Use dynamic financials from CSV
    const dynamicFinancials = {
      byAge: data.financials.byAge,
      byQueue: FINANCIAL_DATA.byQueue,
      byTypeGroup: data.financials.byTypeGroup.length > 0 ? data.financials.byTypeGroup : FINANCIAL_DATA.byTypeGroup,
      totals: {
        totalOpenReserves: data.financials.totalOpenReserves,
        totalLowEval: data.financials.totalLowEval,
        totalHighEval: data.financials.totalHighEval,
        noEvalAmount: 0,
        noEvalCount: data.financials.noEvalCount,
      }
    };

    // Age distribution for chart with financials
    const ageDistribution = dynamicFinancials.byAge.map(item => ({
      ...item,
      fill: item.age === '365+ Days' ? 'hsl(var(--destructive))' :
            item.age === '181-365 Days' ? 'hsl(var(--warning))' :
            item.age === '61-180 Days' ? 'hsl(var(--accent))' :
            'hsl(var(--success))'
    }));

    // Type groups with correct counts - claims = unique claim#, exposures = rows
    const typeGroupLabels: Record<string, string> = {
      'ATR': 'ATR',
      'LIT': 'Litigation',
      'BI3': 'BI3',
      'EBI': 'Early BI',
      'COVG': 'Coverage',
      'LIM': 'Limits',
      'COV': 'Coverage',
    };
    
    // Use CSV data with unique claims for Claims, exposures for Exposures
    const typeGroups = data.typeGroupSummaries.length > 0 
      ? data.typeGroupSummaries.slice(0, 10).map(t => ({
          typeGroup: typeGroupLabels[t.typeGroup] || t.typeGroup,
          claims: t.uniqueClaims,
          exposures: t.grandTotal,
        }))
      : [
          { typeGroup: 'ATR', claims: 3987, exposures: 8349 },
          { typeGroup: 'Litigation', claims: 3755, exposures: 6198 },
          { typeGroup: 'BI3', claims: 2219, exposures: 4600 },
          { typeGroup: 'Early BI', claims: 142, exposures: 360 },
        ];

    return {
      litTotal,
      aged365Plus,
      agedPct,
      topPhases,
      ageDistribution,
      typeGroups,
      totalOpenClaims: totalClaims,
      totalOpenExposures: totalClaims, // Use same as claims for now
      flagged: KNOWN_TOTALS.flagged,
      financials: dynamicFinancials,
    };
  }, [data]);

  // High Eval Top 10 Managers (actual adjusters setting high evaluations with amounts)
  const HIGH_EVAL_MANAGERS: ManagerTracking[] = [
    { name: 'LUIS MARTINEZ', value: '$7.7M', category: 'high_eval' },
    { name: 'CHELSEY SHOGREN-MARTINEZ', value: '$3.8M', category: 'high_eval' },
    { name: 'MARC GUEVARA', value: '$3.7M', category: 'high_eval' },
    { name: 'FERNANDO CANALES', value: '$3.5M', category: 'high_eval' },
    { name: 'LUIS VELA', value: '$3.0M', category: 'high_eval' },
    { name: 'LINDA DAVILA', value: '$3.0M', category: 'high_eval' },
    { name: 'BRITTANY SORIA', value: '$3.0M', category: 'high_eval' },
    { name: 'JOEL FIERRO', value: '$2.8M', category: 'high_eval' },
    { name: 'CHRYSTAL PEREZ', value: '$2.7M', category: 'high_eval' },
    { name: 'SALVADOR GONZALEZ', value: '$2.6M', category: 'high_eval' },
  ];
  
  // Full list of adjusters with high evaluations for Excel export (with amounts) - SORTED BY AMOUNT DESC
  const ALL_HIGH_EVAL_ADJUSTERS: ManagerTracking[] = [
    { name: 'LUIS MARTINEZ', value: '$7,652,504.86', category: 'high_eval' },
    { name: 'CHELSEY SHOGREN-MARTINEZ', value: '$3,792,435.95', category: 'high_eval' },
    { name: 'MARC GUEVARA', value: '$3,749,733.01', category: 'high_eval' },
    { name: 'FERNANDO CANALES', value: '$3,503,946.17', category: 'high_eval' },
    { name: 'LUIS VELA', value: '$3,043,334.61', category: 'high_eval' },
    { name: 'LINDA DAVILA', value: '$2,978,373.03', category: 'high_eval' },
    { name: 'BRITTANY SORIA', value: '$2,955,498.00', category: 'high_eval' },
    { name: 'JOEL FIERRO', value: '$2,771,052.00', category: 'high_eval' },
    { name: 'CHRYSTAL PEREZ', value: '$2,678,470.02', category: 'high_eval' },
    { name: 'SALVADOR GONZALEZ', value: '$2,558,685.97', category: 'high_eval' },
    { name: 'PRISCILLA VEGA', value: '$2,494,885.01', category: 'high_eval' },
    { name: 'JAMES WALLACE', value: '$2,334,905.79', category: 'high_eval' },
    { name: 'MARIO HELLAMNS', value: '$2,207,330.31', category: 'high_eval' },
    { name: 'STARLA HENDERSON', value: '$2,086,043.90', category: 'high_eval' },
    { name: 'LINDA ROMERO', value: '$1,957,244.14', category: 'high_eval' },
    { name: 'ANDREA GARCIA', value: '$1,934,940.33', category: 'high_eval' },
    { name: 'DIANA SANCHEZ', value: '$1,483,678.39', category: 'high_eval' },
    { name: 'MARK TRAVIS', value: '$1,332,454.55', category: 'high_eval' },
    { name: 'ANDREA NIEVES', value: '$1,274,627.49', category: 'high_eval' },
    { name: 'ZACH WISEMAN', value: '$1,222,725.00', category: 'high_eval' },
    { name: 'KIMBERLY AGUILERA', value: '$1,168,613.20', category: 'high_eval' },
    { name: 'YULIZZA REYNA', value: '$1,137,777.57', category: 'high_eval' },
    { name: 'CHRISTINA GARCIA', value: '$965,460.17', category: 'high_eval' },
    { name: 'JOSE CANALES HUERTA', value: '$947,107.79', category: 'high_eval' },
    { name: 'OLIVIA MARTINEZ', value: '$742,904.03', category: 'high_eval' },
    { name: 'MANUEL CABALLERO', value: '$685,003.15', category: 'high_eval' },
    { name: 'MICHAEL PAULSEN', value: '$668,501.00', category: 'high_eval' },
    { name: 'ROBERT HOLCOMB', value: '$604,637.00', category: 'high_eval' },
    { name: 'LAURA GUERRA', value: '$601,318.00', category: 'high_eval' },
    { name: 'STEPHEN POOLAS', value: '$493,403.00', category: 'high_eval' },
    { name: '(blank)', value: '$494,671.01', category: 'high_eval' },
    { name: 'SANDRA PARADA GALLEGOS', value: '$426,134.64', category: 'high_eval' },
    { name: 'CHERYLE HARRIS-CHANEY', value: '$397,700.00', category: 'high_eval' },
    { name: 'MARIA JURADO', value: '$395,574.35', category: 'high_eval' },
    { name: 'RICHARD SALCEDO', value: '$387,499.73', category: 'high_eval' },
    { name: 'SARAH HENDERSON', value: '$299,950.01', category: 'high_eval' },
    { name: 'MANDY SALCEDO', value: '$270,868.81', category: 'high_eval' },
    { name: 'DIANA LANDIN', value: '$269,906.30', category: 'high_eval' },
    { name: 'ALEJANDRO CONTRERAS', value: '$259,213.00', category: 'high_eval' },
    { name: 'HEATHER SYKES', value: '$256,379.79', category: 'high_eval' },
    { name: 'ELVA TREVINO', value: '$248,900.00', category: 'high_eval' },
    { name: 'BARBARA VISSER', value: '$227,383.58', category: 'high_eval' },
    { name: 'EDWARD LUNA', value: '$227,726.47', category: 'high_eval' },
    { name: 'JOHN MIDDLETON', value: '$227,000.00', category: 'high_eval' },
    { name: 'ELIAS FRIAS', value: '$203,254.00', category: 'high_eval' },
    { name: 'MITZY GARCIA', value: '$196,603.00', category: 'high_eval' },
    { name: 'FELIX CRUZ', value: '$190,201.00', category: 'high_eval' },
    { name: 'ANNA BORDEN', value: '$187,191.47', category: 'high_eval' },
    { name: 'TROY VAZQUEZ', value: '$180,851.00', category: 'high_eval' },
    { name: 'CARLOS GUEVARA', value: '$176,685.56', category: 'high_eval' },
    { name: 'CHRISTOPHER BENNETT', value: '$176,000.00', category: 'high_eval' },
    { name: 'TERESA MASON', value: '$139,580.66', category: 'high_eval' },
    { name: 'MIRIAM ALVARADO', value: '$121,949.00', category: 'high_eval' },
    { name: 'DIANA MISSOURI', value: '$113,100.00', category: 'high_eval' },
    { name: 'MICHAEL SALAZAR', value: '$110,000.00', category: 'high_eval' },
    { name: 'STUART GARY', value: '$102,104.01', category: 'high_eval' },
    { name: 'JOSEPH JIMENEZ', value: '$101,490.00', category: 'high_eval' },
    { name: 'LISA GONZALEZ', value: '$97,852.00', category: 'high_eval' },
    { name: 'FERNANDO MEJORADO', value: '$93,100.02', category: 'high_eval' },
    { name: 'MIREYA DOMINGUEZ', value: '$89,994.00', category: 'high_eval' },
    { name: 'DANIA RODRIGUEZ', value: '$84,500.00', category: 'high_eval' },
    { name: 'ADRIAN ALVAREZ', value: '$68,800.00', category: 'high_eval' },
    { name: 'JASON THOMAS', value: '$58,641.11', category: 'high_eval' },
    { name: 'STEPHANIE OLIVAS', value: '$55,000.00', category: 'high_eval' },
    { name: 'MIRIAM MADRID', value: '$53,000.00', category: 'high_eval' },
    { name: 'ROCHELLE GURULE', value: '$51,961.00', category: 'high_eval' },
    { name: 'MONICA BURCHFIELD', value: '$50,000.00', category: 'high_eval' },
    { name: 'JOSE CARDENAS', value: '$50,000.00', category: 'high_eval' },
    { name: 'MARIAH UHLING', value: '$47,000.00', category: 'high_eval' },
    { name: 'ERIC YANES', value: '$46,000.00', category: 'high_eval' },
    { name: 'SANDRA ROMERO', value: '$45,000.00', category: 'high_eval' },
    { name: 'RACHAEL BLANCO', value: '$44,757.01', category: 'high_eval' },
    { name: 'GINA NICHOLSON', value: '$42,924.00', category: 'high_eval' },
    { name: 'GUADALUPE COMPIAN', value: '$42,354.00', category: 'high_eval' },
    { name: 'SUSANA IGLESIAS', value: '$42,161.06', category: 'high_eval' },
    { name: 'BRENDA CASTANEDA', value: '$42,096.02', category: 'high_eval' },
    { name: 'PATRICIA GALINDO', value: '$39,200.00', category: 'high_eval' },
    { name: 'MARIO SAUCEDA', value: '$37,493.53', category: 'high_eval' },
    { name: 'NEO RODRIGUEZ', value: '$37,160.94', category: 'high_eval' },
    { name: 'ANNA ARREDONDO', value: '$31,455.00', category: 'high_eval' },
    { name: 'KARLA OCHOA', value: '$31,129.60', category: 'high_eval' },
    { name: 'ROXANN PEREZ', value: '$30,600.00', category: 'high_eval' },
    { name: 'JEANNETTE SALAZAR', value: '$30,000.00', category: 'high_eval' },
    { name: 'STARLA HERNANDEZ', value: '$30,000.00', category: 'high_eval' },
    { name: 'TANAE MARTEL', value: '$30,000.00', category: 'high_eval' },
    { name: 'LUIS JIMENEZ', value: '$28,250.00', category: 'high_eval' },
    { name: 'FELICIA JACKSON', value: '$28,740.55', category: 'high_eval' },
    { name: 'DIANA RUBIO', value: '$26,500.00', category: 'high_eval' },
    { name: 'ASAEL PEREZ', value: '$26,353.55', category: 'high_eval' },
    { name: 'ARTURO LEDEZMA', value: '$26,042.80', category: 'high_eval' },
    { name: 'KIM CHAVEZ', value: '$25,000.00', category: 'high_eval' },
    { name: 'CHRISTOPHER BACHAND', value: '$22,500.00', category: 'high_eval' },
    { name: 'RENE SANCHEZ', value: '$20,962.97', category: 'high_eval' },
    { name: 'JASSON MONTOYA', value: '$20,750.00', category: 'high_eval' },
    { name: 'COURTNEY MCGUIRE', value: '$19,900.00', category: 'high_eval' },
    { name: 'SYLVIA GREGORY', value: '$19,003.00', category: 'high_eval' },
    { name: 'DUSTIN MILLER', value: '$18,730.00', category: 'high_eval' },
    { name: 'JESUS HERNANDEZ', value: '$18,600.00', category: 'high_eval' },
    { name: 'ALEXIS VALLES', value: '$17,600.01', category: 'high_eval' },
    { name: 'IVAN CARAVEO', value: '$17,100.00', category: 'high_eval' },
    { name: 'SYLVIA APONTE', value: '$16,185.10', category: 'high_eval' },
    { name: 'ROXANN DELOSSANTOS', value: '$15,409.18', category: 'high_eval' },
    { name: 'KEVIN DAVIS', value: '$15,000.00', category: 'high_eval' },
    { name: 'ARMANDO MARTINEZ', value: '$15,000.00', category: 'high_eval' },
    { name: 'ERIC RODRIGUEZ', value: '$15,008.00', category: 'high_eval' },
    { name: 'MAYTE ZAVALA', value: '$14,993.64', category: 'high_eval' },
    { name: 'BOBBI CAMPBELL', value: '$14,481.00', category: 'high_eval' },
    { name: 'NICHOLAS KIM', value: '$12,500.00', category: 'high_eval' },
    { name: 'JOANA DURON', value: '$12,500.00', category: 'high_eval' },
    { name: 'JILL MICHELSON', value: '$12,000.00', category: 'high_eval' },
    { name: 'SHERRIE RODRIGUEZ', value: '$11,174.86', category: 'high_eval' },
    { name: 'BRAULIO RUIZ', value: '$10,300.01', category: 'high_eval' },
    { name: 'HOMERO CURA', value: '$10,166.00', category: 'high_eval' },
    { name: 'KIARA ALONZO', value: '$9,500.00', category: 'high_eval' },
    { name: 'MANUEL RANGEL', value: '$9,500.00', category: 'high_eval' },
    { name: 'SAMANTHA HOLGUIN', value: '$9,300.00', category: 'high_eval' },
    { name: 'JOSE HERNANDEZ', value: '$9,300.00', category: 'high_eval' },
    { name: 'GABRIEL NAVARRETE', value: '$9,000.00', category: 'high_eval' },
    { name: 'JACOB HERNANDEZ', value: '$8,787.00', category: 'high_eval' },
    { name: 'RAUL CHAVEZ', value: '$7,600.00', category: 'high_eval' },
    { name: 'JULIUS HILL', value: '$7,500.00', category: 'high_eval' },
    { name: 'SANDRA PENA', value: '$7,500.00', category: 'high_eval' },
    { name: 'VICTORIA ROMERO', value: '$7,500.00', category: 'high_eval' },
    { name: 'ETHAN WALLEY', value: '$7,500.00', category: 'high_eval' },
    { name: 'PATRICIA MARTINEZ', value: '$7,480.00', category: 'high_eval' },
    { name: 'JENNIFER GONZALEZ', value: '$7,450.00', category: 'high_eval' },
    { name: 'RONALDO SANCHEZ-MATA', value: '$7,490.00', category: 'high_eval' },
    { name: 'ROMAN MARTINEZ', value: '$7,100.00', category: 'high_eval' },
    { name: 'TIANA LEWIS', value: '$7,000.00', category: 'high_eval' },
    { name: 'LILIANA ESPINOZA', value: '$6,500.00', category: 'high_eval' },
    { name: 'JOSE MEDINA', value: '$6,500.00', category: 'high_eval' },
    { name: 'TYRA WILLIAMS', value: '$6,500.00', category: 'high_eval' },
    { name: 'GERALDEAN GOMEZ', value: '$6,169.00', category: 'high_eval' },
    { name: 'ANGEL MILLER', value: '$6,000.00', category: 'high_eval' },
    { name: 'NOHELY ARVIZU', value: '$6,000.00', category: 'high_eval' },
    { name: 'JACLYN CAMPOS', value: '$5,970.00', category: 'high_eval' },
    { name: 'IRIS GONZALEZ', value: '$5,750.00', category: 'high_eval' },
    { name: 'YOVANNA FERNANDEZ', value: '$5,750.00', category: 'high_eval' },
    { name: 'ANAI VEGA', value: '$5,700.00', category: 'high_eval' },
    { name: 'NAZIRA CHAVEZ', value: '$5,700.00', category: 'high_eval' },
    { name: 'JOANN MARTINEZ', value: '$5,162.00', category: 'high_eval' },
    { name: 'RACHEL BLANCO', value: '$5,062.00', category: 'high_eval' },
    { name: 'ALEXIS RAMIREZ', value: '$5,000.00', category: 'high_eval' },
    { name: 'ALINA MACHUCA', value: '$5,000.00', category: 'high_eval' },
    { name: 'CAROLINA ARREDONDO', value: '$5,000.00', category: 'high_eval' },
    { name: 'CIJA WILSON-AYALA', value: '$5,000.00', category: 'high_eval' },
    { name: 'JESSICA GONZALEZ', value: '$5,000.00', category: 'high_eval' },
    { name: 'MARIA VELA', value: '$5,000.00', category: 'high_eval' },
    { name: 'MAYRA ZARAGOZA', value: '$5,000.00', category: 'high_eval' },
    { name: 'RUDY VILLALOBOS', value: '$5,000.00', category: 'high_eval' },
    { name: 'SABRINA ARRIOLA', value: '$5,000.00', category: 'high_eval' },
    { name: 'YVETTE RODRIGUEZ', value: '$5,000.00', category: 'high_eval' },
    { name: 'BIANCA ARVIZU', value: '$4,645.00', category: 'high_eval' },
    { name: 'JOSEPH CUELLAR', value: '$4,030.00', category: 'high_eval' },
    { name: 'ERIN MCKINNEY', value: '$3,500.00', category: 'high_eval' },
    { name: 'JUAN SANCHEZ', value: '$3,400.00', category: 'high_eval' },
    { name: 'JULISSA SALAZAR', value: '$3,378.37', category: 'high_eval' },
    { name: 'MARIELA HERNANDEZ', value: '$3,250.00', category: 'high_eval' },
    { name: 'ANDREA RODRIGUEZ', value: '$3,000.00', category: 'high_eval' },
    { name: 'PEGGY PALACIOS', value: '$3,000.00', category: 'high_eval' },
    { name: 'RICHARD LANDA', value: '$2,500.00', category: 'high_eval' },
    { name: 'ERICA SALAZAR', value: '$2,254.00', category: 'high_eval' },
    { name: 'MARCOS PRECIADO', value: '$2,000.00', category: 'high_eval' },
    { name: 'JACKELINE AGUILAR', value: '$2,000.00', category: 'high_eval' },
    { name: 'PRISCILLA HERNANDEZ', value: '$2,000.00', category: 'high_eval' },
    { name: 'KORINA PALOMINO', value: '$1,500.00', category: 'high_eval' },
    { name: 'MARIA RAMOS', value: '$1,500.00', category: 'high_eval' },
    { name: 'MONICA AHMED', value: '$1,500.00', category: 'high_eval' },
    { name: 'PAPIK HERRERA', value: '$1,500.00', category: 'high_eval' },
    { name: 'BRANDEE DELEON', value: '$1,000.00', category: 'high_eval' },
    { name: 'LUCY PAREDES', value: '$1,000.00', category: 'high_eval' },
    { name: 'CRYSTAL SALDANA', value: '$910.00', category: 'high_eval' },
    { name: 'TARESE LEWIS', value: '$500.00', category: 'high_eval' },
  ];

  // Export handlers for double-click
  const handleExportSummary = useCallback(async () => {
    if (!metrics) return;
    const medianEval = (metrics.financials.totals.totalLowEval + metrics.financials.totals.totalHighEval) / 2;
    
    // Use the full list with amounts directly
    const allHighEvalTracking: ManagerTracking[] = ALL_HIGH_EVAL_ADJUSTERS;
    
    // Dashboard visuals - high-level KPIs with trend indicators
    const dashboardVisuals: DashboardVisual[] = [
      { 
        label: 'Open Reserves', 
        value: formatCurrency(metrics.financials.totals.totalOpenReserves), 
        trend: '+2.3% MoM',
        trendDirection: 'up' 
      },
      { 
        label: 'Total Claims', 
        value: formatNumber(KNOWN_TOTALS.totalOpenClaims),
        trend: 'Steady',
        trendDirection: 'neutral'
      },
      { 
        label: 'Litigation Exposures', 
        value: formatNumber(KNOWN_TOTALS.lit.exposures),
        trend: `${KNOWN_TOTALS.lit.claims} matters`,
        trendDirection: 'neutral'
      },
      { 
        label: 'Aged 365+', 
        value: `${((EXECUTIVE_METRICS.aging.over365Days / KNOWN_TOTALS.totalOpenClaims) * 100).toFixed(0)}%`,
        trend: 'High Priority',
        trendDirection: 'down'
      },
    ];

    // Key bullet insights summarizing dashboard state
    const bulletInsights = [
      `${formatNumber(metrics.financials.totals.noEvalCount)} claims awaiting evaluation`,
      `Aged inventory (365+ days) represents ${formatCurrency(FINANCIAL_DATA.byAge[0].openReserves)} in reserves`,
      `Low-to-High evaluation spread: ${formatCurrency(metrics.financials.totals.totalLowEval)} – ${formatCurrency(metrics.financials.totals.totalHighEval)}`,
      `Top evaluator: ${allHighEvalTracking[0]?.name || 'N/A'} with ${allHighEvalTracking[0]?.value || 'N/A'} in high evals`,
    ];

    // Litigation Evaluation Phases - now using dynamic data from CSV
    const LIT_PHASES_DATA = metrics.topPhases.map(phase => ({
      phase: phase.phase,
      aged365: phase.total365Plus,
      aged181_365: phase.total181To365,
      aged61_180: phase.total61To180,
      under60: phase.totalUnder60,
      total: phase.grandTotal,
      pctAged: phase.grandTotal > 0 ? Math.round((phase.total365Plus / phase.grandTotal) * 100) : 0
    }));
    
    const litTotal365 = data.litPhases.reduce((s, p) => s + p.total365Plus, 0);
    const litTotal181_365 = data.litPhases.reduce((s, p) => s + p.total181To365, 0);
    const litTotal61_180 = data.litPhases.reduce((s, p) => s + p.total61To180, 0);
    const litTotalUnder60 = data.litPhases.reduce((s, p) => s + p.totalUnder60, 0);
    const litTotalAll = data.litPhases.reduce((s, p) => s + p.grandTotal, 0);
    const LIT_TOTALS = { 
      aged365: litTotal365, 
      aged181_365: litTotal181_365, 
      aged61_180: litTotal61_180, 
      under60: litTotalUnder60, 
      total: litTotalAll, 
      pctAged: litTotalAll > 0 ? Math.round((litTotal365 / litTotalAll) * 100) : 0 
    };

    // Charts for visual representation - using actual inventory data
    const charts: PDFChart[] = [
      {
        type: 'horizontalBar',
        title: 'Litigation by Evaluation Phase (Total Claims)',
        data: LIT_PHASES_DATA.map((p, i) => ({
          label: p.phase,
          value: p.total,
          color: (['red', 'amber', 'blue', 'green', 'muted', 'blue', 'amber', 'green'] as const)[i % 8],
        })),
      },
      {
        type: 'donut',
        title: 'Litigation Age Distribution',
        data: [
          { label: '365+ Days', value: LIT_TOTALS.aged365, color: 'red' },
          { label: '181-365 Days', value: LIT_TOTALS.aged181_365, color: 'amber' },
          { label: '61-180 Days', value: LIT_TOTALS.aged61_180, color: 'blue' },
          { label: 'Under 60 Days', value: LIT_TOTALS.under60, color: 'green' },
        ],
      },
    ];

    const exportData: ExportableData = {
      title: 'Open Inventory Summary',
      subtitle: 'Claims and Financial Overview',
      timestamp,
      directive: 'Complete all evaluations within 5 business days. No exceptions. High eval claims require manager review and approval.',
      managerTracking: allHighEvalTracking,
      dashboardVisuals,
      bulletInsights,
      charts,
      summary: {
        'Total Open Claims': formatNumber(metrics.totalOpenClaims),
        'Total Open Exposures': formatNumber(metrics.totalOpenExposures),
        'Open Reserves': formatCurrencyFullValue(metrics.financials.totals.totalOpenReserves),
        'Median Evaluation': formatCurrencyFullValue(medianEval),
        'No Evaluation': formatNumber(metrics.financials.totals.noEvalCount),
      },
      columns: ['Metric', 'Value'],
      rows: [
        ['Total Open Claims', formatNumber(metrics.totalOpenClaims)],
        ['Total Open Exposures', formatNumber(metrics.totalOpenExposures)],
        ['Open Reserves', formatCurrencyFullValue(metrics.financials.totals.totalOpenReserves)],
        ['Low Evaluation', formatCurrencyFullValue(metrics.financials.totals.totalLowEval)],
        ['High Evaluation', formatCurrencyFullValue(metrics.financials.totals.totalHighEval)],
        ['Median Evaluation', formatCurrencyFullValue(medianEval)],
        ['No Evaluation Count', formatNumber(metrics.financials.totals.noEvalCount)],
        ['Flagged Claims', formatNumber(metrics.flagged)],
      ],
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Open Inventory Summary');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  const handleExportByAge = useCallback(async () => {
    if (!metrics) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Reserves vs Evaluation by Age',
      subtitle: 'Financial breakdown by claim age bucket',
      timestamp,
      affectsManager: manager,
      columns: ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval', 'Median Eval'],
      rows: metrics.ageDistribution.map(item => [
        item.age,
        item.claims,
        formatCurrencyFullValue(item.openReserves),
        formatCurrencyFullValue(item.lowEval),
        formatCurrencyFullValue(item.highEval),
        formatCurrencyFullValue((item.lowEval + item.highEval) / 2),
      ]),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Reserves by Age');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  const handleExportByQueue = useCallback(async () => {
    if (!metrics) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Reserve Adequacy by Queue',
      subtitle: 'Queue-level reserve analysis',
      timestamp,
      affectsManager: manager,
      columns: ['Queue', 'Open Reserves', 'Low Eval', 'High Eval', 'Median Eval', 'Variance %', 'Status'],
      rows: metrics.financials.byQueue.map(queue => {
        const qMedian = (queue.lowEval + queue.highEval) / 2;
        const qVariance = queue.openReserves - qMedian;
        const qVariancePct = ((qVariance / qMedian) * 100).toFixed(1);
        const qIsOver = qVariance > 0;
        return [
          queue.queue,
          formatCurrencyFullValue(queue.openReserves),
          formatCurrencyFullValue(queue.lowEval),
          formatCurrencyFullValue(queue.highEval),
          formatCurrencyFullValue(qMedian),
          `${qIsOver ? '+' : ''}${qVariancePct}%`,
          qIsOver ? 'Over-reserved' : 'Under-reserved',
        ];
      }),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Reserve Adequacy by Queue');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  const handleExportLitPhases = useCallback(async () => {
    if (!metrics || !data) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Litigation Evaluation Phases',
      subtitle: 'Open LIT files by phase and age',
      timestamp,
      affectsManager: manager,
      columns: ['Phase', '365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days', 'Total', '% Aged'],
      rows: metrics.topPhases.map(phase => {
        const agedPct = phase.grandTotal > 0 
          ? ((phase.total365Plus / phase.grandTotal) * 100).toFixed(0)
          : '0';
        return [
          phase.phase,
          phase.total365Plus,
          phase.total181To365,
          phase.total61To180,
          phase.totalUnder60,
          phase.grandTotal,
          `${agedPct}%`,
        ];
      }),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Litigation Phases');
  }, [exportBoth, timestamp, metrics, data, selectedReviewer]);

  const handleExportTexasRearEnd = useCallback(async () => {
    const manager = selectedReviewer || 'Richie Mendoza';
    const areaRawData: RawClaimData = {
      columns: ['Area', 'Claims', 'Reserves', 'Low Eval', 'High Eval', 'Avg Reserve'],
      rows: TEXAS_REAR_END_DATA.byArea.map(a => [
        a.area,
        a.claims,
        a.reserves,
        a.lowEval,
        a.highEval,
        Math.round(a.reserves / a.claims),
      ]),
      sheetName: 'By Area',
    };
    const ageRawData: RawClaimData = {
      columns: ['Age Bucket', 'Claims', 'Reserves', 'Low Eval', 'High Eval'],
      rows: TEXAS_REAR_END_DATA.byAge.map(a => [
        a.age,
        a.claims,
        a.reserves,
        a.lowEval,
        a.highEval,
      ]),
      sheetName: 'By Age',
    };
    // Dashboard visuals for Texas Rear End
    const texasDashboardVisuals: DashboardVisual[] = [
      { 
        label: 'Total Claims', 
        value: TEXAS_REAR_END_DATA.summary.totalClaims.toLocaleString(),
        trend: 'IV R/E CV',
        trendDirection: 'neutral'
      },
      { 
        label: 'Open Reserves', 
        value: formatCurrency(TEXAS_REAR_END_DATA.summary.totalReserves),
        trendDirection: 'neutral'
      },
      { 
        label: 'Aged 365+', 
        value: TEXAS_REAR_END_DATA.byAge[0].claims.toLocaleString(),
        trend: `${formatCurrency(TEXAS_REAR_END_DATA.byAge[0].reserves)} at risk`,
        trendDirection: 'down'
      },
      { 
        label: 'Early Settlement', 
        value: TEXAS_REAR_END_DATA.byAge[3].claims.toLocaleString(),
        trend: 'Under 60 days',
        trendDirection: 'up'
      },
    ];

    const texasBulletInsights = [
      `${TEXAS_REAR_END_DATA.byAge[0].claims} claims aged 365+ days — priority settlement focus`,
      `El Paso (101) leads with ${TEXAS_REAR_END_DATA.byArea[0].claims} claims and ${formatCurrency(TEXAS_REAR_END_DATA.byArea[0].reserves)} in reserves`,
      `Early settlements (Under 60 days): ${TEXAS_REAR_END_DATA.byAge[3].claims} claims, ${formatCurrency(TEXAS_REAR_END_DATA.byAge[3].reserves)} exposure`,
      `Evaluation gap: ${formatCurrency(TEXAS_REAR_END_DATA.summary.lowEval)} low vs ${formatCurrency(TEXAS_REAR_END_DATA.summary.highEval)} high`,
    ];

    // Charts for Texas Rear End
    const texasCharts: PDFChart[] = [
      {
        type: 'horizontalBar',
        title: 'Reserves by Age Bucket',
        data: TEXAS_REAR_END_DATA.byAge.map((a, i) => ({
          label: a.age,
          value: a.reserves,
          color: i === 0 ? 'red' : i === 3 ? 'green' : 'amber',
        })),
      },
      {
        type: 'pie',
        title: 'Claims by Area',
        data: TEXAS_REAR_END_DATA.byArea.slice(0, 5).map((a, i) => ({
          label: a.area,
          value: a.claims,
          color: (['red', 'amber', 'green', 'blue', 'muted'] as const)[i % 5],
        })),
      },
    ];

    const exportData: ExportableData = {
      title: 'Texas Rear End Claims (101-110)',
      subtitle: `Loss Description: ${TEXAS_REAR_END_DATA.lossDescription}`,
      timestamp,
      affectsManager: manager,
      dashboardVisuals: texasDashboardVisuals,
      bulletInsights: texasBulletInsights,
      charts: texasCharts,
      summary: {
        'Total Claims': TEXAS_REAR_END_DATA.summary.totalClaims,
        'Total Reserves': formatCurrencyFullValue(TEXAS_REAR_END_DATA.summary.totalReserves),
        'Low Eval': formatCurrencyFullValue(TEXAS_REAR_END_DATA.summary.lowEval),
        'High Eval': formatCurrencyFullValue(TEXAS_REAR_END_DATA.summary.highEval),
      },
      columns: ['Age Bucket', 'Claims', 'Reserves', 'Low Eval', 'High Eval'],
      rows: TEXAS_REAR_END_DATA.byAge.map(a => [
        a.age,
        a.claims,
        formatCurrencyFullValue(a.reserves),
        formatCurrencyFullValue(a.lowEval),
        formatCurrencyFullValue(a.highEval),
      ]),
      rawClaimData: [areaRawData, ageRawData],
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Texas Rear End Claims');
  }, [exportBoth, timestamp, selectedReviewer]);

  const handleExportLORIntervention = useCallback(async () => {
    const manager = selectedReviewer || 'Richie Mendoza';
    
    // LOR Offers data with granular claim fields
    const lorRawData: RawClaimData = {
      columns: ['Claim Number', 'Area', 'BI Phase', 'Settlement Status', 'Low Eval', 'High Eval', 'Reserves', 'Offer Amount', 'Extended Date', 'Expires Date', 'Status', 'Days Left', 'Accident Description', 'Outcome Date', 'Notes'],
      rows: lorOffers.map(offer => {
        const expireDate = new Date(offer.expires_date);
        const today = new Date();
        const daysLeft = Math.ceil((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return [
          offer.claim_number,
          offer.area || 'TX',
          offer.bi_phase || 'Pending Demand',
          offer.settlement_status || 'in_progress',
          offer.low_eval || 0,
          offer.high_eval || 0,
          offer.reserves || 0,
          offer.offer_amount,
          format(new Date(offer.extended_date), 'MM/dd/yyyy'),
          format(new Date(offer.expires_date), 'MM/dd/yyyy'),
          offer.status,
          daysLeft,
          offer.accident_description || 'Rear-end',
          offer.outcome_date ? format(new Date(offer.outcome_date), 'MM/dd/yyyy') : '',
          offer.outcome_notes || '',
        ];
      }),
      sheetName: 'LOR Offers',
    };

    // Summary stats
    const totalReserves = lorOffers.reduce((sum, o) => sum + (o.reserves || 0), 0);
    const totalLowEval = lorOffers.reduce((sum, o) => sum + (o.low_eval || 0), 0);
    const totalHighEval = lorOffers.reduce((sum, o) => sum + (o.high_eval || 0), 0);
    const settledCount = lorOffers.filter(o => o.settlement_status === 'settled').length;
    const inProgressCount = lorOffers.filter(o => o.settlement_status === 'in_progress').length;

    const summaryRawData: RawClaimData = {
      columns: ['Metric', 'Value'],
      rows: [
        ['Total Offers', lorStats.total],
        ['Pending', lorStats.pending],
        ['Accepted', lorStats.accepted],
        ['Rejected', lorStats.rejected],
        ['Expired', lorStats.expired],
        ['Total Offered', `$${lorStats.totalOffered.toLocaleString()}`],
        ['Settled Claims', settledCount],
        ['In Progress', inProgressCount],
        ['Total Reserves', `$${totalReserves.toLocaleString()}`],
        ['Total Low Eval', `$${totalLowEval.toLocaleString()}`],
        ['Total High Eval', `$${totalHighEval.toLocaleString()}`],
      ],
      sheetName: 'Summary',
    };

    // Texas Rear End context
    const contextRawData: RawClaimData = {
      columns: ['Area', 'Claims', 'Reserves', 'Low Eval', 'High Eval'],
      rows: TEXAS_REAR_END_DATA.byArea.map(a => [
        a.area,
        a.claims,
        a.reserves,
        a.lowEval,
        a.highEval,
      ]),
      sheetName: 'TX Rear End by Area',
    };

    const exportData: ExportableData = {
      title: 'TX LOR Intervention Settlement Tracker',
      subtitle: 'Rear-end early settlement • Low-impact claims • Stop the bleed',
      timestamp,
      affectsManager: manager,
      summary: {
        'Total Offers': lorStats.total,
        'Pending': lorStats.pending,
        'Accepted': lorStats.accepted,
        'Rejected': lorStats.rejected,
        'Settled': settledCount,
        'In Progress': inProgressCount,
        'Total Offered': `$${lorStats.totalOffered.toLocaleString()}`,
        'Total Reserves': `$${totalReserves.toLocaleString()}`,
        'TX R/E Claims': TEXAS_REAR_END_DATA.summary.totalClaims,
      },
      columns: ['Claim Number', 'Area', 'BI Phase', 'Status', 'Low Eval', 'High Eval', 'Reserves', 'Offer', 'Expires', 'Days'],
      rows: lorOffers.map(offer => {
        const expireDate = new Date(offer.expires_date);
        const today = new Date();
        const daysLeft = Math.ceil((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return [
          offer.claim_number,
          offer.area || 'TX',
          offer.bi_phase || 'Pending',
          offer.settlement_status === 'settled' ? 'Settled' : 'In Progress',
          `$${(offer.low_eval || 0).toLocaleString()}`,
          `$${(offer.high_eval || 0).toLocaleString()}`,
          `$${(offer.reserves || 0).toLocaleString()}`,
          `$${offer.offer_amount.toLocaleString()}`,
          format(new Date(offer.expires_date), 'MM/dd'),
          daysLeft.toString(),
        ];
      }),
      rawClaimData: [lorRawData, summaryRawData, contextRawData],
    };
    
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: LOR Intervention Tracker');
  }, [exportBoth, timestamp, selectedReviewer, lorOffers, lorStats]);

  const handleExportClaimsByQueue = useCallback(async () => {
    if (!metrics) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Claims by Queue',
      subtitle: 'Claims vs Exposures by handling unit',
      timestamp,
      affectsManager: manager,
      columns: ['Queue', 'Claims', 'Exposures', 'Ratio'],
      rows: metrics.typeGroups.map(g => [
        g.typeGroup,
        g.claims,
        g.exposures,
        (g.exposures / g.claims).toFixed(2),
      ]),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Claims by Queue');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  const handleExportInventoryAge = useCallback(async () => {
    if (!metrics) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Inventory Age Distribution',
      subtitle: 'Claim counts by age bucket',
      timestamp,
      affectsManager: manager,
      columns: ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval'],
      rows: metrics.ageDistribution.map(a => [
        a.age,
        a.claims,
        formatCurrencyFullValue(a.openReserves),
        formatCurrencyFullValue(a.lowEval),
        formatCurrencyFullValue(a.highEval),
      ]),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Inventory Age');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  // Export Claims with Demand - PDF + Excel combo
  const handleExportDemandClaims = useCallback(async () => {
    if (!data?.demandSummary) {
      toast.error('No demand data available');
      return;
    }
    
    const demandSummary = data.demandSummary;
    const demandClaims = demandSummary.demandClaims || [];
    
    const exportData: ExportableData = {
      title: 'Claims with Demand Analysis',
      subtitle: `${demandSummary.claimsWithDemand.toLocaleString()} claims with active demand`,
      timestamp,
      summary: {
        'Total Claims with Demand': formatNumber(demandSummary.claimsWithDemand),
        'Total Reserves': formatCurrencyFullValue(demandSummary.totalDemandReserves),
        'Total Low Eval': formatCurrencyFullValue(demandSummary.totalDemandLowEval),
        'Total High Eval': formatCurrencyFullValue(demandSummary.totalDemandHighEval),
      },
      bulletInsights: [
        `${formatNumber(demandSummary.claimsWithDemand)} claims have an active demand type`,
        `Total exposure: ${formatCurrency(demandSummary.totalDemandReserves)} in reserves`,
        `Evaluation range: ${formatCurrency(demandSummary.totalDemandLowEval)} – ${formatCurrency(demandSummary.totalDemandHighEval)}`,
        `Top demand type: ${demandSummary.byDemandType[0]?.demandType || 'N/A'} (${demandSummary.byDemandType[0]?.claims || 0} claims)`,
      ],
      columns: ['Demand Type', 'Claims', 'Reserves', 'Low Eval', 'High Eval'],
      rows: demandSummary.byDemandType.map(dt => [
        dt.demandType,
        dt.claims,
        formatCurrencyFullValue(dt.reserves),
        formatCurrencyFullValue(dt.lowEval),
        formatCurrencyFullValue(dt.highEval),
      ]),
      rawClaimData: [{
        sheetName: 'Claims with Demand',
        columns: ['Claim#', 'Claimant', 'Coverage', 'Days Open', 'Age Bucket', 'Type Group', 'Demand Type', 'Eval Phase', 'Open Reserves', 'Low Eval', 'High Eval', 'CP1 Flag', 'Team', 'Fatality', 'Surgery'],
        rows: demandClaims.map(c => [
          c.claimNumber,
          c.claimant,
          c.coverage,
          c.days,
          c.ageBucket,
          c.typeGroup,
          c.demandType,
          c.evaluationPhase,
          c.openReserves,
          c.lowEval,
          c.highEval,
          c.overallCP1,
          c.teamGroup,
          c.fatality ? 'YES' : '',
          c.surgery ? 'YES' : '',
        ]),
      }],
    };
    
    await exportBoth(exportData);
    toast.success(`PDF + Excel exported: ${demandSummary.claimsWithDemand.toLocaleString()} claims with demand`);
  }, [exportBoth, timestamp, data]);

  // Full Export - all sections in one workbook
  const handleFullExport = useCallback(() => {
    if (!metrics || !data) return;
    
    const medianEval = (metrics.financials.totals.totalLowEval + metrics.financials.totals.totalHighEval) / 2;
    const noEvalTracking: ManagerTracking[] = [
      { name: 'Richie Mendoza', value: metrics.financials.totals.noEvalCount, category: 'no_eval' },
    ];
    
    const sections = [
      {
        title: 'Summary',
        data: {
          title: 'Open Inventory Summary',
          subtitle: 'Claims and Financial Overview',
          timestamp,
          affectsManager: 'Richie Mendoza',
          managerTracking: [...ALL_HIGH_EVAL_ADJUSTERS, ...noEvalTracking],
          summary: {
            'Total Open Claims': formatNumber(metrics.totalOpenClaims),
            'Total Open Exposures': formatNumber(metrics.totalOpenExposures),
            'Open Reserves': formatCurrencyFullValue(metrics.financials.totals.totalOpenReserves),
            'Median Evaluation': formatCurrencyFullValue(medianEval),
            'No Evaluation': formatNumber(metrics.financials.totals.noEvalCount),
          },
          columns: ['Metric', 'Value'],
          rows: [
            ['Total Open Claims', formatNumber(metrics.totalOpenClaims)],
            ['Total Open Exposures', formatNumber(metrics.totalOpenExposures)],
            ['Open Reserves', formatCurrencyFullValue(metrics.financials.totals.totalOpenReserves)],
            ['Low Evaluation', formatCurrencyFullValue(metrics.financials.totals.totalLowEval)],
            ['High Evaluation', formatCurrencyFullValue(metrics.financials.totals.totalHighEval)],
          ],
        } as ExportableData,
      },
      {
        title: 'By Age',
        data: {
          title: 'Reserves vs Evaluation by Age',
          subtitle: 'Financial breakdown by claim age bucket',
          timestamp,
          columns: ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval'],
          rows: metrics.ageDistribution.map(item => [
            item.age,
            item.claims,
            item.openReserves,
            item.lowEval,
            item.highEval,
          ]),
          rawClaimData: [{
            columns: ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval', 'Median Eval'],
            rows: metrics.ageDistribution.map(item => [
              item.age,
              item.claims,
              item.openReserves,
              item.lowEval,
              item.highEval,
              (item.lowEval + item.highEval) / 2,
            ]),
            sheetName: 'Age Detail',
          }],
        } as ExportableData,
      },
      {
        title: 'By Queue',
        data: {
          title: 'Reserve Adequacy by Queue',
          subtitle: 'Queue-level reserve analysis',
          timestamp,
          columns: ['Queue', 'Open Reserves', 'Low Eval', 'High Eval', 'Claims'],
          rows: metrics.financials.byQueue.map(queue => [
            queue.queue,
            queue.openReserves,
            queue.lowEval,
            queue.highEval,
            queue.claims,
          ]),
          rawClaimData: [{
            columns: ['Queue', 'Open Reserves', 'Low Eval', 'High Eval', 'Claims', 'Median Eval', 'Variance'],
            rows: metrics.financials.byQueue.map(queue => {
              const median = (queue.lowEval + queue.highEval) / 2;
              return [
                queue.queue,
                queue.openReserves,
                queue.lowEval,
                queue.highEval,
                queue.claims,
                median,
                queue.openReserves - median,
              ];
            }),
            sheetName: 'Queue Detail',
          }],
        } as ExportableData,
      },
      {
        title: 'Lit Phases',
        data: {
          title: 'Litigation Evaluation Phases',
          subtitle: 'Open LIT files by phase and age',
          timestamp,
          columns: ['Phase', '365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days', 'Total'],
          rows: metrics.topPhases.map(phase => [
            phase.phase,
            phase.total365Plus,
            phase.total181To365,
            phase.total61To180,
            phase.totalUnder60,
            phase.grandTotal,
          ]),
          rawClaimData: [{
            columns: ['Phase', '365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days', 'Total', '% Aged'],
            rows: data.litPhases.map(phase => [
              phase.phase,
              phase.total365Plus,
              phase.total181To365,
              phase.total61To180,
              phase.totalUnder60,
              phase.grandTotal,
              phase.grandTotal > 0 ? ((phase.total365Plus / phase.grandTotal) * 100).toFixed(1) : 0,
            ]),
            sheetName: 'All Phases',
          }],
        } as ExportableData,
      },
      {
        title: 'TX Rear End',
        data: {
          title: 'Texas Rear End Claims (101-110)',
          subtitle: `Loss Description: ${TEXAS_REAR_END_DATA.lossDescription}`,
          timestamp,
          summary: {
            'Total Claims': TEXAS_REAR_END_DATA.summary.totalClaims,
            'Total Reserves': TEXAS_REAR_END_DATA.summary.totalReserves,
            'Low Eval': TEXAS_REAR_END_DATA.summary.lowEval,
            'High Eval': TEXAS_REAR_END_DATA.summary.highEval,
          },
          columns: ['Area', 'Claims', 'Reserves', 'Low Eval', 'High Eval'],
          rows: TEXAS_REAR_END_DATA.byArea.map(a => [
            a.area,
            a.claims,
            a.reserves,
            a.lowEval,
            a.highEval,
          ]),
          rawClaimData: [
            {
              columns: ['Area', 'Claims', 'Reserves', 'Low Eval', 'High Eval', 'Avg Reserve'],
              rows: TEXAS_REAR_END_DATA.byArea.map(a => [
                a.area,
                a.claims,
                a.reserves,
                a.lowEval,
                a.highEval,
                Math.round(a.reserves / a.claims),
              ]),
              sheetName: 'TX By Area',
            },
            {
              columns: ['Age Bucket', 'Claims', 'Reserves', 'Low Eval', 'High Eval'],
              rows: TEXAS_REAR_END_DATA.byAge.map(a => [
                a.age,
                a.claims,
                a.reserves,
                a.lowEval,
                a.highEval,
              ]),
              sheetName: 'TX By Age',
            },
          ],
        } as ExportableData,
      },
      {
        title: 'High Eval Mgrs',
        data: {
          title: 'High Evaluation Managers',
          subtitle: 'All adjusters with high evaluations',
          timestamp,
          columns: ['Rank', 'Adjuster Name', 'High Eval Amount'],
          rows: ALL_HIGH_EVAL_ADJUSTERS.map((m, idx) => [
            idx + 1,
            m.name,
            m.value,
          ]),
        } as ExportableData,
      },
      {
        title: 'Fatality & Severity',
        data: {
          title: 'Fatality & Severity Claims',
          subtitle: 'High severity claims requiring executive attention',
          timestamp,
          summary: {
            'Fatality Claims': data.fatalitySummary?.fatalityCount || 0,
            'Fatality Reserves': formatCurrencyFullValue(data.fatalitySummary?.fatalityReserves || 0),
            'Surgery Claims': data.fatalitySummary?.surgeryCount || 0,
            'Hospitalization': data.fatalitySummary?.hospitalizationCount || 0,
          },
          columns: ['Claim#', 'Claimant', 'Coverage', 'Days Open', 'Type Group', 'Reserves', 'Low Eval', 'High Eval', 'Team'],
          rows: (data.fatalitySummary?.fatalityClaims || []).slice(0, 50).map(c => [
            c.claimNumber,
            c.claimant,
            c.coverage,
            c.days,
            c.typeGroup,
            c.openReserves,
            c.lowEval,
            c.highEval,
            c.teamGroup,
          ]),
          rawClaimData: [{
            sheetName: 'All Fatality Claims',
            columns: ['Claim#', 'Claimant', 'Coverage', 'Days Open', 'Age Bucket', 'Type Group', 'Eval Phase', 'Reserves', 'Low Eval', 'High Eval', 'CP1 Flag', 'Team', 'Fatality', 'Surgery', 'Hospitalization'],
            rows: (data.fatalitySummary?.fatalityClaims || []).map(c => [
              c.claimNumber,
              c.claimant,
              c.coverage,
              c.days,
              c.ageBucket,
              c.typeGroup,
              c.evaluationPhase,
              c.openReserves,
              c.lowEval,
              c.highEval,
              c.overallCP1,
              c.teamGroup,
              'YES',
              c.surgery ? 'YES' : '',
              c.hospitalization ? 'YES' : '',
            ]),
          }],
        } as ExportableData,
      },
    ];

    generateFullExcel(sections);
    toast.success('Full Excel workbook exported with all Open Inventory data!');
  }, [generateFullExcel, timestamp, metrics, data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading open inventory data...</span>
      </div>
    );
  }

  if (error || !data || !metrics) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Unable to load open exposure data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Check if filters are active
  const hasActiveFilters = filters.team !== 'all' || filters.adjuster !== 'all' || filters.searchText.trim() !== '';
  const filteredCount = data?.rawClaims.length || 0;
  const totalCount = rawData?.rawClaims.length || 0;

  return (
    <div className="space-y-8">
      {/* Active Filter Indicator */}
      {hasActiveFilters && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-primary/20 rounded-lg">
              <Filter className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Filtered View: {filteredCount.toLocaleString()} of {totalCount.toLocaleString()} claims
              </p>
              <p className="text-xs text-muted-foreground">
                {filters.team !== 'all' && <span className="mr-2">Team: {filters.team}</span>}
                {filters.adjuster !== 'all' && <span className="mr-2">Adjuster: {filters.adjuster}</span>}
                {filters.searchText && <span>Search: "{filters.searchText}"</span>}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
            {((filteredCount / totalCount) * 100).toFixed(1)}% of inventory
          </Badge>
        </div>
      )}

      {/* Executive Header Banner - Board-Ready Design */}
      <div className="bg-gradient-to-r from-secondary via-secondary/80 to-muted rounded-xl p-4 sm:p-6 border border-border shadow-lg">
        <div className="flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-5">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="p-2 sm:p-3 bg-primary/20 rounded-xl border border-primary/30 w-fit">
                <FileStack className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
              </div>
              <div className="border-l-2 border-primary pl-3 sm:pl-5">
                <h2 className="text-base sm:text-xl font-bold text-foreground tracking-wide">OPEN INVENTORY COMMAND</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Claims & Financial Overview • {timestamp}</p>
              </div>
            </div>
          </div>
          
          {/* Actions Row - Stacked on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            {/* COMBINED BOARD PACKAGE - Primary CTA */}
            <Button
              onClick={generateCombinedBoardPackage}
              disabled={generatingBoardPackage}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 sm:px-6 py-2 sm:py-2.5 shadow-lg text-sm w-full sm:w-auto"
            >
              {generatingBoardPackage ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileStack className="h-4 w-4 mr-2" />
              )}
              {generatingBoardPackage ? 'Generating...' : 'Board Package (Combined)'}
            </Button>
            
            {/* Individual Reports - Hidden on mobile, shown as dropdown alternative */}
            <div className="hidden lg:flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg border border-border">
              <span className="text-xs font-medium text-muted-foreground">Individual:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateBudgetPDF}
                disabled={generatingBudgetPDF}
                className="h-7 px-2 text-xs hover:bg-primary/10"
              >
                {generatingBudgetPDF ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Budget'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDecisionsDrawer(true);
                }}
                className="h-7 px-2 text-xs hover:bg-primary/10"
              >
                Decisions
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateCP1PDF}
                disabled={generatingCP1PDF}
                className="h-7 px-2 text-xs hover:bg-primary/10"
              >
                {generatingCP1PDF ? <Loader2 className="h-3 w-3 animate-spin" /> : 'CP1'}
              </Button>
            </div>
            
            {/* Mobile-friendly individual reports */}
            <div className="flex lg:hidden gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={generateBudgetPDF}
                disabled={generatingBudgetPDF}
                className="flex-1 h-9 text-xs"
              >
                {generatingBudgetPDF ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Budget'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDecisionsDrawer(true)}
                className="flex-1 h-9 text-xs"
              >
                Decisions
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateCP1PDF}
                disabled={generatingCP1PDF}
                className="flex-1 h-9 text-xs"
              >
                {generatingCP1PDF ? <Loader2 className="h-3 w-3 animate-spin" /> : 'CP1'}
              </Button>
            </div>
            
            {/* Inventory Export */}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
              await generateExecutivePackage(
                  {
                    totalOpenReserves: FINANCIAL_DATA.totals.totalOpenReserves,
                    pendingEval: FINANCIAL_DATA.totals.noEvalReserves || 0,
                    pendingEvalPct: FINANCIAL_DATA.totals.noEvalCount > 0 && metrics?.totalOpenClaims 
                      ? Math.round((FINANCIAL_DATA.totals.noEvalCount / metrics.totalOpenClaims) * 100) : 0,
                    closuresThisMonth: 0, // N/A for open inventory
                    avgDaysToClose: 0, // N/A for open inventory
                    closureTrend: 0,
                    aged365Count: EXECUTIVE_METRICS.aging.over365Days,
                    aged365Reserves: EXECUTIVE_METRICS.aging.over365Reserves,
                    aged365Pct: EXECUTIVE_METRICS.aging.over365Pct,
                    reservesMoM: EXECUTIVE_METRICS.trends.reservesMoM,
                    reservesYoY: EXECUTIVE_METRICS.trends.reservesYoY,
                    lowEval: FINANCIAL_DATA.totals.totalLowEval,
                    medianEval: (FINANCIAL_DATA.totals.totalLowEval + FINANCIAL_DATA.totals.totalHighEval) / 2,
                    highEval: FINANCIAL_DATA.totals.totalHighEval,
                  },
                  {
                    byAge: FINANCIAL_DATA.byAge,
                    byQueue: FINANCIAL_DATA.byQueue,
                    byTypeGroup: FINANCIAL_DATA.byTypeGroup,
                    highEvalAdjusters: ALL_HIGH_EVAL_ADJUSTERS.map(a => ({ 
                      name: a.name, 
                      value: String(a.value),
                    })),
                    quarterlyData: EXPERT_QUARTERLY_DATA,
                  }
                );
                toast.success('Inventory Package downloaded!');
              }}
              className="h-9 text-xs w-full sm:w-auto"
            >
              <FileSpreadsheet className="h-3 w-3 mr-1" />
              Inventory
            </Button>
          </div>
        </div>
      </div>

      {/* Alternative Layout Views */}
      {dashboardVersion === 'v3' && metrics && (
        <ExecutiveCommandDashboard
          data={{
            totalClaims: metrics.totalOpenClaims,
            totalReserves: FINANCIAL_DATA.totals.totalOpenReserves,
            lowEval: FINANCIAL_DATA.totals.totalLowEval,
            highEval: FINANCIAL_DATA.totals.totalHighEval,
            noEvalCount: FINANCIAL_DATA.totals.noEvalCount,
            noEvalReserves: FINANCIAL_DATA.totals.noEvalReserves || 0,
            aged365Plus: EXECUTIVE_METRICS.aging.over365Days,
            aged365Reserves: EXECUTIVE_METRICS.aging.over365Reserves,
            aged181to365: data?.totals.age181To365 || 0,
            aged181Reserves: data?.financials.byAge.find(a => a.age === '181-365 Days')?.openReserves || 0,
            aged61to180: data?.totals.age61To180 || 0,
            agedUnder60: data?.totals.ageUnder60 || 0,
            cp1Count: CP1_DATA.totals.yes,
            cp1Rate: CP1_DATA.cp1Rate,
            decisionsCount: decisionsData?.totalCount || 0,
            decisionsExposure: decisionsData?.totalReserves || 0,
            litCount: data?.typeGroupSummaries.find(t => t.typeGroup === 'LIT')?.grandTotal || 0,
            biLitSpend2026: budgetMetrics.coverageBreakdown.bi.ytd2026,
            biLitSpend2025: budgetMetrics.coverageBreakdown.bi.ytd2025,
            dataDate: data?.dataDate || timestamp,
            delta: data?.delta ? {
              change: data.delta.change,
              changePercent: data.delta.changePercent,
              reservesChange: data.delta.reservesChange || 0,
              reservesChangePercent: data.delta.reservesChangePercent || 0,
              previousDate: data.delta.previousDate,
            } : undefined,
          }}
          onOpenChat={() => setShowChatFromV2V3(true)}
          onDrilldown={(section) => {
            if (section === 'decisions') setShowDecisionsDrawer(true);
            else if (section === 'cp1') setShowCP1Drawer(true);
            else if (section === 'budget') setShowBudgetDrawer(true);
            else if (section === 'export') generateCombinedBoardPackage();
          }}
          timestamp={data?.dataDate || timestamp}
        />
      )}

      {dashboardVersion === 'v1' && (
      <>
      <div id="executive-command-center" className="print-section bg-card rounded-xl border border-border shadow-xl print:bg-white print:border-2 print:border-gray-800 print:shadow-none">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-5 border-b border-border gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-2.5 bg-warning/20 rounded-lg border border-warning/30">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-bold text-foreground tracking-wide">EXECUTIVE COMMAND CENTER</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Real-time portfolio health dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-success/10 border border-success/30 rounded-lg">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-success rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm font-semibold text-success">LIVE</span>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-5 space-y-4 sm:space-y-6">

        {/* Primary KPI Row - 2x2 on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {/* Total Open Reserves with Trend */}
          <div className="bg-secondary/50 rounded-xl p-3 sm:p-5 border border-border hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Open Reserves</span>
              <div className={`hidden sm:flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${EXECUTIVE_METRICS.trends.reservesMoM > 0 ? 'text-destructive bg-destructive/10' : 'text-success bg-success/10'}`}>
                {EXECUTIVE_METRICS.trends.reservesMoM > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(EXECUTIVE_METRICS.trends.reservesMoM)}% MoM
              </div>
            </div>
            <p className="text-xl sm:text-3xl font-bold text-foreground">{formatCurrency(FINANCIAL_DATA.totals.totalOpenReserves)}</p>
            <div className="flex items-center gap-3 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50">
              <span className={`text-xs sm:text-sm font-medium ${EXECUTIVE_METRICS.trends.reservesYoY < 0 ? 'text-success' : 'text-destructive'}`}>
                {EXECUTIVE_METRICS.trends.reservesYoY > 0 ? '+' : ''}{EXECUTIVE_METRICS.trends.reservesYoY}% YoY
              </span>
            </div>
          </div>

          {/* Pending Evaluation ALERT - Dynamic from CSV */}
          <div className="bg-warning/5 rounded-xl p-3 sm:p-5 border-2 border-warning/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 bg-warning/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold text-warning uppercase tracking-wide">⚠️ NO EVAL</span>
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-warning animate-pulse" />
            </div>
            <p className="text-xl sm:text-3xl font-bold text-warning">{formatCurrency(FINANCIAL_DATA.totals.noEvalReserves || 0)}</p>
            <p className="text-xs sm:text-sm text-warning/80 mt-1 sm:mt-2">
              {metrics?.totalOpenClaims && FINANCIAL_DATA.totals.noEvalCount 
                ? Math.round((FINANCIAL_DATA.totals.noEvalCount / metrics.totalOpenClaims) * 100) 
                : 0}% without evaluation ({formatNumber(FINANCIAL_DATA.totals.noEvalCount || 0)} claims)
            </p>
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-warning/20">
              <span className="text-[10px] sm:text-xs text-warning font-bold uppercase">Action Required</span>
            </div>
          </div>

          {/* 181-365 Days Aging (replacing closures - not applicable for open inventory) */}
          <div className="bg-amber-500/5 rounded-xl p-3 sm:p-5 border-2 border-amber-500/40">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold text-amber-600 uppercase tracking-wide">⏳ AGED 181-365</span>
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
            </div>
            <p className="text-xl sm:text-3xl font-bold text-amber-600">{formatNumber(data?.totals.age181To365 || 0)}</p>
            <p className="text-xs sm:text-sm text-amber-600/80 mt-1 sm:mt-2">
              {data?.totals.grandTotal ? ((data.totals.age181To365 / data.totals.grandTotal) * 100).toFixed(1) : 0}% • {formatCurrency(data?.financials.byAge.find(a => a.age === '181-365 Days')?.openReserves || 0)}
            </p>
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-amber-500/20">
              <span className="text-[10px] sm:text-xs text-amber-600 font-bold uppercase">Monitor Closely</span>
            </div>
          </div>

          {/* Aging Alert */}
          <div className="bg-destructive/5 rounded-xl p-3 sm:p-5 border-2 border-destructive/40">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold text-destructive uppercase tracking-wide">🚨 AGED 365+</span>
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
            </div>
            <p className="text-xl sm:text-3xl font-bold text-destructive">{formatNumber(EXECUTIVE_METRICS.aging.over365Days)}</p>
            <p className="text-xs sm:text-sm text-destructive/80 mt-1 sm:mt-2">{EXECUTIVE_METRICS.aging.over365Pct}% • {formatCurrency(EXECUTIVE_METRICS.aging.over365Reserves)}</p>
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-destructive/20">
              <div className="h-1.5 sm:h-2 bg-destructive/20 rounded-full overflow-hidden">
                <div className="h-full bg-destructive rounded-full transition-all" style={{ width: `${EXECUTIVE_METRICS.aging.over365Pct}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* CEO Metrics Row - Stack on mobile, 4 cols on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 p-3 sm:p-5 bg-muted/20 rounded-xl border border-border/50">
          {/* Budget Burn Rate */}
          <div 
            className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-card rounded-xl border border-border cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg"
            onClick={() => setShowBudgetDrawer(true)}
          >
            <div className="p-2 sm:p-3 bg-primary/20 rounded-lg border border-primary/30">
              <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Litigation Spend</p>
              <div className="flex items-baseline gap-2 sm:gap-3 mt-0.5 sm:mt-1">
                <p className="text-lg sm:text-2xl font-bold text-success">{formatCurrency(totalLitigationSpendJan2026)}<span className="text-[10px] sm:text-xs font-normal text-muted-foreground ml-1">Jan 2026</span></p>
              </div>
              <p className="text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium truncate text-muted-foreground">
                Indemnities: {formatCurrency(totalIndemnityJan2026)} • Expenses: {formatCurrencyK(totalExpenseJan2026)}
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
          </div>

          {/* Pending Decisions - Pain Level > 5, No Eval */}
          <div 
            className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-card rounded-xl border border-border cursor-pointer hover:border-warning/50 transition-all hover:shadow-lg"
            onClick={() => setShowDecisionsDrawer(true)}
          >
            <div className="p-2 sm:p-3 bg-warning/20 rounded-lg border border-warning/30">
              <Flag className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Decisions Pending</p>
              <p className="text-lg sm:text-2xl font-bold text-warning mt-0.5 sm:mt-1">{decisionsData?.totalCount || 0}<span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1 sm:ml-2">claims</span></p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">Pain 6+ • No eval set</p>
            </div>
            <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-warning flex-shrink-0" />
          </div>
          
          {/* CP1 Claims */}
          <div 
            className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-success/5 rounded-xl border border-success/30 cursor-pointer hover:border-success/50 transition-all hover:shadow-lg"
            onClick={() => setShowCP1Drawer(true)}
          >
            <div className="p-2 sm:p-3 bg-success/20 rounded-lg border border-success/30">
              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">CP1</p>
              <p className="text-lg sm:text-2xl font-bold text-success mt-0.5 sm:mt-1">
                {CP1_DATA.totals.yes.toLocaleString()}
                <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1 sm:ml-2">({CP1_RATE_OF_OPEN_INVENTORY}%)</span>
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">
                In Progress: <span className="text-success font-semibold">{CP1_DATA.byStatus?.inProgressPct || '0'}%</span> • Settled: <span className="font-medium">{CP1_DATA.byStatus?.settledPct || '0'}%</span>
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0" />
          </div>

          {/* Multi-Pack Claims */}
          <div 
            className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-card rounded-xl border border-border cursor-pointer hover:border-purple-500/50 transition-all hover:shadow-lg"
            onClick={() => setShowMultiPackDrawer(true)}
          >
            <div className="p-2 sm:p-3 bg-purple-500/20 rounded-lg border border-purple-500/30">
              <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Multi-Pack Claims</p>
              <p className="text-lg sm:text-2xl font-bold text-purple-500 mt-0.5 sm:mt-1">
                {data?.multiPackData?.totalMultiPackGroups || 0}
                <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1 sm:ml-2">groups</span>
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">
                {data?.multiPackData?.totalClaimsInPacks || 0} claims • Same incident
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 flex-shrink-0" />
          </div>
        </div>
        </div>
      </div>

      {/* SOL Breach Analysis */}
      <SOLBreachSummary />

      {/* Summary Banner with Financials - Cleaner Layout */}
      <div 
        className="bg-card border border-border rounded-xl p-4 sm:p-6 cursor-pointer hover:border-primary/50 transition-colors"
        onDoubleClick={handleExportSummary}
        title="Double-click to export"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-foreground">Open Inventory: {formatNumber(metrics.totalOpenClaims)} Claims</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
              As of {data?.dataDate || 'Loading...'} • <span className="font-semibold text-foreground">{formatNumber(metrics.totalOpenExposures)}</span> open exposures
            </p>
            {/* Delta from previous period */}
            {data?.delta && (
              <div className={`flex items-center gap-2 mt-2 text-xs ${data.delta.change >= 0 ? 'text-destructive' : 'text-success'}`}>
                {data.delta.change >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                <span className="font-semibold">
                  {data.delta.change >= 0 ? '+' : ''}{formatNumber(data.delta.change)} claims ({data.delta.changePercent >= 0 ? '+' : ''}{data.delta.changePercent.toFixed(1)}%)
                </span>
                <span className="text-muted-foreground">
                  vs {data.delta.previousDate} ({formatNumber(data.delta.previousTotal)})
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-6 items-center">
            <div className="text-center sm:px-5 sm:border-r border-border">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2">Open Reserves</p>
              <p className="text-base sm:text-2xl font-bold text-primary">{formatCurrency(metrics.financials.totals.totalOpenReserves)}</p>
            </div>
            <div className="text-center sm:px-5 sm:border-r border-border">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2">Low Eval</p>
              <p className="text-base sm:text-2xl font-bold text-foreground">{formatCurrency(metrics.financials.totals.totalLowEval)}</p>
            </div>
            <div className="text-center sm:px-5">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2">High Eval</p>
              <p className="text-base sm:text-2xl font-bold text-warning">{formatCurrency(metrics.financials.totals.totalHighEval)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial KPI Cards with Reserve Adequacy - Improved Layout */}
      {(() => {
        const medianEval = (metrics.financials.totals.totalLowEval + metrics.financials.totals.totalHighEval) / 2;
        const reserves = metrics.financials.totals.totalOpenReserves;
        const variance = reserves - medianEval;
        const variancePct = ((variance / medianEval) * 100).toFixed(1);
        const isOverReserved = variance > 0;
        
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-5">
            <KPICard
              title="Total Open Reserves"
              value={formatCurrency(reserves)}
              subtitle="Outstanding liability"
              icon={Wallet}
              variant="default"
            />
            <KPICard
              title="Low Evaluation"
              value={formatCurrency(metrics.financials.totals.totalLowEval)}
              subtitle="Minimum exposure"
              icon={DollarSign}
              variant="default"
            />
            <KPICard
              title="Median Evaluation"
              value={formatCurrency(medianEval)}
              subtitle="(Low + High) / 2"
              icon={Target}
              variant="default"
            />
            <KPICard
              title="High Evaluation"
              value={formatCurrency(metrics.financials.totals.totalHighEval)}
              subtitle="Maximum exposure"
              icon={DollarSign}
              variant="warning"
            />
            <div className={`rounded-xl p-3 sm:p-5 border-2 col-span-2 sm:col-span-1 ${isOverReserved ? 'bg-success/5 border-success/40' : 'bg-destructive/5 border-destructive/40'}`}>
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                {isOverReserved ? (
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                )}
                <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reserve Adequacy</span>
              </div>
              <p className={`text-xl sm:text-3xl font-bold ${isOverReserved ? 'text-success' : 'text-destructive'}`}>
                {isOverReserved ? '+' : ''}{variancePct}%
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                {isOverReserved ? 'Over-reserved' : 'Under-reserved'} by {formatCurrency(Math.abs(variance))}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Reserve Adequacy by Queue */}
      <div 
        className="bg-card border border-border rounded-xl p-4 sm:p-6 cursor-pointer hover:border-primary/50 transition-colors"
        onDoubleClick={handleExportByQueue}
        title="Double-click to export"
      >
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4 sm:mb-5">Reserve Adequacy by Queue</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
          {metrics.financials.byQueue.map((queue) => {
            const qMedian = (queue.lowEval + queue.highEval) / 2;
            const qVariance = queue.openReserves - qMedian;
            const qVariancePct = ((qVariance / qMedian) * 100).toFixed(1);
            const qIsOver = qVariance > 0;
            
            return (
              <div key={queue.queue} className={`rounded-xl p-3 sm:p-5 border ${qIsOver ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                  <span className="font-bold text-foreground text-xs sm:text-base truncate">{queue.queue}</span>
                  <span className={`text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap ${qIsOver ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'}`}>
                    {qIsOver ? '+' : ''}{qVariancePct}%
                  </span>
                </div>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between gap-1">
                    <span className="text-muted-foreground">Reserves</span>
                    <span className="font-medium">{formatCurrency(queue.openReserves)}</span>
                  </div>
                  <div className="flex justify-between gap-1">
                    <span className="text-muted-foreground">Median Eval</span>
                    <span className="font-medium">{formatCurrency(qMedian)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 sm:pt-2 mt-1.5 sm:mt-2 gap-1">
                    <span className="text-muted-foreground">{qIsOver ? 'Over' : 'Under'}</span>
                    <span className={`font-bold ${qIsOver ? 'text-success' : 'text-destructive'}`}>
                      {qIsOver ? '+' : '-'}{formatCurrency(Math.abs(qVariance))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Row - Financials by Age */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Reserves vs Eval by Age Bucket */}
        <div 
          className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportByAge}
          title="Double-click to export"
        >
          <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Reserves vs Evaluation by Age</h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Open reserves compared to low/high evaluation by claim age</p>
          
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.ageDistribution} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `$${(v/1000000).toFixed(0)}M`} />
                <YAxis type="category" dataKey="age" stroke="hsl(var(--muted-foreground))" fontSize={9} width={55} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  formatter={(value: number, name: string) => [formatCurrencyFull(value), name]}
                />
                <Bar dataKey="openReserves" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Open Reserves" />
                <Bar dataKey="lowEval" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name="Low Eval" />
                <Bar dataKey="highEval" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} name="High Eval" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-3 sm:gap-6 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-primary"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Reserves</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded" style={{backgroundColor: 'hsl(var(--accent))'}}></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Low Eval</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-warning"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">High Eval</span>
            </div>
          </div>
        </div>

        {/* Reserves by Queue */}
        <div 
          className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportByQueue}
          title="Double-click to export"
        >
          <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Reserves vs Evaluation by Queue</h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Open reserves & evaluation by handling unit</p>
          
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.financials.byQueue} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="queue" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={0} angle={-25} textAnchor="end" height={40} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `$${(v/1000000).toFixed(0)}M`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  formatter={(value: number | null, name: string) => [
                    value !== null ? formatCurrencyFull(value) : 'No Evaluation', 
                    name
                  ]}
                />
                <Bar dataKey="openReserves" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Open Reserves" />
                <Bar dataKey="lowEval" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Low Eval" />
                <Bar dataKey="highEval" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} name="High Eval" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex flex-wrap gap-3 sm:gap-6 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-primary"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Reserves</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded" style={{backgroundColor: 'hsl(var(--accent))'}}></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Low Eval</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-warning"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">High Eval</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary Table */}
      <div 
        className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
        onDoubleClick={handleExportByAge}
        title="Double-click to export"
      >
        <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Financial Summary by Age</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Claims, reserves, and evaluation amounts by age bucket</p>
        
        {/* Mobile Cards View */}
        <div className="block sm:hidden space-y-2">
          {metrics.financials.byAge.map((item) => (
            <div key={item.age} className="p-3 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm">{item.age}</span>
                <span className="text-xs text-muted-foreground">{formatNumber(item.claims)} claims</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Reserves</p>
                  <p className="font-semibold text-primary">{formatCurrency(item.openReserves)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Low</p>
                  <p className="font-medium">{formatCurrency(item.lowEval)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">High</p>
                  <p className="font-medium text-warning">{formatCurrency(item.highEval)}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="p-3 bg-muted/50 rounded-lg border border-border font-bold">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">Total</span>
              <span className="text-xs text-muted-foreground">{formatNumber(metrics.financials.byAge.reduce((s, i) => s + i.claims, 0))} claims</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Reserves</p>
                <p className="text-primary">{formatCurrency(metrics.financials.totals.totalOpenReserves)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Low</p>
                <p>{formatCurrency(metrics.financials.totals.totalLowEval)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">High</p>
                <p className="text-warning">{formatCurrency(metrics.financials.totals.totalHighEval)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Age Bucket</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Claims</th>
                <th className="text-right py-2 px-3 text-primary font-medium">Open Reserves</th>
                <th className="text-right py-2 px-3 text-accent-foreground font-medium">Low Eval</th>
                <th className="text-right py-2 px-3 text-warning font-medium">High Eval</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Avg Reserve</th>
              </tr>
            </thead>
            <tbody>
              {metrics.financials.byAge.map((item) => (
                <tr key={item.age} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-3 font-medium">{item.age}</td>
                  <td className="py-2 px-3 text-right">{formatNumber(item.claims)}</td>
                  <td className="py-2 px-3 text-right text-primary font-semibold">{formatCurrency(item.openReserves)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(item.lowEval)}</td>
                  <td className="py-2 px-3 text-right text-warning">{formatCurrency(item.highEval)}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{formatCurrencyFull(Math.round(item.openReserves / item.claims))}</td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-bold">
                <td className="py-2 px-3">Total</td>
                <td className="py-2 px-3 text-right">{formatNumber(metrics.financials.byAge.reduce((s, i) => s + i.claims, 0))}</td>
                <td className="py-2 px-3 text-right text-primary">{formatCurrency(metrics.financials.totals.totalOpenReserves)}</td>
                <td className="py-2 px-3 text-right">{formatCurrency(metrics.financials.totals.totalLowEval)}</td>
                <td className="py-2 px-3 text-right text-warning">{formatCurrency(metrics.financials.totals.totalHighEval)}</td>
                <td className="py-2 px-3 text-right text-muted-foreground">{formatCurrencyFull(Math.round(metrics.financials.totals.totalOpenReserves / metrics.financials.byAge.reduce((s, i) => s + i.claims, 0)))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Claims by Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div 
          className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportClaimsByQueue}
          title="Double-click to export"
        >
          <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Claims by Queue</h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Claims vs Exposures by handling unit</p>
          
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.typeGroups} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="typeGroup" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={0} angle={-25} textAnchor="end" height={40} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={formatNumber} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  formatter={(value: number, name: string) => [formatNumber(value), name === 'claims' ? 'Claims' : 'Exposures']}
                />
                <Bar dataKey="claims" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Claims" />
                <Bar dataKey="exposures" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Exposures" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex gap-4 sm:gap-6 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-primary"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Claims</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded" style={{backgroundColor: 'hsl(var(--accent))'}}></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Exposures</span>
            </div>
          </div>
        </div>

        {/* Inventory Age */}
        <div 
          className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportInventoryAge}
          title="Double-click to export"
        >
          <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Inventory Age Distribution</h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Claim counts by age bucket</p>
          
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.ageDistribution} layout="vertical" margin={{ top: 5, right: 20, left: 55, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={formatNumber} />
                <YAxis type="category" dataKey="age" stroke="hsl(var(--muted-foreground))" fontSize={9} width={50} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  formatter={(value: number) => [formatNumber(value), 'Claims']}
                />
                <Bar dataKey="claims" radius={[0, 4, 4, 0]}>
                  {metrics.ageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-2 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border justify-center flex-wrap">
            {metrics.ageDistribution.map(item => (
              <div key={item.age} className="text-center">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded" style={{ backgroundColor: item.fill }}></div>
                  <span className="text-[9px] sm:text-xs text-muted-foreground">{item.age}</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold">{formatNumber(item.claims)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Litigation Phases Table */}
      <div 
        className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
        onDoubleClick={handleExportLitPhases}
        title="Double-click to export"
      >
        <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Litigation Evaluation Phases</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Open LIT files by phase and age — focus on 365+ day aged claims</p>
        
        {/* Mobile Cards View */}
        <div className="block sm:hidden space-y-2">
          {metrics.topPhases.map((phase) => {
            const agedPct = phase.grandTotal > 0 
              ? ((phase.total365Plus / phase.grandTotal) * 100).toFixed(0)
              : '0';
            return (
              <div key={phase.phase} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-sm">{phase.phase}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${parseInt(agedPct) > 70 ? 'text-destructive bg-destructive/10' : parseInt(agedPct) > 50 ? 'text-warning bg-warning/10' : 'text-muted-foreground bg-muted'}`}>
                    {agedPct}% aged
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <p className="text-destructive text-[10px]">365+</p>
                    <p className="font-semibold text-destructive">{formatNumber(phase.total365Plus)}</p>
                  </div>
                  <div>
                    <p className="text-warning text-[10px]">181-365</p>
                    <p className="font-medium text-warning">{formatNumber(phase.total181To365)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px]">61-180</p>
                    <p className="font-medium">{formatNumber(phase.total61To180)}</p>
                  </div>
                  <div>
                    <p className="text-success text-[10px]">&lt;60</p>
                    <p className="font-medium text-success">{formatNumber(phase.totalUnder60)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="p-3 bg-muted/50 rounded-lg border border-border font-bold">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">LIT Total</span>
              <span className="text-xs text-destructive">{((data.litPhases.reduce((s, p) => s + p.total365Plus, 0) / metrics.litTotal) * 100).toFixed(0)}% aged</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <p className="text-destructive text-[10px]">365+</p>
                <p className="text-destructive">{formatNumber(data.litPhases.reduce((s, p) => s + p.total365Plus, 0))}</p>
              </div>
              <div>
                <p className="text-warning text-[10px]">181-365</p>
                <p className="text-warning">{formatNumber(data.litPhases.reduce((s, p) => s + p.total181To365, 0))}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">61-180</p>
                <p>{formatNumber(data.litPhases.reduce((s, p) => s + p.total61To180, 0))}</p>
              </div>
              <div>
                <p className="text-success text-[10px]">&lt;60</p>
                <p className="text-success">{formatNumber(data.litPhases.reduce((s, p) => s + p.totalUnder60, 0))}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Evaluation Phase</th>
                <th className="text-right py-2 px-3 text-destructive font-medium">365+ Days</th>
                <th className="text-right py-2 px-3 text-warning font-medium">181-365 Days</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">61-180 Days</th>
                <th className="text-right py-2 px-3 text-success font-medium">Under 60 Days</th>
                <th className="text-right py-2 px-3 text-foreground font-medium">Total</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">% Aged</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topPhases.map((phase) => {
                const agedPct = phase.grandTotal > 0 
                  ? ((phase.total365Plus / phase.grandTotal) * 100).toFixed(0)
                  : '0';
                return (
                  <tr key={phase.phase} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{phase.phase}</td>
                    <td className="py-2 px-3 text-right text-destructive font-semibold">{formatNumber(phase.total365Plus)}</td>
                    <td className="py-2 px-3 text-right text-warning">{formatNumber(phase.total181To365)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{formatNumber(phase.total61To180)}</td>
                    <td className="py-2 px-3 text-right text-success">{formatNumber(phase.totalUnder60)}</td>
                    <td className="py-2 px-3 text-right font-bold">{formatNumber(phase.grandTotal)}</td>
                    <td className={`py-2 px-3 text-right font-medium ${parseInt(agedPct) > 70 ? 'text-destructive' : parseInt(agedPct) > 50 ? 'text-warning' : 'text-muted-foreground'}`}>
                      {agedPct}%
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/50 font-bold">
                <td className="py-2 px-3">LIT Total</td>
                <td className="py-2 px-3 text-right text-destructive">{formatNumber(data.litPhases.reduce((s, p) => s + p.total365Plus, 0))}</td>
                <td className="py-2 px-3 text-right text-warning">{formatNumber(data.litPhases.reduce((s, p) => s + p.total181To365, 0))}</td>
                <td className="py-2 px-3 text-right">{formatNumber(data.litPhases.reduce((s, p) => s + p.total61To180, 0))}</td>
                <td className="py-2 px-3 text-right text-success">{formatNumber(data.litPhases.reduce((s, p) => s + p.totalUnder60, 0))}</td>
                <td className="py-2 px-3 text-right">{formatNumber(metrics.litTotal)}</td>
                <td className="py-2 px-3 text-right text-destructive">
                  {((data.litPhases.reduce((s, p) => s + p.total365Plus, 0) / metrics.litTotal) * 100).toFixed(0)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* TX LOR Intervention Settlement Tracker */}
      <div 
        className="bg-card border border-primary/30 rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
        onDoubleClick={handleExportTexasRearEnd}
        title="Double-click to export"
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide">TX LOR Intervention Settlement Tracker</h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Rear-end early settlement • Low-impact claims • Stop the bleed</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleExportLORIntervention();
              }}
              className="h-7 text-xs gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export
            </Button>
            <LOROfferDialog onOfferAdded={refetchLOR} />
          </div>
        </div>

        {/* Combined Stats Row - Age + Area + Reserves in One */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
          {/* Total Claims */}
          <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-1">
              <Car className="h-4 w-4 text-primary" />
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">Total R/E Claims</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{TEXAS_REAR_END_DATA.summary.totalClaims.toLocaleString()}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{formatCurrency(TEXAS_REAR_END_DATA.summary.totalReserves)} reserves</p>
          </div>
          
          {/* Aged 365+ Priority */}
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-destructive" />
              <p className="text-[10px] sm:text-xs font-medium text-destructive uppercase">365+ Days</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-destructive">{TEXAS_REAR_END_DATA.byAge[0]?.claims || 0}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{formatCurrencyK(TEXAS_REAR_END_DATA.byAge[0]?.reserves || 0)} at risk</p>
          </div>
          
          {/* Early Settlement Opportunity */}
          <div className="p-3 rounded-lg border border-success/30 bg-success/5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-[10px] sm:text-xs font-medium text-success uppercase">Under 60 Days</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-success">{TEXAS_REAR_END_DATA.byAge[3]?.claims || 0}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Early settle opportunity</p>
          </div>
          
          {/* LOR Active Offers */}
          <div className="p-3 rounded-lg border border-warning/30 bg-warning/5">
            <div className="flex items-center gap-2 mb-1">
              <Send className="h-4 w-4 text-warning" />
              <p className="text-[10px] sm:text-xs font-medium text-warning uppercase">Active LOR Offers</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-warning">{lorStats.pending}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">${lorStats.totalOffered.toLocaleString()} offered</p>
          </div>
        </div>

        {/* Combined Area + Age Table */}
        <div className="bg-muted/20 rounded-lg border border-border overflow-hidden mb-3 sm:mb-4">
          <div className="p-2 sm:p-3 border-b border-border bg-muted/30">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase">By Area — Claims & Reserves</p>
          </div>
          <div className="grid grid-cols-5 gap-0.5 p-2">
            {TEXAS_REAR_END_DATA.byArea.slice(0, 5).map((area, idx) => (
              <div key={area.area} className="p-2 sm:p-3 rounded bg-card text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate font-medium">{area.area}</p>
                <p className="text-sm sm:text-lg font-bold text-foreground">{area.claims}</p>
                <p className="text-[10px] text-muted-foreground">{formatCurrencyK(area.reserves)}</p>
              </div>
            ))}
          </div>
          
          {/* Age Distribution Row */}
          <div className="p-2 sm:p-3 border-t border-border">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase mb-2">Age Distribution</p>
            <div className="flex gap-2">
              {TEXAS_REAR_END_DATA.byAge.map((bucket, idx) => (
                <div 
                  key={bucket.age} 
                  className={`flex-1 p-2 rounded text-center ${
                    idx === 0 ? 'bg-destructive/10 border border-destructive/20' : 
                    idx === 1 ? 'bg-warning/10 border border-warning/20' : 
                    idx === 3 ? 'bg-success/10 border border-success/20' :
                    'bg-muted/30 border border-border/50'
                  }`}
                >
                  <p className={`text-[9px] sm:text-[10px] font-medium ${
                    idx === 0 ? 'text-destructive' : idx === 1 ? 'text-warning' : idx === 3 ? 'text-success' : 'text-muted-foreground'
                  }`}>{bucket.age}</p>
                  <p className="text-xs sm:text-sm font-bold text-foreground">{bucket.claims}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active LOR Offers */}
        <div className="space-y-2 mb-3">
          {lorOffers.filter(o => o.status === 'pending').length === 0 ? (
            <div className="p-4 text-center text-muted-foreground border border-dashed border-border rounded-lg">
              <p className="text-xs">No active LOR offers — Add offers to track early settlements</p>
            </div>
          ) : (
            lorOffers.filter(o => o.status === 'pending').map((lorOffer) => {
              const expireDate = new Date(lorOffer.expires_date);
              const today = new Date();
              const daysLeft = Math.ceil((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isExpired = daysLeft < 0;
              const isUrgent = daysLeft <= 3 && daysLeft >= 0;
              
              return (
                <div key={lorOffer.id} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-foreground">{lorOffer.claim_number}</p>
                      <span className="text-[10px] text-muted-foreground">•</span>
                      <p className="text-xs text-muted-foreground truncate">{lorOffer.area || 'TX'}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {lorOffer.accident_description || 'Rear-end'} • Exp: {format(new Date(lorOffer.expires_date), 'MM/dd')}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <p className="text-lg font-bold text-primary">${lorOffer.offer_amount.toLocaleString()}</p>
                    {isExpired ? (
                      <span className="px-2 py-1 rounded text-[10px] bg-destructive/20 text-destructive font-medium">EXPIRED</span>
                    ) : isUrgent ? (
                      <span className="px-2 py-1 rounded text-[10px] bg-warning/20 text-warning font-medium">{daysLeft}d</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-[10px] bg-success/20 text-success font-medium">{daysLeft}d</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Bottom Summary */}
        <div className="flex items-center justify-between pt-3 border-t border-border text-[10px] sm:text-xs">
          <div className="flex gap-4">
            <span className="text-muted-foreground">Pending: <span className="font-semibold text-foreground">{lorStats.pending}</span></span>
            <span className="text-muted-foreground">Accepted: <span className="font-semibold text-success">{lorStats.accepted}</span></span>
            <span className="text-muted-foreground">Rejected: <span className="font-semibold text-destructive">{lorStats.rejected}</span></span>
          </div>
          <span className="text-muted-foreground">Tiers: <span className="font-medium">$5K / $6K / $7.5K</span></span>
        </div>
      </div>

      {/* Claims with Demand Analysis */}
      {data?.demandSummary && data.demandSummary.claimsWithDemand > 0 && (
        <div 
          className="bg-card border border-accent/30 rounded-xl p-4 sm:p-5 cursor-pointer hover:border-accent/50 transition-colors"
          onDoubleClick={handleExportDemandClaims}
          title="Double-click to export PDF + Excel"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide">Claims with Demand</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Active demands by type • Double-click to export</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleExportDemandClaims();
              }}
              className="h-7 text-xs gap-1.5"
            >
              <Download className="h-3 w-3" />
              Export
            </Button>
          </div>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-center">
              <p className="text-[10px] text-muted-foreground">Claims</p>
              <p className="text-lg font-bold text-accent">{formatNumber(data.demandSummary.claimsWithDemand)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Reserves</p>
              <p className="text-sm font-semibold text-foreground">{formatCurrency(data.demandSummary.totalDemandReserves)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Low Eval</p>
              <p className="text-sm font-semibold text-foreground">{formatCurrency(data.demandSummary.totalDemandLowEval)}</p>
            </div>
            <div className="p-2 rounded-lg bg-warning/10 border border-warning/20 text-center">
              <p className="text-[10px] text-muted-foreground">High Eval</p>
              <p className="text-sm font-semibold text-warning">{formatCurrency(data.demandSummary.totalDemandHighEval)}</p>
            </div>
          </div>

          {/* By Demand Type */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase">By Demand Type</p>
            <div className="space-y-1">
              {data.demandSummary.byDemandType.slice(0, 6).map((dt) => (
                <div key={dt.demandType} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-xs">
                  <span className="font-medium text-foreground truncate flex-1">{dt.demandType}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{formatNumber(dt.claims)} claims</span>
                    <span className="text-primary font-medium">{formatCurrency(dt.reserves)}</span>
                  </div>
                </div>
              ))}
              {data.demandSummary.byDemandType.length > 6 && (
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  +{data.demandSummary.byDemandType.length - 6} more types in export
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fatality & Severity Summary Card */}
      {data.fatalitySummary && data.fatalitySummary.fatalityCount > 0 && (
        <div className="bg-card border-2 border-red-600/50 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex px-2 py-1 text-xs font-bold uppercase tracking-wide bg-red-600 text-white rounded animate-pulse">
              FATALITY CLAIMS
            </span>
            <span className="text-xs text-muted-foreground">High priority claims requiring immediate attention</span>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-red-600/10 border border-red-600/30 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Fatalities</p>
              <p className="text-2xl font-bold text-red-600">{data.fatalitySummary.fatalityCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Reserves</p>
              <p className="text-lg font-semibold text-foreground">{formatCurrency(data.fatalitySummary.fatalityReserves)}</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Surgery</p>
              <p className="text-lg font-semibold text-orange-500">{data.fatalitySummary.surgeryCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Hospitalization</p>
              <p className="text-lg font-semibold text-warning">{data.fatalitySummary.hospitalizationCount}</p>
            </div>
          </div>
        </div>
      )}

      <div 
        className="bg-card border border-destructive/30 rounded-xl p-5 cursor-pointer hover:bg-muted/30 transition-colors"
        onDoubleClick={async () => {
          const agedGroups = data.typeGroupSummaries
            .filter(g => g.age365Plus > 50)
            .sort((a, b) => b.age365Plus - a.age365Plus)
            .slice(0, 10);
          
          // Get raw claims that are 365+ days for these type groups
          const agedTypeGroupNames = agedGroups.map(g => g.typeGroup);
          const agedRawClaims = data.rawClaims.filter(claim => 
            claim.days >= 365 && agedTypeGroupNames.includes(claim.typeGroup)
          ).sort((a, b) => b.days - a.days);
          
          const manager = selectedReviewer || 'Richie Mendoza';
          const exportData: ExportableData = {
            title: 'Aged Inventory Alert',
            subtitle: 'Claims over 365 days by type requiring executive attention',
            timestamp,
            affectsManager: manager,
            directive: 'Immediate attention required for all aged claims over 365 days. These claims represent significant exposure and require executive review and resolution strategy.',
            columns: ['Type Group', '365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days', 'Total', '% Aged'],
            rows: agedGroups.map(group => [
              group.typeGroup,
              formatNumber(group.age365Plus),
              formatNumber(group.age181To365),
              formatNumber(group.age61To180),
              formatNumber(group.ageUnder60),
              formatNumber(group.grandTotal),
              `${((group.age365Plus / group.grandTotal) * 100).toFixed(0)}%`,
            ]),
            rawClaimData: [
              {
                columns: ['Type Group', '365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days', 'Grand Total', 'Aged Percentage'],
                rows: agedGroups.map(group => [
                  group.typeGroup,
                  group.age365Plus,
                  group.age181To365,
                  group.age61To180,
                  group.ageUnder60,
                  group.grandTotal,
                  ((group.age365Plus / group.grandTotal) * 100).toFixed(1),
                ]),
                sheetName: 'Summary',
              },
              {
                columns: ['Claim#', 'Claimant', 'Coverage', 'Days Open', 'Type Group', 'Open Reserves', 'Low Eval', 'High Eval', 'CP1 Flag', 'Eval Phase', 'Demand Type', 'Fatality', 'Surgery'],
                rows: agedRawClaims.map(claim => [
                  claim.claimNumber,
                  claim.claimant,
                  claim.coverage,
                  claim.days,
                  claim.typeGroup,
                  claim.openReserves,
                  claim.lowEval,
                  claim.highEval,
                  claim.overallCP1,
                  claim.evaluationPhase,
                  claim.demandType,
                  claim.fatality ? 'YES' : '',
                  claim.surgery ? 'YES' : '',
                ]),
                sheetName: 'Raw Claims 365+ Days',
              },
            ],
          };
          await exportBoth(exportData);
          toast.success(`PDF + Excel exported: Aged Inventory Alert (${agedRawClaims.length} raw claims)`);
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Aged Inventory Alert</h3>
            <p className="text-xs text-muted-foreground">Claims over 365 days by type require immediate executive attention • Double-click to export</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {data.typeGroupSummaries
            .filter(g => g.age365Plus > 50)
            .sort((a, b) => b.age365Plus - a.age365Plus)
            .slice(0, 10)
            .map((group) => (
              <div key={group.typeGroup} className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">{group.typeGroup}</p>
                <p className="text-lg font-bold text-destructive">{formatNumber(group.age365Plus)}</p>
                <p className="text-xs text-muted-foreground">
                  of {formatNumber(group.grandTotal)} total ({((group.age365Plus / group.grandTotal) * 100).toFixed(0)}%)
                </p>
              </div>
            ))}
        </div>
      </div>
      </>
      )}

      {/* Pending Decisions Drilldown Sheet - Pain Level > 5, No Eval */}
      <Sheet open={showDecisionsDrawer} onOpenChange={setShowDecisionsDrawer}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5 text-warning" />
                  Decisions Pending
                </SheetTitle>
                <SheetDescription>
                  {decisionsData?.totalCount || 0} claims with high reserves and no evaluation • Total: {formatCurrency(decisionsData?.totalReserves || 0)}
                </SheetDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateDecisionsPendingPDF}
                  disabled={generatingDecisionsPDF}
                  className="flex items-center gap-2"
                >
                  {generatingDecisionsPDF ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateDecisionsPendingExcel}
                  disabled={generatingDecisionsPDF}
                  className="flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Summary Stats by Pain Category */}
          <div className="grid grid-cols-3 gap-2 py-4 border-b border-border">
            {Object.entries(decisionsData?.byPainLevel || {}).slice(0, 3).map(([category, levelData]) => (
              <div key={category} className={`text-center p-2 rounded-lg ${
                category.includes('High') || category === 'Limits' ? 'bg-destructive/10' : 
                category === 'Pending' ? 'bg-warning/10' : 'bg-muted/50'
              }`}>
                <p className={`text-xl font-bold ${
                  category.includes('High') || category === 'Limits' ? 'text-destructive' : 
                  category === 'Pending' ? 'text-warning' : 'text-foreground'
                }`}>{levelData?.count || 0}</p>
                <p className="text-[10px] text-muted-foreground">{category}</p>
              </div>
            ))}
          </div>

          {/* Claims List */}
          <div className="py-4 space-y-3">
            {!decisionsData || decisionsData.claims.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending decisions found</p>
                <p className="text-sm">Claims with high reserves and no eval will appear here</p>
              </div>
            ) : (
              decisionsData.claims
                .slice(0, 50)
                .map((claim) => {
                  const isHighPain = claim.painLevel.includes('5+') || claim.painLevel === 'Limits' || claim.painLevel.includes('High');
                  const isPending = claim.painLevel === 'Pending' || claim.painLevel === 'Blank';
                  return (
                    <div 
                      key={claim.claimNumber} 
                      className={`p-4 rounded-lg border ${
                        isHighPain ? 'border-destructive/50 bg-destructive/5' :
                        isPending ? 'border-warning/50 bg-warning/5' :
                        'border-border bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm text-primary">{claim.claimNumber}</span>
                            {claim.fatality && (
                              <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white rounded animate-pulse">
                                FATALITY
                              </span>
                            )}
                            <Badge variant={
                              isHighPain ? 'destructive' :
                              isPending ? 'default' : 'secondary'
                            } className="text-xs">
                              {claim.painLevel}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{claim.state} • {claim.biStatus}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">{formatCurrency(claim.reserves)}</p>
                          <p className="text-xs text-muted-foreground">{claim.team}</p>
                        </div>
                      </div>

                      <div className="mt-3 p-2 bg-warning/10 rounded border border-warning/30">
                        <p className="text-xs text-warning font-medium">⚠ {claim.reason?.toUpperCase() || 'NO EVALUATION SET'}</p>
                        <p className="text-sm text-muted-foreground">Requires low/high evaluation decision</p>
                      </div>
                    </div>
                  );
                })
            )}
            {decisionsData && decisionsData.claims.length > 50 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing 50 of {decisionsData.claims.length} claims
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Budget Burn Rate Drawer */}
      <Sheet open={showBudgetDrawer} onOpenChange={setShowBudgetDrawer}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Budget Burn Rate Analysis
                </SheetTitle>
                <SheetDescription>
                  YTD budget performance and projections
                </SheetDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={generateBudgetPDF}
                disabled={generatingBudgetPDF}
                className="flex items-center gap-2"
              >
                {generatingBudgetPDF ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export PDF
              </Button>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase">Annual Budget (2025 + 5%)</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(budgetMetrics.annualBudget)}</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase">2025 Full Year</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(budgetMetrics.total2025)}</p>
              </div>
              <div className={`p-4 rounded-lg border-2 ${budgetMetrics.onTrack ? 'bg-success/10 border-success/40' : 'bg-destructive/10 border-destructive/40'}`}>
                <p className="text-xs text-muted-foreground uppercase">2026 YTD Total Paid</p>
                <p className={`text-2xl font-bold ${budgetMetrics.onTrack ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(budgetMetrics.ytdPaid)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Indemnities: {formatCurrency(budgetMetrics.totalIndemnities2026)} • Expenses: {formatCurrencyK(budgetMetrics.totalExpenses2026)}
                </p>
              </div>
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/40">
                <p className="text-xs text-muted-foreground uppercase">Remaining</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(budgetMetrics.remaining)}</p>
              </div>
            </div>

            {/* Burn Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget Utilization</span>
                <span className="font-medium">{budgetMetrics.burnRate.toFixed(3)}% used</span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    budgetMetrics.burnRate > 90 ? 'bg-destructive' :
                    budgetMetrics.burnRate > 75 ? 'bg-warning' : 'bg-success'
                  }`}
                  style={{ width: `${Math.max(Math.min(budgetMetrics.burnRate, 100), 0.5)}%` }}
                />
              </div>
            </div>

            {/* All Coverage Breakdown from Monthly Report */}
            <div>
              <h4 className="text-sm font-semibold mb-3">All Coverage Payments - Jan 2026 (Indemnities + Expenses)</h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Coverage</TableHead>
                      <TableHead className="text-xs text-right">Indemnities</TableHead>
                      <TableHead className="text-xs text-right">Expenses</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Checks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlySpend.indemnities.byCoverage.filter(c => c.coverage).map((cov) => {
                      const expense = monthlySpend.expenses.byCoverage.find(e => e.coverage === cov.coverage);
                      const expenseAmount = expense?.costs ?? 0;
                      const expenseChecks = expense?.checkCount ?? 0;
                      const total = cov.costs + expenseAmount;
                      const totalChecks = cov.checkCount + expenseChecks;
                      return (
                        <TableRow key={cov.coverage}>
                          <TableCell className="font-medium">{cov.coverage}</TableCell>
                          <TableCell className="text-right">{formatCurrencyFull(cov.costs)}</TableCell>
                          <TableCell className="text-right">{expenseAmount > 0 ? formatCurrencyFull(expenseAmount) : '-'}</TableCell>
                          <TableCell className="text-right text-success font-medium">{formatCurrencyFull(total)}</TableCell>
                          <TableCell className="text-right">{totalChecks.toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{formatCurrencyFull(budgetMetrics.totalIndemnities2026)}</TableCell>
                      <TableCell className="text-right">{formatCurrencyFull(budgetMetrics.totalExpenses2026)}</TableCell>
                      <TableCell className="text-right text-success">{formatCurrencyFull(budgetMetrics.ytdPaid)}</TableCell>
                      <TableCell className="text-right">{(monthlySpend.indemnities.totalChecks + monthlySpend.expenses.totalChecks).toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Source: Monthly Claim Indemnity & Expenses Report - 01-JAN 2026
              </p>
            </div>

            {/* Monthly Breakdown Table */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Monthly Breakdown (Estimated)</h4>
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Month</TableHead>
                      <TableHead className="text-xs text-right">Budget</TableHead>
                      <TableHead className="text-xs text-right">Actual</TableHead>
                      <TableHead className="text-xs text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetMetrics.monthlyData.map((month) => (
                      <TableRow key={month.month}>
                        <TableCell className="font-medium">{month.month}</TableCell>
                        <TableCell className="text-right">{formatCurrency(month.budget)}</TableCell>
                        <TableCell className="text-right">
                          {month.actual > 0 ? formatCurrency(month.actual) : '-'}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          month.actual === 0 ? 'text-muted-foreground' :
                          month.variance >= 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {month.actual > 0 ? (
                            <>
                              {month.variance >= 0 ? '+' : '-'}
                              {formatCurrency(Math.abs(month.variance))}
                            </>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Year-End Projection */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Year-End Projection
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Projected Annual Spend</p>
                  <p className="text-lg font-bold">{formatCurrency(budgetMetrics.projectedBurn)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Projected Variance</p>
                  <p className={`text-lg font-bold ${budgetMetrics.projectedVariance >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {budgetMetrics.projectedVariance >= 0 ? '+' : '-'}
                    {formatCurrency(Math.abs(budgetMetrics.projectedVariance))}
                  </p>
                </div>
              </div>
              <div className={`mt-3 p-2 rounded ${budgetMetrics.onTrack ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                <p className="text-sm font-medium text-center">
                  {budgetMetrics.onTrack ? '✓ On Track to Finish Under Budget' : '⚠️ Projected to Exceed Budget'}
                </p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* CP1 Analysis Drawer */}
      <Sheet open={showCP1Drawer} onOpenChange={setShowCP1Drawer}>
        <SheetContent className="w-[650px] sm:max-w-[650px] overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                CP1 Analysis
              </SheetTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={generateCP1PDF}
                  disabled={generatingCP1PDF}
                >
                  {generatingCP1PDF ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={generateCP1Excel}
                  disabled={generatingCP1Excel}
                >
                  {generatingCP1Excel ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Excel
                </Button>
              </div>
            </div>
            <SheetDescription>
              CP1 claims analysis by coverage type and age
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 pt-6">
            {/* Summary Cards - Only show CP1 and Total */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-success/10 rounded-lg border border-success/30">
                <p className="text-xs text-muted-foreground uppercase">CP1</p>
                <p className="text-2xl font-bold text-success">{CP1_DATA.totals.yes.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase">Total Claims</p>
                <p className="text-2xl font-bold text-foreground">{CP1_DATA.totals.grandTotal.toLocaleString()}</p>
              </div>
            </div>

            {/* CP1 Trigger Flags Breakdown */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                CP1 Trigger Flags
              </h4>
              <p className="text-[11px] text-muted-foreground mb-2">Sorted by count • Click any flag to export claims</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(() => {
                  // Use cp1BoxData for flags (CP1 CSV only)
                  const fs = cp1BoxData?.fatalitySummary;
                  const flagsList = [
                    { label: 'Fatality', key: 'fatality', count: fs?.fatalityCount || 0, icon: '💀', critical: true },
                    { label: 'Surgery', key: 'surgery', count: fs?.surgeryCount || 0, icon: '🏥', critical: true },
                    { label: 'Meds > Limits', key: 'medsVsLimits', count: fs?.medsVsLimitsCount || 0, icon: '💊', critical: true },
                    { label: 'Hospitalization', key: 'hospitalization', count: fs?.hospitalizationCount || 0, icon: '🛏️', critical: true },
                    { label: 'Loss of Consciousness', key: 'lossOfConsciousness', count: fs?.lossOfConsciousnessCount || 0, icon: '😵', critical: true },
                    { label: 'Lacerations', key: 'lacerations', count: fs?.lacerationsCount || 0, icon: '🩹', critical: false },
                    { label: 'Ped/Moto/Bicyclist', key: 'pedestrianMotorcyclist', count: fs?.pedestrianMotorcyclistCount || 0, icon: '🚶', critical: true },
                    { label: 'DUI/DWI/Hit & Run', key: 'duiDwiHitRun', count: fs?.duiDwiHitRunCount || 0, icon: '🚨', critical: true },
                    { label: 'Life Care Planner', key: 'lifeCarePlanner', count: fs?.lifeCarePlannerCount || 0, icon: '📋', critical: true },
                    { label: 'Confirmed Fractures', key: 'confirmedFractures', count: fs?.confirmedFracturesCount || 0, icon: '🦴', critical: true },
                    { label: 'Agg Factors DUI', key: 'aggFactorsDui', count: fs?.aggFactorsDuiCount || 0, icon: '⚠️', critical: true },
                    { label: 'Fled Scene', key: 'fledScene', count: fs?.fledSceneCount || 0, icon: '🏃', critical: true },
                    { label: 'Prior Surgery', key: 'priorSurgery', count: fs?.priorSurgeryCount || 0, icon: '📌', critical: false },
                    { label: 'Pregnancy', key: 'pregnancy', count: fs?.pregnancyCount || 0, icon: '🤰', critical: true },
                    { label: 'Ambulance Used', key: 'ambulanceUsed', count: fs?.ambulanceUsedCount || 0, icon: '🚑', critical: false },
                  ];

                  // Hide zero-count flags to avoid implying data changed
                  const nonZeroFlags = flagsList.filter((f) => f.count > 0);

                  // Sort by count descending (display only)
                  return nonZeroFlags
                    .sort((a, b) => b.count - a.count)
                    .map((flag) => (
                      <div
                        key={flag.label}
                        className={`p-2 rounded-md border cursor-pointer transition-all hover:shadow-md ${flag.critical ? 'bg-destructive/10 border-destructive/30 hover:bg-destructive/20' : 'bg-secondary/50 border-border hover:bg-secondary/70'}`}
                        onClick={() => {
                          import('xlsx').then((XLSX) => {
                            const allClaims = cp1BoxData?.rawClaims || [];
                            const filteredClaims = allClaims.filter((c) => (c as any)[flag.key]);

                            const rows = filteredClaims.map((c) => ({
                              'Claim #': c.claimNumber,
                              Claimant: c.claimant,
                              Coverage: c.coverage,
                              'Days Open': c.days,
                              'Age Bucket': c.ageBucket,
                              'Type Group': c.typeGroup,
                              Team: c.teamGroup,
                              'Open Reserves': c.openReserves,
                              'Overall CP1': c.overallCP1,
                              'BI Status': c.biStatus,
                            }));

                            const ws = XLSX.utils.json_to_sheet(rows);
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, `${flag.label} Claims`);
                            XLSX.writeFile(wb, `CP1_${flag.key}_Claims_${new Date().toISOString().split('T')[0]}.xlsx`);
                            toast.success(`Exported ${filteredClaims.length} ${flag.label} claims`);
                          });
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs">{flag.icon}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{flag.label}</span>
                          </div>
                          <Download className="h-3 w-3 text-muted-foreground opacity-50" />
                        </div>
                        <p className={`text-base font-bold ${flag.critical ? 'text-destructive' : 'text-foreground'}`}>{flag.count.toLocaleString()}</p>
                      </div>
                    ));
                })()}
              </div>
            </div>

            {/* Flags by Age Chart (top flags only, computed from same CP1 CSV) */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Trigger Flags by Age Bucket
              </h4>
              <div className="h-56 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(() => {
                      const rawClaims = cp1BoxData?.rawClaims || [];
                      const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

                      const ageOrder = ['365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days'];
                      const ageKeys = ageOrder.map((a) => ({ label: a, key: norm(a) }));

                      const fs = cp1BoxData?.fatalitySummary;
                      const allFlags = [
                        { key: 'fatality', label: 'Fatality', count: fs?.fatalityCount || 0 },
                        { key: 'surgery', label: 'Surgery', count: fs?.surgeryCount || 0 },
                        { key: 'medsVsLimits', label: 'Meds > Limits', count: fs?.medsVsLimitsCount || 0 },
                        { key: 'hospitalization', label: 'Hospitalization', count: fs?.hospitalizationCount || 0 },
                        { key: 'lossOfConsciousness', label: 'Loss of Consciousness', count: fs?.lossOfConsciousnessCount || 0 },
                        { key: 'lacerations', label: 'Lacerations', count: fs?.lacerationsCount || 0 },
                        { key: 'pedestrianMotorcyclist', label: 'Ped/Moto/Bicyclist', count: fs?.pedestrianMotorcyclistCount || 0 },
                        { key: 'duiDwiHitRun', label: 'DUI/DWI/Hit & Run', count: fs?.duiDwiHitRunCount || 0 },
                        { key: 'lifeCarePlanner', label: 'Life Care Planner', count: fs?.lifeCarePlannerCount || 0 },
                        { key: 'confirmedFractures', label: 'Confirmed Fractures', count: fs?.confirmedFracturesCount || 0 },
                        { key: 'aggFactorsDui', label: 'Agg Factors DUI', count: fs?.aggFactorsDuiCount || 0 },
                        { key: 'fledScene', label: 'Fled Scene', count: fs?.fledSceneCount || 0 },
                        { key: 'priorSurgery', label: 'Prior Surgery', count: fs?.priorSurgeryCount || 0 },
                        { key: 'pregnancy', label: 'Pregnancy', count: fs?.pregnancyCount || 0 },
                        { key: 'ambulanceUsed', label: 'Ambulance Used', count: fs?.ambulanceUsedCount || 0 },
                      ];

                      const topFlags = allFlags
                        .filter((f) => f.count > 0)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5);

                      return ageKeys.map(({ label, key }) => {
                        const claimsInAge = rawClaims.filter((c) => norm(c.ageBucket) === key);

                        const base: Record<string, string | number> = {
                          age: label.replace(' Days', ''),
                          total: claimsInAge.length,
                        };

                        for (const f of topFlags) {
                          base[f.key] = claimsInAge.filter((c: any) => Boolean((c as any)[f.key])).length;
                        }

                        return base;
                      });
                    })()}
                    margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="age" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    />

                    {/* Render only the 5 dataKeys we generate (avoid undefined theme tokens) */}
                    <Bar dataKey="hospitalization" stackId="a" fill="hsl(var(--primary))" name="Hospitalization" />
                    <Bar dataKey="medsVsLimits" stackId="a" fill="hsl(var(--accent))" name="Meds > Limits" />
                    <Bar dataKey="pedestrianMotorcyclist" stackId="a" fill="hsl(var(--warning))" name="Ped/Moto/Bicyclist" />
                    <Bar dataKey="fatality" stackId="a" fill="hsl(var(--destructive))" name="Fatality" />
                    <Bar dataKey="lossOfConsciousness" stackId="a" fill="hsl(var(--secondary-foreground))" name="Loss of Consciousness" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Chart shows the top 5 trigger flags by total count, broken out by age bucket.
              </p>
            </div>

            {/* (Removed) BI Age Breakdown / Coverage tables / Key Insights per request */}
          </div>
        </SheetContent>
      </Sheet>

      {/* CP1 Drilldown Modal */}
      {cp1DrilldownCoverage && (
        <CP1DrilldownModal
          open={!!cp1DrilldownCoverage}
          onClose={() => setCp1DrilldownCoverage(null)}
          coverage={cp1DrilldownCoverage}
          coverageData={CP1_DATA.byCoverage.find(c => c.coverage === cp1DrilldownCoverage) || { noCP: 0, yes: 0, total: 0, cp1Rate: 0 }}
        />
      )}

      {/* Multi-Pack Claims Drawer */}
      <Sheet open={showMultiPackDrawer} onOpenChange={setShowMultiPackDrawer}>
        <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-500" />
                Multi-Pack Claims
              </SheetTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  import('xlsx').then((XLSX) => {
                    const groups = data?.multiPackData?.groups || [];
                    const extractTeamNumber = (teamGroup: string) => {
                      const m = String(teamGroup || '').match(/\b(\d{1,3})\b/);
                      return m?.[1] || '';
                    };
                    const rows: any[] = [];
                    groups
                      .filter(g => selectedPackSize === null || g.packSize === selectedPackSize)
                      .forEach((group) => {
                        group.claims.forEach((claim, idx) => {
                          rows.push({
                            'Base Claim #': group.baseClaimNumber,
                            'Pack Size': group.packSize,
                            'Claim Number': claim.claimNumber,
                            'Claimant #': claim.claimant,
                            'Coverage': claim.coverage,
                            'Days Open': claim.days,
                            'Type Group': claim.typeGroup,
                            'Team Group': claim.teamGroup,
                            'Team #': extractTeamNumber(claim.teamGroup),
                            'Exposure Category': claim.exposureCategory,
                            'Overall CP1': claim.overallCP1,
                            'BI Phase': claim.evaluationPhase,
                            'Reserves': claim.reserves,
                            'Low Eval': claim.lowEval,
                            'High Eval': claim.highEval,
                            'Group Total Reserves': idx === 0 ? group.totalReserves : '',
                            'Group Total Low Eval': idx === 0 ? group.totalLowEval : '',
                            'Group Total High Eval': idx === 0 ? group.totalHighEval : '',
                          });
                        });
                      });
                    const ws = XLSX.utils.json_to_sheet(rows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Multi-Pack Claims');
                    XLSX.writeFile(wb, `Multi-Pack-Claims-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
                    toast.success('Multi-Pack Claims exported to Excel');
                  });
                }}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export
              </Button>
            </div>
            <SheetDescription>
              Claims grouped by common base number (same incident with multiple claimants)
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Groups</p>
                <p className="text-2xl font-bold text-purple-500 mt-1">{data?.multiPackData?.totalMultiPackGroups || 0}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Claims in Packs</p>
                <p className="text-2xl font-bold text-foreground mt-1">{data?.multiPackData?.totalClaimsInPacks || 0}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Reserves</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(data?.multiPackData?.groups.reduce((sum, g) => sum + g.totalReserves, 0) || 0)}
                </p>
              </div>
            </div>

            {/* Pack Size Breakdown */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-4">By Pack Size</h4>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={selectedPackSize === null ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSelectedPackSize(null)}
                >
                  All ({data?.multiPackData?.totalMultiPackGroups || 0})
                </Button>
                {data?.multiPackData?.byPackSize.map((pack) => (
                  <Button 
                    key={pack.packSize}
                    variant={selectedPackSize === pack.packSize ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setSelectedPackSize(pack.packSize)}
                  >
                    {pack.packSize}-Pack ({pack.groupCount})
                  </Button>
                ))}
              </div>
            </div>

            {/* Claims Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold">Base Claim #</TableHead>
                    <TableHead className="text-center font-semibold">Pack Size</TableHead>
                    <TableHead className="text-right font-semibold">Total Reserves</TableHead>
                    <TableHead className="text-right font-semibold">Low Eval</TableHead>
                    <TableHead className="text-right font-semibold">High Eval</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.multiPackData?.groups || [])
                    .filter(g => selectedPackSize === null || g.packSize === selectedPackSize)
                    .slice(0, 50) // Limit to first 50 for performance
                    .map((group) => (
                      <React.Fragment key={group.baseClaimNumber}>
                        <TableRow className="bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer">
                          <TableCell className="font-medium">
                            <span className="text-purple-600">{group.baseClaimNumber}*</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-purple-500/20 text-purple-600">
                              {group.packSize}-Pack
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(group.totalReserves)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(group.totalLowEval)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(group.totalHighEval)}</TableCell>
                        </TableRow>
                        {/* Expanded claims */}
                        {group.claims.map((claim, idx) => (
                          <TableRow key={claim.claimNumber} className="bg-muted/10 text-sm">
                            <TableCell className="pl-8 text-muted-foreground">
                              ↳ {claim.claimNumber} <span className="text-xs">(Clmt #{claim.claimant})</span>
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">{claim.coverage}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatCurrency(claim.reserves)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatCurrency(claim.lowEval)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatCurrency(claim.highEval)}</TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                </TableBody>
              </Table>
              {(data?.multiPackData?.groups.filter(g => selectedPackSize === null || g.packSize === selectedPackSize).length || 0) > 50 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t">
                  Showing first 50 groups. Export to Excel for complete data.
                </div>
              )}
            </div>

            {/* Key Insights */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <h4 className="text-sm font-semibold mb-3">Key Insights</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span className="font-medium text-foreground">{data?.multiPackData?.totalMultiPackGroups || 0}</span> incidents have multiple claimants ({data?.multiPackData?.totalClaimsInPacks || 0} total claims)
                </li>
                {data?.multiPackData?.byPackSize[0] && (
                  <li className="flex items-start gap-2">
                    <span className="text-warning mt-0.5">•</span>
                    Largest pack size is <span className="font-medium text-foreground">{data.multiPackData.byPackSize[0].packSize}-Pack</span> ({data.multiPackData.byPackSize[0].groupCount} groups)
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  Multi-pack claims typically represent bus accidents, multi-vehicle collisions, or workplace incidents
                </li>
              </ul>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
