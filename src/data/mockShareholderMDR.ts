// Mock data for Shareholder MDR testing
// This simulates a shareholder with multiple owner clients and their transactions

export interface MockClientMDRData {
  tenant_id: string;
  tenant_public_id: string;
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
    total_transfer_amount: 1800000,   // Total transfer amount: 1,800,000 THB
    shareholder_commission_rate: 0.01,  // 1%
    owner_commission_rate: 0.005,        // 0.5%
    shareholder_commission_amount: 18000,   // 1,800,000 * 1% = 18,000 THB
    owner_commission_amount: 9000,         // 1,800,000 * 0.5% = 9,000 THB
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
    total_transfer_amount: 3900000,   // Total transfer amount: 3,900,000 THB
    shareholder_commission_rate: 0.01,  // 1%
    owner_commission_rate: 0.005,        // 0.5%
    shareholder_commission_amount: 39000,  // 3,900,000 * 1% = 39,000 THB
    owner_commission_amount: 19500,         // 3,900,000 * 0.5% = 19,500 THB
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
    total_transfer_amount: 8000000,   // Total transfer amount: 8,000,000 THB
    shareholder_commission_rate: 0.01,  // 1%
    owner_commission_rate: 0.005,        // 0.5%
    shareholder_commission_amount: 80000,  // 8,000,000 * 1% = 80,000 THB
    owner_commission_amount: 40000,        // 8,000,000 * 0.5% = 40,000 THB
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
    total_transfer_amount: 1300000,   // Total transfer amount: 1,300,000 THB
    shareholder_commission_rate: 0.01,  // 1%
    owner_commission_rate: 0.005,        // 0.5%
    shareholder_commission_amount: 13000,   // 1,300,000 * 1% = 13,000 THB
    owner_commission_amount: 6500,         // 1,300,000 * 0.5% = 6,500 THB
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
    total_transfer_amount: 15500000,   // Total transfer amount: 15,500,000 THB
    shareholder_commission_rate: 0.01,  // 1%
    owner_commission_rate: 0.005,        // 0.5%
    shareholder_commission_amount: 155000,  // 15,500,000 * 1% = 155,000 THB
    owner_commission_amount: 77500,        // 15,500,000 * 0.5% = 77,500 THB
  },
];

// Summary calculations for verification
export const mockSummary = {
  totalTransferAmount: mockShareholderMDRData.reduce((sum, client) => sum + client.total_transfer_amount, 0),
  shareholderCommission: mockShareholderMDRData.reduce((sum, client) => sum + client.shareholder_commission_amount, 0),
  ownerCommission: mockShareholderMDRData.reduce((sum, client) => sum + client.owner_commission_amount, 0),
};

// Expected summary values:
// Total Transfer Amount: 30,500,000 THB
// Total Shareholder Commission: 305,000 THB
// Total Owner Commission: 152,500 THB
