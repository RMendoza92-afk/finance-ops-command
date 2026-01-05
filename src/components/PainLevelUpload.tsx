import { useState, useCallback } from 'react';
import { FileSpreadsheet, CheckCircle, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PainLevelRow {
  oldStartPain: string;
  oldEndPain: string;
  startPain: string;
  endPain: string;
}

interface PainLevelUploadProps {
  onDataUploaded?: (data: PainLevelRow[]) => void;
}

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

// Pre-loaded pain level data (from the provided spreadsheet)
const PAIN_LEVEL_DATA: PainLevelRow[] = [
  { oldStartPain: '9', oldEndPain: '6', startPain: '0-3', endPain: '0-3' },
  { oldStartPain: '10', oldEndPain: '10', startPain: '', endPain: '' },
  { oldStartPain: '4', oldEndPain: '4', startPain: '', endPain: '' },
  { oldStartPain: '', oldEndPain: '', startPain: '4-6', endPain: '' },
  { oldStartPain: '10', oldEndPain: '6', startPain: '', endPain: '' },
  { oldStartPain: '10', oldEndPain: '10', startPain: '', endPain: '' },
  { oldStartPain: '5', oldEndPain: '5', startPain: '', endPain: '' },
  { oldStartPain: '8', oldEndPain: '', startPain: '', endPain: '' },
  { oldStartPain: '', oldEndPain: '', startPain: '5', endPain: '8' },
  { oldStartPain: '', oldEndPain: '', startPain: '10', endPain: '10' },
  { oldStartPain: '1', oldEndPain: '', startPain: '', endPain: '' },
  { oldStartPain: '', oldEndPain: '', startPain: '', endPain: '3' },
  { oldStartPain: '4', oldEndPain: '0', startPain: '', endPain: '' },
  { oldStartPain: '10', oldEndPain: '8', startPain: '7-9', endPain: '7-9' },
  { oldStartPain: '', oldEndPain: '', startPain: '8', endPain: '6' },
  { oldStartPain: '', oldEndPain: '', startPain: '7', endPain: '' },
  { oldStartPain: '', oldEndPain: '', startPain: '8', endPain: '0-3' },
  { oldStartPain: '', oldEndPain: '', startPain: '7-9', endPain: '4' },
  { oldStartPain: '5', oldEndPain: '5', startPain: '', endPain: '' },
  { oldStartPain: '', oldEndPain: '', startPain: '9', endPain: '7' },
  { oldStartPain: '8', oldEndPain: '3', startPain: '', endPain: '' },
  { oldStartPain: '10', oldEndPain: '10', startPain: '10', endPain: '10' },
  { oldStartPain: '8', oldEndPain: '3', startPain: '', endPain: '' },
  { oldStartPain: '10', oldEndPain: '10', startPain: '', endPain: '' },
  { oldStartPain: '10', oldEndPain: '2', startPain: '9', endPain: '1' },
  { oldStartPain: '', oldEndPain: '', startPain: '10', endPain: '10' },
  { oldStartPain: '10', oldEndPain: '10', startPain: '10', endPain: '10' },
  { oldStartPain: '', oldEndPain: '', startPain: '7-9', endPain: '7-9' },
  { oldStartPain: '7', oldEndPain: '8', startPain: '', endPain: '' },
  { oldStartPain: '', oldEndPain: '', startPain: '10', endPain: '5' },
  { oldStartPain: '10', oldEndPain: '10', startPain: '7-9', endPain: '7-9' },
  { oldStartPain: '', oldEndPain: '', startPain: '10', endPain: '10' },
  { oldStartPain: '8', oldEndPain: '7', startPain: '', endPain: '' },
  { oldStartPain: '', oldEndPain: '', startPain: '10', endPain: '10' },
  { oldStartPain: '', oldEndPain: '', startPain: '10', endPain: '10' },
  { oldStartPain: '10', oldEndPain: '10', startPain: '7-9', endPain: '7-9' },
  { oldStartPain: '', oldEndPain: '', startPain: '10', endPain: '0-3' },
  { oldStartPain: '', oldEndPain: '', startPain: '4-6', endPain: '7-9' },
  { oldStartPain: '', oldEndPain: '', startPain: '4-6', endPain: '4-6' },
  { oldStartPain: '6', oldEndPain: '10', startPain: '4-6', endPain: '4-6' },
  { oldStartPain: '6', oldEndPain: '3', startPain: '', endPain: '' },
  { oldStartPain: '', oldEndPain: '', startPain: '7-9', endPain: '7-9' },
  { oldStartPain: '8', oldEndPain: '1', startPain: '8', endPain: '1' },
  { oldStartPain: '', oldEndPain: '', startPain: '10', endPain: '10' },
  { oldStartPain: '8', oldEndPain: '5', startPain: '', endPain: '' },
  { oldStartPain: '3', oldEndPain: '3', startPain: '', endPain: '' },
  { oldStartPain: '6', oldEndPain: '2', startPain: '6', endPain: '2' },
  { oldStartPain: '8', oldEndPain: '7', startPain: '8', endPain: '7' },
  { oldStartPain: '8', oldEndPain: '3', startPain: '8', endPain: '3' },
];

export function PainLevelUpload({ onDataUploaded }: PainLevelUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isApplied, setIsApplied] = useState(() => {
    return localStorage.getItem('painLevelOverrides') !== null;
  });

  // Calculate stats from pre-loaded data
  const parseStats = {
    total: PAIN_LEVEL_DATA.length,
    withOldPain: PAIN_LEVEL_DATA.filter(r => r.oldStartPain || r.oldEndPain).length,
    withNewPain: PAIN_LEVEL_DATA.filter(r => r.startPain || r.endPain).length,
    withBothFormats: PAIN_LEVEL_DATA.filter(r => 
      (r.oldStartPain || r.oldEndPain) && (r.startPain || r.endPain)
    ).length,
  };

  const handleApplyData = useCallback(() => {
    localStorage.setItem('painLevelOverrides', JSON.stringify(PAIN_LEVEL_DATA));
    setIsApplied(true);
    onDataUploaded?.(PAIN_LEVEL_DATA);
    toast.success(`Applied ${PAIN_LEVEL_DATA.length} pain level updates`);
    setIsOpen(false);
  }, [onDataUploaded]);

  const handleClearData = useCallback(() => {
    localStorage.removeItem('painLevelOverrides');
    setIsApplied(false);
    toast.info('Pain level overrides cleared');
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={`gap-2 ${isApplied 
            ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          {isApplied ? 'Pain Data Applied' : 'Pain Level Data'}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[500px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-amber-500" />
            Pain Level Data
          </SheetTitle>
        </SheetHeader>
        
        <div className="space-y-4 mt-6">
          {/* Status */}
          <div className={`rounded-lg p-4 ${isApplied ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50'}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {isApplied ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">Data Applied to System</span>
                </>
              ) : (
                <>
                  <Info className="h-4 w-4 text-amber-400" />
                  <span className="text-amber-400">Ready to Apply</span>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-3">
              <div>Total Records: <span className="text-foreground font-medium">{parseStats.total}</span></div>
              <div>With Old Pain: <span className="text-foreground font-medium">{parseStats.withOldPain}</span></div>
              <div>With New Pain: <span className="text-foreground font-medium">{parseStats.withNewPain}</span></div>
              <div>With Both: <span className="text-foreground font-medium">{parseStats.withBothFormats}</span></div>
            </div>
          </div>

          {/* Data Preview */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-xs font-medium border-b border-border flex justify-between items-center">
              <span>Pain Level Data ({PAIN_LEVEL_DATA.length} records)</span>
            </div>
            <ScrollArea className="h-[350px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">Old Start</th>
                    <th className="px-2 py-1.5 text-left font-medium">Old End</th>
                    <th className="px-2 py-1.5 text-left font-medium">Start</th>
                    <th className="px-2 py-1.5 text-left font-medium">End</th>
                  </tr>
                </thead>
                <tbody>
                  {PAIN_LEVEL_DATA.map((row, idx) => (
                    <tr key={idx} className="border-t border-border/50 hover:bg-muted/30">
                      <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                      <td className="px-2 py-1">{row.oldStartPain || '-'}</td>
                      <td className="px-2 py-1">{row.oldEndPain || '-'}</td>
                      <td className="px-2 py-1 text-amber-400">{row.startPain || '-'}</td>
                      <td className="px-2 py-1 text-amber-400">{row.endPain || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-2">
            {isApplied && (
              <Button variant="ghost" size="sm" onClick={handleClearData}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            <Button 
              onClick={handleApplyData}
              disabled={isApplied}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              {isApplied ? 'Applied' : `Apply ${PAIN_LEVEL_DATA.length} Records`}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}