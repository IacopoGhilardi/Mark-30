import type { PostgrestError } from '@supabase/supabase-js'

// Condizioni di ricerca: { colonna: valore | null | [valori] }
// valore -> eq, null -> is null, array -> in
export type Where<T> = {
  [K in keyof T]?: T[K] | T[K][] | null
}

export type FindOptions<T> = {
  where?: Where<T>
  orderBy?: { column: keyof T & string; ascending?: boolean }[]
  limit?: number
}

const toSnake = (key: string) =>
  key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)

const toCamel = (key: string) =>
  key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())

function mapKeys(
  value: Record<string, unknown>,
  fn: (key: string) => string
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [fn(key), val])
  )
}

const fromDb = <T>(row: unknown) =>
  mapKeys(row as Record<string, unknown>, toCamel) as T

const toDb = (value: object) =>
  mapKeys(value as Record<string, unknown>, toSnake)

function fail(error: PostgrestError): never {
  throw new Error(error.message)
}

// Applica where/order/limit a una query Supabase (select/update/delete).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyWhere<Q extends { eq: any; is: any; in: any }>(
  query: Q,
  where?: object
): Q {
  let result = query

  for (const [key, value] of Object.entries(where ?? {})) {
    const column = toSnake(key)

    if (value === null) {
      result = result.is(column, null)
    } else if (Array.isArray(value)) {
      result = result.in(column, value)
    } else {
      result = result.eq(column, value)
    }
  }

  return result
}

// Repository generico su una tabella/view. Il frontend usa camelCase,
// il DB snake_case: la conversione è automatica.
// Ricorda: cosa si può davvero leggere/scrivere lo decidono le policy RLS.
export function createRepository<T extends object, Insert extends object = Partial<T>>(
  table: string
) {
  const from = () => useSupabase().from(table)

  async function findAll(options: FindOptions<T> = {}): Promise<T[]> {
    let query = applyWhere(from().select('*'), options.where)

    for (const order of options.orderBy ?? []) {
      query = query.order(toSnake(order.column), {
        ascending: order.ascending ?? true,
      })
    }

    if (options.limit !== undefined) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query
    if (error) fail(error)

    return (data ?? []).map((row) => fromDb<T>(row))
  }

  async function findOne(where: Where<T>): Promise<T | null> {
    const { data, error } = await applyWhere(from().select('*'), where)
      .limit(1)
      .maybeSingle()
    if (error) fail(error)

    return data ? fromDb<T>(data) : null
  }

  async function count(where?: Where<T>): Promise<number> {
    const { count: total, error } = await applyWhere(
      from().select('*', { count: 'exact', head: true }),
      where
    )
    if (error) fail(error)

    return total ?? 0
  }

  async function insert(data: Insert): Promise<T> {
    const { data: row, error } = await from()
      .insert(toDb(data))
      .select()
      .single()
    if (error) fail(error)

    return fromDb<T>(row)
  }

  async function insertMany(items: Insert[]): Promise<T[]> {
    const { data, error } = await from()
      .insert(items.map(toDb))
      .select()
    if (error) fail(error)

    return (data ?? []).map((row) => fromDb<T>(row))
  }

  async function update(where: Where<T>, data: Partial<T>): Promise<T[]> {
    const { data: rows, error } = await applyWhere(
      from().update(toDb(data)),
      where
    ).select()
    if (error) fail(error)

    return (rows ?? []).map((row) => fromDb<T>(row))
  }

  async function upsert(data: Insert, onConflict?: string): Promise<T> {
    const { data: row, error } = await from()
      .upsert(toDb(data), onConflict ? { onConflict: toSnake(onConflict) } : {})
      .select()
      .single()
    if (error) fail(error)

    return fromDb<T>(row)
  }

  async function remove(where: Where<T>): Promise<void> {
    const { error } = await applyWhere(from().delete(), where)
    if (error) fail(error)
  }

  return { findAll, findOne, count, insert, insertMany, update, upsert, remove }
}

// Solo lettura, per view e tabelle non scrivibili dal browser.
export function createReadRepository<T extends object>(table: string) {
  const { findAll, findOne, count } = createRepository<T>(table)
  return { findAll, findOne, count }
}

// Chiamata a una funzione Postgres (le scritture "protette" passano da qui).
// Gli argomenti diventano parametri snake_case con prefisso p_:
// { teamId } -> p_team_id, come nelle funzioni della migration.
// Se la funzione restituisce righe, le chiavi tornano in camelCase.
export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await useSupabase().rpc(
    fn,
    mapKeys(args, (key) => `p_${toSnake(key)}`)
  )
  if (error) fail(error)

  if (Array.isArray(data)) {
    return data.map((row) => fromDb(row)) as T
  }

  return data as T
}
