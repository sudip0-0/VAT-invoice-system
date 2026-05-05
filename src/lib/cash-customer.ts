export const CASH_CUSTOMER_ID = "__cash_ac__";
export const CASH_CUSTOMER_NAME = "Cash A/C";

export interface CashCustomerDetails {
  name: string;
  panNumber: string;
  phone: string;
  address: string;
}

export function emptyCashCustomerDetails(): CashCustomerDetails {
  return {
    name: "",
    panNumber: "",
    phone: "",
    address: "",
  };
}

export function normalizeCashCustomerDetails(details: CashCustomerDetails): CashCustomerDetails {
  return {
    name: details.name.trim(),
    panNumber: details.panNumber.trim(),
    phone: details.phone.trim(),
    address: details.address.trim(),
  };
}
