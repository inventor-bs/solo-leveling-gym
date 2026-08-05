declare const brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Barbell load, in kilograms. */
export type Kg = Brand<number, "Kg">;
/** Reps performed in a single set. */
export type Reps = Brand<number, "Reps">;
/** Experience points. */
export type Exp = Brand<number, "Exp">;
/** In-game currency. */
export type Gold = Brand<number, "Gold">;
/** UTC epoch milliseconds. */
export type Epoch = Brand<number, "Epoch">;

export const kg = (n: number): Kg => n as Kg;
export const reps = (n: number): Reps => n as Reps;
export const exp = (n: number): Exp => n as Exp;
export const gold = (n: number): Gold => n as Gold;
export const epoch = (n: number): Epoch => n as Epoch;
