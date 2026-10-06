export const useAppLoader = () => {
  const isLoading = useState<boolean>('app-loader', () => false)

  const loaderText = useState<string>(
    'app-loader-text',
    () => 'CARICAMENTO...'
  )

  const showLoader = (text = 'CARICAMENTO...') => {
    loaderText.value = text
    isLoading.value = true
  }

  const hideLoader = () => {
    isLoading.value = false
  }

  return {
    isLoading,
    loaderText,
    showLoader,
    hideLoader,
  }
}