// YTD 2025 Over-Limit BI Payments Data
export interface OverLimitPayment {
  date: string;
  claim: string;
  state: string;
  coverageLimit: number;
  payment: number;
  overLimit: number;
}

export const overLimitPayments2025: OverLimitPayment[] = [
  // Alabama
  { date: "05/19/25", claim: "79-263863-03", state: "Alabama", coverageLimit: 25000, payment: 288811.60, overLimit: 263811.60 },
  { date: "09/25/25", claim: "81-290919-01", state: "Alabama", coverageLimit: 25000, payment: 125000.00, overLimit: 100000.00 },
  
  // California
  { date: "01/14/25", claim: "791-36184-02", state: "California", coverageLimit: 15000, payment: 70414.12, overLimit: 55414.12 },
  { date: "01/17/25", claim: "791-33112-02", state: "California", coverageLimit: 15000, payment: 59005.36, overLimit: 44005.36 },
  { date: "01/29/25", claim: "72-52809-02", state: "California", coverageLimit: 15000, payment: 100581.76, overLimit: 85581.76 },
  { date: "02/18/25", claim: "781-37902-05", state: "California", coverageLimit: 15000, payment: 87309.13, overLimit: 72309.13 },
  { date: "03/07/25", claim: "791-45466-01", state: "California", coverageLimit: 15000, payment: 54561.35, overLimit: 39561.35 },
  { date: "03/14/25", claim: "72-84674-05", state: "California", coverageLimit: 15000, payment: 35409.23, overLimit: 20409.23 },
  { date: "03/14/25", claim: "72-84674-06", state: "California", coverageLimit: 15000, payment: 32818.15, overLimit: 17818.15 },
  { date: "03/26/25", claim: "791-26477-01", state: "California", coverageLimit: 15000, payment: 85000.00, overLimit: 70000.00 },
  { date: "03/28/25", claim: "72-47217-04", state: "California", coverageLimit: 15000, payment: 45987.29, overLimit: 30987.29 },
  { date: "04/10/25", claim: "72-120398-02", state: "California", coverageLimit: 15000, payment: 40000.00, overLimit: 25000.00 },
  { date: "04/18/25", claim: "72-206768-02", state: "California", coverageLimit: 15000, payment: 250000.00, overLimit: 235000.00 },
  { date: "04/18/25", claim: "782-1081-01", state: "California", coverageLimit: 15000, payment: 260000.00, overLimit: 245000.00 },
  { date: "04/18/25", claim: "72-266277-03", state: "California", coverageLimit: 15000, payment: 120000.00, overLimit: 105000.00 },
  { date: "04/18/25", claim: "72-266858-02", state: "California", coverageLimit: 15000, payment: 140000.00, overLimit: 125000.00 },
  { date: "06/05/25", claim: "72-242025-02", state: "California", coverageLimit: 15000, payment: 28000.00, overLimit: 13000.00 },
  { date: "07/07/25", claim: "72-66431-02", state: "California", coverageLimit: 15000, payment: 31000.00, overLimit: 16000.00 },
  { date: "07/07/25", claim: "762-3979-02", state: "California", coverageLimit: 15000, payment: 900000.00, overLimit: 885000.00 },
  { date: "07/07/25", claim: "762-3979-02", state: "California", coverageLimit: 0, payment: 500000.00, overLimit: 500000.00 },
  { date: "07/14/25", claim: "792-2848-01", state: "California", coverageLimit: 15000, payment: 112000.00, overLimit: 97000.00 },
  { date: "07/29/25", claim: "781-36098-02", state: "California", coverageLimit: 15000, payment: 300000.00, overLimit: 285000.00 },
  { date: "07/30/25", claim: "72-138760-02", state: "California", coverageLimit: 15000, payment: 105000.00, overLimit: 90000.00 },
  { date: "08/06/25", claim: "72-138760-02", state: "California", coverageLimit: 15000, payment: 250000.00, overLimit: 235000.00 },
  { date: "08/12/25", claim: "72-138760-02", state: "California", coverageLimit: 15000, payment: 850000.00, overLimit: 835000.00 },
  { date: "08/21/25", claim: "72-138760-02", state: "California", coverageLimit: 15000, payment: 100000.00, overLimit: 85000.00 },
  { date: "09/19/25", claim: "771-9667-02", state: "California", coverageLimit: 15000, payment: 220000.00, overLimit: 205000.00 },
  { date: "09/24/25", claim: "72-465075-03", state: "California", coverageLimit: 15000, payment: 50000.00, overLimit: 35000.00 },
  { date: "10/08/25", claim: "72-9562-01", state: "California", coverageLimit: 15000, payment: 425000.00, overLimit: 410000.00 },
  { date: "10/17/25", claim: "72-105709-02", state: "California", coverageLimit: 15000, payment: 70000.00, overLimit: 55000.00 },
  { date: "11/18/25", claim: "72-212724-06", state: "California", coverageLimit: 15000, payment: 50000.00, overLimit: 35000.00 },
  { date: "12/02/25", claim: "72-86606-03", state: "California", coverageLimit: 15000, payment: 180000.00, overLimit: 165000.00 },
  
  // Colorado
  { date: "01/14/25", claim: "67-164409-02", state: "Colorado", coverageLimit: 25000, payment: 45008.93, overLimit: 20008.93 },
  { date: "03/26/25", claim: "68-260264-04", state: "Colorado", coverageLimit: 25000, payment: 35000.00, overLimit: 10000.00 },
  { date: "03/28/25", claim: "292-4201-02", state: "Colorado", coverageLimit: 25000, payment: 533678.88, overLimit: 508678.88 },
  
  // Georgia
  { date: "01/14/25", claim: "40-101414-02", state: "Georgia", coverageLimit: 25000, payment: 35000.00, overLimit: 10000.00 },
  { date: "01/14/25", claim: "40-101414-03", state: "Georgia", coverageLimit: 25000, payment: 45000.00, overLimit: 20000.00 },
  { date: "01/24/25", claim: "40-362764-03", state: "Georgia", coverageLimit: 25000, payment: 40000.00, overLimit: 15000.00 },
  { date: "03/07/25", claim: "40-318669-03", state: "Georgia", coverageLimit: 25000, payment: 60000.00, overLimit: 35000.00 },
  { date: "03/19/25", claim: "40-282002-02", state: "Georgia", coverageLimit: 25000, payment: 49000.00, overLimit: 24000.00 },
  { date: "04/10/25", claim: "40-64658-02", state: "Georgia", coverageLimit: 25000, payment: 68750.00, overLimit: 43750.00 },
  { date: "04/10/25", claim: "40-64658-03", state: "Georgia", coverageLimit: 25000, payment: 68750.00, overLimit: 43750.00 },
  { date: "08/08/25", claim: "40-64658-03", state: "Georgia", coverageLimit: 25000, payment: 90000.00, overLimit: 65000.00 },
  { date: "10/27/25", claim: "40-239507", state: "Georgia", coverageLimit: 25000, payment: 54214.00, overLimit: 29214.00 },
  
  // Nevada
  { date: "01/03/25", claim: "80-272290", state: "Nevada", coverageLimit: 25000, payment: 70000.00, overLimit: 45000.00 },
  { date: "01/07/25", claim: "80-56312-3", state: "Nevada", coverageLimit: 25000, payment: 51695.73, overLimit: 26695.73 },
  { date: "01/07/25", claim: "80-56312-04", state: "Nevada", coverageLimit: 25000, payment: 63432.53, overLimit: 38432.53 },
  { date: "01/14/25", claim: "80-167163-03", state: "Nevada", coverageLimit: 25000, payment: 35250.00, overLimit: 10250.00 },
  { date: "01/17/25", claim: "80-91729-02", state: "Nevada", coverageLimit: 25000, payment: 34999.99, overLimit: 9999.99 },
  { date: "01/17/25", claim: "96-229071-05", state: "Nevada", coverageLimit: 25000, payment: 32491.96, overLimit: 7491.96 },
  { date: "01/30/25", claim: "80-117241-05", state: "Nevada", coverageLimit: 25000, payment: 37500.00, overLimit: 12500.00 },
  { date: "01/30/25", claim: "80-117241-06", state: "Nevada", coverageLimit: 25000, payment: 37500.00, overLimit: 12500.00 },
  { date: "03/03/25", claim: "55-84860-04", state: "Nevada", coverageLimit: 25000, payment: 200000.00, overLimit: 175000.00 },
  { date: "03/12/25", claim: "80-101259", state: "Nevada", coverageLimit: 25000, payment: 350000.00, overLimit: 325000.00 },
  { date: "03/12/25", claim: "80-191353-05", state: "Nevada", coverageLimit: 25000, payment: 38269.38, overLimit: 13269.38 },
  { date: "03/12/25", claim: "55-260462-02", state: "Nevada", coverageLimit: 25000, payment: 35000.00, overLimit: 10000.00 },
  { date: "03/28/25", claim: "55-236520-03", state: "Nevada", coverageLimit: 25000, payment: 50672.49, overLimit: 25672.49 },
  { date: "04/18/25", claim: "494-556-01", state: "Nevada", coverageLimit: 25000, payment: 147714.64, overLimit: 122714.64 },
  { date: "04/18/25", claim: "80-308749-02", state: "Nevada", coverageLimit: 25000, payment: 100000.00, overLimit: 75000.00 },
  { date: "05/22/25", claim: "80-363597-02", state: "Nevada", coverageLimit: 25000, payment: 52877.25, overLimit: 27877.25 },
  { date: "05/22/25", claim: "80-363597-03", state: "Nevada", coverageLimit: 25000, payment: 40105.12, overLimit: 15105.12 },
  { date: "06/05/25", claim: "80-202246-03", state: "Nevada", coverageLimit: 25000, payment: 80001.00, overLimit: 55001.00 },
  { date: "06/06/25", claim: "80-209755-02", state: "Nevada", coverageLimit: 25000, payment: 64500.00, overLimit: 39500.00 },
  { date: "06/10/25", claim: "55-209099-04", state: "Nevada", coverageLimit: 25000, payment: 155000.00, overLimit: 130000.00 },
  { date: "06/27/25", claim: "55-209099-04", state: "Nevada", coverageLimit: 25000, payment: 60000.00, overLimit: 35000.00 },
  { date: "07/07/25", claim: "80-233614-03", state: "Nevada", coverageLimit: 25000, payment: 75000.00, overLimit: 50000.00 },
  { date: "07/30/25", claim: "80-233614-03", state: "Nevada", coverageLimit: 25000, payment: 48622.19, overLimit: 23622.19 },
  { date: "08/12/25", claim: "80-233614-03", state: "Nevada", coverageLimit: 25000, payment: 40000.00, overLimit: 15000.00 },
  { date: "08/12/25", claim: "80-152951-02", state: "Nevada", coverageLimit: 25000, payment: 67000.00, overLimit: 42000.00 },
  { date: "08/21/25", claim: "80-297272-03", state: "Nevada", coverageLimit: 25000, payment: 67655.00, overLimit: 42655.00 },
  { date: "09/17/25", claim: "471-1364-01", state: "Nevada", coverageLimit: 25000, payment: 1500000.00, overLimit: 1475000.00 },
  { date: "09/17/25", claim: "80-249225-02", state: "Nevada", coverageLimit: 25000, payment: 150000.00, overLimit: 125000.00 },
  { date: "09/24/25", claim: "80-165811-03", state: "Nevada", coverageLimit: 25000, payment: 65000.00, overLimit: 40000.00 },
  { date: "09/30/25", claim: "55-278574-02", state: "Nevada", coverageLimit: 25000, payment: 140000.00, overLimit: 115000.00 },
  { date: "09/30/25", claim: "55-278574-03", state: "Nevada", coverageLimit: 25000, payment: 134000.00, overLimit: 109000.00 },
  { date: "10/08/25", claim: "80-274062-02", state: "Nevada", coverageLimit: 25000, payment: 980000.00, overLimit: 955000.00 },
  
  // New Mexico
  { date: "01/29/25", claim: "64-319487", state: "New Mexico", coverageLimit: 25000, payment: 86655.00, overLimit: 61655.00 },
  { date: "03/26/25", claim: "62-199405-02", state: "New Mexico", coverageLimit: 0, payment: 25873.04, overLimit: 25873.04 },
  { date: "04/28/25", claim: "385-489-03", state: "New Mexico", coverageLimit: 25000, payment: 77500.00, overLimit: 52500.00 },
  { date: "11/11/25", claim: "375-130-02", state: "New Mexico", coverageLimit: 25000, payment: 229086.00, overLimit: 204086.00 },
  
  // Texas
  { date: "01/03/25", claim: "65-123153-05", state: "Texas", coverageLimit: 30000, payment: 80250.00, overLimit: 50250.00 },
  { date: "01/14/25", claim: "595-11142-02", state: "Texas", coverageLimit: 30000, payment: 42000.00, overLimit: 12000.00 },
  { date: "01/14/25", claim: "595-11142-03", state: "Texas", coverageLimit: 30000, payment: 42000.00, overLimit: 12000.00 },
  { date: "01/17/25", claim: "65-220731", state: "Texas", coverageLimit: 30000, payment: 50000.00, overLimit: 20000.00 },
  { date: "01/24/25", claim: "65-174376-06", state: "Texas", coverageLimit: 30000, payment: 250000.00, overLimit: 220000.00 },
  { date: "02/06/25", claim: "78-17575-03", state: "Texas", coverageLimit: 30000, payment: 115000.00, overLimit: 85000.00 },
  { date: "02/13/25", claim: "575-9870-02", state: "Texas", coverageLimit: 30000, payment: 784004.71, overLimit: 754004.71 },
  { date: "02/25/25", claim: "78-125952-03", state: "Texas", coverageLimit: 30000, payment: 115000.00, overLimit: 85000.00 },
  { date: "02/25/25", claim: "78-161353-04", state: "Texas", coverageLimit: 30000, payment: 52500.00, overLimit: 22500.00 },
  { date: "02/25/25", claim: "78-67399-02", state: "Texas", coverageLimit: 30000, payment: 55000.00, overLimit: 25000.00 },
  { date: "03/12/25", claim: "65-32742-02", state: "Texas", coverageLimit: 30000, payment: 31972.65, overLimit: 1972.65 },
  { date: "03/28/25", claim: "78-145336-02", state: "Texas", coverageLimit: 30000, payment: 35000.00, overLimit: 5000.00 },
  { date: "04/03/25", claim: "596-9214-01", state: "Texas", coverageLimit: 30000, payment: 125000.00, overLimit: 95000.00 },
  { date: "04/10/25", claim: "691-80-01", state: "Texas", coverageLimit: 30000, payment: 39687.55, overLimit: 9687.55 },
  { date: "04/18/25", claim: "65-78430-02", state: "Texas", coverageLimit: 30000, payment: 31362.93, overLimit: 1362.93 },
  { date: "04/18/25", claim: "66-107002-04", state: "Texas", coverageLimit: 30000, payment: 96539.00, overLimit: 66539.00 },
  { date: "05/12/25", claim: "66-366074", state: "Texas", coverageLimit: 30000, payment: 70000.00, overLimit: 40000.00 },
  { date: "06/06/25", claim: "78-325157", state: "Texas", coverageLimit: 30000, payment: 50000.00, overLimit: 20000.00 },
  { date: "06/06/25", claim: "599-530-4", state: "Texas", coverageLimit: 30000, payment: 50000.00, overLimit: 20000.00 },
  { date: "06/16/25", claim: "63-282757-03", state: "Texas", coverageLimit: 30000, payment: 60000.00, overLimit: 30000.00 },
  { date: "06/16/25", claim: "585-5551-01", state: "Texas", coverageLimit: 30000, payment: 38799.75, overLimit: 8799.75 },
  { date: "06/27/25", claim: "585-5551-01", state: "Texas", coverageLimit: 30000, payment: 125000.00, overLimit: 95000.00 },
  { date: "07/07/25", claim: "66-15730-04", state: "Texas", coverageLimit: 30000, payment: 38500.00, overLimit: 8500.00 },
  { date: "07/10/25", claim: "66-229533-02", state: "Texas", coverageLimit: 30000, payment: 38500.00, overLimit: 8500.00 },
  { date: "07/21/25", claim: "595-503-02", state: "Texas", coverageLimit: 30000, payment: 330168.00, overLimit: 300168.00 },
  { date: "07/28/25", claim: "78-250708-02", state: "Texas", coverageLimit: 30000, payment: 325000.00, overLimit: 295000.00 },
  { date: "07/28/25", claim: "584-2464-02", state: "Texas", coverageLimit: 30000, payment: 50000.00, overLimit: 20000.00 },
  { date: "07/30/25", claim: "66-385984-02", state: "Texas", coverageLimit: 30000, payment: 50000.00, overLimit: 20000.00 },
  { date: "07/30/25", claim: "63-297363-03", state: "Texas", coverageLimit: 30000, payment: 45000.00, overLimit: 15000.00 },
  { date: "08/21/25", claim: "66-162645", state: "Texas", coverageLimit: 30000, payment: 54000.00, overLimit: 24000.00 },
  { date: "09/10/25", claim: "585-7188-03", state: "Texas", coverageLimit: 30000, payment: 87500.00, overLimit: 57500.00 },
  { date: "09/17/25", claim: "78-9063-2", state: "Texas", coverageLimit: 30000, payment: 65795.53, overLimit: 35795.53 },
  { date: "09/17/25", claim: "78-9063-3", state: "Texas", coverageLimit: 30000, payment: 57235.81, overLimit: 27235.81 },
  { date: "09/17/25", claim: "585-5647-03", state: "Texas", coverageLimit: 30000, payment: 250000.00, overLimit: 220000.00 },
  { date: "09/24/25", claim: "65-295357-02", state: "Texas", coverageLimit: 30000, payment: 44871.20, overLimit: 14871.20 },
  { date: "09/24/25", claim: "595-14072-02", state: "Texas", coverageLimit: 30000, payment: 33314.17, overLimit: 3314.17 },
  { date: "10/27/25", claim: "78-440397-01", state: "Texas", coverageLimit: 30000, payment: 72500.00, overLimit: 42500.00 },
  { date: "10/28/25", claim: "65-232746-04", state: "Texas", coverageLimit: 30000, payment: 40000.00, overLimit: 10000.00 },
  { date: "10/29/25", claim: "595-6182-03", state: "Texas", coverageLimit: 30000, payment: 287471.28, overLimit: 257471.28 },
  { date: "11/10/25", claim: "559-6635-01", state: "Texas", coverageLimit: 30000, payment: 99162.11, overLimit: 69162.11 },
  { date: "11/19/25", claim: "589-01184-01", state: "Texas", coverageLimit: 30000, payment: 125000.00, overLimit: 95000.00 },
  { date: "11/19/25", claim: "65-127978-04", state: "Texas", coverageLimit: 30000, payment: 50000.00, overLimit: 20000.00 },
];

// Summary totals
export const overLimitTotals = {
  totalPayments: 16996835.81,
  totalOverLimit: 14076835.81,
  claimCount: 119,
};

// Get summary by state
export function getOverLimitByState(payments: OverLimitPayment[]) {
  const byState = new Map<string, { count: number; totalPayment: number; totalOverLimit: number }>();
  
  for (const p of payments) {
    const existing = byState.get(p.state) || { count: 0, totalPayment: 0, totalOverLimit: 0 };
    existing.count++;
    existing.totalPayment += p.payment;
    existing.totalOverLimit += p.overLimit;
    byState.set(p.state, existing);
  }
  
  return Array.from(byState.entries())
    .map(([state, data]) => ({ state, ...data }))
    .sort((a, b) => b.totalOverLimit - a.totalOverLimit);
}
