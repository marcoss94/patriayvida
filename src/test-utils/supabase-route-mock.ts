type QueryAction = "select" | "insert" | "update";

export type SupabaseQueryCall = {
  table: string;
  action: QueryAction;
  columns?: string;
  selectOptions?: {
    count?: "exact";
    head?: boolean;
  };
  values?: unknown;
  filters: Array<{
    type: "eq" | "in" | "gte";
    column: string;
    value: unknown;
  }>;
  orFilter?: string;
  orderBy?: {
    column: string;
    ascending?: boolean;
  };
  limit?: number;
  range?: {
    from: number;
    to: number;
  };
  resultMode: "many" | "single" | "maybeSingle";
};

type QueryResult = {
  count?: number | null;
  data?: unknown;
  error?: unknown;
};

type QueryResolver = (call: SupabaseQueryCall) => QueryResult;

class QueryBuilder implements PromiseLike<QueryResult> {
  private call: SupabaseQueryCall;

  constructor(
    table: string,
    private readonly calls: SupabaseQueryCall[],
    private readonly resolve: QueryResolver
  ) {
    this.call = {
      table,
      action: "select",
      filters: [],
      resultMode: "many",
    };
  }

  select(columns: string, options?: { count?: "exact"; head?: boolean }) {
    this.call.columns = columns;
    this.call.selectOptions = options;

    if (this.call.action !== "insert" && this.call.action !== "update") {
      this.call.action = "select";
    }

    return this;
  }

  insert(values: unknown) {
    this.call.action = "insert";
    this.call.values = values;
    return this;
  }

  update(values: unknown) {
    this.call.action = "update";
    this.call.values = values;
    return this;
  }

  eq(column: string, value: unknown) {
    this.call.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown) {
    this.call.filters.push({ type: "in", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.call.filters.push({ type: "gte", column, value });
    return this;
  }

  or(filter: string) {
    this.call.orFilter = filter;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.call.orderBy = { column, ascending: options?.ascending };
    return this;
  }

  limit(value: number) {
    this.call.limit = value;
    return this;
  }

  range(from: number, to: number) {
    this.call.range = { from, to };
    return this;
  }

  maybeSingle<T>() {
    this.call.resultMode = "maybeSingle";
    return Promise.resolve(this.finish()) as Promise<QueryResult & { data: T | null }>;
  }

  single<T>() {
    this.call.resultMode = "single";
    return Promise.resolve(this.finish()) as Promise<QueryResult & { data: T | null }>;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.finish()).then(onfulfilled, onrejected);
  }

  private finish() {
    const snapshot: SupabaseQueryCall = {
      ...this.call,
      filters: [...this.call.filters],
    };

    this.calls.push(snapshot);
    return this.resolve(snapshot);
  }
}

export function createSupabaseRouteMock(params?: {
  user?: { id: string } | null;
  resolve?: QueryResolver;
}) {
  const calls: SupabaseQueryCall[] = [];
  const resolve =
    params?.resolve ??
    ((call: SupabaseQueryCall) => {
      throw new Error(`No mock response configured for ${call.action} ${call.table}`);
    });

  return {
    calls,
    auth: {
      async getUser() {
        return {
          data: {
            user:
              params && Object.prototype.hasOwnProperty.call(params, "user")
                ? params.user ?? null
                : { id: "user-1" },
          },
        };
      },
    },
    from(table: string) {
      return new QueryBuilder(table, calls, resolve);
    },
  };
}

export function getFilterValue(
  call: SupabaseQueryCall,
  type: SupabaseQueryCall["filters"][number]["type"],
  column: string
) {
  return call.filters.find((filter) => filter.type === type && filter.column === column)?.value;
}
