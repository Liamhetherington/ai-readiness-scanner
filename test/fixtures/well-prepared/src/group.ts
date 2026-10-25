export const byClient = <T extends { client: string }>(xs: T[]) => Object.groupBy(xs, (x) => x.client);
