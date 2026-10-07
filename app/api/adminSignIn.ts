// Login dell'admin per la pagina /export (utente creato a mano su Supabase).
export async function adminSignIn(email: string, password: string) {
  const { error } = await useSupabase().auth.signInWithPassword({ email, password })

  if (error) {
    throw new Error(error.message)
  }
}
