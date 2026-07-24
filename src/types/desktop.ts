export type QueryFilter =
  | { type: "eq" | "neq" | "is" | "gte" | "lte" | "ilike"; column: string; value: unknown }
  | { type: "in"; column: string; value: unknown[] }
  | { type: "or"; expression: string };

export interface QueryRequest {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  selection?: string;
  filters: QueryFilter[];
  orderBy?: {
    column: string;
    ascending?: boolean;
  } | null;
  limit?: number | null;
  offset?: number | null;
  count?: "exact" | null;
  single?: boolean;
  payload?: Record<string, unknown> | Array<Record<string, unknown>> | null;
}

export interface QueryResponse<T = unknown> {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}

export interface DesktopUser {
  id: string;
  email: string;
  created_at: string;
  user_metadata?: {
    name?: string;
  };
}

export interface DesktopSession {
  user: DesktopUser;
}

export interface CreateAndIssuePayload {
  invoice: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
  paymentAmount?: number;
}

export interface StockAdjustPayload {
  business_id: string;
  item_id: string;
  quantity: number;
  direction: "in" | "out";
  reason?: string;
}

export interface DesktopApi {
  query: (request: QueryRequest) => Promise<QueryResponse>;
  documents: {
    createAndIssue: (
      payload: CreateAndIssuePayload
    ) => Promise<QueryResponse<{ id: string; invoice_number: string; status: string }>>;
  };
  stock: {
    adjust: (
      payload: StockAdjustPayload
    ) => Promise<QueryResponse<{ item_id: string; stock_before: number; stock_after: number }>>;
  };
  auth: {
    getSession: () => Promise<QueryResponse<{ session: DesktopSession | null }>>;
    signUp: (payload: {
      email: string;
      password: string;
      options?: { data?: { name?: string } };
    }) => Promise<QueryResponse<{ user: DesktopUser; session: DesktopSession }>>;
    signIn: (payload: {
      email: string;
      password: string;
    }) => Promise<QueryResponse<{ user: DesktopUser; session: DesktopSession }>>;
    signOut: () => Promise<QueryResponse<{ session: null }>>;
    updateUser: (payload: {
      password?: string;
      currentPassword?: string;
    }) => Promise<QueryResponse<{ user: DesktopUser; session: DesktopSession }>>;
    resetPasswordForEmail: (payload: { email: string; redirectTo?: string }) => Promise<QueryResponse<null>>;
    createMember: (payload: {
      businessId: string;
      email: string;
      password: string;
      name?: string;
      role?: string;
    }) => Promise<QueryResponse<{ userId: string; membershipId: string; email: string; createdUser: boolean }>>;
    listMembers: (payload: {
      businessId: string;
    }) => Promise<QueryResponse<{ members: Array<{
      id: string;
      user_id: string;
      role: string;
      is_active: boolean;
      joined_at: string;
      email: string;
      name: string;
    }> }>>;
    removeMember: (payload: {
      businessId: string;
      membershipId: string;
    }) => Promise<QueryResponse<{ removed: boolean }>>;
  };
  system: {
    openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>;
    openLogs: () => Promise<{ ok: boolean; path?: string; error?: string }>;
    createBackup: (payload?: {
      passphrase?: string;
      unencrypted?: boolean;
    }) => Promise<QueryResponse<{ canceled: boolean; path?: string; checksum?: string; encrypted?: boolean }>>;
    restoreBackup: (payload?: {
      passphrase?: string;
    }) => Promise<QueryResponse<{ canceled: boolean; path?: string; safetyPath?: string }>>;
  };
}
