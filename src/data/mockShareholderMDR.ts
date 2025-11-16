// Mock data for Shareholder MDR testing
// This simulates a shareholder with multiple owner clients and their transactions

export interface MockClientMDRData {
  tenant_id: string;
  tenant_name: string;
  owner_name: string;
  period_start: string;
  period_end: string;
  total_deposit: number;
  total_topup: number;
  total_payout: number;
  total_settlement: number;
  total_transfer_amount: number;
  shareholder_commission_rate: number;
  owner_commission_rate: number;
  shareholder_commission_amount: number;
  owner_commission_amount: number;
}

// Example calculation:
// Client 1: 
// - Deposits: 1,000,000 THB
// - Topups: 500,000 THB
// - Settlements: 300,000 THB
// - Total transaction volume: 1,800,000 THB
// - Base MDR Rate: 1% = 18,000 THB total MDR
// - Shareholder commission: 40% of 18,000 = 7,200 THB
// - Owner commission: 20% of 18,000 = 3,600 THB
// - Net after owner: 7,200 - 3,600 = 3,600 THB

export const mockShareholderMDRData: MockClientMDRData[] = [
  {
    tenant_id: "tenant-001",
    tenant_name: "บริษัท เทคโนโลยี จำกัด",
    owner_name: "คุณสมชาย ใจดี",
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    total_deposit: 1000000,      // 1,000,000 THB
    total_topup: 500000,          // 500,000 THB
    total_payout: 0,
    total_settlement: 300000,     // 300,000 THB
    total_mdr: 18000,             // Total volume 1,800,000 * 1% = 18,000 THB
    shareholder_commission_rate: 40,  // 40%
    owner_commission_rate: 20,        // 20%
    shareholder_commission_amount: 7200,   // 18,000 * 40% = 7,200 THB
    owner_commission_amount: 3600,         // 18,000 * 20% = 3,600 THB
    net_after_owner: 3600,                 // 7,200 - 3,600 = 3,600 THB
  },
  {
    tenant_id: "tenant-002",
    tenant_name: "ร้านค้าออนไลน์ ABC",
    owner_name: "คุณสมหญิง ประสบความสำเร็จ",
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    total_deposit: 2500000,      // 2,500,000 THB
    total_topup: 800000,          // 800,000 THB
    total_payout: 0,
    total_settlement: 600000,     // 600,000 THB
    total_mdr: 39000,             // Total volume 3,900,000 * 1% = 39,000 THB
    shareholder_commission_rate: 35,  // 35%
    owner_commission_rate: 25,        // 25%
    shareholder_commission_amount: 13650,  // 39,000 * 35% = 13,650 THB
    owner_commission_amount: 9750,         // 39,000 * 25% = 9,750 THB
    net_after_owner: 3900,                 // 13,650 - 9,750 = 3,900 THB
  },
  {
    tenant_id: "tenant-003",
    tenant_name: "โรงแรม สวยงาม รีสอร์ท",
    owner_name: "คุณวิชัย มีเงิน",
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    total_deposit: 5000000,      // 5,000,000 THB
    total_topup: 1200000,         // 1,200,000 THB
    total_payout: 0,
    total_settlement: 1800000,    // 1,800,000 THB
    total_mdr: 80000,             // Total volume 8,000,000 * 1% = 80,000 THB
    shareholder_commission_rate: 45,  // 45%
    owner_commission_rate: 15,        // 15%
    shareholder_commission_amount: 36000,  // 80,000 * 45% = 36,000 THB
    owner_commission_amount: 12000,        // 80,000 * 15% = 12,000 THB
    net_after_owner: 24000,                // 36,000 - 12,000 = 24,000 THB
  },
  {
    tenant_id: "tenant-004",
    tenant_name: "ร้านอาหาร มิชลิน สตาร์",
    owner_name: "คุณอรทัย เชฟมือทอง",
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    total_deposit: 800000,       // 800,000 THB
    total_topup: 300000,          // 300,000 THB
    total_payout: 0,
    total_settlement: 200000,     // 200,000 THB
    total_mdr: 13000,             // Total volume 1,300,000 * 1% = 13,000 THB
    shareholder_commission_rate: 38,  // 38%
    owner_commission_rate: 22,        // 22%
    shareholder_commission_amount: 4940,   // 13,000 * 38% = 4,940 THB
    owner_commission_amount: 2860,         // 13,000 * 22% = 2,860 THB
    net_after_owner: 2080,                 // 4,940 - 2,860 = 2,080 THB
  },
  {
    tenant_id: "tenant-005",
    tenant_name: "ศูนย์การค้า เมกะมอลล์",
    owner_name: "คุณประเสริฐ ธุรกิจใหญ่",
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    total_deposit: 10000000,     // 10,000,000 THB
    total_topup: 3000000,         // 3,000,000 THB
    total_payout: 0,
    total_settlement: 2500000,    // 2,500,000 THB
    total_mdr: 155000,            // Total volume 15,500,000 * 1% = 155,000 THB
    shareholder_commission_rate: 42,  // 42%
    owner_commission_rate: 18,        // 18%
    shareholder_commission_amount: 65100,  // 155,000 * 42% = 65,100 THB
    owner_commission_amount: 27900,        // 155,000 * 18% = 27,900 THB
    net_after_owner: 37200,                // 65,100 - 27,900 = 37,200 THB
  },
];

// Summary calculations for verification
export const mockSummary = {
  totalMDR: mockShareholderMDRData.reduce((sum, client) => sum + client.total_mdr, 0),
  shareholderCommission: mockShareholderMDRData.reduce((sum, client) => sum + client.shareholder_commission_amount, 0),
  ownerCommission: mockShareholderMDRData.reduce((sum, client) => sum + client.owner_commission_amount, 0),
  netAmount: mockShareholderMDRData.reduce((sum, client) => sum + client.net_after_owner, 0),
};

// Expected summary values:
// Total MDR: 305,000 THB
// Total Shareholder Commission: 126,890 THB
// Total Owner Commission: 56,110 THB
// Total Net After Owner: 70,780 THB
