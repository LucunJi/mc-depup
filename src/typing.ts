/* eslint-disable @typescript-eslint/ban-types */

/**
 * A simplified version of code from https://umaranis.com/2022/11/28/type-transformations-in-typescript-removing-functions-from-a-type/
 */
export type ExcludeFunctions<T> = Pick<
    T,
    { [key in keyof T]: T[key] extends Function ? never : key }[keyof T]
>
