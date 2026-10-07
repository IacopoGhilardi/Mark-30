// Lunghezza della parola più lunga di un titolo (emoji incluse, contate come un carattere).
// Serve a far entrare il titolo della missione in larghezza sul telefono:
// la dimensione del testo si calcola da questo valore (vedi game.vue).
export function longestWordLength(title: string, minimum = 5): number {
  const longest = title
    .split(/\s+/)
    .filter(Boolean)
    .reduce((max, word) => Math.max(max, [...word].length), 0)

  return Math.max(longest, minimum)
}
