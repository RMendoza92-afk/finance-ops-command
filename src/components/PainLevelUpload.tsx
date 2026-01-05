import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Papa from 'papaparse';

interface PainLevelRow {
  oldStartPain: string;
  oldEndPain: string;
  startPain: string;
  endPain: string;
}

interface PainLevelUploadProps {
  onDataUploaded?: (data: PainLevelRow[]) => void;
}

export function PainLevelUpload({ onDataUploaded }: PainLevelUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState<PainLevelRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseStats, setParseStats] = useState<{
    total: number;
    withOldPain: number;
    withNewPain: number;
    withBothFormats: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse pain value - handles both numeric (0-10) and banded (0-3, 4-6, 7-9) formats
  const parsePainValue = (value: string): string => {
    if (!value || value.trim() === '') return '';
    const cleaned = value.trim();
    
    // If it's already a band format like "0-3", "4-6", "7-9", return as-is
    if (cleaned.includes('-') && /^\d+-\d+$/.test(cleaned)) {
      return cleaned;
    }
    
    // If it's a numeric value, return as-is
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return cleaned;
    }
    
    return cleaned;
  };

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log('Pain level CSV parsed:', results.data.length, 'rows');
        
        // Map various possible column names
        const rows: PainLevelRow[] = results.data.map((row: any) => {
          // Try different column name variations
          const oldStartPain = parsePainValue(
            row['Old Start Pain Level'] || 
            row['Old Start Pain Lvl'] || 
            row['OldStartPain'] ||
            row['old_start_pain'] ||
            ''
          );
          const oldEndPain = parsePainValue(
            row['Old End Pain Level'] || 
            row['Old End Pain Lvl'] || 
            row['OldEndPain'] ||
            row['old_end_pain'] ||
            ''
          );
          const startPain = parsePainValue(
            row['Start Pain Level'] || 
            row['Start Pain Lvl'] || 
            row['StartPain'] ||
            row['start_pain'] ||
            ''
          );
          const endPain = parsePainValue(
            row['End Pain Level'] || 
            row['End Pain Lvl'] || 
            row['EndPain'] ||
            row['end_pain'] ||
            ''
          );

          return { oldStartPain, oldEndPain, startPain, endPain };
        });

        // Filter out completely empty rows
        const validRows = rows.filter(r => 
          r.oldStartPain || r.oldEndPain || r.startPain || r.endPain
        );

        // Calculate stats
        const stats = {
          total: validRows.length,
          withOldPain: validRows.filter(r => r.oldStartPain || r.oldEndPain).length,
          withNewPain: validRows.filter(r => r.startPain || r.endPain).length,
          withBothFormats: validRows.filter(r => 
            (r.oldStartPain || r.oldEndPain) && (r.startPain || r.endPain)
          ).length,
        };

        setUploadedData(validRows);
        setParseStats(stats);
        
        toast.success(`Parsed ${validRows.length} pain level records`);
      },
      error: (err) => {
        console.error('CSV parse error:', err);
        toast.error(`Failed to parse CSV: ${err.message}`);
      }
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleApplyData = useCallback(() => {
    if (uploadedData.length === 0) {
      toast.error('No data to apply');
      return;
    }

    // Store in localStorage for now (could be enhanced to update actual data)
    localStorage.setItem('painLevelOverrides', JSON.stringify(uploadedData));
    
    onDataUploaded?.(uploadedData);
    
    toast.success(`Applied ${uploadedData.length} pain level updates`);
    setIsOpen(false);
  }, [uploadedData, onDataUploaded]);

  const handleClearData = useCallback(() => {
    setUploadedData([]);
    setFileName(null);
    setParseStats(null);
    localStorage.removeItem('painLevelOverrides');
    toast.info('Pain level overrides cleared');
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
        >
          <Upload className="h-4 w-4" />
          Upload Pain Data
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-amber-500" />
            Upload Pain Level Data
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* File Upload Zone */}
          <div 
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">
              {fileName || 'Click to upload CSV file'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Expected columns: Old Start Pain Level, Old End Pain Level, Start Pain Level, End Pain Level
            </p>
          </div>

          {/* Parse Stats */}
          {parseStats && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-500">
                <CheckCircle className="h-4 w-4" />
                Successfully parsed {parseStats.total} records
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>With Old Pain Values: <span className="text-foreground font-medium">{parseStats.withOldPain}</span></div>
                <div>With New Pain Values: <span className="text-foreground font-medium">{parseStats.withNewPain}</span></div>
                <div>With Both Formats: <span className="text-foreground font-medium">{parseStats.withBothFormats}</span></div>
              </div>
            </div>
          )}

          {/* Sample Data Preview */}
          {uploadedData.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs font-medium border-b border-border">
                Preview (first 5 rows)
              </div>
              <div className="max-h-40 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-2 py-1 text-left">Old Start</th>
                      <th className="px-2 py-1 text-left">Old End</th>
                      <th className="px-2 py-1 text-left">Start</th>
                      <th className="px-2 py-1 text-left">End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedData.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-t border-border/50">
                        <td className="px-2 py-1">{row.oldStartPain || '-'}</td>
                        <td className="px-2 py-1">{row.oldEndPain || '-'}</td>
                        <td className="px-2 py-1">{row.startPain || '-'}</td>
                        <td className="px-2 py-1">{row.endPain || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Format Help */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-blue-400">Supported Formats</p>
                <p className="text-muted-foreground mt-1">
                  <strong>Numeric:</strong> 0, 1, 2, ... 10<br/>
                  <strong>Banded:</strong> 0-3, 4-6, 7-9, 10
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            {uploadedData.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearData}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            <Button 
              onClick={handleApplyData}
              disabled={uploadedData.length === 0}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              Apply {uploadedData.length} Records
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
