export interface LitigationMatter {
  id: string;
  claimNumber: string;
  claimant: string;
  type: 'Litigation' | 'Discipline' | 'Arbitration' | 'Mediation';
  status: 'Open' | 'Closed' | 'Pending' | 'In Trial';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  department: string;
  attorney: string;
  adjuster: string;
  dateOpened: string;
  dateClosed?: string;
  incurredReserve: number;
  paidToDate: number;
  estimatedExposure: number;
  state: string;
  description: string;
  lastActivity: string;
}

export const litigationData: LitigationMatter[] = [
  {
    id: "LIT-2025-001",
    claimNumber: "CLM-8847291",
    claimant: "Rodriguez v. Acme Corp",
    type: "Litigation",
    status: "Open",
    severity: "Critical",
    department: "General Liability",
    attorney: "Sarah Mitchell",
    adjuster: "James Wilson",
    dateOpened: "2025-01-03",
    incurredReserve: 2500000,
    paidToDate: 175000,
    estimatedExposure: 3500000,
    state: "CA",
    description: "Product liability - serious bodily injury claim",
    lastActivity: "2025-01-04"
  },
  {
    id: "LIT-2024-892",
    claimNumber: "CLM-8821456",
    claimant: "Chen Industries LLC",
    type: "Arbitration",
    status: "Pending",
    severity: "High",
    department: "Commercial Lines",
    attorney: "Michael Torres",
    adjuster: "Emily Chen",
    dateOpened: "2024-11-15",
    incurredReserve: 1800000,
    paidToDate: 250000,
    estimatedExposure: 2200000,
    state: "NY",
    description: "Contract dispute - breach of coverage terms",
    lastActivity: "2025-01-02"
  },
  {
    id: "LIT-2024-756",
    claimNumber: "CLM-8798234",
    claimant: "Thompson Family Trust",
    type: "Mediation",
    status: "Open",
    severity: "Medium",
    department: "Property",
    attorney: "Jennifer Adams",
    adjuster: "Robert Kim",
    dateOpened: "2024-09-22",
    incurredReserve: 450000,
    paidToDate: 120000,
    estimatedExposure: 550000,
    state: "TX",
    description: "Fire damage claim - coverage dispute",
    lastActivity: "2024-12-28"
  },
  {
    id: "DIS-2025-003",
    claimNumber: "CLM-8850122",
    claimant: "Martinez Employment Matter",
    type: "Discipline",
    status: "Open",
    severity: "High",
    department: "Employment",
    attorney: "David Park",
    adjuster: "Lisa Thompson",
    dateOpened: "2025-01-02",
    incurredReserve: 750000,
    paidToDate: 45000,
    estimatedExposure: 1200000,
    state: "FL",
    description: "Wrongful termination - discrimination allegations",
    lastActivity: "2025-01-04"
  },
  {
    id: "LIT-2024-623",
    claimNumber: "CLM-8756891",
    claimant: "Westfield Medical Group",
    type: "Litigation",
    status: "In Trial",
    severity: "Critical",
    department: "Professional Liability",
    attorney: "Sarah Mitchell",
    adjuster: "James Wilson",
    dateOpened: "2024-06-14",
    incurredReserve: 4500000,
    paidToDate: 890000,
    estimatedExposure: 6000000,
    state: "IL",
    description: "Medical malpractice - multiple plaintiffs",
    lastActivity: "2025-01-04"
  },
  {
    id: "LIT-2024-589",
    claimNumber: "CLM-8734521",
    claimant: "Atlantic Shipping Co.",
    type: "Arbitration",
    status: "Closed",
    severity: "Low",
    department: "Marine",
    attorney: "Michael Torres",
    adjuster: "Emily Chen",
    dateOpened: "2024-05-08",
    dateClosed: "2024-12-15",
    incurredReserve: 320000,
    paidToDate: 285000,
    estimatedExposure: 320000,
    state: "LA",
    description: "Cargo damage claim - resolved favorably",
    lastActivity: "2024-12-15"
  },
  {
    id: "DIS-2024-445",
    claimNumber: "CLM-8712389",
    claimant: "Baker Compliance Review",
    type: "Discipline",
    status: "Pending",
    severity: "Medium",
    department: "Regulatory",
    attorney: "Jennifer Adams",
    adjuster: "Robert Kim",
    dateOpened: "2024-08-19",
    incurredReserve: 180000,
    paidToDate: 35000,
    estimatedExposure: 250000,
    state: "NV",
    description: "Regulatory compliance investigation",
    lastActivity: "2024-12-20"
  },
  {
    id: "LIT-2024-398",
    claimNumber: "CLM-8698765",
    claimant: "Sunrise Construction LLC",
    type: "Litigation",
    status: "Open",
    severity: "High",
    department: "Construction",
    attorney: "David Park",
    adjuster: "Lisa Thompson",
    dateOpened: "2024-07-03",
    incurredReserve: 2100000,
    paidToDate: 425000,
    estimatedExposure: 2800000,
    state: "AZ",
    description: "Construction defect - multi-family development",
    lastActivity: "2025-01-03"
  },
  {
    id: "LIT-2025-012",
    claimNumber: "CLM-8855678",
    claimant: "GreenTech Solutions",
    type: "Mediation",
    status: "Open",
    severity: "Medium",
    department: "Environmental",
    attorney: "Sarah Mitchell",
    adjuster: "James Wilson",
    dateOpened: "2025-01-04",
    incurredReserve: 890000,
    paidToDate: 0,
    estimatedExposure: 1100000,
    state: "WA",
    description: "Environmental contamination claim",
    lastActivity: "2025-01-04"
  },
  {
    id: "LIT-2024-512",
    claimNumber: "CLM-8723456",
    claimant: "Miller Auto Group",
    type: "Litigation",
    status: "Closed",
    severity: "Low",
    department: "Auto",
    attorney: "Michael Torres",
    adjuster: "Emily Chen",
    dateOpened: "2024-04-12",
    dateClosed: "2024-11-30",
    incurredReserve: 125000,
    paidToDate: 98500,
    estimatedExposure: 125000,
    state: "OH",
    description: "Fleet accident claim - settled",
    lastActivity: "2024-11-30"
  },
  {
    id: "DIS-2024-378",
    claimNumber: "CLM-8687234",
    claimant: "Johnson HR Investigation",
    type: "Discipline",
    status: "Closed",
    severity: "Medium",
    department: "Employment",
    attorney: "Jennifer Adams",
    adjuster: "Robert Kim",
    dateOpened: "2024-06-28",
    dateClosed: "2024-12-01",
    incurredReserve: 340000,
    paidToDate: 275000,
    estimatedExposure: 340000,
    state: "GA",
    description: "Harassment claim - resolved",
    lastActivity: "2024-12-01"
  },
  {
    id: "LIT-2024-834",
    claimNumber: "CLM-8812567",
    claimant: "Pacific Distributors Inc.",
    type: "Litigation",
    status: "Open",
    severity: "High",
    department: "Products",
    attorney: "David Park",
    adjuster: "Lisa Thompson",
    dateOpened: "2024-10-22",
    incurredReserve: 1650000,
    paidToDate: 180000,
    estimatedExposure: 2100000,
    state: "OR",
    description: "Product recall litigation - consumer class action",
    lastActivity: "2025-01-02"
  }
];

export const departments = [
  "General Liability",
  "Commercial Lines", 
  "Property",
  "Employment",
  "Professional Liability",
  "Marine",
  "Regulatory",
  "Construction",
  "Environmental",
  "Auto",
  "Products"
];

export const attorneys = [
  "Sarah Mitchell",
  "Michael Torres",
  "Jennifer Adams",
  "David Park"
];

export const adjusters = [
  "James Wilson",
  "Emily Chen",
  "Robert Kim",
  "Lisa Thompson"
];

export const states = [
  "AZ", "CA", "FL", "GA", "IL", "LA", "NV", "NY", "OH", "OR", "TX", "WA"
];
