// Mock data for Vyapar Nepal dashboard and pages

import type { BSDate } from './bs-calendar';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'SALE' | 'PURCHASE';
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  customerName?: string;
  vendorName?: string;
  issuedDateBS: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  isVatInvoice: boolean;
}

export interface Party {
  id: string;
  name: string;
  type: 'CUSTOMER' | 'VENDOR' | 'BOTH';
  phone?: string;
  panNumber?: string;
  balance: number; // positive = they owe us
}

export interface Item {
  id: string;
  name: string;
  code?: string;
  unit: string;
  salePrice: number;
  purchasePrice?: number;
  currentStock: number;
  lowStockAlert?: number;
}

export const mockInvoices: Invoice[] = [
  { id: '1', invoiceNumber: 'INV-2082-00001', type: 'SALE', status: 'PAID', customerName: 'Himalayan Traders', issuedDateBS: '2082-10-05', totalAmount: 56500, paidAmount: 56500, balanceDue: 0, isVatInvoice: true },
  { id: '2', invoiceNumber: 'INV-2082-00002', type: 'SALE', status: 'OVERDUE', customerName: 'Kathmandu Electronics', issuedDateBS: '2082-10-08', totalAmount: 125000, paidAmount: 50000, balanceDue: 75000, isVatInvoice: true },
  { id: '3', invoiceNumber: 'INV-2082-00003', type: 'SALE', status: 'ISSUED', customerName: 'Pokhara Supplies', issuedDateBS: '2082-10-10', totalAmount: 34200, paidAmount: 0, balanceDue: 34200, isVatInvoice: false },
  { id: '4', invoiceNumber: 'INV-2082-00004', type: 'SALE', status: 'PARTIALLY_PAID', customerName: 'Lalitpur Hardware', issuedDateBS: '2082-10-12', totalAmount: 89750, paidAmount: 40000, balanceDue: 49750, isVatInvoice: true },
  { id: '5', invoiceNumber: 'INV-2082-00005', type: 'SALE', status: 'DRAFT', customerName: 'Bhaktapur Textiles', issuedDateBS: '2082-10-15', totalAmount: 23000, paidAmount: 0, balanceDue: 23000, isVatInvoice: false },
  { id: '6', invoiceNumber: 'PUR-2082-00001', type: 'PURCHASE', status: 'PAID', vendorName: 'Nepal Wholesale Co.', issuedDateBS: '2082-10-03', totalAmount: 245000, paidAmount: 245000, balanceDue: 0, isVatInvoice: true },
  { id: '7', invoiceNumber: 'PUR-2082-00002', type: 'PURCHASE', status: 'ISSUED', vendorName: 'Birgunj Import House', issuedDateBS: '2082-10-09', totalAmount: 180000, paidAmount: 0, balanceDue: 180000, isVatInvoice: true },
];

export const mockParties: Party[] = [
  { id: '1', name: 'Himalayan Traders', type: 'CUSTOMER', phone: '9841234567', panNumber: '123456789', balance: 0 },
  { id: '2', name: 'Kathmandu Electronics', type: 'CUSTOMER', phone: '9851234567', panNumber: '234567891', balance: 75000 },
  { id: '3', name: 'Pokhara Supplies', type: 'CUSTOMER', phone: '9861234567', balance: 34200 },
  { id: '4', name: 'Lalitpur Hardware', type: 'CUSTOMER', phone: '9871234567', panNumber: '345678912', balance: 49750 },
  { id: '5', name: 'Nepal Wholesale Co.', type: 'VENDOR', phone: '9801234567', panNumber: '456789123', balance: 0 },
  { id: '6', name: 'Birgunj Import House', type: 'VENDOR', phone: '9811234567', panNumber: '567891234', balance: -180000 },
];

export const mockItems: Item[] = [
  { id: '1', name: 'Samsung 32" LED TV', code: 'ELEC-001', unit: 'PCS', salePrice: 45000, purchasePrice: 38000, currentStock: 8, lowStockAlert: 3 },
  { id: '2', name: 'HDMI Cable 2m', code: 'ELEC-002', unit: 'PCS', salePrice: 500, purchasePrice: 250, currentStock: 45, lowStockAlert: 10 },
  { id: '3', name: 'Cement (OPC 53)', code: 'CONST-001', unit: 'BAG', salePrice: 850, purchasePrice: 720, currentStock: 120, lowStockAlert: 50 },
  { id: '4', name: 'TMT Steel Rod 12mm', code: 'CONST-002', unit: 'KG', salePrice: 115, purchasePrice: 95, currentStock: 2, lowStockAlert: 100 },
  { id: '5', name: 'Basmati Rice (1kg)', code: 'GROC-001', unit: 'KG', salePrice: 180, purchasePrice: 140, currentStock: 250, lowStockAlert: 50 },
  { id: '6', name: 'Wai Wai Noodles', code: 'GROC-002', unit: 'PCS', salePrice: 25, purchasePrice: 18, currentStock: 500, lowStockAlert: 100 },
];

export const mockDashboardData = {
  todaySales: 56500,
  todayPurchases: 0,
  totalReceivables: 158950,
  totalPayables: 180000,
  monthSales: 328450,
  monthPurchases: 425000,
  lowStockItems: 1,
  totalCustomers: 4,
  recentSalesData: [
    { date: 'Magh 1', sales: 45000, purchases: 30000 },
    { date: 'Magh 3', sales: 62000, purchases: 245000 },
    { date: 'Magh 5', sales: 56500, purchases: 0 },
    { date: 'Magh 8', sales: 125000, purchases: 0 },
    { date: 'Magh 10', sales: 34200, purchases: 180000 },
    { date: 'Magh 12', sales: 89750, purchases: 0 },
    { date: 'Magh 15', sales: 23000, purchases: 0 },
  ],
};
