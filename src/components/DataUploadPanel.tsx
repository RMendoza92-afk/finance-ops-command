import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, Database, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';
import { toast } from 'sonner';

interface UploadStatus {
  type: 'litigation' | 'painLevel' | 'exposure';
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
  count?: number;
}

export function DataUploadPanel({ onDataUploaded }: { onDataUploaded?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([
    { type: 'litigation', status: 'idle' },
    { type: 'painLevel', status: 'idle' },
    { type: 'exposure', status: 'idle' },
  ]);
  
  const litigationInputRef = useRef<HTMLInputElement>(null);
  const painLevelInputRef = useRef<HTMLInputElement>(null);
  const exposureInputRef = useRef<HTMLInputElement>(null);

  const updateStatus = (type: UploadStatus['type'], updates: Partial<UploadStatus>) => {
    setUploadStatuses(prev => prev.map(s => 
      s.type === type ? { ...s, ...updates } : s
    ));
  };

  const handleLitigationUpload = async (file: File) => {
    updateStatus('litigation', { status: 'uploading', message: 'Parsing CSV...' });
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          updateStatus('litigation', { message: `Uploading ${rows.length} records...` });

          // Transform CSV rows to database format
          const matters = rows.map((row, idx) => ({
            matter_id: row['Unique Record'] || row['Matter ID'] || row['Claim'] || `MATTER-${idx + 1}`,
            class: row['Class'] || row['class'] || null,
            claimant: row['Claimant'] || row['claimant'] || null,
            indemnities_amount: parseFloat(String(row['Indemnities Amount'] || row['indemnities_amount'] || 0).replace(/,/g, '')) || 0,
            total_amount: parseFloat(String(row['Indemnities+Expenses Amts'] || row['total_amount'] || 0).replace(/,/g, '')) || 0,
            type: row['Type'] || row['type'] || row['EXP Category'] || null,
            department: row['Dept'] || row['Department'] || row['department'] || null,
            team: row['Team'] || row['team'] || null,
            discipline: row['Discipline'] || row['discipline'] || null,
            resolution: row['Resolution'] || row['resolution'] || null,
            status: row['Status'] || row['status'] || 'Open',
            location: row['Location'] || row['location'] || null,
            matter_lead: row['Adjuster Name'] || row['Matter Lead'] || row['matter_lead'] || null,
            resolution_date: row['Resolution Date'] || row['resolution_date'] || null,
            filing_date: row['Filing Date'] || row['filing_date'] || null,
            days_open: parseInt(row['Days Open'] || row['days_open'] || 0) || 0,
            severity: row['Severity'] || row['severity'] || null,
          }));

          // Upsert in batches
          const batchSize = 100;
          let inserted = 0;
          
          for (let i = 0; i < matters.length; i += batchSize) {
            const batch = matters.slice(i, i + batchSize);
            const { error } = await supabase
              .from('litigation_matters')
              .upsert(batch, { onConflict: 'matter_id' });
            
            if (error) throw error;
            inserted += batch.length;
            updateStatus('litigation', { message: `Uploaded ${inserted}/${matters.length}...` });
          }

          updateStatus('litigation', { 
            status: 'success', 
            message: `Successfully uploaded ${matters.length} records`,
            count: matters.length 
          });
          toast.success(`Uploaded ${matters.length} litigation records`);
          onDataUploaded?.();
        } catch (err) {
          console.error('Upload error:', err);
          updateStatus('litigation', { 
            status: 'error', 
            message: err instanceof Error ? err.message : 'Upload failed' 
          });
          toast.error('Failed to upload litigation data');
        }
      },
      error: (err) => {
        updateStatus('litigation', { status: 'error', message: err.message });
        toast.error('Failed to parse CSV file');
      }
    });
  };

  const handlePainLevelUpload = async (file: File) => {
    updateStatus('painLevel', { status: 'uploading', message: 'Parsing CSV...' });
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          updateStatus('painLevel', { message: `Uploading ${rows.length} pain levels...` });

          const painLevels = rows.map(row => ({
            matter_id: row['Matter ID'] || row['Unique Record'] || row['matter_id'] || row['Claim'],
            pain_level: row['Pain Level'] || row['pain_level'] || row['End Pain Lvl'] || row['Start Pain Lvl'] || '0',
            notes: row['Notes'] || row['notes'] || null,
          })).filter(p => p.matter_id);

          // Upsert pain levels
          const { error } = await supabase
            .from('pain_levels')
            .upsert(painLevels, { onConflict: 'matter_id' });

          if (error) throw error;

          updateStatus('painLevel', { 
            status: 'success', 
            message: `Successfully uploaded ${painLevels.length} pain levels`,
            count: painLevels.length 
          });
          toast.success(`Uploaded ${painLevels.length} pain level records`);
          onDataUploaded?.();
        } catch (err) {
          console.error('Upload error:', err);
          updateStatus('painLevel', { 
            status: 'error', 
            message: err instanceof Error ? err.message : 'Upload failed' 
          });
          toast.error('Failed to upload pain level data');
        }
      },
      error: (err) => {
        updateStatus('painLevel', { status: 'error', message: err.message });
      }
    });
  };

  const handleExposureUpload = async (file: File) => {
    updateStatus('exposure', { status: 'uploading', message: 'Parsing CSV...' });
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          updateStatus('exposure', { message: `Uploading ${rows.length} exposure records...` });

          const exposures = rows.map(row => ({
            matter_id: row['Matter ID'] || row['matter_id'] || row['Unique Record'],
            phase: row['Phase'] || row['phase'] || row['Eval Phase'] || null,
            type_group: row['Type Group'] || row['type_group'] || null,
            net_exposure: parseFloat(String(row['Net Exposure'] || row['net_exposure'] || 0).replace(/,/g, '')) || 0,
            insurance_expectancy: parseFloat(String(row['Insurance Expectancy'] || row['insurance_expectancy'] || 0).replace(/,/g, '')) || 0,
            reserves: parseFloat(String(row['Reserves'] || row['reserves'] || 0).replace(/,/g, '')) || 0,
          })).filter(e => e.matter_id);

          // Insert exposure records
          const { error } = await supabase
            .from('open_exposure')
            .upsert(exposures, { onConflict: 'id' });

          if (error) throw error;

          updateStatus('exposure', { 
            status: 'success', 
            message: `Successfully uploaded ${exposures.length} exposure records`,
            count: exposures.length 
          });
          toast.success(`Uploaded ${exposures.length} exposure records`);
          onDataUploaded?.();
        } catch (err) {
          console.error('Upload error:', err);
          updateStatus('exposure', { 
            status: 'error', 
            message: err instanceof Error ? err.message : 'Upload failed' 
          });
          toast.error('Failed to upload exposure data');
        }
      },
      error: (err) => {
        updateStatus('exposure', { status: 'error', message: err.message });
      }
    });
  };

  const getStatusForType = (type: UploadStatus['type']): UploadStatus => 
    uploadStatuses.find(s => s.type === type) || { type, status: 'idle' };

  const StatusIcon = ({ status }: { status: UploadStatus['status'] }) => {
    switch (status) {
      case 'uploading': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return <Upload className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Database className="h-4 w-4" />
          Upload Data
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Upload Claims Data
          </SheetTitle>
          <SheetDescription>
            Upload CSV files to populate the database with litigation, pain level, and exposure data.
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-200px)] mt-6">
          <div className="space-y-4 pr-4">
            {/* Litigation Data Upload */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Litigation Matters</CardTitle>
                  <StatusIcon status={getStatusForType('litigation').status} />
                </div>
                <CardDescription className="text-xs">
                  Upload claim records with matter IDs, claimants, amounts, departments, etc.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={litigationInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleLitigationUpload(e.target.files[0])}
                />
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-full"
                  onClick={() => litigationInputRef.current?.click()}
                  disabled={getStatusForType('litigation').status === 'uploading'}
                >
                  {getStatusForType('litigation').status === 'uploading' ? 'Uploading...' : 'Select CSV File'}
                </Button>
                {getStatusForType('litigation').message && (
                  <p className={`text-xs mt-2 ${getStatusForType('litigation').status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {getStatusForType('litigation').message}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Pain Level Upload */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Pain Levels</CardTitle>
                  <StatusIcon status={getStatusForType('painLevel').status} />
                </div>
                <CardDescription className="text-xs">
                  Upload pain level assignments linked to matter IDs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={painLevelInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handlePainLevelUpload(e.target.files[0])}
                />
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-full"
                  onClick={() => painLevelInputRef.current?.click()}
                  disabled={getStatusForType('painLevel').status === 'uploading'}
                >
                  {getStatusForType('painLevel').status === 'uploading' ? 'Uploading...' : 'Select CSV File'}
                </Button>
                {getStatusForType('painLevel').message && (
                  <p className={`text-xs mt-2 ${getStatusForType('painLevel').status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {getStatusForType('painLevel').message}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Exposure Data Upload */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Open Exposure</CardTitle>
                  <StatusIcon status={getStatusForType('exposure').status} />
                </div>
                <CardDescription className="text-xs">
                  Upload exposure data with phases, reserves, and insurance expectancy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={exposureInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleExposureUpload(e.target.files[0])}
                />
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-full"
                  onClick={() => exposureInputRef.current?.click()}
                  disabled={getStatusForType('exposure').status === 'uploading'}
                >
                  {getStatusForType('exposure').status === 'uploading' ? 'Uploading...' : 'Select CSV File'}
                </Button>
                {getStatusForType('exposure').message && (
                  <p className={`text-xs mt-2 ${getStatusForType('exposure').status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {getStatusForType('exposure').message}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* CSV Format Guide */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">CSV Format Guide</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p><strong>Litigation:</strong> Matter ID, Class, Claimant, Dept, Team, Status, Amounts...</p>
                <p><strong>Pain Levels:</strong> Matter ID, Pain Level, Notes</p>
                <p><strong>Exposure:</strong> Matter ID, Phase, Type Group, Net Exposure, Reserves...</p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
