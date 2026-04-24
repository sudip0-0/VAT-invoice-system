export type QueryFilter =
  | { type: "eq" | "neq" | "is" | "gte" | "lte"; column: string; value: unknown }
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
  single?: boolean;
  payload?: Record<string, unknown> | Array<Record<string, unknown>> | null;
}

export interface QueryResponse<T = unknown> {
  data: T | null;
  error: { message: string } | null;
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

export interface DesktopApi {
  query: (request: QueryRequest) => Promise<QueryResponse>;
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
    updateUser: (payload: { password?: string }) => Promise<QueryResponse<{ user: DesktopUser; session: DesktopSession }>>;
    resetPasswordForEmail: (payload: { email: string; redirectTo?: string }) => Promise<QueryResponse<null>>;
  };
  system: {
    openExternal: (url: string) => Promise<{ ok: boolean }>;
    createBackup: () => Promise<QueryResponse<{ canceled: boolean; path?: string }>>;
    restoreBackup: () => Promise<QueryResponse<{ canceled: boolean; path?: string }>>;
  };
}
