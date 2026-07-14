import { useMemo, useRef } from 'react'
import * as monaco from 'monaco-editor'
import MonacoEditor, { MonacoDiffEditor } from 'react-monaco-editor'
import { configureMonacoYaml } from 'monaco-yaml'
import metaSchema from 'meta-json-schema/schemas/meta-json-schema.json'
import pac from 'types-pac/pac.d.ts?raw'
import { useTheme } from 'next-themes'
import { nanoid } from 'nanoid'
import React from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
type Language = 'yaml' | 'javascript' | 'css' | 'json' | 'text'

const LONG_LINE_LIMIT = 1000
const LARGE_CONTENT_LIMIT = 2 * 1024 * 1024
const LARGE_LINE_COUNT_LIMIT = 20000

interface Props {
  value: string
  originalValue?: string
  diffRenderSideBySide?: boolean
  readOnly?: boolean
  language: Language
  onChange?: (value: string) => void
}

let initialized = false

function getContentStats(...contents: Array<string | undefined>): {
  hasLongLine: boolean
  isLargeContent: boolean
} {
  let totalLength = 0
  let lineCount = 1
  let currentLineLength = 0
  let hasLongLine = false

  for (const content of contents) {
    if (!content) continue
    totalLength += content.length

    for (let index = 0; index < content.length; index++) {
      if (content.charCodeAt(index) === 10) {
        lineCount++
        currentLineLength = 0
      } else {
        currentLineLength++
        if (currentLineLength > LONG_LINE_LIMIT) {
          hasLongLine = true
        }
      }
    }
  }

  return {
    hasLongLine,
    isLargeContent: totalLength > LARGE_CONTENT_LIMIT || lineCount > LARGE_LINE_COUNT_LIMIT
  }
}

function createEditorUri(prefix: string, language: Language): monaco.Uri {
  const extension = language === 'yaml' ? 'clash.yaml' : language
  return monaco.Uri.parse(`${prefix}-${nanoid()}.${extension}`)
}

const monacoInitialization = (): void => {
  if (initialized) return

  // configure yaml worker
  configureMonacoYaml(monaco, {
    validate: true,
    enableSchemaRequest: true,
    schemas: [
      {
        uri: 'http://example.com/meta-json-schema.json',
        fileMatch: ['**/*.clash.yaml'],
        // @ts-ignore // type JSONSchema7
        schema: {
          ...metaSchema,
          patternProperties: {
            '\\+rules': {
              type: 'array',
              $ref: '#/definitions/rules',
              description: '“+”开头表示将内容插入到原数组前面'
            },
            'rules\\+': {
              type: 'array',
              $ref: '#/definitions/rules',
              description: '“+”结尾表示将内容追加到原数组后面'
            },
            '\\+proxies': {
              type: 'array',
              $ref: '#/definitions/proxies',
              description: '“+”开头表示将内容插入到原数组前面'
            },
            'proxies\\+': {
              type: 'array',
              $ref: '#/definitions/proxies',
              description: '“+”结尾表示将内容追加到原数组后面'
            },
            '\\+proxy-groups': {
              type: 'array',
              $ref: '#/definitions/proxy-groups',
              description: '“+”开头表示将内容插入到原数组前面'
            },
            'proxy-groups\\+': {
              type: 'array',
              $ref: '#/definitions/proxy-groups',
              description: '“+”结尾表示将内容追加到原数组后面'
            },
            '^\\+': {
              type: 'array',
              description: '“+”开头表示将内容插入到原数组前面'
            },
            '\\+$': {
              type: 'array',
              description: '“+”结尾表示将内容追加到原数组后面'
            },
            '!$': {
              type: 'object',
              description: '“!”结尾表示强制覆盖该项而不进行递归合并'
            }
          }
        }
      }
    ]
  })
  // configure PAC definition
  monaco.typescript.javascriptDefaults.addExtraLib(pac, 'pac.d.ts')
  initialized = true
}

