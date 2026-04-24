import type { DesktopApi, DesktopSession, QueryFilter, QueryRequest, QueryResponse } from "@/types/desktop";

type AuthListener = (event: string, session: DesktopSession | null) => void;

const authListeners = new Set<AuthListener>();

function getDesktopApi(): DesktopApi {
  if (!window.desktopApi) {
    throw new Error("Desktop API is not available. Run this app inside Electron.");
  }
  return window.desktopApi;
}

function emitAuthChange(event: string, session: DesktopSession | null) {
  authListeners.forEach((listener) => listener(event, session));
}

function sanitizePayload<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map((entry) => sanitizePayload(entry)) as T;
  }

  if (payload && typeof payload === "object") {
    return Object.fromEntries(
      Object.entries(payload)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, sanitizePayload(value)])
    ) as T;
  }

  return payload;
}

class LocalQueryBuilder<TData = unknown> implements PromiseLike<QueryResponse<TData>> {
  private readonly request: QueryRequest;

  constructor(table: string) {
    this.request = {
      table,
      action: "select",
      selection: "*",
      filters: [],
      orderBy: null,
      limit: null,
      single: false,
      payload: null,
    };
  }

  select(selection = "*") {
    this.request.selection = selection;
    return this;
  }

  insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.request.action = "insert";
    this.request.payload = sanitizePayload(payload);
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.request.action = "update";
    this.request.payload = sanitizePayload(payload);
    return this;
  }

  delete() {
    this.request.action = "delete";
    this.request.payload = null;
    return this;
  }

  eq(column: string, value: unknown) {
    this.request.filters.push({ type: "eq", column, value } satisfies QueryFilter);
    return this;
  }

  neq(column: string, value: unknown) {
    this.request.filters.push({ type: "neq", column, value } satisfies QueryFilter);
    return this;
  }

  is(column: string, value: unknown) {
    this.request.filters.push({ type: "is", column, value } satisfies QueryFilter);
    return this;
  }

  in(column: string, value: unknown[]) {
    this.request.filters.push({ type: "in", column, value } satisfies QueryFilter);
    return this;
  }

  gte(column: string, value: unknown) {
    this.request.filters.push({ type: "gte", column, value } satisfies QueryFilter);
    return this;
  }

  lte(column: string, value: unknown) {
    this.request.filters.push({ type: "lte", column, value } satisfies QueryFilter);
    return this;
  }

  or(expression: string) {
    this.request.filters.push({ type: "or", expression } satisfies QueryFilter);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.request.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.request.limit = count;
    return this;
  }

  single() {
    this.request.single = true;
    return this;
  }

  then<TResult1 = QueryResponse<TData>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<TData>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return getDesktopApi().query(this.request).then(
      (response) => (onfulfilled ? onfulfilled(response as QueryResponse<TData>) : (response as TResult1)),
      onrejected ?? undefined
    );
  }
}

export const supabase = {
  from<TTable extends string>(table: TTable) {
    return new LocalQueryBuilder(table);
  },
  auth: {
    onAuthStateChange(callback: AuthListener) {
      authListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
    async getSession() {
      return getDesktopApi().auth.getSession();
    },
    async signUp(payload: { email: string; password: string; options?: { data?: { name?: string } } }) {
      const response = await getDesktopApi().auth.signUp(payload);
      if (!response.error) {
        emitAuthChange("SIGNED_IN", response.data?.session ?? null);
      }
      return response;
    },
    async signInWithPassword(payload: { email: string; password: string }) {
      const response = await getDesktopApi().auth.signIn(payload);
      if (!response.error) {
        emitAuthChange("SIGNED_IN", response.data?.session ?? null);
      }
      return response;
    },
    async signOut() {
      const response = await getDesktopApi().auth.signOut();
      if (!response.error) {
        emitAuthChange("SIGNED_OUT", null);
      }
      return response;
    },
    async updateUser(payload: { password?: string }) {
      const response = await getDesktopApi().auth.updateUser(payload);
      if (!response.error) {
        emitAuthChange("USER_UPDATED", response.data?.session ?? null);
      }
      return response;
    },
    async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
      return getDesktopApi().auth.resetPasswordForEmail({ email, redirectTo: options?.redirectTo });
    },
  },
};
