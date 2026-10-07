// Email dell'admin con sessione attiva, altrimenti null.
export async function getAdminEmail(): Promise<string | null> {
  const { data } = await useSupabase().auth.getSession()
  return data.session?.user.email ?? null
}