export const BaseEditor: React.FC<Props> = (props) => {
  const { theme, systemTheme } = useTheme()
  const trueTheme = theme === 'system' ? systemTheme : theme
  const {
    value,
    originalValue,
    diffRenderSideBySide = false,
    readOnly = false,
    language,
    onChange
  } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()

  const { hasLongLine, isLargeContent } = useMemo(
    () => getContentStats(value, originalValue),
    [originalValue, value]
  )
  const modelLanguage = isLargeContent ? 'text' : language
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(undefined)
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor>(undefined)
  const editorUriRef = useRef<monaco.Uri>(createEditorUri('model', modelLanguage))
  const originalUriRef = useRef<monaco.Uri>(createEditorUri('original', modelLanguage))
  const modifiedUriRef = useRef<monaco.Uri>(createEditorUri('modified', modelLanguage))

  const editorWillMount = (): void => {
    monacoInitialization()
  }

  const editorDidMount = (editor: monaco.editor.IStandaloneCodeEditor): void => {
    editorRef.current = editor
  }

  const editorWillUnmount = (editor: monaco.editor.IStandaloneCodeEditor): void => {
    editor.getModel()?.dispose()
  }

  const diffEditorDidMount = (editor: monaco.editor.IStandaloneDiffEditor): void => {
    diffEditorRef.current = editor
  }

  const options = {
    tabSize: ['yaml', 'javascript', 'json'].includes(language) ? 2 : 4, // 根据语言类型设置缩进大小
    minimap: {
      enabled: !isLargeContent && document.documentElement.clientWidth >= 1500 // 超过一定宽度显示 minimap 滚动条
    },
    mouseWheelZoom: true, // 按住 Ctrl 滚轮调节缩放比例
    readOnly: readOnly, // 只读模式
    largeFileOptimizations: true,
    renderValidationDecorations: (isLargeContent ? 'off' : 'on') as 'off' | 'on' | 'editable', // 只读模式下显示校验信息
    quickSuggestions: isLargeContent
      ? false
      : {
          strings: true, // 字符串类型的建议
          comments: true, // 注释类型的建议
          other: true // 其他类型的建议
        },
    suggestOnTriggerCharacters: !isLargeContent,
    acceptSuggestionOnCommitCharacter: !isLargeContent,
    selectionHighlight: !isLargeContent,
    occurrencesHighlight: (isLargeContent ? 'off' : 'singleFile') as 'off' | 'singleFile',
    codeLens: !isLargeContent,
    colorDecorators: !isLargeContent,
    links: !isLargeContent,
    matchBrackets: (isLargeContent ? 'never' : 'always') as 'never' | 'always',
    fontFamily: `Maple Mono NF CN,Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji", "Noto Color Emoji"`,
    fontLigatures: true, // 连字符
    smoothScrolling: !disableAnimation, // 禁用动画时关闭平滑滚动
    pixelRatio: window.devicePixelRatio, // 设置像素比
    renderSideBySide: diffRenderSideBySide, // 侧边显示
    useInlineViewWhenSpaceIsLimited: false, // 侧边显示时不要自动退回内联模式
    glyphMargin: false, // 禁用字形边距
    folding: !isLargeContent, // 启用代码折叠
    scrollBeyondLastLine: false, // 禁止滚动超过最后一行
    automaticLayout: true, // 自动布局
    wordWrap: (hasLongLine ? 'off' : 'on') as 'on' | 'off', // 超长行时关闭自动换行
    wordWrapOverride1: (hasLongLine ? 'off' : 'inherit') as 'off' | 'on' | 'inherit',
    wordWrapOverride2: (hasLongLine ? 'off' : 'inherit') as 'off' | 'on' | 'inherit',
    wrappingStrategy: (hasLongLine ? 'simple' : 'advanced') as 'simple' | 'advanced',
    stopRenderingLineAfter: hasLongLine ? 5000 : 10000,
    // 禁用动画时的性能优化选项
    cursorBlinking: (disableAnimation ? 'solid' : 'blink') as 'solid' | 'blink', // 禁用光标闪烁动画
    cursorSmoothCaretAnimation: (disableAnimation ? 'off' : 'on') as 'off' | 'on', // 禁用光标移动动画
    scrollbar: {
      useShadows: !disableAnimation, // 禁用滚动条阴影
      verticalScrollbarSize: disableAnimation ? 10 : 14, // 减小滚动条尺寸
      horizontalScrollbarSize: disableAnimation ? 10 : 14
    },
    suggest: {
      insertMode: (disableAnimation ? 'replace' : 'insert') as 'replace' | 'insert', // 简化建议插入模式
      showIcons: !disableAnimation // 禁用建议图标以减少渲染
    },
    hover: {
      enabled: !disableAnimation && !isLargeContent, // 禁用悬停提示
      delay: disableAnimation ? 0 : 300
    }
  }

  if (originalValue !== undefined) {
    return (
      <MonacoDiffEditor
        language={modelLanguage}
        original={originalValue}
        value={value}
        originalUri={() => originalUriRef.current}
        modifiedUri={() => modifiedUriRef.current}
        height="100%"
        theme={trueTheme?.includes('light') ? 'vs' : 'vs-dark'}
        options={options}
        editorWillMount={editorWillMount}
        editorDidMount={diffEditorDidMount}
        editorWillUnmount={(): void => {}}
        onChange={onChange}
      />
    )
  }

  return (
    <MonacoEditor
      language={modelLanguage}
      value={value}
      uri={() => editorUriRef.current}
      height="100%"
      theme={trueTheme?.includes('light') ? 'vs' : 'vs-dark'}
      options={options}
      editorWillMount={editorWillMount}
      editorDidMount={editorDidMount}
      editorWillUnmount={editorWillUnmount}
      onChange={onChange}
    />
  )
}
