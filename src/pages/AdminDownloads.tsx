import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Download, FileText, FileSpreadsheet, Calendar, Filter, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import loyaLogo from "@/assets/fli_logo.jpg";

interface ReportDownload {
  id: string;
  report_type: string;
  report_name: string;
  file_format: string;
  row_count: number | null;
  metadata: Record<string, unknown> | null;
  downloaded_at: string;
}

const AdminDownloads = () => {
  const [dateRange, setDateRange] = useState<string>("7");
  const [reportType, setReportType] = useState<string>("all");

  const { data: downloads, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["report-downloads", dateRange],
    queryFn: async () => {
      const daysAgo = parseInt(dateRange);
      const startDate = startOfDay(subDays(new Date(), daysAgo)).toISOString();
      
      const { data, error } = await supabase
        .from("report_downloads")
        .select("*")
        .gte("downloaded_at", startDate)
        .order("downloaded_at", { ascending: false });
      
      if (error) throw error;
      return data as ReportDownload[];
    },
  });

  const filteredDownloads = useMemo(() => {
    if (!downloads) return [];
    if (reportType === "all") return downloads;
    return downloads.filter(d => d.file_format === reportType);
  }, [downloads, reportType]);

  const stats = useMemo(() => {
    if (!downloads) return { total: 0, pdf: 0, xlsx: 0, totalRows: 0 };
    return {
      total: downloads.length,
      pdf: downloads.filter(d => d.file_format === "pdf").length,
      xlsx: downloads.filter(d => d.file_format === "xlsx").length,
      totalRows: downloads.reduce((sum, d) => sum + (d.row_count || 0), 0),
    };
  }, [downloads]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "MMM d, yyyy h:mm a");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="command-header px-3 sm:px-6 py-3 sm:py-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-5">
            <img src={loyaLogo} alt="Fred Loya Insurance" className="h-8 sm:h-12 w-auto" />
            <div className="hidden sm:block h-10 w-px bg-border" />
            <div>
              <h1 className="text-sm sm:text-xl font-bold tracking-tight text-foreground">Download History</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Report export tracking</p>
            </div>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="px-3 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Downloads</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <FileText className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">PDF Reports</p>
                <p className="text-2xl font-bold text-foreground">{stats.pdf}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <FileSpreadsheet className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Excel Reports</p>
                <p className="text-2xl font-bold text-foreground">{stats.xlsx}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Calendar className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Rows</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalRows.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="pdf">PDF Only</SelectItem>
              <SelectItem value="xlsx">Excel Only</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Report Name</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Format</TableHead>
                <TableHead className="font-semibold text-right">Rows</TableHead>
                <TableHead className="font-semibold">Downloaded At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading downloads...
                  </TableCell>
                </TableRow>
              ) : filteredDownloads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No downloads found for this period
                  </TableCell>
                </TableRow>
              ) : (
                filteredDownloads.map((download) => (
                  <TableRow key={download.id}>
                    <TableCell className="font-medium">{download.report_name}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs bg-muted">
                        {download.report_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        download.file_format === 'pdf' 
                          ? 'bg-destructive/10 text-destructive' 
                          : 'bg-success/10 text-success'
                      }`}>
                        {download.file_format.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {download.row_count?.toLocaleString() || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(download.downloaded_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-3 sm:px-6 py-3 sm:py-4 mt-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>© 2025 Fred Loya Insurance</p>
          <p>Admin Panel</p>
        </div>
      </footer>
    </div>
  );
};

export default AdminDownloads;
