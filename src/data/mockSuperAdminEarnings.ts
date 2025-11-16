// Mock data for Super Admin Earnings page

export interface MockIncomingTransfer {
  id: string;
  amount: number;
  from_account: string;
  from_name: string;
  status: string;
  created_at: string;
  bank_code?: string;
  to_account?: string;
  to_name?: string;
  ref_id?: string;
  shareholder_public_id?: string;
}

export const mockIncomingTransfers: MockIncomingTransfer[] = [
  {
    id: "txn_001",
    amount: 500000,
    from_account: "1234567890",
    from_name: "Merchant A Co., Ltd.",
    status: "completed",
    bank_code: "004",
    to_account: "9876543210",
    to_name: "Platform Account",
    ref_id: "REF001",
    shareholder_public_id: "SH-000001",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "txn_002",
    amount: 750000,
    from_account: "0987654321",
    from_name: "Business Solutions Ltd.",
    status: "completed",
    bank_code: "002",
    to_account: "9876543210",
    to_name: "Platform Account",
    ref_id: "REF002",
    shareholder_public_id: "SH-000002",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: "txn_003",
    amount: 1000000,
    from_account: "1122334455",
    from_name: "Digital Commerce Inc.",
    status: "completed",
    bank_code: "006",
    to_account: "9876543210",
    to_name: "Platform Account",
    ref_id: "REF003",
    shareholder_public_id: "SH-000001",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: "txn_004",
    amount: 250000,
    from_account: "5544332211",
    from_name: "Retail Partner Thailand",
    status: "completed",
    bank_code: "014",
    to_account: "9876543210",
    to_name: "Platform Account",
    ref_id: "REF004",
    shareholder_public_id: "SH-000003",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
  {
    id: "txn_005",
    amount: 600000,
    from_account: "6677889900",
    from_name: "Online Store Group",
    status: "completed",
    bank_code: "025",
    to_account: "9876543210",
    to_name: "Platform Account",
    ref_id: "REF005",
    shareholder_public_id: "SH-000002",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
  },
  {
    id: "txn_006",
    amount: 850000,
    from_account: "1231231234",
    from_name: "Tech Startup Co.",
    status: "completed",
    bank_code: "004",
    to_account: "9876543210",
    to_name: "Platform Account",
    ref_id: "REF006",
    shareholder_public_id: "SH-000004",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 144).toISOString(),
  },
  {
    id: "txn_007",
    amount: 425000,
    from_account: "4564564567",
    from_name: "Food Delivery Platform",
    status: "completed",
    bank_code: "002",
    to_account: "9876543210",
    to_name: "Platform Account",
    ref_id: "REF007",
    shareholder_public_id: "SH-000003",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 168).toISOString(),
  },
  {
    id: "txn_008",
    amount: 950000,
    from_account: "7897897890",
    from_name: "E-Commerce Hub",
    status: "completed",
    bank_code: "006",
    to_account: "9876543210",
    to_name: "Platform Account",
    ref_id: "REF008",
    shareholder_public_id: "SH-000001",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 192).toISOString(),
  },
  {
    id: "txn_009",
    amount: 320000,
    from_account: "3213213210",
    from_name: "Service Provider Ltd.",
    status: "completed",
    bank_code: "014",
    to_account: "9876543210",
    to_name: "Platform Account",
    ref_id: "REF009",
    shareholder_public_id: "SH-000005",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 216).toISOString(),
  },
  {
    id: "txn_010",
    amount: 680000,
    from_account: "6546546543",
    from_name: "Logistics Solutions",
    status: "completed",
    bank_code: "025",
    to_account: "9876543210",
    to_name: "Platform Account",
    ref_id: "REF010",
    shareholder_public_id: "SH-000002",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 240).toISOString(),
  },
];

// Summary calculations
export const mockSuperAdminEarningsSummary = {
  totalTransfers: mockIncomingTransfers.length,
  totalRevenue: mockIncomingTransfers.reduce((sum, t) => sum + t.amount, 0),
  averageCommissionRate: 0.05, // 5% average commission rate
  get totalCommissions() {
    return this.totalRevenue * this.averageCommissionRate;
  },
  get netEarnings() {
    return this.totalRevenue - this.totalCommissions;
  },
  get profitMargin() {
    return ((this.netEarnings / this.totalRevenue) * 100).toFixed(2);
  },
};
