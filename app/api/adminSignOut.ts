export async function adminSignOut() {
  await useSupabase().auth.signOut()
}
