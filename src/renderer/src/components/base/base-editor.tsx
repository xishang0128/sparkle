import { useRef } from 'react'
import * as monaco from 'monaco-editor'
import MonacoEditor, { MonacoDiffEditor } from 'react-monaco-editor'
import { configureMonacoYaml } from 'monaco-yaml'
import metaSchema from 'meta-json-schema/schemas/meta-json-schema.json'
import pac from 'types-pac/pac.d.ts?raw'
import { useTheme } from 'next-themes'
import { nanoid } from 'nanoid'
import React from 'react'
type Language = 'yaml' | 'javascript' | 'css' | 'json' | 'text'

interface Props {
  value: string
  originalValue?: string
  diffRenderSideBySide?: boolean
  readOnly?: boolean
  language: Language
  onChange?: (value: string) => void
}

let initialized = false
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
  monaco.languages.typescript.javascriptDefaults.addExtraLib(pac, 'pac.d.ts')
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

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(undefined)
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor>(undefined)

  const editorWillMount = (): void => {
    monacoInitialization()
  }

  const editorDidMount = (editor: monaco.editor.IStandaloneCodeEditor): void => {
    editorRef.current = editor

    const uri = monaco.Uri.parse(`${nanoid()}.${language === 'yaml' ? 'clash' : ''}.${language}`)
    const model = monaco.editor.createModel(value, language, uri)
    editorRef.current.setModel(model)
  }
  const diffEditorDidMount = (editor: monaco.editor.IStandaloneDiffEditor): void => {
    diffEditorRef.current = editor

    const originalUri = monaco.Uri.parse(
      `original-${nanoid()}.${language === 'yaml' ? 'clash' : ''}.${language}`
    )
    const modifiedUri = monaco.Uri.parse(
      `modified-${nanoid()}.${language === 'yaml' ? 'clash' : ''}.${language}`
    )
    const originalModel = monaco.editor.createModel(originalValue || '', language, originalUri)
    const modifiedModel = monaco.editor.createModel(value, language, modifiedUri)
    diffEditorRef.current.setModel({
      original: originalModel,
      modified: modifiedModel
    })
  }

  const options = {
    tabSize: ['yaml', 'javascript', 'json'].includes(language) ? 2 : 4, // 根据语言类型设置缩进大小
    minimap: {
      enabled: document.documentElement.clientWidth >= 1500 // 超过一定宽度显示 minimap 滚动条
    },
    mouseWheelZoom: true, // 按住 Ctrl 滚轮调节缩放比例
    readOnly: readOnly, // 只读模式
    renderValidationDecorations: 'on' as 'off' | 'on' | 'editable', // 只读模式下显示校验信息
    quickSuggestions: {
      strings: true, // 字符串类型的建议
      comments: true, // 注释类型的建议
      other: true // 其他类型的建议
    },
    fontFamily: `Maple Mono NF CN,Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji", "Noto Color Emoji"`,
    fontLigatures: true, // 连字符
    smoothScrolling: true, // 平滑滚动
    pixelRatio: window.devicePixelRatio, // 设置像素比
    renderSideBySide: diffRenderSideBySide, // 侧边显示
    glyphMargin: false, // 禁用字形边距
    folding: true, // 启用代码折叠
    scrollBeyondLastLine: false, // 禁止滚动超过最后一行
    automaticLayout: true // 自动布局
  }

  if (originalValue !== undefined) {
    return (
      <MonacoDiffEditor
        language={language}
        original={originalValue}
        value={value}
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
      language={language}
      value={value}
      height="100%"
      theme={trueTheme?.includes('light') ? 'vs' : 'vs-dark'}
      options={options}
      editorWillMount={editorWillMount}
      editorDidMount={editorDidMount}
      editorWillUnmount={(): void => {}}
      onChange={onChange}
    />
  )
}
