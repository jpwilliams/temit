export type Unpack<T> = T extends Promise<infer U> ? U : T;
export type Priority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
