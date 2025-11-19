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
    tenant_public_id: "OWA/123456",
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    total_deposit: 1000000,
    total_topup: 500000,
    total_payout: 0,
    total_settlement: 300000,
    total_transfer_amount: 1800000,
    shareholder_commission_rate: 0.01,
    owner_commission_rate: 0.005,
    shareholder_commission_amount: 18000,
    owner_commission_amount: 9000,
  },
  {
    tenant_id: "tenant-002",
    tenant_public_id: "PEA-122356",
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    total_deposit: 2500000,
    total_topup: 800000,
    total_payout: 0,
    total_settlement: 600000,
    total_transfer_amount: 3900000,
    shareholder_commission_rate: 0.01,
    owner_commission_rate: 0.005,
    shareholder_commission_amount: 39000,
    owner_commission_amount: 19500,
  },
  {
    tenant_id: "tenant-003",
    tenant_public_id: "HTL/789012",
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    total_deposit: 5000000,
    total_topup: 1200000,
    total_payout: 0,
    total_settlement: 1800000,
    total_transfer_amount: 8000000,
    shareholder_commission_rate: 0.01,
    owner_commission_rate: 0.005,
    shareholder_commission_amount: 80000,
    owner_commission_amount: 40000,
  },
  {
    tenant_id: "tenant-004",
    tenant_public_id: "RST/345678",
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    total_deposit: 800000,
    total_topup: 300000,
    total_payout: 0,
    total_settlement: 200000,
    total_transfer_amount: 1300000,
    shareholder_commission_rate: 0.01,
    owner_commission_rate: 0.005,
    shareholder_commission_amount: 13000,
    owner_commission_amount: 6500,
  },
  {
    tenant_id: "tenant-005",
    tenant_public_id: "SPA/901234",
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    total_deposit: 1500000,
    total_topup: 450000,
    total_payout: 0,
    total_settlement: 350000,
    total_transfer_amount: 2300000,
    shareholder_commission_rate: 0.01,
    owner_commission_rate: 0.005,
    shareholder_commission_amount: 23000,
    owner_commission_amount: 11500,
  }
];

// Mock summary for quick display
export const mockSummary = {
  totalTransferAmount: 17300000,
  shareholderCommission: 173000,
  ownerCommission: 86500,
};
