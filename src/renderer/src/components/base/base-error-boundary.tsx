import { Button } from '@heroui/react'

import { JSX, ReactNode } from 'react'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const getErrorStack = (error: unknown): string => {
  if (error instanceof Error && typeof error.stack === 'string') {
    return error.stack
  }
  return ''
}

const ErrorFallback = ({ error }: FallbackProps): JSX.Element => {
  const message = getErrorMessage(error)
  const stack = getErrorStack(error)

  return (
    <div className="p-4">
      <h2 className="my-2 text-lg font-bold">应用崩溃了 :( 请将以下信息提交给开发者以排查错误</h2>

      {/* <Button
          size="sm"
          color="primary"
          variant="flat"
          onPress={() => open('https://github.com/xishang0128/sparkle/issues/new/choose')}
        >
          GitHub
        </Button> */}
      <Button
        size="sm"
        onPress={() => open('https://t.me/+y7rcYjEKIiI1NzZl')}
        variant="secondary"
        data-color="primary"
        className="ml-2"
      >
        Telegram
      </Button>

      <Button
        size="sm"
        onPress={() => navigator.clipboard.writeText('```\n' + message + '\n' + stack + '\n```')}
        variant="secondary"
        data-color="default"
        className="ml-2"
      >
        复制报错信息
      </Button>

      <p className="my-2">{message}</p>

      <details title="Error Stack">
        <summary>Error Stack</summary>
        <pre>{stack}</pre>
      </details>
    </div>
  )
}

interface Props {
  children?: ReactNode
}

const BaseErrorBoundary = (props: Props): JSX.Element => {
  return <ErrorBoundary FallbackComponent={ErrorFallback}>{props.children}</ErrorBoundary>
}

export default BaseErrorBoundary
