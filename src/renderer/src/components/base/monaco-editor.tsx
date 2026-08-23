import React, { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'

export type EditorOptions = monaco.editor.IStandaloneEditorConstructionOptions &
  monaco.editor.IStandaloneDiffEditorConstructionOptions

interface MonacoEditorProps {
  value: string
  language: string
  theme: string
  options: EditorOptions
  uri: monaco.Uri
  initialize: () => void
  onChange?: (value: string) => void
}

interface MonacoDiffEditorProps extends MonacoEditorProps {
  originalValue: string
  originalUri: monaco.Uri
}

function updateEditorValue(
  editor: monaco.editor.IStandaloneCodeEditor,
  value: string,
  isUpdating: React.RefObject<boolean>
): void {
  const model = editor.getModel()
  if (!model || model.getValue() === value) return

  isUpdating.current = true
  try {
    editor.pushUndoStop()
    model.pushEditOperations(
      [],
      [
        {
          range: model.getFullModelRange(),
          text: value
        }
      ],
      () => null
    )
    editor.pushUndoStop()
  } finally {
    isUpdating.current = false
  }
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  language,
  theme,
  options,
  uri,
  initialize,
  onChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(null)
  const isUpdatingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    initialize()
    const model = monaco.editor.createModel(value, language, uri)
    const editor = monaco.editor.create(containerRef.current, {
      ...options,
      model,
      theme
    })
    const subscription = editor.onDidChangeModelContent(() => {
      if (!isUpdatingRef.current) {
        onChangeRef.current?.(editor.getValue())
      }
    })
    editorRef.current = editor

    return () => {
      subscription.dispose()
      editor.dispose()
      model.dispose()
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    if (editorRef.current) {
      updateEditorValue(editorRef.current, value, isUpdatingRef)
    }
  }, [value])

  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, language)
    }
  }, [language])

  useEffect(() => {
    editorRef.current?.updateOptions(options)
  }, [options])

  useEffect(() => {
    monaco.editor.setTheme(theme)
  }, [theme])

  return <div ref={containerRef} className="h-full w-full" />
}

export const MonacoDiffEditor: React.FC<MonacoDiffEditorProps> = ({
  value,
  originalValue,
  language,
  theme,
  options,
  uri,
  originalUri,
  initialize,
  onChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor>(null)
  const isUpdatingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    initialize()
    const originalModel = monaco.editor.createModel(originalValue, language, originalUri)
    const modifiedModel = monaco.editor.createModel(value, language, uri)
    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      ...options,
      theme
    })
    editor.setModel({ original: originalModel, modified: modifiedModel })
    const subscription = modifiedModel.onDidChangeContent(() => {
      if (!isUpdatingRef.current) {
        onChangeRef.current?.(modifiedModel.getValue())
      }
    })
    editorRef.current = editor

    return () => {
      subscription.dispose()
      editor.dispose()
      originalModel.dispose()
      modifiedModel.dispose()
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    const editor = editorRef.current?.getModifiedEditor()
    if (editor) {
      updateEditorValue(editor, value, isUpdatingRef)
    }
  }, [value])

  useEffect(() => {
    const model = editorRef.current?.getModel()?.original
    if (model && model.getValue() !== originalValue) {
      model.setValue(originalValue)
    }
  }, [originalValue])

  useEffect(() => {
    const models = editorRef.current?.getModel()
    if (models) {
      monaco.editor.setModelLanguage(models.original, language)
      monaco.editor.setModelLanguage(models.modified, language)
    }
  }, [language])

  useEffect(() => {
    editorRef.current?.updateOptions(options)
  }, [options])

  useEffect(() => {
    monaco.editor.setTheme(theme)
  }, [theme])

  return <div ref={containerRef} className="h-full w-full" />
}
