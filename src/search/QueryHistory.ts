/** Shared by palette instances for this plugin session; never persisted to disk. */
export class QueryHistory {
    private queries: string[] = [];
    record(query: string): void {
        const value = query.trim();
        if (!value) return;
        this.queries = [value, ...this.queries.filter(entry => entry !== value)];
    }
    at(index: number): string | undefined { return this.queries[index]; }
    get length(): number { return this.queries.length; }
}
