import React, { Suspense } from 'react'
import { Spinner } from '@heroui/react'

const BaseEditorComponent = React.lazy(() =>
  import('./base-editor').then((module) => ({ default: module.BaseEditor }))
)

type Language = 'yaml' | 'javascript' | 'css' | 'json' | 'text'

interface Props {
  value: string
  originalValue?: string
  diffRenderSideBySide?: boolean
  readOnly?: boolean
  language: Language
  onChange?: (value: string) => void
}

export const BaseEditor: React.FC<Props> = (props) => {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <BaseEditorComponent {...props} />
    </Suspense>
  )
}
