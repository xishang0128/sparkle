import { lazy, type ComponentType } from 'react'

type PageModule = { default: ComponentType }
type PageLoader = () => Promise<PageModule>

export interface PreloadablePage {
  Page: ComponentType
  preload: PageLoader
}

export function createPreloadablePage(loader: PageLoader): PreloadablePage {
  let resolvedPage: ComponentType | undefined
  let promise: Promise<PageModule> | undefined
  const preload = (): Promise<PageModule> => {
    if (!promise) {
      promise = loader()
        .then((page) => {
          resolvedPage = page.default
          return page
        })
        .catch((error: unknown) => {
          promise = undefined
          throw error
        })
    }
    return promise
  }
  const LazyPage = lazy(preload)
  const Page = (): React.JSX.Element => {
    const ResolvedPage = resolvedPage
    return ResolvedPage ? <ResolvedPage /> : <LazyPage />
  }
  return { Page, preload }
}
